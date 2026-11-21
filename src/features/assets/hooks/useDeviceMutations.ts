import { useCallback } from 'react';
import { apiClient } from '../../../services/api/client';
import { ProvisionDeviceResult } from '../../../types/assets';
import { ApiError } from '../../../types/auth';
import { CapabilityKey } from '../../../utils/capabilities';
import { FeedbackState } from './useDevices';

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

export interface UseDeviceMutationsDeps {
  loadDevices: () => Promise<void>;
  reportForbidden: (capability: CapabilityKey, resourceId?: string, reason?: string) => void;
  setFeedback: React.Dispatch<React.SetStateAction<FeedbackState | null>>;
}

/**
 * Mutasi tulis perangkat edge (E32.7, FAT-288: dipindah dari
 * hooks/useDevices.ts — satu alur: register / provision / update).
 * Mengikuti preseden useDevices: set feedback error LALU lempar ulang
 * agar modal menampilkan submit error; 403 → reportForbidden,
 * 409 → reload daftar.
 */
export function useDeviceMutations({ loadDevices, reportForbidden, setFeedback }: UseDeviceMutationsDeps) {
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
    [loadDevices, reportForbidden, setFeedback],
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
    [loadDevices, reportForbidden, setFeedback],
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
    [loadDevices, reportForbidden, setFeedback],
  );

  return { registerDevice, provisionDevice, updateDevice };
}
