import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { apiClient, store } from './client';
import { httpApiClient } from './httpClient';
import { classifyTransportError } from './http/transport';
import { parseAbacCondition } from '../../features/system/iamValidation';
import { IamPolicyRuleSchema } from './schemas';
import { mapHourly, mapShiftSummary } from './http/mappers/monitoring';

// ---------------------------------------------------------------------------
// E28 Batch A (FAT-213/215/216/217/218/227/229 + B17/B41 + FAT-232 adendum):
// - FAT-229 MUT-03: POST policy/bind meng-OMIT abacCondition kosong (bukan
//   null); PUT tetap boleh nullable.
// - B17: filter server-side operatorId/roleId dikirim sebagai query.
// - B41: apply/rollback kirim acknowledgeUnvalidated bila diminta.
// - FAT-227 MUT-01: klasifikasi galat transport (jaringan vs timeout vs
//   tak terduga) — bukan satu pesan generik.
// - FAT-213 N-43 + FAT-218 E2E-04: aturan null — *Pct null → null (bukan 0),
//   parts_produced null bila totalCount null/absen.
// Stub HTTP di port FRESH 3031 (3001-3023 sudah terpakai tes lain).
// ---------------------------------------------------------------------------

const PORT = 3031;

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

interface Captured {
  method: string;
  path: string;
  query: string;
  body: Record<string, unknown> | null;
}

const captured: Captured[] = [];

function policyRow(abac: unknown, hasAbacKey: boolean): Record<string, unknown> {
  return {
    id: 'pol-1',
    roleId: 'role-1',
    roleName: 'OPERATOR',
    subjectMatch: 'role:OPERATOR',
    permissionId: 'perm-1',
    action: 'telemetry.read',
    resourceType: 'telemetry',
    resourcePattern: 'telemetry:*',
    effect: 'ALLOW',
    ...(hasAbacKey ? { abacCondition: abac } : {}),
    enabled: true,
    createdAt: '2026-11-20T00:00:00.000Z',
  };
}

async function readBody(req: http.IncomingMessage): Promise<Record<string, unknown> | null> {
  const chunks: Buffer[] = [];
  for await (const chunk of req) chunks.push(chunk as Buffer);
  const text = Buffer.concat(chunks).toString('utf8');
  if (!text) return null;
  try {
    return JSON.parse(text) as Record<string, unknown>;
  } catch {
    return null;
  }
}

function startStub(): Promise<http.Server> {
  const server = http.createServer(async (req, res) => {
    const url = new URL(req.url ?? '/', `http://localhost:${PORT}`);
    const body = req.method === 'GET' ? null : await readBody(req);
    captured.push({ method: req.method ?? '', path: url.pathname, query: url.search, body });
    const json = (status: number, payload: unknown) => {
      res.writeHead(status, { 'Content-Type': 'application/json', Connection: 'close' });
      res.end(JSON.stringify(payload));
    };
    if (req.method === 'POST' && url.pathname === '/api/v1/access-control/policies') {
      json(201, policyRow(body?.abacCondition ?? null, body !== null && 'abacCondition' in body));
      return;
    }
    if (req.method === 'PUT' && url.pathname.startsWith('/api/v1/access-control/policies/')) {
      json(200, policyRow(body?.abacCondition ?? null, body !== null && 'abacCondition' in body));
      return;
    }
    if (req.method === 'POST' && /^\/api\/v1\/access-control\/roles\/[^/]+\/permissions$/.test(url.pathname)) {
      json(200, { success: true });
      return;
    }
    if (req.method === 'GET' && url.pathname === '/api/v1/access-control/user-roles') {
      json(200, [
        { id: 'a-1', operator_id: 'OP-1', operator_name: 'Op Satu', role_id: 'role-1', role_name: 'OPERATOR', scope_type: 'ORGANIZATION', scope_id: null, created_at: '2026-11-20T00:00:00.000Z' },
        { id: 'a-2', operator_id: 'OP-2', operator_name: 'Op Dua', role_id: 'role-1', role_name: 'OPERATOR', scope_type: 'ORGANIZATION', scope_id: null, created_at: '2026-11-20T00:00:00.000Z' },
      ]);
      return;
    }
    if (req.method === 'GET' && url.pathname === '/api/v1/access-control/policies') {
      json(200, [
        policyRow(null, false),
        { ...policyRow({ line_id: 'LINE-01' }, true), id: 'pol-2', roleId: 'role-2', roleName: 'SUPERVISOR', subjectMatch: 'role:SUPERVISOR' },
      ]);
      return;
    }
    if (
      req.method === 'POST' &&
      /^\/api\/v1\/mqtt\/configuration\/configurations\/[^/]+\/(apply|rollback)$/.test(url.pathname)
    ) {
      json(202, { operationId: 'op-1', versionId: 'cfg-v1' });
      return;
    }
    if (req.method === 'GET' && url.pathname === '/api/v1/mqtt/configuration/operations/op-1') {
      json(200, { operation_id: 'op-1', operationId: 'op-1', status: 'SUCCEEDED', type: 'RELOAD', version_id: 'cfg-v1', versionId: 'cfg-v1' });
      return;
    }
    if (req.method === 'GET' && url.pathname.startsWith('/api/v1/mqtt/configuration/configurations/')) {
      json(200, { version_id: 'cfg-v1', status: 'ACTIVE', summary: 'baseline', config: {} });
      return;
    }
    json(404, { error: 'NOT_FOUND', message: `Rute stub tidak dikenal: ${url.pathname}` });
  });
  return new Promise((resolve) => {
    server.listen(PORT, () => resolve(server));
  });
}

async function withStub<T>(fn: () => Promise<T>): Promise<T> {
  const prevApiUrl = process.env.VITE_API_URL;
  process.env.VITE_API_URL = `http://localhost:${PORT}/api/v1`;
  const server = await startStub();
  captured.length = 0;
  httpApiClient.setNetworkMode('LAN');
  httpApiClient.setSessionActive(true, 'stub-jwt');
  try {
    return await fn();
  } finally {
    httpApiClient.setSessionActive(false, null);
    if (prevApiUrl === undefined) delete process.env.VITE_API_URL;
    else process.env.VITE_API_URL = prevApiUrl;
    await new Promise<void>((resolve) => { server.closeAllConnections(); server.close(() => resolve()); });
  }
}

function lastBody(path: string): Record<string, unknown> | null {
  const hit = [...captured].reverse().find((c) => c.path === path);
  return hit?.body ?? null;
}

function lastQuery(path: string): string {
  const hit = [...captured].reverse().find((c) => c.path === path);
  return hit?.query ?? '';
}

// --- FAT-227 MUT-01: klasifikasi galat transport ---------------------------

test('E28 Batch A (FAT-227): classifyTransportError membedakan timeout / jaringan / tak terduga', () => {
  const timeout = classifyTransportError(Object.assign(new Error('x'), { name: 'AbortError' }));
  assert.equal(timeout.code, 'NETWORK');
  assert.match(timeout.message, /Waktu tunggu habis/);
  assert.doesNotMatch(timeout.message, /terputus/);

  const network = classifyTransportError(new TypeError('fetch failed'));
  assert.equal(network.code, 'NETWORK');
  assert.match(network.message, /Koneksi jaringan terputus/);

  const unexpected = classifyTransportError(new Error('circular structure'));
  assert.equal(unexpected.code, 'TRANSPORT_ERROR');
  assert.doesNotMatch(unexpected.message, /terputus/);
  assert.match(unexpected.message, /bukan putusnya jaringan/);
});

// --- FAT-229 MUT-03: ABAC --------------------------------------------------

test('E28 Batch A (FAT-229): parseAbacCondition kosong → undefined (omit), terisi → record, rusak → error', () => {
  assert.deepEqual(parseAbacCondition(''), { ok: true, value: undefined });
  assert.deepEqual(parseAbacCondition('   '), { ok: true, value: undefined });
  const filled = parseAbacCondition('{"line_id": "LINE-01"}');
  assert.equal(filled.ok, true);
  if (filled.ok) assert.deepEqual(filled.value, { line_id: 'LINE-01' });
  assert.equal(parseAbacCondition('bukan json').ok, false);
  assert.equal(parseAbacCondition('[1,2]').ok, false);
});

test('E28 Batch A (FAT-229): IamPolicyRuleSchema menerima record/absen, menolak null', () => {
  assert.equal(IamPolicyRuleSchema.safeParse(policyRow({ line_id: 'LINE-01' }, true)).success, true);
  assert.equal(IamPolicyRuleSchema.safeParse(policyRow(null, false)).success, true);
  assert.equal(IamPolicyRuleSchema.safeParse(policyRow(null, true)).success, false);
});

test('E28 Batch A (FAT-229): createIamPolicy ABAC kosong TIDAK mengirim kunci abacCondition', async () => {
  await withStub(async () => {
    const created = await httpApiClient.createIamPolicy({
      roleId: 'role-1',
      permissionId: 'perm-1',
      resourcePattern: 'telemetry:*',
      effect: 'ALLOW',
      abacCondition: undefined,
    });
    assert.equal(created.id, 'pol-1');
    const body = lastBody('/api/v1/access-control/policies');
    assert.ok(body && !('abacCondition' in body), 'kunci abacCondition harus absen');
  });
});

test('E28 Batch A (FAT-229): createIamPolicy ABAC null (jalur lama) juga di-omit; terisi tetap dikirim', async () => {
  await withStub(async () => {
    await httpApiClient.createIamPolicy({
      roleId: 'role-1',
      permissionId: 'perm-1',
      resourcePattern: 'telemetry:*',
      effect: 'ALLOW',
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      abacCondition: null as any,
    });
    const emptyBody = lastBody('/api/v1/access-control/policies');
    assert.ok(emptyBody && !('abacCondition' in emptyBody), 'null harus di-omit, bukan dikirim');

    await httpApiClient.createIamPolicy({
      roleId: 'role-1',
      permissionId: 'perm-1',
      resourcePattern: 'telemetry:*',
      effect: 'ALLOW',
      abacCondition: { line_id: 'LINE-01' },
    });
    const filledBody = lastBody('/api/v1/access-control/policies');
    assert.deepEqual(filledBody?.abacCondition, { line_id: 'LINE-01' });
  });
});

test('E28 Batch A (FAT-229): addIamRolePermission ABAC kosong di-omit; PUT policy tetap boleh null', async () => {
  await withStub(async () => {
    await httpApiClient.addIamRolePermission('role-1', 'perm-1', {
      resourcePattern: 'telemetry:*',
      effect: 'ALLOW',
      abacCondition: undefined,
    });
    const bindBody = lastBody('/api/v1/access-control/roles/role-1/permissions');
    assert.ok(bindBody && !('abacCondition' in bindBody), 'bind: null/undefined harus di-omit');

    await httpApiClient.updateIamPolicy('pol-1', { abacCondition: null });
    const putBody = lastBody('/api/v1/access-control/policies/pol-1');
    assert.ok(putBody && 'abacCondition' in putBody, 'PUT: null harus TETAP dikirim (hapus kondisi)');
    assert.equal(putBody?.abacCondition, null);
  });
});

// --- B17: filter server-side -----------------------------------------------

test('E28 Batch A (B17): getIamUserRoles/getIamPolicies mengirim operatorId/roleId sebagai query', async () => {
  await withStub(async () => {
    await httpApiClient.getIamUserRoles({ operatorId: 'OP-1' });
    assert.match(lastQuery('/api/v1/access-control/user-roles'), /operatorId=OP-1/);
    await httpApiClient.getIamPolicies({ roleId: 'role-2' });
    assert.match(lastQuery('/api/v1/access-control/policies'), /roleId=role-2/);
    await httpApiClient.getIamUserRoles();
    assert.equal(lastQuery('/api/v1/access-control/user-roles'), '', 'tanpa filter = tanpa query');
  });
});

test('E28 Batch A (B17): demo getIamUserRoles/getIamPolicies menyaring sesuai filter', async () => {
  resetToAdminLan();
  try {
    const byOperator = await apiClient.getIamUserRoles({ operatorId: 'ADM-001' });
    assert.ok(byOperator.length >= 0);
    assert.ok(byOperator.every((a) => a.operator_id === 'ADM-001'));
    const all = await apiClient.getIamUserRoles();
    assert.ok(all.length >= byOperator.length);
    const firstRole = all[0]?.role_id ?? (await apiClient.getIamRoles())[0]?.id;
    if (firstRole) {
      const byRole = await apiClient.getIamPolicies({ roleId: firstRole });
      assert.ok(byRole.every((p) => p.roleId === firstRole));
    }
  } finally {
    resetToAdminLan();
  }
});

// --- B41: acknowledgeUnvalidated -------------------------------------------

test('E28 Batch A (B41): apply/rollback kirim acknowledgeUnvalidated bila diminta, omit bila tidak', async () => {
  await withStub(async () => {
    await httpApiClient.applyBrokerConfigVersion('cfg-v1', { confirm: true, acknowledgeUnvalidated: true });
    const applyBody = lastBody('/api/v1/mqtt/configuration/configurations/cfg-v1/apply');
    assert.equal(applyBody?.acknowledgeUnvalidated, true);
    assert.equal(applyBody?.confirm, true);

    await httpApiClient.applyBrokerConfigVersion('cfg-v1', { confirm: true });
    const applyPlain = lastBody('/api/v1/mqtt/configuration/configurations/cfg-v1/apply');
    assert.ok(applyPlain && !('acknowledgeUnvalidated' in applyPlain), 'tanpa opsi = omit');

    await httpApiClient.rollbackBrokerConfig('cfg-v1', { confirm: true, acknowledgeUnvalidated: true, reason: 'Restore baseline' });
    const rbBody = lastBody('/api/v1/mqtt/configuration/configurations/cfg-v1/rollback');
    assert.equal(rbBody?.acknowledgeUnvalidated, true);
    assert.equal(rbBody?.reason, 'Restore baseline');
  });
});

// --- FAT-213 N-43 + FAT-218 E2E-04: aturan null ----------------------------

test('E28 Batch A (FAT-218): mapHourly parts_produced null bila totalCount null/absen, angka bila ada', () => {
  const base = { bucket: '07:00', oeePct: 80.5, availabilityPct: 90.3, performancePct: 91.0, qualityPct: 98.0, rejectCount: 1, goodCount: 41 };
  assert.equal(mapHourly({ ...base, totalCount: null }).parts_produced, null);
  assert.equal(mapHourly({ ...base }).parts_produced, null);
  assert.equal(mapHourly({ ...base, totalCount: 42 }).parts_produced, 42);
  assert.equal(mapHourly({ ...base, total_count: 0 }).parts_produced, 0);
});

test('E28 Batch A (FAT-213): mapShiftSummary *Pct null dipertahankan (bukan 0); nilai ADA tetap angka', () => {
  const allNull = mapShiftSummary({ shift_name: 'Shift 1', oee: null, availability: null, performance: null, quality: null });
  assert.equal(allNull.oee, null);
  assert.equal(allNull.availability, null);
  assert.equal(allNull.performance, null);
  assert.equal(allNull.quality, null);
  const present = mapShiftSummary({ shift_name: 'Shift 1', oee: 86.6, availability: 92.4, performance: 95.4, quality: 98.2 });
  assert.equal(present.oee, 86.6);
  assert.equal(present.availability, 92.4);
  assert.equal(present.performance, 95.4);
  assert.equal(present.quality, 98.2);
});

test('E28 Batch A (FAT-218): mapShiftSummary total_parts null bila satu bucket hourly parts-nya null', () => {
  const hourly = (parts: number | null) => ({
    bucket: '07:00', oeePct: 80.5, availabilityPct: 90.3, performancePct: 91.0, qualityPct: 98.0,
    totalCount: parts, rejectCount: 1, goodCount: 41, operatingSec: 3600, runSec: 3250,
  });
  const mixed = mapShiftSummary({
    shift_name: 'Shift 1', oee: 86.6, availability: 92.4, performance: 95.4, quality: 98.2,
    hourly: [hourly(42), hourly(null)],
  });
  assert.equal(mixed.total_parts, null);
  const known = mapShiftSummary({
    shift_name: 'Shift 1', oee: 86.6, availability: 92.4, performance: 95.4, quality: 98.2,
    hourly: [hourly(42), hourly(48)],
  });
  assert.equal(known.total_parts, 90);
});
