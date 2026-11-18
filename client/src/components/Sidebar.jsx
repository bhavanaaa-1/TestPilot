import React from 'react';
import {
  LayoutDashboard,
  FileCode2,
  Cpu,
  FlaskConical,
  Bug,
  FileText,
  ChevronRight,
  ShieldCheck,
  Sparkles,
  Bot,
} from 'lucide-react';

export function Sidebar({ currentTab, setCurrentTab, specLoaded }) {
  const navItems = [
    {
      id: 'dashboard',
      label: 'Dashboard',
      icon: LayoutDashboard,
      phase: null,
    },
    {
      id: 'specs',
      label: 'OpenAPI Specs',
      icon: FileCode2,
      phase: 'Phase 2',
      highlight: false,
      activeDot: specLoaded,
    },
    {
      id: 'generator',
      label: 'LLM Test Generator',
      icon: Cpu,
      phase: 'Phase 3',
      highlight: false,
      activeDot: specLoaded,
    },
    {
      id: 'agent',
      label: 'AI Testing Agent',
      icon: Bot,
      phase: 'Phase 4',
      highlight: true,
      activeDot: specLoaded,
    },
    {
      id: 'sandbox',
      label: 'Sandbox Runner',
      icon: FlaskConical,
      phase: 'Phase 4',
    },
    {
      id: 'diagnostics',
      label: 'Failure Explainer',
      icon: Bug,
      phase: 'Phase 4',
    },
    {
      id: 'evaluations',
      label: 'LLM Evaluation Sets',
      icon: ShieldCheck,
      phase: 'Phase 5',
      highlight: true,
    },
  ];

  return (
    <aside className="w-64 border-r border-slate-800 bg-slate-900/40 p-4 flex flex-col justify-between hidden md:flex shrink-0">
      <div className="space-y-6">
        <div>
          <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 px-3">
            Core Navigation
          </span>
          <nav className="mt-2 space-y-1">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isSelected = currentTab === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => setCurrentTab(item.id)}
                  className={`w-full flex items-center justify-between px-3 py-2.5 rounded-lg text-sm font-medium transition-all ${
                    isSelected
                      ? 'bg-indigo-600/20 text-indigo-300 border border-indigo-500/30 shadow-sm'
                      : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/40'
                  }`}
                >
                  <div className="flex items-center space-x-3">
                    <div className="relative">
                      <Icon className={`h-4 w-4 ${isSelected ? 'text-indigo-400' : 'text-slate-400'}`} />
                      {item.activeDot && (
                        <span className="absolute -top-1 -right-1 h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
                      )}
                    </div>
                    <span>{item.label}</span>
                  </div>
                  {item.phase && (
                    <span
                      className={`text-[10px] font-semibold px-1.5 py-0.5 rounded border ${
                        item.highlight
                          ? 'bg-indigo-500/10 text-indigo-300 border-indigo-500/30'
                          : 'bg-slate-800 text-slate-500 border-slate-700/50'
                      }`}
                    >
                      {item.phase}
                    </span>
                  )}
                </button>
              );
            })}
          </nav>
        </div>

        <div>
          <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 px-3">
            Documentation
          </span>
          <nav className="mt-2 space-y-1">
            <button
              onClick={() => setCurrentTab('docs')}
              className={`w-full flex items-center justify-between px-3 py-2.5 rounded-lg text-sm font-medium transition-all ${
                currentTab === 'docs'
                  ? 'bg-indigo-600/20 text-indigo-300 border border-indigo-500/30'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/40'
              }`}
            >
              <div className="flex items-center space-x-3">
                <FileText className="h-4 w-4 text-slate-400" />
                <span>PRD & Design Docs</span>
              </div>
              <ChevronRight className="h-3.5 w-3.5 text-slate-500" />
            </button>
          </nav>
        </div>
      </div>

      {/* Evaluator Scope Card */}
      <div className="p-3.5 rounded-xl bg-slate-900/90 border border-slate-800 space-y-2">
        <div className="flex items-center space-x-2 text-xs font-semibold text-slate-200">
          <ShieldCheck className="h-4 w-4 text-emerald-400" />
          <span>Evaluation Status</span>
        </div>
        <p className="text-[11px] text-slate-400 leading-relaxed">
          Phase 5 Active. WebSockets real-time streaming, LLM evaluation benchmark sets, deterministic metric calculation, and PostgreSQL persistence are fully active.
        </p>
      </div>
    </aside>
  );
}

export default Sidebar;
