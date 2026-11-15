# Futures Lifecycle & Roll Policy
**Document Reference:** `docs/data/FUTURES_LIFECYCLE_AND_ROLL_POLICY.md`  
**Source of Truth:** `src/services/futuresOptionsEngine.ts`, `src/services/realHistoricalProvider.ts`

## 1. Active Contract Selection & Expiry Guard (GAP-01 Remediation)
- `calculateFuturesTermStructure` filters candidate COMEX delivery contracts dynamically using `daysToExpiry > 0` relative to `new Date()`.
- Active forward strip for late-2026 baseline: `GCZ26` (Dec 2026), `GCG27` (Feb 2027), `GCJ27` (Apr 2027), `GCM27` (Jun 2027), `GCQ27` (Aug 2027).
- Expired contracts (`daysToExpiry <= 0`, e.g., `GCJ26`, `GCM26`, `GCQ26`) are excluded from current curve stripping.

## 2. Provenance & Limitations
- Current strip prices are generated via the SOFR + vault carry model (`provenanceModel: 'MODEL_CARRY_SOFR_STRIP'`, `isLiveExchangeSettlement: false`) anchored to live/fallback spot.
- Exchange-provided open interest/volume figures in `futuresOptionsEngine.ts` are illustrative structural liquidity weights, not live CME Globex L1 settlement ticks.
- **v1.7 Target:** Replace model carry curve and Yahoo `GC=F` continuous alias with licensed CME Market Data API contract master, explicit First Notice Day alerts, and documented Panama-canal or ratio back-adjustment for historical backtests.
