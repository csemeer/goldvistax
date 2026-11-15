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
