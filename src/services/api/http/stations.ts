/**
 * Method HTTP — domain stations (stasiun / terminal HMI).
 *
 * E27 Spec 043 (FAT-232, T1 + FAT-234, T3): stasiun = baris tabel `devices`
 * yang sama dengan edge device — TIDAK ADA endpoint station di backend.
 * E30 (FAT-254/255, P30.1/P30.2): stasiun = identitas terminal HMI yang
 * terikat ke satu mesin; kelas ID terminal (STATION-/KIOSK-/ADMIN-) dan
 * penerbitan kredensial perangkat menunggu backend (FAT-237 / B30.1).
 * Service ini memakai endpoint devices yang sama dengan httpDevices, tapi
 * memetakan respons lewat mapStation() (bukan mapDevice): EdgeDeviceSchema
 * menolak device_id non-STM32 (mis. ADMIN-CONSOLE-01) sehingga seluruh
 * daftar akan gagal parse bila satu stasiun ikut terdaftar.
 *
 * Operasi:
 * - daftar: GET /api/v1/devices
 * - daftar: POST /api/v1/devices (legacy register) — BUKAN /provision
 *   (provision membuat identitas broker MQTT + kredensial sekali tampil,
 *   tidak masuk akal untuk kiosk login)
 * - ubah: PUT /devices/{deviceId} {ipAddress?, firmwareVersion?} (omit bila kosong)
 * - nonaktifkan: POST /devices/{deviceId}/revoke {reason} — satu arah, tanpa un-revoke
 * - hapus: DELETE /devices/{deviceId} — guard di UI; server yang menolak
 *   bila device berhitori (pesan server ditampilkan apa adanya)
 *
 * Mode Demo: demoDevices menolak ID non-STM32 (validateDeviceInput +
 * EdgeDeviceSchema), jadi mode demo memakai store in-memory lokal di file
 * ini (di-seed dari demo devices) — tanpa mengubah file demo apa pun.
 * Mutasi demo memakai assertCapability yang sama dengan demoDevices.
 */
import { MUTATION_TIMEOUT_MS, assertLanForMutation, assertAuthenticatedHttp, reqJson, reqAllPages, checkAbortHttp } from './transport';
import { mapStation } from './mappers';
import { ADMIN_ENDPOINTS } from '../endpoints';
import { Station, EdgeDevice } from '../../../types/assets';
import { ApiError } from '../../../types/auth';
import { resolveApiMode } from '../mode';
import { demoDevices } from '../demo/devices';
import { assertCapability } from '../demo/helpers';

/** EdgeDevice demo → Station (tanpa ikatan mesin / kredensial broker). */
export function edgeDeviceToStation(dev: EdgeDevice): Station {
  return {
    device_id: dev.device_id,
    model: dev.model,
    mac_address: dev.mac_address,
    ip_address: dev.ip_address,
    firmware_version: dev.firmware_version,
    online: dev.online,
    last_seen: dev.last_seen,
    enrollmentState: dev.enrollmentState,
    provisionedAt: dev.provisionedAt,
    credentialRotatedAt: dev.credentialRotatedAt,
    created_at: dev.created_at,
  };
}

/** Store demo lokal (module-level, di-seed malas dari demo devices). */
let demoStations: Station[] | null = null;

/** Dipakai tes unit untuk mengulang seed demo dari keadaan bersih. */
export function resetDemoStationsForTest(): void {
  demoStations = null;
}

async function getDemoStations(): Promise<Station[]> {
  if (!demoStations) {
    const devices = await demoDevices.getDevices();
    demoStations = devices.map(edgeDeviceToStation);
  }
  return demoStations;
}

function findDemoStation(deviceId: string): Station | undefined {
  return demoStations?.find((s) => s.device_id === deviceId);
}

function notFoundError(deviceId: string): ApiError {
  return new ApiError({
    code: 'DEVICE_NOT_FOUND',
    message: `Stasiun "${deviceId}" tidak ditemukan.`,
    httpStatus: 404,
  });
}

export const httpStations = {
  async getStations(signal?: AbortSignal): Promise<Station[]> {
    checkAbortHttp(signal);
    if (resolveApiMode() !== 'real') {
      return [...(await getDemoStations())];
    }
    return reqAllPages(ADMIN_ENDPOINTS.DEVICES_LIST.buildPath(), mapStation, signal, 'DEVICES_LIST');
  },

  async registerStation(data: {
    device_id: string;
    mac_address?: string;
    ip_address?: string | null;
    firmware_version?: string | null;
  }): Promise<Station> {
    const deviceId = data.device_id.trim();
    if (resolveApiMode() !== 'real') {
      assertCapability('device.manage', ['ADMIN'], { resourceId: deviceId });
      const stations = await getDemoStations();
      if (!deviceId || deviceId.length > 64) {
        throw new ApiError({ code: 'VALIDATION_ERROR', message: 'Station / Device ID wajib 1–64 karakter.', httpStatus: 400 });
      }
      if (stations.some((s) => s.device_id === deviceId)) {
        throw new ApiError({ code: 'DEVICE_ALREADY_REGISTERED', message: `Device ID "${deviceId}" sudah terdaftar.`, httpStatus: 409 });
      }
      const created: Station = {
        device_id: deviceId,
        mac_address: data.mac_address?.trim() || '',
        ip_address: data.ip_address?.trim() || null,
        firmware_version: data.firmware_version?.trim() || null,
        online: false,
        last_seen: null,
        enrollmentState: 'PROVISIONED',
        provisionedAt: null,
        credentialRotatedAt: null,
        created_at: new Date().toISOString(),
      };
      stations.push(created);
      return { ...created };
    }
    assertAuthenticatedHttp();
    assertLanForMutation();
    return reqJson(
      {
        method: 'POST',
        path: ADMIN_ENDPOINTS.DEVICES_CREATE.buildPath(),
        body: {
          deviceId,
          ...(data.mac_address?.trim() ? { macAddress: data.mac_address.trim() } : {}),
          ...(data.ip_address ? { ipAddress: data.ip_address.trim() } : {}),
          ...(data.firmware_version ? { firmwareVersion: data.firmware_version.trim() } : {}),
        },
        timeoutMs: MUTATION_TIMEOUT_MS,
        retry: false,
        endpointKey: 'DEVICES_CREATE',
        capability: 'device.manage',
        resourceId: deviceId,
      },
      mapStation,
    );
  },

  async updateStation(
    deviceId: string,
    patch: { ip_address?: string | null; firmware_version?: string | null },
  ): Promise<Station> {
    if (resolveApiMode() !== 'real') {
      assertCapability('device.manage', ['ADMIN'], { resourceId: deviceId });
      const stations = await getDemoStations();
      const target = findDemoStation(deviceId);
      if (!target) throw notFoundError(deviceId);
      // Field yang dikosongkan DI-OMIT (bukan null) — server mempertahankan nilai lama.
      if (patch.ip_address?.trim()) target.ip_address = patch.ip_address.trim();
      if (patch.firmware_version?.trim()) target.firmware_version = patch.firmware_version.trim();
      return { ...target };
    }
    assertAuthenticatedHttp();
    assertLanForMutation();
    return reqJson(
      {
        method: 'PUT',
        path: ADMIN_ENDPOINTS.DEVICES_UPDATE.buildPath(deviceId),
        body: {
          ...(patch.ip_address?.trim() ? { ipAddress: patch.ip_address.trim() } : {}),
          ...(patch.firmware_version?.trim() ? { firmwareVersion: patch.firmware_version.trim() } : {}),
        },
        timeoutMs: MUTATION_TIMEOUT_MS,
        retry: false,
        endpointKey: 'DEVICES_UPDATE',
        capability: 'device.manage',
        resourceId: deviceId,
      },
      mapStation,
    );
  },

  /**
   * Nonaktifkan stasiun (revoke) — enrollmentState → REVOKED, kredensial
   * dicabut. Satu arah: TIDAK ADA un-revoke lewat API; "aktifkan kembali"
   * = register/provision ulang (tergantung respons server, Q3).
   */
  async revokeStation(deviceId: string, reason: string): Promise<Station> {
    if (resolveApiMode() !== 'real') {
      assertCapability('device.manage', ['ADMIN'], { resourceId: deviceId });
      const stations = await getDemoStations();
      const target = findDemoStation(deviceId);
      if (!target) throw notFoundError(deviceId);
      if (target.enrollmentState === 'REVOKED') {
        throw new ApiError({ code: 'DEVICE_ALREADY_REVOKED', message: `Stasiun "${deviceId}" sudah dicabut.`, httpStatus: 409 });
      }
      target.enrollmentState = 'REVOKED';
      return { ...target };
    }
    assertAuthenticatedHttp();
    assertLanForMutation();
    const raw = await reqJson<Record<string, unknown>>({
      method: 'POST',
      path: ADMIN_ENDPOINTS.DEVICES_REVOKE.buildPath(deviceId),
      body: { reason },
      timeoutMs: MUTATION_TIMEOUT_MS,
      retry: false,
      endpointKey: 'DEVICES_REVOKE',
      capability: 'device.manage',
      resourceId: deviceId,
    });
    const deviceRaw = (raw as Record<string, unknown>).device ?? raw;
    return mapStation(deviceRaw);
  },

  async deleteStation(deviceId: string): Promise<{ success: boolean }> {
    if (resolveApiMode() !== 'real') {
      assertCapability('device.manage', ['ADMIN'], { resourceId: deviceId });
      const stations = await getDemoStations();
      const idx = stations.findIndex((s) => s.device_id === deviceId);
      if (idx === -1) throw notFoundError(deviceId);
      stations.splice(idx, 1);
      return { success: true };
    }
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
  },
};
