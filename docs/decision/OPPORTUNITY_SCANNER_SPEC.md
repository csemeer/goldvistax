# Opportunity Scanner Specification
**Document Reference:** `docs/decision/OPPORTUNITY_SCANNER_SPEC.md`  
**Implementation:** `src/services/portfolioScannerEngine.ts`, `src/components/PortfolioJournalWorkspace.tsx`

- Scans across supported instruments (`XAUUSD`, `XAGUSD`, `WTI_CRUDE`, `BRENT_CRUDE`) computing deterministic R:R ratios, entry corridors, and directional setups (`Test 15`).
- Ranking is deterministic based on structural alignment and R:R rather than opaque LLM text scores.
- Coupled with `PortfolioMarginAggregator` (95% 1-day parametric VaR & +50bps real-yield shock simulation) strictly isolated within the Paper Journal workspace.
