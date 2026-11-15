/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * Aurum Intelligence — User Enrollment, Identity & Access Control (RBAC) Service
 * Manages customer enrollment, social logins (Google, Apple, Telegram, Discord, Email/Passkey),
 * and role-based permissions (Guest, Free, Pro, Institutional Alpha).
 */

import { WorkspaceId } from '../components/Sidebar';

export type UserRole = 'GUEST' | 'FREE' | 'PRO' | 'ALPHA';

export type AuthProviderType = 'google' | 'apple' | 'email' | 'discord' | 'telegram' | 'guest';

export interface UserTradingProfile {
  primaryHorizon: 'INTRADAY' | 'SWING' | 'PROP_FIRM' | 'MACRO';
  brokerName?: string;
  accountSize?: string;
  experienceLevel?: 'NOVICE' | 'INTERMEDIATE' | 'ADVANCED' | 'INSTITUTIONAL';
}

export interface UserSession {
  uid: string;
  email: string;
  displayName: string;
  avatarUrl?: string;
  authProvider: AuthProviderType;
  role: UserRole;
  tradingProfile?: UserTradingProfile;
  enrolledAt: string;
  lastLoginAt: string;
  isVerified: boolean;
  linkedBrokerId?: string;
  brokerAccountNumber?: string;
}

export interface AccessCheckResult {
  allowed: boolean;
  requiredRole: UserRole;
  currentRole: UserRole;
  workspaceTitle: string;
  reason: string;
  upgradePrompt: string;
}

const STORAGE_SESSION_KEY = 'goldvista_user_session_v2';
const STORAGE_SIGNED_TOKEN_KEY = 'goldvista_signed_bearer_v1';

interface CachedSignedToken {
  role: UserRole;
  uid: string;
  token: string;
  expiresAtMs: number;
}

let inMemorySignedToken: CachedSignedToken | null = null;

function isAcceptedCachedTokenFormat(token?: string): boolean {
  if (!token) return false;
  return token.startsWith('aurum_v1.') || token.split('.').length === 3;
}

function readCachedSignedToken(): CachedSignedToken | null {
  if (inMemorySignedToken && inMemorySignedToken.expiresAtMs > Date.now() + 30_000) {
    return inMemorySignedToken;
  }
  try {
    if (typeof window !== 'undefined' && window.sessionStorage) {
      const raw = window.sessionStorage.getItem(STORAGE_SIGNED_TOKEN_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as CachedSignedToken;
        if (isAcceptedCachedTokenFormat(parsed?.token) && parsed.expiresAtMs > Date.now() + 30_000) {
          inMemorySignedToken = parsed;
          return parsed;
        }
      }
    }
  } catch {
    // ignore storage read error
  }
  return null;
}

export function setSignedBearerToken(role: UserRole, uid: string, token: string, expiresAtIso?: string): void {
  const expiresAtMs = expiresAtIso ? Date.parse(expiresAtIso) : Date.now() + 3500_000;
  const entry: CachedSignedToken = { role, uid, token, expiresAtMs };
  inMemorySignedToken = entry;
  try {
    if (typeof window !== 'undefined' && window.sessionStorage) {
      window.sessionStorage.setItem(STORAGE_SIGNED_TOKEN_KEY, JSON.stringify(entry));
    }
  } catch {
    // ignore storage write error
  }
}

/**
 * Registers an external OIDC/PKCE ID or Access JWT bearer token for the active authenticated user.
 */
export function setOidcBearerToken(token: string, role: UserRole, uid: string, expiresAtIso?: string): void {
  if (!token || token.split('.').length !== 3) {
    throw new Error('OIDC bearer token must be a compact 3-part JWT.');
  }
  setSignedBearerToken(role, uid, token, expiresAtIso);
}

export function clearSignedBearerToken(): void {
  inMemorySignedToken = null;
  try {
    if (typeof window !== 'undefined' && window.sessionStorage) {
      window.sessionStorage.removeItem(STORAGE_SIGNED_TOKEN_KEY);
    }
  } catch {
    // ignore storage remove error
  }
}

export interface PkceChallengePair {
  codeVerifier: string;
  codeChallenge: string;
  method: 'S256';
}

function bytesToBase64Url(bytes: Uint8Array): string {
  if (typeof Buffer !== 'undefined') {
    return Buffer.from(bytes).toString('base64url');
  }
  let binary = '';
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

/**
 * Generates an RFC 7636 PKCE code_verifier and SHA-256 S256 code_challenge.
 */
export async function generatePkceVerifierAndChallenge(): Promise<PkceChallengePair> {
  const cryptoApi = globalThis.crypto;
  if (!cryptoApi?.getRandomValues || !cryptoApi?.subtle) {
    throw new Error('WebCrypto API is unavailable for PKCE S256 challenge generation.');
  }
  const verifierBytes = new Uint8Array(32);
  cryptoApi.getRandomValues(verifierBytes);
  const codeVerifier = bytesToBase64Url(verifierBytes);
  const digestBuffer = await cryptoApi.subtle.digest('SHA-256', new TextEncoder().encode(codeVerifier));
  const codeChallenge = bytesToBase64Url(new Uint8Array(digestBuffer));
  return {
    codeVerifier,
    codeChallenge,
    method: 'S256',
  };
}

export function buildOidcAuthorizeUrl(params: {
  authorizationEndpoint: string;
  clientId: string;
  redirectUri: string;
  codeChallenge: string;
  scope?: string;
  state?: string;
}): string {
  const url = new URL(params.authorizationEndpoint);
  url.searchParams.set('response_type', 'code');
  url.searchParams.set('client_id', params.clientId);
  url.searchParams.set('redirect_uri', params.redirectUri);
  url.searchParams.set('scope', params.scope || 'openid profile email');
  url.searchParams.set('code_challenge', params.codeChallenge);
  url.searchParams.set('code_challenge_method', 'S256');
  if (params.state) {
    url.searchParams.set('state', params.state);
  }
  return url.toString();
}

/**
 * Completes an OIDC Authorization Code + PKCE callback by validating stored state,
 * posting `{ code, codeVerifier, redirectUri }` to `/api/auth/oidc-exchange`,
 * and persisting the verified JWT bearer token cleanly.
 */
export async function completeOidcPkceCallback(
  code: string,
  state: string,
  redirectUri?: string,
  customVerifier?: string,
  expectedStateOverride?: string
): Promise<{ token: string; role: UserRole; userId: string; expiresAt?: string }> {
  let storedState: string | null = expectedStateOverride ?? null;
  let storedVerifier: string | null = customVerifier ?? null;

  try {
    if (typeof window !== 'undefined' && window.sessionStorage) {
      if (storedState === null) {
        storedState = window.sessionStorage.getItem('goldvista_pkce_state');
      }
      if (!storedVerifier) {
        storedVerifier = window.sessionStorage.getItem('goldvista_pkce_verifier');
      }
      window.sessionStorage.removeItem('goldvista_pkce_state');
      window.sessionStorage.removeItem('goldvista_pkce_verifier');
    }
  } catch {
    // ignore storage read/cleanup error
  }

  if (storedState !== null && storedState !== state) {
    throw new Error('Invalid OIDC state parameter: possible CSRF mismatch.');
  }
  if (!code || !storedVerifier) {
    throw new Error('Missing authorization code or PKCE code_verifier for OIDC token exchange.');
  }

  const effectiveRedirect =
    redirectUri || (typeof window !== 'undefined' ? `${window.location.origin}/auth/callback` : '');
  const res = await fetch('/api/auth/oidc-exchange', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      code,
      codeVerifier: storedVerifier,
      redirectUri: effectiveRedirect,
    }),
  });
  const payload = (await res.json()) as {
    success?: boolean;
    token?: string;
    role?: UserRole;
    userId?: string;
    expiresAt?: string;
    error?: string;
  };
  if (!res.ok || !payload.success || !payload.token) {
    throw new Error(payload.error || `OIDC token exchange failed (HTTP ${res.status}).`);
  }

  const resolvedRole: UserRole = payload.role || 'FREE';
  const resolvedUid = payload.userId || 'usr_oidc_verified';
  setOidcBearerToken(payload.token, resolvedRole, resolvedUid, payload.expiresAt);
  return {
    token: payload.token,
    role: resolvedRole,
    userId: resolvedUid,
    expiresAt: payload.expiresAt,
  };
}

let cachedSandboxModeEnabled: boolean | null = null;

/**
 * Requests a server-signed HMAC-SHA256 `aurum_v1.` token for active sandbox personas (§6.1).
 * Checks `/api/auth/session-config` first so production runtimes with `ALLOW_SANDBOX_PERSONAS=false`
 * skip sandbox token requests cleanly without console 403 noise.
 */
export async function refreshSignedSandboxToken(session?: UserSession): Promise<string | null> {
  const active = session || getCurrentSession();
  if (!active || active.role === 'GUEST' || typeof fetch === 'undefined' || typeof window === 'undefined') {
    return null;
  }
  try {
    if (cachedSandboxModeEnabled === null) {
      const cfgRes = await fetch('/api/auth/session-config');
      if (cfgRes.ok) {
        const cfg = (await cfgRes.json()) as { sandboxModeEnabled?: boolean };
        cachedSandboxModeEnabled = Boolean(cfg?.sandboxModeEnabled);
      }
    }
    if (cachedSandboxModeEnabled === false) {
      return null;
    }

    const res = await fetch('/api/auth/sandbox-token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ persona: active.role.toLowerCase(), userId: active.uid }),
    });
    if (!res.ok) return null;
    const data = (await res.json()) as { token?: string; expiresAt?: string };
    if (data?.token && data.token.startsWith('aurum_v1.')) {
      setSignedBearerToken(active.role, active.uid, data.token, data.expiresAt);
      return data.token;
    }
  } catch {
    // Ignore transient network errors when refreshing sandbox bearer token
  }
  return null;
}

// Predefined Demo Personas for evaluation & switching
export const DEMO_PERSONAS: Record<UserRole, UserSession> = {
  ALPHA: {
    uid: 'usr_alpha_9901',
    email: 'csemeer@gmail.com',
    displayName: 'Alex Vance',
    avatarUrl: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=120&h=120&q=80',
    authProvider: 'google',
    role: 'ALPHA',
    tradingProfile: {
      primaryHorizon: 'MACRO',
      brokerName: 'IC Markets Global (Raw ECN)',
      accountSize: '$250,000+',
      experienceLevel: 'INSTITUTIONAL',
    },
    enrolledAt: '2026-01-15T09:00:00Z',
    lastLoginAt: new Date().toISOString(),
    isVerified: true,
    linkedBrokerId: 'ic_markets',
    brokerAccountNumber: 'MT5-998822',
  },
  PRO: {
    uid: 'usr_pro_4412',
    email: 'marcus.chen@capital-alpha.com',
    displayName: 'Marcus Chen',
    avatarUrl: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=120&h=120&q=80',
    authProvider: 'apple',
    role: 'PRO',
    tradingProfile: {
      primaryHorizon: 'PROP_FIRM',
      brokerName: 'Pepperstone Razor',
      accountSize: '$100,000 Prop Challenge',
      experienceLevel: 'ADVANCED',
    },
    enrolledAt: '2026-02-10T11:20:00Z',
    lastLoginAt: new Date().toISOString(),
    isVerified: true,
    linkedBrokerId: 'pepperstone',
    brokerAccountNumber: 'CT-774411',
  },
  FREE: {
    uid: 'usr_free_1029',
    email: 'elena.rostova@gmail.com',
    displayName: 'Elena Rostova',
    avatarUrl: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&w=120&h=120&q=80',
    authProvider: 'email',
    role: 'FREE',
    tradingProfile: {
      primaryHorizon: 'SWING',
      brokerName: 'Tickmill Pro',
      accountSize: '$10,000 - $25,000',
      experienceLevel: 'INTERMEDIATE',
    },
    enrolledAt: '2026-03-01T14:15:00Z',
    lastLoginAt: new Date().toISOString(),
    isVerified: true,
  },
  GUEST: {
    uid: 'usr_guest_0000',
    email: 'visitor@goldvista.io',
    displayName: 'Guest Visitor',
    avatarUrl: '',
    authProvider: 'guest',
    role: 'GUEST',
    enrolledAt: new Date().toISOString(),
    lastLoginAt: new Date().toISOString(),
    isVerified: false,
  },
};

/**
 * Returns current authenticated user session or initializes with Pro trader default
 */
export function getCurrentSession(): UserSession {
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      const raw = window.localStorage.getItem(STORAGE_SESSION_KEY);
      if (raw) {
        return JSON.parse(raw);
      }
    }
  } catch (e) {
    console.warn('Failed to load user session from storage:', e);
  }

  // Default to Guest visitor persona for new visitors to initiate enrollment
  const initial = DEMO_PERSONAS.GUEST;
  saveSession(initial);
  return initial;
}

/**
 * Persists session to localStorage
 */
export function saveSession(session: UserSession): void {
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      window.localStorage.setItem(STORAGE_SESSION_KEY, JSON.stringify(session));
    }
  } catch (e) {
    console.warn('Failed to save user session to storage:', e);
  }
}

/**
 * Role hierarchy levels for numerical comparison
 */
const ROLE_HIERARCHY: Record<UserRole, number> = {
  GUEST: 0,
  FREE: 1,
  PRO: 2,
  ALPHA: 3,
};

/**
 * Maps each workspace to its minimum required membership tier
 */
export const WORKSPACE_TIER_REQUIREMENTS: Record<WorkspaceId, UserRole> = {
  overview: 'GUEST',
  terminal: 'GUEST',
  monetization: 'GUEST',
  reports: 'GUEST', // preview available to all; institutional export watermarked for free/guest
  technical: 'FREE',
  intraday: 'FREE',
  swing: 'FREE',
  longterm: 'FREE',
  cfd: 'FREE',
  news_sentiment: 'FREE',
  scenarios: 'FREE',
  macro: 'FREE',
  events: 'FREE',
  portfolio: 'FREE',
  market_data_config: 'FREE',
  alerts: 'FREE',
  strategies: 'PRO',
  backtesting: 'PRO',
  telegram_notifications: 'PRO',
  council: 'ALPHA',
  llm_platform: 'ALPHA',
  gemini_chat: 'ALPHA',
};

/**
 * Checks if a given user role can access the specified workspace
 */
export function canAccessWorkspace(
  role: UserRole,
  workspaceId: WorkspaceId
): AccessCheckResult {
  const requiredRole = WORKSPACE_TIER_REQUIREMENTS[workspaceId] || 'GUEST';
  const userLevel = ROLE_HIERARCHY[role] ?? 0;
  const reqLevel = ROLE_HIERARCHY[requiredRole] ?? 0;
  const allowed = userLevel >= reqLevel;

  const titles: Record<WorkspaceId, string> = {
    overview: 'Commodity Overview',
    terminal: 'Live 5Y Historical Terminal',
    technical: 'Technical Analysis & Indicators',
    intraday: 'Intraday Session Advisor',
    swing: 'Swing Trading Advisor',
    longterm: 'Long-Term Secular Outlook',
    cfd: 'CFD Risk & Margin Calculator',
    news_sentiment: 'News Discovery & Causal Sentiment',
    scenarios: 'Macro Scenarios & Analogues',
    macro: 'Macroeconomic Series & Vintages',
    events: 'Historical Event Studies',
    strategies: 'Quantitative Strategy Lab',
    backtesting: 'Walk-Forward Backtesting Engine',
    portfolio: 'Paper Trading Portfolio & Journal',
    council: 'AI Advisory Council & Specialist Agents',
    reports: 'Intelligence Reports & PDF Export',
    alerts: 'Alerts & Market Data Health',
    llm_platform: 'LLM Platform & Custom Synthesis',
    market_data_config: 'Market Data Providers & Connectivity',
    telegram_notifications: 'Telegram Webhooks & Multi-Channel Delivery',
    gemini_chat: 'Gemini AI Research Chatbot',
    monetization: 'Pricing & VIP Access Hub',
  };

  const descriptions: Partial<Record<WorkspaceId, string>> = {
    strategies: 'Institutional code parameters, genetic optimization, and multi-factor quantitative filters require GoldVista Pro.',
    backtesting: 'Walk-forward historical execution simulation across 5-year tick datasets is reserved for Pro members.',
    telegram_notifications: 'Real-time automated webhook and push notification dispatch to personal Telegram bots requires Pro tier.',
    council: 'The Multi-Agent AI Advisory Council (Technical, Macro, Order Flow, Geopolitics) is an exclusive Institutional Alpha capability.',
    llm_platform: 'Deep LLM custom report synthesis and automated publication gates require Institutional Alpha credentials.',
    gemini_chat: 'Direct conversational access to the dedicated Gemini AI Commodity Research Analyst requires Institutional Alpha.',
  };

  return {
    allowed,
    requiredRole,
    currentRole: role,
    workspaceTitle: titles[workspaceId] || workspaceId,
    reason: descriptions[workspaceId] || `Access to this advanced intelligence module requires ${requiredRole} membership.`,
    upgradePrompt:
      requiredRole === 'ALPHA'
        ? 'Upgrade to Institutional Alpha ($199/mo) to unlock private AI specialists and unlimited bespoke models.'
        : requiredRole === 'PRO'
        ? 'Upgrade to Pro ($49/mo) or link an active partner ECN broker account for sponsored access.'
        : 'Sign in or enroll free (includes 5 welcome signal credits) to access this feature.',
  };
}

/**
 * Simulates logging in with a social identity provider
 */
export async function loginWithSocialProvider(
  provider: 'google' | 'apple' | 'discord' | 'telegram',
  customEmail?: string
): Promise<UserSession> {
  // Simulate network roundtrip latency
  await new Promise((r) => setTimeout(r, 600));

  const email = customEmail || (provider === 'google' ? 'csemeer@gmail.com' : `trader.${provider}@commodity-alpha.net`);
  const displayName =
    provider === 'google'
      ? 'Alex Vance'
      : provider === 'apple'
      ? 'Marcus Chen'
      : provider === 'discord'
      ? 'GoldAlpha#4128'
      : 'ApexTrader_TG';

  const avatarUrl =
    provider === 'google'
      ? 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=120&h=120&q=80'
      : provider === 'apple'
      ? 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=120&h=120&q=80'
      : '';

  const session: UserSession = {
    uid: `usr_${provider}_${Math.random().toString(36).substring(2, 9)}`,
    email,
    displayName,
    avatarUrl,
    authProvider: provider,
    role: provider === 'google' ? 'ALPHA' : 'PRO',
    tradingProfile: {
      primaryHorizon: 'SWING',
      brokerName: 'IC Markets Global',
      accountSize: '$50,000 - $100,000',
      experienceLevel: 'ADVANCED',
    },
    enrolledAt: '2026-01-20T08:00:00Z',
    lastLoginAt: new Date().toISOString(),
    isVerified: true,
  };

  saveSession(session);
  void refreshSignedSandboxToken(session);
  return session;
}

/**
 * Simulates email magic link or password authentication
 */
export async function loginWithEmail(
  email: string,
  _pass?: string
): Promise<UserSession> {
  await new Promise((r) => setTimeout(r, 650));

  const username = email.split('@')[0] || 'Trader';
  const session: UserSession = {
    uid: `usr_em_${Math.random().toString(36).substring(2, 9)}`,
    email,
    displayName: username.charAt(0).toUpperCase() + username.slice(1),
    authProvider: 'email',
    role: 'FREE',
    tradingProfile: {
      primaryHorizon: 'INTRADAY',
      experienceLevel: 'INTERMEDIATE',
    },
    enrolledAt: new Date().toISOString(),
    lastLoginAt: new Date().toISOString(),
    isVerified: true,
  };

  saveSession(session);
  void refreshSignedSandboxToken(session);
  return session;
}

/**
 * Enrolls a brand new customer through the multi-step questionnaire
 */
export async function enrollNewCustomer(data: {
  email: string;
  displayName: string;
  authProvider: AuthProviderType;
  tradingProfile: UserTradingProfile;
}): Promise<UserSession> {
  await new Promise((r) => setTimeout(r, 800));

  const session: UserSession = {
    uid: `usr_new_${Math.random().toString(36).substring(2, 9)}`,
    email: data.email,
    displayName: data.displayName || data.email.split('@')[0],
    authProvider: data.authProvider,
    role: 'FREE',
    tradingProfile: data.tradingProfile,
    enrolledAt: new Date().toISOString(),
    lastLoginAt: new Date().toISOString(),
    isVerified: true,
  };

  saveSession(session);
  void refreshSignedSandboxToken(session);
  return session;
}

/**
 * Switches the active persona (for testing all roles without logging out)
 */
export function switchPersona(role: UserRole): UserSession {
  const template = DEMO_PERSONAS[role];
  const session: UserSession = {
    ...template,
    lastLoginAt: new Date().toISOString(),
  };
  saveSession(session);
  if (role === 'GUEST') {
    clearSignedBearerToken();
  } else {
    clearSignedBearerToken();
    void refreshSignedSandboxToken(session);
  }
  return session;
}

/**
 * Logs out and reverts to Guest Visitor session
 */
export function logoutUser(): UserSession {
  const guest = DEMO_PERSONAS.GUEST;
  clearSignedBearerToken();
  saveSession(guest);
  return guest;
}

/**
 * Generates or retrieves an API Bearer token aligned with the active browser session persona.
 * Prefers server-issued HMAC-SHA256 `aurum_v1.` tokens when cached; falls back to dev `aurum_sess_` token otherwise.
 */
export function getSessionBearerToken(session?: UserSession): string {
  const active = session || getCurrentSession();
  if (!active || active.role === 'GUEST') {
    return '';
  }
  const cached = readCachedSignedToken();
  if (cached && cached.role === active.role && cached.uid === active.uid) {
    return cached.token;
  }
  const expUnix = Math.floor(Date.now() / 1000) + 3600;
  return `aurum_sess_${active.role.toLowerCase()}_${expUnix}`;
}
