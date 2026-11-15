# GoldVista (Aurum Intelligence) — Gap and Risk Register
**Document Reference:** `GVR-RISK-REGISTER-2026-Q4`  
**Date:** November 9, 2026  
**Owner:** Technical Lead & Senior Quantitative Engineer  
**Status:** Active Governance Document  

---

## 1. Risk Evaluation Severity Scale

- **CRITICAL (P0):** Threatens system integrity, data correctness, security, or legal/financial safety. Must be mitigated before shipping.
- **HIGH (P1):** Significant operational, data freshness, or user trust risk. Requires active architectural mitigation.
- **MEDIUM (P2):** Degraded experience, missing secondary feature, or manageable operational overhead.
- **LOW (P3):** Minor edge case or informational improvement.

---

## 2. Risk & Gap Inventory

### RISK-01: Free Yahoo Finance Feed Rate-Limiting & Host Downtime
- **Category:** Data & Availability
- **Evidence:** `src/services/marketDataProvider.ts:132-153`, `src/services/realHistoricalProvider.ts:180-210`
- **Likelihood:** Medium (3/5)
- **Impact:** High (4/5)
- **Severity:** **HIGH (P1)**
- **Owner Role:** Market Data Lead
- **Mitigation:** Multi-host failover implemented (`query1.finance.yahoo.com` to `query2.finance.yahoo.com`), 3.5s in-memory quote caching, and graceful fallback to verified `simulated_reference` benchmark engine.
- **Residual Risk:** In sustained outages, quotes enter `QUALITY_HOLD` simulated state, clearly indicated to users via the UI health badge.
- **Dependencies:** Public internet connectivity to Yahoo Finance.
- **Status:** Mitigated / Monitored.
- **Closure Evidence:** `tests/multiCommodity.test.ts` (Test 9 verifies failover fallback behavior).

---

### RISK-02: Live Brokerage Order Execution Hazard (Live Trading Prohibition)
- **Category:** Financial & Regulatory Safety
- **Evidence:** Addendum §2.3 ("No autonomous brokerage execution, order routing, live trading, custody, or account connection as part of this roadmap").
- **Likelihood:** Low (1/5)
- **Impact:** Critical (5/5)
- **Severity:** **CRITICAL (P0)**
- **Owner Role:** Compliance & Risk Officer
- **Mitigation:** Live trading and automated order routing are strictly excluded from the codebase. All trade calculations are decision-support advisory only. Paper trading journal (`PortfolioJournalWorkspace.tsx`) is strictly simulated in localStorage.
- **Residual Risk:** Users may misunderstand advisory plans as automated trades. Clear disclaimers ("Research and Advisory Only — No Live Broker Execution") displayed across all screens.
- **Dependencies:** Product copy and legal disclaimer verification.
- **Status:** Closed / Enforced by architecture.
- **Closure Evidence:** Architectural audit confirms zero order-routing SDKs (zero MT4/MT5/cTrader connections in production code).

---

### RISK-03: Stale Price Propagation in Multi-Commodity Advisories
- **Category:** Data Integrity & Mathematical Precision
- **Evidence:** Historical test regression from previous development turn where Gold was pinned to $2,700 rather than current $3,900+ spot.
- **Likelihood:** Low (1/5)
- **Impact:** Critical (5/5)
- **Severity:** **CRITICAL (P0)**
- **Owner Role:** Lead Quantitative Engineer
- **Mitigation:** Strict anchor price regression suite added to CI pipeline. All advisory templates dynamically scale against the live quote midpoint.
- **Residual Risk:** Negligible; regression tests fail build if price drops below $3,500.
- **Dependencies:** `tests/multiCommodity.test.ts`
- **Status:** Closed.
- **Closure Evidence:** `tests/multiCommodity.test.ts` (Test 3 passes: 0 legacy artifacts found).

---

### RISK-04: AI Hallucinations in Financial Risk Advisories
- **Category:** Model Governance & Financial Safety
- **Evidence:** `server.ts:559-614` (`/api/ai/council`), `server.ts:657-697` (`/api/ai/chat`)
- **Likelihood:** Medium (3/5)
- **Impact:** High (4/5)
- **Severity:** **HIGH (P1)**
- **Owner Role:** AI Governance Lead
- **Mitigation:** LLMs have zero authority over numeric calculations. Entry prices, stop losses, profit targets, lot sizes, and margin requirements are computed deterministically in TypeScript (`riskEngine.ts`, `advisoryEngine.ts`). Gemini models are restricted to summarizing, explaining, and offering adversarial counter-theses against verified facts.
- **Residual Risk:** Subjective qualitative sentiment may differ from market movements. Invalidation rules and uncertainty are explicitly displayed.
- **Dependencies:** `@google/genai` SDK and system instructions.
- **Status:** Mitigated by deterministic calculation boundary.
- **Closure Evidence:** `src/services/advisoryEngine.ts:generateTradePlans` runs 100% deterministically without LLM dependency.

---

### RISK-05: Client-Side RBAC Bypass via Direct DOM Manipulation
- **Category:** Security & Authorization
- **Evidence:** `src/components/AccessGateGuard.tsx`, `src/services/authService.ts`
- **Likelihood:** Medium (3/5)
- **Impact:** Medium (3/5)
- **Severity:** **MEDIUM (P2)**
- **Owner Role:** Security Engineer
- **Mitigation:** Sensitive server-side endpoints (e.g. publication gate, LLM settings, test alerts) validate authorization. UI access is guarded by `AccessGateGuard` which unmounts sensitive workspace children when `!accessCheck.allowed`.
- **Residual Risk:** Client-side state can be inspected via browser DevTools in SPA mode. Full production will require session cookie JWT validation.
- **Dependencies:** Production backend session store.
- **Status:** Monitored.
- **Closure Evidence:** `tests/authAndAccess.test.ts` (Test 2 verifies role gating across all 20 workspaces).

---

### RISK-06: 100% Stop-Loss Performance Refund Credit Depletion
- **Category:** Monetization & Commercial Economics
- **Evidence:** `src/services/monetizationEngine.ts:120-165`
- **Likelihood:** Low (2/5)
- **Impact:** Medium (3/5)
- **Severity:** **MEDIUM (P2)**
- **Owner Role:** Commercial & Product Lead
- **Mitigation:** Credits refunded only on invalidation before Target 1. Daily replenishment is capped at 3 credits/day. Users can top up credits via Stripe packs ($9, $29, $69) or link broker accounts for unlimited Pro access.
- **Residual Risk:** A prolonged choppy market regime may produce multiple consecutive stop-loss refunds, temporarily delaying credit consumption.
- **Dependencies:** Quote router tick updates.
- **Status:** Verified.
- **Closure Evidence:** `tests/monetization.test.ts` (Test 3 passes: refund credited upon stop-loss breach).

---

### RISK-07: News & Macro Data Latency / Third-Party Licensing
- **Category:** License & IP Governance
- **Evidence:** `src/services/newsSentimentEngine.ts`, `src/services/macroData.ts`
- **Likelihood:** Medium (3/5)
- **Impact:** Medium (3/5)
- **Severity:** **MEDIUM (P2)**
- **Owner Role:** Legal & Data Licensing Lead
- **Mitigation:** News items and macroeconomic releases are curated structured domain analyses with full attribution to public reporting agencies (BLS, Fed, LBMA, WGC). No copyrighted full-text articles are scraped or persisted.
- **Residual Risk:** Breaking news requires manual curation or approved news API licensing.
- **Dependencies:** Commercial NewsAPI or Bloomberg B-PIPE entitlement for real-time live wire.
- **Status:** Identified / Addressed via curated structured evidence registry.
- **Closure Evidence:** `DATA_SOURCE_AND_LICENSE_REGISTER.md`.

---

## 3. Summary Risk Register Metrics

| Severity | Count | Status |
|---|---|---|
| **CRITICAL (P0)** | 2 | 2 Closed / Architectural Guardrails Enforced |
| **HIGH (P1)** | 2 | 2 Mitigated with Fallbacks & Boundaries |
| **MEDIUM (P2)** | 3 | 3 Monitored / Documented in Roadmap |
| **LOW (P3)** | 0 | N/A |
| **Total Tracked** | **7** | **100% Controlled** |
