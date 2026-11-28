/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * Aurum Intelligence — Responsive, Controllable Top Navigation Bar
 *
 * Supports:
 * 1. Mobile menu drawer trigger & desktop sidebar collapse toggle.
 * 2. Multi-Commodity selector (Gold, Silver, WTI, Brent) with live quotes.
 * 3. Fit-to-screen / terminal mode toggle for maximum screen space utilization.
 * 4. Real-time feed status indicator, manual refresh, and session clock.
 */

import React, { useState, useEffect, useRef } from 'react';
import { CommodityType, Quote } from '../domain/types';
import { UserSession, UserRole, DEMO_PERSONAS } from '../services/authService';
import { TradeLifecycleAlertEvent } from '../services/tradeAlertService';
import {
  Sun,
  Moon,
  Clock,
  RefreshCw,
  Menu,
  PanelLeftClose,
  PanelLeftOpen,
  Maximize2,
  Minimize2,
  ChevronDown,
  LogOut,
  Globe,
  LayoutDashboard,
  Search,
  UserPlus,
  Bell,
  Briefcase,
  ArrowUpRight,
  ArrowDownRight,
} from 'lucide-react';

interface NavbarProps {
  quotes: Record<string, Quote>;
  isDark: boolean;
  onToggleTheme: () => void;
  activeWorkspaceTitle: string;
  currentCommodity: CommodityType;
  onCommodityChange: (c: CommodityType) => void;
  isRefreshing?: boolean;
  onRefreshQuotes?: () => void;
  lastRefreshTime?: Date;
  isFitToScreen?: boolean;
  onToggleFitToScreen?: () => void;
  isSidebarCollapsed?: boolean;
  onToggleSidebar?: () => void;
  onOpenMobileMenu?: () => void;
  creditsBalance?: number;
  membershipTier?: 'FREE' | 'PRO' | 'ALPHA';
  onOpenPricingHub?: () => void;
  userSession?: UserSession;
  onOpenAuth?: (mode?: 'LOGIN' | 'ENROLL') => void;
  onSwitchPersona?: (role: UserRole) => void;
  onChangeTier?: (role: Exclude<UserRole, 'GUEST'>) => void;
  onLogout?: () => void;
  isLandingPageActive?: boolean;
  onToggleLandingPage?: () => void;
  onOpenCommandPalette?: () => void;
  openPositionsCount?: number;
  openUnrealizedPnl?: number;
  onJumpToPositions?: (positionId?: string) => void;
  tradeAlerts?: TradeLifecycleAlertEvent[];
  onMarkAlertsRead?: () => void;
  browserPushPermission?: NotificationPermission | 'unsupported';
  onEnablePushNotifications?: () => void;
  feedStatus?: {
    provider: string;
    latencyMs: number;
    quality: 'FRESH' | 'DEGRADED' | 'STALE' | 'QUALITY_HOLD';
    isLive: boolean;
  };
}

export const Navbar: React.FC<NavbarProps> = ({
  quotes,
  isDark,
  onToggleTheme,
  activeWorkspaceTitle,
  currentCommodity,
  onCommodityChange,
  isRefreshing = false,
  onRefreshQuotes,
  lastRefreshTime,
  isFitToScreen = false,
  onToggleFitToScreen,
  isSidebarCollapsed = false,
  onToggleSidebar,
  onOpenMobileMenu,
  creditsBalance,
  membershipTier = 'FREE',
  onOpenPricingHub,
  userSession,
  onOpenAuth,
  onSwitchPersona,
  onChangeTier,
  onLogout,
  isLandingPageActive = false,
  onToggleLandingPage,
  onOpenCommandPalette,
  openPositionsCount = 0,
  openUnrealizedPnl = 0,
  onJumpToPositions,
  tradeAlerts = [],
  onMarkAlertsRead,
  browserPushPermission = 'default',
  onEnablePushNotifications,
  feedStatus,
}) => {
  const [timeUtc, setTimeUtc] = useState<string>('');
  const [isProfileOpen, setIsProfileOpen] = useState<boolean>(false);
  const [isAlertsOpen, setIsAlertsOpen] = useState<boolean>(false);
  const profileRef = useRef<HTMLDivElement>(null);
  const alertsRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (profileRef.current && !profileRef.current.contains(e.target as Node)) {
        setIsProfileOpen(false);
      }
      if (alertsRef.current && !alertsRef.current.contains(e.target as Node)) {
        setIsAlertsOpen(false);
      }
    };
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setIsProfileOpen(false);
        setIsAlertsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, []);

  const unreadAlertsCount = tradeAlerts.filter((a) => !a.read).length;

  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      setTimeUtc(now.toUTCString().slice(17, 22) + ' UTC');
    };
    updateTime();
    const interval = setInterval(updateTime, 1000);
    return () => clearInterval(interval);
  }, []);

  const goldQuote = quotes['XAUUSD'];
  const silverQuote = quotes['XAGUSD'];
  const wtiQuote = quotes['WTI_CRUDE'];
  const brentQuote = quotes['BRENT_CRUDE'];

  const commodities: { id: CommodityType; label: string; shortLabel: string; quote?: Quote; unit: string }[] = [
    { id: 'GOLD', label: 'Gold (XAU)', shortLabel: 'Gold', quote: goldQuote, unit: '$/oz' },
    { id: 'SILVER', label: 'Silver (XAG)', shortLabel: 'Silver', quote: silverQuote, unit: '$/oz' },
    { id: 'WTI_OIL', label: 'WTI Oil (CL)', shortLabel: 'WTI', quote: wtiQuote, unit: '$/bbl' },
    { id: 'BRENT_OIL', label: 'Brent (BZ)', shortLabel: 'Brent', quote: brentQuote, unit: '$/bbl' },
  ];

  return (
    <header className="h-14 border-b border-slate-800 bg-slate-900/95 dark:bg-slate-950/95 backdrop-blur px-2.5 sm:px-4 lg:px-5 flex items-center justify-between gap-2 sm:gap-4 shrink-0 z-20 select-none">
      {/* Zone 1: Mobile Hamburger, Desktop Sidebar Toggle, Wordmark & Title */}
      <div className="flex items-center gap-1.5 sm:gap-2.5 shrink-0">
        {/* Mobile Hamburger Drawer Trigger */}
        {onOpenMobileMenu && (
          <button
            onClick={onOpenMobileMenu}
            className="p-1.5 rounded-lg border border-slate-800 text-slate-400 hover:text-slate-100 hover:bg-slate-800 md:hidden flex items-center justify-center cursor-pointer"
            aria-label="Open Navigation Menu"
            title="Open Workspaces Menu"
          >
            <Menu className="w-4 h-4 text-amber-400" />
          </button>
        )}

        {/* Desktop Sidebar Collapse Toggle */}
        {onToggleSidebar && (
          <button
            onClick={onToggleSidebar}
            className="p-1.5 rounded-lg border border-slate-800 text-slate-400 hover:text-slate-100 hover:bg-slate-800/80 hidden md:flex items-center justify-center cursor-pointer"
            aria-label="Toggle Sidebar"
            title={isSidebarCollapsed ? 'Expand Sidebar (Ctrl+B)' : 'Collapse Sidebar to Rail (Ctrl+B)'}
          >
            {isSidebarCollapsed ? (
              <PanelLeftOpen className="w-4 h-4 text-amber-400" />
            ) : (
              <PanelLeftClose className="w-4 h-4" />
            )}
          </button>
        )}

        {/* Brand Logo & Wordmark */}
        <a href="/" className="flex items-center gap-1.5 sm:gap-2 group">
          <div className="w-6 h-6 rounded bg-gradient-to-tr from-amber-600 to-amber-300 flex items-center justify-center font-bold text-slate-950 text-xs shadow-xs">
            Au
          </div>
          <span className="text-sm sm:text-base font-bold tracking-tight text-slate-100 group-hover:text-amber-400 transition-colors whitespace-nowrap hidden sm:inline">
            Aurum
          </span>
        </a>

        <span className="text-slate-600 hidden lg:inline" aria-hidden="true">/</span>
        <span className="text-xs font-mono text-slate-400 hidden xl:inline whitespace-nowrap truncate max-w-[180px]">
          {activeWorkspaceTitle}
        </span>
      </div>

      {/* Zone 2: Multi-Commodity Quick Selector Bar (Touch Scrollable) */}
      <div className="flex-1 min-w-0 flex items-center gap-1 sm:gap-1.5 overflow-x-auto py-1 scrollbar-none">
        {commodities.map((item) => {
          const isSelected = currentCommodity === item.id;
          const mid = item.quote ? item.quote.mid : 0;
          const change = item.quote ? item.quote.change24hPct : 0;

          return (
            <button
              key={item.id}
              onClick={() => onCommodityChange(item.id)}
              aria-pressed={isSelected}
              className={`flex items-center gap-1.5 sm:gap-2 px-2 sm:px-2.5 py-1 rounded-lg text-xs font-mono transition-all whitespace-nowrap shrink-0 cursor-pointer focus-visible:outline-2 focus-visible:outline-amber-400 ${
                isSelected
                  ? 'bg-amber-500/20 text-white border border-amber-500/50 shadow-xs'
                  : 'bg-slate-950/70 text-slate-400 border border-slate-800/80 hover:text-slate-200 hover:border-slate-700'
              }`}
            >
              <span className={`font-semibold ${isSelected ? 'text-amber-300' : 'text-slate-300'}`}>
                <span className="sm:hidden">{item.shortLabel}</span>
                <span className="hidden sm:inline">{item.label}</span>
              </span>
              {mid > 0 && (
                <span className="text-white font-bold tabular-nums">
                  ${mid.toFixed(2)}
                </span>
              )}
              {item.quote && (
                <span
                  className={`text-[10px] hidden md:inline tabular-nums ${
                    change >= 0 ? 'text-emerald-400' : 'text-rose-400'
                  }`}
                >
                  {change >= 0 ? '+' : ''}{change}%
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Zone 3: Quick Jump, Controls, Fit to Screen, Session Auth & Clock */}
      <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
        {/* Quick Jump Command Palette Trigger (Ctrl+K) */}
        {onOpenCommandPalette && !isLandingPageActive && (
          <button
            type="button"
            onClick={onOpenCommandPalette}
            aria-label="Quick Jump Workspaces (Ctrl+K)"
            title="Quick Jump Workspaces, Tabs & Commodities (Ctrl+K)"
            className="hidden sm:flex items-center gap-1.5 px-2 py-1.5 rounded-lg border border-slate-800 bg-slate-950 hover:bg-slate-800 text-slate-300 hover:text-slate-100 text-xs font-mono transition-colors whitespace-nowrap shrink-0 cursor-pointer focus-visible:outline-2 focus-visible:outline-amber-400"
          >
            <Search className="w-3.5 h-3.5 text-amber-400 shrink-0" />
            <span className="hidden lg:inline">Quick Jump</span>
            <kbd className="hidden xl:inline text-[10px] px-1 py-0.5 rounded bg-slate-900 border border-slate-700 text-slate-400">
              ⌘K
            </kbd>
          </button>
        )}

        {/* Fit to Screen (Terminal Fit Mode) Toggle */}
        {onToggleFitToScreen && (
          <button
            onClick={onToggleFitToScreen}
            className={`hidden sm:flex items-center gap-1 px-2 py-1 rounded-lg border text-xs font-mono transition-all whitespace-nowrap shrink-0 cursor-pointer ${
              isFitToScreen
                ? 'bg-blue-600/20 text-blue-300 border-blue-500/50 font-bold shadow-xs'
                : 'bg-slate-950 text-slate-400 border-slate-800 hover:text-slate-200 hover:border-slate-700'
            }`}
            title={
              isFitToScreen
                ? 'Fit to Screen Active (100% Viewport Height, No Dual Scrollbars). Click to switch to Scrollable Dashboard.'
                : 'Activate Fit to Screen Mode (Auto-fits terminal and chart to 100% viewport height).'
            }
          >
            {isFitToScreen ? (
              <Minimize2 className="w-3.5 h-3.5 text-blue-400" />
            ) : (
              <Maximize2 className="w-3.5 h-3.5 text-slate-400" />
            )}
            <span className="hidden lg:inline">{isFitToScreen ? 'Fit: On' : 'Fit Screen'}</span>
          </button>
        )}

        {/* Public Landing vs Terminal Mode Switcher */}
        {onToggleLandingPage && (
          <button
            onClick={onToggleLandingPage}
            className="flex items-center gap-1.5 px-2.5 py-1 text-xs font-mono rounded-lg border border-slate-700 bg-slate-900 hover:bg-slate-800 text-slate-200 transition-colors shadow-xs"
            title={isLandingPageActive ? 'Switch to Platform Terminal' : 'View Public Landing Page & Enrollment Portal'}
          >
            {isLandingPageActive ? (
              <>
                <LayoutDashboard className="w-3.5 h-3.5 text-amber-400" />
                <span className="hidden sm:inline">Terminal</span>
              </>
            ) : (
              <>
                <Globe className="w-3.5 h-3.5 text-amber-400" />
                <span className="hidden sm:inline">Landing</span>
              </>
            )}
          </button>
        )}

        {/* Live Open Positions Summary Pill/Button (Always know where your positions stand) */}
        {onJumpToPositions && !isLandingPageActive && (
          <button
            type="button"
            onClick={() => onJumpToPositions()}
            aria-label={`Open Positions: ${openPositionsCount}`}
            title="Inspect Open Positions & Trade Status in Portfolio & Journal"
            className={`hidden md:flex items-center gap-1.5 px-2.5 py-1 text-xs font-mono rounded-lg border transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
              openPositionsCount > 0
                ? openUnrealizedPnl >= 0
                  ? 'border-emerald-500/40 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-300'
                  : 'border-rose-500/40 bg-rose-500/10 hover:bg-rose-500/20 text-rose-300'
                : 'border-slate-800 bg-slate-950 hover:bg-slate-800 text-slate-400 hover:text-slate-200'
            }`}
          >
            <Briefcase className="w-3.5 h-3.5 shrink-0" />
            <span className="font-semibold tabular-nums">{openPositionsCount} Open</span>
            {openPositionsCount > 0 && (
              <span className="text-[11px] font-bold tabular-nums border-l border-current/25 pl-1.5">
                {openUnrealizedPnl >= 0 ? '+$' : '-$'}
                {Math.abs(openUnrealizedPnl).toLocaleString('en-US', {
                  minimumFractionDigits: 0,
                  maximumFractionDigits: 0,
                })}
              </span>
            )}
          </button>
        )}

        {/* Trade Open/Close Alert Center Bell */}
        {!isLandingPageActive && (
          <div className="relative" ref={alertsRef}>
            <button
              type="button"
              onClick={() => {
                const next = !isAlertsOpen;
                setIsAlertsOpen(next);
                if (next && unreadAlertsCount > 0 && onMarkAlertsRead) {
                  onMarkAlertsRead();
                }
              }}
              aria-label={`Trade Alerts (${unreadAlertsCount} unread)`}
              aria-expanded={isAlertsOpen}
              title="Trade Open & Close Notifications"
              className="relative min-h-[36px] flex items-center justify-center p-1.5 px-2 rounded-lg border border-slate-800 bg-slate-950 hover:bg-slate-800 text-slate-300 hover:text-slate-100 transition-colors cursor-pointer"
            >
              <Bell className={`w-4 h-4 ${unreadAlertsCount > 0 ? 'text-amber-400' : 'text-slate-400'}`} />
              {unreadAlertsCount > 0 && (
                <span className="ml-1 text-[10px] font-mono font-bold text-amber-300 tabular-nums">
                  {unreadAlertsCount}
                </span>
              )}
            </button>

            {isAlertsOpen && (
              <div
                role="dialog"
                aria-label="Trade execution alerts"
                className="absolute right-0 top-full mt-2 w-80 sm:w-96 max-w-[calc(100vw-1rem)] bg-slate-900 border border-slate-800 rounded-xl shadow-2xl p-3 z-50 font-sans space-y-2.5"
              >
                <div className="flex items-center justify-between pb-2 border-b border-slate-800">
                  <div>
                    <h4 className="text-xs font-bold text-slate-100">Trade &amp; Position Alerts</h4>
                    <p className="text-[11px] text-slate-400">
                      Scoped to {userSession?.displayName || 'Current Session'}
                    </p>
                  </div>
                  {browserPushPermission !== 'unsupported' &&
                    browserPushPermission !== 'granted' &&
                    onEnablePushNotifications && (
                      <button
                        type="button"
                        onClick={onEnablePushNotifications}
                        className="px-2 py-1 rounded bg-amber-500/15 hover:bg-amber-500/25 border border-amber-500/40 text-amber-300 text-[10px] font-mono font-semibold whitespace-nowrap cursor-pointer"
                      >
                        Enable Push
                      </button>
                    )}
                </div>

                {tradeAlerts.length === 0 ? (
                  <p className="text-xs text-slate-400 py-4 text-center">
                    No trade open or close alerts yet for this account. Open or close a paper trade to receive instant alerts.
                  </p>
                ) : (
                  <div className="max-h-72 overflow-y-auto divide-y divide-slate-800/70">
                    {tradeAlerts.slice(0, 12).map((alert) => {
                      const isOpened = alert.eventType === 'TRADE_OPENED';
                      const pnlVal = Number(alert.realizedPnl ?? 0);
                      return (
                        <div key={alert.id} className="py-2 flex items-start justify-between gap-2 text-xs">
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-1.5 font-mono font-semibold">
                              {alert.direction === 'BUY' ? (
                                <ArrowUpRight className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                              ) : (
                                <ArrowDownRight className="w-3.5 h-3.5 text-rose-400 shrink-0" />
                              )}
                              <span className={isOpened ? 'text-amber-300' : pnlVal >= 0 ? 'text-emerald-400' : 'text-rose-400'}>
                                {isOpened ? 'OPENED' : 'CLOSED'}
                              </span>
                              <span className="text-slate-100">{alert.instrumentId}</span>
                              <span className="text-slate-400 tabular-nums">{alert.lots}L</span>
                            </div>
                            <p className="text-[11px] text-slate-300 mt-0.5 tabular-nums">
                              {isOpened
                                ? `Entry $${alert.entryPrice.toFixed(2)} · SL $${alert.stopLoss.toFixed(2)} · TP $${alert.takeProfit.toFixed(2)}`
                                : `Closed @ $${(alert.exitPrice ?? alert.entryPrice).toFixed(2)} · ${
                                    pnlVal >= 0 ? '+$' : '-$'
                                  }${Math.abs(pnlVal).toFixed(2)}`}
                            </p>
                            <p className="text-[10px] font-mono text-slate-500 mt-0.5">
                              {new Date(alert.timestamp).toLocaleTimeString()} · {alert.triggerSource.replace(/_/g, ' ')}
                            </p>
                          </div>
                          {onJumpToPositions && (
                            <button
                              type="button"
                              onClick={() => {
                                setIsAlertsOpen(false);
                                onJumpToPositions(alert.positionId);
                              }}
                              className="px-2 py-1 rounded border border-slate-700 bg-slate-950 hover:bg-slate-800 text-[10px] font-mono text-amber-300 whitespace-nowrap shrink-0 cursor-pointer"
                            >
                              Inspect
                            </button>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* Live Credit Counter & Quick Top-Up */}
        {creditsBalance !== undefined && onOpenPricingHub && (
          <button
            onClick={onOpenPricingHub}
            className="flex items-center gap-1.5 px-2.5 py-1 text-xs font-mono rounded-lg border border-amber-500/40 bg-amber-500/10 hover:bg-amber-500/20 text-amber-300 transition-all cursor-pointer shadow-xs"
            title="Active Signal Unlocks Available. Click to open Membership & Billing Hub."
          >
            <span className="text-amber-400 font-bold tabular-nums">{creditsBalance} ⬡</span>
            <span className="hidden sm:inline text-[11px] text-amber-200/90 font-sans">
              {membershipTier === 'PRO' ? 'PRO PASS' : membershipTier === 'ALPHA' ? 'ALPHA' : 'Credits'}
            </span>
            <span className="hidden md:inline px-1 py-0.5 rounded text-[10px] bg-amber-400/20 text-amber-300 font-bold ml-0.5">
              + Top Up
            </span>
          </button>
        )}

        {/* User Session Profile, Sign Up / Sign In & Direct Sign Out */}
        {userSession && (
          <div className="relative flex items-center gap-1.5" ref={profileRef}>
            {userSession.role === 'GUEST' ? (
              <div className="flex items-center gap-1.5 shrink-0">
                <button
                  type="button"
                  onClick={() => onOpenAuth && onOpenAuth('LOGIN')}
                  className="min-h-[36px] px-2.5 py-1.5 text-xs font-medium text-slate-200 hover:text-white border border-slate-700/80 hover:border-slate-600 bg-slate-950 hover:bg-slate-800 rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                >
                  Sign In
                </button>
                <button
                  type="button"
                  onClick={() => onOpenAuth && onOpenAuth('ENROLL')}
                  className="min-h-[36px] flex items-center gap-1 px-2.5 sm:px-3 py-1.5 bg-gradient-to-r from-amber-500 to-amber-400 text-slate-950 font-bold text-xs rounded-lg shadow-xs hover:from-amber-400 hover:to-amber-300 transition-all whitespace-nowrap shrink-0 cursor-pointer"
                >
                  <UserPlus className="w-3.5 h-3.5 shrink-0" />
                  <span>Sign Up</span>
                </button>
              </div>
            ) : (
              <>
                <button
                  type="button"
                  onClick={() => setIsProfileOpen(!isProfileOpen)}
                  aria-expanded={isProfileOpen}
                  aria-haspopup="menu"
                  aria-label="Open Account Profile and Session Menu"
                  className="min-h-[36px] flex items-center gap-1.5 px-2 py-1 rounded-lg border border-slate-800 bg-slate-950 hover:border-slate-700 transition-colors text-xs font-mono cursor-pointer shrink-0 focus-visible:outline-2 focus-visible:outline-amber-400"
                  title="Account Profile & Session Menu"
                >
                  {userSession.avatarUrl ? (
                    <img
                      src={userSession.avatarUrl}
                      alt={userSession.displayName}
                      className="w-5 h-5 rounded-full object-cover border border-amber-400/60"
                    />
                  ) : (
                    <div className="w-5 h-5 rounded-full bg-amber-500/20 border border-amber-500/40 text-amber-400 flex items-center justify-center text-[10px] font-bold">
                      {userSession.displayName.charAt(0).toUpperCase()}
                    </div>
                  )}
                  <span className="hidden xl:inline text-slate-200 font-medium max-w-[100px] truncate">
                    {userSession.displayName.split(' ')[0]}
                  </span>
                  <span
                    className={`text-[9px] px-1 py-0.2 rounded font-bold uppercase ${
                      userSession.role === 'ALPHA'
                        ? 'bg-purple-500/20 text-purple-300 border border-purple-500/30'
                        : userSession.role === 'PRO'
                        ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                        : 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                    }`}
                  >
                    {userSession.role}
                  </span>
                  <ChevronDown className="w-3 h-3 text-slate-400" />
                </button>

                {/* Dedicated Top-Bar Sign Out Button (Visible immediately without hunting inside menus) */}
                {onLogout && (
                  <button
                    type="button"
                    onClick={() => {
                      setIsProfileOpen(false);
                      onLogout();
                    }}
                    aria-label="Sign Out"
                    title="Sign Out of Current Account"
                    className="min-h-[36px] flex items-center gap-1.5 px-2 sm:px-2.5 py-1.5 rounded-lg border border-rose-500/30 bg-rose-500/10 hover:bg-rose-500/20 text-rose-300 hover:text-rose-200 text-xs font-medium transition-colors whitespace-nowrap shrink-0 cursor-pointer focus-visible:outline-2 focus-visible:outline-rose-400"
                  >
                    <LogOut className="w-3.5 h-3.5 shrink-0" />
                    <span className="hidden lg:inline">Sign Out</span>
                  </button>
                )}
              </>
            )}

            {/* Profile Dropdown Menu */}
            {isProfileOpen && (
              <div
                role="menu"
                aria-label="Account menu"
                className="absolute right-0 top-full mt-2 w-72 max-w-[calc(100vw-1rem)] bg-slate-900 border border-slate-800 rounded-xl shadow-2xl p-3 z-50 animate-fade-in font-sans space-y-3"
              >
                {/* User Identity Header */}
                <div className="flex items-center gap-2.5 pb-2.5 border-b border-slate-800">
                  {userSession.avatarUrl ? (
                    <img
                      src={userSession.avatarUrl}
                      alt={userSession.displayName}
                      className="w-10 h-10 rounded-full object-cover border border-amber-400 shrink-0"
                    />
                  ) : (
                    <div className="w-10 h-10 rounded-full bg-amber-500/20 border border-amber-500/40 text-amber-400 flex items-center justify-center font-bold shrink-0">
                      {userSession.displayName.charAt(0).toUpperCase()}
                    </div>
                  )}
                  <div className="overflow-hidden min-w-0">
                    <h4 className="text-xs font-bold text-slate-100 truncate">
                      {userSession.displayName}
                    </h4>
                    <p className="text-[11px] text-slate-400 truncate font-mono">
                      {userSession.email}
                    </p>
                    <div className="flex items-center gap-1.5 mt-0.5">
                      <span className="text-[10px] font-mono text-amber-400 font-bold uppercase">
                        {userSession.role} TIER
                      </span>
                      {userSession.linkedBrokerId && (
                        <span className="text-[9px] font-mono text-emerald-400 bg-emerald-500/10 px-1 rounded">
                          ECN Spon.
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                {/* Primary Account Actions */}
                <div className="space-y-1.5 text-xs">
                  <button
                    type="button"
                    role="menuitem"
                    onClick={() => {
                      onOpenPricingHub && onOpenPricingHub();
                      setIsProfileOpen(false);
                    }}
                    className="w-full min-h-[40px] flex items-center justify-between px-2.5 py-2 rounded-lg hover:bg-slate-800 text-slate-200 transition-colors cursor-pointer"
                  >
                    <span>Membership &amp; Billing Hub</span>
                    <span className="text-[10px] font-mono text-amber-400 font-bold">{membershipTier}</span>
                  </button>

                  {onOpenAuth && (
                    <button
                      type="button"
                      role="menuitem"
                      onClick={() => {
                        setIsProfileOpen(false);
                        onOpenAuth('ENROLL');
                      }}
                      className="w-full min-h-[40px] flex items-center gap-2 px-2.5 py-2 rounded-lg hover:bg-slate-800 text-slate-200 transition-colors cursor-pointer"
                    >
                      <UserPlus className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                      <span>Create New Account (Sign Up)</span>
                    </button>
                  )}

                  <button
                    type="button"
                    role="menuitem"
                    onClick={() => {
                      setIsProfileOpen(false);
                      onLogout && onLogout();
                    }}
                    className="w-full min-h-[44px] flex items-center justify-center gap-2 px-3 py-2 rounded-lg bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/30 text-rose-300 font-semibold transition-colors cursor-pointer"
                  >
                    <LogOut className="w-4 h-4 shrink-0" />
                    <span>Sign Out</span>
                  </button>
                </div>

                {/* In-Place Tier Switcher for Signed-In User (Preserves Identity & Trades) */}
                {onChangeTier && userSession.role !== 'GUEST' && (
                  <div className="p-2 bg-slate-950 rounded-lg border border-slate-800/80 space-y-1.5">
                    <span className="text-[10px] font-mono text-emerald-400 uppercase tracking-wider block">
                      Your Plan Level (Keeps Your Trades)
                    </span>
                    <div className="grid grid-cols-3 gap-1 text-[11px] font-mono">
                      {(['FREE', 'PRO', 'ALPHA'] as const).map((tierOption) => (
                        <button
                          key={tierOption}
                          type="button"
                          onClick={() => {
                            onChangeTier(tierOption);
                            setIsProfileOpen(false);
                          }}
                          className={`p-1.5 rounded text-center transition-colors cursor-pointer ${
                            userSession.role === tierOption
                              ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40 font-bold'
                              : 'text-slate-300 hover:bg-slate-800 border border-slate-800'
                          }`}
                        >
                          {tierOption}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {/* Explicit Sandbox Demo Accounts (Switches to Demo Persona with Sample Trades) */}
                {onSwitchPersona && (
                  <div className="p-2 bg-slate-950/70 rounded-lg border border-slate-800/80 space-y-1.5">
                    <span className="text-[10px] font-mono text-slate-400 uppercase tracking-wider block">
                      Switch to Demo User (Sample Data)
                    </span>
                    <div className="grid grid-cols-2 gap-1 text-[11px] font-mono">
                      {(['GUEST', 'FREE', 'PRO', 'ALPHA'] as const).map((demoRole) => {
                        const demoMeta = DEMO_PERSONAS[demoRole];
                        const isSameDemo = userSession.uid === demoMeta.uid;
                        return (
                          <button
                            key={demoRole}
                            type="button"
                            onClick={() => {
                              onSwitchPersona(demoRole);
                              setIsProfileOpen(false);
                            }}
                            className={`p-1.5 rounded text-left transition-colors cursor-pointer truncate ${
                              isSameDemo
                                ? 'bg-slate-800 text-amber-400 font-bold'
                                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
                            }`}
                            title={`Switch user account to ${demoMeta.displayName} (${demoRole})`}
                          >
                            • {demoMeta.displayName.split(' ')[0]} ({demoRole})
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* Indicative Reference Feed & Latency Status Badge */}
        <div
          className={`hidden md:flex items-center gap-1.5 text-[11px] font-mono px-2 py-1 rounded-lg border whitespace-nowrap ${
            feedStatus?.quality === 'FRESH'
              ? 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20'
              : feedStatus?.quality === 'DEGRADED'
              ? 'text-amber-400 bg-amber-500/10 border-amber-500/20'
              : 'text-blue-400 bg-blue-500/10 border-blue-500/20'
          }`}
          title={`${feedStatus?.provider || 'Indicative Market Reference'}: Latency ${
            feedStatus?.latencyMs || 140
          }ms · Quality: ${
            feedStatus?.quality || 'FRESH'
          }. Non-execution reference data for quantitative research and advisory decision support. Zero direct broker custody.`}
        >
          <span
            className={`w-2 h-2 rounded-full shrink-0 ${
              feedStatus?.quality === 'FRESH'
                ? 'bg-emerald-400'
                : feedStatus?.quality === 'DEGRADED'
                ? 'bg-amber-400'
                : 'bg-blue-400'
            }`}
          />
          <span className="font-semibold">
            {feedStatus?.isLive ? 'INDICATIVE REF' : 'BENCHMARK'}
          </span>
          <span className="text-[10px] text-slate-400 border-l border-slate-700/60 pl-1.5 tabular-nums">
            {feedStatus?.latencyMs || 140}ms
          </span>
        </div>

        {/* Manual Refresh Button */}
        {onRefreshQuotes && (
          <button
            onClick={onRefreshQuotes}
            aria-label="Refresh Quotes"
            title={
              lastRefreshTime
                ? `Auto-refresh active. Last updated: ${lastRefreshTime.toTimeString().slice(0, 8)} UTC. Click to refresh now.`
                : 'Refresh live quotes'
            }
            className="p-1.5 rounded-lg border border-slate-800 text-slate-400 hover:text-slate-100 hover:bg-slate-800/80 transition-colors cursor-pointer"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin text-amber-400' : ''}`} />
          </button>
        )}

        {/* Session Clock */}
        <div className="hidden 2xl:flex items-center gap-1.5 text-xs font-mono text-slate-400 pr-1 border-r border-slate-800">
          <Clock className="w-3.5 h-3.5 text-amber-400" />
          <span>{timeUtc}</span>
        </div>

        {/* Theme Toggle */}
        <button
          onClick={onToggleTheme}
          aria-label="Toggle Theme"
          className="p-1.5 rounded-lg border border-slate-800 text-slate-400 hover:text-slate-100 hover:bg-slate-800/80 transition-colors cursor-pointer"
        >
          {isDark ? <Sun className="w-4 h-4 text-amber-400" /> : <Moon className="w-4 h-4 text-slate-300" />}
        </button>
      </div>
    </header>
  );
};
