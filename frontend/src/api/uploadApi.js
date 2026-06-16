import apiClient from './axios';

export const uploadApi = {
  /**
   * 경비 증빙자료 업로드
   * POST /api/uploads/receipts
   */
  uploadReceipts: async ({
    files,
    title,
    templateId,
    departmentId,
    siteId,
    documentType,
    autoProcess = true,
  }) => {
    const formData = new FormData();

    files.forEach((file) => {
      formData.append('files', file);
    });

    if (title) {
      formData.append('title', title);
    }

    if (templateId) {
      formData.append('templateId', templateId);
    }

    if (departmentId) {
      formData.append('departmentId', departmentId);
    }

    if (siteId) {
      formData.append('siteId', siteId);
    }

    if (documentType) {
      formData.append('documentType', documentType);
    }

    formData.append('autoProcess', autoProcess ? 'true' : 'false');

    const response = await apiClient.post('/uploads/receipts', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });

    return response.data;
  },

  /**
   * 내 업로드 배치 목록 조회
   * GET /api/uploads/my-batches
   */
  getMyBatches: async ({ status, page = 1, size = 20 } = {}) => {
    const response = await apiClient.get('/uploads/my-batches', {
      params: {
        status,
        page,
        size,
      },
    });

    return response.data;
  },

  /**
   * 내 보완 요청 목록 조회
   * GET /api/uploads/my-supplements
   */
  getMySupplements: async ({ page = 1, size = 20 } = {}) => {
    const response = await apiClient.get('/uploads/my-supplements', {
      params: { page, size },
    });

    return response.data;
  },

  /**
   * 업로드 배치 상세 조회
   * GET /api/uploads/batches/{batchId}
   */
  getBatchDetail: async (batchId) => {
    const response = await apiClient.get(`/uploads/batches/${batchId}`);
    return response.data;
  },

  /**
   * 보완자료 재업로드
   * POST /api/uploads/source-files/{sourceFileId}/supplement
   */
  uploadSupplementFile: async ({ sourceFileId, file }) => {
    const formData = new FormData();

    formData.append('file', file);

    const response = await apiClient.post(
      `/uploads/source-files/${sourceFileId}/supplement`,
      formData,
      {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      }
    );

    return response.data;
  },
};