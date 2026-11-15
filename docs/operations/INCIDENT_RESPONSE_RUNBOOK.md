# Incident Response Runbook
**Document Reference:** `docs/operations/INCIDENT_RESPONSE_RUNBOOK.md`  
**Updated Date:** November 15, 2026

1. **Market Data Feed Outage / Yahoo Rate Limit / Integrity Violations:**
   - Symptom: `/api/market/quotes` `integritySummary` shows elevated `DEGRADED`/`STALE` or `delayedOver120sCount`, or `marketDataProvider` fails over to simulated reference (cache retains original timestamp and forces `DEGRADED` quality).
   - Response: Advisory publication (`evaluatePublicationGate`) and decision scanner (`NO_TRADE`) automatically abstain/block (`HTTP 422` on `/api/editorial/publish`). Verify upstream connectivity via `POST /api/market-data/test-connection` and inspect `GET /api/market-data/status`; never manually override `STALE` or `DEGRADED` flags.
2. **Gemini API / Search Grounding / CFTC / EIA Fallback Triggers:**
   - Symptom: `/api/ai/search-grounding` returns `mode: 'DETERMINISTIC_PRIMARY_SOURCE'`, or `/api/fundamentals/:commodity` reports `CFTC_CURATED_FALLBACK` / `EIA_CURATED_FALLBACK` (`liveSyncStatus`).
   - Response: Expected zero-downtime fallback behavior. Verify `GEMINI_API_KEY` or `EIA_API_KEY` secret validity/quota in server logs via secret-redacted `logStructuredEvent` output without printing raw secret values.
3. **Prompt Injection, Rate Limiting (`HTTP 429`), or Unauthorized Probe (`401/403`):**
   - Symptom: Elevation in `/api/metrics` `rateLimitedCount` or `statusCounts['4xx']`, or `logStructuredEvent` warnings (`PROMPT_INJECTION_BLOCKED`).
   - Response: `sanitizeUntrustedInput()` blocks injection payloads (`HTTP 400`) on `/api/ai/council`, `/api/ai/chat`, and `/api/ai/search-grounding`; `FixedWindowRateLimiter` throttles abusive clients (`Retry-After`); `requireServerRole` rejects missing/invalid bearer tokens (`401/403`). Correlate incident traces by `X-Request-Id`.
4. **Billing Webhook Replay, Forecast Lifecycle Conflict (`HTTP 409`), or Store Corruption:**
   - Response: Inspect `/api/billing/ledger` (`PRO`), `/api/billing/webhook/history` (`PRO`), and atomic JSON stores (`AURUM_BILLING_STORE_PATH`, default `/tmp/aurum-billing-store.json`; `AURUM_FORECAST_STORE_PATH`, default `/tmp/aurum-forecast-store.json`). Both write via `.tmp` write + atomic `renameSync` to prevent torn writes; `/api/forecast/lifecycle` rejects duplicate overwrites with `HTTP 409`.
5. **Emergency Advisory Halt & Critical Escalation:**
   - Trigger `QUALITY_HOLD` propagation or pause notification routes via `POST /api/notifications/config` (`PRO` bearer required). Critical state-change alerts (`isCriticalStateChange: true`) bypass dedupe cooldowns and include `sha256=` HMAC seals on generic webhooks.
