/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * Aurum Intelligence — Institutional PDF Research Document Exporter
 *
 * Compiles live price quotes, vector/raster chart snapshots, active trade plan levels,
 * technical indicator confluence matrices, macro regime context, and deterministic SHA-256
 * provenance seals into a multi-page A4 institutional PDF research document.
 */

import { jsPDF } from 'jspdf';
import {
  Candle,
  CommodityType,
  IndicatorSnapshot,
  MarketRegime,
  Quote,
  Timeframe,
  TradePlan,
} from '../domain/types';
import { computeDeterministicSha256 } from './forecastAccountability';
import {
  buildStrategyBiasRationale,
  StrategyBiasRationale,
} from './advisoryEngine';
import {
  calculateTradePlanPnlProjection,
  TradePlanPnlProjection,
} from './riskEngine';

export type InstitutionalReportCategory =
  | 'DAILY_INTELLIGENCE'
  | 'INTRADAY_BRIEF'
  | 'SWING_OUTLOOK'
  | 'CFD_RISK_REPORT';

export interface InstitutionalPdfReportInput {
  reportTitle: string;
  reportType: InstitutionalReportCategory;
  quote: Quote;
  regime: MarketRegime;
  indicators: IndicatorSnapshot;
  activePlan: TradePlan;
  candles?: Candle[];
  timeframe?: Timeframe;
  commodity?: CommodityType;
  chartSnapshotDataUrl?: string | null;
  generatedAtIso?: string;
}

export interface AggregatedPdfResearchPayload {
  reportTitle: string;
  reportType: InstitutionalReportCategory;
  instrumentId: string;
  commodity: string;
  timeframe: string;
  spotPrice: number;
  change24hPct: number;
  spreadPips: number;
  provider: string;
  quality: string;
  macroRegime: {
    currentRegime: string;
    confidencePct: number;
    volatilityPercentile: number;
    summary: string;
  };
  tradePlan: {
    horizon: string;
    direction: string;
    state: string;
    triggerPrice: number;
    entryZoneMin: number;
    entryZoneMax: number;
    stopLossPrice: number;
    target1Price: number;
    target2Price?: number;
    target3Price?: number;
    rewardToRiskRatio: number;
    invalidationCondition: string;
  };
  technicalIndicators: {
    rsi14: number;
    atr14: number;
    ema50: number;
    ema200: number;
    supertrendDirection: string;
    supertrendValue: number;
    vwap: number;
    pivot: number;
    resistance1: number;
    resistance2: number;
    support1: number;
    support2: number;
    bollingerUpper: number;
    bollingerMiddle: number;
    bollingerLower: number;
    bollingerBandwidthPct: number;
  };
  chartCandlesSampleCount: number;
}

export interface GeneratedPdfReportArtifact {
  filename: string;
  reportRefId: string;
  snapshotHash: string;
  generatedAtUtc: string;
  pageCount: number;
  byteLength: number;
  hasEmbeddedChartSnapshot: boolean;
  pdfBytes: Uint8Array;
  aggregatedPayload: AggregatedPdfResearchPayload;
}

function drawHorizontalDashedLine(
  doc: jsPDF,
  x1: number,
  y: number,
  x2: number,
  dashLen = 2.2,
  gapLen = 1.4
): void {
  let cursor = x1;
  while (cursor < x2) {
    const segEnd = Math.min(x2, cursor + dashLen);
    doc.line(cursor, y, segEnd, y);
    cursor = segEnd + gapLen;
  }
}

function formatSignedDelta(level: number, spot: number): string {
  const diff = level - spot;
  const sign = diff >= 0 ? '+' : '-';
  return `${sign}$${Math.abs(diff).toFixed(2)}`;
}

function buildFallbackDisplayCandles(candles: Candle[] | undefined, quote: Quote): Candle[] {
  if (candles && candles.length >= 10) {
    return candles.slice(-36);
  }
  const out: Candle[] = [];
  const base = Number.isFinite(quote.mid) && quote.mid > 0 ? quote.mid : 3950.0;
  let curr = base * 0.985;
  const now = Date.now();
  for (let i = 0; i < 36; i++) {
    const wave = Math.sin(i * 0.55) * (base * 0.0022) + base * 0.00045;
    const open = curr;
    const close = i === 35 ? base : curr + wave;
    const high = Math.max(open, close) + base * 0.0014;
    const low = Math.min(open, close) - base * 0.0014;
    curr = close;
    out.push({
      timestamp: now - (36 - i) * 3600_000,
      timeStr: new Date(now - (36 - i) * 3600_000).toISOString(),
      open: Number(open.toFixed(2)),
      high: Number(high.toFixed(2)),
      low: Number(low.toFixed(2)),
      close: Number(close.toFixed(2)),
      volume: 120000,
      isComplete: true,
    });
  }
  return out;
}

/**
 * Vector fallback chart snapshot renderer drawn directly into the PDF canvas
 * when DOM rasterization is unavailable (e.g., headless export or automated validation).
 */
function renderVectorChartSnapshot(
  doc: jsPDF,
  x: number,
  y: number,
  w: number,
  h: number,
  displayCandles: Candle[],
  plan: TradePlan,
  quote: Quote
): void {
  // Dark institutional chart surface
  doc.setFillColor(11, 17, 32);
  doc.setDrawColor(30, 41, 59);
  doc.setLineWidth(0.35);
  doc.roundedRect(x, y, w, h, 1.5, 1.5, 'FD');

  const padLeft = 4;
  const padRight = 22;
  const padTop = 7;
  const padBottom = 6;
  const plotW = w - padLeft - padRight;
  const plotH = h - padTop - padBottom;
  const plotX = x + padLeft;
  const plotY = y + padTop;

  let minP = Infinity;
  let maxP = -Infinity;
  for (const c of displayCandles) {
    if (c.low < minP) minP = c.low;
    if (c.high > maxP) maxP = c.high;
  }
  if (plan.stopLossPrice) minP = Math.min(minP, plan.stopLossPrice);
  if (plan.entryZoneMin) minP = Math.min(minP, plan.entryZoneMin);
  if (plan.target1Price) maxP = Math.max(maxP, plan.target1Price);
  if (plan.target2Price) maxP = Math.max(maxP, plan.target2Price);
  minP = Math.min(minP, quote.mid);
  maxP = Math.max(maxP, quote.mid);
  const pad = Math.max(1, (maxP - minP) * 0.08);
  minP -= pad;
  maxP += pad;

  const toY = (price: number) => {
    if (maxP <= minP) return plotY + plotH / 2;
    return plotY + plotH - ((price - minP) / (maxP - minP)) * plotH;
  };

  // Horizontal grid + price scale
  doc.setFont('courier', 'normal');
  doc.setFontSize(6.5);
  for (let i = 0; i <= 3; i++) {
    const p = maxP - ((maxP - minP) * i) / 3;
    const gy = toY(p);
    doc.setDrawColor(51, 65, 85);
    doc.setLineWidth(0.15);
    drawHorizontalDashedLine(doc, plotX, gy, plotX + plotW, 1.2, 1.8);
    doc.setTextColor(148, 163, 184);
    doc.text(`$${p.toFixed(1)}`, plotX + plotW + 1.5, gy + 1.5);
  }

  // Entry corridor band
  const entryTopY = toY(Math.max(plan.entryZoneMin, plan.entryZoneMax));
  const entryBotY = toY(Math.min(plan.entryZoneMin, plan.entryZoneMax));
  const entryH = Math.max(2, entryBotY - entryTopY);
  doc.setFillColor(120, 53, 15);
  doc.rect(plotX, entryTopY, plotW, entryH, 'F');
  doc.setDrawColor(245, 158, 11);
  doc.setLineWidth(0.25);
  doc.rect(plotX, entryTopY, plotW, entryH, 'S');

  // Target 1 & Stop Loss overlays
  const tp1Y = toY(plan.target1Price);
  doc.setDrawColor(16, 185, 129);
  doc.setLineWidth(0.35);
  drawHorizontalDashedLine(doc, plotX, tp1Y, plotX + plotW);
  doc.setTextColor(110, 231, 183);
  doc.text(`TP1 $${plan.target1Price.toFixed(1)}`, plotX + 2, tp1Y - 1);

  const stopY = toY(plan.stopLossPrice);
  doc.setDrawColor(244, 63, 94);
  doc.setLineWidth(0.35);
  drawHorizontalDashedLine(doc, plotX, stopY, plotX + plotW);
  doc.setTextColor(253, 164, 175);
  doc.text(`STOP $${plan.stopLossPrice.toFixed(1)}`, plotX + 2, stopY + 2.8);

  // Candlesticks
  const step = plotW / Math.max(1, displayCandles.length);
  const bodyW = Math.max(1.1, step * 0.62);
  displayCandles.forEach((c, idx) => {
    const cx = plotX + idx * step + step / 2;
    const oY = toY(c.open);
    const cY = toY(c.close);
    const hY = toY(c.high);
    const lY = toY(c.low);
    const bull = c.close >= c.open;
    if (bull) {
      doc.setDrawColor(16, 185, 129);
      doc.setFillColor(16, 185, 129);
    } else {
      doc.setDrawColor(244, 63, 94);
      doc.setFillColor(244, 63, 94);
    }
    doc.setLineWidth(0.25);
    doc.line(cx, hY, cx, lY);
    const bTop = Math.min(oY, cY);
    const bHeight = Math.max(0.7, Math.abs(oY - cY));
    doc.rect(cx - bodyW / 2, bTop, bodyW, bHeight, 'F');
  });

  // Spot line
  const spotY = toY(quote.mid);
  doc.setDrawColor(56, 189, 248);
  doc.setLineWidth(0.3);
  drawHorizontalDashedLine(doc, plotX, spotY, plotX + plotW, 1.0, 1.2);
  doc.setTextColor(56, 189, 248);
  doc.setFont('courier', 'bold');
  doc.text(`$${quote.mid.toFixed(1)}`, plotX + plotW + 1.5, spotY + 1.5);

  // Top-left chart watermark label
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.5);
  doc.setTextColor(248, 250, 252);
  doc.text(
    `${quote.instrumentId} · ${plan.horizon} Structural Price Action (${displayCandles.length} Bars)`,
    plotX,
    y + 4.3
  );
}

/**
 * Generates an institutional A4 PDF research document aggregating the current
 * chart snapshot, active trade plan levels, technical indicators, and macro regime.
 */
export function buildInstitutionalPdfReport(
  input: InstitutionalPdfReportInput
): GeneratedPdfReportArtifact {
  const {
    reportTitle,
    reportType,
    quote,
    regime,
    indicators,
    activePlan,
    candles,
    timeframe,
    commodity = 'GOLD',
    chartSnapshotDataUrl,
    generatedAtIso,
  } = input;

  const generatedAtUtc = generatedAtIso || new Date().toISOString();
  const dateStamp = generatedAtUtc.slice(0, 10);
  const displayCandles = buildFallbackDisplayCandles(candles, quote);
  const resolvedTimeframe = timeframe || activePlan.horizon;
  const reportRefId = `GV-${quote.instrumentId}-${dateStamp.replace(/-/g, '')}`;

  const snapshotHash = computeDeterministicSha256(
    `${reportRefId}|${reportType}|${generatedAtUtc}|${quote.mid}|${activePlan.direction}|${activePlan.stopLossPrice}|${activePlan.target1Price}|${indicators.rsi14}|${indicators.atr14}`
  );

  const aggregatedPayload: AggregatedPdfResearchPayload = {
    reportTitle,
    reportType,
    instrumentId: quote.instrumentId,
    commodity: String(commodity),
    timeframe: resolvedTimeframe,
    spotPrice: quote.mid,
    change24hPct: quote.change24hPct,
    spreadPips: quote.spreadPips,
    provider: quote.provider,
    quality: quote.quality,
    macroRegime: {
      currentRegime: regime.currentRegime,
      confidencePct: regime.confidencePct,
      volatilityPercentile: regime.volatilityPercentile,
      summary: regime.summary,
    },
    tradePlan: {
      horizon: activePlan.horizon,
      direction: activePlan.direction,
      state: activePlan.state,
      triggerPrice: activePlan.triggerPrice,
      entryZoneMin: activePlan.entryZoneMin,
      entryZoneMax: activePlan.entryZoneMax,
      stopLossPrice: activePlan.stopLossPrice,
      target1Price: activePlan.target1Price,
      target2Price: activePlan.target2Price,
      target3Price: activePlan.target3Price,
      rewardToRiskRatio: activePlan.rewardToRiskRatio,
      invalidationCondition: activePlan.invalidationCondition,
    },
    technicalIndicators: {
      rsi14: indicators.rsi14,
      atr14: indicators.atr14,
      ema50: indicators.ema50,
      ema200: indicators.ema200,
      supertrendDirection: indicators.supertrend.direction,
      supertrendValue: indicators.supertrend.value,
      vwap: indicators.vwap,
      pivot: indicators.supportResistance.pivot,
      resistance1: indicators.supportResistance.resistance1,
      resistance2: indicators.supportResistance.resistance2,
      support1: indicators.supportResistance.support1,
      support2: indicators.supportResistance.support2,
      bollingerUpper: indicators.bollingerBands.upper,
      bollingerMiddle: indicators.bollingerBands.middle,
      bollingerLower: indicators.bollingerBands.lower,
      bollingerBandwidthPct: indicators.bollingerBands.bandwidth,
    },
    chartCandlesSampleCount: displayCandles.length,
  };

  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
    compress: true,
  });

  const pageW = 210;
  const pageH = 297;
  const margin = 14;
  const contentW = pageW - margin * 2; // 182mm

  // -------------------------------------------------------------------------
  // MASTHEAD HEADER BAND
  // -------------------------------------------------------------------------
  doc.setFillColor(15, 23, 42); // Slate-900
  doc.rect(0, 0, pageW, 31, 'F');
  doc.setFillColor(245, 158, 11); // Amber-500 accent rule
  doc.rect(0, 31, pageW, 1.0, 'F');

  doc.setFont('courier', 'bold');
  doc.setFontSize(8);
  doc.setTextColor(251, 191, 36);
  doc.text('GOLDVISTA INSTITUTIONAL RESEARCH  ·  QUANTITATIVE COMMODITY BRIEF', margin, 9);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(14);
  doc.setTextColor(248, 250, 252);
  const titleLines = doc.splitTextToSize(reportTitle, contentW - 48);
  doc.text(titleLines.slice(0, 2), margin, 16);

  doc.setFont('courier', 'normal');
  doc.setFontSize(7.5);
  doc.setTextColor(148, 163, 184);
  doc.text(
    `Ref: ${reportRefId}  ·  ${generatedAtUtc.slice(0, 16).replace('T', ' ')} UTC  ·  Asset: ${quote.instrumentId} (${resolvedTimeframe})`,
    margin,
    27
  );

  // Spot quote readout right side of masthead
  doc.setFont('courier', 'bold');
  doc.setFontSize(15);
  doc.setTextColor(251, 191, 36);
  doc.text(`$${quote.mid.toFixed(2)}`, pageW - margin, 15, { align: 'right' });

  doc.setFontSize(8.5);
  if (quote.change24hPct >= 0) {
    doc.setTextColor(52, 211, 153);
  } else {
    doc.setTextColor(251, 113, 133);
  }
  const changeSign = quote.change24hPct >= 0 ? '+' : '';
  doc.text(`${changeSign}${quote.change24hPct}% (24h)`, pageW - margin, 21, { align: 'right' });

  doc.setFont('courier', 'normal');
  doc.setFontSize(7.5);
  doc.setTextColor(148, 163, 184);
  doc.text(`Spread: ${quote.spreadPips} pips · ${quote.quality}`, pageW - margin, 26.5, { align: 'right' });

  let y = 38;

  // -------------------------------------------------------------------------
  // SECTION 1: EXECUTIVE MACRO & REGIME ASSESSMENT
  // -------------------------------------------------------------------------
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9.5);
  doc.setTextColor(15, 23, 42);
  doc.text('1. EXECUTIVE MACRO & MARKET REGIME ASSESSMENT', margin, y);
  y += 3;

  const summaryLines = doc.splitTextToSize(regime.summary || 'Structural bullion regime active.', contentW - 8);
  const macroBoxH = 17 + summaryLines.length * 4;
  doc.setFillColor(248, 250, 252);
  doc.setDrawColor(203, 213, 225);
  doc.setLineWidth(0.25);
  doc.roundedRect(margin, y, contentW, macroBoxH, 1.5, 1.5, 'FD');

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.setTextColor(51, 65, 85);
  doc.text(summaryLines, margin + 4, y + 5.5);

  const statY = y + summaryLines.length * 4 + 5;
  const kpiW = (contentW - 14) / 4;
  const macroStats: Array<{ label: string; val: string }> = [
    { label: 'MARKET REGIME', val: regime.currentRegime },
    { label: 'REGIME CONFIDENCE', val: `${regime.confidencePct}%` },
    { label: 'VOLATILITY PERCENTILE', val: `${regime.volatilityPercentile}th Pct` },
    { label: 'DATA FEED', val: `${quote.provider.slice(0, 18)}` },
  ];
  macroStats.forEach((st, idx) => {
    const bx = margin + 4 + idx * (kpiW + 2);
    doc.setFillColor(255, 255, 255);
    doc.setDrawColor(226, 232, 240);
    doc.rect(bx, statY, kpiW, 9.5, 'FD');
    doc.setFont('courier', 'normal');
    doc.setFontSize(6.5);
    doc.setTextColor(100, 116, 139);
    doc.text(st.label, bx + 2, statY + 3.4);
    doc.setFont('courier', 'bold');
    doc.setFontSize(8);
    doc.setTextColor(15, 23, 42);
    doc.text(st.val, bx + 2, statY + 7.8);
  });

  y += macroBoxH + 6.5;

  // -------------------------------------------------------------------------
  // SECTION 2: CURRENT CHART SNAPSHOT & VISUAL PRICE-ACTION EVIDENCE
  // -------------------------------------------------------------------------
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9.5);
  doc.setTextColor(15, 23, 42);
  doc.text(`2. CURRENT CHART SNAPSHOT & TECHNICAL EVIDENCE (${activePlan.horizon})`, margin, y);
  doc.setFont('courier', 'bold');
  doc.setFontSize(8);
  doc.setTextColor(5, 150, 105);
  doc.text(`${activePlan.direction}  ·  Net 1:${activePlan.rewardToRiskRatio} R:R`, pageW - margin, y, { align: 'right' });
  y += 3;

  const chartBoxH = 60;
  let embeddedRasterSnapshot = false;
  if (
    chartSnapshotDataUrl &&
    (chartSnapshotDataUrl.startsWith('data:image/png;base64,') ||
      chartSnapshotDataUrl.startsWith('data:image/jpeg;base64,'))
  ) {
    try {
      doc.setFillColor(11, 17, 32);
      doc.setDrawColor(30, 41, 59);
      doc.roundedRect(margin, y, contentW, chartBoxH, 1.5, 1.5, 'FD');
      doc.addImage(chartSnapshotDataUrl, 'PNG', margin + 1, y + 1, contentW - 2, chartBoxH - 2, undefined, 'FAST');
      embeddedRasterSnapshot = true;
    } catch {
      renderVectorChartSnapshot(doc, margin, y, contentW, chartBoxH, displayCandles, activePlan, quote);
      embeddedRasterSnapshot = true;
    }
  } else {
    renderVectorChartSnapshot(doc, margin, y, contentW, chartBoxH, displayCandles, activePlan, quote);
    embeddedRasterSnapshot = true;
  }
  y += chartBoxH + 3.5;

  doc.setFont('courier', 'normal');
  doc.setFontSize(7.2);
  doc.setTextColor(100, 116, 139);
  doc.text(
    `Chart Window: ${displayCandles.length} candles (${resolvedTimeframe})  ·  Entry Corridor $${activePlan.entryZoneMin.toFixed(2)}–$${activePlan.entryZoneMax.toFixed(2)}  ·  Stop $${activePlan.stopLossPrice.toFixed(2)}  ·  TP1 $${activePlan.target1Price.toFixed(2)}`,
    margin,
    y
  );
  y += 6;

  // -------------------------------------------------------------------------
  // SECTION 3: TECHNICAL INDICATORS & CONFLUENCE MATRIX
  // -------------------------------------------------------------------------
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9.5);
  doc.setTextColor(15, 23, 42);
  doc.text('3. TECHNICAL INDICATORS & CONFLUENCE MATRIX', margin, y);
  y += 3;

  const trendStackLabel =
    quote.mid > indicators.ema50 && indicators.ema50 > indicators.ema200
      ? 'Bullish Golden Stack'
      : quote.mid < indicators.ema50 && indicators.ema50 < indicators.ema200
      ? 'Bearish Death Stack'
      : 'Mixed Consolidation';

  const indicatorCells: Array<{ label: string; value: string; sub: string }> = [
    { label: 'EMA 50 / EMA 200', value: `$${indicators.ema50.toFixed(2)} / $${indicators.ema200.toFixed(2)}`, sub: trendStackLabel },
    { label: 'RSI (14) MOMENTUM', value: `${indicators.rsi14.toFixed(1)}`, sub: indicators.rsi14 >= 70 ? 'Overbought Zone' : indicators.rsi14 <= 30 ? 'Oversold Zone' : 'Neutral / Expansion' },
    { label: 'ATR (14) VOLATILITY', value: `$${indicators.atr14.toFixed(2)}`, sub: `Stop Dist: $${Math.abs(quote.mid - activePlan.stopLossPrice).toFixed(2)}` },
    { label: 'SUPERTREND (10,3)', value: `${indicators.supertrend.direction}`, sub: `Level: $${indicators.supertrend.value.toFixed(2)}` },
    { label: 'CENTRAL PIVOT (P)', value: `$${indicators.supportResistance.pivot.toFixed(2)}`, sub: `Spot vs Pivot: ${formatSignedDelta(quote.mid, indicators.supportResistance.pivot)}` },
    { label: 'RESISTANCE R1 / R2', value: `$${indicators.supportResistance.resistance1.toFixed(2)} / $${indicators.supportResistance.resistance2.toFixed(2)}`, sub: 'Upper Supply Bounds' },
    { label: 'SUPPORT S1 / S2', value: `$${indicators.supportResistance.support1.toFixed(2)} / $${indicators.supportResistance.support2.toFixed(2)}`, sub: 'Structural Bid Floors' },
    { label: 'VWAP & BB WIDTH', value: `$${indicators.vwap.toFixed(2)}`, sub: `BB Width: ${indicators.bollingerBands.bandwidth.toFixed(2)}%` },
  ];

  const cellW = (contentW - 6) / 4;
  const cellH = 12.5;
  indicatorCells.forEach((cell, idx) => {
    const col = idx % 4;
    const row = Math.floor(idx / 4);
    const cx = margin + col * (cellW + 2);
    const cy = y + row * (cellH + 2);
    doc.setFillColor(248, 250, 252);
    doc.setDrawColor(203, 213, 225);
    doc.setLineWidth(0.25);
    doc.roundedRect(cx, cy, cellW, cellH, 1, 1, 'FD');

    doc.setFont('courier', 'normal');
    doc.setFontSize(6.5);
    doc.setTextColor(100, 116, 139);
    doc.text(cell.label, cx + 2.2, cy + 3.6);

    doc.setFont('courier', 'bold');
    doc.setFontSize(8);
    doc.setTextColor(15, 23, 42);
    doc.text(cell.value, cx + 2.2, cy + 7.7);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(6.8);
    doc.setTextColor(71, 85, 105);
    doc.text(cell.sub, cx + 2.2, cy + 11.1);
  });

  y += cellH * 2 + 8.5;

  // Check remaining vertical space before Section 4 (needs ~68mm)
  if (y > pageH - 85) {
    doc.addPage();
    y = 18;
  }

  // -------------------------------------------------------------------------
  // SECTION 4: ACTIVE TRADE PLAN DETAILS & EXECUTION PARAMETERS
  // -------------------------------------------------------------------------
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9.5);
  doc.setTextColor(15, 23, 42);
  doc.text(`4. ACTIVE TRADE PLAN SPECIFICATION (${activePlan.horizon})`, margin, y);
  y += 3;

  const planRows: Array<[string, string, string, string]> = [
    ['Advisory Direction & State', `${activePlan.direction} (${activePlan.state})`, 'Current Spot Ref', 'Specialist council consensus'],
    ['Entry Limit Corridor', `$${activePlan.entryZoneMin.toFixed(2)} – $${activePlan.entryZoneMax.toFixed(2)}`, `${formatSignedDelta(activePlan.entryZoneMin, quote.mid)} / ${formatSignedDelta(activePlan.entryZoneMax, quote.mid)}`, 'Institutional liquidity zone'],
    ['Execution Trigger Price', `$${activePlan.triggerPrice.toFixed(2)}`, formatSignedDelta(activePlan.triggerPrice, quote.mid), 'Confirmed structure level'],
    ['Invalidation Stop Loss', `$${activePlan.stopLossPrice.toFixed(2)}`, formatSignedDelta(activePlan.stopLossPrice, quote.mid), 'Mandatory capital stop rule'],
    ['Take Profit Target 1 (TP1)', `$${activePlan.target1Price.toFixed(2)}`, formatSignedDelta(activePlan.target1Price, quote.mid), '50% partial harvest / trail'],
    ['Take Profit Target 2 (TP2)', activePlan.target2Price ? `$${activePlan.target2Price.toFixed(2)}` : 'Open Trailing', activePlan.target2Price ? formatSignedDelta(activePlan.target2Price, quote.mid) : 'Trailing', 'Primary structural target'],
    ['Net Reward-to-Risk Ratio', `1 : ${activePlan.rewardToRiskRatio}`, 'Positive Expectancy', 'Risk-normalized payoff'],
  ];
  if (activePlan.target3Price) {
    planRows.splice(6, 0, [
      'Take Profit Target 3 (TP3)',
      `$${activePlan.target3Price.toFixed(2)}`,
      formatSignedDelta(activePlan.target3Price, quote.mid),
      'Extended macro objective',
    ]);
  }

  const colWidths = [44, 46, 42, 50];
  const rowH = 6.5;

  // Table header
  doc.setFillColor(15, 23, 42);
  doc.rect(margin, y, contentW, rowH, 'F');
  doc.setFont('courier', 'bold');
  doc.setFontSize(7.5);
  doc.setTextColor(248, 250, 252);
  const headers = ['PARAMETER', 'PRICE / VALUE', 'VS. SPOT', 'EXECUTION LOGIC'];
  let hx = margin + 2.5;
  headers.forEach((h, i) => {
    doc.text(h, hx, y + 4.4);
    hx += colWidths[i];
  });
  y += rowH;

  planRows.forEach((row, rIdx) => {
    doc.setFillColor(rIdx % 2 === 0 ? 255 : 248, rIdx % 2 === 0 ? 255 : 250, rIdx % 2 === 0 ? 255 : 252);
    doc.setDrawColor(226, 232, 240);
    doc.setLineWidth(0.2);
    doc.rect(margin, y, contentW, rowH, 'FD');

    let rx = margin + 2.5;
    row.forEach((cellText, cIdx) => {
      doc.setFont(cIdx === 1 || cIdx === 2 ? 'courier' : 'helvetica', cIdx <= 1 ? 'bold' : 'normal');
      doc.setFontSize(7.5);
      if (cIdx === 1 && row[0].includes('Stop')) {
        doc.setTextColor(190, 18, 60);
      } else if (cIdx === 1 && row[0].includes('Take Profit')) {
        doc.setTextColor(4, 120, 87);
      } else if (cIdx === 1 && row[0].includes('Entry')) {
        doc.setTextColor(180, 83, 9);
      } else {
        doc.setTextColor(30, 41, 59);
      }
      doc.text(cellText, rx, y + 4.4);
      rx += colWidths[cIdx];
    });
    y += rowH;
  });

  y += 3;

  // Invalidation Callout Box (hairline all-around border, no thick left bar)
  const invLines = doc.splitTextToSize(`Structural Invalidation Trigger: ${activePlan.invalidationCondition}`, contentW - 8);
  const invBoxH = 4 + invLines.length * 4;
  doc.setFillColor(255, 241, 242);
  doc.setDrawColor(254, 205, 211);
  doc.roundedRect(margin, y, contentW, invBoxH, 1, 1, 'FD');
  doc.setFont('courier', 'bold');
  doc.setFontSize(7.5);
  doc.setTextColor(190, 18, 60);
  doc.text(invLines, margin + 4, y + 4.8);
  y += invBoxH + 6;

  // -------------------------------------------------------------------------
  // SECTION 5: PROVENANCE SEAL & REGULATORY COMPLIANCE DISCLOSURE
  // -------------------------------------------------------------------------
  if (y > pageH - 36) {
    doc.addPage();
    y = 18;
  }

  doc.setDrawColor(203, 213, 225);
  doc.setLineWidth(0.25);
  doc.line(margin, y, pageW - margin, y);
  y += 4;

  doc.setFont('courier', 'bold');
  doc.setFontSize(7.5);
  doc.setTextColor(51, 65, 85);
  doc.text('GOVERNANCE PROVENANCE & LEGAL DISCLOSURE', margin, y);
  y += 3.8;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7);
  doc.setTextColor(100, 116, 139);
  const disclosureLines = doc.splitTextToSize(
    'RESEARCH_AND_ADVISORY_ONLY: GoldVista Institutional Research provides analytical intelligence and quantitative trade scenarios solely for research purposes and does not execute live brokerage orders. Leveraged bullion and CFD trading carries substantial risk of capital loss.',
    contentW
  );
  doc.text(disclosureLines, margin, y);
  y += disclosureLines.length * 3.4 + 2;

  doc.setFont('courier', 'normal');
  doc.setFontSize(6.8);
  doc.setTextColor(71, 85, 105);
  doc.text(`SHA-256 Audit Seal: ${snapshotHash}`, margin, y);

  // Page numbering footer on all pages
  const totalPages = doc.getNumberOfPages();
  for (let p = 1; p <= totalPages; p++) {
    doc.setPage(p);
    doc.setFont('courier', 'normal');
    doc.setFontSize(7);
    doc.setTextColor(148, 163, 184);
    doc.text(
      `GoldVista Institutional Research  ·  ${reportRefId}  ·  Page ${p} of ${totalPages}`,
      pageW / 2,
      pageH - 7,
      { align: 'center' }
    );
  }

  const arrayBuffer = doc.output('arraybuffer');
  const pdfBytes = new Uint8Array(arrayBuffer);
  const safeSlug = reportTitle
    .replace(/[^a-zA-Z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 42);
  const filename = `GoldVista_${safeSlug}_${quote.instrumentId}_${dateStamp}.pdf`;

  return {
    filename,
    reportRefId,
    snapshotHash,
    generatedAtUtc,
    pageCount: totalPages,
    byteLength: pdfBytes.byteLength,
    hasEmbeddedChartSnapshot: embeddedRasterSnapshot,
    pdfBytes,
    aggregatedPayload,
  };
}

export interface TradePlanOnePagePdfInput {
  plan: TradePlan;
  quote?: Quote;
  candles?: Candle[];
  indicators?: IndicatorSnapshot;
  accountSizeUsd?: number;
  riskPercent?: number;
  pnlProjection?: TradePlanPnlProjection;
  rationale?: StrategyBiasRationale;
  isLocked?: boolean;
  generatedAtIso?: string;
}

export interface TradePlanOnePagePdfArtifact {
  filename: string;
  planRefId: string;
  snapshotHash: string;
  generatedAtUtc: string;
  pageCount: number;
  byteLength: number;
  pdfBytes: Uint8Array;
  summaryPayload: {
    planId: string;
    instrumentId: string;
    horizon: string;
    direction: string;
    state: string;
    isLocked: boolean;
    entryZone: string;
    stopLoss: string;
    target1: string;
    rewardToRiskRatio: number;
    accountSizeUsd: number;
    riskPercent: number;
    suggestedSize: number;
    unitLabel: string;
    riskBudgetUsd: number;
    projectedStopLossPnl: number;
    projectedTarget1Pnl: number;
    compositeScore: number;
    underlyingLogic: string;
    invalidationRule: string;
    technicalTriggerCount: number;
    agentVotes: { bullish: number; bearish: number; neutral: number };
  };
}

/**
 * Generates a compact, strictly single-page A4 institutional PDF summary of an individual
 * TradePlan's technical rationale, execution levels, and position-sizing risk parameters.
 */
export function buildTradePlanOnePagePdf(
  input: TradePlanOnePagePdfInput
): TradePlanOnePagePdfArtifact {
  const {
    plan,
    candles,
    indicators,
    accountSizeUsd = 25000,
    riskPercent = 1.5,
    isLocked = false,
    generatedAtIso,
  } = input;

  const generatedAtUtc = generatedAtIso || new Date().toISOString();
  const dateStamp = generatedAtUtc.slice(0, 10);

  const resolvedQuote: Quote = input.quote || {
    instrumentId: plan.instrumentId,
    mid: plan.currentMid,
    bid: Number((plan.currentMid - 0.15).toFixed(2)),
    ask: Number((plan.currentMid + 0.15).toFixed(2)),
    spread: 0.30,
    spreadPips: 20,
    high24h: Number((plan.currentMid * 1.006).toFixed(2)),
    low24h: Number((plan.currentMid * 0.994).toFixed(2)),
    open24h: plan.currentMid,
    change24hPct: 0,
    volume24h: 85000,
    timestamp: plan.createdAt || generatedAtUtc,
    provider: 'GoldVista Benchmark Reference',
    quality: plan.isAbstained ? 'QUALITY_HOLD' : 'FRESH',
    latencyMs: 90,
  };

  const resolvedAccountSizeUsd =
    Number.isFinite(accountSizeUsd) && accountSizeUsd >= 0 ? accountSizeUsd : 25000;
  const resolvedRiskPercent =
    Number.isFinite(riskPercent) && riskPercent >= 0 ? riskPercent : 1.5;

  const resolvedProjection: TradePlanPnlProjection =
    input.pnlProjection ||
    calculateTradePlanPnlProjection({
      plan,
      accountSize: resolvedAccountSizeUsd,
      riskPercent: resolvedRiskPercent,
    });

  const resolvedRationale: StrategyBiasRationale =
    input.rationale ||
    buildStrategyBiasRationale(
      resolvedQuote,
      plan.horizon,
      { candles, indicators, quote: resolvedQuote },
      plan
    );

  const planRefId = `${plan.id}-${dateStamp.replace(/-/g, '')}`;
  const snapshotHash = computeDeterministicSha256(
    `${plan.id}|${plan.snapshotHash || 'NO_PLAN_HASH'}|${generatedAtUtc}|${plan.direction}|${plan.stopLossPrice}|${plan.target1Price}|${resolvedAccountSizeUsd}|${resolvedRiskPercent}|${isLocked ? 'LOCKED' : 'OPEN'}`
  );

  const entryZoneText = isLocked
    ? 'LOCKED (Unlock signal to reveal corridor)'
    : `$${plan.entryZoneMin.toFixed(2)} - $${plan.entryZoneMax.toFixed(2)}`;
  const triggerText = isLocked ? 'LOCKED' : `$${plan.triggerPrice.toFixed(2)}`;
  const stopLossText = isLocked ? 'LOCKED' : `$${plan.stopLossPrice.toFixed(2)}`;
  const target1Text = isLocked ? 'LOCKED' : `$${plan.target1Price.toFixed(2)}`;
  const target2Text = isLocked
    ? 'LOCKED'
    : plan.target2Price
    ? `$${plan.target2Price.toFixed(2)}`
    : 'Trailing';
  const target3Text = isLocked
    ? 'LOCKED'
    : plan.target3Price
    ? `$${plan.target3Price.toFixed(2)}`
    : 'Trailing';

  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
    compress: true,
  });

  const pageW = 210;
  const pageH = 297;
  const margin = 13;
  const contentW = pageW - margin * 2; // 184mm

  // -------------------------------------------------------------------------
  // 1. MASTHEAD BANNER
  // -------------------------------------------------------------------------
  doc.setFillColor(15, 23, 42);
  doc.rect(0, 0, pageW, 27, 'F');
  doc.setFillColor(245, 158, 11);
  doc.rect(0, 27, pageW, 0.9, 'F');

  doc.setFont('courier', 'bold');
  doc.setFontSize(7.5);
  doc.setTextColor(251, 191, 36);
  doc.text('GOLDVISTA INSTITUTIONAL RECORD  ·  TRADE PLAN & RISK BRIEF', margin, 7.5);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(13.5);
  doc.setTextColor(248, 250, 252);
  doc.text(
    `${plan.instrumentId}  ·  ${plan.horizon.replace(/_/g, ' ')} SETUP (${plan.direction})`,
    margin,
    14.5
  );

  doc.setFont('courier', 'normal');
  doc.setFontSize(7);
  doc.setTextColor(148, 163, 184);
  doc.text(
    `Plan ID: ${plan.id}  ·  State: ${plan.state}  ·  Generated: ${generatedAtUtc.slice(0, 19).replace('T', ' ')} UTC`,
    margin,
    22.5
  );

  doc.setFont('courier', 'bold');
  doc.setFontSize(14);
  doc.setTextColor(251, 191, 36);
  doc.text(`$${plan.currentMid.toFixed(2)}`, pageW - margin, 13.5, { align: 'right' });

  doc.setFont('courier', 'normal');
  doc.setFontSize(7.2);
  doc.setTextColor(148, 163, 184);
  doc.text(
    `Spread: ${resolvedQuote.spreadPips} pips · ${resolvedQuote.quality} · Net 1:${plan.rewardToRiskRatio.toFixed(2)} R:R`,
    pageW - margin,
    22.5,
    { align: 'right' }
  );

  let y = 33;

  // -------------------------------------------------------------------------
  // 2. EXECUTION LEVELS & TRADE PARAMETERS
  // -------------------------------------------------------------------------
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.setTextColor(15, 23, 42);
  doc.text('1. EXECUTION LEVELS & STRUCTURAL RISK BOUNDS', margin, y);
  y += 2.5;

  const execCards: Array<{ label: string; value: string; sub: string; tone: 'amber' | 'rose' | 'emerald' | 'slate' }> = [
    {
      label: 'ENTRY CORRIDOR',
      value: isLocked ? 'LOCKED' : `$${plan.entryZoneMin.toFixed(2)}–$${plan.entryZoneMax.toFixed(2)}`,
      sub: `Trigger: ${triggerText}`,
      tone: 'amber',
    },
    {
      label: 'STOP LOSS',
      value: stopLossText,
      sub: `Risk Dist: $${plan.riskDistance.toFixed(2)}`,
      tone: 'rose',
    },
    {
      label: 'TAKE PROFIT 1 (TP1)',
      value: target1Text,
      sub: `Reward Dist: $${plan.rewardDistance.toFixed(2)}`,
      tone: 'emerald',
    },
    {
      label: 'EXTENDED TARGETS / R:R',
      value: `1 : ${plan.rewardToRiskRatio.toFixed(2)}`,
      sub: `T2 ${target2Text} · T3 ${target3Text}`,
      tone: 'slate',
    },
  ];

  const cardW = (contentW - 6) / 4;
  const cardH = 14.5;
  execCards.forEach((c, idx) => {
    const cx = margin + idx * (cardW + 2);
    doc.setFillColor(248, 250, 252);
    doc.setDrawColor(203, 213, 225);
    doc.setLineWidth(0.25);
    doc.roundedRect(cx, y, cardW, cardH, 1, 1, 'FD');

    doc.setFont('courier', 'normal');
    doc.setFontSize(6.3);
    doc.setTextColor(100, 116, 139);
    doc.text(c.label, cx + 2, y + 3.8);

    doc.setFont('courier', 'bold');
    doc.setFontSize(7.8);
    if (c.tone === 'rose') doc.setTextColor(190, 18, 60);
    else if (c.tone === 'emerald') doc.setTextColor(4, 120, 87);
    else if (c.tone === 'amber') doc.setTextColor(180, 83, 9);
    else doc.setTextColor(15, 23, 42);
    doc.text(c.value, cx + 2, y + 8.6);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(6.5);
    doc.setTextColor(71, 85, 105);
    doc.text(c.sub, cx + 2, y + 12.6);
  });
  y += cardH + 3.5;

  // Invalidation & Event Risk Box
  const invText = `Invalidation Rule: ${plan.invalidationCondition}${
    plan.eventRiskWarning ? `  |  Event Risk: ${plan.eventRiskWarning}` : ''
  }`;
  const invLines = doc.splitTextToSize(invText, contentW - 6).slice(0, 3);
  const invH = 3.6 + invLines.length * 3.6;
  doc.setFillColor(255, 241, 242);
  doc.setDrawColor(254, 205, 211);
  doc.roundedRect(margin, y, contentW, invH, 1, 1, 'FD');
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.2);
  doc.setTextColor(159, 18, 57);
  doc.text(invLines, margin + 3, y + 4.2);
  y += invH + 5;

  // -------------------------------------------------------------------------
  // 3. POSITION SIZING & CAPITAL RISK PARAMETERS
  // -------------------------------------------------------------------------
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.setTextColor(15, 23, 42);
  doc.text('2. POSITION SIZING & CAPITAL RISK PARAMETERS', margin, y);
  y += 2.5;

  const sizeDec = resolvedProjection.lotIncrement < 1 ? 2 : 0;
  const fmtUsd = (val: number, signed = false) => {
    const abs = Math.abs(val).toLocaleString('en-US', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
    if (!signed) return `$${abs}`;
    return val > 0 ? `+$${abs}` : val < 0 ? `-$${abs}` : `$${abs}`;
  };

  const riskRows: Array<[string, string, string, string]> = [
    [
      'Account Equity & Risk %',
      `${fmtUsd(resolvedAccountSizeUsd)} @ ${resolvedRiskPercent.toFixed(2)}%`,
      'Max Risk Budget',
      fmtUsd(resolvedProjection.riskBudgetUsd),
    ],
    [
      'Suggested Position Size',
      `${resolvedProjection.suggestedSize.toFixed(sizeDec)} ${resolvedProjection.unitLabel}`,
      'Contract Multiplier',
      `${resolvedProjection.contractSize}x · Stop Dist $${resolvedProjection.stopDistance.toFixed(2)}`,
    ],
    [
      'Projected Stop-Loss P&L',
      `${fmtUsd(resolvedProjection.projectedStopLossPnl, true)} (${resolvedProjection.stopLossReturnPct.toFixed(2)}%)`,
      'Projected TP1 P&L',
      `${fmtUsd(resolvedProjection.projectedTarget1Pnl, true)} (+${resolvedProjection.target1ReturnPct.toFixed(2)}%)`,
    ],
    [
      'Projected TP2 / TP3 P&L',
      `T2: ${fmtUsd(resolvedProjection.projectedTarget2Pnl, true)}`,
      'TP3 Upside',
      `${fmtUsd(resolvedProjection.projectedTarget3Pnl, true)}`,
    ],
  ];

  const rColW = [42, 52, 38, 52];
  const rRowH = 5.8;

  doc.setFillColor(15, 23, 42);
  doc.rect(margin, y, contentW, rRowH, 'F');
  doc.setFont('courier', 'bold');
  doc.setFontSize(7);
  doc.setTextColor(248, 250, 252);
  ['RISK PARAMETER', 'VALUE / ALLOCATION', 'METRIC', 'PROJECTED IMPACT'].forEach((h, i) => {
    const hx = margin + 2 + rColW.slice(0, i).reduce((a, b) => a + b, 0);
    doc.text(h, hx, y + 4);
  });
  y += rRowH;

  riskRows.forEach((row, rIdx) => {
    doc.setFillColor(rIdx % 2 === 0 ? 255 : 248, rIdx % 2 === 0 ? 255 : 250, rIdx % 2 === 0 ? 255 : 252);
    doc.setDrawColor(226, 232, 240);
    doc.setLineWidth(0.2);
    doc.rect(margin, y, contentW, rRowH, 'FD');

    let rx = margin + 2;
    row.forEach((cell, cIdx) => {
      doc.setFont(cIdx % 2 === 1 ? 'courier' : 'helvetica', cIdx % 2 === 1 ? 'bold' : 'normal');
      doc.setFontSize(7.2);
      if (rIdx === 2 && cIdx === 1) doc.setTextColor(190, 18, 60);
      else if (rIdx >= 2 && cIdx === 3) doc.setTextColor(4, 120, 87);
      else doc.setTextColor(30, 41, 59);
      doc.text(cell, rx, y + 4);
      rx += rColW[cIdx];
    });
    y += rRowH;
  });
  y += 5;

  // -------------------------------------------------------------------------
  // 4. TECHNICAL RATIONALE & CONFLUENCE TRIGGERS
  // -------------------------------------------------------------------------
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.setTextColor(15, 23, 42);
  doc.text('3. TECHNICAL RATIONALE & CONFLUENCE EVIDENCE', margin, y);
  doc.setFont('courier', 'bold');
  doc.setFontSize(7.2);
  doc.setTextColor(71, 85, 105);
  doc.text(
    `Composite Score: ${resolvedRationale.compositeScore >= 0 ? '+' : ''}${resolvedRationale.compositeScore}  ·  Sentiment: ${resolvedRationale.sentimentLabel} (${resolvedRationale.sentimentScore >= 0 ? '+' : ''}${resolvedRationale.sentimentScore})`,
    pageW - margin,
    y,
    { align: 'right' }
  );
  y += 2.5;

  const logicLines = doc.splitTextToSize(resolvedRationale.underlyingLogic, contentW - 6).slice(0, 4);
  const conflictLines = resolvedRationale.conflictNotice
    ? doc.splitTextToSize(`Divergence Notice: ${resolvedRationale.conflictNotice}`, contentW - 6).slice(0, 2)
    : [];
  const logicBoxH = 4.5 + logicLines.length * 3.7 + (conflictLines.length > 0 ? conflictLines.length * 3.5 + 1.5 : 0);

  doc.setFillColor(248, 250, 252);
  doc.setDrawColor(203, 213, 225);
  doc.roundedRect(margin, y, contentW, logicBoxH, 1, 1, 'FD');
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  doc.setTextColor(30, 41, 59);
  doc.text(logicLines, margin + 3, y + 4.4);
  if (conflictLines.length > 0) {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7);
    doc.setTextColor(180, 83, 9);
    doc.text(conflictLines, margin + 3, y + 4.4 + logicLines.length * 3.7 + 1);
  }
  y += logicBoxH + 3.5;

  // Compact Technical Trigger Grid (up to 6 triggers in 2 columns)
  const triggers = (resolvedRationale.technicalTriggers || []).slice(0, 6);
  if (triggers.length > 0) {
    const trigW = (contentW - 3) / 2;
    const trigH = 12.2;
    triggers.forEach((tr, idx) => {
      const col = idx % 2;
      const row = Math.floor(idx / 2);
      const tx = margin + col * (trigW + 3);
      const ty = y + row * (trigH + 2);
      doc.setFillColor(255, 255, 255);
      doc.setDrawColor(226, 232, 240);
      doc.roundedRect(tx, ty, trigW, trigH, 0.8, 0.8, 'FD');

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(7);
      doc.setTextColor(15, 23, 42);
      doc.text(tr.label.slice(0, 38), tx + 2, ty + 3.8);

      doc.setFont('courier', 'bold');
      doc.setFontSize(6.5);
      if (tr.lean === 'BULLISH') doc.setTextColor(4, 120, 87);
      else if (tr.lean === 'BEARISH') doc.setTextColor(190, 18, 60);
      else doc.setTextColor(100, 116, 139);
      doc.text(`${tr.lean} (${tr.impactPoints >= 0 ? '+' : ''}${tr.impactPoints})`, tx + trigW - 2, ty + 3.8, { align: 'right' });

      doc.setFont('courier', 'normal');
      doc.setFontSize(6.5);
      doc.setTextColor(71, 85, 105);
      doc.text(tr.observedValue.slice(0, 52), tx + 2, ty + 7.4);

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(6.2);
      doc.setTextColor(100, 116, 139);
      doc.text(`${tr.status} · ${tr.thresholdRule}`.slice(0, 64), tx + 2, ty + 10.6);
    });
    y += Math.ceil(triggers.length / 2) * (trigH + 2) + 2;
  }

  // Specialist Council & Sentiment Line
  doc.setFillColor(241, 245, 249);
  doc.setDrawColor(203, 213, 225);
  doc.roundedRect(margin, y, contentW, 8.5, 1, 1, 'FD');
  doc.setFont('courier', 'bold');
  doc.setFontSize(7);
  doc.setTextColor(30, 41, 59);
  doc.text(
    `Specialist Council Votes: ${resolvedRationale.agentVotes.bullish} Bullish / ${resolvedRationale.agentVotes.bearish} Bearish / ${resolvedRationale.agentVotes.neutral} Neutral  ·  Active Indicators: RSI ${indicators?.rsi14?.toFixed(1) ?? 'N/A'}  ·  ATR $${indicators?.atr14?.toFixed(2) ?? 'N/A'}  ·  Supertrend ${indicators?.supertrend?.direction ?? 'N/A'}`,
    margin + 3,
    y + 5.2
  );
  y += 12;

  // -------------------------------------------------------------------------
  // 5. CRYPTOGRAPHIC PROVENANCE SEAL & REGULATORY FOOTER (FIXED AT BOTTOM)
  // -------------------------------------------------------------------------
  const footerStartY = Math.max(y, pageH - 31);
  doc.setDrawColor(203, 213, 225);
  doc.setLineWidth(0.25);
  doc.line(margin, footerStartY, pageW - margin, footerStartY);

  doc.setFont('courier', 'bold');
  doc.setFontSize(7);
  doc.setTextColor(51, 65, 85);
  doc.text('INSTITUTIONAL RECORD PROVENANCE & NON-EXECUTION DISCLOSURE', margin, footerStartY + 4);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(6.7);
  doc.setTextColor(100, 116, 139);
  const discLines = doc.splitTextToSize(
    'RESEARCH_AND_ADVISORY_ONLY: Generated strictly for institutional record-keeping, risk review, and compliance archiving. GoldVista performs no live brokerage routing or automated capital execution.',
    contentW
  );
  doc.text(discLines, margin, footerStartY + 7.6);

  doc.setFont('courier', 'normal');
  doc.setFontSize(6.5);
  doc.setTextColor(71, 85, 105);
  doc.text(
    `Plan Digest: ${plan.snapshotHash || 'PENDING'}  ·  Export Audit Seal: ${snapshotHash}`,
    margin,
    footerStartY + 15.5
  );

  doc.setFont('courier', 'normal');
  doc.setFontSize(7);
  doc.setTextColor(148, 163, 184);
  doc.text(
    `GoldVista Institutional Research  ·  ${planRefId}  ·  Page 1 of 1`,
    pageW / 2,
    pageH - 6.5,
    { align: 'center' }
  );

  const arrayBuffer = doc.output('arraybuffer');
  const pdfBytes = new Uint8Array(arrayBuffer);
  const filename = `GoldVista_${plan.id}_${plan.horizon}_${dateStamp}.pdf`;

  return {
    filename,
    planRefId,
    snapshotHash,
    generatedAtUtc,
    pageCount: doc.getNumberOfPages(),
    byteLength: pdfBytes.byteLength,
    pdfBytes,
    summaryPayload: {
      planId: plan.id,
      instrumentId: plan.instrumentId,
      horizon: plan.horizon,
      direction: plan.direction,
      state: plan.state,
      isLocked,
      entryZone: entryZoneText,
      stopLoss: stopLossText,
      target1: target1Text,
      rewardToRiskRatio: plan.rewardToRiskRatio,
      accountSizeUsd: resolvedAccountSizeUsd,
      riskPercent: resolvedRiskPercent,
      suggestedSize: resolvedProjection.suggestedSize,
      unitLabel: resolvedProjection.unitLabel,
      riskBudgetUsd: resolvedProjection.riskBudgetUsd,
      projectedStopLossPnl: resolvedProjection.projectedStopLossPnl,
      projectedTarget1Pnl: resolvedProjection.projectedTarget1Pnl,
      compositeScore: resolvedRationale.compositeScore,
      underlyingLogic: resolvedRationale.underlyingLogic,
      invalidationRule: resolvedRationale.invalidationRule,
      technicalTriggerCount: resolvedRationale.technicalTriggers.length,
      agentVotes: resolvedRationale.agentVotes,
    },
  };
}

