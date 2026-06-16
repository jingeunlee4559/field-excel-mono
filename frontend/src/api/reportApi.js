import apiClient from "./axios";

const buildCleanParams = (params = {}) => {
  const cleanParams = {};

  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== "") {
      cleanParams[key] = value;
    }
  });

  return cleanParams;
};

const buildReportParams = (params = {}) => {
  return {
    ...buildCleanParams(params),

    // GET 304 캐시 방지
    _t: Date.now(),
  };
};

export const reportApi = {
  /**
   * 통계 요약 조회
   * GET /api/reports/summary
   */
  getSummary: async (params = {}) => {
    const response = await apiClient.get("/reports/summary", {
      params: buildReportParams(params),
      headers: {
        "Cache-Control": "no-cache",
        Pragma: "no-cache",
      },
    });

    return response.data;
  },

  /**
   * 관리팀 통계 목록 조회
   * GET /api/reports/manager
   */
  getManagerReport: async (params = {}) => {
    const response = await apiClient.get("/reports/manager", {
      params: buildReportParams(params),
      headers: {
        "Cache-Control": "no-cache",
        Pragma: "no-cache",
      },
    });

    return response.data;
  },
};

export default reportApi;