/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * Aurum Intelligence — Chronological Strategy Alert Feed Dashboard Widget
 *
 * Renders a chronological, feed-style stream of live-triggered, active, and historical
 * quantitative strategy alerts with one-click deep links to the corresponding chart setup
 * or portfolio journal entry.
 */

import React, { useMemo, useState } from 'react';
import {
  BellRing,
  BookOpen,
  CandlestickChart,
  Clock,
  FlaskConical,
  Search,
  Trash2,
} from 'lucide-react';
import { InstrumentId } from '../domain/types';
import {
  StrategyAlertFeedEntry,
  StrategyAlertOrigin,
} from '../services/strategyEngine';

export interface StrategyAlertFeedWidgetProps {
  entries: StrategyAlertFeedEntry[];
  onJumpToChartSetup: (entry: StrategyAlertFeedEntry) => void;
  onJumpToPortfolioEntry: (entry: StrategyAlertFeedEntry) => void;
  onOpenStrategyLab?: (strategyId: string) => void;
  onClearLiveHistory?: () => void;
  activeInstrumentId?: InstrumentId;
  maxVisibleItems?: number;
}

type FeedScopeFilter = 'ALL' | 'RECENT' | 'HISTORICAL';

const ORIGIN_LABEL: Record<StrategyAlertOrigin, string> = {
  LIVE_TRIGGER: 'Live Alert',
  ACTIVE_SIGNAL: 'Active Setup',
  HISTORICAL_BACKTEST: 'Historical Signal',
  AUDITED_BASELINE: 'Audited Baseline',
};

function formatFeedTimestamp(iso: string): string {
  const ms = Date.parse(iso);
  if (!Number.isFinite(ms)) return iso || '—';
  const d = new Date(ms);
  const yyyy = d.getUTCFullYear();
  const mm = String(d.getUTCMonth() + 1).padStart(2, '0');
  const dd = String(d.getUTCDate()).padStart(2, '0');
  const hh = String(d.getUTCHours()).padStart(2, '0');
  const min = String(d.getUTCMinutes()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd} ${hh}:${min} UTC`;
}

function formatOutcomeLabel(outcome?: string): string | null {
  if (!outcome) return null;
  switch (outcome) {
    case 'LIVE_DISPATCHED':
      return 'Push Dispatched';
    case 'CRITERIA_MATCHED':
      return 'Entry Matched';
    case 'SIGNAL_ACTIVE':
      return 'Signal Active';
    case 'TARGET1_REACHED':
      return 'Target 1 Reached';
    case 'TARGET2_REACHED':
      return 'Target 2 Reached';
    case 'TARGET_HIT':
      return 'Target Hit';
    case 'STOP_LOSS_HIT':
    case 'STOP':
      return 'Stop Hit';
    default:
      return outcome.replace(/_/g, ' ');
  }
}

export const StrategyAlertFeedWidget: React.FC<StrategyAlertFeedWidgetProps> = ({
  entries,
  onJumpToChartSetup,
  onJumpToPortfolioEntry,
  onOpenStrategyLab,
  onClearLiveHistory,
  activeInstrumentId,
  maxVisibleItems = 20,
}) => {
  const [scopeFilter, setScopeFilter] = useState<FeedScopeFilter>('ALL');
  const [instrumentFilter, setInstrumentFilter] = useState<'ALL' | InstrumentId>('ALL');
  const [searchQuery, setSearchQuery] = useState<string>('');

  const recentCount = useMemo(
    () =>
      entries.filter(
        (e) => e.isRecent || e.origin === 'LIVE_TRIGGER' || e.origin === 'ACTIVE_SIGNAL'
      ).length,
    [entries]
  );

  const historicalCount = useMemo(
    () =>
      entries.filter(
        (e) => e.origin === 'HISTORICAL_BACKTEST' || e.origin === 'AUDITED_BASELINE'
      ).length,
    [entries]
  );

  const liveTriggeredCount = useMemo(
    () => entries.filter((e) => e.origin === 'LIVE_TRIGGER').length,
    [entries]
  );

  const availableInstruments = useMemo(() => {
    const set = new Set<InstrumentId>();
    for (const item of entries) set.add(item.instrumentId);
    return Array.from(set);
  }, [entries]);

  const filteredEntries = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return entries
      .filter((item) => {
        if (scopeFilter === 'RECENT') {
          return (
            item.isRecent ||
            item.origin === 'LIVE_TRIGGER' ||
            item.origin === 'ACTIVE_SIGNAL'
          );
        }
        if (scopeFilter === 'HISTORICAL') {
          return (
            item.origin === 'HISTORICAL_BACKTEST' ||
            item.origin === 'AUDITED_BASELINE'
          );
        }
        return true;
      })
      .filter((item) =>
        instrumentFilter === 'ALL' ? true : item.instrumentId === instrumentFilter
      )
      .filter((item) => {
        if (!q) return true;
        const haystack =
          `${item.strategyName} ${item.strategyId} ${item.instrumentId} ${item.direction} ${item.horizon} ${item.summary} ${item.linkedPortfolioPositionId || ''}`.toLowerCase();
        return haystack.includes(q);
      })
      .slice(0, maxVisibleItems);
  }, [entries, scopeFilter, instrumentFilter, searchQuery, maxVisibleItems]);

  const hasActiveFilters =
    scopeFilter !== 'ALL' || instrumentFilter !== 'ALL' || searchQuery.trim().length > 0;

  return (
    <section
      id="strategy-alert-feed-widget"
      aria-label="Chronological Strategy Alert Feed"
      className="bg-slate-900 border border-slate-800 rounded-lg overflow-hidden"
    >
      {/* Widget Header & Segmented Filters */}
      <div className="p-4 sm:p-5 border-b border-slate-800 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <BellRing className="w-4 h-4 text-amber-400 shrink-0" aria-hidden="true" />
            <h2 className="text-base sm:text-lg font-bold text-slate-100 tracking-tight">
              Chronological Strategy Alert Feed
            </h2>
          </div>
          <div className="flex flex-wrap items-center gap-2 text-xs text-slate-400 mt-1 tabular-nums">
            <span>{entries.length} Total Alerts</span>
            <span aria-hidden="true">·</span>
            <span>{recentCount} Recent &amp; Active</span>
            <span aria-hidden="true">·</span>
            <span>{historicalCount} Historical</span>
            {activeInstrumentId && (
              <>
                <span aria-hidden="true">·</span>
                <span>Terminal Focus: {activeInstrumentId}</span>
              </>
            )}
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Segmented Scope Filter */}
          <div
            role="group"
            aria-label="Alert timeframe scope"
            className="inline-flex items-center p-1 bg-slate-950 border border-slate-800 rounded-lg text-xs"
          >
            {(
              [
                { id: 'ALL', label: 'All' },
                { id: 'RECENT', label: 'Recent / Live' },
                { id: 'HISTORICAL', label: 'Historical' },
              ] as { id: FeedScopeFilter; label: string }[]
            ).map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setScopeFilter(tab.id)}
                className={`px-3 py-1.5 rounded-md font-medium transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                  scopeFilter === tab.id
                    ? 'bg-slate-800 text-amber-300'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* Instrument Filter */}
          <select
            value={instrumentFilter}
            onChange={(e) =>
              setInstrumentFilter(e.target.value as 'ALL' | InstrumentId)
            }
            aria-label="Filter strategy alerts by instrument"
            className="bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs font-mono text-slate-200 focus:outline-none focus:border-amber-500/60"
          >
            <option value="ALL">All Instruments</option>
            {availableInstruments.map((inst) => (
              <option key={inst} value={inst}>
                {inst}
              </option>
            ))}
          </select>

          {/* Search Input */}
          <div className="relative flex items-center">
            <Search
              className="w-3.5 h-3.5 text-slate-500 absolute left-2.5 pointer-events-none"
              aria-hidden="true"
            />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search strategy or symbol..."
              aria-label="Search strategy alerts"
              className="w-44 sm:w-52 bg-slate-950 border border-slate-800 rounded-lg pl-8 pr-3 py-2 text-xs text-slate-200 placeholder:text-slate-500 focus:outline-none focus:border-amber-500/60"
            />
          </div>

          {liveTriggeredCount > 0 && onClearLiveHistory && (
            <button
              type="button"
              onClick={onClearLiveHistory}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-slate-800 bg-slate-950 hover:bg-slate-800 text-xs font-medium text-slate-300 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
              title="Clear session live push notifications"
            >
              <Trash2 className="w-3.5 h-3.5 text-slate-400" aria-hidden="true" />
              <span>Clear Live ({liveTriggeredCount})</span>
            </button>
          )}
        </div>
      </div>

      {/* Feed Stream */}
      {filteredEntries.length === 0 ? (
        <div className="p-8 text-center space-y-3">
          <p className="text-sm font-semibold text-slate-200">
            No strategy alerts match the active filters
          </p>
          <p className="text-xs text-slate-400 max-w-md mx-auto">
            {hasActiveFilters
              ? 'Adjust your scope, instrument filter, or search query to inspect chronological signals.'
              : 'Subscribe to quantitative models in Strategy Lab or refresh market candles to populate live and historical alert streams.'}
          </p>
          <div className="flex items-center justify-center gap-2 pt-1">
            {hasActiveFilters && (
              <button
                type="button"
                onClick={() => {
                  setScopeFilter('ALL');
                  setInstrumentFilter('ALL');
                  setSearchQuery('');
                }}
                className="px-4 py-2 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-bold transition-colors whitespace-nowrap shrink-0 cursor-pointer"
              >
                Reset Filters
              </button>
            )}
            {onOpenStrategyLab && (
              <button
                type="button"
                onClick={() => onOpenStrategyLab('STRAT-01-MACRO-TREND')}
                className="px-4 py-2 rounded-lg border border-slate-700 bg-slate-950 hover:bg-slate-800 text-slate-200 text-xs font-medium transition-colors whitespace-nowrap shrink-0 cursor-pointer"
              >
                Open Strategy Lab
              </button>
            )}
          </div>
        </div>
      ) : (
        <ul
          aria-label="Strategy Alert Chronological Timeline"
          className="divide-y divide-slate-800/80 max-h-[460px] overflow-y-auto"
        >
          {filteredEntries.map((item) => {
            const isBuy = item.direction === 'BUY';
            const outcomeText = formatOutcomeLabel(item.outcomeLabel);
            const hasPortfolioLink = Boolean(item.linkedPortfolioPositionId);

            return (
              <li
                key={item.id}
                className="p-4 hover:bg-slate-950/60 transition-colors flex flex-col xl:flex-row xl:items-center justify-between gap-3"
              >
                {/* Left Chronological Details */}
                <div className="min-w-0 flex-1 space-y-1.5">
                  {/* Quiet Unboxed Metadata Line */}
                  <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-slate-400 font-mono tabular-nums">
                    <span className="inline-flex items-center gap-1 text-slate-300">
                      <Clock className="w-3 h-3 text-slate-500 shrink-0" aria-hidden="true" />
                      {formatFeedTimestamp(item.timestamp)}
                    </span>
                    <span aria-hidden="true">·</span>
                    <span
                      className={
                        item.origin === 'LIVE_TRIGGER'
                          ? 'text-amber-300 font-semibold'
                          : item.origin === 'ACTIVE_SIGNAL'
                          ? 'text-sky-300 font-semibold'
                          : 'text-slate-400'
                      }
                    >
                      {ORIGIN_LABEL[item.origin]}
                    </span>
                    <span aria-hidden="true">·</span>
                    <span>
                      {item.horizon} ({item.timeframe})
                    </span>
                    {outcomeText && (
                      <>
                        <span aria-hidden="true">·</span>
                        <span
                          className={
                            outcomeText.includes('Stop')
                              ? 'text-rose-400'
                              : outcomeText.includes('Target') || outcomeText.includes('Push')
                              ? 'text-emerald-400'
                              : 'text-slate-300'
                          }
                        >
                          {outcomeText}
                        </span>
                      </>
                    )}
                    {hasPortfolioLink && item.linkedPortfolioPositionId && (
                      <>
                        <span aria-hidden="true">·</span>
                        <span className="text-emerald-300 font-semibold">
                          Portfolio {item.linkedPortfolioPositionId}
                          {typeof item.linkedPortfolioPnlUsd === 'number'
                            ? ` (${item.linkedPortfolioPnlUsd >= 0 ? '+' : '-'}$${Math.abs(
                                item.linkedPortfolioPnlUsd
                              ).toFixed(0)})`
                            : ''}
                        </span>
                      </>
                    )}
                  </div>

                  {/* Primary Headline & Trade Parameters */}
                  <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                    <span
                      className={`font-mono text-xs font-bold uppercase ${
                        isBuy ? 'text-emerald-400' : 'text-rose-400'
                      }`}
                    >
                      {item.direction} {item.instrumentId}
                    </span>
                    <h3 className="text-sm font-semibold text-slate-100 truncate">
                      {item.strategyName}
                    </h3>
                    <span className="font-mono text-xs text-slate-300 tabular-nums">
                      Entry ${item.triggerPrice.toFixed(2)} · SL ${item.stopLossPrice.toFixed(2)} · TP1 $
                      {item.target1Price.toFixed(2)} · 1:{item.rewardToRiskRatio} R:R
                    </span>
                  </div>

                  {/* Concise Summary */}
                  <p className="text-xs text-slate-400 leading-relaxed line-clamp-2">
                    {item.summary}
                  </p>
                </div>

                {/* Right Quick-Jump Controls */}
                <div className="flex flex-wrap sm:flex-nowrap items-center gap-2 shrink-0">
                  <button
                    type="button"
                    onClick={() => onJumpToChartSetup(item)}
                    className="min-h-[36px] inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-700 bg-slate-950 hover:bg-slate-800 hover:border-amber-500/50 text-xs font-medium text-slate-200 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                  >
                    <CandlestickChart className="w-3.5 h-3.5 text-amber-400 shrink-0" aria-hidden="true" />
                    <span>Chart Setup</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => onJumpToPortfolioEntry(item)}
                    className={`min-h-[36px] inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-medium transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                      hasPortfolioLink
                        ? 'border-emerald-500/40 bg-emerald-500/15 hover:bg-emerald-500/25 text-emerald-200'
                        : 'border-slate-700 bg-slate-950 hover:bg-slate-800 hover:border-sky-500/50 text-slate-200'
                    }`}
                  >
                    <BookOpen
                      className={`w-3.5 h-3.5 shrink-0 ${
                        hasPortfolioLink ? 'text-emerald-400' : 'text-sky-400'
                      }`}
                      aria-hidden="true"
                    />
                    <span>
                      {hasPortfolioLink
                        ? 'Portfolio Entry'
                        : item.linkedAuditedPlanId
                        ? 'Audited Record'
                        : 'Open in Portfolio'}
                    </span>
                  </button>

                  {onOpenStrategyLab && (
                    <button
                      type="button"
                      onClick={() => onOpenStrategyLab(item.strategyId)}
                      title={`Inspect ${item.strategyName} in Strategy Lab`}
                      aria-label={`Inspect ${item.strategyName} in Strategy Lab`}
                      className="min-h-[36px] inline-flex items-center justify-center px-2.5 py-1.5 rounded-lg border border-slate-800 bg-slate-950 hover:bg-slate-800 text-slate-400 hover:text-amber-300 transition-colors shrink-0 cursor-pointer"
                    >
                      <FlaskConical className="w-3.5 h-3.5" aria-hidden="true" />
                    </button>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
};
