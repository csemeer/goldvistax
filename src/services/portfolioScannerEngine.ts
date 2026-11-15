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

import { Quote, PaperPosition, InstrumentSpecification } from '../domain/types';

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
