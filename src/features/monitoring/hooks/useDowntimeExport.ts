/**
 * Alur ekspor downtime (E31.5, FAT-268) — satu alur: ekspor CSV/NDJSON
 * per perangkat + cooldown 30 detik setelah 429 + state error/hasil
 * ekspor. Dipindah dari `DowntimeEventsPage` (R8: page hanya
 * orkestrasi); logika + state tidak berubah, hanya lokasi.
 *
 * Filter diteruskan per render (bukan disimpan) supaya ekspor selalu
 * memakai filter yang sedang aktif di halaman.
 */
import { useEffect, useState } from 'react';
import { apiClient } from '../../../services/api/client';
import { ApiError } from '../../../types/auth';
import { useAuth } from '../../../context/AuthContext';
import type { ExportFormat, HistoryFilters } from '../../../types/historical';
import { triggerBrowserDownload, withExportAbortTimeout } from '../../../utils/historicalExport';

export interface DowntimeExportParams {
  deviceId: string;
  filters: Pick<HistoryFilters, 'category' | 'from' | 'to' | 'unlabeledOnly' | 'activeOnly'>;
}

export interface DowntimeExportError {
  code?: string;
  status?: number;
  message: string;
}

export function useDowntimeExport({ deviceId, filters }: DowntimeExportParams) {
  const { reportForbidden } = useAuth();

  const [isExporting, setIsExporting] = useState(false);
  const [cooldownSeconds, setCooldownSeconds] = useState(0);
  const [exportError, setExportError] = useState<DowntimeExportError | null>(null);
  const [lastExport, setLastExport] = useState<Awaited<
    ReturnType<typeof apiClient.exportDowntimeData>
  > | null>(null);

  useEffect(() => {
    if (cooldownSeconds <= 0) return;
    const t = setInterval(() => setCooldownSeconds((c) => Math.max(0, c - 1)), 1000);
    return () => clearInterval(t);
  }, [cooldownSeconds]);

  const handleExport = async (format: ExportFormat) => {
    if (!deviceId || isExporting || cooldownSeconds > 0) return;
    setIsExporting(true);
    setExportError(null);
    try {
      const result = await withExportAbortTimeout(undefined, (signal) =>
        apiClient.exportDowntimeData(
          {
            device_id: deviceId,
            category: filters.category,
            from: filters.from,
            to: filters.to,
            unlabeled_only: filters.unlabeledOnly || undefined,
            active_only: filters.activeOnly || undefined,
            format,
          },
          signal
        )
      );
      setLastExport(result);
      triggerBrowserDownload(result.filename, result.content, result.mimeType);
    } catch (err: unknown) {
      if (err instanceof ApiError && err.httpStatus === 403) {
        reportForbidden('telemetry.refresh', deviceId, err.message);
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
        message: err instanceof Error ? err.message : 'Gagal mengekspor data historis downtime.',
      });
    } finally {
      setIsExporting(false);
    }
  };

  return {
    isExporting,
    cooldownSeconds,
    exportError,
    setExportError,
    lastExport,
    setLastExport,
    handleExport,
  };
}
