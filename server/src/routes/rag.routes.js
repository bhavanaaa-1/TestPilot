/**
 * RAG API Routes
 * Endpoints for vector indexing, retrieval status, and specification re-indexing.
 */

const express = require('express');
const router = express.Router();
const { getRagStatus, reindexCurrentSpec, retrieveContext } = require('../rag/retrievalService');

/**
 * @route   GET /api/rag/status
 * @desc    Get indexing status and vector storage metrics
 * @access  Public
 */
router.get('/status', async (req, res, next) => {
  try {
    const status = await getRagStatus();
    res.status(200).json({
      success: true,
      data: status,
    });
  } catch (err) {
    next(err);
  }
});

/**
 * @route   POST /api/rag/reindex
 * @desc    Re-chunks and vector-indexes the currently loaded specification
 * @access  Public
 */
router.post('/reindex', async (req, res, next) => {
  try {
    const result = await reindexCurrentSpec();
    res.status(200).json({
      success: true,
      message: `Successfully indexed ${result.chunksIndexed} chunks for '${result.specTitle}' using ${result.backend}`,
      data: result,
    });
  } catch (err) {
    if (err.message.includes('No specification currently loaded')) {
      err.status = 400;
      err.code = 'NO_SPEC_LOADED';
    }
    next(err);
  }
});

/**
 * @route   POST /api/rag/query
 * @desc    Queries relevant documentation chunks for a given search query
 * @access  Public
 */
router.post('/query', async (req, res, next) => {
  try {
    const { query, topK, minSimilarity, endpointId } = req.body;
    if (!query || typeof query !== 'string') {
      const error = new Error("Missing required field 'query' in request body.");
      error.status = 400;
      error.code = 'MISSING_QUERY';
      return next(error);
    }

    const result = await retrieveContext(query, { topK, minSimilarity, endpointId });
    res.status(200).json({
      success: true,
      data: result,
    });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
