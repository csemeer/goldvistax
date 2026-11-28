/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * Aurum Intelligence — Trade Expectancy Monte Carlo Projection Widget
 *
 * Performs a deterministic / reseedable circular block-bootstrap Monte Carlo
 * simulation over historical closed trades in the Portfolio Journal to forecast
 * forward equity confidence cones (P10-P90) and tail drawdown risk distributions.
 */

import React, { useEffect, useMemo, useRef, useState } from 'react';
import * as d3 from 'd3';
import { PaperPosition } from '../domain/types';
import {
  MonteCarloFanPoint,
  runTradeExpectancyMonteCarloProjection,
} from '../services/portfolioScannerEngine';
import { Activity, RefreshCw, TrendingUp } from 'lucide-react';

interface TradeExpectancyProjectionWidgetProps {
  positions: PaperPosition[];
  startingCapital?: number;
}

type ProjectionViewMode = 'FAN_CHART' | 'DRAWDOWN_RISK';

export const TradeExpectancyProjectionWidget: React.FC<TradeExpectancyProjectionWidgetProps> = ({
  positions,
  startingCapital = 100000,
}) => {
  const [horizonTrades, setHorizonTrades] = useState<number>(40);
  const [iterations, setIterations] = useState<number>(500);
  const [riskScalePct, setRiskScalePct] = useState<number>(100);
  const [seed, setSeed] = useState<number>(20261117);
  const [viewMode, setViewMode] = useState<ProjectionViewMode>('FAN_CHART');

  const svgRef = useRef<SVGSVGElement | null>(null);

  const summary = useMemo(
    () =>
      runTradeExpectancyMonteCarloProjection(positions, {
        horizonTrades,
        iterations,
        startingCapitalUsd: startingCapital,
        riskScalePct,
        seed,
      }),
    [horizonTrades, iterations, positions, riskScalePct, seed, startingCapital]
  );

  // Render D3 Monte Carlo Equity Fan Chart OR Tail Drawdown Distribution
  useEffect(() => {
    const svgEl = svgRef.current;
    if (!svgEl || !summary.hasSufficientData) return;

    const svg = d3.select(svgEl);
    svg.selectAll('*').remove();

    const width = 760;
    const height = 278;
    const margin = { top: 20, right: 24, bottom: 32, left: 68 };
    const innerW = width - margin.left - margin.right;
    const innerH = height - margin.top - margin.bottom;

    svg.attr('viewBox', `0 0 ${width} ${height}`);
    const g = svg.append('g').attr('transform', `translate(${margin.left},${margin.top})`);

    if (viewMode === 'FAN_CHART') {
      const fan = summary.fanSeries;
      if (fan.length === 0) return;

      const xScale = d3.scaleLinear().domain([0, summary.horizonTrades]).range([0, innerW]);

      const allVals = [
        summary.startingCapitalUsd,
        ...fan.map((d) => d.p10EquityUsd),
        ...fan.map((d) => d.p90EquityUsd),
      ];
      const yMin = Math.min(...allVals);
      const yMax = Math.max(...allVals);
      const yPad = Math.max(2500, (yMax - yMin) * 0.1);
      const yScale = d3
        .scaleLinear()
        .domain([Math.max(0, yMin - yPad), yMax + yPad])
        .range([innerH, 0]);

      // Horizontal grid lines
      g.selectAll('.mc-grid-y')
        .data(yScale.ticks(5))
        .enter()
        .append('line')
        .attr('x1', 0)
        .attr('x2', innerW)
        .attr('y1', (d) => yScale(d))
        .attr('y2', (d) => yScale(d))
        .attr('stroke', '#1e293b')
        .attr('stroke-width', 1);

      // P10-P90 outer confidence band
      const outerArea = d3
        .area<MonteCarloFanPoint>()
        .x((d) => xScale(d.step))
        .y0((d) => yScale(d.p10EquityUsd))
        .y1((d) => yScale(d.p90EquityUsd))
        .curve(d3.curveMonotoneX);

      g.append('path')
        .datum(fan)
        .attr('fill', 'rgba(16, 185, 129, 0.12)')
        .attr('stroke', 'none')
        .attr('d', outerArea);

      // P25-P75 interquartile band
      const innerArea = d3
        .area<MonteCarloFanPoint>()
        .x((d) => xScale(d.step))
        .y0((d) => yScale(d.p25EquityUsd))
        .y1((d) => yScale(d.p75EquityUsd))
        .curve(d3.curveMonotoneX);

      g.append('path')
        .datum(fan)
        .attr('fill', 'rgba(16, 185, 129, 0.22)')
        .attr('stroke', 'none')
        .attr('d', innerArea);

      // Stochastic sample equity trajectories
      const pathLine = d3
        .line<number>()
        .x((_, idx) => xScale(idx))
        .y((val) => yScale(val))
        .curve(d3.curveLinear);

      summary.samplePaths.forEach((sp) => {
        g.append('path')
          .datum(sp.equityPoints)
          .attr('fill', 'none')
          .attr('stroke', sp.terminalReturnPct >= 0 ? 'rgba(56, 189, 248, 0.22)' : 'rgba(244, 63, 94, 0.25)')
          .attr('stroke-width', 1)
          .attr('d', pathLine);
      });

      // Baseline starting capital horizontal dashed line
      g.append('line')
        .attr('x1', 0)
        .attr('x2', innerW)
        .attr('y1', yScale(summary.startingCapitalUsd))
        .attr('y2', yScale(summary.startingCapitalUsd))
        .attr('stroke', '#64748b')
        .attr('stroke-width', 1.2)
        .attr('stroke-dasharray', '4,3');

      // P10 stress lower curve
      const p10Line = d3
        .line<MonteCarloFanPoint>()
        .x((d) => xScale(d.step))
        .y((d) => yScale(d.p10EquityUsd))
        .curve(d3.curveMonotoneX);
      g.append('path')
        .datum(fan)
        .attr('fill', 'none')
        .attr('stroke', '#f43f5e')
        .attr('stroke-width', 1.5)
        .attr('stroke-dasharray', '3,3')
        .attr('d', p10Line);

      // P90 optimistic upper curve
      const p90Line = d3
        .line<MonteCarloFanPoint>()
        .x((d) => xScale(d.step))
        .y((d) => yScale(d.p90EquityUsd))
        .curve(d3.curveMonotoneX);
      g.append('path')
        .datum(fan)
        .attr('fill', 'none')
        .attr('stroke', '#34d399')
        .attr('stroke-width', 1.5)
        .attr('stroke-dasharray', '3,3')
        .attr('d', p90Line);

      // P50 median forecast curve
      const p50Line = d3
        .line<MonteCarloFanPoint>()
        .x((d) => xScale(d.step))
        .y((d) => yScale(d.p50EquityUsd))
        .curve(d3.curveMonotoneX);
      g.append('path')
        .datum(fan)
        .attr('fill', 'none')
        .attr('stroke', '#fbbf24')
        .attr('stroke-width', 2.6)
        .attr('d', p50Line);

      // Axes
      const xAxis = d3
        .axisBottom(xScale)
        .ticks(6)
        .tickFormat((v) => `+${Number(v)}T`);
      const yAxis = d3
        .axisLeft(yScale)
        .ticks(5)
        .tickFormat((v) => `$${Math.round(Number(v) / 1000)}k`);

      const xAxisG = g.append('g').attr('transform', `translate(0,${innerH})`).call(xAxis);
      xAxisG.selectAll('text').attr('fill', '#94a3b8').attr('font-size', '10px').attr('font-family', 'ui-monospace, SFMono-Regular, monospace');
      xAxisG.selectAll('path,line').attr('stroke', '#334155');

      const yAxisG = g.append('g').call(yAxis);
      yAxisG.selectAll('text').attr('fill', '#cbd5e1').attr('font-size', '10px').attr('font-family', 'ui-monospace, SFMono-Regular, monospace');
      yAxisG.selectAll('path,line').attr('stroke', '#334155');
    } else {
      // DRAWDOWN_RISK mode: Distribution of Simulated Max Drawdown + Tail Percentile Markers
      const buckets = summary.drawdownHistogram;
      const xBand = d3
        .scaleBand<string>()
        .domain(buckets.map((b) => b.label))
        .range([0, innerW])
        .padding(0.28);

      const maxShare = Math.max(15, ...buckets.map((b) => b.sharePct));
      const yScale = d3.scaleLinear().domain([0, maxShare * 1.15]).range([innerH, 0]);

      g.selectAll('.dd-grid-y')
        .data(yScale.ticks(5))
        .enter()
        .append('line')
        .attr('x1', 0)
        .attr('x2', innerW)
        .attr('y1', (d) => yScale(d))
        .attr('y2', (d) => yScale(d))
        .attr('stroke', '#1e293b')
        .attr('stroke-width', 1);

      g.selectAll('.dd-bar')
        .data(buckets)
        .enter()
        .append('rect')
        .attr('x', (d) => xBand(d.label) ?? 0)
        .attr('y', (d) => yScale(d.sharePct))
        .attr('width', xBand.bandwidth())
        .attr('height', (d) => Math.max(2, innerH - yScale(d.sharePct)))
        .attr('rx', 3)
        .attr('fill', (d) => (d.isSevere ? '#f43f5e' : '#10b981'))
        .attr('fill-opacity', 0.82);

      g.selectAll('.dd-label')
        .data(buckets)
        .enter()
        .append('text')
        .attr('x', (d) => (xBand(d.label) ?? 0) + xBand.bandwidth() / 2)
        .attr('y', (d) => yScale(d.sharePct) - 6)
        .attr('text-anchor', 'middle')
        .attr('fill', '#e2e8f0')
        .attr('font-size', '10px')
        .attr('font-weight', '700')
        .attr('font-family', 'ui-monospace, SFMono-Regular, monospace')
        .text((d) => `${d.sharePct.toFixed(1)}% (${d.count})`);

      const xAxisG = g.append('g').attr('transform', `translate(0,${innerH})`).call(d3.axisBottom(xBand));
      xAxisG.selectAll('text').attr('fill', '#cbd5e1').attr('font-size', '10px').attr('font-family', 'ui-monospace, SFMono-Regular, monospace');
      xAxisG.selectAll('path,line').attr('stroke', '#334155');

      const yAxisG = g
        .append('g')
        .call(
          d3
            .axisLeft(yScale)
            .ticks(5)
            .tickFormat((d) => `${Number(d)}%`)
        );
      yAxisG.selectAll('text').attr('fill', '#94a3b8').attr('font-size', '10px').attr('font-family', 'ui-monospace, SFMono-Regular, monospace');
      yAxisG.selectAll('path,line').attr('stroke', '#334155');
    }
  }, [summary, viewMode]);

  return (
    <section
      aria-label="Trade Expectancy Projection Monte Carlo Widget"
      className="bg-slate-900 border border-slate-800 rounded-lg p-5 space-y-4"
    >
      {/* Header & Simulation Parameters */}
      <div className="flex flex-wrap items-center justify-between gap-4 pb-3 border-b border-slate-800">
        <div>
          <h3 className="text-base font-bold text-slate-100 flex items-center gap-2">
            <TrendingUp className="w-4 h-4 text-amber-400 shrink-0" aria-hidden="true" />
            <span>Trade Expectancy Projection · Monte Carlo Forecast</span>
          </h3>
          <div className="flex flex-wrap items-center gap-2 text-xs text-slate-400 mt-1">
            <span>
              Circular Block Bootstrap ({summary.closedTradesCount} historical trades)
            </span>
            <span aria-hidden="true">·</span>
            <span className="font-mono tabular-nums text-slate-300">
              {summary.iterationsCount.toLocaleString()} paths × +{summary.horizonTrades} trades
            </span>
            <span aria-hidden="true">·</span>
            <span className="font-mono tabular-nums">Seed #{summary.seedUsed}</span>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Horizon Selector */}
          <div
            role="group"
            aria-label="Projection trade horizon"
            className="flex items-center gap-1 p-1 bg-slate-950 border border-slate-800 rounded-lg"
          >
            {[20, 40, 60].map((h) => (
              <button
                key={h}
                type="button"
                onClick={() => setHorizonTrades(h)}
                aria-pressed={horizonTrades === h}
                className={`px-2.5 py-1.5 text-xs font-mono font-medium rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                  horizonTrades === h
                    ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40 font-semibold'
                    : 'text-slate-400 hover:text-slate-200 border border-transparent'
                }`}
              >
                +{h}T
              </button>
            ))}
          </div>

          {/* Iteration Selector */}
          <div
            role="group"
            aria-label="Monte Carlo path iterations"
            className="flex items-center gap-1 p-1 bg-slate-950 border border-slate-800 rounded-lg"
          >
            {[250, 500, 1000].map((it) => (
              <button
                key={it}
                type="button"
                onClick={() => setIterations(it)}
                aria-pressed={iterations === it}
                className={`px-2.5 py-1.5 text-xs font-mono font-medium rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                  iterations === it
                    ? 'bg-sky-500/20 text-sky-300 border border-sky-500/40 font-semibold'
                    : 'text-slate-400 hover:text-slate-200 border border-transparent'
                }`}
              >
                {it}x
              </button>
            ))}
          </div>

          {/* Sizing Multiplier */}
          <div
            role="group"
            aria-label="Position sizing risk multiplier"
            className="flex items-center gap-1 p-1 bg-slate-950 border border-slate-800 rounded-lg"
          >
            {[
              { pct: 50, label: '0.5x Size' },
              { pct: 100, label: '1.0x Size' },
              { pct: 150, label: '1.5x Size' },
            ].map((s) => (
              <button
                key={s.pct}
                type="button"
                onClick={() => setRiskScalePct(s.pct)}
                aria-pressed={riskScalePct === s.pct}
                className={`px-2.5 py-1.5 text-xs font-mono font-medium rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                  riskScalePct === s.pct
                    ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 font-semibold'
                    : 'text-slate-400 hover:text-slate-200 border border-transparent'
                }`}
              >
                {s.label}
              </button>
            ))}
          </div>

          {/* View Mode Toggle */}
          <div
            role="group"
            aria-label="Monte Carlo visualization mode"
            className="flex items-center gap-1 p-1 bg-slate-950 border border-slate-800 rounded-lg"
          >
            <button
              type="button"
              onClick={() => setViewMode('FAN_CHART')}
              aria-pressed={viewMode === 'FAN_CHART'}
              className={`px-2.5 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                viewMode === 'FAN_CHART'
                  ? 'bg-slate-800 text-slate-100 border border-slate-700 font-semibold'
                  : 'text-slate-400 hover:text-slate-200 border border-transparent'
              }`}
            >
              Equity Fan
            </button>
            <button
              type="button"
              onClick={() => setViewMode('DRAWDOWN_RISK')}
              aria-pressed={viewMode === 'DRAWDOWN_RISK'}
              className={`px-2.5 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                viewMode === 'DRAWDOWN_RISK'
                  ? 'bg-slate-800 text-slate-100 border border-slate-700 font-semibold'
                  : 'text-slate-400 hover:text-slate-200 border border-transparent'
              }`}
            >
              Drawdown Tail
            </button>
          </div>

          <button
            type="button"
            onClick={() => setSeed((prev) => prev + 7919)}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
          >
            <RefreshCw className="w-3.5 h-3.5" aria-hidden="true" />
            <span>Reseed Run</span>
          </button>
        </div>
      </div>

      {!summary.hasSufficientData ? (
        <div className="bg-slate-950/70 border border-slate-800 rounded-lg p-6 text-center space-y-2">
          <Activity className="w-6 h-6 text-amber-400 mx-auto" aria-hidden="true" />
          <p className="text-xs text-slate-300 font-medium">{summary.forecastSummary}</p>
        </div>
      ) : (
        <>
          {/* D3 Chart + Scenario Percentile Table */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-stretch">
            {/* Left: D3 Fan Chart / Drawdown Distribution */}
            <div className="lg:col-span-8 bg-slate-950/70 border border-slate-800 rounded-lg p-4 flex flex-col justify-between space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-slate-400">
                <span>
                  {viewMode === 'FAN_CHART'
                    ? 'Forward Equity Confidence Cone (P10–P90 Bands & Median Projection)'
                    : 'Simulated Maximum Drawdown Probability Distribution'}
                </span>
                {viewMode === 'FAN_CHART' && (
                  <div className="flex items-center gap-3 font-mono tabular-nums text-[11px]">
                    <span className="text-emerald-400">P90 Optimistic</span>
                    <span className="text-amber-400 font-semibold">P50 Median</span>
                    <span className="text-rose-400">P10 Stress</span>
                  </div>
                )}
              </div>

              <svg
                ref={svgRef}
                className="w-full h-auto block select-none"
                role="img"
                aria-label="Monte Carlo Trade Expectancy and Drawdown Forecast Chart"
              />
            </div>

            {/* Right: Forward Profitability & Drawdown Percentiles */}
            <div className="lg:col-span-4 bg-slate-950/70 border border-slate-800 rounded-lg p-4 flex flex-col justify-between space-y-3 text-xs font-mono tabular-nums">
              <div className="space-y-2">
                <div className="text-xs font-sans font-semibold text-slate-200 pb-2 border-b border-slate-800">
                  Projected Terminal Equity ({horizonTrades} Trades)
                </div>
                <div className="divide-y divide-slate-800/80">
                  {[
                    { label: 'P90 Bull Scenario', eq: summary.upsideP90EquityUsd, ret: summary.upsideP90ReturnPct, cls: 'text-emerald-400' },
                    { label: 'P75 Upper Quartile', eq: summary.upsideP75EquityUsd, ret: summary.upsideP75ReturnPct, cls: 'text-emerald-300' },
                    { label: 'P50 Median Path', eq: summary.medianProjectedEquityUsd, ret: summary.medianProjectedReturnPct, cls: 'text-amber-300 font-bold' },
                    { label: 'P25 Lower Quartile', eq: summary.conservativeP25EquityUsd, ret: summary.conservativeP25ReturnPct, cls: 'text-slate-300' },
                    { label: 'P10 Stress Scenario', eq: summary.downsideP10EquityUsd, ret: summary.downsideP10ReturnPct, cls: 'text-rose-400' },
                  ].map((row) => (
                    <div key={row.label} className="py-1.5 flex items-center justify-between gap-2">
                      <span className="text-slate-400">{row.label}</span>
                      <span className={row.cls}>
                        ${row.eq.toLocaleString()} ({row.ret >= 0 ? '+' : ''}
                        {row.ret}%)
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="pt-2 border-t border-slate-800 space-y-1.5">
                <div className="text-xs font-sans font-semibold text-slate-200">
                  Tail Drawdown Scenarios
                </div>
                <div className="grid grid-cols-2 gap-2 text-[11px]">
                  <div className="flex items-center justify-between text-slate-400">
                    <span>P50 Median DD</span>
                    <span className="text-slate-200 font-semibold">-{summary.medianMaxDrawdownPct.toFixed(2)}%</span>
                  </div>
                  <div className="flex items-center justify-between text-slate-400">
                    <span>P90 Adverse DD</span>
                    <span className="text-amber-300 font-semibold">-{summary.p90MaxDrawdownPct.toFixed(2)}%</span>
                  </div>
                  <div className="flex items-center justify-between text-slate-400">
                    <span>P95 Tail DD</span>
                    <span className="text-rose-400 font-semibold">-{summary.p95MaxDrawdownPct.toFixed(2)}%</span>
                  </div>
                  <div className="flex items-center justify-between text-slate-400">
                    <span>P99 Black Swan</span>
                    <span className="text-rose-500 font-bold">-{summary.p99MaxDrawdownPct.toFixed(2)}%</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* 4 Scenario KPI Summary Cards */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 text-xs font-mono tabular-nums">
            <div className="bg-slate-950/70 border border-slate-800 rounded p-3">
              <span className="block text-[10px] text-slate-500 uppercase">Median Projected P&amp;L</span>
              <span
                className={`block text-base font-bold mt-0.5 ${
                  summary.medianProjectedReturnUsd >= 0 ? 'text-emerald-400' : 'text-rose-400'
                }`}
              >
                {summary.medianProjectedReturnUsd >= 0 ? '+' : '-'}$
                {Math.abs(summary.medianProjectedReturnUsd).toLocaleString()}
              </span>
              <span className="block text-[10px] text-slate-400 mt-0.5">
                {summary.medianProjectedReturnPct >= 0 ? '+' : ''}
                {summary.medianProjectedReturnPct}% to ${summary.medianProjectedEquityUsd.toLocaleString()}
              </span>
            </div>

            <div className="bg-slate-950/70 border border-slate-800 rounded p-3">
              <span className="block text-[10px] text-slate-500 uppercase">Profit Probability</span>
              <span
                className={`block text-base font-bold mt-0.5 ${
                  summary.probabilityOfProfitPct >= 70
                    ? 'text-emerald-400'
                    : summary.probabilityOfProfitPct >= 50
                    ? 'text-amber-300'
                    : 'text-rose-400'
                }`}
              >
                {summary.probabilityOfProfitPct.toFixed(1)}%
              </span>
              <span className="block text-[10px] text-slate-400 mt-0.5">
                Historical Win {summary.historicalWinRatePct}% ({summary.historicalExpectancyR >= 0 ? '+' : ''}
                {summary.historicalExpectancyR}R/trade)
              </span>
            </div>

            <div className="bg-slate-950/70 border border-slate-800 rounded p-3">
              <span className="block text-[10px] text-slate-500 uppercase">95% Tail Drawdown</span>
              <span className="block text-base font-bold text-amber-300 mt-0.5">
                -{summary.p95MaxDrawdownPct.toFixed(2)}%
              </span>
              <span className="block text-[10px] text-slate-400 mt-0.5">
                Worst simulated path: -{summary.worstSimulatedDrawdownPct.toFixed(2)}%
              </span>
            </div>

            <div className="bg-slate-950/70 border border-slate-800 rounded p-3">
              <span className="block text-[10px] text-slate-500 uppercase">20% Drawdown Risk</span>
              <span
                className={`block text-base font-bold mt-0.5 ${
                  summary.probabilityOf20PctDrawdownPct <= 2 ? 'text-emerald-400' : 'text-rose-400'
                }`}
              >
                {summary.probabilityOf20PctDrawdownPct.toFixed(1)}%
              </span>
              <span className="block text-[10px] text-slate-400 mt-0.5">
                Outlook: {summary.riskOutlook.replace(/_/g, ' ')}
              </span>
            </div>
          </div>

          <p className="text-xs text-slate-300 leading-relaxed pt-2 border-t border-slate-800">
            {summary.forecastSummary}
          </p>
        </>
      )}
    </section>
  );
};
