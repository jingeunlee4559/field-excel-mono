import { FiFile, FiPlus, FiX } from 'react-icons/fi';
import { formatFileSize } from './uploadPage.utils.js';

const UploadFileList = ({ files, previews, activeIndex, onSelectFile, onRemoveFile, onOpenFilePicker }) => {
  if (files.length === 0) return null;

  return (
    <div className="mt-5">
      <div className="mb-2 flex items-center justify-between">
        <p className="text-xs font-extrabold text-slate-500">파일 목록</p>
        <button
          type="button"
          onClick={onOpenFilePicker}
          className="inline-flex items-center gap-1 text-xs font-extrabold text-blue-600 hover:text-blue-700"
        >
          <FiPlus />
          파일 추가
        </button>
      </div>

      <div className="grid max-h-[320px] gap-3 overflow-y-auto pr-1 sm:grid-cols-2">
        {files.map((file, index) => {
          const preview = previews[index];
          const isActive = index === activeIndex;

          return (
            <button
              key={`${file.name}-${file.size}-${file.lastModified}-${index}`}
              type="button"
              onClick={() => onSelectFile(index)}
              className={`group overflow-hidden rounded-2xl border text-left transition ${
                isActive
                  ? 'border-blue-500 bg-blue-50 ring-4 ring-blue-50'
                  : 'border-slate-100 bg-white hover:border-slate-300'
              }`}
            >
              <div className="flex gap-3 p-3">
                <div className="h-16 w-16 shrink-0 overflow-hidden rounded-2xl bg-slate-100">
                  {preview?.type === 'image' ? (
                    <img src={preview.url} alt={file.name} className="h-full w-full object-cover" />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center text-slate-400">
                      <FiFile />
                    </div>
                  )}
                </div>

                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-extrabold text-slate-900">{file.name}</p>
                  <p className="mt-1 text-xs font-bold text-slate-400">{formatFileSize(file.size)}</p>
                  <p className="mt-2 text-[11px] font-extrabold text-slate-400">
                    {preview?.type === 'image' ? '이미지' : 'PDF'}
                  </p>
                </div>

                <span
                  role="button"
                  tabIndex={0}
                  onClick={(event) => {
                    event.stopPropagation();
                    onRemoveFile(index);
                  }}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter' || event.key === ' ') {
                      event.preventDefault();
                      event.stopPropagation();
                      onRemoveFile(index);
                    }
                  }}
                  className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-slate-300 transition hover:bg-red-50 hover:text-red-500"
                >
                  <FiX />
                </span>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
};

export default UploadFileList;
