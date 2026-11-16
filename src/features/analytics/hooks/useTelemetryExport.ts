import { useEffect, useState } from 'react';
import { apiClient } from '../../../services/api/client';
import { ExportFormat, HistoryFilters, TimeWindowPreset } from '../../../types/historical';
import { ApiError } from '../../../types/auth';
import { useAuth } from '../../../context/AuthContext';
import {
  resolveTimeWindowPreset,
  triggerBrowserDownload,
  withExportAbortTimeout,
} from '../../../utils/historicalExport';

export interface UseTelemetryExportInput {
  selectedDevice: string;
  from: string;
  to: string;
  onFilterChange: (patch: Partial<HistoryFilters>) => void;
}

export function useTelemetryExport({
  selectedDevice,
  from,
  to,
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

  return {
    preset,
    isExporting,
    cooldownSeconds,
    exportError,
    lastExport,
    handlePresetChange,
    handleExport,
    dismissExportError: () => setExportError(null),
    dismissLastExport: () => setLastExport(null),
  };
}
