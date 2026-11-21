/**
 * Helper demo: guard auth/LAN/kapabilitas + validator umum.
 *
 * Dipisah dari demo/helpers.ts (415 baris) pada E32.5 (FAT-286), mengikuti
 * pola R9.2 (kontrak docs/DIRECTORY_STRUCTURE.md). Satu file = satu
 * sub-domain. Barrel penggabung ada di file induknya (../helpers.ts).
 */

import { store } from '../store';
import { UserRole, ApiError } from '../../../../types/auth';
import { CapabilityKey, evaluateCasbinAbacDecision, matchAbacCondition, policyMatchesSubject } from '../../../../utils/capabilities';
import { resolveEffectiveAccess } from '../../mode';

export interface AuthClientHooks {
  onUnauthorized?: (reason?: string) => void;
  onForbidden?: (capability: CapabilityKey, resourceId?: string, reason?: string) => void;
  /** Spec 043 (§L): gerbang ganti-password-wajib — 403 PASSWORD_ROTATION_REQUIRED. */
  onPasswordRotationRequired?: () => void;
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
