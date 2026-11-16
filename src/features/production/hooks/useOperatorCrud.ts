import { useState } from 'react';
import { apiClient } from '../../../services/api/client';
import { Operator } from '../../../types/production';
import { ApiError, UserRole } from '../../../types/auth';
import { CapabilityKey } from '../../../utils/capabilities';
import { ConflictDialogState } from '../../../components/ui/ConflictDialog';
import { FeedbackState } from './useOperators';

export interface CreateOperatorInput {
  operatorId: string;
  name: string;
  role: UserRole;
  lineId: string;
  password: string;
}

export interface UpdateOperatorInput {
  name: string;
  role: UserRole;
  lineId: string;
}

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
 * Validasi field + lock submit milik modal; hook hanya menjalankan API,
 * reload, feedback sukses, dan — mengikuti preseden useDevices — men-set
 * feedback error LALU melempar ulang agar modal menampilkan submit error.
 * Toggle/delete bukan submit modal: gagalnya hanya lewat feedback banner.
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
  const [isDeleting, setIsDeleting] = useState(false);
  const [conflictState, setConflictState] = useState<ConflictDialogState | null>(null);

  const createOperator = async (input: CreateOperatorInput): Promise<void> => {
    setFeedback(null);
    try {
      const created = await apiClient.createOperator({
        operator_id: input.operatorId.trim(),
        name: input.name.trim(),
        role: input.role,
        line_id: input.lineId.trim() || 'LINE-01',
        password: input.password,
      });
      await loadOperators();
      setFeedback({
        type: 'success',
        msg: `Akun operator ${created.operator_id} (${created.role}) berhasil dibuat.`,
      });
    } catch (err: unknown) {
      if (err instanceof ApiError && err.httpStatus === 403) {
        reportForbidden('operator.create', input.operatorId, err.message);
      }
      setFeedback({
        type: 'error',
        msg: err instanceof Error ? err.message : 'Gagal membuat akun operator.',
      });
      throw err;
    }
  };

  const updateOperator = async (operatorId: string, input: UpdateOperatorInput): Promise<void> => {
    setFeedback(null);
    try {
      const updated = await apiClient.updateOperator(operatorId, {
        name: input.name.trim(),
        role: input.role,
        line_id: input.lineId.trim() || 'LINE-01',
      });
      await loadOperators();
      await refreshCapabilities();
      setFeedback({ type: 'success', msg: `Profil operator ${updated.operator_id} berhasil diperbarui.` });
    } catch (err: unknown) {
      if (err instanceof ApiError && err.httpStatus === 403) {
        reportForbidden('operator.update', operatorId, err.message);
      }
      setFeedback({
        type: 'error',
        msg: err instanceof Error ? err.message : 'Gagal memperbarui profil operator.',
      });
      throw err;
    }
  };

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
