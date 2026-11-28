/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * Aurum Intelligence — Strategy Bias Rationale Panel & Modal
 * Transparently decomposes the deterministic logic, technical triggers,
 * sentiment catalysts, and divergence notices behind BUY / SELL / HOLD recommendations.
 */

import React, { useEffect, useMemo, useState } from 'react';
import {
  AdvisoryHorizon,
  Candle,
  IndicatorSnapshot,
  Quote,
  TradePlan,
} from '../domain/types';
import {
  buildStrategyBiasRationale,
  StrategyBiasRationale,
  StrategySentimentFactor,
  StrategyTriggerFactor,
} from '../services/advisoryEngine';
import {
  AlertTriangle,
  ArrowDownRight,
  ArrowUpRight,
  PauseCircle,
  Scale,
  ShieldAlert,
  TrendingDown,
  TrendingUp,
  X,
} from 'lucide-react';

const HORIZON_OPTIONS: { id: AdvisoryHorizon; label: string }[] = [
  { id: 'INTRADAY', label: 'Intraday (M15)' },
  { id: 'SHORT_TERM', label: 'Short-Term (H1)' },
  { id: 'SWING', label: 'Swing (H4/D1)' },
  { id: 'LONG_TERM', label: 'Long-Term (W1)' },
  { id: 'CFD', label: 'CFD Tactical' },
];

export interface StrategyBiasRationaleProps {
  quote: Quote;
  candles: Candle[];
  indicators?: IndicatorSnapshot;
  tradePlans?: Record<string, TradePlan>;
  selectedHorizon?: AdvisoryHorizon;
  onHorizonChange?: (horizon: AdvisoryHorizon) => void;
  titleId?: string;
  onClose?: () => void;
  isModal?: boolean;
}

function getDirectionVisual(rationale: StrategyBiasRationale) {
  if (rationale.isAbstained || rationale.direction === 'NO_TRADE') {
    return {
      textClass: 'text-amber-300',
      borderClass: 'border-amber-500/30 bg-amber-500/10',
      label: 'Abstain / No Trade',
      Icon: AlertTriangle,
    };
  }
  if (rationale.direction === 'BUY') {
    return {
      textClass: 'text-emerald-400',
      borderClass: 'border-emerald-500/30 bg-emerald-500/10',
      label: `${rationale.direction} · ${rationale.state.replace(/_/g, ' ')}`,
      Icon: ArrowUpRight,
    };
  }
  if (rationale.direction === 'SELL') {
    return {
      textClass: 'text-rose-400',
      borderClass: 'border-rose-500/30 bg-rose-500/10',
      label: `${rationale.direction} · ${rationale.state.replace(/_/g, ' ')}`,
      Icon: ArrowDownRight,
    };
  }
  return {
    textClass: 'text-amber-300',
    borderClass: 'border-slate-700 bg-slate-800/70',
    label: 'HOLD · Neutral Wait',
    Icon: PauseCircle,
  };
}

function renderTriggerRow(t: StrategyTriggerFactor) {
  const isBull = t.lean === 'BULLISH';
  const isBear = t.lean === 'BEARISH';
  const sign = t.impactPoints > 0 ? '+' : '';
  const colorClass = isBull
    ? 'text-emerald-400'
    : isBear
    ? 'text-rose-400'
    : 'text-slate-400';

  return (
    <tr key={t.id} className="hover:bg-slate-800/40 transition-colors">
      <td className="py-2.5 pr-3 align-top">
        <div className="text-xs font-medium text-slate-100">{t.label}</div>
        <div className="text-[11px] text-slate-400 mt-0.5">{t.thresholdRule}</div>
      </td>
      <td className="py-2.5 px-3 align-top text-right font-mono tabular-nums text-xs text-slate-200 whitespace-nowrap">
        {t.observedValue}
      </td>
      <td className="py-2.5 pl-3 align-top text-right font-mono tabular-nums whitespace-nowrap">
        <span className={`inline-flex items-center gap-1 text-xs font-semibold ${colorClass}`}>
          {isBull ? (
            <TrendingUp className="w-3.5 h-3.5" aria-hidden="true" />
          ) : isBear ? (
            <TrendingDown className="w-3.5 h-3.5" aria-hidden="true" />
          ) : (
            <PauseCircle className="w-3.5 h-3.5" aria-hidden="true" />
          )}
          {sign}
          {t.impactPoints.toFixed(1)} pts
        </span>
        <div className="text-[10px] font-mono text-slate-500 mt-0.5">
          {t.status} · max ±{t.maxWeight}
        </div>
      </td>
    </tr>
  );
}

function renderSentimentFactor(f: StrategySentimentFactor) {
  const isBull = f.directionalLean === 'BULLISH';
  const isBear = f.directionalLean === 'BEARISH';
  const leanColor = isBull
    ? 'text-emerald-400'
    : isBear
    ? 'text-rose-400'
    : 'text-amber-300';

  return (
    <div key={f.id} className="py-3 first:pt-1 last:pb-1">
      <div className="flex items-start justify-between gap-3">
        <h5 className="text-xs font-semibold text-slate-100 leading-snug">{f.title}</h5>
        <span className={`inline-flex items-center gap-1 text-[11px] font-mono font-semibold shrink-0 whitespace-nowrap ${leanColor}`}>
          {isBull ? (
            <ArrowUpRight className="w-3.5 h-3.5" aria-hidden="true" />
          ) : isBear ? (
            <ArrowDownRight className="w-3.5 h-3.5" aria-hidden="true" />
          ) : (
            <PauseCircle className="w-3.5 h-3.5" aria-hidden="true" />
          )}
          {f.directionalLean}
        </span>
      </div>
      <p className="text-xs text-slate-400 mt-1 leading-relaxed">{f.causalExplanation}</p>
      <div className="flex flex-wrap items-center gap-2 text-[11px] text-slate-500 font-mono mt-1.5">
        <span>{f.source}</span>
        <span aria-hidden="true">·</span>
        <span>{f.horizonRelevance}</span>
        <span aria-hidden="true">·</span>
        <span>{f.weightLabel}</span>
      </div>
    </div>
  );
}

const RationaleContent: React.FC<StrategyBiasRationaleProps> = ({
  quote,
  candles,
  indicators,
  tradePlans,
  selectedHorizon = 'SHORT_TERM',
  onHorizonChange,
  titleId = 'strategy-bias-rationale-title',
  onClose,
  isModal = false,
}) => {
  const [internalHorizon, setInternalHorizon] = useState<AdvisoryHorizon>(selectedHorizon);

  useEffect(() => {
    setInternalHorizon(selectedHorizon);
  }, [selectedHorizon]);

  const activeHorizon = onHorizonChange ? selectedHorizon : internalHorizon;
  const handleSelectHorizon = (h: AdvisoryHorizon) => {
    setInternalHorizon(h);
    onHorizonChange?.(h);
  };

  const rationale = useMemo(
    () =>
      buildStrategyBiasRationale(
        quote,
        activeHorizon,
        { candles, indicators, quote },
        tradePlans?.[activeHorizon]
      ),
    [quote, activeHorizon, candles, indicators, tradePlans]
  );

  const dirVisual = getDirectionVisual(rationale);
  const DirectionIcon = dirVisual.Icon;
  const gaugePct = Math.max(0, Math.min(100, ((rationale.compositeScore + 100) / 200) * 100));
  const totalVotes = rationale.agentVotes.bullish + rationale.agentVotes.bearish + rationale.agentVotes.neutral;

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-lg p-5 sm:p-6 space-y-5">
      {/* Header Row */}
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 pb-4 border-b border-slate-800">
        <div className="space-y-1">
          <div className="flex items-center gap-2.5">
            <Scale className="w-4 h-4 text-amber-400 shrink-0" aria-hidden="true" />
            <h3 id={titleId} className="text-base sm:text-lg font-semibold text-slate-100">
              Strategy Bias Rationale
            </h3>
          </div>
          <div className="flex flex-wrap items-center gap-2 text-xs font-mono text-slate-400 tabular-nums">
            <span className="text-slate-200 font-semibold">{rationale.instrumentId}</span>
            <span aria-hidden="true">·</span>
            <span>Spot ${quote.mid.toFixed(2)}</span>
            <span aria-hidden="true">·</span>
            <span className={quote.change24hPct >= 0 ? 'text-emerald-400' : 'text-rose-400'}>
              24h {quote.change24hPct >= 0 ? '+' : ''}{quote.change24hPct.toFixed(2)}%
            </span>
            <span aria-hidden="true">·</span>
            <span>Feed {quote.quality}</span>
          </div>
        </div>

        <div className="flex items-center gap-2.5 flex-wrap">
          {/* Interactive Horizon Selector Tabs */}
          <div
            role="tablist"
            aria-label="Strategy bias horizon selector"
            className="flex items-center gap-1 p-1 bg-slate-950 border border-slate-800 rounded-lg overflow-x-auto"
          >
            {HORIZON_OPTIONS.map((opt) => {
              const planForTab = tradePlans?.[opt.id];
              const isSelected = activeHorizon === opt.id;
              return (
                <button
                  key={opt.id}
                  type="button"
                  role="tab"
                  aria-selected={isSelected}
                  onClick={() => handleSelectHorizon(opt.id)}
                  className={`px-2.5 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                    isSelected
                      ? 'bg-slate-800 text-amber-300 border border-slate-700'
                      : 'text-slate-400 hover:text-slate-200 border border-transparent'
                  }`}
                >
                  {opt.label}
                  {planForTab && (
                    <span
                      className={`ml-1.5 font-mono text-[11px] ${
                        planForTab.direction === 'BUY'
                          ? 'text-emerald-400'
                          : planForTab.direction === 'SELL'
                          ? 'text-rose-400'
                          : 'text-amber-300'
                      }`}
                    >
                      {planForTab.direction}
                    </span>
                  )}
                </button>
              );
            })}
          </div>

          {isModal && onClose && (
            <button
              type="button"
              onClick={onClose}
              aria-label="Close strategy bias rationale"
              className="p-2 rounded-lg border border-slate-800 text-slate-400 hover:text-slate-100 hover:bg-slate-800 transition-colors shrink-0 cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {/* Directional Verdict & Score Meter */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 pb-5 border-b border-slate-800">
        <div className="lg:col-span-7 space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-md border text-xs font-mono font-semibold ${dirVisual.borderClass} ${dirVisual.textClass}`}>
              <DirectionIcon className="w-4 h-4 shrink-0" aria-hidden="true" />
              <span>{dirVisual.label}</span>
            </div>
            <div className="text-xs font-mono tabular-nums text-slate-300">
              Composite Score:{' '}
              <strong
                className={
                  rationale.compositeScore >= 15
                    ? 'text-emerald-400'
                    : rationale.compositeScore <= -15
                    ? 'text-rose-400'
                    : 'text-amber-300'
                }
              >
                {rationale.compositeScore > 0 ? '+' : ''}
                {rationale.compositeScore} / 100
              </strong>
            </div>
          </div>

          <p className="text-xs sm:text-sm text-slate-300 leading-relaxed">
            {rationale.underlyingLogic}
          </p>

          {rationale.conflictNotice && (
            <div className="p-3 rounded-md border border-amber-500/30 bg-amber-500/10 flex items-start gap-2.5 text-xs text-amber-200 leading-relaxed">
              <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" aria-hidden="true" />
              <span>{rationale.conflictNotice}</span>
            </div>
          )}
        </div>

        {/* Quantitative Decision Threshold Bar & Agent Split */}
        <div className="lg:col-span-5 space-y-4 bg-slate-950/70 border border-slate-800 rounded-lg p-4">
          <div className="space-y-2">
            <div className="flex items-center justify-between text-xs font-mono text-slate-400 tabular-nums">
              <span>Sell ≤ -15</span>
              <span>Hold (-14..+14)</span>
              <span>Buy ≥ +15</span>
            </div>
            <div className="relative h-2.5 bg-slate-800 rounded-full overflow-hidden">
              {/* Neutral center band highlight (-15 to +15 maps to 42.5% to 57.5%) */}
              <div
                className="absolute inset-y-0 bg-slate-700/90"
                style={{ left: '42.5%', width: '15%' }}
              />
              {/* Score needle */}
              <div
                className={`absolute top-0 bottom-0 w-1.5 rounded-full transition-all ${
                  rationale.compositeScore >= 15
                    ? 'bg-emerald-400'
                    : rationale.compositeScore <= -15
                    ? 'bg-rose-400'
                    : 'bg-amber-300'
                }`}
                style={{ left: `calc(${gaugePct}% - 3px)` }}
              />
            </div>
            <div className="flex items-center justify-between text-[11px] font-mono text-slate-500 tabular-nums">
              <span>-100 Max Bearish</span>
              <span>0 Equilibrium</span>
              <span>+100 Max Bullish</span>
            </div>
          </div>

          <div className="pt-3 border-t border-slate-800 flex items-center justify-between text-xs font-mono tabular-nums">
            <span className="text-slate-400">Specialist Council Split ({totalVotes}):</span>
            <div className="flex items-center gap-3">
              <span className="text-emerald-400">{rationale.agentVotes.bullish} Bull</span>
              <span className="text-slate-400">{rationale.agentVotes.neutral} Neutral</span>
              <span className="text-rose-400">{rationale.agentVotes.bearish} Bear</span>
            </div>
          </div>

          <div className="pt-3 border-t border-slate-800 flex items-start gap-2 text-xs text-slate-300">
            <ShieldAlert className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" aria-hidden="true" />
            <div>
              <span className="font-semibold text-slate-200">Invalidation Rule: </span>
              <span className="text-slate-400">{rationale.invalidationRule}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Balanced 2-Column Evidence Grid: Technical Triggers + Sentiment Factors */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Column 1: Technical Triggers */}
        <div className="space-y-3">
          <div className="flex items-center justify-between border-b border-slate-800 pb-2">
            <h4 className="text-sm font-semibold text-slate-100">
              Technical Triggers Evaluated
            </h4>
            <span className="text-xs font-mono text-slate-400 tabular-nums">
              {rationale.technicalTriggers.filter((t) => t.status === 'TRIGGERED').length} triggered /{' '}
              {rationale.technicalTriggers.length} inputs
            </span>
          </div>

          {rationale.technicalTriggers.length === 0 ? (
            <p className="text-xs text-slate-400 py-4">
              Insufficient bar telemetry for technical trigger decomposition. Connect a historical candle stream or refresh market quotes.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-slate-800 text-[11px] font-mono text-slate-500">
                    <th className="pb-2 font-medium">Rule & Threshold</th>
                    <th className="pb-2 px-3 text-right font-medium">Reading</th>
                    <th className="pb-2 pl-3 text-right font-medium">Contribution</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/80">
                  {rationale.technicalTriggers.map(renderTriggerRow)}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Column 2: Sentiment & Causal News Factors */}
        <div className="space-y-3">
          <div className="flex items-center justify-between border-b border-slate-800 pb-2">
            <h4 className="text-sm font-semibold text-slate-100">
              Sentiment & Fundamental Factors ({rationale.commodity.replace('_', ' ')})
            </h4>
            <span
              className={`text-xs font-mono font-semibold tabular-nums ${
                rationale.sentimentScore >= 15
                  ? 'text-emerald-400'
                  : rationale.sentimentScore <= -15
                  ? 'text-rose-400'
                  : 'text-amber-300'
              }`}
            >
              Net {rationale.sentimentScore >= 0 ? '+' : ''}
              {rationale.sentimentScore} · {rationale.sentimentLabel.replace(/_/g, ' ')}
            </span>
          </div>

          <div className="divide-y divide-slate-800/80">
            {rationale.sentimentFactors.map(renderSentimentFactor)}
          </div>
        </div>
      </div>
    </div>
  );
};

export const StrategyBiasRationalePanel: React.FC<StrategyBiasRationaleProps> = (props) => {
  return <RationaleContent {...props} isModal={false} />;
};

export interface StrategyBiasRationaleModalProps extends StrategyBiasRationaleProps {
  isOpen: boolean;
  onClose: () => void;
}

export const StrategyBiasRationaleModal: React.FC<StrategyBiasRationaleModalProps> = ({
  isOpen,
  onClose,
  ...rest
}) => {
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-labelledby="strategy-bias-rationale-modal-title"
      onClick={onClose}
    >
      <div
        className="w-full max-w-5xl max-h-[90vh] overflow-y-auto rounded-lg shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <RationaleContent
          {...rest}
          titleId="strategy-bias-rationale-modal-title"
          onClose={onClose}
          isModal
        />
      </div>
    </div>
  );
};
