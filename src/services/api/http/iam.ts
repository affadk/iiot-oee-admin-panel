/**
 * Method HTTP — domain iam. BARREL (FAT-285, E32.4).
 *
 * Dipisah dari satu file 401 baris menjadi modul per sub-domain di `iam/`
 * — tanpa mengubah perilaku apa pun — mengikuti pola demo
 * (`demo/iam/roles.ts` vs `demo/iam/policies.ts`, E20 P20.3):
 *
 *   - `iam/roles.ts` .... info, roles, permissions, user-roles
 *   - `iam/policies.ts` . policies, effective permissions, audit
 *
 * Semua impor lama (`./iam`, `httpIam`) tetap jalan lewat gabungan di
 * bawah ini. Urutan method sama seperti sebelumnya: roles/permissions/
 * user-roles → policies/effective/audit.
 *
 * E20 P20.3: baca IAM digate `access_control.read` (kunci terpisah dari
 * `access_control.manage` untuk tulis); body tulis policy/permission
 * camelCase (§3.4, spec 042) — TANPA `reason` di baris policy (hanya di audit
 * IAM); TANPA `privilege_level`/`policy_count`; revoke user-role idempoten.
 */
import { httpIamRoles } from './iam/roles';
import { httpIamPolicies } from './iam/policies';

export const httpIam = {
  ...httpIamRoles,
  ...httpIamPolicies,
};
