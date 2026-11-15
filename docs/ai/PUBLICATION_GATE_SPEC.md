# Deterministic Publication Gate Specification
**Document Reference:** `docs/ai/PUBLICATION_GATE_SPEC.md`  
**Implementation:** `src/services/llmPlatform.ts` (`evaluatePublicationGate`), `src/services/aiGovernanceEngine.ts` (`verifyDossierCitations`), `server.ts:428`

## 1. Gate Checks Enforced (`Test 7`, `Test 14`, `Test 25`, `Test 32`)
1. **Freshness & Data Integrity (`freshnessCompliant`):** Verifies active instrument quote exists and blocks `STALE` or `QUALITY_HOLD` on active weekdays (`marketHoursCompliant`).
2. **Market Hours & Regime Eligibility (`marketHoursCompliant`):** Rejects active publishing during degraded weekday feed holds.
3. **Price Drift Guard (`driftCompliant`):** Enforces <=0.35% drift between dossier entry zone midpoint and live reference spot.
4. **Reward-to-Risk Floor (`rewardToRiskCompliant`):** Enforces positive reward-to-risk ratios (`>= 1.5`) across non-abstained active setups.
5. **5-Year Historical Coverage (`historicalCoverageCompliant`):** Evaluates `coverageReport` completeness (`>= 95%`) before certifying multi-year dossiers.
6. **Grounding & Citation Verification (`groundingCompliant`):** `verifyDossierCitations` extracts bracketed citations (`[EV-...]`, `[COT-...]`, `[WGC-...]`) and blocks publication (`GROUNDING_DEFICIENT` / `NO_CITATIONS_ATTACHED`) if unverified references appear.
7. **Execution Boundary Compliance (`executionBoundaryCompliance`):** `evaluateTextSafetyCompliance` scans `narrativeText` and blocks live execution/broker routing directives (`MT4`, `MT5`, `cTrader`, `FIX`, auto-trade, place market order).
8. **Certainty & Promotional Language Compliance (`certaintyLanguageCompliance`):** `evaluateTextSafetyCompliance` blocks unsubstantiated profit guarantees (`guaranteed profit`, `risk-free returns`, `100% win rate`, `can't lose`).

## 2. Server-Side Enforcement & v1.7 Expansion Backlog
- **Server-Side Gate:** `POST /api/editorial/publish` runs `evaluatePublicationGate` with caller-supplied `narrativeText` and rejects non-compliant payloads with `HTTP 422` (`Gate Failure`).
- **v1.7 Backlog:** Add multi-locale non-English semantic compliance classifiers and scheduled nightly automated batch evaluations.
