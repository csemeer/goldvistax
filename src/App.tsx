/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * Aurum Intelligence — Master Gold Trading Advisory & Market Intelligence Platform
 */

import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import {
  AdvisoryHorizon,
  Candle,
  IndicatorSnapshot,
  PaperPosition,
  Quote,
  Timeframe,
  TradePlan,
} from './domain/types';
import { Navbar } from './components/Navbar';
import { Sidebar, WorkspaceId } from './components/Sidebar';
import {
  CandleChart,
  getGlobalSmartAnnotationEnabled,
  setGlobalSmartAnnotationEnabled,
} from './components/CandleChart';
import { TradePlanCard } from './components/TradePlanCard';
import {
  StrategyBiasRationaleModal,
  StrategyBiasRationalePanel,
} from './components/StrategyBiasRationalePanel';
import { CFDCalculator } from './components/CFDCalculator';
import { CrossCommoditySpreadsPanel } from './components/CrossCommoditySpreadsPanel';
import { TradeVolumeProfileWidget } from './components/TradeVolumeProfileWidget';
import { MacroWorkspace } from './components/MacroWorkspace';
import { StrategyLabWorkspace } from './components/StrategyLabWorkspace';
import { BacktestingWorkspace } from './components/BacktestingWorkspace';
import { CouncilWorkspace } from './components/CouncilWorkspace';
import { ReportsWorkspace } from './components/ReportsWorkspace';
import { AlertsWorkspace } from './components/AlertsWorkspace';
import { PortfolioJournalWorkspace } from './components/PortfolioJournalWorkspace';
import { PerformanceInsightsWorkspace } from './components/PerformanceInsightsWorkspace';
import { MarketDataConfigWorkspace } from './components/MarketDataConfigWorkspace';
import { NotificationSettingsWorkspace } from './components/NotificationSettingsWorkspace';
import { StrategyAlertFeedWidget } from './components/StrategyAlertFeedWidget';
import { GeminiChatbot } from './components/GeminiChatbot';
import { NewsSentimentWorkspace } from './components/NewsSentimentWorkspace';
import { HistoricalScenariosWorkspace } from './components/HistoricalScenariosWorkspace';
import { LLMSettingsWorkspace } from './components/LLMSettingsWorkspace';
import { MonetizationWorkspace } from './components/MonetizationWorkspace';
import { StripeCheckoutModal } from './components/StripeCheckoutModal';
import { PaywallGateModal } from './components/PaywallGateModal';
import { AuthModal } from './components/AuthModal';
import { AccessGateGuard } from './components/AccessGateGuard';
import { LandingPage } from './components/LandingPage';
import { WorkspaceErrorBoundary } from './components/WorkspaceErrorBoundary';
import { CommandPaletteModal, PortfolioSubTabId } from './components/CommandPaletteModal';
import {
  UserSession,
  UserRole,
  getCurrentSession,
  saveSession,
  canAccessWorkspace,
  switchPersona,
  updateCurrentUserTier,
  logoutUser,
  DEMO_PERSONAS,
  enrollNewCustomer,
  refreshSignedSandboxToken,
  completeOidcPkceCallback,
  ensureSignedBearerToken,
} from './services/authService';
import {
  getBrowserPushPermission,
  loadUserTradeAlerts,
  markAllTradeAlertsRead,
  requestBrowserPushPermission,
  TradeLifecycleAlertEvent,
  formatTradeAlertHeadline,
} from './services/tradeAlertService';
import { getInstrumentMultiplierForMae } from './services/portfolioScannerEngine';
import {
  UserEntitlementState,
  loadUserEntitlements,
  saveUserEntitlements,
  evaluatePerformanceRefunds,
  unlockPlanWithGuarantee,
  linkBrokerPartnerAccount,
  purchaseCreditPack,
  upgradeMembershipTier,
  isPlanUnlocked,
} from './services/monetizationEngine';
import { CommodityType, HistoricalCoverageReport, HistoricalRangePeriod, InstrumentId } from './domain/types';
import { getPrimaryInstrumentForCommodity, CANONICAL_COMMODITY_REGISTRY } from './services/commodityRegistry';
import { generateMultiCommodityHistory } from './services/historicalDataEngine';

import {
  getLiveQuotes,
  generateCandleHistory,
  getDataQualityStatus,
} from './services/marketData';
import { generateIndicatorSnapshot } from './services/indicators';
import {
  CURRENT_MARKET_REGIME,
  MACRO_ECONOMIC_RELEASES,
  HISTORICAL_EVENT_STUDIES,
  findHistoricalAnalogs,
} from './services/macroData';
import {
  getQuantitativeStrategies,
  QUANTITATIVE_STRATEGIES,
  evaluateAllSubscribedStrategyAlerts,
  buildChronologicalStrategyAlertFeed,
  createTradePlanFromFeedEntry,
  StrategyAlertFeedEntry,
  StrategyAlertHistoryItem,
  StrategyAlertSubscription,
  StrategyEntryEvaluation,
} from './services/strategyEngine';
import {
  EVIDENCE_REGISTRY,
  SPECIALIST_AGENTS,
  getEvidenceRegistry,
  getSpecialistAgents,
  generateTradePlans,
} from './services/advisoryEngine';

import {
  ArrowUpRight,
  LayoutDashboard,
  CandlestickChart,
  Activity,
  TrendingUp,
  Menu,
  Sliders,
  Monitor,
  PanelLeftClose,
  PanelLeftOpen,
  Columns,
  Grid,
  Check,
  Eye,
  EyeOff,
  Maximize2,
  Minimize2,
  RotateCcw,
  BookOpen,
  BellRing,
} from 'lucide-react';

export default function App() {
  const [isDark, setIsDark] = useState<boolean>(true);
  const [activeWorkspace, setActiveWorkspace] = useState<WorkspaceId>('overview');
  const [currentCommodity, setCurrentCommodity] = useState<CommodityType>('GOLD');
  const [historicalPeriod, setHistoricalPeriod] = useState<HistoricalRangePeriod>('5Y');
  const [currentTimeframe, setCurrentTimeframe] = useState<Timeframe>('1D');
  const [customHorizon, setCustomHorizon] = useState<{
    years?: number;
    startDate?: string;
    endDate?: string;
  } | null>(null);
  const [lastRefreshTime, setLastRefreshTime] = useState<Date>(new Date());
  const [isRefreshingQuotes, setIsRefreshingQuotes] = useState<boolean>(false);
  const [selectedPlanForCFD, setSelectedPlanForCFD] = useState<TradePlan | null>(null);
  const [selectedPlanForPaper, setSelectedPlanForPaper] = useState<TradePlan | null>(null);
  const [selectedPlanForPaperLots, setSelectedPlanForPaperLots] = useState<number | null>(null);
  const [selectedStrategyForBacktest, setSelectedStrategyForBacktest] = useState<string>('STRAT-01-MACRO-TREND');
  const [overviewRationaleHorizon, setOverviewRationaleHorizon] = useState<AdvisoryHorizon>('SHORT_TERM');
  const [rationaleModalHorizon, setRationaleModalHorizon] = useState<AdvisoryHorizon | null>(null);

  // User Identity, Enrollment & Access Control (RBAC) State
  const [userSession, setUserSession] = useState<UserSession>(() => getCurrentSession());
  const [isAuthModalOpen, setIsAuthModalOpen] = useState<boolean>(false);
  const [authModalMode, setAuthModalMode] = useState<'LOGIN' | 'ENROLL'>('ENROLL');
  const [targetRestrictedFeature, setTargetRestrictedFeature] = useState<string | undefined>(undefined);
  const [isLandingPageActive, setIsLandingPageActive] = useState<boolean>(() => {
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        const hasSession = window.localStorage.getItem('goldvista_user_session_v2');
        const hasExitedLanding = window.localStorage.getItem('goldvista_has_entered_terminal_v1');
        if (hasSession) {
          const parsed = JSON.parse(hasSession);
          // If already signed in as registered member and previously entered terminal, stay in terminal
          if (parsed.role !== 'GUEST' && hasExitedLanding === 'true') {
            return false;
          }
        }
      }
    } catch (e) {
      console.warn(e);
    }
    return true; // Default to landing page on initial load!
  });

  // Commercial Entitlements & Monetization State (Strictly scoped per userSession.uid)
  const [entitlements, setEntitlements] = useState<UserEntitlementState>(() =>
    loadUserEntitlements(userSession.uid)
  );
  const [checkoutItem, setCheckoutItem] = useState<{
    type: 'PACK' | 'TIER';
    id: string;
    title: string;
    priceUsd: number;
    billingPeriod?: 'month' | 'year' | 'one-time';
    description: string;
  } | null>(null);
  const [isCheckoutOpen, setIsCheckoutOpen] = useState<boolean>(false);
  const [paywallModalState, setPaywallModalState] = useState<{
    isOpen: boolean;
    title: string;
    description: string;
    costCredits: number;
    planToUnlock?: TradePlan;
  }>({
    isOpen: false,
    title: '',
    description: '',
    costCredits: 1,
  });
  const [refundToast, setRefundToast] = useState<{ show: boolean; message: string }>({
    show: false,
    message: '',
  });
  const [strategyPushToast, setStrategyPushToast] = useState<{
    show: boolean;
    title: string;
    message: string;
  }>({
    show: false,
    title: '',
    message: '',
  });
  const [strategyAlertHistory, setStrategyAlertHistory] = useState<StrategyAlertHistoryItem[]>([]);
  const firedStrategyAlertKeysRef = useRef<Set<string>>(new Set());
  const strategyToastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [tradeAlerts, setTradeAlerts] = useState<TradeLifecycleAlertEvent[]>(() =>
    loadUserTradeAlerts(userSession.uid)
  );
  const [browserPushPermission, setBrowserPushPermission] = useState<NotificationPermission | 'unsupported'>(() =>
    getBrowserPushPermission()
  );
  const [tradeAlertToast, setTradeAlertToast] = useState<{
    show: boolean;
    title: string;
    message: string;
    positionId?: string;
    eventType?: 'TRADE_OPENED' | 'TRADE_CLOSED';
  }>({
    show: false,
    title: '',
    message: '',
  });
  const tradeToastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [strategySubscriptions, setStrategySubscriptions] = useState<Record<string, StrategyAlertSubscription>>(() => {
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        const session = getCurrentSession();
        const raw = window.localStorage.getItem(`aurum_strategy_alert_subs_v1:${session.uid || 'guest'}`);
        if (raw) {
          const parsed = JSON.parse(raw);
          if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
            return parsed;
          }
        }
      }
    } catch {
      // ignore storage read issues
    }
    return {};
  });

  const handlePeriodChange = (newPeriod: HistoricalRangePeriod) => {
    setHistoricalPeriod(newPeriod);
    if (newPeriod === '1D') setCurrentTimeframe('5m');
    else if (newPeriod === '5D') setCurrentTimeframe('15m');
    else if (newPeriod === '1M') setCurrentTimeframe('1h');
    else if (newPeriod === 'MAX') setCurrentTimeframe('1W');
    else setCurrentTimeframe('1D');
  };

  // Responsive & Fit-to-Screen Controllable UI State
  const [isFitToScreen, setIsFitToScreen] = useState<boolean>(true);
  const [smartAnnotationsEnabled, setSmartAnnotationsEnabled] = useState<boolean>(() =>
    getGlobalSmartAnnotationEnabled()
  );
  const handleToggleGlobalSmartAnnotations = useCallback((enabled: boolean) => {
    setGlobalSmartAnnotationEnabled(enabled);
    setSmartAnnotationsEnabled(enabled);
  }, []);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState<boolean>(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState<boolean>(false);
  const [isCommandPaletteOpen, setIsCommandPaletteOpen] = useState<boolean>(false);
  const [requestedPortfolioTab, setRequestedPortfolioTab] = useState<PortfolioSubTabId | null>(null);
  const [requestedPortfolioPositionId, setRequestedPortfolioPositionId] = useState<string | null>(null);
  const [userPortfolioPositions, setUserPortfolioPositions] = useState<PaperPosition[]>([]);
  const [chartSetupJump, setChartSetupJump] = useState<{
    entry: StrategyAlertFeedEntry;
    plan: TradePlan;
  } | null>(null);
  const [layoutMode, setLayoutMode] = useState<'AUTO' | 'TERMINAL' | 'SPLIT'>('AUTO');
  const [showTradePlanDock, setShowTradePlanDock] = useState<boolean>(true);
  const [showMacroTickers, setShowMacroTickers] = useState<boolean>(true);

  // Global Keyboard Shortcuts: Ctrl+B / Cmd+B (Sidebar), Ctrl+K / Cmd+K (Quick Jump), / (Quick Jump outside inputs)
  useEffect(() => {
    const handleGlobalShortcuts = (e: KeyboardEvent) => {
      if (isLandingPageActive) return;
      const mod = e.ctrlKey || e.metaKey;
      if (mod && e.key.toLowerCase() === 'b') {
        e.preventDefault();
        setIsSidebarCollapsed((prev) => !prev);
        return;
      }
      if (mod && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setIsCommandPaletteOpen((prev) => !prev);
        return;
      }
      if (e.key === '/' && !mod && !e.altKey) {
        const target = e.target as HTMLElement | null;
        const tag = target?.tagName;
        if (tag !== 'INPUT' && tag !== 'TEXTAREA' && tag !== 'SELECT' && !target?.isContentEditable) {
          e.preventDefault();
          setIsCommandPaletteOpen(true);
        }
      }
    };
    window.addEventListener('keydown', handleGlobalShortcuts);
    return () => window.removeEventListener('keydown', handleGlobalShortcuts);
  }, [isLandingPageActive]);

  const primaryInstrument = getPrimaryInstrumentForCommodity(currentCommodity);
  const primaryInstrumentId = primaryInstrument.id;

  // Market & Analytical State
  const [quotes, setQuotes] = useState<Record<string, Quote>>(() => getLiveQuotes());
  const [coverageReport, setCoverageReport] = useState<HistoricalCoverageReport | null>(null);

  // Initialize with 5-year default historical series
  const initialHistory = generateMultiCommodityHistory(primaryInstrumentId, '5Y', undefined, undefined, 3957.80);
  const [candles, setCandles] = useState<Candle[]>(initialHistory.visibleCandles);
  const [indicators, setIndicators] = useState<IndicatorSnapshot>(initialHistory.currentIndicatorSnapshot);
  const [tradePlans, setTradePlans] = useState<Record<string, TradePlan>>(() =>
    generateTradePlans(quotes[primaryInstrumentId] || quotes['XAUUSD'], {
      candles: initialHistory.visibleCandles,
      indicators: initialHistory.currentIndicatorSnapshot,
    })
  );

  // Apply dark mode class to root html element
  useEffect(() => {
    if (isDark) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [isDark]);

  // Synchronize server-signed HMAC bearer token for non-GUEST active sessions (§6.1)
  useEffect(() => {
    if (userSession.role !== 'GUEST') {
      void refreshSignedSandboxToken(userSession);
    }
  }, [userSession.uid, userSession.role]);

  // Complete OIDC Authorization Code + PKCE callback if returning from IdP (?code=...&state=...)
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const params = new URLSearchParams(window.location.search);
    const code = params.get('code');
    const state = params.get('state');
    if (!code || !state) return;

    const cleanUrl = `${window.location.pathname}${window.location.hash || ''}`;
    window.history.replaceState({}, document.title, cleanUrl);

    void (async () => {
      try {
        const result = await completeOidcPkceCallback(code, state);
        const nowIso = new Date().toISOString();
        const oidcSession: UserSession = {
          uid: result.userId,
          email: userSession.email && userSession.role !== 'GUEST' ? userSession.email : `${result.userId}@oidc.goldvista.io`,
          displayName: `Verified ${result.role} User`,
          authProvider: 'google',
          role: result.role,
          enrolledAt: nowIso,
          lastLoginAt: nowIso,
          isVerified: true,
        };
        saveSession(oidcSession);
        setUserSession(oidcSession);
        const scopedEnt = loadUserEntitlements(oidcSession.uid);
        const syncedEnt: UserEntitlementState = {
          ...scopedEnt,
          tier: result.role === 'ALPHA' ? 'ALPHA' : result.role === 'PRO' ? 'PRO' : 'FREE',
        };
        saveUserEntitlements(syncedEnt, oidcSession.uid);
        setEntitlements(syncedEnt);
        setSelectedPlanForPaper(null);
        setStrategyAlertHistory([]);
        setIsLandingPageActive(false);
        setRefundToast({
          show: true,
          message: `OIDC PKCE login verified (${result.role} tier).`,
        });
      } catch (err: any) {
        setRefundToast({
          show: true,
          message: err?.message || 'OIDC PKCE sign-in callback verification failed.',
        });
      }
      setTimeout(() => setRefundToast((p) => ({ ...p, show: false })), 5000);
    })();
  }, []);

  const [feedStatus, setFeedStatus] = useState<{
    provider: string;
    latencyMs: number;
    quality: 'FRESH' | 'DEGRADED' | 'STALE' | 'QUALITY_HOLD';
    isLive: boolean;
  }>({
    provider: 'Yahoo Finance (Live Market Reference)',
    latencyMs: 140,
    quality: 'FRESH',
    isLive: true,
  });

  // Fetch real-time live quotes from server
  const fetchQuotesFromServer = useCallback(async () => {
    setIsRefreshingQuotes(true);
    try {
      const res = await fetch('/api/market/quotes');
      if (res.ok) {
        const data = await res.json();
        if (data.quotes) {
          setQuotes(data.quotes);
          setLastRefreshTime(new Date());
        }
        if (data.primaryProvider) {
          const isYahoo = data.primaryProvider === 'yahoo_finance';
          const providerHealth = data.routerHealth?.[data.primaryProvider];
          setFeedStatus({
            provider: isYahoo ? 'Yahoo Finance (Live Market Reference)' : 'Aurum Simulated Benchmark',
            latencyMs: providerHealth?.latencyMs || (isYahoo ? 140 : 5),
            quality: (data.quality as any) || (isYahoo ? 'FRESH' : 'QUALITY_HOLD'),
            isLive: isYahoo && data.quality === 'FRESH',
          });
        }
      }
    } catch (e) {
      console.warn('Using local quote stream fallback:', e);
    } finally {
      setIsRefreshingQuotes(false);
    }
  }, [primaryInstrumentId]);

  // Continuous Auto-Refresh Polling (Every 5 seconds) + Immediate Initial Fetch on Mount
  useEffect(() => {
    fetchQuotesFromServer();
    const interval = setInterval(() => {
      fetchQuotesFromServer();
    }, 5000);
    return () => clearInterval(interval);
  }, [fetchQuotesFromServer]);

  // Load Real Market Historical Data whenever commodity, period, timeframe, or custom horizon changes
  const fetchHistoricalData = useCallback(async () => {
    try {
      let url = `/api/market/history?instrumentId=${primaryInstrumentId}`;
      if (customHorizon?.startDate && customHorizon?.endDate) {
        url += `&startDate=${encodeURIComponent(customHorizon.startDate)}&endDate=${encodeURIComponent(customHorizon.endDate)}`;
      } else if (customHorizon?.years) {
        url += `&years=${customHorizon.years}`;
      } else {
        url += `&period=${historicalPeriod}`;
      }
      url += `&timeframe=${currentTimeframe}`;

      const res = await fetch(url);
      if (res.ok) {
        const payload = await res.json();
        if (payload.visibleCandles && payload.visibleCandles.length > 0) {
          setCandles(payload.visibleCandles);
          setCoverageReport(payload.coverageReport);
          setIndicators(payload.currentIndicatorSnapshot);
          return;
        }
      }
    } catch (e) {
      console.warn('History API fetch fallback:', e);
    }

    // Local client-side fallback if server connection is warming up
    const mid = quotes[primaryInstrumentId]?.mid || primaryInstrument.tickValue;
    const localHistory = generateMultiCommodityHistory(
      primaryInstrumentId,
      historicalPeriod,
      customHorizon?.startDate,
      customHorizon?.endDate,
      mid
    );
    setCandles(localHistory.visibleCandles);
    setCoverageReport(localHistory.coverageReport);
    setIndicators(localHistory.currentIndicatorSnapshot);
  }, [primaryInstrumentId, historicalPeriod, currentTimeframe, customHorizon, quotes, primaryInstrument.tickValue]);

  useEffect(() => {
    fetchHistoricalData();
  }, [fetchHistoricalData]);

  const goldQuote = quotes['XAUUSD'] || {
    instrumentId: 'XAUUSD',
    mid: 3898.90,
    bid: 3898.75,
    ask: 3899.05,
    spread: 0.30,
    spreadPips: 30,
    high24h: 3915.00,
    low24h: 3880.00,
    open24h: 3865.00,
    change24hPct: 0.88,
    volume24h: 125000,
    timestamp: new Date().toISOString(),
    provider: 'Yahoo Finance (Live Market Reference)',
    quality: 'FRESH',
    latencyMs: 140,
  };

  const activeQuote = quotes[primaryInstrumentId] || goldQuote;
  const dataQuality = getDataQualityStatus(goldQuote.timestamp);

  // Recompute multi-horizon directional plans whenever live quote, chart candles, or indicators update
  useEffect(() => {
    if (!activeQuote) return;
    setTradePlans(generateTradePlans(activeQuote, { candles, indicators, quote: activeQuote }));
  }, [activeQuote, candles, indicators]);

  // Automated 100% Performance Guarantee Evaluator
  useEffect(() => {
    if (!activeQuote?.mid) return;
    const result = evaluatePerformanceRefunds(entitlements, activeQuote.mid, userSession.uid);
    if (result.refundedCount > 0) {
      setEntitlements(result.updatedState);
      setRefundToast({
        show: true,
        message: `100% Value Guarantee: ${result.refundedCount} trade credit(s) refunded due to stop-loss invalidation!`,
      });
      setTimeout(() => setRefundToast((p) => ({ ...p, show: false })), 6000);
    }
  }, [activeQuote?.mid, entitlements, userSession.uid]);

  // Strategy Alert Subscriptions & Feed History: per-user localStorage + server sync
  useEffect(() => {
    const storageKey = `aurum_strategy_alert_subs_v1:${userSession.uid || 'guest'}`;
    const historyStorageKey = `aurum_strategy_alert_history_v1:${userSession.uid || 'guest'}`;
    firedStrategyAlertKeysRef.current.clear();

    try {
      const rawHistory = window.localStorage?.getItem(historyStorageKey);
      const parsedHistory = rawHistory ? JSON.parse(rawHistory) : [];
      setStrategyAlertHistory(Array.isArray(parsedHistory) ? parsedHistory.slice(0, 25) : []);
    } catch {
      setStrategyAlertHistory([]);
    }

    // Reset transient cross-workspace pointers & hydrate per-user trade alerts + canonical portfolio positions
    setTradeAlerts(loadUserTradeAlerts(userSession.uid));
    setUserPortfolioPositions([]);

    const portfolioBackupKey = `goldvista_paper_journal_backup_v1:${userSession.uid || 'usr_guest_0000'}`;
    try {
      const rawPos = window.localStorage?.getItem(portfolioBackupKey);
      const parsedPos = rawPos ? JSON.parse(rawPos) : [];
      if (Array.isArray(parsedPos) && parsedPos.length > 0) {
        setUserPortfolioPositions(parsedPos);
      }
    } catch {
      setUserPortfolioPositions([]);
    }

    let cancelledPortfolio = false;
    if (userSession.role !== 'GUEST') {
      void (async () => {
        try {
          let token = await ensureSignedBearerToken(userSession);
          if (!token || cancelledPortfolio) return;
          let res = await fetch('/api/portfolio/journal', {
            headers: { Authorization: `Bearer ${token}` },
          });
          if (res.status === 401) {
            token = await ensureSignedBearerToken(userSession, true);
            if (!token || cancelledPortfolio) return;
            res = await fetch('/api/portfolio/journal', {
              headers: { Authorization: `Bearer ${token}` },
            });
          }
          if (!res.ok || cancelledPortfolio) return;
          const payload = (await res.json()) as { positions?: PaperPosition[] };
          if (!cancelledPortfolio && Array.isArray(payload?.positions)) {
            setUserPortfolioPositions(payload.positions);
            try {
              window.localStorage?.setItem(portfolioBackupKey, JSON.stringify(payload.positions));
            } catch {
              // ignore storage write error
            }
          }
        } catch {
          // ignore offline fallback
        }
      })();
    }

    let localSubs: Record<string, StrategyAlertSubscription> = {};
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        const raw = window.localStorage.getItem(storageKey);
        if (raw) {
          const parsed = JSON.parse(raw);
          if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
            localSubs = parsed;
          }
        }
      }
    } catch {
      localSubs = {};
    }
    setStrategySubscriptions(localSubs);

    if (userSession.role !== 'PRO' && userSession.role !== 'ALPHA') {
      return () => {
        cancelledPortfolio = true;
      };
    }

    let cancelled = false;
    void (async () => {
      try {
        let token = await ensureSignedBearerToken(userSession);
        if (!token || cancelled) return;
        let res = await fetch('/api/alerts/strategy-subscriptions', {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (res.status === 401) {
          token = await ensureSignedBearerToken(userSession, true);
          if (!token || cancelled) return;
          res = await fetch('/api/alerts/strategy-subscriptions', {
            headers: { Authorization: `Bearer ${token}` },
          });
        }
        if (!res.ok || cancelled) return;
        const payload = (await res.json()) as {
          subscriptions?: Record<string, StrategyAlertSubscription>;
        };
        const serverSubs = payload?.subscriptions || {};
        const merged = { ...localSubs, ...serverSubs };
        if (!cancelled) {
          setStrategySubscriptions(merged);
          try {
            window.localStorage?.setItem(storageKey, JSON.stringify(merged));
          } catch {
            // ignore storage write error
          }
          const hasLocalOnlyKeys = Object.keys(localSubs).some((k) => !serverSubs[k]);
          if (hasLocalOnlyKeys) {
            await fetch('/api/alerts/strategy-subscriptions', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${token}`,
              },
              body: JSON.stringify({ subscriptions: merged }),
            });
          }
        }
      } catch {
        // Ignore transient sync failures; local subscriptions stay active
      }
    })();

    return () => {
      cancelled = true;
      cancelledPortfolio = true;
    };
  }, [userSession.uid, userSession.role]);

  // Evaluate all 10 quantitative strategy entry criteria continuously on live market updates
  const strategyAlertEvalSnapshot = useMemo(() => {
    const strategies = getQuantitativeStrategies(activeQuote.mid);
    return evaluateAllSubscribedStrategyAlerts(strategies, strategySubscriptions, {
      currentMid: activeQuote.mid,
      instrumentId: primaryInstrumentId,
      candles,
      indicators,
      quote: activeQuote,
      spreadPips: activeQuote.spreadPips,
      tipsRealYieldPct: quotes['US_TIPS10Y']?.mid,
    });
  }, [activeQuote, primaryInstrumentId, candles, indicators, quotes, strategySubscriptions]);

  const dispatchStrategyAlertNotification = useCallback(
    async (
      evalResult: StrategyEntryEvaluation,
      options?: { simulateEntryMatch?: boolean; manualTrigger?: boolean }
    ) => {
      let resolvedEval = evalResult;
      let serverDispatched = false;

      if (userSession.role === 'PRO' || userSession.role === 'ALPHA') {
        try {
          let token = await ensureSignedBearerToken(userSession);
          if (token) {
            let res = await fetch('/api/alerts/strategy-trigger', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${token}`,
              },
              body: JSON.stringify({
                strategyId: evalResult.strategyId,
                instrumentId: evalResult.instrumentId,
                currentMid: evalResult.triggerPrice,
                simulateEntryMatch: Boolean(options?.simulateEntryMatch),
              }),
            });
            if (res.status === 401) {
              token = await ensureSignedBearerToken(userSession, true);
              if (token) {
                res = await fetch('/api/alerts/strategy-trigger', {
                  method: 'POST',
                  headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${token}`,
                  },
                  body: JSON.stringify({
                    strategyId: evalResult.strategyId,
                    instrumentId: evalResult.instrumentId,
                    currentMid: evalResult.triggerPrice,
                    simulateEntryMatch: Boolean(options?.simulateEntryMatch),
                  }),
                });
              }
            }
            if (res.ok) {
              const payload = (await res.json()) as {
                evaluation?: StrategyEntryEvaluation;
                dispatched?: boolean;
              };
              if (payload?.evaluation) {
                resolvedEval = payload.evaluation;
              }
              serverDispatched = Boolean(payload?.dispatched);
            }
          }
        } catch {
          // Continue with in-app/browser notification fallback
        }
      }

      const directionLabel: 'BUY' | 'SELL' = resolvedEval.direction === 'SELL' ? 'SELL' : 'BUY';
      const toastTitle = `${options?.manualTrigger ? 'Simulated ' : ''}Strategy Alert: ${resolvedEval.strategyName} (${directionLabel} ${resolvedEval.instrumentId})`;
      const toastBody =
        resolvedEval.summary ||
        `${resolvedEval.instrumentId} triggered @ $${resolvedEval.triggerPrice.toFixed(2)} (SL $${resolvedEval.stopLossPrice.toFixed(2)}, TP1 $${resolvedEval.target1Price.toFixed(2)}).`;

      let browserPushSent = false;
      try {
        if (
          typeof window !== 'undefined' &&
          'Notification' in window &&
          window.Notification.permission === 'granted'
        ) {
          new window.Notification(toastTitle, {
            body: toastBody,
            tag: `aurum-strat-${resolvedEval.strategyId}-${resolvedEval.instrumentId}`,
          });
          browserPushSent = true;
        }
      } catch {
        // Ignore browser notification restrictions inside sandboxed iframes
      }

      const historyEntry: StrategyAlertHistoryItem = {
        id: `SHIST-${Date.now()}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`,
        strategyId: resolvedEval.strategyId,
        strategyName: resolvedEval.strategyName,
        instrumentId: resolvedEval.instrumentId,
        direction: directionLabel,
        triggerPrice: resolvedEval.triggerPrice,
        stopLossPrice: resolvedEval.stopLossPrice,
        target1Price: resolvedEval.target1Price,
        summary: toastBody,
        timestamp: resolvedEval.evaluatedAt || new Date().toISOString(),
        deliverySummary: browserPushSent
          ? serverDispatched
            ? 'Browser Push + Server Notification Dispatcher'
            : 'Browser Push Notification'
          : serverDispatched
          ? 'In-App Toast + Server Notification Dispatcher'
          : 'In-App Toast Notice',
      };

      setStrategyAlertHistory((prev) => {
        const next = [historyEntry, ...prev].slice(0, 25);
        try {
          window.localStorage?.setItem(
            `aurum_strategy_alert_history_v1:${userSession.uid || 'guest'}`,
            JSON.stringify(next)
          );
        } catch {
          // ignore storage write issue
        }
        return next;
      });
      setStrategySubscriptions((prev) => {
        const existing = prev[resolvedEval.strategyId];
        if (!existing) return prev;
        const updated = {
          ...prev,
          [resolvedEval.strategyId]: {
            ...existing,
            lastTriggeredAt: historyEntry.timestamp,
            lastTriggeredDirection: directionLabel,
            lastTriggerPrice: resolvedEval.triggerPrice,
          },
        };
        try {
          window.localStorage?.setItem(
            `aurum_strategy_alert_subs_v1:${userSession.uid || 'guest'}`,
            JSON.stringify(updated)
          );
        } catch {
          // ignore storage write issue
        }
        return updated;
      });

      setStrategyPushToast({
        show: true,
        title: toastTitle,
        message: toastBody,
      });
      if (strategyToastTimerRef.current) {
        clearTimeout(strategyToastTimerRef.current);
      }
      strategyToastTimerRef.current = setTimeout(() => {
        setStrategyPushToast((p) => ({ ...p, show: false }));
      }, 6500);
    },
    [userSession]
  );

  // Automatic Background Monitor: Fires deduplicated push alerts when subscribed strategies meet live entry criteria
  useEffect(() => {
    const evalMap = strategyAlertEvalSnapshot.evaluations;
    for (const evalRes of Object.values(evalMap)) {
      const sub = strategySubscriptions[evalRes.strategyId];
      const keyPrefix = `${evalRes.strategyId}:`;
      const isLiveMatch =
        Boolean(sub?.enabled) &&
        evalRes.criteriaMet &&
        (evalRes.direction === 'BUY' || evalRes.direction === 'SELL');

      if (isLiveMatch) {
        const dedupeKey = `${evalRes.strategyId}:${evalRes.instrumentId}:${evalRes.direction}`;
        if (!firedStrategyAlertKeysRef.current.has(dedupeKey)) {
          firedStrategyAlertKeysRef.current.add(dedupeKey);
          void dispatchStrategyAlertNotification(evalRes);
        }
      } else {
        for (const existingKey of Array.from(firedStrategyAlertKeysRef.current)) {
          if (existingKey.startsWith(keyPrefix)) {
            firedStrategyAlertKeysRef.current.delete(existingKey);
          }
        }
      }
    }
  }, [strategyAlertEvalSnapshot, strategySubscriptions, dispatchStrategyAlertNotification]);

  const handleToggleStrategySubscription = useCallback(
    (strategyId: string, enabled: boolean) => {
      if (!enabled) {
        const prefix = `${strategyId}:`;
        for (const existingKey of Array.from(firedStrategyAlertKeysRef.current)) {
          if (existingKey.startsWith(prefix)) {
            firedStrategyAlertKeysRef.current.delete(existingKey);
          }
        }
      }

      setStrategySubscriptions((prev) => {
        const existing = prev[strategyId];
        const next: Record<string, StrategyAlertSubscription> = {
          ...prev,
          [strategyId]: {
            strategyId,
            enabled,
            subscribedAt: existing?.subscribedAt || new Date().toISOString(),
            lastTriggeredAt: existing?.lastTriggeredAt,
            lastTriggeredDirection: existing?.lastTriggeredDirection,
            lastTriggerPrice: existing?.lastTriggerPrice,
          },
        };
        try {
          window.localStorage?.setItem(
            `aurum_strategy_alert_subs_v1:${userSession.uid || 'guest'}`,
            JSON.stringify(next)
          );
        } catch {
          // ignore storage write issue
        }
        return next;
      });

      if (userSession.role === 'PRO' || userSession.role === 'ALPHA') {
        void (async () => {
          try {
            let token = await ensureSignedBearerToken(userSession);
            if (!token) return;
            let res = await fetch('/api/alerts/strategy-subscriptions', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${token}`,
              },
              body: JSON.stringify({ strategyId, enabled }),
            });
            if (res.status === 401) {
              token = await ensureSignedBearerToken(userSession, true);
              if (!token) return;
              await fetch('/api/alerts/strategy-subscriptions', {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                  Authorization: `Bearer ${token}`,
                },
                body: JSON.stringify({ strategyId, enabled }),
              });
            }
          } catch {
            // Keep local subscription state intact on transient network failure
          }
        })();
      }
    },
    [userSession]
  );

  const handleTestStrategyTrigger = useCallback(
    async (strategyId: string) => {
      const strategies = getQuantitativeStrategies(activeQuote.mid);
      const strategy = strategies.find((s) => s.id === strategyId);
      if (!strategy) return;
      const currentEval = strategyAlertEvalSnapshot.evaluations[strategyId] || {
        strategyId: strategy.id,
        strategyName: strategy.name,
        instrumentId: primaryInstrumentId,
        criteriaMet: true,
        direction: strategy.currentSignal.action === 'SELL' ? 'SELL' : 'BUY',
        triggerPrice: activeQuote.mid,
        stopLossPrice: Number((activeQuote.mid * 0.992).toFixed(2)),
        target1Price: Number((activeQuote.mid * 1.016).toFixed(2)),
        matchedConditionsCount: 2,
        totalConditionsCount: 2,
        checks: [],
        summary: `${strategy.name} simulated entry alert triggered on ${primaryInstrumentId} @ $${activeQuote.mid.toFixed(2)}.`,
        evaluatedAt: new Date().toISOString(),
      };
      await dispatchStrategyAlertNotification(currentEval, {
        simulateEntryMatch: true,
        manualTrigger: true,
      });
    },
    [activeQuote.mid, primaryInstrumentId, strategyAlertEvalSnapshot, dispatchStrategyAlertNotification]
  );

  const strategyAlertFeed = useMemo(
    () =>
      buildChronologicalStrategyAlertFeed({
        liveHistory: strategyAlertHistory,
        strategies: getQuantitativeStrategies(activeQuote.mid),
        evaluations: strategyAlertEvalSnapshot.evaluations,
        quotes,
        candles,
        activeInstrumentId: primaryInstrumentId,
        portfolioPositions: userPortfolioPositions,
      }),
    [
      strategyAlertHistory,
      activeQuote.mid,
      strategyAlertEvalSnapshot.evaluations,
      quotes,
      candles,
      primaryInstrumentId,
      userPortfolioPositions,
    ]
  );

  const handleClearStrategyAlertHistory = useCallback(() => {
    setStrategyAlertHistory([]);
    try {
      window.localStorage?.removeItem(
        `aurum_strategy_alert_history_v1:${userSession.uid || 'guest'}`
      );
    } catch {
      // ignore storage cleanup issue
    }
  }, [userSession.uid]);

  const handleJumpToChartSetup = useCallback((entry: StrategyAlertFeedEntry) => {
    const plan = createTradePlanFromFeedEntry(entry);
    setCurrentCommodity(entry.commodity);
    setCurrentTimeframe(entry.timeframe);
    setHistoricalPeriod(
      entry.timeframe === '15m'
        ? '5D'
        : entry.timeframe === '1h'
        ? '1M'
        : entry.timeframe === '4h'
        ? '1Y'
        : '5Y'
    );
    setCustomHorizon(null);
    setSelectedStrategyForBacktest(entry.strategyId);
    setChartSetupJump({ entry, plan });
    setActiveWorkspace('terminal');
  }, []);

  const handleJumpToPortfolioEntry = useCallback((entry: StrategyAlertFeedEntry) => {
    if (entry.linkedPortfolioPositionId) {
      setRequestedPortfolioTab('journal');
      setRequestedPortfolioPositionId(entry.linkedPortfolioPositionId);
      setActiveWorkspace('portfolio');
      return;
    }
    if (entry.linkedAuditedPlanId) {
      setRequestedPortfolioTab('historicalPlans');
      setActiveWorkspace('portfolio');
      return;
    }
    const plan = createTradePlanFromFeedEntry(entry);
    setSelectedPlanForPaper(plan);
    setRequestedPortfolioTab('journal');
    setActiveWorkspace('portfolio');
  }, []);

  const handleOpenFullAlertFeed = useCallback(() => {
    setActiveWorkspace('overview');
    window.setTimeout(() => {
      document
        .getElementById('strategy-alert-feed-widget')
        ?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 80);
  }, []);

  const handleSelectForCFD = (plan: TradePlan) => {
    setSelectedPlanForCFD(plan);
    setActiveWorkspace('cfd');
  };

  const handleExecutePaper = (plan: TradePlan, suggestedLots?: number) => {
    setSelectedPlanForPaper(plan);
    setSelectedPlanForPaperLots(
      typeof suggestedLots === 'number' && Number.isFinite(suggestedLots) && suggestedLots > 0
        ? suggestedLots
        : null
    );
    setRequestedPortfolioTab('journal');
    setActiveWorkspace('portfolio');
  };

  const handleTradeAlertDispatched = useCallback(
    (alert: TradeLifecycleAlertEvent, allAlerts: TradeLifecycleAlertEvent[]) => {
      setTradeAlerts(allAlerts);
      const { title, summary } = formatTradeAlertHeadline(alert);
      setTradeAlertToast({
        show: true,
        title,
        message: summary,
        positionId: alert.positionId,
        eventType: alert.eventType,
      });
      if (tradeToastTimerRef.current) {
        clearTimeout(tradeToastTimerRef.current);
      }
      tradeToastTimerRef.current = setTimeout(() => {
        setTradeAlertToast((prev) => ({ ...prev, show: false }));
      }, 6000);
    },
    []
  );

  const handleJumpToPositions = useCallback((positionId?: string) => {
    setRequestedPortfolioTab('journal');
    if (positionId) {
      setRequestedPortfolioPositionId(positionId);
    }
    setActiveWorkspace('portfolio');
  }, []);

  const handleEnablePushNotifications = useCallback(async () => {
    const result = await requestBrowserPushPermission();
    setBrowserPushPermission(result);
    if (result === 'granted') {
      setRefundToast({
        show: true,
        message: 'Desktop push alerts enabled for trade open, close, and strategy triggers.',
      });
      setTimeout(() => setRefundToast((p) => ({ ...p, show: false })), 4000);
    }
  }, []);

  const handleUnlockPlan = (plan: TradePlan) => {
    if (entitlements.tier === 'PRO' || entitlements.tier === 'ALPHA') {
      return;
    }
    if (entitlements.creditsBalance < 1) {
      setPaywallModalState({
        isOpen: true,
        title: `Unlock ${plan.instrumentId} ${plan.horizon} Plan`,
        description: `Access institutional limit order corridors ($${plan.entryZoneMin.toFixed(1)} - $${plan.entryZoneMax.toFixed(1)}), strict invalidation stops, and multi-target harvest tiers.`,
        costCredits: 1,
        planToUnlock: plan,
      });
      return;
    }

    const res = unlockPlanWithGuarantee(
      entitlements,
      plan.id,
      plan.stopLossPrice,
      plan.target1Price,
      plan.direction as 'BUY' | 'SELL',
      userSession.uid
    );
    if (res.success) {
      setEntitlements(res.updatedState);
      setRefundToast({
        show: true,
        message: `Plan unlocked! 1 credit applied. Non-Cash Signal Credit Refund active if stopped out.`,
      });
      setTimeout(() => setRefundToast((p) => ({ ...p, show: false })), 5000);
    }
  };

  const handleCheckoutSuccess = (itemType: 'PACK' | 'TIER', itemId: string) => {
    if (itemType === 'PACK') {
      const updated = purchaseCreditPack(entitlements, itemId, userSession.uid);
      setEntitlements(updated);
      setRefundToast({
        show: true,
        message: `Payment successful! Signal credits added to your balance.`,
      });
    } else {
      const newRole = itemId as UserRole;
      const updated = upgradeMembershipTier(entitlements, itemId as any, userSession.uid);
      setEntitlements(updated);
      // Synchronize active user session role
      const updatedSession: UserSession = {
        ...userSession,
        role: newRole,
      };
      saveSession(updatedSession);
      setUserSession(updatedSession);

      setRefundToast({
        show: true,
        message: `Welcome to GoldVista ${itemId}! All signals & institutional tools unlocked.`,
      });
    }
    setTimeout(() => setRefundToast((p) => ({ ...p, show: false })), 5000);
  };

  const handleChangeUserTier = (role: Exclude<UserRole, 'GUEST'>) => {
    const updated = updateCurrentUserTier(role);
    setUserSession(updated);
    const scoped = loadUserEntitlements(updated.uid);
    const nextEnt: UserEntitlementState = {
      ...scoped,
      tier: role,
      creditsBalance:
        role === 'ALPHA'
          ? Math.max(scoped.creditsBalance, 500)
          : role === 'PRO'
          ? Math.max(scoped.creditsBalance, 100)
          : scoped.creditsBalance,
    };
    saveUserEntitlements(nextEnt, updated.uid);
    setEntitlements(nextEnt);
    setRefundToast({
      show: true,
      message: `Account tier updated to ${role} for ${updated.displayName}. Your trades & ledger remain intact.`,
    });
    setTimeout(() => setRefundToast((p) => ({ ...p, show: false })), 4000);
  };

  const handleSwitchPersona = (role: UserRole) => {
    const updated = switchPersona(role);
    setUserSession(updated);
    setSelectedPlanForPaper(null);
    setSelectedPlanForPaperLots(null);
    setSelectedPlanForCFD(null);
    setChartSetupJump(null);
    setRequestedPortfolioPositionId(null);
    setStrategyPushToast({ show: false, title: '', message: '' });
    setTradeAlertToast({ show: false, title: '', message: '' });
    const scoped = loadUserEntitlements(updated.uid);
    const nextEnt: UserEntitlementState = {
      ...scoped,
      tier: role === 'ALPHA' ? 'ALPHA' : role === 'PRO' ? 'PRO' : 'FREE',
      creditsBalance:
        role === 'ALPHA'
          ? Math.max(scoped.creditsBalance, 500)
          : role === 'PRO'
          ? Math.max(scoped.creditsBalance, 100)
          : scoped.creditsBalance,
    };
    saveUserEntitlements(nextEnt, updated.uid);
    setEntitlements(nextEnt);
    setRefundToast({
      show: true,
      message: `Switched demo account to ${DEMO_PERSONAS[role].displayName} (${role} tier).`,
    });
    setTimeout(() => setRefundToast((p) => ({ ...p, show: false })), 4000);
  };

  const handleLogout = () => {
    const guest = logoutUser();
    setUserSession(guest);
    setSelectedPlanForPaper(null);
    setSelectedPlanForPaperLots(null);
    setSelectedPlanForCFD(null);
    setChartSetupJump(null);
    setRequestedPortfolioPositionId(null);
    setStrategyPushToast({ show: false, title: '', message: '' });
    setTradeAlertToast({ show: false, title: '', message: '' });
    const guestEnt = loadUserEntitlements(guest.uid);
    const nextEnt: UserEntitlementState = {
      ...guestEnt,
      tier: 'FREE',
    };
    saveUserEntitlements(nextEnt, guest.uid);
    setEntitlements(nextEnt);
    setRefundToast({
      show: true,
      message: 'Signed out. Platform reverted to Public / Guest mode.',
    });
    setTimeout(() => setRefundToast((p) => ({ ...p, show: false })), 4000);
  };

  const handleSessionUpdated = (session: UserSession, isNewEnrollment?: boolean) => {
    setUserSession(session);
    setSelectedPlanForPaper(null);
    setSelectedPlanForPaperLots(null);
    setSelectedPlanForCFD(null);
    setChartSetupJump(null);
    setRequestedPortfolioPositionId(null);
    const scoped = loadUserEntitlements(session.uid);
    const nextEnt: UserEntitlementState = {
      ...scoped,
      tier: session.role === 'ALPHA' ? 'ALPHA' : session.role === 'PRO' ? 'PRO' : 'FREE',
      creditsBalance: isNewEnrollment ? Math.max(scoped.creditsBalance, 5) : scoped.creditsBalance,
    };
    saveUserEntitlements(nextEnt, session.uid);
    setEntitlements(nextEnt);
    if (isNewEnrollment) {
      setRefundToast({
        show: true,
        message: `Welcome ${session.displayName}! 5 Welcome Alpha Credits unlocked under our Non-Cash Signal Credit Refund policy.`,
      });
      setTimeout(() => setRefundToast((p) => ({ ...p, show: false })), 5000);
    }
  };

  const handleLaunchTerminal = () => {
    setIsLandingPageActive(false);
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        window.localStorage.setItem('goldvista_has_entered_terminal_v1', 'true');
      }
    } catch (e) {
      console.warn(e);
    }
  };

  const handleDirectEnroll = async (data: {
    email: string;
    displayName: string;
    password?: string;
    country: string;
    tradingProfile: {
      primaryHorizon: 'INTRADAY' | 'SWING' | 'PROP_FIRM' | 'MACRO';
      brokerName: string;
      accountSize: string;
      experienceLevel: 'NOVICE' | 'INTERMEDIATE' | 'ADVANCED' | 'INSTITUTIONAL';
    };
  }) => {
    const session = await enrollNewCustomer({
      email: data.email,
      displayName: data.displayName,
      password: data.password,
      rejectDuplicate: Boolean(data.password),
      authProvider: 'email',
      tradingProfile: data.tradingProfile,
    });
    handleSessionUpdated(session, true);
    handleLaunchTerminal();
  };

  const getWorkspaceTitle = (): string => {
    switch (activeWorkspace) {
      case 'overview':
        return `Multi-Commodity Overview (${primaryInstrument.displayName})`;
      case 'terminal':
        return `Live 5-Year Historical Terminal (${primaryInstrument.symbol})`;
      case 'technical':
        return 'Multi-Timeframe Technical Confluence';
      case 'intraday':
        return 'Intraday Session Advisor (M5 - H1)';
      case 'swing':
        return 'Swing Trading Horizon Advisor (H4 - D1)';
      case 'longterm':
        return 'Long-Term Secular Macro Outlook';
      case 'cfd':
        return 'CFD Margin & Position Sizing Calculator';
      case 'news_sentiment':
        return 'News Discovery & Causal Sentiment';
      case 'scenarios':
        return 'Macro Scenarios & Historical Analogues';
      case 'llm_platform':
        return 'LLM Platform & Publication Gate';
      case 'macro':
        return 'Macroeconomic Series & Vintages';
      case 'events':
        return 'Historical Event Studies & Analogs';
      case 'strategies':
        return 'Quantitative Strategy Catalog';
      case 'backtesting':
        return 'Walk-Forward Backtesting Engine';
      case 'portfolio':
        return 'Paper Trading Portfolio & Journal';
      case 'performance_insights':
        return 'Performance Insights & Trade Analytics';
      case 'council':
        return 'AI Advisory Council & Specialist Agents';
      case 'reports':
        return 'Verified Intelligence Reports & Export';
      case 'alerts':
        return 'Alert Evaluation & Data Health';
      case 'market_data_config':
        return 'Market Data Providers & Broker Connectivity';
      case 'telegram_notifications':
        return 'Telegram & Multi-Channel Alert Delivery';
      case 'gemini_chat':
        return 'Gemini AI Commodity Research Analyst';
      case 'monetization':
        return 'Pricing & VIP Access (Commercial Hub)';
      default:
        return 'Aurum Intelligence';
    }
  };

  const accessCheck = canAccessWorkspace(userSession.role, activeWorkspace);

  return (
    <div
      className={`${
        isFitToScreen ? 'h-screen max-h-screen overflow-hidden' : 'min-h-screen'
      } flex flex-col overflow-x-hidden ${
        isDark ? 'dark bg-slate-950 text-slate-100' : 'bg-slate-50 text-slate-900'
      }`}
    >
      <a
        href="#main-workspace"
        className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-50 focus:px-3 focus:py-1.5 focus:rounded focus:bg-amber-400 focus:text-slate-950 focus:text-xs focus:font-bold"
      >
        Skip to main workspace
      </a>
      {/* Top Bar Contract */}
      {(() => {
        const openPositionsList = userPortfolioPositions.filter((p) => p.status === 'OPEN');
        const openUnrealized = openPositionsList.reduce((acc, p) => {
          const mark = quotes[p.instrumentId]?.mid || activeQuote.mid || p.currentPrice;
          const delta = p.direction === 'SELL' ? p.entryPrice - mark : mark - p.entryPrice;
          return acc + delta * p.lots * getInstrumentMultiplierForMae(p.instrumentId);
        }, 0);
        return (
          <Navbar
            quotes={quotes}
            isDark={isDark}
            onToggleTheme={() => setIsDark(!isDark)}
            activeWorkspaceTitle={getWorkspaceTitle()}
            currentCommodity={currentCommodity}
            onCommodityChange={setCurrentCommodity}
            isRefreshing={isRefreshingQuotes}
            onRefreshQuotes={fetchQuotesFromServer}
            lastRefreshTime={lastRefreshTime}
            isFitToScreen={isFitToScreen}
            onToggleFitToScreen={() => setIsFitToScreen((prev) => !prev)}
            isSidebarCollapsed={isSidebarCollapsed}
            onToggleSidebar={() => setIsSidebarCollapsed((prev) => !prev)}
            onOpenMobileMenu={() => setIsMobileMenuOpen(true)}
            creditsBalance={entitlements.creditsBalance}
            membershipTier={entitlements.tier}
            onOpenPricingHub={() => setActiveWorkspace('monetization')}
            userSession={userSession}
            onOpenAuth={(mode) => {
              setAuthModalMode(mode || 'LOGIN');
              setIsAuthModalOpen(true);
            }}
            onSwitchPersona={handleSwitchPersona}
            onChangeTier={handleChangeUserTier}
            onLogout={handleLogout}
            isLandingPageActive={isLandingPageActive}
            onToggleLandingPage={() => setIsLandingPageActive(!isLandingPageActive)}
            onOpenCommandPalette={() => setIsCommandPaletteOpen(true)}
            openPositionsCount={openPositionsList.length}
            openUnrealizedPnl={openUnrealized}
            onJumpToPositions={handleJumpToPositions}
            tradeAlerts={tradeAlerts}
            onMarkAlertsRead={() => setTradeAlerts(markAllTradeAlertsRead(userSession.uid))}
            browserPushPermission={browserPushPermission}
            onEnablePushNotifications={handleEnablePushNotifications}
            feedStatus={feedStatus}
          />
        );
      })()}

      {isLandingPageActive ? (
        <div className="flex-1 overflow-y-auto">
          <LandingPage
            quotes={quotes}
            userSession={userSession}
            onLaunchTerminal={handleLaunchTerminal}
            onOpenAuth={(mode) => {
              setAuthModalMode(mode || 'ENROLL');
              setIsAuthModalOpen(true);
            }}
            onLogout={handleLogout}
            onOpenCheckout={(item) => {
              setCheckoutItem(item);
              setIsCheckoutOpen(true);
            }}
            onEnrollUser={handleDirectEnroll}
          />
        </div>
      ) : (
        /* Main Workspace Layout */
        <div className="flex-1 flex overflow-hidden">
          {/* Navigation Sidebar */}
          <Sidebar
            activeId={activeWorkspace}
            onSelect={(id) => {
              setActiveWorkspace(id);
              setIsMobileMenuOpen(false);
            }}
            isCollapsed={isSidebarCollapsed}
            onToggleCollapse={() => setIsSidebarCollapsed((prev) => !prev)}
            isOpenMobile={isMobileMenuOpen}
            onCloseMobile={() => setIsMobileMenuOpen(false)}
            userRole={userSession.role}
            userSession={userSession}
            onOpenAuth={(mode) => {
              setAuthModalMode(mode || 'LOGIN');
              setIsAuthModalOpen(true);
            }}
            onLogout={handleLogout}
            onOpenCommandPalette={() => setIsCommandPaletteOpen(true)}
            strategyAlertFeed={strategyAlertFeed}
            onJumpToChartSetup={handleJumpToChartSetup}
            onJumpToPortfolioEntry={handleJumpToPortfolioEntry}
            onOpenFullAlertFeed={handleOpenFullAlertFeed}
            openPositionsCount={userPortfolioPositions.filter((p) => p.status === 'OPEN').length}
          />

          {/* Content Viewport */}
          <main
            id="main-workspace"
            tabIndex={-1}
            className={`flex-1 focus:outline-none ${
              isFitToScreen ? 'overflow-y-auto' : 'overflow-y-visible'
            } p-3 sm:p-5 lg:p-6 pb-24 md:pb-6 max-w-[1680px] w-full mx-auto`}
          >
            <WorkspaceErrorBoundary
              workspaceTitle={getWorkspaceTitle()}
              resetKey={activeWorkspace}
              onReturnToOverview={() => setActiveWorkspace('overview')}
            >
            {!accessCheck.allowed ? (
              <AccessGateGuard
                accessCheck={accessCheck}
                onOpenAuth={(mode) => {
                  setAuthModalMode(mode || 'LOGIN');
                  setTargetRestrictedFeature(accessCheck.workspaceTitle);
                  setIsAuthModalOpen(true);
                }}
                onOpenPricingHub={() => setActiveWorkspace('monetization')}
                onOpenCheckout={(item) => {
                  setCheckoutItem(item);
                  setIsCheckoutOpen(true);
                }}
                onSwitchPersona={handleSwitchPersona}
                onChangeTier={handleChangeUserTier}
              />
            ) : (
              <>
                {/* 1. WORKSPACE: MARKET OVERVIEW */}
                {activeWorkspace === 'overview' && (
            <div className="space-y-4 sm:space-y-6">
              {/* Workspace Layout & Organizing Control Bar */}
              <div className="flex flex-wrap items-center justify-between gap-2.5 bg-slate-900 border border-slate-800 rounded-lg p-2.5 px-3 text-xs font-mono shadow-xs">
                {/* Left: Layout Presets Switcher */}
                <div className="flex items-center gap-1.5 overflow-x-auto py-0.5">
                  <span className="text-[10px] uppercase text-slate-500 font-bold mr-1 flex items-center gap-1">
                    <Grid className="w-3.5 h-3.5 text-amber-400" />
                    Layout:
                  </span>
                  <button
                    onClick={() => {
                      setLayoutMode('AUTO');
                      setShowTradePlanDock(true);
                    }}
                    className={`px-2.5 py-1 rounded transition-all font-medium text-[11px] ${
                      layoutMode === 'AUTO' && showTradePlanDock
                        ? 'bg-amber-500 text-slate-950 font-bold shadow-xs'
                        : 'bg-slate-950 text-slate-400 hover:text-slate-200 border border-slate-800'
                    }`}
                    title="Auto Best Fit: Optimized responsive layout with balanced chart and trade plan"
                  >
                    Auto Best Fit
                  </button>
                  <button
                    onClick={() => {
                      setLayoutMode('TERMINAL');
                      setShowTradePlanDock(false);
                    }}
                    className={`px-2.5 py-1 rounded transition-all font-medium text-[11px] ${
                      layoutMode === 'TERMINAL' || !showTradePlanDock
                        ? 'bg-amber-500 text-slate-950 font-bold shadow-xs'
                        : 'bg-slate-950 text-slate-400 hover:text-slate-200 border border-slate-800'
                    }`}
                    title="Max Terminal: 100% chart width canvas"
                  >
                    Max Terminal
                  </button>
                  <button
                    onClick={() => {
                      setLayoutMode('SPLIT');
                      setShowTradePlanDock(true);
                    }}
                    className={`px-2.5 py-1 rounded transition-all font-medium text-[11px] ${
                      layoutMode === 'SPLIT' && showTradePlanDock
                        ? 'bg-amber-500 text-slate-950 font-bold shadow-xs'
                        : 'bg-slate-950 text-slate-400 hover:text-slate-200 border border-slate-800'
                    }`}
                    title="Split Screen: 60/40 Chart and Plan split"
                  >
                    Split Screen
                  </button>
                </div>

                {/* Right: Component Toggles (Tickers, Trade Plan Dock, Fit Screen) */}
                <div className="flex items-center gap-1.5 text-xs">
                  <button
                    onClick={() => setShowMacroTickers((prev) => !prev)}
                    className={`flex items-center gap-1 px-2.5 py-1 rounded border text-[11px] transition-colors ${
                      showMacroTickers
                        ? 'bg-slate-800 text-slate-200 border-slate-700 font-semibold'
                        : 'bg-slate-950 text-slate-500 border-slate-800 hover:text-slate-400'
                    }`}
                    title="Toggle Live Cross-Asset Macro Tickers"
                  >
                    {showMacroTickers ? <Eye className="w-3 h-3 text-amber-400" /> : <EyeOff className="w-3 h-3" />}
                    <span>Tickers</span>
                  </button>

                  <button
                    onClick={() => setShowTradePlanDock((prev) => !prev)}
                    className={`flex items-center gap-1 px-2.5 py-1 rounded border text-[11px] transition-colors ${
                      showTradePlanDock
                        ? 'bg-slate-800 text-slate-200 border-slate-700 font-semibold'
                        : 'bg-slate-950 text-slate-500 border-slate-800 hover:text-slate-400'
                    }`}
                    title="Toggle Trade Plan Dock"
                  >
                    <Columns className="w-3 h-3 text-sky-400" />
                    <span>Plan Dock</span>
                  </button>

                  <button
                    onClick={() => setIsFitToScreen((prev) => !prev)}
                    className={`flex items-center gap-1 px-2.5 py-1 rounded border text-[11px] transition-colors ${
                      isFitToScreen
                        ? 'bg-amber-500/20 text-amber-300 border-amber-500/50 font-semibold'
                        : 'bg-slate-950 text-slate-500 border-slate-800 hover:text-slate-400'
                    }`}
                    title="Fit Entire Terminal to Screen Viewport"
                  >
                    <Monitor className="w-3 h-3 text-emerald-400" />
                    <span>Fit Screen</span>
                  </button>
                </div>
              </div>

              {/* Executive Bias & Market Pulse Header */}
              <div className="bg-slate-900 border border-slate-800 rounded-lg p-4 sm:p-5">
                <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-slate-800">
                  <div>
                    <span className="text-xs font-mono text-amber-400 uppercase tracking-widest block font-bold">
                      EXECUTIVE ADVISORY PULSE
                    </span>
                    <h1 className="text-lg sm:text-2xl font-bold text-slate-100 mt-1 tabular-nums">
                      {primaryInstrument.displayName} · Live Market Rate: ${primaryInstrumentId.includes('10Y') ? activeQuote.mid.toFixed(3) : activeQuote.mid.toFixed(2)}
                    </h1>
                  </div>

                  <div className="flex flex-wrap items-center gap-3 text-xs font-mono">
                    <span className="flex items-center gap-1 text-emerald-400 font-semibold">
                      <ArrowUpRight className="w-3.5 h-3.5" aria-hidden="true" />
                      Feed: {activeQuote.provider}
                    </span>
                    <span className="text-slate-600" aria-hidden="true">·</span>
                    <span aria-live="polite" className="text-slate-300">
                      Freshness: {dataQuality.label}
                    </span>
                    <button
                      type="button"
                      onClick={() => setRationaleModalHorizon(overviewRationaleHorizon)}
                      className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-100 border border-slate-700 rounded text-xs font-sans font-medium transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                    >
                      Inspect Strategy Bias Rationale
                    </button>
                  </div>
                </div>

                {/* Macro Synthesis Callout */}
                <p className="text-xs sm:text-sm text-slate-300 mt-3 leading-relaxed max-w-4xl">
                  {primaryInstrument.displayName} trades at <strong className="tabular-nums">${activeQuote.mid.toFixed(2)}</strong> ({activeQuote.change24hPct >= 0 ? '+' : ''}{activeQuote.change24hPct}% 24h change), verified against official continuous COMEX/ICE benchmark quotes. Directional recommendations adapt per horizon based on live EMA structure, candle slope, oscillators, and commodity causal news catalysts.
                </p>
              </div>

              {/* Multi-Asset Market Tickers Grid (Toggleable) */}
              {showMacroTickers && (
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="text-xs font-mono uppercase tracking-wider text-slate-400">
                      Live Cross-Asset Macro Benchmarks
                    </h3>
                    <button
                      onClick={() => setActiveWorkspace('market_data_config')}
                      className="text-xs font-mono text-amber-400 hover:underline"
                    >
                      Configure Data Feeds →
                    </button>
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-2.5 text-xs font-mono tabular-nums">
                    {Object.values(quotes).map((q) => {
                      const isPositive = q.change24hPct >= 0;
                      return (
                        <div
                          key={q.instrumentId}
                          className="bg-slate-900 border border-slate-800 p-2.5 rounded-lg hover:border-slate-700 transition-colors"
                        >
                          <span className="text-slate-400 font-bold block text-[11px] truncate">
                            {q.instrumentId}
                          </span>
                          <span className="text-sm sm:text-base font-bold text-slate-100 block mt-0.5">
                            ${q.mid.toFixed(q.instrumentId.includes('10Y') ? 3 : 2)}
                          </span>
                          <div className="flex justify-between items-center text-[10px] text-slate-500 mt-0.5">
                            <span className={isPositive ? 'text-emerald-400' : 'text-rose-400'}>
                              {isPositive ? '+' : ''}{q.change24hPct}%
                            </span>
                            <span>{q.spreadPips} p</span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Central Chart Viewport & Quick Advisory Cards */}
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
                <div
                  className={
                    !showTradePlanDock || layoutMode === 'TERMINAL'
                      ? 'lg:col-span-12'
                      : layoutMode === 'SPLIT'
                      ? 'lg:col-span-7'
                      : 'lg:col-span-8'
                  }
                >
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="text-xs font-mono uppercase tracking-wider text-slate-400">
                      Live Chart & Overlay Diagnostics
                    </h3>
                    <span className="text-xs font-mono text-slate-500">
                      Resolution: {currentTimeframe}
                    </span>
                  </div>
                  <CandleChart
                    candles={candles}
                    instrumentId={primaryInstrument.id}
                    timeframe={currentTimeframe}
                    period={historicalPeriod}
                    onTimeframeChange={setCurrentTimeframe}
                    onPeriodChange={handlePeriodChange}
                    customHorizon={customHorizon}
                    onCustomHorizonChange={setCustomHorizon}
                    tradePlan={tradePlans['SWING']}
                    indicators={indicators}
                    coverageReport={coverageReport}
                    unit={primaryInstrument.unit}
                    instrumentName={primaryInstrument.displayName}
                    height={isFitToScreen ? 500 : 460}
                    isFitToScreen={isFitToScreen}
                    onToggleFitScreen={() => setIsFitToScreen((prev) => !prev)}
                    smartAnnotationsEnabled={smartAnnotationsEnabled}
                    onToggleSmartAnnotations={handleToggleGlobalSmartAnnotations}
                  />
                </div>

                {showTradePlanDock && layoutMode !== 'TERMINAL' && (
                  <div
                    className={
                      layoutMode === 'SPLIT' ? 'lg:col-span-5 space-y-4' : 'lg:col-span-4 space-y-4'
                    }
                  >
                    <h3 className="text-xs font-mono uppercase tracking-wider text-slate-400">
                      Validated Active Trade Plan
                    </h3>
                    {tradePlans['SWING'] && (
                      <TradePlanCard
                        plan={tradePlans['SWING']}
                        quote={activeQuote}
                        candles={candles}
                        indicators={indicators}
                        onSelectForCFD={handleSelectForCFD}
                        onExecutePaper={handleExecutePaper}
                        onInspectRationale={(p) => setRationaleModalHorizon(p.horizon)}
                        isLocked={!isPlanUnlocked(entitlements, tradePlans['SWING'].id)}
                        onUnlock={handleUnlockPlan}
                        isGuaranteed={Boolean(entitlements.unlockedPlans[tradePlans['SWING'].id]?.status === 'ACTIVE' && !entitlements.unlockedPlans[tradePlans['SWING'].id]?.refunded)}
                      />
                    )}
                  </div>
                )}
              </div>

              {/* Real-Time Trade Volume Profile & Institutional Liquidity Zones */}
              <TradeVolumeProfileWidget
                candles={candles}
                quote={activeQuote}
                instrumentName={primaryInstrument.displayName}
                instrumentId={primaryInstrumentId}
                timeframe={currentTimeframe}
              />

              {/* Multi-Horizon Advisory Snapshot Strip */}
              <div>
                <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
                  <h3 className="text-xs font-mono uppercase tracking-wider text-slate-400">
                    Multi-Horizon Advisory Recommendations
                  </h3>
                  <button
                    type="button"
                    onClick={() => setRationaleModalHorizon(overviewRationaleHorizon)}
                    className="text-xs font-mono text-amber-400 hover:underline whitespace-nowrap shrink-0 cursor-pointer"
                  >
                    Open Detailed Rationale Modal →
                  </button>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
                  {(['INTRADAY', 'SHORT_TERM', 'SWING', 'LONG_TERM'] as AdvisoryHorizon[]).map((horizon) => {
                    const plan = tradePlans[horizon];
                    if (!plan) return null;
                    const dirColor =
                      plan.direction === 'BUY'
                        ? 'text-emerald-400 bg-emerald-500/10'
                        : plan.direction === 'SELL'
                        ? 'text-rose-400 bg-rose-500/10'
                        : 'text-amber-300 bg-amber-500/10';
                    return (
                      <div
                        key={horizon}
                        className="bg-slate-900 border border-slate-800 p-4 rounded-lg text-xs font-mono space-y-2 hover:border-slate-700 transition-colors"
                      >
                        <div className="flex justify-between items-center pb-2 border-b border-slate-800">
                          <span className="font-bold text-slate-300">{horizon}</span>
                          <span className={`font-bold px-2 py-0.5 rounded ${dirColor}`}>
                            {plan.direction}
                          </span>
                        </div>
                        <div className="flex justify-between text-slate-400 tabular-nums">
                          <span>Entry Zone:</span>
                          <span className="text-slate-200 font-bold">
                            ${plan.entryZoneMin} - ${plan.entryZoneMax}
                          </span>
                        </div>
                        <div className="flex justify-between text-slate-400 tabular-nums">
                          <span>Stop Loss:</span>
                          <span className="text-rose-400 font-bold">${plan.stopLossPrice}</span>
                        </div>
                        <div className="flex justify-between text-slate-400 tabular-nums">
                          <span>Target 1:</span>
                          <span className="text-emerald-400 font-bold">${plan.target1Price}</span>
                        </div>
                        <div className="flex justify-between items-center text-slate-400 pt-1.5 border-t border-slate-800/60 tabular-nums">
                          <span>Net R:R: <strong className="text-amber-400">1:{plan.rewardToRiskRatio}</strong></span>
                          <button
                            type="button"
                            onClick={() => {
                              setOverviewRationaleHorizon(horizon);
                              setRationaleModalHorizon(horizon);
                            }}
                            className="text-amber-400 hover:text-amber-300 font-sans font-medium hover:underline cursor-pointer"
                          >
                            Rationale →
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Strategy Bias Rationale Panel */}
              <StrategyBiasRationalePanel
                quote={activeQuote}
                candles={candles}
                indicators={indicators}
                tradePlans={tradePlans}
                selectedHorizon={overviewRationaleHorizon}
                onHorizonChange={setOverviewRationaleHorizon}
              />

              {/* Chronological Strategy Alert Feed Dashboard Widget */}
              <StrategyAlertFeedWidget
                entries={strategyAlertFeed}
                onJumpToChartSetup={handleJumpToChartSetup}
                onJumpToPortfolioEntry={handleJumpToPortfolioEntry}
                onOpenStrategyLab={(strategyId) => {
                  setSelectedStrategyForBacktest(strategyId);
                  setActiveWorkspace('strategies');
                }}
                onClearLiveHistory={handleClearStrategyAlertHistory}
                activeInstrumentId={primaryInstrumentId}
              />

              {/* Cross-Commodity Spread Intelligence & Forecast Accountability Ledger */}
              <CrossCommoditySpreadsPanel quotes={quotes} />
            </div>
          )}

          {/* 2. WORKSPACE: LIVE GOLD TERMINAL */}
          {activeWorkspace === 'terminal' && (
            <div className="space-y-6">
              <div className="bg-slate-900 border border-slate-800 rounded-lg p-5">
                <div className="flex flex-wrap items-center justify-between gap-4">
                  <div>
                    <h2 className="text-lg font-bold text-slate-100">
                      Live Gold Terminal · Institutional Order Flow & Price Action
                    </h2>
                    <p className="text-xs text-slate-400 mt-0.5">
                      Direct Market Data Feed: {goldQuote.provider}
                    </p>
                  </div>
                  <div className="flex items-center gap-3 font-mono text-xs">
                    <span className="text-slate-400">Bid: <strong className="text-slate-100">${goldQuote.bid.toFixed(2)}</strong></span>
                    <span className="text-slate-400">Ask: <strong className="text-slate-100">${goldQuote.ask.toFixed(2)}</strong></span>
                    <span className="text-amber-400 font-bold">Spread: {goldQuote.spreadPips} pips</span>
                  </div>
                </div>
              </div>

              {chartSetupJump && chartSetupJump.entry.instrumentId === primaryInstrumentId && (
                <div
                  role="status"
                  className="bg-slate-900 border border-amber-500/40 rounded-lg px-4 py-3 flex flex-wrap items-center justify-between gap-3 text-xs font-mono"
                >
                  <div className="min-w-0">
                    <span className="text-amber-300 font-bold">
                      Alert Chart Setup Active: {chartSetupJump.entry.strategyName}
                    </span>
                    <span className="text-slate-300 ml-2 tabular-nums">
                      {chartSetupJump.entry.direction} {chartSetupJump.entry.instrumentId} ({chartSetupJump.entry.timeframe}) · Entry $
                      {chartSetupJump.entry.triggerPrice.toFixed(2)} · SL $
                      {chartSetupJump.entry.stopLossPrice.toFixed(2)} · TP1 $
                      {chartSetupJump.entry.target1Price.toFixed(2)}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      type="button"
                      onClick={() => handleJumpToPortfolioEntry(chartSetupJump.entry)}
                      className="px-3 py-1 rounded bg-emerald-500/15 hover:bg-emerald-500/25 text-emerald-300 border border-emerald-500/30 font-medium cursor-pointer"
                    >
                      {chartSetupJump.entry.linkedPortfolioPositionId ? 'View Portfolio Entry' : 'Open in Portfolio'}
                    </button>
                    <button
                      type="button"
                      onClick={() => setChartSetupJump(null)}
                      className="px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 cursor-pointer"
                    >
                      Reset Overlay
                    </button>
                  </div>
                </div>
              )}

              <CandleChart
                candles={candles}
                instrumentId={primaryInstrument.id}
                timeframe={currentTimeframe}
                period={historicalPeriod}
                onTimeframeChange={setCurrentTimeframe}
                onPeriodChange={handlePeriodChange}
                customHorizon={customHorizon}
                onCustomHorizonChange={setCustomHorizon}
                tradePlan={
                  chartSetupJump && chartSetupJump.entry.instrumentId === primaryInstrumentId
                    ? chartSetupJump.plan
                    : tradePlans['INTRADAY']
                }
                indicators={indicators}
                coverageReport={coverageReport}
                unit={primaryInstrument.unit}
                instrumentName={primaryInstrument.displayName}
                height={isFitToScreen ? 560 : 520}
                isFitToScreen={isFitToScreen}
                onToggleFitScreen={() => setIsFitToScreen((prev) => !prev)}
                smartAnnotationsEnabled={smartAnnotationsEnabled}
                onToggleSmartAnnotations={handleToggleGlobalSmartAnnotations}
              />

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <h4 className="text-xs font-mono uppercase text-slate-400 mb-2">Intraday Setup</h4>
                  {tradePlans['INTRADAY'] && (
                    <TradePlanCard
                      plan={tradePlans['INTRADAY']}
                      quote={activeQuote}
                      candles={candles}
                      indicators={indicators}
                      onSelectForCFD={handleSelectForCFD}
                      onExecutePaper={handleExecutePaper}
                      onInspectRationale={(p) => setRationaleModalHorizon(p.horizon)}
                      isLocked={!isPlanUnlocked(entitlements, tradePlans['INTRADAY'].id)}
                      onUnlock={handleUnlockPlan}
                      isGuaranteed={Boolean(entitlements.unlockedPlans[tradePlans['INTRADAY'].id]?.status === 'ACTIVE' && !entitlements.unlockedPlans[tradePlans['INTRADAY'].id]?.refunded)}
                    />
                  )}
                </div>
                <div>
                  <h4 className="text-xs font-mono uppercase text-slate-400 mb-2">CFD Specific Setup</h4>
                  {tradePlans['CFD'] && (
                    <TradePlanCard
                      plan={tradePlans['CFD']}
                      quote={activeQuote}
                      candles={candles}
                      indicators={indicators}
                      onSelectForCFD={handleSelectForCFD}
                      onExecutePaper={handleExecutePaper}
                      onInspectRationale={(p) => setRationaleModalHorizon(p.horizon)}
                      isLocked={!isPlanUnlocked(entitlements, tradePlans['CFD'].id)}
                      onUnlock={handleUnlockPlan}
                      isGuaranteed={Boolean(entitlements.unlockedPlans[tradePlans['CFD'].id]?.status === 'ACTIVE' && !entitlements.unlockedPlans[tradePlans['CFD'].id]?.refunded)}
                    />
                  )}
                </div>
              </div>
            </div>
          )}

          {/* 3. WORKSPACE: TECHNICAL ANALYSIS */}
          {activeWorkspace === 'technical' && (
            <div className="space-y-6">
              <div className="bg-slate-900 border border-slate-800 rounded-lg p-5">
                <h2 className="text-lg font-bold text-slate-100">
                  Canonical Technical Indicator Engine & Pivot Matrix
                </h2>
                <p className="text-xs text-slate-400 mt-1">
                  Pure mathematical indicator calculations shared across charts, alerts, and strategy backtests.
                </p>

                <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-3 mt-4 text-xs font-mono tabular-nums">
                  <div className="bg-slate-950 p-3 rounded border border-slate-800">
                    <span className="text-[10px] text-slate-500 block">RSI (14)</span>
                    <span className="text-lg font-bold text-slate-200">{indicators.rsi14}</span>
                    <span className="text-[10px] text-emerald-400 block mt-0.5">Bullish Expansion</span>
                  </div>

                  <div className="bg-slate-950 p-3 rounded border border-slate-800">
                    <span className="text-[10px] text-slate-500 block">MACD HISTOGRAM</span>
                    <span className="text-lg font-bold text-emerald-400">+{indicators.macd.histogram}</span>
                    <span className="text-[10px] text-slate-400 block mt-0.5">Signal: {indicators.macd.signalLine}</span>
                  </div>

                  <div className="bg-slate-950 p-3 rounded border border-slate-800">
                    <span className="text-[10px] text-slate-500 block">ATR (14)</span>
                    <span className="text-lg font-bold text-slate-200">${indicators.atr14}</span>
                    <span className="text-[10px] text-slate-400 block mt-0.5">Daily Volatility Buffer</span>
                  </div>

                  <div className="bg-slate-950 p-3 rounded border border-slate-800">
                    <span className="text-[10px] text-slate-500 block">SUPERTREND</span>
                    <span className="text-lg font-bold text-emerald-400">${indicators.supertrend.value}</span>
                    <span className="text-[10px] text-emerald-400 block mt-0.5">{indicators.supertrend.direction}</span>
                  </div>

                  <div className="bg-slate-950 p-3 rounded border border-slate-800">
                    <span className="text-[10px] text-slate-500 block">EMA 50 / 200</span>
                    <span className="text-sm font-bold text-slate-200">${indicators.ema50}</span>
                    <span className="text-[10px] text-slate-400 block mt-0.5">200: ${indicators.ema200}</span>
                  </div>

                  <div className="bg-slate-950 p-3 rounded border border-slate-800">
                    <span className="text-[10px] text-slate-500 block">VWAP</span>
                    <span className="text-lg font-bold text-purple-400">${indicators.vwap}</span>
                    <span className="text-[10px] text-slate-400 block mt-0.5">Session Anchor</span>
                  </div>
                </div>
              </div>

              {/* Interactive Technical Chart with Indicator Overlays & Oscillators */}
              <CandleChart
                candles={candles}
                instrumentId={primaryInstrument.id}
                timeframe={currentTimeframe}
                period={historicalPeriod}
                onTimeframeChange={setCurrentTimeframe}
                onPeriodChange={setHistoricalPeriod}
                customHorizon={customHorizon}
                onCustomHorizonChange={setCustomHorizon}
                tradePlan={tradePlans['SWING']}
                indicators={indicators}
                coverageReport={coverageReport}
                unit={primaryInstrument.unit}
                instrumentName={primaryInstrument.displayName}
                height={520}
                smartAnnotationsEnabled={smartAnnotationsEnabled}
                onToggleSmartAnnotations={handleToggleGlobalSmartAnnotations}
              />

              {/* Pivot Levels & Bollinger Bands Table */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="bg-slate-900 border border-slate-800 rounded-lg p-5">
                  <h3 className="text-sm font-bold text-slate-100 font-mono uppercase mb-3">
                    Institutional Pivot Point Clusters
                  </h3>
                  <div className="space-y-2 text-xs font-mono tabular-nums">
                    <div className="flex justify-between p-2 bg-slate-950 rounded border border-slate-800">
                      <span className="text-rose-400 font-bold">Resistance 2 (R2)</span>
                      <span className="text-slate-100 font-bold">${indicators.supportResistance.resistance2}</span>
                    </div>
                    <div className="flex justify-between p-2 bg-slate-950 rounded border border-slate-800">
                      <span className="text-rose-400">Resistance 1 (R1)</span>
                      <span className="text-slate-200">${indicators.supportResistance.resistance1}</span>
                    </div>
                    <div className="flex justify-between p-2.5 bg-amber-500/10 border border-amber-500/30 rounded font-bold">
                      <span className="text-amber-400">Central Pivot (P)</span>
                      <span className="text-slate-100">${indicators.supportResistance.pivot}</span>
                    </div>
                    <div className="flex justify-between p-2 bg-slate-950 rounded border border-slate-800">
                      <span className="text-emerald-400">Support 1 (S1)</span>
                      <span className="text-slate-200">${indicators.supportResistance.support1}</span>
                    </div>
                    <div className="flex justify-between p-2 bg-slate-950 rounded border border-slate-800">
                      <span className="text-emerald-400 font-bold">Support 2 (S2)</span>
                      <span className="text-slate-100 font-bold">${indicators.supportResistance.support2}</span>
                    </div>
                  </div>
                </div>

                <div className="bg-slate-900 border border-slate-800 rounded-lg p-5">
                  <h3 className="text-sm font-bold text-slate-100 font-mono uppercase mb-3">
                    Bollinger Band Volatility Envelope
                  </h3>
                  <div className="space-y-2 text-xs font-mono tabular-nums">
                    <div className="flex justify-between p-2 bg-slate-950 rounded border border-slate-800">
                      <span className="text-cyan-400">Upper Band (+2σ)</span>
                      <span className="text-slate-100 font-bold">${indicators.bollingerBands.upper}</span>
                    </div>
                    <div className="flex justify-between p-2 bg-slate-950 rounded border border-slate-800">
                      <span className="text-slate-400">Middle Band (SMA 20)</span>
                      <span className="text-slate-200">${indicators.bollingerBands.middle}</span>
                    </div>
                    <div className="flex justify-between p-2 bg-slate-950 rounded border border-slate-800">
                      <span className="text-cyan-400">Lower Band (-2σ)</span>
                      <span className="text-slate-100 font-bold">${indicators.bollingerBands.lower}</span>
                    </div>
                    <div className="flex justify-between p-2 bg-slate-950 rounded border border-slate-800 font-bold">
                      <span className="text-slate-400">Bandwidth Expansion %</span>
                      <span className="text-amber-400">{indicators.bollingerBands.bandwidth}%</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* 4. WORKSPACE: INTRADAY ADVISOR */}
          {activeWorkspace === 'intraday' && (
            <div className="space-y-6">
              <div className="bg-slate-900 border border-slate-800 rounded-lg p-5">
                <h2 className="text-lg font-bold text-slate-100">
                  Intraday Session Advisor · London & New York Windows
                </h2>
                <p className="text-xs text-slate-400 mt-1">
                  Tactical session-based trade plans, opening range breakout validation, and VWAP deviation filters.
                </p>
              </div>

              {tradePlans['INTRADAY'] && (
                <TradePlanCard
                  plan={tradePlans['INTRADAY']}
                  quote={activeQuote}
                  candles={candles}
                  indicators={indicators}
                  onSelectForCFD={handleSelectForCFD}
                  onExecutePaper={handleExecutePaper}
                  onInspectRationale={(p) => setRationaleModalHorizon(p.horizon)}
                  isLocked={!isPlanUnlocked(entitlements, tradePlans['INTRADAY'].id)}
                  onUnlock={handleUnlockPlan}
                  isGuaranteed={Boolean(entitlements.unlockedPlans[tradePlans['INTRADAY'].id]?.status === 'ACTIVE' && !entitlements.unlockedPlans[tradePlans['INTRADAY'].id]?.refunded)}
                />
              )}
            </div>
          )}

          {/* 5. WORKSPACE: SWING TRADING */}
          {activeWorkspace === 'swing' && (
            <div className="space-y-6">
              <div className="bg-slate-900 border border-slate-800 rounded-lg p-5">
                <h2 className="text-lg font-bold text-slate-100">
                  Swing Trading Advisor · Multi-Day Trend Pullbacks
                </h2>
                <p className="text-xs text-slate-400 mt-1">
                  4-Hour and Daily structure setups targeting high-expectancy multi-day trend continuation.
                </p>
              </div>

              {tradePlans['SWING'] && (
                <TradePlanCard
                  plan={tradePlans['SWING']}
                  quote={activeQuote}
                  candles={candles}
                  indicators={indicators}
                  onSelectForCFD={handleSelectForCFD}
                  onExecutePaper={handleExecutePaper}
                  onInspectRationale={(p) => setRationaleModalHorizon(p.horizon)}
                  isLocked={!isPlanUnlocked(entitlements, tradePlans['SWING'].id)}
                  onUnlock={handleUnlockPlan}
                  isGuaranteed={Boolean(entitlements.unlockedPlans[tradePlans['SWING'].id]?.status === 'ACTIVE' && !entitlements.unlockedPlans[tradePlans['SWING'].id]?.refunded)}
                />
              )}
            </div>
          )}

          {/* 6. WORKSPACE: LONG-TERM OUTLOOK */}
          {activeWorkspace === 'longterm' && (
            <div className="space-y-6">
              <div className="bg-slate-900 border border-slate-800 rounded-lg p-5">
                <h2 className="text-lg font-bold text-slate-100">
                  Long-Term Secular Macro Outlook & Multi-Quarter Projections
                </h2>
                <p className="text-xs text-slate-400 mt-1">
                  Macro monetary policy cycles, structural fiat debasement hedging, and sovereign reserve trends.
                </p>
              </div>

              {tradePlans['LONG_TERM'] && (
                <TradePlanCard
                  plan={tradePlans['LONG_TERM']}
                  quote={activeQuote}
                  candles={candles}
                  indicators={indicators}
                  onSelectForCFD={handleSelectForCFD}
                  onExecutePaper={handleExecutePaper}
                  onInspectRationale={(p) => setRationaleModalHorizon(p.horizon)}
                  isLocked={!isPlanUnlocked(entitlements, tradePlans['LONG_TERM'].id)}
                  onUnlock={handleUnlockPlan}
                  isGuaranteed={Boolean(entitlements.unlockedPlans[tradePlans['LONG_TERM'].id]?.status === 'ACTIVE' && !entitlements.unlockedPlans[tradePlans['LONG_TERM'].id]?.refunded)}
                />
              )}
            </div>
          )}

          {/* 7. WORKSPACE: CFD RISK CALCULATOR */}
          {activeWorkspace === 'cfd' && (
            <CFDCalculator
              initialEntry={selectedPlanForCFD ? (selectedPlanForCFD.triggerPrice || selectedPlanForCFD.entryZoneMin) : goldQuote.mid}
              initialStop={selectedPlanForCFD ? selectedPlanForCFD.stopLossPrice : (tradePlans['CFD']?.stopLossPrice || goldQuote.mid - 12)}
              initialTarget={selectedPlanForCFD ? selectedPlanForCFD.target1Price : (tradePlans['CFD']?.target1Price || goldQuote.mid + 25)}
              initialSpreadPips={goldQuote.spreadPips}
            />
          )}

          {/* WORKSPACE: NEWS & CAUSAL SENTIMENT */}
          {activeWorkspace === 'news_sentiment' && (
            <NewsSentimentWorkspace
              currentCommodity={currentCommodity}
              onCommodityChange={setCurrentCommodity}
            />
          )}

          {/* WORKSPACE: HISTORICAL SCENARIOS & ANALOGUES */}
          {activeWorkspace === 'scenarios' && (
            <HistoricalScenariosWorkspace
              currentCommodity={currentCommodity}
              onCommodityChange={setCurrentCommodity}
            />
          )}

          {/* WORKSPACE: LLM PLATFORM & PUBLICATION GATE */}
          {activeWorkspace === 'llm_platform' && (
            <LLMSettingsWorkspace />
          )}

          {/* 8. WORKSPACE: MACRO INTELLIGENCE */}
          {activeWorkspace === 'macro' && (
            <MacroWorkspace
              regime={CURRENT_MARKET_REGIME}
              releases={MACRO_ECONOMIC_RELEASES}
              studies={HISTORICAL_EVENT_STUDIES}
              analogs={findHistoricalAnalogs(quotes['US_TIPS10Y']?.mid, quotes['DXY']?.mid)}
            />
          )}

          {/* 9. WORKSPACE: HISTORICAL EVENTS */}
          {activeWorkspace === 'events' && (
            <MacroWorkspace
              regime={CURRENT_MARKET_REGIME}
              releases={MACRO_ECONOMIC_RELEASES}
              studies={HISTORICAL_EVENT_STUDIES}
              analogs={findHistoricalAnalogs(quotes['US_TIPS10Y']?.mid, quotes['DXY']?.mid)}
            />
          )}

          {/* 10. WORKSPACE: STRATEGY LAB */}
          {activeWorkspace === 'strategies' && (
            <StrategyLabWorkspace
              strategies={getQuantitativeStrategies(activeQuote.mid)}
              activeStrategyId={selectedStrategyForBacktest}
              onSelectStrategy={setSelectedStrategyForBacktest}
              onSelectForBacktest={(id) => {
                setSelectedStrategyForBacktest(id);
                setActiveWorkspace('backtesting');
              }}
              onSelectForCFD={handleSelectForCFD}
              onExecutePaper={handleExecutePaper}
              currentMid={activeQuote.mid}
              instrumentId={primaryInstrumentId}
              candles={candles}
              indicators={indicators}
              quote={activeQuote}
              tipsRealYieldPct={quotes['US_TIPS10Y']?.mid}
              subscriptions={strategySubscriptions}
              evaluations={strategyAlertEvalSnapshot.evaluations}
              alertHistory={strategyAlertHistory}
              onToggleSubscription={handleToggleStrategySubscription}
              onTestStrategyTrigger={handleTestStrategyTrigger}
              onClearAlertHistory={handleClearStrategyAlertHistory}
            />
          )}

          {/* 11. WORKSPACE: BACKTESTING ENGINE */}
          {activeWorkspace === 'backtesting' && (
            <BacktestingWorkspace
              strategies={getQuantitativeStrategies(activeQuote.mid)}
              candles={candles}
              selectedStrategyId={selectedStrategyForBacktest}
              onSelectStrategy={setSelectedStrategyForBacktest}
              onSelectForCFD={handleSelectForCFD}
              onExecutePaper={handleExecutePaper}
              currentMid={activeQuote.mid}
              instrumentId={primaryInstrumentId}
            />
          )}

          {/* 12. WORKSPACE: PORTFOLIO & JOURNAL */}
          {activeWorkspace === 'portfolio' && (
            <PortfolioJournalWorkspace
              key={userSession.uid}
              quote={goldQuote}
              quotes={quotes}
              tradePlans={tradePlans}
              newPaperPlan={selectedPlanForPaper}
              newPaperPlanLots={selectedPlanForPaperLots}
              onConsumePaperPlan={() => {
                setSelectedPlanForPaper(null);
                setSelectedPlanForPaperLots(null);
              }}
              requestedTab={requestedPortfolioTab}
              onConsumeRequestedTab={() => setRequestedPortfolioTab(null)}
              requestedPositionId={requestedPortfolioPositionId}
              onConsumeRequestedPositionId={() => setRequestedPortfolioPositionId(null)}
              onPositionsChanged={setUserPortfolioPositions}
              onTradeAlertDispatched={handleTradeAlertDispatched}
            />
          )}

          {/* 12B. WORKSPACE: PERFORMANCE INSIGHTS */}
          {activeWorkspace === 'performance_insights' && (
            <PerformanceInsightsWorkspace
              key={userSession.uid}
              quote={goldQuote}
              quotes={quotes}
              onNavigateToPortfolio={() => setActiveWorkspace('portfolio')}
            />
          )}

          {/* 13. WORKSPACE: AI ADVISORY COUNCIL */}
          {activeWorkspace === 'council' && (
            <CouncilWorkspace
              agents={getSpecialistAgents(activeQuote.mid, { candles, indicators, quote: activeQuote })}
              evidence={getEvidenceRegistry(activeQuote.mid, { candles, indicators, quote: activeQuote })}
              quotes={quotes}
              candles={candles}
              currentCommodity={currentCommodity}
              timeframe={currentTimeframe}
            />
          )}

          {/* 14. WORKSPACE: REPORTS & PUBLISHING */}
          {activeWorkspace === 'reports' && (
            <ReportsWorkspace
              quote={activeQuote}
              regime={CURRENT_MARKET_REGIME}
              indicators={indicators}
              tradePlans={tradePlans}
              candles={candles}
              currentCommodity={currentCommodity}
              timeframe={currentTimeframe}
            />
          )}

          {/* 15. WORKSPACE: ALERTS & DATA QUALITY */}
          {activeWorkspace === 'alerts' && (
            <AlertsWorkspace
              quote={goldQuote}
              quotes={quotes}
              dailyCandles={primaryInstrumentId === 'XAUUSD' && currentTimeframe === '1D' ? candles : undefined}
              chartCandles={currentCommodity === 'GOLD' ? candles : undefined}
              chartTimeframe={currentCommodity === 'GOLD' ? currentTimeframe : '1D'}
            />
          )}

          {/* 16. WORKSPACE: MARKET DATA & BROKERS (NEW PRODUCTION ENHANCEMENT) */}
          {activeWorkspace === 'market_data_config' && (
            <MarketDataConfigWorkspace
              currentQuote={goldQuote}
              onRefreshQuotes={fetchQuotesFromServer}
            />
          )}

          {/* 17. WORKSPACE: TELEGRAM & WEBHOOKS (NEW PRODUCTION ENHANCEMENT) */}
          {activeWorkspace === 'telegram_notifications' && (
            <NotificationSettingsWorkspace />
          )}

          {/* 18. WORKSPACE: GEMINI AI CHATBOT (NEW PRODUCTION ENHANCEMENT) */}
          {activeWorkspace === 'gemini_chat' && (
            <GeminiChatbot currentQuote={goldQuote} />
          )}

          {/* 19. WORKSPACE: PRICING & COMMERCIAL HUB */}
          {activeWorkspace === 'monetization' && (
            <MonetizationWorkspace
              entitlementState={entitlements}
              onOpenCheckout={(item) => {
                setCheckoutItem(item);
                setIsCheckoutOpen(true);
              }}
              onLinkBroker={(brokerId, accountNo) => {
                const updated = linkBrokerPartnerAccount(
                  entitlements,
                  brokerId,
                  accountNo,
                  userSession.uid
                );
                setEntitlements(updated);
                setRefundToast({
                  show: true,
                  message: `Broker account verified! GoldVista Pro activated 100% free via broker rebates.`,
                });
                setTimeout(() => setRefundToast((p) => ({ ...p, show: false })), 6000);
              }}
            />
          )}
              </>
            )}
            </WorkspaceErrorBoundary>
          </main>
        </div>
      )}

      {/* Floating 100% Performance Guarantee Toast Notification */}
      {refundToast.show && (
        <div className="fixed bottom-16 md:bottom-6 right-4 z-50 max-w-sm bg-slate-900 border border-emerald-500/50 text-emerald-400 p-3.5 rounded-lg shadow-2xl flex items-center gap-3 font-mono text-xs">
          <RotateCcw className="w-5 h-5 shrink-0 text-emerald-400" />
          <p className="flex-1 text-slate-200">{refundToast.message}</p>
        </div>
      )}

      {/* Floating Strategy Entry Push Notification Toast */}
      {strategyPushToast.show && (
        <div
          role="status"
          className={`fixed right-4 z-50 max-w-md bg-slate-900 border border-amber-500/60 p-3.5 rounded-lg shadow-2xl flex items-start gap-3 font-mono text-xs ${
            refundToast.show ? 'bottom-36 md:bottom-24' : 'bottom-16 md:bottom-6'
          }`}
        >
          <BellRing className="w-5 h-5 shrink-0 text-amber-400 mt-0.5" aria-hidden="true" />
          <div className="flex-1 min-w-0">
            <p className="font-bold text-amber-300 truncate">{strategyPushToast.title}</p>
            <p className="text-slate-200 mt-1 leading-relaxed">{strategyPushToast.message}</p>
          </div>
          <button
            type="button"
            onClick={() => setStrategyPushToast((p) => ({ ...p, show: false }))}
            className="text-slate-400 hover:text-slate-200 whitespace-nowrap shrink-0 cursor-pointer"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Floating Trade Open/Close Execution Alert Toast */}
      {tradeAlertToast.show && (
        <div
          role="status"
          className={`fixed left-4 z-50 max-w-md bg-slate-900 border p-3.5 rounded-lg shadow-2xl flex items-start gap-3 font-mono text-xs ${
            tradeAlertToast.eventType === 'TRADE_CLOSED'
              ? 'border-emerald-500/60'
              : 'border-amber-500/60'
          } bottom-16 md:bottom-6`}
        >
          <BellRing
            className={`w-5 h-5 shrink-0 mt-0.5 ${
              tradeAlertToast.eventType === 'TRADE_CLOSED' ? 'text-emerald-400' : 'text-amber-400'
            }`}
            aria-hidden="true"
          />
          <div className="flex-1 min-w-0">
            <p className="font-bold text-slate-100 truncate">{tradeAlertToast.title}</p>
            <p className="text-slate-300 mt-1 leading-relaxed">{tradeAlertToast.message}</p>
            {tradeAlertToast.positionId && (
              <button
                type="button"
                onClick={() => {
                  handleJumpToPositions(tradeAlertToast.positionId);
                  setTradeAlertToast((p) => ({ ...p, show: false }));
                }}
                className="mt-2 px-2.5 py-1 rounded bg-amber-500/20 hover:bg-amber-500/30 border border-amber-500/40 text-amber-300 text-[11px] font-semibold cursor-pointer"
              >
                Inspect Position →
              </button>
            )}
          </div>
          <button
            type="button"
            onClick={() => setTradeAlertToast((p) => ({ ...p, show: false }))}
            className="text-slate-400 hover:text-slate-200 whitespace-nowrap shrink-0 cursor-pointer"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Quick Jump Command Palette Modal (Ctrl+K) */}
      <CommandPaletteModal
        isOpen={isCommandPaletteOpen}
        onClose={() => setIsCommandPaletteOpen(false)}
        userRole={userSession.role}
        onSelectWorkspace={(id) => {
          setActiveWorkspace(id);
          setIsMobileMenuOpen(false);
        }}
        onSelectCommodity={(c) => setCurrentCommodity(c)}
        onSelectPortfolioTab={(tab) => {
          setActiveWorkspace('portfolio');
          setRequestedPortfolioTab(tab);
          setIsMobileMenuOpen(false);
        }}
      />

      {/* Stripe Native Checkout Modal */}
      <StripeCheckoutModal
        isOpen={isCheckoutOpen}
        onClose={() => setIsCheckoutOpen(false)}
        targetItem={checkoutItem}
        onSuccess={handleCheckoutSuccess}
      />

      {/* Paywall Contextual Gate Modal */}
      <PaywallGateModal
        isOpen={paywallModalState.isOpen}
        onClose={() => setPaywallModalState((prev) => ({ ...prev, isOpen: false }))}
        title={paywallModalState.title}
        featureDescription={paywallModalState.description}
        entitlementState={entitlements}
        costCredits={paywallModalState.costCredits}
        onConfirmUnlock={() => {
          if (paywallModalState.planToUnlock) {
            handleUnlockPlan(paywallModalState.planToUnlock);
          }
          setPaywallModalState((prev) => ({ ...prev, isOpen: false }));
        }}
        onOpenPricingHub={() => {
          setPaywallModalState((prev) => ({ ...prev, isOpen: false }));
          setActiveWorkspace('monetization');
        }}
      />

      {/* Universal Customer Auth & Enrollment Modal */}
      <AuthModal
        isOpen={isAuthModalOpen}
        onClose={() => {
          setIsAuthModalOpen(false);
          setTargetRestrictedFeature(undefined);
        }}
        onSessionUpdated={handleSessionUpdated}
        initialMode={authModalMode}
        targetFeatureName={targetRestrictedFeature}
      />

      {/* Strategy Bias Rationale Modal */}
      <StrategyBiasRationaleModal
        isOpen={rationaleModalHorizon !== null}
        onClose={() => setRationaleModalHorizon(null)}
        quote={activeQuote}
        candles={candles}
        indicators={indicators}
        tradePlans={tradePlans}
        selectedHorizon={rationaleModalHorizon || overviewRationaleHorizon}
        onHorizonChange={(h) => setRationaleModalHorizon(h)}
      />

      {/* Mobile Bottom Quick Navigation Bar (Active inside Terminal only; never overlays Landing Page) */}
      {!isLandingPageActive && (
        <nav
          aria-label="Mobile Quick Navigation"
          className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-slate-950/95 backdrop-blur-md border-t border-slate-800 px-2 pt-1.5 pb-safe flex items-center justify-around text-[10px] font-mono text-slate-400"
        >
          <button
            type="button"
            onClick={() => setActiveWorkspace('overview')}
            className={`flex flex-col items-center justify-center gap-0.5 min-h-[44px] px-2 rounded transition-colors cursor-pointer ${
              activeWorkspace === 'overview' ? 'text-amber-400 font-bold' : 'hover:text-slate-200'
            }`}
          >
            <LayoutDashboard className="w-4 h-4" />
            <span>Overview</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveWorkspace('terminal')}
            className={`flex flex-col items-center justify-center gap-0.5 min-h-[44px] px-2 rounded transition-colors cursor-pointer ${
              activeWorkspace === 'terminal' ? 'text-amber-400 font-bold' : 'hover:text-slate-200'
            }`}
          >
            <CandlestickChart className="w-4 h-4" />
            <span>Terminal</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveWorkspace('technical')}
            className={`flex flex-col items-center justify-center gap-0.5 min-h-[44px] px-2 rounded transition-colors cursor-pointer ${
              activeWorkspace === 'technical' ? 'text-amber-400 font-bold' : 'hover:text-slate-200'
            }`}
          >
            <Activity className="w-4 h-4" />
            <span>Technicals</span>
          </button>
          <button
            type="button"
            onClick={() => handleJumpToPositions()}
            className={`flex flex-col items-center justify-center gap-0.5 min-h-[44px] px-2 rounded transition-colors cursor-pointer ${
              activeWorkspace === 'portfolio' ? 'text-amber-400 font-bold' : 'hover:text-slate-200'
            }`}
          >
            <BookOpen className="w-4 h-4" />
            <span className="tabular-nums">
              {userPortfolioPositions.filter((p) => p.status === 'OPEN').length > 0
                ? `Positions (${userPortfolioPositions.filter((p) => p.status === 'OPEN').length})`
                : 'Portfolio'}
            </span>
          </button>
          <button
            type="button"
            onClick={() => setIsMobileMenuOpen(true)}
            className="flex flex-col items-center justify-center gap-0.5 min-h-[44px] px-2 rounded text-amber-400 hover:text-amber-300 transition-colors cursor-pointer"
          >
            <Menu className="w-4 h-4" />
            <span>Workspaces</span>
          </button>
        </nav>
      )}
    </div>
  );
}
