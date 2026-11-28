/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * Aurum Intelligence — Trade Success Rate Gauge Widget
 *
 * Semi-circular radial D3 gauge tracking win/loss percentage across executed
 * trades (including live mark-to-market open positions or closed-only scope)
 * for immediate strategy performance feedback.
 */

import React, { useEffect, useMemo, useRef, useState } from 'react';
import * as d3 from 'd3';
import { PaperPosition, Quote } from '../domain/types';
import {
  calculateTradeSuccessRate,
  TradeSuccessRateScope,
} from '../services/portfolioScannerEngine';
import { Gauge, TrendingUp, AlertTriangle, CheckCircle2 } from 'lucide-react';

interface TradeSuccessRateGaugeProps {
  positions: PaperPosition[];
  quote: Quote;
  quotes?: Record<string, Quote>;
}

export const TradeSuccessRateGauge: React.FC<TradeSuccessRateGaugeProps> = ({
  positions,
  quote,
  quotes,
}) => {
  const [scope, setScope] = useState<TradeSuccessRateScope>('ALL_EXECUTED');
  const svgRef = useRef<SVGSVGElement | null>(null);

  const summary = useMemo(
    () => calculateTradeSuccessRate(positions, quotes, quote, { scope }),
    [positions, quotes, quote, scope]
  );

  useEffect(() => {
    const svgEl = svgRef.current;
    if (!svgEl) return;

    const svg = d3.select(svgEl);
    svg.selectAll('*').remove();

    const width = 320;
    const height = 186;
    svg.attr('viewBox', `0 0 ${width} ${height}`);

    const cx = width / 2;
    const cy = 148;
    const outerR = 112;
    const innerR = 84;
    const startAngle = -Math.PI / 2;
    const endAngle = Math.PI / 2;

    const g = svg.append('g').attr('transform', `translate(${cx},${cy})`);

    // Track arc (representing full 0% -> 100% scale, colored muted rose for remaining loss share)
    const trackArc = d3
      .arc<unknown>()
      .innerRadius(innerR)
      .outerRadius(outerR)
      .startAngle(startAngle)
      .endAngle(endAngle)
      .cornerRadius(4);

    g.append('path')
      .attr('d', trackArc({}) || '')
      .attr('fill', summary.evaluatedTradesCount > 0 ? 'rgba(244, 63, 94, 0.22)' : '#1e293b')
      .attr('stroke', '#334155')
      .attr('stroke-width', 1);

    // Active Win Rate arc
    const clampedPct = Math.max(0, Math.min(100, summary.winRatePct));
    const activeEndAngle = startAngle + (clampedPct / 100) * Math.PI;
    const arcColor =
      summary.performanceBand === 'OUTPERFORMING'
        ? '#10b981'
        : summary.performanceBand === 'COMPETITIVE'
        ? '#f59e0b'
        : summary.performanceBand === 'NEEDS_REVIEW'
        ? '#f43f5e'
        : '#475569';

    if (clampedPct > 0 && summary.evaluatedTradesCount > 0) {
      const winArc = d3
        .arc<unknown>()
        .innerRadius(innerR)
        .outerRadius(outerR)
        .startAngle(startAngle)
        .endAngle(activeEndAngle)
        .cornerRadius(4);

      g.append('path').attr('d', winArc({}) || '').attr('fill', arcColor);
    }

    // Benchmark tick marks (0%, 50% breakeven, 60% target, 100%)
    const ticks = [
      { pct: 0, label: '0%' },
      { pct: 50, label: '50%' },
      { pct: 60, label: '60%' },
      { pct: 100, label: '100%' },
    ];
    ticks.forEach((t) => {
      const theta = startAngle + (t.pct / 100) * Math.PI;
      const sinT = Math.sin(theta);
      const cosT = Math.cos(theta);
      const x1 = (innerR - 4) * sinT;
      const y1 = -(innerR - 4) * cosT;
      const x2 = (outerR + 5) * sinT;
      const y2 = -(outerR + 5) * cosT;

      g.append('line')
        .attr('x1', x1)
        .attr('y1', y1)
        .attr('x2', x2)
        .attr('y2', y2)
        .attr('stroke', t.pct === 50 ? '#fbbf24' : '#475569')
        .attr('stroke-width', t.pct === 50 ? 1.5 : 1);

      const lx = (outerR + 17) * sinT;
      const ly = -(outerR + 17) * cosT;
      g.append('text')
        .attr('x', lx)
        .attr('y', ly + 3)
        .attr('text-anchor', 'middle')
        .attr('fill', t.pct === 50 ? '#fbbf24' : '#94a3b8')
        .attr('font-size', '9.5px')
        .attr('font-family', 'ui-monospace, SFMono-Regular, monospace')
        .text(t.label);
    });

    // Precision needle pointer
    if (summary.evaluatedTradesCount > 0) {
      const needleAngle = activeEndAngle;
      const nx = (outerR + 2) * Math.sin(needleAngle);
      const ny = -(outerR + 2) * Math.cos(needleAngle);
      g.append('line')
        .attr('x1', 0)
        .attr('y1', 0)
        .attr('x2', nx * 0.72)
        .attr('y2', ny * 0.72)
        .attr('stroke', '#f8fafc')
        .attr('stroke-width', 2)
        .attr('stroke-linecap', 'round');

      g.append('circle').attr('cx', 0).attr('cy', 0).attr('r', 4.5).attr('fill', '#f8fafc');
    }

    // Center numeric readout
    g.append('text')
      .attr('x', 0)
      .attr('y', -36)
      .attr('text-anchor', 'middle')
      .attr('fill', summary.evaluatedTradesCount > 0 ? '#f8fafc' : '#64748b')
      .attr('font-size', '28px')
      .attr('font-weight', '700')
      .attr('font-family', 'ui-monospace, SFMono-Regular, monospace')
      .text(summary.evaluatedTradesCount > 0 ? `${summary.winRatePct.toFixed(1)}%` : '--');

    g.append('text')
      .attr('x', 0)
      .attr('y', -16)
      .attr('text-anchor', 'middle')
      .attr('fill', '#94a3b8')
      .attr('font-size', '10.5px')
      .attr('font-family', 'ui-monospace, SFMono-Regular, monospace')
      .text(
        summary.evaluatedTradesCount > 0
          ? `${summary.winCount}W / ${summary.lossCount}L (${summary.lossRatePct.toFixed(1)}% Loss)`
          : 'No Executed Trades'
      );
  }, [summary]);

  const bandLabel =
    summary.performanceBand === 'OUTPERFORMING'
      ? 'Outperforming Edge (>=60%)'
      : summary.performanceBand === 'COMPETITIVE'
      ? 'Balanced Accuracy (50–59%)'
      : summary.performanceBand === 'NEEDS_REVIEW'
      ? 'Below 50% Threshold'
      : 'Awaiting Trades';

  const bandTextColor =
    summary.performanceBand === 'OUTPERFORMING'
      ? 'text-emerald-400'
      : summary.performanceBand === 'COMPETITIVE'
      ? 'text-amber-400'
      : summary.performanceBand === 'NEEDS_REVIEW'
      ? 'text-rose-400'
      : 'text-slate-400';

  return (
    <section
      aria-label="Trade Success Rate Gauge"
      className="bg-slate-900 border border-slate-800 rounded-lg p-5 space-y-4"
    >
      {/* Header & Scope Filter */}
      <div className="flex flex-wrap items-center justify-between gap-4 pb-3 border-b border-slate-800">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <Gauge className="w-4 h-4 text-amber-400 shrink-0" aria-hidden="true" />
            <h3 className="text-base font-bold text-slate-100">
              Trade Success Rate
            </h3>
          </div>
          <div className="flex flex-wrap items-center gap-2 text-xs text-slate-400 mt-1">
            <span>{summary.evaluatedTradesCount} Executed Trades Evaluated</span>
            <span aria-hidden="true">·</span>
            <span className={`font-medium ${bandTextColor}`}>{bandLabel}</span>
            <span aria-hidden="true">·</span>
            <span>50% Institutional Benchmark</span>
          </div>
        </div>

        <div
          role="group"
          aria-label="Trade success rate scope"
          className="flex items-center gap-1 p-1 bg-slate-950 border border-slate-800 rounded-lg"
        >
          <button
            type="button"
            onClick={() => setScope('ALL_EXECUTED')}
            aria-pressed={scope === 'ALL_EXECUTED'}
            className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
              scope === 'ALL_EXECUTED'
                ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40 font-semibold'
                : 'text-slate-400 hover:text-slate-200 border border-transparent'
            }`}
          >
            All Executed
          </button>
          <button
            type="button"
            onClick={() => setScope('CLOSED_ONLY')}
            aria-pressed={scope === 'CLOSED_ONLY'}
            className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
              scope === 'CLOSED_ONLY'
                ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40 font-semibold'
                : 'text-slate-400 hover:text-slate-200 border border-transparent'
            }`}
          >
            Closed Only
          </button>
        </div>
      </div>

      {/* Radial Gauge + Strategy Performance Breakdown */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-center">
        <div className="lg:col-span-5 bg-slate-950/80 border border-slate-800 rounded-lg p-3 flex flex-col items-center">
          <svg
            ref={svgRef}
            className="w-full max-w-[320px] h-auto block select-none"
            role="img"
            aria-label={`Trade Success Rate radial gauge showing ${summary.winRatePct}% win rate across ${summary.evaluatedTradesCount} executed trades`}
          />
          <div className="w-full flex items-center justify-between pt-2 border-t border-slate-800/80 text-[11px] font-mono tabular-nums text-slate-400">
            <span className="text-emerald-400">Win: {summary.winRatePct.toFixed(1)}%</span>
            <span className="text-rose-400">Loss: {summary.lossRatePct.toFixed(1)}%</span>
          </div>
        </div>

        <div className="lg:col-span-7 space-y-3">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs font-mono tabular-nums">
            <div className="bg-slate-950/70 border border-slate-800 rounded p-3">
              <span className="block text-[11px] text-slate-400">Closed Hit Rate</span>
              <span className="block text-base font-bold text-slate-100 mt-0.5">
                {summary.closedWinRatePct.toFixed(1)}%
              </span>
              <span className="block text-[11px] text-slate-400 mt-0.5">
                {summary.closedWinCount}W / {summary.closedLossCount}L settled
              </span>
            </div>

            <div className="bg-slate-950/70 border border-slate-800 rounded p-3">
              <span className="block text-[11px] text-slate-400">Open Live MTM</span>
              <span className="block text-base font-bold text-amber-400 mt-0.5">
                {summary.openWinningCount}/{summary.openTradesCount} Winning
              </span>
              <span className="block text-[11px] text-slate-400 mt-0.5">
                {summary.openLosingCount} underwater
              </span>
            </div>

            <div className="bg-slate-950/70 border border-slate-800 rounded p-3">
              <span className="block text-[11px] text-slate-400">BUY vs SELL Split</span>
              <span className="block text-base font-bold text-slate-100 mt-0.5">
                {summary.buyWinRatePct}% / {summary.sellWinRatePct}%
              </span>
              <span className="block text-[11px] text-slate-400 mt-0.5">
                {summary.buyTotalCount} Long · {summary.sellTotalCount} Short
              </span>
            </div>

            <div className="bg-slate-950/70 border border-slate-800 rounded p-3">
              <span className="block text-[11px] text-slate-400">Active Streak</span>
              <span
                className={`block text-base font-bold mt-0.5 ${
                  summary.currentStreakType === 'WIN'
                    ? 'text-emerald-400'
                    : summary.currentStreakType === 'LOSS'
                    ? 'text-rose-400'
                    : 'text-slate-400'
                }`}
              >
                {summary.currentStreakCount}{' '}
                {summary.currentStreakType === 'WIN'
                  ? summary.currentStreakCount === 1
                    ? 'Win'
                    : 'Wins'
                  : summary.currentStreakType === 'LOSS'
                  ? summary.currentStreakCount === 1
                    ? 'Loss'
                    : 'Losses'
                  : 'Trades'}
              </span>
              <span className="block text-[11px] text-slate-400 mt-0.5">
                Trailing sequence
              </span>
            </div>
          </div>

          <div className="bg-slate-950/70 border border-slate-800 rounded-lg p-3 text-xs text-slate-300 flex items-start gap-2">
            {summary.performanceBand === 'OUTPERFORMING' ? (
              <TrendingUp className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" aria-hidden="true" />
            ) : summary.performanceBand === 'NEEDS_REVIEW' ? (
              <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" aria-hidden="true" />
            ) : (
              <CheckCircle2 className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" aria-hidden="true" />
            )}
            <span>{summary.feedbackMessage}</span>
          </div>
        </div>
      </div>
    </section>
  );
};
