/**
 * Guard policy / subjek (Guide §3.4).
 *
 * E32.7 (FAT-288): dipindah dari utils/capabilities/specs.ts — satu
 * concern (pencocokan subjek + permission reserved) terpisah dari
 * tabel spesifikasi kapabilitas. Di-re-export lewat specs.ts supaya
 * impor langsung ('./specs', mis. casbin.ts) dan barrel
 * utils/capabilities tetap jalan tanpa perubahan.
 */

export const RESERVED_PERMISSIONS = [
  'manage:access_control',
  'manage:mqtt_admin',
  'manage:mqtt_configuration',
  'read_raw:mqtt_configuration',
] as const;

/**
 * Hanya ADMIN yang immutable/reserved (§3.4, FR-RL-002): SUPERVISOR /
 * OPERATOR / MAINTENANCE adalah preset opsional — bisa diubah/dihapus bila
 * tidak dipakai (E20 P20.3, X8). Hierarki level statis DIHAPUS (ROLE_LEVELS /
 * canManageTargetRole / CUSTOM_ROLE_MAX_LEVEL) — otorisasi peran adalah
 * string bebas + guard policy, bukan perbandingan level.
 */
export function isAdminRoleName(roleName: string): boolean {
  return roleName.trim().toUpperCase() === 'ADMIN';
}

export function isReservedPermission(action: string, resourceType: string): boolean {
  const normalizedAction = action.trim().toLowerCase();
  const normalizedRes = resourceType.trim().toLowerCase();

  if (normalizedAction === '*' || normalizedRes === '*' || normalizedRes === 'org:*') {
    return true;
  }

  const actionParts = normalizedAction.split('|').map((p) => p.trim()).filter(Boolean);
  for (const part of actionParts) {
    if (part === '*') return true;
    const key = part.includes(':') ? part : `${part}:${normalizedRes}`;
    if ((RESERVED_PERMISSIONS as readonly string[]).includes(key)) {
      return true;
    }
  }
  return false;
}

/**
 * Apakah pola subjek policy menargetkan ADMIN (atau semua subjek)?
 * Pola kanonis (§3.4): `*`, `role:<nama>`, `operator:<id>`; nama role polos
 * diterima sebagai alias `role:<nama>` (bentuk lama).
 */
export function policyTargetsAdmin(subjectMatch: string): boolean {
  const match = subjectMatch.trim();
  if (match === '*') return true;
  if (match.toLowerCase().startsWith('role:')) return match.slice(5).trim().toUpperCase() === 'ADMIN';
  if (match.toLowerCase().startsWith('operator:')) return match.slice(9).trim().toUpperCase() === 'ADM-001';
  return match.toUpperCase() === 'ADMIN';
}

/**
 * Apakah pola subjek policy berlaku untuk subjek ini? Pola kanonis (§3.4):
 * `*` → semua; `role:<nama>` → role itu; `operator:<id>` → operator itu.
 * Nama role polos diterima sebagai alias `role:<nama>` (bentuk lama).
 */
export function policyMatchesSubject(
  subjectMatch: string,
  subject: { role: string; operatorId?: string },
): boolean {
  const match = subjectMatch.trim();
  if (match === '*') return true;
  if (match.toLowerCase().startsWith('role:')) return match.slice(5).trim().toUpperCase() === subject.role.trim().toUpperCase();
  if (match.toLowerCase().startsWith('operator:')) return subject.operatorId !== undefined && match.slice(9).trim().toUpperCase() === subject.operatorId.trim().toUpperCase();
  return match.toUpperCase() === subject.role.trim().toUpperCase();
}
