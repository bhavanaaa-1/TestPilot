import React, { useState, useEffect } from 'react';
import {
  ShieldCheck,
  Play,
  RotateCw,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Layers,
  ChevronDown,
  ChevronRight,
  Sparkles,
  BarChart3,
  Cpu,
  Clock,
  Database,
  ArrowRight,
  Check,
  FileText,
} from 'lucide-react';

export function EvaluationDashboard() {
  const [datasets, setDatasets] = useState([]);
  const [selectedDatasetId, setSelectedDatasetId] = useState('benchmark-v1');
  const [summary, setSummary] = useState(null);
  const [currentRun, setCurrentRun] = useState(null);
  const [isRunning, setIsRunning] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [expandedCaseId, setExpandedCaseId] = useState(null);
  const [activeTab, setActiveTab] = useState('cases'); // 'cases' | 'dataset' | 'history'

  const fetchSummary = async () => {
    try {
      const res = await fetch('http://localhost:5000/api/evaluations/summary');
      if (res.ok) {
        const json = await res.json();
        setSummary(json.data);
        if (json.data?.recentRuns && json.data.recentRuns.length > 0 && !currentRun) {
          setCurrentRun(json.data.recentRuns[0]);
        }
      }
    } catch (err) {
      console.warn('Failed to fetch evaluation summary:', err);
    }
  };

  const fetchDatasets = async () => {
    try {
      const res = await fetch('http://localhost:5000/api/evaluations/datasets');
      if (res.ok) {
        const json = await res.json();
        setDatasets(json.data || []);
      }
    } catch (err) {
      console.warn('Failed to fetch evaluation datasets:', err);
    }
  };

  useEffect(() => {
    async function init() {
      setLoading(true);
      await Promise.all([fetchDatasets(), fetchSummary()]);
      setLoading(false);
    }
    init();
  }, []);

  const handleRunEvaluation = async () => {
    setIsRunning(true);
    setError(null);

    try {
      const res = await fetch('http://localhost:5000/api/evaluations/run', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          datasetId: selectedDatasetId,
        }),
      });

      const json = await res.json();
      if (!res.ok) {
        throw new Error(json.error?.message || json.message || 'Evaluation run failed');
      }

      setCurrentRun(json.data);
      await fetchSummary();
    } catch (err) {
      setError(err.message);
    } finally {
      setIsRunning(false);
    }
  };

  const metrics = currentRun?.metrics || null;
  const caseResults = currentRun?.caseResults || [];
  const selectedDataset = datasets.find((d) => d.id === selectedDatasetId);

  return (
    <div className="p-6 md:p-8 max-w-7xl mx-auto space-y-6">
      {/* Top Header Banner */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 p-6 rounded-2xl bg-slate-900/80 border border-slate-800">
        <div className="space-y-1.5">
          <div className="flex items-center space-x-2">
            <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
              Phase 5 Benchmark
            </span>
            <span className="text-xs text-slate-400 font-mono">LLM Evaluation Sets & Metrics</span>
          </div>
          <h2 className="text-2xl font-bold tracking-tight text-white flex items-center space-x-2">
            <ShieldCheck className="h-6 w-6 text-indigo-400" />
            <span>LLM Evaluation Benchmark</span>
          </h2>
          <p className="text-xs text-slate-400 max-w-2xl leading-relaxed">
            Standardized evaluation framework measuring model accuracy against curated ground-truth test cases across schema validity, endpoint targeting, HTTP method correctness, status accuracy, and category coverage.
          </p>
        </div>

        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 shrink-0">
          <select
            value={selectedDatasetId}
            onChange={(e) => setSelectedDatasetId(e.target.value)}
            disabled={isRunning}
            className="bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-indigo-500"
          >
            {datasets.map((d) => (
              <option key={d.id} value={d.id}>
                {d.name} ({d.caseCount} cases)
              </option>
            ))}
          </select>

          <button
            onClick={handleRunEvaluation}
            disabled={isRunning}
            className="px-5 py-2.5 rounded-lg bg-gradient-to-r from-indigo-600 to-cyan-600 hover:from-indigo-500 hover:to-cyan-500 text-white text-xs font-semibold shadow-md shadow-indigo-600/20 flex items-center justify-center space-x-2 transition-all disabled:opacity-50"
          >
            {isRunning ? (
              <>
                <RotateCw className="h-4 w-4 animate-spin text-indigo-200" />
                <span>Running Benchmark...</span>
              </>
            ) : (
              <>
                <Play className="h-4 w-4 fill-white" />
                <span>Run Evaluation Benchmark</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* Error banner */}
      {error && (
        <div className="p-4 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs flex items-start space-x-2.5">
          <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5 text-rose-400" />
          <div>
            <div className="font-semibold">Evaluation Error</div>
            <div className="text-rose-400/90 mt-0.5">{error}</div>
          </div>
        </div>
      )}

      {/* Benchmark Radar during execution */}
      {isRunning && (
        <div className="p-8 rounded-2xl bg-slate-900/40 border border-slate-800 text-center space-y-4">
          <div className="relative mx-auto w-16 h-16">
            <div className="absolute inset-0 rounded-full border-2 border-indigo-500/30 animate-ping" />
            <div className="relative w-16 h-16 rounded-full bg-indigo-500/10 border border-indigo-500/40 flex items-center justify-center text-indigo-400">
              <Cpu className="h-8 w-8 animate-pulse" />
            </div>
          </div>
          <div>
            <h4 className="text-sm font-semibold text-white">Running 16-Case Benchmark Evaluation</h4>
            <p className="text-xs text-slate-400 mt-1 max-w-md mx-auto">
              Evaluating generated test cases against fixed reference specifications, calculating deterministic metrics across 5 quality dimensions, and recording results into PostgreSQL...
            </p>
          </div>
        </div>
      )}

      {/* Metrics Banner */}
      {metrics && !isRunning && (
        <div className="space-y-6">
          <div className="grid grid-cols-2 md:grid-cols-6 gap-3">
            {/* Overall Composite Score */}
            <div className="p-4 rounded-xl bg-slate-900/90 border border-slate-800 col-span-2 md:col-span-1 flex flex-col justify-between">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Overall Score</span>
              <div className="mt-2">
                <div className="text-2xl font-black text-indigo-400 font-mono">
                  {metrics.overallScore}%
                </div>
                <div className="mt-1 flex items-center space-x-1.5">
                  {metrics.passed ? (
                    <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                      PASSED (≥70%)
                    </span>
                  ) : (
                    <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-rose-500/10 text-rose-400 border border-rose-500/20">
                      FAILED (&lt;70%)
                    </span>
                  )}
                </div>
              </div>
            </div>

            {/* Schema Validity */}
            <div className="p-4 rounded-xl bg-slate-900/90 border border-slate-800">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Schema Validity</span>
                <span className="text-[10px] text-slate-500 font-mono">w:20%</span>
              </div>
              <div className="mt-2 text-xl font-bold text-white font-mono">
                {metrics.schemaValidity}%
              </div>
              <span className="text-[10px] text-slate-400">Strict Zod contract</span>
            </div>

            {/* Endpoint Accuracy */}
            <div className="p-4 rounded-xl bg-slate-900/90 border border-slate-800">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Endpoint Match</span>
                <span className="text-[10px] text-slate-500 font-mono">w:20%</span>
              </div>
              <div className="mt-2 text-xl font-bold text-white font-mono">
                {metrics.endpointAccuracy}%
              </div>
              <span className="text-[10px] text-slate-400">Exact path match</span>
            </div>

            {/* Method Accuracy */}
            <div className="p-4 rounded-xl bg-slate-900/90 border border-slate-800">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Method Match</span>
                <span className="text-[10px] text-slate-500 font-mono">w:20%</span>
              </div>
              <div className="mt-2 text-xl font-bold text-white font-mono">
                {metrics.methodAccuracy}%
              </div>
              <span className="text-[10px] text-slate-400">HTTP verb match</span>
            </div>

            {/* Status Accuracy */}
            <div className="p-4 rounded-xl bg-slate-900/90 border border-slate-800">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Status Match</span>
                <span className="text-[10px] text-slate-500 font-mono">w:25%</span>
              </div>
              <div className="mt-2 text-xl font-bold text-emerald-400 font-mono">
                {metrics.expectedStatusAccuracy}%
              </div>
              <span className="text-[10px] text-slate-400">Expected HTTP code</span>
            </div>

            {/* Category Coverage */}
            <div className="p-4 rounded-xl bg-slate-900/90 border border-slate-800">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Coverage</span>
                <span className="text-[10px] text-slate-500 font-mono">w:15%</span>
              </div>
              <div className="mt-2 text-xl font-bold text-cyan-400 font-mono">
                {metrics.categoryCoverage}%
              </div>
              <span className="text-[10px] text-slate-400">Pos / Neg / Bound</span>
            </div>
          </div>

          {/* Sub Navigation */}
          <div className="flex border-b border-slate-800 text-xs">
            <button
              onClick={() => setActiveTab('cases')}
              className={`px-4 py-2 font-medium border-b-2 transition-all flex items-center space-x-1.5 ${
                activeTab === 'cases'
                  ? 'border-indigo-400 text-indigo-300 font-semibold'
                  : 'border-transparent text-slate-400 hover:text-slate-200'
              }`}
            >
              <span>Benchmark Case Results ({caseResults.length})</span>
            </button>
            <button
              onClick={() => setActiveTab('dataset')}
              className={`px-4 py-2 font-medium border-b-2 transition-all flex items-center space-x-1.5 ${
                activeTab === 'dataset'
                  ? 'border-indigo-400 text-indigo-300 font-semibold'
                  : 'border-transparent text-slate-400 hover:text-slate-200'
              }`}
            >
              <span>Dataset Spec ({selectedDataset?.caseCount || 16} Cases)</span>
            </button>
            <button
              onClick={() => setActiveTab('history')}
              className={`px-4 py-2 font-medium border-b-2 transition-all flex items-center space-x-1.5 ${
                activeTab === 'history'
                  ? 'border-indigo-400 text-indigo-300 font-semibold'
                  : 'border-transparent text-slate-400 hover:text-slate-200'
              }`}
            >
              <span>Historical Runs ({summary?.recentRuns?.length || 0})</span>
            </button>
          </div>

          {/* TAB 1: Case Results Table */}
          {activeTab === 'cases' && (
            <div className="space-y-3">
              <div className="overflow-x-auto rounded-xl border border-slate-800 bg-slate-900/60">
                <table className="w-full text-left text-xs text-slate-300">
                  <thead className="bg-slate-950/80 text-[11px] uppercase tracking-wider text-slate-500 border-b border-slate-800">
                    <tr>
                      <th className="py-3 px-4">Endpoint</th>
                      <th className="py-3 px-3">Category</th>
                      <th className="py-3 px-4">Reference Case Name</th>
                      <th className="py-3 px-4">Generated Test Name</th>
                      <th className="py-3 px-3 text-center">Status (Exp / Gen)</th>
                      <th className="py-3 px-3 text-center">Score</th>
                      <th className="py-3 px-3 text-right">Result</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60">
                    {caseResults.map((c) => {
                      const isExpanded = expandedCaseId === c.caseId;
                      const isPassed = c.passed;
                      return (
                        <React.Fragment key={c.caseId}>
                          <tr
                            onClick={() => setExpandedCaseId(isExpanded ? null : c.caseId)}
                            className="hover:bg-slate-800/40 cursor-pointer transition-colors"
                          >
                            <td className="py-3 px-4 font-mono font-medium text-slate-200 flex items-center space-x-1.5">
                              {isExpanded ? (
                                <ChevronDown className="h-3.5 w-3.5 text-slate-400" />
                              ) : (
                                <ChevronRight className="h-3.5 w-3.5 text-slate-500" />
                              )}
                              <span>{c.endpointMethod} {c.endpointPath}</span>
                            </td>
                            <td className="py-3 px-3">
                              <span className="text-[10px] font-mono uppercase px-1.5 py-0.5 rounded bg-slate-800 text-slate-400 border border-slate-700">
                                {c.category}
                              </span>
                            </td>
                            <td className="py-3 px-4 text-slate-300 max-w-xs truncate font-medium">
                              {c.caseName}
                            </td>
                            <td className="py-3 px-4 text-slate-400 max-w-xs truncate">
                              {c.generatedTestName || '—'}
                            </td>
                            <td className="py-3 px-3 text-center font-mono text-[11px]">
                              <span className="text-slate-400">{c.expectedStatus}</span>
                              <span className="text-slate-600 mx-1">/</span>
                              <span className={c.statusMatch ? 'text-emerald-400 font-bold' : 'text-rose-400 font-bold'}>
                                {c.generatedStatus ?? '—'}
                              </span>
                            </td>
                            <td className="py-3 px-3 text-center font-mono font-bold text-slate-200">
                              {c.score}%
                            </td>
                            <td className="py-3 px-3 text-right">
                              {isPassed ? (
                                <span className="inline-flex items-center space-x-1 text-[11px] font-semibold text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20">
                                  <CheckCircle2 className="h-3 w-3" />
                                  <span>PASS</span>
                                </span>
                              ) : (
                                <span className="inline-flex items-center space-x-1 text-[11px] font-semibold text-rose-400 bg-rose-500/10 px-2 py-0.5 rounded border border-rose-500/20">
                                  <XCircle className="h-3 w-3" />
                                  <span>FAIL</span>
                                </span>
                              )}
                            </td>
                          </tr>

                          {/* Expanded comparison row */}
                          {isExpanded && (
                            <tr className="bg-slate-950/70 border-b border-slate-800">
                              <td colSpan={7} className="p-4 space-y-3">
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                  <div className="p-3 rounded-lg bg-slate-900 border border-slate-800 space-y-1.5">
                                    <div className="text-[10px] font-bold uppercase text-slate-500 tracking-wider">
                                      Reference Benchmark Specification
                                    </div>
                                    <div className="text-xs font-semibold text-white">{c.caseName}</div>
                                    <p className="text-xs text-slate-400">{c.description}</p>
                                    <div className="text-[11px] font-mono text-indigo-300">
                                      Expected HTTP Status: {c.expectedStatus}
                                    </div>
                                  </div>

                                  <div className="p-3 rounded-lg bg-slate-900 border border-slate-800 space-y-1.5">
                                    <div className="text-[10px] font-bold uppercase text-slate-500 tracking-wider">
                                      Generated Case Assertion
                                    </div>
                                    <div className="text-xs font-semibold text-white">
                                      {c.generatedTestName || 'No matching test generated'}
                                    </div>
                                    <div className="flex items-center space-x-3 text-[11px] font-mono pt-1">
                                      <span className={c.schemaValid ? 'text-emerald-400' : 'text-rose-400'}>
                                        Schema: {c.schemaValid ? 'Valid' : 'Invalid'}
                                      </span>
                                      <span className={c.endpointMatch ? 'text-emerald-400' : 'text-rose-400'}>
                                        Path: {c.endpointMatch ? 'Match' : 'Mismatch'}
                                      </span>
                                      <span className={c.methodMatch ? 'text-emerald-400' : 'text-rose-400'}>
                                        Method: {c.methodMatch ? 'Match' : 'Mismatch'}
                                      </span>
                                    </div>
                                    {c.notes && (
                                      <p className="text-[11px] text-slate-400 pt-1 border-t border-slate-800">
                                        {c.notes}
                                      </p>
                                    )}
                                  </div>
                                </div>
                              </td>
                            </tr>
                          )}
                        </React.Fragment>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* TAB 2: Dataset Spec */}
          {activeTab === 'dataset' && selectedDataset && (
            <div className="p-5 rounded-xl bg-slate-900/80 border border-slate-800 space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-base font-bold text-white">{selectedDataset.name}</h3>
                  <p className="text-xs text-slate-400 mt-0.5">{selectedDataset.description}</p>
                </div>
                <span className="text-xs font-mono text-indigo-400 bg-indigo-500/10 px-2 py-1 rounded border border-indigo-500/20">
                  Version {selectedDataset.version}
                </span>
              </div>

              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs">
                <div className="p-3 rounded-lg bg-slate-950 border border-slate-800">
                  <span className="text-[10px] font-bold uppercase text-slate-500">Total Cases</span>
                  <div className="text-lg font-bold text-white mt-1">{selectedDataset.caseCount}</div>
                </div>
                <div className="p-3 rounded-lg bg-slate-950 border border-slate-800">
                  <span className="text-[10px] font-bold uppercase text-slate-500">Endpoints Covered</span>
                  <div className="text-lg font-bold text-emerald-400 mt-1">4 / 4</div>
                </div>
                <div className="p-3 rounded-lg bg-slate-950 border border-slate-800">
                  <span className="text-[10px] font-bold uppercase text-slate-500">Categories</span>
                  <div className="text-lg font-bold text-cyan-400 mt-1">Positive, Negative, Boundary</div>
                </div>
                <div className="p-3 rounded-lg bg-slate-950 border border-slate-800">
                  <span className="text-[10px] font-bold uppercase text-slate-500">Evaluation Type</span>
                  <div className="text-lg font-bold text-indigo-400 mt-1">Deterministic Rule-Based</div>
                </div>
              </div>
            </div>
          )}

          {/* TAB 3: History */}
          {activeTab === 'history' && (
            <div className="space-y-3">
              <div className="overflow-x-auto rounded-xl border border-slate-800 bg-slate-900/60">
                <table className="w-full text-left text-xs text-slate-300">
                  <thead className="bg-slate-950/80 text-[11px] uppercase tracking-wider text-slate-500 border-b border-slate-800">
                    <tr>
                      <th className="py-3 px-4">Run ID</th>
                      <th className="py-3 px-4">Dataset</th>
                      <th className="py-3 px-4">Timestamp</th>
                      <th className="py-3 px-3 text-center">Cases</th>
                      <th className="py-3 px-3 text-center">Overall Score</th>
                      <th className="py-3 px-4 text-right">Result</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60">
                    {(summary?.recentRuns || []).map((r) => (
                      <tr key={r.id} className="hover:bg-slate-800/40">
                        <td className="py-3 px-4 font-mono text-indigo-300">{r.id}</td>
                        <td className="py-3 px-4 text-slate-300">{r.datasetName || r.datasetId}</td>
                        <td className="py-3 px-4 text-slate-400">
                          {new Date(r.createdAt).toLocaleString()}
                        </td>
                        <td className="py-3 px-3 text-center font-mono">{r.totalCases}</td>
                        <td className="py-3 px-3 text-center font-mono font-bold text-white">
                          {r.overallScore}%
                        </td>
                        <td className="py-3 px-4 text-right">
                          {r.passed ? (
                            <span className="text-[11px] font-semibold text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20">
                              PASS
                            </span>
                          ) : (
                            <span className="text-[11px] font-semibold text-rose-400 bg-rose-500/10 px-2 py-0.5 rounded border border-rose-500/20">
                              FAIL
                            </span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default EvaluationDashboard;
