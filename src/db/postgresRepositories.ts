/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * Aurum Intelligence — PostgreSQL Persistence Repositories (Wave A / GAP-02 Cutover Layer)
 *
 * Implements parameterized ACID persistence repositories aligned 1:1 with
 * `/migrations/001_initial_postgresql_schema.sql` (`processed_webhook_events`,
 * `user_entitlements`, `credit_ledger_entries`, `immutable_forecast_snapshots`,
 * `editorial_publications`) plus an optional dynamic `pg` pool loader when
 * `DATABASE_URL` is provided in production.
 */

import crypto from 'node:crypto';
import type {
  ProcessedWebhookRecord,
  ServerCreditLedgerEntry,
  UserEntitlementState,
  WebhookPersistenceAdapter,
} from '../services/billingWebhookEngine';
import type { ForecastLifecycleRecord, ForecastLifecycleState } from '../services/forecastAccountability';
import type { InstrumentId, PaperPosition, TradePlan } from '../domain/types';

export interface SqlQueryResult<T = Record<string, unknown>> {
  rows: T[];
}

export interface SqlExecutor {
  query: <T = Record<string, unknown>>(sql: string, params?: unknown[]) => Promise<SqlQueryResult<T>>;
  withTransaction: <T>(fn: (tx: SqlExecutor) => Promise<T>) => Promise<T>;
  ping?: () => Promise<boolean>;
  close?: () => Promise<void>;
}

export interface EditorialPublicationRow {
  publicationId: string;
  reportType: string;
  title: string;
  channel: string;
  publicationStatus: 'PUBLISHED' | 'SIMULATED' | 'FAILED' | 'BLOCKED';
  metaPostId?: string;
  gatePassed: boolean;
  snapshotSha256: string;
  publishedAt: string;
}

/**
 * Generates deterministic SHA-256 hex digest using Node crypto for webhook payload integrity columns.
 */
function sha256Hex(input: string): string {
  return crypto.createHash('sha256').update(input, 'utf8').digest('hex');
}

/**
 * Maps billing records, entitlements, and double-entry credit ledger rows to PostgreSQL
 * while preserving the synchronous `WebhookPersistenceAdapter` interface via startup hydration
 * and serialized ACID write-through transactions.
 */
export class PostgresBillingRepository {
  private readonly executor: SqlExecutor;
  private cachedRecords: ProcessedWebhookRecord[] = [];
  private cachedEntitlements: UserEntitlementState[] = [];
  private cachedLedger: ServerCreditLedgerEntry[] = [];
  private writeQueue: Promise<void> = Promise.resolve();
  private lastWriteError: string | null = null;

  constructor(executor: SqlExecutor) {
    this.executor = executor;
  }

  public getLastWriteError(): string | null {
    return this.lastWriteError;
  }

  public async hydrate(): Promise<{
    recordsCount: number;
    entitlementsCount: number;
    ledgerCount: number;
  }> {
    const recRes = await this.executor.query<{
      event_id: string;
      event_type: string;
      received_at: string | Date;
      status: 'PROCESSED' | 'DUPLICATE_IGNORED';
      user_id: string | null;
      tier_granted: string | null;
      credits_granted: number | null;
    }>(
      `SELECT event_id, event_type, received_at, status, user_id, tier_granted, credits_granted
       FROM processed_webhook_events
       ORDER BY received_at ASC
       LIMIT 500`
    );

    const entRes = await this.executor.query<{
      user_id: string;
      tier: UserEntitlementState['tier'];
      credits_balance: number;
      active_subscription_id: string | null;
      subscription_status: UserEntitlementState['subscriptionStatus'] | null;
      updated_at: string | Date;
    }>(
      `SELECT user_id, tier, credits_balance, active_subscription_id, subscription_status, updated_at
       FROM user_entitlements`
    );

    const ledRes = await this.executor.query<{
      id: string;
      idempotency_key: string;
      user_id: string;
      transaction_type: ServerCreditLedgerEntry['transactionType'];
      delta_credits: number;
      before_balance: number;
      after_balance: number;
      related_plan_id: string | null;
      created_at: string | Date;
      note: string;
    }>(
      `SELECT id, idempotency_key, user_id, transaction_type, delta_credits, before_balance, after_balance, related_plan_id, created_at, note
       FROM credit_ledger_entries
       ORDER BY created_at ASC
       LIMIT 1000`
    );

    this.cachedRecords = recRes.rows.map((r) => ({
      eventId: r.event_id,
      eventType: r.event_type,
      receivedAt: new Date(r.received_at).toISOString(),
      status: r.status,
      userId: r.user_id || undefined,
      tierGranted: r.tier_granted || undefined,
      creditsGranted: r.credits_granted ?? undefined,
    }));

    this.cachedEntitlements = entRes.rows.map((e) => ({
      userId: e.user_id,
      tier: e.tier,
      creditsBalance: Number(e.credits_balance),
      activeSubscriptionId: e.active_subscription_id || undefined,
      subscriptionStatus: e.subscription_status || undefined,
      lastUpdated: new Date(e.updated_at).toISOString(),
    }));

    this.cachedLedger = ledRes.rows.map((l) => ({
      id: l.id,
      idempotencyKey: l.idempotency_key,
      userId: l.user_id,
      transactionType: l.transaction_type,
      deltaCredits: Number(l.delta_credits),
      beforeBalance: Number(l.before_balance),
      afterBalance: Number(l.after_balance),
      eventId: l.related_plan_id || undefined,
      timestamp: new Date(l.created_at).toISOString(),
      note: l.note,
    }));

    return {
      recordsCount: this.cachedRecords.length,
      entitlementsCount: this.cachedEntitlements.length,
      ledgerCount: this.cachedLedger.length,
    };
  }

  public async flushPendingWrites(): Promise<void> {
    await this.writeQueue;
  }

  public createWriteThroughAdapter(): WebhookPersistenceAdapter {
    const enqueueWrite = (op: () => Promise<void>) => {
      this.writeQueue = this.writeQueue
        .then(op)
        .catch((err: any) => {
          this.lastWriteError = String(err?.message || err);
        });
    };

    return {
      loadRecords: () => [...this.cachedRecords],
      saveRecords: (records) => {
        this.cachedRecords = [...records];
        enqueueWrite(async () => {
          await this.executor.withTransaction(async (tx) => {
            for (const rec of records) {
              await tx.query(
                `INSERT INTO processed_webhook_events
                  (event_id, event_type, user_id, tier_granted, credits_granted, status, payload_sha256, received_at)
                 VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
                 ON CONFLICT (event_id) DO NOTHING`,
                [
                  rec.eventId,
                  rec.eventType,
                  rec.userId ?? null,
                  rec.tierGranted ?? null,
                  rec.creditsGranted ?? 0,
                  rec.status,
                  sha256Hex(JSON.stringify(rec)),
                  rec.receivedAt,
                ]
              );
            }
          });
        });
      },
      loadEntitlements: () => [...this.cachedEntitlements],
      saveEntitlements: (entitlements) => {
        this.cachedEntitlements = [...entitlements];
        enqueueWrite(async () => {
          await this.executor.withTransaction(async (tx) => {
            for (const ent of entitlements) {
              await tx.query(
                `INSERT INTO user_entitlements
                  (user_id, tier, credits_balance, active_subscription_id, subscription_status, updated_at)
                 VALUES ($1, $2, $3, $4, $5, $6)
                 ON CONFLICT (user_id) DO UPDATE SET
                   tier = EXCLUDED.tier,
                   credits_balance = EXCLUDED.credits_balance,
                   active_subscription_id = EXCLUDED.active_subscription_id,
                   subscription_status = EXCLUDED.subscription_status,
                   updated_at = EXCLUDED.updated_at`,
                [
                  ent.userId,
                  ent.tier,
                  ent.creditsBalance,
                  ent.activeSubscriptionId ?? null,
                  ent.subscriptionStatus ?? null,
                  ent.lastUpdated,
                ]
              );
            }
          });
        });
      },
      loadLedger: () => [...this.cachedLedger],
      saveLedger: (ledger) => {
        this.cachedLedger = [...ledger];
        enqueueWrite(async () => {
          await this.executor.withTransaction(async (tx) => {
            for (const entry of ledger) {
              // Ensure referenced user_entitlements row exists before inserting ledger foreign key
              await tx.query(
                `INSERT INTO user_entitlements (user_id, tier, credits_balance, updated_at)
                 VALUES ($1, 'FREE', $2, $3)
                 ON CONFLICT (user_id) DO NOTHING`,
                [entry.userId, entry.afterBalance, entry.timestamp]
              );
              const uuidLike = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(entry.id)
                ? entry.id
                : crypto.randomUUID();
              await tx.query(
                `INSERT INTO credit_ledger_entries
                  (id, idempotency_key, user_id, transaction_type, delta_credits, before_balance, after_balance, related_plan_id, note, created_at)
                 VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
                 ON CONFLICT (idempotency_key) DO NOTHING`,
                [
                  uuidLike,
                  entry.idempotencyKey,
                  entry.userId,
                  entry.transactionType,
                  entry.deltaCredits,
                  entry.beforeBalance,
                  entry.afterBalance,
                  entry.eventId ?? null,
                  entry.note,
                  entry.timestamp,
                ]
              );
            }
          });
        });
      },
    };
  }
}

/**
 * Parameterized repository for `/migrations/001_initial_postgresql_schema.sql`
 * table `immutable_forecast_snapshots`.
 */
export class PostgresForecastRepository {
  private readonly executor: SqlExecutor;

  constructor(executor: SqlExecutor) {
    this.executor = executor;
  }

  public async upsertForecastLifecycle(record: ForecastLifecycleRecord): Promise<void> {
    const p = record.plan;
    const isResolvedTerminal = ['TARGET_REACHED', 'STOP_REACHED', 'INVALIDATED', 'EXPIRED'].includes(record.state);
    await this.executor.query(
      `INSERT INTO immutable_forecast_snapshots
        (forecast_id, instrument_id, horizon, direction, reference_mid, entry_min, entry_max, stop_loss, target_1, target_2, target_3, market_regime, data_quality, snapshot_hash, lifecycle_state, created_at, resolved_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17)
       ON CONFLICT (forecast_id) DO UPDATE SET
         lifecycle_state = EXCLUDED.lifecycle_state,
         resolved_at = EXCLUDED.resolved_at`,
      [
        record.forecastId,
        p.instrumentId,
        p.horizon,
        p.direction,
        p.entryZoneMin,
        p.entryZoneMin,
        p.entryZoneMax,
        p.stopLossPrice,
        p.target1Price,
        p.target2Price ?? null,
        p.target3Price ?? null,
        'UNKNOWN',
        p.isAbstained ? 'QUALITY_HOLD' : 'FRESH',
        record.snapshotHash,
        record.state,
        record.createdAt,
        isResolvedTerminal ? record.updatedAt : null,
      ]
    );
  }

  public async loadAllForecasts(limit = 500): Promise<ForecastLifecycleRecord[]> {
    const res = await this.executor.query<{
      forecast_id: string;
      instrument_id: InstrumentId;
      horizon: TradePlan['horizon'];
      direction: TradePlan['direction'];
      reference_mid: number | string;
      entry_min: number | string | null;
      entry_max: number | string | null;
      stop_loss: number | string | null;
      target_1: number | string | null;
      target_2: number | string | null;
      target_3: number | string | null;
      data_quality: string;
      snapshot_hash: string;
      lifecycle_state: ForecastLifecycleState;
      created_at: string | Date;
      resolved_at: string | Date | null;
    }>(
      `SELECT forecast_id, instrument_id, horizon, direction, reference_mid, entry_min, entry_max, stop_loss, target_1, target_2, target_3, data_quality, snapshot_hash, lifecycle_state, created_at, resolved_at
       FROM immutable_forecast_snapshots
       ORDER BY created_at DESC
       LIMIT $1`,
      [limit]
    );

    return res.rows.map((r) => {
      const createdAtIso = new Date(r.created_at).toISOString();
      const updatedAtIso = r.resolved_at ? new Date(r.resolved_at).toISOString() : createdAtIso;
      const entryMin = Number(r.entry_min ?? r.reference_mid);
      const entryMax = Number(r.entry_max ?? r.reference_mid);
      const stopLoss = Number(r.stop_loss ?? entryMin);
      const target1 = Number(r.target_1 ?? entryMax);
      const target2 = r.target_2 !== null && r.target_2 !== undefined ? Number(r.target_2) : target1;
      const target3 = r.target_3 !== null && r.target_3 !== undefined ? Number(r.target_3) : target2;
      const riskDistance = Math.max(0.01, Math.abs(entryMin - stopLoss));
      const rewardDistance = Math.abs(target1 - entryMin);
      const dirStr = String(r.direction);

      const plan: TradePlan = {
        id: r.forecast_id,
        instrumentId: r.instrument_id,
        horizon: r.horizon,
        direction: r.direction,
        state: r.data_quality === 'QUALITY_HOLD' ? 'DATA_QUALITY_HOLD' : 'BUY_CONFIRMED',
        createdAt: createdAtIso,
        expiryAt: createdAtIso,
        currentMid: Number(r.reference_mid),
        entryZoneMin: entryMin,
        entryZoneMax: entryMax,
        triggerPrice: entryMin,
        stopLossPrice: stopLoss,
        target1Price: target1,
        target2Price: target2,
        target3Price: target3,
        riskDistance,
        rewardDistance,
        rewardToRiskRatio: Number((rewardDistance / riskDistance).toFixed(2)),
        invalidationCondition: `Close beyond $${stopLoss}`,
        eventRiskWarning: '',
        isAbstained: r.data_quality === 'QUALITY_HOLD' || dirStr === 'NO_TRADE' || dirStr === 'INSUFFICIENT_EVIDENCE',
        snapshotHash: r.snapshot_hash,
      };

      return {
        forecastId: r.forecast_id,
        schemaVersion: '1.6.2',
        state: r.lifecycle_state,
        plan,
        snapshotHash: r.snapshot_hash,
        createdAt: createdAtIso,
        updatedAt: updatedAtIso,
        isImmutableLocked: r.lifecycle_state !== 'DRAFT',
        transitions: [
          {
            from: null,
            to: r.lifecycle_state,
            reason: 'Hydrated from PostgreSQL immutable_forecast_snapshots',
            actor: 'postgres_hydrator',
            timestamp: createdAtIso,
          },
        ],
      };
    });
  }

  public async countForecasts(): Promise<number> {
    const res = await this.executor.query<{ count: string | number }>(
      `SELECT COUNT(*) AS count FROM immutable_forecast_snapshots`
    );
    return Number(res.rows[0]?.count || 0);
  }
}

/**
 * Parameterized repository for `editorial_publications` audit trail.
 */
export class PostgresEditorialRepository {
  private readonly executor: SqlExecutor;

  constructor(executor: SqlExecutor) {
    this.executor = executor;
  }

  public async insertPublication(row: EditorialPublicationRow): Promise<void> {
    await this.executor.query(
      `INSERT INTO editorial_publications
        (publication_id, report_type, title, channel, publication_status, meta_post_id, gate_passed, snapshot_sha256, published_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
       ON CONFLICT (publication_id) DO NOTHING`,
      [
        row.publicationId,
        row.reportType,
        row.title,
        row.channel,
        row.publicationStatus,
        row.metaPostId ?? null,
        row.gatePassed,
        row.snapshotSha256,
        row.publishedAt,
      ]
    );
  }
}

export interface PaperJournalEntryRecord extends PaperPosition {
  userId: string;
  updatedAt: string;
}

/**
 * Parameterized repository for `/migrations/002_paper_journal_positions.sql`
 * table `paper_journal_positions` (Wave B / Phase 9).
 */
export class PostgresPaperJournalRepository {
  private readonly executor: SqlExecutor;

  constructor(executor: SqlExecutor) {
    this.executor = executor;
  }

  public async loadPositions(userId: string, limit = 200): Promise<PaperJournalEntryRecord[]> {
    const res = await this.executor.query<{
      position_id: string;
      user_id: string;
      trade_plan_id: string;
      instrument_id: InstrumentId;
      direction: 'BUY' | 'SELL';
      lots: number | string;
      entry_price: number | string;
      stop_loss: number | string;
      take_profit: number | string;
      realized_pnl: number | string;
      open_time: string | Date;
      status: PaperPosition['status'];
      notes: string;
      updated_at: string | Date;
    }>(
      `SELECT position_id, user_id, trade_plan_id, instrument_id, direction, lots, entry_price, stop_loss, take_profit, realized_pnl, open_time, status, notes, updated_at
       FROM paper_journal_positions
       WHERE user_id = $1
       ORDER BY open_time DESC
       LIMIT $2`,
      [userId, limit]
    );

    return res.rows.map((r) => ({
      id: r.position_id,
      userId: r.user_id,
      tradePlanId: r.trade_plan_id,
      instrumentId: r.instrument_id,
      direction: r.direction,
      lots: Number(r.lots),
      entryPrice: Number(r.entry_price),
      currentPrice: Number(r.entry_price),
      stopLoss: Number(r.stop_loss),
      takeProfit: Number(r.take_profit),
      unrealizedPnl: 0,
      realizedPnl: Number(r.realized_pnl),
      openTime: new Date(r.open_time).toISOString(),
      status: r.status,
      notes: r.notes,
      updatedAt: new Date(r.updated_at).toISOString(),
    }));
  }

  public async upsertPosition(record: PaperJournalEntryRecord): Promise<void> {
    await this.executor.query(
      `INSERT INTO paper_journal_positions
        (position_id, user_id, trade_plan_id, instrument_id, direction, lots, entry_price, stop_loss, take_profit, realized_pnl, open_time, status, notes, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
       ON CONFLICT (position_id) DO UPDATE SET
         realized_pnl = EXCLUDED.realized_pnl,
         status = EXCLUDED.status,
         notes = EXCLUDED.notes,
         updated_at = EXCLUDED.updated_at`,
      [
        record.id,
        record.userId,
        record.tradePlanId,
        record.instrumentId,
        record.direction,
        record.lots,
        record.entryPrice,
        record.stopLoss,
        record.takeProfit,
        record.realizedPnl,
        record.openTime,
        record.status,
        record.notes,
        record.updatedAt,
      ]
    );
  }

  public async resetUserPositions(userId: string): Promise<void> {
    await this.executor.query(`DELETE FROM paper_journal_positions WHERE user_id = $1`, [userId]);
  }
}

/**
 * Dynamically connects via `pg` Pool when `DATABASE_URL` is configured in production.
 */
export async function createOptionalPgPoolExecutor(databaseUrl?: string): Promise<SqlExecutor | null> {
  if (!databaseUrl) return null;
  try {
    const pgModuleName = 'pg';
    const pgMod = (await import(/* @vite-ignore */ pgModuleName)) as any;
    const PoolCtor = pgMod.Pool || pgMod.default?.Pool;
    if (!PoolCtor) {
      throw new Error('PostgreSQL `pg` Pool constructor unavailable.');
    }
    const pool = new PoolCtor({
      connectionString: databaseUrl,
      max: 10,
      idleTimeoutMillis: 30_000,
      connectionTimeoutMillis: 5_000,
    });
    const executor: SqlExecutor = {
      query: (sql, params = []) => pool.query(sql, params),
      withTransaction: async (fn) => {
        const client = await pool.connect();
        try {
          await client.query('BEGIN');
          const txExec: SqlExecutor = {
            query: (s, p = []) => client.query(s, p),
            withTransaction: async (inner) => inner(txExec),
          };
          const out = await fn(txExec);
          await client.query('COMMIT');
          return out;
        } catch (err) {
          await client.query('ROLLBACK');
          throw err;
        } finally {
          client.release();
        }
      },
      ping: async () => {
        await pool.query('SELECT 1');
        return true;
      },
      close: () => pool.end(),
    };
    return executor;
  } catch (err: any) {
    console.warn(`PostgreSQL optional executor unavailable (${String(err?.message || err)}); using atomic file store.`);
    return null;
  }
}

/**
 * Deterministic SQL query recorder & in-memory Postgres emulator for offline unit tests (Wave A).
 */
export class InMemorySqlMockExecutor implements SqlExecutor {
  public readonly executedStatements: Array<{ sql: string; params: unknown[] }> = [];
  public migrationRows = new Map<string, { filename: string; checksum: string }>();
  public webhookRows = new Map<string, Record<string, unknown>>();
  public entitlementRows = new Map<string, Record<string, unknown>>();
  public ledgerRows = new Map<string, Record<string, unknown>>();
  public forecastRows = new Map<string, Record<string, unknown>>();
  public editorialRows = new Map<string, Record<string, unknown>>();
  public paperJournalRows = new Map<string, Record<string, unknown>>();

  public async query<T = Record<string, unknown>>(sql: string, params: unknown[] = []): Promise<SqlQueryResult<T>> {
    this.executedStatements.push({ sql: sql.replace(/\s+/g, ' ').trim(), params });
    const normalized = sql.trim().toUpperCase();

    if (normalized.startsWith('SELECT') && normalized.includes('FROM SCHEMA_MIGRATIONS')) {
      return { rows: Array.from(this.migrationRows.values()) as T[] };
    }
    if (normalized.includes('INSERT INTO SCHEMA_MIGRATIONS')) {
      const filename = String(params[0]);
      this.migrationRows.set(filename, { filename, checksum: String(params[1]) });
      return { rows: [] };
    }
    if (normalized.startsWith('SELECT') && normalized.includes('FROM PROCESSED_WEBHOOK_EVENTS')) {
      return { rows: Array.from(this.webhookRows.values()) as T[] };
    }
    if (normalized.startsWith('SELECT') && normalized.includes('FROM USER_ENTITLEMENTS')) {
      return { rows: Array.from(this.entitlementRows.values()) as T[] };
    }
    if (normalized.startsWith('SELECT') && normalized.includes('FROM CREDIT_LEDGER_ENTRIES')) {
      return { rows: Array.from(this.ledgerRows.values()) as T[] };
    }
    if (normalized.startsWith('SELECT COUNT(*) AS COUNT FROM IMMUTABLE_FORECAST_SNAPSHOTS')) {
      return { rows: [{ count: this.forecastRows.size }] as T[] };
    }
    if (normalized.startsWith('SELECT') && normalized.includes('FROM IMMUTABLE_FORECAST_SNAPSHOTS')) {
      return { rows: Array.from(this.forecastRows.values()) as T[] };
    }
    if (normalized.startsWith('SELECT') && normalized.includes('FROM PAPER_JOURNAL_POSITIONS')) {
      const uid = String(params[0] || '');
      return {
        rows: Array.from(this.paperJournalRows.values()).filter((r) => !uid || r.user_id === uid) as T[],
      };
    }
    if (normalized.includes('INSERT INTO PROCESSED_WEBHOOK_EVENTS')) {
      const eventId = String(params[0]);
      if (!this.webhookRows.has(eventId)) {
        this.webhookRows.set(eventId, {
          event_id: eventId,
          event_type: params[1],
          user_id: params[2],
          tier_granted: params[3],
          credits_granted: params[4],
          status: params[5],
          payload_sha256: params[6],
          received_at: params[7],
        });
      }
      return { rows: [] };
    }
    if (normalized.includes('INSERT INTO USER_ENTITLEMENTS')) {
      const userId = String(params[0]);
      if (normalized.includes('DO NOTHING')) {
        if (!this.entitlementRows.has(userId)) {
          this.entitlementRows.set(userId, {
            user_id: userId,
            tier: 'FREE',
            credits_balance: params[1],
            active_subscription_id: null,
            subscription_status: null,
            updated_at: params[2],
          });
        }
      } else {
        this.entitlementRows.set(userId, {
          user_id: userId,
          tier: params[1],
          credits_balance: params[2],
          active_subscription_id: params[3],
          subscription_status: params[4],
          updated_at: params[5],
        });
      }
      return { rows: [] };
    }
    if (normalized.includes('INSERT INTO CREDIT_LEDGER_ENTRIES')) {
      const idempKey = String(params[1]);
      if (!this.ledgerRows.has(idempKey)) {
        this.ledgerRows.set(idempKey, {
          id: params[0],
          idempotency_key: idempKey,
          user_id: params[2],
          transaction_type: params[3],
          delta_credits: params[4],
          before_balance: params[5],
          after_balance: params[6],
          related_plan_id: params[7],
          note: params[8],
          created_at: params[9],
        });
      }
      return { rows: [] };
    }
    if (normalized.includes('INSERT INTO IMMUTABLE_FORECAST_SNAPSHOTS')) {
      const forecastId = String(params[0]);
      this.forecastRows.set(forecastId, {
        forecast_id: forecastId,
        instrument_id: params[1],
        horizon: params[2],
        direction: params[3],
        reference_mid: params[4],
        entry_min: params[5],
        entry_max: params[6],
        stop_loss: params[7],
        target_1: params[8],
        target_2: params[9],
        target_3: params[10],
        market_regime: params[11],
        data_quality: params[12],
        snapshot_hash: params[13],
        lifecycle_state: params[14],
        created_at: params[15],
        resolved_at: params[16],
      });
      return { rows: [] };
    }
    if (normalized.includes('INSERT INTO PAPER_JOURNAL_POSITIONS')) {
      const posId = String(params[0]);
      this.paperJournalRows.set(posId, {
        position_id: posId,
        user_id: params[1],
        trade_plan_id: params[2],
        instrument_id: params[3],
        direction: params[4],
        lots: params[5],
        entry_price: params[6],
        stop_loss: params[7],
        take_profit: params[8],
        realized_pnl: params[9],
        open_time: params[10],
        status: params[11],
        notes: params[12],
        updated_at: params[13],
      });
      return { rows: [] };
    }
    if (normalized.startsWith('DELETE FROM PAPER_JOURNAL_POSITIONS')) {
      const uid = String(params[0] || '');
      for (const [k, v] of this.paperJournalRows.entries()) {
        if (v.user_id === uid) this.paperJournalRows.delete(k);
      }
      return { rows: [] };
    }
    if (normalized.includes('INSERT INTO EDITORIAL_PUBLICATIONS')) {
      const pubId = String(params[0]);
      if (!this.editorialRows.has(pubId)) {
        this.editorialRows.set(pubId, {
          publication_id: pubId,
          report_type: params[1],
          title: params[2],
          channel: params[3],
          publication_status: params[4],
          meta_post_id: params[5],
          gate_passed: params[6],
          snapshot_sha256: params[7],
          published_at: params[8],
        });
      }
      return { rows: [] };
    }

    return { rows: [] };
  }

  public async withTransaction<T>(fn: (tx: SqlExecutor) => Promise<T>): Promise<T> {
    return fn(this);
  }

  public async ping(): Promise<boolean> {
    return true;
  }
}
