/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * Aurum Intelligence — Historical Scenarios & Point-in-Time Analogues Workspace
 */

import React, { useState } from 'react';
import { CommodityType } from '../domain/types';
import {
  getCommodityAnalogues,
  getCommodityScenarios,
} from '../services/historicalScenariosEngine';
import {
  History,
  TrendingUp,
  TrendingDown,
  AlertTriangle,
  Minus,
  ShieldAlert,
  Percent,
  CheckCircle,
  HelpCircle,
} from 'lucide-react';

interface HistoricalScenariosWorkspaceProps {
  currentCommodity: CommodityType;
  onCommodityChange?: (c: CommodityType) => void;
}

export const HistoricalScenariosWorkspace: React.FC<HistoricalScenariosWorkspaceProps> = ({
  currentCommodity,
  onCommodityChange,
}) => {
  const [selectedCommodity, setSelectedCommodity] = useState<CommodityType>(currentCommodity);

  const scenarios = getCommodityScenarios(selectedCommodity);
  const analogues = getCommodityAnalogues(selectedCommodity);

  return (
    <div className="space-y-6">
      {/* Top Header & Commodity Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-slate-900 border border-slate-800 rounded-xl p-5 shadow-xs">
        <div>
          <div className="flex items-center gap-2">
            <History className="w-5 h-5 text-amber-400" />
            <h2 className="text-xl font-bold text-white tracking-wide">
              Macro Scenarios & Historical Analogues
            </h2>
          </div>
          <p className="text-sm text-slate-400 mt-1">
            Point-in-time safe scenario modeling (Bull, Base, Bear, Tail-Risk) and distribution studies.
          </p>
        </div>

        {/* Commodity Tabs */}
        <div className="flex items-center gap-1 bg-slate-950 p-1 rounded-lg border border-slate-800 self-start sm:self-auto">
          {(['GOLD', 'SILVER', 'WTI_OIL', 'BRENT_OIL'] as const).map((c) => (
            <button
              key={c}
              onClick={() => {
                setSelectedCommodity(c);
                onCommodityChange?.(c);
              }}
              className={`px-3 py-1.5 rounded-md text-xs font-mono font-medium transition-colors ${
                selectedCommodity === c
                  ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              {c === 'GOLD'
                ? 'Gold'
                : c === 'SILVER'
                ? 'Silver'
                : c === 'WTI_OIL'
                ? 'WTI Oil'
                : 'Brent Oil'}
            </button>
          ))}
        </div>
      </div>

      {/* 4 Distinct Scenario Cards: Bull, Base, Bear, Tail-Risk */}
      <div>
        <h3 className="text-xs font-mono uppercase tracking-wider text-slate-400 mb-3 flex items-center gap-1.5">
          <span>Forward Macro & Structural Scenarios:</span>
          <span className="text-amber-400 font-bold">{selectedCommodity}</span>
        </h3>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {scenarios.map((sc) => {
            const isBull = sc.type === 'BULL';
            const isBase = sc.type === 'BASE';
            const isBear = sc.type === 'BEAR';
            const isTail = sc.type === 'TAIL_RISK';

            return (
              <div
                key={sc.type}
                className={`bg-slate-900/90 border rounded-xl p-5 shadow-xs flex flex-col justify-between ${
                  isBull
                    ? 'border-emerald-500/30'
                    : isBase
                    ? 'border-blue-500/30'
                    : isBear
                    ? 'border-rose-500/30'
                    : 'border-purple-500/30'
                }`}
              >
                <div>
                  {/* Scenario Header */}
                  <div className="flex items-center justify-between pb-3 border-b border-slate-800/80">
                    <div className="flex items-center gap-2">
                      {isBull && <TrendingUp className="w-4 h-4 text-emerald-400" />}
                      {isBase && <Minus className="w-4 h-4 text-blue-400" />}
                      {isBear && <TrendingDown className="w-4 h-4 text-rose-400" />}
                      {isTail && <AlertTriangle className="w-4 h-4 text-purple-400" />}
                      <span className="text-xs font-mono font-bold tracking-wider uppercase text-white">
                        {sc.type.replace('_', ' ')} CASE
                      </span>
                    </div>

                    <div className="flex items-center gap-2">
                      <span className="text-[11px] font-mono text-slate-400">
                        Likelihood: <strong className="text-white">{sc.likelihood}</strong>
                      </span>
                    </div>
                  </div>

                  {/* Title & Target */}
                  <h4 className="text-base font-bold text-white mt-3 leading-snug">
                    {sc.title}
                  </h4>

                  <div className="mt-2.5 p-2.5 bg-slate-950/80 rounded-lg border border-slate-800/60 flex items-center justify-between font-mono">
                    <span className="text-xs text-slate-400">Target Projection:</span>
                    <span className="text-sm font-bold text-amber-300">
                      {sc.priceTargetProjection}
                    </span>
                    <span className="text-[11px] text-slate-500">({sc.horizon})</span>
                  </div>

                  {/* Core Assumptions */}
                  <div className="mt-3 text-xs">
                    <span className="font-mono text-slate-400 uppercase text-[10px] tracking-wider block mb-1">
                      Core Macro Assumptions:
                    </span>
                    <ul className="space-y-1 text-slate-300 list-disc list-inside">
                      {sc.coreAssumptions.map((assump, idx) => (
                        <li key={idx} className="leading-snug">{assump}</li>
                      ))}
                    </ul>
                  </div>

                  {/* Catalysts & Counterarguments */}
                  <div className="mt-3 grid grid-cols-1 gap-2 text-xs">
                    <div className="p-2.5 bg-emerald-950/20 rounded border border-emerald-900/30 text-slate-300">
                      <strong className="text-emerald-300 font-mono text-[10px] uppercase block mb-0.5">
                        Supporting Catalysts:
                      </strong>
                      {sc.supportingCatalysts.join(' • ')}
                    </div>
                    <div className="p-2.5 bg-rose-950/20 rounded border border-rose-900/30 text-slate-300">
                      <strong className="text-rose-300 font-mono text-[10px] uppercase block mb-0.5">
                        Adversarial Counterarguments:
                      </strong>
                      {sc.counterArguments.join(' • ')}
                    </div>
                  </div>
                </div>

                {/* Invalidation & Market Structure Confirmation */}
                <div className="mt-4 pt-3 border-t border-slate-800 text-xs font-mono space-y-1.5">
                  <div className="flex items-start gap-1.5 text-slate-300">
                    <CheckCircle className="w-3.5 h-3.5 text-emerald-400 shrink-0 mt-0.5" />
                    <span><strong className="text-slate-400">Confirmation:</strong> {sc.marketStructureConfirmation}</span>
                  </div>
                  <div className="flex items-start gap-1.5 text-amber-400/90">
                    <ShieldAlert className="w-3.5 h-3.5 text-amber-400 shrink-0 mt-0.5" />
                    <span><strong className="text-slate-400">Invalidation:</strong> {sc.invalidationLevel}</span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Point-in-Time Safe Historical Analogues */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-xs font-mono uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
            <Percent className="w-3.5 h-3.5 text-amber-400" />
            Historical Analogue Episodes & Outcome Distributions ({analogues.length})
          </h3>
          <span className="text-[11px] font-mono text-slate-500">
            Strict point-in-time calculation (zero look-ahead bias)
          </span>
        </div>

        <div className="space-y-4">
          {analogues.map((an) => (
            <div
              key={an.id}
              className="bg-slate-900/90 border border-slate-800 rounded-xl p-5 shadow-xs space-y-4"
            >
              {/* Header */}
              <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-slate-800">
                <div>
                  <div className="flex items-center gap-2">
                    <h4 className="text-base font-bold text-white">{an.title}</h4>
                    <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-blue-500/20 text-blue-300 border border-blue-500/30">
                      {an.regime}
                    </span>
                  </div>
                  <p className="text-xs font-mono text-slate-400 mt-0.5">
                    Historical Episode: {an.historicalPeriod}
                  </p>
                </div>

                <div className="flex items-center gap-2 bg-slate-950 px-3 py-1.5 rounded-lg border border-slate-800">
                  <span className="text-xs text-slate-400 font-mono">Similarity Match:</span>
                  <span className="text-base font-mono font-bold text-emerald-400">
                    {an.similarityScorePct}%
                  </span>
                </div>
              </div>

              {/* Trigger & Macro Context */}
              <p className="text-xs text-slate-300 leading-relaxed">
                <strong className="text-slate-200">Historical Catalyst:</strong> {an.triggerEvent}
              </p>

              {/* Quant Forward Returns & Excursion Statistics */}
              <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-7 gap-2 text-center font-mono">
                <div className="bg-slate-950 p-2 rounded border border-slate-800/80">
                  <div className="text-[10px] text-slate-500 uppercase">+5 Days</div>
                  <div className={`text-sm font-bold ${an.forwardReturns.d5Pct >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                    {an.forwardReturns.d5Pct > 0 ? `+${an.forwardReturns.d5Pct}%` : `${an.forwardReturns.d5Pct}%`}
                  </div>
                </div>
                <div className="bg-slate-950 p-2 rounded border border-slate-800/80">
                  <div className="text-[10px] text-slate-500 uppercase">+20 Days</div>
                  <div className={`text-sm font-bold ${an.forwardReturns.d20Pct >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                    {an.forwardReturns.d20Pct > 0 ? `+${an.forwardReturns.d20Pct}%` : `${an.forwardReturns.d20Pct}%`}
                  </div>
                </div>
                <div className="bg-slate-950 p-2 rounded border border-slate-800/80">
                  <div className="text-[10px] text-slate-500 uppercase">+60 Days</div>
                  <div className={`text-sm font-bold ${an.forwardReturns.d60Pct >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                    {an.forwardReturns.d60Pct > 0 ? `+${an.forwardReturns.d60Pct}%` : `${an.forwardReturns.d60Pct}%`}
                  </div>
                </div>
                <div className="bg-slate-950 p-2 rounded border border-slate-800/80">
                  <div className="text-[10px] text-slate-500 uppercase">+180 Days</div>
                  <div className={`text-sm font-bold ${an.forwardReturns.d180Pct >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                    {an.forwardReturns.d180Pct > 0 ? `+${an.forwardReturns.d180Pct}%` : `${an.forwardReturns.d180Pct}%`}
                  </div>
                </div>
                <div className="bg-slate-950 p-2 rounded border border-slate-800/80">
                  <div className="text-[10px] text-emerald-500 uppercase" title="Maximum Favorable Excursion">Max MFE</div>
                  <div className="text-sm font-bold text-emerald-400">+{an.mfePct}%</div>
                </div>
                <div className="bg-slate-950 p-2 rounded border border-slate-800/80">
                  <div className="text-[10px] text-rose-500 uppercase" title="Maximum Adverse Excursion">Max MAE</div>
                  <div className="text-sm font-bold text-rose-400">{an.maePct}%</div>
                </div>
                <div className="bg-slate-950 p-2 rounded border border-slate-800/80 col-span-2 sm:col-span-1">
                  <div className="text-[10px] text-amber-500 uppercase">Drawdown</div>
                  <div className="text-sm font-bold text-amber-400">{an.maxDrawdownPct}%</div>
                </div>
              </div>

              {/* Differences & Caveats */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
                <div className="p-3 bg-slate-950/60 rounded-lg border border-slate-800">
                  <span className="font-mono text-slate-400 font-semibold block mb-1 uppercase text-[10px]">
                    Structural Differences vs Present Setup:
                  </span>
                  <ul className="space-y-1 text-slate-300 list-disc list-inside">
                    {an.keyDifferences.map((diff, i) => (
                      <li key={i}>{diff}</li>
                    ))}
                  </ul>
                </div>

                <div className="p-3 bg-amber-950/20 rounded-lg border border-amber-900/30">
                  <span className="font-mono text-amber-300 font-semibold block mb-1 uppercase text-[10px] flex items-center gap-1">
                    <HelpCircle className="w-3 h-3" />
                    Failure Modes & Counterexample Caveats:
                  </span>
                  <p className="text-slate-300 leading-snug">{an.caveatsAndCounterexamples}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
