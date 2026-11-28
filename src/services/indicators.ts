/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * Aurum Intelligence — Canonical Indicator Engine
 * Pure mathematical functions for indicators, chart patterns, and pivots.
 */

import { Candle, IndicatorSnapshot, Quote, Timeframe } from '../domain/types';

export function calculateSMA(data: number[], period: number): number[] {
  const result: number[] = new Array(data.length).fill(0);
  if (data.length < period) return result;

  let sum = 0;
  for (let i = 0; i < period; i++) {
    sum += data[i];
  }
  result[period - 1] = sum / period;

  for (let i = period; i < data.length; i++) {
    sum += data[i] - data[i - period];
    result[i] = sum / period;
  }
  return result;
}

export function calculateEMA(data: number[], period: number): number[] {
  const result: number[] = new Array(data.length).fill(0);
  if (data.length < period) return result;

  const multiplier = 2 / (period + 1);
  let sum = 0;
  for (let i = 0; i < period; i++) {
    sum += data[i];
  }
  let prevEma = sum / period;
  result[period - 1] = prevEma;

  for (let i = period; i < data.length; i++) {
    const currentEma = (data[i] - prevEma) * multiplier + prevEma;
    result[i] = currentEma;
    prevEma = currentEma;
  }
  return result;
}

export function calculateRSI(closes: number[], period = 14): number[] {
  const result: number[] = new Array(closes.length).fill(50);
  if (closes.length <= period) return result;

  let gains = 0;
  let losses = 0;

  for (let i = 1; i <= period; i++) {
    const change = closes[i] - closes[i - 1];
    if (change >= 0) gains += change;
    else losses += Math.abs(change);
  }

  let avgGain = gains / period;
  let avgLoss = losses / period;

  result[period] = avgLoss === 0 ? 100 : 100 - 100 / (1 + avgGain / avgLoss);

  for (let i = period + 1; i < closes.length; i++) {
    const change = closes[i] - closes[i - 1];
    const gain = change > 0 ? change : 0;
    const loss = change < 0 ? Math.abs(change) : 0;

    avgGain = (avgGain * (period - 1) + gain) / period;
    avgLoss = (avgLoss * (period - 1) + loss) / period;

    if (avgLoss === 0) {
      result[i] = 100;
    } else {
      const rs = avgGain / avgLoss;
      result[i] = 100 - 100 / (1 + rs);
    }
  }

  return result;
}

export function calculateATR(candles: Candle[], period = 14): number[] {
  const result: number[] = new Array(candles.length).fill(0);
  if (candles.length < 2) return result;

  const tr: number[] = [candles[0].high - candles[0].low];
  for (let i = 1; i < candles.length; i++) {
    const current = candles[i];
    const prevClose = candles[i - 1].close;
    const trueRange = Math.max(
      current.high - current.low,
      Math.abs(current.high - prevClose),
      Math.abs(current.low - prevClose)
    );
    tr.push(trueRange);
  }

  if (tr.length < period) return result;

  let sum = 0;
  for (let i = 0; i < period; i++) {
    sum += tr[i];
  }
  let prevAtr = sum / period;
  result[period - 1] = prevAtr;

  for (let i = period; i < tr.length; i++) {
    prevAtr = (prevAtr * (period - 1) + tr[i]) / period;
    result[i] = prevAtr;
  }

  return result;
}

export function calculateBollingerBands(
  closes: number[],
  period = 20,
  stdDevMultiplier = 2
): { upper: number[]; middle: number[]; lower: number[]; bandwidth: number[] } {
  const middle = calculateSMA(closes, period);
  const upper = new Array(closes.length).fill(0);
  const lower = new Array(closes.length).fill(0);
  const bandwidth = new Array(closes.length).fill(0);

  for (let i = period - 1; i < closes.length; i++) {
    let varianceSum = 0;
    for (let j = i - period + 1; j <= i; j++) {
      varianceSum += Math.pow(closes[j] - middle[i], 2);
    }
    const stdDev = Math.sqrt(varianceSum / period);
    upper[i] = middle[i] + stdDev * stdDevMultiplier;
    lower[i] = middle[i] - stdDev * stdDevMultiplier;
    bandwidth[i] = middle[i] === 0 ? 0 : ((upper[i] - lower[i]) / middle[i]) * 100;
  }

  return { upper, middle, lower, bandwidth };
}

export function calculateMACD(
  closes: number[],
  fastPeriod = 12,
  slowPeriod = 26,
  signalPeriod = 9
): { macdLine: number[]; signalLine: number[]; histogram: number[] } {
  const fastEMA = calculateEMA(closes, fastPeriod);
  const slowEMA = calculateEMA(closes, slowPeriod);
  const macdLine = new Array(closes.length).fill(0);

  for (let i = slowPeriod - 1; i < closes.length; i++) {
    macdLine[i] = fastEMA[i] - slowEMA[i];
  }

  const signalLine = calculateEMA(macdLine.slice(slowPeriod - 1), signalPeriod);
  const fullSignalLine = new Array(closes.length).fill(0);
  const histogram = new Array(closes.length).fill(0);

  for (let i = 0; i < signalLine.length; i++) {
    const targetIdx = slowPeriod - 1 + i;
    fullSignalLine[targetIdx] = signalLine[i];
    histogram[targetIdx] = macdLine[targetIdx] - signalLine[i];
  }

  return { macdLine, signalLine: fullSignalLine, histogram };
}

export function calculateVWAP(candles: Candle[]): number[] {
  const result: number[] = new Array(candles.length).fill(0);
  let cumVol = 0;
  let cumTypVol = 0;

  for (let i = 0; i < candles.length; i++) {
    const c = candles[i];
    const typicalPrice = (c.high + c.low + c.close) / 3;
    cumTypVol += typicalPrice * c.volume;
    cumVol += c.volume;
    result[i] = cumVol === 0 ? c.close : cumTypVol / cumVol;
  }
  return result;
}

export function calculateSupertrend(
  candles: Candle[],
  period = 10,
  multiplier = 3
): { values: number[]; directions: ('BULLISH' | 'BEARISH')[] } {
  const atr = calculateATR(candles, period);
  const values = new Array(candles.length).fill(0);
  const directions: ('BULLISH' | 'BEARISH')[] = new Array(candles.length).fill('BULLISH');

  let prevUpper = 0;
  let prevLower = 0;
  let prevDirection: 'BULLISH' | 'BEARISH' = 'BULLISH';

  for (let i = period - 1; i < candles.length; i++) {
    const c = candles[i];
    const hl2 = (c.high + c.low) / 2;
    const basicUpper = hl2 + multiplier * atr[i];
    const basicLower = hl2 - multiplier * atr[i];

    let finalUpper = basicUpper;
    let finalLower = basicLower;

    if (i > period - 1) {
      finalUpper =
        basicUpper < prevUpper || candles[i - 1].close > prevUpper ? basicUpper : prevUpper;
      finalLower =
        basicLower > prevLower || candles[i - 1].close < prevLower ? basicLower : prevLower;
    }

    let direction: 'BULLISH' | 'BEARISH' = prevDirection;
    if (prevDirection === 'BULLISH' && c.close < finalLower) {
      direction = 'BEARISH';
    } else if (prevDirection === 'BEARISH' && c.close > finalUpper) {
      direction = 'BULLISH';
    }

    values[i] = direction === 'BULLISH' ? finalLower : finalUpper;
    directions[i] = direction;

    prevUpper = finalUpper;
    prevLower = finalLower;
    prevDirection = direction;
  }

  return { values, directions };
}

export function calculatePivots(candles: Candle[]): {
  pivot: number;
  resistance1: number;
  resistance2: number;
  support1: number;
  support2: number;
} {
  if (candles.length === 0) {
    return { pivot: 0, resistance1: 0, resistance2: 0, support1: 0, support2: 0 };
  }
  // Use recent reference candle (e.g. previous completed session or last candle)
  const ref = candles[candles.length - 1];
  const p = (ref.high + ref.low + ref.close) / 3;
  const r1 = 2 * p - ref.low;
  const s1 = 2 * p - ref.high;
  const r2 = p + (ref.high - ref.low);
  const s2 = p - (ref.high - ref.low);

  return {
    pivot: Number(p.toFixed(2)),
    resistance1: Number(r1.toFixed(2)),
    resistance2: Number(r2.toFixed(2)),
    support1: Number(s1.toFixed(2)),
    support2: Number(s2.toFixed(2)),
  };
}

export function generateIndicatorSnapshot(candles: Candle[]): IndicatorSnapshot {
  const closes = candles.map((c) => c.close);
  const lastIdx = candles.length - 1;

  const ema9 = calculateEMA(closes, 9);
  const ema21 = calculateEMA(closes, 21);
  const ema50 = calculateEMA(closes, 50);
  const ema200 = calculateEMA(closes, 200);

  const sma20 = calculateSMA(closes, 20);
  const sma50 = calculateSMA(closes, 50);
  const sma200 = calculateSMA(closes, 200);

  const rsi = calculateRSI(closes, 14);
  const macd = calculateMACD(closes);
  const atr = calculateATR(candles, 14);
  const bb = calculateBollingerBands(closes, 20, 2);
  const vwap = calculateVWAP(candles);
  const st = calculateSupertrend(candles, 10, 3);
  const pivots = calculatePivots(candles);

  return {
    timestamp: candles[lastIdx]?.timestamp || Date.now(),
    ema9: Number((ema9[lastIdx] || closes[lastIdx] || 0).toFixed(2)),
    ema21: Number((ema21[lastIdx] || closes[lastIdx] || 0).toFixed(2)),
    ema50: Number((ema50[lastIdx] || closes[lastIdx] || 0).toFixed(2)),
    ema200: Number((ema200[lastIdx] || closes[lastIdx] || 0).toFixed(2)),
    sma20: Number((sma20[lastIdx] || closes[lastIdx] || 0).toFixed(2)),
    sma50: Number((sma50[lastIdx] || closes[lastIdx] || 0).toFixed(2)),
    sma200: Number((sma200[lastIdx] || closes[lastIdx] || 0).toFixed(2)),
    rsi14: Number((rsi[lastIdx] || 50).toFixed(1)),
    macd: {
      macdLine: Number((macd.macdLine[lastIdx] || 0).toFixed(2)),
      signalLine: Number((macd.signalLine[lastIdx] || 0).toFixed(2)),
      histogram: Number((macd.histogram[lastIdx] || 0).toFixed(2)),
    },
    atr14: Number((atr[lastIdx] || 15).toFixed(2)),
    bollingerBands: {
      upper: Number((bb.upper[lastIdx] || closes[lastIdx] * 1.01).toFixed(2)),
      middle: Number((bb.middle[lastIdx] || closes[lastIdx]).toFixed(2)),
      lower: Number((bb.lower[lastIdx] || closes[lastIdx] * 0.99).toFixed(2)),
      bandwidth: Number((bb.bandwidth[lastIdx] || 2).toFixed(2)),
    },
    vwap: Number((vwap[lastIdx] || closes[lastIdx]).toFixed(2)),
    supertrend: {
      value: Number((st.values[lastIdx] || closes[lastIdx] * 0.98).toFixed(2)),
      direction: st.directions[lastIdx] || 'BULLISH',
    },
    supportResistance: pivots,
  };
}

export function calculateIndicatorsForSeries(candles: Candle[]): IndicatorSnapshot[] {
  if (candles.length === 0) return [];
  const closes = candles.map((c) => c.close);
  const ema9 = calculateEMA(closes, 9);
  const ema21 = calculateEMA(closes, 21);
  const ema50 = calculateEMA(closes, 50);
  const ema200 = calculateEMA(closes, 200);
  const sma20 = calculateSMA(closes, 20);
  const sma50 = calculateSMA(closes, 50);
  const sma200 = calculateSMA(closes, 200);
  const rsi = calculateRSI(closes, 14);
  const macd = calculateMACD(closes);
  const atr = calculateATR(candles, 14);
  const bb = calculateBollingerBands(closes, 20, 2);
  const vwap = calculateVWAP(candles);
  const st = calculateSupertrend(candles, 10, 3);
  const pivots = calculatePivots(candles);

  return candles.map((c, i) => ({
    timestamp: c.timestamp,
    ema9: Number((ema9[i] || c.close).toFixed(2)),
    ema21: Number((ema21[i] || c.close).toFixed(2)),
    ema50: Number((ema50[i] || c.close).toFixed(2)),
    ema200: Number((ema200[i] || c.close).toFixed(2)),
    sma20: Number((sma20[i] || c.close).toFixed(2)),
    sma50: Number((sma50[i] || c.close).toFixed(2)),
    sma200: Number((sma200[i] || c.close).toFixed(2)),
    rsi14: Number((rsi[i] || 50).toFixed(1)),
    macd: {
      macdLine: Number((macd.macdLine[i] || 0).toFixed(2)),
      signalLine: Number((macd.signalLine[i] || 0).toFixed(2)),
      histogram: Number((macd.histogram[i] || 0).toFixed(2)),
    },
    atr14: Number((atr[i] || 15).toFixed(2)),
    bollingerBands: {
      upper: Number((bb.upper[i] || c.close * 1.01).toFixed(2)),
      middle: Number((bb.middle[i] || c.close).toFixed(2)),
      lower: Number((bb.lower[i] || c.close * 0.99).toFixed(2)),
      bandwidth: Number((bb.bandwidth[i] || 2).toFixed(2)),
    },
    vwap: Number((vwap[i] || c.close).toFixed(2)),
    supertrend: {
      value: Number((st.values[i] || c.close * 0.98).toFixed(2)),
      direction: st.directions[i] || 'BULLISH',
    },
    supportResistance: pivots,
  }));
}

export function calculateHeikinAshi(candles: Candle[]): Candle[] {
  if (candles.length === 0) return [];
  const haCandles: Candle[] = [];

  let prevHaOpen = (candles[0].open + candles[0].close) / 2;
  let prevHaClose = (candles[0].open + candles[0].high + candles[0].low + candles[0].close) / 4;

  for (let i = 0; i < candles.length; i++) {
    const c = candles[i];
    const haClose = (c.open + c.high + c.low + c.close) / 4;
    const haOpen = i === 0 ? prevHaOpen : (prevHaOpen + prevHaClose) / 2;
    const haHigh = Math.max(c.high, haOpen, haClose);
    const haLow = Math.min(c.low, haOpen, haClose);

    haCandles.push({
      timestamp: c.timestamp,
      open: Number(haOpen.toFixed(2)),
      high: Number(haHigh.toFixed(2)),
      low: Number(haLow.toFixed(2)),
      close: Number(haClose.toFixed(2)),
      volume: c.volume,
      timeStr: c.timeStr,
      isComplete: c.isComplete,
    });

    prevHaOpen = haOpen;
    prevHaClose = haClose;
  }

  return haCandles;
}

export interface AtrVolatilityEvaluation {
  atr14: number;
  trueRangeMean14: number;
  trueRangeStdDev14: number;
  currentPriceMove: number;
  thresholdPriceMove: number;
  zScoreSigma: number;
  stdDevMultiplierThreshold: number;
  isBreached: boolean;
  severity: 'INFO' | 'WARNING' | 'CRITICAL';
  sampleSize: number;
  summary: string;
}

/**
 * Evaluates whether XAU/USD price action exceeds the 14-day Average True Range (ATR)
 * by more than `stdDevMultiplier` (default 2.5) standard deviations of trailing 14-day True Range.
 */
export function evaluateAtrVolatilityBreakout(
  candles: Candle[],
  quote?: Pick<Quote, 'mid' | 'open24h' | 'high24h' | 'low24h'>,
  stdDevMultiplier = 2.5
): AtrVolatilityEvaluation {
  if (!Array.isArray(candles) || candles.length < 2) {
    const liveMove = quote ? Math.abs(quote.mid - quote.open24h) : 0;
    return {
      atr14: 0,
      trueRangeMean14: 0,
      trueRangeStdDev14: 0,
      currentPriceMove: Number(liveMove.toFixed(2)),
      thresholdPriceMove: 0,
      zScoreSigma: 0,
      stdDevMultiplierThreshold: stdDevMultiplier,
      isBreached: false,
      severity: 'INFO',
      sampleSize: candles?.length || 0,
      summary: 'Insufficient daily candle history to evaluate 14-day ATR volatility dispersion.',
    };
  }

  const tr: number[] = [candles[0].high - candles[0].low];
  for (let i = 1; i < candles.length; i++) {
    const cur = candles[i];
    const prevClose = candles[i - 1].close;
    const trueRange = Math.max(
      cur.high - cur.low,
      Math.abs(cur.high - prevClose),
      Math.abs(cur.low - prevClose)
    );
    tr.push(trueRange);
  }

  const atrSeries = calculateATR(candles, 14);
  const hasCompletedPriorWindow = candles.length >= 15;
  const baselineTrWindow = hasCompletedPriorWindow
    ? tr.slice(-15, -1)
    : tr.length >= 3
    ? tr.slice(0, -1)
    : tr;
  const trMean = baselineTrWindow.reduce((sum, val) => sum + val, 0) / baselineTrWindow.length;
  const variance =
    baselineTrWindow.reduce((sum, val) => sum + Math.pow(val - trMean, 2), 0) / baselineTrWindow.length;
  const rawStdDev = Math.sqrt(variance);

  const atrIdx = hasCompletedPriorWindow ? candles.length - 2 : candles.length - 1;
  const rawAtr14 = atrSeries[atrIdx] > 0 ? atrSeries[atrIdx] : trMean;
  const atr14 = Number(rawAtr14.toFixed(2));
  const trueRangeMean14 = Number(trMean.toFixed(2));
  const trueRangeStdDev14 = Number(rawStdDev.toFixed(2));

  const latestBarTR = tr[tr.length - 1] ?? 0;
  const liveMoveFromOpen = quote ? Math.abs(quote.mid - quote.open24h) : 0;
  const currentPriceMove = Number(Math.max(latestBarTR, liveMoveFromOpen).toFixed(2));

  const effectiveStdDev = rawStdDev > 0.005 ? rawStdDev : Math.max(rawAtr14 * 0.15, 0.01);
  const thresholdPriceMove = Number((rawAtr14 + stdDevMultiplier * effectiveStdDev).toFixed(2));
  const zScoreSigma = Number(((currentPriceMove - rawAtr14) / effectiveStdDev).toFixed(2));
  const isBreached = zScoreSigma > stdDevMultiplier;
  const severity: AtrVolatilityEvaluation['severity'] =
    zScoreSigma >= 3.5 ? 'CRITICAL' : isBreached ? 'WARNING' : 'INFO';

  const summary = isBreached
    ? `Volatility breakout detected: XAU/USD range of $${currentPriceMove.toFixed(2)} exceeds 14D ATR ($${atr14.toFixed(2)}) by +${zScoreSigma.toFixed(2)}σ (> ${stdDevMultiplier}σ trigger $${thresholdPriceMove.toFixed(2)}).`
    : `Volatility contained: XAU/USD range of $${currentPriceMove.toFixed(2)} sits at ${zScoreSigma >= 0 ? '+' : ''}${zScoreSigma.toFixed(2)}σ vs 14D ATR ($${atr14.toFixed(2)}), below ${stdDevMultiplier}σ threshold ($${thresholdPriceMove.toFixed(2)}).`;

  return {
    atr14,
    trueRangeMean14,
    trueRangeStdDev14,
    currentPriceMove,
    thresholdPriceMove,
    zScoreSigma,
    stdDevMultiplierThreshold: stdDevMultiplier,
    isBreached,
    severity,
    sampleSize: baselineTrWindow.length,
    summary,
  };
}

export type VolumeLiquidityNodeType = 'POC' | 'HVN' | 'LVN' | 'NORMAL';

export interface TradeVolumeProfileBin {
  index: number;
  priceLow: number;
  priceHigh: number;
  midPrice: number;
  totalVolume: number;
  buyVolume: number;
  sellVolume: number;
  deltaVolume: number;
  sharePct: number;
  inValueArea: boolean;
  isPoc: boolean;
  isCurrentPriceLevel: boolean;
  liquidityNodeType: VolumeLiquidityNodeType;
}

export interface LiquidityZoneSummary {
  nodeType: 'POC' | 'HVN' | 'LVN';
  priceLow: number;
  priceHigh: number;
  midPrice: number;
  totalVolume: number;
  sharePct: number;
  netDeltaBias: 'ACCUMULATION' | 'DISTRIBUTION' | 'BALANCED';
  distanceFromSpotPct: number;
}

export interface TradeVolumeProfileResult {
  hasData: boolean;
  barsAnalyzed: number;
  binCount: number;
  priceMin: number;
  priceMax: number;
  binWidth: number;
  totalVolume: number;
  totalBuyVolume: number;
  totalSellVolume: number;
  netDeltaPct: number;
  pocPrice: number;
  pocVolume: number;
  pocSharePct: number;
  vahPrice: number;
  valPrice: number;
  valueAreaVolumePct: number;
  spotPrice: number;
  spotPosition: 'AT_POC' | 'INSIDE_VA' | 'ABOVE_VAH' | 'BELOW_VAL' | 'NO_DATA';
  nearestHvnPrice: number;
  hvnCount: number;
  lvnCount: number;
  liquidityZones: LiquidityZoneSummary[];
  bins: TradeVolumeProfileBin[];
  interpretation: string;
}

export interface TradeVolumeProfileOptions {
  binCount?: number;
  valueAreaPct?: number;
  lookbackBars?: number;
}

/**
 * Computes a Volume-at-Price (Trade Volume Profile) distribution over candle history
 * and optional real-time quote updates to identify POC, Value Area (70%),
 * High-Volume institutional liquidity zones (HVN), and Low-Volume voids (LVN).
 */
export function calculateTradeVolumeProfile(
  candles: Candle[],
  liveQuote?: Pick<Quote, 'mid' | 'volume24h' | 'open24h' | 'high24h' | 'low24h'>,
  options: TradeVolumeProfileOptions = {}
): TradeVolumeProfileResult {
  const binCount = Math.max(8, Math.min(48, Math.round(options.binCount ?? 24)));
  const valueAreaPctTarget = Math.max(50, Math.min(90, options.valueAreaPct ?? 70));
  const lookbackBars = options.lookbackBars && options.lookbackBars > 0 ? options.lookbackBars : candles.length;
  const scopedCandles = Array.isArray(candles)
    ? candles.slice(Math.max(0, candles.length - lookbackBars))
    : [];

  if (scopedCandles.length === 0) {
    return {
      hasData: false,
      barsAnalyzed: 0,
      binCount,
      priceMin: 0,
      priceMax: 0,
      binWidth: 0,
      totalVolume: 0,
      totalBuyVolume: 0,
      totalSellVolume: 0,
      netDeltaPct: 0,
      pocPrice: 0,
      pocVolume: 0,
      pocSharePct: 0,
      vahPrice: 0,
      valPrice: 0,
      valueAreaVolumePct: 0,
      spotPrice: liveQuote?.mid ?? 0,
      spotPosition: 'NO_DATA',
      nearestHvnPrice: 0,
      hvnCount: 0,
      lvnCount: 0,
      liquidityZones: [],
      bins: [],
      interpretation: 'Load market candle history to compute institutional volume-at-price liquidity zones.',
    };
  }

  let rawMin = Infinity;
  let rawMax = -Infinity;
  for (const c of scopedCandles) {
    if (Number.isFinite(c.low) && c.low < rawMin) rawMin = c.low;
    if (Number.isFinite(c.high) && c.high > rawMax) rawMax = c.high;
  }

  const spotPrice =
    liveQuote && Number.isFinite(liveQuote.mid) && liveQuote.mid > 0
      ? liveQuote.mid
      : scopedCandles[scopedCandles.length - 1].close;

  if (Number.isFinite(spotPrice) && spotPrice > 0) {
    rawMin = Math.min(rawMin, spotPrice);
    rawMax = Math.max(rawMax, spotPrice);
  }

  if (!Number.isFinite(rawMin) || !Number.isFinite(rawMax)) {
    rawMin = 0;
    rawMax = 1;
  }

  if (rawMax - rawMin < 1e-6) {
    const pad = Math.max(0.5, Math.abs(rawMin) * 0.005);
    rawMin -= pad;
    rawMax += pad;
  }

  const priceMin = rawMin;
  const priceMax = rawMax;
  const binWidth = (priceMax - priceMin) / binCount;

  const accTotal = new Array<number>(binCount).fill(0);
  const accBuy = new Array<number>(binCount).fill(0);
  const accSell = new Array<number>(binCount).fill(0);

  for (const c of scopedCandles) {
    const barVol = Number.isFinite(c.volume) && c.volume > 0 ? c.volume : 1;
    const barRange = Math.max(0, c.high - c.low);
    // Split volume into buy/sell pressure using close location inside bar range
    const closePositionRatio =
      barRange > 1e-9
        ? Math.max(0.1, Math.min(0.9, (c.close - c.low) / barRange))
        : c.close >= c.open
        ? 0.65
        : 0.35;

    if (barRange <= 1e-9) {
      const idx = Math.max(0, Math.min(binCount - 1, Math.floor((c.close - priceMin) / binWidth)));
      accTotal[idx] += barVol;
      accBuy[idx] += barVol * closePositionRatio;
      accSell[idx] += barVol * (1 - closePositionRatio);
      continue;
    }

    const startIdx = Math.max(0, Math.min(binCount - 1, Math.floor((c.low - priceMin) / binWidth)));
    const endIdx = Math.max(0, Math.min(binCount - 1, Math.floor((c.high - priceMin) / binWidth)));

    let overlapSum = 0;
    const overlaps: number[] = [];
    for (let i = startIdx; i <= endIdx; i++) {
      const bLow = priceMin + i * binWidth;
      const bHigh = bLow + binWidth;
      const overlap = Math.max(0, Math.min(c.high, bHigh) - Math.max(c.low, bLow));
      overlaps.push(overlap);
      overlapSum += overlap;
    }

    const denom = overlapSum > 0 ? overlapSum : endIdx - startIdx + 1;
    for (let offset = 0; offset < overlaps.length; offset++) {
      const idx = startIdx + offset;
      const weight = overlapSum > 0 ? overlaps[offset] / denom : 1 / denom;
      const sliceVol = barVol * weight;
      accTotal[idx] += sliceVol;
      accBuy[idx] += sliceVol * closePositionRatio;
      accSell[idx] += sliceVol * (1 - closePositionRatio);
    }
  }

  // Real-time quote tick injection into current spot price bucket
  const spotBinIndex = Math.max(
    0,
    Math.min(binCount - 1, Math.floor((spotPrice - priceMin) / binWidth))
  );
  if (liveQuote && Number.isFinite(liveQuote.volume24h) && liveQuote.volume24h > 0) {
    const liveTickVol = Math.max(10, Math.round(liveQuote.volume24h * 0.015));
    const liveBuyShare =
      liveQuote.mid > liveQuote.open24h ? 0.68 : liveQuote.mid < liveQuote.open24h ? 0.32 : 0.5;
    accTotal[spotBinIndex] += liveTickVol;
    accBuy[spotBinIndex] += liveTickVol * liveBuyShare;
    accSell[spotBinIndex] += liveTickVol * (1 - liveBuyShare);
  }

  const totalVolume = accTotal.reduce((sum, v) => sum + v, 0);
  const totalBuyVolume = accBuy.reduce((sum, v) => sum + v, 0);
  const totalSellVolume = accSell.reduce((sum, v) => sum + v, 0);
  const netDeltaPct =
    totalVolume > 0 ? Number((((totalBuyVolume - totalSellVolume) / totalVolume) * 100).toFixed(1)) : 0;

  // Identify POC index
  let pocIndex = 0;
  let maxBinVol = -1;
  for (let i = 0; i < binCount; i++) {
    if (accTotal[i] > maxBinVol) {
      maxBinVol = accTotal[i];
      pocIndex = i;
    }
  }

  // Value Area expansion (70% standard Market Profile expansion from POC)
  const inValueAreaFlags = new Array<boolean>(binCount).fill(false);
  inValueAreaFlags[pocIndex] = true;
  let vaVolume = accTotal[pocIndex];
  const vaTargetVol = totalVolume * (valueAreaPctTarget / 100);
  let lowPtr = pocIndex - 1;
  let highPtr = pocIndex + 1;

  while (vaVolume < vaTargetVol && (lowPtr >= 0 || highPtr < binCount)) {
    const upVol =
      (highPtr < binCount ? accTotal[highPtr] : 0) +
      (highPtr + 1 < binCount ? accTotal[highPtr + 1] : 0);
    const downVol =
      (lowPtr >= 0 ? accTotal[lowPtr] : 0) +
      (lowPtr - 1 >= 0 ? accTotal[lowPtr - 1] : 0);

    if (highPtr < binCount && (lowPtr < 0 || upVol >= downVol)) {
      inValueAreaFlags[highPtr] = true;
      vaVolume += accTotal[highPtr];
      highPtr++;
      if (vaVolume < vaTargetVol && highPtr < binCount) {
        inValueAreaFlags[highPtr] = true;
        vaVolume += accTotal[highPtr];
        highPtr++;
      }
    } else if (lowPtr >= 0) {
      inValueAreaFlags[lowPtr] = true;
      vaVolume += accTotal[lowPtr];
      lowPtr--;
      if (vaVolume < vaTargetVol && lowPtr >= 0) {
        inValueAreaFlags[lowPtr] = true;
        vaVolume += accTotal[lowPtr];
        lowPtr--;
      }
    }
  }

  let valIdx = pocIndex;
  let vahIdx = pocIndex;
  for (let i = 0; i < binCount; i++) {
    if (inValueAreaFlags[i]) {
      valIdx = Math.min(valIdx, i);
      vahIdx = Math.max(vahIdx, i);
    }
  }

  const valPrice = Number((priceMin + valIdx * binWidth).toFixed(3));
  const vahPrice = Number((priceMin + (vahIdx + 1) * binWidth).toFixed(3));
  const pocPrice = Number((priceMin + (pocIndex + 0.5) * binWidth).toFixed(3));
  const pocVolume = Number(accTotal[pocIndex].toFixed(2));
  const pocSharePct = totalVolume > 0 ? Number(((pocVolume / totalVolume) * 100).toFixed(1)) : 0;
  const valueAreaVolumePct =
    totalVolume > 0 ? Number(((vaVolume / totalVolume) * 100).toFixed(1)) : 0;

  const meanBinVol = totalVolume / binCount;
  const hvnThreshold = Math.max(pocVolume * 0.62, meanBinVol * 1.35);
  const lvnThreshold = meanBinVol * 0.35;

  const bins: TradeVolumeProfileBin[] = [];
  for (let i = 0; i < binCount; i++) {
    const bLow = priceMin + i * binWidth;
    const bHigh = bLow + binWidth;
    const bMid = (bLow + bHigh) / 2;
    const bVol = accTotal[i];
    const bBuy = accBuy[i];
    const bSell = accSell[i];

    let liquidityNodeType: VolumeLiquidityNodeType = 'NORMAL';
    if (i === pocIndex) {
      liquidityNodeType = 'POC';
    } else if (bVol >= hvnThreshold) {
      liquidityNodeType = 'HVN';
    } else if (bVol <= lvnThreshold) {
      liquidityNodeType = 'LVN';
    }

    bins.push({
      index: i,
      priceLow: Number(bLow.toFixed(3)),
      priceHigh: Number(bHigh.toFixed(3)),
      midPrice: Number(bMid.toFixed(3)),
      totalVolume: Number(bVol.toFixed(2)),
      buyVolume: Number(bBuy.toFixed(2)),
      sellVolume: Number(bSell.toFixed(2)),
      deltaVolume: Number((bBuy - bSell).toFixed(2)),
      sharePct: totalVolume > 0 ? Number(((bVol / totalVolume) * 100).toFixed(1)) : 0,
      inValueArea: inValueAreaFlags[i],
      isPoc: i === pocIndex,
      isCurrentPriceLevel: i === spotBinIndex,
      liquidityNodeType,
    });
  }

  const hvnAndPocBins = bins.filter(
    (b) => b.liquidityNodeType === 'POC' || b.liquidityNodeType === 'HVN'
  );
  const lvnBins = bins.filter((b) => b.liquidityNodeType === 'LVN');

  const liquidityZones: LiquidityZoneSummary[] = [...hvnAndPocBins]
    .sort((a, b) => b.totalVolume - a.totalVolume)
    .slice(0, 5)
    .map((b) => {
      const deltaRatio = b.totalVolume > 0 ? b.deltaVolume / b.totalVolume : 0;
      const netDeltaBias: LiquidityZoneSummary['netDeltaBias'] =
        deltaRatio > 0.08
          ? 'ACCUMULATION'
          : deltaRatio < -0.08
          ? 'DISTRIBUTION'
          : 'BALANCED';
      const distanceFromSpotPct =
        spotPrice > 0 ? Number((((b.midPrice - spotPrice) / spotPrice) * 100).toFixed(2)) : 0;

      return {
        nodeType: b.isPoc ? 'POC' : 'HVN',
        priceLow: b.priceLow,
        priceHigh: b.priceHigh,
        midPrice: b.midPrice,
        totalVolume: b.totalVolume,
        sharePct: b.sharePct,
        netDeltaBias,
        distanceFromSpotPct,
      };
    });

  // Nearest high-volume institutional cluster to current spot price
  let nearestHvnPrice = pocPrice;
  let minDist = Infinity;
  for (const b of hvnAndPocBins) {
    const dist = Math.abs(b.midPrice - spotPrice);
    if (dist < minDist) {
      minDist = dist;
      nearestHvnPrice = b.midPrice;
    }
  }

  const pocTolerance = Math.max(binWidth * 0.75, spotPrice * 0.0025);
  let spotPosition: TradeVolumeProfileResult['spotPosition'] = 'INSIDE_VA';
  if (Math.abs(spotPrice - pocPrice) <= pocTolerance) {
    spotPosition = 'AT_POC';
  } else if (spotPrice > vahPrice) {
    spotPosition = 'ABOVE_VAH';
  } else if (spotPrice < valPrice) {
    spotPosition = 'BELOW_VAL';
  }

  const biasWord = netDeltaPct > 5 ? 'net buyer accumulation' : netDeltaPct < -5 ? 'net seller distribution' : 'balanced two-way flow';
  const positionDescription =
    spotPosition === 'AT_POC'
      ? `Spot is anchored right on the Volume POC ($${pocPrice.toFixed(2)}), indicating peak institutional liquidity acceptance.`
      : spotPosition === 'ABOVE_VAH'
      ? `Spot trades above Value Area High ($${vahPrice.toFixed(2)}) with ${biasWord}; VAH acts as primary retest support.`
      : spotPosition === 'BELOW_VAL'
      ? `Spot trades below Value Area Low ($${valPrice.toFixed(2)}) with ${biasWord}; VAL acts as overhead supply resistance.`
      : `Spot is rotating inside the 70% Value Area ($${valPrice.toFixed(2)}–$${vahPrice.toFixed(2)}) near HVN liquidity at $${nearestHvnPrice.toFixed(2)}.`;

  return {
    hasData: true,
    barsAnalyzed: scopedCandles.length,
    binCount,
    priceMin: Number(priceMin.toFixed(3)),
    priceMax: Number(priceMax.toFixed(3)),
    binWidth: Number(binWidth.toFixed(3)),
    totalVolume: Number(totalVolume.toFixed(2)),
    totalBuyVolume: Number(totalBuyVolume.toFixed(2)),
    totalSellVolume: Number(totalSellVolume.toFixed(2)),
    netDeltaPct,
    pocPrice,
    pocVolume,
    pocSharePct,
    vahPrice,
    valPrice,
    valueAreaVolumePct,
    spotPrice: Number(spotPrice.toFixed(3)),
    spotPosition,
    nearestHvnPrice,
    hvnCount: hvnAndPocBins.length,
    lvnCount: lvnBins.length,
    liquidityZones,
    bins,
    interpretation: positionDescription,
  };
}

export type SmartLiquidityZoneRole = 'POC_ANCHOR' | 'DEMAND_LIQUIDITY' | 'SUPPLY_LIQUIDITY';

export interface SmartLiquidityZoneAnnotation {
  id: string;
  nodeType: 'POC' | 'HVN';
  zoneRole: SmartLiquidityZoneRole;
  priceLow: number;
  priceHigh: number;
  midPrice: number;
  sharePct: number;
  netDeltaBias: 'ACCUMULATION' | 'DISTRIBUTION' | 'BALANCED';
  distanceFromSpotPct: number;
  label: string;
}

export interface SmartPivotLevelAnnotation {
  id: 'R2' | 'R1' | 'P' | 'S1' | 'S2';
  role: 'RESISTANCE' | 'PIVOT' | 'SUPPORT';
  price: number;
  label: string;
}

export interface SmartSwingPivotAnnotation {
  id: string;
  barIndex: number;
  timestamp: number;
  timeStr: string;
  price: number;
  type: 'SWING_HIGH' | 'SWING_LOW';
  role: 'RESISTANCE' | 'SUPPORT';
  tag: 'R-Pivot' | 'S-Pivot';
  prominencePct: number;
}

export interface SmartChartAnnotationsOptions {
  maxLiquidityZones?: number;
  swingWindow?: number;
  maxSwingPivots?: number;
  lookbackBars?: number;
  liveQuote?: Pick<Quote, 'mid' | 'volume24h' | 'open24h' | 'high24h' | 'low24h'>;
  supportResistanceOverride?: {
    pivot: number;
    resistance1: number;
    resistance2: number;
    support1: number;
    support2: number;
  } | null;
}

export interface SmartChartAnnotationsResult {
  hasData: boolean;
  pocPrice: number;
  vahPrice: number;
  valPrice: number;
  spotPrice: number;
  liquidityZones: SmartLiquidityZoneAnnotation[];
  pivotLevels: SmartPivotLevelAnnotation[];
  swingPivots: SmartSwingPivotAnnotation[];
  summary: string;
}

/**
 * Automatically identifies institutional volume-at-price liquidity zones (VPOC & HVN pools),
 * horizontal support/resistance pivot levels (R2, R1, P, S1, S2), and structural swing-high/low
 * pivot markers across candle history for direct chart annotation.
 */
export function computeSmartChartAnnotations(
  candles: Candle[],
  options: SmartChartAnnotationsOptions = {}
): SmartChartAnnotationsResult {
  if (!Array.isArray(candles) || candles.length === 0) {
    return {
      hasData: false,
      pocPrice: 0,
      vahPrice: 0,
      valPrice: 0,
      spotPrice: options.liveQuote?.mid ?? 0,
      liquidityZones: [],
      pivotLevels: [],
      swingPivots: [],
      summary: 'Load price history to activate Smart Annotation liquidity zones and S/R pivots.',
    };
  }

  const maxZones = Math.max(1, Math.min(6, Math.round(options.maxLiquidityZones ?? 4)));
  const maxSwingPivots = Math.max(2, Math.min(16, Math.round(options.maxSwingPivots ?? 8)));
  const requestedLookback =
    options.lookbackBars && options.lookbackBars > 0
      ? Math.min(candles.length, options.lookbackBars)
      : Math.min(candles.length, 180);

  // 1. Institutional Liquidity Zones (VPOC + top non-overlapping HVN clusters)
  const volumeProfile = calculateTradeVolumeProfile(candles, options.liveQuote, {
    binCount: 24,
    valueAreaPct: 70,
    lookbackBars: requestedLookback,
  });

  const spotPrice =
    volumeProfile.spotPrice > 0
      ? volumeProfile.spotPrice
      : candles[candles.length - 1].close;
  const priceSpan = Math.max(1e-6, volumeProfile.priceMax - volumeProfile.priceMin);
  const minZoneSeparation = priceSpan * 0.055;

  const selectedZones: SmartLiquidityZoneAnnotation[] = [];
  const rawZones = [...volumeProfile.liquidityZones].sort((a, b) => {
    if (a.nodeType === 'POC' && b.nodeType !== 'POC') return -1;
    if (b.nodeType === 'POC' && a.nodeType !== 'POC') return 1;
    return b.totalVolume - a.totalVolume;
  });

  for (const z of rawZones) {
    if (selectedZones.length >= maxZones) break;
    const isTooClose = selectedZones.some(
      (existing) => Math.abs(existing.midPrice - z.midPrice) < minZoneSeparation && z.nodeType !== 'POC'
    );
    if (isTooClose) continue;

    let zoneRole: SmartLiquidityZoneRole = 'DEMAND_LIQUIDITY';
    if (z.nodeType === 'POC') {
      zoneRole = 'POC_ANCHOR';
    } else if (z.midPrice > spotPrice * 1.0015 || z.netDeltaBias === 'DISTRIBUTION') {
      zoneRole = 'SUPPLY_LIQUIDITY';
    } else {
      zoneRole = 'DEMAND_LIQUIDITY';
    }

    const biasTag =
      z.netDeltaBias === 'ACCUMULATION'
        ? 'Accum'
        : z.netDeltaBias === 'DISTRIBUTION'
        ? 'Distrib'
        : 'Balanced';

    const labelPrefix =
      zoneRole === 'POC_ANCHOR'
        ? 'VPOC Liquidity'
        : zoneRole === 'SUPPLY_LIQUIDITY'
        ? 'Supply Zone'
        : 'Demand Zone';

    selectedZones.push({
      id: `${z.nodeType}-${selectedZones.length + 1}`,
      nodeType: z.nodeType === 'POC' ? 'POC' : 'HVN',
      zoneRole,
      priceLow: z.priceLow,
      priceHigh: z.priceHigh,
      midPrice: z.midPrice,
      sharePct: z.sharePct,
      netDeltaBias: z.netDeltaBias,
      distanceFromSpotPct: z.distanceFromSpotPct,
      label: `${labelPrefix} · ${z.sharePct.toFixed(1)}% Vol · ${biasTag}`,
    });
  }

  // 2. Classic Horizontal Support & Resistance Pivots (R2, R1, P, S1, S2)
  const sr =
    options.supportResistanceOverride &&
    Number.isFinite(options.supportResistanceOverride.pivot) &&
    options.supportResistanceOverride.pivot > 0
      ? options.supportResistanceOverride
      : calculatePivots(candles);

  const rawPivotLevels: SmartPivotLevelAnnotation[] = [
    { id: 'R2', role: 'RESISTANCE', price: sr.resistance2, label: `R2 $${sr.resistance2.toFixed(2)}` },
    { id: 'R1', role: 'RESISTANCE', price: sr.resistance1, label: `R1 $${sr.resistance1.toFixed(2)}` },
    { id: 'P', role: 'PIVOT', price: sr.pivot, label: `P $${sr.pivot.toFixed(2)}` },
    { id: 'S1', role: 'SUPPORT', price: sr.support1, label: `S1 $${sr.support1.toFixed(2)}` },
    { id: 'S2', role: 'SUPPORT', price: sr.support2, label: `S2 $${sr.support2.toFixed(2)}` },
  ];
  const pivotLevels: SmartPivotLevelAnnotation[] = rawPivotLevels.filter(
    (lvl) => Number.isFinite(lvl.price) && lvl.price > 0
  );

  // 3. Structural Swing High & Swing Low Pivots across candle history
  const swingPivots: SmartSwingPivotAnnotation[] = [];
  if (candles.length >= 5) {
    const rawWindow = Math.round(options.swingWindow ?? 3);
    const w = Math.max(1, Math.min(rawWindow, Math.floor((candles.length - 1) / 4)));
    const avgVol =
      candles.reduce((s, c) => s + (Number.isFinite(c.volume) ? c.volume : 1), 0) /
      candles.length;

    interface ScoredSwing extends SmartSwingPivotAnnotation {
      score: number;
    }
    const candidates: ScoredSwing[] = [];

    for (let i = w; i < candles.length - w; i++) {
      const cur = candles[i];
      let isSwingHigh = true;
      let isSwingLow = true;
      let neighborHighSum = 0;
      let neighborLowSum = 0;
      let neighborCount = 0;

      for (let j = i - w; j <= i + w; j++) {
        if (j === i) continue;
        neighborCount++;
        neighborHighSum += candles[j].high;
        neighborLowSum += candles[j].low;
        if (candles[j].high > cur.high || (j < i && candles[j].high >= cur.high)) {
          isSwingHigh = false;
        }
        if (candles[j].low < cur.low || (j < i && candles[j].low <= cur.low)) {
          isSwingLow = false;
        }
      }

      const volBoost = avgVol > 0 ? Math.min(1.6, Math.max(0.7, (cur.volume || avgVol) / avgVol)) : 1;
      const recencyBoost = 0.75 + 0.5 * (i / Math.max(1, candles.length - 1));

      if (isSwingHigh && neighborCount > 0) {
        const meanHigh = neighborHighSum / neighborCount;
        const prominencePct = meanHigh > 0 ? ((cur.high - meanHigh) / meanHigh) * 100 : 0;
        if (prominencePct > 0) {
          candidates.push({
            id: `SH-${i}`,
            barIndex: i,
            timestamp: cur.timestamp,
            timeStr: cur.timeStr,
            price: Number(cur.high.toFixed(2)),
            type: 'SWING_HIGH',
            role: 'RESISTANCE',
            tag: 'R-Pivot',
            prominencePct: Number(prominencePct.toFixed(2)),
            score: prominencePct * volBoost * recencyBoost,
          });
        }
      }

      if (isSwingLow && neighborCount > 0) {
        const meanLow = neighborLowSum / neighborCount;
        const prominencePct = meanLow > 0 ? ((meanLow - cur.low) / meanLow) * 100 : 0;
        if (prominencePct > 0) {
          candidates.push({
            id: `SL-${i}`,
            barIndex: i,
            timestamp: cur.timestamp,
            timeStr: cur.timeStr,
            price: Number(cur.low.toFixed(2)),
            type: 'SWING_LOW',
            role: 'SUPPORT',
            tag: 'S-Pivot',
            prominencePct: Number(prominencePct.toFixed(2)),
            score: prominencePct * volBoost * recencyBoost,
          });
        }
      }
    }

    const picked: ScoredSwing[] = [];
    const sortedByScore = [...candidates].sort((a, b) => b.score - a.score);
    const minBarGap = Math.max(2, w + 1);

    for (const cand of sortedByScore) {
      if (picked.length >= maxSwingPivots) break;
      const tooClose = picked.some(
        (p) => p.type === cand.type && Math.abs(p.barIndex - cand.barIndex) < minBarGap
      );
      if (tooClose) continue;
      picked.push(cand);
    }

    picked.sort((a, b) => a.barIndex - b.barIndex);
    for (const p of picked) {
      const { score: _drop, ...clean } = p;
      swingPivots.push(clean);
    }
  }

  return {
    hasData: selectedZones.length > 0 || pivotLevels.length > 0 || swingPivots.length > 0,
    pocPrice: volumeProfile.pocPrice,
    vahPrice: volumeProfile.vahPrice,
    valPrice: volumeProfile.valPrice,
    spotPrice: Number(spotPrice.toFixed(2)),
    liquidityZones: selectedZones,
    pivotLevels,
    swingPivots,
    summary: `Identified ${selectedZones.length} institutional liquidity zones (VPOC $${volumeProfile.pocPrice.toFixed(2)}), ${pivotLevels.length} S/R pivot levels (P $${sr.pivot.toFixed(2)}), and ${swingPivots.length} structural swing pivots.`,
  };
}

export type LiquiditySweepDirection = 'BEARISH_SWEEP' | 'BULLISH_SWEEP';

export interface LiquiditySweepMarker {
  id: string;
  barIndex: number;
  timestamp: number;
  timeStr: string;
  direction: LiquiditySweepDirection;
  sweptSwingBarIndex: number;
  sweptSwingPrice: number;
  sweepExtremePrice: number;
  bodyHigh: number;
  bodyLow: number;
  wickDepth: number;
  rejectionWickPct: number;
  reversalConfirmed: boolean;
  label: string;
  rationale: string;
}

export interface LiquiditySweepDetectionOptions {
  swingWindow?: number;
  maxSwingAgeBars?: number;
  minRejectionWickRatio?: number;
  maxSweeps?: number;
}

export interface LiquiditySweepAnalysisResult {
  hasData: boolean;
  barsAnalyzed: number;
  totalSweeps: number;
  bullishSweepCount: number;
  bearishSweepCount: number;
  confirmedReversalCount: number;
  avgRejectionWickPct: number;
  sweeps: LiquiditySweepMarker[];
  summary: string;
}

/**
 * Detects wick-only liquidity sweeps ("stop-hunting") where price pierces a prior unbroken
 * structural swing high or swing low solely via candle wick while the candle body closes back
 * inside the prior level, signaling retail stop absorption ahead of a potential reversal.
 */
export function detectLiquiditySweeps(
  candles: Candle[],
  options: LiquiditySweepDetectionOptions = {}
): LiquiditySweepAnalysisResult {
  if (!Array.isArray(candles) || candles.length < 7) {
    return {
      hasData: false,
      barsAnalyzed: candles?.length || 0,
      totalSweeps: 0,
      bullishSweepCount: 0,
      bearishSweepCount: 0,
      confirmedReversalCount: 0,
      avgRejectionWickPct: 0,
      sweeps: [],
      summary: 'Need at least 7 candles to identify structural swing highs/lows and wick-only liquidity sweeps.',
    };
  }

  const w = Math.max(2, Math.min(5, Math.round(options.swingWindow ?? 2)));
  const maxSwingAge = Math.max(12, Math.round(options.maxSwingAgeBars ?? 60));
  const minWickRatio = Math.max(0.15, Math.min(0.8, options.minRejectionWickRatio ?? 0.25));
  const maxSweeps = Math.max(1, Math.min(30, Math.round(options.maxSweeps ?? 14)));

  interface SwingAnchor {
    barIndex: number;
    price: number;
    type: 'HIGH' | 'LOW';
    bodyBrokenBeforeSweep: boolean;
    alreadySwept: boolean;
  }

  // 1. Identify confirmed structural swing highs and swing lows across history
  const swingAnchors: SwingAnchor[] = [];
  for (let i = w; i < candles.length - w; i++) {
    const cur = candles[i];
    let isHigh = true;
    let isLow = true;

    for (let j = i - w; j <= i + w; j++) {
      if (j === i) continue;
      if (candles[j].high > cur.high || (j < i && candles[j].high >= cur.high)) {
        isHigh = false;
      }
      if (candles[j].low < cur.low || (j < i && candles[j].low <= cur.low)) {
        isLow = false;
      }
    }

    if (isHigh) {
      swingAnchors.push({
        barIndex: i,
        price: cur.high,
        type: 'HIGH',
        bodyBrokenBeforeSweep: false,
        alreadySwept: false,
      });
    }
    if (isLow) {
      swingAnchors.push({
        barIndex: i,
        price: cur.low,
        type: 'LOW',
        bodyBrokenBeforeSweep: false,
        alreadySwept: false,
      });
    }
  }

  interface CandidateSweep extends LiquiditySweepMarker {
    score: number;
  }
  const candidates: CandidateSweep[] = [];

  // 2. Scan forward chronologically for wick-only breaks of unbroken prior swings
  for (let i = w * 2 + 1; i < candles.length; i++) {
    const bar = candles[i];
    const bodyTop = Math.max(bar.open, bar.close);
    const bodyBot = Math.min(bar.open, bar.close);
    const barRange = Math.max(0, bar.high - bar.low);
    if (barRange <= 1e-6) continue;

    // Evaluate eligible prior swing highs for BEARISH_SWEEP (buy-stop hunt above swing high)
    let bestHighMatch: SwingAnchor | null = null;
    for (const s of swingAnchors) {
      if (s.type !== 'HIGH') continue;
      // Swing must be confirmed strictly before current bar (i > s.barIndex + w) and within max age
      if (s.barIndex + w >= i) continue;
      if (i - s.barIndex > maxSwingAge || s.bodyBrokenBeforeSweep || s.alreadySwept) continue;

      if (bar.high > s.price && bodyTop <= s.price) {
        if (!bestHighMatch || s.price > bestHighMatch.price) {
          bestHighMatch = s;
        }
      }
    }

    if (bestHighMatch) {
      const upperWick = bar.high - bodyTop;
      const rejectionRatio = upperWick / barRange;
      if (rejectionRatio >= minWickRatio) {
        const wickDepth = Number((bar.high - bestHighMatch.price).toFixed(2));
        const rejectionWickPct = Number((rejectionRatio * 100).toFixed(1));
        const next1 = candles[i + 1];
        const next2 = candles[i + 2];
        const closesWeak = bar.close <= bar.open || bar.close < (bar.high + bar.low) / 2;
        const followThrough =
          (next1 && next1.close < bar.close) ||
          (next2 && next2.close < bestHighMatch.price);
        const reversalConfirmed = Boolean(closesWeak || followThrough);

        candidates.push({
          id: `SWP-H-${i}`,
          barIndex: i,
          timestamp: bar.timestamp,
          timeStr: bar.timeStr,
          direction: 'BEARISH_SWEEP',
          sweptSwingBarIndex: bestHighMatch.barIndex,
          sweptSwingPrice: Number(bestHighMatch.price.toFixed(2)),
          sweepExtremePrice: Number(bar.high.toFixed(2)),
          bodyHigh: Number(bodyTop.toFixed(2)),
          bodyLow: Number(bodyBot.toFixed(2)),
          wickDepth,
          rejectionWickPct,
          reversalConfirmed,
          label: `Sweep High · -$${wickDepth.toFixed(2)} wick`,
          rationale: `Wick pierced prior swing high $${bestHighMatch.price.toFixed(2)} by +$${wickDepth.toFixed(2)} (${rejectionWickPct}% upper wick rejection) while candle body closed inside ($${bar.close.toFixed(2)}), flagging buy-stop absorption.`,
          score: rejectionRatio * 100 + (reversalConfirmed ? 25 : 0) + (wickDepth / barRange) * 20,
        });
        bestHighMatch.alreadySwept = true;
      }
    }

    // Evaluate eligible prior swing lows for BULLISH_SWEEP (sell-stop hunt below swing low)
    let bestLowMatch: SwingAnchor | null = null;
    for (const s of swingAnchors) {
      if (s.type !== 'LOW') continue;
      if (s.barIndex + w >= i) continue;
      if (i - s.barIndex > maxSwingAge || s.bodyBrokenBeforeSweep || s.alreadySwept) continue;

      if (bar.low < s.price && bodyBot >= s.price) {
        if (!bestLowMatch || s.price < bestLowMatch.price) {
          bestLowMatch = s;
        }
      }
    }

    if (bestLowMatch) {
      const lowerWick = bodyBot - bar.low;
      const rejectionRatio = lowerWick / barRange;
      if (rejectionRatio >= minWickRatio) {
        const wickDepth = Number((bestLowMatch.price - bar.low).toFixed(2));
        const rejectionWickPct = Number((rejectionRatio * 100).toFixed(1));
        const next1 = candles[i + 1];
        const next2 = candles[i + 2];
        const closesStrong = bar.close >= bar.open || bar.close > (bar.high + bar.low) / 2;
        const followThrough =
          (next1 && next1.close > bar.close) ||
          (next2 && next2.close > bestLowMatch.price);
        const reversalConfirmed = Boolean(closesStrong || followThrough);

        candidates.push({
          id: `SWP-L-${i}`,
          barIndex: i,
          timestamp: bar.timestamp,
          timeStr: bar.timeStr,
          direction: 'BULLISH_SWEEP',
          sweptSwingBarIndex: bestLowMatch.barIndex,
          sweptSwingPrice: Number(bestLowMatch.price.toFixed(2)),
          sweepExtremePrice: Number(bar.low.toFixed(2)),
          bodyHigh: Number(bodyTop.toFixed(2)),
          bodyLow: Number(bodyBot.toFixed(2)),
          wickDepth,
          rejectionWickPct,
          reversalConfirmed,
          label: `Sweep Low · +$${wickDepth.toFixed(2)} wick`,
          rationale: `Wick pierced prior swing low $${bestLowMatch.price.toFixed(2)} by -$${wickDepth.toFixed(2)} (${rejectionWickPct}% lower wick rejection) while candle body closed above ($${bar.close.toFixed(2)}), flagging sell-stop absorption.`,
          score: rejectionRatio * 100 + (reversalConfirmed ? 25 : 0) + (wickDepth / barRange) * 20,
        });
        bestLowMatch.alreadySwept = true;
      }
    }

    // Invalidate any prior swing level once a candle body cleanly breaks & closes beyond it
    for (const s of swingAnchors) {
      if (s.barIndex >= i || s.bodyBrokenBeforeSweep) continue;
      if (s.type === 'HIGH' && bodyTop > s.price) {
        s.bodyBrokenBeforeSweep = true;
      } else if (s.type === 'LOW' && bodyBot < s.price) {
        s.bodyBrokenBeforeSweep = true;
      }
    }
  }

  // Keep highest-conviction sweeps up to maxSweeps, sorted chronologically
  const ranked = [...candidates].sort((a, b) => b.score - a.score).slice(0, maxSweeps);
  ranked.sort((a, b) => a.barIndex - b.barIndex);
  const sweeps: LiquiditySweepMarker[] = ranked.map(({ score: _drop, ...clean }) => clean);

  const bullishSweepCount = sweeps.filter((s) => s.direction === 'BULLISH_SWEEP').length;
  const bearishSweepCount = sweeps.filter((s) => s.direction === 'BEARISH_SWEEP').length;
  const confirmedReversalCount = sweeps.filter((s) => s.reversalConfirmed).length;
  const avgRejectionWickPct =
    sweeps.length > 0
      ? Number(
          (sweeps.reduce((sum, s) => sum + s.rejectionWickPct, 0) / sweeps.length).toFixed(1)
        )
      : 0;

  return {
    hasData: sweeps.length > 0,
    barsAnalyzed: candles.length,
    totalSweeps: sweeps.length,
    bullishSweepCount,
    bearishSweepCount,
    confirmedReversalCount,
    avgRejectionWickPct,
    sweeps,
    summary:
      sweeps.length > 0
        ? `Detected ${sweeps.length} wick-only liquidity sweeps (${bullishSweepCount} bullish sell-stop hunts, ${bearishSweepCount} bearish buy-stop hunts; ${confirmedReversalCount} reversal-confirmed).`
        : 'No wick-only swing liquidity sweeps detected in the active window.',
  };
}

export type RsiConditionOperator = 'CROSS_ABOVE' | 'CROSS_BELOW' | 'ABOVE' | 'BELOW';

export interface CustomRsiAlertConfig {
  id: string;
  name: string;
  period: number;
  operator: RsiConditionOperator;
  threshold: number;
  timeframe: Timeframe;
  isActive: boolean;
  createdAt: string;
  lastTriggered?: string;
}

export interface RsiRuleEvaluation {
  ruleId: string;
  ruleName: string;
  period: number;
  operator: RsiConditionOperator;
  threshold: number;
  currentRsi: number;
  previousRsi: number;
  isTriggered: boolean;
  crossedOnLatestBar: boolean;
  distanceToThreshold: number;
  severity: 'INFO' | 'WARNING' | 'CRITICAL';
  summary: string;
}

export interface RsiAlertEvaluationResult {
  hasData: boolean;
  barsEvaluated: number;
  timeframe: Timeframe;
  primaryPeriod: number;
  currentRsi: number;
  previousRsi: number;
  rsiDelta: number;
  latestClose: number;
  zoneLabel: 'OVERBOUGHT' | 'OVERSOLD' | 'BULLISH_MOMENTUM' | 'BEARISH_MOMENTUM' | 'NEUTRAL';
  ruleEvaluations: RsiRuleEvaluation[];
  triggeredRules: RsiRuleEvaluation[];
  summary: string;
}

export function classifyRsiZone(
  rsi: number
): 'OVERBOUGHT' | 'OVERSOLD' | 'BULLISH_MOMENTUM' | 'BEARISH_MOMENTUM' | 'NEUTRAL' {
  if (rsi >= 70) return 'OVERBOUGHT';
  if (rsi <= 30) return 'OVERSOLD';
  if (rsi >= 55) return 'BULLISH_MOMENTUM';
  if (rsi <= 45) return 'BEARISH_MOMENTUM';
  return 'NEUTRAL';
}

export function evaluateCustomRsiAlerts(
  candles: Candle[],
  rules: CustomRsiAlertConfig[],
  timeframe: Timeframe = '1D',
  options?: {
    primaryPeriod?: number;
    overrideRsiPair?: { previousRsi: number; currentRsi: number };
  }
): RsiAlertEvaluationResult {
  const primaryPeriod = Math.max(2, Math.min(50, Math.round(options?.primaryPeriod ?? 14)));
  const validCandles = Array.isArray(candles)
    ? candles.filter((c) => Number.isFinite(c?.close) && c.close > 0)
    : [];
  const closes = validCandles.map((c) => c.close);
  const latestClose = closes.length > 0 ? closes[closes.length - 1] : 0;

  const rsiCache = new Map<number, { prev: number; curr: number; hasEnoughBars: boolean }>();
  const getRsiPair = (periodInput: number) => {
    const safePeriod = Math.max(2, Math.min(50, Math.round(periodInput || 14)));
    if (options?.overrideRsiPair) {
      return {
        prev: Number(Math.max(0, Math.min(100, options.overrideRsiPair.previousRsi)).toFixed(2)),
        curr: Number(Math.max(0, Math.min(100, options.overrideRsiPair.currentRsi)).toFixed(2)),
        hasEnoughBars: true,
      };
    }
    const cached = rsiCache.get(safePeriod);
    if (cached) return cached;

    if (closes.length <= safePeriod + 1) {
      const fallback = { prev: 50, curr: 50, hasEnoughBars: false };
      rsiCache.set(safePeriod, fallback);
      return fallback;
    }

    const rsiSeries = calculateRSI(closes, safePeriod);
    const curr = Number((rsiSeries[rsiSeries.length - 1] ?? 50).toFixed(2));
    const prev = Number((rsiSeries[rsiSeries.length - 2] ?? curr).toFixed(2));
    const entry = { prev, curr, hasEnoughBars: true };
    rsiCache.set(safePeriod, entry);
    return entry;
  };

  const primaryPair = getRsiPair(primaryPeriod);
  const hasData = Boolean(options?.overrideRsiPair) || primaryPair.hasEnoughBars;
  const rsiDelta = Number((primaryPair.curr - primaryPair.prev).toFixed(2));
  const zoneLabel = classifyRsiZone(primaryPair.curr);

  const operatorPhrase: Record<RsiConditionOperator, string> = {
    CROSS_ABOVE: 'crossed above',
    CROSS_BELOW: 'crossed below',
    ABOVE: 'is above',
    BELOW: 'is below',
  };

  const ruleEvaluations: RsiRuleEvaluation[] = (Array.isArray(rules) ? rules : []).map((rule) => {
    const safePeriod = Math.max(2, Math.min(50, Math.round(rule.period || 14)));
    const safeThreshold = Math.max(1, Math.min(99, Number(rule.threshold)));
    const { prev, curr, hasEnoughBars } = getRsiPair(safePeriod);

    let crossedOnLatestBar = false;
    let conditionMet = false;

    if (hasEnoughBars) {
      if (rule.operator === 'CROSS_ABOVE') {
        crossedOnLatestBar = prev <= safeThreshold && curr > safeThreshold;
        conditionMet = crossedOnLatestBar;
      } else if (rule.operator === 'CROSS_BELOW') {
        crossedOnLatestBar = prev >= safeThreshold && curr < safeThreshold;
        conditionMet = crossedOnLatestBar;
      } else if (rule.operator === 'ABOVE') {
        crossedOnLatestBar = prev <= safeThreshold && curr > safeThreshold;
        conditionMet = curr > safeThreshold;
      } else if (rule.operator === 'BELOW') {
        crossedOnLatestBar = prev >= safeThreshold && curr < safeThreshold;
        conditionMet = curr < safeThreshold;
      }
    }

    const isTriggered = Boolean(rule.isActive && conditionMet);
    const distanceToThreshold = Number((curr - safeThreshold).toFixed(2));
    const isExtremeZone =
      (rule.operator === 'CROSS_ABOVE' || rule.operator === 'ABOVE') && safeThreshold >= 75
        ? true
        : (rule.operator === 'CROSS_BELOW' || rule.operator === 'BELOW') && safeThreshold <= 25;

    const severity: 'INFO' | 'WARNING' | 'CRITICAL' = isTriggered
      ? isExtremeZone
        ? 'CRITICAL'
        : 'WARNING'
      : 'INFO';

    const summary = isTriggered
      ? `XAU/USD (${timeframe}) RSI(${safePeriod}) ${operatorPhrase[rule.operator]} ${safeThreshold.toFixed(1)} (prev ${prev.toFixed(1)} → now ${curr.toFixed(1)}).`
      : `RSI(${safePeriod}) at ${curr.toFixed(1)} (${Math.abs(distanceToThreshold).toFixed(1)} pts ${distanceToThreshold >= 0 ? 'above' : 'below'} ${safeThreshold.toFixed(1)} target).`;

    return {
      ruleId: rule.id,
      ruleName: rule.name,
      period: safePeriod,
      operator: rule.operator,
      threshold: safeThreshold,
      currentRsi: curr,
      previousRsi: prev,
      isTriggered,
      crossedOnLatestBar,
      distanceToThreshold,
      severity,
      summary,
    };
  });

  const triggeredRules = ruleEvaluations.filter((r) => r.isTriggered);

  return {
    hasData,
    barsEvaluated: validCandles.length,
    timeframe,
    primaryPeriod,
    currentRsi: primaryPair.curr,
    previousRsi: primaryPair.prev,
    rsiDelta,
    latestClose: Number(latestClose.toFixed(2)),
    zoneLabel,
    ruleEvaluations,
    triggeredRules,
    summary: hasData
      ? `XAU/USD (${timeframe}) RSI(${primaryPeriod}) = ${primaryPair.curr.toFixed(2)} (prev ${primaryPair.prev.toFixed(2)}, ${rsiDelta >= 0 ? '+' : ''}${rsiDelta.toFixed(2)}) · ${zoneLabel.replace(/_/g, ' ')}.`
      : `Need at least ${primaryPeriod + 2} XAU/USD candles on ${timeframe} to compute RSI(${primaryPeriod}).`,
  };
}


