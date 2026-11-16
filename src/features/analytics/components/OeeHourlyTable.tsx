import React from 'react';
import { Link } from 'react-router-dom';
import { HourlyOeePoint } from '../../../types/analytics';
import { MachineStateBadge } from '../../../components/industrial/MachineStateBadge';
import { Badge } from '../../../components/ui/Badge';

interface OeeHourlyTableProps {
  hourly: HourlyOeePoint[];
  resolvedDeviceId: string;
}

export const OeeHourlyTable: React.FC<OeeHourlyTableProps> = ({ hourly, resolvedDeviceId }) => {
  return (
    <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-md overflow-hidden">
      <div className="px-4 py-3 border-b border-slate-200 dark:border-slate-800 flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
            Rincian Pencapaian OEE Per Jam
          </h2>
          <p className="text-[11px] text-slate-500">
            Setiap baris merepresentasikan delta produksi di dalam jam tersebut (bucket provisional dapat diperbarui oleh rekonsiliasi).
          </p>
        </div>
        <Link
          to={`/telemetry?device_id=${encodeURIComponent(resolvedDeviceId)}`}
          className="text-xs font-medium text-sky-600 dark:text-sky-400 hover:underline whitespace-nowrap shrink-0"
        >
          Buka Riwayat Telemetri →
        </Link>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/50 text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              <th className="py-2.5 px-4">Jam</th>
              <th className="py-2.5 px-4">FSM State &amp; Plan</th>
              <th className="py-2.5 px-4 text-right">OEE</th>
              <th className="py-2.5 px-4 text-right">A / P / Q</th>
              <th className="py-2.5 px-4 text-right">Parts / Target</th>
              <th className="py-2.5 px-4 text-right">Reject</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-slate-800/80 text-xs">
            {hourly.map((pt) => (
              <tr key={pt.hour} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30">
                <td className="py-2.5 px-4 font-tabular font-semibold text-slate-900 dark:text-slate-100">
                  <span>{pt.hour}</span>
                  {pt.provisional && (
                    <span className="ml-1.5 text-[11px] font-sans font-medium text-amber-600 dark:text-amber-400">
                      (Provisional)
                    </span>
                  )}
                </td>
                <td className="py-2.5 px-4">
                  <div className="flex items-center gap-1.5">
                    {pt.state && <MachineStateBadge state={pt.state} />}
                    {pt.planned && <Badge variant="warning">Planned</Badge>}
                  </div>
                </td>
                <td className="py-2.5 px-4 text-right font-tabular font-bold text-slate-900 dark:text-slate-100">
                  {pt.oee.toFixed(1)}%
                </td>
                <td className="py-2.5 px-4 text-right font-tabular text-slate-600 dark:text-slate-300">
                  {pt.availability.toFixed(0)}% / {pt.performance.toFixed(0)}% / {pt.quality.toFixed(0)}%
                </td>
                <td className="py-2.5 px-4 text-right font-tabular">
                  <strong>{pt.parts_produced}</strong>
                  <span className="text-slate-400"> / {pt.targetPerHour ?? '—'}</span>
                </td>
                <td className="py-2.5 px-4 text-right font-tabular text-red-500 font-medium">
                  {pt.defect_count}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};
