/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * Aurum Intelligence — Quantitative Strategy Lab
 * 10 canonical strategies, execution rules, validated parameters, and live signal monitoring.
 */

import React, { useState, useEffect, useMemo } from 'react';
import {
  Candle,
  IndicatorSnapshot,
  InstrumentId,
  QuantitativeStrategy,
  Quote,
  TradePlan,
} from '../domain/types';
import {
  createTradePlanFromStrategy,
  evaluateAllSubscribedStrategyAlerts,
  StrategyAlertHistoryItem,
  StrategyAlertSubscription,
  StrategyEntryEvaluation,
} from '../services/strategyEngine';
import {
  PlayCircle,
  ShieldCheck,
  Zap,
  SlidersHorizontal,
  ArrowUpRight,
  ArrowDownRight,
  Calculator,
  Briefcase,
  Layers,
  CheckCircle2,
  BellRing,
  BellOff,
  Radio,
  Trash2,
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
  candles?: Candle[];
  indicators?: IndicatorSnapshot;
  quote?: Quote;
  tipsRealYieldPct?: number;
  subscriptions?: Record<string, StrategyAlertSubscription>;
  evaluations?: Record<string, StrategyEntryEvaluation>;
  alertHistory?: StrategyAlertHistoryItem[];
  onToggleSubscription?: (strategyId: string, enabled: boolean) => void;
  onTestStrategyTrigger?: (strategyId: string) => Promise<void> | void;
  onClearAlertHistory?: () => void;
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
  candles,
  indicators,
  quote,
  tipsRealYieldPct,
  subscriptions,
  evaluations,
  alertHistory = [],
  onToggleSubscription,
  onTestStrategyTrigger,
  onClearAlertHistory,
}) => {
  const [selectedCategory, setSelectedCategory] = useState<string>('ALL');
  const [localSubscriptions, setLocalSubscriptions] = useState<Record<string, StrategyAlertSubscription>>({});
  const [pushPermission, setPushPermission] = useState<NotificationPermission | 'unsupported'>(() =>
    typeof window !== 'undefined' && 'Notification' in window ? window.Notification.permission : 'unsupported'
  );
  const [testingAlertId, setTestingAlertId] = useState<string | null>(null);
  const [subNotice, setSubNotice] = useState<string | null>(null);

  const effectiveSubscriptions = subscriptions ?? localSubscriptions;

  const [activeStrategy, setActiveStrategy] = useState<QuantitativeStrategy>(() => {
    if (activeStrategyId) {
      const match = strategies.find((s) => s.id === activeStrategyId);
      if (match) return match;
    }
    return strategies[0] || ({} as QuantitativeStrategy);
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

  const computedEvaluations = useMemo(() => {
    if (evaluations && Object.keys(evaluations).length > 0) {
      return evaluations;
    }
    return evaluateAllSubscribedStrategyAlerts(strategies, effectiveSubscriptions, {
      currentMid,
      instrumentId,
      candles,
      indicators,
      quote,
      spreadPips: quote?.spreadPips,
      tipsRealYieldPct,
    }).evaluations;
  }, [evaluations, strategies, effectiveSubscriptions, currentMid, instrumentId, candles, indicators, quote, tipsRealYieldPct]);

  const subscribedCount = useMemo(
    () => Object.values(effectiveSubscriptions).filter((s) => s?.enabled).length,
    [effectiveSubscriptions]
  );

  const handleToggleStrategyAlert = (strategyId: string) => {
    const nextEnabled = !Boolean(effectiveSubscriptions[strategyId]?.enabled);
    if (onToggleSubscription) {
      onToggleSubscription(strategyId, nextEnabled);
    } else {
      setLocalSubscriptions((prev) => ({
        ...prev,
        [strategyId]: {
          strategyId,
          enabled: nextEnabled,
          subscribedAt: prev[strategyId]?.subscribedAt || new Date().toISOString(),
        },
      }));
    }
    const targetName = strategies.find((s) => s.id === strategyId)?.name || strategyId;
    setSubNotice(
      nextEnabled
        ? `Push notifications armed for ${targetName} (${instrumentId}).`
        : `Push notifications paused for ${targetName}.`
    );
  };

  const handleRequestBrowserPush = async () => {
    if (typeof window === 'undefined' || !('Notification' in window)) {
      setPushPermission('unsupported');
      return;
    }
    try {
      const result = await window.Notification.requestPermission();
      setPushPermission(result);
    } catch {
      // Ignore permission prompt errors inside restricted iframes
    }
  };

  const handleRunTestTrigger = async (strategyId: string) => {
    if (!onTestStrategyTrigger) return;
    setTestingAlertId(strategyId);
    try {
      await onTestStrategyTrigger(strategyId);
    } finally {
      setTestingAlertId(null);
    }
  };

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
  const activeEvaluation = computedEvaluations[activeStrategy.id];
  const isActiveSubscribed = Boolean(effectiveSubscriptions[activeStrategy.id]?.enabled);

  return (
    <div className="space-y-6">
      {/* Strategy Alert Subscription Summary Bar */}
      <section
        aria-label="Strategy Alert Subscriptions Overview"
        className="bg-slate-900 border border-slate-800 rounded-lg p-4 flex flex-wrap items-center justify-between gap-3"
      >
        <div className="flex items-start gap-2.5">
          <BellRing className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" aria-hidden="true" />
          <div>
            <h2 className="text-sm font-bold text-slate-100">
              Strategy Alert Subscriptions · Live Indicator Monitor ({instrumentId})
            </h2>
            <p className="text-xs text-slate-400 mt-0.5 tabular-nums">
              {subscribedCount} of {strategies.length} quantitative models armed for automatic push alerts when live EMA/RSI/ATR/BB/Supertrend criteria align.
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 text-xs font-mono">
          <span className="text-slate-400">
            Browser Push:{' '}
            <strong
              className={
                pushPermission === 'granted'
                  ? 'text-emerald-400'
                  : pushPermission === 'denied'
                  ? 'text-rose-400'
                  : 'text-amber-300'
              }
            >
              {pushPermission === 'granted'
                ? 'Enabled'
                : pushPermission === 'denied'
                ? 'Blocked'
                : pushPermission === 'unsupported'
                ? 'Server / In-App Only'
                : 'Permission Needed'}
            </strong>
          </span>
          {pushPermission === 'default' && (
            <button
              type="button"
              onClick={handleRequestBrowserPush}
              className="px-3 py-1.5 rounded bg-amber-500 hover:bg-amber-400 text-slate-950 font-sans font-semibold text-xs transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              Enable Browser Push
            </button>
          )}
        </div>
      </section>

      {subNotice && (
        <div
          role="status"
          className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-amber-500/30 bg-amber-500/10 px-4 py-2 text-xs font-mono text-amber-200"
        >
          <span>{subNotice}</span>
          <button
            type="button"
            onClick={() => setSubNotice(null)}
            className="text-amber-300 hover:text-amber-100 whitespace-nowrap shrink-0 cursor-pointer"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Category Filter Pills */}
      <div className="flex flex-wrap items-center gap-2 pb-2 border-b border-slate-800">
        {categories.map((cat) => (
          <button
            key={cat}
            onClick={() => setSelectedCategory(cat)}
            className={`px-3 py-1.5 text-xs font-mono rounded-md transition-colors cursor-pointer ${
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
            <span className="tabular-nums">Current Spot: ${currentMid.toFixed(2)}</span>
          </div>

          {filtered.map((strat) => {
            const isSelected = activeStrategy.id === strat.id;
            const isSignalBuy = strat.currentSignal.action === 'BUY';
            const isSignalActive = strat.currentSignal.active;
            const isSubscribed = Boolean(effectiveSubscriptions[strat.id]?.enabled);
            const liveEval = computedEvaluations[strat.id];

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
                <div className="flex items-center justify-between gap-2 text-xs font-mono pb-1.5 border-b border-slate-800/60">
                  <span className="text-amber-400 font-semibold truncate">{strat.category}</span>
                  <div className="flex items-center gap-2 shrink-0">
                    <span className="text-slate-500 hidden sm:inline">{strat.id}</span>
                    <button
                      type="button"
                      role="switch"
                      aria-checked={isSubscribed}
                      aria-label={`Push alert subscription for ${strat.name}`}
                      onClick={(e) => {
                        e.stopPropagation();
                        handleToggleStrategyAlert(strat.id);
                      }}
                      title={
                        isSubscribed
                          ? `Subscribed to live entry push alerts for ${strat.name}. Click to pause.`
                          : `Subscribe to live entry push alerts for ${strat.name}.`
                      }
                      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-mono font-bold border transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                        isSubscribed
                          ? 'bg-emerald-500/15 text-emerald-300 border-emerald-500/40'
                          : 'bg-slate-950 text-slate-400 border-slate-700 hover:text-slate-200'
                      }`}
                    >
                      {isSubscribed ? (
                        <BellRing className="w-3 h-3 text-emerald-400" aria-hidden="true" />
                      ) : (
                        <BellOff className="w-3 h-3 text-slate-500" aria-hidden="true" />
                      )}
                      <span>{isSubscribed ? 'PUSH ON' : 'ALERT OFF'}</span>
                    </button>
                  </div>
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

                  <div className="flex items-center gap-1.5">
                    {liveEval && isSubscribed && (
                      <span
                        className={`px-1.5 py-0.5 rounded text-[10px] font-bold tabular-nums border ${
                          liveEval.criteriaMet
                            ? 'bg-emerald-500/15 text-emerald-300 border-emerald-500/40'
                            : 'bg-slate-950 text-slate-400 border-slate-800'
                        }`}
                      >
                        {liveEval.criteriaMet
                          ? `ENTRY MET (${liveEval.direction})`
                          : `${liveEval.matchedConditionsCount}/${liveEval.totalConditionsCount} MET`}
                      </span>
                    )}
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

          {/* Strategy Alert Subscription & Live Indicator Checklist */}
          <section
            aria-label="Strategy Alert Subscription Controls"
            className="bg-slate-950 p-4 rounded-lg border border-slate-800 space-y-3"
          >
            <div className="flex flex-wrap items-center justify-between gap-3 pb-2.5 border-b border-slate-800/80">
              <div className="flex items-center gap-2">
                <Radio
                  className={`w-4 h-4 shrink-0 ${isActiveSubscribed ? 'text-emerald-400' : 'text-slate-500'}`}
                  aria-hidden="true"
                />
                <div>
                  <h4 className="text-xs font-mono uppercase tracking-wider text-slate-200 font-bold">
                    Strategy Alert Subscription · {activeStrategy.name}
                  </h4>
                  <span className="text-[11px] font-mono text-slate-400">
                    {activeEvaluation
                      ? activeEvaluation.summary
                      : 'Evaluates live EMA, RSI, ATR, Bollinger & Supertrend triggers continuously.'}
                  </span>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  role="switch"
                  aria-checked={isActiveSubscribed}
                  aria-label={`Toggle push notifications for ${activeStrategy.name}`}
                  onClick={() => handleToggleStrategyAlert(activeStrategy.id)}
                  className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-mono font-bold border transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                    isActiveSubscribed
                      ? 'bg-emerald-500/15 text-emerald-300 border-emerald-500/40 hover:bg-emerald-500/25'
                      : 'bg-slate-900 text-slate-300 border-slate-700 hover:border-amber-500/40'
                  }`}
                >
                  {isActiveSubscribed ? (
                    <BellRing className="w-3.5 h-3.5 text-emerald-400" aria-hidden="true" />
                  ) : (
                    <BellOff className="w-3.5 h-3.5 text-slate-400" aria-hidden="true" />
                  )}
                  <span>{isActiveSubscribed ? 'Push Alert: Subscribed' : 'Subscribe Push Alerts'}</span>
                </button>

                {onTestStrategyTrigger && (
                  <button
                    type="button"
                    disabled={testingAlertId === activeStrategy.id}
                    onClick={() => void handleRunTestTrigger(activeStrategy.id)}
                    className="px-3 py-1.5 rounded-md text-xs font-mono font-medium bg-slate-800 hover:bg-slate-700 text-amber-300 border border-slate-700 transition-colors whitespace-nowrap shrink-0 disabled:opacity-50 cursor-pointer"
                  >
                    {testingAlertId === activeStrategy.id ? 'Dispatching...' : 'Simulate Entry Push'}
                  </button>
                )}
              </div>
            </div>

            {activeEvaluation && (
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-xs font-mono">
                {activeEvaluation.checks.map((chk) => (
                  <div
                    key={chk.label}
                    className={`p-2.5 rounded border ${
                      chk.met
                        ? 'bg-emerald-500/5 border-emerald-500/30'
                        : 'bg-slate-900/70 border-slate-800'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-[11px] text-slate-300 font-semibold truncate">{chk.label}</span>
                      <span
                        className={`text-[10px] font-bold shrink-0 ${
                          chk.met ? 'text-emerald-400' : 'text-slate-500'
                        }`}
                      >
                        {chk.met ? 'PASS' : 'WAIT'}
                      </span>
                    </div>
                    <div className="text-[11px] text-slate-200 font-bold tabular-nums mt-1 truncate">
                      {chk.observed}
                    </div>
                    <div className="text-[10px] text-slate-500 tabular-nums truncate">
                      Req: {chk.required}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>

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

          {/* Recent Strategy Push Alert Dispatches */}
          <div className="bg-slate-950 border border-slate-800 rounded-lg p-4 space-y-2.5">
            <div className="flex items-center justify-between gap-2 pb-2 border-b border-slate-800">
              <h4 className="text-[11px] uppercase tracking-wider text-slate-400 font-mono flex items-center gap-1.5">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" aria-hidden="true" />
                Triggered Strategy Push Notifications ({alertHistory.length})
              </h4>
              {alertHistory.length > 0 && onClearAlertHistory && (
                <button
                  type="button"
                  onClick={onClearAlertHistory}
                  className="inline-flex items-center gap-1 text-[11px] font-mono text-slate-400 hover:text-slate-200 cursor-pointer"
                >
                  <Trash2 className="w-3 h-3" aria-hidden="true" />
                  Clear Log
                </button>
              )}
            </div>

            {alertHistory.length === 0 ? (
              <p className="text-xs font-mono text-slate-500 py-2">
                No strategy push alerts fired yet. Toggle &ldquo;Subscribe Push Alerts&rdquo; on any strategy to monitor live market indicators automatically.
              </p>
            ) : (
              <div className="space-y-2 max-h-48 overflow-y-auto">
                {alertHistory.slice(0, 8).map((item) => (
                  <div
                    key={item.id}
                    className="p-2.5 rounded border border-slate-800 bg-slate-900/70 text-xs font-mono space-y-1"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span className="font-bold text-slate-100">
                        {item.strategyName} ·{' '}
                        <span className={item.direction === 'BUY' ? 'text-emerald-400' : 'text-rose-400'}>
                          {item.direction} {item.instrumentId}
                        </span>
                      </span>
                      <span className="text-[10px] text-slate-400 tabular-nums">
                        {item.timestamp.slice(11, 19)} UTC
                      </span>
                    </div>
                    <p className="text-[11px] font-sans text-slate-300">{item.summary}</p>
                    <div className="text-[10px] text-slate-400 tabular-nums">
                      Delivery: {item.deliverySummary}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
