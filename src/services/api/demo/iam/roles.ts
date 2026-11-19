/**
 * Method demo — domain IAM: roles, permissions, user-roles.
 *
 * Dipisah dari demo/iam.ts (694 baris) pada E20 P20.3 (FAT-155), mengikuti
 * pola R9.2 (kontrak docs/DIRECTORY_STRUCTURE.md). Barrel penggabung ada di
 * demo/iam.ts.
 *
 * E20 P20.3: hanya ADMIN immutable (403 ROLE_IMMUTABLE); revoke idempoten
 * {success, removed:0}; createIamPermission diizinkan dengan guard
 * INERT_PERMISSION / PERMISSION_EXISTS; baca IAM digate access_control.read.
 */
import { store } from '../store';
import { checkAbort, assertCapability, throwValidationIssues, CAPABILITY_CASBIN_MAP } from '../helpers';
import { ADMIN_ENDPOINTS } from '../../endpoints';
import { IamInfo, IamRole, IamPermission, IamAssignment, ScopeLevel } from '../../../../types/iam';
import { ApiError } from '../../../../types/auth';
import { CAPABILITY_SPECS, CapabilityKey, VALIDATION_PATTERNS, isReservedPermission, isAdminRoleName } from '../../../../utils/capabilities';
import { IamAssignmentSchema, IamPermissionSchema, IamRoleSchema } from '../../schemas';

/**
 * Pasangan (action, resourceType) yang punya rute penjaga — registry guard
 * INERT_PERMISSION (§3.4): POST /permissions dengan pasangan di luar
 * registry ini → 400 INERT_PERMISSION. Diturunkan dari CAPABILITY_SPECS
 * (kunci `<resource>.<action>`) + CAPABILITY_CASBIN_MAP, dengan pemetaan
 * khusus untuk kunci 3-segmen.
 */
const MULTI_PART_CAPABILITY_ACTIONS: Partial<Record<CapabilityKey, { action: string; resourceType: string }>> = {
  'operator.status.update': { action: 'update_status', resourceType: 'operator' },
  'operator.password.rotate': { action: 'rotate_password', resourceType: 'operator' },
  'mqtt.config.read_raw': { action: 'read_raw', resourceType: 'mqtt_configuration' },
  'telemetry.reconciliation.refresh': { action: 'refresh', resourceType: 'telemetry' },
};

function buildGuardedPermissionPairs(): Set<string> {
  const pairs = new Set<string>();
  for (const mapped of Object.values(CAPABILITY_CASBIN_MAP)) {
    if (mapped) pairs.add(`${mapped.action}:${mapped.resourceType}`);
  }
  for (const key of Object.keys(CAPABILITY_SPECS) as CapabilityKey[]) {
    const special = MULTI_PART_CAPABILITY_ACTIONS[key];
    if (special) {
      pairs.add(`${special.action}:${special.resourceType}`);
      continue;
    }
    const parts = key.split('.');
    if (parts.length === 2) pairs.add(`${parts[1]}:${parts[0]}`);
  }
  return pairs;
}

const GUARDED_PERMISSION_PAIRS = buildGuardedPermissionPairs();

export const demoIamRoles = {
  // =========================================================================
  // ACCESS CONTROL / IAM (18 Authoritative Operations — ADMIN + LAN ONLY)
  // =========================================================================
  async getIamInfo(signal?: AbortSignal): Promise<IamInfo> {
    checkAbort(signal);
    assertCapability('access_control.read', ['ADMIN']);
    store.recordEndpoint('IAM_INFO', ADMIN_ENDPOINTS.IAM_INFO.buildPath());
    return { ...store.iamInfo };
  },

  async getIamRoles(signal?: AbortSignal): Promise<IamRole[]> {
    checkAbort(signal);
    assertCapability('access_control.read', ['ADMIN']);
    store.recordEndpoint('IAM_ROLES_LIST', ADMIN_ENDPOINTS.IAM_ROLES_LIST.buildPath());
    return store.iamRoles.map((r) => IamRoleSchema.parse({ ...r }));
  },

  async createIamRole(data: { name: string; description: string }): Promise<IamRole> {
    assertCapability('access_control.manage', ['ADMIN']);
    const trimmedName = data.name.trim();
    const trimmedDesc = data.description.trim();
    const fieldErrors: Record<string, string> = {};

    if (!VALIDATION_PATTERNS.IAM_ROLE_NAME.test(trimmedName)) {
      fieldErrors.name = 'Nama role wajib diawali huruf, panjang 2–64 karakter (huruf, angka, "_", "-").';
    }
    if (trimmedDesc.length < 3 || trimmedDesc.length > 256) {
      fieldErrors.description = 'Deskripsi role wajib 3–256 karakter.';
    }
    if (Object.keys(fieldErrors).length > 0) {
      throwValidationIssues('Validasi pembuatan custom role gagal.', fieldErrors);
    }

    store.recordEndpoint('IAM_ROLES_CREATE', ADMIN_ENDPOINTS.IAM_ROLES_CREATE.buildPath());
    // §3.4: hanya ADMIN yang immutable/reserved — preset lain boleh dibuat
    // ulang bila sudah dihapus.
    if (isAdminRoleName(trimmedName)) {
      throw new ApiError({
        code: 'FORBIDDEN',
        message: 'Nama "ADMIN" dicadangkan (immutable) dan tidak dapat dibuat ulang.',
        httpStatus: 403,
      });
    }
    if (store.iamRoles.some((r) => r.name.toUpperCase() === trimmedName.toUpperCase())) {
      throw new ApiError({ code: 'CONFLICT', message: `Role "${trimmedName}" sudah ada.`, httpStatus: 409 });
    }

    const newRole: IamRole = IamRoleSchema.parse({
      id: `role-${Date.now().toString().slice(-4)}-${Math.floor(Math.random() * 100)}`,
      name: trimmedName,
      is_system: false,
      description: trimmedDesc,
      created_at: new Date().toISOString(),
    });
    store.iamRoles.push(newRole);
    store.iamInfo.authzVersion += 1;
    store.tokenAuthzVersion = store.iamInfo.authzVersion;
    store.addAudit('CREATE_ROLE', 'IAM', newRole.id, `Created custom IAM role ${newRole.name}`);
    return { ...newRole };
  },

  async updateIamRole(
    roleId: string,
    patch: { description?: string }
  ): Promise<IamRole> {
    assertCapability('access_control.manage', ['ADMIN'], { resourceId: roleId });
    store.recordEndpoint('IAM_ROLES_UPDATE', ADMIN_ENDPOINTS.IAM_ROLES_UPDATE.buildPath(roleId));
    const role = store.iamRoles.find((r) => r.id === roleId);
    if (!role) throw new ApiError({ code: 'NOT_FOUND', message: 'Role tidak ditemukan.', httpStatus: 404 });
    if (role.is_system || isAdminRoleName(role.name)) {
      throw new ApiError({
        code: 'ROLE_IMMUTABLE',
        message: 'Role ADMIN immutable dan tidak dapat diubah.',
        httpStatus: 403,
      });
    }
    const fieldErrors: Record<string, string> = {};
    if (patch.description !== undefined && (patch.description.trim().length < 3 || patch.description.trim().length > 256)) {
      fieldErrors.description = 'Deskripsi role wajib 3–256 karakter.';
    }
    if (Object.keys(fieldErrors).length > 0) {
      throwValidationIssues('Validasi pembaruan role gagal.', fieldErrors);
    }
    if (patch.description !== undefined) role.description = patch.description.trim();
    store.addAudit('UPDATE_ROLE', 'IAM', roleId, `Updated IAM role ${role.name}`);
    return IamRoleSchema.parse({ ...role });
  },

  async deleteIamRole(roleId: string): Promise<{ success: boolean }> {
    assertCapability('access_control.manage', ['ADMIN'], { resourceId: roleId });
    store.recordEndpoint('IAM_ROLES_DELETE', ADMIN_ENDPOINTS.IAM_ROLES_DELETE.buildPath(roleId));
    const role = store.iamRoles.find((r) => r.id === roleId);
    if (!role) throw new ApiError({ code: 'NOT_FOUND', message: 'Role tidak ditemukan.', httpStatus: 404 });
    if (role.is_system || isAdminRoleName(role.name)) {
      throw new ApiError({
        code: 'ROLE_IMMUTABLE',
        message: 'Role ADMIN immutable dan tidak dapat dihapus.',
        httpStatus: 403,
      });
    }
    const activeAssignments = store.iamAssignments.filter(
      (a) => a.role_id === roleId || a.role_name === role.name
    );
    if (activeAssignments.length > 0) {
      throw new ApiError({
        code: 'ROLE_IN_USE',
        message: `Role "${role.name}" masih ter-assign ke operator ${activeAssignments[0].operator_id}. Cabut penugasan user terlebih dahulu sebelum menghapus role.`,
        httpStatus: 409,
      });
    }
    const remainingPolicies = store.iamPolicies.filter((p) => p.roleId === roleId);
    if (remainingPolicies.length > 0) {
      // §3.4: role masih punya policy → 409 ROLE_IN_USE. Policy TIDAK dihapus
      // diam-diam (perilaku lama dihapus, E20 P20.3).
      throw new ApiError({
        code: 'ROLE_IN_USE',
        message: `Role "${role.name}" masih memiliki ${remainingPolicies.length} policy. Hapus policy role terlebih dahulu sebelum menghapus role.`,
        httpStatus: 409,
      });
    }
    store.iamRoles = store.iamRoles.filter((r) => r.id !== roleId);
    store.iamInfo.authzVersion += 1;
    store.tokenAuthzVersion = store.iamInfo.authzVersion;
    store.addAudit('DELETE_ROLE', 'IAM', roleId, `Deleted custom IAM role ${role.name}`);
    return { success: true };
  },

  async addIamRolePermission(
    roleId: string,
    permissionId: string,
    options?: {
      resourcePattern?: string;
      effect?: 'ALLOW' | 'DENY';
      abacCondition?: Record<string, unknown> | null;
    }
  ): Promise<{ success: boolean }> {
    assertCapability('access_control.manage', ['ADMIN'], { resourceId: roleId });
    store.recordEndpoint('IAM_ROLE_PERMISSIONS_ADD', ADMIN_ENDPOINTS.IAM_ROLE_PERMISSIONS_ADD.buildPath(roleId));
    const role = store.iamRoles.find((r) => r.id === roleId);
    const perm = store.iamPermissions.find((p) => p.id === permissionId);
    if (!role || !perm) {
      throw new ApiError({ code: 'NOT_FOUND', message: 'Role atau permission tidak ditemukan.', httpStatus: 404 });
    }
    const effect = options?.effect ?? 'ALLOW';
    if (role.name === 'ADMIN' && effect === 'DENY') {
      throw new ApiError({
        code: 'FORBIDDEN',
        message: 'Anti-Lockout Guard: Policy DENY pada role ADMIN dilarang.',
        httpStatus: 403,
      });
    }
    if (!role.is_system && isReservedPermission(perm.action, perm.resourceType)) {
      throw new ApiError({
        code: 'PRIVILEGE_ESCALATION_DENIED',
        message: `Permission "${perm.action}:${perm.resourceType}" adalah reserved permission yang tidak boleh di-assign ke custom role.`,
        httpStatus: 403,
      });
    }
    const resourcePattern = options?.resourcePattern?.trim() || `${perm.resourceType}:*`;
    if (resourcePattern.length < 1 || resourcePattern.length > 128) {
      throwValidationIssues('Resource pattern wajib 1–128 karakter.', {
        resourcePattern: 'Panjang 1–128 karakter.',
      });
    }
    if (!role.is_system && effect === 'ALLOW' && (resourcePattern === '*' || resourcePattern === 'org:*')) {
      throw new ApiError({
        code: 'PRIVILEGE_ESCALATION_DENIED',
        message: 'Custom role tidak boleh diberikan wildcard resource pattern (*).',
        httpStatus: 403,
      });
    }
    const duplicate = store.iamPolicies.some(
      (p) =>
        p.roleId === role.id &&
        p.permissionId === perm.id &&
        p.resourcePattern === resourcePattern &&
        p.effect === effect
    );
    if (duplicate) {
      throw new ApiError({
        code: 'DUPLICATE_ROLE_PERMISSION',
        message: `Permission "${perm.action}:${perm.resourceType}" (${effect} · ${resourcePattern}) sudah terpasang pada role "${role.name}".`,
        httpStatus: 409,
      });
    }
    store.iamPolicies.push({
      id: `pol-${Date.now().toString().slice(-4)}-${Math.floor(Math.random() * 100)}`,
      roleId: role.id,
      roleName: role.name,
      subjectMatch: `role:${role.name}`,
      permissionId: perm.id,
      action: perm.action,
      resourceType: perm.resourceType,
      resourcePattern,
      effect,
      abacCondition: options?.abacCondition ?? null,
      enabled: true,
      createdAt: new Date().toISOString(),
    });
    store.iamInfo.authzVersion += 1;
    store.tokenAuthzVersion = store.iamInfo.authzVersion;
    store.addAudit(
      'ADD_ROLE_PERMISSION',
      'IAM',
      roleId,
      `Assigned ${effect} ${perm.action}:${perm.resourceType} (${resourcePattern}) to ${role.name}`
    );
    return { success: true };
  },

  async removeIamRolePermission(roleId: string, permissionId: string): Promise<{ success: boolean }> {
    assertCapability('access_control.manage', ['ADMIN'], { resourceId: roleId });
    store.recordEndpoint(
      'IAM_ROLE_PERMISSIONS_DELETE',
      ADMIN_ENDPOINTS.IAM_ROLE_PERMISSIONS_DELETE.buildPath(roleId, permissionId)
    );
    const role = store.iamRoles.find((r) => r.id === roleId);
    if (!role) {
      throw new ApiError({ code: 'NOT_FOUND', message: 'Role tidak ditemukan.', httpStatus: 404 });
    }
    if (role.name === 'ADMIN') {
      throw new ApiError({
        code: 'FORBIDDEN',
        message: 'Anti-Lockout Guard: Menghapus permission dari role ADMIN dilarang.',
        httpStatus: 403,
      });
    }
    const existingCount = store.iamPolicies.filter(
      (p) => p.roleId === roleId && p.permissionId === permissionId
    ).length;
    if (existingCount === 0) {
      throw new ApiError({
        code: 'NOT_FOUND',
        message: 'Ikatan permission pada role tersebut tidak ditemukan.',
        httpStatus: 404,
      });
    }
    store.iamPolicies = store.iamPolicies.filter(
      (p) => !(p.roleId === roleId && p.permissionId === permissionId)
    );
    store.iamInfo.authzVersion += 1;
    store.tokenAuthzVersion = store.iamInfo.authzVersion;
    store.addAudit(
      'REMOVE_ROLE_PERMISSION',
      'IAM',
      roleId,
      `Revoked permission ${permissionId} from role ${role.name}`
    );
    return { success: true };
  },

  async getIamPermissions(signal?: AbortSignal): Promise<IamPermission[]> {
    checkAbort(signal);
    assertCapability('access_control.read', ['ADMIN']);
    store.recordEndpoint('IAM_PERMISSIONS_LIST', ADMIN_ENDPOINTS.IAM_PERMISSIONS_LIST.buildPath());
    return store.iamPermissions.map((p) => IamPermissionSchema.parse({ ...p }));
  },

  /**
   * §3.4: POST /permissions diizinkan — pasangan (action, resourceType)
   * wajib punya rute penjaga (400 INERT_PERMISSION), duplikat → 409
   * PERMISSION_EXISTS. Penolakan lama PERMISSION_CATALOG_READ_ONLY DIHAPUS.
   */
  async createIamPermission(data: Omit<IamPermission, 'id'>): Promise<IamPermission> {
    assertCapability('access_control.manage', ['ADMIN']);
    store.recordEndpoint('IAM_PERMISSIONS_CREATE', ADMIN_ENDPOINTS.IAM_PERMISSIONS_CREATE.buildPath());
    const action = data.action.trim();
    const resourceType = data.resourceType.trim();
    const fieldErrors: Record<string, string> = {};
    if (!action || action.length > 64) fieldErrors.action = 'Action wajib 1–64 karakter.';
    if (!resourceType || resourceType.length > 64) fieldErrors.resourceType = 'ResourceType wajib 1–64 karakter.';
    if (!data.description.trim() || data.description.trim().length > 256) fieldErrors.description = 'Deskripsi wajib 1–256 karakter.';
    if (Object.keys(fieldErrors).length > 0) {
      throwValidationIssues('Validasi pembuatan permission gagal.', fieldErrors);
    }
    if (store.iamPermissions.some((p) => p.action === action && p.resourceType === resourceType)) {
      throw new ApiError({
        code: 'PERMISSION_EXISTS',
        message: `Permission "${action}:${resourceType}" sudah ada di katalog.`,
        httpStatus: 409,
      });
    }
    if (!GUARDED_PERMISSION_PAIRS.has(`${action}:${resourceType}`)) {
      throw new ApiError({
        code: 'INERT_PERMISSION',
        message: `Pasangan "${action}:${resourceType}" tidak punya rute penjaga — permission tidak akan pernah dievaluasi (INERT_PERMISSION).`,
        httpStatus: 400,
      });
    }
    const newPerm: IamPermission = IamPermissionSchema.parse({
      id: `perm-${Date.now().toString().slice(-4)}-${Math.floor(Math.random() * 100)}`,
      action,
      resourceType,
      description: data.description.trim(),
    });
    store.iamPermissions.push(newPerm);
    store.iamInfo.authzVersion += 1;
    store.tokenAuthzVersion = store.iamInfo.authzVersion;
    store.addAudit('CREATE_PERMISSION', 'IAM', newPerm.id, `Created permission ${action}:${resourceType}`);
    return { ...newPerm };
  },

  async getIamUserRoles(signal?: AbortSignal): Promise<IamAssignment[]> {
    checkAbort(signal);
    assertCapability('access_control.read', ['ADMIN']);
    store.recordEndpoint('IAM_USER_ROLES_LIST', ADMIN_ENDPOINTS.IAM_USER_ROLES_LIST.buildPath());
    return store.iamAssignments.map((a) => IamAssignmentSchema.parse({ ...a }));
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
  },
};
