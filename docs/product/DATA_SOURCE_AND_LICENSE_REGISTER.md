# GoldVista (Aurum Intelligence) — Data Source and License Register
**Document Reference:** `GVR-DATA-LICENSE-2026-Q4`  
**Date:** November 9, 2026  
**Auditor:** Data Governance & Licensing Lead  
**Governing Standard:** Implementation Addendum §2.1 & §9.2  

---

## 1. Data Source Inventory & Legal Posture

| Source / Provider ID | Data Fields | Canonical Source | Access Method | License & Terms Posture | Permitted Use | Storage & Retention | Redistribution Limits | Rate Limits & Cost | Freshness & Latency | Outage & Fallback Strategy | Status |
|---|---|---|---|---|---|---|---|---|---|---|---|
| **DS-01: Yahoo Finance Chart API** | OHLCV candles, regularMarketPrice, bid, ask, 24h high/low, volume | Yahoo Finance (`query1.finance.yahoo.com/v8/finance/chart/*`) | Public HTTPS GET with standard user-agent | Public delayed/indicative market reference; non-commercial educational/research | Research & Advisory Decision Support | In-memory 45-second cache; no raw long-term database dump | Display to end-user in UI; no raw redistribution API | Rate-limited (~2,000 req/hr/IP); $0 Cost | 1-minute to 15-minute delayed (indicative) | Automatic fallback to `query2` host, then to internal simulated benchmark | **APPROVED FOR RESEARCH USE** |
| **DS-02: Simulated Benchmark Feed** | Synthetic spot price, bid, ask, spread, high, low, volume, timestamp | Aurum Intelligence Benchmark Engine (`src/services/marketDataProvider.ts`) | In-memory algorithmic generator | Proprietary MIT/Internal License | Internal testing, fallback during network partition, paper trading | In-memory only; recalculated on request | Unlimited internal use | Zero external rate limits; $0 Cost | Instantaneous (<1ms) | Primary provider fallback | **APPROVED / ACTIVE** |
| **DS-03: Google Gemini API (Interactions / GenAI)** | Text explanations, council synthesis, adversarial critique, search grounding | Google AI Studio (`models/gemini-3.8-flash`) | `@google/genai` TypeScript SDK (HTTP POST via server proxy) | Google AI Studio API Terms of Service | Financial analysis synthesis, chat advisory, research dossier draft | Ephemeral session logs; no user training without consent | Client UI presentation only | Governed by Google Cloud project quota; standard tier | 1.2s – 2.5s generation latency | Graceful deterministic fallback message if API key omitted | **APPROVED (WITH KEY)** |
| **DS-04: Curated Macro Releases & Event Studies** | NFP, CPI, Fed Funds Rate, historical event impacts (1970s, 2008, 2020) | US Bureau of Labor Statistics (BLS), Federal Reserve (FRED), World Gold Council | Bundled static TypeScript registry (`macroData.ts`) | Public Domain US Government Data & Public WGC Research | Educational and context display | Persisted in source code repository | Permitted under Fair Use / Public Domain | Zero API calls; $0 Cost | Point-in-time historical records | Self-contained static assets | **APPROVED** |
| **DS-05: Curated Multi-Commodity News Evidence** | Headline, source agency, summary, causality tag, sentiment score (-1 to +1) | LBMA, Reuters, Bloomberg, WGC public releases | Bundled structured dataset (`newsSentimentEngine.ts`) | Public reporting facts & editorial analysis | Research evidence display | Persisted in source code repository | Permitted under Fair Use (short analytical snippets) | Zero external calls; $0 Cost | Timestamped per release event | Static curated baseline | **APPROVED** |
| **DS-06: Telegram Bot API** | Outgoing alert text, formatted Markdown, chat ID | Telegram Bot API (`api.telegram.org/bot<TOKEN>/*`) | HTTPS POST via `notificationService.ts` | Telegram Bot API Terms of Service | Outbound user signal notifications | Logged in in-memory delivery audit ring buffer (max 100 entries) | Private direct message to user-configured chat | 30 messages/second standard Telegram bot limit; $0 Cost | 100ms – 400ms delivery latency | Retries on network error; deduplicates within 5 minutes | **APPROVED (CONFIGURED)** |
| **DS-07: Stripe Payments (Simulation)** | Transaction ID, bundle SKU, amount, payment method (Card/Apple Pay/Google Pay) | Simulated checkout modal (`StripeCheckoutModal.tsx`) | Client-side modal state | N/A (Simulation mode active in current phase) | User entitlement verification | Local session state | Internal only | N/A; $0 Cost | Real-time | Instant simulated confirmation | **SIMULATION ONLY** |
| **DS-08: ECN Broker Partners (IC Markets, Pepperstone, Tickmill)** | Partner referral code, broker name, account bracket | Partner referral specifications | Client verification form | Standard ECN Broker Introducing Broker (IB) agreement | Subsidized Pro membership verification | User profile session | None | N/A; revenue generated via broker rebates ($2.50/lot) | Immediate | Manual validation fallback | **APPROVED MODEL** |

---

## 2. Policy on Third-Party Data & Licensing Safeguards

1. **Zero Raw Scraping Policy:** GoldVista does not perform unauthorized web scraping of paywalled articles or commercial terminal feeds.
2. **Freshness & Provenance Labeling:** Every quote and historical chart displays the explicit provider (`Yahoo Finance (Live Market Reference)` or `Aurum Simulated Benchmark`) alongside a live latency and quality indicator (`FRESH`, `DEGRADED`, `QUALITY_HOLD`).
3. **No Execution Guarantee Disclaimer:** All market data is labeled as non-execution reference indicative data. Users are reminded that GoldVista is a quantitative research and trade advisory system, not a regulated broker-dealer or custodial execution venue.
