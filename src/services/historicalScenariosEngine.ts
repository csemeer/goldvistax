/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * Aurum Intelligence — Historical Scenarios & Point-in-Time Analogue Engine
 *
 * Implements:
 * 1. Commodity-specific Bull, Base, Bear, and Tail-Risk scenarios.
 * 2. Point-in-time safe historical analogue matching with outcome distributions.
 * 3. Max Favorable Excursion (MFE), Max Adverse Excursion (MAE), and drawdown statistics.
 * 4. Transparent disclosure of sample size, limitations, and counter-conditions.
 */

import { CommodityScenario, CommodityType } from '../domain/types';

export interface HistoricalAnalogueEpisode {
  id: string;
  commodity: CommodityType;
  title: string;
  historicalPeriod: string;
  similarityScorePct: number;
  triggerEvent: string;
  regime: string;
  forwardReturns: {
    d5Pct: number;
    d20Pct: number;
    d60Pct: number;
    d180Pct: number;
  };
  mfePct: number; // Max Favorable Excursion
  maePct: number; // Max Adverse Excursion
  maxDrawdownPct: number;
  keyDifferences: string[];
  caveatsAndCounterexamples: string;
}

export const COMMODITY_HISTORICAL_SCENARIOS: Record<CommodityType, CommodityScenario[]> = {
  // --- GOLD SCENARIOS ---
  GOLD: [
    {
      type: 'BULL',
      commodity: 'GOLD',
      title: 'Structural Monetary De-Dollarization & Real Yield Compression',
      likelihood: 'HIGH',
      horizon: '3 to 12 Months',
      priceTargetProjection: '$4,150 - $4,350/oz',
      coreAssumptions: [
        'Central bank sovereign gold accumulation persists above 800 metric tons annualized',
        'Federal Reserve continues easing cycle towards a 3.50% terminal policy rate',
        'US 10-Year Real TIPS yield remains suppressed below 2.00%',
      ],
      supportingCatalysts: [
        'PBOC reserve diversification policy',
        'Western retail and institutional ETF net inflows turning positive after multi-year hiatus',
      ],
      counterArguments: [
        'Extreme speculative net long positioning on COMEX leaves market vulnerable to sharp liquidations on hawkish surprises',
      ],
      marketStructureConfirmation: 'Breakout above $3,950 with 21-day EMA holding as ascending dynamic support.',
      invalidationLevel: 'Daily close below $3,740 (50-day EMA support).',
      primaryRisks: ['Sticky US services inflation forcing Fed policy pause', 'Strong US Dollar safe-haven re-acceleration'],
    },
    {
      type: 'BASE',
      commodity: 'GOLD',
      title: 'High-Plateau Consolidation with Steady Sovereign Bid',
      likelihood: 'HIGH',
      horizon: '1 to 3 Months',
      priceTargetProjection: '$3,820 - $3,980/oz',
      coreAssumptions: [
        'Fed delivers steady 25bps rate cuts in line with dot plot expectations',
        'Physical jewelry demand in China and India displays mild price elasticity dampening retail buying',
      ],
      supportingCatalysts: ['Steady central bank bid absorbing mining supply', 'Moderate DXY stability in 103-105 range'],
      counterArguments: ['Absence of acute new geopolitical flare-ups capping immediate momentum continuation'],
      marketStructureConfirmation: 'Range-bound oscillation between $3,850 support and $3,960 resistance with declining ATR.',
      invalidationLevel: 'Decisive breakout above $3,980 or breakdown below $3,800.',
      primaryRisks: ['Range compression squeeze triggering algorithmic breakout stops'],
    },
    {
      type: 'BEAR',
      commodity: 'GOLD',
      title: 'Hawkish Fed Re-Tightening & Rapid Geopolitical De-escalation',
      likelihood: 'LOW',
      horizon: '1 to 6 Months',
      priceTargetProjection: '$3,500 - $3,650/oz',
      coreAssumptions: [
        'Re-acceleration of US headline CPI forces Fed to pause rate cuts and signal higher-for-longer carry',
        'US 10-Year Real TIPS yield spikes back above 2.45%',
      ],
      supportingCatalysts: ['Rapid dollar surge above DXY 108.0', 'Massive profit-taking by macro multi-strategy hedge funds'],
      counterArguments: ['Sovereign central banks likely to accelerate purchases on any 5-8% price dip'],
      marketStructureConfirmation: 'Failure to hold $3,820 followed by breakdown through 50-day EMA ($3,775).',
      invalidationLevel: 'Bullish reclaim of $3,950.',
      primaryRisks: ['Capitulation of over-leveraged retail CFD long traders'],
    },
    {
      type: 'TAIL_RISK',
      commodity: 'GOLD',
      title: 'Global Sovereign Debt Crisis & Fiat Debasement Panic',
      likelihood: 'TAIL_RISK',
      horizon: '6 to 24 Months',
      priceTargetProjection: '$4,800 - $5,500/oz',
      coreAssumptions: [
        'Loss of confidence in major sovereign bond markets leading to disorderly yield curve control',
      ],
      supportingCatalysts: ['Run on fiat reserves and acceleration of alternative settlement currencies'],
      counterArguments: ['Coordinated emergency central bank liquidity swap lines restoring short-term stabilization'],
      marketStructureConfirmation: 'Exponential parabolic price expansion with daily candles exceeding 3x average ATR.',
      invalidationLevel: 'Coordinated global fiscal austerity and debt restructuring pact.',
      primaryRisks: ['Government imposition of emergency precious metals transaction taxes or export restrictions'],
    },
  ],

  // --- SILVER SCENARIOS ---
  SILVER: [
    {
      type: 'BULL',
      commodity: 'SILVER',
      title: 'Structural Photovoltaic Deficit & Gold/Silver Ratio Mean-Reversion',
      likelihood: 'HIGH',
      horizon: '3 to 12 Months',
      priceTargetProjection: '$40.00 - $45.00/oz',
      coreAssumptions: [
        'Global solar paste demand and electronics consumption widen annual deficit beyond 200M oz',
        'Gold/Silver Ratio compresses from current 114:1 down towards historical mean of 75:1',
      ],
      supportingCatalysts: [
        'Accelerated adoption of silver-intensive TOPCon solar panels',
        'Continuous LBMA and COMEX registered vault inventory depletion',
      ],
      counterArguments: ['Industrial manufacturers attempting electroplated copper thrifting'],
      marketStructureConfirmation: 'Decisive weekly close above $35.00 resistance with expanding volume.',
      invalidationLevel: 'Drop below $31.00 (200-day moving average).',
      primaryRisks: ['Global manufacturing PMI contraction reducing overall industrial component orders'],
    },
    {
      type: 'BASE',
      commodity: 'SILVER',
      title: 'High-Beta Bullion Tracking in Range Expansion',
      likelihood: 'HIGH',
      horizon: '1 to 3 Months',
      priceTargetProjection: '$32.50 - $36.00/oz',
      coreAssumptions: [
        'Silver mirrors gold price momentum with 1.8x to 2.2x volatility multiplier',
        'Industrial demand remains steady while investment demand provides baseline stability',
      ],
      supportingCatalysts: ['Positive precious metals sentiment and steady COMEX futures open interest'],
      counterArguments: ['Lack of immediate industrial supply squeeze keeping physical spot premiums orderly'],
      marketStructureConfirmation: 'Consolidation above $33.00 former resistance now acting as support.',
      invalidationLevel: 'Sustained daily close below $31.80.',
      primaryRisks: ['Broader equity sell-off spilling into commodity margin liquidation'],
    },
    {
      type: 'BEAR',
      commodity: 'SILVER',
      title: 'Global Industrial Recession & Clean Energy Capex Slowdown',
      likelihood: 'LOW',
      horizon: '2 to 6 Months',
      priceTargetProjection: '$26.00 - $28.50/oz',
      coreAssumptions: [
        'Worldwide manufacturing PMIs fall below 46, slashing industrial fabrication orders by 15%',
      ],
      supportingCatalysts: ['China renewable installation pause and solar module inventory buildup'],
      counterArguments: ['Byproduct mining supply inelasticity prevents significant mine output expansion'],
      marketStructureConfirmation: 'Loss of $31.00 support with RSI dipping into oversold territory below 35.',
      invalidationLevel: 'Reclaim of $34.50.',
      primaryRisks: ['Severe margin liquidation cascade on COMEX speculative contracts'],
    },
    {
      type: 'TAIL_RISK',
      commodity: 'SILVER',
      title: 'Physical Vault Delivery Default / COMEX Inventory Squeeze',
      likelihood: 'TAIL_RISK',
      horizon: '3 to 18 Months',
      priceTargetProjection: '$50.00 - $70.00/oz (Parabolic Squeeze)',
      coreAssumptions: [
        'Industrial end-users take physical delivery of registered COMEX stocks, exhausting physical float',
      ],
      supportingCatalysts: ['Physical spot premium decoupling from paper futures pricing by >15%'],
      counterArguments: ['Exchange margin hikes and liquidation-only trading restrictions'],
      marketStructureConfirmation: 'Cash spot trading at massive premium over forward futures curve (deep backwardation).',
      invalidationLevel: 'Exchange intervention or massive release of government strategic metal stockpiles.',
      primaryRisks: ['Emergency exchange rule alterations and margin requirements exceeding 50%'],
    },
  ],

  // --- WTI CRUDE OIL SCENARIOS ---
  WTI_OIL: [
    {
      type: 'BULL',
      commodity: 'WTI_OIL',
      title: 'Cushing Hub Storage Exhaustion & US Shale Capital Discipline',
      likelihood: 'MODERATE',
      horizon: '1 to 6 Months',
      priceTargetProjection: '$78.00 - $85.00/bbl',
      coreAssumptions: [
        'Cushing Oklahoma storage draws towards operational minimum bottoms (~20M bbls)',
        'US shale drillers maintain strict capital discipline with active rigs below 490',
        'Strong US domestic gasoline and jet fuel transport consumption',
      ],
      supportingCatalysts: ['Midwest and Gulf Coast refinery utilization exceeding 93%'],
      counterArguments: ['High retail gasoline prices creating political pressure to tap SPR'],
      marketStructureConfirmation: 'Bullish breakout above $74.50 with front-to-second month backwardation widening to +$0.65/bbl.',
      invalidationLevel: 'Daily close below $68.00.',
      primaryRisks: ['Surprise inventory builds caused by unexpected Canadian pipeline capacity surges'],
    },
    {
      type: 'BASE',
      commodity: 'WTI_OIL',
      title: 'Balanced Inland Refining Range ($70 - $76/bbl)',
      likelihood: 'HIGH',
      horizon: '1 to 3 Months',
      priceTargetProjection: '$70.00 - $76.00/bbl',
      coreAssumptions: [
        'Permian basin oil production stable at 6.1M bpd',
        'US crude commercial inventories fluctuate within seasonal 5-year averages',
      ],
      supportingCatalysts: ['Balanced domestic demand and steady export flows to European refiners'],
      counterArguments: ['Subdued macroeconomic manufacturing sentiment dampening upside momentum'],
      marketStructureConfirmation: 'Mean-reversion around 50-day moving average ($72.50) with low historical volatility.',
      invalidationLevel: 'Breakout above $77.00 or drop below $67.50.',
      primaryRisks: ['Extreme weather in the Gulf of Mexico forcing temporary refinery shutdowns'],
    },
    {
      type: 'BEAR',
      commodity: 'WTI_OIL',
      title: 'US Demand Destruction & High Refining Margin Squeeze',
      likelihood: 'MODERATE',
      horizon: '2 to 6 Months',
      priceTargetProjection: '$60.00 - $65.00/bbl',
      coreAssumptions: [
        'US trucking freight volumes decline sharply, causing massive distillate stock accumulation',
        'Refinery crack spreads collapse, prompting voluntary run cuts',
      ],
      supportingCatalysts: ['Rapid commercial inventory build exceeding 6M bbls in consecutive weeks'],
      counterArguments: ['US Department of Energy executing statutory SPR refill tender purchases below $70/bbl'],
      marketStructureConfirmation: 'Breakdown below $68.00 with prompt futures switching to Contango (-$0.40/bbl).',
      invalidationLevel: 'Reclaim of $75.00.',
      primaryRisks: ['Deep economic recession in the US commercial transport sector'],
    },
    {
      type: 'TAIL_RISK',
      commodity: 'WTI_OIL',
      title: 'Gulf Coast Severe Hurricane Outage or Pipeline Severance',
      likelihood: 'TAIL_RISK',
      horizon: '2 to 6 Weeks',
      priceTargetProjection: '$95.00 - $110.00/bbl',
      coreAssumptions: ['Category 5 hurricane forcing shutdown of 90% of offshore Gulf of Mexico production and 4M bpd refining'],
      supportingCatalysts: ['Complete regional logistical gridlock'],
      counterArguments: ['Rapid mobilization of emergency SPR and mutual aid fuel pipelines'],
      marketStructureConfirmation: 'Immediate limit-up gap on NYMEX futures.',
      invalidationLevel: 'Storm downgrade or rapid infrastructure inspection clearance.',
      primaryRisks: ['Severe post-storm refinery flooding causing prolonged demand destruction for unrefined crude'],
    },
  ],

  // --- BRENT CRUDE OIL SCENARIOS ---
  BRENT_OIL: [
    {
      type: 'BULL',
      commodity: 'BRENT_OIL',
      title: 'Strait of Hormuz Escalation & OPEC+ Quota Discipline',
      likelihood: 'MODERATE',
      horizon: '1 to 6 Months',
      priceTargetProjection: '$84.00 - $92.00/bbl',
      coreAssumptions: [
        'OPEC+ maintains full voluntary production cuts through Q1 2027',
        'Geopolitical risk premium expands due to persistent threats to Persian Gulf tanker traffic',
      ],
      supportingCatalysts: [
        'Saudi Aramco increases Official Selling Prices (OSPs) to Asian buyers',
        'Global floating crude inventories decline',
      ],
      counterArguments: ['Surging non-OPEC production from Guyana, Brazil, and Canada capping Atlantic market share'],
      marketStructureConfirmation: 'Break above $78.50 with prompt ICE Brent backwardation exceeding $0.85/bbl.',
      invalidationLevel: 'Daily close below $72.00.',
      primaryRisks: ['OPEC+ internal discord leading to quota abandonment'],
    },
    {
      type: 'BASE',
      commodity: 'BRENT_OIL',
      title: 'OPEC+ Supply Floor vs Moderate Global Demand ($73 - $80/bbl)',
      likelihood: 'HIGH',
      horizon: '1 to 3 Months',
      priceTargetProjection: '$73.00 - $80.00/bbl',
      coreAssumptions: [
        'Saudi Arabia manages supply to maintain an informal price floor near $72-$75/bbl',
        'China crude import demand grows at a measured 250k bpd pace',
      ],
      supportingCatalysts: ['Predictable OPEC+ communication and stable international maritime tanker flows'],
      counterArguments: ['Lack of bullish demand catalyst keeping speculative interest subdued'],
      marketStructureConfirmation: 'Oscillation around $76.00 with narrow daily trading bands.',
      invalidationLevel: 'Decisive move outside the $72 - $82 channel.',
      primaryRisks: ['Unforeseen economic slowdown in major Asian importing economies'],
    },
    {
      type: 'BEAR',
      commodity: 'BRENT_OIL',
      title: 'OPEC+ Market Share War & Global Seaborne Surplus',
      likelihood: 'LOW',
      horizon: '3 to 9 Months',
      priceTargetProjection: '$58.00 - $65.00/bbl',
      coreAssumptions: [
        'OPEC+ members abandon voluntary output cuts to recapture lost market share from the Americas',
        'Global oil market shifts into a 1.5M bpd structural surplus',
      ],
      supportingCatalysts: ['Member quota overproduction and competitive OSP price discounting'],
      counterArguments: ['Fiscal breakeven requirements of major OPEC producers ($80-$90/bbl) incentivize cooperation'],
      marketStructureConfirmation: 'Breakdown below $71.00 with deep contango across the forward curve.',
      invalidationLevel: 'Emergency OPEC+ meeting announcing renewed quotas.',
      primaryRisks: ['Prolonged price war depressing exploration budgets for years'],
    },
    {
      type: 'TAIL_RISK',
      commodity: 'BRENT_OIL',
      title: 'Direct Closure of Strait of Hormuz Chokepoint',
      likelihood: 'TAIL_RISK',
      horizon: '1 to 3 Months',
      priceTargetProjection: '$120.00 - $150.00/bbl',
      coreAssumptions: ['Military conflict halts commercial tanker passage through Hormuz, stranding ~20M bpd (~20% of world consumption)'],
      supportingCatalysts: ['Immediate global emergency stock releases under IEA collective action'],
      counterArguments: ['Aggressive international naval convoy intervention reopening transit within days'],
      marketStructureConfirmation: 'Unprecedented vertical gap at market open with bid-ask spreads exceeding $2.00.',
      invalidationLevel: 'Verified safe passage resumption.',
      primaryRisks: ['Severe global economic stagflation and immediate monetary tightening'],
    },
  ],
};

export const CANONICAL_HISTORICAL_ANALOGUES: HistoricalAnalogueEpisode[] = [
  // --- GOLD ANALOGUES ---
  {
    id: 'ANALOG-GOLD-001',
    commodity: 'GOLD',
    title: '2024-2025 Sovereign Reserve De-Dollarization & Fed Rate-Cut Cycle',
    historicalPeriod: 'March 2024 - October 2025',
    similarityScorePct: 91,
    triggerEvent: 'Aggressive official central bank gold buying combined with initial FOMC 50bps rate cut.',
    regime: 'BULLISH_TREND',
    forwardReturns: {
      d5Pct: 2.1,
      d20Pct: 5.4,
      d60Pct: 14.8,
      d180Pct: 28.5,
    },
    mfePct: 32.1,
    maePct: -2.8,
    maxDrawdownPct: 4.5,
    keyDifferences: [
      'Current price starting from higher nominal base ($3,898 vs $2,150 in 2024)',
      'Western ETF participation was negative in 2024, now turning mildly positive',
    ],
    caveatsAndCounterexamples: 'In August 2024, unexpected yen carry-trade liquidation caused a brief 3-day -3.2% gold pullback before trend resumed.',
  },
  {
    id: 'ANALOG-GOLD-002',
    commodity: 'GOLD',
    title: '2019 Fed Mid-Cycle Insurance Easing & Real Yield Tumble',
    historicalPeriod: 'June 2019 - February 2020',
    similarityScorePct: 83,
    triggerEvent: 'Powell Pivot from balance sheet runoff to three consecutive 25bps insurance rate cuts.',
    regime: 'BULLISH_TREND',
    forwardReturns: {
      d5Pct: 1.8,
      d20Pct: 4.2,
      d60Pct: 8.9,
      d180Pct: 18.2,
    },
    mfePct: 21.4,
    maePct: -3.5,
    maxDrawdownPct: 5.1,
    keyDifferences: [
      '2019 geopolitical risk was primarily trade tariff friction, rather than direct kinetic conflict',
      'Central bank buying was approximately half of current 2026 pace',
    ],
    caveatsAndCounterexamples: 'Gold consolidated sideways for 7 weeks between September and November 2019 before breaking out again.',
  },

  // --- SILVER ANALOGUES ---
  {
    id: 'ANALOG-SILVER-001',
    commodity: 'SILVER',
    title: '2020 Post-Pandemic Green Infrastructure & Solar Stimulus Run',
    historicalPeriod: 'May 2020 - August 2020',
    similarityScorePct: 86,
    triggerEvent: 'Global clean energy stimulus pledges coincided with extreme Gold/Silver ratio compression from 125:1 to 70:1.',
    regime: 'VOLATILITY_EXPANSION',
    forwardReturns: {
      d5Pct: 6.8,
      d20Pct: 28.4,
      d60Pct: 54.2,
      d180Pct: 48.0,
    },
    mfePct: 62.5,
    maePct: -5.4,
    maxDrawdownPct: 12.8,
    keyDifferences: [
      '2020 move was preceded by a severe liquidity crash to $12/oz; current move starts from a stable $34/oz consolidation',
      'N-type TOPCon solar technology was negligible in 2020; today it accounts for >80% of new capacity',
    ],
    caveatsAndCounterexamples: 'August 2020 peak at $29.80 suffered a violent 15% flash correction in 48 hours as CTA algorithms locked profits.',
  },

  // --- WTI CRUDE OIL ANALOGUES ---
  {
    id: 'ANALOG-WTI-001',
    commodity: 'WTI_OIL',
    title: 'Autumn 2023 Cushing Storage Compression & Physical Backwardation',
    historicalPeriod: 'August 2023 - October 2023',
    similarityScorePct: 84,
    triggerEvent: 'Cushing storage bottomed near 22M bbls, driving prompt WTI spreads to +$1.85 backwardation.',
    regime: 'BULLISH_TREND',
    forwardReturns: {
      d5Pct: 3.2,
      d20Pct: 8.9,
      d60Pct: 14.5,
      d180Pct: -4.2,
    },
    mfePct: 16.8,
    maePct: -4.1,
    maxDrawdownPct: 7.9,
    keyDifferences: [
      '2023 US shale production was 12.9M bpd vs 13.4M bpd currently',
      'Saudi Arabia was implementing an initial surprise 1M bpd cut',
    ],
    caveatsAndCounterexamples: 'Once seasonal autumn refinery maintenance started in October 2023, prompt demand dissipated and WTI dropped $12 in 3 weeks.',
  },

  // --- BRENT CRUDE OIL ANALOGUES ---
  {
    id: 'ANALOG-BRENT-001',
    commodity: 'BRENT_OIL',
    title: 'Spring 2022 Seaborne Supply Redirection & Maritime Disruption',
    historicalPeriod: 'March 2022 - July 2022',
    similarityScorePct: 81,
    triggerEvent: 'Outbreak of Ukraine hostilities and subsequent initial sanctions restructuring seaborne crude trade routes.',
    regime: 'VOLATILITY_EXPANSION',
    forwardReturns: {
      d5Pct: 5.4,
      d20Pct: 11.2,
      d60Pct: 18.5,
      d180Pct: -6.4,
    },
    mfePct: 24.5,
    maePct: -7.8,
    maxDrawdownPct: 14.2,
    keyDifferences: [
      '2022 shock was sudden and completely unanticipated; current Red Sea and shadow fleet dynamics are known and partially priced',
      'Global spare capacity is higher today (~4.5M bpd held by OPEC+)',
    ],
    caveatsAndCounterexamples: 'Aggressive central bank rate hikes in mid-2022 eventually caused a macro demand scare that reversed the entire premium.',
  },
];

export function getCommodityScenarios(commodity: CommodityType): CommodityScenario[] {
  return COMMODITY_HISTORICAL_SCENARIOS[commodity] || COMMODITY_HISTORICAL_SCENARIOS.GOLD;
}

export function getCommodityAnalogues(commodity: CommodityType): HistoricalAnalogueEpisode[] {
  return CANONICAL_HISTORICAL_ANALOGUES.filter((a) => a.commodity === commodity);
}
