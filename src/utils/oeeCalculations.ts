import { MachineFsmState } from '../types/monitoring';
import { AccessMode, UserRole, NetworkAccessMode } from '../types/auth';
import { CapabilityKey, evaluateCapability } from './capabilities';

/**
 * Normalizes legacy and backend FSM states into the 6 canonical FsmStateEnum values
 * (API Doc §6.A / Build Guide §6.1).
 * Presence (online/offline) is tracked separately via `device_online` / `isOnline`.
 */
export function normalizeFsmState(rawState: string | undefined | null): MachineFsmState {
  if (!rawState) return 'UNCONFIGURED';
  const upper = rawState.trim().toUpperCase();
  if (upper === 'RUNNING') return 'RUNNING';
  if (upper === 'READY' || upper === 'STANDBY') return 'READY';
  if (upper === 'UNCONFIGURED') return 'UNCONFIGURED';
  if (upper === 'PLANNED_DOWNTIME' || upper === 'PLANNED_STOP') return 'PLANNED_DOWNTIME';
  if (
    upper === 'UNPLANNED_DOWNTIME' ||
    upper === 'DOWNTIME' ||
    upper === 'FAULT' ||
    upper === 'STOPPED'
  ) {
    return 'UNPLANNED_DOWNTIME';
  }
  if (upper === 'BATCH_FINISHED') return 'BATCH_FINISHED';
  return 'UNCONFIGURED';
}

/**
 * Formats duration in seconds to standard human industrial format "Xh Ym Zs".
 */
export function formatDuration(seconds: number): string {
  if (seconds <= 0 || isNaN(seconds)) return '0s';
  const hrs = Math.floor(seconds / 3600);
  const mins = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);

  const parts: string[] = [];
  if (hrs > 0) parts.push(`${hrs}h`);
  if (mins > 0 || hrs > 0) parts.push(`${mins}m`);
  parts.push(`${secs}s`);
  return parts.join(' ');
}

/**
 * Parses numeric-string metrics (e.g. "92.50") returned by backend without client-side OEE recalculation.
 */
export function parseServerMetric(value: string | number | null | undefined, fallback = 0): number {
  if (value === null || value === undefined) return fallback;
  const num = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(num) ? num : fallback;
}

/**
 * Formats nullable deleted master references per Build Guide Decision D9 / §6.5 / §6.6.
 */
export function formatDeletedRelationLabel(
  name: string | null | undefined,
  fallbackId?: string | null
): { label: string; isDeleted: boolean } {
  if (!name || name === '[deleted]') {
    return {
      label: fallbackId && fallbackId !== '[deleted]' ? `[dihapus] (${fallbackId})` : '[dihapus]',
      isDeleted: true,
    };
  }
  return { label: name, isDeleted: false };
}

export type AdminMutationAction =
  | 'CANCEL_WORK_ORDER'
  | 'MANAGE_ASSETS'
  | 'MANAGE_PRODUCTS'
  | 'MANAGE_OPERATORS'
  | 'ROTATE_OPERATOR_PASSWORD'
  | 'BROKER_CONFIG'
  | 'MQTT_SECURITY'
  | 'MANAGE_IAM'
  | 'ACK_EVENT'
  | 'LABEL_DOWNTIME'
  | 'REFRESH_RECONCILIATION';

const ACTION_TO_CAPABILITY: Record<AdminMutationAction, CapabilityKey> = {
  CANCEL_WORK_ORDER: 'work_order.cancel',
  MANAGE_ASSETS: 'machine.manage',
  MANAGE_PRODUCTS: 'product.manage',
  MANAGE_OPERATORS: 'operator.create',
  ROTATE_OPERATOR_PASSWORD: 'operator.password.rotate',
  BROKER_CONFIG: 'mqtt.config.manage',
  MQTT_SECURITY: 'mqtt.dynsec.manage',
  MANAGE_IAM: 'access_control.manage',
  ACK_EVENT: 'operational_event.ack',
  LABEL_DOWNTIME: 'downtime.reason.label',
  REFRESH_RECONCILIATION: 'telemetry.reconciliation.refresh',
};

/**
 * Enforces network access boundaries and capability baselines.
 * Note: direct machine actuation & HMI WO dispatch/complete are strictly excluded from Admin Panel.
 *
 * Parameter ke-2 (`networkMode`) adalah kanal saat ini; parameter ke-4
 * (`accessMode`, default `private`) adalah mode akses deployment —
 * tunnel + `public` mengizinkan mutasi, tunnel + `private` menolak.
 */
export function canPerformMutation(
  role: UserRole,
  networkMode: NetworkAccessMode,
  action: AdminMutationAction,
  accessMode: AccessMode = 'private'
): { allowed: boolean; reason?: string } {
  const cap = ACTION_TO_CAPABILITY[action];
  const evaluation = evaluateCapability(cap, {
    role,
    networkMode,
    accessMode,
    isAuthenticated: true,
  });
  return {
    allowed: evaluation.canInteract,
    reason: evaluation.reason,
  };
}

export function canCancelWorkOrder(
  role: UserRole,
  networkMode: NetworkAccessMode,
  accessMode: AccessMode = 'private'
): boolean {
  return evaluateCapability('work_order.cancel', {
    role,
    networkMode,
    accessMode,
    isAuthenticated: true,
  }).canInteract;
}

export function canForceReconciliationRefresh(
  role: UserRole,
  networkMode: NetworkAccessMode,
  accessMode: AccessMode = 'private'
): boolean {
  return evaluateCapability('telemetry.reconciliation.refresh', {
    role,
    networkMode,
    accessMode,
    isAuthenticated: true,
  }).canInteract;
}
