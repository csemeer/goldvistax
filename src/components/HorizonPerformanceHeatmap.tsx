/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * Aurum Intelligence — Advisory Horizon Performance Heatmap
 *
 * Visualizes win/loss R-multiple distribution and Return on Investment (ROI)
 * grouped by Advisory Horizon (Intraday, Swing, Long-Term) so traders can
 * pinpoint which timeframes generate the highest risk-adjusted returns.
 */

import React, { useEffect, useMemo, useRef, useState } from 'react';
import * as d3 from 'd3';
import { PaperPosition, Quote } from '../domain/types';
import {
  buildHorizonAuditCsv,
  calculateHorizonPerformanceHeatmap,
  HorizonAuditCsvArtifact,
  HorizonBucketId,
  HorizonCategory,
  HorizonHeatmapCell,
  HorizonHeatmapScope,
  HorizonPerformanceRow,
  SelectedHorizonFilter,
} from '../services/portfolioScannerEngine';
import { Download, Flame, TrendingUp } from 'lucide-react';

interface HorizonPerformanceHeatmapProps {
  positions: PaperPosition[];
  quote: Quote;
  quotes?: Record<string, Quote>;
  startingCapital?: number;
  activeRangeLabel?: string;
}

type HeatmapDisplayLens = 'ROI_PCT' | 'SHARE_PCT' | 'EXPECTANCY_R';

function getCellHeatClasses(cell: HorizonHeatmapCell, isSelected: boolean): string {
  if (cell.tradeCount === 0) {
    return isSelected
      ? 'bg-slate-900 border-amber-400/70 text-slate-500'
      : 'bg-slate-950/60 border-slate-800/80 text-slate-600 hover:border-slate-700';
  }

  const ring = isSelected ? 'border-amber-400 ring-1 ring-amber-400/60' : '';

  if (cell.isWinBucket) {
    if (cell.intensity >= 0.78) {
      return `bg-emerald-500/40 border-emerald-400/70 text-emerald-100 hover:border-emerald-300 ${ring}`;
    }
    if (cell.intensity >= 0.55) {
      return `bg-emerald-500/30 border-emerald-500/60 text-emerald-100 hover:border-emerald-400 ${ring}`;
    }
    if (cell.intensity >= 0.35) {
      return `bg-emerald-500/20 border-emerald-500/45 text-emerald-200 hover:border-emerald-400 ${ring}`;
    }
    return `bg-emerald-500/10 border-emerald-500/30 text-emerald-200 hover:border-emerald-400 ${ring}`;
  }

  if (cell.intensity >= 0.78) {
    return `bg-rose-500/40 border-rose-400/70 text-rose-100 hover:border-rose-300 ${ring}`;
  }
  if (cell.intensity >= 0.55) {
    return `bg-rose-500/30 border-rose-500/60 text-rose-100 hover:border-rose-400 ${ring}`;
  }
  if (cell.intensity >= 0.35) {
    return `bg-rose-500/20 border-rose-500/45 text-rose-200 hover:border-rose-400 ${ring}`;
  }
  return `bg-rose-500/10 border-rose-500/30 text-rose-200 hover:border-rose-400 ${ring}`;
}

function formatSignedUsd(val: number): string {
  const abs = Math.abs(val).toLocaleString('en-US', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  });
  return val >= 0 ? `+$${abs}` : `-$${abs}`;
}

function formatSignedPct(val: number): string {
  return `${val >= 0 ? '+' : ''}${val.toFixed(2)}%`;
}

export const HorizonPerformanceHeatmap: React.FC<HorizonPerformanceHeatmapProps> = ({
  positions,
  quote,
  quotes,
  startingCapital = 100000,
  activeRangeLabel = 'All Cycles',
}) => {
  const [scope, setScope] = useState<HorizonHeatmapScope>('CLOSED_ONLY');
  const [lens, setLens] = useState<HeatmapDisplayLens>('ROI_PCT');
  const [selectedCell, setSelectedCell] = useState<{
    horizon: HorizonCategory;
    bucketId: HorizonBucketId;
  } | null>(null);
  const [selectedHorizon, setSelectedHorizon] = useState<SelectedHorizonFilter>('ALL');
  const [csvExportInfo, setCsvExportInfo] = useState<HorizonAuditCsvArtifact | null>(null);

  const svgRef = useRef<SVGSVGElement | null>(null);

  const summary = useMemo(
    () =>
      calculateHorizonPerformanceHeatmap(positions, {
        scope,
        startingCapitalUsd: startingCapital,
        quotes,
        defaultQuote: quote,
      }),
    [positions, scope, startingCapital, quotes, quote]
  );

  // Clear stale selection if scope/filter reduces matching trades
  useEffect(() => {
    if (!selectedCell) return;
    const row = summary.rows.find((r) => r.horizon === selectedCell.horizon);
    const cell = row?.cells.find((c) => c.bucketId === selectedCell.bucketId);
    if (!cell || cell.tradeCount === 0) {
      setSelectedCell(null);
    }
  }, [selectedCell, summary]);

  // Render D3 ROI Comparison Horizontal Bar Chart across Advisory Horizons
  useEffect(() => {
    const svgEl = svgRef.current;
    if (!svgEl || summary.totalAnalyzedTrades === 0) return;

    const svg = d3.select(svgEl);
    svg.selectAll('*').remove();

    const width = 760;
    const height = 166;
    const margin = { top: 20, right: 112, bottom: 26, left: 146 };
    const innerW = width - margin.left - margin.right;
    const innerH = height - margin.top - margin.bottom;

    svg.attr('viewBox', `0 0 ${width} ${height}`);
    const g = svg.append('g').attr('transform', `translate(${margin.left},${margin.top})`);

    const rows = summary.rows;
    const minRoi = Math.min(0, ...rows.map((r) => r.roiPct));
    const maxRoi = Math.max(0, ...rows.map((r) => r.roiPct));
    const span = Math.max(4, maxRoi - minRoi);
    const padLow = minRoi < 0 ? minRoi - span * 0.15 : Math.min(-1.5, -span * 0.1);
    const padHigh = maxRoi + span * 0.18;

    const xScale = d3.scaleLinear().domain([padLow, padHigh]).range([0, innerW]);
    const yScale = d3
      .scaleBand<HorizonCategory>()
      .domain(rows.map((r) => r.horizon))
      .range([0, innerH])
      .padding(0.32);

    // Subtle vertical grid lines
    g.selectAll('.horizon-roi-grid')
      .data(xScale.ticks(5))
      .enter()
      .append('line')
      .attr('x1', (d) => xScale(d))
      .attr('x2', (d) => xScale(d))
      .attr('y1', 0)
      .attr('y2', innerH)
      .attr('stroke', '#1e293b')
      .attr('stroke-width', 1);

    // Zero ROI baseline
    const zeroX = xScale(0);
    g.append('line')
      .attr('x1', zeroX)
      .attr('x2', zeroX)
      .attr('y1', -4)
      .attr('y2', innerH + 2)
      .attr('stroke', '#64748b')
      .attr('stroke-width', 1.25)
      .attr('stroke-dasharray', '3 3');

    // Horizontal diverging ROI bars per horizon
    g.selectAll('.horizon-roi-bar')
      .data(rows)
      .enter()
      .append('rect')
      .attr('x', (d) => (d.roiPct >= 0 ? zeroX : xScale(d.roiPct)))
      .attr('y', (d) => yScale(d.horizon) ?? 0)
      .attr('width', (d) => Math.max(2, Math.abs(xScale(d.roiPct) - zeroX)))
      .attr('height', yScale.bandwidth())
      .attr('rx', 4)
      .attr('fill', (d) => {
        if (d.totalTrades === 0) return '#334155';
        if (d.isHighestRoi && d.roiPct > 0) return '#10b981';
        return d.roiPct >= 0 ? 'rgba(16, 185, 129, 0.65)' : 'rgba(244, 63, 94, 0.72)';
      })
      .attr('stroke', (d) => {
        if (d.isHighestRoi && d.roiPct > 0) return '#fbbf24';
        return 'none';
      })
      .attr('stroke-width', (d) => (d.isHighestRoi && d.roiPct > 0 ? 1.4 : 0));

    // Left horizon labels
    g.selectAll('.horizon-y-label')
      .data(rows)
      .enter()
      .append('text')
      .attr('x', -12)
      .attr('y', (d) => (yScale(d.horizon) ?? 0) + yScale.bandwidth() / 2 + 4)
      .attr('text-anchor', 'end')
      .attr('fill', (d) => (d.isHighestRoi ? '#fbbf24' : '#cbd5e1'))
      .attr('font-size', '11')
      .attr('font-family', 'monospace')
      .attr('font-weight', (d) => (d.isHighestRoi ? '700' : '500'))
      .text((d) => `${d.label} (${d.totalTrades}T)`);

    // Right ROI + Win% readout labels
    g.selectAll('.horizon-roi-val')
      .data(rows)
      .enter()
      .append('text')
      .attr('x', innerW + 10)
      .attr('y', (d) => (yScale(d.horizon) ?? 0) + yScale.bandwidth() / 2 + 4)
      .attr('text-anchor', 'start')
      .attr('fill', (d) =>
        d.totalTrades === 0 ? '#64748b' : d.roiPct >= 0 ? '#34d399' : '#fb7185'
      )
      .attr('font-size', '11')
      .attr('font-family', 'monospace')
      .attr('font-weight', '700')
      .text((d) =>
        d.totalTrades === 0
          ? '0.00% (No trades)'
          : `${formatSignedPct(d.roiPct)} · ${d.winRatePct}% W`
      );

    // X-axis ROI % ticks
    const xAxis = d3
      .axisBottom(xScale)
      .ticks(5)
      .tickFormat((v) => `${Number(v) >= 0 ? '+' : ''}${Number(v).toFixed(0)}%`);

    g.append('g')
      .attr('transform', `translate(0,${innerH})`)
      .call(xAxis)
      .call((axisG) => axisG.select('.domain').attr('stroke', '#334155'))
      .call((axisG) =>
        axisG.selectAll('text').attr('fill', '#94a3b8').attr('font-size', '10').attr('font-family', 'monospace')
      );
  }, [summary]);

  const activeInspectRow: HorizonPerformanceRow | null = useMemo(() => {
    const targetHorizon =
      selectedCell?.horizon ?? (selectedHorizon !== 'ALL' ? selectedHorizon : null);
    if (!targetHorizon) return null;
    return summary.rows.find((r) => r.horizon === targetHorizon) ?? null;
  }, [selectedCell, selectedHorizon, summary.rows]);

  const activeInspectCell: HorizonHeatmapCell | null = useMemo(() => {
    if (!selectedCell || !activeInspectRow) return null;
    return activeInspectRow.cells.find((c) => c.bucketId === selectedCell.bucketId) ?? null;
  }, [selectedCell, activeInspectRow]);

  const drilldownTrades = useMemo(() => {
    if (activeInspectCell) return activeInspectCell.trades;
    if (activeInspectRow) return activeInspectRow.cells.flatMap((c) => c.trades);
    return [];
  }, [activeInspectCell, activeInspectRow]);

  const effectiveExportHorizon: SelectedHorizonFilter =
    selectedHorizon !== 'ALL' ? selectedHorizon : selectedCell?.horizon ?? 'ALL';

  const handleExportCsv = () => {
    const artifact = buildHorizonAuditCsv(summary, {
      selectedHorizon: effectiveExportHorizon,
      activeRangeLabel,
    });
    const blob = new Blob([artifact.csvContent], {
      type: 'text/csv;charset=utf-8',
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = artifact.filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    setTimeout(() => URL.revokeObjectURL(url), 1500);
    setCsvExportInfo(artifact);
  };

  const topRow = summary.bestRoiHorizon
    ? summary.rows.find((r) => r.horizon === summary.bestRoiHorizon) ?? null
    : null;
  const intradayRow = summary.rows.find((r) => r.horizon === 'INTRADAY')!;
  const swingRow = summary.rows.find((r) => r.horizon === 'SWING')!;
  const longTermRow = summary.rows.find((r) => r.horizon === 'LONG_TERM')!;

  return (
    <section
      aria-label="Advisory Horizon Performance Heatmap"
      className="bg-slate-900 border border-slate-800 rounded-lg p-5 space-y-5"
    >
      {/* Header & Controls */}
      <div className="flex flex-wrap items-start justify-between gap-4 pb-3 border-b border-slate-800">
        <div>
          <h3 className="text-base font-bold text-slate-100 flex items-center gap-2">
            <Flame className="w-4 h-4 text-amber-400 shrink-0" aria-hidden="true" />
            <span>Advisory Horizon Performance Heatmap</span>
          </h3>
          <div className="flex flex-wrap items-center gap-2 text-xs text-slate-400 mt-1">
            <span>Scope: {activeRangeLabel}</span>
            <span aria-hidden="true">·</span>
            <span className="font-mono tabular-nums">
              {summary.totalAnalyzedTrades} {scope === 'CLOSED_ONLY' ? 'closed' : 'executed'} trades
            </span>
            <span aria-hidden="true">·</span>
            <span className="font-mono tabular-nums">
              Win/Loss Ratio: {summary.totalWinCount}W / {summary.totalLossCount}L
            </span>
            {topRow && (
              <>
                <span aria-hidden="true">·</span>
                <span className="text-emerald-400 font-semibold">
                  Highest ROI: {topRow.label} ({formatSignedPct(topRow.roiPct)})
                </span>
              </>
            )}
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Selected Advisory Horizon Filter (determines CSV Export & Drilldown scope) */}
          <div
            role="group"
            aria-label="Selected Advisory Horizon"
            className="flex items-center gap-1 p-1 bg-slate-950 border border-slate-800 rounded-lg"
          >
            {(
              [
                { id: 'ALL', label: 'All Horizons' },
                { id: 'INTRADAY', label: 'Intraday' },
                { id: 'SWING', label: 'Swing' },
                { id: 'LONG_TERM', label: 'Long-Term' },
              ] as const
            ).map((opt) => (
              <button
                key={opt.id}
                type="button"
                onClick={() => {
                  setSelectedCell(null);
                  setSelectedHorizon(opt.id);
                }}
                aria-pressed={selectedHorizon === opt.id}
                className={`px-2.5 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                  selectedHorizon === opt.id
                    ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40 font-semibold'
                    : 'text-slate-400 hover:text-slate-200 border border-transparent'
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>

          {/* Closed vs Open MTM Scope */}
          <div
            role="group"
            aria-label="Horizon Heatmap Trade Scope"
            className="flex items-center gap-1 p-1 bg-slate-950 border border-slate-800 rounded-lg"
          >
            {(
              [
                { id: 'CLOSED_ONLY', label: 'Closed Realized' },
                { id: 'ALL_EXECUTED', label: 'Incl. Open MTM' },
              ] as const
            ).map((opt) => (
              <button
                key={opt.id}
                type="button"
                onClick={() => setScope(opt.id)}
                aria-pressed={scope === opt.id}
                className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                  scope === opt.id
                    ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40 font-semibold'
                    : 'text-slate-400 hover:text-slate-200 border border-transparent'
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>

          {/* Metric Lens Selector */}
          <div
            role="group"
            aria-label="Heatmap Metric Display"
            className="flex items-center gap-1 p-1 bg-slate-950 border border-slate-800 rounded-lg"
          >
            {(
              [
                { id: 'ROI_PCT', label: 'ROI % & P&L' },
                { id: 'SHARE_PCT', label: 'Win/Loss %' },
                { id: 'EXPECTANCY_R', label: 'Avg R-Multiple' },
              ] as const
            ).map((opt) => (
              <button
                key={opt.id}
                type="button"
                onClick={() => setLens(opt.id)}
                aria-pressed={lens === opt.id}
                className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                  lens === opt.id
                    ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40 font-semibold'
                    : 'text-slate-400 hover:text-slate-200 border border-transparent'
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>

          {/* Export CSV Button */}
          <button
            type="button"
            onClick={handleExportCsv}
            aria-label="Export CSV"
            className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold rounded-md bg-amber-500 hover:bg-amber-400 text-slate-950 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
          >
            <Download className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
            <span>Export CSV</span>
          </button>
        </div>
      </div>

      {csvExportInfo && (
        <div
          aria-label="CSV Export Confirmation"
          className="flex flex-wrap items-center justify-between gap-2 px-3.5 py-2 rounded-md border border-emerald-500/30 bg-emerald-500/10 text-xs font-mono text-emerald-200"
        >
          <span>
            Exported {csvExportInfo.filename} · Scope: {csvExportInfo.selectedHorizonLabel} ·{' '}
            {csvExportInfo.tradeRowsIncluded} trades, {csvExportInfo.bucketRowsIncluded} distribution cells
          </span>
          <button
            type="button"
            onClick={() => setCsvExportInfo(null)}
            className="text-emerald-300 hover:text-emerald-100 whitespace-nowrap shrink-0 cursor-pointer"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* 4-KPI Horizon Comparison Summary */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 text-xs font-mono tabular-nums">
        <div className="bg-slate-950/70 p-3 rounded border border-slate-800">
          <span className="text-slate-500 block text-[10px]">HIGHEST ROI TIMEFRAME</span>
          <span className="text-base font-bold text-emerald-400 block mt-0.5">
            {topRow ? `${topRow.label} (${formatSignedPct(topRow.roiPct)})` : 'No Data'}
          </span>
          <span className="text-[10px] text-slate-400 block mt-0.5">
            {topRow
              ? `${topRow.winRatePct}% win · ${formatSignedUsd(topRow.netPnlUsd)}`
              : 'Requires closed or open positions'}
          </span>
        </div>

        <div className="bg-slate-950/70 p-3 rounded border border-slate-800">
          <span className="text-slate-500 block text-[10px]">INTRADAY (M15 / H1) ROI</span>
          <span
            className={`text-base font-bold block mt-0.5 ${
              intradayRow.roiPct >= 0 ? 'text-emerald-400' : 'text-rose-400'
            }`}
          >
            {formatSignedPct(intradayRow.roiPct)}
          </span>
          <span className="text-[10px] text-slate-400 block mt-0.5">
            {intradayRow.winCount}W / {intradayRow.lossCount}L ({intradayRow.winRatePct}% win)
          </span>
        </div>

        <div className="bg-slate-950/70 p-3 rounded border border-slate-800">
          <span className="text-slate-500 block text-[10px]">SWING (H4 / 1D) ROI</span>
          <span
            className={`text-base font-bold block mt-0.5 ${
              swingRow.roiPct >= 0 ? 'text-emerald-400' : 'text-rose-400'
            }`}
          >
            {formatSignedPct(swingRow.roiPct)}
          </span>
          <span className="text-[10px] text-slate-400 block mt-0.5">
            {swingRow.winCount}W / {swingRow.lossCount}L ({swingRow.winRatePct}% win)
          </span>
        </div>

        <div className="bg-slate-950/70 p-3 rounded border border-slate-800">
          <span className="text-slate-500 block text-[10px]">LONG-TERM (W1 MACRO) ROI</span>
          <span
            className={`text-base font-bold block mt-0.5 ${
              longTermRow.roiPct >= 0 ? 'text-emerald-400' : 'text-rose-400'
            }`}
          >
            {formatSignedPct(longTermRow.roiPct)}
          </span>
          <span className="text-[10px] text-slate-400 block mt-0.5">
            {longTermRow.winCount}W / {longTermRow.lossCount}L ({longTermRow.winRatePct}% win)
          </span>
        </div>
      </div>

      {/* Empty State or Populated Matrix + D3 Comparison */}
      {summary.totalAnalyzedTrades === 0 ? (
        <div className="bg-slate-950/60 border border-slate-800 rounded-lg p-6 text-center space-y-3">
          <p className="text-xs text-slate-300">
            No {scope === 'CLOSED_ONLY' ? 'closed' : 'executed'} trades found in {activeRangeLabel}.
          </p>
          {scope === 'CLOSED_ONLY' && positions.some((p) => p.status === 'OPEN') && (
            <button
              type="button"
              onClick={() => setScope('ALL_EXECUTED')}
              className="px-3 py-1.5 rounded bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-semibold transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              Include Open MTM Positions
            </button>
          )}
        </div>
      ) : (
        <>
          {/* 2D Win/Loss Distribution Heatmap Matrix */}
          <div className="overflow-x-auto">
            <div className="min-w-[780px] space-y-2">
              {/* Column Headers */}
              <div className="grid grid-cols-[175px_repeat(5,minmax(95px,1fr))_175px] gap-2 px-1 text-[11px] font-mono">
                <div className="text-slate-400 font-semibold self-end pb-1">
                  Advisory Horizon
                </div>
                {summary.bucketColumns.map((col) => (
                  <div
                    key={col.bucketId}
                    className={`text-center pb-1 border-b ${
                      col.isWinBucket
                        ? 'text-emerald-400 border-emerald-500/30'
                        : 'text-rose-400 border-rose-500/30'
                    }`}
                  >
                    <div className="font-semibold">{col.label}</div>
                    <div className="text-[10px] text-slate-500">{col.shortRange}</div>
                  </div>
                ))}
                <div className="text-right text-slate-400 font-semibold self-end pb-1">
                  Horizon ROI &amp; Win Rate
                </div>
              </div>

              {/* Matrix Rows: Intraday / Swing / Long-Term */}
              {summary.rows.map((row) => {
                const isRowSelected = selectedHorizon === row.horizon && !selectedCell;
                return (
                  <div
                    key={row.horizon}
                    className="grid grid-cols-[175px_repeat(5,minmax(95px,1fr))_175px] gap-2 items-stretch"
                  >
                    {/* Horizon Selector Header Cell */}
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedCell(null);
                        setSelectedHorizon((prev) =>
                          prev === row.horizon ? 'ALL' : row.horizon
                        );
                      }}
                      aria-label={`${row.label} Advisory Horizon summary`}
                      className={`text-left p-2.5 rounded-md border transition-colors cursor-pointer ${
                        isRowSelected
                          ? 'bg-slate-800 border-amber-400'
                          : row.isHighestRoi
                          ? 'bg-slate-950/90 border-emerald-500/50 hover:border-emerald-400'
                          : 'bg-slate-950/70 border-slate-800 hover:border-slate-700'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-1">
                        <span className="text-xs font-bold text-slate-100">{row.label}</span>
                        {row.isHighestRoi && (
                          <span className="text-[10px] font-mono font-bold text-emerald-400 whitespace-nowrap">
                            Peak ROI
                          </span>
                        )}
                      </div>
                      <div className="text-[10px] font-mono text-slate-400 mt-0.5">
                        {row.timeframeTag}
                      </div>
                      <div className="text-[10px] font-mono tabular-nums text-slate-500 mt-1">
                        {row.totalTrades} trades · PF {row.profitFactor >= 99 ? '∞' : row.profitFactor.toFixed(2)}
                      </div>
                    </button>

                    {/* 5 Outcome Bucket Heatmap Cells */}
                    {row.cells.map((cell) => {
                      const isCellSelected =
                        selectedCell?.horizon === row.horizon &&
                        selectedCell?.bucketId === cell.bucketId;

                      let primaryText = '—';
                      let secondaryText = '0 trades';

                      if (cell.tradeCount > 0) {
                        if (lens === 'ROI_PCT') {
                          primaryText = formatSignedPct(cell.roiContributionPct);
                          secondaryText = `${cell.tradeCount}T · ${formatSignedUsd(cell.netPnlUsd)}`;
                        } else if (lens === 'SHARE_PCT') {
                          primaryText = `${cell.horizonSharePct.toFixed(0)}%`;
                          secondaryText = `${cell.tradeCount} of ${row.totalTrades}T`;
                        } else {
                          primaryText = `${cell.avgRMultiple >= 0 ? '+' : ''}${cell.avgRMultiple.toFixed(2)}R`;
                          secondaryText = `${cell.tradeCount}T · ${cell.horizonSharePct.toFixed(0)}%`;
                        }
                      }

                      return (
                        <button
                          key={cell.bucketId}
                          type="button"
                          disabled={cell.tradeCount === 0}
                          onClick={() => {
                            setSelectedHorizon('ALL');
                            setSelectedCell((prev) =>
                              prev?.horizon === row.horizon && prev?.bucketId === cell.bucketId
                                ? null
                                : { horizon: row.horizon, bucketId: cell.bucketId }
                            );
                          }}
                          aria-label={`${row.label} ${cell.bucketLabel}: ${cell.tradeCount} trades, ${cell.horizonSharePct}% share, ${formatSignedPct(cell.roiContributionPct)} ROI`}
                          className={`p-2.5 rounded-md border text-center font-mono tabular-nums transition-colors flex flex-col justify-center items-center ${getCellHeatClasses(
                            cell,
                            isCellSelected
                          )} ${cell.tradeCount === 0 ? 'cursor-default' : 'cursor-pointer'}`}
                        >
                          <span className="text-xs font-bold leading-tight">{primaryText}</span>
                          <span className="text-[10px] opacity-85 mt-1 leading-tight">
                            {secondaryText}
                          </span>
                        </button>
                      );
                    })}

                    {/* Horizon Summary & Capital Efficiency Column */}
                    <div
                      className={`p-2.5 rounded-md border text-right font-mono tabular-nums flex flex-col justify-center ${
                        row.isHighestRoi
                          ? 'bg-emerald-950/30 border-emerald-500/40'
                          : 'bg-slate-950/70 border-slate-800'
                      }`}
                    >
                      <div
                        className={`text-sm font-bold ${
                          row.totalTrades === 0
                            ? 'text-slate-500'
                            : row.roiPct >= 0
                            ? 'text-emerald-400'
                            : 'text-rose-400'
                        }`}
                      >
                        {formatSignedPct(row.roiPct)} ROI
                      </div>
                      <div className="text-[11px] text-slate-300 mt-0.5">
                        {row.winRatePct.toFixed(1)}% Win ({row.winCount}W/{row.lossCount}L)
                      </div>
                      <div className="text-[10px] text-slate-400 mt-0.5">
                        {formatSignedUsd(row.netPnlUsd)} · Margin ROI {formatSignedPct(row.returnOnMarginPct)}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Interactive Drill-Down Trade Strip (when a cell or horizon is clicked) */}
          {activeInspectRow && drilldownTrades.length > 0 && (
            <div className="bg-slate-950/70 border border-slate-800 rounded-lg p-3.5 space-y-2.5">
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-800 pb-2">
                <div className="text-xs font-mono text-slate-200 font-semibold">
                  {activeInspectCell
                    ? `${activeInspectRow.label} · ${activeInspectCell.bucketLabel} (${drilldownTrades.length} trades)`
                    : `${activeInspectRow.label} Full Horizon Breakdown (${drilldownTrades.length} trades)`}
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setSelectedCell(null);
                    setSelectedHorizon('ALL');
                  }}
                  className="text-xs text-slate-400 hover:text-slate-200 whitespace-nowrap shrink-0 cursor-pointer"
                >
                  Close Breakdown
                </button>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-xs font-mono tabular-nums">
                {drilldownTrades.map((t) => (
                  <div
                    key={t.positionId}
                    className="flex items-center justify-between gap-3 bg-slate-900/90 border border-slate-800 rounded px-3 py-2"
                  >
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-slate-100">{t.positionId}</span>
                        <span className="text-slate-400">{t.instrumentId}</span>
                        <span
                          className={
                            t.direction === 'BUY' ? 'text-emerald-400' : 'text-rose-400'
                          }
                        >
                          {t.direction}
                        </span>
                      </div>
                      <div className="text-[11px] text-slate-500 truncate mt-0.5">
                        {t.openTime.slice(0, 10)} · {t.notes}
                      </div>
                    </div>
                    <div className="text-right shrink-0">
                      <div
                        className={`font-bold ${
                          t.pnlUsd >= 0 ? 'text-emerald-400' : 'text-rose-400'
                        }`}
                      >
                        {formatSignedUsd(t.pnlUsd)}
                      </div>
                      <div className="text-[10px] text-slate-400">
                        {t.rMultiple >= 0 ? '+' : ''}
                        {t.rMultiple.toFixed(2)}R ({formatSignedPct(t.roiPct)})
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* D3 Horizon Account ROI Comparison Chart */}
          <div className="bg-slate-950/70 border border-slate-800 rounded-lg p-3.5">
            <div className="flex flex-wrap items-center justify-between gap-2 mb-2 text-xs">
              <span className="font-semibold text-slate-200 flex items-center gap-1.5">
                <TrendingUp className="w-3.5 h-3.5 text-emerald-400 shrink-0" aria-hidden="true" />
                Timeframe Account ROI Comparison (%)
              </span>
              <span className="font-mono tabular-nums text-[11px] text-slate-400">
                Basis: ${summary.startingCapitalUsd.toLocaleString()} Starting Equity · Spread{' '}
                {summary.roiSpreadPct.toFixed(2)}%
              </span>
            </div>
            <svg
              ref={svgRef}
              aria-label="Advisory Horizon ROI Comparison Bar Chart"
              className="w-full h-auto block"
            />
          </div>
        </>
      )}

      {/* Quantitative Interpretation Footer */}
      <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-slate-800/80 text-xs text-slate-300">
        <span>{summary.insightSummary}</span>
        <span className="font-mono text-[11px] text-slate-500 whitespace-nowrap">
          Click any heatmap cell to inspect matching trades
        </span>
      </div>
    </section>
  );
};
