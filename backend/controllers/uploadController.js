const pool = require('../config/db');
const asyncHandler = require('../utils/asyncHandler');
const createAuditLog = require('../utils/createAuditLog');
const { enqueueAiProcessing } = require('../services/aiQueueService');
const { normalizeUploadedFilePath } = require('../middleware/uploadMiddleware');

const createBatchNo = () => {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  const time = String(now.getTime()).slice(-6);

  return `BATCH-${y}${m}${d}-${time}`;
};

const normalizeEmptyValue = (value) => {
  if (value === undefined || value === null || value === '') {
    return null;
  }

  return value;
};

const uploadReceipts = asyncHandler(async (req, res) => {
  const files = req.files || [];

  const {
    title,
    templateId,
    departmentId,
    siteId,
    documentType,
  } = req.body;

  const autoProcess = req.body.autoProcess !== 'false';

  if (files.length === 0) {
    return res.status(400).json({
      message: '업로드할 파일을 선택하세요.',
    });
  }

  const connection = await pool.getConnection();

  try {
    await connection.beginTransaction();

    const batchNo = createBatchNo();

    const finalDepartmentId =
      normalizeEmptyValue(departmentId) ||
      normalizeEmptyValue(req.user.departmentId);

    const finalSiteId =
      normalizeEmptyValue(siteId) ||
      normalizeEmptyValue(req.user.siteId);

    const finalTemplateId = normalizeEmptyValue(templateId);

    const finalDocumentType =
      normalizeEmptyValue(documentType) || '영수증';

    const [batchResult] = await connection.query(
      `
      INSERT INTO upload_batches
      (
        batch_no,
        title,
        submitter_id,
        department_id,
        site_id,
        template_id,
        document_type,
        status
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `,
      [
        batchNo,
        normalizeEmptyValue(title),
        req.user.id,
        finalDepartmentId,
        finalSiteId,
        finalTemplateId,
        finalDocumentType,
        autoProcess ? 'PROCESSING' : 'UPLOADED',
      ]
    );

    const batchId = batchResult.insertId;
    const savedFiles = [];

    for (const file of files) {
      const relativePath = normalizeUploadedFilePath(file);

      const [fileResult] = await connection.query(
        `
        INSERT INTO source_files
        (
          upload_batch_id,
          uploader_id,
          uploaded_by,
          original_file_name,
          file_path,
          mime_type,
          file_size,
          document_type,
          status
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        `,
        [
          batchId,
          req.user.id,
          req.user.id,
          file.originalname,
          relativePath,
          file.mimetype,
          file.size,
          finalDocumentType,
          autoProcess ? 'QUEUED' : 'UPLOADED',
        ]
      );

      savedFiles.push({
        sourceFileId: fileResult.insertId,
        originalFileName: file.originalname,
        filePath: relativePath,
        mimeType: file.mimetype,
        fileSize: file.size,
        status: autoProcess ? 'QUEUED' : 'UPLOADED',
      });
    }

    await connection.query(
      `
      INSERT INTO audit_logs
      (
        user_id,
        action_type,
        target_table,
        target_id,
        after_data,
        ip_address
      )
      VALUES (
        ?,
        'RECEIPTS_UPLOADED',
        'upload_batches',
        ?,
        JSON_OBJECT(
          'fileCount', ?,
          'title', ?,
          'departmentId', ?,
          'siteId', ?,
          'templateId', ?,
          'documentType', ?
        ),
        ?
      )
      `,
      [
        req.user.id,
        batchId,
        files.length,
        normalizeEmptyValue(title),
        finalDepartmentId,
        finalSiteId,
        finalTemplateId,
        finalDocumentType,
        req.ip,
      ]
    );

    await connection.commit();

    const aiQueueResults = [];

    if (autoProcess) {
      for (const savedFile of savedFiles) {
        const queueResult = await enqueueAiProcessing(savedFile.sourceFileId);

        aiQueueResults.push({
          sourceFileId: savedFile.sourceFileId,
          success: queueResult.enqueued,
          status: savedFile.status,
          reason: queueResult.reason || null,
        });
      }
    }

    return res.status(autoProcess ? 202 : 201).json({
      batchId,
      batchNo,
      title: normalizeEmptyValue(title),
      departmentId: finalDepartmentId,
      siteId: finalSiteId,
      templateId: finalTemplateId,
      documentType: finalDocumentType,
      status: autoProcess ? 'PROCESSING' : 'UPLOADED',
      autoProcess,
      files: savedFiles,
      aiQueueResults,
      message: autoProcess
        ? '업로드가 접수되었습니다. AI 처리는 백그라운드에서 진행됩니다.'
        : '업로드가 완료되었습니다.',
    });
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
});

const getMyBatches = asyncHandler(async (req, res) => {
  const { status, page = 1, size = 20 } = req.query;

  const limit = Number(size);
  const offset = (Number(page) - 1) * limit;

  const params = [req.user.id];
  let whereSql = 'WHERE eb.submitter_id = ?';

  if (status) {
    whereSql += ' AND eb.status = ?';
    params.push(status);
  }

  const [items] = await pool.query(
    `
    SELECT 
      eb.id AS batchId,
      eb.batch_no AS batchNo,
      eb.title,
      eb.status,
      eb.document_type AS documentType,
      eb.submitted_at AS submittedAt,
      eb.completed_at AS completedAt,

      eb.department_id AS departmentId,
      d.department_name AS departmentName,

      eb.site_id AS siteId,
      s.site_name AS siteName,

      eb.template_id AS templateId,
      t.template_name AS templateName,

      COUNT(sf.id) AS fileCount
    FROM upload_batches eb
    LEFT JOIN departments d ON eb.department_id = d.id
    LEFT JOIN sites s ON eb.site_id = s.id
    LEFT JOIN templates t ON eb.template_id = t.id
    LEFT JOIN source_files sf ON eb.id = sf.upload_batch_id
    ${whereSql}
    GROUP BY
      eb.id,
      eb.batch_no,
      eb.title,
      eb.status,
      eb.document_type,
      eb.submitted_at,
      eb.completed_at,
      eb.department_id,
      d.department_name,
      eb.site_id,
      s.site_name,
      eb.template_id,
      t.template_name
    ORDER BY eb.id DESC
    LIMIT ? OFFSET ?
    `,
    [...params, limit, offset]
  );

  const [countRows] = await pool.query(
    `
    SELECT COUNT(*) AS total
    FROM upload_batches eb
    ${whereSql}
    `,
    params
  );

  return res.json({
    items,
    page: Number(page),
    size: limit,
    total: countRows[0].total,
  });
});

const getBatchDetail = asyncHandler(async (req, res) => {
  const { batchId } = req.params;

  const [batchRows] = await pool.query(
    `
    SELECT 
      eb.id AS batchId,
      eb.batch_no AS batchNo,
      eb.title,
      eb.status,
      eb.document_type AS documentType,
      eb.submitted_at AS submittedAt,
      eb.completed_at AS completedAt,

      eb.submitter_id AS submitterId,
      u.name AS submitterName,
      u.email AS submitterEmail,

      eb.department_id AS departmentId,
      d.department_name AS departmentName,

      eb.site_id AS siteId,
      s.site_name AS siteName,

      eb.template_id AS templateId,
      t.template_name AS templateName
    FROM upload_batches eb
    LEFT JOIN users u ON eb.submitter_id = u.id
    LEFT JOIN departments d ON eb.department_id = d.id
    LEFT JOIN sites s ON eb.site_id = s.id
    LEFT JOIN templates t ON eb.template_id = t.id
    WHERE eb.id = ?
    LIMIT 1
    `,
    [batchId]
  );

  if (batchRows.length === 0) {
    return res.status(404).json({
      message: '배치를 찾을 수 없습니다.',
    });
  }

  const [files] = await pool.query(
    `
    SELECT 
      id AS sourceFileId,
      original_file_name AS originalFileName,
      file_path AS filePath,
      mime_type AS mimeType,
      file_size AS fileSize,
      status,
      error_message AS errorMessage,
      uploaded_at AS uploadedAt,
      completed_at AS completedAt
    FROM source_files
    WHERE upload_batch_id = ?
    ORDER BY id ASC
    `,
    [batchId]
  );

  return res.json({
    ...batchRows[0],
    files,
  });
});

const getMySupplements = asyncHandler(async (req, res) => {
  const { page = 1, size = 20 } = req.query;
  const limit = Number(size);
  const offset = (Number(page) - 1) * limit;

  const [items] = await pool.query(
    `
    SELECT
      sf.id AS sourceFileId,
      sf.upload_batch_id AS batchId,
      eb.batch_no AS batchNo,
      eb.title,
      sf.original_file_name AS originalFileName,
      sf.file_path AS filePath,
      sf.mime_type AS mimeType,
      sf.file_size AS fileSize,
      sf.status,
      sf.error_message AS reason,
      sf.uploaded_at AS uploadedAt,
      sf.completed_at AS completedAt,
      d.department_name AS departmentName,
      s.site_name AS siteName
    FROM source_files sf
    JOIN upload_batches eb ON sf.upload_batch_id = eb.id
    LEFT JOIN departments d ON eb.department_id = d.id
    LEFT JOIN sites s ON eb.site_id = s.id
    WHERE eb.submitter_id = ? AND sf.status = 'NEED_SUPPLEMENT'
    ORDER BY sf.id DESC
    LIMIT ? OFFSET ?
    `,
    [req.user.id, limit, offset]
  );

  const [countRows] = await pool.query(
    `
    SELECT COUNT(*) AS total
    FROM source_files sf
    JOIN upload_batches eb ON sf.upload_batch_id = eb.id
    WHERE eb.submitter_id = ? AND sf.status = 'NEED_SUPPLEMENT'
    `,
    [req.user.id]
  );

  return res.json({ items, page: Number(page), size: limit, total: countRows[0].total });
});

const uploadSupplementFile = asyncHandler(async (req, res) => {
  const { sourceFileId } = req.params;

  if (!req.file) {
    return res.status(400).json({
      message: '재업로드할 파일을 선택하세요.',
    });
  }

  const relativePath = normalizeUploadedFilePath(req.file);

  const [updateResult] = await pool.query(
    `
    UPDATE source_files
    SET 
      original_file_name = ?,
      file_path = ?,
      mime_type = ?,
      file_size = ?,
      status = 'QUEUED',
      error_message = NULL,
      uploaded_at = CURRENT_TIMESTAMP,
      completed_at = NULL,
      processed_at = NULL
    WHERE id = ?
    `,
    [
      req.file.originalname,
      relativePath,
      req.file.mimetype,
      req.file.size,
      sourceFileId,
    ]
  );

  if ((updateResult.affectedRows || 0) === 0) {
    return res.status(404).json({
      message: '재업로드할 원본 파일을 찾을 수 없습니다.',
    });
  }

  await createAuditLog({
    userId: req.user.id,
    actionType: 'SUPPLEMENT_UPLOADED',
    targetTable: 'source_files',
    targetId: Number(sourceFileId),
    afterData: {
      fileName: req.file.originalname,
      filePath: relativePath,
      mimeType: req.file.mimetype,
      fileSize: req.file.size,
    },
    ipAddress: req.ip,
  });

  const queueResult = await enqueueAiProcessing(Number(sourceFileId));

  return res.status(202).json({
    sourceFileId: Number(sourceFileId),
    status: 'QUEUED',
    aiQueueResult: queueResult,
    message: '보완자료가 재업로드되었습니다. AI 재처리는 백그라운드에서 진행됩니다.',
  });
});

module.exports = {
  uploadReceipts,
  getMyBatches,
  getBatchDetail,
  getMySupplements,
  uploadSupplementFile,
};