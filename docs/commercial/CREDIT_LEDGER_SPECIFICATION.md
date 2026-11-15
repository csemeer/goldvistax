# Credit Ledger Specification
**Document Reference:** `docs/commercial/CREDIT_LEDGER_SPECIFICATION.md`  
**Implementation:** `src/services/monetizationEngine.ts` (`CreditLedgerEntry`, `appendLedgerEntry`)

## 1. Schema
Each balance mutation appends an immutable `CreditLedgerEntry`:
- `id`: unique entry identifier (`led_<timestamp>_<seq>`).
- `idempotencyKey`: deduplication guard preventing double debits (`unlock_debit_<planId>`) or double refunds (`sl_refund_<planId>`).
- `transactionType`: `'INITIAL_GRANT' | 'DAILY_REGEN' | 'UNLOCK_DEBIT' | 'SL_CREDIT_REFUND' | 'PACK_PURCHASE' | 'TIER_GRANT' | 'BROKER_BONUS'`.
- `beforeBalance`, `deltaCredits`, `afterBalance` satisfying `Math.max(0, beforeBalance + deltaCredits) === afterBalance`.

## 2. Invariants Verified (`tests/monetization.test.ts` Test 8)
- Duplicate `unlockPlanWithGuarantee` on the same `planId` does not subtract extra credits or append a duplicate debit row.
- Duplicate `evaluatePerformanceRefunds` on the same stopped plan does not credit twice.
- Negative balance attempts (`creditsBalance < 1`) are blocked cleanly without modifying balance.
- **Production Upgrade Path:** Migrate client `localStorage` ledger to PostgreSQL ACID transactions with `UNIQUE(account_id, idempotency_key)`.
