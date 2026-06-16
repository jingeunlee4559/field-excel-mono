const pool = require('../config/db');
const asyncHandler = require('../utils/asyncHandler');
const fs = require('fs');
const path = require('path');

const TRUE_VALUES = new Set(['true', '1', 'Y', 'y', 'yes', 'YES', true, 1]);
const VALID_MAPPING_TYPES = new Set(['SINGLE_CELL', 'REPEAT_COLUMN']);

const normalizeDocumentType = (value) => {
  const raw = String(value || '').trim();
  const map = {
    영수증: 'RECEIPT',
    거래명세서: 'TRANSACTION_STATEMENT',
    납품서: 'DELIVERY_NOTE',
    자재검수증: 'MATERIAL_INSPECTION',
    작업일보: 'DAILY_REPORT',
    RECEIPT: 'RECEIPT',
    ITEM_RECEIPT: 'ITEM_RECEIPT',
    TRANSPORT_RECEIPT: 'TRANSPORT_RECEIPT',
    CARD_RECEIPT: 'CARD_RECEIPT',
    TRANSACTION_STATEMENT: 'TRANSACTION_STATEMENT',
    DELIVERY_NOTE: 'DELIVERY_NOTE',
    MATERIAL_INSPECTION: 'MATERIAL_INSPECTION',
    DAILY_REPORT: 'DAILY_REPORT',
  };
  return map[raw] || raw || 'RECEIPT';
};

const normalizeMappingType = (value) => {
  const raw = String(value || '').trim().toUpperCase();
  if (raw === 'SINGLE' || raw === 'SINGLE_CELL' || raw === '단일' || raw === '단일 셀') return 'SINGLE_CELL';
  if (raw === 'REPEAT' || raw === 'REPEAT_COLUMN' || raw === '반복' || raw === '반복 컬럼') return 'REPEAT_COLUMN';
  return VALID_MAPPING_TYPES.has(raw) ? raw : '';
};

const inferFieldGroup = (fieldKey = '') => {
  if (['department_name', 'site_name', 'user_name', 'expense_title', 'document_type', 'document_no', 'document_title'].includes(fieldKey)) return 'BASIC';
  if (fieldKey.includes('date') || fieldKey.includes('time')) return 'DATE';
  if (fieldKey.startsWith('vendor') || fieldKey === 'business_number') return 'VENDOR';
  if (fieldKey.includes('category') || fieldKey.includes('account') || fieldKey.includes('budget') || fieldKey.includes('cost_center')) return 'ACCOUNT';
  if (fieldKey.startsWith('item') || ['line_no', 'quantity', 'unit', 'unit_price', 'amount', 'description'].includes(fieldKey)) return 'ITEM';
  if (fieldKey.includes('amount') || ['total_amount', 'paid_amount', 'claim_amount', 'sale_total_amount', 'supply_amount', 'tax_amount'].includes(fieldKey)) return 'AMOUNT';
  if (fieldKey.includes('payment') || fieldKey.includes('card') || fieldKey.includes('approval') || fieldKey.includes('receipt')) return 'PAYMENT';
  if (fieldKey.includes('work') || fieldKey.includes('equipment') || fieldKey.includes('material') || fieldKey.includes('weather') || fieldKey.includes('progress')) return 'WORK';
  return 'ETC';
};


const DOCUMENT_TYPE_FIELD_PRESETS = {
  RECEIPT: [
    { fieldKey: 'document_type', fieldLabel: '문서유형', fieldGroup: 'BASIC', sortOrder: 1 },
    { fieldKey: 'expense_title', fieldLabel: '제목', fieldGroup: 'BASIC', sortOrder: 2 },
    { fieldKey: 'department_name', fieldLabel: '부서명', fieldGroup: 'BASIC', sortOrder: 10 },
    { fieldKey: 'site_name', fieldLabel: '현장명', fieldGroup: 'BASIC', sortOrder: 11 },
    { fieldKey: 'user_name', fieldLabel: '사용자', fieldGroup: 'BASIC', sortOrder: 12 },
    { fieldKey: 'expense_date', fieldLabel: '사용일자', fieldGroup: 'DATE', sortOrder: 100, isRequired: true },
    { fieldKey: 'vendor_name', fieldLabel: '사용처', fieldGroup: 'VENDOR', sortOrder: 110, isRequired: true },
    { fieldKey: 'business_number', fieldLabel: '사업자등록번호', fieldGroup: 'VENDOR', sortOrder: 114, advancedYn: 'Y' },
    { fieldKey: 'expense_category_name', fieldLabel: '항목', fieldGroup: 'ACCOUNT', sortOrder: 121 },
    { fieldKey: 'line_no', fieldLabel: '번호', fieldGroup: 'ITEM', sortOrder: 200 },
    { fieldKey: 'item_name', fieldLabel: '품목명', fieldGroup: 'ITEM', sortOrder: 201 },
    { fieldKey: 'description', fieldLabel: '적요', fieldGroup: 'ITEM', sortOrder: 202 },
    { fieldKey: 'quantity', fieldLabel: '수량', fieldGroup: 'ITEM', sortOrder: 203 },
    { fieldKey: 'unit_price', fieldLabel: '단가', fieldGroup: 'ITEM', sortOrder: 204 },
    { fieldKey: 'amount', fieldLabel: '금액', fieldGroup: 'AMOUNT', sortOrder: 205, isRequired: true },
    { fieldKey: 'supply_amount', fieldLabel: '공급가액', fieldGroup: 'AMOUNT', sortOrder: 300 },
    { fieldKey: 'tax_amount', fieldLabel: '부가세', fieldGroup: 'AMOUNT', sortOrder: 301 },
    { fieldKey: 'sale_total_amount', fieldLabel: '판매합계', fieldGroup: 'AMOUNT', sortOrder: 302, advancedYn: 'Y' },
    { fieldKey: 'discount_amount', fieldLabel: '할인금액', fieldGroup: 'AMOUNT', sortOrder: 303, advancedYn: 'Y' },
    { fieldKey: 'paid_amount', fieldLabel: '결제금액', fieldGroup: 'AMOUNT', sortOrder: 304 },
    { fieldKey: 'claim_amount', fieldLabel: '청구금액', fieldGroup: 'AMOUNT', sortOrder: 305 },
    { fieldKey: 'total_amount', fieldLabel: '지출총액', fieldGroup: 'AMOUNT', sortOrder: 306, isRequired: true },
    { fieldKey: 'gross_amount', fieldLabel: '품목합계', fieldGroup: 'AMOUNT', sortOrder: 307, advancedYn: 'Y' },
    { fieldKey: 'payment_method', fieldLabel: '결제수단', fieldGroup: 'PAYMENT', sortOrder: 400 },
    { fieldKey: 'card_company', fieldLabel: '카드사', fieldGroup: 'PAYMENT', sortOrder: 401, advancedYn: 'Y' },
    { fieldKey: 'card_number_masked', fieldLabel: '카드번호', fieldGroup: 'PAYMENT', sortOrder: 402, advancedYn: 'Y' },
    { fieldKey: 'approval_number', fieldLabel: '승인번호', fieldGroup: 'PAYMENT', sortOrder: 403 },
    { fieldKey: 'approval_time', fieldLabel: '승인시각', fieldGroup: 'PAYMENT', sortOrder: 404, advancedYn: 'Y' },
    { fieldKey: 'note', fieldLabel: '비고', fieldGroup: 'ETC', sortOrder: 500 },
  ],
  TRANSACTION_STATEMENT: [
    { fieldKey: 'document_type', fieldLabel: '문서유형', fieldGroup: 'BASIC', sortOrder: 1 },
    { fieldKey: 'expense_title', fieldLabel: '거래명세서 제목', fieldGroup: 'BASIC', sortOrder: 2 },
    { fieldKey: 'department_name', fieldLabel: '부서명', fieldGroup: 'BASIC', sortOrder: 10 },
    { fieldKey: 'site_name', fieldLabel: '현장명', fieldGroup: 'BASIC', sortOrder: 11 },
    { fieldKey: 'user_name', fieldLabel: '작성자', fieldGroup: 'BASIC', sortOrder: 12 },
    { fieldKey: 'expense_date', fieldLabel: '거래일자', fieldGroup: 'DATE', sortOrder: 100, isRequired: true },
    { fieldKey: 'vendor_name', fieldLabel: '거래처명', fieldGroup: 'VENDOR', sortOrder: 110, isRequired: true },
    { fieldKey: 'vendor_business_number', fieldLabel: '거래처 사업자번호', fieldGroup: 'VENDOR', sortOrder: 113, advancedYn: 'Y' },
    { fieldKey: 'line_no', fieldLabel: '번호', fieldGroup: 'ITEM', sortOrder: 200 },
    { fieldKey: 'item_name', fieldLabel: '품목명', fieldGroup: 'ITEM', sortOrder: 201 },
    { fieldKey: 'description', fieldLabel: '규격/내용', fieldGroup: 'ITEM', sortOrder: 202 },
    { fieldKey: 'quantity', fieldLabel: '수량', fieldGroup: 'ITEM', sortOrder: 203 },
    { fieldKey: 'unit_price', fieldLabel: '단가', fieldGroup: 'ITEM', sortOrder: 204 },
    { fieldKey: 'amount', fieldLabel: '금액', fieldGroup: 'AMOUNT', sortOrder: 205, isRequired: true },
    { fieldKey: 'supply_amount', fieldLabel: '공급가액', fieldGroup: 'AMOUNT', sortOrder: 300 },
    { fieldKey: 'tax_amount', fieldLabel: '부가세', fieldGroup: 'AMOUNT', sortOrder: 301 },
    { fieldKey: 'total_amount', fieldLabel: '합계금액', fieldGroup: 'AMOUNT', sortOrder: 306, isRequired: true },
    { fieldKey: 'note', fieldLabel: '비고', fieldGroup: 'ETC', sortOrder: 500 },
  ],
  DELIVERY_NOTE: [
    { fieldKey: 'document_type', fieldLabel: '문서유형', fieldGroup: 'BASIC', sortOrder: 1 },
    { fieldKey: 'expense_title', fieldLabel: '납품서 제목', fieldGroup: 'BASIC', sortOrder: 2 },
    { fieldKey: 'department_name', fieldLabel: '부서명', fieldGroup: 'BASIC', sortOrder: 10 },
    { fieldKey: 'site_name', fieldLabel: '납품현장', fieldGroup: 'BASIC', sortOrder: 11 },
    { fieldKey: 'user_name', fieldLabel: '수령자/작성자', fieldGroup: 'BASIC', sortOrder: 12 },
    { fieldKey: 'expense_date', fieldLabel: '납품일자', fieldGroup: 'DELIVERY', sortOrder: 100, isRequired: true },
    { fieldKey: 'vendor_name', fieldLabel: '납품업체', fieldGroup: 'VENDOR', sortOrder: 110, isRequired: true },
    { fieldKey: 'line_no', fieldLabel: '번호', fieldGroup: 'ITEM', sortOrder: 200 },
    { fieldKey: 'item_name', fieldLabel: '납품품목', fieldGroup: 'ITEM', sortOrder: 201 },
    { fieldKey: 'description', fieldLabel: '규격/내용', fieldGroup: 'ITEM', sortOrder: 202 },
    { fieldKey: 'quantity', fieldLabel: '납품수량', fieldGroup: 'ITEM', sortOrder: 203 },
    { fieldKey: 'unit_price', fieldLabel: '단가', fieldGroup: 'ITEM', sortOrder: 204, advancedYn: 'Y' },
    { fieldKey: 'amount', fieldLabel: '금액', fieldGroup: 'AMOUNT', sortOrder: 205, advancedYn: 'Y' },
    { fieldKey: 'total_amount', fieldLabel: '총 납품금액', fieldGroup: 'AMOUNT', sortOrder: 306, advancedYn: 'Y' },
    { fieldKey: 'note', fieldLabel: '비고', fieldGroup: 'ETC', sortOrder: 500 },
  ],
  MATERIAL_INSPECTION: [
    { fieldKey: 'document_type', fieldLabel: '문서유형', fieldGroup: 'BASIC', sortOrder: 1 },
    { fieldKey: 'expense_title', fieldLabel: '자재검수증 제목', fieldGroup: 'BASIC', sortOrder: 2 },
    { fieldKey: 'department_name', fieldLabel: '부서명', fieldGroup: 'BASIC', sortOrder: 10 },
    { fieldKey: 'site_name', fieldLabel: '검수현장', fieldGroup: 'BASIC', sortOrder: 11, isRequired: true },
    { fieldKey: 'user_name', fieldLabel: '검수자/작성자', fieldGroup: 'BASIC', sortOrder: 12 },
    { fieldKey: 'expense_date', fieldLabel: '검수일자', fieldGroup: 'INSPECTION', sortOrder: 100, isRequired: true },
    { fieldKey: 'vendor_name', fieldLabel: '납품업체', fieldGroup: 'VENDOR', sortOrder: 110 },
    { fieldKey: 'line_no', fieldLabel: '번호', fieldGroup: 'ITEM', sortOrder: 200 },
    { fieldKey: 'item_name', fieldLabel: '자재명', fieldGroup: 'ITEM', sortOrder: 201, isRequired: true },
    { fieldKey: 'description', fieldLabel: '규격/검수내용', fieldGroup: 'INSPECTION', sortOrder: 202 },
    { fieldKey: 'quantity', fieldLabel: '검수수량', fieldGroup: 'INSPECTION', sortOrder: 203, isRequired: true },
    { fieldKey: 'unit_price', fieldLabel: '단가', fieldGroup: 'AMOUNT', sortOrder: 204, advancedYn: 'Y' },
    { fieldKey: 'amount', fieldLabel: '금액', fieldGroup: 'AMOUNT', sortOrder: 205, advancedYn: 'Y' },
    { fieldKey: 'total_amount', fieldLabel: '총 검수금액', fieldGroup: 'AMOUNT', sortOrder: 306, advancedYn: 'Y' },
    { fieldKey: 'note', fieldLabel: '검수의견/비고', fieldGroup: 'ETC', sortOrder: 500 },
  ],
  DAILY_REPORT: [
    { fieldKey: 'document_type', fieldLabel: '문서유형', fieldGroup: 'BASIC', sortOrder: 1 },
    { fieldKey: 'expense_title', fieldLabel: '작업일보 제목', fieldGroup: 'BASIC', sortOrder: 2 },
    { fieldKey: 'department_name', fieldLabel: '부서명', fieldGroup: 'BASIC', sortOrder: 10 },
    { fieldKey: 'site_name', fieldLabel: '현장명', fieldGroup: 'BASIC', sortOrder: 11, isRequired: true },
    { fieldKey: 'user_name', fieldLabel: '작성자', fieldGroup: 'BASIC', sortOrder: 12 },
    { fieldKey: 'expense_date', fieldLabel: '작업일자', fieldGroup: 'DATE', sortOrder: 100, isRequired: true },
    { fieldKey: 'line_no', fieldLabel: '번호', fieldGroup: 'WORK', sortOrder: 200 },
    { fieldKey: 'item_name', fieldLabel: '공종/작업명', fieldGroup: 'WORK', sortOrder: 201, isRequired: true },
    { fieldKey: 'description', fieldLabel: '작업내용', fieldGroup: 'WORK', sortOrder: 202, isRequired: true },
    { fieldKey: 'quantity', fieldLabel: '투입수량/인원', fieldGroup: 'WORK', sortOrder: 203 },
    { fieldKey: 'amount', fieldLabel: '금액', fieldGroup: 'AMOUNT', sortOrder: 205, advancedYn: 'Y' },
    { fieldKey: 'note', fieldLabel: '특이사항', fieldGroup: 'ETC', sortOrder: 500 },
  ],
};

const getDocumentTypePreset = (documentType) => {
  return DOCUMENT_TYPE_FIELD_PRESETS[documentType] || DOCUMENT_TYPE_FIELD_PRESETS.RECEIPT;
};

const buildPresetMap = (documentType) => {
  return new Map(getDocumentTypePreset(documentType).map((item) => [item.fieldKey, item]));
};

const readJsonSafe = (relativePath, fallback) => {
  try {
    const filePath = path.join(__dirname, '..', relativePath);
    const parsed = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    return Array.isArray(parsed) ? parsed : (parsed.rules || []);
  } catch (error) {
    return fallback;
  }
};

const getStandardFields = asyncHandler(async (req, res) => {
  const { fieldScope, isActive = 'true' } = req.query;
  const documentType = normalizeDocumentType(req.query.documentType);
  const mappingType = normalizeMappingType(req.query.mappingType);
  const includeAdvanced = TRUE_VALUES.has(req.query.includeAdvanced);
  const presetMap = buildPresetMap(documentType);
  const presetKeys = [...presetMap.keys()];

  const params = [];
  let sql = `
    SELECT
      id,
      field_key AS fieldKey,
      field_name AS fieldName,
      field_label AS fieldLabel,
      field_scope AS fieldScope,
      data_type AS dataType,
      default_mapping_type AS defaultMappingType,
      is_required AS isRequired,
      sort_order AS sortOrder,
      is_active AS isActive,
      description
    FROM standard_fields
    WHERE 1 = 1
  `;

  if (fieldScope) {
    sql += ' AND field_scope = ?';
    params.push(fieldScope);
  }
  if (isActive !== undefined) {
    sql += ' AND is_active = ?';
    params.push(TRUE_VALUES.has(isActive));
  }
  if (mappingType) {
    sql += ' AND default_mapping_type = ?';
    params.push(mappingType);
  }
  if (presetKeys.length > 0) {
    sql += ` AND field_key IN (${presetKeys.map(() => '?').join(', ')})`;
    params.push(...presetKeys);
  }

  const [rows] = await pool.query(sql, params);

  const items = rows
    .map((row) => {
      const preset = presetMap.get(row.fieldKey) || {};
      const advancedYn = preset.advancedYn || 'N';

      return {
        ...row,
        documentType,
        fieldLabel: preset.fieldLabel || row.fieldLabel,
        fieldName: preset.fieldName || preset.fieldLabel || row.fieldName || row.fieldLabel,
        fieldGroup: preset.fieldGroup || inferFieldGroup(row.fieldKey),
        documentRequiredYn: (preset.isRequired ?? row.isRequired) ? 'Y' : 'N',
        defaultVisibleYn: advancedYn === 'Y' ? 'N' : 'Y',
        advancedYn,
        isRequired: Boolean(preset.isRequired ?? row.isRequired),
        isActive: Boolean(row.isActive),
        sortOrder: Number(preset.sortOrder ?? row.sortOrder ?? 0),
      };
    })
    .filter((item) => includeAdvanced || item.advancedYn !== 'Y')
    .sort((a, b) => a.sortOrder - b.sortOrder || a.id - b.id);

  return res.json({
    success: true,
    documentType,
    mappingType: mappingType || null,
    items,
  });
});

const getDocumentTypeFields = asyncHandler(async (req, res) => {
  req.query.documentType = normalizeDocumentType(req.query.documentType);
  return getStandardFields(req, res);
});

const getExpenseCategories = asyncHandler(async (req, res) => {
  const [rows] = await pool.query(`
    SELECT id, category_code AS categoryCode, category_name AS categoryName, description, is_active AS isActive
    FROM expense_categories
    WHERE is_active = TRUE
    ORDER BY id ASC
  `);
  return res.json({ success: true, items: rows });
});

const getValidationRules = asyncHandler(async (req, res) => {
  const rules = readJsonSafe('resources/rules/validation_rules.json', []);
  const ruleType = req.query.ruleType;
  const items = ruleType ? rules.filter((r) => r.ruleType === ruleType || r.rule_type === ruleType) : rules;
  return res.json({ success: true, source: 'JSON', items });
});

const getDepartments = asyncHandler(async (req, res) => {
  const [rows] = await pool.query(`
    SELECT id, department_name AS departmentName, department_code AS departmentCode, description,
           is_signup_visible AS isSignupVisible, is_active AS isActive
    FROM departments
    WHERE is_active = TRUE
    ORDER BY id ASC
  `);
  return res.json({ success: true, items: rows });
});

const getSites = asyncHandler(async (req, res) => {
  const [rows] = await pool.query(`
    SELECT id, site_name AS siteName, site_code AS siteCode, address, description, is_active AS isActive
    FROM sites
    WHERE is_active = TRUE
    ORDER BY id ASC
  `);
  return res.json({ success: true, items: rows });
});

const getRoles = asyncHandler(async (req, res) => {
  const [rows] = await pool.query(`
    SELECT id, role_code AS roleCode, role_name AS roleName, description
    FROM roles
    ORDER BY id ASC
  `);
  return res.json({ success: true, items: rows });
});

module.exports = {
  getStandardFields,
  getDocumentTypeFields,
  getExpenseCategories,
  getValidationRules,
  getDepartments,
  getSites,
  getRoles,
};
