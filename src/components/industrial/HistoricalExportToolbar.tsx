import React from 'react';
import { Link } from 'react-router-dom';
import { Download, FileJson, FileText, AlertTriangle, CheckCircle2, Calendar, Lock } from 'lucide-react';
import { ExportFormat, ExportResult, TimeWindowPreset } from '../../types/historical';
import { UserRole } from '../../types/auth';
import { Button } from '../ui/Button';
import { formatIsoWithOffset, formatJakartaDateTime, RETENTION_POLICY_DAYS } from '../../utils/historicalExport';
import { useCapability } from '../../context/AuthContext';

interface HistoricalExportToolbarProps {
  preset: TimeWindowPreset;
  onPresetChange: (preset: TimeWindowPreset) => void;
  fromIso: string;
  toIso: string;
  onCustomRangeChange: (fromIso: string, toIso: string) => void;
  onExport: (format: ExportFormat) => void;
  isExporting: boolean;
  exportError: { code?: string; status?: number; message: string } | null;
  onDismissError: () => void;
  lastExport: ExportResult | null;
  onDismissExport: () => void;
  userRole?: UserRole;
  resourceId?: string;
  scopeLabel?: string;
  cooldownSeconds?: number;
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
  { id: '24h', label: '24 Jam' },
  { id: '7d', label: '7 Hari' },
  { id: '30d', label: '30 Hari' },
  { id: '90d', label: '90 Hari (Maks)' },
  { id: 'custom', label: 'Kustom' },
];

export const HistoricalExportToolbar: React.FC<HistoricalExportToolbarProps> = ({
  preset,
  onPresetChange,
  fromIso,
  toIso,
  onCustomRangeChange,
  onExport,
  isExporting,
  exportError,
  onDismissError,
  lastExport,
  onDismissExport,
  resourceId,
  scopeLabel,
  cooldownSeconds = 0,
}) => {
  const exportCap = useCapability('export.telemetry', resourceId);
  const canExport = exportCap.canInteract;
  const exportBlockedReason = exportCap.reason ?? 'Ekspor membutuhkan izin refresh:telemetry';
  const isBlocked = !canExport || isExporting || cooldownSeconds > 0;

  return (
    <div className="space-y-3">
      <div className="p-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg space-y-3">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
          {/* Time Window Presets */}
          <div className="flex flex-wrap items-center gap-2.5">
            <div className="flex items-center gap-1.5 text-xs font-medium text-slate-600 dark:text-slate-300 whitespace-nowrap">
              <Calendar className="w-3.5 h-3.5 text-slate-400" />
              <span>Jendela Waktu:</span>
            </div>

            <div
              role="group"
              aria-label="Preset jendela waktu historis"
              className="inline-flex flex-wrap items-center gap-1 p-1 bg-slate-100 dark:bg-slate-800 rounded-md"
            >
              {PRESET_OPTIONS.map((opt) => (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => onPresetChange(opt.id)}
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

          {/* Export Buttons (CSV, NDJSON, JSON) — single row */}
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
        </div>

        {/* Custom Time Range Inputs & Retention Policy Note */}
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
      </div>

      {/* Retention / Authorization Error Banner */}
      {exportError && (
        <div
          role="alert"
          className="p-3.5 bg-red-50 dark:bg-red-950/40 border border-red-300 dark:border-red-800 rounded-lg text-xs text-red-900 dark:text-red-200 flex items-start justify-between gap-3"
        >
          <div className="flex items-start gap-2.5">
            <AlertTriangle className="w-4 h-4 text-red-600 dark:text-red-400 shrink-0 mt-0.5" />
            <div className="space-y-1">
              <div className="font-semibold">
                Ekspor Data Tidak Dapat Diproses
              </div>
              <p className="text-red-800 dark:text-red-300">{exportError.message}</p>
              {exportError.code === 'RETENTION_EXCEEDED' && (
                <div>
                  <Link
                    to="/analytics"
                    className="inline-block font-semibold text-red-900 dark:text-red-100 underline hover:no-underline"
                  >
                    Buka Analitik Shift OEE →
                  </Link>
                </div>
              )}
            </div>
          </div>
          <button
            type="button"
            onClick={onDismissError}
            aria-label="Tutup pesan error ekspor"
            className="text-red-600 dark:text-red-400 hover:text-red-800 font-bold px-1.5 py-0.5 cursor-pointer"
          >
            ✕
          </button>
        </div>
      )}

      {/* Export Metadata Receipt (NFR-HDX-005: X-Export-* headers) */}
      {lastExport && (
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
      )}
    </div>
  );
};
