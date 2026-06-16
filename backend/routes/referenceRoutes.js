const express = require('express');
const {
  getStandardFields,
  getDocumentTypeFields,
  getExpenseCategories,
  getValidationRules,
  getDepartments,
  getSites,
  getRoles,
} = require('../controllers/referenceController');
const { authenticate } = require('../middleware/authMiddleware');

const router = express.Router();

router.get('/standard-fields', authenticate, getStandardFields);
router.get('/document-type-fields', authenticate, getDocumentTypeFields);
router.get('/expense-categories', authenticate, getExpenseCategories);
router.get('/validation-rules', authenticate, getValidationRules);
router.get('/departments', authenticate, getDepartments);
router.get('/sites', authenticate, getSites);
router.get('/roles', authenticate, getRoles);

module.exports = router;
