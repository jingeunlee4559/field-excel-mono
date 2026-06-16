const BatchCountPill = ({ label, value, className }) => (
  <div className={`rounded-2xl px-4 py-3 text-sm font-black ${className}`}>
    <p className="text-[11px] opacity-75">{label}</p>
    <p className="mt-1 text-xl">{value}</p>
  </div>
);

export default BatchCountPill;
