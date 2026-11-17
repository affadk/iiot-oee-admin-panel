import test from 'node:test';
import assert from 'node:assert/strict';
import { HourlyOeePoint, ShiftTimelineSegment } from '../../types/analytics';
import { segmentProvisionalFlags } from './timelineProvisional';

// ---------------------------------------------------------------------------
// E12 T12.12 (X-5 / FAT-58): segmen timeline ditandai provisional bila
// bersinggungan dengan jam bucket hourly yang masih provisional (gap G12).
// Flag diturunkan dari data hourly — tipe segmen tidak punya field
// provisional dan tidak ditambah (API doc §Q.3 juga tidak memuatnya).
// ---------------------------------------------------------------------------

function hourlyPoint(hour: string, provisional: boolean, bucket?: string): HourlyOeePoint {
  return {
    hour,
    bucket,
    oee: 80,
    availability: 90,
    performance: 91,
    quality: 98,
    parts_produced: 40,
    defect_count: 1,
    provisional,
  };
}

function segment(start: string, end: string, duration_min: number): ShiftTimelineSegment {
  return { start, end, fsm_state: 'RUNNING', duration_min };
}

const ISO_HOURLY: HourlyOeePoint[] = [
  hourlyPoint('2026-11-11T12:00:00+07:00', false),
  hourlyPoint('2026-11-11T13:00:00+07:00', true),
  hourlyPoint('2026-11-11T14:00:00+07:00', true),
];

test('segmen di jam provisional ditandai; segmen di jam final tidak', () => {
  const segments = [
    segment('2026-11-11T11:00:00+07:00', '2026-11-11T12:00:00+07:00', 60),
    segment('2026-11-11T12:00:00+07:00', '2026-11-11T13:00:00+07:00', 60),
    segment('2026-11-11T13:00:00+07:00', '2026-11-11T13:30:00+07:00', 30),
    segment('2026-11-11T13:30:00+07:00', '2026-11-11T14:30:00+07:00', 60),
    segment('2026-11-11T14:30:00+07:00', '2026-11-11T15:00:00+07:00', 30),
  ];
  assert.deepEqual(
    segmentProvisionalFlags(segments, ISO_HOURLY, '2026-11-11'),
    [false, false, true, true, true]
  );
});

test('batas setengah-terbuka: segmen yang berakhir tepat di awal jam provisional tidak ditandai', () => {
  const segments = [
    segment('2026-11-11T12:00:00+07:00', '2026-11-11T13:00:00+07:00', 60),
    segment('2026-11-11T15:00:00+07:00', '2026-11-11T15:30:00+07:00', 30),
  ];
  assert.deepEqual(segmentProvisionalFlags(segments, ISO_HOURLY, '2026-11-11'), [false, false]);
});

test('kasus demo: segmen ISO + hourly HH:MM (jam 13:00/14:00 provisional)', () => {
  const hourly = [
    hourlyPoint('12:00', false),
    hourlyPoint('13:00', true),
    hourlyPoint('14:00', true),
  ];
  const segments = [
    segment('2026-11-11T12:00:00+07:00', '2026-11-11T13:00:00+07:00', 60),
    segment('2026-11-11T13:00:00+07:00', '2026-11-11T14:00:00+07:00', 60),
    segment('2026-11-11T14:00:00+07:00', '2026-11-11T15:00:00+07:00', 60),
  ];
  assert.deepEqual(segmentProvisionalFlags(segments, hourly, '2026-11-11'), [false, true, true]);
});

test('segmen dan hourly HH:MM lintas tengah malam (tanpa jangkar)', () => {
  const hourly = [
    hourlyPoint('22:00', false),
    hourlyPoint('23:00', false),
    hourlyPoint('00:00', true),
    hourlyPoint('01:00', true),
  ];
  const segments = [
    segment('22:00', '23:30', 90),
    segment('23:30', '00:30', 60),
    segment('00:30', '01:30', 60),
  ];
  assert.deepEqual(segmentProvisionalFlags(segments, hourly, '2026-11-16'), [false, true, true]);
});

test('jangkar fallback dari segmen ISO bila summary belum ada (anchorDate null)', () => {
  const hourly = [
    hourlyPoint('22:00', false),
    hourlyPoint('23:00', false),
    hourlyPoint('00:00', true),
    hourlyPoint('01:00', true),
  ];
  const segments = [
    segment('2026-11-16T22:00:00+07:00', '2026-11-16T23:30:00+07:00', 90),
    segment('2026-11-16T23:30:00+07:00', '2026-11-17T00:30:00+07:00', 60),
    segment('2026-11-17T00:30:00+07:00', '2026-11-17T01:30:00+07:00', 60),
  ];
  assert.deepEqual(segmentProvisionalFlags(segments, hourly, null), [false, true, true]);
});

test('tanpa jam provisional / hourly kosong / segmen kosong: semua false', () => {
  const segments = [segment('2026-11-11T13:00:00+07:00', '2026-11-11T14:00:00+07:00', 60)];
  assert.deepEqual(
    segmentProvisionalFlags(segments, [hourlyPoint('2026-11-11T13:00:00+07:00', false)], '2026-11-11'),
    [false]
  );
  assert.deepEqual(segmentProvisionalFlags(segments, [], '2026-11-11'), [false]);
  assert.deepEqual(segmentProvisionalFlags([], ISO_HOURLY, '2026-11-11'), []);
});

test('nilai tak terparse dilewati tanpa throw; bucket dipakai bila hour kosong', () => {
  const segments = [
    segment('bukan-jam', 'juga-bukan', 60),
    segment('2026-11-11T13:00:00+07:00', '2026-11-11T14:00:00+07:00', 60),
  ];
  const hourly = [
    hourlyPoint('???', true),
    hourlyPoint('', true, '2026-11-11T13:00:00+07:00'),
  ];
  assert.deepEqual(segmentProvisionalFlags(segments, hourly, '2026-11-11'), [false, true]);
});
