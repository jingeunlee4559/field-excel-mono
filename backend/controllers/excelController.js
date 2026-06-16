const fs = require('fs');
const path = require('path');

const pool = require('../config/db');
const asyncHandler = require('../utils/asyncHandler');
const createAuditLog = require('../utils/createAuditLog');
const { getAiStorageRoot, getResultsDir } = require('../utils/storagePath');
const {
  generateExcelForBatch,
  generateExcelForSourceFile,
  generateExcelForSelectedSourceFiles,
} = require('../services/excelGenerationService');

const AI_STORAGE_ROOT = getAiStorageRoot();
const RESULTS_DIR = getResultsDir();

const normalizePath = (value) => {
  return String(value || '').replace(/\\/g, '/');
};

/**
 * generated_documents.file_path 값을 실제 서버 파일 절대경로로 변환
 *
 * 지원하는 DB 저장 형태:
 * 1. app/storage/results/파일명.xlsx
 * 2. results/파일명.xlsx
 * 3. storage/results/파일명.xlsx
 * 4. 파일명.xlsx
 * 5. C:/.../파일명.xlsx 또는 /home/.../파일명.xlsx
 */
const resolveGeneratedFilePath = (filePath) => {
  const normalized = normalizePath(filePath);

  if (!normalized) return null;

  // 절대경로면 그대로 사용
  if (path.isAbsolute(normalized)) {
    return normalized;
  }

  /**
   * 현재 DB 저장값:
   * app/storage/results/BATCH-...xlsx
   *
   * 실제 파일 위치:
   * ../app/storage/results/BATCH-...xlsx
   */
  if (normalized.startsWith('app/storage/')) {
    return path.join(
      AI_STORAGE_ROOT,
      normalized.replace(/^app\/storage\//, '')
    );
  }

  /**
   * 추천 DB 저장값:
   * results/BATCH-...xlsx
   */
  if (normalized.startsWith('results/')) {
    return path.join(AI_STORAGE_ROOT, normalized);
  }

  /**
   * 혹시 storage/results/... 형태로 들어온 경우
   */
  if (normalized.startsWith('storage/results/')) {
    return path.join(
      AI_STORAGE_ROOT,
      normalized.replace(/^storage\//, '')
    );
  }

  /**
   * 혹시 전체 경로 문자열 안에 app/storage/가 중간에 들어있는 경우
   * 예: ../app/storage/results/파일명.xlsx
   */
  const storageIndex = normalized.indexOf('app/storage/');

  if (storageIndex >= 0) {
    const relativeFromStorage = normalized.slice(
      storageIndex + 'app/storage/'.length
    );

    return path.join(AI_STORAGE_ROOT, relativeFromStorage);
  }

  /**
   * 파일명만 저장된 경우:
   * BATCH-...xlsx
   */
  return path.join(RESULTS_DIR, normalized);
};

/**
 * 한글 파일명 다운로드 깨짐 방지
 */
const encodeDownloadFileName = (fileName) => {
  const safeFileName = fileName || 'expense_claim.xlsx';
  const encodedFileName = encodeURIComponent(safeFileName);

  return `attachment; filename="${encodedFileName}"; filename*=UTF-8''${encodedFileName}`;
};

/**
 * 경비청구서 엑셀 생성
 * POST /api/excel/batches/:batchId/generate
 */
const generateExcel = asyncHandler(async (req, res) => {
  const { batchId } = req.params;

  const generated = await generateExcelForBatch({
    batchId: Number(batchId),
    userId: req.user.id,
  });

  await createAuditLog({
    userId: req.user.id,
    actionType: 'EXCEL_GENERATED',
    targetTable: 'generated_documents',
    targetId: generated.generatedDocumentId,
    afterData: {
      batchId: Number(batchId),
      fileName: generated.fileName,
      filePath: generated.filePath,
    },
    ipAddress: req.ip,
  });

  return res.status(201).json({
    ...generated,
    batchId: Number(batchId),
    message: '경비청구서 엑셀 파일이 생성되었습니다.',
  });
});

/**
 * 원본 파일 1건 기준 경비청구서 엑셀 생성
 * POST /api/excel/source-files/:sourceFileId/generate
 */
const generateExcelFromSourceFile = asyncHandler(async (req, res) => {
  const { sourceFileId } = req.params;

  const generated = await generateExcelForSourceFile({
    sourceFileId: Number(sourceFileId),
    userId: req.user.id,
  });

  await createAuditLog({
    userId: req.user.id,
    actionType: 'SOURCE_FILE_EXCEL_GENERATED',
    targetTable: 'generated_documents',
    targetId: generated.generatedDocumentId,
    afterData: {
      batchId: generated.batchId,
      sourceFileId: Number(sourceFileId),
      fileName: generated.fileName,
      filePath: generated.filePath,
    },
    ipAddress: req.ip,
  });

  return res.status(201).json({
    ...generated,
    sourceFileId: Number(sourceFileId),
    message: '선택한 파일 1건 기준으로 경비청구서 엑셀 파일이 생성되었습니다.',
  });
});

/**
 * 관리팀 통계에서 선택한 행을 업로드 당시 선택한 템플릿으로 다운로드
 * POST /api/excel/reports/selected-template-download
 */
const downloadSelectedTemplateReport = asyncHandler(async (req, res) => {
  const { sourceFileIds } = req.body || {};

  if (!Array.isArray(sourceFileIds) || sourceFileIds.length === 0) {
    return res.status(400).json({
      message: '다운로드할 행을 먼저 선택해주세요.',
    });
  }

  const generated = await generateExcelForSelectedSourceFiles({
    sourceFileIds,
    userId: req.user.id,
  });

  await createAuditLog({
    userId: req.user.id,
    actionType: 'SELECTED_TEMPLATE_EXCEL_DOWNLOADED',
    targetTable: 'source_files',
    targetId: null,
    afterData: {
      sourceFileIds,
      batchId: generated.batchId,
      templateId: generated.templateId,
      templateName: generated.templateName,
      fileName: generated.fileName,
      selectedCount: generated.selectedCount,
      singleAppliedCount: generated.singleAppliedCount,
      repeatAppliedCount: generated.repeatAppliedCount,
    },
    ipAddress: req.ip,
  });

  res.setHeader(
    'Content-Type',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
  );
  res.setHeader('Content-Disposition', encodeDownloadFileName(generated.fileName));
  res.setHeader('Content-Length', generated.buffer.length);

  return res.send(generated.buffer);
});

/**
 * 생성 완료 엑셀 목록 조회
 * GET /api/excel/generated-documents
 */
const getGeneratedDocuments = asyncHandler(async (req, res) => {
  const { status, startDate, endDate, page = 1, size = 20 } = req.query;

  const limit = Math.max(1, Number(size) || 20);
  const currentPage = Math.max(1, Number(page) || 1);
  const offset = (currentPage - 1) * limit;

  const params = [];
  let whereSql = 'WHERE 1 = 1';

  if (status) {
    whereSql += ' AND gd.status = ?';
    params.push(status);
  }

  if (startDate) {
    whereSql += ' AND DATE(gd.generated_at) >= ?';
    params.push(startDate);
  }

  if (endDate) {
    whereSql += ' AND DATE(gd.generated_at) <= ?';
    params.push(endDate);
  }

  const [items] = await pool.query(
    `
    SELECT
      gd.id AS generatedDocumentId,
      gd.upload_batch_id AS batchId,
      eb.batch_no AS batchNo,
      eb.title AS batchTitle,
      d.department_name AS departmentName,
      s.site_name AS siteName,
      u.name AS submitterName,
      gd.file_name AS fileName,
      gd.document_name AS documentName,
      gd.file_path AS filePath,
      gd.file_type AS fileType,
      gd.status,
      gd.generated_at AS generatedAt,
      gd.downloaded_at AS downloadedAt,
      gd.download_count AS downloadCount
    FROM generated_documents gd
    JOIN upload_batches eb ON gd.upload_batch_id = eb.id
    LEFT JOIN departments d ON eb.department_id = d.id
    LEFT JOIN sites s ON eb.site_id = s.id
    LEFT JOIN users u ON eb.submitter_id = u.id
    ${whereSql}
    ORDER BY gd.id DESC
    LIMIT ? OFFSET ?
    `,
    [...params, limit, offset]
  );

  const [countRows] = await pool.query(
    `
    SELECT COUNT(*) AS total
    FROM generated_documents gd
    JOIN upload_batches eb ON gd.upload_batch_id = eb.id
    ${whereSql}
    `,
    params
  );

  return res.json({
    items,
    page: currentPage,
    size: limit,
    total: countRows[0]?.total || 0,
  });
});

/**
 * 생성 완료 엑셀 상세 조회
 * GET /api/excel/generated-documents/:generatedDocumentId
 */
const getGeneratedDocumentDetail = asyncHandler(async (req, res) => {
  const { generatedDocumentId } = req.params;

  const [rows] = await pool.query(
    `
    SELECT
      gd.id AS generatedDocumentId,
      gd.upload_batch_id AS batchId,
      eb.batch_no AS batchNo,
      eb.title AS batchTitle,
      gd.template_id AS templateId,
      t.template_name AS templateName,
      gd.file_name AS fileName,
      gd.document_name AS documentName,
      gd.file_path AS filePath,
      gd.file_type AS fileType,
      gd.status,
      gd.generated_at AS generatedAt,
      gd.downloaded_at AS downloadedAt,
      gd.download_count AS downloadCount
    FROM generated_documents gd
    JOIN upload_batches eb ON gd.upload_batch_id = eb.id
    LEFT JOIN templates t ON gd.template_id = t.id
    WHERE gd.id = ?
    LIMIT 1
    `,
    [generatedDocumentId]
  );

  if (rows.length === 0) {
    return res.status(404).json({
      message: '생성 문서를 찾을 수 없습니다.',
    });
  }

  const doc = rows[0];
  const absolutePath = resolveGeneratedFilePath(doc.filePath);

  return res.json({
    ...doc,
    existsOnServer: !!absolutePath && fs.existsSync(absolutePath),
    resolvedPath: absolutePath,
  });
});

/**
 * 생성 완료 엑셀 다운로드
 * GET /api/excel/generated-documents/:generatedDocumentId/download
 */
const downloadGeneratedDocument = asyncHandler(async (req, res) => {
  const { generatedDocumentId } = req.params;

  const [rows] = await pool.query(
    `
    SELECT
      id,
      file_name AS fileName,
      document_name AS documentName,
      file_path AS filePath
    FROM generated_documents
    WHERE id = ?
    LIMIT 1
    `,
    [generatedDocumentId]
  );

  if (rows.length === 0) {
    return res.status(404).json({
      message: '다운로드할 생성 문서를 찾을 수 없습니다.',
    });
  }

  const doc = rows[0];
  const absolutePath = resolveGeneratedFilePath(doc.filePath);

  console.log('================ Excel Download Debug ================');
  console.log('generatedDocumentId:', generatedDocumentId);
  console.log('DB filePath:', doc.filePath);
  console.log('AI_STORAGE_ROOT:', AI_STORAGE_ROOT);
  console.log('RESULTS_DIR:', RESULTS_DIR);
  console.log('Resolved absolutePath:', absolutePath);
  console.log('File exists:', absolutePath ? fs.existsSync(absolutePath) : false);
  console.log('======================================================');

  if (!absolutePath || !fs.existsSync(absolutePath)) {
    return res.status(404).json({
      message: '서버에 엑셀 파일이 존재하지 않습니다.',
      dbFilePath: doc.filePath,
      resolvedPath: absolutePath,
      aiStorageRoot: AI_STORAGE_ROOT,
      resultsDir: RESULTS_DIR,
    });
  }

  const stat = fs.statSync(absolutePath);

  if (!stat.isFile()) {
    return res.status(404).json({
      message: '다운로드 대상이 파일이 아닙니다.',
      dbFilePath: doc.filePath,
      resolvedPath: absolutePath,
    });
  }

  await pool.query(
    `
    UPDATE generated_documents
    SET
      download_count = COALESCE(download_count, 0) + 1,
      downloaded_at = CURRENT_TIMESTAMP
    WHERE id = ?
    `,
    [generatedDocumentId]
  );

  await createAuditLog({
    userId: req.user.id,
    actionType: 'EXCEL_DOWNLOADED',
    targetTable: 'generated_documents',
    targetId: Number(generatedDocumentId),
    afterData: {
      fileName: doc.fileName,
      filePath: doc.filePath,
      resolvedPath: absolutePath,
    },
    ipAddress: req.ip,
  });

  const downloadName =
    doc.documentName ||
    doc.fileName ||
    path.basename(absolutePath);

  res.setHeader(
    'Content-Type',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
  );

  res.setHeader('Content-Disposition', encodeDownloadFileName(downloadName));

  return res.download(absolutePath, downloadName);
});

module.exports = {
  generateExcel,
  generateExcelFromSourceFile,
  downloadSelectedTemplateReport,
  getGeneratedDocuments,
  getGeneratedDocumentDetail,
  downloadGeneratedDocument,
};