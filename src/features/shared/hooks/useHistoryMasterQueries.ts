/**
 * Query histori — data master (React Query).
 *
 * Dipisah dari hooks/useHistoricalQueries.ts pada E31.16 lanjutan
 * (FAT-279): file asal 280 baris melanggar batas keras hook (250).
 * Pecahan per domain: master (staleTime 30 dtk) vs data histori
 * (staleTime 5 dtk, useHistoryDataQueries.ts). Barrel penggabung:
 * hooks/useHistoricalQueries.ts — impor pemanggil tidak berubah.
 */
import { useQuery } from '@tanstack/react-query';
import { apiClient } from '../../../services/api/client';

export const MASTER_DATA_STALE_TIME_MS = 30_000;

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
