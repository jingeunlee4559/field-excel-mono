import apiClient from './axios';

export const correctionApi = {
  /**
   * 보정 사전 목록 조회
   * GET /api/admin/corrections
   */
  getCorrections: async ({
    dictionaryType,
    status,
    activeYn,
    q,
    page = 1,
    size = 50,
  } = {}) => {
    const response = await apiClient.get('/admin/corrections', {
      params: {
        dictionaryType,
        status,
        activeYn,
        q,
        page,
        size,
      },
    });

    return response.data;
  },

  /**
   * 보정 사전 후보/규칙 추가
   * POST /api/admin/corrections
   */
  createCorrection: async (payload) => {
    const response = await apiClient.post('/admin/corrections', payload);
    return response.data;
  },

  /**
   * 보정 사전 수정
   * PATCH /api/admin/corrections/:id
   */
  updateCorrection: async (id, payload) => {
    const response = await apiClient.patch(`/admin/corrections/${id}`, payload);
    return response.data;
  },

  /**
   * 보정 후보 승인
   * POST /api/admin/corrections/:id/approve
   */
  approveCorrection: async (id) => {
    const response = await apiClient.post(`/admin/corrections/${id}/approve`);
    return response.data;
  },

  /**
   * 보정 규칙 비활성화
   * POST /api/admin/corrections/:id/disable
   */
  disableCorrection: async (id) => {
    const response = await apiClient.post(`/admin/corrections/${id}/disable`);
    return response.data;
  },
};

export default correctionApi;
