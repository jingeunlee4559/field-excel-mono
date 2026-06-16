const express = require('express');
const {
  processSourceFile,
  getExtractedValues,
  getRawResult,
} = require('../controllers/aiController');
const { authenticate, authorize } = require('../middleware/authMiddleware');

const router = express.Router();

router.post('/source-files/:sourceFileId/process', authenticate, authorize('SYSTEM_ADMIN', 'MANAGER', 'SUBMITTER'), processSourceFile);
router.get('/source-files/:sourceFileId/extracted-values', authenticate, authorize('SYSTEM_ADMIN', 'MANAGER'), getExtractedValues);
router.get('/source-files/:sourceFileId/raw-result', authenticate, authorize('SYSTEM_ADMIN', 'MANAGER'), getRawResult);

module.exports = router;
