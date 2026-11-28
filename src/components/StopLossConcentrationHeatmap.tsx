/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * Aurum Intelligence — Hit Stop-Loss Concentration Heatmap
 *
 * Visualizes where stop-losses are clustering and failing relative to entry price
 * across distance bands, advisory horizons, and directions to diagnose psychological
 * round-number placement and technical stop-hunt patterns.
 */

import React, { useEffect, useMemo, useRef, useState } from 'react';
import * as d3 from 'd3';
import { PaperPosition, Quote } from '../domain/types';
import {
  calculateStopLossConcentrationHeatmap,
  HitStopLossPoint,
  STOP_DISTANCE_BANDS,
  StopConcentrationGroupBy,
  StopConcentrationScope,
  StopDistanceBandId,
  StopDistanceMetricMode,
  StopFailurePattern,
  StopLossConcentrationCell,
} from '../services/portfolioScannerEngine';
import { Crosshair, ShieldAlert } from 'lucide-react';

interface StopLossConcentrationHeatmapProps {
  positions: PaperPosition[];
  quote: Quote;
  quotes?: Record<string, Quote>;
  activeRangeLabel?: string;
}

function getFailurePatternLabel(pattern: StopFailurePattern): string {
  switch (pattern) {
    case 'NOISE_CHOKED':
      return 'Noise Choked (<0.35%)';
    case 'STOP_HUNT_SWEEP':
      return 'Liquidity Sweep Tag';
    case 'SLIPPAGE_OVERRUN':
      return 'Slippage / Overrun (>110%)';
    case 'STRUCTURAL_INVALIDATION':
      return 'Structural Invalidation';
  }
}

function getFailurePatternColor(pattern: StopFailurePattern): string {
  switch (pattern) {
    case 'NOISE_CHOKED':
      return '#f59e0b';
    case 'STOP_HUNT_SWEEP':
      return '#fb7185';
    case 'SLIPPAGE_OVERRUN':
      return '#ef4444';
    case 'STRUCTURAL_INVALIDATION':
      return '#94a3b8';
  }
}

function getStopHeatCellClasses(
  cell: StopLossConcentrationCell,
  isSelected: boolean,
  isHottestBand: boolean
): string {
  if (cell.hitCount === 0) {
    return isSelected
      ? 'bg-slate-900 border-amber-400/70 text-slate-500'
      : 'bg-slate-950/60 border-slate-800/80 text-slate-600 hover:border-slate-700';
  }

  const ring = isSelected
    ? 'border-amber-400 ring-1 ring-amber-400/60'
    : isHottestBand
    ? 'border-rose-400/70'
    : '';

  if (cell.intensity >= 0.78) {
    return `bg-rose-500/40 border-rose-400/75 text-rose-100 hover:border-rose-300 ${ring}`;
  }
  if (cell.intensity >= 0.55) {
    return `bg-rose-500/28 border-rose-500/60 text-rose-100 hover:border-rose-400 ${ring}`;
  }
  if (cell.intensity >= 0.35) {
    return `bg-amber-500/20 border-amber-500/45 text-amber-100 hover:border-amber-400 ${ring}`;
  }
  return `bg-rose-500/12 border-rose-500/30 text-rose-200 hover:border-rose-400 ${ring}`;
}

export const StopLossConcentrationHeatmap: React.FC<StopLossConcentrationHeatmapProps> = ({
  positions,
  quote,
  quotes,
  activeRangeLabel = 'All Cycles',
}) => {
  const [groupBy, setGroupBy] = useState<StopConcentrationGroupBy>('HORIZON');
  const [scope, setScope] = useState<StopConcentrationScope>('LOSSES_AND_BREACHED');
  const [distanceMetric, setDistanceMetric] = useState<StopDistanceMetricMode>('ACTUAL_EXIT_PCT');
  const [selectedCell, setSelectedCell] = useState<{
    rowId: string;
    bandId: StopDistanceBandId;
  } | null>(null);
  const [hoveredPointId, setHoveredPointId] = useState<string | null>(null);
  const [containerWidth, setContainerWidth] = useState<number>(760);

  const containerRef = useRef<HTMLDivElement | null>(null);
  const svgRef = useRef<SVGSVGElement | null>(null);

  const report = useMemo(
    () =>
      calculateStopLossConcentrationHeatmap(positions, {
        groupBy,
        scope,
        distanceMetric,
        defaultQuote: quote,
        quotes,
      }),
    [positions, groupBy, scope, distanceMetric, quote, quotes]
  );

  // Clear stale cell selection when filters change
  useEffect(() => {
    if (!selectedCell) return;
    const row = report.rows.find((r) => r.rowId === selectedCell.rowId);
    const cell = row?.cells.find((c) => c.bandId === selectedCell.bandId);
    if (!cell || cell.hitCount === 0) {
      setSelectedCell(null);
    }
  }, [selectedCell, report]);

  // Responsive container observer for D3 scatter/density strip
  useEffect(() => {
    const el = containerRef.current;
    if (!el || typeof ResizeObserver === 'undefined') return;
    const observer = new ResizeObserver((entries) => {
      const w = Math.max(360, Math.floor(entries[0]?.contentRect?.width || 760));
      setContainerWidth(w);
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  // D3 Stop-Loss Distance Concentration & Failure Pattern Strip
  useEffect(() => {
    const svgEl = svgRef.current;
    if (!svgEl) return;

    const svg = d3.select(svgEl);
    svg.selectAll('*').remove();

    const width = containerWidth;
    const height = report.rows.length === 2 ? 184 : 216;
    const margin = { top: 24, right: 28, bottom: 32, left: 138 };
    const innerW = Math.max(220, width - margin.left - margin.right);
    const innerH = Math.max(96, height - margin.top - margin.bottom);

    svg.attr('viewBox', `0 0 ${width} ${height}`);

    if (report.points.length === 0) {
      svg
        .append('text')
        .attr('x', width / 2)
        .attr('y', height / 2)
        .attr('text-anchor', 'middle')
        .attr('fill', '#64748b')
        .attr('font-size', '12px')
        .attr('font-family', 'ui-monospace, SFMono-Regular, monospace')
        .text('No hit or breached stop-loss events within selected cycle.');
      return;
    }

    const g = svg.append('g').attr('transform', `translate(${margin.left},${margin.top})`);

    const maxObservedPct = Math.max(1.65, ...report.points.map((p) => p.selectedDistancePct)) * 1.12;
    const xScale = d3.scaleLinear().domain([0, maxObservedPct]).range([0, innerW]);

    const rowIds = report.rows.map((r) => r.rowId);
    const rowLabelById = new Map(report.rows.map((r) => [r.rowId, r.label]));
    const yScale = d3
      .scaleBand<string>()
      .domain(rowIds)
      .range([0, innerH])
      .padding(0.28);

    // Highlight background column for the hottest stop-loss concentration band
    if (report.hottestBand) {
      const bandDef = STOP_DISTANCE_BANDS.find((b) => b.id === report.hottestBand?.bandId);
      if (bandDef) {
        const bx0 = xScale(bandDef.minPct);
        const bx1 = xScale(Math.min(maxObservedPct, bandDef.maxPct === Infinity ? maxObservedPct : bandDef.maxPct));
        if (bx1 > bx0) {
          g.append('rect')
            .attr('x', bx0)
            .attr('y', -4)
            .attr('width', bx1 - bx0)
            .attr('height', innerH + 6)
            .attr('fill', 'rgba(244, 63, 94, 0.09)')
            .attr('stroke', 'rgba(244, 63, 94, 0.35)')
            .attr('stroke-dasharray', '3 3');

          g.append('text')
            .attr('x', bx0 + (bx1 - bx0) / 2)
            .attr('y', -9)
            .attr('text-anchor', 'middle')
            .attr('fill', '#fda4af')
            .attr('font-size', '10')
            .attr('font-family', 'monospace')
            .text(`Peak Cluster (${report.hottestBand.rangeLabel})`);
        }
      }
    }

    // Horizontal row lanes
    g.selectAll('.sl-lane')
      .data(rowIds)
      .enter()
      .append('rect')
      .attr('x', 0)
      .attr('y', (id) => yScale(id) ?? 0)
      .attr('width', innerW)
      .attr('height', yScale.bandwidth())
      .attr('rx', 4)
      .attr('fill', 'rgba(15, 23, 42, 0.55)')
      .attr('stroke', '#1e293b')
      .attr('stroke-width', 1);

    // Row labels on Y-axis
    g.selectAll('.sl-row-label')
      .data(rowIds)
      .enter()
      .append('text')
      .attr('x', -10)
      .attr('y', (id) => (yScale(id) ?? 0) + yScale.bandwidth() / 2 + 4)
      .attr('text-anchor', 'end')
      .attr('fill', '#cbd5e1')
      .attr('font-size', '11')
      .attr('font-family', 'monospace')
      .text((id) => rowLabelById.get(id) || id);

    // Reference threshold lines (0.35% Noise Floor & 1.00% Structural Limit)
    [
      { pct: 0.35, label: '0.35% Noise', color: '#f59e0b' },
      { pct: 1.0, label: '1.00% Guard', color: '#64748b' },
    ].forEach((ref) => {
      if (ref.pct <= maxObservedPct) {
        const rx = xScale(ref.pct);
        g.append('line')
          .attr('x1', rx)
          .attr('x2', rx)
          .attr('y1', 0)
          .attr('y2', innerH)
          .attr('stroke', ref.color)
          .attr('stroke-width', 1)
          .attr('stroke-dasharray', '4 3')
          .attr('opacity', 0.75);
      }
    });

    // Plot each hit stop-loss point inside its row lane
    const maxLoss = Math.max(500, ...report.points.map((p) => p.lossUsd));
    const rScale = d3.scaleSqrt().domain([0, maxLoss]).range([5, 11]);

    // Deterministic slight vertical jitter within lane so overlapping distances remain distinct
    const laneIndexCounts = new Map<string, number>();
    const positionedPoints = report.points.map((pt) => {
      const rowKey = groupBy === 'DIRECTION' ? pt.direction : pt.horizon;
      const idx = laneIndexCounts.get(rowKey) || 0;
      laneIndexCounts.set(rowKey, idx + 1);
      const laneTop = yScale(rowKey) ?? 0;
      const laneMid = laneTop + yScale.bandwidth() / 2;
      const offsetPattern = [0, -7, 7, -12, 12];
      const jitter = offsetPattern[idx % offsetPattern.length];
      return {
        pt,
        cx: xScale(pt.selectedDistancePct),
        cy: laneMid + jitter,
        radius: rScale(pt.lossUsd),
      };
    });

    const nodeGroups = g
      .selectAll('.sl-hit-node')
      .data(positionedPoints)
      .enter()
      .append('g')
      .attr('class', 'sl-hit-node')
      .style('cursor', 'pointer')
      .on('mouseenter', (_e, d) => setHoveredPointId(d.pt.positionId))
      .on('click', (_e, d) => {
        const rowKey = groupBy === 'DIRECTION' ? d.pt.direction : d.pt.horizon;
        setHoveredPointId(d.pt.positionId);
        setSelectedCell({ rowId: rowKey, bandId: d.pt.bandId });
      });

    // Optional outer amber ring for psychological round-level stops
    nodeGroups
      .filter((d) => d.pt.isRoundLevelStop)
      .append('circle')
      .attr('cx', (d) => d.cx)
      .attr('cy', (d) => d.cy)
      .attr('r', (d) => d.radius + 3.5)
      .attr('fill', 'none')
      .attr('stroke', '#fbbf24')
      .attr('stroke-width', 1.25)
      .attr('opacity', 0.85);

    nodeGroups
      .append('circle')
      .attr('cx', (d) => d.cx)
      .attr('cy', (d) => d.cy)
      .attr('r', (d) => d.radius)
      .attr('fill', (d) => getFailurePatternColor(d.pt.failurePattern))
      .attr('fill-opacity', (d) => (hoveredPointId === d.pt.positionId ? 1 : 0.82))
      .attr('stroke', (d) => (hoveredPointId === d.pt.positionId ? '#f8fafc' : '#0f172a'))
      .attr('stroke-width', (d) => (hoveredPointId === d.pt.positionId ? 2 : 1.25));

    // Bottom % Distance relative to Entry axis
    const xAxis = d3
      .axisBottom(xScale)
      .ticks(6)
      .tickFormat((v) => `${Number(v).toFixed(2)}%`);

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
  }, [report, containerWidth, groupBy, hoveredPointId]);

  const activeCellTrades: HitStopLossPoint[] = useMemo(() => {
    if (!selectedCell) return [];
    const row = report.rows.find((r) => r.rowId === selectedCell.rowId);
    const cell = row?.cells.find((c) => c.bandId === selectedCell.bandId);
    return cell?.trades ?? [];
  }, [selectedCell, report.rows]);

  const inspectedPoint: HitStopLossPoint | null = useMemo(() => {
    if (hoveredPointId) {
      const found = report.points.find((p) => p.positionId === hoveredPointId);
      if (found) return found;
    }
    return activeCellTrades[0] ?? report.points[0] ?? null;
  }, [hoveredPointId, activeCellTrades, report.points]);

  return (
    <section className="bg-slate-900 border border-slate-800 rounded-lg p-5 space-y-5">
      {/* Header & Interactive Analytical Controls */}
      <div className="flex flex-wrap items-start justify-between gap-4 pb-4 border-b border-slate-800">
        <div>
          <span className="text-[11px] font-mono text-amber-400 uppercase tracking-wider block">
            Stop-Loss Failure Audit · {activeRangeLabel}
          </span>
          <h3 className="text-base font-bold text-slate-100 mt-0.5 flex items-center gap-2">
            <Crosshair className="w-4 h-4 text-rose-400 shrink-0" />
            <span>Hit Stop-Loss Concentration Heatmap (Relative to Entry)</span>
          </h3>
          <p className="text-xs text-slate-400 mt-1">
            Maps where stop-loss exits cluster by % distance from entry price, psychological round handles, and overshoot slippage.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Group By Toggle */}
          <div className="flex items-center gap-1 p-1 bg-slate-950 border border-slate-800 rounded-md">
            <button
              type="button"
              onClick={() => setGroupBy('HORIZON')}
              className={`px-2.5 py-1 text-[11px] font-medium rounded transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                groupBy === 'HORIZON'
                  ? 'bg-slate-800 text-amber-300'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              By Horizon
            </button>
            <button
              type="button"
              onClick={() => setGroupBy('DIRECTION')}
              className={`px-2.5 py-1 text-[11px] font-medium rounded transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                groupBy === 'DIRECTION'
                  ? 'bg-slate-800 text-amber-300'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              By Direction
            </button>
          </div>

          {/* Scope Toggle */}
          <div className="flex items-center gap-1 p-1 bg-slate-950 border border-slate-800 rounded-md">
            <button
              type="button"
              onClick={() => setScope('LOSSES_AND_BREACHED')}
              className={`px-2.5 py-1 text-[11px] font-medium rounded transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                scope === 'LOSSES_AND_BREACHED'
                  ? 'bg-slate-800 text-rose-300'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Closed + Breached
            </button>
            <button
              type="button"
              onClick={() => setScope('CLOSED_LOSSES')}
              className={`px-2.5 py-1 text-[11px] font-medium rounded transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                scope === 'CLOSED_LOSSES'
                  ? 'bg-slate-800 text-rose-300'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Closed Losses Only
            </button>
          </div>

          {/* Distance Metric Toggle */}
          <div className="flex items-center gap-1 p-1 bg-slate-950 border border-slate-800 rounded-md">
            <button
              type="button"
              onClick={() => setDistanceMetric('ACTUAL_EXIT_PCT')}
              className={`px-2.5 py-1 text-[11px] font-medium rounded transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                distanceMetric === 'ACTUAL_EXIT_PCT'
                  ? 'bg-slate-800 text-slate-100'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Hit Exit %
            </button>
            <button
              type="button"
              onClick={() => setDistanceMetric('PLANNED_STOP_PCT')}
              className={`px-2.5 py-1 text-[11px] font-medium rounded transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                distanceMetric === 'PLANNED_STOP_PCT'
                  ? 'bg-slate-800 text-slate-100'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Planned SL %
            </button>
          </div>
        </div>
      </div>

      {/* 4-Column KPI Summary Strip */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 text-xs font-mono">
        <div className="bg-slate-950/70 border border-slate-800 rounded p-3">
          <span className="text-[10px] text-slate-500 uppercase block">Hit Stop-Loss Events</span>
          <span className="text-base font-bold text-slate-100 tabular-nums mt-0.5 block">
            {report.totalHitStopsCount}
          </span>
          <span className="text-[11px] text-slate-400 block mt-0.5 tabular-nums">
            {report.breachedOpenCount > 0
              ? `${report.breachedOpenCount} live SL breached`
              : `Median ${report.medianStopDistancePct.toFixed(2)}% from entry`}
          </span>
        </div>

        <div className="bg-slate-950/70 border border-slate-800 rounded p-3">
          <span className="text-[10px] text-slate-500 uppercase block">Peak Failure Cluster</span>
          <span className="text-base font-bold text-rose-400 tabular-nums mt-0.5 block">
            {report.hottestBand ? report.hottestBand.rangeLabel : 'N/A'}
          </span>
          <span className="text-[11px] text-slate-400 block mt-0.5 tabular-nums">
            {report.hottestBand
              ? `${report.hottestBand.label} · ${report.hottestBand.sharePct.toFixed(1)}% share`
              : 'No cluster recorded'}
          </span>
        </div>

        <div className="bg-slate-950/70 border border-slate-800 rounded p-3">
          <span className="text-[10px] text-slate-500 uppercase block">Total Stop-Loss Drag</span>
          <span className="text-base font-bold text-rose-400 tabular-nums mt-0.5 block">
            -${report.totalLossUsd.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
          </span>
          <span className="text-[11px] text-slate-400 block mt-0.5 tabular-nums">
            Mean stop distance {report.avgStopDistancePct.toFixed(2)}%
          </span>
        </div>

        <div className="bg-slate-950/70 border border-slate-800 rounded p-3">
          <span className="text-[10px] text-slate-500 uppercase block">Psychological Round Bias</span>
          <span className="text-base font-bold text-amber-400 tabular-nums mt-0.5 block">
            {report.roundLevelClusteringPct.toFixed(1)}% Round Stops
          </span>
          <span className="text-[11px] text-slate-400 block mt-0.5 tabular-nums">
            {report.slippageOverrunCount} overrun(s) · {report.stopHuntClusterCount} sweep tag(s)
          </span>
        </div>
      </div>

      {/* Empty State vs Matrix + D3 Density Strip */}
      {report.totalHitStopsCount === 0 ? (
        <div className="p-6 rounded-lg bg-slate-950/60 border border-slate-800 text-center text-xs text-slate-400">
          No hit or breached stop-losses recorded within {activeRangeLabel}.
        </div>
      ) : (
        <div className="space-y-5">
          {/* Interactive Concentration Heatmap Matrix */}
          <div className="overflow-x-auto">
            <div className="min-w-[680px]">
              <div className="grid grid-cols-6 gap-2 mb-2 text-[11px] font-mono text-slate-400">
                <div className="px-2 py-1 text-slate-500 uppercase text-[10px]">
                  {groupBy === 'DIRECTION' ? 'Side' : 'Horizon'}
                </div>
                {report.bands.map((band) => {
                  const isHot = report.hottestBand?.bandId === band.id;
                  return (
                    <div
                      key={band.id}
                      className={`px-2 py-1 text-center rounded border ${
                        isHot
                          ? 'border-rose-500/40 bg-rose-500/10 text-rose-200'
                          : 'border-transparent text-slate-400'
                      }`}
                    >
                      <div className="font-semibold text-[11px]">{band.rangeLabel}</div>
                      <div className="text-[10px] text-slate-500">{band.label}</div>
                    </div>
                  );
                })}
              </div>

              <div className="space-y-2">
                {report.rows.map((row) => (
                  <div key={row.rowId} className="grid grid-cols-6 gap-2 items-stretch">
                    <div className="px-3 py-2.5 rounded bg-slate-950/70 border border-slate-800 flex flex-col justify-center">
                      <span className="text-xs font-semibold text-slate-100">{row.label}</span>
                      <span className="text-[11px] font-mono text-slate-400 tabular-nums mt-0.5">
                        {row.totalCount} hits · {row.sharePct.toFixed(0)}%
                      </span>
                    </div>

                    {row.cells.map((cell) => {
                      const isSelected =
                        selectedCell?.rowId === row.rowId && selectedCell?.bandId === cell.bandId;
                      const isHot = report.hottestBand?.bandId === cell.bandId;
                      return (
                        <button
                          key={cell.bandId}
                          type="button"
                          disabled={cell.hitCount === 0}
                          onClick={() => {
                            if (cell.hitCount === 0) return;
                            setSelectedCell((prev) =>
                              prev?.rowId === row.rowId && prev?.bandId === cell.bandId
                                ? null
                                : { rowId: row.rowId, bandId: cell.bandId }
                            );
                          }}
                          className={`p-2.5 rounded border text-left transition-colors font-mono ${getStopHeatCellClasses(
                            cell,
                            isSelected,
                            isHot
                          )} ${cell.hitCount > 0 ? 'cursor-pointer' : 'cursor-default'}`}
                        >
                          {cell.hitCount === 0 ? (
                            <div className="text-[11px] text-slate-600 text-center py-2">—</div>
                          ) : (
                            <div className="space-y-0.5">
                              <div className="flex items-center justify-between gap-1">
                                <span className="text-xs font-bold tabular-nums">
                                  {cell.hitCount} {cell.hitCount === 1 ? 'hit' : 'hits'}
                                </span>
                                <span className="text-[10px] opacity-85 tabular-nums">
                                  {cell.sharePct.toFixed(0)}%
                                </span>
                              </div>
                              <div className="text-[11px] font-semibold tabular-nums">
                                -${cell.totalLossUsd.toLocaleString('en-US', { maximumFractionDigits: 0 })}
                              </div>
                              <div className="text-[10px] opacity-80 tabular-nums">
                                {cell.roundLevelCount > 0
                                  ? `${cell.roundLevelCount} round`
                                  : `Avg ${cell.avgDistancePct.toFixed(2)}%`}
                              </div>
                            </div>
                          )}
                        </button>
                      );
                    })}
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* D3 Continuous Stop-Loss Distance Density Strip */}
          <div ref={containerRef} className="bg-slate-950/60 border border-slate-800 rounded-lg p-4 space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] font-mono">
              <span className="text-slate-300 font-semibold">
                Stop-Loss Distance Distribution Relative to Entry (% Move Against Entry)
              </span>
              <div className="flex flex-wrap items-center gap-3 text-slate-400">
                <span className="text-amber-400">Amber Ring: Psychological Round Price</span>
                <span className="text-rose-400">Rose: Liquidity Sweep Tag</span>
                <span className="text-red-400">Crimson: Slippage Overrun (&gt;110%)</span>
              </div>
            </div>

            <svg ref={svgRef} className="w-full h-auto overflow-visible" />

            {/* Live Inspection Readout */}
            {inspectedPoint && (
              <div className="pt-2.5 border-t border-slate-800/80 flex flex-wrap items-center justify-between gap-2 text-xs font-mono">
                <div className="flex flex-wrap items-center gap-2 text-slate-300">
                  <span className="font-bold text-slate-100">{inspectedPoint.positionId}</span>
                  <span aria-hidden="true">·</span>
                  <span>
                    {inspectedPoint.instrumentId} {inspectedPoint.direction}
                  </span>
                  <span aria-hidden="true">·</span>
                  <span className="tabular-nums">
                    Entry ${inspectedPoint.entryPrice.toFixed(2)} → Hit ${inspectedPoint.hitExitPrice.toFixed(2)} (
                    {inspectedPoint.selectedDistancePct.toFixed(2)}%)
                  </span>
                  <span aria-hidden="true">·</span>
                  <span className="text-amber-300">
                    {getFailurePatternLabel(inspectedPoint.failurePattern)}
                    {inspectedPoint.isRoundLevelStop ? ' · Round Level' : ''}
                  </span>
                </div>
                <span className="font-bold text-rose-400 tabular-nums">
                  -${inspectedPoint.lossUsd.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} Loss
                </span>
              </div>
            )}
          </div>

          {/* Drill-down Table when a Heatmap Cell is Clicked */}
          {selectedCell && activeCellTrades.length > 0 && (
            <div className="bg-slate-950/70 border border-slate-800 rounded-lg p-4 space-y-2.5">
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs font-semibold text-amber-300 font-mono">
                  Selected Cluster Drilldown ({activeCellTrades.length}{' '}
                  {activeCellTrades.length === 1 ? 'trade' : 'trades'})
                </span>
                <button
                  type="button"
                  onClick={() => setSelectedCell(null)}
                  className="text-xs font-mono text-slate-400 hover:text-slate-200 cursor-pointer"
                >
                  Clear Selection
                </button>
              </div>
              <div className="divide-y divide-slate-800/70 text-xs font-mono">
                {activeCellTrades.map((t) => (
                  <div key={t.positionId} className="py-2 flex flex-wrap items-center justify-between gap-2">
                    <div className="text-slate-300">
                      <span className="font-bold text-slate-100">{t.positionId}</span> · {t.instrumentId}{' '}
                      {t.direction} ·{' '}
                      <span className="tabular-nums">
                        Entry ${t.entryPrice.toFixed(2)} / SL ${t.stopLossPrice.toFixed(2)} / Exit $
                        {t.hitExitPrice.toFixed(2)}
                      </span>{' '}
                      · <span className="text-slate-400">{getFailurePatternLabel(t.failurePattern)}</span>
                    </div>
                    <div className="text-rose-400 font-bold tabular-nums">
                      -${t.lossUsd.toFixed(2)} ({t.selectedDistancePct.toFixed(2)}%)
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Actionable Diagnostic Insight Footer */}
      <div className="p-3 rounded bg-slate-950/60 border border-slate-800 flex items-start gap-2.5 text-xs text-slate-300">
        <ShieldAlert className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
        <p className="leading-relaxed">{report.diagnosticInsight}</p>
      </div>
    </section>
  );
};
