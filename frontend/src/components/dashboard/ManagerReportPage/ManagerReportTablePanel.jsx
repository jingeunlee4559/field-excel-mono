import { FiDownload, FiMapPin, FiShoppingBag, FiUser, FiUsers } from 'react-icons/fi';
import {
  EmptyState,
  FilterChip,
  MobileItemCard,
  StatusBadge,
  documentTypeOptions,
  formatDate,
  getDateBasisLabel,
  getItemKey,
  getOptionLabel,
  getTemplateName,
} from './managerReportPage.parts.jsx';

const SkeletonRows = () => (
  <div className="space-y-3">
    {Array.from({ length: 5 }).map((_, index) => (
      <div key={index} className="h-14 animate-pulse rounded-2xl bg-slate-100" />
    ))}
  </div>
);

const ManagerReportDesktopTable = ({
  items,
  selectedKeySet,
  allVisibleSelected,
  someVisibleSelected,
  onToggleAllVisible,
  onToggleItem,
  formatMoney,
}) => (
  <div className="hidden overflow-x-auto lg:block">
    <table className="w-full min-w-[1520px] text-left text-sm">
      <thead>
        <tr className="border-b border-slate-100 bg-slate-50/80 text-xs font-extrabold text-slate-500">
          <th className="w-12 px-4 py-4">
            <input
              type="checkbox"
              checked={allVisibleSelected}
              ref={(input) => {
                if (input) input.indeterminate = someVisibleSelected && !allVisibleSelected;
              }}
              onChange={onToggleAllVisible}
              className="h-5 w-5 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
              aria-label="현재 목록 전체 선택"
            />
          </th>
          <th className="px-4 py-4">사용일자</th>
          <th className="px-4 py-4">업로드일자</th>
          <th className="px-4 py-4">부서</th>
          <th className="px-4 py-4">현장</th>
          <th className="px-4 py-4">업로드한 사람</th>
          <th className="px-4 py-4">사용 템플릿</th>
          <th className="px-4 py-4">자료유형</th>
          <th className="px-4 py-4">사용처</th>
          <th className="px-4 py-4">구매항목</th>
          <th className="px-4 py-4">결제수단</th>
          <th className="px-4 py-4">상태</th>
          <th className="px-4 py-4 text-right">금액</th>
        </tr>
      </thead>

      <tbody>
        {items.map((item, index) => {
          const itemKey = getItemKey(item, index);
          const checked = selectedKeySet.has(itemKey);

          return (
            <tr key={itemKey} className={`border-b border-slate-50 transition hover:bg-slate-50/70 ${checked ? 'bg-blue-50/40' : ''}`}>
              <td className="px-4 py-4">
                <input
                  type="checkbox"
                  checked={checked}
                  onChange={() => onToggleItem(itemKey)}
                  className="h-5 w-5 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                  aria-label="구매 내역 선택"
                />
              </td>
              <td className="px-4 py-4 font-bold text-slate-600">{formatDate(item.receiptDate || item.periodLabel)}</td>
              <td className="px-4 py-4 font-bold text-slate-500">{formatDate(item.uploadedDate)}</td>
              <td className="px-4 py-4 font-extrabold text-slate-950">{item.departmentName || '-'}</td>
              <td className="px-4 py-4 font-bold text-slate-700">{item.siteName || '-'}</td>
              <td className="px-4 py-4">
                <div className="inline-flex items-center gap-2">
                  <span className="flex h-8 w-8 items-center justify-center rounded-full bg-slate-100 text-slate-500"><FiUser /></span>
                  <span className="font-extrabold text-slate-700">{item.submitterName || '-'}</span>
                </div>
              </td>
              <td className="max-w-[220px] truncate px-4 py-4 font-bold text-slate-700">{getTemplateName(item)}</td>
              <td className="px-4 py-4 font-bold text-slate-700">{item.documentTypeName || '-'}</td>
              <td className="px-4 py-4 font-bold text-slate-700">{item.vendorName || '-'}</td>
              <td className="max-w-[320px] truncate px-4 py-4 font-extrabold text-slate-950">{item.itemName || '미분류'}</td>
              <td className="px-4 py-4 font-bold text-slate-700">{item.paymentMethod || '-'}</td>
              <td className="px-4 py-4"><StatusBadge status={item.status} /></td>
              <td className="px-4 py-4 text-right font-black text-blue-700">{formatMoney(item.amount)}</td>
            </tr>
          );
        })}
      </tbody>
    </table>
  </div>
);

const ManagerReportMobileList = ({ items, selectedKeySet, onToggleItem }) => (
  <div className="space-y-3 lg:hidden">
    {items.map((item, index) => {
      const itemKey = getItemKey(item, index);
      return (
        <MobileItemCard
          key={itemKey}
          item={item}
          checked={selectedKeySet.has(itemKey)}
          onToggle={() => onToggleItem(itemKey)}
        />
      );
    })}
  </div>
);

const ManagerReportTablePanel = ({
  appliedFilters,
  departmentOptions,
  siteOptions,
  items,
  loading,
  selectedItems,
  selectedBatchIds,
  selectedTemplateNames,
  selectedKeySet,
  allVisibleSelected,
  someVisibleSelected,
  itemKeyList,
  canDownloadTemplate,
  downloadLoading,
  onToggleAllVisible,
  onToggleItem,
  onClearSelection,
  onDownloadSelected,
  formatMoney,
  formatNumber,
}) => (
  <section className="rounded-3xl bg-white p-5 shadow-sm ring-1 ring-slate-200 sm:p-6">
    <div className="mb-5 flex flex-col gap-3 xl:flex-row xl:items-start xl:justify-between">
      <div className="flex items-start gap-2">
        {appliedFilters.groupBy === 'site' ? <FiMapPin className="mt-1" /> : <FiUsers className="mt-1" />}
        <div>
          <h3 className="font-extrabold text-slate-950">
            {appliedFilters.groupBy === 'site' ? '현장별 구매 내역' : '부서별 구매 내역'}
          </h3>
          <p className="mt-1 text-xs font-bold text-slate-400">
            확정 완료된 구매 내역 {formatNumber(items.length)}건
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            <FilterChip label="부서" value={getOptionLabel(departmentOptions, appliedFilters.departmentId)} />
            <FilterChip label="현장" value={getOptionLabel(siteOptions, appliedFilters.siteId)} />
            <FilterChip label="자료" value={getOptionLabel(documentTypeOptions, appliedFilters.documentType)} />
            <FilterChip label="날짜" value={getDateBasisLabel(appliedFilters.dateBasis)} />
            <FilterChip label="기간" value={`${appliedFilters.startDate} ~ ${appliedFilters.endDate}`} />
          </div>
        </div>
      </div>

      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        <div className="inline-flex items-center gap-2 rounded-full bg-blue-50 px-3 py-1 text-xs font-extrabold text-blue-600 ring-1 ring-blue-100">
          <FiShoppingBag />
          확정 자료만 다운로드 가능
        </div>
        <div className="inline-flex items-center gap-2 rounded-full bg-slate-50 px-3 py-1 text-xs font-extrabold text-slate-600 ring-1 ring-slate-200">
          선택 {formatNumber(selectedItems.length)}건
        </div>
        <button type="button" onClick={onToggleAllVisible} disabled={itemKeyList.length === 0 || loading} className="inline-flex h-9 items-center justify-center rounded-full border border-slate-200 px-4 text-xs font-extrabold text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40">
          {allVisibleSelected ? '전체 해제' : '전체 선택'}
        </button>
        <button type="button" onClick={onClearSelection} disabled={selectedItems.length === 0 || loading} className="inline-flex h-9 items-center justify-center rounded-full border border-slate-200 px-4 text-xs font-extrabold text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40">
          선택 해제
        </button>
        <button type="button" onClick={onDownloadSelected} disabled={!canDownloadTemplate || loading || downloadLoading} className="inline-flex h-9 items-center justify-center gap-2 rounded-full bg-slate-950 px-4 text-xs font-extrabold text-white transition hover:bg-blue-600 disabled:cursor-not-allowed disabled:bg-slate-200 disabled:text-slate-400">
          <FiDownload />
          {downloadLoading ? '다운로드 중' : `선택 ${formatNumber(selectedItems.length)}건 템플릿 다운로드`}
        </button>
      </div>
    </div>

    {selectedItems.length > 0 && (
      <div className="mb-4 rounded-2xl bg-blue-50 px-4 py-3 text-sm font-bold text-blue-700 ring-1 ring-blue-100">
        선택된 행 {formatNumber(selectedItems.length)}건을 하나로 합쳐서 다운로드합니다.
        {selectedTemplateNames.length > 0 ? ` 사용 템플릿: ${selectedTemplateNames.join(', ')}` : ''}
      </div>
    )}

    {selectedItems.length > 0 && (selectedBatchIds.length > 1 || selectedTemplateNames.length > 1) && (
      <div className="mb-4 rounded-2xl bg-amber-50 px-4 py-3 text-sm font-bold text-amber-700 ring-1 ring-amber-100">
        서로 다른 업로드 배치 또는 템플릿이 섞여 있습니다. 일단 선택한 행 전체를 하나로 합쳐서 다운로드 요청합니다.
      </div>
    )}

    {loading ? (
      <SkeletonRows />
    ) : items.length === 0 ? (
      <EmptyState />
    ) : (
      <>
        <ManagerReportDesktopTable
          items={items}
          selectedKeySet={selectedKeySet}
          allVisibleSelected={allVisibleSelected}
          someVisibleSelected={someVisibleSelected}
          onToggleAllVisible={onToggleAllVisible}
          onToggleItem={onToggleItem}
          formatMoney={formatMoney}
        />
        <ManagerReportMobileList items={items} selectedKeySet={selectedKeySet} onToggleItem={onToggleItem} />
      </>
    )}
  </section>
);

export default ManagerReportTablePanel;
