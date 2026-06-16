import React, { useEffect, useState } from 'react';
import { FiFileText, FiRefreshCw, FiUploadCloud, FiX } from 'react-icons/fi';
import { uploadApi } from '../../api';
import { alertError, alertSuccess, alertWarning } from '../../utils/swal';

const SupplementsPage = () => {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);
  const [uploadingId, setUploadingId] = useState(null);
  const [selectedFiles, setSelectedFiles] = useState({});
  const [pageInfo, setPageInfo] = useState({ page: 1, size: 20, total: 0 });

  const loadSupplements = async () => {
    try {
      setLoading(true);
      const response = await uploadApi.getMySupplements({ page: 1, size: 20 });
      setItems(response.items || []);
      setPageInfo({ page: response.page || 1, size: response.size || 20, total: response.total || 0 });
    } catch (error) {
      console.error('보완 요청 목록 조회 실패:', error);
      await alertError('조회 실패', error.response?.data?.message || '보완 요청 목록을 불러오지 못했습니다.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadSupplements(); }, []);

  const handleFileChange = (sourceFileId, file) => {
    setSelectedFiles((prev) => ({ ...prev, [sourceFileId]: file || null }));
  };

  const handleUpload = async (sourceFileId) => {
    const file = selectedFiles[sourceFileId];
    if (!file) {
      await alertWarning('파일 선택 필요', '재업로드할 파일을 선택해주세요.');
      return;
    }
    try {
      setUploadingId(sourceFileId);
      await uploadApi.uploadSupplementFile({ sourceFileId, file });
      await alertSuccess('재업로드 완료', '보완자료가 재업로드되고 AI 처리가 요청되었습니다.');
      setSelectedFiles((prev) => ({ ...prev, [sourceFileId]: null }));
      await loadSupplements();
    } catch (error) {
      console.error('보완자료 재업로드 실패:', error);
      await alertError('재업로드 실패', error.response?.data?.message || error.message || '보완자료 재업로드 중 오류가 발생했습니다.');
    } finally {
      setUploadingId(null);
    }
  };

  return (
    <div className="space-y-6">
      <section className="rounded-3xl bg-slate-950 p-6 text-white shadow-sm">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <div className="mb-3 inline-flex items-center rounded-full bg-white/10 px-3 py-1 text-xs font-bold text-slate-200">증빙 제출자</div>
            <h2 className="text-2xl font-extrabold tracking-tight">보완 요청</h2>
            <p className="mt-2 text-sm leading-6 text-slate-300">관리팀에서 재업로드를 요청한 증빙자료만 표시됩니다.</p>
          </div>
          <button type="button" onClick={loadSupplements} disabled={loading} className="inline-flex h-11 items-center justify-center gap-2 rounded-2xl bg-white px-4 text-sm font-extrabold text-slate-950 hover:bg-blue-50 disabled:bg-slate-300">
            <FiRefreshCw className={loading ? 'animate-spin' : ''} /> 새로고침
          </button>
        </div>
      </section>

      <section className="rounded-3xl bg-white p-6 shadow-sm ring-1 ring-slate-200">
        <div className="mb-5">
          <h3 className="text-base font-extrabold text-slate-950">재업로드 필요 목록</h3>
          <p className="mt-1 text-xs font-bold text-slate-400">총 {pageInfo.total}건</p>
        </div>

        <div className="space-y-3">
          {loading ? (
            <div className="rounded-2xl bg-slate-50 p-8 text-center text-sm font-bold text-slate-400">불러오는 중...</div>
          ) : items.length === 0 ? (
            <div className="rounded-2xl bg-emerald-50 p-8 text-center text-sm font-extrabold text-emerald-700">현재 보완 요청이 없습니다.</div>
          ) : items.map((item) => {
            const file = selectedFiles[item.sourceFileId];
            const uploading = uploadingId === item.sourceFileId;
            return (
              <div key={item.sourceFileId} className="rounded-2xl border border-slate-200 bg-white p-5">
                <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <FiFileText className="text-slate-400" />
                      <p className="truncate text-sm font-extrabold text-slate-950">{item.originalFileName}</p>
                    </div>
                    <p className="mt-2 text-xs font-bold text-slate-400">{item.batchNo} · {item.departmentName || '-'} / {item.siteName || '-'} · 파일 ID #{item.sourceFileId}</p>
                    <p className="mt-3 rounded-2xl bg-rose-50 p-3 text-xs font-bold leading-5 text-rose-600">{item.reason || '보완자료가 필요합니다.'}</p>
                  </div>
                </div>

                <div className="mt-4 flex flex-col gap-3 md:flex-row md:items-center">
                  <label className="flex min-h-[46px] flex-1 cursor-pointer items-center justify-center rounded-2xl border-2 border-dashed border-slate-200 bg-slate-50 px-4 text-sm font-extrabold text-slate-500 hover:border-slate-400 hover:bg-white">
                    {file ? file.name : '재업로드 파일 선택'}
                    <input type="file" accept=".jpg,.jpeg,.png,.webp,.pdf" onChange={(event) => handleFileChange(item.sourceFileId, event.target.files?.[0])} className="hidden" />
                  </label>
                  {file && (
                    <button type="button" onClick={() => handleFileChange(item.sourceFileId, null)} className="inline-flex h-11 items-center justify-center rounded-2xl border border-slate-200 px-4 text-sm font-extrabold text-slate-500 hover:bg-rose-50 hover:text-rose-600"><FiX /></button>
                  )}
                  <button type="button" onClick={() => handleUpload(item.sourceFileId)} disabled={uploading} className="inline-flex h-11 items-center justify-center gap-2 rounded-2xl bg-slate-950 px-5 text-sm font-extrabold text-white hover:bg-blue-600 disabled:bg-slate-400">
                    {uploading ? <FiRefreshCw className="animate-spin" /> : <FiUploadCloud />} {uploading ? '처리 중...' : '재업로드'}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </section>
    </div>
  );
};

export default SupplementsPage;
