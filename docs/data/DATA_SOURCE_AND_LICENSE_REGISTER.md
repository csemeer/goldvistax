# Market Data Sources, Feed Provenance & Licensing Register
**Document Reference:** `docs/data/DATA_SOURCE_AND_LICENSE_REGISTER.md`  
**Date:** November 12, 2026  
**Auditor:** Senior Market Data Engineer & Compliance Lead  

---

## 1. Primary Market Data Sources

| Provider ID | Provider Name | Instrument Coverage | Transport & Protocol | Real-Time Latency | Delay Status | License / Terms of Use | Commercial Use Disclaimers | Fallback Routing |
|:---:|:---|:---|:---|:---:|:---:|:---|:---|:---|
| `yahoo_finance` | Yahoo Finance Query Chart API | `GC=F`, `SI=F`, `CL=F`, `BZ=F`, `DX-Y.NYB`, `^TNX`, `GLD`, `SLV`, `USO`, `BNO` | REST HTTP/JSON (`query1/query2.finance.yahoo.com`) | ~80–140ms | Indicative / Delayed ~10-15m on some equities; continuous on futures proxies | Publicly accessible query API without SLA. Non-commercial personal research only. | Explicitly labeled as `INDICATIVE REF · YAHOO_FINANCE / BENCHMARK`. Non-execution research only. | Auto-failover to `simulated_reference` after 3 consecutive failures. |
| `simulated_reference` | Aurum Calibrated Benchmark Engine | All 7 Canonical Instruments + Spreads | In-process synchronous TypeScript computation | ~2–5ms | Synthetic Zero Latency | Proprietary internal quantitative model | Disclosed as `SIMULATED BENCHMARK FEED`. Strictly for research modeling and platform continuity. | Primary default when offline or network sandboxed. |
| `wgc_quarterly` | World Gold Council (WGC) | Official Sector Central Bank Gold Reserves | Structured Static Research Ingestion | Quarterly | End of Quarter (T+30) | Public Research Disclosure | Cited with direct link to gold.org/goldhub | In-memory verified canonical dataset |
| `cftc_cot` | CFTC Commitments of Traders | COMEX Gold & Silver Speculative Managed Money | Weekly Disaggregated COT Releases | Weekly (Friday 15:30 ET) | T+3 business days | Public Domain (US Federal Government) | Cited with direct link to cftc.gov | Fallback historical benchmark averages |
| `stlouis_fred` | St. Louis Federal Reserve (FRED) | 10-Year TIPS Real Yield (DFII10), Breakeven | Periodic Benchmark Reference | Daily constant maturity | End of Day | Open Data (Public Domain) | Cited with direct link to fred.stlouisfed.org | Proxy derived via `^TNX` minus breakeven spread |
| `cboe_gvz` | CBOE Gold Volatility Index (GVZ) | Gold 30-Day Implied Volatility Surface | Benchmark Proxy Model | Continuous Daily | End of Day | CBOE Benchmark Index Proxy | Disclosed as "Parametric Smile Model Calibrated to CBOE GVZ" | 52-week statistical range & percentile model |

---

## 2. Mandatory Disclaimers & Regulatory Notices

1. **Indicative Reference Only:** All displayed market prices represent indicative reference rates and proxy continuous futures calculations. GoldVista does not provide direct trading venue access or primary market execution feeds.
2. **Strict Non-Execution:** In accordance with Implementation Addendum §2.3, market data is processed exclusively for analytical modeling, risk sizing, and paper trading simulation.
3. **No Direct Tick SLA:** Free public feeds are utilized for research demonstration. Commercial institutional deployment requires dedicated enterprise data feeds (e.g. ICE Data Services, CME Globex Direct, Bloomberg B-PIPE) under negotiated redistribution licenses.
