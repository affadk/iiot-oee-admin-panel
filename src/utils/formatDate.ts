/**
 * E31.8 (FAT-271): SATU-SATUNYA pemformat tanggal tampil (aturan R6).
 *
 * Semua tanggal/jam yang ditampilkan ke pengguna HARUS lewat fungsi di
 * file ini (zona Asia/Jakarta) — `toLocaleString()` / `toLocaleDateString()`
 * / `toLocaleTimeString()` mentah DILARANG di `features/` karena memakai
 * zona + locale browser yang membuka panel (tidak deterministik).
 *
 * Implementasi kanonis tinggal di `utils/historicalExport/timezone.ts`
 * (E12 T12.11 / FAT-59); file ini adalah facade agar pemanggil di
 * `features/` tidak mengimpor dari `historicalExport`, dan rumah bagi
 * format yang belum ada padanannya di sana (`formatDate`,
 * `formatTimeWithSeconds`, `formatRelativeAge`).
 */

import {
  formatJakartaDateTime,
  formatJakartaTime,
  PLANT_TIME_ZONE,
} from './historicalExport/timezone';

export { formatJakartaDateTime as formatDateTime };
export { formatJakartaTime as formatTime };
export { PLANT_TIME_ZONE };

const DATE_FORMATTER = new Intl.DateTimeFormat('id-ID', {
  timeZone: PLANT_TIME_ZONE,
  day: '2-digit',
  month: 'short',
  year: 'numeric',
  hour12: false,
});

const TIME_WITH_SECONDS_FORMATTER = new Intl.DateTimeFormat('id-ID', {
  timeZone: PLANT_TIME_ZONE,
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit',
  hour12: false,
});

function toMs(value: string | Date | number): number {
  if (value instanceof Date) return value.getTime();
  if (typeof value === 'number') return value;
  return Date.parse(value);
}

/**
 * Label tanggal saja Asia/Jakarta, mis. "11 Nov 2026".
 * Pengganti `toLocaleDateString()` (locale browser, format tidak menentu).
 * Nilai yang tidak bisa diparse → ''.
 */
export function formatDate(value: string | Date | number): string {
  const ms = toMs(value);
  if (Number.isNaN(ms)) return '';
  return DATE_FORMATTER.format(new Date(ms));
}

/**
 * Label jam + detik Asia/Jakarta, mis. "19.42.15".
 * Pengganti `toLocaleTimeString()` (locale browser, format tidak menentu).
 * Nilai yang tidak bisa diparse → ''.
 */
export function formatTimeWithSeconds(value: string | Date | number): string {
  const ms = toMs(value);
  if (Number.isNaN(ms)) return '';
  return TIME_WITH_SECONDS_FORMATTER.format(new Date(ms));
}

/**
 * Umur relatif terhadap `now` (default: sekarang), mis. "baru saja",
 * "4 dtk lalu", "12 mnt lalu", "3 jam lalu", "2 hari lalu".
 * Lebih dari 7 hari → tanggal absolut (`formatDateTime`).
 * `null` / `undefined` / tidak bisa diparse → '—'.
 */
export function formatRelativeAge(
  value: string | Date | number | null | undefined,
  now: number = Date.now(),
): string {
  if (value === null || value === undefined) return '—';
  const ms = toMs(value);
  if (Number.isNaN(ms)) return '—';
  const diffSec = Math.floor((now - ms) / 1000);
  if (diffSec < 0) return 'baru saja';
  if (diffSec < 10) return 'baru saja';
  if (diffSec < 60) return `${diffSec} dtk lalu`;
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `${diffMin} mnt lalu`;
  const diffHour = Math.floor(diffMin / 60);
  if (diffHour < 24) return `${diffHour} jam lalu`;
  const diffDay = Math.floor(diffHour / 24);
  if (diffDay < 7) return `${diffDay} hari lalu`;
  return formatJakartaDateTime(value);
}
