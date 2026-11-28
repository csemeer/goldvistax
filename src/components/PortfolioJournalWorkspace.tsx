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

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { PaperPosition, Quote, TradePlan } from '../domain/types';
import {
  AlertTriangle,
  BookOpen,
  Calendar,
  History,
  Plus,
  Radar,
  PieChart,
  Coins,
  ShieldCheck,
  RotateCcw,
  X,
} from 'lucide-react';
import { MaximumAdverseExcursionChart } from './MaximumAdverseExcursionChart';
import { TradeExpectancyDistributionChart } from './TradeExpectancyDistributionChart';
import { TradeSuccessRateGauge } from './TradeSuccessRateGauge';
import { HorizonPerformanceHeatmap } from './HorizonPerformanceHeatmap';
import { HorizonWinRateTrendChart } from './HorizonWinRateTrendChart';
import { DailyProfitLossChart } from './DailyProfitLossChart';
import { DailyPortfolioRoiChart } from './DailyPortfolioRoiChart';
import { TradeHistoryTimelineChart } from './TradeHistoryTimelineChart';
import { RiskMetricsDashboard } from './RiskMetricsDashboard';
import { TradeExpectancyProjectionWidget } from './TradeExpectancyProjectionWidget';
import { StopLossConcentrationHeatmap } from './StopLossConcentrationHeatmap';
import { AutoPaperPilotPanel } from './AutoPaperPilotPanel';
import { HistoricalTradePlanPerformancePanel } from './HistoricalTradePlanPerformancePanel';
import { AuditedForecastRecord, AUDITED_FORECAST_HISTORY } from '../services/crossCommoditySpreads';
import { buildHistoricalTradePlanPerformanceReport } from '../services/forecastScorecardEngine';
import {
  scanCommodityOpportunities,
  calculatePortfolioMarginHeatmap,
  calculatePhysicalBullionDCA,
  runPortfolioScenarioMatrix,
  filterPositionsByDateRange,
  getInstrumentMultiplierForMae,
  JournalRangeGranularity,
  DEFAULT_GHOST_DEVIATION_THRESHOLD_PCT,
  evaluateGhostTradeCleanup,
  applyGhostTradeCleanupToPositions,
  AutoPaperPilotConfig,
  DEFAULT_AUTO_PAPER_PILOT_CONFIG,
  normalizeAutoPaperPilotConfig,
  evaluateAutoPaperPilotCycle,
  evaluateOpenPositionsAdvisoryAlignment,
  isActionableDirectionalPlan,
  resolvePositionAdvisoryHorizon,
} from '../services/portfolioScannerEngine';
import {
  ensureSignedBearerToken,
  getCurrentSession,
} from '../services/authService';
import {
  dispatchTradeLifecycleAlert,
  TradeAlertTriggerSource,
  TradeLifecycleAlertEvent,
} from '../services/tradeAlertService';

interface PortfolioJournalWorkspaceProps {
  quote: Quote;
  quotes?: Record<string, Quote>;
  tradePlans: Record<string, TradePlan>;
  newPaperPlan?: TradePlan | null;
  newPaperPlanLots?: number | null;
  onConsumePaperPlan?: () => void;
  requestedTab?: 'journal' | 'historicalPlans' | 'scanner' | 'margin' | 'physicalDca' | null;
  onConsumeRequestedTab?: () => void;
  requestedPositionId?: string | null;
  onConsumeRequestedPositionId?: () => void;
  onPositionsChanged?: (positions: PaperPosition[]) => void;
  onTradeAlertDispatched?: (alert: TradeLifecycleAlertEvent, allAlerts: TradeLifecycleAlertEvent[]) => void;
}

function getPositionMarkPrice(
  pos: PaperPosition,
  defaultQuote: Quote,
  quotes?: Record<string, Quote>
): number {
  const mapped = quotes?.[pos.instrumentId]?.mid;
  if (typeof mapped === 'number' && Number.isFinite(mapped) && mapped > 0) {
    return mapped;
  }
  if (pos.instrumentId === defaultQuote.instrumentId && defaultQuote.mid > 0) {
    return defaultQuote.mid;
  }
  if (pos.instrumentId === 'XAUUSD' && defaultQuote.mid > 0) {
    return defaultQuote.mid;
  }
  return pos.currentPrice;
}

function calcDirectionalPnl(pos: PaperPosition, markPrice: number): number {
  const delta = pos.direction === 'SELL' ? pos.entryPrice - markPrice : markPrice - pos.entryPrice;
  const multiplier = getInstrumentMultiplierForMae(pos.instrumentId);
  return delta * pos.lots * multiplier;
}

function isStopLossBreached(pos: PaperPosition, markPrice: number): boolean {
  if (pos.status !== 'OPEN' || !Number.isFinite(pos.stopLoss) || pos.stopLoss <= 0) {
    return false;
  }
  return pos.direction === 'SELL' ? markPrice >= pos.stopLoss : markPrice <= pos.stopLoss;
}

const LOCAL_JOURNAL_STORAGE_PREFIX = 'goldvista_paper_journal_backup_v1:';
const AUTO_PILOT_STORAGE_PREFIX = 'goldvista_auto_paper_pilot_v1:';

function loadAutoPilotConfig(userId: string): AutoPaperPilotConfig {
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      const raw = window.localStorage.getItem(`${AUTO_PILOT_STORAGE_PREFIX}${userId}`);
      if (raw) {
        return normalizeAutoPaperPilotConfig(JSON.parse(raw));
      }
    }
  } catch {
    // ignore storage read error
  }
  return { ...DEFAULT_AUTO_PAPER_PILOT_CONFIG };
}

function saveAutoPilotConfig(userId: string, config: AutoPaperPilotConfig): void {
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      window.localStorage.setItem(
        `${AUTO_PILOT_STORAGE_PREFIX}${userId}`,
        JSON.stringify(normalizeAutoPaperPilotConfig(config))
      );
    }
  } catch {
    // ignore storage write error
  }
}

function loadLocalJournalBackup(userId: string): PaperPosition[] | null {
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      const raw = window.localStorage.getItem(`${LOCAL_JOURNAL_STORAGE_PREFIX}${userId}`);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) {
          return parsed;
        }
      }
    }
  } catch {
    // ignore storage read error
  }
  return null;
}

function saveLocalJournalBackup(userId: string, nextPositions: PaperPosition[]): void {
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      window.localStorage.setItem(
        `${LOCAL_JOURNAL_STORAGE_PREFIX}${userId}`,
        JSON.stringify(nextPositions)
      );
    }
  } catch {
    // ignore storage write error
  }
}

type CloseConfirmationTarget =
  | { mode: 'SINGLE'; position: PaperPosition }
  | { mode: 'CONTRA'; positions: PaperPosition[] }
  | { mode: 'ALL'; positions: PaperPosition[] };

type JournalSectionFocus = 'ALL' | 'EXECUTION' | 'PERFORMANCE' | 'RISK';

export const PortfolioJournalWorkspace: React.FC<PortfolioJournalWorkspaceProps> = ({
  quote,
  quotes = {},
  tradePlans,
  newPaperPlan,
  newPaperPlanLots,
  onConsumePaperPlan,
  requestedTab,
  onConsumeRequestedTab,
  requestedPositionId,
  onConsumeRequestedPositionId,
  onPositionsChanged,
  onTradeAlertDispatched,
}) => {
  const [activeTab, setActiveTab] = useState<'journal' | 'historicalPlans' | 'scanner' | 'margin' | 'physicalDca'>('journal');
  const [journalSectionFocus, setJournalSectionFocus] = useState<JournalSectionFocus>('EXECUTION');
  const [highlightedPositionId, setHighlightedPositionId] = useState<string | null>(null);
  const [pendingFocusPositionId, setPendingFocusPositionId] = useState<string | null>(null);

  useEffect(() => {
    if (requestedTab) {
      setActiveTab(requestedTab);
      if (onConsumeRequestedTab) {
        onConsumeRequestedTab();
      }
    }
  }, [requestedTab, onConsumeRequestedTab]);

  const [balance, setBalance] = useState<number>(100000);
  const [positions, setPositions] = useState<PaperPosition[]>([]);

  const [journalNote, setJournalNote] = useState('');
  const [lotSizeInput, setLotSizeInput] = useState<string>('1.00');
  const [selectedPlanKey, setSelectedPlanKey] = useState<string>('INTRADAY');
  const [journalError, setJournalError] = useState<string | null>(null);
  const [journalActionNotice, setJournalActionNotice] = useState<string | null>(null);
  const [journalPersistenceLabel, setJournalPersistenceLabel] = useState<string>('LOCAL_SESSION');
  const [journalBusy, setJournalBusy] = useState<boolean>(false);
  const [closingPositionIds, setClosingPositionIds] = useState<Set<string>>(() => new Set());
  const [pendingCloseTarget, setPendingCloseTarget] = useState<CloseConfirmationTarget | null>(null);
  const [hydratedUserId, setHydratedUserId] = useState<string | null>(null);
  const lastHandledPlanRef = useRef<string | null>(null);
  const mutationSeqRef = useRef<number>(0);
  const cleanupInFlightRef = useRef<boolean>(false);
  const cleanupCooldownRef = useRef<Map<string, number>>(new Map());
  const positionsRef = useRef<PaperPosition[]>(positions);
  positionsRef.current = positions;
  const quoteRef = useRef<Quote>(quote);
  quoteRef.current = quote;
  const quotesRef = useRef<Record<string, Quote>>(quotes);
  quotesRef.current = quotes;

  // Historical Triggered Trade Plan Forecast Scorecard State
  const [forecastLedger, setForecastLedger] = useState<AuditedForecastRecord[]>(AUDITED_FORECAST_HISTORY);
  const [forecastLedgerLoading, setForecastLedgerLoading] = useState<boolean>(false);
  const [forecastLedgerError, setForecastLedgerError] = useState<string | null>(null);

  const fetchForecastLedger = useCallback(async () => {
    setForecastLedgerLoading(true);
    setForecastLedgerError(null);
    try {
      const res = await fetch('/api/forecast/scorecard');
      const data = await res.json();
      if (!res.ok || !Array.isArray(data?.scorecard?.forecastLedger)) {
        throw new Error(data?.error || `HTTP ${res.status} fetching historical trade plan ledger.`);
      }
      setForecastLedger(data.scorecard.forecastLedger);
    } catch (err: any) {
      setForecastLedgerError(
        err?.message || 'Unable to reach live forecast ledger; displaying audited baseline records.'
      );
    } finally {
      setForecastLedgerLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchForecastLedger();
  }, [fetchForecastLedger]);

  // Economic Cycle Date-Range Picker State (Month / Quarter / Custom Range)
  const [rangeGranularity, setRangeGranularity] = useState<JournalRangeGranularity>('ALL');
  const [selectedMonthKey, setSelectedMonthKey] = useState<string>('2026-10');
  const [selectedQuarterKey, setSelectedQuarterKey] = useState<string>('2026-Q4');
  const [customStartDate, setCustomStartDate] = useState<string>('2026-07-01');
  const [customEndDate, setCustomEndDate] = useState<string>('2026-11-30');
  const [timelineFocusPositionId, setTimelineFocusPositionId] = useState<string | null>(null);
  const timelineContainerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    onPositionsChanged?.(positions);
  }, [positions, onPositionsChanged]);

  const activeSession = getCurrentSession();
  const activeUserId = activeSession?.uid || 'usr_guest_0000';

  const emitTradeAlert = useCallback(
    async (
      eventType: 'TRADE_OPENED' | 'TRADE_CLOSED',
      pos: PaperPosition,
      triggerSource: TradeAlertTriggerSource,
      options?: { exitPrice?: number; realizedPnl?: number; status?: PaperPosition['status']; reason?: string }
    ) => {
      try {
        const rawStatus = options?.status ?? pos.status;
        const normalizedStatus: 'OPEN' | 'CLOSED_PROFIT' | 'CLOSED_LOSS' =
          rawStatus === 'OPEN'
            ? 'OPEN'
            : rawStatus === 'CLOSED_PROFIT'
            ? 'CLOSED_PROFIT'
            : (options?.realizedPnl ?? pos.realizedPnl ?? 0) > 0
            ? 'CLOSED_PROFIT'
            : 'CLOSED_LOSS';
        const res = await dispatchTradeLifecycleAlert({
          userId: activeUserId,
          eventType,
          positionId: pos.id,
          instrumentId: pos.instrumentId,
          direction: pos.direction,
          lots: pos.lots,
          entryPrice: pos.entryPrice,
          exitPrice: options?.exitPrice,
          stopLoss: pos.stopLoss,
          takeProfit: pos.takeProfit,
          realizedPnl: options?.realizedPnl,
          status: normalizedStatus,
          triggerSource,
          reason: options?.reason,
        });
        onTradeAlertDispatched?.(res.alert, res.allAlerts);
      } catch {
        // non-blocking alert dispatch
      }
    },
    [activeUserId, onTradeAlertDispatched]
  );

  useEffect(() => {
    if (!requestedPositionId) return;
    setActiveTab('journal');
    setJournalSectionFocus('EXECUTION');
    setRangeGranularity('ALL');
    setTimelineFocusPositionId(requestedPositionId);
    setHighlightedPositionId(requestedPositionId);
    setPendingFocusPositionId(requestedPositionId);
    setJournalActionNotice(`Focused position ${requestedPositionId}.`);
    onConsumeRequestedPositionId?.();
  }, [requestedPositionId, onConsumeRequestedPositionId]);

  useEffect(() => {
    if (!pendingFocusPositionId || hydratedUserId !== activeUserId) return;
    const targetId = pendingFocusPositionId;
    const timer = window.setTimeout(() => {
      const el =
        document.getElementById(`journal-pos-${targetId}`) ||
        document.getElementById('focused-position-inspector');
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
      setPendingFocusPositionId(null);
    }, 100);
    return () => window.clearTimeout(timer);
  }, [pendingFocusPositionId, hydratedUserId, activeUserId, positions]);

  // DCA Model Interactive Parameters
  const [dcaMonthlyBudget, setDcaMonthlyBudget] = useState<number>(2500);
  const [dcaHorizonMonths, setDcaHorizonMonths] = useState<number>(24);
  const [dcaGoldSplit, setDcaGoldSplit] = useState<number>(75);

  const [autoPilotConfig, setAutoPilotConfig] = useState<AutoPaperPilotConfig>(() =>
    loadAutoPilotConfig(activeUserId)
  );
  const [lastAutoPilotCycleSummary, setLastAutoPilotCycleSummary] = useState<string | null>(null);
  const autoPilotInFlightRef = useRef<boolean>(false);
  const recentAutoEntryRef = useRef<Record<string, number>>({});
  const tradePlansRef = useRef<Record<string, TradePlan>>(tradePlans);
  tradePlansRef.current = tradePlans;
  const autoPilotConfigRef = useRef<AutoPaperPilotConfig>(autoPilotConfig);
  autoPilotConfigRef.current = autoPilotConfig;
  const balanceRef = useRef<number>(balance);
  balanceRef.current = balance;

  useEffect(() => {
    setAutoPilotConfig(loadAutoPilotConfig(activeUserId));
    setLastAutoPilotCycleSummary(null);
  }, [activeUserId]);

  const handleUpdateAutoPilotConfig = (nextConfig: AutoPaperPilotConfig) => {
    const normalized = normalizeAutoPaperPilotConfig(nextConfig);
    setAutoPilotConfig(normalized);
    saveAutoPilotConfig(activeUserId, normalized);
  };

  const persistJournalAction = async (body: Record<string, unknown>) => {
    const token = await ensureSignedBearerToken();
    if (!token) return null;

    const sendWithToken = async (bearer: string) =>
      fetch('/api/portfolio/journal', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${bearer}`,
        },
        body: JSON.stringify(body),
      });

    try {
      setJournalBusy(true);
      setJournalError(null);
      let res = await sendWithToken(token);

      // Recover transparently if server rotated signing secret or cached token expired
      if (res.status === 401) {
        const refreshedToken = await ensureSignedBearerToken(undefined, true);
        if (refreshedToken) {
          res = await sendWithToken(refreshedToken);
        }
      }

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
        saveLocalJournalBackup(activeUserId, json.positions);
      }
      return json;
    } catch (err: any) {
      setJournalError(String(err?.message || 'Unable to sync paper journal to server.'));
      return null;
    } finally {
      setJournalBusy(false);
    }
  };

  // Hydrate tenant-scoped paper journal from server (or local backup for guest/offline)
  useEffect(() => {
    let cancelled = false;
    const seqAtStart = mutationSeqRef.current;
    setHydratedUserId(null);
    // Reset in-memory ledger immediately on user switch so prior user trades never leak or flash
    setPositions([]);
    setJournalError(null);
    setJournalActionNotice(null);
    setPendingCloseTarget(null);

    (async () => {
      const session = getCurrentSession();
      if (!session || session.role === 'GUEST') {
        const guestBackup = loadLocalJournalBackup(session?.uid || 'usr_guest_0000');
        if (guestBackup !== null && !cancelled && mutationSeqRef.current === seqAtStart) {
          setPositions(guestBackup);
        }
        if (!cancelled) {
          setHydratedUserId(activeUserId);
        }
        return;
      }

      try {
        let token = await ensureSignedBearerToken(session);
        if (!token || cancelled) return;

        let res = await fetch('/api/portfolio/journal', {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (res.status === 401) {
          token = await ensureSignedBearerToken(session, true);
          if (token && !cancelled) {
            res = await fetch('/api/portfolio/journal', {
              headers: { Authorization: `Bearer ${token}` },
            });
          }
        }
        const json = (await res.json()) as {
          success?: boolean;
          persistenceMode?: string;
          positions?: PaperPosition[];
          error?: string;
        };
        if (cancelled) return;
        if (!res.ok) {
          setJournalError(json.error || `Unable to load paper journal (HTTP ${res.status}).`);
          const backup = loadLocalJournalBackup(session.uid);
          if (backup !== null && mutationSeqRef.current === seqAtStart) {
            setPositions(backup);
          }
          return;
        }
        if (json.persistenceMode) {
          setJournalPersistenceLabel(json.persistenceMode);
        }
        if (Array.isArray(json.positions) && mutationSeqRef.current === seqAtStart) {
          setPositions(json.positions);
          saveLocalJournalBackup(session.uid, json.positions);
        }
      } catch {
        const backup = loadLocalJournalBackup(session.uid);
        if (backup !== null && !cancelled && mutationSeqRef.current === seqAtStart) {
          setPositions(backup);
        }
      } finally {
        if (!cancelled) {
          setHydratedUserId(activeUserId);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [activeUserId]);

  const runGhostTradeSyncCleanup = async (manualTrigger = false) => {
    if (cleanupInFlightRef.current) return;

    const currentList = positionsRef.current;
    const plan = evaluateGhostTradeCleanup(currentList, {
      defaultQuote: quoteRef.current,
      quotes: quotesRef.current,
      thresholdPct: DEFAULT_GHOST_DEVIATION_THRESHOLD_PCT,
    });

    const nowMs = Date.now();
    const eligibleCandidates = plan.candidates.filter((c) => {
      if (closingPositionIds.has(c.positionId)) return false;
      if (!manualTrigger) {
        const blockedUntil = cleanupCooldownRef.current.get(c.positionId) || 0;
        if (nowMs < blockedUntil) return false;
      }
      return true;
    });

    if (eligibleCandidates.length === 0) {
      if (manualTrigger) {
        setJournalActionNotice(
          `Sync check complete: all active positions are within the ${DEFAULT_GHOST_DEVIATION_THRESHOLD_PCT.toFixed(
            2
          )}% entry-price deviation threshold.`
        );
      }
      return;
    }

    const scopedPlan = {
      ...plan,
      candidates: eligibleCandidates,
      closePricesByInstrument: eligibleCandidates.reduce<Record<string, number>>((acc, c) => {
        acc[c.instrumentId] = c.currentMarketPrice;
        return acc;
      }, {}),
    };
    const eligibleIds = eligibleCandidates.map((c) => c.positionId);
    const eligibleSnapshots = currentList.filter((p) => eligibleIds.includes(p.id));

    cleanupInFlightRef.current = true;
    mutationSeqRef.current += 1;
    setClosingPositionIds((prev) => {
      const next = new Set(prev);
      eligibleIds.forEach((id) => next.add(id));
      return next;
    });

    try {
      const session = getCurrentSession();
      let closedCount = 0;

      if (session && session.role !== 'GUEST') {
        const synced = (await persistJournalAction({
          action: 'SYNC_CLEANUP',
          thresholdPct: DEFAULT_GHOST_DEVIATION_THRESHOLD_PCT,
          positionIds: eligibleIds,
          closePrices: scopedPlan.closePricesByInstrument,
          positionSnapshots: eligibleSnapshots,
        })) as { cleanedCount?: number } | null;

        if (!synced) {
          eligibleIds.forEach((id) => cleanupCooldownRef.current.set(id, Date.now() + 30_000));
          return;
        }
        closedCount = typeof synced.cleanedCount === 'number' ? synced.cleanedCount : eligibleIds.length;
      } else {
        setPositions((prev) => {
          const { updatedPositions } = applyGhostTradeCleanupToPositions(prev, scopedPlan);
          saveLocalJournalBackup(activeUserId, updatedPositions);
          return updatedPositions;
        });
        closedCount = eligibleIds.length;
      }

      if (closedCount > 0) {
        const closedSet = new Set(eligibleIds);
        for (const candidate of eligibleCandidates) {
          const snap = eligibleSnapshots.find((p) => p.id === candidate.positionId);
          if (snap) {
            const pnl = Number(calcDirectionalPnl(snap, candidate.currentMarketPrice).toFixed(2));
            void emitTradeAlert('TRADE_CLOSED', snap, 'SYNC_CLEANUP', {
              exitPrice: candidate.currentMarketPrice,
              realizedPnl: pnl,
              status: pnl >= 0 ? 'CLOSED_PROFIT' : 'CLOSED_LOSS',
              reason: `Auto-sync cleanup (${candidate.deviationPct.toFixed(2)}% deviation)`,
            });
          }
        }
        setPendingCloseTarget((current) => {
          if (!current) return null;
          if (current.mode === 'SINGLE') {
            return closedSet.has(current.position.id) ? null : current;
          }
          const remaining = current.positions.filter((p) => !closedSet.has(p.id));
          return remaining.length > 0 ? { mode: 'ALL', positions: remaining } : null;
        });

        if (eligibleCandidates.length === 1) {
          const c = eligibleCandidates[0];
          setJournalActionNotice(
            `Auto-sync cleanup force-closed ${c.positionId} (${c.instrumentId} ${c.direction} @ $${c.currentMarketPrice.toFixed(
              2
            )}, ${c.deviationPct.toFixed(2)}% deviation from $${c.entryPrice.toFixed(2)} entry).`
          );
        } else {
          setJournalActionNotice(
            `Auto-sync cleanup force-closed ${eligibleCandidates.length} stale active trade(s) crossing the ${DEFAULT_GHOST_DEVIATION_THRESHOLD_PCT.toFixed(
              2
            )}% deviation threshold (${eligibleCandidates
              .map((c) => `${c.positionId} ${c.deviationPct.toFixed(2)}%`)
              .join(', ')}).`
          );
        }
      }
    } finally {
      setClosingPositionIds((prev) => {
        const next = new Set(prev);
        eligibleIds.forEach((id) => next.delete(id));
        return next;
      });
      cleanupInFlightRef.current = false;
    }
  };

  // Automated reactive synchronization sweep on hydration, live price ticks & position changes
  useEffect(() => {
    if (hydratedUserId !== activeUserId) return;
    void runGhostTradeSyncCleanup(false);
  }, [hydratedUserId, activeUserId, quote, quotes, positions]);

  // Periodic background synchronization interval (every 15s) to prevent lingering ghost trades
  useEffect(() => {
    if (hydratedUserId !== activeUserId) return;
    const intervalId = window.setInterval(() => {
      void runGhostTradeSyncCleanup(false);
    }, 15000);
    return () => window.clearInterval(intervalId);
  }, [hydratedUserId, activeUserId]);

  const runAutoPaperPilotCycle = async (manualTrigger = false) => {
    if (autoPilotInFlightRef.current || cleanupInFlightRef.current) return;
    const currentCfg = autoPilotConfigRef.current;
    if (!manualTrigger && (!currentCfg.enabled || hydratedUserId !== activeUserId)) {
      return;
    }

    const evaluation = evaluateAutoPaperPilotCycle({
      config: manualTrigger ? { ...currentCfg, enabled: true } : currentCfg,
      positions: positionsRef.current,
      tradePlans: tradePlansRef.current,
      accountBalanceUsd: balanceRef.current,
      defaultQuote: quoteRef.current,
      quotes: quotesRef.current,
      recentAutoEntryTimestamps: recentAutoEntryRef.current,
    });

    if (evaluation.exitsToClose.length === 0 && evaluation.entriesToOpen.length === 0) {
      if (manualTrigger) {
        setLastAutoPilotCycleSummary(
          `Checked at ${new Date().toLocaleTimeString()}: no INTRADAY/SWING entries or exits triggered.`
        );
      }
      return;
    }

    autoPilotInFlightRef.current = true;
    mutationSeqRef.current += 1;

    try {
      const session = getCurrentSession();
      const isAuthenticated = Boolean(session && session.role !== 'GUEST');
      const closedExitIds: string[] = [];
      const openedEntryLabels: string[] = [];

      for (const exitItem of evaluation.exitsToClose) {
        if (closingPositionIds.has(exitItem.positionId)) continue;
        const targetSnap = positionsRef.current.find((p) => p.id === exitItem.positionId);
        if (!targetSnap || targetSnap.status !== 'OPEN') continue;

        let persisted = false;
        if (isAuthenticated) {
          const synced = await persistJournalAction({
            action: 'CLOSE',
            positionId: exitItem.positionId,
            closePrice: exitItem.exitPrice,
            closeNote: exitItem.closeNote,
            positionSnapshot: targetSnap,
          });
          persisted = Boolean(synced);
        }

        if (!persisted) {
          setPositions((prev) => {
            const next = prev.map((p) => {
              if (p.id !== exitItem.positionId || p.status !== 'OPEN') return p;
              const prevExtreme = p.adverseExtremePrice ?? p.entryPrice;
              const updatedExtreme =
                p.direction === 'SELL'
                  ? Math.max(prevExtreme, exitItem.exitPrice)
                  : Math.min(prevExtreme, exitItem.exitPrice);
              const nextNotes = p.notes?.includes(exitItem.closeNote)
                ? p.notes
                : `${p.notes ? `${p.notes} ` : ''}${exitItem.closeNote}`;
              return {
                ...p,
                currentPrice: exitItem.exitPrice,
                adverseExtremePrice: Number(updatedExtreme.toFixed(4)),
                unrealizedPnl: 0,
                realizedPnl: exitItem.projectedPnlUsd,
                closeTime: new Date().toISOString(),
                status:
                  exitItem.projectedPnlUsd >= 0
                    ? ('CLOSED_PROFIT' as const)
                    : ('CLOSED_LOSS' as const),
                notes: nextNotes,
              };
            });
            saveLocalJournalBackup(activeUserId, next);
            return next;
          });
        }
        closedExitIds.push(exitItem.positionId);
        void emitTradeAlert(
          'TRADE_CLOSED',
          targetSnap,
          exitItem.triggerReason === 'ADVISORY_FLIP' ? 'CONTRA_RECONCILE' : 'SL_TP_TRIGGER',
          {
            exitPrice: exitItem.exitPrice,
            realizedPnl: exitItem.projectedPnlUsd,
            status: exitItem.projectedPnlUsd >= 0 ? 'CLOSED_PROFIT' : 'CLOSED_LOSS',
            reason:
              exitItem.triggerReason === 'ADVISORY_FLIP'
                ? 'Closed on live advisory flip'
                : 'Auto-Pilot SL / Target 1 trigger',
          }
        );
      }

      if (closedExitIds.length > 0) {
        const closedSet = new Set(closedExitIds);
        setPendingCloseTarget((current) => {
          if (!current) return null;
          if (current.mode === 'SINGLE') {
            return closedSet.has(current.position.id) ? null : current;
          }
          const remaining = current.positions.filter((p) => !closedSet.has(p.id));
          return remaining.length > 0 ? { mode: 'ALL', positions: remaining } : null;
        });
      }

      for (const entryItem of evaluation.entriesToOpen) {
        recentAutoEntryRef.current[entryItem.horizon] = Date.now();
        let persisted = false;
        if (isAuthenticated) {
          const synced = await persistJournalAction({
            action: 'OPEN',
            position: entryItem.position,
          });
          persisted = Boolean(synced);
        }

        if (!persisted) {
          setPositions((prev) => {
            const next = [entryItem.position, ...prev];
            saveLocalJournalBackup(activeUserId, next);
            return next;
          });
        }
        void emitTradeAlert('TRADE_OPENED', entryItem.position, 'AUTO_PILOT', {
          reason: `Auto-Paper Pilot (${entryItem.horizon})`,
        });
        openedEntryLabels.push(
          `${entryItem.horizon} ${entryItem.direction} ${entryItem.lots.toFixed(2)} ${
            entryItem.instrumentId
          } @ $${entryItem.entryPrice.toFixed(2)}`
        );
      }

      const summaryParts: string[] = [];
      if (openedEntryLabels.length > 0) {
        summaryParts.push(`Opened ${openedEntryLabels.join('; ')}`);
      }
      if (closedExitIds.length > 0) {
        const flipCount = evaluation.exitsToClose.filter(
          (e) => e.triggerReason === 'ADVISORY_FLIP' && closedExitIds.includes(e.positionId)
        ).length;
        const slTpCount = closedExitIds.length - flipCount;
        if (slTpCount > 0) {
          summaryParts.push(`Closed ${slTpCount} SL/TP position(s)`);
        }
        if (flipCount > 0) {
          summaryParts.push(`Closed ${flipCount} contra-advisory flip position(s)`);
        }
      }
      if (summaryParts.length > 0) {
        const summaryMsg = `Auto-Paper Pilot: ${summaryParts.join(' · ')}.`;
        setLastAutoPilotCycleSummary(summaryMsg);
        setJournalActionNotice(summaryMsg);
      }
    } finally {
      autoPilotInFlightRef.current = false;
    }
  };

  // Autonomous Simulated Paper Trading reactive cycle (only when opt-in switch is enabled)
  useEffect(() => {
    if (!autoPilotConfig.enabled || hydratedUserId !== activeUserId) return;
    void runAutoPaperPilotCycle(false);
  }, [autoPilotConfig, hydratedUserId, activeUserId, quote, quotes, tradePlans]);

  // Autonomous Simulated Paper Trading background interval (10s) when enabled
  useEffect(() => {
    if (!autoPilotConfig.enabled || hydratedUserId !== activeUserId) return;
    const intervalId = window.setInterval(() => {
      void runAutoPaperPilotCycle(false);
    }, 10000);
    return () => window.clearInterval(intervalId);
  }, [autoPilotConfig.enabled, hydratedUserId, activeUserId]);

  // Real-time adverse extreme price tracker for OPEN positions as market ticks update
  useEffect(() => {
    setPositions((prev) => {
      let changed = false;
      const next = prev.map((pos) => {
        if (pos.status !== 'OPEN') return pos;
        const mark = getPositionMarkPrice(pos, quote, quotes);
        const currentExtreme = pos.adverseExtremePrice ?? pos.entryPrice;
        const updatedExtreme =
          pos.direction === 'SELL'
            ? Math.max(currentExtreme, mark)
            : Math.min(currentExtreme, mark);
        if (updatedExtreme !== pos.adverseExtremePrice || mark !== pos.currentPrice) {
          changed = true;
          return {
            ...pos,
            currentPrice: mark,
            adverseExtremePrice: Number(updatedExtreme.toFixed(2)),
          };
        }
        return pos;
      });
      return changed ? next : prev;
    });
  }, [quote, quotes]);

  // Handle incoming execution trigger from trade plan cards
  useEffect(() => {
    if (newPaperPlan && lastHandledPlanRef.current !== newPaperPlan.id) {
      lastHandledPlanRef.current = newPaperPlan.id;
      setActiveTab('journal');
      setJournalSectionFocus('EXECUTION');
      setSelectedPlanKey(newPaperPlan.horizon);
      if (!isActionableDirectionalPlan(newPaperPlan)) {
        setJournalError(
          `Blocked simulated open: ${newPaperPlan.horizon} advisory is currently ${newPaperPlan.direction} (${newPaperPlan.state}), not an active BUY or SELL signal.`
        );
        onConsumePaperPlan?.();
        return;
      }
      setJournalError(null);
      const entryMark = quotes?.[newPaperPlan.instrumentId]?.mid ?? quote.mid;
      const resolvedLots =
        typeof newPaperPlanLots === 'number' && Number.isFinite(newPaperPlanLots) && newPaperPlanLots > 0
          ? Number(newPaperPlanLots.toFixed(2))
          : 1.0;
      const newPos: PaperPosition = {
        id: `POS-${Date.now().toString().slice(-6)}`,
        tradePlanId: newPaperPlan.id,
        advisoryHorizon: newPaperPlan.horizon,
        instrumentId: newPaperPlan.instrumentId,
        direction: newPaperPlan.direction === 'SELL' ? 'SELL' : 'BUY',
        lots: resolvedLots,
        entryPrice: entryMark,
        currentPrice: entryMark,
        stopLoss: newPaperPlan.stopLossPrice,
        takeProfit: newPaperPlan.target1Price,
        adverseExtremePrice: entryMark,
        unrealizedPnl: 0,
        realizedPnl: 0,
        openTime: new Date().toISOString(),
        status: 'OPEN',
        notes: `Simulated paper execution from ${newPaperPlan.horizon} advisory plan (${resolvedLots.toFixed(2)} lots) at $${entryMark.toFixed(2)}.`,
      };
      mutationSeqRef.current += 1;
      setHighlightedPositionId(newPos.id);
      setPositions((prev) => {
        const next = [newPos, ...prev];
        saveLocalJournalBackup(activeUserId, next);
        return next;
      });
      setJournalActionNotice(
        `Opened ${newPos.id} (${newPos.direction} ${newPos.lots.toFixed(2)} ${newPos.instrumentId} @ $${entryMark.toFixed(2)}).`
      );
      void emitTradeAlert('TRADE_OPENED', newPos, 'PLAN_CARD', {
        reason: `${newPaperPlan.horizon} Trade Plan`,
      });
      onConsumePaperPlan?.();
      void persistJournalAction({ action: 'OPEN', position: newPos });
    }
  }, [newPaperPlan, newPaperPlanLots]);

  // Calculations for sub-features
  const effectiveQuotes = useMemo(() => ({ ...quotes, XAUUSD: quote }), [quotes, quote]);
  const historicalPlanPerfReport = useMemo(
    () =>
      buildHistoricalTradePlanPerformanceReport({
        forecastLedger,
        positions,
        defaultQuote: quote,
        quotes: effectiveQuotes,
      }),
    [forecastLedger, positions, quote, effectiveQuotes]
  );
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

  // Date-range filtering across month, quarter, or custom economic cycles
  const dateFilterSummary = useMemo(
    () =>
      filterPositionsByDateRange(positions, {
        granularity: rangeGranularity,
        periodKey:
          rangeGranularity === 'MONTH'
            ? selectedMonthKey
            : rangeGranularity === 'QUARTER'
            ? selectedQuarterKey
            : undefined,
        startDate: rangeGranularity === 'CUSTOM' ? customStartDate : undefined,
        endDate: rangeGranularity === 'CUSTOM' ? customEndDate : undefined,
      }),
    [positions, rangeGranularity, selectedMonthKey, selectedQuarterKey, customStartDate, customEndDate]
  );

  const filteredPositions = dateFilterSummary.positions;

  const autoPilotEvaluation = useMemo(
    () =>
      evaluateAutoPaperPilotCycle({
        config: autoPilotConfig,
        positions,
        tradePlans,
        accountBalanceUsd: balance,
        defaultQuote: quote,
        quotes,
        recentAutoEntryTimestamps: recentAutoEntryRef.current,
      }),
    [autoPilotConfig, positions, tradePlans, balance, quote, quotes]
  );

  // Summary statistics (reactive to active date-range filter)
  const openPositions = filteredPositions.filter((p) => p.status === 'OPEN');
  const closedPositions = filteredPositions.filter((p) => p.status !== 'OPEN');

  const advisoryAlignmentReport = useMemo(
    () => evaluateOpenPositionsAdvisoryAlignment(openPositions, tradePlans),
    [openPositions, tradePlans]
  );

  const contraAdvisoryPositions = useMemo(() => {
    const contraSet = new Set(advisoryAlignmentReport.contraPositionIds);
    return openPositions.filter((p) => contraSet.has(p.id));
  }, [openPositions, advisoryAlignmentReport]);

  const selectedPlan = tradePlans[selectedPlanKey];
  const selectedPlanActionable = isActionableDirectionalPlan(selectedPlan);
  const selectedPlanContraPeer = useMemo(() => {
    if (!selectedPlan || !selectedPlanActionable) return null;
    return (
      openPositions.find(
        (p) => p.instrumentId === selectedPlan.instrumentId && p.direction !== selectedPlan.direction
      ) || null
    );
  }, [openPositions, selectedPlan, selectedPlanActionable]);

  const totalUnrealized = openPositions.reduce(
    (acc, p) => acc + calcDirectionalPnl(p, getPositionMarkPrice(p, quote, quotes)),
    0
  );
  const totalRealized = closedPositions.reduce((acc, p) => acc + p.realizedPnl, 0);

  const handleOpenFromPlan = async () => {
    const plan = tradePlans[selectedPlanKey];
    if (!plan) return;
    if (!isActionableDirectionalPlan(plan)) {
      setJournalError(
        `Cannot open paper trade: ${plan.horizon} advisory is currently ${plan.direction} (${plan.state}). Wait for an active BUY or SELL trigger.`
      );
      return;
    }
    const parsedLots = Number.parseFloat(lotSizeInput);
    const lots =
      Number.isFinite(parsedLots) && parsedLots > 0
        ? Math.min(50, Math.max(0.01, Number(parsedLots.toFixed(2))))
        : 1.0;
    setJournalError(null);

    const entryMark = quotes?.[plan.instrumentId]?.mid ?? quote.mid;
    const newPos: PaperPosition = {
      id: `POS-${Date.now().toString().slice(-6)}`,
      tradePlanId: plan.id,
      advisoryHorizon: plan.horizon,
      instrumentId: plan.instrumentId,
      direction: plan.direction === 'SELL' ? 'SELL' : 'BUY',
      lots,
      entryPrice: entryMark,
      currentPrice: entryMark,
      stopLoss: plan.stopLossPrice,
      takeProfit: plan.target1Price,
      adverseExtremePrice: entryMark,
      unrealizedPnl: 0,
      realizedPnl: 0,
      openTime: new Date().toISOString(),
      status: 'OPEN',
      notes: journalNote || `Manual paper execution based on ${plan.horizon} trade setup.`,
    };

    mutationSeqRef.current += 1;
    setHighlightedPositionId(newPos.id);
    const synced = await persistJournalAction({ action: 'OPEN', position: newPos });
    if (!synced) {
      setPositions((prev) => {
        const next = [newPos, ...prev];
        saveLocalJournalBackup(activeUserId, next);
        return next;
      });
    }
    setJournalActionNotice(
      `Opened ${newPos.id} (${newPos.direction} ${newPos.lots.toFixed(2)} ${newPos.instrumentId} @ $${entryMark.toFixed(2)}).`
    );
    void emitTradeAlert('TRADE_OPENED', newPos, 'MANUAL', {
      reason: `${plan.horizon} Manual Order`,
    });
    setJournalNote('');
  };

  const handleClosePosition = async (posId: string, customCloseNote?: string) => {
    if (closingPositionIds.has(posId)) return;

    const targetPos = positionsRef.current.find((p) => p.id === posId);
    if (!targetPos || targetPos.status !== 'OPEN') return;

    const markPrice = getPositionMarkPrice(targetPos, quote, quotes);
    const projectedPnl = Number(calcDirectionalPnl(targetPos, markPrice).toFixed(2));

    setClosingPositionIds((prev) => {
      const next = new Set(prev);
      next.add(posId);
      return next;
    });
    mutationSeqRef.current += 1;

    try {
      const synced = await persistJournalAction({
        action: 'CLOSE',
        positionId: posId,
        closePrice: markPrice,
        closeNote: customCloseNote,
        positionSnapshot: targetPos,
      });

      if (!synced) {
        setPositions((prev) => {
          const next = prev.map((p) => {
            if (p.id === posId && p.status === 'OPEN') {
              const prevExtreme = p.adverseExtremePrice ?? p.entryPrice;
              const updatedExtreme =
                p.direction === 'SELL'
                  ? Math.max(prevExtreme, markPrice)
                  : Math.min(prevExtreme, markPrice);
              const nextNotes =
                customCloseNote && !String(p.notes || '').includes(customCloseNote)
                  ? `${p.notes ? `${p.notes} ` : ''}${customCloseNote}`
                  : p.notes;
              return {
                ...p,
                currentPrice: markPrice,
                adverseExtremePrice: Number(updatedExtreme.toFixed(2)),
                closeTime: new Date().toISOString(),
                status: projectedPnl >= 0 ? ('CLOSED_PROFIT' as const) : ('CLOSED_LOSS' as const),
                realizedPnl: projectedPnl,
                unrealizedPnl: 0,
                notes: nextNotes,
              };
            }
            return p;
          });
          saveLocalJournalBackup(activeUserId, next);
          return next;
        });
      }

      const sign = projectedPnl >= 0 ? '+' : '-';
      setJournalActionNotice(
        `Closed ${posId} (${targetPos.direction} ${targetPos.lots.toFixed(2)} ${targetPos.instrumentId}) at $${markPrice.toFixed(
          2
        )} · Realized ${sign}$${Math.abs(projectedPnl).toFixed(2)}.`
      );
      void emitTradeAlert(
        'TRADE_CLOSED',
        targetPos,
        customCloseNote?.includes('Contra') ? 'CONTRA_RECONCILE' : 'MANUAL',
        {
          exitPrice: markPrice,
          realizedPnl: projectedPnl,
          status: projectedPnl >= 0 ? 'CLOSED_PROFIT' : 'CLOSED_LOSS',
          reason: customCloseNote ? 'Contra-advisory close' : 'Manual close at market mark',
        }
      );
    } finally {
      setClosingPositionIds((prev) => {
        const next = new Set(prev);
        next.delete(posId);
        return next;
      });
    }
  };

  const handleCloseAllOpen = async () => {
    const currentlyOpen = positionsRef.current.filter((p) => p.status === 'OPEN');
    if (currentlyOpen.length === 0) return;

    const closePrices: Record<string, number> = {};
    for (const p of currentlyOpen) {
      closePrices[p.instrumentId] = getPositionMarkPrice(p, quote, quotes);
    }

    mutationSeqRef.current += 1;
    const synced = await persistJournalAction({
      action: 'CLOSE_ALL',
      closePrices,
    });

    if (!synced) {
      setPositions((prev) => {
        const next = prev.map((p) => {
          if (p.status !== 'OPEN') return p;
          const markPrice = getPositionMarkPrice(p, quote, quotes);
          const finalPnl = Number(calcDirectionalPnl(p, markPrice).toFixed(2));
          const prevExtreme = p.adverseExtremePrice ?? p.entryPrice;
          const updatedExtreme =
            p.direction === 'SELL'
              ? Math.max(prevExtreme, markPrice)
              : Math.min(prevExtreme, markPrice);
          return {
            ...p,
            currentPrice: markPrice,
            adverseExtremePrice: Number(updatedExtreme.toFixed(2)),
            status: finalPnl >= 0 ? ('CLOSED_PROFIT' as const) : ('CLOSED_LOSS' as const),
            realizedPnl: finalPnl,
            unrealizedPnl: 0,
            closeTime: new Date().toISOString(),
          };
        });
        saveLocalJournalBackup(activeUserId, next);
        return next;
      });
    }

    for (const p of currentlyOpen) {
      const markPrice = closePrices[p.instrumentId];
      const finalPnl = Number(calcDirectionalPnl(p, markPrice).toFixed(2));
      void emitTradeAlert('TRADE_CLOSED', p, 'MANUAL', {
        exitPrice: markPrice,
        realizedPnl: finalPnl,
        status: finalPnl >= 0 ? 'CLOSED_PROFIT' : 'CLOSED_LOSS',
        reason: 'Bulk Close All Open',
      });
    }

    setJournalActionNotice(`Closed ${currentlyOpen.length} open paper position(s) at live market mark.`);
  };

  useEffect(() => {
    if (!pendingCloseTarget) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !journalBusy) {
        setPendingCloseTarget(null);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [pendingCloseTarget, journalBusy]);

  const handleRequestClosePosition = (pos: PaperPosition) => {
    if (pos.status !== 'OPEN' || closingPositionIds.has(pos.id)) return;
    setPendingCloseTarget({ mode: 'SINGLE', position: pos });
  };

  const handleRequestCloseContraOpen = () => {
    if (contraAdvisoryPositions.length === 0 || journalBusy) return;
    setPendingCloseTarget({ mode: 'CONTRA', positions: contraAdvisoryPositions });
  };

  const handleRequestCloseAllOpen = () => {
    if (openPositions.length === 0 || journalBusy) return;
    setPendingCloseTarget({ mode: 'ALL', positions: openPositions });
  };

  const handleConfirmCloseAction = async () => {
    if (!pendingCloseTarget) return;
    if (pendingCloseTarget.mode === 'SINGLE') {
      await handleClosePosition(pendingCloseTarget.position.id);
    } else if (pendingCloseTarget.mode === 'CONTRA') {
      for (const pos of pendingCloseTarget.positions) {
        await handleClosePosition(
          pos.id,
          '[Manual Reconciliation: Closed position contradicting current live advisory.]'
        );
      }
      setJournalActionNotice(
        `Closed ${pendingCloseTarget.positions.length} contra-advisory paper position(s) at live market mark.`
      );
    } else {
      await handleCloseAllOpen();
    }
    setPendingCloseTarget(null);
  };

  const handleClearJournal = async () => {
    mutationSeqRef.current += 1;
    const synced = await persistJournalAction({ action: 'CLEAR' });
    if (!synced) {
      setPositions([]);
      saveLocalJournalBackup(activeUserId, []);
    }
    setJournalActionNotice('Paper trading ledger cleared to 0 positions.');
  };

  const handleLoadDemoJournal = async () => {
    mutationSeqRef.current += 1;
    const synced = await persistJournalAction({ action: 'SEED_DEMO' });
    if (synced) {
      setJournalActionNotice('Loaded sample Q1–Q4 institutional paper trades into your sandbox ledger.');
    }
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
          <div className="flex flex-wrap items-center gap-3 text-xs font-mono text-slate-400">
            <span>Paper Capital: ${balance.toLocaleString()}</span>
            <span aria-hidden="true">·</span>
            <span className="text-emerald-400">Zero Live Broker Risk</span>
            <span aria-hidden="true">·</span>
            <span>Sync: {journalPersistenceLabel}</span>
            <button
              type="button"
              onClick={handleLoadDemoJournal}
              disabled={journalBusy}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 transition-colors disabled:opacity-50 cursor-pointer"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              Load Demo Sample
            </button>
            {positions.length > 0 && (
              <button
                type="button"
                onClick={handleClearJournal}
                disabled={journalBusy}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded bg-rose-500/10 hover:bg-rose-500/20 text-rose-300 border border-rose-500/30 transition-colors disabled:opacity-50 cursor-pointer"
              >
                Clear Ledger
              </button>
            )}
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
            <span className="text-[10px] text-slate-400 block mt-0.5 truncate">
              {closedPositions.length} completed · {dateFilterSummary.activeLabel}
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
      <div className="flex flex-wrap items-center gap-2 border-b border-slate-800 pb-2">
        <button
          type="button"
          onClick={() => setActiveTab('journal')}
          className={`flex items-center gap-2 px-4 py-2 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
            activeTab === 'journal'
              ? 'bg-amber-500/10 text-amber-300 border border-amber-500/30 font-semibold'
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <BookOpen className="w-4 h-4" />
          Paper Journal ({positions.length})
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('historicalPlans')}
          className={`flex items-center gap-2 px-4 py-2 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
            activeTab === 'historicalPlans'
              ? 'bg-amber-500/10 text-amber-300 border border-amber-500/30 font-semibold'
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <History className="w-4 h-4" />
          Historical Trade Plan Performance ({historicalPlanPerfReport.totalCount})
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('scanner')}
          className={`flex items-center gap-2 px-4 py-2 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
            activeTab === 'scanner'
              ? 'bg-amber-500/10 text-amber-300 border border-amber-500/30 font-semibold'
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <Radar className="w-4 h-4" />
          Multi-Commodity Scanner ({opportunityScans.length})
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('margin')}
          className={`flex items-center gap-2 px-4 py-2 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
            activeTab === 'margin'
              ? 'bg-amber-500/10 text-amber-300 border border-amber-500/30 font-semibold'
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <PieChart className="w-4 h-4" />
          Margin & Stress Heat-Map
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('physicalDca')}
          className={`flex items-center gap-2 px-4 py-2 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
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
          {/* Where You Are & Focused Position Status Card */}
          {(() => {
            const focusedPos = highlightedPositionId
              ? positions.find((p) => p.id === highlightedPositionId) || null
              : null;
            const buyLots = openPositions
              .filter((p) => p.direction === 'BUY')
              .reduce((acc, p) => acc + p.lots, 0);
            const sellLots = openPositions
              .filter((p) => p.direction === 'SELL')
              .reduce((acc, p) => acc + p.lots, 0);
            const netLots = buyLots - sellLots;
            const netPostureLabel =
              openPositions.length === 0
                ? 'Flat (No Open Exposure)'
                : netLots > 0
                ? `Net Long +${netLots.toFixed(2)} Lots`
                : netLots < 0
                ? `Net Short ${Math.abs(netLots).toFixed(2)} Lots`
                : `Balanced Hedge (${buyLots.toFixed(2)}L Buy / ${sellLots.toFixed(2)}L Sell)`;

            const focusMark = focusedPos ? getPositionMarkPrice(focusedPos, quote, quotes) : 0;
            const focusPnl = focusedPos
              ? focusedPos.status === 'OPEN'
                ? calcDirectionalPnl(focusedPos, focusMark)
                : focusedPos.realizedPnl
              : 0;
            const focusAlignment = focusedPos
              ? advisoryAlignmentReport.byPositionId[focusedPos.id]
              : undefined;

            return (
              <section
                id="focused-position-inspector"
                aria-label="Current Portfolio Location and Position Status"
                className="bg-slate-900 border border-slate-800 rounded-lg p-4 space-y-3"
              >
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="space-y-0.5">
                    <div className="text-[11px] font-mono text-slate-400">
                      Terminal &rsaquo; Portfolio &amp; Journal &rsaquo;{' '}
                      <span className="text-amber-400 font-semibold">
                        {journalSectionFocus === 'EXECUTION'
                          ? '01. Execution & Positions'
                          : journalSectionFocus === 'PERFORMANCE'
                          ? '02. Performance & ROI'
                          : journalSectionFocus === 'RISK'
                          ? '03. Risk & Forensics'
                          : 'All Panels'}
                      </span>
                    </div>
                    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs font-mono">
                      <span className="text-slate-100 font-bold">
                        {activeSession?.displayName || 'Guest Visitor'} ({activeSession?.role || 'GUEST'})
                      </span>
                      <span className="text-slate-600" aria-hidden="true">·</span>
                      <span className="text-slate-300 tabular-nums">
                        {openPositions.length} Open / {closedPositions.length} Closed
                      </span>
                      <span className="text-slate-600" aria-hidden="true">·</span>
                      <span className="text-amber-300 font-semibold tabular-nums">
                        {netPostureLabel}
                      </span>
                      {openPositions.length > 0 && (
                        <>
                          <span className="text-slate-600" aria-hidden="true">·</span>
                          <span
                            className={`font-bold tabular-nums ${
                              totalUnrealized >= 0 ? 'text-emerald-400' : 'text-rose-400'
                            }`}
                          >
                            Live MTM: {totalUnrealized >= 0 ? '+$' : '-$'}
                            {Math.abs(totalUnrealized).toFixed(2)}
                          </span>
                        </>
                      )}
                    </div>
                  </div>

                  {focusedPos && (
                    <button
                      type="button"
                      onClick={() => {
                        setHighlightedPositionId(null);
                        setTimelineFocusPositionId(null);
                      }}
                      className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded bg-slate-800 hover:bg-slate-700 border border-slate-700 text-xs font-mono text-slate-200 whitespace-nowrap shrink-0 cursor-pointer"
                    >
                      <X className="w-3.5 h-3.5" aria-hidden="true" />
                      Clear Position Focus
                    </button>
                  )}
                </div>

                {focusedPos && (
                  <div className="bg-slate-950/80 border border-amber-500/40 rounded-lg p-3.5 space-y-3">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div className="flex flex-wrap items-center gap-2 text-xs font-mono">
                        <span className="text-amber-400 font-bold">FOCUSED POSITION:</span>
                        <span className="text-slate-100 font-bold">{focusedPos.id}</span>
                        <span
                          className={`font-bold ${
                            focusedPos.direction === 'BUY' ? 'text-emerald-400' : 'text-rose-400'
                          }`}
                        >
                          {focusedPos.direction} {focusedPos.lots.toFixed(2)}L {focusedPos.instrumentId}
                        </span>
                        <span className="text-slate-400">
                          · {focusedPos.status === 'OPEN' ? 'OPEN (LIVE)' : focusedPos.status.replace(/_/g, ' ')}
                        </span>
                        {focusAlignment && (
                          <span
                            className={`font-semibold ${
                              focusAlignment.status === 'CONTRA_ADVISORY'
                                ? 'text-amber-300'
                                : focusAlignment.status === 'ALIGNED'
                                ? 'text-emerald-400'
                                : 'text-slate-400'
                            }`}
                          >
                            · {focusAlignment.status.replace(/_/g, ' ')}
                          </span>
                        )}
                      </div>

                      <div className="flex items-center gap-2">
                        {focusedPos.status === 'OPEN' && (
                          <button
                            type="button"
                            disabled={closingPositionIds.has(focusedPos.id)}
                            onClick={() => handleRequestClosePosition(focusedPos)}
                            className="px-3 py-1.5 rounded bg-rose-500/15 hover:bg-rose-500/25 border border-rose-500/35 text-rose-300 text-xs font-semibold whitespace-nowrap cursor-pointer disabled:opacity-50"
                          >
                            {closingPositionIds.has(focusedPos.id) ? 'Closing...' : 'Close Focused Trade'}
                          </button>
                        )}
                      </div>
                    </div>

                    <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 text-xs font-mono tabular-nums">
                      <div className="bg-slate-900 border border-slate-800 rounded p-2">
                        <span className="text-[10px] text-slate-500 block">ENTRY PRICE</span>
                        <span className="text-slate-100 font-bold">${focusedPos.entryPrice.toFixed(2)}</span>
                      </div>
                      <div className="bg-slate-900 border border-slate-800 rounded p-2">
                        <span className="text-[10px] text-slate-500 block">
                          {focusedPos.status === 'OPEN' ? 'CURRENT MARK' : 'EXIT PRICE'}
                        </span>
                        <span className="text-amber-300 font-bold">${focusMark.toFixed(2)}</span>
                      </div>
                      <div className="bg-slate-900 border border-slate-800 rounded p-2">
                        <span className="text-[10px] text-slate-500 block">STOP LOSS</span>
                        <span className="text-rose-400 font-bold">${focusedPos.stopLoss.toFixed(2)}</span>
                      </div>
                      <div className="bg-slate-900 border border-slate-800 rounded p-2">
                        <span className="text-[10px] text-slate-500 block">TARGET 1</span>
                        <span className="text-emerald-400 font-bold">${focusedPos.takeProfit.toFixed(2)}</span>
                      </div>
                      <div className="bg-slate-900 border border-slate-800 rounded p-2 col-span-2 sm:col-span-1">
                        <span className="text-[10px] text-slate-500 block">
                          {focusedPos.status === 'OPEN' ? 'UNREALIZED P&L' : 'REALIZED P&L'}
                        </span>
                        <span
                          className={`font-bold ${
                            focusPnl >= 0 ? 'text-emerald-400' : 'text-rose-400'
                          }`}
                        >
                          {focusPnl >= 0 ? '+$' : '-$'}
                          {Math.abs(focusPnl).toFixed(2)}
                        </span>
                      </div>
                    </div>
                  </div>
                )}
              </section>
            );
          })()}

          {/* Journal Section Focus Bar (Reduces vertical scroll & groups correlated tools) */}
          <div
            role="navigation"
            aria-label="Journal Workspace Section Focus"
            className="bg-slate-900 border border-slate-800 rounded-lg px-4 py-2.5 flex flex-wrap items-center justify-between gap-2.5"
          >
            <span className="text-[11px] font-mono uppercase tracking-wider text-slate-400">
              Section View:
            </span>
            <div className="flex flex-wrap items-center gap-1.5">
              {(
                [
                  { id: 'EXECUTION', label: '01. Execution & Positions' },
                  { id: 'PERFORMANCE', label: '02. Performance & ROI' },
                  { id: 'RISK', label: '03. Risk & Forensics' },
                  { id: 'ALL', label: 'All Panels' },
                ] as const
              ).map((sec) => {
                const active = journalSectionFocus === sec.id;
                return (
                  <button
                    key={sec.id}
                    type="button"
                    onClick={() => setJournalSectionFocus(sec.id)}
                    aria-pressed={active}
                    className={`px-3 py-1.5 rounded-md text-xs font-mono transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                      active
                        ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40 font-semibold'
                        : 'bg-slate-950 text-slate-400 hover:text-slate-200 border border-slate-800'
                    }`}
                  >
                    {sec.label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Economic Cycle Date-Range Picker (Shown in Performance, Risk, or All Panels view so Execution stays uncluttered) */}
          {journalSectionFocus !== 'EXECUTION' && (
          <section
            aria-label="Journal Date-Range Cycle Filter"
            className="bg-slate-900 border border-slate-800 rounded-lg p-5 space-y-4"
          >
            <div className="flex flex-wrap items-center justify-between gap-4 pb-3 border-b border-slate-800">
              <div>
                <h3 className="text-base font-bold text-slate-100 flex items-center gap-2">
                  <Calendar className="w-4 h-4 text-amber-400 shrink-0" aria-hidden="true" />
                  <span>Economic Cycle &amp; Date-Range Filter</span>
                </h3>
                <div className="flex flex-wrap items-center gap-2 text-xs text-slate-400 mt-1">
                  <span>Scope: {dateFilterSummary.activeLabel}</span>
                  <span aria-hidden="true">·</span>
                  <span className="font-mono tabular-nums">
                    {dateFilterSummary.totalMatchedCount} of {dateFilterSummary.totalCatalogCount} trades
                  </span>
                  <span aria-hidden="true">·</span>
                  <span
                    className={`font-mono tabular-nums font-semibold ${
                      dateFilterSummary.realizedPnlUsd >= 0 ? 'text-emerald-400' : 'text-rose-400'
                    }`}
                  >
                    {dateFilterSummary.realizedPnlUsd >= 0 ? '+' : '-'}$
                    {Math.abs(dateFilterSummary.realizedPnlUsd).toLocaleString()} realized
                  </span>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <div
                  role="group"
                  aria-label="Date-range granularity"
                  className="flex items-center gap-1 p-1 bg-slate-950 border border-slate-800 rounded-lg"
                >
                  {(
                    [
                      { id: 'ALL', label: 'All Cycles' },
                      { id: 'QUARTER', label: 'By Quarter' },
                      { id: 'MONTH', label: 'By Month' },
                      { id: 'CUSTOM', label: 'Custom Dates' },
                    ] as const
                  ).map((mode) => (
                    <button
                      key={mode.id}
                      type="button"
                      onClick={() => setRangeGranularity(mode.id)}
                      aria-pressed={rangeGranularity === mode.id}
                      className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                        rangeGranularity === mode.id
                          ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40 font-semibold'
                          : 'text-slate-400 hover:text-slate-200 border border-transparent'
                      }`}
                    >
                      {mode.label}
                    </button>
                  ))}
                </div>

                {rangeGranularity !== 'ALL' && (
                  <button
                    type="button"
                    onClick={() => setRangeGranularity('ALL')}
                    className="px-3 py-1.5 text-xs font-medium rounded-md bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                  >
                    Clear Filter
                  </button>
                )}
              </div>
            </div>

            {/* Granularity-Specific Controls */}
            {rangeGranularity === 'QUARTER' && (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5">
                {dateFilterSummary.availableQuarters.map((q) => {
                  const isActive = selectedQuarterKey === q.key;
                  return (
                    <button
                      key={q.key}
                      type="button"
                      onClick={() => setSelectedQuarterKey(q.key)}
                      aria-pressed={isActive}
                      className={`text-left p-3 rounded-lg border transition-colors cursor-pointer ${
                        isActive
                          ? 'bg-slate-800/90 border-amber-500/60 text-slate-100'
                          : 'bg-slate-950/70 border-slate-800 text-slate-300 hover:border-slate-700'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2 text-xs font-mono">
                        <span className="font-bold text-slate-100">{q.label}</span>
                        <span
                          className={`font-bold tabular-nums ${
                            q.realizedPnlUsd >= 0 ? 'text-emerald-400' : 'text-rose-400'
                          }`}
                        >
                          {q.realizedPnlUsd >= 0 ? '+' : '-'}${Math.abs(q.realizedPnlUsd).toLocaleString()}
                        </span>
                      </div>
                      <div className="text-[11px] text-slate-400 mt-1 truncate">{q.cycleContext}</div>
                      <div className="text-[11px] font-mono tabular-nums text-slate-400 mt-1">
                        {q.tradeCount} trades · {q.winRatePct}% win rate
                      </div>
                    </button>
                  );
                })}
              </div>
            )}

            {rangeGranularity === 'MONTH' && (
              <div className="space-y-3">
                <div className="flex flex-wrap items-center gap-3">
                  <label
                    htmlFor="journal-month-picker"
                    className="text-xs font-mono text-slate-400 whitespace-nowrap"
                  >
                    Jump to Month:
                  </label>
                  <input
                    id="journal-month-picker"
                    type="month"
                    value={selectedMonthKey}
                    onChange={(e) => {
                      if (e.target.value) setSelectedMonthKey(e.target.value);
                    }}
                    className="bg-slate-950 border border-slate-700 rounded-md px-3 py-1.5 text-xs font-mono text-slate-100 focus:outline-none focus:border-amber-400"
                  />
                </div>
                <div className="flex flex-wrap gap-2">
                  {dateFilterSummary.availableMonths.map((m) => {
                    const isActive = selectedMonthKey === m.key;
                    return (
                      <button
                        key={m.key}
                        type="button"
                        onClick={() => setSelectedMonthKey(m.key)}
                        aria-pressed={isActive}
                        className={`px-3 py-1.5 rounded-md border text-xs font-mono tabular-nums transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                          isActive
                            ? 'bg-amber-500/20 text-amber-300 border-amber-500/50 font-semibold'
                            : 'bg-slate-950/70 text-slate-300 border-slate-800 hover:border-slate-700'
                        }`}
                      >
                        {m.label} · {m.tradeCount}T · {m.realizedPnlUsd >= 0 ? '+' : '-'}$
                        {Math.abs(m.realizedPnlUsd).toLocaleString()}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {rangeGranularity === 'CUSTOM' && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label
                    htmlFor="journal-custom-start"
                    className="block text-[11px] font-mono text-slate-400 mb-1"
                  >
                    Start Date (Inclusive UTC)
                  </label>
                  <input
                    id="journal-custom-start"
                    type="date"
                    value={customStartDate}
                    onChange={(e) => setCustomStartDate(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-md px-3 py-2 text-xs font-mono text-slate-100 focus:outline-none focus:border-amber-400"
                  />
                </div>
                <div>
                  <label
                    htmlFor="journal-custom-end"
                    className="block text-[11px] font-mono text-slate-400 mb-1"
                  >
                    End Date (Inclusive UTC)
                  </label>
                  <input
                    id="journal-custom-end"
                    type="date"
                    value={customEndDate}
                    onChange={(e) => setCustomEndDate(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-md px-3 py-2 text-xs font-mono text-slate-100 focus:outline-none focus:border-amber-400"
                  />
                </div>
              </div>
            )}

            {/* Economic Cycle Quarterly Trend Strip (always visible in ALL mode for cycle-to-cycle comparison) */}
            {rangeGranularity === 'ALL' && dateFilterSummary.availableQuarters.length > 0 && (
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5 text-xs font-mono tabular-nums">
                {dateFilterSummary.availableQuarters.map((q) => (
                  <button
                    key={q.key}
                    type="button"
                    onClick={() => {
                      setSelectedQuarterKey(q.key);
                      setRangeGranularity('QUARTER');
                    }}
                    className="text-left p-2.5 rounded-md bg-slate-950/70 border border-slate-800 hover:border-amber-500/40 transition-colors cursor-pointer"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-bold text-slate-200">{q.label}</span>
                      <span className={q.realizedPnlUsd >= 0 ? 'text-emerald-400 font-bold' : 'text-rose-400 font-bold'}>
                        {q.realizedPnlUsd >= 0 ? '+' : '-'}${Math.abs(q.realizedPnlUsd).toLocaleString()}
                      </span>
                    </div>
                    <div className="text-[11px] text-slate-400 mt-0.5 truncate">{q.cycleContext}</div>
                    <div className="text-[11px] text-slate-500 mt-0.5">
                      {q.tradeCount} trades · {q.winRatePct}% win
                    </div>
                  </button>
                ))}
              </div>
            )}

            <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-slate-800/80 text-xs text-slate-300">
              <span>{dateFilterSummary.cycleTrendNote}</span>
              {dateFilterSummary.totalMatchedCount === 0 && rangeGranularity !== 'ALL' && (
                <button
                  type="button"
                  onClick={() => setRangeGranularity('ALL')}
                  className="px-3 py-1 bg-amber-500 hover:bg-amber-400 text-slate-950 font-semibold rounded text-xs transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                >
                  Show All History
                </button>
              )}
            </div>
          </section>
          )}

          {/* SECTION 01: ACTIVE POSITIONS FIRST, THEN QUICK ENTRY & AUTO-PILOT */}
          {(journalSectionFocus === 'ALL' || journalSectionFocus === 'EXECUTION') && (
            <div className="space-y-6">
              {/* Active Positions Table (Immediately visible at top of Execution view) */}
              <div className="bg-slate-900 border border-slate-800 rounded-lg overflow-hidden">
                <div className="px-5 py-4 border-b border-slate-800 flex flex-wrap items-center justify-between gap-3">
                  <div className="flex flex-wrap items-center gap-3">
                    <h3 className="text-sm font-semibold text-slate-100">
                      Active Paper Positions ({openPositions.length})
                    </h3>
                    {openPositions.length > 0 && (
                      <button
                        type="button"
                        onClick={() => void runGhostTradeSyncCleanup(true)}
                        disabled={journalBusy}
                        className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 rounded text-[11px] font-medium transition-colors whitespace-nowrap shrink-0 disabled:opacity-50 cursor-pointer"
                      >
                        Run 1% Sync Check
                      </button>
                    )}
                    {openPositions.length >= 2 && (
                      <button
                        type="button"
                        onClick={handleRequestCloseAllOpen}
                        disabled={journalBusy}
                        className="px-2.5 py-1 bg-rose-500/15 hover:bg-rose-500/25 text-rose-300 border border-rose-500/30 rounded text-[11px] font-semibold transition-colors whitespace-nowrap shrink-0 disabled:opacity-50 cursor-pointer"
                      >
                        Close All Open
                      </button>
                    )}
                  </div>
                  <span className="text-xs font-mono text-slate-400 tabular-nums">
                    Marked to Live Spot Mid: ${quote.mid.toFixed(2)}
                  </span>
                </div>

                {journalActionNotice && (
                  <div
                    role="status"
                    className="mx-5 mt-3 flex flex-wrap items-center justify-between gap-2 rounded border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-xs font-mono text-emerald-200"
                  >
                    <span>{journalActionNotice}</span>
                    <button
                      type="button"
                      onClick={() => setJournalActionNotice(null)}
                      className="text-emerald-300 hover:text-emerald-100 whitespace-nowrap shrink-0 cursor-pointer"
                    >
                      Dismiss
                    </button>
                  </div>
                )}

                {journalError && (
                  <div
                    role="alert"
                    className="mx-5 mt-3 rounded border border-rose-500/40 bg-rose-500/10 px-3 py-2 text-xs font-mono text-rose-300"
                  >
                    {journalError}
                  </div>
                )}

                {(advisoryAlignmentReport.contraAdvisoryCount > 0 ||
                  advisoryAlignmentReport.contraPeerPositionCount > 0) && (
                  <div
                    role="status"
                    className="mx-5 mt-3 flex flex-wrap items-center justify-between gap-3 rounded-md border border-amber-500/35 bg-amber-500/10 px-3.5 py-2.5 text-xs"
                  >
                    <div className="space-y-0.5 text-amber-100 min-w-0">
                      <div className="font-semibold flex items-center gap-1.5 text-amber-300">
                        <AlertTriangle className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
                        <span>
                          {advisoryAlignmentReport.contraAdvisoryCount > 0
                            ? `${advisoryAlignmentReport.contraAdvisoryCount} open position(s) currently contradict the live advisory`
                            : 'Opposing open positions detected on the same instrument'}
                        </span>
                      </div>
                      <p className="text-[11px] text-amber-200/80">
                        Open paper trades lock their entry direction while live signals recompute from spot and candle structure across INTRADAY vs SWING horizons. Review flagged rows below or enable Auto-Close on Signal Flip in Auto-Paper Pilot.
                      </p>
                    </div>
                    {contraAdvisoryPositions.length > 0 && (
                      <button
                        type="button"
                        onClick={handleRequestCloseContraOpen}
                        disabled={journalBusy}
                        className="px-3 py-1.5 rounded bg-amber-500 hover:bg-amber-400 text-slate-950 font-semibold text-[11px] transition-colors whitespace-nowrap shrink-0 disabled:opacity-50 cursor-pointer"
                      >
                        Close Contra-Advisory ({contraAdvisoryPositions.length})
                      </button>
                    )}
                  </div>
                )}

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
                        <th className="px-4 py-3 text-right">Unrealized P&amp;L</th>
                        <th className="px-4 py-3 text-center">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/60 font-mono">
                      {openPositions.length === 0 ? (
                        <tr>
                          <td colSpan={10} className="px-4 py-6 text-center text-slate-400">
                            <div className="space-y-2.5">
                              <p>
                                Your isolated paper portfolio has no active positions yet. Open a simulated trade below or from any trade plan card.
                              </p>
                              {positions.length === 0 && (
                                <button
                                  type="button"
                                  onClick={handleLoadDemoJournal}
                                  disabled={journalBusy}
                                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded bg-slate-800 hover:bg-slate-700 text-amber-300 border border-slate-700 text-xs font-medium transition-colors disabled:opacity-50 cursor-pointer"
                                >
                                  <RotateCcw className="w-3.5 h-3.5" />
                                  Load Sample Demo Trades
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      ) : (
                        openPositions.map((pos) => {
                          const markPrice = getPositionMarkPrice(pos, quote, quotes);
                          const pnl = calcDirectionalPnl(pos, markPrice);
                          const slBreached = isStopLossBreached(pos, markPrice);
                          const isClosing = closingPositionIds.has(pos.id);
                          const alignment = advisoryAlignmentReport.byPositionId[pos.id];
                          const isHighlighted = highlightedPositionId === pos.id;
                          return (
                            <tr
                              key={pos.id}
                              id={`journal-pos-${pos.id}`}
                              className={isHighlighted ? 'bg-amber-500/10 ring-1 ring-inset ring-amber-500/40' : 'hover:bg-slate-800/30'}
                            >
                              <td className="px-4 py-3 text-slate-400">{pos.id}</td>
                              <td className="px-4 py-3 font-bold text-slate-200">{pos.instrumentId}</td>
                              <td className="px-4 py-3" title={alignment?.reason}>
                                <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
                                  <span
                                    className={`font-bold ${
                                      pos.direction === 'SELL' ? 'text-rose-400' : 'text-emerald-400'
                                    }`}
                                  >
                                    {pos.direction}
                                  </span>
                                  {alignment && (
                                    <span className="text-[10px] text-slate-400 whitespace-nowrap">
                                      {alignment.advisoryHorizon}
                                    </span>
                                  )}
                                  {alignment?.status === 'CONTRA_ADVISORY' && (
                                    <span className="text-[10px] text-amber-300 font-semibold whitespace-nowrap">
                                      · Contra-Advisory (Live: {alignment.livePlanDirection})
                                    </span>
                                  )}
                                  {alignment?.status === 'ADVISORY_PAUSED' && (
                                    <span className="text-[10px] text-slate-400 whitespace-nowrap">
                                      · Advisory: {alignment.livePlanDirection}
                                    </span>
                                  )}
                                  {alignment?.hasOppositeOpenPeer && (
                                    <span className="text-[10px] text-amber-400 whitespace-nowrap">
                                      · Opposing peer open
                                    </span>
                                  )}
                                  {slBreached && (
                                    <span className="text-[10px] text-rose-400 font-semibold whitespace-nowrap">
                                      · SL Breached
                                    </span>
                                  )}
                                </div>
                              </td>
                              <td className="px-4 py-3 text-right text-slate-300 tabular-nums">{pos.lots.toFixed(2)}</td>
                              <td className="px-4 py-3 text-right text-slate-300 tabular-nums">${pos.entryPrice.toFixed(2)}</td>
                              <td className="px-4 py-3 text-right text-amber-400 font-bold tabular-nums">${markPrice.toFixed(2)}</td>
                              <td className="px-4 py-3 text-right text-rose-400 tabular-nums">${pos.stopLoss.toFixed(2)}</td>
                              <td className="px-4 py-3 text-right text-emerald-400 tabular-nums">${pos.takeProfit.toFixed(2)}</td>
                              <td
                                className={`px-4 py-3 text-right font-bold tabular-nums ${
                                  pnl >= 0 ? 'text-emerald-400' : 'text-rose-400'
                                }`}
                              >
                                {pnl >= 0 ? `+$${pnl.toFixed(2)}` : `-$${Math.abs(pnl).toFixed(2)}`}
                              </td>
                              <td className="px-4 py-3 text-center">
                                <div className="inline-flex items-center gap-1.5">
                                  <button
                                    type="button"
                                    onClick={() => setHighlightedPositionId(pos.id)}
                                    className="px-2 py-1 bg-slate-800 hover:bg-slate-700 text-amber-300 border border-slate-700 rounded text-[11px] font-medium transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                                  >
                                    Inspect
                                  </button>
                                  <button
                                    type="button"
                                    disabled={isClosing}
                                    onClick={() => handleRequestClosePosition(pos)}
                                    className="px-2.5 py-1 bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/20 rounded text-[11px] font-semibold transition-colors whitespace-nowrap shrink-0 disabled:opacity-50 cursor-pointer"
                                  >
                                    {isClosing ? 'Closing...' : 'Close Trade'}
                                  </button>
                                </div>
                              </td>
                            </tr>
                          );
                        })
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Quick Simulated Trade Entry Form */}
              <div className="bg-slate-900 border border-slate-800 rounded-lg p-5">
                <h3 className="text-sm font-semibold text-slate-100 mb-3">
                  Open Simulated Paper Position from Active Advisory Plans
                </h3>

                <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
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
                    <label htmlFor="journal-lot-size" className="block text-[11px] font-mono text-slate-400 mb-1">
                      Position Size (Lots):
                    </label>
                    <input
                      id="journal-lot-size"
                      type="number"
                      min={0.01}
                      max={50}
                      step={0.05}
                      value={lotSizeInput}
                      onChange={(e) => setLotSizeInput(e.target.value)}
                      className="w-full bg-slate-950 border border-slate-800 rounded px-3 py-2 text-xs text-slate-200 font-mono tabular-nums"
                    />
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
                      type="button"
                      onClick={handleOpenFromPlan}
                      disabled={!selectedPlanActionable || journalBusy}
                      className="w-full bg-amber-500 hover:bg-amber-400 disabled:bg-slate-800 disabled:text-slate-400 text-slate-950 font-bold px-4 py-2 rounded text-xs transition-colors flex items-center justify-center gap-1.5 cursor-pointer disabled:cursor-not-allowed whitespace-nowrap"
                    >
                      <Plus className="w-4 h-4 shrink-0" />
                      {selectedPlanActionable
                        ? `Open ${selectedPlan?.direction} (${lotSizeInput || '1.00'}L)`
                        : `Non-Directional (${selectedPlan?.direction || 'HOLD'})`}
                    </button>
                  </div>
                </div>

                {selectedPlan && (
                  <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-[11px] font-mono text-slate-400">
                    <span>
                      Live {selectedPlan.horizon} Plan ({selectedPlan.instrumentId}):{' '}
                      <strong
                        className={
                          selectedPlan.direction === 'BUY'
                            ? 'text-emerald-400'
                            : selectedPlan.direction === 'SELL'
                            ? 'text-rose-400'
                            : 'text-amber-300'
                        }
                      >
                        {selectedPlan.direction}
                      </strong>{' '}
                      · {selectedPlan.state}
                      {selectedPlan.isAbstained ? ' · Abstained' : ''}
                    </span>
                    {selectedPlanContraPeer && (
                      <span className="text-amber-300">
                        Notice: Creates contra hedge vs open {selectedPlanContraPeer.direction} (
                        {resolvePositionAdvisoryHorizon(selectedPlanContraPeer)}) on{' '}
                        {selectedPlan.instrumentId}.
                      </span>
                    )}
                  </div>
                )}
              </div>

              {/* Autonomous Simulated Paper Trading (Auto-Paper Pilot) Panel */}
              <AutoPaperPilotPanel
                config={autoPilotConfig}
                evaluation={autoPilotEvaluation}
                accountBalance={balance}
                busy={journalBusy}
                lastCycleSummary={lastAutoPilotCycleSummary}
                onChangeConfig={handleUpdateAutoPilotConfig}
                onRunCycleNow={() => void runAutoPaperPilotCycle(true)}
              />
            </div>
          )}

          {/* SECTION 02: PERFORMANCE, EQUITY & ROI ANALYTICS */}
          {(journalSectionFocus === 'ALL' || journalSectionFocus === 'PERFORMANCE') && (
            <div className="space-y-6">
              {/* Trade Success Rate Radial Gauge (Immediate Strategy Feedback) */}
              <TradeSuccessRateGauge
                positions={filteredPositions}
                quote={quote}
                quotes={quotes}
              />

              {/* Paired Equity & ROI Curves (2-Col on Desktop, Stacked on Mobile) */}
              <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
                {/* Daily Profit/Loss & Account Balance Progression Line Chart (Recharts) */}
                <DailyProfitLossChart
                  positions={filteredPositions}
                  startingCapital={balance}
                  quote={quote}
                  quotes={quotes}
                  activeRangeLabel={dateFilterSummary.activeLabel}
                />

                {/* Daily Portfolio ROI & Compound Growth Line Chart (Recharts) */}
                <DailyPortfolioRoiChart
                  positions={filteredPositions}
                  startingCapital={balance}
                  assumedLeverage={30}
                  quote={quote}
                  quotes={quotes}
                  activeRangeLabel={dateFilterSummary.activeLabel}
                />
              </div>

              {/* Paired Horizon Performance Analytics */}
              <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
                {/* Advisory Horizon Performance Heatmap (Win/Loss Distribution & ROI by Timeframe) */}
                <HorizonPerformanceHeatmap
                  positions={filteredPositions}
                  quote={quote}
                  quotes={quotes}
                  startingCapital={balance}
                  activeRangeLabel={dateFilterSummary.activeLabel}
                />

                {/* Win Rate vs. Time Line Chart Across Advisory Horizons (Recharts) */}
                <HorizonWinRateTrendChart
                  positions={filteredPositions}
                  quote={quote}
                  quotes={quotes}
                  activeRangeLabel={dateFilterSummary.activeLabel}
                />
              </div>

              {/* Chronological Trade History Timeline & Visual Post-Mortem */}
              <div ref={timelineContainerRef}>
                <TradeHistoryTimelineChart
                  positions={filteredPositions}
                  quote={quote}
                  quotes={quotes}
                  startingCapital={balance}
                  activeRangeLabel={dateFilterSummary.activeLabel}
                  externalSelectedPositionId={timelineFocusPositionId}
                />
              </div>
            </div>
          )}

          {/* SECTION 03: RISK METRICS & STOP-LOSS / EXPECTANCY FORENSICS */}
          {(journalSectionFocus === 'ALL' || journalSectionFocus === 'RISK') && (
            <div className="space-y-6">
              {/* Account Risk Metrics Dashboard (Drawdown, Sharpe & Sortino Ratios) */}
              <RiskMetricsDashboard
                allPositions={positions}
                filteredPositions={filteredPositions}
                activeRangeLabel={dateFilterSummary.activeLabel}
                isRangeFiltered={rangeGranularity !== 'ALL'}
                startingCapital={balance}
                quote={quote}
                quotes={quotes}
              />

              {/* Paired Drawdown & Stop-Loss Exit Diagnostics */}
              <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
                {/* Real-Time Maximum Adverse Excursion (MAE) Chart */}
                <MaximumAdverseExcursionChart
                  positions={filteredPositions}
                  quote={quote}
                  quotes={quotes}
                />

                {/* Hit Stop-Loss Concentration Heatmap (Relative to Entry) */}
                <StopLossConcentrationHeatmap
                  positions={filteredPositions}
                  quote={quote}
                  quotes={quotes}
                  activeRangeLabel={dateFilterSummary.activeLabel}
                />
              </div>

              {/* Paired System Edge & Monte Carlo Projections */}
              <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
                {/* Trade Expectancy Distribution & Cumulative System Edge Chart */}
                <TradeExpectancyDistributionChart positions={filteredPositions} />

                {/* Monte Carlo Trade Expectancy & Drawdown Forecast */}
                <TradeExpectancyProjectionWidget
                  positions={filteredPositions}
                  startingCapital={balance}
                />
              </div>
            </div>
          )}

          {/* (Active Paper Positions Table is rendered at top of Section 01 above) */}

          {/* Trade Journal & Closed History (Visible in ALL or EXECUTION focus) */}
          {(journalSectionFocus === 'ALL' || journalSectionFocus === 'EXECUTION') && (
          <div className="bg-slate-900 border border-slate-800 rounded-lg overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-800 flex items-center justify-between">
              <h3 className="text-sm font-semibold text-slate-100">
                Closed Trades & Analytical Post-Mortem Log ({closedPositions.length})
              </h3>
              <span className="text-xs font-mono text-slate-400">
                {dateFilterSummary.activeLabel}
              </span>
            </div>

            <div className="divide-y divide-slate-800/80">
              {closedPositions.length === 0 ? (
                <div className="px-5 py-6 text-center text-xs text-slate-400 space-y-2">
                  <p>No closed trades recorded within {dateFilterSummary.activeLabel}.</p>
                  {rangeGranularity !== 'ALL' && (
                    <button
                      type="button"
                      onClick={() => setRangeGranularity('ALL')}
                      className="px-3 py-1.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-xs font-medium cursor-pointer"
                    >
                      Reset to All Cycles
                    </button>
                  )}
                </div>
              ) : (
                closedPositions.map((pos) => {
                  const isHighlighted = highlightedPositionId === pos.id;
                  return (
                  <div
                    key={pos.id}
                    id={`journal-pos-${pos.id}`}
                    className={`p-4 transition-colors ${
                      isHighlighted ? 'bg-amber-500/10 ring-1 ring-inset ring-amber-500/40' : 'hover:bg-slate-800/20'
                    }`}
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2 text-xs font-mono">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-slate-500">{pos.id}</span>
                        <span className="font-bold text-slate-200">{pos.instrumentId}</span>
                        <span
                          className={`font-bold ${
                            pos.direction === 'SELL' ? 'text-rose-400' : 'text-emerald-400'
                          }`}
                        >
                          {pos.direction} {pos.lots.toFixed(2)} lots
                        </span>
                        <span className="text-slate-400 tabular-nums">
                          Entry: ${pos.entryPrice.toFixed(2)} · Exit: ${pos.currentPrice.toFixed(2)}
                        </span>
                      </div>

                      <div className="flex items-center gap-3">
                        <span
                          className={`font-bold tabular-nums ${
                            pos.realizedPnl >= 0 ? 'text-emerald-400' : 'text-rose-400'
                          }`}
                        >
                          {pos.realizedPnl >= 0
                            ? `+$${pos.realizedPnl.toFixed(2)}`
                            : `-$${Math.abs(pos.realizedPnl).toFixed(2)}`}{' '}
                          ({pos.realizedPnl >= 0 ? 'Profit' : 'Loss'})
                        </span>
                        <span className="text-[10px] text-slate-500">{pos.openTime.slice(0, 10)}</span>
                        <button
                          type="button"
                          onClick={() => {
                            setTimelineFocusPositionId(pos.id);
                            setJournalSectionFocus('ALL');
                            timelineContainerRef.current?.scrollIntoView({
                              behavior: 'smooth',
                              block: 'center',
                            });
                          }}
                          className="px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 text-amber-300 border border-slate-700 text-[11px] font-medium transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                        >
                          Inspect Post-Mortem
                        </button>
                      </div>
                    </div>

                    {pos.notes && (
                      <p className="text-xs text-slate-400 mt-2 font-sans bg-slate-950/60 p-2 rounded border border-slate-800/80">
                        <strong>Journal Note:</strong> {pos.notes}
                      </p>
                    )}
                  </div>
                  );
                })
              )}
            </div>
          </div>
          )}
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

      {/* TAB 5: HISTORICAL TRADE PLAN PERFORMANCE */}
      {activeTab === 'historicalPlans' && (
        <HistoricalTradePlanPerformancePanel
          report={historicalPlanPerfReport}
          isLoading={forecastLedgerLoading}
          syncError={forecastLedgerError}
          onRefreshLiveScorecard={() => void fetchForecastLedger()}
        />
      )}

      {/* Mandatory Close Trade Confirmation Modal */}
      {pendingCloseTarget && (() => {
        const targetList =
          pendingCloseTarget.mode === 'SINGLE'
            ? [
                positions.find((p) => p.id === pendingCloseTarget.position.id) ||
                  pendingCloseTarget.position,
              ]
            : openPositions.length > 0
            ? openPositions
            : pendingCloseTarget.positions;

        const itemized = targetList.map((pos) => {
          const markPrice = getPositionMarkPrice(pos, quote, quotes);
          const projectedPnl = Number(calcDirectionalPnl(pos, markPrice).toFixed(2));
          return {
            pos,
            markPrice,
            projectedPnl,
            slBreached: isStopLossBreached(pos, markPrice),
          };
        });

        const totalProjectedPnl = Number(
          itemized.reduce((sum, item) => sum + item.projectedPnl, 0).toFixed(2)
        );
        const isBulk = pendingCloseTarget.mode !== 'SINGLE';
        const isContraBulk = pendingCloseTarget.mode === 'CONTRA';
        const single = itemized[0];
        const isBusyClosing =
          journalBusy || itemized.some((item) => closingPositionIds.has(item.pos.id));

        return (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm font-sans"
            role="dialog"
            aria-modal="true"
            aria-labelledby="close-trade-confirm-title"
            aria-describedby="close-trade-confirm-desc"
            onClick={(e) => {
              if (e.target === e.currentTarget && !isBusyClosing) {
                setPendingCloseTarget(null);
              }
            }}
          >
            <div className="relative w-full max-w-md bg-slate-900 border border-slate-800 rounded-xl shadow-2xl overflow-hidden">
              <div className="flex items-center justify-between px-5 py-4 border-b border-slate-800 bg-slate-950/60">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-lg bg-rose-500/10 border border-rose-500/30 flex items-center justify-center shrink-0">
                    <AlertTriangle className="w-4 h-4 text-rose-400" />
                  </div>
                  <div>
                    <span className="text-[11px] font-mono text-rose-400 font-semibold block">
                      Paper Execution Safeguard
                    </span>
                    <h3
                      id="close-trade-confirm-title"
                      className="text-sm font-bold text-slate-100"
                    >
                      {isContraBulk
                        ? `Confirm Closing ${itemized.length} Contra-Advisory Trade(s)`
                        : isBulk
                        ? `Confirm Closing ${itemized.length} Active Trades`
                        : 'Confirm Close Trade'}
                    </h3>
                  </div>
                </div>
                <button
                  type="button"
                  aria-label="Cancel trade closure"
                  disabled={isBusyClosing}
                  onClick={() => setPendingCloseTarget(null)}
                  className="min-h-[40px] min-w-[40px] flex items-center justify-center rounded-md text-slate-400 hover:text-slate-100 hover:bg-slate-800 transition-colors disabled:opacity-50 cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="p-5 space-y-4 text-xs">
                <p id="close-trade-confirm-desc" className="text-slate-300 leading-relaxed">
                  {isBulk
                    ? 'Review the active positions below before confirming. All selected paper positions will be settled immediately at current live market marks and moved to your Closed Trades history.'
                    : 'Review the live execution details below before confirming. This action settles the simulated position immediately at the current market mark and moves it to your Closed Trades history.'}
                </p>

                {!isBulk && single ? (
                  <div className="rounded-lg bg-slate-950 border border-slate-800 p-4 space-y-2.5 font-mono">
                    <div className="flex items-center justify-between gap-2 pb-2 border-b border-slate-800/80">
                      <span className="text-slate-400">
                        {single.pos.id} ·{' '}
                        <strong className="text-slate-100">{single.pos.instrumentId}</strong>
                      </span>
                      <span
                        className={`font-bold ${
                          single.pos.direction === 'SELL' ? 'text-rose-400' : 'text-emerald-400'
                        }`}
                      >
                        {single.pos.direction} {single.pos.lots.toFixed(2)} lots
                        {single.slBreached ? ' · SL Breached' : ''}
                      </span>
                    </div>

                    <div className="grid grid-cols-2 gap-y-2 gap-x-4 text-[11px]">
                      <div>
                        <span className="text-slate-500 block">Entry Price</span>
                        <span className="text-slate-200 font-semibold tabular-nums">
                          ${single.pos.entryPrice.toFixed(2)}
                        </span>
                      </div>
                      <div className="text-right">
                        <span className="text-slate-500 block">Live Exit Mark</span>
                        <span className="text-amber-400 font-bold tabular-nums">
                          ${single.markPrice.toFixed(2)}
                        </span>
                      </div>
                      <div>
                        <span className="text-slate-500 block">Stop Loss / Target</span>
                        <span className="text-slate-300 tabular-nums">
                          ${single.pos.stopLoss.toFixed(2)} / ${single.pos.takeProfit.toFixed(2)}
                        </span>
                      </div>
                      <div className="text-right">
                        <span className="text-slate-500 block">Estimated Realized P&amp;L</span>
                        <span
                          className={`font-bold tabular-nums ${
                            single.projectedPnl >= 0 ? 'text-emerald-400' : 'text-rose-400'
                          }`}
                        >
                          {single.projectedPnl >= 0
                            ? `+$${single.projectedPnl.toFixed(2)}`
                            : `-$${Math.abs(single.projectedPnl).toFixed(2)}`}{' '}
                          ({single.projectedPnl >= 0 ? 'Profit' : 'Loss'})
                        </span>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="rounded-lg bg-slate-950 border border-slate-800 overflow-hidden font-mono">
                    <div className="max-h-48 overflow-y-auto divide-y divide-slate-800/80">
                      {itemized.map(({ pos, markPrice, projectedPnl }) => (
                        <div
                          key={pos.id}
                          className="px-3.5 py-2.5 flex items-center justify-between gap-3 text-[11px]"
                        >
                          <div className="min-w-0">
                            <div className="text-slate-200 font-semibold truncate">
                              {pos.id} · {pos.instrumentId} ·{' '}
                              <span
                                className={
                                  pos.direction === 'SELL' ? 'text-rose-400' : 'text-emerald-400'
                                }
                              >
                                {pos.direction} {pos.lots.toFixed(2)}
                              </span>
                            </div>
                            <div className="text-slate-500 tabular-nums">
                              Entry ${pos.entryPrice.toFixed(2)} · Mark ${markPrice.toFixed(2)}
                            </div>
                          </div>
                          <div
                            className={`text-right font-bold tabular-nums shrink-0 ${
                              projectedPnl >= 0 ? 'text-emerald-400' : 'text-rose-400'
                            }`}
                          >
                            {projectedPnl >= 0
                              ? `+$${projectedPnl.toFixed(2)}`
                              : `-$${Math.abs(projectedPnl).toFixed(2)}`}
                          </div>
                        </div>
                      ))}
                    </div>
                    <div className="px-3.5 py-2.5 bg-slate-900/70 border-t border-slate-800 flex items-center justify-between text-[11px]">
                      <span className="text-slate-400">Net Estimated Realized P&amp;L</span>
                      <span
                        className={`font-bold tabular-nums ${
                          totalProjectedPnl >= 0 ? 'text-emerald-400' : 'text-rose-400'
                        }`}
                      >
                        {totalProjectedPnl >= 0
                          ? `+$${totalProjectedPnl.toFixed(2)}`
                          : `-$${Math.abs(totalProjectedPnl).toFixed(2)}`}{' '}
                        ({totalProjectedPnl >= 0 ? 'Profit' : 'Loss'})
                      </span>
                    </div>
                  </div>
                )}

                <div className="flex items-center justify-end gap-3 pt-1">
                  <button
                    type="button"
                    autoFocus
                    disabled={isBusyClosing}
                    onClick={() => setPendingCloseTarget(null)}
                    className="px-4 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-xs font-semibold transition-colors whitespace-nowrap shrink-0 disabled:opacity-50 cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    disabled={isBusyClosing}
                    onClick={handleConfirmCloseAction}
                    className="px-4 py-2 rounded-lg bg-rose-600 hover:bg-rose-500 text-white text-xs font-semibold transition-colors whitespace-nowrap shrink-0 disabled:opacity-50 cursor-pointer"
                  >
                    {isBusyClosing
                      ? 'Closing...'
                      : isContraBulk
                      ? `Confirm Close Contra (${itemized.length})`
                      : isBulk
                      ? `Confirm Close All (${itemized.length})`
                      : 'Confirm Close Trade'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        );
      })()}
    </div>
  );
};
