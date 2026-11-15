/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * Aurum Intelligence — Contextual Value-Driven Paywall Gate Modal
 * Prominently presents expected value ($E > 0) and the 100% Non-Cash Stop-Loss Signal Credit Refund Policy.
 */

import React, { useEffect } from 'react';
import { UserEntitlementState } from '../services/monetizationEngine';
import {
  Zap,
  RotateCcw,
  ArrowRight,
  X,
} from 'lucide-react';

interface PaywallGateModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  featureDescription: string;
  entitlementState: UserEntitlementState;
  onConfirmUnlock: () => void;
  onOpenPricingHub: () => void;
  costCredits?: number;
}

export const PaywallGateModal: React.FC<PaywallGateModalProps> = ({
  isOpen,
  onClose,
  title,
  featureDescription,
  entitlementState,
  onConfirmUnlock,
  onOpenPricingHub,
  costCredits = 1,
}) => {
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const hasEnoughCredits = entitlementState.creditsBalance >= costCredits;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-fade-in font-sans"
      role="dialog"
      aria-modal="true"
      aria-labelledby="paywall-modal-title"
    >
      <div className="relative w-full max-w-md bg-slate-900 border border-slate-800 rounded-xl shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-800 bg-slate-950/60">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-amber-500/10 border border-amber-500/30 flex items-center justify-center">
              <Zap className="w-4 h-4 text-amber-400" />
            </div>
            <div>
              <span className="text-[10px] font-mono uppercase tracking-wider text-amber-400 font-semibold block">
                Institutional Alpha Unlock
              </span>
              <h3 id="paywall-modal-title" className="text-sm font-bold text-slate-100">{title}</h3>
            </div>
          </div>
          <button
            type="button"
            aria-label="Close unlock modal"
            onClick={onClose}
            className="min-h-[40px] min-w-[40px] flex items-center justify-center rounded-md text-slate-400 hover:text-slate-100 hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-5 space-y-4 text-xs">
          <p className="text-slate-300 leading-relaxed">{featureDescription}</p>

          {/* Value For Money Guarantee Card */}
          <div className="bg-emerald-950/30 border border-emerald-500/30 p-3.5 rounded-lg space-y-1.5">
            <div className="flex items-center gap-2 text-emerald-400 font-bold font-mono">
              <RotateCcw className="w-4 h-4" />
              <span>100% Non-Cash Signal Credit Refund</span>
            </div>
            <p className="text-slate-300 text-[11px] leading-relaxed">
              If this verified trade plan stops out or gets structurally invalidated before reaching
              Target 1, your <strong className="text-slate-100">{costCredits} credit</strong> will be
              automatically returned to your non-cash credit balance.
            </p>
          </div>

          {/* Credits Balance Status */}
          <div className="flex items-center justify-between p-3 rounded-lg bg-slate-950 border border-slate-800 font-mono">
            <div>
              <span className="text-[10px] text-slate-500 block uppercase">Your Balance</span>
              <span className="text-sm font-bold text-slate-200">
                {entitlementState.creditsBalance} Available Credits
              </span>
            </div>
            <div className="text-right">
              <span className="text-[10px] text-slate-500 block uppercase">Unlock Cost</span>
              <span className="text-sm font-bold text-amber-400">
                {costCredits} Credit
              </span>
            </div>
          </div>

          {/* Buttons */}
          <div className="space-y-2 pt-1">
            {hasEnoughCredits ? (
              <button
                type="button"
                onClick={() => {
                  onConfirmUnlock();
                  onClose();
                }}
                className="w-full flex items-center justify-center gap-2 py-2.5 px-4 bg-amber-400 hover:bg-amber-300 text-slate-950 font-bold text-xs rounded-lg transition-colors shadow-md"
              >
                <span>Unlock Setup (1 Credit · Non-Cash Stop Refund)</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            ) : (
              <button
                type="button"
                onClick={() => {
                  onClose();
                  onOpenPricingHub();
                }}
                className="w-full flex items-center justify-center gap-2 py-2.5 px-4 bg-amber-400 hover:bg-amber-300 text-slate-950 font-bold text-xs rounded-lg transition-colors shadow-md"
              >
                <span>Top Up Credits ($9 for 25) or Upgrade</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            )}

            <button
              type="button"
              onClick={() => {
                onClose();
                onOpenPricingHub();
              }}
              className="w-full flex items-center justify-center gap-1.5 py-2 px-3 text-slate-400 hover:text-slate-200 text-[11px] font-mono transition-colors"
            >
              <span>Explore Unlimited Pro Pass & Partner-Sponsored Pro</span>
            </button>
          </div>
        </div>

        {/* Footer */}
        <div className="px-5 py-2.5 bg-slate-950/80 border-t border-slate-800 text-[10px] font-mono text-slate-500 flex items-center justify-between">
          <span>Zero Lock-in Contract</span>
          <span>Daily 3 Credits Regenerate Free</span>
        </div>
      </div>
    </div>
  );
};
