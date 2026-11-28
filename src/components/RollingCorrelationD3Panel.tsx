/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * Aurum Intelligence — D3.js Rolling 30-Day Macro Correlation & Risk-Off Divergence Visualizer
 *
 * Renders an interactive D3.js Scatter Plot (2D Correlation Regime Trajectory) and
 * Rolling 30D Session Heat Map across XAU/USD, DXY, and 10Y US Treasury Yields,
 * highlighting 'risk-off' divergence episodes where safe-haven bullion decouples upward.
 */

import React, { useEffect, useMemo, useRef, useState } from 'react';
import * as d3 from 'd3';
import { Candle, InstrumentId, Quote } from '../domain/types';
import {
  calculateRolling30DayCorrelationSeries,
  RollingCorrelationAnalysis,
  RollingCorrelationPoint,
} from '../services/crossCommoditySpreads';
import { Activity, AlertTriangle, Grid3X3, ScatterChart } from 'lucide-react';

interface RollingCorrelationD3PanelProps {
  quotes: Partial<Record<InstrumentId, Quote>>;
  candles?: Candle[];
}

type D3ViewMode = 'SCATTER' | 'HEATMAP';

export const RollingCorrelationD3Panel: React.FC<RollingCorrelationD3PanelProps> = ({
  quotes,
  candles = [],
}) => {
  const [viewMode, setViewMode] = useState<D3ViewMode>('SCATTER');
  const [serverAnalysis, setServerAnalysis] = useState<RollingCorrelationAnalysis | null>(null);
  const [hoveredPoint, setHoveredPoint] = useState<RollingCorrelationPoint | null>(null);
  const [containerWidth, setContainerWidth] = useState<number>(820);

  const containerRef = useRef<HTMLDivElement | null>(null);
  const svgRef = useRef<SVGSVGElement | null>(null);

  const localAnalysis = useMemo(
    () => calculateRolling30DayCorrelationSeries(quotes, candles, 45),
    [quotes, candles]
  );

  // Synchronize live rolling 30D telemetry from /api/macro/correlations
  useEffect(() => {
    let cancelled = false;
    fetch('/api/macro/correlations?window=30D')
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (!cancelled && data?.success && data.rolling30d?.points?.length) {
          setServerAnalysis(data.rolling30d as RollingCorrelationAnalysis);
        }
      })
      .catch(() => {
        // Retain deterministic local calculation silently if offline
      });
    return () => {
      cancelled = true;
    };
  }, [quotes.XAUUSD?.mid, quotes.DXY?.mid, quotes.US10Y?.mid]);

  const analysis = serverAnalysis ?? localAnalysis;
  const activePoint = hoveredPoint ?? analysis.points[analysis.points.length - 1] ?? null;

  // Responsive ResizeObserver for crisp SVG D3 layout
  useEffect(() => {
    const el = containerRef.current;
    if (!el || typeof ResizeObserver === 'undefined') return;
    const observer = new ResizeObserver((entries) => {
      const nextWidth = Math.max(360, Math.floor(entries[0]?.contentRect?.width || 820));
      setContainerWidth(nextWidth);
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  // D3.js rendering effect (Scatter Plot OR Heat Map)
  useEffect(() => {
    const svgEl = svgRef.current;
    if (!svgEl || !analysis.points.length) return;

    const points = analysis.points;
    const svg = d3.select(svgEl);
    svg.selectAll('*').remove();

    const width = containerWidth;
    const height = viewMode === 'SCATTER' ? 320 : 240;
    svg.attr('viewBox', `0 0 ${width} ${height}`);

    if (viewMode === 'SCATTER') {
      const margin = { top: 24, right: 28, bottom: 44, left: 54 };
      const innerW = Math.max(200, width - margin.left - margin.right);
      const innerH = Math.max(160, height - margin.top - margin.bottom);

      const g = svg
        .append('g')
        .attr('transform', `translate(${margin.left},${margin.top})`);

      const xScale = d3.scaleLinear().domain([-1.0, 1.0]).range([0, innerW]);
      const yScale = d3.scaleLinear().domain([-1.0, 1.0]).range([innerH, 0]);

      const colorScale = d3
        .scaleLinear<string>()
        .domain([-0.8, 0, 0.85])
        .range(['#e11d48', '#94a3b8', '#10b981'])
        .clamp(true);

      // Risk-Off Divergence Regime Shading (r(XAU,DXY) > -0.25 or r(XAU,10Y) > -0.20)
      g.append('rect')
        .attr('x', xScale(-0.25))
        .attr('y', 0)
        .attr('width', Math.max(0, innerW - xScale(-0.25)))
        .attr('height', innerH)
        .attr('fill', 'rgba(245, 158, 11, 0.08)');

      g.append('rect')
        .attr('x', 0)
        .attr('y', 0)
        .attr('width', Math.max(0, xScale(-0.25)))
        .attr('height', Math.max(0, yScale(-0.2)))
        .attr('fill', 'rgba(245, 158, 11, 0.06)');

      // Classic Inverse Regime Quadrant
      g.append('rect')
        .attr('x', 0)
        .attr('y', yScale(-0.2))
        .attr('width', Math.max(0, xScale(-0.25)))
        .attr('height', Math.max(0, innerH - yScale(-0.2)))
        .attr('fill', 'rgba(16, 185, 129, 0.04)');

      // Zero axes & Risk-off threshold dashed guides
      const gridTicks = [-0.75, -0.5, -0.25, 0, 0.25, 0.5, 0.75];
      g.selectAll('.grid-x')
        .data(gridTicks)
        .enter()
        .append('line')
        .attr('x1', (d) => xScale(d))
        .attr('x2', (d) => xScale(d))
        .attr('y1', 0)
        .attr('y2', innerH)
        .attr('stroke', (d) => (d === 0 ? '#475569' : '#1e293b'))
        .attr('stroke-width', (d) => (d === 0 ? 1.25 : 1))
        .attr('stroke-dasharray', (d) => (d === -0.25 ? '4,3' : 'none'));

      g.selectAll('.grid-y')
        .data(gridTicks)
        .enter()
        .append('line')
        .attr('x1', 0)
        .attr('x2', innerW)
        .attr('y1', (d) => yScale(d))
        .attr('y2', (d) => yScale(d))
        .attr('stroke', (d) => (d === 0 ? '#475569' : '#1e293b'))
        .attr('stroke-width', (d) => (d === 0 ? 1.25 : 1))
        .attr('stroke-dasharray', (d) => (d === -0.2 ? '4,3' : 'none'));

      // Quadrant Annotation Labels
      g.append('text')
        .attr('x', xScale(0.95))
        .attr('y', 14)
        .attr('text-anchor', 'end')
        .attr('fill', '#fbbf24')
        .attr('font-size', '10px')
        .attr('font-family', 'ui-monospace, SFMono-Regular, monospace')
        .attr('font-weight', '700')
        .text('RISK-OFF DIVERGENCE ZONE (Gold + USD/Yields Co-Bid)');

      g.append('text')
        .attr('x', 8)
        .attr('y', innerH - 8)
        .attr('fill', '#64748b')
        .attr('font-size', '10px')
        .attr('font-family', 'ui-monospace, SFMono-Regular, monospace')
        .text('Classic Inverse Regime (-r)');

      // Chronological Trajectory Line across 45 sessions
      const trajectoryLine = d3
        .line<RollingCorrelationPoint>()
        .x((d) => xScale(d.rolling30dXauDxy))
        .y((d) => yScale(d.rolling30dXauYield))
        .curve(d3.curveMonotoneX);

      g.append('path')
        .datum(points)
        .attr('fill', 'none')
        .attr('stroke', '#475569')
        .attr('stroke-width', 1.4)
        .attr('stroke-opacity', 0.65)
        .attr('d', trajectoryLine);

      // Scatter Nodes: Diamond symbols for Risk-Off Divergence, Circles for Normal
      const diamondGen = d3.symbol().type(d3.symbolDiamond).size(110);
      const circleGen = d3.symbol().type(d3.symbolCircle).size(62);

      const nodes = g
        .selectAll('.corr-node')
        .data(points)
        .enter()
        .append('g')
        .attr('class', 'corr-node')
        .attr(
          'transform',
          (d) =>
            `translate(${xScale(d.rolling30dXauDxy)},${yScale(d.rolling30dXauYield)})`
        )
        .style('cursor', 'pointer')
        .on('mouseenter', (_event, d) => setHoveredPoint(d))
        .on('mouseleave', () => setHoveredPoint(null));

      nodes
        .append('path')
        .attr('d', (d) => (d.isRiskOffDivergence ? diamondGen() : circleGen()) || '')
        .attr('fill', (d) =>
          d.isRiskOffDivergence ? '#f59e0b' : colorScale(d.rolling30dDxyYield)
        )
        .attr('fill-opacity', (d) => (d.isRiskOffDivergence ? 0.92 : 0.78))
        .attr('stroke', (d, idx) =>
          idx === points.length - 1
            ? '#ffffff'
            : d.isRiskOffDivergence
            ? '#fef3c7'
            : '#0f172a'
        )
        .attr('stroke-width', (_d, idx) => (idx === points.length - 1 ? 2 : 1.2));

      // Emphasize Live Session Anchor Ring
      const latestPt = points[points.length - 1];
      if (latestPt) {
        g.append('circle')
          .attr('cx', xScale(latestPt.rolling30dXauDxy))
          .attr('cy', yScale(latestPt.rolling30dXauYield))
          .attr('r', 10)
          .attr('fill', 'none')
          .attr('stroke', latestPt.isRiskOffDivergence ? '#f59e0b' : '#38bdf8')
          .attr('stroke-width', 1.5)
          .attr('stroke-dasharray', '3,2');
      }

      // Axes
      const xAxis = d3.axisBottom(xScale).ticks(8).tickFormat((d) => `${Number(d).toFixed(2)}`);
      const yAxis = d3.axisLeft(yScale).ticks(6).tickFormat((d) => `${Number(d).toFixed(2)}`);

      const xAxisG = g
        .append('g')
        .attr('transform', `translate(0,${innerH})`)
        .call(xAxis);
      xAxisG.selectAll('text').attr('fill', '#94a3b8').attr('font-size', '10px');
      xAxisG.selectAll('path,line').attr('stroke', '#334155');

      const yAxisG = g.append('g').call(yAxis);
      yAxisG.selectAll('text').attr('fill', '#94a3b8').attr('font-size', '10px');
      yAxisG.selectAll('path,line').attr('stroke', '#334155');

      // Axis Labels
      g.append('text')
        .attr('x', innerW / 2)
        .attr('y', innerH + 34)
        .attr('text-anchor', 'middle')
        .attr('fill', '#cbd5e1')
        .attr('font-size', '11px')
        .attr('font-family', 'ui-monospace, SFMono-Regular, monospace')
        .text('Rolling 30D Correlation: XAU/USD × DXY (r)');

      g.append('text')
        .attr('transform', 'rotate(-90)')
        .attr('x', -innerH / 2)
        .attr('y', -40)
        .attr('text-anchor', 'middle')
        .attr('fill', '#cbd5e1')
        .attr('font-size', '11px')
        .attr('font-family', 'ui-monospace, SFMono-Regular, monospace')
        .text('Rolling 30D: XAU/USD × 10Y Yield (r)');
    } else {
      // HEATMAP MODE
      const margin = { top: 28, right: 18, bottom: 34, left: 132 };
      const innerW = Math.max(200, width - margin.left - margin.right);
      const innerH = Math.max(110, height - margin.top - margin.bottom);

      const g = svg
        .append('g')
        .attr('transform', `translate(${margin.left},${margin.top})`);

      const rowDefs = [
        { key: 'rolling30dXauDxy' as const, label: 'XAU/USD × DXY' },
        { key: 'rolling30dXauYield' as const, label: 'XAU/USD × 10Y Yield' },
        { key: 'rolling30dDxyYield' as const, label: 'DXY × 10Y Yield' },
      ];

      const xBand = d3
        .scaleBand<string>()
        .domain(points.map((p) => String(p.index)))
        .range([0, innerW])
        .padding(0.08);

      const yBand = d3
        .scaleBand<string>()
        .domain(rowDefs.map((r) => r.key))
        .range([0, innerH])
        .padding(0.14);

      const heatColor = d3
        .scaleLinear<string>()
        .domain([-1.0, -0.35, 0.0, 0.35, 1.0])
        .range(['#be123c', '#f43f5e', '#1e293b', '#10b981', '#047857'])
        .clamp(true);

      // Risk-Off Divergence Header Ribbon & Column Markers
      const markerDiamond = d3.symbol().type(d3.symbolDiamond).size(36);
      points.forEach((pt) => {
        if (!pt.isRiskOffDivergence) return;
        const bx = xBand(String(pt.index)) ?? 0;
        const bw = xBand.bandwidth();
        g.append('rect')
          .attr('x', bx - 1)
          .attr('y', -4)
          .attr('width', bw + 2)
          .attr('height', innerH + 8)
          .attr('rx', 2)
          .attr('fill', 'none')
          .attr('stroke', '#f59e0b')
          .attr('stroke-width', 1.2)
          .attr('stroke-opacity', 0.85);

        g.append('path')
          .attr('d', markerDiamond() || '')
          .attr('transform', `translate(${bx + bw / 2}, -13)`)
          .attr('fill', '#f59e0b');
      });

      // Heatmap Rectangles
      rowDefs.forEach((row) => {
        const yPos = yBand(row.key) ?? 0;
        const cellH = yBand.bandwidth();

        g.selectAll(`.cell-${row.key}`)
          .data(points)
          .enter()
          .append('rect')
          .attr('x', (d) => xBand(String(d.index)) ?? 0)
          .attr('y', yPos)
          .attr('width', xBand.bandwidth())
          .attr('height', cellH)
          .attr('rx', 2)
          .attr('fill', (d) => heatColor(d[row.key]))
          .attr('stroke', (d) => (d.isRiskOffDivergence ? 'rgba(245,158,11,0.55)' : '#0f172a'))
          .attr('stroke-width', 0.75)
          .style('cursor', 'pointer')
          .on('mouseenter', (_event, d) => setHoveredPoint(d))
          .on('mouseleave', () => setHoveredPoint(null));
      });

      // Row Labels
      const yAxisG = g.append('g').call(
        d3
          .axisLeft(yBand)
          .tickFormat((k) => rowDefs.find((r) => r.key === k)?.label || k)
      );
      yAxisG
        .selectAll('text')
        .attr('fill', '#e2e8f0')
        .attr('font-size', '11px')
        .attr('font-family', 'ui-monospace, SFMono-Regular, monospace');
      yAxisG.selectAll('path,line').attr('stroke', 'none');

      // Sparse X-Axis Session Date Labels
      const step = Math.max(1, Math.floor(points.length / 7));
      const xAxisG = g
        .append('g')
        .attr('transform', `translate(0,${innerH + 4})`)
        .call(
          d3
            .axisBottom(xBand)
            .tickValues(
              points
                .filter((_, idx) => idx % step === 0 || idx === points.length - 1)
                .map((p) => String(p.index))
            )
            .tickFormat((idxStr) => points[Number(idxStr)]?.dateLabel || '')
        );
      xAxisG
        .selectAll('text')
        .attr('fill', '#94a3b8')
        .attr('font-size', '10px')
        .attr('font-family', 'ui-monospace, SFMono-Regular, monospace');
      xAxisG.selectAll('path,line').attr('stroke', '#334155');

      // Top Header Legend Note for Amber Diamonds
      g.append('text')
        .attr('x', innerW)
        .attr('y', -11)
        .attr('text-anchor', 'end')
        .attr('fill', '#fbbf24')
        .attr('font-size', '10px')
        .attr('font-family', 'ui-monospace, SFMono-Regular, monospace')
        .text('◆ Highlighted Columns = Risk-Off Divergence Window');
    }
  }, [analysis, containerWidth, viewMode]);

  const { currentSnapshot, riskOffDivergenceEpisodes } = analysis;

  return (
    <section
      aria-label="D3 Rolling 30-Day Correlation & Risk-Off Divergence Visualizer"
      className="bg-slate-900 border border-slate-800 rounded-lg p-5 space-y-4"
    >
      {/* Header & Visualization Mode Toggle */}
      <div className="flex flex-wrap items-center justify-between gap-4 pb-3 border-b border-slate-800">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <Activity className="w-4 h-4 text-amber-400 shrink-0" aria-hidden="true" />
            <h3 className="text-base font-bold text-slate-100">
              Rolling 30-Day Correlation &amp; Risk-Off Divergence
            </h3>
            <span
              className={`text-[11px] font-mono font-semibold px-2 py-0.5 rounded border ${
                currentSnapshot.regimeTag === 'RISK_OFF_DIVERGENCE'
                  ? 'bg-amber-500/15 text-amber-300 border-amber-500/40'
                  : currentSnapshot.regimeTag === 'CLASSIC_INVERSE'
                  ? 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30'
                  : 'bg-slate-800 text-slate-300 border-slate-700'
              }`}
            >
              {currentSnapshot.regimeTag.replace(/_/g, ' ')}
            </span>
          </div>
          <p className="text-xs text-slate-400 mt-1">
            D3.js 45-session rolling 30-day Pearson trajectory across XAU/USD, DXY &amp; 10Y Treasury yields with risk-off decoupling flags.
          </p>
        </div>

        {/* Scatter vs Heat Map Switcher */}
        <div
          role="group"
          aria-label="Correlation visualization type"
          className="flex items-center gap-1 p-1 bg-slate-950 border border-slate-800 rounded-lg"
        >
          <button
            type="button"
            onClick={() => setViewMode('SCATTER')}
            aria-pressed={viewMode === 'SCATTER'}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
              viewMode === 'SCATTER'
                ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40 font-semibold'
                : 'text-slate-400 hover:text-slate-200 border border-transparent'
            }`}
          >
            <ScatterChart className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
            <span>D3 Scatter Plot</span>
          </button>
          <button
            type="button"
            onClick={() => setViewMode('HEATMAP')}
            aria-pressed={viewMode === 'HEATMAP'}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
              viewMode === 'HEATMAP'
                ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40 font-semibold'
                : 'text-slate-400 hover:text-slate-200 border border-transparent'
            }`}
          >
            <Grid3X3 className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
            <span>D3 Heat Map</span>
          </button>
        </div>
      </div>

      {/* Live / Hovered Session Readout Strip */}
      {activePoint && (
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-2.5 text-xs font-mono tabular-nums">
          <div className="bg-slate-950/70 border border-slate-800 rounded px-3 py-2">
            <span className="block text-[10px] text-slate-500 uppercase">Session</span>
            <span className="block text-sm font-bold text-slate-100 mt-0.5">
              {activePoint.dateLabel}
              {activePoint.index === analysis.points.length - 1 ? ' (Live)' : ''}
            </span>
          </div>

          <div className="bg-slate-950/70 border border-slate-800 rounded px-3 py-2">
            <span className="block text-[10px] text-slate-500 uppercase">30D XAU × DXY</span>
            <span
              className={`block text-sm font-bold mt-0.5 ${
                activePoint.rolling30dXauDxy <= -0.3
                  ? 'text-rose-400'
                  : activePoint.rolling30dXauDxy >= 0.2
                  ? 'text-emerald-400'
                  : 'text-amber-300'
              }`}
            >
              {activePoint.rolling30dXauDxy >= 0 ? '+' : ''}
              {activePoint.rolling30dXauDxy.toFixed(2)}
            </span>
          </div>

          <div className="bg-slate-950/70 border border-slate-800 rounded px-3 py-2">
            <span className="block text-[10px] text-slate-500 uppercase">30D XAU × 10Y</span>
            <span
              className={`block text-sm font-bold mt-0.5 ${
                activePoint.rolling30dXauYield <= -0.3
                  ? 'text-rose-400'
                  : activePoint.rolling30dXauYield >= 0.2
                  ? 'text-emerald-400'
                  : 'text-amber-300'
              }`}
            >
              {activePoint.rolling30dXauYield >= 0 ? '+' : ''}
              {activePoint.rolling30dXauYield.toFixed(2)}
            </span>
          </div>

          <div className="bg-slate-950/70 border border-slate-800 rounded px-3 py-2">
            <span className="block text-[10px] text-slate-500 uppercase">30D DXY × 10Y</span>
            <span className="block text-sm font-bold text-emerald-400 mt-0.5">
              {activePoint.rolling30dDxyYield >= 0 ? '+' : ''}
              {activePoint.rolling30dDxyYield.toFixed(2)}
            </span>
          </div>

          <div className="bg-slate-950/70 border border-slate-800 rounded px-3 py-2 col-span-2 sm:col-span-1">
            <span className="block text-[10px] text-slate-500 uppercase">Session Moves</span>
            <span className="block text-[11px] text-slate-300 mt-1">
              Au {activePoint.xauReturnPct >= 0 ? '+' : ''}
              {activePoint.xauReturnPct.toFixed(2)}% · $ {activePoint.dxyReturnPct >= 0 ? '+' : ''}
              {activePoint.dxyReturnPct.toFixed(2)}%
            </span>
          </div>
        </div>
      )}

      {/* D3 SVG Canvas */}
      <div
        ref={containerRef}
        className="w-full bg-slate-950/80 border border-slate-800 rounded-lg p-2 overflow-hidden"
      >
        <svg
          ref={svgRef}
          className="w-full h-auto block select-none"
          role="img"
          aria-label={
            viewMode === 'SCATTER'
              ? 'D3 scatter plot of rolling 30-day correlation between XAU/USD, DXY, and 10Y Treasury yields'
              : 'D3 heat map of rolling 30-day correlation sessions highlighting risk-off divergence'
          }
        />
        <div className="flex flex-wrap items-center justify-between gap-2 px-2 pt-2 border-t border-slate-800/80 text-[11px] font-mono text-slate-400">
          <div className="flex flex-wrap items-center gap-4">
            <span className="inline-flex items-center gap-1.5 text-amber-300">
              <span aria-hidden="true">◆</span>
              <span>Risk-Off Divergence Session</span>
            </span>
            <span className="inline-flex items-center gap-1.5 text-slate-300">
              <span aria-hidden="true">●</span>
              <span>Normal Transmission (Color = DXY/10Y r)</span>
            </span>
            {viewMode === 'SCATTER' && (
              <span className="inline-flex items-center gap-1.5 text-sky-300">
                <span aria-hidden="true">◌</span>
                <span>Live Anchor</span>
              </span>
            )}
          </div>
          <span>Hover any node or column for exact session breakdown</span>
        </div>
      </div>

      {/* Detected Risk-Off Divergence Episodes */}
      {riskOffDivergenceEpisodes.length > 0 && (
        <div className="space-y-2">
          <div className="text-[11px] font-mono uppercase tracking-wider text-amber-400 flex items-center gap-1.5">
            <AlertTriangle className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
            <span>
              Detected Risk-Off Divergence Periods ({riskOffDivergenceEpisodes.length})
            </span>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
            {riskOffDivergenceEpisodes.map((ep, idx) => (
              <div
                key={`${ep.startLabel}_${ep.endLabel}_${idx}`}
                className="bg-slate-950/70 border border-amber-500/30 rounded-lg px-3.5 py-2.5 text-xs space-y-1"
              >
                <div className="flex items-center justify-between gap-2 font-mono">
                  <span className="font-bold text-amber-300">
                    ◆ {ep.startLabel} – {ep.endLabel} ({ep.sessionCount}d)
                  </span>
                  <span className="text-[11px] text-slate-400 tabular-nums">
                    Peak XAU/DXY: {ep.peakXauDxyCorr >= 0 ? '+' : ''}
                    {ep.peakXauDxyCorr.toFixed(2)} · 10Y: {ep.peakXauYieldCorr >= 0 ? '+' : ''}
                    {ep.peakXauYieldCorr.toFixed(2)}
                  </span>
                </div>
                <p className="text-[11px] text-slate-300 leading-relaxed">{ep.driverSummary}</p>
              </div>
            ))}
          </div>
        </div>
      )}
    </section>
  );
};
