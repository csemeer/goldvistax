/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * Aurum Intelligence — Institutional Public Landing Page & Enrollment Portal
 * Built with bespoke, elegant vector graphics, user detail enrollment, and interactive value simulators.
 */

import React, { useState } from 'react';
import { Quote } from '../domain/types';
import { UserSession, isValidEmailAddress } from '../services/authService';
import {
  ShieldCheck,
  Zap,
  ArrowRight,
  Lock,
  RotateCcw,
  Scale,
  Brain,
  Building2,
  CheckCircle2,
  CandlestickChart,
  User,
  LogOut,
  UserPlus,
  Eye,
  EyeOff,
  AlertCircle,
} from 'lucide-react';

interface LandingPageProps {
  quotes: Record<string, Quote>;
  userSession?: UserSession;
  onLaunchTerminal: () => void;
  onOpenAuth: (mode?: 'LOGIN' | 'ENROLL') => void;
  onLogout?: () => void;
  onOpenCheckout: (item: {
    type: 'PACK' | 'TIER';
    id: string;
    title: string;
    priceUsd: number;
    billingPeriod?: 'month' | 'year' | 'one-time';
    description: string;
  }) => void;
  onEnrollUser?: (data: {
    email: string;
    displayName: string;
    password?: string;
    country: string;
    tradingProfile: {
      primaryHorizon: 'INTRADAY' | 'SWING' | 'PROP_FIRM' | 'MACRO';
      brokerName: string;
      accountSize: string;
      experienceLevel: 'NOVICE' | 'INTERMEDIATE' | 'ADVANCED' | 'INSTITUTIONAL';
    };
  }) => Promise<void> | void;
}

export const LandingPage: React.FC<LandingPageProps> = ({
  quotes,
  userSession,
  onLaunchTerminal,
  onOpenAuth,
  onLogout,
  onOpenCheckout,
  onEnrollUser,
}) => {
  const [activeTab, setActiveTab] = useState<'SWING' | 'INTRADAY' | 'PROP_FIRM'>('SWING');
  const [roiLots, setRoiLots] = useState<number>(6);

  // Embedded User Sign-Up Form State
  const [enrollName, setEnrollName] = useState<string>('');
  const [enrollEmail, setEnrollEmail] = useState<string>('');
  const [enrollPassword, setEnrollPassword] = useState<string>('');
  const [showEnrollPassword, setShowEnrollPassword] = useState<boolean>(false);
  const [enrollCountry, setEnrollCountry] = useState<string>('United States');
  const [enrollHorizon, setEnrollHorizon] = useState<'INTRADAY' | 'SWING' | 'PROP_FIRM' | 'MACRO'>('SWING');
  const [enrollBroker, setEnrollBroker] = useState<string>('ic_markets');
  const [enrollAccountSize, setEnrollAccountSize] = useState<string>('$50,000 - $100,000');
  const [enrollExperience] = useState<'NOVICE' | 'INTERMEDIATE' | 'ADVANCED' | 'INSTITUTIONAL'>('ADVANCED');
  const [enrollError, setEnrollError] = useState<string | null>(null);
  const [isSubmittingEnroll, setIsSubmittingEnroll] = useState<boolean>(false);

  const isAuthenticated = Boolean(userSession && userSession.role !== 'GUEST');

  const goldQuote = quotes['XAUUSD'] || {
    mid: 4048.5,
    bid: 4048.35,
    ask: 4048.65,
    change24hPct: 0.88,
    spreadPips: 30,
  };

  const silverQuote = quotes['XAGUSD'] || { mid: 48.2, change24hPct: 1.45 };
  const wtiQuote = quotes['WTI_CRUDE'] || { mid: 78.4, change24hPct: -0.65 };

  // Calculate dynamic ROI savings
  const slippageSaved = roiLots * 30;
  const commissionRebated = roiLots * 2.5;
  const badTradeAvoidance = 700;
  const totalValueDelivered = slippageSaved + commissionRebated + badTradeAvoidance;
  const netRoiRatio = (totalValueDelivered / 49).toFixed(1);

  const handleEmbeddedSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setEnrollError(null);

    if (enrollName.trim().length < 2) {
      setEnrollError('Please enter your full name or trader handle.');
      return;
    }
    if (!isValidEmailAddress(enrollEmail)) {
      setEnrollError('Please enter a valid email address.');
      return;
    }
    if (enrollPassword.length < 8) {
      setEnrollError('Please create a password of at least 8 characters.');
      return;
    }

    setIsSubmittingEnroll(true);
    try {
      if (onEnrollUser) {
        await onEnrollUser({
          email: enrollEmail.trim(),
          displayName: enrollName.trim(),
          password: enrollPassword,
          country: enrollCountry,
          tradingProfile: {
            primaryHorizon: enrollHorizon,
            brokerName:
              enrollBroker === 'ic_markets'
                ? 'IC Markets Global (Raw ECN)'
                : enrollBroker === 'pepperstone'
                ? 'Pepperstone Razor'
                : enrollBroker === 'tickmill'
                ? 'Tickmill Pro'
                : 'FTMO / Prop Firm',
            accountSize: enrollAccountSize,
            experienceLevel: enrollExperience,
          },
        });
      } else {
        onLaunchTerminal();
      }
    } catch (err: unknown) {
      setEnrollError(err instanceof Error ? err.message : 'Sign-up failed. Please check your details.');
    } finally {
      setIsSubmittingEnroll(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 font-sans selection:bg-amber-500/20 selection:text-amber-300">
      {/* 1. TOP STICKY LANDING NAVBAR */}
      <header className="sticky top-0 z-40 bg-slate-950/90 backdrop-blur-md border-b border-slate-800/80 px-3 sm:px-8 py-3 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2.5 sm:gap-3 min-w-0">
          <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-amber-400 via-amber-500 to-amber-600 flex items-center justify-center shadow-md shrink-0">
            <span className="font-mono font-black text-slate-950 text-base">AU</span>
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <span className="font-bold tracking-tight text-base sm:text-lg text-slate-100 truncate">
                GoldVista
              </span>
              <span className="text-[10px] font-mono text-amber-400 font-semibold uppercase tracking-wider hidden sm:inline">
                Intelligence
              </span>
            </div>
            <p className="text-[10px] text-slate-400 font-mono hidden md:block">
              Institutional Gold &amp; Multi-Commodity Advisory Platform
            </p>
          </div>
        </div>

        {/* Center Live Price Strip */}
        <div className="hidden lg:flex items-center gap-4 text-xs font-mono">
          <span className="text-[10px] text-slate-400 bg-slate-900 border border-slate-800 px-2 py-0.5 rounded font-mono">
            Indicative Reference
          </span>
          <div className="flex items-center gap-2">
            <span className="text-slate-400">XAU/USD:</span>
            <span className="font-bold text-amber-400 tabular-nums">${goldQuote.mid.toFixed(2)}</span>
            <span className="text-[11px] text-emerald-400 tabular-nums">+{goldQuote.change24hPct}%</span>
          </div>
          <span className="text-slate-700">|</span>
          <div className="flex items-center gap-2">
            <span className="text-slate-400">XAG/USD:</span>
            <span className="font-bold text-slate-200 tabular-nums">${silverQuote.mid.toFixed(2)}</span>
          </div>
          <span className="text-slate-700">|</span>
          <div className="flex items-center gap-2">
            <span className="text-slate-400">WTI Crude:</span>
            <span className="font-bold text-slate-200 tabular-nums">${wtiQuote.mid.toFixed(2)}</span>
          </div>
        </div>

        {/* Right CTA Actions (Authenticated vs Guest) */}
        <div className="flex items-center gap-1.5 sm:gap-2.5 shrink-0">
          {isAuthenticated && userSession ? (
            <>
              <div className="hidden md:flex items-center gap-2 px-2.5 py-1.5 rounded-lg bg-slate-900 border border-slate-800 text-xs font-mono">
                <span className="text-slate-200 font-semibold truncate max-w-[120px]">
                  {userSession.displayName}
                </span>
                <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-300 border border-amber-500/30 font-bold uppercase">
                  {userSession.role}
                </span>
              </div>
              <button
                type="button"
                onClick={onLaunchTerminal}
                className="min-h-[40px] px-3 sm:px-4 py-2 bg-gradient-to-r from-amber-500 to-amber-400 hover:from-amber-400 hover:to-amber-300 text-slate-950 font-bold rounded-lg text-xs shadow-md transition-all flex items-center gap-1.5 whitespace-nowrap cursor-pointer"
              >
                <span>Open Terminal</span>
                <ArrowRight className="w-3.5 h-3.5 shrink-0" />
              </button>
              {onLogout && (
                <button
                  type="button"
                  onClick={onLogout}
                  aria-label="Sign Out"
                  className="min-h-[40px] px-2.5 sm:px-3 py-2 bg-rose-500/10 hover:bg-rose-500/20 text-rose-300 border border-rose-500/30 font-semibold rounded-lg text-xs transition-colors flex items-center gap-1.5 whitespace-nowrap cursor-pointer"
                >
                  <LogOut className="w-3.5 h-3.5 shrink-0" />
                  <span>Sign Out</span>
                </button>
              )}
            </>
          ) : (
            <>
              <button
                type="button"
                onClick={() => onOpenAuth('LOGIN')}
                className="min-h-[40px] px-2.5 sm:px-3.5 py-2 text-xs font-medium text-slate-200 hover:text-white border border-slate-700/80 hover:border-slate-600 rounded-lg transition-colors whitespace-nowrap cursor-pointer"
              >
                Sign In
              </button>
              <button
                type="button"
                onClick={() => onOpenAuth('ENROLL')}
                className="min-h-[40px] px-3 sm:px-4 py-2 bg-gradient-to-r from-amber-500 to-amber-400 hover:from-amber-400 hover:to-amber-300 text-slate-950 font-bold rounded-lg text-xs shadow-md transition-all flex items-center gap-1.5 whitespace-nowrap cursor-pointer"
              >
                <UserPlus className="w-3.5 h-3.5 shrink-0" />
                <span>Sign Up</span>
              </button>
              <button
                type="button"
                onClick={onLaunchTerminal}
                className="hidden sm:flex min-h-[40px] px-3.5 py-2 bg-slate-900 hover:bg-slate-800 text-slate-200 border border-slate-700 font-medium rounded-lg text-xs transition-colors items-center gap-1.5 whitespace-nowrap cursor-pointer"
              >
                <span>Terminal</span>
                <ArrowRight className="w-3.5 h-3.5 shrink-0" />
              </button>
            </>
          )}
        </div>
      </header>

      {/* 2. HERO SECTION WITH PROFESSIONAL GRAPHIC & DIRECT ENROLLMENT */}
      <section className="relative px-4 sm:px-8 pt-12 pb-16 max-w-7xl mx-auto overflow-hidden">
        {/* Subtle Ambient Radial Glow */}
        <div className="absolute top-10 left-1/2 -translate-x-1/2 w-[700px] h-[350px] bg-gradient-to-b from-amber-500/10 via-amber-500/5 to-transparent rounded-full blur-3xl pointer-events-none" />

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
          {/* Left Column: Core Value Proposition & Live Trust Metrics */}
          <div className="lg:col-span-7 space-y-6 text-left">
            <div className="flex items-center gap-2 text-xs font-mono text-amber-400 flex-wrap">
              <span className="inline-block w-2 h-2 rounded-full bg-amber-400" />
              <span>COMEX &amp; LBMA CONTINUOUS INDICATIVE REFERENCE</span>
              <span aria-hidden="true">·</span>
              <span>DECISION SUPPORT ONLY</span>
              <span aria-hidden="true">·</span>
              <span>MATHEMATICAL EXPECTANCY ($E &gt; 0)</span>
            </div>

            <h1 className="text-3xl sm:text-5xl lg:text-5xl font-extrabold tracking-tight text-slate-100 leading-[1.12]">
              Institutional Gold &amp; Commodity Intelligence Built For{' '}
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-amber-300 via-amber-400 to-amber-500">
                Mathematical Expectancy
              </span>
            </h1>

            <p className="text-sm sm:text-base text-slate-300 max-w-xl leading-relaxed">
              Eliminate emotional retail mistakes with verified patience limit corridors, multi-agent AI council
              consensus, walk-forward backtesting, and an automated non-cash stop-loss signal credit refund policy.
            </p>

            {/* Micro Highlights */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2 text-xs font-mono">
              <div className="p-3 bg-slate-900 border border-slate-800 rounded-lg">
                <span className="text-slate-500 block text-[10px] uppercase">Net Win Edge</span>
                <span className="text-amber-400 font-bold text-sm">1:2.59 R:R Average</span>
                <span className="text-[10px] text-slate-400 block mt-0.5">Strict mathematical positive</span>
              </div>
              <div className="p-3 bg-slate-900 border border-slate-800 rounded-lg">
                <span className="text-slate-500 block text-[10px] uppercase">Signal Credits</span>
                <span className="text-emerald-400 font-bold text-sm">Stop-Loss Refunded</span>
                <span className="text-[10px] text-slate-400 block mt-0.5">Non-cash credit auto-return</span>
              </div>
              <div className="p-3 bg-slate-900 border border-slate-800 rounded-lg">
                <span className="text-slate-500 block text-[10px] uppercase">ECN Subsidized</span>
                <span className="text-slate-200 font-bold text-sm">Partner-Sponsored Pro</span>
                <span className="text-[10px] text-slate-400 block mt-0.5">Via partner broker rebates</span>
              </div>
            </div>

            {/* Quick CTAs */}
            <div className="flex flex-wrap items-center gap-3 pt-2">
              {isAuthenticated ? (
                <>
                  <button
                    type="button"
                    onClick={onLaunchTerminal}
                    className="min-h-[44px] px-6 py-3 bg-gradient-to-r from-amber-500 to-amber-400 hover:from-amber-400 hover:to-amber-300 text-slate-950 font-bold rounded-lg text-xs shadow-xl transition-all flex items-center gap-2 cursor-pointer"
                  >
                    <CandlestickChart className="w-4 h-4" />
                    <span>Resume Trading Terminal</span>
                  </button>
                  {onLogout && (
                    <button
                      type="button"
                      onClick={onLogout}
                      className="min-h-[44px] px-5 py-3 bg-rose-500/10 hover:bg-rose-500/20 text-rose-300 border border-rose-500/30 font-semibold rounded-lg text-xs transition-colors flex items-center gap-2 cursor-pointer"
                    >
                      <LogOut className="w-4 h-4" />
                      <span>Sign Out</span>
                    </button>
                  )}
                </>
              ) : (
                <>
                  <button
                    type="button"
                    onClick={() => onOpenAuth('ENROLL')}
                    className="min-h-[44px] px-6 py-3 bg-gradient-to-r from-amber-500 to-amber-400 hover:from-amber-400 hover:to-amber-300 text-slate-950 font-bold rounded-lg text-xs shadow-xl transition-all flex items-center gap-2 cursor-pointer"
                  >
                    <Zap className="w-4 h-4 fill-slate-950" />
                    <span>Sign Up Free · Claim 5 Welcome Credits</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => onOpenAuth('LOGIN')}
                    className="min-h-[44px] px-5 py-3 bg-slate-900 hover:bg-slate-800 text-slate-200 border border-slate-700 font-medium rounded-lg text-xs transition-colors flex items-center gap-2 cursor-pointer"
                  >
                    <span>Sign In</span>
                  </button>
                  <button
                    type="button"
                    onClick={onLaunchTerminal}
                    className="min-h-[44px] px-5 py-3 bg-slate-900 hover:bg-slate-800 text-slate-200 border border-slate-800 hover:border-slate-700 font-medium rounded-lg text-xs transition-colors flex items-center gap-2 cursor-pointer"
                  >
                    <CandlestickChart className="w-4 h-4 text-amber-400" />
                    <span>Open Terminal Workspace</span>
                  </button>
                </>
              )}
            </div>
          </div>

          {/* Right Column: Direct Fast Sign-Up Form OR Active Authenticated Session Card */}
          {isAuthenticated && userSession ? (
            <div className="lg:col-span-5 bg-slate-900 border border-slate-800 rounded-xl p-6 shadow-2xl space-y-5">
              <div className="flex items-center justify-between pb-3.5 border-b border-slate-800">
                <div className="flex items-center gap-2.5 min-w-0">
                  <div className="w-9 h-9 rounded-full bg-amber-500/20 border border-amber-500/40 flex items-center justify-center text-amber-400 font-bold shrink-0">
                    {userSession.displayName.charAt(0).toUpperCase()}
                  </div>
                  <div className="min-w-0">
                    <h3 className="text-sm font-bold text-slate-100 truncate">{userSession.displayName}</h3>
                    <span className="text-[11px] font-mono text-slate-400 truncate block">{userSession.email}</span>
                  </div>
                </div>
                <span className="text-[10px] font-mono text-emerald-400 bg-emerald-500/10 border border-emerald-500/30 px-2 py-0.5 rounded font-bold uppercase shrink-0">
                  {userSession.role} ACTIVE
                </span>
              </div>

              <div className="p-4 bg-slate-950 border border-slate-800 rounded-lg space-y-2 text-xs font-mono">
                <div className="flex items-center justify-between">
                  <span className="text-slate-400">Session Status</span>
                  <span className="text-emerald-400 font-semibold">Signed In &amp; Portfolio Isolated</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-400">Primary Horizon</span>
                  <span className="text-slate-200">{userSession.tradingProfile?.primaryHorizon || 'SWING'}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-400">Desk / Broker</span>
                  <span className="text-slate-200 truncate max-w-[180px]">{userSession.tradingProfile?.brokerName || 'Standard Reference'}</span>
                </div>
              </div>

              <div className="space-y-2.5">
                <button
                  type="button"
                  onClick={onLaunchTerminal}
                  className="w-full min-h-[44px] py-3 px-4 bg-gradient-to-r from-amber-500 to-amber-400 hover:from-amber-400 hover:to-amber-300 text-slate-950 font-bold rounded-lg text-xs shadow-md transition-all flex items-center justify-center gap-2 cursor-pointer"
                >
                  <CandlestickChart className="w-4 h-4" />
                  <span>Enter Trading Terminal</span>
                </button>

                {onLogout && (
                  <button
                    type="button"
                    onClick={onLogout}
                    className="w-full min-h-[44px] py-2.5 px-4 bg-rose-500/10 hover:bg-rose-500/20 text-rose-300 border border-rose-500/30 font-semibold rounded-lg text-xs transition-colors flex items-center justify-center gap-2 cursor-pointer"
                  >
                    <LogOut className="w-4 h-4" />
                    <span>Sign Out of Account</span>
                  </button>
                )}

                <button
                  type="button"
                  onClick={() => onOpenAuth('ENROLL')}
                  className="w-full py-2 text-center text-xs font-mono text-amber-400 hover:underline cursor-pointer"
                >
                  Create or Switch to Another Account &rarr;
                </button>
              </div>
            </div>
          ) : (
            <div className="lg:col-span-5 bg-slate-900 border border-slate-800 rounded-xl p-5 sm:p-6 shadow-2xl relative">
              <div className="flex items-center justify-between pb-3.5 border-b border-slate-800 gap-2">
                <div className="flex items-center gap-2 min-w-0">
                  <div className="w-7 h-7 rounded-lg bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400 shrink-0">
                    <User className="w-4 h-4" />
                  </div>
                  <div className="min-w-0">
                    <h3 className="text-sm font-bold text-slate-100">Create Free Account</h3>
                    <span className="text-[10px] font-mono text-emerald-400">Includes 5 Free Welcome Credits</span>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => onOpenAuth('LOGIN')}
                  className="text-[11px] font-mono text-amber-400 hover:underline whitespace-nowrap shrink-0 cursor-pointer"
                >
                  Sign In &rarr;
                </button>
              </div>

              {enrollError && (
                <div role="alert" className="mt-3 p-2.5 rounded-lg bg-rose-500/10 border border-rose-500/30 text-xs text-rose-200 flex items-start gap-2">
                  <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
                  <span>{enrollError}</span>
                </div>
              )}

              <form onSubmit={handleEmbeddedSubmit} className="space-y-3 mt-4 text-xs font-sans" noValidate>
                <div>
                  <label htmlFor="landing-fullname" className="block text-[11px] font-mono text-slate-400 mb-1">
                    Full Name or Trader Handle
                  </label>
                  <input
                    id="landing-fullname"
                    type="text"
                    required
                    autoComplete="name"
                    value={enrollName}
                    onChange={(e) => setEnrollName(e.target.value)}
                    placeholder="e.g. Alex Vance"
                    className="w-full min-h-[44px] sm:min-h-[40px] bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm sm:text-xs text-slate-100 placeholder:text-slate-600 focus:outline-none focus:border-amber-400"
                  />
                </div>

                <div>
                  <label htmlFor="landing-email" className="block text-[11px] font-mono text-slate-400 mb-1">
                    Trader / Institutional Email
                  </label>
                  <input
                    id="landing-email"
                    type="email"
                    required
                    autoComplete="email"
                    value={enrollEmail}
                    onChange={(e) => setEnrollEmail(e.target.value)}
                    placeholder="alex.vance@commodity-alpha.com"
                    className="w-full min-h-[44px] sm:min-h-[40px] bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm sm:text-xs text-slate-100 placeholder:text-slate-600 focus:outline-none focus:border-amber-400"
                  />
                </div>

                <div>
                  <label htmlFor="landing-password" className="block text-[11px] font-mono text-slate-400 mb-1">
                    Account Password <span className="text-slate-500">(min. 8 characters)</span>
                  </label>
                  <div className="relative">
                    <input
                      id="landing-password"
                      type={showEnrollPassword ? 'text' : 'password'}
                      required
                      autoComplete="new-password"
                      value={enrollPassword}
                      onChange={(e) => setEnrollPassword(e.target.value)}
                      placeholder="Create a secure password"
                      className="w-full min-h-[44px] sm:min-h-[40px] bg-slate-950 border border-slate-800 rounded-lg pl-3 pr-10 py-2 text-sm sm:text-xs text-slate-100 placeholder:text-slate-600 focus:outline-none focus:border-amber-400"
                    />
                    <button
                      type="button"
                      onClick={() => setShowEnrollPassword((prev) => !prev)}
                      aria-label={showEnrollPassword ? 'Hide password' : 'Show password'}
                      className="absolute right-1 top-1/2 -translate-y-1/2 p-2 text-slate-400 hover:text-slate-200 cursor-pointer"
                    >
                      {showEnrollPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2.5">
                  <div>
                    <label htmlFor="landing-horizon" className="block text-[11px] font-mono text-slate-400 mb-1">
                      Primary Horizon
                    </label>
                    <select
                      id="landing-horizon"
                      value={enrollHorizon}
                      onChange={(e) => setEnrollHorizon(e.target.value as 'INTRADAY' | 'SWING' | 'PROP_FIRM' | 'MACRO')}
                      className="w-full min-h-[44px] sm:min-h-[40px] bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-2 text-sm sm:text-xs text-slate-100 focus:outline-none focus:border-amber-400 font-mono"
                    >
                      <option value="SWING">H4 Swing Trend</option>
                      <option value="INTRADAY">M15 Session Scalp</option>
                      <option value="PROP_FIRM">Prop Firm Challenge</option>
                      <option value="MACRO">Macro Secular Cycle</option>
                    </select>
                  </div>

                  <div>
                    <label htmlFor="landing-broker" className="block text-[11px] font-mono text-slate-400 mb-1">
                      Broker / Desk
                    </label>
                    <select
                      id="landing-broker"
                      value={enrollBroker}
                      onChange={(e) => setEnrollBroker(e.target.value)}
                      className="w-full min-h-[44px] sm:min-h-[40px] bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-2 text-sm sm:text-xs text-slate-100 focus:outline-none focus:border-amber-400 font-mono"
                    >
                      <option value="ic_markets">IC Markets (Free Pro)</option>
                      <option value="pepperstone">Pepperstone (Free Pro)</option>
                      <option value="tickmill">Tickmill (Free Pro)</option>
                      <option value="ftmo">FTMO / Prop Firm</option>
                      <option value="other">Other Liquidity Provider</option>
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2.5">
                  <div>
                    <label htmlFor="landing-size" className="block text-[11px] font-mono text-slate-400 mb-1">
                      Account Size
                    </label>
                    <select
                      id="landing-size"
                      value={enrollAccountSize}
                      onChange={(e) => setEnrollAccountSize(e.target.value)}
                      className="w-full min-h-[44px] sm:min-h-[40px] bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-2 text-sm sm:text-xs text-slate-100 focus:outline-none focus:border-amber-400 font-mono"
                    >
                      <option value="$10k - $25k">$10k - $25k</option>
                      <option value="$50,000 - $100,000">$50,000 - $100,000</option>
                      <option value="$100k+ Prop Challenge">$100k+ Prop Challenge</option>
                      <option value="$250,000+ Institutional">$250,000+ Desk</option>
                    </select>
                  </div>

                  <div>
                    <label htmlFor="landing-country" className="block text-[11px] font-mono text-slate-400 mb-1">
                      Country / Hub
                    </label>
                    <select
                      id="landing-country"
                      value={enrollCountry}
                      onChange={(e) => setEnrollCountry(e.target.value)}
                      className="w-full min-h-[44px] sm:min-h-[40px] bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-2 text-sm sm:text-xs text-slate-100 focus:outline-none focus:border-amber-400 font-mono"
                    >
                      <option value="United States">United States</option>
                      <option value="United Kingdom">United Kingdom</option>
                      <option value="European Union">European Union</option>
                      <option value="Switzerland">Switzerland</option>
                      <option value="United Arab Emirates">United Arab Emirates</option>
                      <option value="Singapore">Singapore</option>
                      <option value="Australia">Australia</option>
                      <option value="Global">Other Global</option>
                    </select>
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={isSubmittingEnroll}
                  className="w-full min-h-[44px] mt-2 py-3 px-4 bg-gradient-to-r from-amber-500 to-amber-400 hover:from-amber-400 hover:to-amber-300 text-slate-950 font-bold rounded-lg text-xs shadow-md transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
                >
                  <UserPlus className="w-4 h-4 shrink-0" />
                  <span>{isSubmittingEnroll ? 'Creating Account...' : 'Create Free Account & Launch Platform'}</span>
                </button>

                <div className="flex items-center justify-between pt-1 text-[10px] font-mono text-slate-500">
                  <span className="flex items-center gap-1">
                    <ShieldCheck className="w-3 h-3 text-emerald-400" />
                    No credit card required
                  </span>
                  <span>Instant Platform Access</span>
                </div>
              </form>
            </div>
          )}
        </div>

        {/* 3. BESPOKE ELEGANT VECTOR GRAPHIC: INSTITUTIONAL EXECUTION CORRIDOR */}
        <div className="mt-14 max-w-5xl mx-auto bg-slate-900 border border-slate-800 rounded-xl overflow-hidden shadow-2xl">
          <div className="flex flex-wrap items-center justify-between px-5 py-3 border-b border-slate-800 bg-slate-950/80 text-xs font-mono">
            <div className="flex items-center gap-2">
              <div className="w-2.5 h-2.5 rounded-full bg-rose-500/80" />
              <div className="w-2.5 h-2.5 rounded-full bg-amber-500/80" />
              <div className="w-2.5 h-2.5 rounded-full bg-emerald-500/80" />
              <span className="ml-2 text-slate-300 font-bold">
                GoldVista Canonical Trade Execution & Invalidation Model
              </span>
            </div>
            <div className="flex items-center gap-3 text-[11px] text-slate-400">
              <span className="text-emerald-400 font-bold">● COMEX Settlement Synchronized</span>
              <span>100% Performance Guarantee Active</span>
            </div>
          </div>

          {/* SVG Vector Graphic: Price Corridor & Mathematical Edge */}
          <div className="p-6 sm:p-8 bg-slate-950/60">
            <svg
              className="w-full h-auto max-h-[260px] select-none"
              viewBox="0 0 900 240"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
            >
              <defs>
                <linearGradient id="entryZoneGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#f59e0b" stopOpacity="0.25" />
                  <stop offset="100%" stopColor="#f59e0b" stopOpacity="0.05" />
                </linearGradient>
                <linearGradient id="tpZoneGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#10b981" stopOpacity="0.20" />
                  <stop offset="100%" stopColor="#10b981" stopOpacity="0.02" />
                </linearGradient>
              </defs>

              {/* Grid Lines */}
              <line x1="60" y1="30" x2="840" y2="30" stroke="#1e293b" strokeDasharray="3 3" />
              <line x1="60" y1="75" x2="840" y2="75" stroke="#1e293b" strokeDasharray="3 3" />
              <line x1="60" y1="120" x2="840" y2="120" stroke="#1e293b" strokeDasharray="3 3" />
              <line x1="60" y1="165" x2="840" y2="165" stroke="#1e293b" strokeDasharray="3 3" />
              <line x1="60" y1="210" x2="840" y2="210" stroke="#1e293b" strokeDasharray="3 3" />

              {/* Take Profit 2 Target ($4,191.50) */}
              <line x1="60" y1="35" x2="840" y2="35" stroke="#10b981" strokeWidth="1.5" strokeDasharray="4 4" />
              <text x="845" y="38" fill="#10b981" fontSize="10" fontFamily="monospace" fontWeight="bold">TP2: $4,191.50 (+145.0)</text>

              {/* Take Profit 1 Target ($4,131.50) */}
              <line x1="60" y1="75" x2="840" y2="75" stroke="#10b981" strokeWidth="2" />
              <rect x="60" y="35" width="780" height="40" fill="url(#tpZoneGrad)" />
              <text x="845" y="78" fill="#10b981" fontSize="10" fontFamily="monospace" fontWeight="bold">TP1: $4,131.50 (+85.0)</text>

              {/* Entry Zone Corridor ($4,018.50 - $4,036.50) */}
              <rect x="60" y="115" width="780" height="30" fill="url(#entryZoneGrad)" stroke="#f59e0b" strokeWidth="1" strokeDasharray="2 2" />
              <text x="845" y="125" fill="#f59e0b" fontSize="10" fontFamily="monospace" fontWeight="bold">ENTRY MAX: $4,036.50</text>
              <text x="845" y="145" fill="#f59e0b" fontSize="10" fontFamily="monospace" fontWeight="bold">ENTRY MIN: $4,018.50</text>

              {/* Stop Loss Invalidation ($3,991.50) */}
              <line x1="60" y1="185" x2="840" y2="185" stroke="#ef4444" strokeWidth="2" strokeDasharray="3 3" />
              <text x="845" y="188" fill="#ef4444" fontSize="10" fontFamily="monospace" fontWeight="bold">STOP: $3,991.50 (-55.0)</text>

              {/* Candlesticks Sequence (Vector Price Action Pullback into Entry Zone) */}
              {/* Green candle 1 */}
              <line x1="100" y1="150" x2="100" y2="90" stroke="#10b981" strokeWidth="1" />
              <rect x="96" y="105" width="8" height="35" fill="#10b981" rx="1" />

              {/* Red pullback candles */}
              <line x1="140" y1="85" x2="140" y2="125" stroke="#ef4444" strokeWidth="1" />
              <rect x="136" y="95" width="8" height="25" fill="#ef4444" rx="1" />

              <line x1="180" y1="110" x2="180" y2="145" stroke="#ef4444" strokeWidth="1" />
              <rect x="176" y="115" width="8" height="25" fill="#ef4444" rx="1" />

              {/* Hammer / Rejection Wick inside entry corridor */}
              <line x1="220" y1="118" x2="220" y2="152" stroke="#10b981" strokeWidth="1" />
              <rect x="216" y="120" width="8" height="15" fill="#10b981" rx="1" />

              {/* Expansion green candle */}
              <line x1="260" y1="135" x2="260" y2="80" stroke="#10b981" strokeWidth="1" />
              <rect x="256" y="85" width="8" height="40" fill="#10b981" rx="1" />

              {/* Green continuation candles */}
              <line x1="300" y1="90" x2="300" y2="60" stroke="#10b981" strokeWidth="1" />
              <rect x="296" y="65" width="8" height="22" fill="#10b981" rx="1" />

              <line x1="340" y1="70" x2="340" y2="40" stroke="#10b981" strokeWidth="1" />
              <rect x="336" y="45" width="8" height="20" fill="#10b981" rx="1" />

              {/* Active Spot Marker at 380px */}
              <circle cx="380" cy="50" r="5" fill="#f59e0b" />
              <circle cx="380" cy="50" r="10" stroke="#f59e0b" strokeWidth="1" strokeDasharray="2 2" className="animate-ping" />
              <text x="395" y="54" fill="#fbbf24" fontSize="11" fontFamily="monospace" fontWeight="bold">CURRENT SPOT: $4,048.50</text>

              {/* Mathematical Expectancy Overlay Annotation */}
              <rect x="70" y="15" width="220" height="24" rx="4" fill="#020617" stroke="#334155" />
              <text x="80" y="31" fill="#f8fafc" fontSize="10" fontFamily="monospace">Net R:R Ratio: 1:2.59 ($E &gt; 0)</text>
            </svg>
          </div>
        </div>
      </section>

      {/* 4. THE 4 INSTITUTIONAL PILLARS WITH BESPOKE FINANCIAL DIAGRAMS */}
      <section className="px-4 sm:px-8 py-16 bg-slate-900/40 border-y border-slate-800/80">
        <div className="max-w-7xl mx-auto space-y-12">
          <div className="text-center max-w-2xl mx-auto space-y-2">
            <span className="text-xs font-mono uppercase text-amber-400 font-semibold tracking-wider">
              System Architecture & Value Delivery
            </span>
            <h2 className="text-2xl sm:text-3xl font-bold text-slate-100">
              Why Elite Gold Traders Choose GoldVista
            </h2>
            <p className="text-xs sm:text-sm text-slate-400">
              We replaced vague chart lagging indicators with mathematically grounded expectancy, multi-agent AI
              specialist consensus, and prop firm capital preservation.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {/* Pillar 1: Multi-Agent AI Council */}
            <div className="p-6 bg-slate-950 border border-slate-800 rounded-xl space-y-3.5 hover:border-slate-700 transition-colors">
              <div className="w-10 h-10 rounded-lg bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400">
                <Brain className="w-5 h-5" />
              </div>
              <h3 className="text-base font-bold text-slate-100">Multi-Agent AI Council</h3>
              <p className="text-xs text-slate-300 leading-relaxed">
                4 autonomous specialist agents (Macro Yields $\beta$, Technical Momentum, Order Flow Volume Delta, and
                Geopolitical Risk) independently vote to establish unanimous execution consensus.
              </p>
              <div className="pt-2 border-t border-slate-900 text-[11px] font-mono text-amber-400 flex items-center gap-1">
                <span>4/4 Specialist Consensus Required</span>
              </div>
            </div>

            {/* Pillar 2: 100% Stop-Loss Performance Refund */}
            <div className="p-6 bg-slate-950 border border-slate-800 rounded-xl space-y-3.5 hover:border-slate-700 transition-colors">
              <div className="w-10 h-10 rounded-lg bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
                <RotateCcw className="w-5 h-5" />
              </div>
              <h3 className="text-base font-bold text-slate-100">100% Performance Guarantee</h3>
              <p className="text-xs text-slate-300 leading-relaxed">
                Pay only for winning alpha. If price triggers the stop loss before Target 1, signal credits automatically
                and instantaneously refund to your account balance.
              </p>
              <div className="pt-2 border-t border-slate-900 text-[11px] font-mono text-emerald-400 flex items-center gap-1">
                <span>Zero Risk On Failed Setups</span>
              </div>
            </div>

            {/* Pillar 3: Prop Firm Capital Shield */}
            <div className="p-6 bg-slate-950 border border-slate-800 rounded-xl space-y-3.5 hover:border-slate-700 transition-colors">
              <div className="w-10 h-10 rounded-lg bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400">
                <Scale className="w-5 h-5" />
              </div>
              <h3 className="text-base font-bold text-slate-100">Prop Firm Capital Shield</h3>
              <p className="text-xs text-slate-300 leading-relaxed">
                Integrated margin algorithms strictly cap risk exposure to &le; 0.75% equity per position, ensuring
                FTMO, FundedNext, and funded challenge drawdown safety.
              </p>
              <div className="pt-2 border-t border-slate-900 text-[11px] font-mono text-amber-400 flex items-center gap-1">
                <span>Saves $200-$540 Evaluation Fees</span>
              </div>
            </div>

            {/* Pillar 4: Broker Subsidized Free Access */}
            <div className="p-6 bg-slate-950 border border-slate-800 rounded-xl space-y-3.5 hover:border-slate-700 transition-colors">
              <div className="w-10 h-10 rounded-lg bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
                <Building2 className="w-5 h-5" />
              </div>
              <h3 className="text-base font-bold text-slate-100">Partner-Sponsored Pro via Broker Rebates</h3>
              <p className="text-xs text-slate-300 leading-relaxed">
                Link an eligible active trading account with IC Markets, Pepperstone, or Tickmill to qualify for
                partner-sponsored GoldVista Pro subscription coverage via qualifying volume rebates.
              </p>
              <div className="pt-2 border-t border-slate-900 text-[11px] font-mono text-emerald-400 flex items-center gap-1">
                <span>Sponsored Pro Coverage via Qualifying Broker Volume</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 5. INTERACTIVE ROI VALUE SIMULATOR */}
      <section className="px-4 sm:px-8 py-16 max-w-5xl mx-auto">
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 sm:p-10 space-y-8 shadow-2xl">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <span className="text-xs font-mono uppercase text-amber-400 font-semibold tracking-wider">
                Value-for-Money Economics
              </span>
              <h2 className="text-xl sm:text-2xl font-bold text-slate-100 mt-0.5">
                Calculate Your Monthly Net Platform ROI
              </h2>
              <p className="text-xs text-slate-400 mt-1">
                See how much capital GoldVista preserves across slippage, broker rebates, and disciplined execution.
              </p>
            </div>
            <div className="text-right font-mono">
              <span className="text-[10px] text-slate-500 uppercase block">Expected Value Return</span>
              <span className="text-2xl font-black text-emerald-400 tabular-nums">
                {netRoiRatio}x Net ROI
              </span>
            </div>
          </div>

          {/* Volume Slider */}
          <div className="space-y-3 p-4 bg-slate-950 rounded-lg border border-slate-800">
            <div className="flex justify-between text-xs font-mono">
              <span className="text-slate-300">Your Monthly Trading Volume:</span>
              <span className="text-amber-400 font-bold text-sm tabular-nums">
                {roiLots} Standard Lots / Month (~{roiLots * 100} oz Gold)
              </span>
            </div>
            <input
              type="range"
              min="1"
              max="50"
              value={roiLots}
              onChange={(e) => setRoiLots(Number(e.target.value))}
              className="w-full accent-amber-400 cursor-pointer h-2 bg-slate-800 rounded-lg"
            />
            <div className="flex justify-between text-[10px] font-mono text-slate-500">
              <span>1 Lot (Casual)</span>
              <span>10 Lots (Active Trader)</span>
              <span>25+ Lots (Prop / Full-Time)</span>
            </div>
          </div>

          {/* Breakdown Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs font-mono">
            <div className="p-3.5 bg-slate-950 rounded-lg border border-slate-800">
              <span className="text-slate-500 block uppercase text-[10px]">Slippage Eliminated</span>
              <span className="text-base font-bold text-slate-200 tabular-nums">
                +${slippageSaved} / mo
              </span>
              <span className="text-[10px] text-slate-500 block mt-0.5">Limit order corridor entries</span>
            </div>

            <div className="p-3.5 bg-slate-950 rounded-lg border border-slate-800">
              <span className="text-slate-500 block uppercase text-[10px]">Partner Broker Rebate</span>
              <span className="text-base font-bold text-slate-200 tabular-nums">
                +${commissionRebated} / mo
              </span>
              <span className="text-[10px] text-slate-500 block mt-0.5">Paid direct to your wallet</span>
            </div>

            <div className="p-3.5 bg-slate-950 rounded-lg border border-slate-800">
              <span className="text-slate-500 block uppercase text-[10px]">Bad Trade Avoidance</span>
              <span className="text-base font-bold text-emerald-400 tabular-nums">
                +${badTradeAvoidance} / mo
              </span>
              <span className="text-[10px] text-emerald-500/80 block mt-0.5">Invalidation filters</span>
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-4 pt-2">
            <span className="text-xs text-slate-400 font-mono">
              Total Estimated Value Delivered: <strong className="text-amber-400 font-bold">${totalValueDelivered}/month</strong> vs $49/mo cost
            </span>
            <button
              onClick={() => onOpenAuth('ENROLL')}
              className="px-5 py-2.5 bg-gradient-to-r from-amber-500 to-amber-400 hover:from-amber-400 hover:to-amber-300 text-slate-950 font-bold rounded-lg text-xs shadow-md transition-all cursor-pointer"
            >
              Start Free Trial Now
            </button>
          </div>
        </div>
      </section>

      {/* 6. TRANSPARENT MEMBERSHIP TIERS */}
      <section className="px-4 sm:px-8 py-16 bg-slate-900/40 border-t border-slate-800/80">
        <div className="max-w-7xl mx-auto space-y-12">
          <div className="text-center max-w-2xl mx-auto space-y-2">
            <span className="text-xs font-mono uppercase text-amber-400 font-semibold tracking-wider">
              Membership Architecture
            </span>
            <h2 className="text-2xl sm:text-3xl font-bold text-slate-100">
              Transparent, Value-Backed Pricing Tiers
            </h2>
            <p className="text-xs sm:text-sm text-slate-400">
              Choose the tier that matches your trading horizon or get Pro completely subsidized via broker rebates.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* TIER 1: FREE */}
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 flex flex-col justify-between hover:border-slate-700 transition-colors">
              <div className="space-y-4">
                <div className="flex items-center justify-between pb-3 border-b border-slate-800">
                  <h3 className="font-bold text-base text-slate-100">Free Enrolled</h3>
                  <span className="text-xs font-mono text-slate-400">Starter</span>
                </div>
                <div>
                  <span className="text-3xl font-black text-slate-100">$0</span>
                  <span className="text-xs font-mono text-slate-500"> / forever</span>
                </div>
                <p className="text-xs text-slate-400">
                  Ideal for casual commodity observers and exploratory traders.
                </p>
                <ul className="text-xs font-mono text-slate-300 space-y-2 pt-2">
                  <li className="flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                    <span>5 Welcome Alpha Signal Credits</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                    <span>3 Daily Automatic Free Regens</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                    <span>Live 5-Year TradingView Terminal</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                    <span>Non-Cash Stop-Loss Signal Credit Refund Policy</span>
                  </li>
                </ul>
              </div>

              <button
                type="button"
                onClick={() => onOpenAuth('ENROLL')}
                className="mt-6 w-full min-h-[44px] py-2.5 px-4 bg-slate-800 hover:bg-slate-700 text-slate-100 font-bold rounded-lg text-xs transition-colors cursor-pointer"
              >
                Sign Up Free (Claim 5 Credits)
              </button>
            </div>

            {/* TIER 2: PRO (FEATURED) */}
            <div className="bg-gradient-to-b from-amber-500/10 via-slate-900 to-slate-900 border-2 border-amber-400/80 rounded-xl p-6 flex flex-col justify-between shadow-xl relative">
              <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-0.5 bg-amber-400 text-slate-950 text-[10px] font-mono font-bold uppercase rounded-full">
                Most Popular · Partner-Sponsored Option
              </div>

              <div className="space-y-4">
                <div className="flex items-center justify-between pb-3 border-b border-slate-800">
                  <h3 className="font-bold text-base text-amber-300">GoldVista Pro</h3>
                  <span className="text-xs font-mono text-emerald-400 font-bold">18.2x ROI</span>
                </div>
                <div>
                  <span className="text-3xl font-black text-slate-100">$49</span>
                  <span className="text-xs font-mono text-slate-500"> / month</span>
                  <span className="block text-[11px] text-emerald-400 font-mono mt-0.5">
                    Or Partner-Sponsored with IC Markets / Pepperstone
                  </span>
                </div>
                <p className="text-xs text-slate-300">
                  Unlimited verified alpha for active swing traders and prop firm candidates.
                </p>
                <ul className="text-xs font-mono text-slate-300 space-y-2 pt-2">
                  <li className="flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-amber-400 shrink-0" />
                    <span>Unlimited Swing & Intraday Signals</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-amber-400 shrink-0" />
                    <span>Walk-Forward Backtesting Engine</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-amber-400 shrink-0" />
                    <span>Telegram & Webhook Push Signals</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-amber-400 shrink-0" />
                    <span>Prop Firm Risk Guardrail Mode</span>
                  </li>
                </ul>
              </div>

              <div className="space-y-2 mt-6">
                <button
                  onClick={() =>
                    onOpenCheckout({
                      type: 'TIER',
                      id: 'PRO',
                      title: 'GoldVista Pro Membership',
                      priceUsd: 49,
                      billingPeriod: 'month',
                      description: 'Unlimited signals, backtesting, and Telegram alerts.',
                    })
                  }
                  className="w-full py-2.5 px-4 bg-gradient-to-r from-amber-500 to-amber-400 hover:from-amber-400 hover:to-amber-300 text-slate-950 font-bold rounded-lg text-xs shadow-md transition-all cursor-pointer"
                >
                  Upgrade to Pro ($49/mo)
                </button>
                <button
                  onClick={onLaunchTerminal}
                  className="w-full py-2 text-center text-xs font-mono text-emerald-400 hover:underline block"
                >
                  Link Broker for Sponsored Pro Access &rarr;
                </button>
              </div>
            </div>

            {/* TIER 3: ALPHA */}
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 flex flex-col justify-between hover:border-slate-700 transition-colors">
              <div className="space-y-4">
                <div className="flex items-center justify-between pb-3 border-b border-slate-800">
                  <h3 className="font-bold text-base text-slate-100">Institutional Alpha</h3>
                  <span className="text-xs font-mono text-slate-400">Funds & Desks</span>
                </div>
                <div>
                  <span className="text-3xl font-black text-slate-100">$199</span>
                  <span className="text-xs font-mono text-slate-500"> / month</span>
                </div>
                <p className="text-xs text-slate-400">
                  Dedicated quantitative tools for funds, private desks, and algorithmic traders.
                </p>
                <ul className="text-xs font-mono text-slate-300 space-y-2 pt-2">
                  <li className="flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                    <span>Everything in Pro Unlimited</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                    <span>4-Agent Specialist Advisory Council</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                    <span>Dedicated Gemini Research Chatbot</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                    <span>Institutional PDF & Evidence Dossiers</span>
                  </li>
                </ul>
              </div>

              <button
                onClick={() =>
                  onOpenCheckout({
                    type: 'TIER',
                    id: 'ALPHA',
                    title: 'Institutional Alpha Membership',
                    priceUsd: 199,
                    billingPeriod: 'month',
                    description: 'Full Pro features + AI Advisory Council & Gemini research analyst.',
                  })
                }
                className="mt-6 w-full py-2.5 px-4 bg-slate-800 hover:bg-slate-750 text-slate-100 font-bold rounded-lg text-xs transition-colors cursor-pointer"
              >
                Join Institutional Alpha
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* 7. FOOTER */}
      <footer className="border-t border-slate-800 px-4 sm:px-8 py-10 bg-slate-950 text-xs font-mono text-slate-500">
        <div className="max-w-7xl mx-auto flex flex-wrap items-center justify-between gap-6">
          <div className="space-y-1">
            <span className="font-bold text-slate-300 text-sm">GoldVista (Aurum Intelligence)</span>
            <p className="text-[11px] text-slate-500">
              Institutional Precious Metals & Multi-Commodity Intelligence Engine
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-4 sm:gap-6">
            <button type="button" onClick={onLaunchTerminal} className="hover:text-amber-400 transition-colors cursor-pointer">
              Platform Terminal
            </button>
            {isAuthenticated && onLogout ? (
              <button type="button" onClick={onLogout} className="hover:text-rose-400 text-rose-300 transition-colors cursor-pointer">
                Sign Out
              </button>
            ) : (
              <>
                <button type="button" onClick={() => onOpenAuth('LOGIN')} className="hover:text-amber-400 transition-colors cursor-pointer">
                  Sign In
                </button>
                <button type="button" onClick={() => onOpenAuth('ENROLL')} className="hover:text-amber-400 transition-colors cursor-pointer">
                  Sign Up Free
                </button>
              </>
            )}
          </div>

          <div className="text-[10px] text-slate-600 w-full pt-4 border-t border-slate-900">
            DISCLAIMER: GoldVista provides quantitative intelligence and research models for educational and institutional research purposes. Spot Gold, Precious Metals, and CFD products carry high volatility. Past performance does not guarantee future results.
          </div>
        </div>
      </footer>
    </div>
  );
};
