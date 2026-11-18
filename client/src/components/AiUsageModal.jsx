import React, { useState, useEffect } from 'react';
import { Cpu, DollarSign, Clock, Hash, RefreshCw, X, ShieldAlert, Sparkles } from 'lucide-react';

export function AiUsageModal({ isOpen, onClose }) {
  const [usageData, setUsageData] = useState(null);
  const [loading, setLoading] = useState(false);

  const fetchUsage = async () => {
    setLoading(true);
    try {
      const res = await fetch('http://localhost:5000/api/ai/usage');
      const data = await res.json();
      if (res.ok && data.success) {
        setUsageData(data.data);
      }
    } catch {
      // Ignored
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      fetchUsage();
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const summary = usageData?.summary;
  const recentRequests = usageData?.recentRequests || [];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-fadeIn">
      <div className="w-full max-w-3xl rounded-2xl bg-slate-900 border border-slate-800 shadow-2xl overflow-hidden flex flex-col max-h-[85vh]">
        {/* Header */}
        <div className="p-5 border-b border-slate-800 flex items-center justify-between bg-slate-900/90">
          <div className="flex items-center space-x-3">
            <div className="h-9 w-9 rounded-xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400">
              <Sparkles className="h-5 w-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white">AI Token &amp; Cost Monitoring</h3>
              <p className="text-xs text-slate-400">Real-time Gemini API token usage and published rate estimates</p>
            </div>
          </div>
          <div className="flex items-center space-x-2">
            <button
              onClick={fetchUsage}
              disabled={loading}
              className="p-1.5 rounded-lg bg-slate-800 text-slate-400 hover:text-white transition-all disabled:opacity-50"
              title="Refresh usage"
            >
              <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            </button>
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg bg-slate-800 text-slate-400 hover:text-white transition-all"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto space-y-6">
          {/* Metrics Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-xs">
            <div className="p-4 rounded-xl bg-slate-950/70 border border-slate-800 space-y-1">
              <span className="text-slate-400 font-medium">Total Requests</span>
              <div className="text-2xl font-bold text-white">{summary?.totalRequests || 0}</div>
            </div>
            <div className="p-4 rounded-xl bg-slate-950/70 border border-slate-800 space-y-1">
              <span className="text-slate-400 font-medium">Input Tokens</span>
              <div className="text-2xl font-bold text-indigo-400">
                {(summary?.totalInputTokens || 0).toLocaleString()}
              </div>
            </div>
            <div className="p-4 rounded-xl bg-slate-950/70 border border-slate-800 space-y-1">
              <span className="text-slate-400 font-medium">Output Tokens</span>
              <div className="text-2xl font-bold text-cyan-400">
                {(summary?.totalOutputTokens || 0).toLocaleString()}
              </div>
            </div>
            <div className="p-4 rounded-xl bg-slate-950/70 border border-slate-800 space-y-1">
              <span className="text-slate-400 font-medium">Estimated Cost</span>
              <div className="text-2xl font-bold text-emerald-400">
                {summary?.totalEstimatedCostFormatted || '$0.000000'}
              </div>
            </div>
          </div>

          {/* Pricing Table Notice */}
          <div className="p-3.5 rounded-xl bg-slate-950/40 border border-slate-800/80 text-[11px] text-slate-400 space-y-1 leading-relaxed">
            <div className="font-semibold text-slate-300">Configurable Model Pricing:</div>
            <p>
              • <span className="text-indigo-300 font-mono">Gemini 2.5 Flash</span>: $0.075 / 1M input tokens, $0.30 / 1M output tokens.
            </p>
            <p className="text-[10px] text-slate-500 italic pt-0.5">
              {summary?.disclaimer || 'Estimated cost based on published rates. Not an actual billing invoice.'}
            </p>
          </div>

          {/* Recent Generations Table */}
          <div className="space-y-3">
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-300">
              Recent Generation Requests ({recentRequests.length})
            </h4>

            {recentRequests.length === 0 ? (
              <div className="p-8 text-center text-xs text-slate-500 border border-slate-800 rounded-xl bg-slate-950/40">
                No AI generation requests recorded in this session yet. Select an endpoint and click "Generate AI Tests".
              </div>
            ) : (
              <div className="overflow-x-auto rounded-xl border border-slate-800 bg-slate-950/40">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="border-b border-slate-800 text-slate-400 font-semibold">
                      <th className="p-3">Timestamp</th>
                      <th className="p-3">Endpoint</th>
                      <th className="p-3">Model</th>
                      <th className="p-3">Tokens (In / Out)</th>
                      <th className="p-3">Duration</th>
                      <th className="p-3">Cost</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-850 font-mono text-[11px]">
                    {recentRequests.map((req) => (
                      <tr key={req.id} className="hover:bg-slate-900/40">
                        <td className="p-3 text-slate-400">{new Date(req.timestamp).toLocaleTimeString()}</td>
                        <td className="p-3 text-indigo-300 font-bold">{req.endpointId}</td>
                        <td className="p-3 text-slate-300">{req.model}</td>
                        <td className="p-3 text-slate-300">
                          {req.inputTokens} / {req.outputTokens}
                        </td>
                        <td className="p-3 text-slate-400">{req.durationMs}ms</td>
                        <td className="p-3 text-emerald-400 font-bold">{req.estimatedCostFormatted}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default AiUsageModal;
