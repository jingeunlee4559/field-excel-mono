import apiClient from './axios';

const buildCleanParams = (params = {}) => {
  const cleanParams = {};

  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== '') {
      cleanParams[key] = value;
    }
  });

  return cleanParams;
};

export const reviewApi = {
  /**
   * 배치 목록 조회
   * GET /api/reviews/batches?page=1&size=20&status=NEED_REVIEW&keyword=...
   */
  getReviewBatches: async ({
    status = '',
    keyword = '',
    page = 1,
    size = 20,
    urgency = '',
    deadlineStatus = '',
    scoreBucket = '',
    settlementStatus = '',
    dateType = 'uploaded',
    datePreset = '',
    dateFrom = '',
    dateTo = '',
    sort = 'urgency_desc',
    sortBy = 'urgency',
    sortOrder = 'desc',
  } = {}) => {
    const response = await apiClient.get('/reviews/batches', {
      params: buildCleanParams({
        status,
        keyword,
        page,
        size,
        urgency,
        deadlineStatus,
        scoreBucket,
        settlementStatus,
        dateType,
        datePreset,
        dateFrom,
        dateTo,
        sort,
        sortBy,
        sortOrder,
      }),
    });

    return response.data;
  },

  /**
   * 배치 상세 검토 조회
   * GET /api/reviews/batches/{batchId}
   */
  getReviewBatchDetail: async (batchId) => {
    const response = await apiClient.get(`/reviews/batches/${batchId}`);
    return response.data;
  },

  /**
   * 배치 전체 최종확정
   * POST /api/reviews/batches/{batchId}/complete
   */
  completeReviewBatch: async (batchId) => {
    const response = await apiClient.post(`/reviews/batches/${batchId}/complete`);
    return response.data;
  },



  /**
   * 배치 기준 경비청구서 엑셀 생성
   * POST /api/excel/batches/{batchId}/generate
   */
  generateExcelForBatch: async (batchId) => {
    const response = await apiClient.post(`/excel/batches/${batchId}/generate`);
    return response.data;
  },

  /**
   * 원본 파일 1건 기준 경비청구서 엑셀 생성
   * POST /api/excel/source-files/{sourceFileId}/generate
   */
  generateExcelFromSourceFile: async (sourceFileId) => {
    const response = await apiClient.post(`/excel/source-files/${sourceFileId}/generate`);
    return response.data;
  },

  /**
   * 검토 목록 조회
   * GET /api/reviews/required?page=1&size=20
   */
  getRequiredReviews: async ({
    status = '',
    keyword = '',
    page = 1,
    size = 20,
    urgency = '',
    deadlineStatus = '',
    scoreBucket = '',
    settlementStatus = '',
    dateType = 'uploaded',
    datePreset = '',
    dateFrom = '',
    dateTo = '',
    sort = 'urgency_desc',
    sortBy = 'urgency',
    sortOrder = 'desc',
  } = {}) => {
    const response = await apiClient.get('/reviews/required', {
      params: buildCleanParams({
        status,
        keyword,
        page,
        size,
        urgency,
        deadlineStatus,
        scoreBucket,
        settlementStatus,
        dateType,
        datePreset,
        dateFrom,
        dateTo,
        sort,
        sortBy,
        sortOrder,
      }),
    });

    return response.data;
  },

  /**
   * 보완 필요 목록 조회
   * GET /api/reviews/supplements
   */
  getSupplementRequiredList: async ({ page = 1, size = 20 } = {}) => {
    const response = await apiClient.get('/reviews/supplements', {
      params: buildCleanParams({
        page,
        size,
      }),
    });

    return response.data;
  },

  /**
   * 검토 상세 조회
   * GET /api/reviews/source-files/{sourceFileId}
   */
  getReviewDetail: async (sourceFileId) => {
    const response = await apiClient.get(
      `/reviews/source-files/${sourceFileId}`
    );

    return response.data;
  },

  /**
   * 추출값 수정
   * PATCH /api/reviews/extracted-values/{extractedValueId}
   */
  updateExtractedValue: async ({ extractedValueId, finalValue }) => {
    const response = await apiClient.patch(
      `/reviews/extracted-values/${extractedValueId}`,
      {
        finalValue,
      }
    );

    return response.data;
  },

  /**
   * 여러 추출값 일괄 수정
   * PATCH /api/reviews/source-files/{sourceFileId}/extracted-values
   */
  updateExtractedValuesBulk: async ({ sourceFileId, values }) => {
    const response = await apiClient.patch(
      `/reviews/source-files/${sourceFileId}/extracted-values`,
      {
        values,
      }
    );

    return response.data;
  },

  /**
   * 상세 품목 행 저장
   * PATCH /api/reviews/source-files/{sourceFileId}/detail-items
   */
  syncDetailItems: async ({ sourceFileId, items }) => {
    const response = await apiClient.patch(
      `/reviews/source-files/${sourceFileId}/detail-items`,
      {
        items,
      }
    );

    return response.data;
  },

  /**
   * 수정 완료 후 재검증 요청
   * POST /api/reviews/source-files/{sourceFileId}/revalidate
   */
  revalidateSourceFile: async (sourceFileId) => {
    const response = await apiClient.post(
      `/reviews/source-files/${sourceFileId}/revalidate`
    );

    return response.data;
  },

  /**
   * 검토 완료 처리
   * POST /api/reviews/source-files/{sourceFileId}/complete
   */
  completeReview: async (sourceFileId) => {
    const response = await apiClient.post(
      `/reviews/source-files/${sourceFileId}/complete`
    );

    return response.data;
  },

  /**
   * 증빙 제출자에게 보완 요청
   * POST /api/reviews/source-files/{sourceFileId}/request-supplement
   */
  requestSupplement: async ({ sourceFileId, reason }) => {
    const response = await apiClient.post(
      `/reviews/source-files/${sourceFileId}/request-supplement`,
      {
        reason,
      }
    );

    return response.data;
  },
};

export default reviewApi;
