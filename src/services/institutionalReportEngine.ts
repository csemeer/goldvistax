/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * Aurum Intelligence — Institutional 12-Section Snapshot Report Generator (Addendum §13.2)
 *
 * Strictly enforces:
 * - "As of" UTC timestamp and deterministic SHA-256 snapshot seal
 * - Explicit distinction between Facts, Model Estimates, and Hypothetical Scenarios
 * - First-class NO_TRADE / INSUFFICIENT_EVIDENCE gating on Entry/Stop/Target emission
 */

import {
  AdvisoryHorizon,
  Candle,
  IndicatorSnapshot,
  Quote,
} from '../domain/types';
import { getInstrumentById } from './commodityRegistry';
import { calculateCrossCommoditySpreads } from './crossCommoditySpreads';
import { getCommodityFundamentals } from './commodityFundamentalsEngine';
import { classifyMarketRegimeFromSeries, evaluateInstrumentDecision } from './decisionIntelligenceEngine';
import { generateComprehensiveScorecard } from './forecastScorecardEngine';
import { CANONICAL_ECONOMIC_CALENDAR } from './newsSentimentEngine';
import { computeDeterministicSha256 } from './forecastAccountability';

export interface InstitutionalReportSection {
  sectionNumber: number;
  title: string;
  epistemicClassification: 'VERIFIED_FACT' | 'MODEL_ESTIMATE' | 'INTERPRETATION_OR_SCENARIO' | 'GOVERNANCE_DISCLOSURE';
  content: string;
  structuredData?: Record<string, any>;
}

export interface InstitutionalReportDocument {
  reportId: string;
  asOfUtc: string;
  instrumentId: string;
  commodity: string;
  horizon: AdvisoryHorizon;
  snapshotHash: string;
  provenanceClassification: 'RESEARCH_AND_ADVISORY_ONLY';
  sections: InstitutionalReportSection[];
  markdown: string;
}

export function generateInstitutionalReport(params: {
  instrumentId?: string;
  quote: Quote;
  allQuotes: Record<string, Quote>;
  candles: Candle[];
  indicators: IndicatorSnapshot;
  horizon?: AdvisoryHorizon;
  eventBlackoutActive?: boolean;
}): InstitutionalReportDocument {
  const {
    quote,
    allQuotes,
    candles,
    indicators,
    horizon = 'SWING',
    eventBlackoutActive = false,
  } = params;

  const inst = getInstrumentById(quote.instrumentId);
  const asOfUtc = new Date().toISOString();
  const regime = classifyMarketRegimeFromSeries(candles, quote.quality);
  const spreads = calculateCrossCommoditySpreads(allQuotes);
  const fundamentals = getCommodityFundamentals(
    inst.commodity,
    inst.commodity === 'SILVER'
      ? spreads.goldSilverRatio.ratio
      : inst.commodity === 'BRENT_OIL'
      ? spreads.wtiBrentSpread.spreadUsd
      : quotesFallbackTips(allQuotes)
  );
  const decision = evaluateInstrumentDecision(quote.instrumentId, quote, allQuotes, {
    horizon,
    candles,
    eventBlackoutActive,
  });
  const scorecard = generateComprehensiveScorecard();
  const calendarUpcoming = CANONICAL_ECONOMIC_CALENDAR.slice(0, 4);

  const reportId = `GV-RPT-${quote.instrumentId}-${horizon}-${Date.now()}`;
  const snapshotHash = computeDeterministicSha256(
    `${reportId}|${asOfUtc}|${quote.mid}|${decision.direction}|${regime.regime}`
  );

  const sections: InstitutionalReportSection[] = [
    {
      sectionNumber: 1,
      title: '1. Executive Summary',
      epistemicClassification: 'VERIFIED_FACT',
      content: `${inst.displayName} (${quote.instrumentId}) as of ${asOfUtc}: Mid $${quote.mid.toFixed(2)} via ${quote.provider} (Quality: ${quote.quality}). Regime is ${regime.regime}; canonical ${horizon} gate state is ${decision.direction} (Deterministic Rank: ${decision.deterministicRankScore}/100).`,
      structuredData: {
        midPrice: quote.mid,
        decisionDirection: decision.direction,
        rankScore: decision.deterministicRankScore,
      },
    },
    {
      sectionNumber: 2,
      title: '2. Data Freshness & Provenance',
      epistemicClassification: 'VERIFIED_FACT',
      content: `Provider: ${quote.provider}. Quality State: ${quote.quality}. Latency: ${quote.latencyMs}ms. Quote UTC: ${quote.timestamp}. Primary Yahoo/proxy feeds are indicative reference research sources, not licensed direct exchange execution ticks.`,
      structuredData: {
        provider: quote.provider,
        quality: quote.quality,
        latencyMs: quote.latencyMs,
        quoteTimestamp: quote.timestamp,
      },
    },
    {
      sectionNumber: 3,
      title: '3. Market Regime Assessment',
      epistemicClassification: 'MODEL_ESTIMATE',
      content: `Classified Regime: ${regime.regime} (Confidence: ${regime.confidencePct}%, Sample: ${regime.sampleCount} bars, EMA20: $${regime.emaFast20}, EMA50: $${regime.emaSlow50}, ATR%: ${regime.atrPct}%). ${regime.rationale}`,
      structuredData: { ...regime },
    },
    {
      sectionNumber: 4,
      title: '4. Price & Technical Structure',
      epistemicClassification: 'MODEL_ESTIMATE',
      content: `Spot $${quote.mid.toFixed(2)} | EMA50 $${indicators.ema50.toFixed(2)} | EMA200 $${indicators.ema200.toFixed(2)} | RSI(14) ${indicators.rsi14.toFixed(1)} | ATR(14) $${indicators.atr14.toFixed(2)} | Supertrend ${indicators.supertrend.direction} ($${indicators.supertrend.value.toFixed(2)}) | S1/R1: $${indicators.supportResistance.support1.toFixed(2)} / $${indicators.supportResistance.resistance1.toFixed(2)}.`,
      structuredData: {
        ema50: indicators.ema50,
        ema200: indicators.ema200,
        rsi14: indicators.rsi14,
        atr14: indicators.atr14,
        supertrend: indicators.supertrend,
      },
    },
    {
      sectionNumber: 5,
      title: '5. Cross-Asset Macro Context',
      epistemicClassification: 'MODEL_ESTIMATE',
      content: `Gold/Silver Ratio: ${spreads.goldSilverRatio.ratio}x (${spreads.goldSilverRatio.percentile5Y}th %tile 5Y, bias: ${spreads.goldSilverRatio.regimeBias}). Brent-WTI Spread: $${spreads.wtiBrentSpread.spreadUsd}/bbl (${spreads.wtiBrentSpread.shippingPremiumRegime}). 10Y Breakeven Inflation: ${spreads.breakevenInflation.ratePct}% (Nominal ${spreads.breakevenInflation.nominal10Y}% vs TIPS ${spreads.breakevenInflation.tipsReal10Y}%).`,
    },
    {
      sectionNumber: 6,
      title: '6. Commodity-Specific Fundamentals',
      epistemicClassification: 'VERIFIED_FACT',
      content: `${inst.commodity} Fundamental Bias: ${fundamentals.overallFundamentalBias} (Score ${fundamentals.fundamentalScore}/100). Tracked series: ${fundamentals.observations
        .map((o) => `${o.name}: ${o.value} ${o.unit} [${o.observationPeriod}, ${o.revisionStatus}, ${o.qualityState}]`)
        .join('; ')}.`,
      structuredData: {
        overallFundamentalBias: fundamentals.overallFundamentalBias,
        observationCount: fundamentals.observations.length,
      },
    },
    {
      sectionNumber: 7,
      title: '7. Bullish, Bearish & Neutral Scenarios',
      epistemicClassification: 'INTERPRETATION_OR_SCENARIO',
      content:
        `Bullish Case: Continuation above Pivot ($${indicators.supportResistance.pivot.toFixed(2)}) supported by ${fundamentals.keyStructuralDrivers[0]}. ` +
        `Bearish Case: Break below stop invalidation triggered by DXY breakout or real-yield spike. ` +
        `Neutral Case: Range consolidation between S1 ($${indicators.supportResistance.support1.toFixed(2)}) and R1 ($${indicators.supportResistance.resistance1.toFixed(2)}). These scenarios are illustrative expectations, not empirical forecasts of certainty.`,
    },
    {
      sectionNumber: 8,
      title: '8. Advisory / No-Trade Gate Verdict',
      epistemicClassification: 'VERIFIED_FACT',
      content: `Canonical Direction: ${decision.direction}. Active Strategy: ${decision.strategyId}. Triggered Hold Gates: ${
        decision.noTradeTriggers.filter((t) => t.triggered).map((t) => t.code).join(', ') || 'None (All 9 gates passed)'
      }. Council Disagreement Index: ${decision.evidenceSummary.councilDisagreementIndex}%.`,
      structuredData: {
        direction: decision.direction,
        triggeredGates: decision.noTradeTriggers.filter((t) => t.triggered),
      },
    },
    {
      sectionNumber: 9,
      title: '9. Entry, Invalidation & Targets',
      epistemicClassification: 'MODEL_ESTIMATE',
      content:
        decision.entryCorridor && decision.stopLossPrice && decision.targets
          ? `Entry Corridor: $${decision.entryCorridor[0].toFixed(2)} - $${decision.entryCorridor[1].toFixed(2)} | Stop Invalidation: $${decision.stopLossPrice.toFixed(2)} | T1/T2/T3: $${decision.targets[0].toFixed(2)} / $${decision.targets[1].toFixed(2)} / $${decision.targets[2].toFixed(2)} | R:R 1:${decision.rewardToRiskRatio}.`
          : `TRADE WITHHELD (${decision.direction}): Price entry corridor, stop loss, and profit targets are suppressed because mandatory NO_TRADE or INSUFFICIENT_EVIDENCE rules triggered.`,
    },
    {
      sectionNumber: 10,
      title: '10. Tier-1 Event Calendar',
      epistemicClassification: 'VERIFIED_FACT',
      content: calendarUpcoming
        .map((ev) => `${ev.eventTitle} (${ev.importance} — ${ev.scheduledTime})`)
        .join(' | '),
    },
    {
      sectionNumber: 11,
      title: '11. Historical Forecast Scorecard',
      epistemicClassification: 'VERIFIED_FACT',
      content: `Audited Sample: ${scorecard.overallScorecard.totalForecasts} forecasts (Resolved: ${scorecard.overallScorecard.resolvedCount}). Win Rate: ${scorecard.overallScorecard.winRatePct}%. Brier Score: ${scorecard.overallScorecard.brierScore.toFixed(4)}. MAE: $${scorecard.overallScorecard.maePriceUsd.toFixed(2)} | RMSE: $${scorecard.overallScorecard.rmsePriceUsd.toFixed(2)}. Avg Realized R: ${scorecard.overallScorecard.avgRealizedRr}R.`,
      structuredData: { ...scorecard.overallScorecard },
    },
    {
      sectionNumber: 12,
      title: '12. Limitations & Commercial Disclosures',
      epistemicClassification: 'GOVERNANCE_DISCLOSURE',
      content:
        'RESEARCH_AND_ADVISORY_ONLY: GoldVista does not route or execute live brokerage orders. ' +
        'Market data relies on sandbox reference feeds without commercial redistribution license (GAP-06); US_TIPS10Y falls back to a breakeven proxy (GAP-04); options volatility uses PROXY_PARAMETRIC_GVZ (not live OPRA); walk-forward backtests use simulated cost assumptions (GAP-03); signal guarantees refund Non-Cash platform credits only (GAP-05). ' +
        `Missing data notices: ${decision.missingDataNotices.join(' ') || 'None'}.`,
    },
  ];

  const markdown = [
    `# GoldVista Institutional Commodity Brief (${quote.instrumentId} · ${horizon})`,
    `**Report ID:** \`${reportId}\` | **As of (UTC):** \`${asOfUtc}\` | **Snapshot Hash:** \`${snapshotHash}\``,
    `**Classification:** \`RESEARCH_AND_ADVISORY_ONLY\``,
    '',
    ...sections.flatMap((s) => [
      `## ${s.title}`,
      `*Epistemic Tag:* \`${s.epistemicClassification}\``,
      '',
      s.content,
      '',
    ]),
  ].join('\n');

  return {
    reportId,
    asOfUtc,
    instrumentId: quote.instrumentId,
    commodity: inst.commodity,
    horizon,
    snapshotHash,
    provenanceClassification: 'RESEARCH_AND_ADVISORY_ONLY',
    sections,
    markdown,
  };
}

function quotesFallbackTips(allQuotes: Record<string, Quote>): number | undefined {
  return allQuotes.US_TIPS10Y?.mid;
}
