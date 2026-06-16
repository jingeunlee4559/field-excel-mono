const express = require('express');
const {
  getTemplates,
  getTemplateDetail,
  createTemplate,
  activateTemplate,
  archiveTemplate,
} = require('../controllers/templateController');
const { authenticate, authorize } = require('../middleware/authMiddleware');
const { templateUpload } = require('../middleware/uploadMiddleware');

const router = express.Router();

// 템플릿 목록/상세 조회는 업로드 화면과 매핑 선택 화면에서도 필요하므로 로그인 사용자에게 공개한다.
// 등록/활성화/보관 같은 변경 작업만 SYSTEM_ADMIN으로 제한한다.
router.get('/', authenticate, getTemplates);
router.get('/:templateId', authenticate, getTemplateDetail);
router.post('/', authenticate, authorize('SYSTEM_ADMIN'), templateUpload.single('file'), createTemplate);
router.post('/:templateId/activate', authenticate, authorize('SYSTEM_ADMIN'), activateTemplate);
router.post('/:templateId/archive', authenticate, authorize('SYSTEM_ADMIN'), archiveTemplate);

module.exports = router;
