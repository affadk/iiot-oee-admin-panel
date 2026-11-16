import React from 'react';
import { Link } from 'react-router-dom';
import { Activity, ExternalLink } from 'lucide-react';
import { WorkOrder } from '../../../types/production';
import { CorrelatedWorkOrderSummary } from '../../shared/historyFilters';
import { formatDuration } from '../../../utils/oeeCalculations';

interface WorkOrderCorrelationPanelProps {
  displayedWo: WorkOrder;
  selectedDeviceId: string | null;
  corrSummary: CorrelatedWorkOrderSummary | undefined;
  isLoading: boolean;
}

export const WorkOrderCorrelationPanel: React.FC<WorkOrderCorrelationPanelProps> = ({
  displayedWo,
  selectedDeviceId,
  corrSummary,
  isLoading,
}) => {
  return (
    <div className="p-4 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-950/60 space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2 text-xs font-semibold text-slate-800 dark:text-slate-200">
          <Activity className="w-4 h-4 text-sky-500" />
          <span>Korelasi Telemetri, Downtime &amp; Audit Sesi Produksi</span>
        </div>
        <span className="text-[11px] font-mono text-slate-500">
          {displayedWo.machine_id ?? '—'} → {selectedDeviceId ?? 'Perangkat tidak terikat'}
        </span>
      </div>

      {isLoading ? (
        <div className="h-16 rounded bg-slate-200/70 dark:bg-slate-800 animate-pulse" />
      ) : corrSummary ? (
        <>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs font-tabular">
            <div className="p-2 bg-white dark:bg-slate-900 rounded border border-slate-200 dark:border-slate-800">
              <span className="text-[10px] text-slate-400 block">Sampel Telemetri</span>
              <span className="font-bold text-slate-900 dark:text-slate-100">
                {corrSummary.telemetrySampleCount} rekaman
              </span>
            </div>
            <div className="p-2 bg-white dark:bg-slate-900 rounded border border-slate-200 dark:border-slate-800">
              <span className="text-[10px] text-slate-400 block">Rata-rata OEE Window</span>
              <span className="font-bold text-sky-600 dark:text-sky-400">
                {corrSummary.avgOeePct !== null ? `${corrSummary.avgOeePct}%` : '—'}
              </span>
            </div>
            <div className="p-2 bg-white dark:bg-slate-900 rounded border border-slate-200 dark:border-slate-800">
              <span className="text-[10px] text-slate-400 block">Downtime Sesi</span>
              <span className="font-bold text-slate-900 dark:text-slate-100">
                {corrSummary.downtimeCount} insiden ({formatDuration(corrSummary.totalDowntimeSec)})
              </span>
            </div>
            <div className="p-2 bg-white dark:bg-slate-900 rounded border border-slate-200 dark:border-slate-800">
              <span className="text-[10px] text-slate-400 block">Event Audit</span>
              <span className="font-bold text-slate-900 dark:text-slate-100">
                {corrSummary.operationalEventCount} kejadian
              </span>
            </div>
          </div>

          <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed">
            <strong>Catatan Metrik:</strong> <code className="font-mono">live-state</code>{' '}
            menampilkan angka kumulatif lifetime perangkat, sedangkan ringkasan sesi ini hanya mengorelasikan data dalam jendela WO (
            {new Date(corrSummary.window.from).toLocaleString()} –{' '}
            {new Date(corrSummary.window.to).toLocaleString()}).
            {corrSummary.provisionalHourlyCount > 0 &&
              ` Terdapat ${corrSummary.provisionalHourlyCount} bucket per jam yang masih berstatus provisional.`}
          </p>

          {selectedDeviceId && (
            <div className="flex flex-wrap items-center gap-3 text-[11px] pt-1">
              <Link
                to={`/telemetry?device_id=${encodeURIComponent(selectedDeviceId)}&from=${encodeURIComponent(corrSummary.window.from)}&to=${encodeURIComponent(corrSummary.window.to)}`}
                className="inline-flex items-center gap-1 text-sky-600 dark:text-sky-400 hover:underline font-medium"
              >
                <span>Lihat Telemetri Sesi</span>
                <ExternalLink className="w-3 h-3" />
              </Link>
              <span aria-hidden="true">·</span>
              <Link
                to={`/downtime?device_id=${encodeURIComponent(selectedDeviceId)}&from=${encodeURIComponent(corrSummary.window.from)}&to=${encodeURIComponent(corrSummary.window.to)}`}
                className="inline-flex items-center gap-1 text-sky-600 dark:text-sky-400 hover:underline font-medium"
              >
                <span>Lihat Downtime Sesi</span>
                <ExternalLink className="w-3 h-3" />
              </Link>
              <span aria-hidden="true">·</span>
              <Link
                to={`/audit?device_id=${encodeURIComponent(selectedDeviceId)}&from=${encodeURIComponent(corrSummary.window.from)}&to=${encodeURIComponent(corrSummary.window.to)}`}
                className="inline-flex items-center gap-1 text-sky-600 dark:text-sky-400 hover:underline font-medium"
              >
                <span>Lihat Audit Operasional</span>
                <ExternalLink className="w-3 h-3" />
              </Link>
            </div>
          )}
        </>
      ) : null}
    </div>
  );
};
