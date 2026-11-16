import React from 'react';

interface MetricCardProps {
  label: string;
  value: string | number;
  unit?: string;
  subtext?: string;
  trend?: {
    value: string;
    isPositive?: boolean;
  };
  statusVariant?: 'normal' | 'success' | 'warning' | 'danger';
  icon?: React.ReactNode;
}

export const MetricCard: React.FC<MetricCardProps> = ({
  label,
  value,
  unit,
  subtext,
  trend,
  statusVariant = 'normal',
  icon,
}) => {
  const statusColors = {
    normal: 'text-slate-900 dark:text-slate-100',
    success: 'text-emerald-600 dark:text-emerald-400',
    warning: 'text-amber-600 dark:text-amber-400',
    danger: 'text-red-600 dark:text-red-400',
  };

  return (
    <div className="p-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-md flex flex-col justify-between">
      <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400 mb-2">
        <span className="font-semibold uppercase tracking-wider text-[11px]">{label}</span>
        {icon && <div className="text-slate-400 dark:text-slate-500">{icon}</div>}
      </div>

      <div className="flex items-baseline gap-1.5 my-1">
        <span className={`text-2xl font-bold font-tabular tracking-tight ${statusColors[statusVariant]}`}>
          {value}
        </span>
        {unit && <span className="text-xs font-medium text-slate-500 dark:text-slate-400">{unit}</span>}
      </div>

      {(subtext || trend) && (
        <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400 mt-2 pt-2 border-t border-slate-100 dark:border-slate-800/80">
          {trend && (
            <span
              className={`font-semibold font-tabular ${
                trend.isPositive ? 'text-emerald-600 dark:text-emerald-400' : 'text-amber-600 dark:text-amber-400'
              }`}
            >
              {trend.value}
            </span>
          )}
          {trend && subtext && <span aria-hidden="true">·</span>}
          {subtext && <span className="truncate">{subtext}</span>}
        </div>
      )}
    </div>
  );
};
