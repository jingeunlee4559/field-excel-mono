const express = require('express');
const {
  getAuditLogs,
  getAuditLogDetail,
  getAuditSummary,
  getAuditMeta,
} = require('../controllers/auditController');
const { authenticate, authorize } = require('../middleware/authMiddleware');

const router = express.Router();

router.use(authenticate);
router.use(authorize('SYSTEM_ADMIN'));

router.get('/', getAuditLogs);
router.get('/summary', getAuditSummary);
router.get('/meta', getAuditMeta);
router.get('/:logId', getAuditLogDetail);

module.exports = router;
