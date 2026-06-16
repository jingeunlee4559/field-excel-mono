import { Check } from "lucide-react";

import {
  DOCUMENT_TYPE_OPTIONS,
  FIELD_GROUP_LABELS,
  FIELD_GROUP_ORDER,
  MAPPING_TYPE_OPTIONS,
} from "./mappingPage.parts.jsx";

const MappingFieldSidebar = ({
  isReadOnly,
  selectedDocumentType,
  showAdvancedFields,
  currentMappingType,
  sortedFields,
  groupedFields,
  selectedMappingMap,
  selectedFieldKey,
  selectedMappings,
  onDocumentTypeChange,
  onToggleAdvancedFields,
  onMappingTypeChange,
  onFieldSelect,
  onRemoveMapping,
  onMaxRowsChange,
}) => (
  <aside className="flex min-w-0 flex-col gap-4 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:rounded-3xl sm:p-5 xl:sticky xl:top-4 xl:max-h-[calc(100vh-120px)] xl:overflow-y-auto">
    <div>
      <h2 className="text-lg font-black text-slate-950">표준 필드</h2>
      <p className="mt-1 text-sm text-slate-500">
        {isReadOnly
          ? "저장된 매핑 필드와 위치를 확인할 수 있습니다."
          : "필드를 선택한 뒤 엑셀 셀을 클릭하세요."}
      </p>
    </div>

    <div className="rounded-2xl border border-slate-200 bg-slate-50 p-3">
      <label className="mb-2 block text-xs font-black text-slate-500">자료유형</label>
      <select
        value={selectedDocumentType}
        onChange={(event) => onDocumentTypeChange(event.target.value)}
        className="h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm font-bold text-slate-800 outline-none"
      >
        {DOCUMENT_TYPE_OPTIONS.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>

      <button
        type="button"
        onClick={onToggleAdvancedFields}
        className="mt-3 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-black text-slate-600 hover:bg-slate-50"
      >
        {showAdvancedFields ? "기본 필드만 보기" : "고급 필드까지 보기"}
      </button>

      <div className="mt-3 grid grid-cols-2 gap-2">
        {MAPPING_TYPE_OPTIONS.map((option) => (
          <button
            key={option.value}
            type="button"
            disabled={isReadOnly}
            onClick={() => onMappingTypeChange(option.value)}
            className={[
              "rounded-xl px-3 py-3 text-sm font-black transition",
              currentMappingType === option.value
                ? "bg-slate-950 text-white"
                : "bg-white text-slate-600 hover:bg-slate-50",
              isReadOnly ? "cursor-not-allowed opacity-60" : "",
            ].join(" ")}
            title={option.description}
          >
            {option.label}
          </button>
        ))}
      </div>
    </div>

    <div className="flex flex-col gap-4">
      {sortedFields.length === 0 && (
        <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-5 text-sm font-bold text-slate-500">
          선택한 자료유형과 매핑 방식에 표시할 표준 필드가 없습니다.
        </div>
      )}

      {FIELD_GROUP_ORDER.filter((group) => groupedFields[group]?.length).map((group) => (
        <section key={group} className="flex flex-col gap-2">
          <div className="flex items-center justify-between px-1">
            <h3 className="text-sm font-black text-slate-800">
              {FIELD_GROUP_LABELS[group] || group}
            </h3>
            <span className="text-xs font-bold text-slate-400">
              {groupedFields[group].length}개
            </span>
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-2">
            {groupedFields[group].map((field) => {
              const mapped = selectedMappingMap[field.fieldKey];
              const active = selectedFieldKey === field.fieldKey;

              return (
                <button
                  key={field.fieldKey}
                  type="button"
                  onClick={() => onFieldSelect(field.fieldKey)}
                  className={[
                    "relative rounded-2xl border p-4 text-left transition",
                    active
                      ? "border-blue-500 bg-blue-50 ring-2 ring-blue-100"
                      : "border-slate-200 bg-white hover:bg-slate-50",
                    isReadOnly ? "cursor-default" : "",
                  ].join(" ")}
                >
                  {mapped && <Check size={16} className="absolute right-3 top-3 text-emerald-500" />}

                  <div className="font-black text-slate-900">{field.fieldLabel}</div>
                  <div className="mt-1 truncate text-[11px] font-semibold text-slate-400">
                    {field.fieldKey}
                  </div>

                  <div className="mt-3 flex flex-wrap gap-1">
                    <span className="rounded-full bg-slate-100 px-2 py-1 text-[11px] font-bold text-slate-500">
                      {field.defaultMappingType === "SINGLE_CELL" ? "상단" : "반복"}
                    </span>

                    {field.isRequired && (
                      <span className="rounded-full bg-rose-100 px-2 py-1 text-[11px] font-bold text-rose-600">
                        필수
                      </span>
                    )}

                    {field.advancedYn === "Y" && (
                      <span className="rounded-full bg-purple-100 px-2 py-1 text-[11px] font-bold text-purple-600">
                        고급
                      </span>
                    )}

                    {mapped && (
                      <span className="rounded-full bg-emerald-100 px-2 py-1 text-[11px] font-bold text-emerald-600">
                        매핑됨
                      </span>
                    )}
                  </div>
                </button>
              );
            })}
          </div>
        </section>
      ))}
    </div>

    <div className="rounded-2xl border border-slate-200 bg-white p-4">
      <div className="mb-3 flex items-center justify-between">
        <div className="text-sm font-black text-slate-900">선택된 매핑</div>
        <div className="text-xs font-bold text-slate-400">{selectedMappings.length}개</div>
      </div>

      <div className="flex max-h-[320px] flex-col gap-2 overflow-y-auto pr-1">
        {selectedMappings.length === 0 && (
          <div className="rounded-xl bg-slate-50 px-3 py-4 text-sm text-slate-500">
            아직 저장된 매핑이 없습니다.
          </div>
        )}

        {selectedMappings
          .slice()
          .sort((a, b) => (a.sortOrder || 0) - (b.sortOrder || 0))
          .map((mapping) => (
            <div key={mapping.fieldKey} className="rounded-2xl border border-slate-200 bg-slate-50 p-3">
              <div className="flex items-center justify-between gap-2">
                <div>
                  <div className="font-black text-slate-900">{mapping.fieldLabel}</div>
                  <div className="mt-1 text-xs font-semibold text-slate-500">
                    {mapping.mappingType === "SINGLE_CELL"
                      ? `단일 셀 · ${mapping.cellAddress}`
                      : `반복 컬럼 · ${mapping.columnLetter}${mapping.startRow}`}
                  </div>
                </div>

                {!isReadOnly && (
                  <button
                    type="button"
                    onClick={() => onRemoveMapping(mapping.fieldKey)}
                    className="rounded-lg px-2 py-1 text-xs font-bold text-rose-500 hover:bg-rose-50"
                  >
                    삭제
                  </button>
                )}
              </div>

              {mapping.mappingType === "REPEAT_COLUMN" && (
                <div className="mt-3 flex items-center gap-2 text-xs">
                  <span className="font-bold text-slate-500">최대 행</span>
                  <input
                    type="number"
                    min="1"
                    max="200"
                    value={mapping.maxRows || ""}
                    disabled={isReadOnly}
                    onChange={(event) => onMaxRowsChange(mapping.fieldKey, event.target.value)}
                    className="h-8 w-20 rounded-lg border border-slate-200 bg-white px-2 text-xs font-bold outline-none disabled:bg-slate-100"
                  />
                </div>
              )}
            </div>
          ))}
      </div>
    </div>
  </aside>
);

export default MappingFieldSidebar;
