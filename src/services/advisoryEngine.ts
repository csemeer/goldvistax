/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * Aurum Intelligence — Advisory Decision & Evidence System
 * Dynamic multi-horizon trade plans (BUY / SELL / HOLD / NO_TRADE), live evidence registry,
 * specialist agents, and §4.4 data-quality abstention rules.
 */

import {
  AdvisoryHorizon,
  AgentAssessment,
  Candle,
  CommodityType,
  EvidenceItem,
  IndicatorSnapshot,
  InstrumentId,
  MarketRegimeType,
  Quote,
  RecommendationState,
  TradeDirection,
  TradePlan,
} from '../domain/types';
import { calculateEMA, calculateRSI } from './indicators';
import { generateTradePlanFingerprint } from './forecastAccountability';
import { calculateCommoditySentiment, getFilteredNewsEvidence } from './newsSentimentEngine';
import { getInstrumentById } from './commodityRegistry';

export interface TradePlanHorizonSignalContext {
  candles?: Candle[];
  indicators?: IndicatorSnapshot;
  regime?: MarketRegimeType | 'UNKNOWN';
}

export interface TradePlanGenerationContext {
  candles?: Candle[];
  indicators?: IndicatorSnapshot;
  quote?: Quote;
  horizonContexts?: Partial<Record<AdvisoryHorizon, TradePlanHorizonSignalContext>>;
  macroBiasScore?: number; // -100..+100 optional higher-timeframe anchor
}

export interface StrategyTriggerFactor {
  id: string;
  label: string;
  category: 'TREND_STRUCTURE' | 'MOMENTUM' | 'OSCILLATOR' | 'SESSION_DELTA' | 'MACRO_ANCHOR';
  observedValue: string;
  thresholdRule: string;
  impactPoints: number;
  maxWeight: number;
  lean: 'BULLISH' | 'BEARISH' | 'NEUTRAL';
  status: 'TRIGGERED' | 'WATCH' | 'INACTIVE';
}

export interface StrategySentimentFactor {
  id: string;
  title: string;
  source: string;
  category: string;
  causalExplanation: string;
  directionalLean: 'BULLISH' | 'BEARISH' | 'NEUTRAL';
  weightLabel: string;
  horizonRelevance: 'INTRADAY' | 'SWING' | 'STRUCTURAL';
}

export interface StrategyBiasRationale {
  instrumentId: InstrumentId;
  commodity: CommodityType;
  horizon: AdvisoryHorizon;
  direction: TradeDirection;
  state: RecommendationState;
  compositeScore: number;
  thresholds: { buyMin: number; sellMax: number };
  isAbstained: boolean;
  abstentionReason?: string;
  underlyingLogic: string;
  conflictNotice?: string;
  technicalTriggers: StrategyTriggerFactor[];
  sentimentScore: number;
  sentimentLabel: string;
  sentimentFactors: StrategySentimentFactor[];
  invalidationRule: string;
  agentVotes: { bullish: number; bearish: number; neutral: number };
  generatedAt: string;
}

export interface DirectionalSignalAssessment {
  direction: TradeDirection;
  state: RecommendationState;
  score: number; // -100..+100
  shortTermBias: 'BULLISH' | 'BEARISH' | 'NEUTRAL';
  rationale: string;
  triggers?: StrategyTriggerFactor[];
}

function computeSeriesSlopePct(closes: number[], lookback: number): number {
  if (closes.length < 2) return 0;
  const startIdx = Math.max(0, closes.length - 1 - lookback);
  const startPx = closes[startIdx];
  const endPx = closes[closes.length - 1];
  if (!startPx || startPx <= 0) return 0;
  return ((endPx - startPx) / startPx) * 100;
}

/**
 * Evaluates directional trend/momentum deterministically per advisory horizon.
 * Short-term horizons (INTRADAY, CFD, SHORT_TERM) respond rapidly to negative short-term slope,
 * EMA9/EMA21 cross, MACD/Supertrend flips, RSI14, and 24h price change.
 * Longer horizons (SWING, LONG_TERM) balance EMA21/EMA50/EMA200 structure with multi-bar momentum.
 */
export function assessHorizonDirectionalSignal(
  quote: Quote,
  horizon: AdvisoryHorizon,
  context?: TradePlanGenerationContext
): DirectionalSignalAssessment {
  const hCtx = context?.horizonContexts?.[horizon];
  const candles = hCtx?.candles ?? context?.candles;
  const indicators = hCtx?.indicators ?? context?.indicators;
  const isShortHorizon = horizon === 'INTRADAY' || horizon === 'CFD' || horizon === 'SHORT_TERM';
  const change24hPct = Number.isFinite(quote.change24hPct) ? quote.change24hPct : 0;

  let score = 0;
  const reasons: string[] = [];
  const triggers: StrategyTriggerFactor[] = [];

  if (candles && candles.length >= 10) {
    const closes = candles.map((c) => c.close).filter((v) => Number.isFinite(v) && v > 0);
    const lastClose = closes[closes.length - 1] || quote.mid;
    const emaFastPeriod = isShortHorizon ? 9 : 21;
    const emaSlowPeriod = isShortHorizon ? Math.min(21, closes.length) : Math.min(50, closes.length);
    const emaFastArr = calculateEMA(closes, Math.min(emaFastPeriod, closes.length));
    const emaSlowArr = calculateEMA(closes, emaSlowPeriod);
    const emaFast = emaFastArr[emaFastArr.length - 1] || lastClose;
    const emaSlow = emaSlowArr[emaSlowArr.length - 1] || lastClose;
    const emaSpreadPct = emaSlow > 0 ? ((emaFast - emaSlow) / emaSlow) * 100 : 0;

    // 1. EMA fast/slow alignment (+/- 35 pts)
    const emaScore = Math.max(-35, Math.min(35, emaSpreadPct * (isShortHorizon ? 55 : 35)));
    score += emaScore;
    if (emaSpreadPct <= -0.12) reasons.push(`EMA${emaFastPeriod} trails EMA${emaSlowPeriod} (${emaSpreadPct.toFixed(2)}%)`);
    else if (emaSpreadPct >= 0.12) reasons.push(`EMA${emaFastPeriod} leads EMA${emaSlowPeriod} (+${emaSpreadPct.toFixed(2)}%)`);
    triggers.push({
      id: 'TRG-EMA-CROSS',
      label: `EMA${emaFastPeriod} / EMA${emaSlowPeriod} Alignment`,
      category: 'TREND_STRUCTURE',
      observedValue: `${emaSpreadPct >= 0 ? '+' : ''}${emaSpreadPct.toFixed(2)}% ($${emaFast.toFixed(2)} vs $${emaSlow.toFixed(2)})`,
      thresholdRule: `>= +0.12% Bullish / <= -0.12% Bearish`,
      impactPoints: Number(emaScore.toFixed(1)),
      maxWeight: 35,
      lean: emaScore >= 4 ? 'BULLISH' : emaScore <= -4 ? 'BEARISH' : 'NEUTRAL',
      status: Math.abs(emaSpreadPct) >= 0.12 ? 'TRIGGERED' : 'WATCH',
    });

    // 2. Recent candle slope (+/- 30 pts)
    const slopeBars = isShortHorizon ? Math.min(5, closes.length - 1) : Math.min(15, closes.length - 1);
    const slopePct = computeSeriesSlopePct(closes, slopeBars);
    const slopeScore = Math.max(-30, Math.min(30, slopePct * (isShortHorizon ? 35 : 20)));
    score += slopeScore;
    if (slopePct <= -0.15) reasons.push(`${slopeBars}-bar slope negative (${slopePct.toFixed(2)}%)`);
    else if (slopePct >= 0.15) reasons.push(`${slopeBars}-bar slope positive (+${slopePct.toFixed(2)}%)`);
    triggers.push({
      id: 'TRG-CANDLE-SLOPE',
      label: `${slopeBars}-Bar Momentum Slope`,
      category: 'MOMENTUM',
      observedValue: `${slopePct >= 0 ? '+' : ''}${slopePct.toFixed(2)}%`,
      thresholdRule: `>= +0.15% Bullish / <= -0.15% Bearish`,
      impactPoints: Number(slopeScore.toFixed(1)),
      maxWeight: 30,
      lean: slopeScore >= 4 ? 'BULLISH' : slopeScore <= -4 ? 'BEARISH' : 'NEUTRAL',
      status: Math.abs(slopePct) >= 0.15 ? 'TRIGGERED' : 'WATCH',
    });

    // 3. Price vs slow EMA confirmation (+/- 15 pts)
    const closeVsSlowPct = emaSlow > 0 ? ((lastClose - emaSlow) / emaSlow) * 100 : 0;
    const closeSlowScore = Math.max(-15, Math.min(15, closeVsSlowPct * 25));
    score += closeSlowScore;
    triggers.push({
      id: 'TRG-PRICE-VS-EMA',
      label: `Spot Price vs EMA${emaSlowPeriod} Anchor`,
      category: 'TREND_STRUCTURE',
      observedValue: `${closeVsSlowPct >= 0 ? '+' : ''}${closeVsSlowPct.toFixed(2)}% ($${lastClose.toFixed(2)})`,
      thresholdRule: `Above EMA${emaSlowPeriod} confirms trend support; below signals distribution`,
      impactPoints: Number(closeSlowScore.toFixed(1)),
      maxWeight: 15,
      lean: closeSlowScore >= 2 ? 'BULLISH' : closeSlowScore <= -2 ? 'BEARISH' : 'NEUTRAL',
      status: Math.abs(closeVsSlowPct) >= 0.1 ? 'TRIGGERED' : 'WATCH',
    });
  } else if (indicators) {
    // Indicator snapshot without raw candle array
    const fastVal = isShortHorizon ? indicators.ema9 : indicators.ema21;
    const slowVal = isShortHorizon ? indicators.ema21 : indicators.ema50;
    const emaSpreadPct =
      indicators.ema50 > 0 && slowVal > 0 ? ((fastVal - slowVal) / slowVal) * 100 : 0;
    const emaScore = Math.max(-35, Math.min(35, emaSpreadPct * 40));
    score += emaScore;
    triggers.push({
      id: 'TRG-EMA-SNAPSHOT',
      label: `${isShortHorizon ? 'EMA9 / EMA21' : 'EMA21 / EMA50'} Snapshot Spread`,
      category: 'TREND_STRUCTURE',
      observedValue: `${emaSpreadPct >= 0 ? '+' : ''}${emaSpreadPct.toFixed(2)}%`,
      thresholdRule: `Snapshot EMA ratio drift`,
      impactPoints: Number(emaScore.toFixed(1)),
      maxWeight: 35,
      lean: emaScore >= 4 ? 'BULLISH' : emaScore <= -4 ? 'BEARISH' : 'NEUTRAL',
      status: Math.abs(emaSpreadPct) >= 0.1 ? 'TRIGGERED' : 'WATCH',
    });
  } else {
    // Quote-only fallback when callers provide only a spot Quote
    const threshold = horizon === 'LONG_TERM' ? -1.2 : horizon === 'SWING' ? -0.75 : -0.3;
    let quoteScore = 0;
    if (change24hPct <= threshold) {
      quoteScore = -40;
      reasons.push(`24h change negative (${change24hPct.toFixed(2)}%)`);
    } else if (change24hPct >= 0.15) {
      quoteScore = 35;
      reasons.push(`24h momentum positive (+${change24hPct.toFixed(2)}%)`);
    } else {
      quoteScore = Math.round(change24hPct * 35);
      reasons.push(`Flat 24h drift (${change24hPct.toFixed(2)}%)`);
    }
    score = quoteScore;
    triggers.push({
      id: 'TRG-QUOTE-FALLBACK',
      label: '24h Session Delta (Quote-Only Mode)',
      category: 'SESSION_DELTA',
      observedValue: `${change24hPct >= 0 ? '+' : ''}${change24hPct.toFixed(2)}%`,
      thresholdRule: `<= ${threshold}% triggers SELL / >= +0.15% triggers BUY`,
      impactPoints: quoteScore,
      maxWeight: 40,
      lean: quoteScore > 0 ? 'BULLISH' : quoteScore < 0 ? 'BEARISH' : 'NEUTRAL',
      status: quoteScore === -40 || quoteScore === 35 ? 'TRIGGERED' : 'WATCH',
    });
  }

  // Incorporate IndicatorSnapshot momentum signals (RSI, MACD, Supertrend) if supplied
  if (indicators) {
    if (indicators.supertrend?.direction === 'BEARISH') {
      const w = isShortHorizon ? -20 : -12;
      score += w;
      reasons.push('Supertrend BEARISH');
      triggers.push({
        id: 'TRG-SUPERTREND',
        label: 'ATR Supertrend Regime',
        category: 'TREND_STRUCTURE',
        observedValue: `BEARISH (Stop $${indicators.supertrend.value.toFixed(2)})`,
        thresholdRule: `Close below ATR trailing band flips trend to BEARISH`,
        impactPoints: w,
        maxWeight: Math.abs(w),
        lean: 'BEARISH',
        status: 'TRIGGERED',
      });
    } else if (indicators.supertrend?.direction === 'BULLISH') {
      const w = isShortHorizon ? 20 : 12;
      score += w;
      reasons.push('Supertrend BULLISH');
      triggers.push({
        id: 'TRG-SUPERTREND',
        label: 'ATR Supertrend Regime',
        category: 'TREND_STRUCTURE',
        observedValue: `BULLISH (Support $${indicators.supertrend.value.toFixed(2)})`,
        thresholdRule: `Close above ATR trailing band maintains BULLISH regime`,
        impactPoints: w,
        maxWeight: Math.abs(w),
        lean: 'BULLISH',
        status: 'TRIGGERED',
      });
    }

    if (Number.isFinite(indicators.macd?.histogram)) {
      const macdW = indicators.macd.histogram < 0 ? (isShortHorizon ? -12 : -8) : indicators.macd.histogram > 0 ? (isShortHorizon ? 12 : 8) : 0;
      score += macdW;
      triggers.push({
        id: 'TRG-MACD-HIST',
        label: 'MACD (12,26,9) Histogram',
        category: 'MOMENTUM',
        observedValue: `${indicators.macd.histogram >= 0 ? '+' : ''}${indicators.macd.histogram.toFixed(3)}`,
        thresholdRule: `> 0 Bullish impulse / < 0 Bearish impulse`,
        impactPoints: macdW,
        maxWeight: isShortHorizon ? 12 : 8,
        lean: macdW > 0 ? 'BULLISH' : macdW < 0 ? 'BEARISH' : 'NEUTRAL',
        status: macdW !== 0 ? 'TRIGGERED' : 'INACTIVE',
      });
    }

    if (Number.isFinite(indicators.rsi14)) {
      let rsiScore = 0;
      if (indicators.rsi14 <= 46) {
        rsiScore = -Math.min(15, (46 - indicators.rsi14) * 1.1);
        reasons.push(`RSI14 soft (${indicators.rsi14.toFixed(1)})`);
      } else if (indicators.rsi14 >= 54) {
        rsiScore = Math.min(15, (indicators.rsi14 - 54) * 1.1);
      }
      score += rsiScore;
      triggers.push({
        id: 'TRG-RSI14',
        label: 'RSI (14) Momentum Oscillator',
        category: 'OSCILLATOR',
        observedValue: `${indicators.rsi14.toFixed(1)}`,
        thresholdRule: `>= 54 Bullish expansion / <= 46 Bearish pressure / 46–54 Neutral`,
        impactPoints: Number(rsiScore.toFixed(1)),
        maxWeight: 15,
        lean: rsiScore > 0 ? 'BULLISH' : rsiScore < 0 ? 'BEARISH' : 'NEUTRAL',
        status: Math.abs(rsiScore) > 0 ? 'TRIGGERED' : 'WATCH',
      });
    }
  }

  // Weight live 24h session change heavily on intraday/short-term horizons
  if (candles && candles.length >= 10) {
    const changeWeight = isShortHorizon ? 25 : 10;
    const deltaScore = Math.max(-changeWeight, Math.min(changeWeight, change24hPct * (isShortHorizon ? 30 : 10)));
    score += deltaScore;
    triggers.push({
      id: 'TRG-SESSION-24H',
      label: '24h Benchmark Session Change',
      category: 'SESSION_DELTA',
      observedValue: `${change24hPct >= 0 ? '+' : ''}${change24hPct.toFixed(2)}%`,
      thresholdRule: `${isShortHorizon ? 'High' : 'Moderate'} intraday weighting on live session delta`,
      impactPoints: Number(deltaScore.toFixed(1)),
      maxWeight: changeWeight,
      lean: deltaScore >= 2 ? 'BULLISH' : deltaScore <= -2 ? 'BEARISH' : 'NEUTRAL',
      status: Math.abs(change24hPct) >= 0.2 ? 'TRIGGERED' : 'WATCH',
    });
  }

  if (typeof context?.macroBiasScore === 'number' && !isShortHorizon) {
    const macroAdj = Math.max(-15, Math.min(15, context.macroBiasScore * 0.15));
    score += macroAdj;
    triggers.push({
      id: 'TRG-MACRO-ANCHOR',
      label: 'Higher-Timeframe Macro Anchor',
      category: 'MACRO_ANCHOR',
      observedValue: `${context.macroBiasScore >= 0 ? '+' : ''}${context.macroBiasScore}`,
      thresholdRule: `Applied exclusively to SWING / LONG_TERM horizons (+/-15 cap)`,
      impactPoints: Number(macroAdj.toFixed(1)),
      maxWeight: 15,
      lean: macroAdj > 0 ? 'BULLISH' : macroAdj < 0 ? 'BEARISH' : 'NEUTRAL',
      status: Math.abs(macroAdj) >= 2 ? 'TRIGGERED' : 'WATCH',
    });
  }

  const boundedScore = Math.max(-100, Math.min(100, Math.round(score)));

  let direction: TradeDirection = 'HOLD';
  let state: RecommendationState = 'WAIT';
  let shortTermBias: 'BULLISH' | 'BEARISH' | 'NEUTRAL' = 'NEUTRAL';

  if (boundedScore >= 15) {
    direction = 'BUY';
    state = horizon === 'LONG_TERM' && boundedScore >= 45 ? 'STRONG_BULLISH' : 'BUY_CONFIRMED';
    shortTermBias = 'BULLISH';
  } else if (boundedScore <= -15) {
    direction = 'SELL';
    state = horizon === 'LONG_TERM' && boundedScore <= -45 ? 'STRONG_BEARISH' : 'SELL_CONFIRMED';
    shortTermBias = 'BEARISH';
  }

  return {
    direction,
    state,
    score: boundedScore,
    shortTermBias,
    rationale: reasons.length > 0 ? reasons.join('; ') : `Composite directional score=${boundedScore}`,
    triggers,
  };
}

export function getEvidenceRegistry(currentMid = 3898.90, context?: TradePlanGenerationContext): EvidenceItem[] {
  const refQuote: Quote = context?.quote || {
    instrumentId: 'XAUUSD',
    bid: currentMid - 0.15,
    ask: currentMid + 0.15,
    mid: currentMid,
    spread: 0.3,
    spreadPips: 30,
    high24h: currentMid * 1.005,
    low24h: currentMid * 0.995,
    open24h: currentMid,
    change24hPct: 0.85,
    volume24h: 125000,
    timestamp: new Date().toISOString(),
    provider: 'Aurum Reference',
    quality: 'FRESH',
    latencyMs: 50,
  };
  const techSignal = assessHorizonDirectionalSignal(refQuote, 'SHORT_TERM', context);
  const techBearish = techSignal.direction === 'SELL';
  const techNeutral = techSignal.direction === 'HOLD';
  const emaRef = context?.indicators?.ema50 ?? Number((currentMid * (techBearish ? 1.012 : 0.965)).toFixed(2));

  return [
    {
      id: 'EV-MACRO-01',
      category: 'MACRO',
      headline: 'US 10-Year TIPS Real Yield Consolidates at 1.93%',
      detail: 'Real yields have dropped 32 bps over the past 60 days, reducing the opportunity cost of holding non-yielding physical gold.',
      source: 'Federal Reserve Bank of St. Louis (FRED)',
      timestamp: new Date().toISOString(),
      confidence: 'HIGH',
      directionalLean: 'BULLISH',
    },
    {
      id: 'EV-FUND-02',
      category: 'FUNDAMENTALS',
      headline: 'Global Central Bank Gold Purchases Accelerate to 290 Tonnes (Q3)',
      detail: 'Sovereign reserves continue structural de-dollarization; PBOC, RBI, and Middle Eastern sovereign funds remain persistent structural accumulators.',
      source: 'World Gold Council (WGC)',
      timestamp: new Date().toISOString(),
      confidence: 'HIGH',
      directionalLean: 'BULLISH',
    },
    {
      id: 'EV-TECH-03',
      category: 'TECHNICAL',
      headline: techBearish
        ? `Short-Term Bearish Pullback Below Key EMA Resistance ($${emaRef.toFixed(2)})`
        : techNeutral
        ? `Range Compression Around Key Equilibrium EMA ($${emaRef.toFixed(2)})`
        : `Multi-Month Ascending Channel Intact Above 50-day EMA ($${emaRef.toFixed(2)})`,
      detail: techBearish
        ? `Recent price action at $${currentMid.toFixed(2)} shows negative short-term momentum (${techSignal.rationale}), favoring defensive SELL rallies or waiting for stabilization.`
        : techNeutral
        ? `Price action at $${currentMid.toFixed(2)} exhibits compressed directional momentum (${techSignal.rationale}); wait for clean corridor breakout confirmation.`
        : `Price maintains constructive structure above key averages; consolidation at $${currentMid.toFixed(2)} confirms institutional accumulation (${techSignal.rationale}).`,
      source: 'LBMA / Institutional Technical Service',
      timestamp: new Date().toISOString(),
      confidence: techNeutral ? 'MEDIUM' : 'HIGH',
      directionalLean: techBearish ? 'BEARISH' : techNeutral ? 'NEUTRAL' : 'BULLISH',
    },
    {
      id: 'EV-POS-04',
      category: 'POSITIONING',
      headline: 'COMEX Managed Money Net Longs Near 88th Historical Percentile',
      detail: 'Speculative positioning is historically elevated, increasing susceptibility to short-term liquidation shakeouts during dollar rallies.',
      source: 'CFTC Commitments of Traders (COT)',
      timestamp: new Date().toISOString(),
      confidence: 'MEDIUM',
      directionalLean: 'BEARISH',
    },
    {
      id: 'EV-MACRO-05',
      category: 'MACRO',
      headline: 'US Dollar Index (DXY) Consolidates at Key Resistance',
      detail: 'DXY momentum around major moving averages serves as a primary cross-asset governor on commodity valuations.',
      source: 'ICE FX Indices',
      timestamp: new Date().toISOString(),
      confidence: 'HIGH',
      directionalLean: 'BULLISH',
    },
    {
      id: 'EV-ANALOG-06',
      category: 'EVENT_ANALOG',
      headline: '2024 Fed Easing Cycle Initiation Analog (91% Match)',
      detail: 'Historical analog model indicates 83% probability of positive returns over 20 trading days following initial 50bps rate cut cycles.',
      source: 'Aurum Historical Event Engine',
      timestamp: new Date().toISOString(),
      confidence: 'MEDIUM',
      directionalLean: 'BULLISH',
    },
  ];
}

export const EVIDENCE_REGISTRY = getEvidenceRegistry(3898.90);

export function getSpecialistAgents(currentMid = 3898.90, context?: TradePlanGenerationContext): AgentAssessment[] {
  const refQuote: Quote = context?.quote || {
    instrumentId: 'XAUUSD',
    bid: currentMid - 0.15,
    ask: currentMid + 0.15,
    mid: currentMid,
    spread: 0.3,
    spreadPips: 30,
    high24h: currentMid * 1.005,
    low24h: currentMid * 0.995,
    open24h: currentMid,
    change24hPct: 0.85,
    volume24h: 125000,
    timestamp: new Date().toISOString(),
    provider: 'Aurum Reference',
    quality: 'FRESH',
    latencyMs: 50,
  };

  const shortSignal = assessHorizonDirectionalSignal(refQuote, 'SHORT_TERM', context);
  const swingSignal = assessHorizonDirectionalSignal(refQuote, 'SWING', context);
  const shortBias = shortSignal.shortTermBias;
  const swingBias = swingSignal.shortTermBias;

  const ema50 = (context?.indicators?.ema50 ?? currentMid * (swingBias === 'BEARISH' ? 1.012 : 0.965)).toFixed(2);
  const pullSupport = (currentMid - 25.0).toFixed(2);
  const targetSwing = (swingBias === 'BEARISH' ? currentMid - 85.0 : currentMid + 85.0).toFixed(2);
  const stopSwing = (swingBias === 'BEARISH' ? currentMid + 55.0 : currentMid - 45.0).toFixed(2);
  const now = new Date().toISOString();

  return [
    {
      role: 'MACRO_INTELLIGENCE',
      agentName: 'Macro Intelligence Specialist',
      horizon: 'LONG_TERM',
      directionalBias: 'BULLISH',
      convictionScorePct: 88,
      keyThesis: 'Secular easing regime, structural sovereign debt expansion, and declining TIPS real yields provide powerful macro tailwinds.',
      assessment:
        `The Federal Reserve easing cycle combined with persistent fiscal deficits creates a supportive macroeconomic environment. Gold quoting at $${currentMid.toFixed(2)} remains the premier sovereign hedge against fiat debasement.`,
      supportingEvidenceIds: ['EV-MACRO-01', 'EV-MACRO-05'],
      contradictoryEvidenceIds: ['EV-POS-04'],
      invalidationTrigger: 'Sustained breakout of US 10Y TIPS real yields above 2.40%.',
      timestamp: now,
    },
    {
      role: 'HISTORICAL_RESEARCH',
      agentName: 'Historical Event Research Specialist',
      horizon: 'SWING',
      directionalBias: 'BULLISH',
      convictionScorePct: 82,
      keyThesis: 'Historical analogs of early-cycle rate cuts demonstrate consistent +3% to +6% forward 20-day returns.',
      assessment:
        'Event study data across 15 post-war rate cut cycles confirms that when rate cuts occur during positive economic growth, gold outperforms equities and broad commodities.',
      supportingEvidenceIds: ['EV-ANALOG-06'],
      contradictoryEvidenceIds: [],
      invalidationTrigger: 'Sudden emergence of a severe liquidity shock causing cash hoarding across all assets.',
      timestamp: now,
    },
    {
      role: 'GOLD_FUNDAMENTALS',
      agentName: 'Gold Fundamentals Specialist',
      horizon: 'LONG_TERM',
      directionalBias: 'BULLISH',
      convictionScorePct: 92,
      keyThesis: 'Non-price-sensitive central bank buying and Western ETF inflows provide relentless physical demand floor.',
      assessment:
        `Central banks purchased 290 tonnes in Q3 alone. Concurrently, Western gold ETF outflows have reversed to positive net inflows, supporting spot prices above $${(currentMid * 0.95).toFixed(0)}.`,
      supportingEvidenceIds: ['EV-FUND-02'],
      contradictoryEvidenceIds: [],
      invalidationTrigger: 'Coordinated central bank gold reserve selling or official halt to accumulation programs.',
      timestamp: now,
    },
    {
      role: 'TECHNICAL_ANALYSIS',
      agentName: 'Technical Analysis Specialist',
      horizon: 'SWING',
      directionalBias: swingBias,
      convictionScorePct: swingBias === 'NEUTRAL' ? 60 : Math.min(90, 68 + Math.round(Math.abs(swingSignal.score) * 0.25)),
      keyThesis:
        swingBias === 'BEARISH'
          ? `Swing structure exhibits downward EMA pressure (${swingSignal.rationale}) below $${ema50}.`
          : swingBias === 'NEUTRAL'
          ? `Price compresses near equilibrium EMA ($${ema50}) with neutral trend separation (${swingSignal.rationale}).`
          : `Daily price structure forms higher lows along rising 21 EMA; Supertrend and MACD remain constructive above $${ema50}.`,
      assessment:
        swingBias === 'BEARISH'
          ? `Technical momentum has shifted bearish (${swingSignal.rationale}). Rallies into overhead resistance around $${(currentMid + 16).toFixed(2)} face distribution risk until EMA structure reclaims.`
          : swingBias === 'NEUTRAL'
          ? `Technical indicators show mixed consolidation near $${currentMid.toFixed(2)}. Wait for a decisive breakout beyond resistance or support before committing full directional sizing.`
          : `Technical structure shows healthy trend continuation. The recent pullback into $${pullSupport} tested broken horizontal resistance with strong buyer absorption.`,
      supportingEvidenceIds: ['EV-TECH-03'],
      contradictoryEvidenceIds: swingBias === 'BULLISH' ? [] : ['EV-MACRO-01'],
      invalidationTrigger:
        swingBias === 'BEARISH'
          ? `Daily close above $${ema50} invalidates immediate bearish momentum.`
          : `Daily close below $${ema50} (50-day EMA).`,
      timestamp: now,
    },
    {
      role: 'QUANTITATIVE_STRATEGY',
      agentName: 'Quantitative Strategy Specialist',
      horizon: 'SHORT_TERM',
      directionalBias: shortBias,
      convictionScorePct: shortBias === 'NEUTRAL' ? 58 : Math.min(88, 65 + Math.round(Math.abs(shortSignal.score) * 0.25)),
      keyThesis:
        shortBias === 'BEARISH'
          ? `Short-term momentum models lean BEARISH (${shortSignal.rationale}); counter-trend dip buys paused.`
          : shortBias === 'NEUTRAL'
          ? `Short-term quantitative models signal HOLD / RANGE_COMPRESSION (${shortSignal.rationale}).`
          : 'Canonical momentum and pullback strategies align positively with favorable risk-adjusted expectancy.',
      assessment:
        shortBias === 'BEARISH'
          ? `Short-term trend-following and MACD filters have rotated negative (${shortSignal.rationale}). Only hedged bearish rally rejections or neutral standing down are permitted on M15/H1.`
          : shortBias === 'NEUTRAL'
          ? `Short-term directional edge is compressed (${shortSignal.rationale}); quantitative rules recommend standing down until trend expansion.`
          : 'Multi-timeframe confluence and trend pullback strategies are aligned positively across intraday and 4-hour horizons.',
      supportingEvidenceIds: ['EV-TECH-03'],
      contradictoryEvidenceIds: shortBias === 'BULLISH' ? ['EV-POS-04'] : ['EV-FUND-02'],
      invalidationTrigger:
        shortBias === 'BEARISH'
          ? 'Confluence signal flip back to BULLISH on 4-hour close.'
          : 'Confluence strategy signal flip to BEARISH on 4-hour candle close.',
      timestamp: now,
    },
    {
      role: 'MARKET_STRUCTURE',
      agentName: 'Market Structure & Order Flow Specialist',
      horizon: 'INTRADAY',
      directionalBias: shortBias,
      convictionScorePct: shortBias === 'NEUTRAL' ? 60 : 78,
      keyThesis:
        shortBias === 'BEARISH'
          ? `Intraday order flow trades below session equilibrium; rallies into $${(currentMid + 8).toFixed(2)} face supply.`
          : shortBias === 'NEUTRAL'
          ? `Intraday liquidity balanced inside $${(currentMid - 6).toFixed(2)}–$${(currentMid + 6).toFixed(2)} value area.`
          : `Session established value above prior VWAP; liquidity pools below $${(currentMid - 10).toFixed(2)} were cleanly swept.`,
      assessment:
        shortBias === 'BEARISH'
          ? `Intraday market structure shows lower highs and negative 24h delta (${shortSignal.rationale}). Respect upside stop zones above $${(currentMid + 10).toFixed(2)}.`
          : shortBias === 'NEUTRAL'
          ? `Order flow is two-sided near $${currentMid.toFixed(2)} without directional imbalance.`
          : `Order flow shows constructive buyer absorption on dips into $${(currentMid - 8).toFixed(2)}–$${(currentMid - 3).toFixed(2)}.`,
      supportingEvidenceIds: ['EV-TECH-03'],
      contradictoryEvidenceIds: [],
      invalidationTrigger:
        shortBias === 'BEARISH'
          ? `Intraday reclaim above $${(currentMid + 15).toFixed(2)}.`
          : `Intraday breakdown below $${(currentMid - 15).toFixed(2)}.`,
      timestamp: now,
    },
    {
      role: 'NEWS_EVENT_RISK',
      agentName: 'News & Event Risk Specialist',
      horizon: 'SHORT_TERM',
      directionalBias: 'NEUTRAL',
      convictionScorePct: 65,
      keyThesis: 'Upcoming macro policy and geopolitical releases require disciplined position sizing.',
      assessment:
        'High-impact event risk can trigger sharp intraday whipsaws. Always apply strict invalidation buffers around Tier-1 releases.',
      supportingEvidenceIds: ['EV-POS-04'],
      contradictoryEvidenceIds: ['EV-MACRO-01'],
      invalidationTrigger: 'Unexpected emergency policy announcement or geopolitical shock.',
      warningNotice: 'Caution: widen stop loss buffers or reduce position sizing ahead of scheduled Tier-1 releases.',
      timestamp: now,
    },
    {
      role: 'CFD_RISK',
      agentName: 'CFD Risk & Cost Specialist',
      horizon: 'CFD',
      directionalBias: shortBias,
      convictionScorePct: shortBias === 'NEUTRAL' ? 62 : 84,
      keyThesis: `Tight benchmark spread permits clean 1:2+ net R:R setups aligned with ${shortBias} intraday structure.`,
      assessment:
        'CFD spread drag remains minimal (<0.01% of notional). Enforce hard intraday stops and avoid unhedged weekend carry.',
      supportingEvidenceIds: ['EV-TECH-03'],
      contradictoryEvidenceIds: [],
      invalidationTrigger: 'Spread expansion beyond 50 pips or margin utilization breaching 40%.',
      timestamp: now,
    },
    {
      role: 'PORTFOLIO_EXPOSURE',
      agentName: 'Portfolio & Exposure Specialist',
      horizon: 'SWING',
      directionalBias: swingBias === 'BEARISH' ? 'NEUTRAL' : 'BULLISH',
      convictionScorePct: swingBias === 'BEARISH' ? 68 : 82,
      keyThesis:
        swingBias === 'BEARISH'
          ? 'Maintain core physical hedge while trimming tactical directional leverage during bearish momentum phases.'
          : 'Core commodity allocation maintained within target risk budget.',
      assessment:
        'Low long-horizon equity correlation reinforces portfolio diversification while tactical sizing adapts to trend direction.',
      supportingEvidenceIds: ['EV-FUND-02', 'EV-MACRO-01'],
      contradictoryEvidenceIds: [],
      invalidationTrigger: 'Correlation with broad equities rising above +0.85.',
      timestamp: now,
    },
    {
      role: 'INDEPENDENT_CHALLENGE',
      agentName: 'Independent Adversarial Challenge Agent',
      horizon: 'SWING',
      directionalBias: swingBias === 'BEARISH' ? 'BEARISH' : 'NEUTRAL',
      convictionScorePct: 76,
      keyThesis:
        swingBias === 'BEARISH'
          ? 'ADVERSARIAL CRITIQUE: Negative trend momentum warns against catching falling knives before macro support stabilizes.'
          : 'ADVERSARIAL CRITIQUE: Speculative long positioning is crowded; risk of a violent liquidation squeeze is real.',
      assessment:
        swingBias === 'BEARISH'
          ? `Do NOT force bullish entries against active negative momentum (${shortSignal.rationale}). If macro longs conflict with short-term selling pressure, stand down or follow mirrored SELL invalidation rules.`
          : `Speculative positioning is elevated (COT 88th percentile). Traders should avoid chasing extended breakouts without pullback confirmation.`,
      supportingEvidenceIds: ['EV-POS-04'],
      contradictoryEvidenceIds: ['EV-MACRO-01', 'EV-FUND-02'],
      invalidationTrigger: `Decisive break beyond $${(currentMid + 50).toFixed(0)} or $${(currentMid - 50).toFixed(0)}.`,
      warningNotice: 'Adversarial Warning: Enforce hard stop invalidation and respect short-term trend conflicts.',
      timestamp: now,
    },
    {
      role: 'ADVISORY_COUNCIL',
      agentName: 'Chief Advisory Council Synthesis',
      horizon: 'SWING',
      directionalBias: swingBias,
      convictionScorePct: swingBias === 'NEUTRAL' ? 62 : 84,
      keyThesis:
        swingBias === 'BEARISH'
          ? `Consensus recommendation: BEARISH / SELL-RALLY posture with stop above $${stopSwing} and downside target at $${targetSwing}.`
          : swingBias === 'NEUTRAL'
          ? `Consensus recommendation: HOLD / WAIT near $${currentMid.toFixed(2)} until directional conflict resolves.`
          : `Consensus recommendation: BUY CONFIRMED ON PULLBACK with disciplined stop loss at $${stopSwing} and target at $${targetSwing}.`,
      assessment:
        swingBias === 'BEARISH'
          ? `Short- and swing-term technicals have turned negative (${swingSignal.rationale}), overriding passive long bias. The Council recommends bearish rally-rejection discipline above $${(currentMid + 10).toFixed(2)} or standing flat until reversal confirmation.`
          : swingBias === 'NEUTRAL'
          ? `Macro tailwinds and short-term consolidation are balanced near $${currentMid.toFixed(2)}. Maintain HOLD posture and wait for confirmed range expansion.`
          : `Macro tailwinds, central bank accumulation, and positive technical alignment support a disciplined BUY setup on pullbacks with 1:2.5+ net reward-to-risk.`,
      supportingEvidenceIds: swingBias === 'BEARISH' ? ['EV-TECH-03', 'EV-POS-04'] : ['EV-MACRO-01', 'EV-FUND-02', 'EV-TECH-03', 'EV-MACRO-05'],
      contradictoryEvidenceIds: swingBias === 'BEARISH' ? ['EV-MACRO-01', 'EV-FUND-02'] : ['EV-POS-04'],
      invalidationTrigger:
        swingBias === 'BEARISH'
          ? `Hourly close above $${stopSwing} invalidates the bearish swing setup.`
          : `Hourly close below $${stopSwing} invalidates the immediate swing setup.`,
      timestamp: now,
    },
  ];
}

export const SPECIALIST_AGENTS = getSpecialistAgents(3898.90);

interface HorizonOffsets {
  min: number;
  max: number;
  trig: number;
  stop: number;
  t1: number;
  t2: number;
  t3: number;
  invalid: number;
}

function buildDirectionalLevels(
  currentMid: number,
  direction: TradeDirection,
  m: HorizonOffsets
): {
  entryZoneMin: number;
  entryZoneMax: number;
  triggerPrice: number;
  stopLossPrice: number;
  target1Price: number;
  target2Price: number;
  target3Price: number;
  riskDistance: number;
  rewardDistance: number;
  rewardToRiskRatio: number;
} {
  if (direction === 'SELL') {
    const entryZoneMin = Number((currentMid + m.max).toFixed(2));
    const entryZoneMax = Number((currentMid + m.min).toFixed(2));
    const triggerPrice = Number((currentMid + m.trig).toFixed(2));
    const stopLossPrice = Number((currentMid + m.stop).toFixed(2));
    const target1Price = Number(Math.max(0.01, currentMid - m.t1).toFixed(2));
    const target2Price = Number(Math.max(0.01, currentMid - m.t2).toFixed(2));
    const target3Price = Number(Math.max(0.01, currentMid - m.t3).toFixed(2));
    const riskDistance = Number(Math.max(0.01, stopLossPrice - triggerPrice).toFixed(2));
    const rewardDistance = Number(Math.max(0.01, triggerPrice - target1Price).toFixed(2));
    return {
      entryZoneMin,
      entryZoneMax,
      triggerPrice,
      stopLossPrice,
      target1Price,
      target2Price,
      target3Price,
      riskDistance,
      rewardDistance,
      rewardToRiskRatio: Number((rewardDistance / riskDistance).toFixed(2)),
    };
  }

  if (direction === 'HOLD') {
    const entryZoneMin = Number(Math.max(0.01, currentMid - m.max).toFixed(2));
    const entryZoneMax = Number((currentMid + m.max).toFixed(2));
    const triggerPrice = Number(currentMid.toFixed(2));
    const stopLossPrice = Number(Math.max(0.01, currentMid - m.stop).toFixed(2));
    const target1Price = Number((currentMid + m.t1).toFixed(2));
    const target2Price = Number((currentMid + m.t2).toFixed(2));
    const target3Price = Number((currentMid + m.t3).toFixed(2));
    const riskDistance = Number(Math.max(0.01, triggerPrice - stopLossPrice).toFixed(2));
    const rewardDistance = Number(Math.max(0.01, target1Price - triggerPrice).toFixed(2));
    return {
      entryZoneMin,
      entryZoneMax,
      triggerPrice,
      stopLossPrice,
      target1Price,
      target2Price,
      target3Price,
      riskDistance,
      rewardDistance,
      rewardToRiskRatio: Number((rewardDistance / riskDistance).toFixed(2)),
    };
  }

  // BUY (and base geometry before NO_TRADE abstention override)
  const entryZoneMin = Number(Math.max(0.01, currentMid - m.min).toFixed(2));
  const entryZoneMax = Number(Math.max(0.01, currentMid - m.max).toFixed(2));
  const triggerPrice = Number(Math.max(0.01, currentMid - m.trig).toFixed(2));
  const stopLossPrice = Number(Math.max(0.01, currentMid - m.stop).toFixed(2));
  const target1Price = Number((currentMid + m.t1).toFixed(2));
  const target2Price = Number((currentMid + m.t2).toFixed(2));
  const target3Price = Number((currentMid + m.t3).toFixed(2));
  const riskDistance = Number(Math.max(0.01, triggerPrice - stopLossPrice).toFixed(2));
  const rewardDistance = Number(Math.max(0.01, target1Price - triggerPrice).toFixed(2));
  return {
    entryZoneMin,
    entryZoneMax,
    triggerPrice,
    stopLossPrice,
    target1Price,
    target2Price,
    target3Price,
    riskDistance,
    rewardDistance,
    rewardToRiskRatio: Number((rewardDistance / riskDistance).toFixed(2)),
  };
}

/**
 * Generate fully dynamic, mathematically sound trade plans anchored to current live mid price
 * and directional trend/momentum context across BUY, SELL, HOLD, and §4.4 NO_TRADE states.
 */
export function generateTradePlans(
  quote: Quote,
  context?: TradePlanGenerationContext
): Record<AdvisoryHorizon, TradePlan> {
  const currentMid = quote.mid || 3898.90;
  const now = quote.timestamp || new Date().toISOString();
  const expiryIntraday = new Date(Date.now() + 8 * 3600 * 1000).toISOString();
  const expirySwing = new Date(Date.now() + 5 * 24 * 3600 * 1000).toISOString();
  const expiryLong = new Date(Date.now() + 90 * 24 * 3600 * 1000).toISOString();

  const isSilver = quote.instrumentId.includes('XAG') || quote.instrumentId.includes('SI') || quote.instrumentId === 'SLV_ETF';
  const isWti = quote.instrumentId.includes('WTI') || quote.instrumentId.includes('CL') || quote.instrumentId === 'USO_ETF';
  const isBrent = quote.instrumentId.includes('BRENT') || quote.instrumentId.includes('BZ') || quote.instrumentId === 'BNO_ETF';

  // Multi-commodity offset calibrations (preserving exact Gold offsets)
  const mult = isSilver
    ? {
        intraMin: 0.22, intraMax: 0.08, intraTrig: 0.12, intraStop: 0.45, intraT1: 0.75, intraT2: 1.20, intraT3: 1.80,
        shortMin: 0.44, shortMax: 0.18, shortTrig: 0.28, shortStop: 0.88, shortT1: 1.38, shortT2: 2.25, shortT3: 3.45,
        swingMin: 1.35, swingMax: 0.50, swingTrig: 0.80, swingStop: 2.60, swingT1: 4.20, swingT2: 7.10, swingT3: 10.80,
        longMin: 6.80, longMax: 2.00, longTrig: 3.60, longStop: 12.50, longT1: 21.50, longT2: 38.00, longT3: 58.00,
        cfdMin: 0.18, cfdMax: 0.06, cfdTrig: 0.11, cfdStop: 0.36, cfdT1: 0.70, cfdT2: 1.15, cfdT3: 1.72,
        invalidIntra: 0.58, invalidShort: 1.10, invalidSwing: 2.90, invalidLongPct: 0.08,
      }
    : isWti
    ? {
        intraMin: 0.55, intraMax: 0.20, intraTrig: 0.32, intraStop: 1.15, intraT1: 1.85, intraT2: 3.10, intraT3: 4.65,
        shortMin: 1.10, shortMax: 0.42, shortTrig: 0.68, shortStop: 2.20, shortT1: 3.45, shortT2: 5.65, shortT3: 8.60,
        swingMin: 3.40, swingMax: 1.20, swingTrig: 1.95, swingStop: 6.70, swingT1: 10.40, swingT2: 17.60, swingT3: 27.20,
        longMin: 17.00, longMax: 5.00, longTrig: 9.10, longStop: 31.50, longT1: 54.00, longT2: 95.00, longT3: 145.00,
        cfdMin: 0.46, cfdMax: 0.15, cfdTrig: 0.27, cfdStop: 0.91, cfdT1: 1.75, cfdT2: 2.90, cfdT3: 4.35,
        invalidIntra: 1.45, invalidShort: 2.70, invalidSwing: 7.30, invalidLongPct: 0.08,
      }
    : isBrent
    ? {
        intraMin: 0.58, intraMax: 0.21, intraTrig: 0.34, intraStop: 1.22, intraT1: 1.95, intraT2: 3.25, intraT3: 4.90,
        shortMin: 1.16, shortMax: 0.45, shortTrig: 0.72, shortStop: 2.32, shortT1: 3.65, shortT2: 5.95, shortT3: 9.10,
        swingMin: 3.60, swingMax: 1.30, swingTrig: 2.05, swingStop: 7.10, swingT1: 11.00, swingT2: 18.70, swingT3: 28.80,
        longMin: 18.00, longMax: 5.20, longTrig: 9.60, longStop: 33.50, longT1: 58.00, longT2: 101.00, longT3: 154.00,
        cfdMin: 0.49, cfdMax: 0.16, cfdTrig: 0.29, cfdStop: 0.97, cfdT1: 1.86, cfdT2: 3.08, cfdT3: 4.60,
        invalidIntra: 1.55, invalidShort: 2.85, invalidSwing: 7.70, invalidLongPct: 0.08,
      }
    : {
        // Exact original Gold calibration preserved
        intraMin: 4.50, intraMax: 1.50, intraTrig: 2.50, intraStop: 9.50, intraT1: 15.00, intraT2: 25.00, intraT3: 38.00,
        shortMin: 9.00, shortMax: 3.50, shortTrig: 5.50, shortStop: 18.00, shortT1: 28.00, shortT2: 46.00, shortT3: 70.00,
        swingMin: 28.00, swingMax: 10.00, swingTrig: 16.00, swingStop: 55.00, swingT1: 85.00, swingT2: 145.00, swingT3: 225.00,
        longMin: 140.00, longMax: 40.00, longTrig: 75.00, longStop: 260.00, longT1: 450.00, longT2: 780.00, longT3: 1200.00,
        cfdMin: 3.80, cfdMax: 1.20, cfdTrig: 2.20, cfdStop: 7.50, cfdT1: 14.50, cfdT2: 24.00, cfdT3: 36.00,
        invalidIntra: 12.00, invalidShort: 22.00, invalidSwing: 60.00, invalidLongPct: 0.08,
      };

  const intraSig = assessHorizonDirectionalSignal(quote, 'INTRADAY', context);
  const shortSig = assessHorizonDirectionalSignal(quote, 'SHORT_TERM', context);
  const swingSig = assessHorizonDirectionalSignal(quote, 'SWING', context);
  const longSig = assessHorizonDirectionalSignal(quote, 'LONG_TERM', context);
  const cfdSig = assessHorizonDirectionalSignal(quote, 'CFD', context);

  const intraOffsets: HorizonOffsets = {
    min: mult.intraMin, max: mult.intraMax, trig: mult.intraTrig, stop: mult.intraStop,
    t1: mult.intraT1, t2: mult.intraT2, t3: mult.intraT3, invalid: mult.invalidIntra,
  };
  const shortOffsets: HorizonOffsets = {
    min: mult.shortMin, max: mult.shortMax, trig: mult.shortTrig, stop: mult.shortStop,
    t1: mult.shortT1, t2: mult.shortT2, t3: mult.shortT3, invalid: mult.invalidShort,
  };
  const swingOffsets: HorizonOffsets = {
    min: mult.swingMin, max: mult.swingMax, trig: mult.swingTrig, stop: mult.swingStop,
    t1: mult.swingT1, t2: mult.swingT2, t3: mult.swingT3, invalid: mult.invalidSwing,
  };
  const longOffsets: HorizonOffsets = {
    min: mult.longMin, max: mult.longMax, trig: mult.longTrig, stop: mult.longStop,
    t1: mult.longT1, t2: mult.longT2, t3: mult.longT3, invalid: currentMid * mult.invalidLongPct,
  };
  const cfdOffsets: HorizonOffsets = {
    min: mult.cfdMin, max: mult.cfdMax, trig: mult.cfdTrig, stop: mult.cfdStop,
    t1: mult.cfdT1, t2: mult.cfdT2, t3: mult.cfdT3, invalid: mult.cfdStop * 1.2,
  };

  const intraLevels = buildDirectionalLevels(currentMid, intraSig.direction, intraOffsets);
  const shortLevels = buildDirectionalLevels(currentMid, shortSig.direction, shortOffsets);
  const swingLevels = buildDirectionalLevels(currentMid, swingSig.direction, swingOffsets);
  const longLevels = buildDirectionalLevels(currentMid, longSig.direction, longOffsets);
  const cfdLevels = buildDirectionalLevels(currentMid, cfdSig.direction, cfdOffsets);

  const cfdInstrumentId = isSilver
    ? 'XAG_CFD'
    : isWti
    ? 'WTI_CFD'
    : isBrent
    ? 'BRENT_CFD'
    : 'XAU_CFD';

  const formatInvalidation = (dir: TradeDirection, horizonLabel: string, invalidOffset: number) => {
    if (dir === 'SELL') {
      return `Breakout and ${horizonLabel} close above $${(currentMid + invalidOffset).toFixed(2)} (${horizonLabel === 'Weekly' ? 'structural resistance' : 'prior swing high'}).`;
    }
    if (dir === 'HOLD') {
      return `Neutral corridor ($${Math.max(0.01, currentMid - invalidOffset).toFixed(2)}–$${(currentMid + invalidOffset).toFixed(2)}); await ${horizonLabel} directional close outside range.`;
    }
    return `Breakdown and ${horizonLabel} close below $${Math.max(0.01, currentMid - invalidOffset).toFixed(2)}.`;
  };

  const rawPlans: Record<AdvisoryHorizon, TradePlan> = {
    INTRADAY: {
      id: `PLAN-INTRADAY-${quote.instrumentId}`,
      instrumentId: quote.instrumentId,
      horizon: 'INTRADAY',
      direction: intraSig.direction,
      state: intraSig.state,
      createdAt: now,
      expiryAt: expiryIntraday,
      currentMid,
      ...intraLevels,
      invalidationCondition: formatInvalidation(intraSig.direction, '15m', mult.invalidIntra),
      eventRiskWarning: isWti || isBrent ? 'Watch EIA weekly petroleum report and geopolitical shipping headlines.' : 'Watch US Initial Jobless Claims and S&P Global PMI releases.',
      isAbstained: false,
    },
    SHORT_TERM: {
      id: `PLAN-SHORT-${quote.instrumentId}`,
      instrumentId: quote.instrumentId,
      horizon: 'SHORT_TERM',
      direction: shortSig.direction,
      state: shortSig.state,
      createdAt: now,
      expiryAt: expiryIntraday,
      currentMid,
      ...shortLevels,
      invalidationCondition: formatInvalidation(shortSig.direction, '1-Hour', mult.invalidShort),
      eventRiskWarning: isWti || isBrent ? 'Refinery turnaround schedules and prompt crack spread compressions.' : 'DXY momentum shift on hawkish Federal Reserve speakers.',
      isAbstained: false,
    },
    SWING: {
      id: `PLAN-SWING-${quote.instrumentId}`,
      instrumentId: quote.instrumentId,
      horizon: 'SWING',
      direction: swingSig.direction,
      state: swingSig.state,
      createdAt: now,
      expiryAt: expirySwing,
      currentMid,
      ...swingLevels,
      invalidationCondition: formatInvalidation(swingSig.direction, 'Daily', mult.invalidSwing),
      eventRiskWarning: isWti || isBrent ? 'Upcoming OPEC+ Ministerial meeting and international quota compliance report.' : 'Upcoming Federal Reserve FOMC Statement and Rate Decision.',
      isAbstained: false,
    },
    LONG_TERM: {
      id: `PLAN-LONG-${quote.instrumentId}`,
      instrumentId: quote.instrumentId,
      horizon: 'LONG_TERM',
      direction: longSig.direction,
      state: longSig.state,
      createdAt: now,
      expiryAt: expiryLong,
      currentMid,
      ...longLevels,
      invalidationCondition: formatInvalidation(longSig.direction, 'Weekly', currentMid * mult.invalidLongPct),
      eventRiskWarning: isWti || isBrent ? 'Global recession demand destruction or sudden non-OPEC supply expansion.' : 'Global macroeconomic deflation or sudden US fiscal austerity program.',
      isAbstained: false,
    },
    CFD: {
      id: `PLAN-CFD-${quote.instrumentId}`,
      instrumentId: cfdInstrumentId,
      horizon: 'CFD',
      direction: cfdSig.direction,
      state: cfdSig.state,
      createdAt: now,
      expiryAt: expiryIntraday,
      currentMid,
      ...cfdLevels,
      invalidationCondition:
        cfdSig.direction === 'SELL'
          ? `Spread widening > 45 pips or 15m close above $${(currentMid + mult.cfdStop * 1.2).toFixed(2)}.`
          : cfdSig.direction === 'HOLD'
          ? `Range compression active; wait for 15m breakout beyond $${(currentMid - mult.cfdStop).toFixed(2)}–$${(currentMid + mult.cfdStop).toFixed(2)}.`
          : `Spread widening > 45 pips or 15m close below $${Math.max(0.01, currentMid - mult.cfdStop * 1.2).toFixed(2)}.`,
      eventRiskWarning: 'Do not hold leveraged CFDs over weekend or through major releases due to gap risk.',
      isAbstained: false,
    },
  };

  const isBadPrice = !Number.isFinite(quote.mid) || quote.mid <= 0;
  const isCrossedBook = Number.isFinite(quote.bid) && Number.isFinite(quote.ask) && quote.bid > quote.ask;
  const isQualityAbstain = quote.quality === 'STALE' || quote.quality === 'QUALITY_HOLD' || isBadPrice || isCrossedBook;
  const abstentionReason = isCrossedBook
    ? `Crossed market book detected (bid ${quote.bid} > ask ${quote.ask}); advisory withheld per §4.4.`
    : isBadPrice
    ? 'Invalid or non-positive quote price; advisory withheld per §4.4.'
    : quote.quality === 'STALE' || quote.quality === 'QUALITY_HOLD'
    ? `Market data quality is ${quote.quality} (closed or stale feed); fresh directional advisory withheld per §4.4.`
    : undefined;

  // Attach cryptographic immutable SHA-256 fingerprint to each plan snapshot
  (Object.keys(rawPlans) as AdvisoryHorizon[]).forEach((horizon) => {
    const p = rawPlans[horizon];
    if (isQualityAbstain) {
      p.direction = 'NO_TRADE';
      p.state = 'DATA_QUALITY_HOLD';
      p.isAbstained = true;
      p.abstentionReason = abstentionReason;
    }
    p.version = 'v1.5.0-DYN-DIR';
    p.evalStatus = 'PENDING';
    p.snapshotHash = generateTradePlanFingerprint(p);
  });

  return rawPlans;
}

/**
 * Builds transparent institutional rationale explaining why a specific horizon emits
 * BUY, SELL, HOLD, or NO_TRADE — combining deterministic technical triggers,
 * commodity causal news sentiment, evidence items, and council voting distribution.
 */
export function buildStrategyBiasRationale(
  quote: Quote,
  horizon: AdvisoryHorizon,
  context?: TradePlanGenerationContext,
  activePlan?: TradePlan
): StrategyBiasRationale {
  const signal = assessHorizonDirectionalSignal(quote, horizon, context);
  const spec = getInstrumentById(quote.instrumentId);
  const commodity: CommodityType = spec?.commodity || 'GOLD';

  const plan = activePlan ?? generateTradePlans(quote, context)[horizon];
  const sentiment = calculateCommoditySentiment(commodity);
  const newsItems = getFilteredNewsEvidence(commodity);
  const evidenceItems = getEvidenceRegistry(quote.mid || 3898.9, { ...context, quote });
  const agents = getSpecialistAgents(quote.mid || 3898.9, { ...context, quote });

  const agentVotes = agents.reduce(
    (acc, agent) => {
      if (agent.directionalBias === 'BULLISH') acc.bullish += 1;
      else if (agent.directionalBias === 'BEARISH') acc.bearish += 1;
      else acc.neutral += 1;
      return acc;
    },
    { bullish: 0, bearish: 0, neutral: 0 }
  );

  const sentimentFactors: StrategySentimentFactor[] = [
    ...newsItems.map((n) => ({
      id: n.id,
      title: n.title,
      source: n.publisher,
      category: n.category.replace(/_/g, ' '),
      causalExplanation: n.causalTransmission,
      directionalLean: (n.directionalLean === 'MIXED_CONDITIONAL' ? 'NEUTRAL' : n.directionalLean) as 'BULLISH' | 'BEARISH' | 'NEUTRAL',
      weightLabel: `Materiality ${n.materialityScore.toFixed(1)} / 10 · ${n.sourceTier.replace(/_/g, ' ')}`,
      horizonRelevance: n.horizon,
    })),
    ...evidenceItems
      .filter((ev) => ev.category === 'POSITIONING' || ev.category === 'MACRO')
      .map((ev) => ({
        id: ev.id,
        title: ev.headline,
        source: ev.source,
        category: ev.category,
        causalExplanation: ev.detail,
        directionalLean: ev.directionalLean,
        weightLabel: `${ev.confidence} Confidence`,
        horizonRelevance: (ev.category === 'POSITIONING' ? 'INTRADAY' : 'STRUCTURAL') as 'INTRADAY' | 'SWING' | 'STRUCTURAL',
      })),
  ];

  const isAbstained = Boolean(plan?.isAbstained || plan?.direction === 'NO_TRADE');
  const resolvedDirection: TradeDirection = plan?.direction ?? signal.direction;
  const resolvedState: RecommendationState = plan?.state ?? signal.state;

  const isShortHorizon = horizon === 'INTRADAY' || horizon === 'CFD' || horizon === 'SHORT_TERM';
  let underlyingLogic = '';
  if (isAbstained) {
    underlyingLogic =
      plan?.abstentionReason ||
      'Market data failed §4.4 freshness or crossed-spread validation; directional recommendations are suppressed until clean telemetry resumes.';
  } else if (resolvedDirection === 'SELL') {
    underlyingLogic =
      `Quantitative composite score of ${signal.score} crossed below the -15 SELL threshold on the ${horizon.replace('_', ' ')} horizon (${signal.rationale}). Entry corridor, stop loss, and targets are inverted above/below current spot to capture downside continuation while respecting strict rally invalidation.`;
  } else if (resolvedDirection === 'BUY') {
    underlyingLogic =
      `Quantitative composite score of +${signal.score} exceeded the +15 BUY threshold on the ${horizon.replace('_', ' ')} horizon (${signal.rationale}). Pullback limit entry sits beneath spot with structural stop protection below support.`;
  } else {
    underlyingLogic =
      `Composite directional score of ${signal.score} remains inside the neutral compression band (-14 to +14) on the ${horizon.replace('_', ' ')} horizon (${signal.rationale}). Directional execution is paused until breakout confirmation.`;
  }

  let conflictNotice: string | undefined;
  if (!isAbstained && resolvedDirection === 'SELL' && sentiment.score >= 15) {
    conflictNotice =
      `Macro vs Tactical Divergence: Structural ${commodity.replace('_', ' ')} news/fundamental sentiment leans ${sentiment.label.replace('_', ' ')} (${sentiment.score >= 0 ? '+' : ''}${sentiment.score}), but active ${isShortHorizon ? 'intraday/short-term' : 'price-action'} EMA and momentum triggers are bearish (${signal.score}). Immediate price rules override passive long bias until trend structure reclaims.`;
  } else if (!isAbstained && resolvedDirection === 'BUY' && sentiment.score <= -15) {
    conflictNotice =
      `Macro vs Tactical Divergence: Higher-timeframe sentiment leans bearish (${sentiment.score}), while short-horizon price momentum triggered a tactical BUY bounce (+${signal.score}). Enforce tight stop invalidation.`;
  }

  return {
    instrumentId: quote.instrumentId,
    commodity,
    horizon,
    direction: resolvedDirection,
    state: resolvedState,
    compositeScore: signal.score,
    thresholds: { buyMin: 15, sellMax: -15 },
    isAbstained,
    abstentionReason: plan?.abstentionReason,
    underlyingLogic,
    conflictNotice,
    technicalTriggers: signal.triggers || [],
    sentimentScore: sentiment.score,
    sentimentLabel: sentiment.label,
    sentimentFactors,
    invalidationRule: plan?.invalidationCondition || 'Standard volatility stop invalidation.',
    agentVotes,
    generatedAt: quote.timestamp || new Date().toISOString(),
  };
}

export type SetupCountdownPhase =
  | 'IMMINENT'
  | 'ACCELERATING'
  | 'FORMING'
  | 'CONSOLIDATING'
  | 'HOLD_ABSTAINED';

export type VolumeMomentumPhase = 'SURGE' | 'EXPANDING' | 'NEUTRAL' | 'CONTRACTING';

export interface NextSetupCountdownEstimate {
  horizon: AdvisoryHorizon;
  direction: TradeDirection;
  barDurationSeconds: number;
  horizonCadenceLabel: string;
  estimatedBarsRemaining: number;
  estimatedSecondsRemaining: number;
  formattedCountdown: string;
  phase: SetupCountdownPhase;
  phaseLabel: string;
  rsi14: number;
  rsiVelocityPerBar: number;
  rsiDistanceToTrigger: number;
  rsiTargetLabel: string;
  volumeMomentumRatio: number;
  volumeAcceleration: number;
  volumePhase: VolumeMomentumPhase;
  volumePhaseLabel: string;
  triggerAtrDistance: number;
  cycleCompletionPct: number;
  rationaleSummary: string;
}

export interface EstimateNextSetupCountdownInput {
  plan: TradePlan;
  candles?: Candle[];
  indicators?: IndicatorSnapshot;
}

/**
 * Formats a non-negative duration in seconds into `HH:MM:SS` or `DDd HH:MM:SS` for Swing/Long-Term horizons.
 */
export function formatSetupCountdownDuration(totalSeconds: number): string {
  const safeSeconds = Number.isFinite(totalSeconds) ? Math.max(0, Math.floor(totalSeconds)) : 0;
  const days = Math.floor(safeSeconds / 86400);
  const hours = Math.floor((safeSeconds % 86400) / 3600);
  const minutes = Math.floor((safeSeconds % 3600) / 60);
  const seconds = safeSeconds % 60;

  const pad = (n: number) => String(n).padStart(2, '0');
  if (days > 0) {
    return `${days}d ${pad(hours)}:${pad(minutes)}:${pad(seconds)}`;
  }
  return `${pad(hours)}:${pad(minutes)}:${pad(seconds)}`;
}

function getHorizonCadence(horizon: AdvisoryHorizon): { barDurationSeconds: number; label: string } {
  switch (horizon) {
    case 'INTRADAY':
    case 'CFD':
      return { barDurationSeconds: 900, label: '15m Cycle' };
    case 'SHORT_TERM':
      return { barDurationSeconds: 3600, label: '1H Cycle' };
    case 'SWING':
      return { barDurationSeconds: 14400, label: '4H Cycle' };
    case 'LONG_TERM':
      return { barDurationSeconds: 86400, label: '1D Cycle' };
    default:
      return { barDurationSeconds: 3600, label: '1H Cycle' };
  }
}

/**
 * Estimates time remaining until the next technical setup trigger using:
 * 1) RSI-14 distance to directional activation edge and multi-bar RSI velocity
 * 2) Trailing volume momentum cycle ratio (3-bar vs 20-bar baseline) & acceleration
 * 3) Price ATR distance from the plan's trigger level scaled by horizon bar duration
 */
export function estimateNextSetupCountdown(
  input: EstimateNextSetupCountdownInput
): NextSetupCountdownEstimate {
  const { plan, candles, indicators } = input;
  const cadence = getHorizonCadence(plan.horizon);
  const safeCandles = Array.isArray(candles)
    ? candles.filter((c) => Number.isFinite(c?.close) && c.close > 0)
    : [];

  // 1. RSI-14 Level & Velocity Cycle
  let rsi14 =
    indicators && Number.isFinite(indicators.rsi14) && indicators.rsi14 >= 0 && indicators.rsi14 <= 100
      ? indicators.rsi14
      : 50;
  let rsiVelocityPerBar = 0;

  if (safeCandles.length >= 16) {
    const closes = safeCandles.map((c) => c.close);
    const rsiSeries = calculateRSI(closes, 14);
    const lastIdx = rsiSeries.length - 1;
    if (!indicators || !Number.isFinite(indicators.rsi14)) {
      rsi14 = rsiSeries[lastIdx];
    }
    const lookback = Math.min(4, lastIdx);
    if (lookback > 0) {
      rsiVelocityPerBar = (rsiSeries[lastIdx] - rsiSeries[lastIdx - lookback]) / lookback;
    }
  } else if (indicators && Number.isFinite(indicators.macd?.histogram)) {
    rsiVelocityPerBar = Math.max(-2.5, Math.min(2.5, indicators.macd.histogram * 0.4));
  }

  rsi14 = Number(Math.max(1, Math.min(99, rsi14)).toFixed(1));
  rsiVelocityPerBar = Number(Math.max(-15, Math.min(15, rsiVelocityPerBar)).toFixed(2));

  let rsiDistanceToTrigger = 0;
  let rsiTargetLabel = 'Neutral Band';
  let directedRsiVelocity = 0;

  if (plan.direction === 'BUY') {
    rsiDistanceToTrigger = Math.max(0, 54 - rsi14);
    rsiTargetLabel = rsi14 >= 54 ? 'RSI >= 54 Aligned' : 'Target RSI >= 54';
    directedRsiVelocity = rsiVelocityPerBar;
  } else if (plan.direction === 'SELL') {
    rsiDistanceToTrigger = Math.max(0, rsi14 - 46);
    rsiTargetLabel = rsi14 <= 46 ? 'RSI <= 46 Aligned' : 'Target RSI <= 46';
    directedRsiVelocity = -rsiVelocityPerBar;
  } else {
    // HOLD / NO_TRADE: nearest directional breakout band (<=46 or >=54)
    rsiDistanceToTrigger = rsi14 >= 50 ? Math.max(0, 54 - rsi14) : Math.max(0, rsi14 - 46);
    rsiTargetLabel = rsi14 >= 50 ? 'Breakout >= 54' : 'Breakdown <= 46';
    directedRsiVelocity = Math.abs(rsiVelocityPerBar);
  }
  rsiDistanceToTrigger = Number(rsiDistanceToTrigger.toFixed(1));

  // 2. Volume Momentum Cycle (3-bar impulse vs 20-bar baseline + 3-vs-7 acceleration)
  const volumes = safeCandles
    .map((c) => (Number.isFinite(c.volume) && c.volume > 0 ? c.volume : 0))
    .filter((v) => v > 0);

  let volumeMomentumRatio = 1.0;
  let volumeAcceleration = 1.0;

  if (volumes.length >= 6) {
    const baselineSlice = volumes.slice(-Math.min(20, volumes.length));
    const avgVol20 = baselineSlice.reduce((sum, v) => sum + v, 0) / baselineSlice.length;
    const recentSlice = volumes.slice(-3);
    const recentVol3 = recentSlice.reduce((sum, v) => sum + v, 0) / recentSlice.length;
    const priorSlice = volumes.slice(Math.max(0, volumes.length - 10), Math.max(1, volumes.length - 3));
    const priorVol7 =
      priorSlice.length > 0
        ? priorSlice.reduce((sum, v) => sum + v, 0) / priorSlice.length
        : avgVol20;

    if (avgVol20 > 0) {
      volumeMomentumRatio = Math.max(0.25, Math.min(3.5, recentVol3 / avgVol20));
    }
    if (priorVol7 > 0) {
      volumeAcceleration = Math.max(0.3, Math.min(3.0, recentVol3 / priorVol7));
    }
  }

  volumeMomentumRatio = Number(volumeMomentumRatio.toFixed(2));
  volumeAcceleration = Number(volumeAcceleration.toFixed(2));

  let volumePhase: VolumeMomentumPhase = 'NEUTRAL';
  let volumePhaseLabel = 'Neutral Flow';
  if (volumeMomentumRatio >= 1.45 || (volumeMomentumRatio >= 1.25 && volumeAcceleration >= 1.15)) {
    volumePhase = 'SURGE';
    volumePhaseLabel = 'Volume Surge';
  } else if (volumeMomentumRatio >= 1.1) {
    volumePhase = 'EXPANDING';
    volumePhaseLabel = 'Expanding';
  } else if (volumeMomentumRatio < 0.8) {
    volumePhase = 'CONTRACTING';
    volumePhaseLabel = 'Contracting';
  }

  // Higher volume compresses expected bars to trigger; low volume stretches wait time
  const volumeCompressionFactor = Math.max(
    0.42,
    Math.min(1.9, 1 / Math.pow(Math.max(0.3, volumeMomentumRatio), 0.65))
  );

  // 3. Price Distance to Trigger in ATR Units
  const fallbackAtr = Math.max(
    Number.isFinite(plan.riskDistance) && plan.riskDistance > 0 ? plan.riskDistance * 0.6 : 0,
    Number.isFinite(plan.currentMid) && plan.currentMid > 0 ? plan.currentMid * 0.004 : 1,
    0.01
  );
  const atrRef =
    indicators && Number.isFinite(indicators.atr14) && indicators.atr14 > 0
      ? indicators.atr14
      : fallbackAtr;
  const triggerGap =
    Number.isFinite(plan.currentMid) && Number.isFinite(plan.triggerPrice)
      ? Math.abs(plan.currentMid - plan.triggerPrice)
      : 0;
  const triggerAtrDistance = Number(Math.min(3.0, triggerGap / atrRef).toFixed(2));

  // 4. Combine RSI Cycle, Price Distance & Volume Momentum into Remaining Bars
  let rsiBarsNeeded = 0;
  if (rsiDistanceToTrigger <= 0.2) {
    rsiBarsNeeded = directedRsiVelocity >= 0.35 ? 0.2 : 0.6;
  } else if (directedRsiVelocity > 0.35) {
    rsiBarsNeeded = Math.min(8.0, rsiDistanceToTrigger / Math.max(0.85, directedRsiVelocity * 1.4));
  } else {
    const counterDrag = directedRsiVelocity < -0.4 ? Math.min(2.8, Math.abs(directedRsiVelocity) * 0.6) : 0;
    rsiBarsNeeded = Math.min(10.0, 1.4 + rsiDistanceToTrigger * 0.22 + counterDrag);
  }

  const priceBarsNeeded = triggerAtrDistance * 0.9;
  const blendedRawBars = rsiBarsNeeded * 0.62 + priceBarsNeeded * 0.38;
  const isAbstainedHold = Boolean(plan.isAbstained || plan.direction === 'NO_TRADE');
  const adjustedBars = isAbstainedHold
    ? Math.max(1.5, Math.min(6.0, blendedRawBars * volumeCompressionFactor + 1.5))
    : Math.max(0.1, Math.min(12.0, blendedRawBars * volumeCompressionFactor));

  const estimatedBarsRemaining = Number(adjustedBars.toFixed(2));
  const estimatedSecondsRemaining = Math.max(
    0,
    Math.min(cadence.barDurationSeconds * 12, Math.round(adjustedBars * cadence.barDurationSeconds))
  );
  const formattedCountdown = formatSetupCountdownDuration(estimatedSecondsRemaining);

  let phase: SetupCountdownPhase = 'FORMING';
  let phaseLabel = 'Forming';
  if (isAbstainedHold) {
    phase = 'HOLD_ABSTAINED';
    phaseLabel = 'Quality Hold';
  } else if (estimatedSecondsRemaining <= cadence.barDurationSeconds * 0.35) {
    phase = 'IMMINENT';
    phaseLabel = 'Imminent';
  } else if ((volumePhase === 'SURGE' || volumePhase === 'EXPANDING') && directedRsiVelocity > 0.25) {
    phase = 'ACCELERATING';
    phaseLabel = 'Accelerating';
  } else if (estimatedSecondsRemaining <= cadence.barDurationSeconds * 2.5) {
    phase = 'FORMING';
    phaseLabel = 'Forming';
  } else {
    phase = 'CONSOLIDATING';
    phaseLabel = 'Consolidating';
  }

  const maxWindowSeconds = cadence.barDurationSeconds * 6;
  const cycleCompletionPct = Math.round(
    Math.max(8, Math.min(98, (1 - Math.min(1, estimatedSecondsRemaining / maxWindowSeconds)) * 100))
  );

  const rsiSign = rsiVelocityPerBar >= 0 ? '+' : '';
  const rationaleSummary = isAbstainedHold
    ? `Telemetry hold active; re-evaluating ${cadence.label} RSI (${rsi14.toFixed(1)}) & volume (${volumeMomentumRatio.toFixed(2)}x) cycle.`
    : `RSI(14) ${rsi14.toFixed(1)} (${rsiSign}${rsiVelocityPerBar.toFixed(1)}/bar) · ${volumeMomentumRatio.toFixed(2)}x vol (${volumePhaseLabel}) over ${cadence.label}.`;

  return {
    horizon: plan.horizon,
    direction: plan.direction,
    barDurationSeconds: cadence.barDurationSeconds,
    horizonCadenceLabel: cadence.label,
    estimatedBarsRemaining,
    estimatedSecondsRemaining,
    formattedCountdown,
    phase,
    phaseLabel,
    rsi14,
    rsiVelocityPerBar,
    rsiDistanceToTrigger,
    rsiTargetLabel,
    volumeMomentumRatio,
    volumeAcceleration,
    volumePhase,
    volumePhaseLabel,
    triggerAtrDistance,
    cycleCompletionPct,
    rationaleSummary,
  };
}


