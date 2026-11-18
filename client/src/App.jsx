import React, { useState, useEffect } from 'react';
import Header from './components/Header';
import Sidebar from './components/Sidebar';
import Workspace from './components/Workspace';

export function App() {
  const [currentTab, setCurrentTab] = useState('dashboard');
  const [serverStatus, setServerStatus] = useState('checking');
  const [sandboxStatus, setSandboxStatus] = useState('checking');
  const [currentSpec, setCurrentSpec] = useState(null);

  // Background ping to verify service availability and loaded spec on mount
  useEffect(() => {
    let isMounted = true;

    async function checkHealth() {
      // Check Backend
      try {
        const res = await fetch('http://localhost:5000/health');
        if (isMounted) {
          setServerStatus(res.ok ? 'online' : 'error');
        }
      } catch {
        if (isMounted) {
          setServerStatus('offline');
        }
      }

      // Check Sandbox API
      try {
        const res = await fetch('http://localhost:4000/users');
        if (isMounted) {
          setSandboxStatus(res.ok ? 'online' : 'error');
        }
      } catch {
        if (isMounted) {
          setSandboxStatus('offline');
        }
      }

      // Fetch Current Spec if available
      try {
        const res = await fetch('http://localhost:5000/api/specs/current');
        if (res.ok) {
          const data = await res.json();
          if (isMounted && data.success && data.data) {
            setCurrentSpec(data.data);
          }
        }
      } catch {
        // Ignored
      }
    }

    checkHealth();
    const interval = setInterval(checkHealth, 8000);
    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, []);

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans selection:bg-indigo-500/30 selection:text-indigo-200">
      <Header
        serverStatus={serverStatus}
        sandboxStatus={sandboxStatus}
        specInfo={currentSpec?.info}
      />
      <div className="flex-1 flex overflow-hidden">
        <Sidebar
          currentTab={currentTab}
          setCurrentTab={setCurrentTab}
          specLoaded={Boolean(currentSpec)}
        />
        <main className="flex-1 overflow-y-auto">
          <Workspace
            currentTab={currentTab}
            setCurrentTab={setCurrentTab}
            spec={currentSpec}
            onSpecUpdated={setCurrentSpec}
          />
        </main>
      </div>
    </div>
  );
}

export default App;
