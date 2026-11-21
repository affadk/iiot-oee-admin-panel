// E32.2 (FAT-283): dipecah dari modeAndTransport.test.ts — demo client
// (login + CRUD production lines, shifts, shift schedules).
// Kode sumber tidak diubah, hanya pemecahan file tes.
import test from 'node:test';
import assert from 'node:assert/strict';
import { apiClient } from './client';
import { ApiError } from '../../types/auth';

test('Demo login (diperbaiki): mengembalikan operator sesuai LoginResponseSchema', async () => {
  const res = await apiClient.login('ADM-001', 'Admin@2026!');
  assert.equal(res.success, true);
  assert.equal(typeof res.token, 'string');
  assert.ok(res.token.length > 0);
  assert.equal(res.operator.id, 'ADM-001');
  assert.equal(res.operator.username, 'Alexandria Vance');
  assert.equal(res.operator.role, 'ADMIN');

  const refreshed = await apiClient.refreshSession();
  assert.equal(typeof refreshed.token, 'string');
  assert.equal(refreshed.expires_in, 900);
});

test('Demo CRUD Production Lines + RESTRICT saat dipakai (Guide §7.4)', async () => {
  const created = await apiClient.createProductionLine({
    lineId: 'LINE-T1',
    lineName: 'Lini Test',
    description: 'Lini sementara untuk test',
  });
  assert.equal(created.lineId, 'LINE-T1');
  assert.equal(created.isActive, true);

  const fetched = await apiClient.getProductionLineById('LINE-T1');
  assert.equal(fetched.lineName, 'Lini Test');

  const updated = await apiClient.updateProductionLine('LINE-T1', { lineName: 'Lini Test (Ubah)' });
  assert.equal(updated.lineName, 'Lini Test (Ubah)');

  const page = await apiClient.getProductionLinesPage({ limit: 50 });
  assert.ok(page.data.some((l) => l.lineId === 'LINE-T1'));

  // LINE-01 dipakai operator seed (SUP-042/OP-115) -> RESTRICT 409
  await assert.rejects(() => apiClient.deleteProductionLine('LINE-01'), (err: unknown) => {
    assert.ok(err instanceof ApiError);
    assert.equal(err.code, 'PRODUCTION_LINE_IN_USE');
    assert.equal(err.httpStatus, 409);
    return true;
  });

  const del = await apiClient.deleteProductionLine('LINE-T1');
  assert.equal(del.success, true);
  await assert.rejects(() => apiClient.getProductionLineById('LINE-T1'), (err: unknown) => {
    assert.ok(err instanceof ApiError);
    assert.equal(err.httpStatus, 404);
    return true;
  });
});

test('Demo CRUD Shifts + RESTRICT saat dipakai jadwal', async () => {
  const created = await apiClient.createShift({
    shiftId: 'SHIFT-T1',
    shiftName: 'Shift Test',
    shiftCode: 'ST',
    startTime: '08:00',
    endTime: '16:00',
  });
  assert.equal(created.shiftCode, 'ST');

  const updated = await apiClient.updateShift('SHIFT-T1', { shiftCode: 'ST2' });
  assert.equal(updated.shiftCode, 'ST2');

  // SHIFT-1 dipakai jadwal seed -> RESTRICT 409
  await assert.rejects(() => apiClient.deleteShift('SHIFT-1'), (err: unknown) => {
    assert.ok(err instanceof ApiError);
    assert.equal(err.code, 'SHIFT_IN_USE');
    assert.equal(err.httpStatus, 409);
    return true;
  });

  assert.equal((await apiClient.deleteShift('SHIFT-T1')).success, true);
});

test('Demo Shift Schedules: overlap 409 SHIFT_SCHEDULE_OVERLAP + CRUD', async () => {
  // Shift khusus yang jamnya menabrak SHIFT-1 (07:00-15:00)
  await apiClient.createShift({
    shiftId: 'SHIFT-T9',
    shiftName: 'Shift Tabrakan',
    shiftCode: 'S9',
    startTime: '10:00',
    endTime: '18:00',
  });
  const first = await apiClient.createShiftSchedule({ lineId: 'LINE-02', shiftId: 'SHIFT-1', dayOfWeek: 7 });
  assert.equal(first.scheduleId, 'sched-line-02-shift-1-d7');

  await assert.rejects(
    () => apiClient.createShiftSchedule({ lineId: 'LINE-02', shiftId: 'SHIFT-T9', dayOfWeek: 7 }),
    (err: unknown) => {
      assert.ok(err instanceof ApiError);
      assert.equal(err.code, 'SHIFT_SCHEDULE_OVERLAP');
      assert.equal(err.httpStatus, 409);
      return true;
    }
  );

  const moved = await apiClient.updateShiftSchedule(first.scheduleId, { dayOfWeek: 6 });
  assert.equal(moved.dayOfWeek, 6);

  const page = await apiClient.getShiftSchedulesPage({ line_id: 'LINE-02', day_of_week: 6 });
  assert.ok(page.data.some((s) => s.scheduleId === first.scheduleId));

  assert.equal((await apiClient.deleteShiftSchedule(first.scheduleId)).success, true);
  assert.equal((await apiClient.deleteShift('SHIFT-T9')).success, true);
});
