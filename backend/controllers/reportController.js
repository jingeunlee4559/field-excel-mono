const pool = require("../config/db");
const asyncHandler = require("../utils/asyncHandler");

const VALID_DATE_BASIS = new Set(["receipt", "upload", "processed"]);

// 구매 내역/통계 화면은 관리팀 최종확정이 끝난 자료만 기본 집계한다.
// NORMAL은 AI가 정상으로 판단한 상태일 뿐, 관리팀 확정 상태가 아니므로 구매 내역에서 제외한다.
const CONFIRMED_SOURCE_FILE_STATUSES = ["CONFIRMED"];

const toNumber = (value, fallback = 0) => {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
};

const normalizeDateBasis = (value) => {
  const normalized = String(value || "receipt").trim().toLowerCase();
  return VALID_DATE_BASIS.has(normalized) ? normalized : "receipt";
};

const setNoCacheHeaders = (res) => {
  res.set("Cache-Control", "no-store, no-cache, must-revalidate, proxy-revalidate");
  res.set("Pragma", "no-cache");
  res.set("Expires", "0");
  res.set("Surrogate-Control", "no-store");
};

/**
 * 구매 내역의 날짜 기준.
 * - receipt: 영수증에서 추출한 사용일자 기준. 사용일자가 없으면 목록에서 완전히 사라지지 않도록 업로드일자로 fallback.
 * - upload: 시스템 업로드일자 기준.
 * - processed: AI 처리완료일자 기준. 처리일자가 없으면 업로드일자로 fallback.
 *
 * 현재 로컬 MySQL은 CURRENT_TIMESTAMP가 한국 시간으로 저장되는 구조라서 별도 +9시간을 더하지 않는다.
 */
const getDateExpressionSql = (dateBasis = "receipt") => {
  const basis = normalizeDateBasis(dateBasis);

  if (basis === "upload") {
    return "DATE(sf.uploaded_at)";
  }

  if (basis === "processed") {
    return "DATE(COALESCE(sf.completed_at, sf.processed_at, sf.uploaded_at))";
  }

  return "DATE(COALESCE(NULLIF(file_info.receipt_date, ''), sf.uploaded_at))";
};

const getPeriodSql = (period = "daily", dateBasis = "receipt") => {
  const dateExpr = getDateExpressionSql(dateBasis);

  if (period === "monthly") {
    return `DATE_FORMAT(${dateExpr}, '%Y-%m')`;
  }

  if (period === "yearly") {
    return `DATE_FORMAT(${dateExpr}, '%Y')`;
  }

  return `DATE_FORMAT(${dateExpr}, '%Y-%m-%d')`;
};

const getDocumentTypeNameSql = `
  CASE
    WHEN COALESCE(sf.document_type, eb.document_type) = 'RECEIPT' THEN '영수증'
    WHEN COALESCE(sf.document_type, eb.document_type) = 'ITEM_RECEIPT' THEN '품목형 영수증'
    WHEN COALESCE(sf.document_type, eb.document_type) = 'TRANSPORT_RECEIPT' THEN '교통 영수증'
    WHEN COALESCE(sf.document_type, eb.document_type) = 'CARD_RECEIPT' THEN '카드 전표'
    WHEN COALESCE(sf.document_type, eb.document_type) = 'INVOICE' THEN '송장'
    WHEN COALESCE(sf.document_type, eb.document_type) = 'MATERIAL_INSPECTION' THEN '자재검수증'
    WHEN COALESCE(sf.document_type, eb.document_type) = 'WORK_DAILY' THEN '작업일보'
    WHEN COALESCE(sf.document_type, eb.document_type) = 'INSPECTION_REQUEST' THEN '검측요청서'
    WHEN COALESCE(sf.document_type, eb.document_type) IS NULL OR COALESCE(sf.document_type, eb.document_type) = '' THEN '미지정'
    ELSE COALESCE(sf.document_type, eb.document_type)
  END
`;

const normalizeId = (value) => {
  if (value === undefined || value === null || value === "") return null;

  const number = Number(value);

  if (!Number.isFinite(number)) return null;

  return number;
};

const buildWhere = (query = {}, options = {}) => {
  const departmentId = normalizeId(query.departmentId);
  const siteId = normalizeId(query.siteId);
  const documentType = query.documentType;
  const keyword = query.keyword;
  const startDate = query.startDate;
  const endDate = query.endDate;
  const dateExpr = getDateExpressionSql(query.dateBasis);
  const confirmedOnly = options.confirmedOnly !== false;
  const excludedOnly = options.excludedOnly === true;

  const params = [];
  let whereSql = "WHERE 1 = 1";

  if (confirmedOnly) {
    whereSql += ` AND sf.status IN (${CONFIRMED_SOURCE_FILE_STATUSES.map(() => "?").join(", ")})`;
    params.push(...CONFIRMED_SOURCE_FILE_STATUSES);
  } else if (excludedOnly) {
    whereSql += ` AND sf.status NOT IN (${CONFIRMED_SOURCE_FILE_STATUSES.map(() => "?").join(", ")})`;
    params.push(...CONFIRMED_SOURCE_FILE_STATUSES);
  }

  if (departmentId !== null) {
    whereSql += " AND eb.department_id = ?";
    params.push(departmentId);
  }

  if (siteId !== null) {
    whereSql += " AND eb.site_id = ?";
    params.push(siteId);
  }

  if (documentType) {
    whereSql += " AND COALESCE(sf.document_type, eb.document_type) = ?";
    params.push(documentType);
  }

  if (startDate) {
    whereSql += ` AND ${dateExpr} >= ?`;
    params.push(startDate);
  }

  if (endDate) {
    whereSql += ` AND ${dateExpr} <= ?`;
    params.push(endDate);
  }

  if (keyword && String(keyword).trim()) {
    const likeKeyword = `%${String(keyword).trim()}%`;

    whereSql += `
      AND (
        sf.original_file_name LIKE ?
        OR eb.batch_no LIKE ?
        OR u.name LIKE ?
        OR d.department_name LIKE ?
        OR site.site_name LIKE ?
        OR file_info.vendor_name LIKE ?
        OR file_info.category_name LIKE ?
        OR file_info.item_names LIKE ?
        OR file_info.description LIKE ?
        OR file_info.payment_method LIKE ?
      )
    `;

    params.push(
      likeKeyword,
      likeKeyword,
      likeKeyword,
      likeKeyword,
      likeKeyword,
      likeKeyword,
      likeKeyword,
      likeKeyword,
      likeKeyword,
      likeKeyword
    );
  }

  return {
    whereSql,
    params,
  };
};

const numericValueSql = `
  CAST(
    NULLIF(
      REPLACE(
        REPLACE(
          REPLACE(
            REPLACE(
              COALESCE(ev.final_value, ev.modified_value, ev.normalized_value, ev.extracted_value, '0'),
              ',',
              ''
            ),
            '원',
            ''
          ),
          ' ',
          ''
        ),
        '₩',
        ''
      ),
      ''
    ) AS DECIMAL(15, 2)
  )
`;

/**
 * 파일 1개 = 구매내역 1행으로 요약한다.
 * 상세 품목이 여러 개면 대표품목 외 N건 형태로 목록에 보여준다.
 * 실제 단일 파일 엑셀 생성에서는 excelGenerationService에서 상세 품목을 펼친다.
 */
const fileInfoSubquery = `
  SELECT
    ev.source_file_id,

    MAX(
      CASE
        WHEN ev.field_key IN ('receipt_date', 'expense_date', 'use_date', 'date')
        THEN COALESCE(ev.final_value, ev.modified_value, ev.normalized_value, ev.extracted_value)
      END
    ) AS receipt_date,

    MAX(
      CASE
        WHEN ev.field_key IN ('vendor_name', 'store_name', 'merchant_name', 'company_name')
        THEN COALESCE(ev.final_value, ev.modified_value, ev.normalized_value, ev.extracted_value)
      END
    ) AS vendor_name,

    MAX(
      CASE
        WHEN ev.field_key IN ('expense_category_name', 'expense_item', 'category', 'purpose')
        THEN COALESCE(ev.final_value, ev.modified_value, ev.normalized_value, ev.extracted_value)
      END
    ) AS category_name,

    GROUP_CONCAT(
      CASE
        WHEN ev.field_key IN ('item_name', 'product_name', 'material_name')
             AND COALESCE(ev.final_value, ev.modified_value, ev.normalized_value, ev.extracted_value) IS NOT NULL
             AND COALESCE(ev.final_value, ev.modified_value, ev.normalized_value, ev.extracted_value) <> ''
        THEN COALESCE(ev.final_value, ev.modified_value, ev.normalized_value, ev.extracted_value)
      END
      ORDER BY COALESCE(ev.row_index, ev.id) ASC SEPARATOR '||'
    ) AS item_names,

    COUNT(
      CASE
        WHEN ev.field_key IN ('item_name', 'product_name', 'material_name')
             AND COALESCE(ev.final_value, ev.modified_value, ev.normalized_value, ev.extracted_value) IS NOT NULL
             AND COALESCE(ev.final_value, ev.modified_value, ev.normalized_value, ev.extracted_value) <> ''
        THEN 1
      END
    ) AS item_count,

    MAX(
      CASE
        WHEN ev.field_key IN ('description', 'memo', 'note', 'purpose')
        THEN COALESCE(ev.final_value, ev.modified_value, ev.normalized_value, ev.extracted_value)
      END
    ) AS description,

    MAX(
      CASE
        WHEN ev.field_key IN ('payment_method', 'pay_method')
        THEN COALESCE(ev.final_value, ev.modified_value, ev.normalized_value, ev.extracted_value)
      END
    ) AS payment_method,

    MAX(
      CASE
        WHEN ev.field_key IN ('departure_place', 'route_from', 'from_place')
        THEN COALESCE(ev.final_value, ev.modified_value, ev.normalized_value, ev.extracted_value)
      END
    ) AS departure_place,

    MAX(
      CASE
        WHEN ev.field_key IN ('arrival_place', 'route_to', 'to_place')
        THEN COALESCE(ev.final_value, ev.modified_value, ev.normalized_value, ev.extracted_value)
      END
    ) AS arrival_place,

    MAX(
      CASE
        WHEN ev.field_key IN ('total_amount', 'paid_amount', 'expense_amount', 'payment_amount', 'price', 'cost')
        THEN ${numericValueSql}
      END
    ) AS total_amount,

    MAX(
      CASE
        WHEN ev.field_key IN ('amount')
        THEN ${numericValueSql}
      END
    ) AS amount
  FROM extracted_values ev
  GROUP BY ev.source_file_id
`;

const getSummary = asyncHandler(async (req, res) => {
  setNoCacheHeaders(res);

  const { whereSql, params } = buildWhere(req.query, { confirmedOnly: true });
  const { whereSql: excludedWhereSql, params: excludedParams } = buildWhere(req.query, { confirmedOnly: false, excludedOnly: true });

  console.log("[REPORT SUMMARY QUERY]", req.query);
  console.log("[REPORT SUMMARY WHERE]", whereSql);
  console.log("[REPORT SUMMARY PARAMS]", params);

  const [rows] = await pool.query(
    `
    SELECT
      COUNT(DISTINCT eb.id) AS batchCount,
      COUNT(DISTINCT sf.id) AS fileCount,

      COUNT(DISTINCT sf.id) AS confirmedCount,

      0 AS normalCount,
      0 AS needReviewCount,
      0 AS needSupplementCount,
      0 AS failedCount,
      0 AS extractingCount,

      COALESCE(SUM(COALESCE(file_info.total_amount, file_info.amount, 0)), 0) AS totalAmount
    FROM source_files sf
    JOIN upload_batches eb ON sf.upload_batch_id = eb.id
    LEFT JOIN departments d ON eb.department_id = d.id
    LEFT JOIN sites site ON eb.site_id = site.id
    LEFT JOIN users u ON eb.submitter_id = u.id
    LEFT JOIN templates t ON eb.template_id = t.id
    LEFT JOIN (${fileInfoSubquery}) file_info ON file_info.source_file_id = sf.id
    ${whereSql}
    `,
    params
  );

  const [excludedRows] = await pool.query(
    `
    SELECT
      COUNT(DISTINCT eb.id) AS excludedBatchCount,
      COUNT(DISTINCT sf.id) AS excludedFileCount,
      COUNT(DISTINCT CASE WHEN sf.status = 'NORMAL' THEN sf.id END) AS normalExcludedCount,
      COUNT(DISTINCT CASE WHEN sf.status IN ('NEED_REVIEW', 'NEED_SUPPLEMENT') THEN sf.id END) AS reviewExcludedCount,
      COUNT(DISTINCT CASE WHEN sf.status = 'FAILED' THEN sf.id END) AS failedExcludedCount,
      COUNT(
        DISTINCT CASE
          WHEN sf.status IN ('UPLOADED', 'QUEUED', 'EXTRACTING', 'OCR_PROCESSING', 'AI_PROCESSING')
          THEN sf.id
        END
      ) AS processingExcludedCount
    FROM source_files sf
    JOIN upload_batches eb ON sf.upload_batch_id = eb.id
    LEFT JOIN departments d ON eb.department_id = d.id
    LEFT JOIN sites site ON eb.site_id = site.id
    LEFT JOIN users u ON eb.submitter_id = u.id
    LEFT JOIN templates t ON eb.template_id = t.id
    LEFT JOIN (${fileInfoSubquery}) file_info ON file_info.source_file_id = sf.id
    ${excludedWhereSql}
    `,
    excludedParams
  );

  const row = rows[0] || {};
  const excludedRow = excludedRows[0] || {};

  return res.json({
    summary: {
      batchCount: toNumber(row.batchCount),
      fileCount: toNumber(row.fileCount),
      confirmedCount: toNumber(row.confirmedCount),
      excludedBatchCount: toNumber(excludedRow.excludedBatchCount),
      excludedFileCount: toNumber(excludedRow.excludedFileCount),
      normalExcludedCount: toNumber(excludedRow.normalExcludedCount),
      reviewExcludedCount: toNumber(excludedRow.reviewExcludedCount),
      failedExcludedCount: toNumber(excludedRow.failedExcludedCount),
      processingExcludedCount: toNumber(excludedRow.processingExcludedCount),
      normalCount: toNumber(row.normalCount),
      needReviewCount: toNumber(row.needReviewCount),
      needSupplementCount: toNumber(row.needSupplementCount),
      failedCount: toNumber(row.failedCount),
      extractingCount: toNumber(row.extractingCount),
      totalAmount: toNumber(row.totalAmount),
    },
  });
});

const getManagerReport = asyncHandler(async (req, res) => {
  setNoCacheHeaders(res);

  const { period = "daily", groupBy = "department" } = req.query;

  const dateBasis = normalizeDateBasis(req.query.dateBasis);
  const periodSql = getPeriodSql(period, dateBasis);
  const { whereSql, params } = buildWhere(req.query, { confirmedOnly: true });

  console.log("[REPORT MANAGER QUERY]", req.query);
  console.log("[REPORT MANAGER WHERE]", whereSql);
  console.log("[REPORT MANAGER PARAMS]", params);

  const orderByGroup =
    groupBy === "site"
      ? "site.site_name ASC, d.department_name ASC"
      : "d.department_name ASC, site.site_name ASC";

  const [items] = await pool.query(
    `
    SELECT
      ${periodSql} AS periodLabel,

      eb.id AS batchId,
      eb.batch_no AS batchNo,
      eb.template_id AS templateId,
      COALESCE(t.template_name, t.original_file_name, '-') AS templateName,
      t.original_file_name AS templateOriginalFileName,

      sf.id AS sourceFileId,
      sf.original_file_name AS originalFileName,
      sf.status,
      sf.confidence_score AS confidenceScore,
      sf.uploaded_at AS uploadedAt,
      DATE_FORMAT(sf.uploaded_at, '%Y-%m-%d') AS uploadedDate,
      DATE_FORMAT(COALESCE(sf.completed_at, sf.processed_at), '%Y-%m-%d') AS processedDate,

      d.id AS departmentId,
      COALESCE(d.department_name, '미지정 부서') AS departmentName,

      site.id AS siteId,
      COALESCE(site.site_name, '미지정 현장') AS siteName,

      u.id AS submitterId,
      COALESCE(u.name, '미지정 사용자') AS submitterName,

      COALESCE(sf.document_type, eb.document_type) AS documentType,
      ${getDocumentTypeNameSql} AS documentTypeName,

      COALESCE(file_info.receipt_date, '') AS receiptDate,
      COALESCE(file_info.vendor_name, '-') AS vendorName,
      COALESCE(file_info.category_name, '-') AS categoryName,

      CASE
        WHEN file_info.departure_place IS NOT NULL
             AND file_info.departure_place <> ''
             AND file_info.arrival_place IS NOT NULL
             AND file_info.arrival_place <> ''
        THEN CONCAT(file_info.departure_place, ' → ', file_info.arrival_place)

        WHEN file_info.item_count > 1
             AND file_info.item_names IS NOT NULL
             AND file_info.item_names <> ''
        THEN CONCAT(SUBSTRING_INDEX(file_info.item_names, '||', 1), ' 외 ', file_info.item_count - 1, '건')

        WHEN file_info.item_count = 1
             AND file_info.item_names IS NOT NULL
             AND file_info.item_names <> ''
        THEN SUBSTRING_INDEX(file_info.item_names, '||', 1)

        WHEN file_info.description IS NOT NULL
             AND file_info.description <> ''
        THEN file_info.description

        WHEN file_info.category_name IS NOT NULL
             AND file_info.category_name <> ''
        THEN file_info.category_name

        ELSE '미분류'
      END AS itemName,

      COALESCE(file_info.description, '-') AS description,
      COALESCE(file_info.payment_method, '-') AS paymentMethod,
      COALESCE(file_info.total_amount, file_info.amount, 0) AS amount
    FROM source_files sf
    JOIN upload_batches eb ON sf.upload_batch_id = eb.id
    LEFT JOIN departments d ON eb.department_id = d.id
    LEFT JOIN sites site ON eb.site_id = site.id
    LEFT JOIN users u ON eb.submitter_id = u.id
    LEFT JOIN templates t ON eb.template_id = t.id
    LEFT JOIN (${fileInfoSubquery}) file_info ON file_info.source_file_id = sf.id
    ${whereSql}
    ORDER BY
      ${orderByGroup},
      ${getDateExpressionSql(dateBasis)} DESC,
      sf.uploaded_at DESC,
      sf.id DESC
    `,
    params
  );

  console.log("[REPORT MANAGER RESULT COUNT]", items.length);

  return res.json({
    items: items.map((item) => ({
      periodLabel: item.periodLabel,

      batchId: item.batchId,
      batchNo: item.batchNo,
      templateId: item.templateId,
      templateName: item.templateName || item.templateOriginalFileName || "-",
      templateOriginalFileName: item.templateOriginalFileName,

      sourceFileId: item.sourceFileId,
      originalFileName: item.originalFileName,

      departmentId: item.departmentId,
      departmentName: item.departmentName,

      siteId: item.siteId,
      siteName: item.siteName,

      submitterId: item.submitterId,
      submitterName: item.submitterName,

      documentType: item.documentType,
      documentTypeName: item.documentTypeName,

      uploadedAt: item.uploadedAt,
      uploadedDate: item.uploadedDate,
      processedDate: item.processedDate,
      receiptDate: item.receiptDate,
      categoryName: item.categoryName,
      vendorName: item.vendorName,
      itemName: item.itemName,
      description: item.description,
      paymentMethod: item.paymentMethod,

      status: item.status,
      confidenceScore: item.confidenceScore,
      amount: toNumber(item.amount),
    })),
  });
});

module.exports = {
  getSummary,
  getManagerReport,
};
