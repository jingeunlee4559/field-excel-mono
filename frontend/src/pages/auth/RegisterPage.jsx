import React, { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  ArrowRight,
  Building2,
  Check,
  ChevronLeft,
  ClipboardCheck,
  Eye,
  EyeOff,
  FileSpreadsheet,
  HardHat,
  Lock,
  Mail,
  MapPin,
  Phone,
  User,
  X,
  Loader2,
} from "lucide-react";

import { authApi } from "../../api/authApi";
import { alertError, alertSuccess, alertWarning } from "../../utils/swal";

const REGISTER_IMAGE_URL =
  "https://images.unsplash.com/photo-1497366811353-6870744d04b2?q=80&w=1800&auto=format&fit=crop";

const steps = [
  { no: "STEP 01", title: "기본 정보" },
  { no: "STEP 02", title: "부서" },
  { no: "STEP 03", title: "현장" },
  { no: "STEP 04", title: "가입 완료" },
];

const normalizeDepartmentIcon = (departmentCode) => {
  if (departmentCode === "CONSTRUCTION") return HardHat;
  if (departmentCode === "SUPERVISION") return ClipboardCheck;
  return Building2;
};

const getPasswordStrength = (password) => {
  let score = 0;

  if (password.length >= 8) score += 1;
  if (/[a-zA-Z]/.test(password)) score += 1;
  if (/[0-9]/.test(password)) score += 1;
  if (/[^a-zA-Z0-9]/.test(password)) score += 1;

  if (!password) {
    return {
      score: 0,
      label: "미입력",
      color: "bg-slate-200",
      textColor: "text-slate-400",
      message: "비밀번호를 입력해주세요.",
    };
  }

  if (score <= 1) {
    return {
      score,
      label: "낮음",
      color: "bg-rose-500",
      textColor: "text-rose-600",
      message: "8자 이상, 영문/숫자 조합을 권장합니다.",
    };
  }

  if (score === 2 || score === 3) {
    return {
      score,
      label: "보통",
      color: "bg-amber-500",
      textColor: "text-amber-600",
      message: "특수문자를 추가하면 더 안전합니다.",
    };
  }

  return {
    score,
    label: "강함",
    color: "bg-emerald-500",
    textColor: "text-emerald-600",
    message: "안전한 비밀번호입니다.",
  };
};

const isEmailFormatValid = (email) => {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
};

const RegisterPage = () => {
  const navigate = useNavigate();

  const [showPassword, setShowPassword] = useState(false);
  const [showPasswordConfirm, setShowPasswordConfirm] = useState(false);

  const [departments, setDepartments] = useState([]);
  const [sites, setSites] = useState([]);

  const [emailChecking, setEmailChecking] = useState(false);
  const [emailStatus, setEmailStatus] = useState({
    checkedEmail: "",
    available: null,
    message: "",
  });

  const [formData, setFormData] = useState({
    email: "",
    name: "",
    phone: "",
    password: "",
    passwordConfirm: "",
    departmentId: "",
    siteId: "",
    roleCode: "SUBMITTER",
    agreeTerms: false,
    agreePrivacy: false,
  });

  const [loading, setLoading] = useState(false);
  const [optionLoading, setOptionLoading] = useState(false);

  const selectedDepartment = useMemo(() => {
    return departments.find(
      (department) => String(department.id) === String(formData.departmentId)
    );
  }, [departments, formData.departmentId]);

  const selectedSite = useMemo(() => {
    return sites.find((site) => String(site.id) === String(formData.siteId));
  }, [sites, formData.siteId]);

  const passwordStrength = useMemo(() => {
    return getPasswordStrength(formData.password);
  }, [formData.password]);

  const passwordMatchStatus = useMemo(() => {
    if (!formData.passwordConfirm) {
      return {
        matched: null,
        message: "비밀번호 확인을 입력해주세요.",
      };
    }

    if (formData.password === formData.passwordConfirm) {
      return {
        matched: true,
        message: "비밀번호가 일치합니다.",
      };
    }

    return {
      matched: false,
      message: "비밀번호가 일치하지 않습니다.",
    };
  }, [formData.password, formData.passwordConfirm]);

  const activeStepIndex = useMemo(() => {
    if (
      !formData.name ||
      !formData.phone ||
      !formData.email ||
      !formData.password ||
      !formData.passwordConfirm
    ) {
      return 0;
    }

    if (!formData.departmentId) {
      return 1;
    }

    if (!formData.siteId) {
      return 2;
    }

    return 3;
  }, [formData]);

  const loadSignupOptions = async () => {
    try {
      setOptionLoading(true);

      const response = await authApi.getSignupOptions();

      const nextDepartments =
        response.departments || response.data?.departments || [];

      const nextSites = response.sites || response.data?.sites || [];

      setDepartments(nextDepartments);
      setSites(nextSites);

      if (!formData.departmentId && nextDepartments.length > 0) {
        setFormData((prev) => ({
          ...prev,
          departmentId: String(nextDepartments[0].id),
        }));
      }

      if (!formData.siteId && nextSites.length > 0) {
        setFormData((prev) => ({
          ...prev,
          siteId: String(nextSites[0].id),
        }));
      }
    } catch (error) {
      console.error("회원가입 옵션 조회 실패:", error);

      await alertError(
        "회원가입 정보 조회 실패",
        error.response?.data?.message ||
          error.message ||
          "요청한 API를 찾을 수 없습니다."
      );
    } finally {
      setOptionLoading(false);
    }
  };

  useEffect(() => {
    loadSignupOptions();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const email = formData.email.trim();

    setEmailStatus({
      checkedEmail: "",
      available: null,
      message: "",
    });

    if (!email) return;

    if (!isEmailFormatValid(email)) {
      setEmailStatus({
        checkedEmail: email,
        available: false,
        message: "이메일 형식이 올바르지 않습니다.",
      });
      return;
    }

    const timer = setTimeout(async () => {
      try {
        setEmailChecking(true);

        const response = await authApi.checkEmail(email);

        setEmailStatus({
          checkedEmail: email,
          available: Boolean(response.available),
          message: response.message || "사용 가능한 이메일입니다.",
        });
      } catch (error) {
        console.error("이메일 중복 확인 실패:", error);

        setEmailStatus({
          checkedEmail: email,
          available: false,
          message:
            error.response?.data?.message ||
            error.message ||
            "이메일 중복 확인에 실패했습니다.",
        });
      } finally {
        setEmailChecking(false);
      }
    }, 450);

    return () => clearTimeout(timer);
  }, [formData.email]);

  const handleChange = (event) => {
    const { name, value, type, checked } = event.target;

    setFormData((prev) => ({
      ...prev,
      [name]: type === "checkbox" ? checked : value,
    }));
  };

  const selectDepartment = (departmentId) => {
    setFormData((prev) => ({
      ...prev,
      departmentId: String(departmentId),
    }));
  };

  const selectSite = (siteId) => {
    setFormData((prev) => ({
      ...prev,
      siteId: String(siteId),
    }));
  };

  const validateForm = async () => {
    if (!formData.name.trim()) {
      await alertWarning("이름 확인", "이름을 입력해주세요.");
      return false;
    }

    if (!formData.phone.trim()) {
      await alertWarning("연락처 확인", "연락처를 입력해주세요.");
      return false;
    }

    if (!formData.email.trim()) {
      await alertWarning("이메일 확인", "이메일을 입력해주세요.");
      return false;
    }

    if (!isEmailFormatValid(formData.email.trim())) {
      await alertWarning("이메일 확인", "올바른 이메일 형식으로 입력해주세요.");
      return false;
    }

    if (emailStatus.available === false) {
      await alertWarning(
        "이메일 확인",
        emailStatus.message || "사용할 수 없는 이메일입니다."
      );
      return false;
    }

    if (emailChecking || emailStatus.available !== true) {
      await alertWarning(
        "이메일 확인",
        "이메일 중복 확인이 완료될 때까지 기다려주세요."
      );
      return false;
    }

    if (!formData.password) {
      await alertWarning("비밀번호 확인", "비밀번호를 입력해주세요.");
      return false;
    }

    if (formData.password.length < 8) {
      await alertWarning("비밀번호 확인", "비밀번호는 8자 이상 입력해주세요.");
      return false;
    }

    if (formData.password !== formData.passwordConfirm) {
      await alertWarning("비밀번호 확인", "비밀번호가 일치하지 않습니다.");
      return false;
    }

    if (!formData.departmentId) {
      await alertWarning("부서 선택 필요", "담당 부서를 선택해주세요.");
      return false;
    }

    if (!formData.siteId) {
      await alertWarning("현장 선택 필요", "담당 현장을 선택해주세요.");
      return false;
    }

    if (!formData.agreeTerms || !formData.agreePrivacy) {
      await alertWarning("약관 동의 필요", "필수 약관에 모두 동의해주세요.");
      return false;
    }

    return true;
  };

  const handleSubmit = async (event) => {
    event.preventDefault();

    const isValid = await validateForm();
    if (!isValid) return;

    try {
      setLoading(true);

      const result = await authApi.register({
        email: formData.email.trim(),
        name: formData.name.trim(),
        phone: formData.phone.trim(),
        password: formData.password,
        departmentId: Number(formData.departmentId),
        siteId: Number(formData.siteId),
        roleCode: formData.roleCode,
      });

      if (result.success) {
        await alertSuccess(
          "회원가입 완료",
          "회원가입이 완료되었습니다. 로그인해주세요."
        );

        navigate("/");
      }
    } catch (error) {
      console.error("회원가입 실패:", error);

      await alertError(
        "회원가입 실패",
        error.response?.data?.message ||
          error.message ||
          "회원가입 중 오류가 발생했습니다."
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="h-screen overflow-hidden bg-white text-slate-950 lg:grid lg:grid-cols-2">
      <aside className="relative hidden h-screen overflow-hidden bg-slate-950 lg:block">
        <img
          src={REGISTER_IMAGE_URL}
          alt="회원가입 배경 이미지"
          className="absolute inset-0 h-full w-full object-cover object-center"
          draggable="false"
        />

        <div className="absolute inset-0 bg-gradient-to-b from-slate-950/15 via-slate-950/35 to-slate-950/85" />

        <div className="relative z-10 flex h-full flex-col justify-between p-10 text-white">
          <div className="inline-flex w-fit items-center gap-2 rounded-full bg-white/10 px-3 py-2 text-xs font-black backdrop-blur-md">
            <FileSpreadsheet size={15} />
            docuflow
          </div>

          <div className="max-w-[430px]">
            <div className="mb-5 inline-flex items-center rounded-full bg-blue-500 px-3 py-1 text-xs font-black text-white">
              AI 문서 자동화 시스템
            </div>

            <h2 className="text-4xl font-black leading-tight tracking-[-0.05em]">
              현장 자료를
              <br />
              더 쉽게 제출하세요
            </h2>

            <p className="mt-5 text-sm font-semibold leading-7 text-white/75">
              영수증, PDF, 이미지 등 현장 증빙자료를 업로드하고 처리 상태를
              한 화면에서 확인할 수 있습니다.
            </p>

            <div className="mt-8 grid grid-cols-3 gap-3">
              <div className="rounded-2xl bg-white/10 p-4 backdrop-blur-md">
                <div className="text-xl font-black">01</div>
                <div className="mt-1 text-xs font-bold text-white/70">
                  자료 업로드
                </div>
              </div>

              <div className="rounded-2xl bg-white/10 p-4 backdrop-blur-md">
                <div className="text-xl font-black">02</div>
                <div className="mt-1 text-xs font-bold text-white/70">
                  자동 추출
                </div>
              </div>

              <div className="rounded-2xl bg-white/10 p-4 backdrop-blur-md">
                <div className="text-xl font-black">03</div>
                <div className="mt-1 text-xs font-bold text-white/70">
                  결과 확인
                </div>
              </div>
            </div>
          </div>
        </div>
      </aside>

      <main className="h-screen overflow-y-auto bg-slate-50 px-4 py-8 lg:px-8">
        <div className="mx-auto w-full max-w-[680px]">
          <div className="mb-4 flex justify-center lg:hidden">
            <div className="flex items-center gap-2 rounded-full bg-slate-100 px-3 py-1 text-[11px] font-black text-slate-500">
              <FileSpreadsheet size={13} />
              docuflow
            </div>
          </div>

          <div className="mb-6 text-center">
            <h1 className="text-[34px] font-black tracking-[-0.04em]">
              회원가입
            </h1>
            <p className="mt-2 text-sm font-semibold leading-6 text-slate-500">
              단계에 맞춰 정보를 입력해주세요.
            </p>
          </div>

          <div className="mb-6 grid w-full grid-cols-2 gap-3 sm:grid-cols-4">
            {steps.map((step, index) => {
              const active = index === activeStepIndex;
              const done = index < activeStepIndex;

              return (
                <div
                  key={step.no}
                  className={[
                    "rounded-2xl px-4 py-3 transition",
                    active
                      ? "bg-blue-600 text-white"
                      : done
                        ? "bg-blue-50 text-blue-700"
                        : "bg-white text-slate-500",
                  ].join(" ")}
                >
                  <div className="text-[10px] font-black opacity-80">
                    {step.no}
                  </div>
                  <div className="mt-1 text-sm font-black">{step.title}</div>
                </div>
              );
            })}
          </div>

          <form
            onSubmit={handleSubmit}
            className="w-full rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm"
          >
            <input
              type="hidden"
              name="roleCode"
              value={formData.roleCode}
              readOnly
            />

            <section className="border-b border-slate-100 pb-7">
              <div className="mb-5 flex items-start gap-3">
                <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-slate-950 text-xs font-black text-white">
                  01
                </div>

                <div>
                  <h2 className="text-lg font-black">
                    기본 정보를 입력하세요
                  </h2>
                  <p className="mt-1 text-xs font-semibold text-slate-500">
                    본인 정보는 업로드 자료의 사용자 정보로 활용될 수
                    있습니다.
                  </p>
                </div>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <label className="block">
                  <span className="text-xs font-black text-slate-600">
                    이름 <b className="text-rose-500">*</b>
                  </span>

                  <div className="relative mt-2">
                    <User
                      size={16}
                      className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400"
                    />

                    <input
                      name="name"
                      type="text"
                      value={formData.name}
                      onChange={handleChange}
                      placeholder="예: 홍길동"
                      className="h-12 w-full rounded-2xl border border-slate-200 bg-white pl-11 pr-4 text-sm font-bold outline-none transition focus:border-blue-400 focus:ring-4 focus:ring-blue-50"
                    />
                  </div>
                </label>

                <label className="block">
                  <span className="text-xs font-black text-slate-600">
                    연락처 <b className="text-rose-500">*</b>
                  </span>

                  <div className="relative mt-2">
                    <Phone
                      size={16}
                      className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400"
                    />

                    <input
                      name="phone"
                      type="text"
                      value={formData.phone}
                      onChange={handleChange}
                      placeholder="010-0000-0000"
                      className="h-12 w-full rounded-2xl border border-slate-200 bg-white pl-11 pr-4 text-sm font-bold outline-none transition focus:border-blue-400 focus:ring-4 focus:ring-blue-50"
                    />
                  </div>
                </label>

                <label className="block md:col-span-2">
                  <span className="text-xs font-black text-slate-600">
                    이메일 <b className="text-rose-500">*</b>
                  </span>

                  <div className="relative mt-2">
                    <Mail
                      size={16}
                      className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400"
                    />

                    <input
                      name="email"
                      type="email"
                      value={formData.email}
                      onChange={handleChange}
                      placeholder="email@example.com"
                      className={[
                        "h-12 w-full rounded-2xl border bg-white pl-11 pr-11 text-sm font-bold outline-none transition focus:ring-4",
                        emailStatus.available === true
                          ? "border-emerald-300 focus:border-emerald-400 focus:ring-emerald-50"
                          : emailStatus.available === false
                            ? "border-rose-300 focus:border-rose-400 focus:ring-rose-50"
                            : "border-slate-200 focus:border-blue-400 focus:ring-blue-50",
                      ].join(" ")}
                    />

                    <div className="absolute right-4 top-1/2 -translate-y-1/2">
                      {emailChecking ? (
                        <Loader2
                          size={16}
                          className="animate-spin text-slate-400"
                        />
                      ) : emailStatus.available === true ? (
                        <Check size={17} className="text-emerald-500" />
                      ) : emailStatus.available === false ? (
                        <X size={17} className="text-rose-500" />
                      ) : null}
                    </div>
                  </div>

                  {emailStatus.message && (
                    <p
                      className={[
                        "mt-2 text-xs font-bold",
                        emailStatus.available === true
                          ? "text-emerald-600"
                          : "text-rose-600",
                      ].join(" ")}
                    >
                      {emailStatus.message}
                    </p>
                  )}
                </label>

                <label className="block">
                  <span className="text-xs font-black text-slate-600">
                    비밀번호 <b className="text-rose-500">*</b>
                  </span>

                  <div className="relative mt-2">
                    <Lock
                      size={16}
                      className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400"
                    />

                    <input
                      name="password"
                      type={showPassword ? "text" : "password"}
                      value={formData.password}
                      onChange={handleChange}
                      placeholder="8자 이상"
                      className={[
                        "h-12 w-full rounded-2xl border bg-white pl-11 pr-11 text-sm font-bold outline-none transition focus:ring-4",
                        formData.password && formData.password.length >= 8
                          ? "border-emerald-300 focus:border-emerald-400 focus:ring-emerald-50"
                          : formData.password
                            ? "border-rose-300 focus:border-rose-400 focus:ring-rose-50"
                            : "border-slate-200 focus:border-blue-400 focus:ring-blue-50",
                      ].join(" ")}
                    />

                    <button
                      type="button"
                      onClick={() => setShowPassword((prev) => !prev)}
                      className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700"
                    >
                      {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  </div>

                  <div className="mt-3">
                    <div className="mb-1 flex items-center justify-between">
                      <span className="text-xs font-black text-slate-500">
                        보안 난이도
                      </span>
                      <span
                        className={`text-xs font-black ${passwordStrength.textColor}`}
                      >
                        {passwordStrength.label}
                      </span>
                    </div>

                    <div className="h-2 overflow-hidden rounded-full bg-slate-100">
                      <div
                        className={`h-full rounded-full transition-all ${passwordStrength.color}`}
                        style={{
                          width: `${Math.max(8, passwordStrength.score * 25)}%`,
                        }}
                      />
                    </div>

                    <p
                      className={`mt-1 text-xs font-bold ${passwordStrength.textColor}`}
                    >
                      {passwordStrength.message}
                    </p>
                  </div>
                </label>

                <label className="block">
                  <span className="text-xs font-black text-slate-600">
                    비밀번호 확인 <b className="text-rose-500">*</b>
                  </span>

                  <div className="relative mt-2">
                    <Lock
                      size={16}
                      className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400"
                    />

                    <input
                      name="passwordConfirm"
                      type={showPasswordConfirm ? "text" : "password"}
                      value={formData.passwordConfirm}
                      onChange={handleChange}
                      placeholder="비밀번호 재입력"
                      className={[
                        "h-12 w-full rounded-2xl border bg-white pl-11 pr-11 text-sm font-bold outline-none transition focus:ring-4",
                        passwordMatchStatus.matched === true
                          ? "border-emerald-300 focus:border-emerald-400 focus:ring-emerald-50"
                          : passwordMatchStatus.matched === false
                            ? "border-rose-300 focus:border-rose-400 focus:ring-rose-50"
                            : "border-slate-200 focus:border-blue-400 focus:ring-blue-50",
                      ].join(" ")}
                    />

                    <button
                      type="button"
                      onClick={() => setShowPasswordConfirm((prev) => !prev)}
                      className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700"
                    >
                      {showPasswordConfirm ? (
                        <EyeOff size={16} />
                      ) : (
                        <Eye size={16} />
                      )}
                    </button>
                  </div>

                  <p
                    className={[
                      "mt-2 text-xs font-bold",
                      passwordMatchStatus.matched === true
                        ? "text-emerald-600"
                        : passwordMatchStatus.matched === false
                          ? "text-rose-600"
                          : "text-slate-400",
                    ].join(" ")}
                  >
                    {passwordMatchStatus.message}
                  </p>
                </label>
              </div>
            </section>

            <section className="border-b border-slate-100 py-7">
              <div className="mb-5 flex items-start gap-3">
                <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-blue-600 text-xs font-black text-white">
                  02
                </div>

                <div>
                  <h2 className="text-lg font-black">
                    담당 부서를 선택하세요
                  </h2>
                  <p className="mt-1 text-xs font-semibold text-slate-500">
                    가입 가능한 부서를 선택해주세요.
                  </p>
                </div>
              </div>

              {optionLoading ? (
                <div className="rounded-2xl bg-slate-50 p-5 text-sm font-bold text-slate-500">
                  부서 정보를 불러오는 중입니다.
                </div>
              ) : (
                <div className="grid gap-3 md:grid-cols-2">
                  {departments.map((department) => {
                    const active =
                      String(formData.departmentId) === String(department.id);
                    const Icon = normalizeDepartmentIcon(
                      department.departmentCode
                    );

                    return (
                      <button
                        key={department.id}
                        type="button"
                        onClick={() => selectDepartment(department.id)}
                        className={[
                          "relative flex min-h-[112px] flex-col items-start rounded-2xl border p-5 text-left transition",
                          active
                            ? "border-blue-500 bg-blue-50 ring-2 ring-blue-100"
                            : "border-slate-200 bg-white hover:bg-slate-50",
                        ].join(" ")}
                      >
                        {active && (
                          <span className="absolute right-4 top-4 flex h-5 w-5 items-center justify-center rounded-full bg-blue-600 text-white">
                            <Check size={13} />
                          </span>
                        )}

                        <div
                          className={[
                            "mb-3 flex h-9 w-9 items-center justify-center rounded-xl",
                            active
                              ? "bg-blue-600 text-white"
                              : "bg-slate-100 text-slate-500",
                          ].join(" ")}
                        >
                          <Icon size={18} />
                        </div>

                        <div className="font-black text-slate-950">
                          {department.departmentName}
                        </div>

                        <div className="mt-1 text-xs font-semibold text-slate-400">
                          {department.departmentCode === "CONSTRUCTION"
                            ? "공사 관련 자료 처리"
                            : department.departmentCode === "SUPERVISION"
                              ? "감리 및 검측 자료 처리"
                              : "부서 자료 처리"}
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}
            </section>

            <section className="border-b border-slate-100 py-7">
              <div className="mb-5 flex items-start gap-3">
                <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-indigo-600 text-xs font-black text-white">
                  03
                </div>

                <div>
                  <h2 className="text-lg font-black">
                    담당 현장을 선택하세요
                  </h2>
                  <p className="mt-1 text-xs font-semibold text-slate-500">
                    자료 업로드 시 기본 현장으로 사용됩니다.
                  </p>
                </div>
              </div>

              {optionLoading ? (
                <div className="rounded-2xl bg-slate-50 p-5 text-sm font-bold text-slate-500">
                  현장 정보를 불러오는 중입니다.
                </div>
              ) : (
                <div className="grid gap-3 md:grid-cols-2">
                  {sites.map((site) => {
                    const active = String(formData.siteId) === String(site.id);

                    return (
                      <button
                        key={site.id}
                        type="button"
                        onClick={() => selectSite(site.id)}
                        className={[
                          "relative flex min-h-[96px] flex-col items-start rounded-2xl border p-5 text-left transition",
                          active
                            ? "border-indigo-500 bg-indigo-50 ring-2 ring-indigo-100"
                            : "border-slate-200 bg-white hover:bg-slate-50",
                        ].join(" ")}
                      >
                        {active && (
                          <span className="absolute right-4 top-4 flex h-5 w-5 items-center justify-center rounded-full bg-indigo-600 text-white">
                            <Check size={13} />
                          </span>
                        )}

                        <div
                          className={[
                            "mb-3 flex h-9 w-9 items-center justify-center rounded-xl",
                            active
                              ? "bg-indigo-600 text-white"
                              : "bg-slate-100 text-slate-500",
                          ].join(" ")}
                        >
                          <MapPin size={18} />
                        </div>

                        <div className="font-black text-slate-950">
                          {site.siteName}
                        </div>

                        <div className="mt-1 text-xs font-semibold text-slate-400">
                          {site.address || "현장 주소 미등록"}
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}
            </section>

            <section className="py-7">
              <div className="mb-5 flex items-start gap-3">
                <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-emerald-600 text-xs font-black text-white">
                  04
                </div>

                <div>
                  <h2 className="text-lg font-black">
                    회원 가입 정보를 확인하세요
                  </h2>
                  <p className="mt-1 text-xs font-semibold text-slate-500">
                    입력한 가입 정보를 확인한 뒤 회원가입을 신청해주세요.
                  </p>
                </div>
              </div>

              <div className="grid gap-3 md:grid-cols-2">
                <div className="rounded-2xl bg-slate-50 p-4">
                  <div className="text-xs font-black text-slate-400">부서</div>
                  <div className="mt-1 font-black text-slate-950">
                    {selectedDepartment?.departmentName || "-"}
                  </div>
                </div>

                <div className="rounded-2xl bg-slate-50 p-4">
                  <div className="text-xs font-black text-slate-400">현장</div>
                  <div className="mt-1 font-black text-slate-950">
                    {selectedSite?.siteName || "-"}
                  </div>
                </div>
              </div>

              <div className="mt-5 space-y-3">
                <label className="flex cursor-pointer items-start gap-3 rounded-2xl bg-slate-50 p-4">
                  <input
                    type="checkbox"
                    name="agreeTerms"
                    checked={formData.agreeTerms}
                    onChange={handleChange}
                    className="mt-1 h-4 w-4 rounded border-slate-300"
                  />
                  <span className="text-sm font-semibold text-slate-600">
                    <b className="text-slate-950">필수 약관에 동의합니다.</b>
                    <br />
                    시스템 사용 목적과 계정 정보 처리 기준을 확인했습니다.
                  </span>
                </label>

                <label className="flex cursor-pointer items-start gap-3 rounded-2xl bg-slate-50 p-4">
                  <input
                    type="checkbox"
                    name="agreePrivacy"
                    checked={formData.agreePrivacy}
                    onChange={handleChange}
                    className="mt-1 h-4 w-4 rounded border-slate-300"
                  />
                  <span className="text-sm font-semibold text-slate-600">
                    <b className="text-slate-950">
                      개인정보 수집 및 이용에 동의합니다.
                    </b>
                    <br />
                    로그인, 부서, 현장, 증빙자료 처리에 필요한 정보만
                    사용됩니다.
                  </span>
                </label>
              </div>
            </section>

            <div className="flex flex-col gap-3 border-t border-slate-100 pt-6 sm:flex-row">
              <button
                type="button"
                onClick={() => navigate("/")}
                className="flex h-12 flex-1 items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-white text-sm font-black text-slate-700 transition hover:bg-slate-50"
              >
                <ChevronLeft size={16} />
                로그인으로 돌아가기
              </button>

              <button
                type="submit"
                disabled={loading || optionLoading}
                className="flex h-12 flex-1 items-center justify-center gap-2 rounded-2xl bg-slate-950 text-sm font-black text-white transition hover:bg-blue-600 disabled:cursor-not-allowed disabled:bg-slate-400"
              >
                {loading ? (
                  "처리 중..."
                ) : (
                  <>
                    회원가입 신청
                    <ArrowRight size={16} />
                  </>
                )}
              </button>
            </div>
          </form>

          <p className="mt-6 pb-8 text-center text-xs font-semibold text-slate-500">
            이미 계정이 있으신가요?{" "}
            <button
              type="button"
              onClick={() => navigate("/")}
              className="font-black text-blue-600 hover:text-blue-700"
            >
              로그인하기
            </button>
          </p>
        </div>
      </main>
    </div>
  );
};

export default RegisterPage;