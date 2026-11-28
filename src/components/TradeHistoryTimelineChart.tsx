/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * Aurum Intelligence — Chronological Trade History Timeline & Visual Post-Mortem Chart
 *
 * Maps entries, exits, stop-loss boundaries, target zones, and max adverse
 * excursions onto a historical price chart across all Journaled positions,
 * enabling both macro chronological inspection and per-trade candlestick post-mortems.
 */

import React, { useEffect, useMemo, useRef, useState } from 'react';
import * as d3 from 'd3';
import { PaperPosition, Quote } from '../domain/types';
import {
  buildTradePostMortemTimeline,
  PostMortemCandle,
  PostMortemPricePoint,
  SelectedHorizonFilter,
  TradePostMortemEntry,
} from '../services/portfolioScannerEngine';
import { ChevronLeft, ChevronRight, History } from 'lucide-react';

interface TradeHistoryTimelineChartProps {
  positions: PaperPosition[];
  quote: Quote;
  quotes?: Record<string, Quote>;
  startingCapital?: number;
  activeRangeLabel?: string;
  externalSelectedPositionId?: string | null;
}

type TimelineViewMode = 'OVERVIEW' | 'POST_MORTEM';

function formatSignedUsd(val: number): string {
  const abs = Math.abs(val).toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  return val >= 0 ? `+$${abs}` : `-$${abs}`;
}

export const TradeHistoryTimelineChart: React.FC<TradeHistoryTimelineChartProps> = ({
  positions,
  quote,
  quotes,
  startingCapital = 100000,
  activeRangeLabel = 'All Cycles',
  externalSelectedPositionId = null,
}) => {
  const [horizonFilter, setHorizonFilter] = useState<SelectedHorizonFilter>('ALL');
  const [viewMode, setViewMode] = useState<TimelineViewMode>('OVERVIEW');
  const [selectedPositionId, setSelectedPositionId] = useState<string | null>(null);

  const svgRef = useRef<SVGSVGElement | null>(null);

  const timeline = useMemo(
    () =>
      buildTradePostMortemTimeline(positions, {
        horizonFilter,
        quotes,
        defaultQuote: quote,
        startingCapitalUsd: startingCapital,
      }),
    [positions, horizonFilter, quotes, quote, startingCapital]
  );

  // Sync external post-mortem inspection requests (e.g. clicking "Inspect Post-Mortem" on a journal log item)
  useEffect(() => {
    if (!externalSelectedPositionId) return;
    const match = timeline.entries.find((e) => e.positionId === externalSelectedPositionId);
    if (match) {
      setSelectedPositionId(match.positionId);
      setViewMode('POST_MORTEM');
    } else if (horizonFilter !== 'ALL') {
      setHorizonFilter('ALL');
      setSelectedPositionId(externalSelectedPositionId);
      setViewMode('POST_MORTEM');
    }
  }, [externalSelectedPositionId, horizonFilter, timeline.entries]);

  // Keep selectedPositionId valid whenever filters change
  useEffect(() => {
    if (timeline.entries.length === 0) {
      setSelectedPositionId(null);
      return;
    }
    if (
      !selectedPositionId ||
      !timeline.entries.some((e) => e.positionId === selectedPositionId)
    ) {
      setSelectedPositionId(timeline.entries[timeline.entries.length - 1].positionId);
    }
  }, [selectedPositionId, timeline.entries]);

  const selectedEntry: TradePostMortemEntry | null = useMemo(() => {
    if (timeline.entries.length === 0) return null;
    return (
      timeline.entries.find((e) => e.positionId === selectedPositionId) ??
      timeline.entries[timeline.entries.length - 1]
    );
  }, [selectedPositionId, timeline.entries]);

  const selectedIndex = selectedEntry
    ? timeline.entries.findIndex((e) => e.positionId === selectedEntry.positionId)
    : -1;

  // Render D3 SVG Historical Timeline OR Zoomed Candlestick Trade Post-Mortem
  useEffect(() => {
    const svgEl = svgRef.current;
    if (!svgEl || timeline.entries.length === 0) return;

    const svg = d3.select(svgEl);
    svg.selectAll('*').remove();

    const width = 820;
    const height = 310;
    const margin = { top: 24, right: 78, bottom: 34, left: 20 };
    const innerW = width - margin.left - margin.right;
    const innerH = height - margin.top - margin.bottom;

    svg.attr('viewBox', `0 0 ${width} ${height}`);
    const g = svg.append('g').attr('transform', `translate(${margin.left},${margin.top})`);

    if (viewMode === 'OVERVIEW') {
      const series = timeline.priceSeries;
      if (series.length < 2) return;

      const xScale = d3
        .scaleTime()
        .domain([new Date(timeline.startTimeMs), new Date(timeline.endTimeMs)])
        .range([0, innerW]);

      const pad = Math.max(25, (timeline.priceMax - timeline.priceMin) * 0.08);
      const yScale = d3
        .scaleLinear()
        .domain([timeline.priceMin - pad, timeline.priceMax + pad])
        .range([innerH, 0]);

      // Horizontal price grid lines
      g.selectAll('.timeline-grid-y')
        .data(yScale.ticks(5))
        .enter()
        .append('line')
        .attr('x1', 0)
        .attr('x2', innerW)
        .attr('y1', (d) => yScale(d))
        .attr('y2', (d) => yScale(d))
        .attr('stroke', '#1e293b')
        .attr('stroke-width', 1);

      // Historical Price Area Fill
      const areaGen = d3
        .area<PostMortemPricePoint>()
        .x((d) => xScale(new Date(d.timestampMs)))
        .y0(innerH)
        .y1((d) => yScale(d.price))
        .curve(d3.curveMonotoneX);

      g.append('path')
        .datum(series)
        .attr('fill', 'rgba(148, 163, 184, 0.08)')
        .attr('stroke', 'none')
        .attr('d', areaGen);

      // Continuous Historical Price Line
      const lineGen = d3
        .line<PostMortemPricePoint>()
        .x((d) => xScale(new Date(d.timestampMs)))
        .y((d) => yScale(d.price))
        .curve(d3.curveMonotoneX);

      g.append('path')
        .datum(series)
        .attr('fill', 'none')
        .attr('stroke', '#94a3b8')
        .attr('stroke-width', 1.6)
        .attr('d', lineGen);

      // Render each trade's Stop-Loss shelf, Entry-to-Exit vector, and Markers
      for (const tr of timeline.entries) {
        const isSelected = selectedEntry?.positionId === tr.positionId;
        const x1 = xScale(new Date(tr.entryTimeMs));
        const x2 = xScale(new Date(tr.exitTimeMs));
        const xMae = xScale(new Date(tr.adverseTimeMs));
        const yEntry = yScale(tr.entryPrice);
        const yExit = yScale(tr.exitPrice);
        const yStop = yScale(tr.stopLossPrice);
        const yMae = yScale(tr.adverseExtremePrice);

        const outcomeColor =
          tr.outcome === 'WIN' ? '#10b981' : tr.outcome === 'LOSS' ? '#f43f5e' : '#f59e0b';

        // Highlight active trade window band
        if (isSelected) {
          const bandX = Math.min(x1, x2);
          const bandW = Math.max(8, Math.abs(x2 - x1));
          g.append('rect')
            .attr('x', bandX)
            .attr('y', 0)
            .attr('width', bandW)
            .attr('height', innerH)
            .attr('fill', 'rgba(245, 158, 11, 0.08)')
            .attr('stroke', 'rgba(245, 158, 11, 0.35)')
            .attr('stroke-width', 1);
        }

        // Stop Loss dashed shelf over the trade holding span
        const slX2 = Math.max(x1 + 14, x2);
        g.append('line')
          .attr('x1', x1)
          .attr('x2', slX2)
          .attr('y1', yStop)
          .attr('y2', yStop)
          .attr('stroke', '#f43f5e')
          .attr('stroke-opacity', isSelected ? 0.95 : 0.45)
          .attr('stroke-width', isSelected ? 1.5 : 1)
          .attr('stroke-dasharray', '3 2');

        // Entry -> Exit trade path connector
        g.append('line')
          .attr('x1', x1)
          .attr('y1', yEntry)
          .attr('x2', x2)
          .attr('y2', yExit)
          .attr('stroke', outcomeColor)
          .attr('stroke-width', isSelected ? 2.4 : 1.5)
          .attr('stroke-opacity', isSelected ? 1 : 0.72);

        // MAE adverse excursion dip dot
        if (tr.maePoints > 0.25 && isSelected) {
          g.append('circle')
            .attr('cx', xMae)
            .attr('cy', yMae)
            .attr('r', 3.5)
            .attr('fill', '#020617')
            .attr('stroke', '#fb7185')
            .attr('stroke-width', 1.6);
        }

        // Entry marker triangle (up for BUY, down for SELL)
        const triOffset = tr.direction === 'BUY' ? 5 : -5;
        const entryPoints =
          tr.direction === 'BUY'
            ? `${x1},${yEntry - 5} ${x1 - 4.5},${yEntry + 4} ${x1 + 4.5},${yEntry + 4}`
            : `${x1},${yEntry + 5} ${x1 - 4.5},${yEntry - 4} ${x1 + 4.5},${yEntry - 4}`;

        g.append('polygon')
          .attr('points', entryPoints)
          .attr('fill', '#38bdf8')
          .attr('stroke', isSelected ? '#ffffff' : '#020617')
          .attr('stroke-width', isSelected ? 1.2 : 0.8)
          .style('cursor', 'pointer')
          .on('click', () => {
            setSelectedPositionId(tr.positionId);
          });

        // Exit marker circle (Win=emerald, Loss=rose, Open=amber)
        g.append('circle')
          .attr('cx', x2)
          .attr('cy', yExit)
          .attr('r', isSelected ? 5.5 : 4)
          .attr('fill', outcomeColor)
          .attr('stroke', isSelected ? '#ffffff' : '#020617')
          .attr('stroke-width', isSelected ? 1.5 : 0.9)
          .style('cursor', 'pointer')
          .on('click', () => {
            setSelectedPositionId(tr.positionId);
          });

        // Sequence tag above entry/exit for selected or landmark positions
        if (isSelected) {
          g.append('text')
            .attr('x', x1)
            .attr('y', yEntry + triOffset * 2.4)
            .attr('text-anchor', 'middle')
            .attr('fill', '#38bdf8')
            .attr('font-size', '9.5')
            .attr('font-family', 'monospace')
            .attr('font-weight', '700')
            .text(`#${tr.sequenceIndex} IN $${tr.entryPrice.toFixed(0)}`);

          g.append('text')
            .attr('x', Math.min(innerW - 20, x2))
            .attr('y', Math.max(12, yExit - 9))
            .attr('text-anchor', 'middle')
            .attr('fill', outcomeColor)
            .attr('font-size', '9.5')
            .attr('font-family', 'monospace')
            .attr('font-weight', '700')
            .text(
              tr.outcome === 'OPEN'
                ? `LIVE $${tr.exitPrice.toFixed(0)}`
                : `OUT $${tr.exitPrice.toFixed(0)}`
            );
        }
      }

      // X-axis Dates
      const xAxis = d3
        .axisBottom(xScale)
        .ticks(6)
        .tickFormat((d) =>
          d instanceof Date
            ? d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' })
            : ''
        );

      g.append('g')
        .attr('transform', `translate(0,${innerH})`)
        .call(xAxis)
        .call((axisG) => axisG.select('.domain').attr('stroke', '#334155'))
        .call((axisG) =>
          axisG
            .selectAll('text')
            .attr('fill', '#94a3b8')
            .attr('font-size', '10')
            .attr('font-family', 'monospace')
        );

      // Right Y-axis Prices
      const yAxis = d3
        .axisRight(yScale)
        .ticks(5)
        .tickFormat((v) => `$${Number(v).toLocaleString()}`);

      g.append('g')
        .attr('transform', `translate(${innerW},0)`)
        .call(yAxis)
        .call((axisG) => axisG.select('.domain').attr('stroke', '#334155'))
        .call((axisG) =>
          axisG
            .selectAll('text')
            .attr('fill', '#94a3b8')
            .attr('font-size', '10')
            .attr('font-family', 'monospace')
        );
    } else if (selectedEntry) {
      // FOCUSED TRADE POST-MORTEM REPLAY CHART
      const bars = selectedEntry.focusedCandles;
      if (bars.length === 0) return;

      const xBand = d3
        .scaleBand<number>()
        .domain(bars.map((_, idx) => idx))
        .range([0, innerW])
        .padding(0.32);

      const allPrices = [
        ...bars.map((b) => b.high),
        ...bars.map((b) => b.low),
        selectedEntry.entryPrice,
        selectedEntry.stopLossPrice,
        selectedEntry.takeProfitPrice,
        selectedEntry.exitPrice,
        selectedEntry.adverseExtremePrice,
      ];
      const pMin = Math.min(...allPrices);
      const pMax = Math.max(...allPrices);
      const pad = Math.max(4, (pMax - pMin) * 0.1);
      const yScale = d3
        .scaleLinear()
        .domain([pMin - pad, pMax + pad])
        .range([innerH, 0]);

      // Grid lines
      g.selectAll('.pm-grid-y')
        .data(yScale.ticks(5))
        .enter()
        .append('line')
        .attr('x1', 0)
        .attr('x2', innerW)
        .attr('y1', (d) => yScale(d))
        .attr('y2', (d) => yScale(d))
        .attr('stroke', '#1e293b')
        .attr('stroke-width', 1);

      // Shaded Reward Corridor (Entry <-> Target 1)
      const tpTop = Math.min(yScale(selectedEntry.entryPrice), yScale(selectedEntry.takeProfitPrice));
      const tpHeight = Math.abs(
        yScale(selectedEntry.entryPrice) - yScale(selectedEntry.takeProfitPrice)
      );
      g.append('rect')
        .attr('x', 0)
        .attr('y', tpTop)
        .attr('width', innerW)
        .attr('height', Math.max(2, tpHeight))
        .attr('fill', 'rgba(16, 185, 129, 0.07)');

      // Shaded Risk Corridor (Entry <-> Stop Loss)
      const slTop = Math.min(yScale(selectedEntry.entryPrice), yScale(selectedEntry.stopLossPrice));
      const slHeight = Math.abs(
        yScale(selectedEntry.entryPrice) - yScale(selectedEntry.stopLossPrice)
      );
      g.append('rect')
        .attr('x', 0)
        .attr('y', slTop)
        .attr('width', innerW)
        .attr('height', Math.max(2, slHeight))
        .attr('fill', 'rgba(244, 63, 94, 0.08)');

      // Horizontal level lines: TP1, Entry, Stop Loss
      const levels = [
        {
          label: `TP1 $${selectedEntry.takeProfitPrice.toFixed(2)}`,
          price: selectedEntry.takeProfitPrice,
          color: '#10b981',
          dash: '4 3',
        },
        {
          label: `ENTRY $${selectedEntry.entryPrice.toFixed(2)}`,
          price: selectedEntry.entryPrice,
          color: '#38bdf8',
          dash: '2 2',
        },
        {
          label: `STOP $${selectedEntry.stopLossPrice.toFixed(2)}`,
          price: selectedEntry.stopLossPrice,
          color: '#f43f5e',
          dash: '4 3',
        },
      ];

      for (const lv of levels) {
        const yLv = yScale(lv.price);
        g.append('line')
          .attr('x1', 0)
          .attr('x2', innerW)
          .attr('y1', yLv)
          .attr('y2', yLv)
          .attr('stroke', lv.color)
          .attr('stroke-width', 1.25)
          .attr('stroke-dasharray', lv.dash);

        g.append('text')
          .attr('x', 6)
          .attr('y', Math.max(10, yLv - 4))
          .attr('fill', lv.color)
          .attr('font-size', '9.5')
          .attr('font-family', 'monospace')
          .attr('font-weight', '700')
          .text(lv.label);
      }

      // Draw OHLC Candlestick bars
      bars.forEach((bar: PostMortemCandle, idx: number) => {
        const x = (xBand(idx) ?? 0) + xBand.bandwidth() / 2;
        const bodyW = Math.max(4, xBand.bandwidth());
        const bull = bar.close >= bar.open;
        const opacity = bar.phase === 'IN_TRADE' ? 0.95 : 0.45;
        const col = bull ? '#10b981' : '#f43f5e';

        g.append('line')
          .attr('x1', x)
          .attr('x2', x)
          .attr('y1', yScale(bar.high))
          .attr('y2', yScale(bar.low))
          .attr('stroke', col)
          .attr('stroke-width', 1.4)
          .attr('stroke-opacity', opacity);

        const bodyTop = yScale(Math.max(bar.open, bar.close));
        const bodyBottom = yScale(Math.min(bar.open, bar.close));
        g.append('rect')
          .attr('x', x - bodyW / 2)
          .attr('y', bodyTop)
          .attr('width', bodyW)
          .attr('height', Math.max(2.2, bodyBottom - bodyTop))
          .attr('rx', 1)
          .attr('fill', col)
          .attr('fill-opacity', opacity);
      });

      // Plot Entry, MAE Extreme & Exit Callout Nodes
      const firstInTradeIdx = bars.findIndex((b) => b.phase === 'IN_TRADE');
      const lastInTradeIdx =
        bars.reduce((last, b, idx) => (b.phase === 'IN_TRADE' ? idx : last), 0);

      if (firstInTradeIdx >= 0) {
        const xIn = (xBand(firstInTradeIdx) ?? 0) + xBand.bandwidth() / 2;
        const yIn = yScale(selectedEntry.entryPrice);
        g.append('circle')
          .attr('cx', xIn)
          .attr('cy', yIn)
          .attr('r', 5.5)
          .attr('fill', '#38bdf8')
          .attr('stroke', '#ffffff')
          .attr('stroke-width', 1.4);

        g.append('text')
          .attr('x', xIn)
          .attr('y', yIn - 9)
          .attr('text-anchor', 'middle')
          .attr('fill', '#38bdf8')
          .attr('font-size', '9.5')
          .attr('font-family', 'monospace')
          .attr('font-weight', '700')
          .text(`ENTER`);
      }

      // Locate bar touching adverseExtremePrice
      let maeBarIdx = firstInTradeIdx + 2;
      let bestDist = Infinity;
      bars.forEach((b, idx) => {
        if (b.phase !== 'IN_TRADE') return;
        const refVal = selectedEntry.direction === 'BUY' ? b.low : b.high;
        const d = Math.abs(refVal - selectedEntry.adverseExtremePrice);
        if (d < bestDist) {
          bestDist = d;
          maeBarIdx = idx;
        }
      });

      if (maeBarIdx >= 0 && selectedEntry.maePoints > 0.2) {
        const xMae = (xBand(maeBarIdx) ?? 0) + xBand.bandwidth() / 2;
        const yMae = yScale(selectedEntry.adverseExtremePrice);
        g.append('circle')
          .attr('cx', xMae)
          .attr('cy', yMae)
          .attr('r', 4.5)
          .attr('fill', '#020617')
          .attr('stroke', '#fb7185')
          .attr('stroke-width', 1.8);

        g.append('text')
          .attr('x', xMae)
          .attr('y', selectedEntry.direction === 'BUY' ? yMae + 13 : yMae - 8)
          .attr('text-anchor', 'middle')
          .attr('fill', '#fb7185')
          .attr('font-size', '9')
          .attr('font-family', 'monospace')
          .attr('font-weight', '700')
          .text(`MAE $${selectedEntry.adverseExtremePrice.toFixed(1)}`);
      }

      if (lastInTradeIdx >= 0) {
        const xOut = (xBand(lastInTradeIdx) ?? 0) + xBand.bandwidth() / 2;
        const yOut = yScale(selectedEntry.exitPrice);
        const exitColor =
          selectedEntry.outcome === 'WIN'
            ? '#10b981'
            : selectedEntry.outcome === 'LOSS'
            ? '#f43f5e'
            : '#f59e0b';

        g.append('circle')
          .attr('cx', xOut)
          .attr('cy', yOut)
          .attr('r', 5.5)
          .attr('fill', exitColor)
          .attr('stroke', '#ffffff')
          .attr('stroke-width', 1.4);

        g.append('text')
          .attr('x', xOut)
          .attr('y', yOut - 9)
          .attr('text-anchor', 'middle')
          .attr('fill', exitColor)
          .attr('font-size', '9.5')
          .attr('font-family', 'monospace')
          .attr('font-weight', '700')
          .text(selectedEntry.outcome === 'OPEN' ? 'MARK' : 'EXIT');
      }

      // X-axis bar dates
      const tickIdxs = bars
        .map((_, i) => i)
        .filter((i) => i === 0 || i === firstInTradeIdx || i === lastInTradeIdx || i === bars.length - 1);

      const xAxis = d3
        .axisBottom(xBand)
        .tickValues(tickIdxs)
        .tickFormat((idx) => bars[Number(idx)]?.label ?? '');

      g.append('g')
        .attr('transform', `translate(0,${innerH})`)
        .call(xAxis)
        .call((axisG) => axisG.select('.domain').attr('stroke', '#334155'))
        .call((axisG) =>
          axisG
            .selectAll('text')
            .attr('fill', '#94a3b8')
            .attr('font-size', '10')
            .attr('font-family', 'monospace')
        );

      // Right Y-axis Prices
      const yAxis = d3
        .axisRight(yScale)
        .ticks(5)
        .tickFormat((v) => `$${Number(v).toLocaleString()}`);

      g.append('g')
        .attr('transform', `translate(${innerW},0)`)
        .call(yAxis)
        .call((axisG) => axisG.select('.domain').attr('stroke', '#334155'))
        .call((axisG) =>
          axisG
            .selectAll('text')
            .attr('fill', '#94a3b8')
            .attr('font-size', '10')
            .attr('font-family', 'monospace')
        );
    }
  }, [timeline, viewMode, selectedEntry]);

  return (
    <section
      aria-label="Chronological Trade History Timeline & Post-Mortem"
      className="bg-slate-900 border border-slate-800 rounded-lg p-5 space-y-4"
    >
      {/* Header & Controls */}
      <div className="flex flex-wrap items-start justify-between gap-4 pb-3 border-b border-slate-800">
        <div>
          <h3 className="text-base font-bold text-slate-100 flex items-center gap-2">
            <History className="w-4 h-4 text-amber-400 shrink-0" aria-hidden="true" />
            <span>Chronological Trade History Timeline &amp; Visual Post-Mortem</span>
          </h3>
          <div className="flex flex-wrap items-center gap-2 text-xs text-slate-400 mt-1">
            <span>Scope: {activeRangeLabel}</span>
            <span aria-hidden="true">·</span>
            <span className="font-mono tabular-nums">
              {timeline.totalTradesCount} positions ({timeline.winCount}W / {timeline.lossCount}L
              {timeline.openCount > 0 ? ` / ${timeline.openCount} Open` : ''})
            </span>
            <span aria-hidden="true">·</span>
            <span className="font-mono tabular-nums">
              Avg Hold {timeline.avgHoldingHours}h · Avg MAE {timeline.avgMaePctOfStop}% of Stop
            </span>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Horizon Filter */}
          <div
            role="group"
            aria-label="Timeline Horizon Filter"
            className="flex items-center gap-1 p-1 bg-slate-950 border border-slate-800 rounded-lg"
          >
            {(
              [
                { id: 'ALL', label: 'All' },
                { id: 'INTRADAY', label: 'Intraday' },
                { id: 'SWING', label: 'Swing' },
                { id: 'LONG_TERM', label: 'Long-Term' },
              ] as const
            ).map((opt) => (
              <button
                key={opt.id}
                type="button"
                onClick={() => setHorizonFilter(opt.id)}
                aria-pressed={horizonFilter === opt.id}
                className={`px-2.5 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                  horizonFilter === opt.id
                    ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40 font-semibold'
                    : 'text-slate-400 hover:text-slate-200 border border-transparent'
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>

          {/* Chart View Mode */}
          <div
            role="group"
            aria-label="Timeline Chart View Mode"
            className="flex items-center gap-1 p-1 bg-slate-950 border border-slate-800 rounded-lg"
          >
            {(
              [
                { id: 'OVERVIEW', label: 'Chronological Price Map' },
                { id: 'POST_MORTEM', label: 'Trade Post-Mortem' },
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
        </div>
      </div>

      {/* Empty State vs Active Chart + Inspector */}
      {timeline.totalTradesCount === 0 ? (
        <div className="bg-slate-950/60 border border-slate-800 rounded-lg p-6 text-center space-y-2.5">
          <p className="text-xs text-slate-300">
            No journaled positions match the active filter for timeline mapping.
          </p>
          {horizonFilter !== 'ALL' && (
            <button
              type="button"
              onClick={() => setHorizonFilter('ALL')}
              className="px-3 py-1.5 rounded bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-semibold transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              Show All Horizons
            </button>
          )}
        </div>
      ) : (
        <>
          {/* Historical Price Map Legend + Prev/Next Controls */}
          <div className="flex flex-wrap items-center justify-between gap-3 text-xs font-mono">
            <div className="flex flex-wrap items-center gap-4 text-slate-400">
              <span className="text-sky-400">▲ Entry Execution</span>
              <span className="text-emerald-400">● Winning Exit</span>
              <span className="text-rose-400">-- Stop Loss</span>
              <span className="text-rose-300">○ MAE Dip</span>
              <span className="text-amber-400">● Open Mark</span>
            </div>

            {selectedEntry && (
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  disabled={selectedIndex <= 0}
                  onClick={() => {
                    if (selectedIndex > 0) {
                      setSelectedPositionId(timeline.entries[selectedIndex - 1].positionId);
                    }
                  }}
                  aria-label="Previous Trade"
                  className="inline-flex items-center gap-1 px-2.5 py-1 rounded bg-slate-950 border border-slate-800 text-slate-300 hover:border-slate-700 disabled:opacity-40 whitespace-nowrap shrink-0 cursor-pointer"
                >
                  <ChevronLeft className="w-3.5 h-3.5" aria-hidden="true" />
                  Prev Trade
                </button>
                <span className="px-2 text-slate-300 tabular-nums whitespace-nowrap">
                  #{selectedEntry.sequenceIndex} / {timeline.totalTradesCount}
                </span>
                <button
                  type="button"
                  disabled={selectedIndex >= timeline.entries.length - 1}
                  onClick={() => {
                    if (selectedIndex < timeline.entries.length - 1) {
                      setSelectedPositionId(timeline.entries[selectedIndex + 1].positionId);
                    }
                  }}
                  aria-label="Next Trade"
                  className="inline-flex items-center gap-1 px-2.5 py-1 rounded bg-slate-950 border border-slate-800 text-slate-300 hover:border-slate-700 disabled:opacity-40 whitespace-nowrap shrink-0 cursor-pointer"
                >
                  Next Trade
                  <ChevronRight className="w-3.5 h-3.5" aria-hidden="true" />
                </button>
              </div>
            )}
          </div>

          {/* D3 Historical Price Timeline / Post-Mortem Canvas */}
          <div className="bg-slate-950/80 border border-slate-800 rounded-lg p-3">
            <svg
              ref={svgRef}
              aria-label="Chronological Trade History Price Chart"
              className="w-full h-auto block"
            />
          </div>

          {/* Interactive Chronological Position Selector Rail */}
          <div className="overflow-x-auto pb-1">
            <div className="flex items-stretch gap-2 min-w-max">
              {timeline.entries.map((tr) => {
                const isActive = selectedEntry?.positionId === tr.positionId;
                return (
                  <button
                    key={tr.positionId}
                    type="button"
                    onClick={() => {
                      setSelectedPositionId(tr.positionId);
                    }}
                    aria-pressed={isActive}
                    className={`text-left px-3 py-2 rounded-md border font-mono tabular-nums transition-colors cursor-pointer min-w-[160px] ${
                      isActive
                        ? 'bg-slate-800 border-amber-400 text-slate-100'
                        : 'bg-slate-950/70 border-slate-800 text-slate-300 hover:border-slate-700'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2 text-[11px]">
                      <span className="font-bold text-slate-100">
                        #{tr.sequenceIndex} · {tr.positionId}
                      </span>
                      <span
                        className={`font-bold ${
                          tr.outcome === 'WIN'
                            ? 'text-emerald-400'
                            : tr.outcome === 'LOSS'
                            ? 'text-rose-400'
                            : 'text-amber-400'
                        }`}
                      >
                        {tr.rMultiple >= 0 ? '+' : ''}
                        {tr.rMultiple.toFixed(2)}R
                      </span>
                    </div>
                    <div className="text-[10px] text-slate-400 mt-0.5">
                      {tr.entryDateLabel} · {tr.horizon} · {tr.direction}
                    </div>
                    <div
                      className={`text-[11px] font-semibold mt-0.5 ${
                        tr.pnlUsd >= 0 ? 'text-emerald-400' : 'text-rose-400'
                      }`}
                    >
                      {formatSignedUsd(tr.pnlUsd)}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Selected Position Visual Post-Mortem Audit Panel */}
          {selectedEntry && (
            <div
              aria-label="Selected Trade Post-Mortem Summary"
              className="bg-slate-950/70 border border-slate-800 rounded-lg p-4 space-y-3"
            >
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-800 pb-2.5">
                <div className="flex flex-wrap items-center gap-2 text-xs font-mono">
                  <span className="font-bold text-slate-100">
                    Post-Mortem: {selectedEntry.positionId}
                  </span>
                  <span aria-hidden="true">·</span>
                  <span className="text-slate-300">
                    {selectedEntry.instrumentId} {selectedEntry.direction} ({selectedEntry.lots.toFixed(1)} lots)
                  </span>
                  <span aria-hidden="true">·</span>
                  <span className="text-amber-300">{selectedEntry.horizon}</span>
                  <span aria-hidden="true">·</span>
                  <span className="text-slate-400">
                    {selectedEntry.entryDateLabel} → {selectedEntry.exitDateLabel} ({selectedEntry.holdingHours}h)
                  </span>
                </div>

                {viewMode === 'OVERVIEW' && (
                  <button
                    type="button"
                    onClick={() => setViewMode('POST_MORTEM')}
                    className="px-3 py-1 rounded bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-semibold transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                  >
                    Zoom Candlestick Post-Mortem
                  </button>
                )}
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2.5 text-xs font-mono tabular-nums">
                <div className="bg-slate-900/90 border border-slate-800 rounded p-2.5">
                  <span className="text-slate-500 block text-[10px]">ENTRY PRICE</span>
                  <span className="text-sky-400 font-bold">${selectedEntry.entryPrice.toFixed(2)}</span>
                </div>
                <div className="bg-slate-900/90 border border-slate-800 rounded p-2.5">
                  <span className="text-slate-500 block text-[10px]">
                    {selectedEntry.outcome === 'OPEN' ? 'LIVE MARK' : 'EXIT PRICE'}
                  </span>
                  <span
                    className={`font-bold ${
                      selectedEntry.pnlUsd >= 0 ? 'text-emerald-400' : 'text-rose-400'
                    }`}
                  >
                    ${selectedEntry.exitPrice.toFixed(2)}
                  </span>
                </div>
                <div className="bg-slate-900/90 border border-slate-800 rounded p-2.5">
                  <span className="text-slate-500 block text-[10px]">STOP LOSS</span>
                  <span className="text-rose-400 font-bold">
                    ${selectedEntry.stopLossPrice.toFixed(2)}
                  </span>
                </div>
                <div className="bg-slate-900/90 border border-slate-800 rounded p-2.5">
                  <span className="text-slate-500 block text-[10px]">TARGET 1</span>
                  <span className="text-emerald-400 font-bold">
                    ${selectedEntry.takeProfitPrice.toFixed(2)}
                  </span>
                </div>
                <div className="bg-slate-900/90 border border-slate-800 rounded p-2.5">
                  <span className="text-slate-500 block text-[10px]">MAE EXTREME</span>
                  <span className="text-rose-300 font-bold">
                    ${selectedEntry.adverseExtremePrice.toFixed(2)} ({selectedEntry.maePctOfStop}% SL)
                  </span>
                </div>
                <div className="bg-slate-900/90 border border-slate-800 rounded p-2.5">
                  <span className="text-slate-500 block text-[10px]">REALIZED / MTM</span>
                  <span
                    className={`font-bold ${
                      selectedEntry.pnlUsd >= 0 ? 'text-emerald-400' : 'text-rose-400'
                    }`}
                  >
                    {formatSignedUsd(selectedEntry.pnlUsd)} ({selectedEntry.rMultiple >= 0 ? '+' : ''}
                    {selectedEntry.rMultiple.toFixed(2)}R)
                  </span>
                </div>
              </div>

              <div className="text-xs text-slate-300 leading-relaxed space-y-1">
                <p>{selectedEntry.postMortemVerdict}</p>
                {selectedEntry.notes && (
                  <p className="text-slate-400">
                    Journal Thesis: {selectedEntry.notes}
                  </p>
                )}
              </div>
            </div>
          )}
        </>
      )}
    </section>
  );
};
