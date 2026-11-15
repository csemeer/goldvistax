# Forecast Accountability Specification
**Document Reference:** `docs/forecast/FORECAST_ACCOUNTABILITY_SPEC.md`  
**Implementation:** `src/services/forecastAccountability.ts`, `src/services/forecastScorecardEngine.ts`, `src/services/crossCommoditySpreads.ts`, `server.ts:567`

## 1. Immutable Snapshot Architecture
- Every `TradePlan` builds a canonical string (`buildCanonicalPlanPayload`) serialization containing ID, instrument, horizon, direction, mid, entry zone, stop, targets 1–3, invalidation condition, and `createdAt`.
- Synchronous pure TypeScript NIST FIPS 180-4 SHA-256 computes `snapshotHash` across Node.js and browser clients.
- `verifyTradePlanIntegrity` rejects any post-publication parameter mutation (`Test 11`).
- **Scope Caveat:** A cryptographic digest certifies byte-level integrity of the recorded snapshot; it does **not** independently verify external market-data accuracy or future predictive skill.

## 2. Historical Seeded Ledger Disclosure
- `AUDITED_FORECAST_HISTORY` in `crossCommoditySpreads.ts` currently holds seeded representative history records in code until backed by a live PostgreSQL append-only table in production.
