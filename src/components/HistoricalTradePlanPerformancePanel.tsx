/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * Aurum Intelligence — Historical Trade Plan Performance & Live Price Comparison Ledger
 *
 * Displays past triggered trade plans alongside their realized Success/Failure outcome
 * and real-time comparison against live market quotes.
 */

import React, { useMemo, useState } from 'react';
import {
  HistoricalPlanOutcomeCategory,
  HistoricalTradePlanComparisonRow,
  HistoricalTradePlanPerformanceReport,
} from '../services/forecastScorecardEngine';
import {
  CheckCircle2,
  XCircle,
  Clock,
  AlertTriangle,
  RefreshCw,
  Search,
  ChevronDown,
  ChevronUp,
  ArrowUpRight,
  ArrowDownRight,
  ShieldCheck,
} from 'lucide-react';

interface HistoricalTradePlanPerformancePanelProps {
  report: HistoricalTradePlanPerformanceReport;
  isLoading?: boolean;
  syncError?: string | null;
  onRefreshLiveScorecard?: () => void;
}

type OutcomeFilter = 'ALL' | HistoricalPlanOutcomeCategory;
type HorizonFilter = 'ALL' | 'INTRADAY' | 'SWING' | 'LONG_TERM';
type SourceFilter = 'ALL' | 'FORECAST_LEDGER' | 'JOURNAL_EXECUTION';

export const HistoricalTradePlanPerformancePanel: React.FC<
  HistoricalTradePlanPerformancePanelProps
> = ({
  report,
  isLoading = false,
  syncError = null,
  onRefreshLiveScorecard,
}) => {
  const [outcomeFilter, setOutcomeFilter] = useState<OutcomeFilter>('ALL');
  const [horizonFilter, setHorizonFilter] = useState<HorizonFilter>('ALL');
  const [sourceFilter, setSourceFilter] = useState<SourceFilter>('ALL');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [expandedPlanKey, setExpandedPlanKey] = useState<string | null>(null);

  const filteredRows = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    return report.rows.filter((row) => {
      if (outcomeFilter !== 'ALL' && row.outcomeCategory !== outcomeFilter) {
        return false;
      }
      if (horizonFilter !== 'ALL') {
        const normalized =
          row.horizon === 'SHORT_TERM' || row.horizon === 'CFD' ? 'INTRADAY' : row.horizon;
        if (normalized !== horizonFilter) return false;
      }
      if (sourceFilter === 'FORECAST_LEDGER' && row.source === 'JOURNAL_EXECUTION') {
        return false;
      }
      if (sourceFilter === 'JOURNAL_EXECUTION' && row.source !== 'JOURNAL_EXECUTION') {
        return false;
      }
      if (query) {
        const haystack = `${row.planId} ${row.instrumentId} ${row.horizon} ${row.direction} ${row.outcomeLabel} ${row.notes}`.toLowerCase();
        if (!haystack.includes(query)) return false;
      }
      return true;
    });
  }, [report.rows, outcomeFilter, horizonFilter, sourceFilter, searchQuery]);

  const handleResetFilters = () => {
    setOutcomeFilter('ALL');
    setHorizonFilter('ALL');
    setSourceFilter('ALL');
    setSearchQuery('');
  };

  const renderOutcomeCell = (row: HistoricalTradePlanComparisonRow) => {
    if (row.outcomeCategory === 'SUCCESS') {
      return (
        <div className="space-y-0.5">
          <div className="inline-flex items-center gap-1.5 text-emerald-400 font-semibold">
            <CheckCircle2 className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
            <span>{row.outcomeLabel}</span>
          </div>
          <div className="text-[11px] font-mono text-emerald-300/90 tabular-nums">
            Realized {row.realizedRr !== null ? `+${row.realizedRr.toFixed(2)}R` : '—'} · Proj 1:
            {row.projectedRr.toFixed(2)}
          </div>
        </div>
      );
    }

    if (row.outcomeCategory === 'FAILURE') {
      return (
        <div className="space-y-0.5">
          <div className="inline-flex items-center gap-1.5 text-rose-400 font-semibold">
            <XCircle className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
            <span>{row.outcomeLabel}</span>
          </div>
          <div className="text-[11px] font-mono text-rose-300/90 tabular-nums">
            Realized {row.realizedRr !== null ? `${row.realizedRr.toFixed(2)}R` : '-1.00R'} · Proj 1:
            {row.projectedRr.toFixed(2)}
          </div>
        </div>
      );
    }

    if (row.outcomeCategory === 'INVALIDATED') {
      return (
        <div className="space-y-0.5">
          <div className="inline-flex items-center gap-1.5 text-slate-300 font-semibold">
            <AlertTriangle className="w-3.5 h-3.5 text-amber-400 shrink-0" aria-hidden="true" />
            <span>{row.outcomeLabel}</span>
          </div>
          <div className="text-[11px] font-mono text-slate-400 tabular-nums">
            Invalidated (0.00R) · Proj 1:{row.projectedRr.toFixed(2)}
          </div>
        </div>
      );
    }

    return (
      <div className="space-y-0.5">
        <div className="inline-flex items-center gap-1.5 text-amber-300 font-semibold">
          <Clock className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
          <span>{row.outcomeLabel}</span>
        </div>
        <div className="text-[11px] font-mono text-slate-400 tabular-nums">
          Open Setup · Proj 1:{row.projectedRr.toFixed(2)}
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-6">
      {/* Header & Top KPI Summary */}
      <section className="bg-slate-900 border border-slate-800 rounded-lg p-5 space-y-4">
        <div className="flex flex-wrap items-start justify-between gap-4 pb-4 border-b border-slate-800">
          <div>
            <h3 className="text-lg font-bold text-slate-100">
              Historical Trade Plan Performance
            </h3>
            <div className="flex flex-wrap items-center gap-2 text-xs text-slate-400 mt-1">
              <span>Past Triggered Setup Ledger</span>
              <span aria-hidden="true">·</span>
              <span>Eventual Outcome vs. Live Spot Prices</span>
              <span aria-hidden="true">·</span>
              <span className="font-mono tabular-nums text-slate-300">
                {report.totalCount} Plans Audited
              </span>
            </div>
          </div>

          {onRefreshLiveScorecard && (
            <button
              type="button"
              onClick={onRefreshLiveScorecard}
              disabled={isLoading}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-md bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-xs font-medium transition-colors whitespace-nowrap shrink-0 disabled:opacity-50 cursor-pointer"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
              <span>{isLoading ? 'Syncing Ledger...' : 'Refresh Live Comparison'}</span>
            </button>
          )}
        </div>

        {syncError && (
          <div
            role="alert"
            className="rounded border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-300 font-mono"
          >
            {syncError}
          </div>
        )}

        {/* 4-Column KPI Strip */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 text-xs font-mono">
          <div className="bg-slate-950/70 p-3.5 rounded border border-slate-800">
            <span className="text-slate-500 block text-[10px] uppercase">Resolved Win Rate</span>
            <span className="text-lg font-bold text-emerald-400 tabular-nums mt-0.5 block">
              {report.winRatePct.toFixed(1)}%
            </span>
            <span className="text-[11px] text-slate-400 block mt-0.5 tabular-nums">
              {report.successCount} Success · {report.failureCount} Failure ({report.resolvedCount} resolved)
            </span>
          </div>

          <div className="bg-slate-950/70 p-3.5 rounded border border-slate-800">
            <span className="text-slate-500 block text-[10px] uppercase">Realized vs. Projected R:R</span>
            <span
              className={`text-lg font-bold tabular-nums mt-0.5 block ${
                report.avgRealizedRr >= 0 ? 'text-slate-100' : 'text-rose-400'
              }`}
            >
              {report.avgRealizedRr >= 0 ? `+${report.avgRealizedRr.toFixed(2)}R` : `${report.avgRealizedRr.toFixed(2)}R`}
            </span>
            <span className="text-[11px] text-slate-400 block mt-0.5 tabular-nums">
              Mean Projected 1:{report.avgProjectedRr.toFixed(2)}
            </span>
          </div>

          <div className="bg-slate-950/70 p-3.5 rounded border border-slate-800">
            <span className="text-slate-500 block text-[10px] uppercase">Live Price Follow-Through</span>
            <span className="text-lg font-bold text-amber-400 tabular-nums mt-0.5 block">
              {report.favorableLiveFollowThroughCount} / {report.liveComparedCount}
            </span>
            <span className="text-[11px] text-slate-400 block mt-0.5 tabular-nums">
              Mean Directional Drift {report.avgDirectionalMoveVsLivePct >= 0 ? '+' : ''}
              {report.avgDirectionalMoveVsLivePct.toFixed(2)}%
            </span>
          </div>

          <div className="bg-slate-950/70 p-3.5 rounded border border-slate-800">
            <span className="text-slate-500 block text-[10px] uppercase">Snapshot Audit Integrity</span>
            <span className="text-lg font-bold text-slate-100 tabular-nums mt-0.5 block">
              {report.tamperVerifiedPct.toFixed(1)}%
            </span>
            <span className="text-[11px] text-slate-400 block mt-0.5 tabular-nums">
              {report.pendingCount} active · {report.invalidatedCount} invalidated
            </span>
          </div>
        </div>

        {/* Filter Toolbar */}
        <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
          <div className="flex flex-wrap items-center gap-2">
            {/* Outcome Filter */}
            <div className="flex items-center gap-1 p-1 bg-slate-950 border border-slate-800 rounded-md">
              {(
                [
                  { id: 'ALL', label: `All (${report.totalCount})` },
                  { id: 'SUCCESS', label: `Success (${report.successCount})` },
                  { id: 'FAILURE', label: `Failure (${report.failureCount})` },
                  { id: 'PENDING', label: `Pending (${report.pendingCount})` },
                ] as const
              ).map((opt) => (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => setOutcomeFilter(opt.id)}
                  className={`px-2.5 py-1 text-xs font-medium rounded transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                    outcomeFilter === opt.id
                      ? 'bg-amber-500/15 text-amber-300 border border-amber-500/30 font-semibold'
                      : 'text-slate-400 hover:text-slate-200 border border-transparent'
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>

            {/* Horizon Filter */}
            <div className="flex items-center gap-1 p-1 bg-slate-950 border border-slate-800 rounded-md">
              {(['ALL', 'INTRADAY', 'SWING', 'LONG_TERM'] as const).map((h) => (
                <button
                  key={h}
                  type="button"
                  onClick={() => setHorizonFilter(h)}
                  className={`px-2.5 py-1 text-xs font-mono rounded transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                    horizonFilter === h
                      ? 'bg-slate-800 text-slate-100 font-semibold'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  {h.replace('_', ' ')}
                </button>
              ))}
            </div>

            {/* Source Filter */}
            <div className="flex items-center gap-1 p-1 bg-slate-950 border border-slate-800 rounded-md">
              {(
                [
                  { id: 'ALL', label: 'All Sources' },
                  { id: 'FORECAST_LEDGER', label: 'Forecast Ledger' },
                  { id: 'JOURNAL_EXECUTION', label: 'Paper Triggered' },
                ] as const
              ).map((src) => (
                <button
                  key={src.id}
                  type="button"
                  onClick={() => setSourceFilter(src.id)}
                  className={`px-2.5 py-1 text-xs font-medium rounded transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                    sourceFilter === src.id
                      ? 'bg-slate-800 text-slate-100 font-semibold'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  {src.label}
                </button>
              ))}
            </div>
          </div>

          <div className="relative min-w-[220px] flex-1 sm:flex-initial">
            <Search
              className="w-3.5 h-3.5 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none"
              aria-hidden="true"
            />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Filter plan ID, symbol, notes..."
              aria-label="Filter historical trade plans"
              className="w-full pl-8 pr-3 py-1.5 bg-slate-950 border border-slate-800 rounded-md text-xs text-slate-100 placeholder:text-slate-500 focus:outline-none focus:border-amber-400"
            />
          </div>
        </div>
      </section>

      {/* Main Triggered Trade Plans Table */}
      <section className="bg-slate-900 border border-slate-800 rounded-lg overflow-hidden">
        {isLoading && filteredRows.length === 0 ? (
          <div className="p-6 space-y-3" aria-busy="true">
            {[0, 1, 2, 3].map((idx) => (
              <div
                key={idx}
                className="h-12 bg-slate-950/70 border border-slate-800/80 rounded"
              />
            ))}
          </div>
        ) : filteredRows.length === 0 ? (
          <div className="p-10 text-center space-y-3">
            <p className="text-sm font-semibold text-slate-200">
              No past triggered trade plans match your current filter.
            </p>
            <p className="text-xs text-slate-400 max-w-md mx-auto">
              Clear outcome, horizon, or symbol filters to inspect all audited pre-registered setups and executed journal trade plans against live quotes.
            </p>
            <button
              type="button"
              onClick={handleResetFilters}
              className="px-4 py-2 rounded-md bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-semibold transition-colors cursor-pointer"
            >
              Reset Filters
            </button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-slate-950/80 border-b border-slate-800 text-[11px] font-mono uppercase text-slate-400">
                  <th className="py-3 px-4 font-semibold">Triggered Trade Plan</th>
                  <th className="py-3 px-3 font-semibold">Setup / Side</th>
                  <th className="py-3 px-3 font-semibold text-right">Entry Zone</th>
                  <th className="py-3 px-3 font-semibold text-right">Stop / Target 1</th>
                  <th className="py-3 px-3 font-semibold">Eventual Outcome</th>
                  <th className="py-3 px-4 font-semibold text-right">Live Price Comparison</th>
                  <th className="py-3 px-3 font-semibold text-right">Audit</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/80">
                {filteredRows.map((row) => {
                  const rowKey = `${row.source}-${row.planId}-${row.createdAt}`;
                  const isExpanded = expandedPlanKey === rowKey;
                  const dirPct = row.directionalMoveVsLivePct;
                  const dirPositive = (dirPct ?? 0) >= 0;

                  return (
                    <React.Fragment key={rowKey}>
                      <tr
                        onClick={() => setExpandedPlanKey(isExpanded ? null : rowKey)}
                        className="hover:bg-slate-800/40 transition-colors cursor-pointer"
                      >
                        <td className="py-3 px-4 align-top">
                          <div className="font-mono font-semibold text-slate-100">
                            {row.planId}
                          </div>
                          <div className="text-[11px] text-slate-400 font-mono tabular-nums mt-0.5">
                            {row.createdAt.slice(0, 16).replace('T', ' ')} UTC · {row.sourceLabel}
                          </div>
                        </td>

                        <td className="py-3 px-3 align-top">
                          <div className="flex items-center gap-1.5 font-mono font-semibold text-slate-200">
                            <span>{row.instrumentId}</span>
                            <span aria-hidden="true" className="text-slate-600">
                              ·
                            </span>
                            <span className="text-slate-400">{row.horizon.replace('_', ' ')}</span>
                          </div>
                          <div
                            className={`inline-flex items-center gap-1 text-[11px] font-mono font-semibold mt-0.5 ${
                              row.direction === 'SELL' ? 'text-rose-400' : 'text-emerald-400'
                            }`}
                          >
                            {row.direction === 'SELL' ? (
                              <ArrowDownRight className="w-3 h-3" aria-hidden="true" />
                            ) : (
                              <ArrowUpRight className="w-3 h-3" aria-hidden="true" />
                            )}
                            <span>{row.direction}</span>
                          </div>
                        </td>

                        <td className="py-3 px-3 align-top text-right font-mono tabular-nums text-slate-200">
                          <div>${row.entryMidPrice.toFixed(2)}</div>
                          {row.entryZone[0] !== row.entryZone[1] && (
                            <div className="text-[11px] text-slate-500">
                              ${row.entryZone[0].toFixed(2)}–${row.entryZone[1].toFixed(2)}
                            </div>
                          )}
                        </td>

                        <td className="py-3 px-3 align-top text-right font-mono tabular-nums">
                          <div className="text-rose-400">SL ${row.stopLossPrice.toFixed(2)}</div>
                          <div className="text-emerald-400">T1 ${row.target1Price.toFixed(2)}</div>
                        </td>

                        <td className="py-3 px-3 align-top">{renderOutcomeCell(row)}</td>

                        <td className="py-3 px-4 align-top text-right font-mono tabular-nums">
                          {row.hasLiveQuote && row.liveSpotPrice !== null ? (
                            <div className="space-y-0.5">
                              <div className="text-slate-100 font-semibold">
                                Live ${row.liveSpotPrice.toFixed(2)}
                                <span
                                  className={`ml-2 ${
                                    dirPositive ? 'text-emerald-400' : 'text-rose-400'
                                  }`}
                                >
                                  ({dirPositive ? '+' : ''}
                                  {dirPct?.toFixed(2)}%)
                                </span>
                              </div>
                              <div className="text-[11px] text-slate-400">
                                {row.liveComparisonLabel}
                                {row.liveSpotRMultiple !== null && (
                                  <span>
                                    {' '}
                                    · {row.liveSpotRMultiple >= 0 ? '+' : ''}
                                    {row.liveSpotRMultiple.toFixed(2)}R at spot
                                  </span>
                                )}
                              </div>
                            </div>
                          ) : (
                            <span className="text-slate-500">No live quote</span>
                          )}
                        </td>

                        <td className="py-3 px-3 align-top text-right">
                          <button
                            type="button"
                            aria-expanded={isExpanded}
                            aria-label={`Inspect details for ${row.planId}`}
                            onClick={(e) => {
                              e.stopPropagation();
                              setExpandedPlanKey(isExpanded ? null : rowKey);
                            }}
                            className="inline-flex items-center gap-1 px-2 py-1 rounded text-[11px] font-mono text-slate-300 hover:text-slate-100 hover:bg-slate-800 transition-colors cursor-pointer"
                          >
                            <span>{isExpanded ? 'Hide' : 'Audit'}</span>
                            {isExpanded ? (
                              <ChevronUp className="w-3.5 h-3.5" aria-hidden="true" />
                            ) : (
                              <ChevronDown className="w-3.5 h-3.5" aria-hidden="true" />
                            )}
                          </button>
                        </td>
                      </tr>

                      {isExpanded && (
                        <tr className="bg-slate-950/70">
                          <td colSpan={7} className="px-4 py-3 border-t border-slate-800/80">
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
                              <div className="space-y-1">
                                <span className="text-[10px] font-mono uppercase text-slate-500 block">
                                  Execution Notes &amp; Outcome Context
                                </span>
                                <p className="text-slate-300 leading-relaxed">{row.notes}</p>
                              </div>

                              <div className="space-y-1 font-mono tabular-nums">
                                <span className="text-[10px] uppercase text-slate-500 block">
                                  Live Spot Distance Analysis
                                </span>
                                {row.hasLiveQuote && row.liveSpotPrice !== null ? (
                                  <div className="space-y-0.5 text-slate-300">
                                    <div>
                                      Directional Delta:{' '}
                                      <span
                                        className={
                                          (row.directionalMoveVsLiveUsd ?? 0) >= 0
                                            ? 'text-emerald-400'
                                            : 'text-rose-400'
                                        }
                                      >
                                        {(row.directionalMoveVsLiveUsd ?? 0) >= 0 ? '+' : '-'}$
                                        {Math.abs(row.directionalMoveVsLiveUsd ?? 0).toFixed(2)} (
                                        {(row.directionalMoveVsLivePct ?? 0) >= 0 ? '+' : ''}
                                        {(row.directionalMoveVsLivePct ?? 0).toFixed(2)}%)
                                      </span>
                                    </div>
                                    <div>
                                      vs. Target 1:{' '}
                                      <span>
                                        {(row.distanceToTarget1Pct ?? 0) >= 0 ? '+' : ''}
                                        {(row.distanceToTarget1Pct ?? 0).toFixed(2)}%
                                      </span>{' '}
                                      · Stop Cushion:{' '}
                                      <span>
                                        {(row.distanceToStopPct ?? 0) >= 0 ? '+' : ''}
                                        {(row.distanceToStopPct ?? 0).toFixed(2)}%
                                      </span>
                                    </div>
                                  </div>
                                ) : (
                                  <div className="text-slate-500">Live spot benchmark unavailable.</div>
                                )}
                              </div>

                              <div className="space-y-1 font-mono">
                                <span className="text-[10px] uppercase text-slate-500 block">
                                  Invalidation &amp; Digest Seal
                                </span>
                                <div className="text-slate-300">{row.invalidationCondition}</div>
                                <div className="flex items-center gap-1.5 text-[11px] text-emerald-400 pt-0.5">
                                  <ShieldCheck className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
                                  <span>
                                    {row.tamperAuditPassed ? 'SHA-256 Verified' : 'Audit Pending'} ·{' '}
                                    {row.snapshotHash.slice(0, 12)}...
                                  </span>
                                </div>
                              </div>
                            </div>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
};
