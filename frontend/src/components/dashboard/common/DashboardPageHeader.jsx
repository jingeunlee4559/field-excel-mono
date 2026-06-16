const DashboardPageHeader = ({
  eyebrow,
  eyebrowIcon: EyebrowIcon,
  title,
  description,
  badges = [],
  actions,
  children,
  variant = 'dark',
}) => {
  const isDark = variant === 'dark';
  const sectionClass = isDark
    ? 'overflow-hidden rounded-3xl bg-slate-950 text-white shadow-sm'
    : 'overflow-hidden rounded-3xl border border-slate-200 bg-white text-slate-950 shadow-sm';
  const descriptionClass = isDark ? 'text-slate-300' : 'text-slate-500';
  const eyebrowClass = isDark
    ? 'bg-white/10 text-slate-200 ring-white/10'
    : 'bg-slate-100 text-slate-600 ring-slate-200';

  return (
    <section className={sectionClass}>
      <div className="relative p-5 sm:p-6">
        {isDark && (
          <>
            <div className="absolute right-0 top-0 h-40 w-40 rounded-full bg-blue-500/20 blur-3xl" />
            <div className="absolute bottom-0 right-24 h-32 w-32 rounded-full bg-emerald-500/10 blur-3xl" />
          </>
        )}

        <div className="relative flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
          <div className="min-w-0">
            {eyebrow && (
              <span className={`inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-bold ring-1 ${eyebrowClass}`}>
                {EyebrowIcon && <EyebrowIcon />}
                {eyebrow}
              </span>
            )}

            <h2 className="mt-3 text-2xl font-black tracking-tight sm:text-3xl">
              {title}
            </h2>

            {description && (
              <p className={`mt-2 max-w-3xl text-sm font-medium leading-6 ${descriptionClass}`}>
                {description}
              </p>
            )}

            {badges.length > 0 && (
              <div className="mt-4 flex flex-wrap gap-2 text-xs font-extrabold">
                {badges.map((badge) => (
                  <span key={badge.label} className={badge.className}>
                    {badge.label}
                  </span>
                ))}
              </div>
            )}

            {children && <div className="mt-4">{children}</div>}
          </div>

          {actions && (
            <div className="flex shrink-0 flex-col gap-2 sm:flex-row sm:items-center">
              {actions}
            </div>
          )}
        </div>
      </div>
    </section>
  );
};

export default DashboardPageHeader;
