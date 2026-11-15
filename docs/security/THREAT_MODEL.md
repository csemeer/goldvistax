# Threat Model
**Document Reference:** `docs/security/THREAT_MODEL.md`

| Threat ID | Vector | Asset Impacted | Existing Control | Residual Risk / Next Action |
|---|---|---|---|---|
| **STRIDE-T1** | Webhook replay / duplicate billing credits | Credit balance & tiers | Event ID deduplication persisted via atomic file store (`server.ts`) | Requires Stripe HMAC header signature check + PostgreSQL unique constraint in prod |
| **STRIDE-T2** | Client-side RBAC bypass / state tampering | Gated analytics | `AccessGateGuard.tsx` + `/api/auth/verify-session` expiry check | Add session middleware to all non-public `/api/*` routes |
| **STRIDE-T3** | Prompt injection / system exfiltration | Gemini AI Council / Chat | `sanitizeUntrustedInput()` blocks override/XSS/SQLi/secret patterns (`server.ts:597`) | Add output schema validation & rate limiting per user |
| **STRIDE-T4** | Retrospective forecast tampering | Track record integrity | Pure TS FIPS 180-4 SHA-256 snapshot hash (`forecastAccountability.ts`) | Store snapshots in append-only PostgreSQL table |
| **STRIDE-T5** | Unauthorized live brokerage execution | Capital / regulatory exposure | Strictly zero execution SDKs, FIX sockets, or broker order endpoints | Enforce CI static check blocking execution imports |
