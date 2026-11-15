/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * Aurum Intelligence — Multi-Channel Notification & Alert Engine
 * Telegram Bot API, Discord/Slack webhooks, deduplication, and delivery auditing.
 */

import { computeDeterministicSha256 } from './forecastAccountability';

export type NotificationChannelType = 'TELEGRAM' | 'DISCORD' | 'SLACK' | 'WEBHOOK';

export type NotificationCategory = 'LIFECYCLE' | 'DATA_QUALITY' | 'ADVISORY' | 'RISK_ALERT';

export type NotificationSeverity = 'INFO' | 'SUCCESS' | 'WARNING' | 'ERROR' | 'CRITICAL';

export interface NotificationEvent {
  id: string;
  category: NotificationCategory;
  severity: NotificationSeverity;
  title: string;
  message: string;
  timestamp: string;
  isCriticalStateChange?: boolean;
  metadata?: Record<string, any>;
}

export interface DeliveryLog {
  id: string;
  eventId: string;
  channel: NotificationChannelType;
  status: 'DELIVERED' | 'FAILED' | 'SKIPPED_DEDUPE';
  destinationMasked: string;
  timestamp: string;
  bypassedDedupe?: boolean;
  error?: string;
}

export interface NotificationConfig {
  enabled: boolean;
  telegramEnabled: boolean;
  telegramBotToken?: string;
  telegramChatId?: string;
  webhookEnabled: boolean;
  webhookUrl?: string;
  webhookType?: 'DISCORD' | 'SLACK' | 'GENERIC';
  notifyOnStartup: boolean;
  notifyOnProviderFailover: boolean;
  notifyOnStaleData: boolean;
  notifyOnNewAdvisory: boolean;
  deduplicationWindowMinutes: number;
}

export const DEFAULT_NOTIFICATION_CONFIG: NotificationConfig = {
  enabled: true,
  telegramEnabled: false,
  telegramBotToken: '',
  telegramChatId: '',
  webhookEnabled: false,
  webhookUrl: '',
  webhookType: 'DISCORD',
  notifyOnStartup: true,
  notifyOnProviderFailover: true,
  notifyOnStaleData: true,
  notifyOnNewAdvisory: true,
  deduplicationWindowMinutes: 5,
};

export interface DiscordEmbed {
  title: string;
  description: string;
  color: number;
  fields?: Array<{ name: string; value: string; inline?: boolean }>;
  footer?: { text: string };
  timestamp?: string;
}

export interface DiscordWebhookPayload {
  username?: string;
  avatar_url?: string;
  content?: string;
  embeds?: DiscordEmbed[];
}

export interface SlackBlock {
  type: string;
  text?: { type: string; text: string; emoji?: boolean };
  fields?: Array<{ type: string; text: string }>;
  elements?: Array<{ type: string; text: string }>;
}

export interface SlackWebhookPayload {
  text: string;
  blocks?: SlackBlock[];
}

export interface GenericWebhookPayload {
  event_id: string;
  category: NotificationCategory;
  severity: NotificationSeverity;
  title: string;
  message: string;
  timestamp: string;
  metadata?: Record<string, any>;
  signature_seal: string;
}

export function getSeverityColor(severity: NotificationSeverity): number {
  switch (severity) {
    case 'CRITICAL':
    case 'ERROR':
      return 0xe11d48; // Rose-600
    case 'WARNING':
      return 0xf59e0b; // Amber-500
    case 'SUCCESS':
      return 0x10b981; // Emerald-500
    case 'INFO':
    default:
      return 0x3b82f6; // Blue-500
  }
}

const SENSITIVE_META_KEY_REGEX = /(token|secret|apikey|password|accountnumber|brokeraccount|email)/i;

export function sanitizeNotificationMetadata(metadata?: Record<string, any>): Record<string, any> {
  if (!metadata) return {};
  const cleaned: Record<string, any> = {};
  for (const [k, v] of Object.entries(metadata)) {
    if (SENSITIVE_META_KEY_REGEX.test(k)) {
      cleaned[k] = '[REDACTED]';
    } else {
      cleaned[k] = v;
    }
  }
  return cleaned;
}

export function buildDiscordPayload(event: NotificationEvent): DiscordWebhookPayload {
  const fields = [
    { name: 'Category', value: event.category, inline: true },
    { name: 'Severity', value: event.severity, inline: true },
    { name: 'Platform', value: 'Aurum Intelligence v1.4', inline: true },
  ];

  const safeMeta = sanitizeNotificationMetadata(event.metadata);
  for (const [k, v] of Object.entries(safeMeta)) {
    fields.push({ name: k, value: String(v), inline: true });
  }

  return {
    username: 'Aurum Intelligence • Advisory Engine',
    avatar_url: 'https://aurum.trade/assets/icon.png',
    embeds: [
      {
        title: `[${event.severity}] ${event.title}`,
        description: event.message,
        color: getSeverityColor(event.severity),
        fields,
        footer: {
          text: 'Aurum Advisory Gateway • Non-Execution Research • SHA-256 Verified',
        },
        timestamp: event.timestamp,
      },
    ],
  };
}

export function buildSlackPayload(event: NotificationEvent): SlackWebhookPayload {
  const emoji = event.severity === 'CRITICAL' ? '🚨' : event.severity === 'WARNING' ? '⚠️' : '🔔';
  return {
    text: `${emoji} *[${event.severity}] ${event.title}* - ${event.message}`,
    blocks: [
      {
        type: 'header',
        text: {
          type: 'plain_text',
          text: `${emoji} ${event.title}`,
          emoji: true,
        },
      },
      {
        type: 'section',
        fields: [
          { type: 'mrkdwn', text: `*Category:*\n\`${event.category}\`` },
          { type: 'mrkdwn', text: `*Severity:*\n\`${event.severity}\`` },
        ],
      },
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: `${event.message}`,
        },
      },
      {
        type: 'context',
        elements: [
          {
            type: 'mrkdwn',
            text: `*Time:* ${event.timestamp} | *Engine:* Aurum Intelligence Institutional Feed`,
          },
        ],
      },
    ],
  };
}

export function buildGenericWebhookPayload(event: NotificationEvent): GenericWebhookPayload {
  const safeMeta = sanitizeNotificationMetadata(event.metadata);
  const canonicalString = `${event.id}|${event.category}|${event.severity}|${event.title}|${event.timestamp}`;
  const digest = computeDeterministicSha256(canonicalString);
  return {
    event_id: event.id,
    category: event.category,
    severity: event.severity,
    title: event.title,
    message: event.message,
    timestamp: event.timestamp,
    metadata: safeMeta,
    signature_seal: `sha256=${digest}`,
  };
}

export function formatWebhookPayload(
  event: NotificationEvent,
  type: 'DISCORD' | 'SLACK' | 'GENERIC' = 'DISCORD'
): DiscordWebhookPayload | SlackWebhookPayload | GenericWebhookPayload {
  switch (type) {
    case 'DISCORD':
      return buildDiscordPayload(event);
    case 'SLACK':
      return buildSlackPayload(event);
    case 'GENERIC':
    default:
      return buildGenericWebhookPayload(event);
  }
}

export class NotificationService {
  private config: NotificationConfig;
  private deliveryLogs: DeliveryLog[] = [];
  private dedupeCache: Map<string, number> = new Map();

  constructor(config: NotificationConfig = DEFAULT_NOTIFICATION_CONFIG) {
    this.config = { ...DEFAULT_NOTIFICATION_CONFIG, ...config };
  }

  private maskSecretTail(value?: string): string {
    if (!value) return '';
    if (value.length <= 10) return '****';
    return `${value.slice(0, 6)}...${value.slice(-4)}`;
  }

  private maskWebhookUrl(url?: string): string {
    if (!url) return '';
    try {
      const parsed = new URL(url);
      const tail = parsed.pathname.length > 8 ? `...${parsed.pathname.slice(-4)}` : '...';
      return `${parsed.protocol}//${parsed.host}/${tail}`;
    } catch {
      return this.maskSecretTail(url);
    }
  }

  private isMaskedPlaceholder(value?: string): boolean {
    return Boolean(value && (value.includes('...') || value.includes('•••') || value.includes('***')));
  }

  getConfig(): NotificationConfig {
    return {
      ...this.config,
      telegramBotToken: this.config.telegramBotToken ? this.maskSecretTail(this.config.telegramBotToken) : '',
      webhookUrl: this.config.webhookUrl ? this.maskWebhookUrl(this.config.webhookUrl) : '',
    };
  }

  getRawConfig(): NotificationConfig {
    return { ...this.config };
  }

  updateConfig(newConfig: Partial<NotificationConfig>) {
    const sanitized = { ...newConfig };
    if (this.isMaskedPlaceholder(sanitized.telegramBotToken)) {
      sanitized.telegramBotToken = this.config.telegramBotToken;
    }
    if (this.isMaskedPlaceholder(sanitized.webhookUrl)) {
      sanitized.webhookUrl = this.config.webhookUrl;
    }
    this.config = { ...this.config, ...sanitized };
  }

  getLogs(): DeliveryLog[] {
    return [...this.deliveryLogs].slice(-50);
  }

  clearDedupeCache(): void {
    this.dedupeCache.clear();
  }

  async dispatch(event: NotificationEvent): Promise<DeliveryLog[]> {
    if (!this.config.enabled) return [];

    // Critical state transitions (explicit isCriticalStateChange / stateTransition) NEVER get suppressed by deduplication (§13.3)
    const isCriticalTransition =
      event.isCriticalStateChange === true ||
      event.metadata?.stateTransition === true;

    const dedupeKey = `${event.category}:${event.title}`;
    const now = Date.now();
    const lastSent = this.dedupeCache.get(dedupeKey);
    const windowMs = (this.config.deduplicationWindowMinutes || 5) * 60 * 1000;

    if (!isCriticalTransition && lastSent && now - lastSent < windowMs) {
      const skippedLog: DeliveryLog = {
        id: `LOG-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        eventId: event.id,
        channel: this.config.webhookEnabled ? (this.config.webhookType || 'WEBHOOK') as NotificationChannelType : 'TELEGRAM',
        status: 'SKIPPED_DEDUPE',
        destinationMasked: `Deduplication Window (${this.config.deduplicationWindowMinutes}m Active)`,
        timestamp: new Date().toISOString(),
        error: `Suppressed duplicate alert within ${this.config.deduplicationWindowMinutes}m cooldown window`,
      };
      this.deliveryLogs.push(skippedLog);
      return [skippedLog];
    }

    this.dedupeCache.set(dedupeKey, now);
    const logs: DeliveryLog[] = [];

    // Dispatch to Telegram
    if (this.config.telegramEnabled && this.config.telegramBotToken && this.config.telegramChatId) {
      const log = await this.sendTelegram(event);
      if (isCriticalTransition && lastSent && now - lastSent < windowMs) {
        log.bypassedDedupe = true;
      }
      logs.push(log);
    }

    // Dispatch to Webhook
    if (this.config.webhookEnabled && this.config.webhookUrl) {
      const log = await this.sendWebhook(event);
      if (isCriticalTransition && lastSent && now - lastSent < windowMs) {
        log.bypassedDedupe = true;
      }
      logs.push(log);
    }

    return logs;
  }

  async sendTelegram(event: NotificationEvent): Promise<DeliveryLog> {
    const token = this.config.telegramBotToken || '';
    const chatId = this.config.telegramChatId || '';
    const logId = `LOG-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    const destinationMasked = chatId.length > 4 ? `${chatId.slice(0, 3)}***${chatId.slice(-2)}` : 'ChatID';

    const formattedMessage = `*AURUM INTELLIGENCE ALERT*
*Category:* ${event.category} | *Severity:* ${event.severity}
*Title:* ${event.title}

${event.message}

_Timestamp: ${event.timestamp}_`;

    // Simulated test channel when token is simulated or mock
    if (!token || token.includes('simulated') || token.includes('mock') || !chatId) {
      const simLog: DeliveryLog = {
        id: logId,
        eventId: event.id,
        channel: 'TELEGRAM',
        status: token && chatId ? 'DELIVERED' : 'FAILED',
        destinationMasked,
        timestamp: new Date().toISOString(),
        error: token && chatId ? undefined : 'Missing Telegram Bot Token or Chat ID',
      };
      this.deliveryLogs.push(simLog);
      return simLog;
    }

    try {
      const res = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: chatId,
          text: formattedMessage,
          parse_mode: 'Markdown',
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.ok) {
        throw new Error(data.description || `HTTP ${res.status}`);
      }

      const logResult: DeliveryLog = {
        id: logId,
        eventId: event.id,
        channel: 'TELEGRAM',
        status: 'DELIVERED',
        destinationMasked,
        timestamp: new Date().toISOString(),
      };
      this.deliveryLogs.push(logResult);
      return logResult;
    } catch (err: any) {
      const logResult: DeliveryLog = {
        id: logId,
        eventId: event.id,
        channel: 'TELEGRAM',
        status: 'FAILED',
        destinationMasked,
        timestamp: new Date().toISOString(),
        error: err.message,
      };
      this.deliveryLogs.push(logResult);
      return logResult;
    }
  }

  async sendWebhook(event: NotificationEvent, overrideType?: 'DISCORD' | 'SLACK' | 'GENERIC'): Promise<DeliveryLog> {
    const url = this.config.webhookUrl || '';
    const webhookType = overrideType || this.config.webhookType || 'DISCORD';
    const logId = `LOG-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    const destinationMasked = url.length > 20 ? `${url.slice(0, 12)}...${url.slice(-6)}` : (url || 'Webhook URL');
    const channelName = (webhookType === 'DISCORD' ? 'DISCORD' : webhookType === 'SLACK' ? 'SLACK' : 'WEBHOOK') as NotificationChannelType;

    const payload = formatWebhookPayload(event, webhookType);

    // Simulated dispatcher if URL is missing, simulated, or sandbox
    if (!url || url.includes('simulated') || url.includes('example.com') || url.startsWith('mock://')) {
      const isConfigured = Boolean(url);
      const simLog: DeliveryLog = {
        id: logId,
        eventId: event.id,
        channel: channelName,
        status: isConfigured ? 'DELIVERED' : 'FAILED',
        destinationMasked: destinationMasked || 'Simulated Webhook Endpoint',
        timestamp: new Date().toISOString(),
        error: isConfigured ? undefined : 'Webhook URL is not configured',
      };
      this.deliveryLogs.push(simLog);
      return simLog;
    }

    try {
      const signatureDigest = computeDeterministicSha256(
        `${event.id}|${event.category}|${event.severity}|${event.timestamp}`
      );
      const res = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-GoldVista-Signature-256': `sha256=${signatureDigest}`,
        },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        throw new Error(`Webhook returned HTTP ${res.status}`);
      }

      const logResult: DeliveryLog = {
        id: logId,
        eventId: event.id,
        channel: channelName,
        status: 'DELIVERED',
        destinationMasked,
        timestamp: new Date().toISOString(),
      };
      this.deliveryLogs.push(logResult);
      return logResult;
    } catch (err: any) {
      // If external network is blocked in sandbox or URL is invalid, record failed log with diagnostic detail
      const logResult: DeliveryLog = {
        id: logId,
        eventId: event.id,
        channel: channelName,
        status: 'FAILED',
        destinationMasked,
        timestamp: new Date().toISOString(),
        error: err.message,
      };
      this.deliveryLogs.push(logResult);
      return logResult;
    }
  }
}

export const canonicalNotificationService = new NotificationService();
