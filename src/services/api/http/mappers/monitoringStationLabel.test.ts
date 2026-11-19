import test from 'node:test';
import assert from 'node:assert/strict';
import { mapOperationalEvent } from './monitoring';

// ---------------------------------------------------------------------------
// E27 (FAT-233, T2): mapOperationalEvent memetakan `station_label` secara
// TOLERAN — event lama / respons tanpa field ini → null, tidak throw.
// Field dibaca dari `stationLabel` (camelCase) maupun `station_label`
// (snake_case); string kosong / non-string → null.
// ---------------------------------------------------------------------------

function rawEvent(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    id: 'op-ev-900',
    recordedAt: '2026-11-20T00:30:00Z',
    deviceId: null,
    machineId: null,
    machineName: null,
    woId: null,
    eventType: 'SECURITY_REJECTION',
    triggerSource: 'AUTH',
    eventCode: null,
    snapshotTotalCount: null,
    snapshotRunSec: null,
    description: 'station_id is not a registered station',
    acknowledgedAt: null,
    acknowledgedBy: null,
    ackNote: null,
    createdAt: '2026-11-20T00:30:00Z',
    ...overrides,
  };
}

test('mapOperationalEvent memetakan station_label camelCase apa adanya', () => {
  const ev = mapOperationalEvent(rawEvent({ stationLabel: 'STATION-UNKNOWN-XYZ' }));
  assert.equal(ev.station_label, 'STATION-UNKNOWN-XYZ');
  assert.equal(ev.device_id, null);
});

test('mapOperationalEvent memetakan station_label snake_case apa adanya', () => {
  const ev = mapOperationalEvent(rawEvent({ station_label: 'STATION-UNKNOWN-XYZ' }));
  assert.equal(ev.station_label, 'STATION-UNKNOWN-XYZ');
});

test('mapOperationalEvent: event tanpa station_label → null (toleran, tidak throw)', () => {
  const ev = mapOperationalEvent(rawEvent());
  assert.equal(ev.station_label, null);
});

test('mapOperationalEvent: station_label string kosong / non-string → null', () => {
  assert.equal(mapOperationalEvent(rawEvent({ stationLabel: '' })).station_label, null);
  assert.equal(mapOperationalEvent(rawEvent({ stationLabel: 42 })).station_label, null);
  assert.equal(mapOperationalEvent(rawEvent({ station_label: null })).station_label, null);
});

test('mapOperationalEvent mempertahankan station_label bila device_id ada', () => {
  const ev = mapOperationalEvent(rawEvent({ deviceId: 'STM32-OEE-01', stationLabel: 'KIOSK-01' }));
  assert.equal(ev.device_id, 'STM32-OEE-01');
  assert.equal(ev.station_label, 'KIOSK-01');
});
