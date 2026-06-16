import apiClient from './axios';

export const aiApi = {
  /**
   * OCR/LLM 처리 요청
   * POST /api/ai/source-files/{sourceFileId}/process
   */
  processSourceFile: async (sourceFileId) => {
    const response = await apiClient.post(`/ai/source-files/${sourceFileId}/process`);
    return response.data;
  },

  /**
   * AI 추출 결과 조회
   * GET /api/ai/source-files/{sourceFileId}/extracted-values
   */
  getExtractedValues: async (sourceFileId) => {
    const response = await apiClient.get(
      `/ai/source-files/${sourceFileId}/extracted-values`
    );

    return response.data;
  },

  /**
   * OCR 원문 및 AI JSON 조회
   * GET /api/ai/source-files/{sourceFileId}/raw-result
   */
  getRawResult: async (sourceFileId) => {
    const response = await apiClient.get(`/ai/source-files/${sourceFileId}/raw-result`);
    return response.data;
  },
};