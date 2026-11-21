import test from 'node:test';
import assert from 'node:assert/strict';
import { resolveActiveTimelineSegment } from './oeeTimelineSelection';
import { ShiftTimelineSegment } from '../../../types/analytics';
import { DowntimeEvent } from '../../../types/monitoring';

// ---------------------------------------------------------------------------
// E12 T12.10 (X-3 / FAT-57): `resolveActiveTimelineSegment` dipindah dari
// `useOeeAnalytics` sebagai fungsi murni (hook melewati batas keras 250
// baris) — aturan seleksi harus tetap sama: pilihan pengguna yang valid
// menang, bila tidak ada pakai segmen downtime pertama, bila tidak ada
// segmen downtime maka tidak ada yang aktif.
// ---------------------------------------------------------------------------

const SEG = (overrides: Partial<ShiftTimelineSegment> = {}): ShiftTimelineSegment => ({
  start: '07:00',
  end: '08:00',
  fsm_state: 'RUNNING',
  duration_min: 60,
  ...overrides,
});

const TIMELINE: ShiftTimelineSegment[] = [
  SEG({ start: '07:00', end: '08:00', fsm_state: 'RUNNING' }),
  SEG({ start: '08:00', end: '09:00', fsm_state: 'UNPLANNED_DOWNTIME', downtime_id: 'DT-1' }),
  SEG({ start: '09:00', end: '10:00', fsm_state: 'PLANNED_DOWNTIME', downtime_id: 'DT-2' }),
];

const DOWNTIME_1 = { id: 'DT-1' } as DowntimeEvent;
const DOWNTIME_2 = { id: 'DT-2' } as DowntimeEvent;
const DOWNTIME_MAP = new Map<string, DowntimeEvent>([
  ['DT-1', DOWNTIME_1],
  ['DT-2', DOWNTIME_2],
]);

test('tanpa pilihan: segmen downtime pertama yang aktif + downtime-nya tercocokkan', () => {
  const result = resolveActiveTimelineSegment(TIMELINE, null, DOWNTIME_MAP);
  assert.equal(result.activeSegmentIdx, 1);
  assert.equal(result.activeSegment, TIMELINE[1]);
  assert.equal(result.matchedDowntime, DOWNTIME_1);
});

test('pilihan pengguna yang valid menang atas segmen downtime pertama', () => {
  const result = resolveActiveTimelineSegment(TIMELINE, 2, DOWNTIME_MAP);
  assert.equal(result.activeSegmentIdx, 2);
  assert.equal(result.activeSegment, TIMELINE[2]);
  assert.equal(result.matchedDowntime, DOWNTIME_2);
});

test('pilihan segmen tanpa downtime_id: aktif tapi matchedDowntime null', () => {
  const result = resolveActiveTimelineSegment(TIMELINE, 0, DOWNTIME_MAP);
  assert.equal(result.activeSegmentIdx, 0);
  assert.equal(result.activeSegment, TIMELINE[0]);
  assert.equal(result.matchedDowntime, null);
});

test('indeks pilihan basi (di luar daftar) jatuh kembali ke segmen downtime pertama', () => {
  const result = resolveActiveTimelineSegment(TIMELINE, 99, DOWNTIME_MAP);
  assert.equal(result.activeSegmentIdx, 1);
  assert.equal(result.matchedDowntime, DOWNTIME_1);
});

test('tidak ada segmen downtime: tidak ada segmen aktif', () => {
  const runningOnly = [SEG({ start: '07:00', end: '08:00' }), SEG({ start: '08:00', end: '09:00' })];
  const result = resolveActiveTimelineSegment(runningOnly, null, DOWNTIME_MAP);
  assert.equal(result.activeSegmentIdx, null);
  assert.equal(result.activeSegment, null);
  assert.equal(result.matchedDowntime, null);
});

test('downtime_id segmen aktif tidak ada di peta overlay: matchedDowntime null', () => {
  const result = resolveActiveTimelineSegment(TIMELINE, 1, new Map());
  assert.equal(result.activeSegmentIdx, 1);
  assert.equal(result.matchedDowntime, null);
});

// ---------------------------------------------------------------------------
// E12 T12.17 (F-13 / FAT-69): ganti bucket timeline me-reset pilihan segmen
// ke null (gap G13) — handler bucket di `OeeAnalyticsPage` kini memanggil
// `setSelectedSegmentIdx(null)` seperti ganti mesin. Tanpa reset, indeks
// lama dipakai pada daftar segmen baru dan overlay detail downtime
// menampilkan segmen yang salah. Derivasi seleksi di sini murni, jadi
// perilaku pasca-reset diuji di level ini: pilihan null pada timeline baru
// jatuh ke segmen downtime pertama timeline BARU (bukan segmen lama), dan
// `matchedDowntime` mengikuti segmen baru itu.
// ---------------------------------------------------------------------------

// Timeline lama (bucket 15m): pengguna mengklik idx 2 (DT-2, 09:00–10:00).
const OLD_TIMELINE = TIMELINE;

// Timeline baru (bucket 1h, hasil re-bucket): jam 09:00–10:00 kini satu
// segmen RUNNING tanpa downtime — indeks lama 2 masih dalam jangkauan,
// tapi menunjuk segmen yang berbeda.
const NEW_TIMELINE: ShiftTimelineSegment[] = [
  SEG({ start: '07:00', end: '08:00', fsm_state: 'RUNNING' }),
  SEG({ start: '08:00', end: '09:00', fsm_state: 'UNPLANNED_DOWNTIME', downtime_id: 'DT-9' }),
  SEG({ start: '09:00', end: '10:00', fsm_state: 'RUNNING' }),
  SEG({ start: '10:00', end: '11:00', fsm_state: 'PLANNED_DOWNTIME', downtime_id: 'DT-10' }),
];

const DOWNTIME_9 = { id: 'DT-9' } as DowntimeEvent;
const DOWNTIME_10 = { id: 'DT-10' } as DowntimeEvent;
const NEW_DOWNTIME_MAP = new Map<string, DowntimeEvent>([
  ['DT-9', DOWNTIME_9],
  ['DT-10', DOWNTIME_10],
]);

test('ganti bucket + reset (null): overlay menampilkan segmen downtime pertama timeline BARU, bukan segmen lama', () => {
  // Sebelum ganti bucket: overlay menampilkan segmen yang diklik (DT-2).
  const before = resolveActiveTimelineSegment(OLD_TIMELINE, 2, DOWNTIME_MAP);
  assert.equal(before.activeSegmentIdx, 2);
  assert.equal(before.activeSegment, OLD_TIMELINE[2]);
  assert.equal(before.matchedDowntime, DOWNTIME_2);

  // Sesudah ganti bucket, pilihan di-reset ke null: segmen aktif adalah
  // segmen downtime pertama timeline baru (DT-9) beserta downtime-nya —
  // overlay tidak lagi menampilkan segmen lama (DT-2) maupun segmen
  // RUNNING 09:00–10:00 yang kini menempati indeks lama.
  const after = resolveActiveTimelineSegment(NEW_TIMELINE, null, NEW_DOWNTIME_MAP);
  assert.equal(after.activeSegmentIdx, 1);
  assert.equal(after.activeSegment, NEW_TIMELINE[1]);
  assert.equal(after.activeSegment?.downtime_id, 'DT-9');
  assert.equal(after.matchedDowntime, DOWNTIME_9);
  assert.notEqual(after.activeSegment, OLD_TIMELINE[2]);
  assert.notEqual(after.matchedDowntime, DOWNTIME_2);
});

test('tanpa reset, indeks lama yang masih dalam jangkauan menampilkan segmen yang salah (mode gagal G13)', () => {
  // Inilah yang terjadi sebelum T12.17: indeks 2 tetap dipakai pada
  // daftar baru — overlay menampilkan segmen RUNNING 09:00–10:00 tanpa
  // downtime, padahal pengguna memilih DT-2. Test ini mengunci alasan
  // reset di handler bucket: seleksi tidak boleh bertahan melewati
  // ganti bucket.
  const stale = resolveActiveTimelineSegment(NEW_TIMELINE, 2, NEW_DOWNTIME_MAP);
  assert.equal(stale.activeSegmentIdx, 2);
  assert.equal(stale.activeSegment, NEW_TIMELINE[2]);
  assert.equal(stale.activeSegment?.fsm_state, 'RUNNING');
  assert.equal(stale.activeSegment?.downtime_id, undefined);
  assert.equal(stale.matchedDowntime, null);
});
