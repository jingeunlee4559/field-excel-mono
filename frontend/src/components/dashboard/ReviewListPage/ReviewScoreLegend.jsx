const SCORE_LEGEND_ITEMS = [
  { range: '90~100', label: '양호', tone: 'emerald' },
  { range: '70~89', label: '보통', tone: 'blue' },
  { range: '50~69', label: '주의', tone: 'amber' },
  { range: '1~49', label: '위험', tone: 'red' },
  { range: '0', label: '추출 실패', tone: 'rose' },
];

const SCORE_GUIDE_CLASS = {
  emerald: { wrap: 'bg-emerald-50 text-emerald-700 ring-emerald-100', dot: 'bg-emerald-500' },
  blue: { wrap: 'bg-blue-50 text-blue-700 ring-blue-100', dot: 'bg-blue-500' },
  amber: { wrap: 'bg-amber-50 text-amber-700 ring-amber-100', dot: 'bg-amber-500' },
  red: { wrap: 'bg-red-50 text-red-700 ring-red-100', dot: 'bg-red-500' },
  rose: { wrap: 'bg-rose-50 text-rose-700 ring-rose-100', dot: 'bg-rose-500' },
};

const ScoreGuideItem = ({ range, label, tone }) => {
  const style = SCORE_GUIDE_CLASS[tone] || SCORE_GUIDE_CLASS.blue;

  return (
    <div className={`flex min-w-0 items-center justify-between gap-2 rounded-2xl px-3 py-2 ring-1 ${style.wrap}`}>
      <div className="min-w-0">
        <p className="truncate text-[11px] font-black leading-none">{range}점</p>
        <p className="mt-1 truncate text-xs font-extrabold leading-none">{label}</p>
      </div>
      <span className={`h-2.5 w-2.5 shrink-0 rounded-full ${style.dot}`} />
    </div>
  );
};

const ReviewScoreLegend = () => (
  <section className="rounded-[24px] border border-slate-200 bg-slate-50/70 p-3">
    <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
      <div className="min-w-0">
        <p className="text-sm font-black text-slate-950">신뢰도 점수 기준</p>
        <p className="mt-1 text-xs font-bold text-slate-400">목록의 점수 배지 색상 기준입니다.</p>
      </div>
      <div className="grid min-w-0 grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5 xl:w-[760px]">
        {SCORE_LEGEND_ITEMS.map((item) => (
          <ScoreGuideItem key={item.range} range={item.range} label={item.label} tone={item.tone} />
        ))}
      </div>
    </div>
  </section>
);

export default ReviewScoreLegend;
