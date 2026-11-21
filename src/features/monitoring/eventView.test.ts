import test from 'node:test';
import assert from 'node:assert/strict';
import { OperationalEvent } from '../../types/monitoring';
import {
  acknowledgedParamForView,
  describeTabCounts,
  EVENT_STATE_FILTER_LABELS,
  filterEventsByState,
  formatTabCount,
  sortActionView,
  stateFilterOptionsForView,
  type OperationalEventStateFilter,
} from './eventView';

// ---------------------------------------------------------------------------
// FAT-300 (P33.5, E33 tahap A analisis halaman Opsi 3 §3): dua tampilan
// Alarm & Event + filter State. Aturan:
// - view 'action' → server `acknowledged=false`; 'history' → undefined.
// - Filter State client-side atas halaman yang dimuat; derivasi
//   rtn-unack memakai daftar halaman PENUH sebagai referensi.
// - Urutan 'action': active-unack dulu, lalu rtn-unack, terbaru dulu
//   di tiap kelompok (sort stabil).
// - Jumlah tab: pasti hanya bila halaman 1 tanpa halaman berikut;
//   selain itu batas bawah ("12+"). Backend tidak punya COUNT(*) total.
// ---------------------------------------------------------------------------

function baseEvent(overrides: Partial<OperationalEvent> = {}): OperationalEvent {
  return {
    id: 'op-ev-900',
    recorded_at: '2026-11-21T00:30:00Z',
    device_id: 'STM32-OEE-01',
    station_label: null,
    machine_id: null,
    machine_name: null,
    wo_id: null,
    event_type: 'DEVICE_OFFLINE',
    trigger_source: 'DEVICE',
    event_code: null,
    snapshot_total_count: null,
    snapshot_run_sec: null,
    description: 'device offline',
    acknowledged: false,
    acknowledged_at: null,
    acknowledged_by: null,
    ack_note: null,
    created_at: '2026-11-21T00:30:00Z',
    ...overrides,
  };
}

test("view 'action' memakai acknowledged=false; 'history' tanpa param ack", () => {
  assert.equal(acknowledgedParamForView('action'), false);
  assert.equal(acknowledgedParamForView('history'), undefined);
});

test("opsi State: 'action' tanpa ACKED; 'history' semua opsi", () => {
  assert.deepEqual(stateFilterOptionsForView('action'), ['ALL', 'ACTIVE_UNACK', 'RTN_UNACK']);
  assert.deepEqual(stateFilterOptionsForView('history'), [
    'ALL',
    'ACTIVE_UNACK',
    'RTN_UNACK',
    'ACKED',
  ]);
});

test('filter State ALL mengembalikan semua baris', () => {
  const events = [baseEvent(), baseEvent({ id: 'op-ev-901', acknowledged: true })];
  assert.equal(filterEventsByState(events, 'ALL').length, 2);
});

test('filter ACTIVE_UNACK: hanya belum di-ack yang tidak rtn-unack', () => {
  const offlineActive = baseEvent({ id: 'a1' });
  const offlineRtn = baseEvent({ id: 'a2', recorded_at: '2026-11-21T00:20:00Z' });
  const online = baseEvent({
    id: 'a3',
    event_type: 'DEVICE_ONLINE',
    recorded_at: '2026-11-21T00:25:00Z',
  });
  const acked = baseEvent({ id: 'a4', acknowledged: true });
  const events = [offlineActive, offlineRtn, online, acked];
  const out = filterEventsByState(events, 'ACTIVE_UNACK').map((e) => e.id);
  assert.deepEqual(out, ['a1', 'a3']);
});

test('filter RTN_UNACK: hanya offline dengan online lebih baru untuk device yang sama', () => {
  const offlineRtn = baseEvent({ id: 'r1', recorded_at: '2026-11-21T00:20:00Z' });
  const offlineActive = baseEvent({ id: 'r2' });
  const online = baseEvent({
    id: 'r3',
    event_type: 'DEVICE_ONLINE',
    recorded_at: '2026-11-21T00:25:00Z',
  });
  const events = [offlineRtn, offlineActive, online];
  assert.deepEqual(
    filterEventsByState(events, 'RTN_UNACK').map((e) => e.id),
    ['r1']
  );
});

test('filter ACKED: hanya yang sudah di-ack', () => {
  const acked = baseEvent({ id: 'k1', acknowledged: true });
  const unacked = baseEvent({ id: 'k2' });
  assert.deepEqual(
    filterEventsByState([acked, unacked], 'ACKED').map((e) => e.id),
    ['k1']
  );
});

test('sort tampilan action: active-unack (lebih lama) tetap di atas rtn-unack (lebih baru)', () => {
  // s1 rtn-unack (ONLINE 00:45 untuk device yang sama); s2 active-unack
  // (device lain tanpa ONLINE susulan) — aktif didahulukan meski lebih lama.
  const rtnNewer = baseEvent({ id: 's1', recorded_at: '2026-11-21T00:40:00Z' });
  const activeOlder = baseEvent({
    id: 's2',
    device_id: 'STM32-OEE-02',
    recorded_at: '2026-11-21T00:10:00Z',
  });
  const online = baseEvent({
    id: 's3',
    event_type: 'DEVICE_ONLINE',
    recorded_at: '2026-11-21T00:45:00Z',
  });
  const events = [rtnNewer, activeOlder, online];
  const sorted = sortActionView(
    events.filter((e) => e.event_type === 'DEVICE_OFFLINE'),
    events
  ).map((e) => e.id);
  assert.deepEqual(sorted, ['s2', 's1']);
});

test('sort tampilan action: terbaru dulu di dalam kelompok state yang sama', () => {
  const older = baseEvent({ id: 't1', recorded_at: '2026-11-21T00:10:00Z' });
  const newer = baseEvent({ id: 't2', recorded_at: '2026-11-21T00:30:00Z' });
  assert.deepEqual(
    sortActionView([older, newer]).map((e) => e.id),
    ['t2', 't1']
  );
});

test('sort memakai daftar referensi penuh: pasangan ONLINE yang tersaring tetap dihitung', () => {
  const offline = baseEvent({ id: 'u1', recorded_at: '2026-11-21T00:20:00Z' });
  // u2 device lain tanpa ONLINE susulan → tetap active-unack.
  const active = baseEvent({
    id: 'u2',
    device_id: 'STM32-OEE-02',
    recorded_at: '2026-11-21T00:10:00Z',
  });
  const online = baseEvent({
    id: 'u3',
    event_type: 'DEVICE_ONLINE',
    recorded_at: '2026-11-21T00:25:00Z',
  });
  const full = [offline, active, online];
  // Subset hasil filter hanya berisi baris OFFLINE — tanpa referensi penuh,
  // u1 akan salah jadi active-unack dan urutannya jadi berdasarkan waktu.
  const sorted = sortActionView([offline, active], full).map((e) => e.id);
  assert.deepEqual(sorted, ['u2', 'u1']);
});

test('jumlah tab: halaman 1 tanpa halaman berikut = pasti', () => {
  const events = [
    baseEvent({ id: 'c1' }),
    baseEvent({ id: 'c2', acknowledged: true }),
    baseEvent({ id: 'c3' }),
  ];
  const counts = describeTabCounts(events, 0, false);
  assert.deepEqual(counts.action, { count: 2, exact: true });
  assert.deepEqual(counts.history, { count: 3, exact: true });
  assert.equal(formatTabCount(counts.action), '2');
});

test('jumlah tab: ada halaman berikut = batas bawah ("+")', () => {
  const events = [baseEvent({ id: 'c1' }), baseEvent({ id: 'c2', acknowledged: true })];
  const counts = describeTabCounts(events, 0, true);
  assert.deepEqual(counts.action, { count: 1, exact: false });
  assert.equal(formatTabCount(counts.action), '1+');
  assert.equal(formatTabCount(counts.history), '2+');
});

test('jumlah tab: halaman berikutnya tanpa has_more tetap batas bawah', () => {
  const events = [baseEvent({ id: 'c1' })];
  const counts = describeTabCounts(events, 1, false);
  assert.deepEqual(counts.action, { count: 1, exact: false });
  assert.equal(formatTabCount(counts.history), '1+');
});

// Sanity: semua nilai filter State punya label tampil (tidak ada opsi tanpa label).
test('semua nilai State punya label', () => {
  const all: OperationalEventStateFilter[] = ['ALL', 'ACTIVE_UNACK', 'RTN_UNACK', 'ACKED'];
  for (const value of all) {
    assert.ok(EVENT_STATE_FILTER_LABELS[value].length > 0, value);
  }
});
