/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * Aurum Intelligence — Multi-Channel & Telegram Notifications Workspace
 */

import React, { useState, useEffect } from 'react';
import { DeliveryLog, NotificationConfig } from '../services/notificationService';
import { getSessionBearerToken } from '../services/authService';
import {
  Send,
  Bell,
  MessageSquare,
  ShieldCheck,
  CheckCircle2,
  XCircle,
  HelpCircle,
  Clock,
  Flame,
} from 'lucide-react';

export const NotificationSettingsWorkspace: React.FC = () => {
  const [config, setConfig] = useState<NotificationConfig | null>(null);
  const [logs, setLogs] = useState<DeliveryLog[]>([]);
  const [isTesting, setIsTesting] = useState(false);
  const [testStatus, setTestStatus] = useState<{ success: boolean; message: string } | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  useEffect(() => {
    fetchNotificationStatus();
  }, []);

  const fetchNotificationStatus = async () => {
    try {
      const res = await fetch('/api/notifications/status');
      const data = await res.json();
      if (!res.ok) {
        setSaveError(data?.error || `HTTP ${res.status} loading notification settings.`);
        return;
      }
      setConfig(data.config);
      setLogs(data.logs || []);
    } catch (e: any) {
      setSaveError(e?.message || 'Unable to reach notification settings endpoint.');
    }
  };

  const handleSaveConfig = async () => {
    if (!config) return;
    setIsSaving(true);
    setSaveError(null);
    try {
      const token = getSessionBearerToken();
      const res = await fetch('/api/notifications/config', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify(config),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setSaveError(data?.error || `Save rejected (HTTP ${res.status}): PRO tier token required.`);
        return;
      }
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 2500);
      fetchNotificationStatus();
    } catch (e: any) {
      setSaveError(e?.message || 'Error saving notification config.');
    } finally {
      setIsSaving(false);
    }
  };

  const [showPayloadPreview, setShowPayloadPreview] = useState(false);

  const sampleEvent = {
    id: 'ADVISORY-2026-XAU-4018',
    category: 'ADVISORY' as const,
    severity: 'SUCCESS' as const,
    title: 'XAU/USD Invalidation Re-Anchor & Long Corridor Active',
    message: 'Gold spot holds $3,898.90 with confirmed 1:2.8 R:R corridor ($4,018.50 - $4,036.50). Invalidation at daily close < $3,888.00.',
    timestamp: new Date().toISOString(),
    metadata: {
      instrument: 'XAUUSD',
      currentMid: 3898.90,
      rewardToRisk: '1:2.8',
      provider: 'LBMA/COMEX Continuous Spot',
    },
  };

  const getPreviewPayload = () => {
    const type = config?.webhookType || 'DISCORD';
    if (type === 'DISCORD') {
      return {
        username: 'Aurum Intelligence • Advisory Engine',
        avatar_url: 'https://aurum.trade/assets/icon.png',
        embeds: [
          {
            title: `[SUCCESS] ${sampleEvent.title}`,
            description: sampleEvent.message,
            color: 0x10b981,
            fields: [
              { name: 'Category', value: sampleEvent.category, inline: true },
              { name: 'Severity', value: sampleEvent.severity, inline: true },
              { name: 'Instrument', value: 'XAUUSD', inline: true },
              { name: 'Reward:Risk', value: '1:2.8 Net', inline: true },
              { name: 'Provider', value: 'Continuous COMEX/LBMA', inline: true },
            ],
            footer: { text: 'Aurum Advisory Gateway • Non-Execution Research' },
            timestamp: sampleEvent.timestamp,
          },
        ],
      };
    } else if (type === 'SLACK') {
      return {
        text: `🔔 *[SUCCESS] ${sampleEvent.title}* - ${sampleEvent.message}`,
        blocks: [
          {
            type: 'header',
            text: { type: 'plain_text', text: `🔔 ${sampleEvent.title}`, emoji: true },
          },
          {
            type: 'section',
            fields: [
              { type: 'mrkdwn', text: `*Category:*\n\`ADVISORY\`` },
              { type: 'mrkdwn', text: `*Severity:*\n\`SUCCESS\`` },
              { type: 'mrkdwn', text: `*Instrument:*\n\`XAUUSD\`` },
              { type: 'mrkdwn', text: `*Reward:Risk:*\n\`1:2.8 Net\`` },
            ],
          },
          {
            type: 'section',
            text: { type: 'mrkdwn', text: sampleEvent.message },
          },
        ],
      };
    } else {
      return {
        event_id: sampleEvent.id,
        category: sampleEvent.category,
        severity: sampleEvent.severity,
        title: sampleEvent.title,
        message: sampleEvent.message,
        timestamp: sampleEvent.timestamp,
        metadata: sampleEvent.metadata,
        signature_seal: 'AURUM-SIG-XAU4018',
      };
    }
  };

  const handleSendTestMessage = async (channel: 'TELEGRAM' | 'WEBHOOK', webhookType?: 'DISCORD' | 'SLACK' | 'GENERIC') => {
    setIsTesting(true);
    setTestStatus(null);
    try {
      const token = getSessionBearerToken();
      const res = await fetch('/api/notifications/test', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ channel, webhookType }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok && data.success) {
        setTestStatus({ success: true, message: `${channel} alert successfully dispatched!` });
      } else {
        setTestStatus({
          success: false,
          message: data.result?.error || data.error || `Delivery failed (HTTP ${res.status}). Check endpoint configuration.`,
        });
      }
      fetchNotificationStatus();
    } catch (e: any) {
      setTestStatus({ success: false, message: e.message });
    } finally {
      setIsTesting(false);
    }
  };

  if (!config) {
    return (
      <div className="p-8 text-xs font-mono text-slate-400">
        {saveError ? (
          <div role="alert" className="p-3 rounded bg-rose-500/10 border border-rose-500/30 text-rose-300">
            {saveError}
          </div>
        ) : (
          'Loading notification configuration...'
        )}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Top Banner */}
      <div className="bg-slate-900 border border-slate-800 rounded-lg p-5">
        <div className="flex flex-wrap items-center justify-between gap-4 pb-3 border-b border-slate-800">
          <div>
            <span className="text-xs font-mono text-amber-400 uppercase tracking-wider block">
              Operational & Advisory Notification Hub • NOTIF-01 Hardened
            </span>
            <h2 className="text-lg font-bold text-slate-100 flex items-center gap-2 mt-0.5">
              <Send className="w-5 h-5 text-amber-400" />
              Telegram, Discord & Slack Multi-Channel Alert Gateway
            </h2>
          </div>
          <button
            type="button"
            onClick={handleSaveConfig}
            disabled={isSaving}
            className="px-4 py-1.5 text-xs font-semibold text-slate-950 bg-amber-400 hover:bg-amber-300 rounded transition-colors"
          >
            {saveSuccess ? 'Settings Saved!' : 'Save Notification Settings'}
          </button>
        </div>
        <p className="text-xs text-slate-300 mt-2.5 leading-relaxed">
          Configure real-time notifications for market data incidents (stale quotes, feed disconnects, spread spikes), application health events, and confirmed trade setups delivered directly to your Telegram bot, Discord channel, or Slack workspace.
        </p>
        {saveError && (
          <div role="alert" className="mt-3 p-2.5 rounded bg-rose-500/10 border border-rose-500/30 text-xs font-mono text-rose-300 flex items-center gap-2">
            <XCircle className="w-4 h-4 shrink-0" />
            <span>{saveError}</span>
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column: Telegram Configuration */}
        <div className="lg:col-span-6 bg-slate-900 border border-slate-800 rounded-lg p-5 space-y-4">
          <div className="flex items-center justify-between pb-2 border-b border-slate-800">
            <h3 className="text-sm font-bold text-slate-100 flex items-center gap-2">
              <MessageSquare className="w-4 h-4 text-amber-400" />
              Telegram Bot Integration
            </h3>
            <label className="flex items-center gap-2 text-xs font-mono text-slate-300 cursor-pointer">
              <input
                type="checkbox"
                checked={config.telegramEnabled}
                onChange={(e) => setConfig({ ...config, telegramEnabled: e.target.checked })}
                className="rounded bg-slate-950 border-slate-700 text-amber-500"
              />
              <span>Enabled</span>
            </label>
          </div>

          <div className="space-y-3 text-xs font-mono">
            <div>
              <label className="text-slate-400 block mb-1">Telegram Bot Token</label>
              <input
                type="password"
                placeholder="e.g. 1234567890:ABCdefGhIJKlmNoPQRsTUVwxyZ"
                value={config.telegramBotToken || ''}
                onChange={(e) => setConfig({ ...config, telegramBotToken: e.target.value })}
                className="w-full bg-slate-950 border border-slate-700 rounded px-3 py-2 text-slate-100 focus:outline-none focus:border-amber-400"
              />
            </div>

            <div>
              <label className="text-slate-400 block mb-1">Telegram Destination Chat ID</label>
              <input
                type="text"
                placeholder="e.g. 987654321 or -1001234567890"
                value={config.telegramChatId || ''}
                onChange={(e) => setConfig({ ...config, telegramChatId: e.target.value })}
                className="w-full bg-slate-950 border border-slate-700 rounded px-3 py-2 text-slate-100 focus:outline-none focus:border-amber-400"
              />
            </div>

            {/* Test Action & Result */}
            <div className="pt-2">
              <button
                onClick={() => handleSendTestMessage('TELEGRAM')}
                disabled={isTesting || !config.telegramBotToken || !config.telegramChatId}
                className="w-full py-2 bg-slate-950 hover:bg-slate-800 disabled:opacity-50 text-amber-300 border border-slate-800 rounded font-semibold transition-colors flex items-center justify-center gap-2"
              >
                <Send className="w-3.5 h-3.5" />
                {isTesting ? 'Sending Test...' : 'Send Test Telegram Alert'}
              </button>

              {testStatus && (
                <div
                  className={`mt-2 p-2.5 rounded text-xs flex items-center gap-2 ${
                    testStatus.success
                      ? 'bg-emerald-500/10 text-emerald-300 border border-emerald-500/30'
                      : 'bg-rose-500/10 text-rose-300 border border-rose-500/30'
                  }`}
                >
                  {testStatus.success ? <CheckCircle2 className="w-4 h-4" /> : <XCircle className="w-4 h-4" />}
                  <span>{testStatus.message}</span>
                </div>
              )}
            </div>

            {/* Setup Instructions Box */}
            <div className="p-3 bg-slate-950/70 border border-slate-800/80 rounded text-[11px] space-y-1 text-slate-400 font-sans">
              <strong className="text-amber-400 font-mono block uppercase">Telegram Quick Setup:</strong>
              <p>1. Open Telegram and search for <code>@BotFather</code> to generate your bot token.</p>
              <p>2. Send <code>/newbot</code> and copy the HTTP Token.</p>
              <p>3. Message <code>@userinfobot</code> in Telegram to obtain your Chat ID.</p>
              <p>4. Send any initial message to your bot in Telegram, then click test alert above.</p>
            </div>
          </div>
        </div>

        {/* Right Column: Webhook Settings & Trigger Rules */}
        <div className="lg:col-span-6 space-y-4">
          {/* Webhooks Box */}
          <div className="bg-slate-900 border border-slate-800 rounded-lg p-5 space-y-3">
            <div className="flex items-center justify-between pb-2 border-b border-slate-800">
              <h3 className="text-sm font-bold text-slate-100 flex items-center gap-2">
                <Bell className="w-4 h-4 text-amber-400" />
                Discord / Slack / Generic Webhook
              </h3>
              <label className="flex items-center gap-2 text-xs font-mono text-slate-300 cursor-pointer">
                <input
                  type="checkbox"
                  checked={config.webhookEnabled}
                  onChange={(e) => setConfig({ ...config, webhookEnabled: e.target.checked })}
                  className="rounded bg-slate-950 border-slate-700 text-amber-500"
                />
                <span>Enabled</span>
              </label>
            </div>

            <div className="text-xs font-mono space-y-3">
              {/* Webhook Format Selector */}
              <div>
                <label className="text-slate-400 block mb-1">Payload Format Protocol</label>
                <div className="grid grid-cols-3 gap-2">
                  {(['DISCORD', 'SLACK', 'GENERIC'] as const).map((fmt) => (
                    <button
                      key={fmt}
                      type="button"
                      onClick={() => setConfig({ ...config, webhookType: fmt })}
                      className={`py-1.5 px-2 rounded text-center border transition-all ${
                        (config.webhookType || 'DISCORD') === fmt
                          ? 'bg-amber-400/10 border-amber-400 text-amber-300 font-bold'
                          : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-slate-200'
                      }`}
                    >
                      {fmt === 'DISCORD' ? 'Discord Embed' : fmt === 'SLACK' ? 'Slack Blocks' : 'Generic JSON'}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="text-slate-400 block mb-1">Webhook Endpoint URL</label>
                <input
                  type="url"
                  placeholder={
                    config.webhookType === 'DISCORD'
                      ? 'https://discord.com/api/webhooks/...'
                      : config.webhookType === 'SLACK'
                      ? 'https://hooks.slack.com/services/...'
                      : 'https://api.yourdomain.com/v1/alerts'
                  }
                  value={config.webhookUrl || ''}
                  onChange={(e) => setConfig({ ...config, webhookUrl: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-700 rounded px-3 py-2 text-slate-100 focus:outline-none focus:border-amber-400"
                />
              </div>

              {/* Deduplication Window Slider */}
              <div className="pt-1">
                <div className="flex items-center justify-between text-slate-400 mb-1">
                  <span>Deduplication Cooldown Window</span>
                  <span className="text-amber-400 font-bold">{config.deduplicationWindowMinutes || 5} min</span>
                </div>
                <input
                  type="range"
                  min="1"
                  max="30"
                  value={config.deduplicationWindowMinutes || 5}
                  onChange={(e) => setConfig({ ...config, deduplicationWindowMinutes: Number(e.target.value) })}
                  className="w-full accent-amber-400 cursor-pointer"
                />
                <span className="text-[10px] text-slate-500 block mt-0.5">
                  Suppresses identical alerts within this window to prevent alert fatigue.
                </span>
              </div>

              {/* Actions & Preview */}
              <div className="flex items-center gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => handleSendTestMessage('WEBHOOK', config.webhookType)}
                  disabled={isTesting || !config.webhookUrl}
                  className="flex-1 py-1.5 bg-slate-950 hover:bg-slate-800 disabled:opacity-50 text-slate-200 border border-slate-800 rounded font-semibold transition-colors flex items-center justify-center gap-1.5"
                >
                  <Send className="w-3.5 h-3.5 text-amber-400" />
                  Send Test {config.webhookType || 'Webhook'} Ping
                </button>
                <button
                  type="button"
                  onClick={() => setShowPayloadPreview(!showPayloadPreview)}
                  className="px-3 py-1.5 bg-slate-950 border border-slate-800 hover:border-slate-700 text-slate-300 rounded font-sans text-xs"
                >
                  {showPayloadPreview ? 'Hide JSON' : 'Inspect JSON'}
                </button>
              </div>

              {/* JSON Payload Preview Box */}
              {showPayloadPreview && (
                <div className="p-3 bg-slate-950 rounded border border-slate-800 space-y-1.5">
                  <div className="flex items-center justify-between text-[11px] text-slate-400">
                    <span className="font-bold text-amber-400">Payload Preview ({config.webhookType || 'DISCORD'})</span>
                    <span className="text-slate-500 text-[10px]">Formatted JSON schema</span>
                  </div>
                  <pre className="text-[10px] text-slate-300 overflow-x-auto max-h-44 p-2 bg-slate-900 rounded font-mono">
                    {JSON.stringify(getPreviewPayload(), null, 2)}
                  </pre>
                </div>
              )}
            </div>
          </div>

          {/* Event Trigger Toggles */}
          <div className="bg-slate-900 border border-slate-800 rounded-lg p-5 space-y-3">
            <h3 className="text-sm font-bold text-slate-100 flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-amber-400" />
              Notification Trigger Policies
            </h3>
            <div className="space-y-2 text-xs font-mono text-slate-300">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={config.notifyOnStartup}
                  onChange={(e) => setConfig({ ...config, notifyOnStartup: e.target.checked })}
                  className="rounded bg-slate-950 border-slate-700 text-amber-500"
                />
                <span>Application Lifecycle (Startup, Health, Shutdown)</span>
              </label>

              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={config.notifyOnProviderFailover}
                  onChange={(e) => setConfig({ ...config, notifyOnProviderFailover: e.target.checked })}
                  className="rounded bg-slate-950 border-slate-700 text-amber-500"
                />
                <span>Provider Disconnection & Failover Activation</span>
              </label>

              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={config.notifyOnStaleData}
                  onChange={(e) => setConfig({ ...config, notifyOnStaleData: e.target.checked })}
                  className="rounded bg-slate-950 border-slate-700 text-amber-500"
                />
                <span>Data Quality Incidents (Stale Quotes, Spread Spikes)</span>
              </label>

              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={config.notifyOnNewAdvisory}
                  onChange={(e) => setConfig({ ...config, notifyOnNewAdvisory: e.target.checked })}
                  className="rounded bg-slate-950 border-slate-700 text-amber-500"
                />
                <span>New Validated Advisory Trade Setups (Buy/Sell Confirmed)</span>
              </label>
            </div>
          </div>
        </div>
      </div>

      {/* Delivery Audit Logs Table */}
      <div className="bg-slate-900 border border-slate-800 rounded-lg overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-800 flex items-center justify-between">
          <h3 className="text-sm font-semibold text-slate-100">
            Notification Delivery History & Audit Trail
          </h3>
          <span className="text-xs font-mono text-slate-400">
            {logs.length} Recent Dispatches
          </span>
        </div>

        <div className="overflow-x-auto max-h-60 overflow-y-auto">
          <table className="w-full text-xs text-left font-mono tabular-nums">
            <thead className="bg-slate-950 text-slate-400 uppercase text-[10px] sticky top-0 border-b border-slate-800">
              <tr>
                <th className="px-4 py-2.5">Dispatch ID</th>
                <th className="px-4 py-2.5">Timestamp</th>
                <th className="px-4 py-2.5">Channel</th>
                <th className="px-4 py-2.5">Destination</th>
                <th className="px-4 py-2.5 text-center">Status</th>
                <th className="px-4 py-2.5">Diagnostic Detail</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {logs.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-6 text-center text-slate-500">
                    No notification events dispatched yet. Use "Send Test Telegram Alert" above.
                  </td>
                </tr>
              ) : (
                logs.map((log) => (
                  <tr key={log.id} className="hover:bg-slate-800/30">
                    <td className="px-4 py-2.5 text-slate-300 font-bold">{log.id}</td>
                    <td className="px-4 py-2.5 text-slate-400">{log.timestamp.slice(11, 19)} UTC</td>
                    <td className="px-4 py-2.5 text-amber-400">{log.channel}</td>
                    <td className="px-4 py-2.5 text-slate-400">{log.destinationMasked}</td>
                    <td className="px-4 py-2.5 text-center">
                      <span
                        className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                          log.status === 'DELIVERED'
                            ? 'bg-emerald-500/10 text-emerald-400'
                            : log.status === 'SKIPPED_DEDUPE'
                            ? 'bg-amber-500/10 text-amber-400'
                            : 'bg-rose-500/10 text-rose-400'
                        }`}
                      >
                        {log.status}
                      </span>
                    </td>
                    <td className="px-4 py-2.5 text-slate-400 text-[11px] truncate max-w-xs">
                      {log.error || 'Delivered successfully without errors'}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
