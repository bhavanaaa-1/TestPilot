import { io } from 'socket.io-client';

const SOCKET_SERVER_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';

let socket = null;

export function getSocket() {
  if (!socket) {
    socket = io(SOCKET_SERVER_URL, {
      autoConnect: true,
      reconnection: true,
      reconnectionAttempts: 20,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
      transports: ['websocket', 'polling'],
      withCredentials: true,
    });
  }
  return socket;
}

export function subscribeToInvestigation(runId, onEventCallback) {
  const s = getSocket();
  if (!s || !runId) return () => {};

  s.emit('join-investigation', { runId });

  const handler = (payload) => {
    if (payload && (payload.runId === runId || !payload.runId)) {
      if (onEventCallback) onEventCallback(payload);
    }
  };

  s.on('agent:event', handler);

  return () => {
    s.emit('leave-investigation', { runId });
    s.off('agent:event', handler);
  };
}
