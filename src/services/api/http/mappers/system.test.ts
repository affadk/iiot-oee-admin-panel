import test from 'node:test';
import assert from 'node:assert/strict';
import { mapMqttClient, mapBrokerOverview } from './system';

// ---------------------------------------------------------------------------
// E15 K-06 B35 (FAT-131): mapMqttClient `enabled` harus benar untuk kedua
// bentuk respons backend — `{enabled:false}` tidak boleh tampil aktif.
// E15 K-07 B44 (FAT-132): mapBrokerOverview `configuration: null` berarti
// plugin tidak aktif → status UNAVAILABLE, bukan IN_SYNC.
// ---------------------------------------------------------------------------

test('E15 B35: mapMqttClient enabled benar untuk bentuk enabled dan disabled', () => {
  assert.equal(mapMqttClient({ username: 'u1', enabled: false }).enabled, false);
  assert.equal(mapMqttClient({ username: 'u1', enabled: true }).enabled, true);
  assert.equal(mapMqttClient({ username: 'u1', disabled: true }).enabled, false);
  assert.equal(mapMqttClient({ username: 'u1', disabled: false }).enabled, true);
  assert.equal(mapMqttClient({ username: 'u1' }).enabled, true);
  // Bila keduanya ada, `enabled` menang.
  assert.equal(mapMqttClient({ username: 'u1', enabled: false, disabled: false }).enabled, false);
  assert.equal(mapMqttClient({ username: 'u1', enabled: true, disabled: true }).enabled, true);
});

test('E15 B44: mapBrokerOverview configuration null → UNAVAILABLE', () => {
  const base = {
    dynamicSecurity: { enabled: true, status: 'READY', clientsCount: 2, rolesCount: 1, groupsCount: 1 },
  };
  assert.equal(mapBrokerOverview({ ...base, configuration: null }).configuration.status, 'UNAVAILABLE');
  assert.equal(mapBrokerOverview({ ...base }).configuration.status, 'UNAVAILABLE');
  assert.equal(
    mapBrokerOverview({ ...base, configuration: { status: 'DRIFT', activeVersionId: 'v1' } }).configuration.status,
    'DRIFT',
  );
  assert.equal(
    mapBrokerOverview({ ...base, configuration: { status: 'IN_SYNC', activeVersionId: 'v1' } }).configuration.status,
    'IN_SYNC',
  );
  const nullDs = mapBrokerOverview({ dynamicSecurity: null, configuration: null });
  assert.equal(nullDs.dynamicSecurity.enabled, false);
  // E20 P20.5 (FAT-157): status dynsec kanonis §3.3a = "READY" (bukan
  // CONNECTED/DISCONNECTED); count null dipertahankan (bukan 0, FR-035-51).
  assert.equal(nullDs.dynamicSecurity.status, 'READY');
  assert.equal(nullDs.dynamicSecurity.clientsCount, null);
  assert.equal(nullDs.dynamicSecurity.rolesCount, null);
  assert.equal(nullDs.dynamicSecurity.groupsCount, null);
  assert.equal(nullDs.dynamicSecurity.available, false);
  assert.equal(nullDs.dynamicSecurity.lastError, null);
  assert.equal(nullDs.dynamicSecurity.measuredAt, null);
});

test('P20.5: mapBrokerOverview memetakan available/lastError/measuredAt/lastOperation (§3.3a)', () => {
  const ov = mapBrokerOverview({
    dynamicSecurity: {
      available: true,
      enabled: true,
      clientsCount: 3,
      rolesCount: 2,
      groupsCount: 1,
      lastError: 'timeout',
      measuredAt: '2026-11-19T08:00:00Z',
    },
    configuration: {
      status: 'IN_SYNC',
      activeVersionId: 'v9',
      lastAppliedAt: '2026-11-19T07:00:00Z',
      mutationLocked: true,
      lastOperation: 'op-1',
      measuredAt: '2026-11-19T08:00:00Z',
    },
  });
  assert.equal(ov.dynamicSecurity.status, 'READY');
  assert.equal(ov.dynamicSecurity.available, true);
  assert.equal(ov.dynamicSecurity.lastError, 'timeout');
  assert.equal(ov.dynamicSecurity.measuredAt, '2026-11-19T08:00:00Z');
  assert.equal(ov.configuration.lastOperation, 'op-1');
  assert.equal(ov.configuration.measuredAt, '2026-11-19T08:00:00Z');
  assert.equal(ov.configuration.mutationLocked, true);
});
