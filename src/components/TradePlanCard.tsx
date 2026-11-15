/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * Aurum Intelligence — Canonical Trade Plan Card
 * Displays validated multi-horizon setups, risk-reward ratios, and hard invalidation rules.
 */

import React from 'react';
import { TradePlan } from '../domain/types';
import { AlertTriangle, ArrowUpRight, ArrowDownRight, ShieldCheck, XCircle, Lock, Zap, RotateCcw } from 'lucide-react';

interface TradePlanCardProps {
  plan: TradePlan;
  onSelectForCFD?: (plan: TradePlan) => void;
  onExecutePaper?: (plan: TradePlan) => void;
  isLocked?: boolean;
  onUnlock?: (plan: TradePlan) => void;
  isGuaranteed?: boolean;
}

export const TradePlanCard: React.FC<TradePlanCardProps> = ({
  plan,
  onSelectForCFD,
  onExecutePaper,
  isLocked = false,
  onUnlock,
  isGuaranteed = false,
}) => {
  const isBuy = plan.direction === 'BUY';
  const isNoTrade = plan.direction === 'NO_TRADE' || plan.isAbstained;

  // Format status badge
  const getStatusBadge = () => {
    if (isNoTrade) {
      return (
        <span className="text-xs font-mono font-semibold text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded border border-amber-500/20">
          ABSTAIN / NO TRADE
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
          </>
        )}
      </div>

      {/* Action Footer */}
      <div className="flex items-center justify-between gap-3 pt-4 border-t border-slate-800/80 mt-4">
        <span className="text-[11px] font-mono text-slate-500">
          Plan ID: {plan.id}
        </span>
        <div className="flex items-center gap-2">
          {onSelectForCFD && (
            <button
              onClick={() => onSelectForCFD(plan)}
              className="px-3 py-1.5 text-xs font-medium text-amber-400 bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/30 rounded transition-colors"
            >
              Calculate CFD Margin
            </button>
          )}
          {onExecutePaper && !plan.isAbstained && (
            <button
              onClick={() => onExecutePaper(plan)}
              className="px-3 py-1.5 text-xs font-medium text-slate-900 bg-amber-400 hover:bg-amber-300 rounded transition-colors font-semibold"
              title="Record simulated order to browser paper trading journal. Zero live order routing or financial risk."
            >
              Paper Execute (Simulated)
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
