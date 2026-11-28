import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';
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
}

async function runExtendedAuthChecks() {
  // Test 6: Persistent Sign-Up, Duplicate Guard, Password Verification & UID Continuity
  console.log('Test 6: Credential Sign-Up, duplicate rejection & returning-user UID recovery...');
  const uniqueEmail = `signup.trader.${Date.now()}@goldvista-test.io`;
  const createdUser = await enrollNewCustomer({
    email: uniqueEmail,
    displayName: 'Priya Sharma',
    password: 'StrongPassword#2026',
    rejectDuplicate: true,
    authProvider: 'email',
    tradingProfile: {
      primaryHorizon: 'SWING',
      brokerName: 'IC Markets Global (Raw ECN)',
      experienceLevel: 'ADVANCED',
    },
  });
  assert.ok(createdUser.uid.startsWith('usr_new_'), 'Newly signed-up user should receive deterministic scoped UID');
  assert.strictEqual(createdUser.displayName, 'Priya Sharma');

  // Duplicate sign-up must be rejected cleanly
  await assert.rejects(
    () =>
      enrollNewCustomer({
        email: uniqueEmail.toUpperCase(),
        displayName: 'Duplicate User',
        password: 'AnotherPassword#2026',
        rejectDuplicate: true,
        authProvider: 'email',
        tradingProfile: { primaryHorizon: 'INTRADAY', experienceLevel: 'NOVICE' },
      }),
    /already registered/i,
    'Duplicate email sign-up must reject cleanly'
  );

  // Wrong password must be rejected
  await assert.rejects(
    () => loginWithEmail(uniqueEmail, 'WrongPassword123', { strictRegisteredOnly: true }),
    /Incorrect password/i,
    'Wrong password must be rejected'
  );

  // Unregistered email in strict sign-in mode must be rejected
  await assert.rejects(
    () => loginWithEmail('unknown.visitor@never-registered.io', 'Password123', { strictRegisteredOnly: true }),
    /No account found/i,
    'Unregistered email in strict Sign In mode must guide user to Sign Up'
  );

  // Sign out then Sign In with correct password recovers exact same UID and profile
  const afterSignOut = logoutUser();
  assert.strictEqual(afterSignOut.role, 'GUEST');

  const signedBackIn = await loginWithEmail(uniqueEmail, 'StrongPassword#2026', { strictRegisteredOnly: true });
  assert.strictEqual(signedBackIn.uid, createdUser.uid, 'Returning Sign In must recover exact original UID');
  assert.strictEqual(signedBackIn.displayName, 'Priya Sharma');
  assert.strictEqual(signedBackIn.tradingProfile?.primaryHorizon, 'SWING');
  console.log('✓ Credential sign-up, duplicate rejection, and returning UID recovery verified.');

  // Test 7: Multi-Device Sign-Out & Sign-Up UI Contract Checks
  console.log('Test 7: Verifying Sign-Out & Sign-Up UI visibility across desktop/mobile components...');
  const rootDir = process.cwd();
  const authModalSrc = fs.readFileSync(path.join(rootDir, 'src/components/AuthModal.tsx'), 'utf8');
  const navbarSrc = fs.readFileSync(path.join(rootDir, 'src/components/Navbar.tsx'), 'utf8');
  const sidebarSrc = fs.readFileSync(path.join(rootDir, 'src/components/Sidebar.tsx'), 'utf8');
  const landingSrc = fs.readFileSync(path.join(rootDir, 'src/components/LandingPage.tsx'), 'utf8');

  assert.ok(
    authModalSrc.includes('[isOpen, initialMode]') &&
      authModalSrc.includes('setMode(initialMode)') &&
      authModalSrc.includes('setEnrollStep(1)') &&
      authModalSrc.includes('autoComplete={mode === \'ENROLL\' ? \'new-password\' : \'current-password\'}') &&
      authModalSrc.includes('selectedExperience'),
    'AuthModal must resync initialMode/enrollStep on open, render password fields, and expose experience selector'
  );

  assert.ok(
    navbarSrc.includes('Sign Up') &&
      navbarSrc.includes('Sign Out') &&
      navbarSrc.includes("onOpenAuth('LOGIN')") &&
      !navbarSrc.includes('hidden sm:inline\n                >\n                  Sign In'),
    'Navbar must expose Sign In & Sign Up cleanly on all viewports and surface a direct Sign Out control'
  );

  assert.ok(
    sidebarSrc.includes('Sign Out') &&
      sidebarSrc.includes('Sign Up') &&
      sidebarSrc.includes('Sign In') &&
      sidebarSrc.includes('onLogout'),
    'Sidebar & Mobile Drawer must expose Sign Out for logged-in users and Sign Up / Sign In for guests'
  );

  assert.ok(
    landingSrc.includes('isAuthenticated') &&
      landingSrc.includes('Sign Out') &&
      landingSrc.includes('Sign Up') &&
      landingSrc.includes('enrollPassword'),
    'LandingPage must expose Sign Up with password, Sign In, and active-session Sign Out controls'
  );
  console.log('✓ Multi-device Sign-Out & Sign-Up UI contracts verified.');
  console.log('--- ALL AUTH & ACCESS TESTS PASSED CLEANLY ---');
}

testLogins()
  .then(() => runExtendedAuthChecks())
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
