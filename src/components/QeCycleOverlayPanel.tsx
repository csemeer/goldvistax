/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * Aurum Intelligence — Council Workspace Historical QE Cycle Overlay Panel
 *
 * Overlays canonical Quantitative Easing (QE1, QE2, QE3, QE4) liquidity expansion
 * cycles directly over current XAU/USD price action via D3.js to compare market
 * behavior during past monetary expansion regimes.
 */

import React, { useEffect, useMemo, useRef, useState } from 'react';
import * as d3 from 'd3';
import { Candle, InstrumentId, Quote } from '../domain/types';
import { generateCandleHistory } from '../services/marketData';
import {
  HISTORICAL_QE_CYCLE_PROFILES,
  projectQeCycleOverlay,
  QeCycleId,
  QeOverlayPoint,
} from '../services/macroData';
import { TrendingUp, Layers } from 'lucide-react';

interface QeCycleOverlayPanelProps {
  quotes: Partial<Record<InstrumentId, Quote>>;
  candles?: Candle[];
}

type OverlayScaleMode = 'PRICE_USD' | 'RETURN_PCT';
type WindowBarsOption = 30 | 60 | 90;

export const QeCycleOverlayPanel: React.FC<QeCycleOverlayPanelProps> = ({
  quotes,
  candles = [],
}) => {
  const [selectedCycleIds, setSelectedCycleIds] = useState<QeCycleId[]>(['QE1', 'QE4_2020']);
  const [windowBars, setWindowBars] = useState<WindowBarsOption>(60);
  const [scaleMode, setScaleMode] = useState<OverlayScaleMode>('PRICE_USD');
  const [hoveredPoint, setHoveredPoint] = useState<QeOverlayPoint | null>(null);
  const [containerWidth, setContainerWidth] = useState<number>(820);

  const containerRef = useRef<HTMLDivElement | null>(null);
  const svgRef = useRef<SVGSVGElement | null>(null);

  const liveSpotMid = quotes.XAUUSD?.mid ?? 3898.9;

  const effectiveCandles = useMemo(() => {
    if (Array.isArray(candles) && candles.length >= 20) {
      return candles;
    }
    return generateCandleHistory('1D', 120, liveSpotMid);
  }, [candles, liveSpotMid]);

  const overlay = useMemo(
    () =>
      projectQeCycleOverlay(effectiveCandles, {
        selectedCycleIds,
        windowBars,
        liveSpotMid,
      }),
    [effectiveCandles, selectedCycleIds, windowBars, liveSpotMid]
  );

  const activePoint = hoveredPoint ?? overlay.points[overlay.points.length - 1] ?? null;

  const toggleCycle = (id: QeCycleId) => {
    setSelectedCycleIds((prev) => {
      if (prev.includes(id)) {
        // Always keep at least one cycle overlaid
        return prev.length > 1 ? prev.filter((item) => item !== id) : prev;
      }
      return [...prev, id];
    });
  };

  useEffect(() => {
    const el = containerRef.current;
    if (!el || typeof ResizeObserver === 'undefined') return;
    const observer = new ResizeObserver((entries) => {
      const w = Math.max(360, Math.floor(entries[0]?.contentRect?.width || 820));
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
    const height = 300;
    svg.attr('viewBox', `0 0 ${width} ${height}`);

    if (!overlay.hasData || overlay.points.length < 2) {
      svg
        .append('text')
        .attr('x', width / 2)
        .attr('y', height / 2)
        .attr('text-anchor', 'middle')
        .attr('fill', '#64748b')
        .attr('font-size', '12px')
        .attr('font-family', 'ui-monospace, SFMono-Regular, monospace')
        .text('Awaiting XAU/USD candles to project QE cycle overlays.');
      return;
    }

    const margin = { top: 22, right: 92, bottom: 38, left: 66 };
    const innerW = Math.max(200, width - margin.left - margin.right);
    const innerH = Math.max(150, height - margin.top - margin.bottom);

    const g = svg
      .append('g')
      .attr('transform', `translate(${margin.left},${margin.top})`);

    const pts = overlay.points;
    const xScale = d3
      .scaleLinear()
      .domain([0, Math.max(1, pts.length - 1)])
      .range([0, innerW]);

    const getYValActual = (p: QeOverlayPoint) =>
      scaleMode === 'PRICE_USD' ? p.actualPrice : p.actualReturnPct;
    const getYValQe = (p: QeOverlayPoint, id: QeCycleId) =>
      scaleMode === 'PRICE_USD' ? p.qePrices[id] : p.qeReturnsPct[id];

    const allYValues: number[] = pts.map(getYValActual);
    overlay.selectedCycleIds.forEach((id) => {
      pts.forEach((p) => {
        allYValues.push(getYValQe(p, id));
      });
    });

    const yMinRaw = Math.min(...allYValues);
    const yMaxRaw = Math.max(...allYValues);
    const yPad = Math.max(scaleMode === 'PRICE_USD' ? 25 : 1.5, (yMaxRaw - yMinRaw) * 0.14);
    const yScale = d3
      .scaleLinear()
      .domain([yMinRaw - yPad, yMaxRaw + yPad])
      .range([innerH, 0]);

    // Horizontal grid lines
    g.selectAll('.qe-grid-y')
      .data(yScale.ticks(6))
      .enter()
      .append('line')
      .attr('x1', 0)
      .attr('x2', innerW)
      .attr('y1', (d) => yScale(d))
      .attr('y2', (d) => yScale(d))
      .attr('stroke', (d) =>
        scaleMode === 'RETURN_PCT' && d === 0 ? '#475569' : '#1e293b'
      )
      .attr('stroke-width', (d) => (scaleMode === 'RETURN_PCT' && d === 0 ? 1.3 : 1));

    // Anchor baseline rule in PRICE_USD mode
    if (scaleMode === 'PRICE_USD') {
      g.append('line')
        .attr('x1', 0)
        .attr('x2', innerW)
        .attr('y1', yScale(overlay.anchorPrice))
        .attr('y2', yScale(overlay.anchorPrice))
        .attr('stroke', '#475569')
        .attr('stroke-dasharray', '3,3')
        .attr('stroke-width', 1);
    }

    // Shaded area under Current XAU/USD Price Action
    const baselineY =
      scaleMode === 'PRICE_USD'
        ? yScale(Math.max(yMinRaw - yPad, overlay.anchorPrice))
        : yScale(0);

    const actualArea = d3
      .area<QeOverlayPoint>()
      .x((d) => xScale(d.stepIndex))
      .y0(baselineY)
      .y1((d) => yScale(getYValActual(d)))
      .curve(d3.curveMonotoneX);

    g.append('path')
      .datum(pts)
      .attr('fill', 'rgba(245, 158, 11, 0.14)')
      .attr('d', actualArea);

    // Draw each selected historical QE cycle trajectory
    overlay.comparisons.forEach((comp) => {
      const cycleLine = d3
        .line<QeOverlayPoint>()
        .x((d) => xScale(d.stepIndex))
        .y((d) => yScale(getYValQe(d, comp.profile.id)))
        .curve(d3.curveMonotoneX);

      g.append('path')
        .datum(pts)
        .attr('fill', 'none')
        .attr('stroke', comp.profile.colorHex)
        .attr('stroke-width', 2)
        .attr('stroke-dasharray', '5,3')
        .attr('stroke-opacity', 0.92)
        .attr('d', cycleLine);

      // End terminal label on right edge
      const lastPt = pts[pts.length - 1];
      const endY = yScale(getYValQe(lastPt, comp.profile.id));
      g.append('circle')
        .attr('cx', xScale(lastPt.stepIndex))
        .attr('cy', endY)
        .attr('r', 3.5)
        .attr('fill', comp.profile.colorHex);

      g.append('text')
        .attr('x', innerW + 8)
        .attr('y', endY + 3.5)
        .attr('fill', comp.profile.colorHex)
        .attr('font-size', '10px')
        .attr('font-weight', '700')
        .attr('font-family', 'ui-monospace, SFMono-Regular, monospace')
        .text(
          scaleMode === 'PRICE_USD'
            ? `${comp.profile.id === 'QE4_2020' ? 'QE4' : comp.profile.id} $${comp.projectedEndPrice.toFixed(0)}`
            : `${comp.profile.id === 'QE4_2020' ? 'QE4' : comp.profile.id} ${comp.qeWindowReturnPct >= 0 ? '+' : ''}${comp.qeWindowReturnPct}%`
        );
    });

    // Current XAU/USD primary trajectory on top
    const actualLine = d3
      .line<QeOverlayPoint>()
      .x((d) => xScale(d.stepIndex))
      .y((d) => yScale(getYValActual(d)))
      .curve(d3.curveMonotoneX);

    g.append('path')
      .datum(pts)
      .attr('fill', 'none')
      .attr('stroke', '#fbbf24')
      .attr('stroke-width', 2.6)
      .attr('d', actualLine);

    const lastPt = pts[pts.length - 1];
    const actualEndY = yScale(getYValActual(lastPt));
    g.append('circle')
      .attr('cx', xScale(lastPt.stepIndex))
      .attr('cy', actualEndY)
      .attr('r', 4.5)
      .attr('fill', '#fbbf24')
      .attr('stroke', '#0f172a')
      .attr('stroke-width', 1.5);

    g.append('text')
      .attr('x', innerW + 8)
      .attr('y', actualEndY + 3.5)
      .attr('fill', '#fde68a')
      .attr('font-size', '10.5px')
      .attr('font-weight', '700')
      .attr('font-family', 'ui-monospace, SFMono-Regular, monospace')
      .text(
        scaleMode === 'PRICE_USD'
          ? `SPOT $${lastPt.actualPrice.toFixed(0)}`
          : `SPOT ${lastPt.actualReturnPct >= 0 ? '+' : ''}${lastPt.actualReturnPct}%`
      );

    // Axes
    const tickIndexes = [
      0,
      Math.floor(pts.length * 0.25),
      Math.floor(pts.length * 0.5),
      Math.floor(pts.length * 0.75),
      pts.length - 1,
    ];
    const xAxis = d3
      .axisBottom(xScale)
      .tickValues(Array.from(new Set(tickIndexes)))
      .tickFormat((idx) => pts[Number(idx)]?.dateLabel || `T+${idx}`);

    const yAxis = d3
      .axisLeft(yScale)
      .ticks(6)
      .tickFormat((v) =>
        scaleMode === 'PRICE_USD'
          ? `$${Math.round(Number(v)).toLocaleString()}`
          : `${Number(v) >= 0 ? '+' : ''}${Number(v).toFixed(1)}%`
      );

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
      .attr('fill', '#cbd5e1')
      .attr('font-size', '10px')
      .attr('font-family', 'ui-monospace, SFMono-Regular, monospace');
    yAxisG.selectAll('path,line').attr('stroke', '#334155');

    // Interactive Hover Overlay & Vertical Guide
    const hoverGuide = g
      .append('line')
      .attr('y1', 0)
      .attr('y2', innerH)
      .attr('stroke', '#64748b')
      .attr('stroke-dasharray', '2,2')
      .style('opacity', 0);

    g.append('rect')
      .attr('width', innerW)
      .attr('height', innerH)
      .attr('fill', 'transparent')
      .style('cursor', 'crosshair')
      .on('mousemove', (event) => {
        const [mx] = d3.pointer(event);
        const idx = Math.max(0, Math.min(pts.length - 1, Math.round(xScale.invert(mx))));
        const targetPt = pts[idx];
        if (targetPt) {
          hoverGuide.attr('x1', xScale(targetPt.stepIndex)).attr('x2', xScale(targetPt.stepIndex)).style('opacity', 0.9);
          setHoveredPoint(targetPt);
        }
      })
      .on('mouseleave', () => {
        hoverGuide.style('opacity', 0);
        setHoveredPoint(null);
      });
  }, [containerWidth, overlay, scaleMode]);

  return (
    <section
      aria-label="Historical QE Cycle Overlay"
      className="bg-slate-900 border border-slate-800 rounded-lg p-5 space-y-4"
    >
      {/* Header & Scale/Window Controls */}
      <div className="flex flex-wrap items-center justify-between gap-4 pb-3 border-b border-slate-800">
        <div>
          <h3 className="text-base font-bold text-slate-100 flex items-center gap-2">
            <TrendingUp className="w-4 h-4 text-amber-400 shrink-0" aria-hidden="true" />
            <span>Historical QE Liquidity Cycle Overlay (XAU/USD)</span>
          </h3>
          <div className="flex flex-wrap items-center gap-2 text-xs text-slate-400 mt-1">
            <span>Anchor: T=0 (${overlay.anchorPrice.toFixed(2)})</span>
            <span aria-hidden="true">·</span>
            <span>{overlay.windowBars}-Session Liquidity Window</span>
            <span aria-hidden="true">·</span>
            <span>Fed Balance Sheet Expansion Regimes vs. Current Price Action</span>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Window Bar Length Switcher */}
          <div
            role="group"
            aria-label="QE overlay comparison window"
            className="flex items-center gap-1 p-1 bg-slate-950 border border-slate-800 rounded-lg"
          >
            {([30, 60, 90] as WindowBarsOption[]).map((bars) => (
              <button
                key={bars}
                type="button"
                onClick={() => setWindowBars(bars)}
                aria-pressed={windowBars === bars}
                className={`px-2.5 py-1 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                  windowBars === bars
                    ? 'bg-slate-800 text-slate-100 font-semibold border border-slate-700'
                    : 'text-slate-400 hover:text-slate-200 border border-transparent'
                }`}
              >
                {bars}D Window
              </button>
            ))}
          </div>

          {/* Price USD vs Return % Toggle */}
          <div
            role="group"
            aria-label="QE overlay scale mode"
            className="flex items-center gap-1 p-1 bg-slate-950 border border-slate-800 rounded-lg"
          >
            <button
              type="button"
              onClick={() => setScaleMode('PRICE_USD')}
              aria-pressed={scaleMode === 'PRICE_USD'}
              className={`px-3 py-1 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                scaleMode === 'PRICE_USD'
                  ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40 font-semibold'
                  : 'text-slate-400 hover:text-slate-200 border border-transparent'
              }`}
            >
              Price Overlay ($/oz)
            </button>
            <button
              type="button"
              onClick={() => setScaleMode('RETURN_PCT')}
              aria-pressed={scaleMode === 'RETURN_PCT'}
              className={`px-3 py-1 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                scaleMode === 'RETURN_PCT'
                  ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40 font-semibold'
                  : 'text-slate-400 hover:text-slate-200 border border-transparent'
              }`}
            >
              Indexed Return (%)
            </button>
          </div>
        </div>
      </div>

      {/* Multi-Select Historical QE Cycle Overlay Buttons */}
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-xs font-mono text-slate-400 flex items-center gap-1.5 mr-1">
          <Layers className="w-3.5 h-3.5 text-amber-400" aria-hidden="true" />
          <span>Overlay Cycles:</span>
        </span>
        {HISTORICAL_QE_CYCLE_PROFILES.map((profile) => {
          const isActive = selectedCycleIds.includes(profile.id);
          return (
            <button
              key={profile.id}
              type="button"
              onClick={() => toggleCycle(profile.id)}
              aria-pressed={isActive}
              className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-lg border text-xs font-mono transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                isActive
                  ? 'bg-slate-800 text-slate-100 border-slate-600 font-semibold'
                  : 'bg-slate-950 text-slate-400 border-slate-800 hover:text-slate-200'
              }`}
            >
              <span
                className="w-2.5 h-2.5 rounded-xs shrink-0"
                style={{ backgroundColor: isActive ? profile.colorHex : '#475569' }}
                aria-hidden="true"
              />
              <span>{profile.shortLabel}</span>
            </button>
          );
        })}
      </div>

      {/* D3 Chart Canvas + Active Crosshair Strip */}
      <div
        ref={containerRef}
        className="w-full bg-slate-950/80 border border-slate-800 rounded-lg p-3 space-y-2"
      >
        <svg
          ref={svgRef}
          className="w-full h-auto block select-none"
          role="img"
          aria-label="D3 chart overlaying historical Quantitative Easing cycles against current XAU/USD price action"
        />

        {activePoint && (
          <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-slate-800/80 text-[11px] font-mono tabular-nums text-slate-300">
            <div className="flex flex-wrap items-center gap-4">
              <span className="text-slate-400">
                Session: <strong className="text-slate-100">{activePoint.dateLabel}</strong>
              </span>
              <span className="text-amber-300">
                XAU/USD: <strong>${activePoint.actualPrice.toFixed(2)}</strong> ({activePoint.actualReturnPct >= 0 ? '+' : ''}
                {activePoint.actualReturnPct}%)
              </span>
              {overlay.comparisons.map((c) => (
                <span key={c.profile.id} style={{ color: c.profile.colorHex }}>
                  {c.profile.shortLabel}:{' '}
                  <strong>${activePoint.qePrices[c.profile.id].toFixed(2)}</strong> ({activePoint.qeReturnsPct[c.profile.id] >= 0 ? '+' : ''}
                  {activePoint.qeReturnsPct[c.profile.id]}%)
                </span>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* QE Cycle Comparison Breakdown Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-3 text-xs font-mono tabular-nums">
        {overlay.comparisons.map((comp) => (
          <div
            key={comp.profile.id}
            className="bg-slate-950/70 border border-slate-800 rounded-lg p-3 space-y-1.5"
          >
            <div className="flex items-center justify-between gap-2 pb-1.5 border-b border-slate-800/80">
              <span className="font-bold" style={{ color: comp.profile.colorHex }}>
                {comp.profile.shortLabel}
              </span>
              <span className="text-[11px] text-slate-400">{comp.profile.periodLabel}</span>
            </div>

            <div className="flex justify-between text-slate-400">
              <span>Liquidity Impulse</span>
              <span className="text-slate-200 font-semibold">{comp.profile.balanceSheetExpansion}</span>
            </div>

            <div className="flex justify-between text-slate-400">
              <span>Implied XAU Level</span>
              <span className="text-slate-100 font-bold">${comp.projectedEndPrice.toFixed(2)}</span>
            </div>

            <div className="flex justify-between text-slate-400">
              <span>Spread vs. Spot</span>
              <span
                className={`font-bold ${
                  comp.trackingSpreadPct >= 0 ? 'text-emerald-400' : 'text-rose-400'
                }`}
              >
                {comp.trackingSpreadPct >= 0 ? '+' : ''}
                {comp.trackingSpreadPct}% ({comp.alignmentLabel.replace(/_/g, ' ')})
              </span>
            </div>

            <div className="flex justify-between text-slate-400">
              <span>Path Corr (r) / Real Yield</span>
              <span className="text-sky-300">
                {comp.pathCorrelation >= 0 ? '+' : ''}
                {comp.pathCorrelation.toFixed(2)} · {comp.profile.realYieldShiftBps > 0 ? '+' : ''}
                {comp.profile.realYieldShiftBps}bps
              </span>
            </div>
          </div>
        ))}
      </div>

      {/* Synthesis Note */}
      <p className="text-xs text-slate-300 pt-2 border-t border-slate-800 leading-relaxed">
        {overlay.synthesisNote}
      </p>
    </section>
  );
};
