const express = require('express');
const { runValidation, getValidationResults } = require('../controllers/validationController');
const { authenticate, authorize } = require('../middleware/authMiddleware');

const router = express.Router();

router.post('/source-files/:sourceFileId/run', authenticate, authorize('SYSTEM_ADMIN', 'MANAGER'), runValidation);
router.get('/source-files/:sourceFileId/results', authenticate, authorize('SYSTEM_ADMIN', 'MANAGER'), getValidationResults);

module.exports = router;
