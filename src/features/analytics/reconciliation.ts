import { HourlyOeePoint, ShiftSummary, ShiftTimelineSegment } from '../../types/analytics';
import { timelineBoundaryMs } from './timelineAxis';

/**
 * E12 T12.6 (U-3 / FAT-56): indikator rekonsiliasi halaman OEE (gap G2).
 *
 * Pure helper — TANPA fetch/query baru. Membandingkan angka-angka yang
 * sudah dimuat halaman OEE (ringkasan shift, tabel per jam, timeline) dan
 * menandai selisih yang melewati ambang. Hasilnya ditampilkan sebagai
 * catatan kaki, bukan blokir: ketidakcocokan menjadi terlihat dan bisa
 * ditindaklanjuti, bukan disembunyikan.
 *
 * Ambang peringatan (ditetapkan fix ini; tercantum juga di catatan kaki):
 * - Waktu: selisih > 60 detik ATAU > 1% dari nilai acuan (ringkasan).
 *   60 detik menoleransi pembulatan per-bucket; 1% menangkap drift yang
 *   kecil secara absolut tapi besar relatif terhadap jendela pendek.
 * - Parts: selisih > 1% dari nilai acuan (ringkasan). Parts adalah bilangan
 *   bulat — tidak ada toleransi pembulatan; 1% memberi ruang untuk selisih
 *   kecil (mis. 1–3 pcs dari 350) tanpa menyembunyikan gap nyata.
 *
 * Perbandingan ini mengasumsikan ketiganya mencakup jendela yang sama
 * (jendela filter halaman yang sama — default 7 hari). Bila filter
 * mempersempit salah satu sumber (mis. rentang kustom / shift yang
 * dipotong), peringatan bisa muncul karena jendela yang berbeda — bukan
 * karena datanya salah.
 *
 * FAT-221 (E2E-07 — DIAGNOSIS TERKONFIRMASI dari probe live 2026-11-20):
 * premis E28 Batch B di bawah SALAH — `window` respons shift-summary
 * BUKAN jendela satu shift. Server meng-echo `from`/`to` yang diminta
 * sebagai `window` bila tak ada WO aktif (api_docs §Q.1: "tanpa WO →
 * window dari from/to eksplisit"); panel selalu mengirim from/to default
 * 7 hari, jadi `shift_start/shift_end` ringkasan = jendela filter 7 hari
 * (probe: window 2026-11-12T19:38:07Z → 2026-11-19T19:38:07Z untuk
 * from/to 7 hari; window 00:00–09:00Z hanya muncul bila from/to TIDAK
 * dikirim — panel tak pernah begitu). Akibatnya clip E28 ke "jendela
 * shift" adalah no-op live: timeline 7 hari dipotong ke jendela 7 hari.
 * Angka 99 mnt pun BUKAN satu shift — `time_sec.run` 5.940 dtk mencakup
 * 7 hari yang sama (perangkat hanya jalan 99 mnt dalam 7 hari; telemetri
 * terakhir 19 Nov 15:54 WIB). Dua selisih live punya penyebab berbeda:
 * (a) total 10.080 vs 99 — `planned_production_time_min` BUKAN durasi
 * jendela: server tak mengirimnya, mapper jatuh ke operatingSec/60
 * (= 99). Acuan yang benar untuk total adalah durasi jendela itu
 * sendiri; (b) RUNNING 1.145 vs 99 — selisih NYATA dalam jendela yang
 * sama: timeline diisi gapless oleh server (bucket kosong membawa state
 * terakhir), sehingga RUNNING terus membesar setelah perangkat offline
 * (probe: 745 mnt pk 02:38 WIB → 1.145 mnt pk 09:15 WIB, tanpa data
 * baru), sementara `time_sec.run` hanya menghitung detik sampel.
 * Perbaikan di sini: (a) total dibandingkan dengan durasi jendela bila
 * jendela bisa diparse; (b) check per-state pada jendela multi-hari
 * diberi catatan yang menjelaskan kedua hal itu — ambang TIDAK dinaikkan
 * dan selisih nyata TIDAK disembunyikan. Clip lama dipertahankan sebagai
 * pengaman bila timeline melampaui jendela ringkasan.
 */

/** Toleransi absolut waktu: 60 detik. */
export const RECONCILIATION_TIME_TOLERANCE_SEC = 60;

/** Toleransi relatif: 1% dari nilai acuan (ringkasan). */
export const RECONCILIATION_RELATIVE_TOLERANCE = 0.01;

export type ReconciliationUnit = 'detik' | 'menit' | 'pcs';

export type ReconciliationStatus = 'ok' | 'warning' | 'unavailable';

export interface ReconciliationCheck {
  id: string;
  /** Judul baris, mis. "Run time — Σ jam vs ringkasan". */
  label: string;
  leftLabel: string;
  /** Nilai sisi kiri dalam `unit`; null bila sumbernya tidak lengkap. */
  leftValue: number | null;
  rightLabel: string;
  /** Nilai sisi kanan (ringkasan) dalam `unit`; null bila tidak ada. */
  rightValue: number | null;
  unit: ReconciliationUnit;
  /** Selisih (kiri − kanan) dalam `unit`; null bila tidak bisa dihitung. */
  diff: number | null;
  status: ReconciliationStatus;
  /** Catatan tambahan, mis. "timeline dipotong ke jendela shift". */
  note?: string;
}

export interface OeeReconciliation {
  checks: ReconciliationCheck[];
  warningCount: number;
  /** True bila tidak ada check yang berstatus warning. */
  isConsistent: boolean;
  /** True bila ada setidaknya satu check yang bisa dihitung. */
  hasData: boolean;
}

/** Jumlahkan; null bila ada satu saja nilai yang hilang / bukan angka. */
function sumFinite(values: (number | undefined | null)[]): number | null {
  let total = 0;
  for (const value of values) {
    if (typeof value !== 'number' || !Number.isFinite(value)) return null;
    total += value;
  }
  return total;
}

/** Selisih waktu melewati ambang bila > 60 detik ATAU > 1% nilai acuan. */
function timeExceeds(diffSec: number, referenceSec: number): boolean {
  const abs = Math.abs(diffSec);
  return (
    abs > RECONCILIATION_TIME_TOLERANCE_SEC ||
    abs > Math.abs(referenceSec) * RECONCILIATION_RELATIVE_TOLERANCE
  );
}

/** Selisih parts melewati ambang bila > 1% nilai acuan. */
function partsExceeds(diff: number, reference: number): boolean {
  return Math.abs(diff) > Math.abs(reference) * RECONCILIATION_RELATIVE_TOLERANCE;
}

function buildCheck(
  id: string,
  label: string,
  leftLabel: string,
  leftValue: number | null,
  rightLabel: string,
  rightValue: number | null,
  unit: ReconciliationUnit,
  exceeds: (diff: number, reference: number) => boolean,
  note?: string
): ReconciliationCheck {
  if (leftValue === null || rightValue === null) {
    return { id, label, leftLabel, leftValue, rightLabel, rightValue, unit, diff: null, status: 'unavailable', ...(note ? { note } : {}) };
  }
  const diff = leftValue - rightValue;
  return {
    id,
    label,
    leftLabel,
    leftValue,
    rightLabel,
    rightValue,
    unit,
    diff,
    status: exceeds(diff, rightValue) ? 'warning' : 'ok',
    ...(note ? { note } : {}),
  };
}

/**
 * E28 Batch B (FAT-221): jendela shift ringkasan sebagai [ms, ms], atau
 * null bila shift_start/shift_end tak bisa diparse.
 */
function resolveSummaryWindowMs(summary: ShiftSummary): [number, number] | null {
  const start = Date.parse(summary.shift_start);
  const end = Date.parse(summary.shift_end);
  if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start) return null;
  return [start, end];
}

/**
 * E28 Batch B (FAT-221): durasi segmen yang jatuh DI DALAM jendela
 * ringkasan (menit, dibulatkan ke bawah ke menit penuh — durasi segmen
 * memang menit bulat). Bila batas segmen tak bisa diparse, pakai
 * `duration_min` apa adanya (perilaku lama). Segmen lintas tengah malam
 * ('HH:MM' dengan end < start) digeser +24 jam, sama seperti sumbu
 * timeline (`timelineAxis`).
 */
function clippedDurationMin(
  seg: ShiftTimelineSegment,
  window: [number, number] | null,
  anchorDate: string | null
): number {
  if (!window) return seg.duration_min;
  const startMs = timelineBoundaryMs(seg.start, anchorDate);
  let endMs = timelineBoundaryMs(seg.end, anchorDate);
  if (startMs === null || endMs === null) return seg.duration_min;
  if (endMs < startMs) endMs += 24 * 3600_000;
  const overlapMs = Math.max(0, Math.min(endMs, window[1]) - Math.max(startMs, window[0]));
  return Math.floor(overlapMs / 60000);
}

/**
 * FAT-221: jendela lebih panjang dari 24 jam pasti BUKAN satu shift —
 * itu rentang filter multi-hari (default halaman 7 hari). Shift pabrik
 * umumnya 8–12 jam; 24 jam memberi ruang untuk shift panjang + jendela
 * "hari ini" tanpa menandai shift normal sebagai multi-hari.
 */
const MULTI_DAY_WINDOW_MIN = 24 * 60;

/** Label durasi jendela dalam hari, mis. 7 → "7", 10,5 hari → "10,5". */
function formatWindowDays(windowMin: number): string {
  const days = windowMin / 1440;
  return Number.isInteger(days) ? String(days) : days.toLocaleString('id-ID', { maximumFractionDigits: 1 });
}

/** Gabung catatan yang ada (buang yang undefined/kosong); undefined bila tak ada. */
function joinNotes(...notes: (string | undefined)[]): string | undefined {
  const parts = notes.filter((n): n is string => Boolean(n));
  return parts.length > 0 ? parts.join(' ') : undefined;
}

/**
 * Hitung rekonsiliasi dari data yang sudah dimuat halaman OEE.
 * Tidak ada check bila summary null (halaman menampilkan empty/error
 * state-nya sendiri); check per sumber hanya dibuat bila sumber itu ada.
 */
export function computeOeeReconciliation(
  summary: ShiftSummary | null | undefined,
  hourly: HourlyOeePoint[],
  timeline: ShiftTimelineSegment[]
): OeeReconciliation {
  if (!summary) {
    return { checks: [], warningCount: 0, isConsistent: true, hasData: false };
  }
  const checks: ReconciliationCheck[] = [];

  if (hourly.length > 0) {
    const hourlyRunSec = sumFinite(hourly.map((p) => p.hourly_run_sec));
    checks.push(
      buildCheck(
        'hourly-run-vs-summary',
        'Run time — Σ jam vs ringkasan',
        'Σ hourly_run_sec',
        hourlyRunSec,
        'run_time_min (ringkasan)',
        summary.run_time_min * 60,
        'detik',
        timeExceeds
      )
    );

    const hourlyParts = sumFinite(hourly.map((p) => p.parts_produced));
    checks.push(
      buildCheck(
        'hourly-parts-vs-summary',
        'Total parts — Σ jam vs ringkasan',
        'Σ parts_produced',
        hourlyParts,
        'total_parts (ringkasan)',
        summary.total_parts,
        'pcs',
        partsExceeds
      )
    );

    const hourlyGood = sumFinite(hourly.map((p) => p.good_count));
    checks.push(
      buildCheck(
        'hourly-good-vs-summary',
        'Good parts — Σ jam vs ringkasan',
        'Σ good_count',
        hourlyGood,
        'good_parts (ringkasan)',
        summary.good_parts,
        'pcs',
        partsExceeds
      )
    );

    const hourlyDefect = sumFinite(hourly.map((p) => p.defect_count));
    checks.push(
      buildCheck(
        'hourly-defect-vs-summary',
        'Defect — Σ jam vs ringkasan',
        'Σ defect_count',
        hourlyDefect,
        'defect_parts (ringkasan)',
        summary.defect_parts,
        'pcs',
        partsExceeds
      )
    );
  }

  if (timeline.length > 0) {
    // FAT-221: jendela ringkasan adalah jendela FILTER (server meng-echo
    // from/to bila tak ada WO aktif) — potong segmen ke jendela itu
    // sebelum dijumlahkan, sebagai pengaman bila timeline melampaui
    // jendela ringkasan. Live jendela itu 7 hari sehingga potongnya
    // no-op; yang membuat perbandingan sebanding adalah acuan total di
    // bawah (durasi jendela) + catatan multi-hari pada check per-state.
    const window = resolveSummaryWindowMs(summary);
    const windowMin = window !== null ? Math.round((window[1] - window[0]) / 60000) : null;
    const anchorDate = summary.shift_start.slice(0, 10) || null;
    const clipped = timeline.map((s) => ({
      ...s,
      duration_min: clippedDurationMin(s, window, anchorDate),
    }));
    const wasClipped =
      window !== null &&
      clipped.reduce((acc, s) => acc + s.duration_min, 0) <
        timeline.reduce((acc, s) => acc + s.duration_min, 0);
    const clipNote = wasClipped
      ? 'Timeline dipotong ke jendela shift ringkasan (bukan seluruh rentang filter).'
      : undefined;
    // FAT-221: jendela multi-hari — ringkasan + timeline mencakup rentang
    // filter yang sama (bukan satu shift), dan total per-state timeline
    // diisi gapless oleh server (bucket kosong membawa state terakhir)
    // sementara ringkasan menghitung detik sampel. Catatan ini menjelaskan
    // selisih yang tersisa; ambang tidak diubah dan selisih tidak
    // disembunyikan.
    let multiDayNote: string | undefined;
    let multiDayStateNote: string | undefined;
    if (windowMin !== null && windowMin > MULTI_DAY_WINDOW_MIN) {
      multiDayNote = `Ringkasan + timeline mencakup rentang filter ${formatWindowDays(windowMin)} hari, bukan satu shift.`;
      multiDayStateNote =
        `${multiDayNote} Timeline diisi gapless oleh server (bucket kosong membawa state terakhir) ` +
        'sementara ringkasan menghitung detik sampel — total state timeline bisa membesar saat perangkat lama offline.';
    }
    const stateNote = joinNotes(clipNote, multiDayStateNote);
    const durationByState = new Map<string, number | null>();
    for (const state of ['RUNNING', 'PLANNED_DOWNTIME', 'UNPLANNED_DOWNTIME']) {
      durationByState.set(
        state,
        sumFinite(
          clipped.filter((s) => s.fsm_state === state).map((s) => s.duration_min)
        )
      );
    }
    const timelineTotalMin = sumFinite(clipped.map((s) => s.duration_min));
    // FAT-221: acuan "total timeline vs jendela" adalah DURASI JENDELA
    // (shift_end − shift_start), bukan planned_production_time_min —
    // server tidak mengirim planned production time sehingga mapper
    // jatuh ke operatingSec/60 (live: 99 mnt untuk jendela 7 hari).
    // Bila jendela tak bisa diparse, pakai planned_production_time_min
    // (perilaku lama) dengan catatan fallback.
    const totalRightValue = windowMin ?? summary.planned_production_time_min;
    const totalRightLabel =
      windowMin !== null ? 'durasi jendela (ringkasan)' : 'planned_production_time_min (ringkasan)';
    const totalNote =
      windowMin !== null
        ? joinNotes(clipNote, multiDayNote)
        : 'Jendela ringkasan tidak bisa diparse — total dibandingkan dengan planned_production_time_min.';

    checks.push(
      buildCheck(
        'timeline-running-vs-summary',
        'RUNNING timeline vs ringkasan',
        'Σ durasi RUNNING (timeline)',
        durationByState.get('RUNNING') ?? null,
        'run_time_min (ringkasan)',
        summary.run_time_min,
        'menit',
        (diff, ref) => timeExceeds(diff * 60, ref * 60),
        stateNote
      )
    );
    checks.push(
      buildCheck(
        'timeline-planned-vs-summary',
        'Planned downtime timeline vs ringkasan',
        'Σ durasi PLANNED_DOWNTIME (timeline)',
        durationByState.get('PLANNED_DOWNTIME') ?? null,
        'planned_downtime_min (ringkasan)',
        summary.planned_downtime_min,
        'menit',
        (diff, ref) => timeExceeds(diff * 60, ref * 60),
        stateNote
      )
    );
    checks.push(
      buildCheck(
        'timeline-unplanned-vs-summary',
        'Unplanned downtime timeline vs ringkasan',
        'Σ durasi UNPLANNED_DOWNTIME (timeline)',
        durationByState.get('UNPLANNED_DOWNTIME') ?? null,
        'unplanned_downtime_min (ringkasan)',
        summary.unplanned_downtime_min,
        'menit',
        (diff, ref) => timeExceeds(diff * 60, ref * 60),
        stateNote
      )
    );
    checks.push(
      buildCheck(
        'timeline-total-vs-window',
        'Total durasi timeline vs jendela shift',
        'Σ durasi timeline',
        timelineTotalMin,
        totalRightLabel,
        totalRightValue,
        'menit',
        (diff, ref) => timeExceeds(diff * 60, ref * 60),
        totalNote
      )
    );
  }

  const warningCount = checks.filter((c) => c.status === 'warning').length;
  return {
    checks,
    warningCount,
    isConsistent: warningCount === 0,
    hasData: checks.length > 0,
  };
}

/** Format nilai + satuan cara Indonesia, mis. "23.280 detik", "388 menit", "334 pcs". */
export function formatReconciliationValue(value: number | null, unit: ReconciliationUnit): string {
  if (value === null) return '—';
  return `${value.toLocaleString('id-ID')} ${unit}`;
}

/** Teks selisih dengan tanda, mis. "+16 pcs", "−120 detik"; "" bila nol/null. */
export function formatReconciliationDiff(diff: number | null, unit: ReconciliationUnit): string {
  if (diff === null || diff === 0) return '';
  const sign = diff > 0 ? '+' : '−';
  return `${sign}${Math.abs(diff).toLocaleString('id-ID')} ${unit}`;
}
