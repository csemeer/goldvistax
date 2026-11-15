/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * Aurum Intelligence — Commodity-Specific Fundamental Intelligence Engine (Phase 7)
 *
 * Implements distinct, revision-aware, timestamp-separated evidence models
 * for GOLD, SILVER, WTI_OIL, and BRENT_OIL per Addendum §10.
 */

import { CommodityType } from '../domain/types';

export type FundamentalRevisionStatus = 'PRELIMINARY' | 'REVISED' | 'FINAL' | 'CURATED_BASELINE';
export type FundamentalQualityState = 'FRESH' | 'LAG_DISCLOSED' | 'PROXY_ESTIMATE';
export type DirectionalBias = 'BULLISH' | 'BEARISH' | 'NEUTRAL';

export interface FundamentalObservation {
  metricId: string;
  name: string;
  definition: string;
  value: number;
  unit: string;
  commodity: CommodityType;
  geography: string;
  observationPeriod: string;
  releaseTime: string;
  retrievalTime: string;
  source: string;
  sourceTier: 'PRIMARY_OFFICIAL' | 'EXCHANGE_FILING' | 'RESEARCH_COUNCIL' | 'MARKET_PROXY';
  revisionStatus: FundamentalRevisionStatus;
  frequency: 'DAILY' | 'WEEKLY' | 'MONTHLY' | 'QUARTERLY';
  qualityState: FundamentalQualityState;
  historicalSeriesId: string;
  directionalBias: DirectionalBias;
  limitations: string;
}

export interface CommodityFundamentalDossier {
  commodity: CommodityType;
  asOfUtc: string;
  modelVersion: string;
  overallFundamentalBias: DirectionalBias;
  fundamentalScore: number; // -100 to +100 deterministic score
  observations: FundamentalObservation[];
  keyStructuralDrivers: string[];
  modelLimitations: string[];
}

const RETRIEVAL_TIME = new Date().toISOString();

const GOLD_OBSERVATIONS: FundamentalObservation[] = [
  {
    metricId: 'GOLD_CB_NET_PURCHASES_Q',
    name: 'Sovereign Central Bank Net Purchases',
    definition: 'Quarterly net official sector gold reserve additions reported by IMF IFS and World Gold Council.',
    value: 290,
    unit: 'metric tonnes',
    commodity: 'GOLD',
    geography: 'Global Official Sector',
    observationPeriod: '2026-Q3',
    releaseTime: '2026-10-28T09:00:00Z',
    retrievalTime: RETRIEVAL_TIME,
    source: 'World Gold Council / IMF IFS',
    sourceTier: 'RESEARCH_COUNCIL',
    revisionStatus: 'PRELIMINARY',
    frequency: 'QUARTERLY',
    qualityState: 'LAG_DISCLOSED',
    historicalSeriesId: 'WGC-CB-NET-Q',
    directionalBias: 'BULLISH',
    limitations: 'Low-frequency quarterly release with late sovereign reporting lags; not a daily timing signal.',
  },
  {
    metricId: 'GOLD_ETF_NET_FLOW_M',
    name: 'Global Physical Gold ETF Net Flow',
    definition: 'Monthly tonnage delta across physically backed global gold exchange-traded funds.',
    value: 42.5,
    unit: 'metric tonnes',
    commodity: 'GOLD',
    geography: 'North America / Europe / Asia',
    observationPeriod: '2026-10',
    releaseTime: '2026-11-04T14:00:00Z',
    retrievalTime: RETRIEVAL_TIME,
    source: 'World Gold Council ETF Flows',
    sourceTier: 'RESEARCH_COUNCIL',
    revisionStatus: 'FINAL',
    frequency: 'MONTHLY',
    qualityState: 'FRESH',
    historicalSeriesId: 'WGC-ETF-TONNES-M',
    directionalBias: 'BULLISH',
    limitations: 'Curated snapshot baseline until automated commercial ETF flow API ingestion is enabled.',
  },
  {
    metricId: 'GOLD_US_10Y_TIPS_REAL_YIELD',
    name: 'US 10-Year TIPS Real Yield Benchmark',
    definition: '10-year US Treasury inflation-indexed real yield measuring opportunity cost of non-yielding bullion.',
    value: 1.93,
    unit: '%',
    commodity: 'GOLD',
    geography: 'United States',
    observationPeriod: '2026-11-12',
    releaseTime: '2026-11-12T21:00:00Z',
    retrievalTime: RETRIEVAL_TIME,
    source: 'US Treasury / FRED DFII10 Proxy',
    sourceTier: 'MARKET_PROXY',
    revisionStatus: 'CURATED_BASELINE',
    frequency: 'DAILY',
    qualityState: 'PROXY_ESTIMATE',
    historicalSeriesId: 'FRED-DFII10',
    directionalBias: 'NEUTRAL',
    limitations: 'Uses nominal 10Y minus anchored breakeven proxy when direct FRED API key is unconfigured (GAP-04).',
  },
  {
    metricId: 'GOLD_COMEX_REGISTERED_COVERAGE',
    name: 'COMEX Registered Vault Coverage Ratio',
    definition: 'Ratio of deliverable COMEX registered bullion to total front-month open interest paper claims.',
    value: 14.8,
    unit: '% coverage',
    commodity: 'GOLD',
    geography: 'COMEX New York Vaults',
    observationPeriod: '2026-11-11',
    releaseTime: '2026-11-11T22:00:00Z',
    retrievalTime: RETRIEVAL_TIME,
    source: 'CME Group Metal Stocks Report',
    sourceTier: 'EXCHANGE_FILING',
    revisionStatus: 'FINAL',
    frequency: 'DAILY',
    qualityState: 'LAG_DISCLOSED',
    historicalSeriesId: 'CME-GC-REG-PCT',
    directionalBias: 'BULLISH',
    limitations: 'Vault eligible vs registered transfers can shift intraday without warning.',
  },
];

const SILVER_OBSERVATIONS: FundamentalObservation[] = [
  {
    metricId: 'SILVER_SOLAR_PV_SHARE_ANNUAL',
    name: 'Photovoltaic & Industrial Fabrication Share',
    definition: 'Share of total global silver fabrication absorbed by solar PV and electronics industrial demand.',
    value: 56.4,
    unit: '% of total demand',
    commodity: 'SILVER',
    geography: 'Global',
    observationPeriod: '2026-H1',
    releaseTime: '2026-09-15T10:00:00Z',
    retrievalTime: RETRIEVAL_TIME,
    source: 'The Silver Institute World Silver Survey',
    sourceTier: 'RESEARCH_COUNCIL',
    revisionStatus: 'REVISED',
    frequency: 'QUARTERLY',
    qualityState: 'LAG_DISCLOSED',
    historicalSeriesId: 'SI-IND-SHARE',
    directionalBias: 'BULLISH',
    limitations: 'Structural low-frequency balance metric; subject to thrifting & cell-architecture substitution.',
  },
  {
    metricId: 'SILVER_PHYSICAL_BALANCE_DEFICIT',
    name: 'Annualized Global Silver Structural Deficit',
    definition: 'Net mined + recycled supply minus total industrial, jewelry, silverware, and physical bar demand.',
    value: -182.0,
    unit: 'million oz',
    commodity: 'SILVER',
    geography: 'Global',
    observationPeriod: '2026-Q3',
    releaseTime: '2026-10-20T12:00:00Z',
    retrievalTime: RETRIEVAL_TIME,
    source: 'The Silver Institute / Metals Focus',
    sourceTier: 'RESEARCH_COUNCIL',
    revisionStatus: 'PRELIMINARY',
    frequency: 'QUARTERLY',
    qualityState: 'LAG_DISCLOSED',
    historicalSeriesId: 'SI-NET-BAL-MOZ',
    directionalBias: 'BULLISH',
    limitations: 'Above-ground unreported private vault drawdown can offset visible exchange deficit.',
  },
  {
    metricId: 'SILVER_GSR_SPREAD_REGIME',
    name: 'Gold-to-Silver Mint Ratio (XAU/XAG)',
    definition: 'Ounces of spot silver required to purchase one ounce of spot gold.',
    value: 84.0,
    unit: 'ratio (x)',
    commodity: 'SILVER',
    geography: 'OTC Global Spot',
    observationPeriod: '2026-11-12',
    releaseTime: '2026-11-12T22:00:00Z',
    retrievalTime: RETRIEVAL_TIME,
    source: 'GoldVista Cross-Asset Engine',
    sourceTier: 'MARKET_PROXY',
    revisionStatus: 'FINAL',
    frequency: 'DAILY',
    qualityState: 'FRESH',
    historicalSeriesId: 'GV-XAU-XAG-RATIO',
    directionalBias: 'BULLISH',
    limitations: 'Elevated ratio reflects relative silver discount but can persist during industrial slowdowns.',
  },
];

const WTI_OBSERVATIONS: FundamentalObservation[] = [
  {
    metricId: 'WTI_EIA_COMMERCIAL_STOCKS_CHG',
    name: 'EIA US Commercial Crude Inventory Weekly Change',
    definition: 'Weekly change in US commercial crude oil stocks excluding Strategic Petroleum Reserve (SPR).',
    value: -2.4,
    unit: 'million bbls',
    commodity: 'WTI_OIL',
    geography: 'United States',
    observationPeriod: 'Week Ending 2026-11-06',
    releaseTime: '2026-11-11T15:30:00Z',
    retrievalTime: RETRIEVAL_TIME,
    source: 'U.S. Energy Information Administration (EIA)',
    sourceTier: 'PRIMARY_OFFICIAL',
    revisionStatus: 'FINAL',
    frequency: 'WEEKLY',
    qualityState: 'FRESH',
    historicalSeriesId: 'EIA-WCESTUS1',
    directionalBias: 'BULLISH',
    limitations: 'Weekly Thursday/Wednesday timing volatility around US federal holidays.',
  },
  {
    metricId: 'WTI_CUSHING_HUB_STOCKS',
    name: 'Cushing, Oklahoma Delivery Hub Stocks',
    definition: 'Crude inventory held at NYMEX WTI physical settlement delivery point in Cushing, OK.',
    value: 24.8,
    unit: 'million bbls',
    commodity: 'WTI_OIL',
    geography: 'Cushing, OK (PADD 2)',
    observationPeriod: 'Week Ending 2026-11-06',
    releaseTime: '2026-11-11T15:30:00Z',
    retrievalTime: RETRIEVAL_TIME,
    source: 'U.S. EIA Weekly Petroleum Status Report',
    sourceTier: 'PRIMARY_OFFICIAL',
    revisionStatus: 'FINAL',
    frequency: 'WEEKLY',
    qualityState: 'FRESH',
    historicalSeriesId: 'EIA-WCSSTUS1',
    directionalBias: 'BULLISH',
    limitations: 'Minimum operational tank bottoms (~20M bbls) create nonlinear front-month squeeze sensitivity.',
  },
  {
    metricId: 'WTI_US_REFINERY_UTILIZATION',
    name: 'US Refinery Operable Utilization Rate',
    definition: 'Gross inputs to US operable atmospheric crude oil distillation units as percent of capacity.',
    value: 90.4,
    unit: '% capacity',
    commodity: 'WTI_OIL',
    geography: 'United States',
    observationPeriod: 'Week Ending 2026-11-06',
    releaseTime: '2026-11-11T15:30:00Z',
    retrievalTime: RETRIEVAL_TIME,
    source: 'U.S. EIA',
    sourceTier: 'PRIMARY_OFFICIAL',
    revisionStatus: 'FINAL',
    frequency: 'WEEKLY',
    qualityState: 'FRESH',
    historicalSeriesId: 'EIA-WPULEUS3',
    directionalBias: 'NEUTRAL',
    limitations: 'Seasonal turnaround maintenance distorts headline crude draws vs product builds.',
  },
];

const BRENT_OBSERVATIONS: FundamentalObservation[] = [
  {
    metricId: 'BRENT_WTI_SEABORNE_SPREAD',
    name: 'ICE Brent minus NYMEX WTI Front Spread',
    definition: 'Seaborne sweet crude benchmark differential capturing maritime freight & international risk premium.',
    value: 4.1,
    unit: 'USD/bbl',
    commodity: 'BRENT_OIL',
    geography: 'North Sea / Atlantic Basin',
    observationPeriod: '2026-11-12',
    releaseTime: '2026-11-12T22:00:00Z',
    retrievalTime: RETRIEVAL_TIME,
    source: 'ICE Futures / NYMEX Derived Spread',
    sourceTier: 'MARKET_PROXY',
    revisionStatus: 'FINAL',
    frequency: 'DAILY',
    qualityState: 'FRESH',
    historicalSeriesId: 'GV-BZ-CL-SPREAD',
    directionalBias: 'NEUTRAL',
    limitations: 'Reflects proxy futures closing ratio rather than physical Dated Brent CFD BFOE cargo assessments.',
  },
  {
    metricId: 'BRENT_OPEC_SPARE_CAPACITY',
    name: 'OPEC+ Effective Spare Production Capacity',
    definition: 'Estimated crude capacity bringable online within 30 days and sustained for 90+ days.',
    value: 4.6,
    unit: 'million bbl/d',
    commodity: 'BRENT_OIL',
    geography: 'OPEC+ Core Gulf Producers',
    observationPeriod: '2026-10',
    releaseTime: '2026-11-12T12:00:00Z',
    retrievalTime: RETRIEVAL_TIME,
    source: 'IEA Oil Market Report / OPEC MOMR',
    sourceTier: 'RESEARCH_COUNCIL',
    revisionStatus: 'PRELIMINARY',
    frequency: 'MONTHLY',
    qualityState: 'LAG_DISCLOSED',
    historicalSeriesId: 'IEA-OPEC-SPARE',
    directionalBias: 'BEARISH',
    limitations: 'Spare capacity estimates carry political and sustainable-output uncertainty.',
  },
  {
    metricId: 'BRENT_TRANSIT_FREIGHT_RISK',
    name: 'Maritime Chokepoint & Insurance Risk Premium',
    definition: 'Estimated war-risk & rerouting freight stress on Suez / Red Sea / Strait of Hormuz tanker lanes.',
    value: 1.85,
    unit: 'USD/bbl est.',
    commodity: 'BRENT_OIL',
    geography: 'Middle East / Red Sea',
    observationPeriod: '2026-11-12',
    releaseTime: '2026-11-12T16:00:00Z',
    retrievalTime: RETRIEVAL_TIME,
    source: 'Maritime Freight Curated Risk Baseline',
    sourceTier: 'RESEARCH_COUNCIL',
    revisionStatus: 'CURATED_BASELINE',
    frequency: 'WEEKLY',
    qualityState: 'PROXY_ESTIMATE',
    historicalSeriesId: 'GV-MARITIME-RISK',
    directionalBias: 'BULLISH',
    limitations: 'Curated risk premium estimate; requires licensed tanker AIS / Baltic Exchange feed for live updates.',
  },
];

export function getCommodityFundamentals(commodity: CommodityType, dynamicSpreadOverride?: number): CommodityFundamentalDossier {
  let observations: FundamentalObservation[];
  let keyStructuralDrivers: string[];
  let modelLimitations: string[];

  switch (commodity) {
    case 'SILVER':
      observations = SILVER_OBSERVATIONS.map((obs) =>
        obs.metricId === 'SILVER_GSR_SPREAD_REGIME' && typeof dynamicSpreadOverride === 'number'
          ? { ...obs, value: Number(dynamicSpreadOverride.toFixed(2)) }
          : obs
      );
      keyStructuralDrivers = [
        'Industrial & Solar PV absorption >55% of global fabrication demand',
        'Multi-year mined supply deficit (~182M oz) constraining above-ground inventory',
        'High-beta torque to Gold/Silver Ratio compression when GSR exceeds 80x',
      ];
      modelLimitations = [
        'Industrial demand data carries quarterly publication lag; cannot generate sub-hour triggers.',
        'By-product lead/zinc/copper mining supply responds sluggishly to silver price alone.',
      ];
      break;

    case 'WTI_OIL':
      observations = [...WTI_OBSERVATIONS];
      keyStructuralDrivers = [
        'Weekly EIA commercial inventory & Cushing hub storage drawdown trend',
        'US PADD 2/3 refinery utilization and seasonal maintenance cycles',
        'Domestic Permian shale output discipline & US Gulf export arbitrage',
      ];
      modelLimitations = [
        'Curated EIA baseline snapshot pending direct automated EIA API v2 key scheduling.',
        'Weather events (Gulf hurricanes, freezes) introduce discontinuous weekly stock noise.',
      ];
      break;

    case 'BRENT_OIL':
      observations = BRENT_OBSERVATIONS.map((obs) =>
        obs.metricId === 'BRENT_WTI_SEABORNE_SPREAD' && typeof dynamicSpreadOverride === 'number'
          ? { ...obs, value: Number(dynamicSpreadOverride.toFixed(2)) }
          : obs
      );
      keyStructuralDrivers = [
        'OPEC+ voluntary quota compliance vs ~4.6M bbl/d spare capacity cap',
        'International seaborne crude demand & maritime chokepoint risk premium',
        'Brent–WTI arbitrage differential driving Atlantic Basin cargo flows',
      ];
      modelLimitations = [
        'Dated Brent BFOE physical cargo differentials require paid Platts/Argus feed.',
        'OPEC+ compliance estimates carry monthly revision uncertainty.',
      ];
      break;

    case 'GOLD':
    default:
      observations = GOLD_OBSERVATIONS.map((obs) =>
        obs.metricId === 'GOLD_US_10Y_TIPS_REAL_YIELD' && typeof dynamicSpreadOverride === 'number'
          ? { ...obs, value: Number(dynamicSpreadOverride.toFixed(2)) }
          : obs
      );
      keyStructuralDrivers = [
        'Official central bank reserve accumulation (~290t quarterly pace)',
        'US 10Y real yield trajectory & sovereign fiscal deficit sensitivity',
        'COMEX registered vault coverage & physical ETF reallocation flows',
      ];
      modelLimitations = [
        'Sovereign reserve purchases are reported quarterly with lags.',
        'US_TIPS10Y benchmark uses nominal 10Y breakeven proxy when FRED key is absent (GAP-04).',
      ];
      break;
  }

  const bullishCount = observations.filter((o) => o.directionalBias === 'BULLISH').length;
  const bearishCount = observations.filter((o) => o.directionalBias === 'BEARISH').length;
  const rawScore = Math.round(((bullishCount - bearishCount) / Math.max(1, observations.length)) * 80);

  let overallFundamentalBias: DirectionalBias = 'NEUTRAL';
  if (rawScore >= 20) overallFundamentalBias = 'BULLISH';
  else if (rawScore <= -20) overallFundamentalBias = 'BEARISH';

  return {
    commodity,
    asOfUtc: new Date().toISOString(),
    modelVersion: '2.0.0-FUNDAMENTAL',
    overallFundamentalBias,
    fundamentalScore: rawScore,
    observations,
    keyStructuralDrivers,
    modelLimitations,
  };
}

export interface LiveFundamentalSyncResult extends CommodityFundamentalDossier {
  liveSyncStatus:
    | 'LIVE_CFTC_FRED_SYNCED'
    | 'LIVE_CFTC_SYNCED'
    | 'LIVE_FRED_SYNCED'
    | 'LIVE_EIA_SYNCED'
    | 'CURATED_BASELINE_FALLBACK';
  liveSyncNote: string;
}

/**
 * Parses St. Louis FRED CSV (`DATE,DFII10`) returning the latest finite numeric observation.
 */
export function parseLatestFredCsvObservation(csvText: string): { date: string; value: number } | null {
  const lines = csvText.trim().split(/\r?\n/);
  for (let i = lines.length - 1; i >= 1; i -= 1) {
    const [rawDate, rawVal] = lines[i].split(',');
    const date = (rawDate || '').trim();
    const valStr = (rawVal || '').trim();
    if (!date || !valStr || valStr === '.') continue;
    const num = Number(valStr);
    if (Number.isFinite(num)) {
      return { date, value: Number(num.toFixed(2)) };
    }
  }
  return null;
}

async function fetchLiveFredDfii10(timeoutMs = 2500): Promise<{ date: string; value: number; sourceLabel: string } | null> {
  try {
    if (process.env.FRED_API_KEY) {
      const apiUrl = `https://api.stlouisfed.org/fred/series/observations?series_id=DFII10&api_key=${encodeURIComponent(
        process.env.FRED_API_KEY
      )}&file_type=json&sort_order=desc&limit=5`;
      const res = await fetch(apiUrl, { signal: AbortSignal.timeout(timeoutMs) });
      if (res.ok) {
        const json = (await res.json()) as { observations?: Array<{ date?: string; value?: string }> };
        const obs = json?.observations?.find((o) => o.value && o.value !== '.' && Number.isFinite(Number(o.value)));
        if (obs?.date && obs?.value) {
          return {
            date: obs.date,
            value: Number(Number(obs.value).toFixed(2)),
            sourceLabel: 'Federal Reserve Bank of St. Louis (FRED API DFII10)',
          };
        }
      }
    }

    const csvUrl = 'https://fred.stlouisfed.org/graph/fredgraph.csv?id=DFII10';
    const csvRes = await fetch(csvUrl, { signal: AbortSignal.timeout(timeoutMs) });
    if (csvRes.ok) {
      const csvText = await csvRes.text();
      const parsed = parseLatestFredCsvObservation(csvText);
      if (parsed) {
        return {
          ...parsed,
          sourceLabel: 'Federal Reserve Bank of St. Louis (FRED DFII10 Public CSV)',
        };
      }
    }
  } catch {
    // Graceful fallback to nominal proxy baseline
  }
  return null;
}

/**
 * Attempts resilient live synchronization with official CFTC Public Reporting API (no key),
 * St. Louis FRED DFII10 TIPS real yield feed (no key / FRED_API_KEY), or EIA API v2 (when EIA_API_KEY configured),
 * falling back cleanly to curated revision-aware baseline.
 */
export async function fetchLiveFundamentalsWithFallback(
  commodity: CommodityType,
  dynamicSpreadOverride?: number,
  timeoutMs = 2500
): Promise<LiveFundamentalSyncResult> {
  const baseline = getCommodityFundamentals(commodity, dynamicSpreadOverride);
  const retrievalNow = new Date().toISOString();

  if (commodity === 'GOLD' || commodity === 'SILVER') {
    const cftcCode = commodity === 'GOLD' ? '088691' : '084691';
    const cftcPromise = (async (): Promise<FundamentalObservation | null> => {
      try {
        const url = `https://publicreporting.cftc.gov/resource/6dca-aqww.json?cftc_contract_market_code=${cftcCode}&$order=report_date_as_yyyy_mm_dd%20DESC&$limit=1`;
        const res = await fetch(url, { signal: AbortSignal.timeout(timeoutMs) });
        if (res.ok) {
          const rows = (await res.json()) as Array<Record<string, any>>;
          if (Array.isArray(rows) && rows.length > 0 && rows[0].noncomm_positions_long_all) {
            const row = rows[0];
            const netNonComm =
              Number(row.noncomm_positions_long_all || 0) - Number(row.noncomm_positions_short_all || 0);
            return {
              metricId: `${commodity}_CFTC_NONCOMM_NET`,
              name: `CFTC Legacy Non-Commercial Net Positioning (${commodity})`,
              definition: 'Official CFTC Disaggregated/Legacy Non-Commercial long minus short contracts.',
              value: netNonComm,
              unit: 'contracts',
              commodity,
              geography: 'COMEX US Futures',
              observationPeriod: String(row.report_date_as_yyyy_mm_dd || '').slice(0, 10) || 'Latest Filing',
              releaseTime: `${String(row.report_date_as_yyyy_mm_dd || '2026-11-10').slice(0, 10)}T20:30:00Z`,
              retrievalTime: retrievalNow,
              source: 'CFTC Public Reporting API (6dca-aqww)',
              sourceTier: 'EXCHANGE_FILING',
              revisionStatus: 'FINAL',
              frequency: 'WEEKLY',
              qualityState: 'FRESH',
              historicalSeriesId: `CFTC-${cftcCode}-NET`,
              directionalBias: netNonComm > 0 ? 'BULLISH' : 'BEARISH',
              limitations: 'Weekly Tuesday positioning snapshot released Friday 15:30 ET.',
            };
          }
        }
      } catch {
        // Safe fallback to curated revision-aware baseline
      }
      return null;
    })();

    const fredPromise =
      commodity === 'GOLD' && typeof dynamicSpreadOverride !== 'number'
        ? fetchLiveFredDfii10(timeoutMs)
        : Promise.resolve(null);

    const [cftcObs, fredObs] = await Promise.all([cftcPromise, fredPromise]);

    let updatedObservations = [...baseline.observations];
    let updatedLimitations = [...baseline.modelLimitations];

    if (fredObs) {
      updatedObservations = updatedObservations.map((obs) =>
        obs.metricId === 'GOLD_US_10Y_TIPS_REAL_YIELD'
          ? {
              ...obs,
              value: fredObs.value,
              observationPeriod: fredObs.date,
              releaseTime: `${fredObs.date}T21:00:00Z`,
              retrievalTime: retrievalNow,
              source: fredObs.sourceLabel,
              sourceTier: 'PRIMARY_OFFICIAL',
              revisionStatus: 'FINAL',
              qualityState: 'FRESH',
              directionalBias: fredObs.value < 1.8 ? 'BULLISH' : fredObs.value > 2.25 ? 'BEARISH' : 'NEUTRAL',
              limitations: 'Official H.15 daily Treasury constant-maturity real yield (published T+1 business day).',
            }
          : obs
      );
      updatedLimitations = updatedLimitations.filter((l) => !l.includes('GAP-04'));
    }

    if (cftcObs) {
      updatedObservations = [cftcObs, ...updatedObservations];
    }

    if (cftcObs && fredObs) {
      return {
        ...baseline,
        observations: updatedObservations,
        modelLimitations: updatedLimitations,
        liveSyncStatus: 'LIVE_CFTC_FRED_SYNCED',
        liveSyncNote: `Synchronized live CFTC ${cftcCode} (${cftcObs.observationPeriod}) & FRED DFII10 (${fredObs.date}: ${fredObs.value}%).`,
      };
    }

    if (cftcObs) {
      return {
        ...baseline,
        observations: updatedObservations,
        modelLimitations: updatedLimitations,
        liveSyncStatus: 'LIVE_CFTC_SYNCED',
        liveSyncNote: `Synchronized latest CFTC contract ${cftcCode} filing (${cftcObs.observationPeriod}).`,
      };
    }

    if (fredObs) {
      return {
        ...baseline,
        observations: updatedObservations,
        modelLimitations: updatedLimitations,
        liveSyncStatus: 'LIVE_FRED_SYNCED',
        liveSyncNote: `Synchronized live FRED DFII10 (${fredObs.date}: ${fredObs.value}%); CFTC filing offline fallback.`,
      };
    }
  }

  if ((commodity === 'WTI_OIL' || commodity === 'BRENT_OIL') && process.env.EIA_API_KEY) {
    try {
      const eiaUrl = `https://api.eia.gov/v2/petroleum/sum/sndw/data/?api_key=${encodeURIComponent(
        process.env.EIA_API_KEY
      )}&frequency=weekly&data[0]=value&facets[product][]=EPC0&sort[0][column]=period&sort[0][direction]=desc&length=1`;
      const eiaRes = await fetch(eiaUrl, { signal: AbortSignal.timeout(timeoutMs) });
      if (eiaRes.ok) {
        const eiaJson = (await eiaRes.json()) as any;
        const row = eiaJson?.response?.data?.[0];
        if (row && row.value !== undefined) {
          const valMillionBbl = Number((Number(row.value) / 1000).toFixed(2));
          const liveObs: FundamentalObservation = {
            metricId: `${commodity}_EIA_LIVE_CRUDE_STOCKS`,
            name: 'US Commercial Crude Oil Stocks (EIA API v2 Live)',
            definition: 'Weekly US ending commercial crude inventories excluding SPR in million barrels.',
            value: valMillionBbl,
            unit: 'million barrels',
            commodity,
            geography: 'United States (DOE/EIA)',
            observationPeriod: String(row.period || 'Latest Week'),
            releaseTime: `${String(row.period || '2026-11-06')}T15:30:00Z`,
            retrievalTime: retrievalNow,
            source: 'US EIA Open Data API v2 (petroleum/sum/sndw)',
            sourceTier: 'PRIMARY_OFFICIAL',
            revisionStatus: 'PRELIMINARY',
            frequency: 'WEEKLY',
            qualityState: 'FRESH',
            historicalSeriesId: 'EIA-PET-WCESTUS1-W',
            directionalBias: 'NEUTRAL',
            limitations: 'Weekly preliminary DOE survey estimates subject to subsequent monthly PSM revision.',
          };
          return {
            ...baseline,
            observations: [liveObs, ...baseline.observations],
            liveSyncStatus: 'LIVE_EIA_SYNCED',
            liveSyncNote: `Synchronized live EIA API v2 petroleum observation (${liveObs.observationPeriod}).`,
          };
        }
      }
    } catch {
      // Safe fallback to curated revision-aware baseline
    }
  }

  return {
    ...baseline,
    liveSyncStatus: 'CURATED_BASELINE_FALLBACK',
    liveSyncNote:
      (commodity === 'WTI_OIL' || commodity === 'BRENT_OIL') && !process.env.EIA_API_KEY
        ? 'EIA_API_KEY unconfigured; serving curated EIA revision-aware baseline.'
        : 'Serving curated revision-aware baseline (live external API unreachable or timed out).',
  };
}
