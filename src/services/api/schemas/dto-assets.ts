/**
 * Skema Zod DTO — domain assets (device, stasiun, mesin) (validasi respons backend).
 *
 * Dipisah dari schemas/dto.ts pada refactoring E31.15 (FAT-278, R10:
 * satu file skema = satu domain). Barrel penggabung: schemas/dto.ts.
 */
import { z } from 'zod';

export const BoundDeviceSummarySchema = z.object({
  device_id: z.string().min(1),
  mac_address: z.string().min(1),
  ip_address: z.string().nullable(),
  firmware_version: z.string().nullable(),
  online: z.boolean(),
  model: z.string().optional(),
});

export const BoundMachineSummarySchema = z.object({
  machine_id: z.string().min(1),
  name: z.string().min(1),
  modbus_slave_id: z.number().int().min(1).max(247).optional(),
});

export const DeviceEnrollmentStateSchema = z.enum(['PROVISIONED', 'ACTIVE', 'REVOKED']);

export const EdgeDeviceSchema = z.object({
  device_id: z.string().regex(/^STM32-[A-Za-z0-9_-]+$/),
  model: z.string().optional(),
  serial_number: z.string().optional(),
  // §E: MAC boleh kosong saat provisioning ("" sampai teramati via /hello).
  mac_address: z.union([z.literal(''), z.string().regex(/^([0-9A-Fa-f]{2}[:-]){5}[0-9A-Fa-f]{2}$/)]),
  ip_address: z.string().nullable(),
  firmware_version: z.string().nullable(),
  online: z.boolean(),
  last_seen: z.string().nullable(),
  bound_machine_id: z.string().nullable(),
  bound_machine_name: z.string().nullable().optional(),
  boundMachine: BoundMachineSummarySchema.nullable().optional(),
  enrollmentState: DeviceEnrollmentStateSchema.optional(),
  provisionedAt: z.string().nullable().optional(),
  credentialRotatedAt: z.string().nullable().optional(),
  created_at: z.string(),
});

/**
 * E27 Spec 043 (FAT-232, T1): ID stasiun/kiosk — konvensi panel yang sama
 * dengan HistoryFiltersSchema (dto-telemetry.ts): trim, 1..64 karakter. Batas ini
 * konvensi panel, BUKAN batas server; TIDAK ada regex ^STM32-... di sini
 * (EdgeDeviceSchema di atas menolak ID stasiun seperti ADMIN-CONSOLE-01).
 */
export const StationIdSchema = z.string().trim().min(1).max(64);

/**
 * E27 Spec 043 (FAT-232, T1): skema respons stasiun — bentuk DeviceResponse
 * yang sama dengan edge device, tapi device_id memakai StationIdSchema
 * (tanpa regex STM32) dan tanpa ikatan mesin. Dipakai mapStation().
 */
export const StationSchema = z.object({
  device_id: StationIdSchema,
  model: z.string().optional(),
  mac_address: z.string(),
  ip_address: z.string().nullable(),
  firmware_version: z.string().nullable(),
  online: z.boolean(),
  last_seen: z.string().nullable(),
  enrollmentState: DeviceEnrollmentStateSchema.optional(),
  provisionedAt: z.string().nullable().optional(),
  credentialRotatedAt: z.string().nullable().optional(),
  created_at: z.string(),
});

export const MachineSchema = z.object({
  machine_id: z.string().regex(/^CNC-[A-Z0-9_-]{3,32}$/),
  name: z.string().min(3).max(100),
  bound_device_id: z.string().nullable(),
  boundDevice: BoundDeviceSummarySchema.nullable().optional(),
  modbus_slave_id: z.number().int().min(1).max(247),
  line_id: z.string().nullable().optional(),
  created_at: z.string(),
});

export const MachineStatusHistoryItemSchema = z.object({
  id: z.union([z.number(), z.string()]),
  deviceId: z.string().nullable(),
  machineId: z.string(),
  state: z.enum([
    'UNCONFIGURED',
    'READY',
    'RUNNING',
    'PLANNED_DOWNTIME',
    'UNPLANNED_DOWNTIME',
    'BATCH_FINISHED',
    'OFFLINE',
  ]),
  startedAt: z.string(),
  endedAt: z.string().nullable(),
  durationSec: z.number().nonnegative(),
  triggerSource: z.string(),
  isActive: z.boolean(),
});

export const BindDeviceRequestSchema = z.object({
  device_id: z.string().regex(/^STM32-[A-Za-z0-9_-]+$/),
});

export const DeviceHealthSchema = z.object({
  device_id: z.string().min(1),
  timestamp: z.string().nullable().optional(),
  heapFree: z.number().nonnegative(),
  tasksHealthy: z.number().int().nonnegative(),
  tasksTotal: z.number().int().nonnegative(),
  ageSec: z.number().nonnegative(),
  eventFlags: z.array(z.string()),
  staleCount: z.number().int().nonnegative(),
  staleTasks: z.array(z.string()),
});
