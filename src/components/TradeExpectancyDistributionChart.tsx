/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * Aurum Intelligence — Trade Expectancy Distribution & System Edge Chart
 *
 * Plots cumulative expectancy (R-multiples & USD) over closed trade history
 * alongside an R-multiple distribution histogram to visualize long-term edge.
 */

import React, { useEffect, useMemo, useRef, useState } from 'react';
import * as d3 from 'd3';
import { PaperPosition } from '../domain/types';
import {
  calculateTradeExpectancyDistribution,
  ExpectancySequencePoint,
} from '../services/portfolioScannerEngine';
import { BarChart3, CheckCircle2, TrendingUp, AlertTriangle } from 'lucide-react';

interface TradeExpectancyDistributionChartProps {
  positions: PaperPosition[];
}

type ExpectancyViewMode = 'CUMULATIVE_CURVE' | 'DISTRIBUTION';

export const TradeExpectancyDistributionChart: React.FC<
  TradeExpectancyDistributionChartProps
> = ({ positions }) => {
  const [viewMode, setViewMode] = useState<ExpectancyViewMode>('CUMULATIVE_CURVE');
  const [hoveredSeq, setHoveredSeq] = useState<ExpectancySequencePoint | null>(null);
  const [containerWidth, setContainerWidth] = useState<number>(780);

  const containerRef = useRef<HTMLDivElement | null>(null);
  const svgRef = useRef<SVGSVGElement | null>(null);

  const summary = useMemo(() => calculateTradeExpectancyDistribution(positions), [positions]);
  const activeSeq = hoveredSeq ?? summary.sequence[summary.sequence.length - 1] ?? null;

  useEffect(() => {
    const el = containerRef.current;
    if (!el || typeof ResizeObserver === 'undefined') return;
    const observer = new ResizeObserver((entries) => {
      const w = Math.max(360, Math.floor(entries[0]?.contentRect?.width || 780));
      setContainerWidth(w);
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const svgEl = svgRef.current;
    if (!svgEl) return;

    const svg = d3.select(svgEl);
    svg.selectAll('*').remove();

    const width = containerWidth;
    const height = 270;
    svg.attr('viewBox', `0 0 ${width} ${height}`);

    if (summary.closedTradesCount === 0) {
      svg
        .append('text')
        .attr('x', width / 2)
        .attr('y', height / 2)
        .attr('text-anchor', 'middle')
        .attr('fill', '#64748b')
        .attr('font-size', '12px')
        .attr('font-family', 'ui-monospace, SFMono-Regular, monospace')
        .text('Close at least one paper trade to plot cumulative expectancy distribution.');
      return;
    }

    if (viewMode === 'CUMULATIVE_CURVE') {
      const margin = { top: 24, right: 28, bottom: 42, left: 56 };
      const innerW = Math.max(200, width - margin.left - margin.right);
      const innerH = Math.max(140, height - margin.top - margin.bottom);

      const g = svg
        .append('g')
        .attr('transform', `translate(${margin.left},${margin.top})`);

      const seq = summary.sequence;
      const xMin = 0.7;
      const xMax = Math.max(1.3, seq.length + 0.3);
      const xScale = d3.scaleLinear().domain([xMin, xMax]).range([0, innerW]);

      const allRs = [
        0,
        ...seq.map((s) => s.cumulativeR),
        ...seq.map((s) => s.runningExpectancyR),
      ];
      const yMinRaw = Math.min(...allRs);
      const yMaxRaw = Math.max(...allRs);
      const yPad = Math.max(0.4, (yMaxRaw - yMinRaw) * 0.16);
      const yScale = d3
        .scaleLinear()
        .domain([yMinRaw - yPad, yMaxRaw + yPad])
        .range([innerH, 0]);

      // Horizontal grid lines
      g.selectAll('.exp-grid-y')
        .data(yScale.ticks(5))
        .enter()
        .append('line')
        .attr('x1', 0)
        .attr('x2', innerW)
        .attr('y1', (d) => yScale(d))
        .attr('y2', (d) => yScale(d))
        .attr('stroke', (d) => (d === 0 ? '#475569' : '#1e293b'))
        .attr('stroke-width', (d) => (d === 0 ? 1.4 : 1));

      // Zero baseline fill area for Cumulative R trajectory
      const areaGen = d3
        .area<ExpectancySequencePoint>()
        .x((d) => xScale(d.sequenceNumber))
        .y0(yScale(0))
        .y1((d) => yScale(d.cumulativeR))
        .curve(d3.curveMonotoneX);

      g.append('path')
        .datum(seq)
        .attr(
          'fill',
          summary.cumulativeExpectancyR >= 0
            ? 'rgba(16, 185, 129, 0.16)'
            : 'rgba(244, 63, 94, 0.16)'
        )
        .attr('d', areaGen);

      // Cumulative R solid curve
      const cumLine = d3
        .line<ExpectancySequencePoint>()
        .x((d) => xScale(d.sequenceNumber))
        .y((d) => yScale(d.cumulativeR))
        .curve(d3.curveMonotoneX);

      g.append('path')
        .datum(seq)
        .attr('fill', 'none')
        .attr('stroke', summary.cumulativeExpectancyR >= 0 ? '#10b981' : '#f43f5e')
        .attr('stroke-width', 2.4)
        .attr('d', cumLine);

      // Running Mean Expectancy per trade dashed curve
      const meanExpLine = d3
        .line<ExpectancySequencePoint>()
        .x((d) => xScale(d.sequenceNumber))
        .y((d) => yScale(d.runningExpectancyR))
        .curve(d3.curveMonotoneX);

      g.append('path')
        .datum(seq)
        .attr('fill', 'none')
        .attr('stroke', '#f59e0b')
        .attr('stroke-width', 1.75)
        .attr('stroke-dasharray', '4,3')
        .attr('d', meanExpLine);

      // Trade nodes
      g.selectAll('.exp-node')
        .data(seq)
        .enter()
        .append('circle')
        .attr('cx', (d) => xScale(d.sequenceNumber))
        .attr('cy', (d) => yScale(d.cumulativeR))
        .attr('r', 5)
        .attr('fill', (d) => (d.realizedPnlUsd >= 0 ? '#34d399' : '#fb7185'))
        .attr('stroke', '#0f172a')
        .attr('stroke-width', 1.5)
        .style('cursor', 'pointer')
        .on('mouseenter', (_e, d) => setHoveredSeq(d))
        .on('mouseleave', () => setHoveredSeq(null));

      // Trade label tags
      g.selectAll('.exp-label')
        .data(seq)
        .enter()
        .append('text')
        .attr('x', (d) => xScale(d.sequenceNumber))
        .attr('y', (d) => yScale(d.cumulativeR) - 9)
        .attr('text-anchor', 'middle')
        .attr('fill', '#cbd5e1')
        .attr('font-size', '10px')
        .attr('font-family', 'ui-monospace, SFMono-Regular, monospace')
        .text((d) => `${d.rMultiple >= 0 ? '+' : ''}${d.rMultiple.toFixed(1)}R`);

      // Axes
      const xAxis = d3
        .axisBottom(xScale)
        .tickValues(seq.map((s) => s.sequenceNumber))
        .tickFormat((n) => {
          const item = seq.find((s) => s.sequenceNumber === Number(n));
          return item ? `#${n} ${item.positionId}` : `#${n}`;
        });
      const yAxis = d3
        .axisLeft(yScale)
        .ticks(5)
        .tickFormat((v) => `${Number(v) >= 0 ? '+' : ''}${Number(v).toFixed(1)}R`);

      const xAxisG = g.append('g').attr('transform', `translate(0,${innerH})`).call(xAxis);
      xAxisG
        .selectAll('text')
        .attr('fill', '#94a3b8')
        .attr('font-size', '10px')
        .attr('font-family', 'ui-monospace, SFMono-Regular, monospace');
      xAxisG.selectAll('path,line').attr('stroke', '#334155');

      const yAxisG = g.append('g').call(yAxis);
      yAxisG
        .selectAll('text')
        .attr('fill', '#94a3b8')
        .attr('font-size', '10px')
        .attr('font-family', 'ui-monospace, SFMono-Regular, monospace');
      yAxisG.selectAll('path,line').attr('stroke', '#334155');

      g.append('text')
        .attr('x', innerW / 2)
        .attr('y', innerH + 34)
        .attr('text-anchor', 'middle')
        .attr('fill', '#cbd5e1')
        .attr('font-size', '11px')
        .attr('font-family', 'ui-monospace, SFMono-Regular, monospace')
        .text('Chronological Closed Trade Sequence');
    } else {
      // R-MULTIPLE DISTRIBUTION HISTOGRAM
      const margin = { top: 24, right: 24, bottom: 42, left: 48 };
      const innerW = Math.max(200, width - margin.left - margin.right);
      const innerH = Math.max(140, height - margin.top - margin.bottom);

      const g = svg
        .append('g')
        .attr('transform', `translate(${margin.left},${margin.top})`);

      const xBand = d3
        .scaleBand<string>()
        .domain(summary.buckets.map((b) => b.label))
        .range([0, innerW])
        .padding(0.28);

      const maxCount = Math.max(2, ...summary.buckets.map((b) => b.count));
      const yScale = d3.scaleLinear().domain([0, maxCount + 0.5]).range([innerH, 0]);

      g.selectAll('.hist-grid-y')
        .data(yScale.ticks(Math.min(5, maxCount + 1)))
        .enter()
        .append('line')
        .attr('x1', 0)
        .attr('x2', innerW)
        .attr('y1', (d) => yScale(d))
        .attr('y2', (d) => yScale(d))
        .attr('stroke', '#1e293b')
        .attr('stroke-width', 1);

      g.selectAll('.hist-bar')
        .data(summary.buckets)
        .enter()
        .append('rect')
        .attr('x', (b) => xBand(b.label) ?? 0)
        .attr('y', (b) => yScale(b.count))
        .attr('width', xBand.bandwidth())
        .attr('height', (b) => Math.max(0, innerH - yScale(b.count)))
        .attr('rx', 3)
        .attr('fill', (b) =>
          b.count === 0 ? '#1e293b' : b.isProfitableBucket ? '#10b981' : '#f43f5e'
        )
        .attr('fill-opacity', 0.85);

      g.selectAll('.hist-count')
        .data(summary.buckets)
        .enter()
        .append('text')
        .attr('x', (b) => (xBand(b.label) ?? 0) + xBand.bandwidth() / 2)
        .attr('y', (b) => yScale(b.count) - 7)
        .attr('text-anchor', 'middle')
        .attr('fill', '#e2e8f0')
        .attr('font-size', '10px')
        .attr('font-family', 'ui-monospace, SFMono-Regular, monospace')
        .text((b) => (b.count > 0 ? `${b.count} (${b.sharePct}%)` : '0'));

      const xAxis = d3.axisBottom(xBand);
      const yAxis = d3
        .axisLeft(yScale)
        .ticks(Math.min(5, maxCount + 1))
        .tickFormat((d) => `${Math.round(Number(d))}`);

      const xAxisG = g.append('g').attr('transform', `translate(0,${innerH})`).call(xAxis);
      xAxisG
        .selectAll('text')
        .attr('fill', '#cbd5e1')
        .attr('font-size', '10px')
        .attr('font-family', 'ui-monospace, SFMono-Regular, monospace');
      xAxisG.selectAll('path,line').attr('stroke', '#334155');

      const yAxisG = g.append('g').call(yAxis);
      yAxisG
        .selectAll('text')
        .attr('fill', '#94a3b8')
        .attr('font-size', '10px')
        .attr('font-family', 'ui-monospace, SFMono-Regular, monospace');
      yAxisG.selectAll('path,line').attr('stroke', '#334155');

      g.append('text')
        .attr('x', innerW / 2)
        .attr('y', innerH + 34)
        .attr('text-anchor', 'middle')
        .attr('fill', '#cbd5e1')
        .attr('font-size', '11px')
        .attr('font-family', 'ui-monospace, SFMono-Regular, monospace')
        .text('Closed Trade R-Multiple Outcome Distribution');
    }
  }, [containerWidth, summary, viewMode]);

  return (
    <section
      aria-label="Trade Expectancy Distribution Chart"
      className="bg-slate-900 border border-slate-800 rounded-lg p-5 space-y-4"
    >
      {/* Header & Mode Switcher */}
      <div className="flex flex-wrap items-center justify-between gap-4 pb-3 border-b border-slate-800">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <BarChart3 className="w-4 h-4 text-amber-400 shrink-0" aria-hidden="true" />
            <h3 className="text-base font-bold text-slate-100">
              Trade Expectancy Distribution
            </h3>
            <span
              className={`text-[11px] font-mono font-semibold px-2 py-0.5 rounded border ${
                summary.edgeStatus === 'POSITIVE_EDGE'
                  ? 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30'
                  : summary.edgeStatus === 'NEGATIVE_EDGE'
                  ? 'bg-rose-500/15 text-rose-300 border-rose-500/30'
                  : 'bg-slate-800 text-slate-300 border-slate-700'
              }`}
            >
              {summary.edgeStatus.replace(/_/g, ' ')}
            </span>
          </div>
          <p className="text-xs text-slate-400 mt-1">
            Calculates cumulative expectancy across closed trades (R-multiples &amp; USD) to quantify long-term system edge.
          </p>
        </div>

        <div
          role="group"
          aria-label="Expectancy chart view mode"
          className="flex items-center gap-1 p-1 bg-slate-950 border border-slate-800 rounded-lg"
        >
          <button
            type="button"
            onClick={() => setViewMode('CUMULATIVE_CURVE')}
            aria-pressed={viewMode === 'CUMULATIVE_CURVE'}
            className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
              viewMode === 'CUMULATIVE_CURVE'
                ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40 font-semibold'
                : 'text-slate-400 hover:text-slate-200 border border-transparent'
            }`}
          >
            Cumulative Expectancy
          </button>
          <button
            type="button"
            onClick={() => setViewMode('DISTRIBUTION')}
            aria-pressed={viewMode === 'DISTRIBUTION'}
            className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
              viewMode === 'DISTRIBUTION'
                ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40 font-semibold'
                : 'text-slate-400 hover:text-slate-200 border border-transparent'
            }`}
          >
            R-Multiple Distribution
          </button>
        </div>
      </div>

      {/* System Edge KPI Bar */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs font-mono tabular-nums">
        <div className="bg-slate-950/70 border border-slate-800 rounded p-3">
          <span className="block text-[10px] text-slate-500 uppercase">Expectancy / Trade</span>
          <span
            className={`block text-base font-bold mt-0.5 ${
              summary.expectancyPerTradeR >= 0 ? 'text-emerald-400' : 'text-rose-400'
            }`}
          >
            {summary.expectancyPerTradeR >= 0 ? '+' : ''}
            {summary.expectancyPerTradeR.toFixed(2)}R
          </span>
          <span className="block text-[10px] text-slate-400 mt-0.5">
            {summary.expectancyPerTradeUsd >= 0 ? '+' : '-'}$
            {Math.abs(summary.expectancyPerTradeUsd).toLocaleString()} avg/trade
          </span>
        </div>

        <div className="bg-slate-950/70 border border-slate-800 rounded p-3">
          <span className="block text-[10px] text-slate-500 uppercase">Cumulative Edge</span>
          <span
            className={`block text-base font-bold mt-0.5 ${
              summary.cumulativeExpectancyR >= 0 ? 'text-emerald-400' : 'text-rose-400'
            }`}
          >
            {summary.cumulativeExpectancyR >= 0 ? '+' : ''}
            {summary.cumulativeExpectancyR.toFixed(2)}R
          </span>
          <span className="block text-[10px] text-slate-400 mt-0.5">
            Net P&amp;L: {summary.cumulativeRealizedPnlUsd >= 0 ? '+' : '-'}$
            {Math.abs(summary.cumulativeRealizedPnlUsd).toLocaleString()}
          </span>
        </div>

        <div className="bg-slate-950/70 border border-slate-800 rounded p-3">
          <span className="block text-[10px] text-slate-500 uppercase">Win Rate · Payoff</span>
          <span className="block text-base font-bold text-slate-100 mt-0.5">
            {summary.winRatePct}% · {summary.payoffRatio}:1
          </span>
          <span className="block text-[10px] text-slate-400 mt-0.5">
            Avg W: +{summary.avgWinR}R / L: -{summary.avgLossR}R
          </span>
        </div>

        <div className="bg-slate-950/70 border border-slate-800 rounded p-3">
          <span className="block text-[10px] text-slate-500 uppercase">Profit Factor</span>
          <span className="block text-base font-bold text-amber-400 mt-0.5">
            {summary.profitFactor.toFixed(2)}x
          </span>
          <span className="block text-[10px] text-slate-400 mt-0.5">
            {summary.closedTradesCount} closed trades ({summary.winCount}W / {summary.lossCount}L)
          </span>
        </div>
      </div>

      {/* D3 SVG Canvas */}
      <div
        ref={containerRef}
        className="w-full bg-slate-950/80 border border-slate-800 rounded-lg p-2.5 overflow-hidden"
      >
        <svg
          ref={svgRef}
          className="w-full h-auto block select-none"
          role="img"
          aria-label="Trade Expectancy Distribution D3 chart showing cumulative R-multiple expectancy and trade outcome distribution"
        />

        <div className="flex flex-wrap items-center justify-between gap-3 px-2 pt-2 border-t border-slate-800/80 text-[11px] font-mono text-slate-400">
          {viewMode === 'CUMULATIVE_CURVE' ? (
            <div className="flex flex-wrap items-center gap-4">
              <span className="inline-flex items-center gap-1.5 text-emerald-400">
                <span aria-hidden="true">━</span>
                <span>Cumulative System Edge (R)</span>
              </span>
              <span className="inline-flex items-center gap-1.5 text-amber-400">
                <span aria-hidden="true">┄</span>
                <span>Running Mean Expectancy / Trade</span>
              </span>
            </div>
          ) : (
            <div className="flex flex-wrap items-center gap-4">
              <span className="inline-flex items-center gap-1.5 text-emerald-400">
                <span aria-hidden="true">■</span>
                <span>Profitable Expectancy Bins (&gt;0R)</span>
              </span>
              <span className="inline-flex items-center gap-1.5 text-rose-400">
                <span aria-hidden="true">■</span>
                <span>Loss Bins (&lt;0R)</span>
              </span>
            </div>
          )}
          <span>E = (Win% × AvgWin) - (Loss% × AvgLoss)</span>
        </div>
      </div>

      {/* Hovered Trade Readout + Edge Summary */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-3 items-stretch">
        {activeSeq && (
          <div className="lg:col-span-6 bg-slate-950/70 border border-slate-800 rounded-lg p-3 text-xs font-mono tabular-nums grid grid-cols-2 sm:grid-cols-4 gap-2">
            <div>
              <span className="block text-[10px] text-slate-500">CLOSED TRADE</span>
              <span className="font-bold text-slate-100">
                #{activeSeq.sequenceNumber} {activeSeq.positionId}
              </span>
            </div>
            <div>
              <span className="block text-[10px] text-slate-500">TRADE R-MULT</span>
              <span
                className={`font-bold ${
                  activeSeq.rMultiple >= 0 ? 'text-emerald-400' : 'text-rose-400'
                }`}
              >
                {activeSeq.rMultiple >= 0 ? '+' : ''}
                {activeSeq.rMultiple.toFixed(2)}R
              </span>
            </div>
            <div>
              <span className="block text-[10px] text-slate-500">CUMULATIVE R</span>
              <span className="font-bold text-slate-200">
                {activeSeq.cumulativeR >= 0 ? '+' : ''}
                {activeSeq.cumulativeR.toFixed(2)}R
              </span>
            </div>
            <div>
              <span className="block text-[10px] text-slate-500">RUNNING E[R]</span>
              <span className="font-bold text-amber-400">
                {activeSeq.runningExpectancyR >= 0 ? '+' : ''}
                {activeSeq.runningExpectancyR.toFixed(2)}R
              </span>
            </div>
          </div>
        )}

        <div
          className={`bg-slate-950/70 border border-slate-800 rounded-lg p-3 text-xs flex items-start gap-2 ${
            activeSeq ? 'lg:col-span-6' : 'lg:col-span-12'
          } text-slate-300`}
        >
          {summary.edgeStatus === 'POSITIVE_EDGE' ? (
            <TrendingUp className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" aria-hidden="true" />
          ) : summary.edgeStatus === 'NEGATIVE_EDGE' ? (
            <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" aria-hidden="true" />
          ) : (
            <CheckCircle2 className="w-4 h-4 text-slate-400 shrink-0 mt-0.5" aria-hidden="true" />
          )}
          <span>{summary.edgeSummary}</span>
        </div>
      </div>
    </section>
  );
};
