/**
 * Method demo — domain devices: revoke / rotate / update / delete.
 *
 * Dipisah dari demo/devices.ts (485 baris) pada E32.5 (FAT-286), mengikuti
 * pola R9.2 (kontrak docs/DIRECTORY_STRUCTURE.md). Satu file = satu
 * sub-domain. Barrel penggabung ada di file induknya (../devices.ts).
 */
import { store } from '../store';
import { assertCapability, throwValidationIssues, enrichAndValidateDevice } from '../helpers';
import { ADMIN_ENDPOINTS } from '../../endpoints';
import { EdgeDevice, RotateDeviceCredentialsResult } from '../../../../types/assets';
import { ApiError } from '../../../../types/auth';
import { validateDeviceInput } from '../../../../utils/capabilities';
import { telemetrySocket } from '../../../ws/telemetrySocket';
import { generateDeviceCredential } from './registration';

export const demoDevicesLifecycle = {
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
