import test from 'node:test';
import assert from 'node:assert/strict';
import { mapBrokerConfigStatus, mapBrokerConfigVersion } from './mqttConfig';

// ---------------------------------------------------------------------------
// E23 Batch 1 — mapper konfigurasi broker dipindah dari system.ts ke sini
// (R9.2): system.ts menyentuh hard cap 600 baris.
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// E23 Batch 1 (FAT-179, N-10): spec live —
// `{runtime, lock, current, lastOperation, lastAppliedVersionId}`.
// ---------------------------------------------------------------------------

const SPEC_CONFIG_STATUS = {
  runtime: {
    mode: 'helper',
    available: true,
    validation: { available: true },
    reload: { available: true },
    restart: { available: false, reason: 'restart tidak didukung helper' },
    apply: { available: true },
    targetContainer: 'mosquitto',
    lastError: null,
  },
  lock: { held: true, stale: false, ownerPid: 42, startedAt: '2026-11-19T09:00:00Z', operationId: 'op-7' },
  current: { checksum: 'abc123', sizeBytes: 2910, modifiedAt: '2026-11-19T08:00:00Z' },
  lastOperation: {
    operation_id: 'op-7',
    version_id: 'cfg-v1',
    type: 'APPLY',
    status: 'SUCCEEDED',
    domainStatus: 'SUCCEEDED',
    domainAction: 'APPLY',
    phase: 'done',
    actorId: 'ADM-001',
    actorName: 'Alexandria Vance',
    reason: null,
    startedAt: '2026-11-19T09:00:00Z',
    finishedAt: '2026-11-19T09:00:30Z',
    steps: [],
    error: null,
    result: { previousVersionId: null, appliedVersionId: 'cfg-v1', rollbackAttempted: false, rollbackSucceeded: false },
  },
  lastAppliedVersionId: 'cfg-v1',
};

test('E23 N-10: mapBrokerConfigStatus memetakan bentuk spec live', () => {
  const st = mapBrokerConfigStatus(SPEC_CONFIG_STATUS);
  assert.equal(st.runtime.mode, 'helper');
  assert.equal(st.runtime.available, true);
  assert.equal(st.runtime.apply.available, true);
  assert.equal(st.runtime.restart.available, false);
  assert.equal(st.runtime.restart.reason, 'restart tidak didukung helper');
  assert.equal(st.lock.held, true);
  assert.equal(st.lock.ownerPid, 42);
  assert.equal(st.current?.checksum, 'abc123');
  assert.equal(st.current?.sizeBytes, 2910);
  assert.equal(st.lastOperation?.operation_id, 'op-7');
  assert.equal(st.lastOperation?.type, 'APPLY');
  assert.equal(st.lastAppliedVersionId, 'cfg-v1');
});

test('E23 N-10 (negatif): payload bentuk lama (field top-level) tidak lagi menghasilkan status palsu', () => {
  const st = mapBrokerConfigStatus({
    status: 'IN_SYNC',
    activeVersionId: 'cfg-v1',
    lastAppliedAt: '2026-11-19T08:00:00Z',
    mutationLocked: true,
    lastOperation: 'op-7',
    measuredAt: '2026-11-19T08:00:00Z',
  });
  // Tak satu pun field lama ada di spec — hasil harus kosong/aman, bukan
  // 'UNAVAILABLE' fabrikasi maupun versi aktif palsu.
  assert.equal(st.runtime.mode, null);
  assert.equal(st.runtime.available, false);
  assert.equal(st.lock.held, false);
  assert.equal(st.current, null);
  assert.equal(st.lastOperation, null);
  assert.equal(st.lastAppliedVersionId, null);
});

// ---------------------------------------------------------------------------
// E23 Batch 1 (FAT-181, N-12): respons stage 201 menyertakan
// `validation`/`impact`/`diff` — disimpan di BrokerConfigVersion.
// ---------------------------------------------------------------------------

test('E23 N-12: mapBrokerConfigVersion menyimpan validation/impact/diff dari respons stage 201', () => {
  const v = mapBrokerConfigVersion({
    version_id: 'cfg-v2.0.18-rel-9',
    parent_version_id: 'cfg-v2.0.18-rel-4',
    applied_at: '2026-11-19T09:00:00Z',
    applied_by: 'ADM-001',
    summary: 'Uji stage',
    operation_type: 'RELOAD',
    status: 'STAGED',
    domainStatus: 'STAGED',
    validationStatus: 'failed',
    impactAction: 'reload',
    createdAt: '2026-11-19T09:00:00Z',
    config: { version: '1' },
    validation: {
      status: 'failed',
      checkedAt: '2026-11-19T09:00:00Z',
      issues: [{ field: 'bridges[0].remote_address', message: 'Alamat remote wajib diisi.', severity: 'error' }],
      isolated: { status: 'skipped' },
    },
    impact: {
      action: 'reload',
      reasons: ['listener berubah'],
      changes: [{ scope: 'listeners', key: 'listener-mqtt-1883', operation: 'change' }],
    },
    diff: {
      baseVersionId: 'cfg-v2.0.18-rel-4',
      versionId: 'cfg-v2.0.18-rel-9',
      baseChecksum: 'aaa',
      checksum: 'bbb',
      truncated: false,
      lines: [{ type: 'add', oldLine: null, newLine: 3, text: 'max_connections 2000' }],
    },
  });
  assert.equal(v.validation?.status, 'failed');
  assert.equal(v.validation?.issues.length, 1);
  assert.equal(v.validation?.issues[0].field, 'bridges[0].remote_address');
  assert.equal(v.impact?.action, 'reload');
  assert.equal(v.impact?.changes[0].operation, 'change');
  assert.equal(v.diff?.lines.length, 1);
  assert.equal(v.diff?.lines[0].type, 'add');
  assert.equal(v.diff?.lines[0].text, 'max_connections 2000');
});

test('E23 N-12: mapBrokerConfigVersion tanpa validation/impact/diff tetap jalan (GET list lama)', () => {
  const v = mapBrokerConfigVersion({
    version_id: 'cfg-v1',
    applied_at: '2026-11-19T09:00:00Z',
    applied_by: 'system',
    summary: 'Lama',
    operation_type: 'NO_OPERATION',
    status: 'ACTIVE',
    config: {},
  });
  assert.equal(v.validation, undefined);
  assert.equal(v.impact, undefined);
  assert.equal(v.diff, undefined);
});
