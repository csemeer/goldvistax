/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * Aurum Intelligence — Daily Portfolio ROI & Compound Growth Chart (Recharts)
 *
 * Plots daily percentage Return on Invested Capital (ROIC) and geometric
 * compound portfolio ROI (%) trajectories over chronological UTC trading days.
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
  buildDailyPortfolioRoiSeries,
  DailyPnlScopeMode,
  DailyPortfolioRoiPoint,
  DailyRoiViewMode,
} from '../services/portfolioScannerEngine';
import { Percent } from 'lucide-react';

interface DailyPortfolioRoiChartProps {
  positions: PaperPosition[];
  startingCapital?: number;
  assumedLeverage?: number;
  quote: Quote;
  quotes?: Record<string, Quote>;
  activeRangeLabel?: string;
}

function formatSignedPct(val: number): string {
  return `${val >= 0 ? '+' : ''}${val.toFixed(2)}%`;
}

function formatSignedUsd(val: number): string {
  const abs = Math.abs(val).toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  return val >= 0 ? `+$${abs}` : `-$${abs}`;
}

function formatUsd(val: number): string {
  return `$${val.toLocaleString('en-US', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  })}`;
}

interface DailyRoiTooltipProps {
  active?: boolean;
  payload?: Array<{ payload?: DailyPortfolioRoiPoint }>;
}

const DailyRoiTooltip: React.FC<DailyRoiTooltipProps> = ({ active, payload }) => {
  if (!active || !payload || payload.length === 0 || !payload[0]?.payload) {
    return null;
  }

  const pt = payload[0].payload;
  return (
    <div className="bg-slate-950 border border-slate-700 rounded-md p-3 shadow-lg text-xs font-mono tabular-nums min-w-[260px] space-y-2">
      <div className="border-b border-slate-800 pb-1.5">
        <div className="flex items-center justify-between gap-4 text-slate-100 font-bold">
          <span>
            {pt.dateKey} ({pt.dateLabel})
          </span>
          <span
            className={
              pt.compoundPortfolioRoiPct >= 0 ? 'text-emerald-400' : 'text-rose-400'
            }
          >
            {formatSignedPct(pt.compoundPortfolioRoiPct)}
          </span>
        </div>
        <div className="text-[11px] text-slate-400 mt-0.5">
          {pt.tradesCount} trade(s) · Daily Net {formatSignedUsd(pt.dailyPnlUsd)}
        </div>
      </div>

      <div className="space-y-1">
        <div className="flex items-center justify-between gap-4">
          <span className="text-slate-400">Invested Margin Capital</span>
          <span className="text-slate-200">{formatUsd(pt.dailyInvestedCapitalUsd)}</span>
        </div>
        <div className="flex items-center justify-between gap-4">
          <span className="text-slate-400">Daily Return on Capital</span>
          <span
            className={
              pt.dailyReturnOnInvestedCapitalPct >= 0
                ? 'text-emerald-400 font-semibold'
                : 'text-rose-400 font-semibold'
            }
          >
            {formatSignedPct(pt.dailyReturnOnInvestedCapitalPct)}
          </span>
        </div>
        <div className="flex items-center justify-between gap-4">
          <span className="text-slate-400">Daily Equity Return</span>
          <span
            className={
              pt.dailyEquityReturnPct >= 0 ? 'text-sky-300' : 'text-rose-400'
            }
          >
            {formatSignedPct(pt.dailyEquityReturnPct)}
          </span>
        </div>
        <div className="flex items-center justify-between gap-4">
          <span className="text-slate-400">Compound Growth Factor</span>
          <span className="text-amber-300 font-bold">
            {pt.compoundGrowthFactor.toFixed(4)}x
          </span>
        </div>
      </div>
    </div>
  );
};

export const DailyPortfolioRoiChart: React.FC<DailyPortfolioRoiChartProps> = ({
  positions,
  startingCapital = 100000,
  assumedLeverage = 30,
  quote,
  quotes,
  activeRangeLabel = 'All Cycles',
}) => {
  const [viewMode, setViewMode] = useState<DailyRoiViewMode>('COMPOUND_ROI');
  const [scope, setScope] = useState<DailyPnlScopeMode>('ALL_EXECUTED');

  const summary = useMemo(
    () =>
      buildDailyPortfolioRoiSeries(positions, {
        startingCapitalUsd: startingCapital,
        assumedLeverage,
        scope,
        quotes,
        defaultQuote: quote,
      }),
    [positions, startingCapital, assumedLeverage, scope, quotes, quote]
  );

  const activeDataKey: keyof DailyPortfolioRoiPoint =
    viewMode === 'COMPOUND_ROI'
      ? 'compoundPortfolioRoiPct'
      : viewMode === 'DAILY_ROIC'
      ? 'dailyReturnOnInvestedCapitalPct'
      : 'dailyEquityReturnPct';

  const lineStroke =
    viewMode === 'COMPOUND_ROI'
      ? summary.compoundPortfolioRoiPct >= 0
        ? '#10b981'
        : '#f43f5e'
      : viewMode === 'DAILY_ROIC'
      ? '#38bdf8'
      : '#f59e0b';

  const seriesLabel =
    viewMode === 'COMPOUND_ROI'
      ? 'Compound Portfolio ROI (%)'
      : viewMode === 'DAILY_ROIC'
      ? 'Daily Return on Invested Capital (%)'
      : 'Daily Equity Return (%)';

  return (
    <section
      aria-label="Daily Portfolio ROI and Compound Growth"
      className="bg-slate-900 border border-slate-800 rounded-lg p-5 space-y-5"
    >
      {/* Header & Controls */}
      <div className="flex flex-wrap items-start justify-between gap-4 pb-3 border-b border-slate-800">
        <div>
          <h3 className="text-base font-bold text-slate-100 flex items-center gap-2">
            <Percent className="w-4 h-4 text-emerald-400 shrink-0" aria-hidden="true" />
            <span>Daily Portfolio ROI &amp; Compound Growth Trajectory</span>
          </h3>
          <div className="flex flex-wrap items-center gap-2 text-xs text-slate-400 mt-1">
            <span>Scope: {activeRangeLabel}</span>
            <span aria-hidden="true">·</span>
            <span className="font-mono tabular-nums">
              {summary.tradingDaysCount} trading day(s)
            </span>
            <span aria-hidden="true">·</span>
            <span className="font-mono tabular-nums">
              Margin Basis: {summary.assumedLeverage}:1 Leverage
            </span>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* ROI Metric Mode Selector */}
          <div
            role="group"
            aria-label="Daily Portfolio ROI View Mode"
            className="flex items-center gap-1 p-1 bg-slate-950 border border-slate-800 rounded-lg"
          >
            {(
              [
                { id: 'COMPOUND_ROI', label: 'Compound Growth %' },
                { id: 'DAILY_ROIC', label: 'Daily Capital ROI %' },
                { id: 'DAILY_EQUITY_ROI', label: 'Daily Equity %' },
              ] as const
            ).map((opt) => (
              <button
                key={opt.id}
                type="button"
                onClick={() => setViewMode(opt.id)}
                aria-pressed={viewMode === opt.id}
                className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                  viewMode === opt.id
                    ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40 font-semibold'
                    : 'text-slate-400 hover:text-slate-200 border border-transparent'
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>

          {/* Scope Selector */}
          <div
            role="group"
            aria-label="Daily Portfolio ROI Trade Scope"
            className="flex items-center gap-1 p-1 bg-slate-950 border border-slate-800 rounded-lg"
          >
            {(
              [
                { id: 'ALL_EXECUTED', label: 'Incl. Open MTM' },
                { id: 'CLOSED_ONLY', label: 'Closed Realized' },
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

      {/* 4-Column Compound & ROIC KPI Strip */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 text-xs font-mono tabular-nums">
        <div className="bg-slate-950/70 p-3 rounded border border-slate-800">
          <span className="text-slate-400 block text-[10px]">COMPOUND PORTFOLIO ROI</span>
          <span
            className={`text-base font-bold block mt-0.5 ${
              summary.compoundPortfolioRoiPct >= 0 ? 'text-emerald-400' : 'text-rose-400'
            }`}
          >
            {formatSignedPct(summary.compoundPortfolioRoiPct)}
          </span>
          <span className="text-[10px] text-slate-400 block mt-0.5">
            Growth Factor:{' '}
            {(
              summary.points[summary.points.length - 1]?.compoundGrowthFactor ?? 1
            ).toFixed(4)}
            x
          </span>
        </div>

        <div className="bg-slate-950/70 p-3 rounded border border-slate-800">
          <span className="text-slate-400 block text-[10px]">RETURN ON INVESTED CAPITAL</span>
          <span
            className={`text-base font-bold block mt-0.5 ${
              summary.totalInvestedCapitalRoiPct >= 0 ? 'text-sky-300' : 'text-rose-400'
            }`}
          >
            {formatSignedPct(summary.totalInvestedCapitalRoiPct)}
          </span>
          <span className="text-[10px] text-slate-400 block mt-0.5">
            Total Deployed: {formatUsd(summary.totalInvestedCapitalUsd)}
          </span>
        </div>

        <div className="bg-slate-950/70 p-3 rounded border border-slate-800">
          <span className="text-slate-400 block text-[10px]">GEOMETRIC DAILY MEAN</span>
          <span
            className={`text-base font-bold block mt-0.5 ${
              summary.geometricMeanDailyReturnPct >= 0 ? 'text-amber-300' : 'text-rose-400'
            }`}
          >
            {formatSignedPct(summary.geometricMeanDailyReturnPct)} / day
          </span>
          <span className="text-[10px] text-slate-400 block mt-0.5">
            Avg Daily ROIC: {formatSignedPct(summary.avgDailyRoicPct)}
          </span>
        </div>

        <div className="bg-slate-950/70 p-3 rounded border border-slate-800">
          <span className="text-slate-400 block text-[10px]">PEAK / TROUGH DAILY ROIC</span>
          <span className="text-sm font-bold text-emerald-400 block mt-0.5">
            {summary.bestRoicDay
              ? `${formatSignedPct(summary.bestRoicDay.dailyReturnOnInvestedCapitalPct)} (${
                  summary.bestRoicDay.dateLabel
                })`
              : 'No Data'}
          </span>
          <span className="text-[11px] text-rose-400 block mt-0.5">
            {summary.worstRoicDay
              ? `Min: ${formatSignedPct(summary.worstRoicDay.dailyReturnOnInvestedCapitalPct)} (${
                  summary.worstRoicDay.dateLabel
                })`
              : '—'}
          </span>
        </div>
      </div>

      {/* Empty State or Recharts Line Visualization */}
      {summary.points.length === 0 ? (
        <div className="bg-slate-950/60 border border-slate-800 rounded-lg p-6 text-center space-y-3">
          <p className="text-xs text-slate-300">
            No {scope === 'CLOSED_ONLY' ? 'closed realized' : 'executed'} trades found in{' '}
            {activeRangeLabel} to chart Daily Portfolio ROI.
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
          <div className="flex flex-wrap items-center justify-between gap-2 pb-2 border-b border-slate-800/80 text-xs font-mono">
            <span className="inline-flex items-center gap-2 text-slate-200">
              <span
                aria-hidden="true"
                className="inline-block w-3 h-0.5"
                style={{ backgroundColor: lineStroke }}
              />
              <span>{seriesLabel}</span>
            </span>
            <span className="text-[11px] text-slate-400">
              Starting Parity: 0.00% ({formatUsd(summary.startingCapitalUsd)})
            </span>
          </div>

          <div
            className="w-full h-[300px] min-w-0"
            aria-label="Recharts Daily Portfolio ROI Line Chart"
          >
            <ResponsiveContainer width="100%" height={300}>
              <LineChart
                data={summary.points}
                margin={{ top: 14, right: 20, left: 4, bottom: 8 }}
              >
                <CartesianGrid stroke="#1e293b" strokeDasharray="3 3" vertical={false} />
                <XAxis
                  dataKey="dateLabel"
                  stroke="#64748b"
                  tick={{ fill: '#94a3b8', fontSize: 11, fontFamily: 'monospace' }}
                  tickLine={{ stroke: '#334155' }}
                  minTickGap={18}
                />
                <YAxis
                  stroke="#64748b"
                  width={58}
                  domain={['auto', 'auto']}
                  tickFormatter={(v) => `${Number(v).toFixed(1)}%`}
                  tick={{ fill: '#94a3b8', fontSize: 11, fontFamily: 'monospace' }}
                  tickLine={{ stroke: '#334155' }}
                />
                <ReferenceLine
                  y={0}
                  stroke="#64748b"
                  strokeDasharray="4 4"
                  label={{
                    value: '0% Baseline',
                    position: 'insideTopRight',
                    fill: '#94a3b8',
                    fontSize: 10,
                    fontFamily: 'monospace',
                  }}
                />
                <Tooltip
                  content={<DailyRoiTooltip />}
                  cursor={{ stroke: '#475569', strokeDasharray: '3 3' }}
                />
                <Line
                  type="monotone"
                  dataKey={activeDataKey}
                  name={seriesLabel}
                  stroke={lineStroke}
                  strokeWidth={2.5}
                  dot={{ r: 3.5, fill: lineStroke, stroke: '#020617', strokeWidth: 1.5 }}
                  activeDot={{ r: 5.5, fill: lineStroke, stroke: '#f8fafc', strokeWidth: 1.5 }}
                  isAnimationActive={false}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* Compound Growth Interpretation Footer */}
      <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-slate-800/80 text-xs text-slate-300">
        <span>{summary.compoundInsight}</span>
        <span className="font-mono text-[11px] text-slate-500 whitespace-nowrap">
          ROIC based on {summary.assumedLeverage}:1 margin capital deployed per trading day
        </span>
      </div>
    </section>
  );
};
