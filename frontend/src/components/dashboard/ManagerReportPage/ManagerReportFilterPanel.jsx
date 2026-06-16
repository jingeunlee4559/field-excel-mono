import { FiFilter, FiSearch } from 'react-icons/fi';
import {
  DateInput,
  Select,
  dateBasisOptions,
  documentTypeOptions,
} from './managerReportPage.parts.jsx';

const GROUP_BY_OPTIONS = [
  { value: 'department', label: '부서 기준' },
  { value: 'site', label: '현장 기준' },
];

const ManagerReportFilterPanel = ({
  filters,
  loading,
  departmentOptions,
  siteOptions,
  onChange,
  onSubmit,
  onReset,
}) => (
  <section className="rounded-3xl bg-white p-5 shadow-sm ring-1 ring-slate-200 sm:p-6">
    <div className="mb-5 flex items-center gap-2 text-slate-950">
      <FiFilter />
      <h3 className="font-extrabold">조회 조건</h3>
    </div>

    <form onSubmit={onSubmit}>
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-8">
        <Select label="보기 기준" value={filters.groupBy} onChange={(value) => onChange('groupBy', value)} options={GROUP_BY_OPTIONS} />
        <Select label="날짜 기준" value={filters.dateBasis} onChange={(value) => onChange('dateBasis', value)} options={dateBasisOptions} />
        <Select label="부서" value={filters.departmentId} onChange={(value) => onChange('departmentId', value)} options={departmentOptions} />
        <Select label="현장" value={filters.siteId} onChange={(value) => onChange('siteId', value)} options={siteOptions} />
        <Select label="자료유형" value={filters.documentType} onChange={(value) => onChange('documentType', value)} options={documentTypeOptions} />

        <label className="block">
          <span className="text-xs font-extrabold text-slate-500">검색어</span>
          <div className="relative mt-2">
            <FiSearch className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              value={filters.keyword}
              onChange={(event) => onChange('keyword', event.target.value)}
              placeholder="물품, 사용처, 사용자 검색"
              className="h-11 w-full rounded-2xl border border-slate-200 px-3 pl-9 text-sm font-bold text-slate-800 outline-none focus:border-blue-400 focus:ring-4 focus:ring-blue-50"
            />
          </div>
        </label>

        <DateInput label="시작일" value={filters.startDate} onChange={(value) => onChange('startDate', value)} />
        <DateInput label="종료일" value={filters.endDate} onChange={(value) => onChange('endDate', value)} />
      </div>

      <div className="mt-5 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-xs font-bold text-slate-400">
          이 화면은 확정 완료된 자료만 조회합니다. 검토 필요, 보완 필요, 실패 자료는 자료 검토 현황에서 먼저 처리하세요.
          {loading ? ' 현재 조회 중입니다.' : ''}
        </p>

        <button
          type="button"
          onClick={onReset}
          disabled={loading}
          className="inline-flex h-11 items-center justify-center rounded-2xl border border-slate-200 px-5 text-sm font-extrabold text-slate-600 hover:bg-slate-50 disabled:opacity-50"
        >
          초기화
        </button>
      </div>
    </form>
  </section>
);

export default ManagerReportFilterPanel;
