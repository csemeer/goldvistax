/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * Aurum Intelligence — Alerts & Data Quality Workspace
 */

import React, { useState } from 'react';
import { AlertNotification, AlertRule, Quote } from '../domain/types';
import { BellRing, ShieldCheck, AlertTriangle, Plus, Trash2, CheckCircle2 } from 'lucide-react';

interface AlertsWorkspaceProps {
  quote: Quote;
}

export const AlertsWorkspace: React.FC<AlertsWorkspaceProps> = ({ quote }) => {
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

  const handleAddRule = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName) return;
    const rule: AlertRule = {
      id: `RULE-0${rules.length + 1}`,
      name: newName,
      conditionType: newType,
      targetValue: Number(newTarget),
      comparison: 'ABOVE',
      horizon: 'SWING',
      isActive: true,
      createdAt: new Date().toISOString(),
    };
    setRules([...rules, rule]);
    setNewName('');
  };

  const toggleRule = (id: string) => {
    setRules(rules.map((r) => (r.id === id ? { ...r, isActive: !r.isActive } : r)));
  };

  const deleteRule = (id: string) => {
    setRules(rules.filter((r) => r.id !== id));
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
                    </span>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      onClick={() => toggleRule(rule.id)}
                      className={`px-2.5 py-1 rounded text-[11px] font-semibold border ${
                        rule.isActive
                          ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
                          : 'bg-slate-800 text-slate-500 border-slate-700'
                      }`}
                    >
                      {rule.isActive ? 'Active' : 'Disabled'}
                    </button>
                    <button
                      onClick={() => deleteRule(rule.id)}
                      className="p-1.5 text-slate-500 hover:text-rose-400 transition-colors"
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
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-xs font-mono">
                <input
                  type="text"
                  placeholder="Rule label (e.g., Gold Breaks $3925)"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  className="sm:col-span-2 bg-slate-950 border border-slate-700 rounded px-3 py-1.5 text-slate-200"
                />
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
                className="w-full flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-semibold text-slate-950 bg-amber-400 hover:bg-amber-300 rounded transition-colors"
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

          <div className="space-y-2.5">
            {notifications.map((notif) => (
              <div
                key={notif.id}
                className="p-3 bg-slate-950 rounded-lg border border-slate-800 text-xs font-mono space-y-1"
              >
                <div className="flex items-center justify-between text-[10px] text-slate-500">
                  <span className="text-amber-400 font-bold">{notif.title}</span>
                  <span>{notif.timestamp.slice(11, 16)} UTC</span>
                </div>
                <p className="text-slate-300 font-sans text-xs">{notif.message}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};
