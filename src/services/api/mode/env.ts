/**
 * Pembaca env mentah (FAT-285, E32.4) — fondasi `mode/`.
 *
 * Dipisah dari `mode.ts` (453/500) tanpa mengubah perilaku: satu-satunya
 * tempat membaca `import.meta.env` / `process.env` untuk konfigurasi
 * sistem. `VITE_*` adalah build-time: nilainya dibakar ke bundle saat
 * `vite build` dan BUKAN tempat rahasia — jangan taruh password/token
 * di sini.
 */
export function readEnv(key: string): string | undefined {
  try {
    const metaEnv = (import.meta as unknown as { env?: Record<string, string | undefined> }).env;
    if (metaEnv && typeof metaEnv[key] === 'string') return metaEnv[key];
  } catch {
    // import.meta.env tidak tersedia di luar Vite (mis. saat test via tsx)
  }
  try {
    const procEnv = (globalThis as unknown as { process?: { env?: Record<string, string | undefined> } }).process?.env;
    if (procEnv && typeof procEnv[key] === 'string') return procEnv[key];
  } catch {
    // abaikan
  }
  return undefined;
}

/** Baca env boolean: hanya string `true` (case-insensitive) yang berarti ya. */
export function readEnvBool(key: string, fallback: boolean): boolean {
  const v = (readEnv(key) ?? '').trim().toLowerCase();
  if (v === 'true') return true;
  if (v === 'false') return false;
  return fallback;
}

/** Baca env integer dengan fallback + batas bawah. */
export function readEnvInt(key: string, fallback: number, min = 1): number {
  const v = Number(readEnv(key) ?? fallback);
  return Number.isFinite(v) && v >= min ? Math.floor(v) : fallback;
}
