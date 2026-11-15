/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * Aurum Intelligence — CFD Risk & Margin Calculator
 * Interactive position sizing, margin headroom, cost deductions, and hard-limit checks.
 */

import React, { useState, useEffect } from 'react';
import { CFDCalculationResult, InstrumentSpecification } from '../domain/types';
import {
  calculateCFDRisk,
  DEFAULT_GOLD_SPECIFICATION,
  evaluatePropFirmGuardrail,
  PROP_FIRM_PRESETS,
  PropFirmPresetId,
} from '../services/riskEngine';
import {
  ShieldAlert,
  CheckCircle2,
  DollarSign,
  Percent,
  Scale,
  ShieldCheck,
  Lock,
  AlertTriangle,
  Zap,
  Target,
} from 'lucide-react';

interface CFDCalculatorProps {
  initialEquity?: number;
  initialEntry?: number;
  initialStop?: number;
  initialTarget?: number;
  initialSpreadPips?: number;
}

export const CFDCalculator: React.FC<CFDCalculatorProps> = ({
  initialEquity = 50000,
  initialEntry = 3898.90,
  initialStop = 3885.00,
  initialTarget = 3925.00,
  initialSpreadPips = 30,
}) => {
  const [equity, setEquity] = useState(initialEquity);
  const [riskPct, setRiskPct] = useState(1.5);
  const [entryPrice, setEntryPrice] = useState(initialEntry);
  const [stopPrice, setStopPrice] = useState(initialStop);
  const [targetPrice, setTargetPrice] = useState(initialTarget);
  const [spreadPips, setSpreadPips] = useState(initialSpreadPips);
  const [leverage, setLeverage] = useState(30);

  // Prop Firm Challenge Guardian State
  const [isPropFirmMode, setIsPropFirmMode] = useState<boolean>(false);
  const [propFirmPresetId, setPropFirmPresetId] = useState<PropFirmPresetId>('FTMO_100K');
  const [dailyStartingEquity, setDailyStartingEquity] = useState<number>(initialEquity);

  // Sync state if props change when user selects a specific plan
  useEffect(() => {
    if (initialEntry) setEntryPrice(initialEntry);
    if (initialStop) setStopPrice(initialStop);
    if (initialTarget) setTargetPrice(initialTarget);
    if (initialSpreadPips) setSpreadPips(initialSpreadPips);
    if (initialEquity) {
      setEquity(initialEquity);
      setDailyStartingEquity(initialEquity);
    }
  }, [initialEntry, initialStop, initialTarget, initialSpreadPips, initialEquity]);

  const [spec, setSpec] = useState<InstrumentSpecification>(DEFAULT_GOLD_SPECIFICATION);

  useEffect(() => {
    setSpec((prev) => ({
      ...prev,
      leverageMax: leverage,
      marginRequirementPct: Number((100 / leverage).toFixed(3)),
    }));
  }, [leverage]);

  const result: CFDCalculationResult = calculateCFDRisk({
    accountEquity: equity,
    riskPercent: riskPct,
    entryPrice,
    stopLossPrice: stopPrice,
    target1Price: targetPrice,
    currentSpreadPips: spreadPips,
    spec,
  });

  const propFirmEval = evaluatePropFirmGuardrail({
    presetId: propFirmPresetId,
    currentEquity: equity,
    dailyStartingEquity,
    entryPrice,
    stopLossPrice: stopPrice,
    target1Price: targetPrice,
    spec,
  });

  const handleApplyPropFirmGuardrail = () => {
    setIsPropFirmMode(true);
    setRiskPct(propFirmEval.recommendedSingleTradeRiskPct);
    setEquity(propFirmEval.preset.initialBalance);
    setDailyStartingEquity(propFirmEval.preset.initialBalance);
  };

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-lg p-5 sm:p-6 text-slate-100">
      <div className="flex flex-wrap items-center justify-between gap-4 pb-4 border-b border-slate-800">
        <div>
          <h2 className="text-lg font-bold flex items-center gap-2">
            <Scale className="w-5 h-5 text-amber-400" />
            Deterministic CFD Risk & Position Sizing Suite
          </h2>
          <p className="text-xs text-slate-400 mt-0.5">
            Institutional position sizing for linear spot gold CFDs (100 oz / standard lot) with cost and margin drag.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={() => setIsPropFirmMode(!isPropFirmMode)}
            className={`flex items-center gap-1.5 text-xs font-mono font-semibold px-3 py-1 rounded border transition-colors ${
              isPropFirmMode
                ? 'bg-amber-500/20 text-amber-300 border-amber-500/40 shadow-sm'
                : 'bg-slate-800 text-slate-400 border-slate-700 hover:text-slate-200'
            }`}
          >
            <ShieldCheck className="w-3.5 h-3.5 text-amber-400" />
            {isPropFirmMode ? 'Prop Firm Guardian: ACTIVE' : 'Prop Firm Guardian'}
          </button>

          {result.isCompliantWithHardLimits ? (
            <span className="flex items-center gap-1.5 text-xs font-mono font-semibold text-emerald-400 bg-emerald-500/10 px-3 py-1 rounded border border-emerald-500/20">
              <CheckCircle2 className="w-4 h-4" /> Hard Limits Passed
            </span>
          ) : (
            <span className="flex items-center gap-1.5 text-xs font-mono font-semibold text-rose-400 bg-rose-500/10 px-3 py-1 rounded border border-rose-500/20">
              <ShieldAlert className="w-4 h-4" /> Hard Limit Breach ({result.hardLimitFailures.length})
            </span>
          )}
        </div>
      </div>

      {/* Prop Firm Challenge Guardian Section */}
      {isPropFirmMode && (
        <div className="mt-4 p-4 bg-slate-950 rounded-lg border border-amber-500/30 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-slate-800">
            <div className="flex items-center gap-2">
              <span className="text-xs font-mono text-amber-400 font-bold uppercase tracking-wider">
                Prop Firm Capital Protector:
              </span>
              <div className="flex flex-wrap gap-1.5">
                {(Object.keys(PROP_FIRM_PRESETS) as PropFirmPresetId[]).map((presetKey) => {
                  const p = PROP_FIRM_PRESETS[presetKey];
                  return (
                    <button
                      key={presetKey}
                      onClick={() => {
                        setPropFirmPresetId(presetKey);
                        setEquity(p.initialBalance);
                        setDailyStartingEquity(p.initialBalance);
                        setRiskPct(p.maxSingleTradeRiskCeilingPct);
                      }}
                      className={`text-[10px] font-mono px-2 py-0.5 rounded border ${
                        propFirmPresetId === presetKey
                          ? 'bg-amber-500/20 text-amber-300 border-amber-500/40 font-bold'
                          : 'bg-slate-900 text-slate-400 border-slate-800 hover:text-slate-200'
                      }`}
                    >
                      {p.name}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="flex items-center gap-2">
              <span
                className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded border ${
                  propFirmEval.circuitBreakerStatus === 'NORMAL_OPERATIONAL'
                    ? 'bg-emerald-500/10 text-emerald-300 border-emerald-500/30'
                    : propFirmEval.circuitBreakerStatus === 'WARNING_BUFFER_LOW'
                    ? 'bg-amber-500/10 text-amber-300 border-amber-500/30'
                    : 'bg-rose-500/10 text-rose-300 border-rose-500/30'
                }`}
              >
                CIRCUIT BREAKER: {propFirmEval.circuitBreakerStatus.replace(/_/g, ' ')}
              </span>

              <button
                onClick={handleApplyPropFirmGuardrail}
                className="flex items-center gap-1 text-[11px] font-mono font-bold px-2.5 py-0.5 rounded bg-amber-400 text-slate-950 hover:bg-amber-300 transition-colors shadow-sm"
                title="Lock position risk to optimal 0.75% prop firm ceiling"
              >
                <Lock className="w-3 h-3" /> Lock 0.75% Guardrail
              </button>
            </div>
          </div>

          {/* Prop Firm Key Metrics Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 font-mono tabular-nums">
            <div className="bg-slate-900 p-2.5 rounded border border-slate-800">
              <span className="text-[10px] text-slate-500 uppercase block">Remaining Daily Buffer</span>
              <span className="text-sm font-bold text-emerald-400 block mt-0.5">
                ${propFirmEval.dailyDrawdownRemainingDollar.toLocaleString()}
              </span>
              <span className="text-[10px] text-slate-400">
                Max Daily Loss: ${(propFirmEval.preset.initialBalance * propFirmEval.preset.maxDailyDrawdownPct / 100).toLocaleString()}
              </span>
            </div>

            <div className="bg-slate-900 p-2.5 rounded border border-slate-800">
              <span className="text-[10px] text-slate-500 uppercase block">Remaining Total Buffer</span>
              <span className="text-sm font-bold text-slate-200 block mt-0.5">
                ${propFirmEval.totalDrawdownRemainingDollar.toLocaleString()}
              </span>
              <span className="text-[10px] text-slate-400">
                Max Total Loss: ${(propFirmEval.preset.initialBalance * propFirmEval.preset.maxTotalDrawdownPct / 100).toLocaleString()}
              </span>
            </div>

            <div className="bg-slate-900 p-2.5 rounded border border-slate-800">
              <span className="text-[10px] text-slate-500 uppercase block">Safe Position Lots</span>
              <span className="text-sm font-bold text-amber-400 block mt-0.5">
                {propFirmEval.safePositionLots.toFixed(2)} Lots
              </span>
              <span className="text-[10px] text-slate-400">
                Risk Cap: {propFirmEval.recommendedSingleTradeRiskPct}% (${propFirmEval.recommendedSingleTradeRiskDollar.toFixed(0)})
              </span>
            </div>

            <div className="bg-slate-900 p-2.5 rounded border border-slate-800">
              <span className="text-[10px] text-slate-500 uppercase block">30-Day Pass Probability</span>
              <div className="flex items-center gap-1.5 mt-0.5">
                <Target className="w-3.5 h-3.5 text-amber-400" />
                <span className="text-sm font-bold text-emerald-400">
                  {propFirmEval.passProbabilityPct}% Pass Rate
                </span>
              </div>
              <span className="text-[10px] text-slate-400">
                Avg {propFirmEval.expectedTradingDaysToTarget} days to {propFirmEval.preset.profitTargetPct}% target
              </span>
            </div>
          </div>

          {/* Circuit Breaker Reason if Triggered */}
          {propFirmEval.circuitBreakerReason && (
            <div className="p-2.5 bg-rose-500/10 border border-rose-500/30 rounded text-xs text-rose-300 flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0" />
              <span>{propFirmEval.circuitBreakerReason}</span>
            </div>
          )}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 mt-5">
        {/* Input Parameters Form (Left Column) */}
        <div className="lg:col-span-5 space-y-4 bg-slate-950/60 p-4 rounded-lg border border-slate-800">
          <h3 className="text-xs uppercase font-mono text-slate-400 tracking-wider">Parameters</h3>

          <div>
            <label className="text-xs text-slate-300 font-medium flex justify-between">
              <span>Account Equity ($)</span>
              <span className="font-mono text-amber-400 font-bold">${equity.toLocaleString()}</span>
            </label>
            <div className="relative mt-1">
              <DollarSign className="w-4 h-4 text-slate-500 absolute left-3 top-2.5" />
              <input
                type="number"
                value={equity}
                onChange={(e) => setEquity(Math.max(100, Number(e.target.value)))}
                className="w-full bg-slate-900 border border-slate-700 rounded px-3 py-2 pl-9 text-xs font-mono text-slate-100 focus:outline-none focus:border-amber-400"
              />
            </div>
          </div>

          <div>
            <label className="text-xs text-slate-300 font-medium flex justify-between">
              <span>Risk Budget (% of Equity)</span>
              <span className="font-mono text-amber-400 font-bold">{riskPct}% (${result.riskDollarAmount.toFixed(2)})</span>
            </label>
            <div className="relative mt-1">
              <Percent className="w-4 h-4 text-slate-500 absolute left-3 top-2.5" />
              <input
                type="number"
                step="0.1"
                min="0.1"
                max="5.0"
                value={riskPct}
                onChange={(e) => setRiskPct(Number(e.target.value))}
                className="w-full bg-slate-900 border border-slate-700 rounded px-3 py-2 pl-9 text-xs font-mono text-slate-100 focus:outline-none focus:border-amber-400"
              />
            </div>
            <div className="flex gap-2 mt-2">
              {[0.5, 1.0, 1.5, 2.0, 3.0].map((pct) => (
                <button
                  key={pct}
                  onClick={() => setRiskPct(pct)}
                  className={`text-[11px] font-mono px-2 py-0.5 rounded border ${
                    riskPct === pct
                      ? 'bg-amber-500/20 text-amber-300 border-amber-500/40'
                      : 'bg-slate-900 text-slate-400 border-slate-800'
                  }`}
                >
                  {pct}%
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-slate-300">Entry Price ($)</label>
              <input
                type="number"
                step="0.1"
                value={entryPrice}
                onChange={(e) => setEntryPrice(Number(e.target.value))}
                className="w-full mt-1 bg-slate-900 border border-slate-700 rounded px-3 py-1.5 text-xs font-mono text-slate-100"
              />
            </div>

            <div>
              <label className="text-xs text-slate-300">Stop Loss ($)</label>
              <input
                type="number"
                step="0.1"
                value={stopPrice}
                onChange={(e) => setStopPrice(Number(e.target.value))}
                className="w-full mt-1 bg-slate-900 border border-slate-700 rounded px-3 py-1.5 text-xs font-mono text-rose-400"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-slate-300">Take Profit Target ($)</label>
              <input
                type="number"
                step="0.1"
                value={targetPrice}
                onChange={(e) => setTargetPrice(Number(e.target.value))}
                className="w-full mt-1 bg-slate-900 border border-slate-700 rounded px-3 py-1.5 text-xs font-mono text-emerald-400"
              />
            </div>

            <div>
              <label className="text-xs text-slate-300">Broker Spread (pips)</label>
              <input
                type="number"
                value={spreadPips}
                onChange={(e) => setSpreadPips(Number(e.target.value))}
                className="w-full mt-1 bg-slate-900 border border-slate-700 rounded px-3 py-1.5 text-xs font-mono text-slate-300"
              />
            </div>
          </div>

          <div>
            <label className="text-xs text-slate-300 block mb-1">Broker Leverage Cap</label>
            <div className="flex gap-2">
              {[20, 30, 50, 100].map((lev) => (
                <button
                  key={lev}
                  onClick={() => setLeverage(lev)}
                  className={`text-xs font-mono px-3 py-1 rounded border flex-1 ${
                    leverage === lev
                      ? 'bg-amber-500/20 text-amber-300 border-amber-500/40'
                      : 'bg-slate-900 text-slate-400 border-slate-800'
                  }`}
                >
                  1:{lev}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Output Metrics (Right Column) */}
        <div className="lg:col-span-7 space-y-4">
          {/* Primary Sizing KPI Box */}
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            <div className="bg-slate-950 p-3.5 rounded-lg border border-slate-800">
              <span className="text-[11px] font-mono text-slate-400 block">Recommended Lots</span>
              <span className="text-2xl font-mono font-bold text-amber-400 tabular-nums">
                {result.roundedLots.toFixed(2)}
              </span>
              <span className="text-[10px] text-slate-500 block mt-0.5">
                Exact: {result.recommendedLots} lots (0.01 step)
              </span>
            </div>

            <div className="bg-slate-950 p-3.5 rounded-lg border border-slate-800">
              <span className="text-[11px] font-mono text-slate-400 block">Notional Exposure</span>
              <span className="text-xl font-mono font-bold text-slate-200 tabular-nums">
                ${result.notionalExposure.toLocaleString()}
              </span>
              <span className="text-[10px] text-slate-500 block mt-0.5">
                {(result.roundedLots * 100).toFixed(0)} oz Gold
              </span>
            </div>

            <div className="bg-slate-950 p-3.5 rounded-lg border border-slate-800">
              <span className="text-[11px] font-mono text-slate-400 block">Required Margin</span>
              <span className="text-xl font-mono font-bold text-slate-200 tabular-nums">
                ${result.requiredMargin.toLocaleString()}
              </span>
              <span className="text-[10px] text-slate-500 block mt-0.5">
                Margin Headroom: ${result.marginHeadroom.toLocaleString()}
              </span>
            </div>
          </div>

          {/* Cost & PnL Breakdown Table */}
          <div className="bg-slate-950/80 p-4 rounded-lg border border-slate-800 text-xs font-mono space-y-2.5">
            <h4 className="text-[11px] uppercase tracking-wider text-slate-400 pb-1 border-b border-slate-800">
              Detailed Transaction Cost & Net Payoff Analysis
            </h4>

            <div className="flex justify-between py-1 border-b border-slate-800/40">
              <span className="text-slate-400">Stop-Loss Distance</span>
              <span className="text-slate-200 tabular-nums">${result.stopDistancePoints.toFixed(2)}</span>
            </div>

            <div className="flex justify-between py-1 border-b border-slate-800/40">
              <span className="text-slate-400">Estimated Bid/Ask Spread Cost</span>
              <span className="text-slate-300 tabular-nums">-${result.estimatedSpreadCost.toFixed(2)}</span>
            </div>

            <div className="flex justify-between py-1 border-b border-slate-800/40">
              <span className="text-slate-400">Round-Turn Commission ($7/lot)</span>
              <span className="text-slate-300 tabular-nums">-${result.estimatedRoundTurnCommission.toFixed(2)}</span>
            </div>

            <div className="flex justify-between py-1 border-b border-slate-800/40">
              <span className="text-slate-400">Estimated Overnight Swap (Daily)</span>
              <span className="text-slate-300 tabular-nums">${result.estimatedDailyOvernightSwap.toFixed(2)}</span>
            </div>

            <div className="flex justify-between py-1 border-b border-slate-800/40 font-semibold">
              <span className="text-emerald-400">Net Profit at Target 1 (After Costs)</span>
              <span className="text-emerald-400 tabular-nums">+${result.netTarget1Profit.toFixed(2)}</span>
            </div>

            <div className="flex justify-between py-1 border-b border-slate-800/40 font-semibold">
              <span className="text-rose-400">Net Max Loss at Stop (With Costs)</span>
              <span className="text-rose-400 tabular-nums">-${result.netStopLossLoss.toFixed(2)}</span>
            </div>

            <div className="flex justify-between py-1 font-bold text-sm pt-1">
              <span className="text-slate-200">Net Effective Reward : Risk</span>
              <span className="text-amber-400 tabular-nums">1 : {result.netRewardRiskRatio.toFixed(2)}</span>
            </div>
          </div>

          {/* Hard Limit Failures or Disclaimers */}
          {result.hardLimitFailures.length > 0 ? (
            <div className="p-3 bg-rose-500/10 border border-rose-500/30 rounded-lg text-xs space-y-1">
              <h5 className="font-semibold text-rose-300 flex items-center gap-1.5">
                <ShieldAlert className="w-4 h-4 text-rose-400" />
                Hard Risk Limit Breaches (Trade Rejected):
              </h5>
              <ul className="list-disc pl-5 text-rose-200/90 space-y-0.5">
                {result.hardLimitFailures.map((fail, idx) => (
                  <li key={idx}>{fail}</li>
                ))}
              </ul>
            </div>
          ) : (
            <div className="p-3 bg-slate-950/40 border border-slate-800/80 rounded-lg text-[11px] text-slate-400 font-mono">
              Notice: Leveraged CFDs carry high risk of rapid capital loss due to leverage. Ensure guaranteed stop-loss orders are utilized during high-impact economic news releases.
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
