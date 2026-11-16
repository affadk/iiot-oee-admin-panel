import { useCallback, useEffect, useState } from 'react';
import { apiClient } from '../../../services/api/client';
import { telemetrySocket } from '../../../services/ws/telemetrySocket';
import { Machine, EdgeDevice } from '../../../types/assets';

export interface FeedbackState {
  type: 'success' | 'error';
  msg: string;
  activeWoId?: string;
  conflictMachineForUnbind?: Machine;
}

export type BindingFilter = 'ALL' | 'BOUND' | 'UNBOUND';

export function useMachines() {
  const [machines, setMachines] = useState<Machine[]>([]);
  const [devices, setDevices] = useState<EdgeDevice[]>([]);
  const [bindingFilter, setBindingFilter] = useState<BindingFilter>('ALL');
  const [totalCount, setTotalCount] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [pageLimit, setPageLimit] = useState(20);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);

  const [feedback, setFeedback] = useState<FeedbackState | null>(null);

  const loadData = useCallback(
    async (cursor?: string | null, append = false) => {
      if (append) setIsLoadingMore(true);
      else setIsLoading(true);
      try {
        const [mPage, devList] = await Promise.all([
          apiClient.getMachinesPage({ cursor: cursor ?? undefined, limit: pageLimit }),
          apiClient.getDevices(),
        ]);
        setMachines((prev) => (append ? [...prev, ...mPage.data] : mPage.data));
        setTotalCount((prev) => mPage.pagination.total_count ?? (append ? prev + mPage.data.length : mPage.data.length));
        setHasMore(mPage.pagination.has_more);
        setNextCursor(mPage.pagination.next_cursor);
        setDevices(devList);
      } catch (err: any) {
        setFeedback({ type: 'error', msg: err?.message || 'Gagal memuat daftar mesin.' });
      } finally {
        setIsLoading(false);
        setIsLoadingMore(false);
      }
    },
    [pageLimit]
  );

  useEffect(() => {
    loadData(null, false);
    const unsub = telemetrySocket.subscribe((event) => {
      if (
        event.type === 'MACHINE_CREATED' ||
        event.type === 'MACHINE_UPDATED' ||
        event.type === 'MACHINE_DELETED' ||
        event.type === 'MACHINE_BOUND' ||
        event.type === 'MACHINE_UNBOUND' ||
        event.type === 'DEVICE_EVENT'
      ) {
        loadData(null, false);
      }
    });
    return () => unsub();
  }, [loadData]);

  const unboundDevices = devices.filter((d) => !d.bound_machine_id);
  const boundMachinesCount = machines.filter((m) => Boolean(m.bound_device_id)).length;
  const unboundMachinesCount = machines.length - boundMachinesCount;
  const filteredMachines = machines.filter((m) => {
    if (bindingFilter === 'BOUND') return Boolean(m.bound_device_id);
    if (bindingFilter === 'UNBOUND') return !m.bound_device_id;
    return true;
  });

  return {
    machines,
    devices,
    bindingFilter,
    setBindingFilter,
    totalCount,
    hasMore,
    nextCursor,
    pageLimit,
    setPageLimit,
    isLoading,
    isLoadingMore,
    feedback,
    setFeedback,
    loadData,
    unboundDevices,
    boundMachinesCount,
    unboundMachinesCount,
    filteredMachines,
  };
}
