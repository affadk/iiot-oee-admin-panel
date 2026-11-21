import { apiClient } from '../../../services/api/client';
import { ApiError, UserRole } from '../../../types/auth';
import { CapabilityKey } from '../../../utils/capabilities';
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

export interface UseOperatorFormMutationsDeps {
  loadOperators: () => Promise<void>;
  reportForbidden: (capability: CapabilityKey, resourceId?: string, reason?: string) => void;
  refreshCapabilities: () => Promise<void>;
  setFeedback: React.Dispatch<React.SetStateAction<FeedbackState | null>>;
}

/**
 * Mutasi form operator — create / update (E32.7, FAT-288: dipindah dari
 * hooks/useOperatorCrud.ts). Satu alur: submit modal — validasi field +
 * lock submit milik modal; hook menjalankan API, reload, feedback
 * sukses, dan — mengikuti preseden useDevices — men-set feedback error
 * LALU melempar ulang agar modal menampilkan submit error. Berbeda
 * dari toggle/rotate/delete (bukan submit modal, gagalnya hanya lewat
 * feedback banner).
 */
export function useOperatorFormMutations({
  loadOperators,
  reportForbidden,
  refreshCapabilities,
  setFeedback,
}: UseOperatorFormMutationsDeps) {
  const createOperator = async (input: CreateOperatorInput): Promise<void> => {
    setFeedback(null);
    try {
      const created = await apiClient.createOperator({
        operator_id: input.operatorId.trim(),
        name: input.name.trim(),
        role: input.role,
        line_id: input.lineId.trim(),
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
        line_id: input.lineId.trim(),
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

  return { createOperator, updateOperator };
}
