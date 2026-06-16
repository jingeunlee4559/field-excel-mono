import React, { useMemo } from "react";
import { NavLink, useNavigate } from "react-router-dom";
import {
  FiClock,
  FiFileText,
  FiGrid,
  FiLogOut,
  FiSettings,
  FiUploadCloud,
  FiCheckSquare,
  FiDownload,
  FiClipboard,
  FiBarChart2,
  FiX,
} from "react-icons/fi";

import { useAuth } from "../context/AuthContext";
import { alertSuccess, confirmLogout } from "../utils/swal";

const MENU_BY_ROLE = {
  SYSTEM_ADMIN: [
    {
      name: "대시보드",
      description: "전체 현황",
      icon: FiGrid,
      path: "/dashboardhome",
    },
    {
      name: "템플릿 관리",
      description: "엑셀 양식",
      icon: FiFileText,
      path: "/templates",
    },
    {
      name: "매핑 관리",
      description: "셀 위치 설정",
      icon: FiSettings,
      path: "/mappings",
    },
    {
      name: "작업 이력",
      description: "관리 로그",
      icon: FiClock,
      path: "/audit",
    },
    {
      name: "보정 사전",
      description: "OCR 오타 관리",
      icon: FiSettings,
      path: "/corrections",
    },
  ],

  MANAGER: [
    {
      name: "대시보드",
      description: "처리 현황",
      icon: FiGrid,
      path: "/dashboardhome",
    },
    {
      name: "자료 검토 현황",
      description: "오류 수정",
      icon: FiCheckSquare,
      path: "/reviews",
    },
    {
      name: "생성 문서",
      description: "엑셀 다운로드",
      icon: FiDownload,
      path: "/generated",
    },
    {
      name: "관리 통계",
      description: "부서/현장별",
      icon: FiBarChart2,
      path: "/manager-reports",
    },
    {
      name: "보정 사전",
      description: "OCR 오타 관리",
      icon: FiSettings,
      path: "/corrections",
    },
  ],

  SUBMITTER: [
    {
      name: "대시보드",
      description: "내 제출 현황",
      icon: FiGrid,
      path: "/dashboardhome",
    },
    {
      name: "증빙 업로드",
      description: "영수증 제출",
      icon: FiUploadCloud,
      path: "/upload",
    },
    {
      name: "내 업로드",
      description: "처리 상태",
      icon: FiClipboard,
      path: "/my-uploads",
    },
    {
      name: "보완 요청",
      description: "재업로드 필요",
      icon: FiCheckSquare,
      path: "/supplements",
    },
  ],
};

const ROLE_LABEL = {
  SYSTEM_ADMIN: "시스템 관리자",
  MANAGER: "관리팀 사용자",
  SUBMITTER: "증빙 제출자",
};

const Sidebar = ({ isOpen, setIsOpen }) => {
  const navigate = useNavigate();
  const { user, logoutUser } = useAuth();

  const userInitial =
    user?.name?.[0]?.toUpperCase() || user?.email?.[0]?.toUpperCase() || "U";

  const roleCode = user?.roleCode;

  const menuItems = useMemo(() => {
    return MENU_BY_ROLE[roleCode] || [];
  }, [roleCode]);

  const handleLogout = async () => {
    const result = await confirmLogout();

    if (!result.isConfirmed) return;

    logoutUser();
    setIsOpen(false);

    await alertSuccess("로그아웃 완료", "정상적으로 로그아웃되었습니다.");

    navigate("/login");
  };

  return (
    <>
      {isOpen && (
        <div
          className="fixed inset-0 z-[60] bg-slate-950/40 backdrop-blur-sm md:hidden"
          onClick={() => setIsOpen(false)}
        />
      )}

      <aside
        className={`
          group
          fixed inset-y-0 left-0 z-[70]
          flex h-screen flex-col justify-between
          border-r border-slate-200 bg-white
          transition-all duration-300 ease-in-out
          ${isOpen ? "translate-x-0" : "-translate-x-full"}
          w-[270px]
          md:translate-x-0 md:w-[78px] md:hover:w-[270px]
        `}
      >
        <div className="min-h-0 flex-1 overflow-y-auto overflow-x-hidden">
          <div className="flex h-[84px] items-center border-b border-slate-100 px-4">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-slate-950 text-white shadow-sm">
              <FiFileText className="text-xl" />
            </div>

            <div
              className="
                ml-3 overflow-hidden whitespace-nowrap
                transition-all duration-300
                md:w-0 md:opacity-0 md:group-hover:w-auto md:group-hover:opacity-100
              "
            >
              <h1 className="text-lg font-extrabold tracking-tight text-slate-950">
                docuflow
              </h1>
              <p className="mt-0.5 text-xs font-medium text-slate-400">
                Expense System
              </p>
            </div>
          </div>

          <nav className="px-3 py-5">
            <div
              className="
                mb-3 px-3 text-[11px] font-bold uppercase tracking-[0.18em] text-slate-400
                transition-all duration-300
                md:opacity-0 md:group-hover:opacity-100
              "
            >
              Menu
            </div>

            <div className="space-y-2">
              {menuItems.length > 0 ? (
                menuItems.map((item) => (
                  <SidebarNavLink
                    key={item.path}
                    item={item}
                    setIsOpen={setIsOpen}
                  />
                ))
              ) : (
                <div
                  className="
                    rounded-2xl bg-red-50 px-4 py-4 text-xs font-bold text-red-500
                    transition-all duration-300
                    md:w-0 md:overflow-hidden md:px-0 md:opacity-0
                    md:group-hover:w-auto md:group-hover:px-4 md:group-hover:opacity-100
                  "
                >
                  권한 정보가 없습니다.
                </div>
              )}
            </div>
          </nav>
        </div>

        <div className="shrink-0 border-t border-slate-100 p-3">
          <div className="mb-3 flex h-[64px] items-center rounded-2xl bg-slate-50 px-3">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-slate-200 text-slate-600">
              <span className="text-xs font-bold">{userInitial}</span>
            </div>

            <div
              className="
                ml-3 min-w-0 overflow-hidden whitespace-nowrap
                transition-all duration-300
                md:w-0 md:opacity-0 md:group-hover:w-auto md:group-hover:opacity-100
              "
            >
              <p className="truncate text-sm font-bold text-slate-900">
                {user?.name || "사용자"}
              </p>
              <p className="truncate text-xs text-slate-400">
                {ROLE_LABEL[roleCode] || roleCode || user?.email || ""}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={handleLogout}
            className="
              flex h-[50px] w-full items-center rounded-2xl px-3
              text-slate-500 transition
              hover:bg-red-50 hover:text-red-600
            "
          >
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-slate-100">
              <FiLogOut className="text-lg" />
            </div>

            <span
              className="
                ml-3 whitespace-nowrap text-sm font-bold
                transition-all duration-300
                md:w-0 md:opacity-0 md:group-hover:w-auto md:group-hover:opacity-100
              "
            >
              로그아웃
            </span>
          </button>
        </div>

        <button
          type="button"
          onClick={() => setIsOpen(false)}
          className="absolute right-4 top-4 rounded-xl bg-slate-100 p-2 text-xl text-slate-600 md:hidden"
        >
          <FiX />
        </button>
      </aside>
    </>
  );
};

const SidebarNavLink = ({ item, setIsOpen }) => {
  const Icon = item.icon;

  return (
    <NavLink
      to={item.path}
      end
      onClick={() => setIsOpen(false)}
      className={({ isActive }) =>
        `
          flex h-[54px] items-center rounded-2xl px-3
          transition-all duration-200
          ${
            isActive
              ? "bg-slate-950 text-white shadow-lg shadow-slate-200"
              : "text-slate-600 hover:bg-slate-100 hover:text-slate-950"
          }
        `
      }
    >
      {({ isActive }) => (
        <>
          <div
            className={`
              flex h-9 w-9 shrink-0 items-center justify-center rounded-xl
              transition-all duration-200
              ${
                isActive
                  ? "bg-white/12 text-white"
                  : "bg-slate-100 text-slate-600"
              }
            `}
          >
            <Icon className="text-lg" />
          </div>

          <div
            className="
              ml-3 min-w-0 overflow-hidden whitespace-nowrap
              transition-all duration-300
              md:w-0 md:opacity-0 md:group-hover:w-auto md:group-hover:opacity-100
            "
          >
            <p className="truncate text-sm font-bold">{item.name}</p>
            <p
              className={`
                mt-0.5 truncate text-xs
                ${isActive ? "text-slate-300" : "text-slate-400"}
              `}
            >
              {item.description}
            </p>
          </div>
        </>
      )}
    </NavLink>
  );
};

export default Sidebar;