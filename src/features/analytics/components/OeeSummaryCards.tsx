import React from 'react';
import { BarChart3, Clock, Layers, TrendingUp } from 'lucide-react';
import { ShiftSummary } from '../../../types/analytics';
import { MetricCard } from '../../../components/industrial/MetricCard';
import { formatSummaryScopeLabel } from '../scopeLabels';

interface OeeSummaryCardsProps {
  summary: ShiftSummary | null;
  /** Label periode dari filter aktif — dipakai bila summary tidak membawa info shift yang bermakna. */
  fallbackPeriodLabel?: string;
}

export const OeeSummaryCards: React.FC<OeeSummaryCardsProps> = ({ summary, fallbackPeriodLabel }) => {
  if (!summary) return null;

  // E11 T11.5 (U-1): label scope eksplisit — shift + tz + mesin dari data
  // summary itu sendiri (window.shift_start/shift_end, tz, machine_name);
  // fallback ke rentang from/to filter aktif bila info shift tidak bermakna.
  const scopeLabel = formatSummaryScopeLabel(summary, fallbackPeriodLabel);

  return (
    <div className="space-y-2">
      {scopeLabel && (
        <p className="text-[11px] text-slate-500 dark:text-slate-400">{scopeLabel}</p>
      )}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <MetricCard
          label="Shift Total OEE"
          value={summary.oee.toFixed(1)}
          unit="%"
          subtext={`${summary.shift_name} (${summary.tz || 'Asia/Jakarta'})`}
          statusVariant={summary.oee >= 80 ? 'success' : 'warning'}
          icon={<TrendingUp className="w-4 h-4" />}
        />
        <MetricCard
          label="Availability"
          value={summary.availability.toFixed(1)}
          unit="%"
          subtext={`Run ${summary.run_time_min}m / Operating ${summary.operating_time_min}m`}
          statusVariant="normal"
          icon={<Clock className="w-4 h-4" />}
        />
        <MetricCard
          label="Performance"
          value={summary.performance.toFixed(1)}
          unit="%"
          subtext={`Target/Jam: ${summary.target_per_hour ?? '-'} pcs · Break ${summary.planned_break_min ?? 0}m`}
          statusVariant="normal"
          icon={<Layers className="w-4 h-4" />}
        />
        <MetricCard
          label="Quality"
          value={summary.quality.toFixed(1)}
          unit="%"
          subtext={`${summary.good_parts} good / ${summary.defect_parts} defect`}
          statusVariant="success"
          icon={<BarChart3 className="w-4 h-4" />}
      />
      </div>
    </div>
  );
};
