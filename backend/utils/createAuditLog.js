const pool = require('../config/db');

const stringifyJsonSafely = (value) => {
  if (value === null || value === undefined) return null;
  try {
    return JSON.stringify(value);
  } catch {
    return JSON.stringify({ value: String(value) });
  }
};

/**
 * 시스템 작업 이력 저장 유틸.
 *
 * 실패해도 원래 업무 처리를 막지 않도록 내부에서 오류를 잡는다.
 * audit_logs 테이블은 action_type/action, target_table/target_type을 모두 보관한다.
 */
const createAuditLog = async ({
  userId,
  actionType,
  action,
  targetTable = null,
  targetType = null,
  targetId = null,
  beforeData = null,
  afterData = null,
  ipAddress = null,
  userAgent = null,
}) => {
  try {
    const normalizedAction = actionType || action || 'UNKNOWN_ACTION';
    const normalizedTarget = targetTable || targetType || null;

    await pool.query(
      `
      INSERT INTO audit_logs
      (
        user_id,
        action_type,
        action,
        target_table,
        target_type,
        target_id,
        before_data,
        after_data,
        ip_address,
        user_agent
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `,
      [
        userId || null,
        normalizedAction,
        normalizedAction,
        normalizedTarget,
        normalizedTarget,
        targetId || null,
        stringifyJsonSafely(beforeData),
        stringifyJsonSafely(afterData),
        ipAddress || null,
        userAgent || null,
      ]
    );
  } catch (error) {
    console.error('[AUDIT_LOG_FAILED]', {
      message: error.message,
      code: error.code,
      actionType: actionType || action,
      targetTable: targetTable || targetType,
      targetId,
    });
  }
};

module.exports = createAuditLog;
