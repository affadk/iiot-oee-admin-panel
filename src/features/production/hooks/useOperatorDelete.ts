import { useState } from 'react';
import { apiClient } from '../../../services/api/client';
import { Operator } from '../../../types/production';
import { ApiError } from '../../../types/auth';
import { CapabilityKey } from '../../../utils/capabilities';
import { ConflictDialogState } from '../../../components/ui/ConflictDialog';
import { FeedbackState } from './useOperators';

export interface UseOperatorDeleteDeps {
  loadOperators: () => Promise<void>;
  reportForbidden: (capability: CapabilityKey, resourceId?: string, reason?: string) => void;
  setFeedback: React.Dispatch<React.SetStateAction<FeedbackState | null>>;
  onOperatorDeleted: (operatorId: string) => void;
}

/**
 * Alur hapus operator + dialog konflik (E32.7, FAT-288: dipindah dari
 * hooks/useOperatorCrud.ts — satu alur dengan state-nya sendiri:
 * lock hapus + konflik WO aktif). Hapus bukan submit modal: gagalnya
 * hanya lewat feedback banner (kecuali 409 → dialog konflik).
 */
export function useOperatorDelete({
  loadOperators,
  reportForbidden,
  setFeedback,
  onOperatorDeleted,
}: UseOperatorDeleteDeps) {
  const [isDeleting, setIsDeleting] = useState(false);
  const [conflictState, setConflictState] = useState<ConflictDialogState | null>(null);

  const deleteOperator = async (target: Operator): Promise<void> => {
    if (isDeleting) return;
    setIsDeleting(true);
    setFeedback(null);
    try {
      await apiClient.deleteOperator(target.operator_id);
      const deletedId = target.operator_id;
      onOperatorDeleted(deletedId);
      await loadOperators();
      setFeedback({
        type: 'success',
        msg: `Operator ${deletedId} dihapus. Riwayat Work Order terdahulu tetap tersimpan untuk arsip.`,
      });
    } catch (err: unknown) {
      if (err instanceof ApiError && err.httpStatus === 403) {
        reportForbidden('operator.delete', target.operator_id, err.message);
      }
      if (err instanceof ApiError && err.httpStatus === 409) {
        setConflictState({
          open: true,
          code: err.code,
          title: `Tidak Dapat Menghapus Operator ${target.operator_id}`,
          message: err.message,
          activeWoId: err.activeWoId,
        });
      }
      const extraWo = err instanceof ApiError && err.activeWoId ? ` (Active WO: ${err.activeWoId})` : '';
      setFeedback({
        type: 'error',
        msg: `${err instanceof Error ? err.message : 'Gagal menghapus operator.'}${extraWo}`,
      });
    } finally {
      setIsDeleting(false);
    }
  };

  return { deleteOperator, isDeleting, conflictState, setConflictState };
}
