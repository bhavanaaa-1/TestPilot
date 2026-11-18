const express = require('express');
const cors = require('cors');
const config = require('./config/env');
const healthRoutes = require('./routes/health.routes');
const apiRoutes = require('./routes');
const notFoundHandler = require('./middlewares/notFoundHandler');
const errorHandler = require('./middlewares/errorHandler');

const app = express();

// Enable CORS with flexible origins for development
app.use(cors({
  origin: [config.CLIENT_ORIGIN, 'http://localhost:3000', 'http://localhost:5173', 'http://127.0.0.1:5173'],
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: true,
}));

// Body parsing middlewares
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Request logging middleware (lightweight)
app.use((req, res, next) => {
  const start = Date.now();
  res.on('finish', () => {
    const duration = Date.now() - start;
    console.log(`[SERVER] ${req.method} ${req.originalUrl} ${res.statusCode} - ${duration}ms`);
  });
  next();
});

// Root welcome / discovery endpoint
app.get('/', (req, res) => {
  res.status(200).json({
    name: 'TestPilot Backend API',
    phase: 'Phase 6: Final Hardening & Project Assessor Readiness',
    version: '1.0.0-phase6',
    status: 'online',
    endpoints: {
      health: '/health',
      apiHealth: '/api/health',
      specsUpload: 'POST /api/specs/upload',
      specsCurrent: 'GET /api/specs/current',
      specsEndpoint: 'GET /api/specs/endpoints/:id',
      specsSample: 'POST /api/specs/load-sample',
      aiGenerateTests: 'POST /api/ai/generate-tests',
      aiAgentRun: 'POST /api/ai/agent/run',
      aiAgentRuns: 'GET /api/ai/agent/runs/:id',
      aiUsage: 'GET /api/ai/usage',
      testsExecute: 'POST /api/tests/execute',
      testsRuns: 'GET /api/tests/runs/:id',
      ragStatus: 'GET /api/rag/status',
      ragReindex: 'POST /api/rag/reindex',
      evaluationsDatasets: 'GET /api/evaluations/datasets',
      evaluationsRun: 'POST /api/evaluations/run',
      evaluationsSummary: 'GET /api/evaluations/summary',
    },
    documentation: 'See /docs directory in project repository',
  });
});

// Mount /health directly at root for strict requirement matching
app.use('/health', healthRoutes);

// Mount modular /api router
app.use('/api', apiRoutes);

// Catch 404s
app.use(notFoundHandler);

// Centralized error handler
app.use(errorHandler);

module.exports = app;
