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
const STORAGE_ACCOUNTS_KEY = 'goldvista_registered_accounts_v1';

export interface RegisteredAccountRecord {
  uid: string;
  email: string;
  displayName: string;
  passwordHash?: string;
  authProvider: AuthProviderType;
  role: UserRole;
  tradingProfile?: UserTradingProfile;
  enrolledAt: string;
  isVerified: boolean;
  linkedBrokerId?: string;
  brokerAccountNumber?: string;
}

const inMemoryAccountsDirectory = new Map<string, RegisteredAccountRecord>();
let inMemorySessionFallback: UserSession | null = null;

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

export function isValidEmailAddress(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
}

/**
 * Deterministic salted credential digest helper that works identically in browser & Node runtimes.
 */
function hashCredentialSecret(secret: string, saltEmail: string): string {
  const input = `gv_auth_v1:${normalizeEmail(saltEmail)}:${secret}`;
  let h1 = 0x811c9dc5;
  let h2 = 0x9e3779b9;
  for (let i = 0; i < input.length; i++) {
    const code = input.charCodeAt(i);
    h1 ^= code;
    h1 = Math.imul(h1, 0x01000193);
    h2 ^= code + ((h1 >>> 16) & 0xff);
    h2 = Math.imul(h2, 0x85ebca6b);
  }
  return `h1_${(h1 >>> 0).toString(16).padStart(8, '0')}${(h2 >>> 0).toString(16).padStart(8, '0')}`;
}

function deterministicUidForEmail(email: string, prefix = 'usr_em'): string {
  const digest = hashCredentialSecret(normalizeEmail(email), 'uid_namespace').replace('h1_', '');
  return `${prefix}_${digest.slice(0, 10)}`;
}

function readRegisteredAccountsDirectory(): Record<string, RegisteredAccountRecord> {
  const merged: Record<string, RegisteredAccountRecord> = {};
  for (const [k, v] of inMemoryAccountsDirectory.entries()) {
    merged[k] = v;
  }
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      const raw = window.localStorage.getItem(STORAGE_ACCOUNTS_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as Record<string, RegisteredAccountRecord>;
        if (parsed && typeof parsed === 'object') {
          for (const [k, v] of Object.entries(parsed)) {
            if (v && v.uid && v.email) {
              merged[normalizeEmail(k)] = v;
              inMemoryAccountsDirectory.set(normalizeEmail(k), v);
            }
          }
        }
      }
    }
  } catch {
    // ignore storage read error
  }
  return merged;
}

function writeRegisteredAccountRecord(record: RegisteredAccountRecord): void {
  const key = normalizeEmail(record.email);
  inMemoryAccountsDirectory.set(key, record);
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      const current = readRegisteredAccountsDirectory();
      current[key] = record;
      window.localStorage.setItem(STORAGE_ACCOUNTS_KEY, JSON.stringify(current));
    }
  } catch {
    // ignore storage write error
  }
}

export function findRegisteredAccountByEmail(email: string): RegisteredAccountRecord | null {
  const key = normalizeEmail(email);
  if (!key) return null;
  const directory = readRegisteredAccountsDirectory();
  if (directory[key]) return directory[key];
  return null;
}

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
const inFlightTokenRefreshes = new Map<string, Promise<string | null>>();

/**
 * Requests a server-signed HMAC-SHA256 `aurum_v1.` token for active sandbox personas (§6.1).
 * Checks `/api/auth/session-config` first so production runtimes with `ALLOW_SANDBOX_PERSONAS=false`
 * skip sandbox token requests cleanly without console 403 noise.
 */
export async function refreshSignedSandboxToken(
  session?: UserSession,
  forceRefresh = false
): Promise<string | null> {
  const active = session || getCurrentSession();
  if (!active || active.role === 'GUEST' || typeof fetch === 'undefined' || typeof window === 'undefined') {
    return null;
  }

  const refreshKey = `${active.uid}:${active.role}`;
  if (!forceRefresh) {
    const existing = inFlightTokenRefreshes.get(refreshKey);
    if (existing) {
      return existing;
    }
  }

  const promise = (async (): Promise<string | null> => {
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
    } finally {
      inFlightTokenRefreshes.delete(refreshKey);
    }
    return null;
  })();

  inFlightTokenRefreshes.set(refreshKey, promise);
  return promise;
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
 * Returns current authenticated user session or initializes with Guest visitor default
 */
export function getCurrentSession(): UserSession {
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      const raw = window.localStorage.getItem(STORAGE_SESSION_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as UserSession;
        inMemorySessionFallback = parsed;
        return parsed;
      }
    }
  } catch (e) {
    console.warn('Failed to load user session from storage:', e);
  }

  if (inMemorySessionFallback) {
    return inMemorySessionFallback;
  }

  const initial = DEMO_PERSONAS.GUEST;
  saveSession(initial);
  return initial;
}

/**
 * Persists session to localStorage
 */
export function saveSession(session: UserSession): void {
  inMemorySessionFallback = session;
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
  performance_insights: 'FREE',
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
    performance_insights: 'Performance Insights & Trade Analytics',
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
        : 'Sign in or create a free account (includes 5 welcome signal credits) to access this feature.',
  };
}

/**
 * Simulates logging in with a social identity provider while preserving deterministic identity continuity.
 */
export async function loginWithSocialProvider(
  provider: 'google' | 'apple' | 'discord' | 'telegram',
  customEmail?: string
): Promise<UserSession> {
  await new Promise((r) => setTimeout(r, 350));

  const email = normalizeEmail(customEmail || `trader.${provider}@commodity-alpha.net`);
  const existing = findRegisteredAccountByEmail(email);
  if (existing) {
    const restored: UserSession = {
      uid: existing.uid,
      email: existing.email,
      displayName: existing.displayName,
      authProvider: existing.authProvider,
      role: existing.role,
      tradingProfile: existing.tradingProfile,
      enrolledAt: existing.enrolledAt,
      lastLoginAt: new Date().toISOString(),
      isVerified: existing.isVerified,
      linkedBrokerId: existing.linkedBrokerId,
      brokerAccountNumber: existing.brokerAccountNumber,
    };
    saveSession(restored);
    clearSignedBearerToken();
    void refreshSignedSandboxToken(restored);
    return restored;
  }

  const displayName =
    provider === 'google'
      ? 'Google Trader'
      : provider === 'apple'
      ? 'Apple Trader'
      : provider === 'discord'
      ? 'GoldAlpha#4128'
      : 'ApexTrader_TG';

  const role: UserRole = provider === 'google' ? 'ALPHA' : 'PRO';
  const uid = deterministicUidForEmail(email, `usr_${provider}`);
  const tradingProfile: UserTradingProfile = {
    primaryHorizon: 'SWING',
    brokerName: 'IC Markets Global',
    accountSize: '$50,000 - $100,000',
    experienceLevel: 'ADVANCED',
  };
  const enrolledAt = new Date().toISOString();

  writeRegisteredAccountRecord({
    uid,
    email,
    displayName,
    authProvider: provider,
    role,
    tradingProfile,
    enrolledAt,
    isVerified: true,
  });

  const session: UserSession = {
    uid,
    email,
    displayName,
    avatarUrl: '',
    authProvider: provider,
    role,
    tradingProfile,
    enrolledAt,
    lastLoginAt: new Date().toISOString(),
    isVerified: true,
  };

  saveSession(session);
  clearSignedBearerToken();
  void refreshSignedSandboxToken(session);
  return session;
}

/**
 * Authenticates a user by email and optional password, recovering their persistent registered UID
 * or matching a built-in sandbox persona email. Strict mode enforces existing account & password verification.
 */
export async function loginWithEmail(
  email: string,
  pass?: string,
  options?: { strictRegisteredOnly?: boolean }
): Promise<UserSession> {
  await new Promise((r) => setTimeout(r, 350));

  const normalized = normalizeEmail(email);
  if (!isValidEmailAddress(normalized)) {
    throw new Error('Please enter a valid email address.');
  }

  // 1. Check persisted registered user accounts first so returning users recover their exact UID & portfolio
  const registered = findRegisteredAccountByEmail(normalized);
  if (registered) {
    if (registered.passwordHash) {
      if (!pass || hashCredentialSecret(pass, normalized) !== registered.passwordHash) {
        throw new Error('Incorrect password for this account. Please check your credentials.');
      }
    }
    const restored: UserSession = {
      uid: registered.uid,
      email: registered.email,
      displayName: registered.displayName,
      authProvider: registered.authProvider,
      role: registered.role,
      tradingProfile: registered.tradingProfile,
      enrolledAt: registered.enrolledAt,
      lastLoginAt: new Date().toISOString(),
      isVerified: registered.isVerified,
      linkedBrokerId: registered.linkedBrokerId,
      brokerAccountNumber: registered.brokerAccountNumber,
    };
    saveSession(restored);
    clearSignedBearerToken();
    void refreshSignedSandboxToken(restored);
    return restored;
  }

  // 2. Check built-in demo personas if their email is entered directly
  const matchingDemo = (Object.values(DEMO_PERSONAS) as UserSession[]).find(
    (p) => p.role !== 'GUEST' && normalizeEmail(p.email) === normalized
  );
  if (matchingDemo) {
    const demoSession: UserSession = {
      ...matchingDemo,
      lastLoginAt: new Date().toISOString(),
    };
    saveSession(demoSession);
    clearSignedBearerToken();
    void refreshSignedSandboxToken(demoSession);
    return demoSession;
  }

  // 3. In strict credential Sign-In mode (used by Sign In UI with password), reject unknown accounts
  if (options?.strictRegisteredOnly) {
    throw new Error('No account found for this email address. Please Sign Up to create an account.');
  }

  // 4. Legacy single-argument sandbox email login: deterministic UID scoped cleanly to email
  const username = normalized.split('@')[0] || 'Trader';
  const uid = deterministicUidForEmail(normalized, 'usr_em');
  const displayName = username.charAt(0).toUpperCase() + username.slice(1);
  const enrolledAt = new Date().toISOString();
  const tradingProfile: UserTradingProfile = {
    primaryHorizon: 'INTRADAY',
    experienceLevel: 'INTERMEDIATE',
  };

  writeRegisteredAccountRecord({
    uid,
    email: normalized,
    displayName,
    passwordHash: pass ? hashCredentialSecret(pass, normalized) : undefined,
    authProvider: 'email',
    role: 'FREE',
    tradingProfile,
    enrolledAt,
    isVerified: true,
  });

  const session: UserSession = {
    uid,
    email: normalized,
    displayName,
    authProvider: 'email',
    role: 'FREE',
    tradingProfile,
    enrolledAt,
    lastLoginAt: new Date().toISOString(),
    isVerified: true,
  };

  saveSession(session);
  clearSignedBearerToken();
  void refreshSignedSandboxToken(session);
  return session;
}

/**
 * Registers a brand new customer with persistent credentials, duplicate email guard,
 * and tailored trading profile.
 */
export async function enrollNewCustomer(data: {
  email: string;
  displayName: string;
  authProvider: AuthProviderType;
  tradingProfile: UserTradingProfile;
  password?: string;
  rejectDuplicate?: boolean;
}): Promise<UserSession> {
  await new Promise((r) => setTimeout(r, 450));

  const normalized = normalizeEmail(data.email);
  if (!isValidEmailAddress(normalized)) {
    throw new Error('Please provide a valid institutional or personal email address.');
  }
  if (data.password !== undefined && data.password.length < 8) {
    throw new Error('Password must be at least 8 characters long.');
  }

  const existing = findRegisteredAccountByEmail(normalized);
  if (existing && data.rejectDuplicate) {
    throw new Error('An account with this email is already registered. Please Sign In instead.');
  }

  const uid = existing ? existing.uid : deterministicUidForEmail(normalized, 'usr_new');
  const displayName = data.displayName.trim() || normalized.split('@')[0] || 'Commodity Trader';
  const enrolledAt = existing?.enrolledAt || new Date().toISOString();

  writeRegisteredAccountRecord({
    uid,
    email: normalized,
    displayName,
    passwordHash: data.password ? hashCredentialSecret(data.password, normalized) : existing?.passwordHash,
    authProvider: data.authProvider,
    role: existing?.role || 'FREE',
    tradingProfile: data.tradingProfile,
    enrolledAt,
    isVerified: true,
    linkedBrokerId: existing?.linkedBrokerId,
    brokerAccountNumber: existing?.brokerAccountNumber,
  });

  const session: UserSession = {
    uid,
    email: normalized,
    displayName,
    authProvider: data.authProvider,
    role: existing?.role || 'FREE',
    tradingProfile: data.tradingProfile,
    enrolledAt,
    lastLoginAt: new Date().toISOString(),
    isVerified: true,
  };

  saveSession(session);
  clearSignedBearerToken();
  void refreshSignedSandboxToken(session);
  return session;
}

/**
 * Updates the signed-in user's membership tier in place while preserving their exact UID,
 * email, display name, and private portfolio ledger.
 */
export function updateCurrentUserTier(newRole: Exclude<UserRole, 'GUEST'>): UserSession {
  const current = getCurrentSession();
  if (!current || current.role === 'GUEST') {
    return switchPersona(newRole);
  }

  const updated: UserSession = {
    ...current,
    role: newRole,
    lastLoginAt: new Date().toISOString(),
  };

  if (updated.email) {
    const existing = findRegisteredAccountByEmail(updated.email);
    if (existing) {
      writeRegisteredAccountRecord({
        ...existing,
        role: newRole,
      });
    }
  }

  saveSession(updated);
  clearSignedBearerToken();
  void refreshSignedSandboxToken(updated, true);
  return updated;
}

/**
 * Switches the active persona (for testing demo sandbox accounts explicitly without signing up)
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
    void refreshSignedSandboxToken(session, true);
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
 * Prefers server-issued HMAC-SHA256 `aurum_v1.` tokens when cached; falls back to dev `aurum_sess_` token
 * carrying `.uid_<uid>` so distinct users remain strictly isolated on the server.
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
  const uidSuffix = active.uid ? `.uid_${encodeURIComponent(active.uid)}` : '';
  return `aurum_sess_${active.role.toLowerCase()}_${expUnix}${uidSuffix}`;
}

/**
 * Ensures a signed `aurum_v1.` bearer token (bound to `active.uid`) is acquired
 * before making tenant-scoped API calls, clearing stale tokens when `forceRefresh` is true.
 */
export async function ensureSignedBearerToken(
  session?: UserSession,
  forceRefresh = false
): Promise<string> {
  const active = session || getCurrentSession();
  if (!active || active.role === 'GUEST') {
    return '';
  }
  if (forceRefresh) {
    clearSignedBearerToken();
  } else {
    const cached = readCachedSignedToken();
    if (cached && cached.role === active.role && cached.uid === active.uid) {
      return cached.token;
    }
  }
  const refreshed = await refreshSignedSandboxToken(active, forceRefresh);
  if (refreshed) {
    return refreshed;
  }
  return getSessionBearerToken(active);
}
