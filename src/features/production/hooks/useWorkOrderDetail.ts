import { useState } from 'react';
import { apiClient } from '../../../services/api/client';
import { WorkOrder, WorkOrderResolveResult } from '../../../types/production';

export function useWorkOrderDetail() {
  // Detail & Correlation Modal
  const [selectedWo, setSelectedWo] = useState<WorkOrder | null>(null);
  const [resolveResult, setResolveResult] = useState<WorkOrderResolveResult | null>(null);
  const [resolveError, setResolveError] = useState<string | null>(null);
  const [isResolving, setIsResolving] = useState(false);

  const openDetail = (wo: WorkOrder) => {
    setSelectedWo(wo);
    setResolveResult(null);
    setResolveError(null);
  };

  const closeDetail = () => {
    setSelectedWo(null);
    setResolveResult(null);
    setResolveError(null);
  };

  const previewResolve = async (wo: WorkOrder) => {
    if (isResolving) return;
    setIsResolving(true);
    setResolveError(null);
    try {
      const res = await apiClient.resolveWorkOrder(wo.wo_id);
      setResolveResult(res);
    } catch (err: unknown) {
      const msg =
        err instanceof Error
          ? err.message
          : 'Gagal melakukan resolve Work Order (periksa status online perangkat edge).';
      setResolveError(msg);
    } finally {
      setIsResolving(false);
    }
  };

  return { selectedWo, resolveResult, resolveError, isResolving, openDetail, closeDetail, previewResolve };
}
