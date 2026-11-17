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
    dynamicSecurity: { enabled: true, status: 'CONNECTED', clientsCount: 2, rolesCount: 1, groupsCount: 1 },
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
  assert.equal(nullDs.dynamicSecurity.status, 'DISCONNECTED');
  assert.equal(nullDs.dynamicSecurity.clientsCount, 0);
});
