/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * Aurum Intelligence — Canonical Market Data Provider Subsystem
 * Multi-provider routing, Yahoo Finance live feed adapter, freshness validation, and failover.
 */

import { InstrumentId, Quote, Timeframe, Candle } from '../domain/types';
import { getDataQualityStatus } from './marketData';

export type QuoteClassification =
  | 'LIVE'
  | 'DELAYED'
  | 'INDICATIVE'
  | 'SNAPSHOT'
  | 'CACHED'
  | 'STALE'
  | 'FROZEN'
  | 'SIMULATED'
  | 'UNAVAILABLE';

export interface ProviderCapability {
  providerId: string;
  name: string;
  supportedInstruments: InstrumentId[];
  isRealtime: boolean;
  requiresApiKey: boolean;
  isBroker: boolean;
  licensingNotes: string;
}

export interface ProviderHealth {
  providerId: string;
  name: string;
  status: 'ONLINE' | 'DEGRADED' | 'OFFLINE' | 'UNCONFIGURED';
  lastSuccessTimestamp?: string;
  lastError?: string;
  latencyMs: number;
  consecutiveFailures: number;
}

export interface ProviderConfig {
  primaryProvider: string;
  fallbackProvider: string;
  allowDelayed: boolean;
  allowCached: boolean;
  maxStaleSeconds: number;
  pollIntervalSeconds: number;
  goldApiToken?: string;
  ibkrHost?: string;
  ibkrPort?: number;
  alpacaKey?: string;
  alpacaSecret?: string;
  symbolOverrides: Record<string, string>;
}

export const DEFAULT_PROVIDER_CONFIG: ProviderConfig = {
  primaryProvider: 'yahoo_finance',
  fallbackProvider: 'simulated_reference',
  allowDelayed: true,
  allowCached: true,
  maxStaleSeconds: 60,
  pollIntervalSeconds: 15,
  symbolOverrides: {
    XAUUSD: 'GC=F',
    GC_FUT: 'GC=F',
    XAU_CFD: 'GC=F',
    GLD_ETF: 'GLD',
    XAGUSD: 'SI=F',
    SI_FUT: 'SI=F',
    XAG_CFD: 'SI=F',
    SLV_ETF: 'SLV',
    WTI_CRUDE: 'CL=F',
    CL_FUT: 'CL=F',
    WTI_CFD: 'CL=F',
    USO_ETF: 'USO',
    BRENT_CRUDE: 'BZ=F',
    BZ_FUT: 'BZ=F',
    BRENT_CFD: 'BZ=F',
    BNO_ETF: 'BNO',
    DXY: 'DX-Y.NYB',
    US10Y: '^TNX',
    US_TIPS10Y: '^TNX',
  },
};

// Internal normalized quote payload
export interface NormalizedRawQuote {
  instrumentId: InstrumentId;
  price: number;
  bid: number;
  ask: number;
  spread: number;
  sourceTimestamp: string;
  receiveTimestamp: string;
  provider: string;
  providerSymbol: string;
  classification: QuoteClassification;
  currency: string;
  unit: string;
  change24hPct: number;
  high24h: number;
  low24h: number;
  volume24h: number;
}

export class YahooFinanceProvider {
  id = 'yahoo_finance';
  name = 'Yahoo Finance Market Data';

  private symbolMap: Record<InstrumentId, string> = {
    XAUUSD: 'GC=F',
    GC_FUT: 'GC=F',
    XAU_CFD: 'GC=F',
    GLD_ETF: 'GLD',
    XAGUSD: 'SI=F',
    SI_FUT: 'SI=F',
    XAG_CFD: 'SI=F',
    SLV_ETF: 'SLV',
    WTI_CRUDE: 'CL=F',
    CL_FUT: 'CL=F',
    WTI_CFD: 'CL=F',
    USO_ETF: 'USO',
    BRENT_CRUDE: 'BZ=F',
    BZ_FUT: 'BZ=F',
    BRENT_CFD: 'BZ=F',
    BNO_ETF: 'BNO',
    DXY: 'DX-Y.NYB',
    US10Y: '^TNX',
    US_TIPS10Y: '^TNX',
  };

  async fetchQuote(instrumentId: InstrumentId): Promise<NormalizedRawQuote> {
    const symbol = this.symbolMap[instrumentId] || 'GC=F';
    const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?interval=1m&range=1d`;

    const startTime = Date.now();
    const res = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'application/json',
      },
    });

    if (!res.ok) {
      throw new Error(`Yahoo Finance API error for ${symbol}: HTTP ${res.status} ${res.statusText}`);
    }

    const data = await res.json();
    const result = data?.chart?.result?.[0];
    if (!result || !result.meta) {
      throw new Error(`Invalid response structure from Yahoo Finance for ${symbol}`);
    }

    const meta = result.meta;
    const price = Number(meta.regularMarketPrice);
    if (!price || isNaN(price) || price <= 0) {
      throw new Error(`Invalid market price received from Yahoo Finance: ${price}`);
    }

    const receiveTimestamp = new Date().toISOString();
    const sourceTimestamp = meta.regularMarketTime
      ? new Date(meta.regularMarketTime * 1000).toISOString()
      : receiveTimestamp;

    // Determine typical spread based on instrument
    const typicalSpread = instrumentId === 'XAUUSD' || instrumentId === 'GC_FUT' ? 0.30 : instrumentId === 'XAGUSD' ? 0.03 : 0.05;
    const halfSpread = typicalSpread / 2;
    const bid = Number((price - halfSpread).toFixed(2));
    const ask = Number((price + halfSpread).toFixed(2));

    const high24h = meta.regularMarketDayHigh ? Number(meta.regularMarketDayHigh) : Number((price * 1.008).toFixed(2));
    const low24h = meta.regularMarketDayLow ? Number(meta.regularMarketDayLow) : Number((price * 0.992).toFixed(2));
    const prevClose = meta.chartPreviousClose ? Number(meta.chartPreviousClose) : price;
    const change24hPct = prevClose > 0 ? Number((((price - prevClose) / prevClose) * 100).toFixed(2)) : 0;
    const volume24h = meta.regularMarketVolume || 125000;

    return {
      instrumentId,
      price,
      bid,
      ask,
      spread: typicalSpread,
      sourceTimestamp,
      receiveTimestamp,
      provider: 'Yahoo Finance (Live Market Reference)',
      providerSymbol: symbol,
      classification: 'LIVE',
      currency: meta.currency || 'USD',
      unit: instrumentId.includes('10Y') ? '%' : instrumentId === 'DXY' ? 'pts' : 'USD/oz',
      change24hPct,
      high24h,
      low24h,
      volume24h,
    };
  }
}

export class SimulatedProvider {
  id = 'simulated_reference';
  name = 'Simulated Reference Engine';

  private baselines: Record<InstrumentId, number> = {
    XAUUSD: 3898.90,
    GC_FUT: 3912.40,
    XAU_CFD: 3899.10,
    GLD_ETF: 358.50,
    XAGUSD: 34.20,
    SI_FUT: 34.45,
    XAG_CFD: 34.22,
    SLV_ETF: 31.25,
    WTI_CRUDE: 71.80,
    CL_FUT: 72.15,
    WTI_CFD: 71.82,
    USO_ETF: 74.80,
    BRENT_CRUDE: 75.90,
    BZ_FUT: 76.25,
    BRENT_CFD: 75.92,
    BNO_ETF: 28.40,
    DXY: 104.18,
    US10Y: 4.285,
    US_TIPS10Y: 1.932,
  };

  async fetchQuote(instrumentId: InstrumentId): Promise<NormalizedRawQuote> {
    const base = this.baselines[instrumentId] || 3895.50;
    const jitter = (Math.sin(Date.now() / 4000) * 0.02 * base) / 100;
    const price = Number((base + jitter).toFixed(2));
    const spread = instrumentId === 'XAUUSD' ? 0.35 : 0.05;

    return {
      instrumentId,
      price,
      bid: Number((price - spread / 2).toFixed(2)),
      ask: Number((price + spread / 2).toFixed(2)),
      spread,
      sourceTimestamp: new Date().toISOString(),
      receiveTimestamp: new Date().toISOString(),
      provider: 'Aurum Simulated Benchmark',
      providerSymbol: `SIM:${instrumentId}`,
      classification: 'SIMULATED',
      currency: 'USD',
      unit: instrumentId.includes('10Y') ? '%' : instrumentId === 'DXY' ? 'pts' : 'USD/oz',
      change24hPct: 0.85,
      high24h: Number((price * 1.01).toFixed(2)),
      low24h: Number((price * 0.99).toFixed(2)),
      volume24h: 95000,
    };
  }
}

export class MarketDataRouter {
  private config: ProviderConfig;
  private yahoo = new YahooFinanceProvider();
  private simulated = new SimulatedProvider();
  private cache: Partial<Record<InstrumentId, Quote>> = {};
  private cacheTimestamps: Partial<Record<InstrumentId, number>> = {};
  private healthState: Record<string, ProviderHealth> = {
    yahoo_finance: {
      providerId: 'yahoo_finance',
      name: 'Yahoo Finance Live Reference',
      status: 'ONLINE',
      latencyMs: 140,
      consecutiveFailures: 0,
    },
    simulated_reference: {
      providerId: 'simulated_reference',
      name: 'Simulated Benchmark Feed',
      status: 'ONLINE',
      latencyMs: 5,
      consecutiveFailures: 0,
    },
    ibkr_gateway: {
      providerId: 'ibkr_gateway',
      name: 'Interactive Brokers (TWS / Gateway)',
      status: 'UNCONFIGURED',
      latencyMs: 0,
      consecutiveFailures: 0,
    },
    alpaca_data: {
      providerId: 'alpaca_data',
      name: 'Alpaca Market Data',
      status: 'UNCONFIGURED',
      latencyMs: 0,
      consecutiveFailures: 0,
    },
  };

  constructor(config: ProviderConfig = DEFAULT_PROVIDER_CONFIG) {
    this.config = config;
  }

  getConfig(): ProviderConfig {
    return { ...this.config };
  }

  updateConfig(newConfig: Partial<ProviderConfig>) {
    this.config = { ...this.config, ...newConfig };
  }

  getHealthSummary(): Record<string, ProviderHealth> {
    return { ...this.healthState };
  }

  async getQuote(instrumentId: InstrumentId): Promise<Quote> {
    // 0. Return cached quote if fresh within 3.5 seconds
    const lastCachedTime = this.cacheTimestamps[instrumentId];
    if (lastCachedTime && Date.now() - lastCachedTime < 3500 && this.cache[instrumentId]) {
      return this.cache[instrumentId]!;
    }

    const startTime = Date.now();
    let raw: NormalizedRawQuote | null = null;
    let providerUsed = this.config.primaryProvider;

    // 1. Try Primary Provider (Yahoo Finance live feed)
    if (this.config.primaryProvider === 'yahoo_finance') {
      try {
        raw = await this.yahoo.fetchQuote(instrumentId);
        this.healthState.yahoo_finance.status = 'ONLINE';
        this.healthState.yahoo_finance.lastSuccessTimestamp = new Date().toISOString();
        this.healthState.yahoo_finance.latencyMs = Date.now() - startTime;
        this.healthState.yahoo_finance.consecutiveFailures = 0;
      } catch (err: any) {
        console.warn(`Primary provider (yahoo_finance) failed for ${instrumentId}:`, err.message);
        this.healthState.yahoo_finance.status = 'DEGRADED';
        this.healthState.yahoo_finance.lastError = err.message;
        this.healthState.yahoo_finance.consecutiveFailures += 1;
      }
    }

    // 2. Fallback to existing real cached quote while preserving original source timestamp & DEGRADED status (§4.3)
    if (!raw && this.cache[instrumentId]) {
      const cached = this.cache[instrumentId]!;
      return {
        ...cached,
        quality: 'DEGRADED',
      };
    }

    // 3. Fallback to Simulated Provider only if no real quote was ever received
    if (!raw) {
      providerUsed = this.config.fallbackProvider;
      try {
        raw = await this.simulated.fetchQuote(instrumentId);
        this.healthState.simulated_reference.status = 'ONLINE';
        this.healthState.simulated_reference.lastSuccessTimestamp = new Date().toISOString();
      } catch (err: any) {
        console.error(`Fallback provider failed for ${instrumentId}:`, err);
      }
    }

    if (!raw) {
      throw new Error(`Market data unavailable for ${instrumentId} across all configured providers.`);
    }

    const qualityInfo = getDataQualityStatus(raw.sourceTimestamp);
    const derivedQuality =
      raw.classification === 'SIMULATED'
        ? 'QUALITY_HOLD'
        : this.config.allowDelayed && qualityInfo.status === 'STALE' && qualityInfo.ageSeconds < 900
        ? 'DEGRADED'
        : qualityInfo.status;

    // Build canonical Quote object
    const canonicalQuote: Quote = {
      instrumentId: raw.instrumentId,
      bid: raw.bid,
      ask: raw.ask,
      mid: raw.price,
      spread: raw.spread,
      spreadPips: Number((raw.spread / 0.01).toFixed(1)),
      high24h: raw.high24h,
      low24h: raw.low24h,
      open24h: Number((raw.price * (1 - raw.change24hPct / 100)).toFixed(2)),
      change24hPct: raw.change24hPct,
      volume24h: raw.volume24h,
      timestamp: raw.sourceTimestamp,
      provider: raw.provider,
      quality: derivedQuality,
      latencyMs: Date.now() - startTime,
    };

    this.cache[instrumentId] = canonicalQuote;
    this.cacheTimestamps[instrumentId] = Date.now();
    return canonicalQuote;
  }

  async getAllQuotes(): Promise<Record<InstrumentId, Quote>> {
    const primaryFetches: InstrumentId[] = [
      'XAUUSD',
      'XAGUSD',
      'WTI_CRUDE',
      'BRENT_CRUDE',
      'GLD_ETF',
      'SLV_ETF',
      'USO_ETF',
      'BNO_ETF',
      'DXY',
      'US10Y',
    ];

    const results: Partial<Record<InstrumentId, Quote>> = {};
    await Promise.all(
      primaryFetches.map(async (id) => {
        try {
          results[id] = await this.getQuote(id);
        } catch (e) {
          // ignore error
        }
      })
    );

    // Derive gold derivatives
    const goldQ = results.XAUUSD;
    if (goldQ) {
      results.GC_FUT = { ...goldQ, instrumentId: 'GC_FUT', spread: 0.1, spreadPips: 10 };
      results.XAU_CFD = { ...goldQ, instrumentId: 'XAU_CFD', spread: 0.35, spreadPips: 35 };
    }

    // Derive silver derivatives
    const silverQ = results.XAGUSD;
    if (silverQ) {
      results.SI_FUT = { ...silverQ, instrumentId: 'SI_FUT', spread: 0.015, spreadPips: 1.5 };
      results.XAG_CFD = { ...silverQ, instrumentId: 'XAG_CFD', spread: 0.03, spreadPips: 3 };
    }

    // Derive WTI crude derivatives
    const wtiQ = results.WTI_CRUDE;
    if (wtiQ) {
      results.CL_FUT = { ...wtiQ, instrumentId: 'CL_FUT', spread: 0.03, spreadPips: 3 };
      results.WTI_CFD = { ...wtiQ, instrumentId: 'WTI_CFD', spread: 0.05, spreadPips: 5 };
    }

    // Derive Brent crude derivatives
    const brentQ = results.BRENT_CRUDE;
    if (brentQ) {
      results.BZ_FUT = { ...brentQ, instrumentId: 'BZ_FUT', spread: 0.03, spreadPips: 3 };
      results.BRENT_CFD = { ...brentQ, instrumentId: 'BRENT_CFD', spread: 0.05, spreadPips: 5 };
    }

    // Derive TIPS from 10Y
    const us10yQ = results.US10Y;
    if (us10yQ) {
      results.US_TIPS10Y = {
        ...us10yQ,
        instrumentId: 'US_TIPS10Y',
        mid: Number((us10yQ.mid - 2.35).toFixed(3)),
        bid: Number((us10yQ.bid - 2.35).toFixed(3)),
        ask: Number((us10yQ.ask - 2.35).toFixed(3)),
      };
    }

    const allInstruments: InstrumentId[] = [
      'XAUUSD',
      'GC_FUT',
      'XAU_CFD',
      'GLD_ETF',
      'XAGUSD',
      'SI_FUT',
      'XAG_CFD',
      'SLV_ETF',
      'WTI_CRUDE',
      'CL_FUT',
      'WTI_CFD',
      'USO_ETF',
      'BRENT_CRUDE',
      'BZ_FUT',
      'BRENT_CFD',
      'BNO_ETF',
      'DXY',
      'US10Y',
      'US_TIPS10Y',
    ];

    for (const id of allInstruments) {
      if (!results[id]) {
        results[id] = await this.simulated.fetchQuote(id).then((raw) => ({
          instrumentId: id,
          bid: raw.bid,
          ask: raw.ask,
          mid: raw.price,
          spread: raw.spread,
          spreadPips: Number((raw.spread / 0.01).toFixed(1)),
          high24h: raw.high24h,
          low24h: raw.low24h,
          open24h: raw.price,
          change24hPct: raw.change24hPct,
          volume24h: raw.volume24h,
          timestamp: raw.sourceTimestamp,
          provider: raw.provider,
          quality: 'QUALITY_HOLD',
          latencyMs: 10,
        }));
      }
    }

    return results as Record<InstrumentId, Quote>;
  }
}

// Global Singleton Router
export const canonicalMarketDataRouter = new MarketDataRouter();
