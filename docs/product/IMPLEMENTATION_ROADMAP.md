# GoldVista (Aurum Intelligence) — Implementation Roadmap & Reconciliation Matrix
**Document Reference:** `GVR-ROADMAP-2026-Q4`  
**Date:** November 9, 2026  
**Auditor & Technical Lead:** Senior Software Engineer  
**Governing Standard:** Implementation Addendum §4 & §6  

---

## 1. Ambiguity Reconciliation Matrix (10 Core Classes)

| Ambiguity Class | Report / Blueprint Claim | Verified Codebase Reality | Reconciled Resolution | Status |
|---|---|---|---|---|
| **1. AI Council Voting Semantics** | Claimed "Unanimous Consensus" across 4 agents | Code computes weighted average score ($W_{macro}=0.35, W_{tech}=0.30, W_{flow}=0.20, W_{geo}=0.15$) | Reconcile to **Weighted Deliberative Consensus with Adversarial Challenge**. Require >=75% weighted score for high-conviction bias; otherwise emit `NEUTRAL / CHOP`. | **RECONCILED** |
| **2. Engine vs. Strategy Distinction** | Multiple overlapping signal mechanisms mentioned | `advisoryEngine.ts` generates directional limit corridors; `strategyEngine.ts` runs parametric rule backtests | Maintain clean separation: **Advisory Engine** = Live Discretionary Trade Setups (M15/H4/W1); **Strategy Lab** = Algorithmic System Backtesting. | **RECONCILED** |
| **3. Market Data Entitlements** | "Direct institutional COMEX & LBMA terminal feed" | Yahoo Finance delayed/indicative chart API (`GC=F`, `SI=F`, `CL=F`) + simulated benchmark | Label transparently as **"Continuous Indicative Reference Feed"** with live provider tag. Avoid false claims of direct proprietary exchange gateway. | **RECONCILED** |
| **4. News & Event Intelligence** | "Live real-time global geopolitical intelligence wire" | Curated structured database (`newsSentimentEngine.ts`) with causality impact scoring | Maintain structured registry with timestamps and provenance; mark external live wire as **Planned Phase 4 Integration** requiring news vendor API. | **RECONCILED** |
| **5. Backtest vs. Walk-Forward Terminology** | "Walk-forward optimization over 5-year tick dataset" | Single-pass simulation over 180 candles with fixed spread pips | Reconcile terminology: **Historical Simulation Engine with Spread Slippage**. True multi-window k-fold walk-forward scheduled for Phase 7. | **RECONCILED** |
| **6. Broker Rebate & Payment Integration** | "Live Stripe Billing & Automated Broker API Rebate Payouts" | Client-side Stripe checkout simulation + affiliate referral tracking | Maintain clear **Sandbox / Simulation** labeling for billing modal until live Stripe production credentials are authorized by the owner. | **RECONCILED** |
| **7. Instrument Conventions & Units** | Varied tick sizing and currencies across commodities | Standardized in `commodityRegistry.ts` (Gold = USD/oz, Silver = USD/oz, Crude = USD/bbl, Yields = %) | Strict canonical registry enforced; tabular numerals (`tabular-nums font-mono`) with explicit units on all screens. | **RECONCILED** |
| **8. AI Continuous Learning vs. Immutability** | "AI models continuously adapt and learn from trades" | Static prompt instructions with live quote context injection; zero online weight updates | **Immutability First:** Models do NOT self-modify in production. Prediction records are timestamped and immutable; evaluations occur strictly offline. | **RECONCILED** |
| **9. Portfolio Holdings vs. Paper Simulation** | "Institutional Portfolio Tracker & Vault Custody" | Simulated paper trading journal persisted to browser `localStorage` | Reconcile to **Simulated Paper Trading Journal**. All entries are explicitly labeled "Simulated Execution — Zero Live Financial Risk". | **RECONCILED** |
| **10. Live Trading Language vs. Non-Execution** | "1-Click Copy Trading Bridge to MT4/MT5/cTrader" | Zero order routing code exists; live execution strictly prohibited per Addendum §2.3 | **PROHIBITED & REJECTED:** Platform is strictly Decision Support & Market Intelligence. Live execution bridges are rejected from current scope. | **RECONCILED** |

---

## 2. Dependency-Aware Implementation Roadmap (Phases 0–9)

```
┌─────────────────────────────────────────────────────────────────────────────────────────────┐
│ PHASE 0: REALITY AUDIT & RECONCILIATION                                        [COMPLETED]  │
│ · Capability Audit Matrix (25 Capabilities mapped to exact code symbols)                    │
│ · Gap & Risk Register (7 risks categorized with mitigations and owners)                     │
│ · Data Source Register (8 feeds catalogued with legal and licensing posture)                │
│ · Decision Log (7 core architectural & product records formalized)                          │
└──────────────────────────────────────────────┬──────────────────────────────────────────────┘
                                               │
                                               ▼
┌─────────────────────────────────────────────────────────────────────────────────────────────┐
│ PHASE 1: SAFETY, DATA INTEGRITY & OBSERVABILITY FOUNDATIONS (P0/P1)            [IMMEDIATE]  │
│ · Stale price regression tests & live latency telemetry                                     │
│ · Explicit Indicative vs Live vs Simulated data quality tags                                │
│ · Server-side schema bounds and deterministic risk validation                               │
│ · Structured operational logs and health monitoring                                         │
└──────────────────────────────────────────────┬──────────────────────────────────────────────┘
                                               │
                                               ▼
┌─────────────────────────────────────────────────────────────────────────────────────────────┐
│ PHASE 2: REPRODUCIBLE ADVISORY & FORECAST ACCOUNTABILITY (P1)                               │
│ · Immutable advisory snapshot records with cryptographic hash signature                     │
│ · Pre-registered invalidation and target outcome tracking                                    │
│ · Transparent evaluation dashboard (Win/Loss, R:R realized vs projected)                    │
└──────────────────────────────────────────────┬──────────────────────────────────────────────┘
                                               │
                                               ▼
┌─────────────────────────────────────────────────────────────────────────────────────────────┐
│ PHASE 3: MARKET REGIME & HISTORICAL INTELLIGENCE (P1/P2)                                    │
│ · Mathematical regime classification (Trend, Mean Reverting, High Volatility, Crisis)      │
│ · Multi-asset cross-commodity spreads (Gold/Silver ratio, Crude crack spread)              │
│ · Statistical distribution displays for historical analogues                                │
└──────────────────────────────────────────────┬──────────────────────────────────────────────┘
                                               │
                                               ▼
┌─────────────────────────────────────────────────────────────────────────────────────────────┐
│ PHASE 4: COMMODITY-SPECIFIC FUNDAMENTALS & EVENT INTELLIGENCE (P2)                          │
│ · Real-time COMEX COT Managed Money positioning delta                                       │
│ · Central bank physical bullion accumulation quarterly metrics                              │
│ · Live economic calendar event countdown with volatility projection                         │
└──────────────────────────────────────────────┬──────────────────────────────────────────────┘
                                               │
                                               ▼
┌─────────────────────────────────────────────────────────────────────────────────────────────┐
│ PHASE 5: AI GOVERNANCE & EVIDENCE-GROUNDED RESEARCH COUNCIL (P2)                            │
│ · Quorum, abstention, and disagreement metrics across 4 specialist agents                   │
│ · Prompt injection defense on untrusted news text inputs                                    │
│ · Strict citation verification on all generated research dossier claims                     │
└──────────────────────────────────────────────┬──────────────────────────────────────────────┘
                                               │
                                               ▼
┌─────────────────────────────────────────────────────────────────────────────────────────────┐
│ PHASE 6: DECISION TOOLS, SCANNER & PORTFOLIO RISK (P2/P3)                                   │
│ · Real-time multi-commodity opportunity scanner                                             │
│ · Portfolio margin aggregate heat-map across precious metals & energies                     │
│ · Physical precious metals accumulation dollar-cost-averaging model                         │
└──────────────────────────────────────────────┬──────────────────────────────────────────────┘
                                               │
                                               ▼
┌─────────────────────────────────────────────────────────────────────────────────────────────┐
│ PHASE 7: STRATEGY LAB & BACKTESTING MATURITY (P2/P3)                                        │
│ · Multi-window walk-forward out-of-sample k-fold optimization                               │
│ · Monte Carlo trade sequence permutation & max drawdown confidence intervals                │
│ · Execution slippage models calibrated to session market liquidity                          │
└──────────────────────────────────────────────┬──────────────────────────────────────────────┘
                                               │
                                               ▼
┌─────────────────────────────────────────────────────────────────────────────────────────────┐
│ PHASE 8: COMMERCIAL, ACCESS & ENTERPRISE READINESS (P2/P3)                                  │
│ · Production Stripe webhook signature verification and idempotency                          │
│ · Session cookie JWT authentication with server-side validation                             │
│ · Enterprise multi-seat team workspace permissions                                         │
└──────────────────────────────────────────────┬──────────────────────────────────────────────┘
                                               │
                                               ▼
┌─────────────────────────────────────────────────────────────────────────────────────────────┐
│ PHASE 9: CONTROLLED RELEASE & CONTINUOUS GOVERNANCE                                         │
│ · Staged rollout via feature flags                                                          │
│ · Continuous data freshness and provider error rate monitoring                              │
│ · Automated circuit breaker on stale market data                                            │
└─────────────────────────────────────────────────────────────────────────────────────────────┘
```

---

## 3. Immediate Recommended Increment (Phase 1 Entry Gate)

### Increment 1.1: Data Freshness Labeling & Indicative Reference Hardening
- **Objective:** Eliminate any ambiguity between live exchange feeds and indicative reference feeds across all terminal and landing page surfaces.
- **Scope:**
  - Add explicit visual badge: `"Indicative Reference Feed"` with provider source (`Yahoo Finance` or `Simulated Benchmark`).
  - Add explicit latency badge (`ms`) and freshness status (`FRESH` <60s, `DEGRADED` <300s, `QUALITY_HOLD`).
  - Ensure zero live execution or broker order terminology appears anywhere in the platform.
- **Acceptance Criteria:**
  - Every quote card and chart header displays clear provenance.
  - Test suite passes with 0 regressions.
