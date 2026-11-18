import React, { useState, useEffect, useRef } from 'react';
import {
  Bot,
  Play,
  RotateCw,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  FileSearch,
  Search,
  Layers,
  ChevronDown,
  ChevronRight,
  ShieldAlert,
  Sparkles,
  Lightbulb,
  Clock,
  ArrowRight,
  Terminal,
  Activity,
  Database,
  Code2,
  Radio,
  Wifi,
  WifiOff,
} from 'lucide-react';
import { getSocket } from '../services/socket';

export function AiAgentInvestigation({ endpoint }) {
  const [isRunning, setIsRunning] = useState(false);
  const [agentRun, setAgentRun] = useState(null);
  const [error, setError] = useState(null);
  const [objective, setObjective] = useState('');
  const [selectedCategories, setSelectedCategories] = useState(['positive', 'negative', 'boundary']);
  const [activeTab, setActiveTab] = useState('summary'); // 'summary' | 'tests' | 'diagnoses' | 'trace' | 'realtime'

  // WebSocket Live Streaming State
  const [socketConnected, setSocketConnected] = useState(false);
  const [currentRunId, setCurrentRunId] = useState(null);
  const [liveCurrentStep, setLiveCurrentStep] = useState('');
  const [liveSteps, setLiveSteps] = useState([]);
  const [liveTests, setLiveTests] = useState([]);
  const [livePassedCount, setLivePassedCount] = useState(0);
  const [liveFailedCount, setLiveFailedCount] = useState(0);
  const [liveEvents, setLiveEvents] = useState([]);

  const socketRef = useRef(null);
  const activeRunIdRef = useRef(null);

  // Initialize Socket.IO connection
  useEffect(() => {
    const s = getSocket();
    socketRef.current = s;

    const onConnect = () => setSocketConnected(true);
    const onDisconnect = () => setSocketConnected(false);

    if (s.connected) {
      setSocketConnected(true);
    }

    s.on('connect', onConnect);
    s.on('disconnect', onDisconnect);

    // Generic event stream listener
    const handleGenericEvent = (payload) => {
      if (!payload) return;
      if (activeRunIdRef.current && payload.runId !== activeRunIdRef.current) return;

      setLiveEvents((prev) => [payload, ...prev]);

      const eventType = payload.eventType;
      const data = payload.data || {};

      switch (eventType) {
        case 'agent:started':
          setLiveCurrentStep(`Agent started for ${data.endpointMethod || ''} ${data.endpointPath || ''}`);
          break;
        case 'agent:step':
          setLiveCurrentStep(data.notes || `Executing step ${data.stepNumber}: ${data.stepType}`);
          setLiveSteps((prev) => {
            const exists = prev.some((st) => st.stepNumber === data.stepNumber);
            if (exists) return prev.map((st) => (st.stepNumber === data.stepNumber ? { ...st, ...data } : st));
            return [...prev, data];
          });
          break;
        case 'agent:tool-called':
          setLiveCurrentStep(`Invoking tool: ${data.toolName}`);
          break;
        case 'agent:retrieval-completed':
          setLiveCurrentStep(`RAG Retrieval complete: ${data.chunksRetrieved ?? 0} context chunks loaded`);
          break;
        case 'agent:test-started':
          setLiveCurrentStep(`Running test: ${data.testName}`);
          setLiveTests((prev) => {
            const exists = prev.some((t) => t.testId === data.testId);
            if (exists) return prev;
            return [
              ...prev,
              {
                testId: data.testId,
                testName: data.testName,
                category: data.category,
                status: 'RUNNING',
                expectedStatus: data.expectedStatus,
              },
            ];
          });
          break;
        case 'agent:test-completed':
          setLiveTests((prev) =>
            prev.map((t) =>
              t.testId === data.testId
                ? {
                    ...t,
                    status: data.status,
                    actualStatus: data.actualStatus,
                    durationMs: data.durationMs,
                    passed: data.passed,
                    errorMessage: data.errorMessage,
                  }
                : t
            )
          );
          if (data.status === 'PASSED') {
            setLivePassedCount((c) => c + 1);
          } else if (data.status === 'FAILED') {
            setLiveFailedCount((c) => c + 1);
          }
          break;
        case 'agent:diagnosis':
          setLiveCurrentStep(`Diagnosed failure: ${data.testName}`);
          break;
        case 'agent:completed':
          setLiveCurrentStep('Investigation completed successfully');
          if (data.summary) {
            setAgentRun((prev) => ({ ...(prev || {}), ...data, status: 'COMPLETED' }));
          }
          break;
        case 'agent:error':
          setError(data.error || 'Agent encountered an error');
          setLiveCurrentStep('Agent encountered an error');
          break;
        default:
          break;
      }
    };

    s.on('agent:event', handleGenericEvent);

    return () => {
      s.off('connect', onConnect);
      s.off('disconnect', onDisconnect);
      s.off('agent:event', handleGenericEvent);
      if (activeRunIdRef.current) {
        s.emit('leave-investigation', { runId: activeRunIdRef.current });
      }
    };
  }, []);

  if (!endpoint) return null;

  const toggleCategory = (cat) => {
    if (selectedCategories.includes(cat)) {
      if (selectedCategories.length > 1) {
        setSelectedCategories(selectedCategories.filter((c) => c !== cat));
      }
    } else {
      setSelectedCategories([...selectedCategories, cat]);
    }
  };

  const handleRunInvestigation = async () => {
    const runId = `agent_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    setCurrentRunId(runId);
    activeRunIdRef.current = runId;

    setIsRunning(true);
    setError(null);
    setLiveSteps([]);
    setLiveTests([]);
    setLiveEvents([]);
    setLivePassedCount(0);
    setLiveFailedCount(0);
    setLiveCurrentStep('Subscribing to real-time agent stream...');

    // Join Socket.IO room for this investigation run
    const s = socketRef.current;
    if (s && s.connected) {
      s.emit('join-investigation', { runId });
    }

    try {
      const res = await fetch('http://localhost:5000/api/ai/agent/run', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          runId,
          endpointId: endpoint.id,
          objective: objective || `Investigate robustness and specification contract conformance of ${endpoint.method} ${endpoint.path}`,
          categories: selectedCategories,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error?.message || data.message || 'Investigation failed');
      }

      setAgentRun(data.data);
    } catch (err) {
      // Fallback state recovery via REST API if WebSocket/HTTP was interrupted
      try {
        const recoveryRes = await fetch(`http://localhost:5000/api/ai/agent/runs/${runId}`);
        if (recoveryRes.ok) {
          const recData = await recoveryRes.json();
          if (recData.data) {
            setAgentRun(recData.data);
            return;
          }
        }
      } catch (recErr) {
        // Recovery attempt failed; show original error
      }
      setError(err.message);
    } finally {
      setIsRunning(false);
    }
  };

  const executedTests = agentRun?.executedTests || [];
  const passedCount = agentRun ? executedTests.filter((t) => t.status === 'PASSED').length : livePassedCount;
  const failedCount = agentRun ? executedTests.filter((t) => t.status === 'FAILED').length : liveFailedCount;
  const diagnoses = agentRun?.diagnoses || [];
  const traceSteps = agentRun?.traceSteps || liveSteps;

  return (
    <div className="space-y-6">
      {/* Top Launch Bar */}
      <div className="p-5 rounded-xl bg-slate-900/90 border border-slate-800 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center space-x-2">
              <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-cyan-500/10 text-cyan-400 border border-cyan-500/20">
                Phase 5 Autonomous Agent
              </span>
              <span className="text-xs text-slate-400 font-mono">WebSockets + RAG + Multi-Step Tooling</span>
              {/* WebSocket Live Status Badge */}
              <span
                className={`inline-flex items-center space-x-1.5 px-2 py-0.5 rounded-full text-[10px] font-semibold border transition-colors ${
                  socketConnected
                    ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                    : 'bg-amber-500/10 text-amber-400 border-amber-500/20'
                }`}
              >
                {socketConnected ? (
                  <>
                    <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
                    <span>WebSocket Connected</span>
                  </>
                ) : (
                  <>
                    <WifiOff className="h-3 w-3" />
                    <span>WebSocket Reconnecting</span>
                  </>
                )}
              </span>
            </div>
            <h3 className="text-base font-semibold text-white">
              AI Testing Agent Investigation
            </h3>
            <p className="text-xs text-slate-400">
              Launch an autonomous multi-step investigation with real-time WebSocket state streaming, RAG vector retrieval, and live sandbox execution.
            </p>
          </div>

          <button
            onClick={handleRunInvestigation}
            disabled={isRunning}
            className="px-5 py-2.5 rounded-lg bg-gradient-to-r from-cyan-600 to-indigo-600 hover:from-cyan-500 hover:to-indigo-500 text-white text-xs font-semibold shadow-md shadow-cyan-600/20 flex items-center justify-center space-x-2 transition-all disabled:opacity-50 shrink-0"
          >
            {isRunning ? (
              <>
                <RotateCw className="h-4 w-4 animate-spin text-cyan-200" />
                <span>Streaming Live...</span>
              </>
            ) : (
              <>
                <Bot className="h-4 w-4" />
                <span>Run AI Investigation</span>
              </>
            )}
          </button>
        </div>

        {/* Configuration inputs */}
        <div className="pt-2 border-t border-slate-800/80 grid grid-cols-1 md:grid-cols-12 gap-3 text-xs">
          <div className="md:col-span-8 space-y-1">
            <label className="text-[11px] font-medium text-slate-400">Testing Objective (Optional)</label>
            <input
              type="text"
              value={objective}
              onChange={(e) => setObjective(e.target.value)}
              placeholder={`Investigate contract conformance and boundary failure modes for ${endpoint.method} ${endpoint.path}`}
              className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-cyan-500"
            />
          </div>

          <div className="md:col-span-4 space-y-1">
            <label className="text-[11px] font-medium text-slate-400">Target Categories</label>
            <div className="flex items-center space-x-1.5">
              {['positive', 'negative', 'boundary'].map((cat) => {
                const active = selectedCategories.includes(cat);
                return (
                  <button
                    key={cat}
                    onClick={() => toggleCategory(cat)}
                    type="button"
                    className={`px-2 py-1 rounded text-[11px] font-medium capitalize border transition-all ${
                      active
                        ? 'bg-cyan-500/15 text-cyan-300 border-cyan-500/30'
                        : 'bg-slate-950 text-slate-500 border-slate-800'
                    }`}
                  >
                    {cat}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      {/* Error alert */}
      {error && (
        <div className="p-4 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs flex items-start space-x-2.5">
          <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5 text-rose-400" />
          <div>
            <div className="font-semibold">Investigation Error</div>
            <div className="text-rose-400/90 mt-0.5">{error}</div>
          </div>
        </div>
      )}

      {/* Live WebSocket Progress Radar during execution */}
      {isRunning && (
        <div className="p-6 rounded-2xl bg-slate-900/60 border border-cyan-500/30 space-y-5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-center space-x-3">
              <div className="relative">
                <div className="w-10 h-10 rounded-full bg-cyan-500/15 border border-cyan-500/40 flex items-center justify-center text-cyan-400">
                  <Bot className="h-5 w-5 animate-pulse" />
                </div>
                <span className="absolute -top-1 -right-1 h-3 w-3 rounded-full bg-emerald-400 animate-ping" />
              </div>
              <div>
                <div className="flex items-center space-x-2">
                  <h4 className="text-sm font-semibold text-white">Live Autonomous Agent Stream</h4>
                  <span className="text-[10px] font-mono text-cyan-400 bg-cyan-500/10 px-2 py-0.5 rounded border border-cyan-500/20">
                    Room: {currentRunId}
                  </span>
                </div>
                <p className="text-xs text-cyan-300/90 font-mono mt-0.5">
                  {liveCurrentStep || 'Processing agent lifecycle step...'}
                </p>
              </div>
            </div>

            {/* Live Counters */}
            <div className="flex items-center space-x-3 text-xs shrink-0">
              <div className="px-3 py-1.5 rounded-lg bg-slate-950 border border-slate-800">
                <span className="text-[10px] text-slate-500 uppercase font-bold block">Live Tests</span>
                <span className="text-sm font-bold text-white">{liveTests.length} Run</span>
              </div>
              <div className="px-3 py-1.5 rounded-lg bg-slate-950 border border-slate-800">
                <span className="text-[10px] text-slate-500 uppercase font-bold block">Live Passed</span>
                <span className="text-sm font-bold text-emerald-400">{livePassedCount}</span>
              </div>
              <div className="px-3 py-1.5 rounded-lg bg-slate-950 border border-slate-800">
                <span className="text-[10px] text-slate-500 uppercase font-bold block">Live Failed</span>
                <span className="text-sm font-bold text-rose-400">{liveFailedCount}</span>
              </div>
            </div>
          </div>

          {/* Streaming Test Cases Status */}
          {liveTests.length > 0 && (
            <div className="space-y-2 pt-2 border-t border-slate-800">
              <span className="text-[10px] uppercase font-bold tracking-wider text-slate-400">
                Live Test Execution Progress:
              </span>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {liveTests.map((t, idx) => (
                  <div
                    key={idx}
                    className="p-2.5 rounded-lg bg-slate-950/80 border border-slate-800 flex items-center justify-between text-xs"
                  >
                    <div className="flex items-center space-x-2 truncate">
                      {t.status === 'RUNNING' && <RotateCw className="h-3.5 w-3.5 text-cyan-400 animate-spin shrink-0" />}
                      {t.status === 'PASSED' && <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400 shrink-0" />}
                      {t.status === 'FAILED' && <XCircle className="h-3.5 w-3.5 text-rose-400 shrink-0" />}
                      <span className="truncate text-slate-200">{t.testName}</span>
                    </div>
                    <span
                      className={`text-[10px] font-mono px-1.5 py-0.5 rounded ml-2 shrink-0 ${
                        t.status === 'PASSED'
                          ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/20'
                          : t.status === 'FAILED'
                          ? 'bg-rose-500/15 text-rose-400 border border-rose-500/20'
                          : 'bg-cyan-500/15 text-cyan-300 border border-cyan-500/20'
                      }`}
                    >
                      {t.status}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Results View */}
      {agentRun && !isRunning && (
        <div className="space-y-6">
          {/* Metrics summary banner */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="p-3.5 rounded-xl bg-slate-900/80 border border-slate-800">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Status</span>
              <div className="mt-1 flex items-center space-x-1.5">
                <CheckCircle2 className="h-4 w-4 text-emerald-400" />
                <span className="text-sm font-bold text-white capitalize">{agentRun.status}</span>
              </div>
            </div>

            <div className="p-3.5 rounded-xl bg-slate-900/80 border border-slate-800">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Tests Run</span>
              <div className="mt-1 text-sm font-bold text-white">{executedTests.length} Scenarios</div>
            </div>

            <div className="p-3.5 rounded-xl bg-slate-900/80 border border-slate-800">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Pass / Fail</span>
              <div className="mt-1 flex items-center space-x-2 text-sm font-bold">
                <span className="text-emerald-400">{passedCount} Passed</span>
                <span className="text-slate-600">/</span>
                <span className={failedCount > 0 ? 'text-rose-400' : 'text-slate-400'}>{failedCount} Failed</span>
              </div>
            </div>

            <div className="p-3.5 rounded-xl bg-slate-900/80 border border-slate-800">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Duration</span>
              <div className="mt-1 text-sm font-bold text-white flex items-center space-x-1">
                <Clock className="h-3.5 w-3.5 text-slate-400" />
                <span>{agentRun.durationMs} ms</span>
              </div>
            </div>
          </div>

          {/* Sub-Tabs Navigation */}
          <div className="flex border-b border-slate-800 text-xs overflow-x-auto">
            <button
              onClick={() => setActiveTab('summary')}
              className={`px-4 py-2 font-medium border-b-2 transition-all shrink-0 ${
                activeTab === 'summary'
                  ? 'border-cyan-400 text-cyan-300 font-semibold'
                  : 'border-transparent text-slate-400 hover:text-slate-200'
              }`}
            >
              Executive Findings
            </button>
            <button
              onClick={() => setActiveTab('tests')}
              className={`px-4 py-2 font-medium border-b-2 transition-all flex items-center space-x-1.5 shrink-0 ${
                activeTab === 'tests'
                  ? 'border-cyan-400 text-cyan-300 font-semibold'
                  : 'border-transparent text-slate-400 hover:text-slate-200'
              }`}
            >
              <span>Sandbox Execution ({executedTests.length})</span>
            </button>
            {failedCount > 0 && (
              <button
                onClick={() => setActiveTab('diagnoses')}
                className={`px-4 py-2 font-medium border-b-2 transition-all flex items-center space-x-1.5 shrink-0 ${
                  activeTab === 'diagnoses'
                    ? 'border-rose-400 text-rose-300 font-semibold'
                    : 'border-transparent text-slate-400 hover:text-slate-200'
                }`}
              >
                <span>AI Failure Explainer ({diagnoses.length})</span>
                <span className="h-1.5 w-1.5 rounded-full bg-rose-400 animate-pulse" />
              </button>
            )}
            <button
              onClick={() => setActiveTab('trace')}
              className={`px-4 py-2 font-medium border-b-2 transition-all shrink-0 ${
                activeTab === 'trace'
                  ? 'border-cyan-400 text-cyan-300 font-semibold'
                  : 'border-transparent text-slate-400 hover:text-slate-200'
              }`}
            >
              Agent Execution Trace ({traceSteps.length})
            </button>
            <button
              onClick={() => setActiveTab('realtime')}
              className={`px-4 py-2 font-medium border-b-2 transition-all flex items-center space-x-1.5 shrink-0 ${
                activeTab === 'realtime'
                  ? 'border-cyan-400 text-cyan-300 font-semibold'
                  : 'border-transparent text-slate-400 hover:text-slate-200'
              }`}
            >
              <Radio className="h-3.5 w-3.5 text-cyan-400" />
              <span>WebSocket Stream ({liveEvents.length})</span>
            </button>
          </div>

          {/* TAB 1: Executive Findings */}
          {activeTab === 'summary' && (
            <div className="space-y-4">
              <div className="p-4 rounded-xl bg-slate-900/60 border border-slate-800 space-y-2">
                <div className="flex items-center space-x-2 text-xs font-semibold text-cyan-400">
                  <Sparkles className="h-4 w-4" />
                  <span>Executive Summary</span>
                </div>
                <p className="text-xs text-slate-300 leading-relaxed">{agentRun.summary}</p>
              </div>

              {agentRun.evidence && agentRun.evidence.length > 0 && (
                <div className="p-4 rounded-xl bg-slate-900/60 border border-slate-800 space-y-2">
                  <div className="text-xs font-semibold text-slate-200 flex items-center space-x-2">
                    <Terminal className="h-4 w-4 text-emerald-400" />
                    <span>Confirmed Sandbox Observations</span>
                  </div>
                  <ul className="text-xs text-slate-300 space-y-1.5 list-disc list-inside">
                    {agentRun.evidence.map((ev, i) => (
                      <li key={i} className="leading-relaxed">{ev}</li>
                    ))}
                  </ul>
                </div>
              )}

              {agentRun.suggestedFixes && agentRun.suggestedFixes.length > 0 && (
                <div className="p-4 rounded-xl bg-slate-900/60 border border-slate-800 space-y-2">
                  <div className="text-xs font-semibold text-slate-200 flex items-center space-x-2">
                    <Lightbulb className="h-4 w-4 text-amber-400" />
                    <span>Actionable Recommendations</span>
                  </div>
                  <ul className="text-xs text-slate-300 space-y-1.5 list-disc list-inside">
                    {agentRun.suggestedFixes.map((fix, i) => (
                      <li key={i} className="leading-relaxed">{fix}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}

          {/* TAB 2: Sandbox Test Results Comparison */}
          {activeTab === 'tests' && (
            <div className="space-y-3">
              {executedTests.map((t, idx) => {
                const isPass = t.status === 'PASSED';
                return (
                  <div
                    key={idx}
                    className={`p-4 rounded-xl border space-y-3 ${
                      isPass
                        ? 'bg-emerald-950/10 border-emerald-800/30'
                        : 'bg-rose-950/15 border-rose-800/40'
                    }`}
                  >
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                      <div className="flex items-center space-x-2.5">
                        {isPass ? (
                          <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0" />
                        ) : (
                          <XCircle className="h-4 w-4 text-rose-400 shrink-0" />
                        )}
                        <span className="text-xs font-semibold text-white">{t.testName}</span>
                        <span className="text-[10px] font-mono uppercase px-1.5 py-0.5 rounded bg-slate-800 text-slate-400 border border-slate-700">
                          {t.category}
                        </span>
                      </div>

                      <div className="flex items-center space-x-2 text-xs">
                        <span className="font-mono text-slate-400">{t.durationMs}ms</span>
                        <span
                          className={`font-mono text-[11px] font-bold px-2 py-0.5 rounded ${
                            isPass
                              ? 'bg-emerald-500/20 text-emerald-400'
                              : 'bg-rose-500/20 text-rose-400'
                          }`}
                        >
                          Expected {t.expectedStatus} → Got {t.actualStatus ?? 'None'}
                        </span>
                      </div>
                    </div>

                    {/* Target details */}
                    <div className="text-[11px] font-mono text-slate-400 bg-slate-950/80 p-2 rounded-lg flex items-center justify-between overflow-x-auto">
                      <span>{t.method} {t.targetUrl}</span>
                    </div>

                    {/* Error message if failed */}
                    {t.errorMessage && (
                      <div className="text-xs text-rose-400/90 font-mono bg-rose-500/5 p-2 rounded-lg border border-rose-500/10">
                        {t.errorMessage}
                      </div>
                    )}

                    {/* Condition Evaluations */}
                    {t.conditionEvaluations && t.conditionEvaluations.length > 0 && (
                      <div className="space-y-1 text-xs">
                        <span className="text-[10px] uppercase font-bold text-slate-500 tracking-wider">
                          Assertion Evaluations:
                        </span>
                        {t.conditionEvaluations.map((cond, ci) => (
                          <div key={ci} className="flex items-center space-x-2 text-[11px]">
                            {cond.passed ? (
                              <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400 shrink-0" />
                            ) : (
                              <XCircle className="h-3.5 w-3.5 text-rose-400 shrink-0" />
                            )}
                            <span className={cond.passed ? 'text-slate-300' : 'text-rose-300'}>
                              {cond.condition}
                            </span>
                            {!cond.passed && (
                              <span className="text-rose-400/80 text-[10px]">({cond.reason})</span>
                            )}
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Response body snippet */}
                    {t.actualResponseBody && (
                      <details className="text-xs">
                        <summary className="text-[11px] text-slate-400 cursor-pointer hover:text-slate-200">
                          Inspect Response Payload
                        </summary>
                        <pre className="mt-1 p-2 rounded bg-slate-950 text-slate-300 font-mono text-[11px] overflow-x-auto border border-slate-800">
                          {JSON.stringify(t.actualResponseBody, null, 2)}
                        </pre>
                      </details>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {/* TAB 3: AI Failure Explainer */}
          {activeTab === 'diagnoses' && (
            <div className="space-y-4">
              {diagnoses.map((diag, di) => (
                <div key={di} className="p-5 rounded-xl bg-slate-900/90 border border-slate-800 space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-2">
                      <ShieldAlert className="h-4 w-4 text-rose-400" />
                      <h4 className="text-xs font-bold text-white uppercase tracking-wider">
                        Diagnosis: {diag.testName}
                      </h4>
                    </div>
                    <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-400 border border-amber-500/20">
                      AI Hypothesis
                    </span>
                  </div>

                  <div className="space-y-1">
                    <span className="text-[11px] font-semibold text-slate-400">Likely Root Cause</span>
                    <p className="text-xs text-rose-300 font-medium leading-relaxed">
                      {diag.likelyReason}
                    </p>
                  </div>

                  {diag.evidence && diag.evidence.length > 0 && (
                    <div className="space-y-1">
                      <span className="text-[11px] font-semibold text-slate-400">Supporting Evidence</span>
                      <ul className="text-xs text-slate-300 space-y-1 list-disc list-inside">
                        {diag.evidence.map((ev, ei) => (
                          <li key={ei}>{ev}</li>
                        ))}
                      </ul>
                    </div>
                  )}

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-2">
                    <div className="p-3 rounded-lg bg-slate-950 border border-slate-800/80 space-y-1">
                      <span className="text-[11px] font-semibold text-emerald-400 flex items-center space-x-1.5">
                        <CheckCircle2 className="h-3.5 w-3.5" />
                        <span>Suggested Correction</span>
                      </span>
                      <p className="text-xs text-slate-300 leading-relaxed">{diag.suggestedCorrection}</p>
                    </div>

                    <div className="p-3 rounded-lg bg-slate-950 border border-slate-800/80 space-y-1">
                      <span className="text-[11px] font-semibold text-indigo-400 flex items-center space-x-1.5">
                        <Sparkles className="h-3.5 w-3.5" />
                        <span>Recommended Additional Test</span>
                      </span>
                      <p className="text-xs text-slate-300 leading-relaxed">{diag.recommendedAdditionalTest}</p>
                    </div>
                  </div>

                  <div className="text-[10px] text-slate-500 italic border-t border-slate-800/60 pt-2">
                    {diag.disclaimer}
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* TAB 4: Expandable Execution Trace */}
          {activeTab === 'trace' && (
            <div className="rounded-xl bg-slate-950 border border-slate-800 p-4 space-y-3 font-mono text-xs">
              <div className="flex items-center justify-between border-b border-slate-800/80 pb-2">
                <span className="text-slate-400 font-semibold">Agent Workflow Trace Steps</span>
                <span className="text-slate-500">{traceSteps.length} recorded steps</span>
              </div>

              <div className="space-y-2">
                {traceSteps.map((step, si) => (
                  <div key={si} className="p-2.5 rounded-lg bg-slate-900/60 border border-slate-800/60 space-y-1">
                    <div className="flex items-center justify-between text-[11px]">
                      <div className="flex items-center space-x-2">
                        <span className="text-cyan-400 font-bold">Step #{step.stepNumber}</span>
                        <span className="px-1.5 py-0.5 rounded bg-slate-800 text-slate-300 text-[10px]">
                          {step.stepType}
                        </span>
                        {step.toolName && (
                          <span className="text-indigo-300 font-semibold">
                            tool: {step.toolName}
                          </span>
                        )}
                      </div>
                      <span className={step.stepStatus === 'SUCCESS' ? 'text-emerald-400' : 'text-rose-400'}>
                        {step.stepStatus}
                      </span>
                    </div>

                    {step.notes && (
                      <p className="text-slate-300 text-[11px]">{step.notes}</p>
                    )}

                    {(step.toolArgs || step.toolResult) && (
                      <details className="text-[10px] text-slate-500 mt-1">
                        <summary className="cursor-pointer hover:text-slate-400">Payload Details</summary>
                        <pre className="p-2 mt-1 rounded bg-slate-950 text-slate-400 overflow-x-auto">
                          {JSON.stringify({ args: step.toolArgs, result: step.toolResult }, null, 2)}
                        </pre>
                      </details>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* TAB 5: WebSocket Real-Time Event Log */}
          {activeTab === 'realtime' && (
            <div className="rounded-xl bg-slate-950 border border-slate-800 p-4 space-y-3 font-mono text-xs">
              <div className="flex items-center justify-between border-b border-slate-800/80 pb-2">
                <span className="text-slate-400 font-semibold">Raw WebSocket Event Stream</span>
                <span className="text-slate-500">{liveEvents.length} events streamed</span>
              </div>

              <div className="space-y-2 max-h-96 overflow-y-auto">
                {liveEvents.length === 0 ? (
                  <div className="text-slate-500 text-center py-4">No events captured yet</div>
                ) : (
                  liveEvents.map((ev, ei) => (
                    <div key={ei} className="p-2 rounded bg-slate-900/60 border border-slate-800/60 space-y-1">
                      <div className="flex items-center justify-between text-[11px]">
                        <span className="text-cyan-400 font-bold">{ev.eventType}</span>
                        <span className="text-slate-500">{new Date(ev.timestamp).toLocaleTimeString()}</span>
                      </div>
                      <pre className="text-[10px] text-slate-400 overflow-x-auto bg-slate-950 p-1.5 rounded">
                        {JSON.stringify(ev.data, null, 2)}
                      </pre>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default AiAgentInvestigation;
