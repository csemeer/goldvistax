# Fundamental Data Dictionary
**Document Reference:** `docs/fundamentals/FUNDAMENTAL_DATA_DICTIONARY.md`  
**Modules:** `src/services/cotIntelligence.ts`, `src/services/macroData.ts`, `src/services/commodityRegistry.ts`

| Series / Dataset | Commodity | Cadence | Primary Conceptual Source | Current Runtime Provision | Caveats |
|---|---|---|---|---|---|
| CFTC COMEX COT (`CANONICAL_COT_REPORTS`) | Gold, Silver, WTI | Weekly (Fri) | CFTC Disaggregated Report | Static/curated snapshot in code | Not live CFTC XML poll yet |
| Sovereign Vault Reserves (`CANONICAL_CENTRAL_BANK_FLOWS`) | Gold | Quarterly | World Gold Council (WGC) | Curated Q3 2026 baseline | Low-frequency quarterly data; do not convert into daily signals |
| Macro Releases (`MACRO_ECONOMIC_RELEASES`) | Cross-Asset | Scheduled | BLS / BEA / FOMC | Curated historical vintages | Point-in-time vintage structure preserved (`priorValueAsKnown`, `revisedValue`) |
| 10Y TIPS Proxy (`US_TIPS10Y`) | Macro | Intraday/Daily | FRED `DFII10` benchmark concept | Derived from Yahoo `^TNX` minus breakeven assumption | Explicit proxy fallback (`GAP-04`) |
