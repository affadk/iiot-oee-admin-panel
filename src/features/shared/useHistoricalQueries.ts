import { useQuery } from '@tanstack/react-query';
import { apiClient } from '../../services/api/client';
import { HistoryFilters } from '../../types/historical';
import { TelemetryRollupGroupBy } from '../../types/analytics';

export const MASTER_DATA_STALE_TIME_MS = 30_000;
export const HISTORY_DATA_STALE_TIME_MS = 5_000;

export function useMasterAssetsQuery(enabled = true) {
  return useQuery({
    queryKey: ['master-assets'],
    staleTime: MASTER_DATA_STALE_TIME_MS,
    enabled,
    queryFn: async ({ signal }) => {
      const [machines, devices, products, operators] = await Promise.all([
        apiClient.getMachines(signal),
        apiClient.getDevices(signal),
        apiClient.getProducts(signal),
        apiClient.getOperators(signal),
      ]);
      return { machines, devices, products, operators };
    },
  });
}

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
  extras?: { severity?: string; acknowledged?: boolean },
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
          machine_id: deviceIdOrGlobal === 'ALL' ? filters.machineId : undefined,
          event_type: filters.eventType,
          severity: extras?.severity && extras.severity !== 'ALL' ? extras.severity : undefined,
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
          limit: filters.limit,
          cursor,
        },
        signal
      ),
  });
}

export function useProductionLinesQuery(enabled = true) {
  return useQuery({
    queryKey: ['production-lines'],
    staleTime: MASTER_DATA_STALE_TIME_MS,
    enabled,
    queryFn: ({ signal }) => apiClient.getProductionLinesPage({ limit: 100, envelope: true }, signal),
  });
}

export function useShiftsQuery(enabled = true) {
  return useQuery({
    queryKey: ['shifts'],
    staleTime: MASTER_DATA_STALE_TIME_MS,
    enabled,
    queryFn: ({ signal }) => apiClient.getShiftsPage({ limit: 100, envelope: true }, signal),
  });
}

export function useShiftSchedulesQuery(
  filters: { line_id?: string; shift_id?: string; day_of_week?: number; is_active?: boolean } = {},
  enabled = true
) {
  return useQuery({
    queryKey: ['shift-schedules', filters],
    staleTime: MASTER_DATA_STALE_TIME_MS,
    enabled,
    queryFn: ({ signal }) =>
      apiClient.getShiftSchedulesPage({ ...filters, limit: 100, envelope: true }, signal),
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
      const [workOrders, rollup, activeDowntimes, operationalEvents] = await Promise.all([
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
            machine_id: filters.machineId,
            from: filters.from,
            to: filters.to,
            limit: 50,
            envelope: true,
          },
          signal
        ),
      ]);
      return { workOrders, rollup, activeDowntimes, operationalEvents };
    },
  });
}
