const pool = require('../config/db');
const asyncHandler = require('../utils/asyncHandler');
const createAuditLog = require('../utils/createAuditLog');

const VALID_TYPES = new Set(['VENDOR', 'ITEM', 'PAYMENT', 'CATEGORY', 'OCR_TEXT']);
const VALID_MATCH_TYPES = new Set(['EXACT', 'CONTAINS', 'FUZZY']);
const VALID_STATUSES = new Set(['PENDING', 'APPROVED', 'REJECTED', 'DISABLED']);

const normalizeEnum = (value, fallback) => String(value || fallback || '').trim().toUpperCase();
const normalizeText = (value, fallback = '') => String(value ?? fallback).trim();

const isSystemAdmin = (req) => req.user?.roleCode === 'SYSTEM_ADMIN';

const normalizeSimilarity = (value) => {
  if (value === null || value === undefined || value === '') return null;
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return null;
  return Math.max(0, Math.min(1, parsed));
};

const getCorrectionById = async (id) => {
  const [rows] = await pool.query(
    `
    SELECT
      id,
      dictionary_type AS dictionaryType,
      wrong_text AS wrongText,
      corrected_text AS correctedText,
      match_type AS matchType,
      min_similarity AS minSimilarity,
      document_type AS documentType,
      priority,
      status,
      active_yn AS activeYn,
      description,
      suggested_by AS suggestedBy,
      created_by AS createdBy,
      approved_by AS approvedBy,
      approved_at AS approvedAt,
      created_at AS createdAt,
      updated_at AS updatedAt
    FROM correction_dictionaries
    WHERE id = ?
    LIMIT 1
    `,
    [id]
  );

  return rows[0] || null;
};

const getCorrections = asyncHandler(async (req, res) => {
  const dictionaryType = normalizeEnum(req.query.dictionaryType, '');
  const status = normalizeEnum(req.query.status, '');
  const activeYn = normalizeEnum(req.query.activeYn, '');
  const q = normalizeText(req.query.q);

  const params = [];
  let sql = `
    SELECT
      cd.id,
      cd.dictionary_type AS dictionaryType,
      cd.wrong_text AS wrongText,
      cd.corrected_text AS correctedText,
      cd.match_type AS matchType,
      cd.min_similarity AS minSimilarity,
      cd.document_type AS documentType,
      cd.priority,
      cd.status,
      cd.active_yn AS activeYn,
      cd.description,
      cd.suggested_by AS suggestedBy,
      cd.created_by AS createdBy,
      creator.name AS createdByName,
      cd.approved_by AS approvedBy,
      approver.name AS approvedByName,
      cd.approved_at AS approvedAt,
      cd.created_at AS createdAt,
      cd.updated_at AS updatedAt
    FROM correction_dictionaries cd
    LEFT JOIN users creator ON cd.created_by = creator.id
    LEFT JOIN users approver ON cd.approved_by = approver.id
    WHERE 1 = 1
  `;

  if (dictionaryType && VALID_TYPES.has(dictionaryType)) {
    sql += ' AND cd.dictionary_type = ?';
    params.push(dictionaryType);
  }

  if (status && VALID_STATUSES.has(status)) {
    sql += ' AND cd.status = ?';
    params.push(status);
  }

  if (activeYn === 'Y' || activeYn === 'N') {
    sql += ' AND cd.active_yn = ?';
    params.push(activeYn);
  }

  if (q) {
    sql += ' AND (cd.wrong_text LIKE ? OR cd.corrected_text LIKE ? OR cd.description LIKE ?)';
    const like = `%${q}%`;
    params.push(like, like, like);
  }

  sql += ' ORDER BY cd.dictionary_type ASC, cd.priority ASC, cd.id DESC';

  const [rows] = await pool.query(sql, params);
  return res.json({ success: true, data: rows });
});

const createCorrection = asyncHandler(async (req, res) => {
  const dictionaryType = normalizeEnum(req.body.dictionaryType, 'VENDOR');
  const matchType = normalizeEnum(req.body.matchType, 'EXACT');
  const requestedStatus = normalizeEnum(req.body.status, 'PENDING');
  const status = isSystemAdmin(req) ? requestedStatus : 'PENDING';

  const wrongText = normalizeText(req.body.wrongText);
  const correctedText = normalizeText(req.body.correctedText);
  const documentType = normalizeEnum(req.body.documentType, 'RECEIPT');
  const priority = Number(req.body.priority || 100);
  const description = req.body.description ? normalizeText(req.body.description) : null;
  const minSimilarity = normalizeSimilarity(req.body.minSimilarity);

  if (!VALID_TYPES.has(dictionaryType)) {
    return res.status(400).json({ message: 'dictionaryType 값이 올바르지 않습니다.' });
  }
  if (!VALID_MATCH_TYPES.has(matchType)) {
    return res.status(400).json({ message: 'matchType 값이 올바르지 않습니다.' });
  }
  if (!VALID_STATUSES.has(status)) {
    return res.status(400).json({ message: 'status 값이 올바르지 않습니다.' });
  }
  if (!wrongText || !correctedText) {
    return res.status(400).json({ message: 'wrongText와 correctedText는 필수입니다.' });
  }

  const activeYn = status === 'APPROVED' ? 'Y' : 'N';
  const approvedBy = status === 'APPROVED' ? req.user?.id || null : null;
  const approvedAt = status === 'APPROVED' ? new Date() : null;

  const afterData = {
    dictionaryType,
    wrongText,
    correctedText,
    matchType,
    minSimilarity,
    documentType,
    priority: Number.isFinite(priority) ? priority : 100,
    status,
    activeYn,
    suggestedBy: req.body.suggestedBy || 'USER',
    description,
    createdBy: req.user?.id || null,
    approvedBy,
  };

  const [result] = await pool.query(
    `
    INSERT INTO correction_dictionaries
    (
      dictionary_type,
      wrong_text,
      corrected_text,
      match_type,
      min_similarity,
      document_type,
      priority,
      status,
      active_yn,
      suggested_by,
      description,
      created_by,
      approved_by,
      approved_at
    )
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `,
    [
      dictionaryType,
      wrongText,
      correctedText,
      matchType,
      minSimilarity,
      documentType,
      afterData.priority,
      status,
      activeYn,
      afterData.suggestedBy,
      description,
      req.user?.id || null,
      approvedBy,
      approvedAt,
    ]
  );

  await createAuditLog({
    userId: req.user?.id,
    actionType: 'CORRECTION_CREATED',
    targetTable: 'correction_dictionaries',
    targetId: result.insertId,
    afterData: { id: result.insertId, ...afterData },
    ipAddress: req.ip,
    userAgent: req.get('user-agent'),
  });

  return res.status(201).json({ success: true, data: { id: result.insertId, status, activeYn } });
});

const updateCorrection = asyncHandler(async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id <= 0) {
    return res.status(400).json({ message: 'id가 올바르지 않습니다.' });
  }

  const beforeData = await getCorrectionById(id);
  if (!beforeData) {
    return res.status(404).json({ message: '보정 사전 항목을 찾을 수 없습니다.' });
  }

  const fields = [];
  const params = [];

  if (Object.prototype.hasOwnProperty.call(req.body, 'dictionaryType')) {
    const dictionaryType = normalizeEnum(req.body.dictionaryType, beforeData.dictionaryType);
    if (!VALID_TYPES.has(dictionaryType)) {
      return res.status(400).json({ message: 'dictionaryType 값이 올바르지 않습니다.' });
    }
    fields.push('dictionary_type = ?');
    params.push(dictionaryType);
  }

  if (Object.prototype.hasOwnProperty.call(req.body, 'wrongText')) {
    const wrongText = normalizeText(req.body.wrongText);
    if (!wrongText) return res.status(400).json({ message: 'wrongText는 필수입니다.' });
    fields.push('wrong_text = ?');
    params.push(wrongText);
  }

  if (Object.prototype.hasOwnProperty.call(req.body, 'correctedText')) {
    const correctedText = normalizeText(req.body.correctedText);
    if (!correctedText) return res.status(400).json({ message: 'correctedText는 필수입니다.' });
    fields.push('corrected_text = ?');
    params.push(correctedText);
  }

  if (Object.prototype.hasOwnProperty.call(req.body, 'matchType')) {
    const matchType = normalizeEnum(req.body.matchType, beforeData.matchType);
    if (!VALID_MATCH_TYPES.has(matchType)) {
      return res.status(400).json({ message: 'matchType 값이 올바르지 않습니다.' });
    }
    fields.push('match_type = ?');
    params.push(matchType);
  }

  if (Object.prototype.hasOwnProperty.call(req.body, 'minSimilarity')) {
    fields.push('min_similarity = ?');
    params.push(normalizeSimilarity(req.body.minSimilarity));
  }

  if (Object.prototype.hasOwnProperty.call(req.body, 'documentType')) {
    fields.push('document_type = ?');
    params.push(normalizeEnum(req.body.documentType, 'RECEIPT'));
  }

  if (Object.prototype.hasOwnProperty.call(req.body, 'priority')) {
    const priority = Number(req.body.priority || 100);
    fields.push('priority = ?');
    params.push(Number.isFinite(priority) ? priority : 100);
  }

  if (Object.prototype.hasOwnProperty.call(req.body, 'description')) {
    fields.push('description = ?');
    params.push(req.body.description ? normalizeText(req.body.description) : null);
  }

  if (Object.prototype.hasOwnProperty.call(req.body, 'activeYn')) {
    if (!isSystemAdmin(req)) {
      return res.status(403).json({ message: '보정 사전 활성 상태 변경은 시스템 관리자만 가능합니다.' });
    }
    const activeYn = normalizeEnum(req.body.activeYn, 'N');
    if (activeYn !== 'Y' && activeYn !== 'N') {
      return res.status(400).json({ message: 'activeYn 값이 올바르지 않습니다.' });
    }
    fields.push('active_yn = ?');
    params.push(activeYn);
  }

  if (Object.prototype.hasOwnProperty.call(req.body, 'status')) {
    if (!isSystemAdmin(req)) {
      return res.status(403).json({ message: '보정 사전 승인 상태 변경은 시스템 관리자만 가능합니다.' });
    }

    const status = normalizeEnum(req.body.status, 'PENDING');
    if (!VALID_STATUSES.has(status)) {
      return res.status(400).json({ message: 'status 값이 올바르지 않습니다.' });
    }

    fields.push('status = ?');
    params.push(status);

    if (status === 'APPROVED') {
      fields.push('active_yn = ?', 'approved_by = ?', 'approved_at = CURRENT_TIMESTAMP');
      params.push('Y', req.user?.id || null);
    } else {
      fields.push('active_yn = ?', 'approved_by = NULL', 'approved_at = NULL');
      params.push('N');
    }
  }

  if (fields.length === 0) {
    return res.status(400).json({ message: '수정할 값이 없습니다.' });
  }

  params.push(id);
  await pool.query(`UPDATE correction_dictionaries SET ${fields.join(', ')} WHERE id = ?`, params);

  const afterData = await getCorrectionById(id);

  await createAuditLog({
    userId: req.user?.id,
    actionType: 'CORRECTION_UPDATED',
    targetTable: 'correction_dictionaries',
    targetId: id,
    beforeData,
    afterData,
    ipAddress: req.ip,
    userAgent: req.get('user-agent'),
  });

  return res.json({ success: true });
});

const approveCorrection = asyncHandler(async (req, res) => {
  if (!isSystemAdmin(req)) {
    return res.status(403).json({ message: '보정 사전 승인은 시스템 관리자만 가능합니다.' });
  }

  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id <= 0) {
    return res.status(400).json({ message: 'id가 올바르지 않습니다.' });
  }

  const beforeData = await getCorrectionById(id);
  if (!beforeData) {
    return res.status(404).json({ message: '보정 사전 항목을 찾을 수 없습니다.' });
  }

  await pool.query(
    `
    UPDATE correction_dictionaries
    SET status = 'APPROVED', active_yn = 'Y', approved_by = ?, approved_at = CURRENT_TIMESTAMP
    WHERE id = ?
    `,
    [req.user?.id || null, id]
  );

  const afterData = await getCorrectionById(id);

  await createAuditLog({
    userId: req.user?.id,
    actionType: 'CORRECTION_APPROVED',
    targetTable: 'correction_dictionaries',
    targetId: id,
    beforeData,
    afterData,
    ipAddress: req.ip,
    userAgent: req.get('user-agent'),
  });

  return res.json({ success: true });
});

const disableCorrection = asyncHandler(async (req, res) => {
  if (!isSystemAdmin(req)) {
    return res.status(403).json({ message: '보정 사전 비활성화는 시스템 관리자만 가능합니다.' });
  }

  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id <= 0) {
    return res.status(400).json({ message: 'id가 올바르지 않습니다.' });
  }

  const beforeData = await getCorrectionById(id);
  if (!beforeData) {
    return res.status(404).json({ message: '보정 사전 항목을 찾을 수 없습니다.' });
  }

  await pool.query(
    `
    UPDATE correction_dictionaries
    SET status = 'DISABLED', active_yn = 'N', approved_by = NULL, approved_at = NULL
    WHERE id = ?
    `,
    [id]
  );

  const afterData = await getCorrectionById(id);

  await createAuditLog({
    userId: req.user?.id,
    actionType: 'CORRECTION_DISABLED',
    targetTable: 'correction_dictionaries',
    targetId: id,
    beforeData,
    afterData,
    ipAddress: req.ip,
    userAgent: req.get('user-agent'),
  });

  return res.json({ success: true });
});

module.exports = {
  getCorrections,
  createCorrection,
  updateCorrection,
  approveCorrection,
  disableCorrection,
};
