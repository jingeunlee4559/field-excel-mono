import { FiArrowLeft, FiDownload, FiRefreshCw } from 'react-icons/fi';

const BatchReviewHeader = ({
  batch,
  batchSummary,
  batchCompletionMessage,
  loading,
  saving,
  onBack,
  onReload,
  onCompleteBatch,
  formatValue,
  formatScore,
}) => (
  <section className="overflow-hidden rounded-[1.5rem] bg-slate-950 text-white shadow-sm sm:rounded-[2rem]">
    <div className="relative p-4 sm:p-6">
      <div className="absolute -right-10 -top-10 h-56 w-56 rounded-full bg-blue-500/25 blur-3xl" />
      <div className="absolute bottom-0 right-40 h-32 w-32 rounded-full bg-emerald-500/10 blur-3xl" />
      <div className="relative grid min-w-0 gap-5 xl:grid-cols-[minmax(0,1fr)_minmax(360px,430px)]">
        <div>
          <button
            type="button"
            onClick={onBack}
            className="mb-4 inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1 text-xs font-bold text-slate-200 ring-1 ring-white/10 hover:bg-white/15"
          >
            <FiArrowLeft />
            자료 검토 현황으로
          </button>

          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded-full bg-white/10 px-3 py-1 text-xs font-black text-blue-100 ring-1 ring-white/10">
              {formatValue(batch?.batchNo)}
            </span>
            <span className="rounded-full bg-white/10 px-3 py-1 text-xs font-black text-slate-200 ring-1 ring-white/10">
              {formatValue(batch?.submitterName)}
            </span>
            <span className="rounded-full bg-white/10 px-3 py-1 text-xs font-black text-slate-200 ring-1 ring-white/10">
              {formatValue(batch?.departmentName)} / {formatValue(batch?.siteName)}
            </span>
          </div>

          <h2 className="mt-4 text-2xl font-black tracking-tight sm:text-3xl">
            배치 검토 및 최종확정
          </h2>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-300">
            원본 이미지와 추출값을 비교해 수정하고, 확정 버튼을 누르면 경비청구서 엑셀까지 바로 생성됩니다.
          </p>

          <div className="mt-5 grid gap-2 sm:grid-cols-4">
            <div className="rounded-2xl bg-white/10 p-4 ring-1 ring-white/10">
              <p className="text-[11px] font-black text-slate-300">전체 파일</p>
              <p className="mt-1 text-2xl font-black">{batchSummary.total}</p>
            </div>
            <div className="rounded-2xl bg-blue-500/15 p-4 ring-1 ring-blue-300/20">
              <p className="text-[11px] font-black text-blue-100">확정 완료</p>
              <p className="mt-1 text-2xl font-black text-blue-100">{batchSummary.confirmed}</p>
            </div>
            <div className="rounded-2xl bg-amber-500/15 p-4 ring-1 ring-amber-300/20">
              <p className="text-[11px] font-black text-amber-100">남은 처리</p>
              <p className="mt-1 text-2xl font-black text-amber-100">{batchSummary.blockingCount}</p>
            </div>
            <div className="rounded-2xl bg-white/10 p-4 ring-1 ring-white/10">
              <p className="text-[11px] font-black text-slate-300">평균점수</p>
              <p className="mt-1 text-2xl font-black">{formatScore(batch?.avgConfidencePercent)}</p>
            </div>
          </div>
        </div>

        <div className="rounded-[1.5rem] bg-white p-4 text-slate-950 shadow-2xl sm:p-5">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-xs font-black text-slate-400">최종완료 진행률</p>
              <p className="mt-1 text-3xl font-black">{batchSummary.progressPercent}%</p>
            </div>
            <div
              className={`rounded-2xl px-3 py-2 text-xs font-black ${
                batchSummary.canCompleteBatch
                  ? 'bg-emerald-50 text-emerald-700 ring-1 ring-emerald-100'
                  : 'bg-amber-50 text-amber-700 ring-1 ring-amber-100'
              }`}
            >
              {batchSummary.canCompleteBatch ? '완료 가능' : '처리 남음'}
            </div>
          </div>

          <div className="mt-4 h-3 overflow-hidden rounded-full bg-slate-100">
            <div className="h-full rounded-full bg-blue-600 transition-all" style={{ width: `${batchSummary.progressPercent}%` }} />
          </div>

          <p className="mt-3 text-xs font-bold leading-5 text-slate-500">{batchCompletionMessage}</p>

          <div className="mt-4 grid grid-cols-3 gap-2 text-center">
            <div className="rounded-2xl bg-emerald-50 p-3">
              <p className="text-[11px] font-black text-emerald-700">확정가능</p>
              <p className="mt-1 text-lg font-black text-emerald-800">{batchSummary.confirmable}</p>
            </div>
            <div className="rounded-2xl bg-rose-50 p-3">
              <p className="text-[11px] font-black text-rose-700">보완</p>
              <p className="mt-1 text-lg font-black text-rose-800">{batchSummary.needSupplement}</p>
            </div>
            <div className="rounded-2xl bg-red-50 p-3">
              <p className="text-[11px] font-black text-red-700">실패</p>
              <p className="mt-1 text-lg font-black text-red-800">{batchSummary.failed}</p>
            </div>
          </div>

          <div className="mt-4 grid gap-2 sm:grid-cols-2">
            <button
              type="button"
              onClick={onReload}
              disabled={loading || saving}
              className="inline-flex h-11 items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 text-sm font-extrabold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
            >
              <FiRefreshCw className={loading ? 'animate-spin' : ''} />
              새로고침
            </button>
            <button
              type="button"
              onClick={onCompleteBatch}
              disabled={saving || !batchSummary.canCompleteBatch}
              className="inline-flex h-11 items-center justify-center gap-2 rounded-2xl bg-slate-950 px-4 text-sm font-extrabold text-white hover:bg-blue-600 disabled:cursor-not-allowed disabled:bg-slate-300 disabled:text-slate-500"
            >
              <FiDownload />
              배치 완료·엑셀생성
            </button>
          </div>
        </div>
      </div>
    </div>
  </section>
);

export default BatchReviewHeader;
