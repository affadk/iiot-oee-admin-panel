/**
 * BARREL — komposisi demoIam per domain (tanpa logika bisnis).
 *
 * Dipisah dari file 694 baris pada E20 P20.3 (FAT-155), mengikuti pola
 * R9.2 (kontrak docs/DIRECTORY_STRUCTURE.md). Urutan method sama seperti
 * sebelumnya: roles/permissions/user-roles → policies/effective/audit.
 */
import { demoIamRoles } from './iam/roles';
import { demoIamPolicies } from './iam/policies';

export const demoIam = {
  ...demoIamRoles,
  ...demoIamPolicies,
};
