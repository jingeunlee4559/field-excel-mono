const express = require('express');

const {
  uploadReceipts,
  getMyBatches,
  getBatchDetail,
  getMySupplements,
  uploadSupplementFile,
} = require('../controllers/uploadController');

const { authenticate, authorize } = require('../middleware/authMiddleware');
const { receiptUpload } = require('../middleware/uploadMiddleware');

const router = express.Router();

router.post(
  '/receipts',
  authenticate,
  authorize('SUBMITTER', 'MANAGER', 'SYSTEM_ADMIN'),
  receiptUpload.array('files', 20),
  uploadReceipts
);

router.get(
  '/my-batches',
  authenticate,
  getMyBatches
);

router.get(
  '/my-supplements',
  authenticate,
  authorize('SUBMITTER', 'MANAGER', 'SYSTEM_ADMIN'),
  getMySupplements
);

router.get(
  '/batches/:batchId',
  authenticate,
  getBatchDetail
);

router.post(
  '/source-files/:sourceFileId/supplement',
  authenticate,
  authorize('SUBMITTER', 'MANAGER', 'SYSTEM_ADMIN'),
  receiptUpload.single('file'),
  uploadSupplementFile
);

module.exports = router;