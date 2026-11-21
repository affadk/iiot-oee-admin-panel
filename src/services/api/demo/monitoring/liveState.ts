/**
 * Method demo — domain monitoring: live state + downtime aktif.
 *
 * Dipisah dari demo/monitoring.ts (445 baris) pada E32.5 (FAT-286),
 * mengikuti pola R9.2 (kontrak docs/DIRECTORY_STRUCTURE.md). Satu file =
 * satu sub-domain. Barrel penggabung ada di file induknya
 * (../monitoring.ts).
 */
import { store } from '../store';
import { checkAbort } from '../helpers';
import { ADMIN_ENDPOINTS } from '../../endpoints';
import { LiveStateRecord, DowntimeEvent } from '../../../../types/monitoring';
import { ApiError } from '../../../../types/auth';
import { normalizeFsmState } from '../../../../utils/oeeCalculations';

export const demoMonitoringLiveState = {
  async getLiveState(signal?: AbortSignal): Promise<LiveStateRecord[]> {
    checkAbort(signal);
    store.recordEndpoint('LIVE_STATE', ADMIN_ENDPOINTS.LIVE_STATE.buildPath());
    return store.liveStates.map((s) => ({
      ...s,
      fsm_state: normalizeFsmState(s.fsm_state),
    }));
  },

  async getLiveStateByDevice(deviceId: string, signal?: AbortSignal): Promise<LiveStateRecord> {
    checkAbort(signal);
    store.recordEndpoint('LIVE_STATE_BY_DEVICE', ADMIN_ENDPOINTS.LIVE_STATE_BY_DEVICE.buildPath(deviceId));
    const rec = store.liveStates.find((s) => s.device_id === deviceId);
    if (!rec) {
      throw new ApiError({
        code: 'NOT_FOUND',
        message: `Live state untuk perangkat "${deviceId}" tidak ditemukan.`,
        httpStatus: 404,
      });
    }
    return { ...rec, fsm_state: normalizeFsmState(rec.fsm_state) };
  },

  async getActiveDowntimes(signal?: AbortSignal): Promise<DowntimeEvent[]> {
    checkAbort(signal);
    store.recordEndpoint('DOWNTIME_ACTIVE', ADMIN_ENDPOINTS.DOWNTIME_ACTIVE.buildPath());
    return store.downtimes.filter((d) => d.ended_at === null).map((d) => ({ ...d }));
  }
};
