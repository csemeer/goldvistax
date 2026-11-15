/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * Aurum Intelligence — Commodity-Aware News Discovery & Causal Sentiment Workspace
 */

import React, { useState, useMemo } from 'react';
import {
  CommodityType,
  EventCategory,
  EvidenceHorizon,
  NewsEvidenceItem,
} from '../domain/types';
import {
  CANONICAL_ECONOMIC_CALENDAR,
  CANONICAL_NEWS_EVIDENCE,
  calculateCommoditySentiment,
} from '../services/newsSentimentEngine';
import {
  Newspaper,
  Calendar,
  ExternalLink,
  ShieldAlert,
  ArrowUpRight,
  ArrowDownRight,
  Clock,
  Info,
  CheckCircle,
  Globe,
  Search,
  RefreshCw,
} from 'lucide-react';

interface NewsSentimentWorkspaceProps {
  currentCommodity: CommodityType;
  onCommodityChange?: (c: CommodityType) => void;
}

export const NewsSentimentWorkspace: React.FC<NewsSentimentWorkspaceProps> = ({
  currentCommodity,
  onCommodityChange,
}) => {
  const [selectedCommodityFilter, setSelectedCommodityFilter] = useState<CommodityType | 'ALL'>(
    currentCommodity
  );
  const [selectedCategory, setSelectedCategory] = useState<EventCategory | 'ALL'>('ALL');
  const [selectedHorizon, setSelectedHorizon] = useState<EvidenceHorizon | 'ALL'>('ALL');
  const [activeTab, setActiveTab] = useState<'NEWS_EVIDENCE' | 'ECONOMIC_CALENDAR' | 'SEARCH_GROUNDING'>('NEWS_EVIDENCE');

  // Search Grounding State
  const [groundingQuery, setGroundingQuery] = useState('gold price drivers central bank purchases treasury yields current market');
  const [isSearching, setIsSearching] = useState(false);
  const [groundingError, setGroundingError] = useState<string | null>(null);
  const [groundingData, setGroundingData] = useState<{
    text: string;
    sources: Array<{ title: string; uri: string }>;
    grounded: boolean;
    mode?: string;
  } | null>(null);

  const handleRunSearchGrounding = async (queryToRun?: string) => {
    const q = queryToRun || groundingQuery;
    setIsSearching(true);
    setGroundingError(null);
    try {
      const res = await fetch('/api/ai/search-grounding', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: q }),
      });
      const data = await res.json();
      if (!res.ok) {
        setGroundingError(data.error || `Search grounding blocked (HTTP ${res.status}).`);
        return;
      }
      setGroundingData(data);
    } catch (err: any) {
      setGroundingError(err?.message || 'Unable to reach search grounding gateway.');
    } finally {
      setIsSearching(false);
    }
  };

  // Calculate sentiment for currently selected filter or commodity
  const sentiment = useMemo(() => {
    const target = selectedCommodityFilter === 'ALL' ? currentCommodity : selectedCommodityFilter;
    return calculateCommoditySentiment(target);
  }, [selectedCommodityFilter, currentCommodity]);

  // Filtered evidence items
  const filteredItems = useMemo(() => {
    return CANONICAL_NEWS_EVIDENCE.filter((item) => {
      if (selectedCommodityFilter !== 'ALL' && item.commodity !== 'ALL' && item.commodity !== selectedCommodityFilter) {
        return false;
      }
      if (selectedCategory !== 'ALL' && item.category !== selectedCategory) {
        return false;
      }
      if (selectedHorizon !== 'ALL' && item.horizon !== selectedHorizon) {
        return false;
      }
      return true;
    });
  }, [selectedCommodityFilter, selectedCategory, selectedHorizon]);

  return (
    <div className="space-y-6">
      {/* Top Header & Commodity Tabs */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-slate-900 border border-slate-800 rounded-xl p-5 shadow-xs">
        <div>
          <div className="flex items-center gap-2">
            <Newspaper className="w-5 h-5 text-amber-400" />
            <h2 className="text-xl font-bold text-white tracking-wide">
              Commodity News & Causal Sentiment
            </h2>
          </div>
          <p className="text-sm text-slate-400 mt-1">
            Source-attributed evidence, transmission channels, and real-time Google Search Grounding.
          </p>
        </div>

        {/* View Toggle */}
        <div className="flex items-center gap-1 bg-slate-950 p-1 rounded-lg border border-slate-800 self-start sm:self-auto">
          <button
            onClick={() => setActiveTab('NEWS_EVIDENCE')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
              activeTab === 'NEWS_EVIDENCE'
                ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Newspaper className="w-3.5 h-3.5" />
            Evidence Items ({filteredItems.length})
          </button>
          <button
            onClick={() => setActiveTab('ECONOMIC_CALENDAR')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
              activeTab === 'ECONOMIC_CALENDAR'
                ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Calendar className="w-3.5 h-3.5" />
            Catalyst Calendar
          </button>
          <button
            onClick={() => {
              setActiveTab('SEARCH_GROUNDING');
              if (!groundingData) {
                handleRunSearchGrounding();
              }
            }}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
              activeTab === 'SEARCH_GROUNDING'
                ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Globe className="w-3.5 h-3.5 text-amber-400" />
            Search Grounding
          </button>
        </div>
      </div>

      {/* Aggregate Causal Sentiment Gauge Card */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Sentiment Index Card */}
        <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-4 flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-xs font-mono uppercase tracking-wider text-slate-400">
              Causal Sentiment Index
            </span>
            <span
              className={`text-xs px-2 py-0.5 rounded font-mono font-semibold ${
                sentiment.label.includes('BULLISH')
                  ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                  : sentiment.label.includes('BEARISH')
                  ? 'bg-rose-500/20 text-rose-300 border border-rose-500/30'
                  : 'bg-slate-800 text-slate-300'
              }`}
            >
              {sentiment.label.replace('_', ' ')}
            </span>
          </div>

          <div className="my-3 flex items-baseline gap-2">
            <span
              className={`text-3xl font-mono font-bold ${
                sentiment.score > 0
                  ? 'text-emerald-400'
                  : sentiment.score < 0
                  ? 'text-rose-400'
                  : 'text-slate-300'
              }`}
            >
              {sentiment.score > 0 ? `+${sentiment.score}` : sentiment.score}
            </span>
            <span className="text-xs text-slate-500">/ 100</span>
          </div>

          {/* Bar Gauge */}
          <div className="w-full bg-slate-950 h-2 rounded-full overflow-hidden border border-slate-800 relative">
            <div
              className={`h-full transition-all duration-500 ${
                sentiment.score >= 0 ? 'bg-emerald-500' : 'bg-rose-500'
              }`}
              style={{
                width: `${Math.min(100, Math.abs(sentiment.score))}%`,
                marginLeft: sentiment.score < 0 ? `${100 - Math.min(100, Math.abs(sentiment.score))}%` : '50%',
              }}
            ></div>
          </div>
          <div className="flex justify-between text-[10px] font-mono text-slate-500 mt-1">
            <span>-100 (Extremely Bearish)</span>
            <span>0</span>
            <span>+100 (Extremely Bullish)</span>
          </div>
        </div>

        {/* Factors Balance */}
        <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-4 flex flex-col justify-between">
          <span className="text-xs font-mono uppercase tracking-wider text-slate-400">
            Factor Balance & Sourcing
          </span>
          <div className="grid grid-cols-2 gap-2 my-2">
            <div className="bg-slate-950/70 p-2.5 rounded border border-slate-800/80">
              <div className="flex items-center gap-1.5 text-xs text-emerald-400">
                <ArrowUpRight className="w-3.5 h-3.5" />
                <span>Bullish Drivers</span>
              </div>
              <div className="text-xl font-bold font-mono text-white mt-1">
                {sentiment.bullishFactorCount}
              </div>
            </div>
            <div className="bg-slate-950/70 p-2.5 rounded border border-slate-800/80">
              <div className="flex items-center gap-1.5 text-xs text-rose-400">
                <ArrowDownRight className="w-3.5 h-3.5" />
                <span>Bearish Drivers</span>
              </div>
              <div className="text-xl font-bold font-mono text-white mt-1">
                {sentiment.bearishFactorCount}
              </div>
            </div>
          </div>
          <p className="text-[11px] text-slate-400">
            Sourced strictly from primary energy/metals agencies and licensed financial data.
          </p>
        </div>

        {/* Lead Catalyst */}
        <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-4 flex flex-col justify-between">
          <span className="text-xs font-mono uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
            <Newspaper className="w-3.5 h-3.5 text-amber-400" />
            Dominant Market Catalyst
          </span>
          <p className="text-sm font-medium text-slate-200 my-2 line-clamp-2">
            "{sentiment.topCatalyst}"
          </p>
          <div className="flex items-center gap-2 text-[11px] text-amber-400/90 font-mono">
            <CheckCircle className="w-3.5 h-3.5 text-emerald-400" />
            <span>Verified Official Release</span>
          </div>
        </div>
      </div>

      {activeTab === 'NEWS_EVIDENCE' ? (
        <div className="space-y-4">
          {/* Filter Bar */}
          <div className="flex flex-wrap items-center gap-2 bg-slate-900/70 p-3 rounded-lg border border-slate-800 text-xs">
            {/* Commodity Filter */}
            <div className="flex items-center gap-1">
              <span className="text-slate-500 font-mono mr-1">Commodity:</span>
              {(['ALL', 'GOLD', 'SILVER', 'WTI_OIL', 'BRENT_OIL'] as const).map((c) => (
                <button
                  key={c}
                  onClick={() => setSelectedCommodityFilter(c)}
                  className={`px-2.5 py-1 rounded font-medium transition-colors ${
                    selectedCommodityFilter === c
                      ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  {c === 'ALL'
                    ? 'All'
                    : c === 'GOLD'
                    ? 'Gold'
                    : c === 'SILVER'
                    ? 'Silver'
                    : c === 'WTI_OIL'
                    ? 'WTI Oil'
                    : 'Brent Oil'}
                </button>
              ))}
            </div>

            <div className="h-4 w-px bg-slate-800 mx-1 hidden sm:block"></div>

            {/* Horizon Filter */}
            <div className="flex items-center gap-1">
              <span className="text-slate-500 font-mono mr-1">Horizon:</span>
              {(['ALL', 'INTRADAY', 'SWING', 'STRUCTURAL'] as const).map((h) => (
                <button
                  key={h}
                  onClick={() => setSelectedHorizon(h)}
                  className={`px-2 py-1 rounded font-medium transition-colors ${
                    selectedHorizon === h
                      ? 'bg-blue-500/20 text-blue-300 border border-blue-500/40'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  {h}
                </button>
              ))}
            </div>
          </div>

          {/* Evidence Cards Feed */}
          <div className="space-y-3">
            {filteredItems.map((item) => (
              <div
                key={item.id}
                className="bg-slate-900/90 border border-slate-800 hover:border-slate-700/80 rounded-xl p-4 sm:p-5 transition-all shadow-xs"
              >
                {/* Card Header: Publisher, Badges & Timestamps */}
                <div className="flex flex-wrap items-center justify-between gap-2 pb-2.5 border-b border-slate-800/80 text-xs">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-semibold text-slate-200">{item.publisher}</span>
                    <span
                      className={`px-2 py-0.5 rounded text-[10px] font-mono font-medium ${
                        item.sourceTier === 'TIER_1_PRIMARY'
                          ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                          : 'bg-blue-500/10 text-blue-400 border border-blue-500/20'
                      }`}
                    >
                      {item.sourceTier.replace(/_/g, ' ')}
                    </span>
                    <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-slate-800 text-slate-300">
                      {item.commodity}
                    </span>
                    <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-slate-800/80 text-slate-400">
                      {item.category.replace(/_/g, ' ')}
                    </span>
                  </div>

                  {/* Sourced Timestamps (Separating Pub Time, Event Time, Ingestion Time) */}
                  <div className="flex items-center gap-3 text-[11px] font-mono text-slate-400">
                    <span className="flex items-center gap-1" title="Official Release / Publication Time">
                      <Clock className="w-3 h-3 text-slate-500" />
                      Pub: {item.publicationTime.slice(0, 16).replace('T', ' ')}Z
                    </span>
                    <span className="text-slate-600">|</span>
                    <span className="text-slate-500" title="System Knowledge Ingestion Time">
                      Ingested: {item.ingestionTime.slice(11, 16)}Z
                    </span>
                  </div>
                </div>

                {/* Headline & Direction */}
                <div className="mt-3 flex items-start justify-between gap-3">
                  <h3 className="text-base font-semibold text-white leading-snug">
                    {item.title}
                  </h3>
                  <span
                    className={`shrink-0 flex items-center gap-1 px-2.5 py-1 rounded text-xs font-mono font-bold ${
                      item.directionalLean === 'BULLISH'
                        ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                        : item.directionalLean === 'BEARISH'
                        ? 'bg-rose-500/20 text-rose-400 border border-rose-500/30'
                        : 'bg-slate-800 text-slate-300'
                    }`}
                  >
                    {item.directionalLean === 'BULLISH' && <ArrowUpRight className="w-3.5 h-3.5" />}
                    {item.directionalLean === 'BEARISH' && <ArrowDownRight className="w-3.5 h-3.5" />}
                    {item.directionalLean} ({item.horizon})
                  </span>
                </div>

                {/* Summary */}
                <p className="text-sm text-slate-300 mt-2 leading-relaxed">
                  {item.summary}
                </p>

                {/* Extracted Facts */}
                <div className="mt-3 p-3 bg-slate-950/70 rounded-lg border border-slate-800/60 text-xs">
                  <span className="font-mono text-slate-400 font-semibold block mb-1.5 uppercase text-[10px] tracking-wider">
                    Extracted Verifiable Facts:
                  </span>
                  <ul className="space-y-1 text-slate-300 list-disc list-inside">
                    {item.extractedFacts.map((fact, idx) => (
                      <li key={idx} className="leading-snug">{fact}</li>
                    ))}
                  </ul>
                </div>

                {/* Causal Transmission & Reversal Conditions */}
                <div className="mt-3 grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
                  <div className="p-3 bg-blue-950/20 rounded-lg border border-blue-900/40">
                    <span className="font-mono text-blue-300 font-semibold block mb-1 uppercase text-[10px] tracking-wider flex items-center gap-1">
                      <Info className="w-3 h-3" />
                      Causal Transmission Mechanism:
                    </span>
                    <p className="text-slate-300 leading-snug">{item.causalTransmission}</p>
                  </div>

                  <div className="p-3 bg-amber-950/20 rounded-lg border border-amber-900/40">
                    <span className="font-mono text-amber-300 font-semibold block mb-1 uppercase text-[10px] tracking-wider flex items-center gap-1">
                      <ShieldAlert className="w-3 h-3" />
                      Thesis Invalidation / Reversal Conditions:
                    </span>
                    <p className="text-slate-300 leading-snug">{item.reversalConditions}</p>
                  </div>
                </div>

                {/* Footer: Materiality & External Link */}
                <div className="mt-3 pt-2.5 border-t border-slate-800/60 flex items-center justify-between text-xs font-mono">
                  <div className="flex items-center gap-3 text-slate-400">
                    <span>Materiality: <strong className="text-white">{item.materialityScore}/10</strong></span>
                    <span>Status: <strong className="text-emerald-400">{item.confirmationStatus}</strong></span>
                  </div>

                  <a
                    href={item.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-1 text-amber-400 hover:text-amber-300 transition-colors"
                  >
                    <span>View Provenance Source</span>
                    <ExternalLink className="w-3 h-3" />
                  </a>
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : activeTab === 'ECONOMIC_CALENDAR' ? (
        /* Economic Catalyst Calendar */
        <div className="space-y-4">
          <div className="bg-slate-900/90 border border-slate-800 rounded-xl overflow-hidden shadow-xs">
            <div className="p-4 border-b border-slate-800 flex items-center justify-between">
              <div>
                <h3 className="font-bold text-white text-sm">Key Macro & Energy Event Calendar</h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  Scheduled official releases, consensus expectations, and commodity impact channels.
                </p>
              </div>
              <span className="text-xs font-mono text-slate-400">Configured Timezone: UTC</span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-950/80 text-slate-400 font-mono text-[11px] border-b border-slate-800 uppercase tracking-wider">
                  <tr>
                    <th className="py-3 px-4">Event & Agency</th>
                    <th className="py-3 px-4">Commodity</th>
                    <th className="py-3 px-4">Scheduled Date (UTC)</th>
                    <th className="py-3 px-4">Consensus</th>
                    <th className="py-3 px-4">Prior</th>
                    <th className="py-3 px-4">Transmission Impact</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/80 text-slate-300">
                  {CANONICAL_ECONOMIC_CALENDAR.map((ev) => (
                    <tr key={ev.id} className="hover:bg-slate-800/30 transition-colors">
                      <td className="py-3.5 px-4 font-medium text-white">
                        <div>{ev.eventTitle}</div>
                        <div className="text-[11px] text-slate-400 font-mono">{ev.agency}</div>
                      </td>
                      <td className="py-3.5 px-4 font-mono">
                        <span className="px-2 py-0.5 rounded bg-slate-800 text-slate-300">
                          {ev.commodity}
                        </span>
                      </td>
                      <td className="py-3.5 px-4 font-mono text-slate-300">
                        {ev.scheduledTime.slice(0, 10)} {ev.scheduledTime.slice(11, 16)}
                      </td>
                      <td className="py-3.5 px-4 font-mono font-semibold text-amber-300">
                        {ev.consensusEstimate}
                      </td>
                      <td className="py-3.5 px-4 font-mono text-slate-400">
                        {ev.priorValue}
                      </td>
                      <td className="py-3.5 px-4 text-slate-400 max-w-xs leading-snug">
                        {ev.transmissionAnalysis}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      ) : (
        /* Google Search Grounding & Real-Time Macro Intelligence Tab */
        <div className="space-y-4">
          {/* Query Bar */}
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 space-y-3">
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
              <div className="relative flex-1">
                <Search className="w-4 h-4 text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  aria-label="Macro search grounding query"
                  placeholder="Enter macro query (e.g. Central bank gold purchases, real yields, OPEC+ quota)..."
                  value={groundingQuery}
                  onChange={(e) => setGroundingQuery(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleRunSearchGrounding()}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg pl-10 pr-4 py-2.5 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-amber-400"
                />
              </div>
              <button
                type="button"
                onClick={() => handleRunSearchGrounding()}
                disabled={isSearching || !groundingQuery.trim()}
                className="px-5 py-2.5 bg-amber-400 hover:bg-amber-300 disabled:opacity-50 text-slate-950 text-xs font-semibold rounded-lg flex items-center justify-center gap-2 transition-colors shrink-0"
              >
                {isSearching ? (
                  <RefreshCw className="w-4 h-4 animate-spin" />
                ) : (
                  <Globe className="w-4 h-4" />
                )}
                <span>{isSearching ? 'Grounding...' : 'Search Grounding'}</span>
              </button>
            </div>

            {/* Quick Institutional Query Suggestions */}
            <div className="flex flex-wrap items-center gap-2 pt-1 text-[11px] font-mono">
              <span className="text-slate-500 uppercase text-[10px] mr-1">Institutional Presets:</span>
              {[
                'Central bank sovereign gold purchases vault inflows',
                'US 10Y TIPS real yields and inflation breakevens',
                'COMEX Managed Money gold positioning and short squeeze',
                'Brent vs WTI crude oil shipping arbitrage',
              ].map((preset) => (
                <button
                  key={preset}
                  type="button"
                  onClick={() => {
                    setGroundingQuery(preset);
                    handleRunSearchGrounding(preset);
                  }}
                  className="px-2.5 py-1 rounded bg-slate-950 hover:bg-slate-800 text-slate-300 border border-slate-800 hover:border-slate-700 transition-colors truncate max-w-xs"
                >
                  {preset}
                </button>
              ))}
            </div>
          </div>

          {groundingError && (
            <div
              role="alert"
              className="bg-rose-950/40 border border-rose-500/40 rounded-xl p-3.5 text-xs text-rose-200 flex items-center gap-2 font-mono"
            >
              <ShieldAlert className="w-4 h-4 text-rose-400 shrink-0" />
              <span>{groundingError}</span>
            </div>
          )}

          {/* Grounding Results Briefing */}
          {groundingData && (
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-2 pb-3 border-b border-slate-800">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-mono uppercase text-amber-400 font-bold flex items-center gap-1.5">
                    <Globe className="w-4 h-4" />
                    Live Grounded Research Dossier
                  </span>
                  <span className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold ${
                    groundingData.mode === 'GOOGLE_SEARCH_GROUNDED'
                      ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30'
                      : 'bg-blue-500/10 text-blue-400 border border-blue-500/30'
                  }`}>
                    {groundingData.mode === 'GOOGLE_SEARCH_GROUNDED'
                      ? 'Google Search Grounded • gemini-3.8-flash'
                      : 'Primary Source Grounded • Continuous Institutional Reference'}
                  </span>
                </div>
                <span className="text-xs font-mono text-slate-400">
                  {groundingData.sources?.length || 0} Attributed Provenance Sources
                </span>
              </div>

              {/* Research Narrative */}
              <div className="p-4 bg-slate-950 rounded-lg border border-slate-800/80 text-xs text-slate-200 leading-relaxed whitespace-pre-wrap font-sans">
                {groundingData.text}
              </div>

              {/* Verified Sources Cards */}
              {groundingData.sources && groundingData.sources.length > 0 && (
                <div className="space-y-2 pt-2 border-t border-slate-800">
                  <span className="text-[11px] font-mono uppercase tracking-wider text-slate-400 block font-semibold">
                    Attributed Grounding Citations & Primary Sources:
                  </span>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {groundingData.sources.map((src, idx) => (
                      <a
                        key={idx}
                        href={src.uri}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="p-2.5 bg-slate-950 hover:bg-slate-800/80 border border-slate-800 hover:border-slate-700 rounded-lg flex items-center justify-between gap-2 text-xs text-slate-300 hover:text-amber-300 transition-colors group"
                      >
                        <div className="truncate">
                          <div className="font-medium truncate group-hover:text-amber-300">{src.title}</div>
                          <div className="text-[10px] font-mono text-slate-500 truncate mt-0.5">{src.uri}</div>
                        </div>
                        <ExternalLink className="w-3.5 h-3.5 text-slate-500 group-hover:text-amber-300 shrink-0" />
                      </a>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
