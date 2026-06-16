import { FiMapPin, FiUser } from 'react-icons/fi';

const UploadSubmitterInfoCard = ({ loginUser, departmentName, siteName }) => (
  <div className="rounded-3xl bg-white p-6 shadow-sm ring-1 ring-slate-200">
    <div className="mb-5 flex items-center justify-between gap-3">
      <div>
        <h3 className="text-base font-extrabold text-slate-950">제출자 정보</h3>
        <p className="mt-1 text-xs font-bold text-slate-400">
          로그인한 계정의 부서와 현장 기준으로 업로드됩니다.
        </p>
      </div>
    </div>

    <div className="grid gap-3 md:grid-cols-3">
      <div className="rounded-2xl bg-slate-50 p-4">
        <div className="flex items-center gap-2 text-xs font-extrabold text-slate-400">
          <FiUser />
          사용자
        </div>
        <div className="mt-2 truncate text-sm font-extrabold text-slate-950">
          {loginUser?.name || loginUser?.username || '-'}
        </div>
      </div>

      <div className="rounded-2xl bg-blue-50 p-4">
        <div className="text-xs font-extrabold text-blue-500">부서</div>
        <div className="mt-2 truncate text-sm font-extrabold text-slate-950">
          {departmentName}
        </div>
      </div>

      <div className="rounded-2xl bg-indigo-50 p-4">
        <div className="flex items-center gap-2 text-xs font-extrabold text-indigo-500">
          <FiMapPin />
          현장
        </div>
        <div className="mt-2 truncate text-sm font-extrabold text-slate-950">
          {siteName}
        </div>
      </div>
    </div>
  </div>
);

export default UploadSubmitterInfoCard;
