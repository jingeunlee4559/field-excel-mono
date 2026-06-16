const pool = require('../config/db');
const asyncHandler = require('../utils/asyncHandler');

const clampInt = (value, fallback, min, max) => {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(Math.max(Math.trunc(parsed), min), max);
};

const parseJsonSafely = (value) => {
  if (value === null || value === undefined || value === '') return null;
  if (typeof value === 'object') return value;
  try {
    return JSON.parse(value);
  } catch {
    return value;
  }
};

const normalizeText = (value) => String(value || '').trim();

const buildWhere = (query = {}) => {
  const params = [];
  const clauses = ['1 = 1'];

  const actionType = normalizeText(query.actionType);
  const targetTable = normalizeText(query.targetTable);
  const userId = normalizeText(query.userId);
  const startDate = normalizeText(query.startDate);
  const endDate = normalizeText(query.endDate);
  const q = normalizeText(query.q);

  if (actionType) {
    clauses.push('COALESCE(al.action_type, al.action) = ?');
    params.push(actionType);
  }

  if (targetTable) {
    clauses.push('COALESCE(al.target_table, al.target_type) = ?');
    params.push(targetTable);
  }

  if (userId && userId !== 'ALL') {
    clauses.push('al.user_id = ?');
    params.push(Number(userId));
  }

  if (startDate) {
    clauses.push('DATE(al.created_at) >= ?');
    params.push(startDate);
  }

  if (endDate) {
    clauses.push('DATE(al.created_at) <= ?');
    params.push(endDate);
  }

  if (q) {
    const like = `%${q}%`;
    clauses.push(`
      (
        u.name LIKE ?
        OR u.email LIKE ?
        OR u.role_code LIKE ?
        OR COALESCE(al.action_type, al.action) LIKE ?
        OR COALESCE(al.target_table, al.target_type) LIKE ?
        OR CAST(al.target_id AS CHAR) LIKE ?
        OR al.ip_address LIKE ?
        OR CAST(al.before_data AS CHAR) LIKE ?
        OR CAST(al.after_data AS CHAR) LIKE ?
      )
    `);
    params.push(like, like, like, like, like, like, like, like, like);
  }

  return {
    whereSql: `WHERE ${clauses.join(' AND ')}`,
    params,
  };
};

const getAuditLogs = asyncHandler(async (req, res) => {
  const page = clampInt(req.query.page, 1, 1, 100000);
  const size = clampInt(req.query.size, 20, 5, 100);
  const offset = (page - 1) * size;

  const { whereSql, params } = buildWhere(req.query);

  const [items] = await pool.query(
    `
    SELECT
      al.id AS logId,
      al.user_id AS userId,
      u.name AS userName,
      u.email AS userEmail,
      u.role_code AS roleCode,
      COALESCE(al.action_type, al.action) AS actionType,
      al.action AS action,
      COALESCE(al.target_table, al.target_type) AS targetTable,
      al.target_type AS targetType,
      al.target_id AS targetId,
      al.ip_address AS ipAddress,
      al.user_agent AS userAgent,
      al.created_at AS createdAt,
      CASE
        WHEN al.before_data IS NULL THEN 0
        ELSE 1
      END AS hasBeforeData,
      CASE
        WHEN al.after_data IS NULL THEN 0
        ELSE 1
      END AS hasAfterData
    FROM audit_logs al
    LEFT JOIN users u ON al.user_id = u.id
    ${whereSql}
    ORDER BY al.id DESC
    LIMIT ? OFFSET ?
    `,
    [...params, size, offset]
  );

  const [countRows] = await pool.query(
    `
    SELECT COUNT(*) AS total
    FROM audit_logs al
    LEFT JOIN users u ON al.user_id = u.id
    ${whereSql}
    `,
    params
  );

  const total = Number(countRows?.[0]?.total || 0);
  const totalPages = Math.max(1, Math.ceil(total / size));

  return res.json({
    success: true,
    items,
    page,
    size,
    total,
    totalPages,
    data: {
      items,
      page,
      size,
      total,
      totalPages,
    },
  });
});

const getAuditLogDetail = asyncHandler(async (req, res) => {
  const logId = Number(req.params.logId);

  if (!Number.isInteger(logId) || logId <= 0) {
    return res.status(400).json({ message: '작업 이력 ID가 올바르지 않습니다.' });
  }

  const [rows] = await pool.query(
    `
    SELECT
      al.id AS logId,
      al.user_id AS userId,
      u.name AS userName,
      u.email AS userEmail,
      u.role_code AS roleCode,
      COALESCE(al.action_type, al.action) AS actionType,
      al.action AS action,
      COALESCE(al.target_table, al.target_type) AS targetTable,
      al.target_type AS targetType,
      al.target_id AS targetId,
      al.before_data AS beforeData,
      al.after_data AS afterData,
      al.ip_address AS ipAddress,
      al.user_agent AS userAgent,
      al.created_at AS createdAt
    FROM audit_logs al
    LEFT JOIN users u ON al.user_id = u.id
    WHERE al.id = ?
    LIMIT 1
    `,
    [logId]
  );

  if (rows.length === 0) {
    return res.status(404).json({ message: '작업 이력을 찾을 수 없습니다.' });
  }

  const item = rows[0];
  item.beforeData = parseJsonSafely(item.beforeData);
  item.afterData = parseJsonSafely(item.afterData);

  return res.json({ success: true, data: item, ...item });
});

const getAuditSummary = asyncHandler(async (req, res) => {
  const { whereSql, params } = buildWhere(req.query);

  const [[totalRow]] = await pool.query(
    `
    SELECT
      COUNT(*) AS total,
      SUM(CASE WHEN DATE(al.created_at) = CURDATE() THEN 1 ELSE 0 END) AS todayCount,
      COUNT(DISTINCT DATE(al.created_at)) AS activeDays,
      COUNT(DISTINCT al.user_id) AS actorCount
    FROM audit_logs al
    LEFT JOIN users u ON al.user_id = u.id
    ${whereSql}
    `,
    params
  );

  const [actionRows] = await pool.query(
    `
    SELECT COALESCE(al.action_type, al.action) AS actionType, COUNT(*) AS count
    FROM audit_logs al
    LEFT JOIN users u ON al.user_id = u.id
    ${whereSql}
    GROUP BY COALESCE(al.action_type, al.action)
    ORDER BY count DESC, actionType ASC
    LIMIT 10
    `,
    params
  );

  const [targetRows] = await pool.query(
    `
    SELECT COALESCE(al.target_table, al.target_type) AS targetTable, COUNT(*) AS count
    FROM audit_logs al
    LEFT JOIN users u ON al.user_id = u.id
    ${whereSql}
    GROUP BY COALESCE(al.target_table, al.target_type)
    ORDER BY count DESC, targetTable ASC
    LIMIT 10
    `,
    params
  );

  return res.json({
    success: true,
    data: {
      total: Number(totalRow?.total || 0),
      todayCount: Number(totalRow?.todayCount || 0),
      activeDays: Number(totalRow?.activeDays || 0),
      actorCount: Number(totalRow?.actorCount || 0),
      topActions: actionRows,
      topTargets: targetRows,
    },
  });
});

const getAuditMeta = asyncHandler(async (req, res) => {
  const [actionTypes] = await pool.query(
    `
    SELECT COALESCE(action_type, action) AS value, COUNT(*) AS count
    FROM audit_logs
    WHERE COALESCE(action_type, action) IS NOT NULL
      AND COALESCE(action_type, action) <> ''
    GROUP BY COALESCE(action_type, action)
    ORDER BY value ASC
    `
  );

  const [targetTables] = await pool.query(
    `
    SELECT COALESCE(target_table, target_type) AS value, COUNT(*) AS count
    FROM audit_logs
    WHERE COALESCE(target_table, target_type) IS NOT NULL
      AND COALESCE(target_table, target_type) <> ''
    GROUP BY COALESCE(target_table, target_type)
    ORDER BY value ASC
    `
  );

  const [users] = await pool.query(
    `
    SELECT
      u.id AS value,
      u.name AS label,
      u.email,
      u.role_code AS roleCode,
      COUNT(al.id) AS count
    FROM users u
    JOIN audit_logs al ON al.user_id = u.id
    GROUP BY u.id, u.name, u.email, u.role_code
    ORDER BY u.name ASC, u.id ASC
    `
  );

  return res.json({
    success: true,
    data: {
      actionTypes,
      targetTables,
      users,
    },
  });
});

module.exports = {
  getAuditLogs,
  getAuditLogDetail,
  getAuditSummary,
  getAuditMeta,
};
