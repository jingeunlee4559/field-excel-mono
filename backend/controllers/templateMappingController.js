const fs = require('fs');
const path = require('path');
const axios = require('axios');
const ExcelJS = require('exceljs');

const pool = require('../config/db');
const asyncHandler = require('../utils/asyncHandler');
const createAuditLog = require('../utils/createAuditLog');
const { getPythonAiBaseUrl } = require('../services/aiTemplateStorageService');
const { resolveStorageFilePath } = require('../utils/storagePath');

const normalizeCellValue = (value) => {
  if (value === null || value === undefined) return '';

  if (typeof value === 'object') {
    if (value.text) return String(value.text).trim();
    if (value.result !== undefined) return String(value.result).trim();

    if (Array.isArray(value.richText)) {
      return value.richText.map((item) => item.text || '').join('').trim();
    }

    if (value.hyperlink && value.text) return String(value.text).trim();

    return String(value).trim();
  }

  return String(value).trim();
};

const resolveTemplatePath = (filePath) => {
  if (!filePath) return null;
  return resolveStorageFilePath(filePath, 'templates');
};

const getColumnLetter = (columnNumber) => {
  let number = Number(columnNumber);
  let letter = '';

  while (number > 0) {
    const remainder = (number - 1) % 26;
    letter = String.fromCharCode(65 + remainder) + letter;
    number = Math.floor((number - 1) / 26);
  }

  return letter;
};

const columnLetterToNumber = (letters) => {
  return String(letters || '')
    .toUpperCase()
    .split('')
    .reduce((sum, char) => sum * 26 + char.charCodeAt(0) - 64, 0);
};

const parseCellAddress = (address) => {
  const match = String(address || '').toUpperCase().match(/^([A-Z]+)(\d+)$/);

  if (!match) return null;

  return {
    columnLetter: match[1],
    col: columnLetterToNumber(match[1]),
    row: Number(match[2]),
  };
};

const getCellAddress = (row, col) => `${getColumnLetter(col)}${row}`;

const decodeRange = (range) => {
  const [start, end] = String(range || '').split(':');
  const startCell = parseCellAddress(start);
  const endCell = parseCellAddress(end || start);

  if (!startCell || !endCell) return null;

  return {
    start,
    end: end || start,
    minRow: Math.min(startCell.row, endCell.row),
    maxRow: Math.max(startCell.row, endCell.row),
    minCol: Math.min(startCell.col, endCell.col),
    maxCol: Math.max(startCell.col, endCell.col),
  };
};

const getMergeRanges = (worksheet) => {
  const ranges = [];

  if (Array.isArray(worksheet.model?.merges)) {
    worksheet.model.merges.forEach((range) => {
      const decoded = decodeRange(range);
      if (decoded) ranges.push(decoded);
    });
  }

  if (worksheet._merges) {
    Object.values(worksheet._merges).forEach((merge) => {
      const rangeText = merge.range || merge.model?.range;
      const decoded = decodeRange(rangeText);

      if (
        decoded &&
        !ranges.some((item) => item.start === decoded.start && item.end === decoded.end)
      ) {
        ranges.push(decoded);
      }
    });
  }

  return ranges;
};

const findNextInputCellAddress = (worksheet, rowNumber, columnNumber) => {
  for (let offset = 1; offset <= 4; offset += 1) {
    const targetColumn = columnNumber + offset;
    const targetCell = worksheet.getCell(rowNumber, targetColumn);
    const targetText = normalizeCellValue(targetCell.value);

    if (!targetText) {
      return targetCell.address;
    }
  }

  return worksheet.getCell(rowNumber, columnNumber + 1).address;
};

const isLikelyLabel = (text) => {
  if (!text) return false;
  if (text.length > 40) return false;

  const normalized = text.replace(/\s/g, '');

  const labelKeywords = [
    '번호',
    '일자',
    '날짜',
    '사용일',
    '거래일',
    '현장',
    '공종',
    '거래처',
    '업체',
    '사용처',
    '항목',
    '품목',
    '내역',
    '내용',
    '적요',
    '수량',
    '단가',
    '금액',
    '합계',
    '총액',
    '결제',
    '비고',
    '담당',
    '작성',
    '청구',
    '부서',
    '성명',
    '이름',
    '사용자',
    '청구서',
  ];

  return labelKeywords.some((keyword) => normalized.includes(keyword));
};

const inferFieldKey = (text) => {
  const normalized = String(text || '').replace(/\s/g, '');

  const rules = [
    { key: 'line_no', words: ['번호', 'No', 'NO'] },
    { key: 'expense_date', words: ['사용일자', '사용일', '거래일자', '거래일', '결제일자', '승인일자', '일자', '날짜'] },
    { key: 'department_name', words: ['부서명', '부서'] },
    { key: 'user_name', words: ['사용자', '작성자', '담당자', '성명', '이름'] },
    { key: 'expense_title', words: ['제목', '문서명'] },
    { key: 'total_amount', words: ['지출총액', '총액', '총금액', '합계금액'] },
    { key: 'vendor_name', words: ['사용처', '거래처명', '거래처', '업체명', '업체'] },
    { key: 'expense_category_name', words: ['항목', '경비항목', '비용항목', '경비분류', '분류'] },
    { key: 'description', words: ['사용내역', '내역', '내용', '품목', '품목명', '상품명', '적요'] },
    { key: 'amount', words: ['공급가액', '금액', '합계'] },
    { key: 'payment_method', words: ['결제수단', '결제', '카드'] },
    { key: 'note', words: ['비고', '메모', '참고'] },
  ];

  const matched = rules.find((rule) => rule.words.some((word) => normalized.includes(word)));

  return matched?.key || '';
};

const normalizeMappingType = (mappingType) => {
  const value = String(mappingType || '').toUpperCase();

  if (value === 'REPEAT_COLUMN' || value === 'DETAIL' || value === 'COLUMN') {
    return 'REPEAT_COLUMN';
  }

  if (value === 'SINGLE_CELL' || value === 'SINGLE' || value === 'CELL') {
    return 'SINGLE_CELL';
  }

  return 'SINGLE_CELL';
};

const requestPythonPreviewByFilePath = async ({ filePath, sheetName }) => {
  try {
    const response = await axios.post(
      `${getPythonAiBaseUrl()}/api/excel/preview`,
      {
        filePath,
        sheetName: sheetName || null,
      },
      {
        timeout: Number(process.env.PYTHON_AI_TIMEOUT_MS || 120000),
      }
    );

    return response.data;
  } catch (error) {
    if (error.code === 'ECONNREFUSED') {
      throw new Error(
        `Python AI 서버에 연결하지 못했습니다. FastAPI 서버를 먼저 실행하고 PYTHON_AI_BASE_URL=${getPythonAiBaseUrl()} 설정을 확인하세요.`
      );
    }

    throw new Error(
      error.response?.data?.detail ||
        error.response?.data?.message ||
        error.message ||
        'Python openpyxl 미리보기 생성 중 오류가 발생했습니다.'
    );
  }
};

const buildWorkbookPreview = async (template, requestedSheetName) => {
  const aiTemplatePath = template.filePath || template.file_path;

  if (!aiTemplatePath) {
    return {
      template,
      sheetNames: [],
      preview: null,
      warning: '템플릿 파일 경로가 DB에 저장되어 있지 않습니다. 템플릿을 다시 등록하세요.',
      engine: 'openpyxl',
    };
  }

  const extension = path.extname(aiTemplatePath).toLowerCase();

  if (!['.xlsx', '.xlsm', '.xltx', '.xltm'].includes(extension)) {
    return {
      template,
      sheetNames: [],
      preview: null,
      warning:
        'openpyxl 기반 엑셀 미리보기는 .xlsx/.xlsm 템플릿만 지원합니다. .xls 파일은 .xlsx로 변환해서 등록하세요.',
      engine: 'openpyxl',
    };
  }

  const pythonResponse = await requestPythonPreviewByFilePath({
    filePath: aiTemplatePath,
    sheetName: requestedSheetName || '',
  });

  if (!pythonResponse?.success) {
    return {
      template,
      sheetNames: [],
      preview: null,
      warning: pythonResponse?.message || 'Python openpyxl 미리보기 생성에 실패했습니다.',
      engine: 'openpyxl',
    };
  }

  const data = pythonResponse.data || {};
  const preview = data.preview || null;
  const openpyxlTemplate = data.template || {};

  return {
    template,
    sheetNames: openpyxlTemplate.sheetNames || [],
    preview,
    warning: null,
    engine: 'openpyxl',
  };
};

const buildTemplateCandidateRows = async (template) => {
  const absolutePath = resolveTemplatePath(template.filePath || template.file_path);

  if (!absolutePath || !fs.existsSync(absolutePath)) {
    return {
      candidates: [],
      warning:
        '템플릿 파일 경로를 Node 서버에서 찾을 수 없습니다. 현재 구조에서는 openpyxl 미리보기 화면에서 직접 셀을 선택하는 방식을 사용하세요.',
    };
  }

  const extension = path.extname(absolutePath).toLowerCase();

  if (!['.xlsx', '.xlsm'].includes(extension)) {
    return {
      candidates: [],
      warning:
        '현재 자동 후보 추출은 .xlsx/.xlsm 템플릿만 지원합니다. .xls 파일은 .xlsx로 변환해서 등록하세요.',
    };
  }

  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.readFile(absolutePath);

  const candidates = [];
  const seen = new Set();

  workbook.worksheets.forEach((worksheet) => {
    const maxRow = Math.min(worksheet.actualRowCount || 40, 40);
    const maxCol = Math.min(worksheet.actualColumnCount || 20, 20);

    for (let rowNumber = 1; rowNumber <= maxRow; rowNumber += 1) {
      for (let columnNumber = 1; columnNumber <= maxCol; columnNumber += 1) {
        const cell = worksheet.getCell(rowNumber, columnNumber);
        const text = normalizeCellValue(cell.value);

        if (!isLikelyLabel(text)) continue;

        const cellAddress = findNextInputCellAddress(worksheet, rowNumber, columnNumber);
        const uniqueKey = `${worksheet.name}:${cellAddress}`;

        if (seen.has(uniqueKey)) continue;
        seen.add(uniqueKey);

        candidates.push({
          rowId: uniqueKey,
          sheetName: worksheet.name,
          detectedLabel: text,
          labelCellAddress: cell.address,
          mappingType: 'SINGLE_CELL',
          cellAddress,
          columnLetter: null,
          startRow: null,
          maxRows: null,
          suggestedFieldKey: inferFieldKey(text),
          confidence: inferFieldKey(text) ? 0.75 : 0.35,
        });
      }
    }
  });

  return {
    candidates: candidates.slice(0, 80),
    warning:
      candidates.length === 0
        ? '엑셀에서 자동 매핑 후보를 찾지 못했습니다. 화면에서 셀을 직접 선택하세요.'
        : null,
  };
};

const getTemplateById = async (templateId) => {
  const [templateRows] = await pool.query(
    `
    SELECT
      id AS templateId,
      template_name AS templateName,
      template_name AS name,
      original_file_name AS originalFileName,
      stored_file_name AS storedFileName,
      file_path AS filePath,
      file_type AS fileType,
      version,
      status,
      is_active AS isActive,
      is_locked AS isLocked
    FROM templates
    WHERE id = ?
    LIMIT 1
    `,
    [templateId]
  );

  return templateRows[0] || null;
};

const getTemplateMappings = asyncHandler(async (req, res) => {
  const { templateId } = req.params;
  const template = await getTemplateById(templateId);

  if (!template) {
    return res.status(404).json({ message: '템플릿을 찾을 수 없습니다.' });
  }

  const [mappings] = await pool.query(
    `
    SELECT
      tm.id AS mappingId,
      tm.field_key AS fieldKey,
      tm.field_label AS fieldLabel,
      COALESCE(sf.field_name, tm.field_label) AS fieldName,
      sf.field_scope AS fieldScope,
      sf.data_type AS dataType,
      tm.mapping_type AS mappingType,
      tm.sheet_name AS sheetName,
      tm.cell_address AS cellAddress,
      tm.column_letter AS columnLetter,
      tm.start_row AS startRow,
      tm.max_rows AS maxRows,
      tm.is_required AS isRequired,
      tm.sort_order AS sortOrder,
      tm.is_locked AS isLocked
    FROM template_mappings tm
    LEFT JOIN standard_fields sf ON tm.standard_field_id = sf.id
    WHERE tm.template_id = ?
    ORDER BY tm.sort_order ASC, tm.id ASC
    `,
    [templateId]
  );

  return res.json({ ...template, mappings });
});

const getTemplateMappingCandidates = asyncHandler(async (req, res) => {
  const { templateId } = req.params;
  const template = await getTemplateById(templateId);

  if (!template) {
    return res.status(404).json({ message: '템플릿을 찾을 수 없습니다.' });
  }

  const result = await buildTemplateCandidateRows(template);

  return res.json({
    template,
    candidates: result.candidates,
    warning: result.warning,
  });
});

const getTemplateMappingPreview = asyncHandler(async (req, res) => {
  const { templateId } = req.params;
  const { sheetName } = req.query;

  const template = await getTemplateById(templateId);

  if (!template) {
    return res.status(404).json({ message: '템플릿을 찾을 수 없습니다.' });
  }

  const result = await buildWorkbookPreview(template, sheetName);

  return res.json(result);
});

const createTemplateMappings = asyncHandler(async (req, res) => {
  const { templateId } = req.params;
  const { mappings } = req.body;

  if (!Array.isArray(mappings) || mappings.length === 0) {
    return res.status(400).json({
      success: false,
      message: '저장할 매핑 정보가 없습니다.',
    });
  }

  const [templateRows] = await pool.query(
    `
    SELECT
      id,
      is_locked AS isLocked
    FROM templates
    WHERE id = ?
    LIMIT 1
    `,
    [templateId]
  );

  if (templateRows.length === 0) {
    return res.status(404).json({
      success: false,
      message: '템플릿을 찾을 수 없습니다.',
    });
  }

  if (templateRows[0].isLocked) {
    return res.status(400).json({
      success: false,
      message: '잠금 처리된 템플릿에는 매핑을 추가할 수 없습니다.',
    });
  }

  const selectedFieldKeys = mappings
    .map((mapping) => mapping.fieldKey)
    .filter(Boolean);

  const duplicatedFieldKeys = selectedFieldKeys.filter(
    (fieldKey, index) => selectedFieldKeys.indexOf(fieldKey) !== index
  );

  if (duplicatedFieldKeys.length > 0) {
    return res.status(400).json({
      success: false,
      message: `같은 표준 필드가 중복 선택되었습니다: ${[...new Set(duplicatedFieldKeys)].join(', ')}`,
    });
  }

  const connection = await pool.getConnection();

  try {
    await connection.beginTransaction();

    let savedCount = 0;

    for (const mapping of mappings) {
      if (!mapping.fieldKey) continue;

      const [fieldRows] = await connection.query(
        `
        SELECT
          id,
          field_key,
          COALESCE(field_label, field_name) AS field_label,
          COALESCE(field_name, field_label) AS field_name,
          is_required,
          sort_order,
          default_mapping_type
        FROM standard_fields
        WHERE field_key = ?
          AND is_active = TRUE
        LIMIT 1
        `,
        [mapping.fieldKey]
      );

      if (fieldRows.length === 0) {
        throw new Error(`표준 필드를 찾을 수 없습니다: ${mapping.fieldKey}`);
      }

      const field = fieldRows[0];
      const mappingType = normalizeMappingType(mapping.mappingType || field.default_mapping_type);

      const sheetName = mapping.sheetName || 'Sheet1';

      const cellAddress =
        mappingType === 'SINGLE_CELL'
          ? mapping.cellAddress || null
          : null;

      const columnLetter =
        mappingType === 'REPEAT_COLUMN'
          ? mapping.columnLetter || null
          : null;

      const startRow =
        mappingType === 'REPEAT_COLUMN'
          ? Number(mapping.startRow || 0) || null
          : null;

      const maxRows =
        mappingType === 'REPEAT_COLUMN'
          ? Number(mapping.maxRows || 0) || null
          : null;

      if (mappingType === 'SINGLE_CELL' && !cellAddress) {
        throw new Error(`${field.field_label} 필드는 단일 셀 주소가 필요합니다.`);
      }

      if (mappingType === 'REPEAT_COLUMN' && (!columnLetter || !startRow)) {
        throw new Error(`${field.field_label} 필드는 반복 컬럼과 시작 행이 필요합니다.`);
      }

      await connection.query(
        `
        INSERT INTO template_mappings
        (
          template_id,
          standard_field_id,
          field_key,
          field_label,
          mapping_type,
          sheet_name,
          cell_address,
          column_letter,
          start_row,
          max_rows,
          is_required,
          sort_order,
          is_locked,
          created_by
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, FALSE, ?)
        ON DUPLICATE KEY UPDATE
          standard_field_id = VALUES(standard_field_id),
          field_label = VALUES(field_label),
          mapping_type = VALUES(mapping_type),
          sheet_name = VALUES(sheet_name),
          cell_address = VALUES(cell_address),
          column_letter = VALUES(column_letter),
          start_row = VALUES(start_row),
          max_rows = VALUES(max_rows),
          is_required = VALUES(is_required),
          sort_order = VALUES(sort_order),
          updated_at = CURRENT_TIMESTAMP
        `,
        [
          Number(templateId),
          field.id,
          field.field_key,
          field.field_label,
          mappingType,
          sheetName,
          cellAddress,
          columnLetter,
          startRow,
          maxRows,
          Boolean(mapping.isRequired ?? field.is_required),
          mapping.sortOrder ?? field.sort_order ?? 0,
          req.user?.id || null,
        ]
      );

      savedCount += 1;
    }

    await connection.commit();

    await createAuditLog({
      userId: req.user?.id || null,
      actionType: 'TEMPLATE_MAPPINGS_SAVED',
      action: 'TEMPLATE_MAPPINGS_SAVED',
      targetTable: 'template_mappings',
      targetType: 'template_mappings',
      targetId: Number(templateId),
      afterData: { savedCount },
      ipAddress: req.ip,
    });

    return res.status(201).json({
      success: true,
      templateId: Number(templateId),
      savedCount,
      message: '템플릿 매핑이 저장되었습니다.',
    });
  } catch (error) {
    await connection.rollback();

    console.error('[createTemplateMappings] error:', error);

    return res.status(500).json({
      success: false,
      message: '템플릿 매핑 저장 중 오류가 발생했습니다.',
      error: error.message,
    });
  } finally {
    connection.release();
  }
});

const lockTemplateMappings = asyncHandler(async (req, res) => {
  const { templateId } = req.params;

  await pool.query(
    `
    UPDATE template_mappings
    SET
      is_locked = TRUE,
      locked_by = ?,
      locked_at = CURRENT_TIMESTAMP
    WHERE template_id = ?
    `,
    [req.user?.id || null, templateId]
  );

  await createAuditLog({
    userId: req.user?.id || null,
    actionType: 'TEMPLATE_MAPPINGS_LOCKED',
    action: 'TEMPLATE_MAPPINGS_LOCKED',
    targetTable: 'template_mappings',
    targetType: 'template_mappings',
    targetId: Number(templateId),
    afterData: { isLocked: true },
    ipAddress: req.ip,
  });

  return res.json({
    success: true,
    templateId: Number(templateId),
    locked: true,
    message: '템플릿 매핑이 잠금 처리되었습니다.',
  });
});

const previewTemplateMappings = asyncHandler(async (req, res) => {
  const { templateId } = req.params;
  const { mappings = [] } = req.body;

  return res.json({
    success: true,
    templateId: Number(templateId),
    mappings,
    message: '매핑 미리보기는 프론트 표시용으로 반환되었습니다.',
  });
});

module.exports = {
  getTemplateMappings,
  getTemplateMappingCandidates,
  getTemplateMappingPreview,
  createTemplateMappings,
  lockTemplateMappings,
  previewTemplateMappings,
};