/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * Aurum Intelligence — Unified Trade Lifecycle Alert Service
 *
 * Delivers real-time notifications whenever simulated paper positions are opened
 * or closed across any entry path (Manual Entry, TradePlanCard, Auto-Paper Pilot,
 * SL/TP target triggers, Contra-Advisory exits, or Sync Cleanups).
 *
 * Maintains strict per-user alert history (`aurum_trade_alerts_v1:${userId}`),
 * optional browser Notification API push delivery, and authenticated server dispatch
 * to configured Telegram / Discord / Slack channels.
 */

import { InstrumentId } from '../domain/types';
import { ensureSignedBearerToken, getCurrentSession, getSessionBearerToken } from './authService';

export type TradeLifecycleEventType = 'TRADE_OPENED' | 'TRADE_CLOSED';

export type TradeAlertTriggerSource =
  | 'MANUAL'
  | 'PLAN_CARD'
  | 'AUTO_PILOT'
  | 'SL_TP_TRIGGER'
  | 'CONTRA_RECONCILE'
  | 'SYNC_CLEANUP';

export interface TradeLifecycleAlertEvent {
  id: string;
  userId: string;
  eventType: TradeLifecycleEventType;
  positionId: string;
  instrumentId: InstrumentId;
  direction: 'BUY' | 'SELL';
  lots: number;
  entryPrice: number;
  exitPrice?: number;
  stopLoss: number;
  takeProfit: number;
  realizedPnl?: number;
  status: 'OPEN' | 'CLOSED_PROFIT' | 'CLOSED_LOSS';
  triggerSource: TradeAlertTriggerSource;
  reason?: string;
  timestamp: string;
  read: boolean;
  browserNotified?: boolean;
  serverDispatched?: boolean;
}

export interface EmitTradeAlertInput {
  userId: string;
  eventType: TradeLifecycleEventType;
  positionId: string;
  instrumentId: InstrumentId;
  direction: 'BUY' | 'SELL';
  lots: number;
  entryPrice: number;
  exitPrice?: number;
  stopLoss: number;
  takeProfit: number;
  realizedPnl?: number;
  status: 'OPEN' | 'CLOSED_PROFIT' | 'CLOSED_LOSS';
  triggerSource: TradeAlertTriggerSource;
  reason?: string;
}

const TRADE_ALERTS_STORAGE_PREFIX = 'aurum_trade_alerts_v1';
const MAX_STORED_ALERTS = 60;

export function getTradeAlertsStorageKey(userId: string): string {
  const safeId = (userId || 'usr_guest_0000').trim() || 'usr_guest_0000';
  return `${TRADE_ALERTS_STORAGE_PREFIX}:${safeId}`;
}

export function loadUserTradeAlerts(userId: string): TradeLifecycleAlertEvent[] {
  try {
    if (typeof window === 'undefined' || !window.localStorage) return [];
    const raw = window.localStorage.getItem(getTradeAlertsStorageKey(userId));
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function saveUserTradeAlerts(
  userId: string,
  alerts: TradeLifecycleAlertEvent[]
): TradeLifecycleAlertEvent[] {
  const bounded = alerts.slice(0, MAX_STORED_ALERTS);
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      window.localStorage.setItem(getTradeAlertsStorageKey(userId), JSON.stringify(bounded));
    }
  } catch {
    // ignore storage quota failures
  }
  return bounded;
}

export function markAllTradeAlertsRead(userId: string): TradeLifecycleAlertEvent[] {
  const existing = loadUserTradeAlerts(userId);
  const updated = existing.map((a) => ({ ...a, read: true }));
  return saveUserTradeAlerts(userId, updated);
}

export function clearUserTradeAlerts(userId: string): void {
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      window.localStorage.removeItem(getTradeAlertsStorageKey(userId));
    }
  } catch {
    // ignore
  }
}

export function isBrowserPushSupported(): boolean {
  return typeof window !== 'undefined' && typeof window.Notification !== 'undefined';
}

export function getBrowserPushPermission(): NotificationPermission | 'unsupported' {
  if (!isBrowserPushSupported()) return 'unsupported';
  return window.Notification.permission;
}

export async function requestBrowserPushPermission(): Promise<NotificationPermission | 'unsupported'> {
  if (!isBrowserPushSupported()) return 'unsupported';
  try {
    return await window.Notification.requestPermission();
  } catch {
    return window.Notification.permission;
  }
}

export function formatTradeAlertHeadline(event: Pick<
  TradeLifecycleAlertEvent,
  'eventType' | 'instrumentId' | 'direction' | 'lots' | 'entryPrice' | 'exitPrice' | 'realizedPnl'
>): { title: string; summary: string } {
  const priceDecimals = event.instrumentId.includes('10Y') ? 3 : 2;
  const lotLabel = `${Number(event.lots).toFixed(event.lots < 1 ? 2 : 1)} lot${event.lots === 1 ? '' : 's'}`;

  if (event.eventType === 'TRADE_OPENED') {
    const title = `Trade Opened: ${event.direction} ${event.instrumentId} (${lotLabel})`;
    return {
      title,
      summary: `${event.direction} ${lotLabel} ${event.instrumentId} @ $${event.entryPrice.toFixed(priceDecimals)}`,
    };
  }

  const pnl = Number(event.realizedPnl ?? 0);
  const pnlSign = pnl > 0 ? '+' : pnl < 0 ? '-' : '';
  const pnlText = `${pnlSign}$${Math.abs(pnl).toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
  const exitText =
    typeof event.exitPrice === 'number' && Number.isFinite(event.exitPrice)
      ? ` @ $${event.exitPrice.toFixed(priceDecimals)}`
      : '';

  return {
    title: `Trade Closed (${pnlText}): ${event.direction} ${event.instrumentId}`,
    summary: `Closed ${event.direction} ${lotLabel} ${event.instrumentId}${exitText} · Realized P&L ${pnlText}`,
  };
}

export function buildTradeAlertCopy(event: TradeLifecycleAlertEvent): { title: string; body: string } {
  const priceDecimals = event.instrumentId.includes('10Y') ? 3 : 2;
  const lotLabel = `${Number(event.lots).toFixed(event.lots < 1 ? 2 : 1)} lots`;

  if (event.eventType === 'TRADE_OPENED') {
    return {
      title: `Trade Opened · ${event.direction} ${event.instrumentId}`,
      body: `${lotLabel} @ $${event.entryPrice.toFixed(priceDecimals)} · SL $${event.stopLoss.toFixed(
        priceDecimals
      )} · TP $${event.takeProfit.toFixed(priceDecimals)}`,
    };
  }

  const pnl = Number(event.realizedPnl ?? 0);
  const pnlPrefix = pnl >= 0 ? '+$' : '-$';
  const pnlFormatted = `${pnlPrefix}${Math.abs(pnl).toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
  const exitStr =
    typeof event.exitPrice === 'number' && Number.isFinite(event.exitPrice)
      ? `$${event.exitPrice.toFixed(priceDecimals)}`
      : 'Market';

  return {
    title: `Trade Closed (${pnlFormatted}) · ${event.direction} ${event.instrumentId}`,
    body: `${lotLabel} closed @ ${exitStr} (Entry $${event.entryPrice.toFixed(priceDecimals)})${
      event.reason ? ` · ${event.reason}` : ''
    }`,
  };
}

export function buildTradeAlertRecord(input: EmitTradeAlertInput): TradeLifecycleAlertEvent {
  return {
    id: `TA-${Date.now()}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`,
    userId: input.userId,
    eventType: input.eventType,
    positionId: input.positionId,
    instrumentId: input.instrumentId,
    direction: input.direction,
    lots: input.lots,
    entryPrice: input.entryPrice,
    exitPrice: input.exitPrice,
    stopLoss: input.stopLoss,
    takeProfit: input.takeProfit,
    realizedPnl: input.realizedPnl,
    status: input.status,
    triggerSource: input.triggerSource,
    reason: input.reason,
    timestamp: new Date().toISOString(),
    read: false,
    browserNotified: false,
    serverDispatched: false,
  };
}

export async function dispatchTradeLifecycleAlert(
  input: EmitTradeAlertInput,
  options?: { skipServer?: boolean }
): Promise<{
  alert: TradeLifecycleAlertEvent;
  allAlerts: TradeLifecycleAlertEvent[];
}> {
  const alert = buildTradeAlertRecord(input);
  const { title, body } = buildTradeAlertCopy(alert);

  // 1. Optional browser push notification if user enabled desktop notifications
  if (isBrowserPushSupported() && window.Notification.permission === 'granted') {
    try {
      new window.Notification(title, {
        body,
        tag: `${alert.eventType}-${alert.positionId}`,
      });
      alert.browserNotified = true;
    } catch {
      // ignore sandboxed iframe Notification constructor restrictions
    }
  }

  // 2. Persist immediately into the active user's private alert history
  const existing = loadUserTradeAlerts(input.userId);
  const updatedList = saveUserTradeAlerts(input.userId, [alert, ...existing]);

  // 3. Server multi-channel notification relay (Telegram / Discord / Slack) for signed-in users
  if (!options?.skipServer && typeof fetch === 'function') {
    try {
      const session = getCurrentSession();
      if (session.role !== 'GUEST') {
        const token = (await ensureSignedBearerToken(session)) || getSessionBearerToken(session);
        if (token) {
          const resp = await fetch('/api/alerts/trade-lifecycle', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${token}`,
            },
            body: JSON.stringify({
              eventType: alert.eventType,
              positionId: alert.positionId,
              instrumentId: alert.instrumentId,
              direction: alert.direction,
              lots: alert.lots,
              entryPrice: alert.entryPrice,
              exitPrice: alert.exitPrice,
              stopLoss: alert.stopLoss,
              takeProfit: alert.takeProfit,
              realizedPnl: alert.realizedPnl,
              status: alert.status,
              triggerSource: alert.triggerSource,
              reason: alert.reason,
            }),
          });
          if (resp.ok) {
            alert.serverDispatched = true;
            const currentLatest = loadUserTradeAlerts(input.userId);
            saveUserTradeAlerts(
              input.userId,
              currentLatest.map((item) =>
                item.id === alert.id ? { ...item, serverDispatched: true } : item
              )
            );
          }
        }
      }
    } catch {
      // non-blocking telemetry / webhook dispatch
    }
  }

  return {
    alert,
    allAlerts: loadUserTradeAlerts(input.userId),
  };
}
