/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * Aurum Intelligence — Real-Time Trade Volume Profile Widget
 *
 * Displays volume-at-price levels with D3.js horizontal histogram rendering,
 * Volume Point of Control (VPOC), 70% Value Area High/Low, Buy/Sell Delta,
 * and institutional High-Volume Node (HVN) liquidity zone identification.
 */

import React, { useEffect, useMemo, useRef, useState } from 'react';
import * as d3 from 'd3';
import { Candle, InstrumentId, Quote, Timeframe } from '../domain/types';
import {
  calculateTradeVolumeProfile,
  TradeVolumeProfileBin,
} from '../services/indicators';
import { BarChart3, Layers, ArrowUpRight, ArrowDownRight } from 'lucide-react';

interface TradeVolumeProfileWidgetProps {
  candles: Candle[];
  quote: Quote;
  instrumentName: string;
  instrumentId: InstrumentId;
  timeframe: Timeframe;
}

type LookbackOption = 20 | 60 | 0;
type ProfileViewMode = 'LIQUIDITY_PROFILE' | 'VOLUME_DELTA';

function formatCompactVolume(val: number): string {
  if (val >= 1_000_000) return `${(val / 1_000_000).toFixed(2)}M`;
  if (val >= 1_000) return `${(val / 1_000).toFixed(1)}K`;
  return `${Math.round(val)}`;
}

export const TradeVolumeProfileWidget: React.FC<TradeVolumeProfileWidgetProps> = ({
  candles,
  quote,
  instrumentName,
  instrumentId,
  timeframe,
}) => {
  const [lookbackBars, setLookbackBars] = useState<LookbackOption>(60);
  const [viewMode, setViewMode] = useState<ProfileViewMode>('LIQUIDITY_PROFILE');
  const [hoveredBin, setHoveredBin] = useState<TradeVolumeProfileBin | null>(null);
  const [containerWidth, setContainerWidth] = useState<number>(820);

  const containerRef = useRef<HTMLDivElement | null>(null);
  const svgRef = useRef<SVGSVGElement | null>(null);

  const decimals = instrumentId.includes('10Y') ? 3 : 2;
  const formatPrice = (p: number) => `$${p.toFixed(decimals)}`;

  const profile = useMemo(
    () =>
      calculateTradeVolumeProfile(candles, quote, {
        binCount: 24,
        valueAreaPct: 70,
        lookbackBars: lookbackBars === 0 ? undefined : lookbackBars,
      }),
    [candles, quote, lookbackBars]
  );

  const activeBin = useMemo(() => {
    if (hoveredBin) return hoveredBin;
    return (
      profile.bins.find((b) => b.isCurrentPriceLevel) ??
      profile.bins.find((b) => b.isPoc) ??
      null
    );
  }, [hoveredBin, profile.bins]);

  useEffect(() => {
    const el = containerRef.current;
    if (!el || typeof ResizeObserver === 'undefined') return;
    const observer = new ResizeObserver((entries) => {
      const width = Math.max(360, Math.floor(entries[0]?.contentRect?.width || 820));
      setContainerWidth(width);
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
    const height = 360;
    svg.attr('viewBox', `0 0 ${width} ${height}`);

    if (!profile.hasData || profile.bins.length === 0) {
      svg
        .append('text')
        .attr('x', width / 2)
        .attr('y', height / 2)
        .attr('text-anchor', 'middle')
        .attr('fill', '#64748b')
        .attr('font-size', '12px')
        .attr('font-family', 'ui-monospace, SFMono-Regular, monospace')
        .text('Awaiting market candles to render Trade Volume Profile.');
      return;
    }

    const margin = { top: 18, right: 110, bottom: 34, left: 78 };
    const innerW = Math.max(180, width - margin.left - margin.right);
    const innerH = Math.max(160, height - margin.top - margin.bottom);

    const g = svg
      .append('g')
      .attr('transform', `translate(${margin.left},${margin.top})`);

    const yScale = d3
      .scaleLinear()
      .domain([profile.priceMin, profile.priceMax])
      .range([innerH, 0]);

    // Shaded 70% Value Area horizontal band
    const vahY = yScale(profile.vahPrice);
    const valY = yScale(profile.valPrice);
    g.append('rect')
      .attr('x', 0)
      .attr('y', Math.min(vahY, valY))
      .attr('width', innerW)
      .attr('height', Math.max(2, Math.abs(valY - vahY)))
      .attr('fill', 'rgba(56, 189, 248, 0.08)');

    if (viewMode === 'LIQUIDITY_PROFILE') {
      const maxVol = Math.max(1, ...profile.bins.map((b) => b.totalVolume));
      const xScale = d3.scaleLinear().domain([0, maxVol * 1.08]).range([0, innerW]);

      // Vertical grid lines
      g.selectAll('.vp-grid-x')
        .data(xScale.ticks(5))
        .enter()
        .append('line')
        .attr('x1', (d) => xScale(d))
        .attr('x2', (d) => xScale(d))
        .attr('y1', 0)
        .attr('y2', innerH)
        .attr('stroke', '#1e293b')
        .attr('stroke-width', 1);

      // Horizontal volume bars (Buy segment + Sell segment)
      const rowG = g
        .selectAll('.vp-row')
        .data(profile.bins)
        .enter()
        .append('g')
        .style('cursor', 'pointer')
        .on('mouseenter', (_e, d) => setHoveredBin(d))
        .on('mouseleave', () => setHoveredBin(null));

      rowG.each(function (bin) {
        const node = d3.select(this);
        const yTop = yScale(bin.priceHigh);
        const yBottom = yScale(bin.priceLow);
        const barHeight = Math.max(4, Math.abs(yBottom - yTop) - 2);
        const yPos = Math.min(yTop, yBottom) + 1;

        const buyW = xScale(bin.buyVolume);
        const sellW = Math.max(0, xScale(bin.totalVolume) - buyW);

        const buyFill = bin.isPoc
          ? '#f59e0b'
          : bin.liquidityNodeType === 'HVN'
          ? '#38bdf8'
          : bin.inValueArea
          ? '#10b981'
          : '#334155';

        const sellFill = bin.isPoc
          ? '#d97706'
          : bin.liquidityNodeType === 'HVN'
          ? '#0284c7'
          : bin.inValueArea
          ? '#e11d48'
          : '#475569';

        // Buy volume portion
        node
          .append('rect')
          .attr('x', 0)
          .attr('y', yPos)
          .attr('width', Math.max(1, buyW))
          .attr('height', barHeight)
          .attr('rx', 1.5)
          .attr('fill', buyFill)
          .attr('fill-opacity', bin.isCurrentPriceLevel ? 0.98 : bin.liquidityNodeType === 'LVN' ? 0.45 : 0.85);

        // Sell volume portion
        node
          .append('rect')
          .attr('x', buyW)
          .attr('y', yPos)
          .attr('width', sellW)
          .attr('height', barHeight)
          .attr('rx', 1.5)
          .attr('fill', sellFill)
          .attr('fill-opacity', bin.isCurrentPriceLevel ? 0.95 : bin.liquidityNodeType === 'LVN' ? 0.4 : 0.78);

        // Outline active spot price level or institutional HVN/POC
        if (bin.isCurrentPriceLevel || bin.isPoc || bin.liquidityNodeType === 'HVN') {
          node
            .append('rect')
            .attr('x', 0)
            .attr('y', yPos)
            .attr('width', Math.max(2, xScale(bin.totalVolume)))
            .attr('height', barHeight)
            .attr('rx', 1.5)
            .attr('fill', 'none')
            .attr(
              'stroke',
              bin.isCurrentPriceLevel ? '#f8fafc' : bin.isPoc ? '#fbbf24' : '#7dd3fc'
            )
            .attr('stroke-width', bin.isCurrentPriceLevel ? 1.5 : 1);
        }

        // Liquidity badge label on the right end of prominent bars
        if (bin.isPoc || bin.liquidityNodeType === 'HVN') {
          node
            .append('text')
            .attr('x', xScale(bin.totalVolume) + 6)
            .attr('y', yPos + barHeight / 2 + 3.5)
            .attr('fill', bin.isPoc ? '#fbbf24' : '#7dd3fc')
            .attr('font-size', '9.5px')
            .attr('font-weight', '700')
            .attr('font-family', 'ui-monospace, SFMono-Regular, monospace')
            .text(
              `${bin.isPoc ? 'VPOC' : 'HVN'} · ${formatCompactVolume(bin.totalVolume)}`
            );
        }
      });

      const xAxis = d3
        .axisBottom(xScale)
        .ticks(5)
        .tickFormat((v) => formatCompactVolume(Number(v)));
      const xAxisG = g.append('g').attr('transform', `translate(0,${innerH})`).call(xAxis);
      xAxisG
        .selectAll('text')
        .attr('fill', '#94a3b8')
        .attr('font-size', '10px')
        .attr('font-family', 'ui-monospace, SFMono-Regular, monospace');
      xAxisG.selectAll('path,line').attr('stroke', '#334155');
    } else {
      // BUY / SELL DELTA DIVERGING HISTOGRAM
      const maxAbsDelta = Math.max(
        1,
        ...profile.bins.map((b) => Math.abs(b.deltaVolume))
      );
      const xScale = d3
        .scaleLinear()
        .domain([-maxAbsDelta * 1.15, maxAbsDelta * 1.15])
        .range([0, innerW]);
      const zeroX = xScale(0);

      g.selectAll('.vp-delta-grid')
        .data(xScale.ticks(5))
        .enter()
        .append('line')
        .attr('x1', (d) => xScale(d))
        .attr('x2', (d) => xScale(d))
        .attr('y1', 0)
        .attr('y2', innerH)
        .attr('stroke', (d) => (d === 0 ? '#475569' : '#1e293b'))
        .attr('stroke-width', (d) => (d === 0 ? 1.4 : 1));

      g.selectAll('.vp-delta-bar')
        .data(profile.bins)
        .enter()
        .append('rect')
        .attr('x', (b) => (b.deltaVolume >= 0 ? zeroX : xScale(b.deltaVolume)))
        .attr('y', (b) => Math.min(yScale(b.priceHigh), yScale(b.priceLow)) + 1)
        .attr('width', (b) => Math.max(2, Math.abs(xScale(b.deltaVolume) - zeroX)))
        .attr('height', (b) => Math.max(4, Math.abs(yScale(b.priceLow) - yScale(b.priceHigh)) - 2))
        .attr('rx', 1.5)
        .attr('fill', (b) => (b.deltaVolume >= 0 ? '#10b981' : '#f43f5e'))
        .attr('fill-opacity', 0.85)
        .style('cursor', 'pointer')
        .on('mouseenter', (_e, d) => setHoveredBin(d))
        .on('mouseleave', () => setHoveredBin(null));

      const xAxis = d3
        .axisBottom(xScale)
        .ticks(5)
        .tickFormat((v) => {
          const num = Number(v);
          return `${num > 0 ? '+' : ''}${formatCompactVolume(num)}`;
        });
      const xAxisG = g.append('g').attr('transform', `translate(0,${innerH})`).call(xAxis);
      xAxisG
        .selectAll('text')
        .attr('fill', '#94a3b8')
        .attr('font-size', '10px')
        .attr('font-family', 'ui-monospace, SFMono-Regular, monospace');
      xAxisG.selectAll('path,line').attr('stroke', '#334155');
    }

    // VAH / VAL dashed reference lines
    const referenceLevels = [
      { price: profile.vahPrice, label: `VAH ${formatPrice(profile.vahPrice)}`, color: '#38bdf8', dash: '4,3' },
      { price: profile.valPrice, label: `VAL ${formatPrice(profile.valPrice)}`, color: '#38bdf8', dash: '4,3' },
      { price: profile.pocPrice, label: `VPOC ${formatPrice(profile.pocPrice)}`, color: '#f59e0b', dash: '0' },
      { price: profile.spotPrice, label: `SPOT ${formatPrice(profile.spotPrice)}`, color: '#f8fafc', dash: '2,2' },
    ];

    referenceLevels.forEach((lvl) => {
      const yPos = yScale(lvl.price);
      g.append('line')
        .attr('x1', 0)
        .attr('x2', innerW)
        .attr('y1', yPos)
        .attr('y2', yPos)
        .attr('stroke', lvl.color)
        .attr('stroke-width', lvl.label.startsWith('SPOT') || lvl.label.startsWith('VPOC') ? 1.5 : 1)
        .attr('stroke-dasharray', lvl.dash === '0' ? null : lvl.dash)
        .attr('stroke-opacity', 0.85);

      g.append('text')
        .attr('x', innerW + 8)
        .attr('y', yPos + 3.5)
        .attr('fill', lvl.color)
        .attr('font-size', '10px')
        .attr('font-weight', '700')
        .attr('font-family', 'ui-monospace, SFMono-Regular, monospace')
        .text(lvl.label);
    });

    // Left Price Y-Axis
    const yAxis = d3
      .axisLeft(yScale)
      .ticks(7)
      .tickFormat((v) => formatPrice(Number(v)));
    const yAxisG = g.append('g').call(yAxis);
    yAxisG
      .selectAll('text')
      .attr('fill', '#cbd5e1')
      .attr('font-size', '10px')
      .attr('font-family', 'ui-monospace, SFMono-Regular, monospace');
    yAxisG.selectAll('path,line').attr('stroke', '#334155');
  }, [containerWidth, profile, viewMode, decimals]);

  const spotBadgeText =
    profile.spotPosition === 'AT_POC'
      ? 'Spot At VPOC'
      : profile.spotPosition === 'ABOVE_VAH'
      ? 'Above Value Area'
      : profile.spotPosition === 'BELOW_VAL'
      ? 'Below Value Area'
      : 'Inside 70% Value Area';

  return (
    <section
      aria-label="Trade Volume Profile Widget"
      className="bg-slate-900 border border-slate-800 rounded-lg p-5 space-y-4"
    >
      {/* Header & Controls */}
      <div className="flex flex-wrap items-center justify-between gap-4 pb-3 border-b border-slate-800">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <BarChart3 className="w-4 h-4 text-amber-400 shrink-0" aria-hidden="true" />
            <h3 className="text-base font-bold text-slate-100">
              Trade Volume Profile · {instrumentName}
            </h3>
          </div>
          <div className="flex flex-wrap items-center gap-2 text-xs text-slate-400 mt-1">
            <span>{timeframe} Candles</span>
            <span aria-hidden="true">·</span>
            <span>{profile.barsAnalyzed} Bars Scanned</span>
            <span aria-hidden="true">·</span>
            <span>70% Value Area &amp; Institutional HVN Liquidity Zones</span>
            <span aria-hidden="true">·</span>
            <span className="text-sky-300 font-medium">{spotBadgeText}</span>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Lookback Window Controls */}
          <div
            role="group"
            aria-label="Volume profile lookback window"
            className="flex items-center gap-1 p-1 bg-slate-950 border border-slate-800 rounded-lg"
          >
            {([
              { label: '20 Bars', value: 20 as LookbackOption },
              { label: '60 Bars', value: 60 as LookbackOption },
              { label: 'All Bars', value: 0 as LookbackOption },
            ]).map((opt) => (
              <button
                key={opt.label}
                type="button"
                onClick={() => setLookbackBars(opt.value)}
                aria-pressed={lookbackBars === opt.value}
                className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                  lookbackBars === opt.value
                    ? 'bg-slate-800 text-slate-100 font-semibold border border-slate-700'
                    : 'text-slate-400 hover:text-slate-200 border border-transparent'
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>

          {/* Display Mode Controls */}
          <div
            role="group"
            aria-label="Volume profile view mode"
            className="flex items-center gap-1 p-1 bg-slate-950 border border-slate-800 rounded-lg"
          >
            <button
              type="button"
              onClick={() => setViewMode('LIQUIDITY_PROFILE')}
              aria-pressed={viewMode === 'LIQUIDITY_PROFILE'}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                viewMode === 'LIQUIDITY_PROFILE'
                  ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40 font-semibold'
                  : 'text-slate-400 hover:text-slate-200 border border-transparent'
              }`}
            >
              Liquidity Profile
            </button>
            <button
              type="button"
              onClick={() => setViewMode('VOLUME_DELTA')}
              aria-pressed={viewMode === 'VOLUME_DELTA'}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                viewMode === 'VOLUME_DELTA'
                  ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40 font-semibold'
                  : 'text-slate-400 hover:text-slate-200 border border-transparent'
              }`}
            >
              Buy / Sell Delta
            </button>
          </div>
        </div>
      </div>

      {/* Key Volume Profile Metrics Strip */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 text-xs font-mono tabular-nums">
        <div className="bg-slate-950/70 border border-slate-800 rounded p-3">
          <span className="block text-[11px] text-slate-400">Point of Control (VPOC)</span>
          <span className="block text-base font-bold text-amber-400 mt-0.5">
            {formatPrice(profile.pocPrice)}
          </span>
          <span className="block text-[11px] text-slate-400 mt-0.5">
            {profile.pocSharePct}% of total volume ({formatCompactVolume(profile.pocVolume)})
          </span>
        </div>

        <div className="bg-slate-950/70 border border-slate-800 rounded p-3">
          <span className="block text-[11px] text-slate-400">70% Value Area (VAL – VAH)</span>
          <span className="block text-base font-bold text-sky-300 mt-0.5">
            {formatPrice(profile.valPrice)} – {formatPrice(profile.vahPrice)}
          </span>
          <span className="block text-[11px] text-slate-400 mt-0.5">
            Captures {profile.valueAreaVolumePct}% of traded volume
          </span>
        </div>

        <div className="bg-slate-950/70 border border-slate-800 rounded p-3">
          <span className="block text-[11px] text-slate-400">Institutional Liquidity Nodes</span>
          <span className="block text-base font-bold text-slate-100 mt-0.5">
            {profile.hvnCount} HVN Zones · {profile.lvnCount} LVN Voids
          </span>
          <span className="block text-[11px] text-slate-400 mt-0.5">
            Nearest HVN Anchor: {formatPrice(profile.nearestHvnPrice)}
          </span>
        </div>

        <div className="bg-slate-950/70 border border-slate-800 rounded p-3">
          <span className="block text-[11px] text-slate-400">Net Order-Flow Delta</span>
          <span
            className={`inline-flex items-center gap-1 text-base font-bold mt-0.5 ${
              profile.netDeltaPct >= 0 ? 'text-emerald-400' : 'text-rose-400'
            }`}
          >
            {profile.netDeltaPct >= 0 ? (
              <ArrowUpRight className="w-4 h-4" aria-hidden="true" />
            ) : (
              <ArrowDownRight className="w-4 h-4" aria-hidden="true" />
            )}
            <span>
              {profile.netDeltaPct >= 0 ? '+' : ''}
              {profile.netDeltaPct}%
            </span>
          </span>
          <span className="block text-[11px] text-slate-400 mt-0.5">
            Live Spot: {formatPrice(profile.spotPrice)} · Vol {formatCompactVolume(profile.totalVolume)}
          </span>
        </div>
      </div>

      {/* Main Layout: D3 Volume Profile Chart + Institutional Liquidity Zones Table */}
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-4 items-stretch">
        <div
          ref={containerRef}
          className="xl:col-span-8 bg-slate-950/80 border border-slate-800 rounded-lg p-3 flex flex-col justify-between"
        >
          <svg
            ref={svgRef}
            className="w-full h-auto block select-none"
            role="img"
            aria-label="Trade Volume Profile D3 horizontal volume-at-price chart"
          />

          <div className="flex flex-wrap items-center justify-between gap-3 px-2 pt-2 border-t border-slate-800/80 text-[11px] font-mono text-slate-400">
            <div className="flex flex-wrap items-center gap-4">
              <span className="inline-flex items-center gap-1.5 text-amber-400">
                <span aria-hidden="true">■</span>
                <span>VPOC</span>
              </span>
              <span className="inline-flex items-center gap-1.5 text-sky-400">
                <span aria-hidden="true">■</span>
                <span>Institutional HVN</span>
              </span>
              <span className="inline-flex items-center gap-1.5 text-emerald-400">
                <span aria-hidden="true">■</span>
                <span>Buy Vol</span>
              </span>
              <span className="inline-flex items-center gap-1.5 text-rose-400">
                <span aria-hidden="true">■</span>
                <span>Sell Vol</span>
              </span>
            </div>
            <span>Shaded Band: 70% Value Area</span>
          </div>
        </div>

        {/* Institutional Liquidity Zones & Hovered Level Inspector */}
        <div className="xl:col-span-4 bg-slate-950/70 border border-slate-800 rounded-lg p-3.5 flex flex-col justify-between gap-3">
          <div>
            <div className="flex items-center justify-between pb-2 border-b border-slate-800">
              <span className="text-xs font-semibold text-slate-200 flex items-center gap-1.5">
                <Layers className="w-3.5 h-3.5 text-sky-400" aria-hidden="true" />
                <span>Institutional Liquidity Zones</span>
              </span>
              <span className="text-[11px] font-mono text-slate-400">Top HVN Clusters</span>
            </div>

            <div className="divide-y divide-slate-800/80 mt-1 text-xs font-mono tabular-nums">
              {profile.liquidityZones.map((zone, idx) => (
                <div key={`${zone.nodeType}-${idx}`} className="py-2 flex items-center justify-between gap-2">
                  <div>
                    <div className="flex items-center gap-1.5">
                      <span
                        className={`font-bold ${
                          zone.nodeType === 'POC' ? 'text-amber-400' : 'text-sky-300'
                        }`}
                      >
                        {zone.nodeType}
                      </span>
                      <span className="text-slate-100 font-semibold">
                        {formatPrice(zone.priceLow)}–{formatPrice(zone.priceHigh)}
                      </span>
                    </div>
                    <span className="text-[11px] text-slate-400 block">
                      {zone.netDeltaBias === 'ACCUMULATION'
                        ? 'Net Accumulation'
                        : zone.netDeltaBias === 'DISTRIBUTION'
                        ? 'Net Distribution'
                        : 'Balanced Flow'}{' '}
                      · {zone.distanceFromSpotPct >= 0 ? '+' : ''}
                      {zone.distanceFromSpotPct}% vs spot
                    </span>
                  </div>
                  <div className="text-right">
                    <span className="text-slate-200 font-bold block">
                      {formatCompactVolume(zone.totalVolume)}
                    </span>
                    <span className="text-[11px] text-slate-400">{zone.sharePct}% share</span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {activeBin && (
            <div className="pt-2.5 border-t border-slate-800 text-xs font-mono tabular-nums space-y-1">
              <div className="flex justify-between text-slate-400">
                <span>{hoveredBin ? 'Inspected Level' : 'Active Price Bin'}</span>
                <span className="text-slate-100 font-semibold">
                  {formatPrice(activeBin.priceLow)} – {formatPrice(activeBin.priceHigh)}
                </span>
              </div>
              <div className="flex justify-between text-slate-400">
                <span>Buy / Sell Split</span>
                <span>
                  <span className="text-emerald-400">{formatCompactVolume(activeBin.buyVolume)}</span>
                  {' / '}
                  <span className="text-rose-400">{formatCompactVolume(activeBin.sellVolume)}</span>
                </span>
              </div>
              <div className="flex justify-between text-slate-400">
                <span>Node Classification</span>
                <span className="text-amber-300 font-semibold">{activeBin.liquidityNodeType}</span>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Institutional Liquidity Synthesis Line */}
      <p className="text-xs text-slate-300 pt-2 border-t border-slate-800 leading-relaxed">
        {profile.interpretation}
      </p>
    </section>
  );
};
