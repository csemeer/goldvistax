import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';
import {
  getInitialEntitlements,
  unlockPlanWithGuarantee,
  evaluatePerformanceRefunds,
  linkBrokerPartnerAccount,
  purchaseCreditPack,
  upgradeMembershipTier,
  isPlanUnlocked,
  CREDIT_PACKS,
  BROKER_PARTNERS,
} from '../src/services/monetizationEngine';

console.log('--- STARTING GOLDVISTA VALUE-FIRST MONETIZATION TEST SUITE ---');

// Test 1: Initial state & daily credits
console.log('Test 1: Initial state & welcome credits balance...');
const initial = getInitialEntitlements();
assert.strictEqual(initial.tier, 'FREE');
assert.strictEqual(initial.creditsBalance, 5, 'Should start with 5 initial welcome credits');
assert.strictEqual(initial.refundedCreditsTotal, 0);
console.log('✓ Initial entitlements verified.');

// Test 2: Unlocking a plan with 100% guarantee
console.log('Test 2: Unlocking plan with 100% performance refund guarantee...');
const planId = 'XAUUSD-SWING-TEST';
const unlockRes = unlockPlanWithGuarantee(initial, planId, 3980.0, 4120.0, 'BUY');
assert.strictEqual(unlockRes.success, true);
assert.strictEqual(unlockRes.updatedState.creditsBalance, 4, '1 credit deducted on unlock');
assert.strictEqual(isPlanUnlocked(unlockRes.updatedState, planId), true, 'Plan is now unlocked');
console.log('✓ Plan unlock verified with active guarantee.');

// Test 3: 100% Performance Guarantee Refund on Stop-Loss Hit
console.log('Test 3: 100% Stop-Loss Automatic Performance Refund...');
// Price drops to 3975.0 (below stop 3980.0)
const refundRes = evaluatePerformanceRefunds(unlockRes.updatedState, 3975.0);
assert.strictEqual(refundRes.refundedCount, 1, 'Should trigger 1 refund for stopped plan');
assert.strictEqual(refundRes.updatedState.creditsBalance, 5, 'Credit must be refunded back to balance');
assert.strictEqual(refundRes.updatedState.refundedCreditsTotal, 1);
assert.strictEqual(refundRes.updatedState.unlockedPlans[planId].status, 'STOPPED_REFUNDED');
console.log('✓ 100% Performance-Guaranteed Refund successfully refunded credit!');

// Test 4: Broker Rebate Linkage unlocks 100% Free Pro
console.log('Test 4: Broker Rebate Linkage unlocks 100% Free Pro...');
const brokerLinked = linkBrokerPartnerAccount(initial, 'ic_markets', 'MT5-998822');
assert.strictEqual(brokerLinked.tier, 'PRO');
assert.strictEqual(brokerLinked.linkedBrokerId, 'ic_markets');
assert.strictEqual(brokerLinked.brokerAccountNumber, 'MT5-998822');
assert.strictEqual(isPlanUnlocked(brokerLinked, 'ANY-NEW-PLAN-ID'), true, 'Pro tier unlocks all plans');
console.log('✓ Broker rebate sponsorship verified: Pro tier granted 100% free.');

// Test 5: Credit pack purchases & tier upgrades
console.log('Test 5: Stripe checkout pack purchases and tier upgrades...');
const packPurchased = purchaseCreditPack(initial, 'pack_starter');
assert.strictEqual(packPurchased.creditsBalance, 5 + 25, 'Starter pack adds 25 credits');

const tierUpgraded = upgradeMembershipTier(initial, 'ALPHA');
assert.strictEqual(tierUpgraded.tier, 'ALPHA');
assert.ok(tierUpgraded.creditsBalance >= 500);
console.log('✓ Stripe checkout & entitlement activations verified.');

// Test 6: Idempotent Webhook Event Processing & Replay Attack Defense (Phase 8)
console.log('Test 6: Idempotent Webhook Event Processing & Replay Defense...');
const { EnterpriseBillingEngine } = await import('../src/services/billingWebhookEngine');
const billingEngine = new EnterpriseBillingEngine();

// First-time event processing
const firstEvent = {
  id: 'evt_stripe_test_unique_101',
  type: 'checkout.session.completed',
  data: {
    object: {
      customer: 'usr_enterprise_client',
      mode: 'subscription' as const,
      metadata: {
        userId: 'usr_enterprise_client',
        tier: 'INSTITUTIONAL' as const,
      },
    },
  },
};
const firstProcessResult = billingEngine.processWebhookEvent(firstEvent);
assert.strictEqual(firstProcessResult.received, true);
assert.strictEqual(firstProcessResult.status, 'PROCESSED', 'First event delivery must be PROCESSED');
assert.strictEqual(firstProcessResult.userEntitlements?.tier, 'INSTITUTIONAL', 'Must grant INSTITUTIONAL tier');
assert.ok((firstProcessResult.userEntitlements?.creditsBalance || 0) >= 5000, 'Must grant institutional credit balance');

// Replay attack simulation: Same event ID re-submitted
const replayProcessResult = billingEngine.processWebhookEvent(firstEvent);
assert.strictEqual(replayProcessResult.received, true);
assert.strictEqual(replayProcessResult.status, 'DUPLICATE_IGNORED', 'Duplicate event MUST be ignored by idempotency key');
assert.ok(replayProcessResult.message?.includes('Idempotency key match'), 'Must cite idempotency key match');

// Subscription cancellation event
const cancellationEvent = {
  id: 'evt_stripe_test_unique_102',
  type: 'customer.subscription.deleted',
  data: {
    object: {
      customer: 'usr_enterprise_client',
      metadata: { userId: 'usr_enterprise_client' },
    },
  },
};
const cancelResult = billingEngine.processWebhookEvent(cancellationEvent);
assert.strictEqual(cancelResult.status, 'PROCESSED');
assert.strictEqual(cancelResult.userEntitlements?.tier, 'FREE', 'Canceled subscription downgrades to FREE');
console.log('✓ Idempotent Webhook & Replay Attack Defense verified.');

// Test 7: Enterprise Session Token Verification (Phase 8)
console.log('Test 7: Enterprise Session Token Verification...');
// Valid active session token
const validFutureTimestamp = Math.floor(Date.now() / 1000) + 7200; // 2 hours in future
const validToken = `aurum_sess_risk_manager_${validFutureTimestamp}`;
const validSessionResult = EnterpriseBillingEngine.verifySessionToken(validToken);
assert.strictEqual(validSessionResult.valid, true, 'Valid token must pass verification');
assert.strictEqual(validSessionResult.persona, 'risk_manager', 'Persona parsed from session token');
assert.strictEqual(validSessionResult.entitlements?.zeroBrokerRoutingEnforced, true, 'Zero broker routing enforced');

// Expired session token
const pastTimestamp = Math.floor(Date.now() / 1000) - 300; // 5 minutes in past
const expiredToken = `aurum_sess_fund_allocator_${pastTimestamp}`;
const expiredSessionResult = EnterpriseBillingEngine.verifySessionToken(expiredToken);
assert.strictEqual(expiredSessionResult.valid, false, 'Expired token must fail verification');
assert.strictEqual(expiredSessionResult.error, 'Session token expired');

// Missing token
const missingSessionResult = EnterpriseBillingEngine.verifySessionToken(undefined);
assert.strictEqual(missingSessionResult.valid, false, 'Missing token must fail verification');
console.log('✓ Enterprise Session Token Verification verified.');

// Test 8: Auditable Credit Ledger Invariants & Durable Webhook Adapter Across Restarts
console.log('Test 8: Auditable Credit Ledger & Durable Webhook Adapter Across Restarts...');
const ledgerStart = getInitialEntitlements();
assert.ok(ledgerStart.creditLedger && ledgerStart.creditLedger.length === 1, 'Initial state must seed INITIAL_GRANT ledger entry');

const afterUnlock = unlockPlanWithGuarantee(ledgerStart, 'PLAN-LEDGER-01', 3900, 3960, 'BUY');
assert.strictEqual(afterUnlock.success, true);
assert.strictEqual(afterUnlock.updatedState.creditLedger?.length, 2);
// Duplicate unlock same planId is idempotent & does not double debit
const dupUnlock = unlockPlanWithGuarantee(afterUnlock.updatedState, 'PLAN-LEDGER-01', 3900, 3960, 'BUY');
assert.strictEqual(dupUnlock.updatedState.creditsBalance, 4);
assert.strictEqual(dupUnlock.updatedState.creditLedger?.length, 2);

// Trigger SL credit refund -> appends SL_CREDIT_REFUND
const afterRefund = evaluatePerformanceRefunds(dupUnlock.updatedState, 3895);
assert.strictEqual(afterRefund.refundedCount, 1);
assert.strictEqual(afterRefund.updatedState.creditLedger?.length, 3);
assert.ok(afterUnlock.message.includes('Non-Cash'), 'Unlock refund message must state Non-Cash');

// Verify ledger arithmetic invariant: beforeBalance + deltaCredits === afterBalance
for (const entry of afterRefund.updatedState.creditLedger || []) {
  assert.strictEqual(
    entry.beforeBalance + entry.deltaCredits,
    entry.afterBalance,
    `Ledger invariant broken on entry ${entry.id}`
  );
}

// Negative balance check: zero-credit state rejects unlock
const zeroCreditState = { ...ledgerStart, creditsBalance: 0 };
const blockedZero = unlockPlanWithGuarantee(zeroCreditState, 'PLAN-ZERO', 3900, 3960, 'BUY');
assert.strictEqual(blockedZero.success, false, 'Zero balance must block unlock');
assert.strictEqual(blockedZero.updatedState.creditsBalance, 0, 'Credits balance must never go negative');

// Durable Webhook Adapter across two EnterpriseBillingEngine instances (simulating server restart)
let persistedRecords: any[] = [];
let persistedEntitlements: any[] = [];
const sharedAdapter = {
  loadRecords: () => persistedRecords,
  saveRecords: (recs: any[]) => {
    persistedRecords = recs;
  },
  loadEntitlements: () => persistedEntitlements,
  saveEntitlements: (ents: any[]) => {
    persistedEntitlements = ents;
  },
};

const engineBeforeRestart = new EnterpriseBillingEngine(sharedAdapter);
const restartEvt = {
  id: 'evt_durable_restart_999',
  type: 'checkout.session.completed',
  data: {
    object: {
      customer: 'usr_durable_01',
      mode: 'payment' as const,
      metadata: {
        userId: 'usr_durable_01',
        creditPackId: 'pack_trader',
        creditsAmount: 115,
      },
    },
  },
};
const preRes = engineBeforeRestart.processWebhookEvent(restartEvt);
assert.strictEqual(preRes.status, 'PROCESSED');
assert.strictEqual(preRes.userEntitlements?.creditsBalance, 120); // 5 initial + 115 pack

// Instantiate new engine from same durable store (simulates process restart)
const engineAfterRestart = new EnterpriseBillingEngine(sharedAdapter);
const postReplayRes = engineAfterRestart.processWebhookEvent(restartEvt);
assert.strictEqual(postReplayRes.status, 'DUPLICATE_IGNORED', 'Restarted server instance must block replay webhook');
assert.strictEqual(engineAfterRestart.getEntitlements('usr_durable_01').creditsBalance, 120, 'Credits entitlement must persist across restart');

console.log('✓ Auditable Credit Ledger & Durable Webhook Persistence verified.');

// Test 9: Fail-Closed Token Check, Stripe HMAC-SHA256 Verification & Server RBAC
console.log('Test 9: Fail-Closed Token Check, Stripe HMAC-SHA256 & Server RBAC...');
const cryptoMod = await import('node:crypto');
const { verifyStripeWebhookSignature, evaluateServerRoleFromToken } = await import('../serverSecurity');

// Arbitrary forged bearer string must be rejected (fail closed)
const forgedTokenCheck = EnterpriseBillingEngine.verifySessionToken('arbitrary_forged_token_xyz');
assert.strictEqual(forgedTokenCheck.valid, false, 'Unrecognized token string must fail closed');

// Valid Stripe-Signature HMAC verification + tamper/expiry checks
const stripeSecret = 'whsec_test_goldvista_secret_123';
const stripePayload = JSON.stringify({ id: 'evt_hmac_1', type: 'checkout.session.completed' });
const nowSec = Math.floor(Date.now() / 1000);
const validSigHex = cryptoMod
  .createHmac('sha256', stripeSecret)
  .update(`${nowSec}.${stripePayload}`, 'utf8')
  .digest('hex');

const okSig = verifyStripeWebhookSignature(stripePayload, `t=${nowSec},v1=${validSigHex}`, stripeSecret, 300, nowSec);
assert.strictEqual(okSig.valid, true, 'Valid Stripe HMAC signature must succeed');

const tamperedBodySig = verifyStripeWebhookSignature(
  '{"id":"evt_tampered"}',
  `t=${nowSec},v1=${validSigHex}`,
  stripeSecret,
  300,
  nowSec
);
assert.strictEqual(tamperedBodySig.valid, false, 'Tampered payload must fail HMAC verification');

const expiredSig = verifyStripeWebhookSignature(
  stripePayload,
  `t=${nowSec - 1000},v1=${validSigHex}`,
  stripeSecret,
  300,
  nowSec
);
assert.strictEqual(expiredSig.valid, false, 'Old signature outside replay window must be rejected');

// Server RBAC evaluation from session tokens
const proToken = `aurum_sess_risk_manager_${nowSec + 600}`;
const proCheck = evaluateServerRoleFromToken(proToken, 'PRO');
assert.strictEqual(proCheck.authorized, true, 'risk_manager resolves to PRO tier');
const proOnAlpha = evaluateServerRoleFromToken(proToken, 'ALPHA');
assert.strictEqual(proOnAlpha.authorized, false, 'PRO token must be denied ALPHA route');

console.log('✓ Fail-Closed Token Check, Stripe HMAC-SHA256 & Server RBAC verified.');

// Test 10: Fixed-Window Rate Limiter & Log Secret Redaction (§14.1–§14.2)
console.log('Test 10: Fixed-Window Rate Limiter & Log Secret Redaction...');
const { FixedWindowRateLimiter, redactSensitiveLogValue } = await import('../serverSecurity');

const limiter = new FixedWindowRateLimiter(3, 10_000);
const baseTime = 1_700_000_000_000;
assert.strictEqual(limiter.check('10.0.0.1', baseTime).allowed, true);
assert.strictEqual(limiter.check('10.0.0.1', baseTime + 100).allowed, true);
assert.strictEqual(limiter.check('10.0.0.1', baseTime + 200).allowed, true);
const blocked = limiter.check('10.0.0.1', baseTime + 300);
assert.strictEqual(blocked.allowed, false, '4th request in 3-req window must be rate-limited');
assert.ok(blocked.retryAfterSeconds >= 1, 'Rate limit response must include positive retryAfterSeconds');
// Separate IP bucket remains unaffected and window reset restores capacity
assert.strictEqual(limiter.check('10.0.0.2', baseTime + 300).allowed, true);
assert.strictEqual(limiter.check('10.0.0.1', baseTime + 10_001).allowed, true, 'Bucket must reset after windowMs');

const rawLog =
  'Authorization: Bearer aurum_sess_admin_99999 failed with whsec_supersecretkey99 and AIzaSyAbCdEf1234567890 plus {"apiKey":"my-live-key","token":"tok123"}';
const redacted = redactSensitiveLogValue(rawLog);
assert.ok(!redacted.includes('aurum_sess_admin_99999'), 'Bearer token must be redacted');
assert.ok(!redacted.includes('whsec_supersecretkey99'), 'Stripe webhook secret must be redacted');
assert.ok(!redacted.includes('AIzaSyAbCdEf1234567890'), 'Google API key must be redacted');
assert.ok(!redacted.includes('my-live-key') && !redacted.includes('tok123'), 'JSON secrets must be redacted');

console.log('✓ Fixed-Window Rate Limiter & Log Secret Redaction verified.');

// Test 11: Live HTTP Server RBAC Middleware Enforcement (§6.2 / GAP-07)
console.log('Test 11: Live HTTP Server RBAC Middleware (401/403/200)...');
const futureExp = Math.floor(Date.now() / 1000) + 3600;

// Unauthenticated request to PRO-protected route must fail closed with HTTP 401
const unauthHistoryRes = await fetch('http://127.0.0.1:3000/api/billing/webhook/history');
assert.strictEqual(unauthHistoryRes.status, 401, 'Missing Authorization header must return HTTP 401');

// FREE-tier token on PRO-protected route must return HTTP 403
const freeHistoryRes = await fetch('http://127.0.0.1:3000/api/billing/webhook/history', {
  headers: { Authorization: `Bearer aurum_sess_free_${futureExp}` },
});
assert.strictEqual(freeHistoryRes.status, 403, 'FREE token on PRO endpoint must return HTTP 403');

// PRO-tier token on PRO-protected route must return HTTP 200
const proHistoryRes = await fetch('http://127.0.0.1:3000/api/billing/webhook/history', {
  headers: { Authorization: `Bearer aurum_sess_pro_${futureExp}` },
});
assert.strictEqual(proHistoryRes.status, 200, 'PRO token on PRO endpoint must succeed with HTTP 200');

// Forged bearer string on config mutation endpoint must fail closed (401)
const forgedConfigRes = await fetch('http://127.0.0.1:3000/api/market-data/config', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    Authorization: 'Bearer forged_invalid_token_abc',
  },
  body: JSON.stringify({}),
});
assert.strictEqual(forgedConfigRes.status, 401, 'Forged bearer token must be rejected with HTTP 401');

console.log('✓ Live HTTP Server RBAC Middleware Enforcement verified.');

// Test 12: Server Double-Entry Credit Ledger & Durable Ledger Persistence Across Restarts
console.log('Test 12: Server Double-Entry Credit Ledger & HTTP /api/billing/ledger...');
let savedRecords12: any[] = [];
let savedEntitlements12: any[] = [];
let savedLedger12: any[] = [];
const ledgerAdapter = {
  loadRecords: () => savedRecords12,
  saveRecords: (recs: any[]) => {
    savedRecords12 = recs;
  },
  loadEntitlements: () => savedEntitlements12,
  saveEntitlements: (ents: any[]) => {
    savedEntitlements12 = ents;
  },
  loadLedger: () => savedLedger12,
  saveLedger: (entries: any[]) => {
    savedLedger12 = entries;
  },
};

const ledgerEngineA = new EnterpriseBillingEngine(ledgerAdapter);
ledgerEngineA.processWebhookEvent({
  id: 'evt_ledger_tier_1',
  type: 'checkout.session.completed',
  data: {
    object: {
      customer: 'usr_ledger_audit',
      mode: 'subscription' as const,
      metadata: { userId: 'usr_ledger_audit', tier: 'ALPHA' as const },
    },
  },
});
ledgerEngineA.processWebhookEvent({
  id: 'evt_ledger_pack_1',
  type: 'checkout.session.completed',
  data: {
    object: {
      customer: 'usr_ledger_audit',
      mode: 'payment' as const,
      metadata: { userId: 'usr_ledger_audit', creditPackId: 'pack_starter', creditsAmount: 25 },
    },
  },
});

const ledgerEngineB = new EnterpriseBillingEngine(ledgerAdapter);
const restoredLedger = ledgerEngineB.getCreditLedger('usr_ledger_audit');
assert.strictEqual(restoredLedger.length, 2, 'Two double-entry webhook credit grants must persist across restarts');
for (const entry of restoredLedger) {
  assert.strictEqual(
    entry.beforeBalance + entry.deltaCredits,
    entry.afterBalance,
    `Server ledger invariant failed on ${entry.idempotencyKey}`
  );
}
assert.strictEqual(ledgerEngineB.getEntitlements('usr_ledger_audit').creditsBalance, 530); // 5 + 500 + 25

// Verify live HTTP /api/billing/ledger RBAC boundaries
const unauthLedgerRes = await fetch('http://127.0.0.1:3000/api/billing/ledger/usr_demo_trader');
assert.strictEqual(unauthLedgerRes.status, 401, 'Unauthenticated GET /api/billing/ledger/:userId must return 401');

const freeLedgerRes = await fetch('http://127.0.0.1:3000/api/billing/ledger/usr_demo_trader', {
  headers: { Authorization: `Bearer aurum_sess_free_${futureExp}` },
});
assert.strictEqual(freeLedgerRes.status, 200, 'FREE token must access own /api/billing/ledger/:userId');
const freeLedgerJson = (await freeLedgerRes.json()) as any;
assert.strictEqual(freeLedgerJson.success, true);
assert.ok(Array.isArray(freeLedgerJson.ledger));

const freeGlobalLedgerRes = await fetch('http://127.0.0.1:3000/api/billing/ledger', {
  headers: { Authorization: `Bearer aurum_sess_free_${futureExp}` },
});
assert.strictEqual(freeGlobalLedgerRes.status, 403, 'FREE token must receive HTTP 403 on global /api/billing/ledger');

console.log('✓ Server Double-Entry Credit Ledger & HTTP /api/billing/ledger verified.');

// Test 13: HMAC-Signed Server Tokens, Production Sandbox Lockout & Tenant Isolation (§6.1-6.2)
console.log('Test 13: Signed Server Session Tokens, Production Lockout & Tenant Isolation...');
const {
  signServerSessionToken,
  verifySignedServerToken,
  evaluateServerRoleFromToken: evalRoleSigned,
} = await import('../serverSecurity');

const signedPro = signServerSessionToken('pro', 'usr_alpha_tenant_1', 600, 'unit_test_secret_hex');
const signedOk = verifySignedServerToken(signedPro, 'unit_test_secret_hex');
assert.strictEqual(signedOk.valid, true, 'Valid HMAC-signed aurum_v1 token must verify cleanly');
assert.strictEqual(signedOk.userId, 'usr_alpha_tenant_1');

const tamperedSigned = `${signedPro.slice(0, -4)}ffff`;
const tamperedCheck = verifySignedServerToken(tamperedSigned, 'unit_test_secret_hex');
assert.strictEqual(tamperedCheck.valid, false, 'Tampered HMAC-signed token must be rejected');

// Strict production mode rejects unsigned aurum_sess_* demo tokens
const prodUnsignedCheck = evalRoleSigned(`aurum_sess_alpha_${futureExp}`, 'PRO', false);
assert.strictEqual(prodUnsignedCheck.authorized, false, 'Production mode must reject unsigned sandbox tokens');

// Live HTTP signed sandbox token issuance + verification + tenant ownership check
const issueRes = await fetch('http://127.0.0.1:3000/api/auth/sandbox-token', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ persona: 'free', userId: 'usr_owner_101' }),
});
assert.strictEqual(issueRes.status, 200, 'Dev sandbox token issuer must return HTTP 200');
const issueJson = (await issueRes.json()) as any;
assert.ok(String(issueJson.token).startsWith('aurum_v1.'));

const verifySignedHttp = await fetch('http://127.0.0.1:3000/api/auth/verify-session', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${issueJson.token}` },
});
assert.strictEqual(verifySignedHttp.status, 200);
const verifySignedJson = (await verifySignedHttp.json()) as any;
assert.strictEqual(verifySignedJson.tokenType, 'HMAC_V1');
assert.strictEqual(verifySignedJson.userId, 'usr_owner_101');

// FREE owner can query own ledger, blocked from reading another tenant's ledger
const ownTenantRes = await fetch('http://127.0.0.1:3000/api/billing/ledger/usr_owner_101', {
  headers: { Authorization: `Bearer ${issueJson.token}` },
});
assert.strictEqual(ownTenantRes.status, 200, 'Authenticated owner must read own ledger');

const crossTenantRes = await fetch('http://127.0.0.1:3000/api/billing/ledger/usr_other_victim_999', {
  headers: { Authorization: `Bearer ${issueJson.token}` },
});
assert.strictEqual(crossTenantRes.status, 403, 'FREE user reading another user ledger must receive HTTP 403');

console.log('✓ Signed Server Session Tokens, Production Lockout & Tenant Isolation verified.');

// Test 14: Client-Side Signed Bearer Cache Lifecycle (authService.ts)
console.log('Test 14: Client Signed Bearer Cache & Expiry Alignment...');
const {
  DEMO_PERSONAS,
  setSignedBearerToken,
  clearSignedBearerToken,
  getSessionBearerToken,
} = await import('../src/services/authService');

clearSignedBearerToken();
const alphaPersona = DEMO_PERSONAS.ALPHA;
const unsignFallback = getSessionBearerToken(alphaPersona);
assert.ok(unsignFallback.startsWith('aurum_sess_alpha_'), 'Uncached state should fall back to aurum_sess_');

const mockSignedToken = 'aurum_v1.testpayload.testsignature';
setSignedBearerToken('ALPHA', alphaPersona.uid, mockSignedToken, new Date(Date.now() + 600_000).toISOString());
assert.strictEqual(
  getSessionBearerToken(alphaPersona),
  mockSignedToken,
  'getSessionBearerToken must prefer valid cached aurum_v1. HMAC token'
);
assert.ok(
  getSessionBearerToken(DEMO_PERSONAS.PRO).startsWith('aurum_sess_pro_'),
  'Mismatched persona role/uid must not reuse cached ALPHA signed token'
);

clearSignedBearerToken();
assert.ok(
  getSessionBearerToken(alphaPersona).startsWith('aurum_sess_alpha_'),
  'clearSignedBearerToken must evict cached HMAC token'
);

console.log('✓ Client Signed Bearer Cache & Expiry Alignment verified.');

// Test 15: PostgresBillingRepository Write-Through Hydration & Production CORS Allowlist
console.log('Test 15: Postgres Billing Repository Hydration & CORS Allowlist...');
const {
  InMemorySqlMockExecutor,
  PostgresBillingRepository,
} = await import('../src/db/postgresRepositories');
const { evaluateCorsOrigin } = await import('../serverSecurity');

const billingSqlMock = new InMemorySqlMockExecutor();
const pgBillingRepo = new PostgresBillingRepository(billingSqlMock);
const pgAdapter = pgBillingRepo.createWriteThroughAdapter();

const pgEngine1 = new EnterpriseBillingEngine(pgAdapter);
pgEngine1.processWebhookEvent({
  id: 'evt_pg_write_1',
  type: 'checkout.session.completed',
  data: {
    object: {
      customer: 'usr_pg_tenant',
      mode: 'subscription' as const,
      metadata: { userId: 'usr_pg_tenant', tier: 'ALPHA' as const },
    },
  },
});
await pgBillingRepo.flushPendingWrites();

assert.strictEqual(billingSqlMock.webhookRows.size, 1, 'Webhook row must be inserted into processed_webhook_events');
assert.strictEqual(billingSqlMock.ledgerRows.size, 1, 'Double-entry ledger row must be inserted into credit_ledger_entries');
assert.ok(billingSqlMock.entitlementRows.has('usr_pg_tenant'), 'User entitlements row must be upserted');

// Hydrate second repository + engine instance directly from SQL tables (simulating server reboot)
const pgBillingRepoReboot = new PostgresBillingRepository(billingSqlMock);
const hydratedStats = await pgBillingRepoReboot.hydrate();
assert.strictEqual(hydratedStats.recordsCount, 1);
assert.strictEqual(hydratedStats.ledgerCount, 1);
const pgEngineReboot = new EnterpriseBillingEngine(pgBillingRepoReboot.createWriteThroughAdapter());
assert.strictEqual(pgEngineReboot.getEntitlements('usr_pg_tenant').creditsBalance, 505);
assert.strictEqual(
  pgEngineReboot.processWebhookEvent({
    id: 'evt_pg_write_1',
    type: 'checkout.session.completed',
    data: { object: { customer: 'usr_pg_tenant' } },
  }).status,
  'DUPLICATE_IGNORED',
  'Hydrated PostgreSQL webhook adapter must still block replays cleanly'
);

// Verify strict CORS allowlist evaluation
const allowedCors = evaluateCorsOrigin('https://app.goldvista.io', 'https://app.goldvista.io,http://localhost:3000', true);
assert.strictEqual(allowedCors.allowed, true);
assert.strictEqual(allowedCors.allowOriginHeader, 'https://app.goldvista.io');

const blockedCors = evaluateCorsOrigin('https://evil-phish.example', 'https://app.goldvista.io', true);
assert.strictEqual(blockedCors.allowed, false, 'Unlisted browser origin must be blocked in production');

const unsetProdCors = evaluateCorsOrigin('https://app.goldvista.io', '', true);
assert.strictEqual(unsetProdCors.allowed, false, 'Empty ALLOWED_ORIGINS must fail-closed in production');

console.log('✓ Postgres Billing Repository Hydration & CORS Allowlist verified.');

// Test 16: OIDC/JWKS RS256 JWT Verification Contract (GAP-07 Prep) & CSP Security Headers
console.log('Test 16: OIDC/JWKS RS256 JWT Verification & Strict CSP Headers...');
const oidcCrypto = await import('node:crypto');
const {
  buildContentSecurityPolicy,
  evaluateServerRoleFromTokenAsync,
  verifyOidcJwtSignature,
} = await import('../serverSecurity');

const { publicKey, privateKey } = oidcCrypto.generateKeyPairSync('rsa', { modulusLength: 2048 });
const pubJwk = { ...(publicKey.export({ format: 'jwk' }) as any), kid: 'key-rot-2026', use: 'sig', alg: 'RS256' };

const signJwtRs256 = (hdr: object, claims: object) => {
  const b64Hdr = Buffer.from(JSON.stringify(hdr), 'utf8').toString('base64url');
  const b64Pay = Buffer.from(JSON.stringify(claims), 'utf8').toString('base64url');
  const sig = oidcCrypto.sign('sha256', Buffer.from(`${b64Hdr}.${b64Pay}`, 'utf8'), privateKey).toString('base64url');
  return `${b64Hdr}.${b64Pay}.${sig}`;
};

const oidcNowSec = Math.floor(Date.now() / 1000);
const validOidcJwt = signJwtRs256(
  { alg: 'RS256', typ: 'JWT', kid: 'key-rot-2026' },
  {
    sub: 'oidc_usr_42',
    iss: 'https://idp.goldvista.io',
    aud: 'goldvista-api',
    aurum_tier: 'alpha',
    iat: oidcNowSec,
    exp: oidcNowSec + 600,
  }
);

const directOidcCheck = verifyOidcJwtSignature(validOidcJwt, pubJwk, {
  issuer: 'https://idp.goldvista.io',
  audience: 'goldvista-api',
  nowEpochSeconds: oidcNowSec,
});
assert.strictEqual(directOidcCheck.valid, true, 'Valid RS256 OIDC JWT must verify cleanly');
assert.strictEqual(directOidcCheck.resolvedTier, 'ALPHA');
assert.strictEqual(directOidcCheck.sub, 'oidc_usr_42');

const asyncRoleCheck = await evaluateServerRoleFromTokenAsync(validOidcJwt, 'ALPHA', {
  sandboxAllowed: false,
  oidc: {
    issuer: 'https://idp.goldvista.io',
    audience: 'goldvista-api',
    staticKeys: [pubJwk],
    nowEpochSeconds: oidcNowSec,
  },
});
assert.strictEqual(asyncRoleCheck.authorized, true);
assert.strictEqual(asyncRoleCheck.tokenType, 'OIDC_JWKS');
assert.strictEqual(asyncRoleCheck.userId, 'oidc_usr_42');

// Wrong audience & tampered JWT must fail closed
const wrongAudCheck = verifyOidcJwtSignature(validOidcJwt, pubJwk, {
  issuer: 'https://idp.goldvista.io',
  audience: 'wrong-app-id',
  nowEpochSeconds: oidcNowSec,
});
assert.strictEqual(wrongAudCheck.valid, false, 'Mismatched OIDC audience must reject JWT');

const tamperedJwt = `${validOidcJwt.slice(0, -4)}AAAA`;
const oidcTamperedCheck = verifyOidcJwtSignature(tamperedJwt, pubJwk, { nowEpochSeconds: oidcNowSec });
assert.strictEqual(oidcTamperedCheck.valid, false, 'Tampered RS256 signature must fail verification');

// CSP production vs development rules & live HTTP header probe
const prodCsp = buildContentSecurityPolicy(true);
assert.ok(prodCsp.includes("script-src 'self'") && !prodCsp.includes("script-src 'self' 'unsafe-inline'"), 'Prod CSP must omit unsafe-inline from script-src');
assert.ok(prodCsp.includes("object-src 'none'"));

const readyCspRes = await fetch('http://127.0.0.1:3000/health/ready');
assert.strictEqual(readyCspRes.status, 200);
assert.ok(readyCspRes.headers.get('content-security-policy')?.includes("object-src 'none'"), 'Live server must emit Content-Security-Policy header');
const readyCspJson = (await readyCspRes.json()) as any;
assert.strictEqual(typeof readyCspJson.oidcConfigured, 'boolean');

console.log('✓ OIDC/JWKS RS256 JWT Verification & Strict CSP Headers verified.');

// Test 17: HTTP CORS Preflight Headers & Client PKCE S256 / OIDC Bearer Contract
console.log('Test 17: HTTP CORS Preflight & Client PKCE S256 / OIDC Bearer Contract...');
const {
  buildOidcAuthorizeUrl,
  generatePkceVerifierAndChallenge,
  setOidcBearerToken,
} = await import('../src/services/authService');

const corsPreflightRes = await fetch('http://127.0.0.1:3000/api/portfolio/journal', {
  method: 'OPTIONS',
  headers: { Origin: 'http://localhost:3000' },
});
assert.strictEqual(corsPreflightRes.status, 204, 'Permitted CORS preflight must return HTTP 204');
assert.strictEqual(corsPreflightRes.headers.get('access-control-allow-origin'), 'http://localhost:3000');
assert.strictEqual(corsPreflightRes.headers.get('vary'), 'Origin');
assert.ok(corsPreflightRes.headers.get('access-control-allow-headers')?.includes('Authorization'));

const pkcePair = await generatePkceVerifierAndChallenge();
assert.ok(pkcePair.codeVerifier.length >= 43, 'PKCE code_verifier must be at least 43 characters');
assert.strictEqual(pkcePair.method, 'S256');
assert.notStrictEqual(pkcePair.codeChallenge, pkcePair.codeVerifier);

const authUrl = buildOidcAuthorizeUrl({
  authorizationEndpoint: 'https://idp.goldvista.io/authorize',
  clientId: 'goldvista-web-pkce',
  redirectUri: 'https://app.goldvista.io/auth/callback',
  codeChallenge: pkcePair.codeChallenge,
  state: 'state_abc',
});
assert.ok(authUrl.includes('code_challenge_method=S256'));
assert.ok(authUrl.includes(`code_challenge=${pkcePair.codeChallenge}`));
assert.ok(authUrl.includes('response_type=code'));

clearSignedBearerToken();
const fakeCompactJwt = 'eyJhbGciOiJSUzI1NiJ9.eyJzdWIiOiJvaWRjX3VzZXIifQ.c2lnbmF0dXJl';
setOidcBearerToken(fakeCompactJwt, 'PRO', DEMO_PERSONAS.PRO.uid, new Date(Date.now() + 600_000).toISOString());
assert.strictEqual(
  getSessionBearerToken(DEMO_PERSONAS.PRO),
  fakeCompactJwt,
  'getSessionBearerToken must return cached OIDC compact JWT when active persona matches'
);
clearSignedBearerToken();

const rootHtmlRes = await fetch('http://127.0.0.1:3000/');
assert.strictEqual(rootHtmlRes.status, 200);
assert.strictEqual(rootHtmlRes.headers.get('x-frame-options'), null, 'Root preview HTML must omit X-Frame-Options: SAMEORIGIN so AI Studio iframe renders');
const rootCsp = rootHtmlRes.headers.get('content-security-policy') || '';
assert.ok(rootCsp.includes('https://aistudio.google.com'), 'CSP frame-ancestors must allow https://aistudio.google.com iframe host');

console.log('✓ HTTP CORS Preflight & Client PKCE S256 / OIDC Bearer Contract verified.');

// Test 18: OIDC PKCE Token Exchange Route (/api/auth/oidc-exchange) & Callback State Validation
console.log('Test 18: OIDC PKCE Token Exchange Route & Callback State Guard...');
const { completeOidcPkceCallback } = await import('../src/services/authService');

const missingExchangeParamsRes = await fetch('http://127.0.0.1:3000/api/auth/oidc-exchange', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ code: 'auth_code_only' }),
});
assert.strictEqual(
  missingExchangeParamsRes.status,
  400,
  'POST /api/auth/oidc-exchange without codeVerifier must return HTTP 400'
);

if (!process.env.OAUTH_TOKEN_ENDPOINT || !process.env.OAUTH_CLIENT_ID) {
  const unconfiguredExchangeRes = await fetch('http://127.0.0.1:3000/api/auth/oidc-exchange', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      code: 'sample_oidc_code_123',
      codeVerifier: pkcePair.codeVerifier,
      redirectUri: 'https://app.goldvista.io/auth/callback',
    }),
  });
  assert.strictEqual(
    unconfiguredExchangeRes.status,
    501,
    'POST /api/auth/oidc-exchange with unconfigured IdP env vars must fail closed with HTTP 501'
  );
  const unconfiguredJson = (await unconfiguredExchangeRes.json()) as any;
  assert.strictEqual(unconfiguredJson.success, false);
}

await assert.rejects(
  async () =>
    completeOidcPkceCallback(
      'auth_code_99',
      'tampered_state_xyz',
      'https://app.goldvista.io/auth/callback',
      pkcePair.codeVerifier,
      'expected_state_abc'
    ),
  /Invalid OIDC state/,
  'completeOidcPkceCallback must reject CSRF state mismatches before exchanging code'
);

console.log('✓ OIDC PKCE Token Exchange Route & Callback State Guard verified.');

// Test 19: OIDC Callback Missing Verifier Bounds, Notification Config HTTP RBAC & Broker Perk Copy
console.log('Test 19: OIDC Callback Missing Verifier, Notification Config RBAC & Broker Perk Compliance...');
await assert.rejects(
  async () => completeOidcPkceCallback('', 'state_1', 'https://app.goldvista.io/auth/callback'),
  /Missing authorization code or PKCE code_verifier/,
  'completeOidcPkceCallback must reject empty authorization code cleanly'
);

const unauthNotifPostRes = await fetch('http://127.0.0.1:3000/api/notifications/config', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ enabled: true }),
});
assert.strictEqual(unauthNotifPostRes.status, 401, 'Unauthenticated POST /api/notifications/config must return 401');

const freeNotifPostRes = await fetch('http://127.0.0.1:3000/api/notifications/config', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    Authorization: `Bearer aurum_sess_free_${futureExp}`,
  },
  body: JSON.stringify({ enabled: true }),
});
assert.strictEqual(freeNotifPostRes.status, 403, 'FREE user POST /api/notifications/config must return 403');
const freeNotifJson = (await freeNotifPostRes.json()) as any;
assert.ok(freeNotifJson.error, '403 notification response must include JSON error message for UI alerting');

assert.ok(
  BROKER_PARTNERS.every((b) => !/100%\s+free.*for\s+life/i.test(b.perk)),
  'Broker partner perks must use Partner-Sponsored disclosure rather than unconditional lifetime free wording'
);

console.log('✓ OIDC Callback Bounds, Notification Config RBAC & Broker Perk Compliance verified.');

// Test 20: Market Data & LLM Settings HTTP RBAC JSON Errors + Component Icon/Compliance Hygiene
console.log('Test 20: Market Data & LLM Config RBAC + UI Compliance Hygiene...');
const unauthMdRes = await fetch('http://127.0.0.1:3000/api/market-data/config', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ allowDelayed: true }),
});
assert.strictEqual(unauthMdRes.status, 401, 'Unauthenticated POST /api/market-data/config must return 401');

const freeMdRes = await fetch('http://127.0.0.1:3000/api/market-data/config', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    Authorization: `Bearer aurum_sess_free_${futureExp}`,
  },
  body: JSON.stringify({ allowDelayed: true }),
});
assert.strictEqual(freeMdRes.status, 403, 'FREE user POST /api/market-data/config must return 403');
const freeMdJson = (await freeMdRes.json()) as any;
assert.ok(freeMdJson.error, '403 market-data config response must return JSON error message');

const freeLlmRes = await fetch('http://127.0.0.1:3000/api/llm/settings', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    Authorization: `Bearer aurum_sess_free_${futureExp}`,
  },
  body: JSON.stringify({ temperature: 0.2 }),
});
assert.strictEqual(freeLlmRes.status, 403, 'FREE user POST /api/llm/settings must return 403');
const freeLlmJson = (await freeLlmRes.json()) as any;
assert.ok(freeLlmJson.error, '403 llm settings response must return JSON error message');

const componentsDir = path.join(process.cwd(), 'src', 'components');
const componentFiles = fs.readdirSync(componentsDir).filter((f) => f.endsWith('.tsx'));
for (const file of componentFiles) {
  const srcText = fs.readFileSync(path.join(componentsDir, file), 'utf8');
  assert.ok(!srcText.includes('<Sparkles'), `Decorative <Sparkles> icon must be removed from ${file}`);
}

const paywallSrc = fs.readFileSync(path.join(componentsDir, 'PaywallGateModal.tsx'), 'utf8');
assert.ok(!/Refund Guaranteed/i.test(paywallSrc), 'PaywallGateModal must avoid unconditional Refund Guaranteed copy');
assert.ok(!/Free Broker Sponsoring/i.test(paywallSrc), 'PaywallGateModal must use Partner-Sponsored Pro wording');

console.log('✓ Market Data & LLM Config RBAC + UI Compliance Hygiene verified.');

// Test 21: Modal Dialog WCAG Accessibility (role="dialog", aria-modal, aria-labelledby, Escape)
console.log('Test 21: Modal Dialog WCAG Accessibility & Keyboard Escape Semantics...');
for (const modalFile of ['AuthModal.tsx', 'StripeCheckoutModal.tsx', 'PaywallGateModal.tsx']) {
  const modalSrc = fs.readFileSync(path.join(componentsDir, modalFile), 'utf8');
  assert.ok(modalSrc.includes('role="dialog"'), `${modalFile} must include role="dialog"`);
  assert.ok(modalSrc.includes('aria-modal="true"'), `${modalFile} must include aria-modal="true"`);
  assert.ok(modalSrc.includes('aria-labelledby='), `${modalFile} must include aria-labelledby`);
  assert.ok(modalSrc.includes("e.key === 'Escape'"), `${modalFile} must dismiss on Escape key`);
}
console.log('✓ Modal Dialog WCAG Accessibility & Keyboard Escape Semantics verified.');

// Test 22: Operational Diagnostic Endpoints PRO RBAC & authDeniedCount Telemetry
console.log('Test 22: Operational Diagnostic Endpoints RBAC & Auth-Denied Telemetry...');
const diagnosticRoutes = [
  { url: 'http://127.0.0.1:3000/api/market-data/test-connection', body: { providerId: 'simulated_reference' } },
  { url: 'http://127.0.0.1:3000/api/notifications/test', body: { channel: 'TELEGRAM' } },
  { url: 'http://127.0.0.1:3000/api/llm/test', body: {} },
];

for (const route of diagnosticRoutes) {
  const unauthRes = await fetch(route.url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(route.body),
  });
  assert.strictEqual(unauthRes.status, 401, `${route.url} must return 401 when unauthenticated`);

  const freeRes = await fetch(route.url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer aurum_sess_free_${futureExp}`,
    },
    body: JSON.stringify(route.body),
  });
  assert.strictEqual(freeRes.status, 403, `${route.url} must return 403 for FREE tier`);
}

const proTokRes22 = await fetch('http://127.0.0.1:3000/api/auth/sandbox-token', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ persona: 'pro', userId: 'usr_pro_diag_22' }),
});
assert.strictEqual(proTokRes22.status, 200);
const proTokJson22 = (await proTokRes22.json()) as any;

const proMdRes = await fetch('http://127.0.0.1:3000/api/market-data/test-connection', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${proTokJson22.token}`,
  },
  body: JSON.stringify({ providerId: 'simulated_reference' }),
});
assert.strictEqual(proMdRes.status, 200, 'PRO signed bearer token must authorize /api/market-data/test-connection');

const proNotifTestRes = await fetch('http://127.0.0.1:3000/api/notifications/test', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${proTokJson22.token}`,
  },
  body: JSON.stringify({ channel: 'TELEGRAM' }),
});
assert.strictEqual(proNotifTestRes.status, 200, 'PRO signed bearer token must authorize /api/notifications/test');

const metricsCheck22 = await fetch('http://127.0.0.1:3000/api/metrics');
const metricsJson22 = (await metricsCheck22.json()) as any;
assert.ok(metricsJson22.counters.authDeniedCount >= 6, '/api/metrics must increment authDeniedCount on 401/403');

const promCheck22 = await fetch('http://127.0.0.1:3000/api/metrics/prometheus');
const promText22 = await promCheck22.text();
assert.ok(promText22.includes('aurum_auth_denied_total '), 'Prometheus exporter must include aurum_auth_denied_total');

console.log('✓ Operational Diagnostic Endpoints RBAC & Auth-Denied Telemetry verified.');

console.log('--- ALL 22 MONETIZATION & SECURITY TESTS PASSED CLEANLY ---');



