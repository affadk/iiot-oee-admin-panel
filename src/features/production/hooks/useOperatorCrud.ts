import { apiClient } from '../../../services/api/client';
import { Operator } from '../../../types/production';
import { ApiError } from '../../../types/auth';
import { CapabilityKey } from '../../../utils/capabilities';
import { FeedbackState } from './useOperators';
import { useOperatorFormMutations } from './useOperatorFormMutations';
import { useOperatorDelete } from './useOperatorDelete';

// Tipe input mutasi form tinggal di useOperatorFormMutations.ts
// (E32.7, FAT-288); di-re-export dari sini supaya impor modal lama
// tetap jalan.
export type {
  CreateOperatorInput,
  UpdateOperatorInput,
} from './useOperatorFormMutations';

export interface UseOperatorCrudOptions {
  loadOperators: () => Promise<void>;
  reportForbidden: (capability: CapabilityKey, resourceId?: string, reason?: string) => void;
  refreshCapabilities: () => Promise<void>;
  setFeedback: React.Dispatch<React.SetStateAction<FeedbackState | null>>;
  togglingId: string | null;
  setTogglingId: React.Dispatch<React.SetStateAction<string | null>>;
  onOperatorDeleted: (operatorId: string) => void;
}

/**
 * Mutasi CRUD operator (R9.5, dipindah dari OperatorsPage L131–284).
 * Toggle/rotate bukan submit modal: gagalnya hanya lewat feedback
 * banner. Bentuk return tidak berubah (dipakai OperatorsPage).
 *
 * E32.7 (FAT-288): mutasi form (create/update, melempar ulang untuk
 * submit error modal) dipindah ke useOperatorFormMutations.ts; alur
 * hapus + konflik ke useOperatorDelete.ts — hook ini tinggal
 * orkestrasi + toggle status + rotasi password.
 */
export function useOperatorCrud({
  loadOperators,
  reportForbidden,
  refreshCapabilities,
  setFeedback,
  togglingId,
  setTogglingId,
  onOperatorDeleted,
}: UseOperatorCrudOptions) {
  const { createOperator, updateOperator } = useOperatorFormMutations({
    loadOperators,
    reportForbidden,
    refreshCapabilities,
    setFeedback,
  });

  const { deleteOperator, isDeleting, conflictState, setConflictState } = useOperatorDelete({
    loadOperators,
    reportForbidden,
    setFeedback,
    onOperatorDeleted,
  });

  const toggleOperatorStatus = async (op: Operator): Promise<void> => {
    if (togglingId) return;
    setTogglingId(op.operator_id);
    setFeedback(null);
    try {
      const updated = await apiClient.toggleOperatorStatus(op.operator_id, !op.is_active);
      await loadOperators();
      setFeedback({
        type: 'success',
        msg: `Status ${updated.operator_id} diubah menjadi ${updated.is_active ? 'ACTIVE' : 'SUSPENDED'}.`,
      });
    } catch (err: unknown) {
      if (err instanceof ApiError && err.httpStatus === 403) {
        reportForbidden('operator.status.update', op.operator_id, err.message);
      }
      setFeedback({
        type: 'error',
        msg: err instanceof Error ? err.message : 'Gagal mengubah status operator.',
      });
    } finally {
      setTogglingId(null);
    }
  };

  const rotateOperatorPassword = async (operatorId: string, newPassword: string): Promise<void> => {
    setFeedback(null);
    try {
      const res = await apiClient.rotateOperatorPassword(operatorId, newPassword);
      setFeedback({ type: 'success', msg: res.message });
    } catch (err: unknown) {
      if (err instanceof ApiError && err.httpStatus === 403) {
        reportForbidden('operator.password.rotate', operatorId, err.message);
      }
      setFeedback({ type: 'error', msg: err instanceof Error ? err.message : 'Gagal merotasi password.' });
      throw err;
    }
  };

  return {
    createOperator,
    updateOperator,
    toggleOperatorStatus,
    rotateOperatorPassword,
    deleteOperator,
    isDeleting,
    conflictState,
    setConflictState,
  };
}
