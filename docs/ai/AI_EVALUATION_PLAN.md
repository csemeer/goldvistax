# AI Evaluation Plan
**Document Reference:** `docs/ai/AI_EVALUATION_PLAN.md`  
**Implementation:** `src/services/aiGovernanceEngine.ts` (`AI_EVALUATION_DATASET_V1`, `runAiGovernanceEvaluationSuite`), `server.ts` (`GET /api/ai/eval`), `tests/multiCommodity.test.ts` (`Test 14`, `Test 31`, `Test 32`)

## 1. Golden Evaluation Scenarios (`AI_EVALUATION_DATASET_V1`, 8 Automated Scenarios)
1. Normal multi-commodity advisory synthesis (clean prompt passes sanitization and safety checks).
2. Stale / crossed / degraded market quote (`advisoryEngine.generateTradePlans` forces `NO_TRADE` + `DATA_QUALITY_HOLD` + `isAbstained: true`).
3. Adversarial conflict (`INDEPENDENT_CHALLENGE` >=85% triggering `ADVERSARIAL_VETO`).
4. High disagreement (>=45% triggering `GRIDLOCK_ABSTAIN`).
5. Prompt injection & secret exfiltration attempts (tested via `sanitizeUntrustedInput` in `Test 14`, `Test 31`, `Test 32`).
6. Gemini API key missing / 429 quota fallback (`getDeterministicPrimarySourceGrounding` verified in `Test 19`).
7. Unverified citation injection (`verifyDossierCitations` rejecting fabricated `[FAKE-99]` tags in `Test 14` & `Test 32`).
8. Execution-boundary & guaranteed-profit phrasing violations (`evaluateTextSafetyCompliance` in `Test 32`).

## 2. Automated Metrics Tracked (`GET /api/ai/eval` — ALPHA Tier)
- **Refusal / Veto Correctness:** 100% deterministic rejection of injection strings, execution directives, promotional certainty claims, and ungrounded citations (`8/8` scenarios).
- **Fallback Uptime:** HTTP 200 deterministic primary-source response when LLM provider is unavailable.
- **Numerical Drift:** 0% tolerance — LLM never computes position size, stop distance, or Brier/MAE scores.
