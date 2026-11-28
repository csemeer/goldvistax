/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * Aurum Intelligence — Alerts & Data Quality Workspace
 */

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AlertNotification, AlertRule, Candle, Quote, Timeframe } from '../domain/types';
import {
  CustomRsiAlertConfig,
  evaluateAtrVolatilityBreakout,
  evaluateCustomRsiAlerts,
  RsiConditionOperator,
  RsiRuleEvaluation,
} from '../services/indicators';
import {
  CorrelationDeviationAlertEvaluation,
  evaluateXauDxyCorrelationDeviationAlert,
  evaluateXauGsciCorrelationAlert,
  evaluateXauYieldCorrelationBreakoutAlert,
  GsciAlertMode,
  GsciCorrelationAlertEvaluation,
  YieldCorrelationBreakoutAlertEvaluation,
} from '../services/crossCommoditySpreads';
import { generateCandleHistory } from '../services/marketData';
import { getCurrentSession } from '../services/authService';
import { BellRing, AlertTriangle, Plus, Trash2, CheckCircle2, Activity, Zap, GitCompare, TrendingUp, Gauge, Layers } from 'lucide-react';

const CUSTOM_RSI_STORAGE_PREFIX = 'aurum_custom_rsi_alerts_v1';

interface AlertsWorkspaceProps {
  quote: Quote;
  quotes?: Record<string, Quote>;
  dailyCandles?: Candle[];
  chartCandles?: Candle[];
  chartTimeframe?: Timeframe;
}

export const AlertsWorkspace: React.FC<AlertsWorkspaceProps> = ({
  quote,
  quotes,
  dailyCandles,
  chartCandles,
  chartTimeframe,
}) => {
  const [rules, setRules] = useState<AlertRule[]>([
    {
      id: 'RULE-01',
      name: 'Key Breakout: Gold Closes Above $3,920',
      conditionType: 'PRICE_LEVEL',
      targetValue: 3920.00,
      comparison: 'ABOVE',
      horizon: 'SWING',
      isActive: true,
      createdAt: '2026-11-01T04:00:00Z',
    },
    {
      id: 'RULE-02',
      name: 'Pullback Entry: Gold Touches $3,875 Support',
      conditionType: 'PRICE_LEVEL',
      targetValue: 3875.00,
      comparison: 'BELOW',
      horizon: 'INTRADAY',
      isActive: true,
      createdAt: '2026-11-01T05:00:00Z',
    },
    {
      id: 'RULE-03',
      name: 'RSI Reversal Alert: 14-period RSI Drops Below 40',
      conditionType: 'RSI_THRESHOLD',
      targetValue: 40.0,
      comparison: 'BELOW',
      horizon: 'SHORT_TERM',
      isActive: true,
      createdAt: '2026-11-01T05:30:00Z',
    },
    {
      id: 'RULE-04',
      name: 'Spread Spike Warning: OTC Spread Exceeds 45 Pips',
      conditionType: 'SPREAD_SPIKE',
      targetValue: 45.0,
      comparison: 'ABOVE',
      horizon: 'CFD',
      isActive: true,
      createdAt: '2026-11-01T06:00:00Z',
    },
    {
      id: 'RULE-05',
      name: 'ATR Volatility Alert: XAU/USD Exceeds 14D ATR by >2.5 Std Dev',
      conditionType: 'ATR_VOLATILITY',
      targetValue: 2.5,
      comparison: 'ABOVE',
      horizon: 'INTRADAY',
      isActive: true,
      createdAt: '2026-11-01T06:30:00Z',
    },
    {
      id: 'RULE-06',
      name: 'Correlation Deviation Alert: 30D XAU/USD × DXY |Δr| > 0.20 vs Historical Norm (-0.74)',
      conditionType: 'CORRELATION_DEVIATION',
      targetValue: 0.2,
      comparison: 'ABOVE',
      horizon: 'SWING',
      isActive: true,
      createdAt: '2026-11-01T06:45:00Z',
    },
    {
      id: 'RULE-07',
      name: 'Regime Shift Push Alert: 30D XAU/USD × 10Y Yield Correlation > +0.50 (Risk-On/Risk-Off Shift)',
      conditionType: 'YIELD_CORRELATION_BREAKOUT',
      targetValue: 0.5,
      comparison: 'ABOVE',
      horizon: 'SWING',
      isActive: true,
      createdAt: '2026-11-01T07:00:00Z',
    },
    {
      id: 'RULE-08',
      name: 'S&P GSCI Commodity vs. Monetary Factor Driver Alert (30D XAU/USD × S&P GSCI)',
      conditionType: 'GSCI_COMMODITY_CORRELATION',
      targetValue: 0.5,
      comparison: 'ABOVE',
      horizon: 'SWING',
      isActive: true,
      createdAt: '2026-11-01T07:10:00Z',
    },
  ]);

  const [notifications, setNotifications] = useState<AlertNotification[]>([
    {
      id: 'NOTIF-01',
      ruleId: 'RULE-02',
      title: 'Pullback Zone Reached',
      message: 'XAU/USD tested $3,892.00 entry zone with high liquidity absorption.',
      severity: 'INFO',
      timestamp: '2026-11-01T06:45:00Z',
      read: true,
    },
    {
      id: 'NOTIF-02',
      ruleId: 'RULE-04',
      title: 'Spread Normalization',
      message: 'Spot Gold spread has tightened to 30 pips; optimal CFD execution condition.',
      severity: 'INFO',
      timestamp: '2026-11-01T07:15:00Z',
      read: false,
    },
  ]);

  const [newName, setNewName] = useState('');
  const [newTarget, setNewTarget] = useState(quote.mid ? Math.round(quote.mid + 15) : 3915.0);
  const [newType, setNewType] = useState<AlertRule['conditionType']>('PRICE_LEVEL');
  const [atrSpikeOverride, setAtrSpikeOverride] = useState<boolean>(false);
  const [dispatchNotice, setDispatchNotice] = useState<string | null>(null);
  const lastDispatchedSigRef = useRef<string | null>(null);

  const [corrDeviationOverride, setCorrDeviationOverride] = useState<boolean>(false);
  const [corrThreshold, setCorrThreshold] = useState<number>(0.2);
  const [corrDispatchNotice, setCorrDispatchNotice] = useState<string | null>(null);
  const lastCorrDispatchedSigRef = useRef<string | null>(null);

  const [yieldBreakoutOverride, setYieldBreakoutOverride] = useState<boolean>(false);
  const [yieldThreshold, setYieldThreshold] = useState<number>(0.5);
  const [yieldDispatchNotice, setYieldDispatchNotice] = useState<string | null>(null);
  const [pushPermission, setPushPermission] = useState<NotificationPermission | 'unsupported'>(() =>
    typeof window !== 'undefined' && 'Notification' in window ? window.Notification.permission : 'unsupported'
  );
  const lastYieldDispatchedSigRef = useRef<string | null>(null);

  const activeUserId = getCurrentSession().uid || 'usr_guest_0000';
  const customRsiStorageKey = `${CUSTOM_RSI_STORAGE_PREFIX}:${activeUserId}`;

  const activeChartTimeframe: Timeframe = chartTimeframe || '1D';
  const [rsiRules, setRsiRules] = useState<CustomRsiAlertConfig[]>(() => {
    const defaultRsiRules: CustomRsiAlertConfig[] = [
      {
        id: 'RSI-01',
        name: 'Overbought Cross: XAU/USD RSI(14) Crosses Above 70',
        period: 14,
        operator: 'CROSS_ABOVE',
        threshold: 70,
        timeframe: activeChartTimeframe,
        isActive: true,
        createdAt: '2026-11-01T07:10:00Z',
      },
      {
        id: 'RSI-02',
        name: 'Oversold Cross: XAU/USD RSI(14) Crosses Below 30',
        period: 14,
        operator: 'CROSS_BELOW',
        threshold: 30,
        timeframe: activeChartTimeframe,
        isActive: true,
        createdAt: '2026-11-01T07:15:00Z',
      },
    ];
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        const saved = window.localStorage.getItem(customRsiStorageKey);
        if (saved) {
          const parsed = JSON.parse(saved);
          if (Array.isArray(parsed) && parsed.length > 0) {
            return parsed;
          }
        }
      }
    } catch {
      // Fallback safely to default RSI presets
    }
    return defaultRsiRules;
  });
  const [rsiRuleName, setRsiRuleName] = useState('');
  const [rsiPeriodInput, setRsiPeriodInput] = useState<number>(14);
  const [rsiOperatorInput, setRsiOperatorInput] = useState<RsiConditionOperator>('CROSS_ABOVE');
  const [rsiThresholdInput, setRsiThresholdInput] = useState<number>(70);
  const [rsiSimMode, setRsiSimMode] = useState<'LIVE' | 'OVERBOUGHT' | 'OVERSOLD'>('LIVE');
  const [rsiDispatchNotice, setRsiDispatchNotice] = useState<string | null>(null);
  const lastRsiDispatchedSigRef = useRef<string | null>(null);

  useEffect(() => {
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        window.localStorage.setItem(customRsiStorageKey, JSON.stringify(rsiRules));
      }
    } catch {
      // Ignore storage quota errors cleanly
    }
  }, [rsiRules, customRsiStorageKey]);

  const [gsciThreshold, setGsciThreshold] = useState<number>(0.5);
  const [gsciAlertMode, setGsciAlertMode] = useState<GsciAlertMode>('ANY_SHIFT');
  const [gsciSimRegime, setGsciSimRegime] = useState<'LIVE' | 'COMMODITY_DRIVEN' | 'MONETARY_DRIVEN'>('LIVE');
  const [gsciDispatchNotice, setGsciDispatchNotice] = useState<string | null>(null);
  const lastGsciDispatchedSigRef = useRef<string | null>(null);

  const atrRule = rules.find((r) => r.id === 'RULE-05');
  const atrAlertEnabled = atrRule ? atrRule.isActive : true;

  const corrRule = rules.find((r) => r.id === 'RULE-06');
  const corrAlertEnabled = corrRule ? corrRule.isActive : true;

  const yieldRule = rules.find((r) => r.id === 'RULE-07');
  const yieldBreakoutEnabled = yieldRule ? yieldRule.isActive : true;

  const gsciRule = rules.find((r) => r.id === 'RULE-08');
  const gsciAlertEnabled = gsciRule ? gsciRule.isActive : true;

  const setGsciAlertEnabled = (enabled: boolean) => {
    setRules((prev) => {
      const exists = prev.some((r) => r.id === 'RULE-08');
      if (exists) {
        return prev.map((r) =>
          r.id === 'RULE-08' ? { ...r, isActive: enabled, targetValue: gsciThreshold } : r
        );
      }
      return [
        ...prev,
        {
          id: 'RULE-08',
          name: `S&P GSCI Commodity vs. Monetary Factor Driver Alert (30D XAU/USD × S&P GSCI > +${gsciThreshold.toFixed(2)})`,
          conditionType: 'GSCI_COMMODITY_CORRELATION',
          targetValue: gsciThreshold,
          comparison: 'ABOVE',
          horizon: 'SWING',
          isActive: enabled,
          createdAt: new Date().toISOString(),
        },
      ];
    });
    if (!enabled) {
      setGsciSimRegime('LIVE');
      setGsciDispatchNotice(
        'S&P GSCI correlation monitor paused. Commodity vs. monetary driver alerts will not fire while disabled.'
      );
    } else {
      setGsciDispatchNotice(null);
    }
  };

  const handleGsciThresholdChange = (rawVal: number) => {
    const safeVal = Number.isFinite(rawVal) ? Math.max(0.2, Math.min(0.95, Number(rawVal.toFixed(2)))) : 0.5;
    setGsciThreshold(safeVal);
    setRules((prev) =>
      prev.map((r) =>
        r.id === 'RULE-08'
          ? {
              ...r,
              targetValue: safeVal,
              name: `S&P GSCI Commodity vs. Monetary Factor Driver Alert (30D XAU/USD × S&P GSCI > +${safeVal.toFixed(2)})`,
            }
          : r
      )
    );
  };

  const setAtrAlertEnabled = (enabled: boolean) => {
    setRules((prev) => {
      const exists = prev.some((r) => r.id === 'RULE-05');
      if (exists) {
        return prev.map((r) => (r.id === 'RULE-05' ? { ...r, isActive: enabled } : r));
      }
      return [
        ...prev,
        {
          id: 'RULE-05',
          name: 'ATR Volatility Alert: XAU/USD Exceeds 14D ATR by >2.5 Std Dev',
          conditionType: 'ATR_VOLATILITY',
          targetValue: 2.5,
          comparison: 'ABOVE',
          horizon: 'INTRADAY',
          isActive: enabled,
          createdAt: new Date().toISOString(),
        },
      ];
    });
    if (!enabled) {
      setAtrSpikeOverride(false);
      setDispatchNotice('ATR Volatility Alert paused. Automated >2.5σ notifications will not fire while disabled.');
    } else {
      setDispatchNotice(null);
    }
  };

  const setCorrAlertEnabled = (enabled: boolean) => {
    setRules((prev) => {
      const exists = prev.some((r) => r.id === 'RULE-06');
      if (exists) {
        return prev.map((r) =>
          r.id === 'RULE-06' ? { ...r, isActive: enabled, targetValue: corrThreshold } : r
        );
      }
      return [
        ...prev,
        {
          id: 'RULE-06',
          name: `Correlation Deviation Alert: 30D XAU/USD × DXY |Δr| > ${corrThreshold.toFixed(2)} vs Historical Norm (-0.74)`,
          conditionType: 'CORRELATION_DEVIATION',
          targetValue: corrThreshold,
          comparison: 'ABOVE',
          horizon: 'SWING',
          isActive: enabled,
          createdAt: new Date().toISOString(),
        },
      ];
    });
    if (!enabled) {
      setCorrDeviationOverride(false);
      setCorrDispatchNotice(
        `XAU/USD × DXY Correlation Deviation Alert paused. Automated |Δr| > ${corrThreshold.toFixed(2)} notifications will not fire while disabled.`
      );
    } else {
      setCorrDispatchNotice(null);
    }
  };

  const handleCorrThresholdChange = (rawVal: number) => {
    const safeVal = Number.isFinite(rawVal) ? Math.max(0.05, Math.min(1.0, Number(rawVal.toFixed(2)))) : 0.2;
    setCorrThreshold(safeVal);
    setRules((prev) =>
      prev.map((r) =>
        r.id === 'RULE-06'
          ? {
              ...r,
              targetValue: safeVal,
              name: `Correlation Deviation Alert: 30D XAU/USD × DXY |Δr| > ${safeVal.toFixed(2)} vs Historical Norm (-0.74)`,
            }
          : r
      )
    );
  };

  const setYieldBreakoutAlertEnabled = (enabled: boolean) => {
    setRules((prev) => {
      const exists = prev.some((r) => r.id === 'RULE-07');
      if (exists) {
        return prev.map((r) =>
          r.id === 'RULE-07' ? { ...r, isActive: enabled, targetValue: yieldThreshold } : r
        );
      }
      return [
        ...prev,
        {
          id: 'RULE-07',
          name: `Regime Shift Push Alert: 30D XAU/USD × 10Y Yield Correlation > +${yieldThreshold.toFixed(2)} (Risk-On/Risk-Off Shift)`,
          conditionType: 'YIELD_CORRELATION_BREAKOUT',
          targetValue: yieldThreshold,
          comparison: 'ABOVE',
          horizon: 'SWING',
          isActive: enabled,
          createdAt: new Date().toISOString(),
        },
      ];
    });

    if (enabled && typeof window !== 'undefined' && 'Notification' in window) {
      try {
        if (window.Notification.permission === 'default') {
          void window.Notification.requestPermission().then((perm) => setPushPermission(perm));
        } else {
          setPushPermission(window.Notification.permission);
        }
      } catch {
        // Ignore restricted iframe notification APIs
      }
    }

    if (!enabled) {
      setYieldBreakoutOverride(false);
      setYieldDispatchNotice(
        `XAU/USD × 10Y Yield push notifications paused. Alerts above +${yieldThreshold.toFixed(2)} will not dispatch while muted.`
      );
    } else {
      setYieldDispatchNotice(null);
    }
  };

  const handleYieldThresholdChange = (rawVal: number) => {
    const safeVal = Number.isFinite(rawVal) ? Math.max(0.1, Math.min(0.95, Number(rawVal.toFixed(2)))) : 0.5;
    setYieldThreshold(safeVal);
    setRules((prev) =>
      prev.map((r) =>
        r.id === 'RULE-07'
          ? {
              ...r,
              targetValue: safeVal,
              name: `Regime Shift Push Alert: 30D XAU/USD × 10Y Yield Correlation > +${safeVal.toFixed(2)} (Risk-On/Risk-Off Shift)`,
            }
          : r
      )
    );
  };

  const baselineDailyCandles = useMemo(() => {
    if (Array.isArray(dailyCandles) && dailyCandles.length >= 20) {
      return dailyCandles;
    }
    return generateCandleHistory('1D', 60, quote.mid || 3898.9);
  }, [dailyCandles, quote.mid]);

  const activeChartCandles = useMemo(() => {
    if (Array.isArray(chartCandles) && chartCandles.length >= 20) {
      return chartCandles;
    }
    if (activeChartTimeframe === '1D') {
      return baselineDailyCandles;
    }
    return generateCandleHistory(activeChartTimeframe, 80, quote.mid || 3898.9);
  }, [chartCandles, activeChartTimeframe, baselineDailyCandles, quote.mid]);

  const rsiEvaluation = useMemo(() => {
    const overrideRsiPair =
      rsiSimMode === 'OVERBOUGHT'
        ? { previousRsi: 67.4, currentRsi: 72.8 }
        : rsiSimMode === 'OVERSOLD'
        ? { previousRsi: 32.1, currentRsi: 27.5 }
        : undefined;

    return evaluateCustomRsiAlerts(activeChartCandles, rsiRules, activeChartTimeframe, {
      primaryPeriod: rsiPeriodInput,
      overrideRsiPair,
    });
  }, [activeChartCandles, rsiRules, activeChartTimeframe, rsiPeriodInput, rsiSimMode]);

  const atrEvaluation = useMemo(() => {
    const baseEval = evaluateAtrVolatilityBreakout(baselineDailyCandles, quote, 2.5);
    if (!atrSpikeOverride) {
      return baseEval;
    }
    const spikeMove = Number((baseEval.atr14 + 3.25 * Math.max(baseEval.trueRangeStdDev14, 1)).toFixed(2));
    const lastBar = baselineDailyCandles[baselineDailyCandles.length - 1];
    const spikedCandles: Candle[] = [
      ...baselineDailyCandles.slice(0, -1),
      {
        ...lastBar,
        high: Number((lastBar.open + spikeMove).toFixed(2)),
        low: lastBar.open,
        close: Number((lastBar.open + spikeMove * 0.92).toFixed(2)),
      },
    ];
    return evaluateAtrVolatilityBreakout(
      spikedCandles,
      { ...quote, mid: Number((quote.open24h + spikeMove).toFixed(2)) },
      2.5
    );
  }, [baselineDailyCandles, quote, atrSpikeOverride]);

  const dispatchAtrNotification = useCallback(
    async (evalSnapshot: ReturnType<typeof evaluateAtrVolatilityBreakout>, isSimulatedSpike: boolean) => {
      const nowIso = new Date().toISOString();
      const notifId = `NOTIF-ATR-${Date.now()}`;
      const newNotification: AlertNotification = {
        id: notifId,
        ruleId: 'RULE-05',
        title: `ATR Volatility Breakout (${evalSnapshot.zScoreSigma > 0 ? '+' : ''}${evalSnapshot.zScoreSigma.toFixed(2)}σ)`,
        message: evalSnapshot.summary,
        severity: evalSnapshot.severity,
        timestamp: nowIso,
        read: false,
      };

      setNotifications((prev) => [newNotification, ...prev]);
      setRules((prev) =>
        prev.map((r) => (r.id === 'RULE-05' ? { ...r, lastTriggered: nowIso } : r))
      );

      try {
        const res = await fetch('/api/alerts/atr-volatility', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            simulateSpike: isSimulatedSpike,
            stdDevThreshold: 2.5,
            overridePriceMove: evalSnapshot.currentPriceMove,
          }),
        });
        const data = await res.json();
        const deliveredChannels = Array.isArray(data?.deliveryLogs)
          ? data.deliveryLogs.filter((l: any) => l.status === 'DELIVERED').length
          : 0;
        setDispatchNotice(
          deliveredChannels > 0
            ? `Automated alert recorded in Feed Log and dispatched to ${deliveredChannels} external notification channel(s).`
            : 'Automated ATR Volatility Alert recorded in Triggered Advisory Events log.'
        );
      } catch {
        setDispatchNotice('Automated ATR Volatility Alert recorded in Triggered Advisory Events log.');
      }
    },
    []
  );

  // Automatic real-time trigger whenever ATR Volatility Alert toggle is armed and XAU/USD > 14D ATR + 2.5σ
  useEffect(() => {
    if (!atrAlertEnabled || !atrEvaluation.isBreached) {
      lastDispatchedSigRef.current = null;
      return;
    }
    const sig = `${atrEvaluation.zScoreSigma.toFixed(2)}_${atrEvaluation.currentPriceMove.toFixed(2)}_${atrSpikeOverride ? 'SIM' : 'LIVE'}`;
    if (lastDispatchedSigRef.current === sig) {
      return;
    }
    lastDispatchedSigRef.current = sig;
    void dispatchAtrNotification(atrEvaluation, atrSpikeOverride);
  }, [atrAlertEnabled, atrEvaluation, atrSpikeOverride, dispatchAtrNotification]);

  const effectiveQuotesForCorr = useMemo(
    () => ({
      ...(quotes || {}),
      XAUUSD: quote,
    }),
    [quotes, quote]
  );

  const corrEvaluation = useMemo(() => {
    if (!corrDeviationOverride) {
      return evaluateXauDxyCorrelationDeviationAlert(effectiveQuotesForCorr, baselineDailyCandles, {
        deviationThreshold: corrThreshold,
      });
    }
    const simulatedCorr = -0.32; // | -0.32 - (-0.74) | = 0.42 > 0.20
    return evaluateXauDxyCorrelationDeviationAlert(effectiveQuotesForCorr, baselineDailyCandles, {
      deviationThreshold: corrThreshold,
      overrideRolling30dCorr: simulatedCorr,
    });
  }, [effectiveQuotesForCorr, baselineDailyCandles, corrThreshold, corrDeviationOverride]);

  const dispatchCorrNotification = useCallback(
    async (evalSnapshot: CorrelationDeviationAlertEvaluation, isSimulatedDeviation: boolean) => {
      const nowIso = new Date().toISOString();
      const notifId = `NOTIF-CORR-${Date.now()}`;
      const newNotification: AlertNotification = {
        id: notifId,
        ruleId: 'RULE-06',
        title: `XAU/USD × DXY Correlation Deviation (|Δr| ${evalSnapshot.absoluteDeviation.toFixed(2)})`,
        message: evalSnapshot.summary,
        severity: evalSnapshot.severity,
        timestamp: nowIso,
        read: false,
      };

      setNotifications((prev) => [newNotification, ...prev]);
      setRules((prev) =>
        prev.map((r) => (r.id === 'RULE-06' ? { ...r, lastTriggered: nowIso } : r))
      );

      try {
        const res = await fetch('/api/alerts/correlation-deviation', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            simulateDeviation: isSimulatedDeviation,
            deviationThreshold: evalSnapshot.deviationThreshold,
            overrideRollingCorr: evalSnapshot.rolling30dCorrelation,
          }),
        });
        const data = await res.json();
        const deliveredChannels = Array.isArray(data?.deliveryLogs)
          ? data.deliveryLogs.filter((l: any) => l.status === 'DELIVERED').length
          : 0;
        setCorrDispatchNotice(
          deliveredChannels > 0
            ? `Automated correlation alert logged and dispatched to ${deliveredChannels} external notification channel(s).`
            : 'Automated XAU/USD × DXY Correlation Deviation Alert recorded in Triggered Advisory Events log.'
        );
      } catch {
        setCorrDispatchNotice(
          'Automated XAU/USD × DXY Correlation Deviation Alert recorded in Triggered Advisory Events log.'
        );
      }
    },
    []
  );

  // Automatic real-time trigger whenever Correlation Deviation Alert is armed and 30D |Δr| > threshold
  useEffect(() => {
    if (!corrAlertEnabled || !corrEvaluation.isDeviating) {
      lastCorrDispatchedSigRef.current = null;
      return;
    }
    const sig = `${corrEvaluation.rolling30dCorrelation.toFixed(2)}_${corrEvaluation.deviationThreshold.toFixed(2)}_${corrDeviationOverride ? 'SIM' : 'LIVE'}`;
    if (lastCorrDispatchedSigRef.current === sig) {
      return;
    }
    lastCorrDispatchedSigRef.current = sig;
    void dispatchCorrNotification(corrEvaluation, corrDeviationOverride);
  }, [corrAlertEnabled, corrEvaluation, corrDeviationOverride, dispatchCorrNotification]);

  const yieldEvaluation = useMemo(() => {
    return evaluateXauYieldCorrelationBreakoutAlert(effectiveQuotesForCorr, baselineDailyCandles, {
      correlationThreshold: yieldThreshold,
      overrideRolling30dCorr: yieldBreakoutOverride ? 0.62 : undefined,
    });
  }, [effectiveQuotesForCorr, baselineDailyCandles, yieldThreshold, yieldBreakoutOverride]);

  const dispatchYieldBreakoutNotification = useCallback(
    async (evalSnapshot: YieldCorrelationBreakoutAlertEvaluation, isSimulatedBreakout: boolean) => {
      const nowIso = new Date().toISOString();
      const notifId = `NOTIF-YIELD-CORR-${Date.now()}`;
      const newNotification: AlertNotification = {
        id: notifId,
        ruleId: 'RULE-07',
        title: `Risk-On/Off Shift: XAU/USD × 10Y Yield r=${evalSnapshot.rolling30dCorrelation >= 0 ? '+' : ''}${evalSnapshot.rolling30dCorrelation.toFixed(2)}`,
        message: evalSnapshot.summary,
        severity: evalSnapshot.severity,
        timestamp: nowIso,
        read: false,
      };

      setNotifications((prev) => [newNotification, ...prev]);
      setRules((prev) =>
        prev.map((r) => (r.id === 'RULE-07' ? { ...r, lastTriggered: nowIso } : r))
      );

      let browserPushed = false;
      if (typeof window !== 'undefined' && 'Notification' in window && window.Notification.permission === 'granted') {
        try {
          new window.Notification(newNotification.title, {
            body: evalSnapshot.summary,
            tag: 'xau-us10y-regime-shift',
          });
          browserPushed = true;
        } catch {
          // Ignore Notification constructor errors in restricted iframe sandboxes
        }
      }

      try {
        const res = await fetch('/api/alerts/yield-correlation-breakout', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            simulateBreakout: isSimulatedBreakout,
            correlationThreshold: evalSnapshot.correlationThreshold,
            overrideRollingCorr: evalSnapshot.rolling30dCorrelation,
          }),
        });
        const data = await res.json();
        const deliveredChannels = Array.isArray(data?.deliveryLogs)
          ? data.deliveryLogs.filter((l: any) => l.status === 'DELIVERED').length
          : 0;
        if (browserPushed || deliveredChannels > 0) {
          setYieldDispatchNotice(
            `Push notification dispatched (${[
              browserPushed ? 'Browser Push' : null,
              deliveredChannels > 0 ? `${deliveredChannels} Webhook Channel(s)` : null,
            ]
              .filter(Boolean)
              .join(' & ')}).`
          );
        } else {
          setYieldDispatchNotice(
            'Risk-On/Off regime shift push alert recorded in Triggered Advisory Events log.'
          );
        }
      } catch {
        setYieldDispatchNotice(
          browserPushed
            ? 'Browser push notification dispatched and recorded in Triggered Advisory Events log.'
            : 'Risk-On/Off regime shift alert recorded in Triggered Advisory Events log.'
        );
      }
    },
    []
  );

  // Automatic push notification trigger whenever toggle is armed and 30D XAU/USD x 10Y Yield > threshold (+0.50)
  useEffect(() => {
    if (!yieldBreakoutEnabled || !yieldEvaluation.isBrokenAbove) {
      lastYieldDispatchedSigRef.current = null;
      return;
    }
    const sig = `${yieldEvaluation.rolling30dCorrelation.toFixed(2)}_${yieldEvaluation.correlationThreshold.toFixed(2)}_${yieldBreakoutOverride ? 'SIM' : 'LIVE'}`;
    if (lastYieldDispatchedSigRef.current === sig) {
      return;
    }
    lastYieldDispatchedSigRef.current = sig;
    void dispatchYieldBreakoutNotification(yieldEvaluation, yieldBreakoutOverride);
  }, [yieldBreakoutEnabled, yieldEvaluation, yieldBreakoutOverride, dispatchYieldBreakoutNotification]);

  const gsciEvaluation = useMemo(() => {
    const overrideCorr =
      gsciSimRegime === 'COMMODITY_DRIVEN'
        ? 0.74
        : gsciSimRegime === 'MONETARY_DRIVEN'
        ? 0.08
        : undefined;
    const overrideMonetary =
      gsciSimRegime === 'COMMODITY_DRIVEN'
        ? 0.24
        : gsciSimRegime === 'MONETARY_DRIVEN'
        ? 0.78
        : undefined;

    return evaluateXauGsciCorrelationAlert(effectiveQuotesForCorr, baselineDailyCandles, {
      commodityThreshold: gsciThreshold,
      monetaryThreshold: 0.2,
      alertMode: gsciAlertMode,
      overrideRolling30dCorr: overrideCorr,
      overrideMonetaryMagnitude: overrideMonetary,
    });
  }, [effectiveQuotesForCorr, baselineDailyCandles, gsciThreshold, gsciAlertMode, gsciSimRegime]);

  const dispatchGsciNotification = useCallback(
    async (
      evalSnapshot: GsciCorrelationAlertEvaluation,
      simRegime: 'LIVE' | 'COMMODITY_DRIVEN' | 'MONETARY_DRIVEN'
    ) => {
      const nowIso = new Date().toISOString();
      const notifId = `NOTIF-GSCI-${Date.now()}`;
      const driverTitle =
        evalSnapshot.driverRegime === 'GENERAL_COMMODITIES'
          ? 'General Commodities Driven'
          : 'Specific Monetary Driven';
      const newNotification: AlertNotification = {
        id: notifId,
        ruleId: 'RULE-08',
        title: `S&P GSCI Driver Alert: ${driverTitle} (r=${evalSnapshot.rolling30dGsciCorrelation >= 0 ? '+' : ''}${evalSnapshot.rolling30dGsciCorrelation.toFixed(2)})`,
        message: evalSnapshot.summary,
        severity: evalSnapshot.severity,
        timestamp: nowIso,
        read: false,
      };

      setNotifications((prev) => [newNotification, ...prev]);
      setRules((prev) =>
        prev.map((r) => (r.id === 'RULE-08' ? { ...r, lastTriggered: nowIso } : r))
      );

      try {
        const res = await fetch('/api/alerts/gsci-correlation', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            simulateRegime: simRegime === 'LIVE' ? undefined : simRegime,
            commodityThreshold: evalSnapshot.commodityThreshold,
            monetaryThreshold: evalSnapshot.monetaryThreshold,
            alertMode: evalSnapshot.alertMode,
            overrideRollingCorr: evalSnapshot.rolling30dGsciCorrelation,
            overrideMonetaryMagnitude: evalSnapshot.rolling30dMonetaryMagnitude,
          }),
        });
        const data = await res.json();
        const deliveredChannels = Array.isArray(data?.deliveryLogs)
          ? data.deliveryLogs.filter((l: any) => l.status === 'DELIVERED').length
          : 0;
        setGsciDispatchNotice(
          deliveredChannels > 0
            ? `S&P GSCI driver alert logged and dispatched to ${deliveredChannels} external webhook channel(s).`
            : 'S&P GSCI Commodity vs. Monetary driver shift recorded in Triggered Advisory Events log.'
        );
      } catch {
        setGsciDispatchNotice(
          'S&P GSCI Commodity vs. Monetary driver shift recorded in Triggered Advisory Events log.'
        );
      }
    },
    []
  );

  useEffect(() => {
    if (!gsciAlertEnabled || !gsciEvaluation.isTriggered) {
      lastGsciDispatchedSigRef.current = null;
      return;
    }
    const sig = `${gsciEvaluation.rolling30dGsciCorrelation.toFixed(2)}_${gsciEvaluation.alertMode}_${gsciThreshold.toFixed(2)}_${gsciSimRegime}`;
    if (lastGsciDispatchedSigRef.current === sig) {
      return;
    }
    lastGsciDispatchedSigRef.current = sig;
    void dispatchGsciNotification(gsciEvaluation, gsciSimRegime);
  }, [gsciAlertEnabled, gsciEvaluation, gsciThreshold, gsciSimRegime, dispatchGsciNotification]);

  const dispatchRsiAlertNotification = useCallback(
    async (triggered: RsiRuleEvaluation, timeframe: Timeframe, simMode: 'LIVE' | 'OVERBOUGHT' | 'OVERSOLD') => {
      const nowIso = new Date().toISOString();
      const notifId = `NOTIF-RSI-${triggered.ruleId}-${Date.now()}`;
      const newNotification: AlertNotification = {
        id: notifId,
        ruleId: triggered.ruleId,
        title: `XAU/USD (${timeframe}) RSI(${triggered.period}) Alert (${triggered.currentRsi.toFixed(1)})`,
        message: triggered.summary,
        severity: triggered.severity,
        timestamp: nowIso,
        read: false,
      };

      setNotifications((prev) => [newNotification, ...prev]);
      setRsiRules((prev) =>
        prev.map((r) => (r.id === triggered.ruleId ? { ...r, lastTriggered: nowIso } : r))
      );

      if (typeof window !== 'undefined' && 'Notification' in window && window.Notification.permission === 'granted') {
        try {
          new window.Notification(newNotification.title, {
            body: triggered.summary,
            tag: `xau-rsi-${triggered.ruleId}`,
          });
        } catch {
          // Ignore sandbox Notification errors
        }
      }

      try {
        const res = await fetch('/api/alerts/rsi-threshold', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            ruleId: triggered.ruleId,
            ruleName: triggered.ruleName,
            period: triggered.period,
            operator: triggered.operator,
            threshold: triggered.threshold,
            timeframe,
            simulateDirection: simMode === 'LIVE' ? undefined : simMode,
            overridePreviousRsi: triggered.previousRsi,
            overrideCurrentRsi: triggered.currentRsi,
          }),
        });
        const data = await res.json();
        const deliveredChannels = Array.isArray(data?.deliveryLogs)
          ? data.deliveryLogs.filter((l: any) => l.status === 'DELIVERED').length
          : 0;
        setRsiDispatchNotice(
          deliveredChannels > 0
            ? `RSI(${triggered.period}) trigger logged & dispatched to ${deliveredChannels} external webhook channel(s).`
            : `RSI(${triggered.period}) crossover alert recorded in Triggered Advisory Events log.`
        );
      } catch {
        setRsiDispatchNotice(`RSI(${triggered.period}) crossover alert recorded in Triggered Advisory Events log.`);
      }
    },
    []
  );

  // Automatic RSI threshold evaluation against the active XAU/USD chart candles
  useEffect(() => {
    if (rsiEvaluation.triggeredRules.length === 0) {
      lastRsiDispatchedSigRef.current = null;
      return;
    }
    const primaryTrig = rsiEvaluation.triggeredRules[0];
    const sig = `${primaryTrig.ruleId}_${primaryTrig.currentRsi.toFixed(2)}_${primaryTrig.threshold}_${activeChartTimeframe}_${rsiSimMode}`;
    if (lastRsiDispatchedSigRef.current === sig) {
      return;
    }
    lastRsiDispatchedSigRef.current = sig;
    void dispatchRsiAlertNotification(primaryTrig, activeChartTimeframe, rsiSimMode);
  }, [rsiEvaluation, activeChartTimeframe, rsiSimMode, dispatchRsiAlertNotification]);

  const operatorDisplayLabel: Record<RsiConditionOperator, string> = {
    CROSS_ABOVE: 'Crosses Above',
    CROSS_BELOW: 'Crosses Below',
    ABOVE: 'Stays Above',
    BELOW: 'Stays Below',
  };

  const handleCreateCustomRsiAlert = (
    e?: React.FormEvent,
    preset?: { name: string; period: number; operator: RsiConditionOperator; threshold: number }
  ) => {
    if (e) e.preventDefault();
    const safePeriod = Math.max(2, Math.min(50, Math.round(preset?.period ?? (Number(rsiPeriodInput) || 14))));
    const safeThreshold = Math.max(1, Math.min(99, Number((preset?.threshold ?? (Number(rsiThresholdInput) || 70)).toFixed(1))));
    const op = preset?.operator ?? rsiOperatorInput;
    const autoLabel = `XAU/USD (${activeChartTimeframe}) RSI(${safePeriod}) ${operatorDisplayLabel[op]} ${safeThreshold}`;
    const label = (preset?.name ?? rsiRuleName).trim() || autoLabel;
    const nextId = `RSI-${String(rsiRules.length + 1).padStart(2, '0')}`;

    const newRsiRule: CustomRsiAlertConfig = {
      id: nextId,
      name: label,
      period: safePeriod,
      operator: op,
      threshold: safeThreshold,
      timeframe: activeChartTimeframe,
      isActive: true,
      createdAt: new Date().toISOString(),
    };

    setRsiRules((prev) => [newRsiRule, ...prev]);
    setRsiRuleName('');
    setRsiDispatchNotice(
      `Created active rule ${nextId}: Monitoring XAU/USD (${activeChartTimeframe}) RSI(${safePeriod}) ${operatorDisplayLabel[op].toLowerCase()} ${safeThreshold}.`
    );
  };

  const toggleRsiRule = (id: string) => {
    setRsiRules((prev) => prev.map((r) => (r.id === id ? { ...r, isActive: !r.isActive } : r)));
  };

  const deleteRsiRule = (id: string) => {
    setRsiRules((prev) => prev.filter((r) => r.id !== id));
  };

  const handleAddRule = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName) return;
    const rule: AlertRule = {
      id: `RULE-0${rules.length + 1}`,
      name: newName,
      conditionType: newType,
      targetValue: Number(newTarget),
      comparison: newType === 'RSI_THRESHOLD' && Number(newTarget) <= 45 ? 'BELOW' : 'ABOVE',
      horizon: 'SWING',
      isActive: true,
      createdAt: new Date().toISOString(),
    };
    setRules([...rules, rule]);
    if (newType === 'RSI_THRESHOLD') {
      const safeThreshold = Math.max(1, Math.min(99, Number(newTarget) || 70));
      setRsiRules((prev) => [
        {
          id: `RSI-${String(prev.length + 1).padStart(2, '0')}`,
          name: newName,
          period: 14,
          operator: safeThreshold <= 45 ? 'CROSS_BELOW' : 'CROSS_ABOVE',
          threshold: safeThreshold,
          timeframe: activeChartTimeframe,
          isActive: true,
          createdAt: new Date().toISOString(),
        },
        ...prev,
      ]);
    }
    setNewName('');
  };

  const toggleRule = (id: string) => {
    setRules(rules.map((r) => (r.id === id ? { ...r, isActive: !r.isActive } : r)));
  };

  const deleteRule = (id: string) => {
    setRules(rules.filter((r) => r.id !== id));
  };

  const markNotificationRead = (id: string) => {
    setNotifications((prev) => prev.map((n) => (n.id === id ? { ...n, read: true } : n)));
  };

  return (
    <div className="space-y-6">
      {/* Top Data Quality & Health Bar */}
      <div className="bg-slate-900 border border-slate-800 rounded-lg p-5">
        <div className="flex flex-wrap items-center justify-between gap-4 pb-3 border-b border-slate-800">
          <div>
            <span className="text-xs font-mono text-amber-400 uppercase tracking-wider block">
              Data Lineage & Health Engine
            </span>
            <h2 className="text-lg font-bold text-slate-100 mt-0.5">
              Live Feed Health & Real-Time Alert Evaluation
            </h2>
          </div>
          <span className="text-xs font-mono text-emerald-400 bg-emerald-500/10 px-3 py-1 rounded border border-emerald-500/20 flex items-center gap-1.5">
            <CheckCircle2 className="w-4 h-4" /> All Feeds Operational
          </span>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-4 text-xs font-mono">
          <div className="bg-slate-950 p-3 rounded border border-slate-800">
            <span className="text-slate-500 block text-[10px]">PRIMARY FEED PROVIDER</span>
            <span className="text-slate-200 font-bold">{quote.provider}</span>
          </div>
          <div className="bg-slate-950 p-3 rounded border border-slate-800">
            <span className="text-slate-500 block text-[10px]">FEED LATENCY</span>
            <span className="text-emerald-400 font-bold">{quote.latencyMs} ms</span>
          </div>
          <div className="bg-slate-950 p-3 rounded border border-slate-800">
            <span className="text-slate-500 block text-[10px]">DATA QUALITY STATE</span>
            <span className="text-emerald-400 font-bold">{quote.quality}</span>
          </div>
          <div className="bg-slate-950 p-3 rounded border border-slate-800">
            <span className="text-slate-500 block text-[10px]">CURRENT SPREAD</span>
            <span className="text-amber-400 font-bold">{quote.spreadPips} pips (${quote.spread.toFixed(2)})</span>
          </div>
        </div>
      </div>

      {/* ATR Volatility Alert Guard (>2.5 Std Dev over 14-Day ATR) */}
      <section
        aria-label="ATR Volatility Alert"
        className="bg-slate-900 border border-slate-800 rounded-lg p-5 space-y-4"
      >
        <div className="flex flex-wrap items-center justify-between gap-4 pb-3 border-b border-slate-800">
          <div>
            <h3 className="text-base font-bold text-slate-100 flex items-center gap-2">
              <Activity className="w-4 h-4 text-amber-400 shrink-0" aria-hidden="true" />
              <span>ATR Volatility Alert</span>
            </h3>
            <div className="flex flex-wrap items-center gap-2 text-xs text-slate-400 mt-1">
              <span>XAU/USD 14-Day ATR Guard</span>
              <span aria-hidden="true">·</span>
              <span className="font-mono tabular-nums">&gt;2.5σ True Range Threshold</span>
              <span aria-hidden="true">·</span>
              <span>Automated Notification Dispatch</span>
            </div>
          </div>

          <div className="flex items-center gap-2.5">
            <button
              type="button"
              onClick={() => setAtrSpikeOverride((prev) => !prev)}
              disabled={!atrAlertEnabled}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-medium transition-colors whitespace-nowrap shrink-0 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed ${
                atrSpikeOverride
                  ? 'bg-rose-500/20 text-rose-200 border-rose-500/40'
                  : 'bg-slate-950 text-slate-300 border-slate-700 hover:border-slate-500'
              }`}
              title="Test automated >2.5σ breakout notification pipeline"
            >
              <Zap className="w-3.5 h-3.5 text-amber-400" aria-hidden="true" />
              <span>{atrSpikeOverride ? 'Reset Live Telemetry' : 'Test >2.5σ Spike'}</span>
            </button>

            <button
              type="button"
              role="switch"
              aria-checked={atrAlertEnabled}
              aria-label="ATR Volatility Alert"
              onClick={() => setAtrAlertEnabled(!atrAlertEnabled)}
              className={`inline-flex items-center gap-2.5 px-3.5 py-1.5 rounded-lg border text-xs font-semibold transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                atrAlertEnabled
                  ? 'bg-emerald-500/15 text-emerald-300 border-emerald-500/40'
                  : 'bg-slate-950 text-slate-400 border-slate-700 hover:text-slate-200'
              }`}
            >
              <span
                className={`relative inline-flex h-4 w-7 items-center rounded-full transition-colors ${
                  atrAlertEnabled ? 'bg-emerald-500' : 'bg-slate-700'
                }`}
              >
                <span
                  className={`inline-block h-3 w-3 transform rounded-full bg-slate-950 transition-transform ${
                    atrAlertEnabled ? 'translate-x-3.5' : 'translate-x-0.5'
                  }`}
                />
              </span>
              <span>{atrAlertEnabled ? 'Armed (Auto-Notify)' : 'Paused'}</span>
            </button>
          </div>
        </div>

        {/* 14-Day ATR Telemetry Grid */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 text-xs font-mono tabular-nums">
          <div className="bg-slate-950/70 p-3 rounded-lg border border-slate-800">
            <div className="text-[11px] text-slate-400">14-Day ATR (XAU/USD)</div>
            <div className="text-base font-bold text-slate-100 mt-0.5">
              ${atrEvaluation.atr14.toFixed(2)}
            </div>
            <div className="text-[11px] text-slate-500 mt-0.5">
              14D Mean TR: ${atrEvaluation.trueRangeMean14.toFixed(2)}
            </div>
          </div>

          <div className="bg-slate-950/70 p-3 rounded-lg border border-slate-800">
            <div className="text-[11px] text-slate-400">2.5σ Breakout Trigger</div>
            <div className="text-base font-bold text-amber-400 mt-0.5">
              ${atrEvaluation.thresholdPriceMove.toFixed(2)}
            </div>
            <div className="text-[11px] text-slate-500 mt-0.5">
              TR σ: ±${atrEvaluation.trueRangeStdDev14.toFixed(2)}
            </div>
          </div>

          <div className="bg-slate-950/70 p-3 rounded-lg border border-slate-800">
            <div className="text-[11px] text-slate-400">Current Session Range</div>
            <div
              className={`text-base font-bold mt-0.5 ${
                atrEvaluation.isBreached ? 'text-rose-400' : 'text-slate-100'
              }`}
            >
              ${atrEvaluation.currentPriceMove.toFixed(2)}
            </div>
            <div className="text-[11px] text-slate-500 mt-0.5">
              Spot Mid: ${quote.mid.toFixed(2)}
            </div>
          </div>

          <div className="bg-slate-950/70 p-3 rounded-lg border border-slate-800">
            <div className="text-[11px] text-slate-400">Volatility Dispersion</div>
            <div
              className={`text-base font-bold mt-0.5 ${
                atrEvaluation.isBreached ? 'text-rose-400' : 'text-emerald-400'
              }`}
            >
              {atrEvaluation.zScoreSigma >= 0 ? '+' : ''}
              {atrEvaluation.zScoreSigma.toFixed(2)}σ
            </div>
            <div className="text-[11px] text-slate-400 mt-0.5">
              {atrEvaluation.isBreached ? 'Breakout (>2.5σ)' : 'Within Normal Band'}
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-slate-300">
          <span>{atrEvaluation.summary}</span>
          {dispatchNotice && (
            <span className="font-mono text-[11px] text-amber-300">{dispatchNotice}</span>
          )}
        </div>
      </section>

      {/* Rolling 30-Day XAU/USD × DXY Correlation Deviation Alert (|Δr| > 0.20) */}
      <section
        aria-label="XAU/USD DXY Correlation Deviation Alert"
        className="bg-slate-900 border border-slate-800 rounded-lg p-5 space-y-4"
      >
        <div className="flex flex-wrap items-center justify-between gap-4 pb-3 border-b border-slate-800">
          <div>
            <h3 className="text-base font-bold text-slate-100 flex items-center gap-2">
              <GitCompare className="w-4 h-4 text-sky-400 shrink-0" aria-hidden="true" />
              <span>Rolling 30-Day Correlation Deviation Alert (XAU/USD × DXY)</span>
            </h3>
            <div className="flex flex-wrap items-center gap-2 text-xs text-slate-400 mt-1">
              <span>5Y Historical Norm: {corrEvaluation.historicalNorm.toFixed(2)}</span>
              <span aria-hidden="true">·</span>
              <span className="font-mono tabular-nums">
                Trigger: |Δr| &gt; {corrThreshold.toFixed(2)}
              </span>
              <span aria-hidden="true">·</span>
              <span>Automated Macro Regime Notification</span>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            <label className="inline-flex items-center gap-1.5 text-xs font-mono text-slate-300 bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-1">
              <span className="text-slate-400">Threshold |Δr|:</span>
              <input
                type="number"
                step="0.05"
                min="0.05"
                max="1.0"
                aria-label="Correlation deviation threshold"
                value={corrThreshold}
                onChange={(e) => handleCorrThresholdChange(Number(e.target.value))}
                className="w-16 bg-slate-900 border border-slate-700 rounded px-1.5 py-0.5 text-right text-slate-100 font-mono tabular-nums"
              />
            </label>

            <button
              type="button"
              onClick={() => setCorrDeviationOverride((prev) => !prev)}
              disabled={!corrAlertEnabled}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-medium transition-colors whitespace-nowrap shrink-0 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed ${
                corrDeviationOverride
                  ? 'bg-rose-500/20 text-rose-200 border-rose-500/40'
                  : 'bg-slate-950 text-slate-300 border-slate-700 hover:border-slate-500'
              }`}
              title="Simulate a >0.20 correlation decoupling vs historical norm"
            >
              <Zap className="w-3.5 h-3.5 text-amber-400" aria-hidden="true" />
              <span>
                {corrDeviationOverride
                  ? 'Reset Live Correlation'
                  : `Test >${corrThreshold.toFixed(2)} Deviation`}
              </span>
            </button>

            <button
              type="button"
              role="switch"
              aria-checked={corrAlertEnabled}
              aria-label="XAU/USD DXY Correlation Deviation Alert"
              onClick={() => setCorrAlertEnabled(!corrAlertEnabled)}
              className={`inline-flex items-center gap-2.5 px-3.5 py-1.5 rounded-lg border text-xs font-semibold transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                corrAlertEnabled
                  ? 'bg-emerald-500/15 text-emerald-300 border-emerald-500/40'
                  : 'bg-slate-950 text-slate-400 border-slate-700 hover:text-slate-200'
              }`}
            >
              <span
                className={`relative inline-flex h-4 w-7 items-center rounded-full transition-colors ${
                  corrAlertEnabled ? 'bg-emerald-500' : 'bg-slate-700'
                }`}
              >
                <span
                  className={`inline-block h-3 w-3 transform rounded-full bg-slate-950 transition-transform ${
                    corrAlertEnabled ? 'translate-x-3.5' : 'translate-x-0.5'
                  }`}
                />
              </span>
              <span>{corrAlertEnabled ? 'Armed (Auto-Notify)' : 'Paused'}</span>
            </button>
          </div>
        </div>

        {/* Correlation Deviation Telemetry Grid */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 text-xs font-mono tabular-nums">
          <div className="bg-slate-950/70 p-3 rounded-lg border border-slate-800">
            <div className="text-[11px] text-slate-400">Rolling 30D Pearson (r)</div>
            <div
              className={`text-base font-bold mt-0.5 ${
                corrEvaluation.isDeviating ? 'text-amber-400' : 'text-slate-100'
              }`}
            >
              {corrEvaluation.rolling30dCorrelation >= 0 ? '+' : ''}
              {corrEvaluation.rolling30dCorrelation.toFixed(2)}
            </div>
            <div className="text-[11px] text-slate-500 mt-0.5">
              Regime: {corrEvaluation.regimeTag.replace(/_/g, ' ')}
            </div>
          </div>

          <div className="bg-slate-950/70 p-3 rounded-lg border border-slate-800">
            <div className="text-[11px] text-slate-400">Historical 5Y Norm</div>
            <div className="text-base font-bold text-sky-300 mt-0.5">
              {corrEvaluation.historicalNorm.toFixed(2)}
            </div>
            <div className="text-[11px] text-slate-500 mt-0.5">
              Long-run inverse baseline
            </div>
          </div>

          <div className="bg-slate-950/70 p-3 rounded-lg border border-slate-800">
            <div className="text-[11px] text-slate-400">Absolute Deviation |Δr|</div>
            <div
              className={`text-base font-bold mt-0.5 ${
                corrEvaluation.isDeviating ? 'text-rose-400' : 'text-emerald-400'
              }`}
            >
              {corrEvaluation.absoluteDeviation.toFixed(2)}
            </div>
            <div className="text-[11px] text-slate-500 mt-0.5">
              Signed Δ: {corrEvaluation.signedDeviation >= 0 ? '+' : ''}
              {corrEvaluation.signedDeviation.toFixed(2)}
            </div>
          </div>

          <div className="bg-slate-950/70 p-3 rounded-lg border border-slate-800">
            <div className="text-[11px] text-slate-400">Alert Status</div>
            <div
              className={`text-base font-bold mt-0.5 ${
                corrEvaluation.isDeviating ? 'text-rose-400' : 'text-emerald-400'
              }`}
            >
              {corrEvaluation.isDeviating ? 'Deviation Alert' : 'Within Norm'}
            </div>
            <div className="text-[11px] text-slate-400 mt-0.5">
              {corrEvaluation.isDeviating
                ? `Exceeds >${corrEvaluation.deviationThreshold.toFixed(2)} threshold`
                : `Below ${corrEvaluation.deviationThreshold.toFixed(2)} threshold`}
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-slate-300">
          <span>{corrEvaluation.summary}</span>
          {corrDispatchNotice && (
            <span className="font-mono text-[11px] text-amber-300">{corrDispatchNotice}</span>
          )}
        </div>
      </section>

      {/* Rolling 30-Day XAU/USD × 10Y US Treasury Yield > +0.50 Risk-On/Off Push Notification Toggle */}
      <section
        aria-label="XAU/USD 10Y Yield Regime Push Notification"
        className="bg-slate-900 border border-slate-800 rounded-lg p-5 space-y-4"
      >
        <div className="flex flex-wrap items-center justify-between gap-4 pb-3 border-b border-slate-800">
          <div>
            <h3 className="text-base font-bold text-slate-100 flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-emerald-400 shrink-0" aria-hidden="true" />
              <span>Rolling 30-Day XAU/USD × 10Y Yield Regime Push Alert</span>
            </h3>
            <div className="flex flex-wrap items-center gap-2 text-xs text-slate-400 mt-1">
              <span>5Y Historical Norm: {yieldEvaluation.historicalNorm.toFixed(2)}</span>
              <span aria-hidden="true">·</span>
              <span className="font-mono tabular-nums">
                Trigger: r &gt; +{yieldThreshold.toFixed(2)}
              </span>
              <span aria-hidden="true">·</span>
              <span>
                Push Delivery:{' '}
                {pushPermission === 'granted'
                  ? 'Browser Push Granted'
                  : pushPermission === 'denied'
                  ? 'Browser Blocked (In-App + Webhook)'
                  : pushPermission === 'default'
                  ? 'Click Toggle to Enable Browser Push'
                  : 'In-App + Server Webhook'}
              </span>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            <label className="inline-flex items-center gap-1.5 text-xs font-mono text-slate-300 bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-1">
              <span className="text-slate-400">Breakout r &gt;:</span>
              <input
                type="number"
                step="0.05"
                min="0.1"
                max="0.95"
                aria-label="XAU/USD 10Y Yield correlation threshold"
                value={yieldThreshold}
                onChange={(e) => handleYieldThresholdChange(Number(e.target.value))}
                className="w-16 bg-slate-900 border border-slate-700 rounded px-1.5 py-0.5 text-right text-slate-100 font-mono tabular-nums"
              />
            </label>

            <button
              type="button"
              onClick={() => setYieldBreakoutOverride((prev) => !prev)}
              disabled={!yieldBreakoutEnabled}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-medium transition-colors whitespace-nowrap shrink-0 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed ${
                yieldBreakoutOverride
                  ? 'bg-rose-500/20 text-rose-200 border-rose-500/40'
                  : 'bg-slate-950 text-slate-300 border-slate-700 hover:border-slate-500'
              }`}
              title="Simulate a rolling 30-day XAU/USD × 10Y Yield correlation breakout above +0.50"
            >
              <Zap className="w-3.5 h-3.5 text-amber-400" aria-hidden="true" />
              <span>
                {yieldBreakoutOverride
                  ? 'Reset Live Correlation'
                  : `Test >+${yieldThreshold.toFixed(2)} Breakout`}
              </span>
            </button>

            <button
              type="button"
              role="switch"
              aria-checked={yieldBreakoutEnabled}
              aria-label="XAU/USD 10Y Yield Push Notifications"
              onClick={() => setYieldBreakoutAlertEnabled(!yieldBreakoutEnabled)}
              className={`inline-flex items-center gap-2.5 px-3.5 py-1.5 rounded-lg border text-xs font-semibold transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                yieldBreakoutEnabled
                  ? 'bg-emerald-500/15 text-emerald-300 border-emerald-500/40'
                  : 'bg-slate-950 text-slate-400 border-slate-700 hover:text-slate-200'
              }`}
            >
              <span
                className={`relative inline-flex h-4 w-7 items-center rounded-full transition-colors ${
                  yieldBreakoutEnabled ? 'bg-emerald-500' : 'bg-slate-700'
                }`}
              >
                <span
                  className={`inline-block h-3 w-3 transform rounded-full bg-slate-950 transition-transform ${
                    yieldBreakoutEnabled ? 'translate-x-3.5' : 'translate-x-0.5'
                  }`}
                />
              </span>
              <span>{yieldBreakoutEnabled ? 'Push Armed' : 'Paused'}</span>
            </button>
          </div>
        </div>

        {/* 10Y Yield Correlation Breakout Telemetry Grid */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 text-xs font-mono tabular-nums">
          <div className="bg-slate-950/70 p-3 rounded-lg border border-slate-800">
            <div className="text-[11px] text-slate-400">Rolling 30D XAU × 10Y</div>
            <div
              className={`text-base font-bold mt-0.5 ${
                yieldEvaluation.isBrokenAbove ? 'text-rose-400' : 'text-slate-100'
              }`}
            >
              {yieldEvaluation.rolling30dCorrelation >= 0 ? '+' : ''}
              {yieldEvaluation.rolling30dCorrelation.toFixed(2)}
            </div>
            <div className="text-[11px] text-slate-500 mt-0.5">
              5Y Normal Inverse: {yieldEvaluation.historicalNorm.toFixed(2)}
            </div>
          </div>

          <div className="bg-slate-950/70 p-3 rounded-lg border border-slate-800">
            <div className="text-[11px] text-slate-400">Push Breakout Level</div>
            <div className="text-base font-bold text-amber-400 mt-0.5">
              &gt; +{yieldEvaluation.correlationThreshold.toFixed(2)}
            </div>
            <div className="text-[11px] text-slate-500 mt-0.5">
              Headroom: {yieldEvaluation.headroomToThreshold >= 0 ? '+' : ''}
              {yieldEvaluation.headroomToThreshold.toFixed(2)}
            </div>
          </div>

          <div className="bg-slate-950/70 p-3 rounded-lg border border-slate-800">
            <div className="text-[11px] text-slate-400">Shift Above 5Y Norm</div>
            <div className="text-base font-bold text-sky-300 mt-0.5">
              {yieldEvaluation.shiftFromHistoricalNorm >= 0 ? '+' : ''}
              {yieldEvaluation.shiftFromHistoricalNorm.toFixed(2)}
            </div>
            <div className="text-[11px] text-slate-500 mt-0.5">
              Positive yield co-movement gauge
            </div>
          </div>

          <div className="bg-slate-950/70 p-3 rounded-lg border border-slate-800">
            <div className="text-[11px] text-slate-400">Regime Shift Status</div>
            <div
              className={`text-base font-bold mt-0.5 ${
                yieldEvaluation.isBrokenAbove ? 'text-rose-400' : 'text-emerald-400'
              }`}
            >
              {yieldEvaluation.isBrokenAbove ? 'Regime Shift' : 'Inverse Intact'}
            </div>
            <div className="text-[11px] text-slate-400 mt-0.5">
              {yieldEvaluation.riskRegimeSignal.replace(/_/g, ' ')}
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-slate-300">
          <span>{yieldEvaluation.summary}</span>
          {yieldDispatchNotice && (
            <span className="font-mono text-[11px] text-amber-300">{yieldDispatchNotice}</span>
          )}
        </div>
      </section>

      {/* S&P GSCI Commodity vs. Monetary Driver Correlation Alert Monitor */}
      <section
        aria-label="S&P GSCI Correlation Alert Monitor"
        className="bg-slate-900 border border-slate-800 rounded-lg p-5 space-y-4"
      >
        <div className="flex flex-wrap items-center justify-between gap-4 pb-3 border-b border-slate-800">
          <div>
            <h3 className="text-base font-bold text-slate-100 flex items-center gap-2">
              <Layers className="w-4 h-4 text-amber-400 shrink-0" aria-hidden="true" />
              <span>S&amp;P GSCI Correlation Alert Monitor (Commodities vs. Monetary Drivers)</span>
            </h3>
            <div className="flex flex-wrap items-center gap-2 text-xs text-slate-400 mt-1">
              <span>Benchmark: S&amp;P GSCI Proxy ({gsciEvaluation.gsciSpotIndex.toFixed(1)})</span>
              <span aria-hidden="true">·</span>
              <span>5Y Norm: +{gsciEvaluation.historicalNorm5Y.toFixed(2)}</span>
              <span aria-hidden="true">·</span>
              <span className="font-mono tabular-nums">
                Commodity Threshold: r &gt; +{gsciThreshold.toFixed(2)}
              </span>
              <span aria-hidden="true">·</span>
              <span className="font-mono tabular-nums">Monetary Decoupling: r &lt; +0.20</span>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <select
              aria-label="GSCI correlation alert mode"
              value={gsciAlertMode}
              onChange={(e) => setGsciAlertMode(e.target.value as GsciAlertMode)}
              className="bg-slate-950 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs font-mono text-slate-200"
            >
              <option value="ANY_SHIFT">Any Driver Shift</option>
              <option value="COMMODITY_SURGE">Commodity Surge (&gt; Threshold)</option>
              <option value="MONETARY_DECOUPLING">Monetary Decoupling (&lt; +0.20)</option>
            </select>

            <label className="inline-flex items-center gap-1.5 text-xs font-mono text-slate-300 bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-1">
              <span className="text-slate-400">GSCI r &gt;:</span>
              <input
                type="number"
                step="0.05"
                min="0.2"
                max="0.95"
                aria-label="GSCI correlation threshold"
                value={gsciThreshold}
                onChange={(e) => handleGsciThresholdChange(Number(e.target.value))}
                className="w-16 bg-slate-900 border border-slate-700 rounded px-1.5 py-0.5 text-right text-slate-100 font-mono tabular-nums"
              />
            </label>

            <button
              type="button"
              onClick={() =>
                setGsciSimRegime((prev) =>
                  prev === 'COMMODITY_DRIVEN' ? 'LIVE' : 'COMMODITY_DRIVEN'
                )
              }
              disabled={!gsciAlertEnabled}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-medium transition-colors whitespace-nowrap shrink-0 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed ${
                gsciSimRegime === 'COMMODITY_DRIVEN'
                  ? 'bg-amber-500/20 text-amber-200 border-amber-500/40'
                  : 'bg-slate-950 text-slate-300 border-slate-700 hover:border-slate-500'
              }`}
              title="Simulate high XAU/USD × S&P GSCI correlation (r = +0.74)"
            >
              <Zap className="w-3.5 h-3.5 text-amber-400" aria-hidden="true" />
              <span>
                {gsciSimRegime === 'COMMODITY_DRIVEN'
                  ? 'Reset Live GSCI'
                  : 'Test Commodity Surge'}
              </span>
            </button>

            <button
              type="button"
              onClick={() =>
                setGsciSimRegime((prev) =>
                  prev === 'MONETARY_DRIVEN' ? 'LIVE' : 'MONETARY_DRIVEN'
                )
              }
              disabled={!gsciAlertEnabled}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-medium transition-colors whitespace-nowrap shrink-0 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed ${
                gsciSimRegime === 'MONETARY_DRIVEN'
                  ? 'bg-sky-500/20 text-sky-200 border-sky-500/40'
                  : 'bg-slate-950 text-slate-300 border-slate-700 hover:border-slate-500'
              }`}
              title="Simulate monetary-driven gold decoupling from S&P GSCI (r = +0.08)"
            >
              <Zap className="w-3.5 h-3.5 text-sky-400" aria-hidden="true" />
              <span>
                {gsciSimRegime === 'MONETARY_DRIVEN'
                  ? 'Reset Live GSCI'
                  : 'Test Monetary Shift'}
              </span>
            </button>

            <button
              type="button"
              role="switch"
              aria-checked={gsciAlertEnabled}
              aria-label="S&P GSCI Correlation Alert"
              onClick={() => setGsciAlertEnabled(!gsciAlertEnabled)}
              className={`inline-flex items-center gap-2.5 px-3.5 py-1.5 rounded-lg border text-xs font-semibold transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                gsciAlertEnabled
                  ? 'bg-emerald-500/15 text-emerald-300 border-emerald-500/40'
                  : 'bg-slate-950 text-slate-400 border-slate-700 hover:text-slate-200'
              }`}
            >
              <span
                className={`relative inline-flex h-4 w-7 items-center rounded-full transition-colors ${
                  gsciAlertEnabled ? 'bg-emerald-500' : 'bg-slate-700'
                }`}
              >
                <span
                  className={`inline-block h-3 w-3 transform rounded-full bg-slate-950 transition-transform ${
                    gsciAlertEnabled ? 'translate-x-3.5' : 'translate-x-0.5'
                  }`}
                />
              </span>
              <span>{gsciAlertEnabled ? 'Armed (Auto-Notify)' : 'Paused'}</span>
            </button>
          </div>
        </div>

        {/* S&P GSCI Attribution Telemetry Grid */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 text-xs font-mono tabular-nums">
          <div className="bg-slate-950/70 p-3 rounded-lg border border-slate-800">
            <div className="text-[11px] text-slate-400">30D XAU × S&amp;P GSCI (r)</div>
            <div
              className={`text-base font-bold mt-0.5 ${
                gsciEvaluation.driverRegime === 'GENERAL_COMMODITIES'
                  ? 'text-amber-400'
                  : gsciEvaluation.driverRegime === 'MONETARY_FACTORS'
                  ? 'text-sky-400'
                  : 'text-slate-100'
              }`}
            >
              {gsciEvaluation.rolling30dGsciCorrelation >= 0 ? '+' : ''}
              {gsciEvaluation.rolling30dGsciCorrelation.toFixed(2)}
            </div>
            <div className="text-[11px] text-slate-500 mt-0.5">
              GSCI Basket 24h: {gsciEvaluation.gsciChange24hPct >= 0 ? '+' : ''}
              {gsciEvaluation.gsciChange24hPct.toFixed(2)}%
            </div>
          </div>

          <div className="bg-slate-950/70 p-3 rounded-lg border border-slate-800">
            <div className="text-[11px] text-slate-400">Primary Gold Driver</div>
            <div
              className={`text-sm font-sans font-bold mt-0.5 ${
                gsciEvaluation.driverRegime === 'GENERAL_COMMODITIES'
                  ? 'text-amber-300'
                  : gsciEvaluation.driverRegime === 'MONETARY_FACTORS'
                  ? 'text-sky-300'
                  : 'text-emerald-300'
              }`}
            >
              {gsciEvaluation.driverRegime === 'GENERAL_COMMODITIES'
                ? 'General Commodities'
                : gsciEvaluation.driverRegime === 'MONETARY_FACTORS'
                ? 'Monetary Factors'
                : 'Mixed Macro Drivers'}
            </div>
            <div className="text-[11px] font-sans text-slate-500 mt-0.5">
              {gsciEvaluation.driverRegime === 'GENERAL_COMMODITIES'
                ? 'Broad energy & materials reflation'
                : gsciEvaluation.driverRegime === 'MONETARY_FACTORS'
                ? 'USD liquidity, DXY & real yields'
                : 'Balanced commodity + monetary mix'}
            </div>
          </div>

          <div className="bg-slate-950/70 p-3 rounded-lg border border-slate-800">
            <div className="text-[11px] text-slate-400">Driver Variance Split</div>
            <div className="text-sm font-bold text-slate-100 mt-0.5">
              {gsciEvaluation.commodityDriverSharePct}% GSCI / {gsciEvaluation.monetaryDriverSharePct}% Monetary
            </div>
            <div
              className="w-full h-1.5 rounded-full bg-slate-800 overflow-hidden flex mt-2"
              role="img"
              aria-label={`${gsciEvaluation.commodityDriverSharePct}% General Commodities vs ${gsciEvaluation.monetaryDriverSharePct}% Monetary Factors`}
            >
              <div
                className="bg-amber-400 h-full transition-all"
                style={{ width: `${gsciEvaluation.commodityDriverSharePct}%` }}
              />
              <div
                className="bg-sky-400 h-full transition-all"
                style={{ width: `${gsciEvaluation.monetaryDriverSharePct}%` }}
              />
            </div>
          </div>

          <div className="bg-slate-950/70 p-3 rounded-lg border border-slate-800">
            <div className="text-[11px] text-slate-400">Monetary Anchor |r| &amp; Alert</div>
            <div
              className={`text-base font-bold mt-0.5 ${
                gsciEvaluation.isTriggered ? 'text-amber-400' : 'text-emerald-400'
              }`}
            >
              |r| {gsciEvaluation.rolling30dMonetaryMagnitude.toFixed(2)} ·{' '}
              {gsciEvaluation.isTriggered ? 'Alert Active' : 'Balanced'}
            </div>
            <div className="text-[11px] text-slate-400 mt-0.5">
              DXY &amp; 10Y Treasury Yield magnitude
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-slate-300">
          <span>{gsciEvaluation.summary}</span>
          {gsciDispatchNotice && (
            <span className="font-mono text-[11px] text-amber-300">{gsciDispatchNotice}</span>
          )}
        </div>
      </section>

      {/* Custom XAU/USD Chart RSI Level Alerts Builder & Live Monitor */}
      <section
        aria-label="Custom XAU/USD RSI Level Alerts"
        className="bg-slate-900 border border-slate-800 rounded-lg p-5 space-y-4"
      >
        <div className="flex flex-wrap items-center justify-between gap-4 pb-3 border-b border-slate-800">
          <div>
            <h3 className="text-base font-bold text-slate-100 flex items-center gap-2">
              <Gauge className="w-4 h-4 text-amber-400 shrink-0" aria-hidden="true" />
              <span>Custom RSI Level Alerts (Current XAU/USD Chart)</span>
            </h3>
            <div className="flex flex-wrap items-center gap-2 text-xs text-slate-400 mt-1">
              <span>Chart Timeframe: {activeChartTimeframe}</span>
              <span aria-hidden="true">·</span>
              <span className="font-mono tabular-nums">
                {rsiEvaluation.barsEvaluated} XAU/USD Bars
              </span>
              <span aria-hidden="true">·</span>
              <span className="font-mono tabular-nums">
                {rsiRules.filter((r) => r.isActive).length} Armed Rule{rsiRules.filter((r) => r.isActive).length === 1 ? '' : 's'}
              </span>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() =>
                setRsiSimMode((prev) => (prev === 'OVERBOUGHT' ? 'LIVE' : 'OVERBOUGHT'))
              }
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-medium transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                rsiSimMode === 'OVERBOUGHT'
                  ? 'bg-rose-500/20 text-rose-200 border-rose-500/40'
                  : 'bg-slate-950 text-slate-300 border-slate-700 hover:border-slate-500'
              }`}
              title="Simulate RSI(14) crossing above 70 on XAU/USD chart"
            >
              <Zap className="w-3.5 h-3.5 text-amber-400" aria-hidden="true" />
              <span>{rsiSimMode === 'OVERBOUGHT' ? 'Reset Live RSI' : 'Test Cross > 70'}</span>
            </button>

            <button
              type="button"
              onClick={() =>
                setRsiSimMode((prev) => (prev === 'OVERSOLD' ? 'LIVE' : 'OVERSOLD'))
              }
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-medium transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                rsiSimMode === 'OVERSOLD'
                  ? 'bg-emerald-500/20 text-emerald-200 border-emerald-500/40'
                  : 'bg-slate-950 text-slate-300 border-slate-700 hover:border-slate-500'
              }`}
              title="Simulate RSI(14) crossing below 30 on XAU/USD chart"
            >
              <Zap className="w-3.5 h-3.5 text-emerald-400" aria-hidden="true" />
              <span>{rsiSimMode === 'OVERSOLD' ? 'Reset Live RSI' : 'Test Cross < 30'}</span>
            </button>
          </div>
        </div>

        {/* Live XAU/USD Chart RSI Telemetry Strip */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 text-xs font-mono tabular-nums">
          <div className="bg-slate-950/70 p-3 rounded-lg border border-slate-800">
            <div className="text-[11px] text-slate-400">
              Current XAU/USD RSI({rsiEvaluation.primaryPeriod})
            </div>
            <div
              className={`text-base font-bold mt-0.5 ${
                rsiEvaluation.currentRsi >= 70
                  ? 'text-rose-400'
                  : rsiEvaluation.currentRsi <= 30
                  ? 'text-emerald-400'
                  : 'text-slate-100'
              }`}
            >
              {rsiEvaluation.currentRsi.toFixed(2)}
            </div>
            <div className="text-[11px] text-slate-400 mt-0.5">
              Regime: {rsiEvaluation.zoneLabel.replace(/_/g, ' ')}
            </div>
          </div>

          <div className="bg-slate-950/70 p-3 rounded-lg border border-slate-800">
            <div className="text-[11px] text-slate-400">Previous Bar RSI</div>
            <div className="text-base font-bold text-slate-200 mt-0.5">
              {rsiEvaluation.previousRsi.toFixed(2)}
            </div>
            <div
              className={`text-[11px] mt-0.5 ${
                rsiEvaluation.rsiDelta >= 0 ? 'text-emerald-400' : 'text-rose-400'
              }`}
            >
              Bar Delta: {rsiEvaluation.rsiDelta >= 0 ? '+' : ''}
              {rsiEvaluation.rsiDelta.toFixed(2)}
            </div>
          </div>

          <div className="bg-slate-950/70 p-3 rounded-lg border border-slate-800">
            <div className="text-[11px] text-slate-400">Active XAU/USD Close</div>
            <div className="text-base font-bold text-amber-400 mt-0.5">
              ${(rsiEvaluation.latestClose || quote.mid).toFixed(2)}
            </div>
            <div className="text-[11px] text-slate-500 mt-0.5">
              Series: {activeChartTimeframe} ({rsiSimMode === 'LIVE' ? 'Live Chart' : 'Simulated Cross'})
            </div>
          </div>

          <div className="bg-slate-950/70 p-3 rounded-lg border border-slate-800">
            <div className="text-[11px] text-slate-400">Triggered RSI Alerts</div>
            <div
              className={`text-base font-bold mt-0.5 ${
                rsiEvaluation.triggeredRules.length > 0 ? 'text-amber-400' : 'text-emerald-400'
              }`}
            >
              {rsiEvaluation.triggeredRules.length} / {rsiRules.filter((r) => r.isActive).length}
            </div>
            <div className="text-[11px] text-slate-400 mt-0.5">
              {rsiEvaluation.triggeredRules.length > 0
                ? 'Condition crossed on chart'
                : 'Monitoring thresholds'}
            </div>
          </div>
        </div>

        {/* Custom RSI Rule Builder + Quick Presets */}
        <form
          onSubmit={(e) => handleCreateCustomRsiAlert(e)}
          aria-label="Create Custom RSI Alert Form"
          className="bg-slate-950/60 border border-slate-800 rounded-lg p-4 space-y-3"
        >
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="text-xs font-semibold text-slate-200">
              Create Custom XAU/USD RSI Level Alert
            </span>
            <div className="flex flex-wrap items-center gap-1.5">
              <button
                type="button"
                onClick={() =>
                  handleCreateCustomRsiAlert(undefined, {
                    name: `XAU/USD (${activeChartTimeframe}) RSI(14) Crosses Above 70`,
                    period: 14,
                    operator: 'CROSS_ABOVE',
                    threshold: 70,
                  })
                }
                className="px-2.5 py-1 rounded border border-slate-700 bg-slate-900 hover:border-rose-500/50 text-[11px] font-mono text-slate-300 hover:text-rose-200 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
              >
                + Overbought &gt; 70
              </button>
              <button
                type="button"
                onClick={() =>
                  handleCreateCustomRsiAlert(undefined, {
                    name: `XAU/USD (${activeChartTimeframe}) RSI(14) Crosses Below 30`,
                    period: 14,
                    operator: 'CROSS_BELOW',
                    threshold: 30,
                  })
                }
                className="px-2.5 py-1 rounded border border-slate-700 bg-slate-900 hover:border-emerald-500/50 text-[11px] font-mono text-slate-300 hover:text-emerald-200 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
              >
                + Oversold &lt; 30
              </button>
              <button
                type="button"
                onClick={() =>
                  handleCreateCustomRsiAlert(undefined, {
                    name: `XAU/USD (${activeChartTimeframe}) RSI(14) Crosses Above 80`,
                    period: 14,
                    operator: 'CROSS_ABOVE',
                    threshold: 80,
                  })
                }
                className="px-2.5 py-1 rounded border border-slate-700 bg-slate-900 hover:border-amber-500/50 text-[11px] font-mono text-slate-300 hover:text-amber-200 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
              >
                + Extreme &gt; 80
              </button>
              <button
                type="button"
                onClick={() =>
                  handleCreateCustomRsiAlert(undefined, {
                    name: `XAU/USD (${activeChartTimeframe}) RSI(14) Crosses Below 20`,
                    period: 14,
                    operator: 'CROSS_BELOW',
                    threshold: 20,
                  })
                }
                className="px-2.5 py-1 rounded border border-slate-700 bg-slate-900 hover:border-sky-500/50 text-[11px] font-mono text-slate-300 hover:text-sky-200 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
              >
                + Extreme &lt; 20
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-12 gap-2.5 text-xs font-mono">
            <input
              type="text"
              aria-label="Custom RSI alert label"
              placeholder={`Label (default: XAU/USD ${activeChartTimeframe} RSI(${rsiPeriodInput}) ${operatorDisplayLabel[rsiOperatorInput]} ${rsiThresholdInput})`}
              value={rsiRuleName}
              onChange={(e) => setRsiRuleName(e.target.value)}
              className="md:col-span-4 bg-slate-900 border border-slate-700 rounded px-3 py-1.5 text-slate-100 placeholder:text-slate-500"
            />

            <label className="md:col-span-2 flex items-center justify-between gap-2 bg-slate-900 border border-slate-700 rounded px-2.5 py-1.5 text-slate-300">
              <span className="text-[11px] text-slate-400 shrink-0">Period</span>
              <input
                type="number"
                min={2}
                max={50}
                step={1}
                aria-label="RSI period"
                value={rsiPeriodInput}
                onChange={(e) =>
                  setRsiPeriodInput(
                    Math.max(2, Math.min(50, Math.round(Number(e.target.value) || 14)))
                  )
                }
                className="w-12 bg-slate-950 border border-slate-700 rounded px-1.5 py-0.5 text-right text-slate-100 tabular-nums"
              />
            </label>

            <select
              aria-label="RSI alert condition"
              value={rsiOperatorInput}
              onChange={(e) => setRsiOperatorInput(e.target.value as RsiConditionOperator)}
              className="md:col-span-2 bg-slate-900 border border-slate-700 rounded px-2.5 py-1.5 text-slate-100"
            >
              <option value="CROSS_ABOVE">Crosses Above</option>
              <option value="CROSS_BELOW">Crosses Below</option>
              <option value="ABOVE">Stays Above</option>
              <option value="BELOW">Stays Below</option>
            </select>

            <label className="md:col-span-2 flex items-center justify-between gap-2 bg-slate-900 border border-slate-700 rounded px-2.5 py-1.5 text-slate-300">
              <span className="text-[11px] text-slate-400 shrink-0">Level</span>
              <input
                type="number"
                min={1}
                max={99}
                step={0.5}
                aria-label="RSI level threshold"
                value={rsiThresholdInput}
                onChange={(e) =>
                  setRsiThresholdInput(
                    Math.max(1, Math.min(99, Number(e.target.value) || 70))
                  )
                }
                className="w-14 bg-slate-950 border border-slate-700 rounded px-1.5 py-0.5 text-right text-slate-100 tabular-nums"
              />
            </label>

            <button
              type="submit"
              className="md:col-span-2 inline-flex items-center justify-center gap-1.5 px-3 py-1.5 rounded bg-amber-400 hover:bg-amber-300 text-slate-950 font-sans font-semibold transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" aria-hidden="true" />
              <span>Create RSI Alert</span>
            </button>
          </div>
        </form>

        {/* Active Custom RSI Level Rules List */}
        {rsiRules.length === 0 ? (
          <div className="p-4 rounded-lg border border-dashed border-slate-800 text-center text-xs text-slate-400">
            No custom RSI level alerts configured for XAU/USD. Use the quick presets or custom builder above to monitor overbought (&gt;70) or oversold (&lt;30) crosses.
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
            {rsiRules.map((rule) => {
              const evalItem = rsiEvaluation.ruleEvaluations.find((ev) => ev.ruleId === rule.id);
              const triggered = Boolean(evalItem?.isTriggered);
              return (
                <div
                  key={rule.id}
                  className={`p-3 rounded-lg border text-xs flex items-center justify-between gap-3 transition-colors ${
                    triggered
                      ? 'bg-amber-500/10 border-amber-500/50 text-slate-100'
                      : rule.isActive
                      ? 'bg-slate-950/80 border-slate-800 text-slate-200'
                      : 'bg-slate-950/40 border-slate-900 text-slate-500'
                  }`}
                >
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2 font-mono text-[11px] tabular-nums">
                      <span className="text-amber-400 font-bold">{rule.id}</span>
                      <span className="text-slate-400">
                        · RSI({rule.period}) {operatorDisplayLabel[rule.operator]} {rule.threshold}
                      </span>
                      <span className="text-slate-500">· {activeChartTimeframe}</span>
                    </div>
                    <div className="font-semibold text-slate-100 truncate mt-0.5">{rule.name}</div>
                    {evalItem && (
                      <div
                        className={`text-[11px] font-mono tabular-nums mt-0.5 ${
                          triggered ? 'text-amber-300 font-semibold' : 'text-slate-400'
                        }`}
                      >
                        {evalItem.summary}
                      </div>
                    )}
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      type="button"
                      role="switch"
                      aria-checked={rule.isActive}
                      aria-label={`Toggle ${rule.id}`}
                      onClick={() => toggleRsiRule(rule.id)}
                      className={`px-2.5 py-1 rounded text-[11px] font-semibold border cursor-pointer whitespace-nowrap shrink-0 ${
                        rule.isActive
                          ? 'bg-emerald-500/15 text-emerald-300 border-emerald-500/40'
                          : 'bg-slate-900 text-slate-500 border-slate-700'
                      }`}
                    >
                      {rule.isActive ? 'Armed' : 'Paused'}
                    </button>
                    <button
                      type="button"
                      onClick={() => deleteRsiRule(rule.id)}
                      className="p-1.5 text-slate-500 hover:text-rose-400 transition-colors cursor-pointer"
                      aria-label={`Delete ${rule.id}`}
                    >
                      <Trash2 className="w-3.5 h-3.5" aria-hidden="true" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-slate-300">
          <span>{rsiEvaluation.summary}</span>
          {rsiDispatchNotice && (
            <span className="font-mono text-[11px] text-amber-300">{rsiDispatchNotice}</span>
          )}
        </div>
      </section>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column: Active Alert Rules & Create Form */}
        <div className="lg:col-span-7 space-y-4">
          <div className="bg-slate-900 border border-slate-800 rounded-lg p-5">
            <h3 className="text-sm font-bold text-slate-100 flex items-center gap-2 mb-3">
              <BellRing className="w-4 h-4 text-amber-400" />
              Configured Alert Rules ({rules.length})
            </h3>

            <div className="space-y-2.5">
              {rules.map((rule) => (
                <div
                  key={rule.id}
                  className={`p-3.5 rounded-lg border text-xs font-mono flex items-center justify-between gap-3 transition-colors ${
                    rule.isActive
                      ? 'bg-slate-950/80 border-slate-800 text-slate-200'
                      : 'bg-slate-950/40 border-slate-900 text-slate-500'
                  }`}
                >
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-amber-400 font-bold">{rule.id}</span>
                      <span className="text-slate-400">· {rule.conditionType}</span>
                    </div>
                    <h5 className="font-sans text-xs font-semibold text-slate-200 mt-1">{rule.name}</h5>
                    <span className="text-[11px] text-slate-500">
                      Target: {rule.comparison} {rule.targetValue}
                      {rule.conditionType === 'ATR_VOLATILITY'
                        ? 'σ over 14D ATR'
                        : rule.conditionType === 'CORRELATION_DEVIATION'
                        ? ' |Δr| vs 5Y XAU/DXY Norm'
                        : rule.conditionType === 'YIELD_CORRELATION_BREAKOUT'
                        ? ' r > +0.50 Risk-On/Off Shift'
                        : rule.conditionType === 'GSCI_COMMODITY_CORRELATION'
                        ? ' r vs S&P GSCI Commodity vs Monetary'
                        : ''}
                    </span>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      onClick={() => toggleRule(rule.id)}
                      className={`px-2.5 py-1 rounded text-[11px] font-semibold border cursor-pointer whitespace-nowrap ${
                        rule.isActive
                          ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
                          : 'bg-slate-800 text-slate-500 border-slate-700'
                      }`}
                    >
                      {rule.isActive ? 'Active' : 'Disabled'}
                    </button>
                    <button
                      onClick={() => deleteRule(rule.id)}
                      className="p-1.5 text-slate-500 hover:text-rose-400 transition-colors cursor-pointer"
                      aria-label={`Delete ${rule.id}`}
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>

            {/* Create Alert Rule Form */}
            <form onSubmit={handleAddRule} className="mt-5 pt-4 border-t border-slate-800 space-y-3">
              <h4 className="text-xs uppercase font-mono text-slate-400 tracking-wider">
                Create New Advisory Alert Rule
              </h4>
              <div className="grid grid-cols-1 sm:grid-cols-4 gap-2 text-xs font-mono">
                <input
                  type="text"
                  placeholder="Rule label (e.g., Gold Breaks $3925)"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  className="sm:col-span-2 bg-slate-950 border border-slate-700 rounded px-3 py-1.5 text-slate-200"
                />
                <select
                  value={newType}
                  onChange={(e) => setNewType(e.target.value as AlertRule['conditionType'])}
                  className="bg-slate-950 border border-slate-700 rounded px-2 py-1.5 text-slate-200"
                >
                  <option value="PRICE_LEVEL">PRICE_LEVEL</option>
                  <option value="ATR_VOLATILITY">ATR_VOLATILITY</option>
                  <option value="CORRELATION_DEVIATION">CORRELATION_DEVIATION</option>
                  <option value="YIELD_CORRELATION_BREAKOUT">YIELD_CORRELATION_BREAKOUT</option>
                  <option value="GSCI_COMMODITY_CORRELATION">GSCI_COMMODITY_CORRELATION</option>
                  <option value="RSI_THRESHOLD">RSI_THRESHOLD</option>
                  <option value="SPREAD_SPIKE">SPREAD_SPIKE</option>
                </select>
                <input
                  type="number"
                  step="0.5"
                  value={newTarget}
                  onChange={(e) => setNewTarget(Number(e.target.value))}
                  className="bg-slate-950 border border-slate-700 rounded px-3 py-1.5 text-slate-200"
                />
              </div>
              <button
                type="submit"
                className="w-full flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-semibold text-slate-950 bg-amber-400 hover:bg-amber-300 rounded transition-colors cursor-pointer"
              >
                <Plus className="w-4 h-4" /> Add Alert Rule
              </button>
            </form>
          </div>
        </div>

        {/* Right Column: Triggered Notifications Log */}
        <div className="lg:col-span-5 bg-slate-900 border border-slate-800 rounded-lg p-5">
          <h3 className="text-sm font-bold text-slate-100 flex items-center gap-2 mb-3">
            <AlertTriangle className="w-4 h-4 text-amber-400" />
            Triggered Advisory Events ({notifications.length})
          </h3>

          <div className="space-y-2.5 max-h-[540px] overflow-y-auto pr-1">
            {notifications.map((notif) => (
              <div
                key={notif.id}
                className={`p-3 bg-slate-950 rounded-lg border text-xs font-mono space-y-1.5 ${
                  notif.severity === 'CRITICAL'
                    ? 'border-rose-500/40'
                    : notif.severity === 'WARNING'
                    ? 'border-amber-500/40'
                    : 'border-slate-800'
                }`}
              >
                <div className="flex items-center justify-between gap-2 text-[10px] text-slate-500">
                  <span
                    className={`font-bold ${
                      notif.severity === 'CRITICAL'
                        ? 'text-rose-400'
                        : notif.severity === 'WARNING'
                        ? 'text-amber-400'
                        : 'text-sky-400'
                    }`}
                  >
                    [{notif.severity}] {notif.title}
                  </span>
                  <span className="shrink-0 tabular-nums">{notif.timestamp.slice(11, 16)} UTC</span>
                </div>
                <p className="text-slate-300 font-sans text-xs leading-relaxed">{notif.message}</p>
                {!notif.read && (
                  <div className="flex items-center justify-between pt-1 text-[10px]">
                    <span className="text-amber-400">Unread alert</span>
                    <button
                      type="button"
                      onClick={() => markNotificationRead(notif.id)}
                      className="text-slate-400 hover:text-slate-200 underline cursor-pointer"
                    >
                      Mark read
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};
