import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  FiAlertCircle,
  FiAlertTriangle,
  FiArrowLeft,
  FiCheckCircle,
  FiChevronLeft,
  FiChevronRight,
  FiClock,
  FiDownload,
  FiEdit3,
  FiExternalLink,
  FiEye,
  FiFileText,
  FiImage,
  FiMaximize2,
  FiMinus,
  FiPlus,
  FiRefreshCw,
  FiRotateCw,
  FiSave,
  FiTrash2,
  FiX,
  FiXCircle,
  FiZap,
} from 'react-icons/fi';

import { reviewApi } from '../../api';
import { alertError, alertSuccess, alertWarning, confirmSave } from '../../utils/swal';
import BatchCountSummary from '../../components/dashboard/BatchReviewConfirmPage/BatchCountSummary';
import BatchReviewHeader from '../../components/dashboard/BatchReviewConfirmPage/BatchReviewHeader';
import ResponsiveReceiptImageViewer from '../../components/dashboard/common/ResponsiveReceiptImageViewer';
import {
  API_ORIGIN,
  PROCESSING_STATUSES,
  STATUS_META,
  HEADER_ORDER,
  DEFAULT_HEADER_LABELS,
  FIELD_INPUT_TYPES,
  FILE_FILTERS,
  buildApiFileUrl,
  buildFileUrl,
  formatValue,
  formatDate,
  parseAmount,
  formatMoney,
  formatScore,
  getHeaderValue,
  StatusBadge,
  CountPill,
  buildHeaderState,
  buildDetailState
} from '../../components/dashboard/BatchReviewConfirmPage/batchReviewConfirmPage.parts.jsx';

const BatchReviewConfirmPage = () => {
  const { batchId } = useParams();
  const navigate = useNavigate();

  const [batch, setBatch] = useState(null);
  const [files, setFiles] = useState([]);
  const [selectedFileId, setSelectedFileId] = useState(null);
  const [statusFilter, setStatusFilter] = useState('');
  const [tab, setTab] = useState('basic');
  const [headerValues, setHeaderValues] = useState([]);
  const [detailItems, setDetailItems] = useState([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [zoom, setZoom] = useState(1);
  const [rotation, setRotation] = useState(0);
  const [imageModalOpen, setImageModalOpen] = useState(false);
  const [lastGenerated, setLastGenerated] = useState(null);
  const viewerRef = useRef(null);
  const modalViewerRef = useRef(null);
  const [imageNaturalSize, setImageNaturalSize] = useState({ width: 0, height: 0 });
  const [viewerSize, setViewerSize] = useState({ width: 0, height: 0 });
  const [modalViewerSize, setModalViewerSize] = useState({ width: 0, height: 0 });

  const selectedFile = useMemo(
    () => files.find((file) => Number(file.sourceFileId) === Number(selectedFileId)) || files[0] || null,
    [files, selectedFileId]
  );

  const selectedImageUrl = useMemo(() => buildFileUrl(selectedFile), [selectedFile]);

  const filteredFiles = useMemo(() => {
    if (!statusFilter) return files;
    return files.filter((file) => file.status === statusFilter);
  }, [files, statusFilter]);

  const selectedIndex = useMemo(() => {
    if (!selectedFile) return -1;
    return files.findIndex((file) => Number(file.sourceFileId) === Number(selectedFile.sourceFileId));
  }, [files, selectedFile]);

  const detailTotal = useMemo(
    () => detailItems.reduce((sum, item) => sum + parseAmount(item.amount), 0),
    [detailItems]
  );

  const receiptTotal = useMemo(
    () => parseAmount(getHeaderValue(headerValues, 'total_amount') || getHeaderValue(headerValues, 'paid_amount')),
    [headerValues]
  );

  const amountDiff = receiptTotal && detailTotal ? receiptTotal - detailTotal : 0;

  const activeValidationResults = useMemo(
    () => (selectedFile?.validationResults || []).filter((item) => !item.isResolved),
    [selectedFile]
  );

  const hasBlockingValidation = useMemo(
    () => activeValidationResults.some((item) => item.severity === 'ERROR'),
    [activeValidationResults]
  );

  const hasAmountMismatch = useMemo(
    () => receiptTotal > 0 && detailItems.length > 0 && Math.abs(amountDiff) > 0.5,
    [receiptTotal, detailItems.length, amountDiff]
  );

  const hasCandidateItems = useMemo(
    () => detailItems.some((item) => item.isCandidate || item.extractionSource === 'AI_CANDIDATE'),
    [detailItems]
  );

  const canConfirmSelected = Boolean(
    selectedFile &&
    selectedFile.status !== 'CONFIRMED' &&
    selectedFile.status !== 'FAILED' &&
    selectedFile.status !== 'NEED_SUPPLEMENT' &&
    detailItems.length > 0 &&
    !hasAmountMismatch &&
    !hasBlockingValidation
  );

  const confirmDisabledReason = (() => {
    if (!selectedFile) return '선택된 파일이 없습니다.';
    if (selectedFile.status === 'CONFIRMED') return '이미 확정된 파일입니다.';
    if (selectedFile.status === 'FAILED') return '처리 실패 파일은 확정할 수 없습니다.';
    if (selectedFile.status === 'NEED_SUPPLEMENT') return '보완 필요 파일은 보완자료 확인 후 확정하세요.';
    if (detailItems.length === 0) return '상세품목이 없어 확정할 수 없습니다.';
    if (hasAmountMismatch) return '상세합계와 영수증총액이 일치하지 않습니다.';
    if (hasBlockingValidation) return 'ERROR 검증결과가 남아 있습니다.';
    return '';
  })();

  const batchSummary = useMemo(() => {
    const summary = files.reduce(
      (acc, file) => {
        const status = file.status || 'UNKNOWN';
        acc.total += 1;
        if (status === 'CONFIRMED') acc.confirmed += 1;
        else if (status === 'NORMAL') acc.confirmable += 1;
        else if (status === 'NEED_REVIEW') acc.needReview += 1;
        else if (status === 'NEED_SUPPLEMENT') acc.needSupplement += 1;
        else if (status === 'FAILED') acc.failed += 1;
        else if (PROCESSING_STATUSES.includes(status)) acc.processing += 1;
        else acc.unknown += 1;
        return acc;
      },
      { total: 0, confirmed: 0, confirmable: 0, needReview: 0, needSupplement: 0, failed: 0, processing: 0, unknown: 0 }
    );

    const finalCount = summary.confirmed + summary.needSupplement + summary.failed;
    const progressPercent = summary.total > 0 ? Math.round((finalCount / summary.total) * 100) : 0;
    const blockingCount = summary.needReview + summary.processing + summary.unknown;
    const canCompleteBatch = summary.total > 0 && blockingCount === 0;

    return { ...summary, finalCount, progressPercent, blockingCount, canCompleteBatch };
  }, [files]);

  const batchCompletionMessage = useMemo(() => {
    if (batchSummary.total === 0) return '확정할 파일이 없습니다.';
    if (batchSummary.processing > 0) return `AI 처리 중 ${batchSummary.processing}건이 남아 있습니다.`;
    if (batchSummary.needReview > 0) return `검토 필요 ${batchSummary.needReview}건을 확정하거나 보완요청으로 정리해야 합니다.`;
    if (batchSummary.confirmable > 0) return `배치 최종완료 시 확정 가능 ${batchSummary.confirmable}건이 일괄 확정되고 엑셀이 생성됩니다.`;
    if (batchSummary.unknown > 0) return `상태 미확인 ${batchSummary.unknown}건을 먼저 확인해야 합니다.`;
    return '모든 파일이 최종 상태입니다. 배치 최종완료 후 엑셀을 생성할 수 있습니다.';
  }, [batchSummary]);

  const loadBatch = async ({ keepSelected = true } = {}) => {
    try {
      setLoading(true);
      const response = await reviewApi.getReviewBatchDetail(batchId);
      const responseFiles = response.files || [];
      setBatch(response.batch || null);
      setFiles(responseFiles);

      const nextSelected = keepSelected && selectedFileId
        ? responseFiles.find((file) => Number(file.sourceFileId) === Number(selectedFileId))
        : null;
      const firstTarget = responseFiles.find((file) => ['NEED_REVIEW', 'NEED_SUPPLEMENT', 'NORMAL'].includes(file.status));
      const fallback = nextSelected || firstTarget || responseFiles[0] || null;
      setSelectedFileId(fallback?.sourceFileId || null);
    } catch (error) {
      console.error('배치 상세 조회 실패:', error);
      await alertError('조회 실패', error.response?.data?.message || '배치 검토 정보를 불러오지 못했습니다.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadBatch({ keepSelected: false });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [batchId]);

  useEffect(() => {
    setHeaderValues(buildHeaderState(selectedFile));
    setDetailItems(buildDetailState(selectedFile));
    setTab('basic');
    setZoom(1);
    setRotation(0);
    setImageModalOpen(false);
    setImageNaturalSize({ width: 0, height: 0 });
  }, [selectedFile?.sourceFileId]);

  useEffect(() => {
    const updateSize = () => {
      if (viewerRef.current) {
        const rect = viewerRef.current.getBoundingClientRect();
        setViewerSize({ width: Math.max(0, rect.width), height: Math.max(0, rect.height) });
      }
      if (modalViewerRef.current) {
        const rect = modalViewerRef.current.getBoundingClientRect();
        setModalViewerSize({ width: Math.max(0, rect.width), height: Math.max(0, rect.height) });
      }
    };

    updateSize();
    const resizeObserver = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(updateSize) : null;
    if (resizeObserver && viewerRef.current) resizeObserver.observe(viewerRef.current);
    if (resizeObserver && modalViewerRef.current) resizeObserver.observe(modalViewerRef.current);
    window.addEventListener('resize', updateSize);

    return () => {
      resizeObserver?.disconnect();
      window.removeEventListener('resize', updateSize);
    };
  }, [selectedFile?.sourceFileId, imageModalOpen]);

  const updateHeaderValue = (fieldKey, value) => {
    setHeaderValues((prev) => prev.map((field) => (field.fieldKey === fieldKey ? { ...field, finalValue: value } : field)));
  };

  const updateDetailItem = (index, key, value) => {
    setDetailItems((prev) => prev.map((item, itemIndex) => {
      if (itemIndex !== index) return item;
      const next = { ...item, [key]: value };
      if ((key === 'quantity' || key === 'unit_price') && next.quantity !== '' && next.unit_price !== '') {
        const qty = parseAmount(next.quantity);
        const unitPrice = parseAmount(next.unit_price);
        if (qty > 0 && unitPrice > 0) next.amount = String(qty * unitPrice);
      }
      return next;
    }));
  };

  const addDetailItem = () => {
    setDetailItems((prev) => [
      ...prev,
      {
        rowIndex: prev.length + 1,
        expense_date: getHeaderValue(headerValues, 'expense_date'),
        vendor_name: getHeaderValue(headerValues, 'vendor_name'),
        expense_category_code: '',
        expense_category_name: getHeaderValue(headerValues, 'expense_category_name'),
        item_name: '',
        description: '',
        quantity: '1',
        unit_price: '',
        amount: '',
        payment_method: getHeaderValue(headerValues, 'payment_method'),
        note: '',
        fieldIds: {},
      },
    ]);
  };

  const removeDetailItem = (index) => {
    setDetailItems((prev) => prev.filter((_, itemIndex) => itemIndex !== index).map((item, nextIndex) => ({ ...item, rowIndex: nextIndex + 1 })));
  };

  const saveSelectedFile = async ({ showToast = true } = {}) => {
    if (!selectedFile) return false;

    try {
      setSaving(true);

      const bulkValues = headerValues
        .filter((field) => field.extractedValueId)
        .map((field) => ({
          extractedValueId: field.extractedValueId,
          fieldKey: field.fieldKey,
          finalValue: field.finalValue,
        }));

      if (bulkValues.length > 0) {
        await reviewApi.updateExtractedValuesBulk({ sourceFileId: selectedFile.sourceFileId, values: bulkValues });
      }

      await reviewApi.syncDetailItems({
        sourceFileId: selectedFile.sourceFileId,
        items: detailItems.map((item, index) => ({ ...item, rowIndex: index + 1, fieldIds: item.fieldIds || {} })),
      });

      if (showToast) await alertSuccess('저장 완료', '수정한 추출값과 상세품목이 저장되었습니다.');
      await loadBatch({ keepSelected: true });
      return true;
    } catch (error) {
      console.error('파일 저장 실패:', error);
      await alertError('저장 실패', error.response?.data?.message || '수정 내용을 저장하지 못했습니다.');
      return false;
    } finally {
      setSaving(false);
    }
  };

  const completeSelectedFileAndGenerate = async () => {
    if (!selectedFile) return;

    if (selectedFile.status === 'FAILED') {
      await alertWarning('확정 불가', '처리 실패 파일은 먼저 원인을 확인해야 합니다.');
      return;
    }

    if (selectedFile.status === 'NEED_SUPPLEMENT') {
      await alertWarning('확정 전 확인 필요', '보완 필요 파일은 보완자료를 받거나 원본을 확인한 뒤 확정하세요.');
      return;
    }

    if (!canConfirmSelected) {
      await alertWarning('확정 불가', confirmDisabledReason || '검증 오류를 먼저 수정해야 합니다.');
      return;
    }

    const confirm = await confirmSave(
      '선택 파일을 확정하고 엑셀을 생성할까요?',
      '수정값을 저장한 뒤 파일을 확정완료로 바꾸고, 이 파일 기준 경비청구서 엑셀을 생성합니다.'
    );
    if (!confirm.isConfirmed) return;

    const saved = await saveSelectedFile({ showToast: false });
    if (!saved) return;

    try {
      setSaving(true);
      await reviewApi.completeReview(selectedFile.sourceFileId);
      const generated = await reviewApi.generateExcelFromSourceFile(selectedFile.sourceFileId);
      setLastGenerated(generated);
      await alertSuccess('확정 및 엑셀 생성 완료', generated?.fileName ? `${generated.fileName} 파일이 생성되었습니다.` : '생성 문서 목록에서 엑셀을 확인할 수 있습니다.');
      await loadBatch({ keepSelected: true });
    } catch (error) {
      console.error('확정/엑셀 생성 실패:', error);
      await alertError('처리 실패', error.response?.data?.message || '확정 또는 엑셀 생성을 완료하지 못했습니다.');
    } finally {
      setSaving(false);
    }
  };

  const requestSupplementForSelected = async () => {
    if (!selectedFile) return;
    const reason = window.prompt('보완 요청 사유를 입력하세요.', selectedFile.errorMessage || '원본 확인 또는 재촬영이 필요합니다.');
    if (reason === null) return;

    try {
      setSaving(true);
      await reviewApi.requestSupplement({ sourceFileId: selectedFile.sourceFileId, reason: reason || '원본 확인 또는 재촬영이 필요합니다.' });
      await alertSuccess('보완 요청 완료', '선택한 파일이 보완 필요 상태로 변경되었습니다.');
      await loadBatch({ keepSelected: true });
    } catch (error) {
      console.error('보완 요청 실패:', error);
      await alertError('보완 요청 실패', error.response?.data?.message || '보완 요청을 처리하지 못했습니다.');
    } finally {
      setSaving(false);
    }
  };

  const completeBatchAndGenerate = async () => {
    const confirm = await confirmSave(
      '배치 최종완료 후 엑셀을 생성할까요?',
      '확정 가능 파일은 일괄 확정하고, 배치 기준 경비청구서 엑셀을 바로 생성합니다.'
    );
    if (!confirm.isConfirmed) return;

    try {
      setSaving(true);
      await reviewApi.completeReviewBatch(batchId);
      const generated = await reviewApi.generateExcelForBatch(batchId);
      setLastGenerated(generated);
      await alertSuccess('배치 완료 및 엑셀 생성 완료', generated?.fileName ? `${generated.fileName} 파일이 생성되었습니다.` : '생성 문서 목록에서 엑셀을 확인할 수 있습니다.');
      navigate('/generated');
    } catch (error) {
      console.error('배치 확정/엑셀 생성 실패:', error);
      await alertError('처리 실패', error.response?.data?.message || '배치 최종완료 또는 엑셀 생성을 완료하지 못했습니다.');
    } finally {
      setSaving(false);
    }
  };

  const moveFile = (direction) => {
    if (!files.length || selectedIndex < 0) return;
    const nextIndex = Math.min(files.length - 1, Math.max(0, selectedIndex + direction));
    setSelectedFileId(files[nextIndex]?.sourceFileId || null);
  };

  const openOriginal = () => {
    if (selectedImageUrl) window.open(selectedImageUrl, '_blank', 'noopener,noreferrer');
  };

  const renderHeaderInput = (field) => {
    const inputType = FIELD_INPUT_TYPES[field.fieldKey] || 'text';
    return (
      <label key={field.fieldKey} className="block rounded-2xl border border-slate-200 bg-white p-3 shadow-sm">
        <div className="mb-2 flex items-center justify-between gap-2">
          <span className="text-xs font-black text-slate-500">{field.fieldLabel}</span>
          {field.confidence !== null && <span className="text-[11px] font-extrabold text-slate-400">{formatScore(field.confidence)}</span>}
        </div>
        <input
          type={inputType}
          value={field.finalValue || ''}
          onChange={(event) => updateHeaderValue(field.fieldKey, event.target.value)}
          className="h-10 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm font-bold text-slate-800 outline-none focus:border-blue-400 focus:bg-white focus:ring-4 focus:ring-blue-50"
        />
      </label>
    );
  };

  if (loading && !batch) {
    return (
      <div className="flex min-h-[540px] items-center justify-center rounded-3xl bg-white shadow-sm ring-1 ring-slate-200">
        <div className="text-center">
          <FiRefreshCw className="mx-auto animate-spin text-3xl text-blue-600" />
          <p className="mt-3 text-sm font-extrabold text-slate-500">배치 검토 정보를 불러오는 중입니다...</p>
        </div>
      </div>
    );
  }

  const imageTransform = `rotate(${rotation}deg)`;
  const getImageDisplaySize = (targetSize) => {
    const naturalWidth = imageNaturalSize.width || 1;
    const naturalHeight = imageNaturalSize.height || 1;
    const availableWidth = Math.max(240, (targetSize.width || 0) - 28);
    const availableHeight = Math.max(260, (targetSize.height || 0) - 28);
    const rotated = Math.abs(rotation / 90) % 2 === 1;
    const widthForFit = rotated ? naturalHeight : naturalWidth;
    const heightForFit = rotated ? naturalWidth : naturalHeight;
    const fitScale = Math.min(availableWidth / widthForFit, availableHeight / heightForFit, 1);
    const scale = Math.max(0.35, fitScale * zoom);
    return {
      width: Math.max(120, Math.round(naturalWidth * scale)),
      height: Math.max(120, Math.round(naturalHeight * scale)),
    };
  };
  const imageDisplaySize = getImageDisplaySize(viewerSize);
  const modalImageDisplaySize = getImageDisplaySize(modalViewerSize);

  return (
    <div className="w-full min-w-0 max-w-full overflow-x-hidden space-y-4 pb-24 sm:space-y-5 xl:pb-6">
      <BatchReviewHeader
        batch={batch}
        batchSummary={batchSummary}
        batchCompletionMessage={batchCompletionMessage}
        loading={loading}
        saving={saving}
        onBack={() => navigate('/reviews')}
        onReload={() => loadBatch({ keepSelected: true })}
        onCompleteBatch={completeBatchAndGenerate}
        formatValue={formatValue}
        formatScore={formatScore}
      />

      <BatchCountSummary batchSummary={batchSummary} />

      <section className="grid min-w-0 max-w-full gap-4 overflow-x-hidden xl:grid-cols-[minmax(0,280px)_minmax(0,1fr)] 2xl:grid-cols-[minmax(0,300px)_minmax(0,1fr)_minmax(0,500px)]">
        <aside className="min-w-0 overflow-hidden rounded-3xl bg-white p-4 shadow-sm ring-1 ring-slate-200 xl:sticky xl:top-4 xl:h-[calc(100vh-124px)]">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h3 className="text-sm font-black text-slate-950">배치 파일 목록</h3>
              <p className="mt-1 text-xs font-bold text-slate-400">먼저 처리할 파일을 선택하세요.</p>
            </div>
            <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-black text-slate-600">{filteredFiles.length}/{files.length}</span>
          </div>

          <div className="mt-4 flex max-w-full flex-wrap gap-2 overflow-hidden pb-1">
            {FILE_FILTERS.map((filter) => (
              <button key={filter.value || 'ALL'} type="button" onClick={() => setStatusFilter(filter.value)} className={`shrink-0 rounded-full px-3 py-1.5 text-xs font-black transition ${statusFilter === filter.value ? 'bg-slate-950 text-white' : 'bg-slate-100 text-slate-500 hover:bg-slate-200'}`}>
                {filter.label}
              </button>
            ))}
          </div>

          <div className="mt-4 grid max-h-[360px] min-w-0 gap-2 overflow-x-hidden overflow-y-auto pr-1 sm:max-h-[420px] xl:max-h-[calc(100vh-280px)]">
            {filteredFiles.length === 0 ? (
              <div className="rounded-2xl bg-slate-50 p-5 text-center text-xs font-bold text-slate-400">해당 상태의 파일이 없습니다.</div>
            ) : (
              filteredFiles.map((file, index) => {
                const selected = Number(file.sourceFileId) === Number(selectedFile?.sourceFileId);
                const meta = STATUS_META[file.status] || STATUS_META.UNKNOWN;
                return (
                  <button key={file.sourceFileId} type="button" onClick={() => setSelectedFileId(file.sourceFileId)} className={`block w-full max-w-full min-w-0 overflow-hidden rounded-2xl border p-3 text-left transition hover:-translate-y-0.5 hover:shadow-sm ${selected ? 'border-slate-950 bg-slate-950 text-white' : meta.card}`}>
                    <div className="flex min-w-0 items-start justify-between gap-2">
                      <div className="min-w-0 flex-1 overflow-hidden">
                        <p className="max-w-full truncate text-sm font-black">{index + 1}. {formatValue(file.originalFileName)}</p>
                        <p className={`mt-1 truncate text-[11px] font-bold ${selected ? 'text-slate-300' : 'text-slate-500'}`}>{formatValue(file.summaryFields?.vendor_name || file.errorMessage || file.documentType)}</p>
                      </div>
                      <span className={`shrink-0 rounded-full px-2 py-1 text-[11px] font-black ${selected ? 'bg-white/15 text-white' : 'bg-white text-slate-600 ring-1 ring-slate-200'}`}>{formatScore(file.confidencePercent)}</span>
                    </div>
                    <div className="mt-3 flex max-w-full flex-wrap gap-1.5 overflow-hidden">
                      <StatusBadge status={file.status} />
                      {file.activeValidationCount > 0 && <span className="max-w-full rounded-full bg-white px-2.5 py-1 text-[11px] font-black text-rose-600 ring-1 ring-rose-100">오류 {file.activeValidationCount}</span>}
                    </div>
                  </button>
                );
              })
            )}
          </div>
        </aside>

        <main className="min-w-0 overflow-hidden rounded-3xl bg-white p-4 shadow-sm ring-1 ring-slate-200 xl:sticky xl:top-4 xl:h-[calc(100vh-124px)] xl:min-h-[620px]">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="min-w-0">
              <p className="truncate text-base font-black text-slate-950">{formatValue(selectedFile?.originalFileName)}</p>
              <div className="mt-2 flex flex-wrap items-center gap-2">
                <StatusBadge status={selectedFile?.status} />
                <span className="rounded-full bg-slate-50 px-3 py-1 text-xs font-black text-slate-500 ring-1 ring-slate-100">신뢰도 {formatScore(selectedFile?.confidencePercent)}</span>
                <span className="rounded-full bg-slate-50 px-3 py-1 text-xs font-black text-slate-500 ring-1 ring-slate-100">{selectedIndex + 1}/{files.length}</span>
              </div>
            </div>
            <div className="grid min-w-0 grid-cols-5 gap-2 sm:flex">
              <button type="button" onClick={() => moveFile(-1)} disabled={selectedIndex <= 0} className="flex h-10 min-w-0 items-center justify-center rounded-2xl border border-slate-200 px-3 text-slate-600 hover:bg-slate-50 disabled:opacity-40"><FiChevronLeft /></button>
              <button type="button" onClick={() => moveFile(1)} disabled={selectedIndex >= files.length - 1} className="flex h-10 min-w-0 items-center justify-center rounded-2xl border border-slate-200 px-3 text-slate-600 hover:bg-slate-50 disabled:opacity-40"><FiChevronRight /></button>
              <button type="button" onClick={() => setRotation((prev) => prev + 90)} className="flex h-10 items-center justify-center rounded-2xl border border-slate-200 px-3 text-slate-600 hover:bg-slate-50"><FiRotateCw /></button>
              <button type="button" onClick={() => setImageModalOpen(true)} className="flex h-10 items-center justify-center rounded-2xl border border-slate-200 px-3 text-slate-600 hover:bg-slate-50"><FiMaximize2 /></button>
              <button type="button" onClick={openOriginal} className="flex h-10 items-center justify-center rounded-2xl border border-slate-200 px-3 text-slate-600 hover:bg-slate-50"><FiExternalLink /></button>
            </div>
          </div>

          <div className="mt-4 grid gap-3 sm:grid-cols-3">
            <div className="rounded-2xl bg-slate-50 p-3"><p className="text-[11px] font-black text-slate-400">사용처</p><p className="mt-1 truncate text-sm font-black text-slate-900">{formatValue(getHeaderValue(headerValues, 'vendor_name') || selectedFile?.summaryFields?.vendor_name)}</p></div>
            <div className="rounded-2xl bg-slate-50 p-3"><p className="text-[11px] font-black text-slate-400">사용일자</p><p className="mt-1 text-sm font-black text-slate-900">{formatDate(getHeaderValue(headerValues, 'expense_date') || selectedFile?.summaryFields?.expense_date)}</p></div>
            <div className="rounded-2xl bg-slate-50 p-3"><p className="text-[11px] font-black text-slate-400">총액</p><p className="mt-1 text-sm font-black text-slate-900">{formatMoney(receiptTotal || selectedFile?.summaryFields?.total_amount)}</p></div>
          </div>

          <ResponsiveReceiptImageViewer
            imageUrl={selectedImageUrl}
            fileName={selectedFile?.originalFileName}
            zoom={zoom}
            setZoom={setZoom}
            rotation={rotation}
            setRotation={setRotation}
            modalOpen={imageModalOpen}
            setModalOpen={setImageModalOpen}
            className="mt-4 xl:h-[calc(100%-168px)]"
          />
        </main>

        <aside className="flex min-w-0 flex-col overflow-hidden rounded-3xl bg-white shadow-sm ring-1 ring-slate-200 xl:col-span-2 2xl:sticky 2xl:top-4 2xl:col-span-1 2xl:max-h-[calc(100vh-124px)]">
          <div className="border-b border-slate-100 p-4">
            <div className="flex items-center justify-between gap-3">
              <div>
                <h3 className="text-sm font-black text-slate-950">선택 파일 처리</h3>
                <p className="mt-1 text-xs font-bold text-slate-400">저장·보완요청·확정/엑셀생성을 처리합니다.</p>
              </div>
              <FiEdit3 className="text-slate-400" />
            </div>

            <div className="mt-4 rounded-3xl bg-slate-50 p-3 ring-1 ring-slate-100">
              <div className="flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-[11px] font-black text-slate-400">현재 선택 파일</p>
                  <p className="mt-1 truncate text-sm font-black text-slate-900">{formatValue(selectedFile?.originalFileName)}</p>
                </div>
                <StatusBadge status={selectedFile?.status} />
              </div>
              <div className="mt-3 grid grid-cols-2 gap-2">
                <button type="button" onClick={() => saveSelectedFile()} disabled={saving || !selectedFile} className="inline-flex h-11 items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-white px-3 text-xs font-extrabold text-slate-700 hover:bg-slate-50 disabled:opacity-50"><FiSave />임시저장</button>
                <button type="button" onClick={requestSupplementForSelected} disabled={saving || !selectedFile} className="inline-flex h-11 items-center justify-center gap-2 rounded-2xl bg-rose-50 px-3 text-xs font-extrabold text-rose-700 ring-1 ring-rose-100 hover:bg-rose-100 disabled:opacity-50"><FiAlertCircle />보완요청</button>
                <button type="button" onClick={completeSelectedFileAndGenerate} disabled={saving || !canConfirmSelected} className="col-span-2 inline-flex min-h-12 items-center justify-center gap-2 rounded-2xl bg-slate-950 px-4 py-3 text-center text-sm font-extrabold leading-tight text-white shadow-sm hover:bg-blue-600 disabled:cursor-not-allowed disabled:bg-slate-300 disabled:text-slate-500"><FiDownload />확정하고 엑셀 생성</button>
                {confirmDisabledReason && (
                  <p className="col-span-2 rounded-2xl bg-amber-50 px-3 py-2 text-[11px] font-bold leading-5 text-amber-700 ring-1 ring-amber-100">
                    {confirmDisabledReason}
                  </p>
                )}
                <button type="button" onClick={() => navigate('/generated')} className="col-span-2 inline-flex min-h-10 items-center justify-center gap-2 rounded-2xl bg-blue-50 px-4 py-2 text-center text-xs font-extrabold leading-tight text-blue-700 ring-1 ring-blue-100 hover:bg-blue-100"><FiFileText />생성 문서 목록 보기</button>
              </div>
              {lastGenerated?.fileName && (
                <div className="mt-3 rounded-2xl bg-emerald-50 p-3 text-xs font-bold leading-5 text-emerald-700 ring-1 ring-emerald-100">
                  최근 생성: <span className="font-black">{lastGenerated.fileName}</span>
                </div>
              )}
            </div>

            <div className="mt-4 grid grid-cols-3 gap-2 rounded-2xl bg-slate-100 p-1">
              <button type="button" onClick={() => setTab('basic')} className={`h-10 rounded-xl text-xs font-black ${tab === 'basic' ? 'bg-white text-slate-950 shadow-sm' : 'text-slate-500'}`}>기본정보</button>
              <button type="button" onClick={() => setTab('items')} className={`h-10 rounded-xl text-xs font-black ${tab === 'items' ? 'bg-white text-slate-950 shadow-sm' : 'text-slate-500'}`}>상세품목</button>
              <button type="button" onClick={() => setTab('checks')} className={`h-10 rounded-xl text-xs font-black ${tab === 'checks' ? 'bg-white text-slate-950 shadow-sm' : 'text-slate-500'}`}>검증결과</button>
            </div>
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto p-4 pb-6">
            {tab === 'basic' && (
              <div className="grid gap-3 sm:grid-cols-2 2xl:grid-cols-1">
                {headerValues.map(renderHeaderInput)}
              </div>
            )}

            {tab === 'items' && (
              <div className="space-y-4">
                <div className="grid gap-3 sm:grid-cols-3 2xl:grid-cols-1">
                  <div className="rounded-2xl bg-slate-50 p-3"><p className="text-[11px] font-black text-slate-400">상세합계</p><p className="mt-1 text-base font-black text-slate-900">{formatMoney(detailTotal)}</p></div>
                  <div className="rounded-2xl bg-slate-50 p-3"><p className="text-[11px] font-black text-slate-400">영수증총액</p><p className="mt-1 text-base font-black text-slate-900">{formatMoney(receiptTotal)}</p></div>
                  <div className={`rounded-2xl p-3 ${amountDiff === 0 ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700'}`}><p className="text-[11px] font-black opacity-70">차이</p><p className="mt-1 text-base font-black">{formatMoney(amountDiff)}</p></div>
                </div>

                {hasCandidateItems && (
                  <div className="rounded-2xl border border-amber-200 bg-amber-50 p-3 text-xs font-bold leading-5 text-amber-700">
                    현재 상세품목에는 자동 확정값이 아닌 검토 후보가 포함되어 있습니다. 원본과 금액을 확인한 뒤 저장·확정하세요.
                  </div>
                )}

                <button type="button" onClick={addDetailItem} className="inline-flex h-10 items-center gap-2 rounded-2xl bg-slate-950 px-4 text-xs font-extrabold text-white hover:bg-blue-600"><FiPlus />행 추가</button>

                <div className="space-y-3">
                  {detailItems.length === 0 ? (
                    <div className="rounded-3xl bg-slate-50 p-8 text-center text-sm font-bold text-slate-400">추출된 상세품목이 없습니다. 행 추가로 직접 입력할 수 있습니다.</div>
                  ) : (
                    detailItems.map((item, index) => (
                      <div key={`${item.rowIndex}-${index}`} className="rounded-3xl border border-slate-200 bg-white p-3 shadow-sm">
                        <div className="mb-3 flex items-center justify-between gap-2">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-black text-slate-600">{index + 1}번 품목</span>
                            {(item.isCandidate || item.extractionSource === 'AI_CANDIDATE') && (
                              <span className="rounded-full bg-amber-50 px-3 py-1 text-[11px] font-black text-amber-700 ring-1 ring-amber-200">검토 후보</span>
                            )}
                          </div>
                          <button type="button" onClick={() => removeDetailItem(index)} className="inline-flex h-8 items-center gap-1 rounded-xl bg-red-50 px-3 text-xs font-black text-red-600 hover:bg-red-100"><FiTrash2 />삭제</button>
                        </div>
                        <div className="grid gap-2 sm:grid-cols-2">
                          <input value={item.item_name} onChange={(e) => updateDetailItem(index, 'item_name', e.target.value)} placeholder="품목명" className="h-10 rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm font-bold outline-none focus:border-blue-400 focus:bg-white focus:ring-4 focus:ring-blue-50" />
                          <input value={item.description} onChange={(e) => updateDetailItem(index, 'description', e.target.value)} placeholder="설명/적요" className="h-10 rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm font-bold outline-none focus:border-blue-400 focus:bg-white focus:ring-4 focus:ring-blue-50" />
                          <input value={item.quantity} onChange={(e) => updateDetailItem(index, 'quantity', e.target.value)} placeholder="수량" className="h-10 rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm font-bold outline-none focus:border-blue-400 focus:bg-white focus:ring-4 focus:ring-blue-50" />
                          <input value={item.unit_price} onChange={(e) => updateDetailItem(index, 'unit_price', e.target.value)} placeholder="단가" className="h-10 rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm font-bold outline-none focus:border-blue-400 focus:bg-white focus:ring-4 focus:ring-blue-50" />
                          <input value={item.amount} onChange={(e) => updateDetailItem(index, 'amount', e.target.value)} placeholder="금액" className="h-10 rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm font-bold outline-none focus:border-blue-400 focus:bg-white focus:ring-4 focus:ring-blue-50" />
                          <input value={item.note} onChange={(e) => updateDetailItem(index, 'note', e.target.value)} placeholder="비고" className="h-10 rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm font-bold outline-none focus:border-blue-400 focus:bg-white focus:ring-4 focus:ring-blue-50" />
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}

            {tab === 'checks' && (
              <div className="space-y-3">
                {selectedFile?.validationResults?.length > 0 ? (
                  selectedFile.validationResults.map((item) => (
                    <div key={item.validationResultId} className={`rounded-2xl border p-4 ${item.isResolved ? 'border-emerald-100 bg-emerald-50' : item.severity === 'ERROR' ? 'border-red-200 bg-red-50' : 'border-amber-200 bg-amber-50'}`}>
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="break-words text-sm font-black text-slate-900">{formatValue(item.ruleName || item.ruleCode || item.fieldKey)}</p>
                          <p className="mt-1 break-words text-xs font-bold leading-5 text-slate-600">{formatValue(item.message)}</p>
                        </div>
                        <span className="rounded-full bg-white px-2.5 py-1 text-[11px] font-black text-slate-500 ring-1 ring-slate-200">{item.isResolved ? '해결' : item.severity || 'WARNING'}</span>
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="rounded-3xl bg-emerald-50 p-8 text-center text-sm font-bold text-emerald-700"><FiCheckCircle className="mx-auto mb-3 text-3xl" />표시할 검증 오류가 없습니다.</div>
                )}              </div>
            )}
          </div>
        </aside>
      </section>

    </div>
  );
};

export default BatchReviewConfirmPage;
