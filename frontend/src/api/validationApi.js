import apiClient from './axios';

export const validationApi = {
  /**
   * 자동 검증 실행
   * POST /api/validation/source-files/{sourceFileId}/run
   */
  runValidation: async (sourceFileId) => {
    const response = await apiClient.post(
      `/validation/source-files/${sourceFileId}/run`
    );

    return response.data;
  },

  /**
   * 검증 결과 조회
   * GET /api/validation/source-files/{sourceFileId}/results
   */
  getValidationResults: async (sourceFileId) => {
    const response = await apiClient.get(
      `/validation/source-files/${sourceFileId}/results`
    );

    return response.data;
  },
};