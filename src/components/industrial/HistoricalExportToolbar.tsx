import React from 'react';
import { ExportFormat, ExportResult, TimeWindowPreset } from '../../types/historical';
import { UserRole } from '../../types/auth';
import { useCapability } from '../../context/AuthContext';
import { ExportErrorBanner } from './ExportErrorBanner';
import { ExportFormatButtons } from './ExportFormatButtons';
import { ExportPresetSelector } from './ExportPresetSelector';
import { ExportReceiptBanner } from './ExportReceiptBanner';
import { ExportTimeRange } from './ExportTimeRange';

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

/**
 * E32.6 (FAT-287): sub-bagian dipecah per tanggung jawab ke file di folder
 * yang sama (ExportPresetSelector, ExportFormatButtons, ExportTimeRange,
 * ExportErrorBanner, ExportReceiptBanner, historicalExportTime). Toolbar
 * tinggal orkestrasi + capability ekspor. API publik (props/exports)
 * tidak berubah.
 */
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
  const exportCap = useCapability('telemetry.refresh', resourceId);
  const canExport = exportCap.canInteract;
  const exportBlockedReason = exportCap.reason ?? 'Ekspor membutuhkan izin refresh:telemetry';

  return (
    <div className="space-y-3">
      <div className="p-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg space-y-3">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
          {/* Time Window Presets */}
          <ExportPresetSelector preset={preset} onPresetChange={onPresetChange} />

          {/* Export Buttons (CSV, NDJSON, JSON) — single row */}
          <ExportFormatButtons
            canExport={canExport}
            exportBlockedReason={exportBlockedReason}
            isExporting={isExporting}
            cooldownSeconds={cooldownSeconds}
            onExport={onExport}
          />
        </div>

        {/* Custom Time Range Inputs & Retention Policy Note */}
        <ExportTimeRange
          preset={preset}
          fromIso={fromIso}
          toIso={toIso}
          onCustomRangeChange={onCustomRangeChange}
          scopeLabel={scopeLabel}
          canExport={canExport}
          exportBlockedReason={exportBlockedReason}
        />
      </div>

      {/* Retention / Authorization Error Banner */}
      {exportError && (
        <ExportErrorBanner exportError={exportError} onDismissError={onDismissError} />
      )}

      {/* Export Metadata Receipt (NFR-HDX-005: X-Export-* headers) */}
      {lastExport && (
        <ExportReceiptBanner lastExport={lastExport} onDismissExport={onDismissExport} />
      )}
    </div>
  );
};
