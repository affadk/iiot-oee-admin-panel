import { useCallback, useState } from 'react';
import { apiClient } from '../../../services/api/client';
import { EdgeDevice } from '../../../types/assets';
import { ApiError } from '../../../types/auth';
import { CapabilityKey } from '../../../utils/capabilities';
import { ConflictDialogState } from '../../../components/ui/ConflictDialog';
import { FeedbackState } from './useDevices';

export interface UseDeviceDeleteDeps {
  loadDevices: () => Promise<void>;
  reportForbidden: (capability: CapabilityKey, resourceId?: string, reason?: string) => void;
  setFeedback: React.Dispatch<React.SetStateAction<FeedbackState | null>>;
  onDeviceDeleted: (deviceId: string) => void;
}

/**
 * Alur hapus perangkat edge + dialog konflik (E32.7, FAT-288: dipindah
 * dari hooks/useDevices.ts — satu alur dengan state-nya sendiri:
 * target hapus + konflik WO aktif). Hapus bukan submit modal: gagalnya
 * hanya lewat feedback banner (kecuali 409 → dialog konflik).
 */
export function useDeviceDelete({ loadDevices, reportForbidden, setFeedback, onDeviceDeleted }: UseDeviceDeleteDeps) {
  const [deleteTarget, setDeleteTarget] = useState<EdgeDevice | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [conflictState, setConflictState] = useState<ConflictDialogState | null>(null);

  const handleDelete = useCallback(async () => {
    if (!deleteTarget) return;
    setIsDeleting(true);
    setFeedback(null);
    try {
      const targetId = deleteTarget.device_id;
      await apiClient.deleteDevice(targetId);
      onDeviceDeleted(targetId);
      await loadDevices();
      setFeedback({
        type: 'success',
        msg: `Perangkat ${targetId} dihapus. Riwayat pemantauan & henti mesin tetap tersimpan untuk arsip.`,
      });
      setDeleteTarget(null);
    } catch (err: any) {
      if (err instanceof ApiError && err.httpStatus === 403) {
        reportForbidden('device.manage', deleteTarget.device_id, err.message);
      }
      if (err instanceof ApiError && err.httpStatus === 409) {
        await loadDevices();
        setConflictState({
          open: true,
          code: err.code,
          title: `Tidak Dapat Menghapus Perangkat ${deleteTarget.device_id}`,
          message: err.message,
          activeWoId: err.activeWoId,
        });
      }
      setFeedback({
        type: 'error',
        msg: err?.message || 'Gagal menghapus perangkat.',
        activeWoId: err?.activeWoId,
      });
      setDeleteTarget(null);
    } finally {
      setIsDeleting(false);
    }
  }, [deleteTarget, loadDevices, onDeviceDeleted, reportForbidden, setFeedback]);

  return {
    deleteTarget,
    setDeleteTarget,
    isDeleting,
    handleDelete,
    conflictState,
    setConflictState,
  };
}
