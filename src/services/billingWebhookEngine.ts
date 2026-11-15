/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * Aurum Intelligence — Idempotent Webhook & Enterprise Access Engine
 *
 * Implements Phase 8:
 * 1. Cryptographic/Deterministic Idempotency Key validation against replay attacks.
 * 2. Subscription lifecycle transitions (checkout.session.completed, subscription.updated/deleted).
 * 3. Enterprise session token validation and expiration checking.
 */

export interface ProcessedWebhookRecord {
  eventId: string;
  eventType: string;
  receivedAt: string;
  status: 'PROCESSED' | 'DUPLICATE_IGNORED';
  userId?: string;
  tierGranted?: string;
  creditsGranted?: number;
}

export interface UserEntitlementState {
  userId: string;
  tier: 'FREE' | 'PRO' | 'ALPHA' | 'INSTITUTIONAL';
  creditsBalance: number;
  activeSubscriptionId?: string;
  subscriptionStatus?: 'active' | 'past_due' | 'canceled';
  lastUpdated: string;
}

export interface WebhookEventPayload {
  id: string;
  type: string;
  data?: {
    object?: {
      id?: string;
      customer?: string;
      mode?: 'payment' | 'subscription';
      status?: 'active' | 'past_due' | 'canceled';
      metadata?: {
        userId?: string;
        tier?: 'PRO' | 'ALPHA' | 'INSTITUTIONAL';
        creditPackId?: string;
        creditsAmount?: string | number;
      };
    };
  };
}

export interface WebhookProcessResult {
  received: boolean;
  eventId: string;
  status: 'PROCESSED' | 'DUPLICATE_IGNORED';
  processedAt?: string;
  message?: string;
  userEntitlements?: UserEntitlementState;
}

export interface ServerCreditLedgerEntry {
  id: string;
  idempotencyKey: string;
  userId: string;
  transactionType: 'TIER_GRANT' | 'PACK_PURCHASE' | 'INITIAL_GRANT';
  deltaCredits: number;
  beforeBalance: number;
  afterBalance: number;
  eventId?: string;
  timestamp: string;
  note: string;
}

export interface WebhookPersistenceAdapter {
  loadRecords: () => ProcessedWebhookRecord[];
  saveRecords: (records: ProcessedWebhookRecord[]) => void;
  loadEntitlements?: () => UserEntitlementState[];
  saveEntitlements?: (entitlements: UserEntitlementState[]) => void;
  loadLedger?: () => ServerCreditLedgerEntry[];
  saveLedger?: (ledger: ServerCreditLedgerEntry[]) => void;
}

export interface SessionVerificationResult {
  valid: boolean;
  persona?: string;
  expiresAt?: string;
  expiredAt?: string;
  error?: string;
  tokenType?: string;
  verifiedAt: string;
  entitlements?: {
    canViewAuditHashes: boolean;
    canExecutePaperJournal: boolean;
    canAccessCouncilQuorum: boolean;
    zeroBrokerRoutingEnforced: boolean;
  };
}

export class EnterpriseBillingEngine {
  private processedEvents = new Map<string, ProcessedWebhookRecord>();
  private userEntitlements = new Map<string, UserEntitlementState>();
  private creditLedger: ServerCreditLedgerEntry[] = [];
  private persistenceAdapter?: WebhookPersistenceAdapter;

  constructor(persistenceAdapter?: WebhookPersistenceAdapter) {
    this.persistenceAdapter = persistenceAdapter;

    // Seed default demo user
    this.userEntitlements.set('usr_demo_trader', {
      userId: 'usr_demo_trader',
      tier: 'FREE',
      creditsBalance: 5,
      lastUpdated: new Date().toISOString(),
    });

    if (this.persistenceAdapter) {
      try {
        const loadedRecords = this.persistenceAdapter.loadRecords();
        if (Array.isArray(loadedRecords)) {
          loadedRecords.forEach((r) => this.processedEvents.set(r.eventId, r));
        }
        const loadedEntitlements = this.persistenceAdapter.loadEntitlements?.();
        if (Array.isArray(loadedEntitlements)) {
          loadedEntitlements.forEach((e) => this.userEntitlements.set(e.userId, e));
        }
        const loadedLedger = this.persistenceAdapter.loadLedger?.();
        if (Array.isArray(loadedLedger)) {
          this.creditLedger = loadedLedger;
        }
      } catch {
        // Fallback safely if persistence store unreadable
      }
      return;
    }

    // Load persisted idempotency records if available in browser environment
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        const stored = window.localStorage.getItem('aurum_processed_webhooks');
        if (stored) {
          const parsed = JSON.parse(stored);
          if (Array.isArray(parsed)) {
            parsed.forEach((r: ProcessedWebhookRecord) => this.processedEvents.set(r.eventId, r));
          }
        }
      }
    } catch {
      // Graceful fallback for non-browser/server environments
    }
  }

  private persistRecord(record: ProcessedWebhookRecord) {
    this.processedEvents.set(record.eventId, record);
    if (this.persistenceAdapter) {
      try {
        this.persistenceAdapter.saveRecords(Array.from(this.processedEvents.values()).slice(-500));
        this.persistenceAdapter.saveEntitlements?.(Array.from(this.userEntitlements.values()));
        this.persistenceAdapter.saveLedger?.(this.creditLedger.slice(-1000));
      } catch {
        // Graceful degradation
      }
      return;
    }
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        const list = Array.from(this.processedEvents.values()).slice(-200);
        window.localStorage.setItem('aurum_processed_webhooks', JSON.stringify(list));
      }
    } catch {
      // Graceful degradation
    }
  }

  public processWebhookEvent(event: WebhookEventPayload): WebhookProcessResult {
    if (!event || !event.id || !event.type) {
      throw new Error('Invalid webhook payload: event.id and event.type are required.');
    }

    // Replay attack defense: Deduplicate by event.id
    if (this.processedEvents.has(event.id)) {
      const existing = this.processedEvents.get(event.id)!;
      return {
        received: true,
        eventId: event.id,
        status: 'DUPLICATE_IGNORED',
        processedAt: existing.receivedAt,
        message: 'Idempotency key match: event already processed. Replay mutation blocked.',
      };
    }

    const dataObject = event.data?.object || {};
    const userId = dataObject.metadata?.userId || dataObject.customer || 'usr_demo_trader';
    let tierGranted: string | undefined;
    let creditsGranted: number | undefined;

    const userRecord: UserEntitlementState = this.userEntitlements.get(userId) || {
      userId,
      tier: 'FREE',
      creditsBalance: 5,
      lastUpdated: new Date().toISOString(),
    };

    switch (event.type) {
      case 'checkout.session.completed': {
        const planTier = dataObject.metadata?.tier;
        const creditPackId = dataObject.metadata?.creditPackId;
        const creditsAmount = Number(dataObject.metadata?.creditsAmount || 0);

        if (planTier && ['PRO', 'ALPHA', 'INSTITUTIONAL'].includes(planTier)) {
          userRecord.tier = planTier;
          tierGranted = planTier;
          const tierGrant = planTier === 'INSTITUTIONAL' ? 5000 : planTier === 'ALPHA' ? 500 : 0;
          if (tierGrant > 0) {
            const before = userRecord.creditsBalance;
            userRecord.creditsBalance += tierGrant;
            this.creditLedger.push({
              id: `sled_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
              idempotencyKey: `webhook:${event.id}:tier`,
              userId,
              transactionType: 'TIER_GRANT',
              deltaCredits: tierGrant,
              beforeBalance: before,
              afterBalance: userRecord.creditsBalance,
              eventId: event.id,
              timestamp: new Date().toISOString(),
              note: `${planTier} subscription tier non-cash credit allocation`,
            });
          }
        }

        if (creditPackId && creditsAmount > 0) {
          const before = userRecord.creditsBalance;
          userRecord.creditsBalance += creditsAmount;
          creditsGranted = creditsAmount;
          this.creditLedger.push({
            id: `sled_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
            idempotencyKey: `webhook:${event.id}:pack`,
            userId,
            transactionType: 'PACK_PURCHASE',
            deltaCredits: creditsAmount,
            beforeBalance: before,
            afterBalance: userRecord.creditsBalance,
            eventId: event.id,
            timestamp: new Date().toISOString(),
            note: `Purchased ${creditPackId} (${creditsAmount} non-cash signal credits)`,
          });
        }
        break;
      }

      case 'customer.subscription.updated': {
        const subStatus = dataObject.status;
        userRecord.subscriptionStatus = subStatus;
        if (dataObject.id) userRecord.activeSubscriptionId = dataObject.id;
        if (subStatus === 'active') {
          const tier = dataObject.metadata?.tier || 'PRO';
          userRecord.tier = tier;
          tierGranted = tier;
        }
        break;
      }

      case 'customer.subscription.deleted': {
        userRecord.tier = 'FREE';
        userRecord.subscriptionStatus = 'canceled';
        tierGranted = 'FREE';
        break;
      }

      case 'invoice.payment_succeeded': {
        userRecord.subscriptionStatus = 'active';
        break;
      }

      default:
        break;
    }

    userRecord.lastUpdated = new Date().toISOString();
    this.userEntitlements.set(userId, userRecord);

    const record: ProcessedWebhookRecord = {
      eventId: event.id,
      eventType: event.type,
      receivedAt: new Date().toISOString(),
      status: 'PROCESSED',
      userId,
      tierGranted,
      creditsGranted,
    };
    this.persistRecord(record);

    return {
      received: true,
      eventId: event.id,
      status: 'PROCESSED',
      processedAt: record.receivedAt,
      userEntitlements: userRecord,
    };
  }

  public getEntitlements(userId: string): UserEntitlementState {
    return (
      this.userEntitlements.get(userId) || {
        userId,
        tier: 'FREE',
        creditsBalance: 5,
        lastUpdated: new Date().toISOString(),
      }
    );
  }

  public getHistory(): ProcessedWebhookRecord[] {
    return Array.from(this.processedEvents.values()).reverse();
  }

  public getCreditLedger(userId?: string): ServerCreditLedgerEntry[] {
    const entries = userId ? this.creditLedger.filter((l) => l.userId === userId) : this.creditLedger;
    return [...entries].reverse();
  }

  public static verifySessionToken(token?: string): SessionVerificationResult {
    if (!token) {
      return {
        valid: false,
        error: 'Missing session authorization token',
        verifiedAt: new Date().toISOString(),
      };
    }

    if (token.startsWith('aurum_sess_')) {
      const rest = token.substring('aurum_sess_'.length);
      const lastUnderscore = rest.lastIndexOf('_');
      const persona = lastUnderscore !== -1 ? rest.substring(0, lastUnderscore) : rest;
      const expStr = lastUnderscore !== -1 ? rest.substring(lastUnderscore + 1) : '0';
      const exp = parseInt(expStr, 10);
      const now = Math.floor(Date.now() / 1000);

      if (exp > 0 && now > exp) {
        return {
          valid: false,
          error: 'Session token expired',
          expiredAt: new Date(exp * 1000).toISOString(),
          verifiedAt: new Date().toISOString(),
        };
      }

      return {
        valid: true,
        persona,
        expiresAt: exp > 0 ? new Date(exp * 1000).toISOString() : '2099-12-31T23:59:59Z',
        verifiedAt: new Date().toISOString(),
        entitlements: {
          canViewAuditHashes: true,
          canExecutePaperJournal: true,
          canAccessCouncilQuorum: true,
          zeroBrokerRoutingEnforced: true,
        },
      };
    }

    return {
      valid: false,
      error: 'Unrecognized or malformed session token format',
      verifiedAt: new Date().toISOString(),
    };
  }
}

export const canonicalBillingEngine = new EnterpriseBillingEngine();
