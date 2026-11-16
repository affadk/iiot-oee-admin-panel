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
  | 'dashboard.read'
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
  | 'downtime.reason.label'
  | 'export.telemetry'
  | 'audit.system.read'
  | 'device.manage'
  | 'machine.manage'
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
  | 'access_control.manage'
  | 'mqtt.dynsec.read'
  | 'mqtt.dynsec.manage'
  | 'mqtt.config.read'
  | 'mqtt.config.read_raw'
  | 'mqtt.config.manage'
  | 'mqtt.overview.read';

export type CapabilityState = 'allowed' | 'denied' | 'unknown';

export const ROLE_LEVELS: Record<UserRole, number> = {
  ADMIN: 40,
  SUPERVISOR: 30,
  OPERATOR: 20,
  MAINTENANCE: 10,
};

export const ACCOUNT_MANAGER_MIN_LEVEL = 30;

export const CUSTOM_ROLE_MAX_LEVEL = 29;

export const RESERVED_PERMISSIONS = [
  'manage:access_control',
  'manage:mqtt_admin',
  'manage:mqtt_configuration',
  'read_raw:mqtt_configuration',
] as const;

export const SYSTEM_ROLE_NAMES = ['ADMIN', 'SUPERVISOR', 'OPERATOR', 'MAINTENANCE'] as const;

export function isSystemRoleName(roleName: string): boolean {
  return (SYSTEM_ROLE_NAMES as readonly string[]).includes(roleName.trim().toUpperCase());
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

export function policyTargetsAdmin(policyRole: string): boolean {
  return policyRole
    .split('|')
    .map((r) => r.trim().toUpperCase())
    .some((r) => r === 'ADMIN' || r === '*');
}

export function policyMatchesRole(policyRole: string, effectiveRoles: Set<string> | string[]): boolean {
  const roleSet = Array.isArray(effectiveRoles) ? new Set(effectiveRoles) : effectiveRoles;
  return policyRole
    .split('|')
    .map((r) => r.trim())
    .some((r) => r === '*' || roleSet.has(r));
}

export function canManageTargetRole(actorRole: UserRole, targetRole: UserRole): boolean {
  const actorLevel = ROLE_LEVELS[actorRole] ?? 0;
  const targetLevel = ROLE_LEVELS[targetRole] ?? 0;
  if (actorLevel >= 40) return true;
  if (actorLevel >= ACCOUNT_MANAGER_MIN_LEVEL) return targetLevel < actorLevel;
  return false;
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
  'dashboard.read': { allowedRoles: ALL_ROLES, requiresLan: false, requiresAuth: false },
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
  'downtime.reason.label': {
    allowedRoles: ALL_ROLES,
    requiresLan: true,
    requiresAuth: true,
    attributeDependent: true,
  },

  // Historical export (Bearer refresh:telemetry; works on REMOTE_TUNNEL for ADMIN/SUPERVISOR)
  'export.telemetry': {
    allowedRoles: ['ADMIN', 'SUPERVISOR'],
    requiresLan: false,
    requiresAuth: true,
    roleOnly: true,
  },

  // System audit (ADMIN + LAN only)
  'audit.system.read': {
    allowedRoles: ['ADMIN'],
    requiresLan: true,
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

  // IAM Console (ADMIN + LAN)
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
