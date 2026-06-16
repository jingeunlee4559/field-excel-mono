import React from "react";
import { STATUS_CLASS, STATUS_LABEL } from "./dashboardHome.constants.js";

const DashboardListItem = ({ item, emphasized }) => {
  const title =
    item.originalFileName ||
    item.original_file_name ||
    item.fileName ||
    item.file_name ||
    item.title ||
    item.templateName ||
    item.template_name ||
    item.documentName ||
    item.document_name ||
    item.name ||
    "이름 없는 자료";

  const subText =
    item.reason ||
    item.description ||
    item.createdAt ||
    item.created_at ||
    item.updatedAt ||
    item.updated_at ||
    item.status ||
    "상세 정보 없음";

  const status = item.status || item.reviewStatus || item.validationStatus;
  const statusLabel = STATUS_LABEL[status] || status || "확인";

  const statusClass =
    STATUS_CLASS[status] ||
    (emphasized
      ? "bg-orange-50 text-orange-600"
      : "bg-slate-100 text-slate-500");

  return (
    <div className="flex items-center justify-between gap-3 rounded-2xl border border-slate-100 px-4 py-3 transition hover:bg-slate-50">
      <div className="min-w-0">
        <p className="truncate text-sm font-extrabold text-slate-900">
          {title}
        </p>
        <p className="mt-0.5 truncate text-xs text-slate-400">{subText}</p>
      </div>

      <span
        className={`shrink-0 rounded-full px-2.5 py-1 text-[11px] font-extrabold ${statusClass}`}
      >
        {statusLabel}
      </span>
    </div>
  );
};

export default DashboardListItem;