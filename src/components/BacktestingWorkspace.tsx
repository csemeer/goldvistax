/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * Aurum Intelligence — Backtesting & Simulation Workspace
 * Realistic execution-cost simulation, equity curves, drawdown waterfalls, parameter tuning, and execution handoffs.
 */

import React, { useState, useEffect, useMemo } from 'react';
import { BacktestRunResult, Candle, InstrumentId, QuantitativeStrategy, Timeframe, TradePlan } from '../domain/types';
import { runBacktestSimulation, createTradePlanFromStrategy } from '../services/strategyEngine';
import {
  PlayCircle,
  TrendingUp,
  BarChart2,
  DollarSign,
  Activity,
  SlidersHorizontal,
  RotateCcw,
  Download,
  Briefcase,
  Calculator,
  CheckCircle2,
  XCircle,
  Layers,
  Dices,
  ShieldCheck,
  ShieldAlert,
  AlertTriangle,
  Scale,
  Gauge,
  Clock,
} from 'lucide-react';
import {
  runWalkForwardOptimization,
  runMonteCarloPermutation,
  calculateSessionSlippage,
} from '../services/advancedBacktestingEngine';

interface BacktestingWorkspaceProps {
  strategies: QuantitativeStrategy[];
  candles: Candle[];
  selectedStrategyId?: string;
  onSelectStrategy?: (strategyId: string) => void;
  onSelectForCFD?: (plan: TradePlan) => void;
  onExecutePaper?: (plan: TradePlan) => void;
  currentMid?: number;
  instrumentId?: InstrumentId;
}

export const BacktestingWorkspace: React.FC<BacktestingWorkspaceProps> = ({
  strategies,
  candles,
  selectedStrategyId: initialStrategyId,
  onSelectStrategy,
  onSelectForCFD,
  onExecutePaper,
  currentMid = 3950.00,
  instrumentId = 'XAUUSD',
}) => {
  const [activeTab, setActiveTab] = useState<'overview' | 'walkForward' | 'monteCarlo' | 'sessionSlippage'>('overview');
  const [selectedStrategyId, setSelectedStrategyId] = useState<string>(
    initialStrategyId || strategies[0]?.id || 'STRAT-01-MACRO-TREND'
  );
  const [timeframe, setTimeframe] = useState<Timeframe>('1h');
  const [initialCapital, setInitialCapital] = useState<number>(100000);
  const [spreadPips, setSpreadPips] = useState<number>(28);
  const [commission, setCommission] = useState<number>(7.0);

  const activeStrategy = useMemo(
    () => strategies.find((s) => s.id === selectedStrategyId) || strategies[0],
    [strategies, selectedStrategyId]
  );

  // Parameter tuning state per strategy
  const [customParams, setCustomParams] = useState<Record<string, number>>(() => {
    const initial: Record<string, number> = {};
    if (activeStrategy?.parameters) {
      Object.entries(activeStrategy.parameters).forEach(([k, v]) => {
        if (typeof v === 'number') initial[k] = v;
      });
    }
    return initial;
  });

  // Filter for trade log table
  const [tradeFilter, setTradeFilter] = useState<'ALL' | 'WINS' | 'LOSSES'>('ALL');

  const [isRunning, setIsRunning] = useState<boolean>(false);
  const [backtestResult, setBacktestResult] = useState<BacktestRunResult>(() =>
    runBacktestSimulation(
      selectedStrategyId,
      candles,
      100000,
      28,
      7.0,
      '1h',
      customParams
    )
  );

  // Advanced Phase 7 Analytical Models
  const walkForwardReport = useMemo(
    () => runWalkForwardOptimization(selectedStrategyId, candles, 5, 0.70),
    [selectedStrategyId, candles]
  );
  const monteCarloReport = useMemo(
    () => runMonteCarloPermutation(backtestResult.trades, 1000, initialCapital),
    [backtestResult.trades, initialCapital]
  );
  const [simulatedUtcHour, setSimulatedUtcHour] = useState<number>(new Date().getUTCHours());
  const [simulatedHighImpact, setSimulatedHighImpact] = useState<boolean>(false);

  const sessionSlippage = useMemo(
    () => calculateSessionSlippage(simulatedUtcHour, simulatedHighImpact),
    [simulatedUtcHour, simulatedHighImpact]
  );

  // Sync when selectedStrategyId prop changes from Strategy Lab
  useEffect(() => {
    if (initialStrategyId && initialStrategyId !== selectedStrategyId) {
      setSelectedStrategyId(initialStrategyId);
      const match = strategies.find((s) => s.id === initialStrategyId);
      if (match?.parameters) {
        const resetParams: Record<string, number> = {};
        Object.entries(match.parameters).forEach(([k, v]) => {
          if (typeof v === 'number') resetParams[k] = v;
        });
        setCustomParams(resetParams);
      }
    }
  }, [initialStrategyId, strategies]);

  // Trigger backtest whenever strategy, timeframe, or parameters update
  const executeSimulation = (
    stratId = selectedStrategyId,
    tf = timeframe,
    cap = initialCapital,
    spread = spreadPips,
    comm = commission,
    params = customParams
  ) => {
    setIsRunning(true);
    setTimeout(() => {
      const result = runBacktestSimulation(stratId, candles, cap, spread, comm, tf, params);
      setBacktestResult(result);
      setIsRunning(false);
    }, 150);
  };

  const handleStrategyChange = (newStratId: string) => {
    setSelectedStrategyId(newStratId);
    onSelectStrategy?.(newStratId);
    const match = strategies.find((s) => s.id === newStratId);
    const newParams: Record<string, number> = {};
    if (match?.parameters) {
      Object.entries(match.parameters).forEach(([k, v]) => {
        if (typeof v === 'number') newParams[k] = v;
      });
    }
    setCustomParams(newParams);
    executeSimulation(newStratId, timeframe, initialCapital, spreadPips, commission, newParams);
  };

  const handleTimeframeChange = (newTf: Timeframe) => {
    setTimeframe(newTf);
    executeSimulation(selectedStrategyId, newTf, initialCapital, spreadPips, commission, customParams);
  };

  const handleResetParams = () => {
    const defaultParams: Record<string, number> = {};
    if (activeStrategy?.parameters) {
      Object.entries(activeStrategy.parameters).forEach(([k, v]) => {
        if (typeof v === 'number') defaultParams[k] = v;
      });
    }
    setCustomParams(defaultParams);
    executeSimulation(selectedStrategyId, timeframe, initialCapital, spreadPips, commission, defaultParams);
  };

  const handleParamChange = (paramKey: string, val: number) => {
    const updated = { ...customParams, [paramKey]: val };
    setCustomParams(updated);
    executeSimulation(selectedStrategyId, timeframe, initialCapital, spreadPips, commission, updated);
  };

  // Convert active backtested strategy into an actionable TradePlan
  const activePlan = createTradePlanFromStrategy(activeStrategy, currentMid, instrumentId);

  // CSV Export
  const handleExportCSV = () => {
    if (!backtestResult.trades.length) return;
    const headers = ['Trade ID', 'Entry Time', 'Exit Time', 'Direction', 'Entry Price', 'Exit Price', 'Lots', 'Net PnL ($)', 'Return %', 'Exit Reason'];
    const rows = backtestResult.trades.map((t) => [
      t.id,
      t.entryTime,
      t.exitTime,
      t.direction,
      t.entryPrice,
      t.exitPrice,
      t.lots,
      t.pnl,
      t.pnlPct,
      t.exitReason,
    ]);
    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map((e) => e.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `Backtest_${selectedStrategyId}_${timeframe}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Equity Curve SVG calculation
  const curve = backtestResult.equityCurve;
  const minEquity = Math.min(...curve.map((p) => p.equity)) * 0.98;
  const maxEquity = Math.max(...curve.map((p) => p.equity)) * 1.02;

  const svgWidth = 800;
  const svgHeight = 220;

  const getPoints = () => {
    if (!curve.length) return '';
    return curve
      .map((p, idx) => {
        const x = (idx / (curve.length - 1)) * svgWidth;
        const y = svgHeight - ((p.equity - minEquity) / (maxEquity - minEquity)) * svgHeight;
        return `${x.toFixed(1)},${y.toFixed(1)}`;
      })
      .join(' ');
  };

  // Filtered trades
  const filteredTrades = backtestResult.trades.filter((t) => {
    if (tradeFilter === 'WINS') return t.pnl > 0;
    if (tradeFilter === 'LOSSES') return t.pnl <= 0;
    return true;
  });

  return (
    <div className="space-y-6">
      {/* Simulation Setup Bar */}
      <div className="bg-slate-900 border border-slate-800 rounded-lg p-5">
        <div className="flex flex-wrap items-center justify-between gap-4 pb-4 border-b border-slate-800">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-mono text-amber-400 uppercase tracking-wider block">
                Walk-Forward Simulation Engine
              </span>
              <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-amber-500/10 text-amber-300 border border-amber-500/30">
                ACTIVE STRATEGY: {selectedStrategyId}
              </span>
            </div>
            <h2 className="text-lg font-bold text-slate-100 mt-1">
              {activeStrategy.name} — Realistic Out-of-Sample Backtesting
            </h2>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            <button
              onClick={() => executeSimulation()}
              disabled={isRunning}
              className="flex items-center gap-2 px-4 py-2 text-xs font-semibold text-slate-950 bg-amber-400 hover:bg-amber-300 disabled:opacity-50 rounded transition-colors shadow-sm"
            >
              <PlayCircle className="w-4 h-4" />
              {isRunning ? 'Simulating...' : 'Run Walk-Forward Simulation'}
            </button>

            {onSelectForCFD && (
              <button
                onClick={() => onSelectForCFD(activePlan)}
                className="flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-slate-200 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded transition-colors"
                title="Send active strategy levels to CFD Calculator"
              >
                <Calculator className="w-3.5 h-3.5 text-amber-400" />
                CFD Sizing
              </button>
            )}

            {onExecutePaper && (
              <button
                onClick={() => onExecutePaper(activePlan)}
                className="flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-slate-200 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded transition-colors"
                title="Execute setup in Paper Portfolio"
              >
                <Briefcase className="w-3.5 h-3.5 text-emerald-400" />
                Paper Trade
              </button>
            )}
          </div>
        </div>

        {/* Control Inputs */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3 mt-4 text-xs font-mono">
          <div>
            <label className="text-slate-400 block mb-1">Target Strategy</label>
            <select
              value={selectedStrategyId}
              onChange={(e) => handleStrategyChange(e.target.value)}
              className="w-full bg-slate-950 border border-slate-700 rounded px-2.5 py-1.5 text-slate-200 focus:outline-none focus:border-amber-400"
            >
              {strategies.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.id}: {s.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="text-slate-400 block mb-1">Timeframe Horizon</label>
            <select
              value={timeframe}
              onChange={(e) => handleTimeframeChange(e.target.value as Timeframe)}
              className="w-full bg-slate-950 border border-slate-700 rounded px-2.5 py-1.5 text-slate-200 focus:outline-none focus:border-amber-400"
            >
              <option value="15m">15m (Intraday Scalp)</option>
              <option value="1h">1h (Short-Term Swing)</option>
              <option value="4h">4h (Intermediate Swing)</option>
              <option value="1D">1D (Daily Macro Trend)</option>
            </select>
          </div>

          <div>
            <label className="text-slate-400 block mb-1">Starting Capital ($)</label>
            <input
              type="number"
              value={initialCapital}
              onChange={(e) => {
                const val = Number(e.target.value);
                setInitialCapital(val);
                executeSimulation(selectedStrategyId, timeframe, val, spreadPips, commission, customParams);
              }}
              className="w-full bg-slate-950 border border-slate-700 rounded px-2.5 py-1.5 text-slate-200"
            />
          </div>

          <div>
            <label className="text-slate-400 block mb-1">Simulated Spread (pips)</label>
            <input
              type="number"
              value={spreadPips}
              onChange={(e) => {
                const val = Number(e.target.value);
                setSpreadPips(val);
                executeSimulation(selectedStrategyId, timeframe, initialCapital, val, commission, customParams);
              }}
              className="w-full bg-slate-950 border border-slate-700 rounded px-2.5 py-1.5 text-slate-200"
            />
          </div>

          <div>
            <label className="text-slate-400 block mb-1">Commission ($ / lot)</label>
            <input
              type="number"
              step="0.5"
              value={commission}
              onChange={(e) => {
                const val = Number(e.target.value);
                setCommission(val);
                executeSimulation(selectedStrategyId, timeframe, initialCapital, spreadPips, val, customParams);
              }}
              className="w-full bg-slate-950 border border-slate-700 rounded px-2.5 py-1.5 text-slate-200"
            />
          </div>
        </div>

        {/* Interactive Parameter Tuning Panel */}
        {Object.keys(customParams).length > 0 && (
          <div className="mt-4 pt-3.5 border-t border-slate-800">
            <div className="flex items-center justify-between pb-2">
              <span className="text-xs font-mono text-slate-300 font-semibold flex items-center gap-1.5">
                <SlidersHorizontal className="w-3.5 h-3.5 text-amber-400" /> Interactive Parameter Sensitivity Tuning
              </span>
              <button
                onClick={handleResetParams}
                className="flex items-center gap-1 text-[11px] font-mono text-slate-400 hover:text-amber-400 transition-colors"
                title="Reset to Strategy Catalog baseline values"
              >
                <RotateCcw className="w-3 h-3" /> Reset Defaults
              </button>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 text-xs font-mono mt-2">
              {Object.entries(customParams).map(([paramKey, paramVal]) => (
                <div key={paramKey} className="bg-slate-950 p-2.5 rounded border border-slate-800">
                  <div className="flex items-center justify-between text-[11px] mb-1">
                    <span className="text-slate-400 uppercase">{paramKey}</span>
                    <span className="text-amber-300 font-bold">{paramVal}</span>
                  </div>
                  <input
                    type="number"
                    step={paramVal <= 5 ? '0.1' : '1'}
                    value={paramVal}
                    onChange={(e) => handleParamChange(paramKey, parseFloat(e.target.value) || 0)}
                    className="w-full bg-slate-900 border border-slate-700 rounded px-2 py-1 text-slate-200 text-xs"
                  />
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Sub-Tab Navigation Bar */}
      <div className="flex flex-wrap items-center gap-2 border-b border-slate-800 pb-3">
        <button
          onClick={() => setActiveTab('overview')}
          className={`flex items-center gap-2 px-3.5 py-2 text-xs font-semibold rounded transition-colors ${
            activeTab === 'overview'
              ? 'bg-amber-400/10 text-amber-300 border border-amber-400/30 shadow-sm'
              : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
          }`}
        >
          <Activity className="w-3.5 h-3.5" />
          Overview & Equity Curve
        </button>
        <button
          onClick={() => setActiveTab('walkForward')}
          className={`flex items-center gap-2 px-3.5 py-2 text-xs font-semibold rounded transition-colors ${
            activeTab === 'walkForward'
              ? 'bg-amber-400/10 text-amber-300 border border-amber-400/30 shadow-sm'
              : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
          }`}
        >
          <Layers className="w-3.5 h-3.5 text-amber-400" />
          Walk-Forward Optimization
          <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-amber-500/10 text-amber-300 border border-amber-500/30">
            {walkForwardReport.overallWalkForwardEfficiencyPct.toFixed(1)}% WFE
          </span>
        </button>
        <button
          onClick={() => setActiveTab('monteCarlo')}
          className={`flex items-center gap-2 px-3.5 py-2 text-xs font-semibold rounded transition-colors ${
            activeTab === 'monteCarlo'
              ? 'bg-amber-400/10 text-amber-300 border border-amber-400/30 shadow-sm'
              : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
          }`}
        >
          <Dices className="w-3.5 h-3.5 text-blue-400" />
          Monte Carlo Permutation
          <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-blue-500/10 text-blue-300 border border-blue-500/30">
            1k Boots
          </span>
        </button>
        <button
          onClick={() => setActiveTab('sessionSlippage')}
          className={`flex items-center gap-2 px-3.5 py-2 text-xs font-semibold rounded transition-colors ${
            activeTab === 'sessionSlippage'
              ? 'bg-amber-400/10 text-amber-300 border border-amber-400/30 shadow-sm'
              : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
          }`}
        >
          <Gauge className="w-3.5 h-3.5 text-emerald-400" />
          Session Slippage Profile
          <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-300 border border-emerald-500/30">
            +{sessionSlippage.totalExecutionCostPips} pips
          </span>
        </button>
      </div>

      {activeTab === 'overview' && (
        <div className="space-y-6">
          {/* KPI Performance Metrics */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 font-mono tabular-nums">
        <div className="bg-slate-900 border border-slate-800 p-3.5 rounded-lg shadow-sm">
          <span className="text-[10px] text-slate-500 uppercase block">Net Profit</span>
          <span
            className={`text-xl font-bold block mt-1 ${
              backtestResult.netProfit >= 0 ? 'text-emerald-400' : 'text-rose-400'
            }`}
          >
            {backtestResult.netProfit >= 0 ? '+' : ''}${backtestResult.netProfit.toLocaleString()}
          </span>
          <span className="text-[10px] text-slate-400 block">
            {backtestResult.netProfitPct >= 0 ? '+' : ''}{backtestResult.netProfitPct}% Total Return
          </span>
        </div>

        <div className="bg-slate-900 border border-slate-800 p-3.5 rounded-lg shadow-sm">
          <span className="text-[10px] text-slate-500 uppercase block">Win Rate</span>
          <span className="text-xl font-bold text-slate-100 block mt-1">
            {backtestResult.winRatePct}%
          </span>
          <span className="text-[10px] text-slate-500 block">
            {backtestResult.winningTrades}W / {backtestResult.losingTrades}L ({backtestResult.totalTrades} Trades)
          </span>
        </div>

        <div className="bg-slate-900 border border-slate-800 p-3.5 rounded-lg shadow-sm">
          <span className="text-[10px] text-slate-500 uppercase block">Profit Factor</span>
          <span className="text-xl font-bold text-amber-400 block mt-1">
            {backtestResult.profitFactor}
          </span>
          <span className="text-[10px] text-slate-500 block">Gross Win / Loss</span>
        </div>

        <div className="bg-slate-900 border border-slate-800 p-3.5 rounded-lg shadow-sm">
          <span className="text-[10px] text-slate-500 uppercase block">Sharpe Ratio</span>
          <span className="text-xl font-bold text-slate-100 block mt-1">
            {backtestResult.sharpeRatio}
          </span>
          <span className="text-[10px] text-slate-500 block">Sortino: {backtestResult.sortinoRatio}</span>
        </div>

        <div className="bg-slate-900 border border-slate-800 p-3.5 rounded-lg shadow-sm">
          <span className="text-[10px] text-slate-500 uppercase block">Max Drawdown</span>
          <span className="text-xl font-bold text-rose-400 block mt-1">
            -{backtestResult.maxDrawdownPct}%
          </span>
          <span className="text-[10px] text-slate-500 block">Recovery: {backtestResult.maxDrawdownDurationDays}d</span>
        </div>

        <div className="bg-slate-900 border border-slate-800 p-3.5 rounded-lg shadow-sm">
          <span className="text-[10px] text-slate-500 uppercase block">Execution Costs</span>
          <span className="text-xl font-bold text-slate-300 block mt-1">
            ${backtestResult.totalCommissionsAndSpread.toFixed(2)}
          </span>
          <span className="text-[10px] text-slate-500 block">Spread + Comm Paid</span>
        </div>
      </div>

      {/* SVG Equity Curve Chart */}
      <div className="bg-slate-900 border border-slate-800 rounded-lg p-5">
        <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-slate-800 text-xs font-mono">
          <div className="flex items-center gap-2">
            <TrendingUp className="w-4 h-4 text-emerald-400" />
            <h3 className="font-semibold text-slate-200">
              Walk-Forward Equity Growth Curve ({backtestResult.strategyName})
            </h3>
            <span className="text-[10px] px-2 py-0.5 rounded bg-slate-800 text-slate-400 border border-slate-700">
              {timeframe} Timeframe
            </span>
          </div>
          <span className="text-slate-400">
            Ending Equity: <strong className="text-slate-100">${backtestResult.endingCapital.toLocaleString()}</strong>
          </span>
        </div>

        <div className="mt-4 relative">
          <svg viewBox={`0 0 ${svgWidth} ${svgHeight}`} className="w-full h-44 block">
            {/* Horizontal Guide Lines */}
            {[0.25, 0.5, 0.75].map((ratio) => {
              const y = svgHeight * ratio;
              return (
                <line
                  key={ratio}
                  x1={0}
                  y1={y}
                  x2={svgWidth}
                  y2={y}
                  stroke="rgba(148, 163, 184, 0.08)"
                  strokeDasharray="2 2"
                />
              );
            })}

            {/* Baseline Capital Line */}
            <line
              x1={0}
              y1={svgHeight - ((initialCapital - minEquity) / (maxEquity - minEquity)) * svgHeight}
              x2={svgWidth}
              y2={svgHeight - ((initialCapital - minEquity) / (maxEquity - minEquity)) * svgHeight}
              stroke="rgba(234, 179, 8, 0.3)"
              strokeDasharray="4 3"
            />

            {/* Polyline Equity Curve */}
            <polyline
              fill="none"
              stroke="#10b981"
              strokeWidth="2.5"
              points={getPoints()}
            />
          </svg>
        </div>
      </div>

      {/* Trade Log Table */}
      <div className="bg-slate-900 border border-slate-800 rounded-lg overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-800 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <h3 className="text-sm font-semibold text-slate-100">
              Simulated Execution Log ({backtestResult.trades.length} Transactions)
            </h3>
            {/* Filter Buttons */}
            <div className="flex items-center bg-slate-950 p-0.5 rounded border border-slate-800 text-[10px] font-mono">
              <button
                onClick={() => setTradeFilter('ALL')}
                className={`px-2 py-0.5 rounded ${tradeFilter === 'ALL' ? 'bg-slate-800 text-slate-200 font-bold' : 'text-slate-500'}`}
              >
                All ({backtestResult.trades.length})
              </button>
              <button
                onClick={() => setTradeFilter('WINS')}
                className={`px-2 py-0.5 rounded ${tradeFilter === 'WINS' ? 'bg-emerald-500/20 text-emerald-300 font-bold' : 'text-slate-500'}`}
              >
                Wins ({backtestResult.winningTrades})
              </button>
              <button
                onClick={() => setTradeFilter('LOSSES')}
                className={`px-2 py-0.5 rounded ${tradeFilter === 'LOSSES' ? 'bg-rose-500/20 text-rose-300 font-bold' : 'text-slate-500'}`}
              >
                Losses ({backtestResult.losingTrades})
              </button>
            </div>
          </div>

          <button
            onClick={handleExportCSV}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-mono text-slate-300 hover:text-slate-100 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded transition-colors"
          >
            <Download className="w-3.5 h-3.5" />
            Export CSV
          </button>
        </div>

        <div className="overflow-x-auto max-h-80 overflow-y-auto">
          <table className="w-full text-xs text-left font-mono tabular-nums">
            <thead className="bg-slate-950 text-slate-400 uppercase text-[10px] sticky top-0 border-b border-slate-800">
              <tr>
                <th className="px-4 py-2.5">Trade ID</th>
                <th className="px-4 py-2.5">Entry Time</th>
                <th className="px-4 py-2.5">Exit Time</th>
                <th className="px-4 py-2.5">Side</th>
                <th className="px-4 py-2.5 text-right">Entry ($)</th>
                <th className="px-4 py-2.5 text-right">Exit ($)</th>
                <th className="px-4 py-2.5 text-right">Lots</th>
                <th className="px-4 py-2.5 text-right">Net P&L ($)</th>
                <th className="px-4 py-2.5 text-center">Exit Reason</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {filteredTrades.map((tr) => {
                const isWin = tr.pnl > 0;
                return (
                  <tr key={tr.id} className="hover:bg-slate-800/30">
                    <td className="px-4 py-2.5 text-slate-300 font-bold">{tr.id}</td>
                    <td className="px-4 py-2.5 text-slate-400">{tr.entryTime.slice(0, 16).replace('T', ' ')}</td>
                    <td className="px-4 py-2.5 text-slate-400">{tr.exitTime.slice(0, 16).replace('T', ' ')}</td>
                    <td className="px-4 py-2.5">
                      <span
                        className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                          tr.direction === 'BUY'
                            ? 'bg-emerald-500/10 text-emerald-400'
                            : 'bg-rose-500/10 text-rose-400'
                        }`}
                      >
                        {tr.direction}
                      </span>
                    </td>
                    <td className="px-4 py-2.5 text-right">${tr.entryPrice.toFixed(2)}</td>
                    <td className="px-4 py-2.5 text-right">${tr.exitPrice.toFixed(2)}</td>
                    <td className="px-4 py-2.5 text-right text-slate-300">{tr.lots}</td>
                    <td
                      className={`px-4 py-2.5 text-right font-bold ${
                        isWin ? 'text-emerald-400' : 'text-rose-400'
                      }`}
                    >
                      {isWin ? '+' : ''}${tr.pnl.toFixed(2)}
                    </td>
                    <td className="px-4 py-2.5 text-center">
                      <span
                        className={`px-2 py-0.5 rounded text-[10px] ${
                          tr.exitReason === 'TARGET'
                            ? 'bg-emerald-500/10 text-emerald-300 border border-emerald-500/30'
                            : tr.exitReason === 'STOP'
                            ? 'bg-rose-500/10 text-rose-300 border border-rose-500/30'
                            : 'bg-slate-800 text-slate-300'
                        }`}
                      >
                        {tr.exitReason}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )}

      {/* Walk-Forward k-Fold Optimization Tab */}
      {activeTab === 'walkForward' && (
        <div className="space-y-6">
          {/* Header Card */}
          <div className="bg-slate-900 border border-slate-800 rounded-lg p-5">
            <div className="flex flex-wrap items-center justify-between gap-4 pb-4 border-b border-slate-800">
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-mono text-amber-400 uppercase tracking-wider block">
                    Out-of-Sample Robustness Engine
                  </span>
                  <span
                    className={`text-[10px] font-mono px-2 py-0.5 rounded border font-semibold ${
                      walkForwardReport.stabilityCertification === 'OVERFITTING_RESISTANT'
                        ? 'bg-emerald-500/10 text-emerald-300 border-emerald-500/30'
                        : walkForwardReport.stabilityCertification === 'ACCEPTABLE_ROBUST'
                        ? 'bg-amber-500/10 text-amber-300 border-amber-500/30'
                        : 'bg-rose-500/10 text-rose-300 border-rose-500/30'
                    }`}
                  >
                    {walkForwardReport.stabilityCertification.replace(/_/g, ' ')}
                  </span>
                </div>
                <h3 className="text-lg font-bold text-slate-100 mt-1">
                  Walk-Forward Analysis (WFA) — {walkForwardReport.foldsCount}-Fold Rolling Evaluation
                </h3>
                <p className="text-xs text-slate-400 mt-1">
                  {walkForwardReport.summary}
                </p>
              </div>

              <div className="flex items-center gap-3 font-mono">
                <div className="text-right">
                  <span className="text-[10px] text-slate-500 uppercase block">Overall WFE %</span>
                  <span
                    className={`text-2xl font-bold ${
                      walkForwardReport.overallWalkForwardEfficiencyPct >= 70
                        ? 'text-emerald-400'
                        : walkForwardReport.overallWalkForwardEfficiencyPct >= 50
                        ? 'text-amber-400'
                        : 'text-rose-400'
                    }`}
                  >
                    {walkForwardReport.overallWalkForwardEfficiencyPct.toFixed(1)}%
                  </span>
                </div>
              </div>
            </div>

            {/* Metrics Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-4 font-mono tabular-nums">
              <div className="bg-slate-950 p-3 rounded border border-slate-800">
                <span className="text-[10px] text-slate-500 uppercase block">In-Sample / OOS Split</span>
                <span className="text-base font-bold text-slate-200 mt-0.5 block">
                  {Math.round(walkForwardReport.inSampleSplitRatio * 100)}% / {Math.round((1 - walkForwardReport.inSampleSplitRatio) * 100)}%
                </span>
                <span className="text-[10px] text-slate-400">Rolling evaluation window</span>
              </div>
              <div className="bg-slate-950 p-3 rounded border border-slate-800">
                <span className="text-[10px] text-slate-500 uppercase block">Total Folds Evaluated</span>
                <span className="text-base font-bold text-amber-400 mt-0.5 block">
                  {walkForwardReport.foldsCount} Folds
                </span>
                <span className="text-[10px] text-slate-400">Sequential k-fold partitions</span>
              </div>
              <div className="bg-slate-950 p-3 rounded border border-slate-800">
                <span className="text-[10px] text-slate-500 uppercase block">Pardo Robustness Standard</span>
                <span className="text-base font-bold text-emerald-400 mt-0.5 block">
                  &gt;= 70.0% WFE
                </span>
                <span className="text-[10px] text-slate-400">Min institutional threshold</span>
              </div>
              <div className="bg-slate-950 p-3 rounded border border-slate-800">
                <span className="text-[10px] text-slate-500 uppercase block">Model Status</span>
                <div className="flex items-center gap-1.5 mt-0.5">
                  <ShieldCheck className="w-4 h-4 text-amber-400" />
                  <span className="text-xs font-bold text-amber-400">Simulated WFA Heuristic</span>
                </div>
                <span className="text-[10px] text-slate-400">Not independent certification</span>
              </div>
            </div>
          </div>

          {/* Folds Table */}
          <div className="bg-slate-900 border border-slate-800 rounded-lg p-5">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800 mb-4">
              <div>
                <h4 className="text-sm font-semibold text-slate-100">
                  Walk-Forward Fold Performance Ledger
                </h4>
                <p className="text-xs text-slate-400">
                  Comparison between In-Sample (Optimization) and Out-of-Sample (Blind Forward Testing) across all folds.
                </p>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs font-mono">
                <thead className="bg-slate-950/60 text-slate-400 uppercase text-[10px] tracking-wider border-b border-slate-800">
                  <tr>
                    <th className="px-3 py-2.5">Fold</th>
                    <th className="px-3 py-2.5">In-Sample Window</th>
                    <th className="px-3 py-2.5">OOS Window</th>
                    <th className="px-3 py-2.5 text-right">IS Trades</th>
                    <th className="px-3 py-2.5 text-right">OOS Trades</th>
                    <th className="px-3 py-2.5 text-right">IS PF</th>
                    <th className="px-3 py-2.5 text-right">OOS PF</th>
                    <th className="px-3 py-2.5 text-right">IS Win%</th>
                    <th className="px-3 py-2.5 text-right">OOS Win%</th>
                    <th className="px-3 py-2.5 text-right">WFE %</th>
                    <th className="px-3 py-2.5 text-center">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800 tabular-nums">
                  {walkForwardReport.folds.map((fold) => (
                    <tr key={fold.foldIndex} className="hover:bg-slate-800/40 transition-colors">
                      <td className="px-3 py-2.5 font-bold text-amber-400">Fold #{fold.foldIndex}</td>
                      <td className="px-3 py-2.5 text-slate-300">{fold.inSampleRange}</td>
                      <td className="px-3 py-2.5 text-slate-300">{fold.outOfSampleRange}</td>
                      <td className="px-3 py-2.5 text-right text-slate-400">{fold.inSampleTradesCount}</td>
                      <td className="px-3 py-2.5 text-right font-semibold text-slate-200">{fold.outOfSampleTradesCount}</td>
                      <td className="px-3 py-2.5 text-right text-slate-400">{fold.inSampleProfitFactor.toFixed(2)}</td>
                      <td className="px-3 py-2.5 text-right font-bold text-amber-300">{fold.outOfSampleProfitFactor.toFixed(2)}</td>
                      <td className="px-3 py-2.5 text-right text-slate-400">{fold.inSampleWinRatePct.toFixed(1)}%</td>
                      <td className="px-3 py-2.5 text-right font-semibold text-slate-200">{fold.outOfSampleWinRatePct.toFixed(1)}%</td>
                      <td className="px-3 py-2.5 text-right font-bold">
                        <span
                          className={
                            fold.foldEfficiencyPct >= 70
                              ? 'text-emerald-400'
                              : fold.foldEfficiencyPct >= 50
                              ? 'text-amber-400'
                              : 'text-rose-400'
                          }
                        >
                          {fold.foldEfficiencyPct.toFixed(1)}%
                        </span>
                      </td>
                      <td className="px-3 py-2.5 text-center">
                        <span
                          className={`px-2 py-0.5 rounded text-[10px] font-semibold ${
                            fold.status === 'STABLE_ROBUST'
                              ? 'bg-emerald-500/10 text-emerald-300 border border-emerald-500/30'
                              : fold.status === 'MILD_OVERFIT'
                              ? 'bg-amber-500/10 text-amber-300 border border-amber-500/30'
                              : 'bg-rose-500/10 text-rose-300 border border-rose-500/30'
                          }`}
                        >
                          {fold.status.replace(/_/g, ' ')}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="mt-4 p-3 bg-slate-950 rounded border border-slate-800 text-xs text-slate-400 space-y-1">
              <div className="font-semibold text-slate-200 flex items-center gap-1.5">
                <ShieldCheck className="w-3.5 h-3.5 text-amber-400" />
                Walk-Forward Heuristic Methodology Disclosure:
              </div>
              <p>
                Walk-Forward Efficiency is formulated as{' '}
                <span className="font-mono text-amber-300 font-semibold">WFE = (Annualized Return_OOS / Annualized Return_IS) * 100%</span>.
                Values &gt;= 70% reflect simulated out-of-sample stability under heuristic haircut assumptions and do not constitute independent profitability or production certification.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Monte Carlo Bootstrap Permutation Tab */}
      {activeTab === 'monteCarlo' && (
        <div className="space-y-6">
          {/* Header Card */}
          <div className="bg-slate-900 border border-slate-800 rounded-lg p-5">
            <div className="flex flex-wrap items-center justify-between gap-4 pb-4 border-b border-slate-800">
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-mono text-amber-400 uppercase tracking-wider block">
                    Sequence Risk Permutation Engine
                  </span>
                  <span
                    className={`text-[10px] font-mono px-2 py-0.5 rounded border font-semibold ${
                      monteCarloReport.confidenceIntervals.riskOfRuinRating === 'LOW_RISK'
                        ? 'bg-emerald-500/10 text-emerald-300 border-emerald-500/30'
                        : monteCarloReport.confidenceIntervals.riskOfRuinRating === 'ACCEPTABLE'
                        ? 'bg-blue-500/10 text-blue-300 border-blue-500/30'
                        : monteCarloReport.confidenceIntervals.riskOfRuinRating === 'ELEVATED'
                        ? 'bg-amber-500/10 text-amber-300 border-amber-500/30'
                        : 'bg-rose-500/10 text-rose-300 border-rose-500/30'
                    }`}
                  >
                    {monteCarloReport.confidenceIntervals.riskOfRuinRating.replace(/_/g, ' ')}
                  </span>
                </div>
                <h3 className="text-lg font-bold text-slate-100 mt-1">
                  Monte Carlo Trade Sequence Permutation ({monteCarloReport.iterationsCount.toLocaleString()} Iterations)
                </h3>
                <p className="text-xs text-slate-400 mt-1">
                  {monteCarloReport.methodologyNote}
                </p>
              </div>

              <div className="flex items-center gap-4 font-mono tabular-nums">
                <div className="text-right">
                  <span className="text-[10px] text-slate-500 uppercase block">Historical Max DD</span>
                  <span className="text-lg font-bold text-slate-300">
                    -{monteCarloReport.originalMaxDrawdownPct.toFixed(1)}%
                  </span>
                </div>
                <div className="text-right">
                  <span className="text-[10px] text-slate-500 uppercase block">95% Confidence DD</span>
                  <span className="text-2xl font-bold text-rose-400">
                    -{monteCarloReport.confidenceIntervals.percentile95DrawdownPct.toFixed(1)}%
                  </span>
                </div>
              </div>
            </div>

            {/* Confidence Interval Cards */}
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 mt-4 font-mono tabular-nums">
              <div className="bg-slate-950 p-3 rounded border border-slate-800">
                <span className="text-[10px] text-slate-500 uppercase block">50th Percentile (Median)</span>
                <span className="text-lg font-bold text-slate-200 mt-0.5 block">
                  -{monteCarloReport.confidenceIntervals.percentile50DrawdownPct.toFixed(1)}%
                </span>
                <span className="text-[10px] text-slate-400">Expected drawdown</span>
              </div>

              <div className="bg-slate-950 p-3 rounded border border-slate-800">
                <span className="text-[10px] text-slate-500 uppercase block">90% Confidence DD</span>
                <span className="text-lg font-bold text-amber-300 mt-0.5 block">
                  -{monteCarloReport.confidenceIntervals.percentile90DrawdownPct.toFixed(1)}%
                </span>
                <span className="text-[10px] text-slate-400">9-in-10 worst case</span>
              </div>

              <div className="bg-slate-950 p-3 rounded border border-slate-800">
                <span className="text-[10px] text-slate-500 uppercase block">95% Institutional VaR</span>
                <span className="text-lg font-bold text-rose-400 mt-0.5 block">
                  -{monteCarloReport.confidenceIntervals.percentile95DrawdownPct.toFixed(1)}%
                </span>
                <span className="text-[10px] text-slate-400">Standard risk budget</span>
              </div>

              <div className="bg-slate-950 p-3 rounded border border-slate-800">
                <span className="text-[10px] text-slate-500 uppercase block">99% Tail Risk Stress</span>
                <span className="text-lg font-bold text-rose-500 mt-0.5 block">
                  -{monteCarloReport.confidenceIntervals.percentile99DrawdownPct.toFixed(1)}%
                </span>
                <span className="text-[10px] text-slate-400">Extreme adverse path</span>
              </div>

              <div className="bg-slate-950 p-3 rounded border border-slate-800">
                <span className="text-[10px] text-slate-500 uppercase block">Probability of Ruin</span>
                <span
                  className={`text-lg font-bold mt-0.5 block ${
                    monteCarloReport.confidenceIntervals.probabilityOfRuinPct === 0
                      ? 'text-emerald-400'
                      : monteCarloReport.confidenceIntervals.probabilityOfRuinPct < 2
                      ? 'text-amber-400'
                      : 'text-rose-400'
                  }`}
                >
                  {monteCarloReport.confidenceIntervals.probabilityOfRuinPct.toFixed(2)}%
                </span>
                <span className="text-[10px] text-slate-400">&gt;20% account depletion</span>
              </div>

              <div className="bg-slate-950 p-3 rounded border border-slate-800">
                <span className="text-[10px] text-slate-500 uppercase block">Max Consecutive Losses</span>
                <span className="text-lg font-bold text-amber-400 mt-0.5 block">
                  {monteCarloReport.confidenceIntervals.expectedMaxConsecutiveLosses} Trades
                </span>
                <span className="text-[10px] text-slate-400">Expected clustering</span>
              </div>
            </div>
          </div>

          {/* Simulation Paths Sample Table */}
          <div className="bg-slate-900 border border-slate-800 rounded-lg p-5">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800 mb-4">
              <div>
                <h4 className="text-sm font-semibold text-slate-100">
                  Bootstrap Sample Paths ({monteCarloReport.simulationPathsPreview.length} Representative Iterations)
                </h4>
                <p className="text-xs text-slate-400">
                  Randomized trade execution orders generated through replacement resampling to test path dependency.
                </p>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs font-mono">
                <thead className="bg-slate-950/60 text-slate-400 uppercase text-[10px] tracking-wider border-b border-slate-800">
                  <tr>
                    <th className="px-4 py-2.5">Iteration #</th>
                    <th className="px-4 py-2.5 text-right">Terminal Equity</th>
                    <th className="px-4 py-2.5 text-right">Net Profit</th>
                    <th className="px-4 py-2.5 text-right">Simulated Max DD</th>
                    <th className="px-4 py-2.5 text-center">Risk Assessment</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800 tabular-nums">
                  {monteCarloReport.simulationPathsPreview.map((path) => {
                    const profit = path.terminalEquity - initialCapital;
                    return (
                      <tr key={path.iteration} className="hover:bg-slate-800/40 transition-colors">
                        <td className="px-4 py-2.5 text-slate-300">Run #{path.iteration}</td>
                        <td className="px-4 py-2.5 text-right font-bold text-slate-100">
                          ${path.terminalEquity.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </td>
                        <td
                          className={`px-4 py-2.5 text-right font-semibold ${
                            profit >= 0 ? 'text-emerald-400' : 'text-rose-400'
                          }`}
                        >
                          {profit >= 0 ? '+' : ''}${profit.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </td>
                        <td className="px-4 py-2.5 text-right font-semibold text-rose-400">
                          -{path.maxDrawdownPct.toFixed(2)}%
                        </td>
                        <td className="px-4 py-2.5 text-center">
                          <span
                            className={`px-2 py-0.5 rounded text-[10px] ${
                              path.maxDrawdownPct < 8
                                ? 'bg-emerald-500/10 text-emerald-300 border border-emerald-500/30'
                                : path.maxDrawdownPct < 15
                                ? 'bg-amber-500/10 text-amber-300 border border-amber-500/30'
                                : 'bg-rose-500/10 text-rose-300 border border-rose-500/30'
                            }`}
                          >
                            {path.maxDrawdownPct < 8 ? 'SAFE' : path.maxDrawdownPct < 15 ? 'MODERATE' : 'SEVERE DD'}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Session Slippage Profile Tab */}
      {activeTab === 'sessionSlippage' && (
        <div className="space-y-6">
          {/* Interactive Session Testing Bar */}
          <div className="bg-slate-900 border border-slate-800 rounded-lg p-5">
            <div className="flex flex-wrap items-center justify-between gap-4 pb-4 border-b border-slate-800">
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-mono text-amber-400 uppercase tracking-wider block">
                    Execution Liquidity Calibrator
                  </span>
                  <span
                    className={`text-[10px] font-mono px-2 py-0.5 rounded border font-semibold ${
                      sessionSlippage.liquidityTier === 'MAXIMUM_LIQUIDITY'
                        ? 'bg-emerald-500/10 text-emerald-300 border-emerald-500/30'
                        : sessionSlippage.liquidityTier === 'NORMAL'
                        ? 'bg-blue-500/10 text-blue-300 border-blue-500/30'
                        : sessionSlippage.liquidityTier === 'COMPRESSED'
                        ? 'bg-amber-500/10 text-amber-300 border-amber-500/30'
                        : 'bg-rose-500/10 text-rose-300 border-rose-500/30'
                    }`}
                  >
                    {sessionSlippage.liquidityTier.replace(/_/g, ' ')}
                  </span>
                </div>
                <h3 className="text-lg font-bold text-slate-100 mt-1">
                  Session Liquidity &amp; Friction Model — {sessionSlippage.sessionName.replace(/_/g, ' ')}
                </h3>
                <p className="text-xs text-slate-400 mt-1">
                  {sessionSlippage.modelingNote}
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-4">
                <div className="bg-slate-950 px-3 py-2 rounded border border-slate-800 flex items-center gap-3">
                  <Clock className="w-4 h-4 text-amber-400" />
                  <div>
                    <span className="text-[10px] text-slate-500 block uppercase font-mono">Test UTC Hour</span>
                    <select
                      value={simulatedUtcHour}
                      onChange={(e) => setSimulatedUtcHour(parseInt(e.target.value, 10))}
                      className="bg-transparent text-xs font-mono text-slate-100 font-bold focus:outline-none cursor-pointer"
                    >
                      {Array.from({ length: 24 }).map((_, h) => (
                        <option key={h} value={h} className="bg-slate-900 text-slate-200">
                          {h.toString().padStart(2, '0')}:00 UTC
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <button
                  onClick={() => setSimulatedHighImpact(!simulatedHighImpact)}
                  className={`flex items-center gap-2 px-3 py-2 text-xs font-semibold rounded border transition-colors ${
                    simulatedHighImpact
                      ? 'bg-rose-500/20 text-rose-300 border-rose-500/40 shadow-sm'
                      : 'bg-slate-800 text-slate-400 border-slate-700 hover:text-slate-200'
                  }`}
                >
                  <AlertTriangle className="w-3.5 h-3.5 text-rose-400" />
                  {simulatedHighImpact ? 'High-Impact Shock Active' : 'Simulate Event Shock'}
                </button>
              </div>
            </div>

            {/* Friction Metrics Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-4 font-mono tabular-nums">
              <div className="bg-slate-950 p-3 rounded border border-slate-800">
                <span className="text-[10px] text-slate-500 uppercase block">Base Bid/Ask Spread</span>
                <span className="text-xl font-bold text-slate-100 mt-0.5 block">
                  {sessionSlippage.baseSpreadPips} pips
                </span>
                <span className="text-[10px] text-slate-400">${(sessionSlippage.baseSpreadPips * 10).toFixed(0)} / std lot</span>
              </div>

              <div className="bg-slate-950 p-3 rounded border border-slate-800">
                <span className="text-[10px] text-slate-500 uppercase block">Slippage Penalty</span>
                <span className="text-xl font-bold text-amber-400 mt-0.5 block">
                  +{sessionSlippage.slippagePenaltyPips} pips
                </span>
                <span className="text-[10px] text-slate-400">Order queue latency</span>
              </div>

              <div className="bg-slate-950 p-3 rounded border border-slate-800">
                <span className="text-[10px] text-slate-500 uppercase block">Total Execution Friction</span>
                <span className="text-xl font-bold text-rose-400 mt-0.5 block">
                  {sessionSlippage.totalExecutionCostPips} pips
                </span>
                <span className="text-[10px] text-slate-400">${(sessionSlippage.totalExecutionCostPips * 10).toFixed(0)} total drag</span>
              </div>

              <div className="bg-slate-950 p-3 rounded border border-slate-800">
                <span className="text-[10px] text-slate-500 uppercase block">Adverse Excursion Risk</span>
                <span
                  className={`text-xl font-bold mt-0.5 block ${
                    sessionSlippage.adverseExcursionRisk === 'MINIMAL'
                      ? 'text-emerald-400'
                      : sessionSlippage.adverseExcursionRisk === 'NORMAL'
                      ? 'text-blue-400'
                      : sessionSlippage.adverseExcursionRisk === 'ELEVATED'
                      ? 'text-amber-400'
                      : 'text-rose-400'
                  }`}
                >
                  {sessionSlippage.adverseExcursionRisk}
                </span>
                <span className="text-[10px] text-slate-400">Stop-out probability</span>
              </div>
            </div>
          </div>

          {/* Institutional Liquidity Schedule Matrix */}
          <div className="bg-slate-900 border border-slate-800 rounded-lg p-5">
            <h4 className="text-sm font-semibold text-slate-100 mb-1">
              Global Interbank Gold Session Friction Schedule
            </h4>
            <p className="text-xs text-slate-400 mb-4">
              Benchmark comparison of execution friction across trading windows for 1.0 Standard Lot (100 oz XAU/USD).
            </p>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs font-mono">
                <thead className="bg-slate-950/60 text-slate-400 uppercase text-[10px] tracking-wider border-b border-slate-800">
                  <tr>
                    <th className="px-4 py-2.5">Session / Regime</th>
                    <th className="px-4 py-2.5">UTC Window</th>
                    <th className="px-4 py-2.5">Liquidity Tier</th>
                    <th className="px-4 py-2.5 text-right">Base Spread</th>
                    <th className="px-4 py-2.5 text-right">Slippage</th>
                    <th className="px-4 py-2.5 text-right">Total Friction</th>
                    <th className="px-4 py-2.5 text-right">Dollar Drag / Lot</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800 tabular-nums">
                  <tr className="hover:bg-slate-800/40 transition-colors">
                    <td className="px-4 py-2.5 font-bold text-emerald-400">London / New York Overlap</td>
                    <td className="px-4 py-2.5 text-slate-300">13:00 – 17:00 UTC</td>
                    <td className="px-4 py-2.5 text-emerald-300">MAXIMUM</td>
                    <td className="px-4 py-2.5 text-right text-slate-400">20 pips</td>
                    <td className="px-4 py-2.5 text-right text-slate-400">+0.8 pips</td>
                    <td className="px-4 py-2.5 text-right font-bold text-emerald-400">20.8 pips</td>
                    <td className="px-4 py-2.5 text-right text-slate-200 font-semibold">$208.00</td>
                  </tr>
                  <tr className="hover:bg-slate-800/40 transition-colors">
                    <td className="px-4 py-2.5 font-bold text-blue-400">New York Afternoon</td>
                    <td className="px-4 py-2.5 text-slate-300">17:00 – 21:00 UTC</td>
                    <td className="px-4 py-2.5 text-blue-300">NORMAL</td>
                    <td className="px-4 py-2.5 text-right text-slate-400">24 pips</td>
                    <td className="px-4 py-2.5 text-right text-slate-400">+1.2 pips</td>
                    <td className="px-4 py-2.5 text-right font-bold text-blue-400">25.2 pips</td>
                    <td className="px-4 py-2.5 text-right text-slate-200 font-semibold">$252.00</td>
                  </tr>
                  <tr className="hover:bg-slate-800/40 transition-colors">
                    <td className="px-4 py-2.5 font-bold text-amber-400">Asian Trading Session</td>
                    <td className="px-4 py-2.5 text-slate-300">00:00 – 08:00 UTC</td>
                    <td className="px-4 py-2.5 text-amber-300">COMPRESSED</td>
                    <td className="px-4 py-2.5 text-right text-slate-400">28 pips</td>
                    <td className="px-4 py-2.5 text-right text-slate-400">+1.8 pips</td>
                    <td className="px-4 py-2.5 text-right font-bold text-amber-400">29.8 pips</td>
                    <td className="px-4 py-2.5 text-right text-slate-200 font-semibold">$298.00</td>
                  </tr>
                  <tr className="hover:bg-slate-800/40 transition-colors">
                    <td className="px-4 py-2.5 font-bold text-rose-400">Daily Rollover Gap</td>
                    <td className="px-4 py-2.5 text-slate-300">21:45 – 22:30 UTC</td>
                    <td className="px-4 py-2.5 text-rose-300">COMPRESSED/DRY</td>
                    <td className="px-4 py-2.5 text-right text-slate-400">42 pips</td>
                    <td className="px-4 py-2.5 text-right text-slate-400">+4.0 pips</td>
                    <td className="px-4 py-2.5 text-right font-bold text-rose-400">46.0 pips</td>
                    <td className="px-4 py-2.5 text-right text-slate-200 font-semibold">$460.00</td>
                  </tr>
                  <tr className="hover:bg-slate-800/40 transition-colors bg-rose-950/20">
                    <td className="px-4 py-2.5 font-bold text-rose-300 flex items-center gap-1.5">
                      <AlertTriangle className="w-3.5 h-3.5 text-rose-400" />
                      Macro Event Shock (NFP/FOMC/CPI)
                    </td>
                    <td className="px-4 py-2.5 text-slate-300">Release &plusmn; 5m</td>
                    <td className="px-4 py-2.5 text-rose-400 font-bold">EXTREME DRY UP</td>
                    <td className="px-4 py-2.5 text-right text-slate-400">45 pips</td>
                    <td className="px-4 py-2.5 text-right text-rose-400">+8.5 pips</td>
                    <td className="px-4 py-2.5 text-right font-bold text-rose-300">53.5 pips</td>
                    <td className="px-4 py-2.5 text-right text-rose-300 font-bold">$535.00</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
