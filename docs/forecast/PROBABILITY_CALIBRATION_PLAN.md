# Probability Calibration Plan
**Document Reference:** `docs/forecast/PROBABILITY_CALIBRATION_PLAN.md`  
**Current Implementation:** `src/services/forecastScorecardEngine.ts` (`calculateBrierScore`, `probabilityCalibrationCurve`)

## 1. Current State & Honest Disclosure
- `calculateBrierScore` computes true mean squared probability error `(1/N) * sum((p_i - y_i)^2)` and is independently verified in `Test 21`.
- Currently, historical resolved records lack per-forecast pre-registered calibrated probability fields, so `aggregateSegment` uses a fixed `0.70` reference placeholder and `probabilityCalibrationCurve` displays illustrative reliability bins (`60-69%`, `70-79%`, `80-89%`).
- **Non-Deception Rule:** Do not equate subjective AI agent `convictionScorePct` with empirical hit probability.

## 2. v1.7 Calibration Upgrade Path
1. Store raw model probability estimates on every newly published `TradePlan` snapshot (`calibratedProbabilityPct`).
2. Require minimum `N >= 30` out-of-sample resolved forecasts per probability bin before publishing reliability curves from live database observations; suppress numeric probabilities below minimum sample size (`N < 30`).
3. Add isotonic regression / Platt scaling check comparing forecast Brier Skill Score against climatological base rate.
