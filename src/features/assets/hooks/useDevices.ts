import { useCallback, useEffect, useState } from 'react';
import { apiClient } from '../../../services/api/client';
import { telemetrySocket } from '../../../services/ws/telemetrySocket';
import { EdgeDevice, ProvisionDeviceResult } from '../../../types/assets';
import { ApiError } from '../../../types/auth';
import { useAuth } from '../../../context/AuthContext';
import { ConflictDialogState } from '../../../components/ui/ConflictDialog';

export interface FeedbackState {
  type: 'success' | 'error';
  msg: string;
  activeWoId?: string;
}

export interface RegisterDeviceInput {
  deviceId: string;
  mac: string;
  ip: string;
  firmware: string;
}

export interface ProvisionDeviceInput {
  deviceId: string;
  machineId?: string;
  model?: string;
}

export interface UpdateDeviceInput {
  ip: string;
  firmware: string;
}

export interface UseDevicesOptions {
  onDeviceDeleted: (deviceId: string) => void;
}

export function useDevices({ onDeviceDeleted }: UseDevicesOptions) {
  const { reportForbidden } = useAuth();

  const [devices, setDevices] = useState<EdgeDevice[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [feedback, setFeedback] = useState<FeedbackState | null>(null);

  // Delete Confirmation
  const [deleteTarget, setDeleteTarget] = useState<EdgeDevice | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [conflictState, setConflictState] = useState<ConflictDialogState | null>(null);

  const loadDevices = useCallback(async () => {
    setIsLoading(true);
    try {
      const list = await apiClient.getDevices();
      setDevices(list);
    } catch (err: any) {
      setFeedback({ type: 'error', msg: err?.message || 'Gagal memuat daftar perangkat edge.' });
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadDevices();
    const unsub = telemetrySocket.subscribe((event) => {
      if (
        event.type === 'MACHINE_BOUND' ||
        event.type === 'MACHINE_UNBOUND' ||
        event.type === 'MACHINE_UPDATED' ||
        event.type === 'MACHINE_DELETED' ||
        event.type === 'DEVICE_EVENT' ||
        event.type === 'DEVICE_STATUS_UPDATE'
      ) {
        loadDevices();
      }
    });
    return () => unsub();
  }, [loadDevices]);

  const registerDevice = useCallback(
    async (input: RegisterDeviceInput): Promise<void> => {
      setFeedback(null);
      try {
        // E23 Batch 4 (FAT-206, N-37): spec live POST /devices tidak
        // mengenal model/serial_number dan mac_address opsional —
        // kirim hanya field yang server terima; mac kosong → undefined
        // (transport meng-omit-nya).
        const created = await apiClient.registerDevice({
          device_id: input.deviceId.trim(),
          mac_address: input.mac.trim() || undefined,
          ip_address: input.ip.trim() || null,
          firmware_version: input.firmware.trim() || null,
        });
        await loadDevices();
        setFeedback({ type: 'success', msg: `Perangkat edge ${created.device_id} berhasil diregistrasi.` });
      } catch (err: any) {
        if (err instanceof ApiError && err.httpStatus === 403) {
          reportForbidden('device.manage', input.deviceId, err.message);
        }
        if (err instanceof ApiError && err.httpStatus === 409) {
          await loadDevices();
        }
        setFeedback({ type: 'error', msg: err?.message || 'Gagal mendaftarkan perangkat.' });
        throw err;
      }
    },
    [loadDevices, reportForbidden],
  );

  const provisionDevice = useCallback(
    async (input: ProvisionDeviceInput): Promise<ProvisionDeviceResult> => {
      setFeedback(null);
      try {
        const result = await apiClient.provisionDevice({
          deviceId: input.deviceId.trim(),
          ...(input.machineId ? { machineId: input.machineId.trim() } : {}),
          ...(input.model ? { model: input.model.trim() } : {}),
        });
        await loadDevices();
        setFeedback({ type: 'success', msg: `Perangkat edge ${result.device.device_id} berhasil di-provision (PROVISIONED). Salin kredensial sekali tampil sebelum menutup dialog.` });
        return result;
      } catch (err: any) {
        if (err instanceof ApiError && err.httpStatus === 403) {
          reportForbidden('device.manage', input.deviceId, err.message);
        }
        if (err instanceof ApiError && err.httpStatus === 409) {
          await loadDevices();
        }
        setFeedback({ type: 'error', msg: err?.message || 'Gagal mem-provision perangkat.' });
        throw err;
      }
    },
    [loadDevices, reportForbidden],
  );

  const updateDevice = useCallback(
    async (deviceId: string, input: UpdateDeviceInput): Promise<void> => {
      setFeedback(null);
      try {
        // E23 Batch 2 (FAT-184, N-15): form yang dikosongkan dikirim
        // sebagai undefined (bukan null) — transport meng-omit field
        // tersebut; spec live PUT /devices tidak mengizinkan null.
        const updated = await apiClient.updateDevice(deviceId, {
          ip_address: input.ip.trim() || undefined,
          firmware_version: input.firmware.trim() || undefined,
        });
        await loadDevices();
        setFeedback({ type: 'success', msg: `Konfigurasi perangkat ${updated.device_id} diperbarui.` });
      } catch (err: any) {
        if (err instanceof ApiError && err.httpStatus === 403) {
          reportForbidden('device.manage', deviceId, err.message);
        }
        setFeedback({ type: 'error', msg: err?.message || 'Gagal memperbarui perangkat.' });
        throw err;
      }
    },
    [loadDevices, reportForbidden],
  );

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
  }, [deleteTarget, loadDevices, onDeviceDeleted, reportForbidden]);

  return {
    devices,
    isLoading,
    feedback,
    setFeedback,
    loadDevices,
    registerDevice,
    provisionDevice,
    updateDevice,
    deleteTarget,
    setDeleteTarget,
    isDeleting,
    handleDelete,
    conflictState,
    setConflictState,
  };
}
