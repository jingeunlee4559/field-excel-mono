const pool = require('../config/db');

const DEFAULT_CACHE_TTL_MS = 30 * 60 * 1000;
const cache = new Map();

const normalizeDocumentType = (value) => {
  const text = String(value || 'RECEIPT').trim().toUpperCase();
  if (!text || text === '영수증') return 'RECEIPT';
  return text;
};

const unique = (values) => Array.from(new Set(values.filter(Boolean)));

const buildTargetTypes = (documentType = 'RECEIPT') => {
  const normalized = normalizeDocumentType(documentType);
  return unique([
    normalized,
    'RECEIPT',
    'ITEM_RECEIPT',
    'TRANSPORT_RECEIPT',
    'CARD_RECEIPT',
    'GENERIC_RECEIPT',
    'COMMON',
    'ALL',
  ]);
};

const parseJsonMaybe = (value, fallback = null) => {
  if (value === undefined || value === null || value === '') return fallback;
  if (typeof value === 'object') return value;
  try {
    return JSON.parse(value);
  } catch {
    return fallback;
  }
};

const safeQuery = async (sql, params = []) => {
  try {
    const [rows] = await pool.query(sql, params);
    return rows;
  } catch (error) {
    console.warn('[RULE_CONTEXT_QUERY_SKIPPED]', error.message);
    return [];
  }
};

const loadRuleContextFromDb = async (documentType = 'RECEIPT') => {
  const normalizedDocumentType = normalizeDocumentType(documentType);
  const targetTypes = buildTargetTypes(normalizedDocumentType);

  const [
    expenseCategories,
    standardFields,
    fieldAliases,
    correctionDictionaries,
    documentTypeFields,
    documentTypeRules,
    sectionRules,
    validationRules,
  ] = await Promise.all([
    safeQuery(
      `
      SELECT
        id,
        category_code AS categoryCode,
        category_name AS categoryName,
        description,
        is_active AS isActive
      FROM expense_categories
      WHERE is_active = TRUE
      ORDER BY id ASC
      `
    ),
    safeQuery(
      `
      SELECT
        id,
        field_key AS fieldKey,
        field_name AS fieldName,
        field_label AS fieldLabel,
        field_scope AS fieldScope,
        data_type AS dataType,
        field_type AS fieldType,
        default_mapping_type AS defaultMappingType,
        is_required AS isRequired,
        sort_order AS sortOrder
      FROM standard_fields
      WHERE is_active = TRUE
      ORDER BY sort_order ASC, id ASC
      `
    ),
    safeQuery(
      `
      SELECT
        field_key AS fieldKey,
        alias_name AS aliasName,
        document_type AS documentType,
        priority
      FROM field_aliases
      WHERE active_yn = 'Y'
        AND document_type IN (?)
      ORDER BY priority ASC, id ASC
      `,
      [targetTypes]
    ),
    safeQuery(
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
        description
      FROM correction_dictionaries
      WHERE active_yn = 'Y'
        AND status = 'APPROVED'
        AND document_type IN (?)
      ORDER BY priority ASC, id ASC
      `,
      [targetTypes]
    ),
    safeQuery(
      `
      SELECT
        document_type AS documentType,
        field_key AS fieldKey,
        field_group AS fieldGroup,
        required_yn AS requiredYn,
        default_visible_yn AS defaultVisibleYn,
        advanced_yn AS advancedYn,
        sort_order AS sortOrder
      FROM document_type_fields
      WHERE document_type IN (?)
      ORDER BY document_type ASC, sort_order ASC, id ASC
      `,
      [targetTypes]
    ),
    safeQuery(
      `
      SELECT
        document_type AS documentType,
        keyword,
        match_type AS matchType,
        score,
        active_yn AS activeYn
      FROM document_type_rules
      WHERE active_yn = 'Y'
        AND document_type IN (?)
      ORDER BY score DESC, id ASC
      `,
      [targetTypes]
    ),
    safeQuery(
      `
      SELECT
        document_type AS documentType,
        section_type AS sectionType,
        keyword,
        match_type AS matchType,
        target_field_key AS targetFieldKey,
        priority,
        active_yn AS activeYn
      FROM document_section_rules
      WHERE active_yn = 'Y'
        AND document_type IN (?)
      ORDER BY priority ASC, id ASC
      `,
      [targetTypes]
    ),
    safeQuery(
      `
      SELECT
        vr.id,
        vr.rule_code AS ruleCode,
        vr.rule_name AS ruleName,
        vr.rule_type AS ruleType,
        sf.field_key AS fieldKey,
        sf.field_label AS fieldLabel,
        vr.condition_json AS conditionJson,
        vr.severity,
        vr.is_active AS isActive
      FROM validation_rules vr
      LEFT JOIN standard_fields sf ON vr.standard_field_id = sf.id
      WHERE vr.is_active = TRUE
      ORDER BY vr.id ASC
      `
    ),
  ]);

  const normalizedValidationRules = validationRules.map((row) => ({
    ...row,
    conditionJson: parseJsonMaybe(row.conditionJson, {}),
  }));


  // Python AI 서버로 전송되는 rule_context는 매 파일마다 multipart payload에 포함된다.
  // 따라서 설명문/불필요한 메타를 제거한 compact 형태로 만든다.
  // DB 조회 자체는 캐시하고, Python은 이 compact context를 다시 실행 캐시로 인덱싱한다.
  const compactCorrectionDictionaries = correctionDictionaries.map((row) => ({
    dictionaryType: row.dictionaryType,
    wrongText: row.wrongText,
    correctedText: row.correctedText,
    matchType: row.matchType,
    minSimilarity: row.minSimilarity,
    documentType: row.documentType,
    priority: row.priority,
    status: row.status,
    activeYn: row.activeYn,
  }));

  const compactFieldAliases = fieldAliases.map((row) => ({
    fieldKey: row.fieldKey,
    aliasName: row.aliasName,
    documentType: row.documentType,
    priority: row.priority,
  }));

  const compactDocumentTypeFields = documentTypeFields.map((row) => ({
    documentType: row.documentType,
    fieldKey: row.fieldKey,
    fieldGroup: row.fieldGroup,
    requiredYn: row.requiredYn,
    defaultVisibleYn: row.defaultVisibleYn,
    advancedYn: row.advancedYn,
    sortOrder: row.sortOrder,
  }));

  const compactDocumentTypeRules = documentTypeRules.map((row) => ({
    documentType: row.documentType,
    keyword: row.keyword,
    matchType: row.matchType,
    score: row.score,
    activeYn: row.activeYn,
  }));

  const compactSectionRules = sectionRules.map((row) => ({
    documentType: row.documentType,
    sectionType: row.sectionType,
    keyword: row.keyword,
    matchType: row.matchType,
    targetFieldKey: row.targetFieldKey,
    priority: row.priority,
    activeYn: row.activeYn,
  }));

  const categoryMap = {};
  const categoryNameToCode = {};
  for (const category of expenseCategories) {
    categoryMap[category.categoryCode] = category.categoryName;
    categoryNameToCode[category.categoryName] = category.categoryCode;
  }

  return {
    version: 'db-rule-context-v1',
    loadedAt: new Date().toISOString(),
    source: 'DB_RULE_CONTEXT',
    documentType: normalizedDocumentType,
    targetTypes,
    categoryMap,
    categoryNameToCode,
    expenseCategories,
    standardFields,
    fieldAliases: compactFieldAliases,
    correctionDictionaries: compactCorrectionDictionaries,
    documentTypeFields: compactDocumentTypeFields,
    documentTypeRules: compactDocumentTypeRules,
    sectionRules: compactSectionRules,
    validationRules: normalizedValidationRules,
    counts: {
      expenseCategories: expenseCategories.length,
      standardFields: standardFields.length,
      fieldAliases: compactFieldAliases.length,
      correctionDictionaries: compactCorrectionDictionaries.length,
      documentTypeFields: compactDocumentTypeFields.length,
      documentTypeRules: compactDocumentTypeRules.length,
      sectionRules: compactSectionRules.length,
      validationRules: normalizedValidationRules.length,
    },
  };
};

const getRuleContextCacheTtlMs = () => {
  const raw = Number(process.env.RULE_CONTEXT_CACHE_TTL_MS || DEFAULT_CACHE_TTL_MS);
  return Number.isFinite(raw) && raw >= 0 ? raw : DEFAULT_CACHE_TTL_MS;
};

const getRuleContext = async (documentType = 'RECEIPT', options = {}) => {
  const normalizedDocumentType = normalizeDocumentType(documentType);
  const key = normalizedDocumentType;
  const ttlMs = getRuleContextCacheTtlMs();
  const now = Date.now();
  const cached = cache.get(key);

  if (!options.forceRefresh && cached && ttlMs > 0 && now - cached.loadedAtMs <= ttlMs) {
    return {
      ...cached.value,
      cache: {
        hit: true,
        ttlMs,
        ageMs: now - cached.loadedAtMs,
      },
    };
  }

  const value = await loadRuleContextFromDb(normalizedDocumentType);
  cache.set(key, { loadedAtMs: now, value });

  return {
    ...value,
    cache: {
      hit: false,
      ttlMs,
      ageMs: 0,
    },
  };
};

const clearRuleContextCache = () => {
  cache.clear();
};

module.exports = {
  getRuleContext,
  clearRuleContextCache,
};
