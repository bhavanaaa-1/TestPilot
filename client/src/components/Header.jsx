import React, { useState } from 'react';
import { Activity, Radio, Sparkles, FileCode2, Cpu } from 'lucide-react';
import AiUsageModal from './AiUsageModal';

export function Header({ serverStatus, sandboxStatus, specInfo }) {
  const [isUsageOpen, setIsUsageOpen] = useState(false);

  return (
    <>
      <header className="h-16 border-b border-slate-800 bg-slate-900/70 backdrop-blur-md px-6 flex items-center justify-between sticky top-0 z-40">
        {/* Brand Identity */}
        <div className="flex items-center space-x-3">
          <div className="h-10 w-10 rounded-xl bg-gradient-to-tr from-indigo-600 via-indigo-500 to-cyan-400 p-0.5 shadow-lg shadow-indigo-500/20">
            <div className="h-full w-full bg-slate-950 rounded-[10px] flex items-center justify-center">
              <Radio className="h-5 w-5 text-indigo-400 animate-pulse" />
            </div>
          </div>
          <div>
            <div className="flex items-center space-x-2">
              <span className="font-extrabold text-lg tracking-tight bg-gradient-to-r from-white via-slate-200 to-indigo-300 bg-clip-text text-transparent">
                TestPilot
              </span>
              <span className="text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded-full bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
                Phase 3
              </span>
            </div>
            <p className="text-xs text-slate-400">AI-Powered API Testing Assistant</p>
          </div>
        </div>

        {/* Service Health Indicators & Active Spec Pill */}
        <div className="flex items-center space-x-3">
          {/* Active Spec Indicator */}
          {specInfo && (
            <div className="hidden lg:flex items-center space-x-2 px-3 py-1.5 rounded-lg bg-indigo-950/40 border border-indigo-800/40 text-xs">
              <FileCode2 className="h-3.5 w-3.5 text-indigo-400" />
              <span className="text-slate-400">Spec:</span>
              <span className="font-medium text-slate-200 truncate max-w-[140px]">{specInfo.title}</span>
              <span className="text-[10px] px-1.5 py-0.2 rounded bg-indigo-500/20 text-indigo-300 font-mono">
                {specInfo.version}
              </span>
            </div>
          )}

          {/* Backend Server Status */}
          <div className="hidden sm:flex items-center space-x-2 px-3 py-1.5 rounded-lg bg-slate-850 border border-slate-800 text-xs">
            <span className="text-slate-400">Backend :5000:</span>
            <span className="flex items-center space-x-1.5">
              <span
                className={`h-2 w-2 rounded-full ${
                  serverStatus === 'online'
                    ? 'bg-emerald-400 shadow-sm shadow-emerald-400/50'
                    : serverStatus === 'error'
                    ? 'bg-rose-400'
                    : 'bg-amber-400 animate-pulse'
                }`}
              />
              <span className="font-medium capitalize text-slate-200">{serverStatus}</span>
            </span>
          </div>

          {/* Sandbox API Status */}
          <div className="hidden sm:flex items-center space-x-2 px-3 py-1.5 rounded-lg bg-slate-850 border border-slate-800 text-xs">
            <span className="text-slate-400">Sandbox :4000:</span>
            <span className="flex items-center space-x-1.5">
              <span
                className={`h-2 w-2 rounded-full ${
                  sandboxStatus === 'online'
                    ? 'bg-emerald-400 shadow-sm shadow-emerald-400/50'
                    : sandboxStatus === 'error'
                    ? 'bg-rose-400'
                    : 'bg-amber-400 animate-pulse'
                }`}
              />
              <span className="font-medium capitalize text-slate-200">{sandboxStatus}</span>
            </span>
          </div>

          {/* AI Usage & Cost Button */}
          <button
            onClick={() => setIsUsageOpen(true)}
            className="flex items-center space-x-1.5 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 text-xs text-slate-200 font-medium transition-all"
            title="View AI Token Consumption & Estimated Cost"
          >
            <Cpu className="h-3.5 w-3.5 text-indigo-400" />
            <span className="hidden md:inline">AI Usage</span>
          </button>

          {/* Project Milestone Badge */}
          <div className="flex items-center space-x-1.5 px-3 py-1.5 rounded-lg bg-indigo-950/60 border border-indigo-800/40 text-xs text-indigo-300 font-medium">
            <Sparkles className="h-3.5 w-3.5 text-indigo-400" />
            <span>AI Test Generation</span>
          </div>
        </div>
      </header>

      {/* Usage Modal */}
      <AiUsageModal isOpen={isUsageOpen} onClose={() => setIsUsageOpen(false)} />
    </>
  );
}

export default Header;
