const express = require('express');
const {
  getRequiredReviews,
  getSupplementRequiredList,
  getReviewDetail,
  updateExtractedValue,
  updateExtractedValuesBulk,
  syncDetailItems,
  revalidateSourceFile,
  completeReview,
  requestSupplement,
} = require('../controllers/reviewController');
const {
  getReviewBatches,
  getReviewBatchDetail,
  completeReviewBatch,
} = require('../controllers/reviewBatchController');
const { authenticate, authorize } = require('../middleware/authMiddleware');

const router = express.Router();

const managerOnly = [authenticate, authorize('MANAGER', 'SYSTEM_ADMIN')];

/**
 * 배치 단위 검토 화면 API
 * - 반드시 /source-files/:sourceFileId 보다 위에 둔다.
 */
router.get('/batches', ...managerOnly, getReviewBatches);
router.get('/batches/:batchId', ...managerOnly, getReviewBatchDetail);
router.post('/batches/:batchId/complete', ...managerOnly, completeReviewBatch);

/**
 * 기존 파일 단위 검토 API
 */
router.get('/required', ...managerOnly, getRequiredReviews);
router.get('/supplements', ...managerOnly, getSupplementRequiredList);
router.get('/source-files/:sourceFileId', ...managerOnly, getReviewDetail);
router.patch('/extracted-values/:extractedValueId', ...managerOnly, updateExtractedValue);
router.patch('/source-files/:sourceFileId/extracted-values', ...managerOnly, updateExtractedValuesBulk);
router.patch('/source-files/:sourceFileId/detail-items', ...managerOnly, syncDetailItems);
router.post('/source-files/:sourceFileId/revalidate', ...managerOnly, revalidateSourceFile);
router.post('/source-files/:sourceFileId/complete', ...managerOnly, completeReview);
router.post('/source-files/:sourceFileId/request-supplement', ...managerOnly, requestSupplement);

module.exports = router;
