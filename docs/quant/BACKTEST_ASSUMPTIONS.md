# Backtest Assumptions & Limitations
**Document Reference:** `docs/quant/BACKTEST_ASSUMPTIONS.md`  
**Modules:** `src/services/strategyEngine.ts`, `src/services/advancedBacktestingEngine.ts`

1. **Execution Friction Defaults:** Base simulation uses configurable spread (default `28` pips for XAU/USD) and `$7.00` round-turn commission per 1.00 lot.
2. **Illustrative Session Slippage Constants (`isIllustrativeDefault: true`):**
   - London/NY Overlap (`13:00-17:00 UTC`): 20 pips spread + 0.8 pips slippage (`20.8`).
   - Asian (`00:00-08:00 UTC`): 28 + 1.8 (`29.8`).
   - Daily Rollover (`21:45-22:30 UTC`): 42 + 4.0 (`46.0`).
   - High-Impact Event Shock: 45 + 8.5 (`53.5`).
   - *Disclosure:* These are illustrative modeling assumptions, not empirical broker L2 order-book fill telemetry.
3. **Walk-Forward Simulation (`isSimulatedEvaluation: true`):** Currently evaluates k-fold splits using deterministic heuristic OOS decay multipliers rather than full parameter grid re-optimization per fold. Results are illustrative stress views, not independent statistical certification.
4. **Monte Carlo Permutation:** Uses `1,000` replacement resamples (`Math.random()`). Does not capture serial volatility clustering or regime structural breaks (block bootstrap deferred to v1.7).
5. **Same-Candle Collision & Gap Rule:** Enforced in `forecastAccountability.ts` (`evaluateCandleOutcome`) via conservative Stop-First resolution and open-price gap fill.
