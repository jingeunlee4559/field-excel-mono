import { FiFile, FiMaximize2, FiUploadCloud } from 'react-icons/fi';

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

  return (
    <div
      className={`flex flex-col items-center justify-center rounded-3xl bg-slate-50 text-center ${
        isModal ? 'h-[78vh]' : 'h-[460px]'
      }`}
    >
      <FiFile className="text-6xl text-slate-300" />
      <p className="mt-4 text-base font-extrabold text-slate-900">PDF 파일</p>
      <p className="mt-2 max-w-md text-sm font-bold text-slate-400">{activeFile.name}</p>
      <p className="mt-1 text-xs font-bold text-slate-400">
        PDF는 서버 처리 대상이며, 화면에서는 파일 카드로 표시됩니다.
      </p>
    </div>
  );
};

export default UploadPreviewContent;
