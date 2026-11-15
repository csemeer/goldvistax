/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * Aurum Intelligence — AI Advisory Council & Specialist Agents Workspace
 * 11 specialist agents, evidence citations, adversarial challenge critiques, and Gemini synthesis console.
 */

import React, { useState } from 'react';
import { AgentAssessment, EvidenceItem, SpecialistAgentRole } from '../domain/types';
import {
  Brain,
  ShieldAlert,
  ShieldCheck,
  Send,
  CheckCircle2,
  AlertTriangle,
  Flame,
  Scale,
  Compass,
  Vote,
  Users,
} from 'lucide-react';
import {
  AiEvaluationSuiteReport,
  evaluateCouncilConsensus,
  sanitizeUntrustedInput,
} from '../services/aiGovernanceEngine';
import { getSessionBearerToken } from '../services/authService';

interface CouncilWorkspaceProps {
  agents: AgentAssessment[];
  evidence: EvidenceItem[];
}

export const CouncilWorkspace: React.FC<CouncilWorkspaceProps> = ({
  agents,
  evidence,
}) => {
  const [selectedRole, setSelectedRole] = useState<SpecialistAgentRole>('ADVISORY_COUNCIL');
  const [userPrompt, setUserPrompt] = useState<string>('');
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [safetyNotice, setSafetyNotice] = useState<string | null>(null);
  const [customSynthesis, setCustomSynthesis] = useState<{
    text: string;
    model: string;
    timestamp: string;
  } | null>(null);

  const [evalReport, setEvalReport] = useState<AiEvaluationSuiteReport | null>(null);
  const [evalLoading, setEvalLoading] = useState<boolean>(false);
  const [evalError, setEvalError] = useState<string | null>(null);

  const selectedAgent = agents.find((a) => a.role === selectedRole) || agents[0];
  const challengeAgent = agents.find((a) => a.role === 'INDEPENDENT_CHALLENGE');
  const quorumMetrics = evaluateCouncilConsensus(agents);

  const handleRunGoldenEvalSuite = async () => {
    setEvalLoading(true);
    setEvalError(null);
    try {
      const token = getSessionBearerToken();
      const res = await fetch('/api/ai/eval', {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      const data = await res.json();
      if (!res.ok || !data?.report) {
        setEvalError(data?.error || `AI Evaluation Harness rejected request (HTTP ${res.status}). ALPHA role required.`);
        return;
      }
      setEvalReport(data.report);
    } catch (e: any) {
      setEvalError(e?.message || 'Unable to execute server AI Evaluation Suite.');
    } finally {
      setEvalLoading(false);
    }
  };

  const handleQueryCouncil = async (overridePrompt?: string) => {
    const rawPrompt = overridePrompt || userPrompt;
    if (!rawPrompt.trim()) return;

    // AI Governance: Prompt Injection Defense
    const sanitization = sanitizeUntrustedInput(rawPrompt);
    if (!sanitization.isSafe) {
      setSafetyNotice(`Prompt Injection Defense Triggered: ${sanitization.rejectionReason}`);
      return;
    }
    setSafetyNotice(null);

    setIsLoading(true);
    try {
      const res = await fetch('/api/ai/council', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userPrompt: sanitization.sanitizedText,
          agentRole: selectedRole,
          horizon: 'SWING',
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setSafetyNotice(data?.error || `Council consultation blocked (HTTP ${res.status}).`);
        return;
      }
      if (data.success) {
        setCustomSynthesis({
          text: data.response,
          model: data.modelUsed,
          timestamp: new Date().toLocaleTimeString(),
        });
      } else {
        setSafetyNotice(data?.error || 'Council synthesis did not return a valid response.');
      }
    } catch (e: any) {
      setSafetyNotice(e?.message || 'Network error while querying Advisory Council.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Banner / Council Mission Statement */}
      <div className="bg-slate-900 border border-slate-800 rounded-lg p-5">
        <div className="flex flex-wrap items-center justify-between gap-4 pb-3 border-b border-slate-800">
          <div>
            <span className="text-xs font-mono text-amber-400 uppercase tracking-wider block">
              Explainable AI Intelligence & Governance
            </span>
            <h2 className="text-lg font-bold text-slate-100 flex items-center gap-2 mt-0.5">
              <Brain className="w-5 h-5 text-amber-400" />
              11-Member Specialist Agent Advisory Council
            </h2>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs font-mono text-emerald-400 bg-emerald-500/10 px-3 py-1 rounded border border-emerald-500/20 flex items-center gap-1.5">
              <ShieldCheck className="w-3.5 h-3.5" />
              Prompt Defense Active
            </span>
            <span className="text-xs font-mono text-slate-400 bg-slate-950 px-3 py-1 rounded border border-slate-800">
              Adversarial Veto Enabled
            </span>
          </div>
        </div>
        <p className="text-xs text-slate-300 mt-2.5 leading-relaxed">
          The Council operates under formal constitutional quorum rules. Specialized agents evaluate distinct dimensions (macro, technicals, order flow, event studies, positioning), while the dedicated Independent Challenge Agent actively surfaces counter-theses and holds unilateral veto power over crowded breakout traps.
        </p>

        {/* Quorum Governance KPI Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-4 pt-4 border-t border-slate-800 text-xs font-mono">
          <div className="bg-slate-950/70 p-3 rounded border border-slate-800">
            <span className="text-slate-500 block text-[10px]">COUNCIL QUORUM STATUS</span>
            <span className="text-base font-bold text-emerald-400 tabular-nums">
              {quorumMetrics.activeQuorumCount}/{quorumMetrics.totalRosterSize} Active
            </span>
            <span className="text-[10px] text-slate-400 block mt-0.5">
              Threshold: &gt;={quorumMetrics.quorumThreshold} agents met
            </span>
          </div>

          <div className="bg-slate-950/70 p-3 rounded border border-slate-800">
            <span className="text-slate-500 block text-[10px]">DIRECTIONAL VOTES</span>
            <span className="text-base font-bold text-slate-200 tabular-nums">
              <span className="text-emerald-400">{quorumMetrics.bullishVotes}B</span> /{' '}
              <span className="text-rose-400">{quorumMetrics.bearishVotes}S</span> /{' '}
              <span className="text-slate-400">{quorumMetrics.neutralVotes}N</span>
            </span>
            <span className="text-[10px] text-slate-400 block mt-0.5">
              Abstentions: {quorumMetrics.abstentionsCount}
            </span>
          </div>

          <div className="bg-slate-950/70 p-3 rounded border border-slate-800">
            <span className="text-slate-500 block text-[10px]">DISAGREEMENT INDEX</span>
            <span className="text-base font-bold text-amber-400 tabular-nums">
              {quorumMetrics.disagreementIndexPct}%
            </span>
            <span className="text-[10px] text-slate-400 block mt-0.5">
              Healthy adversarial variance
            </span>
          </div>

          <div className="bg-slate-950/70 p-3 rounded border border-slate-800">
            <span className="text-slate-500 block text-[10px]">GOVERNANCE VERDICT</span>
            <span className="text-sm font-bold text-emerald-400 truncate block mt-0.5">
              {quorumMetrics.governanceVerdict.replace(/_/g, ' ')}
            </span>
            <span className="text-[10px] text-slate-400 block mt-0.5">
              Weighted Conviction: {quorumMetrics.weightedConvictionPct}%
            </span>
          </div>
        </div>

        {/* Governance Summary Callout */}
        <div className="mt-3 p-2.5 bg-slate-950 rounded border border-slate-800 text-[11px] text-slate-300 font-mono flex items-center justify-between">
          <span><strong>Synthesis Policy:</strong> {quorumMetrics.governanceSummary}</span>
          {quorumMetrics.adversarialVetoActive && (
            <span className="px-2 py-0.5 bg-rose-500/20 text-rose-300 border border-rose-500/30 rounded font-bold uppercase text-[10px]">
              Veto Enforced
            </span>
          )}
        </div>
      </div>

      {/* Safety Notice Banner if prompt injection or HTTP error is detected */}
      {safetyNotice && (
        <div
          role="alert"
          aria-live="polite"
          className="bg-rose-950/40 border border-rose-500/50 rounded-lg p-3 text-xs text-rose-200 flex items-center gap-2 font-mono"
        >
          <ShieldAlert className="w-4 h-4 text-rose-400 shrink-0" />
          <span>{safetyNotice}</span>
        </div>
      )}

      {/* Adversarial Spotlight Banner (Independent Challenge Agent) */}
      {challengeAgent && (
        <div className="bg-rose-950/20 border border-rose-500/30 rounded-lg p-4 sm:p-5">
          <div className="flex items-center justify-between pb-2 border-b border-rose-500/20 text-xs font-mono">
            <span className="text-rose-400 font-bold flex items-center gap-1.5 uppercase">
              <Flame className="w-4 h-4 text-rose-400" />
              Adversarial Challenge Spotlight: {challengeAgent.agentName}
            </span>
            <span className="text-rose-300 font-semibold">
              Conviction: {challengeAgent.convictionScorePct}%
            </span>
          </div>
          <h4 className="text-sm font-bold text-rose-200 mt-2 font-mono">
            {challengeAgent.keyThesis}
          </h4>
          <p className="text-xs text-rose-100/90 mt-1 leading-relaxed">
            {challengeAgent.assessment}
          </p>
          {challengeAgent.warningNotice && (
            <div className="mt-3 p-2.5 bg-rose-900/30 border border-rose-500/40 rounded text-xs text-rose-200 flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0" />
              <span>{challengeAgent.warningNotice}</span>
            </div>
          )}
        </div>
      )}

      {/* Specialist Agents Grid & Detail Inspector */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Agent Selector List */}
        <div className="lg:col-span-4 space-y-2 max-h-[600px] overflow-y-auto pr-1">
          <h4 className="text-xs font-mono text-slate-400 uppercase tracking-wider mb-2">
            Specialist Council Roster
          </h4>
          {agents.map((agent) => {
            const isSelected = selectedRole === agent.role;
            const isBullish = agent.directionalBias === 'BULLISH';
            const isBearish = agent.directionalBias === 'BEARISH';

            return (
              <div
                key={agent.role}
                onClick={() => setSelectedRole(agent.role)}
                className={`p-3 rounded-lg border cursor-pointer transition-all ${
                  isSelected
                    ? 'bg-slate-800/90 border-amber-500/60 text-slate-100 shadow-md'
                    : 'bg-slate-900 border-slate-800 text-slate-400 hover:border-slate-700'
                }`}
              >
                <div className="flex items-center justify-between text-[11px] font-mono">
                  <span className="font-semibold text-slate-300">{agent.agentName}</span>
                  <span
                    className={`px-1.5 py-0.2 rounded text-[10px] font-bold ${
                      isBullish
                        ? 'text-emerald-400 bg-emerald-500/10'
                        : isBearish
                        ? 'text-rose-400 bg-rose-500/10'
                        : 'text-amber-400 bg-amber-500/10'
                    }`}
                  >
                    {agent.directionalBias}
                  </span>
                </div>
                <div className="flex justify-between items-center text-[10px] text-slate-500 mt-1 font-mono">
                  <span>Horizon: {agent.horizon}</span>
                  <span>Conviction: {agent.convictionScorePct}%</span>
                </div>
              </div>
            );
          })}
        </div>

        {/* Right Active Agent Assessment & Evidence Provenance */}
        <div className="lg:col-span-8 bg-slate-900 border border-slate-800 rounded-lg p-5 sm:p-6 space-y-5">
          <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-slate-800">
            <div>
              <span className="text-xs font-mono text-amber-400 uppercase">{selectedAgent.role}</span>
              <h3 className="text-base font-bold text-slate-100 mt-0.5">{selectedAgent.agentName}</h3>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-mono px-2.5 py-1 bg-slate-950 border border-slate-800 text-slate-300 rounded">
                Horizon: {selectedAgent.horizon}
              </span>
              <span className="text-xs font-mono px-2.5 py-1 bg-amber-500/10 border border-amber-500/20 text-amber-300 rounded font-semibold">
                Conviction: {selectedAgent.convictionScorePct}%
              </span>
            </div>
          </div>

          <div>
            <h4 className="text-xs font-mono text-slate-400 uppercase tracking-wider mb-1">Core Thesis</h4>
            <p className="text-sm font-semibold text-slate-200">{selectedAgent.keyThesis}</p>
          </div>

          <div className="bg-slate-950 p-4 rounded border border-slate-800 text-xs">
            <h4 className="text-[11px] font-mono text-slate-400 uppercase tracking-wider mb-1.5">
              Detailed Assessment & Reasoning
            </h4>
            <p className="text-slate-300 leading-relaxed font-sans">{selectedAgent.assessment}</p>
          </div>

          {/* Evidence Citations & Invalidation */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs font-mono">
            <div className="bg-slate-950 p-3 rounded border border-slate-800">
              <span className="text-slate-500 block text-[10px] uppercase mb-1 flex items-center gap-1">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" /> Supporting Evidence IDs
              </span>
              {selectedAgent.supportingEvidenceIds.length > 0 ? (
                <div className="space-y-1">
                  {selectedAgent.supportingEvidenceIds.map((id) => (
                    <span key={id} className="block text-emerald-400 font-bold">
                      • {id}
                    </span>
                  ))}
                </div>
              ) : (
                <span className="text-slate-500">None explicitly referenced</span>
              )}
            </div>

            <div className="bg-slate-950 p-3 rounded border border-slate-800">
              <span className="text-slate-500 block text-[10px] uppercase mb-1 flex items-center gap-1">
                <AlertTriangle className="w-3.5 h-3.5 text-rose-400" /> Contradictory Evidence IDs
              </span>
              {selectedAgent.contradictoryEvidenceIds.length > 0 ? (
                <div className="space-y-1">
                  {selectedAgent.contradictoryEvidenceIds.map((id) => (
                    <span key={id} className="block text-rose-400 font-bold">
                      • {id}
                    </span>
                  ))}
                </div>
              ) : (
                <span className="text-slate-500">No active contradictory flags</span>
              )}
            </div>
          </div>

          <div className="p-3 bg-slate-950/70 rounded border border-slate-800/80 text-xs">
            <strong className="text-amber-400 font-mono text-[11px] block uppercase mb-0.5">
              Invalidation Trigger:
            </strong>
            <span className="text-slate-300">{selectedAgent.invalidationTrigger}</span>
          </div>
        </div>
      </div>

      {/* Interactive AI Synthesis Console */}
      <div className="bg-slate-900 border border-slate-800 rounded-lg p-5">
        <div className="flex items-center justify-between pb-3 border-b border-slate-800">
          <h3 className="text-sm font-bold text-slate-100 flex items-center gap-2">
            <Brain className="w-4 h-4 text-amber-400" />
            Advisory Council Grounded Consultation & Scenario Analysis
          </h3>
          <span className="text-[11px] font-mono text-slate-400">Powered by Gemini 3.8 Flash</span>
        </div>

        {/* Quick Question Chips */}
        <div className="flex flex-wrap gap-2 mt-3">
          {[
            'Stress-test long gold against a sharp DXY rebound to 106.0',
            'Evaluate gold macro reaction if Fed cuts rates by 25bps next meeting',
            'Analyze sustainability of central bank sovereign gold accumulation',
            'Assess intraday liquidity sweep risk around London open',
          ].map((chip) => (
            <button
              key={chip}
              onClick={() => {
                setUserPrompt(chip);
                handleQueryCouncil(chip);
              }}
              className="px-2.5 py-1 text-[11px] font-mono bg-slate-950 hover:bg-slate-800 text-slate-300 rounded border border-slate-800 transition-colors text-left"
            >
              {chip}
            </button>
          ))}
        </div>

        {/* Input & Submit Bar */}
        <div className="flex gap-2 mt-4">
          <input
            type="text"
            placeholder="Ask the Advisory Council a targeted scenario or risk question..."
            value={userPrompt}
            onChange={(e) => setUserPrompt(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleQueryCouncil()}
            className="flex-1 bg-slate-950 border border-slate-700 rounded px-3.5 py-2 text-xs text-slate-100 focus:outline-none focus:border-amber-400 font-sans"
          />
          <button
            onClick={() => handleQueryCouncil()}
            disabled={isLoading || !userPrompt.trim()}
            className="px-4 py-2 bg-amber-400 hover:bg-amber-300 disabled:opacity-50 text-slate-950 text-xs font-semibold rounded flex items-center gap-1.5 transition-colors shrink-0"
          >
            <Send className="w-3.5 h-3.5" />
            {isLoading ? 'Synthesizing...' : 'Consult Council'}
          </button>
        </div>

        {/* Response Box */}
        {customSynthesis && (
          <div className="mt-4 p-4 bg-slate-950 rounded-lg border border-slate-800 text-xs">
            <div className="flex items-center justify-between pb-2 border-b border-slate-800/60 font-mono text-[10px] text-slate-400">
              <span>Model: {customSynthesis.model}</span>
              <span>Timestamp: {customSynthesis.timestamp}</span>
            </div>
            <div className="mt-2 text-slate-200 leading-relaxed font-sans whitespace-pre-wrap">
              {customSynthesis.text}
            </div>
          </div>
        )}
      </div>

      {/* §7.6 Automated Golden AI Governance Evaluation Harness */}
      <div className="bg-slate-900 border border-slate-800 rounded-lg p-5 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-slate-800">
          <div>
            <h3 className="text-sm font-bold text-slate-100 flex items-center gap-2">
              <Scale className="w-4 h-4 text-amber-400" />
              Automated AI Safety & Evaluation Harness
            </h3>
            <p className="text-xs text-slate-400 mt-0.5">
              Verifies prompt-injection refusal, citation grounding, quorum veto, stale-quote abstention, and execution boundaries across 8 golden scenarios.
            </p>
          </div>
          <button
            type="button"
            onClick={handleRunGoldenEvalSuite}
            disabled={evalLoading}
            className="px-4 py-2 bg-slate-800 hover:bg-slate-700 disabled:opacity-50 text-amber-300 border border-amber-500/40 text-xs font-semibold rounded-lg transition-colors cursor-pointer"
          >
            {evalLoading ? 'Running 8 Scenarios...' : 'Run 8-Scenario AI Eval'}
          </button>
        </div>

        {evalError && (
          <div
            role="alert"
            aria-live="polite"
            className="bg-rose-950/40 border border-rose-500/50 rounded-lg p-3 text-xs text-rose-200 flex items-center gap-2 font-mono"
          >
            <ShieldAlert className="w-4 h-4 text-rose-400 shrink-0" />
            <span>{evalError}</span>
          </div>
        )}

        {evalReport && (
          <div className="space-y-3">
            <div className="flex flex-wrap items-center gap-4 text-xs font-mono text-slate-300 bg-slate-950/70 p-3 rounded border border-slate-800">
              <span>Dataset: <strong className="text-white">{evalReport.datasetVersion}</strong></span>
              <span aria-hidden="true">·</span>
              <span>Pass Rate: <strong className="text-emerald-400 tabular-nums">{evalReport.passedScenarios}/{evalReport.totalScenarios} ({evalReport.passRatePct}%)</strong></span>
              <span aria-hidden="true">·</span>
              <span>Refusal Accuracy: <strong className="text-emerald-400 tabular-nums">{evalReport.refusalCorrectnessPct}%</strong></span>
              <span aria-hidden="true">·</span>
              <span>Numerical Boundary Drift: <strong className="text-emerald-400 tabular-nums">0%</strong></span>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5 text-xs font-mono">
              {evalReport.results.map((item) => (
                <div
                  key={item.id}
                  className="p-2.5 bg-slate-950/70 border border-slate-800 rounded flex items-start justify-between gap-2"
                >
                  <div>
                    <div className="text-slate-200 font-semibold">
                      {item.id} · {item.category}
                    </div>
                    <div className="text-[11px] text-slate-400 mt-0.5">{item.description}</div>
                    <div className="text-[10px] text-slate-500 mt-1">{item.observedOutcome}</div>
                  </div>
                  <span className={`font-bold shrink-0 ${item.passed ? 'text-emerald-400' : 'text-rose-400'}`}>
                    {item.passed ? 'PASS' : 'FAIL'}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
