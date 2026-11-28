/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * Aurum Intelligence — Value-Driven Commercialization & Monetization Engine
 * Manages user credits, 100% stop-loss refunds, broker-subsidized tiers, and Stripe checkout.
 */

export type MembershipTier = 'FREE' | 'PRO' | 'ALPHA';

export interface CreditPack {
  id: string;
  name: string;
  credits: number;
  bonusCredits: number;
  priceUsd: number;
  badge?: string;
  popular?: boolean;
}

export interface BrokerPartner {
  id: string;
  name: string;
  tagline: string;
  regulation: string;
  typicalGoldSpread: string;
  rebatePerLotUsd: number;
  minDeposit: number;
  perk: string;
  rating: number;
}

export type CreditTransactionType =
  | 'INITIAL_GRANT'
  | 'DAILY_REGEN'
  | 'UNLOCK_DEBIT'
  | 'SL_CREDIT_REFUND'
  | 'PACK_PURCHASE'
  | 'TIER_GRANT'
  | 'BROKER_BONUS';

export interface CreditLedgerEntry {
  id: string;
  idempotencyKey: string;
  transactionType: CreditTransactionType;
  deltaCredits: number;
  beforeBalance: number;
  afterBalance: number;
  relatedPlanId?: string;
  timestamp: string;
  note: string;
}

export interface UnlockedPlanEntry {
  planId: string;
  unlockedAt: string;
  costCredits: number;
  status: 'ACTIVE' | 'TARGET_REACHED' | 'STOPPED_REFUNDED';
  refunded: boolean;
  stopPrice: number;
  targetPrice: number;
  direction: 'BUY' | 'SELL';
}

export interface UserEntitlementState {
  tier: MembershipTier;
  tierExpiresAt?: string;
  creditsBalance: number;
  lastDailyRegenTimestamp: number;
  unlockedPlans: Record<string, UnlockedPlanEntry>;
  refundedCreditsTotal: number;
  estimatedMoneySavedDollars: number;
  linkedBrokerId?: string;
  brokerAccountNumber?: string;
  creditLedger?: CreditLedgerEntry[];
}

export const CREDIT_PACKS: CreditPack[] = [
  {
    id: 'pack_starter',
    name: 'Starter Signal Booster',
    credits: 25,
    bonusCredits: 0,
    priceUsd: 9,
    badge: '$0.36 / signal',
  },
  {
    id: 'pack_trader',
    name: 'Active Trader Pack',
    credits: 100,
    bonusCredits: 15,
    priceUsd: 29,
    badge: '15 Free Bonus Credits',
    popular: true,
  },
  {
    id: 'pack_fund',
    name: 'Institutional Allocator Pack',
    credits: 300,
    bonusCredits: 60,
    priceUsd: 69,
    badge: '60 Free Bonus Credits · Max Value',
  },
];

export const BROKER_PARTNERS: BrokerPartner[] = [
  {
    id: 'ic_markets',
    name: 'IC Markets Global',
    tagline: 'World’s #1 Raw ECN Commodity & CFD Liquidity Provider',
    regulation: 'ASIC (Australia) · CySEC (EU) · FSA',
    typicalGoldSpread: '0.12 pts (Raw ECN)',
    rebatePerLotUsd: 2.50,
    minDeposit: 200,
    perk: 'Partner-Sponsored GoldVista Pro Access with 2 qualifying lots/mo',
    rating: 4.9,
  },
  {
    id: 'pepperstone',
    name: 'Pepperstone',
    tagline: 'Ultra-fast ECN Execution on cTrader, TradingView & MT5',
    regulation: 'FCA (UK) · ASIC · DFSA · BaFin',
    typicalGoldSpread: '0.15 pts (Razor)',
    rebatePerLotUsd: 2.25,
    minDeposit: 150,
    perk: 'Partner-Sponsored VIP Pro Access + Direct TradingView Webhook Link',
    rating: 4.9,
  },
  {
    id: 'tickmill',
    name: 'Tickmill Prime',
    tagline: 'Lowest Round-Turn Commissions on Precious Metals',
    regulation: 'FCA · CySEC · FSCA',
    typicalGoldSpread: '0.14 pts (Pro)',
    rebatePerLotUsd: 2.00,
    minDeposit: 100,
    perk: 'Partner-Sponsored Pro Access + $30 Broker Rebate Credit',
    rating: 4.8,
  },
];

const STORAGE_KEY = 'goldvista_user_entitlements_v1';

function getEntitlementStorageKey(userId?: string): string {
  const normalized = typeof userId === 'string' ? userId.trim() : '';
  return normalized ? `${STORAGE_KEY}:${normalized}` : STORAGE_KEY;
}

export function getInitialEntitlements(): UserEntitlementState {
  const nowIso = new Date().toISOString();
  return {
    tier: 'FREE',
    creditsBalance: 5, // Welcoming initial 5 credits
    lastDailyRegenTimestamp: Date.now(),
    unlockedPlans: {},
    refundedCreditsTotal: 0,
    estimatedMoneySavedDollars: 240, // Base value delivered
    creditLedger: [
      {
        id: 'led_init_welcome',
        idempotencyKey: 'init_welcome_5',
        transactionType: 'INITIAL_GRANT',
        deltaCredits: 5,
        beforeBalance: 0,
        afterBalance: 5,
        timestamp: nowIso,
        note: 'Initial 5 welcome research signal credits',
      },
    ],
  };
}

function appendLedgerEntry(
  state: UserEntitlementState,
  transactionType: CreditTransactionType,
  deltaCredits: number,
  idempotencyKey: string,
  note: string,
  relatedPlanId?: string
): { ledger: CreditLedgerEntry[]; applied: boolean; beforeBalance: number; afterBalance: number } {
  const existingLedger = state.creditLedger || [];
  // Concurrency & duplicate guard via idempotencyKey
  if (existingLedger.some((entry) => entry.idempotencyKey === idempotencyKey)) {
    return {
      ledger: existingLedger,
      applied: false,
      beforeBalance: state.creditsBalance,
      afterBalance: state.creditsBalance,
    };
  }
  const beforeBalance = state.creditsBalance;
  const afterBalance = Math.max(0, beforeBalance + deltaCredits);
  const entry: CreditLedgerEntry = {
    id: `led_${Date.now()}_${existingLedger.length + 1}`,
    idempotencyKey,
    transactionType,
    deltaCredits,
    beforeBalance,
    afterBalance,
    relatedPlanId,
    timestamp: new Date().toISOString(),
    note,
  };
  return {
    ledger: [...existingLedger, entry],
    applied: true,
    beforeBalance,
    afterBalance,
  };
}

export function loadUserEntitlements(userId?: string): UserEntitlementState {
  const storageKey = getEntitlementStorageKey(userId);
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      const raw = window.localStorage.getItem(storageKey);
      if (raw) {
        const parsed: UserEntitlementState = JSON.parse(raw);
        // Auto regen check on load
        return checkAndApplyDailyRegen(parsed, userId);
      }
    }
  } catch (e) {
    console.warn('Failed to load user entitlements from storage:', e);
  }
  const initial = getInitialEntitlements();
  saveUserEntitlements(initial, userId);
  return initial;
}

export function saveUserEntitlements(state: UserEntitlementState, userId?: string): void {
  const storageKey = getEntitlementStorageKey(userId);
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      window.localStorage.setItem(storageKey, JSON.stringify(state));
    }
  } catch (e) {
    console.warn('Failed to save user entitlements to storage:', e);
  }
}

export function checkAndApplyDailyRegen(
  state: UserEntitlementState,
  userId?: string
): UserEntitlementState {
  const now = Date.now();
  const oneDayMs = 24 * 60 * 60 * 1000;
  if (now - state.lastDailyRegenTimestamp >= oneDayMs) {
    const dayBucket = new Date(now).toISOString().slice(0, 10);
    const targetFloor = Math.max(state.creditsBalance, 3);
    const delta = targetFloor - state.creditsBalance;
    if (delta > 0) {
      const ledgerRes = appendLedgerEntry(
        state,
        'DAILY_REGEN',
        delta,
        `daily_regen_${dayBucket}`,
        `Daily free scout replenishment (+${delta} credits)`
      );
      const updated: UserEntitlementState = {
        ...state,
        creditsBalance: ledgerRes.afterBalance,
        lastDailyRegenTimestamp: now,
        creditLedger: ledgerRes.ledger,
      };
      saveUserEntitlements(updated, userId);
      return updated;
    }
    const updated: UserEntitlementState = {
      ...state,
      lastDailyRegenTimestamp: now,
    };
    saveUserEntitlements(updated, userId);
    return updated;
  }
  return state;
}

/**
 * Checks if a specific plan is unlocked. If user is PRO or ALPHA, all plans are always unlocked.
 */
export function isPlanUnlocked(state: UserEntitlementState, planId: string): boolean {
  if (state.tier === 'PRO' || state.tier === 'ALPHA') return true;
  return Boolean(state.unlockedPlans[planId]);
}

/**
 * Unlocks a trade plan using 1 credit (FREE tier).
 * Stores stop and target prices to automatically process signal credit refunds if the trade stops out!
 */
export function unlockPlanWithGuarantee(
  state: UserEntitlementState,
  planId: string,
  stopPrice: number,
  targetPrice: number,
  direction: 'BUY' | 'SELL',
  userId?: string
): { success: boolean; updatedState: UserEntitlementState; message: string } {
  // If already unlocked
  if (isPlanUnlocked(state, planId)) {
    return { success: true, updatedState: state, message: 'Plan is already unlocked.' };
  }

  // If user has PRO or ALPHA
  if (state.tier === 'PRO' || state.tier === 'ALPHA') {
    return { success: true, updatedState: state, message: 'Unlocked with active Pro Membership.' };
  }

  // Check balance
  if (state.creditsBalance < 1) {
    return {
      success: false,
      updatedState: state,
      message: 'Insufficient credits. Upgrade to Pro or top up a micro credit pack.',
    };
  }

  const ledgerRes = appendLedgerEntry(
    state,
    'UNLOCK_DEBIT',
    -1,
    `unlock_debit_${planId}`,
    `Unlocked advisory corridor ${planId} (1 Signal Credit)`,
    planId
  );

  if (!ledgerRes.applied) {
    return { success: true, updatedState: state, message: 'Plan is already unlocked.' };
  }

  const newEntry: UnlockedPlanEntry = {
    planId,
    unlockedAt: new Date().toISOString(),
    costCredits: 1,
    status: 'ACTIVE',
    refunded: false,
    stopPrice,
    targetPrice,
    direction,
  };

  const updatedState: UserEntitlementState = {
    ...state,
    creditsBalance: ledgerRes.afterBalance,
    unlockedPlans: {
      ...state.unlockedPlans,
      [planId]: newEntry,
    },
    estimatedMoneySavedDollars: state.estimatedMoneySavedDollars + 45,
    creditLedger: ledgerRes.ledger,
  };

  saveUserEntitlements(updatedState, userId);
  return {
    success: true,
    updatedState,
    message: 'Plan unlocked! 100% Signal Credit Refund Guarantee active if stopped out (Non-Cash).',
  };
}

/**
 * Monitors active unlocked plans against live market price.
 * IF price hits stop loss before target, auto-refunds 1 Signal Credit (Non-Cash).
 */
export function evaluatePerformanceRefunds(
  state: UserEntitlementState,
  currentPrice: number,
  userId?: string
): { refundedCount: number; updatedState: UserEntitlementState; refundedPlanIds: string[] } {
  let workingState = state;
  let refundedCount = 0;
  const refundedPlanIds: string[] = [];
  const updatedPlans = { ...state.unlockedPlans };

  Object.values(updatedPlans).forEach((entry) => {
    if (entry.status !== 'ACTIVE' || entry.refunded) return;

    const hitStop =
      entry.direction === 'BUY'
        ? currentPrice <= entry.stopPrice
        : currentPrice >= entry.stopPrice;

    const hitTarget =
      entry.direction === 'BUY'
        ? currentPrice >= entry.targetPrice
        : currentPrice <= entry.targetPrice;

    if (hitStop) {
      const ledgerRes = appendLedgerEntry(
        workingState,
        'SL_CREDIT_REFUND',
        entry.costCredits || 1,
        `sl_refund_${entry.planId}`,
        `100% Signal Credit Refund (Non-Cash) triggered for stopped plan ${entry.planId} at $${currentPrice.toFixed(2)}`,
        entry.planId
      );
      entry.status = 'STOPPED_REFUNDED';
      entry.refunded = true;
      if (ledgerRes.applied) {
        refundedCount += entry.costCredits || 1;
        refundedPlanIds.push(entry.planId);
        workingState = {
          ...workingState,
          creditsBalance: ledgerRes.afterBalance,
          refundedCreditsTotal: workingState.refundedCreditsTotal + (entry.costCredits || 1),
          creditLedger: ledgerRes.ledger,
        };
      }
    } else if (hitTarget) {
      entry.status = 'TARGET_REACHED';
    }
  });

  if (refundedCount > 0) {
    const finalState: UserEntitlementState = {
      ...workingState,
      unlockedPlans: updatedPlans,
    };
    saveUserEntitlements(finalState, userId);
    return { refundedCount, updatedState: finalState, refundedPlanIds };
  }

  return { refundedCount: 0, updatedState: state, refundedPlanIds: [] };
}

/**
 * Links user to an institutional broker partner to unlock 100% free Pro membership
 */
export function linkBrokerPartnerAccount(
  state: UserEntitlementState,
  brokerId: string,
  accountNo: string,
  userId?: string
): UserEntitlementState {
  const ledgerRes = appendLedgerEntry(
    state,
    'BROKER_BONUS',
    50,
    `broker_link_${brokerId}_${accountNo}`,
    `Partner broker rebate bonus (+50 credits) via ${brokerId}`
  );
  const updated: UserEntitlementState = {
    ...state,
    tier: 'PRO',
    linkedBrokerId: brokerId,
    brokerAccountNumber: accountNo,
    creditsBalance: ledgerRes.afterBalance,
    estimatedMoneySavedDollars: state.estimatedMoneySavedDollars + 588,
    creditLedger: ledgerRes.ledger,
  };
  saveUserEntitlements(updated, userId);
  return updated;
}

/**
 * Adds purchased credit pack to state
 */
export function purchaseCreditPack(
  state: UserEntitlementState,
  packId: string,
  userId?: string
): UserEntitlementState {
  const pack = CREDIT_PACKS.find((p) => p.id === packId) || CREDIT_PACKS[0];
  const totalCredits = pack.credits + pack.bonusCredits;
  const ledgerRes = appendLedgerEntry(
    state,
    'PACK_PURCHASE',
    totalCredits,
    `pack_${pack.id}_${Date.now()}_${(state.creditLedger || []).length}`,
    `Purchased ${pack.name} (+${totalCredits} credits)`
  );
  const updated: UserEntitlementState = {
    ...state,
    creditsBalance: ledgerRes.afterBalance,
    estimatedMoneySavedDollars: state.estimatedMoneySavedDollars + totalCredits * 35,
    creditLedger: ledgerRes.ledger,
  };
  saveUserEntitlements(updated, userId);
  return updated;
}

/**
 * Upgrades membership tier directly
 */
export function upgradeMembershipTier(
  state: UserEntitlementState,
  newTier: MembershipTier,
  userId?: string
): UserEntitlementState {
  const tierGrant = newTier === 'ALPHA' ? 500 : 100;
  const ledgerRes = appendLedgerEntry(
    state,
    'TIER_GRANT',
    tierGrant,
    `tier_${newTier}_${Date.now()}_${(state.creditLedger || []).length}`,
    `Upgraded membership tier to ${newTier} (+${tierGrant} credits)`
  );
  const updated: UserEntitlementState = {
    ...state,
    tier: newTier,
    tierExpiresAt: new Date(Date.now() + 365 * 24 * 3600 * 1000).toISOString(),
    creditsBalance: ledgerRes.afterBalance,
    estimatedMoneySavedDollars: state.estimatedMoneySavedDollars + (newTier === 'ALPHA' ? 2400 : 600),
    creditLedger: ledgerRes.ledger,
  };
  saveUserEntitlements(updated, userId);
  return updated;
}

