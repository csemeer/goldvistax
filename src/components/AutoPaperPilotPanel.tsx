/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * Aurum Intelligence — Autonomous Simulated Paper Trading (Auto-Paper Pilot) Controls
 *
 * Strictly simulated Paper Journal engine (Non-Execution Environment).
 * Restricted solely to INTRADAY and SWING advisory horizons with parameterized risk guardrails.
 */

import React from 'react';
import { ShieldCheck, Sliders, Play, Square, Lock } from 'lucide-react';
import {
  AutoPaperPilotConfig,
  AutoPaperPilotCycleEvaluation,
  AutoPilotAllowedHorizon,
  normalizeAutoPaperPilotConfig,
} from '../services/portfolioScannerEngine';

interface AutoPaperPilotPanelProps {
  config: AutoPaperPilotConfig;
  evaluation: AutoPaperPilotCycleEvaluation;
  accountBalance: number;
  busy?: boolean;
  lastCycleSummary?: string | null;
  onChangeConfig: (next: AutoPaperPilotConfig) => void;
  onRunCycleNow: () => void;
}

export const AutoPaperPilotPanel: React.FC<AutoPaperPilotPanelProps> = ({
  config,
  evaluation,
  accountBalance,
  busy = false,
  lastCycleSummary,
  onChangeConfig,
  onRunCycleNow,
}) => {
  const updateConfig = (patch: Partial<AutoPaperPilotConfig>) => {
    onChangeConfig(normalizeAutoPaperPilotConfig({ ...config, ...patch }));
  };

  const toggleHorizon = (horizon: AutoPilotAllowedHorizon) => {
    const exists = config.allowedHorizons.includes(horizon);
    const nextHorizons = exists
      ? config.allowedHorizons.filter((h) => h !== horizon)
      : [...config.allowedHorizons, horizon];
    updateConfig({ allowedHorizons: nextHorizons });
  };

  const riskPerTradeUsd = accountBalance * (config.riskPctPerTrade / 100);

  return (
    <section
      aria-label="Autonomous Simulated Paper Trading Controls"
      className="bg-slate-900 border border-slate-800 rounded-lg p-5 space-y-5"
    >
      {/* Header & Master Opt-In Switch */}
      <div className="flex flex-wrap items-start justify-between gap-4 pb-4 border-b border-slate-800">
        <div>
          <span className="text-xs font-mono text-amber-400 uppercase tracking-wider block">
            Simulated Paper Pilot · Non-Execution Environment
          </span>
          <h3 className="text-base font-bold text-slate-100 mt-0.5 flex items-center gap-2">
            <Sliders className="w-4 h-4 text-amber-400 shrink-0" aria-hidden="true" />
            <span>Autonomous Simulated Paper Trading (Auto-Paper Pilot)</span>
          </h3>
          <p className="text-xs text-slate-400 mt-1">
            Evaluates qualifying <strong className="text-slate-200">INTRADAY</strong> and{' '}
            <strong className="text-slate-200">SWING</strong> signals inside your Paper Journal
            with parameterized risk limits and zero live broker routing.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2.5 bg-slate-950/80 border border-slate-800 rounded-md px-3 py-2">
            <span className="text-xs font-mono text-slate-300">
              {config.enabled ? 'Pilot Active (Simulated)' : 'Pilot Paused (Manual)'}
            </span>
            <button
              type="button"
              role="switch"
              aria-checked={config.enabled}
              aria-label="Toggle Autonomous Simulated Paper Trading"
              onClick={() => updateConfig({ enabled: !config.enabled })}
              className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer items-center rounded-md border transition-colors ${
                config.enabled
                  ? 'bg-emerald-500/30 border-emerald-500/60'
                  : 'bg-slate-800 border-slate-700'
              }`}
            >
              <span
                className={`inline-block h-3.5 w-3.5 rounded-sm transition-transform ${
                  config.enabled
                    ? 'translate-x-4 bg-emerald-400'
                    : 'translate-x-0.5 bg-slate-400'
                }`}
              />
            </button>
          </div>

          {config.enabled && (
            <button
              type="button"
              onClick={() => updateConfig({ enabled: false })}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-md bg-rose-500/15 hover:bg-rose-500/25 text-rose-300 border border-rose-500/30 text-xs font-semibold transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              <Square className="w-3.5 h-3.5" aria-hidden="true" />
              Pause Auto-Pilot
            </button>
          )}

          <button
            type="button"
            disabled={busy}
            onClick={onRunCycleNow}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-md bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-bold transition-colors whitespace-nowrap shrink-0 disabled:opacity-50 cursor-pointer"
          >
            <Play className="w-3.5 h-3.5" aria-hidden="true" />
            Run Pilot Cycle
          </button>
        </div>
      </div>

      {/* Telemetry Guardrail Status Strip */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 text-xs font-mono">
        <div className="bg-slate-950/70 border border-slate-800 rounded-md p-3">
          <span className="text-[10px] text-slate-500 uppercase block">Open Trade Capacity</span>
          <span className="text-sm font-bold text-slate-100 tabular-nums mt-0.5 block">
            {evaluation.openPositionsCount} / {config.maxConcurrentOpenTrades} Open
          </span>
          <span className="text-[11px] text-slate-400 tabular-nums">
            {evaluation.remainingCapacitySlots} slot(s) available
          </span>
        </div>

        <div className="bg-slate-950/70 border border-slate-800 rounded-md p-3">
          <span className="text-[10px] text-slate-500 uppercase block">Risk Budget / Trade</span>
          <span className="text-sm font-bold text-amber-400 tabular-nums mt-0.5 block">
            {config.riskPctPerTrade.toFixed(2)}% (${riskPerTradeUsd.toFixed(2)})
          </span>
          <span className="text-[11px] text-slate-400 tabular-nums">
            Min R:R {config.minRewardToRiskRatio.toFixed(2)}:1
          </span>
        </div>

        <div className="bg-slate-950/70 border border-slate-800 rounded-md p-3">
          <span className="text-[10px] text-slate-500 uppercase block">
            Daily Drawdown Breaker
          </span>
          <span
            className={`text-sm font-bold tabular-nums mt-0.5 block ${
              evaluation.circuitBreakerTripped ? 'text-rose-400' : 'text-emerald-400'
            }`}
          >
            {evaluation.currentDailyDrawdownPct.toFixed(2)}% /{' '}
            {config.dailyMaxDrawdownPct.toFixed(2)}%
          </span>
          <span className="text-[11px] text-slate-400">
            {evaluation.circuitBreakerTripped ? 'Breaker Tripped · Halted' : 'Within Daily Limit'}
          </span>
        </div>

        <div className="bg-slate-950/70 border border-slate-800 rounded-md p-3">
          <span className="text-[10px] text-slate-500 uppercase block">Horizon Scope Lock</span>
          <span className="text-sm font-bold text-slate-100 mt-0.5 block">
            INTRADAY &amp; SWING Only
          </span>
          <span className="text-[11px] text-slate-400">LONG_TERM &amp; CFD Excluded</span>
        </div>
      </div>

      {/* Horizon Filter Controls */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-slate-950/50 border border-slate-800 rounded-md p-3">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs font-mono text-slate-400 mr-1">Eligible Signal Horizons:</span>
          {(['INTRADAY', 'SWING'] as const).map((horizon) => {
            const active = config.allowedHorizons.includes(horizon);
            return (
              <button
                key={horizon}
                type="button"
                aria-pressed={active}
                onClick={() => toggleHorizon(horizon)}
                className={`px-3 py-1.5 rounded-md border text-xs font-mono font-semibold transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                  active
                    ? 'bg-amber-500/20 text-amber-300 border-amber-500/50'
                    : 'bg-slate-900 text-slate-400 border-slate-800 hover:text-slate-200'
                }`}
              >
                {horizon} {active ? 'Enabled' : 'Muted'}
              </button>
            );
          })}

          <span className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-md border border-slate-800 bg-slate-900/70 text-[11px] font-mono text-slate-500">
            <Lock className="w-3 h-3" aria-hidden="true" />
            LONG_TERM (Locked Out)
          </span>
          <span className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-md border border-slate-800 bg-slate-900/70 text-[11px] font-mono text-slate-500">
            <Lock className="w-3 h-3" aria-hidden="true" />
            CFD (Locked Out)
          </span>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2">
            <span className="text-xs font-mono text-slate-400">Block Contra Positions:</span>
            <button
              type="button"
              role="switch"
              aria-checked={!config.allowContraDirections}
              aria-label="Toggle Blocking Opposite-Side Contra Positions"
              onClick={() => updateConfig({ allowContraDirections: !config.allowContraDirections })}
              className={`px-2.5 py-1 rounded-md border text-xs font-mono font-semibold transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                !config.allowContraDirections
                  ? 'bg-emerald-500/15 text-emerald-300 border-emerald-500/40'
                  : 'bg-amber-500/15 text-amber-300 border-amber-500/40'
              }`}
            >
              {!config.allowContraDirections ? 'On (Single-Side)' : 'Off (Allow Hedge)'}
            </button>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-xs font-mono text-slate-400">Auto-Close SL / Target 1:</span>
            <button
              type="button"
              role="switch"
              aria-checked={config.autoManageExits}
              aria-label="Toggle Autonomous Stop-Loss and Target 1 Exits"
              onClick={() => updateConfig({ autoManageExits: !config.autoManageExits })}
              className={`px-2.5 py-1 rounded-md border text-xs font-mono font-semibold transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                config.autoManageExits
                  ? 'bg-emerald-500/15 text-emerald-300 border-emerald-500/40'
                  : 'bg-slate-900 text-slate-400 border-slate-700'
              }`}
            >
              {config.autoManageExits ? 'On' : 'Off'}
            </button>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-xs font-mono text-slate-400">Auto-Close on Signal Flip:</span>
            <button
              type="button"
              role="switch"
              aria-checked={config.exitOnAdvisoryFlip}
              aria-label="Toggle Auto-Close When Live Advisory Flips Opposite"
              onClick={() => updateConfig({ exitOnAdvisoryFlip: !config.exitOnAdvisoryFlip })}
              className={`px-2.5 py-1 rounded-md border text-xs font-mono font-semibold transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                config.exitOnAdvisoryFlip
                  ? 'bg-emerald-500/15 text-emerald-300 border-emerald-500/40'
                  : 'bg-slate-900 text-slate-400 border-slate-700'
              }`}
            >
              {config.exitOnAdvisoryFlip ? 'On (Exit Contra)' : 'Off (Manual)'}
            </button>
          </div>
        </div>
      </div>

      {config.allowedHorizons.length === 0 && (
        <div
          role="status"
          className="rounded-md border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs font-mono text-amber-200"
        >
          Both INTRADAY and SWING horizons are currently muted; no autonomous entries will open
          until at least one horizon is enabled.
        </div>
      )}

      {/* Parameterized Risk Guardrail Inputs */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
        <div>
          <label
            htmlFor="autopilot-max-trades"
            className="block text-[11px] font-mono text-slate-400 mb-1"
          >
            Max Concurrent Open Trades
          </label>
          <input
            id="autopilot-max-trades"
            type="number"
            min={1}
            max={10}
            step={1}
            value={config.maxConcurrentOpenTrades}
            onChange={(e) => updateConfig({ maxConcurrentOpenTrades: Number(e.target.value) })}
            className="w-full bg-slate-950 border border-slate-800 rounded-md px-3 py-2 text-xs font-mono tabular-nums text-slate-100 focus:outline-none focus:border-amber-400"
          />
        </div>

        <div>
          <label
            htmlFor="autopilot-risk-pct"
            className="block text-[11px] font-mono text-slate-400 mb-1"
          >
            Risk % Per Trade (0.25–5.0%)
          </label>
          <input
            id="autopilot-risk-pct"
            type="number"
            min={0.25}
            max={5}
            step={0.25}
            value={config.riskPctPerTrade}
            onChange={(e) => updateConfig({ riskPctPerTrade: Number(e.target.value) })}
            className="w-full bg-slate-950 border border-slate-800 rounded-md px-3 py-2 text-xs font-mono tabular-nums text-slate-100 focus:outline-none focus:border-amber-400"
          />
        </div>

        <div>
          <label
            htmlFor="autopilot-min-rr"
            className="block text-[11px] font-mono text-slate-400 mb-1"
          >
            Min R:R Ratio (1.2–5.0)
          </label>
          <input
            id="autopilot-min-rr"
            type="number"
            min={1.2}
            max={5}
            step={0.1}
            value={config.minRewardToRiskRatio}
            onChange={(e) => updateConfig({ minRewardToRiskRatio: Number(e.target.value) })}
            className="w-full bg-slate-950 border border-slate-800 rounded-md px-3 py-2 text-xs font-mono tabular-nums text-slate-100 focus:outline-none focus:border-amber-400"
          />
        </div>

        <div>
          <label
            htmlFor="autopilot-daily-breaker"
            className="block text-[11px] font-mono text-slate-400 mb-1"
          >
            Daily Loss Breaker %
          </label>
          <input
            id="autopilot-daily-breaker"
            type="number"
            min={0.5}
            max={15}
            step={0.25}
            value={config.dailyMaxDrawdownPct}
            onChange={(e) => updateConfig({ dailyMaxDrawdownPct: Number(e.target.value) })}
            className="w-full bg-slate-950 border border-slate-800 rounded-md px-3 py-2 text-xs font-mono tabular-nums text-slate-100 focus:outline-none focus:border-amber-400"
          />
        </div>

        <div>
          <label
            htmlFor="autopilot-cooldown"
            className="block text-[11px] font-mono text-slate-400 mb-1"
          >
            Horizon Cooldown (min)
          </label>
          <input
            id="autopilot-cooldown"
            type="number"
            min={1}
            max={240}
            step={1}
            value={config.cooldownMinutesPerHorizon}
            onChange={(e) => updateConfig({ cooldownMinutesPerHorizon: Number(e.target.value) })}
            className="w-full bg-slate-950 border border-slate-800 rounded-md px-3 py-2 text-xs font-mono tabular-nums text-slate-100 focus:outline-none focus:border-amber-400"
          />
        </div>
      </div>

      {/* Live Signal Evaluation Matrix */}
      <div className="bg-slate-950/60 border border-slate-800 rounded-md overflow-hidden">
        <div className="px-4 py-2.5 border-b border-slate-800 flex flex-wrap items-center justify-between gap-2 text-xs font-mono">
          <span className="text-slate-300 font-semibold flex items-center gap-1.5">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" aria-hidden="true" />
            Live Signal Readiness &amp; Guardrail Audit
          </span>
          {lastCycleSummary && <span className="text-slate-400">{lastCycleSummary}</span>}
        </div>

        <div className="divide-y divide-slate-800/70 text-xs font-mono">
          {evaluation.planDecisions.length === 0 ? (
            <div className="px-4 py-3 text-slate-500">
              No active trade plans loaded for cycle evaluation.
            </div>
          ) : (
            evaluation.planDecisions.map((item) => {
              const statusColor =
                item.decision === 'EXECUTED' || item.decision === 'WOULD_OPEN'
                  ? 'text-emerald-400'
                  : item.decision === 'BLOCKED_HORIZON'
                  ? 'text-slate-500'
                  : 'text-amber-300';
              return (
                <div
                  key={`${item.planKey}-${item.planId}`}
                  className="px-4 py-2.5 flex flex-wrap items-center justify-between gap-3"
                >
                  <div className="flex flex-wrap items-center gap-3 min-w-0">
                    <span className="font-bold text-slate-200 w-24 shrink-0">{item.horizon}</span>
                    <span className="text-slate-300 w-20 shrink-0">{item.instrumentId}</span>
                    <span
                      className={`font-semibold w-20 shrink-0 ${
                        item.direction === 'BUY'
                          ? 'text-emerald-400'
                          : item.direction === 'SELL'
                          ? 'text-rose-400'
                          : 'text-slate-400'
                      }`}
                    >
                      {item.direction}
                    </span>
                    <span className={`font-semibold shrink-0 ${statusColor}`}>
                      {item.decision.replace(/_/g, ' ')}
                    </span>
                  </div>
                  <span className="text-[11px] font-sans text-slate-400">{item.reason}</span>
                </div>
              );
            })
          )}
        </div>
      </div>
    </section>
  );
};
