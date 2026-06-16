const fs = require('fs');
const path = require('path');
const axios = require('axios');
const FormData = require('form-data');

const getPythonAiBaseUrl = () => {
  const rawBaseUrl = process.env.PYTHON_AI_BASE_URL || 'http://127.0.0.1:8000';

  try {
    const parsed = new URL(rawBaseUrl);

    if (parsed.hostname === 'localhost') {
      parsed.hostname = '127.0.0.1';
    }

    return parsed.toString().replace(/\/$/, '');
  } catch (error) {
    return 'http://127.0.0.1:8000';
  }
};

const uploadTemplateToAiServer = async (localFilePath, originalFileName) => {
  if (!localFilePath || !fs.existsSync(localFilePath)) {
    throw new Error('AI 서버로 전송할 템플릿 파일을 찾을 수 없습니다.');
  }

  const form = new FormData();
  form.append('file', fs.createReadStream(localFilePath), {
    filename: originalFileName || path.basename(localFilePath),
  });

  try {
    const response = await axios.post(
      `${getPythonAiBaseUrl()}/api/storage/upload-template`,
      form,
      {
        headers: form.getHeaders(),
        maxContentLength: Infinity,
        maxBodyLength: Infinity,
        timeout: Number(process.env.PYTHON_AI_TIMEOUT_MS || 300000),
      }
    );

    if (!response.data?.success) {
      throw new Error(response.data?.message || 'AI 서버 템플릿 저장에 실패했습니다.');
    }

    return response.data.data;
  } catch (error) {
    if (error.code === 'ECONNREFUSED') {
      throw new Error(
        `Python AI 서버에 연결하지 못했습니다. FastAPI 서버를 먼저 실행하고 PYTHON_AI_BASE_URL=${getPythonAiBaseUrl()} 설정을 확인하세요.`
      );
    }

    throw new Error(
      error.response?.data?.detail ||
        error.response?.data?.message ||
        error.message ||
        'AI 서버 템플릿 저장 중 오류가 발생했습니다.'
    );
  }
};

module.exports = {
  getPythonAiBaseUrl,
  uploadTemplateToAiServer,
};
