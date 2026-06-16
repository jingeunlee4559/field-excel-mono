const pool = require('../config/db');
const asyncHandler = require('../utils/asyncHandler');
const createAuditLog = require('../utils/createAuditLog');
const { recalculateBatchStatus } = require('../services/batchStatusService');
const { buildPublicStorageUrl } = require('../utils/storagePath');
const {
  normalizeConfidencePercent,
  enrichFileReviewRow,
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

const toNumber = (value, fallback) => {
  const number = Number(value);
  return Number.isFinite(number) && number > 0 ? number : fallback;
};


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

const toNullableString = (value) => {
  if (value === undefined || value === null) return null;
  const text = String(value).trim();
  return text === '' ? null : text;
};

const normalizeAmountText = (value) => {
  const text = toNullableString(value);
  if (!text) return null;
  return text.replace(/[원,\s₩]/g, '');
};

const parseAmount = (value) => {
  const text = normalizeAmountText(value);
  if (!text) return 0;
  const number = Number(text);
  return Number.isFinite(number) ? number : 0;
};

const normalizeDetailItems = (items = []) => {
  if (!Array.isArray(items)) return [];

  return items
    .map((item, index) => ({
      rowIndex: toNumber(item.rowIndex, index + 1),
      expense_date: toNullableString(item.expenseDate || item.expense_date),
      vendor_name: toNullableString(item.vendorName || item.vendor_name),
      expense_category_code: toNullableString(item.expenseCategoryCode || item.expense_category_code),
      expense_category_name: toNullableString(
        item.expenseCategoryName ||
          item.expense_category_name ||
          item.expenseItem ||
          item.expense_item
      ),
      item_name: toNullableString(item.itemName || item.item_name),
      description: toNullableString(item.description || item.itemDescription || item.item_description),
      quantity: normalizeAmountText(item.quantity),
      unit_price: normalizeAmountText(item.unitPrice || item.unit_price),
      amount: normalizeAmountText(item.amount),
      payment_method: toNullableString(item.paymentMethod || item.payment_method),
      note: toNullableString(item.note),
      edit_status: toNullableString(item.editStatus || item.edit_status) || 'MANUAL_EDITED',
      field_ids: item.fieldIds || item.field_ids || {},
    }))
    .filter((item) => {
      return DETAIL_FIELD_KEYS.some((key) => item[key] !== null && item[key] !== '');
    })
    .map((item, index) => ({ ...item, rowIndex: index + 1 }));
};

const loadStandardFieldMap = async (connection) => {
  const [rows] = await connection.query(
    `
    SELECT id, field_key AS fieldKey, field_label AS fieldLabel
    FROM standard_fields
    WHERE field_key IN (?) AND is_active = TRUE
    `,
    [DETAIL_FIELD_KEYS]
  );

  return rows.reduce((map, row) => {
    map.set(row.fieldKey, row);
    return map;
  }, new Map());
};

const resolveExpenseCategory = async (connection, item) => {
  const code = toNullableString(item.expense_category_code);
  const name = toNullableString(item.expense_category_name);

  if (!code && !name) return null;

  const params = [];
  const conditions = [];

  if (code) {
    conditions.push('category_code = ?');
    params.push(code);
  }

  if (name) {
    conditions.push('category_name = ?');
    params.push(name);
  }

  const [rows] = await connection.query(
    `
    SELECT id, category_code AS categoryCode, category_name AS categoryName
    FROM expense_categories
    WHERE is_active = TRUE AND (${conditions.join(' OR ')})
    ORDER BY FIELD(category_code, ?), id ASC
    LIMIT 1
    `,
    [...params, code || '']
  );

  return rows[0] || null;
};

const buildDetailFieldValues = (item, category) => {
  const categoryName = category?.categoryName || item.expense_category_name;
  const categoryCode = category?.categoryCode || item.expense_category_code;

  return {
    expense_date: item.expense_date,
    vendor_name: item.vendor_name,
    expense_category_code: categoryCode,
    expense_category_name: categoryName,
    item_name: item.item_name,
    description: item.description || item.item_name,
    quantity: item.quantity,
    unit_price: item.unit_price,
    amount: item.amount,
    payment_method: item.payment_method,
    note: item.note,
  };
};

const calculateDetailTotal = (items) => {
  return items.reduce((sum, item) => sum + parseAmount(item.amount), 0);
};

const getRequiredReviews = asyncHandler(async (req, res) => {
  const {
    status,
    keyword,
    urgency = '',
    urgencyLevel = '',
    deadlineStatus = '',
    scoreBucket = '',
    settlementStatus = '',
    dateType = '',
    datePreset = '',
    dateFrom = '',
    dateTo = '',
    sort = 'urgent',
    sortBy = '',
    sortOrder = '',
  } = req.query;

  const page = toNumber(req.query.page, 1);
  const size = toNumber(req.query.size, 20);
  const limit = size;
  const offset = (page - 1) * limit;

  const whereParams = [];
  let whereSql = 'WHERE 1 = 1';

  /**
   * status가 있을 때만 필터링한다.
   * PROCESSING은 여러 처리 중 상태를 하나로 묶어 필터링한다.
   */
  if (status === 'PROCESSING') {
    whereSql += ' AND sf.status IN (?)';
    whereParams.push(PROCESSING_STATUSES);
  } else if (status) {
    whereSql += ' AND sf.status = ?';
    whereParams.push(status);
  }

  if (keyword) {
    whereSql += `
      AND (
        sf.original_file_name LIKE ?
        OR eb.batch_no LIKE ?
        OR eb.title LIKE ?
        OR u.name LIKE ?
        OR d.department_name LIKE ?
        OR site.site_name LIKE ?
        OR sf.error_message LIKE ?
      )
    `;

    const likeKeyword = `%${keyword}%`;

    whereParams.push(
      likeKeyword,
      likeKeyword,
      likeKeyword,
      likeKeyword,
      likeKeyword,
      likeKeyword,
      likeKeyword
    );
  }

  /**
   * 마감일/긴급도/점수 구간은 OCR 추출값과 회사 기준일을 함께 계산해야 하므로
   * SQL에서 바로 LIMIT 하지 않고 후보를 조회한 뒤 서버에서 계산/필터/정렬한다.
   * 데이터가 커질 경우 source_files에 deadline_date, urgency_rank를 저장해 SQL 정렬로 전환하면 된다.
   */
  const [rawItems] = await pool.query(
    `
    SELECT 
      sf.id AS sourceFileId,
      eb.id AS batchId,
      eb.batch_no AS batchNo,
      sf.original_file_name AS originalFileName,
      sf.file_path AS filePath,
      sf.mime_type AS mimeType,
      sf.status,
      sf.error_message AS reason,
      sf.confidence_score AS confidenceScore,
      sf.error_message AS errorMessage,
      sf.uploaded_at AS uploadedAt,
      sf.completed_at AS completedAt,

      expense_ev.expenseDate AS expenseDateRaw,

      eb.title AS batchTitle,
      eb.document_type AS documentType,
      eb.template_id AS templateId,

      t.template_name AS templateName,
      d.department_name AS departmentName,
      site.site_name AS siteName,
      u.name AS submitterName,

      CASE
        WHEN sf.status = 'NEED_REVIEW' THEN COALESCE(sf.error_message, '검토가 필요한 항목입니다.')
        WHEN sf.status = 'NEED_SUPPLEMENT' THEN COALESCE(sf.error_message, '증빙 보완이 필요한 항목입니다.')
        WHEN sf.status = 'FAILED' THEN COALESCE(sf.error_message, '처리 중 오류가 발생했습니다.')
        WHEN sf.status = 'QUEUED' THEN 'AI 처리 대기 중입니다.'
        WHEN sf.status = 'UPLOADED' THEN '업로드 접수 상태입니다.'
        WHEN sf.status = 'EXTRACTING' THEN 'AI 처리 중입니다.'
        WHEN sf.status = 'OCR_PROCESSING' THEN 'OCR 처리 중입니다.'
        WHEN sf.status = 'AI_PROCESSING' THEN 'AI 처리 중입니다.'
        WHEN sf.status = 'NORMAL' THEN '정상 처리되었습니다.'
        WHEN sf.status = 'CONFIRMED' THEN '확정 완료되었습니다.'
        ELSE COALESCE(sf.error_message, '-')
      END AS statusMessage
    FROM source_files sf
    JOIN upload_batches eb ON sf.upload_batch_id = eb.id
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
    LEFT JOIN templates t ON eb.template_id = t.id
    LEFT JOIN departments d ON eb.department_id = d.id
    LEFT JOIN sites site ON eb.site_id = site.id
    LEFT JOIN users u ON eb.submitter_id = u.id
    ${whereSql}
    `,
    whereParams
  );

  const enrichedItems = rawItems.map(enrichFileReviewRow);
  const filteredItems = filterReviewRows(enrichedItems, {
    urgency: urgency || urgencyLevel,
    deadlineStatus,
    scoreBucket,
    settlementStatus,
    dateType,
    datePreset,
    dateFrom,
    dateTo,
  });
  const sortedItems = sortReviewRows(filteredItems, sort, sortBy, sortOrder);
  const items = sortedItems.slice(offset, offset + limit);

  /**
   * 요약 카드는 현재 필터가 아니라 전체 DB 기준으로 집계한다.
   */
  const [statusCountRows] = await pool.query(
    `
    SELECT
      COUNT(*) AS allCount,
      SUM(CASE WHEN status = 'NEED_REVIEW' THEN 1 ELSE 0 END) AS needReviewCount,
      SUM(CASE WHEN status = 'NEED_SUPPLEMENT' THEN 1 ELSE 0 END) AS needSupplementCount,
      SUM(CASE WHEN status = 'NORMAL' THEN 1 ELSE 0 END) AS normalCount,
      SUM(CASE WHEN status = 'CONFIRMED' THEN 1 ELSE 0 END) AS confirmedCount,
      SUM(CASE WHEN status = 'FAILED' THEN 1 ELSE 0 END) AS failedCount,
      SUM(
        CASE 
          WHEN status IN (?) 
          THEN 1 
          ELSE 0 
        END
      ) AS extractingCount,
      AVG(confidence_score) AS avgConfidence
    FROM source_files
    `,
    [PROCESSING_STATUSES]
  );

  const counts = statusCountRows[0] || {};

  return res.json({
    items,
    page,
    size: limit,
    total: Number(filteredItems.length || 0),
    statusCounts: {
      all: Number(counts.allCount || 0),
      needReview: Number(counts.needReviewCount || 0),
      needSupplement: Number(counts.needSupplementCount || 0),
      normal: Number(counts.normalCount || 0),
      confirmed: Number(counts.confirmedCount || 0),
      failed: Number(counts.failedCount || 0),
      extracting: Number(counts.extractingCount || 0),
      avgConfidencePercent: normalizeConfidencePercent(counts.avgConfidence),
    },
  });
});

const getSupplementRequiredList = asyncHandler(async (req, res) => {
  req.query.status = 'NEED_SUPPLEMENT';
  return getRequiredReviews(req, res);
});

const getReviewDetail = asyncHandler(async (req, res) => {
  const { sourceFileId } = req.params;

  const [fileRows] = await pool.query(
    `
    SELECT
      sf.id AS sourceFileId,
      sf.upload_batch_id AS batchId,
      eb.batch_no AS batchNo,
      sf.original_file_name AS originalFileName,
      sf.file_path AS filePath,
      sf.mime_type AS mimeType,
      sf.file_size AS fileSize,
      sf.status,
      sf.ocr_text AS ocrText,
      sf.ai_raw_json AS aiRawJson,
      sf.confidence_score AS confidenceScore,
      sf.error_message AS errorMessage,
      sf.uploaded_at AS uploadedAt,
      sf.completed_at AS completedAt,

      eb.title AS batchTitle,
      eb.document_type AS documentType,
      eb.template_id AS templateId,

      t.template_name AS templateName,
      d.department_name AS departmentName,
      site.site_name AS siteName,
      u.name AS submitterName
    FROM source_files sf
    JOIN upload_batches eb ON sf.upload_batch_id = eb.id
    LEFT JOIN templates t ON eb.template_id = t.id
    LEFT JOIN departments d ON eb.department_id = d.id
    LEFT JOIN sites site ON eb.site_id = site.id
    LEFT JOIN users u ON eb.submitter_id = u.id
    WHERE sf.id = ?
    LIMIT 1
    `,
    [sourceFileId]
  );

  if (fileRows.length === 0) {
    return res.status(404).json({ message: '원본 파일을 찾을 수 없습니다.' });
  }

  const [fields] = await pool.query(
    `
    SELECT
      ev.id AS extractedValueId,
      ev.field_key AS fieldKey,
      COALESCE(ev.field_label, std.field_label, std.field_name) AS fieldName,
      COALESCE(ev.field_label, std.field_label, std.field_name) AS fieldLabel,
      std.data_type AS dataType,
      ev.row_index AS rowIndex,
      ev.extracted_value AS extractedValue,
      ev.normalized_value AS normalizedValue,
      ev.final_value AS finalValue,
      ev.confidence,
      ev.extraction_source AS extractionSource,
      ev.is_modified AS isModified
    FROM extracted_values ev
    LEFT JOIN standard_fields std ON ev.standard_field_id = std.id
    WHERE ev.source_file_id = ?
    ORDER BY ev.row_index ASC, COALESCE(std.sort_order, 9999) ASC, ev.id ASC
    `,
    [sourceFileId]
  );

  const [validationResults] = await pool.query(
    `
    SELECT
      val.id AS validationResultId,
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
        WHERE val.source_file_id = ?
    ORDER BY val.id ASC
    `,
    [sourceFileId]
  );

  const fileDetail = fileRows[0];

  return res.json({
    ...fileDetail,
    fileUrl: buildPublicStorageUrl(fileDetail.filePath),
    fields,
    validationResults,
  });
});

const updateExtractedValue = asyncHandler(async (req, res) => {
  const { extractedValueId } = req.params;
  const { finalValue } = req.body;

  const [beforeRows] = await pool.query(
    `
    SELECT 
      id, 
      final_value AS finalValue 
    FROM extracted_values 
    WHERE id = ? 
    LIMIT 1
    `,
    [extractedValueId]
  );

  if (beforeRows.length === 0) {
    return res.status(404).json({ message: '추출값을 찾을 수 없습니다.' });
  }

  await pool.query(
    `
    UPDATE extracted_values
    SET 
      final_value = ?, 
      modified_value = ?,
      is_modified = TRUE, 
      modified_by = ?, 
      modified_at = CURRENT_TIMESTAMP, 
      extraction_source = 'USER'
    WHERE id = ?
    `,
    [finalValue, finalValue, req.user.id, extractedValueId]
  );

  await createAuditLog({
    userId: req.user.id,
    actionType: 'EXTRACTED_VALUE_UPDATED',
    targetTable: 'extracted_values',
    targetId: Number(extractedValueId),
    beforeData: beforeRows[0],
    afterData: { finalValue },
    ipAddress: req.ip,
  });

  return res.json({
    extractedValueId: Number(extractedValueId),
    finalValue,
    isModified: true,
    message: '추출값이 수정되었습니다.',
  });
});

const updateExtractedValuesBulk = asyncHandler(async (req, res) => {
  const { sourceFileId } = req.params;
  const { values } = req.body;

  if (!Array.isArray(values) || values.length === 0) {
    return res.status(400).json({ message: '수정할 값이 없습니다.' });
  }

  const connection = await pool.getConnection();

  try {
    await connection.beginTransaction();

    let updatedCount = 0;

    for (const item of values) {
      if (!item.extractedValueId) continue;

      const [result] = await connection.query(
        `
        UPDATE extracted_values
        SET 
          final_value = ?, 
          modified_value = ?,
          is_modified = TRUE, 
          modified_by = ?, 
          modified_at = CURRENT_TIMESTAMP, 
          extraction_source = 'USER'
        WHERE id = ? AND source_file_id = ?
        `,
        [item.finalValue, item.finalValue, req.user.id, item.extractedValueId, sourceFileId]
      );

      updatedCount += result.affectedRows || 0;
    }

    await connection.query(
      `
      UPDATE source_files
      SET status = 'NEED_REVIEW'
      WHERE id = ? AND status NOT IN ('NEED_SUPPLEMENT')
      `,
      [sourceFileId]
    );

    await connection.commit();

    await createAuditLog({
      userId: req.user.id,
      actionType: 'EXTRACTED_VALUES_BULK_UPDATED',
      targetTable: 'source_files',
      targetId: Number(sourceFileId),
      afterData: { updatedCount },
      ipAddress: req.ip,
    });

    return res.json({
      sourceFileId: Number(sourceFileId),
      updatedCount,
      message: '추출값이 일괄 수정되었습니다.',
    });
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
});

const syncDetailItems = asyncHandler(async (req, res) => {
  const { sourceFileId } = req.params;
  const items = normalizeDetailItems(req.body.items || []);

  const [fileRows] = await pool.query(
    `
    SELECT id, upload_batch_id AS batchId
    FROM source_files
    WHERE id = ?
    LIMIT 1
    `,
    [sourceFileId]
  );

  if (fileRows.length === 0) {
    return res.status(404).json({ message: '원본 파일을 찾을 수 없습니다.' });
  }

  const invalidItem = items.find(
    (item) => !toNullableString(item.item_name || item.description) || parseAmount(item.amount) <= 0
  );

  if (invalidItem) {
    return res.status(400).json({
      message: `${invalidItem.rowIndex}번 상세 항목의 품목명 또는 금액을 확인해주세요.`,
    });
  }

  const connection = await pool.getConnection();

  try {
    await connection.beginTransaction();

    const fieldMap = await loadStandardFieldMap(connection);
    const keepIds = [];
    let insertedCount = 0;
    let updatedCount = 0;

    for (const item of items) {
      const category = await resolveExpenseCategory(connection, item);
      const fieldValues = buildDetailFieldValues(item, category);
      const categoryId = category?.id || null;

      for (const fieldKey of DETAIL_FIELD_KEYS) {
        const field = fieldMap.get(fieldKey);
        if (!field) continue;

        const stringValue = toNullableString(fieldValues[fieldKey]);
        if (stringValue === null) continue;

        const shouldAttachCategory = [
          'expense_category_code',
          'expense_category_name',
          'description',
          'item_name',
          'amount',
        ].includes(fieldKey);

        const existingId = Number(item.field_ids?.[fieldKey] || 0);

        if (existingId > 0) {
          const [result] = await connection.query(
            `
            UPDATE extracted_values
            SET
              expense_category_id = ?,
              row_index = ?,
              normalized_value = ?,
              final_value = ?,
              modified_value = ?,
              confidence = COALESCE(confidence, 1.00),
              confidence_score = COALESCE(confidence_score, 1.00),
              extraction_source = 'USER_REVIEW',
              is_modified = TRUE,
              modified_by = ?,
              modified_at = CURRENT_TIMESTAMP
            WHERE id = ? AND source_file_id = ?
            `,
            [
              shouldAttachCategory ? categoryId : null,
              item.rowIndex,
              stringValue,
              stringValue,
              stringValue,
              req.user.id,
              existingId,
              sourceFileId,
            ]
          );

          if (result.affectedRows > 0) {
            keepIds.push(existingId);
            updatedCount += result.affectedRows;
            continue;
          }
        }

        const [insertResult] = await connection.query(
          `
          INSERT INTO extracted_values
          (
            source_file_id,
            standard_field_id,
            expense_category_id,
            field_key,
            field_label,
            row_index,
            extracted_value,
            normalized_value,
            final_value,
            modified_value,
            confidence,
            confidence_score,
            extraction_source,
            is_modified,
            modified_by,
            modified_at
          )
          VALUES (?, ?, ?, ?, ?, ?, NULL, ?, ?, ?, 1.00, 1.00, 'USER_REVIEW', TRUE, ?, CURRENT_TIMESTAMP)
          `,
          [
            sourceFileId,
            field.id,
            shouldAttachCategory ? categoryId : null,
            fieldKey,
            field.fieldLabel,
            item.rowIndex,
            stringValue,
            stringValue,
            stringValue,
            req.user.id,
          ]
        );

        if (insertResult.insertId) {
          keepIds.push(insertResult.insertId);
        }

        insertedCount += 1;
      }
    }

    if (keepIds.length > 0) {
      const placeholders = keepIds.map(() => '?').join(', ');
      await connection.query(
        `
        DELETE FROM extracted_values
        WHERE source_file_id = ?
          AND COALESCE(row_index, 0) > 0
          AND id NOT IN (${placeholders})
        `,
        [sourceFileId, ...keepIds]
      );
    } else {
      await connection.query(
        `
        DELETE FROM extracted_values
        WHERE source_file_id = ? AND COALESCE(row_index, 0) > 0
        `,
        [sourceFileId]
      );
    }

    await connection.query(
      `
      UPDATE source_files
      SET status = 'NEED_REVIEW', error_message = NULL
      WHERE id = ? AND status NOT IN ('NEED_SUPPLEMENT')
      `,
      [sourceFileId]
    );

    await connection.commit();

    await createAuditLog({
      userId: req.user.id,
      actionType: 'DETAIL_ITEMS_SYNCED',
      targetTable: 'source_files',
      targetId: Number(sourceFileId),
      afterData: {
        itemCount: items.length,
        insertedCount,
        updatedCount,
        detailTotalAmount: calculateDetailTotal(items),
      },
      ipAddress: req.ip,
    });

    return res.json({
      sourceFileId: Number(sourceFileId),
      itemCount: items.length,
      insertedCount,
      updatedCount,
      detailTotalAmount: calculateDetailTotal(items),
      message: '상세 품목이 저장되었습니다.',
    });
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
});

const revalidateSourceFile = asyncHandler(async (req, res) => {
  const { sourceFileId } = req.params;

  await pool.query(
    `
    UPDATE source_files
    SET 
      status = 'NEED_REVIEW', 
      error_message = NULL
    WHERE id = ?
    `,
    [sourceFileId]
  );

  return res.json({
    sourceFileId: Number(sourceFileId),
    status: 'NEED_REVIEW',
    message: '수정값 기준으로 재검토 상태가 반영되었습니다.',
  });
});

const completeReview = asyncHandler(async (req, res) => {
  const { sourceFileId } = req.params;

  const [fileRows] = await pool.query(
    `
    SELECT 
      id, 
      upload_batch_id AS batchId 
    FROM source_files 
    WHERE id = ? 
    LIMIT 1
    `,
    [sourceFileId]
  );

  if (fileRows.length === 0) {
    return res.status(404).json({ message: '원본 파일을 찾을 수 없습니다.' });
  }

  await pool.query(
    `
    UPDATE source_files
    SET 
      status = 'CONFIRMED', 
      error_message = NULL, 
      completed_at = CURRENT_TIMESTAMP
    WHERE id = ?
    `,
    [sourceFileId]
  );

  await pool.query(
    `
    UPDATE validation_results
    SET 
      is_resolved = TRUE, 
      resolved_by = ?, 
      resolved_at = CURRENT_TIMESTAMP
    WHERE source_file_id = ?
    `,
    [req.user.id, sourceFileId]
  );

  await createAuditLog({
    userId: req.user.id,
    actionType: 'REVIEW_COMPLETED',
    targetTable: 'source_files',
    targetId: Number(sourceFileId),
    afterData: { status: 'CONFIRMED' },
    ipAddress: req.ip,
  });

  await recalculateBatchStatus(fileRows[0].batchId);

  return res.json({
    sourceFileId: Number(sourceFileId),
    batchId: fileRows[0].batchId,
    status: 'NORMAL',
    message: '검토가 완료되었습니다. 이제 등록된 템플릿 기준으로 엑셀을 생성할 수 있습니다.',
  });
});

const requestSupplement = asyncHandler(async (req, res) => {
  const { sourceFileId } = req.params;
  const { reason } = req.body;

  const [fileRows] = await pool.query(
    `
    SELECT id, upload_batch_id AS batchId
    FROM source_files
    WHERE id = ?
    LIMIT 1
    `,
    [sourceFileId]
  );

  if (fileRows.length === 0) {
    return res.status(404).json({ message: '원본 파일을 찾을 수 없습니다.' });
  }

  await pool.query(
    `
    UPDATE source_files
    SET 
      status = 'NEED_SUPPLEMENT', 
      error_message = ?
    WHERE id = ?
    `,
    [reason || '보완자료가 필요합니다.', sourceFileId]
  );

  await createAuditLog({
    userId: req.user.id,
    actionType: 'SUPPLEMENT_REQUESTED',
    targetTable: 'source_files',
    targetId: Number(sourceFileId),
    afterData: { reason },
    ipAddress: req.ip,
  });

  await recalculateBatchStatus(fileRows[0].batchId);

  return res.json({
    sourceFileId: Number(sourceFileId),
    status: 'NEED_SUPPLEMENT',
    message: '증빙 제출자에게 보완 요청 상태로 변경되었습니다.',
  });
});

module.exports = {
  getRequiredReviews,
  getSupplementRequiredList,
  getReviewDetail,
  updateExtractedValue,
  updateExtractedValuesBulk,
  syncDetailItems,
  revalidateSourceFile,
  completeReview,
  requestSupplement,
};