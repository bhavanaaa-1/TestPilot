/**
 * LLM Evaluation REST Routes
 * Endpoints for listing benchmark datasets, running evaluations, and retrieving summaries.
 */

const express = require('express');
const {
  listDatasets,
  loadDataset,
  runEvaluation,
  getEvaluationRunById,
  getAllEvaluationRuns,
  getEvaluationSummary,
} = require('../eval/evaluator');

const router = express.Router();

/**
 * GET /api/evaluations/datasets
 * Returns list of all available benchmark evaluation datasets.
 */
router.get('/datasets', (req, res, next) => {
  try {
    const datasets = listDatasets();
    res.status(200).json({
      success: true,
      data: {
        totalDatasets: datasets.length,
        datasets,
      },
    });
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/evaluations/datasets/:id
 * Retrieves full dataset definition including all benchmark cases.
 */
router.get('/datasets/:id', (req, res, next) => {
  try {
    const dataset = loadDataset(req.params.id);
    res.status(200).json({
      success: true,
      data: dataset,
    });
  } catch (err) {
    if (err.message.includes('not found')) {
      return res.status(404).json({
        success: false,
        error: {
          code: 'DATASET_NOT_FOUND',
          message: err.message,
        },
      });
    }
    next(err);
  }
});

/**
 * POST /api/evaluations/run
 * Executes an evaluation benchmark against the specified dataset.
 */
router.post('/run', async (req, res, next) => {
  try {
    const { datasetId = 'benchmark-v1', useLiveGemini = false, apiKeyOverride = null, modelOverride = null } = req.body || {};

    const runResult = await runEvaluation({
      datasetId,
      useLiveGemini: Boolean(useLiveGemini),
      apiKeyOverride,
      modelOverride,
    });

    res.status(200).json({
      success: true,
      data: runResult,
    });
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/evaluations/summary
 * Returns aggregated statistics across all historical evaluation runs.
 */
router.get('/summary', (req, res, next) => {
  try {
    const summary = getEvaluationSummary();
    res.status(200).json({
      success: true,
      data: summary,
    });
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/evaluations/runs/:id
 * Retrieves detailed results and metrics for a specific evaluation run.
 */
router.get('/runs/:id', (req, res, next) => {
  try {
    const run = getEvaluationRunById(req.params.id);
    if (!run) {
      return res.status(404).json({
        success: false,
        error: {
          code: 'EVALUATION_RUN_NOT_FOUND',
          message: `Evaluation run with ID '${req.params.id}' was not found.`,
        },
      });
    }

    res.status(200).json({
      success: true,
      data: run,
    });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
