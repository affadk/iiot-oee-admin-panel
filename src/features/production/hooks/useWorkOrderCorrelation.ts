import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { apiClient } from '../../../services/api/client';
import { Machine } from '../../../types/assets';
import { WorkOrder } from '../../../types/production';
import {
  correlateWorkOrderData,
  resolveWorkOrderDeviceId,
  resolveWorkOrderWindow,
} from '../../shared/historyFilters';

export function useWorkOrderCorrelation(selectedWo: WorkOrder | null, machines: Machine[]) {
  const selectedDeviceId = useMemo(
    () => (selectedWo ? resolveWorkOrderDeviceId(selectedWo, machines) : null),
    [selectedWo, machines]
  );

  const selectedWindow = useMemo(
    () => (selectedWo ? resolveWorkOrderWindow(selectedWo) : null),
    [selectedWo]
  );

  // Correlated production data for selected WO
  const correlationQuery = useQuery({
    queryKey: ['wo-correlation', selectedWo?.wo_id, selectedDeviceId, selectedWindow?.from, selectedWindow?.to],
    enabled: Boolean(selectedWo && selectedWindow),
    staleTime: 5_000,
    queryFn: async ({ signal }) => {
      if (!selectedWo || !selectedWindow) return null;
      const freshWo = await apiClient.getWorkOrderById(selectedWo.wo_id, signal).catch(() => selectedWo);

      if (!selectedDeviceId) {
        const opEventsPage = await apiClient.getOperationalEventsPage(
          {
            machine_id: selectedWo.machine_id ?? undefined,
            from: selectedWindow.from,
            to: selectedWindow.to,
            limit: 50,
            envelope: true,
          },
          signal
        );
        return {
          wo: freshWo,
          telemetry: [],
          hourly: [],
          downtimes: [],
          operationalEvents: opEventsPage.data,
          summary: correlateWorkOrderData({
            workOrder: freshWo,
            machines,
            telemetryRecords: [],
            hourlyPoints: [],
            downtimeEvents: [],
            operationalEvents: opEventsPage.data,
          }),
        };
      }

      const [telPage, hourly, dtPage, opPage] = await Promise.all([
        apiClient.getTelemetryHistoryPage(
          {
            device_id: selectedDeviceId,
            from: selectedWindow.from,
            to: selectedWindow.to,
            limit: 100,
            envelope: true,
          },
          signal
        ),
        apiClient.getHourlyTrend(selectedDeviceId, signal).catch(() => []),
        apiClient.getDowntimeHistoryPage(
          {
            device_id: selectedDeviceId,
            from: selectedWindow.from,
            to: selectedWindow.to,
            limit: 50,
            envelope: true,
          },
          signal
        ),
        apiClient.getOperationalEventsPage(
          {
            device_id: selectedDeviceId,
            from: selectedWindow.from,
            to: selectedWindow.to,
            limit: 50,
            envelope: true,
          },
          signal
        ),
      ]);

      return {
        wo: freshWo,
        telemetry: telPage.data,
        hourly,
        downtimes: dtPage.data,
        operationalEvents: opPage.data,
        summary: correlateWorkOrderData({
          workOrder: freshWo,
          machines,
          telemetryRecords: telPage.data,
          hourlyPoints: hourly,
          downtimeEvents: dtPage.data,
          operationalEvents: opPage.data,
        }),
      };
    },
  });

  const displayedWo = correlationQuery.data?.wo ?? selectedWo;
  const corrSummary = correlationQuery.data?.summary;

  return { selectedDeviceId, selectedWindow, correlationQuery, displayedWo, corrSummary };
}
