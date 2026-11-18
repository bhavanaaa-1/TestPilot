import React, { useState, useMemo } from 'react';
import { Search, Filter, Hash, SlidersHorizontal, CornerDownRight } from 'lucide-react';

const METHOD_STYLES = {
  GET: {
    badge: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30',
    dot: 'bg-emerald-400',
  },
  POST: {
    badge: 'bg-blue-500/15 text-blue-400 border-blue-500/30',
    dot: 'bg-blue-400',
  },
  PUT: {
    badge: 'bg-amber-500/15 text-amber-400 border-amber-500/30',
    dot: 'bg-amber-400',
  },
  PATCH: {
    badge: 'bg-purple-500/15 text-purple-400 border-purple-500/30',
    dot: 'bg-purple-400',
  },
  DELETE: {
    badge: 'bg-rose-500/15 text-rose-400 border-rose-500/30',
    dot: 'bg-rose-400',
  },
  DEFAULT: {
    badge: 'bg-slate-800 text-slate-300 border-slate-700',
    dot: 'bg-slate-400',
  },
};

export function EndpointList({ endpoints, selectedEndpointId, onSelectEndpoint }) {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedMethod, setSelectedMethod] = useState('ALL');

  const methodsList = ['ALL', 'GET', 'POST', 'PUT', 'PATCH', 'DELETE'];

  const filteredEndpoints = useMemo(() => {
    return (endpoints || []).filter((ep) => {
      // Method filter
      if (selectedMethod !== 'ALL' && ep.method !== selectedMethod) {
        return false;
      }
      // Search filter
      if (searchQuery.trim()) {
        const query = searchQuery.toLowerCase().trim();
        const pathMatch = ep.path.toLowerCase().includes(query);
        const summaryMatch = (ep.summary || '').toLowerCase().includes(query);
        const idMatch = ep.id.toLowerCase().includes(query);
        const tagMatch = (ep.tags || []).some((t) => t.toLowerCase().includes(query));
        return pathMatch || summaryMatch || idMatch || tagMatch;
      }
      return true;
    });
  }, [endpoints, selectedMethod, searchQuery]);

  // Render path with highlighted parameter segments
  const renderPath = (pathStr) => {
    const parts = pathStr.split(/({[^}]+})/g);
    return parts.map((part, idx) => {
      if (part.startsWith('{') && part.endsWith('}')) {
        return (
          <span key={idx} className="text-amber-400 font-semibold">
            {part}
          </span>
        );
      }
      return <span key={idx}>{part}</span>;
    });
  };

  return (
    <div className="flex flex-col h-full bg-slate-900/40 rounded-2xl border border-slate-800 overflow-hidden">
      {/* Search & Filter Header */}
      <div className="p-4 border-b border-slate-800 space-y-3 bg-slate-900/60">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <SlidersHorizontal className="h-4 w-4 text-indigo-400" />
            <span className="text-xs font-bold uppercase tracking-wider text-slate-300">
              Endpoints
            </span>
          </div>
          <span className="text-xs font-mono font-medium text-slate-400">
            {filteredEndpoints.length} of {endpoints?.length || 0}
          </span>
        </div>

        {/* Search Input */}
        <div className="relative">
          <Search className="h-4 w-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search path, summary, or tag..."
            className="w-full pl-9 pr-3 py-1.5 rounded-lg bg-slate-950 border border-slate-800 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-indigo-500/60 transition-colors"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 text-xs font-bold"
            >
              ×
            </button>
          )}
        </div>

        {/* Method Filter Pills */}
        <div className="flex items-center space-x-1 overflow-x-auto pb-1 scrollbar-none">
          {methodsList.map((method) => {
            const isSelected = selectedMethod === method;
            return (
              <button
                key={method}
                onClick={() => setSelectedMethod(method)}
                className={`px-2 py-0.5 rounded text-[11px] font-bold transition-all shrink-0 ${
                  isSelected
                    ? 'bg-indigo-600 text-white shadow-sm'
                    : 'bg-slate-800/80 hover:bg-slate-800 text-slate-400 hover:text-slate-200'
                }`}
              >
                {method}
              </button>
            );
          })}
        </div>
      </div>

      {/* Endpoint Items List */}
      <div className="flex-1 overflow-y-auto p-3 space-y-2">
        {filteredEndpoints.length === 0 ? (
          <div className="p-8 text-center text-xs text-slate-500 space-y-1">
            <p>No endpoints match your search criteria.</p>
            {searchQuery && (
              <button
                onClick={() => {
                  setSearchQuery('');
                  setSelectedMethod('ALL');
                }}
                className="text-indigo-400 hover:underline pt-1"
              >
                Clear filters
              </button>
            )}
          </div>
        ) : (
          filteredEndpoints.map((ep) => {
            const isSelected = selectedEndpointId === ep.id;
            const style = METHOD_STYLES[ep.method] || METHOD_STYLES.DEFAULT;

            return (
              <div
                key={ep.id}
                onClick={() => onSelectEndpoint(ep)}
                className={`p-3 rounded-xl border cursor-pointer transition-all ${
                  isSelected
                    ? 'bg-indigo-950/40 border-indigo-500/60 shadow-md shadow-indigo-950/50 ring-1 ring-indigo-500/40'
                    : 'bg-slate-950/40 hover:bg-slate-900/60 border-slate-800/80 hover:border-slate-700'
                }`}
              >
                <div className="flex items-center space-x-2.5">
                  <span
                    className={`px-2 py-0.5 rounded-md text-[10px] font-black tracking-wide border shrink-0 ${style.badge}`}
                  >
                    {ep.method}
                  </span>
                  <span className="font-mono text-xs text-slate-200 truncate flex-1 font-medium" title={ep.path}>
                    {renderPath(ep.path)}
                  </span>
                </div>

                {ep.summary && (
                  <p className="mt-1.5 text-xs text-slate-400 truncate pl-0.5">
                    {ep.summary}
                  </p>
                )}

                <div className="mt-2.5 flex items-center justify-between text-[10px] text-slate-500 pt-1.5 border-t border-slate-800/60">
                  <div className="flex items-center space-x-2">
                    {ep.parameters && ep.parameters.length > 0 && (
                      <span className="px-1.5 py-0.5 rounded bg-slate-800/60 text-slate-400">
                        {ep.parameters.length} {ep.parameters.length === 1 ? 'param' : 'params'}
                      </span>
                    )}
                    {ep.requestBody && (
                      <span className="px-1.5 py-0.5 rounded bg-blue-950/50 text-blue-300 border border-blue-900/40">
                        Body
                      </span>
                    )}
                  </div>

                  <span className="font-mono text-slate-500">
                    {Object.keys(ep.responses || {}).join(', ')}
                  </span>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}

export default EndpointList;
