import { useEffect, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { apiClient } from '../../../services/api/client';
import { OperationalEvent } from '../../../types/monitoring';
import { ExportFormat, HistoryFilters, TimeWindowPreset } from '../../../types/historical';
import { ApiError } from '../../../types/auth';
import { useAuth } from '../../../context/AuthContext';
import {
  resolveTimeWindowPreset,
  triggerBrowserDownload,
  withExportAbortTimeout,
} from '../../../utils/historicalExport';

export interface UseOperationalEventsParams {
  filters: HistoryFilters;
  deviceFilter: string;
  onFilterChange: (patch: Partial<HistoryFilters>) => void;
}

export function useOperationalEvents({
  filters,
  deviceFilter,
  onFilterChange,
}: UseOperationalEventsParams) {
  const { reportForbidden } = useAuth();
  const queryClient = useQueryClient();

  const [preset, setPreset] = useState<TimeWindowPreset>('7d');
  const [isExporting, setIsExporting] = useState(false);
  const [cooldownSeconds, setCooldownSeconds] = useState(0);
  const [exportError, setExportError] = useState<{
    code?: string;
    status?: number;
    message: string;
  } | null>(null);
  const [lastExport, setLastExport] = useState<Awaited<
    ReturnType<typeof apiClient.exportOperationalEventsData>
  > | null>(null);

  const [ackTarget, setAckTarget] = useState<OperationalEvent | null>(null);
  const [isAcking, setIsAcking] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

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

  const handleExport = async (format: ExportFormat) => {
    if (isExporting || cooldownSeconds > 0) return;
    setIsExporting(true);
    setExportError(null);
    try {
      const result = await withExportAbortTimeout(undefined, (signal) =>
        apiClient.exportOperationalEventsData(
          {
            device_id: deviceFilter,
            // E20 P20.4 (FAT-156, D-12): ekspor global hanya mendaftarkan
            // from/to/format/limit — tanpa machine_id/event_type.
            from: filters.from,
            to: filters.to,
            format,
          },
          signal
        )
      );
      setLastExport(result);
      triggerBrowserDownload(result.filename, result.content, result.mimeType);
    } catch (err: unknown) {
      if (err instanceof ApiError && err.httpStatus === 403) {
        reportForbidden('telemetry.refresh', deviceFilter, err.message);
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
        message: err instanceof Error ? err.message : 'Gagal mengekspor operational events.',
      });
    } finally {
      setIsExporting(false);
    }
  };

  const confirmAck = async (note: string) => {
    if (!ackTarget || isAcking) return;
    setIsAcking(true);
    setActionError(null);
    try {
      await apiClient.acknowledgeOperationalEvent(ackTarget.id, note.trim() || undefined);
      setAckTarget(null);
      await queryClient.invalidateQueries({ queryKey: ['operational-events'] });
    } catch (err: unknown) {
      if (err instanceof ApiError && err.httpStatus === 403) {
        reportForbidden('operational_event.ack', ackTarget.id, err.message);
      }
      setActionError(err instanceof Error ? err.message : 'Gagal melakukan acknowledge event.');
    } finally {
      setIsAcking(false);
    }
  };

  return {
    preset,
    isExporting,
    cooldownSeconds,
    exportError,
    setExportError,
    lastExport,
    setLastExport,
    ackTarget,
    setAckTarget,
    isAcking,
    actionError,
    handlePresetChange,
    handleExport,
    confirmAck,
  };
}
