import React, { useEffect, useState } from 'react';
import { FiChevronDown, FiFileText, FiRefreshCw, FiSearch } from 'react-icons/fi';
import { uploadApi } from '../../api';
import { alertError } from '../../utils/swal';

const STATUS_OPTIONS = [
  { value: '', label: '전체' },
  { value: 'UPLOADED', label: '업로드 완료' },
  { value: 'QUEUED', label: '처리 대기' },
  { value: 'PROCESSING', label: '처리 중' },
  { value: 'NEED_REVIEW', label: '검토 필요' },
  { value: 'NEED_SUPPLEMENT', label: '보완 필요' },
  { value: 'READY_TO_GENERATE', label: '생성 대기' },
  { value: 'GENERATED', label: '생성 완료' },
  { value: 'COMPLETED', label: '완료' },
  { value: 'FAILED', label: '실패' },
];

const STATUS_LABEL = {
  UPLOADED: '업로드 완료',
  QUEUED: '처리 대기',
  PROCESSING: '처리 중',
  EXTRACTING: '추출 중',
  NORMAL: '정상 처리',
  NEED_REVIEW: '검토 필요',
  NEED_SUPPLEMENT: '보완 필요',
  READY_TO_GENERATE: '생성 대기',
  GENERATED: '생성 완료',
  COMPLETED: '완료',
  FAILED: '실패',
};

const MyUploadsPage = () => {
  const [status, setStatus] = useState('');
  const [items, setItems] = useState([]);
  const [expandedBatchId, setExpandedBatchId] = useState(null);
  const [detailMap, setDetailMap] = useState({});
  const [loading, setLoading] = useState(false);
  const [detailLoading, setDetailLoading] = useState(false);
  const [pageInfo, setPageInfo] = useState({ page: 1, size: 20, total: 0 });

  const loadBatches = async () => {
    try {
      setLoading(true);
      const response = await uploadApi.getMyBatches({ status: status || undefined, page: 1, size: 20 });
      setItems(response.items || []);
      setPageInfo({ page: response.page || 1, size: response.size || 20, total: response.total || 0 });
    } catch (error) {
      console.error('내 업로드 목록 조회 실패:', error);
      await alertError('조회 실패', error.response?.data?.message || '내 업로드 목록을 불러오지 못했습니다.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadBatches();
  }, [status]);

  useEffect(() => {
    const timerId = window.setInterval(() => {
      loadBatches();
    }, 8000);

    return () => window.clearInterval(timerId);
  }, [status]);

  const toggleDetail = async (batchId) => {
    if (expandedBatchId === batchId) {
      setExpandedBatchId(null);
      return;
    }

    setExpandedBatchId(batchId);

    if (detailMap[batchId]) return;

    try {
      setDetailLoading(true);
      const detail = await uploadApi.getBatchDetail(batchId);
      setDetailMap((prev) => ({ ...prev, [batchId]: detail }));
    } catch (error) {
      console.error('업로드 상세 조회 실패:', error);
      await alertError('상세 조회 실패', error.response?.data?.message || '업로드 상세를 불러오지 못했습니다.');
    } finally {
      setDetailLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <section className="rounded-3xl bg-slate-950 p-6 text-white shadow-sm">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <div className="mb-3 inline-flex items-center rounded-full bg-white/10 px-3 py-1 text-xs font-bold text-slate-200">증빙 제출자</div>
            <h2 className="text-2xl font-extrabold tracking-tight">내 업로드</h2>
            <p className="mt-2 text-sm leading-6 text-slate-300">내가 제출한 영수증/PDF/이미지의 OCR/AI 처리 상태를 확인합니다.</p>
          </div>
          <button type="button" onClick={loadBatches} disabled={loading} className="inline-flex h-11 items-center justify-center gap-2 rounded-2xl bg-white px-4 text-sm font-extrabold text-slate-950 hover:bg-blue-50 disabled:bg-slate-300">
            <FiRefreshCw className={loading ? 'animate-spin' : ''} /> 새로고침
          </button>
        </div>
      </section>

      <section className="rounded-3xl bg-white p-6 shadow-sm ring-1 ring-slate-200">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <h3 className="text-base font-extrabold text-slate-950">업로드 배치 목록</h3>
            <p className="mt-1 text-xs font-bold text-slate-400">총 {pageInfo.total}건</p>
          </div>
          <div className="flex items-center gap-2 rounded-2xl bg-slate-50 px-3 py-2">
            <FiSearch className="text-slate-400" />
            <select value={status} onChange={(event) => setStatus(event.target.value)} className="h-9 bg-transparent text-sm font-extrabold text-slate-700 outline-none">
              {STATUS_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
            </select>
          </div>
        </div>

        <div className="mt-5 space-y-3">
          {loading ? (
            <div className="rounded-2xl bg-slate-50 p-8 text-center text-sm font-bold text-slate-400">불러오는 중...</div>
          ) : items.length === 0 ? (
            <div className="rounded-2xl bg-slate-50 p-8 text-center text-sm font-bold text-slate-400">업로드 내역이 없습니다.</div>
          ) : items.map((item) => {
            const detail = detailMap[item.batchId];
            const expanded = expandedBatchId === item.batchId;
            return (
              <div key={item.batchId} className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
                <button type="button" onClick={() => toggleDetail(item.batchId)} className="flex w-full flex-col gap-3 p-4 text-left transition hover:bg-slate-50 md:flex-row md:items-center md:justify-between">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-extrabold text-slate-950">{item.title || item.batchNo}</p>
                    <p className="mt-1 text-xs font-bold text-slate-400">{item.batchNo} · {item.documentType || '영수증'} · 파일 {item.fileCount || 0}개</p>
                    <p className="mt-1 text-xs font-bold text-slate-400">{item.departmentName || '-'} / {item.siteName || '-'}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <StatusBadge status={item.status} />
                    <FiChevronDown className={`text-slate-400 transition ${expanded ? 'rotate-180' : ''}`} />
                  </div>
                </button>

                {expanded && (
                  <div className="border-t border-slate-100 bg-slate-50 p-4">
                    {detailLoading && !detail ? (
                      <div className="text-sm font-bold text-slate-400">상세를 불러오는 중...</div>
                    ) : (
                      <div className="space-y-3">
                        {(detail?.files || []).map((file) => (
                          <div key={file.sourceFileId} className="flex flex-col gap-2 rounded-2xl bg-white p-4 ring-1 ring-slate-100 md:flex-row md:items-center md:justify-between">
                            <div className="flex min-w-0 items-center gap-3">
                              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-slate-100 text-slate-500"><FiFileText /></div>
                              <div className="min-w-0">
                                <p className="truncate text-sm font-extrabold text-slate-900">{file.originalFileName}</p>
                                <p className="text-xs font-bold text-slate-400">{Number(file.fileSize || 0) > 0 ? `${(Number(file.fileSize) / 1024 / 1024).toFixed(2)}MB` : '-'} · ID #{file.sourceFileId}</p>
                                {file.errorMessage && <p className="mt-1 text-xs font-bold text-rose-500">{file.errorMessage}</p>}
                              </div>
                            </div>
                            <StatusBadge status={file.status} />
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </section>
    </div>
  );
};

const StatusBadge = ({ status }) => {
  const className = status === 'NORMAL' || status === 'GENERATED' || status === 'COMPLETED'
    ? 'bg-emerald-50 text-emerald-700'
    : status === 'NEED_SUPPLEMENT' || status === 'FAILED'
      ? 'bg-rose-50 text-rose-700'
      : status === 'EXTRACTING' || status === 'PROCESSING' || status === 'QUEUED' || status === 'UPLOADED'
        ? 'bg-blue-50 text-blue-700'
        : 'bg-orange-50 text-orange-700';
  return <span className={`w-fit rounded-full px-2.5 py-1 text-[11px] font-extrabold ${className}`}>{STATUS_LABEL[status] || status || '-'}</span>;
};

export default MyUploadsPage;
