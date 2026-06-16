import {
  FiAlertCircle,
  FiAlertTriangle,
  FiCheckCircle,
  FiClock,
  FiLayers,
  FiXCircle,
  FiZap,
} from 'react-icons/fi';

export const PAGE_SIZE = 20;

export const STATUS_OPTIONS = [
  { value: '', label: '상태 전체' },
  { value: 'NEED_REVIEW', label: '검토 필요' },
  { value: 'NEED_SUPPLEMENT', label: '보완 필요' },
  { value: 'NORMAL', label: '확정 가능' },
  { value: 'CONFIRMED', label: '확정 완료' },
  { value: 'FAILED', label: '처리 실패' },
  { value: 'PROCESSING', label: 'AI 처리 중' },
];

export const URGENCY_OPTIONS = [
  { value: '', label: '긴급도 전체' },
  { value: 'URGENT', label: '긴급' },
  { value: 'HIGH', label: '높음' },
  { value: 'NORMAL', label: '보통' },
  { value: 'LOW', label: '낮음' },
];

export const DEADLINE_OPTIONS = [
  { value: '', label: '마감 전체' },
  { value: 'OVERDUE', label: '기한초과' },
  { value: 'TODAY', label: '오늘 마감' },
  { value: 'DUE_SOON', label: '3일 이내' },
  { value: 'NONE', label: '마감 없음' },
];

export const SCORE_OPTIONS = [
  { value: '', label: '점수 전체' },
  { value: 'ZERO', label: '0점' },
  { value: 'LT30', label: '30점 미만' },
  { value: 'LT50', label: '50점 미만' },
  { value: 'LT70', label: '70점 미만' },
  { value: 'GE90', label: '90점 이상' },
];

export const DATE_TYPE_OPTIONS = [
  { value: 'uploaded', label: '업로드일' },
  { value: 'expense', label: '결제일' },
  { value: 'deadline', label: '마감일' },
];

export const DATE_PRESET_OPTIONS = [
  { value: '', label: '기간 전체' },
  { value: 'TODAY', label: '오늘' },
  { value: 'LAST_7_DAYS', label: '최근 7일' },
  { value: 'THIS_MONTH', label: '이번 달' },
  { value: 'LAST_MONTH', label: '지난 달' },
  { value: 'CUSTOM', label: '직접 선택' },
];

export const SETTLEMENT_OPTIONS = [
  { value: '', label: '결제 전체' },
  { value: 'UNSETTLED', label: '미결제' },
  { value: 'READY_TO_SETTLE', label: '결제대기' },
  { value: 'SETTLED', label: '결제완료' },
  { value: 'ON_HOLD', label: '보류' },
];

export const SORT_BY_OPTIONS = [
  { value: 'urgency', label: '긴급도' },
  { value: 'deadline', label: '마감일' },
  { value: 'score', label: '신뢰도 점수' },
  { value: 'expense_date', label: '결제일' },
  { value: 'uploaded_at', label: '업로드일' },
  { value: 'issue_count', label: '문제 수' },
  { value: 'file_count', label: '파일 수' },
];

export const SORT_ORDER_OPTIONS = [
  { value: 'desc', label: '내림차순' },
  { value: 'asc', label: '오름차순' },
];

export const getSortDisplayLabel = (sortBy, sortOrder) => {
  const order = sortOrder === 'asc' ? 'asc' : 'desc';
  const labels = {
    urgency: { asc: '긴급도 낮은 순', desc: '긴급도 높은 순' },
    deadline: { asc: '마감 빠른 순', desc: '마감 늦은 순' },
    score: { asc: '점수 낮은 순', desc: '점수 높은 순' },
    expense_date: { asc: '결제일 오래된 순', desc: '결제일 최신순' },
    uploaded_at: { asc: '업로드 오래된 순', desc: '업로드 최신순' },
    issue_count: { asc: '문제 적은 순', desc: '문제 많은 순' },
    file_count: { asc: '파일 적은 순', desc: '파일 많은 순' },
  };
  return labels[sortBy]?.[order] || '긴급도 높은 순';
};

export const STATUS_META = {
  PROCESSING: { label: 'AI 처리 중', icon: FiZap, tone: 'blue' },
  QUEUED: { label: '대기', icon: FiClock, tone: 'blue' },
  UPLOADED: { label: '업로드', icon: FiClock, tone: 'slate' },
  NEED_REVIEW: { label: '검토 필요', icon: FiAlertTriangle, tone: 'amber' },
  NEED_SUPPLEMENT: { label: '보완 필요', icon: FiAlertCircle, tone: 'rose' },
  NORMAL: { label: '확정 가능', icon: FiCheckCircle, tone: 'emerald' },
  CONFIRMED: { label: '확정 완료', icon: FiCheckCircle, tone: 'blue' },
  FAILED: { label: '처리 실패', icon: FiXCircle, tone: 'red' },
  EXTRACTING: { label: 'AI 처리 중', icon: FiZap, tone: 'blue' },
  OCR_PROCESSING: { label: 'OCR 처리 중', icon: FiClock, tone: 'blue' },
  AI_PROCESSING: { label: 'AI 처리 중', icon: FiZap, tone: 'indigo' },
  READY_TO_CONFIRM: { label: '확정 대기', icon: FiCheckCircle, tone: 'emerald' },
  REVIEW_COMPLETED: { label: '검토 완료', icon: FiCheckCircle, tone: 'blue' },
  HAS_FAILED: { label: '실패 포함', icon: FiXCircle, tone: 'red' },
  MIXED: { label: '혼합', icon: FiLayers, tone: 'slate' },
  EMPTY: { label: '파일 없음', icon: FiAlertCircle, tone: 'slate' },
  UNKNOWN: { label: '상태 미확인', icon: FiAlertCircle, tone: 'slate' },
};

export const URGENCY_META = {
  URGENT: { label: '긴급', tone: 'red' },
  HIGH: { label: '높음', tone: 'orange' },
  NORMAL: { label: '보통', tone: 'slate' },
  LOW: { label: '낮음', tone: 'emerald' },
};

export const SETTLEMENT_META = {
  UNSETTLED: { label: '미결제', tone: 'amber' },
  READY_TO_SETTLE: { label: '결제대기', tone: 'blue' },
  SETTLED: { label: '결제완료', tone: 'emerald' },
  ON_HOLD: { label: '보류', tone: 'rose' },
  UNKNOWN: { label: '결제확인', tone: 'slate' },
};

export const DEADLINE_META = {
  OVERDUE: { label: '기한초과', tone: 'red' },
  TODAY: { label: '오늘', tone: 'red' },
  DUE_SOON: { label: '임박', tone: 'amber' },
  NORMAL: { label: '보통', tone: 'blue' },
  ENOUGH: { label: '여유', tone: 'emerald' },
  NONE: { label: '마감 없음', tone: 'slate' },
};

export const ISSUE_KEYWORDS = [
  { keys: ['금액', '합계', 'amount', 'total'], label: '금액 불일치', tone: 'red' },
  { keys: ['사용일자', '결제일', '날짜', 'date'], label: '결제일 확인', tone: 'orange' },
  { keys: ['품목', '상세', 'item'], label: '상세품목 확인', tone: 'purple' },
  { keys: ['이미지', '품질', 'ocr', '노이즈', '흐림'], label: 'OCR 품질', tone: 'sky' },
  { keys: ['사용처', '가맹점', 'vendor'], label: '사용처 확인', tone: 'indigo' },
  { keys: ['보완', '첨부'], label: '보완 필요', tone: 'rose' },
  { keys: ['timeout', '초과', '실패', '오류'], label: '처리 오류', tone: 'red' },
  { keys: ['신뢰도', 'confidence'], label: '신뢰도 낮음', tone: 'amber' },
];

export const TONE_CLASS = {
  slate: 'bg-slate-100 text-slate-700 ring-slate-200',
  blue: 'bg-blue-50 text-blue-700 ring-blue-100',
  indigo: 'bg-indigo-50 text-indigo-700 ring-indigo-100',
  sky: 'bg-sky-50 text-sky-700 ring-sky-100',
  emerald: 'bg-emerald-50 text-emerald-700 ring-emerald-100',
  amber: 'bg-amber-50 text-amber-700 ring-amber-100',
  orange: 'bg-orange-50 text-orange-700 ring-orange-100',
  rose: 'bg-rose-50 text-rose-700 ring-rose-100',
  red: 'bg-red-50 text-red-700 ring-red-100',
  purple: 'bg-purple-50 text-purple-700 ring-purple-100',
};

export const formatValue = (value) => {
  if (value === undefined || value === null || value === '') return '-';
  return String(value);
};

export const toDate = (value) => {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date;
};

export const formatDate = (value) => {
  if (!value) return '-';
  const date = toDate(value);
  if (!date) return String(value).slice(0, 10);
  return date.toISOString().slice(0, 10);
};

export const formatTime = (value) => {
  const date = toDate(value);
  if (!date) return '';
  return date.toTimeString().slice(0, 5);
};

export const normalizeScore = (value) => {
  if (value === undefined || value === null || value === '') return null;
  const number = Number(value);
  if (!Number.isFinite(number)) return null;
  return Math.max(0, Math.min(100, Math.round(number <= 1 ? number * 100 : number)));
};

export const formatScore = (value) => {
  const score = normalizeScore(value);
  return score === null ? '-' : `${score}점`;
};

export const getScoreTone = (value) => {
  const score = normalizeScore(value);
  if (score === null) return 'slate';
  if (score <= 0) return 'rose';
  if (score < 30) return 'red';
  if (score < 50) return 'red';
  if (score < 70) return 'amber';
  if (score < 90) return 'blue';
  return 'emerald';
};

export const getScoreLabel = (value) => {
  const score = normalizeScore(value);
  if (score === null) return '점수 없음';
  if (score <= 0) return '추출 실패';
  if (score < 50) return '위험';
  if (score < 70) return '주의';
  if (score < 90) return '보통';
  return '양호';
};

export const getItemId = (item) => item.sourceFileId || item.source_file_id || item.id;
export const getOriginalFileName = (item) => item.originalFileName || item.original_file_name || item.fileName || item.file_name || '-';
export const getUploaderName = (item) => item.submitterName || item.uploaderName || item.createdByName || item.userName || item.submitter_name || item.uploader_name || item.created_by_name || '-';
export const getDepartmentName = (item) => item.departmentName || item.department_name || '-';
export const getSiteName = (item) => item.siteName || item.site_name || '-';
export const getUploadedDate = (item) => item.uploadedAt || item.createdAt || item.submittedAt || item.uploaded_at || item.created_at || item.submitted_at;
export const getReason = (item) => item.reason || item.statusMessage || item.errorMessage || item.validationMessage || item.message || item.error_message || item.validation_message || '-';
export const getExpenseDate = (item) => item.expenseDate || item.expense_date || item.expenseDateRaw || item.expense_date_raw;
export const getDeadlineDate = (item) => item.deadlineDate || item.deadline_date;
export const getDeadlineStatus = (item) => item.deadlineStatus || item.deadline_status || 'NONE';
export const getDeadlineLabel = (item) => item.deadlineStatusLabel || item.deadline_status_label || item.deadlineStatus || item.deadline_status;
export const getDeadlineBasis = (item) => item.deadlineBasis || item.deadline_basis || item.deadlineReason || item.deadline_reason || '마감일은 기준일의 다음 달 5일로 계산합니다.';
export const getUrgencyLevel = (item) => item.urgencyLevel || item.urgency_level || 'NORMAL';
export const getUrgencyReason = (item) => item.urgencyReason || item.urgency_reason || '';
export const getSettlementStatus = (item) => item.settlementStatus || item.settlement_status || item.paymentStatus || item.payment_status || 'UNSETTLED';

export const calcDdayLabel = (dateValue, fallback) => {
  const date = toDate(dateValue);
  if (!date) return fallback || '마감 없음';
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  date.setHours(0, 0, 0, 0);
  const diff = Math.ceil((date - today) / (1000 * 60 * 60 * 24));
  if (diff < 0) return `D+${Math.abs(diff)}`;
  if (diff === 0) return '오늘';
  return `D-${diff}`;
};

export const getOptionLabel = (options, value, fallback = '') => {
  return options.find((option) => option.value === value)?.label || fallback;
};
