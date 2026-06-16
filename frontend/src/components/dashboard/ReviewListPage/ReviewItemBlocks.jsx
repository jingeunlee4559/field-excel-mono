import { FiMapPin, FiUser, FiUsers } from 'react-icons/fi';
import {
  formatDate,
  formatTime,
  formatValue,
  getDeadlineBasis,
  getDeadlineDate,
  getDepartmentName,
  getExpenseDate,
  getOriginalFileName,
  getSettlementStatus,
  getSiteName,
  getUploadedDate,
  getUploaderName,
  getUrgencyLevel,
  getUrgencyReason,
} from './reviewList.constants.js';
import {
  Badge,
  CountBadge,
  DateLine,
  DeadlineBadge,
  ScoreBadge,
  SettlementBadge,
  StatusBadge,
  UrgencyBadge,
} from './ReviewBadges.jsx';

export const pickCount = (...values) => {
  for (const value of values) {
    if (value !== undefined && value !== null && value !== '') return Number(value || 0);
  }
  return 0;
};

export const getBatchSettlementCounts = (item) => {
  const total = pickCount(item.totalFileCount, item.total_file_count);
  const explicitSettled = item.settledCount ?? item.settled_count;
  const explicitReady = item.readyToSettleCount ?? item.ready_to_settle_count;
  const explicitHold = item.onHoldCount ?? item.on_hold_count;
  const explicitUnsettled = item.unsettledCount ?? item.unsettled_count;

  const settled = pickCount(explicitSettled, 0);
  const ready = pickCount(explicitReady, item.normalCount, item.confirmableCount, item.readyToConfirmCount, 0);
  const hold = pickCount(explicitHold, 0);
  const fallbackUnsettled = Math.max(0, total - settled - ready - hold);
  const unsettled = explicitUnsettled !== undefined && explicitUnsettled !== null
    ? pickCount(explicitUnsettled)
    : fallbackUnsettled;

  return { unsettled, ready, settled, hold };
};

export const BatchExpenseDate = ({ item }) => {
  const min = item.expenseDateMin;
  const max = item.expenseDateMax;

  if (!min && !max) return <span className="text-xs font-black text-slate-400">-</span>;

  if (min && max && min !== max) {
    return (
      <div className="flex flex-col gap-1">
        <span className="truncate text-xs font-black text-slate-800">{formatDate(min)}</span>
        <span className="truncate text-[10px] font-bold text-slate-400">~ {formatDate(max)}</span>
      </div>
    );
  }

  return <span className="truncate text-xs font-black text-slate-800">{formatDate(min || max)}</span>;
};

export const BatchTitle = ({ item, onOpen }) => (
  <div className="min-w-0">
    <button type="button" onClick={() => onOpen(item.batchId)} className="block max-w-full text-left">
      <p className="truncate text-sm font-black text-slate-950 hover:text-blue-600">
        {formatValue(item.batchTitle || item.templateName || item.documentType || '업로드 자료')}
      </p>
    </button>
    <p className="mt-1 text-xs font-bold text-slate-400">
      파일 {Number(item.totalFileCount || 0)}건 · {formatDate(item.submittedAt)}
    </p>
  </div>
);

export const FileTitle = ({ item }) => (
  <div className="min-w-0">
    <p title={getOriginalFileName(item)} className="truncate text-sm font-black text-slate-950">
      {formatValue(getOriginalFileName(item))}
    </p>
    <div className="mt-1 flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1 text-[11px] font-bold text-slate-500">
      <span className="inline-flex min-w-0 items-center gap-1">
        <FiUser className="shrink-0 text-slate-400" />
        <span className="truncate">{formatValue(getUploaderName(item))}</span>
      </span>
      <span className="inline-flex min-w-0 items-center gap-1">
        <FiUsers className="shrink-0 text-slate-400" />
        <span className="truncate">{formatValue(getDepartmentName(item))}</span>
      </span>
      <span className="inline-flex min-w-0 items-center gap-1">
        <FiMapPin className="shrink-0 text-slate-400" />
        <span className="truncate">{formatValue(getSiteName(item))}</span>
      </span>
    </div>
  </div>
);

export const ScheduleBlock = ({ item, type }) => {
  const uploadDate = type === 'batch' ? item.submittedAt : getUploadedDate(item);
  const expenseStatus = item.expenseDateStatus || item.expense_date_status || 'UNKNOWN';
  const expenseDate = type === 'batch' ? null : getExpenseDate(item);
  const deadlineBasis = getDeadlineBasis(item);

  return (
    <div className="grid min-w-0 grid-cols-1 gap-2 sm:grid-cols-3">
      <DateLine label="업로드" value={formatDate(uploadDate)} mutedValue={formatTime(uploadDate)} />
      {type === 'batch' ? (
        <div className="min-w-0 rounded-2xl bg-slate-50 px-3 py-2 ring-1 ring-slate-100">
          <p className="text-[10px] font-black text-slate-400">결제일</p>
          <div className="mt-1"><BatchExpenseDate item={item} /></div>
        </div>
      ) : (
        <DateLine
          label="결제일"
          value={formatDate(expenseDate)}
          mutedValue={expenseStatus !== 'NORMAL' && expenseStatus !== 'UNKNOWN' ? '날짜 확인' : ''}
          danger={expenseStatus !== 'NORMAL' && expenseStatus !== 'UNKNOWN'}
        />
      )}
      <div className="min-w-0 rounded-2xl bg-slate-50 px-3 py-2 ring-1 ring-slate-100" title={deadlineBasis}>
        <p className="truncate text-[10px] font-black text-slate-400">마감일</p>
        <div className="mt-1 flex items-center gap-1.5"><DeadlineBadge item={item} /></div>
        <p className="mt-1 truncate text-[10px] font-bold text-slate-400">{formatDate(getDeadlineDate(item))}</p>
      </div>
    </div>
  );
};

export const OwnerBlock = ({ name, department, site }) => (
  <div className="min-w-0">
    <div className="flex min-w-0 items-center gap-2">
      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-slate-100 text-slate-500"><FiUser /></span>
      <p className="truncate text-sm font-black text-slate-800">{formatValue(name)}</p>
    </div>
    <div className="mt-2 flex flex-wrap gap-1.5">
      <Badge tone="slate">{formatValue(department)}</Badge>
      <Badge tone="slate">{formatValue(site)}</Badge>
    </div>
  </div>
);

const BatchCountDetail = ({ detailGroups }) => (
  <div className="space-y-3">
    {detailGroups.map((group) => (
      <div key={group.title}>
        <p className="mb-1.5 text-[10px] font-black text-slate-400">{group.title}</p>
        <div className="flex flex-wrap gap-1.5">
          {group.items.map((detail) => (
            <CountBadge key={detail.label} label={detail.label} value={detail.value} tone={detail.tone} title={`${detail.title} ${detail.value}건`} />
          ))}
        </div>
      </div>
    ))}
  </div>
);

export const BatchCountBlock = ({ item }) => {
  const total = pickCount(item.totalFileCount, item.total_file_count);
  const confirmable = pickCount(item.normalCount, item.confirmableCount, item.readyToConfirmCount, item.normal_count);
  const confirmed = pickCount(item.confirmedCount, item.confirmed_count);
  const needReview = pickCount(item.needReviewCount, item.need_review_count);
  const needSupplement = pickCount(item.needSupplementCount, item.need_supplement_count);
  const failed = pickCount(item.failedCount, item.failed_count);
  const processing = pickCount(item.processingCount, item.processing_count, item.extractingCount, item.extracting_count);
  const settlement = getBatchSettlementCounts(item);

  const counts = {
    unpaid: pickCount(settlement.unsettled),
    waiting: pickCount(settlement.ready),
    paid: pickCount(settlement.settled),
    hold: pickCount(settlement.hold),
  };

  const issueTotal = needReview + needSupplement + failed;
  const normalTotal = confirmable + confirmed;
  const unpaidTotal = counts.unpaid + counts.waiting;

  const summaryCounts = [
    { label: '전체', value: total, tone: 'slate', title: '전체 파일 수', always: true },
    { label: '문제', value: issueTotal, tone: issueTotal > 0 ? 'red' : 'slate', title: '검토·보완·실패 합계', always: issueTotal > 0 },
    { label: '정상', value: normalTotal, tone: 'emerald', title: '확정 가능·확정 완료 합계', always: normalTotal > 0 },
    { label: '처리중', value: processing, tone: 'blue', title: 'AI/OCR 처리 중', always: processing > 0 },
    { label: '미정산', value: unpaidTotal, tone: 'amber', title: '미결제·대기 합계', always: unpaidTotal > 0 },
    { label: '보류', value: counts.hold, tone: 'rose', title: '보류', always: counts.hold > 0 },
  ].filter((count) => count.always || count.value > 0);

  const detailGroups = [
    {
      title: '처리 상태',
      items: [
        { label: '확정가능', value: confirmable, tone: 'emerald', title: '확정 가능' },
        { label: '확정완료', value: confirmed, tone: 'blue', title: '확정 완료' },
        { label: '검토필요', value: needReview, tone: 'amber', title: '검토 필요' },
        { label: '보완필요', value: needSupplement, tone: 'rose', title: '보완 필요' },
        { label: '실패', value: failed, tone: 'red', title: '처리 실패' },
        { label: '처리중', value: processing, tone: 'blue', title: 'AI/OCR 처리 중' },
      ],
    },
    {
      title: '정산 상태',
      items: [
        { label: '미결제', value: counts.unpaid, tone: 'amber', title: '미결제' },
        { label: '대기', value: counts.waiting, tone: 'blue', title: '결제/정산 대기' },
        { label: '완료', value: counts.paid, tone: 'emerald', title: '결제/정산 완료' },
        { label: '보류', value: counts.hold, tone: 'rose', title: '보류' },
      ],
    },
  ];

  const tooltipText = detailGroups
    .map((group) => `${group.title}: ${group.items.map((detail) => `${detail.label} ${detail.value}`).join(' / ')}`)
    .join(' | ');

  return (
    <div className="group relative w-full min-w-0" title={tooltipText}>
      <div className="flex min-w-0 flex-wrap items-center gap-1.5">
        {summaryCounts.map((count) => (
          <CountBadge key={count.label} label={count.label} value={count.value} tone={count.tone} title={`${count.title} ${count.value}건`} />
        ))}
        <span className="hidden rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-extrabold text-slate-500 ring-1 ring-slate-200 sm:inline-flex">
          상세
        </span>
      </div>

      <div className="pointer-events-none absolute left-0 top-full z-50 mt-2 hidden w-[380px] max-w-[calc(100vw-48px)] rounded-2xl border border-slate-200 bg-white p-3 text-left shadow-2xl ring-1 ring-slate-100 group-hover:block group-focus-within:block">
        <p className="mb-2 text-xs font-black text-slate-700">파일 현황 상세</p>
        <BatchCountDetail detailGroups={detailGroups} />
      </div>

      <details className="mt-2 sm:hidden">
        <summary className="cursor-pointer select-none text-[11px] font-black text-slate-500">상세 보기</summary>
        <div className="mt-2 rounded-2xl bg-slate-50 p-3 ring-1 ring-slate-100">
          <BatchCountDetail detailGroups={detailGroups} />
        </div>
      </details>
    </div>
  );
};

export const StatusUrgencyBlock = ({ status, urgencyLevel, urgencyReason }) => (
  <div className="flex min-w-0 flex-wrap items-center gap-1.5">
    <StatusBadge status={status} />
    <UrgencyBadge level={urgencyLevel} reason={urgencyReason} />
  </div>
);

export const FileStatusBlock = ({ item }) => (
  <div className="flex min-w-0 flex-wrap items-center gap-1.5">
    <StatusBadge status={item.status} />
    <SettlementBadge status={getSettlementStatus(item)} />
    <UrgencyBadge level={getUrgencyLevel(item)} reason={getUrgencyReason(item)} />
  </div>
);

export const ScoreBlock = ({ score }) => (
  <div className="flex min-w-0 flex-wrap items-center gap-1.5">
    <ScoreBadge value={score} />
  </div>
);

export const BatchPriorityBlock = ({ score, urgencyLevel, urgencyReason }) => (
  <div className="flex min-w-0 flex-wrap items-center gap-1.5">
    <UrgencyBadge level={urgencyLevel} reason={urgencyReason} />
    <ScoreBadge value={score} />
  </div>
);
