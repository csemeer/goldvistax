-- GoldVista / Aurum Intelligence — Paper Trading Journal Persistence Schema (Phase 9 / Wave B)
-- Target Engine: PostgreSQL 15+ (Cloud SQL / Managed Postgres)
-- Note: Strictly simulated paper positions separated from physical bullion holdings (EXEC-01 non-execution).

BEGIN;

CREATE TABLE IF NOT EXISTS paper_journal_positions (
  position_id VARCHAR(128) PRIMARY KEY,
  user_id VARCHAR(128) NOT NULL,
  trade_plan_id VARCHAR(128) NOT NULL,
  instrument_id VARCHAR(32) NOT NULL,
  direction VARCHAR(8) NOT NULL CHECK (direction IN ('BUY', 'SELL')),
  lots NUMERIC(12, 4) NOT NULL CHECK (lots > 0),
  entry_price NUMERIC(16, 4) NOT NULL CHECK (entry_price > 0),
  stop_loss NUMERIC(16, 4) NOT NULL,
  take_profit NUMERIC(16, 4) NOT NULL,
  realized_pnl NUMERIC(16, 2) NOT NULL DEFAULT 0,
  open_time TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  status VARCHAR(24) NOT NULL CHECK (status IN ('OPEN', 'CLOSED_PROFIT', 'CLOSED_LOSS')),
  notes TEXT NOT NULL DEFAULT '',
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_paper_journal_user_open
  ON paper_journal_positions (user_id, status, open_time DESC);

COMMIT;

-- ROLLBACK / DOWN MIGRATION REFERENCE:
-- BEGIN;
-- DROP TABLE IF EXISTS paper_journal_positions;
-- COMMIT;
