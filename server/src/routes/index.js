const express = require('express');
const router = express.Router();
const healthRoutes = require('./health.routes');
const specsRoutes = require('./specs.routes');
const aiRoutes = require('./ai.routes');
const ragRoutes = require('./rag.routes');
const testsRoutes = require('./tests.routes');
const evalRoutes = require('./eval.routes');

// Mount health routes under /api/health
router.use('/health', healthRoutes);

// Mount OpenAPI specs processing routes under /api/specs
router.use('/specs', specsRoutes);

// Mount AI test generation, agent orchestration, and usage routes under /api/ai
router.use('/ai', aiRoutes);

// Mount RAG vector indexing and retrieval routes under /api/rag
router.use('/rag', ragRoutes);

// Mount Sandbox API test execution routes under /api/tests
router.use('/tests', testsRoutes);

// Mount LLM Evaluation benchmark routes under /api/evaluations
router.use('/evaluations', evalRoutes);

module.exports = router;
