import React from 'react';
import {
  FileCode2,
  Server,
  Layers,
  CheckCircle2,
  UploadCloud,
  Trash2,
  Clock,
  HardDrive,
  Tag,
} from 'lucide-react';

export function SpecOverview({ spec, onReupload, onClear }) {
  if (!spec) return null;

  const { info, openapi, format, fileName, fileSize, stats, servers, uploadedAt } = spec;

  const formatFileSize = (bytes) => {
    if (!bytes) return '0 B';
    if (bytes < 1024) return `${bytes} B`;
    return `${(bytes / 1024).toFixed(1)} KB`;
  };

  const methodColors = {
    GET: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30',
    POST: 'bg-blue-500/15 text-blue-400 border-blue-500/30',
    PUT: 'bg-amber-500/15 text-amber-400 border-amber-500/30',
    PATCH: 'bg-purple-500/15 text-purple-400 border-purple-500/30',
    DELETE: 'bg-rose-500/15 text-rose-400 border-rose-500/30',
  };

  return (
    <div className="p-6 rounded-2xl bg-slate-900/60 border border-slate-800 space-y-6 shadow-sm">
      {/* Top Header Row */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-800/80 pb-5">
        <div className="space-y-1.5">
          <div className="flex flex-wrap items-center gap-2.5">
            <h2 className="text-xl font-bold text-white tracking-tight">{info.title}</h2>
            <span className="text-xs px-2 py-0.5 rounded-full bg-indigo-500/15 text-indigo-300 font-mono border border-indigo-500/30 font-semibold">
              v{info.version}
            </span>
            <span className="text-xs px-2 py-0.5 rounded-full bg-cyan-500/15 text-cyan-300 font-mono border border-cyan-500/30 font-semibold uppercase">
              OAS {openapi}
            </span>
            <span className="text-[11px] px-2 py-0.5 rounded-full bg-slate-800 text-slate-400 font-mono uppercase">
              {format}
            </span>
          </div>
          {info.description && (
            <p className="text-xs text-slate-400 max-w-3xl leading-relaxed">
              {info.description}
            </p>
          )}
        </div>

        {/* Action Buttons */}
        <div className="flex items-center space-x-2 shrink-0">
          <button
            onClick={onReupload}
            className="px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold transition-all flex items-center space-x-1.5 shadow-sm"
          >
            <UploadCloud className="h-3.5 w-3.5" />
            <span>Upload New Spec</span>
          </button>
          <button
            onClick={onClear}
            title="Clear specification from memory"
            className="p-1.5 rounded-lg bg-slate-800 hover:bg-rose-950/60 text-slate-400 hover:text-rose-400 border border-slate-700/60 transition-all"
          >
            <Trash2 className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Meta & Metrics Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-xs">
        <div className="p-3.5 rounded-xl bg-slate-950/60 border border-slate-800/80 space-y-1">
          <span className="text-slate-500 font-medium">Total Endpoints</span>
          <div className="text-xl font-bold text-slate-100">{stats.totalEndpoints}</div>
        </div>

        <div className="p-3.5 rounded-xl bg-slate-950/60 border border-slate-800/80 space-y-1">
          <span className="text-slate-500 font-medium">Distinct Paths</span>
          <div className="text-xl font-bold text-slate-100">{stats.totalPaths}</div>
        </div>

        <div className="p-3.5 rounded-xl bg-slate-950/60 border border-slate-800/80 space-y-1">
          <span className="text-slate-500 font-medium">File Name</span>
          <div className="text-xs font-mono font-medium text-slate-200 truncate" title={fileName}>
            {fileName}
          </div>
          <span className="text-[10px] text-slate-500 font-mono">{formatFileSize(fileSize)}</span>
        </div>

        <div className="p-3.5 rounded-xl bg-slate-950/60 border border-slate-800/80 space-y-1">
          <span className="text-slate-500 font-medium">Target Server</span>
          <div className="text-xs font-mono text-cyan-400 truncate" title={servers[0]?.url || 'Relative'}>
            {servers[0]?.url || 'Relative URL'}
          </div>
          <span className="text-[10px] text-slate-500 truncate">{servers[0]?.description || 'API host'}</span>
        </div>
      </div>

      {/* HTTP Method Distribution Badges */}
      <div className="flex flex-wrap items-center gap-2 pt-1">
        <span className="text-xs font-semibold text-slate-400 mr-2">Method Breakdown:</span>
        {Object.entries(stats.methods || {})
          .filter(([, count]) => count > 0)
          .map(([method, count]) => (
            <span
              key={method}
              className={`px-2.5 py-1 rounded-lg text-xs font-bold border flex items-center space-x-1.5 ${
                methodColors[method] || 'bg-slate-800 text-slate-300 border-slate-700'
              }`}
            >
              <span>{method}</span>
              <span className="px-1.5 py-0.2 rounded-full bg-slate-950/60 text-[10px]">
                {count}
              </span>
            </span>
          ))}

        {stats.tags && stats.tags.length > 0 && (
          <div className="flex items-center space-x-1 ml-auto text-xs text-slate-400">
            <Tag className="h-3.5 w-3.5 text-slate-500" />
            <span>Tags: {stats.tags.join(', ')}</span>
          </div>
        )}
      </div>
    </div>
  );
}

export default SpecOverview;
