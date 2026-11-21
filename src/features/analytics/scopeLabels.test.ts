import test from 'node:test';
import assert from 'node:assert/strict';
import {
  extractWallClockHhmm,
  formatIsoDateShort,
  formatPeriodLabel,
  formatRollupScopeTitle,
  formatShiftFilterLabel,
  formatShiftScopeLabel,
  formatSummaryScopeLabel,
  joinScopeLabel,
} from './scopeLabels';
import { ShiftSummary } from '../../types/analytics';
import { Shift } from '../../types/production';

const demoSummary: ShiftSummary = {
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

test('formatPeriodLabel mengenali preset bawaan panel (24 jam / 7 / 30 / 90 hari)', () => {
  assert.equal(
    formatPeriodLabel('2026-11-15T10:00:00+07:00', '2026-11-16T10:00:00+07:00'),
    '24 jam terakhir'
  );
  assert.equal(
    formatPeriodLabel('2026-11-09T10:00:00+07:00', '2026-11-16T10:00:00+07:00'),
    '7 hari terakhir'
  );
  assert.equal(
    formatPeriodLabel('2026-10-17T10:00:00+07:00', '2026-11-16T10:00:00+07:00'),
    '30 hari terakhir'
  );
  // Preset 90d panel = retensi 90 hari dikurangi 1 jam.
  assert.equal(
    formatPeriodLabel('2026-08-18T11:00:00+07:00', '2026-11-16T10:00:00+07:00'),
    '90 hari terakhir'
  );
});

test('formatPeriodLabel menampilkan rentang tanggal untuk periode kustom', () => {
  assert.equal(
    formatPeriodLabel('2026-11-02T00:00:00+07:00', '2026-11-05T00:00:00+07:00'),
    '2 Nov 2026 – 5 Nov 2026'
  );
});

// E12 T12.9 (X-2 / FAT-62): label "Hari ini" untuk jendela hari ini.
test('formatPeriodLabel menampilkan "Hari ini" untuk jendela hari ini', () => {
  const now = new Date('2026-11-17T10:24:00+07:00');
  assert.equal(
    formatPeriodLabel('2026-11-17T00:00:00+07:00', '2026-11-17T10:24:00+07:00', now),
    'Hari ini'
  );
  // Jendela kemarin (00:00–10:24) bukan "hari ini" — jatuh ke rentang tanggal.
  assert.equal(
    formatPeriodLabel('2026-11-16T00:00:00+07:00', '2026-11-16T10:24:00+07:00', now),
    '16 Nov 2026 – 16 Nov 2026'
  );
});

test('formatPeriodLabel mengembalikan string kosong bila from/to tidak ada atau tidak valid', () => {
  assert.equal(formatPeriodLabel(undefined, '2026-11-16T10:00:00+07:00'), '');
  assert.equal(formatPeriodLabel('2026-11-09T10:00:00+07:00', undefined), '');
  assert.equal(formatPeriodLabel('bukan-tanggal', '2026-11-16T10:00:00+07:00'), '');
  assert.equal(
    formatPeriodLabel('2026-11-16T10:00:00+07:00', '2026-11-09T10:00:00+07:00'),
    ''
  );
});

test('extractWallClockHhmm + formatIsoDateShort memakai bagian ISO apa adanya (tanpa konversi tz)', () => {
  assert.equal(extractWallClockHhmm('2026-11-11T07:00:00+07:00'), '07:00');
  assert.equal(extractWallClockHhmm('07:00'), null);
  assert.equal(extractWallClockHhmm(undefined), null);
  assert.equal(formatIsoDateShort('2026-11-09T10:00:00+07:00'), '9 Nov 2026');
  assert.equal(formatIsoDateShort('bukan-tanggal'), null);
});

test('formatShiftScopeLabel memakai nama shift + tz tanpa menduplikasi rentang jam', () => {
  assert.equal(
    formatShiftScopeLabel(demoSummary),
    'Shift 1 (07:00-15:00) · Asia/Jakarta'
  );
  // Nama shift real tanpa rentang jam: rentang dari window ditambahkan.
  const realSummary: ShiftSummary = {
    ...demoSummary,
    shift_name: 'Shift 1',
    shift_start: '2026-11-16T07:00:00+07:00',
    shift_end: '2026-11-16T15:00:00+07:00',
  };
  assert.equal(
    formatShiftScopeLabel(realSummary),
    'Shift 1 · 07:00–15:00 · Asia/Jakarta'
  );
  assert.equal(formatShiftScopeLabel(null), '');
  assert.equal(formatShiftScopeLabel(undefined), '');
});

test('formatSummaryScopeLabel menambahkan mesin dari data summary', () => {
  assert.equal(
    formatSummaryScopeLabel(demoSummary, '7 hari terakhir'),
    'Shift 1 (07:00-15:00) · Asia/Jakarta · Mesin CNC Milling Center Alpha'
  );
});

test('formatSummaryScopeLabel jatuh ke label periode filter bila shift tidak bermakna', () => {
  const bareSummary: ShiftSummary = {
    ...demoSummary,
    shift_name: 'Shift',
    shift_start: '',
    shift_end: '',
    tz: undefined,
  };
  assert.equal(
    formatSummaryScopeLabel(bareSummary, '7 hari terakhir'),
    '7 hari terakhir · Mesin CNC Milling Center Alpha'
  );
  // Tanpa fallback pun: tidak ada tebakan, string kosong.
  assert.equal(formatSummaryScopeLabel(bareSummary), '');
  assert.equal(formatSummaryScopeLabel(null, '7 hari terakhir'), '7 hari terakhir');
  assert.equal(formatSummaryScopeLabel(null), '');
});

test('joinScopeLabel melewati bagian kosong', () => {
  assert.equal(joinScopeLabel('7 hari terakhir', '', 'Mesin CNC-MILLING-01'), '7 hari terakhir · Mesin CNC-MILLING-01');
  assert.equal(joinScopeLabel(undefined, null, ''), '');
});

// ---------------------------------------------------------------------------
// E12 T12.1 (FAT-54 / X-1): label filter shift mencerminkan tanggal + shift
// terpilih — bukan label periode 7 hari.
// ---------------------------------------------------------------------------

const SHIFT_1: Shift = {
  shiftId: 'SHIFT-1',
  shiftName: 'Shift 1 (Pagi)',
  shiftCode: 'S1',
  startTime: '07:00',
  endTime: '15:00',
  isActive: true,
  createdAt: '2026-01-02T07:00:00.000Z',
};

test('formatShiftFilterLabel: "Shift 1 (Pagi) · 16 Nov 2026 · 07:00–15:00"', () => {
  assert.equal(
    formatShiftFilterLabel(SHIFT_1, '2026-11-16'),
    'Shift 1 (Pagi) · 16 Nov 2026 · 07:00–15:00'
  );
});

test('formatShiftFilterLabel: shift lintas tengah malam diberi penanda (+1 hari)', () => {
  const night: Shift = { ...SHIFT_1, shiftName: 'Shift Malam', startTime: '23:00', endTime: '07:00' };
  assert.equal(
    formatShiftFilterLabel(night, '2026-11-16'),
    'Shift Malam · 16 Nov 2026 · 23:00–07:00 (+1 hari)'
  );
});

test('formatShiftFilterLabel: string kosong bila shift/tanggal tidak ada atau tidak valid', () => {
  assert.equal(formatShiftFilterLabel(null, '2026-11-16'), '');
  assert.equal(formatShiftFilterLabel(undefined, '2026-11-16'), '');
  assert.equal(formatShiftFilterLabel(SHIFT_1, undefined), '');
  assert.equal(formatShiftFilterLabel(SHIFT_1, null), '');
  assert.equal(formatShiftFilterLabel(SHIFT_1, '16-11-2026'), '');
  assert.equal(formatShiftFilterLabel(SHIFT_1, '2026-02-30'), '');
  assert.equal(formatShiftFilterLabel({ ...SHIFT_1, shiftName: '  ' }, '2026-11-16'), '');
});

// ---------------------------------------------------------------------------
// E12 T12.10 (X-3 / FAT-57): judul rollup selalu menunjukkan scope —
// "Rollup — <mesin>" untuk scope mesin ini, "Rollup — Semua Mesin" untuk
// scope plant-wide (satu helper, dipakai OeeRollupTable).
// ---------------------------------------------------------------------------

test('formatRollupScopeTitle: scope mesin ini memakai nama mesin terpilih', () => {
  assert.equal(formatRollupScopeTitle('MACHINE', 'CNC Milling 01'), 'Rollup — CNC Milling 01');
  assert.equal(formatRollupScopeTitle('MACHINE', 'CNC-MILLING-01'), 'Rollup — CNC-MILLING-01');
});

test('formatRollupScopeTitle: scope plant-wide memakai "Semua Mesin", bukan nama mesin', () => {
  assert.equal(formatRollupScopeTitle('ALL', 'CNC Milling 01'), 'Rollup — Semua Mesin');
  assert.equal(formatRollupScopeTitle('ALL', 'CNC-GRIND-05'), 'Rollup — Semua Mesin');
});
