const pool = require('../config/db');
const asyncHandler = require('../utils/asyncHandler');
const createAuditLog = require('../utils/createAuditLog');
const { recalculateBatchStatus } = require('../services/batchStatusService');
const { buildPublicStorageUrl } = require('../utils/storagePath');
const {
  enrichBatchReviewRow,
  filterReviewRows,
  sortReviewRows,
} = require('../utils/reviewPriority');

const PROCESSING_STATUSES = [
  'UPLOADED',
  'QUEUED',
  'EXTRACTING',
  'OCR_PROCESSING',
  'AI_PROCESSING',
  'CANDIDATE_CREATED',
];

const BLOCKING_STATUSES = [
  'UPLOADED',
  'QUEUED',
  'EXTRACTING',
  'OCR_PROCESSING',
  'AI_PROCESSING',
  'NEED_REVIEW',
];

const IMPORTANT_HEADER_KEYS = [
  'expense_date',
  'vendor_name',
  'vendor_business_number',
  'business_number',
  'vendor_phone',
  'expense_category_code',
  'expense_category_name',
  'total_amount',
  'paid_amount',
  'supply_amount',
  'tax_amount',
  'payment_method',
  'card_company',
  'card_number_masked',
  'approval_number',
  'approval_time',
  'note',
];

const DETAIL_FIELD_KEYS = [
  'expense_date',
  'vendor_name',
  'expense_category_code',
  'expense_category_name',
  'item_name',
  'description',
  'quantity',
  'unit_price',
  'amount',
  'payment_method',
  'note',
];

const toNumber = (value, fallback) => {
  const number = Number(value);
  return Number.isFinite(number) && number > 0 ? number : fallback;
};

const toInt = (value) => Number(value || 0);

const toNullableString = (value) => {
  if (value === undefined || value === null) return null;
  const text = String(value).trim();
  return text === '' ? null : text;
};

const parseJsonSafely = (value) => {
  if (!value) return null;
  if (typeof value === 'object') return value;
  try {
    return JSON.parse(value);
  } catch (_error) {
    return null;
  }
};

const normalizeConfidencePercent = (value) => {
  if (value === undefined || value === null || value === '') return null;
  const number = Number(value);
  if (!Number.isFinite(number)) return null;
  if (number <= 1) return Math.round(number * 100);
  return Math.round(number);
};

const buildBatchStatus = (counts = {}) => {
  const total = toInt(counts.totalFileCount);
  const failed = toInt(counts.failedCount);
  const supplement = toInt(counts.needSupplementCount);
  const review = toInt(counts.needReviewCount);
  const processing = toInt(counts.processingCount);
  const normal = toInt(counts.normalCount);
  const confirmed = toInt(counts.confirmedCount);

  if (total === 0) return 'EMPTY';
  if (processing > 0) return 'PROCESSING';
  if (review > 0) return 'NEED_REVIEW';
  if (normal > 0) return 'READY_TO_CONFIRM';
  if (confirmed + supplement + failed === total) return 'REVIEW_COMPLETED';
  if (failed > 0) return 'HAS_FAILED';
  if (supplement > 0) return 'NEED_SUPPLEMENT';
  return 'MIXED';
};

const getStatusHaving = (status) => {
  if (!status) return { sql: '', params: [] };

  if (status === 'PROCESSING') {
    return {
      sql: `HAVING SUM(CASE WHEN sf.status IN (?) THEN 1 ELSE 0 END) > 0`,
      params: [PROCESSING_STATUSES],
    };
  }

  if (status === 'ALL_REVIEW_TARGETS') {
    return {
      sql: `HAVING SUM(CASE WHEN sf.status IN ('NEED_REVIEW', 'NEED_SUPPLEMENT', 'FAILED') THEN 1 ELSE 0 END) > 0`,
      params: [],
    };
  }

  return {
    sql: `HAVING SUM(CASE WHEN sf.status = ? THEN 1 ELSE 0 END) > 0`,
    params: [status],
  };
};

const buildBatchListBaseSql = ({ keyword = '', status = '' } = {}) => {
  const whereParams = [];
  let whereSql = 'WHERE 1 = 1';

  const keywordText = toNullableString(keyword);
  if (keywordText) {
    const like = `%${keywordText}%`;
    whereSql += `
      AND (
        ub.batch_no LIKE ?
        OR ub.title LIKE ?
        OR u.name LIKE ?
        OR d.department_name LIKE ?
        OR site.site_name LIKE ?
        OR t.template_name LIKE ?
        OR sf.original_file_name LIKE ?
      )
    `;
    whereParams.push(like, like, like, like, like, like, like);
  }

  const having = getStatusHaving(status);

  const baseSql = `
    FROM upload_batches ub
    LEFT JOIN source_files sf ON sf.upload_batch_id = ub.id
    LEFT JOIN (
      SELECT
        ev.source_file_id,
        MAX(CASE
          WHEN ev.field_key = 'expense_date' AND COALESCE(ev.row_index, 0) <= 0
          THEN COALESCE(ev.final_value, ev.normalized_value, ev.extracted_value)
          ELSE NULL
        END) AS expenseDate
      FROM extracted_values ev
      WHERE ev.field_key = 'expense_date'
      GROUP BY ev.source_file_id
    ) expense_ev ON expense_ev.source_file_id = sf.id
    LEFT JOIN templates t ON ub.template_id = t.id
    LEFT JOIN departments d ON ub.department_id = d.id
    LEFT JOIN sites site ON ub.site_id = site.id
    LEFT JOIN users u ON ub.submitter_id = u.id
    ${whereSql}
    GROUP BY
      ub.id,
      ub.batch_no,
      ub.title,
      ub.status,
      ub.document_type,
      ub.submitted_at,
      ub.completed_at,
      t.template_name,
      d.department_name,
      site.site_name,
      u.name
    ${having.sql}
  `;

  return {
    baseSql,
    params: [...whereParams, ...having.params],
  };
};

const getReviewBatches = asyncHandler(async (req, res) => {
  const page = toNumber(req.query.page, 1);
  const size = toNumber(req.query.size, 20);
  const status = toNullableString(req.query.status) || '';
  const keyword = toNullableString(req.query.keyword) || '';
  const urgency = toNullableString(req.query.urgency || req.query.urgencyLevel) || '';
  const deadlineStatus = toNullableString(req.query.deadlineStatus) || '';
  const scoreBucket = toNullableString(req.query.scoreBucket) || '';
  const settlementStatus = toNullableString(req.query.settlementStatus || req.query.paymentStatus) || '';
  const dateType = toNullableString(req.query.dateType) || '';
  const datePreset = toNullableString(req.query.datePreset) || '';
  const dateFrom = toNullableString(req.query.dateFrom) || '';
  const dateTo = toNullableString(req.query.dateTo) || '';
  const sort = toNullableString(req.query.sort) || 'urgent';
  const sortBy = toNullableString(req.query.sortBy) || '';
  const sortOrder = toNullableString(req.query.sortOrder) || '';
  const limit = size;
  const offset = (page - 1) * limit;

  const { baseSql, params } = buildBatchListBaseSql({ keyword, status });

  const [batchRows] = await pool.query(
    `
    SELECT
      ub.id AS batchId,
      ub.batch_no AS batchNo,
      ub.title AS batchTitle,
      ub.status AS rawBatchStatus,
      ub.document_type AS documentType,
      ub.submitted_at AS submittedAt,
      ub.completed_at AS completedAt,
      t.template_name AS templateName,
      d.department_name AS departmentName,
      site.site_name AS siteName,
      u.name AS submitterName,

      COUNT(sf.id) AS totalFileCount,
      SUM(CASE WHEN sf.status = 'NORMAL' THEN 1 ELSE 0 END) AS normalCount,
      SUM(CASE WHEN sf.status = 'CONFIRMED' THEN 1 ELSE 0 END) AS confirmedCount,
      SUM(CASE WHEN sf.status = 'NEED_REVIEW' THEN 1 ELSE 0 END) AS needReviewCount,
      SUM(CASE WHEN sf.status = 'NEED_SUPPLEMENT' THEN 1 ELSE 0 END) AS needSupplementCount,
      SUM(CASE WHEN sf.status = 'FAILED' THEN 1 ELSE 0 END) AS failedCount,
      SUM(CASE WHEN sf.status IN (?) THEN 1 ELSE 0 END) AS processingCount,
      AVG(sf.confidence_score) AS avgConfidence,
      MIN(expense_ev.expenseDate) AS expenseDateMinRaw,
      MAX(expense_ev.expenseDate) AS expenseDateMaxRaw,
      MAX(sf.uploaded_at) AS lastUploadedAt,
      MAX(sf.completed_at) AS lastCompletedAt
    ${baseSql}
    `,
    [PROCESSING_STATUSES, ...params]
  );

  const [statusCountRows] = await pool.query(
    `
    SELECT
      COUNT(*) AS allCount,
      SUM(CASE WHEN status = 'NEED_REVIEW' THEN 1 ELSE 0 END) AS needReviewCount,
      SUM(CASE WHEN status = 'NEED_SUPPLEMENT' THEN 1 ELSE 0 END) AS needSupplementCount,
      SUM(CASE WHEN status = 'NORMAL' THEN 1 ELSE 0 END) AS normalCount,
      SUM(CASE WHEN status = 'CONFIRMED' THEN 1 ELSE 0 END) AS confirmedCount,
      SUM(CASE WHEN status = 'FAILED' THEN 1 ELSE 0 END) AS failedCount,
      SUM(CASE WHEN status IN (?) THEN 1 ELSE 0 END) AS processingCount,
      AVG(confidence_score) AS avgConfidence
    FROM source_files
    `,
    [PROCESSING_STATUSES]
  );

  const counts = statusCountRows[0] || {};

  const enrichedRows = batchRows.map((row) => {
    const statusCounts = {
      totalFileCount: toInt(row.totalFileCount),
      normalCount: toInt(row.normalCount),
      confirmedCount: toInt(row.confirmedCount),
      needReviewCount: toInt(row.needReviewCount),
      needSupplementCount: toInt(row.needSupplementCount),
      failedCount: toInt(row.failedCount),
      processingCount: toInt(row.processingCount),
    };

    const baseItem = {
      ...row,
      ...statusCounts,
      avgConfidencePercent: normalizeConfidencePercent(row.avgConfidence),
      batchStatus: buildBatchStatus(statusCounts),
    };

    return enrichBatchReviewRow(baseItem);
  });

  const filteredRows = filterReviewRows(enrichedRows, {
    urgency,
    deadlineStatus,
    scoreBucket,
    settlementStatus,
    dateType,
    datePreset,
    dateFrom,
    dateTo,
  });
  const sortedRows = sortReviewRows(filteredRows, sort, sortBy, sortOrder);
  const items = sortedRows.slice(offset, offset + limit);

  return res.json({
    items,
    page,
    size: limit,
    total: Number(filteredRows.length || 0),
    statusCounts: {
      all: Number(counts.allCount || 0),
      needReview: Number(counts.needReviewCount || 0),
      needSupplement: Number(counts.needSupplementCount || 0),
      normal: Number(counts.normalCount || 0),
      confirmed: Number(counts.confirmedCount || 0),
      failed: Number(counts.failedCount || 0),
      processing: Number(counts.processingCount || 0),
      avgConfidencePercent: normalizeConfidencePercent(counts.avgConfidence),
    },
  });
});

const buildHeaderFields = (fields) => {
  return fields
    .filter((field) => Number(field.rowIndex || 0) <= 0)
    .map((field) => ({
      ...field,
      displayValue:
        field.finalValue ?? field.normalizedValue ?? field.extractedValue ?? '',
    }))
    .sort((a, b) => {
      const aImportant = IMPORTANT_HEADER_KEYS.indexOf(a.fieldKey);
      const bImportant = IMPORTANT_HEADER_KEYS.indexOf(b.fieldKey);
      const safeA = aImportant === -1 ? 999 : aImportant;
      const safeB = bImportant === -1 ? 999 : bImportant;
      if (safeA !== safeB) return safeA - safeB;
      return Number(a.extractedValueId || 0) - Number(b.extractedValueId || 0);
    });
};

const buildSummaryFields = (headerFields) => {
  return headerFields.reduce((map, field) => {
    if (!map[field.fieldKey]) {
      map[field.fieldKey] = field.displayValue;
    }
    return map;
  }, {});
};

const buildDetailItems = (fields) => {
  const itemMap = new Map();

  fields
    .filter((field) => Number(field.rowIndex || 0) > 0)
    .forEach((field) => {
      const rowIndex = Number(field.rowIndex || 0);
      if (!itemMap.has(rowIndex)) {
        itemMap.set(rowIndex, {
          rowIndex,
          fieldIds: {},
          fieldSources: {},
          extractionSource: null,
          isCandidate: false,
          expense_date: '',
          vendor_name: '',
          expense_category_code: '',
          expense_category_name: '',
          item_name: '',
          description: '',
          quantity: '',
          unit_price: '',
          amount: '',
          payment_method: '',
          note: '',
        });
      }

      const item = itemMap.get(rowIndex);
      item[field.fieldKey] =
        field.finalValue ?? field.normalizedValue ?? field.extractedValue ?? '';
      item.fieldIds[field.fieldKey] = field.extractedValueId;
      item.fieldSources[field.fieldKey] = field.extractionSource || null;
      if (!item.extractionSource && field.extractionSource) {
        item.extractionSource = field.extractionSource;
      }
      if (field.extractionSource === 'AI_CANDIDATE') {
        item.isCandidate = true;
        item.extractionSource = 'AI_CANDIDATE';
      }
    });

  return Array.from(itemMap.values()).sort((a, b) => a.rowIndex - b.rowIndex);
};

const getReviewBatchDetail = asyncHandler(async (req, res) => {
  const { batchId } = req.params;

  const [batchRows] = await pool.query(
    `
    SELECT
      ub.id AS batchId,
      ub.batch_no AS batchNo,
      ub.title AS batchTitle,
      ub.status AS rawBatchStatus,
      ub.document_type AS documentType,
      ub.submitted_at AS submittedAt,
      ub.completed_at AS completedAt,
      t.template_name AS templateName,
      d.department_name AS departmentName,
      site.site_name AS siteName,
      u.name AS submitterName,
      u.email AS submitterEmail
    FROM upload_batches ub
    LEFT JOIN templates t ON ub.template_id = t.id
    LEFT JOIN departments d ON ub.department_id = d.id
    LEFT JOIN sites site ON ub.site_id = site.id
    LEFT JOIN users u ON ub.submitter_id = u.id
    WHERE ub.id = ?
    LIMIT 1
    `,
    [batchId]
  );

  if (batchRows.length === 0) {
    return res.status(404).json({ message: '업로드 배치를 찾을 수 없습니다.' });
  }

  const [files] = await pool.query(
    `
    SELECT
      sf.id AS sourceFileId,
      sf.upload_batch_id AS batchId,
      sf.batch_id AS expenseBatchId,
      sf.template_id AS templateId,
      sf.original_file_name AS originalFileName,
      sf.stored_file_name AS storedFileName,
      sf.file_path AS filePath,
      sf.file_type AS fileType,
      sf.mime_type AS mimeType,
      sf.file_size AS fileSize,
      sf.document_type AS documentType,
      sf.status,
      sf.ocr_text AS ocrText,
      sf.ai_raw_json AS aiRawJson,
      sf.confidence_score AS confidenceScore,
      sf.error_message AS errorMessage,
      sf.uploaded_at AS uploadedAt,
      sf.processed_at AS processedAt,
      sf.completed_at AS completedAt
    FROM source_files sf
    WHERE sf.upload_batch_id = ?
    ORDER BY sf.id ASC
    `,
    [batchId]
  );

  const sourceFileIds = files.map((file) => file.sourceFileId);
  let fields = [];
  let validations = [];

  if (sourceFileIds.length > 0) {
    [fields] = await pool.query(
      `
      SELECT
        ev.id AS extractedValueId,
        ev.source_file_id AS sourceFileId,
        ev.field_key AS fieldKey,
        COALESCE(ev.field_label, std.field_label, std.field_name) AS fieldName,
        COALESCE(ev.field_label, std.field_label, std.field_name) AS fieldLabel,
        std.data_type AS dataType,
        ev.row_index AS rowIndex,
        ev.extracted_value AS extractedValue,
        ev.normalized_value AS normalizedValue,
        ev.final_value AS finalValue,
        ev.confidence,
        ev.confidence_score AS confidenceScore,
        ev.extraction_source AS extractionSource,
        ev.is_modified AS isModified
      FROM extracted_values ev
      LEFT JOIN standard_fields std ON ev.standard_field_id = std.id
      WHERE ev.source_file_id IN (?)
      ORDER BY ev.source_file_id ASC, ev.row_index ASC, COALESCE(std.sort_order, 9999) ASC, ev.id ASC
      `,
      [sourceFileIds]
    );

    [validations] = await pool.query(
      `
      SELECT
        val.id AS validationResultId,
        val.source_file_id AS sourceFileId,
        val.field_key AS fieldKey,
        val.rule_code AS ruleCode,
        val.rule_name AS ruleName,
        val.validation_type AS validationType,
        val.result_status AS resultStatus,
        val.status,
        val.message,
        val.severity,
        val.current_value AS currentValue,
        val.expected_value AS expectedValue,
        val.is_resolved AS isResolved
      FROM validation_results val
      WHERE val.source_file_id IN (?)
      ORDER BY val.source_file_id ASC, val.id ASC
      `,
      [sourceFileIds]
    );
  }

  const fieldsByFile = fields.reduce((map, field) => {
    const key = Number(field.sourceFileId);
    if (!map.has(key)) map.set(key, []);
    map.get(key).push(field);
    return map;
  }, new Map());

  const validationsByFile = validations.reduce((map, row) => {
    const key = Number(row.sourceFileId);
    if (!map.has(key)) map.set(key, []);
    map.get(key).push(row);
    return map;
  }, new Map());

  const hydratedFiles = files.map((file) => {
    const fileFields = fieldsByFile.get(Number(file.sourceFileId)) || [];
    const headerFields = buildHeaderFields(fileFields);
    const summaryFields = buildSummaryFields(headerFields);
    const detailItems = buildDetailItems(fileFields);
    const validationResults = validationsByFile.get(Number(file.sourceFileId)) || [];
    const activeValidationResults = validationResults.filter((item) => !item.isResolved);
    const aiRawJson = parseJsonSafely(file.aiRawJson);

    return {
      ...file,
      aiRawJson,
      fileUrl: buildPublicStorageUrl(file.filePath),
      confidencePercent: normalizeConfidencePercent(file.confidenceScore),
      headerFields,
      summaryFields,
      detailItems,
      validationResults,
      activeValidationCount: activeValidationResults.length,
      errorCount: activeValidationResults.filter((item) => item.severity === 'ERROR').length,
      warningCount: activeValidationResults.filter((item) => item.severity !== 'ERROR').length,
    };
  });

  const statusCounts = hydratedFiles.reduce(
    (acc, file) => {
      acc.totalFileCount += 1;
      if (file.status === 'NORMAL') acc.normalCount += 1;
      else if (file.status === 'CONFIRMED') acc.confirmedCount += 1;
      else if (file.status === 'NEED_REVIEW') acc.needReviewCount += 1;
      else if (file.status === 'NEED_SUPPLEMENT') acc.needSupplementCount += 1;
      else if (file.status === 'FAILED') acc.failedCount += 1;
      else if (PROCESSING_STATUSES.includes(file.status)) acc.processingCount += 1;
      return acc;
    },
    {
      totalFileCount: 0,
      normalCount: 0,
      confirmedCount: 0,
      needReviewCount: 0,
      needSupplementCount: 0,
      failedCount: 0,
      processingCount: 0,
    }
  );

  const confidenceValues = hydratedFiles
    .map((file) => normalizeConfidencePercent(file.confidenceScore))
    .filter((value) => value !== null);
  const avgConfidencePercent = confidenceValues.length
    ? Math.round(confidenceValues.reduce((sum, value) => sum + value, 0) / confidenceValues.length)
    : null;

  return res.json({
    batch: {
      ...batchRows[0],
      ...statusCounts,
      avgConfidencePercent,
      batchStatus: buildBatchStatus(statusCounts),
    },
    files: hydratedFiles,
  });
});

const completeReviewBatch = asyncHandler(async (req, res) => {
  const { batchId } = req.params;

  const [batchRows] = await pool.query(
    `SELECT id, batch_no AS batchNo FROM upload_batches WHERE id = ? LIMIT 1`,
    [batchId]
  );

  if (batchRows.length === 0) {
    return res.status(404).json({ message: '업로드 배치를 찾을 수 없습니다.' });
  }

  const [blockingRows] = await pool.query(
    `
    SELECT status, COUNT(*) AS count
    FROM source_files
    WHERE upload_batch_id = ? AND status IN (?)
    GROUP BY status
    `,
    [batchId, BLOCKING_STATUSES]
  );

  if (blockingRows.length > 0) {
    return res.status(400).json({
      message: '검토 필요 또는 AI 처리 중인 파일이 있어 배치 최종완료가 불가합니다. 정상 자료는 파일별 확정완료 처리하고, 불확실한 자료는 보완요청으로 전환해주세요.',
      blockers: blockingRows,
    });
  }

  const connection = await pool.getConnection();

  try {
    await connection.beginTransaction();

    const [fileRows] = await connection.query(
      `SELECT id FROM source_files WHERE upload_batch_id = ?`,
      [batchId]
    );

    const sourceFileIds = fileRows.map((row) => row.id);

    if (sourceFileIds.length === 0) {
      await connection.rollback();
      return res.status(400).json({ message: '확정할 파일이 없습니다.' });
    }

    await connection.query(
      `
      UPDATE source_files
      SET status = 'CONFIRMED', error_message = NULL, completed_at = CURRENT_TIMESTAMP
      WHERE upload_batch_id = ? AND status = 'NORMAL'
      `,
      [batchId]
    );

    await connection.query(
      `
      UPDATE validation_results
      SET is_resolved = TRUE, resolved_by = ?, resolved_at = CURRENT_TIMESTAMP
      WHERE source_file_id IN (?)
      `,
      [req.user.id, sourceFileIds]
    );

    await connection.query(
      `
      UPDATE upload_batches
      SET status = 'REVIEW_COMPLETED', completed_at = CURRENT_TIMESTAMP
      WHERE id = ?
      `,
      [batchId]
    );

    await connection.commit();

    await createAuditLog({
      userId: req.user.id,
      actionType: 'BATCH_REVIEW_COMPLETED',
      targetTable: 'upload_batches',
      targetId: Number(batchId),
      afterData: {
        status: 'REVIEW_COMPLETED',
        fileCount: sourceFileIds.length,
      },
      ipAddress: req.ip,
    });

    // 배치 최종완료 상태는 위 트랜잭션에서 REVIEW_COMPLETED로 명시 저장한다.

    return res.json({
      batchId: Number(batchId),
      status: 'REVIEW_COMPLETED',
      completedFileCount: sourceFileIds.length,
      message: '배치 검토가 최종완료되었습니다.',
    });
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
});

module.exports = {
  getReviewBatches,
  getReviewBatchDetail,
  completeReviewBatch,
};
