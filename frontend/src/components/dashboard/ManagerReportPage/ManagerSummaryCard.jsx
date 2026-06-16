const ManagerSummaryCard = ({ label, value, icon: Icon, tone = 'slate', caption }) => {
  const toneMap = {
    slate: { card: 'from-white to-slate-50 ring-slate-200', icon: 'bg-slate-950 text-white', value: 'text-slate-950' },
    blue: { card: 'from-blue-50 to-white ring-blue-100', icon: 'bg-blue-600 text-white', value: 'text-blue-700' },
    emerald: { card: 'from-emerald-50 to-white ring-emerald-100', icon: 'bg-emerald-500 text-white', value: 'text-emerald-700' },
    amber: { card: 'from-amber-50 to-white ring-amber-100', icon: 'bg-amber-500 text-white', value: 'text-amber-700' },
  };

  const style = toneMap[tone] || toneMap.slate;

  return (
    <div className={`rounded-3xl bg-gradient-to-br ${style.card} p-5 shadow-sm ring-1`}>
      <div className="flex items-center justify-between gap-4">
        <div className="min-w-0">
          <p className="text-xs font-extrabold text-slate-400">{label}</p>
          <p className={`mt-2 truncate text-2xl font-black ${style.value}`}>{value}</p>
          {caption && <p className="mt-1 truncate text-xs font-bold text-slate-400">{caption}</p>}
        </div>
        <div className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl ${style.icon} shadow-sm`}>
          <Icon className="text-xl" />
        </div>
      </div>
    </div>
  );
};

export default ManagerSummaryCard;
