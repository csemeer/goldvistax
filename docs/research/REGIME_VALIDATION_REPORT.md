# Regime Validation Report
**Document Reference:** `docs/research/REGIME_VALIDATION_REPORT.md`

- **Verified Behaviour:** `macroData.ts` provides regime context and historical analog matching (`findHistoricalAnalogs`); `forecastScorecardEngine.ts` segments forecast scorecards across `BULLISH_TREND` and `EVENT_VOLATILITY` regimes (`Test 21`).
- **Current Limitation:** Live candle-computed dynamic regime switching (ADX + ATR percentile classifier with `UNKNOWN` fallback) is static/macro-configured in v1.6.x and targeted for full dynamic implementation in v1.7.
