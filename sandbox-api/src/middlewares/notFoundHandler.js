function notFoundHandler(req, res, next) {
  const error = new Error(`Sandbox route not found: ${req.method} ${req.originalUrl}`);
  error.status = 404;
  next(error);
}

module.exports = notFoundHandler;
