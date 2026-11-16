import test from 'node:test';
import assert from 'node:assert/strict';
import {
  extractWallClockHhmm,
  formatIsoDateShort,
  formatPeriodLabel,
  formatShiftScopeLabel,
  formatSummaryScopeLabel,
  joinScopeLabel,
} from './scopeLabels';
import { ShiftSummary } from '../../types/analytics';

const demoSummary: ShiftSummary = {
  shift_name: 'Shift 1 (07:00-15:00)',
  machine_id: 'CNC-MILLING-01',
  machine_name: 'CNC Milling Center Alpha',
  shift_start: '2026-11-11T07:00:00+07:00',
  shift_end: '2026-11-11T15:00:00+07:00',
  tz: 'Asia/Jakarta',
  oee: 84.6,
  availability: 92.4,
  performance: 94.1,
  quality: 97.4,
  planned_production_time_min: 480,
  planned_break_min: 60,
  operating_time_min: 420,
  run_time_min: 388,
  unplanned_downtime_min: 32,
  planned_downtime_min: 60,
  total_parts: 350,
  good_parts: 342,
  defect_parts: 8,
  target_per_hour: 64,
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
