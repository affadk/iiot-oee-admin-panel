import test from 'node:test';
import assert from 'node:assert/strict';
import {
  normalizeFsmState,
  formatDuration,
  parseServerMetric,
  formatDeletedRelationLabel,
  canPerformMutation,
  canCancelWorkOrder,
  canForceReconciliationRefresh,
} from './oeeCalculations';

test('normalizeFsmState maps legacy and backend states exclusively to 6 canonical FsmStateEnum values', () => {
  assert.equal(normalizeFsmState('RUNNING'), 'RUNNING');
  assert.equal(normalizeFsmState('STANDBY'), 'READY');
  assert.equal(normalizeFsmState('standby'), 'READY');
  assert.equal(normalizeFsmState('READY'), 'READY');
  assert.equal(normalizeFsmState('PLANNED_STOP'), 'PLANNED_DOWNTIME');
  assert.equal(normalizeFsmState('PLANNED_DOWNTIME'), 'PLANNED_DOWNTIME');
  assert.equal(normalizeFsmState('FAULT'), 'UNPLANNED_DOWNTIME');
  assert.equal(normalizeFsmState('STOPPED'), 'UNPLANNED_DOWNTIME');
  assert.equal(normalizeFsmState('DOWNTIME'), 'UNPLANNED_DOWNTIME');
  assert.equal(normalizeFsmState('UNPLANNED_DOWNTIME'), 'UNPLANNED_DOWNTIME');
  assert.equal(normalizeFsmState('BATCH_FINISHED'), 'BATCH_FINISHED');
  assert.equal(normalizeFsmState(undefined), 'UNCONFIGURED');
  assert.equal(normalizeFsmState('UNKNOWN_STATE'), 'UNCONFIGURED');
});

test('formatDuration formats seconds into industrial Xh Ym Zs format', () => {
  assert.equal(formatDuration(0), '0s');
  assert.equal(formatDuration(-5), '0s');
  assert.equal(formatDuration(45), '45s');
  assert.equal(formatDuration(125), '2m 5s');
  assert.equal(formatDuration(3665), '1h 1m 5s');
});

test('parseServerMetric parses numeric strings returned by backend without client-side recalculation', () => {
  assert.equal(parseServerMetric('92.50'), 92.5);
  assert.equal(parseServerMetric(84.6), 84.6);
  assert.equal(parseServerMetric(null, 0), 0);
  assert.equal(parseServerMetric('invalid', 12), 12);
});

test('formatDeletedRelationLabel renders [dihapus] placeholder safely when master record was set null', () => {
  assert.deepEqual(formatDeletedRelationLabel(null, null), {
    label: '[dihapus]',
    isDeleted: true,
  });
  assert.deepEqual(formatDeletedRelationLabel('[deleted]', 'PRD-OLD-01'), {
    label: '[dihapus] (PRD-OLD-01)',
    isDeleted: true,
  });
  assert.deepEqual(formatDeletedRelationLabel('Titanium Rotor Arm A1', 'PRD-ARM-001'), {
    label: 'Titanium Rotor Arm A1',
    isDeleted: false,
  });
});

test('canPerformMutation blocks all LAN mutations in REMOTE_TUNNEL mode', () => {
  const result = canPerformMutation('ADMIN', 'REMOTE_TUNNEL', 'BROKER_CONFIG');
  assert.equal(result.allowed, false, 'Remote mode must disable mutations');
  assert.match(result.reason ?? '', /Mode observasi — perubahan dinonaktifkan/i);
});

test('canPerformMutation enforces role baseline checks on local LAN', () => {
  assert.equal(canPerformMutation('OPERATOR', 'LAN', 'BROKER_CONFIG').allowed, false);
  assert.equal(canPerformMutation('OPERATOR', 'LAN', 'ACK_EVENT').allowed, true);
  assert.equal(canPerformMutation('SUPERVISOR', 'LAN', 'REFRESH_RECONCILIATION').allowed, true);
  assert.equal(canPerformMutation('SUPERVISOR', 'LAN', 'BROKER_CONFIG').allowed, false);
  assert.equal(canPerformMutation('ADMIN', 'LAN', 'BROKER_CONFIG').allowed, true);
  assert.equal(canPerformMutation('ADMIN', 'LAN', 'MANAGE_IAM').allowed, true);
});

test('canCancelWorkOrder & canForceReconciliationRefresh enforce RBAC & LAN perimeter', () => {
  assert.equal(canCancelWorkOrder('ADMIN', 'LAN'), true);
  assert.equal(canCancelWorkOrder('SUPERVISOR', 'LAN'), false);
  assert.equal(canCancelWorkOrder('OPERATOR', 'LAN'), false);
  assert.equal(canCancelWorkOrder('MAINTENANCE', 'LAN'), false);
  assert.equal(canCancelWorkOrder('ADMIN', 'REMOTE_TUNNEL'), false);

  assert.equal(canForceReconciliationRefresh('ADMIN', 'LAN'), true);
  assert.equal(canForceReconciliationRefresh('SUPERVISOR', 'LAN'), true);
  assert.equal(canForceReconciliationRefresh('OPERATOR', 'LAN'), false);
  assert.equal(canForceReconciliationRefresh('MAINTENANCE', 'LAN'), false);
  assert.equal(canForceReconciliationRefresh('ADMIN', 'REMOTE_TUNNEL'), false);
});
