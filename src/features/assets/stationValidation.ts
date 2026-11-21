/**
 * Validator form stasiun (E27 Spec 043, FAT-232, T1).
 *
 * BEDA dengan validateDeviceInput: ID stasiun TIDAK memakai pola
 * ^STM32-... — yang berlaku hanya konvensi panel trim, 1..64 karakter
 * (sama dengan HistoryFiltersSchema.deviceId). TIDAK ADA field hostname
 * (API tidak punya field itu).
 *
 * E28 Batch A (FAT-232 adendum, FAT-237): validasi klien SENGAJA tetap
 * longgar — server saat ini menolak ID non-STM32 dengan 400 yang JELAS
 * ("Device ID must start with 'STM32-'...") dan pesan itu ditampilkan
 * apa adanya di modal (submitError). Menambah pola STM32- di klien hanya
 * akan menyembunyikan penolakan server + menutupi gap backend FAT-237.
 *
 * E30 (FAT-254, P30.1): klasifikasi kelas ID stasiun — TAMPILAN SAJA, bukan
 * validasi. `terminal` = identitas terminal HMI (STATION-/KIOSK-/ADMIN-),
 * `edge-device` = perangkat edge STM32-. Kelas terminal baru bisa
 * didaftarkan setelah backend mendukungnya (FAT-237 / B30.1); sampai saat
 * itu server tetap menolaknya 400 dan pesan server ditampilkan apa adanya.
 * Klasifikasi TIDAK mengubah apa yang boleh di-submit — server yang
 * memutuskan.
 */
import { isValidIpAddress } from '../../utils/capabilities/network';

/** Kelas ID stasiun (E30, P30.1) — tampilan saja. */
export type StationKind = 'edge-device' | 'terminal' | 'unknown';

/** Klasifikasikan ID stasiun berdasarkan prefiks (case-insensitive, trim). */
export function classifyStationId(deviceId: string): StationKind {
  const id = (deviceId ?? '').trim();
  if (/^STM32-/i.test(id)) return 'edge-device';
  if (/^(STATION|KIOSK|ADMIN)-/i.test(id)) return 'terminal';
  return 'unknown';
}

export const STATION_KIND_LABELS: Record<StationKind, string> = {
  'edge-device': 'Edge device',
  terminal: 'Terminal',
  unknown: 'Belum diklasifikasi',
};

/** Validasi satu ID stasiun: null = valid; string = pesan error. */
export function validateStationId(deviceId: string): string | null {
  const id = (deviceId ?? '').trim();
  if (!id) return 'Station / Device ID wajib diisi.';
  if (id.length > 64) return 'Station / Device ID maksimal 64 karakter.';
  return null;
}

export function validateStationInput(input: {
  deviceId?: string;
  macAddress?: string;
  ipAddress?: string;
  firmwareVersion?: string;
  isCreate?: boolean;
}): Record<string, string> {
  const errors: Record<string, string> = {};
  if (input.isCreate) {
    const idErr = validateStationId(input.deviceId ?? '');
    if (idErr) errors.deviceId = idErr;
    if (input.macAddress && input.macAddress.trim().length > 0 && !/^([0-9A-Fa-f]{2}[:-]){5}[0-9A-Fa-f]{2}$/.test(input.macAddress.trim())) {
      errors.macAddress = 'MAC Address wajib format EUI-48 dengan ":" atau "-" (contoh: 00:08:DC:55:01:0A).';
    }
  }
  if (input.ipAddress && input.ipAddress.trim().length > 0 && !isValidIpAddress(input.ipAddress)) {
    errors.ipAddress = 'IP Address tidak valid (gunakan format IPv4 atau IPv6).';
  }
  if (input.firmwareVersion && input.firmwareVersion.trim().length > 50) {
    errors.firmwareVersion = 'Versi firmware maksimal 50 karakter.';
  }
  return errors;
}
