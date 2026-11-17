import test from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { HourlyOeePoint, ShiftSummary, ShiftTimelineSegment } from '../../../types/analytics';
import { ReconciliationFootnote } from './ReconciliationFootnote';

// ---------------------------------------------------------------------------
// E12 T12.6 (U-3 / FAT-56): catatan kaki rekonsiliasi halaman OEE.
// Render diuji lewat renderToStaticMarkup (tanpa jsdom — repo ini tidak
// memakai jsdom). Fixture sama dengan reconciliation.test.ts.
// ---------------------------------------------------------------------------

const DEMO_SUMMARY: ShiftSummary = {
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

const DEMO_TIMELINE: ShiftTimelineSegment[] = [
  { start: '07:00', end: '09:15', fsm_state: 'RUNNING', duration_min: 135 },
  { start: '09:15', end: '09:47', fsm_state: 'UNPLANNED_DOWNTIME', duration_min: 32 },
  { start: '09:47', end: '12:00', fsm_state: 'RUNNING', duration_min: 133 },
  { start: '12:00', end: '13:00', fsm_state: 'PLANNED_DOWNTIME', duration_min: 60 },
  { start: '13:00', end: '15:00', fsm_state: 'RUNNING', duration_min: 120 },
];

function render(
  summary: ShiftSummary | null,
  hourly: HourlyOeePoint[] = DEMO_HOURLY,
  timeline: ShiftTimelineSegment[] = DEMO_TIMELINE
): string {
  return renderToStaticMarkup(
    React.createElement(ReconciliationFootnote, { summary, hourly, timeline })
  );
}

test('menampilkan angka rekonsiliasi yang benar + badge Cocok bila semua cocok', () => {
  const html = render(CONSISTENT_SUMMARY);
  assert.ok(html.includes('Rekonsiliasi data'), html);
  assert.ok(html.includes('Cocok'), html);
  // Σ hourly_run_sec vs run_time_min.
  assert.ok(html.includes('23.280 detik'), html);
  assert.ok(html.includes('388 menit'), html);
  // Σ parts per jam vs ringkasan.
  assert.ok(html.includes('334 pcs'), html);
  // Ambang tercantum di catatan kaki.
  assert.ok(html.includes('60 detik'), html);
  assert.ok(html.includes('1%'), html);
  assert.ok(!html.includes('melebihi ambang'), html);
});

test('menampilkan peringatan parts pada seed demo apa adanya (334 vs 350)', () => {
  const html = render(DEMO_SUMMARY);
  assert.ok(html.includes('3 selisih melebihi ambang'), html);
  assert.ok(html.includes('selisih'), html);
  assert.ok(html.includes('16 pcs'), html);
  assert.ok(html.includes('14 pcs'), html);
  assert.ok(html.includes('2 pcs'), html);
  // Baris waktu tetap cocok — hanya parts yang memberi peringatan.
  assert.ok(html.includes('Run time — Σ jam vs ringkasan'), html);
  assert.ok(html.includes('23.280 detik vs 23.280 detik — cocok'), html);
});

test('tidak tampil sama sekali bila summary null', () => {
  assert.equal(render(null), '');
});

test('tidak tampil sama sekali bila hourly dan timeline kosong', () => {
  assert.equal(render(CONSISTENT_SUMMARY, [], []), '');
});
