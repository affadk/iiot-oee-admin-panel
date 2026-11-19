/**
 * Method demo — domain auth.
 *
 * Dipisah dari file god-file pada refactoring R9 (kontrak docs/DIRECTORY_STRUCTURE.md).
 * Satu file = satu domain. Barrel penggabung ada di file induknya.
 */
import { store } from './store';
import { checkAbort, assertAuthenticated, assertLanAccess, CAPABILITY_CASBIN_MAP, matchesMappedPolicy, throwValidationIssues } from './helpers';
import { ADMIN_ENDPOINTS } from '../endpoints';
import { Operator } from '../../../types/production';
import { LoginResponse, AuthMeResponse, ApiError } from '../../../types/auth';
import { CAPABILITY_SPECS, CapabilityKey, buildAuthMeCapabilities, matchAbacCondition, policyMatchesSubject } from '../../../utils/capabilities';
import { AuthMeResponseSchema, LoginResponseSchema, RefreshResponseSchema } from '../schemas';
import { resolveAuthTtlFallbackSec } from '../mode';

export const demoAuth = {
  // =========================================================================
  // AUTHENTICATION (4 ops)
  // =========================================================================
  async login(operator_id: string, password?: string, station_id?: string): Promise<LoginResponse> {
    if (store.networkAccessMode === 'REMOTE_TUNNEL') {
      assertLanAccess(undefined, 'auth/login');
    }
    store.recordEndpoint('AUTH_LOGIN', ADMIN_ENDPOINTS.AUTH_LOGIN.buildPath());
    const op = store.operators.find((o) => o.operator_id === operator_id.trim());
    if (!op || !op.is_active) {
      throw new ApiError({
        code: 'UNAUTHORIZED',
        message: 'ID Operator tidak ditemukan atau akun sedang nonaktif.',
        httpStatus: 401,
      });
    }
    const storedPassword = store.operatorPasswords.get(op.operator_id);
    if (storedPassword !== undefined) {
      if (password !== storedPassword) {
        throw new ApiError({
          code: 'UNAUTHORIZED',
          message: 'ID atau password salah.',
          httpStatus: 401,
        });
      }
    } else if (password !== undefined && password.trim().length < 8) {
      // §L: password login minimal 8 karakter (fallback min 4 DIHAPUS, E20 P20.3).
      throw new ApiError({
        code: 'UNAUTHORIZED',
        message: 'ID atau password salah.',
        httpStatus: 401,
      });
    }
    store.currentUserId = op.operator_id;
    store.currentUserName = op.name;
    store.currentUserRole = op.role;
    store.currentUserLineId = op.line_id;
    store.isAuthenticated = true;
    store.tokenAuthzVersion = store.iamInfo.authzVersion;
    store.authToken = `mem_jwt_${Date.now()}_${op.operator_id}`;
    store.addAuthzDecision('ALLOW', 'auth:login', ADMIN_ENDPOINTS.AUTH_LOGIN.buildPath());
    store.addAudit(
      'AUTH_LOGIN',
      'OPERATOR',
      op.operator_id,
      `Operator authenticated via LAN${station_id ? ` at station ${station_id}` : ''}`
    );
    return LoginResponseSchema.parse({
      success: true,
      token: `mem_jwt_${Date.now()}_${op.operator_id}`,
      expires_in: resolveAuthTtlFallbackSec(),
      operator: {
        id: op.operator_id,
        username: op.name,
        role: op.role,
        line_id: op.line_id,
        // Spec 043 (§L): flag gerbang ganti-password-wajib.
        must_change_password: store.operatorMustChangePassword.has(op.operator_id),
      },
    });
  },

  async refreshSession(): Promise<{ token: string; expires_in: number; authz_version: number }> {
    // Refresh TIDAK diblokir gerbang rotasi (§L) — token baru tetap diterbitkan.
    assertAuthenticated({ skipRotationGate: true });
    assertLanAccess(undefined, 'auth/refresh');
    store.recordEndpoint('AUTH_REFRESH', ADMIN_ENDPOINTS.AUTH_REFRESH.buildPath());
    store.tokenAuthzVersion = store.iamInfo.authzVersion;
    store.authToken = `mem_jwt_refresh_${Date.now()}`;
    const parsed = RefreshResponseSchema.parse({
      success: true,
      token: `mem_jwt_refresh_${Date.now()}`,
      expires_in: resolveAuthTtlFallbackSec(),
    });
    return {
      token: parsed.token,
      expires_in: parsed.expires_in,
      authz_version: store.iamInfo.authzVersion,
    };
  },

  async changePassword(currentPassword: string, newPassword: string): Promise<{ success: boolean; message: string }> {
    // Ganti password TIDAK diblokir gerbang rotasi — justru jalurnya (§L).
    assertAuthenticated({ skipRotationGate: true });
    assertLanAccess(undefined, 'auth/password/change');
    store.recordEndpoint('AUTH_CHANGE_PASSWORD', ADMIN_ENDPOINTS.AUTH_CHANGE_PASSWORD.buildPath());
    if (!currentPassword || currentPassword.trim().length === 0) {
      throwValidationIssues('Password saat ini wajib diisi.', { current_password: 'Wajib diisi.' });
    }
    const existingPassword = store.operatorPasswords.get(store.currentUserId);
    if (existingPassword !== undefined && currentPassword !== existingPassword) {
      throw new ApiError({
        code: 'UNAUTHORIZED',
        message: 'Password saat ini salah.',
        httpStatus: 401,
      });
    }
    if (!newPassword || newPassword.length < 8) {
      throwValidationIssues('Password baru minimal 8 karakter.', {
        new_password: 'Password baru minimal 8 karakter.',
      });
    }
    store.operatorPasswords.set(store.currentUserId, newPassword);
    // Sukses ganti password menutup gerbang rotasi (spec 043).
    store.operatorMustChangePassword.delete(store.currentUserId);
    store.addAudit('PASSWORD_CHANGED', 'OPERATOR', store.currentUserId, 'Operator mengganti password sendiri via LAN');
    return { success: true, message: 'Password berhasil diperbarui.' };
  },

  async getAuthMe(signal?: AbortSignal): Promise<AuthMeResponse> {
    checkAbort(signal);
    // GET /auth/me tetap 200 saat gerbang rotasi aktif (§L).
    assertAuthenticated({ skipRotationGate: true });
    store.recordEndpoint('AUTH_ME', ADMIN_ENDPOINTS.AUTH_ME.buildPath());

    const roleAssignments = store.iamAssignments.filter((a) => a.operator_id === store.currentUserId);
    const effectiveRoles =
      roleAssignments.length > 0
        ? roleAssignments.map((a) => ({
            roleName: a.role_name,
            scopeType: a.scope_type,
            scopeId: a.scope_id,
          }))
        : [{ roleName: store.currentUserRole, scopeType: 'ORGANIZATION', scopeId: null }];
    const hasNonOrgScope = effectiveRoles.some((r) => r.scopeType !== 'ORGANIZATION');

    const capabilities = buildAuthMeCapabilities(store.currentUserRole, hasNonOrgScope, store.iamInfo.mode);

    // Reflect explicit active DENY and ALLOW policies (including custom roles) when mode === 'enforce'
    if (store.iamInfo.mode === 'enforce') {
      const effectiveRoleNames = new Set([
        store.currentUserRole,
        ...roleAssignments.filter((a) => a.scope_type === 'ORGANIZATION').map((a) => a.role_name),
      ]);
      const abacEnv = {
        networkMode: store.networkAccessMode,
        subjectActive: true,
        actorLineId: store.currentUserLineId,
      };
      (Object.entries(CAPABILITY_CASBIN_MAP) as Array<[CapabilityKey, { action: string; resourceType: string }]>).forEach(
        ([capKey, mapped]) => {
          const matchingPolicies = store.iamPolicies.filter(
            (p) =>
              p.enabled &&
              [...effectiveRoleNames].some((r) => policyMatchesSubject(p.subjectMatch, { role: r, operatorId: store.currentUserId })) &&
              matchesMappedPolicy(p.action, p.resourcePattern, mapped)
          );
          const matchingDeny = matchingPolicies.find((p) => p.effect === 'DENY');
          if (matchingDeny) {
            capabilities[capKey] = matchingDeny.abacCondition ? 'unknown' : 'deny';
            return;
          }
          if (capabilities[capKey] === 'deny') {
            const matchingAllow = matchingPolicies.find((p) => {
              if (p.effect !== 'ALLOW') return false;
              const abac = matchAbacCondition(p.abacCondition, abacEnv);
              return !abac.malformed && abac.matched;
            });
            if (matchingAllow) {
              const hasAbacOrScope = Boolean(matchingAllow.abacCondition) || CAPABILITY_SPECS[capKey].attributeDependent;
              capabilities[capKey] = hasAbacOrScope ? 'unknown' : 'allow';
            }
          }
        }
      );
    }

    const currentOperator = store.operators.find((o) => o.operator_id === store.currentUserId);
    return AuthMeResponseSchema.parse({
      operator: {
        operator_id: store.currentUserId,
        name: store.currentUserName,
        role: store.currentUserRole,
        line_id: store.currentUserLineId,
        isActive: currentOperator?.is_active,
        isProtected: currentOperator?.is_protected,
        mustChangePassword: store.operatorMustChangePassword.has(store.currentUserId),
      },
      primaryRole: store.currentUserRole,
      effectiveRoles,
      authzVersion: store.iamInfo.authzVersion,
      mode: store.iamInfo.mode,
      capabilities,
      attributes: {
        'subject.line_id': store.currentUserLineId,
        'subject.role': store.currentUserRole,
        'subject.operator_id': store.currentUserId,
      },
    });
  }
};
