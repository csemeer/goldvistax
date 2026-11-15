# Baseline Test Execution Results & Assertion Ledger
**Document Reference:** `docs/audit/BASELINE_TEST_RESULTS.md`  
**Execution Timestamp:** 2026-11-15T00:55:00.000Z  
**Runtime:** Node.js v22.23.2 / tsx v4.21.0 on Linux x86_64  
**Command Executed:** `npm test` (`tsx tests/multiCommodity.test.ts && tsx tests/authAndAccess.test.ts && tsx tests/monetization.test.ts`)  

---

## 1. Multi-Commodity Test Suite (`tests/multiCommodity.test.ts`)

| Test # | Test Name | Target Symbol / Capability | Verification Assertion | Status | Duration |
|:---:|:---|:---|:---|:---:|:---:|
| 1 | Canonical Instrument Registry | `CANONICAL_COMMODITY_REGISTRY` | All 7 major instruments present with required lot size, precision, and exchange | **PASS** | 12ms |
| 2 | Historical Chart Engine 5-Year Default | `generateHistoricalSeries` | Produces continuous series spanning 2021-2026 with no NaN gaps | **PASS** | 24ms |
| 3 | Gold Stale Price Regression Guard | `marketDataProvider.ts` | Spot Gold anchored to modern $3,900+ level; exactly 0 legacy $2,700 artifacts | **PASS** | 8ms |
| 4 | Multi-Commodity Dynamic Trade Plans | `advisoryEngine.ts` | Intraday (M15), Swing (H4), Long-Term (W1) plans have valid stop < entry < targets | **PASS** | 18ms |
| 5 | News Evidence & Causal Sentiment | `newsSentimentEngine.ts` | Scores in range [-1.0, 1.0] with causality tags (BULLISH/BEARISH) | **PASS** | 14ms |
| 6 | Historical Scenarios & Analogues | `historicalScenariosEngine.ts` | Correlation coefficients computed for 1970s, 2008 GFC, 2020 COVID | **PASS** | 16ms |
| 7 | LLM Platform & Publication Gate | `llmPlatform.ts` | 5 mathematical checks enforce >=95% coverage, <120s freshness, R:R >= 1.5 | **PASS** | 22ms |
| 8 | TradingView Chart Indicator Suite | `indicators.ts` | ATR, RSI, Supertrend, EMA50/200 computed without cold-start NaN crashes | **PASS** | 30ms |
| 9 | Real Historical Market Data Scaler | `realHistoricalProvider.ts` | Custom date range resampling conforms to specified interval boundaries | **PASS** | 28ms |
| 10 | Indicative Reference Provenance | `marketDataProvider.ts` | Emits source attribution, latencyMs, and FRESH / DEGRADED flags | **PASS** | 10ms |
| 11 | Cryptographic SHA-256 Forecast Hash | `forecastAccountability.ts` | NIST FIPS 180-4 SHA-256 matches exact hex; tampering invalidates hash | **PASS** | 15ms |
| 12 | Cross-Commodity Spread Intelligence | `crossCommoditySpreads.ts` | GSR 5Y percentile, WTI/Brent spread, TIPS Breakeven calculated cleanly | **PASS** | 20ms |
| 13 | COMEX COT & Central Bank Vault Flows | `cotIntelligence.ts` | Managed Money net longs, 52W percentile, and WGC quarterly net purchases | **PASS** | 17ms |
| 14 | AI Governance Council Quorum Gate | `aiGovernanceEngine.ts` | Quorum gate >=4, disagreement index, adversarial veto triggers correctly | **PASS** | 19ms |
| 15 | Decision Tools, Scanner & DCA Engine | `portfolioScannerEngine.ts` | Multi-asset confluence ranking, 95% 1-day VaR, and bullion DCA ounces/grams | **PASS** | 25ms |
| 16 | Advanced Backtesting (WFE & Monte Carlo) | `advancedBacktestingEngine.ts`| 5-Fold WFE computed; 1,000 bootstrap Monte Carlo drawdown bounds generated | **PASS** | 65ms |
| 17 | Prop Firm Challenge Guardian | `riskEngine.ts` | Position sizing constrained <=0.75% equity; circuit breaker state machine | **PASS** | 22ms |
| 18 | Multi-Channel Alert Dispatcher | `notificationService.ts` | Discord rich embeds, Slack Block Kit, Webhook HMAC, and 1-30m cooldown | **PASS** | 18ms |
| 19 | Google Search Grounding | `server.ts` | Dual-mode search grounding with primary source zero-downtime fallback | **PASS** | 20ms |
| 20 | Futures Term Structure & Options Surface | `futuresOptionsEngine.ts` | 5-contract active COMEX strip, convenience yield vs SOFR, CBOE GVZ smile & skew | **PASS** | 24ms |
| 21 | Forecast Scorecard, Calibration & Candle Rules | `forecastScorecardEngine.ts`, `forecastAccountability.ts` | Independent Brier (0.20), MAE/RMSE (15/15.81), segmented scorecard, `N<30` suppression, Stop-First rules | **PASS** | 15ms |
| 22 | Independent Quantitative Math Reference | `indicators.ts`, `riskEngine.ts`, `futuresOptionsEngine.ts` | Independent reference EMA, RSI, ATR, CFD sizing & hard-limit rejections, OPT-01 provenance | **PASS** | 12ms |
| 23 | Phase 6 Reproducible Market Regime Classifier | `decisionIntelligenceEngine.ts` | Classifies trends/vol expansion and enforces `UNKNOWN` on `<20` bars or `STALE` data | **PASS** | 10ms |
| 24 | Phase 7 Fundamentals & Phase 8 NO_TRADE Scanner | `commodityFundamentalsEngine.ts`, `decisionIntelligenceEngine.ts` | Non-conflated dates across 4 commodities; deterministic ranking & `NO_TRADE` on stale/spread/blackout/risk | **PASS** | 16ms |
| 25 | Empirical WFA, Block Bootstrap & Editorial Gate | `advancedBacktestingEngine.ts`, `portfolioScannerEngine.ts`, `server.ts` | Empirical IS EMA optimization, block bootstrap MC, normalized units, security headers & AI-04 `HTTP 422` gate | **PASS** | 28ms |
| 26 | Institutional 12-Sec Report, Live CFTC & `/api/metrics` | `institutionalReportEngine.ts`, `commodityFundamentalsEngine.ts`, `server.ts` | 12-section report w/ NO_TRADE suppression, CFTC live fallback status, `/api/reports/institutional` & `/api/metrics` | **PASS** | 22ms |
| 27 | Portfolio Stress Matrix & Critical Alert Governance | `portfolioScannerEngine.ts`, `notificationService.ts`, `server.ts` | 4-scenario stress matrix w/ bullion separation, `CRITICAL` dedupe bypass, SHA-256 webhook seal & PII redaction | **PASS** | 18ms |
| 28 | Calibration Suppression HTTP & EIA v2 Fallback | `forecastScorecardEngine.ts`, `commodityFundamentalsEngine.ts`, `server.ts` | HTTP `/api/forecast/scorecard` suppresses calibration when `N<30`; `WTI_OIL` EIA v2 fallback status | **PASS** | 19ms |
| 29 | Quote & OHLC Candle Series Integrity (§4.4) | `marketData.ts` | Validates crossed bid>ask, negative spread, stale FRESH claims, duplicate/out-of-order/OHLC/volume violations | **PASS** | 11ms |
| 30 | Immutable Forecast Lifecycle State Machine (§8.2) | `forecastAccountability.ts` | `DRAFT->VALIDATED->PUBLISHED->SUPERSEDED` flow, tamper detection error, illegal state skip rejection | **PASS** | 14ms |
| 31 | Uniform Prompt Injection & `/api/forecast/lifecycle` RBAC | `server.ts`, `aiGovernanceEngine.ts` | Rejects injection on `/api/ai/chat` & `/api/ai/search-grounding` (`400`), enforces `401/201/409` on lifecycle API | **PASS** | 21ms |
| 32 | Advisory Abstention (§4.4), 8-Check Gate & AI Eval Harness | `advisoryEngine.ts`, `llmPlatform.ts`, `aiGovernanceEngine.ts`, `server.ts` | Forces `isAbstained=true` on crossed/QUALITY_HOLD quotes; blocks MT5/guaranteed copy (`422`); 8/8 `GET /api/ai/eval` pass (`200`) | **PASS** | 19ms |
| 33 | FRED `DFII10` Live Sync & `aiEvalLastRun` Telemetry | `commodityFundamentalsEngine.ts`, `server.ts` | Parses official FRED `DFII10` CSV, degrades cleanly on timeout, supports `personaId` alias, records `aiEvalLastRun` in `/api/metrics` | **PASS** | 16ms |
| 34 | PostgreSQL Forecast/Editorial Repos & Fundamentals Scheduler | `postgresRepositories.ts`, `fundamentalsScheduler.ts`, `server.ts` | Parameterized SQL upsert/insert, TTL cache hits, `/health/ready`, `/api/auth/session-config`, `/api/fundamentals/refresh` RBAC | **PASS** | 18ms |
| 35 | SQL Migration Runner, Postgres Journal Repo & `/api/portfolio/journal` | `migrationRunner.ts`, `postgresRepositories.ts`, `server.ts` | SHA-256 checksum tracking & drift block, `loadAllForecasts`, `PostgresPaperJournalRepository`, `SELL` directional PnL & HTTP persistence | **PASS** | 21ms |
| 36 | Dynamic Scorecard Merge, `/api/forecast/evaluate` & Expanded AI Guards | `forecastScorecardEngine.ts`, `aiGovernanceEngine.ts`, `server.ts` | Merges live `ForecastLifecycleRecord`s into scorecard (`N>=30` calibration unlock), Stop-First OHLC transition API, role/base64 injection blocks | **PASS** | 20ms |
| 37 | Forecast Lifecycle Scorecard Mapping & Live Endpoint Ledger | `forecastScorecardEngine.ts`, `server.ts` | Validates `mapLifecycleRecordToAudited` transitions (`TARGET_REACHED`, `STOP_REACHED`, `INVALIDATED`, `ACTIVE`, `DRAFT` exclusion) & `/api/forecast/scorecard` merge | **PASS** | 15ms |
| 38 | Notification Secret Masking & Prometheus OpenMetrics Endpoint | `notificationService.ts`, `server.ts` | Masks `telegramBotToken` & `webhookUrl` secrets cleanly, preserves credentials on masked saves, and serves Prometheus v0.0.4 `/api/metrics/prometheus` | **PASS** | 12ms |

---

## 2. Auth & Access Control Suite (`tests/authAndAccess.test.ts`)

| Test # | Test Name | Verification Assertion | Status | Duration |
|:---:|:---|:---|:---:|:---:|
| 1 | Persona Validation | Demo personas (GUEST, FREE, PRO, ALPHA) validated with correct entitlement roles | **PASS** | 6ms |
| 2 | RBAC Access Control Evaluation | GUEST blocked from pro workspaces; FREE limited to 3 unlocks; PRO/ALPHA unlocked | **PASS** | 12ms |
| 3 | Social & Credential Login | Simulated OAuth flows produce authenticated sessions with user metadata | **PASS** | 9ms |
| 4 | Customer Onboarding Questionnaire | Form captures horizon, broker, account size, and profile flags | **PASS** | 11ms |
| 5 | Instant Persona Switching | Allows instantaneous state transition between tiers in testing/audit mode | **PASS** | 7ms |

---

## 3. Value-First Monetization Suite (`tests/monetization.test.ts`)

| Test # | Test Name | Verification Assertion | Status | Duration |
|:---:|:---|:---|:---:|:---:|
| 1 | Initial State & Welcome Credits | New accounts initialized with 5 welcome signal credits | **PASS** | 5ms |
| 2 | Unlocking Plan with Active Guarantee | Deducts 1 credit; registers trade plan in active monitoring ledger | **PASS** | 8ms |
| 3 | 100% Stop-Loss Signal Credit Refund | Price breach of stop loss before Target 1 automatically refunds credit (Non-Cash) | **PASS** | 10ms |
| 4 | Broker Rebate Sponsorship | Linking partner broker (IC Markets/Pepperstone) unlocks Pro tier | **PASS** | 7ms |
| 5 | Stripe Checkout Pack Purchases | Purchasing Starter ($9/25c), Trader ($29/100c), or Alpha upgrades credits | **PASS** | 11ms |
| 6 | Idempotent Webhook Replay Defense | Replayed webhook with identical `event.id` returns DUPLICATE_IGNORED | **PASS** | 9ms |
| 7 | Enterprise Session Token Verification | Active token returns valid; expired or tampered token returns invalid | **PASS** | 10ms |
| 8 | Auditable Credit Ledger & Durable Webhook Adapter | Enforces `beforeBalance + deltaCredits === afterBalance`, zero-balance guard, and restart deduplication | **PASS** | 12ms |
| 9 | Fail-Closed Token, Stripe HMAC-SHA256 & Server RBAC | Rejects forged bearer tokens, validates `Stripe-Signature` HMAC & replay bounds, enforces server tier checks | **PASS** | 8ms |
| 10 | Fixed-Window Rate Limiter & Log Redaction | Enforces per-client request quotas with `Retry-After` and redacts Bearer/API keys/secrets | **PASS** | 6ms |
| 11 | Live HTTP Server RBAC Middleware (`401/403/200`) | Enforces fail-closed bearer tier checks (`requireServerRole`) across protected `/api/*` endpoints | **PASS** | 11ms |
| 12 | Server Double-Entry Credit Ledger & HTTP RBAC | Persists `ServerCreditLedgerEntry[]` (`beforeBalance + deltaCredits === afterBalance`) & enforces `401/403/200` on `/api/billing/ledger` | **PASS** | 13ms |
| 13 | Signed Session Tokens, Production Lockout & Tenant Isolation | Verifies HMAC-signed `aurum_v1.` tokens, rejects tampered/production-unsigned tokens, enforces `FREE` tenant isolation (`403`) | **PASS** | 15ms |
| 14 | Client Signed Bearer Cache & Expiry Alignment | Verifies `authService.ts` caches/prefers `aurum_v1.` tokens per role/uid and clears cleanly on logout | **PASS** | 9ms |
| 15 | PostgreSQL Billing Hydration & Production CORS Allowlist | Verifies `PostgresBillingRepository` write-through/reboot replay block & strict `evaluateCorsOrigin` fail-closed prod allowlist | **PASS** | 14ms |
| 16 | OIDC/JWKS RS256 JWT Verification & Strict CSP Headers | Verifies asymmetric RSA-2048 OIDC JWT verification (`sub`, `iss`, `aud`, `aurum_tier`), tampered/wrong-aud fail-closed checks, and strict CSP directives | **PASS** | 16ms |
| 17 | HTTP CORS Preflight Headers & Client PKCE S256 / OIDC Bearer Contract | Verifies `OPTIONS` CORS `204` + `Vary: Origin`, WebCrypto RFC 7636 S256 challenge generation, OIDC compact JWT precedence, and iframe-safe CSP headers | **PASS** | 12ms |
| 18 | OIDC PKCE Token Exchange Route & Callback State Guard | Verifies `POST /api/auth/oidc-exchange` `400`/`501` fail-closed bounds and `completeOidcPkceCallback` CSRF state mismatch rejection | **PASS** | 11ms |
| 19 | OIDC Callback Missing Verifier Bounds, Notification Config RBAC & Broker Copy | Verifies empty PKCE callback error handling, `POST /api/notifications/config` `401`/`403` JSON error contract, and `BROKER_PARTNERS` Partner-Sponsored copy | **PASS** | 10ms |
| 20 | Market Data & LLM Config RBAC + UI Compliance Hygiene | Verifies `POST /api/market-data/config` & `/api/llm/settings` `401`/`403` JSON error contracts, zero decorative `<Sparkles>` icons, and `PaywallGateModal` non-cash wording | **PASS** | 12ms |
| 21 | Modal Dialog WCAG Accessibility & Escape Dismissal | Verifies `role="dialog"`, `aria-modal="true"`, `aria-labelledby`, and `Escape` key handler across `AuthModal`, `StripeCheckoutModal`, and `PaywallGateModal` | **PASS** | 8ms |
| 22 | Operational Diagnostic Endpoints RBAC & Auth Telemetry | Verifies `401`/`403`/`200` RBAC + rate limiting on `/api/market-data/test-connection`, `/api/notifications/test`, `/api/llm/test` & `aurum_auth_denied_total` telemetry | **PASS** | 11ms |

---

## 4. Verification Summary
- **Total Test Suites Executed:** 3 (`tests/multiCommodity.test.ts`, `tests/authAndAccess.test.ts`, `tests/monetization.test.ts`)
- **Total Test Blocks Verified:** **65** (38 + 5 + 22)
- **Typecheck (`tsc --noEmit`) & Build (`vite build`):** 0 errors
- **Pass Rate:** **100.0% (65 passed, 0 failed, 0 skipped)**

