/**
 * Method demo — domain IAM: user-roles: daftar / assign / revoke.
 *
 * Dipisah dari demo/iam/roles.ts (482 baris) pada E32.5 (FAT-286),
 * mengikuti pola R9.2 (kontrak docs/DIRECTORY_STRUCTURE.md). Satu file =
 * satu sub-domain. Barrel penggabung ada di file induknya (../roles.ts).
 */
import { store } from '../../store';
import { checkAbort, assertCapability, throwValidationIssues } from '../../helpers';
import { ADMIN_ENDPOINTS } from '../../../endpoints';
import { ApiError } from '../../../../../types/auth';
import { IamAssignment, ScopeLevel } from '../../../../../types/iam';
import { IamAssignmentSchema } from '../../../schemas';

export const demoIamRolesAssignments = {
  async getIamUserRoles(
    filters: { operatorId?: string } = {},
    signal?: AbortSignal,
  ): Promise<IamAssignment[]> {
    checkAbort(signal);
    assertCapability('access_control.read', ['ADMIN']);
    const qs = filters.operatorId ? `?operatorId=${encodeURIComponent(filters.operatorId)}` : '';
    store.recordEndpoint('IAM_USER_ROLES_LIST', `${ADMIN_ENDPOINTS.IAM_USER_ROLES_LIST.buildPath()}${qs}`);
    const all = store.iamAssignments.map((a) => IamAssignmentSchema.parse({ ...a }));
    // E28 Batch A (B17): filter server-side (paritas dengan HTTP) — bukan
    // saring client-side di pemanggil.
    return filters.operatorId ? all.filter((a) => a.operator_id === filters.operatorId) : all;
  },

  async assignIamUserRole(data: {
    operatorId: string;
    roleName: string;
    scopeType: ScopeLevel;
    scopeId?: string | null;
  }): Promise<IamAssignment> {
    assertCapability('access_control.manage', ['ADMIN'], { resourceId: data.operatorId });
    store.recordEndpoint('IAM_USER_ROLES_CREATE', ADMIN_ENDPOINTS.IAM_USER_ROLES_CREATE.buildPath());
    const op = store.operators.find((o) => o.operator_id === data.operatorId);
    const role = store.iamRoles.find((r) => r.name === data.roleName);
    if (!op || !role) {
      throw new ApiError({ code: 'NOT_FOUND', message: 'Operator atau Role tidak ditemukan.', httpStatus: 404 });
    }
    if (role.name === 'ADMIN' && store.currentUserRole !== 'ADMIN') {
      throw new ApiError({
        code: 'PRIVILEGE_ESCALATION_DENIED',
        message: 'Hanya ADMIN yang dapat memberikan penugasan role ADMIN.',
        httpStatus: 403,
      });
    }
    if (data.scopeType !== 'ORGANIZATION' && !data.scopeId?.trim()) {
      throwValidationIssues('scopeId wajib diisi untuk scope selain ORGANIZATION.', {
        scopeId: 'Scope ID wajib diisi.',
      });
    }
    const normalizedScopeId = data.scopeType === 'ORGANIZATION' ? null : (data.scopeId?.trim() ?? null);
    if (normalizedScopeId && normalizedScopeId.length > 64) {
      throwValidationIssues('Scope ID maksimal 64 karakter.', { scopeId: 'Maksimal 64 karakter.' });
    }
    const duplicate = store.iamAssignments.some(
      (a) =>
        a.operator_id === op.operator_id &&
        a.role_name === role.name &&
        a.scope_type === data.scopeType &&
        (a.scope_id ?? null) === normalizedScopeId
    );
    if (duplicate) {
      throw new ApiError({
        code: 'DUPLICATE_USER_ROLE',
        message: `Operator ${op.operator_id} sudah memiliki penugasan role ${role.name} pada scope ${data.scopeType}${normalizedScopeId ? ` (${normalizedScopeId})` : ''}.`,
        httpStatus: 409,
      });
    }

    const newAsg: IamAssignment = IamAssignmentSchema.parse({
      id: `asg-${Date.now().toString().slice(-4)}-${Math.floor(Math.random() * 100)}`,
      operator_id: op.operator_id,
      operator_name: op.name,
      role_id: role.id,
      role_name: role.name,
      scope_type: data.scopeType,
      scope_id: normalizedScopeId,
      created_at: new Date().toISOString(),
    });
    store.iamAssignments.push(newAsg);
    store.iamInfo.authzVersion += 1;
    store.tokenAuthzVersion = store.iamInfo.authzVersion;
    store.addAudit(
      'ASSIGN_USER_ROLE',
      'IAM',
      newAsg.id,
      `Assigned ${newAsg.role_name} to ${newAsg.operator_id} (${newAsg.scope_type})`
    );
    return { ...newAsg };
  },

  /**
   * §3.4: tanpa baris cocok → 200 `{success:true, removed:0}` (idempoten,
   * BUKAN 404).
   */
  async revokeIamUserRole(assignment: {
    id?: string;
    operatorId: string;
    roleName: string;
    scopeType: ScopeLevel;
    scopeId?: string | null;
  }): Promise<{ success: boolean; removed: number }> {
    assertCapability('access_control.manage', ['ADMIN'], { resourceId: assignment.operatorId });
    store.recordEndpoint('IAM_USER_ROLES_DELETE', ADMIN_ENDPOINTS.IAM_USER_ROLES_DELETE.buildPath());
    const targetOp = store.operators.find((o) => o.operator_id === assignment.operatorId);
    if ((targetOp?.is_protected || assignment.operatorId === 'ADM-001') && assignment.roleName === 'ADMIN') {
      throw new ApiError({
        code: 'PROTECTED_ACCOUNT',
        message: 'Anti-Lockout Guard: Role ADMIN pada ADM-001 tidak dapat dicabut.',
        httpStatus: 403,
      });
    }
    const matchesTarget = (a: IamAssignment) => {
      if (assignment.id && a.id === assignment.id) return true;
      return (
        a.operator_id === assignment.operatorId &&
        a.role_name === assignment.roleName &&
        a.scope_type === assignment.scopeType &&
        (a.scope_id ?? null) === (assignment.scopeId ?? null)
      );
    };
    const removed = store.iamAssignments.filter(matchesTarget).length;
    if (removed === 0) {
      return { success: true, removed: 0 };
    }
    store.iamAssignments = store.iamAssignments.filter((a) => !matchesTarget(a));
    store.iamInfo.authzVersion += 1;
    store.tokenAuthzVersion = store.iamInfo.authzVersion;
    store.addAudit(
      'REVOKE_USER_ROLE',
      'IAM',
      assignment.operatorId,
      `Revoked ${assignment.roleName} from ${assignment.operatorId}`
    );
    return { success: true, removed };
  }
};
