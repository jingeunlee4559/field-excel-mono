import apiClient from './axios';

const getFileNameFromContentDisposition = (contentDisposition) => {
  if (!contentDisposition) return null;

  const utf8FileNameMatch = contentDisposition.match(/filename\*=UTF-8''([^;]+)/i);

  if (utf8FileNameMatch?.[1]) {
    return decodeURIComponent(utf8FileNameMatch[1].replace(/"/g, ''));
  }

  const fileNameMatch = contentDisposition.match(/filename="?([^"]+)"?/i);

  if (fileNameMatch?.[1]) {
    return decodeURIComponent(fileNameMatch[1]);
  }

  return null;
};

const parseBlobError = async (error) => {
  const data = error?.response?.data;

  if (data instanceof Blob) {
    try {
      const text = await data.text();

      try {
        const json = JSON.parse(text);
        return json.message || text;
      } catch {
        return text;
      }
    } catch {
      return null;
    }
  }

  return (
    error?.response?.data?.message ||
    error?.message ||
    '요청 처리 중 오류가 발생했습니다.'
  );
};

export const excelApi = {
  /**
   * 경비청구서 엑셀 생성
   * POST /api/excel/batches/{batchId}/generate
   */
  generateExcel: async (batchId) => {
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
   * 생성 완료 목록 조회
   * GET /api/excel/generated-documents
   */
  getGeneratedDocuments: async ({
    status,
    startDate,
    endDate,
    page = 1,
    size = 20,
  } = {}) => {
    const response = await apiClient.get('/excel/generated-documents', {
      params: {
        status,
        startDate,
        endDate,
        page,
        size,
      },
    });

    return response.data;
  },

  /**
   * 생성 문서 상세 조회
   * GET /api/excel/generated-documents/{generatedDocumentId}
   */
  getGeneratedDocumentDetail: async (generatedDocumentId) => {
    const response = await apiClient.get(
      `/excel/generated-documents/${generatedDocumentId}`
    );

    return response.data;
  },

  /**
   * 엑셀 다운로드
   * GET /api/excel/generated-documents/{generatedDocumentId}/download
   */
  downloadExcel: async (generatedDocumentId) => {
    try {
      const response = await apiClient.get(
        `/excel/generated-documents/${generatedDocumentId}/download`,
        {
          responseType: 'blob',
        }
      );

      const contentDisposition = response.headers['content-disposition'];
      const fileName =
        getFileNameFromContentDisposition(contentDisposition) ||
        'expense_claim.xlsx';

      const blob = new Blob([response.data], {
        type:
          response.headers['content-type'] ||
          'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      });

      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');

      link.href = url;
      link.download = fileName;
      document.body.appendChild(link);
      link.click();

      link.remove();
      window.URL.revokeObjectURL(url);

      return {
        fileName,
        success: true,
      };
    } catch (error) {
      const message = await parseBlobError(error);

      const customError = new Error(message || '엑셀 다운로드에 실패했습니다.');
      customError.originalError = error;
      customError.status = error?.response?.status;

      throw customError;
    }
  },

  /**
   * 관리팀 통계에서 선택한 행을 업로드 당시 선택한 템플릿으로 다운로드
   * POST /api/excel/reports/selected-template-download
   */
  downloadSelectedTemplateExcel: async (sourceFileIds = []) => {
    try {
      const response = await apiClient.post(
        '/excel/reports/selected-template-download',
        { sourceFileIds },
        {
          responseType: 'blob',
        }
      );

      const contentDisposition = response.headers['content-disposition'];
      const fileName =
        getFileNameFromContentDisposition(contentDisposition) ||
        'selected_template_report.xlsx';

      const blob = new Blob([response.data], {
        type:
          response.headers['content-type'] ||
          'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      });

      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');

      link.href = url;
      link.download = fileName;
      document.body.appendChild(link);
      link.click();

      link.remove();
      window.URL.revokeObjectURL(url);

      return {
        fileName,
        success: true,
      };
    } catch (error) {
      const message = await parseBlobError(error);

      const customError = new Error(
        message || '선택한 행의 템플릿 엑셀 다운로드에 실패했습니다.'
      );
      customError.originalError = error;
      customError.status = error?.response?.status;

      throw customError;
    }
  },
};

export default excelApi;