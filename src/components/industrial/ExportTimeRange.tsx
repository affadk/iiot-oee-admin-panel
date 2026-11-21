import React from 'react';
import { Link } from 'react-router-dom';
import { Lock } from 'lucide-react';
import { TimeWindowPreset } from '../../types/historical';
import { formatJakartaDateTime, RETENTION_POLICY_DAYS } from '../../utils/historicalExport';
import { isoToLocalInputValue, localInputValueToIso } from './historicalExportTime';

interface ExportTimeRangeProps {
  preset: TimeWindowPreset;
  fromIso: string;
  toIso: string;
  onCustomRangeChange: (fromIso: string, toIso: string) => void;
  scopeLabel?: string;
  canExport: boolean;
  exportBlockedReason: string;
}

/**
 * Baris bawah toolbar: input rentang kustom (bila preset 'custom') atau
 * rentang aktif, plus catatan retensi & tautan laporan ringkasan.
 * Dipindah dari HistoricalExportToolbar.tsx (E32.6, FAT-287).
 */
export function ExportTimeRange({
  preset,
  fromIso,
  toIso,
  onCustomRangeChange,
  scopeLabel,
  canExport,
  exportBlockedReason,
}: ExportTimeRangeProps) {
  return (
    <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-2.5 pt-2.5 border-t border-slate-100 dark:border-slate-800">
      {preset === 'custom' ? (
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2">
            <label
              htmlFor="historical-from-input"
              className="text-xs font-medium text-slate-600 dark:text-slate-300 whitespace-nowrap"
            >
              Dari (From):
            </label>
            <input
              id="historical-from-input"
              type="datetime-local"
              value={isoToLocalInputValue(fromIso)}
              onChange={(e) => onCustomRangeChange(localInputValueToIso(e.target.value, fromIso), toIso)}
              className="px-2.5 py-1 text-xs font-tabular bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded text-slate-800 dark:text-slate-200 focus:ring-1 focus:ring-sky-500 focus:outline-none"
            />
          </div>

          <div className="flex items-center gap-2">
            <label
              htmlFor="historical-to-input"
              className="text-xs font-medium text-slate-600 dark:text-slate-300 whitespace-nowrap"
            >
              Sampai (To):
            </label>
            <input
              id="historical-to-input"
              type="datetime-local"
              value={isoToLocalInputValue(toIso)}
              onChange={(e) => onCustomRangeChange(fromIso, localInputValueToIso(e.target.value, toIso))}
              className="px-2.5 py-1 text-xs font-tabular bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded text-slate-800 dark:text-slate-200 focus:ring-1 focus:ring-sky-500 focus:outline-none"
            />
          </div>
        </div>
      ) : (
        <div className="text-xs text-slate-500 dark:text-slate-400 font-tabular flex flex-wrap items-center gap-x-2 gap-y-1">
          <span>
            Rentang aktif: {formatJakartaDateTime(fromIso)} — {formatJakartaDateTime(toIso)}
          </span>
          {scopeLabel && (
            <>
              <span aria-hidden="true">·</span>
              <span className="font-sans">{scopeLabel}</span>
            </>
          )}
        </div>
      )}

      <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-slate-500 dark:text-slate-400">
        {!canExport && (
          <>
            <span
              className="inline-flex items-center gap-1 text-amber-700 dark:text-amber-300 font-medium whitespace-nowrap"
              title={exportBlockedReason}
            >
              <Lock className="w-3.5 h-3.5 shrink-0" />
              <span>{exportBlockedReason}</span>
            </span>
            <span aria-hidden="true">·</span>
          </>
        )}
        <span className="whitespace-nowrap">Batas riwayat rinci: maks. {RETENTION_POLICY_DAYS} hari</span>
        <span aria-hidden="true">·</span>
        <Link
          to="/analytics"
          className="text-sky-600 dark:text-sky-400 hover:underline font-medium whitespace-nowrap"
        >
          Laporan Ringkasan &gt; {RETENTION_POLICY_DAYS} hari
        </Link>
      </div>
    </div>
  );
}
