const bcrypt = require("bcryptjs");
const pool = require("../config/db");
const asyncHandler = require("../utils/asyncHandler");
const { signToken } = require("../utils/jwt");

const buildUserResponse = (user) => {
  return {
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
};

const getSignupOptions = asyncHandler(async (req, res) => {
  const [departments] = await pool.query(
    `
    SELECT
      id,
      department_name AS departmentName,
      department_code AS departmentCode,
      description
    FROM departments
    WHERE is_active = TRUE
      AND is_signup_visible = TRUE
      AND department_code IN ('CONSTRUCTION', 'SUPERVISION')
    ORDER BY
      CASE department_code
        WHEN 'CONSTRUCTION' THEN 1
        WHEN 'SUPERVISION' THEN 2
        ELSE 99
      END,
      id ASC
    `
  );

  const [sites] = await pool.query(
    `
    SELECT
      id,
      site_name AS siteName,
      site_code AS siteCode,
      address,
      description
    FROM sites
    WHERE is_active = TRUE
    ORDER BY id ASC
    `
  );

  return res.json({
    success: true,
    departments,
    sites,
  });
});

const checkEmail = asyncHandler(async (req, res) => {
  const { email } = req.query;

  if (!email || !String(email).trim()) {
    return res.status(400).json({
      success: false,
      message: "이메일을 입력하세요.",
      available: false,
    });
  }

  const normalizedEmail = String(email).trim().toLowerCase();

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

  if (!emailRegex.test(normalizedEmail)) {
    return res.status(400).json({
      success: false,
      message: "올바른 이메일 형식이 아닙니다.",
      available: false,
    });
  }

  const [rows] = await pool.query(
    `
    SELECT id
    FROM users
    WHERE email = ?
    LIMIT 1
    `,
    [normalizedEmail]
  );

  const available = rows.length === 0;

  return res.json({
    success: true,
    available,
    message: available
      ? "사용 가능한 이메일입니다."
      : "이미 사용 중인 이메일입니다.",
  });
});

const register = asyncHandler(async (req, res) => {
  const {
    email,
    password,
    name,
    phone,
    departmentId,
    siteId,
  } = req.body;

  if (!email || !password || !name || !phone || !departmentId || !siteId) {
    return res.status(400).json({
      success: false,
      message: "이름, 연락처, 이메일, 비밀번호, 부서, 현장을 모두 입력하세요.",
    });
  }

  const normalizedEmail = String(email).trim().toLowerCase();

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

  if (!emailRegex.test(normalizedEmail)) {
    return res.status(400).json({
      success: false,
      message: "올바른 이메일 형식이 아닙니다.",
    });
  }

  if (String(password).length < 8) {
    return res.status(400).json({
      success: false,
      message: "비밀번호는 8자 이상 입력하세요.",
    });
  }

  const [existingUsers] = await pool.query(
    `
    SELECT id
    FROM users
    WHERE email = ?
    LIMIT 1
    `,
    [normalizedEmail]
  );

  if (existingUsers.length > 0) {
    return res.status(409).json({
      success: false,
      message: "이미 사용 중인 이메일입니다.",
    });
  }

  const [departmentRows] = await pool.query(
    `
    SELECT
      id,
      department_name,
      department_code,
      is_signup_visible,
      is_active
    FROM departments
    WHERE id = ?
      AND is_active = TRUE
    LIMIT 1
    `,
    [departmentId]
  );

  if (departmentRows.length === 0) {
    return res.status(400).json({
      success: false,
      message: "선택한 부서를 찾을 수 없습니다.",
    });
  }

  const department = departmentRows[0];

  if (
    !department.is_signup_visible ||
    !["CONSTRUCTION", "SUPERVISION"].includes(department.department_code)
  ) {
    return res.status(400).json({
      success: false,
      message: "회원가입은 공사팀 또는 감리팀만 선택할 수 있습니다.",
    });
  }

  const [siteRows] = await pool.query(
    `
    SELECT
      id,
      site_name,
      site_code,
      is_active
    FROM sites
    WHERE id = ?
      AND is_active = TRUE
    LIMIT 1
    `,
    [siteId]
  );

  if (siteRows.length === 0) {
    return res.status(400).json({
      success: false,
      message: "선택한 현장을 찾을 수 없습니다.",
    });
  }

  const [roleRows] = await pool.query(
    `
    SELECT
      id,
      role_code
    FROM roles
    WHERE role_code = 'SUBMITTER'
    LIMIT 1
    `
  );

  if (roleRows.length === 0) {
    return res.status(500).json({
      success: false,
      message: "SUBMITTER 역할이 DB에 없습니다.",
    });
  }

  const role = roleRows[0];
  const passwordHash = await bcrypt.hash(password, 10);

  const [result] = await pool.query(
    `
    INSERT INTO users
    (
      role_id,
      role,
      role_code,
      department_id,
      site_id,
      email,
      password_hash,
      name,
      phone,
      status,
      is_active,
      must_change_password
    )
    VALUES
    (?, ?, ?, ?, ?, ?, ?, ?, ?, 'ACTIVE', TRUE, FALSE)
    `,
    [
      role.id,
      role.role_code,
      role.role_code,
      department.id,
      siteRows[0].id,
      normalizedEmail,
      passwordHash,
      String(name).trim(),
      String(phone).trim(),
    ]
  );

  const [createdRows] = await pool.query(
    `
    SELECT
      u.id,
      u.name,
      u.email,
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
    [result.insertId]
  );

  return res.status(201).json({
    success: true,
    message: "회원가입이 완료되었습니다.",
    user: buildUserResponse(createdRows[0]),
  });
});

const login = asyncHandler(async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({
      message: "이메일과 비밀번호를 입력하세요.",
    });
  }

  const normalizedEmail = String(email).trim().toLowerCase();

  const [rows] = await pool.query(
    `
    SELECT
      u.id,
      u.password_hash,
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
    WHERE u.email = ?
    LIMIT 1
    `,
    [normalizedEmail]
  );

  if (rows.length === 0) {
    return res.status(401).json({
      message: "이메일 또는 비밀번호가 올바르지 않습니다.",
    });
  }

  const user = rows[0];

  if (!user.is_active) {
    return res.status(403).json({
      message: "비활성화된 계정입니다.",
    });
  }

  const isMatch = await bcrypt.compare(password, user.password_hash);

  const isDevFallback =
    process.env.NODE_ENV === "development" &&
    [
      "admin@example.com",
      "manager@example.com",
      "construction1@example.com",
      "construction2@example.com",
      "supervision1@example.com",
      "supervision2@example.com",
    ].includes(normalizedEmail) &&
    password === "1234";

  if (!isMatch && !isDevFallback) {
    return res.status(401).json({
      message: "이메일 또는 비밀번호가 올바르지 않습니다.",
    });
  }

  const accessToken = signToken({
    userId: user.id,
    roleCode: user.role_code,
  });

  return res.json({
    accessToken,
    user: buildUserResponse(user),
  });
});

const getMe = asyncHandler(async (req, res) => {
  return res.json({
    success: true,
    user: req.user,
  });
});

module.exports = {
  getSignupOptions,
  checkEmail,
  register,
  login,
  getMe,
};