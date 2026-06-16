const fs = require('fs');
const path = require('path');
const http = require('http');
const https = require('https');

const pool = require('../config/db');
const { recalculateBatchStatus, markBatchProcessing } = require('./batchStatusService');
const { resolveStorageFilePath, getCandidateStoragePaths, getAiStorageRoot } = require('../utils/storagePath');
const { getRuleContext } = require('./ruleContextService');

const nowMs = () => Date.now();

const elapsedSec = (startTime) => {
  return ((Date.now() - startTime) / 1000).toFixed(2);
};

const logStep = (label, startTime = null, extra = {}) => {
  const payload = {
    step: label,
    ...(startTime ? { elapsedSec: elapsedSec(startTime) } : {}),
    ...extra,
  };

  console.log('\n' + '='.repeat(80));
  console.log('[AI PROCESSING LOG]');
  console.log(JSON.stringify(payload, null, 2));
  console.log('='.repeat(80) + '\n');
};

const getPythonAiBaseUrl = () => {
  const rawBaseUrl = process.env.PYTHON_AI_BASE_URL || 'http://127.0.0.1:8000';

  try {
    const parsed = new URL(rawBaseUrl);

    if (parsed.hostname === 'localhost') {
      parsed.hostname = '127.0.0.1';
    }

    return parsed.toString().replace(/\/$/, '');
  } catch {
    return 'http://127.0.0.1:8000';
  }
};

const FIELD_VALUE_KEYS = {
  department_name: ['department_name', 'departmentName'],
  site_name: ['site_name', 'siteName'],
  user_name: ['user_name', 'userName', 'submitter_name', 'submitterName'],
  expense_title: ['expense_title', 'title'],

  total_amount: ['total_amount', 'amount', 'total', 'payment_amount', 'sum_amount'],

  line_no: ['line_no', 'lineNo', 'row_index', 'rowIndex'],

  expense_date: [
    'expense_date',
    'receipt_date',
    'date',
    'used_date',
    'transaction_date',
  ],

  vendor_name: [
    'vendor_name',
    'merchant_name',
    'store_name',
    'supplier_name',
    'company_name',
  ],

  expense_category_name: [
    'expense_category_name',
    'expense_item',
    'category',
    'item_category',
  ],

  item_name: [
    'item_name',
    'itemName',
    'name',
    'description',
    'item_description',
  ],

  description: [
    'description',
    'item_description',
    'item_name',
    'name',
    'usage_description',
    'purpose',
    'memo',
  ],

  quantity: [
    'quantity',
    'qty',
    'count',
  ],

  unit_price: [
    'unit_price',
    'unitPrice',
    'price',
  ],

  amount: [
    'amount',
    'total_amount',
    'total',
    'payment_amount',
    'sum_amount',
  ],

  payment_method: [
    'payment_method',
    'pay_method',
    'card_type',
  ],

  note: [
    'note',
    'notes',
    'remark',
    'remarks',
    'memo',
  ],
};

const ITEM_VALUE_KEYS = {
  line_no: ['line_no', 'lineNo', 'row_index', 'rowIndex'],

  expense_date: [
    'expense_date',
    'receipt_date',
    'date',
    'used_date',
    'transaction_date',
  ],

  vendor_name: [
    'vendor_name',
    'merchant_name',
    'store_name',
    'supplier_name',
    'company_name',
  ],

  expense_category_name: [
    'expense_category_name',
    'expense_item',
    'category',
    'item_category',
  ],

  item_name: [
    'item_name',
    'itemName',
    'name',
    'description',
    'item_description',
  ],

  description: [
    'description',
    'item_description',
    'item_name',
    'name',
    'memo',
  ],

  quantity: [
    'quantity',
    'qty',
    'count',
  ],

  unit_price: [
    'unit_price',
    'unitPrice',
    'price',
  ],

  amount: [
    'amount',
    'total_amount',
    'payment_amount',
    'sum_amount',
  ],

  payment_method: [
    'payment_method',
    'pay_method',
    'card_type',
  ],

  note: [
    'note',
    'notes',
    'remark',
    'remarks',
    'memo',
  ],
};

const toNullableString = (value) => {
  if (value === undefined || value === null) return null;

  if (Array.isArray(value)) {
    if (value.length === 0) return null;
    return JSON.stringify(value);
  }

  if (typeof value === 'object') {
    return JSON.stringify(value);
  }

  const stringValue = String(value).trim();

  return stringValue === '' ? null : stringValue;
};

const firstDefined = (source, keys) => {
  if (!source || typeof source !== 'object') return null;

  for (const key of keys) {
    if (Object.prototype.hasOwnProperty.call(source, key)) {
      const value = source[key];

      if (value !== undefined && value !== null && value !== '') {
        return value;
      }
    }
  }

  return null;
};

const getValueForField = (extractedData, fieldKey) => {
  const candidateKeys = FIELD_VALUE_KEYS[fieldKey] || [fieldKey];
  return firstDefined(extractedData, candidateKeys);
};

const getValueForItemField = (item, fieldKey) => {
  const candidateKeys = ITEM_VALUE_KEYS[fieldKey] || [fieldKey];
  return firstDefined(item, candidateKeys);
};

const compactText = (value) => String(value || '').replace(/\s+/g, '');

const toNumberForItem = (value) => {
  if (value === undefined || value === null || value === '') return null;
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  const normalized = String(value)
    .replace(/[Oo]/g, '0')
    .replace(/[Il|]/g, '1')
    .replace(/[,원₩\s]/g, '')
    .replace(/[^0-9.-]/g, '');
  if (!normalized || normalized === '-' || normalized === '.') return null;
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : null;
};

const hasProductWord = (text) => /(김치|두부|전|모듬|소주|맥주|막걸리|주류|밥|국|탕|찌개|면|라면|우동|카츠|돈까스|돈가스|피자|치킨|버거|샌드|빵|케이크|커피|라떼|아메리카노|에이드|스무디|티|차|하이볼|자몽|모히또|피치|감바스|코젤|참이슬|양갈비|프렌치랙|마늘밥|봉투|쇼핑백|패치|비누|컵|타올|티슈)/i.test(String(text || ''));

const normalizeCandidateItemName = (value) => {
  const text = String(value || '')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/^\*?\s*\d{3,8}\s+/, '')
    .replace(/^\d{3,8}[A-Za-z]{1,5}\s*(?=[가-힣A-Za-z])/, '')
    .replace(/^\[[0-9A-Za-z-]{3,30}\]\s*/, '')
    .replace(/[\x00-\x1F]/g, '')
    .trim();
  return text.replace(/[\s\-_*\[\]]+$/g, '').trim();
};

const isCandidateAmountFragment = (item, groupMaxAmount) => {
  const amount = toNumberForItem(item?.amount);
  const source = String(item?.source || '').toLowerCase();
  if (!amount || !groupMaxAmount || groupMaxAmount < 1000) return false;
  if (['structured_small_item_row', 'preceding_small_item_amount'].includes(source)) return false;
  return amount < 1000 && amount < groupMaxAmount;
};

const removeDominatedDuplicateCandidates = (items) => {
  const groups = new Map();
  items.forEach((item) => {
    const key = compactText(item.item_name || item.description).toLowerCase();
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(item);
  });

  const blocked = new Set();
  groups.forEach((group) => {
    if (group.length <= 1) return;
    const maxAmount = Math.max(...group.map((item) => toNumberForItem(item.amount) || 0));
    group.forEach((item) => {
      if (isCandidateAmountFragment(item, maxAmount)) {
        blocked.add(item);
      }
    });
  });
  return items.filter((item) => !blocked.has(item));
};


const hasMeaningfulItemLetters = (value) => {
  const text = String(value || '').trim();
  if (!text) return false;
  const compact = text
    .replace(/[0-9,.'`~\-:;_/\()\[\]{}\s]+/g, '')
    .replace(/^(개|EA|ea|x|X)+/, '');
  if (/[가-힣]{2,}/.test(compact)) return true;
  const english = (compact.match(/[A-Za-z]/g) || []).join('');
  const digits = text.match(/\d/g) || [];
  if (english.length >= 2 && digits.length === 0) return true;
  if (english.length >= 4 && digits.length <= 1) return true;
  return false;
};

const itemNameQualityScore = (value, vendorName = null) => {
  const text = String(value || '').trim().replace(/\s+/g, ' ');
  if (!text) return 0;
  const compact = compactText(text);
  const len = Math.max(compact.length, 1);
  const lower = compact.toLowerCase();
  const vendor = compactText(vendorName).toLowerCase();

  const nonItemKeywords = [
    '합계', '총계', '총액', '판매합계', '받을금액', '받은금액', '결제', '카드', '승인',
    '공급가', '공급가액', '부가세', '세액', '과세', '면세', '입금계좌', '사업자', '전화',
    '주소', '대표', '매장명', '영수증', '계산서', '주문자', '고객수', '테이블', '일시불',
    '포인트', '멤버십', '가맹점', '카드번호', '승인번호', '승인일시',
  ];

  if (vendor && vendor.length >= 3 && (lower === vendor || lower.includes(vendor) || vendor.includes(lower))) return 0;
  if (nonItemKeywords.some((keyword) => compact.includes(keyword))) return 0;
  if (/\d{3}-?\d{2}-?\d{5}|\d{2,4}-?\d{3,4}-?\d{4}/.test(compact)) return 0;
  if (/[가-힣0-9]+(?:길|로)\d+|번지|\d+호/.test(compact)) return 0;

  const korean = (compact.match(/[가-힣]/g) || []).length;
  const english = (compact.match(/[A-Za-z]/g) || []).length;
  const digits = (compact.match(/\d/g) || []).length;
  const symbols = (compact.match(/[^가-힣A-Za-z0-9]/g) || []).length;
  const letters = korean + english;
  const productWord = hasProductWord(text);
  let score = 1;

  if (compact.length < 2 || compact.length > 45) score -= 0.45;
  if (letters < 2) score -= 0.65;
  if (!hasMeaningfulItemLetters(text)) score -= 0.7;
  if (/[ρπγ∗×Ω℃♥★◆◇□■●○▲△▼▽♣♠※^{}<>_=|`~]/.test(text)) score -= 0.5;
  if (/[\/]/.test(text)) score -= 0.45;
  if (symbols / len >= 0.08) score -= Math.min(0.5, (symbols / len) * 1.7);

  const allowedDigitContext = /(\d+\s*(개|병|잔|인분|인|세트|SET|set|종|호|ml|mL|ML|g|G|kg|KG|L|l)|(제로|ZERO|zero)|(1\+1|2\+1))/.test(text);
  if (digits > 0 && !allowedDigitContext) score -= Math.min(0.55, 0.25 + (digits / len));
  if (letters / len < 0.65) score -= 0.3;
  if (/[A-Za-z]/.test(compact) && /[가-힣]/.test(compact) && !productWord) score -= 0.25;
  if (productWord) score += 0.15;

  return Math.max(0, Math.min(1, score));
};

const isProbableNoiseItemName = (value, vendorName = null, strict = true) => {
  const score = itemNameQualityScore(value, vendorName);
  return strict ? score < 0.7 : score < 0.45;
};

const normalizeAiDetailItemsBeforeSave = (items, rootVendorName, { strict = true } = {}) => {
  if (!Array.isArray(items)) return [];
  const result = [];
  const seen = new Set();

  for (const raw of items) {
    if (!raw || typeof raw !== 'object') continue;
    const rawName = firstDefined(raw, ['item_name', 'itemName', 'description', 'name', 'item_description']);
    const name = normalizeCandidateItemName(rawName);
    const amount = toNumberForItem(firstDefined(raw, ['amount', 'total_amount', 'total', 'payment_amount', 'sum_amount']));
    const qty = toNumberForItem(firstDefined(raw, ['quantity', 'qty', 'count'])) || 1;
    const unit = toNumberForItem(firstDefined(raw, ['unit_price', 'unitPrice', 'price'])) || (amount && qty ? amount / qty : null);

    if (isProbableNoiseItemName(name, rootVendorName, strict)) continue;
    if (!amount || amount <= 0) continue;
    if (unit && qty && Math.abs(unit * qty - amount) > Math.max(10, amount * 0.05)) continue;

    const key = `${compactText(name).toLowerCase()}::${Math.round(amount)}`;
    if (seen.has(key)) continue;
    seen.add(key);

    result.push({
      ...raw,
      item_name: String(name).trim(),
      description: String(name).trim(),
      amount,
      quantity: qty,
      unit_price: unit || amount / qty,
    });
  }

  return removeDominatedDuplicateCandidates(result);
};

const calculateConfidence = (extractedData) => {
  const confidence = Number(extractedData?.confidence);

  if (Number.isFinite(confidence)) {
    return Math.max(0, Math.min(1, confidence));
  }

  return 0.75;
};

const normalizeDocumentTypeForPython = (documentType) => {
  if (!documentType) return 'RECEIPT';

  if (documentType === '영수증') return 'RECEIPT';
  if (documentType === '승차권') return 'TRANSPORT_TICKET';

  return documentType;
};

const mapPythonStatusToDbStatus = (validationResult) => {
  const status = validationResult?.status;
  const errors = validationResult?.errors || [];
  const warnings = validationResult?.warnings || [];
  const reviewRequired = Boolean(
    validationResult?.reviewRequired ||
    validationResult?.review_required ||
    validationResult?.is_valid === false
  );

  // Python이 PASS/NORMAL을 줘도 경고/오류/검토 플래그가 있으면 절대 NORMAL 저장 금지.
  if (errors.length > 0 || warnings.length > 0 || reviewRequired) {
    return 'NEED_REVIEW';
  }

  if (status === 'PASS') return 'NORMAL';
  if (status === 'NORMAL') return 'NORMAL';
  if (status === 'NEED_REVIEW') return 'NEED_REVIEW';

  if (status === 'SUPPLEMENT_REQUIRED_CANDIDATE' || status === 'NEED_SUPPLEMENT') {
    return 'NEED_SUPPLEMENT';
  }

  return 'NEED_REVIEW';
};

const buildErrorMessage = (validationResult) => {
  const errors = validationResult?.errors || [];
  const warnings = validationResult?.warnings || [];
  const issues = [...errors, ...warnings];

  if (issues.length === 0) return null;

  return issues
    .slice(0, 3)
    .map((issue) => issue.message || issue.code)
    .filter(Boolean)
    .join(' / ');
};

const getAbsoluteFilePath = (storedPath) => {
  return resolveStorageFilePath(storedPath, 'uploads');
};

const loadExpenseCategories = async (connection) => {
  const [rows] = await connection.query(
    `
    SELECT 
      id,
      category_code AS categoryCode,
      category_name AS categoryName
    FROM expense_categories
    WHERE is_active = TRUE
    `
  );

  const byCode = new Map();
  const byName = new Map();

  rows.forEach((row) => {
    byCode.set(row.categoryCode, row);
    byName.set(row.categoryName, row);
  });

  return {
    rows,
    byCode,
    byName,
    fallback: byCode.get('ETC') || rows[0] || null,
  };
};


// DB Rule Context는 backend/services/ruleContextService.js에서 캐싱 조회한다.


const resolveCategory = (categories, source) => {
  if (!categories || !source) return categories?.fallback || null;

  const code =
    source.expense_category_code ||
    source.category_code ||
    source.categoryCode ||
    null;

  const name =
    source.expense_category_name ||
    source.category_name ||
    source.category ||
    source.expense_item ||
    null;

  if (code && categories.byCode.has(code)) {
    return categories.byCode.get(code);
  }

  if (name && categories.byName.has(name)) {
    return categories.byName.get(name);
  }

  return categories.fallback || null;
};

const resolveItemCategory = (categories, item, mainCategory) => {
  const itemCategory = resolveCategory(categories, item);
  const itemCode = itemCategory?.categoryCode;
  const itemName = itemCategory?.categoryName;
  if (!itemCategory || itemCode === 'ETC' || itemName === '기타') {
    return mainCategory || itemCategory || categories?.fallback || null;
  }
  return itemCategory;
};

const postMultipartFile = ({
  url,
  filePath,
  fieldName = 'file',
  fileName,
  mimeType,
  fields = {},
}) => {
  return new Promise((resolve, reject) => {
    const startTime = nowMs();
    const target = new URL(url);
    const boundary = `----node-ai-boundary-${Date.now()}-${Math.random()
      .toString(16)
      .slice(2)}`;

    const chunks = [];

    Object.entries(fields).forEach(([key, value]) => {
      chunks.push(Buffer.from(`--${boundary}\r\n`));
      chunks.push(
        Buffer.from(`Content-Disposition: form-data; name="${key}"\r\n\r\n`)
      );
      chunks.push(Buffer.from(`${value ?? ''}\r\n`));
    });

    const fileBuffer = fs.readFileSync(filePath);

    chunks.push(Buffer.from(`--${boundary}\r\n`));
    chunks.push(
      Buffer.from(
        `Content-Disposition: form-data; name="${fieldName}"; filename="${
          fileName || path.basename(filePath)
        }"\r\n` + `Content-Type: ${mimeType || 'application/octet-stream'}\r\n\r\n`
      )
    );
    chunks.push(fileBuffer);
    chunks.push(Buffer.from('\r\n'));
    chunks.push(Buffer.from(`--${boundary}--\r\n`));

    const body = Buffer.concat(chunks);
    const transport = target.protocol === 'https:' ? https : http;
    const timeoutMs = Number(process.env.PYTHON_AI_TIMEOUT_MS || 300000);

    const logFields = Object.fromEntries(
      Object.entries(fields).map(([key, value]) => {
        if (key === 'referenceContext') {
          const length = String(value || '').length;
          return [key, `[DB_RULE_CONTEXT_JSON ${length} chars]`];
        }
        return [key, value];
      })
    );

    logStep('PYTHON_AI_REQUEST_START', null, {
      url,
      fileName,
      fileSizeBytes: fileBuffer.length,
      timeoutMs,
      fields: logFields,
    });

    const request = transport.request(
      {
        method: 'POST',
        hostname: target.hostname,
        port: target.port || (target.protocol === 'https:' ? 443 : 80),
        path: `${target.pathname}${target.search}`,
        headers: {
          'Content-Type': `multipart/form-data; boundary=${boundary}`,
          'Content-Length': body.length,
        },
        timeout: timeoutMs,
      },
      (response) => {
        const responseChunks = [];

        response.on('data', (chunk) => responseChunks.push(chunk));

        response.on('end', () => {
          const raw = Buffer.concat(responseChunks).toString('utf8');
          let parsed;

          logStep('PYTHON_AI_RESPONSE_END', startTime, {
            statusCode: response.statusCode,
            rawPreview: raw.slice(0, 1000),
          });

          try {
            parsed = raw ? JSON.parse(raw) : {};
          } catch {
            if (response.statusCode >= 500) {
              return reject(
                new Error(
                  'Python AI 서버 내부 오류가 발생했습니다. FastAPI 콘솔 로그를 확인하세요.'
                )
              );
            }

            return reject(
              new Error(`Python AI 서버 응답 형식이 올바르지 않습니다: ${raw}`)
            );
          }

          if (response.statusCode < 200 || response.statusCode >= 300) {
            return reject(
              new Error(
                parsed?.detail ||
                  parsed?.message ||
                  `Python AI 서버 오류: ${response.statusCode}`
              )
            );
          }

          return resolve(parsed);
        });
      }
    );

    request.on('timeout', () => {
      request.destroy(
        new Error(`Python AI 서버 요청 시간이 초과되었습니다. timeoutMs=${timeoutMs}`)
      );
    });

    request.on('error', (error) => {
      logStep('PYTHON_AI_REQUEST_ERROR', startTime, {
        errorMessage: error.message,
        errorCode: error.code,
      });

      if (error.code === 'ECONNREFUSED') {
        return reject(
          new Error(
            `Python AI 서버에 연결하지 못했습니다. FastAPI 서버를 먼저 실행하고 PYTHON_AI_BASE_URL=${getPythonAiBaseUrl()} 설정을 확인하세요. 원인: ${error.message}`
          )
        );
      }

      return reject(error);
    });

    request.write(body);
    request.end();
  });
};

const callPythonProcessUpload = async (sourceFile) => {
  const startTime = nowMs();
  const absoluteFilePath = getAbsoluteFilePath(sourceFile.filePath);

  if (!absoluteFilePath || !fs.existsSync(absoluteFilePath)) {
    const candidates = getCandidateStoragePaths(sourceFile.filePath, 'uploads');

    logStep('UPLOAD_FILE_RESOLVE_FAILED', startTime, {
      sourceFileId: sourceFile.sourceFileId,
      dbFilePath: sourceFile.filePath,
      aiStorageRoot: getAiStorageRoot(),
      candidates,
    });

    throw new Error(`업로드 파일을 찾을 수 없습니다: ${sourceFile.filePath}`);
  }

  const documentType = normalizeDocumentTypeForPython(sourceFile.documentType);
  const referenceContext = await getRuleContext(documentType);

  const fields = {
    documentType,
    ocrMode: process.env.OCR_MODE || 'auto',
    referenceContext: JSON.stringify(referenceContext),
  };

  // 중요: skipLlm=false를 전송하면 Python이 "강제 LLM 사용/미사용 판단"으로 해석해
  // LLM_ONLY_WHEN_NEEDED 분기가 깨질 수 있다.
  // 따라서 사용자가 명시적으로 끄는 경우에만 true를 보낸다.
  if (process.env.LLM_SKIP === 'true') {
    fields.skipLlm = 'true';
  }

  const response = await postMultipartFile({
    url: `${getPythonAiBaseUrl()}/api/ai/process-upload`,
    filePath: absoluteFilePath,
    fileName: sourceFile.originalFileName,
    mimeType: sourceFile.mimeType,
    fields,
  });

  if (!response?.success) {
    throw new Error(response?.message || 'Python AI 서버 처리 실패');
  }

  logStep('PYTHON_AI_CALL_DONE', startTime, {
    sourceFileId: sourceFile.sourceFileId,
    ruleContext: {
      source: referenceContext.source,
      version: referenceContext.version,
      cacheHit: referenceContext.cache?.hit,
      counts: referenceContext.counts,
    },
  });

  return response.data;
};

const loadSourceFile = async (sourceFileId) => {
  const [rows] = await pool.query(
    `
    SELECT
      sf.id AS sourceFileId,
      sf.upload_batch_id AS batchId,
      sf.upload_batch_id AS uploadBatchId,
      sf.template_id AS sourceTemplateId,
      sf.original_file_name AS originalFileName,
      sf.file_path AS filePath,
      sf.mime_type AS mimeType,
      sf.document_type AS sourceDocumentType,

      eb.template_id AS batchTemplateId,
      eb.document_type AS batchDocumentType,
      eb.title AS batchTitle,
      eb.department_id AS departmentId,
      eb.site_id AS siteId,
      eb.site_name AS batchSiteName,

      d.department_name AS departmentName,
      s.site_name AS siteName,
      u.name AS userName
    FROM source_files sf
    JOIN upload_batches eb ON sf.upload_batch_id = eb.id
    LEFT JOIN departments d ON eb.department_id = d.id
    LEFT JOIN sites s ON eb.site_id = s.id
    LEFT JOIN users u ON eb.submitter_id = u.id
    WHERE sf.id = ?
    LIMIT 1
    `,
    [sourceFileId]
  );

  const row = rows[0];

  if (!row) return null;

  return {
    ...row,
    templateId: row.sourceTemplateId || row.batchTemplateId,
    documentType: row.sourceDocumentType || row.batchDocumentType || 'RECEIPT',
    department_name: row.departmentName || '',
    site_name: row.siteName || row.batchSiteName || '',
    user_name: row.userName || '',
    expense_title: row.batchTitle || '',
  };
};

const buildHeaderAugmentedData = (sourceFile, extractedData) => {
  return {
    ...extractedData,
    department_name: sourceFile.department_name || extractedData.department_name || null,
    site_name: sourceFile.site_name || extractedData.site_name || null,
    user_name: sourceFile.user_name || extractedData.user_name || null,
    expense_title: sourceFile.expense_title || extractedData.expense_title || null,
  };
};

const saveExtractedValues = async (connection, sourceFileId, sourceFile, extractedData) => {
  const startTime = nowMs();

  const [standardFields] = await connection.query(
    `
    SELECT 
      id,
      field_key AS fieldKey,
      field_label AS fieldLabel
    FROM standard_fields
    WHERE is_active = TRUE
    ORDER BY sort_order ASC, id ASC
    `
  );

  const categories = await loadExpenseCategories(connection);
  const augmentedData = buildHeaderAugmentedData(sourceFile, extractedData);
  const mainCategory = resolveCategory(categories, augmentedData);

  await connection.query(
    'DELETE FROM extracted_values WHERE source_file_id = ?',
    [sourceFileId]
  );

  const confidence = calculateConfidence(extractedData);
  let savedCount = 0;

  for (const field of standardFields) {
    const value = getValueForField(augmentedData, field.fieldKey);

    if (value === null) continue;

    let finalValue = value;

    if (field.fieldKey === 'expense_category_name') {
      finalValue = mainCategory?.categoryName || augmentedData.expense_category_name || augmentedData.category || '기타';
    }

    const stringValue = toNullableString(finalValue);

    if (stringValue === null) continue;

    const expenseCategoryId = field.fieldKey === 'expense_category_name' ? mainCategory?.id || null : null;

    await connection.query(
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
        confidence,
        confidence_score,
        extraction_source,
        is_modified
      )
      VALUES (?, ?, ?, ?, ?, 0, ?, ?, ?, ?, ?, 'AI', FALSE)
      `,
      [
        sourceFileId,
        field.id,
        expenseCategoryId,
        field.fieldKey,
        field.fieldLabel,
        stringValue,
        stringValue,
        stringValue,
        confidence,
        confidence,
      ]
    );

    savedCount += 1;
  }

  const rootVendorName = augmentedData.vendor_name || extractedData.vendor_name || null;
  const confirmedItems = normalizeAiDetailItemsBeforeSave(
    Array.isArray(extractedData.items) ? extractedData.items : [],
    rootVendorName,
    { strict: true }
  );
  const candidateItems = normalizeAiDetailItemsBeforeSave(
    Array.isArray(extractedData.item_candidates)
      ? extractedData.item_candidates
      : Array.isArray(extractedData.itemCandidates)
        ? extractedData.itemCandidates
        : [],
    rootVendorName,
    { strict: false }
  );

  // 확정 품목이 없더라도 검토 화면에서 OCR/LLM 후보를 확인할 수 있게 후보 품목을 저장한다.
  // 단, 정/제매 8 위무아장처럼 품목명 품질 점수에서 탈락한 OCR 잡음은 저장하지 않는다.
  const items = confirmedItems.length > 0 ? confirmedItems : candidateItems;
  const itemExtractionSource = confirmedItems.length > 0 ? 'AI' : 'AI_CANDIDATE';

  const itemMappableKeys = new Set([
    'line_no',
    'expense_date',
    'vendor_name',
    'expense_category_name',
    'item_name',
    'description',
    'quantity',
    'unit_price',
    'amount',
    'payment_method',
    'note',
  ]);

  for (let index = 0; index < items.length; index += 1) {
    const item = items[index];

    if (!item || typeof item !== 'object') continue;

    const itemCategory = resolveItemCategory(categories, item, mainCategory);

    const itemWithFallback = {
      ...item,
      line_no: index + 1,
      expense_date: item.expense_date || item.receipt_date || augmentedData.expense_date,
      vendor_name: item.vendor_name || augmentedData.vendor_name,
      expense_category_name:
        item.expense_category_name ||
        item.expense_item ||
        item.category ||
        itemCategory?.categoryName ||
        '기타',
      payment_method: item.payment_method || augmentedData.payment_method,
    };

    for (const field of standardFields) {
      if (!itemMappableKeys.has(field.fieldKey)) continue;

      let value = getValueForItemField(itemWithFallback, field.fieldKey);

      if (value === null) continue;

      if (field.fieldKey === 'expense_category_name') {
        value = itemCategory?.categoryName || value || '기타';
      }

      const stringValue = toNullableString(value);

      if (stringValue === null) continue;

      const shouldAttachCategory = ['expense_category_name', 'description', 'amount'].includes(field.fieldKey);

      await connection.query(
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
          confidence,
          confidence_score,
          extraction_source,
          is_modified
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, FALSE)
        `,
        [
          sourceFileId,
          field.id,
          shouldAttachCategory ? itemCategory?.id || null : null,
          field.fieldKey,
          field.fieldLabel,
          index + 1,
          stringValue,
          stringValue,
          stringValue,
          confidence,
          confidence,
          itemExtractionSource,
        ]
      );

      savedCount += 1;
    }
  }

  logStep('SAVE_EXTRACTED_VALUES_DONE', startTime, {
    sourceFileId,
    savedCount,
    standardFieldCount: standardFields.length,
    itemCount: items.length,
  });

  return savedCount;
};

const saveValidationResults = async (connection, sourceFileId, validationResult) => {
  const startTime = nowMs();

  await connection.query(
    'DELETE FROM validation_results WHERE source_file_id = ?',
    [sourceFileId]
  );

  const issues = [
    ...(validationResult?.errors || []).map((issue) => ({
      ...issue,
      severity: 'ERROR',
    })),
    ...(validationResult?.warnings || []).map((issue) => ({
      ...issue,
      severity: 'WARNING',
    })),
  ];

  if (issues.length === 0) {
    logStep('SAVE_VALIDATION_RESULTS_DONE', startTime, {
      sourceFileId,
      savedCount: 0,
      reason: 'NO_ISSUES',
    });

    return 0;
  }

  let savedCount = 0;

  for (const issue of issues) {
    const ruleCode = issue.code || issue.validationType || 'NEED_REVIEW';
    const ruleName = issue.ruleName || issue.fieldLabel || ruleCode;

    const resultStatus =
      issue.action === 'SUPPLEMENT_REQUEST_CANDIDATE'
        ? 'NEED_SUPPLEMENT'
        : 'NEED_REVIEW';

    await connection.query(
      `
      INSERT INTO validation_results
      (
        source_file_id,
        extracted_value_id,
        field_key,
        validation_type,
        rule_code,
        rule_name,
        result_status,
        status,
        message,
        severity,
        current_value,
        expected_value
      )
      VALUES (?, NULL, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `,
      [
        sourceFileId,
        issue.fieldKey || issue.field_key || null,
        issue.code || issue.validationType || null,
        ruleCode,
        ruleName,
        resultStatus,
        resultStatus === 'NEED_SUPPLEMENT'
          ? 'SUPPLEMENT_REQUIRED_CANDIDATE'
          : 'NEED_REVIEW',
        issue.message || issue.code || '검토가 필요합니다.',
        issue.severity || 'WARNING',
        toNullableString(issue.currentValue || issue.current_value),
        toNullableString(issue.expectedValue || issue.expected_value),
      ]
    );

    savedCount += 1;
  }

  logStep('SAVE_VALIDATION_RESULTS_DONE', startTime, {
    sourceFileId,
    savedCount,
    issueCount: issues.length,
  });

  return savedCount;
};

const saveAiProcessResult = async ({ sourceFile, sourceFileId, aiData }) => {
  const startTime = nowMs();

  const extractedData = aiData?.extractedData || {};
  const validationResult = aiData?.validationResult || {};
  const ocrText = aiData?.ocrText || '';
  const confidenceScore = calculateConfidence(extractedData);
  const dbStatus = mapPythonStatusToDbStatus(validationResult);
  const errorMessage = buildErrorMessage(validationResult);

  const connection = await pool.getConnection();

  try {
    await connection.beginTransaction();

    const savedValueCount = await saveExtractedValues(
      connection,
      sourceFileId,
      sourceFile,
      extractedData
    );

    const savedValidationCount = await saveValidationResults(
      connection,
      sourceFileId,
      validationResult
    );

    await connection.query(
      `
      UPDATE source_files
      SET
        ocr_text = ?,
        ai_raw_json = ?,
        confidence_score = ?,
        document_type = ?,
        status = ?,
        error_message = ?,
        completed_at = CURRENT_TIMESTAMP,
        processed_at = CURRENT_TIMESTAMP
      WHERE id = ?
      `,
      [
        ocrText,
        JSON.stringify({
          extractedData,
          validationResult,
          aiFile: aiData.file || null,
        }),
        confidenceScore,
        extractedData.document_type || sourceFile.documentType || 'RECEIPT',
        dbStatus,
        errorMessage,
        sourceFileId,
      ]
    );

    await connection.query(
      `
      UPDATE upload_batches
      SET document_type = COALESCE(document_type, ?)
      WHERE id = ?
      `,
      [
        extractedData.document_type || sourceFile.documentType || 'RECEIPT',
        sourceFile.batchId,
      ]
    );

    await recalculateBatchStatus(sourceFile.batchId, connection);

    await connection.commit();

    logStep('SAVE_AI_PROCESS_RESULT_DONE', startTime, {
      sourceFileId,
      dbStatus,
      confidenceScore,
      savedValueCount,
      savedValidationCount,
    });

    return {
      sourceFileId: Number(sourceFileId),
      status: dbStatus,
      confidenceScore,
      savedValueCount,
      savedValidationCount,
      validationResult,
    };
  } catch (error) {
    await connection.rollback();

    logStep('SAVE_AI_PROCESS_RESULT_FAILED', startTime, {
      sourceFileId,
      errorMessage: error.message,
    });

    throw error;
  } finally {
    connection.release();
  }
};

const markAiFailed = async (sourceFileId, error) => {
  const [rows] = await pool.query(
    'SELECT upload_batch_id AS batchId FROM source_files WHERE id = ? LIMIT 1',
    [sourceFileId]
  );

  const batchId = rows[0]?.batchId || null;

  await pool.query(
    `
    UPDATE source_files
    SET 
      status = 'FAILED',
      error_message = ?,
      completed_at = CURRENT_TIMESTAMP,
      processed_at = CURRENT_TIMESTAMP
    WHERE id = ?
    `,
    [error.message || 'AI 처리 중 오류가 발생했습니다.', sourceFileId]
  );

  if (batchId) {
    await recalculateBatchStatus(batchId);
  }
};

const processSourceFileById = async (sourceFileId) => {
  const startTime = nowMs();

  logStep('PROCESS_SOURCE_FILE_START', null, {
    sourceFileId,
  });

  const sourceFile = await loadSourceFile(sourceFileId);

  if (!sourceFile) {
    const error = new Error('원본 파일을 찾을 수 없습니다.');
    error.statusCode = 404;
    throw error;
  }

  await pool.query(
    `
    UPDATE source_files
    SET 
      status = 'EXTRACTING',
      error_message = NULL,
      completed_at = NULL
    WHERE id = ?
    `,
    [sourceFileId]
  );

  await markBatchProcessing(sourceFile.batchId);

  try {
    const aiData = await callPythonProcessUpload(sourceFile);

    const result = await saveAiProcessResult({
      sourceFile,
      sourceFileId,
      aiData,
    });

    logStep('PROCESS_SOURCE_FILE_DONE', startTime, {
      sourceFileId,
      status: result.status,
      savedValueCount: result.savedValueCount,
      savedValidationCount: result.savedValidationCount,
    });

    return result;
  } catch (error) {
    await markAiFailed(sourceFileId, error);

    logStep('PROCESS_SOURCE_FILE_FAILED', startTime, {
      sourceFileId,
      errorMessage: error.message,
    });

    throw error;
  }
};

module.exports = {
  processSourceFileById,
};