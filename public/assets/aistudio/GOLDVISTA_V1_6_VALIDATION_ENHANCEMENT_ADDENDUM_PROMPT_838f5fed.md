# GOLDVISTA v1.6.0 — COMPREHENSIVE VALIDATION, ENHANCEMENT & NEXT-PHASE ADDENDUM PROMPT

**Project:** GoldVista (Aurum Intelligence)  
**Declared baseline:** `v1.6.0-ENTERPRISE-ROBUST`  
**Baseline report:** Comprehensive Platform Completion Report, 12 November 2026  
**Programme:** Independent validation, corrective engineering, strategic enhancements and controlled v1.7+ evolution  
**Primary principle:** Prove what exists, validate what matters, then improve in controlled increments.

---

## 0. MASTER INSTRUCTION — READ FIRST

Act as GoldVista's principal software architect, senior full-stack engineer, quantitative researcher, market-data engineer, application-security specialist, QA lead and technical programme manager.

Your assignment is to independently inspect the actual repository and establish the real state of the v1.6.0 implementation. Then prepare and execute a carefully prioritised next-generation programme.

The completion report is the **declared baseline**, not proof that every described capability is correctly implemented, production-connected, mathematically sound, secure, licensed or operationally ready. Inspect source code, configuration, tests, runtime behaviour, persistence, deployment artefacts and external integrations.

### 0.1 Required outcome

GoldVista must become demonstrably:

1. Correct in instrument definitions, market data, calculations and time handling.
2. Honest about data provenance, freshness, limitations and uncertainty.
3. Quantitatively defensible, with leakage-resistant research and realistic trading-cost assumptions.
4. Accountable for every published forecast and its eventual outcome.
5. Explainable, with deterministic calculations separated from AI interpretation.
6. Resilient, secure, observable and maintainable.
7. Useful across Gold, Silver, WTI and Brent for intraday, swing and longer-term research.
8. Commercially transparent and legally reviewed before public monetisation claims.
9. Strictly non-executing: research, advisory and paper simulation only.

### 0.2 Non-negotiable constraints

- **No autonomous live execution.** Do not add broker order routing, FIX, MT4/MT5, cTrader, exchange execution or automated live order placement. Do not create hidden execution paths.
- Preserve the non-execution mandate. Paper trading must remain clearly simulated and technically isolated from brokerage execution.
- Never fabricate prices, candles, releases, COT data, warehouse inventories, options data, provider status, test results or performance metrics.
- Never label hard-coded, cached, generated, proxy, delayed or simulated values as live or verified.
- A source file, filename, UI label, mock, stub, fixture, test name or successful dev-server response is not sufficient proof of production capability.
- Never claim profitability, statistical robustness, institutional certification, regulatory approval or production readiness without appropriate evidence and review.
- LLMs must not perform or override deterministic financial calculations, risk limits, instrument validation, access control, entitlement decisions, audit integrity or publication gates.
- Do not weaken controls or tests merely to make a build pass.
- Do not introduce paid APIs, new dependencies, data subscriptions or infrastructure without documenting rationale, alternatives, costs, licensing and approval requirements.
- Do not expose secrets, tokens, personal data or proprietary configuration in logs, tests or client bundles.
- Do not run destructive migrations, delete data, overwrite user configuration or deploy to production without explicit authorisation.
- Preserve the existing stack unless repository evidence establishes a compelling reason to change it.
- If a requirement cannot be verified, label it **NOT VERIFIED** and state exactly what evidence is missing.
- Insufficient evidence must be allowed to produce **NO TRADE / INSUFFICIENT EVIDENCE**.

### 0.3 Evidence hierarchy

Use this order:

1. Actual source code and configuration.
2. Reproducible automated tests and meaningful assertions.
3. Runtime API responses and browser behaviour.
4. Database schemas, migrations, logs and deployment configuration.
5. Existing governance documents and decision records.
6. Completion report claims.
7. General engineering assumptions, explicitly labelled.

If sources conflict, record the discrepancy and resolve it through evidence and a decision record. Do not silently reconcile contradictions.

---

## 1. DECLARED BASELINE AND DISCREPANCIES TO RECONCILE

The v1.6.0 report describes GoldVista as a multi-commodity intelligence, quantitative advisory and risk-engineering platform.

### 1.1 Declared instruments

- Gold: XAU/USD and COMEX Gold futures.
- Silver: XAG/USD and COMEX Silver futures where supported.
- WTI: distinguish spot/reference data from NYMEX futures.
- Brent: distinguish spot/reference data from ICE futures.
- Macro anchors: DXY, US 10-Year Treasury yield and 10-Year TIPS/real-yield-related series.

Verify exact series semantics. Do not assume a TIPS breakeven series is equivalent to a real-yield series.

Every instrument must have explicit identity, asset type, venue/provider, currency, units, calendar, timezone, session, tick size, contract multiplier, expiry/roll rules and permitted use.

### 1.2 Capabilities claimed

Verify, rather than assume, the implementation of:

- Canonical instrument registry and cross-commodity spreads.
- Five-year historical candles and resampling.
- Anchor-price integrity and stale-price regression guards.
- Multi-provider routing and health telemetry.
- Technical indicators.
- Multi-horizon advisory plans and invalidation rules.
- Ten quantitative strategies and parameter optimisation.
- Walk-forward backtesting and Monte Carlo.
- Macro calendar and historical event studies.
- News evidence and sentiment.
- Historical analogues and scenario simulation.
- Four-agent AI council and adversarial dissent.
- Gemini research chat and search grounding.
- Deterministic publication gates.
- CFD sizing and prop-firm drawdown guard.
- Authentication, onboarding, RBAC and persona switching.
- Credit/subscription/broker-rebate monetisation.
- Stop-loss credit refund logic.
- Landing page and institutional terminal.
- Multi-channel notifications and signed webhooks.
- Paper journal, scanner, margin heatmap and DCA tracker.
- CFTC COT and central-bank bullion intelligence.
- Futures term structure and options analytics.
- Explicit exclusion of live autonomous broker execution.

### 1.3 Mandatory discrepancies

Investigate at least:

1. The report states “26 audited capabilities”, while the displayed matrix appears to contain a different number of rows. Count unique IDs from the report and repository.
2. Reconcile the claim of 25/26 eligible capabilities with the actual inventory and prohibited execution item.
3. The report says 32 tests, while visible labels are grouped as 20 multi-commodity, 5 auth and 7 monetisation tests. Establish exactly what is counted as a test, assertion, suite and integration check.
4. Four AI agents and quorum ≥4: confirm actual quorum, outage behaviour, veto rules and whether any reduced quorum exists.
5. The listed COMEX strip includes GCJ26, GCM26 and GCQ26 although the report date is 12 November 2026. Verify expiry and ensure expired contracts cannot enter current calculations.
6. The report describes GVZ and a five-tenor options volatility surface. Verify whether this is a genuine strike/expiry surface derived from options-chain data or an index/proxy display.
7. Verify the precise US10Y/TIPS series and labels.
8. The “100% stop-loss refund guarantee” appears to refund credits. Confirm the actual user promise and wording.
9. Stripe webhook idempotency is described with an in-memory event registry. Verify durable idempotency across restarts and multiple server instances.
10. Verify Yahoo Finance and fallback sources, terms, licensing, rate limits, reliability and commercial display permissions.
11. Verify the exact Gemini model identifier and current provider/API compatibility; do not assume a report's model name is valid.
12. Verify whether “institutional”, “100% verified” and “production-ready” claims are supported by deployment, security, licensing, operational and independent validation evidence.

Do not assume each discrepancy is a defect. Confirm and classify it.

---

## 2. CHANGE CONTROL AND EXECUTION PROTOCOL

Work in stages:

- **A — Discover:** inspect repository, architecture, scripts, configuration and governance.
- **B — Baseline:** run existing checks and record exact results before changes.
- **C — Audit:** validate capability claims and identify defects, risks and unknowns.
- **D — Plan:** prepare prioritised remediation and enhancement backlog.
- **E — Approve:** present proposed changes for review where approval is available.
- **F — Implement:** make small, bounded, approved changes.
- **G — Verify:** run targeted and regression tests after every meaningful change.
- **H — Release readiness:** prepare an evidence-based assessment; do not deploy without authorisation.

Before changes:

1. Confirm repository root, branch, commit hash and working-tree status.
2. Identify and preserve uncommitted user changes.
3. Inspect runtime versions, package manager and lockfiles.
4. Identify build, lint, typecheck, test and start commands.
5. Record environment variable names only; never print secret values.
6. Identify database, cache, object storage and external dependencies.
7. Run baseline tests without modifying code.
8. Save exact output, duration, environment and known limitations.
9. Prepare a change plan and rollback strategy.

Implementation discipline:

- Prefer small, reviewable commits/change sets.
- Do not combine unrelated refactors with critical fixes.
- Add tests alongside fixes.
- Keep domain logic out of UI components where practical.
- Avoid duplicate sources of truth.
- Use typed domain models and boundary validation.
- Make migrations reversible where feasible.
- Maintain backwards compatibility unless a breaking change is approved.
- Update documentation and decision records.
- Never mark work complete until acceptance criteria and evidence are satisfied.

---

## 3. PHASE 0 — INDEPENDENT REPOSITORY AND CAPABILITY AUDIT (P0)

### Objective
Establish the actual technical state of v1.6.0 and create a trustworthy baseline.

### Work

**Repository inventory:** inspect frontend routes/components/state, backend routes/middleware, domain services, provider adapters, schemas/migrations, authentication, entitlements, AI prompts/orchestration, tests/fixtures, deployment/CI, logs and governance documents.

Produce a dependency map and identify critical paths.

**Capability evidence matrix:** for every claimed capability record:

| Field | Required content |
|---|---|
| Capability ID | Stable unique identifier |
| Capability | Specific promised behaviour |
| Status | Verified / Partial / Not implemented / Simulated / Not verified / Prohibited |
| Frontend | Actual routes/components |
| Backend | Actual services/endpoints |
| Data | Actual source and persistence |
| Tests | Test name, assertion and result |
| Runtime | Reproducible behaviour |
| Dependency | Provider, credentials, licence or service |
| Limitations | Known constraints |
| Risk | Severity and impact |
| Recommendation | Retain, fix, replace, defer or remove |

A capability is **VERIFIED** only when end-to-end behaviour is supported by code, meaningful tests and suitable runtime evidence. A mocked provider test does not verify a live integration. A UI component does not verify server-side enforcement.

**Baseline checks:** run unit, integration, API, browser/E2E, typecheck, lint, production build, dependency/vulnerability and accessibility checks where available. Report exact commands, results, skipped tests and limitations separately.

### Deliverables

- `docs/audit/V1_6_INDEPENDENT_TECHNICAL_AUDIT.md`
- `docs/audit/CAPABILITY_VERIFICATION_MATRIX.md`
- `docs/audit/REPOSITORY_AND_DEPENDENCY_MAP.md`
- `docs/audit/BASELINE_TEST_RESULTS.md`
- `docs/audit/GAP_AND_RISK_REGISTER.md`

### Acceptance criteria

- All declared capabilities have unique IDs and evidence.
- Capability and test-count discrepancies are reconciled.
- Mocked, simulated and live-connected behaviour are distinguished.
- High/critical findings have reproduction steps or a precise evidence gap.
- No implementation changes occur during audit-only work unless authorised.

---

## 4. PHASE 1 — MARKET DATA INTEGRITY AND INSTRUMENT GOVERNANCE (P0)

### Objective
Make market data traceable, temporally correct and fit for its declared use.

### 4.1 Canonical instrument registry

Inspect and, where necessary, implement one canonical registry containing:

- Stable internal instrument ID and aliases.
- Asset class and type: spot, index, future, ETF, CFD, benchmark or derived series.
- Venue and provider symbol mapping.
- Base/quote currency.
- Price and quantity units.
- Tick size, precision, contract multiplier and lot convention.
- Trading calendar, session, holidays and exchange timezone.
- Canonical storage timezone (UTC).
- Quote timestamp semantics: exchange, provider or receipt time.
- Expiry, first notice and last trading dates for futures.
- Continuous-contract methodology and roll policy.
- Source priority, fallback and licensing metadata.
- Permitted use: display, research, simulation or advisory.

Never conflate XAU/USD spot with COMEX Gold futures, or WTI/Brent spot references with futures.

### 4.2 Dynamic futures lifecycle

Inspect the reported COMEX strip and implement expiry-aware handling where missing:

- Contract master with exchange, root, month code, year, expiry, first notice and last trade.
- Active/next/forward contract selection.
- Liquidity/open-interest/volume selection only where reliable data exists.
- Configurable, documented roll policy.
- Delivery-sensitive contract treatment.
- Exclusion of expired contracts from current analytics.
- Historical contract identity retained for backtests.
- No silent stitching of discontinuous contracts.
- Documented roll-gap/adjustment methodology.
- Alerts for missing or invalid contract metadata.

Do not fabricate expiry or liquidity information. Use authoritative exchange/licensed data or mark unavailable.

### 4.3 Provider provenance and health

For each provider/instrument capture provider/product, entitlement, timestamp, receipt time, delay status, currency/unit, latency, quality checks, fallback reason, licence reference and commercial-use permission.

Support deterministic states:

`FRESH`, `DELAYED`, `DEGRADED`, `STALE`, `UNAVAILABLE`, `INVALID`, `SIMULATED`.

Fallback must retain original source identity and be visibly labelled. A fallback quote must not masquerade as primary live data.

### 4.4 Validation rules

Test:
- Valid price/range checks.
- Timestamp monotonicity and duplicate detection.
- Maximum staleness by instrument/session.
- Outlier detection without deleting legitimate shock moves.
- Bid/ask and spread sanity.
- OHLC consistency.
- Volume non-negativity and units.
- Missing intervals with market-calendar awareness.
- Cross-provider discrepancies.
- Currency/unit conversions.
- Daylight-saving and session boundaries.
- Provider failover and recovery.

Never forward-fill missing prices without labelling the result and restricting its use. Stale data must not silently generate a fresh advisory.

### 4.5 Historical candles and resampling

Verify M1/M5/M15/H1/H4/D1/W1 boundaries, UTC storage, timezone display, partial candles, warm-up, holidays, gaps, futures rolls, revisions and point-in-time correctness. Do not invent candles to fill gaps.

### 4.6 Data licensing

Create `docs/data/DATA_SOURCE_AND_LICENSE_REGISTER.md` recording provider/dataset, coverage, delay status, licence, display/redistribution rights, retention, rate limits, cost, attribution, credentials, fallback and verification date.

### Acceptance criteria

- Expired contracts cannot be selected as current.
- Every visible quote has source, timestamp and status.
- Stale/invalid data cannot generate a valid new advisory.
- Instrument identity and units are unambiguous.
- Gaps and roll events are detectable.
- Fallback is transparent.
- Unknown licensing is a release blocker where relevant.

---

## 5. PHASE 2 — QUANTITATIVE ENGINE AND BACKTEST VALIDATION (P0)

### Objective
Prove calculations and strategy research are correct, reproducible and honestly presented.

### 5.1 Formula review

Independently inspect and test RSI, ATR, EMA, MACD, Supertrend, pivots, spreads, basis, convenience yield, position sizing, multipliers, margin, leverage, stop distance, portfolio exposure, correlation, VaR, expected shortfall, drawdown, Monte Carlo and probability of ruin.

For every formula document definition, units, inputs, edge cases, numerical tolerance and reference examples. Use independent reference calculations; do not merely duplicate implementation logic in tests.

### 5.2 Backtest integrity

Verify:
- Chronological ordering.
- No future data in signals.
- No indicator warm-up leakage.
- No same-bar look-ahead when signals require candle close.
- Realistic next-bar/order timing.
- Stop/target collision rules where OHLC cannot establish sequence.
- Gap-through-stop behaviour.
- Spread, commission, financing, swap, slippage and fees.
- Session/holiday effects.
- Futures roll/expiry treatment.
- Missing data and rejected-trade handling.
- Position overlap, pyramiding and portfolio constraints.
- Reproducible random seeds.

### 5.3 Walk-forward research

Inspect the five-fold walk-forward implementation. Require strict chronological splits, leakage-free feature processing, purging/embargo where needed, an untouched final holdout, documented search space/trial count, baseline comparisons, regime/instrument stability and explicit IS/validation/OOS reporting.

A WFE threshold alone does not prove robustness or constitute independent certification. Remove or qualify unsupported certification claims.

### 5.4 Monte Carlo

Evaluate trade-sequence permutation versus resampling with replacement, dependence/clustering, regime changes, volatility clustering, fat tails, sample size, confidence intervals and probability-of-ruin assumptions. Consider block or regime-conditioned bootstrap only where justified.

### 5.5 Slippage and execution assumptions

Verify whether session-specific slippage figures are empirically measured, broker/instrument specific, fixed assumptions or illustrative defaults. Separate spread, commission, slippage, market impact, financing, futures fees and roll costs. Do not call illustrative constants “calibrated”.

### 5.6 Performance reporting

Every backtest must disclose instrument, source, period, timeframe, trade count, gross/net returns, costs, drawdown, profit factor, expectancy, Sharpe/Sortino where appropriate, win rate, average win/loss, exposure, turnover, OOS results, benchmark, uncertainty, sample-size caveats and parameter selection.

Clearly label simulated/hypothetical results. Never present them as actual user outcomes.

### Deliverables

- `docs/quant/QUANTITATIVE_VALIDATION_REPORT.md`
- `docs/quant/FORMULA_REFERENCE.md`
- `docs/quant/BACKTEST_ASSUMPTIONS.md`
- `docs/quant/STRATEGY_SCORECARD.md`

### Acceptance criteria

Critical formulas have independent reference tests; known leakage is removed; costs are explicit; expired futures and rolls are correct; OOS results are distinguished; unsupported certification language is corrected.

---

## 6. PHASE 3 — SECURITY, AUTHENTICATION, RBAC AND MONETISATION (P0)

### 6.1 Authentication and sessions

Inspect password/passkey/social login, OAuth state/nonce/redirect/PKCE, signature/issuer/audience/expiry validation, session rotation/revocation, cookie security, CSRF, rate limits, account recovery/linking, email verification, logout and secret storage. Do not call simulated providers production-connected.

### 6.2 RBAC and entitlements

Test `GUEST`, `FREE`, `PRO`, `ALPHA` at UI and API layers:
- Default deny.
- Server-side checks on every protected endpoint.
- No client-state privilege escalation.
- Persona switching restricted to test/admin mode.
- Tenant/user ownership checks.
- Subscription expiry/downgrade.
- Cache invalidation.
- Administrative audit trails.

### 6.3 Stripe and billing

Inspect checkout, signature verification, durable webhook event storage, idempotency across restarts/multiple instances, ordering/retries, duplicate/out-of-order events, refunds, cancellations, chargebacks, renewals, credit purchase/consumption, reconciliation, currency/tax/invoice handling.

An in-memory event registry is not proof of durable idempotency. If used, record the gap and propose persistent event IDs with transactional processing. Never process unverified webhook payloads.

### 6.4 Credit ledger

Use an auditable ledger, not only a mutable balance. Record account, event/idempotency key, transaction type, amount/unit, before/after or ledger-derived balance, related plan/order, timestamp, reversal linkage, actor, status and reconciliation metadata.

Test concurrency, retries, duplicate unlocks, negative balances, refunds, reversals and transaction failures.

### 6.5 Stop-loss credit refund

Clarify that the report describes a credit refund, not necessarily a cash refund. Define deterministic treatment for:
- Stop and target in same candle.
- Gap-through-stop.
- Missing/stale data or provider outage.
- Unlock after original trigger.
- Repeated unlocks.
- Partial targets in paper simulation.
- Advisory modification after publication.
- User deviation, manual close or expiry.
- Disputed event sequence.

The original immutable snapshot governs outcome. No retrospective edits to entry, stop, target or timestamp. Legal review is required before advertising a guarantee.

### 6.6 Broker rebates

Disclose referral/rebate relationships. Separate commercial ranking from analytical ranking. Compensation must not influence recommendation direction, confidence or priority. Verify jurisdictional availability and avoid implied endorsement or guaranteed outcomes.

### Deliverables

- `docs/security/SECURITY_AND_MONETIZATION_AUDIT.md`
- `docs/security/THREAT_MODEL.md`
- `docs/commercial/CREDIT_LEDGER_SPECIFICATION.md`
- `docs/commercial/REFUND_POLICY_RULES.md`
- `docs/commercial/COMMERCIAL_DISCLOSURES_REGISTER.md`

### Acceptance criteria

API-level access control works independently of UI; webhooks are verified and durably idempotent; ledger is auditable/concurrency-safe; refund rules are deterministic; simulations are labelled; commercial claims await legal review.

---

## 7. PHASE 4 — AI GOVERNANCE, GROUNDING AND PUBLICATION SAFETY (P0/P1)

### 7.1 Agent contracts

Inspect the four reported roles: macro/yields, technical momentum, order-flow/volume delta and geopolitical risk.

For each, document inputs/provenance, provider/model/version, prompt constraints, output schema, timeout/failure handling, confidence semantics, citations, blind spots, latency and cost. An agent must not claim to analyse order flow without genuine order-flow inputs.

### 7.2 Council states

Define explicit states:
- `FULL_COUNCIL`: all required specialists returned valid outputs.
- `QUALIFIED_COUNCIL`: explicitly approved reduced quorum for limited research only.
- `NO_VERDICT`: insufficient valid agents/evidence.
- `VETOED`: defined risk veto blocks publication.
- `CONFLICTED`: disagreement exceeds a justified threshold.

If four-of-four is required, enforce it. Never silently reduce quorum. Preserve dissent.

Distinguish agent agreement, evidence agreement, statistical confidence, forecast probability and historical accuracy.

### 7.3 Grounded research

For each factual claim capture claim, source ID/URL, publisher, publication time, event time, retrieval time, source tier, excerpt/structured evidence and status (confirmed/disputed/unverified).

Distinguish primary sources, reputable secondary sources, commentary, social media and unverified claims. Search failure must not become fabricated success. Fallback must disclose search unavailability and show actual source/time.

### 7.4 Prompt injection and tool security

Test role-switch attempts, prompt extraction, delimiter confusion, malicious retrieved content, tool-output injection, exfiltration, cross-user leakage, unsafe HTML/Markdown and cost abuse. Treat retrieved content as untrusted data, never instructions.

### 7.5 Deterministic publication gate

Validate:
1. Instrument and market-data identity.
2. Freshness and provenance.
3. Entry/stop/target mathematical consistency.
4. Risk and sizing constraints.
5. Forecast snapshot/audit metadata.
6. Evidence sufficiency and council state.
7. Absence of prohibited execution instructions.
8. Absence of unsupported certainty/guaranteed-return language.

Specify and test the gate. Do not assume the reported five mathematical checks are sufficient.

### 7.6 AI evaluation

Build a versioned evaluation set for normal commentary, conflicting sources, stale quotes, missing inputs, extreme moves, high-impact events, agent contradictions, prompt injection, false news, unsupported causal claims, no-trade and provider outages.

Measure factual grounding, citation validity, calculation consistency, refusal correctness, unsupported-claim rate, latency and cost.

### Deliverables

- `docs/ai/AI_GOVERNANCE_AUDIT.md`
- `docs/ai/AGENT_CONTRACTS.md`
- `docs/ai/PUBLICATION_GATE_SPEC.md`
- `docs/ai/AI_EVALUATION_PLAN.md`

### Acceptance criteria

AI cannot alter deterministic risk values or snapshots; missing evidence yields qualified/no verdict; dissent remains visible; material claims are traceable; injection tests demonstrate isolation; model identifiers/fallbacks are accurate.

---

## 8. PHASE 5 — CONTINUOUS FORECAST INTELLIGENCE AND ACCOUNTABILITY (P1, STRATEGIC PRIORITY)

### Objective

Transform GoldVista from an advisory generator into a platform that measures and demonstrates the historical quality of its forecasts.

### 8.1 Immutable forecast object

Create a versioned schema containing:
- Unique forecast ID.
- Instrument/type and horizon/timeframe.
- Creation and market-data timestamps.
- Direction: bullish, bearish, neutral/no-trade.
- Reference price/source.
- Entry corridor, stop/invalidation and targets.
- Forecast expiry.
- Probability/confidence only if calibrated.
- Market regime.
- Macro/event context.
- Technical feature snapshot.
- Fundamental evidence references.
- AI council outputs/dissent.
- Deterministic risk outputs.
- Model/strategy versions.
- Data quality state.
- Snapshot hash and canonical serialisation version.
- Publication status/reason.
- Supersedes/related forecast reference.

A hash proves integrity of the hashed bytes; it does not prove source-data truth or forecast accuracy.

### 8.2 Lifecycle

Implement explicit states such as:

`DRAFT → VALIDATED → PUBLISHED → ACTIVE → TARGET_REACHED / STOP_REACHED / INVALIDATED / EXPIRED`

Also support `WITHDRAWN`, `UNRESOLVED` and `SUPERSEDED`, without deleting history.

Never rewrite/delete a published forecast to improve historical performance.

### 8.3 Outcome rules

Specify price source, timestamp convention, stop/target same-candle treatment, gaps, expiry, partial targets, missing data and market closures before scoring. Use a deterministic evaluator and preserve raw observations.

### 8.4 Scorecards

By instrument, horizon, strategy, regime and model version, report:
- Directional and balanced accuracy where appropriate.
- MAE/RMSE for price forecasts.
- Brier score and calibration curves for probabilities.
- Target achievement and stop incidence.
- MFE and MAE.
- Realised reward/risk under disclosed assumptions.
- Forecast coverage and no-trade rate.
- Unresolved/invalid data rate.
- Performance after estimated costs, labelled simulated where applicable.

Do not combine all instruments/horizons into one flattering aggregate.

### 8.5 Probability calibration

Define the predicted event precisely. Evaluate out of sample with sufficient observations, reliability diagrams, Brier score and baseline comparison. Monitor drift. Suppress numeric probabilities when sample size is inadequate. Do not turn a subjective LLM confidence score into a statistical probability.

### 8.6 Accountability dashboard

Show active/resolved forecasts, history by commodity/horizon, original snapshot/evidence, outcome timeline, scorecards/calibration, regime performance, data caveats and model changes. Both successful and unsuccessful forecasts must be inspectable.

### 8.7 Controlled feedback loop

Outcome data informs research; it must not silently modify production rules. Model updates require hypothesis, versioned dataset/features, train/validation/holdout, OOS evaluation, baseline comparison, risk review, approval, release record and rollback/monitoring.

No automatic self-modification of production advisory rules.

### Deliverables

- `docs/forecast/FORECAST_ACCOUNTABILITY_SPEC.md`
- `docs/forecast/OUTCOME_EVALUATION_RULES.md`
- `docs/forecast/FORECAST_SCORECARD_SPEC.md`
- `docs/forecast/PROBABILITY_CALIBRATION_PLAN.md`

### Acceptance criteria

Every published forecast is immutable and traceable; outcome rules are deterministic; unresolved cases are not wins/losses; scorecards are reproducible and segmented; probabilities are calibrated or suppressed.

---

## 9. PHASE 6 — MARKET REGIME AND CROSS-COMMODITY INTELLIGENCE (P1)

### 9.1 Regime taxonomy

Potential states:
- Strong bullish trend.
- Strong bearish trend.
- Range/consolidation.
- Volatility expansion/contraction.
- Breakout/reversal transition.
- Event-driven/dislocated market.
- Illiquid/unreliable data.
- Unknown/insufficient evidence.

Use explainable features such as trend slope/alignment, ADX or equivalent, realised volatility/ATR percentile, range compression, genuine volume/liquidity, price structure, momentum and macro-event proximity. Do not overfit labels to one indicator. Preserve UNKNOWN.

### 9.2 Multi-timeframe logic

Define a consistent hierarchy for strategic direction, setup and entry timing. Make it configurable and session-aware. Never treat an incomplete higher-timeframe candle as final.

### 9.3 Cross-commodity relationships

Develop:
- Gold/DXY.
- Gold/real yields.
- Gold/Silver.
- WTI/Brent.
- Gold/Silver ratio.
- Energy/inflation expectations.
- Commodity/macro relationships.

Use rolling correlation/beta, lead-lag analysis with leakage controls, cointegration only where justified, regime-conditioned relationships and structural-break detection. Correlation is not causation; do not assume relationships are permanent.

### 9.4 Regime-conditioned strategy selection

Enable a strategy only when documented conditions are met. Explain suitability, conflicts and risk. Return no-trade if evidence is insufficient. Record issue-time regime for later scoring.

### Deliverables

- `docs/research/MARKET_REGIME_ENGINE_SPEC.md`
- `docs/research/CROSS_COMMODITY_INTELLIGENCE_SPEC.md`
- `docs/research/REGIME_VALIDATION_REPORT.md`

### Acceptance criteria

Regime labels are reproducible/timestamped; unknown states are supported; cross-asset timestamps/calendars align; causal claims are avoided; strategy suitability is explainable and tested OOS.

---

## 10. PHASE 7 — COMMODITY-SPECIFIC FUNDAMENTAL INTELLIGENCE (P1)

Build separate evidence models, not one generic commodity model.

### Gold
Central-bank purchases/sales, ETF holdings/flows, real and nominal yields, dollar measures, inflation expectations, physical demand/supply, mine production/recycling, COMEX positioning/warehouse data, geopolitical risk and regional premiums where licensed.

### Silver
Industrial and solar/PV demand, electronics, mine production/by-product supply, recycling, physical balance, ETF flows, Gold/Silver ratio, COMEX positioning/warehouse data, substitution and technology risk.

### WTI
EIA crude/Cushing/gasoline/distillate inventories, refinery utilisation, US production/rigs, imports/exports, OPEC+ supply, seasonality, futures curve/spreads and geopolitical/transport disruption.

### Brent
Global seaborne supply, OPEC+/non-OPEC production, North Sea supply, refinery demand/maintenance, shipping/tanker flows where licensed, sanctions/geopolitics, Brent curve/time spreads, Brent-WTI and regional differentials where available.

### Fundamental evidence schema

Each observation must contain metric ID/definition, value/unit, geography/commodity, observation period, release time, retrieval time, source/tier, revision status, frequency, quality state, historical series ID and limitations.

Do not mix observation date, publication date and retrieval date. Do not convert low-frequency annual data into precise daily signals without a defensible model.

### Deliverables

- `docs/fundamentals/GOLD_FUNDAMENTALS_SPEC.md`
- `docs/fundamentals/SILVER_FUNDAMENTALS_SPEC.md`
- `docs/fundamentals/WTI_FUNDAMENTALS_SPEC.md`
- `docs/fundamentals/BRENT_FUNDAMENTALS_SPEC.md`
- `docs/fundamentals/FUNDAMENTAL_DATA_DICTIONARY.md`

### Acceptance criteria

Each commodity has a distinct evidence model; inputs are sourced, timestamped, unit-validated and revision-aware; missing data remains visible; point-in-time correctness is tested.

---

## 11. PHASE 8 — UNIFIED DECISION INTELLIGENCE AND OPPORTUNITY SCANNER (P1)

### 11.1 Canonical decision object

Create a versioned schema containing:
- Decision ID, instrument/type, horizon/timeframe, timestamp.
- Data snapshot and quality.
- Market regime.
- Direction: `BUY`, `SELL`, `HOLD`, `NO_TRADE`, `INSUFFICIENT_EVIDENCE`.
- Strategy/setup ID.
- Entry corridor, stop/invalidation and targets.
- Risk/reward and sizing output.
- Event risk.
- Fundamental, technical and cross-asset evidence.
- Quantitative model output.
- AI council status, votes and dissent.
- Probability/calibration metadata where supported.
- Reasons and rejection conditions.
- Snapshot hash, expiry and outcome rules.

### 11.2 Unified scanner

Scan supported commodities/horizons and show instrument, direction/no-trade, regime, entry, stop, targets, risk/reward, evidence strength, freshness, event risk, council dissent, forecast history and model version.

Ranking must be deterministic and explainable. Never rank solely by an opaque AI score.

### 11.3 Mandatory no-trade conditions

Test stale/invalid prices, expired futures, wide/unknown spreads, insufficient liquidity, configured event blackouts, conflicting timeframe evidence, breached risk limits, unresolved veto, poor/unvalidated model quality, insufficient sample size, invalid stop/risk-reward and closed sessions.

No-trade is a valid outcome and must be displayed clearly.

### 11.4 Explanation

Every decision must explain recommendation, evidence, counter-evidence, invalidation, remaining risk, missing data and whether it is research, simulated or indicative reference information.

### Deliverables

- `docs/decision/UNIFIED_DECISION_SCHEMA.md`
- `docs/decision/OPPORTUNITY_SCANNER_SPEC.md`
- `docs/decision/NO_TRADE_RULES.md`

### Acceptance criteria

One canonical decision schema; traceable evidence snapshot; reproducible ranking; first-class no-trade; same validated object used by UI and API.

---

## 12. PHASE 9 — PORTFOLIO, SCENARIO AND PAPER-SIMULATION INTELLIGENCE (P2)

Enhance:
- Portfolio-level commodity exposure.
- Currency/contract-unit normalisation.
- Correlation and concentration risk.
- Scenario shocks and stress testing.
- Drawdown/loss-limit monitoring.
- Paper trade lifecycle and audit.
- Simulated spread, slippage, financing and fees.
- Portfolio-level risk aggregation.
- Exposure by commodity, direction, horizon and strategy.
- Physical bullion accumulation records, separate from derivatives.
- Valuation data-quality warnings.
- Scenario comparison and sensitivity.

Do not combine physical holdings, futures notional, CFD exposure and paper positions without explicit units and valuation conventions.

**Acceptance:** unit-consistent exposures; distinct physical and simulated positions; no paper-to-live route; disclosed stress assumptions; portfolio risk tests.

---

## 13. PHASE 10 — UX, REPORTING, ALERTS AND ACCESSIBILITY (P2)

### 13.1 Dashboard

Prioritise market/data-health overview, commodity selector, regime/macro context, opportunity scanner, active forecasts, forecast performance, evidence/source detail, risk/event warnings, portfolio and paper journal, reports.

Use clear hierarchy and consistent units. Avoid decorative metrics and unsupported precision.

### 13.2 Institutional report generator

Daily/weekly reports should include:
1. Executive summary.
2. Data freshness/provenance.
3. Market regime.
4. Price/technical structure.
5. Macro context.
6. Commodity fundamentals.
7. Bullish, bearish and neutral scenarios.
8. Advisory/no-trade state.
9. Entry/invalidation/targets where justified.
10. Event calendar.
11. Forecast history/scorecard.
12. Limitations/disclosures.

Include an “as of” timestamp. Distinguish facts, estimates, interpretations and scenarios.

### 13.3 Alerts

Support new validated forecast, invalidation, target/stop outcome, stale/provider degraded, contract expiry/roll, high-impact event, regime transition, risk threshold and forecast performance changes.

Deduplication must not suppress critical state changes. Sign webhooks and avoid sensitive account details in notifications.

### 13.4 Accessibility

Test keyboard navigation, contrast, screen-reader labels, responsive layout, loading/empty/error states, chart legends/units and understandable warnings/no-trade states.

**Acceptance:** reports reproduce stored snapshots; alerts preserve critical transitions; uncertainty/staleness are clear; core workflows work on supported screens and keyboard navigation.

---

## 14. PHASE 11 — OBSERVABILITY, RELIABILITY AND PRODUCTION READINESS (P0 BEFORE RELEASE)

### 14.1 Telemetry

Implement structured logs, metrics and traces for API latency/errors, provider latency/quota/failures, freshness/missing intervals, job queues, AI latency/errors/cost, forecast publication/rejection, backtests, webhooks, auth failures, billing reconciliation, database health and notification delivery.

Never log secrets, full tokens, payment credentials or unnecessary personal data.

### 14.2 Reliability

Review timeouts, retries/backoff/jitter, circuit breakers, rate limits, bulkheads, idempotent jobs, dead-letter handling, provider failover, graceful degradation, database connections, cache invalidation, backup/restore, disaster recovery and rollback.

Do not retry non-idempotent credit/billing operations without idempotency controls.

### 14.3 Security

Perform dependency/vulnerability and secret scanning, SAST, DAST/API testing where feasible, OWASP-aligned review, access-control/input-validation tests, SSRF/injection review, abuse/rate-limit testing, secure-header/TLS review and backup encryption/access review.

### 14.4 Release gates

No production release until:
- Critical/high security issues are resolved or formally accepted.
- Data sources and commercial rights are confirmed.
- Risk calculations have independent tests.
- Billing/credit ledger is durable and reconciled.
- Forecast history is immutable/auditable.
- Monitoring and rollback are tested.
- Legal/compliance review is complete for intended jurisdictions and claims.
- User disclosures are approved.
- Production configuration is separated from development/test modes.

### Deliverables

- `docs/operations/PRODUCTION_READINESS_CHECKLIST.md`
- `docs/operations/OBSERVABILITY_AND_ALERTING.md`
- `docs/operations/INCIDENT_RESPONSE_RUNBOOK.md`
- `docs/operations/BACKUP_AND_RECOVERY_PLAN.md`
- `docs/security/PRODUCTION_SECURITY_REVIEW.md`

---

## 15. PRODUCT TRUST, REGULATORY AND COMMERCIAL GOVERNANCE

### Product positioning

Use accurate terms such as commodity research, quantitative analysis, decision support, paper simulation and indicative market references. Do not claim regulatory authorisation, certification, guaranteed profits, independently verified performance or production readiness without evidence.

### Jurisdictional review

Obtain qualified legal/compliance review for the company’s and users’ relevant jurisdictions. Review whether the product constitutes investment advice/research/signals or another regulated activity; licensing; marketing claims; warnings; broker referrals; consumer protection/refund terms; privacy; payment/tax/subscription rules; and data redistribution rights.

Do not present engineering analysis as a legal conclusion.

### Privacy and retention

Document data collected, purpose/legal basis as advised by counsel, minimisation, retention/deletion, export, access controls, processors, cross-border transfers and incident notification.

### Commercial truth

Distinguish capability, provider entitlement, paid feature, simulation, referral programme, credit refund, cash refund and subscription status. UI/marketing must not imply demo flows are live.

---

## 16. PRIORITISED ROADMAP

### Wave 1 — Establish truth (P0)
1. Phase 0: repository/capability audit.
2. Phase 1: market data and instrument integrity.
3. Phase 2: quantitative validation.
4. Phase 3: security, RBAC, billing and monetisation audit.
5. Phase 4: AI governance and publication safety.

**Exit gate:** critical findings resolved or formally accepted; core data, calculation, security and AI claims accurately classified.

### Wave 2 — Establish predictive accountability (P1)
6. Phase 5: continuous forecast accountability.
7. Phase 6: market regime/cross-commodity intelligence.
8. Phase 7: commodity-specific fundamentals.
9. Phase 8: unified decision intelligence/scanner.

**Exit gate:** immutable forecasts, reproducible outcomes, explainable decisions and enforced no-trade logic.

### Wave 3 — User and portfolio value (P2)
10. Phase 9: portfolio/scenario intelligence.
11. Phase 10: UX, reporting and alerts.

**Exit gate:** portfolio and reports use validated core data and decisions.

### Wave 4 — Controlled release
12. Phase 11: observability, reliability and production readiness.
13. Complete licensing, commercial and jurisdictional review.
14. Run release-candidate and rollback rehearsals.

**Exit gate:** evidence-backed signed release decision, not a feature-count claim.

---

## 17. REQUIRED GOVERNANCE DOCUMENTS

Create or update the following. Preserve existing history and avoid duplicate sources of truth.

**Audit**
- `docs/audit/V1_6_INDEPENDENT_TECHNICAL_AUDIT.md`
- `docs/audit/CAPABILITY_VERIFICATION_MATRIX.md`
- `docs/audit/REPOSITORY_AND_DEPENDENCY_MAP.md`
- `docs/audit/BASELINE_TEST_RESULTS.md`
- `docs/audit/GAP_AND_RISK_REGISTER.md`

**Data**
- `docs/data/DATA_SOURCE_AND_LICENSE_REGISTER.md`
- `docs/data/INSTRUMENT_REGISTRY_SPEC.md`
- `docs/data/FUTURES_LIFECYCLE_AND_ROLL_POLICY.md`
- `docs/data/MARKET_DATA_INTEGRITY_AUDIT.md`

**Quantitative**
- `docs/quant/QUANTITATIVE_VALIDATION_REPORT.md`
- `docs/quant/FORMULA_REFERENCE.md`
- `docs/quant/BACKTEST_ASSUMPTIONS.md`
- `docs/quant/STRATEGY_SCORECARD.md`

**Security/commercial**
- `docs/security/SECURITY_AND_MONETIZATION_AUDIT.md`
- `docs/security/THREAT_MODEL.md`
- `docs/commercial/CREDIT_LEDGER_SPECIFICATION.md`
- `docs/commercial/REFUND_POLICY_RULES.md`
- `docs/commercial/COMMERCIAL_DISCLOSURES_REGISTER.md`

**AI/forecast**
- `docs/ai/AI_GOVERNANCE_AUDIT.md`
- `docs/ai/AGENT_CONTRACTS.md`
- `docs/ai/PUBLICATION_GATE_SPEC.md`
- `docs/ai/AI_EVALUATION_PLAN.md`
- `docs/forecast/FORECAST_ACCOUNTABILITY_SPEC.md`
- `docs/forecast/OUTCOME_EVALUATION_RULES.md`
- `docs/forecast/FORECAST_SCORECARD_SPEC.md`
- `docs/forecast/PROBABILITY_CALIBRATION_PLAN.md`

**Product/operations**
- `docs/research/MARKET_REGIME_ENGINE_SPEC.md`
- `docs/research/CROSS_COMMODITY_INTELLIGENCE_SPEC.md`
- `docs/fundamentals/FUNDAMENTAL_DATA_DICTIONARY.md`
- `docs/decision/UNIFIED_DECISION_SCHEMA.md`
- `docs/decision/OPPORTUNITY_SCANNER_SPEC.md`
- `docs/operations/PRODUCTION_READINESS_CHECKLIST.md`
- `docs/operations/OBSERVABILITY_AND_ALERTING.md`
- `docs/operations/INCIDENT_RESPONSE_RUNBOOK.md`
- `docs/operations/BACKUP_AND_RECOVERY_PLAN.md`
- `docs/product/V1_7_IMPLEMENTATION_ROADMAP.md`

If a document exists, update it carefully, preserving prior decisions, dates and evidence.

---

## 18. TESTING STRATEGY AND QUALITY GATES

### Unit tests
Instrument parsing; expiry/roll; price/candle validation; timezone/session; indicators; risk/sizing; backtest rules; forecast state; hash/canonical serialisation; outcome evaluation; credit ledger; entitlements; publication gates.

### Integration tests
Provider adapters/failures; database persistence/migrations; durable webhook idempotency; auth callbacks; AI orchestration/fallback; forecast persistence/scorecards; notification delivery/signatures; cache/jobs.

Use controlled fixtures and provider sandboxes. Label mocks/simulations.

### End-to-end tests
- Guest sees correct data-health state.
- User sees instrument provenance.
- Research output shows evidence.
- Stale data blocks advisory.
- Valid advisory is snapshotted.
- Forecast is monitored/resolved.
- Scorecard reflects immutable outcome.
- Credit ledger updates once.
- Duplicate webhook does not duplicate credits.
- Unauthorized user is blocked.
- Paper journal remains isolated from live execution.

### Negative/resilience tests
Provider outage, rate limit, timeout, corrupt payload, expired contract, missing candle, DST boundary, conflicting prices, database restart, multiple instances, duplicate/out-of-order webhook, AI hallucination/injection, council failure, same-candle stop/target ambiguity, missing outcome data, permission escalation and notification failure.

### Release quality gates
Build, typecheck and lint succeed; required tests pass; skipped tests are explained; critical/high security issues resolved or formally accepted; no material data or quantitative defect; no execution path; docs/ADRs updated; rollback tested.

Coverage percentages do not replace meaningful assertions. Prioritise critical-path correctness.

---

## 19. RISK REGISTER AND DEFECT HANDLING

Severity:
- **Critical:** materially incorrect financial output, unauthorised access, ledger corruption, deceptive data, prohibited execution or serious legal exposure.
- **High:** material impairment of core capability, forecast integrity, security or operational reliability.
- **Medium:** significant bounded limitation/workaround.
- **Low:** cosmetic, documentation or minor usability issue.

Every finding must include ID, title, severity/priority, status, evidence and affected files/lines, reproduction, expected/actual behaviour, impact, root cause/unknowns, corrective action, tests/acceptance, owner/workstream, dependencies and release-blocking status.

Do not downgrade severity just because a test passes.

---

## 20. CODING AGENT OPERATING CHECKLIST

1. Confirm environment: repository, branch, commit, runtime, package manager, working-tree status.
2. Read completion report, capability audit, decision log, baseline validation, README, scripts and deployment notes.
3. Run baseline checks and preserve exact output.
4. Trace every claim through UI, API, service, data, persistence, tests and runtime.
5. Publish audit documents and risk register before feature implementation.
6. For every work item state problem, evidence, change, files, schema impact, security impact, dependencies, effort (S/M/L/XL), tests, rollback and acceptance criteria.
7. Implement only the highest-priority approved bounded item.
8. Run targeted and regression tests; report files, commands, results and residual risks.
9. Update capability status, risk register, decision log and roadmap.
10. Stop at release gates. Never claim production readiness or deploy without evidence and explicit authorisation.

---

## 21. REQUIRED FINAL RESPONSE FORMAT

At the end of each audit/implementation cycle, respond with:

A. **Executive assessment:** actual repository state, verified/partial/simulated/unverified features and readiness.  
B. **Critical findings:** critical/high findings with evidence and remediation.  
C. **Capability verification:** actual counts and reconciliation.  
D. **Market-data assessment:** providers, licensing, contracts, freshness, historical quality and limitations.  
E. **Quantitative assessment:** formula correctness, backtest validity, leakage, costs and performance limitations.  
F. **Security/commercial assessment:** authentication, RBAC, Stripe, ledger, refund policy and partner disclosures.  
G. **AI governance:** agent contracts, quorum, grounding, dissent, injection and publication gate.  
H. **Forecast accountability:** immutable design, outcome rules, scorecards and calibration.  
I. **Prioritised roadmap:** P0/P1/P2 items, dependencies, effort and gates.  
J. **Test evidence:** commands, environment, results, skipped tests and limitations.  
K. **Files changed/created:** exact paths and descriptions.  
L. **Outstanding decisions:** items requiring product-owner, legal, provider or infrastructure approval.  
M. **Recommendation:** one clear next action.

---

## 22. DEFINITION OF SUCCESS

The programme succeeds only when:

1. Every instrument is unambiguously defined.
2. Every market value has honest provenance and freshness.
3. Expired/invalid contracts cannot contaminate current analysis.
4. Historical data is temporally correct and fit for use.
5. Critical calculations have independent reference tests.
6. Backtests are reproducible and disclose assumptions/limitations.
7. AI cannot override deterministic controls or fabricate evidence.
8. Every forecast is immutable and independently evaluable.
9. Scorecards include failures, unresolved cases and uncertainty.
10. Regime/cross-commodity analytics are point-in-time correct.
11. Commodity fundamentals are source-backed and revision-aware.
12. Decisions are explainable and can return no-trade.
13. Portfolio/paper simulation is isolated from live execution.
14. Authentication, access, billing and credit accounting are robust.
15. Licences, claims and jurisdictional obligations are reviewed.
16. Monitoring, incident response, backup and rollback are proven.
17. Documentation reflects the actual system, not intended features.
18. Production readiness is an evidence-backed decision, not a marketing label.

---

## 23. STRATEGIC DIRECTIVE

Do not optimise GoldVista for the largest number of features, agents, indicators or dashboard panels.

Optimise for:

- **Data truth:** the platform knows what it knows and what it does not know.
- **Quantitative truth:** calculations and simulations withstand independent scrutiny.
- **Forecast accountability:** every prediction remains visible and measurable.
- **Decision quality:** recommendations are evidence-led, risk-aware and explainable.
- **Operational trust:** failures are detected, disclosed and safely contained.
- **Commercial integrity:** users understand what is real, simulated, paid, sponsored and guaranteed.

GoldVista's defining capability should be its ability to show, with immutable evidence, how its market assessments performed across commodities, horizons and market regimes.

**First prove v1.6.0. Then correct the foundations. Then build forecast accountability and decision intelligence. Only then expand and release.**

This is the governing direction for the GoldVista v1.7+ programme.
