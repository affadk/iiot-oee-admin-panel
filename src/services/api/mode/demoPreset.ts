/**
 * Preset login demo (FAT-285, E32.4) — HANYA hidup bila env demo.
 *
 * Dipisah dari `mode.ts` (453/500) tanpa mengubah perilaku.
 */
import type { UserRole } from '../../../types/auth';
import { readEnvBool } from './env';
import { resolveApiMode, resolveEnvApiMode } from './apiMode';

/** Akun seed demo yang boleh ditampilkan sebagai preset di halaman login. */
export const DEMO_PRESETS: Array<{ operatorId: string; role: UserRole; lineId: string; name: string }> = [
  { operatorId: 'ADM-001', role: 'ADMIN', lineId: 'ORG-ALL', name: 'Alexandria Vance' },
  { operatorId: 'SUP-042', role: 'SUPERVISOR', lineId: 'LINE-01', name: 'Marcus Reinhardt' },
  { operatorId: 'OP-115', role: 'OPERATOR', lineId: 'LINE-01', name: 'Kenji Sato' },
  { operatorId: 'MNT-208', role: 'MAINTENANCE', lineId: 'LINE-02', name: 'Elena Rostova' },
];

/**
 * Pengisi password form preset. BUKAN kredensial nyata — login demo menerima
 * password apa pun ≥8 karakter (§L, E20 P20.3 — fallback min 4 DIHAPUS);
 * string ini hanya pengisi form agar preset bisa dipakai satu klik.
 */
export const DEMO_PRESET_PASSWORD = 'Factory@2026!';

/**
 * Preset login demo aktif HANYA bila SEMUA syarat terpenuhi:
 *   1. mode efektif saat ini `demo`, DAN
 *   2. env `VITE_API_MODE` BUKAN `real` (jadi preset MATI di env `!demo`,
 *      sekalipun mode sempat dialihkan ke demo lewat switch dev), DAN
 *   3. `VITE_DEMO_PRESET_LOGIN` tidak dimatikan eksplisit (`false`).
 * Di mode Real tidak ada prefill operator/password dan tidak ada tombol preset.
 */
export function isDemoPresetLoginEnabled(): boolean {
  if (resolveApiMode() !== 'demo') return false;
  if (resolveEnvApiMode() === 'real') return false;
  return readEnvBool('VITE_DEMO_PRESET_LOGIN', true);
}
