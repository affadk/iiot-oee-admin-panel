import { useEffect, useState } from 'react';
import { apiClient } from '../../../services/api/client';
import { ExportFormat, HistoryFilters, TimeWindowPreset } from '../../../types/historical';
import { TelemetryRollupGroupBy, TelemetryRollupItem } from '../../../types/analytics';
import { ApiError } from '../../../types/auth';
import { useAuth } from '../../../context/AuthContext';
import {
  dateKeyInJakarta,
  formatTelemetryRollupExportRows,
  resolveTimeWindowPreset,
  serializeExportRecords,
  TELEMETRY_ROLLUP_CSV_COLUMNS,
  triggerBrowserDownload,
  withExportAbortTimeout,
} from '../../../utils/historicalExport';

export interface UseTelemetryExportInput {
  selectedDevice: string;
  from: string;
  to: string;
  /** E12 T12.7 (F-8 / FAT-60): limit tampilan — dikirim eksplisit pada
      payload ekspor agar jumlah baris yang diekspor dapat diprediksi. */
  limit: number;
  onFilterChange: (patch: Partial<HistoryFilters>) => void;
}

export function useTelemetryExport({
  selectedDevice,
  from,
  to,
  limit,
  onFilterChange,
}: UseTelemetryExportInput) {
  const { reportForbidden } = useAuth();

  const [preset, setPreset] = useState<TimeWindowPreset>('7d');
  const [isExporting, setIsExporting] = useState(false);
  const [cooldownSeconds, setCooldownSeconds] = useState(0);
  const [exportError, setExportError] = useState<{
    code?: string;
    status?: number;
    message: string;
  } | null>(null);
  const [lastExport, setLastExport] = useState<Awaited<
    ReturnType<typeof apiClient.exportTelemetryData>
  > | null>(null);

  useEffect(() => {
    if (cooldownSeconds <= 0) return;
    const t = setInterval(() => setCooldownSeconds((c) => Math.max(0, c - 1)), 1000);
    return () => clearInterval(t);
  }, [cooldownSeconds]);

  const handlePresetChange = (nextPreset: TimeWindowPreset) => {
    setPreset(nextPreset);
    setExportError(null);
    if (nextPreset !== 'custom') {
      const range = resolveTimeWindowPreset(nextPreset);
      onFilterChange({ from: range.from, to: range.to });
    }
  };

  const handleExport = async (format: ExportFormat, hourlyOnly = false) => {
    if (isExporting || cooldownSeconds > 0) return;
    setIsExporting(true);
    setExportError(null);
    try {
      const result = await withExportAbortTimeout(undefined, (signal) => {
        const payload = {
          device_id: selectedDevice,
          from,
          to,
          format,
          // E12 T12.7 (F-8 / FAT-60): limit eksplisit — sebelumnya tidak
          // dikirim sehingga server memakai default-nya sendiri.
          limit,
        };
        return hourlyOnly
          ? apiClient.exportTelemetryHourlyData(payload, signal)
          : apiClient.exportTelemetryData(payload, signal);
      });
      setLastExport(result);
      triggerBrowserDownload(result.filename, result.content, result.mimeType);
    } catch (err: unknown) {
      if (err instanceof ApiError && err.httpStatus === 403) {
        reportForbidden('export.telemetry', selectedDevice, err.message);
      }
      const status =
        err instanceof ApiError
          ? err.httpStatus
          : (err as { status?: number })?.status;
      if (status === 429) {
        setCooldownSeconds(30);
      }
      setExportError({
        code: (err as { code?: string })?.code,
        status,
        message: err instanceof Error ? err.message : 'Gagal mengekspor telemetri historis.',
      });
    } finally {
      setIsExporting(false);
    }
  };

  /**
   * E12 T12.7 (F-8 / FAT-60): ekspor rollup sebagai CSV dari baris yang
   * sedang tampil — tanpa endpoint baru, diserialisasi di klien dari data
   * yang sudah dimuat (kolom = kolom layar, lihat
   * TELEMETRY_ROLLUP_CSV_COLUMNS). Tidak memakai rate-limit/cooldown
   * ekspor server karena tidak ada panggilan jaringan.
   */
  const handleExportRollup = (rows: TelemetryRollupItem[], groupBy: TelemetryRollupGroupBy) => {
    try {
      const formatted = formatTelemetryRollupExportRows(rows);
      const { content, mimeType } = serializeExportRecords(formatted, 'csv', [
        ...TELEMETRY_ROLLUP_CSV_COLUMNS,
      ]);
      // E12 T12.11 (X-4 / FAT-59): tanggal nama file dalam WIB, bukan UTC.
      const generatedAt = dateKeyInJakarta(new Date()) ?? new Date().toISOString().slice(0, 10);
      triggerBrowserDownload(`telemetry_rollup_${groupBy}_${generatedAt}.csv`, content, mimeType);
    } catch (err: unknown) {
      setExportError({
        message: err instanceof Error ? err.message : 'Gagal mengekspor rollup.',
      });
    }
  };

  return {
    preset,
    isExporting,
    cooldownSeconds,
    exportError,
    lastExport,
    handlePresetChange,
    handleExport,
    handleExportRollup,
    dismissExportError: () => setExportError(null),
    dismissLastExport: () => setLastExport(null),
  };
}
