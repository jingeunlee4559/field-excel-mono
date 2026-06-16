import { FiAlertCircle, FiCalendar } from "react-icons/fi";

export const emptySummary = {
  batchCount: 0,
  fileCount: 0,
  confirmedCount: 0,
  excludedBatchCount: 0,
  excludedFileCount: 0,
  normalExcludedCount: 0,
  reviewExcludedCount: 0,
  failedExcludedCount: 0,
  processingExcludedCount: 0,
  normalCount: 0,
  needReviewCount: 0,
  needSupplementCount: 0,
  failedCount: 0,
  extractingCount: 0,
  totalAmount: 0,
};

export const formatMoney = (value) => {
  const number = Number(value || 0);
  return `${number.toLocaleString("ko-KR")}원`;
};

export const formatNumber = (value) => {
  return Number(value || 0).toLocaleString("ko-KR");
};

export const formatDate = (value) => {
  if (!value) return "-";

  const text = String(value);

  if (/^\d{4}-\d{2}-\d{2}$/.test(text)) return text;
  if (/^\d{4}-\d{2}$/.test(text)) return text;
  if (/^\d{4}$/.test(text)) return text;

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return text.slice(0, 10);
  }

  return date.toISOString().slice(0, 10);
};

export const getTemplateName = (item) => {
  return (
    item.templateName ||
    item.template_name ||
    item.excelTemplateName ||
    item.excel_template_name ||
    item.templateTitle ||
    item.template_title ||
    "-"
  );
};

export const today = new Date();
export const yyyy = today.getFullYear();
export const mm = String(today.getMonth() + 1).padStart(2, "0");
export const dd = String(today.getDate()).padStart(2, "0");

export const defaultStartDate = `${yyyy}-${mm}-01`;
export const defaultEndDate = `${yyyy}-${mm}-${dd}`;

export const defaultFilters = {
  groupBy: "department",
  dateBasis: "receipt",
  departmentId: "",
  siteId: "",
  documentType: "",
  keyword: "",
  startDate: defaultStartDate,
  endDate: defaultEndDate,
};

export const cleanParams = (params) => {
  const result = {};

  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== "") {
      result[key] = value;
    }
  });

  return result;
};

export const unwrapItems = (response) => {
  if (Array.isArray(response)) return response;
  return response?.items || response?.data || response?.list || [];
};

export const documentTypeOptions = [
  { value: "", label: "전체" },
  { value: "RECEIPT", label: "영수증" },
  { value: "INVOICE", label: "송장" },
  { value: "MATERIAL_INSPECTION", label: "자재검수증" },
  { value: "WORK_DAILY", label: "작업일보" },
  { value: "INSPECTION_REQUEST", label: "검측요청서" },
];

export const dateBasisOptions = [
  { value: "receipt", label: "영수증 사용일자" },
  { value: "upload", label: "업로드일자" },
];

export const getDateBasisLabel = (value) => {
  return dateBasisOptions.find((option) => option.value === value)?.label || "영수증 사용일자";
};

export const statusLabelMap = {
  CONFIRMED: "확정 완료",
  NORMAL: "정상",
  NEED_REVIEW: "검토 필요",
  NEED_SUPPLEMENT: "보완 필요",
  FAILED: "실패",
  EXTRACTING: "AI 처리 중",
  OCR_PROCESSING: "OCR 처리 중",
  AI_PROCESSING: "AI 처리 중",
};

export const statusStyleMap = {
  CONFIRMED: "bg-blue-50 text-blue-700 ring-blue-100",
  NORMAL: "bg-emerald-50 text-emerald-700 ring-emerald-100",
  NEED_REVIEW: "bg-amber-50 text-amber-700 ring-amber-100",
  NEED_SUPPLEMENT: "bg-rose-50 text-rose-700 ring-rose-100",
  FAILED: "bg-red-50 text-red-700 ring-red-100",
  EXTRACTING: "bg-blue-50 text-blue-700 ring-blue-100",
  OCR_PROCESSING: "bg-blue-50 text-blue-700 ring-blue-100",
  AI_PROCESSING: "bg-indigo-50 text-indigo-700 ring-indigo-100",
};

export const normalizeText = (value) => {
  return String(value || "")
    .replace(/\s/g, "")
    .replace(/-/g, "")
    .replace(/_/g, "")
    .toLowerCase();
};

export const isSystemDepartment = (department) => {
  const name = normalizeText(
    department.departmentName ||
      department.department_name ||
      department.name ||
      department.label
  );

  const code = normalizeText(
    department.code ||
      department.departmentCode ||
      department.department_code
  );

  return (
    name.includes("시스템관리") ||
    name.includes("시스템관리자") ||
    name === "시스템" ||
    code === "system" ||
    code === "systemadmin" ||
    code === "admin"
  );
};

export const getItemKey = (item, index) => {
  return String(
    item.sourceFileId ||
      item.source_file_id ||
      item.fileId ||
      item.id ||
      `${item.batchId || item.batchNo || "BATCH"}-${
        item.periodLabel || "DATE"
      }-${index}`
  );
};

export const getOptionLabel = (options, value, fallback = "전체") => {
  if (!value) return fallback;

  const found = options.find((option) => String(option.value) === String(value));

  return found?.label || `ID ${value}`;
};

export const StatusBadge = ({ status }) => {
  const className =
    statusStyleMap[status] || "bg-slate-50 text-slate-600 ring-slate-100";

  return (
    <span
      className={`inline-flex rounded-full px-2.5 py-1 text-xs font-extrabold ring-1 ${className}`}
    >
      {statusLabelMap[status] || status || "-"}
    </span>
  );
};

export const SummaryCard = ({ label, value, icon: Icon, tone = "slate", caption }) => {
  const toneMap = {
    slate: {
      card: "from-white to-slate-50 ring-slate-200",
      icon: "bg-slate-950 text-white",
      value: "text-slate-950",
    },
    blue: {
      card: "from-blue-50 to-white ring-blue-100",
      icon: "bg-blue-600 text-white",
      value: "text-blue-700",
    },
    emerald: {
      card: "from-emerald-50 to-white ring-emerald-100",
      icon: "bg-emerald-500 text-white",
      value: "text-emerald-700",
    },
    amber: {
      card: "from-amber-50 to-white ring-amber-100",
      icon: "bg-amber-500 text-white",
      value: "text-amber-700",
    },
  };

  const style = toneMap[tone] || toneMap.slate;

  return (
    <div
      className={`rounded-3xl bg-gradient-to-br ${style.card} p-5 shadow-sm ring-1`}
    >
      <div className="flex items-center justify-between gap-4">
        <div className="min-w-0">
          <p className="text-xs font-extrabold text-slate-400">{label}</p>
          <p className={`mt-2 truncate text-2xl font-black ${style.value}`}>
            {value}
          </p>
          {caption && (
            <p className="mt-1 truncate text-xs font-bold text-slate-400">
              {caption}
            </p>
          )}
        </div>

        <div
          className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl ${style.icon} shadow-sm`}
        >
          <Icon className="text-xl" />
        </div>
      </div>
    </div>
  );
};

export const Select = ({ label, value, onChange, options }) => (
  <label className="block">
    <span className="text-xs font-extrabold text-slate-500">{label}</span>
    <select
      value={value}
      onChange={(event) => onChange(event.target.value)}
      className="mt-2 h-11 w-full rounded-2xl border border-slate-200 bg-white px-3 text-sm font-bold text-slate-800 outline-none focus:border-blue-400 focus:ring-4 focus:ring-blue-50"
    >
      {options.map((option) => (
        <option key={String(option.value || "ALL")} value={option.value}>
          {option.label}
        </option>
      ))}
    </select>
  </label>
);

export const DateInput = ({ label, value, onChange }) => (
  <label className="block">
    <span className="text-xs font-extrabold text-slate-500">{label}</span>
    <div className="relative mt-2">
      <FiCalendar className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
      <input
        type="date"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="h-11 w-full rounded-2xl border border-slate-200 px-3 pl-9 text-sm font-bold text-slate-800 outline-none focus:border-blue-400 focus:ring-4 focus:ring-blue-50"
      />
    </div>
  </label>
);

export const FilterChip = ({ label, value }) => (
  <span className="inline-flex items-center gap-1 rounded-full bg-slate-50 px-3 py-1 text-xs font-extrabold text-slate-600 ring-1 ring-slate-100">
    <span className="text-slate-400">{label}</span>
    {value}
  </span>
);

export const EmptyState = () => (
  <div className="flex min-h-[260px] flex-col items-center justify-center rounded-3xl bg-white p-8 text-center">
    <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-slate-100 text-slate-400">
      <FiAlertCircle className="text-2xl" />
    </div>
    <p className="mt-4 text-sm font-extrabold text-slate-700">
      조회 결과가 없습니다.
    </p>
    <p className="mt-1 text-xs font-bold text-slate-400">
      선택한 조건에 해당하는 확정 완료 구매 내역이 없습니다. 검토 화면에서 자료를 확정한 뒤 다시 확인하세요.
    </p>
  </div>
);

export const MobileItemCard = ({ item, checked, onToggle }) => (
  <article
    className={`rounded-3xl bg-white p-4 shadow-sm ring-1 transition ${
      checked ? "bg-blue-50/40 ring-blue-200" : "ring-slate-200"
    }`}
  >
    <div className="flex items-start justify-between gap-3">
      <input
        type="checkbox"
        checked={checked}
        onChange={onToggle}
        className="mt-1 h-5 w-5 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
        aria-label="구매 내역 선택"
      />

      <div className="min-w-0 flex-1">
        <p className="text-xs font-extrabold text-slate-400">
          사용 {formatDate(item.receiptDate || item.periodLabel)} · 업로드 {formatDate(item.uploadedDate)}
        </p>
        <h4 className="mt-1 truncate text-base font-black text-slate-950">
          {item.itemName || "미분류"}
        </h4>
        <p className="mt-1 truncate text-xs font-bold text-slate-500">
          {item.vendorName || "-"}
        </p>
      </div>

      <span className="shrink-0 rounded-full bg-blue-50 px-3 py-1 text-xs font-extrabold text-blue-700 ring-1 ring-blue-100">
        {formatMoney(item.amount)}
      </span>
    </div>

    <div className="mt-4 grid grid-cols-2 gap-3">
      <div className="rounded-2xl bg-slate-50 p-3">
        <p className="text-xs font-extrabold text-slate-400">부서</p>
        <p className="mt-1 truncate text-sm font-extrabold text-slate-800">
          {item.departmentName || "-"}
        </p>
      </div>

      <div className="rounded-2xl bg-slate-50 p-3">
        <p className="text-xs font-extrabold text-slate-400">현장</p>
        <p className="mt-1 truncate text-sm font-extrabold text-slate-800">
          {item.siteName || "-"}
        </p>
      </div>

      <div className="rounded-2xl bg-slate-50 p-3">
        <p className="text-xs font-extrabold text-slate-400">업로드한 사람</p>
        <p className="mt-1 truncate text-sm font-extrabold text-slate-800">
          {item.submitterName || "-"}
        </p>
      </div>

      <div className="rounded-2xl bg-slate-50 p-3">
        <p className="text-xs font-extrabold text-slate-400">사용 템플릿</p>
        <p className="mt-1 truncate text-sm font-extrabold text-slate-800">
          {getTemplateName(item)}
        </p>
      </div>
    </div>

    <div className="mt-4 flex items-center justify-between gap-3">
      <StatusBadge status={item.status} />
      <p className="truncate text-xs font-bold text-slate-400">
        {item.documentTypeName || "-"}
      </p>
    </div>
  </article>
);

