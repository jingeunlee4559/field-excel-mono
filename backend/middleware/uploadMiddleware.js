const path = require('path');
const multer = require('multer');

const {
  ensureDir,
  getAiStorageRoot,
  getUploadsDir,
  getTemplatesDir,
  toStorageRelativePath,
  normalizeUploadedFilePath,
  resolveFromBackendRoot,
} = require('../utils/storagePath');

/**
 * multer에서 한글 파일명이 깨져 들어오는 경우 보정
 */
const fixKoreanFilename = (filename = '') => {
  if (!filename) return '';

  try {
    const decoded = Buffer.from(filename, 'latin1').toString('utf8');
    const looksBroken = /[ÃÂêëìíîïð]/.test(filename);

    return looksBroken ? decoded : filename;
  } catch {
    return filename;
  }
};

const sanitizeBaseName = (baseName = '') => {
  return baseName
    .replace(/\s+/g, '_')
    .replace(/[^a-zA-Z0-9가-힣ㄱ-ㅎㅏ-ㅣ_-]/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 80);
};

const createStorage = (getTargetDir) => {
  const absoluteTargetDir = getTargetDir();

  ensureDir(absoluteTargetDir);

  return multer.diskStorage({
    destination: (req, file, cb) => {
      cb(null, absoluteTargetDir);
    },

    filename: (req, file, cb) => {
      const fixedOriginalName = fixKoreanFilename(file.originalname);
      const ext = path.extname(fixedOriginalName).toLowerCase();
      const baseName = path.basename(fixedOriginalName, ext);
      const safeBaseName = sanitizeBaseName(baseName) || 'uploaded_file';

      file.originalname = fixedOriginalName;
      file.fixedOriginalName = fixedOriginalName;

      cb(null, `${Date.now()}_${safeBaseName}${ext}`);
    },
  });
};

const buildFileFilter = (allowedMimeTypes, allowedExtensions, message) => {
  return (req, file, cb) => {
    const fixedOriginalName = fixKoreanFilename(file.originalname);
    const extension = path.extname(fixedOriginalName).toLowerCase();

    const mimeMatched = allowedMimeTypes.includes(file.mimetype);
    const extensionMatched = allowedExtensions.includes(extension);

    if (mimeMatched || extensionMatched) {
      file.originalname = fixedOriginalName;
      file.fixedOriginalName = fixedOriginalName;
      return cb(null, true);
    }

    return cb(new Error(message));
  };
};

const receiptFileFilter = buildFileFilter(
  ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'],
  ['.jpg', '.jpeg', '.png', '.webp', '.pdf'],
  '원천자료는 이미지(JPG/PNG/WEBP) 또는 PDF만 업로드할 수 있습니다.'
);

const templateFileFilter = buildFileFilter(
  [
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/vnd.ms-excel.sheet.macroEnabled.12',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.template',
    'application/vnd.ms-excel.template.macroEnabled.12',
    'application/vnd.ms-excel',
  ],
  ['.xlsx', '.xlsm', '.xltx', '.xltm', '.xls'],
  '엑셀 템플릿은 XLSX, XLSM, XLTX, XLTM 또는 XLS 파일만 업로드할 수 있습니다.'
);

const receiptUpload = multer({
  storage: createStorage(getUploadsDir),
  fileFilter: receiptFileFilter,
  limits: {
    fileSize: 20 * 1024 * 1024,
  },
});

const templateUpload = multer({
  storage: createStorage(getTemplatesDir),
  fileFilter: templateFileFilter,
  limits: {
    fileSize: 20 * 1024 * 1024,
  },
});

module.exports = {
  receiptUpload,
  templateUpload,
  fixKoreanFilename,
  resolveFromBackend: resolveFromBackendRoot,
  getAiStorageRoot,
  toStorageRelativePath,
  normalizeUploadedFilePath,
};
