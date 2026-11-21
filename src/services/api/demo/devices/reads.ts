/**
 * Method demo — domain devices: baca + health.
 *
 * Dipisah dari demo/devices.ts (485 baris) pada E32.5 (FAT-286), mengikuti
 * pola R9.2 (kontrak docs/DIRECTORY_STRUCTURE.md). Satu file = satu
 * sub-domain. Barrel penggabung ada di file induknya (../devices.ts).
 */
import { store } from '../store';
import { checkAbort, enrichAndValidateDevice } from '../helpers';
import { ADMIN_ENDPOINTS } from '../../endpoints';
import { EdgeDevice, DeviceHealth } from '../../../../types/assets';
import { ApiError } from '../../../../types/auth';
import { DeviceHealthSchema } from '../../schemas';

export const demoDevicesReads = {
  async getDevices(signal?: AbortSignal): Promise<EdgeDevice[]> {
    checkAbort(signal);
    store.recordEndpoint('DEVICES_LIST', ADMIN_ENDPOINTS.DEVICES_LIST.buildPath());
    return store.devices.map((d) => enrichAndValidateDevice(d));
  },

  async getDeviceById(deviceId: string, signal?: AbortSignal): Promise<EdgeDevice> {
    checkAbort(signal);
    store.recordEndpoint('DEVICES_GET', ADMIN_ENDPOINTS.DEVICES_GET.buildPath(deviceId));
    const dev = store.devices.find((d) => d.device_id === deviceId);
    if (!dev) {
      throw new ApiError({
        code: 'DEVICE_NOT_FOUND',
        message: `Perangkat "${deviceId}" tidak ditemukan.`,
        httpStatus: 404,
      });
    }
    return enrichAndValidateDevice(dev);
  },

  async getDeviceHealth(deviceId: string, signal?: AbortSignal): Promise<DeviceHealth> {
    checkAbort(signal);
    store.recordEndpoint('DEVICES_HEALTH', ADMIN_ENDPOINTS.DEVICES_HEALTH.buildPath(deviceId));
    const dev = store.devices.find((d) => d.device_id === deviceId);
    if (!dev) {
      // §E: 404 DEVICE_NOT_FOUND bila perangkat tidak terdaftar.
      throw new ApiError({
        code: 'DEVICE_NOT_FOUND',
        message: `Perangkat "${deviceId}" tidak ditemukan.`,
        httpStatus: 404,
      });
    }
    if (!dev.online) {
      // Cache miss / offline: ageSec 999999 + field nol — jangan fabrikasi data (§E).
      return DeviceHealthSchema.parse({
        device_id: deviceId,
        timestamp: null,
        heapFree: 0,
        tasksHealthy: 0,
        tasksTotal: 0,
        ageSec: 999999,
        eventFlags: [],
        staleCount: 0,
        staleTasks: [],
      });
    }
    const preset = store.deviceHealthOverrides[deviceId];
    if (preset) {
      return DeviceHealthSchema.parse({
        ...preset,
        timestamp: new Date(Date.now() - preset.ageSec * 1000).toISOString(),
      });
    }
    return DeviceHealthSchema.parse({
      device_id: deviceId,
      timestamp: new Date().toISOString(),
      heapFree: 45120,
      tasksHealthy: 9,
      tasksTotal: 9,
      ageSec: 3,
      eventFlags: ['NTP_SYNCED', 'MQTT_TLS_ACTIVE', 'MODBUS_HEALTHY'],
      staleCount: 0,
      staleTasks: [],
    });
  }
};
