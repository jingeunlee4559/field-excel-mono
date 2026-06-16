const fs = require("fs");
const path = require("path");
const ExcelJS = require("exceljs");

const pool = require("../config/db");
const {
  ensureDir,
  getAiStorageRoot,
  getResultsDir,
  resolveStorageFilePath,
  toStorageRelativePath,
  getCandidateStoragePaths,
} = require("../utils/storagePath");

const resolveStoredFilePath = (storedPath) => {
  const resolvedPath = resolveStorageFilePath(storedPath, 'templates');

  if (resolvedPath && fs.existsSync(resolvedPath)) {
    return resolvedPath;
  }

  console.log("\n" + "=".repeat(80));
  console.log("[FILE PATH RESOLVE FAILED]");
  console.log("storedPath:", storedPath);
  console.log("process.cwd():", process.cwd());
  console.log("AI_STORAGE_ROOT:", getAiStorageRoot());
  console.log("candidates:");
  getCandidateStoragePaths(storedPath, 'templates').forEach((candidate) => console.log("-", candidate));
  console.log("=".repeat(80) + "\n");

  return null;
};

const getResultDir = () => {
  const absolutePath = getResultsDir();

  ensureDir(absolutePath);

  return absolutePath;
};

const normalizeFieldKey = (value) => {
  return String(value || "")
    .trim()
    .replace(/\s/g, "")
    .replace(/-/g, "_")
    .toLowerCase();
};

const parseAmount = (value) => {
  if (value === null || value === undefined) return 0;

  const text = String(value).replace(/[^\d.-]/g, "");
  const number = Number(text);

  return Number.isFinite(number) ? number : 0;
};

const firstNonEmpty = (...values) => {
  for (const value of values) {
    if (value !== null && value !== undefined && String(value).trim() !== "") {
      return value;
    }
  }

  return "";
};

const setIfEmpty = (target, key, value) => {
  if (value === null || value === undefined || String(value).trim() === "") {
    return;
  }

  if (
    target[key] === undefined ||
    target[key] === null ||
    String(target[key]).trim() === ""
  ) {
    target[key] = value;
  }
};

const isAmountKey = (fieldKey) => {
  const key = normalizeFieldKey(fieldKey);

  return [
    "amount",
    "total_amount",
    "expense_amount",
    "payment_amount",
    "price",
    "cost",
    "receipt_amount",
    "supply_amount",
    "금액",
    "지출금액",
    "결제금액",
    "사용금액",
    "영수액",
    "합계금액",
  ].includes(key);
};

const isDescriptionKey = (fieldKey) => {
  const key = normalizeFieldKey(fieldKey);

  return [
    "description",
    "detail",
    "expense_detail",
    "use_detail",
    "usage_detail",
    "item_name",
    "expense_category_name",
    "expense_item",
    "category",
    "memo",
    "route",
    "product_name",
    "purchase_item",
    "내역",
    "사용내역",
    "품목",
    "구매항목",
    "항목",
    "적요",
  ].includes(key);
};

const isVendorKey = (fieldKey) => {
  const key = normalizeFieldKey(fieldKey);

  return [
    "vendor",
    "vendor_name",
    "store_name",
    "merchant_name",
    "supplier_name",
    "사용처",
    "거래처",
    "가맹점",
    "상호",
  ].includes(key);
};

const isDateKey = (fieldKey) => {
  const key = normalizeFieldKey(fieldKey);

  return [
    "date",
    "receipt_date",
    "expense_date",
    "payment_date",
    "use_date",
    "사용일자",
    "거래일자",
    "지출일자",
    "결제일자",
  ].includes(key);
};

const isNumberKey = (fieldKey) => {
  const key = normalizeFieldKey(fieldKey);

  return ["no", "line_no", "row_no", "number", "seq", "순번", "번호"].includes(
    key
  );
};

const isRemarkKey = (fieldKey) => {
  const key = normalizeFieldKey(fieldKey);

  return ["remark", "remarks", "memo", "note", "비고", "메모"].includes(key);
};

const isTotalField = (fieldKey, fieldLabel) => {
  const key = normalizeFieldKey(fieldKey);
  const label = normalizeFieldKey(fieldLabel);

  return (
    [
      "total_amount",
      "expense_total_amount",
      "amount_total",
      "payment_total_amount",
      "grand_total",
      "지출총액",
      "총금액",
      "합계금액",
      "총액",
    ].includes(key) ||
    label.includes("지출총액") ||
    label.includes("총금액") ||
    label.includes("합계") ||
    label.includes("총액")
  );
};

const castExcelValue = (value) => {
  if (value === null || value === undefined) return null;

  const text = String(value).trim();

  if (text === "") return "";

  const numericText = text.replace(/,/g, "");
  const numeric = Number(numericText);

  if (
    Number.isFinite(numeric) &&
    (/^-?\d+(,\d{3})*(\.\d+)?$/.test(text) || /^-?\d+(\.\d+)?$/.test(text))
  ) {
    return numeric;
  }

  return text;
};

const getSheet = (workbook, sheetName) => {
  const sheet = workbook.getWorksheet(sheetName);

  if (!sheet) {
    throw new Error(`템플릿 시트를 찾을 수 없습니다: ${sheetName}`);
  }

  return sheet;
};

const stripSharedFormulas = (workbook) => {
  workbook.eachSheet((worksheet) => {
    worksheet.eachRow({ includeEmpty: true }, (row) => {
      row.eachCell({ includeEmpty: true }, (cell) => {
        const value = cell.value;

        if (!value || typeof value !== "object") return;

        const hasSharedFormula = Object.prototype.hasOwnProperty.call(
          value,
          "sharedFormula"
        );

        const isSharedFormulaMaster =
          Object.prototype.hasOwnProperty.call(value, "formula") &&
          Object.prototype.hasOwnProperty.call(value, "shareType");

        if (hasSharedFormula || isSharedFormulaMaster) {
          cell.value = Object.prototype.hasOwnProperty.call(value, "result")
            ? value.result
            : null;
        }
      });
    });
  });
};

const loadBatchForExcel = async (batchId) => {
  const [rows] = await pool.query(
    `
    SELECT
      eb.id AS batchId,
      eb.batch_no AS batchNo,
      eb.title,
      eb.submitter_id AS submitterId,
      eb.department_id AS departmentId,
      eb.site_id AS siteId,
      eb.site_name AS batchSiteName,
      eb.template_id AS templateId,
      eb.status,
      eb.document_type AS documentType,
      eb.submitted_at AS submittedAt,

      d.department_name AS departmentName,
      s.site_name AS siteName,
      u.name AS userName,

      t.template_name AS templateName,
      t.file_path AS templateFilePath,
      t.original_file_name AS templateOriginalFileName,
      t.status AS templateStatus
    FROM upload_batches eb
    LEFT JOIN departments d ON eb.department_id = d.id
    LEFT JOIN sites s ON eb.site_id = s.id
    LEFT JOIN users u ON eb.submitter_id = u.id
    LEFT JOIN templates t ON eb.template_id = t.id
    WHERE eb.id = ?
    LIMIT 1
    `,
    [batchId]
  );

  return rows[0] || null;
};

const loadSourceFilesForBatch = async (batchId) => {
  const [files] = await pool.query(
    `
    SELECT
      id AS sourceFileId,
      status,
      original_file_name AS originalFileName
    FROM source_files
    WHERE upload_batch_id = ?
    ORDER BY id ASC
    `,
    [batchId]
  );

  return files;
};

const loadMappings = async (templateId) => {
  const [mappings] = await pool.query(
    `
    SELECT
      id,
      template_id AS templateId,
      standard_field_id AS standardFieldId,
      field_key AS fieldKey,
      field_label AS fieldLabel,
      mapping_type AS mappingType,
      sheet_name AS sheetName,
      cell_address AS cellAddress,
      column_letter AS columnLetter,
      start_row AS startRow,
      max_rows AS maxRows,
      is_required AS isRequired,
      sort_order AS sortOrder
    FROM template_mappings
    WHERE template_id = ?
    ORDER BY sort_order ASC, id ASC
    `,
    [templateId]
  );

  return mappings;
};

const loadExtractedValues = async (batchId) => {
  const [rows] = await pool.query(
    `
    SELECT
      sf.id AS sourceFileId,
      sf.original_file_name AS originalFileName,
      ev.id AS extractedValueId,
      ev.field_key AS fieldKey,
      ev.field_label AS fieldLabel,
      ev.row_index AS rowIndex,
      COALESCE(ev.modified_value, ev.final_value, ev.normalized_value, ev.extracted_value) AS value,
      ev.expense_category_id AS expenseCategoryId,
      ec.category_code AS categoryCode,
      ec.category_name AS categoryName
    FROM source_files sf
    JOIN extracted_values ev ON sf.id = ev.source_file_id
    LEFT JOIN expense_categories ec ON ev.expense_category_id = ec.id
    WHERE sf.upload_batch_id = ?
    ORDER BY sf.id ASC, ev.row_index ASC, ev.id ASC
    `,
    [batchId]
  );

  return rows;
};

const validateGenerationPreconditions = async ({ batch, files, mappings }) => {
  if (!batch) {
    throw new Error("업로드 배치를 찾을 수 없습니다.");
  }

  if (!batch.templateId) {
    throw new Error(
      "업로드 시 선택된 템플릿이 없습니다. 자료 업로드 화면에서 등록된 템플릿을 선택해야 합니다."
    );
  }

  if (!batch.templateFilePath) {
    throw new Error("등록된 템플릿 파일 경로가 없습니다.");
  }

  const templateAbsolutePath = resolveStoredFilePath(batch.templateFilePath);

  if (!templateAbsolutePath) {
    throw new Error(
      `등록된 템플릿 파일을 찾을 수 없습니다: ${batch.templateFilePath}`
    );
  }

  if (!mappings || mappings.length === 0) {
    throw new Error(
      "템플릿 매핑 정보가 없습니다. 먼저 템플릿 매핑을 설정해주세요."
    );
  }

  const blocked = files.filter((file) =>
    ["UPLOADED", "EXTRACTING", "FAILED", "NEED_SUPPLEMENT"].includes(file.status)
  );

  if (blocked.length > 0) {
    throw new Error(
      "아직 처리되지 않았거나 보완이 필요한 파일이 있어 엑셀을 생성할 수 없습니다."
    );
  }

  console.log("\n" + "=".repeat(80));
  console.log("[EXCEL TEMPLATE RESOLVED]");
  console.log("templateFilePath:", batch.templateFilePath);
  console.log("templateAbsolutePath:", templateAbsolutePath);
  console.log("=".repeat(80) + "\n");

  return templateAbsolutePath;
};

const buildDefaultHeaderValue = ({ fieldKey, batch }) => {
  const key = normalizeFieldKey(fieldKey);

  const defaults = {
    department_name: batch.departmentName || "",
    department: batch.departmentName || "",
    부서: batch.departmentName || "",

    site_name: batch.siteName || batch.batchSiteName || "",
    site: batch.siteName || batch.batchSiteName || "",
    현장: batch.siteName || batch.batchSiteName || "",

    user_name: batch.userName || "",
    submitter_name: batch.userName || "",
    사용자: batch.userName || "",
    성명: batch.userName || "",

    expense_title: batch.title || batch.batchNo || "",
    title: batch.title || batch.batchNo || "",
    제목: batch.title || batch.batchNo || "",
  };

  return defaults[key] ?? defaults[fieldKey] ?? null;
};

const getHeaderValue = ({ headerValues, mapping, batch }) => {
  const fieldKey = mapping.fieldKey;
  const fieldLabel = mapping.fieldLabel;

  const key = normalizeFieldKey(fieldKey);

  if (isTotalField(fieldKey, fieldLabel)) {
    return (
      headerValues.get("total_amount") ??
      headerValues.get("expense_total_amount") ??
      headerValues.get("amount_total") ??
      headerValues.get("payment_total_amount") ??
      headerValues.get("지출총액") ??
      headerValues.get("총금액") ??
      headerValues.get("합계금액") ??
      0
    );
  }

  if (headerValues.has(fieldKey)) return headerValues.get(fieldKey);
  if (headerValues.has(key)) return headerValues.get(key);

  return buildDefaultHeaderValue({ fieldKey, batch });
};

const applySingleCellMappings = ({ workbook, mappings, headerValues, batch }) => {
  let appliedCount = 0;

  const singleMappings = mappings.filter(
    (mapping) => mapping.mappingType === "SINGLE_CELL"
  );

  singleMappings.forEach((mapping) => {
    if (!mapping.cellAddress) {
      if (mapping.isRequired) {
        throw new Error(
          `${mapping.fieldLabel} 단일 셀 매핑에 cell_address가 없습니다.`
        );
      }

      return;
    }

    const sheet = getSheet(workbook, mapping.sheetName);

    const value = getHeaderValue({
      headerValues,
      mapping,
      batch,
    });

    if (
      (value === null || value === undefined || value === "") &&
      mapping.isRequired
    ) {
      throw new Error(`필수 단일 필드 값이 없습니다: ${mapping.fieldLabel}`);
    }

    if (value !== null && value !== undefined) {
      sheet.getCell(mapping.cellAddress).value = castExcelValue(value);
      appliedCount += 1;
    }
  });

  return appliedCount;
};

const isAmountMapping = (mapping = {}) => {
  const key = normalizeFieldKey(mapping.fieldKey);
  const label = normalizeFieldKey(mapping.fieldLabel);
  const combined = `${key}_${label}`;

  return (
    isAmountKey(mapping.fieldKey) ||
    isTotalField(mapping.fieldKey, mapping.fieldLabel) ||
    label.includes("금액") ||
    label === "금" ||
    label.includes("금") ||
    combined.includes("amount") ||
    combined.includes("price") ||
    combined.includes("cost") ||
    combined.includes("total") ||
    combined.includes("합계") ||
    combined.includes("총액") ||
    combined.includes("결제") ||
    combined.includes("청구") ||
    combined.includes("지출") ||
    combined.includes("사용금액")
  );
};

const getRowAmountForExcel = (row, mapping) => {
  const fieldKey = mapping?.fieldKey;
  const key = normalizeFieldKey(fieldKey);

  const amount = parseAmount(
    firstNonEmpty(
      row.values?.amount,
      row.values?.expense_amount,
      row.values?.payment_amount,
      row.values?.receipt_amount,
      row.values?.claim_amount,
      row.values?.paid_amount,
      row.values?.total_amount,
      row.values?.grand_total,
      row.values?.price,
      row.values?.cost,
      row.values?.금액,
      row.values?.지출금액,
      row.values?.결제금액,
      row.values?.사용금액,
      row.values?.영수액,
      row.values?.총금액,
      row.values?.합계금액,
      fieldKey ? row.values?.[fieldKey] : undefined,
      key ? row.values?.[key] : undefined
    )
  );

  return amount > 0 ? amount : "";
};

const getRepeatValue = (row, mapping) => {
  const fieldKey = mapping.fieldKey;
  const fieldLabel = mapping.fieldLabel;
  const key = normalizeFieldKey(fieldKey);
  const label = normalizeFieldKey(fieldLabel);

  if (isNumberKey(fieldKey) || label.includes("번호")) {
    return row.rowIndex;
  }

  // 금액 컬럼은 템플릿마다 field_key/field_label이 다르게 저장될 수 있다.
  // 예: amount, total_amount, expense_total, payment, 금액, 금 액 등.
  // 따라서 반복행에서는 매핑명을 넓게 판별하고, 행에 계산해 둔 amount 값을 최우선으로 쓴다.
  if (isAmountMapping(mapping)) {
    return getRowAmountForExcel(row, mapping);
  }

  // field_key가 실수로 item_name/description으로 저장되어 있어도,
  // 엑셀 열 제목이 '비고'면 경비 항목을 넣는다.
  if (label.includes("비고")) {
    return firstNonEmpty(
      row.values.expense_category_name,
      row.values.expense_item,
      row.values.category,
      row.values.카테고리,
      row.values.분류,
      row.values.remark,
      row.values.memo,
      row.values.note,
      row.values.비고
    );
  }

  if (isDescriptionKey(fieldKey) || label.includes("내역")) {
    return firstNonEmpty(
      row.values.description,
      row.values.detail,
      row.values.expense_detail,
      row.values.use_detail,
      row.values.item_name,
      row.values.expense_category_name,
      row.values.expense_item,
      row.values.내역,
      row.values.사용내역,
      row.originalFileName
    );
  }

  if (isVendorKey(fieldKey)) {
    return firstNonEmpty(
      row.values.vendor_name,
      row.values.vendor,
      row.values.store_name,
      row.values.사용처
    );
  }

  if (isDateKey(fieldKey)) {
    return firstNonEmpty(
      row.values.receipt_date,
      row.values.expense_date,
      row.values.payment_date,
      row.values.date,
      row.values.사용일자
    );
  }

  if (key === "expense_category_name" || key === "expense_item" || key === "category" || label.includes("항목") || label.includes("분류")) {
    return firstNonEmpty(
      row.values.expense_category_name,
      row.values.expense_item,
      row.values.category,
      row.values.카테고리,
      row.values.분류
    );
  }

  if (isRemarkKey(fieldKey) || label.includes("항목")) {
    // 현재 경비청구서 템플릿은 반복 컬럼이 번호/내역/금액/비고 구조라서
    // 비고 칸을 경비 항목(식비/교통비/소모품비 등)으로 사용한다.
    // 실제 자유 메모가 있더라도, 비고 매핑에서는 경비분류를 우선 출력한다.
    return firstNonEmpty(
      row.values.expense_category_name,
      row.values.expense_item,
      row.values.category,
      row.values.카테고리,
      row.values.분류,
      row.values.remark,
      row.values.memo,
      row.values.note,
      row.values.비고
    );
  }

  if (row.values[fieldKey] !== undefined) return row.values[fieldKey];
  if (row.values[key] !== undefined) return row.values[key];

  return "";
};

const applyRepeatColumnMappings = ({ workbook, mappings, detailRows }) => {
  let appliedCount = 0;

  const repeatMappings = mappings.filter(
    (mapping) => mapping.mappingType === "REPEAT_COLUMN"
  );

  if (repeatMappings.length === 0) {
    throw new Error(
      "반복 행 매핑 정보가 없습니다. template_mappings에 REPEAT_COLUMN 매핑을 설정해주세요."
    );
  }

  const groupedBySheetAndStart = new Map();

  repeatMappings.forEach((mapping) => {
    if (!mapping.columnLetter || !mapping.startRow) {
      if (mapping.isRequired) {
        throw new Error(
          `${mapping.fieldLabel} 반복 컬럼 매핑에 column_letter 또는 start_row가 없습니다.`
        );
      }

      return;
    }

    const key = `${mapping.sheetName}:${mapping.startRow}`;

    if (!groupedBySheetAndStart.has(key)) {
      groupedBySheetAndStart.set(key, []);
    }

    groupedBySheetAndStart.get(key).push(mapping);
  });

  for (const [groupKey, groupMappings] of groupedBySheetAndStart.entries()) {
    const [sheetName, startRowText] = groupKey.split(":");
    const startRow = Number(startRowText);
    const sheet = getSheet(workbook, sheetName);

    const maxRows = Math.min(
      ...groupMappings
        .map((mapping) => Number(mapping.maxRows || 9999))
        .filter((value) => Number.isFinite(value) && value > 0)
    );

    if (detailRows.length > maxRows) {
      throw new Error(
        `템플릿 반복 입력 가능 행 수(${maxRows})보다 선택 내역(${detailRows.length})이 많습니다.`
      );
    }

    detailRows.forEach((detailRow, index) => {
      const excelRowNumber = startRow + index;

      groupMappings.forEach((mapping) => {
        const value = getRepeatValue(detailRow, mapping);

        if (
          (value === null || value === undefined || value === "") &&
          mapping.isRequired
        ) {
          throw new Error(
            `필수 반복 필드 값이 없습니다: ${mapping.fieldLabel}, 행 ${
              index + 1
            }`
          );
        }

        if (value !== null && value !== undefined && value !== "") {
          const address = `${mapping.columnLetter}${excelRowNumber}`;
          sheet.getCell(address).value = castExcelValue(value);
          appliedCount += 1;
        }
      });
    });
  }

  return appliedCount;
};

const groupValues = (values) => {
  const headerValues = new Map();
  const detailRows = new Map();

  values.forEach((item) => {
    const rowIndex = Number(item.rowIndex || 0);
    const key = item.fieldKey;
    const normalizedKey = normalizeFieldKey(key);
    const value = item.value;

    if (!key) return;

    if (rowIndex <= 0) {
      if (!headerValues.has(key)) headerValues.set(key, value);
      if (!headerValues.has(normalizedKey)) headerValues.set(normalizedKey, value);
      return;
    }

    const rowKey = `${item.sourceFileId}:${rowIndex}`;

    if (!detailRows.has(rowKey)) {
      detailRows.set(rowKey, {
        sourceFileId: item.sourceFileId,
        originalFileName: item.originalFileName,
        rowIndex,
        values: {},
      });
    }

    const row = detailRows.get(rowKey);
    row.values[key] = value;
    row.values[normalizedKey] = value;

    if (item.categoryName) {
      const categoryName = normalizeSelectedCategoryName(item.categoryName);
      setIfEmpty(row.values, "expense_category_name", categoryName);
      setIfEmpty(row.values, "expense_item", categoryName);
      setIfEmpty(row.values, "category", categoryName);
      setIfEmpty(row.values, "카테고리", categoryName);
      setIfEmpty(row.values, "분류", categoryName);
      setIfEmpty(row.values, "remark", categoryName);
      setIfEmpty(row.values, "memo", categoryName);
      setIfEmpty(row.values, "비고", categoryName);
    }
  });

  return {
    headerValues,
    detailRows: Array.from(detailRows.values()).sort((a, b) => {
      if (a.sourceFileId !== b.sourceFileId) {
        return a.sourceFileId - b.sourceFileId;
      }

      return a.rowIndex - b.rowIndex;
    }),
  };
};

const createGeneratedFileName = (batch) => {
  const safeBatchNo = String(batch.batchNo || `BATCH-${batch.batchId}`).replace(
    /[^\w가-힣-]/g,
    "_"
  );

  const safeTitle = String(batch.title || "경비청구서")
    .replace(/[^\w가-힣-]/g, "_")
    .slice(0, 50);

  return `${safeBatchNo}_${safeTitle}.xlsx`;
};

const createSourceFileGeneratedFileName = ({ batch, file }) => {
  const safeBatchNo = String(batch.batchNo || `BATCH-${batch.batchId}`).replace(
    /[^\w가-힣-]/g,
    "_"
  );

  const originalBaseName = path.parse(file.originalFileName || `FILE-${file.sourceFileId}`).name;
  const safeOriginalName = String(originalBaseName || `FILE-${file.sourceFileId}`)
    .replace(/[^\w가-힣-]/g, "_")
    .slice(0, 40);

  const now = new Date();
  const stamp = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(
    2,
    "0"
  )}${String(now.getDate()).padStart(2, "0")}_${String(
    now.getHours()
  ).padStart(2, "0")}${String(now.getMinutes()).padStart(2, "0")}${String(
    now.getSeconds()
  ).padStart(2, "0")}`;

  return `${safeBatchNo}_FILE-${file.sourceFileId}_${safeOriginalName}_${stamp}.xlsx`;
};

const saveGeneratedDocumentRecord = async ({
  connection,
  batch,
  sourceFileId = null,
  fileName,
  filePath,
  userId,
}) => {
  const columns = [
    "upload_batch_id",
    "template_id",
    "file_name",
    "document_name",
    "file_path",
    "file_type",
    "status",
    "generated_by",
  ];

  const values = [
    batch.batchId,
    batch.templateId,
    fileName,
    fileName,
    filePath,
    "xlsx",
    "DOWNLOADABLE",
    userId || null,
  ];

  if (sourceFileId !== null && sourceFileId !== undefined) {
    columns.splice(2, 0, "source_file_id");
    values.splice(2, 0, sourceFileId);
  }

  const placeholders = columns.map(() => "?").join(", ");

  const [result] = await connection.query(
    `
    INSERT INTO generated_documents
    (${columns.join(", ")})
    VALUES (${placeholders})
    `,
    values
  );

  await connection.query(
    `
    UPDATE upload_batches
    SET status = 'GENERATED',
        completed_at = CURRENT_TIMESTAMP
    WHERE id = ?
    `,
    [batch.batchId]
  );

  return result.insertId;
};

const generateExcelForBatch = async ({ batchId, userId }) => {
  const startTime = Date.now();
  const connection = await pool.getConnection();

  try {
    const batch = await loadBatchForExcel(batchId);
    const files = await loadSourceFilesForBatch(batchId);
    const mappings = batch?.templateId ? await loadMappings(batch.templateId) : [];

    const templateAbsolutePath = await validateGenerationPreconditions({
      batch,
      files,
      mappings,
    });

    const values = await loadExtractedValues(batchId);

    if (values.length === 0) {
      throw new Error(
        "엑셀에 입력할 추출값이 없습니다. OCR/AI 처리 결과를 먼저 확인해주세요."
      );
    }

    const { headerValues, detailRows } = groupValues(values);

    if (detailRows.length === 0) {
      throw new Error(
        "반복 내역에 입력할 추출값이 없습니다. 상세 항목 추출 또는 검토값을 확인해주세요."
      );
    }

    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.readFile(templateAbsolutePath);
    stripSharedFormulas(workbook);

    const singleAppliedCount = applySingleCellMappings({
      workbook,
      mappings,
      headerValues,
      batch,
    });

    const repeatAppliedCount = applyRepeatColumnMappings({
      workbook,
      mappings,
      detailRows,
    });

    if (singleAppliedCount + repeatAppliedCount === 0) {
      throw new Error(
        "템플릿 매핑 적용 결과가 0건입니다. 매핑 정보를 확인해주세요."
      );
    }

    const resultDir = getResultDir();
    const fileName = createGeneratedFileName(batch);
    const outputAbsolutePath = path.join(resultDir, fileName);

    await workbook.xlsx.writeFile(outputAbsolutePath);

    const storedPath = toStorageRelativePath(outputAbsolutePath);

    await connection.beginTransaction();

    const generatedDocumentId = await saveGeneratedDocumentRecord({
      connection,
      batch,
      fileName,
      filePath: storedPath,
      userId,
    });

    await connection.commit();

    console.log("\n" + "=".repeat(80));
    console.log("[EXCEL GENERATED]");
    console.log("batchId:", batch.batchId);
    console.log("templateAbsolutePath:", templateAbsolutePath);
    console.log("outputAbsolutePath:", outputAbsolutePath);
    console.log("storedPath:", storedPath);
    console.log("singleAppliedCount:", singleAppliedCount);
    console.log("repeatAppliedCount:", repeatAppliedCount);
    if (typeof mode !== "undefined") console.log("downloadMode:", mode);
    if (typeof totalAmount !== "undefined") console.log("totalAmount:", totalAmount);
    console.log("elapsedSec:", ((Date.now() - startTime) / 1000).toFixed(2));
    console.log("=".repeat(80) + "\n");

    return {
      generatedDocumentId,
      batchId: batch.batchId,
      templateId: batch.templateId,
      fileName,
      filePath: storedPath,
      downloadUrl: `/ai-storage/results/${fileName}`,
      singleAppliedCount,
      repeatAppliedCount,
      elapsedSec: ((Date.now() - startTime) / 1000).toFixed(2),
    };
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
};

const generateExcelForSourceFile = async ({ sourceFileId, userId }) => {
  const startTime = Date.now();
  const ids = normalizeSourceFileIds([sourceFileId]);

  if (ids.length !== 1) {
    throw new Error("엑셀을 생성할 원본 파일 정보를 찾을 수 없습니다.");
  }

  const files = await loadSelectedSourceFiles(ids);
  const file = files[0];
  const batch = await loadBatchForExcel(file.batchId);
  const mappings = batch?.templateId ? await loadMappings(batch.templateId) : [];

  const templateAbsolutePath = await validateGenerationPreconditions({
    batch,
    files,
    mappings,
  });

  const values = await loadExtractedValuesForSourceFiles(ids);

  if (values.length === 0) {
    throw new Error(
      "이 파일에 엑셀에 입력할 추출값이 없습니다. OCR/AI 처리 결과를 먼저 확인해주세요."
    );
  }

  const { headerValues, detailRows, totalAmount, mode } = groupSelectedValuesAsDetailRowsForSingleSourceFile({
    values,
    files,
    batch,
  });

  if (detailRows.length === 0) {
    throw new Error(
      "이 파일의 반복 내역에 입력할 추출값이 없습니다. 상세 항목 추출 또는 검토값을 확인해주세요."
    );
  }

  console.log("[SOURCE FILE EXCEL DETAIL ROWS]", detailRows.map((row) => ({
    sourceFileId: row.sourceFileId,
    rowIndex: row.rowIndex,
    description: row.values?.description,
    amount: row.values?.amount,
    category: row.values?.category,
  })));

  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.readFile(templateAbsolutePath);
  stripSharedFormulas(workbook);

  const singleAppliedCount = applySingleCellMappings({
    workbook,
    mappings,
    headerValues,
    batch,
  });

  const repeatAppliedCount = applyRepeatColumnMappings({
    workbook,
    mappings,
    detailRows,
  });

  if (singleAppliedCount + repeatAppliedCount === 0) {
    throw new Error(
      "템플릿 매핑 적용 결과가 0건입니다. 매핑 정보를 확인해주세요."
    );
  }

  const resultDir = getResultDir();
  const fileName = createSourceFileGeneratedFileName({ batch, file });
  const outputAbsolutePath = path.join(resultDir, fileName);

  await workbook.xlsx.writeFile(outputAbsolutePath);

  const storedPath = toStorageRelativePath(outputAbsolutePath);
  const connection = await pool.getConnection();

  try {
    await connection.beginTransaction();

    const generatedDocumentId = await saveGeneratedDocumentRecord({
      connection,
      batch,
      sourceFileId: file.sourceFileId,
      fileName,
      filePath: storedPath,
      userId,
    });

    await connection.commit();

    console.log("\n" + "=".repeat(80));
    console.log("[SOURCE FILE EXCEL GENERATED]");
    console.log("batchId:", batch.batchId);
    console.log("sourceFileId:", file.sourceFileId);
    console.log("originalFileName:", file.originalFileName);
    console.log("templateAbsolutePath:", templateAbsolutePath);
    console.log("outputAbsolutePath:", outputAbsolutePath);
    console.log("storedPath:", storedPath);
    console.log("singleAppliedCount:", singleAppliedCount);
    console.log("repeatAppliedCount:", repeatAppliedCount);
    if (typeof mode !== "undefined") console.log("downloadMode:", mode);
    if (typeof totalAmount !== "undefined") console.log("totalAmount:", totalAmount);
    console.log("elapsedSec:", ((Date.now() - startTime) / 1000).toFixed(2));
    console.log("=".repeat(80) + "\n");

    return {
      generatedDocumentId,
      batchId: batch.batchId,
      sourceFileId: file.sourceFileId,
      templateId: batch.templateId,
      fileName,
      filePath: storedPath,
      downloadUrl: `/ai-storage/results/${fileName}`,
      singleAppliedCount,
      repeatAppliedCount,
      elapsedSec: ((Date.now() - startTime) / 1000).toFixed(2),
    };
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
};

const normalizeSourceFileIds = (sourceFileIds = []) => {
  return [
    ...new Set(
      sourceFileIds
        .map((value) => Number(value))
        .filter((value) => Number.isInteger(value) && value > 0)
    ),
  ];
};

const loadSelectedSourceFiles = async (sourceFileIds) => {
  const ids = normalizeSourceFileIds(sourceFileIds);

  if (ids.length === 0) {
    throw new Error("선택된 파일이 없습니다. 다운로드할 행을 먼저 선택해주세요.");
  }

  const placeholders = ids.map(() => "?").join(", ");
  const orderPlaceholders = ids.map(() => "?").join(", ");

  const [files] = await pool.query(
    `
    SELECT
      sf.id AS sourceFileId,
      sf.upload_batch_id AS batchId,
      sf.status,
      sf.original_file_name AS originalFileName,
      COALESCE(file_info.total_amount, file_info.max_amount, 0) AS fileAmount,
      file_info.category_code AS fileCategoryCode,
      file_info.category_name AS fileCategoryName
    FROM source_files sf
    LEFT JOIN (
      SELECT
        ev.source_file_id,
        MAX(
          CASE
            WHEN ev.field_key IN (
              'total_amount', 'expense_total_amount', 'amount_total', 'payment_total_amount',
              'paid_amount', 'claim_amount', 'receipt_amount', 'grand_total',
              '지출총액', '총금액', '합계금액', '총액', '결제금액', '청구금액'
            )
            THEN CAST(
              NULLIF(
                REPLACE(REPLACE(REPLACE(REPLACE(COALESCE(ev.modified_value, ev.final_value, ev.normalized_value, ev.extracted_value, '0'), ',', ''), '원', ''), ' ', ''), '₩', ''),
                ''
              ) AS DECIMAL(15, 2)
            )
          END
        ) AS total_amount,
        MAX(
          CASE
            WHEN ev.field_key IN ('amount', 'expense_amount', 'payment_amount', 'price', 'cost', '금액', '지출금액', '사용금액')
            THEN CAST(
              NULLIF(
                REPLACE(REPLACE(REPLACE(REPLACE(COALESCE(ev.modified_value, ev.final_value, ev.normalized_value, ev.extracted_value, '0'), ',', ''), '원', ''), ' ', ''), '₩', ''),
                ''
              ) AS DECIMAL(15, 2)
            )
          END
        ) AS max_amount,
        MAX(ec.category_code) AS category_code,
        MAX(ec.category_name) AS category_name
      FROM extracted_values ev
      LEFT JOIN expense_categories ec ON ev.expense_category_id = ec.id
      GROUP BY ev.source_file_id
    ) file_info ON file_info.source_file_id = sf.id
    WHERE sf.id IN (${placeholders})
    ORDER BY FIELD(sf.id, ${orderPlaceholders})
    `,
    [...ids, ...ids]
  );

  if (files.length !== ids.length) {
    throw new Error("선택한 항목 중 서버에서 찾을 수 없는 파일이 있습니다.");
  }

  return files.map((file) => ({
    ...file,
    fileAmount: parseAmount(file.fileAmount),
    fileCategoryName: normalizeSelectedCategoryName(file.fileCategoryName || file.fileCategoryCode),
  }));
};

const loadExtractedValuesForSourceFiles = async (sourceFileIds) => {
  const ids = normalizeSourceFileIds(sourceFileIds);

  if (ids.length === 0) {
    return [];
  }

  const placeholders = ids.map(() => "?").join(", ");
  const orderPlaceholders = ids.map(() => "?").join(", ");

  const [rows] = await pool.query(
    `
    SELECT
      sf.id AS sourceFileId,
      sf.original_file_name AS originalFileName,
      ev.id AS extractedValueId,
      ev.field_key AS fieldKey,
      ev.field_label AS fieldLabel,
      ev.row_index AS rowIndex,
      COALESCE(ev.modified_value, ev.final_value, ev.normalized_value, ev.extracted_value) AS value,
      ev.expense_category_id AS expenseCategoryId,
      ec.category_code AS categoryCode,
      ec.category_name AS categoryName
    FROM source_files sf
    JOIN extracted_values ev ON sf.id = ev.source_file_id
    LEFT JOIN expense_categories ec ON ev.expense_category_id = ec.id
    WHERE sf.id IN (${placeholders})
    ORDER BY FIELD(sf.id, ${orderPlaceholders}), ev.row_index ASC, ev.id ASC
    `,
    [...ids, ...ids]
  );

  return rows;
};

const createSelectedTemplateFileName = ({ batch, selectedCount }) => {
  const safeBatchNo = String(batch.batchNo || `BATCH-${batch.batchId}`).replace(
    /[^\w가-힣-]/g,
    "_"
  );

  const safeTitle = String(batch.title || "선택_구매내역")
    .replace(/[^\w가-힣-]/g, "_")
    .slice(0, 40);

  const now = new Date();
  const stamp = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(
    2,
    "0"
  )}${String(now.getDate()).padStart(2, "0")}_${String(
    now.getHours()
  ).padStart(2, "0")}${String(now.getMinutes()).padStart(2, "0")}${String(
    now.getSeconds()
  ).padStart(2, "0")}`;

  return `${safeBatchNo}_${safeTitle}_선택${selectedCount}건_${stamp}.xlsx`;
};

const pickBaseBatchFromSelectedFiles = async (files) => {
  if (!files || files.length === 0) {
    throw new Error("선택된 파일이 없습니다.");
  }

  const baseBatchId = Number(files[0].batchId);

  if (!Number.isInteger(baseBatchId) || baseBatchId <= 0) {
    throw new Error("첫 번째 선택 행의 업로드 배치를 찾을 수 없습니다.");
  }

  return loadBatchForExcel(baseBatchId);
};


const SELECTED_TOTAL_AMOUNT_KEYS = new Set(
  [
    "total_amount",
    "expense_total_amount",
    "amount_total",
    "payment_total_amount",
    "paid_amount",
    "claim_amount",
    "receipt_amount",
    "sale_total_amount",
    "grand_total",
    "sum_amount",
    "total",
    "total_price",
    "지출총액",
    "총금액",
    "합계금액",
    "총액",
    "결제금액",
    "청구금액",
    "영수액",
  ].map(normalizeFieldKey)
);

const SELECTED_LINE_AMOUNT_KEYS = new Set(
  [
    "amount",
    "expense_amount",
    "line_amount",
    "item_amount",
    "payment_amount",
    "price",
    "cost",
    "금액",
    "지출금액",
    "사용금액",
  ].map(normalizeFieldKey)
);

const SELECTED_EXCLUDED_AMOUNT_KEYS = new Set(
  [
    "supply_amount",
    "tax_amount",
    "vat",
    "discount_amount",
    "point",
    "points",
    "unit_price",
    "quantity",
    "공급가액",
    "부가세",
    "부가가치세",
    "할인금액",
    "포인트",
    "단가",
    "수량",
  ].map(normalizeFieldKey)
);

const SELECTED_CATEGORY_KEYS = new Set(
  [
    "expense_category_name",
    "category",
    "expense_item",
    "purpose",
    "비목",
    "카테고리",
    "분류",
  ].map(normalizeFieldKey)
);

const SELECTED_DESCRIPTION_KEYS = new Set(
  [
    "description",
    "detail",
    "expense_detail",
    "use_detail",
    "usage_detail",
    "item_name",
    "product_name",
    "purchase_item",
    "route",
    "route_text",
    "memo",
    "note",
    "내역",
    "사용내역",
    "품목",
    "구매항목",
    "적요",
    "비고",
  ].map(normalizeFieldKey)
);

const toUniqueNonEmptyList = (values = []) => {
  const seen = new Set();
  const result = [];

  values.forEach((value) => {
    const text = String(value ?? "").trim();

    if (!text || seen.has(text)) return;

    seen.add(text);
    result.push(text);
  });

  return result;
};


const CATEGORY_CODE_TO_KOREAN = {
  MEAL: "식비",
  TRANSPORT: "교통비",
  LODGING: "숙박비",
  SUPPLIES: "소모품비",
  FUEL: "유류비",
  COMMUNICATION: "통신비",
  MATERIAL: "자재비",
  ETC: "기타",
  FOOD: "식비",
  TRAFFIC: "교통비",
  TRAVEL: "교통비",
};

const normalizeSelectedCategoryName = (value) => {
  const text = String(value ?? "").trim();
  if (!text) return "";

  const code = normalizeFieldKey(text).toUpperCase();
  if (CATEGORY_CODE_TO_KOREAN[code]) {
    return CATEGORY_CODE_TO_KOREAN[code];
  }

  // DB에 코드값(MEAL/TRANSPORT)이 한글명 자리에 저장된 경우도 여기서 보정한다.
  const upper = text.toUpperCase();
  if (CATEGORY_CODE_TO_KOREAN[upper]) {
    return CATEGORY_CODE_TO_KOREAN[upper];
  }

  return text;
};

const firstKoreanCategory = (...values) => {
  return firstNonEmpty(...values.map(normalizeSelectedCategoryName));
};

const setHeaderTotalAmount = (headerValues, totalAmount) => {
  const amount = Number.isFinite(Number(totalAmount)) ? Number(totalAmount) : 0;

  [
    "total_amount",
    "expense_total_amount",
    "amount_total",
    "payment_total_amount",
    "paid_amount",
    "claim_amount",
    "receipt_amount",
    "grand_total",
    "지출총액",
    "총금액",
    "합계금액",
    "총액",
    "결제금액",
    "청구금액",
  ].forEach((key) => headerValues.set(key, amount));
};

const isExcludedSelectedAmountField = (fieldKey) => {
  return SELECTED_EXCLUDED_AMOUNT_KEYS.has(normalizeFieldKey(fieldKey));
};

const isSelectedTotalAmountField = (fieldKey, fieldLabel) => {
  const key = normalizeFieldKey(fieldKey);

  return SELECTED_TOTAL_AMOUNT_KEYS.has(key) || isTotalField(fieldKey, fieldLabel);
};

const isSelectedLineAmountField = (fieldKey) => {
  const key = normalizeFieldKey(fieldKey);

  return SELECTED_LINE_AMOUNT_KEYS.has(key) || (isAmountKey(fieldKey) && !isExcludedSelectedAmountField(fieldKey));
};

const getAmountCandidate = (value) => {
  const amount = parseAmount(value);

  return Number.isFinite(amount) && amount > 0 ? amount : 0;
};

const pickTotalAmountForSourceFile = ({ values, sourceFileId, fallbackAmount = 0 }) => {
  const rows = values.filter((item) => Number(item.sourceFileId) === Number(sourceFileId));
  const totalCandidates = [];
  const headerAmountCandidates = [];
  const detailAmountByRowIndex = new Map();

  rows.forEach((item) => {
    const key = normalizeFieldKey(item.fieldKey);
    const rowIndex = Number(item.rowIndex || 0);

    if (!key || isExcludedSelectedAmountField(item.fieldKey)) return;

    const amount = getAmountCandidate(item.value);

    if (amount <= 0) return;

    // 핵심: total_amount가 row_index 1 이상으로 저장된 경우가 있어도 총액 후보로 본다.
    // 그렇지 않으면 총액 10,190 대신 품목 7,100 같은 부분 금액이 들어간다.
    if (isSelectedTotalAmountField(item.fieldKey, item.fieldLabel)) {
      totalCandidates.push(amount);
      return;
    }

    if (rowIndex <= 0 && isSelectedLineAmountField(item.fieldKey)) {
      headerAmountCandidates.push(amount);
      return;
    }

    if (!isSelectedLineAmountField(item.fieldKey)) return;

    const current = detailAmountByRowIndex.get(rowIndex) || 0;
    detailAmountByRowIndex.set(rowIndex, Math.max(current, amount));
  });

  if (totalCandidates.length > 0) {
    return Math.max(...totalCandidates);
  }

  if (headerAmountCandidates.length > 0) {
    return Math.max(...headerAmountCandidates);
  }

  const detailAmounts = Array.from(detailAmountByRowIndex.values()).filter((amount) => amount > 0);

  if (detailAmounts.length > 0) {
    return detailAmounts.reduce((sum, amount) => sum + amount, 0);
  }

  return parseAmount(fallbackAmount);
};

const pickDetailRowAmount = (row) => {
  const candidates = [];

  Object.entries(row.values || {}).forEach(([fieldKey, value]) => {
    if (isExcludedSelectedAmountField(fieldKey)) return;
    if (!isSelectedLineAmountField(fieldKey)) return;

    const amount = getAmountCandidate(value);

    if (amount > 0) {
      candidates.push(amount);
    }
  });

  if (candidates.length === 0) return 0;

  return Math.max(...candidates);
};

const pickDetailRowDescription = (row) => {
  return firstNonEmpty(
    row.values.description,
    row.values.detail,
    row.values.expense_detail,
    row.values.use_detail,
    row.values.usage_detail,
    row.values.item_name,
    row.values.product_name,
    row.values.purchase_item,
    row.values.내역,
    row.values.사용내역,
    row.values.품목,
    row.values.구매항목,
    row.values.vendor_name,
    row.values.vendor,
    row.originalFileName
  );
};

const normalizeSingleFileDetailRows = ({ detailRows, totalAmount }) => {
  // OCR/LLM 저장 과정에서 같은 품목의 품목명과 금액이 서로 다른 row_index로 들어가는 경우가 있다.
  // 예: 1행=두부김치/금액없음, 6행=내역없음/32,000.
  // 엑셀 출력 전에는 금액만 있는 행을 직전의 금액 없는 품목 행에 병합한다.
  const mergedRows = [];

  detailRows.forEach((row) => {
    const amount = pickDetailRowAmount(row);
    const description = String(pickDetailRowDescription(row) || "").trim();
    const isAmountOnly = amount > 0 && !description;

    if (isAmountOnly && mergedRows.length > 0) {
      // 바로 직전 행만 보지 않는다. OCR 저장 순서가 밀리면
      // 첫 품목명 행은 위에 있고 금액만 있는 행은 마지막에 생길 수 있다.
      const target = mergedRows.find((candidate) => {
        const candidateAmount = pickDetailRowAmount(candidate);
        const candidateDescription = String(pickDetailRowDescription(candidate) || "").trim();
        return candidateDescription && candidateAmount <= 0;
      });

      if (target) {
        target.values = {
          ...target.values,
          amount,
          expense_amount: amount,
          payment_amount: amount,
          price: amount,
          cost: amount,
          금액: amount,
          지출금액: amount,
          결제금액: amount,
          사용금액: amount,
        };
        return;
      }
    }

    mergedRows.push(row);
  });

  const normalizedRows = mergedRows
    .map((row) => {
      const amount = pickDetailRowAmount(row);
      const description = pickDetailRowDescription(row);
      const category = firstKoreanCategory(
        row.values.expense_category_name,
        row.values.expense_item,
        row.values.category,
        row.values.카테고리,
        row.values.분류
      );

      return {
        ...row,
        values: {
          ...row.values,
          description,
          detail: description,
          expense_detail: description,
          use_detail: description,
          usage_detail: description,
          item_name: description,
          product_name: description,
          purchase_item: description,
          내역: description,
          사용내역: description,
          품목: description,
          구매항목: description,

          expense_category_name: category || "기타",
          expense_item: category || "기타",
          category: category || "기타",
          remark: category || "",
          memo: category || "",
          비고: category || "",

          amount,
          expense_amount: amount,
          payment_amount: amount,
          price: amount,
          cost: amount,
          금액: amount,
          지출금액: amount,
          결제금액: amount,
          사용금액: amount,
        },
      };
    })
    .filter((row) => {
      const amount = parseAmount(row.values.amount);
      const description = String(row.values.description || "").trim();

      return amount > 0 || description !== "";
    });

  normalizedRows.forEach((row, index) => {
    row.rowIndex = index + 1;
    row.values.no = index + 1;
    row.values.line_no = index + 1;
    row.values.row_no = index + 1;
    row.values.number = index + 1;
    row.values.번호 = index + 1;
  });

  const detailSum = normalizedRows.reduce((sum, row) => sum + parseAmount(row.values.amount), 0);
  const diff = parseAmount(totalAmount) - detailSum;

  if (parseAmount(totalAmount) > 0 && detailSum > 0 && diff > 0) {
    const rowIndex = normalizedRows.length + 1;

    normalizedRows.push({
      sourceFileId: normalizedRows[0]?.sourceFileId || null,
      originalFileName: normalizedRows[0]?.originalFileName || "",
      rowIndex,
      values: {
        no: rowIndex,
        line_no: rowIndex,
        row_no: rowIndex,
        number: rowIndex,
        번호: rowIndex,
        description: "기타/미분류 금액",
        detail: "기타/미분류 금액",
        expense_detail: "기타/미분류 금액",
        use_detail: "기타/미분류 금액",
        usage_detail: "기타/미분류 금액",
        item_name: "기타/미분류 금액",
        product_name: "기타/미분류 금액",
        purchase_item: "기타/미분류 금액",
        내역: "기타/미분류 금액",
        사용내역: "기타/미분류 금액",
        품목: "기타/미분류 금액",
        구매항목: "기타/미분류 금액",
        expense_category_name: "기타",
        expense_item: "기타",
        category: "기타",
        remark: "기타",
        memo: "기타",
        비고: "기타",
        amount: diff,
        expense_amount: diff,
        payment_amount: diff,
        price: diff,
        cost: diff,
        금액: diff,
        지출금액: diff,
        결제금액: diff,
        사용금액: diff,
      },
    });
  }

  return normalizedRows;
};

const groupSelectedValuesAsDetailRowsForSingleSourceFile = ({ values, files, batch }) => {
  const { headerValues, detailRows } = groupValues(values);
  const sourceFileId = Number(files[0]?.sourceFileId);
  const selectedTotalAmount = pickTotalAmountForSourceFile({
    values,
    sourceFileId,
    fallbackAmount: files[0]?.fileAmount,
  });
  const normalizedDetailRows = normalizeSingleFileDetailRows({
    detailRows,
    totalAmount: selectedTotalAmount,
  });
  const detailSum = normalizedDetailRows.reduce((sum, row) => sum + parseAmount(row.values.amount), 0);
  const totalAmount = selectedTotalAmount > 0 ? selectedTotalAmount : detailSum;

  setHeaderTotalAmount(headerValues, totalAmount);

  return {
    headerValues,
    detailRows: normalizedDetailRows,
    totalAmount,
    mode: "SINGLE_FILE_DETAIL",
  };
};

const pickCategoryForSelectedSummary = ({ values, sourceFileId, file }) => {
  const candidates = [];

  if (file?.fileCategoryName) candidates.push(file.fileCategoryName);
  if (file?.fileCategoryCode) candidates.push(file.fileCategoryCode);

  values.forEach((item) => {
    if (Number(item.sourceFileId) !== Number(sourceFileId)) return;

    const key = normalizeFieldKey(item.fieldKey);
    const value = item.value;

    if (item.categoryName) candidates.push(item.categoryName);
    if (item.categoryCode) candidates.push(item.categoryCode);

    if (SELECTED_CATEGORY_KEYS.has(key) || key.includes("category") || key.includes("분류")) {
      candidates.push(value);
    }
  });

  return firstKoreanCategory(...toUniqueNonEmptyList(candidates), "기타");
};

const pickVendorOrSummaryForSelectedFile = ({ values, sourceFileId, originalFileName }) => {
  const candidates = [];

  values.forEach((item) => {
    if (Number(item.sourceFileId) !== Number(sourceFileId)) return;

    const key = normalizeFieldKey(item.fieldKey);

    if (isVendorKey(item.fieldKey) || key.includes("vendor") || key.includes("store") || key.includes("merchant")) {
      candidates.push(item.value);
    }
  });

  return firstNonEmpty(...toUniqueNonEmptyList(candidates), originalFileName);
};


const SELECTED_DETAIL_EXCLUDED_KEYS_FOR_SUMMARY = new Set(
  [
    "amount",
    "expense_amount",
    "line_amount",
    "item_amount",
    "payment_amount",
    "total_amount",
    "expense_total_amount",
    "receipt_amount",
    "claim_amount",
    "paid_amount",
    "grand_total",
    "total",
    "price",
    "cost",
    "unit_price",
    "quantity",
    "supply_amount",
    "tax_amount",
    "vat",
    "discount_amount",
    "point",
    "points",
    "date",
    "receipt_date",
    "expense_date",
    "payment_date",
    "approval_number",
    "card_number",
    "business_number",
    "payment_method",
    "expense_category_code",
    "expense_category_name",
    "category",
    "expense_item",
    "memo",
    "remark",
    "비고",
    "카테고리",
    "분류",
    "금액",
    "지출금액",
    "결제금액",
    "사용금액",
    "총액",
    "총금액",
    "합계금액",
    "공급가액",
    "부가세",
    "부가가치세",
    "단가",
    "수량",
  ].map(normalizeFieldKey)
);

const sanitizeSummaryDescriptionText = (value, category) => {
  const text = String(value ?? "")
    .replace(/[\r\n\t]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  if (!text) return "";
  if (text.length <= 1) return "";
  if (/^[\d,.\-\s원]+$/.test(text)) return "";
  if (/^\d{2,4}[-./]\d{1,2}[-./]\d{1,2}/.test(text)) return "";

  const normalizedText = normalizeSelectedCategoryName(text);
  const normalizedCategory = normalizeSelectedCategoryName(category);

  if (normalizedCategory && normalizedText === normalizedCategory) return "";
  if (["MEAL", "TRANSPORT", "SUPPLIES", "FUEL", "LODGING", "ETC"].includes(text.toUpperCase())) return "";

  return text.length > 42 ? `${text.slice(0, 42)}…` : text;
};

const buildTransportSummaryText = ({ values, sourceFileId }) => {
  const rowValues = values.filter((item) => Number(item.sourceFileId) === Number(sourceFileId));
  const getByKeys = (...keys) => {
    const normalizedKeys = keys.map(normalizeFieldKey);
    const match = rowValues.find((item) => normalizedKeys.includes(normalizeFieldKey(item.fieldKey)));
    return String(match?.value ?? "").trim();
  };

  const from = getByKeys("route_from", "departure", "departure_station", "from", "출발", "출발지");
  const to = getByKeys("route_to", "arrival", "arrival_station", "to", "도착", "도착지");
  const vehicle = getByKeys("transport_type", "vehicle_type", "교통수단") || "버스";

  if (from && to && from !== to) {
    return `${vehicle} ${from} → ${to}`;
  }

  return getByKeys("route", "route_text", "노선", "구간");
};

const collectDetailDescriptionsForSelectedFile = ({ values, sourceFileId, category }) => {
  const rowsByIndex = new Map();

  values.forEach((item) => {
    if (Number(item.sourceFileId) !== Number(sourceFileId)) return;

    const rowIndex = Number(item.rowIndex || 0);
    if (rowIndex <= 0) return;

    const key = normalizeFieldKey(item.fieldKey);
    if (!key || SELECTED_DETAIL_EXCLUDED_KEYS_FOR_SUMMARY.has(key)) return;
    if (isExcludedSelectedAmountField(item.fieldKey) || isSelectedLineAmountField(item.fieldKey)) return;
    if (isDateKey(item.fieldKey) || isVendorKey(item.fieldKey)) return;

    const isDescriptionCandidate =
      SELECTED_DESCRIPTION_KEYS.has(key) ||
      isDescriptionKey(item.fieldKey) ||
      key.includes("item") ||
      key.includes("product") ||
      key.includes("detail") ||
      key.includes("description") ||
      key.includes("품목") ||
      key.includes("내역") ||
      key.includes("항목");

    if (!isDescriptionCandidate) return;

    const text = sanitizeSummaryDescriptionText(item.value, category);
    if (!text) return;

    if (!rowsByIndex.has(rowIndex)) rowsByIndex.set(rowIndex, []);
    rowsByIndex.get(rowIndex).push(text);
  });

  const descriptions = [];
  [...rowsByIndex.keys()].sort((a, b) => a - b).forEach((rowIndex) => {
    const candidates = toUniqueNonEmptyList(rowsByIndex.get(rowIndex));
    const preferred = firstNonEmpty(
      ...candidates.filter((text) => !text.includes("/") && !text.includes("총")),
      ...candidates
    );

    if (preferred) descriptions.push(preferred);
  });

  return toUniqueNonEmptyList(descriptions);
};

const buildMultiFileSummaryDescription = ({ values, sourceFileId, category, vendorOrFile }) => {
  const normalizedCategory = normalizeSelectedCategoryName(category) || "기타";
  const transportSummary = normalizedCategory === "교통비"
    ? sanitizeSummaryDescriptionText(buildTransportSummaryText({ values, sourceFileId }), normalizedCategory)
    : "";

  if (transportSummary) {
    return transportSummary;
  }

  const detailDescriptions = collectDetailDescriptionsForSelectedFile({
    values,
    sourceFileId,
    category: normalizedCategory,
  });

  if (detailDescriptions.length >= 2) {
    return `${detailDescriptions[0]} 외 ${detailDescriptions.length - 1}건`;
  }

  if (detailDescriptions.length === 1) {
    return detailDescriptions[0];
  }

  const fallback = sanitizeSummaryDescriptionText(vendorOrFile, normalizedCategory);
  return fallback || normalizedCategory;
};

const setRowAmountAliases = (target, amount) => {
  const normalizedAmount = Number.isFinite(Number(amount)) ? Number(amount) : 0;

  [
    "amount",
    "expense_amount",
    "line_amount",
    "item_amount",
    "payment_amount",
    "receipt_amount",
    "claim_amount",
    "paid_amount",
    "total_amount",
    "expense_total_amount",
    "grand_total",
    "total",
    "price",
    "cost",
    "금액",
    "지출금액",
    "결제금액",
    "사용금액",
    "영수액",
    "총액",
    "총금액",
    "합계금액",
    "청구금액",
  ].forEach((key) => {
    target[key] = normalizedAmount;
  });
};

const groupSelectedValuesAsOneSummaryRowPerSourceFile = ({ values, files, batch }) => {
  const headerValues = new Map();
  const detailRows = files.map((file, index) => {
    const sourceFileId = Number(file.sourceFileId);
    const category = pickCategoryForSelectedSummary({ values, sourceFileId, file });
    const amount = pickTotalAmountForSourceFile({
      values,
      sourceFileId,
      fallbackAmount: file.fileAmount,
    });
    const vendorOrFile = pickVendorOrSummaryForSelectedFile({
      values,
      sourceFileId,
      originalFileName: file.originalFileName,
    });

    // 2건 이상 병합 다운로드는 파일/영수증 1건당 1줄로 출력한다.
    // 내역은 "식비"만 쓰지 않고 "식비 / 대표품목 외 N개" 또는 "교통비 / 버스 A → B"로 요약한다.
    // 금액은 세부 품목 금액이 아니라 해당 영수증의 총금액을 사용한다.
    const description = buildMultiFileSummaryDescription({
      values,
      sourceFileId,
      category,
      vendorOrFile: vendorOrFile || file.originalFileName,
    });

    const rowValues = {
      no: index + 1,
      line_no: index + 1,
      row_no: index + 1,
      number: index + 1,
      번호: index + 1,

      department_name: batch.departmentName || "",
      department: batch.departmentName || "",
      부서: batch.departmentName || "",

      site_name: batch.siteName || batch.batchSiteName || "",
      site: batch.siteName || batch.batchSiteName || "",
      현장: batch.siteName || batch.batchSiteName || "",

      user_name: batch.userName || "",
      submitter_name: batch.userName || "",
      사용자: batch.userName || "",
      성명: batch.userName || "",

      expense_title: batch.title || batch.batchNo || "",
      title: batch.title || batch.batchNo || "",
      제목: batch.title || batch.batchNo || "",

      description,
      detail: description,
      expense_detail: description,
      use_detail: description,
      usage_detail: description,
      item_name: description,
      product_name: description,
      purchase_item: description,
      내역: description,
      사용내역: description,
      품목: description,
      구매항목: description,

      expense_category_name: category,
      expense_item: category,
      category,
      remark: category,
      memo: category,
      비고: category,
    };

    setRowAmountAliases(rowValues, amount);

    return {
      sourceFileId,
      originalFileName: file.originalFileName,
      rowIndex: index + 1,
      values: rowValues,
    };
  });

  const totalAmount = detailRows.reduce((sum, row) => sum + parseAmount(row.values.amount), 0);

  setHeaderTotalAmount(headerValues, totalAmount);

  return {
    headerValues,
    detailRows,
    totalAmount,
    mode: "MULTI_FILE_SUMMARY",
  };
};

const groupSelectedValuesForDownload = ({ values, files, batch }) => {
  if (files.length === 1) {
    return groupSelectedValuesAsDetailRowsForSingleSourceFile({ values, files, batch });
  }

  return groupSelectedValuesAsOneSummaryRowPerSourceFile({ values, files, batch });
};

const generateExcelForSelectedSourceFiles = async ({ sourceFileIds, userId }) => {
  const startTime = Date.now();
  const ids = normalizeSourceFileIds(sourceFileIds);

  if (ids.length === 0) {
    throw new Error("선택된 파일이 없습니다. 다운로드할 행을 먼저 선택해주세요.");
  }

  const files = await loadSelectedSourceFiles(ids);

  const batch = await pickBaseBatchFromSelectedFiles(files);
  const mappings = batch?.templateId ? await loadMappings(batch.templateId) : [];

  const templateAbsolutePath = await validateGenerationPreconditions({
    batch,
    files,
    mappings,
  });

  const values = await loadExtractedValuesForSourceFiles(ids);

  if (values.length === 0) {
    throw new Error(
      "선택한 행에 엑셀에 입력할 추출값이 없습니다. OCR/AI 처리 결과를 먼저 확인해주세요."
    );
  }

  const { headerValues, detailRows, totalAmount, mode } =
    groupSelectedValuesForDownload({
      values,
      files,
      batch,
    });

  if (detailRows.length === 0) {
    throw new Error("선택한 행을 반복 내역으로 구성하지 못했습니다.");
  }

  console.log("[SELECTED EXCEL DETAIL ROWS]", detailRows.map((row) => ({
    sourceFileId: row.sourceFileId,
    rowIndex: row.rowIndex,
    description: row.values?.description,
    amount: row.values?.amount,
    category: row.values?.category,
  })));

  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.readFile(templateAbsolutePath);
  stripSharedFormulas(workbook);

  const singleAppliedCount = applySingleCellMappings({
    workbook,
    mappings,
    headerValues,
    batch,
  });

  const repeatAppliedCount = applyRepeatColumnMappings({
    workbook,
    mappings,
    detailRows,
  });

  if (singleAppliedCount + repeatAppliedCount === 0) {
    throw new Error("템플릿 매핑 적용 결과가 0건입니다. 매핑 정보를 확인해주세요.");
  }

  const fileName = createSelectedTemplateFileName({
    batch,
    selectedCount: files.length,
  });

  const buffer = await workbook.xlsx.writeBuffer();
  const selectedBatchIds = [...new Set(files.map((file) => Number(file.batchId)))];

  console.log("\n" + "=".repeat(80));
  console.log("[SELECTED TEMPLATE EXCEL GENERATED]");
  console.log("baseBatchId:", batch.batchId);
  console.log("selectedBatchIds:", selectedBatchIds);
  console.log("sourceFileIds:", ids);
  console.log("templateName:", batch.templateName);
  console.log("templateAbsolutePath:", templateAbsolutePath);
  console.log("fileName:", fileName);
  console.log("downloadMode:", mode);
  console.log("selectedRows:", detailRows.length);
  console.log("totalAmount:", totalAmount);
  console.log("singleAppliedCount:", singleAppliedCount);
  console.log("repeatAppliedCount:", repeatAppliedCount);
  console.log("elapsedSec:", ((Date.now() - startTime) / 1000).toFixed(2));
  console.log("=".repeat(80) + "\n");

  return {
    buffer: Buffer.from(buffer),
    fileName,
    batchId: batch.batchId,
    selectedBatchIds,
    templateId: batch.templateId,
    templateName: batch.templateName,
    selectedCount: files.length,
    totalAmount,
    singleAppliedCount,
    repeatAppliedCount,
    userId: userId || null,
    elapsedSec: ((Date.now() - startTime) / 1000).toFixed(2),
  };
};

module.exports = {
  generateExcelForBatch,
  generateExcelForSourceFile,
  generateExcelForSelectedSourceFiles,
};