const config = require('../config/env');

/**
 * Centralized Error-Handling Middleware
 * Formats all unhandled application errors into a consistent JSON response.
 */
// eslint-disable-next-line no-unused-vars
function errorHandler(err, req, res, next) {
  const status = err.status || err.statusCode || 500;
  const message = err.message || 'Internal Server Error';

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

  if (err.code) {
    response.error.code = err.code;
  }
  if (err.details) {
    response.error.details = err.details;
  }
  if (err.field) {
    response.error.field = err.field;
  }
  if (err.ref) {
    response.error.ref = err.ref;
  }

  // Include stack trace only in development
  if (config.NODE_ENV === 'development' && status === 500) {
    response.error.stack = err.stack;
  }

  // Log error details for debugging
  if (status >= 500) {
    console.error(`[ERROR] ${req.method} ${req.originalUrl}:`, err);
  } else {
    console.warn(`[WARN] ${req.method} ${req.originalUrl} (${status}): ${message}`);
  }

  res.status(status).json(response);
}

module.exports = errorHandler;
