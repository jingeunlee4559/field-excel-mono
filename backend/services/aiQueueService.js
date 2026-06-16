const pool = require('../config/db');
const { processSourceFileById } = require('./aiProcessingService');
const { markBatchProcessing } = require('./batchStatusService');

const queue = [];
const queuedIds = new Set();
const runningIds = new Set();

const getConcurrency = () => {
  const value = Number(process.env.AI_QUEUE_CONCURRENCY || 1);
  return Number.isFinite(value) && value > 0 ? Math.floor(value) : 1;
};

const loadBatchId = async (sourceFileId) => {
  const [rows] = await pool.query(
    'SELECT upload_batch_id AS batchId FROM source_files WHERE id = ? LIMIT 1',
    [sourceFileId]
  );

  return rows[0]?.batchId || null;
};

const enqueueAiProcessing = async (sourceFileId) => {
  const id = Number(sourceFileId);

  if (!Number.isFinite(id) || id <= 0) {
    return { enqueued: false, reason: 'INVALID_SOURCE_FILE_ID' };
  }

  if (queuedIds.has(id) || runningIds.has(id)) {
    return { enqueued: false, reason: 'ALREADY_QUEUED_OR_RUNNING' };
  }

  const batchId = await loadBatchId(id);

  await pool.query(
    `
    UPDATE source_files
    SET
      status = 'QUEUED',
      error_message = NULL,
      completed_at = NULL,
      processed_at = NULL
    WHERE id = ?
      AND status NOT IN ('EXTRACTING', 'NORMAL')
    `,
    [id]
  );

  if (batchId) {
    await markBatchProcessing(batchId);
  }

  queue.push({ sourceFileId: id, enqueuedAt: new Date() });
  queuedIds.add(id);

  setImmediate(runNext);

  return {
    enqueued: true,
    sourceFileId: id,
    batchId: batchId ? Number(batchId) : null,
    queueSize: queue.length,
  };
};

const runNext = async () => {
  const concurrency = getConcurrency();

  while (runningIds.size < concurrency && queue.length > 0) {
    const job = queue.shift();
    const sourceFileId = job.sourceFileId;

    queuedIds.delete(sourceFileId);
    runningIds.add(sourceFileId);

    processSourceFileById(sourceFileId)
      .catch((error) => {
        console.error('[AI QUEUE JOB FAILED]', {
          sourceFileId,
          message: error.message,
          stack: error.stack,
        });
      })
      .finally(() => {
        runningIds.delete(sourceFileId);
        setImmediate(runNext);
      });
  }
};

const getAiQueueSnapshot = () => ({
  waitingCount: queue.length,
  runningCount: runningIds.size,
  concurrency: getConcurrency(),
  waitingSourceFileIds: queue.map((job) => job.sourceFileId),
  runningSourceFileIds: Array.from(runningIds),
});

module.exports = {
  enqueueAiProcessing,
  getAiQueueSnapshot,
};
