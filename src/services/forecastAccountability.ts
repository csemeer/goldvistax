/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * Aurum Intelligence — Cryptographic Forecast Accountability & Immutable Audit Engine
 *
 * Implements:
 * 1. Deterministic NIST-compliant SHA-256 hashing in pure TypeScript (cross-platform Node & Browser).
 * 2. Canonical serialization of pre-execution trade setups and invalidation conditions.
 * 3. Tamper-proof fingerprint verification for forecast accountability and reproducibility.
 * 4. Deterministic outcome evaluation (TARGET_HIT, STOPPED_OUT, INVALIDATED).
 */

import { Quote, TradePlan } from '../domain/types';

/**
 * Pure TypeScript NIST FIPS 180-4 standard SHA-256 hash algorithm.
 * Operates synchronously with 0 external dependencies across both Node.js and Browser runtimes.
 */
export function computeDeterministicSha256(ascii: string): string {
  function rightRotate(value: number, amount: number) {
    return (value >>> amount) | (value << (32 - amount));
  }

  const maxWord = Math.pow(2, 32);
  const lengthProperty = 'length';
  let i: number, j: number;
  let result = '';
  const words: number[] = [];
  const asciiBitLength = ascii[lengthProperty] * 8;
  let hash = [
    0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a, 0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19,
  ];

  const k = [
    0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5,
    0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
    0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
    0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
    0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
    0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
    0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
    0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2,
  ];

  let compositeClear = ascii + '\x80';
  while (compositeClear[lengthProperty] % 64 - 56) compositeClear += '\x00';
  for (i = 0; i < compositeClear[lengthProperty]; i++) {
    j = compositeClear.charCodeAt(i);
    words[i >> 2] |= j << (((3 - i) % 4) * 8);
  }
  words[words[lengthProperty]] = (asciiBitLength / maxWord) | 0;
  words[words[lengthProperty]] = asciiBitLength;

  for (j = 0; j < words[lengthProperty]; ) {
    const w = words.slice(j, (j += 16));
    const oldHash = hash;
    hash = hash.slice(0, 8);

    for (i = 0; i < 64; i++) {
      const w15 = w[i - 15],
        w2 = w[i - 2];
      const s0 = rightRotate(w15, 7) ^ rightRotate(w15, 18) ^ (w15 >>> 3);
      const s1 = rightRotate(w2, 17) ^ rightRotate(w2, 19) ^ (w2 >>> 10);
      w[i] = i < 16 ? w[i] : (w[i - 16] + s0 + w[i - 7] + s1) | 0;

      const ch = (hash[4] & hash[5]) ^ (~hash[4] & hash[6]);
      const maj = (hash[0] & hash[1]) ^ (hash[0] & hash[2]) ^ (hash[1] & hash[2]);
      const S1 = rightRotate(hash[4], 6) ^ rightRotate(hash[4], 11) ^ rightRotate(hash[4], 25);
      const S0 = rightRotate(hash[0], 2) ^ rightRotate(hash[0], 13) ^ rightRotate(hash[0], 22);
      const t1 = hash[7] + S1 + ch + k[i] + w[i];
      const t2 = S0 + maj;

      hash = [(t1 + t2) | 0].concat(hash);
      hash[4] = (hash[4] + t1) | 0;
    }

    for (i = 0; i < 8; i++) {
      hash[i] = (hash[i] + oldHash[i]) | 0;
    }
  }

  for (i = 0; i < 8; i++) {
    for (j = 3; j + 1; j--) {
      const b = (hash[i] >> (j * 8)) & 255;
      result += (b < 16 ? '0' : '') + b.toString(16);
    }
  }
  return result;
}

/**
 * Builds a deterministic canonical string representation of the trade plan snapshot.
 */
export function buildCanonicalPlanPayload(plan: Partial<TradePlan>): string {
  const parts = [
    `ID:${plan.id || ''}`,
    `INST:${plan.instrumentId || ''}`,
    `HORIZON:${plan.horizon || ''}`,
    `DIR:${plan.direction || ''}`,
    `MID:${Number(plan.currentMid || 0).toFixed(2)}`,
    `ENTRY_MIN:${Number(plan.entryZoneMin || 0).toFixed(2)}`,
    `ENTRY_MAX:${Number(plan.entryZoneMax || 0).toFixed(2)}`,
    `STOP:${Number(plan.stopLossPrice || 0).toFixed(2)}`,
    `T1:${Number(plan.target1Price || 0).toFixed(2)}`,
    `T2:${Number(plan.target2Price || 0).toFixed(2)}`,
    `T3:${Number(plan.target3Price || 0).toFixed(2)}`,
    `INVALIDATION:${plan.invalidationCondition || ''}`,
    `CREATED_AT:${plan.createdAt || ''}`,
  ];
  return parts.join('|');
}

/**
 * Generates an immutable SHA-256 fingerprint for a trade plan snapshot.
 */
export function generateTradePlanFingerprint(plan: Partial<TradePlan>): string {
  const canonical = buildCanonicalPlanPayload(plan);
  return computeDeterministicSha256(canonical);
}

/**
 * Verifies that a trade plan has not been tampered with since creation.
 */
export function verifyTradePlanIntegrity(plan: TradePlan): {
  isValid: boolean;
  expectedHash: string;
  actualHash?: string;
  message: string;
} {
  const expectedHash = generateTradePlanFingerprint(plan);
  const actualHash = plan.snapshotHash;

  if (!actualHash) {
    return {
      isValid: false,
      expectedHash,
      message: 'Unsigned plan: Missing snapshotHash fingerprint.',
    };
  }

  const isValid = expectedHash.toLowerCase() === actualHash.toLowerCase();
  return {
    isValid,
    expectedHash,
    actualHash,
    message: isValid
      ? 'Verified Immutable: Cryptographic SHA-256 digest matches pre-execution plan parameters.'
      : 'Tampering Detected: Calculated digest does not match recorded snapshotHash.',
  };
}

/**
 * Evaluates the outcome of a trade plan against current market price ticks.
 */
export function evaluateTradeOutcome(
  plan: TradePlan,
  currentMid: number
): {
  status: 'PENDING' | 'TARGET1_REACHED' | 'TARGET2_REACHED' | 'STOP_LOSS_HIT' | 'INVALIDATED';
  notes: string;
} {
  if (plan.isAbstained || plan.direction === 'NO_TRADE' || plan.direction === 'HOLD') {
    return {
      status: 'PENDING',
      notes: `Non-directional plan (${plan.direction}) excluded from directional target/stop scoring.`,
    };
  }

  if (plan.direction === 'BUY') {
    // Bullish evaluation
    if (currentMid >= plan.target2Price) {
      return {
        status: 'TARGET2_REACHED',
        notes: `Expansion Target 2 achieved at $${currentMid.toFixed(2)} (>= $${plan.target2Price.toFixed(2)})`,
      };
    }
    if (currentMid >= plan.target1Price) {
      return {
        status: 'TARGET1_REACHED',
        notes: `Harvest Target 1 achieved at $${currentMid.toFixed(2)} (>= $${plan.target1Price.toFixed(2)})`,
      };
    }
    if (currentMid <= plan.stopLossPrice) {
      return {
        status: 'STOP_LOSS_HIT',
        notes: `Stop loss breached at $${currentMid.toFixed(2)} (<= $${plan.stopLossPrice.toFixed(2)})`,
      };
    }
  } else if (plan.direction === 'SELL') {
    // Bearish evaluation
    if (currentMid <= plan.target2Price) {
      return {
        status: 'TARGET2_REACHED',
        notes: `Expansion Target 2 achieved at $${currentMid.toFixed(2)} (<= $${plan.target2Price.toFixed(2)})`,
      };
    }
    if (currentMid <= plan.target1Price) {
      return {
        status: 'TARGET1_REACHED',
        notes: `Harvest Target 1 achieved at $${currentMid.toFixed(2)} (<= $${plan.target1Price.toFixed(2)})`,
      };
    }
    if (currentMid >= plan.stopLossPrice) {
      return {
        status: 'STOP_LOSS_HIT',
        notes: `Stop loss breached at $${currentMid.toFixed(2)} (>= $${plan.stopLossPrice.toFixed(2)})`,
      };
    }
  }

  return {
    status: 'PENDING',
    notes: `Trade plan active. Spot mid $${currentMid.toFixed(2)} within execution bounds.`,
  };
}

export interface CandleOutcomeResult {
  status: 'PENDING' | 'TARGET1_REACHED' | 'TARGET2_REACHED' | 'STOP_LOSS_HIT' | 'INVALIDATED';
  exitPrice?: number;
  sameCandleAmbiguity: boolean;
  gapThroughStop: boolean;
  notes: string;
}

/**
 * Deterministic OHLC candle evaluator implementing:
 * 1. Gap-through-stop: If candle opens past stop loss, fill at candle.open.
 * 2. Same-candle ambiguity (Stop-First Conservative Rule): If both stop and target lie within [low, high], resolves to STOP_LOSS_HIT.
 */
export function evaluateCandleOutcome(
  plan: TradePlan,
  candle: { open: number; high: number; low: number; close: number; timestamp?: number | string }
): CandleOutcomeResult {
  if (plan.isAbstained || plan.direction === 'NO_TRADE' || plan.direction === 'HOLD') {
    return {
      status: 'PENDING',
      sameCandleAmbiguity: false,
      gapThroughStop: false,
      notes: `Non-directional plan (${plan.direction}) excluded from directional candle scoring.`,
    };
  }

  if (plan.direction === 'BUY') {
    if (candle.open <= plan.stopLossPrice) {
      return {
        status: 'STOP_LOSS_HIT',
        exitPrice: candle.open,
        sameCandleAmbiguity: false,
        gapThroughStop: true,
        notes: `Gap-through-stop on BUY plan: candle opened at $${candle.open.toFixed(2)} <= stop $${plan.stopLossPrice.toFixed(2)}.`,
      };
    }

    const hitStop = candle.low <= plan.stopLossPrice;
    const hitT1 = candle.high >= plan.target1Price;
    const hitT2 = candle.high >= plan.target2Price;

    if (hitStop && (hitT1 || hitT2)) {
      return {
        status: 'STOP_LOSS_HIT',
        exitPrice: plan.stopLossPrice,
        sameCandleAmbiguity: true,
        gapThroughStop: false,
        notes: `Same-candle collision on BUY plan (low $${candle.low.toFixed(2)} <= stop, high $${candle.high.toFixed(2)} >= target). Conservative Stop-First rule applied.`,
      };
    }
    if (hitStop) {
      return {
        status: 'STOP_LOSS_HIT',
        exitPrice: plan.stopLossPrice,
        sameCandleAmbiguity: false,
        gapThroughStop: false,
        notes: `Stop loss breached intrabar (low $${candle.low.toFixed(2)} <= $${plan.stopLossPrice.toFixed(2)}).`,
      };
    }
    if (hitT2) {
      return {
        status: 'TARGET2_REACHED',
        exitPrice: plan.target2Price,
        sameCandleAmbiguity: false,
        gapThroughStop: false,
        notes: `Target 2 achieved intrabar (high $${candle.high.toFixed(2)} >= $${plan.target2Price.toFixed(2)}).`,
      };
    }
    if (hitT1) {
      return {
        status: 'TARGET1_REACHED',
        exitPrice: plan.target1Price,
        sameCandleAmbiguity: false,
        gapThroughStop: false,
        notes: `Target 1 achieved intrabar (high $${candle.high.toFixed(2)} >= $${plan.target1Price.toFixed(2)}).`,
      };
    }
  } else if (plan.direction === 'SELL') {
    if (candle.open >= plan.stopLossPrice) {
      return {
        status: 'STOP_LOSS_HIT',
        exitPrice: candle.open,
        sameCandleAmbiguity: false,
        gapThroughStop: true,
        notes: `Gap-through-stop on SELL plan: candle opened at $${candle.open.toFixed(2)} >= stop $${plan.stopLossPrice.toFixed(2)}.`,
      };
    }

    const hitStop = candle.high >= plan.stopLossPrice;
    const hitT1 = candle.low <= plan.target1Price;
    const hitT2 = candle.low <= plan.target2Price;

    if (hitStop && (hitT1 || hitT2)) {
      return {
        status: 'STOP_LOSS_HIT',
        exitPrice: plan.stopLossPrice,
        sameCandleAmbiguity: true,
        gapThroughStop: false,
        notes: `Same-candle collision on SELL plan (high $${candle.high.toFixed(2)} >= stop, low $${candle.low.toFixed(2)} <= target). Conservative Stop-First rule applied.`,
      };
    }
    if (hitStop) {
      return {
        status: 'STOP_LOSS_HIT',
        exitPrice: plan.stopLossPrice,
        sameCandleAmbiguity: false,
        gapThroughStop: false,
        notes: `Stop loss breached intrabar (high $${candle.high.toFixed(2)} >= $${plan.stopLossPrice.toFixed(2)}).`,
      };
    }
    if (hitT2) {
      return {
        status: 'TARGET2_REACHED',
        exitPrice: plan.target2Price,
        sameCandleAmbiguity: false,
        gapThroughStop: false,
        notes: `Target 2 achieved intrabar (low $${candle.low.toFixed(2)} <= $${plan.target2Price.toFixed(2)}).`,
      };
    }
    if (hitT1) {
      return {
        status: 'TARGET1_REACHED',
        exitPrice: plan.target1Price,
        sameCandleAmbiguity: false,
        gapThroughStop: false,
        notes: `Target 1 achieved intrabar (low $${candle.low.toFixed(2)} <= $${plan.target1Price.toFixed(2)}).`,
      };
    }
  }

  return {
    status: 'PENDING',
    sameCandleAmbiguity: false,
    gapThroughStop: false,
    notes: `Trade plan pending within candle range [$${candle.low.toFixed(2)} - $${candle.high.toFixed(2)}].`,
  };
}

// -------------------------------------------------------------
// PHASE 5 (§8.1 - §8.2): IMMUTABLE FORECAST LIFECYCLE STATE MACHINE
// -------------------------------------------------------------

export type ForecastLifecycleState =
  | 'DRAFT'
  | 'VALIDATED'
  | 'PUBLISHED'
  | 'ACTIVE'
  | 'TARGET_REACHED'
  | 'STOP_REACHED'
  | 'INVALIDATED'
  | 'EXPIRED'
  | 'WITHDRAWN'
  | 'UNRESOLVED'
  | 'SUPERSEDED';

export interface ForecastTransitionEntry {
  from: ForecastLifecycleState | null;
  to: ForecastLifecycleState;
  timestamp: string;
  actor: string;
  reason: string;
}

export interface ForecastLifecycleRecord {
  forecastId: string;
  schemaVersion: '1.6.2';
  plan: TradePlan;
  snapshotHash: string;
  state: ForecastLifecycleState;
  createdAt: string;
  updatedAt: string;
  supersedesId?: string;
  supersededById?: string;
  isImmutableLocked: boolean;
  transitions: ForecastTransitionEntry[];
}

const ALLOWED_FORECAST_TRANSITIONS: Record<ForecastLifecycleState, ForecastLifecycleState[]> = {
  DRAFT: ['VALIDATED', 'WITHDRAWN'],
  VALIDATED: ['PUBLISHED', 'WITHDRAWN'],
  PUBLISHED: ['ACTIVE', 'WITHDRAWN', 'SUPERSEDED', 'EXPIRED', 'UNRESOLVED'],
  ACTIVE: ['TARGET_REACHED', 'STOP_REACHED', 'INVALIDATED', 'EXPIRED', 'UNRESOLVED', 'SUPERSEDED'],
  TARGET_REACHED: [],
  STOP_REACHED: [],
  INVALIDATED: [],
  EXPIRED: [],
  WITHDRAWN: [],
  UNRESOLVED: ['TARGET_REACHED', 'STOP_REACHED', 'INVALIDATED', 'EXPIRED'],
  SUPERSEDED: [],
};

export function createImmutableForecastRecord(
  plan: TradePlan,
  actor = 'system',
  initialState: ForecastLifecycleState = 'DRAFT',
  supersedesId?: string
): ForecastLifecycleRecord {
  const now = new Date().toISOString();
  const snapshotHash = generateTradePlanFingerprint(plan);
  const signedPlan: TradePlan = { ...plan, snapshotHash };

  return {
    forecastId: plan.id,
    schemaVersion: '1.6.2',
    plan: signedPlan,
    snapshotHash,
    state: initialState,
    createdAt: now,
    updatedAt: now,
    supersedesId,
    isImmutableLocked: initialState !== 'DRAFT',
    transitions: [
      {
        from: null,
        to: initialState,
        timestamp: now,
        actor,
        reason: supersedesId
          ? `Initialized immutable forecast superseding ${supersedesId}`
          : 'Initialized forecast record with SHA-256 pre-execution snapshot',
      },
    ],
  };
}

export function transitionForecastLifecycle(
  record: ForecastLifecycleRecord,
  nextState: ForecastLifecycleState,
  reason: string,
  actor = 'system'
): ForecastLifecycleRecord {
  // Integrity check before any transition beyond DRAFT
  const integrity = verifyTradePlanIntegrity(record.plan);
  if (!integrity.isValid || record.plan.snapshotHash !== record.snapshotHash) {
    throw new Error(`Immutable snapshot integrity violation on ${record.forecastId}: ${integrity.message}`);
  }

  const allowed = ALLOWED_FORECAST_TRANSITIONS[record.state] || [];
  if (!allowed.includes(nextState)) {
    throw new Error(`Illegal forecast lifecycle transition: ${record.state} -> ${nextState} on ${record.forecastId}`);
  }

  const now = new Date().toISOString();
  return {
    ...record,
    state: nextState,
    updatedAt: now,
    isImmutableLocked: true,
    transitions: [
      ...record.transitions,
      {
        from: record.state,
        to: nextState,
        timestamp: now,
        actor,
        reason,
      },
    ],
  };
}

export function supersedePublishedForecast(
  priorRecord: ForecastLifecycleRecord,
  replacementPlan: TradePlan,
  reason: string,
  actor = 'system'
): { priorUpdated: ForecastLifecycleRecord; successor: ForecastLifecycleRecord } {
  const transitionedPrior = transitionForecastLifecycle(
    priorRecord,
    'SUPERSEDED',
    `Superseded by ${replacementPlan.id}: ${reason}`,
    actor
  );
  const priorUpdated: ForecastLifecycleRecord = {
    ...transitionedPrior,
    supersededById: replacementPlan.id,
  };
  const successor = createImmutableForecastRecord(replacementPlan, actor, 'PUBLISHED', priorRecord.forecastId);
  return { priorUpdated, successor };
}

