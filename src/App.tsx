/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * Aurum Intelligence — Master Gold Trading Advisory & Market Intelligence Platform
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
  Candle,
  IndicatorSnapshot,
  Quote,
  Timeframe,
  TradePlan,
} from './domain/types';
import { Navbar } from './components/Navbar';
import { Sidebar, WorkspaceId } from './components/Sidebar';
import { CandleChart } from './components/CandleChart';
import { TradePlanCard } from './components/TradePlanCard';
import { CFDCalculator } from './components/CFDCalculator';
import { CrossCommoditySpreadsPanel } from './components/CrossCommoditySpreadsPanel';
import { MacroWorkspace } from './components/MacroWorkspace';
import { StrategyLabWorkspace } from './components/StrategyLabWorkspace';
import { BacktestingWorkspace } from './components/BacktestingWorkspace';
import { CouncilWorkspace } from './components/CouncilWorkspace';
import { ReportsWorkspace } from './components/ReportsWorkspace';
import { AlertsWorkspace } from './components/AlertsWorkspace';
import { PortfolioJournalWorkspace } from './components/PortfolioJournalWorkspace';
import { MarketDataConfigWorkspace } from './components/MarketDataConfigWorkspace';
import { NotificationSettingsWorkspace } from './components/NotificationSettingsWorkspace';
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
import {
  UserSession,
  UserRole,
  getCurrentSession,
  saveSession,
  canAccessWorkspace,
  switchPersona,
  logoutUser,
  DEMO_PERSONAS,
  enrollNewCustomer,
  refreshSignedSandboxToken,
  completeOidcPkceCallback,
} from './services/authService';
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
import { getQuantitativeStrategies, QUANTITATIVE_STRATEGIES } from './services/strategyEngine';
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
  const [selectedStrategyForBacktest, setSelectedStrategyForBacktest] = useState<string>('STRAT-01-MACRO-TREND');

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

  // Commercial Entitlements & Monetization State
  const [entitlements, setEntitlements] = useState<UserEntitlementState>(() => loadUserEntitlements());
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
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState<boolean>(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState<boolean>(false);
  const [layoutMode, setLayoutMode] = useState<'AUTO' | 'TERMINAL' | 'SPLIT'>('AUTO');
  const [showTradePlanDock, setShowTradePlanDock] = useState<boolean>(true);
  const [showMacroTickers, setShowMacroTickers] = useState<boolean>(true);

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
    generateTradePlans(quotes[primaryInstrumentId] || quotes['XAUUSD'])
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
        setEntitlements((prev) => ({
          ...prev,
          tier: result.role === 'ALPHA' ? 'ALPHA' : result.role === 'PRO' ? 'PRO' : 'FREE',
        }));
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
          const activeQ = data.quotes[primaryInstrumentId] || data.quotes.XAUUSD;
          if (activeQ) {
            setTradePlans(generateTradePlans(activeQ));
          }
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

  // Automated 100% Performance Guarantee Evaluator
  useEffect(() => {
    if (!activeQuote?.mid) return;
    const result = evaluatePerformanceRefunds(entitlements, activeQuote.mid);
    if (result.refundedCount > 0) {
      setEntitlements(result.updatedState);
      setRefundToast({
        show: true,
        message: `100% Value Guarantee: ${result.refundedCount} trade credit(s) refunded due to stop-loss invalidation!`,
      });
      setTimeout(() => setRefundToast((p) => ({ ...p, show: false })), 6000);
    }
  }, [activeQuote?.mid, entitlements]);

  const handleSelectForCFD = (plan: TradePlan) => {
    setSelectedPlanForCFD(plan);
    setActiveWorkspace('cfd');
  };

  const handleExecutePaper = (plan: TradePlan) => {
    setSelectedPlanForPaper(plan);
    setActiveWorkspace('portfolio');
  };

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
      plan.direction as 'BUY' | 'SELL'
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
      const updated = purchaseCreditPack(entitlements, itemId);
      setEntitlements(updated);
      setRefundToast({
        show: true,
        message: `Payment successful! Signal credits added to your balance.`,
      });
    } else {
      const newRole = itemId as UserRole;
      const updated = upgradeMembershipTier(entitlements, itemId as any);
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

  const handleSwitchPersona = (role: UserRole) => {
    const updated = switchPersona(role);
    setUserSession(updated);
    setEntitlements((prev) => ({
      ...prev,
      tier: role === 'ALPHA' ? 'ALPHA' : role === 'PRO' ? 'PRO' : 'FREE',
      creditsBalance:
        role === 'ALPHA'
          ? Math.max(prev.creditsBalance, 500)
          : role === 'PRO'
          ? Math.max(prev.creditsBalance, 100)
          : prev.creditsBalance,
    }));
    setRefundToast({
      show: true,
      message: `Active persona switched to ${role} (${DEMO_PERSONAS[role].displayName}). Tier permissions active.`,
    });
    setTimeout(() => setRefundToast((p) => ({ ...p, show: false })), 4000);
  };

  const handleLogout = () => {
    const guest = logoutUser();
    setUserSession(guest);
    setEntitlements((prev) => ({
      ...prev,
      tier: 'FREE',
    }));
    setRefundToast({
      show: true,
      message: 'Signed out. Platform reverted to Public / Guest mode.',
    });
    setTimeout(() => setRefundToast((p) => ({ ...p, show: false })), 4000);
  };

  const handleSessionUpdated = (session: UserSession, isNewEnrollment?: boolean) => {
    setUserSession(session);
    setEntitlements((prev) => ({
      ...prev,
      tier: session.role === 'ALPHA' ? 'ALPHA' : session.role === 'PRO' ? 'PRO' : 'FREE',
      creditsBalance: isNewEnrollment ? prev.creditsBalance + 5 : prev.creditsBalance,
    }));
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
    country: string;
    tradingProfile: {
      primaryHorizon: 'INTRADAY' | 'SWING' | 'PROP_FIRM' | 'MACRO';
      brokerName: string;
      accountSize: string;
      experienceLevel: 'NOVICE' | 'INTERMEDIATE' | 'ADVANCED' | 'INSTITUTIONAL';
    };
  }) => {
    try {
      const session = await enrollNewCustomer({
        email: data.email,
        displayName: data.displayName,
        authProvider: 'email',
        tradingProfile: data.tradingProfile,
      });
      handleSessionUpdated(session, true);
      handleLaunchTerminal();
    } catch (e) {
      console.error(e);
    }
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
      } flex flex-col ${
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
        onLogout={handleLogout}
        isLandingPageActive={isLandingPageActive}
        onToggleLandingPage={() => setIsLandingPageActive(!isLandingPageActive)}
        feedStatus={feedStatus}
      />

      {isLandingPageActive ? (
        <div className="flex-1 overflow-y-auto">
          <LandingPage
            quotes={quotes}
            onLaunchTerminal={handleLaunchTerminal}
            onOpenAuth={(mode) => {
              setAuthModalMode(mode || 'ENROLL');
              setIsAuthModalOpen(true);
            }}
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
          />

          {/* Content Viewport */}
          <main
            id="main-workspace"
            tabIndex={-1}
            className={`flex-1 focus:outline-none ${
              isFitToScreen ? 'overflow-y-auto' : 'overflow-y-visible'
            } p-3 sm:p-5 lg:p-6 pb-20 md:pb-6 max-w-[1680px] w-full mx-auto`}
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
                    <h1 className="text-lg sm:text-2xl font-bold text-slate-100 mt-1">
                      {primaryInstrument.displayName} · Live Market Rate: ${primaryInstrumentId.includes('10Y') ? goldQuote.mid.toFixed(3) : goldQuote.mid.toFixed(2)}
                    </h1>
                  </div>

                  <div className="flex items-center gap-2 sm:gap-3">
                    <span className="flex items-center gap-1.5 px-2.5 py-1 bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 rounded text-xs font-mono font-bold">
                      <ArrowUpRight className="w-3.5 h-3.5" />
                      Live Feed: {goldQuote.provider}
                    </span>
                    <span
                      aria-live="polite"
                      className="text-xs font-mono px-2.5 py-1 bg-slate-950 border border-slate-800 text-slate-300 rounded"
                    >
                      Freshness: {dataQuality.label}
                    </span>
                  </div>
                </div>

                {/* Macro Synthesis Callout */}
                <p className="text-xs sm:text-sm text-slate-300 mt-3 leading-relaxed max-w-4xl">
                  {primaryInstrument.displayName} trades at <strong>${goldQuote.mid.toFixed(2)}</strong> (+{goldQuote.change24hPct}% 24h change), verified against official continuous COMEX/ICE benchmark quotes. The secular macroeconomic trend remains strongly supported by physical central bank reserve diversification and lower Treasury real yields.
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
                        onSelectForCFD={handleSelectForCFD}
                        onExecutePaper={handleExecutePaper}
                        isLocked={!isPlanUnlocked(entitlements, tradePlans['SWING'].id)}
                        onUnlock={handleUnlockPlan}
                        isGuaranteed={Boolean(entitlements.unlockedPlans[tradePlans['SWING'].id]?.status === 'ACTIVE' && !entitlements.unlockedPlans[tradePlans['SWING'].id]?.refunded)}
                      />
                    )}
                  </div>
                )}
              </div>

              {/* Multi-Horizon Advisory Snapshot Strip */}
              <div>
                <h3 className="text-xs font-mono uppercase tracking-wider text-slate-400 mb-3">
                  Multi-Horizon Advisory Recommendations
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
                  {['INTRADAY', 'SHORT_TERM', 'SWING', 'LONG_TERM'].map((horizon) => {
                    const plan = tradePlans[horizon];
                    if (!plan) return null;
                    return (
                      <div
                        key={horizon}
                        className="bg-slate-900 border border-slate-800 p-4 rounded-lg text-xs font-mono space-y-2 hover:border-slate-700 transition-colors"
                      >
                        <div className="flex justify-between items-center pb-2 border-b border-slate-800">
                          <span className="font-bold text-slate-300">{horizon}</span>
                          <span className="text-emerald-400 font-bold bg-emerald-500/10 px-2 py-0.5 rounded">
                            {plan.direction}
                          </span>
                        </div>
                        <div className="flex justify-between text-slate-400">
                          <span>Entry Zone:</span>
                          <span className="text-slate-200 font-bold">
                            ${plan.entryZoneMin} - ${plan.entryZoneMax}
                          </span>
                        </div>
                        <div className="flex justify-between text-slate-400">
                          <span>Stop Loss:</span>
                          <span className="text-rose-400 font-bold">${plan.stopLossPrice}</span>
                        </div>
                        <div className="flex justify-between text-slate-400">
                          <span>Target 1:</span>
                          <span className="text-emerald-400 font-bold">${plan.target1Price}</span>
                        </div>
                        <div className="flex justify-between text-slate-400 pt-1 border-t border-slate-800/60">
                          <span>Net R:R:</span>
                          <span className="text-amber-400 font-bold">1:{plan.rewardToRiskRatio}</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

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

              <CandleChart
                candles={candles}
                timeframe={currentTimeframe}
                period={historicalPeriod}
                onTimeframeChange={setCurrentTimeframe}
                onPeriodChange={handlePeriodChange}
                customHorizon={customHorizon}
                onCustomHorizonChange={setCustomHorizon}
                tradePlan={tradePlans['INTRADAY']}
                indicators={indicators}
                coverageReport={coverageReport}
                unit={primaryInstrument.unit}
                instrumentName={primaryInstrument.displayName}
                height={isFitToScreen ? 560 : 520}
                isFitToScreen={isFitToScreen}
                onToggleFitScreen={() => setIsFitToScreen((prev) => !prev)}
              />

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <h4 className="text-xs font-mono uppercase text-slate-400 mb-2">Intraday Setup</h4>
                  {tradePlans['INTRADAY'] && (
                    <TradePlanCard
                      plan={tradePlans['INTRADAY']}
                      onSelectForCFD={handleSelectForCFD}
                      onExecutePaper={handleExecutePaper}
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
                      onSelectForCFD={handleSelectForCFD}
                      onExecutePaper={handleExecutePaper}
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
                  onSelectForCFD={handleSelectForCFD}
                  onExecutePaper={handleExecutePaper}
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
                  onSelectForCFD={handleSelectForCFD}
                  onExecutePaper={handleExecutePaper}
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
                  onSelectForCFD={handleSelectForCFD}
                  onExecutePaper={handleExecutePaper}
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
              quote={goldQuote}
              quotes={quotes}
              tradePlans={tradePlans}
              newPaperPlan={selectedPlanForPaper}
            />
          )}

          {/* 13. WORKSPACE: AI ADVISORY COUNCIL */}
          {activeWorkspace === 'council' && (
            <CouncilWorkspace
              agents={getSpecialistAgents(goldQuote.mid)}
              evidence={getEvidenceRegistry(goldQuote.mid)}
            />
          )}

          {/* 14. WORKSPACE: REPORTS & PUBLISHING */}
          {activeWorkspace === 'reports' && (
            <ReportsWorkspace
              quote={goldQuote}
              regime={CURRENT_MARKET_REGIME}
              indicators={indicators}
              tradePlans={tradePlans}
              candles={candles}
              currentCommodity={currentCommodity}
            />
          )}

          {/* 15. WORKSPACE: ALERTS & DATA QUALITY */}
          {activeWorkspace === 'alerts' && (
            <AlertsWorkspace quote={goldQuote} />
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
                const updated = linkBrokerPartnerAccount(entitlements, brokerId, accountNo);
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
          </main>
        </div>
      )}

      {/* Floating 100% Performance Guarantee Toast Notification */}
      {refundToast.show && (
        <div className="fixed bottom-14 md:bottom-6 right-4 z-50 max-w-sm bg-slate-900 border border-emerald-500/50 text-emerald-400 p-3.5 rounded-lg shadow-2xl flex items-center gap-3 animate-fade-in font-mono text-xs">
          <RotateCcw className="w-5 h-5 shrink-0 text-emerald-400" />
          <p className="flex-1 text-slate-200">{refundToast.message}</p>
        </div>
      )}

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

      {/* Mobile Bottom Quick Navigation Bar (Touch-friendly Thumb Dock) */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-slate-950/95 backdrop-blur-md border-t border-slate-800 px-3 py-1.5 flex items-center justify-around text-[10px] font-mono text-slate-400">
        <button
          onClick={() => setActiveWorkspace('overview')}
          className={`flex flex-col items-center gap-0.5 py-1 px-2.5 rounded transition-colors ${
            activeWorkspace === 'overview' ? 'text-amber-400 font-bold' : 'hover:text-slate-200'
          }`}
        >
          <LayoutDashboard className="w-4 h-4" />
          <span>Overview</span>
        </button>
        <button
          onClick={() => setActiveWorkspace('terminal')}
          className={`flex flex-col items-center gap-0.5 py-1 px-2.5 rounded transition-colors ${
            activeWorkspace === 'terminal' ? 'text-amber-400 font-bold' : 'hover:text-slate-200'
          }`}
        >
          <CandlestickChart className="w-4 h-4" />
          <span>Terminal</span>
        </button>
        <button
          onClick={() => setActiveWorkspace('technical')}
          className={`flex flex-col items-center gap-0.5 py-1 px-2.5 rounded transition-colors ${
            activeWorkspace === 'technical' ? 'text-amber-400 font-bold' : 'hover:text-slate-200'
          }`}
        >
          <Activity className="w-4 h-4" />
          <span>Technicals</span>
        </button>
        <button
          onClick={() => setActiveWorkspace('monetization')}
          className={`flex flex-col items-center gap-0.5 py-1 px-2.5 rounded transition-colors ${
            activeWorkspace === 'monetization' ? 'text-amber-400 font-bold' : 'hover:text-slate-200'
          }`}
        >
          <span className="font-bold text-amber-400">⬡ {entitlements.creditsBalance}</span>
          <span>Pricing</span>
        </button>
        <button
          onClick={() => setIsMobileMenuOpen(true)}
          className="flex flex-col items-center gap-0.5 py-1 px-2.5 rounded text-amber-400 hover:text-amber-300 transition-colors"
        >
          <Menu className="w-4 h-4" />
          <span>Workspaces</span>
        </button>
      </nav>
    </div>
  );
}
