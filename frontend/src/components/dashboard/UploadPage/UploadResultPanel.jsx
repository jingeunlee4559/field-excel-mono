import { FiCheckCircle } from 'react-icons/fi';

const UploadResultPanel = ({ result }) => {
  if (!result) return null;

  return (
    <div className="rounded-3xl bg-emerald-50 p-6 text-emerald-800 ring-1 ring-emerald-100">
      <div className="flex items-center gap-2">
        <FiCheckCircle className="text-xl" />
        <h3 className="text-base font-extrabold">업로드 접수 결과</h3>
      </div>

      <p className="mt-2 text-xs font-bold text-slate-500">
        파일은 접수되었고 AI 처리는 서버에서 자동으로 진행됩니다. 화면을 나가도 처리됩니다.
      </p>

      <div className="mt-4 space-y-2">
        {(result.aiQueueResults || result.files || []).map((item) => (
          <div key={item.sourceFileId} className="rounded-2xl bg-slate-50 p-3 text-sm">
            <p className="font-extrabold text-slate-900">파일 ID #{item.sourceFileId}</p>
            <p className="mt-1 text-xs font-bold text-slate-500">상태: {item.status}</p>
            {item.message && <p className="mt-1 text-xs text-red-500">{item.message}</p>}
          </div>
        ))}
      </div>
    </div>
  );
};

export default UploadResultPanel;
