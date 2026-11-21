/**
 * Method demo — domain OEE (telemetry): ringkasan shift + timeline shift.
 *
 * Dipisah dari demo/telemetry/oee.ts (489 baris) pada E32.5 (FAT-286),
 * mengikuti pola R9.2 (kontrak docs/DIRECTORY_STRUCTURE.md). Satu file =
 * satu sub-domain. Barrel penggabung ada di file induknya (../oee.ts).
 */
import { store } from '../../store';
import { checkAbort } from '../../helpers';
import { ADMIN_ENDPOINTS } from '../../../endpoints';
import { ShiftSummary, ShiftTimelineSegment, TelemetryRangeOptions } from '../../../../../types/analytics';
import { resolveShiftWindow } from '../../../../../utils/historicalExport';
import { rebucketTimelineSegments, CANONICAL_SHIFT_SEGMENTS, hhmmToMinutes, minutesToHhmm } from '../helpers';
import { buildDemoHourlyPoints, deriveShiftSummaryFromHourly, findDemoShiftByCode, resolveDemoShiftAnchor, shiftWindowAbsMinutes, toIsoTimelineSegment, SEED_SHIFT_START_MIN } from './seed';

export const demoTelemetryOeeSummary = {
  async getShiftSummary(
    machineId?: string,
    signal?: AbortSignal,
    options?: TelemetryRangeOptions
  ): Promise<ShiftSummary> {
    checkAbort(signal);
    const qs = new URLSearchParams();
    if (machineId) qs.set('machine_id', machineId);
    if (options?.from) qs.set('from', options.from);
    if (options?.to) qs.set('to', options.to);
    // E12 T12.1 (X-1 / FAT-54): date/shift ikut tercatat — sama seperti
    // yang dikirim transport HTTP (API doc §I).
    if (options?.date) qs.set('date', options.date);
    if (options?.shift) qs.set('shift', options.shift);
    // E20 P20.5 (FAT-157): `include_hourly=true` ikut tercatat — sama
    // seperti yang dikirim transport HTTP (§Q.1).
    if (options?.include_hourly) qs.set('include_hourly', 'true');
    const qStr = qs.toString();
    store.recordEndpoint('OEE_SHIFT_SUMMARY', `${ADMIN_ENDPOINTS.OEE_SHIFT_SUMMARY.buildPath()}${qStr ? `?${qStr}` : ''}`);
    const targetMachine = store.machines.find((m) => m.machine_id === machineId) || store.machines[0];
    const live = store.liveStates.find((l) => l.machine_id === targetMachine?.machine_id);
    // E12 T12.6a (Opsi A / FAT-70, keputusan Fathur 2026-11-17): angka
    // ringkasan diturunkan dari Σ titik per jam mesin itu
    // (deriveShiftSummaryFromHourly) — bukan dari counter kumulatif
    // live-state (350/342/8). Live state tetap kumulatif dan dipakai
    // sebagai fallback bila seed hourly tidak bisa diturunkan (mis.
    // STM32-OEE-05: parts 0, target tidak diketahui).
    const hourlyPoints = buildDemoHourlyPoints(targetMachine?.bound_device_id || 'STM32-OEE-01');
    const derived = deriveShiftSummaryFromHourly(hourlyPoints);
    // E20 P20.5 (FAT-157): menit shift DITURUNKAN dari titik per jam —
    // bukan hardcode. operating = Σ operating_sec/60 (420); run =
    // Σ run_sec/60 (388); unplanned = Σ(operating − run)/60 (32);
    // planned = Σ jam planned × 60 (12:00 → 60); planned_production =
    // operating + planned (480). Nilai sama dengan hardcode lama untuk
    // seed ini, tapi mengikuti seed bila seed berubah.
    const operatingMin = Math.round(hourlyPoints.reduce((acc, p) => acc + (p.hourly_operating_sec ?? 0), 0) / 60);
    const runMin = Math.round(hourlyPoints.reduce((acc, p) => acc + (p.hourly_run_sec ?? 0), 0) / 60);
    const plannedMin = hourlyPoints.filter((p) => p.planned).length * 60;
    const unplannedMin = Math.max(0, operatingMin - runMin);
    // E11 T11.2 (F-2): hormati rentang from/to — seed demo adalah satu shift
    // (07:00–15:00); jendela shift diproyeksikan ke tanggal kalender `to`
    // (fallback `from`), mengikuti pola anchor T11.1 pada hourly. Angka-angka
    // shift tidak berubah; tanpa from/to, jendela tetap 2026-11-11 seperti
    // sebelumnya.
    // E12 T12.1 (X-1 / FAT-54): bila shift terpilih (options.shift),
    // nama + jendela memakai definisi shift itu (resolveShiftWindow,
    // cross-midnight safe) pada tanggal `date` (fallback anchor from/to).
    // Angka seed tetap angka Shift 1 — demo hanya punya satu set angka
    // shift; yang berubah adalah identitas + jendela shift-nya.
    const { date: shiftDate, offset: shiftOffset } = resolveDemoShiftAnchor(options);
    const selectedShift = findDemoShiftByCode(options?.shift);
    const selectedWindow = selectedShift
      ? resolveShiftWindow(selectedShift, shiftDate, shiftOffset)
      : null;
    const shiftName = selectedShift?.shiftName ?? 'Shift 1 (07:00-15:00)';
    const shiftStart = selectedWindow?.from ?? `${shiftDate}T07:00:00${shiftOffset}`;
    const shiftEnd = selectedWindow?.to ?? `${shiftDate}T15:00:00${shiftOffset}`;
    return {
      shift_name: shiftName,
      machine_id: targetMachine?.machine_id || 'CNC-MILLING-01',
      machine_name: targetMachine?.name || 'CNC Milling Center Alpha',
      shift_start: shiftStart,
      shift_end: shiftEnd,
      tz: 'Asia/Jakarta',
      oee: derived?.oee ?? live?.oee ?? 84.6,
      availability: derived?.availability ?? live?.availability ?? 92.4,
      performance: derived?.performance ?? live?.performance ?? 94.1,
      quality: derived?.quality ?? live?.quality ?? 97.4,
      planned_production_time_min: operatingMin + plannedMin,
      planned_break_min: plannedMin,
      operating_time_min: operatingMin,
      run_time_min: runMin,
      unplanned_downtime_min: unplannedMin,
      planned_downtime_min: plannedMin,
      total_parts: derived?.totalParts ?? live?.total_count ?? 350,
      good_parts: derived?.goodParts ?? live?.good_count ?? 342,
      defect_parts: derived?.defectParts ?? live?.reject_count ?? 8,
      // E20 P20.5 (FAT-157): HAPUS fallback `?? 64` — target unknown
      // (mis. STM32-OEE-05) = `null`, bukan angka karangan (D-8).
      target_per_hour: derived?.targetPerHour ?? null,
      // E20 P20.5 (FAT-157): `include_hourly=true` → sertakan rantai
      // `hourly[]` (§Q.1) — sebelumnya dibuang.
      ...(options?.include_hourly ? { hourly: hourlyPoints } : {}),
    };
  },

  async getShiftTimeline(
    machineId?: string,
    // E20 P20.5 (FAT-157): bucket default dokumen `5m` (§Q.3, §7I) — bukan 15m.
    bucket: '1m' | '5m' | '15m' | '1h' = '5m',
    signal?: AbortSignal,
    options?: TelemetryRangeOptions
  ): Promise<ShiftTimelineSegment[]> {
    checkAbort(signal);
    const qs = new URLSearchParams({ bucket });
    if (machineId) qs.set('machine_id', machineId);
    if (options?.from) qs.set('from', options.from);
    if (options?.to) qs.set('to', options.to);
    // E12 T12.1 (X-1 / FAT-54): date/shift ikut tercatat — sama seperti
    // yang dikirim transport HTTP (API doc §I).
    if (options?.date) qs.set('date', options.date);
    if (options?.shift) qs.set('shift', options.shift);
    store.recordEndpoint('OEE_SHIFT_TIMELINE', `${ADMIN_ENDPOINTS.OEE_SHIFT_TIMELINE.buildPath()}?${qs.toString()}`);
    // E11 T11.4 (F-4): segmen kanonis (5) dipecah eksak per bucket yang
    // diminta — Σ per state tetap 388/60/32 pada semua bucket.
    const segments = rebucketTimelineSegments(CANONICAL_SHIFT_SEGMENTS, bucket);
    // E12 T12.1 (X-1 / FAT-54): hormati shift terpilih — segmen kanonis
    // (jam Shift 1) diproyeksikan ke jendela shift itu (offset jam mulai
    // terhadap 07:00, dipotong ke jendela shift; Shift 3 yang hanya 420 mnt
    // memotong 60 mnt terakhir seed). Tanpa shift terpilih, segmen dipakai
    // apa adanya seperti sebelumnya. Menit absolut dipakai supaya segmen
    // lintas tengah malam tetap jatuh pada hari yang benar.
    const { date: anchorDate, offset: anchorOffset } = resolveDemoShiftAnchor(options);
    const midnightMs = Date.parse(`${anchorDate}T00:00:00${anchorOffset}`);
    const selectedShift = findDemoShiftByCode(options?.shift);
    const windowMin = selectedShift ? shiftWindowAbsMinutes(selectedShift) : null;
    const projected = segments.flatMap((seg) => {
      const startMin = hhmmToMinutes(seg.start);
      const endMin = hhmmToMinutes(seg.end);
      if (!windowMin) return [{ seg, startAbsMin: startMin, endAbsMin: endMin }];
      const startAbsMin = windowMin.start + (startMin - SEED_SHIFT_START_MIN);
      const endAbsMin = windowMin.start + (endMin - SEED_SHIFT_START_MIN);
      const clippedStart = Math.max(startAbsMin, windowMin.start);
      const clippedEnd = Math.min(endAbsMin, windowMin.end);
      if (clippedEnd <= clippedStart) return [];
      const clock = (absMin: number) => minutesToHhmm(((absMin % 1440) + 1440) % 1440);
      return [{
        seg: {
          ...seg,
          start: clock(clippedStart),
          end: clock(clippedEnd),
          duration_min: clippedEnd - clippedStart,
        },
        startAbsMin: clippedStart,
        endAbsMin: clippedEnd,
      }];
    });
    // E11 T11.2 (F-2): hormati rentang from/to — hanya segmen yang
    // bersinggungan dengan rentang yang dikembalikan (batas inklusif, sama
    // seperti bucket hourly). Tanpa from/to, segmen hasil re-bucket (E11
    // T11.4) dikembalikan seperti sebelumnya. Segmen tidak dipotong.
    // E12 T12.11 (X-4 / FAT-59): start/end dikembalikan sebagai ISO 8601
    // Asia/Jakarta (bukan 'HH:MM') — konsisten dengan Real dan bisa
    // diparse mapper (`Date.parse('HH:MM')` = NaN).
    const toIso = (p: { seg: ShiftTimelineSegment; startAbsMin: number; endAbsMin: number }) =>
      toIsoTimelineSegment(p.seg, anchorDate, anchorOffset, p.startAbsMin, p.endAbsMin);
    if (!options?.from && !options?.to) return projected.map(toIso);
    const fromMs = options?.from ? Date.parse(options.from) : NaN;
    const toMs = options?.to ? Date.parse(options.to) : NaN;
    return projected
      .filter(({ startAbsMin, endAbsMin }) => {
        const segStartMs = midnightMs + startAbsMin * 60_000;
        const segEndMs = midnightMs + endAbsMin * 60_000;
        if (Number.isNaN(segStartMs) || Number.isNaN(segEndMs)) return true;
        if (!Number.isNaN(fromMs) && segEndMs < fromMs) return false;
        if (!Number.isNaN(toMs) && segStartMs > toMs) return false;
        return true;
      })
      .map(toIso);
  }
};
