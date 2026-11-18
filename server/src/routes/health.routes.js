const express = require('express');
const router = express.Router();
const config = require('../config/env');

/**
 * @route   GET /health
 * @desc    Health check endpoint returning system status
 * @access  Public
 */
router.get('/', (req, res) => {
  const healthData = {
    status: 'ok',
    service: 'testpilot-server',
    uptime: Math.floor(process.uptime()),
    timestamp: new Date().toISOString(),
    environment: config.NODE_ENV,
    version: '1.0.0-phase1',
  };

  res.status(200).json(healthData);
});

module.exports = router;
