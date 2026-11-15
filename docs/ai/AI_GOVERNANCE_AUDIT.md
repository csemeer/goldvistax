# AI Governance Audit
**Document Reference:** `docs/ai/AI_GOVERNANCE_AUDIT.md`  
**Implementation:** `src/services/aiGovernanceEngine.ts`, `src/services/llmPlatform.ts`, `server.ts`

## 1. Control Boundaries (Verified)
- **Deterministic Math Isolation:** All numerical calculations (`advisoryEngine.ts`, `riskEngine.ts`, `indicators.ts`, `forecastAccountability.ts`) execute in pure TypeScript outside LLM calls. LLMs only generate qualitative commentary and search-grounded synthesis (`/api/ai/council`, `/api/ai/chat`, `/api/ai/search-grounding`).
- **Council Quorum & Dissent:** `evaluateCouncilConsensus` requires `activeQuorumCount >= 4` (`quorumThreshold = 4`), computes `disagreementIndexPct`, preserves `dissentingAgentRoles`, and triggers `ADVERSARIAL_VETO` when `INDEPENDENT_CHALLENGE` reports `convictionScorePct >= 85` with a warning against bullish majority. Disagreement `>= 45%` triggers `GRIDLOCK_ABSTAIN`.
- **Prompt Injection Defense:** `sanitizeUntrustedInput` blocks role-switch, instruction-override, XSS, SQLi, policy-bypass, secret-exfiltration, and delimiter-injection payloads on `/api/ai/council` (`Test 14`).
- **Model Identifier Check:** Server calls use `@google/genai` SDK (`gemini-3.8-flash` configured in `server.ts`) with deterministic primary-source fallback (`getDeterministicPrimarySourceGrounding`) when `GEMINI_API_KEY` is absent or quota-limited. Note: Model string should be externalized/validated against active Vertex/Gemini AI Studio model availability during release checks.
