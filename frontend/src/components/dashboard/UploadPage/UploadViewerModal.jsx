import { FiChevronLeft, FiChevronRight, FiX } from 'react-icons/fi';
import UploadPreviewContent from './UploadPreviewContent';
import { formatFileSize } from './uploadPage.utils.js';

const UploadViewerModal = ({
  open,
  files,
  activeIndex,
  activeFile,
  activePreview,
  onClose,
  onPrev,
  onNext,
}) => {
  if (!open || !activePreview || !['image', 'pdf'].includes(activePreview.type)) return null;

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/95 p-4">
      <div className="mx-auto flex h-full max-w-7xl flex-col">
        <div className="mb-3 flex items-center justify-between gap-3 rounded-2xl bg-white/10 p-3 text-white">
          <div className="min-w-0">
            <p className="truncate text-sm font-extrabold">{activeFile?.name}</p>
            <p className="text-xs font-bold text-white/60">
              {activeIndex + 1} / {files.length} · {formatFileSize(activeFile?.size)} · {activePreview.type === 'pdf' ? 'PDF' : '이미지'}
            </p>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="flex h-10 w-10 items-center justify-center rounded-2xl bg-white/10 text-white transition hover:bg-white/20"
          >
            <FiX />
          </button>
        </div>

        <div className="relative flex-1">
          <UploadPreviewContent activeFile={activeFile} activePreview={activePreview} isModal />

          {files.length > 1 && (
            <>
              <button
                type="button"
                onClick={onPrev}
                className="absolute left-4 top-1/2 flex h-12 w-12 -translate-y-1/2 items-center justify-center rounded-full bg-white/90 text-slate-900 shadow-sm transition hover:bg-white"
              >
                <FiChevronLeft />
              </button>
              <button
                type="button"
                onClick={onNext}
                className="absolute right-4 top-1/2 flex h-12 w-12 -translate-y-1/2 items-center justify-center rounded-full bg-white/90 text-slate-900 shadow-sm transition hover:bg-white"
              >
                <FiChevronRight />
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default UploadViewerModal;
