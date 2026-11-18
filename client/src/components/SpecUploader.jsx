import React, { useState, useRef } from 'react';
import {
  UploadCloud,
  FileCode2,
  AlertCircle,
  CheckCircle2,
  Loader2,
  Sparkles,
  ArrowRight,
  FolderOpen,
} from 'lucide-react';

export function SpecUploader({ onSpecLoaded, loading, setLoading }) {
  const [dragActive, setDragActive] = useState(false);
  const [errorMessage, setErrorMessage] = useState(null);
  const [errorDetails, setErrorDetails] = useState(null);
  const [successMessage, setSuccessMessage] = useState(null);
  const fileInputRef = useRef(null);

  const handleDrag = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  };

  const uploadFile = async (file) => {
    if (!file) return;

    setLoading(true);
    setErrorMessage(null);
    setErrorDetails(null);
    setSuccessMessage(null);

    // Frontend pre-check for file size limit (2 MB)
    if (file.size > 2 * 1024 * 1024) {
      setErrorMessage('File size exceeds the 2 MB limit.');
      setErrorDetails(`Selected file is ${(file.size / (1024 * 1024)).toFixed(2)} MB.`);
      setLoading(false);
      return;
    }

    const formData = new FormData();
    formData.append('spec', file);

    try {
      const res = await fetch('http://localhost:5000/api/specs/upload', {
        method: 'POST',
        body: formData,
      });

      const data = await res.json();

      if (!res.ok || !data.success) {
        const message = data.error?.message || 'Failed to upload and validate specification';
        const details = data.error?.details || data.error?.code || null;
        setErrorMessage(message);
        setErrorDetails(details);
      } else {
        setSuccessMessage(`Successfully parsed '${data.data.info.title}' (${data.data.stats.totalEndpoints} endpoints)`);
        if (onSpecLoaded) {
          onSpecLoaded(data.data);
        }
      }
    } catch (err) {
      setErrorMessage('Network connection error while uploading to server :5000.');
      setErrorDetails(err.message);
    } finally {
      setLoading(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      uploadFile(e.dataTransfer.files[0]);
    }
  };

  const handleChange = (e) => {
    e.preventDefault();
    if (e.target.files && e.target.files[0]) {
      uploadFile(e.target.files[0]);
    }
  };

  const handleLoadSample = async () => {
    setLoading(true);
    setErrorMessage(null);
    setErrorDetails(null);
    setSuccessMessage(null);

    try {
      const res = await fetch('http://localhost:5000/api/specs/load-sample', {
        method: 'POST',
      });
      const data = await res.json();

      if (!res.ok || !data.success) {
        setErrorMessage(data.error?.message || 'Failed to load sample specification');
        setErrorDetails(data.error?.details || null);
      } else {
        setSuccessMessage("Loaded built-in Sandbox API specification (OpenAPI 3.0.3)");
        if (onSpecLoaded) {
          onSpecLoaded(data.data);
        }
      }
    } catch (err) {
      setErrorMessage('Failed to connect to backend server on :5000.');
      setErrorDetails(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-4">
      {/* Feedback Messages */}
      {errorMessage && (
        <div className="p-4 rounded-xl bg-rose-950/40 border border-rose-800/60 text-xs text-rose-200 flex items-start space-x-3 shadow-md animate-fadeIn">
          <AlertCircle className="h-5 w-5 text-rose-400 shrink-0 mt-0.5" />
          <div className="space-y-1 flex-1">
            <div className="font-semibold text-rose-300">{errorMessage}</div>
            {errorDetails && (
              <pre className="text-[11px] text-rose-400 font-mono overflow-x-auto p-2 bg-rose-950/60 rounded border border-rose-900/50">
                {typeof errorDetails === 'string' ? errorDetails : JSON.stringify(errorDetails, null, 2)}
              </pre>
            )}
          </div>
          <button
            onClick={() => setErrorMessage(null)}
            className="text-rose-400 hover:text-rose-200 text-sm font-bold"
          >
            ×
          </button>
        </div>
      )}

      {successMessage && (
        <div className="p-4 rounded-xl bg-emerald-950/40 border border-emerald-800/60 text-xs text-emerald-200 flex items-center justify-between shadow-md animate-fadeIn">
          <div className="flex items-center space-x-2.5">
            <CheckCircle2 className="h-5 w-5 text-emerald-400 shrink-0" />
            <span className="font-medium">{successMessage}</span>
          </div>
          <button
            onClick={() => setSuccessMessage(null)}
            className="text-emerald-400 hover:text-emerald-200 text-sm font-bold"
          >
            ×
          </button>
        </div>
      )}

      {/* Drag & Drop Zone */}
      <div
        onDragEnter={handleDrag}
        onDragLeave={handleDrag}
        onDragOver={handleDrag}
        onDrop={handleDrop}
        className={`relative border-2 border-dashed rounded-2xl p-8 sm:p-12 text-center transition-all ${
          dragActive
            ? 'border-indigo-400 bg-indigo-500/10 scale-[1.01]'
            : 'border-slate-800 hover:border-slate-700 bg-slate-900/40'
        }`}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept=".json,.yaml,.yml,application/json,text/yaml,application/x-yaml"
          onChange={handleChange}
          className="hidden"
          id="spec-file-input"
        />

        <div className="max-w-md mx-auto space-y-4">
          <div className="mx-auto w-16 h-16 rounded-2xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400 shadow-inner">
            {loading ? (
              <Loader2 className="h-8 w-8 animate-spin text-indigo-400" />
            ) : (
              <UploadCloud className="h-8 w-8" />
            )}
          </div>

          <div className="space-y-1.5">
            <h3 className="text-lg font-bold text-white">
              {loading ? 'Processing OpenAPI Specification...' : 'Upload OpenAPI Specification'}
            </h3>
            <p className="text-xs text-slate-400 leading-relaxed">
              Drag and drop your OpenAPI specification file here, or browse from your device. Supports{' '}
              <span className="text-indigo-300 font-medium">OpenAPI 3.0</span> and{' '}
              <span className="text-indigo-300 font-medium">3.1</span> in{' '}
              <span className="text-indigo-300 font-medium">JSON</span> or{' '}
              <span className="text-indigo-300 font-medium">YAML</span> format (max 2 MB).
            </p>
          </div>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-2">
            <label
              htmlFor="spec-file-input"
              className={`px-4 py-2.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold cursor-pointer transition-all shadow-md shadow-indigo-600/20 flex items-center space-x-2 ${
                loading ? 'opacity-50 pointer-events-none' : ''
              }`}
            >
              <FolderOpen className="h-4 w-4" />
              <span>Browse Files</span>
            </label>

            <span className="text-xs text-slate-500">or</span>

            <button
              type="button"
              onClick={handleLoadSample}
              disabled={loading}
              className="px-4 py-2.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold transition-all border border-slate-700/80 flex items-center space-x-2 disabled:opacity-50"
            >
              <Sparkles className="h-4 w-4 text-cyan-400" />
              <span>Load Sample Sandbox Spec</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default SpecUploader;
