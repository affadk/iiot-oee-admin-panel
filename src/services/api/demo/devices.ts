/**
 * Method demo — domain devices.
 *
 * Dipisah dari file god-file pada refactoring R9 (kontrak docs/DIRECTORY_STRUCTURE.md).
 * Satu file = satu domain. Barrel penggabung ada di file induknya.
 */
import { store } from './store';
import { checkAbort, assertCapability, throwValidationIssues, enrichAndValidateDevice } from './helpers';
import { ADMIN_ENDPOINTS } from '../endpoints';
import { EdgeDevice, DeviceHealth } from '../../../types/assets';
import { ApiError } from '../../../types/auth';
import { normalizeMacAddress, validateDeviceInput } from '../../../utils/capabilities';
import { DeviceHealthSchema } from '../schemas';
import { telemetrySocket } from '../../ws/telemetrySocket';

export const demoDevices = {
  // =========================================================================
  // DEVICES (6 ops)
  // =========================================================================
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
    if (!dev || !dev.online) {
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
  },

  async registerDevice(data: {
    device_id: string;
    model?: string;
    serial_number?: string;
    mac_address: string;
    ip_address?: string | null;
    firmware_version?: string | null;
  }): Promise<EdgeDevice> {
    assertCapability('device.manage', ['ADMIN'], { resourceId: data.device_id });
    const errors = validateDeviceInput({
      deviceId: data.device_id,
      macAddress: data.mac_address,
      ipAddress: data.ip_address ?? undefined,
      firmwareVersion: data.firmware_version ?? undefined,
      isCreate: true,
    });
    if (Object.keys(errors).length > 0) {
      throwValidationIssues('Validasi registrasi perangkat gagal.', errors);
    }
    store.recordEndpoint('DEVICES_CREATE', ADMIN_ENDPOINTS.DEVICES_CREATE.buildPath());

    return store.runAssetTransaction(() => {
      const normalizedDeviceId = data.device_id.trim();
      const canonicalMac = normalizeMacAddress(data.mac_address);

      if (store.devices.some((d) => d.device_id === normalizedDeviceId)) {
        throw new ApiError({
          code: 'CONFLICT',
          message: `Device ID "${normalizedDeviceId}" sudah terdaftar.`,
          httpStatus: 409,
        });
      }
      if (store.devices.some((d) => normalizeMacAddress(d.mac_address) === canonicalMac)) {
        throw new ApiError({
          code: 'CONFLICT',
          message: `MAC Address "${data.mac_address}" (${canonicalMac}) sudah digunakan perangkat lain.`,
          httpStatus: 409,
        });
      }

      const newDevice: EdgeDevice = {
        device_id: normalizedDeviceId,
        model: data.model?.trim() || 'STM32H743-Edge-Pro',
        serial_number: data.serial_number?.trim() || normalizedDeviceId,
        mac_address: canonicalMac,
        ip_address: data.ip_address?.trim() || null,
        firmware_version: data.firmware_version?.trim() || null,
        online: false,
        last_seen: null,
        bound_machine_id: null,
        bound_machine_name: null,
        created_at: new Date().toISOString(),
      };
      store.devices.push(newDevice);
      store.addAudit('REGISTER_DEVICE', 'DEVICE', newDevice.device_id, `Registered edge device ${newDevice.device_id}`, {
        device_id: newDevice.device_id,
      });
      return enrichAndValidateDevice(newDevice);
    });
  },

  async updateDevice(
    deviceId: string,
    patch: { ip_address?: string | null; firmware_version?: string | null }
  ): Promise<EdgeDevice> {
    assertCapability('device.manage', ['ADMIN'], { resourceId: deviceId });

    const rawPatch = patch as Record<string, unknown>;
    const immutableErrors: Record<string, string> = {};
    if (rawPatch.device_id !== undefined) {
      immutableErrors.deviceId = 'device_id bersifat immutable dan tidak dapat diubah setelah registrasi.';
    }
    if (rawPatch.mac_address !== undefined) {
      immutableErrors.macAddress = 'mac_address bersifat immutable dan tidak dapat diubah setelah registrasi.';
    }
    if (Object.keys(immutableErrors).length > 0) {
      throwValidationIssues('Field immutable perangkat tidak boleh diubah.', immutableErrors);
    }

    const errors = validateDeviceInput({
      ipAddress: patch.ip_address ?? undefined,
      firmwareVersion: patch.firmware_version ?? undefined,
      isCreate: false,
    });
    if (Object.keys(errors).length > 0) {
      throwValidationIssues('Validasi pembaruan perangkat gagal.', errors);
    }

    store.recordEndpoint('DEVICES_UPDATE', ADMIN_ENDPOINTS.DEVICES_UPDATE.buildPath(deviceId));
    return store.runAssetTransaction(() => {
      const dev = store.devices.find((d) => d.device_id === deviceId);
      if (!dev) {
        throw new ApiError({
          code: 'DEVICE_NOT_FOUND',
          message: `Perangkat "${deviceId}" tidak ditemukan.`,
          httpStatus: 404,
        });
      }
      if (patch.ip_address !== undefined) dev.ip_address = patch.ip_address?.trim() || null;
      if (patch.firmware_version !== undefined) dev.firmware_version = patch.firmware_version?.trim() || null;

      store.addAudit('UPDATE_DEVICE', 'DEVICE', deviceId, `Updated network/firmware for ${deviceId}`, {
        device_id: deviceId,
        machine_id: dev.bound_machine_id,
        machine_name: dev.bound_machine_name ?? 'Unbound',
      });
      return enrichAndValidateDevice(dev);
    });
  },

  async deleteDevice(deviceId: string): Promise<{ success: boolean }> {
    assertCapability('device.manage', ['ADMIN'], { resourceId: deviceId });
    store.recordEndpoint('DEVICES_DELETE', ADMIN_ENDPOINTS.DEVICES_DELETE.buildPath(deviceId));

    const result = await store.runAssetTransaction(() => {
      const dev = store.devices.find((d) => d.device_id === deviceId);
      if (!dev) {
        throw new ApiError({
          code: 'DEVICE_NOT_FOUND',
          message: `Perangkat "${deviceId}" tidak ditemukan.`,
          httpStatus: 404,
        });
      }
      if (dev.bound_machine_id) {
        const activeWo = store.workOrders.find(
          (w) => w.machine_id === dev.bound_machine_id && (w.status === 'ACTIVE' || w.status === 'PENDING')
        );
        if (activeWo) {
          throw new ApiError({
            code: 'MACHINE_HAS_ACTIVE_WO',
            message: `Tidak dapat menghapus perangkat: mesin terikat memiliki Work Order ${activeWo.status} (${activeWo.wo_id}).`,
            httpStatus: 409,
            activeWoId: activeWo.wo_id,
          });
        }
        const machine = store.machines.find((m) => m.machine_id === dev.bound_machine_id);
        if (machine) {
          machine.bound_device_id = null;
          machine.updated_at = new Date().toISOString();
        }
      }

      // History preservation (ON DELETE SET NULL for historical telemetry/downtime/events)
      store.downtimes.forEach((dt) => {
        if (dt.device_id === deviceId) dt.device_id = null;
      });
      store.operationalEvents.forEach((ev) => {
        if (ev.device_id === deviceId) ev.device_id = null;
      });
      // device_live_state is per-device live snapshot (ON DELETE CASCADE)
      store.liveStates = store.liveStates.filter((ls) => ls.device_id !== deviceId);
      store.devices = store.devices.filter((d) => d.device_id !== deviceId);
      store.addAudit('DELETE_DEVICE', 'DEVICE', deviceId, `Deleted edge device ${deviceId} (telemetry history preserved)`);
      return {
        wasBoundMachineId: dev.bound_machine_id,
      };
    });

    telemetrySocket.emitLifecycleEvent('DEVICE_EVENT', {
      action: 'DELETED',
      device_id: deviceId,
      machine_id: result.wasBoundMachineId,
    });
    return { success: true };
  }
};
