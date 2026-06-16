import apiClient from './axios';

export const auditApi = {
  /**
   * 작업 이력 조회
   * GET /api/admin/audit-logs
   */
  getAuditLogs: async ({
    actionType,
    targetTable,
    userId,
    q,
    startDate,
    endDate,
    page = 1,
    size = 20,
  } = {}) => {
    const response = await apiClient.get('/admin/audit-logs', {
      params: {
        actionType,
        targetTable,
        userId,
        q,
        startDate,
        endDate,
        page,
        size,
      },
    });

    return response.data;
  },

  /**
   * 작업 이력 요약
   * GET /api/admin/audit-logs/summary
   */
  getAuditSummary: async ({
    actionType,
    targetTable,
    userId,
    q,
    startDate,
    endDate,
  } = {}) => {
    const response = await apiClient.get('/admin/audit-logs/summary', {
      params: {
        actionType,
        targetTable,
        userId,
        q,
        startDate,
        endDate,
      },
    });

    return response.data;
  },

  /**
   * 작업 이력 필터 메타데이터
   * GET /api/admin/audit-logs/meta
   */
  getAuditMeta: async () => {
    const response = await apiClient.get('/admin/audit-logs/meta');
    return response.data;
  },

  /**
   * 작업 이력 상세 조회
   * GET /api/admin/audit-logs/{logId}
   */
  getAuditLogDetail: async (logId) => {
    const response = await apiClient.get(`/admin/audit-logs/${logId}`);
    return response.data;
  },
};
