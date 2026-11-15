# Security & Monetization Audit
**Document Reference:** `docs/security/SECURITY_AND_MONETIZATION_AUDIT.md`  
**Modules Audited:** `src/services/authService.ts`, `src/services/billingWebhookEngine.ts`, `src/services/monetizationEngine.ts`, `server.ts`

## 1. Authentication & RBAC
- 4 tiers (`GUEST`, `FREE`, `PRO`, `ALPHA`) implemented in `authService.ts` and enforced in `AccessGateGuard.tsx`.
- Enterprise token validation (`EnterpriseBillingEngine.verifySessionToken`) parses `aurum_sess_<persona>_<exp>` and rejects expired or missing tokens (`HTTP 401` on `/api/auth/verify-session`).
- **Residual Gap:** Client persona switching and social logins in `AuthModal.tsx` are browser sandbox simulations (`SIMULATED`); production release requires IdP OAuth PKCE + HTTP-only cookies + server-side RBAC middleware on all `/api/*` routes.

## 2. Durable Webhook Idempotency (GAP-02 Remediation)
- `EnterpriseBillingEngine` accepts an injected `WebhookPersistenceAdapter`.
- `server.ts` wires an atomic write-rename JSON persistence adapter (`AURUM_BILLING_STORE_PATH`, default `/tmp/aurum-billing-store.json`) persisting both `ProcessedWebhookRecord[]` and `UserEntitlementState[]` across restarts.
- **Residual Gap:** Raw Stripe cryptographic webhook signature verification (`Stripe-Signature` HMAC verification with `STRIPE_WEBHOOK_SECRET`) is **NOT VERIFIED** in sandbox without live Stripe credentials; required before production billing enablement.
