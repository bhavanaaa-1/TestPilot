import React from 'react';

export function StatusCard({ title, value, status, icon: Icon, description, badge }) {
  const statusColors = {
    online: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20',
    pending: 'text-amber-400 bg-amber-500/10 border-amber-500/20',
    planned: 'text-indigo-400 bg-indigo-500/10 border-indigo-500/20',
    error: 'text-rose-400 bg-rose-500/10 border-rose-500/20',
  };

  return (
    <div className="p-5 rounded-xl bg-slate-900/60 border border-slate-800 hover:border-slate-700/80 transition-all shadow-sm">
      <div className="flex items-start justify-between">
        <div className="space-y-1">
          <span className="text-xs font-medium text-slate-400">{title}</span>
          <div className="text-xl font-bold text-slate-100">{value}</div>
        </div>
        {Icon && (
          <div className="p-2.5 rounded-lg bg-slate-800/80 border border-slate-700/50 text-indigo-400">
            <Icon className="h-5 w-5" />
          </div>
        )}
      </div>

      <div className="mt-4 flex items-center justify-between text-xs">
        <span className="text-slate-400">{description}</span>
        {badge && (
          <span
            className={`px-2 py-0.5 rounded-md font-semibold text-[10px] border ${
              statusColors[status] || statusColors.planned
            }`}
          >
            {badge}
          </span>
        )}
      </div>
    </div>
  );
}

export default StatusCard;
