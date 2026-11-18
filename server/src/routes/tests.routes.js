/**
 * Test Execution Routes
 * Endpoints for dispatching tests against the sandbox API and inspecting run outcomes.
 */

const express = require('express');
const router = express.Router();
const specStore = require('../services/specStore');
const { executeTestSuite, getExecutionRunById, getAllExecutionRuns } = require('../execution/testRunner');

/**
 * @route   POST /api/tests/execute
 * @desc    Executes an array of validated test cases against the sandbox API
 * @access  Public
 */
router.post('/execute', async (req, res, next) => {
  try {
    const { testCases, sandboxBaseUrl, timeoutMs } = req.body;

    if (!Array.isArray(testCases) || testCases.length === 0) {
      const error = new Error("Missing required field 'testCases' in request body: must be a non-empty array.");
      error.status = 400;
      error.code = 'MISSING_TEST_CASES';
      return next(error);
    }

    const currentSpec = specStore.getCurrentSpec();
    const runResult = await executeTestSuite(testCases, currentSpec, {
      sandboxBaseUrl,
      timeoutMs,
    });

    res.status(200).json({
      success: true,
      message: `Executed ${runResult.totalTests} tests: ${runResult.passedCount} passed, ${runResult.failedCount} failed (${runResult.durationMs}ms)`,
      data: runResult,
    });
  } catch (err) {
    if (err.message.includes('Security violation') || err.message.includes('Execution rejected')) {
      err.status = 400;
      err.code = 'SECURITY_REJECTION';
    }
    next(err);
  }
});

/**
 * @route   GET /api/tests/runs/:id
 * @desc    Retrieves a previous test execution run by ID
 * @access  Public
 */
router.get('/runs/:id', (req, res, next) => {
  try {
    const { id } = req.params;
    const run = getExecutionRunById(id);

    if (!run) {
      const error = new Error(`Test execution run with ID '${id}' was not found.`);
      error.status = 404;
      error.code = 'RUN_NOT_FOUND';
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
 * @route   GET /api/tests/runs
 * @desc    Retrieves all past test execution runs
 * @access  Public
 */
router.get('/runs', (req, res, next) => {
  try {
    const runs = getAllExecutionRuns();
    res.status(200).json({
      success: true,
      data: runs,
    });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
