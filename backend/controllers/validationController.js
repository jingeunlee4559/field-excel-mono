const fs = require('fs');
const path = require('path');
const pool = require('../config/db');
const asyncHandler = require('../utils/asyncHandler');

const readRules = () => {
  try {
    const filePath = path.join(__dirname, '..', 'resources', 'rules', 'validation_rules.json');
    const parsed = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    return Array.isArray(parsed) ? parsed : (parsed.rules || []);
  } catch (error) {
    return [
      { ruleCode: 'REQUIRED_FIELD', ruleName: '필수값 검증', ruleType: 'REQUIRED', severity: 'ERROR' },
      { ruleCode: 'LOW_CONFIDENCE', ruleName: 'OCR/AI 신뢰도 검증', ruleType: 'CONFIDENCE_CHECK', severity: 'WARNING' },
    ];
  }
};

const runValidation = asyncHandler(async (req, res) => {
  const { sourceFileId } = req.params;

  const [values] = await pool.query(
    `
    SELECT
      ev.id AS extractedValueId,
      ev.field_key AS fieldKey,
      COALESCE(std.is_required, FALSE) AS isRequired,
      ev.final_value AS finalValue,
      COALESCE(ev.confidence_score, ev.confidence, 1) AS confidenceScore
    FROM extracted_values ev
    LEFT JOIN standard_fields std ON ev.standard_field_id = std.id
    WHERE ev.source_file_id = ?
    `,
    [sourceFileId]
  );

  await pool.query('DELETE FROM validation_results WHERE source_file_id = ?', [sourceFileId]);

  const rules = readRules();
  const requiredRule = rules.find((r) => r.ruleCode === 'REQUIRED_FIELD') || rules[0];
  const confidenceRule = rules.find((r) => r.ruleCode === 'LOW_CONFIDENCE') || requiredRule;

  let passCount = 0;
  let failCount = 0;
  let needReviewCount = 0;
  let needSupplementCount = 0;

  for (const value of values) {
    if (value.isRequired && !value.finalValue) {
      await pool.query(
        `
        INSERT INTO validation_results
        (source_file_id, extracted_value_id, field_key, validation_type, rule_code, rule_name, result_status, message, severity)
        VALUES (?, ?, ?, 'REQUIRED', ?, ?, 'NEED_REVIEW', ?, ?)
        `,
        [
          sourceFileId,
          value.extractedValueId,
          value.fieldKey,
          requiredRule.ruleCode,
          requiredRule.ruleName,
          `${value.fieldKey} 필수값이 누락되었습니다.`,
          requiredRule.severity || 'ERROR',
        ]
      );
      needReviewCount += 1;
    }
  }

  const lowConfidenceValues = values.filter((value) => Number(value.confidenceScore || 1) < 0.8);
  if (lowConfidenceValues.length > 0) {
    await pool.query(
      `
      INSERT INTO validation_results
      (source_file_id, extracted_value_id, field_key, validation_type, rule_code, rule_name, result_status, message, severity)
      VALUES (?, NULL, NULL, 'CONFIDENCE_CHECK', ?, ?, 'NEED_REVIEW', ?, ?)
      `,
      [
        sourceFileId,
        confidenceRule.ruleCode,
        confidenceRule.ruleName,
        'OCR/AI 신뢰도가 낮은 항목이 있습니다.',
        confidenceRule.severity || 'WARNING',
      ]
    );
    needReviewCount += 1;
  }

  const status = needSupplementCount > 0
    ? 'NEED_SUPPLEMENT'
    : needReviewCount > 0 || failCount > 0
      ? 'NEED_REVIEW'
      : 'NORMAL';

  if (status === 'NORMAL') passCount = values.length;
  await pool.query('UPDATE source_files SET status = ? WHERE id = ?', [status, sourceFileId]);

  return res.json({
    sourceFileId: Number(sourceFileId),
    status,
    summary: { passCount, failCount, needReviewCount, needSupplementCount },
  });
});

const getValidationResults = asyncHandler(async (req, res) => {
  const { sourceFileId } = req.params;
  const [results] = await pool.query(
    `
    SELECT
      rule_code AS ruleCode,
      rule_name AS ruleName,
      validation_type AS ruleType,
      result_status AS resultStatus,
      message,
      severity,
      is_resolved AS isResolved,
      checked_at AS checkedAt
    FROM validation_results
    WHERE source_file_id = ?
    ORDER BY id ASC
    `,
    [sourceFileId]
  );
  return res.json({ sourceFileId: Number(sourceFileId), results });
});

module.exports = { runValidation, getValidationResults };
