/**
 * Helper demo: guard auth/LAN/kapabilitas, validator, generator telemetri.
 *
 * Dipisah dari file god-file pada refactoring R9 (kontrak docs/DIRECTORY_STRUCTURE.md).
 * Satu file = satu domain. Barrel penggabung ada di file induknya.
 */
import { store } from './store';
import { Machine, EdgeDevice } from '../../../types/assets';
import { RejectParetoItem, TelemetryHistoryRecord } from '../../../types/analytics';
import { UserRole, ApiError } from '../../../types/auth';
import { CapabilityKey, evaluateCasbinAbacDecision, matchAbacCondition, policyMatchesSubject, doTimeRangesOverlap } from '../../../utils/capabilities';
import { EdgeDeviceSchema, MachineSchema } from '../schemas';
import { resolveEffectiveAccess } from '../mode';
import { normalizeFsmState } from '../../../utils/oeeCalculations';

export interface AuthClientHooks {
  onUnauthorized?: (reason?: string) => void;
  onForbidden?: (capability: CapabilityKey, resourceId?: string, reason?: string) => void;
  /** Spec 043 (§L): gerbang ganti-password-wajib — 403 PASSWORD_ROTATION_REQUIRED. */
  onPasswordRotationRequired?: () => void;
}

/** 409 SHIFT_SCHEDULE_OVERLAP: satu lini tidak boleh punya 2 shift yang jamnya tumpang tindih di hari yang sama. */
export function assertNoScheduleOverlap(lineId: string, shiftId: string, dayOfWeek: number, excludeScheduleId: string | null) {
  const shift = store.shifts.find((s) => s.shiftId === shiftId);
  if (!shift) return;
  for (const other of store.shiftSchedules) {
    if (!other.isActive || other.lineId !== lineId || other.dayOfWeek !== dayOfWeek) continue;
    if (excludeScheduleId && other.scheduleId === excludeScheduleId) continue;
    const otherShift = store.shifts.find((s) => s.shiftId === other.shiftId);
    if (!otherShift) continue;
    if (doTimeRangesOverlap(shift.startTime, shift.endTime, otherShift.startTime, otherShift.endTime)) {
      throw new ApiError({
        code: 'SHIFT_SCHEDULE_OVERLAP',
        message: `Jadwal tumpang tindih: shift ${shift.shiftCode} (${shift.startTime}–${shift.endTime}) bentrok dengan ${otherShift.shiftCode} (${otherShift.startTime}–${otherShift.endTime}) di lini ${lineId} hari ke-${dayOfWeek}.`,
        httpStatus: 409,
      });
    }
  }
}

export function checkAbort(signal?: AbortSignal) {
  if (signal?.aborted) {
    throw new DOMException('Aborted', 'AbortError');
  }
}

/**
 * Guard sesi demo. Opsi `skipRotationGate` dipakai jalur auth sendiri
 * (changePassword / getAuthMe / refresh) — gerbang rotasi TIDAK memblokir
 * ketiganya (§L: GET /auth/me tetap 200 saat gerbang aktif).
 */
export function assertAuthenticated(options: { skipRotationGate?: boolean } = {}) {
  if (!store.isAuthenticated || !store.authToken) {
    const err = new ApiError({
      code: 'UNAUTHORIZED',
      message: 'Token Bearer operator tidak ditemukan atau sesi telah berakhir.',
      httpStatus: 401,
    });
    store.hooks.onUnauthorized?.(err.message);
    throw err;
  }
  const activeActor = store.operators.find((o) => o.operator_id === store.currentUserId);
  if (!activeActor || !activeActor.is_active) {
    store.isAuthenticated = false;
    store.authToken = null;
    const err = new ApiError({
      code: 'SUBJECT_INACTIVE',
      message: 'Akun operator nonaktif (SUBJECT_INACTIVE). Silakan hubungi administrator.',
      httpStatus: 401,
    });
    store.hooks.onUnauthorized?.(err.message);
    throw err;
  }
  if (store.tokenAuthzVersion < store.iamInfo.authzVersion) {
    store.isAuthenticated = false;
    store.authToken = null;
    const err = new ApiError({
      code: 'AUTHZ_STALE',
      message: 'Hak akses akun berubah (AUTHZ_STALE). Silakan login ulang.',
      httpStatus: 401,
    });
    store.hooks.onUnauthorized?.(err.message);
    throw err;
  }
  // Spec 043 (§L): gerbang ganti-password-wajib — rute terproteksi menolak
  // dengan 403 PASSWORD_ROTATION_REQUIRED selama flag aktif.
  if (!options.skipRotationGate && store.operatorMustChangePassword.has(store.currentUserId)) {
    const err = new ApiError({
      code: 'PASSWORD_ROTATION_REQUIRED',
      message: 'Password sementara wajib diganti sebelum melanjutkan (PASSWORD_ROTATION_REQUIRED).',
      httpStatus: 403,
    });
    store.hooks.onPasswordRotationRequired?.();
    throw err;
  }
}

/**
 * Guard tulis (D1 + mode akses Private/Public): mutasi hanya bila akses
 * efektif mengizinkan — LAN selalu boleh; tunnel hanya bila mode `public`.
 * Mode `private` (default) menolak dengan 403 + keputusan DENY tercatat.
 * Gating di sini hanya UX/pertahanan lapis pertama — backend WAJIB menegakkan
 * aturan yang sama di server (lihat docs/BACKEND_REQUIREMENTS_ACCESS_MODE.md).
 */
export function assertLanAccess(capability?: CapabilityKey, resourceId?: string) {
  const effective = resolveEffectiveAccess(store.networkAccessMode);
  if (!effective.canMutate) {
    const err = new ApiError({
      code: 'FORBIDDEN',
      message: effective.reason,
      httpStatus: 403,
    });
    if (capability) {
      store.addAuthzDecision('DENY', capability, resourceId ?? 'remote-tunnel', err.message);
      store.hooks.onForbidden?.(capability, resourceId, err.message);
    }
    throw err;
  }
}

/**
 * Pemetaan capability → (action, resourceType) kanonis (§3.4) untuk evaluasi
 * policy demo. Registry ini JUGA dipakai guard INERT_PERMISSION:
 * pasangan (action, resourceType) yang tidak ada di sini tidak punya rute
 * penjaga → 400 INERT_PERMISSION saat dibuat via POST /permissions.
 */
export const CAPABILITY_CASBIN_MAP: Partial<Record<CapabilityKey, { action: string; resourceType: string }>> = {
  'operational_event.ack': { action: 'ack', resourceType: 'operational_event' },
  'downtime_event.label': { action: 'label', resourceType: 'downtime_event' },
  'telemetry.refresh': { action: 'refresh', resourceType: 'telemetry' },
  'access_control.read': { action: 'read', resourceType: 'access_control' },
  'device.manage': { action: 'manage', resourceType: 'device' },
  'machine.manage': { action: 'manage', resourceType: 'machine' },
  // E20 P20.5 (FAT-157, pembaruan 09:23): authorize("create","machine").
  'machine.create': { action: 'create', resourceType: 'machine' },
  'product.manage': { action: 'manage', resourceType: 'product' },
  'operator.read': { action: 'read', resourceType: 'operator' },
  'operator.create': { action: 'create', resourceType: 'operator' },
  'operator.status.update': { action: 'update_status', resourceType: 'operator' },
  'operator.password.rotate': { action: 'rotate_password', resourceType: 'operator' },
  'operator.update': { action: 'update', resourceType: 'operator' },
  'operator.delete': { action: 'delete', resourceType: 'operator' },
  'work_order.cancel': { action: 'cancel', resourceType: 'work_order' },
  'telemetry.reconciliation.refresh': { action: 'refresh', resourceType: 'telemetry' },
  'access_control.manage': { action: 'manage', resourceType: 'access_control' },
  'mqtt.dynsec.read': { action: 'read', resourceType: 'mqtt_admin' },
  'mqtt.dynsec.manage': { action: 'manage', resourceType: 'mqtt_admin' },
  'mqtt.config.read': { action: 'read', resourceType: 'mqtt_configuration' },
  'mqtt.config.read_raw': { action: 'read_raw', resourceType: 'mqtt_configuration' },
  'mqtt.config.manage': { action: 'manage', resourceType: 'mqtt_configuration' },
  'mqtt.overview.read': { action: 'read', resourceType: 'mqtt_admin' },
};

export function matchesMappedPolicy(
  policyAction: string,
  policyResourcePattern: string,
  mapped: { action: string; resourceType: string },
  specificResourceKey?: string
): boolean {
  const qualifiedAction = `${mapped.action}:${mapped.resourceType}`;
  const actionOk =
    policyAction === '*' ||
    policyAction
      .split('|')
      .map((s) => s.trim())
      .some((part) => part === mapped.action || part === qualifiedAction);
  if (!actionOk) return false;

  return (
    policyResourcePattern === '*' ||
    policyResourcePattern === `${mapped.resourceType}:*` ||
    policyResourcePattern.endsWith(`:${mapped.resourceType}:*`) ||
    (specificResourceKey ? policyResourcePattern === specificResourceKey : false)
  );
}

export function assertCapability(
  capability: CapabilityKey,
  allowedRoles: UserRole[],
  options: { requireLan?: boolean; requireAuth?: boolean; resourceId?: string } = {}

) {
  const { requireLan = true, requireAuth = true, resourceId } = options;
  if (requireAuth) assertAuthenticated();
  if (requireLan) assertLanAccess(capability, resourceId);

  const actorAssignments = store.iamAssignments.filter((a) => a.operator_id === store.currentUserId);
  const orgAssignedRoles = actorAssignments
    .filter((a) => a.scope_type === 'ORGANIZATION')
    .map((a) => a.role_name);
  const effectiveRoleSet = new Set<string>([store.currentUserRole, ...orgAssignedRoles]);
  const baselineAllowed = allowedRoles.some((r) => effectiveRoleSet.has(r));

  let hasDynamicAllow = false;
  const mapped = CAPABILITY_CASBIN_MAP[capability];
  if (mapped) {
    const resourceKey = resourceId ? `${mapped.resourceType}:${resourceId}` : `${mapped.resourceType}:*`;
    const actor = store.operators.find((o) => o.operator_id === store.currentUserId);
    const abacEnv = {
      networkMode: store.networkAccessMode,
      subjectActive: actor?.is_active ?? true,
      actorLineId: store.currentUserLineId,
    };
    const casbinEval = evaluateCasbinAbacDecision({
      primaryRole: store.currentUserRole,
      assignments: actorAssignments,
      policies: store.iamPolicies,
      mode: store.iamInfo.mode,
      action: mapped.action,
      resourceKey,
      baselineAllowed,
      env: abacEnv,
      subjectId: store.currentUserId,
    });

    if (casbinEval.shadowMismatch) {
      store.addAuthzDecision(casbinEval.finalDecision, capability, resourceId ?? capability, casbinEval.reason);
    }

    if (store.iamInfo.mode === 'enforce') {
      let hasSpecificDeny = false;
      for (const p of store.iamPolicies) {
        if (!p.enabled) continue;
        if (
          !policyMatchesSubject(p.subjectMatch, { role: store.currentUserRole, operatorId: store.currentUserId }) &&
          !orgAssignedRoles.some((r) => policyMatchesSubject(p.subjectMatch, { role: r, operatorId: store.currentUserId }))
        ) {
          continue;
        }
        if (!matchesMappedPolicy(p.action, p.resourcePattern, mapped, resourceKey)) continue;
        const abac = matchAbacCondition(p.abacCondition, abacEnv);
        if (abac.malformed) {
          hasSpecificDeny = true;
          continue;
        }
        if (!abac.matched) continue;
        if (p.effect === 'DENY') {
          hasSpecificDeny = true;
        } else if (p.effect === 'ALLOW') {
          hasDynamicAllow = true;
        }
      }

      if (hasSpecificDeny) {
        const err = new ApiError({
          code: 'FORBIDDEN',
          message: `Ditolak oleh kebijakan akses "${capability}" pada resource "${resourceId ?? '*'}".`,
          httpStatus: 403,
        });
        store.addAuthzDecision('DENY', capability, resourceId ?? capability, err.message);
        store.hooks.onForbidden?.(capability, resourceId, err.message);
        throw err;
      }
    }
  }

  const effectiveAllowed = baselineAllowed || (store.iamInfo.mode === 'enforce' && hasDynamicAllow);

  if (!effectiveAllowed) {
    const err = new ApiError({
      code: 'FORBIDDEN',
      message: `Peran ${Array.from(effectiveRoleSet).join(', ')} tidak memiliki otorisasi "${capability}".`,
      httpStatus: 403,
    });
    store.addAuthzDecision('DENY', capability, resourceId ?? capability, err.message);
    store.hooks.onForbidden?.(capability, resourceId, err.message);
    throw err;
  }

  if (!baselineAllowed && hasDynamicAllow) {
    store.addAuthzDecision('ALLOW', capability, resourceId ?? capability, 'Diizinkan oleh policy role kustom.');
  }
}

export function throwValidationIssues(message: string, fieldErrors: Record<string, string>): never {
  throw new ApiError({
    code: 'VALIDATION_ERROR',
    message,
    httpStatus: 400,
    issues: Object.entries(fieldErrors).map(([field, msg]) => ({
      field,
      path: field,
      message: msg,
    })),
  });
}

export function enrichAndValidateDevice(dev: EdgeDevice): EdgeDevice {
  const machine = dev.bound_machine_id
    ? store.machines.find((m) => m.machine_id === dev.bound_machine_id)
    : store.machines.find((m) => m.bound_device_id === dev.device_id);
  return EdgeDeviceSchema.parse({
    ...dev,
    bound_machine_id: machine ? machine.machine_id : dev.bound_machine_id ?? null,
    bound_machine_name: machine ? machine.name : dev.bound_machine_name ?? null,
    boundMachine: machine
      ? {
          machine_id: machine.machine_id,
          name: machine.name,
          modbus_slave_id: machine.modbus_slave_id,
        }
      : null,
  });
}

export function enrichAndValidateMachine(machine: Machine): Machine {
  const dev = machine.bound_device_id
    ? store.devices.find((d) => d.device_id === machine.bound_device_id)
    : store.devices.find((d) => d.bound_machine_id === machine.machine_id);
  return MachineSchema.parse({
    ...machine,
    bound_device_id: dev ? dev.device_id : machine.bound_device_id ?? null,
    boundDevice: dev
      ? {
          device_id: dev.device_id,
          mac_address: dev.mac_address,
          ip_address: dev.ip_address,
          firmware_version: dev.firmware_version,
          online: dev.online,
          model: dev.model,
        }
      : null,
  });
}

export function generateTelemetrySeries(deviceId: string, count = 60): TelemetryHistoryRecord[] {
  const list: TelemetryHistoryRecord[] = [];
  const baseNow = Date.now();
  const targetDevice = deviceId || 'STM32-OEE-01';
  const isUnknownCapacity = targetDevice === 'STM32-OEE-05';
  for (let i = 0; i < count; i++) {
    let offsetMs: number;
    if (i < 12) {
      offsetMs = (i + 1) * 5 * 60_000;
    } else if (i < 36) {
      // Every ~3 hours for the past 3.5 days so WO correlation windows always contain samples
      offsetMs = (i - 10) * 3 * 3600_000;
    } else {
      offsetMs = (i - 32) * 2.1 * 24 * 3600_000;
    }
    const ts = new Date(baseNow - offsetMs).toISOString();
    const fsm = normalizeFsmState(
      isUnknownCapacity
        ? 'UNCONFIGURED'
        : i % 13 === 5
        ? 'PLANNED_DOWNTIME'
        : i % 9 === 3
        ? 'UNPLANNED_DOWNTIME'
        : 'RUNNING'
    );
    const totalCount = isUnknownCapacity ? 0 : Math.max(20, 350 - i * 2);
    const rejectCount = isUnknownCapacity ? 0 : 8 + (i % 4);
    const goodCount = Math.max(0, totalCount - rejectCount);
    const operatingTimeSec = 3600;
    const downtimeSec = fsm === 'RUNNING' ? (i % 4) * 90 : 1200;
    const runTimeSec = Math.max(0, operatingTimeSec - downtimeSec);
    const lastCycleTimeSec = isUnknownCapacity ? null : Number((42.1 + ((i * 0.35) % 2)).toFixed(1));
    list.push({
      id: `tel-${targetDevice}-${String(i + 1).padStart(3, '0')}`,
      device_id: targetDevice,
      timestamp: ts,
      fsm_state: fsm,
      total_count: totalCount,
      good_count: goodCount,
      reject_count: rejectCount,
      totalCount,
      goodCount,
      rejectCount,
      operatingTimeSec,
      runTimeSec,
      downtimeSec,
      lastCycleTimeSec,
      oee: isUnknownCapacity ? 0 : Number((84.6 - (i % 5) * 1.4).toFixed(1)),
      availability: isUnknownCapacity ? 100 : Number((92.4 - (i % 3) * 1.1).toFixed(1)),
      performance: isUnknownCapacity ? 0 : 94.1,
      quality: isUnknownCapacity ? 100 : 97.4,
      cycle_time_ms: isUnknownCapacity ? 0 : 42100 + ((i * 350) % 2000),
      temperature_c: Number((48.2 + ((i * 0.3) % 4)).toFixed(1)),
      vibration_rms: Number((1.24 + ((i * 0.05) % 0.4)).toFixed(2)),
      is_buffered: i % 11 === 4,
    });
  }
  return list;
}

/**
 * Pareto reject per device — SATU keranjang `UNCLASSIFIED` per device, tanpa
 * kategori alasan. Perangkat OEE hanya punya 1 tombol Reject, jadi yang
 * tercatat di sumber hanyalah counter reject; tidak ada alasan yang bisa
 * didistribusikan. Ini sesuai API doc §R (FR-BIGR-001..003): sumber pareto
 * adalah delta `UNCLASSIFIED` per jendela, dan totalnya harus dapat
 * direkonsiliasi dengan `device_live_state.rejectCount` — karena itu count di
 * sini = `reject_count` live state per device di `seeds/monitoring.ts`
 * (STM32-OEE-01: 8, -02: 3, -03: 14; -04/-05: 0 → `[]`, tanpa data → `[]`).
 * JANGAN mengembalikan seed multi-alasan (mis. "Dimension Tolerance", dst.):
 * alasan semacam itu tidak pernah dihasilkan perangkat dan akan menampilkan
 * analisis cacat yang tidak pernah terjadi. Bila suatu hari klasifikasi
 * alasan benar-benar dibutuhkan, ia harus datang dari alur lain (mis.
 * klasifikasi QC di panel) — lihat AUDIT.md §12.
 */
export const REJECT_PARETO_BY_DEVICE: Record<string, RejectParetoItem[]> = {
  'STM32-OEE-01': [
    { reason: 'UNCLASSIFIED', count: 8, percentage: 100, cumulative_percentage: 100 },
  ],
  'STM32-OEE-02': [
    { reason: 'UNCLASSIFIED', count: 3, percentage: 100, cumulative_percentage: 100 },
  ],
  'STM32-OEE-03': [
    { reason: 'UNCLASSIFIED', count: 14, percentage: 100, cumulative_percentage: 100 },
  ],
  'STM32-OEE-04': [],
  'STM32-OEE-05': [],
};
