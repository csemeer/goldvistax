import assert from 'node:assert';
import {
  DEMO_PERSONAS,
  canAccessWorkspace,
  loginWithSocialProvider,
  loginWithEmail,
  enrollNewCustomer,
  switchPersona,
  logoutUser,
  WORKSPACE_TIER_REQUIREMENTS,
} from '../src/services/authService';

console.log('--- STARTING GOLDVISTA AUTH & ACCESS CONTROL TEST SUITE ---');

// Test 1: Persona definitions & default roles
console.log('Test 1: Persona validation...');
assert.strictEqual(DEMO_PERSONAS.GUEST.role, 'GUEST');
assert.strictEqual(DEMO_PERSONAS.FREE.role, 'FREE');
assert.strictEqual(DEMO_PERSONAS.PRO.role, 'PRO');
assert.strictEqual(DEMO_PERSONAS.ALPHA.role, 'ALPHA');
console.log('✓ All 4 demo personas verified.');

// Test 2: RBAC Access Control checks across tiers
console.log('Test 2: RBAC Access Control evaluation...');
// Guest checks
const guestOverview = canAccessWorkspace('GUEST', 'overview');
assert.strictEqual(guestOverview.allowed, true, 'Guest can view overview');

const guestTechnical = canAccessWorkspace('GUEST', 'technical');
assert.strictEqual(guestTechnical.allowed, false, 'Guest cannot view technical analysis');
assert.strictEqual(guestTechnical.requiredRole, 'FREE');

const guestStrategies = canAccessWorkspace('GUEST', 'strategies');
assert.strictEqual(guestStrategies.allowed, false, 'Guest cannot view strategies');
assert.strictEqual(guestStrategies.requiredRole, 'PRO');

// Free checks
const freeTechnical = canAccessWorkspace('FREE', 'technical');
assert.strictEqual(freeTechnical.allowed, true, 'Free member can view technical');

const freeBacktesting = canAccessWorkspace('FREE', 'backtesting');
assert.strictEqual(freeBacktesting.allowed, false, 'Free member cannot view backtesting');
assert.strictEqual(freeBacktesting.requiredRole, 'PRO');

const freeCouncil = canAccessWorkspace('FREE', 'council');
assert.strictEqual(freeCouncil.allowed, false, 'Free member cannot view AI council');
assert.strictEqual(freeCouncil.requiredRole, 'ALPHA');

// Pro checks
const proBacktesting = canAccessWorkspace('PRO', 'backtesting');
assert.strictEqual(proBacktesting.allowed, true, 'Pro member can view backtesting');

const proTelegram = canAccessWorkspace('PRO', 'telegram_notifications');
assert.strictEqual(proTelegram.allowed, true, 'Pro member can access Telegram webhooks');

const proCouncil = canAccessWorkspace('PRO', 'council');
assert.strictEqual(proCouncil.allowed, false, 'Pro member cannot view AI council (requires Alpha)');
assert.strictEqual(proCouncil.requiredRole, 'ALPHA');

// Alpha checks
const alphaCouncil = canAccessWorkspace('ALPHA', 'council');
assert.strictEqual(alphaCouncil.allowed, true, 'Alpha member can access AI council');

const alphaGemini = canAccessWorkspace('ALPHA', 'gemini_chat');
assert.strictEqual(alphaGemini.allowed, true, 'Alpha member can access Gemini chat');

console.log('✓ RBAC access boundaries verified across all tiers.');

// Test 3: Social Logins (Google, Apple, Telegram, Discord)
async function testLogins() {
  console.log('Test 3: Social & credential login simulation...');
  const googleSession = await loginWithSocialProvider('google');
  assert.strictEqual(googleSession.authProvider, 'google');
  assert.strictEqual(googleSession.isVerified, true);

  const appleSession = await loginWithSocialProvider('apple');
  assert.strictEqual(appleSession.authProvider, 'apple');
  assert.strictEqual(appleSession.isVerified, true);

  const emailSession = await loginWithEmail('analyst@quant-fund.org');
  assert.strictEqual(emailSession.email, 'analyst@quant-fund.org');
  assert.strictEqual(emailSession.role, 'FREE');
  console.log('✓ Social and email authentication verified.');

  // Test 4: New Customer Enrollment with Strategy Onboarding
  console.log('Test 4: Customer enrollment with strategy questionnaire...');
  const newMember = await enrollNewCustomer({
    email: 'newtrader@commodity.com',
    displayName: 'Jordan Miller',
    authProvider: 'google',
    tradingProfile: {
      primaryHorizon: 'PROP_FIRM',
      brokerName: 'IC Markets Global (Raw ECN)',
      experienceLevel: 'ADVANCED',
    },
  });
  assert.strictEqual(newMember.email, 'newtrader@commodity.com');
  assert.strictEqual(newMember.tradingProfile?.primaryHorizon, 'PROP_FIRM');
  assert.strictEqual(newMember.tradingProfile?.experienceLevel, 'ADVANCED');
  console.log('✓ Customer enrollment and trading profile verified.');

  // Test 5: Persona Switching
  console.log('Test 5: Instant persona switching...');
  const switchedAlpha = switchPersona('ALPHA');
  assert.strictEqual(switchedAlpha.role, 'ALPHA');
  assert.strictEqual(switchedAlpha.displayName, 'Alex Vance');

  const switchedGuest = logoutUser();
  assert.strictEqual(switchedGuest.role, 'GUEST');
  console.log('✓ Persona switcher verified.');

  console.log('--- ALL AUTH & ACCESS TESTS PASSED CLEANLY ---');
}

testLogins().catch((e) => {
  console.error(e);
  process.exit(1);
});
