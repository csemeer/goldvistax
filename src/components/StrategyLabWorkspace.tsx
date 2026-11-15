/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * Aurum Intelligence — Quantitative Strategy Lab
 * 10 canonical strategies, execution rules, validated parameters, and live signal monitoring.
 */

import React, { useState, useEffect } from 'react';
import { InstrumentId, QuantitativeStrategy, TradePlan } from '../domain/types';
import { createTradePlanFromStrategy } from '../services/strategyEngine';
import {
  PlayCircle,
  ShieldCheck,
  Zap,
  SlidersHorizontal,
  ArrowUpRight,
  ArrowDownRight,
  Clock,
  Calculator,
  Briefcase,
  Layers,
  CheckCircle2,
  AlertTriangle,
} from 'lucide-react';

interface StrategyLabWorkspaceProps {
  strategies: QuantitativeStrategy[];
  activeStrategyId?: string;
  onSelectStrategy?: (strategyId: string) => void;
  onSelectForBacktest?: (strategyId: string) => void;
  onSelectForCFD?: (plan: TradePlan) => void;
  onExecutePaper?: (plan: TradePlan) => void;
  currentMid?: number;
  instrumentId?: InstrumentId;
}

export const StrategyLabWorkspace: React.FC<StrategyLabWorkspaceProps> = ({
  strategies,
  activeStrategyId,
  onSelectStrategy,
  onSelectForBacktest,
  onSelectForCFD,
  onExecutePaper,
  currentMid = 3950.00,
  instrumentId = 'XAUUSD',
}) => {
  const [selectedCategory, setSelectedCategory] = useState<string>('ALL');
  const [activeStrategy, setActiveStrategy] = useState<QuantitativeStrategy>(() => {
    if (activeStrategyId) {
      const match = strategies.find((s) => s.id === activeStrategyId);
      if (match) return match;
    }
    return strategies[0] || {} as QuantitativeStrategy;
  });

  // Sync when activeStrategyId prop updates from outside (e.g. Backtest or navigation)
  useEffect(() => {
    if (activeStrategyId) {
      const match = strategies.find((s) => s.id === activeStrategyId);
      if (match && match.id !== activeStrategy.id) {
        setActiveStrategy(match);
      }
    }
  }, [activeStrategyId, strategies]);

  const categories = [
    'ALL',
    'Trend Following',
    'Trend Continuation',
    'Market Structure',
    'Range Trading',
    'Mean Reversion',
    'Event-Driven',
    'Volatility Breakout',
    'Multi-Timeframe',
    'Statistical',
    'CFD Execution',
  ];

  const filtered =
    selectedCategory === 'ALL'
      ? strategies
      : strategies.filter(
          (s) =>
            s.category.toLowerCase().includes(selectedCategory.toLowerCase()) ||
            selectedCategory.toLowerCase().includes(s.category.toLowerCase())
        );

  const handleSelectStrategy = (strat: QuantitativeStrategy) => {
    setActiveStrategy(strat);
    onSelectStrategy?.(strat.id);
  };

  // Convert active strategy to live trade plan for CFD sizing or Paper execution
  const activePlan = createTradePlanFromStrategy(activeStrategy, currentMid, instrumentId);

  return (
    <div className="space-y-6">
      {/* Category Filter Pills */}
      <div className="flex flex-wrap items-center gap-2 pb-2 border-b border-slate-800">
        {categories.map((cat) => (
          <button
            key={cat}
            onClick={() => setSelectedCategory(cat)}
            className={`px-3 py-1.5 text-xs font-mono rounded-md transition-colors ${
              selectedCategory === cat
                ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40 font-semibold shadow-sm'
                : 'bg-slate-900 text-slate-400 hover:text-slate-200 border border-slate-800'
            }`}
          >
            {cat}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left List of Strategies */}
        <div className="lg:col-span-5 space-y-3">
          <div className="flex items-center justify-between text-xs font-mono text-slate-400 px-1">
            <span>Quantitative Models ({filtered.length})</span>
            <span>Current Spot: ${currentMid.toFixed(2)}</span>
          </div>

          {filtered.map((strat) => {
            const isSelected = activeStrategy.id === strat.id;
            const isSignalBuy = strat.currentSignal.action === 'BUY';
            const isSignalActive = strat.currentSignal.active;

            return (
              <div
                key={strat.id}
                onClick={() => handleSelectStrategy(strat)}
                className={`p-4 rounded-lg border cursor-pointer transition-all ${
                  isSelected
                    ? 'bg-slate-850 border-amber-500/70 shadow-lg ring-1 ring-amber-500/30 text-slate-100'
                    : 'bg-slate-900 border-slate-800 text-slate-400 hover:border-slate-700'
                }`}
              >
                <div className="flex items-center justify-between text-xs font-mono pb-1 border-b border-slate-800/60">
                  <span className="text-amber-400 font-semibold">{strat.category}</span>
                  <span className="text-slate-500">{strat.id}</span>
                </div>

                <h4 className="text-sm font-bold text-slate-100 mt-2">{strat.name}</h4>
                <p className="text-xs text-slate-400 line-clamp-2 mt-1">{strat.description}</p>

                <div className="flex items-center justify-between text-xs font-mono mt-3 pt-2 border-t border-slate-800/60">
                  <div className="flex gap-3 text-slate-300 tabular-nums">
                    <span>
                      Win: <strong className="text-emerald-400">{strat.performance.winRatePct}%</strong>
                    </span>
                    <span>
                      PF: <strong className="text-slate-100">{strat.performance.profitFactor}</strong>
                    </span>
                    <span>
                      DD: <strong className="text-rose-400">{strat.performance.maxDrawdownPct}%</strong>
                    </span>
                  </div>

                  <div>
                    {isSignalActive ? (
                      <span
                        className={`px-2 py-0.5 rounded text-[10px] font-bold flex items-center gap-1 ${
                          isSignalBuy
                            ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30'
                            : 'bg-rose-500/10 text-rose-400 border border-rose-500/30'
                        }`}
                      >
                        {isSignalBuy ? <ArrowUpRight className="w-3 h-3" /> : <ArrowDownRight className="w-3 h-3" />}
                        {strat.currentSignal.action}
                      </span>
                    ) : (
                      <span className="text-[10px] text-slate-500 font-mono">STANDBY</span>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Right Strategy Deep-Dive */}
        <div className="lg:col-span-7 bg-slate-900 border border-slate-800 rounded-lg p-5 sm:p-6 space-y-5">
          <div className="flex flex-wrap items-center justify-between gap-3 pb-4 border-b border-slate-800">
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-mono text-amber-400">{activeStrategy.category}</span>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-slate-800 text-slate-400 border border-slate-700">
                  {activeStrategy.id}
                </span>
              </div>
              <h3 className="text-lg font-bold text-slate-100 mt-1">{activeStrategy.name}</h3>
              <p className="text-xs text-slate-400 mt-1">{activeStrategy.description}</p>
            </div>

            {/* Action Toolbar */}
            <div className="flex flex-wrap items-center gap-2">
              {onSelectForBacktest && (
                <button
                  onClick={() => onSelectForBacktest(activeStrategy.id)}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-slate-950 bg-amber-400 hover:bg-amber-300 rounded transition-colors shadow-sm"
                  title="Run Out-of-Sample Walk-Forward Simulation"
                >
                  <PlayCircle className="w-4 h-4" />
                  Run Backtest
                </button>
              )}

              {onSelectForCFD && (
                <button
                  onClick={() => onSelectForCFD(activePlan)}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-200 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded transition-colors"
                  title="Open in CFD Margin & Risk Calculator"
                >
                  <Calculator className="w-3.5 h-3.5 text-amber-400" />
                  CFD Sizing
                </button>
              )}

              {onExecutePaper && (
                <button
                  onClick={() => onExecutePaper(activePlan)}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-200 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded transition-colors"
                  title="Execute Signal in Paper Trading Portfolio"
                >
                  <Briefcase className="w-3.5 h-3.5 text-emerald-400" />
                  Paper Trade
                </button>
              )}
            </div>
          </div>

          {/* Active Signal Box */}
          <div className="bg-slate-950 p-4 rounded-lg border border-slate-800 text-xs">
            <div className="flex items-center justify-between pb-2 border-b border-slate-800/60 font-mono">
              <span className="text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                <Zap className="w-3.5 h-3.5 text-amber-400" /> Current Signal State
              </span>
              <span className="text-slate-500">Updated {activeStrategy.currentSignal.signalTime.slice(11, 16)} UTC</span>
            </div>

            <div className="mt-3 flex items-start gap-3">
              <span
                className={`px-2.5 py-1 rounded text-xs font-mono font-bold shrink-0 ${
                  activeStrategy.currentSignal.action === 'BUY'
                    ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30'
                    : activeStrategy.currentSignal.action === 'SELL'
                    ? 'bg-rose-500/10 text-rose-400 border border-rose-500/30'
                    : 'bg-slate-800 text-slate-400'
                }`}
              >
                {activeStrategy.currentSignal.action}
              </span>
              <p className="text-slate-300 font-sans text-xs leading-relaxed">
                {activeStrategy.currentSignal.reason}
              </p>
            </div>

            {/* Calculated Signal Execution Structure */}
            <div className="mt-4 pt-3 border-t border-slate-800/80 grid grid-cols-2 sm:grid-cols-4 gap-2.5 font-mono tabular-nums">
              <div className="bg-slate-900/80 p-2 rounded border border-slate-800">
                <span className="text-[10px] text-slate-500 uppercase block">Trigger Price</span>
                <span className="text-xs font-bold text-slate-200">${activePlan.triggerPrice.toFixed(2)}</span>
              </div>
              <div className="bg-slate-900/80 p-2 rounded border border-slate-800">
                <span className="text-[10px] text-slate-500 uppercase block">Stop Loss</span>
                <span className="text-xs font-bold text-rose-400">${activePlan.stopLossPrice.toFixed(2)}</span>
              </div>
              <div className="bg-slate-900/80 p-2 rounded border border-slate-800">
                <span className="text-[10px] text-slate-500 uppercase block">Target 1</span>
                <span className="text-xs font-bold text-emerald-400">${activePlan.target1Price.toFixed(2)}</span>
              </div>
              <div className="bg-slate-900/80 p-2 rounded border border-slate-800">
                <span className="text-[10px] text-slate-500 uppercase block">Net R:R Ratio</span>
                <span className="text-xs font-bold text-amber-400">1 : {activePlan.rewardToRiskRatio}</span>
              </div>
            </div>
          </div>

          {/* Rules Matrix */}
          <div className="space-y-2.5 text-xs font-mono">
            <h4 className="text-[11px] uppercase tracking-wider text-slate-400 font-mono flex items-center gap-1.5">
              <Layers className="w-3.5 h-3.5 text-amber-400" /> Deterministic Logic & Strategy Rules
            </h4>
            <div className="bg-slate-950/70 p-3.5 rounded border border-slate-800/80 space-y-2.5">
              <div>
                <strong className="text-emerald-400 block mb-0.5">Entry Trigger:</strong>
                <span className="text-slate-300">{activeStrategy.rules.entry}</span>
              </div>
              <div>
                <strong className="text-rose-400 block mb-0.5">Stop-Loss Formulation:</strong>
                <span className="text-slate-300">{activeStrategy.rules.stop}</span>
              </div>
              <div>
                <strong className="text-amber-400 block mb-0.5">Take-Profit Targets:</strong>
                <span className="text-slate-300">{activeStrategy.rules.target}</span>
              </div>
              <div>
                <strong className="text-purple-400 block mb-0.5">Invalidation / Void Condition:</strong>
                <span className="text-slate-300">{activeStrategy.rules.invalidation}</span>
              </div>
            </div>
          </div>

          {/* Parameter Settings */}
          <div>
            <h4 className="text-[11px] uppercase tracking-wider text-slate-400 font-mono mb-2 flex items-center gap-1.5">
              <SlidersHorizontal className="w-3.5 h-3.5 text-amber-400" /> Configured Parameters
            </h4>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs font-mono">
              {Object.entries(activeStrategy.parameters).map(([key, val]) => (
                <div key={key} className="bg-slate-950 p-2.5 rounded border border-slate-800">
                  <span className="text-[10px] text-slate-500 block uppercase">{key}</span>
                  <span className="text-sm font-bold text-slate-200">{String(val)}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Historical Verified Performance Metrics */}
          <div>
            <h4 className="text-[11px] uppercase tracking-wider text-slate-400 font-mono mb-2 flex items-center gap-1.5">
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" /> Verified Historical Baseline (Out-of-Sample)
            </h4>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 text-xs font-mono tabular-nums">
              <div className="bg-slate-950 p-2.5 rounded border border-slate-800">
                <span className="text-[10px] text-slate-500 block">WIN RATE</span>
                <span className="text-base font-bold text-emerald-400">{activeStrategy.performance.winRatePct}%</span>
                <span className="text-[10px] text-slate-500 block">{activeStrategy.performance.totalTrades} Trades</span>
              </div>

              <div className="bg-slate-950 p-2.5 rounded border border-slate-800">
                <span className="text-[10px] text-slate-500 block">PROFIT FACTOR</span>
                <span className="text-base font-bold text-slate-200">{activeStrategy.performance.profitFactor}</span>
                <span className="text-[10px] text-slate-500 block">Gross Win/Loss</span>
              </div>

              <div className="bg-slate-950 p-2.5 rounded border border-slate-800">
                <span className="text-[10px] text-slate-500 block">SHARPE RATIO</span>
                <span className="text-base font-bold text-amber-400">{activeStrategy.performance.sharpeRatio}</span>
                <span className="text-[10px] text-slate-500 block">Sortino: {activeStrategy.performance.sortinoRatio}</span>
              </div>

              <div className="bg-slate-950 p-2.5 rounded border border-slate-800">
                <span className="text-[10px] text-slate-500 block">MAX DRAWDOWN</span>
                <span className="text-base font-bold text-rose-400">-{activeStrategy.performance.maxDrawdownPct}%</span>
                <span className="text-[10px] text-slate-500 block">Expectancy: {activeStrategy.performance.expectancyR}R</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
