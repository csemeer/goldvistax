# Outcome Evaluation Rules
**Document Reference:** `docs/forecast/OUTCOME_EVALUATION_RULES.md`  
**Implementation:** `src/services/forecastAccountability.ts` (`evaluateTradeOutcome`, `evaluateCandleOutcome`)

## 1. Deterministic Spot & Candle Resolution Rules (`Test 21`)
- **Gap-Through-Stop Rule:** If candle `open` breaches `stopLossPrice` adversely (`<= stopLossPrice` for BUY; `>= stopLossPrice` for SELL), outcome is `STOP_LOSS_HIT` with `gapThroughStop: true` and `exitPrice = candle.open`.
- **Same-Candle Collision Rule (Stop-First Conservative Policy):** When intrabar sequence is unknown and a single OHLC bar touches both `stopLossPrice` and `target1Price`/`target2Price`, `evaluateCandleOutcome` flags `sameCandleAmbiguity: true` and resolves conservatively to `STOP_LOSS_HIT` at `plan.stopLossPrice`.
- **Clean Target Achievement:** Without stop touch, `target2Price` takes precedence over `target1Price`.
- **No Survivorship Bias:** Unresolved (`PENDING`), stopped (`STOP_LOSS_HIT`), and invalidated (`INVALIDATED`) plans remain permanently in the ledger.
