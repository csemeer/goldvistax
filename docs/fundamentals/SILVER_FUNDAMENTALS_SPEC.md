# Silver Fundamental Evidence Model Specification
**Document Reference:** `docs/fundamentals/SILVER_FUNDAMENTALS_SPEC.md`  
**Effective Date:** November 13, 2026 | **Code Module:** `src/services/commodityFundamentalsEngine.ts`

## 1. Distinct Dual-Nature Evidence Model
1. **Industrial & Solar PV Absorption (`SILVER_SOLAR_PV_SHARE_ANNUAL`):** Tracks photovoltaic & electronics demand share (~56.4% of fabrication). Explicitly flags substitution/thrifting risk and `REVISED` quarterly cadence.
2. **Global Physical Balance Deficit (`SILVER_PHYSICAL_BALANCE_DEFICIT`):** Total mined/recycled supply minus physical fabrication and bar demand (million oz). Notes unreported private vault drawdown caveat.
3. **Gold-to-Silver Mint Ratio (`SILVER_GSR_SPREAD_REGIME`):** Live daily relative-value signal (`XAU / XAG`) computed dynamically against 5Y percentile distribution.
