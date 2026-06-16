const express = require('express');
const {
  getCorrections,
  createCorrection,
  updateCorrection,
  approveCorrection,
  disableCorrection,
} = require('../controllers/correctionController');
const { authenticate, authorize } = require('../middleware/authMiddleware');

const router = express.Router();

router.use(authenticate);

router.get('/', authorize('SYSTEM_ADMIN', 'MANAGER'), getCorrections);
router.post('/', authorize('SYSTEM_ADMIN', 'MANAGER'), createCorrection);
router.patch('/:id', authorize('SYSTEM_ADMIN', 'MANAGER'), updateCorrection);

// 승인/비활성화는 시스템 관리자만 가능하다.
router.post('/:id/approve', authorize('SYSTEM_ADMIN'), approveCorrection);
router.post('/:id/disable', authorize('SYSTEM_ADMIN'), disableCorrection);

module.exports = router;
