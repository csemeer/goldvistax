/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * Aurum Intelligence — Portfolio, Multi-Commodity Scanner, Margin Heat-Map & Physical Bullion DCA Workspace
 *
 * Implements Phase 6:
 * 1. Paper Position Tracking & Journaling (Simulated Execution).
 * 2. Real-Time Multi-Commodity Opportunity Scanner.
 * 3. Cross-Commodity Portfolio Margin Aggregation & Macro Stress Testing.
 * 4. Physical Precious Metals Vault Dollar-Cost-Averaging (DCA) Model.
 */

import React, { useEffect, useRef, useState } from 'react';
import { PaperPosition, Quote, TradePlan } from '../domain/types';
import {
  BookOpen,
  Plus,
  Radar,
  PieChart,
  Coins,
  ShieldCheck,
  RotateCcw,
} from 'lucide-react';
import {
  scanCommodityOpportunities,
  calculatePortfolioMarginHeatmap,
  calculatePhysicalBullionDCA,
  runPortfolioScenarioMatrix,
} from '../services/portfolioScannerEngine';
import { getSessionBearerToken } from '../services/authService';

interface PortfolioJournalWorkspaceProps {
  quote: Quote;
  quotes?: Record<string, Quote>;
  tradePlans: Record<string, TradePlan>;
  newPaperPlan?: TradePlan | null;
}

function calcDirectionalPnl(pos: PaperPosition, markPrice: number): number {
  const delta = pos.direction === 'SELL' ? pos.entryPrice - markPrice : markPrice - pos.entryPrice;
  return delta * pos.lots * 100;
}

export const PortfolioJournalWorkspace: React.FC<PortfolioJournalWorkspaceProps> = ({
  quote,
  quotes = {},
  tradePlans,
  newPaperPlan,
}) => {
  const [activeTab, setActiveTab] = useState<'journal' | 'scanner' | 'margin' | 'physicalDca'>('journal');
  const [balance, setBalance] = useState<number>(100000);
  const [positions, setPositions] = useState<PaperPosition[]>([
    {
      id: 'POS-01',
      tradePlanId: 'PLAN-SWING-03',
      instrumentId: 'XAUUSD',
      direction: 'BUY',
      lots: 2.0,
      entryPrice: 3885.0,
      currentPrice: quote.mid,
      stopLoss: 3865.0,
      takeProfit: 3935.0,
      unrealizedPnl: (quote.mid - 3885.0) * 2.0 * 100,
      realizedPnl: 0,
      openTime: '2026-11-01T04:30:00Z',
      status: 'OPEN',
      notes: 'Entered on 21 EMA pullback test with confluence from Central Bank Q3 report.',
    },
    {
      id: 'POS-02',
      tradePlanId: 'PLAN-INTRADAY-01',
      instrumentId: 'XAUUSD',
      direction: 'BUY',
      lots: 1.5,
      entryPrice: 3862.5,
      currentPrice: 3884.5,
      stopLoss: 3850.0,
      takeProfit: 3884.5,
      unrealizedPnl: 0,
      realizedPnl: (3884.5 - 3862.5) * 1.5 * 100, // +$3,300
      openTime: '2026-10-31T14:15:00Z',
      status: 'CLOSED_PROFIT',
      notes: 'London session breakout setup; cleanly hit TP1 with zero adverse excursion.',
    },
  ]);

  const [journalNote, setJournalNote] = useState('');
  const [selectedPlanKey, setSelectedPlanKey] = useState<string>('INTRADAY');
  const [journalError, setJournalError] = useState<string | null>(null);
  const [journalPersistenceLabel, setJournalPersistenceLabel] = useState<string>('LOCAL_SESSION');
  const [journalBusy, setJournalBusy] = useState<boolean>(false);
  const lastHandledPlanRef = useRef<string | null>(null);

  // DCA Model Interactive Parameters
  const [dcaMonthlyBudget, setDcaMonthlyBudget] = useState<number>(2500);
  const [dcaHorizonMonths, setDcaHorizonMonths] = useState<number>(24);
  const [dcaGoldSplit, setDcaGoldSplit] = useState<number>(75);

  const persistJournalAction = async (body: Record<string, unknown>) => {
    const token = getSessionBearerToken();
    if (!token) return null;
    try {
      setJournalBusy(true);
      setJournalError(null);
      const res = await fetch('/api/portfolio/journal', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(body),
      });
      const json = (await res.json()) as {
        success?: boolean;
        error?: string;
        persistenceMode?: string;
        positions?: PaperPosition[];
      };
      if (!res.ok) {
        setJournalError(json.error || `Journal sync failed (HTTP ${res.status}).`);
        return null;
      }
      if (json.persistenceMode) {
        setJournalPersistenceLabel(json.persistenceMode);
      }
      if (Array.isArray(json.positions)) {
        setPositions(json.positions);
      }
      return json;
    } catch (err: any) {
      setJournalError(String(err?.message || 'Unable to sync paper journal to server.'));
      return null;
    } finally {
      setJournalBusy(false);
    }
  };

  // Hydrate tenant-scoped paper journal from server on mount
  useEffect(() => {
    const token = getSessionBearerToken();
    if (!token) return;
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch('/api/portfolio/journal', {
          headers: { Authorization: `Bearer ${token}` },
        });
        const json = (await res.json()) as {
          success?: boolean;
          persistenceMode?: string;
          positions?: PaperPosition[];
          error?: string;
        };
        if (cancelled) return;
        if (!res.ok) {
          setJournalError(json.error || `Unable to load paper journal (HTTP ${res.status}).`);
          return;
        }
        if (json.persistenceMode) {
          setJournalPersistenceLabel(json.persistenceMode);
        }
        if (Array.isArray(json.positions)) {
          setPositions(json.positions);
        }
      } catch {
        // retain local fallback if offline
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // Handle incoming execution trigger from trade plan cards
  useEffect(() => {
    if (newPaperPlan && lastHandledPlanRef.current !== newPaperPlan.id) {
      lastHandledPlanRef.current = newPaperPlan.id;
      setSelectedPlanKey(newPaperPlan.horizon);
      const newPos: PaperPosition = {
        id: `POS-${Date.now().toString().slice(-6)}`,
        tradePlanId: newPaperPlan.id,
        instrumentId: newPaperPlan.instrumentId,
        direction: newPaperPlan.direction === 'SELL' ? 'SELL' : 'BUY',
        lots: 1.0,
        entryPrice: quote.mid,
        currentPrice: quote.mid,
        stopLoss: newPaperPlan.stopLossPrice,
        takeProfit: newPaperPlan.target1Price,
        unrealizedPnl: 0,
        realizedPnl: 0,
        openTime: new Date().toISOString(),
        status: 'OPEN',
        notes: `Simulated paper execution from ${newPaperPlan.horizon} advisory plan at $${quote.mid.toFixed(2)}.`,
      };
      setPositions((prev) => [newPos, ...prev]);
      void persistJournalAction({ action: 'OPEN', position: newPos });
    }
  }, [newPaperPlan]);

  // Calculations for sub-features
  const effectiveQuotes = { ...quotes, XAUUSD: quote };
  const opportunityScans = scanCommodityOpportunities(effectiveQuotes);
  const marginHeatmap = calculatePortfolioMarginHeatmap(positions, balance, 30);
  const dcaResult = calculatePhysicalBullionDCA({
    monthlyBudgetUsd: dcaMonthlyBudget,
    horizonMonths: dcaHorizonMonths,
    goldAllocationPct: dcaGoldSplit,
    silverAllocationPct: 100 - dcaGoldSplit,
    goldSpotPrice: quote.mid || 4048.5,
    silverSpotPrice: quotes.XAGUSD?.mid || 48.2,
  });

  // Summary statistics
  const openPositions = positions.filter((p) => p.status === 'OPEN');
  const closedPositions = positions.filter((p) => p.status !== 'OPEN');

  const totalUnrealized = openPositions.reduce(
    (acc, p) => acc + calcDirectionalPnl(p, quote.mid),
    0
  );
  const totalRealized = closedPositions.reduce((acc, p) => acc + p.realizedPnl, 0);

  const handleOpenFromPlan = async () => {
    const plan = tradePlans[selectedPlanKey];
    if (!plan) return;

    const newPos: PaperPosition = {
      id: `POS-${Date.now().toString().slice(-6)}`,
      tradePlanId: plan.id,
      instrumentId: plan.instrumentId,
      direction: plan.direction === 'SELL' ? 'SELL' : 'BUY',
      lots: 1.0,
      entryPrice: quote.mid,
      currentPrice: quote.mid,
      stopLoss: plan.stopLossPrice,
      takeProfit: plan.target1Price,
      unrealizedPnl: 0,
      realizedPnl: 0,
      openTime: new Date().toISOString(),
      status: 'OPEN',
      notes: journalNote || `Manual paper execution based on ${plan.horizon} trade setup.`,
    };

    const synced = await persistJournalAction({ action: 'OPEN', position: newPos });
    if (!synced) {
      setPositions([newPos, ...positions]);
    }
    setJournalNote('');
  };

  const handleClosePosition = async (posId: string) => {
    const synced = await persistJournalAction({ action: 'CLOSE', positionId: posId, closePrice: quote.mid });
    if (!synced) {
      setPositions(
        positions.map((p) => {
          if (p.id === posId && p.status === 'OPEN') {
            const finalPnl = Number(calcDirectionalPnl(p, quote.mid).toFixed(2));
            return {
              ...p,
              status: finalPnl >= 0 ? 'CLOSED_PROFIT' : 'CLOSED_LOSS',
              realizedPnl: finalPnl,
              unrealizedPnl: 0,
            };
          }
          return p;
        })
      );
    }
  };

  const handleResetJournal = async () => {
    await persistJournalAction({ action: 'RESET' });
  };

  return (
    <div className="space-y-6">
      {/* Top Banner / Non-Execution Paper Trading Disclaimers */}
      <div className="bg-slate-900 border border-slate-800 rounded-lg p-5">
        <div className="flex flex-wrap items-center justify-between gap-4 pb-4 border-b border-slate-800">
          <div>
            <span className="text-xs font-mono text-amber-400 uppercase tracking-wider block">
              Decision Support & Risk Analytics · Non-Execution Environment
            </span>
            <h2 className="text-xl font-bold text-slate-100 mt-0.5">
              Portfolio Risk, Opportunity Scanner & Physical DCA Engine
            </h2>
          </div>
          <div className="flex flex-wrap items-center gap-4 text-xs font-mono text-slate-400">
            <span>Paper Capital: ${balance.toLocaleString()}</span>
            <span aria-hidden="true">·</span>
            <span className="text-emerald-400">Zero Live Broker Risk</span>
            <span aria-hidden="true">·</span>
            <span>Sync: {journalPersistenceLabel}</span>
            <button
              type="button"
              onClick={handleResetJournal}
              disabled={journalBusy}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 transition-colors disabled:opacity-50"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              Reset Ledger
            </button>
          </div>
        </div>
        {journalError && (
          <div
            role="alert"
            className="mt-3 rounded border border-rose-500/40 bg-rose-500/10 px-3 py-2 text-xs text-rose-300 font-mono"
          >
            {journalError}
          </div>
        )}

        {/* 4-KPI Overview Bar */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-4 text-xs font-mono">
          <div className="bg-slate-950/70 p-3 rounded border border-slate-800">
            <span className="text-slate-500 block text-[10px]">TOTAL UNREALIZED P&L</span>
            <span
              className={`text-base font-bold tabular-nums ${
                totalUnrealized >= 0 ? 'text-emerald-400' : 'text-rose-400'
              }`}
            >
              {totalUnrealized >= 0 ? `+$${totalUnrealized.toFixed(2)}` : `-$${Math.abs(totalUnrealized).toFixed(2)}`}
            </span>
            <span className="text-[10px] text-slate-400 block mt-0.5">
              {openPositions.length} active positions
            </span>
          </div>

          <div className="bg-slate-950/70 p-3 rounded border border-slate-800">
            <span className="text-slate-500 block text-[10px]">CUMULATIVE REALIZED P&L</span>
            <span
              className={`text-base font-bold tabular-nums ${
                totalRealized >= 0 ? 'text-emerald-400' : 'text-rose-400'
              }`}
            >
              {totalRealized >= 0 ? `+$${totalRealized.toFixed(2)}` : `-$${Math.abs(totalRealized).toFixed(2)}`}
            </span>
            <span className="text-[10px] text-slate-400 block mt-0.5">
              {closedPositions.length} completed trades
            </span>
          </div>

          <div className="bg-slate-950/70 p-3 rounded border border-slate-800">
            <span className="text-slate-500 block text-[10px]">MARGIN UTILIZATION</span>
            <span className="text-base font-bold text-amber-400 tabular-nums">
              {marginHeatmap.marginUtilizationPct}%
            </span>
            <span className="text-[10px] text-slate-400 block mt-0.5">
              Status: {marginHeatmap.marginHealthStatus.replace(/_/g, ' ')}
            </span>
          </div>

          <div className="bg-slate-950/70 p-3 rounded border border-slate-800">
            <span className="text-slate-500 block text-[10px]">1-DAY 95% VaR ESTIMATE</span>
            <span className="text-base font-bold text-slate-200 tabular-nums">
              ${marginHeatmap.dailyParametricVaR95Usd.toFixed(2)}
            </span>
            <span className="text-[10px] text-slate-400 block mt-0.5">
              Effective Lev: {marginHeatmap.effectiveLeverageRatio}x
            </span>
          </div>
        </div>
      </div>

      {/* Sub-Navigation Tabs */}
      <div className="flex items-center gap-2 border-b border-slate-800 pb-2">
        <button
          onClick={() => setActiveTab('journal')}
          className={`flex items-center gap-2 px-4 py-2 text-xs font-medium rounded-md transition-colors ${
            activeTab === 'journal'
              ? 'bg-amber-500/10 text-amber-300 border border-amber-500/30 font-semibold'
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <BookOpen className="w-4 h-4" />
          Paper Journal ({positions.length})
        </button>

        <button
          onClick={() => setActiveTab('scanner')}
          className={`flex items-center gap-2 px-4 py-2 text-xs font-medium rounded-md transition-colors ${
            activeTab === 'scanner'
              ? 'bg-amber-500/10 text-amber-300 border border-amber-500/30 font-semibold'
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <Radar className="w-4 h-4" />
          Multi-Commodity Scanner ({opportunityScans.length})
        </button>

        <button
          onClick={() => setActiveTab('margin')}
          className={`flex items-center gap-2 px-4 py-2 text-xs font-medium rounded-md transition-colors ${
            activeTab === 'margin'
              ? 'bg-amber-500/10 text-amber-300 border border-amber-500/30 font-semibold'
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <PieChart className="w-4 h-4" />
          Margin & Stress Heat-Map
        </button>

        <button
          onClick={() => setActiveTab('physicalDca')}
          className={`flex items-center gap-2 px-4 py-2 text-xs font-medium rounded-md transition-colors ${
            activeTab === 'physicalDca'
              ? 'bg-amber-500/10 text-amber-300 border border-amber-500/30 font-semibold'
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <Coins className="w-4 h-4" />
          Physical Bullion DCA Model
        </button>
      </div>

      {/* TAB 1: PAPER JOURNAL & EXECUTION */}
      {activeTab === 'journal' && (
        <div className="space-y-6">
          {/* Quick Simulated Trade Entry Form */}
          <div className="bg-slate-900 border border-slate-800 rounded-lg p-5">
            <h3 className="text-sm font-semibold text-slate-100 mb-3">
              Open Simulated Paper Position from Active Advisory Plans
            </h3>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div>
                <label className="block text-[11px] font-mono text-slate-400 mb-1">
                  Advisory Plan Horizon:
                </label>
                <select
                  value={selectedPlanKey}
                  onChange={(e) => setSelectedPlanKey(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded px-3 py-2 text-xs text-slate-200 font-mono"
                >
                  <option value="INTRADAY">Intraday Scalp (M15)</option>
                  <option value="SWING">Swing Setup (H4)</option>
                  <option value="LONG_TERM">Macro Outlook (W1)</option>
                  <option value="CFD">CFD Risk Protocol</option>
                </select>
              </div>

              <div>
                <label className="block text-[11px] font-mono text-slate-400 mb-1">
                  Analytical Notes / Pre-Trade Thesis:
                </label>
                <input
                  type="text"
                  placeholder="e.g. Confluence with 21 EMA and TIPS real yields..."
                  value={journalNote}
                  onChange={(e) => setJournalNote(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded px-3 py-2 text-xs text-slate-200"
                />
              </div>

              <div className="flex items-end">
                <button
                  onClick={handleOpenFromPlan}
                  className="w-full bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold px-4 py-2 rounded text-xs transition-colors flex items-center justify-center gap-1.5"
                >
                  <Plus className="w-4 h-4" />
                  Simulate Paper Order (1.0 Lot)
                </button>
              </div>
            </div>
          </div>

          {/* Active Positions Table */}
          <div className="bg-slate-900 border border-slate-800 rounded-lg overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-800 flex items-center justify-between">
              <h3 className="text-sm font-semibold text-slate-100">
                Active Paper Positions ({openPositions.length})
              </h3>
              <span className="text-xs font-mono text-slate-400">
                Marked to Live Spot Mid: ${quote.mid.toFixed(2)}
              </span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-xs text-left">
                <thead className="bg-slate-950 text-slate-400 font-mono uppercase text-[10px] border-b border-slate-800">
                  <tr>
                    <th className="px-4 py-3">ID / Time</th>
                    <th className="px-4 py-3">Instrument</th>
                    <th className="px-4 py-3">Side</th>
                    <th className="px-4 py-3 text-right">Lots</th>
                    <th className="px-4 py-3 text-right">Entry</th>
                    <th className="px-4 py-3 text-right">Current</th>
                    <th className="px-4 py-3 text-right">Stop Loss</th>
                    <th className="px-4 py-3 text-right">Target 1</th>
                    <th className="px-4 py-3 text-right">Unrealized P&L</th>
                    <th className="px-4 py-3 text-center">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60 font-mono">
                  {openPositions.length === 0 ? (
                    <tr>
                      <td colSpan={10} className="px-4 py-6 text-center text-slate-500">
                        No active paper positions. Open a simulated trade above or from any trade plan card.
                      </td>
                    </tr>
                  ) : (
                    openPositions.map((pos) => {
                      const pnl = calcDirectionalPnl(pos, quote.mid);
                      return (
                        <tr key={pos.id} className="hover:bg-slate-800/30">
                          <td className="px-4 py-3 text-slate-400">{pos.id}</td>
                          <td className="px-4 py-3 font-bold text-slate-200">{pos.instrumentId}</td>
                          <td className="px-4 py-3">
                            <span
                              className={`px-2 py-0.5 rounded font-bold ${
                                pos.direction === 'SELL'
                                  ? 'text-rose-400 bg-rose-500/10'
                                  : 'text-emerald-400 bg-emerald-500/10'
                              }`}
                            >
                              {pos.direction}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-right text-slate-300">{pos.lots.toFixed(2)}</td>
                          <td className="px-4 py-3 text-right text-slate-300">${pos.entryPrice.toFixed(2)}</td>
                          <td className="px-4 py-3 text-right text-amber-400 font-bold">${quote.mid.toFixed(2)}</td>
                          <td className="px-4 py-3 text-right text-rose-400">${pos.stopLoss.toFixed(2)}</td>
                          <td className="px-4 py-3 text-right text-emerald-400">${pos.takeProfit.toFixed(2)}</td>
                          <td
                            className={`px-4 py-3 text-right font-bold tabular-nums ${
                              pnl >= 0 ? 'text-emerald-400' : 'text-rose-400'
                            }`}
                          >
                            {pnl >= 0 ? `+$${pnl.toFixed(2)}` : `-$${Math.abs(pnl).toFixed(2)}`}
                          </td>
                          <td className="px-4 py-3 text-center">
                            <button
                              onClick={() => handleClosePosition(pos.id)}
                              className="px-2.5 py-1 bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/20 rounded text-[11px] font-semibold transition-colors"
                            >
                              Close Market
                            </button>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Trade Journal & Closed History */}
          <div className="bg-slate-900 border border-slate-800 rounded-lg overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-800 flex items-center justify-between">
              <h3 className="text-sm font-semibold text-slate-100">
                Closed Trades & Analytical Post-Mortem Log ({closedPositions.length})
              </h3>
            </div>

            <div className="divide-y divide-slate-800/80">
              {closedPositions.map((pos) => (
                <div key={pos.id} className="p-4 hover:bg-slate-800/20 transition-colors">
                  <div className="flex flex-wrap items-center justify-between gap-2 text-xs font-mono">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-slate-200">{pos.instrumentId}</span>
                      <span className="text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded font-bold">
                        {pos.direction} {pos.lots} lots
                      </span>
                      <span className="text-slate-400">Entry: ${pos.entryPrice.toFixed(2)}</span>
                    </div>

                    <div className="flex items-center gap-3">
                      <span
                        className={`font-bold tabular-nums ${
                          pos.realizedPnl >= 0 ? 'text-emerald-400' : 'text-rose-400'
                        }`}
                      >
                        {pos.realizedPnl >= 0
                          ? `+$${pos.realizedPnl.toFixed(2)}`
                          : `-$${Math.abs(pos.realizedPnl).toFixed(2)}`}
                      </span>
                      <span className="text-[10px] text-slate-500">{pos.openTime.slice(0, 10)}</span>
                    </div>
                  </div>

                  {pos.notes && (
                    <p className="text-xs text-slate-400 mt-2 font-sans bg-slate-950/60 p-2 rounded border border-slate-800/80">
                      <strong>Journal Note:</strong> {pos.notes}
                    </p>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: MULTI-COMMODITY OPPORTUNITY SCANNER */}
      {activeTab === 'scanner' && (
        <div className="space-y-6">
          <div className="bg-slate-900 border border-slate-800 rounded-lg p-5">
            <div className="flex flex-wrap items-center justify-between gap-4 pb-4 border-b border-slate-800">
              <div>
                <span className="text-xs font-mono text-amber-400 uppercase tracking-wider block">
                  Cross-Asset Opportunity Screen
                </span>
                <h3 className="text-base font-bold text-slate-100 mt-0.5">
                  Real-Time Confluence Radar & Priority Setups
                </h3>
              </div>
              <span className="text-xs font-mono text-slate-400">
                Anchored to Sourced Spot & Futures References
              </span>
            </div>

            <div className="mt-4 grid grid-cols-1 gap-4">
              {opportunityScans.map((scan) => (
                <div
                  key={scan.instrumentId}
                  className="bg-slate-950/70 border border-slate-800 rounded-lg p-4 hover:border-amber-500/30 transition-all"
                >
                  <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-slate-800/80">
                    <div className="flex items-center gap-3">
                      <span className="w-6 h-6 rounded-full bg-amber-500/10 text-amber-400 border border-amber-500/20 text-xs font-mono font-bold flex items-center justify-center">
                        #{scan.priorityRank}
                      </span>
                      <div>
                        <h4 className="text-sm font-bold text-slate-100 flex items-center gap-2">
                          {scan.name} ({scan.symbol})
                          <span className="text-xs font-mono text-slate-400 bg-slate-800 px-2 py-0.5 rounded">
                            {scan.assetClass.replace('_', ' ')}
                          </span>
                        </h4>
                      </div>
                    </div>

                    <div className="flex items-center gap-3 font-mono text-xs">
                      <span className="text-slate-300 font-bold">${scan.currentPrice.toFixed(2)}</span>
                      <span
                        className={`font-bold ${
                          scan.change24hPct >= 0 ? 'text-emerald-400' : 'text-rose-400'
                        }`}
                      >
                        {scan.change24hPct >= 0 ? `+${scan.change24hPct.toFixed(2)}%` : `${scan.change24hPct.toFixed(2)}%`}
                      </span>
                      <span className="px-2.5 py-1 bg-amber-500/10 text-amber-400 border border-amber-500/20 rounded font-bold">
                        {scan.actionableSetup.replace(/_/g, ' ')}
                      </span>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-3 text-xs font-mono">
                    <div>
                      <span className="text-slate-500 block text-[10px]">ENTRY CORRIDOR</span>
                      <span className="text-slate-200 font-bold">
                        ${scan.entryCorridor[0]} - ${scan.entryCorridor[1]}
                      </span>
                    </div>
                    <div>
                      <span className="text-slate-500 block text-[10px]">STOP LOSS</span>
                      <span className="text-rose-400 font-bold">${scan.stopLoss}</span>
                    </div>
                    <div>
                      <span className="text-slate-500 block text-[10px]">TARGET 1 (TP1)</span>
                      <span className="text-emerald-400 font-bold">${scan.target1}</span>
                    </div>
                    <div>
                      <span className="text-slate-500 block text-[10px]">NET REWARD:RISK</span>
                      <span className="text-amber-400 font-bold">1:{scan.rewardToRiskRatio}</span>
                    </div>
                  </div>

                  <div className="mt-3 pt-2.5 border-t border-slate-800/60 flex flex-wrap items-center justify-between gap-2 text-xs">
                    <p className="text-slate-300 text-[11px] leading-relaxed">
                      <strong className="text-slate-400 font-mono">Catalyst:</strong> {scan.catalystSummary}
                    </p>
                    <span className="text-[10px] font-mono text-slate-500">
                      Hard Invalidation: {scan.invalidationLevel}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* TAB 3: PORTFOLIO MARGIN & MACRO STRESS HEAT-MAP */}
      {activeTab === 'margin' && (
        <div className="space-y-6">
          <div className="bg-slate-900 border border-slate-800 rounded-lg p-5">
            <div className="flex flex-wrap items-center justify-between gap-4 pb-4 border-b border-slate-800">
              <div>
                <span className="text-xs font-mono text-amber-400 uppercase tracking-wider block">
                  Cross-Commodity Aggregate Risk
                </span>
                <h3 className="text-base font-bold text-slate-100 mt-0.5">
                  Portfolio Margin Utilization & Extreme Macro Stress Test
                </h3>
              </div>
              <span
                className={`px-3 py-1 rounded text-xs font-mono font-bold ${
                  marginHeatmap.marginHealthStatus === 'OPTIMAL_SAFE'
                    ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                    : 'bg-rose-500/10 text-rose-400 border border-rose-500/20'
                }`}
              >
                {marginHeatmap.marginHealthStatus.replace(/_/g, ' ')}
              </span>
            </div>

            {/* Margin KPI Grid */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-4 text-xs font-mono">
              <div className="bg-slate-950/70 p-3 rounded border border-slate-800">
                <span className="text-slate-500 block text-[10px]">TOTAL GROSS NOTIONAL</span>
                <span className="text-base font-bold text-slate-200 tabular-nums">
                  ${marginHeatmap.totalGrossNotional.toLocaleString()}
                </span>
                <span className="text-[10px] text-slate-400 block mt-0.5">
                  Account Equity: ${marginHeatmap.accountEquity.toLocaleString()}
                </span>
              </div>

              <div className="bg-slate-950/70 p-3 rounded border border-slate-800">
                <span className="text-slate-500 block text-[10px]">TOTAL MARGIN COMMITTED</span>
                <span className="text-base font-bold text-amber-400 tabular-nums">
                  ${marginHeatmap.totalMarginUsed.toLocaleString()}
                </span>
                <span className="text-[10px] text-slate-400 block mt-0.5">
                  Free Margin: ${marginHeatmap.freeMargin.toLocaleString()}
                </span>
              </div>

              <div className="bg-slate-950/70 p-3 rounded border border-slate-800">
                <span className="text-slate-500 block text-[10px]">DAILY 95% PARAMETRIC VaR</span>
                <span className="text-base font-bold text-rose-400 tabular-nums">
                  ${marginHeatmap.dailyParametricVaR95Usd.toLocaleString()}
                </span>
                <span className="text-[10px] text-slate-400 block mt-0.5">
                  Normal 1-day market boundary
                </span>
              </div>

              <div className="bg-slate-950/70 p-3 rounded border border-slate-800">
                <span className="text-slate-500 block text-[10px]">MACRO YIELD SHOCK LOSS</span>
                <span className="text-base font-bold text-rose-400 tabular-nums">
                  -${marginHeatmap.macroStressTestShockLossUsd.toLocaleString()}
                </span>
                <span className="text-[10px] text-slate-400 block mt-0.5">
                  +50bps Yield Spike Stress Test
                </span>
              </div>
            </div>

            {/* Asset Class Concentration Bar */}
            <div className="mt-5 p-4 bg-slate-950 rounded border border-slate-800">
              <span className="text-xs font-mono text-slate-400 block mb-2 uppercase">
                Asset Class Concentration Allocation:
              </span>
              <div className="w-full bg-slate-800 h-3 rounded-full overflow-hidden flex">
                <div
                  className="bg-amber-400 h-full"
                  style={{ width: `${marginHeatmap.concentrationByAssetClass.preciousMetalsPct}%` }}
                  title="Precious Metals"
                />
                <div
                  className="bg-emerald-400 h-full"
                  style={{ width: `${marginHeatmap.concentrationByAssetClass.energyPct}%` }}
                  title="Energy"
                />
                <div
                  className="bg-blue-400 h-full"
                  style={{ width: `${marginHeatmap.concentrationByAssetClass.currencyPct}%` }}
                  title="Currency"
                />
              </div>

              <div className="flex items-center justify-between text-xs font-mono mt-2 text-slate-400">
                <span className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-full bg-amber-400" />
                  Precious Metals: {marginHeatmap.concentrationByAssetClass.preciousMetalsPct}%
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-full bg-emerald-400" />
                  Energy (Crude): {marginHeatmap.concentrationByAssetClass.energyPct}%
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-full bg-blue-400" />
                  Currency (DXY): {marginHeatmap.concentrationByAssetClass.currencyPct}%
                </span>
              </div>
            </div>

            {/* Normalized Derivative Exposures by Physical Unit + Risk Summary */}
            {marginHeatmap.normalizedExposuresByUnit.length > 0 && (
              <div className="mt-4 p-4 bg-slate-950 rounded border border-slate-800">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-mono text-slate-400 uppercase">
                    Contract-Unit Normalized Paper Exposures (Physical Bullion Segregated)
                  </span>
                  <span className="text-[10px] font-mono text-emerald-400">
                    Physical Separation: {marginHeatmap.isPhysicalBullionSeparated ? 'ENFORCED' : 'UNVERIFIED'}
                  </span>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-2 text-xs font-mono">
                  {marginHeatmap.normalizedExposuresByUnit.map((exp, idx) => (
                    <div key={`${exp.instrumentId}-${idx}`} className="bg-slate-900 border border-slate-800 rounded p-2.5">
                      <div className="flex justify-between font-bold text-slate-200">
                        <span>{exp.instrumentId}</span>
                        <span>{exp.normalizedUnitsHeld.toLocaleString()} {exp.physicalUnit}</span>
                      </div>
                      <div className="text-[10px] text-slate-400 mt-1">
                        {exp.lots} lots · Paper Derivative Notional ${exp.notionalUsd.toLocaleString()}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Phase 9 Multi-Scenario Stress Matrix */}
            <div className="mt-4 p-4 bg-slate-950 rounded border border-slate-800">
              <span className="text-xs font-mono text-amber-400 uppercase block mb-2.5">
                Multi-Scenario Macro Stress Matrix (Simulated Paper Portfolio)
              </span>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs font-mono">
                {runPortfolioScenarioMatrix(positions, balance).map((sc) => (
                  <div key={sc.scenarioId} className="bg-slate-900 border border-slate-800 rounded p-3">
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-bold text-slate-100">{sc.label}</span>
                      <span
                        className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                          sc.healthStatus === 'RESILIENT'
                            ? 'bg-emerald-500/10 text-emerald-400'
                            : sc.healthStatus === 'ELEVATED_STRESS'
                            ? 'bg-amber-500/10 text-amber-400'
                            : 'bg-rose-500/10 text-rose-400'
                        }`}
                      >
                        {sc.healthStatus.replace(/_/g, ' ')}
                      </span>
                    </div>
                    <p className="text-[10px] text-slate-400 mt-1">{sc.macroAssumptions}</p>
                    <div className="flex items-center justify-between mt-2 pt-2 border-t border-slate-800/80">
                      <span className={sc.derivativePnlDeltaUsd >= 0 ? 'text-emerald-400' : 'text-rose-400'}>
                        Est. P&amp;L: {sc.derivativePnlDeltaUsd >= 0 ? '+' : ''}${sc.derivativePnlDeltaUsd.toLocaleString()}
                      </span>
                      <span className="text-slate-300">
                        Stressed Margin: {sc.stressedMarginUtilizationPct}%
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Risk Summary */}
            <div className="mt-4 p-3 bg-slate-950 rounded border border-slate-800 text-xs flex items-center gap-3">
              <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0" />
              <p className="text-slate-300">{marginHeatmap.riskSummary}</p>
            </div>
          </div>
        </div>
      )}

      {/* TAB 4: PHYSICAL BULLION VAULT DCA MODEL */}
      {activeTab === 'physicalDca' && (
        <div className="space-y-6">
          <div className="bg-slate-900 border border-slate-800 rounded-lg p-5">
            <div className="flex flex-wrap items-center justify-between gap-4 pb-4 border-b border-slate-800">
              <div>
                <span className="text-xs font-mono text-amber-400 uppercase tracking-wider block">
                  Physical Bullion Accumulation & Sovereign Wealth Preservation
                </span>
                <h3 className="text-base font-bold text-slate-100 mt-0.5">
                  Dollar-Cost-Averaging (DCA) Vault Model · Gold & Silver
                </h3>
              </div>
              <span className="text-xs font-mono text-emerald-400 bg-emerald-500/10 px-3 py-1 rounded border border-emerald-500/20">
                Anti-Fiat Inflation Hedge
              </span>
            </div>

            {/* Interactive DCA Inputs */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mt-4">
              <div>
                <label className="block text-[11px] font-mono text-slate-400 mb-1">
                  Monthly Fiat Allocation ($):
                </label>
                <input
                  type="number"
                  step="250"
                  value={dcaMonthlyBudget}
                  onChange={(e) => setDcaMonthlyBudget(Number(e.target.value) || 1000)}
                  className="w-full bg-slate-950 border border-slate-800 rounded px-3 py-2 text-xs font-mono text-slate-200"
                />
              </div>

              <div>
                <label className="block text-[11px] font-mono text-slate-400 mb-1">
                  Horizon (Months):
                </label>
                <select
                  value={dcaHorizonMonths}
                  onChange={(e) => setDcaHorizonMonths(Number(e.target.value))}
                  className="w-full bg-slate-950 border border-slate-800 rounded px-3 py-2 text-xs font-mono text-slate-200"
                >
                  <option value={12}>12 Months (1 Year)</option>
                  <option value={24}>24 Months (2 Years)</option>
                  <option value={36}>36 Months (3 Years)</option>
                  <option value={60}>60 Months (5 Years)</option>
                </select>
              </div>

              <div>
                <label className="block text-[11px] font-mono text-slate-400 mb-1">
                  Gold vs Silver Split (% Gold):
                </label>
                <input
                  type="range"
                  min="20"
                  max="90"
                  step="5"
                  value={dcaGoldSplit}
                  onChange={(e) => setDcaGoldSplit(Number(e.target.value))}
                  className="w-full accent-amber-500"
                />
                <span className="text-[11px] font-mono text-amber-400 block mt-0.5">
                  {dcaGoldSplit}% Gold / {100 - dcaGoldSplit}% Silver
                </span>
              </div>
            </div>

            {/* DCA Output Cards */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-5 text-xs font-mono">
              <div className="bg-slate-950/70 p-3 rounded border border-slate-800">
                <span className="text-slate-500 block text-[10px]">TOTAL CAPITAL INVESTED</span>
                <span className="text-base font-bold text-slate-200 tabular-nums">
                  ${dcaResult.totalFiatCapitalInvested.toLocaleString()}
                </span>
                <span className="text-[10px] text-slate-400 block mt-0.5">
                  Over {dcaHorizonMonths} monthly intervals
                </span>
              </div>

              <div className="bg-slate-950/70 p-3 rounded border border-slate-800">
                <span className="text-slate-500 block text-[10px]">PHYSICAL GOLD ACCUMULATED</span>
                <span className="text-base font-bold text-amber-400 tabular-nums">
                  {dcaResult.goldOuncesAccumulated} oz
                </span>
                <span className="text-[10px] text-slate-400 block mt-0.5">
                  {dcaResult.goldGramsAccumulated} grams equivalent
                </span>
              </div>

              <div className="bg-slate-950/70 p-3 rounded border border-slate-800">
                <span className="text-slate-500 block text-[10px]">PHYSICAL SILVER ACCUMULATED</span>
                <span className="text-base font-bold text-slate-200 tabular-nums">
                  {dcaResult.silverOuncesAccumulated} oz
                </span>
                <span className="text-[10px] text-slate-400 block mt-0.5">
                  {dcaResult.silverGramsAccumulated} grams equivalent
                </span>
              </div>

              <div className="bg-slate-950/70 p-3 rounded border border-slate-800">
                <span className="text-slate-500 block text-[10px]">PURCHASING POWER PRESERVED</span>
                <span className="text-base font-bold text-emerald-400 tabular-nums">
                  +${dcaResult.fiatDepreciationLossAvoidedUsd.toLocaleString()}
                </span>
                <span className="text-[10px] text-slate-400 block mt-0.5">
                  Vs 3.0% annual fiat decay
                </span>
              </div>
            </div>

            {/* Gold/Silver Ratio Note */}
            <div className="mt-4 p-3 bg-slate-950 rounded border border-amber-500/20 text-xs flex items-center gap-3">
              <Coins className="w-4 h-4 text-amber-400 shrink-0" />
              <p className="text-slate-300">{dcaResult.goldSilverRatioTiltNote}</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
