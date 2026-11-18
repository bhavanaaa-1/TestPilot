import React, { useState } from 'react';
import {
  Sparkles,
  Loader2,
  CheckCircle2,
  AlertCircle,
  Copy,
  Check,
  Cpu,
  Layers,
  Wrench,
  ChevronDown,
  ChevronRight,
  ShieldAlert,
  ArrowRight,
  Terminal,
} from 'lucide-react';

const CATEGORY_STYLES = {
  positive: {
    badge: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30',
    title: 'Positive / Happy Path',
  },
  negative: {
    badge: 'bg-rose-500/15 text-rose-400 border-rose-500/30',
    title: 'Negative / Error',
  },
  boundary: {
    badge: 'bg-purple-500/15 text-purple-400 border-purple-500/30',
    title: 'Boundary / Edge Case',
  },
  edge: {
    badge: 'bg-purple-500/15 text-purple-400 border-purple-500/30',
    title: 'Edge Case',
  },
};

export function AiTestGenerator({ endpoint }) {
  const [categories, setCategories] = useState(['positive', 'negative', 'boundary']);
  const [apiKeyOverride, setApiKeyOverride] = useState('');
  const [showKeyInput, setShowKeyInput] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [generatedResult, setGeneratedResult] = useState(null);
  const [activeFilter, setActiveFilter] = useState('all');
  const [copiedId, setCopiedId] = useState(null);
  const [showToolCalls, setShowToolCalls] = useState(false);

  const toggleCategory = (cat) => {
    if (categories.includes(cat)) {
      if (categories.length > 1) {
        setCategories(categories.filter((c) => c !== cat));
      }
    } else {
      setCategories([...categories, cat]);
    }
  };

  const handleCopy = (id, text) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleGenerate = async () => {
    if (!endpoint) return;

    setLoading(true);
    setError(null);

    try {
      const res = await fetch('http://localhost:5000/api/ai/generate-tests', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          endpointId: endpoint.id,
          categories,
          apiKeyOverride: apiKeyOverride.trim() || undefined,
        }),
      });

      const data = await res.json();

      if (!res.ok || !data.success) {
        setError(data.error || { message: 'Failed to generate test cases.' });
        if (data.error?.code === 'GEMINI_API_KEY_MISSING') {
          setShowKeyInput(true);
        }
      } else {
        setGeneratedResult(data.data);
        setActiveFilter('all');
      }
    } catch (err) {
      setError({
        message: 'Network connection failed while calling backend server on :5000.',
        details: err.message,
      });
    } finally {
      setLoading(false);
    }
  };

  const tests = generatedResult?.tests || [];
  const filteredTests = tests.filter((t) => {
    if (activeFilter === 'all') return true;
    return t.category === activeFilter;
  });

  return (
    <div className="space-y-6 animate-fadeIn">
      {/* Generator Control Card */}
      <div className="p-5 rounded-2xl bg-gradient-to-b from-indigo-950/30 to-slate-900/60 border border-indigo-900/40 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center space-x-3">
            <div className="h-10 w-10 rounded-xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400 shadow-sm">
              <Sparkles className="h-5 w-5" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-white flex items-center space-x-2">
                <span>Autonomous AI Test Synthesis</span>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-indigo-500/15 text-indigo-300 border border-indigo-500/30">
                  Gemini API
                </span>
              </h3>
              <p className="text-xs text-slate-400">
                Generate high-coverage positive, negative, and boundary test cases for{' '}
                <span className="font-mono text-indigo-300 font-semibold">{endpoint.method} {endpoint.path}</span>
              </p>
            </div>
          </div>

          <button
            onClick={handleGenerate}
            disabled={loading}
            className="px-4 py-2.5 rounded-xl bg-gradient-to-r from-indigo-600 via-indigo-500 to-cyan-500 hover:from-indigo-500 hover:to-cyan-400 text-white text-xs font-bold transition-all shadow-lg shadow-indigo-600/25 flex items-center justify-center space-x-2 disabled:opacity-50 shrink-0"
          >
            {loading ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                <span>Synthesizing Tests...</span>
              </>
            ) : (
              <>
                <Sparkles className="h-4 w-4" />
                <span>Generate Test Cases</span>
              </>
            )}
          </button>
        </div>

        {/* Category Toggles */}
        <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-slate-800/80">
          <span className="text-xs font-semibold text-slate-400 mr-2">Target Categories:</span>
          {[
            { id: 'positive', label: 'Positive (Happy Path)' },
            { id: 'negative', label: 'Negative (Validation / 4xx)' },
            { id: 'boundary', label: 'Boundary / Edge Cases' },
          ].map((cat) => {
            const checked = categories.includes(cat.id);
            return (
              <button
                key={cat.id}
                type="button"
                onClick={() => toggleCategory(cat.id)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-all flex items-center space-x-1.5 ${
                  checked
                    ? 'bg-indigo-600/20 text-indigo-300 border-indigo-500/40 shadow-sm'
                    : 'bg-slate-900/60 text-slate-500 border-slate-800 hover:text-slate-300'
                }`}
              >
                <div
                  className={`h-2 w-2 rounded-full ${
                    checked ? 'bg-indigo-400 shadow-sm shadow-indigo-400/50' : 'bg-slate-700'
                  }`}
                />
                <span>{cat.label}</span>
              </button>
            );
          })}

          <button
            onClick={() => setShowKeyInput(!showKeyInput)}
            className="ml-auto text-[11px] text-slate-500 hover:text-indigo-400 transition-colors underline"
          >
            {showKeyInput ? 'Hide Key Override' : 'Configure API Key'}
          </button>
        </div>

        {/* Optional Client-Side API Key Input */}
        {showKeyInput && (
          <div className="p-3.5 rounded-xl bg-slate-950/70 border border-slate-800 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-300">Gemini API Key Override (Optional)</span>
              <span className="text-[10px] text-slate-500">
                Defaults to server <code className="text-indigo-300">GEMINI_API_KEY</code>
              </span>
            </div>
            <input
              type="password"
              value={apiKeyOverride}
              onChange={(e) => setApiKeyOverride(e.target.value)}
              placeholder="Paste AI Studio API key (AIzaSy...)"
              className="w-full px-3 py-1.5 rounded-lg bg-slate-900 border border-slate-700 text-xs text-white placeholder-slate-600 focus:outline-none focus:border-indigo-500"
            />
          </div>
        )}
      </div>

      {/* Error Alert */}
      {error && (
        <div className="p-4 rounded-xl bg-rose-950/40 border border-rose-800/60 text-xs text-rose-200 space-y-2 animate-fadeIn shadow-md">
          <div className="flex items-start space-x-2.5">
            <AlertCircle className="h-5 w-5 text-rose-400 shrink-0 mt-0.5" />
            <div className="space-y-1 flex-1">
              <div className="font-semibold text-rose-300">{error.message}</div>
              {error.code === 'GEMINI_API_KEY_MISSING' && (
                <p className="text-[11px] text-rose-300/80 leading-relaxed">
                  Add <code className="bg-rose-950 px-1.5 py-0.5 rounded font-mono text-rose-200">GEMINI_API_KEY=your_key</code> in{' '}
                  <code className="bg-rose-950 px-1.5 py-0.5 rounded font-mono text-rose-200">server/.env</code>, or use the "Configure API Key" button above to provide a key for this session.
                </p>
              )}
              {error.details && (
                <pre className="text-[10px] font-mono text-rose-400 p-2 bg-rose-950/60 rounded border border-rose-900/40 overflow-x-auto">
                  {typeof error.details === 'string' ? error.details : JSON.stringify(error.details, null, 2)}
                </pre>
              )}
            </div>
          </div>
        </div>
      )}

      {/* In-Progress Loading State */}
      {loading && (
        <div className="p-10 rounded-2xl bg-slate-900/40 border border-slate-800 text-center space-y-4">
          <div className="mx-auto w-12 h-12 rounded-xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400 shadow-inner">
            <Loader2 className="h-6 w-6 animate-spin" />
          </div>
          <div className="space-y-1.5">
            <h4 className="text-sm font-bold text-white">Synthesizing Tests via Gemini Model...</h4>
            <p className="text-xs text-slate-400 max-w-md mx-auto leading-relaxed">
              Gemini is analyzing endpoint schema, invoking schema inspection tools, and generating strictly validated test cases.
            </p>
          </div>
          <div className="flex items-center justify-center space-x-2 text-[10px] text-slate-500 font-mono">
            <span>Fenced Data Isolation</span>
            <span>•</span>
            <span>Bounded Tool Calling</span>
            <span>•</span>
            <span>Zod Validation</span>
          </div>
        </div>
      )}

      {/* Generated Tests Results */}
      {generatedResult && !loading && (
        <div className="space-y-5 animate-fadeIn">
          {/* Usage and Cost Summary Bar */}
          <div className="p-4 rounded-xl bg-slate-950/80 border border-slate-800 flex flex-wrap items-center justify-between gap-3 text-xs">
            <div className="flex flex-wrap items-center gap-3">
              <span className="flex items-center space-x-1.5 text-slate-300 font-medium">
                <Cpu className="h-3.5 w-3.5 text-indigo-400" />
                <span className="text-slate-500">Model:</span>
                <span className="font-mono text-indigo-300">{generatedResult.usage?.model}</span>
              </span>

              <span className="text-slate-600">|</span>

              <span className="flex items-center space-x-1.5 text-slate-300">
                <span className="text-slate-500">Tokens:</span>
                <span className="font-mono font-bold text-slate-200">
                  {generatedResult.usage?.totalTokens}
                </span>
                <span className="text-[10px] text-slate-500">
                  ({generatedResult.usage?.inputTokens} in / {generatedResult.usage?.outputTokens} out)
                </span>
              </span>

              <span className="text-slate-600">|</span>

              <span className="flex items-center space-x-1.5 text-slate-300">
                <span className="text-slate-500">Duration:</span>
                <span className="font-mono text-slate-200">{(generatedResult.usage?.durationMs / 1000).toFixed(2)}s</span>
              </span>

              <span className="text-slate-600">|</span>

              <span className="flex items-center space-x-1.5 text-emerald-400 font-bold">
                <span className="text-slate-500 font-normal">Est. Cost:</span>
                <span>{generatedResult.usage?.estimatedCostFormatted}</span>
              </span>
            </div>

            {/* Function Calling Tool Calls Badge */}
            {generatedResult.toolInvocations && generatedResult.toolInvocations.length > 0 && (
              <button
                onClick={() => setShowToolCalls(!showToolCalls)}
                className="px-2.5 py-1 rounded-lg bg-indigo-950/50 hover:bg-indigo-950 text-indigo-300 border border-indigo-800/40 text-[11px] font-semibold flex items-center space-x-1.5 transition-all"
              >
                <Wrench className="h-3 w-3 text-cyan-400" />
                <span>{generatedResult.toolInvocations.length} Tool Calls Made</span>
                {showToolCalls ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
              </button>
            )}
          </div>

          {/* Expandable Tool Call Invocations Log */}
          {showToolCalls && generatedResult.toolInvocations && (
            <div className="p-4 rounded-xl bg-slate-950 border border-indigo-950 space-y-2 text-xs">
              <div className="text-[11px] font-bold uppercase tracking-wider text-indigo-400">
                Function Calling Execution Log
              </div>
              <div className="space-y-1.5 font-mono text-[11px]">
                {generatedResult.toolInvocations.map((t, i) => (
                  <div key={i} className="p-2 rounded bg-slate-900 border border-slate-800 flex items-center justify-between">
                    <span className="text-cyan-400 font-bold">{t.toolName}</span>
                    <span className="text-slate-400 truncate max-w-sm">{JSON.stringify(t.args)}</span>
                    <span className="text-emerald-400 font-sans text-[10px]">{t.resultSummary}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Category Filter Tabs */}
          <div className="flex items-center justify-between border-b border-slate-800 pb-2">
            <div className="flex items-center space-x-2">
              {[
                { id: 'all', label: `All Tests (${tests.length})` },
                { id: 'positive', label: `Positive (${tests.filter((t) => t.category === 'positive').length})` },
                { id: 'negative', label: `Negative (${tests.filter((t) => t.category === 'negative').length})` },
                { id: 'boundary', label: `Boundary (${tests.filter((t) => t.category === 'boundary' || t.category === 'edge').length})` },
              ].map((f) => (
                <button
                  key={f.id}
                  onClick={() => setActiveFilter(f.id)}
                  className={`px-3 py-1 rounded-lg text-xs font-semibold transition-all ${
                    activeFilter === f.id
                      ? 'bg-indigo-600 text-white shadow-sm'
                      : 'bg-slate-900 text-slate-400 hover:text-slate-200'
                  }`}
                >
                  {f.label}
                </button>
              ))}
            </div>

            <span className="text-xs text-slate-500 font-mono">
              Validated via Zod Schema
            </span>
          </div>

          {/* Test Case Cards List */}
          <div className="space-y-4">
            {filteredTests.map((test) => {
              const catStyle = CATEGORY_STYLES[test.category] || CATEGORY_STYLES.positive;
              const isStatusSuccess = test.expectedStatus < 300;

              return (
                <div
                  key={test.id}
                  className="p-5 rounded-2xl bg-slate-950/60 border border-slate-800 space-y-4 shadow-sm hover:border-slate-700 transition-all"
                >
                  {/* Card Header */}
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-850 pb-3">
                    <div className="flex flex-wrap items-center gap-2.5">
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider border ${catStyle.badge}`}>
                        {test.category}
                      </span>
                      <h4 className="text-sm font-bold text-slate-100">{test.name}</h4>
                    </div>

                    <div className="flex items-center space-x-2">
                      <span
                        className={`px-2.5 py-0.5 rounded-md font-mono text-xs font-bold border ${
                          isStatusSuccess
                            ? 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30'
                            : 'bg-rose-500/15 text-rose-400 border-rose-500/30'
                        }`}
                      >
                        Expect HTTP {test.expectedStatus}
                      </span>
                    </div>
                  </div>

                  {/* Description */}
                  <p className="text-xs text-slate-300 leading-relaxed">{test.description}</p>

                  {/* Request Endpoint & Path */}
                  <div className="p-3 rounded-xl bg-slate-900/80 border border-slate-800 font-mono text-xs flex items-center space-x-3">
                    <span className="font-bold text-indigo-400">{test.method}</span>
                    <span className="text-slate-200">{test.path}</span>
                  </div>

                  {/* Request Body Preview (if applicable) */}
                  {test.requestBody && (
                    <div className="space-y-1.5">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-semibold text-slate-400">Request Body Payload:</span>
                        <button
                          onClick={() => handleCopy(test.id, JSON.stringify(test.requestBody, null, 2))}
                          className="text-[11px] text-indigo-400 hover:text-indigo-300 flex items-center space-x-1"
                        >
                          {copiedId === test.id ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
                          <span>{copiedId === test.id ? 'Copied' : 'Copy Payload'}</span>
                        </button>
                      </div>
                      <pre className="text-xs font-mono text-slate-200 p-3 bg-slate-900 rounded-lg overflow-x-auto border border-slate-800">
                        {JSON.stringify(test.requestBody, null, 2)}
                      </pre>
                    </div>
                  )}

                  {/* Query Params (if present) */}
                  {test.queryParams && Object.keys(test.queryParams).length > 0 && (
                    <div className="space-y-1 text-xs font-mono">
                      <span className="text-slate-400 font-sans font-semibold">Query Parameters: </span>
                      <span className="text-amber-400">{JSON.stringify(test.queryParams)}</span>
                    </div>
                  )}

                  {/* Expected Response Conditions */}
                  <div className="p-3 rounded-xl bg-slate-900/50 border border-slate-800/80 space-y-1.5 text-xs">
                    <div className="font-semibold text-slate-300 flex items-center space-x-1.5">
                      <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" />
                      <span>Expected Response Assertions:</span>
                    </div>
                    <div className="text-slate-400 pl-5">
                      {typeof test.expectedResponse === 'string'
                        ? test.expectedResponse
                        : test.expectedResponse?.description}
                    </div>
                    {test.expectedResponse?.bodyAssertions && test.expectedResponse.bodyAssertions.length > 0 && (
                      <ul className="list-disc list-inside text-[11px] text-slate-400 pl-5 space-y-0.5 font-mono">
                        {test.expectedResponse.bodyAssertions.map((assertion, idx) => (
                          <li key={idx}>{assertion}</li>
                        ))}
                      </ul>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

export default AiTestGenerator;
