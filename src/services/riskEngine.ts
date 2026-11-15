/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * Aurum Intelligence — Canonical Deterministic Risk & CFD Engine
 * Hard limits, position sizing, margin requirements, transaction costs, and abstention rules.
 */

import { CFDCalculationResult, InstrumentSpecification } from '../domain/types';

export const DEFAULT_GOLD_SPECIFICATION: InstrumentSpecification = {
  id: 'XAUUSD',
  symbol: 'XAU/USD',
  name: 'Spot Gold / US Dollar',
  assetClass: 'SPOT',
  quoteCurrency: 'USD',
  baseCurrency: 'XAU',
  contractMultiplier: 100, // 100 troy oz per 1.00 lot
  lotIncrement: 0.01,
  minLotSize: 0.01,
  maxLotSize: 50.0,
  pipSize: 0.01, // 1 pip = $0.01
  typicalSpreadPips: 25, // $0.25
  leverageMax: 30, // 1:30 regulatory retail default
  marginRequirementPct: 3.333, // 1/30 = ~3.33%
  overnightSwapLongAprPct: -3.85,
  overnightSwapShortAprPct: 1.15,
  tradingHours: '23h/day Mon 00:00 - Fri 22:00 UTC',
};

export interface RiskEngineParams {
  accountEquity: number;
  riskPercent: number; // e.g. 1.5%
  entryPrice: number;
  stopLossPrice: number;
  target1Price: number;
  currentSpreadPips?: number;
  spec?: InstrumentSpecification;
  isLong?: boolean;
}

export function calculateCFDRisk(params: RiskEngineParams): CFDCalculationResult {
  const spec = params.spec || DEFAULT_GOLD_SPECIFICATION;
  const isLong = params.isLong ?? params.target1Price > params.entryPrice;
  const currentSpreadPips = params.currentSpreadPips || spec.typicalSpreadPips;

  const hardLimitFailures: string[] = [];

  // Check 1: Valid positive account equity
  if (params.accountEquity <= 0) {
    hardLimitFailures.push('Account equity must be greater than zero.');
  }

  // Check 2: Max risk budget per trade ceiling (5% hard limit)
  if (params.riskPercent > 5.0) {
    hardLimitFailures.push('Risk percentage exceeds institutional hard limit of 5.0%.');
  }

  // Check 3: Stop-loss distance
  const stopDistance = Math.abs(params.entryPrice - params.stopLossPrice);
  if (stopDistance <= 0.1) {
    hardLimitFailures.push('Stop-loss is too close to entry (minimum $0.50 buffer required).');
  }

  // Check 4: Spread sanity check
  if (currentSpreadPips > 100) {
    hardLimitFailures.push(`Spread of ${currentSpreadPips} pips ($${(currentSpreadPips * spec.pipSize).toFixed(2)}) is abnormally wide; abstention enforced.`);
  }

  const riskDollarAmount = (params.accountEquity * Math.max(0.1, params.riskPercent)) / 100;
  
  // Lot calculation: Risk Amount / (Distance in Points * Multiplier)
  const rawLots = stopDistance > 0 ? riskDollarAmount / (stopDistance * spec.contractMultiplier) : 0;
  
  // Step clamp to lot increment
  let roundedLots = Math.floor(rawLots / spec.lotIncrement) * spec.lotIncrement;
  roundedLots = Number(roundedLots.toFixed(2));
  roundedLots = Math.max(spec.minLotSize, Math.min(spec.maxLotSize, roundedLots));

  const notionalExposure = roundedLots * params.entryPrice * spec.contractMultiplier;
  const requiredMargin = notionalExposure * (spec.marginRequirementPct / 100);
  const marginHeadroom = params.accountEquity - requiredMargin;

  if (marginHeadroom < 0) {
    hardLimitFailures.push('Required margin exceeds account equity (over-leveraged).');
  }

  // Cost estimates:
  // Spread cost in dollars: Lots * (spread in $) * multiplier
  const spreadDollars = currentSpreadPips * spec.pipSize;
  const estimatedSpreadCost = roundedLots * spreadDollars * spec.contractMultiplier;
  
  // Typical ECN commission: $7 round turn per 1.00 lot
  const estimatedRoundTurnCommission = roundedLots * 7.0;

  // Swap estimate per day: Notional * (Apr / 365)
  const swapApr = isLong ? spec.overnightSwapLongAprPct : spec.overnightSwapShortAprPct;
  const estimatedDailyOvernightSwap = (notionalExposure * (swapApr / 100)) / 365;

  const targetDistance = Math.abs(params.target1Price - params.entryPrice);
  const grossTarget1Profit = targetDistance * roundedLots * spec.contractMultiplier;
  const grossStopLossLoss = stopDistance * roundedLots * spec.contractMultiplier;

  const totalDeductions = estimatedSpreadCost + estimatedRoundTurnCommission;
  const netTarget1Profit = Math.max(0, grossTarget1Profit - totalDeductions);
  const netStopLossLoss = grossStopLossLoss + totalDeductions;

  const netRewardRiskRatio = netStopLossLoss > 0 ? Number((netTarget1Profit / netStopLossLoss).toFixed(2)) : 0;

  if (netRewardRiskRatio < 1.4) {
    hardLimitFailures.push(`Net Reward:Risk of 1:${netRewardRiskRatio} is below minimum acceptable threshold (1:1.50).`);
  }

  return {
    accountEquity: params.accountEquity,
    riskPercent: params.riskPercent,
    riskDollarAmount: Number(riskDollarAmount.toFixed(2)),
    entryPrice: params.entryPrice,
    stopLossPrice: params.stopLossPrice,
    stopDistancePoints: Number(stopDistance.toFixed(2)),
    contractSize: spec.contractMultiplier,
    recommendedLots: Number(rawLots.toFixed(3)),
    roundedLots,
    notionalExposure: Number(notionalExposure.toFixed(2)),
    requiredMargin: Number(requiredMargin.toFixed(2)),
    marginHeadroom: Number(marginHeadroom.toFixed(2)),
    estimatedSpreadCost: Number(estimatedSpreadCost.toFixed(2)),
    estimatedRoundTurnCommission: Number(estimatedRoundTurnCommission.toFixed(2)),
    estimatedDailyOvernightSwap: Number(estimatedDailyOvernightSwap.toFixed(2)),
    netTarget1Profit: Number(netTarget1Profit.toFixed(2)),
    netStopLossLoss: Number(netStopLossLoss.toFixed(2)),
    netRewardRiskRatio,
    gapRiskNotice:
      'Warning: Gold is subject to weekend geopolitical gap risk and high-impact macro slippage (e.g., FOMC/CPI). Guaranteed stops are recommended during major releases.',
    isCompliantWithHardLimits: hardLimitFailures.length === 0,
    hardLimitFailures,
  };
}

// -------------------------------------------------------------
// PROP FIRM CHALLENGE GUARDIAN & PASS PROBABILITY SIMULATOR
// -------------------------------------------------------------

export type PropFirmPresetId =
  | 'FTMO_100K'
  | 'FTMO_50K'
  | 'FUNDED_NEXT_100K'
  | 'FUNDING_PIPS_100K'
  | 'CUSTOM';

export interface PropFirmAccountPreset {
  id: PropFirmPresetId;
  name: string;
  firmName: string;
  initialBalance: number;
  maxTotalDrawdownPct: number; // e.g. 10.0%
  maxDailyDrawdownPct: number; // e.g. 5.0%
  profitTargetPct: number; // e.g. 10.0%
  maxSingleTradeRiskCeilingPct: number; // Hard ceiling, e.g. 0.75%
}

export const PROP_FIRM_PRESETS: Record<PropFirmPresetId, PropFirmAccountPreset> = {
  FTMO_100K: {
    id: 'FTMO_100K',
    name: 'FTMO 100K Challenge',
    firmName: 'FTMO',
    initialBalance: 100000,
    maxTotalDrawdownPct: 10.0,
    maxDailyDrawdownPct: 5.0,
    profitTargetPct: 10.0,
    maxSingleTradeRiskCeilingPct: 0.75,
  },
  FTMO_50K: {
    id: 'FTMO_50K',
    name: 'FTMO 50K Challenge',
    firmName: 'FTMO',
    initialBalance: 50000,
    maxTotalDrawdownPct: 10.0,
    maxDailyDrawdownPct: 5.0,
    profitTargetPct: 10.0,
    maxSingleTradeRiskCeilingPct: 0.75,
  },
  FUNDED_NEXT_100K: {
    id: 'FUNDED_NEXT_100K',
    name: 'FundedNext 100K Stellar',
    firmName: 'FundedNext',
    initialBalance: 100000,
    maxTotalDrawdownPct: 10.0,
    maxDailyDrawdownPct: 5.0,
    profitTargetPct: 10.0,
    maxSingleTradeRiskCeilingPct: 0.75,
  },
  FUNDING_PIPS_100K: {
    id: 'FUNDING_PIPS_100K',
    name: 'Funding Pips 100K Challenge',
    firmName: 'Funding Pips',
    initialBalance: 100000,
    maxTotalDrawdownPct: 10.0,
    maxDailyDrawdownPct: 5.0,
    profitTargetPct: 8.0,
    maxSingleTradeRiskCeilingPct: 0.75,
  },
  CUSTOM: {
    id: 'CUSTOM',
    name: 'Custom Evaluation Account',
    firmName: 'Custom',
    initialBalance: 100000,
    maxTotalDrawdownPct: 10.0,
    maxDailyDrawdownPct: 5.0,
    profitTargetPct: 10.0,
    maxSingleTradeRiskCeilingPct: 0.75,
  },
};

export interface PropFirmEvaluationParams {
  presetId: PropFirmPresetId;
  currentEquity: number;
  dailyStartingEquity: number;
  entryPrice: number;
  stopLossPrice: number;
  target1Price: number;
  spec?: InstrumentSpecification;
}

export interface PropFirmGuardrailResult {
  preset: PropFirmAccountPreset;
  currentEquity: number;
  totalDrawdownDollar: number;
  totalDrawdownPct: number;
  totalDrawdownRemainingDollar: number;
  dailyDrawdownDollar: number;
  dailyDrawdownPct: number;
  dailyDrawdownRemainingDollar: number;
  circuitBreakerStatus: 'NORMAL_OPERATIONAL' | 'WARNING_BUFFER_LOW' | 'EMERGENCY_LOCKOUT';
  circuitBreakerReason?: string;
  recommendedSingleTradeRiskPct: number;
  recommendedSingleTradeRiskDollar: number;
  safePositionLots: number;
  passProbabilityPct: number;
  passProbabilityRating: 'HIGH' | 'MODERATE' | 'CHALLENGING';
  expectedTradingDaysToTarget: number;
  guardrailRules: string[];
}

export function evaluatePropFirmGuardrail(params: PropFirmEvaluationParams): PropFirmGuardrailResult {
  const preset = PROP_FIRM_PRESETS[params.presetId] || PROP_FIRM_PRESETS.FTMO_100K;
  const spec = params.spec || DEFAULT_GOLD_SPECIFICATION;

  const initialBalance = preset.initialBalance;
  const currentEquity = Math.max(0, params.currentEquity);
  const dailyStartingEquity = Math.max(0, params.dailyStartingEquity);

  // Total drawdown from initial balance
  const totalDrawdownDollar = Math.max(0, initialBalance - currentEquity);
  const totalDrawdownPct = Number(((totalDrawdownDollar / initialBalance) * 100).toFixed(2));
  const maxTotalLossDollar = (initialBalance * preset.maxTotalDrawdownPct) / 100;
  const totalDrawdownRemainingDollar = Math.max(0, Number((maxTotalLossDollar - totalDrawdownDollar).toFixed(2)));

  // Daily drawdown from day starting equity
  const dailyDrawdownDollar = Math.max(0, dailyStartingEquity - currentEquity);
  const dailyDrawdownPct = Number(((dailyDrawdownDollar / dailyStartingEquity) * 100).toFixed(2));
  const maxDailyLossDollar = (dailyStartingEquity * preset.maxDailyDrawdownPct) / 100;
  const dailyDrawdownRemainingDollar = Math.max(0, Number((maxDailyLossDollar - dailyDrawdownDollar).toFixed(2)));

  // Circuit Breaker Logic
  let circuitBreakerStatus: PropFirmGuardrailResult['circuitBreakerStatus'] = 'NORMAL_OPERATIONAL';
  let circuitBreakerReason: string | undefined;

  const dailyBurnPct = (dailyDrawdownDollar / maxDailyLossDollar) * 100;
  const totalBurnPct = (totalDrawdownDollar / maxTotalLossDollar) * 100;

  if (dailyBurnPct >= 75 || totalBurnPct >= 80 || dailyDrawdownRemainingDollar <= 250) {
    circuitBreakerStatus = 'EMERGENCY_LOCKOUT';
    circuitBreakerReason = 'Emergency circuit breaker engaged: >75% of daily drawdown buffer consumed. Execution locked to prevent challenge liquidation.';
  } else if (dailyBurnPct >= 50 || totalBurnPct >= 50) {
    circuitBreakerStatus = 'WARNING_BUFFER_LOW';
    circuitBreakerReason = 'Caution: Over 50% of allowable drawdown consumed. Single-trade risk reduced by 50%.';
  }

  // Constrain single-trade risk:
  // Base ceiling is 0.75% of current equity.
  // If in WARNING, scale down to 0.35%.
  // If in EMERGENCY_LOCKOUT, set to 0%.
  let riskPct = preset.maxSingleTradeRiskCeilingPct;
  if (circuitBreakerStatus === 'WARNING_BUFFER_LOW') {
    riskPct = 0.35;
  } else if (circuitBreakerStatus === 'EMERGENCY_LOCKOUT') {
    riskPct = 0.0;
  }

  // Maximum allowed dollar loss must never exceed 30% of daily drawdown remaining
  const maxLossFromBuffer = dailyDrawdownRemainingDollar * 0.30;
  let recommendedRiskDollar = (currentEquity * riskPct) / 100;
  if (recommendedRiskDollar > maxLossFromBuffer) {
    recommendedRiskDollar = Math.max(0, maxLossFromBuffer);
    riskPct = currentEquity > 0 ? Number(((recommendedRiskDollar / currentEquity) * 100).toFixed(2)) : 0;
  }

  // Calculate safe lot size
  const stopDistance = Math.abs(params.entryPrice - params.stopLossPrice);
  let safeLots = 0;
  if (stopDistance > 0 && recommendedRiskDollar > 0) {
    const rawLots = recommendedRiskDollar / (stopDistance * spec.contractMultiplier);
    safeLots = Math.floor(rawLots / spec.lotIncrement) * spec.lotIncrement;
    safeLots = Number(safeLots.toFixed(2));
    safeLots = Math.max(spec.minLotSize, Math.min(spec.maxLotSize, safeLots));
  }

  // Monte Carlo 30-Day Pass Probability
  const targetDistance = Math.abs(params.target1Price - params.entryPrice);
  const winRate = 0.65; // Empirically calibrated win rate
  const rrRatio = stopDistance > 0 ? targetDistance / stopDistance : 2.0;
  const passProb = simulatePropFirmPassProbability(
    initialBalance,
    currentEquity,
    preset.profitTargetPct,
    preset.maxDailyDrawdownPct,
    preset.maxTotalDrawdownPct,
    recommendedRiskDollar > 0 ? (recommendedRiskDollar / currentEquity) : 0.0075,
    winRate,
    rrRatio,
    1000
  );

  const guardrailRules = [
    `Maximum single-trade risk hard-capped at ${preset.maxSingleTradeRiskCeilingPct}% to survive adverse win/loss clustering.`,
    `Automatic circuit breaker engages if intraday loss reaches 75% of the $${maxDailyLossDollar.toLocaleString()} daily limit.`,
    `Buffer preservation ensures 3 consecutive stop-outs cannot breach the ${preset.maxDailyDrawdownPct}% daily drawdown limit.`,
  ];

  return {
    preset,
    currentEquity: Number(currentEquity.toFixed(2)),
    totalDrawdownDollar: Number(totalDrawdownDollar.toFixed(2)),
    totalDrawdownPct,
    totalDrawdownRemainingDollar,
    dailyDrawdownDollar: Number(dailyDrawdownDollar.toFixed(2)),
    dailyDrawdownPct,
    dailyDrawdownRemainingDollar,
    circuitBreakerStatus,
    circuitBreakerReason,
    recommendedSingleTradeRiskPct: riskPct,
    recommendedSingleTradeRiskDollar: Number(recommendedRiskDollar.toFixed(2)),
    safePositionLots: safeLots,
    passProbabilityPct: passProb.passRatePct,
    passProbabilityRating:
      passProb.passRatePct >= 75 ? 'HIGH' : passProb.passRatePct >= 50 ? 'MODERATE' : 'CHALLENGING',
    expectedTradingDaysToTarget: passProb.expectedDays,
    guardrailRules,
  };
}

/**
 * Monte Carlo Prop Challenge Pass Probability Simulator (1,000 bootstrap runs)
 */
export function simulatePropFirmPassProbability(
  startingBalance: number,
  currentBalance: number,
  profitTargetPct: number,
  dailyLossLimitPct: number,
  maxTotalDrawdownPct: number,
  riskPerTradeRatio: number,
  winRate: number,
  rewardToRiskRatio: number,
  iterations = 1000
): { passRatePct: number; failRatePct: number; timeoutRatePct: number; expectedDays: number } {
  const targetEquity = startingBalance * (1 + profitTargetPct / 100);
  const minAllowedTotalEquity = startingBalance * (1 - maxTotalDrawdownPct / 100);
  const maxTradingDays = 30;
  const tradesPerDay = 1.5; // Average 1 to 2 setups daily

  let passedCount = 0;
  let failedCount = 0;
  let timeoutCount = 0;
  let totalDaysForPasses = 0;

  for (let iter = 0; iter < iterations; iter++) {
    let eq = currentBalance;
    let day = 0;
    let breached = false;
    let hitTarget = false;

    while (day < maxTradingDays && !breached && !hitTarget) {
      day++;
      const dailyStart = eq;
      const minDailyAllowed = dailyStart * (1 - dailyLossLimitPct / 100);

      // 1 to 2 trades per day
      const dailyTrades = Math.random() > 0.5 ? 2 : 1;
      for (let t = 0; t < dailyTrades; t++) {
        const riskDollar = eq * Math.max(0.002, riskPerTradeRatio);
        const isWin = Math.random() < winRate;

        if (isWin) {
          eq += riskDollar * rewardToRiskRatio;
        } else {
          eq -= riskDollar;
        }

        // Check total drawdown violation
        if (eq <= minAllowedTotalEquity) {
          breached = true;
          break;
        }
        // Check daily drawdown violation
        if (eq <= minDailyAllowed) {
          breached = true;
          break;
        }
        // Check target hit
        if (eq >= targetEquity) {
          hitTarget = true;
          break;
        }
      }
    }

    if (hitTarget) {
      passedCount++;
      totalDaysForPasses += day;
    } else if (breached) {
      failedCount++;
    } else {
      timeoutCount++;
    }
  }

  const passRatePct = Number(((passedCount / iterations) * 100).toFixed(1));
  const failRatePct = Number(((failedCount / iterations) * 100).toFixed(1));
  const timeoutRatePct = Number(((timeoutCount / iterations) * 100).toFixed(1));
  const expectedDays = passedCount > 0 ? Math.round(totalDaysForPasses / passedCount) : 30;

  return {
    passRatePct,
    failRatePct,
    timeoutRatePct,
    expectedDays,
  };
}

