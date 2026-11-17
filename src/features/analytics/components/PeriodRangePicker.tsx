import React, { useEffect, useRef, useState } from 'react';
import { Calendar } from 'lucide-react';
import { HistoryFilters, TimeWindowPreset } from '../../../types/historical';
import {
  detectTimeWindowPreset,
  formatIsoWithOffset,
  formatJakartaDateTime,
  resolveTimeWindowPreset,
} from '../../../utils/historicalExport';

export interface PeriodRangePickerProps {
  from: string;
  to: string;
  onFilterChange: (patch: Partial<HistoryFilters>) => void;
  /** Bila filter shift aktif, from/to adalah jendela shift itu — memilih
      preset/rentang lain menghapus filter shift (lihat
      `applyHistoryFilterPatch`). */
  shiftFilterActive?: boolean;
}

function isoToLocalInputValue(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '';
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function localInputValueToIso(val: string, fallbackIso: string): string {
  if (!val) return fallbackIso;
  const parsed = new Date(val);
  if (Number.isNaN(parsed.getTime())) return fallbackIso;
  return formatIsoWithOffset(parsed);
}

const PRESET_OPTIONS: { id: TimeWindowPreset; label: string }[] = [
  { id: 'today', label: 'Hari ini' },
  { id: '24h', label: '24 Jam' },
  { id: '7d', label: '7 Hari' },
  { id: '30d', label: '30 Hari' },
  { id: '90d', label: '90 Hari' },
  { id: 'custom', label: 'Kustom' },
];

/**
 * E12 T12.9 (X-2 / FAT-62): kontrol periode (date-range picker) halaman
 * OEE — preset + rentang kustom, pola yang sama dengan
 * `HistoricalExportToolbar` di Telemetry History, tapi tanpa tombol ekspor
 * (halaman ini tidak mengekspor). Memakai utilitas `historyFilters` yang
 * sudah ada: patch {from, to} lewat `onFilterChange` tersimpan di URL
 * (bisa dibagikan/direfresh) dan me-refetch semua query halaman karena
 * queryKey memuat from/to (lihat `oeeQueryKeys`).
 *
 * Preset disimpan sebagai state lokal (seperti toolbar) supaya memilih
 * "Kustom" tetap menampilkan input saat rentang yang diketik kebetulan
 * berdurasi sama dengan preset. State disinkronkan dari from/to hanya
 * bila perubahan datang dari luar picker ini (URL, pemilih shift) —
 * dilacak lewat `lastAppliedRef` — jadi tautan dengan ?from=&to=
 * menampilkan preset yang benar, dan jendela shift tampil sebagai
 * 'custom' dengan input berisi jendela shift itu.
 */
export const PeriodRangePicker: React.FC<PeriodRangePickerProps> = ({
  from,
  to,
  onFilterChange,
  shiftFilterActive = false,
}) => {
  const [preset, setPreset] = useState<TimeWindowPreset>(() =>
    detectTimeWindowPreset(from, to)
  );
  const lastAppliedRef = useRef<{ from: string; to: string } | null>(null);

  useEffect(() => {
    const last = lastAppliedRef.current;
    if (last && last.from === from && last.to === to) return;
    setPreset(detectTimeWindowPreset(from, to));
  }, [from, to]);

  const handlePresetChange = (nextPreset: TimeWindowPreset) => {
    if (nextPreset === 'custom') {
      setPreset('custom');
      return;
    }
    const range = resolveTimeWindowPreset(nextPreset);
    lastAppliedRef.current = range;
    setPreset(nextPreset);
    onFilterChange({ from: range.from, to: range.to });
  };

  const handleCustomRangeChange = (nextFrom: string, nextTo: string) => {
    lastAppliedRef.current = { from: nextFrom, to: nextTo };
    setPreset('custom');
    onFilterChange({ from: nextFrom, to: nextTo });
  };

  return (
    <div className="p-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg space-y-3">
      <div className="flex flex-col sm:flex-row sm:items-center gap-3">
        <div className="flex items-center gap-1.5 text-xs font-medium text-slate-600 dark:text-slate-300 whitespace-nowrap">
          <Calendar className="w-3.5 h-3.5 text-slate-400" />
          <span>Periode:</span>
        </div>

        <div
          role="group"
          aria-label="Preset periode OEE"
          className="inline-flex flex-wrap items-center gap-1 p-1 bg-slate-100 dark:bg-slate-800 rounded-md"
        >
          {PRESET_OPTIONS.map((opt) => (
            <button
              key={opt.id}
              type="button"
              aria-pressed={preset === opt.id}
              onClick={() => handlePresetChange(opt.id)}
              className={`px-2.5 py-1 text-xs font-medium rounded transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                preset === opt.id
                  ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 shadow-xs'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100'
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      {preset === 'custom' ? (
        <div className="flex flex-wrap items-center gap-3 pt-2.5 border-t border-slate-100 dark:border-slate-800">
          <div className="flex items-center gap-2">
            <label
              htmlFor="oee-period-from-input"
              className="text-xs font-medium text-slate-600 dark:text-slate-300 whitespace-nowrap"
            >
              Dari (From):
            </label>
            <input
              id="oee-period-from-input"
              type="datetime-local"
              value={isoToLocalInputValue(from)}
              onChange={(e) =>
                handleCustomRangeChange(localInputValueToIso(e.target.value, from), to)
              }
              className="px-2.5 py-1 text-xs font-tabular bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded text-slate-800 dark:text-slate-200 focus:ring-1 focus:ring-sky-500 focus:outline-none"
            />
          </div>

          <div className="flex items-center gap-2">
            <label
              htmlFor="oee-period-to-input"
              className="text-xs font-medium text-slate-600 dark:text-slate-300 whitespace-nowrap"
            >
              Sampai (To):
            </label>
            <input
              id="oee-period-to-input"
              type="datetime-local"
              value={isoToLocalInputValue(to)}
              onChange={(e) =>
                handleCustomRangeChange(from, localInputValueToIso(e.target.value, to))
              }
              className="px-2.5 py-1 text-xs font-tabular bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded text-slate-800 dark:text-slate-200 focus:ring-1 focus:ring-sky-500 focus:outline-none"
            />
          </div>
        </div>
      ) : (
        <div className="text-xs text-slate-500 dark:text-slate-400 font-tabular pt-2.5 border-t border-slate-100 dark:border-slate-800">
          Rentang aktif: {formatJakartaDateTime(from)} — {formatJakartaDateTime(to)}
        </div>
      )}

      {shiftFilterActive && (
        <p className="text-[11px] text-slate-500 dark:text-slate-400">
          Filter shift aktif — memilih preset atau mengubah rentang akan menghapus filter shift.
        </p>
      )}
    </div>
  );
};
