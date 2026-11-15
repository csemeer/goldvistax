# Aurum Intelligence
## Master Development Prompt — Modular, Reusable, Extensible Gold Trading Advisory Platform

**Document:** `PROMPT.md`  
**Product:** Aurum Intelligence  
**Category:** AI-powered gold market intelligence, research, trading advisory, quantitative strategy, chart analysis, and risk management  
**Primary instrument:** XAU/USD  
**Additional instruments:** Gold futures, gold CFDs, gold ETFs and other approved gold-related instruments  
**Default mode:** Research and advisory only; no live order execution in the initial release  
**Primary design principle:** Build a modular platform from reusable, well-defined capabilities—not a collection of duplicated pages, scripts, agents, or strategy implementations.

---

# 1. Mission and engineering mandate

Act as a multidisciplinary team of senior software architects, quantitative researchers, gold-market analysts, macroeconomic researchers, algorithmic trading engineers, AI-agent engineers, financial-data engineers, risk specialists, UX designers, QA engineers, security engineers, and DevOps engineers.

Design, implement, test, and document a professional gold trading intelligence and advisory platform. The platform must integrate current market data, macroeconomic and geopolitical research, historical event studies, multi-timeframe technical analysis, quantitative strategies, explainable AI, CFD-specific calculations, portfolio-level risk, and an accessible trading-terminal interface.

Do not build a simple indicator dashboard, chatbot, or signal generator. Build a coherent, testable product whose capabilities can be reused across instruments, timeframes, strategies, reports, interfaces, and future products.

**Non-negotiable architectural objective:** each business capability must have one authoritative implementation and a stable interface. Different modules should compose and reuse those capabilities rather than reimplementing the same logic.

Examples:
- One canonical indicator engine must power charts, strategy rules, reports, alerts, and backtests.
- One risk engine must power trade cards, CFD calculations, paper trading, portfolio views, and any future execution adapter.
- One market-data normalization layer must serve all consumers.
- One event-study engine must serve historical research, macro reports, analog matching, and strategy evaluation.
- One recommendation schema must be used across dashboards, alerts, APIs, and reports.
- One design system must provide reusable UI components and consistent interaction patterns.
- AI agents must call shared tools and services instead of independently duplicating calculations or sourcing conflicting values.

Deliver working, tested software incrementally. Do not stop at architecture diagrams, mockups, placeholder pages, or a folder structure.

---

# 2. Product outcomes

The system must answer:

1. What is gold doing now, and how fresh and reliable is the data?
2. Why may gold be moving?
3. Which monetary-policy, inflation, employment, yield, dollar, supply-demand, positioning, liquidity, and geopolitical factors matter?
4. Which historical episodes resemble current conditions, and how strong is the evidence?
5. What do technical structure, momentum, volatility, and price action show across timeframes?
6. What bullish, bearish, and neutral scenarios are plausible?
7. Are there validated, risk-adjusted trade setups for long-term, swing, short-term, intraday, or CFD use?
8. What are the entry trigger, stop, targets, position size, estimated costs, reward/risk, invalidation, and event risks?
9. What evidence would change the view?
10. Should the system recommend BUY, SELL, HOLD, REDUCE, WAIT, or NO TRADE?

A correct `NO TRADE` or `INSUFFICIENT DATA` outcome is a first-class result.

Always distinguish observed facts, historical evidence, model estimates, AI interpretations, scenarios, recommendations, simulated results, and executed transactions. Never claim guaranteed profitability.

---

# 3. Architecture principles

Apply these principles throughout design and implementation.

## 3.1 Modular monolith first; service extraction only when justified

Start with a well-structured modular monolith unless repository assessment, scale, deployment constraints, or team boundaries justify separate services. Define module boundaries so a module can later be extracted without rewriting business logic.

Do not adopt microservices solely for appearance. Avoid needless network hops, duplicated deployment complexity, distributed transactions, and excessive infrastructure.

## 3.2 Separation of concerns

Keep domain logic independent from:
- HTTP frameworks.
- Database implementations.
- Broker APIs.
- Market-data providers.
- LLM providers.
- UI frameworks.
- Cloud vendors.
- Notification providers.

Use dependency inversion and ports-and-adapters (hexagonal) architecture where appropriate. Domain logic must depend on stable interfaces, not vendor-specific implementations.

## 3.3 Single source of truth

Each concept has one canonical owner:
- Instrument definitions and contract specifications.
- Normalized market observations and candles.
- Economic events and release vintages.
- Indicator calculations.
- Feature definitions.
- Strategy rules and parameters.
- Trade plans and recommendation schemas.
- Risk calculations.
- Provider provenance and freshness.
- User preferences and configuration.

Do not store independently calculated copies of the same fact without a documented reason. If derived data is cached or materialized, record its version, inputs, timestamp, and invalidation policy.

## 3.4 Reuse through composition, not inheritance-heavy frameworks

Prefer small, composable services, typed functions, interfaces, adapters, and declarative configurations. Use inheritance only where it expresses a genuine stable “is-a” relationship. Avoid giant base classes, generic frameworks built before there is a demonstrated need, and hidden magic.

## 3.5 Configuration over duplication

Where behavior differs only by instrument, timeframe, provider, strategy parameters, user preferences, or report format, use validated configuration and shared implementations instead of copied code.

Configuration must be schema-validated, versioned where appropriate, documented, and safe by default.

## 3.6 Explicit contracts

Define typed input/output contracts for module boundaries, API endpoints, event messages, strategies, agents, data adapters, reports, and UI components. Validate data at boundaries. Version public contracts and document compatibility rules.

## 3.7 Reproducibility and provenance

Every analytical output should be traceable to:
- Input data and provider.
- Observation and retrieval timestamps.
- Feature and indicator versions.
- Strategy/model version.
- Configuration version.
- Risk settings.
- Calculation result.
- Warnings and assumptions.

Use UTC internally; display the user’s selected timezone. Default display timezone: Asia/Dubai.

## 3.8 Fail safely

Missing, stale, inconsistent, unauthorized, or low-quality data must not silently turn into a trading signal. Use explicit data-quality states, degrade confidence, disable affected functionality, or abstain.

## 3.9 Avoid premature abstraction

Abstract stable, repeated behavior—not hypothetical future needs. Before creating a shared component, identify at least two real consumers or a clear domain-level reason for reuse. Keep modules focused and avoid both duplicated logic and over-engineered abstractions.

---

# 4. Required architecture and repository structure

First inspect the existing repository and preserve working functionality. Adapt the structure below to the project rather than blindly replacing it. Explain any deviations.

Suggested monorepo:

```text
aurum-intelligence/
├── README.md
├── PROMPT.md
├── ARCHITECTURE.md
├── REQUIREMENTS.md
├── DATA_SOURCES.md
├── DOMAIN_MODEL.md
├── API_CONTRACTS.md
├── STRATEGIES.md
├── RISK_MANAGEMENT.md
├── BACKTESTING.md
├── MODEL_GOVERNANCE.md
├── SECURITY.md
├── COMPLIANCE.md
├── DEPLOYMENT.md
├── TESTING.md
├── CHANGELOG.md
├── pyproject.toml
├── package.json
├── docker-compose.yml
├── .env.example
├── apps/
│   ├── api/                    # HTTP/WebSocket composition layer only
│   ├── web/                    # Responsive user interface
│   └── worker/                 # Background job entry points
├── packages/
│   ├── domain/                 # Domain entities, value objects, invariants
│   ├── contracts/              # Shared API/event schemas and versioning
│   ├── config/                 # Validated settings and configuration loading
│   ├── data_access/            # Repository interfaces and persistence adapters
│   ├── market_data/            # Provider adapters and normalized market data
│   ├── macro_data/             # Economic series, releases, and vintages
│   ├── news/                   # News/event ingestion and source provenance
│   ├── indicators/             # Canonical technical indicator engine
│   ├── features/               # Versioned feature definitions
│   ├── market_structure/       # Sessions, levels, volatility, structure
│   ├── event_studies/           # Event windows, outcomes, statistical analysis
│   ├── regime_detection/       # Regime labels and model interfaces
│   ├── strategies/             # Reusable strategy interfaces and implementations
│   ├── backtesting/            # Simulation engine and performance metrics
│   ├── risk/                   # Position sizing, limits, costs, exposure
│   ├── advisory/               # Recommendation composition and explanations
│   ├── agents/                 # Agent orchestration and specialist agents
│   ├── charting/               # Chart data, annotations, and overlays
│   ├── reports/                # Reusable report data models and renderers
│   ├── alerts/                 # Rule evaluation, deduplication, delivery
│   ├── portfolio/              # Positions, exposure, and journal domain
│   ├── integrations/           # Broker, notification, publishing adapters
│   ├── observability/          # Logging, metrics, tracing, audit
│   └── testing/                # Shared fixtures and test utilities
├── frontend/
│   ├── src/
│   │   ├── app/
│   │   ├── features/
│   │   ├── components/
│   │   ├── hooks/
│   │   ├── services/
│   │   ├── contracts/
│   │   ├── design-system/
│   │   └── tests/
│   └── ...
├── migrations/
├── tests/
│   ├── unit/
│   ├── integration/
│   ├── contract/
│   ├── backtest/
│   ├── end_to_end/
│   └── resilience/
├── scripts/
└── docs/
    ├── decisions/               # Architecture Decision Records (ADRs)
    ├── runbooks/
    └── diagrams/
```

Do not create empty packages merely to match this tree. Introduce a package when it has a clear responsibility and actual implementation. Keep import directions acyclic. Domain packages must not import API or UI code. Provider-specific code must not leak into strategy or risk logic.

---

# 5. Reuse map: canonical services and consumers

Create and maintain a **Reuse and Ownership Matrix** in `ARCHITECTURE.md`.

| Canonical capability | Single owner | Reuse by |
|---|---|---|
| Instrument metadata and contract specs | Instrument/domain service | Data adapters, charting, CFD calculator, risk, reports |
| Market data normalization and freshness | Market-data service | Charts, indicators, strategies, agents, alerts, backtests |
| Economic release/vintage model | Macro-data service | Macro dashboard, event studies, reports, forecasting |
| Indicator calculations | Indicator engine | Charts, strategies, alerts, backtests, reports |
| Feature definitions | Feature registry | Strategies, models, event studies, research |
| Event-study calculations | Event-study engine | Historical research, analog matching, reports |
| Strategy interface and lifecycle | Strategy framework | Strategy lab, advisory, backtesting, paper simulation |
| Cost and fill assumptions | Execution-cost model | Backtesting, CFD planning, reward/risk calculations |
| Position sizing and hard limits | Risk engine | Trade cards, portfolio, paper trading, future execution |
| Recommendation schema | Advisory domain | API, dashboard, alerts, reports, audit |
| Agent tool registry | Agent platform | All specialist agents |
| Source citations/provenance | Evidence service | Research, agents, reports, recommendation explanations |
| Chart annotation schema | Charting domain | Interactive charts, exports, reports |
| Report content model | Reporting domain | Web, PDF/HTML export, GoldVista publishing |
| Alert rule evaluation | Alert service | Price, indicator, event, risk and setup alerts |
| Design tokens and UI primitives | Design system | Every frontend page and component |
| Authentication/authorization | Identity layer | API routes, admin tools, sensitive operations |
| Audit event model | Audit service | Recommendation history, config changes, risk events |

If two modules independently implement the same domain calculation, consolidate it or document why the behavior is intentionally different. Add tests proving that consumers use the canonical service.

---

# 6. Domain model and shared contracts

Define canonical domain objects before building feature-specific screens. Use typed models and explicit units.

At minimum, model:
- `Instrument`
- `InstrumentSpecification`
- `MarketObservation`
- `Quote`
- `Candle`
- `EconomicSeries`
- `EconomicRelease`
- `EconomicReleaseVintage`
- `NewsEvent`
- `DataQualityStatus`
- `IndicatorValue`
- `FeatureSnapshot`
- `MarketRegime`
- `HistoricalEpisode`
- `EventStudyResult`
- `StrategyDefinition`
- `StrategyParameters`
- `StrategySignal`
- `TradePlan`
- `RiskAssessment`
- `CostEstimate`
- `Recommendation`
- `EvidenceItem`
- `AgentAssessment`
- `AlertRule`
- `AlertEvent`
- `PortfolioPosition`
- `BacktestRun`
- `ModelVersion`
- `AuditEvent`

Each object must define:
- Stable identifier.
- Required fields.
- Units and currency where relevant.
- Timestamp semantics.
- Validation rules.
- Optional versus required data.
- Schema version where needed.

Avoid ambiguous fields such as `price`, `volume`, `confidence`, or `time` without defining their meaning. For example, distinguish bid, ask, mid, candle close, quote currency, account currency, event publication time, observation time, and retrieval time.

Use a single canonical schema for trade plans and recommendations. API responses, dashboard cards, notifications, reports, and audit records should be projections of that schema—not separately implemented versions of the same logic.

---

# 7. Instruments and market coverage

## 7.1 Primary instrument

XAU/USD spot gold, with explicit provider and quote convention. OTC spot gold is not one centralized exchange market; prices may differ by provider and broker.

## 7.2 Additional instruments

Support through instrument adapters and metadata:
- Gold futures, including COMEX contracts.
- Gold CFDs.
- Physically backed gold ETFs.
- Other approved gold-related products.
- Silver as a comparison instrument.
- US Dollar Index.
- US Treasury yields and TIPS real yields.
- Relevant gold-mining benchmarks.

Do not assume every instrument has the same trading hours, volume semantics, contract multiplier, spread, fees, or expiry behavior.

## 7.3 Horizons and timeframes

Advisory horizons:
- Long-term: months to years.
- Swing: days to weeks.
- Short-term: minutes to hours.
- Intraday: session-based.
- CFD-specific planning: instrument and broker dependent.

Support chart timeframes: 1m, 5m, 15m, 30m, 1h, 4h, daily, weekly, and monthly where the underlying data supports them. Reuse common engines with validated per-horizon configuration; do not clone the indicator or strategy engine for each timeframe.

---

# 8. Data provider and normalization architecture

Implement provider-independent interfaces such as:
- `MarketDataProvider`
- `EconomicDataProvider`
- `EconomicCalendarProvider`
- `NewsProvider`
- `PositioningDataProvider`
- `GoldFundamentalsProvider`
- `BrokerSpecificationProvider`
- `NotificationProvider`
- `LLMProvider`
- `VisionModelProvider`

Each provider adapter translates source-specific responses into canonical domain objects. Strategy and advisory modules must never parse vendor-specific payloads directly.

Use capability discovery so unavailable data types are explicit. Provide multiple providers where feasible, but do not fabricate a fallback. Fail over only to approved sources with compatible semantics, and display any source change.

For every record, retain source, event/observation time, publication time, retrieval time, timezone, units, quality state, revision/vintage information, and relevant license restrictions.

Implement:
- Staleness thresholds by data type.
- Missing/duplicate/outlier detection.
- Timestamp and timezone validation.
- Candle completeness checks.
- Cross-provider reconciliation where meaningful.
- Economic data vintage preservation.
- Futures roll and ETF corporate-action handling where relevant.
- Rate-limit handling and bounded retries.
- Idempotent ingestion.
- Provider health and latency metrics.

Use official or properly licensed data sources. Verify availability, historical depth, latency, usage rights, and redistribution rules before committing to a provider. Never silently replace live data with demonstration data.

---

# 9. Macro intelligence and gold fundamentals

Create reusable macro data models and analytical functions for:
- Federal Reserve policy and market expectations.
- CPI, core CPI, PCE, core PCE, PPI.
- Nonfarm payrolls, unemployment, wages, jobless claims.
- GDP, retail sales, ISM, consumer confidence.
- Treasury yields, TIPS real yields, inflation breakevens.
- US Dollar Index and relevant currency movements.
- Central-bank gold purchases.
- ETF holdings and flows.
- Futures positioning and open interest.
- Gold supply, demand, mining, and recycling.
- Relevant Chinese and global economic indicators.
- Verified geopolitical and systemic-risk events.

For each macro factor, report the source, publication time, observed value, prior value as known then, consensus where licensed and available, actual release, revisions, and data limitations.

Explain that falling policy rates are not automatically bullish for gold. Consider real yields, dollar movement, expectations already priced into the market, growth, liquidity, positioning, and the broader regime.

Separate facts from interpretation. News ingestion must preserve source links, timestamps, confidence in source reliability, and corroboration status. AI summaries must be grounded in retrieved evidence.

---

# 10. Historical event-study and analog engine

Implement one reusable event-study engine used by historical research, macro reports, analog matching, and strategy validation.

## 10.1 Event classes

Include FOMC decisions, CPI/PCE, payrolls, unemployment, GDP, major central-bank speeches, QE/QT announcements, banking and sovereign-debt crises, geopolitical shocks, tariffs/sanctions, liquidity events, and significant gold supply-demand developments where adequate data exists.

## 10.2 Event windows

Support configurable windows such as 5m, 15m, 30m, 1h, 4h, 1d, 3d, 5d, 10d, 20d, and 60 trading days, only when data resolution and market calendars permit.

Calculate returns, maximum favorable/adverse excursion, realized volatility, drawdown, median/mean outcomes, outcome distribution, sample size, uncertainty intervals, and hit rates with clearly defined target/stop rules.

## 10.3 Release surprise

For scheduled data, store the consensus available before publication, prior value known at that time, actual value, later revisions, surprise magnitude, historical surprise normalization, and cross-asset reaction.

Do not use revised values as if they were available before the event.

## 10.4 Analog matching

Use reproducible features such as real yields, nominal yields, dollar momentum, macro surprises, policy expectations, gold trend/volatility, positioning, ETF flows, liquidity, and event context. Candidate methods include standardized distance, nearest neighbors, clustering, regime classification, and time-series distance metrics where appropriate.

Prevent look-ahead leakage. Show matching features, differences, similarity methodology, sample size, outcome distribution, uncertainty, and limitations. Historical analogs are conditional evidence, not predictions.

---

# 11. Shared technical analysis and chart services

Implement a canonical indicator engine used by the chart, strategy framework, alerts, reports, and backtests. It must accept normalized price series and validated parameters and return typed outputs with timestamps and warm-up/insufficient-data status.

Indicators may include:
- EMA 5/9/12/20/21/26/50/100/200.
- SMA 20/50/200.
- VWAP and anchored VWAP where appropriate.
- ADX, Supertrend, Ichimoku.
- RSI, MACD, stochastic, ROC, momentum, CCI.
- ATR, Bollinger Bands, historical and realized volatility, volatility percentile.
- Swing highs/lows, prior day/week/month levels, session ranges, opening range, support/resistance zones.
- Volume profile only when the underlying data supports it.

Do not count highly correlated indicators as independent confirmations. Make all parameters configurable and versioned.

Chart pattern recognition should cover triangles, flags, pennants, rectangles, wedges, head-and-shoulders, inverse patterns, double tops/bottoms, continuation bases, breakouts, retests, and failed breakouts where objectively definable.

For each pattern provide timeframe, boundaries, formation status, confirmation condition, invalidation, target methodology, risk/reward, evidence, and confidence methodology. Avoid claiming a pattern is confirmed when the criteria are not met.

AI vision may interpret screenshots, but numeric values must come from canonical data and indicator services. The vision model cannot invent prices or override validated calculations. If vision and numeric analysis disagree, flag the discrepancy and reduce confidence or abstain.

---

# 12. Reusable strategy framework

Build a common strategy interface, for example conceptually:
- strategy metadata and version;
- validated parameters;
- required data/features;
- warm-up requirements;
- signal generation;
- exit/invalidity conditions;
- applicable instruments and timeframes;
- risk constraints;
- explanation/evidence output.

Use typed contracts rather than requiring every strategy to inherit a large base class. Strategies must be deterministic where possible, testable in isolation, and reusable by advisory, backtesting, paper simulation, and alert evaluation.

Implement candidate strategies:
1. Macro trend following.
2. Trend pullback.
3. Breakout and retest.
4. Range trading.
5. Reversal/mean reversion.
6. Event-driven scenarios.
7. Volatility breakout.
8. Multi-timeframe confluence.
9. Regime-dependent statistical strategies.
10. Cost-aware gold CFD setups.

A strategy must not contain its own duplicate indicator, position-sizing, cost, or data-normalization implementation. It requests shared features and delegates risk calculations to the risk engine.

Every strategy must define entry, exit, stop, target, invalidation, time horizon, cost assumptions, and no-trade conditions. Use explicit parameters rather than hidden magic numbers.

---

# 13. Backtesting, validation, and governance

Use one shared simulation and execution-cost model across strategies. Clearly distinguish signal price, executable bid/ask, assumed fill, and actual historical trade data.

Implement chronological train/validation/test separation, walk-forward analysis, out-of-sample testing, parameter sensitivity, transaction costs, spreads, slippage, financing where relevant, event stress tests, and regime-specific reporting.

Prevent look-ahead bias, data leakage, survivorship bias where relevant, unrealistic fills, overfitting, and revised-data leakage. Use purging/embargo techniques when overlapping samples require them.

Metrics:
- Total and annualized return where appropriate.
- Maximum drawdown.
- Sharpe and Sortino.
- Profit factor.
- Win rate with sample size.
- Average winner and loser.
- Expectancy.
- Turnover and exposure.
- Costs.
- Tail loss.
- Performance by regime.

Compare with appropriate baselines such as buy-and-hold exposure for suitable horizons, simple trend rules, and cash/no-trade baselines.

Strategy lifecycle:
Research → Backtest → Validation → Paper trading → Monitored trial → Approved advisory deployment → Suspended/Retired.

Do not promote a strategy solely because its historical backtest is profitable. Keep model versions, data snapshots or reproducible references, parameters, validation results, and approval status.

---

# 14. Risk engine and CFD module

The risk engine is a canonical, deterministic component and must not be duplicated in strategies, agents, pages, or reports. It enforces hard limits that AI cannot override.

## 14.1 Trade plan schema

Include:
- Instrument and direction.
- Horizon and strategy.
- Current bid/ask and timestamp.
- Entry trigger and entry zone.
- Stop-loss and targets.
- Expected holding period.
- Gross/net reward-risk.
- Estimated costs.
- Position size and risk budget.
- Notional exposure and margin estimate.
- Invalidation and cancellation conditions.
- Event and data warnings.
- Recommendation expiry/review condition.

Distinguish a conditional setup from a live executable order.

## 14.2 Position sizing

Use account equity, risk budget, entry/stop distance, instrument contract specification, quote/account currency conversion, and expected costs. Correctly handle linear CFDs, futures multipliers/tick values, lot increments, and minimum sizes. Do not assume one universal contract formula.

## 14.3 Configurable hard limits

Risk per trade, daily/weekly loss, aggregate exposure, open positions, leverage, drawdown, event exposure, minimum net reward-risk, maximum spread, minimum liquidity, and consecutive losses.

## 14.4 CFD configuration and calculator

Use broker-specific instrument specifications:
- Contract size, tick size/value, lot increments, margin/leverage, commission, spread, financing/swap, trading hours, stop-out rules, account currency.

Show estimated spread/commission/financing, gross and net P/L, notional exposure, required margin, margin headroom, and gap risk. Label estimates. Affordable margin does not mean a trade is safe.

## 14.5 Abstention conditions

Reject or downgrade trades when data is stale, spreads excessive, expected net value inadequate, reward/risk weak, entry missed, market regime unvalidated, major event conditions unsuitable, margin/risk limits breached, or critical evidence conflicts.

---

# 15. AI agent architecture with reusable tools

Agents must orchestrate shared analytical tools; they must not independently recalculate canonical metrics or scrape unapproved sources.

Specialists:
1. Macro Intelligence.
2. Historical Event Research.
3. Gold Fundamentals.
4. Technical Analysis.
5. Quantitative Strategy.
6. Market Structure.
7. News and Event Risk.
8. CFD Risk.
9. Portfolio and Exposure.
10. Independent Challenge.
11. Advisory Council.

Provide a shared, permissioned tool registry, typed input/output schemas, bounded retries, timeouts, observability, caching where safe, and model/provider abstraction. Keep deterministic calculations in ordinary services; use LLMs for grounded synthesis, classification, explanation, and research assistance.

Each agent output must include:
- Agent and version.
- Timestamp and data freshness.
- Instrument and horizon.
- Assessment.
- Supporting evidence IDs.
- Contradictory evidence.
- Assumptions.
- Uncertainty.
- Warnings.
- Invalidation conditions.

The advisory council must not simply average votes. Account for shared data and correlated reasoning, evidence quality, model validation, and disagreement. The challenge agent must actively search for reasons not to trade.

Never present uncalibrated LLM confidence as a probability. Use validated, calibrated models for probabilities; otherwise use qualitative confidence labels with clear definitions.

---

# 16. Advisory decision and evidence system

The recommendation engine consumes canonical facts, feature snapshots, strategy signals, risk results, and agent assessments.

Possible states:
- Strong bullish bias.
- Bullish bias.
- Neutral.
- Bearish bias.
- Strong bearish bias.
- Buy setup developing.
- Sell setup developing.
- Buy confirmed.
- Sell confirmed.
- Hold.
- Reduce exposure.
- Exit condition triggered.
- Wait.
- No trade.
- Data quality hold.

Define each state and distinguish market bias from a confirmed trade setup. Generate separate recommendations for long-term, swing, short-term, intraday, and CFD horizons.

Each recommendation must explain:
1. Decision and horizon.
2. Price and timestamp.
3. Primary rationale.
4. Supporting evidence and source references.
5. Contradictory evidence.
6. Entry condition.
7. Stop, targets, and reward/risk.
8. Costs and assumptions.
9. Event risks.
10. Invalidation and expiry.
11. Conditions that would change the view.
12. Data-quality limitations.

Create an evidence registry so multiple pages, agents, and reports can reference the same evidence item rather than recreating or paraphrasing unsupported facts.

---

# 17. Forecasting

Only introduce forecasting models where adequate data and evaluation methods exist. Candidate models include logistic regression, gradient boosting, random forests, regime models, volatility models, and time-series models. Prefer simpler baselines unless more complex models demonstrate reliable out-of-sample improvement.

Define the target precisely, such as return over a horizon or probability of reaching target before stop. Account for path dependence and candle-data limitations.

Evaluate calibration with Brier score, log loss, calibration plots/error, and regime-specific stability; evaluate trading usefulness with costs and drawdown. If evidence is inadequate, do not display a probability.

---

# 18. Reusable reporting and publishing

Create a canonical report content model with reusable sections and data visualizations. Generate HTML/PDF and optional social content from the same verified report model rather than maintaining separate analysis logic.

Report types:
- Daily Gold Intelligence.
- Intraday Brief.
- Swing Trading Report.
- Long-Term Outlook.
- Weekly/Monthly Research.
- Event-Study Report.
- Strategy Performance Report.
- CFD Trade Plan.

Common sections include market snapshot, data freshness, macro drivers, technical structure, historical analogs, scenarios, opportunities, risk, event calendar, sources, assumptions, and limitations. Sections may be configured by report type, but the underlying calculations and evidence references must remain shared.

Optional GoldVista publishing integration:
- Generate educational and market-analysis content.
- Use verified data and timestamped sources.
- Clearly distinguish facts, interpretation, and scenarios.
- Include uncertainty and risk disclosures.
- Require human review/approval before publishing by default.
- Keep publishing permissions separate from trading-related permissions.
- Never fabricate statistics or guarantee-profit claims.

---

# 19. User interface and reusable design system

Build a responsive, accessible professional trading terminal with a shared design system.

Navigation:
- Market Overview.
- Live Gold Terminal.
- Technical Analysis.
- Intraday Advisor.
- Swing Trading.
- Long-Term Outlook.
- CFD Risk Calculator.
- Macro Intelligence.
- Historical Event Research.
- Strategy Lab.
- Backtesting.
- Portfolio and Trade Journal.
- Reports.
- Alerts.
- Data Sources.
- Settings/Admin.

Create reusable UI components for:
- Instrument/price header.
- Data freshness indicator.
- Trend/regime badge.
- Metric card.
- Candlestick chart.
- Indicator selector.
- Chart annotation.
- Evidence/source list.
- Economic event timeline.
- Scenario comparison.
- Trade plan card.
- Risk/reward visualization.
- CFD calculator fields.
- Warning banner.
- Agent assessment.
- Recommendation explanation.
- Report section.
- Loading/empty/error/stale states.

Do not duplicate similar components across pages. Use design tokens for typography, spacing, color, borders, and semantic states. Keep color from being the only carrier of meaning; include labels/icons and accessible contrast.

Support desktop, laptop, tablet, and mobile. Provide dark/light themes, keyboard navigation, touch-friendly controls, clear typography, and persisted preferences. Mobile should prioritize price/freshness, bias, chart, trade plan, risk, and upcoming events.

Use a chart library only after checking license and required functionality. Keep chart data and annotation contracts independent of the selected rendering library.

---

# 20. Alerts and notifications

Build a reusable rule-evaluation engine for:
- Price levels.
- Breakouts and failed breakouts.
- Indicator conditions.
- Trend changes.
- Volatility expansion.
- Macro events.
- Verified news developments.
- Setup activation/invalidation.
- Stop/target proximity.
- Excessive spread.
- Stale data.
- Risk-limit breaches.

Support in-app alerts and optional email/authorized channels through notification adapters. Deduplicate events, rate-limit noisy rules, and track delivery state.

Each alert must include timestamp, instrument, trigger, source/current price, horizon, explanation, action context, and expiry. An alert is not an executed trade.

---

# 21. Persistence, caching, background jobs, and events

Choose storage based on measured access patterns. Use PostgreSQL for transactional/domain data and an appropriate time-series approach for market observations if justified. Redis may be used for cache, locks, and short-lived state; it must not become the sole source of truth for durable records.

Define:
- Cache keys and TTLs.
- Cache invalidation rules.
- Data freshness policies.
- Job idempotency.
- Retry/backoff policies.
- Dead-letter/error handling where appropriate.
- Event schema/versioning.
- Transaction boundaries.
- Migration and rollback practices.

Avoid caching derived results without recording their input/version context. Avoid introducing a message broker unless asynchronous workloads and reliability requirements justify it.

---

# 22. Security, compliance, and audit

Implement secure authentication, authorization, secret management, input validation, rate limiting, encryption in transit, appropriate encryption at rest, dependency scanning, audit logging, and redaction of secrets/PII from logs.

Assess applicable regulatory requirements for the operator, users, and jurisdictions. Do not assume an “educational” label removes regulatory obligations. Do not claim licensing or compliance without evidence. Clearly disclose CFD leverage and loss risk.

Initial release is advisory-only. No live orders may be submitted. Future broker integrations must be isolated behind adapters and require explicit authorization, permission scopes, confirmation controls, and independent risk checks.

Audit records must capture recommendation time, data references, model/strategy/config versions, feature values, risk calculations, agent evidence, final decision, rejection reasons, and later outcomes.

---

# 23. Testing and quality engineering

Create unit, integration, contract, end-to-end, backtest, and resilience tests.

Test:
- Indicator calculations and warm-up behavior.
- Provider normalization.
- Timezones and event timestamps.
- Economic revisions/vintages.
- Event-study returns.
- Feature consistency across consumers.
- Strategy determinism.
- Position sizing and account-currency conversion.
- Spread, slippage, financing, and margin.
- Recommendation schema and evidence lineage.
- Agent failure and disagreement.
- Alert deduplication.
- API/UI contracts.
- Responsive behavior and accessibility.
- Stale/missing/conflicting data.
- Provider outage, database outage, and model outage.
- Risk-limit enforcement and no-trade behavior.

Use shared test fixtures and golden test cases to ensure the same indicator or risk calculation produces identical results wherever consumed. Add contract tests to prevent API and schema drift.

Acceptance criteria:
- All critical calculations have independent verified test cases.
- No known critical risk-control defects remain.
- No duplicated authoritative implementations of core calculations.
- Consumers use canonical services and contracts.
- Backtests model realistic costs and avoid look-ahead bias.
- Stale/unavailable data is visibly identified.
- Recommendations have evidence provenance.
- CFD calculations are validated against independent examples.
- Initial release cannot place live orders.
- Installation, migrations, tests, and deployment instructions are verified.

Do not claim all defects are eliminated.

---

# 24. Documentation and architecture governance

Maintain:
- `README.md`
- `PROMPT.md`
- `ARCHITECTURE.md`
- `REQUIREMENTS.md`
- `DOMAIN_MODEL.md`
- `API_CONTRACTS.md`
- `DATA_SOURCES.md`
- `STRATEGIES.md`
- `RISK_MANAGEMENT.md`
- `BACKTESTING.md`
- `MODEL_GOVERNANCE.md`
- `SECURITY.md`
- `COMPLIANCE.md`
- `DEPLOYMENT.md`
- `TESTING.md`
- `CHANGELOG.md`

Create Architecture Decision Records (ADRs) for significant decisions, including:
- Modular monolith vs. service extraction.
- Database and time-series choices.
- Data-provider choices.
- Charting library and licensing.
- Agent framework and LLM provider.
- Event/queue infrastructure.
- Model serving.
- Cache policy.
- Public API versioning.

Each ADR records context, alternatives, decision, consequences, costs, risks, and review triggers.

Maintain a feature-to-module-to-test traceability matrix. Document ownership, public interfaces, dependencies, and reuse expectations for every module.

---

# 25. Phased delivery plan

## Phase 0 — Repository and feasibility audit
Inspect existing code and environment. Inventory working features, dependencies, data sources, licensing, technical debt, and user workflows. Do not rewrite a working project without justification.

## Phase 1 — Domain and architecture foundation
Define domain objects, contracts, module boundaries, dependency rules, configuration schemas, repository conventions, and the reuse matrix. Create ADRs for major choices.

## Phase 2 — Canonical data pipeline
Implement provider adapters, normalized data, provenance, freshness, quality checks, persistence, and health monitoring.

## Phase 3 — Shared analytics
Implement indicator engine, feature registry, market structure, chart data, and technical analysis using canonical services.

## Phase 4 — Macro and historical event research
Implement macro ingestion, vintage-aware releases, economic calendar, event studies, and analog matching.

## Phase 5 — Strategy and backtesting framework
Implement common strategy contracts, cost/fill models, risk integration, backtesting, walk-forward validation, and performance reports.

## Phase 6 — Risk and advisory engine
Implement trade plans, CFD calculations, hard risk controls, evidence registry, recommendation aggregation, and abstention behavior.

## Phase 7 — AI agent orchestration
Add specialist agents using shared tools, structured contracts, evidence IDs, bounded execution, observability, and independent challenge.

## Phase 8 — Responsive application
Build the shared design system, dashboards, charts, trade cards, research views, report views, and mobile layouts using canonical APIs.

## Phase 9 — Alerts and publishing
Implement notifications, report generation, and optional GoldVista workflow with approval gates.

## Phase 10 — Validation and paper/advisory monitoring
Run historical tests, integration tests, stress tests, usability checks, and paper-trading observation. Document failures and limitations.

## Phase 11 — Deployment and operations
Deliver container configuration, CI/CD where appropriate, monitoring, backups, runbooks, security procedures, rollback, and upgrade instructions.

Do not create every module at once. Deliver working slices, each using the canonical contracts and shared services.

---

# 26. Required development workflow

For each implementation task:

1. Inspect relevant existing code and tests.
2. Identify the owning module and canonical service.
3. Search for existing functionality before writing new code.
4. Reuse or extend an existing implementation when appropriate.
5. Define or update contracts before changing consumers.
6. Implement the smallest coherent change.
7. Add unit, integration, and contract tests.
8. Run relevant tests and linters.
9. Check dependency direction and circular imports.
10. Check whether the change duplicates existing domain logic.
11. Update documentation and traceability matrix.
12. Report actual results and unresolved limitations.

Before adding a new helper, component, service, or package, answer:
- Does equivalent functionality already exist?
- Which module owns this capability?
- Can existing code be extended safely?
- Are at least two consumers likely to use the abstraction, or is there a clear domain reason?
- Does this abstraction reduce coupling without adding needless complexity?
- How will it be tested and versioned?

Do not copy code to meet a deadline when a shared implementation is appropriate. Do not centralize unrelated behavior into a “utils” dumping ground. Put each capability in the module that owns its domain responsibility.

---

# 27. Required deliverables

Deliver:
1. Working backend and frontend.
2. Canonical domain models and versioned contracts.
3. Provider adapters and normalized data pipeline.
4. Shared indicator and feature engines.
5. Historical event-study engine.
6. Strategy framework and initial strategies.
7. Backtesting and cost model.
8. Deterministic risk and CFD calculator.
9. Evidence-based advisory engine.
10. AI agent orchestration with reusable tools.
11. Responsive charting and dashboard.
12. Reports and alert services.
13. Automated tests across layers.
14. Docker and environment examples without secrets.
15. Database migrations.
16. Architecture and operational documentation.
17. ADRs for significant choices.
18. Reuse and Ownership Matrix.
19. Feature-to-module-to-test traceability matrix.
20. Known-limitations and deferred-features register.
21. Verified setup, test, and deployment instructions.

Do not fabricate market data or claim access to paid feeds. Use clearly labeled demo fixtures for development when live data access is unavailable.

---

# 28. Definition of done

A feature is complete only when:
- Its behavior is implemented, not just mocked.
- It uses the canonical owner for shared calculations.
- Its input/output contracts are defined and validated.
- Unit and relevant integration/contract tests pass.
- Error, loading, empty, stale, and unavailable states are handled.
- Security and risk implications are reviewed.
- Documentation and traceability are updated.
- Its dependencies and ownership are clear.
- It does not introduce unjustified duplication or circular dependencies.
- Actual test results and limitations are reported.

The project is not complete merely because it launches or looks polished.

---

# 29. Final execution instruction

Start by auditing the current repository and producing:
1. Existing implementation and environment assessment.
2. Architecture proposal and module boundaries.
3. Reuse and Ownership Matrix.
4. Dependency direction diagram.
5. Domain model and contract plan.
6. Data-source and licensing feasibility report.
7. Phased delivery plan with acceptance criteria.
8. Key risks and unresolved decisions.

Then proceed incrementally unless a genuine blocking decision or dependency requires clarification.

Build a reliable, explainable advisory platform in which market data, technical calculations, historical research, strategy evaluation, risk controls, AI analysis, charts, alerts, and reports are reusable capabilities connected through stable contracts.

**The ultimate standard is not the number of modules or AI agents. It is a maintainable system in which each capability is implemented once, validated rigorously, reused consistently, and extended without unnecessary rewrites or duplicated effort.**
