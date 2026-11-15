# Unified Decision Schema
**Document Reference:** `docs/decision/UNIFIED_DECISION_SCHEMA.md`  
**Source of Truth:** `src/domain/types.ts` (`TradePlan`, `TradeDirection`, `RecommendationState`)

- **Directions:** `'BUY' | 'SELL' | 'HOLD' | 'REDUCE' | 'NO_TRADE'`
- **States:** Includes `'DATA_QUALITY_HOLD'`, `'NO_TRADE'`, `'WAIT'`, `'BUY_CONFIRMED'`, `'SELL_CONFIRMED'`, `'EXIT_TRIGGERED'`.
- **Mandatory Fields:** `id`, `instrumentId`, `horizon`, `direction`, `state`, `createdAt`, `expiryAt`, `currentMid`, `entryZoneMin/Max`, `stopLossPrice`, `target1/2/3Price`, `rewardToRiskRatio`, `invalidationCondition`, `isAbstained`, `abstentionReason`, `snapshotHash`.
- **Non-Execution Guarantee:** Strictly an advisory & paper-journal schema; contains zero broker order tags.
