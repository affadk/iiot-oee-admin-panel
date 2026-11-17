/**
 * Zona waktu tunggal pabrik — Asia/Jakarta (E12 T12.11 / X-4, FAT-59).
 *
 * Dipisah dari `time.ts` mengikuti pola R9.2 (kontrak
 * docs/DIRECTORY_STRUCTURE.md): satu file = satu concern. Semua kunci
 * hari/bulan, `from`/`to`, dan label waktu yang ditampilkan memakai WIB
 * (UTC+07:00, tanpa DST) — bukan offset lokal browser yang membuka panel.
 * Satu-satunya sumber kebenaran zona waktu panel; jangan memanggil
 * `toLocaleString()` / `toISOString()` tanpa zona waktu eksplisit untuk
 * waktu yang ditampilkan.
 */

export const PLANT_TIME_ZONE = 'Asia/Jakarta';
export const PLANT_TIME_ZONE_OFFSET = '+07:00';

const JAKARTA_PARTS_FORMATTER = new Intl.DateTimeFormat('en-CA', {
  timeZone: PLANT_TIME_ZONE,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit',
  hourCycle: 'h23',
});

/** Komponen wall-clock di Asia/Jakarta dari sebuah instant, atau null bila tidak valid. */
export function jakartaDateParts(value: Date | number): {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  second: number;
} | null {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  const parts: Record<string, string> = {};
  for (const part of JAKARTA_PARTS_FORMATTER.formatToParts(date)) {
    if (part.type !== 'literal') parts[part.type] = part.value;
  }
  return {
    year: Number(parts.year),
    month: Number(parts.month),
    day: Number(parts.day),
    hour: Number(parts.hour),
    minute: Number(parts.minute),
    second: Number(parts.second),
  };
}

/**
 * E12 T12.11 (X-4 / FAT-59): kunci hari ('YYYY-MM-DD') di Asia/Jakarta —
 * pengganti `toISOString().slice(0, 10)` yang memakai UTC dan menggeser
 * batas hari untuk jam-jam awal WIB (00:00–06:59 WIB masih hari
 * sebelumnya dalam UTC).
 */
export function dateKeyInJakarta(value: Date | number): string | null {
  const parts = jakartaDateParts(value);
  if (!parts) return null;
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${parts.year}-${pad(parts.month)}-${pad(parts.day)}`;
}

/**
 * E12 T12.11 (X-4 / FAT-59): kunci bulan ('YYYY-MM') di Asia/Jakarta,
 * `monthsAgo` bulan sebelum bulan instant itu — aritmetika kalender
 * Jakarta, bukan `setUTCMonth` yang memakai UTC.
 */
export function monthKeyInJakarta(value: Date | number, monthsAgo = 0): string | null {
  const parts = jakartaDateParts(value);
  if (!parts) return null;
  const totalMonths = parts.year * 12 + (parts.month - 1) - monthsAgo;
  const year = Math.floor(totalMonths / 12);
  const month = totalMonths - year * 12 + 1;
  return `${year}-${String(month).padStart(2, '0')}`;
}

const JAKARTA_DATE_TIME_FORMATTER = new Intl.DateTimeFormat('id-ID', {
  timeZone: PLANT_TIME_ZONE,
  day: '2-digit',
  month: 'short',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
  hour12: false,
});

const JAKARTA_TIME_FORMATTER = new Intl.DateTimeFormat('en-GB', {
  timeZone: PLANT_TIME_ZONE,
  hour: '2-digit',
  minute: '2-digit',
  hour12: false,
});

const JAKARTA_DATE_SHORT_FORMATTER = new Intl.DateTimeFormat('id-ID', {
  timeZone: PLANT_TIME_ZONE,
  day: 'numeric',
  month: 'short',
  hour12: false,
});

/** 'HH:MM' wall-clock apa adanya, tanpa konversi zona waktu. */
export function parseSegmentClockMinutes(value: string): number | null {
  const bare = /^([01]\d|2[0-3]):([0-5]\d)(?::([0-5]\d))?$/.exec(value.trim());
  if (bare) return Number(bare[1]) * 60 + Number(bare[2]);
  const fromIso = /T([01]\d|2[0-3]):([0-5]\d)/.exec(value);
  if (fromIso) return Number(fromIso[1]) * 60 + Number(fromIso[2]);
  return null;
}

/**
 * E12 T12.11 (X-4 / FAT-59): label tanggal + jam Asia/Jakarta, mis.
 * "11 Nov 2026, 07.00". Nilai yang tidak bisa diparse dikembalikan apa
 * adanya (string) — pemanggil tidak pernah menampilkan string kosong.
 */
export function formatJakartaDateTime(value: string | Date | number): string {
  const ms = value instanceof Date ? value.getTime() : typeof value === 'number' ? value : Date.parse(value);
  if (Number.isNaN(ms)) return typeof value === 'string' ? value : '';
  return JAKARTA_DATE_TIME_FORMATTER.format(new Date(ms));
}

/**
 * E12 T12.11 (X-4 / FAT-59): label jam 'HH:MM' Asia/Jakarta. 'HH:MM'
 * polos (format lama segmen demo) dikembalikan apa adanya; ISO 8601
 * dikonversi ke jam WIB.
 */
export function formatJakartaTime(value: string | Date | number): string {
  if (typeof value === 'string') {
    const bare = /^([01]\d|2[0-3]):([0-5]\d)$/.exec(value.trim());
    if (bare) return bare[0];
  }
  const ms = value instanceof Date ? value.getTime() : typeof value === 'number' ? value : Date.parse(value);
  if (Number.isNaN(ms)) return typeof value === 'string' ? value : '';
  return JAKARTA_TIME_FORMATTER.format(new Date(ms));
}

/** Label tanggal pendek Asia/Jakarta, mis. "17 Nov" — untuk penanda ganti hari di sumbu waktu. */
export function formatJakartaDateShort(value: string | Date | number): string {
  const ms = value instanceof Date ? value.getTime() : typeof value === 'number' ? value : Date.parse(value);
  if (Number.isNaN(ms)) return '';
  return JAKARTA_DATE_SHORT_FORMATTER.format(new Date(ms));
}

/**
 * E12 T12.11 (X-4 / FAT-59): durasi segmen timeline (menit) dari
 * `start`/`end` — benar untuk ISO 8601 (Real/demo baru) MAUPUN 'HH:MM'
 * polos (format demo lama / backend yang masih mengirimnya). 'HH:MM'
 * yang melewati tengah malam (end < start) dihitung membungkus ke hari
 * berikutnya; segmen tidak pernah lebih panjang dari satu shift, jadi
 * pembungkusan jam-dinding aman. 0 bila keduanya tidak bisa diparse.
 */
export function timelineSegmentDurationMin(start: string, end: string): number {
  const startMs = Date.parse(start);
  const endMs = Date.parse(end);
  if (Number.isFinite(startMs) && Number.isFinite(endMs)) {
    return Math.max(0, Math.round((endMs - startMs) / 60000));
  }
  const startMin = parseSegmentClockMinutes(start);
  const endMin = parseSegmentClockMinutes(end);
  if (startMin === null || endMin === null) return 0;
  let diff = endMin - startMin;
  if (diff < 0) diff += 1440;
  return diff;
}

