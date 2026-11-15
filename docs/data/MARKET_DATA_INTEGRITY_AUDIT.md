# Market Data Integrity Audit
**Document Reference:** `docs/data/MARKET_DATA_INTEGRITY_AUDIT.md`  
**Source of Truth:** `src/services/marketDataProvider.ts`, `src/services/marketData.ts`, `src/services/historicalDataEngine.ts`, `src/services/realHistoricalProvider.ts`

## 1. Provider Pipeline & Failover
- **Primary Quote Adapter:** Yahoo Finance JSON query API (`query1.finance.yahoo.com`) mapped per canonical instrument.
- **Fallback Chain:** Last-known valid quote buffer -> Calibrated simulated reference generator (`marketDataProvider.ts`).
- **Placeholder Adapters:** `ibkr_gateway` and `alpaca_data` are diagnostic placeholders (`server.ts:141-155`) with no live broker credentials or execution sockets.

## 2. Freshness States & Gate Enforcement
- Defined `DataQualityState` values in `src/domain/types.ts`: `'FRESH' | 'DEGRADED' | 'STALE' | 'QUALITY_HOLD'`.
- Advisory generation (`advisoryEngine.ts`) checks `quote.quality`; `STALE` or `QUALITY_HOLD` enforces `isAbstained = true` (`state: 'DATA_QUALITY_HOLD'`).
- **Verified Regression:** Gold spot reference stays anchored in the ~$3,900+/oz regime with zero legacy ~$2,700 stale baseline contamination (`Test 3`).

## 3. Identified Limitations & Residual Gaps
- `US_TIPS10Y` currently falls back to a synthetic spread derivation from `^TNX` (`GAP-04`).
- Yahoo Finance is an unauthenticated public endpoint subject to rate limiting and non-commercial terms (`GAP-06`).
- Historical fallback fills gaps algorithmically (`historicalDataEngine.ts`) when upstream Yahoo chart calls fail; labeled cleanly in `coverageReport`.
