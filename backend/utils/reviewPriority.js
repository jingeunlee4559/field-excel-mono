const DAY_MS = 24 * 60 * 60 * 1000;

const DEFAULT_REVIEW_DUE_DAYS = Number(process.env.REVIEW_DUE_DAYS || 3);
const DEFAULT_SUPPLEMENT_DUE_DAYS = Number(process.env.SUPPLEMENT_DUE_DAYS || 2);
const DEFAULT_SETTLEMENT_CUTOFF_DAY = Number(process.env.SETTLEMENT_CUTOFF_DAY || 5);
const DEFAULT_DUE_SOON_DAYS = Number(process.env.DUE_SOON_DAYS || 3);
const DEFAULT_MAX_PAST_DAYS = Number(process.env.EXPENSE_DATE_MAX_PAST_DAYS || 365);
const DEFAULT_FUTURE_GRACE_DAYS = Number(process.env.EXPENSE_DATE_FUTURE_GRACE_DAYS || 1);

const toInt = (value, fallback = 0) => {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
};

const normalizeConfidencePercent = (value) => {
  if (value === undefined || value === null || value === '') return null;
  const number = Number(value);
  if (!Number.isFinite(number)) return null;
  const percent = number <= 1 ? number * 100 : number;
  return Math.max(0, Math.min(100, Math.round(percent)));
};

const pad2 = (value) => String(value).padStart(2, '0');

const makeUtcDate = (year, month, day) => {
  const y = Number(year);
  const m = Number(month);
  const d = Number(day);
  if (!Number.isInteger(y) || !Number.isInteger(m) || !Number.isInteger(d)) return null;
  if (m < 1 || m > 12 || d < 1 || d > 31) return null;

  const date = new Date(Date.UTC(y, m - 1, d));
  if (
    date.getUTCFullYear() !== y ||
    date.getUTCMonth() !== m - 1 ||
    date.getUTCDate() !== d
  ) {
    return null;
  }

  return date;
};

const toDateOnly = (value) => {
  if (!value) return null;

  if (value instanceof Date) {
    if (Number.isNaN(value.getTime())) return null;
    return makeUtcDate(value.getFullYear(), value.getMonth() + 1, value.getDate());
  }

  const text = String(value).trim();
  if (!text) return null;

  const isoMatch = text.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (isoMatch) return makeUtcDate(isoMatch[1], isoMatch[2], isoMatch[3]);

  const dotMatch = text.match(/(\d{2,4})[.\/년\-\s](\d{1,2})[.\/월\-\s](\d{1,2})/);
  if (dotMatch) {
    let year = Number(dotMatch[1]);
    if (year < 100) year += 2000;
    return makeUtcDate(year, dotMatch[2], dotMatch[3]);
  }

  const compactMatch = text.match(/\b(\d{4})(\d{2})(\d{2})\b/);
  if (compactMatch) return makeUtcDate(compactMatch[1], compactMatch[2], compactMatch[3]);

  const shortCompactMatch = text.match(/\b(\d{2})(\d{2})(\d{2})\b/);
  if (shortCompactMatch) return makeUtcDate(2000 + Number(shortCompactMatch[1]), shortCompactMatch[2], shortCompactMatch[3]);

  return null;
};

const toIsoDate = (date) => {
  if (!date || Number.isNaN(date.getTime())) return null;
  return `${date.getUTCFullYear()}-${pad2(date.getUTCMonth() + 1)}-${pad2(date.getUTCDate())}`;
};

const addDays = (date, days) => {
  if (!date) return null;
  return new Date(date.getTime() + Number(days || 0) * DAY_MS);
};

const diffDays = (targetDate, baseDate) => {
  if (!targetDate || !baseDate) return null;
  const target = makeUtcDate(targetDate.getUTCFullYear(), targetDate.getUTCMonth() + 1, targetDate.getUTCDate());
  const base = makeUtcDate(baseDate.getUTCFullYear(), baseDate.getUTCMonth() + 1, baseDate.getUTCDate());
  return Math.ceil((target.getTime() - base.getTime()) / DAY_MS);
};

const validateExpenseDate = (rawExpenseDate, today = new Date()) => {
  if (!rawExpenseDate) {
    return {
      expenseDate: null,
      expenseDateStatus: 'MISSING',
      expenseDateIssueReason: '결제일이 추출되지 않았습니다.',
      validForSettlement: false,
    };
  }

  const expenseDate = toDateOnly(rawExpenseDate);
  if (!expenseDate) {
    return {
      expenseDate: null,
      expenseDateStatus: 'SUSPICIOUS',
      expenseDateIssueReason: '결제일 형식이 올바르지 않습니다.',
      validForSettlement: false,
    };
  }

  const todayOnly = makeUtcDate(today.getFullYear(), today.getMonth() + 1, today.getDate());
  const currentYear = todayOnly.getUTCFullYear();
  const year = expenseDate.getUTCFullYear();

  if (year < currentYear - 1 || year > currentYear + 1) {
    return {
      expenseDate: toIsoDate(expenseDate),
      expenseDateStatus: 'TOO_FAR_YEAR',
      expenseDateIssueReason: `현재 연도와 차이가 큽니다. 추출 연도: ${year}`,
      validForSettlement: false,
    };
  }

  const daysFromToday = diffDays(expenseDate, todayOnly);
  if (daysFromToday > DEFAULT_FUTURE_GRACE_DAYS) {
    return {
      expenseDate: toIsoDate(expenseDate),
      expenseDateStatus: 'FUTURE_DATE',
      expenseDateIssueReason: '결제일이 현재일보다 미래입니다.',
      validForSettlement: false,
    };
  }

  if (daysFromToday < -DEFAULT_MAX_PAST_DAYS) {
    return {
      expenseDate: toIsoDate(expenseDate),
      expenseDateStatus: 'TOO_OLD',
      expenseDateIssueReason: `${DEFAULT_MAX_PAST_DAYS}일보다 오래된 결제일입니다.`,
      validForSettlement: false,
    };
  }

  return {
    expenseDate: toIsoDate(expenseDate),
    expenseDateStatus: 'NORMAL',
    expenseDateIssueReason: '정상 결제일입니다.',
    validForSettlement: true,
  };
};

const calculateSettlementDueDate = (expenseDateValue) => {
  const expenseDate = toDateOnly(expenseDateValue);
  if (!expenseDate) return null;

  const year = expenseDate.getUTCFullYear();
  const nextMonthIndex = expenseDate.getUTCMonth() + 1;
  const dueMonthDate = new Date(Date.UTC(year, nextMonthIndex, 1));
  const dueYear = dueMonthDate.getUTCFullYear();
  const dueMonth = dueMonthDate.getUTCMonth() + 1;
  const lastDayOfDueMonth = new Date(Date.UTC(dueYear, dueMonth, 0)).getUTCDate();
  const dueDay = Math.min(DEFAULT_SETTLEMENT_CUTOFF_DAY, lastDayOfDueMonth);
  return makeUtcDate(dueYear, dueMonth, dueDay);
};

const getDeadlineStatus = (deadlineDateValue, today = new Date()) => {
  const deadlineDate = toDateOnly(deadlineDateValue);
  if (!deadlineDate) return { deadlineStatus: 'NONE', deadlineDday: null, deadlineStatusLabel: '마감일 없음' };

  const todayOnly = makeUtcDate(today.getFullYear(), today.getMonth() + 1, today.getDate());
  const dday = diffDays(deadlineDate, todayOnly);

  if (dday < 0) return { deadlineStatus: 'OVERDUE', deadlineDday: dday, deadlineStatusLabel: `D+${Math.abs(dday)}` };
  if (dday === 0) return { deadlineStatus: 'TODAY', deadlineDday: 0, deadlineStatusLabel: '오늘 마감' };
  if (dday <= DEFAULT_DUE_SOON_DAYS) return { deadlineStatus: 'DUE_SOON', deadlineDday: dday, deadlineStatusLabel: `D-${dday}` };
  if (dday <= 7) return { deadlineStatus: 'NORMAL', deadlineDday: dday, deadlineStatusLabel: `D-${dday}` };
  return { deadlineStatus: 'ENOUGH', deadlineDday: dday, deadlineStatusLabel: `D-${dday}` };
};

const getScoreBand = (score) => {
  if (score === null || score === undefined) return 'MISSING';
  if (score <= 0) return 'ZERO';
  if (score < 30) return 'CRITICAL';
  if (score < 50) return 'LOW';
  if (score < 70) return 'WARNING';
  if (score < 90) return 'GOOD';
  return 'EXCELLENT';
};

const getSettlementStatus = (row = {}) => {
  const explicit = row.settlementStatus || row.settlement_status || row.paymentStatus || row.payment_status;
  if (explicit) return explicit;

  const status = row.status || row.batchStatus || row.rawBatchStatus;
  if (status === 'CONFIRMED' || status === 'REVIEW_COMPLETED') return 'SETTLED';
  if (status === 'NORMAL' || status === 'READY_TO_CONFIRM') return 'READY_TO_SETTLE';
  if (status === 'NEED_SUPPLEMENT' || status === 'FAILED' || status === 'HAS_FAILED') return 'ON_HOLD';
  return 'UNSETTLED';
};

const getBatchSettlementCounts = (row = {}) => {
  const total = toInt(row.totalFileCount);
  const explicitUnsettled = row.unsettledCount ?? row.unsettled_count;
  const explicitReady = row.readyToSettleCount ?? row.ready_to_settle_count;
  const explicitSettled = row.settledCount ?? row.settled_count;
  const explicitHold = row.onHoldCount ?? row.on_hold_count;

  const readyToSettleCount = explicitReady !== undefined && explicitReady !== null
    ? toInt(explicitReady)
    : toInt(row.normalCount);
  const settledCount = explicitSettled !== undefined && explicitSettled !== null
    ? toInt(explicitSettled)
    : toInt(row.confirmedCount);
  const onHoldCount = explicitHold !== undefined && explicitHold !== null
    ? toInt(explicitHold)
    : toInt(row.needSupplementCount) + toInt(row.failedCount);
  const fallbackUnsettled = Math.max(0, total - readyToSettleCount - settledCount - onHoldCount);
  const unsettledCount = explicitUnsettled !== undefined && explicitUnsettled !== null
    ? toInt(explicitUnsettled)
    : fallbackUnsettled;

  return {
    unsettledCount,
    readyToSettleCount,
    settledCount,
    onHoldCount,
  };
};

const getPresetDateRange = (preset, today = new Date()) => {
  const todayOnly = makeUtcDate(today.getFullYear(), today.getMonth() + 1, today.getDate());
  if (!preset) return { from: null, to: null };
  if (preset === 'TODAY') return { from: todayOnly, to: todayOnly };
  if (preset === 'LAST_7_DAYS') return { from: addDays(todayOnly, -6), to: todayOnly };
  if (preset === 'THIS_MONTH') {
    const from = makeUtcDate(todayOnly.getUTCFullYear(), todayOnly.getUTCMonth() + 1, 1);
    const to = makeUtcDate(todayOnly.getUTCFullYear(), todayOnly.getUTCMonth() + 2, 0);
    return { from, to };
  }
  if (preset === 'LAST_MONTH') {
    const from = makeUtcDate(todayOnly.getUTCFullYear(), todayOnly.getUTCMonth(), 1);
    const to = makeUtcDate(todayOnly.getUTCFullYear(), todayOnly.getUTCMonth() + 1, 0);
    return { from, to };
  }
  return { from: null, to: null };
};

const getFilterDateRange = ({ datePreset, dateFrom, dateTo } = {}) => {
  if (datePreset === 'CUSTOM') {
    return {
      from: toDateOnly(dateFrom),
      to: toDateOnly(dateTo),
    };
  }
  return getPresetDateRange(datePreset);
};

const rangesOverlap = (startValue, endValue, fromDate, toDate) => {
  if (!fromDate && !toDate) return true;
  const start = toDateOnly(startValue);
  const end = toDateOnly(endValue || startValue);
  if (!start && !end) return false;

  const safeStart = start || end;
  const safeEnd = end || start;
  if (fromDate && safeEnd.getTime() < fromDate.getTime()) return false;
  if (toDate && safeStart.getTime() > toDate.getTime()) return false;
  return true;
};

const matchesDateFilter = (item = {}, filters = {}) => {
  const { dateType = '', datePreset = '', dateFrom = '', dateTo = '' } = filters;
  if (!datePreset && !dateFrom && !dateTo) return true;
  const { from, to } = getFilterDateRange({ datePreset, dateFrom, dateTo });
  if (!from && !to) return true;

  if (dateType === 'expense') {
    return rangesOverlap(item.expenseDate || item.expenseDateMin, item.expenseDate || item.expenseDateMax, from, to);
  }
  if (dateType === 'deadline') {
    return rangesOverlap(item.deadlineDate, item.deadlineDate, from, to);
  }
  return rangesOverlap(item.uploadedAt || item.submittedAt || item.lastUploadedAt || item.createdAt, item.uploadedAt || item.submittedAt || item.lastUploadedAt || item.createdAt, from, to);
};

const matchesSettlementStatus = (item = {}, settlementStatus = '') => {
  if (!settlementStatus) return true;
  if (item.totalFileCount !== undefined || item.total_file_count !== undefined) {
    const counts = getBatchSettlementCounts(item);
    if (settlementStatus === 'UNSETTLED') return counts.unsettledCount > 0;
    if (settlementStatus === 'READY_TO_SETTLE') return counts.readyToSettleCount > 0;
    if (settlementStatus === 'SETTLED') return counts.settledCount > 0;
    if (settlementStatus === 'ON_HOLD') return counts.onHoldCount > 0;
  }
  return getSettlementStatus(item) === settlementStatus;
};

const DEADLINE_TYPE_LABEL = {
  DEADLINE: '마감일',
};

const DEADLINE_TYPE_BASIS = {
  DEADLINE: `기준일의 다음 달 ${DEFAULT_SETTLEMENT_CUTOFF_DAY}일`,
};

const chooseDeadline = ({
  status,
  rawExpenseDate,
  uploadedAt,
  completedAt,
  manualDeadlineDate,
  hasSupplement = false,
  hasFailed = false,
} = {}) => {
  const today = new Date();
  const uploadedDate = toDateOnly(uploadedAt) || makeUtcDate(today.getFullYear(), today.getMonth() + 1, today.getDate());
  const completedDate = toDateOnly(completedAt) || uploadedDate;
  const expenseDateCheck = validateExpenseDate(rawExpenseDate, today);
  const manualDate = toDateOnly(manualDeadlineDate);

  // 통일 정책:
  // 1) 화면/업무 기준 명칭은 모두 "마감일" 하나만 사용한다.
  // 2) 결제일이 정상인 경우: 결제월의 다음 달 5일.
  // 3) 결제일이 없거나 이상한 경우: 업로드일의 다음 달 5일.
  // 4) 관리자가 수동 마감일을 지정한 경우에만 수동값을 우선한다.
  const baseDateForDeadline = expenseDateCheck.validForSettlement
    ? toDateOnly(expenseDateCheck.expenseDate)
    : uploadedDate;
  const unifiedDueDate = calculateSettlementDueDate(baseDateForDeadline);
  const deadlineDate = manualDate || unifiedDueDate;
  const deadline = getDeadlineStatus(deadlineDate, today);

  return {
    ...expenseDateCheck,
    reviewDueDate: toIsoDate(unifiedDueDate),
    supplementDueDate: toIsoDate(calculateSettlementDueDate(completedDate)),
    settlementDueDate: toIsoDate(unifiedDueDate),
    deadlineDate: toIsoDate(deadlineDate),
    deadlineType: 'DEADLINE',
    deadlineTypeLabel: '마감일',
    deadlineBasis: manualDate
      ? '관리자가 직접 지정한 마감일입니다.'
      : `기준일의 다음 달 ${DEFAULT_SETTLEMENT_CUTOFF_DAY}일입니다.`,
    hasSupplement: Boolean(hasSupplement),
    hasFailed: Boolean(hasFailed || status === 'FAILED'),
    ...deadline,
  };
};

const calculateUrgency = ({ status, score, deadlineStatus, needSupplementCount = 0, failedCount = 0 } = {}) => {
  let urgencyRank = 50;
  let urgencyReason = '일반 검토 항목입니다.';

  if (deadlineStatus === 'OVERDUE') {
    urgencyRank = 100;
    urgencyReason = '마감일이 지났습니다.';
  } else if (deadlineStatus === 'TODAY') {
    urgencyRank = 95;
    urgencyReason = '오늘 마감입니다.';
  } else if (deadlineStatus === 'DUE_SOON') {
    urgencyRank = 85;
    urgencyReason = `${DEFAULT_DUE_SOON_DAYS}일 이내 마감입니다.`;
  }

  if (status === 'FAILED' || toInt(failedCount) > 0) {
    if (urgencyRank < 88) {
      urgencyRank = 88;
      urgencyReason = '처리 실패 항목이 있어 우선 확인이 필요합니다.';
    }
  }

  if (status === 'NEED_SUPPLEMENT' || toInt(needSupplementCount) > 0) {
    if (urgencyRank < 80) {
      urgencyRank = 80;
      urgencyReason = '보완 요청이 필요한 항목입니다.';
    }
  }

  const safeScore = normalizeConfidencePercent(score);
  if (safeScore === null || safeScore <= 0) {
    if (urgencyRank < 78) {
      urgencyRank = 78;
      urgencyReason = 'AI 추출 점수가 없거나 0점입니다.';
    }
  } else if (safeScore < 30) {
    if (urgencyRank < 76) {
      urgencyRank = 76;
      urgencyReason = 'AI 추출 점수가 30점 미만입니다.';
    }
  } else if (safeScore < 50) {
    if (urgencyRank < 72) {
      urgencyRank = 72;
      urgencyReason = 'AI 추출 점수가 50점 미만입니다.';
    }
  } else if (safeScore < 70) {
    if (urgencyRank < 62) {
      urgencyRank = 62;
      urgencyReason = 'AI 추출 점수가 70점 미만입니다.';
    }
  }

  if (['NORMAL', 'CONFIRMED', 'READY_TO_CONFIRM', 'REVIEW_COMPLETED'].includes(status) && urgencyRank <= 50) {
    urgencyRank = 20;
    urgencyReason = '검증 통과 또는 확정 완료 항목입니다.';
  }

  let urgencyLevel = 'NORMAL';
  let urgencyLabel = '보통';
  if (urgencyRank >= 90) {
    urgencyLevel = 'URGENT';
    urgencyLabel = '긴급';
  } else if (urgencyRank >= 70) {
    urgencyLevel = 'HIGH';
    urgencyLabel = '높음';
  } else if (urgencyRank < 45) {
    urgencyLevel = 'LOW';
    urgencyLabel = '낮음';
  }

  return { urgencyLevel, urgencyLabel, urgencyRank, urgencyReason };
};

const enrichFileReviewRow = (row = {}) => {
  const score = normalizeConfidencePercent(row.confidenceScore ?? row.confidence_score ?? row.avgConfidencePercent);
  const deadlineInfo = chooseDeadline({
    status: row.status,
    rawExpenseDate: row.expenseDate || row.expense_date || row.expenseDateRaw,
    uploadedAt: row.uploadedAt || row.uploaded_at || row.submittedAt || row.submitted_at,
    completedAt: row.completedAt || row.completed_at,
    manualDeadlineDate: row.manualDeadlineDate || row.manual_deadline_date,
  });
  const urgency = calculateUrgency({ status: row.status, score, deadlineStatus: deadlineInfo.deadlineStatus });

  return {
    ...row,
    confidenceScore: score,
    scoreBand: getScoreBand(score),
    settlementStatus: getSettlementStatus(row),
    ...deadlineInfo,
    ...urgency,
  };
};

const enrichBatchReviewRow = (row = {}) => {
  const score = normalizeConfidencePercent(row.avgConfidencePercent ?? row.avgConfidence);
  const status = row.batchStatus || row.status || row.rawBatchStatus;
  const rawExpenseDateMin = row.expenseDateMinRaw || row.expenseDateMin;
  const rawExpenseDateMax = row.expenseDateMaxRaw || row.expenseDateMax;
  const minDateCheck = validateExpenseDate(rawExpenseDateMin);
  const maxDateCheck = validateExpenseDate(rawExpenseDateMax);
  const representativeExpenseDate = minDateCheck.validForSettlement
    ? minDateCheck.expenseDate
    : (maxDateCheck.validForSettlement ? maxDateCheck.expenseDate : (rawExpenseDateMin || rawExpenseDateMax));

  const deadlineInfo = chooseDeadline({
    status,
    rawExpenseDate: representativeExpenseDate,
    uploadedAt: row.lastUploadedAt || row.submittedAt || row.submitted_at,
    completedAt: row.lastCompletedAt || row.completedAt || row.completed_at,
    manualDeadlineDate: row.manualDeadlineDate || row.manual_deadline_date,
    hasSupplement: toInt(row.needSupplementCount) > 0,
    hasFailed: toInt(row.failedCount) > 0,
  });
  const urgency = calculateUrgency({
    status,
    score,
    deadlineStatus: deadlineInfo.deadlineStatus,
    needSupplementCount: row.needSupplementCount,
    failedCount: row.failedCount,
  });

  const settlementCounts = getBatchSettlementCounts(row);

  return {
    ...row,
    ...settlementCounts,
    avgConfidencePercent: score,
    scoreBand: getScoreBand(score),
    expenseDateMin: minDateCheck.validForSettlement ? minDateCheck.expenseDate : null,
    expenseDateMax: maxDateCheck.validForSettlement ? maxDateCheck.expenseDate : null,
    expenseDateStatus: deadlineInfo.expenseDateStatus,
    expenseDateIssueReason: deadlineInfo.expenseDateIssueReason,
    ...deadlineInfo,
    ...urgency,
  };
};

const matchesScoreBucket = (item, scoreBucket) => {
  if (!scoreBucket) return true;
  const score = normalizeConfidencePercent(item.confidenceScore ?? item.avgConfidencePercent);
  if (scoreBucket === 'MISSING') return score === null;
  if (scoreBucket === 'ZERO') return score !== null && score <= 0;
  if (scoreBucket === 'LT30') return score !== null && score < 30;
  if (scoreBucket === 'LT50') return score !== null && score < 50;
  if (scoreBucket === 'LT70') return score !== null && score < 70;
  if (scoreBucket === 'GE90') return score !== null && score >= 90;
  return true;
};

const filterReviewRows = (items = [], filters = {}) => {
  const urgency = filters.urgency || filters.urgencyLevel || '';
  const deadlineStatus = filters.deadlineStatus || '';
  const scoreBucket = filters.scoreBucket || '';
  const settlementStatus = filters.settlementStatus || filters.paymentStatus || '';

  return items.filter((item) => {
    if (urgency && item.urgencyLevel !== urgency) return false;
    if (deadlineStatus && item.deadlineStatus !== deadlineStatus) return false;
    if (!matchesScoreBucket(item, scoreBucket)) return false;
    if (!matchesSettlementStatus(item, settlementStatus)) return false;
    if (!matchesDateFilter(item, filters)) return false;
    return true;
  });
};

const getDateTime = (value, nullValue = Number.MAX_SAFE_INTEGER) => {
  const date = toDateOnly(value);
  return date ? date.getTime() : nullValue;
};

const getUploadedTime = (item) => {
  const raw = item.uploadedAt || item.submittedAt || item.lastUploadedAt || item.createdAt;
  if (!raw) return 0;
  const date = new Date(raw);
  return Number.isNaN(date.getTime()) ? 0 : date.getTime();
};

const compareNumber = (a, b) => {
  if (a === b) return 0;
  return a > b ? 1 : -1;
};

const getScoreValue = (item, fallback = 999) => {
  const value = item.confidenceScore ?? item.avgConfidencePercent;
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
};

const getIssueCount = (item) => {
  const explicit = item.issueCount ?? item.issue_count ?? item.problemCount ?? item.problem_count;
  if (explicit !== undefined && explicit !== null && explicit !== '') return Number(explicit || 0);

  const needReview = Number(item.needReviewCount ?? item.need_review_count ?? 0);
  const needSupplement = Number(item.needSupplementCount ?? item.need_supplement_count ?? 0);
  const failed = Number(item.failedCount ?? item.failed_count ?? 0);
  const batchIssueCount = needReview + needSupplement + failed;
  if (batchIssueCount > 0) return batchIssueCount;

  return ['NEED_REVIEW', 'NEED_SUPPLEMENT', 'FAILED'].includes(item.status) ? 1 : 0;
};

const getFileCount = (item) => {
  const value = item.totalFileCount ?? item.total_file_count ?? item.fileCount ?? item.file_count;
  const number = Number(value);
  return Number.isFinite(number) ? number : 1;
};

const getSortConfig = (sort = 'urgent', sortBy = '', sortOrder = '') => {
  const legacyMap = {
    urgent: ['urgency', 'desc'],
    latest: ['uploaded_at', 'desc'],
    oldest: ['uploaded_at', 'asc'],
    deadline_asc: ['deadline', 'asc'],
    deadline_desc: ['deadline', 'desc'],
    score_asc: ['score', 'asc'],
    score_desc: ['score', 'desc'],
    expense_date_asc: ['expense_date', 'asc'],
    expense_date_desc: ['expense_date', 'desc'],
    urgency_desc: ['urgency', 'desc'],
    urgency_asc: ['urgency', 'asc'],
    uploaded_at_desc: ['uploaded_at', 'desc'],
    uploaded_at_asc: ['uploaded_at', 'asc'],
    issue_count_desc: ['issue_count', 'desc'],
    issue_count_asc: ['issue_count', 'asc'],
    file_count_desc: ['file_count', 'desc'],
    file_count_asc: ['file_count', 'asc'],
  };

  const [legacyBy, legacyOrder] = legacyMap[sort] || legacyMap.urgent;
  const safeBy = sortBy || legacyBy;
  const safeOrder = sortOrder === 'asc' || sortOrder === 'desc' ? sortOrder : legacyOrder;

  return { sortBy: safeBy, sortOrder: safeOrder };
};

const compareByDirection = (a, b, sortOrder = 'desc') => {
  const result = compareNumber(a, b);
  return sortOrder === 'asc' ? result : -result;
};

const sortReviewRows = (items = [], sort = 'urgent', sortBy = '', sortOrder = '') => {
  const copied = [...items];
  const config = getSortConfig(sort, sortBy, sortOrder);

  copied.sort((a, b) => {
    let primary = 0;

    if (config.sortBy === 'uploaded_at') {
      primary = compareByDirection(getUploadedTime(a), getUploadedTime(b), config.sortOrder);
    } else if (config.sortBy === 'deadline') {
      primary = compareByDirection(getDateTime(a.deadlineDate), getDateTime(b.deadlineDate), config.sortOrder);
    } else if (config.sortBy === 'score') {
      primary = compareByDirection(getScoreValue(a, config.sortOrder === 'asc' ? 999 : -1), getScoreValue(b, config.sortOrder === 'asc' ? 999 : -1), config.sortOrder);
    } else if (config.sortBy === 'expense_date') {
      primary = compareByDirection(getDateTime(a.expenseDate || a.expenseDateMin), getDateTime(b.expenseDate || b.expenseDateMin), config.sortOrder);
    } else if (config.sortBy === 'issue_count') {
      primary = compareByDirection(getIssueCount(a), getIssueCount(b), config.sortOrder);
    } else if (config.sortBy === 'file_count') {
      primary = compareByDirection(getFileCount(a), getFileCount(b), config.sortOrder);
    } else {
      primary = compareByDirection(a.urgencyRank || 0, b.urgencyRank || 0, config.sortOrder);
    }

    return (
      primary ||
      compareNumber(b.urgencyRank || 0, a.urgencyRank || 0) ||
      compareNumber(getDateTime(a.deadlineDate), getDateTime(b.deadlineDate)) ||
      compareNumber(getScoreValue(a), getScoreValue(b)) ||
      getUploadedTime(b) - getUploadedTime(a)
    );
  });

  return copied;
};

module.exports = {
  normalizeConfidencePercent,
  validateExpenseDate,
  calculateSettlementDueDate,
  getDeadlineStatus,
  enrichFileReviewRow,
  enrichBatchReviewRow,
  filterReviewRows,
  sortReviewRows,
  getSettlementStatus,
  getBatchSettlementCounts,
};
