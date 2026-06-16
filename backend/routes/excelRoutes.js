const express = require('express');

const {
  generateExcel,
  generateExcelFromSourceFile,
  downloadSelectedTemplateReport,
  getGeneratedDocuments,
  getGeneratedDocumentDetail,
  downloadGeneratedDocument,
} = require('../controllers/excelController');

const { authenticate, authorize } = require('../middleware/authMiddleware');

const router = express.Router();

router.post(
  '/batches/:batchId/generate',
  authenticate,
  authorize('MANAGER', 'SYSTEM_ADMIN'),
  generateExcel
);


router.post(
  '/source-files/:sourceFileId/generate',
  authenticate,
  authorize('MANAGER', 'SYSTEM_ADMIN'),
  generateExcelFromSourceFile
);


router.post(
  '/reports/selected-template-download',
  authenticate,
  authorize('MANAGER', 'SYSTEM_ADMIN'),
  downloadSelectedTemplateReport
);

router.get(
  '/generated-documents',
  authenticate,
  authorize('MANAGER', 'SYSTEM_ADMIN'),
  getGeneratedDocuments
);

router.get(
  '/generated-documents/:generatedDocumentId/download',
  authenticate,
  authorize('MANAGER', 'SYSTEM_ADMIN'),
  downloadGeneratedDocument
);

router.get(
  '/generated-documents/:generatedDocumentId',
  authenticate,
  authorize('MANAGER', 'SYSTEM_ADMIN'),
  getGeneratedDocumentDetail
);

module.exports = router;