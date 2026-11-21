import test from 'node:test';
import assert from 'node:assert/strict';
import { mapWsHealthEventToDeviceHealth } from './assets';
import type { TelemetryWsHealthEvent } from '../../../ws/telemetrySocket';

// FAT-261: HEALTH_UPDATE dari WS dipetakan ke DeviceHealth yang SAMA dengan
// snapshot HTTP. WS tidak membawa ageSec — umur laporan dihitung dari
// timestamp frame terhadap nowMs (di-inject agar tes deterministik).

function healthEvent(overrides: Partial<TelemetryWsHealthEvent['data']> = {}): TelemetryWsHealthEvent {
  return {
    type: 'HEALTH_UPDATE',
    device_id: 'STM32-OEE-SIM',
    timestampIso: '2026-11-20T10:26:09.586Z',
    data: {
      heapFree: 65536,
      tasksHealthy: 8,
      tasksTotal: 8,
      staleTasks: [],
      staleCount: 0,
      eventFlags: 0,
      ...overrides,
    },
  };
}

const NOW = Date.parse('2026-11-20T10:26:09.586Z');

test('FAT-261: mapWsHealthEventToDeviceHealth — field + ageSec dari timestamp', () => {
  const h = mapWsHealthEventToDeviceHealth(healthEvent(), NOW + 7000);
  assert.equal(h.device_id, 'STM32-OEE-SIM');
  assert.equal(h.heapFree, 65536);
  assert.equal(h.tasksHealthy, 8);
  assert.equal(h.tasksTotal, 8);
  assert.equal(h.ageSec, 7);
  assert.deepEqual(h.eventFlags, []);
  assert.equal(h.timestamp, '2026-11-20T10:26:09.586Z');
});

test('FAT-261: eventFlags bitmask didekode tabel 12-bit firmware', () => {
  const h = mapWsHealthEventToDeviceHealth(healthEvent({ eventFlags: 1 | 2 }), NOW);
  assert.deepEqual(h.eventFlags, ['ETHERNET_UP', 'MQTT_CONNECTED']);
  const h2 = mapWsHealthEventToDeviceHealth(healthEvent({ eventFlags: 2048 }), NOW);
  assert.deepEqual(h2.eventFlags, ['START_REJECTED']);
});

test('FAT-261: timestamp di masa depan → ageSec 0 (dijepit, bukan negatif)', () => {
  const h = mapWsHealthEventToDeviceHealth(healthEvent(), NOW - 5000);
  assert.equal(h.ageSec, 0);
});

test('FAT-261: stale tasks diteruskan apa adanya', () => {
  const h = mapWsHealthEventToDeviceHealth(
    healthEvent({ staleTasks: ['MODBUS'], staleCount: 1, tasksHealthy: 7 }),
    NOW,
  );
  assert.deepEqual(h.staleTasks, ['MODBUS']);
  assert.equal(h.staleCount, 1);
  assert.equal(h.tasksHealthy, 7);
});
