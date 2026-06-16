import { FiPlus, FiRefreshCw, FiTrash2, FiUploadCloud } from 'react-icons/fi';
import { ACCEPTED_FILES } from './uploadPage.constants.js';

const UploadTemplateForm = ({
  fileInputRef,
  title,
  templateId,
  templates,
  templateLoading,
  documentType,
  selectedTemplate,
  fileCount,
  imageCount,
  pdfCount,
  totalSizeText,
  uploading,
  onTitleChange,
  onResetAutoTitle,
  onTemplateChange,
  onFileChange,
  onOpenFilePicker,
  onClearFiles,
}) => (
  <section className="rounded-3xl bg-white p-6 shadow-sm ring-1 ring-slate-200">
    <div className="grid gap-4 md:grid-cols-2">
      <label className="block">
        <div className="flex items-center justify-between gap-2">
          <span className="text-xs font-extrabold text-slate-500">업로드 제목</span>
          <button
            type="button"
            onClick={onResetAutoTitle}
            className="text-[11px] font-extrabold text-blue-600 hover:text-blue-700"
          >
            자동 제목 적용
          </button>
        </div>

        <input
          type="text"
          value={title}
          onChange={onTitleChange}
          placeholder="예: 2026-06-09 A현장 영수증"
          className="mt-2 h-11 w-full rounded-2xl border border-slate-200 px-4 text-sm font-bold outline-none focus:border-slate-400 focus:ring-4 focus:ring-slate-100"
        />

        <p className="mt-1 text-[11px] font-bold text-slate-400">
          자동완성 기준: 날짜 + 현장명 + 문서유형
        </p>
      </label>

      <label className="block">
        <span className="text-xs font-extrabold text-slate-500">템플릿명 선택</span>
        <select
          value={templateId}
          onChange={onTemplateChange}
          disabled={templateLoading}
          className="mt-2 h-11 w-full rounded-2xl border border-slate-200 bg-white px-4 text-sm font-bold outline-none focus:border-slate-400 focus:ring-4 focus:ring-slate-100 disabled:bg-slate-100 disabled:text-slate-400"
        >
          <option value="">템플릿을 선택하세요</option>
          {templates.map((template) => (
            <option key={template.templateId} value={template.templateId}>
              {template.templateName} · v{template.version || 1} · {template.status}
            </option>
          ))}
        </select>

        <p className="mt-1 text-[11px] font-bold text-slate-400">
          선택한 템플릿 파일과 매핑 정보를 기준으로 자사 양식 엑셀에 자동 입력됩니다.
        </p>
      </label>
    </div>

    <div className="mt-4 grid gap-3 md:grid-cols-2">
      <div className="rounded-2xl bg-slate-50 p-4">
        <div className="text-xs font-extrabold text-slate-400">문서유형</div>
        <div className="mt-1 text-sm font-extrabold text-slate-950">{documentType}</div>
      </div>

      <div className="rounded-2xl bg-slate-50 p-4">
        <div className="text-xs font-extrabold text-slate-400">선택 템플릿</div>
        <div className="mt-1 truncate text-sm font-extrabold text-slate-950">
          {selectedTemplate?.templateName || '템플릿 미선택'}
        </div>
      </div>
    </div>

    <input
      ref={fileInputRef}
      type="file"
      multiple
      accept={ACCEPTED_FILES}
      onChange={onFileChange}
      className="hidden"
    />

    <button
      type="button"
      onClick={onOpenFilePicker}
      className="mt-6 flex min-h-[190px] w-full flex-col items-center justify-center rounded-3xl border-2 border-dashed border-slate-200 bg-slate-50 p-8 text-center transition hover:border-slate-400 hover:bg-white"
    >
      <FiUploadCloud className="text-5xl text-slate-400" />
      <p className="mt-4 text-base font-extrabold text-slate-950">이미지 또는 PDF 추가</p>
      <p className="mt-2 text-sm text-slate-500">
        파일을 한 번에 여러 개 선택하거나, 나중에 다시 눌러 하나씩 추가할 수 있습니다.
      </p>
      <span className="mt-4 inline-flex h-10 items-center justify-center gap-2 rounded-2xl bg-slate-950 px-5 text-xs font-extrabold text-white">
        <FiPlus />
        파일 추가하기
      </span>
    </button>

    <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <div>
        <p className="text-sm font-bold text-slate-500">
          선택 파일 {fileCount}개 · 이미지 {imageCount}개 · PDF {pdfCount}개
        </p>
        <p className="mt-1 text-xs font-bold text-slate-400">전체 용량 {totalSizeText}</p>
      </div>

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={onOpenFilePicker}
          className="inline-flex h-12 items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-white px-5 text-sm font-extrabold text-slate-700 transition hover:bg-slate-50"
        >
          <FiPlus />
          추가
        </button>

        <button
          type="button"
          onClick={onClearFiles}
          disabled={fileCount === 0 || uploading}
          className="inline-flex h-12 items-center justify-center gap-2 rounded-2xl border border-red-100 bg-red-50 px-5 text-sm font-extrabold text-red-500 transition hover:bg-red-100 disabled:cursor-not-allowed disabled:opacity-50"
        >
          <FiTrash2 />
          전체 삭제
        </button>

        <button
          type="submit"
          disabled={fileCount === 0 || uploading || !templateId}
          className="inline-flex h-12 items-center justify-center gap-2 rounded-2xl bg-blue-600 px-6 text-sm font-extrabold text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-slate-200 disabled:text-slate-400"
        >
          <FiRefreshCw className={uploading ? 'animate-spin' : ''} />
          {uploading ? '업로드 중' : '업로드 접수'}
        </button>
      </div>
    </div>
  </section>
);

export default UploadTemplateForm;
