import { NetworkAccessMode, UserRole } from '../types/auth';
import { IamAssignment, IamPermission, IamPolicyRule } from '../types/iam';

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
export const CUSTOM_ROLE_MAX_LEVEL = 100;

export const RESERVED_PERMISSIONS = [
  'manage:access_control',
  'manage:mqtt_admin',
  'manage:mqtt_configuration',
  'read_raw:mqtt_configuration',
] as const;

export const SYSTEM_ROLE_NAMES = ['ADMIN'] as const;

export function isSystemRoleName(roleName: string): boolean {
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

export const GUARDED_PERMISSION_PAIRS: Record<string, readonly string[]> = {
  operator: ['read', 'create', 'update', 'delete', 'update_status', 'rotate_password'],
  device: ['read', 'create', 'update', 'delete', 'manage'],
  machine: ['read', 'create', 'update', 'delete', 'bind', 'unbind', 'manage'],
  product: ['read', 'create', 'update', 'delete', 'manage'],
  work_order: ['read', 'resolve', 'dispatch', 'complete', 'cancel', 'manage'],
  device_command: ['pause', 'resume', 'reset_counter', 'execute'],
  telemetry: ['read', 'export', 'refresh'],
  operational_event: ['read', 'ack', 'export'],
  downtime_event: ['read', 'label', 'export'],
  mqtt_admin: ['read', 'manage'],
  mqtt_configuration: ['read', 'read_raw', 'manage'],
  access_control: ['read', 'manage'],
  production_line: ['read', 'create', 'update', 'delete', 'manage'],
  shift: ['read', 'create', 'update', 'delete', 'manage'],
  shift_schedule: ['read', 'create', 'update', 'delete', 'manage'],
};

export function isGuardedPermissionPair(action: string, resourceType: string): boolean {
  const resKey = resourceType.trim().toLowerCase();
  const actKey = action.trim().toLowerCase();
  const allowedActions = GUARDED_PERMISSION_PAIRS[resKey];
  if (!allowedActions) return false;
  return allowedActions.includes(actKey);
}

const SUBJECT_MATCH_REGEX =
  /^(\*|role:[A-Za-z][A-Za-z0-9_-]{1,63}|operator:[A-Za-z][A-Za-z0-9_-]{1,63})$/;

export function validateSubjectMatch(subject: string): boolean {
  return SUBJECT_MATCH_REGEX.test(subject.trim());
}

export const ABAC_WHITELISTED_ATTRIBUTES = [
  'networkMode',
  'subjectActive',
  'actorLineId',
  'resourceLineId',
  'windowDays',
  'department',
  'operatorId',
  'machineId',
  'deviceId',
  'role',
] as const;

export const ABAC_COMPARATORS = ['eq', 'neq', 'in', 'contains', 'prefix', 'suffix'] as const;

type AbacComparator = (typeof ABAC_COMPARATORS)[number];

function validateAbacAstNode(node: unknown): { valid: boolean; reason?: string } {
  if (!node || typeof node !== 'object' || Array.isArray(node)) {
    return { valid: false, reason: 'Setiap node abac_condition harus berupa objek JSON.' };
  }
  const rec = node as Record<string, unknown>;
  const keys = Object.keys(rec);
  if (keys.length === 0) {
    return { valid: false, reason: 'Node abac_condition tidak boleh kosong.' };
  }

  if ('all' in rec) {
    if (keys.length !== 1 || !Array.isArray(rec.all) || rec.all.length === 0) {
      return { valid: false, reason: 'Operator "all" harus berupa array non-kosong tanpa properti lain.' };
    }
    for (const child of rec.all) {
      const childCheck = validateAbacAstNode(child);
      if (!childCheck.valid) return childCheck;
    }
    return { valid: true };
  }

  if ('any' in rec) {
    if (keys.length !== 1 || !Array.isArray(rec.any) || rec.any.length === 0) {
      return { valid: false, reason: 'Operator "any" harus berupa array non-kosong tanpa properti lain.' };
    }
    for (const child of rec.any) {
      const childCheck = validateAbacAstNode(child);
      if (!childCheck.valid) return childCheck;
    }
    return { valid: true };
  }

  if ('not' in rec) {
    if (keys.length !== 1) {
      return { valid: false, reason: 'Operator "not" hanya boleh memiliki satu properti anak.' };
    }
    return validateAbacAstNode(rec.not);
  }

  // Leaf node: must specify whitelisted `attr` and exactly ONE whitelisted comparator
  if (typeof rec.attr !== 'string') {
    return { valid: false, reason: 'Predikat leaf wajib menyertakan field "attr" string atau operator all/any/not.' };
  }
  if (!(ABAC_WHITELISTED_ATTRIBUTES as readonly string[]).includes(rec.attr)) {
    return { valid: false, reason: `Atribut ABAC "${rec.attr}" tidak masuk whitelist backend.` };
  }

  const comparatorKeys = keys.filter((k) => k !== 'attr');
  if (comparatorKeys.length !== 1) {
    return { valid: false, reason: 'Setiap predikat leaf wajib memiliki tepat satu comparator.' };
  }

  const cmp = comparatorKeys[0];
  if (!(ABAC_COMPARATORS as readonly string[]).includes(cmp)) {
    return { valid: false, reason: `Comparator ABAC "${cmp}" tidak dikenali (izinkan: eq, neq, in, contains, prefix, suffix).` };
  }

  const value = rec[cmp];
  if (cmp === 'in') {
    if (!Array.isArray(value) || value.length === 0) {
      return { valid: false, reason: 'Comparator "in" wajib menerima array nilai non-kosong.' };
    }
  } else if (
    typeof value !== 'string' &&
    typeof value !== 'number' &&
    typeof value !== 'boolean'
  ) {
    return { valid: false, reason: `Nilai comparator "${cmp}" wajib berupa string, number, atau boolean.` };
  }

  return { valid: true };
}

export function validateAbacCondition(
  rawCondition: string | Record<string, unknown> | null | undefined
): { valid: boolean; parsed: Record<string, unknown> | null; reason?: string } {
  if (rawCondition === null || rawCondition === undefined || rawCondition === '') {
    return { valid: true, parsed: null };
  }

  let parsed: unknown;
  if (typeof rawCondition === 'string') {
    const trimmed = rawCondition.trim();
    if (!trimmed) return { valid: true, parsed: null };
    try {
      parsed = JSON.parse(trimmed);
    } catch {
      return { valid: false, parsed: null, reason: 'JSON abac_condition tidak valid.' };
    }
  } else {
    parsed = rawCondition;
  }

  const astCheck = validateAbacAstNode(parsed);
  if (!astCheck.valid) {
    return { valid: false, parsed: null, reason: astCheck.reason };
  }
  return { valid: true, parsed: parsed as Record<string, unknown> };
}

export function computeCatalogueVersion(
  permissions: Pick<IamPermission, 'id' | 'action' | 'resource_type'>[]
): string {
  const canonical = [...permissions]
    .sort((a, b) => a.id.localeCompare(b.id) || a.action.localeCompare(b.action))
    .map((p) => `${p.id}:${p.action}:${p.resource_type}`)
    .join('|');
  let hash = 2166136261;
  for (let i = 0; i < canonical.length; i += 1) {
    hash ^= canonical.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return `cat-${(hash >>> 0).toString(16).padStart(8, '0')}`;
}

export function decodeDeviceEventFlags(mask: number): string[] {
  if (!Number.isFinite(mask) || mask <= 0) return [];
  const bitLabels: Array<[number, string]> = [
    [1 << 0, 'NTP_SYNCED'],
    [1 << 1, 'MQTT_TLS_ACTIVE'],
    [1 << 2, 'MODBUS_HEALTHY'],
    [1 << 3, 'MODBUS_RETRY'],
    [1 << 4, 'HIGH_TEMP_WARN'],
    [1 << 5, 'HEAP_LOW_WARN'],
  ];
  const flags: string[] = [];
  for (const [bit, label] of bitLabels) {
    if ((mask & bit) !== 0) {
      flags.push(label);
    }
  }
  if (flags.length === 0) {
    flags.push(`FLAG_0X${mask.toString(16).toUpperCase()}`);
  }
  return flags;
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

interface CapabilitySpec {
  allowedRoles: UserRole[];
  requiresLan: boolean;
  requiresAuth: boolean;
  /** True when backend evaluates scope/ABAC attributes that may vary per resource or policy */
  attributeDependent?: boolean;
  /** Role-only capabilities downgrade globally on 403; scoped ones downgrade per (capability, resourceId) */
  roleOnly?: boolean;
}

const ALL_ROLES: UserRole[] = ['ADMIN', 'SUPERVISOR', 'OPERATOR', 'MAINTENANCE'];

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

export interface CapabilityDenialEntry {
  capability: CapabilityKey;
  resourceId?: string;
  reason: string;
  deniedAt: number;
}

/**
 * Dynamic 403 downgrade registry keyed by (capability, resourceId?).
 * Cleared on login, logout, or role change.
 */
export class CapabilityDenialStore {
  private denials = new Map<string, CapabilityDenialEntry>();
  private listeners = new Set<() => void>();

  private makeKey(capability: CapabilityKey, resourceId?: string): string {
    const spec = CAPABILITY_SPECS[capability];
    if (spec?.roleOnly || !resourceId) {
      return capability;
    }
    return `${capability}::${resourceId}`;
  }

  recordDenial(capability: CapabilityKey, resourceId?: string, reason = 'Akses ditolak oleh kebijakan keamanan sistem.'): void {
    const key = this.makeKey(capability, resourceId);
    this.denials.set(key, {
      capability,
      resourceId: CAPABILITY_SPECS[capability]?.roleOnly ? undefined : resourceId,
      reason,
      deniedAt: Date.now(),
    });
    this.notify();
  }

  getDenial(capability: CapabilityKey, resourceId?: string): CapabilityDenialEntry | undefined {
    const globalHit = this.denials.get(capability);
    if (globalHit) return globalHit;
    if (resourceId) {
      return this.denials.get(`${capability}::${resourceId}`);
    }
    return undefined;
  }

  clearAll(): void {
    if (this.denials.size === 0) return;
    this.denials.clear();
    this.notify();
  }

  subscribe(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private notify(): void {
    this.listeners.forEach((fn) => fn());
  }
}

export const capabilityDenialStore = new CapabilityDenialStore();

export interface EvaluateCapabilityContext {
  role: UserRole;
  networkMode: NetworkAccessMode;
  isAuthenticated: boolean;
  resourceId?: string;
  denialStore?: CapabilityDenialStore;
  /** Live projection from GET /api/v1/auth/me (`allow` | `deny` | `unknown`) */
  serverCapabilities?: Record<string, 'allow' | 'deny' | 'unknown'> | null;
  /** Optional unknown-scope hint from dynamic ABAC policy if uncertain */
  forceUnknownScope?: boolean;
}

export function evaluateCapability(
  capability: CapabilityKey,
  ctx: EvaluateCapabilityContext
): { state: CapabilityState; canInteract: boolean; reason?: string } {
  const spec = CAPABILITY_SPECS[capability];
  const store = ctx.denialStore ?? capabilityDenialStore;

  if (spec.requiresLan && ctx.networkMode === 'REMOTE_TUNNEL') {
    return {
      state: 'denied',
      canInteract: false,
      reason: 'Mode observasi — perubahan dinonaktifkan. Akses penuh tersedia dari LAN pabrik.',
    };
  }

  if (spec.requiresAuth && !ctx.isAuthenticated) {
    return {
      state: 'denied',
      canInteract: false,
      reason: 'Autentikasi operator diperlukan untuk aksi ini.',
    };
  }

  const deniedEntry = store.getDenial(capability, ctx.resourceId);
  if (deniedEntry) {
    return {
      state: 'denied',
      canInteract: false,
      reason: deniedEntry.reason,
    };
  }

  const projected = ctx.serverCapabilities?.[capability];
  if (projected) {
    if (projected === 'deny') {
      return {
        state: 'denied',
        canInteract: false,
        reason: 'Akun Anda tidak memiliki izin untuk menjalankan aksi ini.',
      };
    }
    if (projected === 'unknown' || ctx.forceUnknownScope) {
      return {
        state: 'unknown',
        canInteract: true,
      };
    }
    return {
      state: 'allowed',
      canInteract: true,
    };
  }

  if (!spec.allowedRoles.includes(ctx.role)) {
    return {
      state: 'denied',
      canInteract: false,
      reason: `Peran ${ctx.role} tidak memiliki izin untuk fitur ini.`,
    };
  }

  if (spec.attributeDependent || ctx.forceUnknownScope) {
    return {
      state: 'unknown',
      canInteract: true,
    };
  }

  return {
    state: 'allowed',
    canInteract: true,
  };
}

export function buildAuthMeCapabilities(
  role: UserRole,
  hasNonOrgScope: boolean,
  mode: 'shadow' | 'enforce' | 'partial' = 'enforce'
): Record<CapabilityKey, 'allow' | 'deny' | 'unknown'> {
  const result = {} as Record<CapabilityKey, 'allow' | 'deny' | 'unknown'>;
  (Object.keys(CAPABILITY_SPECS) as CapabilityKey[]).forEach((cap) => {
    const spec = CAPABILITY_SPECS[cap];
    if (!spec.allowedRoles.includes(role)) {
      result[cap] = mode === 'shadow' && !spec.roleOnly ? 'unknown' : 'deny';
      return;
    }
    if (spec.attributeDependent && hasNonOrgScope) {
      result[cap] = 'unknown';
      return;
    }
    result[cap] = spec.attributeDependent ? 'unknown' : 'allow';
  });
  return result;
}

export interface CasbinAbacEnvironment {
  networkMode?: NetworkAccessMode;
  subjectActive?: boolean;
  actorLineId?: string;
  resourceLineId?: string;
  windowDays?: number;
  department?: string;
  operatorId?: string;
  machineId?: string;
  deviceId?: string;
  role?: string;
}

export interface CasbinAbacEvalInput {
  primaryRole: UserRole;
  assignments: Pick<IamAssignment, 'role_name' | 'scope_type'>[];
  policies: IamPolicyRule[];
  mode: 'shadow' | 'enforce' | 'partial';
  action: string;
  resourceKey: string;
  baselineAllowed: boolean;
  env?: CasbinAbacEnvironment;
}

export interface CasbinAbacEvalResult {
  finalDecision: 'ALLOW' | 'DENY';
  policyDecision: 'ALLOW' | 'DENY';
  baselineDecision: 'ALLOW' | 'DENY';
  shadowMismatch: boolean;
  effectiveRoles: string[];
  reason: string;
}

function matchAction(policyAction: string, requestedAction: string): boolean {
  if (policyAction === '*' || policyAction === requestedAction) return true;
  if (policyAction.includes('|')) {
    return policyAction.split('|').some((part) => part.trim() === requestedAction);
  }
  return false;
}

function matchResourcePattern(pattern: string, resourceKey: string): boolean {
  if (pattern === '*' || pattern === resourceKey) return true;
  if (pattern.endsWith(':*')) {
    const prefix = pattern.slice(0, -1);
    return resourceKey === prefix.slice(0, -1) || resourceKey.startsWith(prefix);
  }
  return false;
}

function evalAbacNode(node: Record<string, unknown>, env: CasbinAbacEnvironment): boolean {
  if (Array.isArray(node.all)) {
    return node.all.every((child) => evalAbacNode(child as Record<string, unknown>, env));
  }
  if (Array.isArray(node.any)) {
    return node.any.some((child) => evalAbacNode(child as Record<string, unknown>, env));
  }
  if (node.not && typeof node.not === 'object') {
    return !evalAbacNode(node.not as Record<string, unknown>, env);
  }

  const attr = node.attr as keyof CasbinAbacEnvironment;
  const actual = env[attr];
  const cmp = Object.keys(node).find((k) => k !== 'attr') as AbacComparator;
  const expected = node[cmp];

  if (actual === undefined) {
    // When contextual attribute is absent in evaluation env, evaluate conservatively unless neq
    return cmp === 'neq';
  }

  switch (cmp) {
    case 'eq':
      return actual === expected;
    case 'neq':
      return actual !== expected;
    case 'in':
      return Array.isArray(expected) && expected.includes(actual);
    case 'contains':
      return typeof actual === 'string' && typeof expected === 'string' && actual.includes(expected);
    case 'prefix':
      return typeof actual === 'string' && typeof expected === 'string' && actual.startsWith(expected);
    case 'suffix':
      return typeof actual === 'string' && typeof expected === 'string' && actual.endsWith(expected);
    default:
      return false;
  }
}

export function matchAbacCondition(
  rawCondition: string | Record<string, unknown> | null | undefined,
  env: CasbinAbacEnvironment
): { matched: boolean; malformed: boolean } {
  const checked = validateAbacCondition(rawCondition);
  if (!checked.valid) {
    return { matched: false, malformed: true };
  }
  if (!checked.parsed) {
    return { matched: true, malformed: false };
  }
  return { matched: evalAbacNode(checked.parsed, env), malformed: false };
}

/**
 * Spec 021 / 032 / ADR-0013 Casbin ABAC Evaluator:
 * - Only ORGANIZATION-scoped assignments grant effective admin-panel roles.
 * - Evaluates 4 dimensions: roleMatch && actionMatch && resourceMatch && abacMatch.
 * - Malformed abac_condition JSON fails closed (DENY).
 * - Precedence: DENY wins (`some(allow) && !some(deny)`), default fail-closed DENY.
 * - `shadow` mode uses baseline for final decision while auditing shadow mismatches.
 */
export function evaluateCasbinAbacDecision(input: CasbinAbacEvalInput): CasbinAbacEvalResult {
  const orgRoles = input.assignments
    .filter((a) => a.scope_type === 'ORGANIZATION')
    .map((a) => a.role_name);
  const effectiveRoles = Array.from(new Set([input.primaryRole, ...orgRoles]));

  let hasAllow = false;
  let hasDeny = false;
  let malformedAbacDetected = false;

  for (const policy of input.policies) {
    if (!policy.is_active) continue;
    const roleMatch = policy.role
      .split('|')
      .map((r) => r.trim())
      .some((r) => r === '*' || effectiveRoles.includes(r));
    if (!roleMatch) continue;
    if (!matchAction(policy.action, input.action)) continue;
    if (!matchResourcePattern(policy.resource_pattern, input.resourceKey)) continue;

    const abacResult = matchAbacCondition(policy.abac_condition, input.env ?? {});
    if (abacResult.malformed) {
      malformedAbacDetected = true;
      continue;
    }
    if (!abacResult.matched) continue;

    if (policy.eft === 'DENY') {
      hasDeny = true;
    } else if (policy.eft === 'ALLOW') {
      hasAllow = true;
    }
  }

  const policyDecision: 'ALLOW' | 'DENY' = hasAllow && !hasDeny && !malformedAbacDetected ? 'ALLOW' : 'DENY';
  const baselineDecision: 'ALLOW' | 'DENY' = input.baselineAllowed ? 'ALLOW' : 'DENY';
  const finalDecision: 'ALLOW' | 'DENY' = input.mode === 'enforce' ? policyDecision : baselineDecision;
  const shadowMismatch = input.mode === 'shadow' && policyDecision !== baselineDecision;

  let reason =
    finalDecision === 'ALLOW'
      ? input.mode === 'enforce'
        ? 'Diizinkan oleh policy Casbin ABAC.'
        : 'Diizinkan oleh baseline shadow mode.'
      : malformedAbacDetected
        ? 'Kondisi JSON ABAC tidak valid (fail-closed DENY).'
        : hasDeny
          ? 'Ditolak oleh aturan eksplisit DENY.'
          : 'Tidak ada aturan ALLOW yang cocok (fail-closed DENY).';

  if (shadowMismatch) {
    reason = `SHADOW_MISMATCH (baseline=${baselineDecision}, policy=${policyDecision})`;
  }

  return {
    finalDecision,
    policyDecision,
    baselineDecision,
    shadowMismatch,
    effectiveRoles,
    reason,
  };
}

/**
 * Normalizes an EUI-48 MAC address (using ":" or "-") into canonical uppercase colon-separated format.
 */
export function normalizeMacAddress(mac: string): string {
  return mac.trim().toUpperCase().replace(/-/g, ':');
}

const IPV4_REGEX = /^((25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)\.){3}(25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)$/;

export function isValidIpAddress(ip: string): boolean {
  const trimmed = ip.trim();
  if (IPV4_REGEX.test(trimmed)) return true;
  if (!trimmed.includes(':')) return false;
  if (/[^0-9a-fA-F:]/.test(trimmed)) return false;
  const doubleColonParts = trimmed.split('::');
  if (doubleColonParts.length > 2) return false;
  if (doubleColonParts.length === 2) {
    const left = doubleColonParts[0] ? doubleColonParts[0].split(':') : [];
    const right = doubleColonParts[1] ? doubleColonParts[1].split(':') : [];
    if (left.some((g) => !/^[0-9a-fA-F]{1,4}$/.test(g))) return false;
    if (right.some((g) => !/^[0-9a-fA-F]{1,4}$/.test(g))) return false;
    return left.length + right.length < 8;
  }
  const groups = trimmed.split(':');
  return groups.length === 8 && groups.every((g) => /^[0-9a-fA-F]{1,4}$/.test(g));
}

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
    if (!input.macAddress || !VALIDATION_PATTERNS.MAC_ADDRESS.test(input.macAddress.trim())) {
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
