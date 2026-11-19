/**
 * Method demo — domain devices.
 *
 * Dipisah dari file god-file pada refactoring R9 (kontrak docs/DIRECTORY_STRUCTURE.md).
 * Satu file = satu domain. Barrel penggabung ada di file induknya.
 */
import { store } from './store';
import { checkAbort, assertCapability, throwValidationIssues, enrichAndValidateDevice } from './helpers';
import { ADMIN_ENDPOINTS } from '../endpoints';
import { EdgeDevice, DeviceHealth, DeviceCredential, ProvisionDeviceResult, RotateDeviceCredentialsResult } from '../../../types/assets';
import { ApiError } from '../../../types/auth';
import { normalizeMacAddress, validateDeviceInput } from '../../../utils/capabilities';
import { DeviceHealthSchema } from '../schemas';
import { telemetrySocket } from '../../ws/telemetrySocket';

/** Password demo 32 char A-Za-z0-9-_ (meniru §E.3a: dibuat backend, sekali tampil). */
const DEVICE_CREDENTIAL_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_';
function generateDeviceCredential(deviceId: string): DeviceCredential {
  let password = '';
  for (let i = 0; i < 32; i += 1) {
    password += DEVICE_CREDENTIAL_ALPHABET[Math.floor(Math.random() * DEVICE_CREDENTIAL_ALPHABET.length)];
  }
  return { username: deviceId, password, clientId: deviceId, topicPrefix: 'oee/device' };
}

export const demoDevices = {
  // =========================================================================
  // DEVICES (9 ops)
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
          code: 'DEVICE_ALREADY_REGISTERED',
          message: `Device ID "${normalizedDeviceId}" sudah terdaftar.`,
          httpStatus: 409,
        });
      }
      if (store.devices.some((d) => d.mac_address !== '' && normalizeMacAddress(d.mac_address) === canonicalMac)) {
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
        enrollmentState: 'ACTIVE',
        provisionedAt: null,
        credentialRotatedAt: null,
        created_at: new Date().toISOString(),
      };
      store.devices.push(newDevice);
      store.addAudit('REGISTER_DEVICE', 'DEVICE', newDevice.device_id, `Registered edge device ${newDevice.device_id}`, {
        device_id: newDevice.device_id,
      });
      return enrichAndValidateDevice(newDevice);
    });
  },

  /**
   * E20 P20.2 (§E.3a, spec 015): provision kanonis — satu aksi membuat identitas
   * broker (role device-<deviceId> + client) dan baris registry PROVISIONED.
   * Password dibuat demo (32 char A-Za-z0-9-_) dan hanya dikembalikan sekali
   * dalam hasil — pemanggil WAJIB menampilkannya sekali dan tidak menyimpannya.
   */
  async provisionDevice(data: {
    deviceId: string;
    machineId?: string;
    model?: string;
  }): Promise<ProvisionDeviceResult> {
    assertCapability('device.manage', ['ADMIN'], { resourceId: data.deviceId });
    const deviceId = data.deviceId.trim();
    if (!/^STM32-[A-Za-z0-9_-]{1,31}$/.test(deviceId)) {
      throw new ApiError({
        code: 'INVALID_DEVICE_ID',
        message: `Device ID "${data.deviceId}" tidak valid (pola ^STM32-[A-Za-z0-9_-]{1,31}$).`,
        httpStatus: 400,
      });
    }
    store.recordEndpoint('DEVICES_PROVISION', ADMIN_ENDPOINTS.DEVICES_PROVISION.buildPath());

    const credential = generateDeviceCredential(deviceId);
    const now = new Date().toISOString();
    const device = await store.runAssetTransaction(() => {
      if (store.devices.some((d) => d.device_id === deviceId)) {
        throw new ApiError({
          code: 'DEVICE_ALREADY_REGISTERED',
          message: `Device ID "${deviceId}" sudah terdaftar.`,
          httpStatus: 409,
        });
      }
      if (store.deviceHistoryIds.has(deviceId)) {
        throw new ApiError({
          code: 'DEVICE_ID_HAS_HISTORY',
          message: `Device ID "${deviceId}" pernah memiliki histori telemetri dan tidak dapat dipakai ulang untuk perangkat baru.`,
          httpStatus: 409,
        });
      }
      const machineId = data.machineId?.trim() || null;
      let machine: (typeof store.machines)[number] | undefined;
      if (machineId) {
        machine = store.machines.find((m) => m.machine_id === machineId);
        if (!machine) {
          throw new ApiError({
            code: 'MACHINE_NOT_FOUND',
            message: `Mesin "${machineId}" tidak ditemukan.`,
            httpStatus: 404,
          });
        }
        if (machine.bound_device_id) {
          throw new ApiError({
            code: 'MACHINE_ALREADY_BOUND',
            message: `Mesin "${machineId}" sudah terikat ke perangkat "${machine.bound_device_id}".`,
            httpStatus: 409,
          });
        }
      }
      if (store.mqttClients.some((c) => c.username === deviceId)) {
        throw new ApiError({
          code: 'MQTT_CLIENT_EXISTS',
          message: `Identitas broker "${deviceId}" sudah ada.`,
          httpStatus: 409,
        });
      }

      const newDevice: EdgeDevice = {
        device_id: deviceId,
        model: data.model?.trim() || 'STM32H723-W5500',
        serial_number: deviceId,
        mac_address: '',
        ip_address: null,
        firmware_version: null,
        online: false,
        last_seen: null,
        bound_machine_id: machineId,
        bound_machine_name: machine ? machine.name : null,
        enrollmentState: 'PROVISIONED',
        provisionedAt: now,
        credentialRotatedAt: null,
        created_at: now,
      };
      store.devices.push(newDevice);
      store.mqttClients.push({
        username: deviceId,
        clientid: deviceId,
        textname: `Edge ${deviceId}`,
        enabled: true,
        roles: [`device-${deviceId}`],
        groups: [],
        created_at: now,
      });
      if (machine) {
        machine.bound_device_id = deviceId;
        machine.updated_at = now;
      }
      store.addAudit('PROVISION_DEVICE', 'DEVICE', deviceId, `Provisioned edge device ${deviceId} (broker identity + registry)`, {
        device_id: deviceId,
        machine_id: machineId,
        machine_name: machine?.name ?? 'Unbound',
      });
      return enrichAndValidateDevice(newDevice);
    });

    telemetrySocket.emitLifecycleEvent('DEVICE_EVENT', {
      action: 'CREATED',
      device_id: deviceId,
      machine_id: device.bound_machine_id,
    });
    return { device, credential };
  },

  /**
   * E20 P20.2 (§E.3b): cabut kredensial — selalu diizinkan, termasuk saat WO
   * ACTIVE. Baris registry + histori dipertahankan; identitas broker dihapus.
   */
  async revokeDevice(deviceId: string, reason: string): Promise<EdgeDevice> {
    assertCapability('device.manage', ['ADMIN'], { resourceId: deviceId });
    const cleanReason = reason.trim();
    if (cleanReason.length < 1 || cleanReason.length > 200) {
      throwValidationIssues('Alasan pencabutan wajib 1..200 karakter.', {
        reason: 'Alasan wajib diisi (1..200 karakter).',
      });
    }
    store.recordEndpoint('DEVICES_REVOKE', ADMIN_ENDPOINTS.DEVICES_REVOKE.buildPath(deviceId));
    const device = await store.runAssetTransaction(() => {
      const dev = store.devices.find((d) => d.device_id === deviceId);
      if (!dev) {
        throw new ApiError({
          code: 'DEVICE_NOT_FOUND',
          message: `Perangkat "${deviceId}" tidak ditemukan.`,
          httpStatus: 404,
        });
      }
      if (dev.enrollmentState === 'REVOKED') {
        throw new ApiError({
          code: 'DEVICE_ALREADY_REVOKED',
          message: `Perangkat "${deviceId}" sudah dicabut sebelumnya.`,
          httpStatus: 409,
        });
      }
      dev.enrollmentState = 'REVOKED';
      store.mqttClients = store.mqttClients.filter((c) => c.username !== deviceId);
      store.addAudit('REVOKE_DEVICE', 'DEVICE', deviceId, `Revoked device ${deviceId}: ${cleanReason}`, {
        device_id: deviceId,
        machine_id: dev.bound_machine_id,
        machine_name: dev.bound_machine_name ?? 'Unbound',
      });
      return enrichAndValidateDevice(dev);
    });
    telemetrySocket.emitLifecycleEvent('DEVICE_EVENT', {
      action: 'REVOKED',
      device_id: deviceId,
      machine_id: device.bound_machine_id,
    });
    return device;
  },

  /**
   * E20 P20.2 (§E.3c): rotasi kredensial — password baru sekali tampil.
   * Guard produksi: device online + WO ACTIVE pada mesin terikat tanpa
   * force:true → 409 DEVICE_IN_PRODUCTION.
   */
  async rotateDeviceCredentials(
    deviceId: string,
    input: { force: boolean; reason: string },
  ): Promise<RotateDeviceCredentialsResult> {
    assertCapability('device.manage', ['ADMIN'], { resourceId: deviceId });
    const cleanReason = input.reason.trim();
    if (cleanReason.length < 1 || cleanReason.length > 200) {
      throwValidationIssues('Alasan rotasi wajib 1..200 karakter.', {
        reason: 'Alasan wajib diisi (1..200 karakter).',
      });
    }
    store.recordEndpoint('DEVICES_CREDENTIALS', ADMIN_ENDPOINTS.DEVICES_CREDENTIALS.buildPath(deviceId));
    const credential = generateDeviceCredential(deviceId);
    const now = new Date().toISOString();
    await store.runAssetTransaction(() => {
      const dev = store.devices.find((d) => d.device_id === deviceId);
      if (!dev) {
        throw new ApiError({
          code: 'DEVICE_NOT_FOUND',
          message: `Perangkat "${deviceId}" tidak ditemukan.`,
          httpStatus: 404,
        });
      }
      if (dev.enrollmentState === 'REVOKED') {
        throw new ApiError({
          code: 'DEVICE_REVOKED',
          message: `Perangkat "${deviceId}" sudah dicabut; kredensial tidak dapat dirotasi.`,
          httpStatus: 409,
        });
      }
      if (dev.online && dev.bound_machine_id && !input.force) {
        const activeWo = store.workOrders.find(
          (w) => w.machine_id === dev.bound_machine_id && w.status === 'ACTIVE',
        );
        if (activeWo) {
          throw new ApiError({
            code: 'DEVICE_IN_PRODUCTION',
            message: `Perangkat "${deviceId}" sedang produksi (WO ${activeWo.wo_id} ACTIVE); rotasi butuh force:true.`,
            httpStatus: 409,
            activeWoId: activeWo.wo_id,
          });
        }
      }
      dev.credentialRotatedAt = now;
      store.addAudit('ROTATE_DEVICE_CREDENTIALS', 'DEVICE', deviceId, `Rotated credentials for ${deviceId}${input.force ? ' (forced)' : ''}`, {
        device_id: deviceId,
        machine_id: dev.bound_machine_id,
        machine_name: dev.bound_machine_name ?? 'Unbound',
      });
    });
    return { credential, forced: input.force };
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
            code: 'CONFLICT',
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
      // E20 P20.2 (§E.3a): id yang dihapus masuk histori — provision ulang id ini ditolak.
      store.deviceHistoryIds.add(deviceId);
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
