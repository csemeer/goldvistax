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

import React from 'react';
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
} from 'lucide-react';

import { UserRole, WORKSPACE_TIER_REQUIREMENTS } from '../services/authService';

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
  { id: 'macro', label: 'Macro Intelligence', icon: Landmark, section: 'QUANT_MACRO' },
  { id: 'events', label: 'Historical Events', icon: History, section: 'QUANT_MACRO' },
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
}

export const Sidebar: React.FC<SidebarProps> = ({
  activeId,
  onSelect,
  isCollapsed = false,
  onToggleCollapse,
  isOpenMobile = false,
  onCloseMobile,
  userRole = 'PRO',
}) => {
  const sections = [
    { title: 'Core Terminal', key: 'CORE' },
    { title: 'Horizon Advisors', key: 'HORIZONS' },
    { title: 'Quant & Macro Lab', key: 'QUANT_MACRO' },
    { title: 'Operations & Governance', key: 'OPERATIONS' },
  ];

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

      {/* Nav Items List */}
      <nav aria-label="Workspace Navigation" className="flex-1 overflow-y-auto p-2 space-y-3.5 scrollbar-thin scrollbar-thumb-slate-800">
        {sections.map((sec) => (
          <div key={sec.key}>
            {!isCollapsed && (
              <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-slate-500 px-2 block mb-1">
                {sec.title}
              </span>
            )}
            <div className="space-y-0.5">
              {NAV_ITEMS.filter((item) => item.section === sec.key).map((item) => {
                const Icon = item.icon;
                const isActive = activeId === item.id;
                return (
                  <button
                    key={item.id}
                    onClick={() => handleItemClick(item.id)}
                    aria-current={isActive ? 'page' : undefined}
                    title={isCollapsed ? item.label : undefined}
                    className={`w-full flex items-center gap-2.5 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-all text-left group cursor-pointer focus-visible:outline-2 focus-visible:outline-amber-400 ${
                      isActive
                        ? 'bg-amber-500/20 text-amber-300 font-bold border border-amber-500/40 shadow-xs'
                        : 'text-slate-400 hover:text-slate-100 hover:bg-slate-800/60 border border-transparent'
                    } ${isCollapsed ? 'justify-center px-1' : ''}`}
                  >
                    <Icon
                      className={`w-4 h-4 shrink-0 transition-colors ${
                        isActive
                          ? 'text-amber-400'
                          : 'text-slate-500 group-hover:text-slate-300'
                      }`}
                    />
                    {!isCollapsed && (
                      <span className="truncate flex-1">{item.label}</span>
                    )}
                    {!isCollapsed && item.badge && (
                      <span
                        className={`text-[9px] font-mono font-bold px-1.5 py-0.2 rounded border ${
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
        ))}
      </nav>

      {/* Footer Info / Status */}
      {!isCollapsed && (
        <div className="p-2.5 border-t border-slate-800/80 bg-slate-950/40 text-[10px] font-mono text-slate-500 shrink-0">
          <div className="flex items-center justify-between text-slate-400">
            <span>Feed Protocol</span>
            <span className="text-emerald-400 font-semibold flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
              Live COMEX
            </span>
          </div>
          <div className="flex items-center justify-between text-slate-500 mt-1">
            <span>Terminal</span>
            <span>v1.2 Pro Fit</span>
          </div>
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
