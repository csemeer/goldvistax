/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * Aurum Intelligence — Daily Profit/Loss & Account Balance Progression Chart (Recharts)
 *
 * Plots daily realized/MTM Profit/Loss and cumulative account balance progression
 * over time, with high-water mark overlay and toggleable view modes.
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
  buildDailyProfitLossSeries,
  DailyPnlScopeMode,
  DailyPnlSeriesMode,
  DailyProfitLossPoint,
} from '../services/portfolioScannerEngine';
import { TrendingUp } from 'lucide-react';

interface DailyProfitLossChartProps {
  positions: PaperPosition[];
  startingCapital?: number;
  quote: Quote;
  quotes?: Record<string, Quote>;
  activeRangeLabel?: string;
}

function formatUsdCompact(val: number): string {
  const abs = Math.abs(val);
  const sign = val < 0 ? '-' : '';
  if (abs >= 1000) {
    return `${sign}$${(abs / 1000).toFixed(abs % 1000 === 0 ? 0 : 1)}k`;
  }
  return `${sign}$${abs.toFixed(0)}`;
}

function formatSignedUsd(val: number): string {
  const abs = Math.abs(val).toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  return val >= 0 ? `+$${abs}` : `-$${abs}`;
}

function formatBalanceUsd(val: number): string {
  return `$${val.toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

interface DailyPnlTooltipProps {
  active?: boolean;
  payload?: Array<{ payload?: DailyProfitLossPoint }>;
}

const DailyPnlTooltip: React.FC<DailyPnlTooltipProps> = ({ active, payload }) => {
  if (!active || !payload || payload.length === 0 || !payload[0]?.payload) {
    return null;
  }

  const pt = payload[0].payload;
  return (
    <div className="bg-slate-950 border border-slate-700 rounded-md p-3 shadow-lg text-xs font-mono tabular-nums min-w-[245px] space-y-2">
      <div className="border-b border-slate-800 pb-1.5">
        <div className="flex items-center justify-between gap-4 text-slate-100 font-bold">
          <span>
            {pt.dateKey} ({pt.dateLabel})
          </span>
          <span className={pt.dailyTotalPnlUsd >= 0 ? 'text-emerald-400' : 'text-rose-400'}>
            {formatSignedUsd(pt.dailyTotalPnlUsd)}
          </span>
        </div>
        <div className="text-[11px] text-slate-400 mt-0.5">
          {pt.tradesCount} trade(s) · {pt.winsCount}W / {pt.lossesCount}L · Daily Return{' '}
          {pt.dailyReturnPct >= 0 ? '+' : ''}
          {pt.dailyReturnPct.toFixed(2)}%
        </div>
      </div>

      <div className="space-y-1">
        <div className="flex items-center justify-between gap-4">
          <span className="text-slate-400">Account Balance</span>
          <span className="text-amber-300 font-bold">{formatBalanceUsd(pt.accountBalanceUsd)}</span>
        </div>
        <div className="flex items-center justify-between gap-4">
          <span className="text-slate-400">Cumulative Net P&amp;L</span>
          <span className={pt.cumulativePnlUsd >= 0 ? 'text-emerald-400 font-semibold' : 'text-rose-400 font-semibold'}>
            {formatSignedUsd(pt.cumulativePnlUsd)}
          </span>
        </div>
        <div className="flex items-center justify-between gap-4">
          <span className="text-slate-400">High-Water Mark</span>
          <span className="text-slate-200">{formatBalanceUsd(pt.highWaterMarkBalanceUsd)}</span>
        </div>
        <div className="flex items-center justify-between gap-4">
          <span className="text-slate-400">Drawdown From Peak</span>
          <span className={pt.drawdownFromPeakUsd > 0 ? 'text-rose-400' : 'text-slate-400'}>
            {pt.drawdownFromPeakUsd > 0
              ? `-${formatBalanceUsd(pt.drawdownFromPeakUsd)} (-${pt.drawdownFromPeakPct.toFixed(2)}%)`
              : '$0.00 (At Peak)'}
          </span>
        </div>
      </div>
    </div>
  );
};

export const DailyProfitLossChart: React.FC<DailyProfitLossChartProps> = ({
  positions,
  startingCapital = 100000,
  quote,
  quotes,
  activeRangeLabel = 'All Cycles',
}) => {
  const [seriesMode, setSeriesMode] = useState<DailyPnlSeriesMode>('ACCOUNT_BALANCE');
  const [scope, setScope] = useState<DailyPnlScopeMode>('ALL_EXECUTED');
  const [showHighWaterMark, setShowHighWaterMark] = useState<boolean>(true);

  const summary = useMemo(
    () =>
      buildDailyProfitLossSeries(positions, {
        startingCapitalUsd: startingCapital,
        scope,
        quotes,
        defaultQuote: quote,
      }),
    [positions, startingCapital, scope, quotes, quote]
  );

  const activeDataKey: keyof DailyProfitLossPoint =
    seriesMode === 'ACCOUNT_BALANCE'
      ? 'accountBalanceUsd'
      : seriesMode === 'CUMULATIVE_PNL'
      ? 'cumulativePnlUsd'
      : 'dailyTotalPnlUsd';

  const lineStroke =
    seriesMode === 'ACCOUNT_BALANCE'
      ? '#f59e0b'
      : summary.netPnlUsd >= 0
      ? '#10b981'
      : '#f43f5e';

  const baselineReferenceY =
    seriesMode === 'ACCOUNT_BALANCE' ? summary.startingCapitalUsd : 0;
  const baselineLabel =
    seriesMode === 'ACCOUNT_BALANCE'
      ? `Start ${formatUsdCompact(summary.startingCapitalUsd)}`
      : 'Break-Even $0';

  return (
    <section
      aria-label="Daily Profit/Loss and Account Balance Progression"
      className="bg-slate-900 border border-slate-800 rounded-lg p-5 space-y-5"
    >
      {/* Header & Interactive Mode Controls */}
      <div className="flex flex-wrap items-start justify-between gap-4 pb-3 border-b border-slate-800">
        <div>
          <h3 className="text-base font-bold text-slate-100 flex items-center gap-2">
            <TrendingUp className="w-4 h-4 text-amber-400 shrink-0" aria-hidden="true" />
            <span>Daily Profit/Loss &amp; Account Balance Progression</span>
          </h3>
          <div className="flex flex-wrap items-center gap-2 text-xs text-slate-400 mt-1">
            <span>Scope: {activeRangeLabel}</span>
            <span aria-hidden="true">·</span>
            <span className="font-mono tabular-nums">
              {summary.tradingDaysCount} active day(s)
            </span>
            <span aria-hidden="true">·</span>
            <span className="font-mono tabular-nums">
              Start Capital: {formatBalanceUsd(summary.startingCapitalUsd)}
            </span>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Metric Mode Selector */}
          <div
            role="group"
            aria-label="Daily Profit/Loss Chart Metric"
            className="flex items-center gap-1 p-1 bg-slate-950 border border-slate-800 rounded-lg"
          >
            {(
              [
                { id: 'ACCOUNT_BALANCE', label: 'Account Balance' },
                { id: 'CUMULATIVE_PNL', label: 'Cumulative P&L' },
                { id: 'DAILY_NET', label: 'Daily Net P&L' },
              ] as const
            ).map((opt) => (
              <button
                key={opt.id}
                type="button"
                onClick={() => setSeriesMode(opt.id)}
                aria-pressed={seriesMode === opt.id}
                className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                  seriesMode === opt.id
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
            aria-label="Daily Profit/Loss Trade Scope"
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

      {/* 4-Column Account Growth KPI Strip */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 text-xs font-mono tabular-nums">
        <div className="bg-slate-950/70 p-3 rounded border border-slate-800">
          <span className="text-slate-400 block text-[10px]">ENDING ACCOUNT BALANCE</span>
          <span className="text-base font-bold text-slate-100 block mt-0.5">
            {formatBalanceUsd(summary.endingBalanceUsd)}
          </span>
          <span
            className={`text-[10px] block mt-0.5 ${
              summary.netPnlUsd >= 0 ? 'text-emerald-400' : 'text-rose-400'
            }`}
          >
            {formatSignedUsd(summary.netPnlUsd)} ({summary.totalReturnPct >= 0 ? '+' : ''}
            {summary.totalReturnPct.toFixed(2)}%)
          </span>
        </div>

        <div className="bg-slate-950/70 p-3 rounded border border-slate-800">
          <span className="text-slate-400 block text-[10px]">PEAK EQUITY &amp; MAX DRAWDOWN</span>
          <span className="text-base font-bold text-amber-300 block mt-0.5">
            {formatBalanceUsd(summary.peakBalanceUsd)}
          </span>
          <span className="text-[10px] text-rose-400 block mt-0.5">
            Max DD: -{formatBalanceUsd(summary.maxDrawdownUsd)} (-{summary.maxDrawdownPct.toFixed(2)}%)
          </span>
        </div>

        <div className="bg-slate-950/70 p-3 rounded border border-slate-800">
          <span className="text-slate-400 block text-[10px]">DAILY WIN RATE</span>
          <span className="text-base font-bold text-slate-100 block mt-0.5">
            {summary.dailyWinRatePct.toFixed(1)}%
          </span>
          <span className="text-[10px] text-slate-400 block mt-0.5">
            {summary.profitableDaysCount} green / {summary.losingDaysCount} red day(s)
          </span>
        </div>

        <div className="bg-slate-950/70 p-3 rounded border border-slate-800">
          <span className="text-slate-400 block text-[10px]">BEST / WORST TRADING DAY</span>
          <span className="text-sm font-bold text-emerald-400 block mt-0.5">
            {summary.bestDay
              ? `${formatSignedUsd(summary.bestDay.dailyTotalPnlUsd)} (${summary.bestDay.dateLabel})`
              : 'No Data'}
          </span>
          <span className="text-[11px] text-rose-400 block mt-0.5">
            {summary.worstDay
              ? `Min: ${formatSignedUsd(summary.worstDay.dailyTotalPnlUsd)} (${summary.worstDay.dateLabel})`
              : '—'}
          </span>
        </div>
      </div>

      {/* Empty State or Recharts Progression Line Chart */}
      {summary.points.length === 0 ? (
        <div className="bg-slate-950/60 border border-slate-800 rounded-lg p-6 text-center space-y-3">
          <p className="text-xs text-slate-300">
            No {scope === 'CLOSED_ONLY' ? 'closed realized' : 'executed'} trades found in{' '}
            {activeRangeLabel} to chart Daily Profit/Loss progression.
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
          {/* Chart Legend & Optional High-Water Mark Overlay Toggle */}
          <div className="flex flex-wrap items-center justify-between gap-2 pb-2 border-b border-slate-800/80 text-xs font-mono">
            <div className="flex flex-wrap items-center gap-4">
              <span className="inline-flex items-center gap-2 text-slate-200">
                <span
                  aria-hidden="true"
                  className="inline-block w-3 h-0.5"
                  style={{ backgroundColor: lineStroke }}
                />
                <span>
                  {seriesMode === 'ACCOUNT_BALANCE'
                    ? 'Account Balance ($)'
                    : seriesMode === 'CUMULATIVE_PNL'
                    ? 'Cumulative Net P&L ($)'
                    : 'Daily Net P&L ($)'}
                </span>
              </span>

              {seriesMode === 'ACCOUNT_BALANCE' && showHighWaterMark && (
                <span className="inline-flex items-center gap-2 text-sky-300">
                  <span
                    aria-hidden="true"
                    className="inline-block w-3 h-0.5 bg-sky-400"
                  />
                  <span>High-Water Mark ($)</span>
                </span>
              )}
            </div>

            {seriesMode === 'ACCOUNT_BALANCE' && (
              <button
                type="button"
                onClick={() => setShowHighWaterMark((prev) => !prev)}
                aria-pressed={showHighWaterMark}
                className={`px-2.5 py-1 rounded border text-[11px] font-mono transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                  showHighWaterMark
                    ? 'bg-slate-900 border-sky-500/40 text-sky-300'
                    : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-slate-200'
                }`}
              >
                {showHighWaterMark ? 'Hide High-Water Mark' : 'Show High-Water Mark'}
              </button>
            )}
          </div>

          <div
            className="w-full h-[300px] min-w-0"
            aria-label="Recharts Daily Profit/Loss Account Balance Line Chart"
          >
            <ResponsiveContainer width="100%" height={300}>
              <LineChart
                data={summary.points}
                margin={{ top: 14, right: 20, left: 8, bottom: 8 }}
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
                  width={68}
                  domain={['auto', 'auto']}
                  tickFormatter={(v) => formatUsdCompact(Number(v))}
                  tick={{ fill: '#94a3b8', fontSize: 11, fontFamily: 'monospace' }}
                  tickLine={{ stroke: '#334155' }}
                />
                <ReferenceLine
                  y={baselineReferenceY}
                  stroke="#64748b"
                  strokeDasharray="4 4"
                  label={{
                    value: baselineLabel,
                    position: 'insideTopRight',
                    fill: '#94a3b8',
                    fontSize: 10,
                    fontFamily: 'monospace',
                  }}
                />
                <Tooltip
                  content={<DailyPnlTooltip />}
                  cursor={{ stroke: '#475569', strokeDasharray: '3 3' }}
                />

                {seriesMode === 'ACCOUNT_BALANCE' && showHighWaterMark && (
                  <Line
                    type="monotone"
                    dataKey="highWaterMarkBalanceUsd"
                    name="High-Water Mark"
                    stroke="#38bdf8"
                    strokeWidth={1.75}
                    strokeDasharray="4 4"
                    dot={false}
                    activeDot={{ r: 4, fill: '#38bdf8', stroke: '#020617', strokeWidth: 1.5 }}
                    isAnimationActive={false}
                  />
                )}

                <Line
                  type="monotone"
                  dataKey={activeDataKey}
                  name={
                    seriesMode === 'ACCOUNT_BALANCE'
                      ? 'Account Balance'
                      : seriesMode === 'CUMULATIVE_PNL'
                      ? 'Cumulative Net P&L'
                      : 'Daily Net P&L'
                  }
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

      {/* Growth Interpretation Footer */}
      <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-slate-800/80 text-xs text-slate-300">
        <span>{summary.growthInsight}</span>
        <span className="font-mono text-[11px] text-slate-500 whitespace-nowrap">
          Grouped chronologically by UTC trade date
        </span>
      </div>
    </section>
  );
};
