import React, { useEffect, useMemo, useState } from "react";
import {
  FiCheckCircle,
  FiClock,
  FiDownload,
  FiFileText,
  FiFilter,
  FiFolder,
  FiRefreshCw,
  FiSearch,
  FiXCircle,
} from "react-icons/fi";

import { excelApi } from "../../api";
import { alertError, alertSuccess } from "../../utils/swal";

const STATUS_OPTIONS = [
  { value: "", label: "전체" },
  { value: "DOWNLOADABLE", label: "다운로드 가능" },
  { value: "GENERATED", label: "생성 완료" },
  { value: "DOWNLOADED", label: "다운로드 완료" },
  { value: "FAILED", label: "생성 실패" },
];

const STATUS_LABEL_MAP = {
  DOWNLOADABLE: "다운로드 가능",
  GENERATED: "생성 완료",
  DOWNLOADED: "다운로드 완료",
  FAILED: "생성 실패",
};

const STATUS_STYLE_MAP = {
  DOWNLOADABLE: "bg-emerald-50 text-emerald-700 ring-emerald-100",
  GENERATED: "bg-blue-50 text-blue-700 ring-blue-100",
  DOWNLOADED: "bg-slate-100 text-slate-700 ring-slate-200",
  FAILED: "bg-rose-50 text-rose-700 ring-rose-100",
};

const formatNumber = (value) => {
  return Number(value || 0).toLocaleString("ko-KR");
};

const formatDateTime = (value) => {
  if (!value) return "-";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "-";
  }

  return date.toLocaleString("ko-KR", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
};

const removeExtension = (fileName) => {
  return String(fileName || "").replace(/\.[^.]+$/, "");
};

const getExtension = (fileName) => {
  const match = String(fileName || "").match(/\.([^.]+)$/);
  return match ? match[1].toUpperCase() : "XLSX";
};

const cleanFileName = (fileName) => {
  const rawName = String(fileName || "생성 문서");

  const withoutExtension = removeExtension(rawName);

  /**
   * 제거 대상 예시
   * BATCH-20260610-702444_경비청구서
   * BATCH_20260610_702444_경비청구서
   * BATCH-20260610-702444-경비청구서
   */
  const cleaned = withoutExtension
    .replace(/^BATCH[-_]\d{8}[-_]\d+[-_]*/i, "")
    .replace(/^BATCH[-_]\d+[-_]*/i, "")
    .replace(/^_+/, "")
    .replace(/_+/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  return cleaned || withoutExtension || rawName;
};

const getStatusLabel = (status) => {
  return STATUS_LABEL_MAP[status] || status || "-";
};

const getDownloadCountText = (count) => {
  return `${formatNumber(count)}회`;
};

const getTotalByStatus = (items, status) => {
  return items.filter((item) => item.status === status).length;
};

const StatusBadge = ({ status }) => {
  const className =
    STATUS_STYLE_MAP[status] || "bg-slate-100 text-slate-600 ring-slate-200";

  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-1 text-[11px] font-extrabold ring-1 ${className}`}
    >
      {getStatusLabel(status)}
    </span>
  );
};

const SummaryCard = ({ label, value, icon: Icon, caption }) => {
  return (
    <div className="rounded-3xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
      <div className="flex items-center justify-between gap-4">
        <div className="min-w-0">
          <p className="text-xs font-extrabold text-slate-400">{label}</p>
          <p className="mt-2 text-2xl font-black text-slate-950">{value}</p>
          {caption && (
            <p className="mt-1 truncate text-xs font-bold text-slate-400">
              {caption}
            </p>
          )}
        </div>

        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-slate-950 text-white">
          <Icon className="text-xl" />
        </div>
      </div>
    </div>
  );
};

const EmptyState = () => {
  return (
    <div className="flex min-h-[260px] flex-col items-center justify-center rounded-3xl bg-white p-8 text-center">
      <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-slate-100 text-slate-400">
        <FiFileText className="text-2xl" />
      </div>

      <p className="mt-4 text-sm font-extrabold text-slate-700">
        생성된 문서가 없습니다.
      </p>

      <p className="mt-1 text-xs font-bold text-slate-400">
        검토 완료 후 엑셀 생성이 완료되면 이 목록에 표시됩니다.
      </p>
    </div>
  );
};

const DocumentMobileCard = ({ item, downloadingId, onDownload }) => {
  const displayName = cleanFileName(item.fileName);
  const extension = getExtension(item.fileName);
  const isDownloading = downloadingId === item.generatedDocumentId;

  return (
    <article className="rounded-3xl bg-white p-4 shadow-sm ring-1 ring-slate-200">
      <div className="flex items-start gap-3">
        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-blue-50 text-blue-600 ring-1 ring-blue-100">
          <FiFileText className="text-xl" />
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <StatusBadge status={item.status} />
            <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-extrabold text-slate-500">
              {extension}
            </span>
          </div>

          <h4 className="mt-2 line-clamp-2 text-sm font-black text-slate-950">
            {displayName}
          </h4>

          <p className="mt-1 text-xs font-bold text-slate-400">
            {item.departmentName || "-"} · {item.siteName || "-"}
          </p>
        </div>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-3">
        <div className="rounded-2xl bg-slate-50 p-3">
          <p className="text-xs font-extrabold text-slate-400">생성일</p>
          <p className="mt-1 text-xs font-bold text-slate-700">
            {formatDateTime(item.generatedAt)}
          </p>
        </div>

        <div className="rounded-2xl bg-slate-50 p-3">
          <p className="text-xs font-extrabold text-slate-400">다운로드</p>
          <p className="mt-1 text-xs font-bold text-slate-700">
            {getDownloadCountText(item.downloadCount || 0)}
          </p>
        </div>
      </div>

      <button
        type="button"
        onClick={() => onDownload(item.generatedDocumentId)}
        disabled={isDownloading}
        className="mt-4 inline-flex h-11 w-full items-center justify-center gap-2 rounded-2xl bg-slate-950 px-4 text-sm font-extrabold text-white transition hover:bg-blue-600 disabled:bg-slate-400"
      >
        {isDownloading ? (
          <FiRefreshCw className="animate-spin" />
        ) : (
          <FiDownload />
        )}
        다운로드
      </button>
    </article>
  );
};

const GeneratedDocumentsPage = () => {
  const [status, setStatus] = useState("");
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);
  const [downloadingId, setDownloadingId] = useState(null);
  const [pageInfo, setPageInfo] = useState({
    page: 1,
    size: 20,
    total: 0,
  });

  const totalDownloadCount = useMemo(() => {
    return items.reduce((sum, item) => sum + Number(item.downloadCount || 0), 0);
  }, [items]);

  const downloadableCount = useMemo(() => {
    return getTotalByStatus(items, "DOWNLOADABLE");
  }, [items]);

  const failedCount = useMemo(() => {
    return getTotalByStatus(items, "FAILED");
  }, [items]);

  const loadDocuments = async () => {
    try {
      setLoading(true);

      const response = await excelApi.getGeneratedDocuments({
        status: status || undefined,
        page: 1,
        size: 20,
      });

      setItems(response.items || []);
      setPageInfo({
        page: response.page || 1,
        size: response.size || 20,
        total: response.total || 0,
      });
    } catch (error) {
      console.error("생성 문서 목록 조회 실패:", error);

      await alertError(
        "조회 실패",
        error.response?.data?.message ||
          "생성 문서 목록을 불러오지 못했습니다."
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadDocuments();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status]);

  const handleDownload = async (generatedDocumentId) => {
    try {
      setDownloadingId(generatedDocumentId);

      const result = await excelApi.downloadExcel(generatedDocumentId);

      await alertSuccess(
        "다운로드 완료",
        `${result.fileName} 파일을 다운로드했습니다.`
      );

      await loadDocuments();
    } catch (error) {
      console.error("다운로드 실패:", error);

      await alertError(
        "다운로드 실패",
        error.response?.data?.message ||
          error.message ||
          "파일 다운로드 중 오류가 발생했습니다."
      );
    } finally {
      setDownloadingId(null);
    }
  };

  return (
    <div className="space-y-6 pb-20 lg:pb-0">
      <section className="overflow-hidden rounded-3xl bg-slate-950 text-white shadow-sm">
        <div className="relative p-5 sm:p-6">
          <div className="absolute right-0 top-0 h-40 w-40 rounded-full bg-blue-500/20 blur-3xl" />
          <div className="absolute bottom-0 right-24 h-32 w-32 rounded-full bg-emerald-500/10 blur-3xl" />

          <div className="relative flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <span className="inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1 text-xs font-bold text-slate-200 ring-1 ring-white/10">
                <FiFolder />
                관리팀 사용자
              </span>

              <h2 className="mt-3 text-xl font-black tracking-tight sm:text-2xl">
                생성 문서
              </h2>

              <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-300">
                검토 완료된 증빙자료로 생성된 경비청구서 엑셀 파일을 확인하고 다운로드합니다.
              </p>
            </div>

            <button
              type="button"
              onClick={loadDocuments}
              disabled={loading}
              className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-2xl bg-white px-4 text-sm font-extrabold text-slate-950 transition hover:bg-blue-50 disabled:bg-slate-400 sm:w-auto"
            >
              <FiRefreshCw className={loading ? "animate-spin" : ""} />
              새로고침
            </button>
          </div>
        </div>
      </section>

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <SummaryCard
          label="전체 문서"
          value={`${formatNumber(pageInfo.total)}건`}
          icon={FiFileText}
          caption="생성된 경비청구서"
        />

        <SummaryCard
          label="다운로드 가능"
          value={`${formatNumber(downloadableCount)}건`}
          icon={FiCheckCircle}
          caption="현재 목록 기준"
        />

        <SummaryCard
          label="다운로드 횟수"
          value={`${formatNumber(totalDownloadCount)}회`}
          icon={FiDownload}
          caption="현재 목록 합계"
        />

        <SummaryCard
          label="생성 실패"
          value={`${formatNumber(failedCount)}건`}
          icon={FiXCircle}
          caption="확인 필요"
        />
      </section>

      <section className="rounded-3xl bg-white p-5 shadow-sm ring-1 ring-slate-200 sm:p-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <div className="flex items-center gap-2">
              <FiFileText className="text-slate-700" />
              <h3 className="text-base font-extrabold text-slate-950">
                경비청구서 파일 목록
              </h3>
            </div>

            <p className="mt-1 text-xs font-bold text-slate-400">
              파일명 앞의 배치번호는 숨기고, 문서명 중심으로 표시합니다.
            </p>
          </div>

          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <div className="inline-flex h-11 items-center gap-2 rounded-2xl bg-slate-50 px-3 ring-1 ring-slate-200">
              <FiFilter className="text-slate-400" />
              <select
                value={status}
                onChange={(event) => setStatus(event.target.value)}
                className="h-9 bg-transparent text-sm font-extrabold text-slate-700 outline-none"
              >
                {STATUS_OPTIONS.map((option) => (
                  <option key={option.value || "ALL"} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>

            <div className="inline-flex h-11 items-center gap-2 rounded-2xl bg-slate-50 px-3 text-xs font-extrabold text-slate-500 ring-1 ring-slate-200">
              <FiSearch />
              총 {formatNumber(pageInfo.total)}건
            </div>
          </div>
        </div>

        <div className="mt-5 hidden overflow-hidden rounded-2xl border border-slate-200 lg:block">
          <table className="w-full min-w-[960px] text-left text-sm">
            <thead className="bg-slate-50 text-xs font-extrabold text-slate-500">
              <tr>
                <th className="px-4 py-4">문서명</th>
                <th className="px-4 py-4">부서 / 현장</th>
                <th className="px-4 py-4">생성일</th>
                <th className="px-4 py-4">상태</th>
                <th className="px-4 py-4">다운로드</th>
                <th className="px-4 py-4 text-right">작업</th>
              </tr>
            </thead>

            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr>
                  <td
                    colSpan="6"
                    className="px-4 py-12 text-center text-sm font-bold text-slate-400"
                  >
                    불러오는 중...
                  </td>
                </tr>
              ) : items.length === 0 ? (
                <tr>
                  <td colSpan="6" className="px-4 py-6">
                    <EmptyState />
                  </td>
                </tr>
              ) : (
                items.map((item) => {
                  const displayName = cleanFileName(item.fileName);
                  const extension = getExtension(item.fileName);
                  const isDownloading =
                    downloadingId === item.generatedDocumentId;

                  return (
                    <tr
                      key={item.generatedDocumentId}
                      className="bg-white transition hover:bg-slate-50"
                    >
                      <td className="px-4 py-4">
                        <div className="flex min-w-0 items-center gap-3">
                          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-blue-50 text-blue-600 ring-1 ring-blue-100">
                            <FiFileText className="text-lg" />
                          </div>

                          <div className="min-w-0">
                            <div className="flex items-center gap-2">
                              <p className="truncate font-black text-slate-950">
                                {displayName}
                              </p>

                              <span className="shrink-0 rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-extrabold text-slate-500">
                                {extension}
                              </span>
                            </div>

                            <p className="mt-1 truncate text-xs font-bold text-slate-400">
                              원본 파일명: {item.fileName || "-"}
                            </p>
                          </div>
                        </div>
                      </td>

                      <td className="px-4 py-4">
                        <p className="text-sm font-extrabold text-slate-800">
                          {item.departmentName || "-"}
                        </p>
                        <p className="mt-1 text-xs font-bold text-slate-400">
                          {item.siteName || "-"}
                        </p>
                      </td>

                      <td className="px-4 py-4">
                        <div className="inline-flex items-center gap-2 text-xs font-bold text-slate-500">
                          <FiClock className="text-slate-400" />
                          {formatDateTime(item.generatedAt)}
                        </div>
                      </td>

                      <td className="px-4 py-4">
                        <StatusBadge status={item.status} />
                      </td>

                      <td className="px-4 py-4 text-xs font-extrabold text-slate-600">
                        {getDownloadCountText(item.downloadCount || 0)}
                      </td>

                      <td className="px-4 py-4 text-right">
                        <button
                          type="button"
                          onClick={() =>
                            handleDownload(item.generatedDocumentId)
                          }
                          disabled={isDownloading}
                          className="inline-flex h-9 items-center gap-1 rounded-xl bg-slate-950 px-3 text-xs font-extrabold text-white transition hover:bg-blue-600 disabled:bg-slate-400"
                        >
                          {isDownloading ? (
                            <FiRefreshCw className="animate-spin" />
                          ) : (
                            <FiDownload />
                          )}
                          다운로드
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        <div className="mt-5 space-y-3 lg:hidden">
          {loading ? (
            <div className="rounded-3xl bg-white p-8 text-center text-sm font-bold text-slate-400 ring-1 ring-slate-200">
              불러오는 중...
            </div>
          ) : items.length === 0 ? (
            <EmptyState />
          ) : (
            items.map((item) => (
              <DocumentMobileCard
                key={item.generatedDocumentId}
                item={item}
                downloadingId={downloadingId}
                onDownload={handleDownload}
              />
            ))
          )}
        </div>
      </section>
    </div>
  );
};

export default GeneratedDocumentsPage;