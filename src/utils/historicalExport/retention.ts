import { UserRole } from '../../types/auth';
import { ReconciliationError } from '../../types/historical';
import { RETENTION_POLICY_DAYS } from './constants';

/**
 * Validates time window against 90-day retention policy.
 */
export function validateRetentionWindow(
  fromIso: string,
  toIso: string,
  now: Date = new Date(),
  retentionDays: number = RETENTION_POLICY_DAYS
): {
  valid: boolean;
  code?: 'RETENTION_EXCEEDED' | 'INVALID_TIME_RANGE';
  status?: number;
  message?: string;
  daysFromNow: number;
} {
  const fromDate = new Date(fromIso);
  const toDate = new Date(toIso);

  if (Number.isNaN(fromDate.getTime()) || Number.isNaN(toDate.getTime())) {
    return {
      valid: false,
      code: 'INVALID_TIME_RANGE',
      status: 400,
      message: 'Parameter rentang waktu from/to tidak valid (gunakan format ISO-8601).',
      daysFromNow: 0,
    };
  }

  if (fromDate.getTime() > toDate.getTime()) {
    return {
      valid: false,
      code: 'INVALID_TIME_RANGE',
      status: 400,
      message: 'Waktu awal (from) tidak boleh lebih besar daripada waktu akhir (to).',
      daysFromNow: 0,
    };
  }

  const msPerDay = 24 * 60 * 60 * 1000;
  const retentionCutoffMs = now.getTime() - retentionDays * msPerDay;
  const daysFromNow = Math.max(0, Math.ceil((now.getTime() - fromDate.getTime()) / msPerDay));

  if (fromDate.getTime() < retentionCutoffMs) {
    return {
      valid: false,
      code: 'RETENTION_EXCEEDED',
      status: 400,
      message: `RETENTION_EXCEEDED: Permintaan ekspor data mentah (${daysFromNow} hari lalu) melampaui batas kebijakan retensi ${retentionDays} hari. Gunakan Continuous Aggregate (Shift Analytics) untuk laporan OEE jangka panjang.`,
      daysFromNow,
    };
  }

  return { valid: true, daysFromNow };
}

export function assertRetentionWindow(
  fromIso: string,
  toIso: string,
  now: Date = new Date(),
  retentionDays: number = RETENTION_POLICY_DAYS
): void {
  const result = validateRetentionWindow(fromIso, toIso, now, retentionDays);
  if (!result.valid && result.code) {
    throw new ReconciliationError(
      result.code,
      result.message || 'Retention policy exceeded',
      result.status || 400,
      retentionDays
    );
  }
}

export function canExportHistoricalData(role: UserRole): {
  allowed: boolean;
  status?: number;
  reason?: string;
} {
  if (role === 'ADMIN' || role === 'SUPERVISOR') {
    return { allowed: true };
  }
  return {
    allowed: false,
    status: 403,
    reason:
      'Anda tidak memiliki izin untuk mengekspor data historis (khusus Admin dan Supervisor).',
  };
}

export function assertExportAuthorized(role: UserRole): void {
  const check = canExportHistoricalData(role);
  if (!check.allowed) {
    throw new ReconciliationError(
      'FORBIDDEN',
      check.reason || 'Anda tidak memiliki izin untuk mengekspor data historis.',
      check.status || 403
    );
  }
}
