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

import { reviewApi } from '../../../api';
import { alertError, alertSuccess, alertWarning, confirmSave } from '../../../utils/swal';
import BatchCountSummary from './BatchCountSummary';
import BatchReviewHeader from './BatchReviewHeader';

export const API_ORIGIN =
  import.meta.env.VITE_API_ORIGIN ||
  (import.meta.env.VITE_API_BASE_URL || 'http://localhost:8080/api').replace(/\/api\/?$/, '');

export const PROCESSING_STATUSES = [
  'UPLOADED',
  'QUEUED',
  'EXTRACTING',
  'OCR_PROCESSING',
  'AI_PROCESSING',
  'PROCESSING',
  'CANDIDATE_CREATED',
];

export const STATUS_META = {
  PROCESSING: { label: 'AI 처리 중', icon: FiZap, badge: 'bg-blue-50 text-blue-700 ring-blue-100', card: 'border-blue-200 bg-blue-50/60' },
  QUEUED: { label: 'AI 대기', icon: FiClock, badge: 'bg-sky-50 text-sky-700 ring-sky-100', card: 'border-sky-200 bg-sky-50/60' },
  UPLOADED: { label: '업로드 접수', icon: FiClock, badge: 'bg-slate-50 text-slate-600 ring-slate-100', card: 'border-slate-200 bg-slate-50' },
  EXTRACTING: { label: 'AI 처리 중', icon: FiZap, badge: 'bg-blue-50 text-blue-700 ring-blue-100', card: 'border-blue-200 bg-blue-50/60' },
  OCR_PROCESSING: { label: 'OCR 처리 중', icon: FiClock, badge: 'bg-blue-50 text-blue-700 ring-blue-100', card: 'border-blue-200 bg-blue-50/60' },
  AI_PROCESSING: { label: 'AI 처리 중', icon: FiZap, badge: 'bg-indigo-50 text-indigo-700 ring-indigo-100', card: 'border-indigo-200 bg-indigo-50/60' },
  NEED_REVIEW: { label: '검토 필요', icon: FiAlertTriangle, badge: 'bg-amber-50 text-amber-700 ring-amber-100', card: 'border-amber-300 bg-amber-50/70' },
  NEED_SUPPLEMENT: { label: '보완 필요', icon: FiAlertCircle, badge: 'bg-rose-50 text-rose-700 ring-rose-100', card: 'border-rose-300 bg-rose-50/70' },
  NORMAL: { label: '확정 가능', icon: FiCheckCircle, badge: 'bg-emerald-50 text-emerald-700 ring-emerald-100', card: 'border-emerald-300 bg-emerald-50/70' },
  CONFIRMED: { label: '확정 완료', icon: FiCheckCircle, badge: 'bg-blue-50 text-blue-700 ring-blue-100', card: 'border-blue-300 bg-blue-50/70' },
  FAILED: { label: '처리 실패', icon: FiXCircle, badge: 'bg-red-50 text-red-700 ring-red-100', card: 'border-red-300 bg-red-50/70' },
  REVIEW_COMPLETED: { label: '배치 완료', icon: FiCheckCircle, badge: 'bg-blue-50 text-blue-700 ring-blue-100', card: 'border-blue-300 bg-blue-50/70' },
  UNKNOWN: { label: '상태 미확인', icon: FiAlertCircle, badge: 'bg-slate-50 text-slate-500 ring-slate-100', card: 'border-slate-200 bg-white' },
};

export const HEADER_ORDER = [
  'expense_date',
  'vendor_name',
  'vendor_business_number',
  'business_number',
  'expense_category_name',
  'total_amount',
  'paid_amount',
  'supply_amount',
  'tax_amount',
  'payment_method',
  'card_company',
  'approval_number',
  'approval_time',
  'note',
];

export const DEFAULT_HEADER_LABELS = {
  expense_date: '사용일자',
  vendor_name: '사용처',
  vendor_business_number: '사업자번호',
  business_number: '사업자번호',
  expense_category_code: '경비분류코드',
  expense_category_name: '항목',
  total_amount: '지출총액',
  paid_amount: '결제금액',
  supply_amount: '공급가액',
  tax_amount: '부가세',
  payment_method: '결제수단',
  card_company: '카드사',
  approval_number: '승인번호',
  approval_time: '승인시각',
  note: '비고',
};

export const FIELD_INPUT_TYPES = {
  expense_date: 'date',
  total_amount: 'number',
  paid_amount: 'number',
  supply_amount: 'number',
  tax_amount: 'number',
};

export const FILE_FILTERS = [
  { value: '', label: '전체' },
  { value: 'NEED_REVIEW', label: '검토' },
  { value: 'NEED_SUPPLEMENT', label: '보완' },
  { value: 'NORMAL', label: '확정가능' },
  { value: 'CONFIRMED', label: '확정완료' },
  { value: 'FAILED', label: '실패' },
];

export const buildApiFileUrl = (relativeUrl) => {
  if (!relativeUrl) return '';
  if (relativeUrl.startsWith('http://') || relativeUrl.startsWith('https://')) return encodeURI(relativeUrl);
  const pathPart = relativeUrl.startsWith('/') ? relativeUrl : `/${relativeUrl}`;
  return encodeURI(`${API_ORIGIN}${pathPart}`);
};

export const buildFileUrl = (file) => {
  if (file?.fileUrl) return buildApiFileUrl(file.fileUrl);

  const filePath = String(file?.filePath || '').replace(/\\/g, '/');
  if (!filePath) return '';
  if (filePath.startsWith('http://') || filePath.startsWith('https://')) return encodeURI(filePath);

  const storageIndex = filePath.indexOf('app/storage/');
  if (storageIndex >= 0) {
    return buildApiFileUrl(`/ai-storage/${filePath.slice(storageIndex + 'app/storage/'.length)}`);
  }
  if (filePath.startsWith('uploads/')) return buildApiFileUrl(`/ai-storage/${filePath}`);
  if (filePath.startsWith('results/')) return buildApiFileUrl(`/results-storage/${filePath.replace(/^results\//, '')}`);
  if (filePath.startsWith('templates/')) return buildApiFileUrl(`/templates-storage/${filePath.replace(/^templates\//, '')}`);
  return buildApiFileUrl(`/uploads/${filePath.replace(/^\/+/, '')}`);
};

export const formatValue = (value) => {
  if (value === undefined || value === null || value === '') return '-';
  return String(value);
};

export const formatDate = (value) => {
  if (!value) return '-';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value).slice(0, 10);
  return date.toISOString().slice(0, 10);
};

export const parseAmount = (value) => {
  if (value === undefined || value === null || value === '') return 0;
  const text = String(value).replace(/[원,\s₩]/g, '').replace(/[^0-9.-]/g, '');
  const number = Number(text);
  return Number.isFinite(number) ? number : 0;
};

export const formatMoney = (value) => {
  const number = parseAmount(value);
  if (!Number.isFinite(number) || number === 0) return value ? String(value) : '-';
  return `${number.toLocaleString()}원`;
};

export const formatScore = (value) => {
  if (value === undefined || value === null || value === '') return '-';
  const number = Number(value);
  if (!Number.isFinite(number)) return '-';
  if (number <= 1) return `${Math.round(number * 100)}점`;
  return `${Math.round(number)}점`;
};

export const getHeaderValue = (headers, key) => {
  const found = headers.find((field) => field.fieldKey === key);
  return found?.finalValue || '';
};

export const StatusBadge = ({ status }) => {
  const meta = STATUS_META[status] || STATUS_META.UNKNOWN;
  const Icon = meta.icon;
  const processing = PROCESSING_STATUSES.includes(status);

  return (
    <span className={`inline-flex max-w-full min-w-0 items-center gap-1.5 rounded-full px-3 py-1 text-[11px] font-black leading-none ring-1 sm:text-xs ${meta.badge}`}>
      <Icon className={processing ? 'animate-pulse' : ''} />
      <span className="truncate">{meta.label}</span>
    </span>
  );
};

export const CountPill = ({ label, value, className }) => (
  <div className={`rounded-2xl px-3 py-3 sm:px-4 ${className}`}>
    <p className="text-[11px] font-black opacity-70">{label}</p>
    <p className="mt-1 text-xl font-black">{Number(value || 0)}</p>
  </div>
);

export const buildHeaderState = (file) => {
  const map = new Map();

  (file?.headerFields || []).forEach((field) => {
    if (!map.has(field.fieldKey)) {
      map.set(field.fieldKey, {
        extractedValueId: field.extractedValueId,
        fieldKey: field.fieldKey,
        fieldLabel: field.fieldLabel || field.fieldName || DEFAULT_HEADER_LABELS[field.fieldKey] || field.fieldKey,
        finalValue: field.displayValue ?? field.finalValue ?? field.normalizedValue ?? field.extractedValue ?? '',
        confidence: field.confidenceScore ?? field.confidence ?? null,
      });
    }
  });

  HEADER_ORDER.forEach((key) => {
    if (!map.has(key)) {
      map.set(key, {
        extractedValueId: null,
        fieldKey: key,
        fieldLabel: DEFAULT_HEADER_LABELS[key] || key,
        finalValue: file?.summaryFields?.[key] || '',
        confidence: null,
      });
    }
  });

  return Array.from(map.values()).sort((a, b) => {
    const ai = HEADER_ORDER.indexOf(a.fieldKey);
    const bi = HEADER_ORDER.indexOf(b.fieldKey);
    return (ai === -1 ? 999 : ai) - (bi === -1 ? 999 : bi);
  });
};

export const buildDetailState = (file) => {
  const items = Array.isArray(file?.detailItems) ? file.detailItems : [];
  return items.map((item, index) => ({
    rowIndex: index + 1,
    expense_date: item.expense_date || '',
    vendor_name: item.vendor_name || '',
    expense_category_code: item.expense_category_code || '',
    expense_category_name: item.expense_category_name || '',
    item_name: item.item_name || '',
    description: item.description || item.item_name || '',
    quantity: item.quantity || '',
    unit_price: item.unit_price || '',
    amount: item.amount || '',
    payment_method: item.payment_method || '',
    note: item.note || '',
    extractionSource: item.extractionSource || item.extraction_source || null,
    isCandidate: Boolean(item.isCandidate || item.is_candidate || item.extractionSource === 'AI_CANDIDATE' || item.extraction_source === 'AI_CANDIDATE'),
    fieldSources: item.fieldSources || item.field_sources || {},
    fieldIds: item.fieldIds || item.field_ids || {},
  }));
};

