/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * Aurum Intelligence — Multi-Agent LLM Platform Settings & Publication Gate Workspace
 */

import React, { useState, useEffect } from 'react';
import { getSessionBearerToken } from '../services/authService';
import {
  LLMProviderId,
  PublicationGateReport,
  SpecialistAgentRole,
} from '../domain/types';
import {
  Cpu,
  ShieldCheck,
  Zap,
  Key,
  Sliders,
  CheckCircle,
  XCircle,
  AlertTriangle,
  RotateCw,
  Eye,
  EyeOff,
  Server,
  Lock,
} from 'lucide-react';

export const LLMSettingsWorkspace: React.FC = () => {
  const [provider, setProvider] = useState<LLMProviderId>('GEMINI');
  const [modelName, setModelName] = useState('gemini-3.8-flash');
  const [apiKeyInput, setApiKeyInput] = useState('');
  const [showKey, setShowKey] = useState(false);
  const [temperature, setTemperature] = useState(0.2);
  const [maxTokens, setMaxTokens] = useState(4096);
  const [timeoutMs, setTimeoutMs] = useState(15000);
  const [isGeminiDefault, setIsGeminiDefault] = useState(true);

  const [activeAgents, setActiveAgents] = useState<Record<SpecialistAgentRole, boolean>>({
    MACRO_INTELLIGENCE: true,
    HISTORICAL_RESEARCH: true,
    GOLD_FUNDAMENTALS: true,
    TECHNICAL_ANALYSIS: true,
    QUANTITATIVE_STRATEGY: true,
    MARKET_STRUCTURE: true,
    NEWS_EVENT_RISK: true,
    CFD_RISK: true,
    PORTFOLIO_EXPOSURE: true,
    INDEPENDENT_CHALLENGE: true,
    ADVISORY_COUNCIL: true,
  });

  const [testStatus, setTestStatus] = useState<{
    testing: boolean;
    success?: boolean;
    message?: string;
    latencyMs?: number;
  }>({ testing: false });

  const [gateReport, setGateReport] = useState<PublicationGateReport | null>(null);
  const [testingGate, setTestingGate] = useState(false);
  const [saveSuccessNotice, setSaveSuccessNotice] = useState(false);
  const [saveErrorNotice, setSaveErrorNotice] = useState<string | null>(null);

  // Fetch initial settings from server
  useEffect(() => {
    fetch('/api/llm/settings')
      .then((res) => res.json())
      .then((data) => {
        if (data) {
          setProvider(data.provider || 'GEMINI');
          setModelName(data.modelName || 'gemini-3.8-flash');
          setTemperature(data.temperature ?? 0.2);
          setMaxTokens(data.maxTokens ?? 4096);
          setTimeoutMs(data.timeoutMs ?? 15000);
          setIsGeminiDefault(Boolean(data.isGeminiDefault));
          if (data.activeAgents) setActiveAgents(data.activeAgents);
          if (data.maskedApiKey) {
            setApiKeyInput(data.maskedApiKey);
          }
        }
      })
      .catch((e) => console.warn('Could not fetch LLM settings:', e));

    runGateAudit();
  }, []);

  const handleTestConnection = async () => {
    setTestStatus({ testing: true });
    try {
      const token = getSessionBearerToken();
      const res = await fetch('/api/llm/test', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          apiKey: apiKeyInput && !apiKeyInput.includes('•••') && !apiKeyInput.includes('***') ? apiKeyInput : undefined,
        }),
      });
      const data = await res.json().catch(() => ({}));
      setTestStatus({
        testing: false,
        success: res.ok && Boolean(data.success),
        message: data.message || data.error || (!res.ok ? `Connection test failed (HTTP ${res.status}).` : undefined),
        latencyMs: data.latencyMs,
      });
    } catch (err: any) {
      setTestStatus({
        testing: false,
        success: false,
        message: err.message,
        latencyMs: 0,
      });
    }
  };

  const handleSaveSettings = async () => {
    setSaveErrorNotice(null);
    try {
      const token = getSessionBearerToken();
      const res = await fetch('/api/llm/settings', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          provider,
          modelName,
          temperature,
          maxTokens,
          timeoutMs,
          activeAgents,
          apiKey: apiKeyInput && !apiKeyInput.includes('•••') && !apiKeyInput.includes('***') ? apiKeyInput : undefined,
        }),
      });
      if (res.ok) {
        setSaveSuccessNotice(true);
        setTimeout(() => setSaveSuccessNotice(false), 3000);
      } else {
        const errData = await res.json().catch(() => ({}));
        setSaveErrorNotice(errData?.error || `Settings save rejected (HTTP ${res.status}). PRO tier authorization required.`);
      }
    } catch (err: any) {
      setSaveErrorNotice(err?.message || 'Network error saving LLM settings.');
    }
  };

  const runGateAudit = async () => {
    setTestingGate(true);
    try {
      const res = await fetch('/api/advisory/publication-gate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ instrumentId: 'XAUUSD', commodity: 'GOLD', period: '5Y' }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        setGateReport(data);
      } else {
        setSaveErrorNotice(data?.error || `Publication gate check failed (HTTP ${res.status}).`);
      }
    } catch (err: any) {
      setSaveErrorNotice(err?.message || 'Error running publication gate audit.');
    } finally {
      setTestingGate(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-slate-900 border border-slate-800 rounded-xl p-5 shadow-xs">
        <div>
          <div className="flex items-center gap-2">
            <Cpu className="w-5 h-5 text-amber-400" />
            <h2 className="text-xl font-bold text-white tracking-wide">
              LLM Platform Configuration & Publication Gate
            </h2>
          </div>
          <p className="text-sm text-slate-400 mt-1">
            Provider-neutral multi-agent architecture with Google Gemini default and deterministic risk gating.
          </p>
        </div>

        <div className="flex items-center gap-2">
          {saveSuccessNotice && (
            <span className="text-xs text-emerald-400 font-mono flex items-center gap-1 bg-emerald-950/40 px-2.5 py-1 rounded border border-emerald-800">
              <CheckCircle className="w-3.5 h-3.5" />
              Settings Saved
            </span>
          )}
          {saveErrorNotice && (
            <span
              role="alert"
              aria-live="polite"
              className="text-xs text-rose-300 font-mono flex items-center gap-1 bg-rose-950/50 px-2.5 py-1 rounded border border-rose-500/40"
            >
              <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
              {saveErrorNotice}
            </span>
          )}
          <button
            onClick={handleSaveSettings}
            className="px-4 py-2 bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold text-xs rounded-lg transition-colors cursor-pointer"
          >
            Save Configuration
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column: Provider & Key Configuration */}
        <div className="lg:col-span-2 space-y-6">
          {/* Provider Selection Card */}
          <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-5 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <span className="text-xs font-mono uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                <Server className="w-4 h-4 text-amber-400" />
                LLM Provider Selection
              </span>
              {isGeminiDefault && (
                <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">
                  Gemini Default Active
                </span>
              )}
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {[
                { id: 'GEMINI' as LLMProviderId, name: 'Google Gemini', sub: 'Default for New Installs' },
                { id: 'OPENAI' as LLMProviderId, name: 'OpenAI', sub: 'GPT-4o / O3' },
                { id: 'ANTHROPIC' as LLMProviderId, name: 'Anthropic', sub: 'Claude 3.5 Sonnet' },
                { id: 'LOCAL' as LLMProviderId, name: 'Custom / Local', sub: 'Ollama / vLLM' },
              ].map((p) => (
                <button
                  key={p.id}
                  onClick={() => setProvider(p.id)}
                  className={`p-3 rounded-lg border text-left transition-colors cursor-pointer ${
                    provider === p.id
                      ? 'bg-amber-500/10 border-amber-500/50 text-white'
                      : 'bg-slate-950/60 border-slate-800 text-slate-400 hover:border-slate-700'
                  }`}
                >
                  <div className="text-xs font-bold text-slate-200">{p.name}</div>
                  <div className="text-[10px] text-slate-500 mt-0.5">{p.sub}</div>
                </button>
              ))}
            </div>

            {/* Model Name & API Key */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
              <div>
                <label className="block text-xs font-mono text-slate-400 mb-1">
                  Active Model Name:
                </label>
                <input
                  type="text"
                  value={modelName}
                  onChange={(e) => setModelName(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs font-mono text-white focus:outline-none focus:border-amber-500"
                  placeholder="gemini-3.8-flash"
                />
                <span className="text-[10px] text-slate-500 mt-1 block">
                  Recommended: <code className="text-amber-400">gemini-3.8-flash</code> (Official SDK alias)
                </span>
              </div>

              <div>
                <label className="block text-xs font-mono text-slate-400 mb-1 flex items-center justify-between">
                  <span>API Key (Secure Masked):</span>
                  <Lock className="w-3 h-3 text-slate-500" />
                </label>
                <div className="relative">
                  <input
                    type={showKey ? 'text' : 'password'}
                    value={apiKeyInput}
                    onChange={(e) => setApiKeyInput(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg pl-3 pr-9 py-2 text-xs font-mono text-white focus:outline-none focus:border-amber-500"
                    placeholder="Enter API Key or use environment"
                  />
                  <button
                    type="button"
                    onClick={() => setShowKey(!showKey)}
                    className="absolute right-2.5 top-2.5 text-slate-500 hover:text-slate-300"
                  >
                    {showKey ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                  </button>
                </div>
                <span className="text-[10px] text-slate-500 mt-1 block">
                  Keys are stored server-side and never exposed in client logs or URLs.
                </span>
              </div>
            </div>

            {/* Test Connection Button & Status */}
            <div className="pt-2 flex flex-wrap items-center justify-between gap-3 border-t border-slate-800/80">
              <button
                onClick={handleTestConnection}
                disabled={testStatus.testing}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 disabled:opacity-50 text-slate-200 text-xs font-mono rounded-lg transition-colors cursor-pointer"
              >
                <Zap className="w-3.5 h-3.5 text-amber-400" />
                {testStatus.testing ? 'Testing Endpoint...' : 'Test Connection'}
              </button>

              {testStatus.message && (
                <div
                  className={`text-xs font-mono flex items-center gap-1.5 ${
                    testStatus.success ? 'text-emerald-400' : 'text-rose-400'
                  }`}
                >
                  {testStatus.success ? (
                    <CheckCircle className="w-3.5 h-3.5 shrink-0" />
                  ) : (
                    <XCircle className="w-3.5 h-3.5 shrink-0" />
                  )}
                  <span>{testStatus.message}</span>
                </div>
              )}
            </div>
          </div>

          {/* Model Hyperparameters & Budget */}
          <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-5 space-y-4">
            <span className="text-xs font-mono uppercase tracking-wider text-slate-400 flex items-center gap-1.5 border-b border-slate-800 pb-3">
              <Sliders className="w-4 h-4 text-amber-400" />
              Runtime Hyperparameters & Token Budget
            </span>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label className="block text-xs font-mono text-slate-400 mb-1">
                  Temperature: <strong className="text-white">{temperature}</strong>
                </label>
                <input
                  type="range"
                  min="0.0"
                  max="1.0"
                  step="0.05"
                  value={temperature}
                  onChange={(e) => setTemperature(parseFloat(e.target.value))}
                  className="w-full accent-amber-500"
                />
                <span className="text-[10px] text-slate-500">Low values maximize factual accuracy</span>
              </div>

              <div>
                <label className="block text-xs font-mono text-slate-400 mb-1">
                  Max Output Tokens:
                </label>
                <input
                  type="number"
                  value={maxTokens}
                  onChange={(e) => setMaxTokens(parseInt(e.target.value) || 2048)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-1.5 text-xs font-mono text-white"
                />
              </div>

              <div>
                <label className="block text-xs font-mono text-slate-400 mb-1">
                  Request Timeout (ms):
                </label>
                <input
                  type="number"
                  value={timeoutMs}
                  onChange={(e) => setTimeoutMs(parseInt(e.target.value) || 15000)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-1.5 text-xs font-mono text-white"
                />
              </div>
            </div>

            <div className="p-3 bg-slate-950/70 rounded-lg border border-slate-800/80 flex flex-wrap items-center justify-between gap-3 text-xs font-mono">
              <div>
                <span className="text-slate-400">Monthly Usage: </span>
                <strong className="text-white">142,800</strong> / 5,000,000 tokens
              </div>
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-400"></span>
                <span className="text-emerald-400">Well within safety budget</span>
              </div>
            </div>
          </div>
        </div>

        {/* Right Column: Deterministic Publication Gate */}
        <div className="space-y-6">
          <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-5 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <span className="text-xs font-mono uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                <ShieldCheck className="w-4 h-4 text-emerald-400" />
                Publication Gate Audit
              </span>
              <button
                onClick={runGateAudit}
                disabled={testingGate}
                className="text-xs text-amber-400 hover:text-amber-300 flex items-center gap-1 font-mono"
              >
                <RotateCw className={`w-3 h-3 ${testingGate ? 'animate-spin' : ''}`} />
                Re-check
              </button>
            </div>

            <p className="text-xs text-slate-400 leading-relaxed">
              Section 8.4 & 9.4 mandate: deterministic code has absolute authority over publication. LLMs cannot publish advisories if any gate fails.
            </p>

            {gateReport ? (
              <div className="space-y-2.5">
                {/* Master Gate Status */}
                <div
                  className={`p-3 rounded-lg border flex items-center gap-2 font-mono text-xs ${
                    gateReport.passed
                      ? 'bg-emerald-950/30 border-emerald-500/40 text-emerald-300'
                      : 'bg-rose-950/30 border-rose-500/40 text-rose-300'
                  }`}
                >
                  {gateReport.passed ? (
                    <CheckCircle className="w-4 h-4 shrink-0 text-emerald-400" />
                  ) : (
                    <XCircle className="w-4 h-4 shrink-0 text-rose-400" />
                  )}
                  <span className="font-bold">
                    {gateReport.passed
                      ? 'ALL GATES PASSED — PUBLICATION AUTHORIZED'
                      : 'PUBLICATION BLOCKED BY GATE'}
                  </span>
                </div>

                {/* Individual Check Items */}
                {Object.entries(gateReport.checks).map(([key, val]) => (
                  <div
                    key={key}
                    className="p-2.5 bg-slate-950/60 rounded border border-slate-800/80 text-xs font-mono flex items-start gap-2"
                  >
                    {val.passed ? (
                      <CheckCircle className="w-3.5 h-3.5 text-emerald-400 shrink-0 mt-0.5" />
                    ) : (
                      <XCircle className="w-3.5 h-3.5 text-rose-400 shrink-0 mt-0.5" />
                    )}
                    <div>
                      <div className="text-slate-300 font-semibold capitalize">
                        {key.replace(/([A-Z])/g, ' $1')}
                      </div>
                      <div className="text-[11px] text-slate-500 mt-0.5">{val.message}</div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-xs text-slate-500 font-mono py-4 text-center">
                Running deterministic gate evaluation...
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
