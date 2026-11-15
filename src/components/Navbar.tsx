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
import { UserSession, UserRole } from '../services/authService';
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
  Sliders,
  User,
  ShieldCheck,
  ChevronDown,
  LogOut,
  Zap,
  Globe,
  LayoutDashboard,
  Building2,
  CheckCircle2,
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
  onLogout?: () => void;
  isLandingPageActive?: boolean;
  onToggleLandingPage?: () => void;
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
  onLogout,
  isLandingPageActive = false,
  onToggleLandingPage,
  feedStatus,
}) => {
  const [timeUtc, setTimeUtc] = useState<string>('');
  const [isProfileOpen, setIsProfileOpen] = useState<boolean>(false);
  const profileRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (profileRef.current && !profileRef.current.contains(e.target as Node)) {
        setIsProfileOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

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
          <span className="text-sm sm:text-base font-bold tracking-tight text-slate-100 group-hover:text-amber-400 transition-colors whitespace-nowrap hidden xs:inline">
            Aurum
          </span>
        </a>

        <span className="text-slate-600 hidden lg:inline" aria-hidden="true">/</span>
        <span className="text-xs font-mono text-slate-400 hidden xl:inline whitespace-nowrap truncate max-w-[180px]">
          {activeWorkspaceTitle}
        </span>
      </div>

      {/* Zone 2: Multi-Commodity Quick Selector Bar (Touch Scrollable) */}
      <div className="flex items-center gap-1 sm:gap-1.5 overflow-x-auto py-1 scrollbar-none max-w-full">
        {commodities.map((item) => {
          const isSelected = currentCommodity === item.id;
          const mid = item.quote ? item.quote.mid : 0;
          const change = item.quote ? item.quote.change24hPct : 0;

          return (
            <button
              key={item.id}
              onClick={() => onCommodityChange(item.id)}
              aria-pressed={isSelected}
              className={`flex items-center gap-1.5 sm:gap-2 px-2 sm:px-2.5 py-1 rounded-lg text-xs font-mono transition-all whitespace-nowrap cursor-pointer focus-visible:outline-2 focus-visible:outline-amber-400 ${
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
                <span className="text-white font-bold hidden xs:inline">
                  ${mid.toFixed(2)}
                </span>
              )}
              {item.quote && (
                <span
                  className={`text-[10px] hidden sm:inline ${
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

      {/* Zone 3: Controls, Fit to Screen, Live Feed & Session Clock */}
      <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
        {/* Fit to Screen (Terminal Fit Mode) Toggle */}
        {onToggleFitToScreen && (
          <button
            onClick={onToggleFitToScreen}
            className={`flex items-center gap-1 px-2 py-1 rounded-lg border text-xs font-mono transition-all cursor-pointer ${
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
            <span className="hidden sm:inline">{isFitToScreen ? 'Fit: On' : 'Fit Screen'}</span>
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

        {/* Live Credit Counter & Quick Top-Up */}
        {creditsBalance !== undefined && onOpenPricingHub && (
          <button
            onClick={onOpenPricingHub}
            className="flex items-center gap-1.5 px-2.5 py-1 text-xs font-mono rounded-lg border border-amber-500/40 bg-amber-500/10 hover:bg-amber-500/20 text-amber-300 transition-all cursor-pointer shadow-xs"
            title="Active Signal Unlocks Available. Click to open Membership & Billing Hub."
          >
            <span className="text-amber-400 font-bold">{creditsBalance} ⬡</span>
            <span className="hidden sm:inline text-[11px] text-amber-200/90 font-sans">
              {membershipTier === 'PRO' ? 'PRO PASS' : membershipTier === 'ALPHA' ? 'ALPHA' : 'Credits'}
            </span>
            <span className="hidden md:inline px-1 py-0.5 rounded text-[10px] bg-amber-400/20 text-amber-300 font-bold ml-0.5">
              + Top Up
            </span>
          </button>
        )}

        {/* User Session Profile & Role Dropdown */}
        {userSession && (
          <div className="relative" ref={profileRef}>
            {userSession.role === 'GUEST' ? (
              <div className="flex items-center gap-1.5">
                <button
                  onClick={() => onOpenAuth && onOpenAuth('LOGIN')}
                  className="px-2.5 py-1 text-xs font-medium text-slate-300 hover:text-slate-100 transition-colors hidden sm:inline"
                >
                  Sign In
                </button>
                <button
                  onClick={() => onOpenAuth && onOpenAuth('ENROLL')}
                  className="flex items-center gap-1 px-3 py-1 bg-gradient-to-r from-amber-500 to-amber-400 text-slate-950 font-bold text-xs rounded-lg shadow-xs hover:from-amber-400 hover:to-amber-300 transition-all cursor-pointer"
                >
                  <Zap className="w-3 h-3 fill-slate-950" />
                  <span>Enroll Free</span>
                </button>
              </div>
            ) : (
              <button
                onClick={() => setIsProfileOpen(!isProfileOpen)}
                aria-expanded={isProfileOpen}
                aria-haspopup="menu"
                aria-label="Open Account Profile and Persona Switcher"
                className="flex items-center gap-1.5 p-1 sm:px-2 sm:py-1 rounded-lg border border-slate-800 bg-slate-950 hover:border-slate-700 transition-colors text-xs font-mono cursor-pointer focus-visible:outline-2 focus-visible:outline-amber-400"
                title="Account Profile & Persona Control"
              >
                {userSession.avatarUrl ? (
                  <img
                    src={userSession.avatarUrl}
                    alt={userSession.displayName}
                    className="w-5 h-5 rounded-full object-cover border border-amber-400/60"
                  />
                ) : (
                  <div className="w-5 h-5 rounded-full bg-amber-500/20 border border-amber-500/40 text-amber-400 flex items-center justify-center text-[10px] font-bold">
                    {userSession.displayName.charAt(0)}
                  </div>
                )}
                <span className="hidden xl:inline text-slate-200 font-medium">
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
            )}

            {/* Profile Dropdown Menu */}
            {isProfileOpen && (
              <div className="absolute right-0 mt-2 w-72 bg-slate-900 border border-slate-800 rounded-xl shadow-2xl p-3 z-50 animate-fade-in font-sans space-y-3">
                {/* User Card */}
                <div className="flex items-center gap-2.5 pb-2.5 border-b border-slate-800">
                  {userSession.avatarUrl ? (
                    <img
                      src={userSession.avatarUrl}
                      alt={userSession.displayName}
                      className="w-10 h-10 rounded-full object-cover border border-amber-400"
                    />
                  ) : (
                    <div className="w-10 h-10 rounded-full bg-amber-500/20 border border-amber-500/40 text-amber-400 flex items-center justify-center font-bold">
                      {userSession.displayName.charAt(0)}
                    </div>
                  )}
                  <div className="overflow-hidden">
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

                {/* Instant Role Persona Switcher (For testing/reviewing all permission levels) */}
                <div className="p-2 bg-slate-950 rounded-lg border border-slate-800/80 space-y-1.5">
                  <span className="text-[10px] font-mono text-slate-400 uppercase tracking-wider block">
                    ⚡ Instant Persona Switcher (Test Tiers)
                  </span>
                  <div className="grid grid-cols-2 gap-1 text-[11px] font-mono">
                    <button
                      onClick={() => {
                        onSwitchPersona && onSwitchPersona('GUEST');
                        setIsProfileOpen(false);
                      }}
                      className={`p-1 rounded text-left transition-colors ${
                        userSession.role === 'GUEST'
                          ? 'bg-slate-800 text-amber-400 font-bold'
                          : 'text-slate-400 hover:text-slate-200'
                      }`}
                    >
                      • Guest Visitor
                    </button>
                    <button
                      onClick={() => {
                        onSwitchPersona && onSwitchPersona('FREE');
                        setIsProfileOpen(false);
                      }}
                      className={`p-1 rounded text-left transition-colors ${
                        userSession.role === 'FREE'
                          ? 'bg-slate-800 text-amber-400 font-bold'
                          : 'text-slate-400 hover:text-slate-200'
                      }`}
                    >
                      • Free Member
                    </button>
                    <button
                      onClick={() => {
                        onSwitchPersona && onSwitchPersona('PRO');
                        setIsProfileOpen(false);
                      }}
                      className={`p-1 rounded text-left transition-colors ${
                        userSession.role === 'PRO'
                          ? 'bg-slate-800 text-amber-400 font-bold'
                          : 'text-slate-400 hover:text-slate-200'
                      }`}
                    >
                      • Pro Trader
                    </button>
                    <button
                      onClick={() => {
                        onSwitchPersona && onSwitchPersona('ALPHA');
                        setIsProfileOpen(false);
                      }}
                      className={`p-1 rounded text-left transition-colors ${
                        userSession.role === 'ALPHA'
                          ? 'bg-slate-800 text-amber-400 font-bold'
                          : 'text-slate-400 hover:text-slate-200'
                      }`}
                    >
                      • Alpha Fund
                    </button>
                  </div>
                </div>

                {/* Direct Action Links */}
                <div className="space-y-1 text-xs">
                  <button
                    onClick={() => {
                      onOpenPricingHub && onOpenPricingHub();
                      setIsProfileOpen(false);
                    }}
                    className="w-full flex items-center justify-between p-2 rounded-lg hover:bg-slate-800 text-slate-300 transition-colors"
                  >
                    <span>Membership & Billing Hub</span>
                    <span className="text-[10px] font-mono text-amber-400">PRO</span>
                  </button>

                  <button
                    onClick={() => {
                      onLogout && onLogout();
                      setIsProfileOpen(false);
                    }}
                    className="w-full flex items-center gap-2 p-2 rounded-lg hover:bg-rose-500/10 text-rose-400 transition-colors"
                  >
                    <LogOut className="w-3.5 h-3.5" />
                    <span>Sign Out (Revert to Guest)</span>
                  </button>
                </div>
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
            className={`w-2 h-2 rounded-full animate-pulse ${
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
