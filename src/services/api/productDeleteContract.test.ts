// E32.3 (FAT-284): dipecah dari contractAlignment.test.ts — ON DELETE SET NULL pada penghapusan product.
// Kode sumber tidak diubah, hanya pemecahan file tes per domain.
import test from 'node:test';
import assert from 'node:assert/strict';
import { apiClient, store } from './client';

test('ON DELETE SET NULL preserves history on deleted Product while blocking active WO (409)', async () => {
  apiClient.setNetworkMode('LAN');
  apiClient.setUserRole('ADMIN');
  apiClient.setSessionActive(true);

  // Active WO product deletion must fail 409
  await assert.rejects(
    () => apiClient.deleteProduct('PRD-ARM-001'),
    (err: any) => err.httpStatus === 409 && err.code === 'PRODUCT_HAS_ACTIVE_WO'
  );

  // Deleting an unused product sets null on any historical completed/aborted WOs
  const tempProd = await apiClient.createProduct({
    product_id: 'PRD-TEMP-99',
    sku: 'SKU-TEMP-99',
    name: 'Disposable Test Flange',
    ideal_cycle_time_seconds: 15,
    active: true,
  });
  store.workOrders.push({
    wo_id: 'WO-HIST-TEMP',
    order_number: 'WO-HIST-TEMP',
    product_id: tempProd.product_id,
    product_name: tempProd.name,
    machine_id: 'CNC-MILLING-01',
    machine_name: 'CNC Milling Center Alpha',
    operator_id: 'OP-115',
    operator_name: 'Kenji Sato',
    shift_name: 'Shift 3 (23:00-07:00)',
    target_quantity: 50,
    status: 'COMPLETED',
    planned_start: '2026-11-01T00:00:00Z',
  });
  await apiClient.deleteProduct(tempProd.product_id);
  const histWo = store.workOrders.find((w) => w.wo_id === 'WO-HIST-TEMP');
  assert.equal(histWo?.product_id, null);
  assert.equal(histWo?.product_name, null);
  store.workOrders = store.workOrders.filter((w) => w.wo_id !== 'WO-HIST-TEMP');
});
