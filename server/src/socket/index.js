/**
 * TestPilot Real-Time WebSocket Service (Socket.IO)
 * Integrates directly on the existing Express HTTP server.
 * Manages client connections, investigation room subscriptions, and real-time agent event broadcasts.
 */

const { Server } = require('socket.io');
const config = require('../config/env');

let io = null;

const VALID_AGENT_EVENTS = new Set([
  'agent:started',
  'agent:step',
  'agent:tool-called',
  'agent:retrieval-completed',
  'agent:test-started',
  'agent:test-completed',
  'agent:diagnosis',
  'agent:completed',
  'agent:error',
]);

const SENSITIVE_KEY_PATTERNS = [
  /api[-_]?key/i,
  /secret/i,
  /password/i,
  /token/i,
  /auth(orization)?/i,
  /credentials?/i,
];

/**
 * Recursively sanitizes event payload to prevent accidental leakage
 * of API keys, tokens, or environment credentials.
 */
function sanitizePayload(obj, depth = 0) {
  if (depth > 6 || obj === null || obj === undefined) return obj;
  if (typeof obj === 'string') {
    // Mask potential API keys
    return obj.replace(/AIzaSy[0-9A-Za-z_-]{20,40}/g, '[REDACTED_API_KEY]');
  }
  if (Array.isArray(obj)) {
    return obj.map((item) => sanitizePayload(item, depth + 1));
  }
  if (typeof obj === 'object') {
    const clean = {};
    for (const [key, value] of Object.entries(obj)) {
      const isSensitive = SENSITIVE_KEY_PATTERNS.some((pattern) => pattern.test(key));
      if (isSensitive) {
        clean[key] = '[REDACTED]';
      } else {
        clean[key] = sanitizePayload(value, depth + 1);
      }
    }
    return clean;
  }
  return obj;
}

/**
 * Validates investigation runId format
 */
function isValidRunId(runId) {
  if (!runId || typeof runId !== 'string') return false;
  // Format: agent_<timestamp>_<random> or eval_run_...
  return /^[a-zA-Z0-9_-]{4,100}$/.test(runId.trim());
}

/**
 * Initializes Socket.IO on the provided Node.js HTTP Server instance.
 */
function initSocketIO(httpServer, options = {}) {
  if (io) {
    return io;
  }

  const corsOrigins = [
    config.CLIENT_ORIGIN,
    'http://localhost:5173',
    'http://localhost:3000',
    'http://127.0.0.1:5173',
    'http://localhost:5000',
    'http://127.0.0.1:5000',
    'http://localhost:5055',
    'http://127.0.0.1:5055',
  ];

  io = new Server(httpServer, {
    cors: {
      origin: (origin, callback) => {
        // Allow requests with no origin (like mobile apps, curl, or server-to-server tests)
        if (!origin) return callback(null, true);
        if (corsOrigins.includes(origin) || corsOrigins.includes('*')) {
          return callback(null, true);
        }
        return callback(null, true); // Permissive for local dev & evaluation
      },
      methods: ['GET', 'POST'],
      credentials: true,
    },
    pingTimeout: 10000,
    pingInterval: 15000,
    ...options,
  });

  io.on('connection', (socket) => {
    // Client connection established
    socket.emit('connection:ready', {
      socketId: socket.id,
      timestamp: new Date().toISOString(),
      serverVersion: '1.0.0-phase5',
    });

    // Handle subscription to a specific agent investigation run
    socket.on('join-investigation', (data, callback) => {
      try {
        const runId = typeof data === 'string' ? data : data?.runId;

        if (!isValidRunId(runId)) {
          const errPayload = {
            success: false,
            error: 'Invalid runId format. Expected alphanumeric string between 4 and 100 characters.',
          };
          if (typeof callback === 'function') callback(errPayload);
          socket.emit('investigation:error', errPayload);
          return;
        }

        const roomName = `investigation:${runId.trim()}`;
        socket.join(roomName);

        const ackPayload = {
          success: true,
          runId: runId.trim(),
          room: roomName,
          timestamp: new Date().toISOString(),
        };

        if (typeof callback === 'function') callback(ackPayload);
        socket.emit('joined-investigation', ackPayload);
      } catch (err) {
        socket.emit('investigation:error', { success: false, error: err.message });
      }
    });

    // Handle unsubscription from an investigation run
    socket.on('leave-investigation', (data, callback) => {
      try {
        const runId = typeof data === 'string' ? data : data?.runId;
        if (runId && typeof runId === 'string') {
          const roomName = `investigation:${runId.trim()}`;
          socket.leave(roomName);
          const ack = { success: true, runId: runId.trim() };
          if (typeof callback === 'function') callback(ack);
          socket.emit('left-investigation', ack);
        }
      } catch (err) {
        // Ignored
      }
    });

    // Disconnect handling
    socket.on('disconnect', (reason) => {
      // Clean disconnect
    });

    // Socket error handling
    socket.on('error', (err) => {
      console.warn(`[SOCKET] Error on socket ${socket.id}: ${err.message}`);
    });
  });

  return io;
}

/**
 * Retrieves active Socket.IO server instance.
 */
function getIO() {
  return io;
}

/**
 * Broadcasts an actual agent event to clients subscribed to the specific run.
 * Emits both to the dedicated investigation room and as a top-level typed event.
 */
function emitAgentEvent(runId, eventType, data = {}) {
  if (!io) return false;
  if (!isValidRunId(runId)) return false;
  if (!VALID_AGENT_EVENTS.has(eventType)) {
    console.warn(`[SOCKET] Warning: Unsupported agent event type '${eventType}'`);
    return false;
  }

  const cleanData = sanitizePayload(data);
  const payload = {
    runId,
    eventType,
    timestamp: new Date().toISOString(),
    data: cleanData,
  };

  const roomName = `investigation:${runId.trim()}`;

  // Emit directly to the dedicated investigation room
  io.to(roomName).emit(eventType, payload);

  // Also emit generic event for clients listening to a single stream
  io.to(roomName).emit('agent:event', payload);

  return true;
}

/**
 * Resets Socket.IO instance (useful for clean unit/integration test teardown)
 */
function closeSocketIO() {
  if (io) {
    io.close();
    io = null;
  }
}

module.exports = {
  VALID_AGENT_EVENTS,
  initSocketIO,
  getIO,
  emitAgentEvent,
  closeSocketIO,
  sanitizePayload,
  isValidRunId,
};
