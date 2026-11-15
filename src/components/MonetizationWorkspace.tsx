/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * Aurum Intelligence — Value-First Commercialization & Membership Hub
 * Features an interactive ROI Calculator, 3-tier matrix, credit packs, and Partner-Sponsored Pro access.
 */

import React, { useState } from 'react';
import {
  BROKER_PARTNERS,
  CREDIT_PACKS,
  CreditPack,
  MembershipTier,
  UserEntitlementState,
} from '../services/monetizationEngine';
import {
  Zap,
  CreditCard,
  CheckCircle2,
  RotateCcw,
  Calculator,
  Lock,
  Award,
} from 'lucide-react';

interface MonetizationWorkspaceProps {
  entitlementState: UserEntitlementState;
  onOpenCheckout: (item: {
    type: 'PACK' | 'TIER';
    id: string;
    title: string;
    priceUsd: number;
    billingPeriod?: 'month' | 'year' | 'one-time';
    description: string;
  }) => void;
  onLinkBroker: (brokerId: string, accountNo: string) => void;
}

export const MonetizationWorkspace: React.FC<MonetizationWorkspaceProps> = ({
  entitlementState,
  onOpenCheckout,
  onLinkBroker,
}) => {
  // Value-for-Money ROI Calculator state
  const [estimatedLotsPerMonth, setEstimatedLotsPerMonth] = useState<number>(6);
  const [activeTab, setActiveTab] = useState<'TIERS' | 'CREDITS' | 'BROKER_REBATES' | 'ROI_CALC'>('TIERS');

  // Broker linking form state
  const [selectedBrokerId, setSelectedBrokerId] = useState<string>('ic_markets');
  const [brokerAccountInput, setBrokerAccountInput] = useState<string>('');
  const [brokerLinkSuccess, setBrokerLinkSuccess] = useState<boolean>(false);

  // ROI Calculator math
  const estimatedSlippageSaved = Math.round(estimatedLotsPerMonth * 45);
  const estimatedBadTradesAvoided = Math.round(estimatedLotsPerMonth * 75);
  const estimatedRebatesEarned = Math.round(estimatedLotsPerMonth * 2.5);
  const totalMonthlyValue = estimatedSlippageSaved + estimatedBadTradesAvoided + estimatedRebatesEarned;
  const proMonthlyCost = 49;
  const netRoiMultiplier = ((totalMonthlyValue - proMonthlyCost) / proMonthlyCost).toFixed(1);

  const handleLinkBrokerSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!brokerAccountInput.trim()) return;
    onLinkBroker(selectedBrokerId, brokerAccountInput.trim());
    setBrokerLinkSuccess(true);
    setTimeout(() => setBrokerLinkSuccess(false), 4000);
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto font-sans">
      {/* Top Value Banner */}
      <div className="relative overflow-hidden bg-gradient-to-r from-slate-900 via-slate-900 to-amber-950/40 border border-slate-800 rounded-xl p-6 shadow-xl">
        <div className="flex flex-wrap items-center justify-between gap-6">
          <div className="max-w-2xl space-y-2">
            <div className="flex items-center gap-2">
              <span className="text-xs font-mono text-amber-400 uppercase tracking-wider font-semibold">
                GoldVista Commercial Ecosystem
              </span>
              <span className="text-[10px] font-mono text-emerald-400">
                · Non-Cash Signal Credit Refund Policy
              </span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-bold text-slate-100 tracking-tight">
              Institutional Commodity Intelligence Built for Measurable ROI
            </h1>
            <p className="text-xs sm:text-sm text-slate-400 leading-relaxed">
              Quantitative commodity research, audited scenario tracking, and non-cash stop-loss signal credit refunds
              (research &amp; paper-simulation only; illustrative ROI scenarios subject to legal/commercial terms).
            </p>
          </div>

          {/* User Active Entitlement Summary Card */}
          <div className="bg-slate-950/80 border border-slate-800 p-4 rounded-xl min-w-[260px] font-mono text-xs tabular-nums space-y-2">
            <div className="flex items-center justify-between pb-2 border-b border-slate-800">
              <span className="text-slate-400 uppercase">Active Status</span>
              <span
                className={`px-2 py-0.5 rounded font-bold text-[11px] ${
                  entitlementState.tier === 'ALPHA'
                    ? 'bg-purple-500/10 text-purple-400 border border-purple-500/30'
                    : entitlementState.tier === 'PRO'
                    ? 'bg-amber-500/10 text-amber-300 border border-amber-500/30'
                    : 'bg-slate-800 text-slate-300'
                }`}
              >
                {entitlementState.tier} MEMBER
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-slate-400">Available Credits</span>
              <span className="text-base font-bold text-amber-400">
                {entitlementState.creditsBalance} ⬡
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-slate-400">Refunded Credits</span>
              <span className="text-emerald-400 font-bold">
                +{entitlementState.refundedCreditsTotal} (Protected)
              </span>
            </div>
            <div className="flex items-center justify-between pt-1 border-t border-slate-800/80">
              <span className="text-slate-400">Estimated Capital Saved</span>
              <span className="text-slate-100 font-bold">
                ${entitlementState.estimatedMoneySavedDollars.toLocaleString()}
              </span>
            </div>
          </div>
        </div>

        {/* Tab Navigation Controls */}
        <div className="flex flex-wrap items-center gap-2 mt-6 pt-4 border-t border-slate-800/80 font-mono text-xs">
          <button
            onClick={() => setActiveTab('TIERS')}
            className={`px-3.5 py-2 rounded-lg font-semibold transition-all ${
              activeTab === 'TIERS'
                ? 'bg-amber-400 text-slate-950 shadow-md'
                : 'bg-slate-800/70 text-slate-300 hover:bg-slate-800'
            }`}
          >
            Membership Plans (SaaS)
          </button>
          <button
            onClick={() => setActiveTab('CREDITS')}
            className={`px-3.5 py-2 rounded-lg font-semibold transition-all ${
              activeTab === 'CREDITS'
                ? 'bg-amber-400 text-slate-950 shadow-md'
                : 'bg-slate-800/70 text-slate-300 hover:bg-slate-800'
            }`}
          >
            Pay-Per-Signal Credits ($9+)
          </button>
          <button
            onClick={() => setActiveTab('BROKER_REBATES')}
            className={`px-3.5 py-2 rounded-lg font-semibold transition-all ${
              activeTab === 'BROKER_REBATES'
                ? 'bg-amber-400 text-slate-950 shadow-md'
                : 'bg-slate-800/70 text-slate-300 hover:bg-slate-800'
            }`}
          >
            Partner Broker Rebate Access
          </button>
          <button
            onClick={() => setActiveTab('ROI_CALC')}
            className={`px-3.5 py-2 rounded-lg font-semibold transition-all flex items-center gap-1.5 ${
              activeTab === 'ROI_CALC'
                ? 'bg-amber-400 text-slate-950 shadow-md'
                : 'bg-slate-800/70 text-slate-300 hover:bg-slate-800'
            }`}
          >
            <Calculator className="w-3.5 h-3.5" /> Value ROI Simulator
          </button>
        </div>
      </div>

      {/* 1. MEMBERSHIP TIERS TAB */}
      {activeTab === 'TIERS' && (
        <div className="space-y-6">
          <div className="text-center max-w-xl mx-auto space-y-1">
            <h2 className="text-xl font-bold text-slate-100">Straightforward Institutional Pricing</h2>
            <p className="text-xs text-slate-400">
              No hidden fees. Free tier with 3 daily unlocks. Upgrade for unlimited alpha or subsidize 100% via brokers.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Free Scout */}
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 flex flex-col justify-between">
              <div>
                <span className="text-xs font-mono text-slate-500 uppercase tracking-wider block">
                  For Retail Learners
                </span>
                <h3 className="text-lg font-bold text-slate-100 mt-1">Free Scout</h3>
                <div className="mt-4 pb-4 border-b border-slate-800 font-mono">
                  <span className="text-3xl font-extrabold text-slate-100">$0</span>
                  <span className="text-xs text-slate-500 ml-1">/ forever</span>
                </div>

                <ul className="mt-5 space-y-3 text-xs text-slate-300 font-sans">
                  <li className="flex items-start gap-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                    <span>Real-time multi-commodity live streaming quotes</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                    <span><strong>3 Free verified trade unlocks</strong> daily (regenerates free)</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                    <span>10-Strategy baseline walk-forward simulations</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                    <span>CFD Margin & Position Sizing Calculator</span>
                  </li>
                  <li className="flex items-start gap-2 text-slate-500">
                    <Lock className="w-4 h-4 text-slate-600 shrink-0 mt-0.5" />
                    <span>Parameter tuning and CSV backtest exports</span>
                  </li>
                  <li className="flex items-start gap-2 text-slate-500">
                    <Lock className="w-4 h-4 text-slate-600 shrink-0 mt-0.5" />
                    <span>Instant real-time Telegram signal webhooks</span>
                  </li>
                </ul>
              </div>

              <div className="mt-8 pt-4 border-t border-slate-800">
                <span className="w-full block py-2.5 text-center text-xs font-mono font-bold text-slate-400 bg-slate-950 border border-slate-800 rounded-lg">
                  Current Free Default
                </span>
              </div>
            </div>

            {/* Pro Analyst (Featured) */}
            <div className="relative bg-slate-900 border-2 border-amber-500/70 rounded-xl p-6 shadow-2xl flex flex-col justify-between">
              <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-0.5 rounded-full bg-amber-400 text-slate-950 text-[10px] font-mono font-extrabold uppercase tracking-wider">
                Most Popular · High ROI
              </div>

              <div>
                <span className="text-xs font-mono text-amber-400 uppercase tracking-wider block">
                  For Serious Traders & Prop Challengers
                </span>
                <h3 className="text-lg font-bold text-slate-100 mt-1">Pro Analyst</h3>
                <div className="mt-4 pb-4 border-b border-slate-800 font-mono">
                  <span className="text-3xl font-extrabold text-amber-400">$49</span>
                  <span className="text-xs text-slate-400 ml-1">/ month</span>
                  <span className="block text-[11px] text-emerald-400 font-semibold mt-1">
                    Or Partner-Sponsored via ECN Broker
                  </span>
                </div>

                <ul className="mt-5 space-y-3 text-xs text-slate-200 font-sans">
                  <li className="flex items-start gap-2">
                    <CheckCircle2 className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                    <span><strong>Unlimited verified trade signal unlocks</strong> (no credits needed)</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <CheckCircle2 className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                    <span><strong>Interactive Backtest Parameter Tuner</strong> + Unlimited CSV exports</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <CheckCircle2 className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                    <span><strong>Prop Firm Challenge Guardrail Mode</strong> (prevents test failures)</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <CheckCircle2 className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                    <span>Instant real-time Telegram signal push notifications</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <CheckCircle2 className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                    <span>Verified PDF Briefs & high-res charting image download</span>
                  </li>
                </ul>
              </div>

              <div className="mt-8 pt-4 border-t border-slate-800 space-y-2">
                <button
                  onClick={() =>
                    onOpenCheckout({
                      type: 'TIER',
                      id: 'pro_monthly',
                      title: 'GoldVista Pro Analyst Pass',
                      priceUsd: 49,
                      billingPeriod: 'month',
                      description: 'Unlimited verified signals, backtest CSV tuner, and prop firm guardrail.',
                    })
                  }
                  className="w-full flex items-center justify-center gap-2 py-3 px-4 bg-amber-400 hover:bg-amber-300 text-slate-950 font-bold text-xs rounded-lg transition-colors shadow-lg"
                >
                  <CreditCard className="w-4 h-4" />
                  Upgrade to Pro ($49/mo)
                </button>
                <button
                  onClick={() => setActiveTab('BROKER_REBATES')}
                  className="w-full text-center text-[11px] font-mono text-amber-400/90 hover:text-amber-300 underline"
                >
                  Or Unlock Partner-Sponsored Pro via ECN Broker →
                </button>
              </div>
            </div>

            {/* Institutional Alpha */}
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 flex flex-col justify-between">
              <div>
                <span className="text-xs font-mono text-purple-400 uppercase tracking-wider block">
                  For Funds & Professional Desks
                </span>
                <h3 className="text-lg font-bold text-slate-100 mt-1">Institutional Alpha</h3>
                <div className="mt-4 pb-4 border-b border-slate-800 font-mono">
                  <span className="text-3xl font-extrabold text-slate-100">$199</span>
                  <span className="text-xs text-slate-500 ml-1">/ month</span>
                </div>

                <ul className="mt-5 space-y-3 text-xs text-slate-300 font-sans">
                  <li className="flex items-start gap-2">
                    <CheckCircle2 className="w-4 h-4 text-purple-400 shrink-0 mt-0.5" />
                    <span>Everything in Pro Analyst with unlimited access</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <CheckCircle2 className="w-4 h-4 text-purple-400 shrink-0 mt-0.5" />
                    <span><strong>Raw Macroeconomic Vintage Downloads</strong> & TIPS Real Yield z-scores</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <CheckCircle2 className="w-4 h-4 text-purple-400 shrink-0 mt-0.5" />
                    <span>Full AI Advisory Council adversarial debate audio & transcripts</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <CheckCircle2 className="w-4 h-4 text-purple-400 shrink-0 mt-0.5" />
                    <span>Whitelabel export rights for client publication and Facebook page</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <CheckCircle2 className="w-4 h-4 text-purple-400 shrink-0 mt-0.5" />
                    <span>Dedicated analyst API access & custom webhooks</span>
                  </li>
                </ul>
              </div>

              <div className="mt-8 pt-4 border-t border-slate-800">
                <button
                  onClick={() =>
                    onOpenCheckout({
                      type: 'TIER',
                      id: 'alpha_monthly',
                      title: 'GoldVista Institutional Alpha Pass',
                      priceUsd: 199,
                      billingPeriod: 'month',
                      description: 'Full council transcripts, macro vintage downloads, and whitelabel rights.',
                    })
                  }
                  className="w-full flex items-center justify-center gap-2 py-2.5 px-4 bg-slate-800 hover:bg-slate-700 text-slate-200 font-semibold text-xs rounded-lg transition-colors border border-slate-700"
                >
                  Get Institutional Alpha
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 2. PAY-PER-SIGNAL CREDITS TAB */}
      {activeTab === 'CREDITS' && (
        <div className="space-y-6">
          <div className="text-center max-w-xl mx-auto space-y-1">
            <h2 className="text-xl font-bold text-slate-100">Pay-Per-Signal Credit Packs</h2>
            <p className="text-xs text-slate-400">
              Only pay for the exact setups you want. Backed by our Non-Cash Stop-Loss Signal Credit Refund policy.
            </p>
          </div>

          {/* Refund Guarantee Callout */}
          <div className="bg-emerald-950/30 border border-emerald-500/30 p-4 rounded-xl flex items-start gap-3 max-w-3xl mx-auto">
            <RotateCcw className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
            <div className="text-xs text-slate-300">
              <strong className="text-emerald-400 block font-bold text-sm">
                How the 100% Stop-Loss Signal Credit Refund (Non-Cash) Works:
              </strong>
              <span>
                When you unlock any setup using 1 Signal Credit, our deterministic monitor tracks settlement outcomes.
                If the trade stops out before reaching Target 1, <strong>1 Signal Credit is returned to your account balance (non-cash credit refund only; no fiat/cash refund)</strong>.
              </span>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-4xl mx-auto">
            {CREDIT_PACKS.map((pack) => (
              <div
                key={pack.id}
                className={`bg-slate-900 border rounded-xl p-5 flex flex-col justify-between transition-all ${
                  pack.popular
                    ? 'border-amber-500/70 shadow-lg ring-1 ring-amber-500/30'
                    : 'border-slate-800 hover:border-slate-700'
                }`}
              >
                <div>
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-mono uppercase text-slate-500 font-semibold">
                      {pack.name}
                    </span>
                    {pack.popular && (
                      <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-amber-500/20 text-amber-300 font-bold">
                        Best Value
                      </span>
                    )}
                  </div>

                  <div className="mt-3 font-mono">
                    <span className="text-3xl font-extrabold text-slate-100">
                      {pack.credits + pack.bonusCredits}
                    </span>
                    <span className="text-xs text-amber-400 ml-1.5 font-bold">Credits</span>
                    <span className="block text-xl font-bold text-slate-300 mt-2">
                      ${pack.priceUsd} <span className="text-xs text-slate-500 font-normal">USD</span>
                    </span>
                  </div>

                  <p className="text-xs text-slate-400 mt-2 pb-4 border-b border-slate-800">
                    {pack.badge}
                  </p>

                  <ul className="mt-4 space-y-2 text-xs text-slate-300">
                    <li className="flex items-center gap-2">
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                      <span>{pack.credits + pack.bonusCredits} high-conviction trade unlocks</span>
                    </li>
                    <li className="flex items-center gap-2">
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                      <span>100% Signal Credit Refund (Non-Cash) on Stop-Out</span>
                    </li>
                    <li className="flex items-center gap-2">
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                      <span>Never expire · Use whenever you trade</span>
                    </li>
                  </ul>
                </div>

                <button
                  onClick={() =>
                    onOpenCheckout({
                      type: 'PACK',
                      id: pack.id,
                      title: `${pack.name} (${pack.credits + pack.bonusCredits} Credits)`,
                      priceUsd: pack.priceUsd,
                      description: `Includes ${pack.credits + pack.bonusCredits} signal credits with stop-loss Signal Credit Refund protection (non-cash).`,
                    })
                  }
                  className="mt-6 w-full py-2.5 px-4 bg-amber-400 hover:bg-amber-300 text-slate-950 font-bold text-xs rounded-lg transition-colors flex items-center justify-center gap-2 shadow-md"
                >
                  <CreditCard className="w-4 h-4" />
                  Top Up ${pack.priceUsd}
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 3. 100% FREE VIA BROKER REBATES TAB */}
      {activeTab === 'BROKER_REBATES' && (
        <div className="space-y-6 max-w-4xl mx-auto">
          <div className="text-center max-w-xl mx-auto space-y-1">
            <h2 className="text-xl font-bold text-slate-100">Unlock Partner-Sponsored GoldVista Pro Access</h2>
            <p className="text-xs text-slate-400">
              Trade qualifying commodity volume with our ASIC/FCA regulated partner brokers to qualify for partner-sponsored GoldVista Pro subscription coverage.
            </p>
          </div>

          {/* Broker Directory Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {BROKER_PARTNERS.map((b) => (
              <div key={b.id} className="bg-slate-900 border border-slate-800 p-5 rounded-xl space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="text-sm font-bold text-slate-100">{b.name}</h4>
                  <span className="text-xs font-mono font-bold text-amber-400">★ {b.rating}</span>
                </div>
                <p className="text-xs text-slate-400 leading-tight">{b.tagline}</p>
                <div className="pt-2 border-t border-slate-800 text-[11px] font-mono space-y-1.5 text-slate-300">
                  <div>
                    <span className="text-slate-500 block">Regulation</span>
                    <span>{b.regulation}</span>
                  </div>
                  <div>
                    <span className="text-slate-500 block">Typical Gold Spread</span>
                    <span className="text-emerald-400 font-bold">{b.typicalGoldSpread}</span>
                  </div>
                  <div>
                    <span className="text-slate-500 block">Min Deposit</span>
                    <span>${b.minDeposit} USD</span>
                  </div>
                </div>
                <div className="pt-2 border-t border-slate-800 text-[11px] text-amber-300">
                  {b.perk}
                </div>
              </div>
            ))}
          </div>

          {/* Verification & Linking Card */}
          <div className="bg-slate-900 border border-slate-800 p-6 rounded-xl space-y-4">
            <div className="flex items-center gap-2 pb-3 border-b border-slate-800">
              <Award className="w-5 h-5 text-amber-400" />
              <h3 className="text-base font-bold text-slate-100">
                Link Your Broker Account for Partner-Sponsored Pro Access
              </h3>
            </div>

            <form onSubmit={handleLinkBrokerSubmit} className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs font-mono">
              <div>
                <label className="text-slate-400 block mb-1">Select Partner Broker</label>
                <select
                  value={selectedBrokerId}
                  onChange={(e) => setSelectedBrokerId(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-slate-200"
                >
                  {BROKER_PARTNERS.map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-slate-400 block mb-1">Trading Account ID / Login #</label>
                <input
                  type="text"
                  placeholder="e.g. 8492019"
                  value={brokerAccountInput}
                  onChange={(e) => setBrokerAccountInput(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-slate-200"
                  required
                />
              </div>

              <div className="flex items-end">
                <button
                  type="submit"
                  className="w-full py-2.5 px-4 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs rounded-lg transition-colors flex items-center justify-center gap-2 shadow-md"
                >
                  <CheckCircle2 className="w-4 h-4" />
                  Activate Partner-Sponsored Pro Access
                </button>
              </div>
            </form>

            {brokerLinkSuccess && (
              <div className="p-3 bg-emerald-500/10 border border-emerald-500/30 rounded-lg text-xs text-emerald-400 font-mono flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 shrink-0" />
                <span>Account linked. Partner-Sponsored GoldVista Pro activated (non-cash rebate allocation) with 50 welcome signal credits.</span>
              </div>
            )}
          </div>
        </div>
      )}

      {/* 4. ROI SIMULATOR TAB */}
      {activeTab === 'ROI_CALC' && (
        <div className="space-y-6 max-w-3xl mx-auto">
          <div className="text-center max-w-xl mx-auto space-y-1">
            <h2 className="text-xl font-bold text-slate-100">Value for Money & Mathematical ROI Simulator</h2>
            <p className="text-xs text-slate-400">
              See the concrete dollar value GoldVista delivers compared to the $49/mo membership cost.
            </p>
          </div>

          <div className="bg-slate-900 border border-slate-800 p-6 rounded-xl space-y-6">
            <div>
              <div className="flex items-center justify-between text-xs font-mono mb-2">
                <span className="text-slate-300 font-semibold">Your Estimated Monthly Gold/Commodity Trading Volume:</span>
                <span className="text-amber-400 font-bold text-sm">{estimatedLotsPerMonth} Standard Lots / Month</span>
              </div>
              <input
                type="range"
                min="1"
                max="30"
                step="1"
                value={estimatedLotsPerMonth}
                onChange={(e) => setEstimatedLotsPerMonth(Number(e.target.value))}
                className="w-full h-2 bg-slate-950 rounded-lg appearance-none cursor-pointer accent-amber-400"
              />
              <div className="flex justify-between text-[10px] font-mono text-slate-500 mt-1">
                <span>1 Lot (Casual)</span>
                <span>10 Lots (Active Swing)</span>
                <span>30 Lots (Full-Time Trader)</span>
              </div>
            </div>

            {/* Breakdown Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 font-mono text-xs tabular-nums">
              <div className="bg-slate-950 p-3.5 rounded-lg border border-slate-800">
                <span className="text-[10px] text-slate-500 block uppercase">Slippage & Timing Alpha</span>
                <span className="text-lg font-bold text-emerald-400 mt-1 block">+${estimatedSlippageSaved}</span>
                <span className="text-[10px] text-slate-500 block">From disciplined limit corridors</span>
              </div>

              <div className="bg-slate-950 p-3.5 rounded-lg border border-slate-800">
                <span className="text-[10px] text-slate-500 block uppercase">Bad Entry Avoidance</span>
                <span className="text-lg font-bold text-emerald-400 mt-1 block">+${estimatedBadTradesAvoided}</span>
                <span className="text-[10px] text-slate-500 block">Aversive council invalidations</span>
              </div>

              <div className="bg-slate-950 p-3.5 rounded-lg border border-slate-800">
                <span className="text-[10px] text-slate-500 block uppercase">Broker Rebates Earned</span>
                <span className="text-lg font-bold text-amber-400 mt-1 block">+${estimatedRebatesEarned}</span>
                <span className="text-[10px] text-slate-500 block">$2.50 / lot cash back</span>
              </div>
            </div>

            {/* Net Comparison Card */}
            <div className="bg-gradient-to-r from-amber-500/10 to-emerald-500/10 border border-amber-500/30 p-4 rounded-xl flex items-center justify-between font-mono">
              <div>
                <span className="text-xs text-slate-300 block">Total Estimated Monthly Value Delivered:</span>
                <span className="text-2xl font-extrabold text-emerald-400">${totalMonthlyValue} / month</span>
                <span className="text-[10px] text-slate-400 block mt-0.5">
                  Investment: $49/mo (or $0 via Broker) → <strong className="text-amber-300 font-bold">{netRoiMultiplier}x Net ROI</strong>
                </span>
              </div>

              <button
                onClick={() => setActiveTab('TIERS')}
                className="px-4 py-2.5 bg-amber-400 hover:bg-amber-300 text-slate-950 font-bold text-xs rounded-lg transition-colors shadow-md"
              >
                Join Pro Today
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
