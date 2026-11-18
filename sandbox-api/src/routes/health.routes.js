const express = require('express');
const router = express.Router();
const config = require('../config/env');

router.get('/', (req, res) => {
  res.status(200).json({
    status: 'ok',
    service: 'testpilot-sandbox-api',
    uptime: Math.floor(process.uptime()),
    timestamp: new Date().toISOString(),
    environment: config.NODE_ENV,
    endpoints: [
      'GET /users',
      'GET /users/:id',
      'POST /users',
      'DELETE /users/:id',
    ],
  });
});

module.exports = router;
