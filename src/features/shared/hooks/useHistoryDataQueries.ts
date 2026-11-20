/**
 * Query histori — data histori (React Query).
 *
 * Dipisah dari hooks/useHistoricalQueries.ts pada E31.16 lanjutan
 * (FAT-279): file asal 280 baris melanggar batas keras hook (250).
 * Pecahan per domain: data histori (staleTime 5 dtk) vs master
 * (staleTime 30 dtk, useHistoryMasterQueries.ts). Barrel penggabung:
 * hooks/useHistoricalQueries.ts — impor pemanggil tidak berubah.
 */
import { useQuery } from '@tanstack/react-query';
import { apiClient } from '../../../services/api/client';
import { HistoryFilters } from '../../../types/historical';
import { TelemetryRollupGroupBy } from '../../../types/analytics';

export const HISTORY_DATA_STALE_TIME_MS = 5_000;

export function useWorkOrdersQuery(
  filters: HistoryFilters,
  cursor?: string,
  enabled = true
) {
  return useQuery({
    queryKey: ['work-orders', filters, cursor],
    staleTime: HISTORY_DATA_STALE_TIME_MS,
    enabled,
    queryFn: ({ signal }) =>
      apiClient.getWorkOrdersPage(
        {
          wo_id: filters.woId,
          status: filters.status,
          machine_id: filters.machineId,
          from: filters.from,
          to: filters.to,
          limit: filters.limit,
          cursor,
          envelope: true,
        },
        signal
      ),
  });
}

export function useTelemetryHistoryQuery(
  deviceId: string,
  filters: HistoryFilters,
  cursor?: string,
  enabled = true
) {
  return useQuery({
    queryKey: ['telemetry', deviceId, filters, cursor],
    staleTime: HISTORY_DATA_STALE_TIME_MS,
    enabled: enabled && Boolean(deviceId),
    queryFn: ({ signal }) =>
      apiClient.getTelemetryHistoryPage(
        {
          device_id: deviceId,
          from: filters.from,
          to: filters.to,
          is_buffered: filters.isBuffered,
          limit: filters.limit,
          cursor,
          envelope: true,
        },
        signal
      ),
  });
}

export function useTelemetryRollupQuery(
  filters: HistoryFilters,
  cursor?: string,
  enabled = true
) {
  // E12 T12.18 (U-4 / FAT-65): fallback groupBy dokumen `day` (API doc
  // §K.3c) bila pemanggil tidak mengisi groupBy — sama dengan default
  // halaman di `features/analytics/telemetryDefaults.ts`.
  const groupBy: TelemetryRollupGroupBy = filters.groupBy ?? 'day';
  return useQuery({
    queryKey: ['oee-rollup', filters, cursor],
    staleTime: HISTORY_DATA_STALE_TIME_MS,
    enabled,
    queryFn: ({ signal }) =>
      apiClient.getTelemetryRollup(
        {
          group_by: groupBy,
          machine_id: filters.machineId,
          device_id: filters.deviceId,
          from: filters.from,
          to: filters.to,
          limit: filters.limit,
          cursor,
          envelope: true,
        },
        signal
      ),
  });
}

export function useDowntimeHistoryQuery(
  deviceId: string,
  filters: HistoryFilters,
  cursor?: string,
  enabled = true
) {
  return useQuery({
    queryKey: ['downtime', deviceId, filters, cursor],
    staleTime: HISTORY_DATA_STALE_TIME_MS,
    enabled: enabled && Boolean(deviceId),
    queryFn: ({ signal }) =>
      apiClient.getDowntimeHistoryPage(
        {
          device_id: deviceId,
          category: filters.category,
          from: filters.from,
          to: filters.to,
          active_only: filters.activeOnly,
          unlabeled_only: filters.unlabeledOnly,
          limit: filters.limit,
          cursor,
          envelope: true,
        },
        signal
      ),
  });
}

export function useOperationalEventsQuery(
  deviceIdOrGlobal: string,
  filters: HistoryFilters,
  cursor?: string,
  extras?: { acknowledged?: boolean },
  enabled = true
) {
  return useQuery({
    queryKey: ['operational-events', deviceIdOrGlobal, filters, extras, cursor],
    staleTime: HISTORY_DATA_STALE_TIME_MS,
    enabled,
    queryFn: ({ signal }) =>
      apiClient.getOperationalEventsPage(
        {
          device_id: deviceIdOrGlobal === 'ALL' ? undefined : deviceIdOrGlobal,
          event_type: filters.eventType,
          acknowledged: extras?.acknowledged,
          from: filters.from,
          to: filters.to,
          limit: filters.limit,
          cursor,
          envelope: true,
        },
        signal
      ),
  });
}

export function useSystemAuditQuery(
  filters: HistoryFilters,
  cursor?: string,
  enabled = true
) {
  return useQuery({
    queryKey: ['system-audit', filters, cursor],
    staleTime: HISTORY_DATA_STALE_TIME_MS,
    enabled,
    queryFn: ({ signal }) =>
      apiClient.getSystemAuditPage(
        {
          from: filters.from,
          to: filters.to,
          event_type: filters.eventType,
          // E20 P20.4 (FAT-156, R10/O10): `machine_id` hanya ke /system/audit.
          machine_id: filters.machineId,
          limit: filters.limit,
          cursor,
        },
        signal
      ),
  });
}

export function useCombinedHistoryQuery(
  filters: HistoryFilters,
  cursor?: string,
  enabled = true
) {
  return useQuery({
    queryKey: ['history', filters, cursor],
    staleTime: HISTORY_DATA_STALE_TIME_MS,
    enabled,
    queryFn: async ({ signal }) => {
      const [workOrders, rollup, activeDowntimes, opEventsPage] = await Promise.all([
        apiClient.getWorkOrdersPage(
          {
            wo_id: filters.woId,
            status: filters.status,
            machine_id: filters.machineId,
            from: filters.from,
            to: filters.to,
            limit: filters.limit,
            cursor,
            envelope: true,
          },
          signal
        ),
        apiClient.getTelemetryRollup(
          {
            // E12 T12.18 (U-4 / FAT-65): fallback groupBy dokumen `day`
            // (API doc §K.3c); lihat `useTelemetryRollupQuery` di atas.
            group_by: filters.groupBy ?? 'day',
            machine_id: filters.machineId,
            device_id: filters.deviceId,
            from: filters.from,
            to: filters.to,
            limit: filters.limit,
            envelope: true,
          },
          signal
        ),
        apiClient.getActiveDowntimes(signal),
        apiClient.getOperationalEventsPage(
          {
            device_id: filters.deviceId,
            from: filters.from,
            to: filters.to,
            limit: 50,
            envelope: true,
          },
          signal
        ),
      ]);
      // E20 P20.4 (FAT-156, D-12): `machine_id` tidak terdaftar di
      // `GET /operational-events` — filter per mesin dilakukan sisi klien
      // atas baris halaman (bentuk halaman dipertahankan).
      const operationalEvents = filters.machineId
        ? { ...opEventsPage, data: opEventsPage.data.filter((e) => e.machine_id === filters.machineId) }
        : opEventsPage;
      return { workOrders, rollup, activeDowntimes, operationalEvents };
    },
  });
}
