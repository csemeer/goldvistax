/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * Aurum Intelligence — Council Workspace Institutional Order Queue Indicator
 *
 * Visualizes aggregated broker pending orders (resting limits vs. stop triggers)
 * stacked across key structural Resistance (R3-R1) and Support (S1-S3) zones
 * around live Spot Price, with venue/order filtering and zone microstructure inspection.
 */

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import * as d3 from 'd3';
import { Candle, CommodityType, InstrumentId, Quote } from '../domain/types';
import {
  BrokerVenueFilter,
  calculateInstitutionalOrderQueue,
  InstitutionalQueueSummary,
  InstitutionalQueueZone,
  QueueOrderTypeFilter,
} from '../services/institutionalQueueEngine';
import { Layers, RefreshCw } from 'lucide-react';

interface InstitutionalQueuePanelProps {
  quotes?: Partial<Record<InstrumentId, Quote>>;
  candles?: Candle[];
  currentCommodity?: CommodityType;
}

const VENUE_TABS: Array<{ id: BrokerVenueFilter; label: string }> = [
  { id: 'ALL', label: 'All Venues' },
  { id: 'CME_GLOBEX', label: 'CME L2' },
  { id: 'LMAX_PRIME', label: 'LMAX' },
  { id: 'SAXO_PRIME', label: 'Saxo' },
  { id: 'CURRENEX_ECN', label: 'Currenex' },
];

const ORDER_TABS: Array<{ id: QueueOrderTypeFilter; label: string }> = [
  { id: 'ALL', label: 'All Orders' },
  { id: 'LIMIT', label: 'Limits' },
  { id: 'STOP', label: 'Stops' },
];

export const InstitutionalQueuePanel: React.FC<InstitutionalQueuePanelProps> = ({
  quotes,
  candles = [],
  currentCommodity = 'GOLD',
}) => {
  const [venueFilter, setVenueFilter] = useState<BrokerVenueFilter>('ALL');
  const [orderFilter, setOrderFilter] = useState<QueueOrderTypeFilter>('ALL');
  const [selectedTier, setSelectedTier] = useState<string>('S2');
  const [serverSnapshot, setServerSnapshot] = useState<InstitutionalQueueSummary | null>(null);
  const [isSyncing, setIsSyncing] = useState<boolean>(false);

  const svgRef = useRef<SVGSVGElement | null>(null);

  const localSummary = useMemo(
    () =>
      calculateInstitutionalOrderQueue({
        commodity: currentCommodity,
        quotes,
        candles,
        venueFilter,
        orderFilter,
        sourceMode: 'AGGREGATED_BROKER_FEED',
      }),
    [candles, currentCommodity, orderFilter, quotes, venueFilter]
  );

  const summary = useMemo(() => {
    if (
      serverSnapshot &&
      serverSnapshot.commodity === currentCommodity &&
      serverSnapshot.venueFilter === venueFilter &&
      serverSnapshot.orderFilter === orderFilter
    ) {
      return serverSnapshot;
    }
    return localSummary;
  }, [currentCommodity, localSummary, orderFilter, serverSnapshot, venueFilter]);

  const syncBrokerQueue = useCallback(async () => {
    setIsSyncing(true);
    try {
      const qs = new URLSearchParams({
        commodity: currentCommodity,
        venue: venueFilter,
        orderType: orderFilter,
      });
      const res = await fetch(`/api/council/institutional-queue?${qs.toString()}`);
      if (!res.ok) return;
      const data = (await res.json()) as {
        success?: boolean;
        queue?: InstitutionalQueueSummary;
      };
      if (data.success && data.queue) {
        setServerSnapshot(data.queue);
      }
    } catch {
      // Fall back transparently to local live-quote calculation when offline
    } finally {
      setIsSyncing(false);
    }
  }, [currentCommodity, orderFilter, venueFilter]);

  useEffect(() => {
    void syncBrokerQueue();
  }, [syncBrokerQueue]);

  const activeZone: InstitutionalQueueZone = useMemo(() => {
    return (
      summary.zones.find((z) => z.tier === selectedTier) ??
      summary.heaviestZone ??
      summary.zones[0]
    );
  }, [selectedTier, summary.heaviestZone, summary.zones]);

  // Render D3.js Support/Resistance Pending Order Ladder around Spot Price
  useEffect(() => {
    const svgEl = svgRef.current;
    if (!svgEl) return;

    const svg = d3.select(svgEl);
    svg.selectAll('*').remove();

    const width = 760;
    const rowHeight = 46;
    const spotGap = 32;
    const margin = { top: 22, right: 164, bottom: 26, left: 168 };
    const innerW = width - margin.left - margin.right;
    const resistanceZones = summary.zones.filter((z) => z.zoneType === 'RESISTANCE');
    const supportZones = summary.zones.filter((z) => z.zoneType === 'SUPPORT');
    const totalContentHeight =
      (resistanceZones.length + supportZones.length) * rowHeight + spotGap;
    const height = margin.top + totalContentHeight + margin.bottom;

    svg.attr('viewBox', `0 0 ${width} ${height}`);

    const g = svg.append('g').attr('transform', `translate(${margin.left},${margin.top})`);

    const maxOrders = Math.max(10, ...summary.zones.map((z) => z.pendingOrderCount));
    const xScale = d3.scaleLinear().domain([0, maxOrders * 1.08]).range([0, innerW]);

    // Subtle vertical grid lines
    g.selectAll('.iq-grid-x')
      .data(xScale.ticks(4))
      .enter()
      .append('line')
      .attr('x1', (d) => xScale(d))
      .attr('x2', (d) => xScale(d))
      .attr('y1', 0)
      .attr('y2', totalContentHeight)
      .attr('stroke', '#1e293b')
      .attr('stroke-width', 1);

    const drawZoneRow = (z: InstitutionalQueueZone, yOffset: number) => {
      const isSelected = activeZone.tier === z.tier;
      const isResistance = z.zoneType === 'RESISTANCE';
      const limitColor = isResistance ? '#f43f5e' : '#10b981';
      const stopColor = '#f59e0b';

      const rowG = g
        .append('g')
        .attr('transform', `translate(0,${yOffset})`)
        .style('cursor', 'pointer')
        .on('click', () => setSelectedTier(z.tier));

      // Interactive row backdrop highlight
      rowG
        .append('rect')
        .attr('x', -margin.left + 4)
        .attr('y', 2)
        .attr('width', width - 8)
        .attr('height', rowHeight - 4)
        .attr('rx', 4)
        .attr('fill', isSelected ? 'rgba(245, 158, 11, 0.08)' : 'transparent')
        .attr('stroke', isSelected ? 'rgba(245, 158, 11, 0.45)' : 'transparent')
        .attr('stroke-width', 1);

      // Left axis: Tier + Price Center + Distance %
      rowG
        .append('text')
        .attr('x', -14)
        .attr('y', 18)
        .attr('text-anchor', 'end')
        .attr('fill', isResistance ? '#fda4af' : '#6ee7b7')
        .attr('font-size', '11px')
        .attr('font-weight', '700')
        .attr('font-family', 'ui-monospace, SFMono-Regular, monospace')
        .text(`${z.tier}  $${z.priceCenter.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`);

      rowG
        .append('text')
        .attr('x', -14)
        .attr('y', 33)
        .attr('text-anchor', 'end')
        .attr('fill', '#94a3b8')
        .attr('font-size', '9.5px')
        .attr('font-family', 'ui-monospace, SFMono-Regular, monospace')
        .text(
          `${z.distanceFromSpotPct >= 0 ? '+' : ''}${z.distanceFromSpotPct.toFixed(2)}% · ${z.dominantOrderType.replace('_', ' ')}`
        );

      // Background track bar
      const barY = 12;
      const barH = 20;
      rowG
        .append('rect')
        .attr('x', 0)
        .attr('y', barY)
        .attr('width', innerW)
        .attr('height', barH)
        .attr('rx', 3)
        .attr('fill', 'rgba(15, 23, 42, 0.9)')
        .attr('stroke', '#1e293b')
        .attr('stroke-width', 1);

      // Limit Order bar segment (solid)
      const limitW = Math.max(0, xScale(z.limitOrderCount));
      if (limitW > 0) {
        rowG
          .append('rect')
          .attr('x', 0)
          .attr('y', barY)
          .attr('width', limitW)
          .attr('height', barH)
          .attr('rx', z.stopOrderCount === 0 ? 3 : 0)
          .attr('fill', limitColor)
          .attr('fill-opacity', isSelected ? 0.92 : 0.74);
      }

      // Stop Order bar segment (stacked adjacent in amber)
      const stopW = Math.max(0, xScale(z.pendingOrderCount) - limitW);
      if (stopW > 0) {
        rowG
          .append('rect')
          .attr('x', limitW)
          .attr('y', barY)
          .attr('width', stopW)
          .attr('height', barH)
          .attr('rx', 2)
          .attr('fill', stopColor)
          .attr('fill-opacity', isSelected ? 0.92 : 0.75);
      }

      // Right axis: Pending Order Count & Lots
      rowG
        .append('text')
        .attr('x', innerW + 12)
        .attr('y', 19)
        .attr('text-anchor', 'start')
        .attr('fill', '#f8fafc')
        .attr('font-size', '11px')
        .attr('font-weight', '700')
        .attr('font-family', 'ui-monospace, SFMono-Regular, monospace')
        .text(`${z.pendingOrderCount.toLocaleString()} orders`);

      rowG
        .append('text')
        .attr('x', innerW + 12)
        .attr('y', 33)
        .attr('text-anchor', 'start')
        .attr('fill', '#94a3b8')
        .attr('font-size', '9.5px')
        .attr('font-family', 'ui-monospace, SFMono-Regular, monospace')
        .text(`${Math.round(z.aggregatedVolumeLots).toLocaleString()} lots · $${z.notionalUsdMillions.toFixed(0)}M`);
    };

    resistanceZones.forEach((z, idx) => {
      drawZoneRow(z, idx * rowHeight);
    });

    // Spot Price Center Divider
    const spotY = resistanceZones.length * rowHeight + spotGap / 2;
    g.append('line')
      .attr('x1', -margin.left + 8)
      .attr('x2', innerW + margin.right - 8)
      .attr('y1', spotY)
      .attr('y2', spotY)
      .attr('stroke', '#38bdf8')
      .attr('stroke-width', 1.25)
      .attr('stroke-dasharray', '4,3');

    g.append('rect')
      .attr('x', innerW / 2 - 115)
      .attr('y', spotY - 10)
      .attr('width', 230)
      .attr('height', 20)
      .attr('rx', 3)
      .attr('fill', '#0f172a')
      .attr('stroke', '#0284c7')
      .attr('stroke-width', 1);

    g.append('text')
      .attr('x', innerW / 2)
      .attr('y', spotY + 3.5)
      .attr('text-anchor', 'middle')
      .attr('fill', '#7dd3fc')
      .attr('font-size', '10px')
      .attr('font-weight', '700')
      .attr('font-family', 'ui-monospace, SFMono-Regular, monospace')
      .text(
        `SPOT ${summary.symbol} $${summary.spotPrice.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
      );

    supportZones.forEach((z, idx) => {
      drawZoneRow(z, resistanceZones.length * rowHeight + spotGap + idx * rowHeight);
    });

    // Bottom numeric X-axis
    const xAxis = d3
      .axisBottom(xScale)
      .ticks(4)
      .tickFormat((d) => `${Number(d).toLocaleString()}`);
    const xAxisG = g
      .append('g')
      .attr('transform', `translate(0,${totalContentHeight + 2})`)
      .call(xAxis);
    xAxisG
      .selectAll('text')
      .attr('fill', '#94a3b8')
      .attr('font-size', '9.5px')
      .attr('font-family', 'ui-monospace, SFMono-Regular, monospace');
    xAxisG.selectAll('path,line').attr('stroke', '#334155');
  }, [activeZone.tier, summary]);

  const activeLimitPct =
    activeZone.pendingOrderCount > 0
      ? Number(((activeZone.limitOrderCount / activeZone.pendingOrderCount) * 100).toFixed(1))
      : 0;
  const activeStopPct = Number((100 - activeLimitPct).toFixed(1));

  return (
    <section
      aria-label="Institutional Order Queue Indicator"
      className="bg-slate-900 border border-slate-800 rounded-lg p-5 space-y-4"
    >
      {/* Header & Aggregated Broker Controls */}
      <div className="flex flex-wrap items-center justify-between gap-4 pb-3 border-b border-slate-800">
        <div>
          <h3 className="text-base font-bold text-slate-100 flex items-center gap-2">
            <Layers className="w-4 h-4 text-sky-400 shrink-0" aria-hidden="true" />
            <span>Institutional Order Queue · Support &amp; Resistance Depth</span>
          </h3>
          <div className="flex flex-wrap items-center gap-2 text-xs text-slate-400 mt-1">
            <span>{summary.symbol} Aggregated Broker Book</span>
            <span aria-hidden="true">·</span>
            <span className="font-mono tabular-nums text-slate-300">
              {summary.totalPendingOrders.toLocaleString()} Pending Orders
            </span>
            <span aria-hidden="true">·</span>
            <span>
              {summary.sourceMode === 'SERVER_LIVE_SNAPSHOT'
                ? 'Live Aggregated Snapshot'
                : 'Live Anchor Model'}
            </span>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Venue Scope Filter */}
          <div
            role="group"
            aria-label="Broker liquidity venue filter"
            className="flex flex-wrap items-center gap-1 p-1 bg-slate-950 border border-slate-800 rounded-lg"
          >
            {VENUE_TABS.map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setVenueFilter(tab.id)}
                aria-pressed={venueFilter === tab.id}
                className={`px-2.5 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                  venueFilter === tab.id
                    ? 'bg-sky-500/20 text-sky-300 border border-sky-500/40 font-semibold'
                    : 'text-slate-400 hover:text-slate-200 border border-transparent'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* Order Intent Filter */}
          <div
            role="group"
            aria-label="Pending order type filter"
            className="flex items-center gap-1 p-1 bg-slate-950 border border-slate-800 rounded-lg"
          >
            {ORDER_TABS.map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setOrderFilter(tab.id)}
                aria-pressed={orderFilter === tab.id}
                className={`px-2.5 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                  orderFilter === tab.id
                    ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40 font-semibold'
                    : 'text-slate-400 hover:text-slate-200 border border-transparent'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          <button
            type="button"
            onClick={() => void syncBrokerQueue()}
            disabled={isSyncing}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 transition-colors whitespace-nowrap shrink-0 disabled:opacity-50 cursor-pointer"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isSyncing ? 'animate-spin' : ''}`} aria-hidden="true" />
            <span>{isSyncing ? 'Syncing...' : 'Sync Book'}</span>
          </button>
        </div>
      </div>

      {/* Main Content Split: D3 Order Ladder (left) + Selected Zone Broker Microstructure (right) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-stretch">
        {/* Left: D3 S/R Pending Order Ladder */}
        <div className="lg:col-span-8 bg-slate-950/70 border border-slate-800 rounded-lg p-4 flex flex-col justify-between space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-slate-400">
            <span>Click any support or resistance zone to inspect venue-level order queue breakdown</span>
            <div className="flex items-center gap-3 font-mono tabular-nums text-[11px]">
              <span className="inline-flex items-center gap-1.5 text-rose-300">
                <span className="w-2.5 h-2.5 bg-rose-500 inline-block rounded-xs" aria-hidden="true" />
                Ask Limits
              </span>
              <span className="inline-flex items-center gap-1.5 text-emerald-300">
                <span className="w-2.5 h-2.5 bg-emerald-500 inline-block rounded-xs" aria-hidden="true" />
                Bid Limits
              </span>
              <span className="inline-flex items-center gap-1.5 text-amber-300">
                <span className="w-2.5 h-2.5 bg-amber-500 inline-block rounded-xs" aria-hidden="true" />
                Stop Triggers
              </span>
            </div>
          </div>

          <svg
            ref={svgRef}
            className="w-full h-auto block select-none"
            role="img"
            aria-label={`Institutional Order Queue D3 ladder for ${summary.symbol} across R3 to S3 zones`}
          />
        </div>

        {/* Right: Selected Zone Microstructure & Broker Contribution Table */}
        <div className="lg:col-span-4 bg-slate-950/70 border border-slate-800 rounded-lg p-4 flex flex-col justify-between space-y-4">
          <div className="space-y-3">
            <div className="pb-2.5 border-b border-slate-800">
              <div className="flex items-center justify-between gap-2">
                <span
                  className={`text-xs font-mono font-bold ${
                    activeZone.zoneType === 'RESISTANCE' ? 'text-rose-400' : 'text-emerald-400'
                  }`}
                >
                  {activeZone.label}
                </span>
                <span className="text-[11px] font-mono tabular-nums text-amber-300">
                  {activeZone.absorptionRating.replace(/_/g, ' ')}
                </span>
              </div>
              <div className="text-lg font-mono font-bold tabular-nums text-slate-100 mt-1">
                ${activeZone.priceCenter.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                <span className="text-xs font-normal text-slate-400 ml-2">
                  (Band ${activeZone.bandLow.toFixed(2)}–${activeZone.bandHigh.toFixed(2)})
                </span>
              </div>
            </div>

            {/* Limit vs Stop Split */}
            <div className="space-y-1.5 text-xs font-mono tabular-nums">
              <div className="flex items-center justify-between text-slate-300">
                <span>Queue Composition</span>
                <span>
                  {activeLimitPct}% Limits · {activeStopPct}% Stops
                </span>
              </div>
              <div className="w-full h-2 bg-slate-800 rounded-sm overflow-hidden flex">
                <div
                  className={activeZone.zoneType === 'RESISTANCE' ? 'bg-rose-500 h-full' : 'bg-emerald-500 h-full'}
                  style={{ width: `${activeLimitPct}%` }}
                />
                <div className="bg-amber-500 h-full" style={{ width: `${activeStopPct}%` }} />
              </div>
              <div className="flex items-center justify-between text-[11px] text-slate-400">
                <span>{activeZone.limitOrderCount.toLocaleString()} Limit</span>
                <span>{activeZone.stopOrderCount.toLocaleString()} Stop</span>
                <span>Avg {activeZone.avgTicketLots.toFixed(2)} lots/order</span>
              </div>
            </div>

            {/* Broker Venue Queue Table */}
            <div className="pt-2 border-t border-slate-800 space-y-2">
              <div className="text-xs font-semibold text-slate-300">
                Broker Venue Order Breakdown
              </div>
              <div className="divide-y divide-slate-800/80 text-xs font-mono tabular-nums">
                {activeZone.brokerBreakdown.map((b) => (
                  <div key={b.brokerId} className="py-2 flex items-center justify-between gap-2">
                    <div className="min-w-0">
                      <div className="text-slate-200 font-medium truncate">{b.brokerName}</div>
                      <div className="text-[11px] text-slate-400">
                        {b.limitOrderCount.toLocaleString()} Lmt / {b.stopOrderCount.toLocaleString()} Stp
                      </div>
                    </div>
                    <div className="text-right shrink-0">
                      <div className="text-slate-100 font-bold">
                        {b.pendingOrderCount.toLocaleString()}
                      </div>
                      <div className="text-[11px] text-slate-400">
                        {b.sharePct}% · {Math.round(b.volumeLots).toLocaleString()} lots
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Quick Zone Selector Strip */}
          <div className="pt-2 border-t border-slate-800 flex items-center justify-between gap-1">
            {summary.zones.map((z) => (
              <button
                key={z.tier}
                type="button"
                onClick={() => setSelectedTier(z.tier)}
                className={`px-2 py-1 text-[11px] font-mono font-bold rounded transition-colors cursor-pointer ${
                  activeZone.tier === z.tier
                    ? 'bg-amber-500/20 text-amber-300 border border-amber-500/50'
                    : z.zoneType === 'RESISTANCE'
                    ? 'bg-slate-900 text-rose-300 border border-slate-800 hover:border-slate-700'
                    : 'bg-slate-900 text-emerald-300 border border-slate-800 hover:border-slate-700'
                }`}
              >
                {z.tier}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* 4 Aggregate Queue KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 text-xs font-mono tabular-nums">
        <div className="bg-slate-950/70 border border-slate-800 rounded p-3">
          <span className="block text-[10px] text-slate-500 uppercase">Total Queued Orders</span>
          <span className="block text-base font-bold text-slate-100 mt-0.5">
            {summary.totalPendingOrders.toLocaleString()}
          </span>
          <span className="block text-[10px] text-slate-400 mt-0.5">
            {summary.totalSupportOrders.toLocaleString()} Bid / {summary.totalResistanceOrders.toLocaleString()} Ask
          </span>
        </div>

        <div className="bg-slate-950/70 border border-slate-800 rounded p-3">
          <span className="block text-[10px] text-slate-500 uppercase">Bid / Ask Queue Ratio</span>
          <span
            className={`block text-base font-bold mt-0.5 ${
              summary.netQueueBias === 'BID_HEAVY_SUPPORT'
                ? 'text-emerald-400'
                : summary.netQueueBias === 'ASK_HEAVY_RESISTANCE'
                ? 'text-rose-400'
                : 'text-slate-200'
            }`}
          >
            {summary.supportResistanceImbalanceRatio.toFixed(2)}x
          </span>
          <span className="block text-[10px] text-slate-400 mt-0.5">
            {summary.netQueueBias === 'BID_HEAVY_SUPPORT'
              ? 'Bid-Heavy Support Floor'
              : summary.netQueueBias === 'ASK_HEAVY_RESISTANCE'
              ? 'Ask-Heavy Resistance Cap'
              : 'Balanced Two-Way Book'}
          </span>
        </div>

        <div className="bg-slate-950/70 border border-slate-800 rounded p-3">
          <span className="block text-[10px] text-slate-500 uppercase">Heaviest Liquidity Wall</span>
          <span className="block text-base font-bold text-amber-300 mt-0.5">
            {summary.heaviestZone.tier} · ${summary.heaviestZone.priceCenter.toFixed(2)}
          </span>
          <span className="block text-[10px] text-slate-400 mt-0.5">
            {summary.heaviestZone.pendingOrderCount.toLocaleString()} orders ({summary.heaviestZone.dominantOrderType.replace('_', ' ')})
          </span>
        </div>

        <div className="bg-slate-950/70 border border-slate-800 rounded p-3">
          <span className="block text-[10px] text-slate-500 uppercase">Aggregated Depth Notional</span>
          <span className="block text-base font-bold text-sky-300 mt-0.5">
            ${summary.totalNotionalUsdMillions.toLocaleString(undefined, { maximumFractionDigits: 1 })}M
          </span>
          <span className="block text-[10px] text-slate-400 mt-0.5">
            {Math.round(summary.totalAggregatedLots).toLocaleString()} lots across {summary.brokerSummaries.length} venues
          </span>
        </div>
      </div>
    </section>
  );
};
