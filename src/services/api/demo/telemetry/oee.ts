/**
 * Method demo — domain OEE.
 *
 * Dipisah dari demo/telemetry.ts pada E11 T11.6 (FAT-49), mengikuti pola
 * R9.2 (kontrak docs/DIRECTORY_STRUCTURE.md). Satu file = satu domain.
 * Barrel penggabung ada di file induknya (../telemetry.ts).
 *
 * Shift summary, timeline shift, OEE per jam, hourly trend,
 * dan aggregate. getOeeHourly memanggil getHourlyTrend lokal
 * (objek domain yang sama).
 */

import { store } from '../store';
import { checkAbort, throwValidationIssues } from '../helpers';
import { ADMIN_ENDPOINTS } from '../../endpoints';
import { ShiftSummary, HourlyOeePoint, ShiftTimelineSegment, TelemetryAggregateResult, TelemetryRangeOptions } from '../../../../types/analytics';
import { Shift } from '../../../../types/production';
import { parseShiftClock, resolveShiftWindow, addDaysToDateString } from '../../../../utils/historicalExport';
import { parseIsoDateAndOffset, rebucketTimelineSegments, CANONICAL_SHIFT_SEGMENTS, hhmmToMinutes, minutesToHhmm, buildDemoAggregateRows } from './helpers';

/** Jam mulai shift seed demo (Shift 1, 07:00) — acuan proyeksi segmen/bucket. */
const SEED_SHIFT_START_MIN = hhmmToMinutes('07:00');

/**
 * E12 T12.1 (X-1 / FAT-54): shift demo dari kode yang dikirim klien
 * (options.shift = Shift.shiftCode, mis. 'S1'). Undefined bila tidak ada
 * shift terpilih atau kode tidak dikenal — perilaku lama dipertahankan.
 */
function findDemoShiftByCode(code?: string): Shift | undefined {
  if (!code) return undefined;
  return store.shifts.find((s) => s.shiftCode === code);
}

/**
 * E12 T12.1: tanggal + offset jangkar demo — `date` eksplisit didahulukan,
 * lalu tanggal dari `to`, lalu `from` (pola anchor T11.1/T11.2). Default
 * tanggal seed 2026-11-11 + offset +07:00 bila tidak ada acuan sama sekali.
 */
function resolveDemoShiftAnchor(options?: TelemetryRangeOptions): { date: string; offset: string } {
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
function shiftWindowAbsMinutes(shift: Shift): { start: number; end: number } {
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
function toIsoTimelineSegment(
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

export const demoTelemetryOee = {
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
    const qStr = qs.toString();
    store.recordEndpoint('OEE_SHIFT_SUMMARY', `${ADMIN_ENDPOINTS.OEE_SHIFT_SUMMARY.buildPath()}${qStr ? `?${qStr}` : ''}`);
    const targetMachine = store.machines.find((m) => m.machine_id === machineId) || store.machines[0];
    const live = store.liveStates.find((l) => l.machine_id === targetMachine?.machine_id);
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
      oee: live?.oee ?? 84.6,
      availability: live?.availability ?? 92.4,
      performance: live?.performance ?? 94.1,
      quality: live?.quality ?? 97.4,
      planned_production_time_min: 480,
      planned_break_min: 60,
      operating_time_min: 420,
      run_time_min: 388,
      unplanned_downtime_min: 32,
      planned_downtime_min: 60,
      total_parts: live?.total_count ?? 350,
      good_parts: live?.good_count ?? 342,
      defect_parts: live?.reject_count ?? 8,
      target_per_hour: 64,
    };
  },

  async getShiftTimeline(
    machineId?: string,
    bucket: '1m' | '5m' | '15m' | '1h' = '15m',
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
  },

  async getOeeHourly(
    params: { machine_id?: string; device_id?: string; from?: string; to?: string; limit?: number; date?: string; shift?: string } = {},
    signal?: AbortSignal
  ): Promise<HourlyOeePoint[]> {
    checkAbort(signal);
    const qs = new URLSearchParams();
    if (params.machine_id) qs.set('machine_id', params.machine_id);
    if (params.device_id) qs.set('device_id', params.device_id);
    if (params.from) qs.set('from', params.from);
    if (params.to) qs.set('to', params.to);
    if (params.limit) qs.set('limit', String(params.limit));
    const qStr = qs.toString();
    store.recordEndpoint('OEE_HOURLY', `${ADMIN_ENDPOINTS.OEE_HOURLY.buildPath()}${qStr ? `?${qStr}` : ''}`);
    const devId =
      params.device_id ||
      store.machines.find((m) => m.machine_id === params.machine_id)?.bound_device_id ||
      'STM32-OEE-01';
    // E12 T12.1 (X-1 / FAT-54): teruskan from/to (+limit) ke getHourlyTrend —
    // sebelumnya dicatat di endpoint tapi TIDAK diteruskan, sehingga tabel
    // per jam halaman OEE di demo mengabaikan periode/shift terpilih.
    // `date`/`shift` diteruskan HANYA sebagai petunjuk proyeksi seed demo
    // (bukan parameter /oee/hourly — API doc §I tidak mendefinisikannya
    // untuk endpoint ini; transport HTTP tidak mengirimnya).
    return demoTelemetryOee.getHourlyTrend(devId, signal, {
      from: params.from,
      to: params.to,
      limit: params.limit,
      date: params.date,
      shift: params.shift,
    });
  },

  async getHourlyTrend(
    deviceId: string,
    signal?: AbortSignal,
    options?: TelemetryRangeOptions
  ): Promise<HourlyOeePoint[]> {
    checkAbort(signal);
    if (!deviceId) {
      throwValidationIssues('device_id wajib disediakan.', { device_id: 'Wajib dipilih.' });
    }
    const qs = new URLSearchParams();
    if (options?.from) qs.set('from', options.from);
    if (options?.to) qs.set('to', options.to);
    if (options?.limit !== undefined) qs.set('limit', String(options.limit));
    const qStr = qs.toString();
    store.recordEndpoint('TELEMETRY_HOURLY', `${ADMIN_ENDPOINTS.TELEMETRY_HOURLY.buildPath(deviceId)}${qStr ? `?${qStr}` : ''}`);
    const isUnknownCapacity = deviceId === 'STM32-OEE-05';
    const points: HourlyOeePoint[] = [
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
      { hour: '07:00', oee: isUnknownCapacity ? 0 : 80.5, availability: isUnknownCapacity ? 100 : 90.3, performance: isUnknownCapacity ? 0 : 91.0, quality: isUnknownCapacity ? 100 : 98.0, parts_produced: isUnknownCapacity ? 0 : 42, good_count: isUnknownCapacity ? 0 : 41, defect_count: isUnknownCapacity ? 0 : 1, hourly_operating_sec: 3600, hourly_run_sec: 3250, sampleCount: 60, targetPerHour: isUnknownCapacity ? null : 50, state: 'RUNNING', planned: false, provisional: false },
      { hour: '08:00', oee: isUnknownCapacity ? 0 : 84.6, availability: isUnknownCapacity ? 100 : 92.4, performance: isUnknownCapacity ? 0 : 94.1, quality: isUnknownCapacity ? 100 : 97.4, parts_produced: isUnknownCapacity ? 0 : 48, good_count: isUnknownCapacity ? 0 : 47, defect_count: isUnknownCapacity ? 0 : 1, hourly_operating_sec: 3600, hourly_run_sec: 3326, sampleCount: 60, targetPerHour: isUnknownCapacity ? null : 50, state: 'RUNNING', planned: false, provisional: false },
      { hour: '09:00', oee: isUnknownCapacity ? 0 : 86.2, availability: isUnknownCapacity ? 100 : 94.0, performance: isUnknownCapacity ? 0 : 93.5, quality: isUnknownCapacity ? 100 : 98.2, parts_produced: isUnknownCapacity ? 0 : 50, good_count: isUnknownCapacity ? 0 : 49, defect_count: isUnknownCapacity ? 0 : 1, hourly_operating_sec: 3600, hourly_run_sec: 3384, sampleCount: 60, targetPerHour: isUnknownCapacity ? null : 50, state: 'RUNNING', planned: false, provisional: false },
      { hour: '10:00', oee: isUnknownCapacity ? 0 : 82.0, availability: isUnknownCapacity ? 100 : 90.0, performance: isUnknownCapacity ? 0 : 92.0, quality: isUnknownCapacity ? 100 : 99.0, parts_produced: isUnknownCapacity ? 0 : 46, good_count: isUnknownCapacity ? 0 : 46, defect_count: 0, hourly_operating_sec: 3600, hourly_run_sec: 3240, sampleCount: 60, targetPerHour: isUnknownCapacity ? null : 50, state: 'RUNNING', planned: false, provisional: false },
      { hour: '11:00', oee: isUnknownCapacity ? 0 : 85.5, availability: isUnknownCapacity ? 100 : 93.0, performance: isUnknownCapacity ? 0 : 94.0, quality: isUnknownCapacity ? 100 : 97.8, parts_produced: isUnknownCapacity ? 0 : 49, good_count: isUnknownCapacity ? 0 : 48, defect_count: isUnknownCapacity ? 0 : 1, hourly_operating_sec: 3600, hourly_run_sec: 3348, sampleCount: 60, targetPerHour: isUnknownCapacity ? null : 50, state: 'RUNNING', planned: false, provisional: false },
      { hour: '12:00', oee: 0.0, availability: 0.0, performance: 0.0, quality: 100.0, parts_produced: 0, good_count: 0, defect_count: 0, hourly_operating_sec: 0, hourly_run_sec: 0, sampleCount: 12, targetPerHour: 0, state: 'PLANNED_DOWNTIME', planned: true, provisional: false },
      { hour: '13:00', oee: isUnknownCapacity ? 0 : 87.8, availability: isUnknownCapacity ? 100 : 95.0, performance: isUnknownCapacity ? 0 : 94.5, quality: isUnknownCapacity ? 100 : 98.0, parts_produced: isUnknownCapacity ? 0 : 52, good_count: isUnknownCapacity ? 0 : 51, defect_count: isUnknownCapacity ? 0 : 1, hourly_operating_sec: 3600, hourly_run_sec: 3420, sampleCount: 60, targetPerHour: isUnknownCapacity ? null : 50, state: 'RUNNING', planned: false, provisional: true },
      { hour: '14:00', oee: isUnknownCapacity ? 0 : 84.0, availability: isUnknownCapacity ? 100 : 92.0, performance: isUnknownCapacity ? 0 : 93.0, quality: isUnknownCapacity ? 100 : 98.2, parts_produced: isUnknownCapacity ? 0 : 47, good_count: isUnknownCapacity ? 0 : 46, defect_count: isUnknownCapacity ? 0 : 1, hourly_operating_sec: 3600, hourly_run_sec: 3312, sampleCount: 44, targetPerHour: isUnknownCapacity ? null : 50, state: 'RUNNING', planned: false, provisional: true },
    ];

    // E11 T11.1 (F-1): hormati rentang from/to — seed demo adalah satu hari
    // shift (07:00–14:00); proyeksikan tiap bucket ke tanggal kalender `to`
    // (fallback `from`) lalu buang bucket di luar rentang. Tanpa from/to,
    // kedelapan bucket dikembalikan seperti sebelumnya.
    // E12 T12.1 (X-1 / FAT-54): bila shift terpilih (options.shift), bucket
    // seed (jam Shift 1) diproyeksikan ke jendela shift itu — sama seperti
    // segmen timeline. `date`/`shift` TIDAK dikirim ke server (bukan
    // parameter /telemetry/:id/hourly); keduanya hanya petunjuk proyeksi
    // seed demo. Menit absolut dipakai supaya bucket lintas tengah malam
    // tetap jatuh pada hari yang benar.
    const { date: anchorDate, offset: anchorOffset } = resolveDemoShiftAnchor(options);
    const midnightMs = Date.parse(`${anchorDate}T00:00:00${anchorOffset}`);
    const selectedShift = findDemoShiftByCode(options?.shift);
    const windowMin = selectedShift ? shiftWindowAbsMinutes(selectedShift) : null;
    const projected = points.flatMap((p) => {
      const hourMin = hhmmToMinutes(p.hour);
      if (!windowMin) return [{ point: p, absMin: hourMin }];
      const absMin = windowMin.start + (hourMin - SEED_SHIFT_START_MIN);
      // Bucket di luar jendela shift dibuang (Shift 3: bucket seed terakhir
      // jatuh tepat di ujung jendela).
      if (absMin < windowMin.start || absMin >= windowMin.end) return [];
      const clock = minutesToHhmm(((absMin % 1440) + 1440) % 1440);
      return [{ point: { ...p, hour: clock }, absMin }];
    });
    let filtered = projected;
    if (options?.from || options?.to) {
      const fromMs = options?.from ? Date.parse(options.from) : NaN;
      const toMs = options?.to ? Date.parse(options.to) : NaN;
      filtered = projected.filter(({ absMin }) => {
        const bucketMs = midnightMs + absMin * 60_000;
        if (Number.isNaN(bucketMs)) return true;
        if (!Number.isNaN(fromMs) && bucketMs < fromMs) return false;
        if (!Number.isNaN(toMs) && bucketMs > toMs) return false;
        return true;
      });
    }
    // Server mengembalikan "N bucket terakhir" bila limit diminta.
    let result = filtered.map((p) => p.point);
    if (options?.limit !== undefined && Number.isFinite(options.limit)) {
      const n = Math.max(0, Math.floor(options.limit));
      result = result.slice(Math.max(0, result.length - n));
    }
    return result;
  },

  async getTelemetryAggregate(
    deviceId: string,
    // E12 T12.18 (U-4 / FAT-65): bucket default dokumen `5m`
    // (Guide tabel endpoint §4.1) — sama dengan transport HTTP.
    bucket: '1m' | '5m' | '15m' | '1h' | '1d' = '5m',
    signal?: AbortSignal,
    options?: TelemetryRangeOptions
  ): Promise<TelemetryAggregateResult> {
    checkAbort(signal);
    const qs = new URLSearchParams({ bucket });
    if (options?.from) qs.set('from', options.from);
    if (options?.to) qs.set('to', options.to);
    if (options?.limit !== undefined) qs.set('limit', String(options.limit));
    store.recordEndpoint(
      'TELEMETRY_AGGREGATE',
      `${ADMIN_ENDPOINTS.TELEMETRY_AGGREGATE.buildPath(deviceId)}?${qs.toString()}`
    );
    const mult = bucket === '1m' ? 12 : bucket === '5m' ? 36 : bucket === '15m' ? 108 : bucket === '1h' ? 432 : 1850;
    // E11 T11.1 (F-1): hormati rentang from/to — jumlah sampel/parts diskalakan
    // sebanding dengan panjang rentang terhadap jendela default 7 hari;
    // rata-rata (avg_*) tidak bergantung pada panjang rentang. Tanpa from/to
    // yang valid, nilai sama seperti sebelumnya (rasio 1).
    const DEFAULT_WINDOW_MS = 7 * 24 * 3600_000;
    let ratio = 1;
    const fromMs = options?.from ? Date.parse(options.from) : NaN;
    const toMs = options?.to ? Date.parse(options.to) : NaN;
    if (!Number.isNaN(fromMs) && !Number.isNaN(toMs)) {
      ratio = Math.max(0, (toMs - fromMs) / DEFAULT_WINDOW_MS);
    }
    const totalSamples = Math.round(mult * ratio);
    const totalParts = deviceId === 'STM32-OEE-05' ? 0 : Math.round(mult * 0.77 * ratio);
    // E12 T12.2 (F-5 / FAT-51): deret per-bucket, bukan satu ringkasan.
    // Jendela = from/to bila valid, atau 7 hari terakhir bila tidak ada.
    // Bucket terakhir (paling baru) ditandai provisional — masih menunggu
    // rekonsiliasi CAgg.
    const windowEndMs = !Number.isNaN(toMs) ? toMs : Date.now();
    const windowStartMs = !Number.isNaN(fromMs) ? fromMs : windowEndMs - DEFAULT_WINDOW_MS;
    let rows = buildDemoAggregateRows(deviceId, bucket, windowStartMs, windowEndMs, totalParts, totalSamples);
    const maxRows = options?.limit !== undefined ? Math.max(0, Math.floor(options.limit)) : 500;
    rows = rows.slice(Math.max(0, rows.length - maxRows));
    return {
      device_id: deviceId,
      bucket,
      avg_oee: deviceId === 'STM32-OEE-05' ? 0 : 83.5,
      avg_availability: deviceId === 'STM32-OEE-05' ? 100 : 91.4,
      avg_performance: deviceId === 'STM32-OEE-05' ? 0 : 93.1,
      avg_quality: deviceId === 'STM32-OEE-05' ? 100 : 98.0,
      total_parts: totalParts,
      sample_count: totalSamples,
      rows,
    };
  },
};
