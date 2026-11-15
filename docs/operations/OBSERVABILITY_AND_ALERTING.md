# Observability & Alerting Specification
**Document Reference:** `docs/operations/OBSERVABILITY_AND_ALERTING.md`  
**Updated Date:** November 15, 2026  
**Endpoints & Services:** `server.ts` (`/health`, `/health/live`, `/health/ready`, `/api/metrics`, `/api/metrics/prometheus`, `/api/market-data/status`), `serverSecurity.ts`, `src/services/notificationService.ts`

- **Liveness / Readiness / Telemetry:** `GET /health/live` (200 OK), `GET /health/ready` (200/503 JSON readiness + migration/secret status), `GET /health` (provider health + notification counters), `GET /api/metrics` (JSON request counts `2xx/4xx/5xx`, `rateLimitedCount`, `authDeniedCount`, `gateBlockedCount`, `aiEvalLastRun`, webhook HMAC/duplicate counters, provider latencies, `FundamentalsScheduler` status), and `GET /api/metrics/prometheus` (`text/plain; version=0.0.4; charset=utf-8` OpenMetrics exposition).
- **Secret-Redacted Structured Logging:** HTTP responses attach `X-Request-Id` correlation headers; `logStructuredEvent` passes JSON telemetry through `redactSensitiveLogValue()` to strip Bearer tokens, `whsec_*`, Google API keys, and credential JSON fields.
- **Multi-Channel Dispatcher (`NOTIF-01`):** Supports Telegram Bot API, Discord Rich Embeds, Slack Block Kit, and FIPS 180-4 signed JSON webhooks (`sha256=<64-hex>`) with metadata PII stripping (`sanitizeNotificationMetadata`), `getConfig()` secret masking for both `telegramBotToken` and `webhookUrl` with masked-save preservation, and critical transition dedupe bypass (`isCriticalStateChange: true`, `bypassedDedupe: true`).
- **Production Telemetry Target (v1.7):** Scrape `/api/metrics/prometheus` and forward `logStructuredEvent` JSON logs into Cloud Monitoring / OpenTelemetry collector.

