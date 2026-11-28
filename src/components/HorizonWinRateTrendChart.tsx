/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * Aurum Intelligence — Win Rate vs. Time Across Advisory Horizons (Recharts)
 *
 * Plots cumulative or rolling win-rate trajectories across Intraday, Swing,
 * and Long-Term advisory horizons alongside the overall portfolio benchmark.
 */

import React, { useMemo, useState } from 'react';
import {
  CartesianGrid,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { PaperPosition, Quote } from '../domain/types';
import {
  buildHorizonWinRateTimeSeries,
  HorizonCategory,
  HorizonWinRateTrendMetric,
  WinRateCalculationMode,
  WinRateScopeMode,
  WinRateTimePoint,
} from '../services/portfolioScannerEngine';
import { LineChart as LineChartIcon } from 'lucide-react';

interface HorizonWinRateTrendChartProps {
  positions: PaperPosition[];
  quote: Quote;
  quotes?: Record<string, Quote>;
  activeRangeLabel?: string;
}

type SeriesKey = 'OVERALL' | HorizonCategory;

interface SeriesVisualConfig {
  key: SeriesKey;
  dataKey: keyof Pick<
    WinRateTimePoint,
    'overallWinRatePct' | 'intradayWinRatePct' | 'swingWinRatePct' | 'longTermWinRatePct'
  >;
  label: string;
  timeframeLabel: string;
  stroke: string;
  strokeDasharray?: string;
  strokeWidth: number;
}

const SERIES_CONFIGS: SeriesVisualConfig[] = [
  {
    key: 'OVERALL',
    dataKey: 'overallWinRatePct',
    label: 'Overall Portfolio',
    timeframeLabel: 'All Horizons',
    stroke: '#cbd5e1',
    strokeDasharray: '5 4',
    strokeWidth: 2,
  },
  {
    key: 'INTRADAY',
    dataKey: 'intradayWinRatePct',
    label: 'Intraday',
    timeframeLabel: 'M15 / H1',
    stroke: '#38bdf8',
    strokeWidth: 2.25,
  },
  {
    key: 'SWING',
    dataKey: 'swingWinRatePct',
    label: 'Swing',
    timeframeLabel: 'H4 / 1D',
    stroke: '#10b981',
    strokeWidth: 2.5,
  },
  {
    key: 'LONG_TERM',
    dataKey: 'longTermWinRatePct',
    label: 'Long-Term',
    timeframeLabel: 'W1 Macro',
    stroke: '#f59e0b',
    strokeWidth: 2.5,
  },
];

function formatTrendLabel(direction: HorizonWinRateTrendMetric['trendDirection']): string {
  if (direction === 'IMPROVING') return 'Improving';
  if (direction === 'DECLINING') return 'Declining';
  if (direction === 'STABLE') return 'Stable';
  return 'No Data';
}

function formatDeltaPts(delta: number): string {
  const sign = delta > 0 ? '+' : '';
  return `${sign}${delta.toFixed(1)} pts`;
}

function formatSignedUsd(val: number): string {
  const abs = Math.abs(val).toLocaleString('en-US', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  });
  return val >= 0 ? `+$${abs}` : `-$${abs}`;
}

interface CustomTooltipProps {
  active?: boolean;
  payload?: Array<{ payload?: WinRateTimePoint }>;
  visibleSeries: Record<SeriesKey, boolean>;
}

const WinRateTooltip: React.FC<CustomTooltipProps> = ({
  active,
  payload,
  visibleSeries,
}) => {
  if (!active || !payload || payload.length === 0 || !payload[0]?.payload) {
    return null;
  }

  const point = payload[0].payload;
  const horizonText =
    point.eventHorizon === 'LONG_TERM'
      ? 'Long-Term'
      : point.eventHorizon === 'SWING'
      ? 'Swing'
      : 'Intraday';

  const outcomeLabel =
    point.eventOutcome === 'WIN'
      ? 'Closed Win'
      : point.eventOutcome === 'LOSS'
      ? 'Closed Loss'
      : point.eventOutcome === 'OPEN_GAIN'
      ? 'Open MTM Gain'
      : 'Open MTM Drawdown';

  const rows: Array<{
    key: SeriesKey;
    label: string;
    color: string;
    rate: number | null;
    wins: number;
    total: number;
  }> = [
    {
      key: 'OVERALL',
      label: 'Overall Portfolio',
      color: '#cbd5e1',
      rate: point.overallWinRatePct,
      wins: point.overallWinsCount,
      total: point.overallTradesCount,
    },
    {
      key: 'INTRADAY',
      label: 'Intraday',
      color: '#38bdf8',
      rate: point.intradayWinRatePct,
      wins: point.intradayWinsCount,
      total: point.intradayTradesCount,
    },
    {
      key: 'SWING',
      label: 'Swing',
      color: '#10b981',
      rate: point.swingWinRatePct,
      wins: point.swingWinsCount,
      total: point.swingTradesCount,
    },
    {
      key: 'LONG_TERM',
      label: 'Long-Term',
      color: '#f59e0b',
      rate: point.longTermWinRatePct,
      wins: point.longTermWinsCount,
      total: point.longTermTradesCount,
    },
  ];

  return (
    <div className="bg-slate-950 border border-slate-700 rounded-md p-3 shadow-lg text-xs font-mono tabular-nums min-w-[230px] space-y-2">
      <div className="border-b border-slate-800 pb-1.5">
        <div className="flex items-center justify-between gap-3 text-slate-100 font-bold">
          <span>
            Trade #{point.pointIndex} · {point.dateLabel}
          </span>
          <span className={point.eventPnlUsd >= 0 ? 'text-emerald-400' : 'text-rose-400'}>
            {formatSignedUsd(point.eventPnlUsd)}
          </span>
        </div>
        <div className="text-[11px] text-slate-400 mt-0.5">
          {point.eventPositionId} · {horizonText} · {point.eventDirection} · {outcomeLabel}
        </div>
      </div>

      <div className="space-y-1">
        {rows
          .filter((r) => visibleSeries[r.key])
          .map((r) => (
            <div key={r.key} className="flex items-center justify-between gap-4">
              <span className="flex items-center gap-1.5 text-slate-300">
                <span
                  aria-hidden="true"
                  className="inline-block w-2.5 h-0.5"
                  style={{ backgroundColor: r.color }}
                />
                <span>{r.label}</span>
              </span>
              <span className="text-slate-100 font-semibold">
                {r.rate !== null ? `${r.rate.toFixed(1)}% (${r.wins}/${r.total})` : '—'}
              </span>
            </div>
          ))}
      </div>
    </div>
  );
};

export const HorizonWinRateTrendChart: React.FC<HorizonWinRateTrendChartProps> = ({
  positions,
  quote,
  quotes,
  activeRangeLabel = 'All Cycles',
}) => {
  const [mode, setMode] = useState<WinRateCalculationMode>('CUMULATIVE');
  const [scope, setScope] = useState<WinRateScopeMode>('CLOSED_ONLY');
  const [visibleSeries, setVisibleSeries] = useState<Record<SeriesKey, boolean>>({
    OVERALL: true,
    INTRADAY: true,
    SWING: true,
    LONG_TERM: true,
  });

  const summary = useMemo(
    () =>
      buildHorizonWinRateTimeSeries(positions, {
        mode,
        scope,
        rollingWindowSize: 3,
        quotes,
        defaultQuote: quote,
      }),
    [positions, mode, scope, quotes, quote]
  );

  const toggleSeries = (key: SeriesKey) => {
    setVisibleSeries((prev) => {
      const activeCount = Object.values(prev).filter(Boolean).length;
      if (prev[key] && activeCount <= 1) {
        return prev;
      }
      return { ...prev, [key]: !prev[key] };
    });
  };

  const showAllSeries = () => {
    setVisibleSeries({
      OVERALL: true,
      INTRADAY: true,
      SWING: true,
      LONG_TERM: true,
    });
  };

  const intradayMetric = summary.horizonMetrics.INTRADAY;
  const swingMetric = summary.horizonMetrics.SWING;
  const longTermMetric = summary.horizonMetrics.LONG_TERM;
  const overallMetric = summary.horizonMetrics.OVERALL;

  return (
    <section
      aria-label="Win Rate vs. Time Across Advisory Horizons"
      className="bg-slate-900 border border-slate-800 rounded-lg p-5 space-y-5"
    >
      {/* Header & Interactive Controls */}
      <div className="flex flex-wrap items-start justify-between gap-4 pb-3 border-b border-slate-800">
        <div>
          <h3 className="text-base font-bold text-slate-100 flex items-center gap-2">
            <LineChartIcon className="w-4 h-4 text-amber-400 shrink-0" aria-hidden="true" />
            <span>Win Rate vs. Time Across Advisory Horizons</span>
          </h3>
          <div className="flex flex-wrap items-center gap-2 text-xs text-slate-400 mt-1">
            <span>Scope: {activeRangeLabel}</span>
            <span aria-hidden="true">·</span>
            <span className="font-mono tabular-nums">
              {summary.totalAnalyzedTrades} chronological {scope === 'CLOSED_ONLY' ? 'closed' : 'executed'} trades
            </span>
            <span aria-hidden="true">·</span>
            <span className="font-mono tabular-nums">
              {mode === 'CUMULATIVE'
                ? 'Cumulative Expanding Win Rate'
                : `Rolling ${summary.rollingWindowSize}-Trade Moving Win Rate`}
            </span>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Calculation Mode Toggle */}
          <div
            role="group"
            aria-label="Win Rate Calculation Mode"
            className="flex items-center gap-1 p-1 bg-slate-950 border border-slate-800 rounded-lg"
          >
            {(
              [
                { id: 'CUMULATIVE', label: 'Cumulative %' },
                { id: 'ROLLING_WINDOW', label: 'Rolling 3-Trade %' },
              ] as const
            ).map((opt) => (
              <button
                key={opt.id}
                type="button"
                onClick={() => setMode(opt.id)}
                aria-pressed={mode === opt.id}
                className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                  mode === opt.id
                    ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40 font-semibold'
                    : 'text-slate-400 hover:text-slate-200 border border-transparent'
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>

          {/* Closed vs Open MTM Scope Toggle */}
          <div
            role="group"
            aria-label="Win Rate Trade Scope"
            className="flex items-center gap-1 p-1 bg-slate-950 border border-slate-800 rounded-lg"
          >
            {(
              [
                { id: 'CLOSED_ONLY', label: 'Closed Realized' },
                { id: 'ALL_EXECUTED', label: 'Incl. Open MTM' },
              ] as const
            ).map((opt) => (
              <button
                key={opt.id}
                type="button"
                onClick={() => setScope(opt.id)}
                aria-pressed={scope === opt.id}
                className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                  scope === opt.id
                    ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40 font-semibold'
                    : 'text-slate-400 hover:text-slate-200 border border-transparent'
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* 4-Column Trajectory KPI Strip */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 text-xs font-mono tabular-nums">
        <div className="bg-slate-950/70 p-3 rounded border border-slate-800">
          <span className="text-slate-400 block text-[10px]">OVERALL PORTFOLIO WIN RATE</span>
          <span className="text-base font-bold text-slate-100 block mt-0.5">
            {overallMetric.currentWinRatePct !== null
              ? `${overallMetric.currentWinRatePct.toFixed(1)}%`
              : 'No Data'}
          </span>
          <span className="text-[10px] text-slate-400 block mt-0.5">
            {overallMetric.totalTrades > 0
              ? `${overallMetric.wins}W / ${overallMetric.losses}L · ${formatDeltaPts(overallMetric.deltaPctPoints)} (${formatTrendLabel(overallMetric.trendDirection)})`
              : 'No matching trades'}
          </span>
        </div>

        <div className="bg-slate-950/70 p-3 rounded border border-slate-800">
          <span className="text-sky-400 block text-[10px]">INTRADAY (M15 / H1)</span>
          <span className="text-base font-bold text-slate-100 block mt-0.5">
            {intradayMetric.currentWinRatePct !== null
              ? `${intradayMetric.currentWinRatePct.toFixed(1)}%`
              : 'No Data'}
          </span>
          <span
            className={`text-[10px] block mt-0.5 ${
              intradayMetric.trendDirection === 'IMPROVING'
                ? 'text-emerald-400'
                : intradayMetric.trendDirection === 'DECLINING'
                ? 'text-rose-400'
                : 'text-slate-400'
            }`}
          >
            {intradayMetric.totalTrades > 0
              ? `${intradayMetric.wins}W / ${intradayMetric.losses}L · ${formatDeltaPts(intradayMetric.deltaPctPoints)} (${formatTrendLabel(intradayMetric.trendDirection)})`
              : '0 Intraday trades'}
          </span>
        </div>

        <div className="bg-slate-950/70 p-3 rounded border border-slate-800">
          <span className="text-emerald-400 block text-[10px]">SWING (H4 / 1D)</span>
          <span className="text-base font-bold text-slate-100 block mt-0.5">
            {swingMetric.currentWinRatePct !== null
              ? `${swingMetric.currentWinRatePct.toFixed(1)}%`
              : 'No Data'}
          </span>
          <span
            className={`text-[10px] block mt-0.5 ${
              swingMetric.trendDirection === 'IMPROVING'
                ? 'text-emerald-400'
                : swingMetric.trendDirection === 'DECLINING'
                ? 'text-rose-400'
                : 'text-slate-400'
            }`}
          >
            {swingMetric.totalTrades > 0
              ? `${swingMetric.wins}W / ${swingMetric.losses}L · ${formatDeltaPts(swingMetric.deltaPctPoints)} (${formatTrendLabel(swingMetric.trendDirection)})`
              : '0 Swing trades'}
          </span>
        </div>

        <div className="bg-slate-950/70 p-3 rounded border border-slate-800">
          <span className="text-amber-400 block text-[10px]">LONG-TERM (W1 MACRO)</span>
          <span className="text-base font-bold text-slate-100 block mt-0.5">
            {longTermMetric.currentWinRatePct !== null
              ? `${longTermMetric.currentWinRatePct.toFixed(1)}%`
              : 'No Data'}
          </span>
          <span
            className={`text-[10px] block mt-0.5 ${
              longTermMetric.trendDirection === 'IMPROVING'
                ? 'text-emerald-400'
                : longTermMetric.trendDirection === 'DECLINING'
                ? 'text-rose-400'
                : 'text-slate-400'
            }`}
          >
            {longTermMetric.totalTrades > 0
              ? `${longTermMetric.wins}W / ${longTermMetric.losses}L · ${formatDeltaPts(longTermMetric.deltaPctPoints)} (${formatTrendLabel(longTermMetric.trendDirection)})`
              : '0 Long-Term trades'}
          </span>
        </div>
      </div>

      {/* Empty State or Populated Recharts Line Visualization */}
      {summary.totalAnalyzedTrades === 0 ? (
        <div className="bg-slate-950/60 border border-slate-800 rounded-lg p-6 text-center space-y-3">
          <p className="text-xs text-slate-300">
            No {scope === 'CLOSED_ONLY' ? 'closed' : 'executed'} trades found in {activeRangeLabel} to plot Win Rate vs. Time.
          </p>
          {scope === 'CLOSED_ONLY' && positions.some((p) => p.status === 'OPEN') && (
            <button
              type="button"
              onClick={() => setScope('ALL_EXECUTED')}
              className="px-3 py-1.5 rounded bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-semibold transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              Include Open MTM Positions
            </button>
          )}
        </div>
      ) : (
        <div className="bg-slate-950/70 border border-slate-800 rounded-lg p-4 space-y-3">
          {/* Interactive Horizon Series Toggle Legend */}
          <div className="flex flex-wrap items-center justify-between gap-2 pb-2 border-b border-slate-800/80">
            <div
              role="group"
              aria-label="Toggle Horizon Trend Lines"
              className="flex flex-wrap items-center gap-2"
            >
              {SERIES_CONFIGS.map((cfg) => {
                const isActive = visibleSeries[cfg.key];
                const metric = summary.horizonMetrics[cfg.key];
                return (
                  <button
                    key={cfg.key}
                    type="button"
                    onClick={() => toggleSeries(cfg.key)}
                    aria-pressed={isActive}
                    className={`inline-flex items-center gap-2 px-2.5 py-1.5 rounded border text-xs font-mono transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                      isActive
                        ? 'bg-slate-900 border-slate-700 text-slate-100 font-semibold'
                        : 'bg-slate-950 border-slate-800/70 text-slate-500 hover:text-slate-300'
                    }`}
                  >
                    <span
                      aria-hidden="true"
                      className="inline-block w-3 h-0.5 shrink-0"
                      style={{
                        backgroundColor: isActive ? cfg.stroke : '#475569',
                      }}
                    />
                    <span>{cfg.label}</span>
                    <span className="text-[10px] text-slate-400 tabular-nums">
                      {metric.currentWinRatePct !== null
                        ? `${metric.currentWinRatePct.toFixed(0)}%`
                        : '—'}
                    </span>
                  </button>
                );
              })}
            </div>

            {Object.values(visibleSeries).some((v) => !v) && (
              <button
                type="button"
                onClick={showAllSeries}
                className="text-xs text-amber-400 hover:text-amber-300 font-mono whitespace-nowrap shrink-0 cursor-pointer"
              >
                Show All Horizons
              </button>
            )}
          </div>

          {/* Recharts Multi-Series LineChart */}
          <div className="w-full h-[300px] min-w-0" aria-label="Recharts Win Rate vs Time Line Chart">
            <ResponsiveContainer width="100%" height={300}>
              <LineChart
                data={summary.points}
                margin={{ top: 14, right: 20, left: 4, bottom: 8 }}
              >
                <CartesianGrid stroke="#1e293b" strokeDasharray="3 3" vertical={false} />
                <XAxis
                  dataKey="periodLabel"
                  stroke="#64748b"
                  tick={{ fill: '#94a3b8', fontSize: 11, fontFamily: 'monospace' }}
                  tickLine={{ stroke: '#334155' }}
                  minTickGap={18}
                />
                <YAxis
                  domain={[0, 100]}
                  ticks={[0, 25, 50, 75, 100]}
                  stroke="#64748b"
                  width={44}
                  tickFormatter={(v) => `${v}%`}
                  tick={{ fill: '#94a3b8', fontSize: 11, fontFamily: 'monospace' }}
                  tickLine={{ stroke: '#334155' }}
                />
                <ReferenceLine
                  y={50}
                  stroke="#64748b"
                  strokeDasharray="4 4"
                  label={{
                    value: '50% Parity',
                    position: 'insideTopRight',
                    fill: '#94a3b8',
                    fontSize: 10,
                    fontFamily: 'monospace',
                  }}
                />
                <Tooltip
                  content={<WinRateTooltip visibleSeries={visibleSeries} />}
                  cursor={{ stroke: '#475569', strokeDasharray: '3 3' }}
                />

                {SERIES_CONFIGS.filter((cfg) => visibleSeries[cfg.key]).map((cfg) => (
                  <Line
                    key={cfg.key}
                    type="monotone"
                    dataKey={cfg.dataKey}
                    name={cfg.label}
                    stroke={cfg.stroke}
                    strokeWidth={cfg.strokeWidth}
                    strokeDasharray={cfg.strokeDasharray}
                    connectNulls
                    dot={{ r: 3.5, fill: cfg.stroke, stroke: '#020617', strokeWidth: 1.5 }}
                    activeDot={{ r: 5.5, fill: cfg.stroke, stroke: '#f8fafc', strokeWidth: 1.5 }}
                    isAnimationActive={false}
                  />
                ))}
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* Quantitative Trend Interpretation Footer */}
      <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-slate-800/80 text-xs text-slate-300">
        <span>{summary.trendInsight}</span>
        <span className="font-mono text-[11px] text-slate-500 whitespace-nowrap">
          Click legend horizons to isolate trajectory lines
        </span>
      </div>
    </section>
  );
};
