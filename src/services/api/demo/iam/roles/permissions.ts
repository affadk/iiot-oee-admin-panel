/**
 * Method demo — domain IAM: permissions: katalog + guard INERT_PERMISSION.
 *
 * Dipisah dari demo/iam/roles.ts (482 baris) pada E32.5 (FAT-286),
 * mengikuti pola R9.2 (kontrak docs/DIRECTORY_STRUCTURE.md). Satu file =
 * satu sub-domain. Barrel penggabung ada di file induknya (../roles.ts).
 */

import { store } from '../../store';
import { checkAbort, assertCapability, throwValidationIssues, CAPABILITY_CASBIN_MAP } from '../../helpers';
import { ADMIN_ENDPOINTS } from '../../../endpoints';
import { IamPermission } from '../../../../../types/iam';
import { ApiError } from '../../../../../types/auth';
import { CAPABILITY_SPECS, CapabilityKey } from '../../../../../utils/capabilities';
import { IamPermissionSchema } from '../../../schemas';

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

export const demoIamRolesPermissions = {
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
  }
};
