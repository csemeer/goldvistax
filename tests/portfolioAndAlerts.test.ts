import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';
import { EnterpriseBillingEngine } from '../src/services/billingWebhookEngine';
import { evaluateServerRoleFromToken } from '../serverSecurity';
import {
  enrollNewCustomer,
  updateCurrentUserTier,
  logoutUser,
  getSessionBearerToken,
  clearSignedBearerToken,
} from '../src/services/authService';
import {
  buildTradeAlertRecord,
  formatTradeAlertHeadline,
  dispatchTradeLifecycleAlert,
  loadUserTradeAlerts,
  markAllTradeAlertsRead,
} from '../src/services/tradeAlertService';

console.log('--- STARTING AURUM PORTFOLIO ISOLATION, TIER PRESERVATION & TRADE ALERTS SUITE ---');

async function runSuite() {
  // 1. Token UID Suffix Parsing + Legacy Compatibility
  console.log('Test 1: Session token UID suffix parsing & legacy backward compatibility...');
  const expFuture = Math.floor(Date.now() / 1000) + 3600;
  const legacyToken = `aurum_sess_risk_manager_${expFuture}`;
  const legacyVerified = EnterpriseBillingEngine.verifySessionToken(legacyToken);
  assert.strictEqual(legacyVerified.valid, true);
  assert.strictEqual(legacyVerified.persona, 'risk_manager');
  assert.strictEqual(legacyVerified.userId, undefined);

  const legacyRbac = evaluateServerRoleFromToken(legacyToken, 'PRO');
  assert.strictEqual(legacyRbac.authorized, true);
  assert.strictEqual(legacyRbac.userId, 'usr_demo_trader');

  const userAToken = `aurum_sess_pro_${expFuture}.uid_${encodeURIComponent('usr_new_alpha_111')}`;
  const userBToken = `aurum_sess_pro_${expFuture}.uid_${encodeURIComponent('usr_new_beta_222')}`;
  assert.ok(userAToken.startsWith('aurum_sess_pro_'));
  assert.ok(userBToken.startsWith('aurum_sess_pro_'));

  const rbacA = evaluateServerRoleFromToken(userAToken, 'PRO');
  const rbacB = evaluateServerRoleFromToken(userBToken, 'PRO');
  assert.strictEqual(rbacA.authorized, true);
  assert.strictEqual(rbacA.userId, 'usr_new_alpha_111');
  assert.strictEqual(rbacB.authorized, true);
  assert.strictEqual(rbacB.userId, 'usr_new_beta_222');
  assert.notStrictEqual(rbacA.userId, rbacB.userId, 'Distinct UID-tagged fallback tokens must never collide');
  console.log('✓ Token UID parsing & legacy compatibility verified.');

  // 2. Tier Updating Preserves User Identity & UID
  console.log('Test 2: updateCurrentUserTier preserves signed-in user identity & UID...');
  clearSignedBearerToken();
  const uniqueEmail = `tier.preserve.${Date.now()}@aurum-test.io`;
  const enrolled = await enrollNewCustomer({
    email: uniqueEmail,
    displayName: 'Kavya Nair',
    password: 'SecureTierPassword#9',
    rejectDuplicate: true,
    authProvider: 'email',
    tradingProfile: {
      primaryHorizon: 'SWING',
      experienceLevel: 'INTERMEDIATE',
    },
  });
  assert.strictEqual(enrolled.role, 'FREE');
  assert.strictEqual(enrolled.displayName, 'Kavya Nair');

  const upgradedPro = updateCurrentUserTier('PRO');
  assert.strictEqual(upgradedPro.role, 'PRO');
  assert.strictEqual(upgradedPro.uid, enrolled.uid, 'Upgrading tier to PRO must preserve exact UID');
  assert.strictEqual(upgradedPro.email, enrolled.email, 'Upgrading tier to PRO must preserve email');
  assert.strictEqual(upgradedPro.displayName, 'Kavya Nair', 'Upgrading tier to PRO must preserve displayName');
  assert.ok(
    getSessionBearerToken(upgradedPro).includes(`.uid_${encodeURIComponent(enrolled.uid)}`),
    'Bearer token after tier upgrade must keep user UID suffix'
  );

  const upgradedAlpha = updateCurrentUserTier('ALPHA');
  assert.strictEqual(upgradedAlpha.role, 'ALPHA');
  assert.strictEqual(upgradedAlpha.uid, enrolled.uid, 'Upgrading tier to ALPHA must preserve exact UID');
  assert.strictEqual(upgradedAlpha.displayName, 'Kavya Nair');

  logoutUser();
  console.log('✓ updateCurrentUserTier identity preservation verified.');

  // 3. Per-User Trade Lifecycle Alert Formatting & Local History Helper
  console.log('Test 3: Trade lifecycle alert record generation & formatting...');
  const openRecord = buildTradeAlertRecord({
    userId: 'usr_alert_unit_a',
    eventType: 'TRADE_OPENED',
    positionId: 'POS-TEST-OPEN-1',
    instrumentId: 'XAUUSD',
    direction: 'BUY',
    lots: 0.25,
    entryPrice: 3960.5,
    stopLoss: 3940.0,
    takeProfit: 4010.0,
    status: 'OPEN',
    triggerSource: 'PLAN_CARD',
    reason: 'Triggered from Tactical Trade Plan',
  });
  assert.ok(
    formatTradeAlertHeadline(openRecord).title.includes('Trade Opened: BUY XAUUSD'),
    'Open alert headline must summarize direction & instrument'
  );

  const closeRecord = buildTradeAlertRecord({
    userId: 'usr_alert_unit_b',
    eventType: 'TRADE_CLOSED',
    positionId: 'POS-TEST-OPEN-1',
    instrumentId: 'XAUUSD',
    direction: 'BUY',
    lots: 0.25,
    entryPrice: 3960.5,
    exitPrice: 4005.5,
    stopLoss: 3940.0,
    takeProfit: 4010.0,
    realizedPnl: 1125.0,
    status: 'CLOSED_PROFIT',
    triggerSource: 'SL_TP_TRIGGER',
    reason: 'Take Profit hit',
  });
  assert.ok(
    formatTradeAlertHeadline(closeRecord).title.includes('+$1,125.00'),
    'Close alert headline must format realized P&L cleanly'
  );

  await dispatchTradeLifecycleAlert(openRecord, { skipServer: true });
  await dispatchTradeLifecycleAlert(closeRecord, { skipServer: true });
  // In Node (no window), loadUserTradeAlerts returns []; markAllTradeAlertsRead is safe
  assert.deepStrictEqual(loadUserTradeAlerts('usr_alert_unit_a'), []);
  assert.deepStrictEqual(markAllTradeAlertsRead('usr_alert_unit_a'), []);
  console.log('✓ Trade lifecycle alert helpers verified.');

  // 4. Live HTTP Multi-User Portfolio, Strategy Subscription & Trade Alert Isolation
  console.log('Test 4: Live HTTP multi-user isolation (Portfolio, Strategy Subscriptions & Trade Lifecycle Alerts)...');
  const suffix = Date.now();
  const userAId = `usr_iso_a_${suffix}`;
  const userBId = `usr_iso_b_${suffix}`;
  const tokenA = `aurum_sess_pro_${expFuture}.uid_${encodeURIComponent(userAId)}`;
  const tokenB = `aurum_sess_pro_${expFuture}.uid_${encodeURIComponent(userBId)}`;

  // User A opens a position
  const openPosId = `POS-ISO-${suffix}`;
  const openRes = await fetch('http://127.0.0.1:3000/api/portfolio/journal', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${tokenA}`,
    },
    body: JSON.stringify({
      action: 'OPEN',
      position: {
        id: openPosId,
        tradePlanId: 'PLAN-ISO-TEST',
        instrumentId: 'XAUUSD',
        direction: 'BUY',
        lots: 0.4,
        entryPrice: 3960,
        stopLoss: 3935,
        takeProfit: 4020,
      },
    }),
  });
  assert.ok(openRes.status === 200 || openRes.status === 201, `User A must be able to open paper trade (got ${openRes.status})`);

  // User A sees the position; User B MUST NOT see User A's position (and starts empty, not seeded with Alex Vance's trades)
  const portARes = await fetch('http://127.0.0.1:3000/api/portfolio/journal', {
    headers: { Authorization: `Bearer ${tokenA}` },
  });
  const portAJson = (await portARes.json()) as any;
  assert.strictEqual(portAJson.userId, userAId);
  assert.ok(portAJson.positions.some((p: any) => p.id === openPosId), 'User A portfolio must include newly opened trade');

  const portBRes = await fetch('http://127.0.0.1:3000/api/portfolio/journal', {
    headers: { Authorization: `Bearer ${tokenB}` },
  });
  const portBJson = (await portBRes.json()) as any;
  assert.strictEqual(portBJson.userId, userBId);
  assert.strictEqual(portBJson.isDemoPersona, false);
  assert.strictEqual(portBJson.positions.length, 0, 'Fresh User B portfolio must start empty and never inherit User A or demo trades');

  // Strategy subscriptions isolation
  const subARes = await fetch('http://127.0.0.1:3000/api/alerts/strategy-subscriptions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${tokenA}`,
    },
    body: JSON.stringify({ strategyId: 'STRAT-01-EMA-TREND', enabled: true }),
  });
  assert.strictEqual(subARes.status, 200);
  const subAJson = (await subARes.json()) as any;
  assert.strictEqual(subAJson.userId, userAId);
  assert.strictEqual(subAJson.subscriptions['STRAT-01-EMA-TREND']?.enabled, true);

  const subBRes = await fetch('http://127.0.0.1:3000/api/alerts/strategy-subscriptions', {
    headers: { Authorization: `Bearer ${tokenB}` },
  });
  const subBJson = (await subBRes.json()) as any;
  assert.strictEqual(subBJson.userId, userBId);
  assert.strictEqual(
    Object.keys(subBJson.subscriptions || {}).length,
    0,
    'User B strategy subscriptions must remain completely isolated from User A'
  );

  // Trade lifecycle open/close alerts HTTP route & per-user isolation
  const alertOpenRes = await fetch('http://127.0.0.1:3000/api/alerts/trade-lifecycle', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${tokenA}`,
    },
    body: JSON.stringify({
      eventType: 'TRADE_OPENED',
      positionId: openPosId,
      instrumentId: 'XAUUSD',
      direction: 'BUY',
      lots: 0.4,
      entryPrice: 3960,
      stopLoss: 3935,
      takeProfit: 4020,
      status: 'OPEN',
      triggerSource: 'MANUAL',
    }),
  });
  assert.strictEqual(alertOpenRes.status, 200);
  const alertOpenJson = (await alertOpenRes.json()) as any;
  assert.strictEqual(alertOpenJson.success, true);
  assert.strictEqual(alertOpenJson.alert.eventType, 'TRADE_OPENED');

  const alertCloseRes = await fetch('http://127.0.0.1:3000/api/alerts/trade-lifecycle', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${tokenA}`,
    },
    body: JSON.stringify({
      eventType: 'TRADE_CLOSED',
      positionId: openPosId,
      instrumentId: 'XAUUSD',
      direction: 'BUY',
      lots: 0.4,
      entryPrice: 3960,
      exitPrice: 3995,
      realizedPnl: 1400,
      status: 'CLOSED_MANUAL',
      triggerSource: 'MANUAL',
    }),
  });
  assert.strictEqual(alertCloseRes.status, 200);

  const listAlertsA = (await (
    await fetch('http://127.0.0.1:3000/api/alerts/trade-lifecycle', {
      headers: { Authorization: `Bearer ${tokenA}` },
    })
  ).json()) as any;
  assert.strictEqual(listAlertsA.userId, userAId);
  assert.strictEqual(listAlertsA.alerts.length, 2, 'User A must receive both TRADE_OPENED and TRADE_CLOSED alerts');

  const listAlertsB = (await (
    await fetch('http://127.0.0.1:3000/api/alerts/trade-lifecycle', {
      headers: { Authorization: `Bearer ${tokenB}` },
    })
  ).json()) as any;
  assert.strictEqual(listAlertsB.userId, userBId);
  assert.strictEqual(listAlertsB.alerts.length, 0, 'User B must NOT see User A trade alerts');

  console.log('✓ Live HTTP multi-user isolation verified.');

  // 5. UI Contract Checks (Clear Position Status Banner, Tier vs Persona Separation, Alert Bell)
  console.log('Test 5: Verifying UI clarity & wiring contracts...');
  const rootDir = process.cwd();
  const navbarSrc = fs.readFileSync(path.join(rootDir, 'src/components/Navbar.tsx'), 'utf8');
  const pjSrc = fs.readFileSync(path.join(rootDir, 'src/components/PortfolioJournalWorkspace.tsx'), 'utf8');
  const appSrc = fs.readFileSync(path.join(rootDir, 'src/App.tsx'), 'utf8');

  assert.ok(
    navbarSrc.includes('Your Plan Level (Keeps Your Trades)') &&
      navbarSrc.includes('Switch to Demo User (Sample Data)') &&
      navbarSrc.includes('Trade &amp; Position Alerts'),
    'Navbar must separate in-place Plan Level switching from Demo User switching and expose Trade Alerts bell'
  );
  assert.ok(
    pjSrc.includes('Current Portfolio Location and Position Status') &&
      pjSrc.includes('FOCUSED POSITION:') &&
      pjSrc.includes('pendingFocusPositionId'),
    'PortfolioJournalWorkspace must surface clear position orientation banner & hydration-safe position inspector'
  );
  assert.ok(
    appSrc.includes('handleChangeUserTier') &&
      appSrc.includes('handleJumpToPositions') &&
      appSrc.includes('tradeAlertToast'),
    'App.tsx must wire in-place tier upgrades, direct position jumps, and trade open/close toast notifications'
  );
  console.log('✓ UI clarity & wiring contracts verified.');

  console.log('--- ALL PORTFOLIO ISOLATION, TIER & TRADE ALERT TESTS PASSED CLEANLY ---');
}

runSuite().catch((err) => {
  console.error(err);
  process.exit(1);
});
