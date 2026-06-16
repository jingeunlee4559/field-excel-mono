import { FiClock, FiZap } from 'react-icons/fi';
import {
  DEADLINE_META,
  ISSUE_KEYWORDS,
  SETTLEMENT_META,
  STATUS_META,
  TONE_CLASS,
  URGENCY_META,
  calcDdayLabel,
  formatDate,
  formatScore,
  formatValue,
  getDeadlineBasis,
  getDeadlineDate,
  getDeadlineLabel,
  getDeadlineStatus,
  getScoreTone,
} from './reviewList.constants.js';

export const Badge = ({ children, tone = 'slate', icon: Icon, title, className = '' }) => (
  <span
    title={title}
    className={`inline-flex max-w-full shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 py-1 text-[11px] font-extrabold leading-none ring-1 ${TONE_CLASS[tone] || TONE_CLASS.slate} ${className}`}
  >
    {Icon && <Icon className="shrink-0 text-xs" />}
    <span className="truncate">{children}</span>
  </span>
);

export const StatusBadge = ({ status }) => {
  const meta = STATUS_META[status] || STATUS_META.UNKNOWN;
  return <Badge tone={meta.tone} icon={meta.icon}>{meta.label}</Badge>;
};

export const UrgencyBadge = ({ level, reason }) => {
  const meta = URGENCY_META[level] || URGENCY_META.NORMAL;
  return <Badge tone={meta.tone} icon={FiZap} title={reason || meta.label}>{meta.label}</Badge>;
};

export const SettlementBadge = ({ status }) => {
  const meta = SETTLEMENT_META[status] || SETTLEMENT_META.UNKNOWN;
  return <Badge tone={meta.tone}>{meta.label}</Badge>;
};

export const ScoreBadge = ({ value }) => {
  const tone = getScoreTone(value);
  return <Badge tone={tone} className="px-3">{formatScore(value)}</Badge>;
};

export const DeadlineBadge = ({ item }) => {
  const status = getDeadlineStatus(item);
  const meta = DEADLINE_META[status] || DEADLINE_META.NONE;
  const date = getDeadlineDate(item);
  const basis = getDeadlineBasis(item);
  const label = calcDdayLabel(date, getDeadlineLabel(item) || meta.label).replace(/D([+-])\s+/g, 'D$1');

  return (
    <Badge tone={meta.tone} icon={FiClock} title={`마감일 · ${formatDate(date)} · ${basis}`}>
      {label}
    </Badge>
  );
};

export const buildIssueChips = (reason, max = 4) => {
  const text = formatValue(reason);
  if (text === '-') return [];

  const lower = text.toLowerCase();
  const chips = ISSUE_KEYWORDS.filter((item) => (
    item.keys.some((key) => lower.includes(String(key).toLowerCase()))
  ));

  if (chips.length === 0) chips.push({ label: '확인 필요', tone: 'slate' });
  return chips.slice(0, max);
};

export const IssueChips = ({ reason, max = 4 }) => {
  const chips = buildIssueChips(reason, max);
  const text = formatValue(reason);

  if (text === '-') return <span className="text-xs font-bold text-slate-400">-</span>;

  return (
    <div title={text} className="flex min-w-0 max-w-full flex-wrap items-center gap-1.5">
      {chips.map((chip) => (
        <Badge key={chip.label} tone={chip.tone}>{chip.label}</Badge>
      ))}
    </div>
  );
};

export const DateLine = ({ label, value, mutedValue, danger = false }) => (
  <div className="min-w-0 rounded-2xl bg-slate-50 px-3 py-2 ring-1 ring-slate-100">
    <p className="text-[10px] font-black text-slate-400">{label}</p>
    <p className={`mt-1 truncate text-xs font-black ${danger ? 'text-orange-600' : 'text-slate-800'}`}>
      {formatValue(value)}
    </p>
    {mutedValue && <p className="mt-0.5 truncate text-[10px] font-bold text-slate-400">{mutedValue}</p>}
  </div>
);


export const CountBadge = ({ label, value, tone = 'slate', title }) => (
  <Badge tone={tone} title={title || `${label} ${Number(value || 0)}건`}>
    {label} {Number(value || 0)}
  </Badge>
);
