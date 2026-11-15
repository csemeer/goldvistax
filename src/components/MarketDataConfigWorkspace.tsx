/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * Aurum Intelligence — Market Data & Connections Workspace
 * Provider selection, broker connection settings, symbol mapping, test actions, and diagnostics.
 */

import React, { useState, useEffect } from 'react';
import { ProviderConfig, ProviderHealth } from '../services/marketDataProvider';
import { getSessionBearerToken } from '../services/authService';
import { Quote } from '../domain/types';
import {
  Server,
  Activity,
  CheckCircle2,
  AlertTriangle,
  RotateCw,
  Terminal,
  ShieldCheck,
  Zap,
  Sliders,
  Database,
} from 'lucide-react';

interface MarketDataConfigWorkspaceProps {
  currentQuote: Quote;
  onRefreshQuotes: () => void;
}

export const MarketDataConfigWorkspace: React.FC<MarketDataConfigWorkspaceProps> = ({
  currentQuote,
  onRefreshQuotes,
}) => {
  const [config, setConfig] = useState<ProviderConfig | null>(null);
  const [health, setHealth] = useState<Record<string, ProviderHealth>>({});
  const [isLoading, setIsLoading] = useState(false);
  const [testResult, setTestResult] = useState<any>(null);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [configError, setConfigError] = useState<string | null>(null);

  useEffect(() => {
    fetchStatus();
  }, []);

  const fetchStatus = async () => {
    try {
      const res = await fetch('/api/market-data/status');
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setConfigError(data?.error || `HTTP ${res.status} loading market data status.`);
        return;
      }
      setConfig(data.config);
      setHealth(data.health || {});
    } catch (e: any) {
      setConfigError(e?.message || 'Unable to reach market data status endpoint.');
    }
  };

  const handleSaveConfig = async () => {
    if (!config) return;
    setIsLoading(true);
    setConfigError(null);
    try {
      const token = getSessionBearerToken();
      const res = await fetch('/api/market-data/config', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify(config),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setConfigError(data?.error || `Save rejected (HTTP ${res.status}): PRO tier authorization required.`);
        return;
      }
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 2500);
      onRefreshQuotes();
      fetchStatus();
    } catch (e: any) {
      setConfigError(e?.message || 'Network error saving market data config.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleTestConnection = async (providerId: string) => {
    setIsLoading(true);
    setTestResult(null);
    setConfigError(null);
    try {
      const token = getSessionBearerToken();
      const res = await fetch('/api/market-data/test-connection', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ providerId }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setTestResult({
          success: false,
          providerId,
          latencyMs: 0,
          error: data?.error || `Probe failed (HTTP ${res.status}).`,
        });
        return;
      }
      setTestResult(data);
      fetchStatus();
    } catch (e: any) {
      setTestResult({ success: false, providerId, latencyMs: 0, error: e.message });
    } finally {
      setIsLoading(false);
    }
  };

  if (!config) {
    return (
      <div className="p-8 text-xs font-mono text-slate-400">
        {configError ? (
          <div role="alert" className="p-3 rounded bg-rose-500/10 border border-rose-500/30 text-rose-300">
            {configError}
          </div>
        ) : (
          'Loading market data configuration...'
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
              Market Data Subsystem Architecture
            </span>
            <h2 className="text-lg font-bold text-slate-100 flex items-center gap-2 mt-0.5">
              <Server className="w-5 h-5 text-amber-400" />
              Market Data Providers & Broker Connectivity
            </h2>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => {
                onRefreshQuotes();
                fetchStatus();
              }}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-mono bg-slate-950 hover:bg-slate-800 text-slate-200 border border-slate-800 rounded transition-colors"
            >
              <RotateCw className="w-3.5 h-3.5" /> Refresh Feeds
            </button>
            <button
              type="button"
              onClick={handleSaveConfig}
              disabled={isLoading}
              className="px-4 py-1.5 text-xs font-semibold text-slate-950 bg-amber-400 hover:bg-amber-300 rounded transition-colors"
            >
              {saveSuccess ? 'Settings Saved!' : 'Save Configuration'}
            </button>
          </div>
        </div>
        {configError && (
          <div role="alert" className="mt-3 p-2.5 rounded bg-rose-500/10 border border-rose-500/30 text-xs font-mono text-rose-300 flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 shrink-0" />
            <span>{configError}</span>
          </div>
        )}

        {/* Current Active Quote Provenance Callout */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-4 text-xs font-mono tabular-nums">
          <div className="bg-slate-950 p-3 rounded border border-slate-800">
            <span className="text-slate-500 block text-[10px]">ACTIVE GOLD SPOT MID</span>
            <span className="text-lg font-bold text-amber-400">${currentQuote.mid.toFixed(2)}</span>
            <span className="text-[10px] text-slate-500 block">Spread: {currentQuote.spreadPips} pips</span>
          </div>

          <div className="bg-slate-950 p-3 rounded border border-slate-800">
            <span className="text-slate-500 block text-[10px]">ACTIVE PROVIDER</span>
            <span className="text-slate-200 font-bold truncate block">{currentQuote.provider}</span>
            <span className="text-[10px] text-emerald-400 block">{currentQuote.quality} Mode</span>
          </div>

          <div className="bg-slate-950 p-3 rounded border border-slate-800">
            <span className="text-slate-500 block text-[10px]">FEED LATENCY</span>
            <span className="text-emerald-400 font-bold">{currentQuote.latencyMs} ms</span>
            <span className="text-[10px] text-slate-500 block">Round-Trip Measurement</span>
          </div>

          <div className="bg-slate-950 p-3 rounded border border-slate-800">
            <span className="text-slate-500 block text-[10px]">SOURCE TIMESTAMP (UTC)</span>
            <span className="text-slate-300 font-bold block">{currentQuote.timestamp.slice(11, 19)}</span>
            <span className="text-[10px] text-slate-500 block">Date: {currentQuote.timestamp.slice(0, 10)}</span>
          </div>
        </div>
      </div>

      {/* Provider Roster Cards */}
      <div>
        <h3 className="text-xs font-mono uppercase tracking-wider text-slate-400 mb-3">
          Available Provider Adapters
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
          {/* 1. Yahoo Finance */}
          <div className="bg-slate-900 border border-slate-800 p-4 rounded-lg flex flex-col justify-between">
            <div>
              <div className="flex justify-between items-center pb-2 border-b border-slate-800 text-xs font-mono">
                <span className="font-bold text-slate-200">Yahoo Finance</span>
                <span className="text-emerald-400 font-semibold bg-emerald-500/10 px-2 py-0.5 rounded">
                  {health.yahoo_finance?.status || 'ONLINE'}
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-2">
                Official free reference quotes for COMEX Gold (<code>GC=F</code>), Silver (<code>SI=F</code>), DXY, and Treasury yields.
              </p>
              <div className="text-[11px] font-mono text-slate-500 mt-2 space-y-0.5">
                <div>Type: Continuous Market Reference</div>
                <div>Latency: ~{health.yahoo_finance?.latencyMs || 140}ms</div>
              </div>
            </div>
            <button
              onClick={() => handleTestConnection('yahoo_finance')}
              className="mt-4 w-full py-1.5 text-xs font-mono bg-slate-950 hover:bg-slate-800 text-amber-300 border border-slate-800 rounded transition-colors"
            >
              Test Yahoo Live Quote
            </button>
          </div>

          {/* 2. Interactive Brokers */}
          <div className="bg-slate-900 border border-slate-800 p-4 rounded-lg flex flex-col justify-between">
            <div>
              <div className="flex justify-between items-center pb-2 border-b border-slate-800 text-xs font-mono">
                <span className="font-bold text-slate-200">Interactive Brokers</span>
                <span className="text-slate-400 font-semibold bg-slate-800 px-2 py-0.5 rounded">
                  {health.ibkr_gateway?.status || 'UNCONFIGURED'}
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-2">
                IBKR TWS / Client Portal Gateway. Supports qualified XAUUSD and physical gold contracts with live broker market data.
              </p>
              <div className="text-[11px] font-mono text-slate-500 mt-2 space-y-0.5">
                <div>Mode: Read-Only Market Feed</div>
                <div>Status: Advisory Only (No Order Exec)</div>
              </div>
            </div>
            <button
              onClick={() => handleTestConnection('ibkr_gateway')}
              className="mt-4 w-full py-1.5 text-xs font-mono bg-slate-950 hover:bg-slate-800 text-slate-300 border border-slate-800 rounded transition-colors"
            >
              Test Gateway Probe
            </button>
          </div>

          {/* 3. Alpaca */}
          <div className="bg-slate-900 border border-slate-800 p-4 rounded-lg flex flex-col justify-between">
            <div>
              <div className="flex justify-between items-center pb-2 border-b border-slate-800 text-xs font-mono">
                <span className="font-bold text-slate-200">Alpaca Market Data</span>
                <span className="text-slate-400 font-semibold bg-slate-800 px-2 py-0.5 rounded">
                  {health.alpaca_data?.status || 'UNCONFIGURED'}
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-2">
                Alpaca v2 Market Data. Quotes GLD, mining equities, and supported commodity ETF products.
              </p>
              <div className="text-[11px] font-mono text-slate-500 mt-2 space-y-0.5">
                <div>Coverage: ETFs & Benchmark Equities</div>
                <div>Note: Spot XAU requires metals add-on</div>
              </div>
            </div>
            <button
              onClick={() => handleTestConnection('alpaca_data')}
              className="mt-4 w-full py-1.5 text-xs font-mono bg-slate-950 hover:bg-slate-800 text-slate-300 border border-slate-800 rounded transition-colors"
            >
              Verify Alpaca API
            </button>
          </div>

          {/* 4. Simulated Benchmark */}
          <div className="bg-slate-900 border border-slate-800 p-4 rounded-lg flex flex-col justify-between">
            <div>
              <div className="flex justify-between items-center pb-2 border-b border-slate-800 text-xs font-mono">
                <span className="font-bold text-slate-200">Simulated Benchmark</span>
                <span className="text-amber-400 font-semibold bg-amber-500/10 px-2 py-0.5 rounded">
                  ACTIVE FALLBACK
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-2">
                Calibrated offline benchmark. Clearly labeled as SIMULATED so test data is never confused with live prices.
              </p>
              <div className="text-[11px] font-mono text-slate-500 mt-2 space-y-0.5">
                <div>Type: Offline Calibrated Engine</div>
                <div>Classification: Explicitly Simulated</div>
              </div>
            </div>
            <button
              onClick={() => handleTestConnection('simulated_reference')}
              className="mt-4 w-full py-1.5 text-xs font-mono bg-slate-950 hover:bg-slate-800 text-slate-300 border border-slate-800 rounded transition-colors"
            >
              Test Simulation
            </button>
          </div>
        </div>
      </div>

      {/* Provider Routing & Symbol Mapping Configuration */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <div className="lg:col-span-6 bg-slate-900 border border-slate-800 rounded-lg p-5 space-y-4">
          <h3 className="text-sm font-bold text-slate-100 flex items-center gap-2">
            <Sliders className="w-4 h-4 text-amber-400" />
            Routing & Freshness Policy Settings
          </h3>

          <div className="space-y-3 text-xs font-mono">
            <div>
              <label className="text-slate-400 block mb-1">Primary Market Data Provider</label>
              <select
                value={config.primaryProvider}
                onChange={(e) => setConfig({ ...config, primaryProvider: e.target.value })}
                className="w-full bg-slate-950 border border-slate-700 rounded px-3 py-2 text-slate-200"
              >
                <option value="yahoo_finance">Yahoo Finance (Live Market Reference)</option>
                <option value="simulated_reference">Simulated Benchmark (Offline/Testing)</option>
              </select>
            </div>

            <div>
              <label className="text-slate-400 block mb-1">Failover Fallback Provider</label>
              <select
                value={config.fallbackProvider}
                onChange={(e) => setConfig({ ...config, fallbackProvider: e.target.value })}
                className="w-full bg-slate-950 border border-slate-700 rounded px-3 py-2 text-slate-200"
              >
                <option value="simulated_reference">Simulated Benchmark (Explicitly labeled)</option>
                <option value="none">None (Fail Closed / Halt Quotes)</option>
              </select>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-slate-400 block mb-1">Max Stale Seconds</label>
                <input
                  type="number"
                  value={config.maxStaleSeconds}
                  onChange={(e) => setConfig({ ...config, maxStaleSeconds: Number(e.target.value) })}
                  className="w-full bg-slate-950 border border-slate-700 rounded px-3 py-1.5 text-slate-200"
                />
              </div>

              <div>
                <label className="text-slate-400 block mb-1">Poll Interval (Sec)</label>
                <input
                  type="number"
                  value={config.pollIntervalSeconds}
                  onChange={(e) => setConfig({ ...config, pollIntervalSeconds: Number(e.target.value) })}
                  className="w-full bg-slate-950 border border-slate-700 rounded px-3 py-1.5 text-slate-200"
                />
              </div>
            </div>

            <div className="pt-2 space-y-2">
              <label className="flex items-center gap-2 cursor-pointer text-slate-300">
                <input
                  type="checkbox"
                  checked={config.allowDelayed}
                  onChange={(e) => setConfig({ ...config, allowDelayed: e.target.checked })}
                  className="rounded bg-slate-950 border-slate-700 text-amber-500"
                />
                <span>Allow Indicative/Delayed Quotes with explicit badge</span>
              </label>

              <label className="flex items-center gap-2 cursor-pointer text-slate-300">
                <input
                  type="checkbox"
                  checked={config.allowCached}
                  onChange={(e) => setConfig({ ...config, allowCached: e.target.checked })}
                  className="rounded bg-slate-950 border-slate-700 text-amber-500"
                />
                <span>Allow Cached Quotes during transient network hiccups</span>
              </label>
            </div>
          </div>
        </div>

        {/* Symbol Mapping & Diagnostics Console */}
        <div className="lg:col-span-6 bg-slate-900 border border-slate-800 rounded-lg p-5 space-y-4">
          <h3 className="text-sm font-bold text-slate-100 flex items-center gap-2">
            <Terminal className="w-4 h-4 text-amber-400" />
            Symbol Mapping & Upstream Diagnostic Inspector
          </h3>

          <div className="space-y-2 text-xs font-mono">
            <div className="bg-slate-950 p-3 rounded border border-slate-800">
              <span className="text-slate-500 block text-[10px] uppercase mb-1">Mapped Symbols</span>
              <div className="grid grid-cols-2 gap-1.5 text-[11px]">
                <div>XAU/USD Spot: <strong className="text-amber-400">GC=F</strong> (COMEX)</div>
                <div>XAG/USD Silver: <strong className="text-slate-200">SI=F</strong></div>
                <div>Dollar Index: <strong className="text-slate-200">DX-Y.NYB</strong></div>
                <div>10Y Yield: <strong className="text-slate-200">^TNX</strong></div>
                <div>Gold ETF: <strong className="text-slate-200">GLD</strong></div>
              </div>
            </div>

            {testResult && (
              <div className="p-3 bg-slate-950 rounded border border-slate-800 text-[11px] font-mono">
                <div className="flex items-center justify-between pb-1 border-b border-slate-800/60 mb-2">
                  <span className="font-bold text-amber-400">Test Outcome: {testResult.providerId}</span>
                  <span className="text-slate-400">{testResult.latencyMs}ms</span>
                </div>
                <div className="text-slate-300">{testResult.message || testResult.error}</div>
                {testResult.rawQuote && (
                  <pre className="mt-2 p-2 bg-slate-900 rounded text-[10px] text-slate-400 overflow-x-auto">
                    {JSON.stringify(testResult.rawQuote, null, 2)}
                  </pre>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
