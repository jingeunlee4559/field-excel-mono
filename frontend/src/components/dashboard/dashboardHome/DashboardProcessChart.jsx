import React from "react";
import { CHART_DATA } from "./dashboardHome.constants.js";

const DashboardProcessChart = () => {
  const maxChartValue = Math.max(
    ...CHART_DATA.flatMap((item) => [
      item.upload,
      item.review,
      item.generated,
    ])
  );

  return (
    <div className="rounded-3xl bg-white p-6 shadow-sm ring-1 ring-slate-200">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h3 className="text-sm font-extrabold text-slate-950">
            최근 5일 증빙 처리 흐름
          </h3>
          <p className="mt-1 text-xs text-slate-400">
            업로드, 검토 필요, 생성 완료 추이를 확인하세요.
          </p>
        </div>
      </div>

      <div className="space-y-5">
        {CHART_DATA.map((item) => (
          <div key={item.day} className="grid grid-cols-[42px_1fr] gap-3">
            <div className="text-xs font-bold text-slate-400">{item.day}</div>

            <div className="space-y-2">
              <ChartBar
                label="업로드"
                value={item.upload}
                max={maxChartValue}
                className="bg-blue-500"
              />
              <ChartBar
                label="검토"
                value={item.review}
                max={maxChartValue}
                className="bg-orange-500"
              />
              <ChartBar
                label="생성"
                value={item.generated}
                max={maxChartValue}
                className="bg-emerald-500"
              />
            </div>
          </div>
        ))}
      </div>

      <div className="mt-5 flex flex-wrap gap-3 text-[11px] font-bold text-slate-500">
        <Legend color="bg-blue-500" label="업로드" />
        <Legend color="bg-orange-500" label="검토 필요" />
        <Legend color="bg-emerald-500" label="생성 완료" />
      </div>
    </div>
  );
};

const ChartBar = ({ label, value, max, className }) => {
  const width = max > 0 ? Math.max((value / max) * 100, 8) : 0;

  return (
    <div className="grid grid-cols-[58px_1fr_28px] items-center gap-2">
      <span className="text-[11px] font-bold text-slate-400">{label}</span>

      <div className="h-2.5 overflow-hidden rounded-full bg-slate-100">
        <div
          className={`h-full rounded-full ${className}`}
          style={{ width: `${width}%` }}
        />
      </div>

      <span className="text-right text-[11px] font-extrabold text-slate-500">
        {value}
      </span>
    </div>
  );
};

const Legend = ({ color, label }) => {
  return (
    <div className="flex items-center gap-1.5">
      <span className={`h-2.5 w-2.5 rounded-full ${color}`} />
      {label}
    </div>
  );
};

export default DashboardProcessChart;