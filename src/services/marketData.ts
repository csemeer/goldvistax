/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * Aurum Intelligence — Market Data Normalization & Historical Engine
 * Multi-asset quotes, multi-timeframe candle synthesis, and data quality states.
 */

import { Candle, DataQualityState, InstrumentId, Quote, Timeframe } from '../domain/types';

// Baseline reference prices for institutional market instruments
const BASELINE_PRICES: Record<InstrumentId, { price: number; spread: number; name: string; unit: string }> = {
  // Gold
  XAUUSD: { price: 3898.90, spread: 0.30, name: 'Spot Gold / USD', unit: 'USD/oz' },
  GC_FUT: { price: 3912.40, spread: 0.40, name: 'COMEX Gold Active Continuous', unit: 'USD/oz' },
  XAU_CFD: { price: 3899.10, spread: 0.35, name: 'Gold Spot CFD', unit: 'USD/oz' },
  GLD_ETF: { price: 358.50, spread: 0.06, name: 'SPDR Gold Shares', unit: 'USD/sh' },
  // Silver
  XAGUSD: { price: 34.20, spread: 0.02, name: 'Spot Silver / USD', unit: 'USD/oz' },
  SI_FUT: { price: 34.45, spread: 0.025, name: 'COMEX Silver Active Futures', unit: 'USD/oz' },
  XAG_CFD: { price: 34.22, spread: 0.035, name: 'Silver Spot CFD', unit: 'USD/oz' },
  SLV_ETF: { price: 31.25, spread: 0.01, name: 'iShares Silver Trust', unit: 'USD/sh' },
  // WTI Oil
  WTI_CRUDE: { price: 71.80, spread: 0.03, name: 'WTI Light Sweet Crude', unit: 'USD/bbl' },
  CL_FUT: { price: 72.15, spread: 0.02, name: 'NYMEX Crude Oil Futures', unit: 'USD/bbl' },
  WTI_CFD: { price: 71.82, spread: 0.04, name: 'US Oil (WTI) Cash CFD', unit: 'USD/bbl' },
  USO_ETF: { price: 74.80, spread: 0.02, name: 'United States Oil Fund', unit: 'USD/sh' },
  // Brent Oil
  BRENT_CRUDE: { price: 75.90, spread: 0.03, name: 'Brent Crude Oil (ICE)', unit: 'USD/bbl' },
  BZ_FUT: { price: 76.25, spread: 0.02, name: 'ICE Brent Crude Futures', unit: 'USD/bbl' },
  BRENT_CFD: { price: 75.92, spread: 0.04, name: 'UK Oil (Brent) Cash CFD', unit: 'USD/bbl' },
  BNO_ETF: { price: 28.40, spread: 0.02, name: 'United States Brent Oil Fund', unit: 'USD/sh' },
  // Macro
  DXY: { price: 104.18, spread: 0.03, name: 'US Dollar Index', unit: 'pts' },
  US10Y: { price: 4.285, spread: 0.005, name: 'US 10Y Benchmark', unit: '%' },
  US_TIPS10Y: { price: 1.932, spread: 0.008, name: 'US 10Y TIPS Real Yield', unit: '%' },
};

// Seed deterministic candle histories per timeframe
export function generateCandleHistory(timeframe: Timeframe, count = 120, basePrice = 3898.90): Candle[] {
  const candles: Candle[] = [];
  const now = Date.now();
  
  // Timeframe interval in milliseconds
  const intervalMs: Record<Timeframe, number> = {
    '1m': 60 * 1000,
    '5m': 5 * 60 * 1000,
    '15m': 15 * 60 * 1000,
    '30m': 30 * 60 * 1000,
    '1h': 60 * 60 * 1000,
    '4h': 4 * 60 * 60 * 1000,
    '1D': 24 * 60 * 60 * 1000,
    '1W': 7 * 24 * 60 * 60 * 1000,
    '1M': 30 * 24 * 60 * 60 * 1000,
  };

  const step = intervalMs[timeframe] || 60 * 60 * 1000;
  const volatility = timeframe === '1m' ? 0.8 : timeframe === '15m' ? 2.5 : timeframe === '1h' ? 5.2 : 14.0;

  let currentPrice = basePrice - (count * 0.05 * volatility);

  // Generate realistic price action with trend cycles and pullbacks
  for (let i = count - 1; i >= 0; i--) {
    const timestamp = now - i * step;
    const timeStr = new Date(timestamp).toISOString();

    const cycle = Math.sin((count - i) / 12) * 1.5;
    const noise = (Math.sin(i * 3.7) + Math.cos(i * 1.9)) * volatility * 0.4;
    const delta = cycle + noise;

    const open = Number((currentPrice).toFixed(2));
    const close = Number((currentPrice + delta).toFixed(2));
    const high = Number((Math.max(open, close) + Math.abs(Math.sin(i * 2.1)) * volatility * 0.6).toFixed(2));
    const low = Number((Math.min(open, close) - Math.abs(Math.cos(i * 1.7)) * volatility * 0.6).toFixed(2));
    
    // Higher volume during simulated volatility swings
    const volume = Math.floor(800 + Math.abs(delta) * 350 + Math.sin(i * 0.8) * 200);

    candles.push({
      timestamp,
      timeStr,
      open,
      high,
      low,
      close,
      volume,
      isComplete: i > 0,
    });

    currentPrice = close;
  }

  return candles;
}

// Generate normalized live quotes
export function getLiveQuotes(): Record<InstrumentId, Quote> {
  const now = new Date().toISOString();
  const quotes: Partial<Record<InstrumentId, Quote>> = {};

  (Object.keys(BASELINE_PRICES) as InstrumentId[]).forEach((id) => {
    const base = BASELINE_PRICES[id];
    // Micro tick jitter
    const micro = (Math.sin(Date.now() / 3000 + id.charCodeAt(0)) * 0.05 * base.price) / 100;
    const mid = Number((base.price + micro).toFixed(id.includes('10Y') ? 3 : 2));
    const halfSpread = base.spread / 2;
    const bid = Number((mid - halfSpread).toFixed(id.includes('10Y') ? 3 : 2));
    const ask = Number((mid + halfSpread).toFixed(id.includes('10Y') ? 3 : 2));
    const change24hPct = Number((0.65 + Math.sin(id.charCodeAt(1)) * 0.4).toFixed(2));

    quotes[id] = {
      instrumentId: id,
      bid,
      ask,
      mid,
      spread: base.spread,
      spreadPips: Number((base.spread / (id.includes('10Y') ? 0.001 : 0.01)).toFixed(1)),
      high24h: Number((mid * 1.008).toFixed(2)),
      low24h: Number((mid * 0.992).toFixed(2)),
      open24h: Number((mid * (1 - change24hPct / 100)).toFixed(2)),
      change24hPct,
      volume24h: id === 'XAUUSD' ? 142850 : 45200,
      timestamp: now,
      provider: 'LBMA / Institutional OTC FIX Stream',
      quality: 'FRESH',
      latencyMs: 18,
    };
  });

  return quotes as Record<InstrumentId, Quote>;
}

export function getDataQualityStatus(quoteTimestampIso: string): {
  status: DataQualityState;
  ageSeconds: number;
  label: string;
} {
  const ageSeconds = Math.max(0, Math.floor((Date.now() - new Date(quoteTimestampIso).getTime()) / 1000));
  if (ageSeconds < 30) {
    return { status: 'FRESH', ageSeconds, label: 'Live Stream (<30s)' };
  } else if (ageSeconds < 120) {
    return { status: 'DEGRADED', ageSeconds, label: 'Delayed (<2m)' };
  } else if (ageSeconds < 900) {
    return { status: 'STALE', ageSeconds, label: 'Stale Feed (>2m)' };
  } else {
    return { status: 'QUALITY_HOLD', ageSeconds, label: 'Quality Hold (Halted)' };
  }
}

export interface QuoteValidationResult {
  valid: boolean;
  instrumentId: InstrumentId;
  derivedStatus: DataQualityState | 'INVALID';
  ageSeconds: number;
  errors: string[];
}

/**
 * Phase 1 (§4.4) Deterministic Quote Integrity Validator.
 * Verifies finite positive prices, bid <= ask, non-negative spread, valid timestamp, and staleness bounds.
 */
export function validateQuoteIntegrity(
  quote: Quote,
  maxAllowedStalenessSec = 120,
  nowMs = Date.now()
): QuoteValidationResult {
  const errors: string[] = [];
  const isYield = quote.instrumentId.includes('10Y');

  if (!Number.isFinite(quote.bid) || !Number.isFinite(quote.ask) || !Number.isFinite(quote.mid)) {
    errors.push('Non-finite bid/ask/mid numeric value.');
  }
  if (!isYield && (quote.mid <= 0 || quote.bid <= 0 || quote.ask <= 0)) {
    errors.push('Non-positive asset price rejected.');
  }
  if (quote.bid > quote.ask) {
    errors.push(`Crossed market detected: bid (${quote.bid}) > ask (${quote.ask}).`);
  }
  if (quote.spread < 0) {
    errors.push(`Negative spread (${quote.spread}) rejected.`);
  }
  if (quote.mid > 0 && !isYield && (quote.ask - quote.bid) / quote.mid > 0.05) {
    errors.push('Bid-ask spread exceeds 5% sanity threshold.');
  }

  const parsedTs = new Date(quote.timestamp).getTime();
  if (!Number.isFinite(parsedTs)) {
    errors.push('Invalid ISO quote timestamp.');
  }
  const ageSeconds = Number.isFinite(parsedTs) ? Math.max(0, Math.floor((nowMs - parsedTs) / 1000)) : Infinity;
  if (Number.isFinite(parsedTs) && parsedTs - nowMs > 60_000) {
    errors.push('Quote timestamp is >60s in the future (clock skew anomaly).');
  }
  if (ageSeconds > maxAllowedStalenessSec && quote.quality === 'FRESH') {
    errors.push(`Timestamp age (${ageSeconds}s) exceeds FRESH staleness ceiling (${maxAllowedStalenessSec}s).`);
  }

  let derivedStatus: DataQualityState | 'INVALID' = quote.quality;
  if (errors.some((e) => !e.includes('staleness ceiling'))) {
    derivedStatus = 'INVALID';
  } else if (ageSeconds > maxAllowedStalenessSec) {
    derivedStatus = ageSeconds >= 900 ? 'QUALITY_HOLD' : 'STALE';
  }

  return {
    valid: errors.length === 0,
    instrumentId: quote.instrumentId,
    derivedStatus,
    ageSeconds: Number.isFinite(ageSeconds) ? ageSeconds : -1,
    errors,
  };
}

export interface CandleSeriesValidationResult {
  valid: boolean;
  candleCount: number;
  duplicateTimestampCount: number;
  outOfOrderCount: number;
  ohlcConsistencyErrors: number;
  negativeVolumeCount: number;
  gapCount: number;
  errors: string[];
}

/**
 * Phase 1 (§4.4) Deterministic OHLC Candle Series Validator.
 * Verifies monotonic timestamps, duplicate detection, OHLC bounds, non-negative volume, and interval gaps.
 */
export function validateCandleSeries(candles: Candle[], expectedStepMs?: number): CandleSeriesValidationResult {
  const errors: string[] = [];
  if (!Array.isArray(candles) || candles.length === 0) {
    return {
      valid: false,
      candleCount: 0,
      duplicateTimestampCount: 0,
      outOfOrderCount: 0,
      ohlcConsistencyErrors: 0,
      negativeVolumeCount: 0,
      gapCount: 0,
      errors: ['Empty or missing candle array.'],
    };
  }

  let duplicateTimestampCount = 0;
  let outOfOrderCount = 0;
  let ohlcConsistencyErrors = 0;
  let negativeVolumeCount = 0;
  let gapCount = 0;
  const seenTs = new Set<number>();

  for (let i = 0; i < candles.length; i++) {
    const c = candles[i];
    if (seenTs.has(c.timestamp)) {
      duplicateTimestampCount += 1;
    }
    seenTs.add(c.timestamp);

    if (i > 0) {
      const prev = candles[i - 1];
      if (c.timestamp <= prev.timestamp) {
        outOfOrderCount += 1;
      } else if (expectedStepMs && c.timestamp - prev.timestamp > expectedStepMs * 1.5) {
        gapCount += 1;
      }
    }

    const maxOC = Math.max(c.open, c.close);
    const minOC = Math.min(c.open, c.close);
    if (
      !Number.isFinite(c.open) ||
      !Number.isFinite(c.high) ||
      !Number.isFinite(c.low) ||
      !Number.isFinite(c.close) ||
      c.high < maxOC ||
      c.low > minOC ||
      c.low <= 0
    ) {
      ohlcConsistencyErrors += 1;
    }

    if (!Number.isFinite(c.volume) || c.volume < 0) {
      negativeVolumeCount += 1;
    }
  }

  if (duplicateTimestampCount > 0) errors.push(`Detected ${duplicateTimestampCount} duplicate timestamps.`);
  if (outOfOrderCount > 0) errors.push(`Detected ${outOfOrderCount} non-monotonic timestamps.`);
  if (ohlcConsistencyErrors > 0) errors.push(`Detected ${ohlcConsistencyErrors} OHLC bound violations.`);
  if (negativeVolumeCount > 0) errors.push(`Detected ${negativeVolumeCount} negative volume bars.`);
  if (gapCount > 0) errors.push(`Detected ${gapCount} interval gap(s) exceeding 1.5x expected step.`);

  return {
    valid: errors.length === 0,
    candleCount: candles.length,
    duplicateTimestampCount,
    outOfOrderCount,
    ohlcConsistencyErrors,
    negativeVolumeCount,
    gapCount,
    errors,
  };
}

