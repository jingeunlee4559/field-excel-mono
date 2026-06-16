const ReviewSummaryCard = ({ title, value, tone, icon: Icon, active, onClick }) => {
  const activeClass = active ? 'border-blue-300 bg-blue-50/50 shadow-sm' : 'border-slate-200 bg-white hover:bg-slate-50';
  const toneClass = {
    blue: 'bg-blue-50 text-blue-600',
    amber: 'bg-amber-50 text-amber-600',
    rose: 'bg-rose-50 text-rose-600',
    emerald: 'bg-emerald-50 text-emerald-600',
    red: 'bg-red-50 text-red-600',
    slate: 'bg-slate-100 text-slate-600',
  }[tone] || 'bg-slate-100 text-slate-600';

  return (
    <button type="button" onClick={onClick} className={`rounded-3xl border p-4 text-left transition ${activeClass}`}>
      <div className="flex items-center justify-between gap-3">
        <div className={`flex h-11 w-11 items-center justify-center rounded-2xl ${toneClass}`}>
          <Icon />
        </div>
        <span className="text-2xl font-black text-slate-950">{Number(value || 0)}</span>
      </div>
      <p className="mt-3 text-sm font-black text-slate-700">{title}</p>
    </button>
  );
};

export default ReviewSummaryCard;
