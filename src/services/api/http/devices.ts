/**
 * Method HTTP — domain devices.
 *
 * Dipisah dari file god-file pada refactoring R9 (kontrak docs/DIRECTORY_STRUCTURE.md).
 * Satu file = satu domain. Barrel penggabung ada di file induknya.
 */
import { MUTATION_TIMEOUT_MS, assertLanForMutation, assertAuthenticatedHttp, reqJson, reqAllPages, checkAbortHttp } from './transport';
import { mapDevice, mapDeviceHealth } from './mappers';
import { ADMIN_ENDPOINTS } from '../endpoints';
import { EdgeDevice, DeviceHealth } from '../../../types/assets';

export const httpDevices = {
  // -- Devices (6 ops; command HMI-only — tidak ada di sini) ---------------
  async getDevices(signal?: AbortSignal): Promise<EdgeDevice[]> {
    checkAbortHttp(signal);
    return reqAllPages(ADMIN_ENDPOINTS.DEVICES_LIST.buildPath(), mapDevice, signal, 'DEVICES_LIST');
  },

  async getDeviceById(deviceId: string, signal?: AbortSignal): Promise<EdgeDevice> {
    checkAbortHttp(signal);
    return reqJson(
      { path: ADMIN_ENDPOINTS.DEVICES_GET.buildPath(deviceId), signal, endpointKey: 'DEVICES_GET', capability: 'device.read', resourceId: deviceId },
      mapDevice,
    );
  },

  async getDeviceHealth(deviceId: string, signal?: AbortSignal): Promise<DeviceHealth> {
    checkAbortHttp(signal);
    return reqJson(
      { path: ADMIN_ENDPOINTS.DEVICES_HEALTH.buildPath(deviceId), signal, endpointKey: 'DEVICES_HEALTH', capability: 'device.read', resourceId: deviceId },
      mapDeviceHealth,
    );
  },

  async registerDevice(data: {
    device_id: string;
    model?: string;
    serial_number?: string;
    mac_address: string;
    ip_address?: string | null;
    firmware_version?: string | null;
  }): Promise<EdgeDevice> {
    assertAuthenticatedHttp();
    assertLanForMutation();
    return reqJson(
      {
        method: 'POST',
        path: ADMIN_ENDPOINTS.DEVICES_CREATE.buildPath(),
        body: {
          deviceId: data.device_id.trim(),
          macAddress: data.mac_address.trim(),
          ...(data.ip_address ? { ipAddress: data.ip_address.trim() } : {}),
          ...(data.firmware_version ? { firmwareVersion: data.firmware_version.trim() } : {}),
        },
        timeoutMs: MUTATION_TIMEOUT_MS,
        retry: false,
        endpointKey: 'DEVICES_CREATE',
        capability: 'device.manage',
        resourceId: data.device_id,
      },
      mapDevice,
    );
  },

  async updateDevice(
    deviceId: string,
    patch: { ip_address?: string | null; firmware_version?: string | null },
  ): Promise<EdgeDevice> {
    assertAuthenticatedHttp();
    assertLanForMutation();
    return reqJson(
      {
        method: 'PUT',
        path: ADMIN_ENDPOINTS.DEVICES_UPDATE.buildPath(deviceId),
        body: {
          ...(patch.ip_address !== undefined ? { ipAddress: patch.ip_address } : {}),
          ...(patch.firmware_version !== undefined ? { firmwareVersion: patch.firmware_version } : {}),
        },
        timeoutMs: MUTATION_TIMEOUT_MS,
        retry: false,
        endpointKey: 'DEVICES_UPDATE',
        capability: 'device.manage',
        resourceId: deviceId,
      },
      mapDevice,
    );
  },

  async deleteDevice(deviceId: string): Promise<{ success: boolean }> {
    assertAuthenticatedHttp();
    assertLanForMutation();
    const raw = await reqJson<{ success?: boolean; message?: string } | undefined>({
      method: 'DELETE',
      path: ADMIN_ENDPOINTS.DEVICES_DELETE.buildPath(deviceId),
      timeoutMs: MUTATION_TIMEOUT_MS,
      retry: false,
      endpointKey: 'DEVICES_DELETE',
      capability: 'device.manage',
      resourceId: deviceId,
    });
    return { success: raw?.success ?? true };
  }
};
