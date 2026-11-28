/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * Aurum Intelligence — Role-Based Access Control (RBAC) Gating Guard
 * Displays institutional lock notifications and direct upgrade / broker sponsorship CTAs.
 */

import React from 'react';
import { UserRole, AccessCheckResult } from '../services/authService';
import {
  Lock,
  ShieldCheck,
  Zap,
  CreditCard,
  Building2,
  CheckCircle2,
  UserCheck,
} from 'lucide-react';

interface AccessGateGuardProps {
  accessCheck: AccessCheckResult;
  onOpenAuth: (mode?: 'LOGIN' | 'ENROLL') => void;
  onOpenPricingHub: () => void;
  onOpenCheckout: (item: {
    type: 'PACK' | 'TIER';
    id: string;
    title: string;
    priceUsd: number;
    billingPeriod?: 'month' | 'year' | 'one-time';
    description: string;
  }) => void;
  onSwitchPersona: (role: UserRole) => void;
  onChangeTier?: (role: Exclude<UserRole, 'GUEST'>) => void;
}

export const AccessGateGuard: React.FC<AccessGateGuardProps> = ({
  accessCheck,
  onOpenAuth,
  onOpenPricingHub,
  onOpenCheckout,
  onSwitchPersona,
  onChangeTier,
}) => {
  const isAlphaRequired = accessCheck.requiredRole === 'ALPHA';
  const isProRequired = accessCheck.requiredRole === 'PRO';
  const isGuest = accessCheck.currentRole === 'GUEST';

  return (
    <div className="min-h-[500px] flex items-center justify-center p-4">
      <div className="w-full max-w-2xl bg-slate-900 border border-slate-800 rounded-xl p-6 sm:p-8 shadow-2xl relative overflow-hidden">
        {/* Subtle background glow */}
        <div className="absolute -top-24 -right-24 w-64 h-64 bg-amber-500/5 rounded-full blur-3xl pointer-events-none" />

        {/* Top Header Tag */}
        <div className="flex items-center justify-between pb-4 border-b border-slate-800">
          <div className="flex items-center gap-2 text-xs font-mono">
            <div className="w-7 h-7 rounded-lg bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400">
              <Lock className="w-3.5 h-3.5" />
            </div>
            <div>
              <span className="text-[10px] uppercase text-amber-400 font-bold block">
                Access Restricted
              </span>
              <span className="text-slate-300 font-medium">
                {accessCheck.requiredRole} Tier Required
              </span>
            </div>
          </div>

          <div className="text-right font-mono text-[11px]">
            <span className="text-slate-500 block uppercase text-[10px]">Your Current Tier</span>
            <span className="text-slate-200 font-bold">{accessCheck.currentRole}</span>
          </div>
        </div>

        {/* Workspace Title & Purpose */}
        <div className="my-6 space-y-2">
          <h2 className="text-xl sm:text-2xl font-bold text-slate-100 font-sans tracking-tight">
            {accessCheck.workspaceTitle}
          </h2>
          <p className="text-xs sm:text-sm text-slate-300 leading-relaxed font-sans">
            {accessCheck.reason}
          </p>
        </div>

        {/* Value Proposition Highlights */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-4 bg-slate-950/70 border border-slate-800/80 rounded-lg text-xs font-mono text-slate-300 mb-6">
          <div className="flex items-start gap-2">
            <CheckCircle2 className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
            <span>Institutional quantitative models backed by mathematical expectation ($E &gt; 0$)</span>
          </div>
          <div className="flex items-start gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
            <span>Partner-sponsored Pro option via ECN broker rebate allocation</span>
          </div>
          <div className="flex items-start gap-2">
            <CheckCircle2 className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
            <span>Prop firm challenge guardrail filters to preserve account equity</span>
          </div>
          <div className="flex items-start gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
            <span>Direct Telegram & webhook order signals with low-latency delivery</span>
          </div>
        </div>

        {/* Primary Action Buttons */}
        <div className="flex flex-wrap items-center gap-3 pt-2">
          {isGuest ? (
            <>
              <button
                type="button"
                onClick={() => onOpenAuth('ENROLL')}
                className="flex-1 min-w-[200px] min-h-[44px] flex items-center justify-center gap-2 py-3 px-5 bg-gradient-to-r from-amber-500 to-amber-400 hover:from-amber-400 hover:to-amber-300 text-slate-950 font-bold rounded-lg text-xs shadow-md transition-all cursor-pointer"
              >
                <Zap className="w-4 h-4 fill-slate-950" />
                <span>Sign Up Free (5 Welcome Credits)</span>
              </button>
              <button
                type="button"
                onClick={() => onOpenAuth('LOGIN')}
                className="min-h-[44px] px-5 py-3 bg-slate-800 hover:bg-slate-700 text-slate-100 font-medium text-xs rounded-lg transition-colors border border-slate-700 cursor-pointer"
              >
                Sign In
              </button>
            </>
          ) : isAlphaRequired ? (
            <button
              onClick={() =>
                onOpenCheckout({
                  type: 'TIER',
                  id: 'ALPHA',
                  title: 'Institutional Alpha Membership',
                  priceUsd: 199,
                  billingPeriod: 'month',
                  description: 'All Pro features + AI Specialist Advisory Council & VIP Gemini analyst.',
                })
              }
              className="flex-1 min-w-[220px] flex items-center justify-center gap-2 py-3 px-5 bg-gradient-to-r from-amber-500 to-amber-400 hover:from-amber-400 hover:to-amber-300 text-slate-950 font-bold rounded-lg text-xs shadow-md transition-all cursor-pointer"
            >
              <ShieldCheck className="w-4 h-4" />
              <span>Upgrade to Alpha ($199/mo)</span>
            </button>
          ) : (
            <>
              <button
                onClick={() =>
                  onOpenCheckout({
                    type: 'TIER',
                    id: 'PRO',
                    title: 'GoldVista Pro Membership',
                    priceUsd: 49,
                    billingPeriod: 'month',
                    description: 'Unlimited signals, walk-forward backtesting, and Telegram alerts.',
                  })
                }
                className="flex-1 min-w-[200px] flex items-center justify-center gap-2 py-3 px-5 bg-gradient-to-r from-amber-500 to-amber-400 hover:from-amber-400 hover:to-amber-300 text-slate-950 font-bold rounded-lg text-xs shadow-md transition-all cursor-pointer"
              >
                <CreditCard className="w-4 h-4" />
                <span>Upgrade to Pro ($49/mo)</span>
              </button>

              <button
                onClick={onOpenPricingHub}
                className="flex items-center gap-2 px-4 py-3 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 rounded-lg text-xs font-mono font-medium transition-colors"
              >
                <Building2 className="w-4 h-4" />
                <span>Partner-Sponsored Pro via Broker</span>
              </button>
            </>
          )}

          {/* Quick Tier Preview (Preserves Current Identity) or Demo Preview (Guest) */}
          <button
            type="button"
            onClick={() => {
              if (!isGuest && onChangeTier && accessCheck.requiredRole !== 'GUEST') {
                onChangeTier(accessCheck.requiredRole);
              } else {
                onSwitchPersona(accessCheck.requiredRole);
              }
            }}
            className="w-full sm:w-auto px-4 py-2.5 bg-slate-950 hover:bg-slate-800 text-slate-300 hover:text-amber-300 border border-slate-800 hover:border-amber-400/40 rounded-lg text-xs font-mono transition-colors flex items-center justify-center gap-1.5 cursor-pointer whitespace-nowrap"
            title={
              !isGuest && onChangeTier
                ? 'Unlock this tier on your current signed-in account without losing your trades'
                : 'Load sandbox demo persona for immediate feature preview'
            }
          >
            <UserCheck className="w-3.5 h-3.5 text-amber-400 shrink-0" />
            <span>
              {!isGuest && onChangeTier
                ? `Activate ${accessCheck.requiredRole} Tier (Keep My Account)`
                : `Preview ${accessCheck.requiredRole} Demo Account`}
            </span>
          </button>
        </div>
      </div>
    </div>
  );
};
