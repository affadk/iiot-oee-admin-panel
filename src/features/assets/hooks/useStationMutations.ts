import { useCallback } from 'react';
import { httpStations } from '../../../services/api/http/stations';
import { ApiError } from '../../../types/auth';
import { CapabilityKey } from '../../../utils/capabilities';
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

export interface UseStationMutationsDeps {
  loadStations: () => Promise<void>;
  reportForbidden: (capability: CapabilityKey, resourceId?: string, reason?: string) => void;
  setFeedback: React.Dispatch<React.SetStateAction<FeedbackState | null>>;
}

/**
 * Mutasi tulis stasiun (E32.7, FAT-288: dipindah dari
 * hooks/useStations.ts — satu alur: register / update).
 * Mengikuti preseden useDevices: set feedback error LALU lempar ulang
 * agar modal menampilkan submit error; 403 → reportForbidden,
 * 409 → reload daftar.
 */
export function useStationMutations({ loadStations, reportForbidden, setFeedback }: UseStationMutationsDeps) {
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
    [loadStations, reportForbidden, setFeedback],
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
    [loadStations, reportForbidden, setFeedback],
  );

  return { registerStation, updateStation };
}
