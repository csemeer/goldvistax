/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * GoldVista — Server-Side Cryptographic Webhook & RBAC Verification Utilities
 */

import crypto from 'node:crypto';
import fs from 'node:fs';
import type { Request, Response, NextFunction } from 'express';
import { EnterpriseBillingEngine } from './src/services/billingWebhookEngine';

export interface StripeSignatureCheckResult {
  valid: boolean;
  reason?: string;
  timestamp?: number;
}

/**
 * Verifies a Stripe `Stripe-Signature` header (`t=<unix>,v1=<hmac_sha256_hex>`)
 * using timing-safe comparison and replay tolerance window (default 300s).
 */
export function verifyStripeWebhookSignature(
  rawBody: string,
  signatureHeader: string | undefined,
  secret: string,
  toleranceSeconds = 300,
  nowEpochSeconds = Math.floor(Date.now() / 1000)
): StripeSignatureCheckResult {
  if (!secret) {
    return { valid: false, reason: 'STRIPE_WEBHOOK_SECRET is not configured.' };
  }
  if (!signatureHeader || typeof signatureHeader !== 'string') {
    return { valid: false, reason: 'Missing Stripe-Signature header.' };
  }

  const parts = signatureHeader.split(',').map((p) => p.trim());
  let timestamp: number | undefined;
  const v1Signatures: string[] = [];

  for (const part of parts) {
    const [key, value] = part.split('=');
    if (key === 't' && value) {
      const parsed = Number.parseInt(value, 10);
      if (Number.isFinite(parsed)) timestamp = parsed;
    } else if (key === 'v1' && value) {
      v1Signatures.push(value);
    }
  }

  if (!timestamp || v1Signatures.length === 0) {
    return { valid: false, reason: 'Malformed Stripe-Signature header (missing t or v1).' };
  }

  if (Math.abs(nowEpochSeconds - timestamp) > toleranceSeconds) {
    return {
      valid: false,
      timestamp,
      reason: `Webhook signature timestamp outside ${toleranceSeconds}s replay tolerance.`,
    };
  }

  const signedPayload = `${timestamp}.${rawBody}`;
  const expectedHmac = crypto.createHmac('sha256', secret).update(signedPayload, 'utf8').digest('hex');
  const expectedBuf = Buffer.from(expectedHmac, 'utf8');

  const matched = v1Signatures.some((sig) => {
    const candidateBuf = Buffer.from(sig, 'utf8');
    if (candidateBuf.length !== expectedBuf.length) return false;
    return crypto.timingSafeEqual(candidateBuf, expectedBuf);
  });

  if (!matched) {
    return { valid: false, timestamp, reason: 'Stripe-Signature v1 HMAC mismatch.' };
  }

  return { valid: true, timestamp };
}

export type ServerRoleTier = 'GUEST' | 'FREE' | 'PRO' | 'ALPHA';

const TIER_RANK: Record<ServerRoleTier, number> = {
  GUEST: 0,
  FREE: 1,
  PRO: 2,
  ALPHA: 3,
};

const PERSONA_ROLE_MAP: Record<string, ServerRoleTier> = {
  guest: 'GUEST',
  free: 'FREE',
  trader: 'FREE',
  pro: 'PRO',
  risk_manager: 'PRO',
  alpha: 'ALPHA',
  fund_allocator: 'ALPHA',
  institutional: 'ALPHA',
};

function loadOrCreateDevSessionSecret(): string {
  if (process.env.NODE_ENV === 'production') {
    return crypto.randomBytes(32).toString('hex');
  }
  const secretPath = process.env.AURUM_DEV_SECRET_PATH || '/tmp/aurum-dev-session-secret.key';
  try {
    if (fs.existsSync(secretPath)) {
      const existing = fs.readFileSync(secretPath, 'utf8').trim();
      if (/^[a-f0-9]{32,}$/i.test(existing)) {
        return existing;
      }
    }
    const generated = crypto.randomBytes(32).toString('hex');
    fs.writeFileSync(secretPath, generated, { encoding: 'utf8', mode: 0o600 });
    return generated;
  } catch {
    return crypto.createHmac('sha256', 'aurum-ephemeral-dev-seed').update(process.cwd()).digest('hex');
  }
}

const RUNTIME_SESSION_SECRET =
  process.env.AURUM_SESSION_SECRET || loadOrCreateDevSessionSecret();

export function isSandboxPersonasEnabled(): boolean {
  if (process.env.NODE_ENV === 'production') {
    return process.env.ALLOW_SANDBOX_PERSONAS === 'true';
  }
  return process.env.ALLOW_SANDBOX_PERSONAS !== 'false';
}

export function getActiveSessionSecret(): string {
  return process.env.AURUM_SESSION_SECRET || RUNTIME_SESSION_SECRET;
}

/**
 * Signs an HMAC-SHA256 server session token (`aurum_v1.<payload_b64url>.<hmac_hex>`) (§6.1-6.2).
 */
export function signServerSessionToken(
  persona: string,
  userId = 'usr_demo_trader',
  ttlSeconds = 3600,
  secret = getActiveSessionSecret()
): string {
  const payload = {
    persona: persona.toLowerCase(),
    userId,
    iat: Math.floor(Date.now() / 1000),
    exp: Math.floor(Date.now() / 1000) + ttlSeconds,
  };
  const encoded = Buffer.from(JSON.stringify(payload), 'utf8').toString('base64url');
  const sig = crypto.createHmac('sha256', secret).update(encoded, 'utf8').digest('hex');
  return `aurum_v1.${encoded}.${sig}`;
}

export function verifySignedServerToken(
  token: string,
  secret = getActiveSessionSecret(),
  nowEpochSeconds = Math.floor(Date.now() / 1000)
): { valid: boolean; persona?: string; userId?: string; expiresAt?: string; reason?: string } {
  if (!token.startsWith('aurum_v1.')) {
    return { valid: false, reason: 'Invalid signed token prefix.' };
  }
  const parts = token.split('.');
  if (parts.length !== 3 || !parts[1] || !parts[2]) {
    return { valid: false, reason: 'Malformed signed session token.' };
  }

  const expectedSig = crypto.createHmac('sha256', secret).update(parts[1], 'utf8').digest('hex');
  const expectedBuf = Buffer.from(expectedSig, 'utf8');
  const candidateBuf = Buffer.from(parts[2], 'utf8');
  if (candidateBuf.length !== expectedBuf.length || !crypto.timingSafeEqual(candidateBuf, expectedBuf)) {
    return { valid: false, reason: 'Session token cryptographic HMAC signature mismatch.' };
  }

  try {
    const parsed = JSON.parse(Buffer.from(parts[1], 'base64url').toString('utf8')) as {
      persona?: string;
      userId?: string;
      exp?: number;
    };
    if (!parsed.exp || nowEpochSeconds > parsed.exp) {
      return { valid: false, reason: 'Signed session token expired.' };
    }
    return {
      valid: true,
      persona: parsed.persona || 'free',
      userId: parsed.userId || 'usr_demo_trader',
      expiresAt: new Date(parsed.exp * 1000).toISOString(),
    };
  } catch {
    return { valid: false, reason: 'Corrupt signed token payload.' };
  }
}

/**
 * Fail-closed server RBAC token checker for protected endpoints (§6.1-6.2).
 * Accepts HMAC-signed `aurum_v1.` tokens always; rejects unsigned `aurum_sess_` sandbox tokens when sandbox mode is disabled.
 */
export function evaluateServerRoleFromToken(
  token: string | undefined,
  requiredTier: ServerRoleTier,
  sandboxAllowed = isSandboxPersonasEnabled()
): { authorized: boolean; resolvedTier: ServerRoleTier; userId?: string; tokenType?: string; reason?: string } {
  if (!token) {
    return { authorized: false, resolvedTier: 'GUEST', reason: 'Missing bearer session token.' };
  }

  if (token.startsWith('aurum_v1.')) {
    const signedCheck = verifySignedServerToken(token);
    if (!signedCheck.valid) {
      return {
        authorized: false,
        resolvedTier: 'GUEST',
        tokenType: 'HMAC_V1',
        reason: signedCheck.reason || 'Signed session verification failed.',
      };
    }
    const personaKey = (signedCheck.persona || '').toLowerCase();
    const resolvedTier: ServerRoleTier = PERSONA_ROLE_MAP[personaKey] || 'FREE';
    const authorized = TIER_RANK[resolvedTier] >= TIER_RANK[requiredTier];
    return {
      authorized,
      resolvedTier,
      userId: signedCheck.userId,
      tokenType: 'HMAC_V1',
      reason: authorized ? undefined : `Requires ${requiredTier} role; token resolves to ${resolvedTier}.`,
    };
  }

  if (!sandboxAllowed) {
    return {
      authorized: false,
      resolvedTier: 'GUEST',
      tokenType: 'UNSIGNED_SANDBOX',
      reason: 'Unsigned sandbox persona tokens are disabled in production mode.',
    };
  }

  const verification = EnterpriseBillingEngine.verifySessionToken(token);
  if (!verification.valid) {
    return {
      authorized: false,
      resolvedTier: 'GUEST',
      tokenType: 'UNSIGNED_SANDBOX',
      reason: verification.error || 'Session verification failed.',
    };
  }

  const personaKey = (verification.persona || '').toLowerCase();
  const resolvedTier: ServerRoleTier = PERSONA_ROLE_MAP[personaKey] || 'FREE';
  const authorized = TIER_RANK[resolvedTier] >= TIER_RANK[requiredTier];

  return {
    authorized,
    resolvedTier,
    userId: verification.userId || 'usr_demo_trader',
    tokenType: 'UNSIGNED_SANDBOX',
    reason: authorized ? undefined : `Requires ${requiredTier} role; token resolves to ${resolvedTier}.`,
  };
}

/**
 * In-process fixed-window API rate limiter for abuse protection (§14.2).
 */
export class FixedWindowRateLimiter {
  private buckets = new Map<string, { count: number; resetAtMs: number }>();

  constructor(private readonly maxRequests = 60, private readonly windowMs = 60_000) {}

  public check(key: string, nowMs = Date.now()): { allowed: boolean; remaining: number; retryAfterSeconds: number } {
    const existing = this.buckets.get(key);
    if (!existing || nowMs >= existing.resetAtMs) {
      this.buckets.set(key, { count: 1, resetAtMs: nowMs + this.windowMs });
      return {
        allowed: true,
        remaining: Math.max(0, this.maxRequests - 1),
        retryAfterSeconds: Math.ceil(this.windowMs / 1000),
      };
    }

    if (existing.count >= this.maxRequests) {
      return {
        allowed: false,
        remaining: 0,
        retryAfterSeconds: Math.max(1, Math.ceil((existing.resetAtMs - nowMs) / 1000)),
      };
    }

    existing.count += 1;
    return {
      allowed: true,
      remaining: Math.max(0, this.maxRequests - existing.count),
      retryAfterSeconds: Math.max(1, Math.ceil((existing.resetAtMs - nowMs) / 1000)),
    };
  }
}

/**
 * Redacts tokens, API keys, Telegram bot tokens, and signing secrets before emitting diagnostic logs (§14.1).
 */
export function redactSensitiveLogValue(input: string): string {
  return input
    .replace(/(Bearer\s+)[A-Za-z0-9\-._~+/]+=*/gi, '$1[REDACTED]')
    .replace(/(whsec_|sk_live_|sk_test_|AIzaSy|EAAG|AQ\.)[A-Za-z0-9\-_]{6,}/g, '$1[REDACTED]')
    .replace(/\b(bot)?(\d{6,}:[A-Za-z0-9_-]{16,})\b/g, '$1[TELEGRAM_BOT_REDACTED]')
    .replace(/("?(?:apiKey|pageAccessToken|secret|token|password)"?\s*:\s*")([^"]+)(")/gi, '$1[REDACTED]$3');
}

/**
 * Detects unreplaced `.env.example` placeholder strings so dev/sandbox boots do not treat dummy strings as live infra.
 */
export function isTemplatePlaceholderValue(value?: string): boolean {
  const trimmed = (value || '').trim();
  if (!trimmed) return true;
  if (/^(MY_APP_URL|MY_GEMINI_API_KEY|YOUR_|REPLACE_WITH_)/i.test(trimmed)) return true;
  if (trimmed.includes('your-idp.example.com')) return true;
  if (trimmed === 'https://discord.com/api/webhooks/...') return true;
  if (trimmed === 'whsec_YOUR_STRIPE_WEBHOOK_SIGNING_SECRET') return true;
  return false;
}

/**
 * Extracts validated Market Data & Notification startup updates from `process.env`.
 */
export function buildEnvHydrationConfigs(env: Record<string, string | undefined>): {
  marketDataUpdate: {
    primaryProvider?: string;
    fallbackProvider?: string;
    maxStaleSeconds?: number;
    pollIntervalSeconds?: number;
  };
  notificationUpdate: {
    telegramEnabled?: boolean;
    telegramBotToken?: string;
    telegramChatId?: string;
    webhookEnabled?: boolean;
    webhookUrl?: string;
    webhookType?: 'DISCORD' | 'SLACK' | 'GENERIC';
  };
} {
  const marketDataUpdate: {
    primaryProvider?: string;
    fallbackProvider?: string;
    maxStaleSeconds?: number;
    pollIntervalSeconds?: number;
  } = {};

  if (!isTemplatePlaceholderValue(env.MARKET_DATA_PRIMARY_PROVIDER)) {
    marketDataUpdate.primaryProvider = env.MARKET_DATA_PRIMARY_PROVIDER!.trim();
  }
  if (!isTemplatePlaceholderValue(env.MARKET_DATA_FALLBACK_PROVIDER)) {
    marketDataUpdate.fallbackProvider = env.MARKET_DATA_FALLBACK_PROVIDER!.trim();
  }
  const staleSec = Number(env.MARKET_DATA_MAX_STALE_SECONDS);
  if (Number.isFinite(staleSec) && staleSec >= 5) {
    marketDataUpdate.maxStaleSeconds = staleSec;
  }
  const pollSec = Number(env.MARKET_DATA_POLL_INTERVAL_SECONDS);
  if (Number.isFinite(pollSec) && pollSec >= 5) {
    marketDataUpdate.pollIntervalSeconds = pollSec;
  }

  const notificationUpdate: {
    telegramEnabled?: boolean;
    telegramBotToken?: string;
    telegramChatId?: string;
    webhookEnabled?: boolean;
    webhookUrl?: string;
    webhookType?: 'DISCORD' | 'SLACK' | 'GENERIC';
  } = {};

  if (!isTemplatePlaceholderValue(env.TELEGRAM_BOT_TOKEN) && !isTemplatePlaceholderValue(env.TELEGRAM_CHAT_ID)) {
    notificationUpdate.telegramBotToken = env.TELEGRAM_BOT_TOKEN!.trim();
    notificationUpdate.telegramChatId = env.TELEGRAM_CHAT_ID!.trim();
    notificationUpdate.telegramEnabled = true;
  }

  if (!isTemplatePlaceholderValue(env.WEBHOOK_URL)) {
    const url = env.WEBHOOK_URL!.trim();
    notificationUpdate.webhookUrl = url;
    notificationUpdate.webhookEnabled = true;
    notificationUpdate.webhookType = url.includes('discord.com')
      ? 'DISCORD'
      : url.includes('hooks.slack.com')
      ? 'SLACK'
      : 'GENERIC';
  }

  return { marketDataUpdate, notificationUpdate };
}

/**
 * Express fail-closed RBAC middleware enforcing ServerRoleTier via Authorization Bearer token (§6.2).
 * Supports `aurum_v1.` HMAC tokens, configured OIDC/JWKS RS256/ES256 tokens, and non-prod sandbox tokens.
 */
export function requireServerRole(requiredTier: ServerRoleTier) {
  return async (req: Request, res: Response, next: NextFunction) => {
    const authHeader = req.headers.authorization;
    const token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7).trim() : undefined;
    if (!token) {
      return res.status(401).json({
        success: false,
        error: `Authentication required (${requiredTier} role minimum).`,
      });
    }

    const roleCheck = await evaluateServerRoleFromTokenAsync(token, requiredTier);
    if (!roleCheck.authorized) {
      const statusCode = roleCheck.resolvedTier === 'GUEST' ? 401 : 403;
      return res.status(statusCode).json({
        success: false,
        resolvedTier: roleCheck.resolvedTier,
        requiredTier,
        error: roleCheck.reason || `Insufficient privileges: requires ${requiredTier}.`,
      });
    }

    const authedReq = req as Request & { authRole?: ServerRoleTier; authUserId?: string; authTokenType?: string };
    authedReq.authRole = roleCheck.resolvedTier;
    authedReq.authUserId = roleCheck.userId || 'usr_demo_trader';
    authedReq.authTokenType = roleCheck.tokenType;
    return next();
  };
}

export interface JwksKeyRecord {
  kty: string;
  kid?: string;
  use?: string;
  alg?: string;
  n?: string;
  e?: string;
  crv?: string;
  x?: string;
  y?: string;
}

export interface OidcVerifierConfig {
  jwksUri?: string;
  issuer?: string;
  audience?: string;
  staticKeys?: JwksKeyRecord[];
  nowEpochSeconds?: number;
}

export interface OidcJwtVerificationResult {
  valid: boolean;
  sub?: string;
  resolvedTier: ServerRoleTier;
  expiresAt?: string;
  reason?: string;
}

const jwksCache = new Map<string, { keys: JwksKeyRecord[]; fetchedAtMs: number }>();

export async function fetchJwksKeyByKid(
  jwksUri: string,
  kid?: string,
  ttlMs = 300_000
): Promise<JwksKeyRecord | null> {
  if (!jwksUri) return null;
  const cached = jwksCache.get(jwksUri);
  let keys = cached && Date.now() - cached.fetchedAtMs < ttlMs ? cached.keys : undefined;
  if (!keys) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 3000);
    try {
      const res = await fetch(jwksUri, { signal: controller.signal });
      if (!res.ok) return null;
      const json = (await res.json()) as { keys?: JwksKeyRecord[] };
      keys = Array.isArray(json?.keys) ? json.keys : [];
      jwksCache.set(jwksUri, { keys, fetchedAtMs: Date.now() });
    } catch {
      return null;
    } finally {
      clearTimeout(timer);
    }
  }
  if (kid) {
    return keys.find((k) => k.kid === kid) || null;
  }
  return keys.find((k) => !k.use || k.use === 'sig') || keys[0] || null;
}

function resolveTierFromOidcClaims(claims: Record<string, unknown>): ServerRoleTier {
  const candidates: string[] = [];
  if (typeof claims.aurum_tier === 'string') candidates.push(claims.aurum_tier);
  if (typeof claims.tier === 'string') candidates.push(claims.tier);
  if (typeof claims.role === 'string') candidates.push(claims.role);
  if (Array.isArray(claims.roles)) {
    for (const r of claims.roles) {
      if (typeof r === 'string') candidates.push(r);
    }
  }
  let highest: ServerRoleTier = 'FREE';
  for (const c of candidates) {
    const mapped = PERSONA_ROLE_MAP[c.toLowerCase()];
    if (mapped && TIER_RANK[mapped] > TIER_RANK[highest]) {
      highest = mapped;
    }
  }
  return highest;
}

/**
 * Verifies an RS256/ES256 OIDC JWT against a JWK (`node:crypto`) with issuer, audience, nbf & exp checks (§6.1 / GAP-07 prep).
 */
export function verifyOidcJwtSignature(
  token: string,
  jwk: JwksKeyRecord | crypto.KeyObject,
  config: Omit<OidcVerifierConfig, 'jwksUri' | 'staticKeys'> = {}
): OidcJwtVerificationResult {
  const parts = token.split('.');
  if (parts.length !== 3 || !parts[0] || !parts[1] || !parts[2]) {
    return { valid: false, resolvedTier: 'GUEST', reason: 'Malformed JWT structure.' };
  }

  let header: { alg?: string; kid?: string };
  let claims: Record<string, unknown>;
  try {
    header = JSON.parse(Buffer.from(parts[0], 'base64url').toString('utf8'));
    claims = JSON.parse(Buffer.from(parts[1], 'base64url').toString('utf8'));
  } catch {
    return { valid: false, resolvedTier: 'GUEST', reason: 'Corrupt JWT header or payload encoding.' };
  }

  if (header.alg !== 'RS256' && header.alg !== 'ES256') {
    return { valid: false, resolvedTier: 'GUEST', reason: `Unsupported OIDC JWT alg: ${header.alg || 'none'}` };
  }

  let keyObj: crypto.KeyObject;
  try {
    keyObj =
      'type' in jwk && typeof (jwk as crypto.KeyObject).export === 'function'
        ? (jwk as crypto.KeyObject)
        : crypto.createPublicKey({ key: jwk as any, format: 'jwk' });
  } catch {
    return { valid: false, resolvedTier: 'GUEST', reason: 'Invalid OIDC public JWK key material.' };
  }

  const signingInput = Buffer.from(`${parts[0]}.${parts[1]}`, 'utf8');
  const signature = Buffer.from(parts[2], 'base64url');
  const verifyValid =
    header.alg === 'ES256'
      ? crypto.verify('sha256', signingInput, { key: keyObj, dsaEncoding: 'ieee-p1363' }, signature)
      : crypto.verify('sha256', signingInput, keyObj, signature);

  if (!verifyValid) {
    return { valid: false, resolvedTier: 'GUEST', reason: 'OIDC JWT cryptographic signature invalid.' };
  }

  const now = config.nowEpochSeconds ?? Math.floor(Date.now() / 1000);
  const exp = typeof claims.exp === 'number' ? claims.exp : undefined;
  const nbf = typeof claims.nbf === 'number' ? claims.nbf : undefined;

  if (!exp || now > exp) {
    return { valid: false, resolvedTier: 'GUEST', reason: 'OIDC JWT token expired or missing exp.' };
  }
  if (nbf !== undefined && now < nbf) {
    return { valid: false, resolvedTier: 'GUEST', reason: 'OIDC JWT token not yet valid (nbf).' };
  }
  if (config.issuer && claims.iss !== config.issuer) {
    return { valid: false, resolvedTier: 'GUEST', reason: 'OIDC JWT issuer mismatch.' };
  }
  if (config.audience) {
    const aud = claims.aud;
    const audOk = Array.isArray(aud) ? aud.includes(config.audience) : aud === config.audience;
    if (!audOk) {
      return { valid: false, resolvedTier: 'GUEST', reason: 'OIDC JWT audience mismatch.' };
    }
  }
  if (typeof claims.sub !== 'string' || !claims.sub.trim()) {
    return { valid: false, resolvedTier: 'GUEST', reason: 'OIDC JWT missing subject (sub).' };
  }

  return {
    valid: true,
    sub: claims.sub,
    resolvedTier: resolveTierFromOidcClaims(claims),
    expiresAt: new Date(exp * 1000).toISOString(),
  };
}

/**
 * Async RBAC token evaluator combining `aurum_v1.` HMAC, optional OIDC/JWKS JWTs (`OAUTH_JWKS_URI`),
 * and sandbox persona fallback when allowed.
 */
export async function evaluateServerRoleFromTokenAsync(
  token: string | undefined,
  requiredTier: ServerRoleTier,
  options: { sandboxAllowed?: boolean; oidc?: OidcVerifierConfig } = {}
): Promise<{ authorized: boolean; resolvedTier: ServerRoleTier; userId?: string; tokenType?: string; reason?: string }> {
  if (!token) {
    return { authorized: false, resolvedTier: 'GUEST', reason: 'Missing bearer session token.' };
  }

  if (token.startsWith('aurum_v1.') || token.startsWith('aurum_sess_')) {
    return evaluateServerRoleFromToken(token, requiredTier, options.sandboxAllowed ?? isSandboxPersonasEnabled());
  }

  const oidcCfg: OidcVerifierConfig = options.oidc || {
    jwksUri: process.env.OAUTH_JWKS_URI,
    issuer: process.env.OAUTH_ISSUER,
    audience: process.env.OAUTH_AUDIENCE,
  };

  if (token.split('.').length === 3 && (oidcCfg.jwksUri || (oidcCfg.staticKeys && oidcCfg.staticKeys.length > 0))) {
    let kid: string | undefined;
    try {
      const hdr = JSON.parse(Buffer.from(token.split('.')[0], 'base64url').toString('utf8')) as { kid?: string };
      kid = hdr.kid;
    } catch {
      return { authorized: false, resolvedTier: 'GUEST', tokenType: 'OIDC_JWKS', reason: 'Malformed JWT header.' };
    }

    const key =
      oidcCfg.staticKeys?.find((k) => !kid || k.kid === kid) ||
      (oidcCfg.jwksUri ? await fetchJwksKeyByKid(oidcCfg.jwksUri, kid) : null);

    if (!key) {
      return {
        authorized: false,
        resolvedTier: 'GUEST',
        tokenType: 'OIDC_JWKS',
        reason: 'Unable to locate matching JWKS signing key.',
      };
    }

    const oidcRes = verifyOidcJwtSignature(token, key, {
      issuer: oidcCfg.issuer,
      audience: oidcCfg.audience,
      nowEpochSeconds: oidcCfg.nowEpochSeconds,
    });
    if (!oidcRes.valid) {
      return {
        authorized: false,
        resolvedTier: 'GUEST',
        tokenType: 'OIDC_JWKS',
        reason: oidcRes.reason,
      };
    }

    const authorized = TIER_RANK[oidcRes.resolvedTier] >= TIER_RANK[requiredTier];
    return {
      authorized,
      resolvedTier: oidcRes.resolvedTier,
      userId: oidcRes.sub,
      tokenType: 'OIDC_JWKS',
      reason: authorized ? undefined : `Requires ${requiredTier} role; token resolves to ${oidcRes.resolvedTier}.`,
    };
  }

  return evaluateServerRoleFromToken(token, requiredTier, options.sandboxAllowed ?? isSandboxPersonasEnabled());
}

/**
 * Emits a strict Content-Security-Policy header (`unsafe-inline` allowed only for Vite HMR dev bundle).
 */
export function buildContentSecurityPolicy(
  isProduction = process.env.NODE_ENV === 'production',
  frameAncestorsEnv = process.env.CSP_FRAME_ANCESTORS
): string {
  const scriptSrc = isProduction ? `'self'` : `'self' 'unsafe-inline'`;
  const connectSrc = isProduction ? `'self' https:` : `'self' https: wss: ws:`;
  const frameAncestors =
    frameAncestorsEnv?.trim() ||
    `'self' https://aistudio.google.com https://*.google.com https://*.googleusercontent.com https://*.run.app`;
  return [
    `default-src 'self'`,
    `script-src ${scriptSrc}`,
    `style-src 'self' 'unsafe-inline' https://fonts.googleapis.com`,
    `img-src 'self' data: blob: https:`,
    `font-src 'self' data: https:`,
    `connect-src ${connectSrc}`,
    `object-src 'none'`,
    `base-uri 'self'`,
    `frame-ancestors ${frameAncestors}`,
  ].join('; ');
}

/**
 * Evaluates an HTTP Origin header against a configured comma-separated allowlist (§14.3).
 * When `ALLOWED_ORIGINS` is unset in non-production sandboxes, allows local same-origin/dev traffic.
 */
export function evaluateCorsOrigin(
  originHeader: string | undefined,
  allowedOriginsEnv = process.env.ALLOWED_ORIGINS,
  isProduction = process.env.NODE_ENV === 'production'
): { allowed: boolean; allowOriginHeader?: string; reason?: string } {
  if (!originHeader) {
    return { allowed: true };
  }
  const normalizedOrigin = originHeader.trim().replace(/\/+$/, '');
  const list = (allowedOriginsEnv || '')
    .split(',')
    .map((o) => o.trim().replace(/\/+$/, ''))
    .filter(Boolean);

  if (list.length === 0) {
    if (!isProduction) {
      return { allowed: true, allowOriginHeader: normalizedOrigin };
    }
    return { allowed: false, reason: 'CORS origin blocked: ALLOWED_ORIGINS not configured in production.' };
  }

  if (list.includes(normalizedOrigin)) {
    return { allowed: true, allowOriginHeader: normalizedOrigin };
  }
  return { allowed: false, reason: `CORS origin blocked: ${normalizedOrigin} is not in ALLOWED_ORIGINS.` };
}
