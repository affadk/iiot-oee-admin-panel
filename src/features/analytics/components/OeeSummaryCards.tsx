import React from 'react';
import { BarChart3, Clock, Layers, TrendingUp } from 'lucide-react';
import { ShiftSummary } from '../../../types/analytics';
import { MetricCard } from '../../../components/industrial/MetricCard';
import { Button } from '../../../components/ui/Button';
import { formatSummaryScopeLabel } from '../scopeLabels';

interface OeeSummaryCardsProps {
  summary: ShiftSummary | null;
  /** Label periode dari filter aktif — dipakai bila summary tidak membawa info shift yang bermakna. */
  fallbackPeriodLabel?: string;
  /** E12 T12.5 (U-2): sedang memuat dan belum ada data — tampilkan skeleton. */
  isLoading?: boolean;
  /** E12 T12.5 (U-2): query gagal dan tidak ada data — tampilkan pesan error. */
  isError?: boolean;
  /** Dipanggil tombol "Coba lagi" pada state error. */
  onRetry?: () => void;
}

const CARD_LABELS = ['Shift Total OEE', 'Availability', 'Performance', 'Quality'];

export const OeeSummaryCards: React.FC<OeeSummaryCardsProps> = ({
  summary,
  fallbackPeriodLabel,
  isLoading = false,
  isError = false,
  onRetry,
}) => {
  // E11 T11.5 (U-1): label scope eksplisit — shift + tz + mesin dari data
  // summary itu sendiri (window.shift_start/shift_end, tz, machine_name);
  // fallback ke rentang from/to filter aktif bila info shift tidak bermakna.
  // E12 T12.5 (U-2): label periode tetap tampil saat memuat/kosong/error,
  // supaya pengguna tahu periode mana yang sedang dimuat — kartu tidak
  // lagi hilang begitu saja saat summary null (gap G17, Guide §5).
  const scopeLabel = summary
    ? formatSummaryScopeLabel(summary, fallbackPeriodLabel)
    : fallbackPeriodLabel;

  return (
    <div className="space-y-2">
      {scopeLabel && (
        <p className="text-[11px] text-slate-500 dark:text-slate-400">{scopeLabel}</p>
      )}
      {summary ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <MetricCard
            label="Shift Total OEE"
            value={summary.oee.toFixed(1)}
            unit="%"
            // E23 Batch 3 (FAT-196, N-27): nama shift null bila server
            // tidak mengirimnya — tampil '—', bukan 'Shift' fabrikasi.
            subtext={`${summary.shift_name ?? '—'} (${summary.tz || 'Asia/Jakarta'})`}
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
            // E23 Batch 3 (FAT-196, N-27): parts null = tidak diketahui
            // (server tidak mengirim) — tampil '—', bukan 0 fabrikasi.
            subtext={`${summary.good_parts ?? '—'} good / ${summary.defect_parts ?? '—'} defect`}
            statusVariant="success"
            icon={<BarChart3 className="w-4 h-4" />}
          />
        </div>
      ) : isLoading ? (
        <div
          aria-busy="true"
          aria-label="Memuat ringkasan OEE"
          className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4"
        >
          {CARD_LABELS.map((label) => (
            <div
              key={label}
              className="p-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-md space-y-3"
            >
              <div className="h-3 w-24 rounded bg-slate-100 dark:bg-slate-800 animate-pulse" />
              <div className="h-7 w-16 rounded bg-slate-100 dark:bg-slate-800 animate-pulse" />
              <div className="h-3 w-32 rounded bg-slate-100 dark:bg-slate-800 animate-pulse" />
            </div>
          ))}
          <span className="sr-only">Memuat ringkasan OEE…</span>
        </div>
      ) : isError ? (
        <div
          role="alert"
          className="p-4 bg-white dark:bg-slate-900 border border-red-200 dark:border-red-900 rounded-md flex flex-col sm:flex-row sm:items-center justify-between gap-3"
        >
          <div className="space-y-0.5">
            <p className="text-sm font-semibold text-red-700 dark:text-red-300">
              Gagal memuat ringkasan OEE
            </p>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Terjadi kesalahan saat memuat ringkasan shift. Coba lagi atau periksa koneksi.
            </p>
          </div>
          {onRetry && (
            <Button size="sm" variant="secondary" onClick={onRetry} className="shrink-0">
              Coba lagi
            </Button>
          )}
        </div>
      ) : (
        <div className="p-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-md text-center space-y-1">
          <p className="text-sm font-semibold text-slate-700 dark:text-slate-200">
            Tidak ada data ringkasan pada rentang ini
          </p>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Belum ada ringkasan shift untuk mesin dan periode yang dipilih.
          </p>
        </div>
      )}
    </div>
  );
};
