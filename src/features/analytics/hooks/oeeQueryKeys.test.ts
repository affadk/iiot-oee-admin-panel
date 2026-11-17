import test from 'node:test';
import assert from 'node:assert/strict';
import { buildOeeAnalyticsQueryKeys, OeeAnalyticsQueryInput } from './oeeQueryKeys';
import { HistoryFilters } from '../../../types/historical';

// ---------------------------------------------------------------------------
// E12 T12.9 (X-2 / FAT-62): queryKey halaman OEE harus memuat from/to —
// React Query hanya me-refetch bila queryKey berubah, jadi mengganti
// rentang di pemilih periode harus mengubah KELIMA queryKey halaman
// (summary, hourly, timeline, rollup, downtime overlay — gap G1).
// ---------------------------------------------------------------------------

const BASE_FILTERS: HistoryFilters = {
  machineId: 'CNC-MILLING-01',
  groupBy: 'machine',
  from: '2026-11-09T10:00:00+07:00',
  to: '2026-11-16T10:00:00+07:00',
  limit: 20,
  envelope: true,
};

function buildInput(overrides: Partial<OeeAnalyticsQueryInput> = {}): OeeAnalyticsQueryInput {
  return {
    machineId: 'CNC-MILLING-01',
    deviceId: 'STM32-OEE-01',
    from: '2026-11-09T10:00:00+07:00',
    to: '2026-11-16T10:00:00+07:00',
    timelineBucket: '15m',
    rollupGroupBy: 'machine',
    rollupScope: 'MACHINE',
    baseFilters: BASE_FILTERS,
    ...overrides,
  };
}

test('mengganti rentang mengubah kelima queryKey halaman OEE (refetch semua query)', () => {
  const before = buildOeeAnalyticsQueryKeys(buildInput());
  const after = buildOeeAnalyticsQueryKeys(
    buildInput({
      from: '2026-10-17T10:00:00+07:00',
      to: '2026-11-16T10:00:00+07:00',
      baseFilters: {
        ...BASE_FILTERS,
        from: '2026-10-17T10:00:00+07:00',
        to: '2026-11-16T10:00:00+07:00',
      },
    })
  );
  for (const key of ['shiftSummary', 'hourly', 'timeline', 'downtimeOverlay', 'rollup'] as const) {
    assert.notEqual(
      JSON.stringify(after[key]),
      JSON.stringify(before[key]),
      `queryKey ${key} harus berubah bila from/to berubah`
    );
    assert.ok(JSON.stringify(after[key]).includes('2026-10-17T10:00:00+07:00'));
  }
  assert.equal(after.rollupFilters.from, '2026-10-17T10:00:00+07:00');
  assert.equal(after.rollupFilters.to, '2026-11-16T10:00:00+07:00');
});

test('rentang yang sama menghasilkan queryKey yang sama (tidak ada refetch sia-sia)', () => {
  const a = buildOeeAnalyticsQueryKeys(buildInput());
  const b = buildOeeAnalyticsQueryKeys(buildInput());
  for (const key of ['shiftSummary', 'hourly', 'timeline', 'downtimeOverlay', 'rollup'] as const) {
    assert.equal(JSON.stringify(a[key]), JSON.stringify(b[key]));
  }
});

test('queryKey memuat identitas yang benar: mesin, bucket, shift, dan rollup mengikuti mesin terpilih', () => {
  const keys = buildOeeAnalyticsQueryKeys(
    buildInput({ shiftDate: '2026-11-16', shiftId: 'SHIFT-1' })
  );
  assert.deepEqual(keys.shiftSummary, [
    'oee-shift-summary',
    'CNC-MILLING-01',
    '2026-11-09T10:00:00+07:00',
    '2026-11-16T10:00:00+07:00',
    '2026-11-16',
    'SHIFT-1',
  ]);
  assert.deepEqual(keys.timeline, [
    'oee-shift-timeline',
    'CNC-MILLING-01',
    '15m',
    '2026-11-09T10:00:00+07:00',
    '2026-11-16T10:00:00+07:00',
    '2026-11-16',
    'SHIFT-1',
  ]);
  assert.deepEqual(keys.downtimeOverlay, [
    'oee-timeline-downtime',
    'STM32-OEE-01',
    '2026-11-09T10:00:00+07:00',
    '2026-11-16T10:00:00+07:00',
  ]);
  // Rollup mengikuti mesin terpilih (F-3), deviceId sengaja dikosongkan.
  assert.equal(keys.rollupFilters.machineId, 'CNC-MILLING-01');
  assert.equal(keys.rollupFilters.deviceId, undefined);
  assert.equal(keys.rollupFilters.groupBy, 'machine');
  assert.deepEqual(keys.rollup, ['oee-rollup', keys.rollupFilters, undefined]);
});

test('ganti shift mengubah queryKey summary/hourly/timeline, tapi bukan downtime overlay', () => {
  const before = buildOeeAnalyticsQueryKeys(buildInput());
  const after = buildOeeAnalyticsQueryKeys(
    buildInput({
      shiftDate: '2026-11-16',
      shiftId: 'SHIFT-1',
      baseFilters: { ...BASE_FILTERS, shiftDate: '2026-11-16', shiftId: 'SHIFT-1' },
    })
  );
  for (const key of ['shiftSummary', 'hourly', 'timeline'] as const) {
    assert.notEqual(JSON.stringify(after[key]), JSON.stringify(before[key]));
  }
  assert.equal(JSON.stringify(after.downtimeOverlay), JSON.stringify(before.downtimeOverlay));
});

// ---------------------------------------------------------------------------
// E12 T12.10 (X-3 / FAT-57): toggle scope rollup — 'MACHINE' (default,
// mesin terpilih, perilaku E11 T11.3) vs 'ALL' (plant-wide, machineId
// undefined). Scope masuk ke rollupFilters + queryKey rollup, sehingga
// ganti scope me-refetch rollup saja (query lain tidak berubah).
// ---------------------------------------------------------------------------

test('scope "Mesin ini" (default) mengirim machineId mesin terpilih ke rollup', () => {
  const keys = buildOeeAnalyticsQueryKeys(buildInput({ rollupScope: 'MACHINE' }));
  assert.equal(keys.rollupFilters.machineId, 'CNC-MILLING-01');
  assert.equal(keys.rollupFilters.deviceId, undefined);
  assert.deepEqual(keys.rollup, ['oee-rollup', keys.rollupFilters, undefined]);
});

test('scope "Semua mesin" mengirim machineId undefined (plant-wide) ke rollup', () => {
  const keys = buildOeeAnalyticsQueryKeys(buildInput({ rollupScope: 'ALL' }));
  assert.equal(keys.rollupFilters.machineId, undefined);
  assert.equal(keys.rollupFilters.deviceId, undefined);
  assert.deepEqual(keys.rollup, ['oee-rollup', keys.rollupFilters, undefined]);
});

test('ganti scope rollup mengubah queryKey rollup saja (me-refetch rollup, bukan query lain)', () => {
  const before = buildOeeAnalyticsQueryKeys(buildInput({ rollupScope: 'MACHINE' }));
  const after = buildOeeAnalyticsQueryKeys(buildInput({ rollupScope: 'ALL' }));
  assert.notEqual(JSON.stringify(after.rollup), JSON.stringify(before.rollup));
  for (const key of ['shiftSummary', 'hourly', 'timeline', 'downtimeOverlay'] as const) {
    assert.equal(
      JSON.stringify(after[key]),
      JSON.stringify(before[key]),
      `queryKey ${key} tidak boleh berubah bila hanya scope rollup berubah`
    );
  }
});

test('ganti mesin saat scope "Semua mesin" membuat rollup tetap plant-wide', () => {
  const keys = buildOeeAnalyticsQueryKeys(
    buildInput({
      rollupScope: 'ALL',
      machineId: 'CNC-GRIND-05',
      baseFilters: { ...BASE_FILTERS, machineId: 'CNC-GRIND-05' },
    })
  );
  // Mesin lain terpilih, tapi rollup tetap plant-wide (T12.10: scope
  // bertahan saat ganti mesin, tidak diam-diam kembali ke mesin).
  assert.equal(keys.rollupFilters.machineId, undefined);
  // Query lain tetap mengikuti mesin baru.
  assert.ok(JSON.stringify(keys.shiftSummary).includes('CNC-GRIND-05'));
  assert.ok(JSON.stringify(keys.hourly).includes('CNC-GRIND-05'));
});

test('ganti mesin saat scope "Mesin ini" membuat rollup mengikuti mesin baru', () => {
  const keys = buildOeeAnalyticsQueryKeys(
    buildInput({
      rollupScope: 'MACHINE',
      machineId: 'CNC-GRIND-05',
      baseFilters: { ...BASE_FILTERS, machineId: 'CNC-GRIND-05' },
    })
  );
  assert.equal(keys.rollupFilters.machineId, 'CNC-GRIND-05');
});
