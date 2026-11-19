import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { apiClient, store } from './client';
import { httpApiClient } from './httpClient';
import { mapAuthMe } from './http/mappers/system';

/**
 * E20 P20.3 (FAT-155): gerbang mustChangePassword (spec 043), hapus lockout
 * lokal, Retry-After 429, refresh authzVersion, IAM camelCase + guard
 * ROLE_IMMUTABLE / ROLE_IN_USE / INERT_PERMISSION / PERMISSION_EXISTS,
 * revoke idempoten, validasi ABAC, dan mapAuthMe 3 bentuk (D-2).
 */

function resetToAdminLan() {
  apiClient.setNetworkMode('LAN');
  apiClient.setUserRole('ADMIN');
  apiClient.setSessionActive(true);
  store.currentUserId = 'ADM-001';
  store.currentUserName = 'Alexandria Vance';
  store.currentUserRole = 'ADMIN';
  store.currentUserLineId = 'ORG-ALL';
  store.isAuthenticated = true;
  store.tokenAuthzVersion = store.iamInfo.authzVersion;
}

test('E20 P20.3: gerbang mustChangePassword — login MNT-208 flag true, rute terproteksi 403 PASSWORD_ROTATION_REQUIRED, ganti password menutup gerbang', async () => {
  resetToAdminLan();
  const flagBefore = new Set(store.operatorMustChangePassword);
  const hadPassword = store.operatorPasswords.has('MNT-208');
  try {
    const loginRes = await apiClient.login('MNT-208', 'TempPass123');
    assert.equal(loginRes.operator.id, 'MNT-208');
    assert.equal(loginRes.operator.must_change_password, true);

    // GET /auth/me tetap 200 saat gerbang aktif (§L).
    const me = await apiClient.getAuthMe();
    assert.equal(me.operator.mustChangePassword, true);

    // Rute terproteksi → 403 PASSWORD_ROTATION_REQUIRED (tanpa jalur kedua).
    await assert.rejects(
      () => apiClient.getOperators(),
      (err: any) => err.httpStatus === 403 && err.code === 'PASSWORD_ROTATION_REQUIRED'
    );

    // Ganti password menutup gerbang; login ulang flag false.
    const changed = await apiClient.changePassword('TempPass123', 'NewPass123!');
    assert.equal(changed.success, true);
    const relogin = await apiClient.login('MNT-208', 'NewPass123!');
    assert.equal(relogin.operator.must_change_password, false);
  } finally {
    store.operatorMustChangePassword = new Set(flagBefore);
    if (!hadPassword) store.operatorPasswords.delete('MNT-208');
    resetToAdminLan();
  }
});

test('E20 P20.3: createIamPermission — INERT_PERMISSION (400), PERMISSION_EXISTS (409), pasangan terjaga baru dibuat', async () => {
  resetToAdminLan();

  await assert.rejects(
    () =>
      apiClient.createIamPermission({
        action: 'teleport',
        resourceType: 'spaceship',
        description: 'No guard route',
      }),
    (err: any) => err.httpStatus === 400 && err.code === 'INERT_PERMISSION'
  );

  await assert.rejects(
    () =>
      apiClient.createIamPermission({
        action: 'read',
        resourceType: 'telemetry',
        description: 'Duplicate pair',
      }),
    (err: any) => err.httpStatus === 409 && err.code === 'PERMISSION_EXISTS'
  );

  const created = await apiClient.createIamPermission({
    action: 'read',
    resourceType: 'quality',
    description: 'Melihat analitik kualitas',
  });
  assert.equal(created.action, 'read');
  assert.equal(created.resourceType, 'quality');
});

test('E20 P20.3: deleteIamRole — ADMIN 403 ROLE_IMMUTABLE, ter-assign 409 ROLE_IN_USE (sebut operatorId), masih punya policy 409', async () => {
  resetToAdminLan();

  await assert.rejects(
    () => apiClient.deleteIamRole('role-admin'),
    (err: any) => err.httpStatus === 403 && err.code === 'ROLE_IMMUTABLE' && /immutable/.test(err.message)
  );

  await assert.rejects(
    () => apiClient.deleteIamRole('role-supervisor'),
    (err: any) => err.httpStatus === 409 && err.code === 'ROLE_IN_USE' && /SUP-042/.test(err.message)
  );

  const holder = await apiClient.createIamRole({
    name: 'POLICY_HOLDER',
    description: 'Role untuk uji hapus dengan policy',
  });
  await apiClient.addIamRolePermission(holder.id, 'perm-22', {
    resourcePattern: 'telemetry:*',
    effect: 'ALLOW',
  });
  await assert.rejects(
    () => apiClient.deleteIamRole(holder.id),
    (err: any) => err.httpStatus === 409 && err.code === 'ROLE_IN_USE'
  );

  // Lepas binding dulu (policy TIDAK dihapus diam-diam), baru hapus role.
  await apiClient.removeIamRolePermission(holder.id, 'perm-22');
  const delRes = await apiClient.deleteIamRole(holder.id);
  assert.equal(delRes.success, true);
});

test('E20 P20.3: revokeIamUserRole idempoten — tanpa baris cocok 200 {success:true, removed:0}', async () => {
  resetToAdminLan();

  const asg = await apiClient.assignIamUserRole({
    operatorId: 'OP-115',
    roleName: 'QUALITY_AUDITOR',
    scopeType: 'LINE',
    scopeId: 'LINE-99',
  });
  const first = await apiClient.revokeIamUserRole({
    id: asg.id,
    operatorId: 'OP-115',
    roleName: 'QUALITY_AUDITOR',
    scopeType: 'LINE',
    scopeId: 'LINE-99',
  });
  assert.deepEqual(first, { success: true, removed: 1 });

  const second = await apiClient.revokeIamUserRole({
    operatorId: 'OP-115',
    roleName: 'QUALITY_AUDITOR',
    scopeType: 'LINE',
    scopeId: 'LINE-99',
  });
  assert.deepEqual(second, { success: true, removed: 0 });
});

test('E20 P20.3: createIamPolicy memvalidasi ABAC — predikat tak sah 400 INVALID_POLICY', async () => {
  resetToAdminLan();

  await assert.rejects(
    () =>
      apiClient.createIamPolicy({
        roleId: 'role-quality-auditor',
        permissionId: 'perm-12',
        resourcePattern: 'operational_event:*',
        effect: 'ALLOW',
        abacCondition: { attr: 'not_a_real_attr', eq: 'x' },
      }),
    (err: any) => err.httpStatus === 400 && err.code === 'INVALID_POLICY'
  );

  const valid = await apiClient.createIamPolicy({
    roleId: 'role-quality-auditor',
    permissionId: 'perm-12',
    resourcePattern: 'operational_event:*',
    effect: 'ALLOW',
    abacCondition: { attr: 'subjectActive', eq: true },
  });
  assert.equal(valid.effect, 'ALLOW');
  assert.deepEqual(valid.abacCondition, { attr: 'subjectActive', eq: true });
  await apiClient.deleteIamPolicy(valid.id);
});

test('E20 P20.3: mapAuthMe toleran 3 bentuk — flat §L, nested §3.4, ringkas §6B (D-2)', () => {
  const flat = mapAuthMe({
    operator: {
      id: 'OP-1',
      username: 'A',
      primaryRole: 'SUPERVISOR',
      lineId: 'LINE-01',
      isActive: true,
      isProtected: false,
      mustChangePassword: false,
    },
    authz: {
      mode: 'enforce',
      authzVersion: 5,
      catalogueVersion: '1',
      attributes: { line_id: 'LINE-01' },
      capabilities: [
        { key: 'operator.read', domain: 'operator', surface: 'admin', decision: 'allow', mode: 'enforce', reason: 'ok' },
      ],
    },
  });
  assert.equal(flat.primaryRole, 'SUPERVISOR');
  assert.equal(flat.operator.role, 'SUPERVISOR');
  assert.equal(flat.operator.mustChangePassword, false);
  assert.equal(flat.authzVersion, 5);
  assert.equal(flat.mode, 'enforce');
  assert.equal(flat.capabilities['operator.read'], 'allow');
  assert.equal(flat.capabilityDetails?.['operator.read']?.domain, 'operator');
  assert.equal(flat.capabilityDetails?.['operator.read']?.reason, 'ok');
  assert.equal(flat.attributes?.line_id, 'LINE-01');

  const nested = mapAuthMe({
    access: { mode: 'enforce', channel: 'LAN', mutations_allowed: true },
    operator: { id: 'OP-2', username: 'B', primaryRole: 'ADMIN', lineId: 'ORG-ALL' },
    authz: { mode: 'enforce', authzVersion: 6, capabilities: { 'access_control.read': 'allow' } },
  });
  assert.equal(nested.access?.mode, 'enforce');
  assert.equal(nested.access?.channel, 'LAN');
  assert.equal(nested.access?.mutations_allowed, true);
  assert.equal(nested.capabilities['access_control.read'], 'allow');

  const concise = mapAuthMe({
    capabilities: { 'operator.read': 'allow' },
    mode: 'shadow',
  });
  assert.equal(concise.primaryRole, undefined);
  assert.equal(concise.operator.role, 'UNASSIGNED');
  assert.equal(concise.capabilities['operator.read'], 'allow');
  assert.equal(concise.mode, 'shadow');
});

test('E20 P20.3: HTTP stub port 3006 — 429 membawa Retry-After dari server; refresh mengembalikan authzVersion server', async () => {
  const prevApiUrl = process.env.VITE_API_URL;
  process.env.VITE_API_URL = 'http://localhost:3006/api/v1';
  const server = http.createServer((req, res) => {
    const url = new URL(req.url ?? '/', 'http://localhost:3006');
    const json = (status: number, payload: unknown, headers: Record<string, string> = {}) => {
      res.writeHead(status, { 'Content-Type': 'application/json', ...headers });
      res.end(JSON.stringify(payload));
    };
    if (req.method === 'POST' && url.pathname === '/api/v1/auth/login') {
      const chunks: Buffer[] = [];
      req.on('data', (c: Buffer) => chunks.push(c));
      req.on('end', () => {
        const body = JSON.parse(Buffer.concat(chunks).toString('utf8'));
        if (body.operator_id === 'RATE-LIMITED') {
          json(429, { error: 'TOO_MANY_REQUESTS', message: 'Terlalu banyak percobaan login.' }, { 'Retry-After': '42' });
        } else {
          json(200, {
            success: true,
            token: 'stub-jwt-3006',
            expires_in: 900,
            operator: { id: 'ADM-001', username: 'Alexandria Vance', role: 'ADMIN', line_id: 'ORG-ALL' },
          });
        }
      });
      return;
    }
    if (req.method === 'POST' && url.pathname === '/api/v1/auth/refresh') {
      json(200, { success: true, token: 'stub-refreshed-3006', expires_in: 900, authzVersion: 7 });
      return;
    }
    json(404, { error: 'NOT_FOUND', message: `Rute stub tidak dikenal: ${req.method} ${url.pathname}` });
  });
  await new Promise<void>((resolve) => server.listen(3006, resolve));
  try {
    await assert.rejects(
      () => httpApiClient.login('RATE-LIMITED', 'Whatever123'),
      (err: any) => err.httpStatus === 429 && err.code === 'TOO_MANY_REQUESTS' && err.retryAfterSec === 42
    );

    const loggedIn = await httpApiClient.login('ADM-001', 'Admin@2026!');
    assert.equal(loggedIn.token, 'stub-jwt-3006');

    const refreshed = await httpApiClient.refreshSession();
    assert.equal(refreshed.token, 'stub-refreshed-3006');
    assert.equal(refreshed.authz_version, 7);
  } finally {
    httpApiClient.setSessionActive(false, null);
    if (prevApiUrl === undefined) delete process.env.VITE_API_URL;
    else process.env.VITE_API_URL = prevApiUrl;
    await new Promise<void>((resolve) => server.close(() => resolve()));
  }
});
