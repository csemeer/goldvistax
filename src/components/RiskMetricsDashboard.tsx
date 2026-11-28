/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * Aurum Intelligence — Paper Trading Account Risk Metrics Dashboard
 *
 * Tracks Maximum & Current Drawdown, Annualized Sharpe Ratio, Sortino Ratio,
 * Calmar Ratio, Equity High-Water Mark curve, and Underwater Drawdown profile
 * via D3.js inside PortfolioJournalWorkspace.
 */

import React, { useEffect, useMemo, useRef, useState } from 'react';
import * as d3 from 'd3';
import { PaperPosition, Quote } from '../domain/types';
import {
  calculateAccountRiskMetrics,
  EquityDrawdownPoint,
} from '../services/portfolioScannerEngine';
import { Activity, ShieldCheck, AlertTriangle, TrendingUp } from 'lucide-react';

interface RiskMetricsDashboardProps {
  allPositions: PaperPosition[];
  filteredPositions: PaperPosition[];
  activeRangeLabel: string;
  isRangeFiltered: boolean;
  startingCapital: number;
  quote: Quote;
  quotes?: Record<string, Quote>;
}

type RiskScopeMode = 'FULL_ACCOUNT' | 'FILTERED_CYCLE';
type RiskChartMode = 'UNDERWATER_EQUITY' | 'TRADE_RETURNS';

export const RiskMetricsDashboard: React.FC<RiskMetricsDashboardProps> = ({
  allPositions,
  filteredPositions,
  activeRangeLabel,
  isRangeFiltered,
  startingCapital,
  quote,
  quotes = {},
}) => {
  const [scopeMode, setScopeMode] = useState<RiskScopeMode>('FULL_ACCOUNT');
  const [chartMode, setChartMode] = useState<RiskChartMode>('UNDERWATER_EQUITY');
  const [riskFreeRatePct, setRiskFreeRatePct] = useState<number>(4.25);
  const [hoveredStep, setHoveredStep] = useState<EquityDrawdownPoint | null>(null);
  const [containerWidth, setContainerWidth] = useState<number>(820);

  const containerRef = useRef<HTMLDivElement | null>(null);
  const svgRef = useRef<SVGSVGElement | null>(null);

  const activePositions =
    scopeMode === 'FILTERED_CYCLE' && isRangeFiltered ? filteredPositions : allPositions;

  const metrics = useMemo(
    () =>
      calculateAccountRiskMetrics(activePositions, {
        startingCapitalUsd: startingCapital,
        riskFreeRateAnnualPct: riskFreeRatePct,
        quotes,
        defaultQuote: quote,
      }),
    [activePositions, startingCapital, riskFreeRatePct, quotes, quote]
  );

  const activePoint =
    hoveredStep ?? metrics.equitySeries[metrics.equitySeries.length - 1] ?? null;

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
    const height = 285;
    svg.attr('viewBox', `0 0 ${width} ${height}`);

    if (metrics.tradesAnalyzedCount === 0 || metrics.equitySeries.length < 2) {
      svg
        .append('text')
        .attr('x', width / 2)
        .attr('y', height / 2)
        .attr('text-anchor', 'middle')
        .attr('fill', '#64748b')
        .attr('font-size', '12px')
        .attr('font-family', 'ui-monospace, SFMono-Regular, monospace')
        .text('Execute or select trades to render equity curve, underwater drawdown, Sharpe, and Sortino ratios.');
      return;
    }

    const margin = { top: 20, right: 28, bottom: 34, left: 66 };
    const innerW = Math.max(220, width - margin.left - margin.right);
    const innerH = Math.max(160, height - margin.top - margin.bottom);

    const g = svg
      .append('g')
      .attr('transform', `translate(${margin.left},${margin.top})`);

    const pts = metrics.equitySeries;

    if (chartMode === 'UNDERWATER_EQUITY') {
      // Top band (58% height): Account Equity vs High-Water Mark
      // Bottom band (34% height): Underwater Drawdown (%)
      const equityH = Math.round(innerH * 0.56);
      const gapH = Math.round(innerH * 0.1);
      const ddTop = equityH + gapH;
      const ddH = Math.max(48, innerH - ddTop);

      const xScale = d3
        .scaleLinear()
        .domain([0, Math.max(1, pts.length - 1)])
        .range([0, innerW]);

      const eqVals = pts.flatMap((p) => [p.equityUsd, p.peakEquityUsd]);
      const eqMin = Math.min(...eqVals);
      const eqMax = Math.max(...eqVals);
      const eqPad = Math.max(500, (eqMax - eqMin) * 0.14);
      const yEq = d3
        .scaleLinear()
        .domain([eqMin - eqPad, eqMax + eqPad])
        .range([equityH, 0]);

      const maxDdAxis = Math.max(2.0, metrics.maxDrawdownPct * 1.25);
      const yDd = d3.scaleLinear().domain([0, -maxDdAxis]).range([ddTop, ddTop + ddH]);

      // Equity panel grid lines
      g.selectAll('.risk-eq-grid')
        .data(yEq.ticks(4))
        .enter()
        .append('line')
        .attr('x1', 0)
        .attr('x2', innerW)
        .attr('y1', (d) => yEq(d))
        .attr('y2', (d) => yEq(d))
        .attr('stroke', '#1e293b')
        .attr('stroke-width', 1);

      // Drawdown panel 0% baseline & grid
      g.append('line')
        .attr('x1', 0)
        .attr('x2', innerW)
        .attr('y1', yDd(0))
        .attr('y2', yDd(0))
        .attr('stroke', '#334155')
        .attr('stroke-width', 1.2);

      // High-Water Mark dashed line
      const peakLine = d3
        .line<EquityDrawdownPoint>()
        .x((d) => xScale(d.stepIndex))
        .y((d) => yEq(d.peakEquityUsd))
        .curve(d3.curveStepAfter);

      g.append('path')
        .datum(pts)
        .attr('fill', 'none')
        .attr('stroke', '#64748b')
        .attr('stroke-width', 1.4)
        .attr('stroke-dasharray', '4,3')
        .attr('d', peakLine);

      // Account Equity shaded area & curve
      const eqArea = d3
        .area<EquityDrawdownPoint>()
        .x((d) => xScale(d.stepIndex))
        .y0(equityH)
        .y1((d) => yEq(d.equityUsd))
        .curve(d3.curveMonotoneX);

      g.append('path')
        .datum(pts)
        .attr('fill', 'rgba(251, 191, 36, 0.14)')
        .attr('d', eqArea);

      const eqLine = d3
        .line<EquityDrawdownPoint>()
        .x((d) => xScale(d.stepIndex))
        .y((d) => yEq(d.equityUsd))
        .curve(d3.curveMonotoneX);

      g.append('path')
        .datum(pts)
        .attr('fill', 'none')
        .attr('stroke', '#fbbf24')
        .attr('stroke-width', 2.4)
        .attr('d', eqLine);

      // Underwater Drawdown Area (crimson)
      const ddArea = d3
        .area<EquityDrawdownPoint>()
        .x((d) => xScale(d.stepIndex))
        .y0(yDd(0))
        .y1((d) => yDd(-d.drawdownPct))
        .curve(d3.curveMonotoneX);

      g.append('path')
        .datum(pts)
        .attr('fill', 'rgba(244, 63, 94, 0.28)')
        .attr('d', ddArea);

      const ddLine = d3
        .line<EquityDrawdownPoint>()
        .x((d) => xScale(d.stepIndex))
        .y((d) => yDd(-d.drawdownPct))
        .curve(d3.curveMonotoneX);

      g.append('path')
        .datum(pts)
        .attr('fill', 'none')
        .attr('stroke', '#f43f5e')
        .attr('stroke-width', 1.8)
        .attr('d', ddLine);

      // Step nodes on equity curve
      g.selectAll('.risk-eq-node')
        .data(pts.slice(1))
        .enter()
        .append('circle')
        .attr('cx', (d) => xScale(d.stepIndex))
        .attr('cy', (d) => yEq(d.equityUsd))
        .attr('r', 3.8)
        .attr('fill', (d) =>
          d.status === 'OPEN_MTM'
            ? '#38bdf8'
            : d.tradePnlUsd >= 0
            ? '#34d399'
            : '#fb7185'
        )
        .attr('stroke', '#0f172a')
        .attr('stroke-width', 1.2);

      // Y axes
      const yEqAxis = d3
        .axisLeft(yEq)
        .ticks(4)
        .tickFormat((v) => `$${Math.round(Number(v) / 1000)}k`);

      const yEqG = g.append('g').call(yEqAxis);
      yEqG
        .selectAll('text')
        .attr('fill', '#cbd5e1')
        .attr('font-size', '10px')
        .attr('font-family', 'ui-monospace, SFMono-Regular, monospace');
      yEqG.selectAll('path,line').attr('stroke', '#334155');

      const yDdAxis = d3
        .axisLeft(yDd)
        .ticks(3)
        .tickFormat((v) => `${Number(v).toFixed(1)}%`);

      const yDdG = g.append('g').call(yDdAxis);
      yDdG
        .selectAll('text')
        .attr('fill', '#fda4af')
        .attr('font-size', '10px')
        .attr('font-family', 'ui-monospace, SFMono-Regular, monospace');
      yDdG.selectAll('path,line').attr('stroke', '#334155');

      const xTickVals = Array.from(
        new Set([0, Math.floor((pts.length - 1) * 0.33), Math.floor((pts.length - 1) * 0.66), pts.length - 1])
      );
      const xAxis = d3
        .axisBottom(xScale)
        .tickValues(xTickVals)
        .tickFormat((idx) => pts[Number(idx)]?.dateLabel || `#${idx}`);

      const xAxisG = g.append('g').attr('transform', `translate(0,${innerH})`).call(xAxis);
      xAxisG
        .selectAll('text')
        .attr('fill', '#94a3b8')
        .attr('font-size', '10px')
        .attr('font-family', 'ui-monospace, SFMono-Regular, monospace');
      xAxisG.selectAll('path,line').attr('stroke', '#334155');

      // Section labels on chart
      g.append('text')
        .attr('x', 6)
        .attr('y', 12)
        .attr('fill', '#fcd34d')
        .attr('font-size', '10px')
        .attr('font-family', 'ui-monospace, SFMono-Regular, monospace')
        .text('EQUITY & HIGH-WATER MARK');

      g.append('text')
        .attr('x', 6)
        .attr('y', ddTop + 12)
        .attr('fill', '#fda4af')
        .attr('font-size', '10px')
        .attr('font-family', 'ui-monospace, SFMono-Regular, monospace')
        .text('UNDERWATER DRAWDOWN (%)');

      // Interactive hover guide
      const hoverLine = g
        .append('line')
        .attr('y1', 0)
        .attr('y2', innerH)
        .attr('stroke', '#94a3b8')
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
          const pt = pts[idx];
          if (pt) {
            hoverLine.attr('x1', xScale(pt.stepIndex)).attr('x2', xScale(pt.stepIndex)).style('opacity', 0.85);
            setHoveredStep(pt);
          }
        })
        .on('mouseleave', () => {
          hoverLine.style('opacity', 0);
          setHoveredStep(null);
        });
    } else {
      // TRADE RETURNS (%) BAR VIEW vs RISK-FREE HURDLE
      const tradePts = pts.slice(1);
      const xBand = d3
        .scaleBand<string>()
        .domain(tradePts.map((t) => `${t.stepIndex}:${t.positionId}`))
        .range([0, innerW])
        .padding(0.24);

      const retVals = [0, ...tradePts.map((t) => t.tradeReturnPct)];
      const rMin = Math.min(...retVals);
      const rMax = Math.max(...retVals);
      const rPad = Math.max(0.8, (rMax - rMin) * 0.16);
      const yScale = d3
        .scaleLinear()
        .domain([rMin - rPad, rMax + rPad])
        .range([innerH, 0]);

      g.selectAll('.ret-grid')
        .data(yScale.ticks(5))
        .enter()
        .append('line')
        .attr('x1', 0)
        .attr('x2', innerW)
        .attr('y1', (d) => yScale(d))
        .attr('y2', (d) => yScale(d))
        .attr('stroke', (d) => (d === 0 ? '#475569' : '#1e293b'))
        .attr('stroke-width', (d) => (d === 0 ? 1.4 : 1));

      g.selectAll('.ret-bar')
        .data(tradePts)
        .enter()
        .append('rect')
        .attr('x', (d) => xBand(`${d.stepIndex}:${d.positionId}`) ?? 0)
        .attr('y', (d) => (d.tradeReturnPct >= 0 ? yScale(d.tradeReturnPct) : yScale(0)))
        .attr('width', xBand.bandwidth())
        .attr('height', (d) => Math.max(2, Math.abs(yScale(d.tradeReturnPct) - yScale(0))))
        .attr('rx', 3)
        .attr('fill', (d) =>
          d.status === 'OPEN_MTM'
            ? '#38bdf8'
            : d.tradeReturnPct >= 0
            ? '#10b981'
            : '#f43f5e'
        )
        .attr('fill-opacity', 0.85)
        .style('cursor', 'pointer')
        .on('mouseenter', (_e, d) => setHoveredStep(d))
        .on('mouseleave', () => setHoveredStep(null));

      const xAxis = d3
        .axisBottom(xBand)
        .tickFormat((val) => val.split(':')[1] || val);
      const yAxis = d3
        .axisLeft(yScale)
        .ticks(5)
        .tickFormat((v) => `${Number(v) >= 0 ? '+' : ''}${Number(v).toFixed(1)}%`);

      const xAxisG = g.append('g').attr('transform', `translate(0,${innerH})`).call(xAxis);
      xAxisG
        .selectAll('text')
        .attr('fill', '#94a3b8')
        .attr('font-size', '9.5px')
        .attr('font-family', 'ui-monospace, SFMono-Regular, monospace');
      xAxisG.selectAll('path,line').attr('stroke', '#334155');

      const yAxisG = g.append('g').call(yAxis);
      yAxisG
        .selectAll('text')
        .attr('fill', '#cbd5e1')
        .attr('font-size', '10px')
        .attr('font-family', 'ui-monospace, SFMono-Regular, monospace');
      yAxisG.selectAll('path,line').attr('stroke', '#334155');
    }
  }, [containerWidth, metrics, chartMode]);

  return (
    <section
      aria-label="Risk Metrics Dashboard"
      className="bg-slate-900 border border-slate-800 rounded-lg p-5 space-y-4"
    >
      {/* Header & Interactive Scope / Hurdle Controls */}
      <div className="flex flex-wrap items-center justify-between gap-4 pb-3 border-b border-slate-800">
        <div>
          <h3 className="text-base font-bold text-slate-100 flex items-center gap-2">
            <Activity className="w-4 h-4 text-amber-400 shrink-0" aria-hidden="true" />
            <span>Account Risk Metrics Dashboard</span>
          </h3>
          <div className="flex flex-wrap items-center gap-2 text-xs text-slate-400 mt-1">
            <span>
              {scopeMode === 'FILTERED_CYCLE' && isRangeFiltered
                ? `Filtered Cycle (${activeRangeLabel})`
                : 'Full Paper Account History'}
            </span>
            <span aria-hidden="true">·</span>
            <span className="font-mono tabular-nums">
              {metrics.tradesAnalyzedCount} trades ({metrics.closedTradesCount} closed / {metrics.openTradesCount} live MTM)
            </span>
            <span aria-hidden="true">·</span>
            <span className="font-mono tabular-nums">
              Equity: ${metrics.currentEquityUsd.toLocaleString()}
            </span>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Account Scope Toggle */}
          {isRangeFiltered && (
            <div
              role="group"
              aria-label="Risk metrics scope"
              className="flex items-center gap-1 p-1 bg-slate-950 border border-slate-800 rounded-lg"
            >
              <button
                type="button"
                onClick={() => setScopeMode('FULL_ACCOUNT')}
                aria-pressed={scopeMode === 'FULL_ACCOUNT'}
                className={`px-2.5 py-1 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                  scopeMode === 'FULL_ACCOUNT'
                    ? 'bg-slate-800 text-slate-100 border border-slate-700 font-semibold'
                    : 'text-slate-400 hover:text-slate-200 border border-transparent'
                }`}
              >
                Full Account
              </button>
              <button
                type="button"
                onClick={() => setScopeMode('FILTERED_CYCLE')}
                aria-pressed={scopeMode === 'FILTERED_CYCLE'}
                className={`px-2.5 py-1 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                  scopeMode === 'FILTERED_CYCLE'
                    ? 'bg-slate-800 text-slate-100 border border-slate-700 font-semibold'
                    : 'text-slate-400 hover:text-slate-200 border border-transparent'
                }`}
              >
                Filtered Cycle
              </button>
            </div>
          )}

          {/* Risk-Free Hurdle Selector */}
          <div
            role="group"
            aria-label="Risk-free benchmark rate"
            className="flex items-center gap-1 p-1 bg-slate-950 border border-slate-800 rounded-lg"
          >
            <button
              type="button"
              onClick={() => setRiskFreeRatePct(4.25)}
              aria-pressed={riskFreeRatePct === 4.25}
              className={`px-2.5 py-1 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                riskFreeRatePct === 4.25
                  ? 'bg-slate-800 text-slate-100 border border-slate-700 font-semibold'
                  : 'text-slate-400 hover:text-slate-200 border border-transparent'
              }`}
            >
              Rf 4.25% (3M T-Bill)
            </button>
            <button
              type="button"
              onClick={() => setRiskFreeRatePct(0)}
              aria-pressed={riskFreeRatePct === 0}
              className={`px-2.5 py-1 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                riskFreeRatePct === 0
                  ? 'bg-slate-800 text-slate-100 border border-slate-700 font-semibold'
                  : 'text-slate-400 hover:text-slate-200 border border-transparent'
              }`}
            >
              Rf 0.0%
            </button>
          </div>

          {/* Chart View Switcher */}
          <div
            role="group"
            aria-label="Risk chart display mode"
            className="flex items-center gap-1 p-1 bg-slate-950 border border-slate-800 rounded-lg"
          >
            <button
              type="button"
              onClick={() => setChartMode('UNDERWATER_EQUITY')}
              aria-pressed={chartMode === 'UNDERWATER_EQUITY'}
              className={`px-3 py-1 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                chartMode === 'UNDERWATER_EQUITY'
                  ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40 font-semibold'
                  : 'text-slate-400 hover:text-slate-200 border border-transparent'
              }`}
            >
              Equity &amp; Drawdown
            </button>
            <button
              type="button"
              onClick={() => setChartMode('TRADE_RETURNS')}
              aria-pressed={chartMode === 'TRADE_RETURNS'}
              className={`px-3 py-1 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                chartMode === 'TRADE_RETURNS'
                  ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40 font-semibold'
                  : 'text-slate-400 hover:text-slate-200 border border-transparent'
              }`}
            >
              Trade Returns (%)
            </button>
          </div>
        </div>
      </div>

      {/* 4 Primary Risk KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 text-xs font-mono tabular-nums">
        <div className="bg-slate-950/70 border border-slate-800 rounded p-3">
          <span className="block text-[10px] text-slate-500 uppercase">Current Drawdown</span>
          <span
            className={`block text-lg font-bold mt-0.5 ${
              metrics.isAtPeakEquity
                ? 'text-emerald-400'
                : metrics.currentDrawdownPct >= 5
                ? 'text-rose-400'
                : 'text-amber-300'
            }`}
          >
            {metrics.isAtPeakEquity ? '0.00%' : `-${metrics.currentDrawdownPct.toFixed(2)}%`}
          </span>
          <span className="block text-[10px] text-slate-400 mt-0.5">
            {metrics.isAtPeakEquity
              ? `At $${metrics.peakEquityUsd.toLocaleString()} peak equity`
              : `-$${metrics.currentDrawdownUsd.toLocaleString()} (${metrics.recoveryNeededPct}% to peak)`}
          </span>
        </div>

        <div className="bg-slate-950/70 border border-slate-800 rounded p-3">
          <span className="block text-[10px] text-slate-500 uppercase">Maximum Drawdown</span>
          <span
            className={`block text-lg font-bold mt-0.5 ${
              metrics.maxDrawdownPct >= 8
                ? 'text-rose-400'
                : metrics.maxDrawdownPct > 0
                ? 'text-amber-300'
                : 'text-emerald-400'
            }`}
          >
            {metrics.maxDrawdownPct > 0 ? `-${metrics.maxDrawdownPct.toFixed(2)}%` : '0.00%'}
          </span>
          <span className="block text-[10px] text-slate-400 mt-0.5">
            Peak-to-Trough: -${metrics.maxDrawdownUsd.toLocaleString()}
            {metrics.maxDrawdownPositionId ? ` (${metrics.maxDrawdownPositionId})` : ''}
          </span>
        </div>

        <div className="bg-slate-950/70 border border-slate-800 rounded p-3">
          <span className="block text-[10px] text-slate-500 uppercase">Sharpe Ratio (Ann.)</span>
          <span
            className={`block text-lg font-bold mt-0.5 ${
              metrics.sharpeRatio >= 1.5
                ? 'text-emerald-400'
                : metrics.sharpeRatio >= 0.75
                ? 'text-amber-300'
                : 'text-rose-400'
            }`}
          >
            {metrics.sharpeRatio.toFixed(2)}
          </span>
          <span className="block text-[10px] text-slate-400 mt-0.5">
            Ann. Vol (σ): {metrics.annualizedVolatilityPct.toFixed(2)}% · Return{' '}
            {metrics.netReturnPct >= 0 ? '+' : ''}
            {metrics.netReturnPct.toFixed(2)}%
          </span>
        </div>

        <div className="bg-slate-950/70 border border-slate-800 rounded p-3">
          <span className="block text-[10px] text-slate-500 uppercase">Sortino Ratio (Ann.)</span>
          <span
            className={`block text-lg font-bold mt-0.5 ${
              metrics.sortinoRatio >= 2.0
                ? 'text-emerald-400'
                : metrics.sortinoRatio >= 1.0
                ? 'text-amber-300'
                : 'text-rose-400'
            }`}
          >
            {metrics.hasZeroDownsideTrades && metrics.sortinoRatio >= 9.99
              ? '>9.99'
              : metrics.sortinoRatio.toFixed(2)}
          </span>
          <span className="block text-[10px] text-slate-400 mt-0.5">
            Downside σ⁻: {metrics.annualizedDownsideDevPct.toFixed(2)}% · Calmar {metrics.calmarRatio.toFixed(2)}
          </span>
        </div>
      </div>

      {/* D3 Chart Canvas & Hover Readout */}
      <div
        ref={containerRef}
        className="w-full bg-slate-950/80 border border-slate-800 rounded-lg p-3 space-y-2"
      >
        <svg
          ref={svgRef}
          className="w-full h-auto block select-none"
          role="img"
          aria-label="D3 chart displaying paper trading account equity high-water mark and underwater drawdown curve"
        />

        {activePoint && (
          <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-slate-800/80 text-[11px] font-mono tabular-nums text-slate-300">
            <div className="flex flex-wrap items-center gap-4">
              <span className="text-slate-400">
                Step #{activePoint.stepIndex}: <strong className="text-slate-100">{activePoint.positionId}</strong> ({activePoint.dateLabel})
              </span>
              <span className="text-amber-300">
                Equity: <strong>${activePoint.equityUsd.toLocaleString()}</strong>
              </span>
              <span className="text-slate-400">
                High-Water Mark: <strong className="text-slate-200">${activePoint.peakEquityUsd.toLocaleString()}</strong>
              </span>
              <span className={activePoint.drawdownPct > 0 ? 'text-rose-400' : 'text-emerald-400'}>
                Drawdown: <strong>{activePoint.drawdownPct > 0 ? `-${activePoint.drawdownPct.toFixed(2)}%` : '0.00%'}</strong>
              </span>
            </div>
            <span className="text-slate-400">
              {metrics.riskProfileBand.replace(/_/g, ' ')}
            </span>
          </div>
        )}
      </div>

      {/* Analytical Risk Summary Note */}
      <div className="flex items-start gap-2.5 text-xs text-slate-300 pt-1">
        {metrics.riskProfileBand === 'INSTITUTIONAL_GRADE' ? (
          <TrendingUp className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" aria-hidden="true" />
        ) : metrics.riskProfileBand === 'ELEVATED_DRAWDOWN' ? (
          <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" aria-hidden="true" />
        ) : (
          <ShieldCheck className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" aria-hidden="true" />
        )}
        <span>{metrics.summaryNote}</span>
      </div>
    </section>
  );
};
