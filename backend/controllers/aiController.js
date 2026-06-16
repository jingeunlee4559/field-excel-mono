const pool = require('../config/db');
const asyncHandler = require('../utils/asyncHandler');
const { processSourceFileById } = require('../services/aiProcessingService');

const processSourceFile = asyncHandler(async (req, res) => {
  const { sourceFileId } = req.params;

  const result = await processSourceFileById(sourceFileId);

  return res.json({
    ...result,
    message: result.status === 'NORMAL'
      ? 'OCR/LLM 처리 및 자동 검증이 완료되었습니다.'
      : 'OCR/LLM 처리가 완료되었고 관리팀 검토가 필요합니다.',
  });
});

const getExtractedValues = asyncHandler(async (req, res) => {
  const { sourceFileId } = req.params;

  const [values] = await pool.query(
    `
    SELECT
      ev.id AS extractedValueId,
      sf.field_key AS fieldKey,
      sf.field_name AS fieldName,
      sf.data_type AS dataType,
      ec.category_code AS categoryCode,
      ec.category_name AS categoryName,
      ev.row_index AS rowIndex,
      ev.extracted_value AS extractedValue,
      ev.normalized_value AS normalizedValue,
      ev.final_value AS finalValue,
      ev.confidence,
      ev.extraction_source AS extractionSource,
      ev.is_modified AS isModified
    FROM extracted_values ev
    JOIN standard_fields sf ON ev.standard_field_id = sf.id
    LEFT JOIN expense_categories ec ON ev.expense_category_id = ec.id
    WHERE ev.source_file_id = ?
    ORDER BY ev.row_index ASC, sf.sort_order ASC, ev.id ASC
    `,
    [sourceFileId]
  );

  return res.json({ sourceFileId: Number(sourceFileId), values });
});

const getRawResult = asyncHandler(async (req, res) => {
  const { sourceFileId } = req.params;

  const [rows] = await pool.query(
    `
    SELECT
      id AS sourceFileId,
      ocr_text AS ocrText,
      ai_raw_json AS aiRawJson,
      confidence_score AS confidenceScore,
      status,
      error_message AS errorMessage
    FROM source_files
    WHERE id = ?
    LIMIT 1
    `,
    [sourceFileId]
  );

  if (rows.length === 0) {
    return res.status(404).json({ message: '원본 파일을 찾을 수 없습니다.' });
  }

  const row = rows[0];

  try {
    row.aiRawJson = row.aiRawJson ? JSON.parse(row.aiRawJson) : null;
  } catch (error) {
    // DB에 기존 문자열이 저장되어 있던 경우 화면에서 원문을 볼 수 있게 그대로 반환한다.
  }

  return res.json(row);
});

module.exports = {
  processSourceFile,
  getExtractedValues,
  getRawResult,
};
