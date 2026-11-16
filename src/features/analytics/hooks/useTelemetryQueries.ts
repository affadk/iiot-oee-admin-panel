import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { apiClient } from '../../../services/api/client';
import { HistoryFilters } from '../../../types/historical';
import {
  useMasterAssetsQuery,
  useTelemetryHistoryQuery,
  useTelemetryRollupQuery,
} from '../../shared/useHistoricalQueries';

export type AggBucket = '1m' | '5m' | '15m' | '1h' | '1d';
export type TelemetryTab = 'raw' | 'hourly' | 'aggregate' | 'rollup';

export interface TelemetryAggregateSummary {
  device_id: string;
  bucket: string;
  avg_oee: number;
  avg_availability: number;
  avg_performance: number;
  avg_quality: number;
  total_parts: number;
  sample_count: number;
}

export interface UseTelemetryQueriesInput {
  filters: HistoryFilters;
  isValid: boolean;
  selectedDevice: string;
  aggBucket: AggBucket;
  rollupDeviceFilter: string;
  activeTab: TelemetryTab;
  activeCursor: string | undefined;
}

export function useTelemetryQueries({
  filters,
  isValid,
  selectedDevice,
  aggBucket,
  rollupDeviceFilter,
  activeTab,
  activeCursor,
}: UseTelemetryQueriesInput) {
  const { data: masterData } = useMasterAssetsQuery();
  const devices = masterData?.devices ?? [];
  const machines = masterData?.machines ?? [];

  const telemetryQuery = useTelemetryHistoryQuery(
    selectedDevice,
    filters,
    activeCursor,
    isValid && activeTab === 'raw'
  );

  const hourlyQuery = useQuery({
    queryKey: ['telemetry-hourly', selectedDevice, filters.from, filters.to],
    enabled: isValid && Boolean(selectedDevice) && (activeTab === 'hourly' || activeTab === 'raw'),
    staleTime: 5_000,
    queryFn: ({ signal }) => apiClient.getHourlyTrend(selectedDevice, signal),
  });

  const aggregateQuery = useQuery({
    queryKey: ['telemetry-aggregate', selectedDevice, aggBucket],
    enabled:
      isValid && Boolean(selectedDevice) && (activeTab === 'aggregate' || activeTab === 'raw'),
    staleTime: 5_000,
    queryFn: ({ signal }) => apiClient.getTelemetryAggregate(selectedDevice, aggBucket, signal),
  });

  const rollupFilters = useMemo(
    () => ({
      ...filters,
      deviceId: rollupDeviceFilter === 'ALL' ? undefined : rollupDeviceFilter,
    }),
    [filters, rollupDeviceFilter]
  );

  const rollupQuery = useTelemetryRollupQuery(
    rollupFilters,
    activeCursor,
    isValid && activeTab === 'rollup'
  );

  const rawRecords = telemetryQuery.data?.data ?? [];
  const rawPagination = telemetryQuery.data?.pagination;
  const rollupRecords = rollupQuery.data?.data ?? [];
  const rollupPagination = rollupQuery.data?.pagination;
  const hourlyData = hourlyQuery.data ?? [];
  const aggData = aggregateQuery.data;

  const deviceOptions = useMemo(() => {
    const ids = new Set(devices.map((d) => d.device_id));
    if (selectedDevice && !ids.has(selectedDevice)) {
      return [
        ...devices,
        {
          device_id: selectedDevice,
          bound_machine_name: '[dihapus / historis]',
        },
      ];
    }
    return devices;
  }, [devices, selectedDevice]);

  return {
    devices,
    machines,
    telemetryQuery,
    hourlyQuery,
    aggregateQuery,
    rollupQuery,
    rawRecords,
    rawPagination,
    rollupRecords,
    rollupPagination,
    hourlyData,
    aggData,
    deviceOptions,
  };
}
