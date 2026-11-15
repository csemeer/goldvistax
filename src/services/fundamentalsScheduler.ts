/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * Aurum Intelligence — Scheduled Background Fundamentals Worker (P1 Roadmap)
 *
 * Pre-fetches and caches official CFTC (`6dca-aqww`), St. Louis FRED `DFII10`,
 * and US EIA API v2 commodity fundamental dossiers on a periodic background schedule,
 * avoiding per-request upstream rate-limit exhaustion and exposing live sync telemetry.
 */

import { CommodityType } from '../domain/types';
import {
  fetchLiveFundamentalsWithFallback,
  LiveFundamentalSyncResult,
} from './commodityFundamentalsEngine';

const SUPPORTED_COMMODITIES: CommodityType[] = ['GOLD', 'SILVER', 'WTI_OIL', 'BRENT_OIL'];

export interface CachedFundamentalRecord {
  dossier: LiveFundamentalSyncResult;
  cachedAtMs: number;
  cachedAtUtc: string;
}

export class FundamentalsScheduler {
  private cache = new Map<CommodityType, CachedFundamentalRecord>();
  private timer: ReturnType<typeof setInterval> | null = null;
  private lastBatchRefreshUtc: string | null = null;
  private readonly defaultTtlMs: number;

  constructor(defaultTtlMs = 10 * 60_000) {
    this.defaultTtlMs = defaultTtlMs;
  }

  public async getDossier(
    commodity: CommodityType,
    options?: { dynamicSpreadOverride?: number; forceRefresh?: boolean; timeoutMs?: number }
  ): Promise<LiveFundamentalSyncResult> {
    const force = Boolean(options?.forceRefresh);
    const hasOverride = typeof options?.dynamicSpreadOverride === 'number';
    const existing = this.cache.get(commodity);

    if (!force && !hasOverride && existing && Date.now() - existing.cachedAtMs < this.defaultTtlMs) {
      return existing.dossier;
    }

    const dossier = await fetchLiveFundamentalsWithFallback(
      commodity,
      options?.dynamicSpreadOverride,
      options?.timeoutMs ?? 1800
    );

    if (!hasOverride) {
      this.cache.set(commodity, {
        dossier,
        cachedAtMs: Date.now(),
        cachedAtUtc: new Date().toISOString(),
      });
    }
    return dossier;
  }

  public async refreshAll(timeoutMs = 1800): Promise<Record<CommodityType, LiveFundamentalSyncResult['liveSyncStatus']>> {
    const entries = await Promise.all(
      SUPPORTED_COMMODITIES.map(async (c) => {
        const d = await this.getDossier(c, { forceRefresh: true, timeoutMs });
        return [c, d.liveSyncStatus] as const;
      })
    );
    this.lastBatchRefreshUtc = new Date().toISOString();
    return Object.fromEntries(entries) as Record<CommodityType, LiveFundamentalSyncResult['liveSyncStatus']>;
  }

  public start(intervalMs = 15 * 60_000): void {
    if (this.timer) return;
    // Trigger initial non-blocking warm-up
    void this.refreshAll(1800);
    this.timer = setInterval(() => {
      void this.refreshAll(1800);
    }, intervalMs);
    this.timer.unref?.();
  }

  public stop(): void {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }

  public getStatus() {
    return {
      running: Boolean(this.timer),
      lastBatchRefreshUtc: this.lastBatchRefreshUtc,
      ttlMinutes: Math.round(this.defaultTtlMs / 60_000),
      commodities: Object.fromEntries(
        Array.from(this.cache.entries()).map(([commodity, rec]) => [
          commodity,
          {
            liveSyncStatus: rec.dossier.liveSyncStatus,
            cachedAtUtc: rec.cachedAtUtc,
          },
        ])
      ),
    };
  }
}

export const canonicalFundamentalsScheduler = new FundamentalsScheduler();
