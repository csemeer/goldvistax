/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * Aurum Intelligence — Universal Customer Enrollment & Login Modal
 * Supports Google, Apple, Telegram, Discord, and Email with multi-step enrollment onboarding.
 */

import React, { useEffect, useState } from 'react';
import {
  UserSession,
  UserTradingProfile,
  buildOidcAuthorizeUrl,
  generatePkceVerifierAndChallenge,
  loginWithSocialProvider,
  loginWithEmail,
  enrollNewCustomer,
} from '../services/authService';
import {
  X,
  ShieldCheck,
  CheckCircle2,
  Lock,
  ArrowRight,
  Mail,
  Loader2,
  KeyRound,
} from 'lucide-react';

interface RuntimeSessionConfig {
  sandboxModeEnabled: boolean;
  oidcConfigured: boolean;
  authProviderMode: 'OIDC_PKCE_JWKS' | 'SANDBOX_HMAC_V1' | 'OAUTH2_PKCE_REQUIRED';
  oidcAuthorizationEndpoint?: string | null;
  oidcClientId?: string | null;
  oidcRedirectUri?: string | null;
}

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSessionUpdated: (session: UserSession, isNewEnrollment?: boolean) => void;
  initialMode?: 'LOGIN' | 'ENROLL';
  targetFeatureName?: string;
}

export const AuthModal: React.FC<AuthModalProps> = ({
  isOpen,
  onClose,
  onSessionUpdated,
  initialMode = 'ENROLL',
  targetFeatureName,
}) => {
  const [mode, setMode] = useState<'LOGIN' | 'ENROLL'>(initialMode);
  const [enrollStep, setEnrollStep] = useState<1 | 2 | 3>(1);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [loadingProvider, setLoadingProvider] = useState<string | null>(null);
  const [authError, setAuthError] = useState<string | null>(null);
  const [sessionConfig, setSessionConfig] = useState<RuntimeSessionConfig>({
    sandboxModeEnabled: true,
    oidcConfigured: false,
    authProviderMode: 'SANDBOX_HMAC_V1',
  });

  // Form input state
  const [emailInput, setEmailInput] = useState<string>('');
  const [nameInput, setNameInput] = useState<string>('');
  const [selectedHorizon, setSelectedHorizon] = useState<'INTRADAY' | 'SWING' | 'PROP_FIRM' | 'MACRO'>('SWING');
  const [selectedBroker, setSelectedBroker] = useState<string>('ic_markets');
  const [selectedExperience, setSelectedExperience] = useState<'NOVICE' | 'INTERMEDIATE' | 'ADVANCED' | 'INSTITUTIONAL'>('ADVANCED');

  useEffect(() => {
    if (!isOpen) return;
    let active = true;
    setAuthError(null);
    fetch('/api/auth/session-config')
      .then((res) => (res.ok ? res.json() : null))
      .then((cfg) => {
        if (active && cfg && typeof cfg.sandboxModeEnabled === 'boolean') {
          setSessionConfig(cfg);
        }
      })
      .catch(() => {
        // retain default local config when offline
      });
    return () => {
      active = false;
    };
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const isOidcPkceReady = Boolean(
    sessionConfig.oidcConfigured &&
      sessionConfig.oidcAuthorizationEndpoint &&
      sessionConfig.oidcClientId
  );

  const handleOidcPkceRedirect = async () => {
    if (!sessionConfig.oidcAuthorizationEndpoint || !sessionConfig.oidcClientId) return;
    setIsLoading(true);
    setAuthError(null);
    try {
      const pkce = await generatePkceVerifierAndChallenge();
      const state = `gv_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
      if (typeof window !== 'undefined' && window.sessionStorage) {
        window.sessionStorage.setItem('goldvista_pkce_verifier', pkce.codeVerifier);
        window.sessionStorage.setItem('goldvista_pkce_state', state);
      }
      const redirectUri =
        sessionConfig.oidcRedirectUri ||
        (typeof window !== 'undefined' ? `${window.location.origin}/auth/callback` : 'http://localhost:3000/auth/callback');
      const url = buildOidcAuthorizeUrl({
        authorizationEndpoint: sessionConfig.oidcAuthorizationEndpoint,
        clientId: sessionConfig.oidcClientId,
        redirectUri,
        codeChallenge: pkce.codeChallenge,
        state,
      });
      window.location.assign(url);
    } catch (err: any) {
      setAuthError(err?.message || 'Unable to initialize OIDC PKCE redirect.');
      setIsLoading(false);
    }
  };

  // Social Login Handler
  const handleSocialAuth = async (provider: 'google' | 'apple' | 'discord' | 'telegram') => {
    setIsLoading(true);
    setLoadingProvider(provider);
    try {
      if (mode === 'ENROLL') {
        // Move to step 2 for onboarding profile questionnaire
        setIsLoading(false);
        setEnrollStep(2);
      } else {
        const session = await loginWithSocialProvider(provider);
        onSessionUpdated(session, false);
        onClose();
      }
    } catch (e) {
      console.error('Auth error:', e);
    } finally {
      setIsLoading(false);
      setLoadingProvider(null);
    }
  };

  // Direct Email Login Handler
  const handleEmailSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!emailInput || !emailInput.includes('@')) return;

    setIsLoading(true);
    try {
      if (mode === 'ENROLL') {
        setIsLoading(false);
        setEnrollStep(2);
      } else {
        const session = await loginWithEmail(emailInput);
        onSessionUpdated(session, false);
        onClose();
      }
    } catch (err) {
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  // Final Step 2 -> 3 Enrollment Completion
  const handleCompleteEnrollment = async () => {
    setIsLoading(true);
    try {
      const profile: UserTradingProfile = {
        primaryHorizon: selectedHorizon,
        brokerName:
          selectedBroker === 'ic_markets'
            ? 'IC Markets Global (Raw ECN)'
            : selectedBroker === 'pepperstone'
            ? 'Pepperstone Razor'
            : selectedBroker === 'tickmill'
            ? 'Tickmill Pro'
            : 'Prop Firm / Other',
        experienceLevel: selectedExperience,
      };

      const session = await enrollNewCustomer({
        email: emailInput || 'csemeer@gmail.com',
        displayName: nameInput || (emailInput ? emailInput.split('@')[0] : 'Commodity Trader'),
        authProvider: (loadingProvider as any) || 'google',
        tradingProfile: profile,
      });

      setEnrollStep(3);
      setTimeout(() => {
        onSessionUpdated(session, true);
      }, 500);
    } catch (err) {
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/80 backdrop-blur-md animate-fade-in font-sans"
      role="dialog"
      aria-modal="true"
      aria-labelledby="auth-modal-title"
    >
      <div className="relative w-full max-w-lg bg-slate-900 border border-slate-800 rounded-xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Top Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-800 bg-slate-950/70">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400">
              <ShieldCheck className="w-4 h-4" />
            </div>
            <div>
              <span className="text-[10px] font-mono uppercase tracking-wider text-amber-400 font-semibold block">
                GoldVista Access Gateway
              </span>
              <h3 id="auth-modal-title" className="text-sm font-bold text-slate-100">
                {mode === 'ENROLL' ? 'Customer Enrollment Portal' : 'Member Sign In'}
              </h3>
            </div>
          </div>
          <button
            type="button"
            aria-label="Close authentication modal"
            onClick={onClose}
            className="min-h-[40px] min-w-[40px] flex items-center justify-center rounded-lg text-slate-400 hover:text-slate-100 hover:bg-slate-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Feature Gating Callout (If triggered by a restricted workspace) */}
        {targetFeatureName && (
          <div className="px-5 py-2.5 bg-amber-500/10 border-b border-amber-500/20 text-xs text-amber-300 flex items-center gap-2 font-mono">
            <Lock className="w-3.5 h-3.5 shrink-0 text-amber-400" />
            <span>Enroll or log in to access <strong>{targetFeatureName}</strong>.</span>
          </div>
        )}

        {/* Modal Body */}
        <div className="p-5 sm:p-6 overflow-y-auto space-y-5">
          {/* STEP 1: CREDENTIALS SELECTION */}
          {enrollStep === 1 && (
            <>
              {/* Tab Switcher: Enroll vs Login */}
              <div className="grid grid-cols-2 p-1 bg-slate-950 rounded-lg border border-slate-800 text-xs font-medium">
                <button
                  type="button"
                  onClick={() => setMode('ENROLL')}
                  className={`py-2 rounded-md transition-all ${
                    mode === 'ENROLL'
                      ? 'bg-amber-400 text-slate-950 font-bold shadow-xs'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  Enroll Free (5 Alpha Credits)
                </button>
                <button
                  type="button"
                  onClick={() => setMode('LOGIN')}
                  className={`py-2 rounded-md transition-all ${
                    mode === 'LOGIN'
                      ? 'bg-amber-400 text-slate-950 font-bold shadow-xs'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  Existing Member Sign In
                </button>
              </div>

              {/* Runtime Identity Mode Notice */}
              <div className="text-[11px] font-mono text-slate-400 flex items-center justify-between border-b border-slate-800/80 pb-2">
                <span>
                  Identity Mode:{' '}
                  <strong className="text-slate-200">
                    {sessionConfig.authProviderMode === 'OIDC_PKCE_JWKS'
                      ? 'External OIDC PKCE (JWKS)'
                      : sessionConfig.sandboxModeEnabled
                      ? 'Sandbox Demo Evaluation'
                      : 'OAuth 2.0 PKCE Required'}
                  </strong>
                </span>
                {!sessionConfig.sandboxModeEnabled && !isOidcPkceReady && (
                  <span className="text-rose-400">Demo login disabled</span>
                )}
              </div>

              {authError && (
                <div role="alert" className="p-2.5 rounded-lg bg-rose-500/10 border border-rose-500/30 text-xs text-rose-300">
                  {authError}
                </div>
              )}

              {isOidcPkceReady && (
                <button
                  type="button"
                  disabled={isLoading}
                  onClick={handleOidcPkceRedirect}
                  className="w-full min-h-[40px] flex items-center justify-center gap-2 py-2.5 px-4 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold rounded-lg text-xs transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-300 disabled:opacity-50"
                >
                  <KeyRound className="w-4 h-4" />
                  <span>Sign in with Institutional OIDC (PKCE)</span>
                </button>
              )}

              {/* Value Promise Banner */}
              {mode === 'ENROLL' && (
                <div className="p-3 bg-gradient-to-r from-amber-500/10 via-slate-900 to-amber-500/5 border border-amber-500/30 rounded-lg text-xs space-y-1">
                  <div className="flex items-center gap-1.5 text-amber-400 font-bold font-mono">
                    <CheckCircle2 className="w-4 h-4" />
                    <span>Free Membership Includes:</span>
                  </div>
                  <ul className="text-slate-300 text-[11px] space-y-0.5 list-disc list-inside">
                    <li>5 Welcome Alpha Signal Credits (Eligible for Non-Cash Signal Credit Refund)</li>
                    <li>3 Automatic Daily Regenerated Signal Credits</li>
                    <li>Live 5-Year High-Precision TradingView Terminal</li>
                  </ul>
                </div>
              )}

              {/* 1-Click Social Auth Providers (Sandbox evaluation only when sandboxModeEnabled) */}
              <div className="space-y-2.5">
                {/* Google */}
                <button
                  type="button"
                  disabled={isLoading || !sessionConfig.sandboxModeEnabled}
                  onClick={() => handleSocialAuth('google')}
                  className="w-full min-h-[40px] flex items-center justify-center gap-3 py-2.5 px-4 bg-slate-950 hover:bg-slate-850 text-slate-200 border border-slate-800 hover:border-slate-700 rounded-lg text-xs font-medium transition-all shadow-xs cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {loadingProvider === 'google' ? (
                    <Loader2 className="w-4 h-4 animate-spin text-amber-400" />
                  ) : (
                    <svg className="w-4 h-4" viewBox="0 0 24 24">
                      <path
                        fill="#4285F4"
                        d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v4.51h6.6c-.29 1.52-1.14 2.82-2.4 3.68v3.05h3.88c2.27-2.09 3.66-5.17 3.66-9.17z"
                      />
                      <path
                        fill="#34A853"
                        d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.88-3.05c-1.08.72-2.45 1.16-4.05 1.16-3.12 0-5.77-2.1-6.72-4.93H1.25v3.15C3.26 21.36 7.33 24 12 24z"
                      />
                      <path
                        fill="#FBBC05"
                        d="M5.28 14.27c-.25-.72-.38-1.49-.38-2.27s.13-1.55.38-2.27V6.58H1.25C.45 8.16 0 9.97 0 12s.45 3.84 1.25 5.42l4.03-3.15z"
                      />
                      <path
                        fill="#EA4335"
                        d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.33 0 3.26 2.64 1.25 6.58l4.03 3.15c.95-2.83 3.6-4.98 6.72-4.98z"
                      />
                    </svg>
                  )}
                  <span>Continue with Google</span>
                </button>

                {/* Apple */}
                <button
                  type="button"
                  disabled={isLoading || !sessionConfig.sandboxModeEnabled}
                  onClick={() => handleSocialAuth('apple')}
                  className="w-full min-h-[40px] flex items-center justify-center gap-3 py-2.5 px-4 bg-slate-950 hover:bg-slate-850 text-slate-200 border border-slate-800 hover:border-slate-700 rounded-lg text-xs font-medium transition-all shadow-xs cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {loadingProvider === 'apple' ? (
                    <Loader2 className="w-4 h-4 animate-spin text-amber-400" />
                  ) : (
                    <svg className="w-4 h-4 fill-current" viewBox="0 0 170 170">
                      <path d="M150.37 130.25c-2.45 5.66-5.35 10.87-8.71 15.66-4.58 6.53-8.33 11.05-11.22 13.56-4.48 4.12-9.28 6.23-14.42 6.35-3.69 0-8.14-1.05-13.32-3.18-5.19-2.12-9.97-3.17-14.34-3.17-4.58 0-9.49 1.05-14.75 3.17-5.26 2.13-9.5 3.24-12.74 3.35-4.35.13-9.16-1.9-14.42-6.08-3.69-3.04-7.6-7.79-11.74-14.23-5.55-8.59-9.85-18.49-12.88-29.69-3.04-11.2-4.56-21.73-4.56-31.59 0-14.46 3.61-26.04 10.83-34.74 7.22-8.7 16.32-13.14 27.3-13.33 5.44 0 11.22 1.34 17.33 4.02 6.11 2.68 9.99 4.08 11.64 4.22 1.88-.2 5.97-1.63 12.28-4.28 6.31-2.65 11.95-3.88 16.92-3.69 12.82.72 23.01 5.39 30.56 14.01-11.2 6.78-16.66 16.23-16.39 28.34.27 9.49 3.86 17.51 10.77 24.06 6.91 6.55 15.35 10.33 25.32 11.35-2.01 6.34-4.57 12.69-7.68 19.04zM119.22 33.11c0-7.39 2.64-14.23 7.92-20.52 5.28-6.29 11.75-10.42 19.41-12.39.2 1.25.3 2.37.3 3.36 0 7.39-2.73 14.38-8.19 20.97-5.46 6.59-12.01 10.66-19.64 12.21-.2-1.25-.3-2.37-.3-3.63z" />
                    </svg>
                  )}
                  <span>Continue with Apple</span>
                </button>

                {/* Secondary Providers Grid */}
                <div className="grid grid-cols-2 gap-2 pt-1">
                  <button
                    type="button"
                    disabled={isLoading || !sessionConfig.sandboxModeEnabled}
                    onClick={() => handleSocialAuth('telegram')}
                    className="min-h-[40px] flex items-center justify-center gap-2 py-2 px-3 bg-slate-950 hover:bg-slate-850 text-slate-300 border border-slate-800 hover:border-slate-700 rounded-lg text-xs font-mono transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <span>Telegram Sign-In</span>
                  </button>
                  <button
                    type="button"
                    disabled={isLoading || !sessionConfig.sandboxModeEnabled}
                    onClick={() => handleSocialAuth('discord')}
                    className="min-h-[40px] flex items-center justify-center gap-2 py-2 px-3 bg-slate-950 hover:bg-slate-850 text-slate-300 border border-slate-800 hover:border-slate-700 rounded-lg text-xs font-mono transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <span>Discord Sign-In</span>
                  </button>
                </div>
              </div>

              {/* Divider */}
              <div className="flex items-center gap-3">
                <div className="h-px bg-slate-800 flex-1" />
                <span className="text-[11px] font-mono uppercase text-slate-500">
                  Or use Direct Email
                </span>
                <div className="h-px bg-slate-800 flex-1" />
              </div>

              {/* Email Form */}
              <form onSubmit={handleEmailSubmit} className="space-y-3">
                {mode === 'ENROLL' && (
                  <div>
                    <label className="block text-[11px] font-mono text-slate-400 mb-1">
                      Full Name or Trader Handle
                    </label>
                    <input
                      type="text"
                      value={nameInput}
                      onChange={(e) => setNameInput(e.target.value)}
                      placeholder="e.g. Alex Vance"
                      className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-slate-100 placeholder:text-slate-600 focus:outline-none focus:border-amber-400 font-sans"
                    />
                  </div>
                )}

                <div>
                  <label className="block text-[11px] font-mono text-slate-400 mb-1">
                    Institutional / Trader Email
                  </label>
                  <div className="relative">
                    <input
                      type="email"
                      required
                      value={emailInput}
                      onChange={(e) => setEmailInput(e.target.value)}
                      placeholder="trader@commodity-alpha.com"
                      className="w-full bg-slate-950 border border-slate-800 rounded-lg pl-9 pr-3 py-2 text-xs text-slate-100 placeholder:text-slate-600 focus:outline-none focus:border-amber-400 font-sans"
                    />
                    <Mail className="w-4 h-4 text-slate-500 absolute left-3 top-2.5" />
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={isLoading || !sessionConfig.sandboxModeEnabled}
                  className="w-full min-h-[40px] flex items-center justify-center gap-2 py-2.5 px-4 bg-gradient-to-r from-amber-500 to-amber-400 hover:from-amber-400 hover:to-amber-300 text-slate-950 font-bold rounded-lg text-xs transition-all shadow-md cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isLoading ? (
                    <Loader2 className="w-4 h-4 animate-spin text-slate-950" />
                  ) : (
                    <>
                      <span>{mode === 'ENROLL' ? 'Continue Enrollment' : 'Sign In With Email'}</span>
                      <ArrowRight className="w-4 h-4" />
                    </>
                  )}
                </button>
              </form>
            </>
          )}

          {/* STEP 2: TRADING PROFILE ONBOARDING (For New Enrollments) */}
          {enrollStep === 2 && (
            <div className="space-y-4">
              <div>
                <span className="text-[10px] font-mono uppercase text-amber-400 font-semibold block">
                  Step 2 of 2 · Customization
                </span>
                <h4 className="text-sm font-bold text-slate-100 mt-0.5">
                  Configure Your Trading Strategy & Horizon
                </h4>
                <p className="text-xs text-slate-400 mt-1">
                  We tailor your live terminal dashboard and alert models to your execution style.
                </p>
              </div>

              {/* Primary Horizon Select */}
              <div className="space-y-1.5">
                <label className="block text-[11px] font-mono text-slate-300 uppercase">
                  Primary Execution Horizon
                </label>
                <div className="grid grid-cols-2 gap-2 text-xs font-mono">
                  {[
                    { id: 'INTRADAY', label: 'Intraday Scalper', desc: 'M5 - H1 London/NY' },
                    { id: 'SWING', label: 'Swing Trader', desc: 'H4 - D1 Pullbacks' },
                    { id: 'PROP_FIRM', label: 'Prop Firm Candidate', desc: 'Strict <0.75% Risk' },
                    { id: 'MACRO', label: 'Macro Investor', desc: 'Secular Cycle Hedge' },
                  ].map((item) => (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => setSelectedHorizon(item.id as any)}
                      className={`p-2.5 rounded-lg border text-left transition-all ${
                        selectedHorizon === item.id
                          ? 'border-amber-400 bg-amber-500/10 text-amber-300 font-bold'
                          : 'border-slate-800 bg-slate-950 text-slate-400 hover:border-slate-700'
                      }`}
                    >
                      <span className="block text-slate-100 font-bold text-xs">{item.label}</span>
                      <span className="text-[10px] text-slate-500 block mt-0.5">{item.desc}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Preferred Broker */}
              <div className="space-y-1.5">
                <label className="block text-[11px] font-mono text-slate-300 uppercase">
                  Primary Broker or Prop Firm
                </label>
                <select
                  value={selectedBroker}
                  onChange={(e) => setSelectedBroker(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-slate-100 focus:outline-none focus:border-amber-400 font-mono"
                >
                  <option value="ic_markets">IC Markets Global (Raw ECN) — Free Pro Partner</option>
                  <option value="pepperstone">Pepperstone (Razor ECN) — Free Pro Partner</option>
                  <option value="tickmill">Tickmill Prime — Free Pro Partner</option>
                  <option value="prop_ftmo">FTMO / FundedNext (Prop Evaluation)</option>
                  <option value="other">Other Liquidity Provider</option>
                </select>
                <span className="text-[10px] text-emerald-400 font-mono block">
                  ★ Linking a verified IC Markets, Pepperstone, or Tickmill account qualifies for Partner-Sponsored Pro Tier (Non-Cash Rebate Allocation).
                </span>
              </div>

              <div className="pt-2 flex items-center justify-between gap-3">
                <button
                  type="button"
                  onClick={() => setEnrollStep(1)}
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-mono rounded-lg transition-colors"
                >
                  Back
                </button>
                <button
                  type="button"
                  onClick={handleCompleteEnrollment}
                  disabled={isLoading}
                  className="flex-1 flex items-center justify-center gap-2 py-2.5 px-4 bg-gradient-to-r from-amber-500 to-amber-400 hover:from-amber-400 hover:to-amber-300 text-slate-950 font-bold rounded-lg text-xs transition-all shadow-md cursor-pointer disabled:opacity-50"
                >
                  {isLoading ? (
                    <Loader2 className="w-4 h-4 animate-spin text-slate-950" />
                  ) : (
                    <>
                      <span>Complete Enrollment & Claim 5 Credits</span>
                      <ArrowRight className="w-4 h-4" />
                    </>
                  )}
                </button>
              </div>
            </div>
          )}

          {/* STEP 3: ENROLLMENT CELEBRATION */}
          {enrollStep === 3 && (
            <div className="py-6 text-center space-y-4 animate-fade-in font-sans">
              <div className="w-14 h-14 mx-auto rounded-full bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
                <CheckCircle2 className="w-8 h-8" />
              </div>

              <div>
                <span className="text-[10px] font-mono uppercase text-emerald-400 font-bold tracking-wider block">
                  Welcome to GoldVista
                </span>
                <h3 className="text-base font-bold text-slate-100 mt-1">
                  Account Successfully Provisioned!
                </h3>
                <p className="text-xs text-slate-300 max-w-sm mx-auto mt-1 leading-relaxed">
                  You have been enrolled as a verified trader. Your starting balance has been credited with{' '}
                  <strong className="text-amber-400">5 Welcome Alpha Credits</strong> protected by our Non-Cash
                  Signal Credit Refund Policy.
                </p>
              </div>

              <div className="p-3 bg-slate-950 border border-slate-800 rounded-lg max-w-xs mx-auto text-xs font-mono text-slate-300">
                <span className="text-slate-500 block text-[10px] uppercase">Unlocked Tier</span>
                <span className="font-bold text-amber-400">FREE ENROLLED MEMBER</span>
                <span className="block text-[11px] text-slate-400 mt-1">
                  5 Credits Available · 3 Daily Free Regens
                </span>
              </div>

              <button
                type="button"
                onClick={onClose}
                className="inline-flex items-center gap-2 px-6 py-2.5 bg-gradient-to-r from-amber-500 to-amber-400 hover:from-amber-400 hover:to-amber-300 text-slate-950 font-bold rounded-lg text-xs shadow-md transition-all cursor-pointer"
              >
                <span>Launch Master Terminal Now</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          )}
        </div>

        {/* Security & Regulatory Footer */}
        <div className="px-5 py-3 border-t border-slate-800/80 bg-slate-950/80 text-[10px] font-mono text-slate-500 flex items-center justify-between">
          <div className="flex items-center gap-1.5">
            <Lock className="w-3 h-3 text-slate-400" />
            <span>256-bit TLS Encrypted Client Credentials</span>
          </div>
          <span>GoldVista Compliance Gate</span>
        </div>
      </div>
    </div>
  );
};
