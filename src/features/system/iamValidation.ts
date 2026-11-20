export type AbacParseResult =
  | { ok: true; value: Record<string, unknown> | undefined }
  | { ok: false; error: string };

/**
 * Parse abac_condition dari teks JSON mentah. Menggantikan 3 salinan identik
 * di handleBindPermission / handleCreatePolicy / handleUpdatePolicy.
 *
 * E28 Batch A (FAT-229 MUT-03): teks kosong = tanpa syarat → `undefined`
 * (field DI-OMIT saat kirim), BUKAN null — server menolak
 * `abacCondition: null` pada POST (spec: optional record, bukan nullable).
 * Nilai null eksplisit (hapus kondisi) hanya dipakai jalur PUT — pemanggil
 * yang membutuhkannya (updatePolicy) yang mengubah undefined → null bila
 * policy sebelumnya memang punya kondisi. Pesan error dipertahankan verbatim.
 */
export function parseAbacCondition(json: string): AbacParseResult {
  if (!json.trim()) return { ok: true, value: undefined };
  try {
    const parsed: unknown = JSON.parse(json.trim());
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      return {
        ok: false,
        error: 'abac_condition harus berupa objek JSON (mis. {"attr": "subject.line_id", "eq": "LINE-01"}).',
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
