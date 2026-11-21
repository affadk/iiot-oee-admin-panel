import React from 'react';
import { Download, FileJson, FileText } from 'lucide-react';
import { ExportFormat } from '../../types/historical';
import { Button } from '../ui/Button';

interface ExportFormatButtonsProps {
  canExport: boolean;
  exportBlockedReason: string;
  isExporting: boolean;
  cooldownSeconds: number;
  onExport: (format: ExportFormat) => void;
}

/** Tombol ekspor CSV / NDJSON / JSON + hitung mundur cooldown. Dipindah dari HistoricalExportToolbar.tsx (E32.6, FAT-287). */
export function ExportFormatButtons({
  canExport,
  exportBlockedReason,
  isExporting,
  cooldownSeconds,
  onExport,
}: ExportFormatButtonsProps) {
  const isBlocked = !canExport || isExporting || cooldownSeconds > 0;
  return (
    <div className="flex flex-wrap sm:flex-nowrap items-center gap-2 shrink-0">
      {cooldownSeconds > 0 && (
        <span className="text-xs font-tabular font-semibold text-amber-700 dark:text-amber-300 mr-1">
          Tunggu {cooldownSeconds} detik
        </span>
      )}
      <Button
        size="sm"
        variant="secondary"
        onClick={() => onExport('csv')}
        disabled={isBlocked}
        title={!canExport ? exportBlockedReason : 'Unduh laporan riwayat dalam format tabel CSV'}
      >
        <Download className="w-3.5 h-3.5" />
        <span>Export CSV</span>
      </Button>
      <Button
        size="sm"
        variant="secondary"
        onClick={() => onExport('ndjson')}
        disabled={isBlocked}
        title={!canExport ? exportBlockedReason : 'Unduh laporan riwayat dalam format baris JSON'}
      >
        <FileText className="w-3.5 h-3.5" />
        <span>Export Log JSON</span>
      </Button>
      <Button
        size="sm"
        variant="secondary"
        onClick={() => onExport('json')}
        disabled={isBlocked}
        title={!canExport ? exportBlockedReason : 'Unduh laporan riwayat dalam format JSON'}
      >
        <FileJson className="w-3.5 h-3.5" />
        <span>Export JSON</span>
      </Button>
    </div>
  );
}
