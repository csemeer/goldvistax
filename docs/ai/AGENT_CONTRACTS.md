# Specialist Agent Contracts
**Document Reference:** `docs/ai/AGENT_CONTRACTS.md`  
**Implementation:** `src/domain/types.ts` (`SpecialistAgentRole`, `AgentAssessment`), `src/services/advisoryEngine.ts`, `src/services/aiGovernanceEngine.ts`

## 1. Roster & Quorum
- Type system defines up to 11 specialist roles (`MACRO_INTELLIGENCE`, `HISTORICAL_RESEARCH`, `GOLD_FUNDAMENTALS`, `TECHNICAL_ANALYSIS`, `QUANTITATIVE_STRATEGY`, `MARKET_STRUCTURE`, `NEWS_EVENT_RISK`, `CFD_RISK`, `PORTFOLIO_EXPOSURE`, `INDEPENDENT_CHALLENGE`, `ADVISORY_COUNCIL`).
- Minimum quorum enforced deterministically at `quorumThreshold = 4` active non-zero specialists; convictions `< 65%` are counted as abstentions.

## 2. Explicit Governance States Mapped to Addendum §7.2
| Council State | `evaluateCouncilConsensus` Mapping | Meaning |
|---|---|---|
| Full / Consensus | `STRONG_CONSENSUS_BULLISH` / `STRONG_CONSENSUS_BEARISH` / `MODERATE_*` | Quorum `>= 4` met and disagreement `< 45%` without veto |
| Insufficient Quorum | `GRIDLOCK_ABSTAIN` (`!hasQuorum`) | Fewer than 4 valid active specialists -> stand down |
| Conflicted | `GRIDLOCK_ABSTAIN` (`disagreementIndexPct >= 45%`) | High specialist divergence suspends directional signal |
| Vetoed | `ADVERSARIAL_VETO` | `INDEPENDENT_CHALLENGE` agent (`>=85%` conviction warning) vetoes consensus |

## 3. Data Provenance Discipline
- Specialists consume deterministic evidence (`EVIDENCE_REGISTRY`), technical snapshots, and CFTC COT / macro series; they do **not** claim raw exchange Level-3 order-book flow when analyzing spot/proxy candles.
