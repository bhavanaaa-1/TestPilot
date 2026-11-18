import React, { useState } from 'react';
import {
  UploadCloud,
  FileCode,
  Terminal,
  Activity,
  CheckCircle2,
  ExternalLink,
  Layers,
  ArrowRight,
  Server,
  Database,
  Cpu,
  RefreshCw,
  Sparkles,
  Check,
  FileCode2,
} from 'lucide-react';
import StatusCard from './StatusCard';
import SpecWorkspace from './SpecWorkspace';
import SpecUploader from './SpecUploader';
import EvaluationDashboard from './EvaluationDashboard';

export function Workspace({ currentTab, setCurrentTab, spec, onSpecUpdated }) {
  // Live verification state (Phase 1 retained)
  const [testResult, setTestResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [activeTest, setActiveTest] = useState(null);

  const runLiveTest = async (type) => {
    setLoading(true);
    setActiveTest(type);
    const start = performance.now();

    try {
      let url = '';
      if (type === 'health') {
        url = 'http://localhost:5000/health';
      } else if (type === 'sandbox-users') {
        url = 'http://localhost:4000/users';
      } else if (type === 'sandbox-user-1') {
        url = 'http://localhost:4000/users/1';
      } else if (type === 'spec-current') {
        url = 'http://localhost:5000/api/specs/current';
      }

      const res = await fetch(url);
      const data = await res.json();
      const duration = Math.round(performance.now() - start);

      setTestResult({
        type,
        url,
        status: res.status,
        statusText: res.statusText,
        ok: res.ok,
        duration,
        data,
      });
    } catch (err) {
      setTestResult({
        type,
        status: 0,
        statusText: 'Connection Failed',
        ok: false,
        duration: 0,
        error: err.message,
      });
    } finally {
      setLoading(false);
    }
  };

  // If user selected OpenAPI Specs, Generator, Agent, Sandbox, or Diagnostics
  if (['specs', 'generator', 'agent', 'sandbox', 'diagnostics'].includes(currentTab)) {
    const initialViewTab = ['agent', 'sandbox', 'diagnostics'].includes(currentTab)
      ? 'agent'
      : currentTab === 'generator'
      ? 'ai'
      : 'spec';

    return (
      <SpecWorkspace
        spec={spec}
        onSpecUpdated={onSpecUpdated}
        initialViewTab={initialViewTab}
      />
    );
  }

  // If user selected Evaluation Sets tab
  if (currentTab === 'evaluations') {
    return <EvaluationDashboard />;
  }

  // If user selected Documentation tab
  if (currentTab === 'docs') {
    return (
      <div className="p-8 max-w-5xl mx-auto space-y-8">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-white">Project Documentation</h2>
          <p className="text-sm text-slate-400 mt-1">
            Complete technical specifications for the TestPilot Project Assessor evaluation.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          <div className="p-5 rounded-xl bg-slate-900/80 border border-slate-800 space-y-3">
            <div className="h-9 w-9 rounded-lg bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400">
              <FileCode className="h-5 w-5" />
            </div>
            <h3 className="text-base font-semibold text-slate-200">PRD.md</h3>
            <p className="text-xs text-slate-400 leading-relaxed">
              Product Requirements Document detailing problem statement, user personas, phased delivery roadmap, and acceptance criteria.
            </p>
            <div className="text-xs font-mono text-indigo-400">docs/PRD.md</div>
          </div>

          <div className="p-5 rounded-xl bg-slate-900/80 border border-slate-800 space-y-3">
            <div className="h-9 w-9 rounded-lg bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center text-cyan-400">
              <Layers className="h-5 w-5" />
            </div>
            <h3 className="text-base font-semibold text-slate-200">HLD.md</h3>
            <p className="text-xs text-slate-400 leading-relaxed">
              High-Level Design document specifying system architecture, data flow diagrams, sandbox isolation boundaries, and AI integrations.
            </p>
            <div className="text-xs font-mono text-cyan-400">docs/HLD.md</div>
          </div>

          <div className="p-5 rounded-xl bg-slate-900/80 border border-slate-800 space-y-3">
            <div className="h-9 w-9 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400">
              <Terminal className="h-5 w-5" />
            </div>
            <h3 className="text-base font-semibold text-slate-200">LLD.md</h3>
            <p className="text-xs text-slate-400 leading-relaxed">
              Low-Level Design describing Express modules, error-handling pipelines, REST schema validation, and in-memory data models.
            </p>
            <div className="text-xs font-mono text-emerald-400">docs/LLD.md</div>
          </div>
        </div>

        <div className="p-6 rounded-xl bg-slate-900/50 border border-slate-800 space-y-4">
          <h3 className="text-base font-semibold text-slate-200">Phase Delivery Scope vs Roadmap</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
            <div className="p-4 rounded-lg bg-emerald-950/20 border border-emerald-800/30 space-y-2">
              <div className="font-semibold text-emerald-400 flex items-center space-x-1.5">
                <CheckCircle2 className="h-4 w-4" />
                <span>Phase 1 (Complete)</span>
              </div>
              <ul className="text-slate-300 space-y-1 list-disc list-inside">
                <li>React + Vite + Tailwind frontend</li>
                <li>Express backend &amp; /health check</li>
                <li>Dedicated Sandbox API (:4000)</li>
                <li>CRUD /users endpoints with validation</li>
                <li>PRD, HLD, LLD documentation</li>
              </ul>
            </div>

            <div className="p-4 rounded-lg bg-indigo-950/20 border border-indigo-800/30 space-y-2">
              <div className="font-semibold text-indigo-400 flex items-center space-x-1.5">
                <CheckCircle2 className="h-4 w-4" />
                <span>Phase 2 (Complete)</span>
              </div>
              <ul className="text-slate-300 space-y-1 list-disc list-inside">
                <li>OpenAPI 3.0 &amp; 3.1 Parser &amp; Validator</li>
                <li>JSON &amp; YAML file upload (Multer, 2 MB)</li>
                <li>Offline validation &amp; external $ref rejection</li>
                <li>Endpoint extraction &amp; stable IDs</li>
                <li>Interactive Endpoint details workspace</li>
                <li>Sample Sandbox API OpenAPI specification</li>
              </ul>
            </div>

            <div className="p-4 rounded-lg bg-indigo-950/20 border border-indigo-800/30 space-y-2">
              <div className="font-semibold text-indigo-400 flex items-center space-x-1.5">
                <CheckCircle2 className="h-4 w-4" />
                <span>Phase 3 (Complete)</span>
              </div>
              <ul className="text-slate-300 space-y-1 list-disc list-inside">
                <li>Google Gemini API integration (@google/genai)</li>
                <li>Strict Zod schema validation for test cases</li>
                <li>Gemini Function Calling (3 sandboxed tools)</li>
                <li>Prompt injection defense &amp; XML data boundary</li>
                <li>In-memory token &amp; cost tracking (GET /api/ai/usage)</li>
                <li>Test generation UI with category filters</li>
              </ul>
            </div>

            <div className="p-4 rounded-lg bg-cyan-950/20 border border-cyan-800/30 space-y-2">
              <div className="font-semibold text-cyan-400 flex items-center space-x-1.5">
                <CheckCircle2 className="h-4 w-4" />
                <span>Phase 4 (Complete)</span>
              </div>
              <ul className="text-slate-300 space-y-1 list-disc list-inside">
                <li>PostgreSQL + pgvector persistent database</li>
                <li>RAG retrieval pipeline (chunker &amp; embeddings)</li>
                <li>Multi-step autonomous testing agent orchestrator</li>
                <li>Sandbox API test runner with security bounds</li>
                <li>AI failure diagnosis &amp; root cause explainer</li>
                <li>Agent execution trace timeline UI</li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // View: Main Dashboard
  return (
    <div className="p-8 max-w-7xl mx-auto space-y-8">
      {/* Overview Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatusCard
          title="Core Backend"
          value="Port 5000"
          status="online"
          icon={Server}
          description="GET /health active"
          badge="Healthy"
        />
        <StatusCard
          title="Sandbox API"
          value="Port 4000"
          status="online"
          icon={Database}
          description="4 REST Endpoints"
          badge="In-Memory"
        />
        <StatusCard
          title="Vector Store / RAG"
          value="pgvector"
          status="online"
          icon={Layers}
          description="OAS Chunks & Embeddings"
          badge="Active"
        />
        <StatusCard
          title="AI Testing Agent"
          value="Autonomous"
          status="online"
          icon={Cpu}
          description="Multi-Step Orchestrator"
          badge="Phase 4"
        />
      </div>

      {/* OpenAPI Specification & AI Test Generation Quick Action / Status Area */}
      <div className="border border-slate-800 rounded-2xl bg-slate-900/40 p-6 sm:p-8 relative overflow-hidden">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-2 max-w-xl">
            <div className="flex items-center space-x-2">
              <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
                Phase 3 Active
              </span>
              <span className="text-xs text-slate-400">Gemini AI Test Generation &amp; OAS Processing</span>
            </div>
            <h2 className="text-xl font-bold text-white tracking-tight">
              {spec ? `Active Spec: ${spec.info.title} (${spec.stats.totalEndpoints} Endpoints)` : 'OpenAPI Processing & AI Test Generation'}
            </h2>
            <p className="text-xs text-slate-400 leading-relaxed">
              {spec
                ? `Loaded ${spec.fileName} (${spec.format.toUpperCase()}). You can inspect request parameters and generate positive, negative, and edge-case tests with Gemini 2.5 Flash.`
                : 'Upload an OpenAPI 3.0 or 3.1 specification (JSON or YAML) to inspect endpoints or load the built-in Sandbox API specification.'}
            </p>
          </div>

          <div className="flex items-center space-x-3 shrink-0">
            {spec ? (
              <div className="flex items-center space-x-2">
                <button
                  onClick={() => setCurrentTab('specs')}
                  className="px-3.5 py-2.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold transition-all border border-slate-700 flex items-center space-x-1.5"
                >
                  <FileCode2 className="h-4 w-4 text-indigo-400" />
                  <span>Inspect Spec</span>
                </button>
                <button
                  onClick={() => setCurrentTab('generator')}
                  className="px-4 py-2.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold transition-all shadow-md shadow-indigo-600/20 flex items-center space-x-2"
                >
                  <Sparkles className="h-4 w-4" />
                  <span>Generate AI Tests</span>
                </button>
              </div>
            ) : (
              <button
                onClick={() => setCurrentTab('specs')}
                className="px-4 py-2.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold transition-all shadow-md shadow-indigo-600/20 flex items-center space-x-2"
              >
                <UploadCloud className="h-4 w-4" />
                <span>Open Spec Workspace</span>
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Phase 1 Live Endpoint Verification Console */}
      <div className="border border-slate-800 rounded-2xl bg-slate-900/60 p-6 space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h3 className="text-lg font-semibold text-white flex items-center space-x-2">
              <Terminal className="h-5 w-5 text-indigo-400" />
              <span>Service Verification Console</span>
            </h3>
            <p className="text-xs text-slate-400 mt-1">
              Trigger live HTTP calls directly from this browser dashboard to verify the Backend Server, Sandbox API, and Spec status.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={() => runLiveTest('health')}
              disabled={loading}
              className="px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-medium transition-all shadow-sm flex items-center space-x-1.5 disabled:opacity-50"
            >
              {loading && activeTest === 'health' ? (
                <RefreshCw className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Server className="h-3.5 w-3.5" />
              )}
              <span>GET :5000/health</span>
            </button>

            <button
              onClick={() => runLiveTest('spec-current')}
              disabled={loading}
              className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium transition-all border border-slate-700 flex items-center space-x-1.5 disabled:opacity-50"
            >
              {loading && activeTest === 'spec-current' ? (
                <RefreshCw className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <FileCode2 className="h-3.5 w-3.5 text-indigo-400" />
              )}
              <span>GET /api/specs/current</span>
            </button>

            <button
              onClick={() => runLiveTest('sandbox-users')}
              disabled={loading}
              className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium transition-all border border-slate-700 flex items-center space-x-1.5 disabled:opacity-50"
            >
              {loading && activeTest === 'sandbox-users' ? (
                <RefreshCw className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Database className="h-3.5 w-3.5 text-cyan-400" />
              )}
              <span>GET :4000/users</span>
            </button>

            <button
              onClick={() => runLiveTest('sandbox-user-1')}
              disabled={loading}
              className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium transition-all border border-slate-700 flex items-center space-x-1.5 disabled:opacity-50"
            >
              <span>GET :4000/users/1</span>
            </button>
          </div>
        </div>

        {/* Live Response Output Viewer */}
        {testResult ? (
          <div className="rounded-xl bg-slate-950 border border-slate-800 p-4 font-mono text-xs space-y-3">
            <div className="flex items-center justify-between border-b border-slate-800/80 pb-2">
              <div className="flex items-center space-x-3">
                <span
                  className={`px-2 py-0.5 rounded font-bold ${
                    testResult.ok
                      ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                      : 'bg-rose-500/20 text-rose-400 border border-rose-500/30'
                  }`}
                >
                  HTTP {testResult.status} {testResult.statusText}
                </span>
                <span className="text-slate-400">{testResult.url}</span>
              </div>
              <span className="text-slate-500">{testResult.duration} ms</span>
            </div>

            <pre className="text-slate-300 overflow-x-auto p-2 bg-slate-900/50 rounded-lg">
              {JSON.stringify(testResult.data || { error: testResult.error }, null, 2)}
            </pre>
          </div>
        ) : (
          <div className="p-4 rounded-xl bg-slate-950/60 border border-slate-800/60 text-center text-xs text-slate-500">
            Click any test button above to verify live API responses and status codes in real-time.
          </div>
        )}
      </div>
    </div>
  );
}

export default Workspace;
