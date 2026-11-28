/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * Aurum Intelligence — Trade Correlation Matrix Panel (Council Workspace)
 *
 * Visualizes real-time Pearson correlation coefficients (r in [-1, +1]), R^2 variance
 * explained, and 5-year regime deviations across XAU/USD, DXY, and 10Y US Treasury yields.
 */

import React, { useEffect, useMemo, useState } from 'react';
import { Candle, InstrumentId, Quote } from '../domain/types';
import {
  calculateMacroCorrelationMatrix,
  CorrelationAssetKey,
  CorrelationCell,
  CorrelationWindow,
  MacroCorrelationMatrixReport,
  MacroInterdependencyPair,
} from '../services/crossCommoditySpreads';
import { GitCompare, ArrowUpRight, ArrowDownRight, Minus } from 'lucide-react';

interface TradeCorrelationMatrixPanelProps {
  quotes: Partial<Record<InstrumentId, Quote>>;
  candles?: Candle[];
}

const ASSET_ORDER: CorrelationAssetKey[] = ['XAUUSD', 'DXY', 'US10Y'];

const ASSET_LABELS: Record<CorrelationAssetKey, string> = {
  XAUUSD: 'XAU/USD',
  DXY: 'DXY',
  US10Y: '10Y Yield',
};

const WINDOW_OPTIONS: { id: CorrelationWindow; label: string }[] = [
  { id: '14D', label: '14D Tactical' },
  { id: '30D', label: '30D Rolling' },
  { id: '90D', label: '90D Quarterly' },
];

function getPairIdForAssets(
  a: CorrelationAssetKey,
  b: CorrelationAssetKey
): MacroInterdependencyPair['pairId'] | null {
  if (a === b) return null;
  const pair = [a, b].sort().join('_');
  if (pair === 'DXY_XAUUSD') return 'XAUUSD_DXY';
  if (pair === 'US10Y_XAUUSD') return 'XAUUSD_US10Y';
  if (pair === 'DXY_US10Y') return 'DXY_US10Y';
  return null;
}

function getHeatmapCellStyle(cell: CorrelationCell, isDiagonal: boolean): string {
  if (isDiagonal) {
    return 'bg-slate-950/70 border-slate-800 text-slate-400';
  }
  const r = cell.coefficient;
  if (r <= -0.65) {
    return 'bg-rose-500/20 border-rose-500/40 text-rose-200 hover:border-rose-400';
  }
  if (r <= -0.3) {
    return 'bg-rose-500/10 border-rose-500/25 text-rose-300 hover:border-rose-400/60';
  }
  if (r >= 0.65) {
    return 'bg-emerald-500/20 border-emerald-500/40 text-emerald-200 hover:border-emerald-400';
  }
  if (r >= 0.3) {
    return 'bg-emerald-500/10 border-emerald-500/25 text-emerald-300 hover:border-emerald-400/60';
  }
  return 'bg-slate-800/60 border-slate-700 text-slate-300 hover:border-slate-500';
}

export const TradeCorrelationMatrixPanel: React.FC<TradeCorrelationMatrixPanelProps> = ({
  quotes,
  candles = [],
}) => {
  const [windowHorizon, setWindowHorizon] = useState<CorrelationWindow>('30D');
  const [selectedPairId, setSelectedPairId] = useState<MacroInterdependencyPair['pairId']>('XAUUSD_DXY');
  const [serverReport, setServerReport] = useState<MacroCorrelationMatrixReport | null>(null);

  const localReport = useMemo(
    () => calculateMacroCorrelationMatrix(quotes, candles, windowHorizon),
    [quotes, candles, windowHorizon]
  );

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/macro/correlations?window=${windowHorizon}`)
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (!cancelled && data?.success && data.report) {
          setServerReport(data.report);
        }
      })
      .catch(() => {
        // Keep deterministic client calculation cleanly active if offline
      });
    return () => {
      cancelled = true;
    };
  }, [windowHorizon, quotes.XAUUSD?.mid, quotes.DXY?.mid, quotes.US10Y?.mid]);

  const report =
    serverReport && serverReport.window === windowHorizon ? serverReport : localReport;

  const selectedInsight =
    report.interdependencies.find((p) => p.pairId === selectedPairId) ||
    report.interdependencies[0];

  return (
    <section
      aria-label="Trade Correlation Matrix"
      className="bg-slate-900 border border-slate-800 rounded-lg p-5 space-y-5"
    >
      {/* Header & Rolling Horizon Selector */}
      <div className="flex flex-wrap items-center justify-between gap-4 pb-3 border-b border-slate-800">
        <div>
          <h3 className="text-base font-bold text-slate-100 flex items-center gap-2">
            <GitCompare className="w-4 h-4 text-amber-400 shrink-0" aria-hidden="true" />
            <span>Trade Correlation Matrix</span>
          </h3>
          <div className="flex flex-wrap items-center gap-2 text-xs text-slate-400 mt-1">
            <span>XAU/USD vs DXY vs US 10Y Treasury Yield</span>
            <span aria-hidden="true">·</span>
            <span className="font-mono tabular-nums">{report.windowBars}-Session Pearson r</span>
            <span aria-hidden="true">·</span>
            <span>Real-time macro interdependency</span>
          </div>
        </div>

        {/* Interactive Rolling Window Segmented Buttons */}
        <div
          role="group"
          aria-label="Correlation lookback window"
          className="flex items-center gap-1 p-1 bg-slate-950 border border-slate-800 rounded-lg"
        >
          {WINDOW_OPTIONS.map((opt) => {
            const active = windowHorizon === opt.id;
            return (
              <button
                key={opt.id}
                type="button"
                onClick={() => setWindowHorizon(opt.id)}
                aria-pressed={active}
                className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                  active
                    ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40 font-semibold'
                    : 'text-slate-400 hover:text-slate-200 border border-transparent'
                }`}
              >
                {opt.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Live Underlying Reference Bar */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {report.assets.map((asset) => {
          const isPositive = asset.change24hPct > 0;
          const isNegative = asset.change24hPct < 0;
          return (
            <div
              key={asset.key}
              className="bg-slate-950/70 border border-slate-800 rounded-lg px-3.5 py-2.5 flex items-center justify-between gap-3"
            >
              <div>
                <div className="text-xs font-semibold text-slate-200">{asset.symbol}</div>
                <div className="text-[11px] text-slate-400">{asset.name}</div>
              </div>
              <div className="text-right font-mono tabular-nums">
                <div className="text-sm font-bold text-slate-100">
                  {asset.key === 'XAUUSD'
                    ? `$${asset.price.toFixed(2)}`
                    : asset.key === 'US10Y'
                    ? `${asset.price.toFixed(3)}%`
                    : asset.price.toFixed(2)}
                </div>
                <div
                  className={`text-[11px] inline-flex items-center gap-0.5 ${
                    isPositive ? 'text-emerald-400' : isNegative ? 'text-rose-400' : 'text-slate-400'
                  }`}
                >
                  {isPositive ? (
                    <ArrowUpRight className="w-3 h-3" aria-hidden="true" />
                  ) : isNegative ? (
                    <ArrowDownRight className="w-3 h-3" aria-hidden="true" />
                  ) : (
                    <Minus className="w-3 h-3" aria-hidden="true" />
                  )}
                  <span>
                    {asset.change24hPct >= 0 ? '+' : ''}
                    {asset.change24hPct.toFixed(2)}% (24h)
                  </span>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Main Split: 3x3 Heatmap Table + Pair Interdependency Inspector */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-stretch">
        {/* Left 7 Columns: 3x3 Pearson Matrix Grid */}
        <div className="lg:col-span-7 flex flex-col justify-between space-y-3">
          <div className="overflow-x-auto">
            <table className="w-full border-separate border-spacing-2 text-xs">
              <thead>
                <tr>
                  <th className="text-left text-[11px] font-medium text-slate-400 px-2 py-1">
                    Asset Pair
                  </th>
                  {ASSET_ORDER.map((colKey) => (
                    <th
                      key={colKey}
                      className="text-center text-xs font-semibold text-slate-200 px-2 py-1 whitespace-nowrap"
                    >
                      {ASSET_LABELS[colKey]}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {ASSET_ORDER.map((rowKey) => (
                  <tr key={rowKey}>
                    <th className="text-left text-xs font-semibold text-slate-200 px-2 py-2 whitespace-nowrap">
                      {ASSET_LABELS[rowKey]}
                    </th>
                    {ASSET_ORDER.map((colKey) => {
                      const cell = report.matrix[rowKey][colKey];
                      const isDiagonal = rowKey === colKey;
                      const pairId = getPairIdForAssets(rowKey, colKey);
                      const isSelected = pairId !== null && pairId === selectedPairId;
                      const formattedR = `${cell.coefficient >= 0 ? '+' : ''}${cell.coefficient.toFixed(2)}`;

                      return (
                        <td key={`${rowKey}_${colKey}`} className="p-0">
                          {isDiagonal ? (
                            <div
                              className={`rounded-lg border px-3 py-3 text-center ${getHeatmapCellStyle(
                                cell,
                                true
                              )}`}
                            >
                              <div className="font-mono tabular-nums text-sm font-bold">+1.00</div>
                              <div className="text-[10px] text-slate-500 mt-0.5">Identity</div>
                            </div>
                          ) : (
                            <button
                              type="button"
                              onClick={() => pairId && setSelectedPairId(pairId)}
                              aria-pressed={isSelected}
                              className={`w-full rounded-lg border px-3 py-3 text-center transition-colors cursor-pointer ${getHeatmapCellStyle(
                                cell,
                                false
                              )} ${isSelected ? 'ring-2 ring-amber-400/70' : ''}`}
                              title={`Inspect ${ASSET_LABELS[rowKey]} vs ${ASSET_LABELS[colKey]} (${cell.regimeLabel})`}
                            >
                              <div className="font-mono tabular-nums text-sm font-bold">
                                {formattedR}
                              </div>
                              <div className="text-[10px] font-medium mt-0.5 whitespace-nowrap">
                                {cell.regimeLabel}
                              </div>
                            </button>
                          )}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="text-xs text-slate-400 pt-2 border-t border-slate-800/80 flex flex-wrap items-center justify-between gap-2">
            <span>{report.macroRegimeVerdict}</span>
            <span className="font-mono text-[11px] text-slate-500 tabular-nums">
              Scale: -1.00 Inverse · 0.00 Decoupled · +1.00 Positive
            </span>
          </div>
        </div>

        {/* Right 5 Columns: Selected Pair Deep Dive & Interdependency Channels */}
        <div className="lg:col-span-5 bg-slate-950/70 border border-slate-800 rounded-lg p-4 flex flex-col justify-between space-y-4">
          <div className="space-y-3">
            <div className="flex items-start justify-between gap-3 pb-2.5 border-b border-slate-800">
              <div>
                <div className="text-xs font-medium text-amber-400">{selectedInsight.channelName}</div>
                <h4 className="text-sm font-bold text-slate-100 mt-0.5">{selectedInsight.label}</h4>
              </div>
              <div className="text-right font-mono tabular-nums">
                <div
                  className={`text-lg font-bold ${
                    selectedInsight.coefficient <= -0.3
                      ? 'text-rose-400'
                      : selectedInsight.coefficient >= 0.3
                      ? 'text-emerald-400'
                      : 'text-slate-300'
                  }`}
                >
                  {selectedInsight.coefficient >= 0 ? '+' : ''}
                  {selectedInsight.coefficient.toFixed(2)}
                </div>
                <div className="text-[11px] text-slate-400">{selectedInsight.regimeLabel}</div>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-2 text-xs font-mono tabular-nums">
              <div className="py-1.5">
                <div className="text-[10px] text-slate-500">Explained R²</div>
                <div className="text-sm font-semibold text-slate-200 mt-0.5">
                  {selectedInsight.rSquaredPct}%
                </div>
              </div>
              <div className="py-1.5">
                <div className="text-[10px] text-slate-500">5Y Norm r</div>
                <div className="text-sm font-semibold text-slate-200 mt-0.5">
                  {selectedInsight.historicalNorm5Y >= 0 ? '+' : ''}
                  {selectedInsight.historicalNorm5Y.toFixed(2)}
                </div>
              </div>
              <div className="py-1.5">
                <div className="text-[10px] text-slate-500">Regime Delta</div>
                <div
                  className={`text-sm font-semibold mt-0.5 ${
                    selectedInsight.regimeAlert === 'DIVERGING' ? 'text-amber-400' : 'text-emerald-400'
                  }`}
                >
                  {selectedInsight.deviationFromNorm >= 0 ? '+' : ''}
                  {selectedInsight.deviationFromNorm.toFixed(2)} ({selectedInsight.regimeAlert})
                </div>
              </div>
            </div>

            <p className="text-xs text-slate-300 leading-relaxed">
              {selectedInsight.tradingImplication}
            </p>
          </div>

          {/* Interactive 3-Row Channel Switcher */}
          <div className="pt-3 border-t border-slate-800 space-y-1.5">
            {report.interdependencies.map((item) => {
              const active = item.pairId === selectedInsight.pairId;
              return (
                <button
                  key={item.pairId}
                  type="button"
                  onClick={() => setSelectedPairId(item.pairId)}
                  className={`w-full flex items-center justify-between gap-2 px-2.5 py-2 rounded text-xs transition-colors cursor-pointer ${
                    active
                      ? 'bg-slate-800 text-slate-100'
                      : 'text-slate-400 hover:bg-slate-900 hover:text-slate-200'
                  }`}
                >
                  <span className="font-medium text-left truncate">{item.label}</span>
                  <span className="font-mono tabular-nums shrink-0 flex items-center gap-2">
                    <span
                      className={
                        item.coefficient <= -0.3
                          ? 'text-rose-400'
                          : item.coefficient >= 0.3
                          ? 'text-emerald-400'
                          : 'text-slate-300'
                      }
                    >
                      {item.coefficient >= 0 ? '+' : ''}
                      {item.coefficient.toFixed(2)}
                    </span>
                    <span className="text-[11px] text-slate-500">{item.regimeAlert}</span>
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </section>
  );
};
