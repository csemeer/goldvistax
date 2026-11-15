# Forecast Scorecard Specification
**Document Reference:** `docs/forecast/FORECAST_SCORECARD_SPEC.md`  
**Implementation:** `src/services/forecastScorecardEngine.ts`, `src/components/CrossCommoditySpreadsPanel.tsx`, `GET /api/forecast/scorecard`

## 1. Segmented Reporting Dimensions
- `overallScorecard`: Aggregate metrics across all ledger entries.
- `byInstrument`: Segmented for `XAUUSD`, `XAGUSD`, `WTI_CRUDE`.
- `byHorizon`: Segmented for `INTRADAY`, `SWING`, `LONG_TERM`.
- `byRegime`: Segmented for `BULLISH_TREND`, `EVENT_VOLATILITY`.

## 2. Scorecard Metrics Implemented & Tested (`Test 21`)
- `winRatePct`, `profitFactor`, `avgProjectedRr`, `avgRealizedRr`
- `brierScore` (`(1/N) * sum((p - y)^2)`)
- `maePriceUsd` and `rmsePriceUsd` (Target 1 deviation vs realized price)
- `avgMfeRr` and `avgMaeRr` excursion multiples
- Transparent counts of `resolvedCount`, `targetsReached`, `stopsHit`, and `invalidatedCount`.
