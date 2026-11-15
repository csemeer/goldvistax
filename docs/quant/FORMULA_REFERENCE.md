# Quantitative Formula Reference
**Document Reference:** `docs/quant/FORMULA_REFERENCE.md`  
**Modules:** `indicators.ts`, `riskEngine.ts`, `forecastScorecardEngine.ts`, `futuresOptionsEngine.ts`

1. **Exponential Moving Average (`calculateEMA`):**
   `SMA_init = (1/N) * sum(P_{0..N-1})`, `k = 2 / (N + 1)`, `EMA_t = (P_t - EMA_{t-1}) * k + EMA_{t-1}`.
2. **Relative Strength Index (`calculateRSI`):**
   Wilder smoothed `avgGain_t = (avgGain_{t-1} * (N - 1) + gain_t) / N`; `RSI = 100 - 100 / (1 + avgGain / avgLoss)`.
3. **Average True Range (`calculateATR`):**
   `TR_t = max(H_t - L_t, |H_t - C_{t-1}|, |L_t - C_{t-1}|)`; Wilder smoothed `ATR_t = (ATR_{t-1} * (N - 1) + TR_t) / N`.
4. **CFD Position Sizing (`calculateCFDRisk`):**
   `RiskDollar = Equity * (RiskPct / 100)`; `RawLots = RiskDollar / (|Entry - Stop| * ContractMultiplier)`. Net R:R deducts `(SpreadPips * PipSize * ContractMultiplier + $7/lot) * RoundedLots`.
5. **Brier Score (`calculateBrierScore`):**
   `(1 / M) * sum((p_i - y_i)^2)` where `y_i in {0, 1}`. Verified `[0.8, 0.6]` vs `[1, 0]` = `0.2000`.
6. **Error Metrics (`calculateForecastErrors`):**
   `MAE = (1/M) * sum(|P_pred - P_realized|)`; `RMSE = sqrt((1/M) * sum((P_pred - P_realized)^2))`.
7. **Futures Convenience Yield (`calculateFuturesTermStructure`):**
   `CarryRate = SOFR (4.85%) + Storage (0.25%) = 5.10%`; `ConvenienceYield = CarryRate - FrontMonthAnnualizedBasis`.
