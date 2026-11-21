/**
 * Method demo — domain OEE (telemetry): seed titik per jam + turunan ringkasan shift.
 *
 * Dipisah dari demo/telemetry/oee.ts (489 baris) pada E32.5 (FAT-286),
 * mengikuti pola R9.2 (kontrak docs/DIRECTORY_STRUCTURE.md). Satu file =
 * satu sub-domain. Barrel penggabung ada di file induknya (../oee.ts).
 */

import { store } from '../../store';
import { HourlyOeePoint, ShiftTimelineSegment, TelemetryRangeOptions } from '../../../../../types/analytics';
import { Shift } from '../../../../../types/production';
import { parseShiftClock, addDaysToDateString } from '../../../../../utils/historicalExport';
import { parseIsoDateAndOffset, hhmmToMinutes, minutesToHhmm, round1 } from '../helpers';

/** Jam mulai shift seed demo (Shift 1, 07:00) — acuan proyeksi segmen/bucket. */
export const SEED_SHIFT_START_MIN = hhmmToMinutes('07:00');

/**
 * E12 T12.1 (X-1 / FAT-54): shift demo dari kode yang dikirim klien
 * (options.shift = Shift.shiftCode, mis. 'S1'). Undefined bila tidak ada
 * shift terpilih atau kode tidak dikenal — perilaku lama dipertahankan.
 */
export function findDemoShiftByCode(code?: string): Shift | undefined {
  if (!code) return undefined;
  return store.shifts.find((s) => s.shiftCode === code);
}

/**
 * E12 T12.1: tanggal + offset jangkar demo — `date` eksplisit didahulukan,
 * lalu tanggal dari `to`, lalu `from` (pola anchor T11.1/T11.2). Default
 * tanggal seed 2026-11-11 + offset +07:00 bila tidak ada acuan sama sekali.
 */
export function resolveDemoShiftAnchor(options?: TelemetryRangeOptions): { date: string; offset: string } {
  const anchor = (options?.to ? parseIsoDateAndOffset(options.to) : null)
    ?? (options?.from ? parseIsoDateAndOffset(options.from) : null);
  // `date` yang tidak berbentuk YYYY-MM-DD diabaikan (fallback anchor).
  const validDate =
    options?.date && /^\d{4}-\d{2}-\d{2}$/.test(options.date) ? options.date : undefined;
  return {
    date: validDate ?? anchor?.date ?? '2026-11-11',
    offset: anchor?.offset || '+07:00',
  };
}

/**
 * E12 T12.1: jendela shift dalam menit absolut sejak tengah malam tanggal
 * jangkar (bisa melewati 1440 bila shift lintas tengah malam).
 */
export function shiftWindowAbsMinutes(shift: Shift): { start: number; end: number } {
  const start = parseShiftClock(shift.startTime) ?? 0;
  const end = parseShiftClock(shift.endTime) ?? 0;
  const duration = ((end - start + 1440) % 1440) || 1440;
  return { start, end: start + duration };
}

/**
 * E12 T12.11 (X-4 / FAT-59): segmen timeline demo dalam ISO 8601
 * Asia/Jakarta — sama seperti Real (API doc §Q.3), bukan 'HH:MM' polos.
 * Menit absolut dipakai supaya segmen lintas tengah malam jatuh pada
 * tanggal yang benar (`absMin` >= 1440 = keesokan harinya; `< 0` tidak
 * terjadi untuk segmen shift). `duration_min` tidak berubah.
 */
export function toIsoTimelineSegment(
  seg: ShiftTimelineSegment,
  anchorDate: string,
  anchorOffset: string,
  startAbsMin: number,
  endAbsMin: number
): ShiftTimelineSegment {
  const offset = anchorOffset || '+07:00';
  const isoAt = (absMin: number) => {
    const dayOffset = Math.floor(absMin / 1440);
    const clock = minutesToHhmm(((absMin % 1440) + 1440) % 1440);
    const date = addDaysToDateString(anchorDate, dayOffset) ?? anchorDate;
    return `${date}T${clock}:00${offset}`;
  };
  return { ...seg, start: isoAt(startAbsMin), end: isoAt(endAbsMin) };
}

/**
 * E12 T12.6a (Opsi A / FAT-70): seed titik per jam demo — 8 bucket
 * 07:00–14:00 (12:00 sepenuhnya planned, 0 parts). Dipakai getHourlyTrend
 * dan getShiftSummary supaya keduanya membaca seed yang sama; sebelumnya
 * array ini hidup di dalam getHourlyTrend saja.
 */
export function buildDemoHourlyPoints(deviceId: string): HourlyOeePoint[] {
  const isUnknownCapacity = deviceId === 'STM32-OEE-05';
  // E20 P20.5 (FAT-157): titik demo membawa `bucket` ISO 8601 (jangkar
  // seed 2026-11-11 +07:00 — sama seperti segmen timeline X-4) + id
  // penaut (deviceId/machineId/woId); `hour` = bucket ISO, bukan 'HH:MM'.
  // OEE/performance `null` (bukan 0) bila kapasitas unknown (D-8).
  const machine = store.machines.find((m) => m.bound_device_id === deviceId);
  const activeWo = machine
    ? store.workOrders.find((w) => w.machine_id === machine.machine_id && w.status === 'ACTIVE')
    : undefined;
  const ids = {
    deviceId,
    machineId: machine?.machine_id ?? null,
    woId: activeWo?.wo_id ?? null,
  };
  return [
    // E11 T11.4 (F-4): jam 07:00 — micro-stop 432 dtk → 350 dtk
    // (run 3168 → 3250 dtk) supaya Σ hourly_run_sec = 23.280 dtk
    // (388 mnt = run_time_min). availability = 3250/3600 = 90,3%;
    // oee = 90,3 × 91,0 × 98,0 / 10000 = 80,5.
    // E12 T12.14 (F-10 / FAT-66): downtime per jam TIDAK lagi disimpan
    // di titik ini (`hourly_downtime_sec` dihapus). Downtime turunan
    // per jam = operating − run (Σ 1.920 dtk = unplanned 32 mnt; jam
    // 12:00 yang sepenuhnya planned tidak tertangkap turunan ini karena
    // operating-nya 0 — gap G8). Σ downtime penuh 92 mnt (5.520 dtk)
    // sumber kebenarannya ada di downtime_events dt-ev-02 (1.920 dtk)
    // + dt-ev-04 (3.600 dtk) — lihat test rekonsiliasi T11.4.
    // Jam 12:00 TIDAK diubah (sepenuhnya planned — gap G8, urusan backend).
    { hour: '2026-11-11T07:00:00+07:00', bucket: '2026-11-11T07:00:00+07:00', oee: isUnknownCapacity ? null : 80.5, availability: isUnknownCapacity ? 100 : 90.3, performance: isUnknownCapacity ? null : 91.0, quality: isUnknownCapacity ? 100 : 98.0, parts_produced: isUnknownCapacity ? 0 : 42, good_count: isUnknownCapacity ? 0 : 41, defect_count: isUnknownCapacity ? 0 : 1, hourly_operating_sec: 3600, hourly_run_sec: 3250, sampleCount: 60, targetPerHour: isUnknownCapacity ? null : 50, state: 'RUNNING', planned: false, provisional: false, ...ids },
    { hour: '2026-11-11T08:00:00+07:00', bucket: '2026-11-11T08:00:00+07:00', oee: isUnknownCapacity ? null : 84.6, availability: isUnknownCapacity ? 100 : 92.4, performance: isUnknownCapacity ? null : 94.1, quality: isUnknownCapacity ? 100 : 97.4, parts_produced: isUnknownCapacity ? 0 : 48, good_count: isUnknownCapacity ? 0 : 47, defect_count: isUnknownCapacity ? 0 : 1, hourly_operating_sec: 3600, hourly_run_sec: 3326, sampleCount: 60, targetPerHour: isUnknownCapacity ? null : 50, state: 'RUNNING', planned: false, provisional: false, ...ids },
    { hour: '2026-11-11T09:00:00+07:00', bucket: '2026-11-11T09:00:00+07:00', oee: isUnknownCapacity ? null : 86.2, availability: isUnknownCapacity ? 100 : 94.0, performance: isUnknownCapacity ? null : 93.5, quality: isUnknownCapacity ? 100 : 98.2, parts_produced: isUnknownCapacity ? 0 : 50, good_count: isUnknownCapacity ? 0 : 49, defect_count: isUnknownCapacity ? 0 : 1, hourly_operating_sec: 3600, hourly_run_sec: 3384, sampleCount: 60, targetPerHour: isUnknownCapacity ? null : 50, state: 'RUNNING', planned: false, provisional: false, ...ids },
    { hour: '2026-11-11T10:00:00+07:00', bucket: '2026-11-11T10:00:00+07:00', oee: isUnknownCapacity ? null : 82.0, availability: isUnknownCapacity ? 100 : 90.0, performance: isUnknownCapacity ? null : 92.0, quality: isUnknownCapacity ? 100 : 99.0, parts_produced: isUnknownCapacity ? 0 : 46, good_count: isUnknownCapacity ? 0 : 46, defect_count: 0, hourly_operating_sec: 3600, hourly_run_sec: 3240, sampleCount: 60, targetPerHour: isUnknownCapacity ? null : 50, state: 'RUNNING', planned: false, provisional: false, ...ids },
    { hour: '2026-11-11T11:00:00+07:00', bucket: '2026-11-11T11:00:00+07:00', oee: isUnknownCapacity ? null : 85.5, availability: isUnknownCapacity ? 100 : 93.0, performance: isUnknownCapacity ? null : 94.0, quality: isUnknownCapacity ? 100 : 97.8, parts_produced: isUnknownCapacity ? 0 : 49, good_count: isUnknownCapacity ? 0 : 48, defect_count: isUnknownCapacity ? 0 : 1, hourly_operating_sec: 3600, hourly_run_sec: 3348, sampleCount: 60, targetPerHour: isUnknownCapacity ? null : 50, state: 'RUNNING', planned: false, provisional: false, ...ids },
    { hour: '2026-11-11T12:00:00+07:00', bucket: '2026-11-11T12:00:00+07:00', oee: 0.0, availability: 0.0, performance: 0.0, quality: 100.0, parts_produced: 0, good_count: 0, defect_count: 0, hourly_operating_sec: 0, hourly_run_sec: 0, sampleCount: 12, targetPerHour: 0, state: 'PLANNED_DOWNTIME', planned: true, provisional: false, ...ids },
    { hour: '2026-11-11T13:00:00+07:00', bucket: '2026-11-11T13:00:00+07:00', oee: isUnknownCapacity ? null : 87.8, availability: isUnknownCapacity ? 100 : 95.0, performance: isUnknownCapacity ? null : 94.5, quality: isUnknownCapacity ? 100 : 98.0, parts_produced: isUnknownCapacity ? 0 : 52, good_count: isUnknownCapacity ? 0 : 51, defect_count: isUnknownCapacity ? 0 : 1, hourly_operating_sec: 3600, hourly_run_sec: 3420, sampleCount: 60, targetPerHour: isUnknownCapacity ? null : 50, state: 'RUNNING', planned: false, provisional: true, ...ids },
    { hour: '2026-11-11T14:00:00+07:00', bucket: '2026-11-11T14:00:00+07:00', oee: isUnknownCapacity ? null : 84.0, availability: isUnknownCapacity ? 100 : 92.0, performance: isUnknownCapacity ? null : 93.0, quality: isUnknownCapacity ? 100 : 98.2, parts_produced: isUnknownCapacity ? 0 : 47, good_count: isUnknownCapacity ? 0 : 46, defect_count: isUnknownCapacity ? 0 : 1, hourly_operating_sec: 3600, hourly_run_sec: 3312, sampleCount: 44, targetPerHour: isUnknownCapacity ? null : 50, state: 'RUNNING', planned: false, provisional: true, ...ids },
  ];
}

export interface DerivedShiftSummary {
  oee: number;
  availability: number;
  performance: number;
  quality: number;
  totalParts: number;
  goodParts: number;
  defectParts: number;
  targetPerHour: number;
}

/**
 * E12 T12.6a (Opsi A / FAT-70, keputusan Fathur 2026-11-17): turunkan
 * angka ringkasan shift dari Σ titik per jam — bukan dari counter
 * kumulatif live-state (350/342/8). Rumus (basis shift yang sama):
 * A = Σ run / Σ operating; P = Σ parts / (target × Σ operating jam);
 * Q = Σ good / Σ parts; OEE = A × P × Q / 10000; semua dibulatkan
 * 1 desimal. Untuk seed demo: A 92,4 · P 95,4 · Q 98,2 · OEE 86,6 ·
 * parts 334/328/6 · target 50. Mengembalikan null bila tidak bisa
 * diturunkan (parts 0 / target tidak diketahui — mis. STM32-OEE-05,
 * kapasitas unknown); pemanggil memakai fallback live-state.
 */
export function deriveShiftSummaryFromHourly(points: HourlyOeePoint[]): DerivedShiftSummary | null {
  const totalParts = points.reduce((acc, p) => acc + (p.parts_produced ?? 0), 0);
  const goodParts = points.reduce((acc, p) => acc + (p.good_count ?? 0), 0);
  const defectParts = points.reduce((acc, p) => acc + (p.defect_count ?? 0), 0);
  const operatingSec = points.reduce((acc, p) => acc + (p.hourly_operating_sec ?? 0), 0);
  const runSec = points.reduce((acc, p) => acc + (p.hourly_run_sec ?? 0), 0);
  const targetPerHour = points.find((p) => p.targetPerHour != null && p.targetPerHour > 0)?.targetPerHour ?? null;
  if (totalParts <= 0 || targetPerHour === null || operatingSec <= 0) return null;
  const availability = round1((runSec / operatingSec) * 100);
  const performance = round1((totalParts / (targetPerHour * (operatingSec / 3600))) * 100);
  const quality = round1((goodParts / totalParts) * 100);
  const oee = round1((availability * performance * quality) / 10000);
  return { oee, availability, performance, quality, totalParts, goodParts, defectParts, targetPerHour };
}
