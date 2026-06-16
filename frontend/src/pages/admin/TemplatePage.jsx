import React, { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  FiArchive,
  FiCheckCircle,
  FiFileText,
  FiPlus,
  FiRefreshCw,
  FiSearch,
  FiUploadCloud,
  FiX,
} from "react-icons/fi";

import { templateApi } from "../../api";
import { alertError, alertSuccess, alertWarning } from "../../utils/swal";

const STATUS_LABEL = {
  DRAFT: "초안",
  ACTIVE: "활성",
  INACTIVE: "비활성",
  ARCHIVED: "보관",
};

const STATUS_CLASS = {
  DRAFT: "bg-blue-50 text-blue-600 ring-blue-100",
  ACTIVE: "bg-emerald-50 text-emerald-600 ring-emerald-100",
  INACTIVE: "bg-slate-100 text-slate-500 ring-slate-200",
  ARCHIVED: "bg-orange-50 text-orange-600 ring-orange-100",
};

const TemplatePage = () => {
  const navigate = useNavigate();
  const fileInputRef = useRef(null);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [templates, setTemplates] = useState([]);
  const [keyword, setKeyword] = useState("");
  const [statusFilter, setStatusFilter] = useState("");

  const [formData, setFormData] = useState({
    templateName: "",
    description: "",
    file: null,
  });

  const safeList = (result) => {
    if (!result) return [];

    if (Array.isArray(result)) return result;
    if (Array.isArray(result.data)) return result.data;
    if (Array.isArray(result.items)) return result.items;
    if (Array.isArray(result.templates)) return result.templates;

    if (result.data && Array.isArray(result.data.items)) {
      return result.data.items;
    }

    if (result.data && Array.isArray(result.data.templates)) {
      return result.data.templates;
    }

    return [];
  };

  const getTemplateId = (item) => {
    return item.id || item.templateId || item.template_id;
  };

  const loadTemplates = async () => {
    try {
      setLoading(true);

      const result = await templateApi.getTemplates({
        status: statusFilter || undefined,
        page: 1,
        size: 50,
      });

      setTemplates(safeList(result));
    } catch (error) {
      console.error("템플릿 목록 조회 실패:", error);

      await alertError(
        "조회 실패",
        error.response?.data?.message || "템플릿 목록을 불러오지 못했습니다."
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadTemplates();
  }, [statusFilter]);

  const filteredTemplates = useMemo(() => {
    const normalizedKeyword = keyword.trim().toLowerCase();

    if (!normalizedKeyword) {
      return templates;
    }

    return templates.filter((item) => {
      const templateName =
        item.templateName || item.template_name || item.name || "";
      const description = item.description || "";
      const fileName =
        item.originalFileName ||
        item.original_file_name ||
        item.fileName ||
        item.file_name ||
        "";

      return (
        templateName.toLowerCase().includes(normalizedKeyword) ||
        description.toLowerCase().includes(normalizedKeyword) ||
        fileName.toLowerCase().includes(normalizedKeyword)
      );
    });
  }, [templates, keyword]);

  const draftCount = templates.filter((item) => item.status === "DRAFT").length;
  const activeCount = templates.filter(
    (item) => item.status === "ACTIVE"
  ).length;
  const inactiveCount = templates.filter(
    (item) => item.status === "INACTIVE"
  ).length;
  const archivedCount = templates.filter(
    (item) => item.status === "ARCHIVED"
  ).length;

  const handleInputChange = (e) => {
    const { name, value } = e.target;

    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  const handleFileChange = async (e) => {
    const selectedFile = e.target.files?.[0];

    if (!selectedFile) return;

    const allowedExtensions = [".xlsx", ".xlsm", ".xls"];
    const lowerName = selectedFile.name.toLowerCase();
    const isExcel = allowedExtensions.some((ext) => lowerName.endsWith(ext));

    if (!isExcel) {
      await alertWarning(
        "파일 형식 확인",
        "엑셀 템플릿 파일만 업로드할 수 있습니다. xlsx, xlsm, xls 파일을 선택해주세요."
      );

      e.target.value = "";
      return;
    }

    setFormData((prev) => {
      const nextTemplateName =
        prev.templateName ||
        selectedFile.name.replace(/\.[^/.]+$/, "");

      return {
        ...prev,
        file: selectedFile,
        templateName: nextTemplateName,
      };
    });
  };

  const resetForm = () => {
    setFormData({
      templateName: "",
      description: "",
      file: null,
    });

    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const handleCreateTemplate = async (e) => {
    e.preventDefault();

    if (!formData.templateName.trim()) {
      await alertWarning("입력 확인", "템플릿명을 입력해주세요.");
      return;
    }

    if (!formData.file) {
      await alertWarning("파일 확인", "엑셀 템플릿 파일을 선택해주세요.");
      return;
    }

    try {
      setSaving(true);

      const result = await templateApi.createTemplate({
        file: formData.file,
        templateName: formData.templateName.trim(),
        description: formData.description.trim(),
      });

      const templateId =
        result.templateId ||
        result.id ||
        result.data?.templateId ||
        result.data?.id;

      await alertSuccess(
        "등록 완료",
        "엑셀 템플릿이 등록되었습니다. 매핑 설정 페이지로 이동합니다."
      );

      resetForm();

      if (templateId) {
        navigate(`/mappings?templateId=${templateId}`);
        return;
      }

      await loadTemplates();
    } catch (error) {
      console.error("템플릿 등록 실패:", error);

      await alertError(
        "등록 실패",
        error.response?.data?.message || "템플릿 등록 중 오류가 발생했습니다."
      );
    } finally {
      setSaving(false);
    }
  };

  const handleActivateTemplate = async (item) => {
    const templateId = getTemplateId(item);

    if (!templateId) {
      await alertError("처리 실패", "템플릿 ID를 찾을 수 없습니다.");
      return;
    }

    const ok = window.confirm(
      "이 템플릿을 활성화하시겠습니까?\n활성화된 템플릿이 경비청구서 생성에 사용됩니다."
    );

    if (!ok) return;

    try {
      await templateApi.activateTemplate(templateId);

      await alertSuccess(
        "활성화 완료",
        "선택한 템플릿이 활성화되었습니다."
      );

      await loadTemplates();
    } catch (error) {
      console.error("템플릿 활성화 실패:", error);

      await alertError(
        "활성화 실패",
        error.response?.data?.message || "템플릿 활성화 중 오류가 발생했습니다."
      );
    }
  };

  const handleArchiveTemplate = async (item) => {
    const templateId = getTemplateId(item);

    if (!templateId) {
      await alertError("처리 실패", "템플릿 ID를 찾을 수 없습니다.");
      return;
    }

    const ok = window.confirm(
      "이 템플릿을 보관 처리하시겠습니까?\n보관된 템플릿은 일반 생성 흐름에서 사용하지 않습니다."
    );

    if (!ok) return;

    try {
      await templateApi.archiveTemplate(templateId);

      await alertSuccess("보관 완료", "선택한 템플릿이 보관 처리되었습니다.");

      await loadTemplates();
    } catch (error) {
      console.error("템플릿 보관 실패:", error);

      await alertError(
        "보관 실패",
        error.response?.data?.message || "템플릿 보관 처리 중 오류가 발생했습니다."
      );
    }
  };

  const handleGoMapping = (item) => {
    const templateId = getTemplateId(item);

    if (!templateId) {
      alertWarning("이동 불가", "템플릿 ID를 찾을 수 없습니다.");
      return;
    }

    navigate(`/mappings?templateId=${templateId}`);
  };

  return (
    <div className="space-y-6">
      <section className="rounded-3xl bg-slate-950 p-6 text-white shadow-sm">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <div className="mb-3 inline-flex items-center rounded-full bg-white/10 px-3 py-1 text-xs font-bold text-slate-200">
              시스템 관리자
            </div>

            <h2 className="text-2xl font-extrabold tracking-tight">
              템플릿 관리
            </h2>

            <p className="mt-2 text-sm leading-6 text-slate-300">
              회사에서 사용하는 경비청구서 엑셀 양식을 등록하고, 등록 후
              매핑 페이지에서 표준 필드와 셀 위치를 연결하세요.
            </p>
          </div>

          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="flex h-11 items-center justify-center gap-2 rounded-2xl bg-white px-4 text-sm font-extrabold text-slate-950 transition hover:bg-blue-50"
          >
            <FiUploadCloud size={16} />
            엑셀 파일 선택
          </button>
        </div>
      </section>

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <SummaryCard
          label="초안 템플릿"
          value={draftCount}
          icon={FiFileText}
          color="text-blue-600"
        />
        <SummaryCard
          label="활성 템플릿"
          value={activeCount}
          icon={FiCheckCircle}
          color="text-emerald-600"
        />
        <SummaryCard
          label="비활성 템플릿"
          value={inactiveCount}
          icon={FiRefreshCw}
          color="text-slate-600"
        />
        <SummaryCard
          label="보관 템플릿"
          value={archivedCount}
          icon={FiArchive}
          color="text-orange-600"
        />
      </section>

      <section className="grid gap-6 xl:grid-cols-[0.95fr_1.5fr]">
        <div className="rounded-3xl bg-white p-6 shadow-sm ring-1 ring-slate-200">
          <div className="mb-5">
            <h3 className="text-base font-extrabold text-slate-950">
              새 템플릿 등록
            </h3>
            <p className="mt-1 text-xs leading-5 text-slate-400">
              엑셀 양식을 등록하면 바로 매핑 설정 페이지로 이동합니다.
            </p>
          </div>

          <form onSubmit={handleCreateTemplate} className="space-y-4">
            <div>
              <label className="mb-2 block text-xs font-bold text-slate-600">
                템플릿명
              </label>

              <input
                type="text"
                name="templateName"
                value={formData.templateName}
                onChange={handleInputChange}
                placeholder="예: 경비청구서 양식"
                className="h-11 w-full rounded-2xl border border-slate-200 bg-white px-4 text-sm outline-none transition placeholder:text-slate-400 focus:border-slate-400 focus:ring-4 focus:ring-slate-100"
              />
            </div>

            <div>
              <label className="mb-2 block text-xs font-bold text-slate-600">
                설명
              </label>

              <textarea
                name="description"
                value={formData.description}
                onChange={handleInputChange}
                placeholder="예: 관리팀 경비청구서 자동 생성용 템플릿"
                rows={4}
                className="w-full resize-none rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none transition placeholder:text-slate-400 focus:border-slate-400 focus:ring-4 focus:ring-slate-100"
              />
            </div>

            <div>
              <label className="mb-2 block text-xs font-bold text-slate-600">
                엑셀 템플릿 파일
              </label>

              <input
                ref={fileInputRef}
                type="file"
                accept=".xlsx,.xlsm,.xls"
                onChange={handleFileChange}
                className="hidden"
              />

              {formData.file ? (
                <div className="flex items-center justify-between gap-3 rounded-2xl border border-blue-100 bg-blue-50 px-4 py-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-extrabold text-blue-700">
                      {formData.file.name}
                    </p>
                    <p className="mt-0.5 text-xs text-blue-500">
                      {(formData.file.size / 1024).toFixed(1)} KB
                    </p>
                  </div>

                  <button
                    type="button"
                    onClick={() => {
                      setFormData((prev) => ({
                        ...prev,
                        file: null,
                      }));

                      if (fileInputRef.current) {
                        fileInputRef.current.value = "";
                      }
                    }}
                    className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-white text-blue-600 transition hover:bg-blue-100"
                  >
                    <FiX />
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="flex w-full flex-col items-center justify-center rounded-2xl border-2 border-dashed border-slate-200 bg-slate-50 px-4 py-8 text-center transition hover:border-blue-200 hover:bg-blue-50"
                >
                  <FiUploadCloud className="text-2xl text-slate-400" />
                  <p className="mt-2 text-sm font-extrabold text-slate-700">
                    엑셀 파일 선택
                  </p>
                  <p className="mt-1 text-xs text-slate-400">
                    xlsx, xlsm, xls 파일만 등록 가능
                  </p>
                </button>
              )}
            </div>

            <button
              type="submit"
              disabled={saving}
              className="flex h-12 w-full items-center justify-center gap-2 rounded-2xl bg-slate-950 text-sm font-extrabold text-white transition hover:bg-blue-600 disabled:cursor-not-allowed disabled:bg-slate-400"
            >
              <FiPlus size={16} />
              {saving ? "등록 중..." : "템플릿 등록 후 매핑하기"}
            </button>
          </form>
        </div>

        <div className="rounded-3xl bg-white p-6 shadow-sm ring-1 ring-slate-200">
          <div className="mb-5 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <h3 className="text-base font-extrabold text-slate-950">
                템플릿 목록
              </h3>
              <p className="mt-1 text-xs text-slate-400">
                등록된 경비청구서 엑셀 양식을 확인하고 매핑을 설정하세요.
              </p>
            </div>

            <button
              type="button"
              onClick={loadTemplates}
              className="flex h-10 items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 text-xs font-extrabold text-slate-600 transition hover:bg-slate-50"
            >
              <FiRefreshCw size={14} />
              새로고침
            </button>
          </div>

          <div className="mb-5 grid gap-3 md:grid-cols-[1fr_150px]">
            <div className="relative">
              <FiSearch
                size={16}
                className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400"
              />

              <input
                type="text"
                value={keyword}
                onChange={(e) => setKeyword(e.target.value)}
                placeholder="템플릿명, 파일명 검색"
                className="h-11 w-full rounded-2xl border border-slate-200 bg-white pl-10 pr-4 text-sm outline-none transition placeholder:text-slate-400 focus:border-slate-400 focus:ring-4 focus:ring-slate-100"
              />
            </div>

            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="h-11 rounded-2xl border border-slate-200 bg-white px-4 text-sm font-bold text-slate-600 outline-none transition focus:border-slate-400 focus:ring-4 focus:ring-slate-100"
            >
              <option value="">전체 상태</option>
              <option value="DRAFT">초안</option>
              <option value="ACTIVE">활성</option>
              <option value="INACTIVE">비활성</option>
              <option value="ARCHIVED">보관</option>
            </select>
          </div>

          {loading ? (
            <div className="space-y-3">
              {[1, 2, 3].map((item) => (
                <div
                  key={item}
                  className="h-20 animate-pulse rounded-2xl bg-slate-100"
                />
              ))}
            </div>
          ) : filteredTemplates.length > 0 ? (
            <div className="space-y-3">
              {filteredTemplates.map((item, index) => (
                <TemplateListItem
                  key={getTemplateId(item) || index}
                  item={item}
                  onMapping={() => handleGoMapping(item)}
                  onActivate={() => handleActivateTemplate(item)}
                  onArchive={() => handleArchiveTemplate(item)}
                />
              ))}
            </div>
          ) : (
            <div className="rounded-2xl bg-slate-50 px-4 py-12 text-center">
              <FiFileText className="mx-auto text-3xl text-slate-300" />
              <p className="mt-3 text-sm font-extrabold text-slate-500">
                등록된 템플릿이 없습니다.
              </p>
              <p className="mt-1 text-xs text-slate-400">
                왼쪽 등록 영역에서 엑셀 템플릿을 추가하세요.
              </p>
            </div>
          )}
        </div>
      </section>
    </div>
  );
};

const SummaryCard = ({ label, value, icon: Icon, color }) => {
  return (
    <div className="rounded-3xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
      <div className="flex items-center justify-between">
        <p className="text-xs font-bold text-slate-400">{label}</p>

        <div className="flex h-9 w-9 items-center justify-center rounded-2xl bg-slate-100 text-slate-600">
          <Icon size={17} />
        </div>
      </div>

      <p className={`mt-4 text-3xl font-extrabold ${color}`}>{value}</p>
    </div>
  );
};

const TemplateListItem = ({ item, onMapping, onActivate, onArchive }) => {
  const templateName =
    item.templateName || item.template_name || item.name || "이름 없는 템플릿";

  const description = item.description || "설명 없음";

  const originalFileName =
    item.originalFileName ||
    item.original_file_name ||
    item.fileName ||
    item.file_name ||
    "파일명 없음";

  const status = item.status || "DRAFT";
  const statusLabel = STATUS_LABEL[status] || status;
  const statusClass =
    STATUS_CLASS[status] || "bg-slate-100 text-slate-500 ring-slate-200";

  const version = item.version || 1;
  const createdAt = item.createdAt || item.created_at || "";
  const updatedAt = item.updatedAt || item.updated_at || "";

  return (
    <div className="rounded-2xl border border-slate-100 bg-white p-4 transition hover:bg-slate-50">
      <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <p className="truncate text-sm font-extrabold text-slate-950">
              {templateName}
            </p>

            <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-extrabold text-slate-500">
              v{version}
            </span>

            <span
              className={`rounded-full px-2.5 py-1 text-[11px] font-extrabold ring-1 ${statusClass}`}
            >
              {statusLabel}
            </span>
          </div>

          <p className="mt-1 truncate text-xs text-slate-400">
            {description}
          </p>

          <div className="mt-3 flex flex-wrap gap-2 text-[11px] font-bold text-slate-400">
            <span className="rounded-full bg-slate-100 px-2.5 py-1">
              파일: {originalFileName}
            </span>

            {createdAt && (
              <span className="rounded-full bg-slate-100 px-2.5 py-1">
                등록: {formatDate(createdAt)}
              </span>
            )}

            {updatedAt && (
              <span className="rounded-full bg-slate-100 px-2.5 py-1">
                수정: {formatDate(updatedAt)}
              </span>
            )}
          </div>
        </div>

        <div className="flex shrink-0 flex-wrap gap-2">
          <button
            type="button"
            onClick={onMapping}
            className="flex h-9 items-center gap-1.5 rounded-xl bg-blue-50 px-3 text-xs font-extrabold text-blue-600 transition hover:bg-blue-100"
          >
            <FiFileText size={14} />
            매핑 설정
          </button>

          {status !== "ACTIVE" && status !== "ARCHIVED" && (
            <button
              type="button"
              onClick={onActivate}
              className="flex h-9 items-center gap-1.5 rounded-xl bg-emerald-50 px-3 text-xs font-extrabold text-emerald-600 transition hover:bg-emerald-100"
            >
              <FiCheckCircle size={14} />
              활성화
            </button>
          )}

          {status !== "ARCHIVED" && (
            <button
              type="button"
              onClick={onArchive}
              className="flex h-9 items-center gap-1.5 rounded-xl bg-orange-50 px-3 text-xs font-extrabold text-orange-600 transition hover:bg-orange-100"
            >
              <FiArchive size={14} />
              보관
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

const formatDate = (value) => {
  if (!value) return "";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return date.toLocaleDateString("ko-KR", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
};

export default TemplatePage;