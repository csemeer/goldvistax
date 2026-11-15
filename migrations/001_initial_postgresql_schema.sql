-- GoldVista / Aurum Intelligence — Initial Transactional PostgreSQL Schema (GAP-02 Readiness)
-- Target Engine: PostgreSQL 15+ (Cloud SQL / Managed Postgres)
-- Note: Reversible DDL baseline for migrating atomic JSON / in-memory sandbox state to durable ACID storage.

BEGIN;

-- 1. Durable Stripe Webhook Idempotency Registry
CREATE TABLE IF NOT EXISTS processed_webhook_events (
  event_id VARCHAR(128) PRIMARY KEY,
  event_type VARCHAR(96) NOT NULL,
  user_id VARCHAR(128),
  tier_granted VARCHAR(32),
  credits_granted INTEGER DEFAULT 0,
  status VARCHAR(32) NOT NULL CHECK (status IN ('PROCESSED', 'DUPLICATE_IGNORED')),
  payload_sha256 CHAR(64) NOT NULL,
  received_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_webhook_events_user_id ON processed_webhook_events (user_id);

-- 2. User Commercial Entitlements
CREATE TABLE IF NOT EXISTS user_entitlements (
  user_id VARCHAR(128) PRIMARY KEY,
  tier VARCHAR(32) NOT NULL DEFAULT 'FREE' CHECK (tier IN ('GUEST', 'FREE', 'PRO', 'ALPHA', 'INSTITUTIONAL')),
  credits_balance INTEGER NOT NULL DEFAULT 5 CHECK (credits_balance >= 0),
  active_subscription_id VARCHAR(128),
  subscription_status VARCHAR(32) CHECK (subscription_status IN ('active', 'past_due', 'canceled')),
  linked_broker_id VARCHAR(64),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 3. Append-Only Auditable Credit Ledger (Non-Cash Signal Credits)
CREATE TABLE IF NOT EXISTS credit_ledger_entries (
  id UUID PRIMARY KEY,
  idempotency_key VARCHAR(160) NOT NULL UNIQUE,
  user_id VARCHAR(128) NOT NULL REFERENCES user_entitlements(user_id) ON DELETE RESTRICT,
  transaction_type VARCHAR(32) NOT NULL CHECK (
    transaction_type IN (
      'INITIAL_GRANT',
      'DAILY_REGEN',
      'UNLOCK_DEBIT',
      'SL_CREDIT_REFUND',
      'PACK_PURCHASE',
      'TIER_GRANT',
      'BROKER_BONUS'
    )
  ),
  delta_credits INTEGER NOT NULL,
  before_balance INTEGER NOT NULL CHECK (before_balance >= 0),
  after_balance INTEGER NOT NULL CHECK (after_balance >= 0),
  related_plan_id VARCHAR(128),
  note TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT chk_ledger_balance_math CHECK (before_balance + delta_credits = after_balance)
);

CREATE INDEX IF NOT EXISTS idx_credit_ledger_user_created ON credit_ledger_entries (user_id, created_at DESC);

-- 4. Immutable Forecast Accountability Snapshots (Phase 5 / §8.1-8.2)
CREATE TABLE IF NOT EXISTS immutable_forecast_snapshots (
  forecast_id VARCHAR(128) PRIMARY KEY,
  instrument_id VARCHAR(32) NOT NULL,
  horizon VARCHAR(24) NOT NULL CHECK (horizon IN ('INTRADAY', 'SWING', 'LONG_TERM')),
  direction VARCHAR(32) NOT NULL CHECK (direction IN ('BUY', 'SELL', 'HOLD', 'NO_TRADE', 'INSUFFICIENT_EVIDENCE')),
  reference_mid NUMERIC(16, 4) NOT NULL,
  entry_min NUMERIC(16, 4),
  entry_max NUMERIC(16, 4),
  stop_loss NUMERIC(16, 4),
  target_1 NUMERIC(16, 4),
  target_2 NUMERIC(16, 4),
  target_3 NUMERIC(16, 4),
  market_regime VARCHAR(64) NOT NULL,
  data_quality VARCHAR(32) NOT NULL,
  snapshot_hash CHAR(64) NOT NULL,
  lifecycle_state VARCHAR(32) NOT NULL CHECK (
    lifecycle_state IN (
      'DRAFT', 'VALIDATED', 'PUBLISHED', 'ACTIVE',
      'TARGET_REACHED', 'STOP_REACHED', 'INVALIDATED',
      'EXPIRED', 'WITHDRAWN', 'UNRESOLVED', 'SUPERSEDED'
    )
  ),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  resolved_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_forecasts_instrument_horizon ON immutable_forecast_snapshots (instrument_id, horizon, created_at DESC);

-- 5. Editorial & AI-04 Publication Gate Log
CREATE TABLE IF NOT EXISTS editorial_publications (
  publication_id VARCHAR(128) PRIMARY KEY,
  report_type VARCHAR(64) NOT NULL,
  title TEXT NOT NULL,
  channel VARCHAR(64) NOT NULL,
  publication_status VARCHAR(32) NOT NULL CHECK (publication_status IN ('PUBLISHED', 'SIMULATED', 'FAILED', 'BLOCKED')),
  meta_post_id VARCHAR(128),
  gate_passed BOOLEAN NOT NULL,
  snapshot_sha256 CHAR(64) NOT NULL,
  published_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMIT;

-- ROLLBACK / DOWN MIGRATION REFERENCE:
-- BEGIN;
-- DROP TABLE IF EXISTS editorial_publications;
-- DROP TABLE IF EXISTS immutable_forecast_snapshots;
-- DROP TABLE IF EXISTS credit_ledger_entries;
-- DROP TABLE IF EXISTS user_entitlements;
-- DROP TABLE IF EXISTS processed_webhook_events;
-- COMMIT;
