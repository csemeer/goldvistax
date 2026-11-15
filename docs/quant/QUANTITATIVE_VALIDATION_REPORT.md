# Quantitative Validation Report
**Document Reference:** `docs/quant/QUANTITATIVE_VALIDATION_REPORT.md`  
**Validation Evidence:** `tests/multiCommodity.test.ts` (Tests 4, 8, 15, 16, 17, 20, 21, 22)

## 1. Scope & Independent Reference Testing
Independent hand-derived numerical tests (`Test 21` & `Test 22`) validated the core deterministic math modules within strict tolerances (`1e-4` to `0.01`):
- **Technical Indicators (`indicators.ts`):** `calculateEMA`, `calculateRSI` (Wilder smoothing), and `calculateATR` verified against step-by-step arithmetic arrays.
- **Position Sizing & Risk (`riskEngine.ts`):** `calculateCFDRisk` lot sizing `(equity * riskPct / 100) / (stopDist * multiplier)`, step rounding, spread/commission deductions, and negative boundary rejections (`riskPct > 5%`, `spread > 100 pips`).
- **Prop Guardrail (`riskEngine.ts`):** `evaluatePropFirmGuardrail` 0.75% hard single-trade ceiling and 75% daily loss lockout verified in `Test 17`.
- **Forecast Metrics (`forecastScorecardEngine.ts`):** Brier Score, MAE, and RMSE verified against closed-form analytical examples (`Test 21`).

## 2. Backtest & Simulation Honesty Assessment
- **`advancedBacktestingEngine.ts` Finding:** Walk-forward folds (`runWalkForwardOptimization`) currently apply deterministic heuristic OOS haircuts rather than re-optimizing live strategy parameters per fold window; Monte Carlo uses replacement bootstrap assuming i.i.d. returns; session slippage uses fixed illustrative constants (`20.8`, `29.8`, `46.0`, `53.5` pips).
- **Remediation Completed:** Removed `"Pardo (2008) Certified"` and `"confirms robust parameter stability"` claims in code and `BacktestingWorkspace.tsx`; added explicit `isSimulatedEvaluation: true` and `isIllustrativeDefault: true` provenance flags.
