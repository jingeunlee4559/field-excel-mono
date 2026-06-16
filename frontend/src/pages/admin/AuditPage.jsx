import React, { useEffect, useMemo, useState } from 'react';
import {
  FiActivity,
  FiCalendar,
  FiChevronLeft,
  FiChevronRight,
  FiClock,
  FiDatabase,
  FiDownload,
  FiEye,
  FiFilter,
  FiRefreshCw,
  FiSearch,
  FiShield,
  FiUser,
  FiX,
} from 'react-icons/fi';

import { auditApi } from '../../api';
import { alertError, toastSuccess } from '../../utils/swal';

const INITIAL_FILTERS = {
  q: '',
  actionType: '',
  targetTable: '',
  userId: '',
  startDate: '',
  endDate: '',
};

const ACTION_LABELS = {
  TEMPLATE_CREATED: '템플릿 등록',
  TEMPLATE_UPDATED: '템플릿 수정',
  TEMPLATE_ACTIVATED: '템플릿 활성화',
  MAPPING_SAVED: '매핑 저장',
  MAPPING_DELETED: '매핑 삭제',
  UPLOAD_BATCH_CREATED: '증빙 업로드',
  REVIEW_UPDATED: '검토 수정',
  REVIEW_STATUS_CHANGED: '검토 상태 변경',
  SUPPLEMENT_REQUESTED: '보완 요청',
  EXCEL_GENERATED: '엑셀 생성',
  SOURCE_FILE_EXCEL_GENERATED: '파일별 엑셀 생성',
  SELECTED_EXCEL_GENERATED: '선택 엑셀 생성',
  CORRECTION_CREATED: '보정사전 등록',
  CORRECTION_UPDATED: '보정사전 수정',
  CORRECTION_APPROVED: '보정사전 승인',
  CORRECTION_DISABLED: '보정사전 비활성화',
};

const TARGET_LABELS = {
  templates: '템플릿',
  template_mappings: '매핑',
  upload_batches: '업로드 배치',
  source_files: '원본 파일',
  extracted_values: '추출값',
  validation_results: '검증 결과',
  generated_documents: '생성 문서',
  correction_dictionaries: '보정사전',
};

const ACTION_BADGE = {
  CREATE: 'bg-blue-50 text-blue-700 ring-blue-200',
  CREATED: 'bg-blue-50 text-blue-700 ring-blue-200',
  UPDATE: 'bg-violet-50 text-violet-700 ring-violet-200',
  UPDATED: 'bg-violet-50 text-violet-700 ring-violet-200',
  APPROVE: 'bg-emerald-50 text-emerald-700 ring-emerald-200',
  APPROVED: 'bg-emerald-50 text-emerald-700 ring-emerald-200',
  DISABLED: 'bg-slate-100 text-slate-600 ring-slate-200',
  DELETE: 'bg-rose-50 text-rose-700 ring-rose-200',
  DELETED: 'bg-rose-50 text-rose-700 ring-rose-200',
  DEFAULT: 'bg-slate-50 text-slate-700 ring-slate-200',
};

const getActionLabel = (value) => ACTION_LABELS[value] || value || '-';
const getTargetLabel = (value) => TARGET_LABELS[value] || value || '-';

const getActionBadge = (actionType = '') => {
  const key = Object.keys(ACTION_BADGE).find((item) => actionType.includes(item));
  return ACTION_BADGE[key] || ACTION_BADGE.DEFAULT;
};

const formatDateTime = (value) => {
  if (!value) return '-';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return new Intl.DateTimeFormat('ko-KR', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date);
};

const formatNumber = (value) => new Intl.NumberFormat('ko-KR').format(Number(value || 0));

const normalizeResponseData = (response) => response?.data || response || {};

const stringifyJson = (value) => {
  if (value === null || value === undefined || value === '') return '없음';
  if (typeof value === 'string') {
    try {
      return JSON.stringify(JSON.parse(value), null, 2);
    } catch {
      return value;
    }
  }
  return JSON.stringify(value, null, 2);
};

const AuditPage = () => {
  const [items, setItems] = useState([]);
  const [summary, setSummary] = useState({ total: 0, todayCount: 0, actorCount: 0, activeDays: 0 });
  const [meta, setMeta] = useState({ actionTypes: [], targetTables: [], users: [] });
  const [filters, setFilters] = useState(INITIAL_FILTERS);
  const [pageInfo, setPageInfo] = useState({ page: 1, size: 20, total: 0, totalPages: 1 });
  const [loading, setLoading] = useState(false);
  const [detailLoading, setDetailLoading] = useState(false);
  const [selectedLog, setSelectedLog] = useState(null);

  const queryParams = useMemo(
    () => ({
      q: filters.q || undefined,
      actionType: filters.actionType || undefined,
      targetTable: filters.targetTable || undefined,
      userId: filters.userId || undefined,
      startDate: filters.startDate || undefined,
      endDate: filters.endDate || undefined,
      page: pageInfo.page,
      size: pageInfo.size,
    }),
    [filters, pageInfo.page, pageInfo.size]
  );

  const loadMeta = async () => {
    try {
      const result = await auditApi.getAuditMeta();
      setMeta(normalizeResponseData(result));
    } catch (error) {
      console.warn('[AuditPage] meta load failed', error);
    }
  };

  const loadLogs = async () => {
    try {
      setLoading(true);
      const [listResponse, summaryResponse] = await Promise.all([
        auditApi.getAuditLogs(queryParams),
        auditApi.getAuditSummary(queryParams),
      ]);

      const listData = normalizeResponseData(listResponse);
      const summaryData = normalizeResponseData(summaryResponse);

      setItems(listData.items || []);
      setSummary(summaryData || { total: 0, todayCount: 0, actorCount: 0, activeDays: 0 });
      setPageInfo((prev) => ({
        ...prev,
        page: Number(listData.page || queryParams.page || 1),
        size: Number(listData.size || queryParams.size || 20),
        total: Number(listData.total || 0),
        totalPages: Number(listData.totalPages || Math.max(1, Math.ceil(Number(listData.total || 0) / Number(listData.size || 20)))),
      }));
    } catch (error) {
      await alertError('작업 이력 조회 실패', error.response?.data?.message || '작업 이력을 불러오지 못했습니다.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadMeta();
  }, []);

  useEffect(() => {
    loadLogs();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [queryParams]);

  const handleFilterChange = (event) => {
    const { name, value } = event.target;
    setFilters((prev) => ({ ...prev, [name]: value }));
    setPageInfo((prev) => ({ ...prev, page: 1 }));
  };

  const resetFilters = () => {
    setFilters(INITIAL_FILTERS);
    setPageInfo((prev) => ({ ...prev, page: 1 }));
  };

  const openDetail = async (logId) => {
    try {
      setDetailLoading(true);
      const result = await auditApi.getAuditLogDetail(logId);
      setSelectedLog(normalizeResponseData(result));
    } catch (error) {
      await alertError('상세 조회 실패', error.response?.data?.message || '작업 이력 상세를 불러오지 못했습니다.');
    } finally {
      setDetailLoading(false);
    }
  };

  const exportCsv = async () => {
    const header = ['ID', '일시', '사용자', '권한', '작업', '대상', '대상ID', 'IP'];
    const rows = items.map((item) => [
      item.logId,
      formatDateTime(item.createdAt),
      item.userName || '',
      item.roleCode || '',
      getActionLabel(item.actionType),
      getTargetLabel(item.targetTable),
      item.targetId || '',
      item.ipAddress || '',
    ]);

    const csv = [header, ...rows]
      .map((row) => row.map((cell) => `"${String(cell ?? '').replace(/"/g, '""')}"`).join(','))
      .join('\n');

    const blob = new Blob([`\ufeff${csv}`], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `audit_logs_${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    await toastSuccess('현재 페이지 작업 이력을 CSV로 저장했습니다.');
  };

  const goPage = (nextPage) => {
    setPageInfo((prev) => ({
      ...prev,
      page: Math.min(Math.max(nextPage, 1), prev.totalPages || 1),
    }));
  };

  const statCards = [
    { label: '전체 이력', value: summary.total, icon: FiDatabase, sub: '검색 조건 기준' },
    { label: '오늘 작업', value: summary.todayCount, icon: FiClock, sub: '금일 발생 건수' },
    { label: '작업 사용자', value: summary.actorCount, icon: FiUser, sub: '고유 사용자 수' },
    { label: '활동 일수', value: summary.activeDays, icon: FiActivity, sub: '이력이 있는 날짜' },
  ];

  return (
    <div className="space-y-5 px-4 py-4 sm:px-6 lg:px-8">
      <section className="overflow-hidden rounded-[2rem] bg-slate-950 text-white shadow-sm">
        <div className="relative p-5 sm:p-7 lg:p-8">
          <div className="absolute -right-10 -top-10 h-44 w-44 rounded-full bg-white/10 blur-2xl" />
          <div className="absolute bottom-0 right-20 h-28 w-28 rounded-full bg-blue-500/20 blur-2xl" />

          <div className="relative flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <div className="inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1 text-xs font-black text-slate-200 ring-1 ring-white/10">
                <FiShield /> SYSTEM ADMIN ONLY
              </div>
              <h1 className="mt-4 text-2xl font-black tracking-tight sm:text-3xl">작업 이력 관리</h1>
              <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-300">
                템플릿, 매핑, 업로드, 검토, 엑셀 생성, 보정사전 승인까지 관리자 감사 로그를 추적합니다.
                문제가 생겼을 때 누가 언제 무엇을 변경했는지 바로 확인할 수 있습니다.
              </p>
            </div>

            <div className="flex flex-col gap-2 sm:flex-row">
              <button
                type="button"
                onClick={loadLogs}
                disabled={loading}
                className="inline-flex h-11 items-center justify-center gap-2 rounded-2xl bg-white px-4 text-sm font-black text-slate-950 transition hover:bg-slate-100 disabled:opacity-60"
              >
                <FiRefreshCw className={loading ? 'animate-spin' : ''} />
                새로고침
              </button>
              <button
                type="button"
                onClick={exportCsv}
                disabled={items.length === 0}
                className="inline-flex h-11 items-center justify-center gap-2 rounded-2xl bg-white/10 px-4 text-sm font-black text-white ring-1 ring-white/15 transition hover:bg-white/15 disabled:opacity-50"
              >
                <FiDownload /> CSV
              </button>
            </div>
          </div>
        </div>
      </section>

      <section className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {statCards.map((card) => {
          const Icon = card.icon;
          return (
            <div key={card.label} className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-xs font-black uppercase tracking-wide text-slate-400">{card.label}</p>
                  <p className="mt-2 text-2xl font-black text-slate-950 sm:text-3xl">{formatNumber(card.value)}</p>
                  <p className="mt-1 text-xs font-semibold text-slate-400">{card.sub}</p>
                </div>
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-slate-100 text-slate-700">
                  <Icon />
                </div>
              </div>
            </div>
          );
        })}
      </section>

      <section className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
        <div className="mb-4 flex items-center gap-2 text-sm font-black text-slate-900">
          <FiFilter /> 검색 조건
        </div>

        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-6">
          <div className="relative md:col-span-2 xl:col-span-2">
            <FiSearch className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              name="q"
              value={filters.q}
              onChange={handleFilterChange}
              placeholder="사용자, 작업명, 대상, IP, 변경 내용 검색"
              className="h-12 w-full rounded-2xl border border-slate-200 bg-white pl-11 pr-4 text-sm font-semibold text-slate-800 outline-none transition focus:border-slate-950"
            />
          </div>

          <select name="actionType" value={filters.actionType} onChange={handleFilterChange} className="h-12 rounded-2xl border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-800 outline-none transition focus:border-slate-950">
            <option value="">전체 작업</option>
            {(meta.actionTypes || []).map((item) => (
              <option key={item.value} value={item.value}>
                {getActionLabel(item.value)} ({item.count})
              </option>
            ))}
          </select>

          <select name="targetTable" value={filters.targetTable} onChange={handleFilterChange} className="h-12 rounded-2xl border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-800 outline-none transition focus:border-slate-950">
            <option value="">전체 대상</option>
            {(meta.targetTables || []).map((item) => (
              <option key={item.value} value={item.value}>
                {getTargetLabel(item.value)} ({item.count})
              </option>
            ))}
          </select>

          <select name="userId" value={filters.userId} onChange={handleFilterChange} className="h-12 rounded-2xl border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-800 outline-none transition focus:border-slate-950">
            <option value="">전체 사용자</option>
            {(meta.users || []).map((item) => (
              <option key={item.value} value={item.value}>
                {item.label} / {item.roleCode} ({item.count})
              </option>
            ))}
          </select>

          <button
            type="button"
            onClick={resetFilters}
            className="h-12 rounded-2xl bg-slate-100 px-4 text-sm font-black text-slate-700 transition hover:bg-slate-200"
          >
            초기화
          </button>

          <div className="relative">
            <FiCalendar className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="date"
              name="startDate"
              value={filters.startDate}
              onChange={handleFilterChange}
              className="h-12 w-full rounded-2xl border border-slate-200 bg-white pl-11 pr-4 text-sm font-semibold text-slate-800 outline-none transition focus:border-slate-950"
            />
          </div>

          <div className="relative">
            <FiCalendar className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="date"
              name="endDate"
              value={filters.endDate}
              onChange={handleFilterChange}
              className="h-12 w-full rounded-2xl border border-slate-200 bg-white pl-11 pr-4 text-sm font-semibold text-slate-800 outline-none transition focus:border-slate-950"
            />
          </div>

          <select
            value={pageInfo.size}
            onChange={(event) => setPageInfo((prev) => ({ ...prev, page: 1, size: Number(event.target.value) }))}
            className="h-12 rounded-2xl border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-800 outline-none transition focus:border-slate-950"
          >
            <option value={10}>10개씩</option>
            <option value={20}>20개씩</option>
            <option value={50}>50개씩</option>
            <option value={100}>100개씩</option>
          </select>
        </div>
      </section>

      <section className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
        <div className="flex flex-col gap-2 border-b border-slate-100 p-4 sm:flex-row sm:items-center sm:justify-between sm:p-5">
          <div>
            <h2 className="text-lg font-black text-slate-950">이력 목록</h2>
            <p className="mt-1 text-xs font-semibold text-slate-400">
              총 {formatNumber(pageInfo.total)}건 · {pageInfo.page}/{pageInfo.totalPages}페이지
            </p>
          </div>
          {loading && <p className="text-xs font-black text-slate-400">불러오는 중...</p>}
        </div>

        <div className="hidden overflow-x-auto lg:block">
          <table className="min-w-full divide-y divide-slate-100">
            <thead className="bg-slate-50">
              <tr>
                <Th>ID</Th>
                <Th>작업 일시</Th>
                <Th>사용자</Th>
                <Th>작업</Th>
                <Th>대상</Th>
                <Th>IP</Th>
                <Th align="right">상세</Th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 bg-white">
              {items.map((item) => (
                <tr key={item.logId} className="transition hover:bg-slate-50/80">
                  <Td mono>#{item.logId}</Td>
                  <Td>{formatDateTime(item.createdAt)}</Td>
                  <Td>
                    <div className="min-w-0">
                      <p className="font-black text-slate-900">{item.userName || '알 수 없음'}</p>
                      <p className="mt-0.5 text-xs font-semibold text-slate-400">{item.roleCode || item.userEmail || '-'}</p>
                    </div>
                  </Td>
                  <Td>
                    <span className={`inline-flex rounded-full px-3 py-1 text-xs font-black ring-1 ${getActionBadge(item.actionType)}`}>
                      {getActionLabel(item.actionType)}
                    </span>
                  </Td>
                  <Td>
                    <p className="font-black text-slate-800">{getTargetLabel(item.targetTable)}</p>
                    <p className="mt-0.5 text-xs font-semibold text-slate-400">ID: {item.targetId || '-'}</p>
                  </Td>
                  <Td mono>{item.ipAddress || '-'}</Td>
                  <Td align="right">
                    <button
                      type="button"
                      onClick={() => openDetail(item.logId)}
                      className="inline-flex h-9 items-center justify-center gap-1 rounded-xl bg-slate-950 px-3 text-xs font-black text-white transition hover:bg-slate-800"
                    >
                      <FiEye /> 보기
                    </button>
                  </Td>
                </tr>
              ))}

              {!loading && items.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-6 py-16 text-center">
                    <p className="text-sm font-black text-slate-500">조건에 맞는 작업 이력이 없습니다.</p>
                    <p className="mt-1 text-xs font-semibold text-slate-400">업로드, 검토, 보정사전 승인 같은 작업을 수행하면 여기에 기록됩니다.</p>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <div className="space-y-3 p-4 lg:hidden">
          {items.map((item) => (
            <button
              type="button"
              key={item.logId}
              onClick={() => openDetail(item.logId)}
              className="w-full rounded-3xl border border-slate-200 bg-white p-4 text-left shadow-sm transition active:scale-[0.99]"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-xs font-black text-slate-400">#{item.logId} · {formatDateTime(item.createdAt)}</p>
                  <p className="mt-2 text-base font-black text-slate-950">{getActionLabel(item.actionType)}</p>
                  <p className="mt-1 text-sm font-semibold text-slate-500">{getTargetLabel(item.targetTable)} / ID {item.targetId || '-'}</p>
                </div>
                <span className={`shrink-0 rounded-full px-2.5 py-1 text-[11px] font-black ring-1 ${getActionBadge(item.actionType)}`}>
                  상세
                </span>
              </div>
              <div className="mt-4 flex items-center justify-between gap-3 rounded-2xl bg-slate-50 px-3 py-2 text-xs font-bold text-slate-500">
                <span>{item.userName || '알 수 없음'}</span>
                <span>{item.ipAddress || '-'}</span>
              </div>
            </button>
          ))}

          {!loading && items.length === 0 && (
            <div className="rounded-3xl border border-dashed border-slate-200 p-10 text-center">
              <p className="text-sm font-black text-slate-500">조건에 맞는 작업 이력이 없습니다.</p>
            </div>
          )}
        </div>

        <div className="flex flex-col gap-3 border-t border-slate-100 p-4 sm:flex-row sm:items-center sm:justify-between sm:p-5">
          <p className="text-xs font-bold text-slate-400">
            {formatNumber(pageInfo.total)}건 중 {items.length}건 표시
          </p>
          <div className="flex items-center justify-between gap-2 sm:justify-end">
            <button
              type="button"
              onClick={() => goPage(pageInfo.page - 1)}
              disabled={pageInfo.page <= 1}
              className="inline-flex h-10 items-center gap-1 rounded-2xl border border-slate-200 px-3 text-sm font-black text-slate-700 disabled:opacity-40"
            >
              <FiChevronLeft /> 이전
            </button>
            <span className="min-w-[90px] text-center text-sm font-black text-slate-700">
              {pageInfo.page} / {pageInfo.totalPages}
            </span>
            <button
              type="button"
              onClick={() => goPage(pageInfo.page + 1)}
              disabled={pageInfo.page >= pageInfo.totalPages}
              className="inline-flex h-10 items-center gap-1 rounded-2xl border border-slate-200 px-3 text-sm font-black text-slate-700 disabled:opacity-40"
            >
              다음 <FiChevronRight />
            </button>
          </div>
        </div>
      </section>

      {selectedLog && (
        <DetailModal
          item={selectedLog}
          loading={detailLoading}
          onClose={() => setSelectedLog(null)}
        />
      )}
    </div>
  );
};

const getAlignClass = (align) => {
  if (align === 'right') return 'text-right';
  if (align === 'center') return 'text-center';
  return 'text-left';
};

const Th = ({ children, align = 'left' }) => (
  <th className={`px-5 py-4 ${getAlignClass(align)} text-xs font-black uppercase tracking-wide text-slate-400`}>
    {children}
  </th>
);

const Td = ({ children, align = 'left', mono = false }) => (
  <td className={`px-5 py-4 ${getAlignClass(align)} align-middle text-sm ${mono ? 'font-mono font-bold text-slate-500' : 'font-semibold text-slate-700'}`}>
    {children}
  </td>
);

const DetailModal = ({ item, loading, onClose }) => {
  return (
    <div className="fixed inset-0 z-[100] flex items-end justify-center bg-slate-950/45 p-0 backdrop-blur-sm sm:items-center sm:p-6">
      <div className="max-h-[92vh] w-full max-w-5xl overflow-hidden rounded-t-[2rem] bg-white shadow-2xl sm:rounded-[2rem]">
        <div className="flex items-start justify-between gap-4 border-b border-slate-100 p-5 sm:p-6">
          <div className="min-w-0">
            <p className="text-xs font-black uppercase tracking-wide text-slate-400">Audit Detail #{item.logId}</p>
            <h3 className="mt-2 text-xl font-black text-slate-950">{getActionLabel(item.actionType)}</h3>
            <p className="mt-1 text-sm font-semibold text-slate-500">
              {formatDateTime(item.createdAt)} · {item.userName || '알 수 없음'} · {getTargetLabel(item.targetTable)} #{item.targetId || '-'}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-slate-100 text-slate-600 transition hover:bg-slate-200"
          >
            <FiX />
          </button>
        </div>

        <div className="max-h-[calc(92vh-105px)] overflow-y-auto p-5 sm:p-6">
          {loading ? (
            <div className="py-16 text-center text-sm font-black text-slate-400">상세 내용을 불러오는 중...</div>
          ) : (
            <div className="space-y-5">
              <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-4">
                <InfoBox label="사용자" value={item.userName || '알 수 없음'} sub={item.userEmail || item.roleCode || '-'} />
                <InfoBox label="작업 유형" value={getActionLabel(item.actionType)} sub={item.actionType || '-'} />
                <InfoBox label="대상" value={getTargetLabel(item.targetTable)} sub={`ID ${item.targetId || '-'}`} />
                <InfoBox label="접속 정보" value={item.ipAddress || '-'} sub={item.userAgent || '-'} />
              </div>

              <div className="grid gap-5 lg:grid-cols-2">
                <JsonBlock title="변경 전" value={item.beforeData} />
                <JsonBlock title="변경 후" value={item.afterData} />
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

const InfoBox = ({ label, value, sub }) => (
  <div className="rounded-3xl border border-slate-200 bg-slate-50 p-4">
    <p className="text-xs font-black uppercase tracking-wide text-slate-400">{label}</p>
    <p className="mt-2 truncate text-sm font-black text-slate-900">{value}</p>
    <p className="mt-1 break-all text-xs font-semibold text-slate-400">{sub}</p>
  </div>
);

const JsonBlock = ({ title, value }) => (
  <div className="overflow-hidden rounded-3xl border border-slate-200 bg-slate-950">
    <div className="border-b border-white/10 px-4 py-3 text-sm font-black text-white">{title}</div>
    <pre className="max-h-[420px] overflow-auto p-4 text-xs leading-5 text-slate-100">
      {stringifyJson(value)}
    </pre>
  </div>
);

export default AuditPage;
