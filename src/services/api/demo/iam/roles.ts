/**
 * BARREL — komposisi demoIamRoles per sub-domain (tanpa logika bisnis).
 *
 * Dipisah dari file 482 baris pada E32.5 (FAT-286), mengikuti pola
 * R9.2 (kontrak docs/DIRECTORY_STRUCTURE.md). Urutan method sama seperti
 * sebelumnya: crud → rolePermissions → permissions → assignments.
 */
import { demoIamRolesCrud } from './roles/crud';
import { demoIamRolesRolePermissions } from './roles/rolePermissions';
import { demoIamRolesPermissions } from './roles/permissions';
import { demoIamRolesAssignments } from './roles/assignments';

export const demoIamRoles = {
  ...demoIamRolesCrud,
  ...demoIamRolesRolePermissions,
  ...demoIamRolesPermissions,
  ...demoIamRolesAssignments,
};
