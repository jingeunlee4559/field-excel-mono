const pool = require("../config/db");
const asyncHandler = require("../utils/asyncHandler");
const createAuditLog = require("../utils/createAuditLog");
const { uploadTemplateToAiServer } = require("../services/aiTemplateStorageService");

const toPositiveIntOrNull = (value) => {
  const numberValue = Number(value);

  if (!Number.isInteger(numberValue) || numberValue <= 0) {
    return null;
  }

  return numberValue;
};

const getFileType = (fileName = "") => {
  const extension = fileName.split(".").pop()?.toLowerCase();

  if (!extension) {
    return "xlsx";
  }

  return extension;
};

const getTemplates = asyncHandler(async (req, res) => {
  const { status, page = 1, size = 20 } = req.query;

  const pageNumber = toPositiveIntOrNull(page) || 1;
  const limit = toPositiveIntOrNull(size) || 20;
  const offset = (pageNumber - 1) * limit;

  const params = [];
  let whereSql = "WHERE 1 = 1";

  if (status) {
    whereSql += " AND t.status = ?";
    params.push(status);
  }

  const [items] = await pool.query(
    `
    SELECT 
      t.id AS templateId,
      t.template_group_id AS templateGroupId,
      t.template_name AS templateName,
      t.version,
      t.original_file_name AS originalFileName,
      t.file_path AS filePath,
      t.file_type AS fileType,
      t.status,
      t.is_locked AS isLocked,
      u.name AS createdByName,
      t.created_at AS createdAt,
      t.locked_at AS lockedAt,
      t.activated_at AS activatedAt
    FROM templates t
    LEFT JOIN users u ON t.created_by = u.id
    ${whereSql}
    ORDER BY t.template_group_id DESC, t.version DESC, t.id DESC
    LIMIT ? OFFSET ?
    `,
    [...params, limit, offset]
  );

  const [countRows] = await pool.query(
    `
    SELECT COUNT(*) AS total
    FROM templates t
    ${whereSql}
    `,
    params
  );

  return res.json({
    items,
    page: pageNumber,
    size: limit,
    total: countRows[0].total,
  });
});

const getTemplateDetail = asyncHandler(async (req, res) => {
  const { templateId } = req.params;

  const [rows] = await pool.query(
    `
    SELECT 
      id AS templateId,
      template_group_id AS templateGroupId,
      template_name AS templateName,
      version,
      original_file_name AS originalFileName,
      file_path AS filePath,
      file_type AS fileType,
      status,
      is_locked AS isLocked,
      created_at AS createdAt,
      locked_at AS lockedAt,
      activated_at AS activatedAt
    FROM templates
    WHERE id = ?
    LIMIT 1
    `,
    [templateId]
  );

  if (rows.length === 0) {
    return res.status(404).json({
      message: "템플릿을 찾을 수 없습니다.",
    });
  }

  return res.json(rows[0]);
});

const createTemplate = asyncHandler(async (req, res) => {
  const { templateName } = req.body;

  const trimmedTemplateName = templateName?.trim();

  if (!req.file) {
    return res.status(400).json({
      message: "템플릿 파일을 업로드하세요.",
    });
  }

  if (!trimmedTemplateName) {
    return res.status(400).json({
      message: "템플릿명을 입력하세요.",
    });
  }

  const connection = await pool.getConnection();

  try {
    await connection.beginTransaction();

    const requestedTemplateGroupId = toPositiveIntOrNull(
      req.body.templateGroupId
    );

    let templateGroupId = requestedTemplateGroupId;
    let nextVersion = 1;

    /**
     * templateGroupId가 있으면 기존 템플릿 그룹의 새 버전으로 등록
     * 예: 경비청구서 양식 v1 → v2 → v3
     */
    if (templateGroupId) {
      const [groupRows] = await connection.query(
        `
        SELECT 
          template_group_id AS templateGroupId,
          template_name AS templateName,
          MAX(version) AS maxVersion
        FROM templates
        WHERE template_group_id = ?
        GROUP BY template_group_id, template_name
        LIMIT 1
        `,
        [templateGroupId]
      );

      if (groupRows.length === 0) {
        await connection.rollback();

        return res.status(404).json({
          message: "기존 템플릿 그룹을 찾을 수 없습니다.",
        });
      }

      nextVersion = Number(groupRows[0].maxVersion || 0) + 1;
    }

    // 템플릿 파일은 최종적으로 Python AI 서버 storage/templates에 저장한다.
    // Node의 uploads/templates 파일은 multer가 받은 임시 파일 역할만 한다.
    const aiSavedTemplate = await uploadTemplateToAiServer(
      req.file.path,
      req.file.originalname
    );

    const relativePath = aiSavedTemplate.filePath;
    const fileType = aiSavedTemplate.fileType || getFileType(req.file.originalname);

    const [result] = await connection.query(
      `
      INSERT INTO templates
      (
        template_group_id,
        template_name,
        version,
        original_file_name,
        file_path,
        file_type,
        status,
        is_locked,
        created_by
      )
      VALUES (?, ?, ?, ?, ?, ?, 'DRAFT', FALSE, ?)
      `,
      [
        templateGroupId,
        trimmedTemplateName,
        nextVersion,
        req.file.originalname,
        relativePath,
        fileType,
        req.user.id,
      ]
    );

    const insertedTemplateId = result.insertId;

    /**
     * 완전 신규 템플릿이면 자기 자신의 id를 template_group_id로 사용
     * 예:
     * id = 10, template_group_id = 10, version = 1
     *
     * 이후 새 버전:
     * id = 11, template_group_id = 10, version = 2
     */
    if (!templateGroupId) {
      templateGroupId = insertedTemplateId;

      await connection.query(
        `
        UPDATE templates
        SET template_group_id = ?
        WHERE id = ?
        `,
        [templateGroupId, insertedTemplateId]
      );
    }

    await connection.commit();

    await createAuditLog({
      userId: req.user.id,
      actionType: "TEMPLATE_CREATED",
      targetTable: "templates",
      targetId: insertedTemplateId,
      afterData: {
        templateId: insertedTemplateId,
        templateGroupId,
        templateName: trimmedTemplateName,
        version: nextVersion,
        fileName: req.file.originalname,
        status: "DRAFT",
      },
      ipAddress: req.ip,
    });

    return res.status(201).json({
      templateId: insertedTemplateId,
      templateGroupId,
      templateName: trimmedTemplateName,
      version: nextVersion,
      status: "DRAFT",
      isLocked: false,
      filePath: relativePath,
      storage: "AI_SERVER",
      message:
        nextVersion === 1
          ? "템플릿이 추가되었습니다."
          : `템플릿 v${nextVersion}이 추가되었습니다.`,
    });
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
});

const activateTemplate = asyncHandler(async (req, res) => {
  const { templateId } = req.params;

  const connection = await pool.getConnection();

  try {
    await connection.beginTransaction();

    const [rows] = await connection.query(
      `
      SELECT 
        id,
        template_group_id AS templateGroupId,
        version,
        status
      FROM templates
      WHERE id = ?
      LIMIT 1
      `,
      [templateId]
    );

    if (rows.length === 0) {
      await connection.rollback();

      return res.status(404).json({
        message: "템플릿을 찾을 수 없습니다.",
      });
    }

    const targetTemplate = rows[0];

    /**
     * 같은 그룹의 기존 ACTIVE 템플릿은 INACTIVE 처리
     * 그래야 같은 양식에서 v1, v2가 동시에 활성화되지 않음
     */
    await connection.query(
      `
      UPDATE templates
      SET status = 'INACTIVE'
      WHERE template_group_id = ?
        AND status = 'ACTIVE'
        AND id <> ?
      `,
      [targetTemplate.templateGroupId, templateId]
    );

    await connection.query(
      `
      UPDATE templates
      SET 
        status = 'ACTIVE',
        is_locked = TRUE,
        locked_by = ?,
        activated_by = ?,
        locked_at = CURRENT_TIMESTAMP,
        activated_at = CURRENT_TIMESTAMP
      WHERE id = ?
      `,
      [req.user.id, req.user.id, templateId]
    );

    await connection.query(
      `
      UPDATE template_mappings
      SET 
        is_locked = TRUE,
        locked_by = ?,
        locked_at = CURRENT_TIMESTAMP
      WHERE template_id = ?
      `,
      [req.user.id, templateId]
    );

    await connection.commit();

    await createAuditLog({
      userId: req.user.id,
      actionType: "TEMPLATE_ACTIVATED",
      targetTable: "templates",
      targetId: Number(templateId),
      afterData: {
        status: "ACTIVE",
        isLocked: true,
        templateGroupId: targetTemplate.templateGroupId,
        version: targetTemplate.version,
      },
      ipAddress: req.ip,
    });

    return res.json({
      templateId: Number(templateId),
      templateGroupId: targetTemplate.templateGroupId,
      version: targetTemplate.version,
      status: "ACTIVE",
      isLocked: true,
      message: "템플릿이 활성화되었습니다.",
    });
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
});

const archiveTemplate = asyncHandler(async (req, res) => {
  const { templateId } = req.params;

  await pool.query(
    `
    UPDATE templates
    SET status = 'ARCHIVED'
    WHERE id = ?
    `,
    [templateId]
  );

  await createAuditLog({
    userId: req.user.id,
    actionType: "TEMPLATE_ARCHIVED",
    targetTable: "templates",
    targetId: Number(templateId),
    afterData: {
      status: "ARCHIVED",
    },
    ipAddress: req.ip,
  });

  return res.json({
    templateId: Number(templateId),
    status: "ARCHIVED",
    message: "템플릿이 보관 처리되었습니다.",
  });
});

module.exports = {
  getTemplates,
  getTemplateDetail,
  createTemplate,
  activateTemplate,
  archiveTemplate,
};