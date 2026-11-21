// E32.3 (FAT-284): dipecah dari contractAlignment.test.ts — kontrak resolve & cancel work order.
// Kode sumber tidak diubah, hanya pemecahan file tes per domain.
import test from 'node:test';
import assert from 'node:assert/strict';
import { apiClient, store } from './client';

test('Work Order resolve & ADMIN-only cancel follow Read-Only + Cancel Admin contract', async () => {
  apiClient.setNetworkMode('LAN');
  apiClient.setUserRole('ADMIN');
  apiClient.setSessionActive(true);

  const wos = await apiClient.getWorkOrders();
  const validSet = new Set(['PENDING', 'ACTIVE', 'PENDING_CLOSE', 'COMPLETED', 'ABORTED']);
  for (const wo of wos) {
    assert.ok(validSet.has(wo.status), `Invalid WorkOrder status: ${wo.status}`);
  }

  const resolved = await apiClient.resolveWorkOrder('WO-2026-101', 'STM32-OEE-01');
  assert.equal(resolved.success, true);
  assert.equal(resolved.work_order.wo_id, 'WO-2026-101');
  assert.equal(typeof resolved.work_order.targetPerHour, 'number');

  // Offline device throws 503 DEVICE_OFFLINE
  await assert.rejects(
    () => apiClient.resolveWorkOrder('WO-2026-101', 'STM32-OEE-04'),
    (err: any) => err.httpStatus === 503 && err.code === 'DEVICE_OFFLINE'
  );

  // Cancel WO-2026-103 and verify return shape, then restore for subsequent tests
  const snapshotStatus = store.workOrders.find((w) => w.wo_id === 'WO-2026-103')?.status ?? 'PENDING';
  const cancelled = await apiClient.cancelWorkOrder('WO-2026-103', 'Planned tooling revision');
  assert.equal(cancelled.success, true);
  assert.equal(cancelled.work_order.status, 'ABORTED');
  const wo103 = store.workOrders.find((w) => w.wo_id === 'WO-2026-103');
  if (wo103) {
    wo103.status = snapshotStatus;
    delete wo103.actual_end_at;
  }
});
