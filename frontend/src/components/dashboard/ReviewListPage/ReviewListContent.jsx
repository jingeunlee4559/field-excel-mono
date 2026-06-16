import { FiAlertCircle, FiChevronRight } from 'react-icons/fi';
import {
  formatScore,
  getItemId,
  getReason,
  getSortDisplayLabel,
} from './reviewList.constants.js';
import { IssueChips } from './ReviewBadges.jsx';
import {
  BatchCountBlock,
  BatchPriorityBlock,
  BatchTitle,
  FileStatusBlock,
  FileTitle,
  OwnerBlock,
  ScheduleBlock,
  ScoreBlock,
} from './ReviewItemBlocks.jsx';

export const EmptyState = () => (
  <div className="flex min-h-[240px] flex-col items-center justify-center rounded-3xl bg-white p-8 text-center ring-1 ring-slate-200">
    <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-slate-100 text-slate-400">
      <FiAlertCircle className="text-2xl" />
    </div>
    <p className="mt-4 text-sm font-extrabold text-slate-700">표시할 항목이 없습니다.</p>
    <p className="mt-1 text-xs font-bold text-slate-400">검색어 또는 필터를 변경해 주세요.</p>
  </div>
);

export const SectionHeader = ({ viewMode, total, avgScore, sortBy, sortOrder }) => (
  <div className="mb-4 flex flex-col gap-1">
    <h3 className="text-base font-black text-slate-950">
      {viewMode === 'batch' ? '자료 묶음 목록' : '파일별 자료 목록'}
    </h3>
    <p className="text-xs font-bold text-slate-400">
      총 {Number(total || 0)}건 · 평균 신뢰도 {formatScore(avgScore)} · {getSortDisplayLabel(sortBy, sortOrder)}
    </p>
  </div>
);

export const BatchDesktopRow = ({ item, onOpen }) => (
  <div className="grid items-center gap-4 border-b border-slate-100 px-4 py-4 transition last:border-b-0 hover:bg-slate-50/80 xl:grid-cols-[minmax(220px,1.05fr)_minmax(320px,1.25fr)_minmax(170px,0.78fr)_minmax(290px,1.18fr)_minmax(190px,0.78fr)_92px]">
    <BatchTitle item={item} onOpen={onOpen} />
    <ScheduleBlock item={item} type="batch" />
    <OwnerBlock name={item.submitterName} department={item.departmentName} site={item.siteName} />
    <BatchCountBlock item={item} />
    <BatchPriorityBlock score={item.avgConfidencePercent} urgencyLevel={item.urgencyLevel} urgencyReason={item.urgencyReason} />
    <div className="text-right">
      <button type="button" onClick={() => onOpen(item.batchId)} className="inline-flex h-10 items-center justify-center gap-1 rounded-2xl bg-slate-950 px-4 text-xs font-black text-white transition hover:bg-blue-600">
        검토 <FiChevronRight />
      </button>
    </div>
  </div>
);

export const FileDesktopRow = ({ item }) => (
  <div className="grid items-center gap-4 border-b border-slate-100 px-4 py-4 transition last:border-b-0 hover:bg-slate-50/80 xl:grid-cols-[minmax(240px,1.18fr)_minmax(340px,1.42fr)_minmax(190px,0.82fr)_minmax(150px,0.62fr)_minmax(270px,1.15fr)]">
    <FileTitle item={item} />
    <ScheduleBlock item={item} type="file" />
    <FileStatusBlock item={item} />
    <ScoreBlock score={item.confidenceScore} />
    <IssueChips reason={getReason(item)} max={5} />
  </div>
);

export const DesktopList = ({ viewMode, items, loading, onOpen }) => (
  <div className="hidden overflow-visible rounded-3xl border border-slate-200 bg-white xl:block">
    <div className="bg-slate-50 px-4 py-3 text-xs font-black text-slate-500">
      {viewMode === 'batch' ? (
        <div className="grid gap-4 xl:grid-cols-[minmax(220px,1.05fr)_minmax(320px,1.25fr)_minmax(170px,0.78fr)_minmax(290px,1.18fr)_minmax(190px,0.78fr)_92px]">
          <span>자료</span><span>일정</span><span>제출 / 현장</span><span>파일 현황</span><span>우선순위</span><span className="text-right">작업</span>
        </div>
      ) : (
        <div className="grid gap-4 xl:grid-cols-[minmax(240px,1.18fr)_minmax(340px,1.42fr)_minmax(190px,0.82fr)_minmax(150px,0.62fr)_minmax(270px,1.15fr)]">
          <span>파일 정보</span><span>일정</span><span>처리/결제</span><span>신뢰도</span><span>주요 사유</span>
        </div>
      )}
    </div>
    {loading ? (
      <div className="px-4 py-14 text-center text-sm font-bold text-slate-400">불러오는 중...</div>
    ) : items.length === 0 ? (
      <div className="p-4"><EmptyState /></div>
    ) : viewMode === 'batch' ? (
      items.map((item) => <BatchDesktopRow key={item.batchId} item={item} onOpen={onOpen} />)
    ) : (
      items.map((item) => <FileDesktopRow key={getItemId(item)} item={item} />)
    )}
  </div>
);

export const BatchMobileCard = ({ item, onOpen }) => (
  <article className="rounded-3xl bg-white p-4 shadow-sm ring-1 ring-slate-200 xl:hidden">
    <div className="flex items-start justify-between gap-3">
      <BatchTitle item={item} onOpen={onOpen} />
      <button type="button" onClick={() => onOpen(item.batchId)} className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-slate-950 text-white"><FiChevronRight /></button>
    </div>
    <div className="mt-4"><BatchPriorityBlock score={item.avgConfidencePercent} urgencyLevel={item.urgencyLevel} urgencyReason={item.urgencyReason} /></div>
    <div className="mt-4"><ScheduleBlock item={item} type="batch" /></div>
    <div className="mt-4 grid gap-3 sm:grid-cols-2">
      <OwnerBlock name={item.submitterName} department={item.departmentName} site={item.siteName} />
      <div className="rounded-2xl bg-slate-50 p-3 ring-1 ring-slate-100"><p className="mb-2 text-xs font-black text-slate-400">파일 현황</p><BatchCountBlock item={item} /></div>
    </div>
  </article>
);

export const FileMobileCard = ({ item }) => (
  <article className="rounded-3xl bg-white p-4 shadow-sm ring-1 ring-slate-200 xl:hidden">
    <FileTitle item={item} />
    <div className="mt-3 grid gap-2 sm:grid-cols-2"><FileStatusBlock item={item} /><ScoreBlock score={item.confidenceScore} /></div>
    <div className="mt-4"><ScheduleBlock item={item} type="file" /></div>
    <div className="mt-4 rounded-2xl bg-slate-50 p-3 ring-1 ring-slate-100">
      <p className="mb-2 text-xs font-black text-slate-400">주요 사유</p>
      <IssueChips reason={getReason(item)} max={4} />
    </div>
  </article>
);

export const MobileList = ({ viewMode, items, loading, onOpen }) => (
  <div className="space-y-3 xl:hidden">
    {loading ? (
      Array.from({ length: 4 }).map((_, index) => <div key={index} className="h-56 animate-pulse rounded-3xl bg-slate-100" />)
    ) : items.length === 0 ? (
      <EmptyState />
    ) : viewMode === 'batch' ? (
      items.map((item) => <BatchMobileCard key={item.batchId} item={item} onOpen={onOpen} />)
    ) : (
      items.map((item) => <FileMobileCard key={getItemId(item)} item={item} />)
    )}
  </div>
);
