# WTI Crude Oil Fundamental Evidence Model Specification
**Document Reference:** `docs/fundamentals/WTI_FUNDAMENTALS_SPEC.md`  
**Effective Date:** November 13, 2026 | **Code Module:** `src/services/commodityFundamentalsEngine.ts`

## 1. Domestic US Physical Inventory & Refinery Model
1. **EIA Weekly Commercial Stocks Delta (`WTI_EIA_COMMERCIAL_STOCKS_CHG`):** Weekly commercial crude build/draw excluding SPR (`EIA-WCESTUS1`).
2. **Cushing, Oklahoma Delivery Hub Stocks (`WTI_CUSHING_HUB_STOCKS`):** Physical settlement hub inventory (`EIA-WCSSTUS1`) tracking proximity to ~20M bbl operational tank bottoms.
3. **US Operable Refinery Utilization (`WTI_US_REFINERY_UTILIZATION`):** PADD utilization % (`EIA-WPULEUS3`) controlling for seasonal refinery turnaround maintenance.
