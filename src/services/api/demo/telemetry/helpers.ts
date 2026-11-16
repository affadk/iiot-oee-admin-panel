/**
 * Method demo — domain telemetry — helper bersama.
 *
 * Dipisah dari demo/telemetry.ts pada E11 T11.6 (FAT-49), mengikuti pola
 * R9.2 (kontrak docs/DIRECTORY_STRUCTURE.md). Satu file = satu domain.
 * Barrel penggabung ada di file induknya (../telemetry.ts).
 *
 * Dipakai lintas method domain OEE: proyeksi tanggal/offset ISO
 * (T11.1/T11.2) + segmen kanonis shift dan re-bucketing timeline
 * eksak per bucket (T11.4). JANGAN ubah angka/logika di sini.
 */

import { ShiftTimelineSegment } from '../../../../types/analytics';

/**
 * Ambil tanggal kalender + offset zona waktu dari string ISO 8601 apa adanya
 * (tanpa konversi ke zona waktu lokal mesin), supaya bucket demo 'HH:MM'
 * diproyeksikan ke hari yang sama dengan yang tertulis di from/to —
 * deterministik di browser maupun di test (VM UTC).
 */
export function parseIsoDateAndOffset(iso: string): { date: string; offset: string } | null {
  const dateMatch = /^(\d{4}-\d{2}-\d{2})T/.exec(iso);
  if (!dateMatch) return null;
  const offsetMatch = /(Z|[+-]\d{2}:?\d{2})$/.exec(iso);
  return { date: dateMatch[1], offset: offsetMatch ? offsetMatch[1] : '' };
}

/**
 * E11 T11.4 (F-4): segmen kanonis shift — ANGKA KEBENARAN adalah shift
 * summary (demo/telemetry.ts getShiftSummary): jendela 480 mnt = RUNNING
 * 388 + PLANNED 60 + UNPLANNED 32; operating 420 = run 388 + unplanned 32.
 *
 * Komposisi sebelumnya (RUNNING 409, PLANNED 45, UNPLANNED 15,
 * BATCH_FINISHED 11) tidak bisa direkonsiliasi (gap G2). Keputusan soal
 * BATCH_FINISHED: 11 mnt 14:49–15:00 DILIPAT ke RUNNING — summary tidak
 * punya bucket BATCH_FINISHED, jadi Σ RUNNING timeline harus sama dengan
 * run_time_min 388; batch selesai tepat di akhir shift, artinya mesin
 * berlari sampai 15:00 (potongan itu adalah label state terminal pada
 * menit-menit running, bukan idle). Keputusan ini sekaligus menghapus
 * satu-satunya segmen yang tidak sejajar grid 15 mnt (gap G21).
 *
 * Satu-satunya batas yang tidak sejajar grid 15 mnt adalah 09:47 —
 * dipaksa oleh unplanned 32 mnt yang bukan kelipatan 15. Planned 60 mnt
 * menempati 12:00–13:00 penuh agar cocok dengan bucket jam 12:00
 * (sepenuhnya planned, operating 0 — gap G8, di luar scope, jangan diubah).
 */
export const CANONICAL_SHIFT_SEGMENTS: ShiftTimelineSegment[] = [
  { start: '07:00', end: '09:15', fsm_state: 'RUNNING', planned: false, duration_min: 135 },
  { start: '09:15', end: '09:47', fsm_state: 'UNPLANNED_DOWNTIME', planned: false, downtime_id: 'dt-ev-02', duration_min: 32 },
  { start: '09:47', end: '12:00', fsm_state: 'RUNNING', planned: false, duration_min: 133 },
  { start: '12:00', end: '13:00', fsm_state: 'PLANNED_DOWNTIME', planned: true, downtime_id: 'dt-ev-04', duration_min: 60 },
  { start: '13:00', end: '15:00', fsm_state: 'RUNNING', planned: false, duration_min: 120 },
];

export const TIMELINE_BUCKET_MIN: Record<'1m' | '5m' | '15m' | '1h', number> = {
  '1m': 1,
  '5m': 5,
  '15m': 15,
  '1h': 60,
};

export function hhmmToMinutes(hhmm: string): number {
  const [h, m] = hhmm.split(':').map(Number);
  return h * 60 + m;
}

export function minutesToHhmm(min: number): string {
  return `${String(Math.floor(min / 60)).padStart(2, '0')}:${String(min % 60).padStart(2, '0')}`;
}

/**
 * E11 T11.4 (F-4): hormati parameter bucket — bangun peta state per menit
 * dari segmen kanonis, lalu emit segmen per bucket yang diminta.
 *
 * Sengaja BUKAN state mayoritas per bucket: mayoritas membulatkan
 * unplanned 32 mnt menjadi 30 mnt pada bucket 5m/15m (batas 09:47 jatuh
 * di tengah bucket 09:45–10:00) dan menjadi 60 mnt pada bucket 1h
 * (09:00–10:00 mayoritas UNPLANNED 32 vs RUNNING 28) — Σ durasi per
 * state tidak lagi sama dengan shift summary, G2 terulang dalam bentuk
 * lebih kecil. Sebagai gantinya tiap bucket dipecah TEPAT pada batas
 * perubahan state (split eksak): tidak ada segmen yang melewati batas
 * bucket, dan Σ durasi per state tetap 388/60/32 pada SEMUA bucket.
 * Fragmen yang bersebelahan dengan state sama (mis. RUNNING 07:00–07:15
 * + 07:15–07:30) sengaja TIDAK digabung — masing-masing berada dalam
 * satu bucket yang diminta.
 */
export function rebucketTimelineSegments(
  segments: ShiftTimelineSegment[],
  bucket: '1m' | '5m' | '15m' | '1h'
): ShiftTimelineSegment[] {
  const bucketMin = TIMELINE_BUCKET_MIN[bucket];
  const shiftStart = hhmmToMinutes(segments[0].start);
  const shiftEnd = hhmmToMinutes(segments[segments.length - 1].end);
  // Peta state per menit (indeks 0 = shiftStart); segmen kanonis menutup
  // jendela tanpa celah sehingga tidak ada menit yang kosong.
  const perMinute: ShiftTimelineSegment[] = new Array(shiftEnd - shiftStart);
  for (const seg of segments) {
    for (let m = hhmmToMinutes(seg.start); m < hhmmToMinutes(seg.end); m++) {
      perMinute[m - shiftStart] = seg;
    }
  }
  const out: ShiftTimelineSegment[] = [];
  // Bucket sejajar jam dinding (07:00 sejajar semua grid).
  for (let bStart = shiftStart; bStart < shiftEnd; bStart += bucketMin) {
    const bEnd = Math.min(bStart + bucketMin, shiftEnd);
    let runStart = bStart;
    for (let m = bStart + 1; m <= bEnd; m++) {
      const prev = perMinute[m - 1 - shiftStart];
      const cur = m < bEnd ? perMinute[m - shiftStart] : undefined;
      if (m === bEnd || cur !== prev) {
        out.push({
          start: minutesToHhmm(runStart),
          end: minutesToHhmm(m),
          fsm_state: prev.fsm_state,
          planned: prev.planned,
          ...(prev.downtime_id ? { downtime_id: prev.downtime_id } : {}),
          duration_min: m - runStart,
        });
        runStart = m;
      }
    }
  }
  return out;
}
