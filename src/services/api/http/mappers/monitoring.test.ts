import test from 'node:test';
import assert from 'node:assert/strict';
import { mapHourly, mapShiftSummary, mapTelemetryHistory, mapTimelineSegment } from './monitoring';

// ---------------------------------------------------------------------------
// E12 T12.3 (F-6 / FAT-53): mapHourly mempertahankan null pada targetPerHour
// (kapasitas unknown) supaya tabel per jam bisa menampilkan
// "— (Kapasitas 0/Unknown)" seperti rollup — `pick` membuang null sehingga
// sinyal ini hilang bila lewat pick. Nilai 0 dan angka biasa tetap lolos
// apa adanya; field yang tidak dikirim menjadi undefined.
// ---------------------------------------------------------------------------

function rawHourly(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    bucket: '07:00',
    oeePct: 80.5,
    availabilityPct: 90.3,
    performancePct: 91.0,
    qualityPct: 98.0,
    totalCount: 42,
    rejectCount: 1,
    goodCount: 41,
    operatingSec: 3600,
    runSec: 3250,
    sampleCount: 60,
    targetPerHour: 50,
    state: 'RUNNING',
    planned: false,
    provisional: false,
    ...overrides,
  };
}

test('mapHourly mempertahankan targetPerHour null (kapasitas unknown)', () => {
  const pt = mapHourly(rawHourly({ targetPerHour: null, performancePct: null }));
  assert.equal(pt.targetPerHour, null);
  assert.equal(pt.performance, 0);
});

test('mapHourly mempertahankan targetPerHour snake_case null', () => {
  const pt = mapHourly({ ...rawHourly(), targetPerHour: undefined, target_per_hour: null });
  assert.equal(pt.targetPerHour, null);
});

test('mapHourly mempertahankan targetPerHour 0 dan angka biasa', () => {
  assert.equal(mapHourly(rawHourly({ targetPerHour: 0 })).targetPerHour, 0);
  assert.equal(mapHourly(rawHourly({ targetPerHour: 50 })).targetPerHour, 50);
});

test('mapHourly menghasilkan undefined bila target tidak dikirim', () => {
  const raw = rawHourly();
  delete raw.targetPerHour;
  assert.equal(mapHourly(raw).targetPerHour, undefined);
});

test('mapHourly memetakan field kolom baru F-6', () => {
  const pt = mapHourly(rawHourly());
  assert.equal(pt.good_count, 41);
  assert.equal(pt.hourly_operating_sec, 3600);
  assert.equal(pt.hourly_run_sec, 3250);
  assert.equal(pt.sampleCount, 60);
});

test('E12 T12.14: mapHourly membuang hourly_downtime_sec bila server usang masih mengirimnya', () => {
  // Mapper HTTP memang tidak pernah memetakan field ini (G16: hidup di
  // tipe + seed + CSV, mati di mapper) — ditegaskan di sini supaya field
  // hantu itu tidak kembali lewat jalur Real bila server lama mengirimnya.
  const pt = mapHourly(rawHourly({ hourly_downtime_sec: 350, hourlyDowntimeSec: 350 }));
  assert.ok(!('hourly_downtime_sec' in pt));
  assert.ok(!('hourlyDowntimeSec' in pt));
});

// ---------------------------------------------------------------------------
// E12 T12.4 (F-7 / FAT-55): mapShiftSummary membaca planned downtime +
// planned production time dari field-nya sendiri bila server mengirimnya
// (bukan hardcode 0 / bukan dari operatingSec). Bila tidak dikirim, fallback
// ke perilaku lama (0 dan operatingSec/60) agar angka yang sudah ada —
// termasuk rekonsiliasi demo E11 — tidak berubah.
// ---------------------------------------------------------------------------

function rawShiftSummary(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    shift_name: 'Shift 1',
    machine_id: 'CNC-MILLING-01',
    oee: 84.6,
    availability: 92.4,
    performance: 94.1,
    quality: 97.4,
    time_sec: { operating: 25200, run: 23280, downtime: 1920 },
    window: { from: '2026-11-11T07:00:00+07:00', to: '2026-11-11T15:00:00+07:00', tz: 'Asia/Jakarta' },
    totalCount: 350,
    goodCount: 342,
    rejectCount: 8,
    ...overrides,
  };
}

test('mapShiftSummary membaca time_sec.planned (detik) sebagai planned_downtime_min', () => {
  const s = mapShiftSummary(rawShiftSummary({ time_sec: { operating: 25200, run: 23280, downtime: 1920, planned: 3600 } }));
  assert.equal(s.planned_downtime_min, 60);
  assert.equal(s.unplanned_downtime_min, 32);
  assert.equal(s.operating_time_min, 420);
});

test('mapShiftSummary membaca alias planned_downtime_sec dan planned_downtime_min', () => {
  const bySec = mapShiftSummary(rawShiftSummary({ time_sec: { operating: 25200, run: 23280, downtime: 1920, planned_downtime_sec: 1800 } }));
  assert.equal(bySec.planned_downtime_min, 30);
  const byMin = mapShiftSummary(rawShiftSummary({ planned_downtime_min: 45 }));
  assert.equal(byMin.planned_downtime_min, 45);
  const byMinCamel = mapShiftSummary(rawShiftSummary({ plannedDowntimeMin: 15 }));
  assert.equal(byMinCamel.planned_downtime_min, 15);
});

test('mapShiftSummary fallback planned_downtime_min 0 bila tidak dikirim', () => {
  const s = mapShiftSummary(rawShiftSummary());
  assert.equal(s.planned_downtime_min, 0);
  assert.equal(s.unplanned_downtime_min, 32);
});

test('mapShiftSummary membaca planned_production_time_min dari field-nya sendiri', () => {
  // Field menit top-level — berbeda dari operating (420) agar fallback
  // terbedakan: 480 menit = jendela shift penuh.
  const byMin = mapShiftSummary(rawShiftSummary({ planned_production_time_min: 480 }));
  assert.equal(byMin.planned_production_time_min, 480);
  assert.equal(byMin.operating_time_min, 420);
  // Field detik di time_sec (kanonis) — 28800 dtk = 480 mnt.
  const bySec = mapShiftSummary(rawShiftSummary({
    time_sec: { operating: 25200, run: 23280, downtime: 1920, planned_production: 28800 },
  }));
  assert.equal(bySec.planned_production_time_min, 480);
  assert.equal(bySec.operating_time_min, 420);
});

test('mapShiftSummary membaca alias planned_operating_sec untuk planned production time', () => {
  const s = mapShiftSummary(rawShiftSummary({ planned_operating_sec: 28800 }));
  assert.equal(s.planned_production_time_min, 480);
  assert.equal(s.operating_time_min, 420);
});

test('mapShiftSummary fallback planned_production_time_min ke operatingSec bila tidak dikirim', () => {
  const s = mapShiftSummary(rawShiftSummary());
  assert.equal(s.planned_production_time_min, 420);
  assert.equal(s.operating_time_min, 420);
});

// ---------------------------------------------------------------------------
// E12 T12.11 (X-4 / FAT-59): mapTimelineSegment menghitung duration_min
// dengan benar untuk ISO 8601 (Real/demo baru) MAUPUN 'HH:MM' polos
// (format demo lama) — hitungan lama `Date.parse('HH:MM')` = NaN.
// ---------------------------------------------------------------------------

test('mapTimelineSegment menghitung duration_min dari ISO 8601', () => {
  const seg = mapTimelineSegment({
    start: '2026-11-11T07:00:00+07:00',
    end: '2026-11-11T09:15:00+07:00',
    state: 'RUNNING',
    planned: false,
  });
  assert.equal(seg.start, '2026-11-11T07:00:00+07:00');
  assert.equal(seg.duration_min, 135);
});

test('mapTimelineSegment menghitung duration_min dari HH:MM polos (transisi)', () => {
  const seg = mapTimelineSegment({ start: '07:00', end: '09:15', state: 'RUNNING' });
  assert.equal(seg.duration_min, 135);
  // Lintas tengah malam dalam format lama: 23:30 -> 01:00 = 90 menit.
  const night = mapTimelineSegment({ start: '23:30', end: '01:00', state: 'RUNNING' });
  assert.equal(night.duration_min, 90);
});

test('mapTimelineSegment tidak pernah menghasilkan NaN untuk format tak dikenal', () => {
  const seg = mapTimelineSegment({ start: 'bukan-jam', end: 'juga-bukan', state: 'RUNNING' });
  assert.equal(seg.duration_min, 0);
  assert.ok(Number.isFinite(seg.duration_min));
});

// ---------------------------------------------------------------------------
// E12 T12.15 (F-11 / FAT-67): mapTelemetryHistory menentukan satuan
// cycle_time_ms dari NAMA field — `cycleTimeMs`/`cycle_time_ms` sudah
// milidetik (×1), `lastCycleTimeSec`/`last_cycle_time_sec` detik (×1000).
// Hitungan lama `pick(...) × 1000` membuat nilai 1000× lebih besar bila
// server mengirim cycleTimeMs (G20). Prioritas: field ms dulu.
// ---------------------------------------------------------------------------

function rawHistory(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    id: 'tel-001',
    deviceId: 'STM32-OEE-01',
    recordedAt: '2026-11-11T07:00:00+07:00',
    state: 'RUNNING',
    totalCount: 100,
    goodCount: 98,
    rejectCount: 2,
    oeePct: 84.6,
    availabilityPct: 92.4,
    performancePct: 94.1,
    qualityPct: 98.0,
    ...overrides,
  };
}

test('mapTelemetryHistory tidak mengalikan cycleTimeMs (sudah milidetik)', () => {
  const rec = mapTelemetryHistory(rawHistory({ cycleTimeMs: 42100 }));
  assert.equal(rec.cycle_time_ms, 42100);
  assert.equal(rec.lastCycleTimeSec, undefined);
});

test('mapTelemetryHistory tidak mengalikan alias snake_case cycle_time_ms', () => {
  const rec = mapTelemetryHistory(rawHistory({ cycle_time_ms: 42500 }));
  assert.equal(rec.cycle_time_ms, 42500);
});

test('mapTelemetryHistory mengalikan lastCycleTimeSec (detik) dengan 1000', () => {
  const rec = mapTelemetryHistory(rawHistory({ lastCycleTimeSec: 42.1 }));
  assert.equal(rec.cycle_time_ms, 42100);
  assert.equal(rec.lastCycleTimeSec, 42.1);
});

test('mapTelemetryHistory mengalikan alias snake_case last_cycle_time_sec dengan 1000', () => {
  const rec = mapTelemetryHistory(rawHistory({ last_cycle_time_sec: 42.5 }));
  assert.equal(rec.cycle_time_ms, 42500);
  assert.equal(rec.lastCycleTimeSec, 42.5);
});

test('mapTelemetryHistory memprioritaskan field ms bila ms dan detik sama-sama dikirim', () => {
  // Server mengirim keduanya (42.1 dtk = 42100 ms vs 99.9 dtk yang
  // bertentangan) — field ms menang, tanpa konversi.
  const rec = mapTelemetryHistory(rawHistory({ cycleTimeMs: 42100, lastCycleTimeSec: 99.9 }));
  assert.equal(rec.cycle_time_ms, 42100);
  assert.equal(rec.lastCycleTimeSec, 99.9);
});

test('mapTelemetryHistory mengembalikan cycle_time_ms 0 bila tidak ada field cycle time', () => {
  const rec = mapTelemetryHistory(rawHistory());
  assert.equal(rec.cycle_time_ms, 0);
  assert.equal(rec.lastCycleTimeSec, undefined);
});

test('mapTelemetryHistory menerima nilai cycle time berupa string angka (API doc mengirim string)', () => {
  const rec = mapTelemetryHistory(rawHistory({ cycleTimeMs: '42100' }));
  assert.equal(rec.cycle_time_ms, 42100);
  const bySec = mapTelemetryHistory(rawHistory({ lastCycleTimeSec: '42.1' }));
  assert.equal(bySec.cycle_time_ms, 42100);
  assert.equal(bySec.lastCycleTimeSec, 42.1);
});
