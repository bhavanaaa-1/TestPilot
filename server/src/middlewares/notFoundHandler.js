/**
 * 404 Not Found Middleware
 * Intercepts requests that do not match any defined routes.
 */
function notFoundHandler(req, res, next) {
  const error = new Error(`Resource not found: ${req.method} ${req.originalUrl}`);
  error.status = 404;
  next(error);
}

module.exports = notFoundHandler;
