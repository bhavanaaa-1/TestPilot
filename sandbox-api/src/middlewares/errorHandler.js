const config = require('../config/env');

// eslint-disable-next-line no-unused-vars
function errorHandler(err, req, res, next) {
  const status = err.status || err.statusCode || 500;
  const message = err.message || 'Sandbox Internal Server Error';

  const response = {
    success: false,
    error: {
      message,
      status,
      timestamp: new Date().toISOString(),
      path: req.originalUrl,
      method: req.method,
    },
  };

  if (err.details) {
    response.error.details = err.details;
  }

  if (config.NODE_ENV === 'development' && status === 500) {
    response.error.stack = err.stack;
  }

  res.status(status).json(response);
}

module.exports = errorHandler;
