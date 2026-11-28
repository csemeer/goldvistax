/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * Aurum Intelligence — Universal Customer Sign-Up & Sign-In Modal
 * Supports Email/Password registration & credential login, OIDC PKCE,
 * sandbox social providers, and multi-step trader profile onboarding.
 */

import React, { useEffect, useState } from 'react';
import {
  UserSession,
  UserTradingProfile,
  AuthProviderType,
  buildOidcAuthorizeUrl,
  generatePkceVerifierAndChallenge,
  loginWithSocialProvider,
  loginWithEmail,
  enrollNewCustomer,
  isValidEmailAddress,
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
  Eye,
  EyeOff,
  User,
  AlertCircle,
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
  const [selectedProvider, setSelectedProvider] = useState<AuthProviderType>('email');
  const [authError, setAuthError] = useState<string | null>(null);
  const [provisionedSession, setProvisionedSession] = useState<UserSession | null>(null);
  const [sessionConfig, setSessionConfig] = useState<RuntimeSessionConfig>({
    sandboxModeEnabled: true,
    oidcConfigured: false,
    authProviderMode: 'SANDBOX_HMAC_V1',
  });

  // Form input state
  const [emailInput, setEmailInput] = useState<string>('');
  const [nameInput, setNameInput] = useState<string>('');
  const [passwordInput, setPasswordInput] = useState<string>('');
  const [confirmPasswordInput, setConfirmPasswordInput] = useState<string>('');
  const [showPassword, setShowPassword] = useState<boolean>(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState<boolean>(false);

  const [selectedHorizon, setSelectedHorizon] = useState<'INTRADAY' | 'SWING' | 'PROP_FIRM' | 'MACRO'>('SWING');
  const [selectedBroker, setSelectedBroker] = useState<string>('ic_markets');
  const [selectedExperience, setSelectedExperience] = useState<'NOVICE' | 'INTERMEDIATE' | 'ADVANCED' | 'INSTITUTIONAL'>('ADVANCED');

  // Synchronize mode and reset stale multi-step / error state every time the modal opens
  useEffect(() => {
    if (!isOpen) return;
    setMode(initialMode);
    setEnrollStep(1);
    setAuthError(null);
    setLoadingProvider(null);
    setIsLoading(false);
    setSelectedProvider('email');
    setProvisionedSession(null);
    setPasswordInput('');
    setConfirmPasswordInput('');
    setShowPassword(false);
    setShowConfirmPassword(false);
  }, [isOpen, initialMode]);

  useEffect(() => {
    if (!isOpen) return;
    let active = true;
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

  const switchMode = (nextMode: 'LOGIN' | 'ENROLL') => {
    setMode(nextMode);
    setEnrollStep(1);
    setAuthError(null);
    setPasswordInput('');
    setConfirmPasswordInput('');
  };

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
    } catch (err: unknown) {
      setAuthError(err instanceof Error ? err.message : 'Unable to initialize OIDC PKCE redirect.');
      setIsLoading(false);
    }
  };

  // Social Login / Sign-Up Handler
  const handleSocialAuth = async (provider: 'google' | 'apple' | 'discord' | 'telegram') => {
    setAuthError(null);
    setIsLoading(true);
    setLoadingProvider(provider);
    setSelectedProvider(provider);
    try {
      if (mode === 'ENROLL') {
        setIsLoading(false);
        setLoadingProvider(null);
        setEnrollStep(2);
      } else {
        const session = await loginWithSocialProvider(provider);
        onSessionUpdated(session, false);
        onClose();
      }
    } catch (err: unknown) {
      setAuthError(err instanceof Error ? err.message : 'Social authentication failed.');
    } finally {
      setIsLoading(false);
      setLoadingProvider(null);
    }
  };

  // Email + Password Form Submission
  const handleEmailSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError(null);

    const trimmedEmail = emailInput.trim();
    if (!isValidEmailAddress(trimmedEmail)) {
      setAuthError('Please enter a valid email address.');
      return;
    }

    if (mode === 'ENROLL') {
      if (nameInput.trim().length < 2) {
        setAuthError('Please enter your full name or trader handle (at least 2 characters).');
        return;
      }
      if (passwordInput.length < 8) {
        setAuthError('Password must be at least 8 characters long.');
        return;
      }
      if (passwordInput !== confirmPasswordInput) {
        setAuthError('Passwords do not match. Please verify and try again.');
        return;
      }
      setSelectedProvider('email');
      setEnrollStep(2);
      return;
    }

    // Sign In Mode
    if (!passwordInput) {
      setAuthError('Please enter your password to sign in.');
      return;
    }

    setIsLoading(true);
    try {
      const session = await loginWithEmail(trimmedEmail, passwordInput, { strictRegisteredOnly: true });
      onSessionUpdated(session, false);
      onClose();
    } catch (err: unknown) {
      setAuthError(err instanceof Error ? err.message : 'Unable to sign in with these credentials.');
    } finally {
      setIsLoading(false);
    }
  };

  // Final Step 2 -> 3 Sign-Up Completion
  const handleCompleteEnrollment = async () => {
    setAuthError(null);
    const trimmedEmail = emailInput.trim();
    if (selectedProvider === 'email' && !isValidEmailAddress(trimmedEmail)) {
      setAuthError('Please enter a valid email address.');
      return;
    }
    if (selectedProvider !== 'email' && trimmedEmail && !isValidEmailAddress(trimmedEmail)) {
      setAuthError('Please enter a valid email address or leave blank to use your provider identity.');
      return;
    }

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

      const resolvedEmail =
        trimmedEmail || `trader.${selectedProvider}.${Date.now().toString(36)}@goldvista.io`;
      const resolvedName =
        nameInput.trim() || resolvedEmail.split('@')[0] || 'Commodity Trader';

      const session = await enrollNewCustomer({
        email: resolvedEmail,
        displayName: resolvedName,
        authProvider: selectedProvider,
        tradingProfile: profile,
        password: selectedProvider === 'email' ? passwordInput : undefined,
        rejectDuplicate: selectedProvider === 'email',
      });

      setProvisionedSession(session);
      setEnrollStep(3);
      onSessionUpdated(session, true);
    } catch (err: unknown) {
      setAuthError(err instanceof Error ? err.message : 'Account registration failed. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const showSwitchToSignUpPrompt =
    mode === 'LOGIN' && Boolean(authError && authError.toLowerCase().includes('no account found'));
  const showSwitchToSignInPrompt =
    mode === 'ENROLL' && Boolean(authError && authError.toLowerCase().includes('already registered'));

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/80 backdrop-blur-md animate-fade-in font-sans"
      role="dialog"
      aria-modal="true"
      aria-labelledby="auth-modal-title"
    >
      <div className="relative w-full max-w-lg bg-slate-900 border border-slate-800 rounded-xl shadow-2xl overflow-hidden flex flex-col max-h-[92dvh]">
        {/* Top Header */}
        <div className="flex items-center justify-between px-4 sm:px-5 py-3.5 sm:py-4 border-b border-slate-800 bg-slate-950/70 shrink-0">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-8 h-8 rounded-lg bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400 shrink-0">
              <ShieldCheck className="w-4 h-4" />
            </div>
            <div className="min-w-0">
              <span className="text-[10px] font-mono uppercase tracking-wider text-amber-400 font-semibold block">
                GoldVista Account Gateway
              </span>
              <h3 id="auth-modal-title" className="text-sm font-bold text-slate-100 truncate">
                {mode === 'ENROLL' ? 'Create Free Account (Sign Up)' : 'Sign In to Your Account'}
              </h3>
            </div>
          </div>
          <button
            type="button"
            aria-label="Close authentication modal"
            onClick={onClose}
            className="min-h-[44px] min-w-[44px] sm:min-h-[40px] sm:min-w-[40px] flex items-center justify-center rounded-lg text-slate-400 hover:text-slate-100 hover:bg-slate-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400 transition-colors cursor-pointer shrink-0"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Feature Gating Callout */}
        {targetFeatureName && (
          <div className="px-4 sm:px-5 py-2.5 bg-amber-500/10 border-b border-amber-500/20 text-xs text-amber-300 flex items-center gap-2 font-mono shrink-0">
            <Lock className="w-3.5 h-3.5 shrink-0 text-amber-400" />
            <span>Sign up or sign in to access <strong>{targetFeatureName}</strong>.</span>
          </div>
        )}

        {/* Modal Body */}
        <div className="p-4 sm:p-6 overflow-y-auto space-y-4">
          {/* STEP 1: SIGN UP OR SIGN IN CREDENTIALS */}
          {enrollStep === 1 && (
            <>
              {/* Tab Switcher: Sign Up vs Sign In */}
              <div className="grid grid-cols-2 p-1 bg-slate-950 rounded-lg border border-slate-800 text-xs font-medium" role="tablist" aria-label="Account authentication mode">
                <button
                  type="button"
                  role="tab"
                  aria-selected={mode === 'ENROLL'}
                  onClick={() => switchMode('ENROLL')}
                  className={`min-h-[40px] py-2 px-2 rounded-md transition-all cursor-pointer whitespace-nowrap ${
                    mode === 'ENROLL'
                      ? 'bg-amber-400 text-slate-950 font-bold shadow-xs'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  Sign Up Free
                </button>
                <button
                  type="button"
                  role="tab"
                  aria-selected={mode === 'LOGIN'}
                  onClick={() => switchMode('LOGIN')}
                  className={`min-h-[40px] py-2 px-2 rounded-md transition-all cursor-pointer whitespace-nowrap ${
                    mode === 'LOGIN'
                      ? 'bg-amber-400 text-slate-950 font-bold shadow-xs'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  Sign In
                </button>
              </div>

              {/* Runtime Identity Mode Notice */}
              <div className="text-[11px] font-mono text-slate-400 flex flex-wrap items-center justify-between gap-2 border-b border-slate-800/80 pb-2">
                <span>
                  Identity Mode:{' '}
                  <strong className="text-slate-200">
                    {sessionConfig.authProviderMode === 'OIDC_PKCE_JWKS'
                      ? 'External OIDC PKCE (JWKS)'
                      : sessionConfig.sandboxModeEnabled
                      ? 'Account & Sandbox Auth'
                      : 'OAuth 2.0 PKCE Required'}
                  </strong>
                </span>
                {!sessionConfig.sandboxModeEnabled && !isOidcPkceReady && (
                  <span className="text-rose-400">Local signup/demo disabled</span>
                )}
              </div>

              {authError && (
                <div role="alert" className="p-3 rounded-lg bg-rose-500/10 border border-rose-500/30 text-xs text-rose-200 flex items-start gap-2">
                  <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
                  <div className="space-y-1.5 flex-1">
                    <p>{authError}</p>
                    {showSwitchToSignUpPrompt && (
                      <button
                        type="button"
                        onClick={() => switchMode('ENROLL')}
                        className="text-amber-400 font-semibold hover:underline cursor-pointer"
                      >
                        Create a free account with {emailInput.trim()} &rarr;
                      </button>
                    )}
                    {showSwitchToSignInPrompt && (
                      <button
                        type="button"
                        onClick={() => switchMode('LOGIN')}
                        className="text-amber-400 font-semibold hover:underline cursor-pointer"
                      >
                        Switch to Sign In &rarr;
                      </button>
                    )}
                  </div>
                </div>
              )}

              {isOidcPkceReady && (
                <button
                  type="button"
                  disabled={isLoading}
                  onClick={handleOidcPkceRedirect}
                  className="w-full min-h-[44px] sm:min-h-[40px] flex items-center justify-center gap-2 py-2.5 px-4 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold rounded-lg text-xs transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-300 disabled:opacity-50 cursor-pointer"
                >
                  <KeyRound className="w-4 h-4" />
                  <span>Continue with Institutional OIDC (PKCE)</span>
                </button>
              )}

              {/* Value Promise Banner for Sign Up */}
              {mode === 'ENROLL' && (
                <div className="p-3 bg-gradient-to-r from-amber-500/10 via-slate-900 to-amber-500/5 border border-amber-500/30 rounded-lg text-xs space-y-1">
                  <div className="flex items-center gap-1.5 text-amber-400 font-bold font-mono">
                    <CheckCircle2 className="w-4 h-4 shrink-0" />
                    <span>New Account Benefits:</span>
                  </div>
                  <ul className="text-slate-300 text-[11px] space-y-0.5 list-disc list-inside">
                    <li>Isolated Personal Portfolio &amp; Paper Execution Ledger</li>
                    <li>5 Welcome Signal Credits + 3 Daily Free Regenerations</li>
                    <li>Live 5-Year Multi-Commodity TradingView Terminal</li>
                  </ul>
                </div>
              )}

              {/* Primary Email + Password Form */}
              <form onSubmit={handleEmailSubmit} className="space-y-3" noValidate>
                {mode === 'ENROLL' && (
                  <div>
                    <label htmlFor="auth-fullname" className="block text-[11px] font-mono text-slate-400 mb-1">
                      Full Name or Trader Handle
                    </label>
                    <div className="relative">
                      <input
                        id="auth-fullname"
                        type="text"
                        autoComplete="name"
                        value={nameInput}
                        onChange={(e) => setNameInput(e.target.value)}
                        placeholder="e.g. Alex Vance"
                        className="w-full min-h-[44px] sm:min-h-[40px] bg-slate-950 border border-slate-800 rounded-lg pl-9 pr-3 py-2 text-sm sm:text-xs text-slate-100 placeholder:text-slate-600 focus:outline-none focus:border-amber-400 font-sans"
                      />
                      <User className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                    </div>
                  </div>
                )}

                <div>
                  <label htmlFor="auth-email" className="block text-[11px] font-mono text-slate-400 mb-1">
                    Email Address
                  </label>
                  <div className="relative">
                    <input
                      id="auth-email"
                      type="email"
                      required
                      autoComplete="email"
                      value={emailInput}
                      onChange={(e) => setEmailInput(e.target.value)}
                      placeholder="trader@commodity-alpha.com"
                      className="w-full min-h-[44px] sm:min-h-[40px] bg-slate-950 border border-slate-800 rounded-lg pl-9 pr-3 py-2 text-sm sm:text-xs text-slate-100 placeholder:text-slate-600 focus:outline-none focus:border-amber-400 font-sans"
                    />
                    <Mail className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                  </div>
                </div>

                <div>
                  <label htmlFor="auth-password" className="block text-[11px] font-mono text-slate-400 mb-1">
                    Password {mode === 'ENROLL' && <span className="text-slate-500">(min. 8 characters)</span>}
                  </label>
                  <div className="relative">
                    <input
                      id="auth-password"
                      type={showPassword ? 'text' : 'password'}
                      required
                      autoComplete={mode === 'ENROLL' ? 'new-password' : 'current-password'}
                      value={passwordInput}
                      onChange={(e) => setPasswordInput(e.target.value)}
                      placeholder={mode === 'ENROLL' ? 'Create a strong password' : 'Enter your password'}
                      className="w-full min-h-[44px] sm:min-h-[40px] bg-slate-950 border border-slate-800 rounded-lg pl-9 pr-10 py-2 text-sm sm:text-xs text-slate-100 placeholder:text-slate-600 focus:outline-none focus:border-amber-400 font-sans"
                    />
                    <Lock className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                    <button
                      type="button"
                      onClick={() => setShowPassword((prev) => !prev)}
                      aria-label={showPassword ? 'Hide password' : 'Show password'}
                      className="absolute right-1.5 top-1/2 -translate-y-1/2 p-2 text-slate-400 hover:text-slate-200 cursor-pointer"
                    >
                      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                {mode === 'ENROLL' && (
                  <div>
                    <label htmlFor="auth-confirm-password" className="block text-[11px] font-mono text-slate-400 mb-1">
                      Confirm Password
                    </label>
                    <div className="relative">
                      <input
                        id="auth-confirm-password"
                        type={showConfirmPassword ? 'text' : 'password'}
                        required
                        autoComplete="new-password"
                        value={confirmPasswordInput}
                        onChange={(e) => setConfirmPasswordInput(e.target.value)}
                        placeholder="Re-enter password"
                        className="w-full min-h-[44px] sm:min-h-[40px] bg-slate-950 border border-slate-800 rounded-lg pl-9 pr-10 py-2 text-sm sm:text-xs text-slate-100 placeholder:text-slate-600 focus:outline-none focus:border-amber-400 font-sans"
                      />
                      <Lock className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                      <button
                        type="button"
                        onClick={() => setShowConfirmPassword((prev) => !prev)}
                        aria-label={showConfirmPassword ? 'Hide confirm password' : 'Show confirm password'}
                        className="absolute right-1.5 top-1/2 -translate-y-1/2 p-2 text-slate-400 hover:text-slate-200 cursor-pointer"
                      >
                        {showConfirmPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>
                )}

                <button
                  type="submit"
                  disabled={isLoading || !sessionConfig.sandboxModeEnabled}
                  className="w-full min-h-[44px] sm:min-h-[40px] flex items-center justify-center gap-2 py-2.5 px-4 bg-gradient-to-r from-amber-500 to-amber-400 hover:from-amber-400 hover:to-amber-300 text-slate-950 font-bold rounded-lg text-xs transition-all shadow-md cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isLoading ? (
                    <Loader2 className="w-4 h-4 animate-spin text-slate-950" />
                  ) : (
                    <>
                      <span>{mode === 'ENROLL' ? 'Continue to Trading Profile' : 'Sign In With Email'}</span>
                      <ArrowRight className="w-4 h-4" />
                    </>
                  )}
                </button>
              </form>

              {/* Divider */}
              <div className="flex items-center gap-3">
                <div className="h-px bg-slate-800 flex-1" />
                <span className="text-[11px] font-mono uppercase text-slate-500">
                  Or Continue With Provider
                </span>
                <div className="h-px bg-slate-800 flex-1" />
              </div>

              {/* 1-Click Social Auth Providers */}
              <div className="space-y-2">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {/* Google */}
                  <button
                    type="button"
                    disabled={isLoading || !sessionConfig.sandboxModeEnabled}
                    onClick={() => handleSocialAuth('google')}
                    className="w-full min-h-[44px] sm:min-h-[40px] flex items-center justify-center gap-2.5 py-2 px-3 bg-slate-950 hover:bg-slate-800 text-slate-200 border border-slate-800 hover:border-slate-700 rounded-lg text-xs font-medium transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {loadingProvider === 'google' ? (
                      <Loader2 className="w-4 h-4 animate-spin text-amber-400" />
                    ) : (
                      <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24" aria-hidden="true">
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
                    <span>Google</span>
                  </button>

                  {/* Apple */}
                  <button
                    type="button"
                    disabled={isLoading || !sessionConfig.sandboxModeEnabled}
                    onClick={() => handleSocialAuth('apple')}
                    className="w-full min-h-[44px] sm:min-h-[40px] flex items-center justify-center gap-2.5 py-2 px-3 bg-slate-950 hover:bg-slate-800 text-slate-200 border border-slate-800 hover:border-slate-700 rounded-lg text-xs font-medium transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {loadingProvider === 'apple' ? (
                      <Loader2 className="w-4 h-4 animate-spin text-amber-400" />
                    ) : (
                      <svg className="w-4 h-4 fill-current shrink-0" viewBox="0 0 170 170" aria-hidden="true">
                        <path d="M150.37 130.25c-2.45 5.66-5.35 10.87-8.71 15.66-4.58 6.53-8.33 11.05-11.22 13.56-4.48 4.12-9.28 6.23-14.42 6.35-3.69 0-8.14-1.05-13.32-3.18-5.19-2.12-9.97-3.17-14.34-3.17-4.58 0-9.49 1.05-14.75 3.17-5.26 2.13-9.5 3.24-12.74 3.35-4.35.13-9.16-1.9-14.42-6.08-3.69-3.04-7.6-7.79-11.74-14.23-5.55-8.59-9.85-18.49-12.88-29.69-3.04-11.2-4.56-21.73-4.56-31.59 0-14.46 3.61-26.04 10.83-34.74 7.22-8.7 16.32-13.14 27.3-13.33 5.44 0 11.22 1.34 17.33 4.02 6.11 2.68 9.99 4.08 11.64 4.22 1.88-.2 5.97-1.63 12.28-4.28 6.31-2.65 11.95-3.88 16.92-3.69 12.82.72 23.01 5.39 30.56 14.01-11.2 6.78-16.66 16.23-16.39 28.34.27 9.49 3.86 17.51 10.77 24.06 6.91 6.55 15.35 10.33 25.32 11.35-2.01 6.34-4.57 12.69-7.68 19.04zM119.22 33.11c0-7.39 2.64-14.23 7.92-20.52 5.28-6.29 11.75-10.42 19.41-12.39.2 1.25.3 2.37.3 3.36 0 7.39-2.73 14.38-8.19 20.97-5.46 6.59-12.01 10.66-19.64 12.21-.2-1.25-.3-2.37-.3-3.63z" />
                      </svg>
                    )}
                    <span>Apple</span>
                  </button>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    disabled={isLoading || !sessionConfig.sandboxModeEnabled}
                    onClick={() => handleSocialAuth('telegram')}
                    className="min-h-[44px] sm:min-h-[40px] flex items-center justify-center gap-2 py-2 px-3 bg-slate-950 hover:bg-slate-800 text-slate-300 border border-slate-800 hover:border-slate-700 rounded-lg text-xs font-mono transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <span>Telegram</span>
                  </button>
                  <button
                    type="button"
                    disabled={isLoading || !sessionConfig.sandboxModeEnabled}
                    onClick={() => handleSocialAuth('discord')}
                    className="min-h-[44px] sm:min-h-[40px] flex items-center justify-center gap-2 py-2 px-3 bg-slate-950 hover:bg-slate-800 text-slate-300 border border-slate-800 hover:border-slate-700 rounded-lg text-xs font-mono transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <span>Discord</span>
                  </button>
                </div>
              </div>
            </>
          )}

          {/* STEP 2: TRADING PROFILE ONBOARDING (For New Accounts) */}
          {enrollStep === 2 && (
            <div className="space-y-4">
              <div>
                <span className="text-[10px] font-mono uppercase text-amber-400 font-semibold block">
                  Step 2 of 2 · Trader Profile Setup
                </span>
                <h4 className="text-sm font-bold text-slate-100 mt-0.5">
                  Configure Your Trading Strategy &amp; Horizon
                </h4>
                <p className="text-xs text-slate-400 mt-1">
                  We tailor your live terminal workspace and risk models to your execution style.
                </p>
              </div>

              {authError && (
                <div role="alert" className="p-3 rounded-lg bg-rose-500/10 border border-rose-500/30 text-xs text-rose-200 flex items-start gap-2">
                  <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
                  <div className="space-y-1 flex-1">
                    <p>{authError}</p>
                    {showSwitchToSignInPrompt && (
                      <button
                        type="button"
                        onClick={() => switchMode('LOGIN')}
                        className="text-amber-400 font-semibold hover:underline cursor-pointer"
                      >
                        Switch to Sign In &rarr;
                      </button>
                    )}
                  </div>
                </div>
              )}

              {/* Social sign-up fallback identity confirmation if user arrived via social button */}
              {selectedProvider !== 'email' && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 p-3 bg-slate-950 border border-slate-800 rounded-lg">
                  <div>
                    <label htmlFor="auth-step2-name" className="block text-[10px] font-mono text-slate-400 uppercase mb-1">
                      Display Name
                    </label>
                    <input
                      id="auth-step2-name"
                      type="text"
                      value={nameInput}
                      onChange={(e) => setNameInput(e.target.value)}
                      placeholder="Your name or handle"
                      className="w-full min-h-[40px] bg-slate-900 border border-slate-800 rounded-lg px-2.5 py-1.5 text-sm sm:text-xs text-slate-100 placeholder:text-slate-600 focus:outline-none focus:border-amber-400"
                    />
                  </div>
                  <div>
                    <label htmlFor="auth-step2-email" className="block text-[10px] font-mono text-slate-400 uppercase mb-1">
                      Contact Email (Optional)
                    </label>
                    <input
                      id="auth-step2-email"
                      type="email"
                      value={emailInput}
                      onChange={(e) => setEmailInput(e.target.value)}
                      placeholder="you@domain.com"
                      className="w-full min-h-[40px] bg-slate-900 border border-slate-800 rounded-lg px-2.5 py-1.5 text-sm sm:text-xs text-slate-100 placeholder:text-slate-600 focus:outline-none focus:border-amber-400"
                    />
                  </div>
                </div>
              )}

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
                      onClick={() => setSelectedHorizon(item.id as UserTradingProfile['primaryHorizon'])}
                      className={`min-h-[54px] p-2.5 rounded-lg border text-left transition-all cursor-pointer ${
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

              {/* Experience Level */}
              <div className="space-y-1.5">
                <label htmlFor="auth-experience" className="block text-[11px] font-mono text-slate-300 uppercase">
                  Experience Tier
                </label>
                <select
                  id="auth-experience"
                  value={selectedExperience}
                  onChange={(e) => setSelectedExperience(e.target.value as NonNullable<UserTradingProfile['experienceLevel']>)}
                  className="w-full min-h-[44px] sm:min-h-[40px] bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm sm:text-xs text-slate-100 focus:outline-none focus:border-amber-400 font-mono"
                >
                  <option value="NOVICE">Novice (&lt; 1 Year Live Trading)</option>
                  <option value="INTERMEDIATE">Intermediate (1 - 3 Years)</option>
                  <option value="ADVANCED">Advanced (3+ Years / Funded)</option>
                  <option value="INSTITUTIONAL">Institutional / Quant Desk</option>
                </select>
              </div>

              {/* Preferred Broker */}
              <div className="space-y-1.5">
                <label htmlFor="auth-broker" className="block text-[11px] font-mono text-slate-300 uppercase">
                  Primary Broker or Prop Firm
                </label>
                <select
                  id="auth-broker"
                  value={selectedBroker}
                  onChange={(e) => setSelectedBroker(e.target.value)}
                  className="w-full min-h-[44px] sm:min-h-[40px] bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm sm:text-xs text-slate-100 focus:outline-none focus:border-amber-400 font-mono"
                >
                  <option value="ic_markets">IC Markets Global (Raw ECN) — Free Pro Partner</option>
                  <option value="pepperstone">Pepperstone (Razor ECN) — Free Pro Partner</option>
                  <option value="tickmill">Tickmill Prime — Free Pro Partner</option>
                  <option value="prop_ftmo">FTMO / FundedNext (Prop Evaluation)</option>
                  <option value="other">Other Liquidity Provider</option>
                </select>
                <span className="text-[10px] text-emerald-400 font-mono block">
                  Linking a verified IC Markets, Pepperstone, or Tickmill account qualifies for Partner-Sponsored Pro Tier.
                </span>
              </div>

              <div className="pt-2 flex items-center justify-between gap-3">
                <button
                  type="button"
                  onClick={() => {
                    setAuthError(null);
                    setEnrollStep(1);
                  }}
                  className="min-h-[44px] sm:min-h-[40px] px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-mono rounded-lg transition-colors cursor-pointer"
                >
                  Back
                </button>
                <button
                  type="button"
                  onClick={handleCompleteEnrollment}
                  disabled={isLoading}
                  className="flex-1 min-h-[44px] sm:min-h-[40px] flex items-center justify-center gap-2 py-2.5 px-4 bg-gradient-to-r from-amber-500 to-amber-400 hover:from-amber-400 hover:to-amber-300 text-slate-950 font-bold rounded-lg text-xs transition-all shadow-md cursor-pointer disabled:opacity-50"
                >
                  {isLoading ? (
                    <Loader2 className="w-4 h-4 animate-spin text-slate-950" />
                  ) : (
                    <>
                      <span>Create Account &amp; Claim 5 Credits</span>
                      <ArrowRight className="w-4 h-4" />
                    </>
                  )}
                </button>
              </div>
            </div>
          )}

          {/* STEP 3: SIGN-UP COMPLETION */}
          {enrollStep === 3 && (
            <div className="py-5 text-center space-y-4 animate-fade-in font-sans">
              <div className="w-14 h-14 mx-auto rounded-full bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
                <CheckCircle2 className="w-8 h-8" />
              </div>

              <div>
                <span className="text-[10px] font-mono uppercase text-emerald-400 font-bold tracking-wider block">
                  Welcome to GoldVista
                </span>
                <h3 className="text-base font-bold text-slate-100 mt-1">
                  Account Created Successfully
                </h3>
                <p className="text-xs text-slate-300 max-w-sm mx-auto mt-1 leading-relaxed">
                  Signed in as <strong className="text-slate-100">{provisionedSession?.displayName || nameInput}</strong>{' '}
                  (<span className="font-mono text-amber-300">{provisionedSession?.email || emailInput}</span>). Your
                  isolated workspace includes{' '}
                  <strong className="text-amber-400">5 Welcome Alpha Credits</strong>.
                </p>
              </div>

              <div className="p-3 bg-slate-950 border border-slate-800 rounded-lg max-w-xs mx-auto text-xs font-mono text-slate-300">
                <span className="text-slate-500 block text-[10px] uppercase">Unlocked Tier</span>
                <span className="font-bold text-amber-400">FREE REGISTERED MEMBER</span>
                <span className="block text-[11px] text-slate-400 mt-1">
                  5 Credits Available · 3 Daily Free Regens
                </span>
              </div>

              <button
                type="button"
                onClick={onClose}
                className="min-h-[44px] sm:min-h-[40px] inline-flex items-center justify-center gap-2 px-6 py-2.5 bg-gradient-to-r from-amber-500 to-amber-400 hover:from-amber-400 hover:to-amber-300 text-slate-950 font-bold rounded-lg text-xs shadow-md transition-all cursor-pointer"
              >
                <span>Enter Trading Workspace</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          )}
        </div>

        {/* Security & Regulatory Footer */}
        <div className="px-4 sm:px-5 py-3 border-t border-slate-800/80 bg-slate-950/80 text-[10px] font-mono text-slate-500 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-1.5">
            <Lock className="w-3 h-3 text-slate-400" />
            <span>256-bit TLS Encrypted Client Credentials</span>
          </div>
          <span>GoldVista Auth</span>
        </div>
      </div>
    </div>
  );
};
