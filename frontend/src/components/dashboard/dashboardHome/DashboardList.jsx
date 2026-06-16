import React from "react";
import DashboardListItem from "./DashboardListItem";

const DashboardList = ({
  title,
  linkText,
  badge,
  path,
  items,
  emptyText,
  loading,
  emphasized,
  onNavigate,
}) => {
  return (
    <div
      className={`rounded-3xl bg-white p-6 shadow-sm ring-1 ${
        emphasized ? "ring-orange-100" : "ring-slate-200"
      }`}
    >
      <div className="mb-5 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <h3
            className={`text-sm font-extrabold ${
              emphasized ? "text-orange-600" : "text-slate-950"
            }`}
          >
            {title}
          </h3>

          {badge && (
            <span className="rounded-full bg-orange-50 px-2 py-0.5 text-[11px] font-extrabold text-orange-600">
              {badge}
            </span>
          )}
        </div>

        {linkText && (
          <button
            type="button"
            onClick={() => onNavigate(path)}
            className="text-xs font-extrabold text-blue-600 hover:text-blue-700"
          >
            {linkText}
          </button>
        )}
      </div>

      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((item) => (
            <div
              key={item}
              className="h-14 animate-pulse rounded-2xl bg-slate-100"
            />
          ))}
        </div>
      ) : items.length > 0 ? (
        <div className="space-y-2">
          {items.slice(0, 5).map((item, index) => (
            <DashboardListItem
              key={
                item.id ||
                item.sourceFileId ||
                item.generatedDocumentId ||
                item.templateId ||
                index
              }
              item={item}
              emphasized={emphasized}
            />
          ))}
        </div>
      ) : (
        <div className="rounded-2xl bg-slate-50 p-5 text-center text-sm font-bold text-slate-400">
          {emptyText}
        </div>
      )}
    </div>
  );
};

export default DashboardList;