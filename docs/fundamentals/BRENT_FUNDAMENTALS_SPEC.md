# Brent Crude Oil Fundamental Evidence Model Specification
**Document Reference:** `docs/fundamentals/BRENT_FUNDAMENTALS_SPEC.md`  
**Effective Date:** November 13, 2026 | **Code Module:** `src/services/commodityFundamentalsEngine.ts`

## 1. Seaborne & Geopolitical Balance Model
1. **Brent–WTI Seaborne Arbitrage Spread (`BRENT_WTI_SEABORNE_SPREAD`):** Dynamically derived `BZ - CL` differential reflecting Atlantic Basin tanker flows and Dated Brent cargo stress (explicitly noting futures proxy vs physical BFOE assessments).
2. **OPEC+ Spare Capacity (`BRENT_OPEC_SPARE_CAPACITY`):** Monthly spare production estimate (`PRELIMINARY` status) bounding medium-term supply elasticity.
3. **Maritime Chokepoint Freight Risk (`BRENT_TRANSIT_FREIGHT_RISK`):** Curated Suez/Red Sea/Hormuz insurance surcharge estimate marked `PROXY_ESTIMATE` pending licensed Baltic/AIS tanker telemetry.
