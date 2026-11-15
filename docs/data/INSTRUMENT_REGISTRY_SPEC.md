# Canonical Instrument Registry Specification
**Document Reference:** `docs/data/INSTRUMENT_REGISTRY_SPEC.md`  
**Source of Truth:** `src/services/commodityRegistry.ts`, `src/domain/types.ts`

## 1. Registered Instruments (19 Total)
- **Gold (`GOLD`):** `XAUUSD` (Spot, $100/pt multiplier proxy), `GC_FUT` (COMEX Gold Futures), `XAU_CFD` (CFD), `GLD_ETF` (SPDR Gold Shares).
- **Silver (`SILVER`):** `XAGUSD` (Spot), `SI_FUT` (COMEX Silver Futures), `XAG_CFD` (CFD), `SLV_ETF` (iShares Silver Trust).
- **WTI Oil (`WTI_OIL`):** `WTI_CRUDE` (Spot/Benchmark Ref), `CL_FUT` (NYMEX WTI Futures), `WTI_CFD` (CFD), `USO_ETF` (United States Oil Fund).
- **Brent Oil (`BRENT_OIL`):** `BRENT_CRUDE` (Spot/Benchmark Ref), `BZ_FUT` (ICE Brent Futures), `BRENT_CFD` (CFD), `BNO_ETF` (United States Brent Oil Fund).
- **Macro Anchors:** `DXY` (US Dollar Index, `DX-Y.NYB`), `US10Y` (10Y Treasury Yield, `^TNX`), `US_TIPS10Y` (Derived Real Yield proxy: `^TNX` minus inflation breakeven assumption; **NOT** direct FRED `DFII10` tick feed).

## 2. Semantic & Unit Rules
- All canonical quotes normalize timestamps to ISO-8601 UTC.
- Spot/CFD instruments vs Exchange Futures (`GC=F`, `SI=F`, `CL=F`, `BZ=F`) carry distinct `assetClass`, `pipSize`, `contractMultiplier`, and `typicalSpreadPips`.
- `isTradePlanPrimary` designates the advisory reference anchor per commodity (`XAUUSD`, `XAGUSD`, `WTI_CRUDE`, `BRENT_CRUDE`).
- **Permitted Use:** Research, analytical display, and simulated paper sizing only. Zero live brokerage execution.
