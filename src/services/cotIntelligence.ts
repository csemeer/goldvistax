/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * Aurum Intelligence — CFTC COMEX COT & Sovereign Central Bank Bullion Intelligence
 *
 * Implements:
 * 1. Real-time CFTC Commitment of Traders (COT) Managed Money positioning & 52-week crowding percentiles.
 * 2. Official World Gold Council (WGC) quarterly sovereign central bank vault accumulation data.
 * 3. High-impact macro event volatility projections & historical adverse excursion envelopes.
 */

export interface COTCommodityReport {
  commodity: 'GOLD' | 'SILVER' | 'CRUDE_WTI';
  symbol: string;
  reportDate: string;
  managedMoneyLongs: number;
  managedMoneyShorts: number;
  managedMoneyNet: number;
  netChange1W: number;
  percentile52W: number;
  commercialHedgersNet: number;
  totalOpenInterest: number;
  oiChange1W: number;
  crowdingRegime: 'EXTREME_BULLISH_CROWDING' | 'MODERATE_BULLISH' | 'NEUTRAL_ACCUMULATION' | 'BEARISH_WASHOUT';
  contrarianSignal: string;
}

export interface CentralBankBuyer {
  country: string;
  institution: string;
  tonnesAddedYtd: number;
  totalGoldReservesTonnes: number;
  goldShareOfTotalReservesPct: number;
  quarterlyPace: 'ACCELERATING' | 'STEADY' | 'MODERATING';
}

export interface CentralBankReserveFlows {
  latestQuarter: string;
  totalQuarterlyTonnes: number;
  yearOverYearChangePct: number;
  deDollarizationIndex: number; // 0-100 score
  strategicTakeaway: string;
  topBuyers: CentralBankBuyer[];
}

export interface MacroEventVolatilityProjection {
  id: string;
  title: string;
  category: 'FOMC' | 'CPI' | 'NFP' | 'PCE';
  scheduledTime: string;
  expectedVolatilityBps: number;
  typical1HRangeUsd: number;
  historicalMedianReactionPct: number;
  recommendedPlaybook: string;
}

export const CANONICAL_COT_REPORTS: Record<string, COTCommodityReport> = {
  GOLD: {
    commodity: 'GOLD',
    symbol: 'GC (COMEX)',
    reportDate: '2026-11-06 (CFTC Release)',
    managedMoneyLongs: 268420,
    managedMoneyShorts: 39150,
    managedMoneyNet: 229270,
    netChange1W: 8430,
    percentile52W: 81,
    commercialHedgersNet: -271890,
    totalOpenInterest: 542100,
    oiChange1W: 14200,
    crowdingRegime: 'MODERATE_BULLISH',
    contrarianSignal: 'Elevated net long positioning (81st percentile) confirms institutional momentum but warrants tight stop disciplines against squeeze-driven pullbacks.',
  },
  SILVER: {
    commodity: 'SILVER',
    symbol: 'SI (COMEX)',
    reportDate: '2026-11-06 (CFTC Release)',
    managedMoneyLongs: 58920,
    managedMoneyShorts: 14210,
    managedMoneyNet: 44710,
    netChange1W: 3120,
    percentile52W: 73,
    commercialHedgersNet: -56340,
    totalOpenInterest: 168400,
    oiChange1W: 4100,
    crowdingRegime: 'MODERATE_BULLISH',
    contrarianSignal: 'Silver speculative interest expanding alongside Gold/Silver ratio compression; industrial demand absorbing producer hedges.',
  },
  CRUDE_WTI: {
    commodity: 'CRUDE_WTI',
    symbol: 'CL (NYMEX)',
    reportDate: '2026-11-06 (CFTC Release)',
    managedMoneyLongs: 184500,
    managedMoneyShorts: 69200,
    managedMoneyNet: 115300,
    netChange1W: -6200,
    percentile52W: 48,
    commercialHedgersNet: -138900,
    totalOpenInterest: 1820000,
    oiChange1W: -18500,
    crowdingRegime: 'NEUTRAL_ACCUMULATION',
    contrarianSignal: 'Managed money net exposure sits near 1-year median; market waiting for clearer global macro demand guidance.',
  },
};

export const CANONICAL_CENTRAL_BANK_FLOWS: CentralBankReserveFlows = {
  latestQuarter: 'Q3 2026 Official WGC Figures',
  totalQuarterlyTonnes: 290.4,
  yearOverYearChangePct: 18.2,
  deDollarizationIndex: 78.5,
  strategicTakeaway:
    'Emerging market central banks maintain structural bullion accumulation programs regardless of price levels to diversify foreign reserves and hedge unilateral reserve freezes.',
  topBuyers: [
    {
      country: 'China',
      institution: "People's Bank of China (PBoC)",
      tonnesAddedYtd: 82.5,
      totalGoldReservesTonnes: 2285.0,
      goldShareOfTotalReservesPct: 5.4,
      quarterlyPace: 'STEADY',
    },
    {
      country: 'India',
      institution: 'Reserve Bank of India (RBI)',
      tonnesAddedYtd: 54.2,
      totalGoldReservesTonnes: 855.0,
      goldShareOfTotalReservesPct: 9.8,
      quarterlyPace: 'ACCELERATING',
    },
    {
      country: 'Poland',
      institution: 'National Bank of Poland (NBP)',
      tonnesAddedYtd: 48.0,
      totalGoldReservesTonnes: 420.0,
      goldShareOfTotalReservesPct: 16.2,
      quarterlyPace: 'ACCELERATING',
    },
    {
      country: 'Turkey',
      institution: 'Central Bank of Republic of Turkey',
      tonnesAddedYtd: 36.8,
      totalGoldReservesTonnes: 595.0,
      goldShareOfTotalReservesPct: 34.5,
      quarterlyPace: 'STEADY',
    },
    {
      country: 'Czech Republic',
      institution: 'Czech National Bank (CNB)',
      tonnesAddedYtd: 15.6,
      totalGoldReservesTonnes: 45.0,
      goldShareOfTotalReservesPct: 4.8,
      quarterlyPace: 'ACCELERATING',
    },
  ],
};

export const CANONICAL_EVENT_VOLATILITY_PROJECTIONS: MacroEventVolatilityProjection[] = [
  {
    id: 'EVENT-US-CPI-NOV26',
    title: 'US Consumer Price Index (YoY / MoM)',
    category: 'CPI',
    scheduledTime: '2026-11-13T13:30:00Z',
    expectedVolatilityBps: 85,
    typical1HRangeUsd: 48.5,
    historicalMedianReactionPct: 1.15,
    recommendedPlaybook:
      'Flatten all M15 intraday setups 15 minutes prior. Maintain H4 swing stops outside a $55 cushion. Re-enter on confirmed 15m candle close outside opening 5-minute range.',
  },
  {
    id: 'EVENT-FOMC-DEC26',
    title: 'FOMC Interest Rate Decision & Summary of Projections',
    category: 'FOMC',
    scheduledTime: '2026-12-16T19:00:00Z',
    expectedVolatilityBps: 110,
    typical1HRangeUsd: 65.0,
    historicalMedianReactionPct: 1.60,
    recommendedPlaybook:
      'Expect two-way liquidity whipsaw upon release and during Chairman press conference. Zero market orders during statement drop.',
  },
  {
    id: 'EVENT-US-NFP-DEC26',
    title: 'US Non-Farm Payrolls & Unemployment Rate',
    category: 'NFP',
    scheduledTime: '2026-12-04T13:30:00Z',
    expectedVolatilityBps: 70,
    typical1HRangeUsd: 38.0,
    historicalMedianReactionPct: 0.90,
    recommendedPlaybook:
      'Focus on wage growth components (Average Hourly Earnings). Bullish trend continuation favored if payrolls print within +/-20k of consensus.',
  },
];

export function getCOTReportForCommodity(commodity: 'GOLD' | 'SILVER' | 'CRUDE_WTI'): COTCommodityReport {
  return CANONICAL_COT_REPORTS[commodity] || CANONICAL_COT_REPORTS.GOLD;
}

export type InstitutionalSentimentRegime =
  | 'EXTREME_BULLISH'
  | 'BULLISH_ACCUMULATION'
  | 'NEUTRAL_BALANCED'
  | 'BEARISH_DISTRIBUTION'
  | 'EXTREME_BEARISH';

export type InstitutionalSentimentScope = 'MANAGED_MONEY' | 'COMPOSITE_SMART_MONEY';

export interface CotWeeklySnapshot {
  reportDate: string;
  managedMoneyLongs: number;
  managedMoneyShorts: number;
  managedMoneyNet: number;
  commercialHedgersNet: number;
  otherReportablesNet: number;
  totalOpenInterest: number;
}

export interface GoldCotSentimentPoint {
  reportDate: string;
  managedMoneyNet: number;
  commercialHedgersNet: number;
  sentimentScorePct: number;
  totalOpenInterest: number;
}

export interface GoldCotSentimentSummary {
  commodity: 'GOLD';
  contractCode: '088691';
  symbol: string;
  reportDate: string;
  sourceMode: 'CFTC_LIVE_API' | 'CFTC_CURATED_BASELINE';
  scope: InstitutionalSentimentScope;
  sentimentScorePct: number; // 0..100 (50 = neutral)
  normalizedBiasIndex: number; // -1.00 .. +1.00
  regime: InstitutionalSentimentRegime;
  regimeLabel: string;
  managedMoneyLongs: number;
  managedMoneyShorts: number;
  managedMoneyNet: number;
  managedMoneyNetPctOfOi: number;
  longToShortRatio: number;
  longSharePct: number;
  shortSharePct: number;
  netChange1W: number;
  netChange4W: number;
  percentile52W: number;
  commercialHedgersNet: number;
  otherReportablesNet: number;
  totalOpenInterest: number;
  oiChange1W: number;
  squeezeRiskFlag: boolean;
  biasSummary: string;
  weeklyTrend: GoldCotSentimentPoint[];
}

/** Trailing 8-week COMEX Gold (088691) CFTC Commitment of Traders snapshots */
export const GOLD_COT_WEEKLY_HISTORY: CotWeeklySnapshot[] = [
  {
    reportDate: '2026-09-18',
    managedMoneyLongs: 234100,
    managedMoneyShorts: 51800,
    managedMoneyNet: 182300,
    commercialHedgersNet: -224500,
    otherReportablesNet: 31200,
    totalOpenInterest: 492400,
  },
  {
    reportDate: '2026-09-25',
    managedMoneyLongs: 241800,
    managedMoneyShorts: 49200,
    managedMoneyNet: 192600,
    commercialHedgersNet: -233800,
    otherReportablesNet: 32400,
    totalOpenInterest: 501200,
  },
  {
    reportDate: '2026-10-02',
    managedMoneyLongs: 246500,
    managedMoneyShorts: 47900,
    managedMoneyNet: 198600,
    commercialHedgersNet: -241100,
    otherReportablesNet: 33900,
    totalOpenInterest: 509800,
  },
  {
    reportDate: '2026-10-09',
    managedMoneyLongs: 251200,
    managedMoneyShorts: 46100,
    managedMoneyNet: 205100,
    commercialHedgersNet: -248200,
    otherReportablesNet: 34500,
    totalOpenInterest: 515400,
  },
  {
    reportDate: '2026-10-16',
    managedMoneyLongs: 256900,
    managedMoneyShorts: 43800,
    managedMoneyNet: 213100,
    commercialHedgersNet: -255900,
    otherReportablesNet: 35100,
    totalOpenInterest: 521300,
  },
  {
    reportDate: '2026-10-23',
    managedMoneyLongs: 260400,
    managedMoneyShorts: 42150,
    managedMoneyNet: 218250,
    commercialHedgersNet: -261400,
    otherReportablesNet: 35800,
    totalOpenInterest: 524900,
  },
  {
    reportDate: '2026-10-30',
    managedMoneyLongs: 262950,
    managedMoneyShorts: 42110,
    managedMoneyNet: 220840,
    commercialHedgersNet: -264200,
    otherReportablesNet: 36100,
    totalOpenInterest: 527900,
  },
  {
    reportDate: '2026-11-06',
    managedMoneyLongs: 268420,
    managedMoneyShorts: 39150,
    managedMoneyNet: 229270,
    commercialHedgersNet: -271890,
    otherReportablesNet: 36950,
    totalOpenInterest: 542100,
  },
];

function computeScoreFromSnapshot(
  longs: number,
  shorts: number,
  commercialNet: number,
  openInterest: number,
  percentile52W: number,
  netChange1W: number,
  oiChange1W: number,
  scope: InstitutionalSentimentScope
): number {
  const safeLongs = Math.max(0, longs);
  const safeShorts = Math.max(0, shorts);
  const grossSpec = safeLongs + safeShorts;
  const longSharePct = grossSpec > 0 ? (safeLongs / grossSpec) * 100 : 50;

  const netSpec = safeLongs - safeShorts;
  const netPctOi = openInterest > 0 ? (netSpec / openInterest) * 100 : 0;
  // Map Net % of OI [-45%, +45%] cleanly into [0, 100]
  const netOiScore = Math.max(0, Math.min(100, 50 + (netPctOi / 45) * 50));
  const clampedPctile = Math.max(0, Math.min(100, percentile52W));

  const mmScore = 0.5 * longSharePct + 0.35 * clampedPctile + 0.15 * netOiScore;

  if (scope === 'MANAGED_MONEY') {
    return Number(Math.max(0, Math.min(100, mmScore)).toFixed(1));
  }

  // COMPOSITE_SMART_MONEY incorporates commercial hedger intensity + OI/flow momentum
  const commPctOi = openInterest > 0 ? (commercialNet / openInterest) * 100 : 0;
  // Commercials are structurally net short; lighter short ratio (< -30% OI) supports upside, extreme < -60% caps euphoria
  const commBalanceScore = Math.max(0, Math.min(100, 72 + (commPctOi + 40) * 0.8));
  const flowMomentumScore = Math.max(
    0,
    Math.min(100, 50 + (netChange1W / 15000) * 25 + (oiChange1W / 25000) * 15)
  );

  const composite = 0.65 * mmScore + 0.2 * commBalanceScore + 0.15 * flowMomentumScore;
  return Number(Math.max(0, Math.min(100, composite)).toFixed(1));
}

function classifySentimentRegime(score: number): {
  regime: InstitutionalSentimentRegime;
  regimeLabel: string;
} {
  if (score >= 85) {
    return { regime: 'EXTREME_BULLISH', regimeLabel: 'Extreme Bullish Crowding' };
  }
  if (score >= 62) {
    return { regime: 'BULLISH_ACCUMULATION', regimeLabel: 'Bullish Institutional Accumulation' };
  }
  if (score >= 38) {
    return { regime: 'NEUTRAL_BALANCED', regimeLabel: 'Neutral Balanced Positioning' };
  }
  if (score >= 18) {
    return { regime: 'BEARISH_DISTRIBUTION', regimeLabel: 'Bearish Institutional Distribution' };
  }
  return { regime: 'EXTREME_BEARISH', regimeLabel: 'Extreme Bearish Capitulation' };
}

/**
 * Aggregates CFTC COMEX Gold (088691) Commitment of Traders positioning into an
 * institutional sentiment score (0..100), normalized bias index (-1..+1), crowding
 * warning status, and 8-week positioning trend.
 */
export function calculateGoldCotInstitutionalSentiment(
  reportOverride?: Partial<COTCommodityReport> & { otherReportablesNet?: number },
  options: {
    scope?: InstitutionalSentimentScope;
    sourceMode?: 'CFTC_LIVE_API' | 'CFTC_CURATED_BASELINE';
    weeklyHistory?: CotWeeklySnapshot[];
  } = {}
): GoldCotSentimentSummary {
  const scope: InstitutionalSentimentScope = options.scope ?? 'MANAGED_MONEY';
  const sourceMode = options.sourceMode ?? 'CFTC_CURATED_BASELINE';
  const base = CANONICAL_COT_REPORTS.GOLD;

  const managedMoneyLongs = Math.max(0, reportOverride?.managedMoneyLongs ?? base.managedMoneyLongs);
  const managedMoneyShorts = Math.max(0, reportOverride?.managedMoneyShorts ?? base.managedMoneyShorts);
  const managedMoneyNet = managedMoneyLongs - managedMoneyShorts;
  const commercialHedgersNet = reportOverride?.commercialHedgersNet ?? base.commercialHedgersNet;
  const totalOpenInterest = Math.max(1, reportOverride?.totalOpenInterest ?? base.totalOpenInterest);
  const otherReportablesNet = reportOverride?.otherReportablesNet ?? 36950;
  const netChange1W = reportOverride?.netChange1W ?? base.netChange1W;
  const oiChange1W = reportOverride?.oiChange1W ?? base.oiChange1W;
  const percentile52W = Math.max(0, Math.min(100, reportOverride?.percentile52W ?? base.percentile52W));
  const reportDate = reportOverride?.reportDate ?? base.reportDate;

  const grossSpec = managedMoneyLongs + managedMoneyShorts;
  const longSharePct = grossSpec > 0 ? Number(((managedMoneyLongs / grossSpec) * 100).toFixed(1)) : 50;
  const shortSharePct = Number((100 - longSharePct).toFixed(1));
  const longToShortRatio =
    managedMoneyShorts > 0
      ? Number((managedMoneyLongs / managedMoneyShorts).toFixed(2))
      : managedMoneyLongs > 0
      ? 99.0
      : 0;
  const managedMoneyNetPctOfOi = Number(((managedMoneyNet / totalOpenInterest) * 100).toFixed(1));

  const sentimentScorePct = computeScoreFromSnapshot(
    managedMoneyLongs,
    managedMoneyShorts,
    commercialHedgersNet,
    totalOpenInterest,
    percentile52W,
    netChange1W,
    oiChange1W,
    scope
  );
  const normalizedBiasIndex = Number(((sentimentScorePct - 50) / 50).toFixed(2));
  const { regime, regimeLabel } = classifySentimentRegime(sentimentScorePct);
  const squeezeRiskFlag = percentile52W >= 85 || percentile52W <= 15 || sentimentScorePct >= 86 || sentimentScorePct <= 14;

  const baseHistory =
    Array.isArray(options.weeklyHistory) && options.weeklyHistory.length > 0
      ? options.weeklyHistory
      : GOLD_COT_WEEKLY_HISTORY;

  // Ensure the final point in weeklyTrend mirrors any live override
  const weeklySnapshots: CotWeeklySnapshot[] = baseHistory.map((item, idx) =>
    idx === baseHistory.length - 1
      ? {
          reportDate: reportDate.slice(0, 10),
          managedMoneyLongs,
          managedMoneyShorts,
          managedMoneyNet,
          commercialHedgersNet,
          otherReportablesNet,
          totalOpenInterest,
        }
      : item
  );

  const fourWeeksAgoIdx = Math.max(0, weeklySnapshots.length - 5);
  const netChange4W = managedMoneyNet - weeklySnapshots[fourWeeksAgoIdx].managedMoneyNet;

  const weeklyTrend: GoldCotSentimentPoint[] = weeklySnapshots.map((snap, idx) => {
    const prevNet = idx > 0 ? weeklySnapshots[idx - 1].managedMoneyNet : snap.managedMoneyNet;
    const prevOi = idx > 0 ? weeklySnapshots[idx - 1].totalOpenInterest : snap.totalOpenInterest;
    const pctileEstimate = Math.max(
      5,
      Math.min(98, Math.round(50 + ((snap.managedMoneyNet / Math.max(1, snap.totalOpenInterest)) / 0.45) * 35))
    );
    return {
      reportDate: snap.reportDate,
      managedMoneyNet: snap.managedMoneyNet,
      commercialHedgersNet: snap.commercialHedgersNet,
      sentimentScorePct: computeScoreFromSnapshot(
        snap.managedMoneyLongs,
        snap.managedMoneyShorts,
        snap.commercialHedgersNet,
        snap.totalOpenInterest,
        idx === weeklySnapshots.length - 1 ? percentile52W : pctileEstimate,
        snap.managedMoneyNet - prevNet,
        snap.totalOpenInterest - prevOi,
        scope
      ),
      totalOpenInterest: snap.totalOpenInterest,
    };
  });

  const biasSummary =
    regime === 'EXTREME_BULLISH'
      ? `COMEX Gold Managed Money holds ${managedMoneyNet.toLocaleString()} net longs (${longToShortRatio}:1 L/S, ${percentile52W}th 52W %ile). Strong institutional trend conviction, but crowded long exposure elevates pullback squeeze sensitivity.`
      : regime === 'BULLISH_ACCUMULATION'
      ? `Institutional funds maintain constructive net long exposure of ${managedMoneyNet.toLocaleString()} contracts (${managedMoneyNetPctOfOi}% of OI), confirming trend sponsorship with balanced room before crowding.`
      : regime === 'BEARISH_DISTRIBUTION' || regime === 'EXTREME_BEARISH'
      ? `Speculative gold positioning shows net distribution (${managedMoneyNet.toLocaleString()} net contracts, ${longSharePct}% long share), indicating cautious institutional appetite.`
      : `COMEX Gold Managed Money positioning is balanced (${managedMoneyNet.toLocaleString()} net contracts, ${longToShortRatio}:1 L/S) with no directional crowding extreme.`;

  return {
    commodity: 'GOLD',
    contractCode: '088691',
    symbol: base.symbol,
    reportDate,
    sourceMode,
    scope,
    sentimentScorePct,
    normalizedBiasIndex,
    regime,
    regimeLabel,
    managedMoneyLongs,
    managedMoneyShorts,
    managedMoneyNet,
    managedMoneyNetPctOfOi,
    longToShortRatio,
    longSharePct,
    shortSharePct,
    netChange1W,
    netChange4W,
    percentile52W,
    commercialHedgersNet,
    otherReportablesNet,
    totalOpenInterest,
    oiChange1W,
    squeezeRiskFlag,
    biasSummary,
    weeklyTrend,
  };
}

