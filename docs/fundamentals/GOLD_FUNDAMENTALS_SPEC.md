# Gold Fundamental Evidence Model Specification
**Document Reference:** `docs/fundamentals/GOLD_FUNDAMENTALS_SPEC.md`  
**Effective Date:** November 13, 2026 | **Code Module:** `src/services/commodityFundamentalsEngine.ts`

## 1. Distinct Structural Drivers
1. **Official Sovereign Reserves (`GOLD_CB_NET_PURCHASES_Q`):** Quarterly World Gold Council & IMF IFS official central bank net purchases (tonnes). Slow-moving structural anchor; explicitly labeled `LAG_DISCLOSED` (`QUARTERLY`) so annual/quarterly figures are never misrepresented as high-frequency intraday timing signals.
2. **Physical ETF Net Flows (`GOLD_ETF_NET_FLOW_M`):** Monthly tonnage changes across physically allocated ETFs (`GLD`, `IAU`, European sovereign vehicles).
3. **US 10Y TIPS Real Yield (`GOLD_US_10Y_TIPS_REAL_YIELD`):** Opportunity-cost anchor for non-yielding bullion (`FRED-DFII10`). Marked `PROXY_ESTIMATE` whenever nominal 10Y minus breakeven fallback is active (`GAP-04`).
4. **COMEX Vault Registered Coverage (`GOLD_COMEX_REGISTERED_COVERAGE`):** Deliverable registered gold divided by front-month paper open interest (`EXCHANGE_FILING`).

## 2. Timestamp & Revision Discipline
Every observation records `observationPeriod`, `releaseTime`, and `retrievalTime` independently plus `revisionStatus` (`PRELIMINARY` / `REVISED` / `FINAL`) and `limitations`.
