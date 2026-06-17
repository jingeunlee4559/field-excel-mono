import { FiExternalLink, FiFile, FiMaximize2, FiUploadCloud } from 'react-icons/fi';

const buildPdfPreviewUrl = (url) => {
  if (!url) return '';
  if (url.includes('#')) return url;
  return `${url}#toolbar=1&navpanes=0&view=FitH`;
};

const UploadPreviewContent = ({ activeFile, activePreview, isModal = false, onOpenViewer }) => {
  if (!activeFile || !activePreview) {
    return (
      <div className="flex min-h-[360px] flex-col items-center justify-center rounded-3xl bg-slate-50 text-center">
        <FiUploadCloud className="text-5xl text-slate-300" />
        <p className="mt-4 text-sm font-extrabold text-slate-400">
          파일을 추가하면 원본 미리보기가 표시됩니다.
        </p>
      </div>
    );
  }

  if (activePreview.type === 'image') {
    return (
      <div
        className={`relative flex items-center justify-center overflow-hidden rounded-3xl bg-slate-950 ${
          isModal ? 'h-[78vh]' : 'h-[460px]'
        }`}
      >
        <img src={activePreview.url} alt={activeFile.name} className="h-full w-full object-contain" />
        {!isModal && (
          <button
            type="button"
            onClick={onOpenViewer}
            className="absolute right-4 top-4 inline-flex h-10 items-center justify-center gap-2 rounded-2xl bg-white/90 px-4 text-xs font-extrabold text-slate-900 shadow-sm transition hover:bg-white"
          >
            <FiMaximize2 />
            원본 크게 보기
          </button>
        )}
      </div>
    );
  }

  if (activePreview.type === 'pdf') {
    const pdfUrl = buildPdfPreviewUrl(activePreview.url);

    return (
      <div
        className={`relative overflow-hidden rounded-3xl bg-slate-100 ring-1 ring-slate-200 ${
          isModal ? 'h-[78vh]' : 'h-[520px]'
        }`}
      >
        {pdfUrl ? (
          <iframe
            title={activeFile.name || 'PDF 미리보기'}
            src={pdfUrl}
            className="h-full w-full border-0 bg-white"
          />
        ) : (
          <div className="flex h-full flex-col items-center justify-center text-center">
            <FiFile className="text-6xl text-slate-300" />
            <p className="mt-4 text-base font-extrabold text-slate-900">PDF 파일</p>
            <p className="mt-2 max-w-md text-sm font-bold text-slate-400">미리보기 URL을 만들 수 없습니다.</p>
          </div>
        )}

        <div className="pointer-events-none absolute inset-x-0 bottom-0 flex items-center justify-between gap-3 bg-gradient-to-t from-slate-950/75 to-transparent p-4 text-white">
          <div className="min-w-0">
            <p className="truncate text-xs font-black">PDF 미리보기</p>
            <p className="mt-0.5 truncate text-[11px] font-bold text-white/75">{activeFile.name}</p>
          </div>

          <div className="pointer-events-auto flex shrink-0 items-center gap-2">
            {!isModal && (
              <button
                type="button"
                onClick={onOpenViewer}
                className="inline-flex h-10 items-center justify-center gap-2 rounded-2xl bg-white/90 px-4 text-xs font-extrabold text-slate-900 shadow-sm transition hover:bg-white"
              >
                <FiMaximize2 />
                크게보기
              </button>
            )}
            <a
              href={activePreview.url}
              target="_blank"
              rel="noreferrer"
              className="inline-flex h-10 items-center justify-center gap-2 rounded-2xl bg-white/90 px-4 text-xs font-extrabold text-slate-900 shadow-sm transition hover:bg-white"
            >
              <FiExternalLink />
              새 창
            </a>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      className={`flex flex-col items-center justify-center rounded-3xl bg-slate-50 text-center ${
        isModal ? 'h-[78vh]' : 'h-[460px]'
      }`}
    >
      <FiFile className="text-6xl text-slate-300" />
      <p className="mt-4 text-base font-extrabold text-slate-900">지원하지 않는 파일</p>
      <p className="mt-2 max-w-md text-sm font-bold text-slate-400">{activeFile.name}</p>
    </div>
  );
};

export default UploadPreviewContent;
