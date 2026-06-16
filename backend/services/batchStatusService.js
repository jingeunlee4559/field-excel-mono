const pool = require('../config/db');

const PROCESSING_SOURCE_STATUSES = [
  'UPLOADED',
  'QUEUED',
  'EXTRACTING',
  'OCR_PROCESSING',
  'AI_PROCESSING',
];

const terminalStatusSql = `
  SUM(CASE WHEN status IN ('UPLOADED', 'QUEUED', 'EXTRACTING', 'OCR_PROCESSING', 'AI_PROCESSING') THEN 1 ELSE 0 END) AS processingCount,
  SUM(CASE WHEN status = 'NEED_SUPPLEMENT' THEN 1 ELSE 0 END) AS needSupplementCount,
  SUM(CASE WHEN status = 'NEED_REVIEW' THEN 1 ELSE 0 END) AS needReviewCount,
  SUM(CASE WHEN status = 'FAILED' THEN 1 ELSE 0 END) AS failedCount,
  SUM(CASE WHEN status = 'NORMAL' THEN 1 ELSE 0 END) AS normalCount,
  SUM(CASE WHEN status = 'CONFIRMED' THEN 1 ELSE 0 END) AS confirmedCount
`;

const getRunner = (connection) => connection || pool;

const calculateBatchStatus = (summary) => {
  const totalCount = Number(summary?.totalCount || 0);
  const processingCount = Number(summary?.processingCount || 0);
  const needSupplementCount = Number(summary?.needSupplementCount || 0);
  const needReviewCount = Number(summary?.needReviewCount || 0);
  const failedCount = Number(summary?.failedCount || 0);
  const normalCount = Number(summary?.normalCount || 0);
  const confirmedCount = Number(summary?.confirmedCount || 0);

  if (totalCount === 0) return 'UPLOADED';
  if (processingCount > 0) return 'PROCESSING';
  if (needReviewCount > 0) return 'NEED_REVIEW';
  if (normalCount > 0) return 'READY_TO_CONFIRM';

  const terminalCount = confirmedCount + needSupplementCount + failedCount;
  if (terminalCount === totalCount) {
    if (needSupplementCount > 0 || failedCount > 0) return 'REVIEW_COMPLETED';
    return 'READY_TO_GENERATE';
  }

  if (needSupplementCount > 0) return 'NEED_SUPPLEMENT';
  if (failedCount > 0) return 'NEED_REVIEW';

  return 'NEED_REVIEW';
};

const recalculateBatchStatus = async (batchId, connection = null) => {
  if (!batchId) return null;

  const runner = getRunner(connection);

  const [rows] = await runner.query(
    `
    SELECT
      COUNT(*) AS totalCount,
      ${terminalStatusSql}
    FROM source_files
    WHERE upload_batch_id = ?
    `,
    [batchId]
  );

  const summary = rows[0] || {};
  const nextStatus = calculateBatchStatus(summary);
  const isCompleted = !['UPLOADED', 'PROCESSING'].includes(nextStatus);

  await runner.query(
    `
    UPDATE upload_batches
    SET
      status = ?,
      completed_at = CASE
        WHEN ? = TRUE THEN COALESCE(completed_at, CURRENT_TIMESTAMP)
        ELSE NULL
      END
    WHERE id = ?
    `,
    [nextStatus, isCompleted, batchId]
  );

  return {
    batchId: Number(batchId),
    status: nextStatus,
    totalCount: Number(summary.totalCount || 0),
    processingCount: Number(summary.processingCount || 0),
    needSupplementCount: Number(summary.needSupplementCount || 0),
    needReviewCount: Number(summary.needReviewCount || 0),
    failedCount: Number(summary.failedCount || 0),
    normalCount: Number(summary.normalCount || 0),
    confirmedCount: Number(summary.confirmedCount || 0),
  };
};

const markBatchProcessing = async (batchId, connection = null) => {
  if (!batchId) return;

  const runner = getRunner(connection);

  await runner.query(
    `
    UPDATE upload_batches
    SET
      status = 'PROCESSING',
      completed_at = NULL
    WHERE id = ?
    `,
    [batchId]
  );
};

module.exports = {
  PROCESSING_SOURCE_STATUSES,
  calculateBatchStatus,
  recalculateBatchStatus,
  markBatchProcessing,
};
