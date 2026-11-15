# Strategy Catalog Scorecard
**Document Reference:** `docs/quant/STRATEGY_SCORECARD.md`  
**Source of Truth:** `src/services/strategyEngine.ts`

| Strategy ID | Name | Applicable Horizons | Core Mathematical Signal | Status |
|---|---|---|---|---|
| `STRAT-01` .. `STRAT-10` | 10-Strategy Gold & Macro Quantitative Suite (`QUANTITATIVE_STRATEGIES`) | `INTRADAY`, `SWING`, `LONG_TERM` | EMA/SMA crossovers, RSI momentum, ATR breakout corridors, Mean Reversion, Volatility Squeeze | Deterministic execution & simulation verified (`Test 8`, `Test 16`) |

## Governance Caveats
- Catalog benchmark KPIs (`winRatePct`, `profitFactor`, `sharpeRatio`) represent baseline simulation parameters across default historical series and **do not** imply live capital profitability.
- Interactive parameter tuning in `BacktestingWorkspace.tsx` is gated for `PRO`/`ALPHA` tiers and updates equity curves deterministically from the loaded candle history.
- Future v1.7 enhancement: attach walk-forward holdout datasets per strategy and compute out-of-sample deflated Sharpe ratio.
