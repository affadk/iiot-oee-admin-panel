import { useCallback, useEffect, useState } from 'react';
import { httpStations } from '../../../services/api/http/stations';
import { Station } from '../../../types/assets';
import { ApiError } from '../../../types/auth';
import { useAuth } from '../../../context/AuthContext';
import { ConflictDialogState } from '../../../components/ui/ConflictDialog';
import { FeedbackState } from './useDevices';

export interface RegisterStationInput {
  deviceId: string;
  mac: string;
  ip: string;
  firmware: string;
}

export interface UpdateStationInput {
  ip: string;
  firmware: string;
}

export function useStations() {
  const { reportForbidden } = useAuth();

  const [stations, setStations] = useState<Station[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [feedback, setFeedback] = useState<FeedbackState | null>(null);

  // Revoke Confirmation (reason wajib 1..200)
  const [revokeTarget, setRevokeTarget] = useState<Station | null>(null);
  const [isRevoking, setIsRevoking] = useState(false);

  // Delete Confirmation
  const [deleteTarget, setDeleteTarget] = useState<Station | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [conflictState, setConflictState] = useState<ConflictDialogState | null>(null);

  const loadStations = useCallback(async () => {
    setIsLoading(true);
    try {
      const list = await httpStations.getStations();
      setStations(list);
    } catch (err: any) {
      setFeedback({ type: 'error', msg: err?.message || 'Gagal memuat daftar stasiun.' });
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadStations();
  }, [loadStations]);

  const registerStation = useCallback(
    async (input: RegisterStationInput): Promise<void> => {
      setFeedback(null);
      try {
        const created = await httpStations.registerStation({
          device_id: input.deviceId.trim(),
          mac_address: input.mac.trim() || undefined,
          ip_address: input.ip.trim() || null,
          firmware_version: input.firmware.trim() || null,
        });
        await loadStations();
        setFeedback({ type: 'success', msg: `Stasiun ${created.device_id} berhasil didaftarkan.` });
      } catch (err: any) {
        if (err instanceof ApiError && err.httpStatus === 403) {
          reportForbidden('device.manage', input.deviceId, err.message);
        }
        if (err instanceof ApiError && err.httpStatus === 409) {
          await loadStations();
        }
        setFeedback({ type: 'error', msg: err?.message || 'Gagal mendaftarkan stasiun.' });
        throw err;
      }
    },
    [loadStations, reportForbidden],
  );

  const updateStation = useCallback(
    async (deviceId: string, input: UpdateStationInput): Promise<void> => {
      setFeedback(null);
      try {
        // E23 Batch 2 (FAT-184, N-15): field yang dikosongkan dikirim
        // sebagai undefined (bukan null) — transport meng-omit-nya; spec
        // live PUT /devices tidak mengizinkan null.
        const updated = await httpStations.updateStation(deviceId, {
          ip_address: input.ip.trim() || undefined,
          firmware_version: input.firmware.trim() || undefined,
        });
        await loadStations();
        setFeedback({ type: 'success', msg: `Konfigurasi stasiun ${updated.device_id} diperbarui.` });
      } catch (err: any) {
        if (err instanceof ApiError && err.httpStatus === 403) {
          reportForbidden('device.manage', deviceId, err.message);
        }
        setFeedback({ type: 'error', msg: err?.message || 'Gagal memperbarui stasiun.' });
        throw err;
      }
    },
    [loadStations, reportForbidden],
  );

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
    [revokeTarget, loadStations, reportForbidden],
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
  }, [deleteTarget, loadStations, reportForbidden]);

  return {
    stations,
    isLoading,
    feedback,
    setFeedback,
    loadStations,
    registerStation,
    updateStation,
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
