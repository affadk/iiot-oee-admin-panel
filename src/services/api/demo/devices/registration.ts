/**
 * Method demo — domain devices: register + provision.
 *
 * Dipisah dari demo/devices.ts (485 baris) pada E32.5 (FAT-286), mengikuti
 * pola R9.2 (kontrak docs/DIRECTORY_STRUCTURE.md). Satu file = satu
 * sub-domain. Barrel penggabung ada di file induknya (../devices.ts).
 */

import { store } from '../store';
import { assertCapability, throwValidationIssues, enrichAndValidateDevice } from '../helpers';
import { ADMIN_ENDPOINTS } from '../../endpoints';
import { EdgeDevice, DeviceCredential, ProvisionDeviceResult } from '../../../../types/assets';
import { ApiError } from '../../../../types/auth';
import { normalizeMacAddress, validateDeviceInput } from '../../../../utils/capabilities';
import { telemetrySocket } from '../../../ws/telemetrySocket';

/** Password demo 32 char A-Za-z0-9-_ (meniru §E.3a: dibuat backend, sekali tampil). */
const DEVICE_CREDENTIAL_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_';
export function generateDeviceCredential(deviceId: string): DeviceCredential {
  let password = '';
  for (let i = 0; i < 32; i += 1) {
    password += DEVICE_CREDENTIAL_ALPHABET[Math.floor(Math.random() * DEVICE_CREDENTIAL_ALPHABET.length)];
  }
  return { username: deviceId, password, clientId: deviceId, topicPrefix: 'oee/device' };
}

export const demoDevicesRegistration = {
  // E23 Batch 4 (FAT-206, N-37): demo meniru spec live POST /devices —
  // tanpa `model`/`serial_number` di input, `mac_address` opsional
  // (kosong → '' di store lokal; EdgeDeviceSchema mengizinkan '').
  async registerDevice(data: {
    device_id: string;
    mac_address?: string;
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
      const canonicalMac = normalizeMacAddress(data.mac_address ?? '');

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
        // E23 Batch 4 (FAT-206, N-37): legacy POST /devices tidak
        // menerima model/serial_number — demo tidak lagi mengisinya
        // dari input (server mengabaikannya); mac kosong → ''.
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
  }
};
