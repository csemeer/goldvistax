# Mandatory No-Trade & Abstention Rules
**Document Reference:** `docs/decision/NO_TRADE_RULES.md`  
**Implementation:** `src/services/advisoryEngine.ts`, `src/services/riskEngine.ts`, `src/services/aiGovernanceEngine.ts`

1. **Stale / Degraded Market Data:** `quote.quality === 'STALE'` or `'QUALITY_HOLD'` forces `isAbstained = true` (`DATA_QUALITY_HOLD`).
2. **Prop Challenge Drawdown Lockout:** Consuming `>= 75%` daily drawdown or `<= $250` buffer triggers `EMERGENCY_LOCKOUT` with `safePositionLots = 0`.
3. **Excessive Spread / Risk Limits:** `riskPercent > 5.0%`, `spread > 100 pips`, or `netRewardRiskRatio < 1.4` triggers hard-limit failure (`isCompliantWithHardLimits = false`).
4. **AI Council Deadlock / Veto:** Quorum `< 4`, `disagreementIndexPct >= 45%`, or `INDEPENDENT_CHALLENGE` veto forces `GRIDLOCK_ABSTAIN` or `ADVERSARIAL_VETO`.
