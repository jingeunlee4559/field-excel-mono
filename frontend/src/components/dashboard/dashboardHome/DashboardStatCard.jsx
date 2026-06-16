import React from "react";

const DashboardStatCard = ({ item, loading }) => {
  const Icon = item.icon;

  return (
    <div className="rounded-3xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
      <div className="flex items-center justify-between">
        <p className="text-xs font-bold text-slate-400">{item.label}</p>

        <div className="flex h-9 w-9 items-center justify-center rounded-2xl bg-slate-100 text-slate-600">
          <Icon size={17} />
        </div>
      </div>

      <div className="mt-4">
        {loading ? (
          <div className="h-8 w-14 animate-pulse rounded-lg bg-slate-100" />
        ) : (
          <p className={`text-3xl font-extrabold ${item.color}`}>
            {item.value}
          </p>
        )}
      </div>
    </div>
  );
};

export default DashboardStatCard;