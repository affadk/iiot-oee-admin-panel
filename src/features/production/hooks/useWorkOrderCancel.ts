import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { apiClient } from '../../../services/api/client';
import { ApiError } from '../../../types/auth';
import { WorkOrder } from '../../../types/production';
import { ConflictDialogState } from '../../../components/ui/ConflictDialog';
import { useAuth } from '../../../context/AuthContext';

export function useWorkOrderCancel() {
  const queryClient = useQueryClient();
  const { reportForbidden } = useAuth();

  // Cancel Modal + 409 Conflict Dialog
  const [cancelTarget, setCancelTarget] = useState<WorkOrder | null>(null);
  const [cancelReason, setCancelReason] = useState('');
  const [isCancelling, setIsCancelling] = useState(false);
  const [conflictState, setConflictState] = useState<ConflictDialogState | null>(null);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; msg: string } | null>(null);

  const requestCancel = (wo: WorkOrder) => {
    setCancelTarget(wo);
    setCancelReason('');
  };

  const confirmCancel = async () => {
    if (!cancelTarget || isCancelling) return;
    setIsCancelling(true);
    setFeedback(null);
    try {
      const res = await apiClient.cancelWorkOrder(cancelTarget.wo_id, cancelReason.trim() || undefined);
      setFeedback({
        type: 'success',
        msg: `Work Order ${res.work_order.wo_id} berhasil dibatalkan (ABORTED).`,
      });
      setCancelTarget(null);
      setCancelReason('');
      await queryClient.invalidateQueries({ queryKey: ['work-orders'] });
    } catch (err: unknown) {
      if (err instanceof ApiError && err.httpStatus === 403) {
        reportForbidden('work_order.cancel', cancelTarget.wo_id, err.message);
      }
      if (err instanceof ApiError && err.httpStatus === 409) {
        setCancelTarget(null);
        setConflictState({
          open: true,
          code: err.code,
          title: 'Konflik Pembatalan Work Order (409)',
          message: err.message,
          activeWoId: err.activeWoId,
        });
        return;
      }
      setFeedback({
        type: 'error',
        msg: err instanceof Error ? err.message : 'Gagal membatalkan Work Order.',
      });
    } finally {
      setIsCancelling(false);
    }
  };

  const dismissFeedback = () => setFeedback(null);
  const closeConflict = () => setConflictState(null);

  return {
    cancelTarget,
    setCancelTarget,
    cancelReason,
    setCancelReason,
    isCancelling,
    conflictState,
    feedback,
    requestCancel,
    confirmCancel,
    dismissFeedback,
    closeConflict,
  };
}
