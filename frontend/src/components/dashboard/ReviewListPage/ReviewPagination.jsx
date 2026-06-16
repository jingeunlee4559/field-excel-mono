import { FiChevronLeft, FiChevronRight } from 'react-icons/fi';

const ReviewPagination = ({ loading, pageInfo, totalPages, onPrevPage, onNextPage }) => {
  if (loading || Number(pageInfo.total || 0) <= 0) return null;

  return (
    <div className="mt-5 flex flex-col gap-3 border-t border-slate-100 pt-4 sm:flex-row sm:items-center sm:justify-between">
      <p className="text-xs font-extrabold text-slate-500">
        총 {pageInfo.total}건 · {pageInfo.page} / {totalPages} 페이지
      </p>
      <div className="grid grid-cols-[1fr_auto_1fr] gap-2 sm:flex">
        <button
          type="button"
          onClick={onPrevPage}
          disabled={pageInfo.page <= 1}
          className="inline-flex h-10 items-center justify-center gap-1 rounded-2xl border border-slate-200 px-4 text-xs font-extrabold text-slate-600 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
        >
          <FiChevronLeft />이전
        </button>
        <span className="inline-flex h-10 min-w-10 items-center justify-center rounded-2xl bg-blue-600 px-3 text-xs font-extrabold text-white">
          {pageInfo.page}
        </span>
        <button
          type="button"
          onClick={onNextPage}
          disabled={pageInfo.page >= totalPages}
          className="inline-flex h-10 items-center justify-center gap-1 rounded-2xl border border-slate-200 px-4 text-xs font-extrabold text-slate-600 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
        >
          다음 <FiChevronRight />
        </button>
      </div>
    </div>
  );
};

export default ReviewPagination;
