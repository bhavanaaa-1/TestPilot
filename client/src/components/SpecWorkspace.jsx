import React, { useState, useEffect } from 'react';
import SpecUploader from './SpecUploader';
import SpecOverview from './SpecOverview';
import EndpointList from './EndpointList';
import EndpointDetail from './EndpointDetail';
import { Layers, ArrowLeft, Loader2 } from 'lucide-react';

export function SpecWorkspace({ spec, onSpecUpdated, initialViewTab = 'spec' }) {
  const [loading, setLoading] = useState(false);
  const [showUploader, setShowUploader] = useState(false);
  const [selectedEndpointId, setSelectedEndpointId] = useState(null);

  // When spec changes, select first endpoint automatically
  useEffect(() => {
    if (spec && Array.isArray(spec.endpoints) && spec.endpoints.length > 0) {
      if (!selectedEndpointId || !spec.endpoints.some((e) => e.id === selectedEndpointId)) {
        setSelectedEndpointId(spec.endpoints[0].id);
      }
    } else {
      setSelectedEndpointId(null);
    }
  }, [spec]);

  const handleSpecLoaded = (newSpec) => {
    if (onSpecUpdated) {
      onSpecUpdated(newSpec);
    }
    setShowUploader(false);
  };

  const handleClearSpec = async () => {
    try {
      await fetch('http://localhost:5000/api/specs/current', { method: 'DELETE' });
    } catch {
      // Ignored
    }
    if (onSpecUpdated) {
      onSpecUpdated(null);
    }
    setSelectedEndpointId(null);
  };

  const selectedEndpoint = spec?.endpoints?.find((e) => e.id === selectedEndpointId) || null;

  // View 1: No Spec Loaded OR Explicitly requested Uploader
  if (!spec || showUploader) {
    return (
      <div className="p-6 max-w-5xl mx-auto space-y-6">
        {spec && (
          <button
            onClick={() => setShowUploader(false)}
            className="text-xs text-indigo-400 hover:text-indigo-300 flex items-center space-x-1.5 font-medium mb-2"
          >
            <ArrowLeft className="h-4 w-4" />
            <span>Return to active specification ({spec.info.title})</span>
          </button>
        )}

        <div>
          <h2 className="text-2xl font-bold tracking-tight text-white">OpenAPI Specification Processing</h2>
          <p className="text-sm text-slate-400 mt-1">
            Upload and parse OpenAPI 3.0 / 3.1 specifications (JSON or YAML) to inspect endpoint contracts and schemas.
          </p>
        </div>

        <SpecUploader
          onSpecLoaded={handleSpecLoaded}
          loading={loading}
          setLoading={setLoading}
        />
      </div>
    );
  }

  // View 2: Spec Loaded - Complete Specification & Endpoint Workspace
  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      {/* Spec Overview Header */}
      <SpecOverview
        spec={spec}
        onReupload={() => setShowUploader(true)}
        onClear={handleClearSpec}
      />

      {/* Two-Column Endpoint Explorer */}
      <div className="grid grid-cols-1 md:grid-cols-12 gap-6 h-[720px]">
        {/* Left Column: Endpoint List */}
        <div className="md:col-span-5 lg:col-span-4 h-full">
          <EndpointList
            endpoints={spec.endpoints}
            selectedEndpointId={selectedEndpointId}
            onSelectEndpoint={(ep) => setSelectedEndpointId(ep.id)}
          />
        </div>

        {/* Right Column: Endpoint Detail */}
        <div className="md:col-span-7 lg:col-span-8 h-full">
          <EndpointDetail endpoint={selectedEndpoint} initialViewTab={initialViewTab} />
        </div>
      </div>
    </div>
  );
}

export default SpecWorkspace;
