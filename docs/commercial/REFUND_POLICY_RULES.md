# Stop-Loss Signal Credit Refund Policy Rules
**Document Reference:** `docs/commercial/REFUND_POLICY_RULES.md`  
**Implementation:** `src/services/monetizationEngine.ts`, `src/services/forecastAccountability.ts`

## 1. Nature of Refund
- **Non-Cash Credit Return Only:** Stop-loss protection returns **1 Signal Credit** to the user's in-app credit balance (`SL_CREDIT_REFUND`). It is **not** a cash, fiat, or trading-loss reimbursement guarantee.
- Updated UI disclosures (`TradePlanCard.tsx`, `MonetizationWorkspace.tsx`) explicitly label `"Signal Credit Refund (Non-Cash)"`.

## 2. Deterministic Trigger Conditions
- Plan must have been unlocked with 1 Signal Credit prior to outcome trigger (`status === 'ACTIVE'`, `refunded === false`).
- Stop loss is breached prior to hitting Target 1 (`hitStop`).
- **Same-Candle Collision & Gap-Through-Stop:** Resolved via `evaluateCandleOutcome` using the conservative **Stop-First rule** (stop-loss triggers refund protection).
- **Pre-Execution Snapshot Governs:** Original immutable entry, stop, target, and `snapshotHash` cannot be modified after unlock.

## 3. Legal Gate
- Formal legal/consumer-protection review is required before publicly advertising any "guarantee" phrasing across target jurisdictions (`L1`).
