const pool = require("../config/db");
const { verifyToken } = require("../utils/jwt");

const authenticate = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;

    console.log("[AUTH] request:", {
      method: req.method,
      path: req.originalUrl,
      hasAuthorizationHeader: Boolean(authHeader),
    });

    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      console.log("[AUTH] failed: missing bearer token");

      return res.status(401).json({
        message: "인증 토큰이 없습니다.",
      });
    }

    const token = authHeader.split(" ")[1];

    if (!token) {
      console.log("[AUTH] failed: empty token");

      return res.status(401).json({
        message: "인증 토큰이 없습니다.",
      });
    }

    let decoded;

    try {
      decoded = verifyToken(token);
    } catch (error) {
      console.log("[AUTH] failed: token verify error", {
        name: error.name,
        message: error.message,
      });

      return res.status(401).json({
        message:
          error.name === "TokenExpiredError"
            ? "인증 토큰이 만료되었습니다. 다시 로그인해 주세요."
            : "유효하지 않은 인증 토큰입니다.",
      });
    }

    console.log("[AUTH] decoded:", decoded);

    if (!decoded?.userId) {
      console.log("[AUTH] failed: decoded.userId missing");

      return res.status(401).json({
        message: "유효하지 않은 인증 토큰입니다.",
      });
    }

    const [rows] = await pool.query(
      `
      SELECT
        u.id,
        u.name,
        u.email,
        u.is_active,
        u.role_code,
        r.role_name,
        u.department_id,
        d.department_name,
        u.site_id,
        s.site_name
      FROM users u
      JOIN roles r ON u.role_id = r.id
      LEFT JOIN departments d ON u.department_id = d.id
      LEFT JOIN sites s ON u.site_id = s.id
      WHERE u.id = ?
      LIMIT 1
      `,
      [decoded.userId]
    );

    if (rows.length === 0) {
      console.log("[AUTH] failed: user not found", {
        userId: decoded.userId,
      });

      return res.status(401).json({
        message: "사용자를 찾을 수 없습니다.",
      });
    }

    const user = rows[0];

    if (!user.is_active) {
      console.log("[AUTH] failed: inactive user", {
        userId: user.id,
      });

      return res.status(403).json({
        message: "비활성화된 계정입니다.",
      });
    }

    req.user = {
      id: user.id,
      name: user.name,
      email: user.email,
      roleCode: user.role_code,
      roleName: user.role_name,
      departmentId: user.department_id,
      departmentName: user.department_name,
      siteId: user.site_id,
      siteName: user.site_name,
      displaySubtitle:
        user.role_code === "SYSTEM_ADMIN"
          ? "시스템 관리자"
          : user.department_name,
    };

    console.log("[AUTH] success:", {
      userId: req.user.id,
      roleCode: req.user.roleCode,
      departmentId: req.user.departmentId,
      siteId: req.user.siteId,
    });

    return next();
  } catch (error) {
    console.error("[AUTH] unexpected error:", error);

    return res.status(401).json({
      message: "유효하지 않은 인증 토큰입니다.",
    });
  }
};

const authorize = (...allowedRoles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        message: "로그인이 필요합니다.",
      });
    }

    if (!allowedRoles.includes(req.user.roleCode)) {
      console.log("[AUTH] forbidden:", {
        userRole: req.user.roleCode,
        allowedRoles,
      });

      return res.status(403).json({
        message: "접근 권한이 없습니다.",
      });
    }

    return next();
  };
};

module.exports = {
  authenticate,
  authorize,
};