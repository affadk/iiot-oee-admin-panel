import { useCallback, useState } from 'react';
import { httpStations } from '../../../services/api/http/stations';
import { Station } from '../../../types/assets';
import { ApiError } from '../../../types/auth';
import { CapabilityKey } from '../../../utils/capabilities';
import { ConflictDialogState } from '../../../components/ui/ConflictDialog';
import { FeedbackState } from './useDevices';

export interface UseStationConfirmationsDeps {
  loadStations: () => Promise<void>;
  reportForbidden: (capability: CapabilityKey, resourceId?: string, reason?: string) => void;
  setFeedback: React.Dispatch<React.SetStateAction<FeedbackState | null>>;
}

/**
 * Alur konfirmasi stasiun: revoke (reason wajib 1..200) + hapus,
 * berbagi state dialog konflik (E32.7, FAT-288: dipindah dari
 * hooks/useStations.ts — satu alur dengan state-nya sendiri).
 * Keduanya bukan submit modal: gagalnya hanya lewat feedback banner
 * (kecuali 409 → dialog konflik); revoke melempar ulang agar pemanggil
 * tahu gagal.
 */
export function useStationConfirmations({ loadStations, reportForbidden, setFeedback }: UseStationConfirmationsDeps) {
  // Revoke Confirmation (reason wajib 1..200)
  const [revokeTarget, setRevokeTarget] = useState<Station | null>(null);
  const [isRevoking, setIsRevoking] = useState(false);

  // Delete Confirmation
  const [deleteTarget, setDeleteTarget] = useState<Station | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [conflictState, setConflictState] = useState<ConflictDialogState | null>(null);

  const handleRevoke = useCallback(
    async (reason: string): Promise<void> => {
      if (!revokeTarget) return;
      setIsRevoking(true);
      setFeedback(null);
      try {
        const targetId = revokeTarget.device_id;
        await httpStations.revokeStation(targetId, reason);
        await loadStations();
        setFeedback({ type: 'success', msg: `Stasiun ${targetId} dinonaktifkan (REVOKED). Kiosk dengan station ini tidak bisa login lagi.` });
        setRevokeTarget(null);
      } catch (err: any) {
        if (err instanceof ApiError && err.httpStatus === 403) {
          reportForbidden('device.manage', revokeTarget.device_id, err.message);
        }
        if (err instanceof ApiError && err.httpStatus === 409) {
          await loadStations();
          setConflictState({
            open: true,
            code: err.code,
            title: `Tidak Dapat Menonaktifkan Stasiun ${revokeTarget.device_id}`,
            message: err.message,
          });
        }
        setFeedback({ type: 'error', msg: err?.message || 'Gagal menonaktifkan stasiun.' });
        setRevokeTarget(null);
        throw err;
      } finally {
        setIsRevoking(false);
      }
    },
    [revokeTarget, loadStations, reportForbidden, setFeedback],
  );

  const handleDelete = useCallback(async () => {
    if (!deleteTarget) return;
    setIsDeleting(true);
    setFeedback(null);
    try {
      const targetId = deleteTarget.device_id;
      await httpStations.deleteStation(targetId);
      await loadStations();
      setFeedback({
        type: 'success',
        msg: `Stasiun ${targetId} dihapus. Riwayat pemantauan & event tetap tersimpan untuk arsip.`,
      });
      setDeleteTarget(null);
    } catch (err: any) {
      if (err instanceof ApiError && err.httpStatus === 403) {
        reportForbidden('device.manage', deleteTarget.device_id, err.message);
      }
      if (err instanceof ApiError && err.httpStatus === 409) {
        await loadStations();
        setConflictState({
          open: true,
          code: err.code,
          title: `Tidak Dapat Menghapus Stasiun ${deleteTarget.device_id}`,
          message: err.message,
          activeWoId: err.activeWoId,
        });
      }
      setFeedback({
        type: 'error',
        msg: err?.message || 'Gagal menghapus stasiun.',
        activeWoId: err?.activeWoId,
      });
      setDeleteTarget(null);
    } finally {
      setIsDeleting(false);
    }
  }, [deleteTarget, loadStations, reportForbidden, setFeedback]);

  return {
    revokeTarget,
    setRevokeTarget,
    isRevoking,
    handleRevoke,
    deleteTarget,
    setDeleteTarget,
    isDeleting,
    handleDelete,
    conflictState,
    setConflictState,
  };
}
