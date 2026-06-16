import apiClient from './axios';


const isInvalidTemplateId = (templateId) => {
  return (
    templateId === undefined ||
    templateId === null ||
    templateId === "" ||
    templateId === "undefined" ||
    templateId === "null"
  );
};

const assertTemplateId = (templateId) => {
  if (isInvalidTemplateId(templateId)) {
    throw new Error("템플릿 ID가 없습니다. 템플릿을 먼저 선택하세요.");
  }
};

export const mappingApi = {
  getTemplateMappings: async (templateId) => {
    assertTemplateId(templateId);

    const response = await apiClient.get(
      `/admin/templates/${templateId}/mappings`
    );

    return response.data;
  },

  getTemplateMappingCandidates: async (templateId) => {
    assertTemplateId(templateId);

    const response = await apiClient.get(
      `/admin/templates/${templateId}/mappings/candidates`
    );

    return response.data;
  },

  getTemplateMappingPreviewGrid: async (templateId, params = {}) => {
    assertTemplateId(templateId);

    const response = await apiClient.get(
      `/admin/templates/${templateId}/mappings/preview-grid`,
      { params }
    );

    return response.data;
  },

  createTemplateMappings: async (templateId, data) => {
    assertTemplateId(templateId);

    const response = await apiClient.post(
      `/admin/templates/${templateId}/mappings`,
      data
    );

    return response.data;
  },

  previewTemplateMappings: async (templateId, data) => {
    assertTemplateId(templateId);

    const response = await apiClient.post(
      `/admin/templates/${templateId}/mappings/preview`,
      data
    );

    return response.data;
  },

  lockTemplateMappings: async (templateId) => {
    assertTemplateId(templateId);

    const response = await apiClient.post(
      `/admin/templates/${templateId}/mappings/lock`
    );

    return response.data;
  },
};

export default mappingApi;