import React, { useState, useEffect } from 'react';
import {
  FileCode2,
  Copy,
  Check,
  Tag,
  AlertTriangle,
  Info,
  CornerDownRight,
  Database,
  ArrowRight,
  Layers,
  Sparkles,
  Bot,
} from 'lucide-react';
import AiTestGenerator from './AiTestGenerator';
import AiAgentInvestigation from './AiAgentInvestigation';

const METHOD_STYLES = {
  GET: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30',
  POST: 'bg-blue-500/15 text-blue-400 border-blue-500/30',
  PUT: 'bg-amber-500/15 text-amber-400 border-amber-500/30',
  PATCH: 'bg-purple-500/15 text-purple-400 border-purple-500/30',
  DELETE: 'bg-rose-500/15 text-rose-400 border-rose-500/30',
  DEFAULT: 'bg-slate-800 text-slate-300 border-slate-700',
};

export function EndpointDetail({ endpoint, initialViewTab = 'spec' }) {
  const [activeViewTab, setActiveViewTab] = useState(initialViewTab); // 'spec' | 'ai'
  const [activeResponseTab, setActiveResponseTab] = useState(null);
  const [copiedCode, setCopiedCode] = useState(false);

  useEffect(() => {
    if (initialViewTab) {
      setActiveViewTab(initialViewTab);
    }
  }, [initialViewTab]);

  if (!endpoint) {
    return (
      <div className="h-full flex items-center justify-center p-8 bg-slate-900/30 rounded-2xl border border-slate-800 text-center">
        <div className="space-y-3 max-w-sm">
          <div className="mx-auto w-12 h-12 rounded-xl bg-slate-800/80 border border-slate-700/60 flex items-center justify-center text-slate-400">
            <Layers className="h-6 w-6" />
          </div>
          <h3 className="text-sm font-semibold text-slate-300">No Endpoint Selected</h3>
          <p className="text-xs text-slate-500 leading-relaxed">
            Select an endpoint from the left list to view its request parameters, payload schema, and response contracts or generate AI tests.
          </p>
        </div>
      </div>
    );
  }

  const { method, path, summary, description, operationId, tags, parameters, requestBody, responses, deprecated } = endpoint;
  const methodStyle = METHOD_STYLES[method] || METHOD_STYLES.DEFAULT;

  const responseCodes = Object.keys(responses || {});
  const currentResponseCode = activeResponseTab || responseCodes[0] || null;
  const currentResponse = currentResponseCode ? responses[currentResponseCode] : null;

  const handleCopy = (text) => {
    navigator.clipboard.writeText(text);
    setCopiedCode(true);
    setTimeout(() => setCopiedCode(false), 2000);
  };

  const getStatusColor = (code) => {
    if (code.startsWith('2')) return 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30';
    if (code.startsWith('4')) return 'bg-amber-500/15 text-amber-400 border-amber-500/30';
    if (code.startsWith('5')) return 'bg-rose-500/15 text-rose-400 border-rose-500/30';
    return 'bg-slate-800 text-slate-300 border-slate-700';
  };

  // Helper to render schema properties
  const renderSchemaProperties = (schema) => {
    if (!schema) return <span className="text-slate-500 text-xs italic">No schema defined</span>;

    if (schema.type === 'array') {
      return (
        <div className="space-y-2">
          <div className="text-xs text-slate-400 font-mono">
            Array &lt;{schema.items?.type || schema.items?.$ref?.split('/').pop() || 'object'}&gt;
          </div>
          {schema.items?.properties && renderSchemaProperties(schema.items)}
        </div>
      );
    }

    if (schema.properties) {
      const requiredFields = new Set(schema.required || []);
      return (
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-slate-800/80 text-slate-400 font-semibold">
                <th className="pb-2">Field</th>
                <th className="pb-2">Type</th>
                <th className="pb-2">Required</th>
                <th className="pb-2">Description</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-850/60 font-mono">
              {Object.entries(schema.properties).map(([field, prop]) => (
                <tr key={field} className="hover:bg-slate-800/20">
                  <td className="py-2.5 text-indigo-300 font-medium">{field}</td>
                  <td className="py-2.5 text-slate-400">
                    {prop.type || (prop.$ref ? prop.$ref.split('/').pop() : 'any')}
                    {prop.format ? ` (${prop.format})` : ''}
                  </td>
                  <td className="py-2.5">
                    {requiredFields.has(field) ? (
                      <span className="px-1.5 py-0.5 rounded bg-rose-500/10 text-rose-400 text-[10px] font-sans font-bold border border-rose-500/20">
                        Required
                      </span>
                    ) : (
                      <span className="text-slate-500 text-[10px] font-sans">Optional</span>
                    )}
                  </td>
                  <td className="py-2.5 text-slate-400 font-sans text-xs">
                    {prop.description || (prop.enum ? `Enum: [${prop.enum.join(', ')}]` : '-')}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      );
    }

    return (
      <pre className="text-xs font-mono text-slate-300 p-3 bg-slate-950 rounded-lg overflow-x-auto border border-slate-800">
        {JSON.stringify(schema, null, 2)}
      </pre>
    );
  };

  return (
    <div className="h-full bg-slate-900/40 rounded-2xl border border-slate-800 overflow-y-auto p-6 space-y-6">
      {/* Top Header Card */}
      <div className="space-y-3 border-b border-slate-800/80 pb-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-3">
            <span className={`px-2.5 py-1 rounded-lg text-xs font-black tracking-wide border ${methodStyle}`}>
              {method}
            </span>
            <span className="font-mono text-sm sm:text-base text-slate-100 font-bold tracking-tight">
              {path}
            </span>
            {deprecated && (
              <span className="px-2 py-0.5 rounded-full bg-amber-500/15 text-amber-400 text-[10px] font-bold border border-amber-500/30 flex items-center space-x-1">
                <AlertTriangle className="h-3 w-3" />
                <span>Deprecated</span>
              </span>
            )}
          </div>

          {/* Mode Switch Tabs (Spec vs AI Generation vs AI Agent Investigation) */}
          <div className="flex items-center space-x-1 p-1 rounded-xl bg-slate-950/80 border border-slate-800">
            <button
              onClick={() => setActiveViewTab('spec')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                activeViewTab === 'spec'
                  ? 'bg-slate-800 text-white shadow-sm'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Contract Schema
            </button>
            <button
              onClick={() => setActiveViewTab('ai')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all flex items-center space-x-1.5 ${
                activeViewTab === 'ai'
                  ? 'bg-indigo-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-indigo-300'
              }`}
            >
              <Sparkles className="h-3.5 w-3.5 text-indigo-400" />
              <span>AI Generator</span>
            </button>
            <button
              onClick={() => setActiveViewTab('agent')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center space-x-1.5 ${
                activeViewTab === 'agent'
                  ? 'bg-gradient-to-r from-cyan-600 to-indigo-600 text-white shadow-md shadow-cyan-600/20'
                  : 'text-cyan-400 hover:text-cyan-300'
              }`}
            >
              <Bot className="h-3.5 w-3.5" />
              <span>AI Investigation Agent</span>
            </button>
          </div>
        </div>

        {summary && (
          <h3 className="text-base font-semibold text-slate-200">
            {summary}
          </h3>
        )}

        {description && (
          <p className="text-xs text-slate-400 leading-relaxed">
            {description}
          </p>
        )}

        <div className="flex flex-wrap items-center gap-2 pt-1 text-xs">
          {operationId && (
            <span className="px-2 py-0.5 rounded bg-slate-800/80 text-slate-400 font-mono text-[11px] border border-slate-700/50">
              id: <span className="text-slate-300">{operationId}</span>
            </span>
          )}
          {tags && tags.length > 0 && (
            <div className="flex items-center space-x-1">
              {tags.map((tag) => (
                <span
                  key={tag}
                  className="px-2 py-0.5 rounded-full bg-indigo-500/10 text-indigo-300 text-[10px] border border-indigo-500/20"
                >
                  #{tag}
                </span>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* VIEW A: AI AGENT INVESTIGATION */}
      {activeViewTab === 'agent' ? (
        <AiAgentInvestigation endpoint={endpoint} />
      ) : activeViewTab === 'ai' ? (
        /* VIEW B: AI TEST GENERATOR */
        <AiTestGenerator endpoint={endpoint} />
      ) : (
        /* VIEW C: CONTRACT SPECIFICATION */
        <div className="space-y-6">
          {/* Section 1: Parameters */}
          <div className="space-y-3">
            <div className="flex items-center space-x-2">
              <Tag className="h-4 w-4 text-indigo-400" />
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-300">
                Request Parameters ({parameters?.length || 0})
              </h4>
            </div>

            {parameters && parameters.length > 0 ? (
              <div className="overflow-x-auto rounded-xl border border-slate-800 bg-slate-950/40 p-3">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="border-b border-slate-800 text-slate-400 font-semibold">
                      <th className="pb-2">Name</th>
                      <th className="pb-2">In</th>
                      <th className="pb-2">Type</th>
                      <th className="pb-2">Requirement</th>
                      <th className="pb-2">Description</th>
                      <th className="pb-2">Example</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-850 font-mono">
                    {parameters.map((param, idx) => (
                      <tr key={idx} className="hover:bg-slate-900/40">
                        <td className="py-2.5 text-indigo-300 font-semibold">{param.name}</td>
                        <td className="py-2.5">
                          <span className="px-1.5 py-0.5 rounded bg-slate-800 text-[10px] text-slate-300 uppercase">
                            {param.in}
                          </span>
                        </td>
                        <td className="py-2.5 text-slate-400">{param.schema?.type || 'string'}</td>
                        <td className="py-2.5">
                          {param.required ? (
                            <span className="px-1.5 py-0.5 rounded bg-rose-500/10 text-rose-400 text-[10px] font-sans font-bold border border-rose-500/20">
                              Required
                            </span>
                          ) : (
                            <span className="text-slate-500 text-[10px] font-sans">Optional</span>
                          )}
                        </td>
                        <td className="py-2.5 text-slate-400 font-sans text-xs">
                          {param.description || '-'}
                        </td>
                        <td className="py-2.5 text-amber-400 text-xs">
                          {param.example !== undefined ? String(param.example) : '-'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="p-3.5 rounded-xl bg-slate-950/40 border border-slate-800/80 text-xs text-slate-500 italic">
                This endpoint does not require any URL path, query, or header parameters.
              </div>
            )}
          </div>

          {/* Section 2: Request Body */}
          {requestBody && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <Database className="h-4 w-4 text-cyan-400" />
                  <h4 className="text-xs font-bold uppercase tracking-wider text-slate-300">
                    Request Body
                  </h4>
                  {requestBody.required && (
                    <span className="px-1.5 py-0.5 rounded bg-rose-500/10 text-rose-400 text-[10px] font-bold border border-rose-500/20">
                      Required
                    </span>
                  )}
                </div>
                <span className="text-xs font-mono text-slate-400">
                  {Object.keys(requestBody.content || {}).join(', ')}
                </span>
              </div>

              {requestBody.description && (
                <p className="text-xs text-slate-400">{requestBody.description}</p>
              )}

              <div className="p-4 rounded-xl border border-slate-800 bg-slate-950/40 space-y-4">
                {Object.entries(requestBody.content || {}).map(([contentType, mediaObj]) => (
                  <div key={contentType} className="space-y-3">
                    <div className="text-xs font-bold text-slate-300">
                      Schema ({contentType})
                    </div>
                    {renderSchemaProperties(mediaObj.schema)}

                    {mediaObj.example && (
                      <div className="space-y-1.5 pt-2 border-t border-slate-850">
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-semibold text-slate-400">Example Payload:</span>
                          <button
                            onClick={() => handleCopy(JSON.stringify(mediaObj.example, null, 2))}
                            className="text-[11px] text-indigo-400 hover:text-indigo-300 flex items-center space-x-1"
                          >
                            {copiedCode ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
                            <span>{copiedCode ? 'Copied' : 'Copy'}</span>
                          </button>
                        </div>
                        <pre className="text-xs font-mono text-slate-200 p-3 bg-slate-950 rounded-lg overflow-x-auto border border-slate-800">
                          {JSON.stringify(mediaObj.example, null, 2)}
                        </pre>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Section 3: Responses */}
          <div className="space-y-3">
            <div className="flex items-center space-x-2">
              <FileCode2 className="h-4 w-4 text-emerald-400" />
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-300">
                Responses ({responseCodes.length})
              </h4>
            </div>

            {/* Response Tabs */}
            <div className="flex items-center space-x-2 border-b border-slate-800 pb-2 overflow-x-auto">
              {responseCodes.map((code) => {
                const isSelected = code === currentResponseCode;
                const statusStyle = getStatusColor(code);

                return (
                  <button
                    key={code}
                    onClick={() => setActiveResponseTab(code)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center space-x-2 border ${
                      isSelected
                        ? `${statusStyle} shadow-sm ring-1 ring-indigo-500/30`
                        : 'bg-slate-950/60 text-slate-400 hover:text-slate-200 border-slate-800'
                    }`}
                  >
                    <span>{code}</span>
                    <span className="text-[10px] font-normal text-slate-400 truncate max-w-[120px]">
                      {responses[code]?.description || ''}
                    </span>
                  </button>
                );
              })}
            </div>

            {/* Selected Response Detail */}
            {currentResponse && (
              <div className="p-4 rounded-xl border border-slate-800 bg-slate-950/40 space-y-4 animate-fadeIn">
                <div>
                  <span className="text-xs font-semibold text-slate-300">Description: </span>
                  <span className="text-xs text-slate-400">{currentResponse.description || 'No description provided.'}</span>
                </div>

                {/* Response Content Types */}
                {currentResponse.content && Object.keys(currentResponse.content).length > 0 ? (
                  Object.entries(currentResponse.content).map(([contentType, mediaObj]) => (
                    <div key={contentType} className="space-y-3 pt-2">
                      <div className="text-xs font-bold text-slate-300">
                        Content-Type: <span className="font-mono text-cyan-400">{contentType}</span>
                      </div>

                      {renderSchemaProperties(mediaObj.schema)}

                      {mediaObj.example && (
                        <div className="space-y-1.5 pt-2 border-t border-slate-850">
                          <div className="flex items-center justify-between">
                            <span className="text-xs font-semibold text-slate-400">Example Response:</span>
                            <button
                              onClick={() => handleCopy(JSON.stringify(mediaObj.example, null, 2))}
                              className="text-[11px] text-indigo-400 hover:text-indigo-300 flex items-center space-x-1"
                            >
                              {copiedCode ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
                              <span>{copiedCode ? 'Copied' : 'Copy'}</span>
                            </button>
                          </div>
                          <pre className="text-xs font-mono text-slate-200 p-3 bg-slate-950 rounded-lg overflow-x-auto border border-slate-800">
                            {JSON.stringify(mediaObj.example, null, 2)}
                          </pre>
                        </div>
                      )}
                    </div>
                  ))
                ) : (
                  <div className="text-xs text-slate-500 italic">No response body defined for status {currentResponseCode}.</div>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export default EndpointDetail;
