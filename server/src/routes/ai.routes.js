const express = require('express');
const router = express.Router();
const specStore = require('../services/specStore');
const { generateTestsForEndpoint } = require('../services/geminiService');
const usageStore = require('../services/usageStore');
const { runAgentInvestigation, getAgentRunById, getAllAgentRuns } = require('../agent/agentOrchestrator');

/**
 * @route   POST /api/ai/generate-tests
 * @desc    Generate intelligent API test cases (positive, negative, boundary) for a specified endpoint using Gemini AI
 * @access  Public
 */
router.post('/generate-tests', async (req, res, next) => {
  try {
    const { endpointId, categories, modelOverride, apiKeyOverride } = req.body;

    if (!endpointId || typeof endpointId !== 'string' || !endpointId.trim()) {
      const error = new Error("Missing required field 'endpointId' in request body.");
      error.status = 400;
      error.code = 'MISSING_ENDPOINT_ID';
      return next(error);
    }

    const currentSpec = specStore.getCurrentSpec();
    if (!currentSpec) {
      const error = new Error('No OpenAPI specification currently loaded. Please upload a specification first.');
      error.status = 400;
      error.code = 'NO_SPEC_LOADED';
      return next(error);
    }

    const endpoint = specStore.getEndpointById(endpointId.trim());
    if (!endpoint) {
      const error = new Error(`Endpoint with ID '${endpointId}' not found in the currently loaded specification.`);
      error.status = 404;
      error.code = 'ENDPOINT_NOT_FOUND';
      return next(error);
    }

    const result = await generateTestsForEndpoint({
      endpoint,
      spec: currentSpec,
      categories: Array.isArray(categories) && categories.length > 0 ? categories : ['positive', 'negative', 'boundary'],
      modelOverride,
      apiKeyOverride,
    });

    res.status(200).json({
      success: true,
      message: `Generated ${result.tests.length} test cases for ${endpoint.method} ${endpoint.path}`,
      data: result,
    });
  } catch (err) {
    next(err);
  }
});

/**
 * @route   GET /api/ai/usage
 * @desc    Retrieve aggregated token consumption and estimated cost monitoring metrics
 * @access  Public
 */
router.get('/usage', (req, res) => {
  const stats = usageStore.getUsageStats();
  res.status(200).json({
    success: true,
    data: stats,
  });
});

/**
 * @route   POST /api/ai/usage/clear
 * @desc    Reset in-memory token usage metrics
 * @access  Public
 */
router.post('/usage/clear', (req, res) => {
  usageStore.clearUsage();
  res.status(200).json({
    success: true,
    message: 'Usage metrics cleared successfully',
  });
});

/**
 * @route   POST /api/ai/agent/run
 * @desc    Launch an autonomous multi-step testing investigation for an endpoint
 * @access  Public
 */
router.post('/agent/run', async (req, res, next) => {
  try {
    const { endpointId, objective, categories, modelOverride, apiKeyOverride, runId } = req.body;

    if (!endpointId || typeof endpointId !== 'string' || !endpointId.trim()) {
      const error = new Error("Missing required field 'endpointId' in request body.");
      error.status = 400;
      error.code = 'MISSING_ENDPOINT_ID';
      return next(error);
    }

    const currentSpec = specStore.getCurrentSpec();
    if (!currentSpec) {
      const error = new Error('No OpenAPI specification currently loaded. Please upload a specification first.');
      error.status = 400;
      error.code = 'NO_SPEC_LOADED';
      return next(error);
    }

    const endpoint = specStore.getEndpointById(endpointId.trim());
    if (!endpoint) {
      const error = new Error(`Endpoint with ID '${endpointId}' not found in the currently loaded specification.`);
      error.status = 404;
      error.code = 'ENDPOINT_NOT_FOUND';
      return next(error);
    }

    const agentRun = await runAgentInvestigation({
      endpointId: endpointId.trim(),
      objective,
      categories: Array.isArray(categories) && categories.length > 0 ? categories : ['positive', 'negative', 'boundary'],
      modelOverride,
      apiKeyOverride,
      runId: runId && typeof runId === 'string' ? runId.trim() : null,
    });

    res.status(200).json({
      success: true,
      message: `Completed autonomous investigation for ${endpoint.method} ${endpoint.path} (${agentRun.status})`,
      data: agentRun,
    });
  } catch (err) {
    next(err);
  }
});

/**
 * @route   GET /api/ai/agent/runs/:id
 * @desc    Retrieve results of a previous autonomous agent investigation run
 * @access  Public
 */
router.get('/agent/runs/:id', (req, res, next) => {
  try {
    const { id } = req.params;
    const run = getAgentRunById(id);

    if (!run) {
      const error = new Error(`Agent investigation run with ID '${id}' was not found.`);
      error.status = 404;
      error.code = 'AGENT_RUN_NOT_FOUND';
      return next(error);
    }

    res.status(200).json({
      success: true,
      data: run,
    });
  } catch (err) {
    next(err);
  }
});

/**
 * @route   GET /api/ai/agent/runs
 * @desc    Retrieve all past agent investigation runs
 * @access  Public
 */
router.get('/agent/runs', (req, res, next) => {
  try {
    const runs = getAllAgentRuns();
    res.status(200).json({
      success: true,
      data: runs,
    });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
