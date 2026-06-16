import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { FiRefreshCw, FiUser } from 'react-icons/fi';

import { reviewApi } from '../../api';
import DashboardPageHeader from '../../components/dashboard/common/DashboardPageHeader';
import ReviewSummaryCards from '../../components/dashboard/ReviewListPage/ReviewSummaryCards';
import ReviewToolbar from '../../components/dashboard/ReviewListPage/ReviewToolbar';
import ReviewScoreLegend from '../../components/dashboard/ReviewListPage/ReviewScoreLegend';
import ReviewPagination from '../../components/dashboard/ReviewListPage/ReviewPagination';
import {
  DesktopList,
  MobileList,
  SectionHeader,
} from '../../components/dashboard/ReviewListPage/ReviewListContent';
import { PAGE_SIZE } from '../../components/dashboard/ReviewListPage/reviewList.constants.js';
import { alertError } from '../../utils/swal';

const REVIEW_HEADER_BADGES = [
  { label: '오늘 마감', className: 'rounded-2xl bg-red-500/15 px-3 py-2 text-red-100 ring-1 ring-red-400/20' },
  { label: '3일 이내', className: 'rounded-2xl bg-amber-500/15 px-3 py-2 text-amber-100 ring-1 ring-amber-400/20' },
  { label: '보완 필요', className: 'rounded-2xl bg-rose-500/15 px-3 py-2 text-rose-100 ring-1 ring-rose-400/20' },
  { label: '미결제', className: 'rounded-2xl bg-blue-500/15 px-3 py-2 text-blue-100 ring-1 ring-blue-400/20' },
];

const DEFAULT_STATUS_COUNTS = {
  all: 0,
  needReview: 0,
  needSupplement: 0,
  normal: 0,
  confirmed: 0,
  failed: 0,
  processing: 0,
  avgConfidencePercent: null,
};

const ReviewListPage = () => {
  const navigate = useNavigate();

  const [viewMode, setViewMode] = useState('batch');
  const [status, setStatus] = useState('');
  const [keyword, setKeyword] = useState('');
  const [urgency, setUrgency] = useState('');
  const [deadlineStatus, setDeadlineStatus] = useState('');
  const [scoreBucket, setScoreBucket] = useState('');
  const [settlementStatus, setSettlementStatus] = useState('');
  const [dateType, setDateType] = useState('uploaded');
  const [datePreset, setDatePreset] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [sortBy, setSortBy] = useState('urgency');
  const [sortOrder, setSortOrder] = useState('desc');

  const [batchItems, setBatchItems] = useState([]);
  const [fileItems, setFileItems] = useState([]);
  const [statusCounts, setStatusCounts] = useState(DEFAULT_STATUS_COUNTS);
  const [loading, setLoading] = useState(false);
  const [pageInfo, setPageInfo] = useState({ page: 1, size: PAGE_SIZE, total: 0 });

  const totalPages = Math.max(1, Math.ceil(Number(pageInfo.total || 0) / Number(pageInfo.size || PAGE_SIZE)));
  const visibleItems = viewMode === 'batch' ? batchItems : fileItems;

  const summary = useMemo(() => ({
    total: statusCounts.all || 0,
    needReview: statusCounts.needReview || 0,
    supplement: statusCounts.needSupplement || 0,
    normal: statusCounts.normal || 0,
    confirmed: statusCounts.confirmed || 0,
    failed: statusCounts.failed || 0,
  }), [statusCounts]);

  const makeParams = ({
    nextPage = pageInfo.page,
    nextStatus = status,
    nextKeyword = keyword,
    nextUrgency = urgency,
    nextDeadlineStatus = deadlineStatus,
    nextScoreBucket = scoreBucket,
    nextSettlementStatus = settlementStatus,
    nextDateType = dateType,
    nextDatePreset = datePreset,
    nextDateFrom = dateFrom,
    nextDateTo = dateTo,
    nextSortBy = sortBy,
    nextSortOrder = sortOrder,
  } = {}) => ({
    status: nextStatus,
    keyword: nextKeyword,
    page: nextPage,
    size: PAGE_SIZE,
    urgency: nextUrgency,
    deadlineStatus: nextDeadlineStatus,
    scoreBucket: nextScoreBucket,
    settlementStatus: nextSettlementStatus,
    dateType: nextDateType,
    datePreset: nextDatePreset,
    dateFrom: nextDatePreset === 'CUSTOM' ? nextDateFrom : '',
    dateTo: nextDatePreset === 'CUSTOM' ? nextDateTo : '',
    sortBy: nextSortBy,
    sortOrder: nextSortOrder,
    sort: `${nextSortBy}_${nextSortOrder}`,
  });

  const loadData = async ({ nextViewMode = viewMode, ...rest } = {}) => {
    try {
      setLoading(true);
      const params = makeParams(rest);

      if (nextViewMode === 'batch') {
        const response = await reviewApi.getReviewBatches(params);
        setBatchItems(response.items || []);
        setPageInfo({ page: response.page || params.page, size: response.size || PAGE_SIZE, total: response.total || 0 });
        setStatusCounts(response.statusCounts || DEFAULT_STATUS_COUNTS);
        return;
      }

      const response = await reviewApi.getRequiredReviews(params);
      const counts = response.statusCounts || {};
      setFileItems(response.items || []);
      setPageInfo({ page: response.page || params.page, size: response.size || PAGE_SIZE, total: response.total || 0 });
      setStatusCounts({ ...counts, processing: counts.extracting || counts.processing || 0 });
    } catch (error) {
      console.error('검토 현황 조회 실패:', error);
      await alertError('조회 실패', error.response?.data?.message || '검토 현황을 불러오지 못했습니다.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData({ nextPage: 1, nextStatus: '', nextKeyword: '', nextViewMode: 'batch' });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const timerId = window.setInterval(() => {
      loadData({
        nextPage: pageInfo.page,
        nextStatus: status,
        nextKeyword: keyword,
        nextViewMode: viewMode,
        nextUrgency: urgency,
        nextDeadlineStatus: deadlineStatus,
        nextScoreBucket: scoreBucket,
        nextSettlementStatus: settlementStatus,
        nextDateType: dateType,
        nextDatePreset: datePreset,
        nextDateFrom: dateFrom,
        nextDateTo: dateTo,
        nextSortBy: sortBy,
        nextSortOrder: sortOrder,
      });
    }, 10000);

    return () => window.clearInterval(timerId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pageInfo.page, status, keyword, viewMode, urgency, deadlineStatus, scoreBucket, settlementStatus, dateType, datePreset, dateFrom, dateTo, sortBy, sortOrder]);

  const getCurrentQuery = (overrides = {}) => ({
    nextPage: overrides.nextPage ?? 1,
    nextStatus: overrides.nextStatus ?? status,
    nextKeyword: overrides.nextKeyword ?? keyword,
    nextViewMode: overrides.nextViewMode ?? viewMode,
    nextUrgency: overrides.nextUrgency ?? urgency,
    nextDeadlineStatus: overrides.nextDeadlineStatus ?? deadlineStatus,
    nextScoreBucket: overrides.nextScoreBucket ?? scoreBucket,
    nextSettlementStatus: overrides.nextSettlementStatus ?? settlementStatus,
    nextDateType: overrides.nextDateType ?? dateType,
    nextDatePreset: overrides.nextDatePreset ?? datePreset,
    nextDateFrom: overrides.nextDateFrom ?? dateFrom,
    nextDateTo: overrides.nextDateTo ?? dateTo,
    nextSortBy: overrides.nextSortBy ?? sortBy,
    nextSortOrder: overrides.nextSortOrder ?? sortOrder,
  });

  const handleStatusChange = (nextStatus) => {
    setStatus(nextStatus);
    setPageInfo((prev) => ({ ...prev, page: 1 }));
    loadData(getCurrentQuery({ nextStatus }));
  };

  const handleFilterChange = (key, value) => {
    const next = getCurrentQuery();

    if (key === 'urgency') { setUrgency(value); next.nextUrgency = value; }
    if (key === 'deadlineStatus') { setDeadlineStatus(value); next.nextDeadlineStatus = value; }
    if (key === 'scoreBucket') { setScoreBucket(value); next.nextScoreBucket = value; }
    if (key === 'settlementStatus') { setSettlementStatus(value); next.nextSettlementStatus = value; }
    if (key === 'dateType') { setDateType(value); next.nextDateType = value; }
    if (key === 'sortBy') { setSortBy(value); next.nextSortBy = value; }
    if (key === 'sortOrder') { setSortOrder(value); next.nextSortOrder = value; }
    if (key === 'datePreset') {
      setDatePreset(value);
      next.nextDatePreset = value;
      if (value !== 'CUSTOM') {
        setDateFrom('');
        setDateTo('');
        next.nextDateFrom = '';
        next.nextDateTo = '';
      }
    }

    setPageInfo((prev) => ({ ...prev, page: 1 }));
    loadData(next);
  };

  const handleDateRangeChange = (key, value) => {
    const nextDateFrom = key === 'dateFrom' ? value : dateFrom;
    const nextDateTo = key === 'dateTo' ? value : dateTo;

    if (key === 'dateFrom') setDateFrom(value);
    if (key === 'dateTo') setDateTo(value);

    setPageInfo((prev) => ({ ...prev, page: 1 }));
    loadData(getCurrentQuery({ nextDateFrom, nextDateTo }));
  };

  const handleSearch = (event) => {
    event.preventDefault();
    setPageInfo((prev) => ({ ...prev, page: 1 }));
    loadData(getCurrentQuery());
  };

  const handleViewChange = (nextViewMode) => {
    setViewMode(nextViewMode);
    setPageInfo((prev) => ({ ...prev, page: 1 }));
    loadData(getCurrentQuery({ nextViewMode }));
  };

  const handlePrevPage = () => loadData(getCurrentQuery({ nextPage: Math.max(1, pageInfo.page - 1) }));
  const handleNextPage = () => loadData(getCurrentQuery({ nextPage: Math.min(totalPages, pageInfo.page + 1) }));
  const handleRefresh = () => loadData(getCurrentQuery({ nextPage: pageInfo.page }));
  const handleOpenBatch = (batchId) => { if (batchId) navigate(`/reviews/batches/${batchId}`); };

  return (
    <div className="space-y-5 pb-16 lg:pb-0">
      <DashboardPageHeader
        eyebrow="관리팀 사용자"
        eyebrowIcon={FiUser}
        title="자료 검토 현황"
        description="날짜별·미결제 기준으로 먼저 처리할 항목을 빠르게 확인합니다."
        badges={REVIEW_HEADER_BADGES}
        actions={(
          <button
            type="button"
            onClick={handleRefresh}
            disabled={loading}
            className="inline-flex h-11 shrink-0 items-center justify-center gap-2 rounded-2xl bg-white px-4 text-sm font-black text-slate-950 transition hover:bg-blue-50 disabled:cursor-not-allowed disabled:bg-slate-300"
          >
            <FiRefreshCw className={loading ? 'animate-spin' : ''} />
            새로고침
          </button>
        )}
      />

      <ReviewSummaryCards summary={summary} status={status} onStatusChange={handleStatusChange} />

      <section className="rounded-[28px] bg-white p-4 shadow-sm ring-1 ring-slate-200 sm:p-5">
        <ReviewToolbar
          viewMode={viewMode}
          onViewChange={handleViewChange}
          keyword={keyword}
          onKeywordChange={setKeyword}
          status={status}
          onStatusChange={handleStatusChange}
          urgency={urgency}
          onUrgencyChange={(value) => handleFilterChange('urgency', value)}
          deadlineStatus={deadlineStatus}
          onDeadlineStatusChange={(value) => handleFilterChange('deadlineStatus', value)}
          scoreBucket={scoreBucket}
          onScoreBucketChange={(value) => handleFilterChange('scoreBucket', value)}
          settlementStatus={settlementStatus}
          onSettlementStatusChange={(value) => handleFilterChange('settlementStatus', value)}
          dateType={dateType}
          onDateTypeChange={(value) => handleFilterChange('dateType', value)}
          datePreset={datePreset}
          onDatePresetChange={(value) => handleFilterChange('datePreset', value)}
          dateFrom={dateFrom}
          onDateFromChange={(value) => handleDateRangeChange('dateFrom', value)}
          dateTo={dateTo}
          onDateToChange={(value) => handleDateRangeChange('dateTo', value)}
          sortBy={sortBy}
          onSortByChange={(value) => handleFilterChange('sortBy', value)}
          sortOrder={sortOrder}
          onSortOrderChange={(value) => handleFilterChange('sortOrder', value)}
          onSearch={handleSearch}
        />

        <div className="mt-4"><ReviewScoreLegend /></div>

        <div className="mt-5">
          <SectionHeader viewMode={viewMode} total={pageInfo.total} avgScore={statusCounts.avgConfidencePercent} sortBy={sortBy} sortOrder={sortOrder} />
          <DesktopList viewMode={viewMode} items={visibleItems} loading={loading} onOpen={handleOpenBatch} />
          <MobileList viewMode={viewMode} items={visibleItems} loading={loading} onOpen={handleOpenBatch} />
        </div>

        <ReviewPagination
          loading={loading}
          pageInfo={pageInfo}
          totalPages={totalPages}
          onPrevPage={handlePrevPage}
          onNextPage={handleNextPage}
        />
      </section>
    </div>
  );
};

export default ReviewListPage;
