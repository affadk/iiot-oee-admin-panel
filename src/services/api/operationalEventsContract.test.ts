// E32.3 (FAT-284): dipecah dari contractAlignment.test.ts — feed operational events global vs per-device + cache-miss DeviceHealth.
// Kode sumber tidak diubah, hanya pemecahan file tes per domain.
import test from 'node:test';
import assert from 'node:assert/strict';
import { apiClient } from './client';
import {
  buildOperationalEventsEndpoint,
  buildOperationalEventsExportEndpoint,
} from '../../utils/historicalExport';

test('Operational Events global feed vs per-device feed & DeviceHealth cache-miss behavior', async () => {
  const globalPath = buildOperationalEventsEndpoint({ device_id: 'ALL' });
  // E20 P20.4 (FAT-156, R9): dokumen menulis tanpa trailing slash.
  assert.match(globalPath, /^\/api\/v1\/operational-events(?:\?|$)/);

  const globalExportPath = buildOperationalEventsExportEndpoint({
    device_id: 'ALL',
    from: '2026-11-01T00:00:00Z',
    to: '2026-11-10T00:00:00Z',
    format: 'csv',
  });
  assert.match(globalExportPath, /^\/api\/v1\/operational-events\/export\?/);

  const onlineHealth = await apiClient.getDeviceHealth('STM32-OEE-01');
  assert.equal(typeof onlineHealth.heapFree, 'number');
  assert.equal(onlineHealth.tasksTotal, 9);

  const offlineHealth = await apiClient.getDeviceHealth('STM32-OEE-04');
  assert.equal(offlineHealth.ageSec, 999999);
  assert.equal(offlineHealth.heapFree, 0);
});
