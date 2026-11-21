/**
 * Mapper backend→lokal — domain assets.
 *
 * Dipisah dari file god-file pada refactoring R9 (kontrak docs/DIRECTORY_STRUCTURE.md).
 * Satu file = satu domain. Barrel penggabung ada di file induknya.
 */
import { num, str, bool, iso, pick, mustParse } from '../primitives';
import { EdgeDeviceSchema, StationSchema, MachineSchema, OperatorSchema, ProductionLineSchema, ShiftSchema, ShiftScheduleSchema } from '../../schemas';
import { normalizeFsmState } from '../../../../utils/oeeCalculations';
import { Machine, EdgeDevice, Station, DeviceHealth, MachineStatusHistoryItem } from '../../../../types/assets';
import { Product, Operator, ProductionLine, Shift, ShiftSchedule } from '../../../../types/production';
import { TelemetryWsHealthEvent } from '../../../ws/telemetrySocket';

export function mapDevice(raw: unknown): EdgeDevice {
  const r = (raw ?? {}) as Record<string, unknown>;
  const bound = (r.boundMachine ?? r.bound_machine ?? null) as Record<string, unknown> | null;
  // D7: server §E kirim boundMachine {machineId, machineName} — BUKAN ringkasan
  // device dan BUKAN {machine_id, name, modbus_slave_id}. Bentuk lama melempar
  // mustParse untuk setiap device terikat di Real mode.
  const enrollment = pick(r.enrollmentState, r.enrollment_state) as string | undefined;
  return mustParse(EdgeDeviceSchema, {
    device_id: str(pick(r.deviceId, r.device_id)),
    model: str(pick(r.model), undefined) || undefined,
    serial_number: str(pick(r.serialNumber, r.serial_number), undefined) || undefined,
    mac_address: str(pick(r.macAddress, r.mac_address)),
    ip_address: (pick(r.ipAddress, r.ip_address) as string | null) ?? null,
    firmware_version: (pick(r.firmwareVersion, r.firmware_version) as string | null) ?? null,
    online: bool(pick(r.isOnline, r.online), false),
    last_seen: (pick(r.lastSeenAt, r.last_seen) as string | null) ?? null,
    bound_machine_id: (pick(bound?.machineId, bound?.machine_id) as string | null) ?? null,
    bound_machine_name: (pick(bound?.machineName, bound?.name) as string | null) ?? null,
    boundMachine: bound
      ? {
          machine_id: str(pick(bound.machineId, bound.machine_id)),
          name: str(pick(bound.machineName, bound.name)),
        }
      : null,
    enrollmentState:
      enrollment === 'PROVISIONED' || enrollment === 'ACTIVE' || enrollment === 'REVOKED'
        ? enrollment
        : 'ACTIVE',
    provisionedAt: (pick(r.provisionedAt, r.provisioned_at) as string | null) ?? null,
    credentialRotatedAt: (pick(r.credentialRotatedAt, r.credential_rotated_at) as string | null) ?? null,
    created_at: iso(pick(r.createdAt, r.created_at)),
  }, 'perangkat');
}

/**
 * E27 Spec 043 (FAT-232, T1): mapper stasiun/kiosk — JANGAN pakai mapDevice()
 * untuk stasiun: EdgeDeviceSchema menolak device_id non-STM32 (mis.
 * ADMIN-CONSOLE-01) dengan INVALID_RESPONSE, padahal server menerimanya
 * sebagai baris devices biasa. Mapper ini toleran terhadap device_id apa
 * pun (trim, 1..64) dan tidak membaca ikatan mesin / kredensial broker.
 */
export function mapStation(raw: unknown): Station {
  const r = (raw ?? {}) as Record<string, unknown>;
  const enrollment = pick(r.enrollmentState, r.enrollment_state) as string | undefined;
  return mustParse(StationSchema, {
    device_id: str(pick(r.deviceId, r.device_id)),
    model: str(pick(r.model), undefined) || undefined,
    mac_address: str(pick(r.macAddress, r.mac_address)),
    ip_address: (pick(r.ipAddress, r.ip_address) as string | null) ?? null,
    firmware_version: (pick(r.firmwareVersion, r.firmware_version) as string | null) ?? null,
    online: bool(pick(r.isOnline, r.online), false),
    last_seen: (pick(r.lastSeenAt, r.last_seen) as string | null) ?? null,
    enrollmentState:
      enrollment === 'PROVISIONED' || enrollment === 'ACTIVE' || enrollment === 'REVOKED'
        ? enrollment
        : 'ACTIVE',
    provisionedAt: (pick(r.provisionedAt, r.provisioned_at) as string | null) ?? null,
    credentialRotatedAt: (pick(r.credentialRotatedAt, r.credential_rotated_at) as string | null) ?? null,
    created_at: iso(pick(r.createdAt, r.created_at)),
  }, 'stasiun');
}

export function mapMachine(raw: unknown): Machine {
  const r = (raw ?? {}) as Record<string, unknown>;
  const bound = (r.boundDevice ?? r.bound_device ?? null) as Record<string, unknown> | null;
  return mustParse(MachineSchema, {
    machine_id: str(pick(r.machineId, r.machine_id)),
    name: str(pick(r.machineName, r.name)),
    bound_device_id: (pick(r.deviceId, r.device_id) as string | null) ?? null,
    boundDevice: bound
      ? {
          device_id: str(pick(bound.deviceId, bound.device_id)),
          mac_address: str(pick(bound.macAddress, bound.mac_address)),
          ip_address: (pick(bound.ipAddress, bound.ip_address) as string | null) ?? null,
          firmware_version: (pick(bound.firmwareVersion, bound.firmware_version) as string | null) ?? null,
          online: bool(pick(bound.isOnline, bound.online), false),
        }
      : null,
    modbus_slave_id: num(pick(r.modbusSlaveId, r.modbus_slave_id), 1),
    line_id: (pick(r.lineId, r.line_id) as string | null) ?? null,
    created_at: iso(pick(r.createdAt, r.created_at)),
  }, 'mesin');
}

export function mapProduct(raw: unknown): Product {
  const r = (raw ?? {}) as Record<string, unknown>;
  return {
    product_id: str(pick(r.productId, r.product_id)),
    sku: str(pick(r.sku, r.productId, r.product_id)),
    name: str(pick(r.productName, r.name)),
    ideal_cycle_time_seconds: num(pick(r.stdCycleTimeSec, r.std_cycle_time_sec, r.ideal_cycle_time_seconds), 0),
    active: bool(pick(r.isActive, r.active), true),
    created_at: iso(pick(r.createdAt, r.created_at)),
  };
}

export function mapOperator(raw: unknown): Operator {
  const r = (raw ?? {}) as Record<string, unknown>;
  // Role string bebas (§H, E20 P20.3): default UNASSIGNED (bukan OPERATOR);
  // line_id apa adanya (bukan default 'LINE-01').
  return mustParse(OperatorSchema, {
    operator_id: str(pick(r.operatorId, r.operator_id)),
    name: str(pick(r.operatorName, r.name)),
    role: str(pick(r.role), 'UNASSIGNED'),
    line_id: str(pick(r.lineId, r.line_id), ''),
    is_active: bool(pick(r.isActive, r.is_active), true),
    is_protected: bool(pick(r.isProtected, r.is_protected), false),
    created_at: iso(pick(r.createdAt, r.created_at)),
  }, 'operator');
}

export function mapProductionLine(raw: unknown): ProductionLine {
  const r = (raw ?? {}) as Record<string, unknown>;
  return mustParse(ProductionLineSchema, {
    lineId: str(pick(r.lineId, r.line_id)),
    lineName: str(pick(r.lineName, r.line_name)),
    description: (pick(r.description) as string | null) ?? null,
    isActive: bool(pick(r.isActive, r.is_active), true),
    createdAt: iso(pick(r.createdAt, r.created_at)),
  }, 'production line');
}

export function mapShift(raw: unknown): Shift {
  const r = (raw ?? {}) as Record<string, unknown>;
  return mustParse(ShiftSchema, {
    shiftId: str(pick(r.shiftId, r.shift_id)),
    shiftName: str(pick(r.shiftName, r.shift_name)),
    shiftCode: str(pick(r.shiftCode, r.shift_code)),
    startTime: normalizeShiftTime(str(pick(r.startTime, r.start_time))),
    endTime: normalizeShiftTime(str(pick(r.endTime, r.end_time))),
    isActive: bool(pick(r.isActive, r.is_active), true),
    createdAt: iso(pick(r.createdAt, r.created_at)),
  }, 'shift');
}

/**
 * E23 Batch 2 (FAT-185, N-16): normalisasi jam longgar ke `HH:MM` untuk UI.
 * Spec live tidak memformat `startTime`/`endTime` — `07:00:00` → `07:00`,
 * `7:00` → `07:00`. Nilai yang tak cocok pola jam diteruskan apa adanya
 * (tampil mentah) agar satu nilai aneh tidak menggagalkan seluruh list.
 */
export function normalizeShiftTime(v: string): string {
  const m = /^(\d{1,2}):(\d{2})(?::(\d{2}))?$/.exec(v.trim());
  if (!m) return v;
  const hh = Number(m[1]);
  const mm = Number(m[2]);
  if (hh > 23 || mm > 59) return v;
  return `${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}`;
}

/**
 * E23 Batch 2 (FAT-186, N-17): normalisasi `dayOfWeek` server ke konvensi
 * panel 1=Senin..7=Minggu — server yang memakai 0..6 mengirim 0 untuk
 * Minggu; 0 dipetakan ke 7 agar label hari tidak bergeser.
 */
export function normalizeDayOfWeek(v: number): number {
  return v === 0 ? 7 : v;
}

export function mapShiftSchedule(raw: unknown): ShiftSchedule {
  const r = (raw ?? {}) as Record<string, unknown>;
  // E23 Batch 2 (FAT-185, N-16): jam shift terdenormalisasi ikut
  // dinormalisasi ke HH:MM seperti mapShift (opsional di sini).
  const rawStart = str(pick(r.startTime, r.start_time), undefined) || undefined;
  const rawEnd = str(pick(r.endTime, r.end_time), undefined) || undefined;
  return mustParse(ShiftScheduleSchema, {
    scheduleId: str(pick(r.scheduleId, r.schedule_id)),
    lineId: str(pick(r.lineId, r.line_id)),
    shiftId: str(pick(r.shiftId, r.shift_id)),
    dayOfWeek: normalizeDayOfWeek(num(pick(r.dayOfWeek, r.day_of_week), 1)),
    isActive: bool(pick(r.isActive, r.is_active), true),
    shiftName: str(pick(r.shiftName, r.shift_name), undefined) || undefined,
    shiftCode: str(pick(r.shiftCode, r.shift_code), undefined) || undefined,
    startTime: rawStart ? normalizeShiftTime(rawStart) : undefined,
    endTime: rawEnd ? normalizeShiftTime(rawEnd) : undefined,
    createdAt: iso(pick(r.createdAt, r.created_at)),
  }, 'jadwal shift');
}

// FAT-202 (N-32): tabel bit OTORITATIF dari firmware
// `App/Inc/tasks_config.h` (System Event Group Bits), didokumentasikan di
// `firmware/docs/11-mqtt-contract.md`. Tabel lama (NTP_SYNCED/MQTT_TLS_ACTIVE/
// MODBUS_*) karangan dan tidak cocok firmware — diganti, bukan ditambah.
export const EVENT_FLAG_BITS: Array<[number, string]> = [
  [1, 'ETHERNET_UP'],
  [2, 'MQTT_CONNECTED'],
  [4, 'JOB_CONFIGURED'],
  [8, 'EMERGENCY_STOP'],
  [16, 'SD_CARD_PRESENT'],
  [32, 'FLASH_WARNING'],
  [64, 'WEB_GUI_ACTIVE'],
  [128, 'WEB_GUI_TIMEOUT'],
  [256, 'PVD_EMERGENCY'],
  [512, 'HEAP_LOW'],
  [1024, 'STACK_OVERFLOW'],
  [2048, 'START_REJECTED'],
];

/** Backend lama memakai bitmask angka; panel memakai string[] (drawer badge). */
export function decodeEventFlags(v: unknown): string[] {
  if (Array.isArray(v)) return v.map((x) => String(x));
  if (typeof v === 'number') return EVENT_FLAG_BITS.filter(([bit]) => (v & bit) !== 0).map(([, name]) => name);
  return [];
}

export function mapMachineStatusHistory(raw: unknown): MachineStatusHistoryItem {
  const r = (raw ?? {}) as Record<string, unknown>;
  return {
    id: (pick(r.id, r.historyId, r.history_id) as string | number | undefined) ??
      `${pick(r.machineId, r.machine_id)}-${pick(r.startedAt, r.started_at)}`,
    deviceId: (pick(r.deviceId, r.device_id) as string | null) ?? null,
    machineId: str(pick(r.machineId, r.machine_id)),
    state: normalizeFsmState(str(pick(r.state, r.fsm_state), 'UNCONFIGURED')) as MachineStatusHistoryItem['state'],
    startedAt: iso(pick(r.startedAt, r.started_at)),
    endedAt: (pick(r.endedAt, r.ended_at) as string | null) ?? null,
    durationSec: num(pick(r.durationSec, r.duration_sec), 0),
    triggerSource: str(pick(r.triggerSource, r.trigger_source), 'SYSTEM'),
    isActive: bool(pick(r.isActive, r.is_active), false),
  };
}

/**
 * FAT-261 (temuan audit WS health 2026-11-20): HEALTH_UPDATE dari WS
 * dipetakan ke DeviceHealth yang SAMA dengan snapshot HTTP — sistem health
 * tidak diubah. WS tidak membawa ageSec, jadi umur laporan dihitung dari
 * timestamp frame terhadap `nowMs` (bisa di-inject tes). eventFlags
 * didekode tabel 12-bit firmware (decodeEventFlags).
 */
export function mapWsHealthEventToDeviceHealth(
  event: TelemetryWsHealthEvent,
  nowMs: number = Date.now(),
): DeviceHealth {
  const tsMs = Date.parse(event.timestampIso);
  const ageSec = Number.isFinite(tsMs) ? Math.max(0, Math.floor((nowMs - tsMs) / 1000)) : 0;
  return {
    device_id: event.device_id,
    timestamp: event.timestampIso,
    heapFree: event.data.heapFree,
    tasksHealthy: event.data.tasksHealthy,
    tasksTotal: event.data.tasksTotal,
    ageSec,
    eventFlags: decodeEventFlags(event.data.eventFlags),
    staleCount: event.data.staleCount,
    staleTasks: event.data.staleTasks,
  };
}

export function mapDeviceHealth(raw: unknown): DeviceHealth {
  const r = (raw ?? {}) as Record<string, unknown>;
  return {
    device_id: str(pick(r.deviceId, r.device_id)),
    timestamp: str(pick(r.timestamp), undefined) || undefined,
    heapFree: num(pick(r.heapFree, r.heap_free), 0),
    tasksHealthy: num(pick(r.tasksHealthy, r.tasks_healthy), 0),
    tasksTotal: num(pick(r.tasksTotal, r.tasks_total), 0),
    ageSec: num(pick(r.ageSec, r.age_sec), 999999),
    eventFlags: decodeEventFlags(pick(r.eventFlags, r.event_flags)),
    staleCount: num(pick(r.staleCount, r.stale_count), 0),
    staleTasks: (pick(r.staleTasks, r.stale_tasks) as string[]) ?? [],
  };
}
