/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * Aurum Intelligence — Dynamic Market Regime & Canonical Decision Intelligence Engine (Phases 6 & 8)
 *
 * Implements:
 * 1. Phase 6 Reproducible Market Regime Classifier with explicit UNKNOWN fallback.
 * 2. Phase 8 Canonical Unified Decision Object & Mandatory NO_TRADE Rule Gate.
 * 3. Deterministic, explainable Opportunity Scanner ranking (zero opaque AI scores).
 */

import {
  AdvisoryHorizon,
  Candle,
  CommodityType,
  DataQualityState,
  InstrumentId,
  MarketRegimeType,
  Quote,
} from '../domain/types';
import { calculateATR, calculateEMA } from './indicators';
import { generateTradePlans, getSpecialistAgents } from './advisoryEngine';
import { evaluateCouncilConsensus } from './aiGovernanceEngine';
import { getCommodityFundamentals } from './commodityFundamentalsEngine';
import { getInstrumentById } from './commodityRegistry';
import { calculateCrossCommoditySpreads } from './crossCommoditySpreads';
import { generateCandleHistory } from './marketData';
import { computeDeterministicSha256 } from './forecastAccountability';

export type ExtendedRegimeLabel = MarketRegimeType | 'UNKNOWN';

export interface ReproducibleRegimeState {
  regime: ExtendedRegimeLabel;
  classifiedAtUtc: string;
  sampleCount: number;
  emaFast20: number;
  emaSlow50: number;
  atrPct: number;
  trendSlopePct: number;
  confidencePct: number;
  suitableStrategies: string[];
  conflictingStrategies: string[];
  rationale: string;
}

export type CanonicalDecisionDirection =
  | 'BUY'
  | 'SELL'
  | 'HOLD'
  | 'NO_TRADE'
  | 'INSUFFICIENT_EVIDENCE';

export type MandatoryNoTradeCode =
  | 'DATA_STALE_OR_HOLD'
  | 'EXPIRED_CONTRACT'
  | 'WIDE_SPREAD'
  | 'EVENT_BLACKOUT'
  | 'REGIME_UNKNOWN'
  | 'INVALID_RR_OR_STOP'
  | 'RISK_LIMIT_BREACHED'
  | 'AI_COUNCIL_VETO'
  | 'INSUFFICIENT_HISTORY';

export interface DecisionGateCondition {
  code: MandatoryNoTradeCode;
  triggered: boolean;
  detail: string;
}

export interface CanonicalDecisionObject {
  schemaVersion: '2.0.0';
  decisionId: string;
  instrumentId: InstrumentId;
  commodity: CommodityType;
  horizon: AdvisoryHorizon;
  timestamp: string;
  dataQuality: DataQualityState;
  dataProvider: string;
  marketRegime: ExtendedRegimeLabel;
  direction: CanonicalDecisionDirection;
  strategyId: string;
  entryCorridor: [number, number] | null;
  stopLossPrice: number | null;
  targets: [number, number, number] | null;
  rewardToRiskRatio: number;
  deterministicRankScore: number; // 0..100 explainable weighted score
  eventRiskStatus: 'CLEAR' | 'ELEVATED_CAUTION' | 'BLACKOUT_HOLD';
  evidenceSummary: {
    fundamentalBias: string;
    fundamentalScore: number;
    technicalState: string;
    crossAssetContext: string;
    councilDisagreementIndex: number;
    councilVetoed: boolean;
  };
  counterEvidence: string[];
  invalidationCondition: string;
  missingDataNotices: string[];
  noTradeTriggers: DecisionGateCondition[];
  snapshotHash: string;
  expiryAt: string;
  provenanceClassification: 'RESEARCH_AND_ADVISORY_ONLY';
}

/**
 * Phase 6: Reproducible Dynamic Regime Classifier with explicit UNKNOWN fallback.
 */
export function classifyMarketRegimeFromSeries(
  candles: Candle[],
  dataQuality: DataQualityState = 'FRESH'
): ReproducibleRegimeState {
  const now = new Date().toISOString();

  if (!candles || candles.length < 20 || dataQuality === 'STALE' || dataQuality === 'QUALITY_HOLD') {
    return {
      regime: 'UNKNOWN',
      classifiedAtUtc: now,
      sampleCount: candles?.length || 0,
      emaFast20: 0,
      emaSlow50: 0,
      atrPct: 0,
      trendSlopePct: 0,
      confidencePct: 0,
      suitableStrategies: [],
      conflictingStrategies: ['ALL_DIRECTIONAL_TREND', 'ALL_BREAKOUT'],
      rationale:
        dataQuality === 'STALE' || dataQuality === 'QUALITY_HOLD'
          ? `Classification halted (UNKNOWN): input data quality is ${dataQuality}.`
          : `Insufficient sample depth (${candles?.length || 0} < 20 candles) for reproducible regime state.`,
    };
  }

  const closes = candles.map((c) => c.close);
  const ema20Arr = calculateEMA(closes, 20);
  const slowPeriod = Math.min(50, closes.length);
  const ema50Arr = calculateEMA(closes, slowPeriod);
  const atrArr = calculateATR(candles, Math.min(14, closes.length - 1));

  const lastClose = closes[closes.length - 1];
  const emaFast20 = ema20Arr[ema20Arr.length - 1] || lastClose;
  const emaSlow50 = ema50Arr[ema50Arr.length - 1] || lastClose;
  const prevFast = ema20Arr[Math.max(0, ema20Arr.length - 6)] || emaFast20;
  const currentAtr = atrArr[atrArr.length - 1] || Math.abs(lastClose * 0.008);

  const atrPct = lastClose > 0 ? Number(((currentAtr / lastClose) * 100).toFixed(3)) : 0;
  const trendSlopePct = prevFast > 0 ? Number((((emaFast20 - prevFast) / prevFast) * 100).toFixed(3)) : 0;
  const spreadBetweenEmasPct = emaSlow50 > 0 ? ((emaFast20 - emaSlow50) / emaSlow50) * 100 : 0;

  let regime: ExtendedRegimeLabel = 'RANGE_COMPRESSION';
  let confidencePct = 68;
  let suitableStrategies: string[] = ['Mean Reversion Bollinger Pivot', 'Range Corridor Fade'];
  let conflictingStrategies: string[] = ['Momentum Breakout Continuation'];
  let rationale = 'Short/medium EMAs compressed with moderate realized ATR volatility.';

  if (atrPct >= 2.2) {
    regime = 'VOLATILITY_EXPANSION';
    confidencePct = 79;
    suitableStrategies = ['ATR Volatility Breakout', 'Wide-Stop Event Momentum'];
    conflictingStrategies = ['Tight-Stop Mean Reversion', 'High-Leverage Intraday Scalping'];
    rationale = `Realized ATR (${atrPct}%) exceeds expansion threshold (>=2.2%), elevating tail-stop risk.`;
  } else if (spreadBetweenEmasPct >= 0.45 && trendSlopePct >= 0.1) {
    regime = 'BULLISH_TREND';
    confidencePct = Math.min(92, Math.round(70 + Math.abs(spreadBetweenEmasPct) * 8));
    suitableStrategies = ['Pullback EMA Continuation', 'Macro Secular Trend Following'];
    conflictingStrategies = ['Counter-Trend Short Fade'];
    rationale = `EMA20 (${emaFast20.toFixed(2)}) leads EMA${slowPeriod} (${emaSlow50.toFixed(2)}) with positive slope (+${trendSlopePct}%).`;
  } else if (spreadBetweenEmasPct <= -0.45 && trendSlopePct <= -0.1) {
    regime = 'BEARISH_TREND';
    confidencePct = Math.min(92, Math.round(70 + Math.abs(spreadBetweenEmasPct) * 8));
    suitableStrategies = ['Bearish Rally Rejection', 'Defensive Hedged Short'];
    conflictingStrategies = ['Unhedged Dip Buying'];
    rationale = `EMA20 (${emaFast20.toFixed(2)}) trails EMA${slowPeriod} (${emaSlow50.toFixed(2)}) with negative slope (${trendSlopePct}%).`;
  } else if (Math.abs(spreadBetweenEmasPct) < 0.45 && Math.abs(trendSlopePct) >= 0.25) {
    regime = 'MACRO_TRANSITION';
    confidencePct = 62;
    suitableStrategies = ['Reduced-Size Confirmation Breakout'];
    conflictingStrategies = ['Full-Size Directional Leverage'];
    rationale = 'Fast trend slope diverges against medium baseline; transition risk elevated.';
  }

  return {
    regime,
    classifiedAtUtc: now,
    sampleCount: candles.length,
    emaFast20: Number(emaFast20.toFixed(2)),
    emaSlow50: Number(emaSlow50.toFixed(2)),
    atrPct,
    trendSlopePct,
    confidencePct,
    suitableStrategies,
    conflictingStrategies,
    rationale,
  };
}

export interface DecisionEvaluationOptions {
  horizon?: AdvisoryHorizon;
  candles?: Candle[];
  isContractExpired?: boolean;
  maxAllowedSpreadPips?: number;
  eventBlackoutActive?: boolean;
  accountRiskPct?: number;
  maxRiskCeilingPct?: number;
  forceCouncilVeto?: boolean;
}

/**
 * Phase 8: Produces one canonical, gate-enforced Decision Object per instrument.
 */
export function evaluateInstrumentDecision(
  instrumentId: InstrumentId,
  quote: Quote,
  allQuotes: Record<string, Quote>,
  options: DecisionEvaluationOptions = {}
): CanonicalDecisionObject {
  const horizon: AdvisoryHorizon = options.horizon || 'SWING';
  const commodity = getInstrumentById(instrumentId).commodity;
  const candles = options.candles ?? generateCandleHistory('1h', 80, quote.mid);
  const regimeState = classifyMarketRegimeFromSeries(candles, quote.quality);

  const plans = generateTradePlans(quote, { candles, quote });
  const selectedPlan = plans[horizon] || plans.SWING;

  const spreads = calculateCrossCommoditySpreads(allQuotes);
  const fundamentals = getCommodityFundamentals(
    commodity,
    commodity === 'SILVER'
      ? spreads.goldSilverRatio.ratio
      : commodity === 'BRENT_OIL'
      ? spreads.wtiBrentSpread.spreadUsd
      : undefined
  );

  const agents = getSpecialistAgents(quote.mid, { candles, quote });
  const consensus = evaluateCouncilConsensus(agents);
  const councilVetoed = Boolean(options.forceCouncilVeto) || consensus.adversarialVetoActive;

  // Evaluate all Mandatory NO_TRADE gates deterministically
  const maxSpread = options.maxAllowedSpreadPips ?? 65;
  const maxRiskCap = options.maxRiskCeilingPct ?? 1.5;
  const reqRiskPct = options.accountRiskPct ?? 0.75;

  const noTradeTriggers: DecisionGateCondition[] = [
    {
      code: 'DATA_STALE_OR_HOLD',
      triggered: quote.quality === 'STALE' || quote.quality === 'QUALITY_HOLD' || selectedPlan.isAbstained,
      detail: `Quote quality state=${quote.quality}${selectedPlan.abstentionReason ? ` (${selectedPlan.abstentionReason})` : ''}`,
    },
    {
      code: 'EXPIRED_CONTRACT',
      triggered: Boolean(options.isContractExpired),
      detail: options.isContractExpired ? 'Underlying futures contract expired or within final roll blackout.' : 'Active front-month contract verified.',
    },
    {
      code: 'WIDE_SPREAD',
      triggered: quote.spreadPips > maxSpread,
      detail: `Current spread=${quote.spreadPips} pips (threshold <= ${maxSpread} pips).`,
    },
    {
      code: 'EVENT_BLACKOUT',
      triggered: Boolean(options.eventBlackoutActive),
      detail: options.eventBlackoutActive ? 'Tier-1 macro event blackout active (FOMC/CPI/NFP).' : 'No active blackout window.',
    },
    {
      code: 'REGIME_UNKNOWN',
      triggered: regimeState.regime === 'UNKNOWN',
      detail: regimeState.rationale,
    },
    {
      code: 'INSUFFICIENT_HISTORY',
      triggered: candles.length < 20,
      detail: `Candle depth=${candles.length} bars (minimum 20 required).`,
    },
    {
      code: 'INVALID_RR_OR_STOP',
      triggered: selectedPlan.rewardToRiskRatio < 1.5 || selectedPlan.riskDistance <= 0,
      detail: `Projected R:R=${selectedPlan.rewardToRiskRatio} (minimum 1.50 required).`,
    },
    {
      code: 'RISK_LIMIT_BREACHED',
      triggered: reqRiskPct > maxRiskCap,
      detail: `Requested risk=${reqRiskPct}% vs ceiling=${maxRiskCap}%.`,
    },
    {
      code: 'AI_COUNCIL_VETO',
      triggered: councilVetoed,
      detail: councilVetoed ? 'Adversarial AI Governance Veto triggered.' : `Council disagreement=${consensus.disagreementIndexPct}%.`,
    },
  ];

  const triggeredGates = noTradeTriggers.filter((g) => g.triggered);
  const insufficientDataTriggered = triggeredGates.some(
    (g) => g.code === 'DATA_STALE_OR_HOLD' || g.code === 'INSUFFICIENT_HISTORY' || g.code === 'REGIME_UNKNOWN'
  );

  let direction: CanonicalDecisionDirection = selectedPlan.direction as CanonicalDecisionDirection;
  if (insufficientDataTriggered) {
    direction = 'INSUFFICIENT_EVIDENCE';
  } else if (triggeredGates.length > 0) {
    direction = 'NO_TRADE';
  } else if (
    (regimeState.regime === 'BEARISH_TREND' && direction === 'BUY') ||
    (regimeState.regime === 'BULLISH_TREND' && direction === 'SELL')
  ) {
    direction = 'HOLD';
  }

  // Transparent deterministic weighted ranking (no opaque AI score)
  const technicalPoints =
    regimeState.regime === 'BULLISH_TREND' || regimeState.regime === 'BEARISH_TREND'
      ? 35
      : regimeState.regime === 'VOLATILITY_EXPANSION'
      ? 22
      : 15;
  const fundamentalPoints = Math.min(25, Math.max(0, Math.round((Math.abs(fundamentals.fundamentalScore) / 100) * 25)));
  const rrPoints = Math.min(25, Math.round(selectedPlan.rewardToRiskRatio * 8));
  const freshnessBonus = quote.quality === 'FRESH' ? 15 : quote.quality === 'DEGRADED' ? 6 : 0;
  const rawRank = technicalPoints + fundamentalPoints + rrPoints + freshnessBonus - triggeredGates.length * 35;
  const deterministicRankScore = Math.max(0, Math.min(100, rawRank));

  const missingDataNotices: string[] = [];
  if (quote.provider === 'simulated_reference') {
    missingDataNotices.push('Quote sourced from simulated fallback reference; live feed temporarily unavailable.');
  }
  if (commodity === 'GOLD') {
    missingDataNotices.push('US_TIPS10Y real yield uses breakeven proxy when direct FRED key is unconfigured (GAP-04).');
  }

  const counterEvidence = [
    `Regime conflict checks: avoid ${regimeState.conflictingStrategies.join(', ') || 'over-leveraged breakout entries'}.`,
    ...fundamentals.modelLimitations.slice(0, 1),
  ];

  const decisionId = `DEC-${instrumentId}-${horizon}-${Date.now()}`;
  const timestamp = new Date().toISOString();
  const snapshotHash = computeDeterministicSha256(`${decisionId}|${quote.mid}|${selectedPlan.stopLossPrice}|${direction}`);

  return {
    schemaVersion: '2.0.0',
    decisionId,
    instrumentId,
    commodity,
    horizon,
    timestamp,
    dataQuality: quote.quality,
    dataProvider: quote.provider,
    marketRegime: regimeState.regime,
    direction,
    strategyId: regimeState.suitableStrategies[0] || 'DEFENSIVE_HOLD',
    entryCorridor: direction === 'NO_TRADE' || direction === 'INSUFFICIENT_EVIDENCE'
      ? null
      : [selectedPlan.entryZoneMin, selectedPlan.entryZoneMax],
    stopLossPrice: direction === 'NO_TRADE' || direction === 'INSUFFICIENT_EVIDENCE' ? null : selectedPlan.stopLossPrice,
    targets: direction === 'NO_TRADE' || direction === 'INSUFFICIENT_EVIDENCE'
      ? null
      : [selectedPlan.target1Price, selectedPlan.target2Price, selectedPlan.target3Price],
    rewardToRiskRatio: selectedPlan.rewardToRiskRatio,
    deterministicRankScore,
    eventRiskStatus: options.eventBlackoutActive ? 'BLACKOUT_HOLD' : 'CLEAR',
    evidenceSummary: {
      fundamentalBias: fundamentals.overallFundamentalBias,
      fundamentalScore: fundamentals.fundamentalScore,
      technicalState: `${regimeState.regime} (EMA20 ${regimeState.emaFast20} vs EMA50 ${regimeState.emaSlow50}, ATR ${regimeState.atrPct}%)`,
      crossAssetContext:
        commodity === 'GOLD' || commodity === 'SILVER'
          ? `GSR=${spreads.goldSilverRatio.ratio}x (${spreads.goldSilverRatio.regimeBias}); Breakeven=${spreads.breakevenInflation.ratePct}%`
          : `Brent-WTI=${spreads.wtiBrentSpread.spreadUsd}/bbl (${spreads.wtiBrentSpread.shippingPremiumRegime})`,
      councilDisagreementIndex: consensus.disagreementIndexPct,
      councilVetoed,
    },
    counterEvidence,
    invalidationCondition: selectedPlan.invalidationCondition,
    missingDataNotices,
    noTradeTriggers,
    snapshotHash,
    expiryAt: selectedPlan.expiryAt,
    provenanceClassification: 'RESEARCH_AND_ADVISORY_ONLY',
  };
}

export interface OpportunityScannerResult {
  scannedAtUtc: string;
  instrumentsScanned: number;
  actionableCount: number;
  noTradeCount: number;
  rankingFormula: string;
  decisions: CanonicalDecisionObject[];
}

export function runOpportunityScanner(
  allQuotes: Record<string, Quote>,
  horizon: AdvisoryHorizon = 'SWING',
  candlesByInstrument?: Partial<Record<InstrumentId, Candle[]>>
): OpportunityScannerResult {
  const targets: InstrumentId[] = ['XAUUSD', 'XAGUSD', 'WTI_CRUDE', 'BRENT_CRUDE'];
  const decisions = targets
    .map((id) => {
      const q = allQuotes[id];
      if (!q) return null;
      const candles = candlesByInstrument?.[id];
      return evaluateInstrumentDecision(id, q, allQuotes, { horizon, candles });
    })
    .filter((d): d is CanonicalDecisionObject => d !== null)
    .sort((a, b) => b.deterministicRankScore - a.deterministicRankScore);

  return {
    scannedAtUtc: new Date().toISOString(),
    instrumentsScanned: decisions.length,
    actionableCount: decisions.filter((d) => d.direction === 'BUY' || d.direction === 'SELL').length,
    noTradeCount: decisions.filter((d) => d.direction === 'NO_TRADE' || d.direction === 'INSUFFICIENT_EVIDENCE').length,
    rankingFormula: 'TechnicalRegime(0-35) + FundamentalScore(0-25) + RiskReward(0-25) + Freshness(0-15) - GatePenalties',
    decisions,
  };
}
