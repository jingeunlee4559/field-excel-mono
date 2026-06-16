import React from "react";
import { FiArrowRight } from "react-icons/fi";

const DashboardQuickActions = ({ actions, onNavigate }) => {
  return (
    <div className="rounded-3xl bg-white p-6 shadow-sm ring-1 ring-slate-200">
      <div className="mb-5">
        <h3 className="text-sm font-extrabold text-slate-950">빠른 실행</h3>
        <p className="mt-1 text-xs text-slate-400">
          현재 권한에서 자주 사용하는 기능입니다.
        </p>
      </div>

      <div className="space-y-3">
        {actions.map((action) => {
          const Icon = action.icon;

          return (
            <button
              key={action.path}
              type="button"
              onClick={() => onNavigate(action.path)}
              className="flex w-full items-center justify-between rounded-2xl border border-slate-200 bg-white p-4 text-left transition hover:border-slate-300 hover:bg-slate-50"
            >
              <div className="flex min-w-0 items-center gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-slate-100 text-slate-700">
                  <Icon size={18} />
                </div>

                <div className="min-w-0">
                  <p className="truncate text-sm font-extrabold text-slate-900">
                    {action.label}
                  </p>
                  <p className="mt-0.5 truncate text-xs text-slate-400">
                    {action.description}
                  </p>
                </div>
              </div>

              <FiArrowRight className="shrink-0 text-slate-400" />
            </button>
          );
        })}
      </div>
    </div>
  );
};

export default DashboardQuickActions;