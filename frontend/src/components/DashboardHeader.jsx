import React, { useEffect, useRef, useState } from "react";
import {
  FiBell,
  FiChevronDown,
  FiFilePlus,
  FiMenu,
  FiUser,
  FiLogOut,
  FiSettings,
} from "react-icons/fi";
import { useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { alertSuccess, confirmLogout } from "../utils/swal";

const PAGE_TITLES = {
  "/dashboardhome": {
    title: "대시보드",
    description: "경비 증빙 처리 현황을 확인하세요.",
  },
  "/upload": {
    title: "증빙 업로드",
    description: "영수증, PDF, 이미지를 업로드하세요.",
  },
  "/my-uploads": {
    title: "내 업로드",
    description: "내가 제출한 증빙자료 처리 상태를 확인하세요.",
  },
  "/supplements": {
    title: "보완 요청",
    description: "보완이 필요한 증빙자료를 확인하세요.",
  },
  "/reviews": {
    title: "검토 필요 항목",
    description: "오류, 누락, 신뢰도 낮은 항목을 검토하세요.",
  },
  "/generated": {
    title: "생성 문서",
    description: "생성된 경비청구서 엑셀을 확인하고 다운로드하세요.",
  },
  "/templates": {
    title: "템플릿 관리",
    description: "경비청구서 엑셀 템플릿을 관리하세요.",
  },
  "/mappings": {
    title: "매핑 관리",
    description: "표준 필드와 엑셀 입력 위치를 연결하세요.",
  },
  "/audit": {
    title: "작업 이력",
    description: "템플릿, 매핑, 수정, 다운로드 이력을 확인하세요.",
  },
};

const ROLE_LABEL = {
  SYSTEM_ADMIN: "시스템 관리자",
  MANAGER: "관리팀 사용자",
  SUBMITTER: "증빙 제출자",
};

const DashboardHeader = ({ setIsMobileSidebarOpen }) => {
  const navigate = useNavigate();
  const location = useLocation();

  const { user, logoutUser } = useAuth();

  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const [isNotificationOpen, setIsNotificationOpen] = useState(false);

  const profileRef = useRef(null);
  const notificationRef = useRef(null);

  const pageInfo =
    PAGE_TITLES[location.pathname] || {
      title: "docuflow",
      description: "경비청구서 자동화 워크스페이스",
    };

  const userInitial =
    user?.name?.[0]?.toUpperCase() || user?.email?.[0]?.toUpperCase() || "U";

  const notifications = [
    {
      id: 1,
      title: "검토 필요 항목 발생",
      body: "신뢰도가 낮은 증빙자료가 검토 목록에 추가되었습니다.",
      time: "10분 전",
      unread: true,
    },
    {
      id: 2,
      title: "경비청구서 생성 완료",
      body: "관리팀 경비청구서 엑셀 파일이 생성되었습니다.",
      time: "1시간 전",
      unread: true,
    },
    {
      id: 3,
      title: "보완 요청 등록",
      body: "흐린 이미지로 인해 보완 요청이 등록되었습니다.",
      time: "어제",
      unread: false,
    },
  ];

  const unreadCount = notifications.filter((item) => item.unread).length;

  const getCreateButtonPath = () => {
    if (user?.roleCode === "SUBMITTER") return "/upload";
    if (user?.roleCode === "MANAGER") return "/reviews";
    if (user?.roleCode === "SYSTEM_ADMIN") return "/templates";
    return "/dashboardhome";
  };

  const getCreateButtonText = () => {
    if (user?.roleCode === "SUBMITTER") return "증빙 업로드";
    if (user?.roleCode === "MANAGER") return "검토 항목";
    if (user?.roleCode === "SYSTEM_ADMIN") return "템플릿 관리";
    return "바로가기";
  };

  const handleLogout = async () => {
    setIsProfileOpen(false);

    const result = await confirmLogout();

    if (!result.isConfirmed) return;

    logoutUser();

    await alertSuccess("로그아웃 완료", "정상적으로 로그아웃되었습니다.");

    navigate("/login");
  };

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (profileRef.current && !profileRef.current.contains(e.target)) {
        setIsProfileOpen(false);
      }

      if (
        notificationRef.current &&
        !notificationRef.current.contains(e.target)
      ) {
        setIsNotificationOpen(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  return (
    <header className="sticky top-0 z-40 border-b border-slate-200 bg-white/90 backdrop-blur-xl">
      <div className="flex h-16 items-center justify-between gap-4 px-4 sm:px-6 lg:px-8">
        <div className="flex min-w-0 items-center gap-3">
          <button
            type="button"
            onClick={() => setIsMobileSidebarOpen(true)}
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-600 transition hover:bg-slate-50 md:hidden"
          >
            <FiMenu size={20} />
          </button>

          <div className="min-w-0">
            <h1 className="truncate text-lg font-extrabold tracking-tight text-slate-950">
              {pageInfo.title}
            </h1>
            <p className="mt-0.5 hidden truncate text-xs text-slate-400 sm:block">
              {pageInfo.description}
            </p>
          </div>
        </div>

        <div className="flex shrink-0 items-center gap-2">
          <button
            type="button"
            onClick={() => navigate(getCreateButtonPath())}
            className="hidden h-10 items-center gap-2 rounded-2xl bg-slate-950 px-4 text-sm font-bold text-white transition hover:bg-blue-600 sm:flex"
          >
            <FiFilePlus size={16} />
            {getCreateButtonText()}
          </button>

          <div className="relative" ref={notificationRef}>
            <button
              type="button"
              onClick={() => setIsNotificationOpen((prev) => !prev)}
              className={`relative flex h-10 w-10 items-center justify-center rounded-2xl border transition ${
                isNotificationOpen
                  ? "border-blue-200 bg-blue-50 text-blue-600"
                  : "border-slate-200 bg-white text-slate-500 hover:bg-slate-50"
              }`}
            >
              <FiBell size={18} />

              {unreadCount > 0 && (
                <span className="absolute right-2 top-2 flex h-4 min-w-4 items-center justify-center rounded-full bg-blue-600 px-1 text-[10px] font-bold text-white ring-2 ring-white">
                  {unreadCount}
                </span>
              )}
            </button>

            {isNotificationOpen && (
              <NotificationPanel notifications={notifications} />
            )}
          </div>

          <div className="relative" ref={profileRef}>
            <button
              type="button"
              onClick={() => setIsProfileOpen((prev) => !prev)}
              className={`flex h-10 items-center gap-2 rounded-2xl border bg-white px-2.5 transition hover:bg-slate-50 ${
                isProfileOpen ? "border-blue-200" : "border-slate-200"
              }`}
            >
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-slate-950 text-xs font-extrabold text-white">
                {userInitial}
              </div>

              <div className="hidden max-w-[140px] text-left lg:block">
                <p className="truncate text-xs font-bold text-slate-900">
                  {user?.name || "사용자"}
                </p>
                <p className="truncate text-[11px] text-slate-400">
                  {ROLE_LABEL[user?.roleCode] ||
                    user?.departmentName ||
                    user?.email ||
                    "docuflow"}
                </p>
              </div>

              <FiChevronDown
                size={14}
                className={`hidden text-slate-400 transition lg:block ${
                  isProfileOpen ? "rotate-180" : ""
                }`}
              />
            </button>

            {isProfileOpen && (
              <ProfilePanel
                user={user}
                userInitial={userInitial}
                onLogout={handleLogout}
                onNavigate={(path) => {
                  setIsProfileOpen(false);
                  navigate(path);
                }}
              />
            )}
          </div>
        </div>
      </div>
    </header>
  );
};

const NotificationPanel = ({ notifications }) => {
  return (
    <div className="absolute right-0 top-full mt-3 w-[340px] overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-[0_20px_70px_rgba(15,23,42,0.12)]">
      <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
        <div>
          <p className="text-sm font-extrabold text-slate-950">알림</p>
          <p className="mt-0.5 text-xs text-slate-400">
            처리 상태를 확인하세요.
          </p>
        </div>
      </div>

      <div className="max-h-[360px] overflow-y-auto p-2">
        {notifications.map((item) => (
          <button
            key={item.id}
            type="button"
            className="flex w-full gap-3 rounded-2xl p-3 text-left transition hover:bg-slate-50"
          >
            <div
              className={`mt-1 h-2.5 w-2.5 shrink-0 rounded-full ${
                item.unread ? "bg-blue-600" : "bg-slate-200"
              }`}
            />

            <div className="min-w-0">
              <p className="text-sm font-bold text-slate-900">{item.title}</p>
              <p className="mt-1 text-xs leading-5 text-slate-500">
                {item.body}
              </p>
              <p className="mt-1 text-[11px] text-slate-400">{item.time}</p>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
};

const ProfilePanel = ({ user, userInitial, onLogout, onNavigate }) => {
  return (
    <div className="absolute right-0 top-full mt-3 w-[260px] overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-[0_20px_70px_rgba(15,23,42,0.12)]">
      <div className="flex items-center gap-3 border-b border-slate-100 px-5 py-4">
        <div className="flex h-11 w-11 items-center justify-center rounded-full bg-slate-950 text-sm font-extrabold text-white">
          {userInitial}
        </div>

        <div className="min-w-0">
          <p className="truncate text-sm font-extrabold text-slate-950">
            {user?.name || "사용자"}
          </p>
          <p className="truncate text-xs text-slate-400">
            {user?.email || ""}
          </p>
        </div>
      </div>

      <div className="p-2">
        <button
          type="button"
          onClick={() => onNavigate("/settings")}
          className="flex w-full items-center gap-3 rounded-2xl px-3 py-3 text-left text-sm font-bold text-slate-700 transition hover:bg-slate-50"
        >
          <FiSettings size={16} />
          설정
        </button>

        <button
          type="button"
          onClick={() => onNavigate("/profile")}
          className="flex w-full items-center gap-3 rounded-2xl px-3 py-3 text-left text-sm font-bold text-slate-700 transition hover:bg-slate-50"
        >
          <FiUser size={16} />
          프로필
        </button>

        <div className="my-1 h-px bg-slate-100" />

        <button
          type="button"
          onClick={onLogout}
          className="flex w-full items-center gap-3 rounded-2xl px-3 py-3 text-left text-sm font-bold text-red-500 transition hover:bg-red-50"
        >
          <FiLogOut size={16} />
          로그아웃
        </button>
      </div>
    </div>
  );
};

export default DashboardHeader;