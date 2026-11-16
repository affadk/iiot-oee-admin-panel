import { CUSTOM_ROLE_MAX_LEVEL } from '../../utils/capabilities';

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
 * Validasi level + deskripsi custom role. Menggantikan 2 salinan di
 * handleCreateRole / handleUpdateRole. Pesan level berbeda per varian dan
 * dipertahankan verbatim: create memakai "Level custom role wajib bilangan
 * bulat …", update memakai "Privilege level custom role wajib …".
 */
export function validateRoleLevelDesc(
  level: number,
  desc: string,
  variant: 'create' | 'update' = 'create',
): Record<string, string> {
  const errors: Record<string, string> = {};
  if (!Number.isInteger(Number(level)) || Number(level) > CUSTOM_ROLE_MAX_LEVEL || Number(level) < 1) {
    errors.privilege_level =
      variant === 'create'
        ? `Level custom role wajib bilangan bulat 1–${CUSTOM_ROLE_MAX_LEVEL}.`
        : `Privilege level custom role wajib 1–${CUSTOM_ROLE_MAX_LEVEL}.`;
  }
  if (desc.trim().length < 3 || desc.trim().length > 256) {
    errors.description = 'Deskripsi wajib 3–256 karakter.';
  }
  return errors;
}
