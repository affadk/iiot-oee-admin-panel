import React from 'react';
import { CheckCircle2 } from 'lucide-react';
import { ExportResult } from '../../types/historical';
import { formatJakartaDateTime } from '../../utils/historicalExport';

interface ExportReceiptBannerProps {
  lastExport: ExportResult;
  onDismissExport: () => void;
}

/**
 * Tanda terima metadata ekspor (NFR-HDX-005: X-Export-* headers).
 * Dipindah dari HistoricalExportToolbar.tsx (E32.6, FAT-287).
 */
export function ExportReceiptBanner({ lastExport, onDismissExport }: ExportReceiptBannerProps) {
  return (
    <div
      role="status"
      className="p-3.5 bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800 rounded-lg text-xs text-emerald-900 dark:text-emerald-200 flex items-start justify-between gap-3"
    >
      <div className="flex items-start gap-2.5">
        <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
        <div className="space-y-1">
          <div className="font-semibold">
            Unduhan selesai: {lastExport.filename} ({lastExport.rowCount} baris · {lastExport.format.toUpperCase()})
          </div>
          <div className="text-[11px] text-emerald-800 dark:text-emerald-300 font-tabular flex flex-wrap items-center gap-x-2 gap-y-0.5">
            <span>Sumber: {lastExport.metadata.source}</span>
            <span aria-hidden="true">·</span>
            <span>Perangkat: {lastExport.metadata.deviceId}</span>
            <span aria-hidden="true">·</span>
            <span>Dibuat: {formatJakartaDateTime(lastExport.metadata.generatedAt)}</span>
          </div>
        </div>
      </div>
      <button
        type="button"
        onClick={onDismissExport}
        aria-label="Tutup ringkasan ekspor"
        className="text-emerald-700 dark:text-emerald-300 hover:text-emerald-900 font-bold px-1.5 py-0.5 cursor-pointer"
      >
        ✕
      </button>
    </div>
  );
}
