/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * Aurum Intelligence — Quick Jump Command Palette (Ctrl+K / Cmd+K)
 *
 * Provides keyboard-first and touch-friendly search across all workspaces,
 * commodities (GOLD, SILVER, WTI_OIL, BRENT_OIL), and Portfolio Journal sub-views.
 */

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ArrowRight, Lock, Search, X } from 'lucide-react';
import { CommodityType } from '../domain/types';
import { UserRole, canAccessWorkspace } from '../services/authService';
import { NAV_ITEMS, WorkspaceId } from './Sidebar';

export type PortfolioSubTabId =
  | 'journal'
  | 'historicalPlans'
  | 'scanner'
  | 'margin'
  | 'physicalDca';

export interface CommandPaletteEntry {
  id: string;
  kind: 'WORKSPACE' | 'COMMODITY' | 'PORTFOLIO_TAB';
  label: string;
  subtitle: string;
  keywords: string;
  workspaceId?: WorkspaceId;
  commodity?: CommodityType;
  portfolioTab?: PortfolioSubTabId;
  badge?: string;
  locked?: boolean;
}

export function buildCommandPaletteEntries(userRole: UserRole): CommandPaletteEntry[] {
  const workspaceEntries: CommandPaletteEntry[] = NAV_ITEMS.map((item) => {
    const access = canAccessWorkspace(userRole, item.id);
    return {
      id: `ws:${item.id}`,
      kind: 'WORKSPACE',
      label: item.label,
      subtitle:
        item.section === 'CORE'
          ? 'Core Terminal'
          : item.section === 'HORIZONS'
          ? 'Horizon Advisors'
          : item.section === 'QUANT_MACRO'
          ? 'Quant & Macro Lab'
          : 'Operations & Governance',
      keywords: `${item.id} ${item.label} ${item.section} ${item.badge || ''}`.toLowerCase(),
      workspaceId: item.id,
      badge: item.badge,
      locked: !access.allowed,
    };
  });

  const commodityEntries: CommandPaletteEntry[] = [
    {
      id: 'cmd:GOLD',
      kind: 'COMMODITY',
      label: 'Switch Active Commodity: Gold (XAU/USD)',
      subtitle: 'COMEX Spot & Futures Benchmark ($/oz)',
      keywords: 'gold xau xauusd bullion spot commodity',
      commodity: 'GOLD',
      badge: 'XAU',
    },
    {
      id: 'cmd:SILVER',
      kind: 'COMMODITY',
      label: 'Switch Active Commodity: Silver (XAG/USD)',
      subtitle: 'Precious & Industrial Metal ($/oz)',
      keywords: 'silver xag xagusd metal commodity',
      commodity: 'SILVER',
      badge: 'XAG',
    },
    {
      id: 'cmd:WTI_OIL',
      kind: 'COMMODITY',
      label: 'Switch Active Commodity: WTI Crude Oil (CL)',
      subtitle: 'NYMEX Energy Futures ($/bbl)',
      keywords: 'wti crude oil cl energy commodity',
      commodity: 'WTI_OIL',
      badge: 'WTI',
    },
    {
      id: 'cmd:BRENT_OIL',
      kind: 'COMMODITY',
      label: 'Switch Active Commodity: Brent Crude Oil (BZ)',
      subtitle: 'ICE Global Benchmark ($/bbl)',
      keywords: 'brent crude oil bz energy commodity',
      commodity: 'BRENT_OIL',
      badge: 'BZ',
    },
  ];

  const portfolioTabEntries: CommandPaletteEntry[] = [
    {
      id: 'ptab:historicalPlans',
      kind: 'PORTFOLIO_TAB',
      label: 'Historical Trade Plan Performance',
      subtitle: 'Portfolio & Journal -> Past Signals vs Live Spot Outcomes',
      keywords: 'historical trade plan performance outcomes scorecard win rate live price',
      workspaceId: 'portfolio',
      portfolioTab: 'historicalPlans',
      badge: 'TAB',
      locked: !canAccessWorkspace(userRole, 'portfolio').allowed,
    },
    {
      id: 'ptab:journal',
      kind: 'PORTFOLIO_TAB',
      label: 'Auto-Paper Pilot & Equity Curves (ROI / P&L)',
      subtitle: 'Portfolio & Journal -> Execution, Daily P&L, Daily ROI, SL Heatmap',
      keywords: 'auto paper pilot autonomous trading roi pnl daily heatmap stop loss',
      workspaceId: 'portfolio',
      portfolioTab: 'journal',
      badge: 'TAB',
      locked: !canAccessWorkspace(userRole, 'portfolio').allowed,
    },
    {
      id: 'ptab:scanner',
      kind: 'PORTFOLIO_TAB',
      label: 'Multi-Commodity Opportunity Scanner',
      subtitle: 'Portfolio & Journal -> Cross-Asset Priority Setups',
      keywords: 'scanner multi commodity radar priority setup',
      workspaceId: 'portfolio',
      portfolioTab: 'scanner',
      badge: 'TAB',
      locked: !canAccessWorkspace(userRole, 'portfolio').allowed,
    },
    {
      id: 'ptab:margin',
      kind: 'PORTFOLIO_TAB',
      label: 'Margin & Macro Stress Heat-Map',
      subtitle: 'Portfolio & Journal -> VaR, Leverage & Shock Scenarios',
      keywords: 'margin stress heatmap var leverage risk',
      workspaceId: 'portfolio',
      portfolioTab: 'margin',
      badge: 'TAB',
      locked: !canAccessWorkspace(userRole, 'portfolio').allowed,
    },
    {
      id: 'ptab:physicalDca',
      kind: 'PORTFOLIO_TAB',
      label: 'Physical Bullion DCA Model',
      subtitle: 'Portfolio & Journal -> Vault Allocation & Projection',
      keywords: 'physical bullion dca gold vault accumulation',
      workspaceId: 'portfolio',
      portfolioTab: 'physicalDca',
      badge: 'TAB',
      locked: !canAccessWorkspace(userRole, 'portfolio').allowed,
    },
  ];

  return [...portfolioTabEntries, ...workspaceEntries, ...commodityEntries];
}

export function filterCommandPaletteEntries(
  entries: CommandPaletteEntry[],
  rawQuery: string
): CommandPaletteEntry[] {
  const q = rawQuery.trim().toLowerCase();
  if (!q) return entries;
  const tokens = q.split(/\s+/).filter(Boolean);
  return entries.filter((entry) => {
    const haystack = `${entry.label} ${entry.subtitle} ${entry.keywords}`.toLowerCase();
    return tokens.every((tok) => haystack.includes(tok));
  });
}

interface CommandPaletteModalProps {
  isOpen: boolean;
  onClose: () => void;
  userRole: UserRole;
  onSelectWorkspace: (id: WorkspaceId) => void;
  onSelectCommodity: (c: CommodityType) => void;
  onSelectPortfolioTab: (tab: PortfolioSubTabId) => void;
}

export const CommandPaletteModal: React.FC<CommandPaletteModalProps> = ({
  isOpen,
  onClose,
  userRole,
  onSelectWorkspace,
  onSelectCommodity,
  onSelectPortfolioTab,
}) => {
  const [query, setQuery] = useState('');
  const [activeIndex, setActiveIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  const allEntries = useMemo(() => buildCommandPaletteEntries(userRole), [userRole]);
  const filteredEntries = useMemo(
    () => filterCommandPaletteEntries(allEntries, query),
    [allEntries, query]
  );

  useEffect(() => {
    if (isOpen) {
      setQuery('');
      setActiveIndex(0);
      setTimeout(() => inputRef.current?.focus(), 10);
    }
  }, [isOpen]);

  useEffect(() => {
    if (activeIndex >= filteredEntries.length) {
      setActiveIndex(0);
    }
  }, [filteredEntries.length, activeIndex]);

  useEffect(() => {
    if (!isOpen) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
      } else if (e.key === 'ArrowDown') {
        e.preventDefault();
        setActiveIndex((prev) =>
          filteredEntries.length === 0 ? 0 : (prev + 1) % filteredEntries.length
        );
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setActiveIndex((prev) =>
          filteredEntries.length === 0
            ? 0
            : (prev - 1 + filteredEntries.length) % filteredEntries.length
        );
      } else if (e.key === 'Enter' && filteredEntries[activeIndex]) {
        e.preventDefault();
        executeEntry(filteredEntries[activeIndex]);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  });

  if (!isOpen) return null;

  const executeEntry = (entry: CommandPaletteEntry) => {
    if (entry.kind === 'COMMODITY' && entry.commodity) {
      onSelectCommodity(entry.commodity);
    } else if (entry.kind === 'PORTFOLIO_TAB' && entry.portfolioTab) {
      onSelectPortfolioTab(entry.portfolioTab);
    } else if (entry.workspaceId) {
      onSelectWorkspace(entry.workspaceId);
    }
    onClose();
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center pt-[10vh] px-3 sm:px-4 bg-slate-950/80 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-labelledby="command-palette-title"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="w-full max-w-xl bg-slate-900 border border-slate-700 rounded-xl shadow-2xl overflow-hidden">
        <div className="flex items-center gap-2.5 px-4 py-3 border-b border-slate-800">
          <Search className="w-4 h-4 text-amber-400 shrink-0" aria-hidden="true" />
          <h2 id="command-palette-title" className="sr-only">
            Quick Jump Workspaces &amp; Commodities
          </h2>
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setActiveIndex(0);
            }}
            placeholder="Jump to workspace, tool, Portfolio tab, or commodity (e.g. ROI, Historical, Silver)..."
            aria-label="Search workspaces and commodities"
            className="flex-1 bg-transparent text-sm text-slate-100 placeholder:text-slate-500 focus:outline-none"
          />
          <button
            type="button"
            onClick={onClose}
            aria-label="Close Quick Jump"
            className="p-1.5 rounded-md text-slate-400 hover:text-slate-100 hover:bg-slate-800 transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="max-h-[58vh] overflow-y-auto divide-y divide-slate-800/60">
          {filteredEntries.length === 0 ? (
            <div className="p-6 text-center text-xs font-mono text-slate-400">
              No workspaces, Portfolio modules, or commodities match &ldquo;{query}&rdquo;.
            </div>
          ) : (
            filteredEntries.map((entry, idx) => {
              const isSelected = idx === activeIndex;
              return (
                <button
                  key={entry.id}
                  type="button"
                  onMouseEnter={() => setActiveIndex(idx)}
                  onClick={() => executeEntry(entry)}
                  className={`w-full px-4 py-2.5 flex items-center justify-between gap-3 text-left transition-colors cursor-pointer ${
                    isSelected ? 'bg-amber-500/15 text-slate-100' : 'hover:bg-slate-800/60 text-slate-300'
                  }`}
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-semibold text-slate-100 truncate">
                        {entry.label}
                      </span>
                      {entry.badge && (
                        <span className="text-[10px] font-mono font-bold px-1.5 py-0.5 rounded bg-slate-800 text-amber-300 border border-slate-700 shrink-0">
                          {entry.badge}
                        </span>
                      )}
                      {entry.locked && (
                        <Lock
                          className="w-3 h-3 text-slate-400 shrink-0"
                          aria-label="Requires higher tier"
                        />
                      )}
                    </div>
                    <span className="text-[11px] font-mono text-slate-400 block truncate mt-0.5">
                      {entry.subtitle}
                    </span>
                  </div>
                  <ArrowRight
                    className={`w-3.5 h-3.5 shrink-0 ${
                      isSelected ? 'text-amber-400' : 'text-slate-500'
                    }`}
                    aria-hidden="true"
                  />
                </button>
              );
            })
          )}
        </div>

        <div className="px-4 py-2 border-t border-slate-800 bg-slate-950/70 flex flex-wrap items-center justify-between gap-2 text-[11px] font-mono text-slate-400">
          <span>↑↓ Navigate · Enter Open · Esc Close</span>
          <span className="tabular-nums">{filteredEntries.length} destinations</span>
        </div>
      </div>
    </div>
  );
};
