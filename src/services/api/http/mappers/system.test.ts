import test from 'node:test';
import assert from 'node:assert/strict';
import { mapMqttClient, mapBrokerOverview, mapIamSubjectEffectivePermissions } from './system';

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
  // E23 Batch 3 (FAT-197, N-28): tanpa `status` dari server (varian
  // available=false) → fallback 'DISCONNECTED', bukan 'READY' hardcode;
  // count null dipertahankan (bukan 0, FR-035-51).
  assert.equal(nullDs.dynamicSecurity.status, 'DISCONNECTED');
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
      status: 'CONNECTING',
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
      // E23 Batch 3 (FAT-197, N-28): `lastOperation` spec berupa OBJEK
      // (bukan string 'op-1' seperti asumsi lama).
      lastOperation: {
        operation_id: 'op-1',
        version_id: 'v9',
        type: 'APPLY',
        status: 'SUCCEEDED',
        domainStatus: 'SUCCEEDED',
        domainAction: 'APPLY',
        phase: 'done',
        actorId: 'ADM-001',
        actorName: 'Alexandria Vance',
        reason: 'apply v9',
        startedAt: '2026-11-19T07:00:00Z',
        finishedAt: '2026-11-19T07:00:02Z',
        steps: [],
        error: null,
        result: { previousVersionId: 'v8', appliedVersionId: 'v9', rollbackAttempted: false, rollbackSucceeded: false },
      },
      measuredAt: '2026-11-19T08:00:00Z',
    },
  });
  assert.equal(ov.dynamicSecurity.status, 'CONNECTING');
  assert.equal(ov.dynamicSecurity.available, true);
  assert.equal(ov.dynamicSecurity.lastError, 'timeout');
  assert.equal(ov.dynamicSecurity.measuredAt, '2026-11-19T08:00:00Z');
  assert.equal(ov.configuration.lastOperation?.operation_id, 'op-1');
  assert.equal(ov.configuration.lastOperation?.type, 'APPLY');
  assert.equal(ov.configuration.lastOperation?.actorName, 'Alexandria Vance');
  assert.equal(ov.configuration.measuredAt, '2026-11-19T08:00:00Z');
  assert.equal(ov.configuration.mutationLocked, true);
});

test('E23 N-28 (FAT-197): mapBrokerOverview varian available=false membawa reason; status READY dipetakan', () => {
  const ov = mapBrokerOverview({
    dynamicSecurity: {
      available: false,
      reason: 'plugin tidak aktif',
      clientsCount: null,
      rolesCount: null,
      groupsCount: null,
      lastError: null,
      measuredAt: '2026-11-19T08:00:00Z',
    },
    configuration: {
      status: 'UNAVAILABLE',
      activeVersionId: null,
      lastAppliedAt: null,
      mutationLocked: false,
      lastOperation: null,
      measuredAt: '2026-11-19T08:00:00Z',
    },
  });
  assert.equal(ov.dynamicSecurity.available, false);
  assert.equal(ov.dynamicSecurity.reason, 'plugin tidak aktif');
  assert.equal(ov.dynamicSecurity.status, 'DISCONNECTED');
  assert.equal(ov.dynamicSecurity.clientsCount, null);
  assert.equal(ov.configuration.lastOperation, null);
});

// ---------------------------------------------------------------------------
// E23 Batch 1 (FAT-176, N-7): spec live — `roles` string[], detail peran di
// `assignments[]`; izin membawa `roleName` sebagai sumber peran.
// ---------------------------------------------------------------------------

const SPEC_EFFECTIVE_PERMS = {
  operatorId: 'OP-115',
  primaryRole: 'OPERATOR',
  isActive: true,
  isProtected: false,
  authzVersion: 3,
  effectiveInMode: 'enforce',
  assignments: [
    { roleName: 'ADMIN', roleId: 'role-admin', scopeType: 'ORGANIZATION', scopeId: null },
    { roleName: 'OPERATOR', roleId: 'role-operator', scopeType: 'LINE', scopeId: 'LINE-01' },
  ],
  roles: ['ADMIN', 'OPERATOR'],
  permissions: [
    { roleName: 'ADMIN', action: 'read', resourceType: 'telemetry', resourcePattern: '*', effect: 'ALLOW', abacCondition: null },
  ],
};

test('E23 N-7: mapIamSubjectEffectivePermissions membaca roles string[] + assignments[] (spec live)', () => {
  const eff = mapIamSubjectEffectivePermissions(SPEC_EFFECTIVE_PERMS, 'OP-115');
  assert.deepEqual(eff.roles, ['ADMIN', 'OPERATOR']);
  assert.equal(eff.assignments.length, 2);
  assert.equal(eff.assignments[0].role_name, 'ADMIN');
  assert.equal(eff.assignments[1].scope_type, 'LINE');
  assert.equal(eff.assignments[1].scope_id, 'LINE-01');
  assert.equal(eff.permissions[0].sourceRole, 'ADMIN');
  assert.equal(eff.primaryRole, 'OPERATOR');
});

test('E23 N-7 (negatif): roles string[] tidak lagi menghasilkan roleName kosong', () => {
  const eff = mapIamSubjectEffectivePermissions(SPEC_EFFECTIVE_PERMS, 'OP-115');
  // Bentuk lama memperlakukan tiap string sebagai objek → roleName ''.
  assert.ok(eff.roles.every((r) => r !== ''), 'tidak ada peran kosong');
  assert.ok(eff.roles.includes('ADMIN') && eff.roles.includes('OPERATOR'));
  // Tanpa assignments pun badge peran tetap terisi dari roles.
  const noAssign = mapIamSubjectEffectivePermissions({ ...SPEC_EFFECTIVE_PERMS, assignments: [] }, 'OP-115');
  assert.deepEqual(noAssign.roles, ['ADMIN', 'OPERATOR']);
  assert.deepEqual(noAssign.assignments, []);
});
