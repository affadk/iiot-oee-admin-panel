import test from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryRouter } from 'react-router-dom';
import { HourlyOeePoint, ShiftTimelineSegment, ShiftSummary } from '../../../types/analytics';
import { ShiftTimeline } from './ShiftTimeline';

// ---------------------------------------------------------------------------
// E12 T12.5 (U-2 / FAT-52): timeline kosong bukan lagi bar kosong tanpa
// pesan (gap G17, Guide §5) — tampilkan skeleton saat memuat, pesan error
// + "Coba lagi" saat gagal, dan pesan empty-state saat tidak ada segmen.
// Render diuji lewat renderToStaticMarkup (tanpa jsdom — repo ini tidak
// memakai jsdom); <Link> di komponen dibungkus MemoryRouter.
// ---------------------------------------------------------------------------

const SEGMENTS: ShiftTimelineSegment[] = [
  { start: '07:00', end: '09:00', fsm_state: 'RUNNING', duration_min: 120 },
  {
    start: '09:00',
    end: '09:15',
    fsm_state: 'UNPLANNED_DOWNTIME',
    planned: false,
    downtime_id: 'DT-1',
    duration_min: 15,
  },
];

function render(
  timeline: ShiftTimelineSegment[],
  opts: {
    isLoading?: boolean;
    isError?: boolean;
    summary?: ShiftSummary | null;
    hourly?: HourlyOeePoint[];
    activeSegmentIdx?: number;
  } = {}
): string {
  return renderToStaticMarkup(
    React.createElement(
      MemoryRouter,
      null,
      React.createElement(ShiftTimeline, {
        timeline,
        timelineBucket: '15m',
        totalTimelineMin: 135,
        activeSegmentIdx: opts.activeSegmentIdx ?? 1,
        onSelectSegment: () => undefined,
        activeSegment: timeline[opts.activeSegmentIdx ?? 1] ?? null,
        matchedDowntime: null,
        resolvedDeviceId: 'STM32-OEE-01',
        summary: opts.summary ?? null,
        hourly: opts.hourly ?? [],
        isLoading: opts.isLoading ?? false,
        isError: opts.isError ?? false,
        onRetry: () => undefined,
      })
    )
  );
}

test('ShiftTimeline menampilkan segmen saat timeline ada', () => {
  const html = render(SEGMENTS);
  assert.ok(html.includes('07:00–09:00: RUNNING (120 min)'), html);
  assert.ok(html.includes('09:00–09:15: UNPLANNED_DOWNTIME (15 min)'), html);
  assert.ok(!html.includes('Tidak ada data timeline pada rentang ini'), html);
});

test('ShiftTimeline menampilkan skeleton saat memuat dan belum ada segmen', () => {
  const html = render([], { isLoading: true });
  assert.ok(html.includes('Memuat timeline'), html);
  assert.ok(html.includes('animate-pulse'), html);
  assert.ok(!html.includes('Tidak ada data timeline pada rentang ini'), html);
  assert.ok(!html.includes('Gagal memuat timeline'), html);
});

test('ShiftTimeline menampilkan pesan kosong saat tidak ada segmen', () => {
  const html = render([]);
  assert.ok(html.includes('Tidak ada data timeline pada rentang ini'), html);
  assert.ok(html.includes('Belum ada segmen status mesin untuk mesin dan periode yang dipilih.'), html);
  assert.ok(!html.includes('Memuat timeline'), html);
  assert.ok(!html.includes('Gagal memuat timeline'), html);
});

test('ShiftTimeline menampilkan pesan error + tombol coba lagi saat gagal memuat', () => {
  const html = render([], { isError: true });
  assert.ok(html.includes('Gagal memuat timeline'), html);
  assert.ok(html.includes('Coba lagi'), html);
  assert.ok(!html.includes('Tidak ada data timeline pada rentang ini'), html);
});

// ---------------------------------------------------------------------------
// E12 T12.11 (X-4 / FAT-59): sumbu waktu Asia/Jakarta di bawah bar timeline
// (gap G11) — tick dari start/end segmen + penanda tanggal bila melewati
// tengah malam; jam segmen ISO diformat ke WIB di tooltip/overlay.
// ---------------------------------------------------------------------------

test('ShiftTimeline menampilkan sumbu waktu Asia/Jakarta di bawah bar', () => {
  const html = render(SEGMENTS);
  assert.ok(html.includes('07:00'), html);
  assert.ok(html.includes('09:15'), html);
  assert.ok(html.includes('Semua waktu Asia/Jakarta (WIB)'), html);
  assert.ok(html.includes('Sumbu waktu Asia/Jakarta'), html);
});

test('ShiftTimeline lintas tengah malam: tick 00:00 membawa tanggal baru', () => {
  const night: ShiftTimelineSegment[] = [
    { start: '2026-11-16T22:00:00+07:00', end: '2026-11-16T23:30:00+07:00', fsm_state: 'RUNNING', duration_min: 90 },
    { start: '2026-11-16T23:30:00+07:00', end: '2026-11-17T02:00:00+07:00', fsm_state: 'RUNNING', duration_min: 150 },
  ];
  const summary: ShiftSummary = {
    shift_name: 'Shift Malam',
    machine_id: 'CNC-MILLING-01',
    machine_name: 'CNC Milling Center Alpha',
    shift_start: '2026-11-16T22:00:00+07:00',
    shift_end: '2026-11-17T02:00:00+07:00',
    tz: 'Asia/Jakarta',
    oee: 84.6,
    availability: 92.4,
    performance: 94.1,
    quality: 97.4,
    planned_production_time_min: 240,
    operating_time_min: 240,
    run_time_min: 240,
    unplanned_downtime_min: 0,
    planned_downtime_min: 0,
    total_parts: 100,
    good_parts: 98,
    defect_parts: 2,
  };
  const html = render(night, { summary });
  assert.ok(html.includes('00:00 · 17 Nov'), html);
  assert.ok(html.includes('22:00'), html);
});

test('ShiftTimeline memformat jam segmen ISO ke WIB di overlay', () => {
  const isoSegs: ShiftTimelineSegment[] = [
    { start: '2026-11-11T07:00:00+07:00', end: '2026-11-11T09:00:00+07:00', fsm_state: 'RUNNING', duration_min: 120 },
    { start: '2026-11-11T09:00:00+07:00', end: '2026-11-11T09:15:00+07:00', fsm_state: 'UNPLANNED_DOWNTIME', planned: false, downtime_id: 'DT-1', duration_min: 15 },
  ];
  const html = render(isoSegs);
  assert.ok(html.includes('Segmen 09:00 – 09:15 (15 menit)'), html);
  assert.ok(!html.includes('2026-11-11T09:00:00+07:00'), html);
});

// ---------------------------------------------------------------------------
// E12 T12.12 (X-5 / FAT-58): segmen di jam provisional mendapat penanda
// "(Provisional)" yang sama dengan Hourly/Rollup/Aggregate (gap G12) —
// diturunkan dari data hourly, bukan dari field segmen (tipe segmen tidak
// punya field provisional). Segmen di jam final tidak ditandai.
// ---------------------------------------------------------------------------

function hourlyPoint(hour: string, provisional: boolean): HourlyOeePoint {
  return {
    hour,
    oee: 80,
    availability: 90,
    performance: 91,
    quality: 98,
    parts_produced: 40,
    defect_count: 1,
    provisional,
  };
}

const PROVISIONAL_SEGMENTS: ShiftTimelineSegment[] = [
  { start: '2026-11-11T12:00:00+07:00', end: '2026-11-11T13:00:00+07:00', fsm_state: 'RUNNING', duration_min: 60 },
  { start: '2026-11-11T13:00:00+07:00', end: '2026-11-11T14:00:00+07:00', fsm_state: 'RUNNING', duration_min: 60 },
  { start: '2026-11-11T14:00:00+07:00', end: '2026-11-11T15:00:00+07:00', fsm_state: 'RUNNING', duration_min: 60 },
];

// Kasus demo: segmen ISO + hourly 'HH:MM' (jam 13:00/14:00 provisional).
const DEMO_HOURLY: HourlyOeePoint[] = [
  hourlyPoint('12:00', false),
  hourlyPoint('13:00', true),
  hourlyPoint('14:00', true),
];

test('ShiftTimeline menandai segmen aktif di jam provisional dengan (Provisional)', () => {
  const html = render(PROVISIONAL_SEGMENTS, { hourly: DEMO_HOURLY, activeSegmentIdx: 1 });
  // Panel segmen aktif: teks yang sama dengan Hourly/Rollup/Aggregate.
  assert.ok(html.includes('(Provisional)'), html);
  // "(Provisional)" muncul tepat dua kali: badge panel + keterangan bawah bar.
  assert.equal(html.split('(Provisional)').length - 1, 2, html);
  assert.ok(html.includes('Segmen ini berada pada jam yang masih provisional'), html);
  // Tooltip segmen provisional membawa "· Provisional"; segmen final tidak.
  assert.ok(html.includes('13:00–14:00: RUNNING (60 min) · Provisional'), html);
  assert.ok(html.includes('12:00–13:00: RUNNING (60 min)"'), html);
  assert.ok(!html.includes('12:00–13:00: RUNNING (60 min) · Provisional'), html);
  // Keterangan di bawah bar menjelaskan arti titik amber.
  assert.ok(html.includes('Segmen bertitik amber berada pada jam (Provisional)'), html);
});

test('ShiftTimeline tidak menandai segmen aktif di jam final', () => {
  const html = render(PROVISIONAL_SEGMENTS, { hourly: DEMO_HOURLY, activeSegmentIdx: 0 });
  assert.ok(!html.includes('Segmen ini berada pada jam yang masih provisional'), html);
  // "(Provisional)" muncul tepat sekali — hanya di keterangan bawah bar;
  // panel segmen aktif (jam 12:00, final) tidak membawanya.
  assert.equal(html.split('(Provisional)').length - 1, 1, html);
  // Keterangan tetap tampil karena segmen lain (13:00/14:00) provisional.
  assert.ok(html.includes('Segmen bertitik amber berada pada jam (Provisional)'), html);
});

test('ShiftTimeline tanpa data hourly tidak menampilkan penanda provisional', () => {
  const html = render(PROVISIONAL_SEGMENTS, { activeSegmentIdx: 1 });
  assert.ok(!html.includes('(Provisional)'), html);
  assert.ok(!html.includes('Segmen bertitik amber'), html);
  assert.ok(!html.includes('· Provisional'), html);
});
