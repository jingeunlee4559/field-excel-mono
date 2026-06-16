import BatchCountPill from './BatchCountPill';

const BatchCountSummary = ({ batchSummary }) => (
  <section className="grid min-w-0 gap-3 sm:grid-cols-2 xl:grid-cols-7">
    <BatchCountPill label="전체" value={batchSummary.total} className="bg-slate-50 text-slate-700 ring-1 ring-slate-200" />
    <BatchCountPill label="확정완료" value={batchSummary.confirmed} className="bg-blue-50 text-blue-700 ring-1 ring-blue-100" />
    <BatchCountPill label="확정가능" value={batchSummary.confirmable} className="bg-emerald-50 text-emerald-700 ring-1 ring-emerald-100" />
    <BatchCountPill label="검토필요" value={batchSummary.needReview} className="bg-amber-50 text-amber-700 ring-1 ring-amber-100" />
    <BatchCountPill label="보완필요" value={batchSummary.needSupplement} className="bg-rose-50 text-rose-700 ring-1 ring-rose-100" />
    <BatchCountPill label="처리실패" value={batchSummary.failed} className="bg-red-50 text-red-700 ring-1 ring-red-100" />
    <BatchCountPill label="AI 처리중" value={batchSummary.processing} className="bg-indigo-50 text-indigo-700 ring-1 ring-indigo-100" />
  </section>
);

export default BatchCountSummary;
