const express = require('express');
const path = require('path');
const fs = require('fs');
const router = express.Router();
const { handleUpload } = require('../middlewares/upload');
const { parseAndValidateOpenApi } = require('../services/openApiParser');
const specStore = require('../services/specStore');

/**
 * @route   POST /api/specs/upload
 * @desc    Upload, validate and parse an OpenAPI 3.0 / 3.1 specification (JSON or YAML)
 * @access  Public
 */
router.post('/upload', handleUpload('spec'), async (req, res, next) => {
  try {
    if (!req.file || !req.file.buffer) {
      const error = new Error("No file uploaded. Please upload an OpenAPI specification under field 'spec'.");
      error.status = 400;
      error.code = 'NO_FILE_UPLOADED';
      return next(error);
    }

    const parsedSpec = await parseAndValidateOpenApi(req.file.buffer, req.file.originalname);

    // Save to memory store
    const stored = specStore.setCurrentSpec(parsedSpec);

    res.status(200).json({
      success: true,
      message: 'OpenAPI specification uploaded and validated successfully',
      data: stored,
    });
  } catch (err) {
    next(err);
  }
});

/**
 * @route   GET /api/specs/current
 * @desc    Get currently loaded specification metadata, statistics and endpoint list
 * @access  Public
 */
router.get('/current', (req, res) => {
  const current = specStore.getCurrentSpec();

  if (!current) {
    return res.status(200).json({
      success: true,
      message: 'No OpenAPI specification currently loaded',
      data: null,
    });
  }

  res.status(200).json({
    success: true,
    data: current,
  });
});

/**
 * @route   GET /api/specs/endpoints/:id
 * @desc    Get detailed operation specification for a specific endpoint identifier
 * @access  Public
 */
router.get('/endpoints/:id', (req, res, next) => {
  const { id } = req.params;
  const current = specStore.getCurrentSpec();

  if (!current) {
    const error = new Error('No OpenAPI specification currently loaded. Please upload a specification first.');
    error.status = 404;
    error.code = 'NO_SPEC_LOADED';
    return next(error);
  }

  const endpoint = specStore.getEndpointById(id);

  if (!endpoint) {
    const error = new Error(`Endpoint with id '${id}' not found in the currently loaded specification.`);
    error.status = 404;
    error.code = 'ENDPOINT_NOT_FOUND';
    return next(error);
  }

  res.status(200).json({
    success: true,
    data: endpoint,
  });
});

/**
 * @route   POST /api/specs/load-sample
 * @desc    Load built-in Sandbox API OpenAPI sample specification into memory
 * @access  Public
 */
router.post('/load-sample', async (req, res, next) => {
  try {
    const samplePath = path.resolve(__dirname, '../../../examples/sandbox-openapi.yaml');

    if (!fs.existsSync(samplePath)) {
      const error = new Error('Sample OpenAPI specification file not found on server.');
      error.status = 500;
      error.code = 'SAMPLE_FILE_MISSING';
      return next(error);
    }

    const buffer = fs.readFileSync(samplePath);
    const parsedSpec = await parseAndValidateOpenApi(buffer, 'sandbox-openapi.yaml');
    const stored = specStore.setCurrentSpec(parsedSpec);

    res.status(200).json({
      success: true,
      message: 'Sample Sandbox OpenAPI specification loaded successfully',
      data: stored,
    });
  } catch (err) {
    next(err);
  }
});

/**
 * @route   DELETE /api/specs/current
 * @desc    Clear the currently loaded specification from memory
 * @access  Public
 */
router.delete('/current', (req, res) => {
  specStore.clearCurrentSpec();
  res.status(200).json({
    success: true,
    message: 'Specification cleared from memory',
  });
});

module.exports = router;
