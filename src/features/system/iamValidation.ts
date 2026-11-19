export type AbacParseResult =
  | { ok: true; value: Record<string, unknown> | null }
  | { ok: false; error: string };

/**
 * Parse abac_condition dari teks JSON mentah. Menggantikan 3 salinan identik
 * di handleBindPermission / handleCreatePolicy / handleUpdatePolicy.
 * Teks kosong = tanpa syarat (null). Pesan error dipertahankan verbatim.
 */
export function parseAbacCondition(json: string): AbacParseResult {
  if (!json.trim()) return { ok: true, value: null };
  try {
    const parsed: unknown = JSON.parse(json.trim());
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      return {
        ok: false,
        error: 'abac_condition harus berupa objek JSON (mis. {"line_id": "LINE-01"}).',
      };
    }
    return { ok: true, value: parsed as Record<string, unknown> };
  } catch {
    return { ok: false, error: 'abac_condition wajib berupa JSON valid atau kosong.' };
  }
}

/**
 * Validasi deskripsi custom role (E20 P20.3: validasi level DIHAPUS —
 * `privilege_level` tidak ada lagi). Menggantikan 2 salinan di
 * handleCreateRole / handleUpdateRole.
 */
export function validateRoleDesc(desc: string): Record<string, string> {
  const errors: Record<string, string> = {};
  if (desc.trim().length < 3 || desc.trim().length > 256) {
    errors.description = 'Deskripsi wajib 3–256 karakter.';
  }
  return errors;
}
