import React from "react";
import { ROLE_LABEL } from "./dashboardHome.constants.js";

const DashboardHero = ({ roleCode, pageConfig, onNavigate }) => {
  return (
    <section className="flex flex-col gap-4 rounded-3xl bg-slate-950 p-6 text-white shadow-sm md:flex-row md:items-center md:justify-between">
      <div>
        <div className="mb-3 inline-flex items-center rounded-full bg-white/10 px-3 py-1 text-xs font-bold text-slate-200">
          {ROLE_LABEL[roleCode] || "사용자"}
        </div>

        <h2 className="text-2xl font-extrabold tracking-tight">
          {pageConfig.title}
        </h2>

        <p className="mt-2 text-sm leading-6 text-slate-300">
          {pageConfig.description}
        </p>
      </div>

      <div className="flex flex-wrap gap-2">
        <DashboardActionButton
          action={pageConfig.primaryAction}
          onClick={() => onNavigate(pageConfig.primaryAction.path)}
          variant="primary"
        />

        <DashboardActionButton
          action={pageConfig.secondaryAction}
          onClick={() => onNavigate(pageConfig.secondaryAction.path)}
          variant="secondary"
        />
      </div>
    </section>
  );
};

const DashboardActionButton = ({ action, onClick, variant }) => {
  const Icon = action.icon;

  const className =
    variant === "primary"
      ? "bg-white text-slate-950 hover:bg-blue-50"
      : "bg-white/10 text-white ring-1 ring-white/15 hover:bg-white/15";

  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex h-11 items-center gap-2 rounded-2xl px-4 text-sm font-extrabold transition ${className}`}
    >
      <Icon size={16} />
      {action.label}
    </button>
  );
};

export default DashboardHero;