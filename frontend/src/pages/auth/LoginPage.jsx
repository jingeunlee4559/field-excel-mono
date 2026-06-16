import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  ArrowRight,
  FileSpreadsheet,
  Mail,
  Lock,
  Eye,
  EyeOff,
  UserPlus,
} from "lucide-react";

import { loginApi } from "../../api/authApi";
import { useAuth } from "../../context/AuthContext";
import { alertError, alertSuccess, alertWarning } from "../../utils/swal";

const LoginPage = () => {
  const navigate = useNavigate();
  const { loginUser } = useAuth();

  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);

  const [formData, setFormData] = useState({
    email: "",
    password: "",
    remember: false,
  });

  const handleChange = (e) => {
    const { name, value, checked, type } = e.target;

    setFormData((prev) => ({
      ...prev,
      [name]: type === "checkbox" ? checked : value,
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!formData.email || !formData.password) {
      await alertWarning("입력 확인", "이메일과 비밀번호를 입력해주세요.");
      return;
    }

    try {
      setLoading(true);

      const result = await loginApi({
        email: formData.email,
        password: formData.password,
      });

      loginUser(result.user, result.accessToken);

      await alertSuccess(
        "로그인 성공",
        `${result.user?.name || "사용자"}님, 환영합니다.`
      );

      navigate("/dashboardhome");
    } catch (error) {
      console.error("로그인 실패:", error);

      const message =
        error.response?.data?.message || "로그인 중 오류가 발생했습니다.";

      await alertError("로그인 실패", message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="h-screen w-screen overflow-hidden bg-white text-slate-900">
      <div className="grid h-full w-full grid-cols-1 lg:grid-cols-2">
        <section className="hidden h-full w-full overflow-hidden lg:block">
          <img
            src="https://images.unsplash.com/photo-1497366811353-6870744d04b2?q=80&w=1800&auto=format&fit=crop"
            alt="회사 업무 공간"
            className="h-full w-full object-cover"
          />
        </section>

        <main className="flex h-full w-full items-center justify-center bg-white px-6 sm:px-10 lg:px-16">
          <div className="w-full max-w-[420px]">
            <div className="mb-12 flex items-center justify-center gap-2">
              <FileSpreadsheet size={19} className="text-slate-950" />
              <span className="text-lg font-extrabold tracking-tight text-slate-950">
                docuflow
              </span>
            </div>

            <div className="mb-9 text-center">
              <h1 className="text-[42px] font-light tracking-[-0.04em] text-slate-950">
                로그인
              </h1>

              <p className="mt-3 text-xs leading-5 text-slate-400">
                테스트 계정
                <br />
                admin@example.com / manager@example.com
                <br />
                construction1@example.com / supervision1@example.com
                <br />
                비밀번호 1234
              </p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-5">
              <div>
                <label
                  htmlFor="email"
                  className="mb-2 block text-center text-xs font-semibold text-slate-700"
                >
                  이메일
                </label>

                <div className="relative">
                  <Mail
                    size={15}
                    className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400"
                  />

                  <input
                    id="email"
                    name="email"
                    type="email"
                    value={formData.email}
                    onChange={handleChange}
                    placeholder="이메일"
                    autoComplete="email"
                    className="h-12 w-full rounded-md border border-slate-300 bg-white pl-11 pr-4 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-slate-900 focus:ring-2 focus:ring-slate-100"
                  />
                </div>
              </div>

              <div>
                <label
                  htmlFor="password"
                  className="mb-2 block text-center text-xs font-semibold text-slate-700"
                >
                  비밀번호
                </label>

                <div className="relative">
                  <Lock
                    size={15}
                    className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400"
                  />

                  <input
                    id="password"
                    name="password"
                    type={showPassword ? "text" : "password"}
                    value={formData.password}
                    onChange={handleChange}
                    placeholder="비밀번호"
                    autoComplete="current-password"
                    className="h-12 w-full rounded-md border border-slate-300 bg-white pl-11 pr-11 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-slate-900 focus:ring-2 focus:ring-slate-100"
                  />

                  <button
                    type="button"
                    onClick={() => setShowPassword((prev) => !prev)}
                    className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 transition hover:text-slate-700"
                    aria-label="비밀번호 보기"
                  >
                    {showPassword ? <EyeOff size={15} /> : <Eye size={15} />}
                  </button>
                </div>
              </div>

              <div className="flex items-center justify-between pt-1">
                <label className="flex cursor-pointer items-center gap-2 text-xs font-medium text-slate-600">
                  <input
                    type="checkbox"
                    name="remember"
                    checked={formData.remember}
                    onChange={handleChange}
                    className="h-4 w-4 rounded border-slate-300 accent-slate-950"
                  />
                  이메일 기억하기
                </label>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="mt-9 flex h-12 w-full items-center justify-center gap-2 rounded-md bg-[#111111] text-sm font-semibold text-white transition hover:bg-blue-600 active:scale-[0.99] disabled:cursor-not-allowed disabled:bg-slate-400"
              >
                {loading ? "로그인 중..." : "로그인"}
                {!loading && <ArrowRight size={15} />}
              </button>

              <div className="relative py-2">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-slate-200" />
                </div>
                <div className="relative flex justify-center">
                  <span className="bg-white px-3 text-xs font-semibold text-slate-400">
                    또는
                  </span>
                </div>
              </div>

              <button
                type="button"
                onClick={() => navigate("/register")}
                className="flex h-12 w-full items-center justify-center gap-2 rounded-md border border-slate-200 bg-white text-sm font-bold text-slate-800 transition hover:border-blue-200 hover:bg-blue-50 hover:text-blue-700 active:scale-[0.99]"
              >
                <UserPlus size={16} />
                새 계정 회원가입
              </button>
            </form>

            <div className="mt-7 rounded-2xl bg-slate-50 p-4 text-center">
              <p className="text-xs font-semibold leading-5 text-slate-500">
                공사팀·감리팀 사용자는 회원가입 후 사용할 수 있습니다.
                <br />
                관리팀 계정은 시스템 관리자에게 문의하세요.
              </p>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
};

export default LoginPage;