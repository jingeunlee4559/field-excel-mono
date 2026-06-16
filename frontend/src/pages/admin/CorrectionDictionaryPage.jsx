import React, { useEffect, useMemo, useState } from 'react';
import { FiCheck, FiPlus, FiRefreshCw, FiSearch, FiSlash } from 'react-icons/fi';

import { correctionApi } from '../../api';
import { useAuth } from '../../context/AuthContext';
import { alertError, alertSuccess } from '../../utils/swal';

const TYPE_OPTIONS = [
  { value: '', label: '전체 유형' },
  { value: 'VENDOR', label: '상호명' },
  { value: 'ITEM', label: '품목명' },
  { value: 'PAYMENT', label: '결제수단' },
  { value: 'CATEGORY', label: '경비분류' },
  { value: 'OCR_TEXT', label: 'OCR 문구' },
];

const STATUS_OPTIONS = [
  { value: '', label: '전체 상태' },
  { value: 'PENDING', label: '승인대기' },
  { value: 'APPROVED', label: '승인됨' },
  { value: 'REJECTED', label: '반려' },
  { value: 'DISABLED', label: '비활성' },
];

const MATCH_OPTIONS = [
  { value: 'EXACT', label: '정확히 일치' },
  { value: 'CONTAINS', label: '포함' },
  { value: 'FUZZY', label: '유사도' },
];

const STATUS_BADGE = {
  PENDING: 'bg-amber-50 text-amber-700 ring-amber-200',
  APPROVED: 'bg-emerald-50 text-emerald-700 ring-emerald-200',
  REJECTED: 'bg-rose-50 text-rose-700 ring-rose-200',
  DISABLED: 'bg-slate-100 text-slate-500 ring-slate-200',
};

const initialForm = {
  dictionaryType: 'VENDOR',
  wrongText: '',
  correctedText: '',
  matchType: 'EXACT',
  documentType: 'RECEIPT',
  status: 'PENDING',
  priority: 100,
  description: '',
};

const CorrectionDictionaryPage = () => {
  const { user } = useAuth();
  const isSystemAdmin = user?.roleCode === 'SYSTEM_ADMIN';

  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [filters, setFilters] = useState({ dictionaryType: '', status: '', q: '' });
  const [form, setForm] = useState(initialForm);

  const approvedCount = useMemo(
    () => items.filter((item) => item.status === 'APPROVED' && item.activeYn === 'Y').length,
    [items]
  );

  const pendingCount = useMemo(
    () => items.filter((item) => item.status === 'PENDING').length,
    [items]
  );

  const loadItems = async () => {
    try {
      setLoading(true);
      const result = await correctionApi.getCorrections({
        dictionaryType: filters.dictionaryType || undefined,
        status: filters.status || undefined,
        q: filters.q || undefined,
      });
      setItems(result?.data || []);
    } catch (error) {
      await alertError('보정 사전 조회 실패', error.response?.data?.message || '보정 사전을 불러오지 못했습니다.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadItems();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleChange = (event) => {
    const { name, value } = event.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  };

  const handleFilterChange = (event) => {
    const { name, value } = event.target;
    setFilters((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (event) => {
    event.preventDefault();

    if (!form.wrongText.trim() || !form.correctedText.trim()) {
      await alertError('입력 확인', 'OCR 오인식 값과 보정값을 모두 입력해야 합니다.');
      return;
    }

    try {
      setSaving(true);
      const payload = {
        ...form,
        status: isSystemAdmin ? form.status : 'PENDING',
        priority: Number(form.priority || 100),
        suggestedBy: 'USER',
      };

      await correctionApi.createCorrection(payload);

      await alertSuccess(
        '등록 완료',
        isSystemAdmin && form.status === 'APPROVED'
          ? '보정 규칙이 승인 상태로 등록되었습니다.'
          : '보정 사전 후보가 승인대기로 등록되었습니다. 시스템 관리자 승인 후 자동 적용됩니다.'
      );
      setForm(initialForm);
      await loadItems();
    } catch (error) {
      await alertError('등록 실패', error.response?.data?.message || '보정 사전을 등록하지 못했습니다.');
    } finally {
      setSaving(false);
    }
  };

  const approveItem = async (id) => {
    try {
      await correctionApi.approveCorrection(id);
      await alertSuccess('승인 완료', '해당 보정 규칙이 자동 적용 대상으로 변경되었습니다.');
      await loadItems();
    } catch (error) {
      await alertError('승인 실패', error.response?.data?.message || '승인 처리 중 오류가 발생했습니다.');
    }
  };

  const disableItem = async (id) => {
    try {
      await correctionApi.disableCorrection(id);
      await alertSuccess('비활성화 완료', '해당 보정 규칙이 비활성화되었습니다.');
      await loadItems();
    } catch (error) {
      await alertError('비활성화 실패', error.response?.data?.message || '비활성화 처리 중 오류가 발생했습니다.');
    }
  };

  const typeLabel = (value) => TYPE_OPTIONS.find((item) => item.value === value)?.label || value;
  const statusLabel = (value) => STATUS_OPTIONS.find((item) => item.value === value)?.label || value;

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 rounded-3xl bg-slate-950 p-6 text-white shadow-sm lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="text-sm font-bold text-slate-300">OCR/AI 보정 기준정보</p>
          <h1 className="mt-2 text-2xl font-black tracking-tight">보정 사전 관리</h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-300">
            OCR 오인식 값은 자동으로 바로 적용하지 않고, 시스템 관리자 승인 후 자동 보정에 사용합니다.
            관리팀 사용자는 후보를 등록할 수 있고, 승인/비활성화는 시스템 관리자만 가능합니다.
          </p>
        </div>
        <div className="grid grid-cols-2 gap-3 text-sm">
          <div className="rounded-2xl bg-white/10 px-4 py-3">
            <p className="text-slate-300">승인된 규칙</p>
            <p className="mt-1 text-2xl font-black">{approvedCount}</p>
          </div>
          <div className="rounded-2xl bg-white/10 px-4 py-3">
            <p className="text-slate-300">승인대기</p>
            <p className="mt-1 text-2xl font-black">{pendingCount}</p>
          </div>
        </div>
      </div>

      <div className="grid gap-6 xl:grid-cols-[420px_1fr]">
        <form onSubmit={handleSubmit} className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="mb-5 flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-slate-950 text-white">
              <FiPlus />
            </div>
            <div>
              <h2 className="text-lg font-black text-slate-950">보정 후보 추가</h2>
              <p className="text-xs font-medium text-slate-400">시스템 관리자 승인 전에는 자동 적용되지 않습니다.</p>
            </div>
          </div>

          <div className="grid gap-4">
            <div className="grid grid-cols-2 gap-3">
              <label className="text-sm font-bold text-slate-700">
                유형
                <select name="dictionaryType" value={form.dictionaryType} onChange={handleChange} className="mt-2 w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm outline-none focus:border-slate-950">
                  {TYPE_OPTIONS.filter((option) => option.value).map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
                </select>
              </label>
              <label className="text-sm font-bold text-slate-700">
                매칭
                <select name="matchType" value={form.matchType} onChange={handleChange} className="mt-2 w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm outline-none focus:border-slate-950">
                  {MATCH_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
                </select>
              </label>
            </div>

            <label className="text-sm font-bold text-slate-700">
              OCR 오인식 값
              <input name="wrongText" value={form.wrongText} onChange={handleChange} placeholder="예: 맥먹드익스프레스" className="mt-2 w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm outline-none focus:border-slate-950" />
            </label>

            <label className="text-sm font-bold text-slate-700">
              보정값
              <input name="correctedText" value={form.correctedText} onChange={handleChange} placeholder="예: 매머드 익스프레스" className="mt-2 w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm outline-none focus:border-slate-950" />
            </label>

            <div className="grid grid-cols-3 gap-3">
              <label className="text-sm font-bold text-slate-700">
                문서유형
                <input name="documentType" value={form.documentType} onChange={handleChange} className="mt-2 w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm outline-none focus:border-slate-950" />
              </label>
              <label className="text-sm font-bold text-slate-700">
                상태
                {isSystemAdmin ? (
                  <select name="status" value={form.status} onChange={handleChange} className="mt-2 w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm outline-none focus:border-slate-950">
                    <option value="PENDING">승인대기</option>
                    <option value="APPROVED">즉시 승인</option>
                  </select>
                ) : (
                  <div className="mt-2 flex h-[46px] items-center rounded-2xl border border-slate-200 bg-slate-50 px-4 text-sm font-bold text-slate-500">
                    승인대기
                  </div>
                )}
              </label>
              <label className="text-sm font-bold text-slate-700">
                우선순위
                <input name="priority" type="number" value={form.priority} onChange={handleChange} className="mt-2 w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm outline-none focus:border-slate-950" />
              </label>
            </div>

            <label className="text-sm font-bold text-slate-700">
              설명
              <textarea name="description" value={form.description} onChange={handleChange} rows={3} placeholder="예: 커피 영수증 상호명 OCR 오인식 보정" className="mt-2 w-full resize-none rounded-2xl border border-slate-200 px-4 py-3 text-sm outline-none focus:border-slate-950" />
            </label>

            <button type="submit" disabled={saving} className="mt-2 flex h-12 items-center justify-center rounded-2xl bg-slate-950 text-sm font-black text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-300">
              {saving ? '저장 중...' : isSystemAdmin && form.status === 'APPROVED' ? '보정 규칙 등록' : '보정 후보 등록'}
            </button>
          </div>
        </form>

        <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="mb-5 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <h2 className="text-lg font-black text-slate-950">보정 사전 목록</h2>
              <p className="text-xs font-medium text-slate-400">APPROVED + active=Y 규칙만 AI 서버에 전달됩니다.</p>
              {!isSystemAdmin && (
                <p className="mt-1 text-xs font-bold text-amber-600">관리팀 사용자는 후보 등록만 가능하며 승인/비활성화는 시스템 관리자만 가능합니다.</p>
              )}
            </div>
            <button type="button" onClick={loadItems} className="inline-flex h-10 items-center justify-center gap-2 rounded-2xl border border-slate-200 px-4 text-sm font-bold text-slate-700 hover:bg-slate-50">
              <FiRefreshCw className={loading ? 'animate-spin' : ''} /> 새로고침
            </button>
          </div>

          <div className="mb-4 grid gap-3 lg:grid-cols-[180px_180px_1fr_100px]">
            <select name="dictionaryType" value={filters.dictionaryType} onChange={handleFilterChange} className="rounded-2xl border border-slate-200 px-4 py-3 text-sm outline-none focus:border-slate-950">
              {TYPE_OPTIONS.map((option) => <option key={option.label} value={option.value}>{option.label}</option>)}
            </select>
            <select name="status" value={filters.status} onChange={handleFilterChange} className="rounded-2xl border border-slate-200 px-4 py-3 text-sm outline-none focus:border-slate-950">
              {STATUS_OPTIONS.map((option) => <option key={option.label} value={option.value}>{option.label}</option>)}
            </select>
            <div className="relative">
              <FiSearch className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
              <input name="q" value={filters.q} onChange={handleFilterChange} placeholder="오인식 값/보정값 검색" className="w-full rounded-2xl border border-slate-200 py-3 pl-11 pr-4 text-sm outline-none focus:border-slate-950" />
            </div>
            <button type="button" onClick={loadItems} className="rounded-2xl bg-slate-950 px-4 py-3 text-sm font-black text-white hover:bg-slate-800">
              조회
            </button>
          </div>

          <div className="overflow-hidden rounded-2xl border border-slate-200">
            <div className="max-h-[620px] overflow-auto">
              <table className="min-w-[900px] w-full text-left text-sm">
                <thead className="sticky top-0 bg-slate-50 text-xs font-black uppercase tracking-wide text-slate-500">
                  <tr>
                    <th className="px-4 py-3">유형</th>
                    <th className="px-4 py-3">OCR 오인식 값</th>
                    <th className="px-4 py-3">보정값</th>
                    <th className="px-4 py-3">매칭</th>
                    <th className="px-4 py-3">상태</th>
                    <th className="px-4 py-3">설명</th>
                    <th className="px-4 py-3 text-right">작업</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {loading ? (
                    <tr><td colSpan={7} className="px-4 py-10 text-center text-slate-400">불러오는 중...</td></tr>
                  ) : items.length === 0 ? (
                    <tr><td colSpan={7} className="px-4 py-10 text-center text-slate-400">등록된 보정 사전이 없습니다.</td></tr>
                  ) : (
                    items.map((item) => (
                      <tr key={item.id} className="align-top hover:bg-slate-50/70">
                        <td className="px-4 py-3 font-bold text-slate-700">{typeLabel(item.dictionaryType)}</td>
                        <td className="px-4 py-3 font-semibold text-slate-950">{item.wrongText}</td>
                        <td className="px-4 py-3 font-semibold text-slate-950">{item.correctedText}</td>
                        <td className="px-4 py-3 text-slate-500">{item.matchType}</td>
                        <td className="px-4 py-3">
                          <span className={`inline-flex rounded-full px-3 py-1 text-xs font-black ring-1 ${STATUS_BADGE[item.status] || STATUS_BADGE.PENDING}`}>
                            {statusLabel(item.status)}
                          </span>
                          {item.activeYn === 'N' && <p className="mt-1 text-xs font-bold text-slate-400">사용 안 함</p>}
                        </td>
                        <td className="max-w-[260px] px-4 py-3 text-xs leading-5 text-slate-500">{item.description || '-'}</td>
                        <td className="px-4 py-3 text-right">
                          <div className="flex justify-end gap-2">
                            {isSystemAdmin && item.status !== 'APPROVED' && (
                              <button type="button" onClick={() => approveItem(item.id)} className="inline-flex h-9 items-center gap-1 rounded-xl bg-emerald-50 px-3 text-xs font-black text-emerald-700 hover:bg-emerald-100">
                                <FiCheck /> 승인
                              </button>
                            )}
                            {isSystemAdmin && item.activeYn !== 'N' && (
                              <button type="button" onClick={() => disableItem(item.id)} className="inline-flex h-9 items-center gap-1 rounded-xl bg-slate-100 px-3 text-xs font-black text-slate-600 hover:bg-slate-200">
                                <FiSlash /> 비활성
                              </button>
                            )}
                            {!isSystemAdmin && (
                              <span className="inline-flex h-9 items-center rounded-xl bg-slate-50 px-3 text-xs font-bold text-slate-400">
                                승인 권한 없음
                              </span>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default CorrectionDictionaryPage;
