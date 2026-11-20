import test from 'node:test';
import assert from 'node:assert/strict';
import { ShiftTimelineSegment } from '../../types/analytics';
import { buildTimelineAxisTicks, segmentDateNote } from './timelineAxis';

// ---------------------------------------------------------------------------
// E12 T12.11 (X-4 / FAT-59): sumbu/label jam timeline (gap G11) —
// tick dari start/end segmen dalam Asia/Jakarta, dengan penanda tanggal
// bila sumbu melewati tengah malam.
// ---------------------------------------------------------------------------

const SEG = (start: string, end: string, duration_min: number): ShiftTimelineSegment => ({
  start,
  end,
  fsm_state: 'RUNNING',
  duration_min,
});

test('sumbu timeline ISO 07:00–15:00: tick per jam, 07:00 sampai 15:00', () => {
  const segs = [
    SEG('2026-11-11T07:00:00+07:00', '2026-11-11T09:15:00+07:00', 135),
    SEG('2026-11-11T09:15:00+07:00', '2026-11-11T15:00:00+07:00', 345),
  ];
  const axis = buildTimelineAxisTicks(segs, '2026-11-11');
  assert.equal(axis.timeZoneLabel, 'Asia/Jakarta');
  assert.deepEqual(
    axis.ticks.map((t) => t.label),
    ['07:00', '08:00', '09:00', '10:00', '11:00', '12:00', '13:00', '14:00', '15:00']
  );
  assert.equal(axis.ticks[0].pct, 0);
  assert.equal(axis.ticks[axis.ticks.length - 1].pct, 100);
});

test('sumbu timeline lintas tengah malam: tick 00:00 membawa tanggal baru', () => {
  const segs = [
    SEG('2026-11-16T22:00:00+07:00', '2026-11-16T23:30:00+07:00', 90),
    SEG('2026-11-16T23:30:00+07:00', '2026-11-17T02:00:00+07:00', 150),
  ];
  const axis = buildTimelineAxisTicks(segs, '2026-11-16');
  assert.deepEqual(
    axis.ticks.map((t) => t.label),
    ['22:00', '22:30', '23:00', '23:30', '00:00 · 17 Nov', '00:30 · 17 Nov', '01:00 · 17 Nov', '01:30 · 17 Nov', '02:00 · 17 Nov']
  );
});

test('sumbu timeline format lama HH:MM: dijangkarkan ke tanggal shift_start', () => {
  const segs = [SEG('22:00', '23:30', 90), SEG('23:30', '01:00', 90)];
  const axis = buildTimelineAxisTicks(segs, '2026-11-16');
  assert.deepEqual(
    axis.ticks.map((t) => t.label),
    ['22:00', '22:30', '23:00', '23:30', '00:00 · 17 Nov', '00:30 · 17 Nov', '01:00 · 17 Nov']
  );
});

test('sumbu timeline HH:MM tanpa jangkar: label jam saja, tanpa tanggal', () => {
  const segs = [SEG('07:00', '09:00', 120), SEG('09:00', '11:00', 120)];
  const axis = buildTimelineAxisTicks(segs, null);
  assert.deepEqual(
    axis.ticks.map((t) => t.label),
    ['07:00', '07:30', '08:00', '08:30', '09:00', '09:30', '10:00', '10:30', '11:00']
  );
});

test('sumbu timeline kosong / tidak bisa diparse: tanpa tick', () => {
  assert.deepEqual(buildTimelineAxisTicks([], '2026-11-11').ticks, []);
  assert.deepEqual(buildTimelineAxisTicks([SEG('bukan-jam', 'juga-bukan', 0)], null).ticks, []);
});

test('segmentDateNote: lintas tengah malam vs satu hari yang sama', () => {
  assert.equal(
    segmentDateNote(SEG('2026-11-16T23:30:00+07:00', '2026-11-17T01:00:00+07:00', 90)),
    '16 Nov → 17 Nov'
  );
  assert.equal(
    segmentDateNote(SEG('2026-11-11T07:00:00+07:00', '2026-11-11T09:15:00+07:00', 135)),
    ''
  );
  assert.equal(segmentDateNote(SEG('23:30', '01:00', 90)), '');
});

test('E28 Batch B (FAT-225): rentang 7 hari memakai tick harian, maksimal 9 tick — tidak bertumpuk', () => {
  const segs = [
    SEG('2026-11-12T00:00:00+07:00', '2026-11-15T12:00:00+07:00', 5040),
    SEG('2026-11-15T12:00:00+07:00', '2026-11-19T00:00:00+07:00', 5040),
  ];
  const axis = buildTimelineAxisTicks(segs, '2026-11-12');
  assert.ok(axis.ticks.length <= 9, `tick ${axis.ticks.length} melebihi 9`);
  assert.equal(axis.ticks.length, 8);
  // Tick harian sejajar tengah malam UTC (= 07:00 WIB); tick terakhir
  // adalah ujung rentang (00:00 WIB) — residu kosmetik (lihat scratch),
  // bukan tumpukan label.
  assert.equal(axis.ticks[0].label, '07:00');
  assert.equal(axis.ticks[axis.ticks.length - 1].label, '00:00 · 19 Nov');
});
