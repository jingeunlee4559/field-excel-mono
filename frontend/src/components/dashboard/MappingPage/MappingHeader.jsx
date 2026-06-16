import { Lock, RefreshCw, Save, Unlock } from 'lucide-react';

const MappingHeader = ({
  templates,
  selectedTemplate,
  selectedTemplateId,
  selectedMappingsCount,
  warning,
  saving,
  isReadOnly,
  onTemplateChange,
  onRefresh,
  onSave,
  isInvalidTemplateId,
}) => (
  <div className="flex flex-col gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:rounded-3xl sm:p-5">
    <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
      <div>
        <h1 className="text-2xl font-black text-slate-950">엑셀 템플릿 매핑 설정</h1>
        <p className="mt-1 text-sm text-slate-500">
          업로드한 엑셀 양식을 실제 화면처럼 보면서 셀을 클릭해 표준 필드를 연결합니다.
        </p>
      </div>

      <div className="grid w-full grid-cols-1 gap-2 sm:flex sm:w-auto sm:flex-wrap sm:items-center">
        <select
          value={selectedTemplateId}
          onChange={onTemplateChange}
          className="h-11 w-full rounded-2xl border border-slate-200 bg-white px-4 text-sm font-bold text-slate-800 outline-none sm:min-w-[260px]"
        >
          <option value="">템플릿 선택</option>
          {templates.map((template) => {
            const value = template.templateId ?? template.id;
            return (
              <option key={value} value={value}>
                {template.templateName}
              </option>
            );
          })}
        </select>

        <button
          type="button"
          onClick={onRefresh}
          disabled={isInvalidTemplateId(selectedTemplateId)}
          className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 text-sm font-bold text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50 sm:w-auto"
        >
          <RefreshCw size={16} />
          새로고침
        </button>

        {!isReadOnly ? (
          <button
            type="button"
            onClick={onSave}
            disabled={saving || selectedMappingsCount === 0 || isInvalidTemplateId(selectedTemplateId)}
            className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-2xl bg-slate-950 px-5 text-sm font-black text-white disabled:cursor-not-allowed disabled:bg-slate-300 sm:w-auto"
          >
            <Save size={16} />
            {saving ? '저장 중...' : '매핑 저장'}
          </button>
        ) : (
          <div className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-2xl bg-slate-100 px-5 text-sm font-black text-slate-600 sm:w-auto">
            <Lock size={16} />
            확인 전용
          </div>
        )}
      </div>
    </div>

    {selectedTemplate && (
      <div className="flex flex-wrap items-center gap-2 text-sm text-slate-500">
        <span className="font-bold text-slate-800">{selectedTemplate.templateName}</span>
        {selectedTemplate.originalFileName && <span>{selectedTemplate.originalFileName}</span>}
        <span className="rounded-full bg-slate-100 px-2 py-1 text-xs font-bold">{selectedTemplate.status}</span>
        {isReadOnly ? (
          <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-1 text-xs font-bold text-amber-700">
            <Lock size={12} />
            수정 불가
          </span>
        ) : (
          <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2 py-1 text-xs font-bold text-emerald-700">
            <Unlock size={12} />
            편집 가능
          </span>
        )}
      </div>
    )}

    {isReadOnly && (
      <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-semibold text-amber-800">
        저장된 매핑을 확인하는 화면입니다. 한 번 저장된 매핑은 이 화면에서 수정할 수 없습니다.
      </div>
    )}

    {warning && (
      <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-700">
        {warning}
      </div>
    )}
  </div>
);

export default MappingHeader;
