/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * Aurum Intelligence — Responsive, Controllable Sidebar Navigation
 *
 * Supports:
 * 1. Desktop full expansion (w-60) and compact icon-rail (w-16) toggle.
 * 2. Mobile slide-over drawer with backdrop overlay and touch-friendly dismissal.
 * 3. Categorized sections (Core Terminal, Horizon Advisors, Quant/Macro Lab, Operations).
 * 4. High-contrast active indicators and institutional dark-mode aesthetics.
 */

import React, { useMemo, useState } from 'react';
import {
  LayoutDashboard,
  CandlestickChart,
  Activity,
  Zap,
  TrendingUp,
  Compass,
  Scale,
  Landmark,
  History,
  FlaskConical,
  PlayCircle,
  BookOpen,
  Brain,
  FileText,
  BellRing,
  Server,
  Send,
  MessageSquare,
  Newspaper,
  Cpu,
  PanelLeftClose,
  PanelLeftOpen,
  X,
  ShieldCheck,
  DollarSign,
  Search,
  Lock,
  LogOut,
  LogIn,
  UserPlus,
  BarChart3,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';

import { UserRole, UserSession, canAccessWorkspace } from '../services/authService';
import { StrategyAlertFeedEntry } from '../services/strategyEngine';

export type WorkspaceId =
  | 'overview'
  | 'terminal'
  | 'technical'
  | 'intraday'
  | 'swing'
  | 'longterm'
  | 'cfd'
  | 'news_sentiment'
  | 'scenarios'
  | 'macro'
  | 'events'
  | 'strategies'
  | 'backtesting'
  | 'portfolio'
  | 'performance_insights'
  | 'council'
  | 'reports'
  | 'alerts'
  | 'llm_platform'
  | 'market_data_config'
  | 'telegram_notifications'
  | 'gemini_chat'
  | 'monetization';

export interface NavItem {
  id: WorkspaceId;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  section: 'CORE' | 'HORIZONS' | 'QUANT_MACRO' | 'OPERATIONS';
  badge?: string;
}

export const NAV_ITEMS: NavItem[] = [
  // CORE
  { id: 'overview', label: 'Commodity Overview', icon: LayoutDashboard, section: 'CORE' },
  { id: 'terminal', label: 'Live 5Y Terminal', icon: CandlestickChart, section: 'CORE', badge: 'Live' },
  { id: 'technical', label: 'Technical Analysis', icon: Activity, section: 'CORE' },

  // HORIZONS
  { id: 'intraday', label: 'Intraday Advisor', icon: Zap, section: 'HORIZONS' },
  { id: 'swing', label: 'Swing Trading', icon: TrendingUp, section: 'HORIZONS' },
  { id: 'longterm', label: 'Long-Term Outlook', icon: Compass, section: 'HORIZONS' },
  { id: 'cfd', label: 'CFD Risk Calculator', icon: Scale, section: 'HORIZONS' },

  // QUANT & MACRO
  { id: 'news_sentiment', label: 'News & Causal Sentiment', icon: Newspaper, section: 'QUANT_MACRO' },
  { id: 'scenarios', label: 'Macro Scenarios & Analogues', icon: History, section: 'QUANT_MACRO' },
  { id: 'macro', label: 'Macro & Event Studies', icon: Landmark, section: 'QUANT_MACRO' },
  { id: 'strategies', label: 'Strategy Lab', icon: FlaskConical, section: 'QUANT_MACRO', badge: 'PRO' },
  { id: 'backtesting', label: 'Backtesting Engine', icon: PlayCircle, section: 'QUANT_MACRO', badge: 'PRO' },

  // OPERATIONS & GOVERNANCE
  { id: 'monetization', label: 'Pricing & VIP Access', icon: DollarSign, section: 'OPERATIONS', badge: 'VIP' },
  { id: 'llm_platform', label: 'LLM Platform & Gate', icon: Cpu, section: 'OPERATIONS', badge: 'ALPHA' },
  { id: 'council', label: 'Advisory Council AI', icon: Brain, section: 'OPERATIONS', badge: 'ALPHA' },
  { id: 'gemini_chat', label: 'Gemini Research Chat', icon: MessageSquare, section: 'OPERATIONS', badge: 'ALPHA' },
  { id: 'telegram_notifications', label: 'Telegram & Webhooks', icon: Send, section: 'OPERATIONS', badge: 'PRO' },
  { id: 'market_data_config', label: 'Data Feeds & Providers', icon: Server, section: 'OPERATIONS' },
  { id: 'portfolio', label: 'Portfolio & Journal', icon: BookOpen, section: 'OPERATIONS' },
  { id: 'performance_insights', label: 'Performance Insights', icon: BarChart3, section: 'OPERATIONS' },
  { id: 'reports', label: 'Reports & Export', icon: FileText, section: 'OPERATIONS' },
  { id: 'alerts', label: 'Alerts & Health', icon: BellRing, section: 'OPERATIONS' },
];

interface SidebarProps {
  activeId: WorkspaceId;
  onSelect: (id: WorkspaceId) => void;
  isCollapsed?: boolean;
  onToggleCollapse?: () => void;
  isOpenMobile?: boolean;
  onCloseMobile?: () => void;
  userRole?: UserRole;
  userSession?: UserSession;
  onOpenAuth?: (mode?: 'LOGIN' | 'ENROLL') => void;
  onLogout?: () => void;
  onOpenCommandPalette?: () => void;
  strategyAlertFeed?: StrategyAlertFeedEntry[];
  onJumpToChartSetup?: (entry: StrategyAlertFeedEntry) => void;
  onJumpToPortfolioEntry?: (entry: StrategyAlertFeedEntry) => void;
  onOpenFullAlertFeed?: () => void;
  openPositionsCount?: number;
}

export const Sidebar: React.FC<SidebarProps> = ({
  activeId,
  onSelect,
  isCollapsed = false,
  onToggleCollapse,
  isOpenMobile = false,
  onCloseMobile,
  userRole = 'PRO',
  userSession,
  onOpenAuth,
  onLogout,
  onOpenCommandPalette,
  strategyAlertFeed = [],
  onJumpToChartSetup,
  onJumpToPortfolioEntry,
  onOpenFullAlertFeed,
  openPositionsCount = 0,
}) => {
  const [navFilter, setNavFilter] = useState('');
  const [isAlertFeedExpanded, setIsAlertFeedExpanded] = useState<boolean>(true);

  const sections = [
    { title: 'Core Terminal', key: 'CORE' },
    { title: 'Horizon Advisors', key: 'HORIZONS' },
    { title: 'Quant & Macro Lab', key: 'QUANT_MACRO' },
    { title: 'Operations & Governance', key: 'OPERATIONS' },
  ];

  const normalizedFilter = navFilter.trim().toLowerCase();
  const visibleItems = useMemo(() => {
    if (!normalizedFilter) return NAV_ITEMS;
    return NAV_ITEMS.filter(
      (item) =>
        item.label.toLowerCase().includes(normalizedFilter) ||
        item.id.toLowerCase().includes(normalizedFilter)
    );
  }, [normalizedFilter]);

  const handleItemClick = (id: WorkspaceId) => {
    onSelect(id);
    if (onCloseMobile) {
      onCloseMobile();
    }
  };

  const sidebarContent = (
    <div className="flex flex-col h-full bg-slate-900 dark:bg-slate-950 border-r border-slate-800 text-xs font-sans select-none overflow-hidden">
      {/* Sidebar Header: Brand & Collapse Control */}
      <div className="h-12 px-3 border-b border-slate-800/80 flex items-center justify-between shrink-0">
        {!isCollapsed ? (
          <div className="flex items-center gap-2 overflow-hidden">
            <span className="text-[11px] font-mono font-bold uppercase tracking-wider text-slate-400">
              Workspaces
            </span>
          </div>
        ) : (
          <div className="w-full flex justify-center">
            <span className="w-2 h-2 rounded-full bg-amber-400"></span>
          </div>
        )}

        <div className="flex items-center gap-1">
          {/* Collapse/Expand Toggle on Desktop */}
          {onToggleCollapse && (
            <button
              onClick={onToggleCollapse}
              aria-label={isCollapsed ? 'Expand Sidebar' : 'Collapse Sidebar'}
              className="p-1 rounded text-slate-400 hover:text-slate-100 hover:bg-slate-800/80 transition-colors hidden md:flex items-center justify-center cursor-pointer focus-visible:outline-2 focus-visible:outline-amber-400"
              title={isCollapsed ? 'Expand Sidebar (Ctrl+B)' : 'Collapse Sidebar to Icon Rail (Ctrl+B)'}
            >
              {isCollapsed ? <PanelLeftOpen className="w-4 h-4 text-amber-400" /> : <PanelLeftClose className="w-4 h-4" />}
            </button>
          )}

          {/* Close button on Mobile Drawer */}
          {onCloseMobile && (
            <button
              onClick={onCloseMobile}
              aria-label="Close Navigation Menu"
              className="p-1 rounded text-slate-400 hover:text-slate-100 hover:bg-slate-800 md:hidden flex items-center justify-center cursor-pointer focus-visible:outline-2 focus-visible:outline-amber-400"
              title="Close Menu"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {/* Inline Workspace Quick Filter */}
      {!isCollapsed && (
        <div className="px-2.5 pt-2 pb-1 shrink-0">
          <div className="relative flex items-center">
            <Search className="w-3.5 h-3.5 text-slate-500 absolute left-2.5 pointer-events-none" aria-hidden="true" />
            <input
              type="text"
              value={navFilter}
              onChange={(e) => setNavFilter(e.target.value)}
              placeholder="Filter workspaces..."
              aria-label="Filter workspaces"
              className="w-full bg-slate-950 border border-slate-800 rounded-md pl-7 pr-7 py-1.5 text-[11px] text-slate-200 placeholder:text-slate-500 focus:outline-none focus:border-amber-500/60"
            />
            {navFilter ? (
              <button
                type="button"
                onClick={() => setNavFilter('')}
                aria-label="Clear workspace filter"
                className="absolute right-2 text-slate-500 hover:text-slate-200 cursor-pointer"
              >
                <X className="w-3 h-3" />
              </button>
            ) : (
              onOpenCommandPalette && (
                <button
                  type="button"
                  onClick={onOpenCommandPalette}
                  title="Open Quick Jump (Ctrl+K)"
                  className="absolute right-1.5 text-[9px] font-mono px-1 py-0.5 rounded bg-slate-900 border border-slate-700 text-slate-400 hover:text-amber-300 cursor-pointer"
                >
                  ⌘K
                </button>
              )
            )}
          </div>
        </div>
      )}

      {/* Nav Items List */}
      <nav aria-label="Workspace Navigation" className="flex-1 min-h-0 overflow-y-auto p-2 space-y-3.5 scrollbar-thin scrollbar-thumb-slate-800">
        {sections.map((sec) => {
          const sectionItems = visibleItems.filter((item) => item.section === sec.key);
          if (sectionItems.length === 0) return null;
          return (
            <div key={sec.key}>
              {!isCollapsed && (
                <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-slate-500 px-2 block mb-1">
                  {sec.title}
                </span>
              )}
              <div className="space-y-0.5">
                {sectionItems.map((item) => {
                  const Icon = item.icon;
                  const isActive = activeId === item.id || (item.id === 'macro' && activeId === 'events');
                  const isLocked = !canAccessWorkspace(userRole, item.id).allowed;
                  return (
                    <button
                      key={item.id}
                      onClick={() => handleItemClick(item.id)}
                      aria-current={isActive ? 'page' : undefined}
                      title={isCollapsed ? item.label : undefined}
                      className={`w-full flex items-center gap-2.5 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-all text-left group cursor-pointer focus-visible:outline-2 focus-visible:outline-amber-400 ${
                        isActive
                          ? 'bg-amber-500/20 text-amber-300 font-bold border border-amber-500/40 shadow-xs'
                          : isLocked
                          ? 'text-slate-500 hover:text-slate-300 hover:bg-slate-800/40 border border-transparent'
                          : 'text-slate-400 hover:text-slate-100 hover:bg-slate-800/60 border border-transparent'
                      } ${isCollapsed ? 'justify-center px-1' : ''}`}
                    >
                      <Icon
                        className={`w-4 h-4 shrink-0 transition-colors ${
                          isActive
                            ? 'text-amber-400'
                            : isLocked
                            ? 'text-slate-600 group-hover:text-slate-400'
                            : 'text-slate-500 group-hover:text-slate-300'
                        }`}
                      />
                      {!isCollapsed && (
                        <span className="truncate flex-1">{item.label}</span>
                      )}
                      {!isCollapsed && isLocked && (
                        <Lock className="w-3 h-3 text-slate-600 shrink-0" aria-hidden="true" />
                      )}
                      {!isCollapsed && item.id === 'portfolio' && openPositionsCount > 0 && (
                        <span className="text-[9px] font-mono font-bold px-1.5 py-0.2 rounded border bg-emerald-500/15 text-emerald-300 border-emerald-500/30 tabular-nums shrink-0">
                          {openPositionsCount} Open
                        </span>
                      )}
                      {!isCollapsed && item.badge && (
                        <span
                          className={`text-[9px] font-mono font-bold px-1.5 py-0.2 rounded border shrink-0 ${
                            item.badge === 'ALPHA'
                              ? 'bg-purple-500/20 text-purple-300 border-purple-500/30'
                              : item.badge === 'PRO' || item.badge === 'VIP'
                              ? 'bg-amber-500/20 text-amber-300 border-amber-500/30'
                              : 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30'
                          }`}
                        >
                          {item.badge}
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          );
        })}
        {!isCollapsed && visibleItems.length === 0 && (
          <div className="px-2 py-4 text-center text-[11px] font-mono text-slate-500">
            No matching workspace
          </div>
        )}
      </nav>

      {/* Collapsible Sidebar Section: Chronological Strategy Alert Feed */}
      {!isCollapsed && (
        <section
          aria-label="Sidebar Strategy Alert Feed"
          className="border-t border-slate-800/80 bg-slate-950/50 shrink-0"
        >
          <button
            type="button"
            aria-expanded={isAlertFeedExpanded}
            onClick={() => setIsAlertFeedExpanded((prev) => !prev)}
            className="w-full px-3 py-2 flex items-center justify-between gap-2 text-left hover:bg-slate-900/80 transition-colors cursor-pointer"
          >
            <span className="flex items-center gap-1.5 min-w-0">
              <BellRing className="w-3.5 h-3.5 text-amber-400 shrink-0" aria-hidden="true" />
              <span className="text-[11px] font-mono font-bold uppercase tracking-wider text-slate-300 truncate">
                Strategy Alert Feed
              </span>
            </span>
            <span className="flex items-center gap-1.5 shrink-0 font-mono text-[10px] text-slate-400 tabular-nums">
              <span>{strategyAlertFeed.length}</span>
              {isAlertFeedExpanded ? (
                <ChevronDown className="w-3.5 h-3.5 text-slate-500" aria-hidden="true" />
              ) : (
                <ChevronUp className="w-3.5 h-3.5 text-slate-500" aria-hidden="true" />
              )}
            </span>
          </button>

          {isAlertFeedExpanded && (
            <div className="border-t border-slate-800/60">
              {strategyAlertFeed.length === 0 ? (
                <p className="px-3 py-2.5 text-[11px] text-slate-500">
                  No strategy alerts logged yet.
                </p>
              ) : (
                <ul className="max-h-48 overflow-y-auto divide-y divide-slate-800/60 scrollbar-thin scrollbar-thumb-slate-800">
                  {strategyAlertFeed.slice(0, 6).map((entry) => {
                    const isBuy = entry.direction === 'BUY';
                    const shortTime =
                      entry.timestamp && entry.timestamp.length >= 16
                        ? `${entry.timestamp.slice(5, 10)} ${entry.timestamp.slice(11, 16)}`
                        : entry.timestamp;
                    return (
                      <li
                        key={entry.id}
                        className="px-3 py-2 hover:bg-slate-900/60 transition-colors space-y-1"
                      >
                        <div className="flex items-center justify-between gap-1.5 font-mono text-[10px] tabular-nums">
                          <span className="font-bold truncate">
                            <span className={isBuy ? 'text-emerald-400' : 'text-rose-400'}>
                              {entry.direction}
                            </span>{' '}
                            <span className="text-slate-200">{entry.instrumentId}</span>
                            <span className="text-slate-500"> · ${entry.triggerPrice.toFixed(2)}</span>
                          </span>
                          <span className="text-slate-500 shrink-0">{shortTime}</span>
                        </div>

                        <p className="text-[11px] text-slate-300 font-medium truncate">
                          {entry.strategyName}
                        </p>

                        <div className="flex items-center gap-1.5 pt-0.5">
                          <button
                            type="button"
                            onClick={() => {
                              onJumpToChartSetup?.(entry);
                              onCloseMobile?.();
                            }}
                            className="flex-1 inline-flex items-center justify-center gap-1 px-2 py-1 rounded border border-slate-800 bg-slate-900 hover:border-amber-500/50 hover:text-amber-300 text-[10px] font-mono text-slate-300 transition-colors whitespace-nowrap cursor-pointer"
                            title={`Jump to ${entry.instrumentId} ${entry.timeframe} chart setup`}
                          >
                            <CandlestickChart className="w-3 h-3 text-amber-400 shrink-0" aria-hidden="true" />
                            <span>Chart</span>
                          </button>

                          <button
                            type="button"
                            onClick={() => {
                              onJumpToPortfolioEntry?.(entry);
                              onCloseMobile?.();
                            }}
                            className={`flex-1 inline-flex items-center justify-center gap-1 px-2 py-1 rounded border text-[10px] font-mono transition-colors whitespace-nowrap cursor-pointer ${
                              entry.linkedPortfolioPositionId
                                ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-300 hover:bg-emerald-500/20'
                                : 'border-slate-800 bg-slate-900 text-slate-300 hover:border-sky-500/50 hover:text-sky-300'
                            }`}
                            title={
                              entry.linkedPortfolioPositionId
                                ? `Jump to portfolio entry ${entry.linkedPortfolioPositionId}`
                                : 'Open in Portfolio Journal'
                            }
                          >
                            <BookOpen className="w-3 h-3 shrink-0" aria-hidden="true" />
                            <span>
                              {entry.linkedPortfolioPositionId ? 'Position' : 'Portfolio'}
                            </span>
                          </button>
                        </div>
                      </li>
                    );
                  })}
                </ul>
              )}

              {onOpenFullAlertFeed && (
                <button
                  type="button"
                  onClick={() => {
                    onOpenFullAlertFeed();
                    onCloseMobile?.();
                  }}
                  className="w-full px-3 py-1.5 border-t border-slate-800/60 text-[10px] font-mono text-amber-400 hover:text-amber-300 hover:bg-slate-900/70 text-left transition-colors cursor-pointer"
                >
                  View Full Chronological Feed →
                </button>
              )}
            </div>
          )}
        </section>
      )}

      {/* Account & Session Footer (Desktop Sidebar + Mobile Slide-Over Drawer) */}
      {!isCollapsed ? (
        <div className="p-2.5 border-t border-slate-800/80 bg-slate-950/60 text-[11px] font-sans shrink-0 space-y-2">
          <div className="flex items-center justify-between text-[10px] font-mono text-slate-400">
            <span className="flex items-center gap-1.5 text-emerald-400 font-semibold">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
              Live COMEX
            </span>
            <span className="text-slate-300 font-bold uppercase">{userRole}</span>
          </div>

          {userRole === 'GUEST' ? (
            onOpenAuth && (
              <div className="grid grid-cols-2 gap-1.5">
                <button
                  type="button"
                  onClick={() => {
                    onCloseMobile?.();
                    onOpenAuth('LOGIN');
                  }}
                  className="min-h-[40px] flex items-center justify-center gap-1 px-2 py-1.5 rounded-lg border border-slate-700 bg-slate-900 hover:bg-slate-800 text-slate-200 font-medium text-xs transition-colors whitespace-nowrap cursor-pointer"
                >
                  <LogIn className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                  <span>Sign In</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    onCloseMobile?.();
                    onOpenAuth('ENROLL');
                  }}
                  className="min-h-[40px] flex items-center justify-center gap-1 px-2 py-1.5 rounded-lg bg-gradient-to-r from-amber-500 to-amber-400 hover:from-amber-400 hover:to-amber-300 text-slate-950 font-bold text-xs transition-all whitespace-nowrap cursor-pointer"
                >
                  <UserPlus className="w-3.5 h-3.5 shrink-0" />
                  <span>Sign Up</span>
                </button>
              </div>
            )
          ) : (
            <div className="space-y-1.5">
              {userSession && (
                <div className="flex items-center gap-2 px-2 py-1.5 rounded-lg bg-slate-900/80 border border-slate-800/80">
                  <div className="w-6 h-6 rounded-full bg-amber-500/20 border border-amber-500/40 text-amber-400 flex items-center justify-center text-[10px] font-bold shrink-0">
                    {userSession.displayName.charAt(0).toUpperCase()}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-[11px] font-semibold text-slate-100 truncate">
                      {userSession.displayName}
                    </p>
                    <p className="text-[10px] font-mono text-slate-400 truncate">
                      {userSession.email}
                    </p>
                  </div>
                </div>
              )}
              {onLogout && (
                <button
                  type="button"
                  onClick={() => {
                    onCloseMobile?.();
                    onLogout();
                  }}
                  className="w-full min-h-[40px] flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg border border-rose-500/30 bg-rose-500/10 hover:bg-rose-500/20 text-rose-300 hover:text-rose-200 font-semibold text-xs transition-colors whitespace-nowrap cursor-pointer"
                >
                  <LogOut className="w-3.5 h-3.5 shrink-0" />
                  <span>Sign Out</span>
                </button>
              )}
            </div>
          )}
        </div>
      ) : (
        <div className="p-2 border-t border-slate-800/80 bg-slate-950/60 flex flex-col items-center gap-1.5 shrink-0">
          {onOpenFullAlertFeed && (
            <button
              type="button"
              onClick={onOpenFullAlertFeed}
              aria-label="Open Strategy Alert Feed"
              title={`Strategy Alert Feed (${strategyAlertFeed.length})`}
              className="p-2 rounded-lg text-amber-400 hover:bg-slate-800 transition-colors cursor-pointer"
            >
              <BellRing className="w-4 h-4" />
            </button>
          )}
          {userRole === 'GUEST' ? (
            onOpenAuth && (
              <button
                type="button"
                onClick={() => onOpenAuth('ENROLL')}
                aria-label="Sign Up or Sign In"
                title="Sign Up / Sign In"
                className="p-2 rounded-lg text-amber-400 hover:bg-slate-800 transition-colors cursor-pointer"
              >
                <UserPlus className="w-4 h-4" />
              </button>
            )
          ) : (
            onLogout && (
              <button
                type="button"
                onClick={onLogout}
                aria-label="Sign Out"
                title="Sign Out"
                className="p-2 rounded-lg text-rose-400 hover:bg-rose-500/10 transition-colors cursor-pointer"
              >
                <LogOut className="w-4 h-4" />
              </button>
            )
          )}
        </div>
      )}
    </div>
  );

  return (
    <>
      {/* 1. Desktop Persistent Sidebar (Collapsible Rail or Full Width) */}
      <aside
        className={`hidden md:flex flex-col shrink-0 transition-all duration-200 ease-in-out h-full ${
          isCollapsed ? 'w-14 sm:w-16' : 'w-56 lg:w-60'
        }`}
      >
        {sidebarContent}
      </aside>

      {/* 2. Mobile Slide-Over Drawer with Backdrop */}
      {isOpenMobile && (
        <div className="fixed inset-0 z-50 md:hidden flex">
          {/* Backdrop overlay */}
          <div
            className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm transition-opacity"
            onClick={onCloseMobile}
          />

          {/* Drawer panel */}
          <div className="relative w-72 max-w-[85vw] h-full shadow-2xl flex flex-col z-10 animate-in slide-in-from-left duration-200">
            {sidebarContent}
          </div>
        </div>
      )}
    </>
  );
};
