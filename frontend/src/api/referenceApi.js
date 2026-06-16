import apiClient from './axios';

export const referenceApi = {
  /**
   * 표준 필드 목록 조회
   * GET /api/reference/standard-fields
   */
  getStandardFields: async ({
    fieldScope,
    isActive = true,
    documentType,
    includeAdvanced = false,
    mappingType,
  } = {}) => {
    const response = await apiClient.get('/reference/standard-fields', {
      params: {
        fieldScope,
        isActive,
        documentType,
        includeAdvanced,
        mappingType,
      },
    });

    return response.data;
  },

  /**
   * 자료유형별 표준 필드 조회
   * GET /api/reference/document-type-fields
   */
  getDocumentTypeFields: async ({
    documentType,
    includeAdvanced = false,
    mappingType,
  } = {}) => {
    const response = await apiClient.get('/reference/document-type-fields', {
      params: {
        documentType,
        includeAdvanced,
        mappingType,
      },
    });

    return response.data;
  },

  /**
   * 경비 항목 목록 조회
   * GET /api/reference/expense-categories
   */
  getExpenseCategories: async ({ isActive = true } = {}) => {
    const response = await apiClient.get('/reference/expense-categories', {
      params: {
        isActive,
      },
    });

    return response.data;
  },

  /**
   * 검증 규칙 목록 조회
   * GET /api/reference/validation-rules
   */
  getValidationRules: async ({ ruleType, isActive = true } = {}) => {
    const response = await apiClient.get('/reference/validation-rules', {
      params: {
        ruleType,
        isActive,
      },
    });

    return response.data;
  },

  getDepartments: async () => {
    const response = await apiClient.get('/reference/departments');
    return response.data;
  },

  getSites: async () => {
    const response = await apiClient.get('/reference/sites');
    return response.data;
  },
};

export default referenceApi;
