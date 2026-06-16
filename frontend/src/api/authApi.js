import apiClient from "./axios";

/**
 * 인증 API
 */
export const authApi = {
  /**
   * 로그인
   * POST /api/auth/login
   */
  login: async ({ email, password }) => {
    const response = await apiClient.post("/auth/login", {
      email,
      password,
    });

    return response.data;
  },

  /**
   * 내 정보 조회
   * GET /api/auth/me
   */
  getMe: async () => {
    const response = await apiClient.get("/auth/me");
    return response.data;
  },

  /**
   * 회원가입 옵션 조회
   * GET /api/auth/signup-options
   */
  getSignupOptions: async () => {
    const response = await apiClient.get("/auth/signup-options");
    return response.data;
  },

  /**
   * 이메일 중복 확인
   * GET /api/auth/check-email?email=
   */
  checkEmail: async (email) => {
    const response = await apiClient.get("/auth/check-email", {
      params: { email },
    });

    return response.data;
  },

  /**
   * 회원가입
   * POST /api/auth/register
   *
   * role은 백엔드에서 무조건 SUBMITTER로 저장한다.
   */
  register: async ({
    email,
    password,
    name,
    phone,
    departmentId,
    siteId,
  }) => {
    const response = await apiClient.post("/auth/register", {
      email,
      password,
      name,
      phone,
      departmentId,
      siteId,
    });

    return response.data;
  },
};

/**
 * 기존 코드 호환용 named export
 */
export const loginApi = authApi.login;
export const getMeApi = authApi.getMe;
export const getSignupOptionsApi = authApi.getSignupOptions;
export const checkEmailApi = authApi.checkEmail;
export const registerApi = authApi.register;

export default authApi;