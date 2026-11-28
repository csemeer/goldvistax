# Aurum Intelligence (GoldVista) — Platform Completion Report
**Institutional Precious Metals & Multi-Commodity Market Intelligence Platform**  
**Document Reference:** `GVR-PHASE-COMPLETION-2026-Q4-REV2`  
**Date of Report:** November 24, 2026  
**Platform Version:** `v1.8.0-INSTITUTIONAL-COMPLETE`  
**Classification:** Production Architecture, Functional Inventory & Verification Audit

---

## 1. Executive Summary

This updated completion report documents the full functional, architectural, quantitative, security, multi-user isolation, and user-experience capabilities delivered across **Aurum Intelligence (GoldVista)** through **November 24, 2026 (`v1.8.0-INSTITUTIONAL-COMPLETE`)**.

Originally engineered as a single-asset gold advisory terminal (`v1.4.0`), the platform has evolved into a **multi-commodity quantitative intelligence, simulation, risk governance, and alerting platform** covering **Gold, Silver, WTI Crude Oil, and Brent Crude Oil** alongside **DXY, US 10Y Treasury Yields, and US 10Y TIPS Real Yields**.

### Major Milestones Delivered Through Current Release:
1. **Multi-Commodity & 5-Year Real Historical Engine:** Spot, dynamic forward strip futures (`GC_FUT`, `SI_FUT`, `CL_FUT`, `BZ_FUT`), CFDs, and ETFs (`GLD`, `SLV`, `USO`, `BNO`) with quote/OHLC validation (§4.4), delayed-feed degradation gating, and 5-year multi-timeframe charting (`M5`–`1W`).
2. **Dynamic Multi-Horizon Advisory & Institutional PDF Plans:** Live directional setups (`BUY`, `SELL`, `HOLD`, `NO_TRADE`) across Intraday, Swing, and Long-Term horizons with limit corridors, structural invalidation rules, Next Setup Countdown tickers, risk-calculated lot sizing, 1-click **Paper Execute**, and **One-Page Institutional PDF Export**.
3. **Interactive Chart Terminal & Market Structure Overlays:** `CandleChart` with toggleable Smart Annotations, News Catalyst filters, Visual Liquidity Sweep markers, Historical Analog Macro Regime overlays, and Historical Year Comparison overlays (e.g., 2008, 2020).
4. **Quantitative Strategy Lab, Subscriptions & Walk-Forward Backtester:** 10 canonical strategies with per-user **Strategy Alert Subscriptions** (automated live indicator evaluation & push dispatch), Walk-Forward In-Sample optimization / Out-of-Sample validation, Circular Block Bootstrap Monte Carlo simulations, and an L2 Order Book Depth Execution Simulator.
5. **Isolated Portfolio Journal, Auto-Paper Pilot & Contra-Advisory Reconciliation:** Strict per-user server-persisted paper trading journal featuring a clear **Current Portfolio Location & Position Status** banner, **Focused Position Inspector**, live open-position exposure indicators across desktop/mobile navigation, **Autonomous Auto-Paper Pilot**, live **Contra-Advisory Contradiction Detection & Reconciliation**, automated 1% ghost-trade cleanup, mandatory close confirmation dialogs, and a **Historical Trade Plan Performance** ledger comparing triggered plans against live prices.
6. **Performance Insights Workspace & Forensic Analytics (Recharts + D3):** Dedicated `Performance Insights` workspace plus deep portfolio analytics covering Win/Loss ratio, Cumulative & Compound ROI, Trade Duration buckets, Daily P&L progression, Horizon Performance Heatmaps, MAE, Hit Stop-Loss Concentration, Trade Expectancy Monte Carlo projections, Sharpe/Sortino/Drawdown metrics, and D3 30-day rolling correlations.
7. **Unified Real-Time Alerting & Chronological Strategy Feed:** Per-user **Trade & Position Alerts** center (global toast with **Inspect Position**, Navbar alert bell history, optional Browser Push API, and Telegram/Discord/Slack webhook dispatch) covering every trade open/close path, plus a chronological **Strategy Alert Feed** widget in the sidebar and Alerts workspace with instant chart and portfolio jumps.
8. **Multi-Agent AI Council, Governance & Official Macro Sync:** 4-agent deliberative Council with QE cycle overlay, live CFTC COT (`6dca-aqww`), FRED (`DFII10`), and EIA v2 ingestion, `CanonicalDecisionObject` `NO_TRADE` scanner, 8-check §7.5 Publication Gate, prompt-injection sanitization, 8-scenario Golden AI Evaluation Harness, and 12-section Institutional Dossiers with branded PDF export.
9. **Enterprise Security, Auth Continuity & Tier-vs-Identity Separation:** Sign-Up / Sign-In / Sign-Out flows across Landing, Navbar, Sidebar, and Mobile Drawer; OIDC/PKCE S256 & RS256/ES256 JWKS verification; HMAC-SHA256 `aurum_v1.` session tokens; UID-scoped fallback tokens; fail-closed `requireServerRole` HTTP RBAC; double-entry Stripe webhook credit ledger; and clear separation between **in-place Plan Tier updates** (preserving user UID/trades) and **Demo User switching**.

---

## 2. System Architecture & Module Directory

```
┌──────────────────────────────────────────────────────────────────────────────────────────────────────────┐
│                                        CLIENT TERMINAL & PUBLIC WEB                                      │
├───────────────────────────────────────────────────────┬──────────────────────────────────────────────────┤
│ Public Landing & Enrollment (`LandingPage.tsx`)       │ Responsive Terminal Shell (`App.tsx`)            │
│ · Live COMEX/LBMA tickers & Execution Corridor SVG    │ · Command Palette (`Ctrl/Cmd+K`) & Fit Mode      │
│ · Interactive 18.2x Net ROI Value Calculator          │ · `WorkspaceErrorBoundary` fault isolation       │
│ · Password Sign-Up / Sign-In / Active Sign-Out        │ · Open Positions live pill & Trade Alert Bell    │
│                                                       │ · Mobile 44px touch bottom dock & drawer         │
└───────────────────────────┬───────────────────────────┴────────────────────────┬─────────────────────────┘
                            │                                                    │
                            ▼                                                    ▼
┌───────────────────────────────────────────────────────┐ ┌────────────────────────────────────────────────┐
│ IDENTITY, RBAC & MULTI-USER ISOLATION                 │ │ 23 ROLE-GATED WORKSPACES (`Sidebar.tsx`)       │
│ · Auth: Google, Apple, Telegram, Discord, Email+Pass  │ │ · Core: Overview, Live 5Y Terminal, Technical    │
│ · OIDC PKCE (S256) + HMAC `aurum_v1.` + UID tokens    │ │ · Horizons: Intraday, Swing, Long-Term, CFD      │
│ · `updateCurrentUserTier`: keeps UID & private trades │ │ · Quant/Macro: News, Scenarios, Macro, Lab, WFA  │
│ · `switchPersona`: explicit sandbox Demo User preview │ │ · Ops: Portfolio, Performance Insights, Reports, │
│ · Roles: GUEST (0) ─► FREE (1) ─► PRO (2) ─► ALPHA (3)│ │   Council AI, Gemini Chat, Alerts, Billing, LLM  │
└───────────────────────────┬───────────────────────────┘ └────────────────────────┬───────────────────────┘
                            │                                                    │
                            ▼                                                    ▼
┌──────────────────────────────────────────────────────────────────────────────────────────────────────────┐
│                                 QUANTITATIVE, ADVISORY & PORTFOLIO ENGINES (`src/services/`)              │
├──────────────────────────┬───────────────────────────┬───────────────────────────┬───────────────────────┤
│ Market & Macro Data      │ Advisory, AI & Forecasts  │ Quant, Risk & Analytics   │ Billing & Alerting    │
│ · Multi-Commodity Quotes │ · Multi-Horizon Plans     │ · 10 Quant Strategies     │ · Double-Entry Ledger │
│ · 5Y Yahoo/Cache Candles │ · `NO_TRADE` Scanner      │ · WFA + L2 Order Sim      │ · Stripe HMAC Engine  │
│ · CFTC COT / FRED / EIA  │ · 4-Agent AI Council      │ · Portfolio Forensics/ROI │ · Non-Cash SL Refunds │
│ · Quote/Candle Validator │ · Scorecard & OHLC Eval   │ · Contra-Advisory Engine  │ · Per-User TradeAlert │
└──────────────────────────┴─────────────┬─────────────┴───────────────────────────┴──────────┬────────────┘
                                         │                                                    │
                                         ▼                                                    ▼
┌──────────────────────────────────────────────────────────────────────────────────────────────────────────┐
│                     NODE/EXPRESS API, SECURITY & PERSISTENCE (`server.ts`, `src/db/`)                    │
├──────────────────────────────────────────────────────────────────────────────────────────────────────────┤
│ · `serverSecurity.ts`: Fail-closed RBAC (`requireServerRole`), Fixed-Window Rate Limiter,                │
│   Strict `ALLOWED_ORIGINS` CORS, CSP + iframe `frame-ancestors`, Secret Redaction, OIDC/JWKS             │
│ · Persistence: Optional PostgreSQL repositories (`src/db/postgresRepositories.ts` + `migrations/001–002`)│
│   with atomic file-backed durable fallbacks for journal, forecast lifecycle, editorial & credit ledgers  │
│ · Telemetry: JSON `/api/metrics`, Prometheus v0.0.4 `/api/metrics/prometheus`, `/health/live` & `/ready` │
└──────────────────────────────────────────────────────────────────────────────────────────────────────────┘
```

### 2.1 UI Component Directory (`49` Components in `src/components/`)
| Domain | Components |
|---|---|
| **Shell, Navigation & Auth** | `Navbar.tsx`, `Sidebar.tsx`, `LandingPage.tsx`, `AuthModal.tsx`, `AccessGateGuard.tsx`, `CommandPaletteModal.tsx`, `WorkspaceErrorBoundary.tsx` |
| **Charts & Technical Execution** | `CandleChart.tsx`, `TradePlanCard.tsx`, `CFDCalculator.tsx`, `StrategyBiasRationalePanel.tsx`, `TradeVolumeProfileWidget.tsx` |
| **Portfolio, Execution & Forensics** | `PortfolioJournalWorkspace.tsx`, `PerformanceInsightsWorkspace.tsx`, `AutoPaperPilotPanel.tsx`, `HistoricalTradePlanPerformancePanel.tsx`, `RiskMetricsDashboard.tsx`, `HorizonPerformanceHeatmap.tsx`, `HorizonWinRateTrendChart.tsx`, `TradeHistoryTimelineChart.tsx`, `DailyProfitLossChart.tsx`, `DailyPortfolioRoiChart.tsx`, `MaximumAdverseExcursionChart.tsx`, `StopLossConcentrationHeatmap.tsx`, `TradeExpectancyDistributionChart.tsx`, `TradeExpectancyProjectionWidget.tsx`, `TradeSuccessRateGauge.tsx`, `TradeCorrelationMatrixPanel.tsx`, `RollingCorrelationD3Panel.tsx` |
| **Strategy, Macro & AI Council** | `StrategyLabWorkspace.tsx`, `BacktestingWorkspace.tsx`, `NewsSentimentWorkspace.tsx`, `HistoricalScenariosWorkspace.tsx`, `MacroWorkspace.tsx`, `CrossCommoditySpreadsPanel.tsx`, `CouncilWorkspace.tsx`, `InstitutionalSentimentGauge.tsx`, `InstitutionalQueuePanel.tsx`, `QeCycleOverlayPanel.tsx`, `GeminiChatbot.tsx`, `LLMSettingsWorkspace.tsx` |
| **Alerts, Reporting & Monetization** | `AlertsWorkspace.tsx`, `StrategyAlertFeedWidget.tsx`, `NotificationSettingsWorkspace.tsx`, `MarketDataConfigWorkspace.tsx`, `ReportsWorkspace.tsx`, `MonetizationWorkspace.tsx`, `PaywallGateModal.tsx`, `StripeCheckoutModal.tsx` |

### 2.2 Core Service & Database Directory (`32` Services in `src/services/` + `src/db/`)
- **Market & Fundamentals:** `commodityRegistry.ts`, `marketData.ts`, `marketDataProvider.ts`, `realHistoricalProvider.ts`, `historicalDataEngine.ts`, `macroData.ts`, `commodityFundamentalsEngine.ts`, `fundamentalsScheduler.ts`, `newsSentimentEngine.ts`, `historicalScenariosEngine.ts`, `cotIntelligence.ts`, `crossCommoditySpreads.ts`, `futuresOptionsEngine.ts`.
- **Advisory, AI & Accountability:** `advisoryEngine.ts`, `decisionIntelligenceEngine.ts`, `aiGovernanceEngine.ts`, `llmPlatform.ts`, `forecastAccountability.ts`, `forecastScorecardEngine.ts`, `institutionalReportEngine.ts`, `pdfReportExporter.ts`, `institutionalQueueEngine.ts`.
- **Quant, Portfolio, Alerts & Commercial:** `indicators.ts`, `strategyEngine.ts`, `advancedBacktestingEngine.ts`, `riskEngine.ts`, `portfolioScannerEngine.ts`, `tradeAlertService.ts`, `notificationService.ts`, `authService.ts`, `monetizationEngine.ts`, `billingWebhookEngine.ts`.
- **Database & Migrations (`src/db/`, `migrations/`):** `postgresRepositories.ts` (`PostgresBillingRepository`, `PostgresForecastRepository`, `PostgresEditorialRepository`, `PostgresPaperJournalRepository`, `InMemorySqlMockExecutor`), `migrationRunner.ts`, `001_initial_postgresql_schema.sql`, `002_paper_journal_positions.sql`.

---

## 3. Complete Functionalities & Facilities Matrix

### 3.1 Multi-Commodity Real-Time & 5-Year Historical Data Engine
- **Supported Instruments:**
  - **Precious Metals:** Gold (`XAUUSD` Spot, dynamic forward `GC_FUT`, Gold CFD, `GLD` ETF) and Silver (`XAGUSD` Spot, dynamic forward `SI_FUT`, Silver CFD, `SLV` ETF).
  - **Energy:** WTI Crude (`WTI_SPOT`, dynamic forward `CL_FUT`, WTI CFD, `USO` ETF) and Brent Crude (`BRENT_SPOT`, dynamic forward `BZ_FUT`, Brent CFD, `BNO` ETF).
  - **Macro Anchors:** US Dollar Index (`DXY`), US 10Y Nominal Yield (`US10Y`), and US 10Y TIPS Real Yield (`US_TIPS10Y`).
- **Feed Health & Validation (§4.4):** Validates live quotes and OHLC candle series for timestamp freshness, finite bounds, bid/ask inversion, and gap consistency; classifies feed quality as `FRESH`, `DEGRADED` (including configurable `allowDelayed` quotes under 900s), or `STALE`.
- **Connectivity Workspace:** `MarketDataConfigWorkspace.tsx` supports configuring primary/fallback providers (Yahoo Finance, IBKR Gateway, Alpaca, Simulated Benchmark), testing connections with live diagnostics, and surfacing `PRO` RBAC errors clearly.

### 3.2 Multi-Horizon Trade Advisory, Decision Scanner & Plan Tools
- **Dynamic Directional Advisories (`advisoryEngine.ts` `v1.5.0-DYN-DIR`):** Evaluates live trend, momentum, RSI, MACD, Supertrend, and macro alignment across Intraday (`M5`–`H1`), Swing (`H4`–`D1`), and Long-Term (`W1`–`MN`) horizons to emit structured `BUY`, `SELL` (mirrored stop/target geometry), `HOLD`, or `NO_TRADE` plans.
- **Deterministic Abstention & Opportunity Scanner:** Forces `NO_TRADE` / `DATA_QUALITY_HOLD` when feeds are `STALE` or criteria fail; `DECISION_SCANNER` tab exposes normalized `CanonicalDecisionObject` rankings (`decisionIntelligenceEngine.ts`).
- **Tactical `TradePlanCard` Capabilities:**
  - **Next Setup Countdown Ticker:** Dynamic timer (`estimateNextSetupCountdown`) computed from live RSI & volume momentum cycles (`READY`, `IMMINENT`, `ACCELERATING`, `CONSOLIDATING`, `HOLD_ABSTAINED`).
  - **Integrated Risk Sizing & 1-Click Paper Execute:** Interactive Account Size ($) and Risk (%) inputs compute suggested position size (`suggestedSize`) and projected SL / TP1 / TP2 / TP3 dollar P&L, then forward the exact calculated lot size straight into **Paper Execute (`0.XX L`)**.
  - **Strategy Bias Rationale Panel:** Expandable directional logic breakdown (`StrategyBiasRationalePanel.tsx`) showing technical triggers and causal sentiment contributors.
  - **One-Page Institutional PDF Export:** Generates a formatted one-page PDF summary (`buildTradePlanOnePagePdf` in `pdfReportExporter.ts`) containing technical rationale, entry/stop/target parameters, risk projections, and an integrity SHA-256 snapshot hash.

### 3.3 Interactive Financial Terminal & Chart Overlays (`CandleChart.tsx`)
- **Multi-Timeframe Resolution:** `M5` through `1W` candlesticks backed by 5-year continuous real historical datasets (`/api/market/history`).
- **Global Smart Annotations Toggle:** Show or hide algorithmic structure labels, limit corridors, and pivot levels cleanly.
- **News Catalyst Filter:** Overlay and filter high-impact macro/news catalyst events directly along chart timestamps.
- **Visual Liquidity Sweep Markers:** Highlight institutional stop-hunt / liquidity sweep wicks and reclaim zones.
- **Historical Analog & Year Comparison Overlays:** Project historical macro regime trajectories and side-by-side historical year series (e.g., 2008, 2020 via `/api/market/historical-analog`) over live price action.
- **Direct Chart Deep Links:** Clicking **"View Chart Setup"** from the Strategy Alert Feed opens the terminal directly on that instrument, timeframe, and highlighted setup corridor.

### 3.4 Quantitative Strategy Lab, Alert Subscriptions & L2 Backtesting
- **10 Canonical Quantitative Strategies:** Multi-factor trend, opening range breakout, mean reversion, COT institutional flow, MTF Supertrend confluence, session hand-off, real-yield divergence, adaptive ATR scalping, Fibonacci pullback, and adversarial stop-hunt reversal.
- **Strategy Alert Subscriptions (`StrategyLabWorkspace.tsx` + `strategyEngine.ts`):** Users (`PRO`/`ALPHA`) can toggle per-strategy push alert subscriptions synced with `/api/alerts/strategy-subscriptions`; the engine automatically evaluates live indicators (`evaluateStrategyEntryCriteria` / `evaluateAllSubscribedStrategyAlerts`) and triggers multi-channel push dispatches when entry criteria align.
- **Walk-Forward Backtesting & L2 Simulator (`BacktestingWorkspace.tsx` + `advancedBacktestingEngine.ts`):**
  - Per-fold In-Sample EMA grid optimization with untouched Out-of-Sample walk-forward evaluation.
  - Circular Block Bootstrap Monte Carlo drawdown/expectancy modeling.
  - **L2 Order Book Depth Execution Simulator (`POST /api/strategies/execution-simulator`):** Models limit vs. market fill probability, bid-ask spread slippage, and partial depth fills across order sizes.

### 3.5 Portfolio & Journal Workspace, Auto-Pilot & Advisory Alignment
- **Clarity-First Navigation & Position Inspector (`PortfolioJournalWorkspace.tsx`):**
  - Defaults to **`01. Execution & Positions`** (with `02. Performance & ROI` and `03. Risk & Forensics` tabs) so clicking **Portfolio & Journal** or any open position pill immediately displays **Active Paper Positions** at the top without scrolling past analytics.
  - **Current Portfolio Location & Position Status** orientation banner displays breadcrumb path, active user & tier, Open/Closed counts, net directional exposure (`Net Long` / `Net Short` / `Flat`), and live MTM unrealized P&L.
  - **Focused Position Inspector (`#focused-position-inspector`)** waits for canonical per-user hydration before scrolling to and highlighting a target trade with entry, live price, SL/TP, unrealized P&L, contra-advisory status, and a 1-click **Close Position** action.
  - **Always-On Exposure Indicators:** Live `N Open (+$...)` button in `Navbar.tsx`, `N Open` pill in `Sidebar.tsx`, and `Positions (N)` label on the mobile bottom dock.
- **Quick Simulated Order Entry & Plan Sizing:** Pre-fills calculated lot size from `TradePlanCard` and provides an editable **Lot Size** input alongside SL/TP controls.
- **Autonomous Auto-Paper Pilot (`AutoPaperPilotPanel.tsx`):** Automated simulated execution monitoring live tactical plans with configurable sizing and risk guardrails.
- **Open Positions vs. Live Advisory Reconciliation:** Detects open trades whose direction contradicts the current live advisory bias (`CONTRA_ADVISORY`), surfaces clear reconciliation warnings, and supports 1-click position exit or protective SL adjustment (`evaluatePositionAdvisoryAlignment`).
- **Safety & Hygiene Guardrails:**
  - **Mandatory Close Trade Confirmation Dialog** preventing accidental position liquidations.
  - **Automated 1% Deviation Ghost-Trade Cleanup** pruning stale/divergent simulated fills.
- **Historical Trade Plan Performance Tab (`HistoricalTradePlanPerformancePanel.tsx`):** Lists past triggered trade plans alongside their **Success / Failure / Active** outcome compared against live spot prices, filterable by horizon, outcome, source, and keyword search.

### 3.6 Performance Insights Workspace & Portfolio Forensics (Recharts + D3)
- **Dedicated `Performance Insights` Workspace (`PerformanceInsightsWorkspace.tsx`):** Interactive Recharts suite strictly scoped per user visualizing:
  - **Win / Loss Ratio** (Overall Donut & By-Horizon Bar breakdown)
  - **Cumulative & Compound ROI Over Time** (Area charts with horizon & scope filters)
  - **Average Trade Holding Duration** (By Horizon & Duration Bucket distributions)
- **Embedded Portfolio Forensics (`02. Performance & ROI` & `03. Risk & Forensics`):**
  - **Daily Profit/Loss & Account Balance Progression** (`DailyProfitLossChart.tsx`)
  - **Daily Portfolio ROI (%) & Compound Growth** (`DailyPortfolioRoiChart.tsx`)
  - **Win Rate vs. Time** (`HorizonWinRateTrendChart.tsx`)
  - **Chronological Trade History Timeline & Post-Mortem** (`TradeHistoryTimelineChart.tsx`)
  - **Advisory Horizon Performance Heatmap & Audit CSV Export** (`HorizonPerformanceHeatmap.tsx`)
  - **Account Risk Metrics Dashboard** (`RiskMetricsDashboard.tsx` — Max Drawdown, Sharpe, Sortino, Recovery Factor)
  - **Maximum Adverse Excursion (MAE) & Stop-Loss Efficiency** (`MaximumAdverseExcursionChart.tsx`)
  - **Hit Stop-Loss Concentration Heatmap** (`StopLossConcentrationHeatmap.tsx`)
  - **Trade Expectancy Distribution & Monte Carlo Projection** (`TradeExpectancyDistributionChart.tsx`, `TradeExpectancyProjectionWidget.tsx`)
  - **Trade Success Rate Gauge & Strategy Feedback** (`TradeSuccessRateGauge.tsx`)
  - **D3 Rolling 30-Day Correlation & Trade Correlation Matrix** (`RollingCorrelationD3Panel.tsx`, `TradeCorrelationMatrixPanel.tsx`)
  - **Economic Cycle Date-Range Filtering:** Month, Quarter, and Custom Date filters across forensic series.

### 3.7 Real-Time Trade Alerts, Chronological Strategy Feed & Multi-Channel Webhooks
- **Trade Open & Close Lifecycle Alerts (`tradeAlertService.ts` + `/api/alerts/trade-lifecycle`):**
  - Automatically fires on **all** entry and exit paths (`PLAN_CARD`, `MANUAL`, `AUTO_PILOT`, `SL_TP_TRIGGER`, `CONTRA_RECONCILE`, `SYNC_CLEANUP`, and bulk close).
  - Surfaces a floating toast notification with an **Inspect Position →** CTA, updates the **Trade & Position Alerts** bell dropdown in the top bar (scoped per user), fires optional browser desktop `Notification` alerts, and dispatches critical events to server webhooks.
- **Chronological Strategy Alert Feed (`StrategyAlertFeedWidget.tsx`):** Available in both the collapsible **Sidebar** widget and full **Alerts & Health** workspace; chronologically streams live-triggered, active, and historical strategy alerts with 1-click **"Chart Setup"** and **"Portfolio"** jumps.
- **Quantitative Market & Risk Alert Monitors (`AlertsWorkspace.tsx`):**
  - **Custom Per-User XAU/USD RSI Level Alerts** (scoped to `aurum_custom_rsi_alerts_v1:${userId}`).
  - **ATR Volatility Breakout (>2.5σ over 14D ATR)**.
  - **Rolling 30-Day XAU/USD × DXY Correlation Deviation**.
  - **XAU/USD × 10Y Yield (>0.50) Risk-On/Off Push Toggle**.
  - **S&P GSCI Commodity Correlation Monitor**.
- **Notification Pipeline (`notificationService.ts`):** Telegram, Discord, Slack, and Generic webhooks with `sha256=` HMAC payload sealing, PII stripping, `isCriticalStateChange` dedupe bypass, and masked webhook URL persistence (`NotificationSettingsWorkspace.tsx`).

### 3.8 Multi-Agent AI Council, Gemini Research Chat & AI Governance
- **4-Agent AI Advisory Council (`CouncilWorkspace.tsx`):** Deliberative consensus across Macro Yields, Technical Structure, Order Flow/Liquidity, and Geopolitical Risk agents, plus **CFTC COT Gold Sentiment Gauge** (live `6dca-aqww` feed + curated fallback), **Institutional Order Queue Indicator**, and **Historical QE Liquidity Cycle Overlay** (`QeCycleOverlayPanel.tsx`).
- **Gemini AI Research Analyst (`GeminiChatbot.tsx` & `NewsSentimentWorkspace.tsx`):** Server-side proxied Gemini analysis with Search Grounding, uniform `sanitizeUntrustedInput()` prompt-injection defense, and strict HTTP error alerting.
- **8-Check Publication Gate & Golden AI Evaluation Harness (`llmPlatform.ts` & `aiGovernanceEngine.ts`):** Blocks certainty/execution hype, missing risk disclaimers, or stale data (`HTTP 422`), and runs an 8-scenario executable governance test suite (`GET /api/ai/eval`).

### 3.9 Macroeconomic Fundamentals, Accountability & Institutional Dossiers
- **Live Fundamentals Ingestion (`commodityFundamentalsEngine.ts` & `fundamentalsScheduler.ts`):** Scheduled background sync with official St. Louis **FRED `DFII10`** real yields, **EIA Open Data API v2** WTI/Brent inventories, and **CFTC COT** positioning, with explicit source/proxy tagging.
- **Immutable Forecast Lifecycle & Scorecard (`forecastAccountability.ts`, `forecastScorecardEngine.ts`):** Non-overwriting forecast journal (`/api/forecast/lifecycle`), Stop-First OHLC outcome evaluator (`/api/forecast/evaluate`), Brier/MAE/RMSE scoring, and **statistical suppression (`sampleCount < 30`)** enforcement across scorecards and spreads.
- **12-Section Institutional Dossiers & Branded PDF Export (`institutionalReportEngine.ts`, `ReportsWorkspace.tsx`):** Enforces epistemic tags, suppresses Section 9 trade specs on `NO_TRADE` days, and exports verified multi-page institutional PDFs cleanly via Blob downloads (AI Studio iframe compatible).

### 3.10 Multi-User Auth, Strict Isolation & Plan-vs-Identity Clarity
- **Complete Onboarding & Session Controls:**
  - Social providers (Google, Apple, Telegram, Discord) and Email + Password (`AuthModal.tsx` & `LandingPage.tsx`) with duplicate-email rejection, password validation, and returning-user deterministic UID recovery.
  - Visible **Sign Up**, **Sign In**, and **Sign Out** controls across desktop Navbar, Sidebar footer, Mobile drawer, and Landing Page.
  - **OIDC PKCE (`S256`) & JWKS Verification:** Client `generatePkceVerifierAndChallenge` / `completeOidcPkceCallback` wired to `/api/auth/oidc-exchange`, plus asymmetric RS256/ES256 JWT verification in `serverSecurity.ts`.
- **In-Place Tier Updates vs. Demo Persona Switching:**
  - **`updateCurrentUserTier(role)`:** Upgrades/previews `FREE`, `PRO`, or `ALPHA` directly on the signed-in user while preserving exact `uid`, `email`, `displayName`, and private ledger—exposed under **"Your Plan Level (Keeps Your Trades)"** in the profile menu and `AccessGateGuard`.
  - **`switchPersona(role)`:** Separated explicitly under **"Switch to Demo User (Sample Data)"** (`Alex Vance`, `Marcus Chen`, `Elena Rostova`, `Guest Visitor`) for clean sandbox testing.
- **Strict Tenant Isolation:**
  - Both signed `aurum_v1.` tokens and fallback `aurum_sess_<role>_<exp>.uid_<uid>` tokens resolve distinct server `userId`s (`serverSecurity.ts`, `billingWebhookEngine.ts`).
  - `/api/portfolio/journal`, `/api/alerts/strategy-subscriptions`, `/api/alerts/strategy-trigger`, `/api/alerts/trade-lifecycle`, `/api/billing/ledger/:userId`, and client alert/RSI stores are strictly partitioned by `userId`. Switching accounts clears transient UI pointers and hydrates solely that account's server data.

### 3.11 Commercialization, Security & Observability
- **Hybrid 3-Pillar Monetization (`monetizationEngine.ts`, `MonetizationWorkspace.tsx`, `PaywallGateModal.tsx`, `StripeCheckoutModal.tsx`):**
  - Pay-per-trade Signal Credits (5 welcome + 3 daily free regens + bundles), SaaS subscriptions (`FREE`, `PRO`, `ALPHA`), and **Partner-Sponsored Pro** access via linked ECN broker accounts (IC Markets, Pepperstone, Tickmill).
  - **Non-Cash Signal Credit Stop-Loss Refund (`GAP-05` compliant):** Automatically credits back signal credits on SL hits prior to Target 1, recorded in an append-only auditable double-entry credit ledger (`CreditLedgerEntry[]` / `ServerCreditLedgerEntry[]`).
- **Hardened Billing & HTTP Security (`serverSecurity.ts`, `server.ts`):**
  - Raw-body `Stripe-Signature` HMAC-SHA256 verification and replay-proof idempotent webhook engine (`EnterpriseBillingEngine`).
  - `requireServerRole` fail-closed RBAC middleware (`401`/`403` on protected routes including diagnostics), `FixedWindowRateLimiter`, strict `ALLOWED_ORIGINS` CORS evaluation, CSP headers (`frame-ancestors` allowing AI Studio preview + opt-in `STRICT_FRAME_OPTIONS`), and secret log redaction (`Bearer`, `whsec_`, `AIzaSy`, Telegram bot tokens, `AQ.`).
  - Health & Metrics endpoints: `/health`, `/health/live`, `/health/ready`, `/api/metrics` (tracking `authDeniedCount`, AI eval, latency), and Prometheus `/api/metrics/prometheus` (`aurum_auth_denied_total`).

### 3.12 Platform Ergonomics, Navigation & Accessibility
- **Workspace Productivity:** Command Palette (`Ctrl/Cmd+K`), Sidebar quick filter & collapse toggle (`Ctrl/Cmd+B`), Fit-to-Screen mode, and per-workspace `WorkspaceErrorBoundary` isolation.
- **Mobile & Responsive UX:** `viewport-fit=cover`, `.pb-safe` bottom dock with `min-h-[44px]` touch targets, `overflow-x-hidden` layout discipline, and `tabular-nums` alignment across financial figures.
- **Accessibility (WCAG):** Skip navigation link, landmark semantics, `aria-pressed`/`aria-expanded`/`aria-current`/`aria-live`, `role="alert"` HTTP errors, modal `role="dialog"` + `aria-modal="true"` + `aria-labelledby` + `Escape` dismissal, `prefers-reduced-motion`, and zero decorative `<Sparkles>` or `animate-pulse` status dots.

---

## 4. Backend API Inventory (`server.ts`)

| Domain | Endpoints & Auth Tier |
|---|---|
| **Health & Telemetry** | `GET /health`, `GET /health/live`, `GET /health/ready`, `GET /api/metrics`, `GET /api/metrics/prometheus` (Public) |
| **Market Data & History** | `GET /api/market/quotes`, `GET /api/market/candles`, `GET /api/market/history`, `GET /api/market/historical-analog`, `GET /api/commodities`, `GET /api/market-data/status`, `GET /api/market-data/config` (Public) · `POST /api/market-data/config`, `POST /api/market-data/test-connection` (**`PRO`**) |
| **Advisory, Strategies & CFD** | `GET /api/advisory/plans`, `GET /api/advisory/agents`, `GET /api/decision/scan`, `GET /api/regime/current`, `GET /api/strategies`, `POST /api/strategies/backtest`, `POST /api/strategies/execution-simulator`, `POST /api/cfd/calculate`, `POST /api/advisory/publication-gate` (Public) |
| **News, Macro & Fundamentals** | `GET /api/news/evidence`, `GET /api/news/sentiment`, `GET /api/news/calendar`, `GET /api/scenarios`, `GET /api/analogues`, `GET /api/macro/data`, `GET /api/macro/correlations`, `GET /api/macro/cot-gold`, `GET /api/council/institutional-queue`, `GET /api/fundamentals/:commodity` (Public) · `POST /api/fundamentals/refresh` (**`PRO`**) |
| **Portfolio & Forecast Lifecycle** | `GET/POST /api/portfolio/journal` (**`FREE`**, user-isolated) · `POST /api/portfolio/stress-test` (Public) · `GET /api/forecast/scorecard`, `GET /api/forecast/lifecycle` (Public) · `POST /api/forecast/lifecycle`, `POST /api/forecast/evaluate` (**`PRO`**) |
| **Alerts & Notifications** | `GET /api/notifications/status`, `GET /api/notifications/config` (Public) · `POST /api/notifications/config`, `POST /api/notifications/test` (**`PRO`**) · `POST /api/alerts/atr-volatility`, `POST /api/alerts/correlation-deviation`, `POST /api/alerts/yield-correlation-breakout`, `POST /api/alerts/rsi-threshold`, `POST /api/alerts/gsci-correlation` (Public) · `GET/POST /api/alerts/strategy-subscriptions`, `POST /api/alerts/strategy-trigger` (**`PRO`**, user-isolated) · `GET/POST /api/alerts/trade-lifecycle` (**`FREE`**, user-isolated) |
| **AI, Editorial & Reports** | `GET /api/ai/governance`, `POST /api/ai/council`, `POST /api/ai/search-grounding`, `POST /api/ai/chat`, `GET /api/editorial/history`, `GET /api/reports/institutional`, `POST /api/reports/export-pdf`, `GET /api/llm/settings` (Public) · `POST /api/llm/settings`, `POST /api/llm/test`, `POST /api/editorial/publish` (**`PRO`**) · `GET /api/ai/eval` (**`ALPHA`**) |
| **Auth & Billing** | `GET /api/auth/session-config`, `POST /api/auth/sandbox-token`, `POST /api/auth/verify-session`, `POST /api/auth/oidc-exchange`, `POST /api/billing/webhook` (Stripe HMAC) · `GET /api/billing/entitlements/:userId`, `GET /api/billing/ledger/:userId` (**`FREE`**, tenant-checked) · `GET /api/billing/webhook/history`, `GET /api/billing/ledger` (**`PRO`**) |

---

## 5. Quality Assurance, Automated Verification & Build Status

### 5.1 Automated Test Suites (`120 / 120` Checks Passed)
1. **`tests/multiCommodity.test.ts` (`86 / 86` Passed):**
   - **Tests 1–40:** Multi-commodity registry & 5Y history, macro correlations, regime classification, forecast scorecard & `N<30` suppression, immutable forecast lifecycle & OHLC outcome evaluation, WFA optimization + Monte Carlo bootstrap, `NO_TRADE` scanner, 8-check Publication Gate, AI prompt-injection & eval harness, CFTC COT / FRED `DFII10` / EIA v2 live sync, PostgreSQL repository hydration & SQL migration runner, Prometheus metrics, startup env hydration, and dynamic `BUY`/`SELL`/`HOLD` plans.
   - **Tests 41–65:** Strategy bias rationale, historical analog & year comparison overlays, trade correlation matrix, ATR >2.5σ volatility alert, P&L & risk lot sizing, D3 30-day correlation divergence, MAE & stop-loss efficiency, expectancy distribution, volume profile, success rate gauge, DXY correlation deviation alert, QE liquidity overlay, economic cycle date-range filtering, Sharpe/Sortino drawdown metrics, COT sentiment gauge, institutional order queue, Monte Carlo projection, 10Y yield push toggle, CandleChart smart annotations / news catalysts / liquidity sweeps, custom RSI alerts, GSCI correlation monitor, and L2 Backtest Execution Simulator.
   - **Tests 66–86:** Institutional PDF research exporter, horizon performance heatmap & CSV audit export, chronological timeline, Recharts Win Rate / Daily P&L / Daily ROI charts, live close flow & multi-instrument P&L, mandatory close dialog, 1% ghost-trade cleanup, SL concentration heatmap, Auto-Paper Pilot, Next Setup Countdown ticker, Historical Trade Plan Performance tab, end-to-end shell/command palette/ErrorBoundary organization, Strategy Alert Subscriptions & live criteria trigger engine, TradePlanCard 1-page PDF export, multi-user isolation & entitlement scoping, open positions vs. live advisory contradiction reconciliation, Performance Insights Recharts workspace, and Chronological Strategy Alert Feed jump wiring.
2. **`tests/authAndAccess.test.ts` (`7 / 7` Passed):**
   - Persona definitions, RBAC access checks across all workspaces, social & email authentication, customer enrollment wizard, instant persona switching, persistent credential sign-up with duplicate rejection & returning-user UID recovery, and visible Sign-Out & Sign-Up controls across desktop and mobile components.
3. **`tests/monetization.test.ts` (`22 / 22` Passed):**
   - Welcome/daily credits, non-cash SL credit refund guarantee, broker partner Pro sponsorship, Stripe pack purchases, idempotent webhook replay defense, HMAC `aurum_v1.` & fallback token verification, fixed-window rate limiter & secret redaction, live HTTP RBAC `401`/`403`/`200` enforcement (including diagnostic routes & `authDeniedCount`), double-entry durable credit ledger, Postgres billing repository hydration, CORS allowlist, OIDC RS256 JWKS verification, PKCE `S256` `/api/auth/oidc-exchange`, CSP & iframe framing headers, WCAG modal accessibility, and UI compliance hygiene.
4. **`tests/portfolioAndAlerts.test.ts` (`5 / 5` Passed):**
   - Session token `.uid_<uid>` parsing with full legacy compatibility, in-place `updateCurrentUserTier` UID/profile preservation, per-user trade open/close lifecycle alert formatting & persistence, live HTTP multi-user isolation across `/api/portfolio/journal`, `/api/alerts/strategy-subscriptions`, and `/api/alerts/trade-lifecycle`, and UI wiring assertions for position clarity, alert center, and tier-vs-persona separation.

### 5.2 Build & TypeScript Verification
- **`compile_applet` (`vite build`):** Passed cleanly with 0 bundling errors.
- **`lint_applet` (`tsc --noEmit`):** Passed cleanly with **0 TypeScript errors and 0 warnings**.
- **Runtime Dev Server:** Running cleanly on port `3000` with synchronized frontend bundle and Express API endpoints.

---

## 6. Operational Cutover Checklist for Production Deployment

1. **Managed PostgreSQL Provisioning:** Set `DATABASE_URL` in production secrets, install the `pg` driver, and execute `/migrations/001_initial_postgresql_schema.sql` and `/migrations/002_paper_journal_positions.sql` (already wired via `src/db/migrationRunner.ts` & `src/db/postgresRepositories.ts`).
2. **Production Identity Provider & Secrets:** Configure `OAUTH_JWKS_URI`, `OAUTH_ISSUER`, `OAUTH_AUDIENCE`, `OAUTH_TOKEN_ENDPOINT`, `OAUTH_CLIENT_ID`, `AURUM_SESSION_SECRET`, `ALLOWED_ORIGINS`, and set `ALLOW_SANDBOX_PERSONAS=false`.
3. **Commercial Billing & Market Data Feeds:** Supply live `STRIPE_WEBHOOK_SECRET`, license commercial real-time market data feeds, and set optional `EIA_API_KEY`, `FRED_API_KEY`, `TELEGRAM_BOT_TOKEN`, and `TELEGRAM_CHAT_ID` per `docs/operations/ENVIRONMENT_VARIABLES_SETUP_GUIDE.md`.

---

**Report Approved by:**  
*Aurum Intelligence (GoldVista) Engineering & Quantitative Research Directorate*  
*120 / 120 Automated Verification Checks Passed · Clean `tsc --noEmit` & `vite build`*
