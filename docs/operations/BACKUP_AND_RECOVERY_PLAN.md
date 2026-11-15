# Backup & Recovery Plan
**Document Reference:** `docs/operations/BACKUP_AND_RECOVERY_PLAN.md`  
**Updated Date:** November 15, 2026

- **Current Sandbox Persistence State:**
  - **Billing, Idempotency & Credit Ledger Store:** Persisted via atomic `.tmp` write + POSIX rename (`AURUM_BILLING_STORE_PATH`, default `/tmp/aurum-billing-store.json`) storing `processedWebhookIds`, `entitlements`, `webhookHistory`, and double-entry `creditLedgerEntries`.
  - **Immutable Forecast Lifecycle Store:** Persisted via atomic `.tmp` write + POSIX rename (`AURUM_FORECAST_STORE_PATH`, default `/tmp/aurum-forecast-store.json`) storing append-only SHA-256 sealed forecast snapshots (`DRAFT`, `VALIDATED`, `PUBLISHED`, `RESOLVED`, `SUPERSEDED`).
  - **Browser State:** Client paper trading journal (`localStorage`), notification UI preferences, and sandbox session metadata (isolated from server authoritative billing/forecast stores).
- **Target Production Architecture (v1.7 — Blocking for Public Release):**
  - Managed PostgreSQL database applying `/migrations/001_initial_postgresql_schema.sql` (`trade_plan_snapshots`, `forecast_outcomes`, `credit_ledger_entries`, `processed_webhooks`, `entitlements`).
  - Automated daily KMS-encrypted Point-in-Time Recovery (PITR) snapshots (`RPO <= 5 minutes`, `RTO <= 30 minutes`) + pre-launch and quarterly restore drill verification in isolated staging.
