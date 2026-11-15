# Cross-Commodity Intelligence Specification
**Document Reference:** `docs/research/CROSS_COMMODITY_INTELLIGENCE_SPEC.md`  
**Implementation:** `src/services/crossCommoditySpreads.ts`, `src/components/CrossCommoditySpreadsPanel.tsx`

## 1. Tracked Relationships
- **Gold / Silver Ratio (`XAU/XAG`):** Tracks 5-year historical percentile & industrial/monetary metal beta (`Test 12`).
- **WTI / Brent Crude Differential:** Measures geopolitical maritime risk & US export arbitrage spread.
- **Gold vs US 10Y TIPS / Breakeven Proxy:** Tracks real-rate opportunity cost sensitivity.

## 2. Analytical Boundaries
- Spread z-scores and percentiles describe historical co-movement; **correlation does not imply permanent causation**.
- Timestamps align to daily UTC market closes without forward-looking interpolation.
