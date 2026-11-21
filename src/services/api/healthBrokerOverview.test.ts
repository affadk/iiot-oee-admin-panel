// E32.3 (FAT-284): dipecah dari contractAlignment.test.ts — bentuk DTO SystemHealth & BrokerOverview.
// Kode sumber tidak diubah, hanya pemecahan file tes per domain.
import test from 'node:test';
import assert from 'node:assert/strict';
import { apiClient } from './client';

test('SystemHealth & BrokerOverview match nested backend DTO shapes', async () => {
  apiClient.resetEndpointTracker();
  const health = await apiClient.getSystemHealth();
  // E20 P20.4 (FAT-156): sintesis health dihapus — /health lean (API doc §A);
  // label/environment/latency tak tersedia = null/UNKNOWN, bukan 'API v1'/0.
  assert.equal(health.backend.label, null);
  assert.equal(health.backend.environment, null);
  assert.equal(health.backend.latency_ms, null);
  assert.equal(health.backend.status, 'UNKNOWN');
  assert.equal(health.mqtt.status, 'UNKNOWN');
  assert.equal(health.mqtt.connected_clients, null);
  assert.equal(health.mqtt.dynamic_security, null);
  assert.equal(typeof health.uptime_seconds, 'number');
  assert.equal(typeof health.ws_clients, 'number');
  assert.equal(typeof health.db_connected, 'boolean');
  assert.ok(health.metrics !== null);

  // GET /health/detail (ADMIN + LAN) — per-komponen + measuredAt.
  const detail = await apiClient.getHealthDetail();
  assert.equal(detail.application.status, 'UP');
  assert.equal(detail.application.name, 'iiot-oee-backend');
  assert.equal(detail.database.status, 'UP');
  assert.equal(typeof detail.database.latencyMs, 'number');
  assert.equal(detail.mqtt.adminConnection?.connected, true);
  assert.equal(detail.mqtt.adminConnection?.pluginReady, true);
  assert.equal(typeof detail.mqtt.clientsCount, 'number');
  assert.equal(typeof detail.websocket.clients, 'number');
  assert.ok(detail.measuredAt !== null);

  const overview = await apiClient.getBrokerOverview();
  // E20 P20.5 (FAT-157): status dynsec kanonis §3.3a = "READY"; count
  // `null` dipertahankan (demo punya data → number di sini).
  assert.equal(overview.dynamicSecurity.status, 'READY');
  assert.equal(typeof overview.dynamicSecurity.clientsCount, 'number');
  assert.equal(overview.configuration.status, 'IN_SYNC');
  assert.equal(typeof overview.configuration.mutationLocked, 'boolean');
  assert.ok(apiClient.getCalledEndpointKeys().includes('MQTT_OVERVIEW'));
});
