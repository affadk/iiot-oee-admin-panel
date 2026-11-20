import test from 'node:test';
import assert from 'node:assert/strict';
import { parseWsIncomingFrame } from './telemetrySocket';

// FAT-261: HEALTH_UPDATE harus jadi event bertipe (bukan lifecycle mentah)
// agar panel bisa mengonsumsinya. Frame tak valid diabaikan (fail-soft) —
// koneksi WS tidak boleh putus karena satu frame health rusak.

const LIVE_FRAME = JSON.stringify({
  type: 'HEALTH_UPDATE',
  device_id: 'STM32-OEE-SIM',
  data: {
    timestamp: 1795170369,
    heap_free: 65536,
    tasks_healthy: 8,
    tasks_total: 8,
    stale_tasks: [],
    stale_count: 0,
    event_flags: 0,
  },
  timestamp: '2026-11-20T10:26:09.586Z',
});

test('FAT-261: HEALTH_UPDATE live → event bertipe dengan data lengkap', () => {
  const evt = parseWsIncomingFrame(LIVE_FRAME);
  assert.ok(evt && evt !== 'pong' && evt.type === 'HEALTH_UPDATE');
  assert.equal(evt.device_id, 'STM32-OEE-SIM');
  assert.equal(evt.timestampIso, '2026-11-20T10:26:09.586Z');
  assert.equal(evt.data.heapFree, 65536);
  assert.equal(evt.data.tasksHealthy, 8);
  assert.equal(evt.data.tasksTotal, 8);
  assert.deepEqual(evt.data.staleTasks, []);
  assert.equal(evt.data.staleCount, 0);
  assert.equal(evt.data.eventFlags, 0);
});

test('FAT-261: HEALTH_UPDATE membawa bitmask + stale_tasks', () => {
  const evt = parseWsIncomingFrame(
    JSON.stringify({
      type: 'HEALTH_UPDATE',
      device_id: 'STM32-OEE-01',
      data: {
        timestamp: 1795170400,
        heap_free: 32000,
        tasks_healthy: 7,
        tasks_total: 8,
        stale_tasks: ['MODBUS'],
        stale_count: 1,
        event_flags: 8 | 512,
      },
      timestamp: '2026-11-20T10:26:40.000Z',
    }),
  );
  assert.ok(evt && evt !== 'pong' && evt.type === 'HEALTH_UPDATE');
  assert.equal(evt.data.eventFlags, 520);
  assert.deepEqual(evt.data.staleTasks, ['MODBUS']);
  assert.equal(evt.data.staleCount, 1);
});

test('FAT-261: HEALTH_UPDATE angka string di-coerce, timestamp epoch detik', () => {
  const evt = parseWsIncomingFrame(
    JSON.stringify({
      type: 'HEALTH_UPDATE',
      device_id: 'STM32-OEE-SIM',
      data: { timestamp: 1795170369, heap_free: '65536', tasks_healthy: '8', tasks_total: '8' },
      timestamp: '2026-11-20T10:26:09.586Z',
    }),
  );
  assert.ok(evt && evt !== 'pong' && evt.type === 'HEALTH_UPDATE');
  assert.equal(evt.data.heapFree, 65536);
  assert.equal(evt.data.tasksHealthy, 8);
});

test('FAT-261: HEALTH_UPDATE tanpa data / data bukan objek / tanpa device → null', () => {
  assert.equal(parseWsIncomingFrame(JSON.stringify({ type: 'HEALTH_UPDATE', device_id: 'X' })), null);
  assert.equal(
    parseWsIncomingFrame(JSON.stringify({ type: 'HEALTH_UPDATE', device_id: 'X', data: 'rusak' })),
    null,
  );
  assert.equal(
    parseWsIncomingFrame(
      JSON.stringify({ type: 'HEALTH_UPDATE', data: { heap_free: 1, tasks_healthy: 1 } }),
    ),
    null,
  );
  assert.equal(
    parseWsIncomingFrame(JSON.stringify({ type: 'HEALTH_UPDATE', device_id: '  ', data: {} })),
    null,
  );
});

test('FAT-261: tipe tak dikenal tetap diabaikan (regresi §10)', () => {
  assert.equal(parseWsIncomingFrame(JSON.stringify({ type: 'NOPE', device_id: 'X' })), null);
  assert.equal(parseWsIncomingFrame('pong'), 'pong');
  assert.equal(parseWsIncomingFrame('bukan-json'), null);
});
