/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * Aurum Intelligence — Council Workspace Institutional Sentiment Gauge (CFTC COT Gold)
 *
 * Visualizes COMEX Gold Futures (088691) Commitment of Traders net-positioning
 * sentiment via a D3.js semi-circular radial gauge, L/S speculative ratio split,
 * and 8-week net positioning trajectory to quantify institutional bias.
 */

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import * as d3 from 'd3';
import {
  calculateGoldCotInstitutionalSentiment,
  CotWeeklySnapshot,
  COTCommodityReport,
  InstitutionalSentimentScope,
} from '../services/cotIntelligence';
import { Compass, RefreshCw, AlertTriangle, TrendingUp } from 'lucide-react';

// NOTE: Clean pure types from cotIntelligence
type OverridePayload = {
  reportOverride?: Partial<COTCommodityReport> & { otherReportablesNet?: number };
  sourceMode?: 'CFTC_LIVE_API' | 'CFTC_CURATED_BASELINE';
  weeklyHistory?: CotWeeklySnapshot[];
};

export const InstitutionalSentimentGauge: React.FC = () => {
  const [scope, setScope] = useState<InstitutionalSentimentScope>('MANAGED_MONEY');
  const [liveOverride, setLiveOverride] = useState<OverridePayload | null>(null);
  const [isSyncing, setIsSyncing] = useState<boolean>(false);

  const gaugeSvgRef = useRef<SVGSVGElement | null>(null);
  const trendSvgRef = useRef<SVGSVGElement | null>(null);

  const summary = useMemo(
    () =>
      calculateGoldCotInstitutionalSentiment(liveOverride?.reportOverride, {
        scope,
        sourceMode: liveOverride?.sourceMode ?? 'CFTC_CURATED_BASELINE',
        weeklyHistory: liveOverride?.weeklyHistory,
      }),
    [liveOverride, scope]
  );

  const syncLiveCot = useCallback(async () => {
    setIsSyncing(true);
    try {
      const res = await fetch(`/api/macro/cot-gold?scope=${encodeURIComponent(scope)}`);
      if (!res.ok) return;
      const json = (await res.json()) as {
        success?: boolean;
        reportOverride?: Partial<COTCommodityReport> & { otherReportablesNet?: number };
        sourceMode?: 'CFTC_LIVE_API' | 'CFTC_CURATED_BASELINE';
        weeklyHistory?: CotWeeklySnapshot[];
      };
      if (json.success && json.reportOverride) {
        setLiveOverride({
          reportOverride: json.reportOverride,
          sourceMode: json.sourceMode,
          weeklyHistory: json.weeklyHistory,
        });
      }
    } catch {
      // Retain curated CFTC COMEX Gold baseline safely if offline
    } finally {
      setIsSyncing(false);
    }
  }, [scope]);

  useEffect(() => {
    void syncLiveCot();
  }, [syncLiveCot]);

  // Render Semi-Circular D3 Radial Sentiment Gauge (0..100 / -1.0..+1.0)
  useEffect(() => {
    const svgEl = gaugeSvgRef.current;
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

    // Zone arcs along 0..100 institutional sentiment scale
    const zones = [
      { from: 0, to: 18, color: 'rgba(244, 63, 94, 0.35)' }, // Extreme Bearish
      { from: 18, to: 38, color: 'rgba(251, 113, 133, 0.22)' }, // Bearish
      { from: 38, to: 62, color: 'rgba(100, 116, 139, 0.28)' }, // Neutral
      { from: 62, to: 85, color: 'rgba(16, 185, 129, 0.3)' }, // Bullish Accumulation
      { from: 85, to: 100, color: 'rgba(245, 158, 11, 0.35)' }, // Extreme Bullish Crowding
    ];

    zones.forEach((z) => {
      const arc = d3
        .arc<unknown>()
        .innerRadius(innerR)
        .outerRadius(outerR)
        .startAngle(startAngle + (z.from / 100) * Math.PI)
        .endAngle(startAngle + (z.to / 100) * Math.PI);

      g.append('path')
        .attr('d', arc({}) || '')
        .attr('fill', z.color)
        .attr('stroke', '#1e293b')
        .attr('stroke-width', 1);
    });

    // Active filled arc from 50 (Neutral center) toward current Sentiment Score
    const clampedScore = Math.max(0, Math.min(100, summary.sentimentScorePct));
    const neutralAngle = 0; // Center top (50)
    const activeAngle = startAngle + (clampedScore / 100) * Math.PI;
    const activeColor =
      summary.regime === 'EXTREME_BULLISH'
        ? '#f59e0b'
        : summary.regime === 'BULLISH_ACCUMULATION'
        ? '#10b981'
        : summary.regime === 'NEUTRAL_BALANCED'
        ? '#94a3b8'
        : '#f43f5e';

    const activeArc = d3
      .arc<unknown>()
      .innerRadius(innerR + 5)
      .outerRadius(outerR - 5)
      .startAngle(Math.min(neutralAngle, activeAngle))
      .endAngle(Math.max(neutralAngle, activeAngle))
      .cornerRadius(3);

    g.append('path').attr('d', activeArc({}) || '').attr('fill', activeColor);

    // Reference ticks: 0 (-1.0), 38, 50 (Neutral), 62, 85 (Crowd), 100 (+1.0)
    const ticks = [
      { score: 0, label: '-1.0' },
      { score: 25, label: '-0.5' },
      { score: 50, label: '0.0' },
      { score: 75, label: '+0.5' },
      { score: 85, label: '85%' },
      { score: 100, label: '+1.0' },
    ];
    ticks.forEach((t) => {
      const theta = startAngle + (t.score / 100) * Math.PI;
      const sinT = Math.sin(theta);
      const cosT = Math.cos(theta);

      g.append('line')
        .attr('x1', (innerR - 4) * sinT)
        .attr('y1', -(innerR - 4) * cosT)
        .attr('x2', (outerR + 5) * sinT)
        .attr('y2', -(outerR + 5) * cosT)
        .attr('stroke', t.score === 50 ? '#e2e8f0' : t.score === 85 ? '#fbbf24' : '#475569')
        .attr('stroke-width', t.score === 50 || t.score === 85 ? 1.5 : 1);

      g.append('text')
        .attr('x', (outerR + 18) * sinT)
        .attr('y', -(outerR + 18) * cosT + 3)
        .attr('text-anchor', 'middle')
        .attr('fill', t.score === 85 ? '#fbbf24' : '#94a3b8')
        .attr('font-size', '9.5px')
        .attr('font-family', 'ui-monospace, SFMono-Regular, monospace')
        .text(t.label);
    });

    // Precision needle pointer
    const nx = (outerR + 2) * Math.sin(activeAngle);
    const ny = -(outerR + 2) * Math.cos(activeAngle);
    g.append('line')
      .attr('x1', 0)
      .attr('y1', 0)
      .attr('x2', nx * 0.72)
      .attr('y2', ny * 0.72)
      .attr('stroke', '#f8fafc')
      .attr('stroke-width', 2.2)
      .attr('stroke-linecap', 'round');

    g.append('circle').attr('cx', 0).attr('cy', 0).attr('r', 4.5).attr('fill', '#f8fafc');

    // Center score & bias readout
    g.append('text')
      .attr('x', 0)
      .attr('y', -36)
      .attr('text-anchor', 'middle')
      .attr('fill', '#f8fafc')
      .attr('font-size', '26px')
      .attr('font-weight', '700')
      .attr('font-family', 'ui-monospace, SFMono-Regular, monospace')
      .text(`${summary.sentimentScorePct.toFixed(1)}`);

    g.append('text')
      .attr('x', 0)
      .attr('y', -18)
      .attr('text-anchor', 'middle')
      .attr('fill', activeColor)
      .attr('font-size', '10.5px')
      .attr('font-weight', '700')
      .attr('font-family', 'ui-monospace, SFMono-Regular, monospace')
      .text(
        `BIAS ${summary.normalizedBiasIndex >= 0 ? '+' : ''}${summary.normalizedBiasIndex.toFixed(2)}`
      );
  }, [summary]);

  // Render 8-Week Net Positioning Trajectory (D3 Bar + Line)
  useEffect(() => {
    const svgEl = trendSvgRef.current;
    if (!svgEl) return;

    const svg = d3.select(svgEl);
    svg.selectAll('*').remove();

    const width = 420;
    const height = 148;
    svg.attr('viewBox', `0 0 ${width} ${height}`);

    const margin = { top: 14, right: 16, bottom: 26, left: 52 };
    const innerW = width - margin.left - margin.right;
    const innerH = height - margin.top - margin.bottom;
    const g = svg.append('g').attr('transform', `translate(${margin.left},${margin.top})`);

    const pts = summary.weeklyTrend;
    if (pts.length === 0) return;

    const xBand = d3
      .scaleBand<string>()
      .domain(pts.map((p) => p.reportDate))
      .range([0, innerW])
      .padding(0.28);

    const nets = [0, ...pts.map((p) => p.managedMoneyNet)];
    const yMin = Math.min(...nets);
    const yMax = Math.max(...nets);
    const yPad = Math.max(15000, (yMax - yMin) * 0.16);
    const yScale = d3
      .scaleLinear()
      .domain([yMin < 0 ? yMin - yPad : 0, yMax + yPad])
      .range([innerH, 0]);

    g.selectAll('.cot-grid-y')
      .data(yScale.ticks(4))
      .enter()
      .append('line')
      .attr('x1', 0)
      .attr('x2', innerW)
      .attr('y1', (d) => yScale(d))
      .attr('y2', (d) => yScale(d))
      .attr('stroke', (d) => (d === 0 ? '#475569' : '#1e293b'))
      .attr('stroke-width', 1);

    g.selectAll('.cot-bar')
      .data(pts)
      .enter()
      .append('rect')
      .attr('x', (d) => xBand(d.reportDate) ?? 0)
      .attr('y', (d) => (d.managedMoneyNet >= 0 ? yScale(d.managedMoneyNet) : yScale(0)))
      .attr('width', xBand.bandwidth())
      .attr('height', (d) => Math.max(2, Math.abs(yScale(d.managedMoneyNet) - yScale(0))))
      .attr('rx', 2)
      .attr('fill', (d, idx) =>
        d.managedMoneyNet < 0
          ? '#f43f5e'
          : idx === pts.length - 1
          ? '#fbbf24'
          : 'rgba(16, 185, 129, 0.78)'
      );

    const xAxis = d3
      .axisBottom(xBand)
      .tickFormat((val) => val.slice(5));
    const yAxis = d3
      .axisLeft(yScale)
      .ticks(4)
      .tickFormat((v) => `${Math.round(Number(v) / 1000)}k`);

    const xAxisG = g.append('g').attr('transform', `translate(0,${innerH})`).call(xAxis);
    xAxisG
      .selectAll('text')
      .attr('fill', '#94a3b8')
      .attr('font-size', '9px')
      .attr('font-family', 'ui-monospace, SFMono-Regular, monospace');
    xAxisG.selectAll('path,line').attr('stroke', '#334155');

    const yAxisG = g.append('g').call(yAxis);
    yAxisG
      .selectAll('text')
      .attr('fill', '#cbd5e1')
      .attr('font-size', '9.5px')
      .attr('font-family', 'ui-monospace, SFMono-Regular, monospace');
    yAxisG.selectAll('path,line').attr('stroke', '#334155');
  }, [summary]);

  return (
    <section
      aria-label="Institutional Sentiment Gauge (CFTC COT Gold Futures)"
      className="bg-slate-900 border border-slate-800 rounded-lg p-5 space-y-4"
    >
      {/* Header & Controls */}
      <div className="flex flex-wrap items-center justify-between gap-4 pb-3 border-b border-slate-800">
        <div>
          <h3 className="text-base font-bold text-slate-100 flex items-center gap-2">
            <Compass className="w-4 h-4 text-amber-400 shrink-0" aria-hidden="true" />
            <span>Institutional Sentiment Gauge · CFTC COT Gold Futures</span>
          </h3>
          <div className="flex flex-wrap items-center gap-2 text-xs text-slate-400 mt-1">
            <span>{summary.symbol} · Contract {summary.contractCode}</span>
            <span aria-hidden="true">·</span>
            <span>Filing: {summary.reportDate}</span>
            <span aria-hidden="true">·</span>
            <span>
              {summary.sourceMode === 'CFTC_LIVE_API' ? 'Live CFTC Feed' : 'Curated CFTC Baseline'}
            </span>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Cohort Methodology Toggle */}
          <div
            role="group"
            aria-label="COT sentiment methodology"
            className="flex items-center gap-1 p-1 bg-slate-950 border border-slate-800 rounded-lg"
          >
            <button
              type="button"
              onClick={() => setScope('MANAGED_MONEY')}
              aria-pressed={scope === 'MANAGED_MONEY'}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                scope === 'MANAGED_MONEY'
                  ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40 font-semibold'
                  : 'text-slate-400 hover:text-slate-200 border border-transparent'
              }`}
            >
              Managed Money
            </button>
            <button
              type="button"
              onClick={() => setScope('COMPOSITE_SMART_MONEY')}
              aria-pressed={scope === 'COMPOSITE_SMART_MONEY'}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                scope === 'COMPOSITE_SMART_MONEY'
                  ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40 font-semibold'
                  : 'text-slate-400 hover:text-slate-200 border border-transparent'
              }`}
            >
              Composite Smart Money
            </button>
          </div>

          <button
            type="button"
            onClick={() => void syncLiveCot()}
            disabled={isSyncing}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 transition-colors whitespace-nowrap shrink-0 disabled:opacity-50 cursor-pointer"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isSyncing ? 'animate-spin' : ''}`} aria-hidden="true" />
            <span>{isSyncing ? 'Syncing CFTC...' : 'Sync CFTC'}</span>
          </button>
        </div>
      </div>

      {/* Gauge + Long/Short Exposure & 8-Week Net Trend */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-stretch">
        {/* Left: D3 Radial Institutional Sentiment Gauge */}
        <div className="lg:col-span-5 bg-slate-950/70 border border-slate-800 rounded-lg p-4 flex flex-col items-center justify-between">
          <svg
            ref={gaugeSvgRef}
            className="w-full max-w-[320px] h-auto block select-none"
            role="img"
            aria-label={`CFTC Gold COT institutional sentiment gauge showing ${summary.sentimentScorePct} out of 100 (${summary.regimeLabel})`}
          />

          <div className="w-full pt-2 border-t border-slate-800/80 flex items-center justify-between text-xs font-mono tabular-nums">
            <span className="text-slate-400">Regime Bias</span>
            <span
              className={`font-bold ${
                summary.regime === 'EXTREME_BULLISH'
                  ? 'text-amber-300'
                  : summary.regime === 'BULLISH_ACCUMULATION'
                  ? 'text-emerald-400'
                  : summary.regime === 'NEUTRAL_BALANCED'
                  ? 'text-slate-300'
                  : 'text-rose-400'
              }`}
            >
              {summary.regimeLabel}
            </span>
          </div>
        </div>

        {/* Right: Long/Short Split Bar + 8-Week Positioning History + 4 Positioning Metrics */}
        <div className="lg:col-span-7 flex flex-col justify-between space-y-4">
          {/* Speculative Long vs. Short Composition */}
          <div className="bg-slate-950/70 border border-slate-800 rounded-lg p-3.5 space-y-2">
            <div className="flex flex-wrap items-center justify-between gap-2 text-xs font-mono tabular-nums">
              <span className="text-slate-300 font-semibold">
                Speculative Positioning Split (Managed Money)
              </span>
              <span className="text-slate-400">
                <strong className="text-emerald-400">{summary.longSharePct}% Long</strong> /{' '}
                <strong className="text-rose-400">{summary.shortSharePct}% Short</strong>
              </span>
            </div>
            <div className="w-full h-2.5 bg-slate-800 rounded-sm overflow-hidden flex">
              <div
                className="bg-emerald-500 h-full"
                style={{ width: `${summary.longSharePct}%` }}
                title={`Managed Money Longs: ${summary.managedMoneyLongs.toLocaleString()}`}
              />
              <div
                className="bg-rose-500 h-full"
                style={{ width: `${summary.shortSharePct}%` }}
                title={`Managed Money Shorts: ${summary.managedMoneyShorts.toLocaleString()}`}
              />
            </div>
            <div className="flex items-center justify-between text-[11px] font-mono tabular-nums text-slate-400">
              <span>Longs: {summary.managedMoneyLongs.toLocaleString()} contracts</span>
              <span>Shorts: {summary.managedMoneyShorts.toLocaleString()} contracts</span>
            </div>
          </div>

          {/* 8-Week Trailing Managed Money Net Positioning Trend */}
          <div className="bg-slate-950/70 border border-slate-800 rounded-lg p-3.5 space-y-1.5">
            <div className="flex items-center justify-between text-xs font-mono tabular-nums">
              <span className="text-slate-300 font-semibold">
                8-Week COMEX Gold Net Positioning Trajectory
              </span>
              <span className={summary.netChange4W >= 0 ? 'text-emerald-400 font-bold' : 'text-rose-400 font-bold'}>
                4W Delta: {summary.netChange4W >= 0 ? '+' : ''}
                {summary.netChange4W.toLocaleString()}
              </span>
            </div>
            <svg
              ref={trendSvgRef}
              className="w-full h-auto block select-none"
              role="img"
              aria-label="8-week CFTC COMEX Gold Managed Money net positioning bar chart"
            />
          </div>
        </div>
      </div>

      {/* 4 Positioning Telemetry KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 text-xs font-mono tabular-nums">
        <div className="bg-slate-950/70 border border-slate-800 rounded p-3">
          <span className="block text-[10px] text-slate-500 uppercase">Managed Money Net</span>
          <span
            className={`block text-base font-bold mt-0.5 ${
              summary.managedMoneyNet >= 0 ? 'text-emerald-400' : 'text-rose-400'
            }`}
          >
            {summary.managedMoneyNet >= 0 ? '+' : ''}
            {summary.managedMoneyNet.toLocaleString()}
          </span>
          <span className="block text-[10px] text-slate-400 mt-0.5">
            1W WoW: {summary.netChange1W >= 0 ? '+' : ''}
            {summary.netChange1W.toLocaleString()} contracts
          </span>
        </div>

        <div className="bg-slate-950/70 border border-slate-800 rounded p-3">
          <span className="block text-[10px] text-slate-500 uppercase">Long / Short Ratio</span>
          <span className="block text-base font-bold text-slate-100 mt-0.5">
            {summary.longToShortRatio.toFixed(2)}x
          </span>
          <span className="block text-[10px] text-slate-400 mt-0.5">
            Net % of OI: {summary.managedMoneyNetPctOfOi >= 0 ? '+' : ''}
            {summary.managedMoneyNetPctOfOi}%
          </span>
        </div>

        <div className="bg-slate-950/70 border border-slate-800 rounded p-3">
          <span className="block text-[10px] text-slate-500 uppercase">52W Crowding %ile</span>
          <span
            className={`block text-base font-bold mt-0.5 ${
              summary.squeezeRiskFlag ? 'text-amber-400' : 'text-emerald-400'
            }`}
          >
            {summary.percentile52W}th %ile
          </span>
          <span className="block text-[10px] text-slate-400 mt-0.5">
            {summary.squeezeRiskFlag ? 'Crowded extreme alert (>85th)' : 'Room before extreme'}
          </span>
        </div>

        <div className="bg-slate-950/70 border border-slate-800 rounded p-3">
          <span className="block text-[10px] text-slate-500 uppercase">Commercials &amp; Total OI</span>
          <span className="block text-base font-bold text-sky-300 mt-0.5">
            {summary.commercialHedgersNet.toLocaleString()}
          </span>
          <span className="block text-[10px] text-slate-400 mt-0.5">
            OI: {summary.totalOpenInterest.toLocaleString()} ({summary.oiChange1W >= 0 ? '+' : ''}
            {summary.oiChange1W.toLocaleString()} 1W)
          </span>
        </div>
      </div>

      {/* Institutional Bias Summary */}
      <div className="flex items-start gap-2.5 pt-2 border-t border-slate-800 text-xs text-slate-300 leading-relaxed">
        {summary.squeezeRiskFlag ? (
          <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" aria-hidden="true" />
        ) : (
          <TrendingUp className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" aria-hidden="true" />
        )}
        <span>{summary.biasSummary}</span>
      </div>
    </section>
  );
};
