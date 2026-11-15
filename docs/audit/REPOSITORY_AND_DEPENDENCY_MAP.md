# GoldVista Repository & Architecture Dependency Map
**Document Reference:** `docs/audit/REPOSITORY_AND_DEPENDENCY_MAP.md`  
**Date:** November 12, 2026  

```
                               ┌────────────────────────────────────────┐
                               │           VITE ENTRY POINT             │
                               │          index.html / src/main.tsx     │
                               └───────────────────┬────────────────────┘
                                                   │
                                                   ▼
                               ┌────────────────────────────────────────┐
                               │                 APP.TSX                │
                               │      Root State, Persona, Navigation   │
                               └───────────────────┬────────────────────┘
                                                   │
          ┌────────────────────────────────────────┼────────────────────────────────────────┐
          │                                        │                                        │
          ▼                                        ▼                                        ▼
┌──────────────────┐                     ┌──────────────────┐                     ┌──────────────────┐
│ PUBLIC LANDING   │                     │ CORE NAVIGATION  │                     │ WORKSPACE ROUTER │
│  LandingPage.tsx │                     │  Navbar.tsx      │                     │  20 Workspaces   │
│  AuthModal.tsx   │                     │  Sidebar.tsx     │                     │  AccessGateGuard │
└──────────────────┘                     └──────────────────┘                     └────────┬─────────┘
                                                                                           │
          ┌────────────────────────────────────────┬───────────────────────────────────────┴───────────────────────┐
          │                                        │                                       │                       │
          ▼                                        ▼                                       ▼                       ▼
┌──────────────────────┐               ┌──────────────────────┐                ┌──────────────────────┐  ┌──────────────────────┐
│  MARKET & ADVISORY   │               │   QUANT & ANALYTICS  │                │  MACRO & SENTIMENT   │  │ RISK & COMMERCIAL    │
│ · OverviewWorkspace  │               │ · StrategyLab        │                │ · MacroWorkspace     │  │ · CFDCalculator      │
│ · TradingViewChart   │               │ · Backtesting        │                │ · NewsSentiment      │  │ · MonetizationHub    │
│ · TradePlanCard      │               │ · AdvancedBacktest   │                │ · CouncilWorkspace   │  │ · PortfolioJournal   │
│ · CrossCommodity     │               │ · MultiAssetScanner  │                │ · GeminiChatbot      │  │ · NotificationSettings│
└──────────┬───────────┘               └──────────┬───────────┘                └──────────┬───────────┘  └──────────┬───────────┘
           │                                      │                                       │                         │
           ▼                                      ▼                                       ▼                         ▼
┌────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┐
│                                             DOMAIN SERVICES & ENGINES LAYER                                            │
├────────────────────────────┬────────────────────────────┬─────────────────────────────┬────────────────────────────────┤
│ commodityRegistry.ts       │ strategyEngine.ts          │ aiGovernanceEngine.ts       │ riskEngine.ts                  │
│ marketDataProvider.ts      │ advancedBacktestingEngine  │ cotIntelligence.ts          │ monetizationEngine.ts          │
│ realHistoricalProvider.ts  │ indicators.ts              │ newsSentimentEngine.ts      │ billingWebhookEngine.ts        │
│ crossCommoditySpreads.ts   │ forecastAccountability.ts  │ futuresOptionsEngine.ts     │ notificationService.ts         │
│ historicalDataEngine.ts    │ portfolioScannerEngine.ts  │ historicalScenariosEngine.ts│ authService.ts                 │
└────────────────────────────┴─────────────┬──────────────┴─────────────────────────────┴────────────────┬───────────────┘
                                           │                                                             │
                                           ▼                                                             ▼
┌────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┐
│                                             SERVER GATEWAY & REST APIS (server.ts)                                     │
├────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┤
│  · GET  `/health` ───────────────────── Operational Health Telemetry, Provider Latency & Error Counters                │
│  · GET  `/api/market/quotes` ────────── Live Multi-Commodity Quotes (Yahoo Finance + Simulated Baseline Fallback)      │
│  · GET  `/api/market/history` ───────── 5-Year Continuous Daily/Weekly Historical Candlesticks                         │
│  · POST `/api/billing/webhook` ──────── Idempotent Stripe Webhook Handler with Deduplication Registry                  │
│  · POST `/api/auth/verify-session` ──── Enterprise Session Token Validation Gateway                                    │
│  · POST `/api/ai/council` ───────────── Multi-Agent Governance Quorum Engine with Prompt Sanitization                  │
│  · POST `/api/ai/chat` ──────────────── Conversational Commodity Analyst Grounded in Live Price Quotes                 │
│  · POST `/api/ai/search-grounding` ──── Real-Time Google Search Tool with Primary Source Fallback                      │
│  · POST `/api/strategies/backtest` ──── Strategy Backtester & Monte Carlo Permutation Engine                           │
│  · POST `/api/notifications/test` ───── Multi-Channel Alert Dispatcher (Discord, Slack, Generic Webhook)               │
└────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┘
```
