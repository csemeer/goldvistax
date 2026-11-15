/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * Aurum Intelligence — Macro Intelligence & Historical Event Studies Workspace
 */

import React, { useState } from 'react';
import { AnalogMatchResult, EconomicRelease, HistoricalEventStudy, MarketRegime } from '../domain/types';
import { Landmark, History, TrendingUp, DollarSign, BarChart3, AlertCircle, Coins, ShieldCheck, Clock, Gauge, ArrowUpRight, ArrowDownRight, Layers, Activity } from 'lucide-react';
import {
  CANONICAL_COT_REPORTS,
  CANONICAL_CENTRAL_BANK_FLOWS,
  CANONICAL_EVENT_VOLATILITY_PROJECTIONS,
} from '../services/cotIntelligence';
import {
  calculateFuturesTermStructure,
  calculateOptionsVolatilitySurface,
} from '../services/futuresOptionsEngine';

interface MacroWorkspaceProps {
  regime: MarketRegime;
  releases: EconomicRelease[];
  studies: HistoricalEventStudy[];
  analogs: AnalogMatchResult[];
}

export const MacroWorkspace: React.FC<MacroWorkspaceProps> = ({
  regime,
  releases,
  studies,
  analogs,
}) => {
  const [activeTab, setActiveTab] = useState<'releases' | 'eventStudies' | 'analogs' | 'cotPositioning' | 'futuresOptions'>('releases');
  const [selectedStudy, setSelectedStudy] = useState<HistoricalEventStudy>(studies[0]);
  const [selectedCotCommodity, setSelectedCotCommodity] = useState<'GOLD' | 'SILVER' | 'CRUDE_WTI'>('GOLD');

  const futuresCurve = calculateFuturesTermStructure(3898.90);
  const optionsSurface = calculateOptionsVolatilitySurface(15.85);

  return (
    <div className="space-y-6">
      {/* Header & Market Regime Card */}
      <div className="bg-slate-900 border border-slate-800 rounded-lg p-5">
        <div className="flex flex-wrap items-center justify-between gap-4 pb-4 border-b border-slate-800">
          <div>
            <span className="text-xs font-mono text-amber-400 uppercase tracking-wider block">
              Macroeconomic Intelligence & Fundamentals
            </span>
            <h2 className="text-xl font-bold text-slate-100 mt-0.5">
              Current Macro Regime: {regime.currentRegime.replace('_', ' ')}
            </h2>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-xs font-mono px-3 py-1 bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 rounded">
              Macro Alignment: {regime.macroAlignment}
            </span>
            <span className="text-xs font-mono px-3 py-1 bg-slate-800 text-slate-300 rounded">
              Regime Confidence: {regime.confidencePct}%
            </span>
          </div>
        </div>

        <p className="text-sm text-slate-300 mt-3 leading-relaxed">
          {regime.summary}
        </p>

        {/* Macro KPI Bar */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-4 pt-4 border-t border-slate-800/80 text-xs font-mono">
          <div className="bg-slate-950/60 p-3 rounded border border-slate-800/60">
            <span className="text-slate-500 block text-[10px]">US 10Y TIPS REAL YIELD</span>
            <span className="text-base font-bold text-slate-200 tabular-nums">1.932%</span>
            <span className="text-[10px] text-emerald-400 block mt-0.5">-32 bps (60d)</span>
          </div>
          <div className="bg-slate-950/60 p-3 rounded border border-slate-800/60">
            <span className="text-slate-500 block text-[10px]">US DOLLAR INDEX (DXY)</span>
            <span className="text-base font-bold text-slate-200 tabular-nums">104.18</span>
            <span className="text-[10px] text-amber-400 block mt-0.5">Consolidation at 200 SMA</span>
          </div>
          <div className="bg-slate-950/60 p-3 rounded border border-slate-800/60">
            <span className="text-slate-500 block text-[10px]">CENTRAL BANK PURCHASES</span>
            <span className="text-base font-bold text-emerald-400 tabular-nums">290 t (Q3)</span>
            <span className="text-[10px] text-slate-400 block mt-0.5">+26% vs historical avg</span>
          </div>
          <div className="bg-slate-950/60 p-3 rounded border border-slate-800/60">
            <span className="text-slate-500 block text-[10px]">GOLD ETF NET FLOWS</span>
            <span className="text-base font-bold text-emerald-400 tabular-nums">+42.5 tonnes</span>
            <span className="text-[10px] text-slate-400 block mt-0.5">3 consecutive inflow months</span>
          </div>
        </div>
      </div>

      {/* Navigation Sub-Tabs */}
      <div className="flex items-center gap-2 border-b border-slate-800 pb-2">
        <button
          onClick={() => setActiveTab('releases')}
          className={`flex items-center gap-2 px-4 py-2 text-xs font-medium rounded-md transition-colors ${
            activeTab === 'releases'
              ? 'bg-amber-500/10 text-amber-300 border border-amber-500/30 font-semibold'
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <Landmark className="w-4 h-4" />
          Economic Releases & Vintages ({releases.length})
        </button>
        <button
          onClick={() => setActiveTab('eventStudies')}
          className={`flex items-center gap-2 px-4 py-2 text-xs font-medium rounded-md transition-colors ${
            activeTab === 'eventStudies'
              ? 'bg-amber-500/10 text-amber-300 border border-amber-500/30 font-semibold'
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <History className="w-4 h-4" />
          Historical Event Studies ({studies.length})
        </button>
        <button
          onClick={() => setActiveTab('analogs')}
          className={`flex items-center gap-2 px-4 py-2 text-xs font-medium rounded-md transition-colors ${
            activeTab === 'analogs'
              ? 'bg-amber-500/10 text-amber-300 border border-amber-500/30 font-semibold'
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <TrendingUp className="w-4 h-4" />
          Historical Analog Matching ({analogs.length})
        </button>
        <button
          onClick={() => setActiveTab('cotPositioning')}
          className={`flex items-center gap-2 px-4 py-2 text-xs font-medium rounded-md transition-colors ${
            activeTab === 'cotPositioning'
              ? 'bg-amber-500/10 text-amber-300 border border-amber-500/30 font-semibold'
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <Coins className="w-4 h-4" />
          COMEX COT & Sovereign Vaults
        </button>
        <button
          onClick={() => setActiveTab('futuresOptions')}
          className={`flex items-center gap-2 px-4 py-2 text-xs font-medium rounded-md transition-colors ${
            activeTab === 'futuresOptions'
              ? 'bg-amber-500/10 text-amber-300 border border-amber-500/30 font-semibold'
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <Layers className="w-4 h-4 text-amber-400" />
          Futures Curve & Volatility (OPT-01)
        </button>
      </div>

      {/* Tab 1: Economic Releases */}
      {activeTab === 'releases' && (
        <div className="bg-slate-900 border border-slate-800 rounded-lg overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-800 flex items-center justify-between">
            <h3 className="text-sm font-semibold text-slate-100">
              Verified Economic Series Releases & Surprise Deviations
            </h3>
            <span className="text-xs font-mono text-slate-400">
              As-Known-Then Vintages (No Look-Ahead Revision Bias)
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left">
              <thead className="bg-slate-950/80 text-slate-400 font-mono uppercase text-[10px] border-b border-slate-800">
                <tr>
                  <th className="px-4 py-3">Series & Source</th>
                  <th className="px-4 py-3">Release Date</th>
                  <th className="px-4 py-3 text-right">Observed</th>
                  <th className="px-4 py-3 text-right">Consensus</th>
                  <th className="px-4 py-3 text-right">Prior Known</th>
                  <th className="px-4 py-3 text-right">Normalized Surprise</th>
                  <th className="px-4 py-3 text-center">Gold Impact</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60 font-mono tabular-nums">
                {releases.map((rel) => {
                  const surpriseColor =
                    rel.surpriseDeviation > 0 ? 'text-emerald-400' : rel.surpriseDeviation < 0 ? 'text-rose-400' : 'text-slate-400';
                  return (
                    <tr key={rel.id} className="hover:bg-slate-800/40 transition-colors">
                      <td className="px-4 py-3">
                        <span className="font-semibold text-slate-200 block font-sans">{rel.seriesName}</span>
                        <span className="text-[10px] text-slate-500 font-mono">{rel.source}</span>
                      </td>
                      <td className="px-4 py-3 text-slate-400">
                        {rel.releaseDate.slice(0, 10)} {rel.releaseDate.slice(11, 16)} UTC
                      </td>
                      <td className="px-4 py-3 text-right font-bold text-slate-100">
                        {rel.observedValue} {rel.unit}
                      </td>
                      <td className="px-4 py-3 text-right text-slate-400">
                        {rel.consensusEstimate} {rel.unit}
                      </td>
                      <td className="px-4 py-3 text-right text-slate-500">
                        {rel.priorValueAsKnown} {rel.unit}
                      </td>
                      <td className={`px-4 py-3 text-right font-bold ${surpriseColor}`}>
                        {rel.surpriseDeviation > 0 ? '+' : ''}{rel.surpriseDeviation.toFixed(2)} σ
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span
                          className={`px-2 py-0.5 rounded text-[10px] font-semibold ${
                            rel.impactOnGoldHistoric === 'POSITIVE'
                              ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                              : 'bg-slate-800 text-slate-400'
                          }`}
                        >
                          {rel.impactOnGoldHistoric}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Tab 2: Historical Event Studies */}
      {activeTab === 'eventStudies' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          <div className="lg:col-span-5 space-y-2">
            <h4 className="text-xs uppercase font-mono text-slate-400 tracking-wider mb-2">
              Select Historical Event Episode
            </h4>
            {studies.map((st) => (
              <div
                key={st.id}
                onClick={() => setSelectedStudy(st)}
                className={`p-3 rounded-lg border cursor-pointer transition-colors ${
                  selectedStudy.id === st.id
                    ? 'bg-slate-800/80 border-amber-500/50 text-slate-100'
                    : 'bg-slate-900 border-slate-800 text-slate-400 hover:border-slate-700'
                }`}
              >
                <div className="flex items-center justify-between text-xs font-mono">
                  <span className="text-amber-400 font-semibold">{st.category}</span>
                  <span className="text-slate-500">{st.date}</span>
                </div>
                <h5 className="text-sm font-semibold mt-1 text-slate-200">{st.title}</h5>
                <p className="text-xs text-slate-400 line-clamp-2 mt-1">{st.description}</p>
              </div>
            ))}
          </div>

          <div className="lg:col-span-7 bg-slate-900 border border-slate-800 rounded-lg p-5">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div>
                <span className="text-xs font-mono text-amber-400">{selectedStudy.category} STUDY</span>
                <h3 className="text-base font-bold text-slate-100 mt-0.5">{selectedStudy.title}</h3>
                <span className="text-xs text-slate-400 font-mono">Date: {selectedStudy.date} · Gold Price Before: ${selectedStudy.goldPriceBefore}</span>
              </div>
            </div>

            <div className="mt-4">
              <h4 className="text-xs font-mono text-slate-400 uppercase tracking-wider mb-2">
                Multi-Window Return Distributions (%)
              </h4>
              <div className="grid grid-cols-5 gap-2 text-center font-mono">
                {Object.entries(selectedStudy.returns).map(([win, ret]) => (
                  <div key={win} className="bg-slate-950 p-2.5 rounded border border-slate-800">
                    <span className="text-[10px] text-slate-500 block uppercase">+{win}</span>
                    <span
                      className={`text-sm font-bold tabular-nums ${
                        ret >= 0 ? 'text-emerald-400' : 'text-rose-400'
                      }`}
                    >
                      {ret > 0 ? '+' : ''}{ret.toFixed(2)}%
                    </span>
                  </div>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3 mt-4 text-xs font-mono">
              <div className="bg-slate-950 p-3 rounded border border-slate-800">
                <span className="text-slate-500 block text-[10px]">MAX FAVORABLE EXCURSION (MFE)</span>
                <span className="text-base font-bold text-emerald-400 tabular-nums">+{selectedStudy.mfePct.toFixed(2)}%</span>
              </div>
              <div className="bg-slate-950 p-3 rounded border border-slate-800">
                <span className="text-slate-500 block text-[10px]">MAX ADVERSE EXCURSION (MAE)</span>
                <span className="text-base font-bold text-rose-400 tabular-nums">{selectedStudy.maePct.toFixed(2)}%</span>
              </div>
            </div>

            <div className="mt-5 p-4 bg-slate-950/80 rounded border border-slate-800 text-xs">
              <strong className="text-amber-400 block mb-1 font-mono uppercase text-[11px]">
                Quantitative Research Takeaway:
              </strong>
              <p className="text-slate-300 leading-relaxed">{selectedStudy.keyTakeaway}</p>
            </div>
          </div>
        </div>
      )}

      {/* Tab 3: Historical Analogs */}
      {activeTab === 'analogs' && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {analogs.map((an) => (
            <div key={an.historicalEventId} className="bg-slate-900 border border-slate-800 rounded-lg p-5 flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between pb-2 border-b border-slate-800">
                  <span className="text-xs font-mono text-slate-400">{an.date}</span>
                  <span className="text-xs font-mono font-bold text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded border border-amber-500/20">
                    {an.similarityScorePct}% Match
                  </span>
                </div>

                <h4 className="text-base font-bold text-slate-100 mt-2">{an.title}</h4>

                <div className="mt-3 space-y-1.5 text-xs">
                  <span className="text-[11px] font-mono text-slate-400 block uppercase">Matching Conditions:</span>
                  <ul className="list-disc pl-4 text-slate-300 space-y-0.5">
                    {an.matchingFeatures.map((m, i) => (
                      <li key={i}>{m}</li>
                    ))}
                  </ul>
                </div>

                <div className="mt-3 space-y-1.5 text-xs">
                  <span className="text-[11px] font-mono text-slate-400 block uppercase">Key Differences:</span>
                  <ul className="list-disc pl-4 text-slate-400 space-y-0.5">
                    {an.keyDifferences.map((d, i) => (
                      <li key={i}>{d}</li>
                    ))}
                  </ul>
                </div>
              </div>

              <div className="mt-4 pt-3 border-t border-slate-800">
                <div className="flex justify-between items-center text-xs font-mono mb-1">
                  <span className="text-slate-400">5-Day Subsequent Return:</span>
                  <span className="font-bold text-emerald-400 tabular-nums">+{an.d5ReturnPct.toFixed(2)}%</span>
                </div>
                <p className="text-[11px] text-slate-400 font-sans">{an.outcomeSummary}</p>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Tab 4: COMEX COT & Sovereign Vault Flows */}
      {activeTab === 'cotPositioning' && (
        <div className="space-y-6">
          {/* Commodity COT Selector & Status */}
          <div className="bg-slate-900 border border-slate-800 rounded-lg p-5">
            <div className="flex flex-wrap items-center justify-between gap-4 pb-4 border-b border-slate-800">
              <div>
                <span className="text-xs font-mono text-amber-400 uppercase tracking-wider block">
                  CFTC Commitment of Traders (COT) · Institutional Market Structure
                </span>
                <h3 className="text-base font-bold text-slate-100 mt-0.5">
                  Managed Money (Speculative) vs Commercial Producer Hedging
                </h3>
              </div>

              {/* Commodity Pill Toggles */}
              <div className="flex items-center gap-1.5 bg-slate-950 p-1 rounded-lg border border-slate-800">
                {(['GOLD', 'SILVER', 'CRUDE_WTI'] as const).map((comm) => (
                  <button
                    key={comm}
                    onClick={() => setSelectedCotCommodity(comm)}
                    className={`px-3 py-1 text-xs font-mono rounded transition-colors ${
                      selectedCotCommodity === comm
                        ? 'bg-amber-500 text-slate-950 font-bold'
                        : 'text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    {comm.replace('_', ' ')}
                  </button>
                ))}
              </div>
            </div>

            {/* Selected COT Report Card */}
            {(() => {
              const report = CANONICAL_COT_REPORTS[selectedCotCommodity];
              return (
                <div className="mt-4 space-y-4">
                  <div className="flex flex-wrap items-center justify-between text-xs font-mono text-slate-400">
                    <span>Source: {report.symbol} · {report.reportDate}</span>
                    <span className="px-2 py-0.5 bg-amber-500/10 text-amber-400 border border-amber-500/20 rounded font-bold">
                      {report.crowdingRegime.replace(/_/g, ' ')}
                    </span>
                  </div>

                  {/* 4-KPI Grid */}
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs font-mono">
                    <div className="bg-slate-950/70 p-3 rounded border border-slate-800">
                      <span className="text-slate-500 block text-[10px]">MANAGED MONEY NET</span>
                      <span className="text-base font-bold text-emerald-400 tabular-nums">
                        +{report.managedMoneyNet.toLocaleString()}
                      </span>
                      <span className="text-[10px] text-slate-400 block mt-0.5">
                        {report.netChange1W >= 0 ? `+${report.netChange1W.toLocaleString()}` : report.netChange1W.toLocaleString()} 1W change
                      </span>
                    </div>

                    <div className="bg-slate-950/70 p-3 rounded border border-slate-800">
                      <span className="text-slate-500 block text-[10px]">52-WEEK POSITIONING GAUGE</span>
                      <span className="text-base font-bold text-amber-400 tabular-nums">
                        {report.percentile52W}th Percentile
                      </span>
                      {/* Percentile visual bar */}
                      <div className="w-full bg-slate-800 h-1.5 rounded-full mt-1.5 overflow-hidden">
                        <div
                          className="bg-amber-400 h-full rounded-full transition-all duration-300"
                          style={{ width: `${report.percentile52W}%` }}
                        />
                      </div>
                    </div>

                    <div className="bg-slate-950/70 p-3 rounded border border-slate-800">
                      <span className="text-slate-500 block text-[10px]">COMMERCIAL PRODUCERS NET</span>
                      <span className="text-base font-bold text-rose-400 tabular-nums">
                        {report.commercialHedgersNet.toLocaleString()}
                      </span>
                      <span className="text-[10px] text-slate-400 block mt-0.5">Producer hedge short ceiling</span>
                    </div>

                    <div className="bg-slate-950/70 p-3 rounded border border-slate-800">
                      <span className="text-slate-500 block text-[10px]">TOTAL OPEN INTEREST</span>
                      <span className="text-base font-bold text-slate-200 tabular-nums">
                        {report.totalOpenInterest.toLocaleString()}
                      </span>
                      <span className="text-[10px] text-slate-400 block mt-0.5">
                        {report.oiChange1W >= 0 ? `+${report.oiChange1W.toLocaleString()}` : report.oiChange1W.toLocaleString()} contracts
                      </span>
                    </div>
                  </div>

                  {/* Contrarian Signal Box */}
                  <div className="p-3 bg-slate-950/90 rounded border border-amber-500/20 text-xs flex items-start gap-3">
                    <ShieldCheck className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                    <div>
                      <span className="font-mono text-amber-400 font-bold block uppercase text-[11px]">
                        Institutional Positioning Interpretation
                      </span>
                      <p className="text-slate-300 mt-0.5 leading-relaxed">
                        {report.contrarianSignal}
                      </p>
                    </div>
                  </div>
                </div>
              );
            })()}
          </div>

          {/* Central Bank Sovereign Vault Reserves Section */}
          <div className="bg-slate-900 border border-slate-800 rounded-lg p-5">
            <div className="flex flex-wrap items-center justify-between gap-4 pb-4 border-b border-slate-800">
              <div>
                <span className="text-xs font-mono text-amber-400 uppercase tracking-wider block">
                  Official Sector Reserves & De-Dollarization Flows
                </span>
                <h3 className="text-base font-bold text-slate-100 mt-0.5">
                  Quarterly Sovereign Central Bank Physical Bullion Accumulation
                </h3>
              </div>
              <div className="flex items-center gap-3 font-mono text-xs">
                <span className="px-2.5 py-1 bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 rounded">
                  {CANONICAL_CENTRAL_BANK_FLOWS.totalQuarterlyTonnes} Tonnes ({CANONICAL_CENTRAL_BANK_FLOWS.latestQuarter})
                </span>
                <span className="px-2.5 py-1 bg-amber-500/10 text-amber-400 border border-amber-500/20 rounded">
                  De-Dollarization Flow Index: {CANONICAL_CENTRAL_BANK_FLOWS.deDollarizationIndex}/100
                </span>
              </div>
            </div>

            <p className="text-xs text-slate-300 mt-3 leading-relaxed">
              {CANONICAL_CENTRAL_BANK_FLOWS.strategicTakeaway}
            </p>

            {/* Sovereign Buyers Table */}
            <div className="mt-4 overflow-x-auto">
              <table className="w-full text-xs text-left">
                <thead className="bg-slate-950/80 text-slate-400 font-mono uppercase text-[10px] border-b border-slate-800">
                  <tr>
                    <th className="px-4 py-2.5">Sovereign Entity</th>
                    <th className="px-4 py-2.5">Central Bank</th>
                    <th className="px-4 py-2.5 text-right">2026 YTD Added</th>
                    <th className="px-4 py-2.5 text-right">Total Bullion Vault</th>
                    <th className="px-4 py-2.5 text-right">Gold % of FX Reserves</th>
                    <th className="px-4 py-2.5 text-center">Pace</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60 font-mono">
                  {CANONICAL_CENTRAL_BANK_FLOWS.topBuyers.map((b) => (
                    <tr key={b.country} className="hover:bg-slate-800/30">
                      <td className="px-4 py-2.5 font-bold text-slate-100">{b.country}</td>
                      <td className="px-4 py-2.5 text-slate-400 font-sans">{b.institution}</td>
                      <td className="px-4 py-2.5 text-right text-emerald-400 font-bold tabular-nums">
                        +{b.tonnesAddedYtd.toFixed(1)} t
                      </td>
                      <td className="px-4 py-2.5 text-right text-slate-200 tabular-nums">
                        {b.totalGoldReservesTonnes.toLocaleString()} t
                      </td>
                      <td className="px-4 py-2.5 text-right text-amber-400 font-bold tabular-nums">
                        {b.goldShareOfTotalReservesPct.toFixed(1)}%
                      </td>
                      <td className="px-4 py-2.5 text-center">
                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                          b.quarterlyPace === 'ACCELERATING'
                            ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                            : 'bg-slate-800 text-slate-300'
                        }`}>
                          {b.quarterlyPace}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Macro Event Volatility Projectors */}
          <div className="bg-slate-900 border border-slate-800 rounded-lg p-5">
            <div className="flex flex-wrap items-center justify-between gap-4 pb-4 border-b border-slate-800">
              <div>
                <span className="text-xs font-mono text-amber-400 uppercase tracking-wider block">
                  Event Risk Envelopes & Execution Playbooks
                </span>
                <h3 className="text-base font-bold text-slate-100 mt-0.5">
                  Projected Implied Volatility Expansion & Adverse Excursion Bounds
                </h3>
              </div>
              <span className="text-xs font-mono text-slate-400">
                Non-Execution Risk Model · Zero Order Routing
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-4">
              {CANONICAL_EVENT_VOLATILITY_PROJECTIONS.map((evt) => (
                <div key={evt.id} className="bg-slate-950/70 border border-slate-800 rounded-lg p-4 flex flex-col justify-between">
                  <div>
                    <div className="flex items-center justify-between text-xs font-mono mb-2">
                      <span className="px-2 py-0.5 bg-amber-500/10 text-amber-400 border border-amber-500/20 rounded font-bold">
                        {evt.category}
                      </span>
                      <span className="text-slate-400">
                        {new Date(evt.scheduledTime).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                      </span>
                    </div>

                    <h4 className="text-sm font-bold text-slate-100 mb-2">{evt.title}</h4>

                    <div className="space-y-1.5 text-xs font-mono border-t border-slate-800/80 pt-2 mb-3">
                      <div className="flex justify-between text-slate-400">
                        <span>Expected IV Jump:</span>
                        <span className="text-amber-400 font-bold">+{evt.expectedVolatilityBps} bps</span>
                      </div>
                      <div className="flex justify-between text-slate-400">
                        <span>Typical 1H Excursion:</span>
                        <span className="text-rose-400 font-bold">±${evt.typical1HRangeUsd.toFixed(1)}/oz</span>
                      </div>
                      <div className="flex justify-between text-slate-400">
                        <span>Historical Median Move:</span>
                        <span className="text-slate-200 font-bold">{evt.historicalMedianReactionPct.toFixed(2)}%</span>
                      </div>
                    </div>
                  </div>

                  <div className="p-2.5 bg-slate-900 rounded border border-slate-800 text-[11px] text-slate-300">
                    <strong className="text-amber-400 block text-[10px] font-mono uppercase mb-0.5">
                      Execution Protocol:
                    </strong>
                    {evt.recommendedPlaybook}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Tab 5: Futures Term Structure & Options Skew (OPT-01) */}
      {activeTab === 'futuresOptions' && (
        <div className="space-y-6">
          {/* Top 4 KPI Metrics Bar */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-slate-900 border border-slate-800 rounded-lg p-4">
              <span className="text-[10px] font-mono uppercase tracking-wider text-slate-400 block">
                Front-Month Annualized Basis
              </span>
              <div className="flex items-baseline gap-2 mt-1">
                <span className="text-2xl font-mono font-bold text-amber-400">
                  +{futuresCurve.frontMonthBasisAnnualizedPct}%
                </span>
                <span className="text-xs px-2 py-0.5 rounded font-mono font-bold bg-amber-500/10 text-amber-300 border border-amber-500/20">
                  {futuresCurve.overallCurveRegime.replace('_', ' ')}
                </span>
              </div>
              <span className="text-[11px] text-slate-500 block mt-1">
                Theoretical Carry Rate: {futuresCurve.annualizedCostOfCarryPct}%
              </span>
            </div>

            <div className="bg-slate-900 border border-slate-800 rounded-lg p-4">
              <span className="text-[10px] font-mono uppercase tracking-wider text-slate-400 block">
                Implied Convenience Yield
              </span>
              <div className="flex items-baseline gap-2 mt-1">
                <span className="text-2xl font-mono font-bold text-emerald-400">
                  +{futuresCurve.impliedConvenienceYieldPct}%
                </span>
                <span className="text-xs font-mono text-slate-400">
                  vs SOFR {futuresCurve.sofrBenchmarkRatePct}%
                </span>
              </div>
              <span className="text-[11px] text-slate-500 block mt-1">
                Spot holding premium over paper carry
              </span>
            </div>

            <div className="bg-slate-900 border border-slate-800 rounded-lg p-4">
              <span className="text-[10px] font-mono uppercase tracking-wider text-slate-400 block">
                CBOE Gold Volatility (GVZ)
              </span>
              <div className="flex items-baseline gap-2 mt-1">
                <span className="text-2xl font-mono font-bold text-slate-100">
                  {optionsSurface.currentGvzIvPct}%
                </span>
                <span className="text-xs px-2 py-0.5 rounded font-mono font-bold bg-blue-500/10 text-blue-300 border border-blue-500/20">
                  {optionsSurface.gvz52WeekRange.percentile}th %ile
                </span>
              </div>
              <span className="text-[11px] text-slate-500 block mt-1">
                52W Range: {optionsSurface.gvz52WeekRange.minPct}% – {optionsSurface.gvz52WeekRange.maxPct}%
              </span>
            </div>

            <div className="bg-slate-900 border border-slate-800 rounded-lg p-4">
              <span className="text-[10px] font-mono uppercase tracking-wider text-slate-400 block">
                25Δ Risk Reversal Skew
              </span>
              <div className="flex items-baseline gap-2 mt-1">
                <span className="text-2xl font-mono font-bold text-emerald-400">
                  +{optionsSurface.frontMonthRiskReversalPct}%
                </span>
                <span className="text-xs px-2 py-0.5 rounded font-mono font-bold bg-emerald-500/10 text-emerald-300 border border-emerald-500/20">
                  TOPSIDE CALL BIAS
                </span>
              </div>
              <span className="text-[11px] text-slate-500 block mt-1">
                Call IV exceeds Put IV (Runaway upside hedging)
              </span>
            </div>
          </div>

          {/* Section 1: COMEX Futures Term Structure Table */}
          <div className="bg-slate-900 border border-slate-800 rounded-lg overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-800 flex flex-wrap items-center justify-between gap-2">
              <div>
                <h3 className="text-sm font-semibold text-slate-100 flex items-center gap-2">
                  <Layers className="w-4 h-4 text-amber-400" />
                  CME COMEX Gold Futures Term Structure Strip (Active Delivery Months)
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  Spot Anchor: ${futuresCurve.spotPrice.toFixed(2)} | Basis = Futures Settlement - Spot Reference
                </p>
              </div>
              <span className="text-xs font-mono text-slate-400">
                SOFR Benchmark: {futuresCurve.sofrBenchmarkRatePct}%
              </span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-xs text-left font-mono tabular-nums">
                <thead className="bg-slate-950 text-slate-400 uppercase text-[10px] border-b border-slate-800">
                  <tr>
                    <th className="px-4 py-2.5">Contract</th>
                    <th className="px-4 py-2.5">Delivery Month</th>
                    <th className="px-4 py-2.5">Maturity (Days)</th>
                    <th className="px-4 py-2.5 text-right">Futures Price</th>
                    <th className="px-4 py-2.5 text-right">Dollar Basis</th>
                    <th className="px-4 py-2.5 text-right">Annualized Basis</th>
                    <th className="px-4 py-2.5 text-right">Open Interest</th>
                    <th className="px-4 py-2.5 text-center">Curve Regime</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60">
                  {futuresCurve.contracts.map((c) => (
                    <tr key={c.contractCode} className="hover:bg-slate-800/30">
                      <td className="px-4 py-2.5 text-amber-400 font-bold">{c.contractCode}</td>
                      <td className="px-4 py-2.5 text-slate-200">{c.monthName}</td>
                      <td className="px-4 py-2.5 text-slate-400">{c.daysToExpiry}d</td>
                      <td className="px-4 py-2.5 text-right text-slate-100 font-bold">${c.futuresPrice.toFixed(2)}</td>
                      <td className="px-4 py-2.5 text-right text-amber-300">+${c.dollarBasis.toFixed(2)}</td>
                      <td className="px-4 py-2.5 text-right text-emerald-400 font-bold">+{c.annualizedBasisPct}%</td>
                      <td className="px-4 py-2.5 text-right text-slate-400">{c.openInterest.toLocaleString()}</td>
                      <td className="px-4 py-2.5 text-center">
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-500/10 text-amber-300 border border-amber-500/20">
                          {c.curveRegime}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Section 2: Options Implied Volatility Surface & Skew Term Structure */}
          <div className="bg-slate-900 border border-slate-800 rounded-lg overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-800 flex flex-wrap items-center justify-between gap-2">
              <div>
                <h3 className="text-sm font-semibold text-slate-100 flex items-center gap-2">
                  <Activity className="w-4 h-4 text-amber-400" />
                  CBOE GVZ Gold Implied Volatility Surface & 25Δ Skew Smile
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  Topside Call Premium (IV Call - IV Put) Pricing Institutional Inflation & Currency Debasement Protection
                </p>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-mono text-amber-300 bg-amber-500/10 px-2 py-1 rounded border border-amber-500/30">
                  {optionsSurface.provenanceModel} (NOT LIVE OPRA)
                </span>
                <span className="text-xs font-mono text-emerald-400 bg-emerald-500/10 px-2.5 py-1 rounded border border-emerald-500/20">
                  {optionsSurface.skewBias.replace(/_/g, ' ')}
                </span>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-xs text-left font-mono tabular-nums">
                <thead className="bg-slate-950 text-slate-400 uppercase text-[10px] border-b border-slate-800">
                  <tr>
                    <th className="px-4 py-2.5">Tenor</th>
                    <th className="px-4 py-2.5">Days</th>
                    <th className="px-4 py-2.5 text-right">ATM IV</th>
                    <th className="px-4 py-2.5 text-right">25Δ Call IV</th>
                    <th className="px-4 py-2.5 text-right">25Δ Put IV</th>
                    <th className="px-4 py-2.5 text-right">25Δ Risk Reversal</th>
                    <th className="px-4 py-2.5 text-right">25Δ Butterfly (Fly)</th>
                    <th className="px-4 py-2.5 text-center">Institutional Sentiment</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60">
                  {optionsSurface.termStructure.map((v) => (
                    <tr key={v.tenor} className="hover:bg-slate-800/30">
                      <td className="px-4 py-2.5 text-slate-200 font-bold">{v.tenor}</td>
                      <td className="px-4 py-2.5 text-slate-400">{v.days}d</td>
                      <td className="px-4 py-2.5 text-right text-slate-100 font-bold">{v.atmIvPct}%</td>
                      <td className="px-4 py-2.5 text-right text-emerald-400 font-semibold">{v.call25DeltaIvPct}%</td>
                      <td className="px-4 py-2.5 text-right text-rose-400 font-semibold">{v.put25DeltaIvPct}%</td>
                      <td className="px-4 py-2.5 text-right text-emerald-400 font-bold">+{v.riskReversal25DeltaPct}%</td>
                      <td className="px-4 py-2.5 text-right text-blue-400">+{v.butterfly25DeltaPct}%</td>
                      <td className="px-4 py-2.5 text-center">
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-500/10 text-emerald-300 border border-emerald-500/20">
                          {v.topsideDemandSentiment.replace(/_/g, ' ')}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Interpretive Summary Footer */}
            <div className="p-4 bg-slate-950/70 border-t border-slate-800/80 text-xs text-slate-300 leading-relaxed font-sans">
              <strong className="text-amber-400 font-mono block uppercase text-[11px] mb-1">
                Options Market Volatility Analysis:
              </strong>
              {optionsSurface.interpretiveSummary}
            </div>
          </div>

          {/* Physical Delivery Squeeze Pressure Meter Card */}
          <div className="bg-slate-900 border border-slate-800 rounded-lg p-5">
            <div className="flex flex-wrap items-center justify-between gap-4 pb-3 border-b border-slate-800">
              <div>
                <span className="text-xs font-mono text-amber-400 uppercase tracking-wider block">
                  COMEX Physical Delivery Risk Monitor
                </span>
                <h4 className="text-base font-bold text-slate-100 mt-0.5">
                  Physical Vault Inventory vs Paper Futures Claims
                </h4>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs text-slate-400 font-mono">Squeeze Likelihood:</span>
                <span className="text-sm font-bold font-mono text-amber-400">
                  {futuresCurve.physicalSqueezeProbabilityPct}%
                </span>
              </div>
            </div>

            <div className="my-4">
              <div className="w-full bg-slate-950 h-2.5 rounded-full overflow-hidden border border-slate-800">
                <div
                  className="bg-gradient-to-r from-emerald-500 via-amber-400 to-rose-500 h-full rounded-full transition-all duration-500"
                  style={{ width: `${futuresCurve.physicalSqueezeProbabilityPct}%` }}
                />
              </div>
              <div className="flex justify-between text-[10px] font-mono text-slate-500 mt-1">
                <span>0% (Plentiful Delivery Buffer)</span>
                <span>50% (Tight Spot Delivery)</span>
                <span>100% (Imminent Delivery Squeeze)</span>
              </div>
            </div>

            <p className="text-xs text-slate-300 leading-relaxed">
              {futuresCurve.deliveryPressureSummary}
            </p>
          </div>
        </div>
      )}
    </div>
  );
};
