# Production Security Review
**Document Reference:** `docs/security/PRODUCTION_SECURITY_REVIEW.md`  
**Updated Date:** November 15, 2026  
**Status:** **NOT APPROVED FOR PUBLIC PRODUCTION** (Active codebase controls implemented & tested; infra/IdP/live-secret gates open)

| Security Control | Active Implementation State | Production Gate Requirement | Status |
|---|---|---|---|
| **Secret Isolation & Log Redaction** | `GEMINI_API_KEY`, `STRIPE_WEBHOOK_SECRET`, `EIA_API_KEY` server-only; `redactSensitiveLogValue()` + structured JSON logger active (`server.ts`, `serverSecurity.ts`) | Secret Manager injection, automated key rotation & OpenTelemetry sink | Compliant in dev/sandbox |
| **Uniform Prompt & Publication Defense** | `sanitizeUntrustedInput()` across `/api/ai/*` (`HTTP 400`), 8-check `evaluatePublicationGate` blocking execution/certainty phrases (`HTTP 422`), plus `GET /api/ai/eval` 8-scenario golden harness (`Test 32`) | Continuous adversarial prompt eval regression set | **VERIFIED (`Test 14`, `31`, `32`)** |
| **Webhook Signature Verification** | Raw-body `verifyStripeWebhookSignature()` HMAC-SHA256 + 300s replay guard + atomic idempotency store (`Test 9`) | Configure live `STRIPE_WEBHOOK_SECRET` & managed Postgres store (`migrations/001`) | **HARDENED (Live Secret Pending)** |
| **Server-Side RBAC & Signed Sessions** | HMAC-SHA256 `aurum_v1.` session signing + `ALLOW_SANDBOX_PERSONAS` prod lockout + asymmetric OIDC/JWKS (`RS256`/`ES256`) contract (`OAUTH_JWKS_URI`) + `requireServerRole` (`401/403`) + `FREE` tenant isolation (`Test 11–13, 16, 31`) | Connect external OAuth 2.0 PKCE IdP (`OAUTH_JWKS_URI` / `GAP-07`) in prod runtime | **HARDENED (IdP PKCE Pending)** |
| **Security Headers, CORS & Rate Limiting** | `X-Request-Id`, `Content-Security-Policy` (`buildContentSecurityPolicy`), `Strict-Transport-Security` (prod), `nosniff`, `SAMEORIGIN`, `Referrer-Policy`, `Permissions-Policy`, `evaluateCorsOrigin` & `FixedWindowRateLimiter` (`Test 10, 15, 16`) | Strict prod `ALLOWED_ORIGINS` config & edge TLS termination | **HARDENED (Edge Config Pending)** |
| **Dependency Vulnerability Audit** | `package-lock.json` generated (`--legacy-peer-deps` due to `vite@8.3.5` peerOptional `esbuild@^0.27` vs dev `esbuild@^0.25.0`); `npm audit --omit=dev --json` & full `npm audit --json` returned `0` vulnerabilities (187 deps audited) | Align `esbuild` devDependency version & enforce CI zero-critical/high CVE gate | **VERIFIED (`0 vulnerabilities`, dev peer align backlog)** |

