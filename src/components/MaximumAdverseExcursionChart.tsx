/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * Aurum Intelligence — Real-Time Maximum Adverse Excursion (MAE) Chart
 *
 * Maps executed trade entry prices against subsequent lowest/worst adverse prices
 * reached before target or stop hit, enabling quantitative stop-loss efficiency audits.
 */

import React, { useEffect, useMemo, useRef, useState } from 'react';
import * as d3 from 'd3';
import { PaperPosition, Quote } from '../domain/types';
import {
  calculatePositionMaeAnalytics,
  PositionMaePoint,
} from '../services/portfolioScannerEngine';
import { ShieldAlert, ShieldCheck, SlidersHorizontal, TrendingDown } from 'lucide-react';

interface MaximumAdverseExcursionChartProps {
  positions: PaperPosition[];
  quote: Quote;
  quotes?: Record<string, Quote>;
}

type MaeChartMode = 'ENTRY_VS_EXTREME' | 'STOP_EFFICIENCY';

export const MaximumAdverseExcursionChart: React.FC<MaximumAdverseExcursionChartProps> = ({
  positions,
  quote,
  quotes = {},
}) => {
  const [chartMode, setChartMode] = useState<MaeChartMode>('ENTRY_VS_EXTREME');
  const [selectedInstrument, setSelectedInstrument] = useState<string>('XAUUSD');
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const [containerWidth, setContainerWidth] = useState<number>(780);

  const containerRef = useRef<HTMLDivElement | null>(null);
  const svgRef = useRef<SVGSVGElement | null>(null);

  const summary = useMemo(
    () => calculatePositionMaeAnalytics(positions, { ...quotes, XAUUSD: quote }, quote),
    [positions, quotes, quote]
  );

  const availableInstruments = useMemo(
    () => Array.from(new Set(summary.points.map((p) => p.instrumentId))),
    [summary.points]
  );

  const activeInstrumentFilter = useMemo(() => {
    if (availableInstruments.includes(selectedInstrument)) return selectedInstrument;
    return availableInstruments[0] || 'XAUUSD';
  }, [availableInstruments, selectedInstrument]);

  const priceViewPoints = useMemo(() => {
    if (chartMode === 'STOP_EFFICIENCY') return summary.points;
    const filtered = summary.points.filter((p) => p.instrumentId === activeInstrumentFilter);
    return filtered.length > 0 ? filtered : summary.points;
  }, [summary.points, chartMode, activeInstrumentFilter]);

  const activePoint: PositionMaePoint | null = useMemo(() => {
    if (hoveredId) {
      const match = summary.points.find((p) => p.positionId === hoveredId);
      if (match) return match;
    }
    return priceViewPoints[0] ?? summary.points[0] ?? null;
  }, [hoveredId, priceViewPoints, summary.points]);

  // Responsive container observer
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

  // D3 rendering effect
  useEffect(() => {
    const svgEl = svgRef.current;
    if (!svgEl) return;

    const svg = d3.select(svgEl);
    svg.selectAll('*').remove();

    const width = containerWidth;
    const height = 290;
    svg.attr('viewBox', `0 0 ${width} ${height}`);

    if (priceViewPoints.length === 0) {
      svg
        .append('text')
        .attr('x', width / 2)
        .attr('y', height / 2)
        .attr('text-anchor', 'middle')
        .attr('fill', '#64748b')
        .attr('font-size', '12px')
        .attr('font-family', 'ui-monospace, SFMono-Regular, monospace')
        .text('No executed or open paper trades available for MAE mapping.');
      return;
    }

    if (chartMode === 'ENTRY_VS_EXTREME') {
      const margin = { top: 24, right: 26, bottom: 44, left: 68 };
      const innerW = Math.max(200, width - margin.left - margin.right);
      const innerH = Math.max(150, height - margin.top - margin.bottom);

      const g = svg
        .append('g')
        .attr('transform', `translate(${margin.left},${margin.top})`);

      const xScale = d3
        .scaleBand<string>()
        .domain(priceViewPoints.map((p) => p.positionId))
        .range([0, innerW])
        .padding(0.42);

      const allPrices = priceViewPoints.flatMap((p) => [
        p.entryPrice,
        p.adverseExtremePrice,
        p.stopLossPrice,
      ]);
      const minPrice = Math.min(...allPrices);
      const maxPrice = Math.max(...allPrices);
      const span = Math.max(1, maxPrice - minPrice);
      const pad = span * 0.14;

      const yScale = d3
        .scaleLinear()
        .domain([minPrice - pad, maxPrice + pad])
        .range([innerH, 0]);

      // Horizontal price grid lines
      const yTicks = yScale.ticks(6);
      g.selectAll('.mae-grid-y')
        .data(yTicks)
        .enter()
        .append('line')
        .attr('x1', 0)
        .attr('x2', innerW)
        .attr('y1', (d) => yScale(d))
        .attr('y2', (d) => yScale(d))
        .attr('stroke', '#1e293b')
        .attr('stroke-width', 1);

      const bandW = xScale.bandwidth();
      const markerDown = d3.symbol().type(d3.symbolTriangle).size(90);

      const groups = g
        .selectAll('.mae-trade-group')
        .data(priceViewPoints)
        .enter()
        .append('g')
        .attr('class', 'mae-trade-group')
        .attr('transform', (d) => `translate(${(xScale(d.positionId) ?? 0) + bandW / 2},0)`)
        .style('cursor', 'pointer')
        .on('mouseenter', (_e, d) => setHoveredId(d.positionId))
        .on('mouseleave', () => setHoveredId(null));

      // Remaining Stop Buffer guide line (from adverse extreme to stop loss)
      groups
        .append('line')
        .attr('x1', 0)
        .attr('x2', 0)
        .attr('y1', (d) => yScale(d.adverseExtremePrice))
        .attr('y2', (d) => yScale(d.stopLossPrice))
        .attr('stroke', '#475569')
        .attr('stroke-width', 1.2)
        .attr('stroke-dasharray', '3,3');

      // Stop-Loss Horizon Bar (crimson threshold line per trade)
      const halfSpan = Math.min(28, Math.max(14, bandW * 0.65));
      groups
        .append('line')
        .attr('x1', -halfSpan)
        .attr('x2', halfSpan)
        .attr('y1', (d) => yScale(d.stopLossPrice))
        .attr('y2', (d) => yScale(d.stopLossPrice))
        .attr('stroke', '#fb7185')
        .attr('stroke-width', 2);

      // Excursion Corridor Stem (Entry Price -> Subsequent Lowest/Worst Price Reached)
      groups
        .append('line')
        .attr('x1', 0)
        .attr('x2', 0)
        .attr('y1', (d) => yScale(d.entryPrice))
        .attr('y2', (d) => yScale(d.adverseExtremePrice))
        .attr('stroke', (d) =>
          d.efficiencyTier === 'STOP_BREACHED'
            ? '#f43f5e'
            : d.efficiencyTier === 'NEAR_STOP_BRUSH'
            ? '#f59e0b'
            : '#38bdf8'
        )
        .attr('stroke-width', 5)
        .attr('stroke-linecap', 'round')
        .attr('stroke-opacity', 0.85);

      // Executed Entry Price Node (Circle)
      groups
        .append('circle')
        .attr('cx', 0)
        .attr('cy', (d) => yScale(d.entryPrice))
        .attr('r', 5.5)
        .attr('fill', '#e2e8f0')
        .attr('stroke', '#0f172a')
        .attr('stroke-width', 1.5);

      // Subsequent Lowest / Adverse Extreme Reached Node (Inverted/Directional Triangle)
      groups
        .append('path')
        .attr('d', markerDown() || '')
        .attr(
          'transform',
          (d) =>
            `translate(0,${yScale(d.adverseExtremePrice)}) rotate(${d.direction === 'SELL' ? 0 : 180})`
        )
        .attr('fill', (d) =>
          d.efficiencyTier === 'STOP_BREACHED'
            ? '#f43f5e'
            : d.efficiencyTier === 'NEAR_STOP_BRUSH'
            ? '#f59e0b'
            : '#34d399'
        )
        .attr('stroke', '#0f172a')
        .attr('stroke-width', 1.2);

      // Percentage of stop consumed label next to bar
      groups
        .append('text')
        .attr('x', 0)
        .attr('y', (d) => Math.min(innerH - 4, yScale(d.stopLossPrice) + 14))
        .attr('text-anchor', 'middle')
        .attr('fill', (d) =>
          d.maePctOfStop >= 100
            ? '#fb7185'
            : d.maePctOfStop > 65
            ? '#fbbf24'
            : '#94a3b8'
        )
        .attr('font-size', '10px')
        .attr('font-family', 'ui-monospace, SFMono-Regular, monospace')
        .text((d) => `${d.maePctOfStop.toFixed(0)}% stop`);

      // Axes
      const xAxis = d3.axisBottom(xScale).tickFormat((id) => {
        const pt = priceViewPoints.find((p) => p.positionId === id);
        return pt ? `${pt.positionId} (${pt.outcomeCategory === 'OPEN' ? 'LIVE' : pt.outcomeCategory === 'WINNER' ? 'WIN' : 'STOP'})` : id;
      });
      const yAxis = d3
        .axisLeft(yScale)
        .ticks(6)
        .tickFormat((v) => `$${Number(v).toLocaleString('en-US', { maximumFractionDigits: 2 })}`);

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
    } else {
      // STOP EFFICIENCY SCATTER MODE (Normalized % of Stop vs R-Multiple across ALL trades)
      const margin = { top: 24, right: 28, bottom: 44, left: 56 };
      const innerW = Math.max(200, width - margin.left - margin.right);
      const innerH = Math.max(150, height - margin.top - margin.bottom);

      const g = svg
        .append('g')
        .attr('transform', `translate(${margin.left},${margin.top})`);

      const maxX = Math.max(110, ...summary.points.map((p) => p.maePctOfStop + 10));
      const xScale = d3.scaleLinear().domain([0, maxX]).range([0, innerW]);

      const rValues = summary.points.map((p) => p.realizedOrUnrealizedR);
      const yMin = Math.min(-1.5, ...rValues.map((r) => r - 0.3));
      const yMax = Math.max(2.5, ...rValues.map((r) => r + 0.4));
      const yScale = d3.scaleLinear().domain([yMin, yMax]).range([innerH, 0]);

      // Safe Tightened Stop Zone shading up to maxWinnerMaePctOfStop + 10%
      if (summary.winnerCount > 0) {
        const optBound = Math.min(100, summary.maxWinnerMaePctOfStop + 10);
        g.append('rect')
          .attr('x', 0)
          .attr('y', 0)
          .attr('width', xScale(optBound))
          .attr('height', yScale(0))
          .attr('fill', 'rgba(16, 185, 129, 0.06)');
      }

      // 100% Stop-Loss Breach Threshold vertical wall
      g.append('line')
        .attr('x1', xScale(100))
        .attr('x2', xScale(100))
        .attr('y1', 0)
        .attr('y2', innerH)
        .attr('stroke', '#fb7185')
        .attr('stroke-width', 1.5)
        .attr('stroke-dasharray', '4,3');

      g.append('text')
        .attr('x', xScale(100) - 4)
        .attr('y', 12)
        .attr('text-anchor', 'end')
        .attr('fill', '#fb7185')
        .attr('font-size', '10px')
        .attr('font-family', 'ui-monospace, SFMono-Regular, monospace')
        .text('100% Stop Breach');

      // 0R Breakeven horizontal line
      g.append('line')
        .attr('x1', 0)
        .attr('x2', innerW)
        .attr('y1', yScale(0))
        .attr('y2', yScale(0))
        .attr('stroke', '#475569')
        .attr('stroke-width', 1.2);

      const diamondGen = d3.symbol().type(d3.symbolDiamond).size(110);
      const circleGen = d3.symbol().type(d3.symbolCircle).size(95);

      const nodes = g
        .selectAll('.mae-scatter-node')
        .data(summary.points)
        .enter()
        .append('g')
        .attr(
          'transform',
          (d) => `translate(${xScale(d.maePctOfStop)},${yScale(d.realizedOrUnrealizedR)})`
        )
        .style('cursor', 'pointer')
        .on('mouseenter', (_e, d) => setHoveredId(d.positionId))
        .on('mouseleave', () => setHoveredId(null));

      nodes
        .append('path')
        .attr('d', (d) => (d.outcomeCategory === 'OPEN' ? diamondGen() : circleGen()) || '')
        .attr('fill', (d) =>
          d.outcomeCategory === 'STOPPED_LOSS'
            ? '#f43f5e'
            : d.outcomeCategory === 'WINNER'
            ? '#10b981'
            : '#f59e0b'
        )
        .attr('stroke', '#0f172a')
        .attr('stroke-width', 1.4);

      nodes
        .append('text')
        .attr('x', 8)
        .attr('y', 3)
        .attr('fill', '#cbd5e1')
        .attr('font-size', '10px')
        .attr('font-family', 'ui-monospace, SFMono-Regular, monospace')
        .text((d) => d.positionId);

      const xAxis = d3.axisBottom(xScale).ticks(6).tickFormat((d) => `${d}%`);
      const yAxis = d3.axisLeft(yScale).ticks(6).tickFormat((d) => `${Number(d).toFixed(1)}R`);

      const xAxisG = g.append('g').attr('transform', `translate(0,${innerH})`).call(xAxis);
      xAxisG.selectAll('text').attr('fill', '#94a3b8').attr('font-size', '10px');
      xAxisG.selectAll('path,line').attr('stroke', '#334155');

      const yAxisG = g.append('g').call(yAxis);
      yAxisG.selectAll('text').attr('fill', '#94a3b8').attr('font-size', '10px');
      yAxisG.selectAll('path,line').attr('stroke', '#334155');

      g.append('text')
        .attr('x', innerW / 2)
        .attr('y', innerH + 34)
        .attr('text-anchor', 'middle')
        .attr('fill', '#cbd5e1')
        .attr('font-size', '11px')
        .attr('font-family', 'ui-monospace, SFMono-Regular, monospace')
        .text('Maximum Adverse Excursion (% of Stop-Loss Distance Consumed)');

      g.append('text')
        .attr('transform', 'rotate(-90)')
        .attr('x', -innerH / 2)
        .attr('y', -40)
        .attr('text-anchor', 'middle')
        .attr('fill', '#cbd5e1')
        .attr('font-size', '11px')
        .attr('font-family', 'ui-monospace, SFMono-Regular, monospace')
        .text('Trade Outcome (R)');
    }
  }, [chartMode, containerWidth, priceViewPoints, summary]);

  return (
    <section
      aria-label="Maximum Adverse Excursion (MAE) Chart"
      className="bg-slate-900 border border-slate-800 rounded-lg p-5 space-y-4"
    >
      {/* Header & Controls */}
      <div className="flex flex-wrap items-center justify-between gap-4 pb-3 border-b border-slate-800">
        <div>
          <h3 className="text-base font-bold text-slate-100 flex items-center gap-2">
            <TrendingDown className="w-4 h-4 text-amber-400 shrink-0" aria-hidden="true" />
            <span>Maximum Adverse Excursion (MAE) &amp; Stop-Loss Efficiency</span>
          </h3>
          <p className="text-xs text-slate-400 mt-1">
            Maps executed entry prices against the lowest/worst adverse price reached before target or stop hit to audit stop-loss sizing.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {chartMode === 'ENTRY_VS_EXTREME' && availableInstruments.length > 1 && (
            <select
              aria-label="MAE instrument filter"
              value={activeInstrumentFilter}
              onChange={(e) => setSelectedInstrument(e.target.value)}
              className="bg-slate-950 border border-slate-700 rounded px-2.5 py-1.5 text-xs font-mono text-slate-200"
            >
              {availableInstruments.map((inst) => (
                <option key={inst} value={inst}>
                  {inst}
                </option>
              ))}
            </select>
          )}

          <div
            role="group"
            aria-label="MAE chart view mode"
            className="flex items-center gap-1 p-1 bg-slate-950 border border-slate-800 rounded-lg"
          >
            <button
              type="button"
              onClick={() => setChartMode('ENTRY_VS_EXTREME')}
              aria-pressed={chartMode === 'ENTRY_VS_EXTREME'}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                chartMode === 'ENTRY_VS_EXTREME'
                  ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40 font-semibold'
                  : 'text-slate-400 hover:text-slate-200 border border-transparent'
              }`}
            >
              Entry vs. Lowest Price
            </button>
            <button
              type="button"
              onClick={() => setChartMode('STOP_EFFICIENCY')}
              aria-pressed={chartMode === 'STOP_EFFICIENCY'}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                chartMode === 'STOP_EFFICIENCY'
                  ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40 font-semibold'
                  : 'text-slate-400 hover:text-slate-200 border border-transparent'
              }`}
            >
              Stop Efficiency Scatter
            </button>
          </div>
        </div>
      </div>

      {/* Stop-Loss Efficiency KPIs */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs font-mono tabular-nums">
        <div className="bg-slate-950/70 border border-slate-800 rounded p-3">
          <span className="block text-[10px] text-slate-500 uppercase">Stop Efficiency Score</span>
          <span className="block text-base font-bold text-emerald-400 mt-0.5">
            {summary.stopEfficiencyScorePct}%
          </span>
          <span className="block text-[10px] text-slate-400 mt-0.5">
            {summary.winnerCount}W / {summary.loserCount}L / {summary.openCount} Open
          </span>
        </div>

        <div className="bg-slate-950/70 border border-slate-800 rounded p-3">
          <span className="block text-[10px] text-slate-500 uppercase">Avg Winner MAE</span>
          <span className="block text-base font-bold text-slate-100 mt-0.5">
            {summary.averageWinnerMaePctOfStop}% of Stop
          </span>
          <span className="block text-[10px] text-slate-400 mt-0.5">
            All trades avg: {summary.averageMaePctOfStop}%
          </span>
        </div>

        <div className="bg-slate-950/70 border border-slate-800 rounded p-3">
          <span className="block text-[10px] text-slate-500 uppercase">Peak Winner Excursion</span>
          <span className="block text-base font-bold text-amber-400 mt-0.5">
            {summary.maxWinnerMaePctOfStop}% of Stop
          </span>
          <span className="block text-[10px] text-slate-400 mt-0.5">
            Deepest drawdown survived
          </span>
        </div>

        <div className="bg-slate-950/70 border border-slate-800 rounded p-3">
          <span className="block text-[10px] text-slate-500 uppercase">Stop Tighten Margin</span>
          <span className="block text-base font-bold text-cyan-400 mt-0.5">
            {summary.recommendedStopTightenPct > 0
              ? `-${summary.recommendedStopTightenPct}% Width`
              : 'Calibrated'}
          </span>
          <span className="block text-[10px] text-slate-400 mt-0.5">
            Zero-shakeout headroom
          </span>
        </div>
      </div>

      {/* D3 SVG Chart Surface */}
      <div
        ref={containerRef}
        className="w-full bg-slate-950/80 border border-slate-800 rounded-lg p-2.5 overflow-hidden"
      >
        <svg
          ref={svgRef}
          className="w-full h-auto block select-none"
          role="img"
          aria-label="Maximum Adverse Excursion D3 chart mapping trade entry prices to lowest adverse price and stop-loss thresholds"
        />

        <div className="flex flex-wrap items-center justify-between gap-3 px-2 pt-2 border-t border-slate-800/80 text-[11px] font-mono text-slate-400">
          <div className="flex flex-wrap items-center gap-4">
            <span className="inline-flex items-center gap-1.5 text-slate-200">
              <span aria-hidden="true">●</span>
              <span>Entry Price</span>
            </span>
            <span className="inline-flex items-center gap-1.5 text-emerald-400">
              <span aria-hidden="true">▼</span>
              <span>Lowest / Worst Price Reached</span>
            </span>
            <span className="inline-flex items-center gap-1.5 text-rose-400">
              <span aria-hidden="true">━</span>
              <span>Stop-Loss Threshold</span>
            </span>
          </div>
          <span>Hover any trade to inspect exact stop buffer</span>
        </div>
      </div>

      {/* Active / Hovered Trade Breakdown + Efficiency Recommendation */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-3 items-stretch">
        {activePoint && (
          <div className="lg:col-span-7 bg-slate-950/70 border border-slate-800 rounded-lg p-3 text-xs font-mono tabular-nums grid grid-cols-2 sm:grid-cols-5 gap-2">
            <div>
              <span className="block text-[10px] text-slate-500">INSPECTED TRADE</span>
              <span className="font-bold text-slate-100">
                {activePoint.positionId} ({activePoint.direction})
              </span>
            </div>
            <div>
              <span className="block text-[10px] text-slate-500">ENTRY PRICE</span>
              <span className="font-bold text-slate-200">${activePoint.entryPrice.toFixed(2)}</span>
            </div>
            <div>
              <span className="block text-[10px] text-slate-500">LOWEST / WORST</span>
              <span className="font-bold text-amber-300">${activePoint.adverseExtremePrice.toFixed(2)}</span>
            </div>
            <div>
              <span className="block text-[10px] text-slate-500">MAE (% OF STOP)</span>
              <span
                className={`font-bold ${
                  activePoint.maePctOfStop >= 100
                    ? 'text-rose-400'
                    : activePoint.maePctOfStop > 65
                    ? 'text-amber-400'
                    : 'text-emerald-400'
                }`}
              >
                ${activePoint.maePoints.toFixed(2)} ({activePoint.maePctOfStop}%)
              </span>
            </div>
            <div>
              <span className="block text-[10px] text-slate-500">STOP BUFFER LEFT</span>
              <span className="font-bold text-slate-200">${activePoint.stopHeadroomPoints.toFixed(2)}</span>
            </div>
          </div>
        )}

        <div
          className={`bg-slate-950/70 border rounded-lg p-3 text-xs flex items-start gap-2 ${
            activePoint ? 'lg:col-span-5' : 'lg:col-span-12'
          } ${
            summary.recommendedStopTightenPct >= 15
              ? 'border-cyan-500/30 text-cyan-200'
              : 'border-slate-800 text-slate-300'
          }`}
        >
          {summary.recommendedStopTightenPct >= 15 ? (
            <SlidersHorizontal className="w-4 h-4 text-cyan-400 shrink-0 mt-0.5" aria-hidden="true" />
          ) : summary.loserCount > 0 ? (
            <ShieldAlert className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" aria-hidden="true" />
          ) : (
            <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" aria-hidden="true" />
          )}
          <span>{summary.recommendationText}</span>
        </div>
      </div>
    </section>
  );
};
