/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * Aurum Intelligence — Canonical Indicator Engine
 * Pure mathematical functions for indicators, chart patterns, and pivots.
 */

import { Candle, IndicatorSnapshot } from '../domain/types';

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
