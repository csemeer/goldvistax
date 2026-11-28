/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * Aurum Intelligence — Canonical Trade Plan Card
 * Displays validated multi-horizon setups, risk-reward ratios, and hard invalidation rules.
 */

import React, { useEffect, useId, useMemo, useState } from 'react';
import { Candle, IndicatorSnapshot, Quote, TradePlan } from '../domain/types';
import { calculateTradePlanPnlProjection } from '../services/riskEngine';
import {
  estimateNextSetupCountdown,
  formatSetupCountdownDuration,
} from '../services/advisoryEngine';
import { buildTradePlanOnePagePdf } from '../services/pdfReportExporter';
import {
  AlertTriangle,
  ArrowUpRight,
  ArrowDownRight,
  ShieldCheck,
  XCircle,
  Lock,
  Zap,
  RotateCcw,
  PauseCircle,
  Scale,
  Calculator,
  Timer,
  Activity,
  FileDown,
} from 'lucide-react';

interface TradePlanCardProps {
  plan: TradePlan;
  quote?: Quote;
  candles?: Candle[];
  indicators?: IndicatorSnapshot;
  onSelectForCFD?: (plan: TradePlan) => void;
  onExecutePaper?: (plan: TradePlan, suggestedLots?: number) => void;
  onInspectRationale?: (plan: TradePlan) => void;
  isLocked?: boolean;
  onUnlock?: (plan: TradePlan) => void;
  isGuaranteed?: boolean;
}

export const TradePlanCard: React.FC<TradePlanCardProps> = ({
  plan,
  quote,
  candles,
  indicators,
  onSelectForCFD,
  onExecutePaper,
  onInspectRationale,
  isLocked = false,
  onUnlock,
  isGuaranteed = false,
}) => {
  const isBuy = plan.direction === 'BUY';
  const isHold = plan.direction === 'HOLD';
  const isNoTrade = plan.direction === 'NO_TRADE' || plan.isAbstained;

  const accountInputId = useId();
  const riskInputId = useId();
  const [accountSizeInput, setAccountSizeInput] = useState<string>('25000');
  const [riskPercentInput, setRiskPercentInput] = useState<string>('1.5');
  const [isExportingPdf, setIsExportingPdf] = useState<boolean>(false);
  const [pdfNotice, setPdfNotice] = useState<{
    filename: string;
    snapshotHash: string;
    pageCount: number;
  } | null>(null);
  const [pdfError, setPdfError] = useState<string | null>(null);

  const parsedAccountSize = Number.parseFloat(accountSizeInput);
  const parsedRiskPercent = Number.parseFloat(riskPercentInput);

  const pnlProjection = useMemo(
    () =>
      calculateTradePlanPnlProjection({
        plan,
        accountSize: Number.isFinite(parsedAccountSize) ? parsedAccountSize : 0,
        riskPercent: Number.isFinite(parsedRiskPercent) ? parsedRiskPercent : 0,
      }),
    [plan, parsedAccountSize, parsedRiskPercent]
  );

  const countdownEstimate = useMemo(
    () => estimateNextSetupCountdown({ plan, candles, indicators }),
    [plan, candles, indicators]
  );

  const [secondsRemaining, setSecondsRemaining] = useState<number>(
    countdownEstimate.estimatedSecondsRemaining
  );

  useEffect(() => {
    setSecondsRemaining(countdownEstimate.estimatedSecondsRemaining);
  }, [countdownEstimate.estimatedSecondsRemaining, plan.id]);

  useEffect(() => {
    if (typeof window === 'undefined') return undefined;
    const timerId = window.setInterval(() => {
      setSecondsRemaining((prev) => (prev > 0 ? prev - 1 : 0));
    }, 1000);
    return () => window.clearInterval(timerId);
  }, [plan.id]);

  const countdownDisplay =
    secondsRemaining <= 0 ? '00:00:00 · READY' : formatSetupCountdownDuration(secondsRemaining);

  const phaseTextStyle =
    countdownEstimate.phase === 'IMMINENT' || secondsRemaining <= 0
      ? 'text-emerald-400 border-emerald-500/30 bg-emerald-500/10'
      : countdownEstimate.phase === 'ACCELERATING'
      ? 'text-amber-300 border-amber-500/30 bg-amber-500/10'
      : countdownEstimate.phase === 'HOLD_ABSTAINED'
      ? 'text-rose-300 border-rose-500/30 bg-rose-500/10'
      : countdownEstimate.phase === 'CONSOLIDATING'
      ? 'text-slate-300 border-slate-700 bg-slate-900'
      : 'text-cyan-300 border-cyan-500/30 bg-cyan-500/10';

  const phaseBarColor =
    countdownEstimate.phase === 'IMMINENT' || secondsRemaining <= 0
      ? 'bg-emerald-400'
      : countdownEstimate.phase === 'ACCELERATING'
      ? 'bg-amber-400'
      : countdownEstimate.phase === 'HOLD_ABSTAINED'
      ? 'bg-rose-400'
      : 'bg-cyan-400';

  const sizeDecimals = pnlProjection.lotIncrement < 1 ? 2 : 0;
  const formatUsd = (val: number, signed = false) => {
    const abs = Math.abs(val).toLocaleString('en-US', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
    if (!signed) return `$${abs}`;
    if (val > 0) return `+$${abs}`;
    if (val < 0) return `-$${abs}`;
    return `$${abs}`;
  };

  const handleExportPdf = () => {
    setIsExportingPdf(true);
    setPdfError(null);
    try {
      const artifact = buildTradePlanOnePagePdf({
        plan,
        quote,
        candles,
        indicators,
        accountSizeUsd: Number.isFinite(parsedAccountSize) ? parsedAccountSize : 25000,
        riskPercent: Number.isFinite(parsedRiskPercent) ? parsedRiskPercent : 1.5,
        pnlProjection,
        isLocked,
      });

      const pdfBlob = new Blob([artifact.pdfBytes as unknown as BlobPart], {
        type: 'application/pdf',
      });
      const blobUrl = URL.createObjectURL(pdfBlob);
      const link = document.createElement('a');
      link.href = blobUrl;
      link.download = artifact.filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      setTimeout(() => URL.revokeObjectURL(blobUrl), 2500);

      setPdfNotice({
        filename: artifact.filename,
        snapshotHash: artifact.snapshotHash,
        pageCount: artifact.pageCount,
      });
    } catch (err: any) {
      setPdfError(err?.message || 'Unable to generate PDF trade plan summary.');
    } finally {
      setIsExportingPdf(false);
    }
  };

  // Format status badge
  const getStatusBadge = () => {
    if (isNoTrade) {
      return (
        <span className="text-xs font-mono font-semibold text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded border border-amber-500/20">
          ABSTAIN / NO TRADE
        </span>
      );
    }
    if (isHold) {
      return (
        <span className="text-xs font-mono font-semibold text-slate-300 bg-slate-800 px-2 py-0.5 rounded border border-slate-700 flex items-center gap-1">
          <PauseCircle className="w-3.5 h-3.5 text-amber-400" />
          HOLD / WAIT
        </span>
      );
    }
    if (isBuy) {
      return (
        <span className="text-xs font-mono font-semibold text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20 flex items-center gap-1">
          <ArrowUpRight className="w-3.5 h-3.5" />
          {plan.state.replace('_', ' ')}
        </span>
      );
    }
    return (
      <span className="text-xs font-mono font-semibold text-rose-400 bg-rose-500/10 px-2 py-0.5 rounded border border-rose-500/20 flex items-center gap-1">
        <ArrowDownRight className="w-3.5 h-3.5" />
        {plan.state.replace('_', ' ')}
      </span>
    );
  };

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-lg p-4 sm:p-5 flex flex-col justify-between hover:border-slate-700 transition-colors">
      <div>
        {/* Header: Instrument, Horizon, and Status */}
        <div className="flex items-center justify-between gap-2 pb-2.5 border-b border-slate-800/80">
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-base font-bold text-slate-100">{plan.instrumentId}</h3>
              <span className="text-xs font-mono text-slate-400">· {plan.horizon}</span>
            </div>
            <p className="text-[11px] text-slate-500 font-mono mt-0.5">
              Ref Mid: ${plan.currentMid.toFixed(2)}
            </p>
          </div>
          <div>{getStatusBadge()}</div>
        </div>

        {/* Indicative Advisory Classification Notice */}
        <div className="flex items-center justify-between text-[10px] font-mono text-slate-500 pt-2 px-0.5">
          <span>INDICATIVE SETUP · NON-EXECUTION ADVISORY</span>
          <span>{plan.createdAt ? new Date(plan.createdAt).toTimeString().slice(0, 8) + ' UTC' : 'LIVE'}</span>
        </div>

        {/* Cryptographic Immutable Fingerprint Badge */}
        {plan.snapshotHash && (
          <div
            className="flex items-center justify-between text-[10px] font-mono text-slate-400 bg-slate-950/70 border border-slate-800/80 px-2 py-1 rounded mt-2"
            title="SHA-256 Cryptographic Digest: Mathematically verifies this advisory setup was created at snapshot time with exact entry, stop loss, and invalidation bounds. Tamper-proof."
          >
            <div className="flex items-center gap-1.5 truncate">
              <ShieldCheck className="w-3 h-3 text-emerald-400 shrink-0" />
              <span className="text-slate-500">SHA256:</span>
              <span className="text-slate-300 font-mono">
                {plan.snapshotHash.slice(0, 8)}...{plan.snapshotHash.slice(-8)}
              </span>
            </div>
            <span className="text-emerald-400 font-medium shrink-0 flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
              Verified Immutable
            </span>
          </div>
        )}

        {/* Guarantee Badge */}
        {isGuaranteed && (
          <div className="flex items-center gap-1.5 text-[10px] font-mono text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2 py-1 rounded my-2.5">
            <RotateCcw className="w-3 h-3 text-emerald-400 shrink-0" />
            <span>Stop-Loss Signal Credit Refund Active · 1 Non-Cash Credit returned if stopped out</span>
          </div>
        )}

        {/* Next Setup Countdown Ticker (RSI + Volume Momentum Cycles) */}
        <div className="mt-2.5 p-2.5 bg-slate-950/75 border border-slate-800/80 rounded space-y-2">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-1.5">
              <Timer className="w-3.5 h-3.5 text-amber-400 shrink-0" aria-hidden="true" />
              <span className="text-[11px] font-mono font-semibold uppercase tracking-wider text-slate-200">
                Next Setup Countdown
              </span>
              <span className={`text-[10px] font-mono px-1.5 py-0.5 rounded border ${phaseTextStyle}`}>
                {secondsRemaining <= 0 ? 'Trigger Ready' : countdownEstimate.phaseLabel}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-mono text-slate-500">
                {countdownEstimate.horizonCadenceLabel}
              </span>
              <span
                className="text-sm font-mono font-bold text-slate-100 tabular-nums"
                data-testid="next-setup-countdown-clock"
              >
                {countdownDisplay}
              </span>
            </div>
          </div>

          <div className="w-full h-1 bg-slate-800 rounded overflow-hidden">
            <div
              className={`${phaseBarColor} h-full transition-all duration-500`}
              style={{ width: `${countdownEstimate.cycleCompletionPct}%` }}
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-[10px] font-mono tabular-nums text-slate-400">
            <div className="flex items-center justify-between bg-slate-900/70 px-2 py-1 rounded border border-slate-800/70">
              <span className="text-slate-500 flex items-center gap-1">
                <Activity className="w-3 h-3 text-cyan-400 shrink-0" aria-hidden="true" />
                RSI(14) Cycle
              </span>
              <span className="text-slate-200">
                {countdownEstimate.rsi14.toFixed(1)} ({countdownEstimate.rsiVelocityPerBar >= 0 ? '+' : ''}
                {countdownEstimate.rsiVelocityPerBar.toFixed(1)}/bar) · {countdownEstimate.rsiTargetLabel}
              </span>
            </div>

            <div className="flex items-center justify-between bg-slate-900/70 px-2 py-1 rounded border border-slate-800/70">
              <span className="text-slate-500">Vol Momentum</span>
              <span className="text-slate-200">
                {countdownEstimate.volumeMomentumRatio.toFixed(2)}x · {countdownEstimate.volumePhaseLabel} (~
                {countdownEstimate.estimatedBarsRemaining.toFixed(1)} bars)
              </span>
            </div>
          </div>
        </div>

        {isLocked ? (
          <div className="my-3 p-4 bg-slate-950/80 rounded-lg border border-amber-500/20 text-center space-y-3 relative overflow-hidden">
            <div className="flex flex-col items-center gap-1.5">
              <div className="w-8 h-8 rounded-full bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400">
                <Lock className="w-4 h-4" />
              </div>
              <span className="text-xs font-bold text-slate-100">
                Institutional Limit Corridor & Strict Stops Locked
              </span>
              <p className="text-[11px] text-slate-400 max-w-sm">
                Unlock exact limit entry zone, invalidation stop-loss, and multi-target harvest levels.
              </p>
              <div className="flex items-center gap-1.5 text-[10px] text-emerald-400 font-mono font-medium">
                <RotateCcw className="w-3.5 h-3.5" />
                <span>100% Non-Cash Signal Credit Refund (1 Signal Credit returned if stopped out before TP1)</span>
              </div>
            </div>

            <button
              onClick={() => onUnlock && onUnlock(plan)}
              className="inline-flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-amber-500 to-amber-400 hover:from-amber-400 hover:to-amber-300 text-slate-950 font-bold rounded-lg text-xs shadow-md transition-all cursor-pointer"
            >
              <Zap className="w-3.5 h-3.5 fill-slate-950" />
              <span>Unlock Signal (1 Credit)</span>
            </button>
          </div>
        ) : (
          <>
            {/* Pricing Matrix */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 my-3.5 text-xs font-mono">
              <div className="bg-slate-950/60 p-2.5 rounded border border-slate-800/60">
                <span className="text-slate-500 block text-[10px] uppercase">Entry Zone</span>
                <span className="text-amber-400 font-semibold tabular-nums text-sm">
                  ${plan.entryZoneMin.toFixed(2)} - ${plan.entryZoneMax.toFixed(2)}
                </span>
              </div>

              <div className="bg-slate-950/60 p-2.5 rounded border border-slate-800/60">
                <span className="text-slate-500 block text-[10px] uppercase">Stop Loss</span>
                <span className="text-rose-400 font-semibold tabular-nums text-sm">
                  ${plan.stopLossPrice.toFixed(2)}
                </span>
              </div>

              <div className="bg-slate-950/60 p-2.5 rounded border border-slate-800/60">
                <span className="text-slate-500 block text-[10px] uppercase">Target 1</span>
                <span className="text-emerald-400 font-semibold tabular-nums text-sm">
                  ${plan.target1Price.toFixed(2)}
                </span>
              </div>

              <div className="bg-slate-950/60 p-2.5 rounded border border-slate-800/60">
                <span className="text-slate-500 block text-[10px] uppercase">Net R:R</span>
                <span className="text-slate-200 font-bold tabular-nums text-sm">
                  1:{plan.rewardToRiskRatio.toFixed(2)}
                </span>
              </div>
            </div>

            {/* Reward to Risk Visual Bar */}
            <div className="my-3">
              <div className="flex justify-between text-[11px] font-mono text-slate-400 mb-1">
                <span>Risk: ${plan.riskDistance.toFixed(2)}</span>
                <span>Reward (TP1): ${plan.rewardDistance.toFixed(2)}</span>
              </div>
              <div className="w-full h-1.5 bg-slate-800 rounded-full overflow-hidden flex">
                <div
                  className="bg-rose-500/80 h-full"
                  style={{ width: `${Math.min(50, 100 / (1 + plan.rewardToRiskRatio))}%` }}
                />
                <div
                  className="bg-emerald-500/80 h-full"
                  style={{ width: `${Math.max(50, (plan.rewardToRiskRatio / (1 + plan.rewardToRiskRatio)) * 100)}%` }}
                />
              </div>
            </div>

            {/* Invalidation Rules & Warnings */}
            <div className="space-y-2 text-xs bg-slate-950/40 p-3 rounded border border-slate-800/60 text-slate-300">
              <div className="flex items-start gap-2">
                <ShieldCheck className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                <div>
                  <strong className="text-slate-200">Invalidation: </strong>
                  <span className="text-slate-400">{plan.invalidationCondition}</span>
                </div>
              </div>

              {plan.eventRiskWarning && (
                <div className="flex items-start gap-2 text-amber-300/90">
                  <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                  <div>
                    <strong>Event Risk: </strong>
                    <span>{plan.eventRiskWarning}</span>
                  </div>
                </div>
              )}

              {plan.isAbstained && plan.abstentionReason && (
                <div className="flex items-start gap-2 text-rose-300">
                  <XCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
                  <div>
                    <strong>Abstention Notice: </strong>
                    <span>{plan.abstentionReason}</span>
                  </div>
                </div>
              )}
            </div>

            {/* Trade P&L Projection & Position Sizing Calculator */}
            <div className="mt-3 p-3 bg-slate-950/60 rounded border border-slate-800/80 space-y-2.5">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-1.5">
                  <Calculator className="w-3.5 h-3.5 text-amber-400 shrink-0" aria-hidden="true" />
                  <h4 className="text-xs font-bold uppercase tracking-wider text-slate-200">
                    Trade P&amp;L Projection
                  </h4>
                </div>
                <span className="text-[10px] font-mono text-slate-400 tabular-nums">
                  Stop Dist: ${pnlProjection.stopDistance.toFixed(2)} · {pnlProjection.contractSize}x
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                <div>
                  <label
                    htmlFor={accountInputId}
                    className="block text-[10px] font-mono uppercase text-slate-400 mb-1"
                  >
                    Account Size ($)
                  </label>
                  <input
                    id={accountInputId}
                    type="number"
                    min={0}
                    step={500}
                    value={accountSizeInput}
                    onChange={(e) => setAccountSizeInput(e.target.value)}
                    placeholder="25000"
                    className="w-full px-2.5 py-1.5 bg-slate-900 border border-slate-700/80 rounded text-xs font-mono text-slate-100 tabular-nums focus:outline-none focus:border-amber-400"
                  />
                </div>

                <div>
                  <div className="flex items-center justify-between gap-1 mb-1">
                    <label
                      htmlFor={riskInputId}
                      className="text-[10px] font-mono uppercase text-slate-400"
                    >
                      Risk (%)
                    </label>
                    <div className="flex items-center gap-1">
                      {['0.5', '1', '1.5', '2'].map((preset) => {
                        const isActive = riskPercentInput === preset;
                        return (
                          <button
                            key={preset}
                            type="button"
                            onClick={() => setRiskPercentInput(preset)}
                            className={`px-1.5 py-0.5 text-[10px] font-mono rounded border transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                              isActive
                                ? 'bg-amber-500/20 text-amber-300 border-amber-500/40 font-semibold'
                                : 'bg-slate-900 text-slate-400 border-slate-800 hover:text-slate-200 hover:border-slate-700'
                            }`}
                          >
                            {preset}%
                          </button>
                        );
                      })}
                    </div>
                  </div>
                  <input
                    id={riskInputId}
                    type="number"
                    min={0.1}
                    max={25}
                    step={0.25}
                    value={riskPercentInput}
                    onChange={(e) => setRiskPercentInput(e.target.value)}
                    placeholder="1.5"
                    className="w-full px-2.5 py-1.5 bg-slate-900 border border-slate-700/80 rounded text-xs font-mono text-slate-100 tabular-nums focus:outline-none focus:border-amber-400"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-0.5 font-mono tabular-nums">
                <div className="bg-slate-900/90 px-2.5 py-2 rounded border border-slate-800/80">
                  <span className="block text-[10px] uppercase text-slate-500">Suggested Size</span>
                  <span className="block text-sm font-bold text-amber-400 mt-0.5">
                    {pnlProjection.suggestedSize.toFixed(sizeDecimals)} {pnlProjection.unitLabel}
                  </span>
                  <span className="block text-[10px] text-slate-400 mt-0.5">
                    Budget: {formatUsd(pnlProjection.riskBudgetUsd)}
                  </span>
                </div>

                <div className="bg-slate-900/90 px-2.5 py-2 rounded border border-slate-800/80">
                  <span className="block text-[10px] uppercase text-slate-500">Stop-Loss P&amp;L</span>
                  <span className="block text-sm font-bold text-rose-400 mt-0.5">
                    {formatUsd(pnlProjection.projectedStopLossPnl, true)}
                  </span>
                  <span className="block text-[10px] text-rose-300/80 mt-0.5">
                    {pnlProjection.stopLossReturnPct.toFixed(2)}% acct
                  </span>
                </div>

                <div className="bg-slate-900/90 px-2.5 py-2 rounded border border-slate-800/80">
                  <span className="block text-[10px] uppercase text-slate-500">Target 1 P&amp;L</span>
                  <span className="block text-sm font-bold text-emerald-400 mt-0.5">
                    {formatUsd(pnlProjection.projectedTarget1Pnl, true)}
                  </span>
                  <span className="block text-[10px] text-emerald-300/80 mt-0.5">
                    +{pnlProjection.target1ReturnPct.toFixed(2)}% acct
                  </span>
                </div>

                <div className="bg-slate-900/90 px-2.5 py-2 rounded border border-slate-800/80">
                  <span className="block text-[10px] uppercase text-slate-500">T2 / T3 Upside</span>
                  <span className="block text-xs font-semibold text-emerald-300 mt-0.5">
                    T2: {formatUsd(pnlProjection.projectedTarget2Pnl, true)}
                  </span>
                  <span className="block text-[10px] text-slate-300 mt-0.5">
                    T3: {formatUsd(pnlProjection.projectedTarget3Pnl, true)}
                  </span>
                </div>
              </div>

              {pnlProjection.warningMessage && (
                <div className="flex items-start gap-1.5 text-[11px] text-amber-300 bg-amber-500/10 border border-amber-500/20 px-2.5 py-1.5 rounded">
                  <AlertTriangle className="w-3.5 h-3.5 text-amber-400 shrink-0 mt-0.5" aria-hidden="true" />
                  <span>{pnlProjection.warningMessage}</span>
                </div>
              )}
            </div>
          </>
        )}
      </div>

      {/* Institutional PDF Export Confirmation / Error Notice */}
      {pdfNotice && (
        <div
          role="status"
          className="mt-3 flex flex-wrap items-center justify-between gap-2 rounded border border-emerald-500/30 bg-emerald-500/10 px-2.5 py-1.5 text-[11px] font-mono text-emerald-300 tabular-nums"
        >
          <span className="truncate">
            Exported {pdfNotice.filename} ({pdfNotice.pageCount} page · SHA256 {pdfNotice.snapshotHash.slice(0, 10)}...)
          </span>
          <button
            type="button"
            onClick={() => setPdfNotice(null)}
            className="text-emerald-200 hover:text-white whitespace-nowrap shrink-0 cursor-pointer"
          >
            Dismiss
          </button>
        </div>
      )}
      {pdfError && (
        <div
          role="alert"
          className="mt-3 flex items-center justify-between gap-2 rounded border border-rose-500/30 bg-rose-500/10 px-2.5 py-1.5 text-[11px] font-mono text-rose-300"
        >
          <span>{pdfError}</span>
          <button
            type="button"
            onClick={() => setPdfError(null)}
            className="text-rose-200 hover:text-white whitespace-nowrap shrink-0 cursor-pointer"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Action Footer */}
      <div className="flex flex-wrap items-center justify-between gap-3 pt-4 border-t border-slate-800/80 mt-4">
        <span className="text-[11px] font-mono text-slate-500 whitespace-nowrap shrink-0">
          Plan ID: {plan.id}
        </span>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            disabled={isExportingPdf}
            onClick={handleExportPdf}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-200 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded transition-colors whitespace-nowrap shrink-0 disabled:opacity-50 cursor-pointer"
            title="Download formatted one-page PDF summary of technical rationale and risk parameters"
          >
            <FileDown className="w-3.5 h-3.5 text-amber-400 shrink-0" aria-hidden="true" />
            <span>{isExportingPdf ? 'Exporting...' : 'PDF Export'}</span>
          </button>
          {onInspectRationale && (
            <button
              type="button"
              onClick={() => onInspectRationale(plan)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-200 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded transition-colors whitespace-nowrap shrink-0 cursor-pointer"
              title="Inspect underlying directional logic, technical triggers, and sentiment evidence"
            >
              <Scale className="w-3.5 h-3.5 text-amber-400 shrink-0" aria-hidden="true" />
              <span>Bias Rationale</span>
            </button>
          )}
          {onSelectForCFD && (
            <button
              type="button"
              onClick={() => onSelectForCFD(plan)}
              className="px-3 py-1.5 text-xs font-medium text-amber-400 bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/30 rounded transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              Calculate CFD Margin
            </button>
          )}
          {onExecutePaper && !plan.isAbstained && !isHold && (
            <button
              type="button"
              onClick={() =>
                onExecutePaper(
                  plan,
                  pnlProjection.suggestedSize > 0 ? pnlProjection.suggestedSize : undefined
                )
              }
              className="px-3 py-1.5 text-xs font-medium text-slate-900 bg-amber-400 hover:bg-amber-300 rounded transition-colors font-semibold whitespace-nowrap shrink-0 cursor-pointer tabular-nums"
              title="Record simulated order to paper trading journal using calculated risk lot size. Zero live order routing."
            >
              Paper Execute (
              {pnlProjection.suggestedSize > 0
                ? `${pnlProjection.suggestedSize.toFixed(sizeDecimals)}L`
                : 'Sim'}
              )
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
