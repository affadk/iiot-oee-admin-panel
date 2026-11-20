/**
 * Mapper backend→lokal — ringkasan shift + timeline + rekonsiliasi.
 *
 * Dipisah dari mappers/monitoring.ts pada refactoring E31.15 (FAT-278, R10:
 * satu file mapper = satu domain). Barrel penggabung: mappers/monitoring.ts.
 */
import { mapHourly, pctOrNull } from './monitoring-telemetry';
import { MachineFsmState } from '../../../../types/monitoring';
import { ShiftSummary, ShiftTimelineSegment, ReconciliationJob } from '../../../../types/analytics';
import { normalizeFsmState } from '../../../../utils/oeeCalculations';
import { num, str, bool, iso, pick } from '../primitives';
import { timelineSegmentDurationMin } from '../../../../utils/historicalExport';

export function mapShiftSummary(raw: unknown, machineId?: string): ShiftSummary {
  const r = (raw ?? {}) as Record<string, unknown>;
  const time = (r.time_sec ?? r.timeSec ?? {}) as Record<string, unknown>;
  const win = (r.window ?? {}) as Record<string, unknown>;
  const operatingSec = num(pick(time.operating, time.operatingSec), 0);
  const runSec = num(pick(time.run, time.runSec), 0);
  const downtimeSec = num(pick(time.downtime, time.downtimeSec), 0);
  // E12 T12.4 (F-7 / FAT-55): planned downtime dibaca dari field-nya sendiri
  // bila server mengirimnya (API doc §Q.1 / TELEMETRY_AUDIT F-7:
  // `time_sec.planned`), bukan hardcode 0. Alias detik dulu (kanonis
  // `time_sec.*`), lalu alias menit (`planned_downtime_min`). Bila tidak
  // dikirim sama sekali → fallback 0 seperti sebelumnya. Panel HANYA membaca
  // field ini; definisi availability untuk jam planned penuh (G8 sisi server)
  // tetap keputusan backend/CAgg — panel tidak menghitung ulang OEE di klien
  // (Build Guide §14.3).
  const plannedDowntimeSec = pick(time.planned, time.plannedSec, time.plannedDowntimeSec, time.planned_downtime_sec);
  const plannedDowntimeMinRaw = pick(r.planned_downtime_min, r.plannedDowntimeMin, time.plannedDowntimeMin, time.planned_downtime_min);
  const plannedDowntimeMin = plannedDowntimeSec !== undefined
    ? Math.round(num(plannedDowntimeSec) / 60)
    : plannedDowntimeMinRaw !== undefined
      ? Math.round(num(plannedDowntimeMinRaw))
      : 0;
  // E12 T12.4 (F-7 / FAT-55): planned production time dari field-nya sendiri
  // bila dikirim server (`time_sec.planned_production`, atau
  // `planned_operating_sec` — nama yang dipakai API doc untuk konsep yang
  // sama di shift_plan WO resolve — atau `planned_production_time_min`
  // beserta alias camelCase/snake_case-nya), bukan dari `operatingSec`.
  // Bila tidak dikirim → fallback perilaku lama (`operatingSec` / 60) agar
  // angka yang sudah ada tidak berubah.
  const plannedProductionSec = pick(
    time.planned_production, time.plannedProductionSec, time.planned_production_sec,
    time.plannedOperatingSec, time.planned_operating_sec,
    r.planned_operating_sec, r.plannedOperatingSec,
  );
  const plannedProductionMinRaw = pick(
    r.planned_production_time_min, r.plannedProductionTimeMin,
    time.plannedProductionTimeMin, time.planned_production_time_min,
  );
  const plannedProductionTimeMin = plannedProductionSec !== undefined
    ? Math.round(num(plannedProductionSec) / 60)
    : plannedProductionMinRaw !== undefined
      ? Math.round(num(plannedProductionMinRaw))
      : Math.round(operatingSec / 60);
  // E23 Batch 3 (FAT-196, N-27): spec live TANPA totalCount/goodCount/
  // rejectCount dan TANPA nama shift/mesin. Parts diturunkan dari
  // hourly[] bila include_hourly diminta/dikembalikan — jumlahkan delta
  // per bucket seperti pola N-11 (total = Σ parts_produced, defect =
  // Σ defect_count, good = Σ good_count, fallback max(0, total−defect)
  // per bucket bila good_count tak ada); count eksplisit (demo/bentuk
  // lama) tetap menang. Tanpa hourly → null (tidak diketahui), JANGAN
  // fabrikasi 0. Nama shift/mesin → null bila tak dikirim (bukan
  // 'Shift'/'').
  const hourly = Array.isArray(r.hourly) ? (r.hourly as unknown[]).map((h) => mapHourly(h)) : undefined;
  const explicitTotal = pick(r.totalCount, r.total_count);
  const explicitGood = pick(r.goodCount, r.good_count);
  const explicitDefect = pick(r.rejectCount, r.reject_count);
  // E28 Batch A (FAT-218 E2E-04): turunan parts dari hourly[] hanya sah
  // bila SEMUA bucket membawa parts_produced — satu bucket null (totalCount
  // tidak diketahui) membuat Σ tidak diketahui → null, JANGAN fabrikasi 0.
  const derivedParts =
    hourly && hourly.length > 0 && !hourly.some((p) => p.parts_produced === null)
      ? hourly.reduce(
          (acc, p) => {
            // Guard `.some(... === null)` di atas menjamin tidak ada null
            // di sini; `?? 0` hanya untuk meyakinkan type-checker.
            const total = p.parts_produced ?? 0;
            const defect = p.defect_count;
            const good = p.good_count ?? Math.max(0, total - defect);
            return { total: acc.total + total, good: acc.good + good, defect: acc.defect + defect };
          },
          { total: 0, good: 0, defect: 0 },
        )
      : null;
  return {
    shift_name: (pick(r.shift_name, r.shiftName, r.shift) as string | null) ?? null,
    machine_id: str(pick(r.machine_id, r.machineId, machineId), ''),
    machine_name: (pick(r.machine_name, r.machineName) as string | null) ?? null,
    shift_start: iso(pick(win.from, r.shift_start, r.from)),
    shift_end: iso(pick(win.to, r.shift_end, r.to)),
    tz: str(pick(win.tz, r.tz), undefined) || undefined,
    // E28 Batch A (FAT-213 N-43): `*Pct` ringkasan nullable seperti agregat
    // (pctOrNull) — bila server mengirim semuanya null (kapasitas unknown /
    // bucket kosong), kartu ringkasan menampilkan '—', BUKAN 0%. Nilai yang
    // ADA tetap dipakai apa adanya (matematika tidak berubah).
    oee: pctOrNull(r.oeePct, r.oee),
    availability: pctOrNull(r.availabilityPct, r.availability),
    performance: pctOrNull(r.performancePct, r.performance),
    quality: pctOrNull(r.qualityPct, r.quality),
    planned_production_time_min: plannedProductionTimeMin,
    planned_break_min: num(pick(r.planned_break_min), 0) || undefined,
    operating_time_min: Math.round(operatingSec / 60),
    run_time_min: Math.round(runSec / 60),
    unplanned_downtime_min: Math.round(downtimeSec / 60),
    planned_downtime_min: plannedDowntimeMin,
    total_parts: explicitTotal !== undefined ? num(explicitTotal, 0) : (derivedParts?.total ?? null),
    good_parts: explicitGood !== undefined ? num(explicitGood, 0) : (derivedParts?.good ?? null),
    defect_parts: explicitDefect !== undefined ? num(explicitDefect, 0) : (derivedParts?.defect ?? null),
    target_per_hour: (pick(r.target_per_hour, r.targetPerHour) as number | null) ?? null,
    // E20 P20.5 (FAT-157): baca `hourly[]` bila server menyertakannya
    // (`include_hourly=true`, §Q.1) — sebelumnya dibuang.
    hourly,
  };
}

export function mapTimelineSegment(raw: unknown): ShiftTimelineSegment {
  const r = (raw ?? {}) as Record<string, unknown>;
  const start = iso(pick(r.start));
  const end = iso(pick(r.end));
  return {
    start,
    end,
    fsm_state: normalizeFsmState(str(pick(r.state), 'UNCONFIGURED')) as MachineFsmState,
    planned: bool(pick(r.planned), false),
    // E28 Batch B (FAT-225, E2E-11 — TERKONFIRMASI dari kode): server
    // mengirim `downtime_id` numerik (id event downtime adalah number —
    // lihat `mapDowntime`: `id: String(...)`), sementara peta overlay
    // memakai kunci string. `pick(...) as string` TIDAK mengubah number
    // menjadi string di runtime — lookup `Map<string>` gagal dan panel
    // menampilkan "Downtime ID: 2 tidak ditemukan di antara 2 event"
    // padahal event 2 sudah dimuat. Selalu String() bila ada nilainya.
    downtime_id: (() => {
      const v = pick(r.downtime_id, r.downtimeId);
      return v === null || v === undefined ? null : String(v);
    })(),
    // E12 T12.11 (X-4 / FAT-59): durasi benar untuk ISO 8601 (Real/demo
    // baru) MAUPUN 'HH:MM' polos (format demo lama) — `Date.parse('HH:MM')`
    // = NaN sehingga hitungan lama menghasilkan NaN di sini.
    duration_min: timelineSegmentDurationMin(start, end),
  };
}

export function mapReconciliationJob(raw: unknown): ReconciliationJob {
  const r = (raw ?? {}) as Record<string, unknown>;
  // E23 Batch 2 (FAT-191, N-22): spec live
  // `{jobId, applicationName, scheduleInterval, maxRuntime,
  // lastRunStartedAt, lastSuccessfulFinish, lastRunStatus}` — mapper lama
  // membaca `name/view_name/last_run/lastStatus` yang TAK ADA di spec
  // (nama '', last_run epoch 1970, status selalu 'SUCCESS').
  // - `jobId` spec berupa number → string lokal.
  // - `view_name` tidak ada di spec; diisi applicationName agar deteksi
  //   hourly/daily di DataReconciliationPage tetap jalan.
  // - `last_run` = lastRunStartedAt (fallback lastSuccessfulFinish bila
  //   start tak ada); null → '' (bukan epoch — jangan pakai `iso()`).
  // - `lastRunStatus` nullable; nilai di luar union lokal → 'SUCCESS'.
  // - Spec tidak membawa `refresh_window_hours`/`records_processed` →
  //   tetap 0; `maxRuntime` tidak punya field lokal → tidak dipetakan.
  const jobIdRaw = pick(r.jobId, r.job_id);
  const appName = str(pick(r.applicationName, r.application_name, r.name), '');
  const lastRunStatus = pick(r.lastRunStatus, r.last_run_status, r.lastStatus, r.last_status);
  const startedAt = pick(r.lastRunStartedAt, r.last_run_started_at);
  const finishedAt = pick(r.lastSuccessfulFinish, r.last_successful_finish);
  const tsOrEmpty = (v: unknown): string => (typeof v === 'string' && v ? v : '');
  return {
    job_id: typeof jobIdRaw === 'number' ? String(jobIdRaw) : str(jobIdRaw, ''),
    name: appName,
    view_name: str(pick(r.view_name, r.viewName), appName),
    schedule_interval: str(pick(r.scheduleInterval, r.schedule_interval), ''),
    last_run: tsOrEmpty(startedAt) || tsOrEmpty(finishedAt),
    last_successful_finish: tsOrEmpty(finishedAt) || undefined,
    last_status: (
      lastRunStatus === 'SUCCESS' || lastRunStatus === 'RUNNING' || lastRunStatus === 'FAILED'
        ? lastRunStatus
        : 'SUCCESS'
    ) as ReconciliationJob['last_status'],
    refresh_window_hours: num(pick(r.refresh_window_hours, r.refreshWindowHours), 0),
    records_processed: num(pick(r.records_processed, r.recordsProcessed), 0),
  };
}
