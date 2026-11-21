/**
 * Method demo — domain OEE (telemetry): OEE per jam + tren per jam + agregat.
 *
 * Dipisah dari demo/telemetry/oee.ts (489 baris) pada E32.5 (FAT-286),
 * mengikuti pola R9.2 (kontrak docs/DIRECTORY_STRUCTURE.md). Satu file =
 * satu sub-domain. Barrel penggabung ada di file induknya (../oee.ts).
 */
import { store } from '../../store';
import { checkAbort, throwValidationIssues } from '../../helpers';
import { ADMIN_ENDPOINTS } from '../../../endpoints';
import { HourlyOeePoint, TelemetryAggregateResult, TelemetryRangeOptions } from '../../../../../types/analytics';
import { addDaysToDateString } from '../../../../../utils/historicalExport';
import { buildDemoAggregateRows, hhmmToMinutes, minutesToHhmm } from '../helpers';
import { buildDemoHourlyPoints, findDemoShiftByCode, resolveDemoShiftAnchor, shiftWindowAbsMinutes, SEED_SHIFT_START_MIN } from './seed';

export const demoTelemetryOeeHourly = {
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
    return demoTelemetryOeeHourly.getHourlyTrend(devId, signal, {
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
    const points = buildDemoHourlyPoints(deviceId);

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
    // E20 P20.5 (FAT-157): jam dinding diambil dari `bucket` ISO
    // (titik demo kini membawa bucket ISO, bukan 'HH:MM' polos).
    const clockFromPoint = (p: HourlyOeePoint): string => {
      const m = /T(\d{2}:\d{2})/.exec(p.bucket ?? p.hour);
      return m ? m[1] : p.hour;
    };
    const isoAt = (absMin: number) => {
      const dayOffset = Math.floor(absMin / 1440);
      const clock = minutesToHhmm(((absMin % 1440) + 1440) % 1440);
      const date = addDaysToDateString(anchorDate, dayOffset) ?? anchorDate;
      return `${date}T${clock}:00${anchorOffset}`;
    };
    const projected = points.flatMap((p) => {
      const hourMin = hhmmToMinutes(clockFromPoint(p));
      if (!windowMin) return [{ point: p, absMin: hourMin }];
      const absMin = windowMin.start + (hourMin - SEED_SHIFT_START_MIN);
      // Bucket di luar jendela shift dibuang (Shift 3: bucket seed terakhir
      // jatuh tepat di ujung jendela).
      if (absMin < windowMin.start || absMin >= windowMin.end) return [];
      const bucketIso = isoAt(absMin);
      return [{ point: { ...p, hour: bucketIso, bucket: bucketIso }, absMin }];
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
  }
};
