import apiClient from "./axios";

export const templateApi = {
  /**
   * 템플릿 목록 조회
   * GET /api/admin/templates
   */
  getTemplates: async ({ status, page = 1, size = 20 } = {}) => {
    const response = await apiClient.get("/admin/templates", {
      params: {
        status,
        page,
        size,
      },
    });

    return response.data;
  },

  /**
   * 템플릿 상세 조회
   * GET /api/admin/templates/{templateId}
   */
  getTemplateDetail: async (templateId) => {
    const response = await apiClient.get(`/admin/templates/${templateId}`);
    return response.data;
  },

  /**
   * 템플릿 등록
   * POST /api/admin/templates
   */
  createTemplate: async ({
    file,
    templateName,
    description,
    templateGroupId,
  }) => {
    const formData = new FormData();

    formData.append("file", file);
    formData.append("templateName", templateName);

    if (description) {
      formData.append("description", description);
    }

    if (templateGroupId) {
      formData.append("templateGroupId", templateGroupId);
    }

    const response = await apiClient.post("/admin/templates", formData, {
      headers: {
        "Content-Type": "multipart/form-data",
      },
    });

    return response.data;
  },

  /**
   * 템플릿 활성화
   * POST /api/admin/templates/{templateId}/activate
   */
  activateTemplate: async (templateId) => {
    const response = await apiClient.post(
      `/admin/templates/${templateId}/activate`
    );

    return response.data;
  },

  /**
   * 템플릿 보관 처리
   * POST /api/admin/templates/{templateId}/archive
   */
  archiveTemplate: async (templateId) => {
    const response = await apiClient.post(
      `/admin/templates/${templateId}/archive`
    );

    return response.data;
  },
};