import { useCallback, useEffect, useState } from 'react';
import { apiClient } from '../../../services/api/client';
import { telemetrySocket } from '../../../services/ws/telemetrySocket';
import { EdgeDevice } from '../../../types/assets';
import { useAuth } from '../../../context/AuthContext';
import { useDeviceMutations } from './useDeviceMutations';
import { useDeviceDelete } from './useDeviceDelete';

export interface FeedbackState {
  type: 'success' | 'error';
  msg: string;
  activeWoId?: string;
}

// Tipe input mutasi tinggal di useDeviceMutations.ts (E32.7, FAT-288);
// di-re-export dari sini supaya impor modal lama tetap jalan.
export type {
  RegisterDeviceInput,
  ProvisionDeviceInput,
  UpdateDeviceInput,
} from './useDeviceMutations';

export interface UseDevicesOptions {
  onDeviceDeleted: (deviceId: string) => void;
}

// E32.7 (FAT-288): mutasi tulis dipindah ke useDeviceMutations.ts,
// alur hapus + konflik ke useDeviceDelete.ts — hook ini tinggal
// orkestrasi: muat daftar + langganan WS + komposisi. Bentuk return
// tidak berubah (dipakai DevicesPage).
export function useDevices({ onDeviceDeleted }: UseDevicesOptions) {
  const { reportForbidden } = useAuth();

  const [devices, setDevices] = useState<EdgeDevice[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [feedback, setFeedback] = useState<FeedbackState | null>(null);

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

  const { registerDevice, provisionDevice, updateDevice } = useDeviceMutations({
    loadDevices,
    reportForbidden,
    setFeedback,
  });

  const {
    deleteTarget,
    setDeleteTarget,
    isDeleting,
    handleDelete,
    conflictState,
    setConflictState,
  } = useDeviceDelete({ loadDevices, reportForbidden, setFeedback, onDeviceDeleted });

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
