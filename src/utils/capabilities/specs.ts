/**
 * Spesifikasi kapabilitas + konstanta peran/izin (Guide §4.5).
 *
 * Dipisah dari file god-file pada refactoring R9 (kontrak docs/DIRECTORY_STRUCTURE.md).
 * Satu file = satu domain. Barrel penggabung ada di file induknya.
 *
 * E32.7 (FAT-288): guard policy/subjek (RESERVED_PERMISSIONS,
 * isReservedPermission, policyTargetsAdmin, policyMatchesSubject,
 * isAdminRoleName) dipindah ke ./policy.ts — file ini tinggal tabel
 * spesifikasi; guard di-re-export di bawah supaya impor langsung
 * ('./specs') dan barrel tetap jalan.
 */
import { UserRole } from '../../types/auth';

// Re-export guard policy — JANGAN tambah `export * from './policy'`
// ke barrel utils/capabilities: dua `export *` atas nama yang sama
// akan membuat nama itu ambigu dan hilang dari barrel.
export {
  RESERVED_PERMISSIONS,
  isAdminRoleName,
  isReservedPermission,
  policyTargetsAdmin,
  policyMatchesSubject,
} from './policy';

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
