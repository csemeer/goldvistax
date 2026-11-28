/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * Aurum Intelligence — Multi-Commodity Opportunity Scanner, Portfolio Margin Heat-Map & Physical Bullion DCA Engine
 *
 * Implements Phase 6:
 * 1. Real-time Multi-Commodity Opportunity Scanner across Gold, Silver, WTI, Brent, and DXY.
 * 2. Cross-Commodity Portfolio Margin Aggregation, Concentration Heat-Map & Macro Stress Testing.
 * 3. Physical Precious Metals Vault Accumulation Dollar-Cost-Averaging (DCA) Model.
 */

import {
  Quote,
  PaperPosition,
  InstrumentSpecification,
  InstrumentId,
  TradePlan,
  TradeDirection,
  RecommendationState,
} from '../domain/types';

export interface CommodityOpportunityScan {
  instrumentId: string;
  symbol: string;
  name: string;
  assetClass: 'PRECIOUS_METALS' | 'ENERGY' | 'CURRENCY';
  currentPrice: number;
  change24hPct: number;
  confluenceScore: number; // 0-100
  actionableSetup: 'PRIME_PULLBACK_BUY' | 'ACCUMULATION_ZONE' | 'CONSOLIDATION_HOLD' | 'BEARISH_RESISTANCE_FADE' | 'NEUTRAL_STAND_DOWN';
  entryCorridor: [number, number];
  stopLoss: number;
  target1: number;
  rewardToRiskRatio: number;
  catalystSummary: string;
  priorityRank: number;
  invalidationLevel: string;
}

export interface PortfolioMarginHeatmap {
  accountEquity: number;
  totalGrossNotional: number;
  effectiveLeverageRatio: number;
  totalMarginUsed: number;
  freeMargin: number;
  marginUtilizationPct: number;
  marginHealthStatus: 'OPTIMAL_SAFE' | 'MODERATE' | 'ELEVATED_RISK' | 'CRITICAL_HAZARD';
  concentrationByAssetClass: {
    preciousMetalsPct: number;
    energyPct: number;
    currencyPct: number;
  };
  dailyParametricVaR95Usd: number;
  macroStressTestShockLossUsd: number; // 50 bps yield spike + 1.5% USD rally
  liquidationBufferPoints: number;
  normalizedExposuresByUnit: Array<{
    instrumentId: string;
    lots: number;
    contractMultiplier: number;
    physicalUnit: string;
    normalizedUnitsHeld: number;
    notionalUsd: number;
    isPaperDerivative: true;
  }>;
  isPhysicalBullionSeparated: boolean;
  riskSummary: string;
}

export interface PhysicalBullionDCAParams {
  monthlyBudgetUsd: number;
  horizonMonths: number;
  goldAllocationPct: number; // e.g. 75
  silverAllocationPct: number; // e.g. 25
  goldSpotPrice?: number;
  silverSpotPrice?: number;
  dealerPremiumPct?: number; // e.g. 2.5%
  assumedAnnualInflationPct?: number; // e.g. 3.0%
}

export interface PhysicalBullionDCAResult {
  totalFiatCapitalInvested: number;
  goldOuncesAccumulated: number;
  silverOuncesAccumulated: number;
  goldGramsAccumulated: number;
  silverGramsAccumulated: number;
  goldWeightedCostBasis: number;
  silverWeightedCostBasis: number;
  effectiveDealerPremiumPaidUsd: number;
  fiatDepreciationLossAvoidedUsd: number;
  netPurchasingPowerPreservedUsd: number;
  goldSilverRatioTiltNote: string;
  schedule: Array<{
    month: number;
    goldOuncesTotal: number;
    silverOuncesTotal: number;
    cumulativeCostUsd: number;
    fiatBaselineRealValueUsd: number;
  }>;
}

/**
 * 1. Real-Time Multi-Commodity Opportunity Scanner
 */
export function scanCommodityOpportunities(
  quotes: Record<string, Quote>
): CommodityOpportunityScan[] {
  const gold = quotes.XAUUSD?.mid || 4048.50;
  const silver = quotes.XAGUSD?.mid || 48.20;
  const wti = quotes.WTI_CRUDE?.mid || 78.40;
  const brent = quotes.BRENT_CRUDE?.mid || 82.50;
  const dxy = quotes.DXY?.mid || 104.18;

  const scans: CommodityOpportunityScan[] = [
    {
      instrumentId: 'XAUUSD',
      symbol: 'XAU/USD',
      name: 'Spot Gold / US Dollar',
      assetClass: 'PRECIOUS_METALS',
      currentPrice: gold,
      change24hPct: quotes.XAUUSD?.change24hPct || 0.88,
      confluenceScore: 92,
      actionableSetup: 'PRIME_PULLBACK_BUY',
      entryCorridor: [Number((gold * 0.993).toFixed(2)), Number((gold * 0.997).toFixed(2))],
      stopLoss: Number((gold * 0.985).toFixed(2)),
      target1: Number((gold * 1.025).toFixed(2)),
      rewardToRiskRatio: 2.65,
      catalystSummary: 'PBoC & RBI sovereign vault accumulation + US real yield easing cycle continuation.',
      priorityRank: 1,
      invalidationLevel: `Hourly candle close below $${(gold * 0.985).toFixed(2)}.`,
    },
    {
      instrumentId: 'XAGUSD',
      symbol: 'XAG/USD',
      name: 'Spot Silver / US Dollar',
      assetClass: 'PRECIOUS_METALS',
      currentPrice: silver,
      change24hPct: quotes.XAGUSD?.change24hPct || 1.45,
      confluenceScore: 86,
      actionableSetup: 'ACCUMULATION_ZONE',
      entryCorridor: [Number((silver * 0.988).toFixed(2)), Number((silver * 0.995).toFixed(2))],
      stopLoss: Number((silver * 0.965).toFixed(2)),
      target1: Number((silver * 1.055).toFixed(2)),
      rewardToRiskRatio: 2.75,
      catalystSummary: 'Gold/Silver ratio elevated at 83.98x; structural industrial solar & electronics demand catch-up.',
      priorityRank: 2,
      invalidationLevel: `Daily close below $${(silver * 0.965).toFixed(2)}.`,
    },
    {
      instrumentId: 'BRENT_CRUDE',
      symbol: 'BZ (Brent)',
      name: 'Brent Crude Oil Benchmark',
      assetClass: 'ENERGY',
      currentPrice: brent,
      change24hPct: quotes.BRENT_CRUDE?.change24hPct || -0.45,
      confluenceScore: 78,
      actionableSetup: 'CONSOLIDATION_HOLD',
      entryCorridor: [Number((brent * 0.990).toFixed(2)), Number((brent * 0.996).toFixed(2))],
      stopLoss: Number((brent * 0.978).toFixed(2)),
      target1: Number((brent * 1.032).toFixed(2)),
      rewardToRiskRatio: 2.15,
      catalystSummary: 'Red Sea shipping route surcharges support international sweet crude premium over domestic WTI.',
      priorityRank: 3,
      invalidationLevel: `4-hour close below $${(brent * 0.978).toFixed(2)}.`,
    },
    {
      instrumentId: 'WTI_CRUDE',
      symbol: 'CL (WTI)',
      name: 'WTI Light Sweet Crude',
      assetClass: 'ENERGY',
      currentPrice: wti,
      change24hPct: quotes.WTI_CRUDE?.change24hPct || -0.65,
      confluenceScore: 72,
      actionableSetup: 'NEUTRAL_STAND_DOWN',
      entryCorridor: [Number((wti * 0.985).toFixed(2)), Number((wti * 0.992).toFixed(2))],
      stopLoss: Number((wti * 0.972).toFixed(2)),
      target1: Number((wti * 1.025).toFixed(2)),
      rewardToRiskRatio: 2.05,
      catalystSummary: 'US inventory build balances OPEC+ voluntary quotas; neutral range bound between $75-$81.',
      priorityRank: 4,
      invalidationLevel: `Daily close below $${(wti * 0.972).toFixed(2)}.`,
    },
    {
      instrumentId: 'DXY',
      symbol: 'DXY Index',
      name: 'US Dollar Currency Index',
      assetClass: 'CURRENCY',
      currentPrice: dxy,
      change24hPct: quotes.DXY?.change24hPct || -0.12,
      confluenceScore: 68,
      actionableSetup: 'BEARISH_RESISTANCE_FADE',
      entryCorridor: [Number((dxy * 1.002).toFixed(2)), Number((dxy * 1.005).toFixed(2))],
      stopLoss: Number((dxy * 1.012).toFixed(2)),
      target1: Number((dxy * 0.988).toFixed(2)),
      rewardToRiskRatio: 2.20,
      catalystSummary: 'DXY stalls at 200 SMA resistance near 104.50 as Fed rate-cut expectations anchor terminal rate.',
      priorityRank: 5,
      invalidationLevel: `Decisive daily breakout above 104.90.`,
    },
  ];

  return scans.sort((a, b) => a.priorityRank - b.priorityRank);
}

/**
 * 2. Cross-Commodity Portfolio Margin Aggregation & Stress Testing
 */
export function calculatePortfolioMarginHeatmap(
  positions: PaperPosition[],
  accountEquity = 100000,
  defaultLeverage = 30
): PortfolioMarginHeatmap {
  const openPositions = positions.filter((p) => p.status === 'OPEN');

  let totalGrossNotional = 0;
  let pmNotional = 0;
  let energyNotional = 0;
  let currencyNotional = 0;
  const normalizedExposuresByUnit: PortfolioMarginHeatmap['normalizedExposuresByUnit'] = [];

  for (const pos of openPositions) {
    const isGold = pos.instrumentId === 'XAUUSD' || pos.instrumentId === 'GC_FUT' || pos.instrumentId === 'XAU_CFD';
    const isSilver = pos.instrumentId === 'XAGUSD' || pos.instrumentId === 'SI_FUT' || pos.instrumentId === 'XAG_CFD';
    const isEnergy = pos.instrumentId.includes('CRUDE') || pos.instrumentId.includes('OIL') || pos.instrumentId === 'CL_FUT' || pos.instrumentId === 'BZ_FUT';

    // Contract multiplier: 100 troy oz for gold, 5000 troy oz for silver, 1000 barrels for crude
    const multiplier = isSilver ? 5000 : isEnergy ? 1000 : 100;
    const physicalUnit = isEnergy ? 'barrels (bbl)' : 'troy ounces (oz)';
    const notional = pos.lots * pos.currentPrice * multiplier;
    totalGrossNotional += notional;

    normalizedExposuresByUnit.push({
      instrumentId: pos.instrumentId,
      lots: pos.lots,
      contractMultiplier: multiplier,
      physicalUnit,
      normalizedUnitsHeld: Number((pos.lots * multiplier).toFixed(2)),
      notionalUsd: Number(notional.toFixed(2)),
      isPaperDerivative: true,
    });

    if (isGold || isSilver) {
      pmNotional += notional;
    } else if (isEnergy) {
      energyNotional += notional;
    } else {
      currencyNotional += notional;
    }
  }

  const effectiveLeverageRatio =
    accountEquity > 0 ? Number((totalGrossNotional / accountEquity).toFixed(2)) : 0;

  // Margin required = notional / leverage (e.g. 1/30 = 3.33%)
  const totalMarginUsed =
    defaultLeverage > 0 ? Number((totalGrossNotional / defaultLeverage).toFixed(2)) : 0;
  const freeMargin = Math.max(0, accountEquity - totalMarginUsed);
  const marginUtilizationPct =
    accountEquity > 0 ? Number(((totalMarginUsed / accountEquity) * 100).toFixed(1)) : 0;

  let marginHealthStatus: PortfolioMarginHeatmap['marginHealthStatus'] = 'OPTIMAL_SAFE';
  if (marginUtilizationPct > 70) {
    marginHealthStatus = 'CRITICAL_HAZARD';
  } else if (marginUtilizationPct > 50) {
    marginHealthStatus = 'ELEVATED_RISK';
  } else if (marginUtilizationPct > 30) {
    marginHealthStatus = 'MODERATE';
  }

  const preciousMetalsPct =
    totalGrossNotional > 0 ? Number(((pmNotional / totalGrossNotional) * 100).toFixed(1)) : 100;
  const energyPct =
    totalGrossNotional > 0 ? Number(((energyNotional / totalGrossNotional) * 100).toFixed(1)) : 0;
  const currencyPct =
    totalGrossNotional > 0 ? Number(((currencyNotional / totalGrossNotional) * 100).toFixed(1)) : 0;

  // 1-Day 95% Parametric VaR (Commodity daily volatility approx 1.25% * 1.645 = ~2.05%)
  const dailyParametricVaR95Usd = Number((totalGrossNotional * 0.0205).toFixed(2));

  // Stress test shock: 50 bps yield spike causing 2.8% gold drop and 1.5% energy pull
  const macroStressTestShockLossUsd = Number(
    (pmNotional * 0.028 + energyNotional * 0.015).toFixed(2)
  );

  const liquidationBufferPoints = Math.max(
    0,
    Math.round(((accountEquity * 0.8) / (openPositions.reduce((acc, p) => acc + p.lots, 0) * 100 || 1)))
  );

  let riskSummary = 'Portfolio risk parameters are well balanced within institutional risk budgets.';
  if (marginHealthStatus === 'CRITICAL_HAZARD') {
    riskSummary = 'CRITICAL WARNING: Margin utilization exceeds 70%. High vulnerability to broker stop-out liquidation.';
  } else if (marginHealthStatus === 'ELEVATED_RISK') {
    riskSummary = 'CAUTION: Effective leverage is elevated. Recommend reducing position size prior to Tier-1 macro releases.';
  }

  return {
    accountEquity,
    totalGrossNotional,
    effectiveLeverageRatio,
    totalMarginUsed,
    freeMargin,
    marginUtilizationPct,
    marginHealthStatus,
    concentrationByAssetClass: {
      preciousMetalsPct,
      energyPct,
      currencyPct,
    },
    dailyParametricVaR95Usd,
    macroStressTestShockLossUsd,
    liquidationBufferPoints,
    normalizedExposuresByUnit,
    isPhysicalBullionSeparated: true,
    riskSummary,
  };
}

/**
 * 3. Physical Precious Metals Vault Accumulation Dollar-Cost-Averaging (DCA) Model
 */
export function calculatePhysicalBullionDCA(params: PhysicalBullionDCAParams): PhysicalBullionDCAResult {
  const {
    monthlyBudgetUsd,
    horizonMonths,
    goldAllocationPct,
    silverAllocationPct,
    goldSpotPrice = 4048.50,
    silverSpotPrice = 48.20,
    dealerPremiumPct = 2.5,
    assumedAnnualInflationPct = 3.0,
  } = params;

  const totalFiatCapitalInvested = monthlyBudgetUsd * horizonMonths;
  const effectiveGoldPrice = goldSpotPrice * (1 + dealerPremiumPct / 100);
  const effectiveSilverPrice = silverSpotPrice * (1 + (dealerPremiumPct + 1.5) / 100); // Silver coin premiums typically slightly higher

  const monthlyGoldBudget = monthlyBudgetUsd * (goldAllocationPct / 100);
  const monthlySilverBudget = monthlyBudgetUsd * (silverAllocationPct / 100);

  const goldOuncesAccumulated = Number(((monthlyGoldBudget * horizonMonths) / effectiveGoldPrice).toFixed(3));
  const silverOuncesAccumulated = Number(((monthlySilverBudget * horizonMonths) / effectiveSilverPrice).toFixed(2));

  // 1 troy ounce = 31.1034768 grams
  const goldGramsAccumulated = Number((goldOuncesAccumulated * 31.1035).toFixed(1));
  const silverGramsAccumulated = Number((silverOuncesAccumulated * 31.1035).toFixed(1));

  const effectiveDealerPremiumPaidUsd = Number(
    (totalFiatCapitalInvested * (dealerPremiumPct / 100)).toFixed(2)
  );

  // Inflation decay calculation on fiat: purchasing power of fiat cash declines over horizon
  const monthlyInflationRate = assumedAnnualInflationPct / 100 / 12;
  let discountedFiatValue = 0;
  for (let m = 1; m <= horizonMonths; m++) {
    discountedFiatValue += monthlyBudgetUsd / Math.pow(1 + monthlyInflationRate, m);
  }
  const fiatDepreciationLossAvoidedUsd = Number(
    (totalFiatCapitalInvested - discountedFiatValue).toFixed(2)
  );
  const netPurchasingPowerPreservedUsd = Number(
    (totalFiatCapitalInvested + fiatDepreciationLossAvoidedUsd - effectiveDealerPremiumPaidUsd).toFixed(2)
  );

  const ratio = goldSpotPrice / silverSpotPrice;
  let goldSilverRatioTiltNote = 'Precious metals split reflects balanced 75/25 physical reserve accumulation.';
  if (ratio > 82) {
    goldSilverRatioTiltNote = `Gold/Silver ratio (${ratio.toFixed(1)}x) is above historical 80x average. Consider tilting 35% to physical Silver to capture higher industrial beta upside.`;
  }

  // Generate monthly progress schedule
  const schedule: PhysicalBullionDCAResult['schedule'] = [];
  let cumCost = 0;
  let cumGoldOz = 0;
  let cumSilverOz = 0;
  let cumFiatReal = 0;

  for (let i = 1; i <= horizonMonths; i++) {
    cumCost += monthlyBudgetUsd;
    cumGoldOz += monthlyGoldBudget / effectiveGoldPrice;
    cumSilverOz += monthlySilverBudget / effectiveSilverPrice;
    cumFiatReal += monthlyBudgetUsd / Math.pow(1 + monthlyInflationRate, i);

    schedule.push({
      month: i,
      goldOuncesTotal: Number(cumGoldOz.toFixed(2)),
      silverOuncesTotal: Number(cumSilverOz.toFixed(1)),
      cumulativeCostUsd: cumCost,
      fiatBaselineRealValueUsd: Number(cumFiatReal.toFixed(2)),
    });
  }

  return {
    totalFiatCapitalInvested,
    goldOuncesAccumulated,
    silverOuncesAccumulated,
    goldGramsAccumulated,
    silverGramsAccumulated,
    goldWeightedCostBasis: Number(effectiveGoldPrice.toFixed(2)),
    silverWeightedCostBasis: Number(effectiveSilverPrice.toFixed(2)),
    effectiveDealerPremiumPaidUsd,
    fiatDepreciationLossAvoidedUsd,
    netPurchasingPowerPreservedUsd,
    goldSilverRatioTiltNote,
    schedule,
  };
}

export interface PortfolioStressScenarioResult {
  scenarioId: string;
  label: string;
  macroAssumptions: string;
  derivativePnlDeltaUsd: number;
  physicalBullionPnlDeltaUsd: number;
  stressedDerivativeEquityUsd: number;
  stressedMarginUtilizationPct: number;
  healthStatus: 'RESILIENT' | 'ELEVATED_STRESS' | 'MARGIN_CALL_HAZARD';
  isPhysicalBullionSeparated: true;
  valuationCaveat: string;
}

/**
 * 4. Phase 9 Multi-Scenario Stress Matrix (§12)
 * Computes scenario shocks strictly separating leveraged paper derivatives from unleveraged physical holdings.
 */
export function runPortfolioScenarioMatrix(
  positions: PaperPosition[],
  accountEquity = 100000,
  physicalBullionHoldingsUsd = 0,
  defaultLeverage = 30
): PortfolioStressScenarioResult[] {
  const openPositions = positions.filter((p) => p.status === 'OPEN');

  const scenarios = [
    {
      scenarioId: 'STAGFLATION_YIELD_SPIKE',
      label: 'Stagflation +75bps Real Yield Spike',
      macroAssumptions: 'Gold -3.2%, Silver -5.0%, Crude +4.0%, DXY +2.0%',
      shocks: { pm: -0.032, silver: -0.05, energy: 0.04, fx: 0.02 },
    },
    {
      scenarioId: 'SOVEREIGN_RISK_OFF_FLIGHT',
      label: 'Geopolitical Risk-Off Sovereign Flight',
      macroAssumptions: 'Gold +4.8%, Silver +3.2%, Crude +9.5%, DXY +0.8%',
      shocks: { pm: 0.048, silver: 0.032, energy: 0.095, fx: 0.008 },
    },
    {
      scenarioId: 'ENERGY_CHOKEPOINT_SHOCK',
      label: 'Maritime Energy Chokepoint Disruption',
      macroAssumptions: 'Gold +2.4%, Silver +1.5%, Crude +12.0%, DXY +1.1%',
      shocks: { pm: 0.024, silver: 0.015, energy: 0.12, fx: 0.011 },
    },
    {
      scenarioId: 'USD_LIQUIDITY_SQUEEZE',
      label: 'Dollar Funding Liquidity Squeeze',
      macroAssumptions: 'Gold -4.5%, Silver -7.5%, Crude -6.5%, DXY +3.2%',
      shocks: { pm: -0.045, silver: -0.075, energy: -0.065, fx: 0.032 },
    },
  ];

  const baseHeatmap = calculatePortfolioMarginHeatmap(positions, accountEquity, defaultLeverage);

  return scenarios.map((sc) => {
    let derivativePnlDeltaUsd = 0;

    for (const pos of openPositions) {
      const isGold = pos.instrumentId === 'XAUUSD' || pos.instrumentId === 'GC_FUT' || pos.instrumentId === 'XAU_CFD';
      const isSilver = pos.instrumentId === 'XAGUSD' || pos.instrumentId === 'SI_FUT' || pos.instrumentId === 'XAG_CFD';
      const isEnergy =
        pos.instrumentId.includes('CRUDE') ||
        pos.instrumentId.includes('OIL') ||
        pos.instrumentId === 'CL_FUT' ||
        pos.instrumentId === 'BZ_FUT';

      const multiplier = isSilver ? 5000 : isEnergy ? 1000 : 100;
      const notional = pos.lots * pos.currentPrice * multiplier;
      const shockPct = isSilver ? sc.shocks.silver : isGold ? sc.shocks.pm : isEnergy ? sc.shocks.energy : sc.shocks.fx;
      const dirSign = pos.direction === 'SELL' ? -1 : 1;
      derivativePnlDeltaUsd += notional * shockPct * dirSign;
    }

    const physicalBullionPnlDeltaUsd = Number((physicalBullionHoldingsUsd * sc.shocks.pm).toFixed(2));
    const stressedDerivativeEquityUsd = Number(Math.max(0, accountEquity + derivativePnlDeltaUsd).toFixed(2));
    const stressedMarginUtilizationPct =
      stressedDerivativeEquityUsd > 0
        ? Number(((baseHeatmap.totalMarginUsed / stressedDerivativeEquityUsd) * 100).toFixed(1))
        : 999;

    let healthStatus: PortfolioStressScenarioResult['healthStatus'] = 'RESILIENT';
    if (stressedMarginUtilizationPct >= 80 || stressedDerivativeEquityUsd <= baseHeatmap.totalMarginUsed) {
      healthStatus = 'MARGIN_CALL_HAZARD';
    } else if (stressedMarginUtilizationPct >= 45) {
      healthStatus = 'ELEVATED_STRESS';
    }

    return {
      scenarioId: sc.scenarioId,
      label: sc.label,
      macroAssumptions: sc.macroAssumptions,
      derivativePnlDeltaUsd: Number(derivativePnlDeltaUsd.toFixed(2)),
      physicalBullionPnlDeltaUsd,
      stressedDerivativeEquityUsd,
      stressedMarginUtilizationPct,
      healthStatus,
      isPhysicalBullionSeparated: true,
      valuationCaveat:
        'Scenario shocks are deterministic stress parameters on paper derivative exposure; physical bullion vault valuation is reported separately.',
    };
  });
}

// -----------------------------------------------------------------------------
// 5. Maximum Adverse Excursion (MAE) & Stop-Loss Efficiency Analytics Engine
// -----------------------------------------------------------------------------

export type MaeEfficiencyTier =
  | 'PRECISION_ENTRY'
  | 'OPTIMAL_BUFFER'
  | 'NEAR_STOP_BRUSH'
  | 'STOP_BREACHED';

export interface PositionMaePoint {
  positionId: string;
  instrumentId: string;
  direction: 'BUY' | 'SELL';
  status: PaperPosition['status'];
  outcomeCategory: 'OPEN' | 'WINNER' | 'STOPPED_LOSS';
  lots: number;
  entryPrice: number;
  markOrExitPrice: number;
  stopLossPrice: number;
  takeProfitPrice: number;
  adverseExtremePrice: number;
  maePoints: number;
  maeDollarImpact: number;
  stopRiskPoints: number;
  maePctOfStop: number;
  stopHeadroomPoints: number;
  realizedOrUnrealizedR: number;
  efficiencyTier: MaeEfficiencyTier;
  openTime: string;
}

export interface PortfolioMaeSummary {
  positionsAnalyzed: number;
  winnerCount: number;
  loserCount: number;
  openCount: number;
  averageMaePctOfStop: number;
  averageWinnerMaePctOfStop: number;
  maxWinnerMaePctOfStop: number;
  recommendedStopTightenPct: number;
  stopEfficiencyScorePct: number;
  recommendationText: string;
  points: PositionMaePoint[];
}

export function getInstrumentMultiplierForMae(instrumentId: string): number {
  if (instrumentId === 'XAGUSD' || instrumentId === 'SI_FUT' || instrumentId === 'XAG_CFD') {
    return 5000;
  }
  if (
    instrumentId.includes('CRUDE') ||
    instrumentId.includes('OIL') ||
    instrumentId === 'CL_FUT' ||
    instrumentId === 'BZ_FUT'
  ) {
    return 1000;
  }
  return 100;
}

/**
 * Computes per-trade Maximum Adverse Excursion (MAE) against configured stop-loss
 * thresholds and derives empirical stop-loss sizing efficiency metrics.
 */
export function calculatePositionMaeAnalytics(
  positions: PaperPosition[],
  quotes?: Record<string, Quote>,
  defaultQuote?: Quote
): PortfolioMaeSummary {
  const activeTrades = positions.filter((p) => p.status !== 'CANCELLED');

  const points: PositionMaePoint[] = activeTrades.map((pos) => {
    const isSell = pos.direction === 'SELL';
    const multiplier = getInstrumentMultiplierForMae(pos.instrumentId);

    const liveQuoteMid =
      quotes?.[pos.instrumentId]?.mid ??
      (pos.instrumentId === 'XAUUSD' && defaultQuote ? defaultQuote.mid : undefined);
    const markOrExitPrice =
      pos.status === 'OPEN' && Number.isFinite(liveQuoteMid)
        ? (liveQuoteMid as number)
        : pos.currentPrice;

    const stopRiskPoints = Number(Math.max(0.01, Math.abs(pos.entryPrice - pos.stopLoss)).toFixed(4));

    // Resolve adverse extreme price reached before target/stop
    let adverseExtremePrice: number;
    if (typeof pos.adverseExtremePrice === 'number' && Number.isFinite(pos.adverseExtremePrice)) {
      if (pos.status === 'OPEN') {
        adverseExtremePrice = isSell
          ? Math.max(pos.adverseExtremePrice, markOrExitPrice)
          : Math.min(pos.adverseExtremePrice, markOrExitPrice);
      } else {
        adverseExtremePrice = pos.adverseExtremePrice;
      }
    } else if (pos.status === 'CLOSED_LOSS') {
      adverseExtremePrice = pos.stopLoss;
    } else if (pos.status === 'OPEN') {
      adverseExtremePrice = isSell
        ? Math.max(pos.entryPrice, markOrExitPrice)
        : Math.min(pos.entryPrice, markOrExitPrice);
    } else {
      // Closed winner without explicit recorded low -> bounded small entry pullback
      adverseExtremePrice = isSell
        ? Math.max(pos.entryPrice, pos.entryPrice + stopRiskPoints * 0.15)
        : Math.min(pos.entryPrice, pos.entryPrice - stopRiskPoints * 0.15);
    }

    const maePoints = Number(
      Math.max(0, isSell ? adverseExtremePrice - pos.entryPrice : pos.entryPrice - adverseExtremePrice).toFixed(2)
    );
    const maeDollarImpact = Number((maePoints * pos.lots * multiplier).toFixed(2));
    const maePctOfStop = Number(((maePoints / stopRiskPoints) * 100).toFixed(1));
    const stopHeadroomPoints = Number(Math.max(0, stopRiskPoints - maePoints).toFixed(2));

    const directionalMove = isSell ? pos.entryPrice - markOrExitPrice : markOrExitPrice - pos.entryPrice;
    const oneRiskDollar = stopRiskPoints * pos.lots * multiplier;
    const realizedOrUnrealizedR = Number(
      (
        pos.status === 'OPEN'
          ? directionalMove / stopRiskPoints
          : oneRiskDollar > 0
          ? pos.realizedPnl / oneRiskDollar
          : 0
      ).toFixed(2)
    );

    const outcomeCategory: PositionMaePoint['outcomeCategory'] =
      pos.status === 'OPEN'
        ? 'OPEN'
        : pos.realizedPnl >= 0 || pos.status === 'CLOSED_PROFIT'
        ? 'WINNER'
        : 'STOPPED_LOSS';

    let efficiencyTier: MaeEfficiencyTier = 'OPTIMAL_BUFFER';
    if (maePctOfStop >= 100 || outcomeCategory === 'STOPPED_LOSS') {
      efficiencyTier = 'STOP_BREACHED';
    } else if (maePctOfStop > 65) {
      efficiencyTier = 'NEAR_STOP_BRUSH';
    } else if (maePctOfStop <= 25) {
      efficiencyTier = 'PRECISION_ENTRY';
    }

    return {
      positionId: pos.id,
      instrumentId: pos.instrumentId,
      direction: pos.direction,
      status: pos.status,
      outcomeCategory,
      lots: pos.lots,
      entryPrice: Number(pos.entryPrice.toFixed(2)),
      markOrExitPrice: Number(markOrExitPrice.toFixed(2)),
      stopLossPrice: Number(pos.stopLoss.toFixed(2)),
      takeProfitPrice: Number(pos.takeProfit.toFixed(2)),
      adverseExtremePrice: Number(adverseExtremePrice.toFixed(2)),
      maePoints,
      maeDollarImpact,
      stopRiskPoints: Number(stopRiskPoints.toFixed(2)),
      maePctOfStop,
      stopHeadroomPoints,
      realizedOrUnrealizedR,
      efficiencyTier,
      openTime: pos.openTime,
    };
  });

  const winners = points.filter((p) => p.outcomeCategory === 'WINNER');
  const losers = points.filter((p) => p.outcomeCategory === 'STOPPED_LOSS');
  const openList = points.filter((p) => p.outcomeCategory === 'OPEN');

  const avg = (vals: number[]) =>
    vals.length > 0 ? Number((vals.reduce((a, b) => a + b, 0) / vals.length).toFixed(1)) : 0;

  const averageMaePctOfStop = avg(points.map((p) => p.maePctOfStop));
  const averageWinnerMaePctOfStop = avg(winners.map((p) => p.maePctOfStop));
  const maxWinnerMaePctOfStop =
    winners.length > 0 ? Number(Math.max(...winners.map((p) => p.maePctOfStop)).toFixed(1)) : 0;

  // Recommended stop reduction % if winners never came close to 100% of current stop budget
  const safeThresholdPct = winners.length > 0 ? Math.min(100, maxWinnerMaePctOfStop + 10) : 85;
  const recommendedStopTightenPct =
    winners.length > 0 && safeThresholdPct < 95 ? Math.max(0, Math.round(100 - safeThresholdPct)) : 0;

  const nearBrushes = winners.filter((w) => w.efficiencyTier === 'NEAR_STOP_BRUSH').length;
  const rawScore =
    points.length === 0
      ? 100
      : Math.max(
          25,
          Math.min(
            98,
            Math.round(
              100 -
                (losers.length / points.length) * 35 -
                (nearBrushes / Math.max(1, winners.length)) * 15 -
                (recommendedStopTightenPct > 25 ? 10 : 0)
            )
          )
        );

  let recommendationText =
    'Open and executed trades show balanced stop placement relative to observed adverse excursion.';
  if (points.length === 0) {
    recommendationText = 'Open or close a simulated trade to begin mapping live MAE stop-loss efficiency.';
  } else if (winners.length > 0 && recommendedStopTightenPct >= 15) {
    recommendationText = `Winning setups averaged ${averageWinnerMaePctOfStop}% MAE (max ${maxWinnerMaePctOfStop}% of stop). Tightening stops by ~${recommendedStopTightenPct}% would preserve 100% of logged winners while lifting net R:R.`;
  } else if (nearBrushes > 0) {
    recommendationText = `At least ${nearBrushes} winning setup(s) brushed >65% of stop budget before reversing. Keep structural stop buffers outside intraday noise bands.`;
  }

  return {
    positionsAnalyzed: points.length,
    winnerCount: winners.length,
    loserCount: losers.length,
    openCount: openList.length,
    averageMaePctOfStop,
    averageWinnerMaePctOfStop,
    maxWinnerMaePctOfStop,
    recommendedStopTightenPct,
    stopEfficiencyScorePct: rawScore,
    recommendationText,
    points,
  };
}

// -----------------------------------------------------------------------------
// 6. Trade Expectancy Distribution & Cumulative System Edge Engine
// -----------------------------------------------------------------------------

export interface ExpectancySequencePoint {
  sequenceNumber: number;
  positionId: string;
  instrumentId: string;
  direction: 'BUY' | 'SELL';
  openTime: string;
  dateLabel: string;
  realizedPnlUsd: number;
  oneRUsd: number;
  rMultiple: number;
  cumulativeRealizedPnlUsd: number;
  cumulativeR: number;
  runningExpectancyR: number;
  runningExpectancyUsd: number;
  runningWinRatePct: number;
}

export interface ExpectancyBucket {
  bucketId: 'LE_NEG1R' | 'NEG1R_TO_0R' | 'ZERO_TO_1R' | 'ONE_TO_2R' | 'GT_2R';
  label: string;
  count: number;
  sharePct: number;
  totalPnlUsd: number;
  isProfitableBucket: boolean;
}

export interface TradeExpectancyDistributionSummary {
  closedTradesCount: number;
  winCount: number;
  lossCount: number;
  winRatePct: number;
  lossRatePct: number;
  avgWinR: number;
  avgLossR: number;
  payoffRatio: number;
  profitFactor: number;
  expectancyPerTradeR: number;
  expectancyPerTradeUsd: number;
  cumulativeExpectancyR: number;
  cumulativeRealizedPnlUsd: number;
  edgeStatus: 'POSITIVE_EDGE' | 'BREAKEVEN' | 'NEGATIVE_EDGE' | 'INSUFFICIENT_DATA';
  edgeSummary: string;
  sequence: ExpectancySequencePoint[];
  buckets: ExpectancyBucket[];
}

/**
 * Calculates cumulative system expectancy (in R-multiples and USD) across
 * chronologically ordered closed trades, plus an R-multiple distribution histogram.
 */
export function calculateTradeExpectancyDistribution(
  positions: PaperPosition[]
): TradeExpectancyDistributionSummary {
  const closedTrades = positions
    .filter((p) => p.status === 'CLOSED_PROFIT' || p.status === 'CLOSED_LOSS')
    .sort((a, b) => new Date(a.openTime).getTime() - new Date(b.openTime).getTime());

  const buckets: ExpectancyBucket[] = [
    { bucketId: 'LE_NEG1R', label: '<= -1.0R', count: 0, sharePct: 0, totalPnlUsd: 0, isProfitableBucket: false },
    { bucketId: 'NEG1R_TO_0R', label: '-1.0R to 0R', count: 0, sharePct: 0, totalPnlUsd: 0, isProfitableBucket: false },
    { bucketId: 'ZERO_TO_1R', label: '0R to +1.0R', count: 0, sharePct: 0, totalPnlUsd: 0, isProfitableBucket: true },
    { bucketId: 'ONE_TO_2R', label: '+1.0R to +2.0R', count: 0, sharePct: 0, totalPnlUsd: 0, isProfitableBucket: true },
    { bucketId: 'GT_2R', label: '> +2.0R', count: 0, sharePct: 0, totalPnlUsd: 0, isProfitableBucket: true },
  ];

  const sequence: ExpectancySequencePoint[] = [];
  let cumulativePnl = 0;
  let cumulativeR = 0;
  let wins = 0;
  let losses = 0;
  let totalWinR = 0;
  let totalLossAbsR = 0;
  let grossProfitUsd = 0;
  let grossLossAbsUsd = 0;

  closedTrades.forEach((pos, idx) => {
    const multiplier = getInstrumentMultiplierForMae(pos.instrumentId);
    const stopDist = Math.max(0.01, Math.abs(pos.entryPrice - pos.stopLoss));
    const oneRUsd = Number(Math.max(1, stopDist * pos.lots * multiplier).toFixed(2));
    const rMultiple = Number((pos.realizedPnl / oneRUsd).toFixed(2));

    cumulativePnl += pos.realizedPnl;
    cumulativeR += rMultiple;

    if (pos.realizedPnl >= 0) {
      wins++;
      totalWinR += rMultiple;
      grossProfitUsd += pos.realizedPnl;
    } else {
      losses++;
      totalLossAbsR += Math.abs(rMultiple);
      grossLossAbsUsd += Math.abs(pos.realizedPnl);
    }

    const n = idx + 1;
    const runningExpectancyR = Number((cumulativeR / n).toFixed(2));
    const runningExpectancyUsd = Number((cumulativePnl / n).toFixed(2));
    const runningWinRatePct = Number(((wins / n) * 100).toFixed(1));

    const dt = new Date(pos.openTime);
    const dateLabel = Number.isNaN(dt.getTime())
      ? `#${n}`
      : dt.toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' });

    sequence.push({
      sequenceNumber: n,
      positionId: pos.id,
      instrumentId: pos.instrumentId,
      direction: pos.direction,
      openTime: pos.openTime,
      dateLabel,
      realizedPnlUsd: Number(pos.realizedPnl.toFixed(2)),
      oneRUsd,
      rMultiple,
      cumulativeRealizedPnlUsd: Number(cumulativePnl.toFixed(2)),
      cumulativeR: Number(cumulativeR.toFixed(2)),
      runningExpectancyR,
      runningExpectancyUsd,
      runningWinRatePct,
    });

    // Assign to R-multiple bucket
    const targetBucket =
      rMultiple <= -1.0
        ? buckets[0]
        : rMultiple < 0
        ? buckets[1]
        : rMultiple <= 1.0
        ? buckets[2]
        : rMultiple <= 2.0
        ? buckets[3]
        : buckets[4];
    targetBucket.count += 1;
    targetBucket.totalPnlUsd = Number((targetBucket.totalPnlUsd + pos.realizedPnl).toFixed(2));
  });

  const totalCount = closedTrades.length;
  for (const b of buckets) {
    b.sharePct = totalCount > 0 ? Number(((b.count / totalCount) * 100).toFixed(1)) : 0;
  }

  const winRatePct = totalCount > 0 ? Number(((wins / totalCount) * 100).toFixed(1)) : 0;
  const lossRatePct = totalCount > 0 ? Number(((losses / totalCount) * 100).toFixed(1)) : 0;
  const avgWinR = wins > 0 ? Number((totalWinR / wins).toFixed(2)) : 0;
  const avgLossR = losses > 0 ? Number((totalLossAbsR / losses).toFixed(2)) : 0;
  const payoffRatio =
    avgLossR > 0 ? Number((avgWinR / avgLossR).toFixed(2)) : avgWinR > 0 ? Number(avgWinR.toFixed(2)) : 0;
  const profitFactor =
    grossLossAbsUsd > 0
      ? Number((grossProfitUsd / grossLossAbsUsd).toFixed(2))
      : grossProfitUsd > 0
      ? 99.0
      : 0;

  // Mathematical expectancy: (WinRate * AvgWinR) - (LossRate * AvgLossR)
  const expectancyPerTradeR =
    totalCount > 0
      ? Number(((wins / totalCount) * avgWinR - (losses / totalCount) * avgLossR).toFixed(2))
      : 0;
  const expectancyPerTradeUsd =
    totalCount > 0 ? Number((cumulativePnl / totalCount).toFixed(2)) : 0;

  const edgeStatus: TradeExpectancyDistributionSummary['edgeStatus'] =
    totalCount === 0
      ? 'INSUFFICIENT_DATA'
      : expectancyPerTradeR > 0.02
      ? 'POSITIVE_EDGE'
      : expectancyPerTradeR < -0.02
      ? 'NEGATIVE_EDGE'
      : 'BREAKEVEN';

  let edgeSummary = 'Close at least one paper trade to evaluate cumulative system expectancy.';
  if (totalCount > 0) {
    if (edgeStatus === 'POSITIVE_EDGE') {
      edgeSummary = `Positive system edge of +${expectancyPerTradeR.toFixed(2)}R (+$${expectancyPerTradeUsd.toLocaleString()}/trade) across ${totalCount} closed trades (${winRatePct}% win rate, ${payoffRatio}:1 payoff).`;
    } else if (edgeStatus === 'NEGATIVE_EDGE') {
      edgeSummary = `Negative expectancy of ${expectancyPerTradeR.toFixed(2)}R/trade across ${totalCount} closed trades. Focus on trimming sub-1R winners or widening structural stops.`;
    } else {
      edgeSummary = `System expectancy is near breakeven (${expectancyPerTradeR.toFixed(2)}R/trade) across ${totalCount} closed trades.`;
    }
  }

  return {
    closedTradesCount: totalCount,
    winCount: wins,
    lossCount: losses,
    winRatePct,
    lossRatePct,
    avgWinR,
    avgLossR,
    payoffRatio,
    profitFactor,
    expectancyPerTradeR,
    expectancyPerTradeUsd,
    cumulativeExpectancyR: Number(cumulativeR.toFixed(2)),
    cumulativeRealizedPnlUsd: Number(cumulativePnl.toFixed(2)),
    edgeStatus,
    edgeSummary,
    sequence,
    buckets,
  };
}

// -----------------------------------------------------------------------------
// 7. Trade Success Rate Gauge Analytics Engine
// -----------------------------------------------------------------------------

export type TradeSuccessRateScope = 'ALL_EXECUTED' | 'CLOSED_ONLY';

export interface TradeSuccessRateSummary {
  scope: TradeSuccessRateScope;
  totalExecutedTrades: number;
  evaluatedTradesCount: number;
  winCount: number;
  lossCount: number;
  winRatePct: number;
  lossRatePct: number;
  closedWinCount: number;
  closedLossCount: number;
  closedWinRatePct: number;
  openTradesCount: number;
  openWinningCount: number;
  openLosingCount: number;
  buyWinCount: number;
  buyTotalCount: number;
  buyWinRatePct: number;
  sellWinCount: number;
  sellTotalCount: number;
  sellWinRatePct: number;
  currentStreakType: 'WIN' | 'LOSS' | 'NONE';
  currentStreakCount: number;
  performanceBand: 'OUTPERFORMING' | 'COMPETITIVE' | 'NEEDS_REVIEW' | 'NO_DATA';
  feedbackMessage: string;
}

/**
 * Computes live win/loss success rate metrics across all executed positions
 * (or closed-only positions) with real-time mark-to-market evaluation for OPEN trades.
 */
export function calculateTradeSuccessRate(
  positions: PaperPosition[],
  quotes?: Record<string, Quote>,
  defaultQuote?: Quote,
  options: { scope?: TradeSuccessRateScope } = {}
): TradeSuccessRateSummary {
  const scope: TradeSuccessRateScope = options.scope ?? 'ALL_EXECUTED';
  const executed = (Array.isArray(positions) ? positions : [])
    .filter((p) => p.status !== 'CANCELLED')
    .sort((a, b) => new Date(a.openTime).getTime() - new Date(b.openTime).getTime());

  let closedWinCount = 0;
  let closedLossCount = 0;
  let openTradesCount = 0;
  let openWinningCount = 0;
  let openLosingCount = 0;

  let buyWinCount = 0;
  let buyTotalCount = 0;
  let sellWinCount = 0;
  let sellTotalCount = 0;

  const evaluatedOutcomes: boolean[] = [];

  for (const pos of executed) {
    const isOpen = pos.status === 'OPEN';
    if (isOpen) {
      openTradesCount++;
    }

    let isWin = false;
    if (isOpen) {
      const multiplier = getInstrumentMultiplierForMae(pos.instrumentId);
      const liveMark =
        quotes?.[pos.instrumentId]?.mid ??
        (pos.instrumentId === 'XAUUSD' && defaultQuote ? defaultQuote.mid : pos.currentPrice);
      const directionalDiff =
        pos.direction === 'SELL' ? pos.entryPrice - liveMark : liveMark - pos.entryPrice;
      const livePnl = directionalDiff * pos.lots * multiplier;
      isWin = livePnl >= 0;
      if (isWin) openWinningCount++;
      else openLosingCount++;
    } else {
      isWin = pos.status === 'CLOSED_PROFIT' || (pos.status !== 'CLOSED_LOSS' && pos.realizedPnl >= 0);
      if (isWin) closedWinCount++;
      else closedLossCount++;
    }

    if (scope === 'CLOSED_ONLY' && isOpen) {
      continue;
    }

    evaluatedOutcomes.push(isWin);
    if (pos.direction === 'SELL') {
      sellTotalCount++;
      if (isWin) sellWinCount++;
    } else {
      buyTotalCount++;
      if (isWin) buyWinCount++;
    }
  }

  const evaluatedTradesCount = evaluatedOutcomes.length;
  const winCount = evaluatedOutcomes.filter(Boolean).length;
  const lossCount = evaluatedTradesCount - winCount;

  const winRatePct =
    evaluatedTradesCount > 0 ? Number(((winCount / evaluatedTradesCount) * 100).toFixed(1)) : 0;
  const lossRatePct =
    evaluatedTradesCount > 0 ? Number(((lossCount / evaluatedTradesCount) * 100).toFixed(1)) : 0;

  const closedTotal = closedWinCount + closedLossCount;
  const closedWinRatePct =
    closedTotal > 0 ? Number(((closedWinCount / closedTotal) * 100).toFixed(1)) : 0;

  const buyWinRatePct =
    buyTotalCount > 0 ? Number(((buyWinCount / buyTotalCount) * 100).toFixed(1)) : 0;
  const sellWinRatePct =
    sellTotalCount > 0 ? Number(((sellWinCount / sellTotalCount) * 100).toFixed(1)) : 0;

  // Compute trailing consecutive win/loss streak
  let currentStreakType: TradeSuccessRateSummary['currentStreakType'] = 'NONE';
  let currentStreakCount = 0;
  if (evaluatedOutcomes.length > 0) {
    const latestWin = evaluatedOutcomes[evaluatedOutcomes.length - 1];
    currentStreakType = latestWin ? 'WIN' : 'LOSS';
    for (let i = evaluatedOutcomes.length - 1; i >= 0; i--) {
      if (evaluatedOutcomes[i] === latestWin) {
        currentStreakCount++;
      } else {
        break;
      }
    }
  }

  const performanceBand: TradeSuccessRateSummary['performanceBand'] =
    evaluatedTradesCount === 0
      ? 'NO_DATA'
      : winRatePct >= 60
      ? 'OUTPERFORMING'
      : winRatePct >= 50
      ? 'COMPETITIVE'
      : 'NEEDS_REVIEW';

  let feedbackMessage = 'Execute or close a simulated trade to start tracking strategy win/loss accuracy.';
  if (evaluatedTradesCount > 0) {
    const scopeText = scope === 'ALL_EXECUTED' ? 'executed trades (including live MTM)' : 'closed trades';
    if (performanceBand === 'OUTPERFORMING') {
      feedbackMessage = `Strong execution hit rate at ${winRatePct}% (${winCount}W / ${lossCount}L) across ${evaluatedTradesCount} ${scopeText}, outperforming the 50% institutional breakeven benchmark.`;
    } else if (performanceBand === 'COMPETITIVE') {
      feedbackMessage = `Balanced win rate of ${winRatePct}% (${winCount}W / ${lossCount}L) across ${evaluatedTradesCount} ${scopeText}; maintain >= 1.5:1 reward-to-risk to compound edge.`;
    } else {
      feedbackMessage = `Hit rate sits at ${winRatePct}% (${winCount}W / ${lossCount}L) across ${evaluatedTradesCount} ${scopeText} — review entry timing and MAE stop distance before scaling size.`;
    }
  }

  return {
    scope,
    totalExecutedTrades: executed.length,
    evaluatedTradesCount,
    winCount,
    lossCount,
    winRatePct,
    lossRatePct,
    closedWinCount,
    closedLossCount,
    closedWinRatePct,
    openTradesCount,
    openWinningCount,
    openLosingCount,
    buyWinCount,
    buyTotalCount,
    buyWinRatePct,
    sellWinCount,
    sellTotalCount,
    sellWinRatePct,
    currentStreakType,
    currentStreakCount,
    performanceBand,
    feedbackMessage,
  };
}

// -----------------------------------------------------------------------------
// 8. Portfolio Journal Date-Range Filtering & Economic Cycle Trends Engine
// -----------------------------------------------------------------------------

export type JournalRangeGranularity = 'ALL' | 'MONTH' | 'QUARTER' | 'CUSTOM';

export interface JournalDateFilterSpec {
  granularity: JournalRangeGranularity;
  /** 'YYYY-MM' when granularity === 'MONTH', or 'YYYY-Q1'..'YYYY-Q4' when granularity === 'QUARTER' */
  periodKey?: string;
  /** Inclusive 'YYYY-MM-DD' bounds when granularity === 'CUSTOM' */
  startDate?: string;
  endDate?: string;
}

export interface JournalPeriodOption {
  key: string;
  label: string;
  cycleContext: string;
  startDate: string;
  endDate: string;
  tradeCount: number;
  openCount: number;
  closedCount: number;
  winCount: number;
  lossCount: number;
  winRatePct: number;
  realizedPnlUsd: number;
}

export interface FilteredJournalSummary {
  granularity: JournalRangeGranularity;
  activeLabel: string;
  resolvedStartDate: string | null;
  resolvedEndDate: string | null;
  positions: PaperPosition[];
  totalCatalogCount: number;
  totalMatchedCount: number;
  openCount: number;
  closedCount: number;
  winCount: number;
  lossCount: number;
  winRatePct: number;
  realizedPnlUsd: number;
  cycleTrendNote: string;
  availableMonths: JournalPeriodOption[];
  availableQuarters: JournalPeriodOption[];
}

const MONTH_ABBR = [
  'Jan',
  'Feb',
  'Mar',
  'Apr',
  'May',
  'Jun',
  'Jul',
  'Aug',
  'Sep',
  'Oct',
  'Nov',
  'Dec',
];

const ECONOMIC_CYCLE_DESCRIPTORS: Record<string, string> = {
  '2026-Q1': 'Rate-Hold Pause & Sovereign Bid',
  '2026-Q2': 'Sticky Inflation Chop Regime',
  '2026-Q3': 'FOMC Easing Cycle Pivot',
  '2026-Q4': 'Liquidity Expansion & Breakout',
  '2025-Q1': 'Post-Election Dollar Surge',
  '2025-Q2': 'Tariff & Real-Yield Repricing',
  '2025-Q3': 'Mid-Cycle Easing Continuation',
  '2025-Q4': 'Year-End Sovereign Accumulation',
};

function getLastDayOfMonthIso(year: number, monthIndexZeroBased: number): string {
  const lastDay = new Date(Date.UTC(year, monthIndexZeroBased + 1, 0)).getUTCDate();
  const mm = String(monthIndexZeroBased + 1).padStart(2, '0');
  const dd = String(lastDay).padStart(2, '0');
  return `${year}-${mm}-${dd}`;
}

function getMonthRangeBounds(periodKey: string): { startDate: string; endDate: string; label: string } | null {
  const match = /^(\d{4})-(\d{2})$/.exec(periodKey.trim());
  if (!match) return null;
  const year = Number(match[1]);
  const monthNum = Number(match[2]);
  if (monthNum < 1 || monthNum > 12) return null;
  const mm = String(monthNum).padStart(2, '0');
  const startDate = `${year}-${mm}-01`;
  const endDate = getLastDayOfMonthIso(year, monthNum - 1);
  const label = `${MONTH_ABBR[monthNum - 1]} ${year}`;
  return { startDate, endDate, label };
}

function getQuarterRangeBounds(periodKey: string): { startDate: string; endDate: string; label: string } | null {
  const match = /^(\d{4})-Q([1-4])$/i.exec(periodKey.trim());
  if (!match) return null;
  const year = Number(match[1]);
  const quarter = Number(match[2]);
  const startMonthIdx = (quarter - 1) * 3;
  const endMonthIdx = startMonthIdx + 2;
  const startMm = String(startMonthIdx + 1).padStart(2, '0');
  const startDate = `${year}-${startMm}-01`;
  const endDate = getLastDayOfMonthIso(year, endMonthIdx);
  const label = `Q${quarter} ${year}`;
  return { startDate, endDate, label };
}

function summarizePeriodGroup(
  key: string,
  label: string,
  cycleContext: string,
  startDate: string,
  endDate: string,
  groupPositions: PaperPosition[]
): JournalPeriodOption {
  const openCount = groupPositions.filter((p) => p.status === 'OPEN').length;
  const closed = groupPositions.filter((p) => p.status === 'CLOSED_PROFIT' || p.status === 'CLOSED_LOSS');
  const winCount = closed.filter((p) => p.status === 'CLOSED_PROFIT' || p.realizedPnl >= 0).length;
  const lossCount = closed.length - winCount;
  const winRatePct = closed.length > 0 ? Number(((winCount / closed.length) * 100).toFixed(1)) : 0;
  const realizedPnlUsd = Number(closed.reduce((acc, p) => acc + p.realizedPnl, 0).toFixed(2));

  return {
    key,
    label,
    cycleContext,
    startDate,
    endDate,
    tradeCount: groupPositions.length,
    openCount,
    closedCount: closed.length,
    winCount,
    lossCount,
    winRatePct,
    realizedPnlUsd,
  };
}

/**
 * Filters portfolio journal positions by month, quarter, custom date range, or all history,
 * and computes monthly/quarterly economic cycle performance rollups for trend comparison.
 */
export function filterPositionsByDateRange(
  positions: PaperPosition[],
  spec: JournalDateFilterSpec
): FilteredJournalSummary {
  const catalog = Array.isArray(positions) ? positions.filter((p) => p.status !== 'CANCELLED') : [];

  const monthGroups = new Map<string, PaperPosition[]>();
  const quarterGroups = new Map<string, PaperPosition[]>();

  for (const pos of catalog) {
    const dt = new Date(pos.openTime);
    if (Number.isNaN(dt.getTime())) continue;
    const year = dt.getUTCFullYear();
    const monthNum = dt.getUTCMonth() + 1;
    const quarterNum = Math.floor((monthNum - 1) / 3) + 1;

    const monthKey = `${year}-${String(monthNum).padStart(2, '0')}`;
    const quarterKey = `${year}-Q${quarterNum}`;

    if (!monthGroups.has(monthKey)) monthGroups.set(monthKey, []);
    monthGroups.get(monthKey)!.push(pos);

    if (!quarterGroups.has(quarterKey)) quarterGroups.set(quarterKey, []);
    quarterGroups.get(quarterKey)!.push(pos);
  }

  const availableMonths: JournalPeriodOption[] = Array.from(monthGroups.keys())
    .sort()
    .map((key) => {
      const bounds = getMonthRangeBounds(key)!;
      const qNum = Math.floor((Number(key.slice(5, 7)) - 1) / 3) + 1;
      const qKey = `${key.slice(0, 4)}-Q${qNum}`;
      const cycleContext = ECONOMIC_CYCLE_DESCRIPTORS[qKey] || `Q${qNum} ${key.slice(0, 4)} Macro Cycle`;
      return summarizePeriodGroup(
        key,
        bounds.label,
        cycleContext,
        bounds.startDate,
        bounds.endDate,
        monthGroups.get(key)!
      );
    });

  const availableQuarters: JournalPeriodOption[] = Array.from(quarterGroups.keys())
    .sort()
    .map((key) => {
      const bounds = getQuarterRangeBounds(key)!;
      const cycleContext = ECONOMIC_CYCLE_DESCRIPTORS[key] || `${bounds.label} Macro Regime`;
      return summarizePeriodGroup(
        key,
        bounds.label,
        cycleContext,
        bounds.startDate,
        bounds.endDate,
        quarterGroups.get(key)!
      );
    });

  let resolvedStartDate: string | null = null;
  let resolvedEndDate: string | null = null;
  let activeLabel = 'All Recorded Cycles';

  if (spec.granularity === 'MONTH') {
    const fallbackKey = availableMonths[availableMonths.length - 1]?.key || '2026-11';
    const bounds = getMonthRangeBounds(spec.periodKey || fallbackKey);
    if (bounds) {
      resolvedStartDate = bounds.startDate;
      resolvedEndDate = bounds.endDate;
      activeLabel = bounds.label;
    }
  } else if (spec.granularity === 'QUARTER') {
    const fallbackKey = availableQuarters[availableQuarters.length - 1]?.key || '2026-Q4';
    const bounds = getQuarterRangeBounds(spec.periodKey || fallbackKey);
    if (bounds) {
      resolvedStartDate = bounds.startDate;
      resolvedEndDate = bounds.endDate;
      const ctx = ECONOMIC_CYCLE_DESCRIPTORS[(spec.periodKey || fallbackKey).toUpperCase()];
      activeLabel = ctx ? `${bounds.label} · ${ctx}` : bounds.label;
    }
  } else if (spec.granularity === 'CUSTOM') {
    const rawStart = spec.startDate?.trim() || '';
    const rawEnd = spec.endDate?.trim() || '';
    if (rawStart && rawEnd && rawStart > rawEnd) {
      resolvedStartDate = rawEnd;
      resolvedEndDate = rawStart;
    } else {
      resolvedStartDate = rawStart || null;
      resolvedEndDate = rawEnd || null;
    }
    if (resolvedStartDate && resolvedEndDate) {
      activeLabel = `${resolvedStartDate} to ${resolvedEndDate}`;
    } else if (resolvedStartDate) {
      activeLabel = `From ${resolvedStartDate}`;
    } else if (resolvedEndDate) {
      activeLabel = `Through ${resolvedEndDate}`;
    } else {
      activeLabel = 'Custom Range (Unbounded)';
    }
  }

  const startMs = resolvedStartDate ? Date.parse(`${resolvedStartDate}T00:00:00.000Z`) : null;
  const endMs = resolvedEndDate ? Date.parse(`${resolvedEndDate}T23:59:59.999Z`) : null;

  const filtered = catalog.filter((pos) => {
    const ts = Date.parse(pos.openTime);
    if (Number.isNaN(ts)) return spec.granularity === 'ALL';
    if (startMs !== null && !Number.isNaN(startMs) && ts < startMs) return false;
    if (endMs !== null && !Number.isNaN(endMs) && ts > endMs) return false;
    return true;
  });

  const openCount = filtered.filter((p) => p.status === 'OPEN').length;
  const closed = filtered.filter((p) => p.status === 'CLOSED_PROFIT' || p.status === 'CLOSED_LOSS');
  const winCount = closed.filter((p) => p.status === 'CLOSED_PROFIT' || p.realizedPnl >= 0).length;
  const lossCount = closed.length - winCount;
  const winRatePct = closed.length > 0 ? Number(((winCount / closed.length) * 100).toFixed(1)) : 0;
  const realizedPnlUsd = Number(closed.reduce((acc, p) => acc + p.realizedPnl, 0).toFixed(2));

  let cycleTrendNote = `Showing all ${filtered.length} executed trades across ${availableQuarters.length} recorded macro quarters.`;
  if (spec.granularity !== 'ALL') {
    if (filtered.length === 0) {
      cycleTrendNote = `No trades recorded during ${activeLabel}. Select another month/quarter or reset to All Cycles.`;
    } else if (closed.length === 0) {
      cycleTrendNote = `${filtered.length} open position(s) active in ${activeLabel}; close trades to score realized cycle expectancy.`;
    } else {
      const sign = realizedPnlUsd >= 0 ? '+' : '-';
      cycleTrendNote = `${activeLabel}: ${closed.length} closed trade(s) (${winCount}W / ${lossCount}L, ${winRatePct}% hit rate) yielding ${sign}$${Math.abs(realizedPnlUsd).toLocaleString()} realized P&L.`;
    }
  }

  return {
    granularity: spec.granularity,
    activeLabel,
    resolvedStartDate,
    resolvedEndDate,
    positions: filtered,
    totalCatalogCount: catalog.length,
    totalMatchedCount: filtered.length,
    openCount,
    closedCount: closed.length,
    winCount,
    lossCount,
    winRatePct,
    realizedPnlUsd,
    cycleTrendNote,
    availableMonths,
    availableQuarters,
  };
}

// -----------------------------------------------------------------------------
// 9. Account Risk Metrics Dashboard Engine (Drawdown, Sharpe & Sortino)
// -----------------------------------------------------------------------------

export interface EquityDrawdownPoint {
  stepIndex: number;
  positionId: string;
  dateLabel: string;
  status: 'BASELINE' | 'CLOSED_PROFIT' | 'CLOSED_LOSS' | 'OPEN_MTM';
  tradePnlUsd: number;
  tradeReturnPct: number;
  equityUsd: number;
  peakEquityUsd: number;
  drawdownUsd: number;
  drawdownPct: number;
}

export interface AccountRiskMetricsSummary {
  tradesAnalyzedCount: number;
  closedTradesCount: number;
  openTradesCount: number;
  startingCapitalUsd: number;
  currentEquityUsd: number;
  peakEquityUsd: number;
  netReturnUsd: number;
  netReturnPct: number;
  annualizedReturnPct: number;
  currentDrawdownPct: number;
  currentDrawdownUsd: number;
  maxDrawdownPct: number;
  maxDrawdownUsd: number;
  maxDrawdownPositionId: string | null;
  recoveryNeededPct: number;
  isAtPeakEquity: boolean;
  sharpeRatio: number;
  sortinoRatio: number;
  calmarRatio: number;
  annualizedVolatilityPct: number;
  annualizedDownsideDevPct: number;
  riskFreeRateAnnualPct: number;
  tradesPerYearUsed: number;
  hasZeroDownsideTrades: boolean;
  riskProfileBand: 'INSTITUTIONAL_GRADE' | 'BALANCED' | 'ELEVATED_DRAWDOWN' | 'INSUFFICIENT_DATA';
  summaryNote: string;
  equitySeries: EquityDrawdownPoint[];
}

/**
 * Computes institutional portfolio risk-adjusted performance metrics (Maximum & Current
 * Drawdown, Annualized Sharpe Ratio, Sortino Ratio, Calmar Ratio, and equity underwater path)
 * from the paper trading ledger + live open position mark-to-market.
 */
export function calculateAccountRiskMetrics(
  positions: PaperPosition[],
  options: {
    startingCapitalUsd?: number;
    riskFreeRateAnnualPct?: number;
    quotes?: Record<string, Quote>;
    defaultQuote?: Quote;
  } = {}
): AccountRiskMetricsSummary {
  const startingCapitalUsd = Math.max(1000, options.startingCapitalUsd ?? 100000);
  const riskFreeRateAnnualPct = Math.max(0, Math.min(15, options.riskFreeRateAnnualPct ?? 4.25));

  const valid = (Array.isArray(positions) ? positions : [])
    .filter((p) => p.status !== 'CANCELLED')
    .sort((a, b) => new Date(a.openTime).getTime() - new Date(b.openTime).getTime());

  const closedTrades = valid.filter((p) => p.status === 'CLOSED_PROFIT' || p.status === 'CLOSED_LOSS');
  const openTrades = valid.filter((p) => p.status === 'OPEN');

  const equitySeries: EquityDrawdownPoint[] = [
    {
      stepIndex: 0,
      positionId: 'START',
      dateLabel: 'Start',
      status: 'BASELINE',
      tradePnlUsd: 0,
      tradeReturnPct: 0,
      equityUsd: Number(startingCapitalUsd.toFixed(2)),
      peakEquityUsd: Number(startingCapitalUsd.toFixed(2)),
      drawdownUsd: 0,
      drawdownPct: 0,
    },
  ];

  let runningEquity = startingCapitalUsd;
  let runningPeak = startingCapitalUsd;
  let maxDrawdownPct = 0;
  let maxDrawdownUsd = 0;
  let maxDrawdownPositionId: string | null = null;

  const tradeReturnsPct: number[] = [];
  const timestampsMs: number[] = [];

  const pushStep = (
    posId: string,
    openTime: string,
    status: EquityDrawdownPoint['status'],
    pnlUsd: number
  ) => {
    const preEquity = Math.max(1, runningEquity);
    const tradeRetPct = (pnlUsd / preEquity) * 100;
    tradeReturnsPct.push(tradeRetPct);

    const ts = Date.parse(openTime);
    if (!Number.isNaN(ts)) timestampsMs.push(ts);

    runningEquity = Math.max(0, runningEquity + pnlUsd);
    if (runningEquity > runningPeak) {
      runningPeak = runningEquity;
    }

    const ddUsd = Math.max(0, runningPeak - runningEquity);
    const ddPct = runningPeak > 0 ? (ddUsd / runningPeak) * 100 : 0;

    if (ddPct > maxDrawdownPct) {
      maxDrawdownPct = ddPct;
      maxDrawdownUsd = ddUsd;
      maxDrawdownPositionId = posId;
    }

    const dt = new Date(openTime);
    const dateLabel = Number.isNaN(dt.getTime())
      ? `#${equitySeries.length}`
      : dt.toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' });

    equitySeries.push({
      stepIndex: equitySeries.length,
      positionId: posId,
      dateLabel,
      status,
      tradePnlUsd: Number(pnlUsd.toFixed(2)),
      tradeReturnPct: Number(tradeRetPct.toFixed(2)),
      equityUsd: Number(runningEquity.toFixed(2)),
      peakEquityUsd: Number(runningPeak.toFixed(2)),
      drawdownUsd: Number(ddUsd.toFixed(2)),
      drawdownPct: Number(ddPct.toFixed(2)),
    });
  };

  for (const pos of closedTrades) {
    pushStep(
      pos.id,
      pos.openTime,
      pos.realizedPnl >= 0 ? 'CLOSED_PROFIT' : 'CLOSED_LOSS',
      pos.realizedPnl
    );
  }

  for (const pos of openTrades) {
    const multiplier = getInstrumentMultiplierForMae(pos.instrumentId);
    const mark =
      options.quotes?.[pos.instrumentId]?.mid ??
      (pos.instrumentId === 'XAUUSD' && options.defaultQuote
        ? options.defaultQuote.mid
        : pos.currentPrice);
    const diff = pos.direction === 'SELL' ? pos.entryPrice - mark : mark - pos.entryPrice;
    const liveMtmPnl = diff * pos.lots * multiplier;
    pushStep(pos.id, pos.openTime, 'OPEN_MTM', liveMtmPnl);
  }

  const tradesAnalyzedCount = tradeReturnsPct.length;
  const currentEquityUsd = Number(runningEquity.toFixed(2));
  const peakEquityUsd = Number(runningPeak.toFixed(2));
  const netReturnUsd = Number((currentEquityUsd - startingCapitalUsd).toFixed(2));
  const netReturnPct = Number(((netReturnUsd / startingCapitalUsd) * 100).toFixed(2));

  const currentDrawdownUsd = Number(Math.max(0, peakEquityUsd - currentEquityUsd).toFixed(2));
  const currentDrawdownPct =
    peakEquityUsd > 0 ? Number(((currentDrawdownUsd / peakEquityUsd) * 100).toFixed(2)) : 0;
  const isAtPeakEquity = currentDrawdownUsd <= 0.01;
  const recoveryNeededPct =
    !isAtPeakEquity && currentEquityUsd > 0
      ? Number((((peakEquityUsd - currentEquityUsd) / currentEquityUsd) * 100).toFixed(2))
      : 0;

  let tradesPerYearUsed = 24;
  if (timestampsMs.length >= 2) {
    const minTs = Math.min(...timestampsMs);
    const maxTs = Math.max(...timestampsMs);
    const spanDays = Math.max(30, (maxTs - minTs) / 86_400_000);
    tradesPerYearUsed = Number(
      Math.max(12, Math.min(104, (tradesAnalyzedCount / spanDays) * 365)).toFixed(1)
    );
  }

  const rfPerTradePct = riskFreeRateAnnualPct / tradesPerYearUsed;
  const meanTradeReturnPct =
    tradesAnalyzedCount > 0
      ? tradeReturnsPct.reduce((s, r) => s + r, 0) / tradesAnalyzedCount
      : 0;
  const annualizedReturnPct = Number((meanTradeReturnPct * tradesPerYearUsed).toFixed(2));

  const sampleVariance =
    tradesAnalyzedCount >= 2
      ? tradeReturnsPct.reduce((acc, r) => acc + Math.pow(r - meanTradeReturnPct, 2), 0) /
        (tradesAnalyzedCount - 1)
      : 0;
  const stdDevPct = Math.sqrt(sampleVariance);
  const annualizedVolatilityPct = Number(
    (stdDevPct * Math.sqrt(tradesPerYearUsed)).toFixed(2)
  );

  // Downside deviation vs per-trade risk-free MAR
  const downsideSqSum =
    tradesAnalyzedCount > 0
      ? tradeReturnsPct.reduce((acc, r) => {
          const deficit = Math.min(0, r - rfPerTradePct);
          return acc + deficit * deficit;
        }, 0) / tradesAnalyzedCount
      : 0;
  const downsideDevPct = Math.sqrt(downsideSqSum);
  const annualizedDownsideDevPct = Number(
    (downsideDevPct * Math.sqrt(tradesPerYearUsed)).toFixed(2)
  );
  const hasZeroDownsideTrades = tradesAnalyzedCount > 0 && downsideDevPct <= 1e-6;

  const sharpeRatio =
    tradesAnalyzedCount >= 2 && stdDevPct > 1e-6
      ? Number(
          (((meanTradeReturnPct - rfPerTradePct) / stdDevPct) * Math.sqrt(tradesPerYearUsed)).toFixed(2)
        )
      : 0;

  let sortinoRatio = 0;
  if (tradesAnalyzedCount > 0) {
    if (downsideDevPct > 1e-6) {
      sortinoRatio = Number(
        (
          ((meanTradeReturnPct - rfPerTradePct) / downsideDevPct) *
          Math.sqrt(tradesPerYearUsed)
        ).toFixed(2)
      );
    } else if (meanTradeReturnPct > rfPerTradePct) {
      sortinoRatio = 9.99;
    }
  }

  const roundedMaxDdPct = Number(maxDrawdownPct.toFixed(2));
  const calmarRatio =
    roundedMaxDdPct > 0.01
      ? Number((annualizedReturnPct / roundedMaxDdPct).toFixed(2))
      : annualizedReturnPct > 0
      ? 9.99
      : 0;

  let riskProfileBand: AccountRiskMetricsSummary['riskProfileBand'] = 'INSUFFICIENT_DATA';
  if (tradesAnalyzedCount >= 2) {
    if (roundedMaxDdPct >= 10 || sharpeRatio < 0.5) {
      riskProfileBand = 'ELEVATED_DRAWDOWN';
    } else if (sharpeRatio >= 1.5 && sortinoRatio >= 2.0) {
      riskProfileBand = 'INSTITUTIONAL_GRADE';
    } else {
      riskProfileBand = 'BALANCED';
    }
  }

  let summaryNote =
    'Execute or close at least two paper trades to compute annualized Sharpe, Sortino, and drawdown metrics.';
  if (tradesAnalyzedCount >= 1) {
    const ddText = isAtPeakEquity
      ? 'Account sits at all-time peak equity (0.00% current drawdown)'
      : `Current drawdown is -${currentDrawdownPct.toFixed(2)}% (-$${currentDrawdownUsd.toLocaleString()} below $${peakEquityUsd.toLocaleString()} high-water mark)`;
    summaryNote = `${ddText}; historical max drawdown reached -${roundedMaxDdPct.toFixed(2)}% with ${sharpeRatio.toFixed(2)} Sharpe and ${hasZeroDownsideTrades && sortinoRatio >= 9.99 ? '>9.99' : sortinoRatio.toFixed(2)} Sortino.`;
  }

  return {
    tradesAnalyzedCount,
    closedTradesCount: closedTrades.length,
    openTradesCount: openTrades.length,
    startingCapitalUsd,
    currentEquityUsd,
    peakEquityUsd,
    netReturnUsd,
    netReturnPct,
    annualizedReturnPct,
    currentDrawdownPct,
    currentDrawdownUsd,
    maxDrawdownPct: roundedMaxDdPct,
    maxDrawdownUsd: Number(maxDrawdownUsd.toFixed(2)),
    maxDrawdownPositionId,
    recoveryNeededPct,
    isAtPeakEquity,
    sharpeRatio,
    sortinoRatio,
    calmarRatio,
    annualizedVolatilityPct,
    annualizedDownsideDevPct,
    riskFreeRateAnnualPct,
    tradesPerYearUsed,
    hasZeroDownsideTrades,
    riskProfileBand,
    summaryNote,
    equitySeries,
  };
}

// -----------------------------------------------------------------------------
// 10. Trade Expectancy Monte Carlo Projection Engine
// -----------------------------------------------------------------------------

export interface MonteCarloFanPoint {
  step: number;
  p10EquityUsd: number;
  p25EquityUsd: number;
  p50EquityUsd: number;
  p75EquityUsd: number;
  p90EquityUsd: number;
}

export interface MonteCarloSamplePath {
  iteration: number;
  terminalEquityUsd: number;
  terminalReturnPct: number;
  maxDrawdownPct: number;
  equityPoints: number[];
}

export interface MonteCarloDrawdownBucket {
  bucketId: 'LT_2' | 'PCT_2_5' | 'PCT_5_10' | 'PCT_10_15' | 'GT_15';
  label: string;
  count: number;
  sharePct: number;
  isSevere: boolean;
}

export interface TradeExpectancyProjectionSummary {
  hasSufficientData: boolean;
  closedTradesCount: number;
  horizonTrades: number;
  iterationsCount: number;
  riskScalePct: number;
  blockLengthUsed: number;
  seedUsed: number;
  startingCapitalUsd: number;
  historicalWinRatePct: number;
  historicalExpectancyUsd: number;
  historicalExpectancyR: number;
  medianProjectedEquityUsd: number;
  medianProjectedReturnUsd: number;
  medianProjectedReturnPct: number;
  downsideP10EquityUsd: number;
  downsideP10ReturnPct: number;
  conservativeP25EquityUsd: number;
  conservativeP25ReturnPct: number;
  upsideP75EquityUsd: number;
  upsideP75ReturnPct: number;
  upsideP90EquityUsd: number;
  upsideP90ReturnPct: number;
  probabilityOfProfitPct: number;
  medianMaxDrawdownPct: number;
  p75MaxDrawdownPct: number;
  p90MaxDrawdownPct: number;
  p95MaxDrawdownPct: number;
  p99MaxDrawdownPct: number;
  worstSimulatedDrawdownPct: number;
  probabilityOf20PctDrawdownPct: number;
  riskOutlook: 'FAVORABLE_ASYMMETRY' | 'MODERATE_VARIANCE' | 'ELEVATED_TAIL_RISK' | 'INSUFFICIENT_DATA';
  forecastSummary: string;
  fanSeries: MonteCarloFanPoint[];
  samplePaths: MonteCarloSamplePath[];
  drawdownHistogram: MonteCarloDrawdownBucket[];
}

function createMulberry32Prng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function quantileSorted(sortedValues: number[], q: number): number {
  if (sortedValues.length === 0) return 0;
  if (sortedValues.length === 1) return sortedValues[0];
  const clampedQ = Math.max(0, Math.min(1, q));
  const pos = (sortedValues.length - 1) * clampedQ;
  const base = Math.floor(pos);
  const rest = pos - base;
  const lower = sortedValues[base];
  const upper = sortedValues[Math.min(sortedValues.length - 1, base + 1)];
  return lower + rest * (upper - lower);
}

/**
 * Runs a circular block-bootstrap Monte Carlo simulation over historical closed trades
 * to project forward profitability confidence cones (P10-P90) and tail drawdown scenarios.
 */
export function runTradeExpectancyMonteCarloProjection(
  positions: PaperPosition[],
  options: {
    horizonTrades?: number;
    iterations?: number;
    startingCapitalUsd?: number;
    riskScalePct?: number;
    blockLength?: number;
    seed?: number;
  } = {}
): TradeExpectancyProjectionSummary {
  const horizonTrades = Math.max(10, Math.min(120, Math.round(options.horizonTrades ?? 40)));
  const iterationsCount = Math.max(100, Math.min(2000, Math.round(options.iterations ?? 500)));
  const startingCapitalUsd = Math.max(1000, options.startingCapitalUsd ?? 100000);
  const riskScalePct = Math.max(25, Math.min(250, Math.round(options.riskScalePct ?? 100)));
  const seedUsed = Math.round(options.seed ?? 20261117);

  const closedTrades = (Array.isArray(positions) ? positions : [])
    .filter((p) => p.status === 'CLOSED_PROFIT' || p.status === 'CLOSED_LOSS')
    .sort((a, b) => new Date(a.openTime).getTime() - new Date(b.openTime).getTime());

  const emptyHistogram: MonteCarloDrawdownBucket[] = [
    { bucketId: 'LT_2', label: '< 2%', count: 0, sharePct: 0, isSevere: false },
    { bucketId: 'PCT_2_5', label: '2%–5%', count: 0, sharePct: 0, isSevere: false },
    { bucketId: 'PCT_5_10', label: '5%–10%', count: 0, sharePct: 0, isSevere: false },
    { bucketId: 'PCT_10_15', label: '10%–15%', count: 0, sharePct: 0, isSevere: true },
    { bucketId: 'GT_15', label: '> 15%', count: 0, sharePct: 0, isSevere: true },
  ];

  if (closedTrades.length < 2) {
    return {
      hasSufficientData: false,
      closedTradesCount: closedTrades.length,
      horizonTrades,
      iterationsCount,
      riskScalePct,
      blockLengthUsed: 1,
      seedUsed,
      startingCapitalUsd,
      historicalWinRatePct: 0,
      historicalExpectancyUsd: 0,
      historicalExpectancyR: 0,
      medianProjectedEquityUsd: startingCapitalUsd,
      medianProjectedReturnUsd: 0,
      medianProjectedReturnPct: 0,
      downsideP10EquityUsd: startingCapitalUsd,
      downsideP10ReturnPct: 0,
      conservativeP25EquityUsd: startingCapitalUsd,
      conservativeP25ReturnPct: 0,
      upsideP75EquityUsd: startingCapitalUsd,
      upsideP75ReturnPct: 0,
      upsideP90EquityUsd: startingCapitalUsd,
      upsideP90ReturnPct: 0,
      probabilityOfProfitPct: 0,
      medianMaxDrawdownPct: 0,
      p75MaxDrawdownPct: 0,
      p90MaxDrawdownPct: 0,
      p95MaxDrawdownPct: 0,
      p99MaxDrawdownPct: 0,
      worstSimulatedDrawdownPct: 0,
      probabilityOf20PctDrawdownPct: 0,
      riskOutlook: 'INSUFFICIENT_DATA',
      forecastSummary:
        'At least 2 closed trades are required in the selected cycle to run a Monte Carlo expectancy and drawdown projection.',
      fanSeries: [],
      samplePaths: [],
      drawdownHistogram: emptyHistogram,
    };
  }

  // Compute historical per-trade return ratios & R-multiples chronologically
  let histEquity = startingCapitalUsd;
  let wins = 0;
  let sumR = 0;
  let sumPnlUsd = 0;
  const historicalReturnRatios: number[] = [];

  for (const pos of closedTrades) {
    const multiplier = getInstrumentMultiplierForMae(pos.instrumentId);
    const stopDist = Math.max(0.01, Math.abs(pos.entryPrice - pos.stopLoss));
    const oneRUsd = Math.max(1, stopDist * pos.lots * multiplier);
    const rMultiple = pos.realizedPnl / oneRUsd;
    sumR += rMultiple;
    sumPnlUsd += pos.realizedPnl;
    if (pos.realizedPnl >= 0) wins++;

    const preEq = Math.max(startingCapitalUsd * 0.2, histEquity);
    const retRatio = Math.max(-0.5, Math.min(0.75, pos.realizedPnl / preEq));
    historicalReturnRatios.push(retRatio);
    histEquity = Math.max(100, histEquity + pos.realizedPnl);
  }

  const nHist = historicalReturnRatios.length;
  const blockLengthUsed = Math.max(1, Math.min(3, Math.floor(Math.sqrt(nHist))));
  const scaleFactor = riskScalePct / 100;
  const rand = createMulberry32Prng(seedUsed);

  const stepEquityMatrix: number[][] = Array.from(
    { length: horizonTrades + 1 },
    () => new Array<number>(iterationsCount)
  );
  const terminalEquities = new Array<number>(iterationsCount);
  const maxDrawdownsPct = new Array<number>(iterationsCount);
  const samplePaths: MonteCarloSamplePath[] = [];
  const sampleStride = Math.max(1, Math.floor(iterationsCount / 14));

  let profitableRuns = 0;
  let severe20Runs = 0;

  for (let iter = 0; iter < iterationsCount; iter++) {
    let eq = startingCapitalUsd;
    let peak = startingCapitalUsd;
    let maxDdPct = 0;

    stepEquityMatrix[0][iter] = eq;
    const captureSample = samplePaths.length < 14 && iter % sampleStride === 0;
    const pathPoints: number[] = captureSample ? [Number(eq.toFixed(2))] : [];

    let stepIdx = 0;
    while (stepIdx < horizonTrades) {
      const startBlock = Math.floor(rand() * nHist);
      for (let b = 0; b < blockLengthUsed && stepIdx < horizonTrades; b++) {
        const srcIdx = (startBlock + b) % nHist;
        const scaledRet = Math.max(-0.6, historicalReturnRatios[srcIdx] * scaleFactor);
        eq = Math.max(0, eq * (1 + scaledRet));
        if (eq > peak) {
          peak = eq;
        }
        const ddPct = peak > 0 ? ((peak - eq) / peak) * 100 : 0;
        if (ddPct > maxDdPct) {
          maxDdPct = ddPct;
        }

        stepIdx++;
        stepEquityMatrix[stepIdx][iter] = eq;
        if (captureSample) {
          pathPoints.push(Number(eq.toFixed(2)));
        }
      }
    }

    terminalEquities[iter] = eq;
    maxDrawdownsPct[iter] = maxDdPct;
    if (eq > startingCapitalUsd) profitableRuns++;
    if (maxDdPct >= 20) severe20Runs++;

    if (captureSample) {
      samplePaths.push({
        iteration: iter + 1,
        terminalEquityUsd: Number(eq.toFixed(2)),
        terminalReturnPct: Number((((eq - startingCapitalUsd) / startingCapitalUsd) * 100).toFixed(2)),
        maxDrawdownPct: Number(maxDdPct.toFixed(2)),
        equityPoints: pathPoints,
      });
    }

    const bucket =
      maxDdPct < 2
        ? emptyHistogram[0]
        : maxDdPct < 5
        ? emptyHistogram[1]
        : maxDdPct < 10
        ? emptyHistogram[2]
        : maxDdPct < 15
        ? emptyHistogram[3]
        : emptyHistogram[4];
    bucket.count += 1;
  }

  for (const b of emptyHistogram) {
    b.sharePct = Number(((b.count / iterationsCount) * 100).toFixed(1));
  }

  const fanSeries: MonteCarloFanPoint[] = [];
  for (let s = 0; s <= horizonTrades; s++) {
    const col = [...stepEquityMatrix[s]].sort((a, b) => a - b);
    fanSeries.push({
      step: s,
      p10EquityUsd: Number(quantileSorted(col, 0.1).toFixed(2)),
      p25EquityUsd: Number(quantileSorted(col, 0.25).toFixed(2)),
      p50EquityUsd: Number(quantileSorted(col, 0.5).toFixed(2)),
      p75EquityUsd: Number(quantileSorted(col, 0.75).toFixed(2)),
      p90EquityUsd: Number(quantileSorted(col, 0.9).toFixed(2)),
    });
  }

  const sortedTerminal = [...terminalEquities].sort((a, b) => a - b);
  const sortedDd = [...maxDrawdownsPct].sort((a, b) => a - b);

  const pctReturn = (eq: number) =>
    Number((((eq - startingCapitalUsd) / startingCapitalUsd) * 100).toFixed(2));

  const downsideP10EquityUsd = Number(quantileSorted(sortedTerminal, 0.1).toFixed(2));
  const conservativeP25EquityUsd = Number(quantileSorted(sortedTerminal, 0.25).toFixed(2));
  const medianProjectedEquityUsd = Number(quantileSorted(sortedTerminal, 0.5).toFixed(2));
  const upsideP75EquityUsd = Number(quantileSorted(sortedTerminal, 0.75).toFixed(2));
  const upsideP90EquityUsd = Number(quantileSorted(sortedTerminal, 0.9).toFixed(2));

  const medianProjectedReturnUsd = Number((medianProjectedEquityUsd - startingCapitalUsd).toFixed(2));
  const medianProjectedReturnPct = pctReturn(medianProjectedEquityUsd);

  const medianMaxDrawdownPct = Number(quantileSorted(sortedDd, 0.5).toFixed(2));
  const p75MaxDrawdownPct = Number(quantileSorted(sortedDd, 0.75).toFixed(2));
  const p90MaxDrawdownPct = Number(quantileSorted(sortedDd, 0.9).toFixed(2));
  const p95MaxDrawdownPct = Number(quantileSorted(sortedDd, 0.95).toFixed(2));
  const p99MaxDrawdownPct = Number(quantileSorted(sortedDd, 0.99).toFixed(2));
  const worstSimulatedDrawdownPct = Number(sortedDd[sortedDd.length - 1].toFixed(2));

  const probabilityOfProfitPct = Number(((profitableRuns / iterationsCount) * 100).toFixed(1));
  const probabilityOf20PctDrawdownPct = Number(((severe20Runs / iterationsCount) * 100).toFixed(1));

  const historicalWinRatePct = Number(((wins / nHist) * 100).toFixed(1));
  const historicalExpectancyUsd = Number((sumPnlUsd / nHist).toFixed(2));
  const historicalExpectancyR = Number((sumR / nHist).toFixed(2));

  let riskOutlook: TradeExpectancyProjectionSummary['riskOutlook'] = 'MODERATE_VARIANCE';
  if (probabilityOfProfitPct >= 75 && p95MaxDrawdownPct < 15) {
    riskOutlook = 'FAVORABLE_ASYMMETRY';
  } else if (probabilityOfProfitPct < 50 || p95MaxDrawdownPct >= 20) {
    riskOutlook = 'ELEVATED_TAIL_RISK';
  }

  const sign = medianProjectedReturnPct >= 0 ? '+' : '';
  const forecastSummary = `Across ${iterationsCount.toLocaleString()} circular block-bootstrap paths over ${horizonTrades} future trades (${riskScalePct}% risk scale), median equity reaches $${medianProjectedEquityUsd.toLocaleString()} (${sign}${medianProjectedReturnPct}%) with a ${probabilityOfProfitPct}% probability of profit and a ${p95MaxDrawdownPct.toFixed(2)}% 95th-percentile tail drawdown.`;

  return {
    hasSufficientData: true,
    closedTradesCount: nHist,
    horizonTrades,
    iterationsCount,
    riskScalePct,
    blockLengthUsed,
    seedUsed,
    startingCapitalUsd,
    historicalWinRatePct,
    historicalExpectancyUsd,
    historicalExpectancyR,
    medianProjectedEquityUsd,
    medianProjectedReturnUsd,
    medianProjectedReturnPct,
    downsideP10EquityUsd,
    downsideP10ReturnPct: pctReturn(downsideP10EquityUsd),
    conservativeP25EquityUsd,
    conservativeP25ReturnPct: pctReturn(conservativeP25EquityUsd),
    upsideP75EquityUsd,
    upsideP75ReturnPct: pctReturn(upsideP75EquityUsd),
    upsideP90EquityUsd,
    upsideP90ReturnPct: pctReturn(upsideP90EquityUsd),
    probabilityOfProfitPct,
    medianMaxDrawdownPct,
    p75MaxDrawdownPct,
    p90MaxDrawdownPct,
    p95MaxDrawdownPct,
    p99MaxDrawdownPct,
    worstSimulatedDrawdownPct,
    probabilityOf20PctDrawdownPct,
    riskOutlook,
    forecastSummary,
    fanSeries,
    samplePaths,
    drawdownHistogram: emptyHistogram,
  };
}

// -----------------------------------------------------------------------------
// 11. Advisory Horizon Performance Heatmap Engine (Intraday, Swing, Long-Term)
// -----------------------------------------------------------------------------

export type HorizonCategory = 'INTRADAY' | 'SWING' | 'LONG_TERM';

export type HorizonBucketId =
  | 'STOP_LOSS'
  | 'PARTIAL_LOSS'
  | 'SMALL_WIN'
  | 'TARGET_WIN'
  | 'RUNNER_WIN';

export type HorizonHeatmapScope = 'CLOSED_ONLY' | 'ALL_EXECUTED';

export interface HorizonAttributedTrade {
  positionId: string;
  instrumentId: string;
  horizon: HorizonCategory;
  direction: 'BUY' | 'SELL';
  status: PaperPosition['status'];
  bucketId: HorizonBucketId;
  pnlUsd: number;
  roiPct: number;
  rMultiple: number;
  lots: number;
  openTime: string;
  notes: string;
}

export interface HorizonHeatmapCell {
  horizon: HorizonCategory;
  bucketId: HorizonBucketId;
  bucketLabel: string;
  isWinBucket: boolean;
  tradeCount: number;
  horizonSharePct: number;
  netPnlUsd: number;
  roiContributionPct: number;
  avgRMultiple: number;
  intensity: number; // 0.0 to 1.0 scaled inside polarity
  trades: HorizonAttributedTrade[];
}

export interface HorizonPerformanceRow {
  horizon: HorizonCategory;
  label: string;
  timeframeTag: string;
  totalTrades: number;
  closedTrades: number;
  openTrades: number;
  winCount: number;
  lossCount: number;
  winRatePct: number;
  lossRatePct: number;
  netPnlUsd: number;
  grossProfitUsd: number;
  grossLossUsd: number;
  profitFactor: number;
  roiPct: number; // Net P&L as % of starting account equity
  returnOnMarginPct: number; // Net P&L as % of margin deployed for this horizon
  avgExpectancyR: number;
  avgWinUsd: number;
  avgLossUsd: number;
  isHighestRoi: boolean;
  cells: HorizonHeatmapCell[];
}

export interface HorizonPerformanceHeatmapSummary {
  scope: HorizonHeatmapScope;
  startingCapitalUsd: number;
  totalAnalyzedTrades: number;
  totalWinCount: number;
  totalLossCount: number;
  totalNetPnlUsd: number;
  totalAccountRoiPct: number;
  bestRoiHorizon: HorizonCategory | null;
  bestWinRateHorizon: HorizonCategory | null;
  weakestRoiHorizon: HorizonCategory | null;
  roiSpreadPct: number;
  maxCellSharePct: number;
  bucketColumns: Array<{
    bucketId: HorizonBucketId;
    label: string;
    shortRange: string;
    isWinBucket: boolean;
  }>;
  rows: HorizonPerformanceRow[];
  insightSummary: string;
}

const HORIZON_META: Record<HorizonCategory, { label: string; timeframeTag: string }> = {
  INTRADAY: { label: 'Intraday', timeframeTag: 'M15 / H1 Session' },
  SWING: { label: 'Swing', timeframeTag: 'H4 / 1D Structural' },
  LONG_TERM: { label: 'Long-Term', timeframeTag: 'W1 Macro Trend' },
};

const HORIZON_BUCKET_COLUMNS: HorizonPerformanceHeatmapSummary['bucketColumns'] = [
  { bucketId: 'STOP_LOSS', label: 'Full Stop', shortRange: '<= -1.0R', isWinBucket: false },
  { bucketId: 'PARTIAL_LOSS', label: 'Cut Loss', shortRange: '-1R to 0R', isWinBucket: false },
  { bucketId: 'SMALL_WIN', label: 'Base Win', shortRange: '0R to +1R', isWinBucket: true },
  { bucketId: 'TARGET_WIN', label: 'Target Win', shortRange: '+1R to +2R', isWinBucket: true },
  { bucketId: 'RUNNER_WIN', label: 'Extended', shortRange: '> +2.0R', isWinBucket: true },
];

/**
 * Resolves a PaperPosition into one of the three canonical Advisory Horizons
 * (`INTRADAY`, `SWING`, `LONG_TERM`), honoring explicit tags first and falling
 * back deterministically to plan IDs, thesis notes, and structural stop distance.
 */
export function resolvePositionAdvisoryHorizon(pos: PaperPosition): HorizonCategory {
  if (pos.advisoryHorizon === 'INTRADAY' || pos.advisoryHorizon === 'SHORT_TERM') {
    return 'INTRADAY';
  }
  if (pos.advisoryHorizon === 'LONG_TERM') {
    return 'LONG_TERM';
  }
  if (pos.advisoryHorizon === 'SWING') {
    return 'SWING';
  }

  const signature = `${pos.tradePlanId || ''} ${pos.notes || ''}`.toUpperCase();
  if (
    signature.includes('LONG_TERM') ||
    signature.includes('LONG-TERM') ||
    signature.includes('MACRO') ||
    signature.includes('W1') ||
    signature.includes('SOVEREIGN') ||
    signature.includes('JACKSON HOLE')
  ) {
    return 'LONG_TERM';
  }
  if (
    signature.includes('INTRADAY') ||
    signature.includes('SCALP') ||
    signature.includes('M15') ||
    signature.includes('LONDON SESSION')
  ) {
    return 'INTRADAY';
  }
  if (signature.includes('SWING') || signature.includes('H4')) {
    return 'SWING';
  }

  const stopPct =
    pos.entryPrice > 0 ? (Math.abs(pos.entryPrice - pos.stopLoss) / pos.entryPrice) * 100 : 0.7;
  if (stopPct <= 0.45) return 'INTRADAY';
  if (stopPct >= 1.15) return 'LONG_TERM';
  return 'SWING';
}

function classifyOutcomeBucket(rMultiple: number, pnlUsd: number): HorizonBucketId {
  if (pnlUsd < 0) {
    return rMultiple <= -0.85 ? 'STOP_LOSS' : 'PARTIAL_LOSS';
  }
  if (rMultiple <= 1.0) return 'SMALL_WIN';
  if (rMultiple <= 2.0) return 'TARGET_WIN';
  return 'RUNNER_WIN';
}

/**
 * Aggregates win/loss distribution and ROI metrics by Advisory Horizon
 * (Intraday, Swing, Long-Term) across a matrix of 5 outcome R-multiple bands.
 */
export function calculateHorizonPerformanceHeatmap(
  positions: PaperPosition[],
  options: {
    scope?: HorizonHeatmapScope;
    startingCapitalUsd?: number;
    quotes?: Record<string, Quote>;
    defaultQuote?: Quote;
    assumedLeverage?: number;
  } = {}
): HorizonPerformanceHeatmapSummary {
  const scope: HorizonHeatmapScope = options.scope ?? 'CLOSED_ONLY';
  const startingCapitalUsd = Math.max(1000, options.startingCapitalUsd ?? 100000);
  const assumedLeverage = Math.max(1, options.assumedLeverage ?? 30);

  const eligiblePositions = (Array.isArray(positions) ? positions : []).filter((pos) => {
    if (pos.status === 'CANCELLED') return false;
    if (scope === 'CLOSED_ONLY') {
      return pos.status === 'CLOSED_PROFIT' || pos.status === 'CLOSED_LOSS';
    }
    return true;
  });

  const orderedHorizons: HorizonCategory[] = ['INTRADAY', 'SWING', 'LONG_TERM'];

  const bucketMaps = new Map<HorizonCategory, Map<HorizonBucketId, HorizonAttributedTrade[]>>();
  const marginCommittedMap = new Map<HorizonCategory, number>();
  const closedCountMap = new Map<HorizonCategory, number>();
  const openCountMap = new Map<HorizonCategory, number>();

  for (const h of orderedHorizons) {
    const colMap = new Map<HorizonBucketId, HorizonAttributedTrade[]>();
    for (const col of HORIZON_BUCKET_COLUMNS) {
      colMap.set(col.bucketId, []);
    }
    bucketMaps.set(h, colMap);
    marginCommittedMap.set(h, 0);
    closedCountMap.set(h, 0);
    openCountMap.set(h, 0);
  }

  for (const pos of eligiblePositions) {
    const horizon = resolvePositionAdvisoryHorizon(pos);
    const multiplier = getInstrumentMultiplierForMae(pos.instrumentId);

    let pnlUsd = pos.realizedPnl;
    if (pos.status === 'OPEN') {
      const mark =
        options.quotes?.[pos.instrumentId]?.mid ??
        (options.defaultQuote?.instrumentId === pos.instrumentId
          ? options.defaultQuote.mid
          : undefined) ??
        (pos.instrumentId === 'XAUUSD' && options.defaultQuote ? options.defaultQuote.mid : undefined) ??
        pos.currentPrice;
      const delta = pos.direction === 'SELL' ? pos.entryPrice - mark : mark - pos.entryPrice;
      pnlUsd = delta * pos.lots * multiplier;
      openCountMap.set(horizon, (openCountMap.get(horizon) ?? 0) + 1);
    } else {
      closedCountMap.set(horizon, (closedCountMap.get(horizon) ?? 0) + 1);
    }

    const stopDist = Math.max(0.01, Math.abs(pos.entryPrice - pos.stopLoss));
    const oneRUsd = Math.max(1, stopDist * pos.lots * multiplier);
    const rMultiple = Number((pnlUsd / oneRUsd).toFixed(2));
    const roiPct = Number(((pnlUsd / startingCapitalUsd) * 100).toFixed(2));

    const notional = Math.max(100, pos.entryPrice * pos.lots * multiplier);
    const marginUsd = notional / assumedLeverage;
    marginCommittedMap.set(horizon, (marginCommittedMap.get(horizon) ?? 0) + marginUsd);

    const bucketId = classifyOutcomeBucket(rMultiple, pnlUsd);
    const tradeRecord: HorizonAttributedTrade = {
      positionId: pos.id,
      instrumentId: pos.instrumentId,
      horizon,
      direction: pos.direction,
      status: pos.status,
      bucketId,
      pnlUsd: Number(pnlUsd.toFixed(2)),
      roiPct,
      rMultiple,
      lots: pos.lots,
      openTime: pos.openTime,
      notes: pos.notes,
    };

    bucketMaps.get(horizon)!.get(bucketId)!.push(tradeRecord);
  }

  // First pass: build row totals and unnormalized cells
  let maxCellSharePct = 0;
  const preliminaryRows: HorizonPerformanceRow[] = orderedHorizons.map((horizon) => {
    const colMap = bucketMaps.get(horizon)!;
    const allTrades = HORIZON_BUCKET_COLUMNS.flatMap((c) => colMap.get(c.bucketId) || []);
    const totalTrades = allTrades.length;
    const winTrades = allTrades.filter((t) => t.pnlUsd >= 0);
    const lossTrades = allTrades.filter((t) => t.pnlUsd < 0);

    const winCount = winTrades.length;
    const lossCount = lossTrades.length;
    const winRatePct = totalTrades > 0 ? Number(((winCount / totalTrades) * 100).toFixed(1)) : 0;
    const lossRatePct = totalTrades > 0 ? Number(((lossCount / totalTrades) * 100).toFixed(1)) : 0;

    const grossProfitUsd = Number(winTrades.reduce((s, t) => s + t.pnlUsd, 0).toFixed(2));
    const grossLossUsd = Number(lossTrades.reduce((s, t) => s + Math.abs(t.pnlUsd), 0).toFixed(2));
    const netPnlUsd = Number((grossProfitUsd - grossLossUsd).toFixed(2));
    const profitFactor =
      grossLossUsd > 0
        ? Number((grossProfitUsd / grossLossUsd).toFixed(2))
        : grossProfitUsd > 0
        ? 99.0
        : 0;

    const roiPct = Number(((netPnlUsd / startingCapitalUsd) * 100).toFixed(2));
    const totalMarginUsd = marginCommittedMap.get(horizon) ?? 0;
    const returnOnMarginPct =
      totalMarginUsd > 0 ? Number(((netPnlUsd / totalMarginUsd) * 100).toFixed(2)) : 0;

    const sumR = allTrades.reduce((s, t) => s + t.rMultiple, 0);
    const avgExpectancyR = totalTrades > 0 ? Number((sumR / totalTrades).toFixed(2)) : 0;
    const avgWinUsd = winCount > 0 ? Number((grossProfitUsd / winCount).toFixed(2)) : 0;
    const avgLossUsd = lossCount > 0 ? Number((grossLossUsd / lossCount).toFixed(2)) : 0;

    const cells: HorizonHeatmapCell[] = HORIZON_BUCKET_COLUMNS.map((col) => {
      const cellTrades = colMap.get(col.bucketId) || [];
      const count = cellTrades.length;
      const horizonSharePct = totalTrades > 0 ? Number(((count / totalTrades) * 100).toFixed(1)) : 0;
      if (horizonSharePct > maxCellSharePct) {
        maxCellSharePct = horizonSharePct;
      }
      const cellPnl = Number(cellTrades.reduce((s, t) => s + t.pnlUsd, 0).toFixed(2));
      const cellRoi = Number(((cellPnl / startingCapitalUsd) * 100).toFixed(2));
      const cellAvgR =
        count > 0
          ? Number((cellTrades.reduce((s, t) => s + t.rMultiple, 0) / count).toFixed(2))
          : 0;

      return {
        horizon,
        bucketId: col.bucketId,
        bucketLabel: col.label,
        isWinBucket: col.isWinBucket,
        tradeCount: count,
        horizonSharePct,
        netPnlUsd: cellPnl,
        roiContributionPct: cellRoi,
        avgRMultiple: cellAvgR,
        intensity: 0,
        trades: cellTrades,
      };
    });

    return {
      horizon,
      label: HORIZON_META[horizon].label,
      timeframeTag: HORIZON_META[horizon].timeframeTag,
      totalTrades,
      closedTrades: closedCountMap.get(horizon) ?? 0,
      openTrades: openCountMap.get(horizon) ?? 0,
      winCount,
      lossCount,
      winRatePct,
      lossRatePct,
      netPnlUsd,
      grossProfitUsd,
      grossLossUsd,
      profitFactor,
      roiPct,
      returnOnMarginPct,
      avgExpectancyR,
      avgWinUsd,
      avgLossUsd,
      isHighestRoi: false,
      cells,
    };
  });

  // Normalize cell heat intensities across populated horizon share %
  const scaleDenom = Math.max(25, maxCellSharePct);
  for (const row of preliminaryRows) {
    for (const cell of row.cells) {
      cell.intensity =
        cell.tradeCount === 0
          ? 0
          : Number(Math.min(1, Math.max(0.22, cell.horizonSharePct / scaleDenom)).toFixed(2));
    }
  }

  const populatedRows = preliminaryRows.filter((r) => r.totalTrades > 0);
  let bestRoiHorizon: HorizonCategory | null = null;
  let bestWinRateHorizon: HorizonCategory | null = null;
  let weakestRoiHorizon: HorizonCategory | null = null;
  let roiSpreadPct = 0;

  if (populatedRows.length > 0) {
    const sortedByRoi = [...populatedRows].sort(
      (a, b) => b.roiPct - a.roiPct || b.winRatePct - a.winRatePct
    );
    bestRoiHorizon = sortedByRoi[0].horizon;
    weakestRoiHorizon = sortedByRoi[sortedByRoi.length - 1].horizon;
    sortedByRoi[0].isHighestRoi = true;
    roiSpreadPct = Number(
      (sortedByRoi[0].roiPct - sortedByRoi[sortedByRoi.length - 1].roiPct).toFixed(2)
    );

    const sortedByWin = [...populatedRows].sort(
      (a, b) => b.winRatePct - a.winRatePct || b.roiPct - a.roiPct
    );
    bestWinRateHorizon = sortedByWin[0].horizon;
  }

  const totalAnalyzedTrades = preliminaryRows.reduce((s, r) => s + r.totalTrades, 0);
  const totalWinCount = preliminaryRows.reduce((s, r) => s + r.winCount, 0);
  const totalLossCount = preliminaryRows.reduce((s, r) => s + r.lossCount, 0);
  const totalNetPnlUsd = Number(
    preliminaryRows.reduce((s, r) => s + r.netPnlUsd, 0).toFixed(2)
  );
  const totalAccountRoiPct = Number(((totalNetPnlUsd / startingCapitalUsd) * 100).toFixed(2));

  let insightSummary =
    'Execute or close simulated paper positions across Intraday, Swing, or Long-Term setups to populate the horizon ROI heatmap.';
  if (bestRoiHorizon && populatedRows.length > 0) {
    const topRow = preliminaryRows.find((r) => r.horizon === bestRoiHorizon)!;
    const weakRow = preliminaryRows.find((r) => r.horizon === weakestRoiHorizon)!;
    const topSign = topRow.roiPct >= 0 ? '+' : '';
    const weakSign = weakRow.roiPct >= 0 ? '+' : '';
    if (populatedRows.length === 1) {
      insightSummary = `${topRow.label} (${topRow.timeframeTag}) accounts for all ${topRow.totalTrades} ${
        scope === 'CLOSED_ONLY' ? 'closed' : 'executed'
      } trades at ${topSign}${topRow.roiPct.toFixed(2)}% account ROI (${topRow.winRatePct}% win rate, ${topRow.avgExpectancyR >= 0 ? '+' : ''}${topRow.avgExpectancyR.toFixed(2)}R avg).`;
    } else {
      insightSummary = `${topRow.label} (${topRow.timeframeTag}) produces the highest ROI at ${topSign}${topRow.roiPct.toFixed(
        2
      )}% (${topRow.winRatePct}% win rate, ${topRow.avgExpectancyR >= 0 ? '+' : ''}${topRow.avgExpectancyR.toFixed(
        2
      )}R avg), outperforming ${weakRow.label} (${weakSign}${weakRow.roiPct.toFixed(
        2
      )}% ROI) by +${roiSpreadPct.toFixed(2)} percentage points.`;
    }
  }

  return {
    scope,
    startingCapitalUsd,
    totalAnalyzedTrades,
    totalWinCount,
    totalLossCount,
    totalNetPnlUsd,
    totalAccountRoiPct,
    bestRoiHorizon,
    bestWinRateHorizon,
    weakestRoiHorizon,
    roiSpreadPct,
    maxCellSharePct,
    bucketColumns: HORIZON_BUCKET_COLUMNS,
    rows: preliminaryRows,
    insightSummary,
  };
}

// -----------------------------------------------------------------------------
// 12. Advisory Horizon Win/Loss & ROI Tax/Audit CSV Exporter
// -----------------------------------------------------------------------------

export type SelectedHorizonFilter = HorizonCategory | 'ALL';

export interface HorizonAuditCsvArtifact {
  filename: string;
  selectedHorizon: SelectedHorizonFilter;
  selectedHorizonLabel: string;
  generatedAtUtc: string;
  horizonRowsIncluded: number;
  bucketRowsIncluded: number;
  tradeRowsIncluded: number;
  totalNetPnlUsd: number;
  totalRoiPct: number;
  csvContent: string;
}

function escapeCsvCell(value: string | number | boolean | null | undefined): string {
  if (value === null || value === undefined) return '';
  if (typeof value === 'number') {
    return Number.isFinite(value) ? String(value) : '0';
  }
  if (typeof value === 'boolean') {
    return value ? 'TRUE' : 'FALSE';
  }
  const raw = String(value);
  // Neutralize spreadsheet formula injection on string cells starting with =, @, or tab/CR
  const neutralized = /^[=@\t\r]/.test(raw) ? `'${raw}` : raw;
  if (/[",\n\r]/.test(neutralized)) {
    return `"${neutralized.replace(/"/g, '""')}"`;
  }
  return neutralized;
}

function formatCsvRow(cells: Array<string | number | boolean | null | undefined>): string {
  return cells.map(escapeCsvCell).join(',');
}

/**
 * Compiles a structured, RFC-4180 compliant CSV audit file containing the
 * selected advisory horizon's ROI summary, win/loss R-multiple bucket distribution,
 * and chronological tax-audit trade ledger.
 */
export function buildHorizonAuditCsv(
  summary: HorizonPerformanceHeatmapSummary,
  options: {
    selectedHorizon?: SelectedHorizonFilter;
    activeRangeLabel?: string;
    generatedAtIso?: string;
  } = {}
): HorizonAuditCsvArtifact {
  const selectedHorizon: SelectedHorizonFilter = options.selectedHorizon ?? 'ALL';
  const activeRangeLabel = options.activeRangeLabel ?? 'All Cycles';
  const generatedAtUtc = options.generatedAtIso ?? new Date().toISOString();
  const dateStamp = generatedAtUtc.slice(0, 10);

  const selectedHorizonLabel =
    selectedHorizon === 'ALL' ? 'All Advisory Horizons' : HORIZON_META[selectedHorizon].label;

  const targetRows =
    selectedHorizon === 'ALL'
      ? summary.rows
      : summary.rows.filter((r) => r.horizon === selectedHorizon);

  const totalNetPnlUsd = Number(
    targetRows.reduce((acc, r) => acc + r.netPnlUsd, 0).toFixed(2)
  );
  const totalRoiPct = Number(
    ((totalNetPnlUsd / Math.max(1, summary.startingCapitalUsd)) * 100).toFixed(2)
  );

  const lines: string[] = [];

  // Metadata Header
  lines.push(formatCsvRow(['GOLDVISTA_INSTITUTIONAL_TAX_AND_PERFORMANCE_AUDIT']));
  lines.push(formatCsvRow(['Generated_At_UTC', generatedAtUtc]));
  lines.push(formatCsvRow(['Selected_Advisory_Horizon', selectedHorizonLabel]));
  lines.push(formatCsvRow(['Horizon_Filter_Code', selectedHorizon]));
  lines.push(formatCsvRow(['Date_Cycle_Scope', activeRangeLabel]));
  lines.push(formatCsvRow(['Trade_Evaluation_Scope', summary.scope]));
  lines.push(formatCsvRow(['Starting_Capital_USD', summary.startingCapitalUsd]));
  lines.push(formatCsvRow(['Selected_Net_PnL_USD', totalNetPnlUsd]));
  lines.push(formatCsvRow(['Selected_Account_ROI_Pct', totalRoiPct]));
  lines.push('');

  // Section 1: Advisory Horizon Performance & ROI Summary
  lines.push(formatCsvRow(['SECTION_1_HORIZON_ROI_SUMMARY']));
  lines.push(
    formatCsvRow([
      'Horizon_Code',
      'Horizon_Label',
      'Timeframe_Tag',
      'Total_Trades',
      'Closed_Trades',
      'Open_Trades',
      'Win_Count',
      'Loss_Count',
      'Win_Rate_Pct',
      'Loss_Rate_Pct',
      'Gross_Profit_USD',
      'Gross_Loss_USD',
      'Net_PnL_USD',
      'Account_ROI_Pct',
      'Return_On_Margin_Pct',
      'Profit_Factor',
      'Avg_Expectancy_R',
      'Avg_Win_USD',
      'Avg_Loss_USD',
      'Is_Highest_ROI',
    ])
  );

  for (const row of targetRows) {
    lines.push(
      formatCsvRow([
        row.horizon,
        row.label,
        row.timeframeTag,
        row.totalTrades,
        row.closedTrades,
        row.openTrades,
        row.winCount,
        row.lossCount,
        row.winRatePct,
        row.lossRatePct,
        row.grossProfitUsd,
        row.grossLossUsd,
        row.netPnlUsd,
        row.roiPct,
        row.returnOnMarginPct,
        row.profitFactor,
        row.avgExpectancyR,
        row.avgWinUsd,
        row.avgLossUsd,
        row.isHighestRoi,
      ])
    );
  }
  lines.push('');

  // Section 2: Win/Loss Distribution Matrix by R-Multiple Bucket
  lines.push(formatCsvRow(['SECTION_2_WIN_LOSS_DISTRIBUTION_MATRIX']));
  lines.push(
    formatCsvRow([
      'Horizon_Code',
      'Horizon_Label',
      'Bucket_Id',
      'Bucket_Label',
      'R_Multiple_Band',
      'Polarity',
      'Trade_Count',
      'Horizon_Share_Pct',
      'Net_PnL_USD',
      'ROI_Contribution_Pct',
      'Avg_R_Multiple',
    ])
  );

  let bucketRowsIncluded = 0;
  for (const row of targetRows) {
    for (const cell of row.cells) {
      const colMeta = summary.bucketColumns.find((c) => c.bucketId === cell.bucketId);
      lines.push(
        formatCsvRow([
          row.horizon,
          row.label,
          cell.bucketId,
          cell.bucketLabel,
          colMeta?.shortRange ?? '',
          cell.isWinBucket ? 'WIN' : 'LOSS',
          cell.tradeCount,
          cell.horizonSharePct,
          cell.netPnlUsd,
          cell.roiContributionPct,
          cell.avgRMultiple,
        ])
      );
      bucketRowsIncluded++;
    }
  }
  lines.push('');

  // Section 3: Chronological Tax & Performance Audit Trade Ledger
  lines.push(formatCsvRow(['SECTION_3_CHRONOLOGICAL_TAX_AND_AUDIT_TRADE_LEDGER']));
  lines.push(
    formatCsvRow([
      'Position_ID',
      'Instrument',
      'Advisory_Horizon',
      'Direction',
      'Status',
      'Open_Time_UTC',
      'Lots',
      'Outcome_Bucket',
      'Realized_or_MTM_PnL_USD',
      'Account_ROI_Pct',
      'R_Multiple',
      'Tax_Audit_Classification',
      'Journal_Notes',
    ])
  );

  const ledgerTrades = targetRows
    .flatMap((row) => row.cells.flatMap((cell) => cell.trades))
    .sort((a, b) => new Date(a.openTime).getTime() - new Date(b.openTime).getTime());

  for (const trade of ledgerTrades) {
    const taxClass =
      trade.status === 'OPEN'
        ? 'Unrealized_Open_MTM_Excluded_From_Realized_Tax'
        : trade.pnlUsd >= 0
        ? 'Realized_Short_Term_Trading_Gain'
        : 'Realized_Short_Term_Trading_Loss';

    lines.push(
      formatCsvRow([
        trade.positionId,
        trade.instrumentId,
        trade.horizon,
        trade.direction,
        trade.status,
        trade.openTime,
        trade.lots,
        trade.bucketId,
        trade.pnlUsd,
        trade.roiPct,
        trade.rMultiple,
        taxClass,
        trade.notes,
      ])
    );
  }

  const horizonSlug = selectedHorizon === 'ALL' ? 'ALL_HORIZONS' : selectedHorizon;
  const filename = `GoldVista_Horizon_Audit_${horizonSlug}_${dateStamp}.csv`;

  return {
    filename,
    selectedHorizon,
    selectedHorizonLabel,
    generatedAtUtc,
    horizonRowsIncluded: targetRows.length,
    bucketRowsIncluded,
    tradeRowsIncluded: ledgerTrades.length,
    totalNetPnlUsd,
    totalRoiPct,
    csvContent: lines.join('\r\n'),
  };
}

// -----------------------------------------------------------------------------
// 13. Chronological Trade History Timeline & Visual Post-Mortem Engine
// -----------------------------------------------------------------------------

export interface PostMortemCandle {
  timestampMs: number;
  timeStr: string;
  label: string;
  open: number;
  high: number;
  low: number;
  close: number;
  phase: 'PRE_ENTRY' | 'IN_TRADE' | 'POST_EXIT';
}

export interface PostMortemPricePoint {
  timestampMs: number;
  timeStr: string;
  dateLabel: string;
  price: number;
  open: number;
  high: number;
  low: number;
  close: number;
  eventTag?: 'ENTRY' | 'MAE_EXTREME' | 'EXIT';
  positionId?: string;
}

export interface TradePostMortemEntry {
  sequenceIndex: number;
  positionId: string;
  tradePlanId: string;
  instrumentId: string;
  horizon: HorizonCategory;
  direction: 'BUY' | 'SELL';
  status: PaperPosition['status'];
  outcome: 'WIN' | 'LOSS' | 'OPEN';
  lots: number;
  entryTimeMs: number;
  entryTimeIso: string;
  entryDateLabel: string;
  exitTimeMs: number;
  exitTimeIso: string;
  exitDateLabel: string;
  adverseTimeMs: number;
  holdingHours: number;
  entryPrice: number;
  exitPrice: number;
  stopLossPrice: number;
  takeProfitPrice: number;
  adverseExtremePrice: number;
  maePoints: number;
  stopDistancePoints: number;
  maePctOfStop: number;
  pnlUsd: number;
  rMultiple: number;
  roiPct: number;
  notes: string;
  postMortemVerdict: string;
  focusedCandles: PostMortemCandle[];
}

export interface TradePostMortemTimelineSummary {
  horizonFilter: SelectedHorizonFilter;
  totalTradesCount: number;
  winCount: number;
  lossCount: number;
  openCount: number;
  netPnlUsd: number;
  winRatePct: number;
  avgHoldingHours: number;
  avgMaePctOfStop: number;
  priceMin: number;
  priceMax: number;
  startTimeMs: number;
  endTimeMs: number;
  entries: TradePostMortemEntry[];
  priceSeries: PostMortemPricePoint[];
}

function deterministicJitter(seed: number): number {
  const x = Math.sin(seed * 12.9898 + 78.233) * 43758.5453;
  return (x - Math.floor(x)) * 2 - 1; // [-1, +1]
}

function getDefaultHorizonHoldingHours(horizon: HorizonCategory): number {
  if (horizon === 'INTRADAY') return 14;
  if (horizon === 'LONG_TERM') return 260;
  return 72;
}

function formatShortUtcDate(ms: number): string {
  const dt = new Date(ms);
  if (Number.isNaN(dt.getTime())) return 'N/A';
  return dt.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    timeZone: 'UTC',
  });
}

function buildFocusedPostMortemCandles(params: {
  seqSeed: number;
  entryTimeMs: number;
  adverseTimeMs: number;
  exitTimeMs: number;
  entryPrice: number;
  adverseExtremePrice: number;
  exitPrice: number;
  stopLossPrice: number;
  direction: 'BUY' | 'SELL';
  outcome: 'WIN' | 'LOSS' | 'OPEN';
}): PostMortemCandle[] {
  const {
    seqSeed,
    entryTimeMs,
    adverseTimeMs,
    exitTimeMs,
    entryPrice,
    adverseExtremePrice,
    exitPrice,
    stopLossPrice,
    direction,
    outcome,
  } = params;

  const spanMs = Math.max(4 * 3600_000, exitTimeMs - entryTimeMs);
  const preBars = 4;
  const inBars = 10;
  const postBars = outcome === 'OPEN' ? 0 : 4;
  const barMs = spanMs / inBars;

  const stopGap = Math.max(2, Math.abs(entryPrice - stopLossPrice));
  const preStartPrice =
    direction === 'BUY' ? entryPrice - stopGap * 0.45 : entryPrice + stopGap * 0.45;
  const adverseBarIdx = Math.max(
    1,
    Math.min(inBars - 2, Math.round(((adverseTimeMs - entryTimeMs) / spanMs) * inBars))
  );

  const candles: PostMortemCandle[] = [];
  let prevClose = preStartPrice;

  const totalBars = preBars + inBars + postBars;
  for (let i = 0; i < totalBars; i++) {
    const tMs = entryTimeMs + (i - preBars) * barMs;
    const phase: PostMortemCandle['phase'] =
      i < preBars ? 'PRE_ENTRY' : i < preBars + inBars ? 'IN_TRADE' : 'POST_EXIT';

    let targetClose = prevClose;
    if (phase === 'PRE_ENTRY') {
      const frac = (i + 1) / preBars;
      const noise = i === preBars - 1 ? 0 : deterministicJitter(seqSeed + i * 7) * stopGap * 0.14;
      targetClose = preStartPrice + (entryPrice - preStartPrice) * frac + noise;
    } else if (phase === 'IN_TRADE') {
      const k = i - preBars;
      if (k === 0) {
        // Entry bar starts near entryPrice
        prevClose = entryPrice;
        targetClose =
          adverseBarIdx === 1
            ? (entryPrice + adverseExtremePrice) / 2
            : entryPrice + deterministicJitter(seqSeed + k * 11) * stopGap * 0.12;
      } else if (k <= adverseBarIdx) {
        const frac = k / adverseBarIdx;
        targetClose =
          entryPrice +
          (adverseExtremePrice - entryPrice) * frac +
          (k === adverseBarIdx ? 0 : deterministicJitter(seqSeed + k * 13) * stopGap * 0.08);
      } else {
        const rem = Math.max(1, inBars - 1 - adverseBarIdx);
        const frac = (k - adverseBarIdx) / rem;
        targetClose =
          adverseExtremePrice +
          (exitPrice - adverseExtremePrice) * frac +
          (k === inBars - 1 ? 0 : deterministicJitter(seqSeed + k * 17) * stopGap * 0.09);
      }
    } else {
      const pIdx = i - (preBars + inBars) + 1;
      const driftDir = outcome === 'LOSS' ? (direction === 'BUY' ? -0.15 : 0.15) : direction === 'BUY' ? 0.12 : -0.12;
      targetClose =
        exitPrice +
        driftDir * stopGap * pIdx +
        deterministicJitter(seqSeed + i * 19) * stopGap * 0.1;
    }

    const open = Number(prevClose.toFixed(2));
    const close = Number(targetClose.toFixed(2));
    const wickPad = stopGap * (0.06 + Math.abs(deterministicJitter(seqSeed + i * 23)) * 0.08);
    let high = Math.max(open, close) + wickPad;
    let low = Math.min(open, close) - wickPad;

    // Guarantee exact touch of adverseExtremePrice on the adverse excursion bar
    if (phase === 'IN_TRADE' && i - preBars === adverseBarIdx) {
      if (direction === 'BUY') {
        low = Math.min(low, adverseExtremePrice);
      } else {
        high = Math.max(high, adverseExtremePrice);
      }
    }

    candles.push({
      timestampMs: Math.round(tMs),
      timeStr: new Date(Math.round(tMs)).toISOString(),
      label: formatShortUtcDate(tMs),
      open,
      high: Number(high.toFixed(2)),
      low: Number(low.toFixed(2)),
      close,
      phase,
    });
    prevClose = close;
  }

  return candles;
}

/**
 * Builds a chronological trade history timeline and per-trade visual post-mortem dataset
 * mapping entries, exits, stop losses, and max adverse excursions onto a continuous historical
 * price series.
 */
export function buildTradePostMortemTimeline(
  positions: PaperPosition[],
  options: {
    horizonFilter?: SelectedHorizonFilter;
    quotes?: Record<string, Quote>;
    defaultQuote?: Quote;
    startingCapitalUsd?: number;
    nowMs?: number;
  } = {}
): TradePostMortemTimelineSummary {
  const horizonFilter: SelectedHorizonFilter = options.horizonFilter ?? 'ALL';
  const startingCapitalUsd = Math.max(1000, options.startingCapitalUsd ?? 100000);

  const chronological = (Array.isArray(positions) ? positions : [])
    .filter((p) => p.status !== 'CANCELLED')
    .filter((p) =>
      horizonFilter === 'ALL' ? true : resolvePositionAdvisoryHorizon(p) === horizonFilter
    )
    .sort((a, b) => new Date(a.openTime).getTime() - new Date(b.openTime).getTime());

  if (chronological.length === 0) {
    return {
      horizonFilter,
      totalTradesCount: 0,
      winCount: 0,
      lossCount: 0,
      openCount: 0,
      netPnlUsd: 0,
      winRatePct: 0,
      avgHoldingHours: 0,
      avgMaePctOfStop: 0,
      priceMin: 0,
      priceMax: 0,
      startTimeMs: 0,
      endTimeMs: 0,
      entries: [],
      priceSeries: [],
    };
  }

  const latestOpenTimeMs = chronological.reduce(
    (mx, p) => Math.max(mx, new Date(p.openTime).getTime() || 0),
    0
  );
  const referenceNowMs = options.nowMs ?? Math.max(Date.now(), latestOpenTimeMs + 36 * 3600_000);

  const entries: TradePostMortemEntry[] = chronological.map((pos, idx) => {
    const horizon = resolvePositionAdvisoryHorizon(pos);
    const multiplier = getInstrumentMultiplierForMae(pos.instrumentId);

    const parsedOpenMs = new Date(pos.openTime).getTime();
    const entryTimeMs = Number.isFinite(parsedOpenMs)
      ? parsedOpenMs
      : referenceNowMs - (chronological.length - idx) * 86400_000;

    const nextOpenMs =
      idx < chronological.length - 1
        ? new Date(chronological[idx + 1].openTime).getTime()
        : referenceNowMs;

    const defaultHoldMs = getDefaultHorizonHoldingHours(horizon) * 3600_000;
    let exitTimeMs: number;
    if (pos.status === 'OPEN') {
      exitTimeMs = Math.max(entryTimeMs + 6 * 3600_000, referenceNowMs);
    } else {
      const gapToNext = Number.isFinite(nextOpenMs) ? Math.max(12 * 3600_000, nextOpenMs - entryTimeMs - 4 * 3600_000) : defaultHoldMs;
      exitTimeMs = entryTimeMs + Math.min(defaultHoldMs, gapToNext);
    }

    const holdingHours = Number(Math.max(1, (exitTimeMs - entryTimeMs) / 3600_000).toFixed(1));
    const adverseTimeMs = Math.round(entryTimeMs + (exitTimeMs - entryTimeMs) * 0.34);

    let exitPrice = pos.currentPrice;
    let pnlUsd = pos.realizedPnl;
    if (pos.status === 'OPEN') {
      exitPrice =
        options.quotes?.[pos.instrumentId]?.mid ??
        (options.defaultQuote?.instrumentId === pos.instrumentId
          ? options.defaultQuote.mid
          : undefined) ??
        (pos.instrumentId === 'XAUUSD' && options.defaultQuote ? options.defaultQuote.mid : undefined) ??
        pos.currentPrice;
      const delta = pos.direction === 'SELL' ? pos.entryPrice - exitPrice : exitPrice - pos.entryPrice;
      pnlUsd = delta * pos.lots * multiplier;
    }

    const stopDistancePoints = Math.max(0.01, Math.abs(pos.entryPrice - pos.stopLoss));
    const rawAdverse =
      pos.adverseExtremePrice ??
      (pos.status === 'CLOSED_LOSS'
        ? pos.stopLoss
        : pos.direction === 'SELL'
        ? Math.max(pos.entryPrice, exitPrice)
        : Math.min(pos.entryPrice, exitPrice));

    const adverseExtremePrice = Number(
      (pos.direction === 'SELL'
        ? Math.max(pos.entryPrice, rawAdverse)
        : Math.min(pos.entryPrice, rawAdverse)
      ).toFixed(2)
    );

    const maePoints = Number(
      Math.max(
        0,
        pos.direction === 'SELL'
          ? adverseExtremePrice - pos.entryPrice
          : pos.entryPrice - adverseExtremePrice
      ).toFixed(2)
    );
    const maePctOfStop = Number(
      Math.min(125, (maePoints / stopDistancePoints) * 100).toFixed(1)
    );

    const oneRUsd = Math.max(1, stopDistancePoints * pos.lots * multiplier);
    const rMultiple = Number((pnlUsd / oneRUsd).toFixed(2));
    const roiPct = Number(((pnlUsd / startingCapitalUsd) * 100).toFixed(2));

    const outcome: TradePostMortemEntry['outcome'] =
      pos.status === 'OPEN' ? 'OPEN' : pnlUsd >= 0 ? 'WIN' : 'LOSS';

    let postMortemVerdict = '';
    if (outcome === 'OPEN') {
      const sign = pnlUsd >= 0 ? '+' : '-';
      postMortemVerdict = `Open ${horizon} position currently ${sign}$${Math.abs(pnlUsd).toFixed(
        0
      )} (${rMultiple >= 0 ? '+' : ''}${rMultiple.toFixed(2)}R); absorbed ${maePctOfStop}% of stop budget ($${maePoints.toFixed(
        2
      )} MAE) vs SL $${pos.stopLoss.toFixed(2)}.`;
    } else if (outcome === 'WIN') {
      postMortemVerdict = `Target Captured (+${rMultiple.toFixed(2)}R / +$${pnlUsd.toFixed(
        0
      )}): Reached $${exitPrice.toFixed(2)} from $${pos.entryPrice.toFixed(
        2
      )} while keeping adverse drawdown to ${maePctOfStop}% of SL ($${adverseExtremePrice.toFixed(2)}).`;
    } else {
      postMortemVerdict = `Stop Invalidation (${rMultiple.toFixed(2)}R / -$${Math.abs(pnlUsd).toFixed(
        0
      )}): Exited at $${exitPrice.toFixed(2)} against $${pos.stopLoss.toFixed(
        2
      )} stop (${maePctOfStop}% SL utilization).`;
    }

    const focusedCandles = buildFocusedPostMortemCandles({
      seqSeed: (idx + 1) * 31,
      entryTimeMs,
      adverseTimeMs,
      exitTimeMs,
      entryPrice: Number(pos.entryPrice.toFixed(2)),
      adverseExtremePrice,
      exitPrice: Number(exitPrice.toFixed(2)),
      stopLossPrice: Number(pos.stopLoss.toFixed(2)),
      direction: pos.direction,
      outcome,
    });

    return {
      sequenceIndex: idx + 1,
      positionId: pos.id,
      tradePlanId: pos.tradePlanId,
      instrumentId: pos.instrumentId,
      horizon,
      direction: pos.direction,
      status: pos.status,
      outcome,
      lots: pos.lots,
      entryTimeMs,
      entryTimeIso: new Date(entryTimeMs).toISOString(),
      entryDateLabel: formatShortUtcDate(entryTimeMs),
      exitTimeMs,
      exitTimeIso: new Date(exitTimeMs).toISOString(),
      exitDateLabel: pos.status === 'OPEN' ? 'Live Mark' : formatShortUtcDate(exitTimeMs),
      adverseTimeMs,
      holdingHours,
      entryPrice: Number(pos.entryPrice.toFixed(2)),
      exitPrice: Number(exitPrice.toFixed(2)),
      stopLossPrice: Number(pos.stopLoss.toFixed(2)),
      takeProfitPrice: Number(pos.takeProfit.toFixed(2)),
      adverseExtremePrice,
      maePoints,
      stopDistancePoints: Number(stopDistancePoints.toFixed(2)),
      maePctOfStop,
      pnlUsd: Number(pnlUsd.toFixed(2)),
      rMultiple,
      roiPct,
      notes: pos.notes,
      postMortemVerdict,
      focusedCandles,
    };
  });

  // Build continuous historical price trajectory passing directly through every Entry -> MAE -> Exit
  const rawNodes: Array<{
    timestampMs: number;
    price: number;
    eventTag?: PostMortemPricePoint['eventTag'];
    positionId?: string;
  }> = [];

  const first = entries[0];
  rawNodes.push({
    timestampMs: first.entryTimeMs - 5 * 86400_000,
    price: Number((first.entryPrice * 0.992).toFixed(2)),
  });

  entries.forEach((tr, idx) => {
    rawNodes.push({
      timestampMs: tr.entryTimeMs,
      price: tr.entryPrice,
      eventTag: 'ENTRY',
      positionId: tr.positionId,
    });
    if (tr.maePoints > 0.2) {
      rawNodes.push({
        timestampMs: tr.adverseTimeMs,
        price: tr.adverseExtremePrice,
        eventTag: 'MAE_EXTREME',
        positionId: tr.positionId,
      });
    }
    rawNodes.push({
      timestampMs: tr.exitTimeMs,
      price: tr.exitPrice,
      eventTag: 'EXIT',
      positionId: tr.positionId,
    });

    // Midpoint bridge between sequential trades for organic historical price context
    if (idx < entries.length - 1) {
      const nxt = entries[idx + 1];
      if (nxt.entryTimeMs - tr.exitTimeMs > 3 * 86400_000) {
        const midTime = Math.round((tr.exitTimeMs + nxt.entryTimeMs) / 2);
        const midPrice =
          (tr.exitPrice + nxt.entryPrice) / 2 +
          deterministicJitter(idx * 41 + 9) * Math.max(8, Math.abs(nxt.entryPrice - tr.exitPrice) * 0.22);
        rawNodes.push({
          timestampMs: midTime,
          price: Number(midPrice.toFixed(2)),
        });
      }
    }
  });

  rawNodes.sort((a, b) => a.timestampMs - b.timestampMs);

  const priceSeries: PostMortemPricePoint[] = rawNodes.map((node, i) => {
    const prevPrice = i > 0 ? rawNodes[i - 1].price : node.price;
    const spreadBand = Math.max(3.5, Math.abs(node.price - prevPrice) * 0.12);
    const high = Math.max(prevPrice, node.price) + spreadBand;
    const low = Math.min(prevPrice, node.price) - spreadBand;
    return {
      timestampMs: node.timestampMs,
      timeStr: new Date(node.timestampMs).toISOString(),
      dateLabel: formatShortUtcDate(node.timestampMs),
      price: node.price,
      open: prevPrice,
      high: Number(high.toFixed(2)),
      low: Number(low.toFixed(2)),
      close: node.price,
      eventTag: node.eventTag,
      positionId: node.positionId,
    };
  });

  const allPrices = [
    ...priceSeries.map((p) => p.price),
    ...entries.map((e) => e.stopLossPrice),
    ...entries.map((e) => e.takeProfitPrice),
  ];
  const priceMin = Number(Math.min(...allPrices).toFixed(2));
  const priceMax = Number(Math.max(...allPrices).toFixed(2));

  const winCount = entries.filter((e) => e.outcome === 'WIN').length;
  const lossCount = entries.filter((e) => e.outcome === 'LOSS').length;
  const openCount = entries.filter((e) => e.outcome === 'OPEN').length;
  const closedCount = winCount + lossCount;
  const netPnlUsd = Number(entries.reduce((s, e) => s + e.pnlUsd, 0).toFixed(2));
  const winRatePct = closedCount > 0 ? Number(((winCount / closedCount) * 100).toFixed(1)) : 0;
  const avgHoldingHours = Number(
    (entries.reduce((s, e) => s + e.holdingHours, 0) / entries.length).toFixed(1)
  );
  const avgMaePctOfStop = Number(
    (entries.reduce((s, e) => s + e.maePctOfStop, 0) / entries.length).toFixed(1)
  );

  return {
    horizonFilter,
    totalTradesCount: entries.length,
    winCount,
    lossCount,
    openCount,
    netPnlUsd,
    winRatePct,
    avgHoldingHours,
    avgMaePctOfStop,
    priceMin,
    priceMax,
    startTimeMs: priceSeries[0].timestampMs,
    endTimeMs: priceSeries[priceSeries.length - 1].timestampMs,
    entries,
    priceSeries,
  };
}

// -----------------------------------------------------------------------------
// 14. Advisory Horizon Win Rate vs. Time Trend Engine
// -----------------------------------------------------------------------------

export type WinRateCalculationMode = 'CUMULATIVE' | 'ROLLING_WINDOW';
export type WinRateScopeMode = 'CLOSED_ONLY' | 'ALL_EXECUTED';

export interface WinRateTimePoint {
  pointIndex: number;
  timestampMs: number;
  dateIso: string;
  dateLabel: string;
  periodLabel: string;
  eventPositionId: string;
  eventHorizon: HorizonCategory;
  eventDirection: 'BUY' | 'SELL';
  eventOutcome: 'WIN' | 'LOSS' | 'OPEN_GAIN' | 'OPEN_LOSS';
  eventPnlUsd: number;
  overallWinRatePct: number | null;
  intradayWinRatePct: number | null;
  swingWinRatePct: number | null;
  longTermWinRatePct: number | null;
  overallTradesCount: number;
  intradayTradesCount: number;
  swingTradesCount: number;
  longTermTradesCount: number;
  overallWinsCount: number;
  intradayWinsCount: number;
  swingWinsCount: number;
  longTermWinsCount: number;
}

export interface HorizonWinRateTrendMetric {
  horizon: HorizonCategory | 'OVERALL';
  label: string;
  currentWinRatePct: number | null;
  initialWinRatePct: number | null;
  deltaPctPoints: number;
  peakWinRatePct: number | null;
  troughWinRatePct: number | null;
  totalTrades: number;
  wins: number;
  losses: number;
  trendDirection: 'IMPROVING' | 'DECLINING' | 'STABLE' | 'NO_DATA';
}

export interface HorizonWinRateTrendSummary {
  mode: WinRateCalculationMode;
  scope: WinRateScopeMode;
  rollingWindowSize: number;
  totalAnalyzedTrades: number;
  points: WinRateTimePoint[];
  horizonMetrics: Record<HorizonCategory | 'OVERALL', HorizonWinRateTrendMetric>;
  leadingHorizon: HorizonCategory | null;
  fastestImprovingHorizon: HorizonCategory | null;
  trendInsight: string;
}

function computeSeriesMetric(
  key: HorizonCategory | 'OVERALL',
  label: string,
  seriesValues: Array<number | null>,
  wins: number,
  losses: number
): HorizonWinRateTrendMetric {
  const valid = seriesValues.filter((v): v is number => v !== null && Number.isFinite(v));
  const totalTrades = wins + losses;
  if (valid.length === 0 || totalTrades === 0) {
    return {
      horizon: key,
      label,
      currentWinRatePct: null,
      initialWinRatePct: null,
      deltaPctPoints: 0,
      peakWinRatePct: null,
      troughWinRatePct: null,
      totalTrades: 0,
      wins: 0,
      losses: 0,
      trendDirection: 'NO_DATA',
    };
  }

  const initialWinRatePct = valid[0];
  const currentWinRatePct = valid[valid.length - 1];
  const deltaPctPoints = Number((currentWinRatePct - initialWinRatePct).toFixed(1));
  const peakWinRatePct = Math.max(...valid);
  const troughWinRatePct = Math.min(...valid);

  let trendDirection: HorizonWinRateTrendMetric['trendDirection'] = 'STABLE';
  if (deltaPctPoints >= 3) {
    trendDirection = 'IMPROVING';
  } else if (deltaPctPoints <= -3) {
    trendDirection = 'DECLINING';
  }

  return {
    horizon: key,
    label,
    currentWinRatePct,
    initialWinRatePct,
    deltaPctPoints,
    peakWinRatePct,
    troughWinRatePct,
    totalTrades,
    wins,
    losses,
    trendDirection,
  };
}

/**
 * Computes chronological Win Rate (%) trajectories across Intraday, Swing, and Long-Term
 * advisory horizons (plus Overall Portfolio benchmark) in either Cumulative Expanding or
 * Rolling N-Trade Window mode for Recharts visualization.
 */
export function buildHorizonWinRateTimeSeries(
  positions: PaperPosition[],
  options: {
    mode?: WinRateCalculationMode;
    scope?: WinRateScopeMode;
    rollingWindowSize?: number;
    quotes?: Record<string, Quote>;
    defaultQuote?: Quote;
  } = {}
): HorizonWinRateTrendSummary {
  const mode: WinRateCalculationMode = options.mode ?? 'CUMULATIVE';
  const scope: WinRateScopeMode = options.scope ?? 'CLOSED_ONLY';
  const rollingWindowSize = Math.max(2, Math.min(20, Math.round(options.rollingWindowSize ?? 3)));

  const eligible = (Array.isArray(positions) ? positions : [])
    .filter((pos) => {
      if (pos.status === 'CANCELLED') return false;
      if (scope === 'CLOSED_ONLY') {
        return pos.status === 'CLOSED_PROFIT' || pos.status === 'CLOSED_LOSS';
      }
      return true;
    })
    .slice()
    .sort((a, b) => new Date(a.openTime).getTime() - new Date(b.openTime).getTime());

  const emptyMetrics: Record<HorizonCategory | 'OVERALL', HorizonWinRateTrendMetric> = {
    OVERALL: computeSeriesMetric('OVERALL', 'Overall Portfolio', [], 0, 0),
    INTRADAY: computeSeriesMetric('INTRADAY', 'Intraday', [], 0, 0),
    SWING: computeSeriesMetric('SWING', 'Swing', [], 0, 0),
    LONG_TERM: computeSeriesMetric('LONG_TERM', 'Long-Term', [], 0, 0),
  };

  if (eligible.length === 0) {
    return {
      mode,
      scope,
      rollingWindowSize,
      totalAnalyzedTrades: 0,
      points: [],
      horizonMetrics: emptyMetrics,
      leadingHorizon: null,
      fastestImprovingHorizon: null,
      trendInsight:
        'Execute or close simulated paper positions across advisory horizons to plot Win Rate vs. Time trends.',
    };
  }

  const outcomesOverall: boolean[] = [];
  const outcomesByHorizon: Record<HorizonCategory, boolean[]> = {
    INTRADAY: [],
    SWING: [],
    LONG_TERM: [],
  };

  const calcRate = (outcomes: boolean[]): number | null => {
    if (outcomes.length === 0) return null;
    const sample =
      mode === 'ROLLING_WINDOW' ? outcomes.slice(-rollingWindowSize) : outcomes;
    const wins = sample.filter(Boolean).length;
    return Number(((wins / sample.length) * 100).toFixed(1));
  };

  const points: WinRateTimePoint[] = eligible.map((pos, idx) => {
    const horizon = resolvePositionAdvisoryHorizon(pos);
    const multiplier = getInstrumentMultiplierForMae(pos.instrumentId);

    let pnlUsd = pos.realizedPnl;
    if (pos.status === 'OPEN') {
      const mark =
        options.quotes?.[pos.instrumentId]?.mid ??
        (options.defaultQuote?.instrumentId === pos.instrumentId
          ? options.defaultQuote.mid
          : undefined) ??
        (pos.instrumentId === 'XAUUSD' && options.defaultQuote
          ? options.defaultQuote.mid
          : undefined) ??
        pos.currentPrice;
      const delta = pos.direction === 'SELL' ? pos.entryPrice - mark : mark - pos.entryPrice;
      pnlUsd = delta * pos.lots * multiplier;
    }

    const isWin = pnlUsd >= 0;
    const eventOutcome: WinRateTimePoint['eventOutcome'] =
      pos.status === 'OPEN'
        ? isWin
          ? 'OPEN_GAIN'
          : 'OPEN_LOSS'
        : isWin
        ? 'WIN'
        : 'LOSS';

    outcomesOverall.push(isWin);
    outcomesByHorizon[horizon].push(isWin);

    const parsedMs = new Date(pos.openTime).getTime();
    const timestampMs = Number.isFinite(parsedMs)
      ? parsedMs
      : Date.now() - (eligible.length - idx) * 86400_000;
    const dateIso = new Date(timestampMs).toISOString();
    const shortLabel = formatShortUtcDate(timestampMs);

    return {
      pointIndex: idx + 1,
      timestampMs,
      dateIso,
      dateLabel: dateIso.slice(0, 10),
      periodLabel: shortLabel,
      eventPositionId: pos.id,
      eventHorizon: horizon,
      eventDirection: pos.direction,
      eventOutcome,
      eventPnlUsd: Number(pnlUsd.toFixed(2)),
      overallWinRatePct: calcRate(outcomesOverall),
      intradayWinRatePct: calcRate(outcomesByHorizon.INTRADAY),
      swingWinRatePct: calcRate(outcomesByHorizon.SWING),
      longTermWinRatePct: calcRate(outcomesByHorizon.LONG_TERM),
      overallTradesCount: outcomesOverall.length,
      intradayTradesCount: outcomesByHorizon.INTRADAY.length,
      swingTradesCount: outcomesByHorizon.SWING.length,
      longTermTradesCount: outcomesByHorizon.LONG_TERM.length,
      overallWinsCount: outcomesOverall.filter(Boolean).length,
      intradayWinsCount: outcomesByHorizon.INTRADAY.filter(Boolean).length,
      swingWinsCount: outcomesByHorizon.SWING.filter(Boolean).length,
      longTermWinsCount: outcomesByHorizon.LONG_TERM.filter(Boolean).length,
    };
  });

  const horizonMetrics: Record<HorizonCategory | 'OVERALL', HorizonWinRateTrendMetric> = {
    OVERALL: computeSeriesMetric(
      'OVERALL',
      'Overall Portfolio',
      points.map((p) => p.overallWinRatePct),
      outcomesOverall.filter(Boolean).length,
      outcomesOverall.filter((w) => !w).length
    ),
    INTRADAY: computeSeriesMetric(
      'INTRADAY',
      'Intraday',
      points.map((p) => p.intradayWinRatePct),
      outcomesByHorizon.INTRADAY.filter(Boolean).length,
      outcomesByHorizon.INTRADAY.filter((w) => !w).length
    ),
    SWING: computeSeriesMetric(
      'SWING',
      'Swing',
      points.map((p) => p.swingWinRatePct),
      outcomesByHorizon.SWING.filter(Boolean).length,
      outcomesByHorizon.SWING.filter((w) => !w).length
    ),
    LONG_TERM: computeSeriesMetric(
      'LONG_TERM',
      'Long-Term',
      points.map((p) => p.longTermWinRatePct),
      outcomesByHorizon.LONG_TERM.filter(Boolean).length,
      outcomesByHorizon.LONG_TERM.filter((w) => !w).length
    ),
  };

  const populatedHorizons = (['INTRADAY', 'SWING', 'LONG_TERM'] as HorizonCategory[])
    .map((h) => horizonMetrics[h])
    .filter((m) => m.totalTrades > 0 && m.currentWinRatePct !== null);

  let leadingHorizon: HorizonCategory | null = null;
  let fastestImprovingHorizon: HorizonCategory | null = null;

  if (populatedHorizons.length > 0) {
    const sortedByWin = [...populatedHorizons].sort(
      (a, b) =>
        (b.currentWinRatePct ?? 0) - (a.currentWinRatePct ?? 0) ||
        b.totalTrades - a.totalTrades
    );
    leadingHorizon = sortedByWin[0].horizon as HorizonCategory;

    const sortedBySlope = [...populatedHorizons].sort(
      (a, b) =>
        b.deltaPctPoints - a.deltaPctPoints ||
        (b.currentWinRatePct ?? 0) - (a.currentWinRatePct ?? 0)
    );
    fastestImprovingHorizon = sortedBySlope[0].horizon as HorizonCategory;
  }

  let trendInsight = 'Insufficient trade history to compute horizon win-rate progression.';
  if (leadingHorizon) {
    const leader = horizonMetrics[leadingHorizon];
    const improver = fastestImprovingHorizon
      ? horizonMetrics[fastestImprovingHorizon]
      : null;
    const modePhrase =
      mode === 'CUMULATIVE'
        ? 'cumulative win rate'
        : `rolling ${rollingWindowSize}-trade win rate`;

    if (improver && improver.horizon !== leader.horizon && improver.deltaPctPoints > 0) {
      trendInsight = `${leader.label} maintains the highest ${modePhrase} at ${leader.currentWinRatePct?.toFixed(
        1
      )}% (${leader.wins}W/${leader.losses}L), while ${improver.label} recorded the strongest trajectory gain (+${improver.deltaPctPoints.toFixed(
        1
      )} percentage points to ${improver.currentWinRatePct?.toFixed(1)}%).`;
    } else {
      const slopeNote =
        leader.deltaPctPoints > 0
          ? ` (+${leader.deltaPctPoints.toFixed(1)} pts over the period)`
          : leader.deltaPctPoints < 0
          ? ` (${leader.deltaPctPoints.toFixed(1)} pts over the period)`
          : ' (holding steady)';
      trendInsight = `${leader.label} leads all advisory horizons in ${modePhrase} at ${leader.currentWinRatePct?.toFixed(
        1
      )}% across ${leader.totalTrades} trades${slopeNote}.`;
    }
  }

  return {
    mode,
    scope,
    rollingWindowSize,
    totalAnalyzedTrades: eligible.length,
    points,
    horizonMetrics,
    leadingHorizon,
    fastestImprovingHorizon,
    trendInsight,
  };
}

// =====================================================================
// AUTOMATED GHOST TRADE SYNCHRONIZATION & 1% DEVIATION CLEANUP ENGINE
// =====================================================================

export const DEFAULT_GHOST_DEVIATION_THRESHOLD_PCT = 1.0;

export interface GhostTradeDeviationCandidate {
  positionId: string;
  instrumentId: InstrumentId;
  direction: 'BUY' | 'SELL';
  entryPrice: number;
  currentMarketPrice: number;
  openTime: string;
  deviationPct: number;
  signedDeviationPct: number;
  thresholdPct: number;
  projectedRealizedPnl: number;
  elapsedSinceEntryMs: number;
}

export interface GhostTradeCleanupPlan {
  evaluatedOpenCount: number;
  thresholdPct: number;
  candidates: GhostTradeDeviationCandidate[];
  closePricesByInstrument: Record<string, number>;
  cleanupTimestamp: string;
}

/**
 * Computes absolute percentage deviation between a position's recorded entry price
 * and the current live market mark price.
 */
export function computeEntryPriceDeviationPct(
  entryPrice: number,
  currentMarketPrice: number
): number {
  if (
    !Number.isFinite(entryPrice) ||
    !Number.isFinite(currentMarketPrice) ||
    entryPrice <= 0 ||
    currentMarketPrice <= 0
  ) {
    return 0;
  }
  return Number(((Math.abs(currentMarketPrice - entryPrice) / entryPrice) * 100).toFixed(4));
}

/**
 * Evaluates active ('OPEN') paper positions against current live market quotes and identifies
 * any stale/ghost trades whose live price crossed the >= 1% deviation threshold relative to entry.
 */
export function evaluateGhostTradeCleanup(
  positions: PaperPosition[],
  options: {
    defaultQuote?: Quote;
    quotes?: Record<string, Quote>;
    thresholdPct?: number;
    minEntryAgeMs?: number;
    nowMs?: number;
  } = {}
): GhostTradeCleanupPlan {
  const thresholdPct =
    typeof options.thresholdPct === 'number' &&
    Number.isFinite(options.thresholdPct) &&
    options.thresholdPct > 0
      ? options.thresholdPct
      : DEFAULT_GHOST_DEVIATION_THRESHOLD_PCT;
  const minEntryAgeMs =
    typeof options.minEntryAgeMs === 'number' &&
    Number.isFinite(options.minEntryAgeMs) &&
    options.minEntryAgeMs >= 0
      ? options.minEntryAgeMs
      : 0;
  const nowMs =
    typeof options.nowMs === 'number' && Number.isFinite(options.nowMs)
      ? options.nowMs
      : Date.now();

  const resolveMarkPrice = (pos: PaperPosition): number => {
    const mapped = options.quotes?.[pos.instrumentId]?.mid;
    if (typeof mapped === 'number' && Number.isFinite(mapped) && mapped > 0) {
      return mapped;
    }
    if (
      options.defaultQuote &&
      options.defaultQuote.mid > 0 &&
      (pos.instrumentId === options.defaultQuote.instrumentId || pos.instrumentId === 'XAUUSD')
    ) {
      return options.defaultQuote.mid;
    }
    return Number.isFinite(pos.currentPrice) && pos.currentPrice > 0 ? pos.currentPrice : 0;
  };

  const openPositions = positions.filter((p) => p.status === 'OPEN');
  const candidates: GhostTradeDeviationCandidate[] = [];
  const closePricesByInstrument: Record<string, number> = {};

  for (const pos of openPositions) {
    const markPrice = resolveMarkPrice(pos);
    if (!Number.isFinite(pos.entryPrice) || pos.entryPrice <= 0 || markPrice <= 0) {
      continue;
    }

    const parsedOpenMs = Date.parse(pos.openTime);
    const elapsedSinceEntryMs = Number.isFinite(parsedOpenMs)
      ? Math.max(0, nowMs - parsedOpenMs)
      : 0;
    if (minEntryAgeMs > 0 && elapsedSinceEntryMs < minEntryAgeMs) {
      continue;
    }

    const deviationPct = computeEntryPriceDeviationPct(pos.entryPrice, markPrice);
    if (deviationPct < thresholdPct) {
      continue;
    }

    const signedDeviationPct = Number(
      (((markPrice - pos.entryPrice) / pos.entryPrice) * 100).toFixed(4)
    );
    const priceDelta =
      pos.direction === 'SELL' ? pos.entryPrice - markPrice : markPrice - pos.entryPrice;
    const multiplier = getInstrumentMultiplierForMae(pos.instrumentId);
    const projectedRealizedPnl = Number((priceDelta * pos.lots * multiplier).toFixed(2));

    closePricesByInstrument[pos.instrumentId] = Number(markPrice.toFixed(4));
    candidates.push({
      positionId: pos.id,
      instrumentId: pos.instrumentId,
      direction: pos.direction,
      entryPrice: pos.entryPrice,
      currentMarketPrice: Number(markPrice.toFixed(4)),
      openTime: pos.openTime,
      deviationPct,
      signedDeviationPct,
      thresholdPct,
      projectedRealizedPnl,
      elapsedSinceEntryMs,
    });
  }

  return {
    evaluatedOpenCount: openPositions.length,
    thresholdPct,
    candidates,
    closePricesByInstrument,
    cleanupTimestamp: new Date(nowMs).toISOString(),
  };
}

/**
 * Applies a GhostTradeCleanupPlan locally to a PaperPosition array, force-closing
 * matching OPEN positions and attaching an audit trail note.
 */
export function applyGhostTradeCleanupToPositions(
  positions: PaperPosition[],
  plan: GhostTradeCleanupPlan
): { updatedPositions: PaperPosition[]; closedPositions: PaperPosition[] } {
  if (plan.candidates.length === 0) {
    return { updatedPositions: positions, closedPositions: [] };
  }
  const byId = new Map(plan.candidates.map((c) => [c.positionId, c]));
  const closedPositions: PaperPosition[] = [];

  const updatedPositions = positions.map((pos) => {
    if (pos.status !== 'OPEN') return pos;
    const match = byId.get(pos.id);
    if (!match) return pos;

    const prevExtreme = pos.adverseExtremePrice ?? pos.entryPrice;
    const updatedExtreme =
      pos.direction === 'SELL'
        ? Math.max(prevExtreme, match.currentMarketPrice)
        : Math.min(prevExtreme, match.currentMarketPrice);
    const auditTag = `[Auto-Sync Cleanup: Force-closed at $${match.currentMarketPrice.toFixed(
      2
    )} (${match.deviationPct.toFixed(2)}% deviation from $${pos.entryPrice.toFixed(
      2
    )} entry since ${pos.openTime.slice(0, 10)}).]`;
    const nextNotes = pos.notes?.includes('Auto-Sync Cleanup:')
      ? pos.notes
      : `${pos.notes ? `${pos.notes} ` : ''}${auditTag}`;

    const closedPos: PaperPosition = {
      ...pos,
      currentPrice: match.currentMarketPrice,
      adverseExtremePrice: Number(updatedExtreme.toFixed(4)),
      unrealizedPnl: 0,
      realizedPnl: match.projectedRealizedPnl,
      status: match.projectedRealizedPnl >= 0 ? 'CLOSED_PROFIT' : 'CLOSED_LOSS',
      notes: nextNotes,
    };
    closedPositions.push(closedPos);
    return closedPos;
  });

  return { updatedPositions, closedPositions };
}

// =====================================================================
// HIT STOP-LOSS CONCENTRATION HEATMAP & FAILURE PATTERN ANALYTICS
// =====================================================================

export type StopDistanceBandId =
  | 'CHOKED_TIGHT'
  | 'SHALLOW_SWEEP'
  | 'STANDARD_BAND'
  | 'WIDE_BUFFER'
  | 'DEEP_OVERSHOOT';

export type StopConcentrationGroupBy = 'HORIZON' | 'DIRECTION';
export type StopConcentrationScope = 'LOSSES_AND_BREACHED' | 'CLOSED_LOSSES';
export type StopDistanceMetricMode = 'ACTUAL_EXIT_PCT' | 'PLANNED_STOP_PCT';
export type StopFailurePattern =
  | 'NOISE_CHOKED'
  | 'STOP_HUNT_SWEEP'
  | 'SLIPPAGE_OVERRUN'
  | 'STRUCTURAL_INVALIDATION';

export interface StopDistanceBandDef {
  id: StopDistanceBandId;
  label: string;
  rangeLabel: string;
  minPct: number;
  maxPct: number;
}

export const STOP_DISTANCE_BANDS: StopDistanceBandDef[] = [
  { id: 'CHOKED_TIGHT', label: 'Choked Noise', rangeLabel: '< 0.35%', minPct: 0, maxPct: 0.35 },
  { id: 'SHALLOW_SWEEP', label: 'Shallow Sweep', rangeLabel: '0.35% – 0.65%', minPct: 0.35, maxPct: 0.65 },
  { id: 'STANDARD_BAND', label: 'Structure Zone', rangeLabel: '0.65% – 1.00%', minPct: 0.65, maxPct: 1.0 },
  { id: 'WIDE_BUFFER', label: 'Wide Buffer', rangeLabel: '1.00% – 1.50%', minPct: 1.0, maxPct: 1.5 },
  { id: 'DEEP_OVERSHOOT', label: 'Deep / Slippage', rangeLabel: '>= 1.50%', minPct: 1.5, maxPct: Infinity },
];

export interface HitStopLossPoint {
  positionId: string;
  instrumentId: InstrumentId;
  direction: 'BUY' | 'SELL';
  horizon: HorizonCategory;
  openTime: string;
  isLiveBreach: boolean;
  entryPrice: number;
  stopLossPrice: number;
  hitExitPrice: number;
  plannedStopDistancePct: number;
  actualExitDistancePct: number;
  selectedDistancePct: number;
  signedOffsetPct: number;
  overshootRatioPct: number;
  lossUsd: number;
  isRoundLevelStop: boolean;
  failurePattern: StopFailurePattern;
  bandId: StopDistanceBandId;
  notes: string;
}

export interface StopLossConcentrationCell {
  rowId: string;
  bandId: StopDistanceBandId;
  hitCount: number;
  sharePct: number;
  totalLossUsd: number;
  avgDistancePct: number;
  roundLevelCount: number;
  overrunCount: number;
  intensity: number;
  trades: HitStopLossPoint[];
}

export interface StopLossConcentrationRow {
  rowId: string;
  label: string;
  totalCount: number;
  sharePct: number;
  totalLossUsd: number;
  avgDistancePct: number;
  cells: StopLossConcentrationCell[];
}

export interface StopLossConcentrationReport {
  groupBy: StopConcentrationGroupBy;
  scope: StopConcentrationScope;
  distanceMetric: StopDistanceMetricMode;
  totalHitStopsCount: number;
  breachedOpenCount: number;
  totalLossUsd: number;
  avgStopDistancePct: number;
  medianStopDistancePct: number;
  roundLevelClusteringPct: number;
  slippageOverrunCount: number;
  stopHuntClusterCount: number;
  hottestBand: {
    bandId: StopDistanceBandId;
    label: string;
    rangeLabel: string;
    hitCount: number;
    sharePct: number;
    totalLossUsd: number;
  } | null;
  bands: StopDistanceBandDef[];
  rows: StopLossConcentrationRow[];
  points: HitStopLossPoint[];
  diagnosticInsight: string;
}

function classifyStopBand(distancePct: number): StopDistanceBandId {
  for (const band of STOP_DISTANCE_BANDS) {
    if (distancePct >= band.minPct && distancePct < band.maxPct) {
      return band.id;
    }
  }
  return 'DEEP_OVERSHOOT';
}

function isPsychologicalRoundPrice(price: number, instrumentId: string): boolean {
  if (!Number.isFinite(price) || price <= 0) return false;
  if (instrumentId === 'XAGUSD' || instrumentId === 'SI_FUT' || instrumentId === 'XAG_CFD') {
    const modHalf = Math.abs((price * 2) - Math.round(price * 2));
    return modHalf < 0.02;
  }
  if (price < 200) {
    const modWhole = Math.abs(price - Math.round(price));
    return modWhole < 0.05;
  }
  // Gold / High-notional indices: round $5, $10, $25, $50, $100 levels
  const modFive = Math.abs(price % 5);
  return modFive < 0.05 || Math.abs(modFive - 5) < 0.05;
}

function classifyStopFailurePattern(
  plannedStopPct: number,
  actualExitPct: number,
  overshootRatioPct: number
): StopFailurePattern {
  if (overshootRatioPct > 110 || actualExitPct >= 1.5) {
    return 'SLIPPAGE_OVERRUN';
  }
  if (plannedStopPct < 0.35) {
    return 'NOISE_CHOKED';
  }
  if (plannedStopPct < 1.0) {
    return 'STOP_HUNT_SWEEP';
  }
  return 'STRUCTURAL_INVALIDATION';
}

/**
 * Computes Stop-Loss Concentration Heatmap metrics across Hit Stop-Loss distances
 * relative to Entry Price, surfacing psychological clustering and technical exit failures.
 */
export function calculateStopLossConcentrationHeatmap(
  positions: PaperPosition[],
  options: {
    groupBy?: StopConcentrationGroupBy;
    scope?: StopConcentrationScope;
    distanceMetric?: StopDistanceMetricMode;
    defaultQuote?: Quote;
    quotes?: Record<string, Quote>;
  } = {}
): StopLossConcentrationReport {
  const groupBy: StopConcentrationGroupBy = options.groupBy ?? 'HORIZON';
  const scope: StopConcentrationScope = options.scope ?? 'LOSSES_AND_BREACHED';
  const distanceMetric: StopDistanceMetricMode = options.distanceMetric ?? 'ACTUAL_EXIT_PCT';

  const resolveMark = (pos: PaperPosition): number => {
    const mapped = options.quotes?.[pos.instrumentId]?.mid;
    if (typeof mapped === 'number' && Number.isFinite(mapped) && mapped > 0) {
      return mapped;
    }
    if (
      options.defaultQuote &&
      options.defaultQuote.mid > 0 &&
      (pos.instrumentId === options.defaultQuote.instrumentId || pos.instrumentId === 'XAUUSD')
    ) {
      return options.defaultQuote.mid;
    }
    return pos.currentPrice;
  };

  const points: HitStopLossPoint[] = [];
  let breachedOpenCount = 0;

  for (const pos of positions) {
    if (!Number.isFinite(pos.entryPrice) || pos.entryPrice <= 0) continue;

    const mark = resolveMark(pos);
    const isClosedLoss = pos.status === 'CLOSED_LOSS';
    const isLiveBreach =
      scope === 'LOSSES_AND_BREACHED' &&
      pos.status === 'OPEN' &&
      Number.isFinite(pos.stopLoss) &&
      pos.stopLoss > 0 &&
      (pos.direction === 'SELL' ? mark >= pos.stopLoss : mark <= pos.stopLoss);

    if (!isClosedLoss && !isLiveBreach) continue;
    if (isLiveBreach) breachedOpenCount += 1;

    const hitExitPrice = isLiveBreach ? mark : pos.currentPrice > 0 ? pos.currentPrice : pos.stopLoss;
    const stopRefPrice = Number.isFinite(pos.stopLoss) && pos.stopLoss > 0 ? pos.stopLoss : hitExitPrice;

    const plannedStopDistancePct = Number(
      ((Math.abs(stopRefPrice - pos.entryPrice) / pos.entryPrice) * 100).toFixed(3)
    );
    const actualExitDistancePct = Number(
      ((Math.abs(hitExitPrice - pos.entryPrice) / pos.entryPrice) * 100).toFixed(3)
    );

    const selectedDistancePct =
      distanceMetric === 'PLANNED_STOP_PCT' && plannedStopDistancePct > 0
        ? plannedStopDistancePct
        : actualExitDistancePct > 0
        ? actualExitDistancePct
        : plannedStopDistancePct;

    // Signed offset relative to entry (negative = adverse direction relative to position side)
    const rawSignedMovePct = ((hitExitPrice - pos.entryPrice) / pos.entryPrice) * 100;
    const signedOffsetPct = Number(
      (distanceMetric === 'PLANNED_STOP_PCT'
        ? ((stopRefPrice - pos.entryPrice) / pos.entryPrice) * 100
        : rawSignedMovePct
      ).toFixed(3)
    );

    const plannedDistAbs = Math.abs(stopRefPrice - pos.entryPrice);
    const actualDistAbs = Math.abs(hitExitPrice - pos.entryPrice);
    const overshootRatioPct =
      plannedDistAbs > 0 ? Number(((actualDistAbs / plannedDistAbs) * 100).toFixed(1)) : 100;

    const multiplier = getInstrumentMultiplierForMae(pos.instrumentId);
    const computedUsd = isLiveBreach
      ? (pos.direction === 'SELL' ? pos.entryPrice - mark : mark - pos.entryPrice) * pos.lots * multiplier
      : pos.realizedPnl;
    const lossUsd = Number(Math.abs(Math.min(0, computedUsd)).toFixed(2));

    const isRoundLevelStop = isPsychologicalRoundPrice(
      distanceMetric === 'PLANNED_STOP_PCT' ? stopRefPrice : hitExitPrice,
      pos.instrumentId
    );
    const failurePattern = classifyStopFailurePattern(
      plannedStopDistancePct,
      actualExitDistancePct,
      overshootRatioPct
    );

    points.push({
      positionId: pos.id,
      instrumentId: pos.instrumentId,
      direction: pos.direction,
      horizon: resolvePositionAdvisoryHorizon(pos),
      openTime: pos.openTime,
      isLiveBreach,
      entryPrice: pos.entryPrice,
      stopLossPrice: stopRefPrice,
      hitExitPrice: Number(hitExitPrice.toFixed(2)),
      plannedStopDistancePct,
      actualExitDistancePct,
      selectedDistancePct,
      signedOffsetPct,
      overshootRatioPct,
      lossUsd,
      isRoundLevelStop,
      failurePattern,
      bandId: classifyStopBand(selectedDistancePct),
      notes: pos.notes,
    });
  }

  const rowDefs: Array<{ rowId: string; label: string }> =
    groupBy === 'DIRECTION'
      ? [
          { rowId: 'BUY', label: 'BUY (Long Entries)' },
          { rowId: 'SELL', label: 'SELL (Short Entries)' },
        ]
      : [
          { rowId: 'INTRADAY', label: 'Intraday (M15)' },
          { rowId: 'SWING', label: 'Swing (H4)' },
          { rowId: 'LONG_TERM', label: 'Long-Term (W1)' },
        ];

  const totalCount = points.length;
  const totalLossUsd = Number(points.reduce((s, p) => s + p.lossUsd, 0).toFixed(2));

  // First pass: find max cell count for intensity scaling
  let maxCellCount = 1;
  const cellTradesMap = new Map<string, HitStopLossPoint[]>();

  for (const r of rowDefs) {
    for (const b of STOP_DISTANCE_BANDS) {
      const key = `${r.rowId}::${b.id}`;
      const matched = points.filter(
        (pt) => (groupBy === 'DIRECTION' ? pt.direction : pt.horizon) === r.rowId && pt.bandId === b.id
      );
      cellTradesMap.set(key, matched);
      if (matched.length > maxCellCount) maxCellCount = matched.length;
    }
  }

  const rows: StopLossConcentrationRow[] = rowDefs.map((r) => {
    const rowTrades = points.filter(
      (pt) => (groupBy === 'DIRECTION' ? pt.direction : pt.horizon) === r.rowId
    );
    const rowLoss = Number(rowTrades.reduce((s, t) => s + t.lossUsd, 0).toFixed(2));
    const rowAvgDist =
      rowTrades.length > 0
        ? Number((rowTrades.reduce((s, t) => s + t.selectedDistancePct, 0) / rowTrades.length).toFixed(2))
        : 0;

    const cells: StopLossConcentrationCell[] = STOP_DISTANCE_BANDS.map((b) => {
      const matched = cellTradesMap.get(`${r.rowId}::${b.id}`) || [];
      const cellLoss = Number(matched.reduce((s, t) => s + t.lossUsd, 0).toFixed(2));
      const cellAvgDist =
        matched.length > 0
          ? Number((matched.reduce((s, t) => s + t.selectedDistancePct, 0) / matched.length).toFixed(2))
          : 0;
      const intensity =
        matched.length === 0 ? 0 : Number(Math.min(1, 0.28 + 0.72 * (matched.length / maxCellCount)).toFixed(2));

      return {
        rowId: r.rowId,
        bandId: b.id,
        hitCount: matched.length,
        sharePct: totalCount > 0 ? Number(((matched.length / totalCount) * 100).toFixed(1)) : 0,
        totalLossUsd: cellLoss,
        avgDistancePct: cellAvgDist,
        roundLevelCount: matched.filter((t) => t.isRoundLevelStop).length,
        overrunCount: matched.filter((t) => t.failurePattern === 'SLIPPAGE_OVERRUN').length,
        intensity,
        trades: matched,
      };
    });

    return {
      rowId: r.rowId,
      label: r.label,
      totalCount: rowTrades.length,
      sharePct: totalCount > 0 ? Number(((rowTrades.length / totalCount) * 100).toFixed(1)) : 0,
      totalLossUsd: rowLoss,
      avgDistancePct: rowAvgDist,
      cells,
    };
  });

  // Hottest band across all rows
  const bandTotals = STOP_DISTANCE_BANDS.map((b) => {
    const matched = points.filter((p) => p.bandId === b.id);
    return {
      bandId: b.id,
      label: b.label,
      rangeLabel: b.rangeLabel,
      hitCount: matched.length,
      sharePct: totalCount > 0 ? Number(((matched.length / totalCount) * 100).toFixed(1)) : 0,
      totalLossUsd: Number(matched.reduce((s, t) => s + t.lossUsd, 0).toFixed(2)),
    };
  }).filter((b) => b.hitCount > 0);

  bandTotals.sort((a, b) => b.hitCount - a.hitCount || b.totalLossUsd - a.totalLossUsd);
  const hottestBand = bandTotals[0] ?? null;

  const sortedDistances = [...points].map((p) => p.selectedDistancePct).sort((a, b) => a - b);
  const avgStopDistancePct =
    totalCount > 0
      ? Number((points.reduce((s, p) => s + p.selectedDistancePct, 0) / totalCount).toFixed(2))
      : 0;
  const medianStopDistancePct =
    totalCount === 0
      ? 0
      : totalCount % 2 === 1
      ? Number(sortedDistances[(totalCount - 1) / 2].toFixed(2))
      : Number(((sortedDistances[totalCount / 2 - 1] + sortedDistances[totalCount / 2]) / 2).toFixed(2));

  const roundLevelCount = points.filter((p) => p.isRoundLevelStop).length;
  const roundLevelClusteringPct =
    totalCount > 0 ? Number(((roundLevelCount / totalCount) * 100).toFixed(1)) : 0;
  const slippageOverrunCount = points.filter((p) => p.failurePattern === 'SLIPPAGE_OVERRUN').length;
  const stopHuntClusterCount = points.filter((p) => p.failurePattern === 'STOP_HUNT_SWEEP').length;

  let diagnosticInsight = 'No stopped-out or stop-breached positions recorded in the active window.';
  if (totalCount > 0 && hottestBand) {
    const dominantRow = [...rows].sort((a, b) => b.totalCount - a.totalCount)[0];
    const roundClause =
      roundLevelClusteringPct >= 50
        ? ` ${roundLevelClusteringPct.toFixed(0)}% of hit stops sit directly on psychological round price levels, signaling predictable liquidity-sweep placement.`
        : '';
    const overrunClause =
      slippageOverrunCount > 0
        ? ` ${slippageOverrunCount} trade(s) exceeded planned stop boundaries (>110% overshoot), amplifying realized drawdown.`
        : '';
    diagnosticInsight = `Peak stop-loss cluster sits in ${hottestBand.label} (${hottestBand.rangeLabel} from entry) with ${hottestBand.hitCount}/${totalCount} hits (${hottestBand.sharePct.toFixed(
      1
    )}%, -$${hottestBand.totalLossUsd.toLocaleString()}) concentrated in ${dominantRow.label}.${roundClause}${overrunClause}`;
  }

  return {
    groupBy,
    scope,
    distanceMetric,
    totalHitStopsCount: totalCount,
    breachedOpenCount,
    totalLossUsd,
    avgStopDistancePct,
    medianStopDistancePct,
    roundLevelClusteringPct,
    slippageOverrunCount,
    stopHuntClusterCount,
    hottestBand,
    bands: STOP_DISTANCE_BANDS,
    rows,
    points,
    diagnosticInsight,
  };
}

// =====================================================================
// AUTONOMOUS SIMULATED PAPER TRADING (AUTO-PAPER PILOT) ENGINE
// Strictly Non-Execution Simulation · INTRADAY & SWING Signals Only
// =====================================================================

export type AutoPilotAllowedHorizon = 'INTRADAY' | 'SWING';

export const ALLOWED_AUTO_PILOT_HORIZONS: readonly AutoPilotAllowedHorizon[] = [
  'INTRADAY',
  'SWING',
];

export interface AutoPaperPilotConfig {
  enabled: boolean;
  allowedHorizons: AutoPilotAllowedHorizon[];
  maxConcurrentOpenTrades: number;
  riskPctPerTrade: number;
  minRewardToRiskRatio: number;
  dailyMaxDrawdownPct: number;
  autoManageExits: boolean;
  allowContraDirections: boolean;
  exitOnAdvisoryFlip: boolean;
  cooldownMinutesPerHorizon: number;
}

export const DEFAULT_AUTO_PAPER_PILOT_CONFIG: AutoPaperPilotConfig = {
  enabled: false,
  allowedHorizons: ['INTRADAY', 'SWING'],
  maxConcurrentOpenTrades: 3,
  riskPctPerTrade: 1.0,
  minRewardToRiskRatio: 1.5,
  dailyMaxDrawdownPct: 3.0,
  autoManageExits: true,
  allowContraDirections: false,
  exitOnAdvisoryFlip: false,
  cooldownMinutesPerHorizon: 15,
};

export interface AutoPilotExitCandidate {
  positionId: string;
  instrumentId: InstrumentId;
  advisoryHorizon: string;
  direction: 'BUY' | 'SELL';
  triggerReason: 'STOP_LOSS_HIT' | 'TARGET_1_HIT' | 'ADVISORY_FLIP';
  exitPrice: number;
  projectedPnlUsd: number;
  closeNote: string;
}

export type PositionAdvisoryAlignmentStatus =
  | 'ALIGNED'
  | 'CONTRA_ADVISORY'
  | 'ADVISORY_PAUSED'
  | 'UNAVAILABLE';

export interface OpenPositionAdvisoryAlignment {
  positionId: string;
  instrumentId: InstrumentId;
  advisoryHorizon: HorizonCategory;
  positionDirection: 'BUY' | 'SELL';
  livePlanDirection: TradeDirection | null;
  livePlanState: RecommendationState | null;
  status: PositionAdvisoryAlignmentStatus;
  hasOppositeOpenPeer: boolean;
  oppositePeerIds: string[];
  reason: string;
}

export interface PortfolioAdvisoryAlignmentReport {
  evaluatedOpenCount: number;
  alignedCount: number;
  contraAdvisoryCount: number;
  advisoryPausedCount: number;
  contraPeerPositionCount: number;
  byPositionId: Record<string, OpenPositionAdvisoryAlignment>;
  contraPositionIds: string[];
}

export function isActionableDirectionalPlan(plan?: TradePlan | null): boolean {
  if (!plan) return false;
  if (plan.isAbstained) return false;
  if (plan.state === 'DATA_QUALITY_HOLD' || plan.state === 'NO_TRADE') return false;
  return plan.direction === 'BUY' || plan.direction === 'SELL';
}

function resolveMatchingTradePlanForPosition(
  pos: PaperPosition,
  tradePlans: Record<string, TradePlan> | undefined
): { horizon: HorizonCategory; plan: TradePlan | null } {
  const posHorizon = resolvePositionAdvisoryHorizon(pos);
  if (!tradePlans) {
    return { horizon: posHorizon, plan: null };
  }
  const directKey = pos.advisoryHorizon || posHorizon;
  const candidate = tradePlans[directKey] || tradePlans[posHorizon] || null;
  if (candidate && candidate.instrumentId === pos.instrumentId) {
    return { horizon: posHorizon, plan: candidate };
  }
  // Fallback scan by matching instrument & compatible horizon if stored key differs
  const fallback =
    Object.values(tradePlans).find(
      (p) => p && p.instrumentId === pos.instrumentId && p.horizon === directKey
    ) ||
    Object.values(tradePlans).find(
      (p) => p && p.instrumentId === pos.instrumentId && p.horizon === posHorizon
    ) ||
    null;
  return { horizon: posHorizon, plan: fallback };
}

/**
 * Evaluates all OPEN paper positions against current live advisory TradePlans and
 * peer open positions on the same instrument to detect directional contradictions.
 */
export function evaluateOpenPositionsAdvisoryAlignment(
  positions: PaperPosition[],
  tradePlans: Record<string, TradePlan> | undefined
): PortfolioAdvisoryAlignmentReport {
  const openList = positions.filter((p) => p.status === 'OPEN');
  const byPositionId: Record<string, OpenPositionAdvisoryAlignment> = {};
  const contraPositionIds: string[] = [];

  let alignedCount = 0;
  let contraAdvisoryCount = 0;
  let advisoryPausedCount = 0;
  let contraPeerPositionCount = 0;

  for (const pos of openList) {
    const oppositePeerIds = openList
      .filter(
        (other) =>
          other.id !== pos.id &&
          other.instrumentId === pos.instrumentId &&
          other.direction !== pos.direction
      )
      .map((other) => other.id);
    const hasOppositeOpenPeer = oppositePeerIds.length > 0;
    if (hasOppositeOpenPeer) {
      contraPeerPositionCount += 1;
    }

    const { horizon, plan } = resolveMatchingTradePlanForPosition(pos, tradePlans);
    if (!plan) {
      const anyPlanInstrument = Object.values(tradePlans || {}).find((p) => Boolean(p))?.instrumentId;
      byPositionId[pos.id] = {
        positionId: pos.id,
        instrumentId: pos.instrumentId,
        advisoryHorizon: horizon,
        positionDirection: pos.direction,
        livePlanDirection: null,
        livePlanState: null,
        status: 'UNAVAILABLE',
        hasOppositeOpenPeer,
        oppositePeerIds,
        reason: anyPlanInstrument
          ? `Live advisory plans are currently focused on ${anyPlanInstrument}; switch active market to compare ${pos.instrumentId}.`
          : `No live ${horizon} advisory plan loaded for ${pos.instrumentId}.`,
      };
      continue;
    }

    if (!isActionableDirectionalPlan(plan)) {
      advisoryPausedCount += 1;
      byPositionId[pos.id] = {
        positionId: pos.id,
        instrumentId: pos.instrumentId,
        advisoryHorizon: horizon,
        positionDirection: pos.direction,
        livePlanDirection: plan.direction,
        livePlanState: plan.state,
        status: 'ADVISORY_PAUSED',
        hasOppositeOpenPeer,
        oppositePeerIds,
        reason:
          plan.abstentionReason ||
          `${horizon} advisory has downgraded to ${plan.direction} (${plan.state}); monitor or tighten stop.`,
      };
      continue;
    }

    if (plan.direction !== pos.direction) {
      contraAdvisoryCount += 1;
      contraPositionIds.push(pos.id);
      byPositionId[pos.id] = {
        positionId: pos.id,
        instrumentId: pos.instrumentId,
        advisoryHorizon: horizon,
        positionDirection: pos.direction,
        livePlanDirection: plan.direction,
        livePlanState: plan.state,
        status: 'CONTRA_ADVISORY',
        hasOppositeOpenPeer,
        oppositePeerIds,
        reason: `Open ${pos.direction} contradicts current live ${horizon} advisory (${plan.direction} / ${plan.state}).`,
      };
      continue;
    }

    alignedCount += 1;
    byPositionId[pos.id] = {
      positionId: pos.id,
      instrumentId: pos.instrumentId,
      advisoryHorizon: horizon,
      positionDirection: pos.direction,
      livePlanDirection: plan.direction,
      livePlanState: plan.state,
      status: 'ALIGNED',
      hasOppositeOpenPeer,
      oppositePeerIds,
      reason: `Aligned with live ${horizon} advisory (${plan.direction} / ${plan.state}).`,
    };
  }

  return {
    evaluatedOpenCount: openList.length,
    alignedCount,
    contraAdvisoryCount,
    advisoryPausedCount,
    contraPeerPositionCount,
    byPositionId,
    contraPositionIds,
  };
}

export interface AutoPilotEntryCandidate {
  planId: string;
  horizon: AutoPilotAllowedHorizon;
  instrumentId: InstrumentId;
  direction: 'BUY' | 'SELL';
  entryPrice: number;
  stopLoss: number;
  takeProfit: number;
  lots: number;
  riskDollars: number;
  rewardToRiskRatio: number;
  position: PaperPosition;
}

export interface AutoPilotPlanDecision {
  planKey: string;
  planId: string;
  horizon: string;
  instrumentId: string;
  direction: string;
  decision: 'EXECUTED' | 'WOULD_OPEN' | 'SKIPPED' | 'BLOCKED_HORIZON';
  reason: string;
}

export interface AutoPaperPilotCycleEvaluation {
  config: AutoPaperPilotConfig;
  isEnabled: boolean;
  evaluatedAt: string;
  openPositionsCount: number;
  remainingCapacitySlots: number;
  currentDailyPnlUsd: number;
  currentDailyDrawdownPct: number;
  circuitBreakerTripped: boolean;
  exitsToClose: AutoPilotExitCandidate[];
  entriesToOpen: AutoPilotEntryCandidate[];
  planDecisions: AutoPilotPlanDecision[];
}

function clampFinite(value: unknown, fallback: number, min: number, max: number): number {
  const num = Number(value);
  if (!Number.isFinite(num)) return fallback;
  return Math.min(max, Math.max(min, num));
}

/**
 * Normalizes and clamps Auto-Paper Pilot configuration while strictly restricting
 * autonomous simulated horizons to INTRADAY and SWING (LONG_TERM and CFD excluded).
 */
export function normalizeAutoPaperPilotConfig(
  raw?: Partial<AutoPaperPilotConfig> | Record<string, unknown> | null
): AutoPaperPilotConfig {
  const source = (raw || {}) as Record<string, unknown>;

  let allowedHorizons: AutoPilotAllowedHorizon[] = [...DEFAULT_AUTO_PAPER_PILOT_CONFIG.allowedHorizons];
  if (Array.isArray(source.allowedHorizons)) {
    const filtered: AutoPilotAllowedHorizon[] = [];
    for (const item of source.allowedHorizons) {
      if ((item === 'INTRADAY' || item === 'SWING') && !filtered.includes(item)) {
        filtered.push(item);
      }
    }
    allowedHorizons = filtered;
  }

  return {
    enabled: Boolean(source.enabled),
    allowedHorizons,
    maxConcurrentOpenTrades: Math.round(
      clampFinite(
        source.maxConcurrentOpenTrades,
        DEFAULT_AUTO_PAPER_PILOT_CONFIG.maxConcurrentOpenTrades,
        1,
        10
      )
    ),
    riskPctPerTrade: Number(
      clampFinite(
        source.riskPctPerTrade,
        DEFAULT_AUTO_PAPER_PILOT_CONFIG.riskPctPerTrade,
        0.25,
        5.0
      ).toFixed(2)
    ),
    minRewardToRiskRatio: Number(
      clampFinite(
        source.minRewardToRiskRatio,
        DEFAULT_AUTO_PAPER_PILOT_CONFIG.minRewardToRiskRatio,
        1.2,
        5.0
      ).toFixed(2)
    ),
    dailyMaxDrawdownPct: Number(
      clampFinite(
        source.dailyMaxDrawdownPct,
        DEFAULT_AUTO_PAPER_PILOT_CONFIG.dailyMaxDrawdownPct,
        0.5,
        15.0
      ).toFixed(2)
    ),
    autoManageExits:
      source.autoManageExits === undefined
        ? DEFAULT_AUTO_PAPER_PILOT_CONFIG.autoManageExits
        : Boolean(source.autoManageExits),
    allowContraDirections:
      source.allowContraDirections === undefined
        ? DEFAULT_AUTO_PAPER_PILOT_CONFIG.allowContraDirections
        : Boolean(source.allowContraDirections),
    exitOnAdvisoryFlip:
      source.exitOnAdvisoryFlip === undefined
        ? DEFAULT_AUTO_PAPER_PILOT_CONFIG.exitOnAdvisoryFlip
        : Boolean(source.exitOnAdvisoryFlip),
    cooldownMinutesPerHorizon: Math.round(
      clampFinite(
        source.cooldownMinutesPerHorizon,
        DEFAULT_AUTO_PAPER_PILOT_CONFIG.cooldownMinutesPerHorizon,
        1,
        240
      )
    ),
  };
}

/**
 * Calculates risk-parameterized paper lot sizing from account equity, risk %,
 * stop-loss distance, and canonical contract multiplier.
 */
export function calculateRiskSizedPaperLots(params: {
  accountEquityUsd: number;
  riskPctPerTrade: number;
  entryPrice: number;
  stopLossPrice: number;
  instrumentId: string;
}): number {
  const stopDistance = Math.abs(params.entryPrice - params.stopLossPrice);
  const multiplier = getInstrumentMultiplierForMae(params.instrumentId);
  if (
    !Number.isFinite(params.accountEquityUsd) ||
    params.accountEquityUsd <= 0 ||
    !Number.isFinite(stopDistance) ||
    stopDistance <= 0 ||
    multiplier <= 0
  ) {
    return 0.01;
  }
  const boundedRiskPct = clampFinite(params.riskPctPerTrade, 1.0, 0.25, 5.0);
  const riskDollars = params.accountEquityUsd * (boundedRiskPct / 100);
  const rawLots = riskDollars / (stopDistance * multiplier);
  const rounded = Math.round(rawLots * 100) / 100;
  return Number(Math.min(25.0, Math.max(0.01, rounded)).toFixed(2));
}

/**
 * Evaluates a single Autonomous Simulated Paper Trading (Auto-Paper Pilot) cycle.
 * Strictly enforces INTRADAY/SWING-only execution, Stop-First exit checks,
 * concurrent open trade caps, R:R floor, cooldowns, and daily drawdown circuit breaker.
 */
export function evaluateAutoPaperPilotCycle(input: {
  config: Partial<AutoPaperPilotConfig> | AutoPaperPilotConfig;
  positions: PaperPosition[];
  tradePlans: Record<string, TradePlan>;
  accountBalanceUsd: number;
  defaultQuote?: Quote;
  quotes?: Record<string, Quote>;
  recentAutoEntryTimestamps?: Record<string, number>;
  nowMs?: number;
}): AutoPaperPilotCycleEvaluation {
  const config = normalizeAutoPaperPilotConfig(input.config);
  const nowMs =
    typeof input.nowMs === 'number' && Number.isFinite(input.nowMs) ? input.nowMs : Date.now();
  const nowIso = new Date(nowMs).toISOString();
  const todayUtcPrefix = nowIso.slice(0, 10);
  const accountBalanceUsd =
    Number.isFinite(input.accountBalanceUsd) && input.accountBalanceUsd > 0
      ? input.accountBalanceUsd
      : 100000;

  const resolveMarkPrice = (instrumentId: string, fallbackPrice?: number): number => {
    const mapped = input.quotes?.[instrumentId]?.mid;
    if (typeof mapped === 'number' && Number.isFinite(mapped) && mapped > 0) {
      return mapped;
    }
    if (
      input.defaultQuote &&
      input.defaultQuote.mid > 0 &&
      (instrumentId === input.defaultQuote.instrumentId || instrumentId === 'XAUUSD')
    ) {
      return input.defaultQuote.mid;
    }
    return typeof fallbackPrice === 'number' && Number.isFinite(fallbackPrice) && fallbackPrice > 0
      ? fallbackPrice
      : 0;
  };

  // 1. Evaluate autonomous SL / Target 1 & optional Advisory-Flip exits for INTRADAY & SWING open positions
  const exitsToClose: AutoPilotExitCandidate[] = [];
  if (config.autoManageExits || config.exitOnAdvisoryFlip) {
    for (const pos of input.positions) {
      if (pos.status !== 'OPEN') continue;
      const posHorizon = resolvePositionAdvisoryHorizon(pos);
      if (posHorizon !== 'INTRADAY' && posHorizon !== 'SWING') {
        continue;
      }

      const mark = resolveMarkPrice(pos.instrumentId, pos.currentPrice);
      if (mark <= 0) continue;

      const slHit =
        config.autoManageExits &&
        Number.isFinite(pos.stopLoss) &&
        pos.stopLoss > 0 &&
        (pos.direction === 'BUY' ? mark <= pos.stopLoss : mark >= pos.stopLoss);
      const tpHit =
        config.autoManageExits &&
        Number.isFinite(pos.takeProfit) &&
        pos.takeProfit > 0 &&
        (pos.direction === 'BUY' ? mark >= pos.takeProfit : mark <= pos.takeProfit);

      // Stop-First precedence rule
      if (slHit || tpHit) {
        const triggerReason: 'STOP_LOSS_HIT' | 'TARGET_1_HIT' = slHit
          ? 'STOP_LOSS_HIT'
          : 'TARGET_1_HIT';
        const priceDelta =
          pos.direction === 'SELL' ? pos.entryPrice - mark : mark - pos.entryPrice;
        const multiplier = getInstrumentMultiplierForMae(pos.instrumentId);
        const projectedPnlUsd = Number((priceDelta * pos.lots * multiplier).toFixed(2));
        exitsToClose.push({
          positionId: pos.id,
          instrumentId: pos.instrumentId,
          advisoryHorizon: posHorizon,
          direction: pos.direction,
          triggerReason,
          exitPrice: Number(mark.toFixed(4)),
          projectedPnlUsd,
          closeNote: `[AUTO-PAPER-PILOT Exit: ${
            triggerReason === 'STOP_LOSS_HIT' ? 'Stop-Loss' : 'Target 1'
          } reached at $${mark.toFixed(2)}.]`,
        });
        continue;
      }

      if (config.exitOnAdvisoryFlip) {
        const { plan: matchingPlan } = resolveMatchingTradePlanForPosition(pos, input.tradePlans);
        if (
          matchingPlan &&
          isActionableDirectionalPlan(matchingPlan) &&
          matchingPlan.direction !== pos.direction
        ) {
          const priceDelta =
            pos.direction === 'SELL' ? pos.entryPrice - mark : mark - pos.entryPrice;
          const multiplier = getInstrumentMultiplierForMae(pos.instrumentId);
          const projectedPnlUsd = Number((priceDelta * pos.lots * multiplier).toFixed(2));
          exitsToClose.push({
            positionId: pos.id,
            instrumentId: pos.instrumentId,
            advisoryHorizon: posHorizon,
            direction: pos.direction,
            triggerReason: 'ADVISORY_FLIP',
            exitPrice: Number(mark.toFixed(4)),
            projectedPnlUsd,
            closeNote: `[AUTO-PAPER-PILOT Exit: ${posHorizon} advisory flipped to ${matchingPlan.direction} at $${mark.toFixed(
              2
            )}.]`,
          });
        }
      }
    }
  }

  const closingIds = new Set(exitsToClose.map((e) => e.positionId));
  const remainingOpenPositions = input.positions.filter(
    (p) => p.status === 'OPEN' && !closingIds.has(p.id)
  );
  const openPositionsCount = remainingOpenPositions.length;
  const remainingCapacitySlots = Math.max(0, config.maxConcurrentOpenTrades - openPositionsCount);

  // 2. Daily Drawdown Circuit Breaker calculation (today's UTC realized + live open MTM)
  let todayRealized = 0;
  for (const pos of input.positions) {
    if (pos.status !== 'OPEN' && pos.openTime?.slice(0, 10) === todayUtcPrefix) {
      todayRealized += pos.realizedPnl;
    }
  }
  const exitsRealized = exitsToClose.reduce((acc, item) => acc + item.projectedPnlUsd, 0);
  const openUnrealized = remainingOpenPositions.reduce((acc, pos) => {
    const mark = resolveMarkPrice(pos.instrumentId, pos.currentPrice);
    if (mark <= 0) return acc;
    const delta = pos.direction === 'SELL' ? pos.entryPrice - mark : mark - pos.entryPrice;
    return acc + delta * pos.lots * getInstrumentMultiplierForMae(pos.instrumentId);
  }, 0);

  const currentDailyPnlUsd = Number((todayRealized + exitsRealized + openUnrealized).toFixed(2));
  const currentDailyDrawdownPct =
    currentDailyPnlUsd < 0
      ? Number(((Math.abs(currentDailyPnlUsd) / accountBalanceUsd) * 100).toFixed(2))
      : 0;
  const circuitBreakerTripped = currentDailyDrawdownPct >= config.dailyMaxDrawdownPct;

  // 3. Evaluate tradePlans with strict INTRADAY / SWING horizon & risk guardrails
  const entriesToOpen: AutoPilotEntryCandidate[] = [];
  const planDecisions: AutoPilotPlanDecision[] = [];

  for (const [planKey, plan] of Object.entries(input.tradePlans || {})) {
    if (!plan) continue;
    const horizon = String(plan.horizon || planKey).toUpperCase();

    if (horizon !== 'INTRADAY' && horizon !== 'SWING') {
      planDecisions.push({
        planKey,
        planId: plan.id,
        horizon,
        instrumentId: plan.instrumentId,
        direction: plan.direction,
        decision: 'BLOCKED_HORIZON',
        reason: `Excluded: Auto-Paper Pilot strictly trades INTRADAY and SWING signals only (${horizon} blocked).`,
      });
      continue;
    }

    const allowedHorizon: AutoPilotAllowedHorizon = horizon;

    if (!config.allowedHorizons.includes(allowedHorizon)) {
      planDecisions.push({
        planKey,
        planId: plan.id,
        horizon: allowedHorizon,
        instrumentId: plan.instrumentId,
        direction: plan.direction,
        decision: 'SKIPPED',
        reason: `${allowedHorizon} horizon is toggled off in Auto-Paper Pilot settings.`,
      });
      continue;
    }

    if (
      plan.isAbstained ||
      plan.state === 'DATA_QUALITY_HOLD' ||
      plan.state === 'NO_TRADE' ||
      (plan.direction !== 'BUY' && plan.direction !== 'SELL')
    ) {
      planDecisions.push({
        planKey,
        planId: plan.id,
        horizon: allowedHorizon,
        instrumentId: plan.instrumentId,
        direction: plan.direction,
        decision: 'SKIPPED',
        reason:
          plan.abstentionReason ||
          `Signal non-actionable (${plan.direction} / ${plan.state}).`,
      });
      continue;
    }

    const entryMark = resolveMarkPrice(plan.instrumentId, plan.currentMid);
    const stopLoss = Number(plan.stopLossPrice);
    const takeProfit = Number(plan.target1Price);
    const geometryValid =
      entryMark > 0 &&
      Number.isFinite(stopLoss) &&
      stopLoss > 0 &&
      Number.isFinite(takeProfit) &&
      takeProfit > 0 &&
      (plan.direction === 'BUY'
        ? stopLoss < entryMark && takeProfit > entryMark
        : stopLoss > entryMark && takeProfit < entryMark);

    if (!geometryValid) {
      planDecisions.push({
        planKey,
        planId: plan.id,
        horizon: allowedHorizon,
        instrumentId: plan.instrumentId,
        direction: plan.direction,
        decision: 'SKIPPED',
        reason: 'Stop-loss or Target 1 levels are invalid relative to current market price.',
      });
      continue;
    }

    const stopDistance = Math.abs(entryMark - stopLoss);
    const rewardDistance = Math.abs(takeProfit - entryMark);
    const liveRr = stopDistance > 0 ? rewardDistance / stopDistance : 0;
    const effectiveRr = Number(
      Math.min(
        liveRr,
        Number.isFinite(plan.rewardToRiskRatio) && plan.rewardToRiskRatio > 0
          ? plan.rewardToRiskRatio
          : liveRr
      ).toFixed(2)
    );

    if (effectiveRr < config.minRewardToRiskRatio) {
      planDecisions.push({
        planKey,
        planId: plan.id,
        horizon: allowedHorizon,
        instrumentId: plan.instrumentId,
        direction: plan.direction,
        decision: 'SKIPPED',
        reason: `Reward:Risk ${effectiveRr.toFixed(2)}:1 is below ${config.minRewardToRiskRatio.toFixed(
          2
        )}:1 minimum guardrail.`,
      });
      continue;
    }

    if (circuitBreakerTripped) {
      planDecisions.push({
        planKey,
        planId: plan.id,
        horizon: allowedHorizon,
        instrumentId: plan.instrumentId,
        direction: plan.direction,
        decision: 'SKIPPED',
        reason: `Daily loss circuit breaker active (${currentDailyDrawdownPct.toFixed(
          2
        )}% >= ${config.dailyMaxDrawdownPct.toFixed(2)}% limit).`,
      });
      continue;
    }

    const hasActiveConflict =
      remainingOpenPositions.some(
        (p) =>
          p.tradePlanId === plan.id ||
          (p.instrumentId === plan.instrumentId &&
            resolvePositionAdvisoryHorizon(p) === allowedHorizon)
      ) ||
      entriesToOpen.some(
        (e) =>
          e.planId === plan.id ||
          (e.instrumentId === plan.instrumentId && e.horizon === allowedHorizon)
      );

    if (hasActiveConflict) {
      planDecisions.push({
        planKey,
        planId: plan.id,
        horizon: allowedHorizon,
        instrumentId: plan.instrumentId,
        direction: plan.direction,
        decision: 'SKIPPED',
        reason: `Active simulated position already open for ${plan.instrumentId} (${allowedHorizon}).`,
      });
      continue;
    }

    if (!config.allowContraDirections) {
      const contraOpen = remainingOpenPositions.find(
        (p) => p.instrumentId === plan.instrumentId && p.direction !== plan.direction
      );
      const contraQueued = entriesToOpen.find(
        (e) => e.instrumentId === plan.instrumentId && e.direction !== plan.direction
      );
      if (contraOpen || contraQueued) {
        const blockerDir = contraOpen ? contraOpen.direction : contraQueued!.direction;
        const blockerHorizon = contraOpen
          ? resolvePositionAdvisoryHorizon(contraOpen)
          : contraQueued!.horizon;
        planDecisions.push({
          planKey,
          planId: plan.id,
          horizon: allowedHorizon,
          instrumentId: plan.instrumentId,
          direction: plan.direction,
          decision: 'SKIPPED',
          reason: `Contra-direction block: Active ${blockerDir} position already open on ${plan.instrumentId} (${blockerHorizon}); opposite ${plan.direction} suppressed.`,
        });
        continue;
      }
    }

    const cooldownMs = config.cooldownMinutesPerHorizon * 60_000;
    let lastAutoMs = input.recentAutoEntryTimestamps?.[allowedHorizon] || 0;
    for (const p of input.positions) {
      if (
        p.notes?.includes('[AUTO-PAPER-PILOT Entry]') &&
        resolvePositionAdvisoryHorizon(p) === allowedHorizon
      ) {
        const parsedMs = Date.parse(p.openTime);
        if (Number.isFinite(parsedMs) && parsedMs > lastAutoMs) {
          lastAutoMs = parsedMs;
        }
      }
    }
    if (lastAutoMs > 0 && nowMs - lastAutoMs < cooldownMs) {
      const remainingMin = Math.max(1, Math.ceil((cooldownMs - (nowMs - lastAutoMs)) / 60_000));
      planDecisions.push({
        planKey,
        planId: plan.id,
        horizon: allowedHorizon,
        instrumentId: plan.instrumentId,
        direction: plan.direction,
        decision: 'SKIPPED',
        reason: `Horizon cooldown active (${remainingMin}m remaining of ${config.cooldownMinutesPerHorizon}m).`,
      });
      continue;
    }

    if (entriesToOpen.length >= remainingCapacitySlots) {
      planDecisions.push({
        planKey,
        planId: plan.id,
        horizon: allowedHorizon,
        instrumentId: plan.instrumentId,
        direction: plan.direction,
        decision: 'SKIPPED',
        reason: `Max concurrent open trades reached (${
          openPositionsCount + entriesToOpen.length
        }/${config.maxConcurrentOpenTrades}).`,
      });
      continue;
    }

    const lots = calculateRiskSizedPaperLots({
      accountEquityUsd: accountBalanceUsd,
      riskPctPerTrade: config.riskPctPerTrade,
      entryPrice: entryMark,
      stopLossPrice: stopLoss,
      instrumentId: plan.instrumentId,
    });
    const riskDollars = Number((accountBalanceUsd * (config.riskPctPerTrade / 100)).toFixed(2));
    const position: PaperPosition = {
      id: `AUTO-${allowedHorizon.slice(0, 3)}-${nowMs.toString().slice(-6)}-${
        entriesToOpen.length + 1
      }`,
      tradePlanId: plan.id,
      advisoryHorizon: allowedHorizon,
      instrumentId: plan.instrumentId,
      direction: plan.direction,
      lots,
      entryPrice: Number(entryMark.toFixed(4)),
      currentPrice: Number(entryMark.toFixed(4)),
      stopLoss: Number(stopLoss.toFixed(4)),
      takeProfit: Number(takeProfit.toFixed(4)),
      adverseExtremePrice: Number(entryMark.toFixed(4)),
      unrealizedPnl: 0,
      realizedPnl: 0,
      openTime: nowIso,
      status: 'OPEN',
      notes: `[AUTO-PAPER-PILOT Entry] Simulated ${allowedHorizon} ${
        plan.direction
      } (${lots.toFixed(2)} lots, ${config.riskPctPerTrade.toFixed(
        2
      )}% risk / $${riskDollars.toFixed(2)}, R:R ${effectiveRr.toFixed(2)}:1).`,
    };

    entriesToOpen.push({
      planId: plan.id,
      horizon: allowedHorizon,
      instrumentId: plan.instrumentId,
      direction: plan.direction,
      entryPrice: Number(entryMark.toFixed(4)),
      stopLoss: Number(stopLoss.toFixed(4)),
      takeProfit: Number(takeProfit.toFixed(4)),
      lots,
      riskDollars,
      rewardToRiskRatio: effectiveRr,
      position,
    });

    planDecisions.push({
      planKey,
      planId: plan.id,
      horizon: allowedHorizon,
      instrumentId: plan.instrumentId,
      direction: plan.direction,
      decision: config.enabled ? 'EXECUTED' : 'WOULD_OPEN',
      reason: `${
        config.enabled ? 'Simulated paper entry triggered' : 'Ready (Pilot Paused)'
      }: ${lots.toFixed(2)} lots (${config.riskPctPerTrade.toFixed(
        2
      )}% risk · R:R ${effectiveRr.toFixed(2)}:1).`,
    });
  }

  return {
    config,
    isEnabled: config.enabled,
    evaluatedAt: nowIso,
    openPositionsCount,
    remainingCapacitySlots,
    currentDailyPnlUsd,
    currentDailyDrawdownPct,
    circuitBreakerTripped,
    exitsToClose,
    entriesToOpen,
    planDecisions,
  };
}

// =====================================================================
// DAILY PROFIT/LOSS & ACCOUNT BALANCE PROGRESSION ENGINE
// =====================================================================

export type DailyPnlScopeMode = 'ALL_EXECUTED' | 'CLOSED_ONLY';
export type DailyPnlSeriesMode = 'ACCOUNT_BALANCE' | 'CUMULATIVE_PNL' | 'DAILY_NET';

export interface DailyProfitLossPoint {
  pointIndex: number;
  dateKey: string; // YYYY-MM-DD UTC
  dateLabel: string; // e.g., "Nov 01"
  tradesCount: number;
  winsCount: number;
  lossesCount: number;
  dailyRealizedPnlUsd: number;
  dailyOpenMtmUsd: number;
  dailyTotalPnlUsd: number;
  cumulativePnlUsd: number;
  accountBalanceUsd: number;
  highWaterMarkBalanceUsd: number;
  drawdownFromPeakUsd: number;
  drawdownFromPeakPct: number;
  dailyReturnPct: number;
  positionIds: string[];
}

export interface DailyProfitLossSummary {
  scope: DailyPnlScopeMode;
  startingCapitalUsd: number;
  endingBalanceUsd: number;
  netPnlUsd: number;
  totalReturnPct: number;
  peakBalanceUsd: number;
  maxDrawdownUsd: number;
  maxDrawdownPct: number;
  tradingDaysCount: number;
  profitableDaysCount: number;
  losingDaysCount: number;
  dailyWinRatePct: number;
  bestDay: DailyProfitLossPoint | null;
  worstDay: DailyProfitLossPoint | null;
  points: DailyProfitLossPoint[];
  growthInsight: string;
}

/**
 * Aggregates executed paper positions into chronological daily Profit/Loss buckets
 * and computes cumulative account balance, high-water mark, and drawdown progression.
 */
export function buildDailyProfitLossSeries(
  positions: PaperPosition[],
  options: {
    startingCapitalUsd?: number;
    scope?: DailyPnlScopeMode;
    quotes?: Record<string, Quote>;
    defaultQuote?: Quote;
  } = {}
): DailyProfitLossSummary {
  const startingCapitalUsd =
    typeof options.startingCapitalUsd === 'number' &&
    Number.isFinite(options.startingCapitalUsd) &&
    options.startingCapitalUsd > 0
      ? Number(options.startingCapitalUsd.toFixed(2))
      : 100000;
  const scope: DailyPnlScopeMode = options.scope ?? 'ALL_EXECUTED';

  const eligible = (Array.isArray(positions) ? positions : []).filter((pos) => {
    if (!pos || pos.status === 'CANCELLED') return false;
    if (scope === 'CLOSED_ONLY') {
      return pos.status === 'CLOSED_PROFIT' || pos.status === 'CLOSED_LOSS';
    }
    return true;
  });

  if (eligible.length === 0) {
    return {
      scope,
      startingCapitalUsd,
      endingBalanceUsd: startingCapitalUsd,
      netPnlUsd: 0,
      totalReturnPct: 0,
      peakBalanceUsd: startingCapitalUsd,
      maxDrawdownUsd: 0,
      maxDrawdownPct: 0,
      tradingDaysCount: 0,
      profitableDaysCount: 0,
      losingDaysCount: 0,
      dailyWinRatePct: 0,
      bestDay: null,
      worstDay: null,
      points: [],
      growthInsight:
        'No matching paper positions in the active cycle to chart Daily Profit/Loss & account balance growth.',
    };
  }

  const resolveMark = (pos: PaperPosition): number => {
    const mapped = options.quotes?.[pos.instrumentId]?.mid;
    if (typeof mapped === 'number' && Number.isFinite(mapped) && mapped > 0) {
      return mapped;
    }
    if (
      options.defaultQuote &&
      options.defaultQuote.mid > 0 &&
      (pos.instrumentId === options.defaultQuote.instrumentId || pos.instrumentId === 'XAUUSD')
    ) {
      return options.defaultQuote.mid;
    }
    return Number.isFinite(pos.currentPrice) && pos.currentPrice > 0
      ? pos.currentPrice
      : pos.entryPrice;
  };

  interface DayBucket {
    dateKey: string;
    timestampMs: number;
    tradesCount: number;
    winsCount: number;
    lossesCount: number;
    realizedPnlUsd: number;
    openMtmUsd: number;
    positionIds: string[];
  }

  const buckets = new Map<string, DayBucket>();

  for (const pos of eligible) {
    const parsedMs = Date.parse(pos.openTime);
    const validMs = Number.isFinite(parsedMs) ? parsedMs : Date.now();
    const dateKey = new Date(validMs).toISOString().slice(0, 10);

    let pnlUsd = Number(pos.realizedPnl) || 0;
    let isOpen = false;
    if (pos.status === 'OPEN') {
      isOpen = true;
      const mark = resolveMark(pos);
      const delta = pos.direction === 'SELL' ? pos.entryPrice - mark : mark - pos.entryPrice;
      pnlUsd = delta * pos.lots * getInstrumentMultiplierForMae(pos.instrumentId);
    }

    const existing = buckets.get(dateKey) || {
      dateKey,
      timestampMs: Date.parse(`${dateKey}T00:00:00.000Z`),
      tradesCount: 0,
      winsCount: 0,
      lossesCount: 0,
      realizedPnlUsd: 0,
      openMtmUsd: 0,
      positionIds: [],
    };

    existing.tradesCount += 1;
    if (pnlUsd >= 0) {
      existing.winsCount += 1;
    } else {
      existing.lossesCount += 1;
    }
    if (isOpen) {
      existing.openMtmUsd += pnlUsd;
    } else {
      existing.realizedPnlUsd += pnlUsd;
    }
    existing.positionIds.push(pos.id);
    buckets.set(dateKey, existing);
  }

  const sortedDays = Array.from(buckets.values()).sort((a, b) =>
    a.dateKey.localeCompare(b.dateKey)
  );

  let cumulativePnlUsd = 0;
  let runningBalanceUsd = startingCapitalUsd;
  let highWaterMarkUsd = startingCapitalUsd;
  let maxDrawdownUsd = 0;
  let maxDrawdownPct = 0;
  let profitableDaysCount = 0;
  let losingDaysCount = 0;

  const points: DailyProfitLossPoint[] = sortedDays.map((day, idx) => {
    const prevBalanceUsd = runningBalanceUsd;
    const dailyRealizedPnlUsd = Number(day.realizedPnlUsd.toFixed(2));
    const dailyOpenMtmUsd = Number(day.openMtmUsd.toFixed(2));
    const dailyTotalPnlUsd = Number((dailyRealizedPnlUsd + dailyOpenMtmUsd).toFixed(2));

    if (dailyTotalPnlUsd >= 0) {
      profitableDaysCount += 1;
    } else {
      losingDaysCount += 1;
    }

    cumulativePnlUsd = Number((cumulativePnlUsd + dailyTotalPnlUsd).toFixed(2));
    runningBalanceUsd = Number((startingCapitalUsd + cumulativePnlUsd).toFixed(2));

    if (runningBalanceUsd > highWaterMarkUsd) {
      highWaterMarkUsd = runningBalanceUsd;
    }

    const drawdownFromPeakUsd = Number(
      Math.max(0, highWaterMarkUsd - runningBalanceUsd).toFixed(2)
    );
    const drawdownFromPeakPct =
      highWaterMarkUsd > 0
        ? Number(((drawdownFromPeakUsd / highWaterMarkUsd) * 100).toFixed(2))
        : 0;

    if (drawdownFromPeakUsd > maxDrawdownUsd) {
      maxDrawdownUsd = drawdownFromPeakUsd;
    }
    if (drawdownFromPeakPct > maxDrawdownPct) {
      maxDrawdownPct = drawdownFromPeakPct;
    }

    const dailyReturnPct =
      prevBalanceUsd > 0
        ? Number(((dailyTotalPnlUsd / prevBalanceUsd) * 100).toFixed(2))
        : 0;

    return {
      pointIndex: idx + 1,
      dateKey: day.dateKey,
      dateLabel: formatShortUtcDate(day.timestampMs),
      tradesCount: day.tradesCount,
      winsCount: day.winsCount,
      lossesCount: day.lossesCount,
      dailyRealizedPnlUsd,
      dailyOpenMtmUsd,
      dailyTotalPnlUsd,
      cumulativePnlUsd,
      accountBalanceUsd: runningBalanceUsd,
      highWaterMarkBalanceUsd: Number(highWaterMarkUsd.toFixed(2)),
      drawdownFromPeakUsd,
      drawdownFromPeakPct,
      dailyReturnPct,
      positionIds: day.positionIds,
    };
  });

  const bestDay = points.reduce<DailyProfitLossPoint | null>(
    (best, cur) => (!best || cur.dailyTotalPnlUsd > best.dailyTotalPnlUsd ? cur : best),
    null
  );
  const worstDay = points.reduce<DailyProfitLossPoint | null>(
    (worst, cur) => (!worst || cur.dailyTotalPnlUsd < worst.dailyTotalPnlUsd ? cur : worst),
    null
  );

  const endingBalanceUsd = runningBalanceUsd;
  const netPnlUsd = cumulativePnlUsd;
  const totalReturnPct = Number(((netPnlUsd / startingCapitalUsd) * 100).toFixed(2));
  const dailyWinRatePct =
    points.length > 0 ? Number(((profitableDaysCount / points.length) * 100).toFixed(1)) : 0;

  const netSign = netPnlUsd >= 0 ? '+' : '-';
  const growthInsight =
    netPnlUsd >= 0
      ? `Account equity grew ${netSign}$${Math.abs(netPnlUsd).toLocaleString()} (+${totalReturnPct.toFixed(
          2
        )}%) to $${endingBalanceUsd.toLocaleString()} across ${
          points.length
        } trading day(s), finishing ${profitableDaysCount}/${points.length} days green with ${maxDrawdownPct.toFixed(
          2
        )}% max drawdown.`
      : `Account balance sits at $${endingBalanceUsd.toLocaleString()} (${netSign}$${Math.abs(
          netPnlUsd
        ).toLocaleString()}, ${totalReturnPct.toFixed(2)}%) across ${
          points.length
        } trading day(s), with ${maxDrawdownPct.toFixed(2)}% peak-to-trough drawdown.`;

  return {
    scope,
    startingCapitalUsd,
    endingBalanceUsd,
    netPnlUsd,
    totalReturnPct,
    peakBalanceUsd: Number(highWaterMarkUsd.toFixed(2)),
    maxDrawdownUsd,
    maxDrawdownPct,
    tradingDaysCount: points.length,
    profitableDaysCount,
    losingDaysCount,
    dailyWinRatePct,
    bestDay,
    worstDay,
    points,
    growthInsight,
  };
}

// =====================================================================
// DAILY PORTFOLIO ROI (%) & COMPOUND GROWTH ENGINE
// =====================================================================

export type DailyRoiViewMode = 'COMPOUND_ROI' | 'DAILY_ROIC' | 'DAILY_EQUITY_ROI';

export interface DailyPortfolioRoiPoint {
  pointIndex: number;
  dateKey: string; // YYYY-MM-DD UTC
  dateLabel: string;
  tradesCount: number;
  dailyPnlUsd: number;
  cumulativePnlUsd: number;
  dailyInvestedCapitalUsd: number;
  dailyNotionalUsd: number;
  dailyReturnOnInvestedCapitalPct: number;
  dailyEquityReturnPct: number;
  compoundGrowthFactor: number;
  compoundPortfolioRoiPct: number;
  cumulativeCapitalEfficiencyRoiPct: number;
  accountBalanceUsd: number;
}

export interface DailyPortfolioRoiSummary {
  scope: DailyPnlScopeMode;
  assumedLeverage: number;
  startingCapitalUsd: number;
  endingBalanceUsd: number;
  compoundPortfolioRoiPct: number;
  totalInvestedCapitalUsd: number;
  totalInvestedCapitalRoiPct: number;
  avgDailyRoicPct: number;
  geometricMeanDailyReturnPct: number;
  tradingDaysCount: number;
  bestRoicDay: DailyPortfolioRoiPoint | null;
  worstRoicDay: DailyPortfolioRoiPoint | null;
  points: DailyPortfolioRoiPoint[];
  compoundInsight: string;
}

/**
 * Computes daily percentage Return on Invested Capital (margin committed per trade)
 * alongside geometric compound portfolio ROI (%) progression over UTC trading days.
 */
export function buildDailyPortfolioRoiSeries(
  positions: PaperPosition[],
  options: {
    startingCapitalUsd?: number;
    assumedLeverage?: number;
    scope?: DailyPnlScopeMode;
    quotes?: Record<string, Quote>;
    defaultQuote?: Quote;
  } = {}
): DailyPortfolioRoiSummary {
  const startingCapitalUsd =
    typeof options.startingCapitalUsd === 'number' &&
    Number.isFinite(options.startingCapitalUsd) &&
    options.startingCapitalUsd > 0
      ? Number(options.startingCapitalUsd.toFixed(2))
      : 100000;
  const assumedLeverage =
    typeof options.assumedLeverage === 'number' &&
    Number.isFinite(options.assumedLeverage) &&
    options.assumedLeverage > 0
      ? Math.min(200, Math.max(1, options.assumedLeverage))
      : 30;
  const scope: DailyPnlScopeMode = options.scope ?? 'ALL_EXECUTED';

  const eligible = (Array.isArray(positions) ? positions : []).filter((pos) => {
    if (!pos || pos.status === 'CANCELLED') return false;
    if (scope === 'CLOSED_ONLY') {
      return pos.status === 'CLOSED_PROFIT' || pos.status === 'CLOSED_LOSS';
    }
    return true;
  });

  if (eligible.length === 0) {
    return {
      scope,
      assumedLeverage,
      startingCapitalUsd,
      endingBalanceUsd: startingCapitalUsd,
      compoundPortfolioRoiPct: 0,
      totalInvestedCapitalUsd: 0,
      totalInvestedCapitalRoiPct: 0,
      avgDailyRoicPct: 0,
      geometricMeanDailyReturnPct: 0,
      tradingDaysCount: 0,
      bestRoicDay: null,
      worstRoicDay: null,
      points: [],
      compoundInsight:
        'No matching executed positions in the active window to calculate Daily Portfolio ROI (%) and compound growth.',
    };
  }

  const resolveMark = (pos: PaperPosition): number => {
    const mapped = options.quotes?.[pos.instrumentId]?.mid;
    if (typeof mapped === 'number' && Number.isFinite(mapped) && mapped > 0) {
      return mapped;
    }
    if (
      options.defaultQuote &&
      options.defaultQuote.mid > 0 &&
      (pos.instrumentId === options.defaultQuote.instrumentId || pos.instrumentId === 'XAUUSD')
    ) {
      return options.defaultQuote.mid;
    }
    return Number.isFinite(pos.currentPrice) && pos.currentPrice > 0
      ? pos.currentPrice
      : pos.entryPrice;
  };

  interface RoiDayBucket {
    dateKey: string;
    timestampMs: number;
    tradesCount: number;
    pnlUsd: number;
    investedCapitalUsd: number;
    notionalUsd: number;
  }

  const buckets = new Map<string, RoiDayBucket>();

  for (const pos of eligible) {
    const parsedMs = Date.parse(pos.openTime);
    const validMs = Number.isFinite(parsedMs) ? parsedMs : Date.now();
    const dateKey = new Date(validMs).toISOString().slice(0, 10);
    const multiplier = getInstrumentMultiplierForMae(pos.instrumentId);

    let pnlUsd = Number(pos.realizedPnl) || 0;
    if (pos.status === 'OPEN') {
      const mark = resolveMark(pos);
      const delta = pos.direction === 'SELL' ? pos.entryPrice - mark : mark - pos.entryPrice;
      pnlUsd = delta * pos.lots * multiplier;
    }

    const notionalUsd = Math.max(100, Math.abs(pos.entryPrice) * Math.abs(pos.lots) * multiplier);
    const marginUsd = notionalUsd / assumedLeverage;

    const existing = buckets.get(dateKey) || {
      dateKey,
      timestampMs: Date.parse(`${dateKey}T00:00:00.000Z`),
      tradesCount: 0,
      pnlUsd: 0,
      investedCapitalUsd: 0,
      notionalUsd: 0,
    };

    existing.tradesCount += 1;
    existing.pnlUsd += pnlUsd;
    existing.investedCapitalUsd += marginUsd;
    existing.notionalUsd += notionalUsd;
    buckets.set(dateKey, existing);
  }

  const sortedDays = Array.from(buckets.values()).sort((a, b) =>
    a.dateKey.localeCompare(b.dateKey)
  );

  let cumulativePnlUsd = 0;
  let totalInvestedCapitalUsd = 0;
  let runningBalanceUsd = startingCapitalUsd;
  let compoundGrowthFactor = 1.0;

  const points: DailyPortfolioRoiPoint[] = sortedDays.map((day, idx) => {
    const prevBalanceUsd = runningBalanceUsd;
    const dailyPnlUsd = Number(day.pnlUsd.toFixed(2));
    const dailyInvestedCapitalUsd = Number(day.investedCapitalUsd.toFixed(2));
    const dailyNotionalUsd = Number(day.notionalUsd.toFixed(2));

    cumulativePnlUsd = Number((cumulativePnlUsd + dailyPnlUsd).toFixed(2));
    totalInvestedCapitalUsd = Number((totalInvestedCapitalUsd + dailyInvestedCapitalUsd).toFixed(2));
    runningBalanceUsd = Number((startingCapitalUsd + cumulativePnlUsd).toFixed(2));

    const dailyReturnOnInvestedCapitalPct =
      dailyInvestedCapitalUsd > 0
        ? Number(((dailyPnlUsd / dailyInvestedCapitalUsd) * 100).toFixed(2))
        : 0;

    const dailyEquityRatio = prevBalanceUsd > 0 ? dailyPnlUsd / prevBalanceUsd : 0;
    const dailyEquityReturnPct = Number((dailyEquityRatio * 100).toFixed(2));

    if (prevBalanceUsd > 0) {
      compoundGrowthFactor = Math.max(0, compoundGrowthFactor * (1 + dailyEquityRatio));
    }
    const compoundPortfolioRoiPct = Number(((compoundGrowthFactor - 1) * 100).toFixed(2));
    const cumulativeCapitalEfficiencyRoiPct =
      totalInvestedCapitalUsd > 0
        ? Number(((cumulativePnlUsd / totalInvestedCapitalUsd) * 100).toFixed(2))
        : 0;

    return {
      pointIndex: idx + 1,
      dateKey: day.dateKey,
      dateLabel: formatShortUtcDate(day.timestampMs),
      tradesCount: day.tradesCount,
      dailyPnlUsd,
      cumulativePnlUsd,
      dailyInvestedCapitalUsd,
      dailyNotionalUsd,
      dailyReturnOnInvestedCapitalPct,
      dailyEquityReturnPct,
      compoundGrowthFactor: Number(compoundGrowthFactor.toFixed(6)),
      compoundPortfolioRoiPct,
      cumulativeCapitalEfficiencyRoiPct,
      accountBalanceUsd: runningBalanceUsd,
    };
  });

  const bestRoicDay = points.reduce<DailyPortfolioRoiPoint | null>(
    (best, cur) =>
      !best || cur.dailyReturnOnInvestedCapitalPct > best.dailyReturnOnInvestedCapitalPct
        ? cur
        : best,
    null
  );
  const worstRoicDay = points.reduce<DailyPortfolioRoiPoint | null>(
    (worst, cur) =>
      !worst || cur.dailyReturnOnInvestedCapitalPct < worst.dailyReturnOnInvestedCapitalPct
        ? cur
        : worst,
    null
  );

  const lastPt = points[points.length - 1];
  const compoundPortfolioRoiPct = lastPt ? lastPt.compoundPortfolioRoiPct : 0;
  const totalInvestedCapitalRoiPct =
    totalInvestedCapitalUsd > 0
      ? Number(((cumulativePnlUsd / totalInvestedCapitalUsd) * 100).toFixed(2))
      : 0;
  const avgDailyRoicPct =
    points.length > 0
      ? Number(
          (
            points.reduce((acc, p) => acc + p.dailyReturnOnInvestedCapitalPct, 0) / points.length
          ).toFixed(2)
        )
      : 0;
  const geometricMeanDailyReturnPct =
    points.length > 0 && compoundGrowthFactor > 0
      ? Number(((Math.pow(compoundGrowthFactor, 1 / points.length) - 1) * 100).toFixed(2))
      : 0;

  const sign = compoundPortfolioRoiPct >= 0 ? '+' : '';
  const compoundInsight =
    compoundPortfolioRoiPct >= 0
      ? `Compounded portfolio growth reached ${sign}${compoundPortfolioRoiPct.toFixed(
          2
        )}% (${geometricMeanDailyReturnPct >= 0 ? '+' : ''}${geometricMeanDailyReturnPct.toFixed(
          2
        )}% geometric avg/day) with ${totalInvestedCapitalRoiPct.toFixed(
          2
        )}% aggregate return on $${totalInvestedCapitalUsd.toLocaleString()} invested margin capital.`
      : `Compounded portfolio ROI stands at ${compoundPortfolioRoiPct.toFixed(
          2
        )}% (${geometricMeanDailyReturnPct.toFixed(
          2
        )}% geometric avg/day) across $${totalInvestedCapitalUsd.toLocaleString()} invested margin capital.`;

  return {
    scope,
    assumedLeverage,
    startingCapitalUsd,
    endingBalanceUsd: runningBalanceUsd,
    compoundPortfolioRoiPct,
    totalInvestedCapitalUsd,
    totalInvestedCapitalRoiPct,
    avgDailyRoicPct,
    geometricMeanDailyReturnPct,
    tradingDaysCount: points.length,
    bestRoicDay,
    worstRoicDay,
    points,
    compoundInsight,
  };
}

// =====================================================================
// PERFORMANCE INSIGHTS WORKSPACE ANALYTICS ENGINE
// Win/Loss Ratio · Cumulative ROI Over Time · Average Trade Duration
// =====================================================================

export interface PerformanceInsightsTradeRow {
  id: string;
  instrumentId: InstrumentId;
  horizon: HorizonCategory;
  direction: 'BUY' | 'SELL';
  status: PaperPosition['status'];
  isWin: boolean;
  openTime: string;
  closeTime?: string;
  holdingHours: number;
  holdingLabel: string;
  pnlUsd: number;
  tradeRoiPct: number;
  entryPrice: number;
  exitPrice: number;
}

export interface PerformanceInsightsCumulativeRoiPoint {
  pointIndex: number;
  dateKey: string;
  dateLabel: string;
  tradesCount: number;
  dailyPnlUsd: number;
  cumulativePnlUsd: number;
  cumulativeEquityRoiPct: number;
  compoundRoiPct: number;
  accountBalanceUsd: number;
}

export interface PerformanceInsightsWinLossSlice {
  name: string;
  outcome: 'WIN' | 'LOSS';
  count: number;
  sharePct: number;
  totalPnlUsd: number;
  avgPnlUsd: number;
  fill: string;
}

export interface PerformanceInsightsHorizonBreakdown {
  horizon: HorizonCategory;
  label: string;
  tradesCount: number;
  wins: number;
  losses: number;
  winRatePct: number;
  winLossRatio: number | null;
  netPnlUsd: number;
  avgDurationHours: number;
  avgWinDurationHours: number;
  avgLossDurationHours: number;
}

export interface PerformanceInsightsDurationBucket {
  bucketId: 'SCALP_UNDER_4H' | 'INTRADAY_4_24H' | 'SWING_1_5D' | 'POSITION_OVER_5D';
  label: string;
  tradesCount: number;
  wins: number;
  losses: number;
  winRatePct: number;
  totalPnlUsd: number;
  avgPnlUsd: number;
}

export interface PerformanceInsightsReport {
  scope: DailyPnlScopeMode;
  horizonFilter: SelectedHorizonFilter;
  startingCapitalUsd: number;
  endingBalanceUsd: number;
  totalTrades: number;
  openTradesCount: number;
  closedTradesCount: number;
  winCount: number;
  lossCount: number;
  winRatePct: number;
  lossRatePct: number;
  winLossRatio: number | null;
  winLossRatioLabel: string;
  profitFactor: number;
  netPnlUsd: number;
  cumulativeEquityRoiPct: number;
  compoundRoiPct: number;
  avgDurationHours: number;
  avgDurationLabel: string;
  medianDurationHours: number;
  medianDurationLabel: string;
  avgWinDurationHours: number;
  avgWinDurationLabel: string;
  avgLossDurationHours: number;
  avgLossDurationLabel: string;
  winLossBreakdown: PerformanceInsightsWinLossSlice[];
  winLossByHorizon: PerformanceInsightsHorizonBreakdown[];
  cumulativeRoiSeries: PerformanceInsightsCumulativeRoiPoint[];
  durationByHorizon: PerformanceInsightsHorizonBreakdown[];
  durationBuckets: PerformanceInsightsDurationBucket[];
  trades: PerformanceInsightsTradeRow[];
  summaryInsight: string;
}

export function formatDurationHours(hours: number): string {
  if (!Number.isFinite(hours) || hours <= 0) return '0m';
  if (hours < 1) {
    return `${Math.max(1, Math.round(hours * 60))}m`;
  }
  if (hours < 24) {
    return `${hours.toFixed(1)}h`;
  }
  const days = Math.floor(hours / 24);
  const remHours = Math.round(hours % 24);
  return remHours > 0 ? `${days}d ${remHours}h` : `${days}d`;
}

export function buildPerformanceInsightsReport(
  positions: PaperPosition[],
  options: {
    scope?: DailyPnlScopeMode;
    horizonFilter?: SelectedHorizonFilter;
    startingCapitalUsd?: number;
    assumedLeverage?: number;
    quotes?: Record<string, Quote>;
    defaultQuote?: Quote;
    nowMs?: number;
  } = {}
): PerformanceInsightsReport {
  const scope: DailyPnlScopeMode = options.scope ?? 'ALL_EXECUTED';
  const horizonFilter: SelectedHorizonFilter = options.horizonFilter ?? 'ALL';
  const startingCapitalUsd =
    typeof options.startingCapitalUsd === 'number' &&
    Number.isFinite(options.startingCapitalUsd) &&
    options.startingCapitalUsd > 0
      ? Number(options.startingCapitalUsd.toFixed(2))
      : 100000;
  const assumedLeverage =
    typeof options.assumedLeverage === 'number' &&
    Number.isFinite(options.assumedLeverage) &&
    options.assumedLeverage > 0
      ? options.assumedLeverage
      : 30;

  const eligible = (Array.isArray(positions) ? positions : [])
    .filter((pos) => pos && pos.status !== 'CANCELLED')
    .filter((pos) =>
      scope === 'CLOSED_ONLY'
        ? pos.status === 'CLOSED_PROFIT' || pos.status === 'CLOSED_LOSS'
        : true
    )
    .filter((pos) =>
      horizonFilter === 'ALL' ? true : resolvePositionAdvisoryHorizon(pos) === horizonFilter
    )
    .sort((a, b) => Date.parse(a.openTime) - Date.parse(b.openTime));

  const emptyHorizons: PerformanceInsightsHorizonBreakdown[] = [
    {
      horizon: 'INTRADAY',
      label: 'Intraday',
      tradesCount: 0,
      wins: 0,
      losses: 0,
      winRatePct: 0,
      winLossRatio: null,
      netPnlUsd: 0,
      avgDurationHours: 0,
      avgWinDurationHours: 0,
      avgLossDurationHours: 0,
    },
    {
      horizon: 'SWING',
      label: 'Swing',
      tradesCount: 0,
      wins: 0,
      losses: 0,
      winRatePct: 0,
      winLossRatio: null,
      netPnlUsd: 0,
      avgDurationHours: 0,
      avgWinDurationHours: 0,
      avgLossDurationHours: 0,
    },
    {
      horizon: 'LONG_TERM',
      label: 'Long Term',
      tradesCount: 0,
      wins: 0,
      losses: 0,
      winRatePct: 0,
      winLossRatio: null,
      netPnlUsd: 0,
      avgDurationHours: 0,
      avgWinDurationHours: 0,
      avgLossDurationHours: 0,
    },
  ];

  const emptyBuckets: PerformanceInsightsDurationBucket[] = [
    { bucketId: 'SCALP_UNDER_4H', label: '< 4h', tradesCount: 0, wins: 0, losses: 0, winRatePct: 0, totalPnlUsd: 0, avgPnlUsd: 0 },
    { bucketId: 'INTRADAY_4_24H', label: '4h – 24h', tradesCount: 0, wins: 0, losses: 0, winRatePct: 0, totalPnlUsd: 0, avgPnlUsd: 0 },
    { bucketId: 'SWING_1_5D', label: '1d – 5d', tradesCount: 0, wins: 0, losses: 0, winRatePct: 0, totalPnlUsd: 0, avgPnlUsd: 0 },
    { bucketId: 'POSITION_OVER_5D', label: '> 5d', tradesCount: 0, wins: 0, losses: 0, winRatePct: 0, totalPnlUsd: 0, avgPnlUsd: 0 },
  ];

  if (eligible.length === 0) {
    return {
      scope,
      horizonFilter,
      startingCapitalUsd,
      endingBalanceUsd: startingCapitalUsd,
      totalTrades: 0,
      openTradesCount: 0,
      closedTradesCount: 0,
      winCount: 0,
      lossCount: 0,
      winRatePct: 0,
      lossRatePct: 0,
      winLossRatio: null,
      winLossRatioLabel: '0 : 0',
      profitFactor: 0,
      netPnlUsd: 0,
      cumulativeEquityRoiPct: 0,
      compoundRoiPct: 0,
      avgDurationHours: 0,
      avgDurationLabel: '0m',
      medianDurationHours: 0,
      medianDurationLabel: '0m',
      avgWinDurationHours: 0,
      avgWinDurationLabel: '0m',
      avgLossDurationHours: 0,
      avgLossDurationLabel: '0m',
      winLossBreakdown: [
        { name: 'Winning Trades', outcome: 'WIN', count: 0, sharePct: 0, totalPnlUsd: 0, avgPnlUsd: 0, fill: '#10b981' },
        { name: 'Losing Trades', outcome: 'LOSS', count: 0, sharePct: 0, totalPnlUsd: 0, avgPnlUsd: 0, fill: '#f43f5e' },
      ],
      winLossByHorizon: emptyHorizons,
      cumulativeRoiSeries: [],
      durationByHorizon: emptyHorizons,
      durationBuckets: emptyBuckets,
      trades: [],
      summaryInsight:
        'No executed paper trades match the selected scope and timeframe filters yet.',
    };
  }

  const resolveMark = (pos: PaperPosition): number => {
    const mapped = options.quotes?.[pos.instrumentId]?.mid;
    if (typeof mapped === 'number' && Number.isFinite(mapped) && mapped > 0) {
      return mapped;
    }
    if (
      options.defaultQuote &&
      options.defaultQuote.mid > 0 &&
      (pos.instrumentId === options.defaultQuote.instrumentId || pos.instrumentId === 'XAUUSD')
    ) {
      return options.defaultQuote.mid;
    }
    return Number.isFinite(pos.currentPrice) && pos.currentPrice > 0
      ? pos.currentPrice
      : pos.entryPrice;
  };

  const latestOpenMs = eligible.reduce((mx, p) => {
    const t = Date.parse(p.openTime);
    return Number.isFinite(t) && t > mx ? t : mx;
  }, 0);
  const nowMs =
    typeof options.nowMs === 'number' && Number.isFinite(options.nowMs)
      ? options.nowMs
      : Math.max(Date.now(), latestOpenMs + 3600_000);

  let openTradesCount = 0;
  let closedTradesCount = 0;
  let winCount = 0;
  let lossCount = 0;
  let grossWinUsd = 0;
  let grossLossAbsUsd = 0;
  let netPnlUsd = 0;

  const winDurations: number[] = [];
  const lossDurations: number[] = [];
  const allDurations: number[] = [];

  const horizonAccum = new Map<
    HorizonCategory,
    {
      label: string;
      tradesCount: number;
      wins: number;
      losses: number;
      netPnlUsd: number;
      durations: number[];
      winDurations: number[];
      lossDurations: number[];
    }
  >([
    ['INTRADAY', { label: 'Intraday', tradesCount: 0, wins: 0, losses: 0, netPnlUsd: 0, durations: [], winDurations: [], lossDurations: [] }],
    ['SWING', { label: 'Swing', tradesCount: 0, wins: 0, losses: 0, netPnlUsd: 0, durations: [], winDurations: [], lossDurations: [] }],
    ['LONG_TERM', { label: 'Long Term', tradesCount: 0, wins: 0, losses: 0, netPnlUsd: 0, durations: [], winDurations: [], lossDurations: [] }],
  ]);

  const bucketAccum = new Map<
    PerformanceInsightsDurationBucket['bucketId'],
    { label: string; tradesCount: number; wins: number; losses: number; totalPnlUsd: number }
  >([
    ['SCALP_UNDER_4H', { label: '< 4h', tradesCount: 0, wins: 0, losses: 0, totalPnlUsd: 0 }],
    ['INTRADAY_4_24H', { label: '4h – 24h', tradesCount: 0, wins: 0, losses: 0, totalPnlUsd: 0 }],
    ['SWING_1_5D', { label: '1d – 5d', tradesCount: 0, wins: 0, losses: 0, totalPnlUsd: 0 }],
    ['POSITION_OVER_5D', { label: '> 5d', tradesCount: 0, wins: 0, losses: 0, totalPnlUsd: 0 }],
  ]);

  const tradeRows: PerformanceInsightsTradeRow[] = eligible.map((pos, idx) => {
    const horizon = resolvePositionAdvisoryHorizon(pos);
    const multiplier = getInstrumentMultiplierForMae(pos.instrumentId);

    const parsedOpenMs = Date.parse(pos.openTime);
    const entryMs = Number.isFinite(parsedOpenMs) ? parsedOpenMs : nowMs - (eligible.length - idx) * 86400_000;
    const explicitCloseMs = pos.closeTime ? Date.parse(pos.closeTime) : NaN;

    let holdingHours: number;
    if (Number.isFinite(explicitCloseMs) && explicitCloseMs >= entryMs) {
      holdingHours = Math.max(0.05, (explicitCloseMs - entryMs) / 3600_000);
    } else if (pos.status === 'OPEN') {
      holdingHours = Math.max(0.05, (nowMs - entryMs) / 3600_000);
    } else {
      const nextOpenMs =
        idx < eligible.length - 1 ? Date.parse(eligible[idx + 1].openTime) : nowMs;
      const defaultHoldMs = getDefaultHorizonHoldingHours(horizon) * 3600_000;
      const gapToNext = Number.isFinite(nextOpenMs)
        ? Math.max(4 * 3600_000, nextOpenMs - entryMs - 2 * 3600_000)
        : defaultHoldMs;
      holdingHours = Math.max(0.5, Math.min(defaultHoldMs, gapToNext) / 3600_000);
    }
    holdingHours = Number(holdingHours.toFixed(2));

    let exitPrice = pos.currentPrice;
    let pnlUsd = Number(pos.realizedPnl) || 0;
    if (pos.status === 'OPEN') {
      openTradesCount += 1;
      exitPrice = resolveMark(pos);
      const delta = pos.direction === 'SELL' ? pos.entryPrice - exitPrice : exitPrice - pos.entryPrice;
      pnlUsd = delta * pos.lots * multiplier;
    } else {
      closedTradesCount += 1;
    }

    const roundedPnl = Number(pnlUsd.toFixed(2));
    const isWin =
      pos.status === 'CLOSED_PROFIT' ? true : pos.status === 'CLOSED_LOSS' ? false : roundedPnl >= 0;

    netPnlUsd += roundedPnl;
    allDurations.push(holdingHours);

    if (isWin) {
      winCount += 1;
      grossWinUsd += Math.max(0, roundedPnl);
      winDurations.push(holdingHours);
    } else {
      lossCount += 1;
      grossLossAbsUsd += Math.abs(Math.min(0, roundedPnl));
      lossDurations.push(holdingHours);
    }

    const hAccum = horizonAccum.get(horizon)!;
    hAccum.tradesCount += 1;
    hAccum.netPnlUsd += roundedPnl;
    hAccum.durations.push(holdingHours);
    if (isWin) {
      hAccum.wins += 1;
      hAccum.winDurations.push(holdingHours);
    } else {
      hAccum.losses += 1;
      hAccum.lossDurations.push(holdingHours);
    }

    const bucketId: PerformanceInsightsDurationBucket['bucketId'] =
      holdingHours < 4
        ? 'SCALP_UNDER_4H'
        : holdingHours < 24
        ? 'INTRADAY_4_24H'
        : holdingHours <= 120
        ? 'SWING_1_5D'
        : 'POSITION_OVER_5D';
    const bAccum = bucketAccum.get(bucketId)!;
    bAccum.tradesCount += 1;
    bAccum.totalPnlUsd += roundedPnl;
    if (isWin) bAccum.wins += 1;
    else bAccum.losses += 1;

    return {
      id: pos.id,
      instrumentId: pos.instrumentId,
      horizon,
      direction: pos.direction,
      status: pos.status,
      isWin,
      openTime: pos.openTime,
      closeTime: pos.closeTime,
      holdingHours,
      holdingLabel: formatDurationHours(holdingHours),
      pnlUsd: roundedPnl,
      tradeRoiPct: Number(((roundedPnl / startingCapitalUsd) * 100).toFixed(2)),
      entryPrice: Number(pos.entryPrice.toFixed(2)),
      exitPrice: Number(exitPrice.toFixed(2)),
    };
  });

  const avgOf = (arr: number[]): number =>
    arr.length > 0 ? Number((arr.reduce((s, v) => s + v, 0) / arr.length).toFixed(2)) : 0;

  const sortedDurations = [...allDurations].sort((a, b) => a - b);
  const midIdx = Math.floor(sortedDurations.length / 2);
  const medianDurationHours =
    sortedDurations.length === 0
      ? 0
      : sortedDurations.length % 2 === 1
      ? sortedDurations[midIdx]
      : Number(((sortedDurations[midIdx - 1] + sortedDurations[midIdx]) / 2).toFixed(2));

  const totalTrades = tradeRows.length;
  const winRatePct = Number(((winCount / totalTrades) * 100).toFixed(1));
  const lossRatePct = Number((100 - winRatePct).toFixed(1));
  const winLossRatio =
    lossCount > 0 ? Number((winCount / lossCount).toFixed(2)) : winCount > 0 ? null : 0;
  const winLossRatioLabel =
    lossCount > 0
      ? `${(winCount / lossCount).toFixed(2)} : 1`
      : winCount > 0
      ? `${winCount} : 0`
      : '0 : 0';
  const profitFactor =
    grossLossAbsUsd > 0
      ? Number((grossWinUsd / grossLossAbsUsd).toFixed(2))
      : grossWinUsd > 0
      ? 99.9
      : 0;

  netPnlUsd = Number(netPnlUsd.toFixed(2));
  const endingBalanceUsd = Number((startingCapitalUsd + netPnlUsd).toFixed(2));
  const cumulativeEquityRoiPct = Number(((netPnlUsd / startingCapitalUsd) * 100).toFixed(2));

  const roiSeriesSummary = buildDailyPortfolioRoiSeries(eligible, {
    startingCapitalUsd,
    assumedLeverage,
    scope,
    quotes: options.quotes,
    defaultQuote: options.defaultQuote,
  });

  const cumulativeRoiSeries: PerformanceInsightsCumulativeRoiPoint[] = roiSeriesSummary.points.map(
    (pt) => ({
      pointIndex: pt.pointIndex,
      dateKey: pt.dateKey,
      dateLabel: pt.dateLabel,
      tradesCount: pt.tradesCount,
      dailyPnlUsd: pt.dailyPnlUsd,
      cumulativePnlUsd: pt.cumulativePnlUsd,
      cumulativeEquityRoiPct: Number(
        ((pt.cumulativePnlUsd / startingCapitalUsd) * 100).toFixed(2)
      ),
      compoundRoiPct: pt.compoundPortfolioRoiPct,
      accountBalanceUsd: pt.accountBalanceUsd,
    })
  );

  const compoundRoiPct = roiSeriesSummary.compoundPortfolioRoiPct;

  const avgDurationHours = avgOf(allDurations);
  const avgWinDurationHours = avgOf(winDurations);
  const avgLossDurationHours = avgOf(lossDurations);

  const winLossBreakdown: PerformanceInsightsWinLossSlice[] = [
    {
      name: 'Winning Trades',
      outcome: 'WIN',
      count: winCount,
      sharePct: winRatePct,
      totalPnlUsd: Number(grossWinUsd.toFixed(2)),
      avgPnlUsd: winCount > 0 ? Number((grossWinUsd / winCount).toFixed(2)) : 0,
      fill: '#10b981',
    },
    {
      name: 'Losing Trades',
      outcome: 'LOSS',
      count: lossCount,
      sharePct: lossRatePct,
      totalPnlUsd: Number((-grossLossAbsUsd).toFixed(2)),
      avgPnlUsd: lossCount > 0 ? Number((-grossLossAbsUsd / lossCount).toFixed(2)) : 0,
      fill: '#f43f5e',
    },
  ];

  const horizonOrder: HorizonCategory[] = ['INTRADAY', 'SWING', 'LONG_TERM'];
  const horizonBreakdown: PerformanceInsightsHorizonBreakdown[] = horizonOrder.map((h) => {
    const rec = horizonAccum.get(h)!;
    const hWinRate =
      rec.tradesCount > 0 ? Number(((rec.wins / rec.tradesCount) * 100).toFixed(1)) : 0;
    const hRatio =
      rec.losses > 0 ? Number((rec.wins / rec.losses).toFixed(2)) : rec.wins > 0 ? rec.wins : null;
    return {
      horizon: h,
      label: rec.label,
      tradesCount: rec.tradesCount,
      wins: rec.wins,
      losses: rec.losses,
      winRatePct: hWinRate,
      winLossRatio: hRatio,
      netPnlUsd: Number(rec.netPnlUsd.toFixed(2)),
      avgDurationHours: avgOf(rec.durations),
      avgWinDurationHours: avgOf(rec.winDurations),
      avgLossDurationHours: avgOf(rec.lossDurations),
    };
  });

  const durationBuckets: PerformanceInsightsDurationBucket[] = Array.from(
    bucketAccum.entries()
  ).map(([bucketId, rec]) => ({
    bucketId,
    label: rec.label,
    tradesCount: rec.tradesCount,
    wins: rec.wins,
    losses: rec.losses,
    winRatePct:
      rec.tradesCount > 0 ? Number(((rec.wins / rec.tradesCount) * 100).toFixed(1)) : 0,
    totalPnlUsd: Number(rec.totalPnlUsd.toFixed(2)),
    avgPnlUsd:
      rec.tradesCount > 0 ? Number((rec.totalPnlUsd / rec.tradesCount).toFixed(2)) : 0,
  }));

  const avgDurationLabel = formatDurationHours(avgDurationHours);
  const medianDurationLabel = formatDurationHours(medianDurationHours);
  const avgWinDurationLabel = formatDurationHours(avgWinDurationHours);
  const avgLossDurationLabel = formatDurationHours(avgLossDurationHours);

  const roiSign = cumulativeEquityRoiPct >= 0 ? '+' : '';
  const summaryInsight = `Across ${totalTrades} paper trade(s) (${winCount}W / ${lossCount}L, Win/Loss Ratio ${winLossRatioLabel}), cumulative ROI is ${roiSign}${cumulativeEquityRoiPct.toFixed(
    2
  )}% with an average holding duration of ${avgDurationLabel} (winners ${avgWinDurationLabel} vs. losers ${avgLossDurationLabel}).`;

  return {
    scope,
    horizonFilter,
    startingCapitalUsd,
    endingBalanceUsd,
    totalTrades,
    openTradesCount,
    closedTradesCount,
    winCount,
    lossCount,
    winRatePct,
    lossRatePct,
    winLossRatio,
    winLossRatioLabel,
    profitFactor,
    netPnlUsd,
    cumulativeEquityRoiPct,
    compoundRoiPct,
    avgDurationHours,
    avgDurationLabel,
    medianDurationHours,
    medianDurationLabel,
    avgWinDurationHours,
    avgWinDurationLabel,
    avgLossDurationHours,
    avgLossDurationLabel,
    winLossBreakdown,
    winLossByHorizon: horizonBreakdown,
    cumulativeRoiSeries,
    durationByHorizon: horizonBreakdown,
    durationBuckets,
    trades: [...tradeRows].reverse(),
    summaryInsight,
  };
}







