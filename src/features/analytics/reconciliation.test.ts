import test from 'node:test';
import assert from 'node:assert/strict';
import {
  computeOeeReconciliation,
  formatReconciliationDiff,
  formatReconciliationValue,
  RECONCILIATION_RELATIVE_TOLERANCE,
  RECONCILIATION_TIME_TOLERANCE_SEC,
} from './reconciliation';
import { HourlyOeePoint, ShiftSummary, ShiftTimelineSegment } from '../../types/analytics';

// ---------------------------------------------------------------------------
// E12 T12.6 (U-3 / FAT-56): indikator rekonsiliasi halaman OEE (gap G2).
// Fixture memakai angka seed demo apa adanya (oee.ts): 8 bucket jam
// 07:00–14:00 + 5 segmen timeline kanonis T11.4 + ringkasan shift demo.
// ---------------------------------------------------------------------------

/** Ringkasan shift demo — angka dari Σ jam (Opsi A T12.6a): 334/328/6, OEE 86,6. */
const DEMO_SUMMARY: ShiftSummary = {
  shift_name: 'Shift 1 (07:00-15:00)',
  machine_id: 'CNC-MILLING-01',
  machine_name: 'CNC Milling Center Alpha',
  shift_start: '2026-11-11T07:00:00+07:00',
  shift_end: '2026-11-11T15:00:00+07:00',
  tz: 'Asia/Jakarta',
  oee: 86.6,
  availability: 92.4,
  performance: 95.4,
  quality: 98.2,
  planned_production_time_min: 480,
  planned_break_min: 60,
  operating_time_min: 420,
  run_time_min: 388,
  unplanned_downtime_min: 32,
  planned_downtime_min: 60,
  total_parts: 334,
  good_parts: 328,
  defect_parts: 6,
  target_per_hour: 50,
};

/** Ringkasan lama sebelum Opsi A — parts dari counter live-state (350/342/8). */
const LEGACY_SUMMARY: ShiftSummary = {
  ...DEMO_SUMMARY,
  oee: 84.6,
  performance: 94.1,
  quality: 97.4,
  total_parts: 350,
  good_parts: 342,
  defect_parts: 8,
  target_per_hour: 64,
};

/** Seperti DEMO_SUMMARY, tapi parts = Σ jam (334/328/6) — sepenuhnya cocok. */
const CONSISTENT_SUMMARY: ShiftSummary = {
  ...DEMO_SUMMARY,
  total_parts: 334,
  good_parts: 328,
  defect_parts: 6,
};

function hourlyPoint(
  hour: string,
  runSec: number,
  parts: number,
  good: number,
  defect: number
): HourlyOeePoint {
  return {
    hour,
    oee: 0,
    availability: 0,
    performance: 0,
    quality: 0,
    parts_produced: parts,
    defect_count: defect,
    good_count: good,
    hourly_run_sec: runSec,
    hourly_operating_sec: 3600,
    sampleCount: 60,
  };
}

/** 8 bucket seed demo: Σ run 23.280 dtk, Σ parts 334 / good 328 / defect 6. */
const DEMO_HOURLY: HourlyOeePoint[] = [
  hourlyPoint('07:00', 3250, 42, 41, 1),
  hourlyPoint('08:00', 3326, 48, 47, 1),
  hourlyPoint('09:00', 3384, 50, 49, 1),
  hourlyPoint('10:00', 3240, 46, 46, 0),
  hourlyPoint('11:00', 3348, 49, 48, 1),
  hourlyPoint('12:00', 0, 0, 0, 0),
  hourlyPoint('13:00', 3420, 52, 51, 1),
  hourlyPoint('14:00', 3312, 47, 46, 1),
];

function timelineSegment(
  start: string,
  end: string,
  state: ShiftTimelineSegment['fsm_state'],
  durationMin: number
): ShiftTimelineSegment {
  return { start, end, fsm_state: state, duration_min: durationMin };
}

/** 5 segmen kanonis T11.4: RUNNING 388 · PLANNED 60 · UNPLANNED 32. */
const DEMO_TIMELINE: ShiftTimelineSegment[] = [
  timelineSegment('07:00', '09:15', 'RUNNING', 135),
  timelineSegment('09:15', '09:47', 'UNPLANNED_DOWNTIME', 32),
  timelineSegment('09:47', '12:00', 'RUNNING', 133),
  timelineSegment('12:00', '13:00', 'PLANNED_DOWNTIME', 60),
  timelineSegment('13:00', '15:00', 'RUNNING', 120),
];

test('ambang yang dipakai indikator: 60 detik absolut, 1% relatif', () => {
  assert.equal(RECONCILIATION_TIME_TOLERANCE_SEC, 60);
  assert.equal(RECONCILIATION_RELATIVE_TOLERANCE, 0.01);
});

test('seed demo setelah Opsi A (T12.6a): semua cocok (8 check, 0 peringatan)', () => {
  const rec = computeOeeReconciliation(DEMO_SUMMARY, DEMO_HOURLY, DEMO_TIMELINE);
  assert.equal(rec.hasData, true);
  assert.equal(rec.checks.length, 8);
  assert.equal(rec.isConsistent, true);
  assert.equal(rec.warningCount, 0);
  assert.ok(rec.checks.every((c) => c.status === 'ok'));

  const byId = new Map(rec.checks.map((c) => [c.id, c]));

  // Waktu — sudah direkonsiliasi di T11.4.
  const run = byId.get('hourly-run-vs-summary')!;
  assert.equal(run.leftValue, 23280);
  assert.equal(run.rightValue, 23280);
  assert.equal(run.diff, 0);
  assert.equal(run.status, 'ok');
  assert.equal(byId.get('timeline-running-vs-summary')!.status, 'ok');
  assert.equal(byId.get('timeline-running-vs-summary')!.leftValue, 388);
  assert.equal(byId.get('timeline-planned-vs-summary')!.status, 'ok');
  assert.equal(byId.get('timeline-planned-vs-summary')!.leftValue, 60);
  assert.equal(byId.get('timeline-unplanned-vs-summary')!.status, 'ok');
  assert.equal(byId.get('timeline-unplanned-vs-summary')!.leftValue, 32);
  assert.equal(byId.get('timeline-total-vs-window')!.status, 'ok');
  assert.equal(byId.get('timeline-total-vs-window')!.leftValue, 480);

  // Parts — cocok setelah Opsi A: Σ jam 334/328/6 = ringkasan 334/328/6.
  const parts = byId.get('hourly-parts-vs-summary')!;
  assert.equal(parts.leftValue, 334);
  assert.equal(parts.rightValue, 334);
  assert.equal(parts.diff, 0);
  assert.equal(parts.status, 'ok');
  assert.equal(byId.get('hourly-good-vs-summary')!.diff, 0);
  assert.equal(byId.get('hourly-good-vs-summary')!.status, 'ok');
  assert.equal(byId.get('hourly-defect-vs-summary')!.diff, 0);
  assert.equal(byId.get('hourly-defect-vs-summary')!.status, 'ok');
});

test('peringatan parts tetap terdeteksi bila ringkasan memakai counter live lama (334 vs 350)', () => {
  const rec = computeOeeReconciliation(LEGACY_SUMMARY, DEMO_HOURLY, DEMO_TIMELINE);
  assert.equal(rec.isConsistent, false);
  assert.equal(rec.warningCount, 3);

  const byId = new Map(rec.checks.map((c) => [c.id, c]));
  // Σ jam 334/328/6 vs ringkasan (live counter) 350/342/8.
  const parts = byId.get('hourly-parts-vs-summary')!;
  assert.equal(parts.leftValue, 334);
  assert.equal(parts.rightValue, 350);
  assert.equal(parts.diff, -16);
  assert.equal(parts.status, 'warning');
  assert.equal(byId.get('hourly-good-vs-summary')!.diff, -14);
  assert.equal(byId.get('hourly-good-vs-summary')!.status, 'warning');
  assert.equal(byId.get('hourly-defect-vs-summary')!.diff, -2);
  assert.equal(byId.get('hourly-defect-vs-summary')!.status, 'warning');
});

test('semua cocok bila ringkasan memakai Σ jam (334/328/6)', () => {
  const rec = computeOeeReconciliation(CONSISTENT_SUMMARY, DEMO_HOURLY, DEMO_TIMELINE);
  assert.equal(rec.isConsistent, true);
  assert.equal(rec.warningCount, 0);
  assert.ok(rec.checks.every((c) => c.status === 'ok'));
});

test('peringatan saat Σ hourly_run_sec selisih 120 detik dari ringkasan', () => {
  const short = DEMO_HOURLY.map((p, i) =>
    i === 0 ? { ...p, hourly_run_sec: (p.hourly_run_sec ?? 0) - 120 } : p
  );
  const rec = computeOeeReconciliation(CONSISTENT_SUMMARY, short, DEMO_TIMELINE);
  assert.equal(rec.warningCount, 1);
  assert.equal(rec.isConsistent, false);
  const run = rec.checks.find((c) => c.id === 'hourly-run-vs-summary')!;
  assert.equal(run.diff, -120);
  assert.equal(run.status, 'warning');
  // Check lain tidak ikut memberi peringatan.
  assert.ok(rec.checks.filter((c) => c.id !== 'hourly-run-vs-summary').every((c) => c.status === 'ok'));
});

test('selisih 30 detik masih dalam ambang (tidak memberi peringatan)', () => {
  const short = DEMO_HOURLY.map((p, i) =>
    i === 0 ? { ...p, hourly_run_sec: (p.hourly_run_sec ?? 0) - 30 } : p
  );
  const rec = computeOeeReconciliation(CONSISTENT_SUMMARY, short, DEMO_TIMELINE);
  assert.equal(rec.warningCount, 0);
  assert.equal(rec.isConsistent, true);
  assert.equal(rec.checks.find((c) => c.id === 'hourly-run-vs-summary')!.diff, -30);
});

test('ambang relatif: selisih 30 detik pada jendela 30 menit memberi peringatan', () => {
  // 1% dari 1.800 dtk = 18 dtk < 30 dtk, meski masih di bawah 60 detik absolut.
  const summary: ShiftSummary = {
    ...CONSISTENT_SUMMARY,
    planned_production_time_min: 30,
    operating_time_min: 30,
    run_time_min: 30,
    unplanned_downtime_min: 0,
    planned_downtime_min: 0,
    total_parts: 100,
    good_parts: 98,
    defect_parts: 2,
  };
  const hourly = [hourlyPoint('07:00', 1770, 100, 98, 2)];
  const timeline = [timelineSegment('07:00', '07:30', 'RUNNING', 30)];
  const rec = computeOeeReconciliation(summary, hourly, timeline);
  assert.equal(rec.checks.find((c) => c.id === 'hourly-run-vs-summary')!.status, 'warning');
  assert.equal(rec.checks.find((c) => c.id === 'timeline-running-vs-summary')!.status, 'ok');
});

test('summary null → tidak ada check (halaman memakai empty/error state-nya sendiri)', () => {
  const rec = computeOeeReconciliation(null, DEMO_HOURLY, DEMO_TIMELINE);
  assert.deepEqual(rec.checks, []);
  assert.equal(rec.hasData, false);
  assert.equal(rec.warningCount, 0);
});

test('sumber kosong → check sumber itu tidak dibuat', () => {
  const rec = computeOeeReconciliation(CONSISTENT_SUMMARY, [], []);
  assert.deepEqual(rec.checks, []);
  assert.equal(rec.hasData, false);
});

test('hourly_run_sec hilang di satu bucket → check run tidak tersedia, yang lain tetap jalan', () => {
  const incomplete = DEMO_HOURLY.map((p, i) =>
    i === 3 ? { ...p, hourly_run_sec: undefined } : p
  );
  const rec = computeOeeReconciliation(CONSISTENT_SUMMARY, incomplete, DEMO_TIMELINE);
  const run = rec.checks.find((c) => c.id === 'hourly-run-vs-summary')!;
  assert.equal(run.status, 'unavailable');
  assert.equal(run.diff, null);
  assert.equal(rec.checks.find((c) => c.id === 'hourly-parts-vs-summary')!.status, 'ok');
});

test('format nilai dan selisih memakai pemisah ribuan Indonesia', () => {
  assert.equal(formatReconciliationValue(23280, 'detik'), '23.280 detik');
  assert.equal(formatReconciliationValue(388, 'menit'), '388 menit');
  assert.equal(formatReconciliationValue(null, 'pcs'), '—');
  assert.equal(formatReconciliationDiff(-16, 'pcs'), '−16 pcs');
  assert.equal(formatReconciliationDiff(120, 'detik'), '+120 detik');
  assert.equal(formatReconciliationDiff(0, 'pcs'), '');
});

test('E28 Batch B (FAT-221): timeline 7 hari dipotong ke jendela shift ringkasan 99 mnt — bukan peringatan palsu', () => {
  // Angka E2E live: RUNNING timeline 235 vs ringkasan 99; total 10.080 vs 99.
  // Ringkasan = satu shift yang sedang berjalan (99 mnt); timeline = 7 hari.
  const summary99: ShiftSummary = {
    ...CONSISTENT_SUMMARY,
    shift_start: '2026-11-19T14:21:00+07:00',
    shift_end: '2026-11-19T16:00:00+07:00',
    planned_production_time_min: 99,
    operating_time_min: 99,
    run_time_min: 90,
    unplanned_downtime_min: 9,
    planned_downtime_min: 0,
  };
  const weekTimeline: ShiftTimelineSegment[] = [
    // Di luar jendela (sebelum shift): 145 mnt RUNNING — tidak dihitung.
    timelineSegment('2026-11-19T11:56:00+07:00', '2026-11-19T14:21:00+07:00', 'RUNNING', 145),
    // Di dalam jendela: RUNNING 90 + UNPLANNED 9 = 99 mnt.
    timelineSegment('2026-11-19T14:21:00+07:00', '2026-11-19T15:51:00+07:00', 'RUNNING', 90),
    timelineSegment('2026-11-19T15:51:00+07:00', '2026-11-19T16:00:00+07:00', 'UNPLANNED_DOWNTIME', 9),
    // Di luar jendela (sesudah shift): 9.936 mnt — tidak dihitung.
    timelineSegment('2026-11-19T16:00:00+07:00', '2026-11-26T09:36:00+07:00', 'RUNNING', 9936),
  ];
  const rec = computeOeeReconciliation(summary99, [], weekTimeline);
  const run = rec.checks.find((c) => c.id === 'timeline-running-vs-summary')!;
  const total = rec.checks.find((c) => c.id === 'timeline-total-vs-window')!;
  assert.equal(run.leftValue, 90);
  assert.equal(run.status, 'ok');
  assert.equal(total.leftValue, 99);
  assert.equal(total.status, 'ok');
  assert.equal(rec.warningCount, 0);
  assert.match(run.note ?? '', /dipotong ke jendela shift/);
  assert.match(total.note ?? '', /dipotong ke jendela shift/);
});

test('E28 Batch B (FAT-221): ringkasan tanpa jendela yang bisa diparse → tanpa potong, tanpa note', () => {
  const noWindow: ShiftSummary = { ...CONSISTENT_SUMMARY, shift_start: 'bukan-tanggal', shift_end: '' };
  const rec = computeOeeReconciliation(noWindow, [], DEMO_TIMELINE);
  const run = rec.checks.find((c) => c.id === 'timeline-running-vs-summary')!;
  assert.equal(run.leftValue, 388);
  assert.equal(run.note, undefined);
});
