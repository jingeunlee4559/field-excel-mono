import { FiChevronLeft, FiChevronRight, FiFile, FiImage, FiTrash2 } from 'react-icons/fi';
import UploadPreviewContent from './UploadPreviewContent';
import UploadFileList from './UploadFileList';
import { formatFileSize, isImageFile } from './uploadPage.utils.js';

const UploadPreviewPanel = ({
  files,
  previews,
  activeIndex,
  activeFile,
  activePreview,
  onPrev,
  onNext,
  onOpenViewer,
  onSelectFile,
  onRemoveFile,
  onOpenFilePicker,
}) => (
  <section className="space-y-4">
    <div className="rounded-3xl bg-white p-6 shadow-sm ring-1 ring-slate-200">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h3 className="text-base font-extrabold text-slate-950">원본 미리보기</h3>
          <p className="mt-1 text-xs font-bold text-slate-400">
            이미지와 PDF를 슬라이드로 넘겨보며 원본 비율로 확인할 수 있습니다.
          </p>
        </div>

        {files.length > 0 && (
          <div className="rounded-2xl bg-slate-100 px-4 py-2 text-xs font-extrabold text-slate-600">
            {activeIndex + 1} / {files.length}
          </div>
        )}
      </div>

      <div className="relative mt-4">
        <UploadPreviewContent
          activeFile={activeFile}
          activePreview={activePreview}
          onOpenViewer={onOpenViewer}
        />

        {files.length > 1 && (
          <>
            <button
              type="button"
              onClick={onPrev}
              className="absolute left-4 top-1/2 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full bg-white/90 text-slate-700 shadow-sm transition hover:bg-white"
            >
              <FiChevronLeft />
            </button>
            <button
              type="button"
              onClick={onNext}
              className="absolute right-4 top-1/2 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full bg-white/90 text-slate-700 shadow-sm transition hover:bg-white"
            >
              <FiChevronRight />
            </button>
          </>
        )}
      </div>

      {activeFile && (
        <div className="mt-4 flex items-center gap-3 rounded-2xl border border-slate-100 p-3">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-slate-100 text-slate-500">
            {isImageFile(activeFile) ? <FiImage /> : <FiFile />}
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-extrabold text-slate-900">{activeFile.name}</p>
            <p className="text-xs font-bold text-slate-400">{formatFileSize(activeFile.size)}</p>
          </div>
          <button
            type="button"
            onClick={() => onRemoveFile(activeIndex)}
            className="inline-flex h-10 items-center justify-center gap-2 rounded-2xl bg-red-50 px-4 text-xs font-extrabold text-red-500 transition hover:bg-red-100"
          >
            <FiTrash2 />
            삭제
          </button>
        </div>
      )}

      <UploadFileList
        files={files}
        previews={previews}
        activeIndex={activeIndex}
        onSelectFile={onSelectFile}
        onRemoveFile={onRemoveFile}
        onOpenFilePicker={onOpenFilePicker}
      />
    </div>
  </section>
);

export default UploadPreviewPanel;
