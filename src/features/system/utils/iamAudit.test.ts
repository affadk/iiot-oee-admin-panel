import test from 'node:test';
import assert from 'node:assert/strict';
import type { IamAuditDecision } from '../../../types/iam';
import {
  IAM_AUDIT_PAGE_SIZE,
  buildIamAuditCsvFilename,
  filterIamAuditByResourceAction,
  paginateIamAuditDecisions,
} from './iamAudit';

const makeDecision = (overrides: Partial<IamAuditDecision>): IamAuditDecision => ({
  id: overrides.id ?? 'dec-1',
  subject: overrides.subject ?? 'ADM-001',
  decision: overrides.decision ?? 'ALLOW',
  mode: overrides.mode ?? 'enforce',
  action: overrides.action ?? 'mqtt.dynamic_security.read',
  resource: overrides.resource ?? 'mqtt/dynamic-security/roles',
  reason: overrides.reason ?? 'policy match',
  timestamp: overrides.timestamp ?? '2026-11-21T03:00:00.000Z',
});

test('P33.6: filter Resource/Action kosong = semua baris', () => {
  const rows = [makeDecision({ id: 'a' }), makeDecision({ id: 'b' })];
  assert.deepEqual(
    filterIamAuditByResourceAction(rows, { resourceQuery: '', actionQuery: '' }).map((d) => d.id),
    ['a', 'b'],
  );
});

test('P33.6: filter Resource substring, tidak sensitif huruf', () => {
  const rows = [
    makeDecision({ id: 'a', resource: 'mqtt/dynamic-security/roles' }),
    makeDecision({ id: 'b', resource: 'operators/ADM-001' }),
  ];
  assert.deepEqual(
    filterIamAuditByResourceAction(rows, { resourceQuery: 'DYNAMIC-SECURITY', actionQuery: '' }).map((d) => d.id),
    ['a'],
  );
});

test('P33.6: filter Action substring digabung dengan Resource (AND)', () => {
  const rows = [
    makeDecision({ id: 'a', action: 'mqtt.dynamic_security.read', resource: 'mqtt/x' }),
    makeDecision({ id: 'b', action: 'mqtt.dynamic_security.write', resource: 'mqtt/x' }),
    makeDecision({ id: 'c', action: 'mqtt.dynamic_security.read', resource: 'other/y' }),
  ];
  assert.deepEqual(
    filterIamAuditByResourceAction(rows, { resourceQuery: 'mqtt/x', actionQuery: 'read' }).map((d) => d.id),
    ['a'],
  );
});

test('P33.6: paginasi — halaman pertama, tengah, terakhir', () => {
  const rows = Array.from({ length: 60 }, (_, i) => makeDecision({ id: `d${i}` }));
  const first = paginateIamAuditDecisions(rows, 0);
  assert.equal(first.pageRows.length, IAM_AUDIT_PAGE_SIZE);
  assert.equal(first.pageIndex, 0);
  assert.equal(first.pageCount, 3);
  assert.equal(first.hasPrev, false);
  assert.equal(first.hasMore, true);

  const last = paginateIamAuditDecisions(rows, 2);
  assert.equal(last.pageRows.length, 10);
  assert.equal(last.hasPrev, true);
  assert.equal(last.hasMore, false);
  assert.equal(last.pageRows[0].id, 'd50');
});

test('P33.6: paginasi — indeks di luar rentang di-clamp, daftar kosong = 1 halaman kosong', () => {
  const rows = Array.from({ length: 30 }, (_, i) => makeDecision({ id: `d${i}` }));
  const beyond = paginateIamAuditDecisions(rows, 99);
  assert.equal(beyond.pageIndex, 1);
  assert.equal(beyond.pageRows.length, 5);

  const empty = paginateIamAuditDecisions([], 0);
  assert.equal(empty.pageCount, 1);
  assert.equal(empty.pageRows.length, 0);
  assert.equal(empty.hasMore, false);
  assert.equal(empty.hasPrev, false);
});

test('P33.6: nama file ekspor CSV memakai tanggal lokal', () => {
  assert.equal(
    buildIamAuditCsvFilename(new Date(2026, 10, 21, 9, 30)),
    'audit-iam-2026-11-21.csv',
  );
});
