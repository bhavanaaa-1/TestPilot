const multer = require('multer');
const path = require('path');

const MAX_FILE_SIZE = 2 * 1024 * 1024; // 2 MB
const ALLOWED_EXTENSIONS = new Set(['.json', '.yaml', '.yml']);

const storage = multer.memoryStorage();

function fileFilter(req, file, cb) {
  const ext = path.extname(file.originalname || '').toLowerCase();

  // If extension is known and unsupported, reject immediately
  if (ext && !ALLOWED_EXTENSIONS.has(ext)) {
    const error = new Error(`Unsupported file extension '${ext}'. Allowed file extensions are: .json, .yaml, .yml`);
    error.status = 400;
    error.code = 'UNSUPPORTED_FILE_EXTENSION';
    return cb(error, false);
  }

  // Accept file for deeper content inspection in the parser
  cb(null, true);
}

const upload = multer({
  storage,
  limits: {
    fileSize: MAX_FILE_SIZE,
    files: 1,
  },
  fileFilter,
});

/**
 * Middleware wrapper that catches Multer-specific errors (e.g. LIMIT_FILE_SIZE)
 * and formats them into standard 400 Bad Request responses.
 */
function handleUpload(fieldName = 'spec') {
  const multerMiddleware = upload.single(fieldName);

  return (req, res, next) => {
    multerMiddleware(req, res, (err) => {
      if (err) {
        if (err instanceof multer.MulterError) {
          if (err.code === 'LIMIT_FILE_SIZE') {
            const error = new Error(`File size exceeds the 2 MB limit (max ${MAX_FILE_SIZE} bytes).`);
            error.status = 400;
            error.code = 'FILE_TOO_LARGE';
            return next(error);
          }
          const error = new Error(`File upload error: ${err.message}`);
          error.status = 400;
          error.code = err.code;
          return next(error);
        }
        return next(err);
      }
      next();
    });
  };
}

module.exports = {
  handleUpload,
  MAX_FILE_SIZE,
  ALLOWED_EXTENSIONS,
};
