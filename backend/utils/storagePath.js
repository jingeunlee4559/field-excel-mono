const fs = require('fs');
const path = require('path');

const BACKEND_ROOT = path.resolve(__dirname, '..');
const PROJECT_ROOT = path.resolve(BACKEND_ROOT, '..');
const DEFAULT_AI_STORAGE_ROOT = path.resolve(
  PROJECT_ROOT,
  'ai-server',
  'app',
  'storage'
);
const LEGACY_APP_STORAGE_ROOT = path.resolve(PROJECT_ROOT, 'app', 'storage');

const STORAGE_RELATIVE_PREFIX = 'app/storage/';

const normalizeSlash = (value = '') => String(value || '').replace(/\\/g, '/');

const trimTrailingSlash = (value = '') => normalizeSlash(value).replace(/\/+$/, '');

const isDeprecatedStoragePath = (value) => {
  const normalized = trimTrailingSlash(value).replace(/^\.\//, '');

  return (
    normalized === '../app/storage' ||
    normalized === 'app/storage' ||
    normalized === './app/storage' ||
    normalized.startsWith('../app/storage/') ||
    normalized.startsWith('app/storage/') ||
    normalized.startsWith('./app/storage/')
  );
};

const resolveFromBackendRoot = (inputPath) => {
  if (!inputPath) return null;

  const rawPath = String(inputPath).trim();
  const normalized = normalizeSlash(rawPath);

  if (!normalized) return null;

  if (path.isAbsolute(normalized)) {
    return path.normalize(normalized);
  }

  return path.resolve(BACKEND_ROOT, normalized);
};

const getAiStorageRoot = () => {
  const configured = process.env.AI_STORAGE_ROOT;

  if (!configured || isDeprecatedStoragePath(configured)) {
    return DEFAULT_AI_STORAGE_ROOT;
  }

  return resolveFromBackendRoot(configured);
};

const getStorageDir = (subDir) => path.join(getAiStorageRoot(), subDir);

const resolveConfiguredStorageDir = (configuredPath, subDir) => {
  if (!configuredPath || isDeprecatedStoragePath(configuredPath)) {
    return getStorageDir(subDir);
  }

  return resolveFromBackendRoot(configuredPath);
};

const getUploadsDir = () => resolveConfiguredStorageDir(process.env.UPLOAD_RECEIPT_DIR, 'uploads');
const getTemplatesDir = () => resolveConfiguredStorageDir(process.env.UPLOAD_TEMPLATE_DIR, 'templates');
const getResultsDir = () =>
  resolveConfiguredStorageDir(
    process.env.GENERATED_EXCEL_DIR || process.env.UPLOAD_GENERATED_DIR,
    'results'
  );

const ensureDir = (dirPath) => {
  if (!dirPath) return;

  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }
};

const extractRelativeFromStorage = (storedPath) => {
  const normalized = normalizeSlash(storedPath).replace(/^\/+/, '');

  if (!normalized) return null;

  const storageIndex = normalized.indexOf(STORAGE_RELATIVE_PREFIX);

  if (storageIndex >= 0) {
    return normalized.slice(storageIndex + STORAGE_RELATIVE_PREFIX.length).replace(/^\/+/, '');
  }

  if (/^(uploads|templates|results)\//.test(normalized)) {
    return normalized;
  }

  return null;
};

const toStorageRelativePath = (absoluteFilePath) => {
  if (!absoluteFilePath) return null;

  const normalizedAbsolute = normalizeSlash(path.resolve(absoluteFilePath));
  const normalizedStorageRoot = trimTrailingSlash(getAiStorageRoot());

  if (normalizedAbsolute.startsWith(`${normalizedStorageRoot}/`)) {
    const relativeFromStorage = normalizedAbsolute
      .slice(normalizedStorageRoot.length)
      .replace(/^\/+/, '');

    return `${STORAGE_RELATIVE_PREFIX}${relativeFromStorage}`.replace(/\\/g, '/');
  }

  const relativeFromStorage = extractRelativeFromStorage(normalizedAbsolute);

  if (relativeFromStorage) {
    return `${STORAGE_RELATIVE_PREFIX}${relativeFromStorage}`.replace(/\\/g, '/');
  }

  return normalizeSlash(path.relative(PROJECT_ROOT, absoluteFilePath));
};

const normalizeUploadedFilePath = (file) => {
  if (!file || !file.path) return null;

  return toStorageRelativePath(file.path);
};

const getCandidateStoragePaths = (storedPath, fallbackSubDir = '') => {
  if (!storedPath) return [];

  const normalized = normalizeSlash(storedPath);
  const candidates = [];
  const relativeFromStorage = extractRelativeFromStorage(normalized);

  if (path.isAbsolute(normalized)) {
    candidates.push(path.normalize(normalized));
  }

  if (relativeFromStorage) {
    candidates.push(path.join(getAiStorageRoot(), relativeFromStorage));

    if (fs.existsSync(LEGACY_APP_STORAGE_ROOT)) {
      candidates.push(path.join(LEGACY_APP_STORAGE_ROOT, relativeFromStorage));
    }
  }

  if (!path.isAbsolute(normalized)) {
    candidates.push(path.resolve(BACKEND_ROOT, normalized));
    candidates.push(path.resolve(PROJECT_ROOT, normalized));
  }

  if (!relativeFromStorage && fallbackSubDir) {
    candidates.push(path.join(getAiStorageRoot(), fallbackSubDir, path.basename(normalized)));
  }

  return [...new Set(candidates.map((candidate) => path.normalize(candidate)))];
};

const resolveStorageFilePath = (storedPath, fallbackSubDir = '') => {
  const candidates = getCandidateStoragePaths(storedPath, fallbackSubDir);

  for (const candidate of candidates) {
    if (fs.existsSync(candidate)) {
      return candidate;
    }
  }

  return candidates[0] || null;
};

const buildPublicStorageUrl = (storedPath) => {
  const relativeFromStorage = extractRelativeFromStorage(storedPath);

  if (!relativeFromStorage) return null;

  return `/ai-storage/${relativeFromStorage.replace(/^\/+/, '')}`;
};

module.exports = {
  BACKEND_ROOT,
  PROJECT_ROOT,
  DEFAULT_AI_STORAGE_ROOT,
  LEGACY_APP_STORAGE_ROOT,
  STORAGE_RELATIVE_PREFIX,
  normalizeSlash,
  resolveFromBackendRoot,
  getAiStorageRoot,
  getUploadsDir,
  getTemplatesDir,
  getResultsDir,
  ensureDir,
  toStorageRelativePath,
  normalizeUploadedFilePath,
  resolveStorageFilePath,
  buildPublicStorageUrl,
  getCandidateStoragePaths,
};
