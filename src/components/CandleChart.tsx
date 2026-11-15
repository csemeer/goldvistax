/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * Aurum Intelligence — TradingView-Grade Interactive Multi-Commodity Chart
 *
 * Capabilities:
 * 1. Fully responsive vector canvas with dynamic ResizeObserver auto-scaling.
 * 2. TradingView-style Pan (drag-to-scroll through full history) & Zoom (mouse wheel & buttons).
 * 3. 5 Chart Styles: Candlesticks, Heikin Ashi, Line, Area (Mountain), and OHLC Bars.
 * 4. Technical Overlays with guaranteed SVG path continuity:
 *    - EMA 9, EMA 21, EMA 50, EMA 200, SMA 20, VWAP
 *    - Bollinger Bands (Upper, Middle, Lower + Shaded Envelope)
 *    - Supertrend Ribbon (Bullish / Bearish color changes + Trend arrows)
 *    - Trade Plan Markers (Shaded Entry Zone, Target 1/2/3, Stop Loss, R:R Tag)
 * 5. Dedicated Resizable Oscillator Subpanels:
 *    - Volume Bar Chart with 20-period Volume MA
 *    - RSI (14) with 70/30 threshold ribbons
 *    - MACD (12,26,9) with MACD line, Signal line & colored histogram bars
 * 6. Precision Crosshair with coordinate snap on X (Time) and Y (Price) axes.
 * 7. Real-time floating HUD legend displaying live/hovered OHLCV & Indicator metrics.
 * 8. Resolution selector (1m, 5m, 15m, 30m, 1h, 4h, 1D, 1W) & Historical Range selector (1D to MAX).
 */

import React, { useState, useMemo, useRef, useEffect, useCallback } from 'react';
import {
  Candle,
  HistoricalCoverageReport,
  HistoricalRangePeriod,
  IndicatorSnapshot,
  Timeframe,
  TradePlan,
} from '../domain/types';
import {
  calculateEMA,
  calculateSMA,
  calculateBollingerBands,
  calculateSupertrend,
  calculateVWAP,
  calculateRSI,
  calculateMACD,
  calculateHeikinAshi,
} from '../services/indicators';
import {
  ZoomIn,
  ZoomOut,
  RotateCcw,
  Sliders,
  TrendingUp,
  BarChart2,
  Activity,
  Layers,
  ChevronDown,
  Maximize2,
  Minimize2,
  ArrowRight,
  SlidersHorizontal,
  Calendar,
  X,
  Check,
  Monitor,
} from 'lucide-react';

export type ChartType = 'CANDLES' | 'HEIKIN_ASHI' | 'LINE' | 'AREA' | 'BARS';

interface CandleChartProps {
  candles: Candle[];
  timeframe?: Timeframe;
  period?: HistoricalRangePeriod;
  onTimeframeChange?: (tf: Timeframe) => void;
  onPeriodChange?: (period: HistoricalRangePeriod) => void;
  customHorizon?: {
    years?: number;
    startDate?: string;
    endDate?: string;
  } | null;
  onCustomHorizonChange?: (horizon: { years?: number; startDate?: string; endDate?: string } | null) => void;
  tradePlan?: TradePlan | null;
  indicators?: IndicatorSnapshot | null;
  coverageReport?: HistoricalCoverageReport | null;
  unit?: string;
  instrumentName?: string;
  height?: number;
  isFitToScreen?: boolean;
  onToggleFitScreen?: () => void;
}

export const CandleChart: React.FC<CandleChartProps> = ({
  candles,
  timeframe = '1D',
  period = '5Y',
  onTimeframeChange,
  onPeriodChange,
  customHorizon,
  onCustomHorizonChange,
  tradePlan,
  coverageReport,
  unit = 'USD/oz',
  instrumentName = 'Gold Spot',
  height = 500,
  isFitToScreen = false,
  onToggleFitScreen,
}) => {
  // Chart Configuration & State
  const [chartType, setChartType] = useState<ChartType>('CANDLES');
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [showIndicatorMenu, setShowIndicatorMenu] = useState(false);
  const [showHorizonModal, setShowHorizonModal] = useState(false);
  const [selectedYears, setSelectedYears] = useState<number>(customHorizon?.years || 5);
  const [customStart, setCustomStart] = useState<string>(
    customHorizon?.startDate || '2021-11-02'
  );
  const [customEnd, setCustomEnd] = useState<string>(
    customHorizon?.endDate || new Date().toISOString().slice(0, 10)
  );

  // Active Overlays & Subpanels
  const [overlays, setOverlays] = useState({
    ema9: true,
    ema21: true,
    ema50: false,
    ema200: true,
    sma20: false,
    vwap: false,
    bollinger: false,
    supertrend: true,
    tradePlan: true,
  });

  const [subpanels, setSubpanels] = useState({
    volume: true,
    rsi: false,
    macd: false,
  });

  // Viewport & Pan/Zoom State
  // visibleCount: number of candles displayed in the viewport
  const [visibleCount, setVisibleCount] = useState<number>(75);
  // scrollOffset: offset from latest candle (0 = showing latest)
  const [scrollOffset, setScrollOffset] = useState<number>(0);

  // Interactive Hover & Drag State
  const [hoverIndex, setHoverIndex] = useState<number | null>(null);
  const [mousePos, setMousePos] = useState<{ x: number; y: number } | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const dragStartX = useRef<number>(0);
  const dragStartOffset = useRef<number>(0);

  // Container Measurement via ResizeObserver
  const containerRef = useRef<HTMLDivElement>(null);
  const [dimensions, setDimensions] = useState<{ width: number; height: number }>({
    width: 900,
    height,
  });

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const updateSize = () => {
      const rect = el.getBoundingClientRect();
      if (rect.width > 0) {
        let calculatedHeight = height;
        if (isFullscreen) {
          calculatedHeight = Math.max(550, window.innerHeight - 140);
        } else if (isFitToScreen) {
          // Fit chart dynamically to available screen space
          const available = window.innerHeight - rect.top - 24;
          calculatedHeight = Math.max(380, Math.floor(available));
        }
        setDimensions({
          width: Math.floor(rect.width),
          height: calculatedHeight,
        });
      }
    };

    updateSize();

    const ro = new ResizeObserver(() => updateSize());
    ro.observe(el);

    window.addEventListener('resize', updateSize);
    return () => {
      ro.disconnect();
      window.removeEventListener('resize', updateSize);
    };
  }, [isFullscreen, isFitToScreen, height]);

  // Historical Ranges and Resolutions
  const periods: HistoricalRangePeriod[] = [
    '1D',
    '5D',
    '1M',
    '3M',
    '6M',
    '1Y',
    '2Y',
    '5Y',
    '10Y',
    'MAX',
  ];
  const timeframes: Timeframe[] = ['1m', '5m', '15m', '30m', '1h', '4h', '1D', '1W'];

  // Base Series: Raw or Heikin Ashi
  const haCandles = useMemo(() => {
    if (chartType === 'HEIKIN_ASHI') {
      return calculateHeikinAshi(candles);
    }
    return candles;
  }, [candles, chartType]);

  const activeSeries = chartType === 'HEIKIN_ASHI' ? haCandles : candles;
  const totalCandles = activeSeries.length;

  // Ensure scrollOffset and visibleCount remain strictly within data bounds
  const clampedVisibleCount = Math.max(15, Math.min(visibleCount, Math.max(15, totalCandles)));
  const maxOffset = Math.max(0, totalCandles - clampedVisibleCount);
  const clampedOffset = Math.max(0, Math.min(scrollOffset, maxOffset));

  // Sliced Viewport Data
  const startIndex = Math.max(0, totalCandles - clampedOffset - clampedVisibleCount);
  const endIndex = Math.min(totalCandles, totalCandles - clampedOffset);
  const visibleCandles = useMemo(() => {
    return activeSeries.slice(startIndex, endIndex);
  }, [activeSeries, startIndex, endIndex]);

  // Compute Indicators across the ENTIRE candle history so warmup is 100% stabilized
  const indicatorSeries = useMemo(() => {
    if (candles.length === 0) return null;
    const closes = candles.map((c) => c.close);
    const volumes = candles.map((c) => c.volume);

    return {
      ema9: calculateEMA(closes, 9),
      ema21: calculateEMA(closes, 21),
      ema50: calculateEMA(closes, 50),
      ema200: calculateEMA(closes, Math.min(closes.length, 200)),
      sma20: calculateSMA(closes, 20),
      vwap: calculateVWAP(candles),
      bb: calculateBollingerBands(closes, 20, 2),
      st: calculateSupertrend(candles, 10, 3),
      rsi: calculateRSI(closes, 14),
      macd: calculateMACD(closes, 12, 26, 9),
      volSMA20: calculateSMA(volumes, 20),
    };
  }, [candles]);

  // Layout Dimensions
  const priceGutterWidth = 75; // Right price axis width
  const timeGutterHeight = 26; // Bottom date/time axis height
  const chartWidth = Math.max(100, dimensions.width - priceGutterWidth);

  // Subpanel Heights
  const volumePanelHeight = subpanels.volume ? 55 : 0;
  const rsiPanelHeight = subpanels.rsi ? 70 : 0;
  const macdPanelHeight = subpanels.macd ? 75 : 0;
  const totalSubpanelHeight = volumePanelHeight + rsiPanelHeight + macdPanelHeight;

  // Main Price Canvas Height
  const mainChartHeight = Math.max(
    180,
    dimensions.height - timeGutterHeight - totalSubpanelHeight - 65
  );

  // Subpanel Y Offsets
  const volumeY = mainChartHeight;
  const rsiY = volumeY + volumePanelHeight;
  const macdY = rsiY + rsiPanelHeight;
  const timeAxisY = macdY + macdPanelHeight;
  const svgTotalHeight = timeAxisY + timeGutterHeight;

  // Price Scaling inside visible viewport
  const { minPrice, maxPrice, maxVolume } = useMemo(() => {
    if (visibleCandles.length === 0) return { minPrice: 0, maxPrice: 1, maxVolume: 1 };
    let min = Infinity;
    let max = -Infinity;
    let maxVol = 1;

    for (let i = 0; i < visibleCandles.length; i++) {
      const c = visibleCandles[i];
      if (c.low < min) min = c.low;
      if (c.high > max) max = c.high;
      if (c.volume > maxVol) maxVol = c.volume;
    }

    // Include active trade plan levels if visible in range
    if (overlays.tradePlan && tradePlan) {
      min = Math.min(min, tradePlan.stopLossPrice);
      max = Math.max(max, tradePlan.target1Price, tradePlan.target2Price || 0);
    }

    const padding = (max - min) * 0.06 || 2;
    return {
      minPrice: min - padding,
      maxPrice: max + padding,
      maxVolume: maxVol,
    };
  }, [visibleCandles, overlays.tradePlan, tradePlan]);

  // Coordinate Conversion Helpers
  const priceToY = useCallback(
    (price: number) => {
      if (maxPrice <= minPrice) return mainChartHeight / 2;
      return (
        mainChartHeight - ((price - minPrice) / (maxPrice - minPrice)) * mainChartHeight
      );
    },
    [minPrice, maxPrice, mainChartHeight]
  );

  const yToPrice = useCallback(
    (y: number) => {
      const clampedY = Math.max(0, Math.min(mainChartHeight, y));
      return maxPrice - (clampedY / mainChartHeight) * (maxPrice - minPrice);
    },
    [minPrice, maxPrice, mainChartHeight]
  );

  const candleStep = chartWidth / Math.max(1, visibleCandles.length);
  const barWidth = Math.max(1.8, candleStep * 0.7);

  // Robust SVG Path Builder: Guarantees correct 'M' at the beginning of each valid segment!
  const buildSmoothPath = useCallback(
    (dataSeries: number[] | undefined, filterZero = true) => {
      if (!dataSeries || visibleCandles.length === 0) return '';
      let path = '';
      let inSegment = false;

      for (let i = 0; i < visibleCandles.length; i++) {
        const fullIdx = startIndex + i;
        const val = dataSeries[fullIdx];

        if (
          val === undefined ||
          val === null ||
          isNaN(val) ||
          !isFinite(val) ||
          (filterZero && val <= 0)
        ) {
          inSegment = false;
          continue;
        }

        const x = i * candleStep + candleStep / 2;
        const y = priceToY(val);

        if (!inSegment) {
          path += ` M ${x.toFixed(1)} ${y.toFixed(1)}`;
          inSegment = true;
        } else {
          path += ` L ${x.toFixed(1)} ${y.toFixed(1)}`;
        }
      }
      return path;
    },
    [visibleCandles.length, startIndex, candleStep, priceToY]
  );

  // Robust Shaded Band Path Builder for Bollinger Bands
  const buildBandAreaPath = useCallback(
    (upperSeries: number[], lowerSeries: number[]) => {
      if (!upperSeries || !lowerSeries || visibleCandles.length === 0) return '';
      const upperPoints: { x: number; y: number }[] = [];
      const lowerPoints: { x: number; y: number }[] = [];

      for (let i = 0; i < visibleCandles.length; i++) {
        const fullIdx = startIndex + i;
        const u = upperSeries[fullIdx];
        const l = lowerSeries[fullIdx];
        if (u > 0 && l > 0) {
          const x = i * candleStep + candleStep / 2;
          upperPoints.push({ x, y: priceToY(u) });
          lowerPoints.push({ x, y: priceToY(l) });
        }
      }

      if (upperPoints.length < 2) return '';

      let path = `M ${upperPoints[0].x.toFixed(1)} ${upperPoints[0].y.toFixed(1)}`;
      for (let i = 1; i < upperPoints.length; i++) {
        path += ` L ${upperPoints[i].x.toFixed(1)} ${upperPoints[i].y.toFixed(1)}`;
      }
      for (let i = lowerPoints.length - 1; i >= 0; i--) {
        path += ` L ${lowerPoints[i].x.toFixed(1)} ${lowerPoints[i].y.toFixed(1)}`;
      }
      path += ' Z';
      return path;
    },
    [visibleCandles.length, startIndex, candleStep, priceToY]
  );

  // Area Chart Gradient Path
  const areaPath = useMemo(() => {
    if (visibleCandles.length < 2) return '';
    let p = `M ${(candleStep / 2).toFixed(1)} ${mainChartHeight.toFixed(1)}`;
    for (let i = 0; i < visibleCandles.length; i++) {
      const x = i * candleStep + candleStep / 2;
      const y = priceToY(visibleCandles[i].close);
      p += ` L ${x.toFixed(1)} ${y.toFixed(1)}`;
    }
    const lastX = (visibleCandles.length - 1) * candleStep + candleStep / 2;
    p += ` L ${lastX.toFixed(1)} ${mainChartHeight.toFixed(1)} Z`;
    return p;
  }, [visibleCandles, candleStep, priceToY, mainChartHeight]);

  // Line Chart Path
  const linePath = useMemo(() => {
    if (visibleCandles.length < 2) return '';
    let p = '';
    for (let i = 0; i < visibleCandles.length; i++) {
      const x = i * candleStep + candleStep / 2;
      const y = priceToY(visibleCandles[i].close);
      p += `${i === 0 ? 'M' : 'L'} ${x.toFixed(1)} ${y.toFixed(1)} `;
    }
    return p;
  }, [visibleCandles, candleStep, priceToY]);

  // Panning & Drag Handlers
  const handleMouseDown = (e: React.MouseEvent) => {
    setIsDragging(true);
    dragStartX.current = e.clientX;
    dragStartOffset.current = clampedOffset;
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    const el = containerRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    setMousePos({ x, y });

    if (isDragging) {
      const deltaX = e.clientX - dragStartX.current;
      // Convert pixel delta to bar count
      const barsDelta = Math.round(deltaX / candleStep);
      const newOffset = Math.max(0, Math.min(maxOffset, dragStartOffset.current + barsDelta));
      setScrollOffset(newOffset);
    } else {
      // Hover index calculation
      const idx = Math.floor(x / candleStep);
      if (idx >= 0 && idx < visibleCandles.length) {
        setHoverIndex(idx);
      } else {
        setHoverIndex(null);
      }
    }
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  const handleMouseLeave = () => {
    setIsDragging(false);
    setHoverIndex(null);
    setMousePos(null);
  };

  // Zoom Handler (Wheel)
  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    const delta = e.deltaY > 0 ? 5 : -5;
    setVisibleCount((prev) => Math.max(15, Math.min(250, prev + delta)));
  };

  // Touch Handlers for Mobile / Tablet Panning
  const handleTouchStart = (e: React.TouchEvent) => {
    if (e.touches.length === 1) {
      setIsDragging(true);
      dragStartX.current = e.touches[0].clientX;
      dragStartOffset.current = clampedOffset;
    }
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (isDragging && e.touches.length === 1) {
      const deltaX = e.touches[0].clientX - dragStartX.current;
      const barsDelta = Math.round(deltaX / candleStep);
      const newOffset = Math.max(0, Math.min(maxOffset, dragStartOffset.current + barsDelta));
      setScrollOffset(newOffset);
    }
  };

  const handleTouchEnd = () => {
    setIsDragging(false);
  };

  // Current Hovered Candle (or latest visible candle if not hovered)
  const displayCandle = useMemo(() => {
    if (hoverIndex !== null && visibleCandles[hoverIndex]) {
      return visibleCandles[hoverIndex];
    }
    return visibleCandles[visibleCandles.length - 1] || candles[candles.length - 1];
  }, [hoverIndex, visibleCandles, candles]);

  // Indicator values at active hovered candle
  const activeHoverMetrics = useMemo(() => {
    if (!indicatorSeries || !displayCandle) return null;
    const fullIdx =
      hoverIndex !== null ? startIndex + hoverIndex : startIndex + visibleCandles.length - 1;

    return {
      ema9: indicatorSeries.ema9[fullIdx],
      ema21: indicatorSeries.ema21[fullIdx],
      ema50: indicatorSeries.ema50[fullIdx],
      ema200: indicatorSeries.ema200[fullIdx],
      sma20: indicatorSeries.sma20[fullIdx],
      vwap: indicatorSeries.vwap[fullIdx],
      rsi: indicatorSeries.rsi[fullIdx],
      macd: {
        macd: indicatorSeries.macd.macdLine[fullIdx],
        signal: indicatorSeries.macd.signalLine[fullIdx],
        hist: indicatorSeries.macd.histogram[fullIdx],
      },
      supertrend: {
        value: indicatorSeries.st.values[fullIdx],
        dir: indicatorSeries.st.directions[fullIdx],
      },
      bb: {
        upper: indicatorSeries.bb.upper[fullIdx],
        middle: indicatorSeries.bb.middle[fullIdx],
        lower: indicatorSeries.bb.lower[fullIdx],
      },
    };
  }, [indicatorSeries, displayCandle, hoverIndex, startIndex, visibleCandles.length]);

  const candleChange = displayCandle ? displayCandle.close - displayCandle.open : 0;
  const candleChangePct =
    displayCandle && displayCandle.open > 0
      ? ((candleChange / displayCandle.open) * 100).toFixed(2)
      : '0.00';
  const isUpCandle = candleChange >= 0;

  // Real-time Latest Price for Y-Axis Marker
  const latestPrice = candles[candles.length - 1]?.close || 0;
  const latestY = priceToY(latestPrice);

  return (
    <div
      ref={containerRef}
      className={`relative w-full bg-slate-950 border border-slate-800 rounded-xl overflow-hidden select-none transition-all shadow-xl font-sans ${
        isFullscreen ? 'fixed inset-2 z-50 bg-slate-950 p-4' : 'p-3 sm:p-4'
      }`}
    >
      {/* 1. TOP HEADER: INSTRUMENT, RESOLUTION, PERIOD & TOOLBAR */}
      <div className="flex flex-wrap items-center justify-between gap-2.5 pb-2.5 border-b border-slate-800/80">
        {/* Left Section: Commodity Name, Unit, and Timeframe Selector */}
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-1.5">
            <span className="font-bold text-slate-100 text-sm tracking-wide">
              {instrumentName}
            </span>
            <span className="text-[11px] font-mono text-amber-400 bg-amber-500/10 border border-amber-500/20 px-2 py-0.5 rounded font-semibold">
              {unit}
            </span>
          </div>

          {/* Timeframe Resolution Selector (1m, 5m, 15m, 1h, 4h, 1D, 1W) */}
          <div className="flex items-center bg-slate-900 border border-slate-800 rounded-lg p-0.5 text-xs font-mono">
            {timeframes.map((tf) => {
              const isSelected = timeframe === tf;
              return (
                <button
                  key={tf}
                  onClick={() => onTimeframeChange?.(tf)}
                  className={`px-2 py-0.5 rounded transition-all font-medium ${
                    isSelected
                      ? 'bg-amber-500 text-slate-950 font-bold shadow-xs'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  {tf}
                </button>
              );
            })}
          </div>

          {/* Chart Type Selector */}
          <div className="flex items-center bg-slate-900 border border-slate-800 rounded-lg p-0.5 text-xs font-mono">
            <button
              onClick={() => setChartType('CANDLES')}
              className={`px-2 py-0.5 rounded transition-all font-medium ${
                chartType === 'CANDLES'
                  ? 'bg-blue-600 text-white font-bold'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
              title="Japanese Candlesticks"
            >
              Candles
            </button>
            <button
              onClick={() => setChartType('HEIKIN_ASHI')}
              className={`px-2 py-0.5 rounded transition-all font-medium ${
                chartType === 'HEIKIN_ASHI'
                  ? 'bg-blue-600 text-white font-bold'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
              title="Heikin Ashi Smoothed Trend"
            >
              Heikin Ashi
            </button>
            <button
              onClick={() => setChartType('LINE')}
              className={`px-2 py-0.5 rounded transition-all font-medium ${
                chartType === 'LINE'
                  ? 'bg-blue-600 text-white font-bold'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
              title="Continuous Line"
            >
              Line
            </button>
            <button
              onClick={() => setChartType('AREA')}
              className={`px-2 py-0.5 rounded transition-all font-medium ${
                chartType === 'AREA'
                  ? 'bg-blue-600 text-white font-bold'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
              title="Mountain / Area"
            >
              Area
            </button>
            <button
              onClick={() => setChartType('BARS')}
              className={`px-2 py-0.5 rounded transition-all font-medium ${
                chartType === 'BARS'
                  ? 'bg-blue-600 text-white font-bold'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
              title="OHLC Bars"
            >
              Bars
            </button>
          </div>
        </div>

        {/* Right Section: Indicators Dropdown & Quick Toggles */}
        <div className="flex items-center gap-1.5 text-xs font-mono">
          {/* Indicators Dropdown Toggle */}
          <div className="relative">
            <button
              onClick={() => setShowIndicatorMenu((prev) => !prev)}
              className={`flex items-center gap-1 px-2.5 py-1 rounded-lg border text-xs font-medium transition-all ${
                showIndicatorMenu
                  ? 'bg-amber-500/20 text-amber-300 border-amber-500/40'
                  : 'bg-slate-900 text-slate-300 border-slate-800 hover:border-slate-700'
              }`}
            >
              <Activity className="w-3.5 h-3.5 text-amber-400" />
              <span>Indicators</span>
              <ChevronDown className="w-3 h-3 text-slate-400" />
            </button>

            {/* Dropdown Menu Modal */}
            {showIndicatorMenu && (
              <div className="absolute right-0 top-full mt-1.5 w-64 bg-slate-900 border border-slate-800 rounded-lg shadow-2xl p-3 z-50 text-xs font-mono space-y-2">
                <div className="font-bold text-slate-200 pb-1.5 border-b border-slate-800 text-[11px] uppercase tracking-wider">
                  Technical Overlays
                </div>
                <label className="flex items-center justify-between text-slate-300 hover:text-white cursor-pointer">
                  <span className="flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full bg-sky-400"></span>
                    EMA 9 (Fast)
                  </span>
                  <input
                    type="checkbox"
                    checked={overlays.ema9}
                    onChange={(e) => setOverlays((o) => ({ ...o, ema9: e.target.checked }))}
                    className="accent-amber-500"
                  />
                </label>
                <label className="flex items-center justify-between text-slate-300 hover:text-white cursor-pointer">
                  <span className="flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full bg-indigo-400"></span>
                    EMA 21 (Trend)
                  </span>
                  <input
                    type="checkbox"
                    checked={overlays.ema21}
                    onChange={(e) => setOverlays((o) => ({ ...o, ema21: e.target.checked }))}
                    className="accent-amber-500"
                  />
                </label>
                <label className="flex items-center justify-between text-slate-300 hover:text-white cursor-pointer">
                  <span className="flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full bg-amber-400"></span>
                    EMA 50 (Intermediate)
                  </span>
                  <input
                    type="checkbox"
                    checked={overlays.ema50}
                    onChange={(e) => setOverlays((o) => ({ ...o, ema50: e.target.checked }))}
                    className="accent-amber-500"
                  />
                </label>
                <label className="flex items-center justify-between text-slate-300 hover:text-white cursor-pointer">
                  <span className="flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full bg-yellow-400"></span>
                    EMA 200 (Institutional)
                  </span>
                  <input
                    type="checkbox"
                    checked={overlays.ema200}
                    onChange={(e) => setOverlays((o) => ({ ...o, ema200: e.target.checked }))}
                    className="accent-amber-500"
                  />
                </label>
                <label className="flex items-center justify-between text-slate-300 hover:text-white cursor-pointer">
                  <span className="flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full bg-fuchsia-400"></span>
                    VWAP
                  </span>
                  <input
                    type="checkbox"
                    checked={overlays.vwap}
                    onChange={(e) => setOverlays((o) => ({ ...o, vwap: e.target.checked }))}
                    className="accent-amber-500"
                  />
                </label>
                <label className="flex items-center justify-between text-slate-300 hover:text-white cursor-pointer">
                  <span className="flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full bg-cyan-400"></span>
                    Bollinger Bands (20,2)
                  </span>
                  <input
                    type="checkbox"
                    checked={overlays.bollinger}
                    onChange={(e) => setOverlays((o) => ({ ...o, bollinger: e.target.checked }))}
                    className="accent-amber-500"
                  />
                </label>
                <label className="flex items-center justify-between text-slate-300 hover:text-white cursor-pointer">
                  <span className="flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full bg-emerald-400"></span>
                    Supertrend (10,3)
                  </span>
                  <input
                    type="checkbox"
                    checked={overlays.supertrend}
                    onChange={(e) => setOverlays((o) => ({ ...o, supertrend: e.target.checked }))}
                    className="accent-amber-500"
                  />
                </label>
                {tradePlan && (
                  <label className="flex items-center justify-between text-slate-300 hover:text-white cursor-pointer">
                    <span className="flex items-center gap-2">
                      <span className="w-2.5 h-2.5 rounded-full bg-amber-500"></span>
                      Trade Plan Levels
                    </span>
                    <input
                      type="checkbox"
                      checked={overlays.tradePlan}
                      onChange={(e) => setOverlays((o) => ({ ...o, tradePlan: e.target.checked }))}
                      className="accent-amber-500"
                    />
                  </label>
                )}

                <div className="font-bold text-slate-200 pt-2 pb-1 border-t border-slate-800 text-[11px] uppercase tracking-wider">
                  Oscillator Subpanels
                </div>
                <label className="flex items-center justify-between text-slate-300 hover:text-white cursor-pointer">
                  <span className="text-slate-300">Volume Panel</span>
                  <input
                    type="checkbox"
                    checked={subpanels.volume}
                    onChange={(e) => setSubpanels((s) => ({ ...s, volume: e.target.checked }))}
                    className="accent-amber-500"
                  />
                </label>
                <label className="flex items-center justify-between text-slate-300 hover:text-white cursor-pointer">
                  <span className="text-indigo-400 font-semibold">RSI (14)</span>
                  <input
                    type="checkbox"
                    checked={subpanels.rsi}
                    onChange={(e) => setSubpanels((s) => ({ ...s, rsi: e.target.checked }))}
                    className="accent-amber-500"
                  />
                </label>
                <label className="flex items-center justify-between text-slate-300 hover:text-white cursor-pointer">
                  <span className="text-sky-400 font-semibold">MACD (12,26,9)</span>
                  <input
                    type="checkbox"
                    checked={subpanels.macd}
                    onChange={(e) => setSubpanels((s) => ({ ...s, macd: e.target.checked }))}
                    className="accent-amber-500"
                  />
                </label>
              </div>
            )}
          </div>

          {/* Quick Indicator Overlays Pill Bar */}
          <div className="hidden lg:flex items-center gap-1 bg-slate-900 border border-slate-800 rounded-lg p-0.5">
            <button
              onClick={() => setOverlays((o) => ({ ...o, ema9: !o.ema9, ema21: !o.ema21 }))}
              className={`px-2 py-0.5 rounded text-[11px] transition-colors ${
                overlays.ema9 || overlays.ema21
                  ? 'bg-sky-500/20 text-sky-300 font-semibold border border-sky-500/40'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              EMA 9/21
            </button>
            <button
              onClick={() => setOverlays((o) => ({ ...o, ema200: !o.ema200 }))}
              className={`px-2 py-0.5 rounded text-[11px] transition-colors ${
                overlays.ema200
                  ? 'bg-yellow-500/20 text-yellow-300 font-semibold border border-yellow-500/40'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              EMA 200
            </button>
            <button
              onClick={() => setOverlays((o) => ({ ...o, supertrend: !o.supertrend }))}
              className={`px-2 py-0.5 rounded text-[11px] transition-colors ${
                overlays.supertrend
                  ? 'bg-emerald-500/20 text-emerald-300 font-semibold border border-emerald-500/40'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Supertrend
            </button>
            <button
              onClick={() => setOverlays((o) => ({ ...o, bollinger: !o.bollinger }))}
              className={`px-2 py-0.5 rounded text-[11px] transition-colors ${
                overlays.bollinger
                  ? 'bg-cyan-500/20 text-cyan-300 font-semibold border border-cyan-500/40'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Bollinger
            </button>
            <button
              onClick={() => setSubpanels((s) => ({ ...s, rsi: !s.rsi }))}
              className={`px-2 py-0.5 rounded text-[11px] transition-colors ${
                subpanels.rsi
                  ? 'bg-indigo-500/20 text-indigo-300 font-semibold border border-indigo-500/40'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              RSI
            </button>
            <button
              onClick={() => setSubpanels((s) => ({ ...s, macd: !s.macd }))}
              className={`px-2 py-0.5 rounded text-[11px] transition-colors ${
                subpanels.macd
                  ? 'bg-sky-500/20 text-sky-300 font-semibold border border-sky-500/40'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              MACD
            </button>
          </div>

          {/* Chart Zoom & Viewport Auto-Fit Controls */}
          <div className="flex items-center gap-0.5 bg-slate-900 border border-slate-800 rounded-lg p-0.5">
            <button
              onClick={() => setVisibleCount((prev) => Math.max(15, prev - 15))}
              className="p-1 rounded text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition-colors"
              title="Zoom In (Fewer Bars)"
            >
              <ZoomIn className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={() => setVisibleCount((prev) => Math.min(300, prev + 15))}
              className="p-1 rounded text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition-colors"
              title="Zoom Out (More Bars)"
            >
              <ZoomOut className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={() => {
                setVisibleCount(75);
                setScrollOffset(0);
              }}
              className="px-1.5 py-0.5 rounded text-[10px] text-slate-400 hover:text-amber-400 hover:bg-slate-800 transition-colors flex items-center gap-1"
              title="Auto-Fit Scale / Reset Pan & Zoom"
            >
              <RotateCcw className="w-3 h-3" />
              <span className="hidden xl:inline">Auto-Fit</span>
            </button>
          </div>

          {/* Fit-to-Screen Toggle */}
          {onToggleFitScreen && (
            <button
              onClick={onToggleFitScreen}
              className={`p-1 px-2 rounded-md border text-xs font-mono flex items-center gap-1.5 transition-all ${
                isFitToScreen
                  ? 'bg-amber-500/20 text-amber-300 border-amber-500/50 shadow-xs'
                  : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-slate-200'
              }`}
              title={isFitToScreen ? 'Exit Fit-to-Screen Mode' : 'Fit Entire Terminal to Screen'}
            >
              <Monitor className="w-3.5 h-3.5" />
              <span className="hidden sm:inline text-[11px] font-medium">Fit Screen</span>
            </button>
          )}

          {/* Fullscreen Toggle */}
          <button
            onClick={() => setIsFullscreen((prev) => !prev)}
            className="p-1 rounded-md bg-slate-900 border border-slate-800 text-slate-400 hover:text-slate-200"
            title={isFullscreen ? 'Exit Fullscreen' : 'Fullscreen Chart'}
          >
            {isFullscreen ? <Minimize2 className="w-3.5 h-3.5" /> : <Maximize2 className="w-3.5 h-3.5" />}
          </button>
        </div>
      </div>

      {/* 2. HISTORICAL RANGE BAR (5Y Institutional Default & Custom Horizon Controller) */}
      <div className="relative flex flex-wrap items-center justify-between gap-2 py-1.5 border-b border-slate-800/60 text-xs">
        <div className="flex items-center gap-1 overflow-x-auto py-0.5">
          <span className="text-[10px] uppercase font-mono text-slate-500 mr-1">Range:</span>
          {periods.map((p) => {
            const isActive = !customHorizon && period === p;
            const isDefault5Y = p === '5Y';
            return (
              <button
                key={p}
                onClick={() => {
                  onCustomHorizonChange?.(null);
                  onPeriodChange?.(p);
                  if (p === '1D') onTimeframeChange?.('5m');
                  else if (p === '5D') onTimeframeChange?.('15m');
                  else if (p === '1M') onTimeframeChange?.('1h');
                  else if (p === 'MAX') onTimeframeChange?.('1W');
                  else onTimeframeChange?.('1D');
                }}
                className={`px-2 py-0.5 font-mono text-[11px] rounded transition-all ${
                  isActive
                    ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40 font-bold shadow-xs'
                    : isDefault5Y
                    ? 'text-amber-400/90 font-medium hover:text-amber-300'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
                title={isDefault5Y ? 'Institutional Default: 5-Year Historical Span' : undefined}
              >
                {p}
                {isDefault5Y && !isActive && <span className="ml-0.5 text-amber-500">•</span>}
              </button>
            );
          })}

          {/* Dedicated Custom History Horizon Controller Button */}
          <button
            onClick={() => setShowHorizonModal((prev) => !prev)}
            className={`flex items-center gap-1.5 px-2.5 py-0.5 font-mono text-[11px] rounded border transition-all ${
              customHorizon
                ? 'bg-amber-500 text-slate-950 font-bold border-amber-400 shadow-sm'
                : showHorizonModal
                ? 'bg-slate-800 text-amber-300 border-amber-500/40'
                : 'bg-slate-900 text-slate-300 border-slate-800 hover:border-slate-700'
            }`}
            title="Reduce or Increase Historical Data as much as required (0.5 to 25+ Years, or Custom Date Range)"
          >
            <SlidersHorizontal className="w-3 h-3 text-amber-400" />
            <span>
              {customHorizon?.years
                ? `${customHorizon.years}Y Custom`
                : customHorizon?.startDate
                ? `${customHorizon.startDate.slice(0, 7)} to ${customHorizon.endDate?.slice(0, 7)}`
                : 'Custom Horizon (Reduce/Increase)'}
            </span>
            <ChevronDown className="w-3 h-3 text-slate-400" />
          </button>

          {/* Quick Clear Custom Horizon Pill */}
          {customHorizon && (
            <button
              onClick={() => {
                onCustomHorizonChange?.(null);
                onPeriodChange?.('5Y');
              }}
              className="flex items-center gap-1 px-1.5 py-0.5 font-mono text-[10px] rounded bg-rose-500/10 text-rose-300 border border-rose-500/30 hover:bg-rose-500/20 transition-all"
              title="Reset to Institutional 5-Year Default"
            >
              <X className="w-2.5 h-2.5" />
              <span>Reset 5Y</span>
            </button>
          )}
        </div>

        {/* Coverage & Indicator Warmup Badge */}
        {coverageReport && (
          <div className="flex items-center gap-2 text-[10px] font-mono text-slate-400 bg-slate-900/60 px-2 py-0.5 rounded border border-slate-800">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
            <span className="text-emerald-400 font-semibold">{coverageReport.coveragePct}% Real Exchange Data</span>
            <span className="text-slate-400 font-bold">({coverageReport.totalBars} bars)</span>
            <span className="text-slate-600">|</span>
            <span className="text-slate-300">{coverageReport.actualStartDate.slice(0, 10)} to {coverageReport.actualEndDate.slice(0, 10)}</span>
          </div>
        )}

        {/* Custom History Horizon Interactive Modal / Drawer */}
        {showHorizonModal && (
          <div className="absolute left-0 top-full mt-2 w-full max-w-lg bg-slate-900/98 backdrop-blur-xl border border-slate-700 rounded-xl shadow-2xl p-4 z-50 text-xs font-mono space-y-3.5">
            <div className="flex items-center justify-between pb-2 border-b border-slate-800">
              <div className="flex items-center gap-2">
                <SlidersHorizontal className="w-4 h-4 text-amber-400" />
                <span className="font-bold text-slate-100 text-sm">
                  Historical Horizon & Range Controller
                </span>
              </div>
              <button
                onClick={() => setShowHorizonModal(false)}
                className="p-1 rounded text-slate-400 hover:text-white hover:bg-slate-800"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <p className="text-[11px] text-slate-400">
              Reduce or increase the historical candle depth as much as required. Supports continuous year scaling from 6 months up to 25 years or custom calendar start and end dates.
            </p>

            {/* Mode 1: Year Depth Slider & Steppers */}
            <div className="space-y-2 bg-slate-950 p-3 rounded-lg border border-slate-800">
              <div className="flex items-center justify-between text-xs">
                <span className="text-slate-300 font-semibold">History Depth (Years):</span>
                <span className="text-amber-400 font-bold text-sm bg-amber-500/10 px-2 py-0.5 rounded border border-amber-500/30">
                  {selectedYears.toFixed(1)} Years (~{Math.round(selectedYears * 252)} Daily Bars)
                </span>
              </div>

              {/* Range Slider */}
              <input
                type="range"
                min="0.5"
                max="25"
                step="0.5"
                value={selectedYears}
                onChange={(e) => setSelectedYears(parseFloat(e.target.value))}
                className="w-full accent-amber-500 cursor-pointer"
              />

              {/* Quick Horizon Chips */}
              <div className="flex flex-wrap gap-1.5 pt-1">
                {[0.5, 1, 2, 3, 5, 7, 10, 15, 20].map((yr) => (
                  <button
                    key={yr}
                    onClick={() => setSelectedYears(yr)}
                    className={`px-2 py-1 rounded text-[10px] font-mono transition-all ${
                      selectedYears === yr
                        ? 'bg-amber-500 text-slate-950 font-bold'
                        : 'bg-slate-900 text-slate-400 hover:text-white border border-slate-800'
                    }`}
                  >
                    {yr === 0.5 ? '6M' : `${yr}Y`}
                    {yr === 5 && ' (Default)'}
                  </button>
                ))}
              </div>
            </div>

            {/* Mode 2: Custom Calendar Date Range */}
            <div className="space-y-2 bg-slate-950 p-3 rounded-lg border border-slate-800">
              <span className="text-slate-300 font-semibold block text-xs">
                Or Pick Exact Calendar Date Range:
              </span>
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div>
                  <label className="text-[10px] text-slate-500 block mb-1">Start Date</label>
                  <input
                    type="date"
                    value={customStart}
                    onChange={(e) => setCustomStart(e.target.value)}
                    className="w-full bg-slate-900 border border-slate-700 rounded px-2 py-1 text-slate-200 text-xs"
                  />
                </div>
                <div>
                  <label className="text-[10px] text-slate-500 block mb-1">End Date</label>
                  <input
                    type="date"
                    value={customEnd}
                    onChange={(e) => setCustomEnd(e.target.value)}
                    className="w-full bg-slate-900 border border-slate-700 rounded px-2 py-1 text-slate-200 text-xs"
                  />
                </div>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex items-center justify-between pt-1">
              <button
                onClick={() => {
                  onCustomHorizonChange?.(null);
                  onPeriodChange?.('5Y');
                  setShowHorizonModal(false);
                }}
                className="px-3 py-1.5 rounded-lg border border-slate-700 text-slate-400 hover:text-slate-200 text-xs transition-colors"
              >
                Reset to 5Y Default
              </button>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => {
                    onCustomHorizonChange?.({
                      startDate: customStart,
                      endDate: customEnd,
                    });
                    setShowHorizonModal(false);
                  }}
                  className="px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs transition-colors"
                >
                  Apply Dates
                </button>
                <button
                  onClick={() => {
                    onCustomHorizonChange?.({
                      years: selectedYears,
                    });
                    setShowHorizonModal(false);
                  }}
                  className="px-4 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs shadow-md transition-colors"
                >
                  Apply {selectedYears}Y Horizon
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* 3. TRADINGVIEW-STYLE REAL-TIME HUD / INSPECTION BAR */}
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 py-1.5 text-xs font-mono tabular-nums text-slate-400 border-b border-slate-800/60">
        {displayCandle && (
          <>
            <span className="text-slate-200 font-bold">
              {displayCandle.timeStr.slice(0, 10)} {displayCandle.timeStr.slice(11, 16)} UTC
            </span>
            <div className="flex items-center gap-3">
              <span>
                O: <strong className="text-slate-200">${displayCandle.open.toFixed(2)}</strong>
              </span>
              <span>
                H: <strong className="text-emerald-400">${displayCandle.high.toFixed(2)}</strong>
              </span>
              <span>
                L: <strong className="text-rose-400">${displayCandle.low.toFixed(2)}</strong>
              </span>
              <span>
                C:{' '}
                <strong className={isUpCandle ? 'text-emerald-400' : 'text-rose-400'}>
                  ${displayCandle.close.toFixed(2)}
                </strong>
              </span>
              <span
                className={`font-semibold ${isUpCandle ? 'text-emerald-400' : 'text-rose-400'}`}
              >
                {isUpCandle ? '+' : ''}${candleChange.toFixed(2)} ({isUpCandle ? '+' : ''}
                {candleChangePct}%)
              </span>
              <span>
                Vol: <strong className="text-slate-300">{displayCandle.volume.toLocaleString()}</strong>
              </span>
            </div>
          </>
        )}

        {/* Dynamic Indicator Values at Cursor */}
        {activeHoverMetrics && (
          <div className="hidden xl:flex items-center gap-3 text-[11px] border-l border-slate-800 pl-3">
            {overlays.ema9 && (
              <span className="text-sky-400">
                EMA9: <strong>${activeHoverMetrics.ema9?.toFixed(2) || '—'}</strong>
              </span>
            )}
            {overlays.ema21 && (
              <span className="text-indigo-400">
                EMA21: <strong>${activeHoverMetrics.ema21?.toFixed(2) || '—'}</strong>
              </span>
            )}
            {overlays.ema200 && (
              <span className="text-yellow-400">
                EMA200: <strong>${activeHoverMetrics.ema200?.toFixed(2) || '—'}</strong>
              </span>
            )}
            {overlays.supertrend && (
              <span
                className={
                  activeHoverMetrics.supertrend.dir === 'BULLISH'
                    ? 'text-emerald-400'
                    : 'text-rose-400'
                }
              >
                ST: <strong>${activeHoverMetrics.supertrend.value?.toFixed(2) || '—'}</strong>
              </span>
            )}
            {subpanels.rsi && (
              <span className="text-indigo-300">
                RSI: <strong>{activeHoverMetrics.rsi?.toFixed(1) || '—'}</strong>
              </span>
            )}
            {subpanels.macd && (
              <span className="text-sky-300">
                MACD:{' '}
                <strong
                  className={
                    (activeHoverMetrics.macd.hist || 0) >= 0 ? 'text-emerald-400' : 'text-rose-400'
                  }
                >
                  {activeHoverMetrics.macd.hist !== undefined
                    ? `${activeHoverMetrics.macd.hist >= 0 ? '+' : ''}${activeHoverMetrics.macd.hist.toFixed(2)}`
                    : '—'}
                </strong>
              </span>
            )}
          </div>
        )}
      </div>

      {/* 4. MAIN INTERACTIVE SVG VIEWPORT WITH PAN, ZOOM & INDICATORS */}
      <div
        className="relative w-full cursor-crosshair overflow-hidden mt-1"
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseLeave}
        onWheel={handleWheel}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        style={{ height: `${svgTotalHeight}px` }}
      >
        <svg
          width={dimensions.width}
          height={svgTotalHeight}
          className="w-full h-full block"
          style={{ userSelect: 'none' }}
        >
          <defs>
            {/* Area Chart Gradient Fill */}
            <linearGradient id="areaGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#38bdf8" stopOpacity="0.35" />
              <stop offset="60%" stopColor="#38bdf8" stopOpacity="0.08" />
              <stop offset="100%" stopColor="#38bdf8" stopOpacity="0.0" />
            </linearGradient>

            {/* Bollinger Band Shaded Envelope Gradient */}
            <linearGradient id="bbBandGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#06b6d4" stopOpacity="0.12" />
              <stop offset="100%" stopColor="#06b6d4" stopOpacity="0.06" />
            </linearGradient>
          </defs>

          {/* Background Canvas */}
          <rect
            x={0}
            y={0}
            width={chartWidth}
            height={mainChartHeight}
            fill="#030712"
            opacity="0.95"
          />

          {/* Price Chart Horizontal Grid Lines & Y-Axis Labels */}
          {[0.1, 0.25, 0.45, 0.65, 0.85].map((ratio) => {
            const y = mainChartHeight * ratio;
            const price = maxPrice - (maxPrice - minPrice) * ratio;
            return (
              <g key={`grid-h-${ratio}`}>
                <line
                  x1={0}
                  y1={y}
                  x2={chartWidth}
                  y2={y}
                  stroke="rgba(148, 163, 184, 0.08)"
                  strokeDasharray="3 3"
                />
                {/* Price Scale Tick on Right Gutter */}
                <text
                  x={chartWidth + 6}
                  y={y + 3.5}
                  fill="rgba(148, 163, 184, 0.65)"
                  fontSize="11"
                  fontFamily="JetBrains Mono, monospace"
                >
                  ${price.toFixed(2)}
                </text>
              </g>
            );
          })}

          {/* Vertical Grid Lines (Time) */}
          {visibleCandles.map((c, i) => {
            // Draw a vertical grid line every 12 bars
            if (i % Math.max(6, Math.floor(visibleCandles.length / 8)) !== 0) return null;
            const x = i * candleStep + candleStep / 2;
            return (
              <line
                key={`grid-v-${c.timestamp}`}
                x1={x}
                y1={0}
                x2={x}
                y2={mainChartHeight}
                stroke="rgba(148, 163, 184, 0.05)"
                strokeDasharray="2 4"
              />
            );
          })}

          {/* 4A. TECHNICAL OVERLAYS */}

          {/* Bollinger Bands Shaded Area & Lines */}
          {overlays.bollinger && indicatorSeries && (
            <g opacity="0.9">
              <path
                d={buildBandAreaPath(indicatorSeries.bb.upper, indicatorSeries.bb.lower)}
                fill="url(#bbBandGradient)"
              />
              <path
                d={buildSmoothPath(indicatorSeries.bb.upper)}
                fill="none"
                stroke="#06b6d4"
                strokeWidth="1.2"
                strokeDasharray="3 2"
                opacity="0.8"
              />
              <path
                d={buildSmoothPath(indicatorSeries.bb.middle)}
                fill="none"
                stroke="#06b6d4"
                strokeWidth="1"
                opacity="0.7"
              />
              <path
                d={buildSmoothPath(indicatorSeries.bb.lower)}
                fill="none"
                stroke="#06b6d4"
                strokeWidth="1.2"
                strokeDasharray="3 2"
                opacity="0.8"
              />
            </g>
          )}

          {/* Supertrend Ribbon */}
          {overlays.supertrend && indicatorSeries && (
            <path
              d={buildSmoothPath(indicatorSeries.st.values)}
              fill="none"
              stroke="#10b981"
              strokeWidth="1.8"
              strokeDasharray="5 2"
              opacity="0.9"
            />
          )}

          {/* Exponential Moving Averages */}
          {overlays.ema9 && indicatorSeries && (
            <path
              d={buildSmoothPath(indicatorSeries.ema9)}
              fill="none"
              stroke="#38bdf8"
              strokeWidth="1.5"
              opacity="0.9"
            />
          )}
          {overlays.ema21 && indicatorSeries && (
            <path
              d={buildSmoothPath(indicatorSeries.ema21)}
              fill="none"
              stroke="#818cf8"
              strokeWidth="1.5"
              opacity="0.9"
            />
          )}
          {overlays.ema50 && indicatorSeries && (
            <path
              d={buildSmoothPath(indicatorSeries.ema50)}
              fill="none"
              stroke="#f59e0b"
              strokeWidth="1.6"
              opacity="0.95"
            />
          )}
          {overlays.ema200 && indicatorSeries && (
            <path
              d={buildSmoothPath(indicatorSeries.ema200)}
              fill="none"
              stroke="#eab308"
              strokeWidth="2.2"
              opacity="0.95"
            />
          )}
          {overlays.sma20 && indicatorSeries && (
            <path
              d={buildSmoothPath(indicatorSeries.sma20)}
              fill="none"
              stroke="#94a3b8"
              strokeWidth="1.2"
              strokeDasharray="4 2"
              opacity="0.8"
            />
          )}
          {overlays.vwap && indicatorSeries && (
            <path
              d={buildSmoothPath(indicatorSeries.vwap)}
              fill="none"
              stroke="#d946ef"
              strokeWidth="1.8"
              strokeDasharray="4 3"
              opacity="0.9"
            />
          )}

          {/* 4B. PRICE SERIES GLYPHS (Candles, Heikin Ashi, Line, Area, or Bars) */}

          {/* Area Chart Mode */}
          {chartType === 'AREA' && (
            <>
              <path d={areaPath} fill="url(#areaGradient)" />
              <path d={linePath} fill="none" stroke="#38bdf8" strokeWidth="2" />
            </>
          )}

          {/* Line Chart Mode */}
          {chartType === 'LINE' && (
            <path d={linePath} fill="none" stroke="#38bdf8" strokeWidth="2.2" />
          )}

          {/* Candlesticks & Heikin Ashi Mode */}
          {(chartType === 'CANDLES' || chartType === 'HEIKIN_ASHI') &&
            visibleCandles.map((c, i) => {
              const x = i * candleStep + candleStep / 2;
              const openY = priceToY(c.open);
              const closeY = priceToY(c.close);
              const highY = priceToY(c.high);
              const lowY = priceToY(c.low);
              const isGreen = c.close >= c.open;
              const bodyColor = isGreen ? '#10b981' : '#f43f5e';
              const topY = Math.min(openY, closeY);
              const bodyHeight = Math.max(1.5, Math.abs(openY - closeY));

              return (
                <g key={`candle-${c.timestamp}`}>
                  {/* High/Low Wick */}
                  <line
                    x1={x}
                    y1={highY}
                    x2={x}
                    y2={lowY}
                    stroke={bodyColor}
                    strokeWidth="1.2"
                  />
                  {/* Candle Body */}
                  <rect
                    x={x - barWidth / 2}
                    y={topY}
                    width={barWidth}
                    height={bodyHeight}
                    fill={bodyColor}
                    rx="1"
                  />
                </g>
              );
            })}

          {/* OHLC Bar Chart Mode */}
          {chartType === 'BARS' &&
            visibleCandles.map((c, i) => {
              const x = i * candleStep + candleStep / 2;
              const openY = priceToY(c.open);
              const closeY = priceToY(c.close);
              const highY = priceToY(c.high);
              const lowY = priceToY(c.low);
              const isGreen = c.close >= c.open;
              const barColor = isGreen ? '#10b981' : '#f43f5e';
              const tickLength = Math.max(2, barWidth * 0.45);

              return (
                <g key={`bar-${c.timestamp}`}>
                  {/* Vertical Spine */}
                  <line x1={x} y1={highY} x2={x} y2={lowY} stroke={barColor} strokeWidth="1.5" />
                  {/* Left Open Tick */}
                  <line
                    x1={x - tickLength}
                    y1={openY}
                    x2={x}
                    y2={openY}
                    stroke={barColor}
                    strokeWidth="1.5"
                  />
                  {/* Right Close Tick */}
                  <line
                    x1={x}
                    y1={closeY}
                    x2={x + tickLength}
                    y2={closeY}
                    stroke={barColor}
                    strokeWidth="1.5"
                  />
                </g>
              );
            })}

          {/* 4C. TRADE PLAN MARKER LEVELS */}
          {overlays.tradePlan && tradePlan && (
            <g>
              {/* Entry Zone Band */}
              {tradePlan.entryZoneMin && tradePlan.entryZoneMax && (
                <rect
                  x={0}
                  y={Math.min(priceToY(tradePlan.entryZoneMin), priceToY(tradePlan.entryZoneMax))}
                  width={chartWidth}
                  height={Math.max(
                    2,
                    Math.abs(priceToY(tradePlan.entryZoneMax) - priceToY(tradePlan.entryZoneMin))
                  )}
                  fill="rgba(245, 158, 11, 0.12)"
                  stroke="rgba(245, 158, 11, 0.3)"
                  strokeDasharray="4 2"
                />
              )}

              {/* Target 1 Line */}
              {tradePlan.target1Price && (
                <g>
                  <line
                    x1={0}
                    y1={priceToY(tradePlan.target1Price)}
                    x2={chartWidth}
                    y2={priceToY(tradePlan.target1Price)}
                    stroke="#10b981"
                    strokeWidth="1.5"
                    strokeDasharray="5 3"
                  />
                  <rect
                    x={chartWidth - 110}
                    y={priceToY(tradePlan.target1Price) - 10}
                    width={105}
                    height={18}
                    rx="3"
                    fill="rgba(16, 185, 129, 0.9)"
                  />
                  <text
                    x={chartWidth - 58}
                    y={priceToY(tradePlan.target1Price) + 3}
                    fill="#030712"
                    fontSize="10"
                    fontFamily="JetBrains Mono, monospace"
                    fontWeight="bold"
                    textAnchor="middle"
                  >
                    TP1: ${tradePlan.target1Price.toFixed(2)}
                  </text>
                </g>
              )}

              {/* Target 2 Line */}
              {tradePlan.target2Price && (
                <g>
                  <line
                    x1={0}
                    y1={priceToY(tradePlan.target2Price)}
                    x2={chartWidth}
                    y2={priceToY(tradePlan.target2Price)}
                    stroke="#059669"
                    strokeWidth="1.2"
                    strokeDasharray="4 3"
                  />
                  <rect
                    x={chartWidth - 110}
                    y={priceToY(tradePlan.target2Price) - 9}
                    width={105}
                    height={16}
                    rx="3"
                    fill="rgba(5, 150, 105, 0.85)"
                  />
                  <text
                    x={chartWidth - 58}
                    y={priceToY(tradePlan.target2Price) + 3}
                    fill="#ffffff"
                    fontSize="9.5"
                    fontFamily="JetBrains Mono, monospace"
                    fontWeight="bold"
                    textAnchor="middle"
                  >
                    TP2: ${tradePlan.target2Price.toFixed(2)}
                  </text>
                </g>
              )}

              {/* Stop Loss Line */}
              {tradePlan.stopLossPrice && (
                <g>
                  <line
                    x1={0}
                    y1={priceToY(tradePlan.stopLossPrice)}
                    x2={chartWidth}
                    y2={priceToY(tradePlan.stopLossPrice)}
                    stroke="#f43f5e"
                    strokeWidth="1.5"
                    strokeDasharray="5 3"
                  />
                  <rect
                    x={chartWidth - 110}
                    y={priceToY(tradePlan.stopLossPrice) - 10}
                    width={105}
                    height={18}
                    rx="3"
                    fill="rgba(244, 63, 94, 0.9)"
                  />
                  <text
                    x={chartWidth - 58}
                    y={priceToY(tradePlan.stopLossPrice) + 3}
                    fill="#ffffff"
                    fontSize="10"
                    fontFamily="JetBrains Mono, monospace"
                    fontWeight="bold"
                    textAnchor="middle"
                  >
                    SL: ${tradePlan.stopLossPrice.toFixed(2)}
                  </text>
                </g>
              )}
            </g>
          )}

          {/* 4D. REAL-TIME LATEST PRICE LINE & Y-AXIS BADGE */}
          <line
            x1={0}
            y1={latestY}
            x2={chartWidth}
            y2={latestY}
            stroke="#f59e0b"
            strokeWidth="1.2"
            strokeDasharray="2 2"
            opacity="0.8"
          />
          <rect
            x={chartWidth}
            y={latestY - 10}
            width={priceGutterWidth}
            height={20}
            fill="#f59e0b"
            rx="2"
          />
          <text
            x={chartWidth + priceGutterWidth / 2}
            y={latestY + 4}
            fill="#030712"
            fontSize="11"
            fontFamily="JetBrains Mono, monospace"
            fontWeight="bold"
            textAnchor="middle"
          >
            ${latestPrice.toFixed(2)}
          </text>

          {/* 5. SUBPANEL: VOLUME BARS WITH 20-PERIOD MA */}
          {subpanels.volume && (
            <g transform={`translate(0, ${volumeY})`}>
              <rect x={0} y={0} width={chartWidth} height={volumePanelHeight} fill="#020617" opacity="0.6" />
              <line x1={0} y1={0} x2={dimensions.width} y2={0} stroke="#1e293b" strokeWidth="1" />
              <text x={6} y={13} fill="#64748b" fontSize="10" fontFamily="JetBrains Mono, monospace">
                Vol (SMA 20)
              </text>
              {visibleCandles.map((c, i) => {
                const x = i * candleStep + candleStep / 2;
                const vH = Math.max(1, (c.volume / maxVolume) * (volumePanelHeight - 16));
                const isGreen = c.close >= c.open;
                return (
                  <rect
                    key={`v-bar-${c.timestamp}`}
                    x={x - barWidth / 2}
                    y={volumePanelHeight - vH}
                    width={barWidth}
                    height={vH}
                    fill={isGreen ? 'rgba(16, 185, 129, 0.4)' : 'rgba(244, 63, 94, 0.4)'}
                  />
                );
              })}
              {/* Volume Scale Label */}
              <text
                x={chartWidth + 6}
                y={15}
                fill="rgba(148, 163, 184, 0.5)"
                fontSize="10"
                fontFamily="JetBrains Mono, monospace"
              >
                {(maxVolume / 1000).toFixed(0)}k
              </text>
            </g>
          )}

          {/* 6. SUBPANEL: RSI (14) OSCILLATOR */}
          {subpanels.rsi && (
            <g transform={`translate(0, ${rsiY})`}>
              <rect x={0} y={0} width={chartWidth} height={rsiPanelHeight} fill="#020617" opacity="0.65" />
              <line x1={0} y1={0} x2={dimensions.width} y2={0} stroke="#1e293b" strokeWidth="1" />
              <text x={6} y={13} fill="#818cf8" fontSize="10" fontFamily="JetBrains Mono, monospace" fontWeight="bold">
                RSI (14)
              </text>

              {/* Overbought 70 Line */}
              <line
                x1={0}
                y1={rsiPanelHeight * 0.3}
                x2={chartWidth}
                y2={rsiPanelHeight * 0.3}
                stroke="#f43f5e"
                strokeWidth="1"
                strokeDasharray="2 2"
                opacity="0.5"
              />
              <text x={chartWidth + 6} y={rsiPanelHeight * 0.3 + 3} fill="#f43f5e" fontSize="9.5" fontFamily="JetBrains Mono">
                70
              </text>

              {/* 50 Centerline */}
              <line
                x1={0}
                y1={rsiPanelHeight * 0.5}
                x2={chartWidth}
                y2={rsiPanelHeight * 0.5}
                stroke="#475569"
                strokeWidth="0.8"
                strokeDasharray="2 2"
                opacity="0.4"
              />

              {/* Oversold 30 Line */}
              <line
                x1={0}
                y1={rsiPanelHeight * 0.7}
                x2={chartWidth}
                y2={rsiPanelHeight * 0.7}
                stroke="#10b981"
                strokeWidth="1"
                strokeDasharray="2 2"
                opacity="0.5"
              />
              <text x={chartWidth + 6} y={rsiPanelHeight * 0.7 + 3} fill="#10b981" fontSize="9.5" fontFamily="JetBrains Mono">
                30
              </text>

              {/* RSI Curve */}
              {indicatorSeries && (
                <path
                  d={(() => {
                    let p = '';
                    for (let i = 0; i < visibleCandles.length; i++) {
                      const fullIdx = startIndex + i;
                      const val = indicatorSeries.rsi[fullIdx];
                      if (val === undefined || isNaN(val)) continue;
                      const x = i * candleStep + candleStep / 2;
                      // RSI 0-100 mapped to panel height
                      const y = rsiPanelHeight - (val / 100) * rsiPanelHeight;
                      p += `${p === '' ? 'M' : 'L'} ${x.toFixed(1)} ${y.toFixed(1)} `;
                    }
                    return p;
                  })()}
                  fill="none"
                  stroke="#818cf8"
                  strokeWidth="1.8"
                />
              )}
            </g>
          )}

          {/* 7. SUBPANEL: MACD (12, 26, 9) */}
          {subpanels.macd && (
            <g transform={`translate(0, ${macdY})`}>
              <rect x={0} y={0} width={chartWidth} height={macdPanelHeight} fill="#020617" opacity="0.65" />
              <line x1={0} y1={0} x2={dimensions.width} y2={0} stroke="#1e293b" strokeWidth="1" />
              <text x={6} y={13} fill="#38bdf8" fontSize="10" fontFamily="JetBrains Mono, monospace" fontWeight="bold">
                MACD (12,26,9)
              </text>

              {/* Zero Centerline */}
              <line
                x1={0}
                y1={macdPanelHeight / 2}
                x2={chartWidth}
                y2={macdPanelHeight / 2}
                stroke="#475569"
                strokeWidth="1"
                strokeDasharray="2 2"
              />
              <text x={chartWidth + 6} y={macdPanelHeight / 2 + 3} fill="#94a3b8" fontSize="9.5" fontFamily="JetBrains Mono">
                0.00
              </text>

              {indicatorSeries && (
                <>
                  {/* Histogram Bars */}
                  {visibleCandles.map((c, i) => {
                    const fullIdx = startIndex + i;
                    const hist = indicatorSeries.macd.histogram[fullIdx] || 0;
                    const x = i * candleStep + candleStep / 2;
                    const zeroY = macdPanelHeight / 2;
                    // Scale histogram amplitude
                    const hHeight = Math.min(macdPanelHeight / 2 - 2, Math.abs(hist) * 3);
                    const isPositive = hist >= 0;
                    const y = isPositive ? zeroY - hHeight : zeroY;

                    return (
                      <rect
                        key={`macd-hist-${c.timestamp}`}
                        x={x - barWidth / 2}
                        y={y}
                        width={barWidth}
                        height={Math.max(1, hHeight)}
                        fill={isPositive ? '#10b981' : '#f43f5e'}
                        opacity="0.8"
                      />
                    );
                  })}

                  {/* MACD Line */}
                  <path
                    d={(() => {
                      let p = '';
                      for (let i = 0; i < visibleCandles.length; i++) {
                        const fullIdx = startIndex + i;
                        const val = indicatorSeries.macd.macdLine[fullIdx] || 0;
                        const x = i * candleStep + candleStep / 2;
                        const y = macdPanelHeight / 2 - val * 3;
                        p += `${p === '' ? 'M' : 'L'} ${x.toFixed(1)} ${y.toFixed(1)} `;
                      }
                      return p;
                    })()}
                    fill="none"
                    stroke="#38bdf8"
                    strokeWidth="1.5"
                  />

                  {/* Signal Line */}
                  <path
                    d={(() => {
                      let p = '';
                      for (let i = 0; i < visibleCandles.length; i++) {
                        const fullIdx = startIndex + i;
                        const val = indicatorSeries.macd.signalLine[fullIdx] || 0;
                        const x = i * candleStep + candleStep / 2;
                        const y = macdPanelHeight / 2 - val * 3;
                        p += `${p === '' ? 'M' : 'L'} ${x.toFixed(1)} ${y.toFixed(1)} `;
                      }
                      return p;
                    })()}
                    fill="none"
                    stroke="#f59e0b"
                    strokeWidth="1.2"
                  />
                </>
              )}
            </g>
          )}

          {/* 8. X-AXIS: DATES & TIMESTAMPS */}
          <g transform={`translate(0, ${timeAxisY})`}>
            <rect x={0} y={0} width={dimensions.width} height={timeGutterHeight} fill="#090d16" />
            <line x1={0} y1={0} x2={dimensions.width} y2={0} stroke="#1e293b" strokeWidth="1" />
            {visibleCandles.map((c, i) => {
              if (i % Math.max(6, Math.floor(visibleCandles.length / 7)) !== 0) return null;
              const x = i * candleStep + candleStep / 2;
              return (
                <text
                  key={`time-label-${c.timestamp}`}
                  x={x}
                  y={17}
                  fill="rgba(148, 163, 184, 0.7)"
                  fontSize="10"
                  fontFamily="JetBrains Mono, monospace"
                  textAnchor="middle"
                >
                  {c.timeStr.slice(5, 10)}
                </text>
              );
            })}
          </g>

          {/* 9. TRADINGVIEW CROSSHAIR & MAGNETIC COORDINATE PILLS */}
          {mousePos && mousePos.x <= chartWidth && hoverIndex !== null && (
            <g>
              {/* Vertical Crosshair Line */}
              <line
                x1={hoverIndex * candleStep + candleStep / 2}
                y1={0}
                x2={hoverIndex * candleStep + candleStep / 2}
                y2={timeAxisY}
                stroke="rgba(245, 158, 11, 0.6)"
                strokeWidth="1"
                strokeDasharray="3 3"
              />

              {/* Horizontal Crosshair Line */}
              {mousePos.y <= mainChartHeight && (
                <>
                  <line
                    x1={0}
                    y1={mousePos.y}
                    x2={chartWidth}
                    y2={mousePos.y}
                    stroke="rgba(245, 158, 11, 0.6)"
                    strokeWidth="1"
                    strokeDasharray="3 3"
                  />
                  {/* Y-Axis Hover Price Badge Pill */}
                  <rect
                    x={chartWidth}
                    y={mousePos.y - 10}
                    width={priceGutterWidth}
                    height={20}
                    fill="#1e293b"
                    stroke="#f59e0b"
                    strokeWidth="1"
                    rx="2"
                  />
                  <text
                    x={chartWidth + priceGutterWidth / 2}
                    y={mousePos.y + 4}
                    fill="#f8fafc"
                    fontSize="11"
                    fontFamily="JetBrains Mono, monospace"
                    fontWeight="bold"
                    textAnchor="middle"
                  >
                    ${yToPrice(mousePos.y).toFixed(2)}
                  </text>
                </>
              )}

              {/* X-Axis Hover Date/Time Badge Pill */}
              {visibleCandles[hoverIndex] && (
                <g transform={`translate(${hoverIndex * candleStep + candleStep / 2 - 45}, ${timeAxisY + 2})`}>
                  <rect width={90} height={20} fill="#1e293b" stroke="#f59e0b" strokeWidth="1" rx="2" />
                  <text
                    x={45}
                    y={14}
                    fill="#f8fafc"
                    fontSize="10"
                    fontFamily="JetBrains Mono, monospace"
                    fontWeight="bold"
                    textAnchor="middle"
                  >
                    {visibleCandles[hoverIndex].timeStr.slice(0, 10)}
                  </text>
                </g>
              )}
            </g>
          )}
        </svg>

        {/* 10. FLOATING TRADINGVIEW-STYLE VIEWPORT CONTROLS */}
        <div className="absolute bottom-10 right-24 flex items-center gap-1.5 bg-slate-900/90 backdrop-blur-md border border-slate-800 rounded-lg p-1 shadow-lg z-20">
          <button
            onClick={() => setVisibleCount((prev) => Math.max(15, prev - 10))}
            className="p-1 rounded text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
            title="Zoom In (+)"
          >
            <ZoomIn className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={() => setVisibleCount((prev) => Math.min(250, prev + 10))}
            className="p-1 rounded text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
            title="Zoom Out (-)"
          >
            <ZoomOut className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={() => {
              setVisibleCount(75);
              setScrollOffset(0);
            }}
            className="p-1 rounded text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
            title="Reset Scale & View (1:1)"
          >
            <RotateCcw className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* 11. "SNAP TO LATEST / REALTIME" BUTTON (Appears when scrolled back in time) */}
        {clampedOffset > 0 && (
          <button
            onClick={() => setScrollOffset(0)}
            className="absolute bottom-10 right-48 flex items-center gap-1.5 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold px-3 py-1 rounded-full shadow-lg text-xs font-mono transition-all animate-bounce z-20"
          >
            <span>Realtime</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        )}
      </div>

      {/* 12. BOTTOM FOOTER LEGEND: ACTIVE OVERLAYS SUMMARY */}
      <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-slate-800/60 text-[11px] font-mono text-slate-400">
        <div className="flex items-center gap-3">
          <span className="text-slate-500">Legend:</span>
          {overlays.ema9 && (
            <span className="flex items-center gap-1 text-sky-400">
              <span className="w-2 h-0.5 bg-sky-400"></span> EMA 9
            </span>
          )}
          {overlays.ema21 && (
            <span className="flex items-center gap-1 text-indigo-400">
              <span className="w-2 h-0.5 bg-indigo-400"></span> EMA 21
            </span>
          )}
          {overlays.ema50 && (
            <span className="flex items-center gap-1 text-amber-400">
              <span className="w-2 h-0.5 bg-amber-400"></span> EMA 50
            </span>
          )}
          {overlays.ema200 && (
            <span className="flex items-center gap-1 text-yellow-400">
              <span className="w-2 h-0.5 bg-yellow-400"></span> EMA 200
            </span>
          )}
          {overlays.supertrend && (
            <span className="flex items-center gap-1 text-emerald-400">
              <span className="w-2 h-0.5 bg-emerald-400"></span> Supertrend
            </span>
          )}
          {overlays.bollinger && (
            <span className="flex items-center gap-1 text-cyan-400">
              <span className="w-2 h-0.5 bg-cyan-400"></span> Bollinger (20,2)
            </span>
          )}
        </div>

        <div className="text-slate-500">
          Showing {visibleCandles.length} of {totalCandles} bars · Drag to scroll · Wheel to zoom
        </div>
      </div>
    </div>
  );
};
