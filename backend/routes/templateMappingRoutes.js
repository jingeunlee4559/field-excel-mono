const express = require('express');
const {
  getTemplateMappings,
  getTemplateMappingCandidates,
  getTemplateMappingPreview,
  createTemplateMappings,
  lockTemplateMappings,
  previewTemplateMappings,
} = require('../controllers/templateMappingController');
const { authenticate, authorize } = require('../middleware/authMiddleware');

const router = express.Router({ mergeParams: true });

router.get('/preview-grid', authenticate, authorize('SYSTEM_ADMIN'), getTemplateMappingPreview);
router.get('/candidates', authenticate, authorize('SYSTEM_ADMIN'), getTemplateMappingCandidates);
router.get('/', authenticate, authorize('SYSTEM_ADMIN'), getTemplateMappings);
router.post('/', authenticate, authorize('SYSTEM_ADMIN'), createTemplateMappings);
router.post('/lock', authenticate, authorize('SYSTEM_ADMIN'), lockTemplateMappings);
router.post('/preview', authenticate, authorize('SYSTEM_ADMIN'), previewTemplateMappings);

module.exports = router;
