/**
 * Spesifikasi kapabilitas + konstanta peran/izin (Guide §4.5).
 *
 * Dipisah dari file god-file pada refactoring R9 (kontrak docs/DIRECTORY_STRUCTURE.md).
 * Satu file = satu domain. Barrel penggabung ada di file induknya.
 */
import { UserRole } from '../../types/auth';

/**
 * Build Guide §4.5 & §4.6 — Capability-First UI Authorization & §7.2 Input Validation
 */
export type CapabilityKey =
  | 'telemetry.read'
  | 'quality.read'
  | 'downtime.read'
  | 'operational_event.read'
  | 'device.read'
  | 'machine.read'
  | 'product.read'
  | 'oee.read'
  | 'work_order.read'
  | 'operational_event.ack'
  | 'downtime_event.label'
  | 'telemetry.refresh'
  | 'device.manage'
  | 'machine.manage'
  | 'machine.create'
  | 'product.manage'
  | 'production_line.read'
  | 'production_line.manage'
  | 'shift.read'
  | 'shift.manage'
  | 'shift_schedule.read'
  | 'shift_schedule.manage'
  | 'operator.read'
  | 'operator.create'
  | 'operator.status.update'
  | 'operator.password.rotate'
  | 'operator.update'
  | 'operator.delete'
  | 'work_order.cancel'
  | 'telemetry.reconciliation.refresh'
  | 'access_control.read'
  | 'access_control.manage'
  | 'mqtt.dynsec.read'
  | 'mqtt.dynsec.manage'
  | 'mqtt.config.read'
  | 'mqtt.config.read_raw'
  | 'mqtt.config.manage'
  | 'mqtt.overview.read';

export type CapabilityState = 'allowed' | 'denied' | 'unknown';

export const RESERVED_PERMISSIONS = [
  'manage:access_control',
  'manage:mqtt_admin',
  'manage:mqtt_configuration',
  'read_raw:mqtt_configuration',
] as const;

/**
 * Hanya ADMIN yang immutable/reserved (§3.4, FR-RL-002): SUPERVISOR /
 * OPERATOR / MAINTENANCE adalah preset opsional — bisa diubah/dihapus bila
 * tidak dipakai (E20 P20.3, X8). Hierarki level statis DIHAPUS (ROLE_LEVELS /
 * canManageTargetRole / CUSTOM_ROLE_MAX_LEVEL) — otorisasi peran adalah
 * string bebas + guard policy, bukan perbandingan level.
 */
export function isAdminRoleName(roleName: string): boolean {
  return roleName.trim().toUpperCase() === 'ADMIN';
}

export function isReservedPermission(action: string, resourceType: string): boolean {
  const normalizedAction = action.trim().toLowerCase();
  const normalizedRes = resourceType.trim().toLowerCase();

  if (normalizedAction === '*' || normalizedRes === '*' || normalizedRes === 'org:*') {
    return true;
  }

  const actionParts = normalizedAction.split('|').map((p) => p.trim()).filter(Boolean);
  for (const part of actionParts) {
    if (part === '*') return true;
    const key = part.includes(':') ? part : `${part}:${normalizedRes}`;
    if ((RESERVED_PERMISSIONS as readonly string[]).includes(key)) {
      return true;
    }
  }
  return false;
}

/**
 * Apakah pola subjek policy menargetkan ADMIN (atau semua subjek)?
 * Pola kanonis (§3.4): `*`, `role:<nama>`, `operator:<id>`; nama role polos
 * diterima sebagai alias `role:<nama>` (bentuk lama).
 */
export function policyTargetsAdmin(subjectMatch: string): boolean {
  const match = subjectMatch.trim();
  if (match === '*') return true;
  if (match.toLowerCase().startsWith('role:')) return match.slice(5).trim().toUpperCase() === 'ADMIN';
  if (match.toLowerCase().startsWith('operator:')) return match.slice(9).trim().toUpperCase() === 'ADM-001';
  return match.toUpperCase() === 'ADMIN';
}

/**
 * Apakah pola subjek policy berlaku untuk subjek ini? Pola kanonis (§3.4):
 * `*` → semua; `role:<nama>` → role itu; `operator:<id>` → operator itu.
 * Nama role polos diterima sebagai alias `role:<nama>` (bentuk lama).
 */
export function policyMatchesSubject(
  subjectMatch: string,
  subject: { role: string; operatorId?: string },
): boolean {
  const match = subjectMatch.trim();
  if (match === '*') return true;
  if (match.toLowerCase().startsWith('role:')) return match.slice(5).trim().toUpperCase() === subject.role.trim().toUpperCase();
  if (match.toLowerCase().startsWith('operator:')) return subject.operatorId !== undefined && match.slice(9).trim().toUpperCase() === subject.operatorId.trim().toUpperCase();
  return match.toUpperCase() === subject.role.trim().toUpperCase();
}

export interface CapabilitySpec {
  allowedRoles: UserRole[];
  requiresLan: boolean;
  requiresAuth: boolean;
  /** True when backend evaluates scope/ABAC attributes that may vary per resource or policy */
  attributeDependent?: boolean;
  /** Role-only capabilities downgrade globally on 403; scoped ones downgrade per (capability, resourceId) */
  roleOnly?: boolean;
}

export const ALL_ROLES: UserRole[] = ['ADMIN', 'SUPERVISOR', 'OPERATOR', 'MAINTENANCE'];

export const CAPABILITY_SPECS: Record<CapabilityKey, CapabilitySpec> = {
  // Public read endpoints (tunnel-safe)
  'telemetry.read': { allowedRoles: ALL_ROLES, requiresLan: false, requiresAuth: false },
  'quality.read': { allowedRoles: ALL_ROLES, requiresLan: false, requiresAuth: false },
  'downtime.read': { allowedRoles: ALL_ROLES, requiresLan: false, requiresAuth: false },
  'operational_event.read': { allowedRoles: ALL_ROLES, requiresLan: false, requiresAuth: false },
  'device.read': { allowedRoles: ALL_ROLES, requiresLan: false, requiresAuth: false },
  'machine.read': { allowedRoles: ALL_ROLES, requiresLan: false, requiresAuth: false },
  'product.read': { allowedRoles: ALL_ROLES, requiresLan: false, requiresAuth: false },
  'oee.read': { allowedRoles: ALL_ROLES, requiresLan: false, requiresAuth: false },
  'work_order.read': { allowedRoles: ALL_ROLES, requiresLan: false, requiresAuth: false },

  // Shop-floor / authenticated LAN operations
  'operational_event.ack': {
    allowedRoles: ALL_ROLES,
    requiresLan: true,
    requiresAuth: true,
    attributeDependent: true,
  },
  'downtime_event.label': {
    allowedRoles: ALL_ROLES,
    requiresLan: true,
    requiresAuth: true,
    attributeDependent: true,
  },

  // Historical export — policy `refresh:telemetry` (§I, D-13); works on
  // REMOTE_TUNNEL for ADMIN/SUPERVISOR (perilaku lama dipertahankan;
  // "LAN only" §I ditegakkan server-side).
  'telemetry.refresh': {
    allowedRoles: ['ADMIN', 'SUPERVISOR'],
    requiresLan: false,
    requiresAuth: true,
    roleOnly: true,
  },

  // Master data management (ADMIN + LAN)
  'device.manage': {
    allowedRoles: ['ADMIN'],
    requiresLan: true,
    requiresAuth: true,
    attributeDependent: true,
  },
  'machine.manage': {
    allowedRoles: ['ADMIN'],
    requiresLan: true,
    requiresAuth: true,
    attributeDependent: true,
  },
  // E20 P20.5 (FAT-157, pembaruan 09:23): `POST /machines` =
  // authorize("create","machine") ADMIN LAN only — kunci terpisah dari
  // `machine.manage` (ubah/ikat/hapus).
  'machine.create': {
    allowedRoles: ['ADMIN'],
    requiresLan: true,
    requiresAuth: true,
    attributeDependent: true,
  },
  'product.manage': {
    allowedRoles: ['ADMIN'],
    requiresLan: true,
    requiresAuth: true,
    attributeDependent: true,
  },

  // Spec 028 Masters (ADMIN + LAN only)
  'production_line.read': {
    allowedRoles: ['ADMIN'],
    requiresLan: true,
    requiresAuth: true,
    roleOnly: true,
  },
  'production_line.manage': {
    allowedRoles: ['ADMIN'],
    requiresLan: true,
    requiresAuth: true,
    attributeDependent: true,
  },
  'shift.read': {
    allowedRoles: ['ADMIN'],
    requiresLan: true,
    requiresAuth: true,
    roleOnly: true,
  },
  'shift.manage': {
    allowedRoles: ['ADMIN'],
    requiresLan: true,
    requiresAuth: true,
    attributeDependent: true,
  },
  'shift_schedule.read': {
    allowedRoles: ['ADMIN'],
    requiresLan: true,
    requiresAuth: true,
    roleOnly: true,
  },
  'shift_schedule.manage': {
    allowedRoles: ['ADMIN'],
    requiresLan: true,
    requiresAuth: true,
    attributeDependent: true,
  },

  // Operators (read/create/status/password rotate: ADMIN & SUPERVISOR LAN; update/delete: ADMIN LAN only)
  'operator.read': {
    allowedRoles: ['ADMIN', 'SUPERVISOR'],
    requiresLan: true,
    requiresAuth: true,
    roleOnly: true,
  },
  'operator.create': {
    allowedRoles: ['ADMIN', 'SUPERVISOR'],
    requiresLan: true,
    requiresAuth: true,
    attributeDependent: true,
  },
  'operator.status.update': {
    allowedRoles: ['ADMIN', 'SUPERVISOR'],
    requiresLan: true,
    requiresAuth: true,
    attributeDependent: true,
  },
  'operator.password.rotate': {
    allowedRoles: ['ADMIN', 'SUPERVISOR'],
    requiresLan: true,
    requiresAuth: true,
    roleOnly: true,
  },
  'operator.update': {
    allowedRoles: ['ADMIN'],
    requiresLan: true,
    requiresAuth: true,
    attributeDependent: true,
  },
  'operator.delete': {
    allowedRoles: ['ADMIN'],
    requiresLan: true,
    requiresAuth: true,
    attributeDependent: true,
  },

  // Work order cancel (ADMIN + LAN)
  'work_order.cancel': {
    allowedRoles: ['ADMIN'],
    requiresLan: true,
    requiresAuth: true,
    attributeDependent: true,
  },

  // Reconciliation manual refresh (ADMIN & SUPERVISOR + LAN)
  'telemetry.reconciliation.refresh': {
    allowedRoles: ['ADMIN', 'SUPERVISOR'],
    requiresLan: true,
    requiresAuth: true,
    attributeDependent: true,
  },

  // IAM Console — baca digate `access_control.read`, tulis `access_control.manage` (§3.4)
  'access_control.read': {
    allowedRoles: ['ADMIN'],
    requiresLan: true,
    requiresAuth: true,
    roleOnly: true,
  },
  'access_control.manage': {
    allowedRoles: ['ADMIN'],
    requiresLan: true,
    requiresAuth: true,
    roleOnly: true,
  },

  // MQTT Dynamic Security (read ADMIN, mutasi ADMIN+LAN)
  'mqtt.dynsec.read': {
    allowedRoles: ['ADMIN'],
    requiresLan: false,
    requiresAuth: true,
    roleOnly: true,
  },
  'mqtt.dynsec.manage': {
    allowedRoles: ['ADMIN'],
    requiresLan: true,
    requiresAuth: true,
    roleOnly: true,
  },

  // MQTT Configuration (ADMIN & SUPERVISOR read; /raw ADMIN only; manage ADMIN+LAN)
  'mqtt.config.read': {
    allowedRoles: ['ADMIN', 'SUPERVISOR'],
    requiresLan: false,
    requiresAuth: true,
    roleOnly: true,
  },
  'mqtt.config.read_raw': {
    allowedRoles: ['ADMIN'],
    requiresLan: false,
    requiresAuth: true,
    roleOnly: true,
  },
  'mqtt.config.manage': {
    allowedRoles: ['ADMIN'],
    requiresLan: true,
    requiresAuth: true,
    roleOnly: true,
  },
  'mqtt.overview.read': {
    allowedRoles: ['ADMIN'],
    requiresLan: false,
    requiresAuth: true,
    roleOnly: true,
  },
};
