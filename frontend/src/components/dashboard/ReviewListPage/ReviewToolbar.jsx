import { FiCalendar, FiGrid, FiLayers, FiSearch } from 'react-icons/fi';
import {
  DATE_PRESET_OPTIONS,
  DATE_TYPE_OPTIONS,
  DEADLINE_OPTIONS,
  SCORE_OPTIONS,
  SETTLEMENT_OPTIONS,
  SORT_BY_OPTIONS,
  SORT_ORDER_OPTIONS,
  STATUS_OPTIONS,
  URGENCY_OPTIONS,
  getOptionLabel,
} from './reviewList.constants.js';

const FilterSelect = ({ value, onChange, options, ariaLabel }) => (
  <select
    value={value}
    onChange={(event) => onChange(event.target.value)}
    aria-label={ariaLabel}
    className="h-11 min-w-0 rounded-2xl border border-slate-200 bg-white px-3 text-sm font-extrabold text-slate-700 outline-none transition focus:border-blue-400 focus:ring-4 focus:ring-blue-50"
  >
    {options.map((option) => (
      <option key={option.value || 'ALL'} value={option.value}>{option.label}</option>
    ))}
  </select>
);

const DateRangePanel = ({ dateType, dateFrom, onDateFromChange, dateTo, onDateToChange }) => {
  const basisLabel = getOptionLabel(DATE_TYPE_OPTIONS, dateType, '날짜');

  return (
    <div className="rounded-3xl border border-blue-100 bg-gradient-to-br from-blue-50 via-white to-slate-50 p-3 shadow-sm">
      <div className="grid grid-cols-1 gap-3 lg:grid-cols-[minmax(150px,0.8fr)_minmax(180px,1fr)_minmax(180px,1fr)] lg:items-end">
        <div className="rounded-2xl bg-white/80 px-3 py-3 ring-1 ring-blue-100">
          <p className="text-xs font-black text-blue-700">직접 선택 기간</p>
          <p className="mt-1 text-[11px] font-bold leading-5 text-slate-500">{basisLabel} 기준으로 조회합니다.</p>
        </div>
        <label className="min-w-0">
          <span className="mb-1.5 flex items-center gap-1.5 text-[11px] font-black text-slate-500"><FiCalendar className="text-blue-500" /> 시작일</span>
          <input
            type="date"
            value={dateFrom}
            onChange={(event) => onDateFromChange(event.target.value)}
            className="h-11 w-full rounded-2xl border border-slate-200 bg-white px-3 text-sm font-extrabold text-slate-800 outline-none transition focus:border-blue-400 focus:ring-4 focus:ring-blue-50"
          />
        </label>
        <label className="min-w-0">
          <span className="mb-1.5 flex items-center gap-1.5 text-[11px] font-black text-slate-500"><FiCalendar className="text-blue-500" /> 종료일</span>
          <input
            type="date"
            value={dateTo}
            onChange={(event) => onDateToChange(event.target.value)}
            className="h-11 w-full rounded-2xl border border-slate-200 bg-white px-3 text-sm font-extrabold text-slate-800 outline-none transition focus:border-blue-400 focus:ring-4 focus:ring-blue-50"
          />
        </label>
      </div>
    </div>
  );
};

const ViewTabs = ({ viewMode, onViewChange }) => (
  <div className="grid w-full grid-cols-2 rounded-2xl bg-slate-100 p-1 sm:w-[310px]">
    <button
      type="button"
      onClick={() => onViewChange('batch')}
      className={`inline-flex h-10 min-w-0 items-center justify-center gap-2 rounded-xl px-3 text-sm font-black transition ${viewMode === 'batch' ? 'bg-white text-slate-950 shadow-sm ring-1 ring-slate-200' : 'text-slate-500 hover:text-slate-900'}`}
    >
      <FiLayers className="shrink-0" />
      <span className="truncate">묶음별 보기</span>
    </button>
    <button
      type="button"
      onClick={() => onViewChange('file')}
      className={`inline-flex h-10 min-w-0 items-center justify-center gap-2 rounded-xl px-3 text-sm font-black transition ${viewMode === 'file' ? 'bg-white text-slate-950 shadow-sm ring-1 ring-slate-200' : 'text-slate-500 hover:text-slate-900'}`}
    >
      <FiGrid className="shrink-0" />
      <span className="truncate">파일별 보기</span>
    </button>
  </div>
);

const ReviewToolbar = ({
  viewMode,
  onViewChange,
  keyword,
  onKeywordChange,
  status,
  onStatusChange,
  urgency,
  onUrgencyChange,
  deadlineStatus,
  onDeadlineStatusChange,
  scoreBucket,
  onScoreBucketChange,
  settlementStatus,
  onSettlementStatusChange,
  dateType,
  onDateTypeChange,
  datePreset,
  onDatePresetChange,
  dateFrom,
  onDateFromChange,
  dateTo,
  onDateToChange,
  sortBy,
  onSortByChange,
  sortOrder,
  onSortOrderChange,
  onSearch,
}) => (
  <div className="space-y-4">
    <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
      <ViewTabs viewMode={viewMode} onViewChange={onViewChange} />
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-5 xl:min-w-[900px] xl:grid-cols-[150px_160px_160px_170px_140px]">
        <FilterSelect value={dateType} onChange={onDateTypeChange} options={DATE_TYPE_OPTIONS} ariaLabel="날짜 기준" />
        <FilterSelect value={datePreset} onChange={onDatePresetChange} options={DATE_PRESET_OPTIONS} ariaLabel="기간 필터" />
        <FilterSelect value={settlementStatus} onChange={onSettlementStatusChange} options={SETTLEMENT_OPTIONS} ariaLabel="결제 상태" />
        <FilterSelect value={sortBy} onChange={onSortByChange} options={SORT_BY_OPTIONS} ariaLabel="정렬 기준" />
        <FilterSelect value={sortOrder} onChange={onSortOrderChange} options={SORT_ORDER_OPTIONS} ariaLabel="정렬 방향" />
      </div>
    </div>

    {datePreset === 'CUSTOM' && (
      <DateRangePanel
        dateType={dateType}
        dateFrom={dateFrom}
        onDateFromChange={onDateFromChange}
        dateTo={dateTo}
        onDateToChange={onDateToChange}
      />
    )}

    <form onSubmit={onSearch} className="grid w-full grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-4 2xl:grid-cols-[minmax(320px,1.5fr)_150px_150px_150px_150px_92px]">
      <div className="relative min-w-0 sm:col-span-2 lg:col-span-4 2xl:col-span-1">
        <FiSearch className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
        <input
          value={keyword}
          onChange={(event) => onKeywordChange(event.target.value)}
          placeholder="파일명, 업로드자, 부서, 현장 검색"
          className="h-11 w-full rounded-2xl border border-slate-200 bg-white pl-11 pr-4 text-sm font-bold text-slate-700 outline-none transition placeholder:text-slate-400 focus:border-blue-400 focus:ring-4 focus:ring-blue-50"
        />
      </div>
      <FilterSelect value={status} onChange={onStatusChange} options={STATUS_OPTIONS} ariaLabel="상태 필터" />
      <FilterSelect value={urgency} onChange={onUrgencyChange} options={URGENCY_OPTIONS} ariaLabel="긴급도 필터" />
      <FilterSelect value={deadlineStatus} onChange={onDeadlineStatusChange} options={DEADLINE_OPTIONS} ariaLabel="마감 필터" />
      <FilterSelect value={scoreBucket} onChange={onScoreBucketChange} options={SCORE_OPTIONS} ariaLabel="점수 필터" />
      <button type="submit" className="inline-flex h-11 items-center justify-center rounded-2xl bg-slate-950 px-4 text-sm font-black text-white transition hover:bg-blue-600 sm:col-span-2 lg:col-span-4 2xl:col-span-1">
        검색
      </button>
    </form>
  </div>
);

export default ReviewToolbar;
