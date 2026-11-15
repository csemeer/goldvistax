# Market Regime Engine Specification
**Document Reference:** `docs/research/MARKET_REGIME_ENGINE_SPEC.md`  
**Implementation:** `src/domain/types.ts` (`MarketRegimeType`), `src/services/macroData.ts` (`CURRENT_MARKET_REGIME`)

- **Current Implemented Regimes:** `'BULLISH_TREND' | 'BEARISH_TREND' | 'RANGE_COMPRESSION' | 'VOLATILITY_EXPANSION' | 'MACRO_TRANSITION'`.
- **Attributes Tracked:** `confidencePct`, `volatilityPercentile` (0-100), `trendStrengthAdx`, `macroAlignment` (`FAVORABLE | NEUTRAL | HEADWIND`), `summary`, `updatedAt`.
- **v1.7 Expansion:** Add automated feature-computed classification combining multi-timeframe EMA slope, ADX, ATR percentile, and explicit `UNKNOWN / INSUFFICIENT_EVIDENCE` state when feeds are degraded.
