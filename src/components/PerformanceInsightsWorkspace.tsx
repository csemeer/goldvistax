/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * Aurum Intelligence — Performance Insights Workspace
 *
 * Visualizes historical paper trading win/loss ratio, cumulative ROI over time,
 * and average trade holding duration using Recharts, strictly isolated per user.
 */

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Pie,
  PieChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import {
  BarChart3,
  BookOpen,
  Clock,
  Percent,
  RefreshCw,
  RotateCcw,
  TrendingUp,
} from 'lucide-react';
import { PaperPosition, Quote } from '../domain/types';
import {
  buildPerformanceInsightsReport,
  DailyPnlScopeMode,
  formatDurationHours,
  PerformanceInsightsCumulativeRoiPoint,
  PerformanceInsightsDurationBucket,
  PerformanceInsightsHorizonBreakdown,
  PerformanceInsightsWinLossSlice,
  SelectedHorizonFilter,
} from '../services/portfolioScannerEngine';
import { ensureSignedBearerToken, getCurrentSession } from '../services/authService';

interface PerformanceInsightsWorkspaceProps {
  quote: Quote;
  quotes?: Record<string, Quote>;
  onNavigateToPortfolio?: () => void;
}

type RoiCurveMetric = 'EQUITY_ROI' | 'COMPOUND_ROI';
type WinLossChartMode = 'OVERALL_RATIO' | 'BY_HORIZON';
type DurationChartMode = 'BY_HORIZON' | 'DURATION_BUCKETS';

const LOCAL_JOURNAL_STORAGE_PREFIX = 'goldvista_paper_journal_backup_v1:';

function loadLocalJournalBackup(userId: string): PaperPosition[] | null {
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      const raw = window.localStorage.getItem(`${LOCAL_JOURNAL_STORAGE_PREFIX}${userId}`);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) {
          return parsed;
        }
      }
    }
  } catch {
    // ignore storage read error
  }
  return null;
}

function saveLocalJournalBackup(userId: string, nextPositions: PaperPosition[]): void {
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      window.localStorage.setItem(
        `${LOCAL_JOURNAL_STORAGE_PREFIX}${userId}`,
        JSON.stringify(nextPositions)
      );
    }
  } catch {
    // ignore storage write error
  }
}

function formatSignedUsd(val: number): string {
  const abs = Math.abs(val).toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  return val >= 0 ? `+$${abs}` : `-$${abs}`;
}

function formatSignedPct(val: number): string {
  return `${val >= 0 ? '+' : ''}${val.toFixed(2)}%`;
}

const CumulativeRoiTooltip: React.FC<{
  active?: boolean;
  payload?: Array<{ payload?: PerformanceInsightsCumulativeRoiPoint }>;
}> = ({ active, payload }) => {
  if (!active || !payload || payload.length === 0 || !payload[0]?.payload) {
    return null;
  }
  const pt = payload[0].payload;
  return (
    <div className="bg-slate-950 border border-slate-700 rounded-md p-3 shadow-lg text-xs font-mono tabular-nums min-w-[240px] space-y-1.5">
      <div className="border-b border-slate-800 pb-1.5 flex items-center justify-between gap-4">
        <span className="font-bold text-slate-100">
          {pt.dateKey} ({pt.dateLabel})
        </span>
        <span
          className={
            pt.cumulativeEquityRoiPct >= 0
              ? 'font-bold text-emerald-400'
              : 'font-bold text-rose-400'
          }
        >
          {formatSignedPct(pt.cumulativeEquityRoiPct)}
        </span>
      </div>
      <div className="flex items-center justify-between gap-4">
        <span className="text-slate-400">Trades Recorded</span>
        <span className="text-slate-200">{pt.tradesCount}</span>
      </div>
      <div className="flex items-center justify-between gap-4">
        <span className="text-slate-400">Day Net P&amp;L</span>
        <span className={pt.dailyPnlUsd >= 0 ? 'text-emerald-400' : 'text-rose-400'}>
          {formatSignedUsd(pt.dailyPnlUsd)}
        </span>
      </div>
      <div className="flex items-center justify-between gap-4">
        <span className="text-slate-400">Cumulative P&amp;L</span>
        <span className={pt.cumulativePnlUsd >= 0 ? 'text-emerald-400' : 'text-rose-400'}>
          {formatSignedUsd(pt.cumulativePnlUsd)}
        </span>
      </div>
      <div className="flex items-center justify-between gap-4">
        <span className="text-slate-400">Compounded ROI</span>
        <span className="text-amber-300 font-semibold">{formatSignedPct(pt.compoundRoiPct)}</span>
      </div>
      <div className="flex items-center justify-between gap-4">
        <span className="text-slate-400">Account Equity</span>
        <span className="text-slate-100 font-bold">
          ${pt.accountBalanceUsd.toLocaleString('en-US', { maximumFractionDigits: 0 })}
        </span>
      </div>
    </div>
  );
};

const WinLossTooltip: React.FC<{
  active?: boolean;
  payload?: Array<{ payload?: PerformanceInsightsWinLossSlice }>;
}> = ({ active, payload }) => {
  if (!active || !payload || payload.length === 0 || !payload[0]?.payload) {
    return null;
  }
  const item = payload[0].payload;
  return (
    <div className="bg-slate-950 border border-slate-700 rounded-md p-3 shadow-lg text-xs font-mono tabular-nums min-w-[210px] space-y-1">
      <div className="font-bold text-slate-100 border-b border-slate-800 pb-1">
        {item.name}
      </div>
      <div className="flex items-center justify-between gap-4">
        <span className="text-slate-400">Trades</span>
        <span className="text-slate-100 font-semibold">
          {item.count} ({item.sharePct.toFixed(1)}%)
        </span>
      </div>
      <div className="flex items-center justify-between gap-4">
        <span className="text-slate-400">Total P&amp;L</span>
        <span className={item.totalPnlUsd >= 0 ? 'text-emerald-400' : 'text-rose-400'}>
          {formatSignedUsd(item.totalPnlUsd)}
        </span>
      </div>
      <div className="flex items-center justify-between gap-4">
        <span className="text-slate-400">Average / Trade</span>
        <span className={item.avgPnlUsd >= 0 ? 'text-emerald-400' : 'text-rose-400'}>
          {formatSignedUsd(item.avgPnlUsd)}
        </span>
      </div>
    </div>
  );
};

const HorizonWinLossTooltip: React.FC<{
  active?: boolean;
  payload?: Array<{ payload?: PerformanceInsightsHorizonBreakdown }>;
}> = ({ active, payload }) => {
  if (!active || !payload || payload.length === 0 || !payload[0]?.payload) {
    return null;
  }
  const row = payload[0].payload;
  return (
    <div className="bg-slate-950 border border-slate-700 rounded-md p-3 shadow-lg text-xs font-mono tabular-nums min-w-[220px] space-y-1">
      <div className="font-bold text-slate-100 border-b border-slate-800 pb-1">
        {row.label} Horizon ({row.tradesCount} trades)
      </div>
      <div className="flex items-center justify-between gap-4">
        <span className="text-emerald-400">Wins</span>
        <span className="text-emerald-300 font-semibold">{row.wins}</span>
      </div>
      <div className="flex items-center justify-between gap-4">
        <span className="text-rose-400">Losses</span>
        <span className="text-rose-300 font-semibold">{row.losses}</span>
      </div>
      <div className="flex items-center justify-between gap-4">
        <span className="text-slate-400">Win Rate</span>
        <span className="text-amber-300 font-bold">{row.winRatePct.toFixed(1)}%</span>
      </div>
      <div className="flex items-center justify-between gap-4">
        <span className="text-slate-400">Net P&amp;L</span>
        <span className={row.netPnlUsd >= 0 ? 'text-emerald-400' : 'text-rose-400'}>
          {formatSignedUsd(row.netPnlUsd)}
        </span>
      </div>
    </div>
  );
};

const DurationHorizonTooltip: React.FC<{
  active?: boolean;
  payload?: Array<{ payload?: PerformanceInsightsHorizonBreakdown }>;
}> = ({ active, payload }) => {
  if (!active || !payload || payload.length === 0 || !payload[0]?.payload) {
    return null;
  }
  const row = payload[0].payload;
  return (
    <div className="bg-slate-950 border border-slate-700 rounded-md p-3 shadow-lg text-xs font-mono tabular-nums min-w-[230px] space-y-1">
      <div className="font-bold text-slate-100 border-b border-slate-800 pb-1">
        {row.label} Holding Duration ({row.tradesCount} trades)
      </div>
      <div className="flex items-center justify-between gap-4">
        <span className="text-sky-300">Avg Overall Hold</span>
        <span className="text-slate-100 font-semibold">
          {formatDurationHours(row.avgDurationHours)} ({row.avgDurationHours.toFixed(1)}h)
        </span>
      </div>
      <div className="flex items-center justify-between gap-4">
        <span className="text-emerald-400">Avg Winner Hold</span>
        <span className="text-emerald-300">
          {formatDurationHours(row.avgWinDurationHours)} ({row.avgWinDurationHours.toFixed(1)}h)
        </span>
      </div>
      <div className="flex items-center justify-between gap-4">
        <span className="text-rose-400">Avg Loser Hold</span>
        <span className="text-rose-300">
          {formatDurationHours(row.avgLossDurationHours)} ({row.avgLossDurationHours.toFixed(1)}h)
        </span>
      </div>
    </div>
  );
};

const DurationBucketTooltip: React.FC<{
  active?: boolean;
  payload?: Array<{ payload?: PerformanceInsightsDurationBucket }>;
}> = ({ active, payload }) => {
  if (!active || !payload || payload.length === 0 || !payload[0]?.payload) {
    return null;
  }
  const b = payload[0].payload;
  return (
    <div className="bg-slate-950 border border-slate-700 rounded-md p-3 shadow-lg text-xs font-mono tabular-nums min-w-[220px] space-y-1">
      <div className="font-bold text-slate-100 border-b border-slate-800 pb-1">
        Hold Window: {b.label}
      </div>
      <div className="flex items-center justify-between gap-4">
        <span className="text-slate-400">Trades</span>
        <span className="text-slate-100">
          {b.tradesCount} ({b.wins}W / {b.losses}L)
        </span>
      </div>
      <div className="flex items-center justify-between gap-4">
        <span className="text-slate-400">Win Rate</span>
        <span className="text-amber-300 font-bold">{b.winRatePct.toFixed(1)}%</span>
      </div>
      <div className="flex items-center justify-between gap-4">
        <span className="text-slate-400">Total P&amp;L</span>
        <span className={b.totalPnlUsd >= 0 ? 'text-emerald-400' : 'text-rose-400'}>
          {formatSignedUsd(b.totalPnlUsd)}
        </span>
      </div>
    </div>
  );
};

export const PerformanceInsightsWorkspace: React.FC<PerformanceInsightsWorkspaceProps> = ({
  quote,
  quotes = {},
  onNavigateToPortfolio,
}) => {
  const session = getCurrentSession();
  const activeUserId = session?.uid || 'usr_guest_0000';

  const [positions, setPositions] = useState<PaperPosition[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isBusySeeding, setIsBusySeeding] = useState<boolean>(false);
  const [fetchError, setFetchError] = useState<string | null>(null);

  const [scope, setScope] = useState<DailyPnlScopeMode>('ALL_EXECUTED');
  const [horizonFilter, setHorizonFilter] = useState<SelectedHorizonFilter>('ALL');
  const [startingCapital, setStartingCapital] = useState<number>(100000);
  const [roiMetric, setRoiMetric] = useState<RoiCurveMetric>('EQUITY_ROI');
  const [winLossMode, setWinLossMode] = useState<WinLossChartMode>('OVERALL_RATIO');
  const [durationMode, setDurationMode] = useState<DurationChartMode>('BY_HORIZON');

  const loadPositions = useCallback(async () => {
    setIsLoading(true);
    setFetchError(null);
    const currentSession = getCurrentSession();
    const uid = currentSession?.uid || 'usr_guest_0000';

    if (!currentSession || currentSession.role === 'GUEST') {
      const local = loadLocalJournalBackup(uid);
      setPositions(local ?? []);
      setIsLoading(false);
      return;
    }

    try {
      let token = await ensureSignedBearerToken(currentSession);
      if (!token) {
        setPositions(loadLocalJournalBackup(uid) ?? []);
        setIsLoading(false);
        return;
      }

      let res = await fetch('/api/portfolio/journal', {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.status === 401) {
        token = await ensureSignedBearerToken(currentSession, true);
        if (token) {
          res = await fetch('/api/portfolio/journal', {
            headers: { Authorization: `Bearer ${token}` },
          });
        }
      }

      const json = (await res.json()) as {
        success?: boolean;
        positions?: PaperPosition[];
        error?: string;
      };
      if (!res.ok) {
        throw new Error(json.error || `Unable to load paper trading history (HTTP ${res.status}).`);
      }
      const nextList = Array.isArray(json.positions) ? json.positions : [];
      setPositions(nextList);
      saveLocalJournalBackup(uid, nextList);
    } catch (err: any) {
      setFetchError(String(err?.message || 'Unable to sync paper trading history.'));
      const fallback = loadLocalJournalBackup(uid);
      if (fallback) {
        setPositions(fallback);
      }
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    setPositions([]);
    void loadPositions();
  }, [activeUserId, loadPositions]);

  const handleLoadSampleTrades = async () => {
    const currentSession = getCurrentSession();
    if (!currentSession || currentSession.role === 'GUEST') {
      setFetchError('Sign in to a free account or open Portfolio & Journal to record simulated trades.');
      return;
    }

    setIsBusySeeding(true);
    setFetchError(null);
    try {
      const token = await ensureSignedBearerToken(currentSession);
      if (!token) {
        throw new Error('Authentication session required to load sample paper trades.');
      }
      const res = await fetch('/api/portfolio/journal', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ action: 'SEED_DEMO' }),
      });
      const json = (await res.json()) as { positions?: PaperPosition[]; error?: string };
      if (!res.ok) {
        throw new Error(json.error || `Failed to load sample trades (HTTP ${res.status}).`);
      }
      const nextList = Array.isArray(json.positions) ? json.positions : [];
      setPositions(nextList);
      saveLocalJournalBackup(currentSession.uid, nextList);
    } catch (err: any) {
      setFetchError(String(err?.message || 'Failed to load sample paper trades.'));
    } finally {
      setIsBusySeeding(false);
    }
  };

  const report = useMemo(
    () =>
      buildPerformanceInsightsReport(positions, {
        scope,
        horizonFilter,
        startingCapitalUsd: startingCapital,
        quotes,
        defaultQuote: quote,
      }),
    [positions, scope, horizonFilter, startingCapital, quotes, quote]
  );

  const roiStrokeColor =
    (roiMetric === 'EQUITY_ROI' ? report.cumulativeEquityRoiPct : report.compoundRoiPct) >= 0
      ? '#10b981'
      : '#f43f5e';

  const roiDataKey = roiMetric === 'EQUITY_ROI' ? 'cumulativeEquityRoiPct' : 'compoundRoiPct';

  return (
    <div className="space-y-6">
      {/* Header & Interactive Controls */}
      <section
        aria-label="Performance Insights Overview and Filters"
        className="bg-slate-900 border border-slate-800 rounded-lg p-5 space-y-4"
      >
        <div className="flex flex-wrap items-start justify-between gap-4 pb-4 border-b border-slate-800">
          <div>
            <span className="text-xs font-mono text-amber-400 uppercase tracking-wider block">
              Paper Trading Telemetry · Recharts Analytics
            </span>
            <h2 className="text-xl font-bold text-slate-100 mt-0.5 flex items-center gap-2">
              <BarChart3 className="w-5 h-5 text-amber-400 shrink-0" aria-hidden="true" />
              <span>Performance Insights</span>
            </h2>
            <p className="text-xs text-slate-400 mt-1">
              Historical paper trading win/loss ratio, cumulative ROI trajectory over time, and
              holding-duration efficiency across your isolated account ledger.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            {/* Scope Toggle */}
            <div
              role="group"
              aria-label="Trade evaluation scope"
              className="flex items-center p-1 bg-slate-950 border border-slate-800 rounded-md text-xs font-mono"
            >
              <button
                type="button"
                onClick={() => setScope('ALL_EXECUTED')}
                className={`px-3 py-1.5 rounded transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                  scope === 'ALL_EXECUTED'
                    ? 'bg-amber-500 text-slate-950 font-bold'
                    : 'text-slate-400 hover:text-slate-100'
                }`}
              >
                All Executed
              </button>
              <button
                type="button"
                onClick={() => setScope('CLOSED_ONLY')}
                className={`px-3 py-1.5 rounded transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                  scope === 'CLOSED_ONLY'
                    ? 'bg-amber-500 text-slate-950 font-bold'
                    : 'text-slate-400 hover:text-slate-100'
                }`}
              >
                Closed Only
              </button>
            </div>

            {/* Horizon Filter */}
            <div
              role="group"
              aria-label="Advisory horizon filter"
              className="flex items-center p-1 bg-slate-950 border border-slate-800 rounded-md text-xs font-mono"
            >
              {(
                [
                  { id: 'ALL', label: 'All' },
                  { id: 'INTRADAY', label: 'Intraday' },
                  { id: 'SWING', label: 'Swing' },
                  { id: 'LONG_TERM', label: 'Long Term' },
                ] as const
              ).map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setHorizonFilter(item.id)}
                  className={`px-2.5 py-1.5 rounded transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                    horizonFilter === item.id
                      ? 'bg-slate-800 text-amber-300 font-semibold'
                      : 'text-slate-400 hover:text-slate-100'
                  }`}
                >
                  {item.label}
                </button>
              ))}
            </div>

            {/* Capital Baseline Selector */}
            <label className="sr-only" htmlFor="perf-insights-capital">
              Reference Capital Baseline
            </label>
            <select
              id="perf-insights-capital"
              value={startingCapital}
              onChange={(e) => setStartingCapital(Number(e.target.value))}
              className="bg-slate-950 border border-slate-800 rounded-md px-3 py-2 text-xs font-mono text-slate-200 focus:outline-none focus:border-amber-500"
            >
              <option value={10000}>Base: $10,000</option>
              <option value={50000}>Base: $50,000</option>
              <option value={100000}>Base: $100,000</option>
              <option value={250000}>Base: $250,000</option>
            </select>

            <button
              type="button"
              onClick={() => void loadPositions()}
              disabled={isLoading}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-md bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-xs font-medium transition-colors whitespace-nowrap shrink-0 disabled:opacity-50 cursor-pointer"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} aria-hidden="true" />
              Refresh
            </button>
          </div>
        </div>

        {fetchError && (
          <div
            role="alert"
            className="rounded-md border border-rose-500/40 bg-rose-500/10 px-3.5 py-2.5 text-xs font-mono text-rose-300"
          >
            {fetchError}
          </div>
        )}

        {/* 4-KPI Summary Strip */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 text-xs font-mono">
          <div className="bg-slate-950/70 border border-slate-800 rounded-md p-3.5">
            <span className="text-[10px] text-slate-500 uppercase block">Win / Loss Ratio</span>
            <span className="text-lg font-bold text-slate-100 tabular-nums mt-0.5 block">
              {report.winLossRatioLabel}
            </span>
            <span className="text-[11px] text-slate-400 tabular-nums">
              {report.winRatePct.toFixed(1)}% Win Rate · {report.winCount}W / {report.lossCount}L
            </span>
          </div>

          <div className="bg-slate-950/70 border border-slate-800 rounded-md p-3.5">
            <span className="text-[10px] text-slate-500 uppercase block">Cumulative ROI</span>
            <span
              className={`text-lg font-bold tabular-nums mt-0.5 block ${
                report.cumulativeEquityRoiPct >= 0 ? 'text-emerald-400' : 'text-rose-400'
              }`}
            >
              {formatSignedPct(report.cumulativeEquityRoiPct)}
            </span>
            <span className="text-[11px] text-slate-400 tabular-nums">
              Net {formatSignedUsd(report.netPnlUsd)} · Compound {formatSignedPct(report.compoundRoiPct)}
            </span>
          </div>

          <div className="bg-slate-950/70 border border-slate-800 rounded-md p-3.5">
            <span className="text-[10px] text-slate-500 uppercase block">Avg Trade Duration</span>
            <span className="text-lg font-bold text-sky-300 tabular-nums mt-0.5 block">
              {report.avgDurationLabel}
            </span>
            <span className="text-[11px] text-slate-400 tabular-nums">
              Median {report.medianDurationLabel} · {report.totalTrades} trade(s)
            </span>
          </div>

          <div className="bg-slate-950/70 border border-slate-800 rounded-md p-3.5">
            <span className="text-[10px] text-slate-500 uppercase block">
              Profit Factor &amp; Hold Split
            </span>
            <span className="text-lg font-bold text-amber-300 tabular-nums mt-0.5 block">
              {report.profitFactor.toFixed(2)} PF
            </span>
            <span className="text-[11px] text-slate-400 tabular-nums">
              Win {report.avgWinDurationLabel} · Loss {report.avgLossDurationLabel}
            </span>
          </div>
        </div>
      </section>

      {/* Loading Skeleton State */}
      {isLoading ? (
        <div className="space-y-6" aria-busy="true" aria-label="Loading performance insights">
          <div className="bg-slate-900 border border-slate-800 rounded-lg p-5 h-80 animate-pulse" />
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
            <div className="bg-slate-900 border border-slate-800 rounded-lg p-5 h-80 animate-pulse" />
            <div className="bg-slate-900 border border-slate-800 rounded-lg p-5 h-80 animate-pulse" />
          </div>
        </div>
      ) : report.totalTrades === 0 ? (
        /* Empty State */
        <section
          aria-label="Empty Performance Insights"
          className="bg-slate-900 border border-slate-800 rounded-lg p-8 text-center space-y-4"
        >
          <div className="max-w-lg mx-auto space-y-2">
            <h3 className="text-base font-bold text-slate-100">
              No Paper Trading History Found for Current Filters
            </h3>
            <p className="text-xs text-slate-400 leading-relaxed">
              {positions.length === 0
                ? 'Your isolated paper trading ledger does not have any executed positions yet. Open simulated trades from any Trade Plan or load the institutional demo sample to inspect Win/Loss Ratio, Cumulative ROI, and Average Trade Duration.'
                : 'No positions match the selected Scope or Horizon filter. Switch filters above or log additional trades in Portfolio & Journal.'}
            </p>
          </div>
          <div className="flex flex-wrap items-center justify-center gap-3">
            {positions.length === 0 && (
              <button
                type="button"
                onClick={() => void handleLoadSampleTrades()}
                disabled={isBusySeeding}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-md bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs transition-colors whitespace-nowrap shrink-0 disabled:opacity-50 cursor-pointer"
              >
                <RotateCcw className="w-3.5 h-3.5" aria-hidden="true" />
                {isBusySeeding ? 'Loading Sample Trades...' : 'Load Sample Demo Trades'}
              </button>
            )}
            {onNavigateToPortfolio && (
              <button
                type="button"
                onClick={onNavigateToPortfolio}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-md bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 font-semibold text-xs transition-colors whitespace-nowrap shrink-0 cursor-pointer"
              >
                <BookOpen className="w-3.5 h-3.5" aria-hidden="true" />
                Open Portfolio &amp; Journal
              </button>
            )}
          </div>
        </section>
      ) : (
        <>
          {/* CHART 1 (Primary Visual Anchor): Cumulative ROI Over Time (Recharts AreaChart) */}
          <section
            aria-label="Cumulative ROI Over Time"
            className="bg-slate-900 border border-slate-800 rounded-lg p-5 space-y-4"
          >
            <div className="flex flex-wrap items-start justify-between gap-4 pb-3 border-b border-slate-800">
              <div>
                <h3 className="text-sm font-bold text-slate-100 flex items-center gap-2">
                  <TrendingUp className="w-4 h-4 text-emerald-400 shrink-0" aria-hidden="true" />
                  <span>Cumulative ROI Over Time (%)</span>
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">{report.summaryInsight}</p>
              </div>

              <div
                role="group"
                aria-label="Cumulative ROI metric toggle"
                className="flex items-center p-1 bg-slate-950 border border-slate-800 rounded-md text-xs font-mono"
              >
                <button
                  type="button"
                  onClick={() => setRoiMetric('EQUITY_ROI')}
                  className={`px-3 py-1 rounded transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                    roiMetric === 'EQUITY_ROI'
                      ? 'bg-emerald-500/20 text-emerald-300 font-semibold'
                      : 'text-slate-400 hover:text-slate-100'
                  }`}
                >
                  Cumulative Equity ROI
                </button>
                <button
                  type="button"
                  onClick={() => setRoiMetric('COMPOUND_ROI')}
                  className={`px-3 py-1 rounded transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                    roiMetric === 'COMPOUND_ROI'
                      ? 'bg-emerald-500/20 text-emerald-300 font-semibold'
                      : 'text-slate-400 hover:text-slate-100'
                  }`}
                >
                  Compounded ROI
                </button>
              </div>
            </div>

            <div className="h-72 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart
                  data={report.cumulativeRoiSeries}
                  margin={{ top: 10, right: 18, left: 0, bottom: 4 }}
                >
                  <defs>
                    <linearGradient id="perfInsightsRoiFill" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor={roiStrokeColor} stopOpacity={0.32} />
                      <stop offset="95%" stopColor={roiStrokeColor} stopOpacity={0.02} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                  <XAxis
                    dataKey="dateLabel"
                    stroke="#64748b"
                    tick={{ fill: '#94a3b8', fontSize: 11, fontFamily: 'monospace' }}
                    tickLine={false}
                  />
                  <YAxis
                    stroke="#64748b"
                    tick={{ fill: '#94a3b8', fontSize: 11, fontFamily: 'monospace' }}
                    tickLine={false}
                    tickFormatter={(v) => `${Number(v).toFixed(1)}%`}
                    width={58}
                  />
                  <ReferenceLine y={0} stroke="#475569" strokeDasharray="4 4" />
                  <Tooltip content={<CumulativeRoiTooltip />} />
                  <Area
                    type="monotone"
                    dataKey={roiDataKey}
                    name={
                      roiMetric === 'EQUITY_ROI' ? 'Cumulative Equity ROI %' : 'Compounded ROI %'
                    }
                    stroke={roiStrokeColor}
                    strokeWidth={2.5}
                    fillOpacity={1}
                    fill="url(#perfInsightsRoiFill)"
                    dot={{ r: 3, fill: roiStrokeColor, strokeWidth: 0 }}
                    activeDot={{ r: 5, stroke: '#f8fafc', strokeWidth: 1.5 }}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </section>

          {/* PAIRED CHARTS: Win/Loss Ratio + Average Trade Duration */}
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
            {/* CHART 2: Win / Loss Ratio (Recharts PieChart Donut / Horizon BarChart) */}
            <section
              aria-label="Historical Win and Loss Ratio"
              className="bg-slate-900 border border-slate-800 rounded-lg p-5 space-y-4"
            >
              <div className="flex flex-wrap items-start justify-between gap-3 pb-3 border-b border-slate-800">
                <div>
                  <h3 className="text-sm font-bold text-slate-100 flex items-center gap-2">
                    <Percent className="w-4 h-4 text-amber-400 shrink-0" aria-hidden="true" />
                    <span>Historical Win / Loss Ratio</span>
                  </h3>
                  <p className="text-xs text-slate-400 mt-0.5 tabular-nums">
                    {report.winCount} winning vs. {report.lossCount} losing trades · Ratio{' '}
                    {report.winLossRatioLabel}
                  </p>
                </div>

                <div
                  role="group"
                  aria-label="Win loss visualization mode"
                  className="flex items-center p-1 bg-slate-950 border border-slate-800 rounded-md text-xs font-mono"
                >
                  <button
                    type="button"
                    onClick={() => setWinLossMode('OVERALL_RATIO')}
                    className={`px-2.5 py-1 rounded transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                      winLossMode === 'OVERALL_RATIO'
                        ? 'bg-slate-800 text-amber-300 font-semibold'
                        : 'text-slate-400 hover:text-slate-100'
                    }`}
                  >
                    Overall Ratio
                  </button>
                  <button
                    type="button"
                    onClick={() => setWinLossMode('BY_HORIZON')}
                    className={`px-2.5 py-1 rounded transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                      winLossMode === 'BY_HORIZON'
                        ? 'bg-slate-800 text-amber-300 font-semibold'
                        : 'text-slate-400 hover:text-slate-100'
                    }`}
                  >
                    By Horizon
                  </button>
                </div>
              </div>

              {winLossMode === 'OVERALL_RATIO' ? (
                <div className="grid grid-cols-1 sm:grid-cols-5 gap-4 items-center">
                  <div className="sm:col-span-3 h-64 relative">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={report.winLossBreakdown}
                          dataKey="count"
                          nameKey="name"
                          cx="50%"
                          cy="50%"
                          innerRadius={62}
                          outerRadius={92}
                          paddingAngle={3}
                          stroke="none"
                        >
                          {report.winLossBreakdown.map((slice) => (
                            <Cell key={slice.outcome} fill={slice.fill} />
                          ))}
                        </Pie>
                        <Tooltip content={<WinLossTooltip />} />
                      </PieChart>
                    </ResponsiveContainer>
                    <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center text-center">
                      <span className="text-[10px] font-mono uppercase text-slate-400">
                        Win / Loss
                      </span>
                      <span className="text-lg font-bold font-mono tabular-nums text-slate-100">
                        {report.winLossRatioLabel}
                      </span>
                      <span className="text-[11px] font-mono tabular-nums text-emerald-400">
                        {report.winRatePct.toFixed(1)}% Win
                      </span>
                    </div>
                  </div>

                  <div className="sm:col-span-2 space-y-3 text-xs font-mono tabular-nums">
                    {report.winLossBreakdown.map((slice) => (
                      <div
                        key={slice.outcome}
                        className="bg-slate-950/70 border border-slate-800 rounded-md p-3 space-y-1"
                      >
                        <div className="flex items-center justify-between">
                          <span
                            className={`font-semibold ${
                              slice.outcome === 'WIN' ? 'text-emerald-400' : 'text-rose-400'
                            }`}
                          >
                            {slice.name}
                          </span>
                          <span className="text-slate-100 font-bold">
                            {slice.count} ({slice.sharePct.toFixed(1)}%)
                          </span>
                        </div>
                        <div className="flex items-center justify-between text-[11px] text-slate-400">
                          <span>Gross P&amp;L</span>
                          <span
                            className={
                              slice.totalPnlUsd >= 0 ? 'text-emerald-300' : 'text-rose-300'
                            }
                          >
                            {formatSignedUsd(slice.totalPnlUsd)}
                          </span>
                        </div>
                        <div className="flex items-center justify-between text-[11px] text-slate-400">
                          <span>Avg / Trade</span>
                          <span>{formatSignedUsd(slice.avgPnlUsd)}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="h-64 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart
                      data={report.winLossByHorizon}
                      margin={{ top: 10, right: 12, left: 0, bottom: 4 }}
                    >
                      <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                      <XAxis
                        dataKey="label"
                        stroke="#64748b"
                        tick={{ fill: '#94a3b8', fontSize: 11, fontFamily: 'monospace' }}
                        tickLine={false}
                      />
                      <YAxis
                        stroke="#64748b"
                        tick={{ fill: '#94a3b8', fontSize: 11, fontFamily: 'monospace' }}
                        tickLine={false}
                        allowDecimals={false}
                        width={36}
                      />
                      <Tooltip content={<HorizonWinLossTooltip />} />
                      <Legend
                        wrapperStyle={{ fontSize: '11px', fontFamily: 'monospace' }}
                      />
                      <Bar dataKey="wins" name="Winning Trades" fill="#10b981" radius={[4, 4, 0, 0]} />
                      <Bar dataKey="losses" name="Losing Trades" fill="#f43f5e" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              )}
            </section>

            {/* CHART 3: Average Trade Duration (Recharts BarChart) */}
            <section
              aria-label="Average Trade Duration Analytics"
              className="bg-slate-900 border border-slate-800 rounded-lg p-5 space-y-4"
            >
              <div className="flex flex-wrap items-start justify-between gap-3 pb-3 border-b border-slate-800">
                <div>
                  <h3 className="text-sm font-bold text-slate-100 flex items-center gap-2">
                    <Clock className="w-4 h-4 text-sky-400 shrink-0" aria-hidden="true" />
                    <span>Average Trade Duration</span>
                  </h3>
                  <p className="text-xs text-slate-400 mt-0.5 tabular-nums">
                    Mean hold {report.avgDurationLabel} · Winners {report.avgWinDurationLabel} vs.
                    Losers {report.avgLossDurationLabel}
                  </p>
                </div>

                <div
                  role="group"
                  aria-label="Trade duration chart mode"
                  className="flex items-center p-1 bg-slate-950 border border-slate-800 rounded-md text-xs font-mono"
                >
                  <button
                    type="button"
                    onClick={() => setDurationMode('BY_HORIZON')}
                    className={`px-2.5 py-1 rounded transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                      durationMode === 'BY_HORIZON'
                        ? 'bg-slate-800 text-sky-300 font-semibold'
                        : 'text-slate-400 hover:text-slate-100'
                    }`}
                  >
                    By Horizon
                  </button>
                  <button
                    type="button"
                    onClick={() => setDurationMode('DURATION_BUCKETS')}
                    className={`px-2.5 py-1 rounded transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                      durationMode === 'DURATION_BUCKETS'
                        ? 'bg-slate-800 text-sky-300 font-semibold'
                        : 'text-slate-400 hover:text-slate-100'
                    }`}
                  >
                    Hold Buckets
                  </button>
                </div>
              </div>

              <div className="h-64 w-full">
                {durationMode === 'BY_HORIZON' ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart
                      data={report.durationByHorizon}
                      margin={{ top: 10, right: 12, left: 0, bottom: 4 }}
                    >
                      <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                      <XAxis
                        dataKey="label"
                        stroke="#64748b"
                        tick={{ fill: '#94a3b8', fontSize: 11, fontFamily: 'monospace' }}
                        tickLine={false}
                      />
                      <YAxis
                        stroke="#64748b"
                        tick={{ fill: '#94a3b8', fontSize: 11, fontFamily: 'monospace' }}
                        tickLine={false}
                        tickFormatter={(v) => `${v}h`}
                        width={46}
                      />
                      <Tooltip content={<DurationHorizonTooltip />} />
                      <Legend wrapperStyle={{ fontSize: '11px', fontFamily: 'monospace' }} />
                      <Bar
                        dataKey="avgDurationHours"
                        name="Avg Hold (hrs)"
                        fill="#38bdf8"
                        radius={[4, 4, 0, 0]}
                      />
                      <Bar
                        dataKey="avgWinDurationHours"
                        name="Avg Winner (hrs)"
                        fill="#10b981"
                        radius={[4, 4, 0, 0]}
                      />
                      <Bar
                        dataKey="avgLossDurationHours"
                        name="Avg Loser (hrs)"
                        fill="#f43f5e"
                        radius={[4, 4, 0, 0]}
                      />
                    </BarChart>
                  </ResponsiveContainer>
                ) : (
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart
                      data={report.durationBuckets}
                      margin={{ top: 10, right: 12, left: 0, bottom: 4 }}
                    >
                      <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                      <XAxis
                        dataKey="label"
                        stroke="#64748b"
                        tick={{ fill: '#94a3b8', fontSize: 11, fontFamily: 'monospace' }}
                        tickLine={false}
                      />
                      <YAxis
                        stroke="#64748b"
                        tick={{ fill: '#94a3b8', fontSize: 11, fontFamily: 'monospace' }}
                        tickLine={false}
                        allowDecimals={false}
                        width={36}
                      />
                      <Tooltip content={<DurationBucketTooltip />} />
                      <Legend wrapperStyle={{ fontSize: '11px', fontFamily: 'monospace' }} />
                      <Bar dataKey="wins" name="Winning Trades" fill="#10b981" radius={[4, 4, 0, 0]} />
                      <Bar dataKey="losses" name="Losing Trades" fill="#f43f5e" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </div>
            </section>
          </div>

          {/* High-Density Evaluated Trade Breakdown Table */}
          <section
            aria-label="Evaluated Trade Duration and ROI Breakdown"
            className="bg-slate-900 border border-slate-800 rounded-lg overflow-hidden"
          >
            <div className="px-5 py-4 border-b border-slate-800 flex flex-wrap items-center justify-between gap-2">
              <h3 className="text-sm font-semibold text-slate-100">
                Trade Outcome &amp; Duration Ledger ({report.trades.length})
              </h3>
              <span className="text-xs font-mono text-slate-400">
                {scope === 'CLOSED_ONLY' ? 'Settled Closed Trades Only' : 'Closed + Live MTM Open'}
              </span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-xs text-left">
                <thead className="bg-slate-950 text-slate-400 font-mono uppercase text-[10px] border-b border-slate-800">
                  <tr>
                    <th className="px-4 py-3">Trade ID</th>
                    <th className="px-4 py-3">Instrument</th>
                    <th className="px-4 py-3">Horizon</th>
                    <th className="px-4 py-3">Side</th>
                    <th className="px-4 py-3">Status</th>
                    <th className="px-4 py-3 text-right">Entry</th>
                    <th className="px-4 py-3 text-right">Exit / Mark</th>
                    <th className="px-4 py-3 text-right">Hold Duration</th>
                    <th className="px-4 py-3 text-right">Net P&amp;L</th>
                    <th className="px-4 py-3 text-right">Trade ROI %</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60 font-mono tabular-nums">
                  {report.trades.map((row) => (
                    <tr key={row.id} className="hover:bg-slate-800/30">
                      <td className="px-4 py-2.5 text-slate-400 whitespace-nowrap">{row.id}</td>
                      <td className="px-4 py-2.5 font-bold text-slate-200 whitespace-nowrap">
                        {row.instrumentId}
                      </td>
                      <td className="px-4 py-2.5 text-slate-300 whitespace-nowrap">
                        {row.horizon}
                      </td>
                      <td
                        className={`px-4 py-2.5 font-bold whitespace-nowrap ${
                          row.direction === 'SELL' ? 'text-rose-400' : 'text-emerald-400'
                        }`}
                      >
                        {row.direction}
                      </td>
                      <td className="px-4 py-2.5 whitespace-nowrap">
                        <span
                          className={
                            row.status === 'OPEN'
                              ? 'text-amber-300'
                              : row.isWin
                              ? 'text-emerald-400'
                              : 'text-rose-400'
                          }
                        >
                          {row.status === 'OPEN'
                            ? 'Open (MTM)'
                            : row.isWin
                            ? 'Closed Win'
                            : 'Closed Loss'}
                        </span>
                      </td>
                      <td className="px-4 py-2.5 text-right text-slate-300">
                        ${row.entryPrice.toFixed(2)}
                      </td>
                      <td className="px-4 py-2.5 text-right text-slate-200">
                        ${row.exitPrice.toFixed(2)}
                      </td>
                      <td className="px-4 py-2.5 text-right text-sky-300 font-semibold">
                        {row.holdingLabel}
                      </td>
                      <td
                        className={`px-4 py-2.5 text-right font-bold ${
                          row.pnlUsd >= 0 ? 'text-emerald-400' : 'text-rose-400'
                        }`}
                      >
                        {formatSignedUsd(row.pnlUsd)}
                      </td>
                      <td
                        className={`px-4 py-2.5 text-right font-semibold ${
                          row.tradeRoiPct >= 0 ? 'text-emerald-400' : 'text-rose-400'
                        }`}
                      >
                        {formatSignedPct(row.tradeRoiPct)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        </>
      )}
    </div>
  );
};
