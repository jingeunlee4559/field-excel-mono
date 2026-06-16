import React, { useEffect, useMemo, useRef, useState } from "react";
import { FiBarChart2, FiRefreshCw } from "react-icons/fi";

import { excelApi, referenceApi, reportApi } from "../../api";
import { alertError, alertWarning } from "../../utils/swal";
import DashboardPageHeader from '../../components/dashboard/common/DashboardPageHeader';
import ManagerSummaryCards from '../../components/dashboard/ManagerReportPage/ManagerSummaryCards';
import ManagerReportFilterPanel from '../../components/dashboard/ManagerReportPage/ManagerReportFilterPanel';
import ManagerReportTablePanel from '../../components/dashboard/ManagerReportPage/ManagerReportTablePanel';
import {
  emptySummary,
  formatMoney,
  formatNumber,
  getTemplateName,
  defaultFilters,
  cleanParams,
  unwrapItems,
  normalizeText,
  isSystemDepartment,
  getItemKey,
} from '../../components/dashboard/ManagerReportPage/managerReportPage.parts.jsx';

const ManagerReportPage = () => {
  const [loading, setLoading] = useState(false);
  const [summary, setSummary] = useState(emptySummary);
  const [items, setItems] = useState([]);

  const [departments, setDepartments] = useState([]);
  const [sites, setSites] = useState([]);

  const [filters, setFilters] = useState(defaultFilters);
  const [appliedFilters, setAppliedFilters] = useState(defaultFilters);
  const [selectedKeys, setSelectedKeys] = useState([]);
  const [downloadLoading, setDownloadLoading] = useState(false);

  const requestSeqRef = useRef(0);

  const confirmedFileCount = Number(summary?.confirmedCount || summary?.fileCount || 0);
  const excludedFileCount = Number(summary?.excludedFileCount || 0);
  const reviewExcludedCount = Number(summary?.reviewExcludedCount || 0);
  const failedExcludedCount = Number(summary?.failedExcludedCount || 0);

  const departmentOptions = useMemo(() => {
    return [
      { value: "", label: "전체" },
      ...departments
        .filter((department) => !isSystemDepartment(department))
        .map((department) => ({
          value: String(department.id),
          label:
            department.departmentName ||
            department.department_name ||
            department.name ||
            `부서 ${department.id}`,
        })),
    ];
  }, [departments]);

  const siteOptions = useMemo(() => {
    return [
      { value: "", label: "전체" },
      ...sites.map((site) => ({
        value: String(site.id),
        label: site.siteName || site.site_name || site.name || `현장 ${site.id}`,
      })),
    ];
  }, [sites]);

  const itemKeyList = useMemo(() => {
    return items.map((item, index) => getItemKey(item, index));
  }, [items]);

  const selectedKeySet = useMemo(() => {
    return new Set(selectedKeys);
  }, [selectedKeys]);

  const selectedItems = useMemo(() => {
    return items.filter((item, index) =>
      selectedKeySet.has(getItemKey(item, index))
    );
  }, [items, selectedKeySet]);

  const selectedBatchIds = useMemo(() => {
    return [
      ...new Set(
        selectedItems
          .map((item) => Number(item.batchId))
          .filter((value) => Number.isInteger(value) && value > 0)
      ),
    ];
  }, [selectedItems]);

  const selectedTemplateNames = useMemo(() => {
    return [
      ...new Set(
        selectedItems
          .map((item) => getTemplateName(item))
          .filter((value) => value && value !== "-")
      ),
    ];
  }, [selectedItems]);

  const canDownloadTemplate = selectedItems.length > 0;

  const allVisibleSelected =
    itemKeyList.length > 0 && itemKeyList.every((key) => selectedKeySet.has(key));

  const someVisibleSelected =
    itemKeyList.length > 0 && itemKeyList.some((key) => selectedKeySet.has(key));

  const toggleItem = (key) => {
    setSelectedKeys((prev) => {
      if (prev.includes(key)) {
        return prev.filter((itemKey) => itemKey !== key);
      }

      return [...prev, key];
    });
  };

  const toggleAllVisible = () => {
    setSelectedKeys((prev) => {
      if (allVisibleSelected) {
        return prev.filter((key) => !itemKeyList.includes(key));
      }

      return Array.from(new Set([...prev, ...itemKeyList]));
    });
  };

  const handleClearSelection = () => {
    setSelectedKeys([]);
  };

  const handleDownloadSelected = async () => {
    if (selectedItems.length === 0) {
      await alertWarning("선택 필요", "템플릿으로 다운로드할 구매 내역을 체크해주세요.");
      return;
    }

    const sourceFileIds = selectedItems
      .map((item) => Number(item.sourceFileId || item.source_file_id || item.fileId))
      .filter((value) => Number.isInteger(value) && value > 0);

    if (sourceFileIds.length === 0) {
      await alertError(
        "템플릿 다운로드 불가",
        "선택한 행에서 sourceFileId를 찾을 수 없습니다."
      );
      return;
    }

    if (selectedBatchIds.length > 1 || selectedTemplateNames.length > 1) {
      await alertWarning(
        "서로 다른 템플릿/배치가 섞여 있습니다",
        "선택한 행을 하나로 합쳐서 다운로드합니다. 단, 백엔드가 여러 템플릿 병합을 지원하지 않으면 다운로드가 실패할 수 있습니다."
      );
    }

    try {
      setDownloadLoading(true);

      // 선택한 행을 전부 합쳐서 한 번에 서버로 보냅니다.
      await excelApi.downloadSelectedTemplateExcel(sourceFileIds);
    } catch (error) {
      console.error("선택 템플릿 엑셀 다운로드 실패:", error);

      await alertError(
        "템플릿 다운로드 실패",
        error.response?.data?.message ||
          error.message ||
          "선택한 행을 업로드 시 선택한 템플릿으로 다운로드하지 못했습니다."
      );
    } finally {
      setDownloadLoading(false);
    }
  };

  const loadReferences = async () => {
    try {
      const [departmentRes, siteRes] = await Promise.all([
        referenceApi.getDepartments(),
        referenceApi.getSites
          ? referenceApi.getSites()
          : Promise.resolve({ items: [] }),
      ]);

      const departmentItems = unwrapItems(departmentRes);
      const siteItems = unwrapItems(siteRes);

      console.log("[ManagerReportPage] departments:", departmentItems);
      console.log("[ManagerReportPage] sites:", siteItems);

      setDepartments(departmentItems);
      setSites(siteItems);
    } catch (error) {
      console.error("기준정보 조회 실패:", error);
    }
  };

  const loadReport = async (targetFilters = filters) => {
    const requestSeq = requestSeqRef.current + 1;
    requestSeqRef.current = requestSeq;

    try {
      setLoading(true);

      const params = cleanParams(targetFilters);

      console.log("[ManagerReportPage] realtime filters:", targetFilters);
      console.log("[ManagerReportPage] report params:", params);

      const [summaryRes, reportRes] = await Promise.all([
        reportApi.getSummary(params),
        reportApi.getManagerReport(params),
      ]);

      if (requestSeq !== requestSeqRef.current) {
        return;
      }

      console.log("[ManagerReportPage] summary response:", summaryRes);
      console.log("[ManagerReportPage] manager response:", reportRes);

      setSummary(summaryRes.summary || emptySummary);
      setItems(reportRes.items || []);
      setAppliedFilters(targetFilters);
    } catch (error) {
      if (requestSeq !== requestSeqRef.current) {
        return;
      }

      console.error("보고서 조회 실패:", error);

      setItems([]);
      setSummary(emptySummary);
      setSelectedKeys([]);

      await alertError(
        "조회 실패",
        error.response?.data?.message ||
          error.message ||
          "보고서를 불러오지 못했습니다."
      );
    } finally {
      if (requestSeq === requestSeqRef.current) {
        setLoading(false);
      }
    }
  };

  useEffect(() => {
    loadReferences();
  }, []);

  useEffect(() => {
    const delayMs = filters.keyword.trim() ? 500 : 250;

    const timerId = window.setTimeout(() => {
      loadReport(filters);
    }, delayMs);

    return () => {
      window.clearTimeout(timerId);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filters]);

  useEffect(() => {
    setSelectedKeys((prev) => prev.filter((key) => itemKeyList.includes(key)));
  }, [itemKeyList]);

  const handleChange = (name, value) => {
    setFilters((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  const handleSubmit = (event) => {
    event.preventDefault();
  };

  const handleReset = () => {
    setSelectedKeys([]);
    setFilters(defaultFilters);
  };

  return (
    <div className="space-y-6 pb-20 lg:pb-0">
      <DashboardPageHeader
        eyebrow="관리팀 통계"
        eyebrowIcon={FiBarChart2}
        title="개인별 / 현장별 구매 내역"
        description="관리팀이 최종확정한 자료만 구매 내역에 반영합니다. 검토·보완·실패 자료는 검토 화면에서 처리하세요."
        actions={(
          <button
            type="button"
            onClick={() => loadReport(filters)}
            disabled={loading}
            className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-2xl bg-white px-4 text-sm font-extrabold text-slate-950 transition hover:bg-blue-50 disabled:bg-slate-400 sm:w-auto"
          >
            <FiRefreshCw className={loading ? 'animate-spin' : ''} />
            새로고침
          </button>
        )}
      />

      <ManagerSummaryCards
        summary={summary}
        confirmedFileCount={confirmedFileCount}
        excludedFileCount={excludedFileCount}
        reviewExcludedCount={reviewExcludedCount}
        failedExcludedCount={failedExcludedCount}
        formatMoney={formatMoney}
        formatNumber={formatNumber}
      />

      <ManagerReportFilterPanel
        filters={filters}
        loading={loading}
        departmentOptions={departmentOptions}
        siteOptions={siteOptions}
        onChange={handleChange}
        onSubmit={handleSubmit}
        onReset={handleReset}
      />

      <ManagerReportTablePanel
        appliedFilters={appliedFilters}
        departmentOptions={departmentOptions}
        siteOptions={siteOptions}
        items={items}
        loading={loading}
        selectedItems={selectedItems}
        selectedBatchIds={selectedBatchIds}
        selectedTemplateNames={selectedTemplateNames}
        selectedKeySet={selectedKeySet}
        allVisibleSelected={allVisibleSelected}
        someVisibleSelected={someVisibleSelected}
        itemKeyList={itemKeyList}
        canDownloadTemplate={canDownloadTemplate}
        downloadLoading={downloadLoading}
        onToggleAllVisible={toggleAllVisible}
        onToggleItem={toggleItem}
        onClearSelection={handleClearSelection}
        onDownloadSelected={handleDownloadSelected}
        formatMoney={formatMoney}
        formatNumber={formatNumber}
      />
    </div>
  );
};

export default ManagerReportPage;
