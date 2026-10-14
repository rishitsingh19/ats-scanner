'use strict';

const multer = require('multer');
const path = require('path');
const { config } = require('../config');
const { badRequest } = require('../utils/errors');

const ALLOWED = {
  '.pdf': ['application/pdf'],
  '.docx': ['application/vnd.openxmlformats-officedocument.wordprocessingml.document'],
};

// Files are kept in memory only, then encrypted before they touch the database.
// No shared filesystem is needed (SRS 5.4 Portability).
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: config.maxUploadBytes, files: 1 },
  fileFilter(req, file, cb) {
    const ext = path.extname(file.originalname || '').toLowerCase();
    if (!ALLOWED[ext]) {
      return cb(
        badRequest(
          'UNSUPPORTED_FILE_TYPE',
          `"${file.originalname}" is not supported. Please upload your resume as a PDF or Word (.docx) file.`
        )
      );
    }
    return cb(null, true);
  },
});

/** Single-file upload with friendly errors (REQ-1.5). */
function resumeUpload(req, res, next) {
  upload.single('resume')(req, res, (err) => {
    if (!err) {
      if (!req.file) return next(badRequest('NO_FILE', 'Please choose a resume file to upload.'));
      return next();
    }
    if (err instanceof multer.MulterError && err.code === 'LIMIT_FILE_SIZE') {
      return next(badRequest('FILE_TOO_LARGE', 'This file is larger than 5 MB. Please upload a smaller PDF or DOCX file.'));
    }
    if (err instanceof multer.MulterError) {
      return next(badRequest('UPLOAD_ERROR', 'The upload could not be read. Please upload a single PDF or DOCX file.'));
    }
    return next(err);
  });
}

module.exports = { resumeUpload };
