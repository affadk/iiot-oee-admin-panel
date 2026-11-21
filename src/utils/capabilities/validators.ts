/**
 * Validator input form per domain (Guide §7.2).
 *
 * Dipisah dari file god-file pada refactoring R9 (kontrak docs/DIRECTORY_STRUCTURE.md).
 * Satu file = satu domain. Barrel penggabung ada di file induknya.
 */
import { isValidIpAddress } from './network';
/**
 * §7.2 Authoritative Client-Side Input Validation Patterns (mirroring backend Zod contracts)
 */
export const VALIDATION_PATTERNS = {
  DEVICE_ID: /^STM32-[A-Za-z0-9_-]+$/,
  MAC_ADDRESS: /^([0-9A-Fa-f]{2}[:-]){5}[0-9A-Fa-f]{2}$/,
  IPV4_OR_IPV6: /^((25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)(\.(25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)){3}|(([0-9a-fA-F]{1,4}:){7}[0-9a-fA-F]{1,4}|([0-9a-fA-F]{1,4}:)*::([0-9a-fA-F]{1,4}:)*[0-9a-fA-F]{0,4}))$/,
  MACHINE_ID: /^CNC-[A-Z0-9_-]{3,32}$/,
  PRODUCT_ID: /^[A-Z0-9_-]{3,32}$/,
  OPERATOR_ID: /^[A-Z0-9_-]{3,32}$/,
  PRODUCTION_LINE_ID: /^[A-Z0-9_-]{1,64}$/,
  SHIFT_ID: /^[A-Z0-9_-]{1,64}$/,
  SHIFT_TIME: /^([01]\d|2[0-3]):[0-5]\d$/,
  MQTT_USERNAME: /^[A-Za-z0-9_-]{1,64}$/,
  IAM_ROLE_NAME: /^[A-Za-z][A-Za-z0-9_-]{1,63}$/,
} as const;

export function validateDeviceInput(input: {
  deviceId?: string;
  macAddress?: string;
  ipAddress?: string;
  firmwareVersion?: string;
  isCreate?: boolean;
}): Record<string, string> {
  const errors: Record<string, string> = {};
  if (input.isCreate) {
    if (!input.deviceId || !VALIDATION_PATTERNS.DEVICE_ID.test(input.deviceId.trim())) {
      errors.deviceId = 'ID Perangkat harus diawali "STM32-" dan hanya berisi huruf, angka, "_" atau "-" (contoh: STM32-OEE-06).';
    }
    // E23 Batch 4 (FAT-206, N-37): spec live POST /devices — `macAddress`
    // OPSIONAL. Format tetap divalidasi bila diisi; kosong bukan error.
    if (input.macAddress && input.macAddress.trim().length > 0 && !VALIDATION_PATTERNS.MAC_ADDRESS.test(input.macAddress.trim())) {
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

export function validateMachineInput(input: {
  machineId?: string;
  machineName?: string;
  modbusSlaveId?: number;
  boundDeviceId?: string | null;
  lineId?: string | null;
  isCreate?: boolean;
}): Record<string, string> {
  const errors: Record<string, string> = {};
  if (input.isCreate) {
    if (!input.machineId || !VALIDATION_PATTERNS.MACHINE_ID.test(input.machineId.trim())) {
      errors.machineId = 'ID Mesin harus diawali "CNC-" diikuti 3–32 karakter huruf besar, angka, "_" atau "-" (contoh: CNC-MILLING-03).';
    }
    if (input.boundDeviceId && input.boundDeviceId.trim().length > 0) {
      if (!VALIDATION_PATTERNS.DEVICE_ID.test(input.boundDeviceId.trim())) {
        errors.boundDeviceId = 'ID Perangkat terikat harus mengikuti pola "STM32-..." yang valid.';
      }
    }
  }
  if (input.isCreate || input.machineName !== undefined) {
    const name = (input.machineName ?? '').trim();
    if (name.length < 3 || name.length > 100) {
      errors.machineName = 'Nama mesin wajib 3–100 karakter.';
    }
  }
  if (input.modbusSlaveId !== undefined) {
    if (!Number.isInteger(input.modbusSlaveId) || input.modbusSlaveId < 1 || input.modbusSlaveId > 247) {
      errors.modbusSlaveId = 'Modbus Slave ID wajib bilangan bulat 1–247.';
    }
  }
  if (input.lineId && input.lineId.trim().length > 0 && !VALIDATION_PATTERNS.PRODUCTION_LINE_ID.test(input.lineId.trim())) {
    errors.lineId = 'Line ID wajib 1–64 karakter huruf besar, angka, "_" atau "-".';
  }
  return errors;
}

export function validateProductInput(input: {
  productId?: string;
  productName?: string;
  stdCycleTimeSec?: number;
  isCreate?: boolean;
}): Record<string, string> {
  const errors: Record<string, string> = {};
  if (input.isCreate) {
    if (!input.productId || !VALIDATION_PATTERNS.PRODUCT_ID.test(input.productId.trim())) {
      errors.productId = 'Product ID wajib 3–32 karakter huruf besar, angka, "_" atau "-" (contoh: PRD-GEAR-99).';
    }
  }
  const name = (input.productName ?? '').trim();
  if (name.length < 3 || name.length > 100) {
    errors.productName = 'Nama produk wajib 3–100 karakter.';
  }
  if (input.stdCycleTimeSec === undefined || Number.isNaN(input.stdCycleTimeSec) || input.stdCycleTimeSec <= 0 || input.stdCycleTimeSec > 9999) {
    errors.stdCycleTimeSec = 'Cycle Time standar wajib > 0 dan maksimal 9999 detik.';
  }
  return errors;
}

export function validateOperatorInput(input: {
  operatorId?: string;
  operatorName?: string;
  lineId?: string;
  password?: string;
  isCreate?: boolean;
}): Record<string, string> {
  const errors: Record<string, string> = {};
  if (input.isCreate) {
    if (!input.operatorId || !VALIDATION_PATTERNS.OPERATOR_ID.test(input.operatorId.trim())) {
      errors.operatorId = 'ID Operator wajib 3–32 karakter huruf besar, angka, "_" atau "-" (contoh: OP-042).';
    }
    if (!input.password || input.password.length < 8 || input.password.length > 128) {
      errors.password = 'Password awal wajib 8–128 karakter.';
    }
  }
  const name = (input.operatorName ?? '').trim();
  if (name.length < 3 || name.length > 100) {
    errors.operatorName = 'Nama operator wajib 3–100 karakter.';
  }
  if (input.lineId && input.lineId.trim().length > 32) {
    errors.lineId = 'Line ID maksimal 32 karakter.';
  }
  return errors;
}

export function validateProductionLineInput(input: {
  lineId?: string;
  lineName?: string;
  description?: string | null;
  isCreate?: boolean;
}): Record<string, string> {
  const errors: Record<string, string> = {};
  if (input.isCreate) {
    if (!input.lineId || !VALIDATION_PATTERNS.PRODUCTION_LINE_ID.test(input.lineId.trim())) {
      errors.lineId = 'Line ID wajib 1–64 karakter huruf besar, angka, "_" atau "-" (contoh: LINE-01).';
    }
  }
  if (input.isCreate || input.lineName !== undefined) {
    const name = (input.lineName ?? '').trim();
    if (name.length < 3 || name.length > 100) {
      errors.lineName = 'Nama lini produksi wajib 3–100 karakter.';
    }
  }
  if (input.description && input.description.length > 255) {
    errors.description = 'Deskripsi maksimal 255 karakter.';
  }
  return errors;
}

export function validateShiftInput(input: {
  shiftId?: string;
  shiftName?: string;
  shiftCode?: string;
  startTime?: string;
  endTime?: string;
  isCreate?: boolean;
}): Record<string, string> {
  const errors: Record<string, string> = {};
  if (input.isCreate) {
    if (!input.shiftId || !VALIDATION_PATTERNS.SHIFT_ID.test(input.shiftId.trim())) {
      errors.shiftId = 'Shift ID wajib 1–64 karakter huruf besar, angka, "_" atau "-" (contoh: PAGI).';
    }
  }
  if (input.isCreate || input.shiftName !== undefined) {
    const name = (input.shiftName ?? '').trim();
    if (name.length < 2 || name.length > 100) {
      errors.shiftName = 'Nama shift wajib 2–100 karakter.';
    }
  }
  if (input.isCreate || input.shiftCode !== undefined) {
    const code = (input.shiftCode ?? '').trim();
    if (code.length < 1 || code.length > 32) {
      errors.shiftCode = 'Kode shift wajib 1–32 karakter.';
    }
  }
  if (input.isCreate || input.startTime !== undefined || input.endTime !== undefined) {
    const start = (input.startTime ?? '').trim();
    const end = (input.endTime ?? '').trim();
    if (!VALIDATION_PATTERNS.SHIFT_TIME.test(start)) {
      errors.startTime = 'Jam mulai wajib format HH:MM (contoh: 07:00).';
    }
    if (!VALIDATION_PATTERNS.SHIFT_TIME.test(end)) {
      errors.endTime = 'Jam selesai wajib format HH:MM (contoh: 15:00).';
    }
    if (
      VALIDATION_PATTERNS.SHIFT_TIME.test(start) &&
      VALIDATION_PATTERNS.SHIFT_TIME.test(end) &&
      start >= end
    ) {
      errors.endTime = 'Jam mulai (startTime) harus lebih awal dari jam selesai (endTime).';
    }
  }
  return errors;
}

export function validateShiftScheduleInput(input: {
  lineId?: string;
  shiftId?: string;
  dayOfWeek?: number;
  isCreate?: boolean;
}): Record<string, string> {
  const errors: Record<string, string> = {};
  if (input.isCreate || input.lineId !== undefined) {
    if (!input.lineId || !VALIDATION_PATTERNS.PRODUCTION_LINE_ID.test(input.lineId.trim())) {
      errors.lineId = 'Lini produksi wajib dipilih dengan Line ID yang valid.';
    }
  }
  if (input.isCreate || input.shiftId !== undefined) {
    if (!input.shiftId || !VALIDATION_PATTERNS.SHIFT_ID.test(input.shiftId.trim())) {
      errors.shiftId = 'Shift wajib dipilih.';
    }
  }
  if (input.isCreate || input.dayOfWeek !== undefined) {
    if (!Number.isInteger(input.dayOfWeek) || (input.dayOfWeek ?? 0) < 1 || (input.dayOfWeek ?? 0) > 7) {
      errors.dayOfWeek = 'Hari kerja wajib bilangan bulat 1 (Senin) sampai 7 (Minggu).';
    }
  }
  return errors;
}

export function doTimeRangesOverlap(
  aStart: string,
  aEnd: string,
  bStart: string,
  bEnd: string
): boolean {
  return aStart < bEnd && bStart < aEnd;
}
