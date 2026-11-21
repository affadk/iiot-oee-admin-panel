import React from 'react';
import { Database, Download, Info } from 'lucide-react';
import { HourlyOeePoint } from '../../../types/analytics';
import { Button } from '../../../components/ui/Button';
import { AggBucket, TelemetryAggregateSummary } from '../hooks/useTelemetryQueries';

export interface TelemetrySummaryStripProps {
  aggData: TelemetryAggregateSummary | undefined;
  aggBucket: AggBucket;
  hourlyData: HourlyOeePoint[];
  canExport: boolean;
  isExporting: boolean;
  cooldownSeconds: number;
  onExportHourlyCsv: () => void;
  /** E12 T12.5 (U-2): status query agregat — kartu ringkasan tidak lagi
      kosong tanpa pesan saat aggData undefined (gap G17, Guide §5). */
  aggIsLoading?: boolean;
  aggIsError?: boolean;
  /** True bila query agregat sudah pernah selesai (sukses/gagal) — bedakan
      "belum dimuat" (query nonaktif karena tab lain) dari "tidak ada data". */
  aggIsFetched?: boolean;
  /** Dipanggil tombol "Coba lagi" pada state error. */
  onRetryAggregate?: () => void;
}

export const TelemetrySummaryStrip: React.FC<TelemetrySummaryStripProps> = ({
  aggData,
  aggBucket,
  hourlyData,
  canExport,
  isExporting,
  cooldownSeconds,
  onExportHourlyCsv,
  aggIsLoading = false,
  aggIsError = false,
  aggIsFetched = false,
  onRetryAggregate,
}) => (
  <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
    <div className="p-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="text-xs font-semibold uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
          <Database className="w-3.5 h-3.5 text-sky-500" />
          <span>Ringkasan Agregat (Interval {aggBucket})</span>
        </h2>
        <span className="text-xs font-tabular text-slate-500">
          {aggIsLoading ? '…' : (aggData?.sample_count ?? 0)} sampel
        </span>
      </div>
      {aggData ? (
        <div className="grid grid-cols-4 gap-2 text-center font-tabular">
          <div className="p-2 rounded bg-slate-50 dark:bg-slate-800/40">
            <span className="text-[10px] text-slate-400 block">AVG OEE</span>
            <span className="text-sm font-bold text-slate-900 dark:text-slate-100">
              {aggData.avg_oee === null ? '—' : `${aggData.avg_oee}%`}
            </span>
          </div>
          <div className="p-2 rounded bg-slate-50 dark:bg-slate-800/40">
            <span className="text-[10px] text-slate-400 block">AVAIL</span>
            <span className="text-xs font-semibold text-slate-700 dark:text-slate-300">
              {aggData.avg_availability === null ? '—' : `${aggData.avg_availability}%`}
            </span>
          </div>
          <div className="p-2 rounded bg-slate-50 dark:bg-slate-800/40">
            <span className="text-[10px] text-slate-400 block">PERF</span>
            <span className="text-xs font-semibold text-slate-700 dark:text-slate-300">
              {aggData.avg_performance === null ? '—' : `${aggData.avg_performance}%`}
            </span>
          </div>
          <div className="p-2 rounded bg-slate-50 dark:bg-slate-800/40">
            <span className="text-[10px] text-slate-400 block">PARTS</span>
            <span className="text-xs font-semibold text-slate-700 dark:text-slate-300">
              {aggData.total_parts}
            </span>
          </div>
        </div>
      ) : aggIsLoading ? (
        <div aria-busy="true" aria-label="Memuat ringkasan agregat" className="grid grid-cols-4 gap-2 text-center font-tabular">
          {['AVG OEE', 'AVAIL', 'PERF', 'PARTS'].map((label) => (
            <div key={label} className="p-2 rounded bg-slate-50 dark:bg-slate-800/40 space-y-2">
              <span className="text-[10px] text-slate-400 block">{label}</span>
              <div className="h-4 w-10 mx-auto rounded bg-slate-200 dark:bg-slate-700 animate-pulse" />
            </div>
          ))}
          <span className="sr-only">Memuat ringkasan agregat…</span>
        </div>
      ) : aggIsError ? (
        <div role="alert" className="space-y-1">
          <p className="text-xs font-semibold text-red-700 dark:text-red-300">
            Gagal memuat ringkasan agregat
          </p>
          <p className="text-[11px] text-slate-500 dark:text-slate-400">
            Terjadi kesalahan saat memuat ringkasan agregat. Coba lagi atau periksa koneksi.
          </p>
          {onRetryAggregate && (
            <Button size="sm" variant="secondary" onClick={onRetryAggregate}>
              Coba lagi
            </Button>
          )}
        </div>
      ) : aggIsFetched ? (
        <p className="text-xs text-slate-500 dark:text-slate-400">
          Tidak ada data agregat pada rentang ini.
        </p>
      ) : null}
    </div>

    <div className="p-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg space-y-2.5">
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-xs font-semibold uppercase tracking-wider text-slate-500">
          Ringkasan Delta Per Jam ({hourlyData.filter((h) => h.provisional).length} provisional)
        </h2>
        <Button
          size="sm"
          variant="secondary"
          disabled={!canExport || isExporting || cooldownSeconds > 0}
          onClick={onExportHourlyCsv}
          title="Unduh laporan per jam dalam format CSV"
        >
          <Download className="w-3.5 h-3.5" />
          <span>Export Hourly CSV</span>
        </Button>
      </div>
      <p className="text-[11px] text-slate-500 dark:text-slate-400 flex items-start gap-1.5">
        <Info className="w-3.5 h-3.5 text-sky-500 shrink-0 mt-0.5" />
        <span>
          <strong>Per Jam vs Live-State:</strong> Bucket per jam adalah delta di dalam jam produksi tersebut dan bukan nilai kumulatif lifetime <code className="font-mono">live-state</code>.
        </span>
      </p>
    </div>
  </div>
);
