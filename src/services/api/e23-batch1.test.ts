import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { httpApiClient } from './httpClient';
import type { BrokerConfigSchema } from '../../types/mqtt';

// ---------------------------------------------------------------------------
// E23 Batch 1 (FAT-176–FAT-182, N-7–N-13 High): perbaikan frontend terhadap
// spec live `~/workspace/oee-live-openapi.json` (141 operasi). Setiap stub
// mengembalikan BENTUK SPEC LIVE (bukan bentuk api_docs lama); setiap test
// meng-assert mapper/transport berperilaku benar terhadap bentuk itu.
//
// Port 3016–3023: 3001–3015 sudah dipakai stub lain (undici keep-alive
// rusak bila port dipakai ulang); VITE_API_URL di-set dan di-restore di
// try/finally.
// ---------------------------------------------------------------------------

const LOGIN_BODY = {
  success: true,
  token: 'stub-jwt',
  expires_in: 900,
  operator: { id: 'ADM-001', username: 'Alexandria Vance', role: 'ADMIN', line_id: 'ORG-ALL' },
};

type SeenReq = { method: string | undefined; path: string; body: unknown };

function startStub(
  port: number,
  handler: (req: http.IncomingMessage, url: URL, body: unknown) => { status: number; payload: unknown } | null,
) {
  const seen: SeenReq[] = [];
  const server = http.createServer((req, res) => {
    const url = new URL(req.url ?? '/', `http://localhost:${port}`);
    const chunks: Buffer[] = [];
    req.on('data', (c: Buffer) => chunks.push(c));
    req.on('end', () => {
      let body: unknown;
      try {
        body = chunks.length ? JSON.parse(Buffer.concat(chunks).toString('utf8')) : undefined;
      } catch {
        body = undefined;
      }
      seen.push({ method: req.method, path: url.pathname, body });
      const json = (status: number, payload: unknown) => {
        res.writeHead(status, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(payload));
      };
      if (req.method === 'POST' && url.pathname === '/api/v1/auth/admin/login') {
        json(200, LOGIN_BODY);
        return;
      }
      const out = handler(req, url, body);
      if (out) {
        json(out.status, out.payload);
        return;
      }
      json(404, { error: 'NOT_FOUND', message: `Rute stub tidak dikenal: ${url.pathname}` });
    });
  });
  return { server, seen };
}

async function withStub(
  port: number,
  handler: (req: http.IncomingMessage, url: URL, body: unknown) => { status: number; payload: unknown } | null,
  run: (seen: SeenReq[]) => Promise<void>,
) {
  const prevApiUrl = process.env.VITE_API_URL;
  process.env.VITE_API_URL = `http://localhost:${port}/api/v1`;
  const { server, seen } = startStub(port, handler);
  await new Promise<void>((resolve) => server.listen(port, resolve));
  try {
    httpApiClient.setNetworkMode('LAN');
    await httpApiClient.login('ADM-001', 'Admin@2026!');
    await run(seen);
  } finally {
    httpApiClient.setSessionActive(false, null);
    await new Promise<void>((resolve) => server.close(() => resolve()));
    if (prevApiUrl === undefined) delete process.env.VITE_API_URL;
    else process.env.VITE_API_URL = prevApiUrl;
  }
}

test('E23 N-7 (FAT-176): inspector effective-permissions — roles string[] + assignments[] (spec live)', async () => {
  await withStub(3016, (_req, url) => {
    if (url.pathname === '/api/v1/access-control/subjects/OP-115/effective-permissions') {
      return {
        status: 200,
        payload: {
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
        },
      };
    }
    return null;
  }, async () => {
    const eff = await httpApiClient.getSubjectEffectivePermissions('OP-115');
    assert.deepEqual(eff.roles, ['ADMIN', 'OPERATOR']);
    assert.equal(eff.assignments.length, 2);
    assert.equal(eff.assignments[1].role_name, 'OPERATOR');
    assert.equal(eff.assignments[1].scope_type, 'LINE');
    assert.equal(eff.assignments[1].scope_id, 'LINE-01');
    assert.equal(eff.permissions[0].sourceRole, 'ADMIN');
  });
});

test('E23 N-8 (FAT-177): refresh rekonsiliasi mengirim {startWindow, endWindow} (spec live)', async () => {
  await withStub(3017, (_req, url) => {
    if (url.pathname.includes('/telemetry/reconciliation/refresh')) {
      return {
        status: 200,
        payload: {
          success: true,
          refreshedStart: '2026-11-11T00:00:00+07:00',
          refreshedEnd: '2026-11-11T23:59:00+07:00',
          message: 'Refresh diminta.',
        },
      };
    }
    return null;
  }, async (seen) => {
    const res = await httpApiClient.triggerReconciliationRefresh({
      startWindow: '2026-11-11T00:00:00+07:00',
      endWindow: '2026-11-11T23:59:00+07:00',
    });
    assert.equal(res.success, true);
    assert.equal(res.refreshedStart, '2026-11-11T00:00:00+07:00');
    assert.equal(res.refreshedEnd, '2026-11-11T23:59:00+07:00');
    const call = seen.find((s) => s.path.includes('/reconciliation/refresh'));
    assert.deepEqual(call?.body, { startWindow: '2026-11-11T00:00:00+07:00', endWindow: '2026-11-11T23:59:00+07:00' });
    // Tanpa jendela: body wajib tetap dikirim (kosong), bukan tanpa body.
    await httpApiClient.triggerReconciliationRefresh({});
    const emptyCall = seen.filter((s) => s.path.includes('/reconciliation/refresh'))[1];
    assert.deepEqual(emptyCall?.body, {});
  });
});

test('E23 N-9 (FAT-178): 7 sub-op DynSec — respons {success} saja, entitas dibaca ulang via GET', async () => {
  await withStub(3018, (_req, url) => {
    const p = url.pathname;
    if (p === '/api/v1/mqtt/dynamic-security/clients/user1') {
      if (_req.method === 'GET') return { status: 200, payload: { username: 'user1', enabled: false, roles: ['edge_publisher'] } };
    }
    if (p === '/api/v1/mqtt/dynamic-security/roles/role1') {
      if (_req.method === 'GET') return { status: 200, payload: { rolename: 'role1', acls: [{ acltype: 'publishClientSend', topic: 'test/#', allow: true }] } };
    }
    if (p === '/api/v1/mqtt/dynamic-security/groups/g1') {
      if (_req.method === 'GET') return { status: 200, payload: { groupname: 'g1', clients: ['edge1'], roles: ['edge_publisher'] } };
    }
    if (_req.method === 'PATCH' && p === '/api/v1/mqtt/dynamic-security/clients/user1/enable') {
      return { status: 200, payload: { success: true } };
    }
    if (_req.method === 'POST' && p === '/api/v1/mqtt/dynamic-security/clients/user1/roles') {
      return { status: 201, payload: { success: true } };
    }
    if (_req.method === 'POST' && p === '/api/v1/mqtt/dynamic-security/roles') {
      return { status: 201, payload: { success: true } };
    }
    if (_req.method === 'POST' && p === '/api/v1/mqtt/dynamic-security/roles/role1/acls') {
      return { status: 201, payload: { success: true } };
    }
    if (_req.method === 'POST' && p === '/api/v1/mqtt/dynamic-security/groups') {
      return { status: 201, payload: { success: true } };
    }
    if (_req.method === 'POST' && p === '/api/v1/mqtt/dynamic-security/groups/g1/clients') {
      return { status: 201, payload: { success: true } };
    }
    if (_req.method === 'POST' && p === '/api/v1/mqtt/dynamic-security/groups/g1/roles') {
      return { status: 201, payload: { success: true } };
    }
    return null;
  }, async (seen) => {
    const toggled = await httpApiClient.toggleMqttClient('user1', false);
    assert.equal(toggled.username, 'user1');
    assert.equal(toggled.enabled, false);

    const withRole = await httpApiClient.addMqttClientRole('user1', 'edge_publisher', 1);
    assert.equal(withRole.username, 'user1');
    assert.deepEqual(withRole.roles, ['edge_publisher']);

    const role = await httpApiClient.createMqttRole({
      rolename: 'role1',
      acls: [{ acltype: 'publishClientSend', topic: 'test/#', allow: true }],
    });
    assert.equal(role.rolename, 'role1');
    assert.equal(role.acls.length, 1);

    const roleWithAcl = await httpApiClient.addMqttRoleAcl('role1', { acltype: 'publishClientSend', topic: 'test/#', allow: true });
    assert.equal(roleWithAcl.rolename, 'role1');

    const group = await httpApiClient.createMqttGroup({ groupname: 'g1', clients: [], roles: [] });
    assert.equal(group.groupname, 'g1');

    const groupWithClient = await httpApiClient.addMqttGroupClient('g1', 'edge1');
    assert.deepEqual(groupWithClient.clients, ['edge1']);

    const groupWithRole = await httpApiClient.addMqttGroupRole('g1', 'edge_publisher');
    assert.deepEqual(groupWithRole.roles, ['edge_publisher']);

    // Ketujuh mutasi diikuti GET refresh — bukan hasil `{success}` yang
    // dipetakan sebagai entitas (nama entitas '' pada bentuk lama).
    const gets = seen.filter((s) => s.method === 'GET' && s.path.includes('/dynamic-security/'));
    assert.equal(gets.length, 7);
    assert.ok(seen.some((s) => s.method === 'PATCH' && s.path.endsWith('/clients/user1/enable')));
  });
});

test('E23 N-10 (FAT-179): config status — bentuk spec live {runtime, lock, current, lastOperation, lastAppliedVersionId}', async () => {
  await withStub(3019, (_req, url) => {
    if (url.pathname === '/api/v1/mqtt/configuration/status') {
      return {
        status: 200,
        payload: {
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
          lock: { held: false, stale: false, ownerPid: null, startedAt: null, operationId: null },
          current: { checksum: 'abc123', sizeBytes: 2910, modifiedAt: '2026-11-19T08:00:00Z' },
          lastOperation: null,
          lastAppliedVersionId: 'cfg-v2.0.18-rel-4',
        },
      };
    }
    return null;
  }, async () => {
    const st = await httpApiClient.getBrokerConfigStatus();
    assert.equal(st.runtime.mode, 'helper');
    assert.equal(st.runtime.available, true);
    assert.equal(st.runtime.apply.available, true);
    assert.equal(st.runtime.restart.available, false);
    assert.equal(st.runtime.restart.reason, 'restart tidak didukung helper');
    assert.equal(st.lock.held, false);
    assert.equal(st.current?.checksum, 'abc123');
    assert.equal(st.lastOperation, null);
    assert.equal(st.lastAppliedVersionId, 'cfg-v2.0.18-rel-4');
  });
});

test('E23 N-11 (FAT-180): aggregate — count diturunkan dari delta (spec live, tanpa totalCount)', async () => {
  await withStub(3020, (_req, url) => {
    if (url.pathname === '/api/v1/telemetry/STM32-OEE-01/aggregate') {
      return {
        status: 200,
        payload: [
          { bucket: '2026-11-11T09:00:00.000Z', availabilityPct: 91.7, performancePct: 93.0, qualityPct: 90.0, oeePct: 76.7, outputDelta: 10, rejectDelta: 1, goodDelta: 9, runSec: 3300, operatingSec: 3600, sampleCount: 60, provisional: false },
          { bucket: '2026-11-11T10:00:00.000Z', availabilityPct: 94.4, performancePct: 95.0, qualityPct: 100.0, oeePct: 84.0, outputDelta: 12, rejectDelta: 0, goodDelta: 12, runSec: 3400, operatingSec: 3600, sampleCount: 60, provisional: false },
          { bucket: '2026-11-11T11:00:00.000Z', availabilityPct: 93.1, performancePct: 94.0, qualityPct: 90.9, oeePct: 88.0, outputDelta: 11, rejectDelta: 1, goodDelta: 10, runSec: 3350, operatingSec: 3600, sampleCount: 60, provisional: true },
        ],
      };
    }
    return null;
  }, async () => {
    const agg = await httpApiClient.getTelemetryAggregate('STM32-OEE-01', '1h');
    assert.equal(agg.rows.length, 3);
    assert.deepEqual(agg.rows.map((r) => r.totalCount), [10, 12, 11]);
    assert.deepEqual(agg.rows.map((r) => r.goodCount), [9, 12, 10]);
    assert.deepEqual(agg.rows.map((r) => r.rejectCount), [1, 0, 1]);
    // total_parts bukan lagi 0 (bentuk lama menurunkan ketiganya = 0).
    assert.equal(agg.total_parts, 33);
    assert.equal(agg.sample_count, 180);
  });
});

const STAGE_DRAFT: BrokerConfigSchema = {
  version: '1',
  general: {
    per_listener_settings: false,
    allow_anonymous: false,
    autosave_interval_seconds: 1800,
    persistence: true,
    persistence_location: '/mosquitto/data',
    log_dest: ['stdout'],
    log_type: ['all'],
    connection_messages: true,
  },
  limits: {
    max_connections: 1000,
    max_packet_size_bytes: 268435456,
    max_queued_messages: 1000,
    max_queued_bytes: null,
    max_inflight_messages: 20,
  },
  listeners: [{ id: 'listener-mqtt-1883', port: 1883, bind_address: '0.0.0.0', protocol: 'mqtt', enabled: true, tls_enabled: false, max_connections: 300 }],
  tls_profiles: [],
  bridges: [
    {
      id: 'bridge-mes-cloud',
      name: 'Corporate MES Cloud Sync',
      enabled: true,
      remote_address: 'broker.corporate-mes.internal',
      remote_port: 8883,
      remote_client_id: 'factory_plant01_bridge',
      remote_username: 'bridge-user',
      has_password: true,
      password: 'bridge-secret',
      protocol_version: 'mqttv5',
      topics: [{ pattern: 'factory/plant01/oee/summary', direction: 'out', qos: 1 }],
      status: 'CONNECTED',
      tls_enabled: true,
    },
    {
      id: 'bridge-plain',
      name: 'Plain Bridge',
      enabled: true,
      remote_address: '10.0.0.5',
      remote_port: 1883,
      remote_client_id: null,
      has_password: false,
      protocol_version: 'mqttv311',
      topics: [],
      status: null,
      tls_enabled: false,
    },
  ],
  unmanaged: [],
};

const STAGE_201 = {
  version_id: 'cfg-v2.0.18-rel-9',
  parent_version_id: 'cfg-v2.0.18-rel-4',
  status: 'STAGED',
  domainStatus: 'STAGED',
  applied_at: '2026-11-19T09:00:00Z',
  applied_by: 'ADM-001',
  summary: 'Uji stage',
  operation_type: 'RELOAD',
  authorId: 'ADM-001',
  authorName: 'Alexandria Vance',
  reason: null,
  comment: null,
  validationStatus: 'passed',
  impactAction: 'reload',
  createdAt: '2026-11-19T09:00:00Z',
  operationId: null,
  validation: {
    status: 'passed',
    checkedAt: '2026-11-19T09:00:00Z',
    issues: [],
    isolated: { status: 'passed', message: null, exitCode: 0 },
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
    lines: [
      { type: 'context', oldLine: 1, newLine: 1, text: 'listener 1883 0.0.0.0' },
      { type: 'add', oldLine: null, newLine: 2, text: 'max_connections 2000' },
    ],
  },
};

test('E23 N-12 (FAT-181): stage menyertakan password bridge + menyimpan validation/impact/diff dari 201', async () => {
  await withStub(3021, (_req, url) => {
    if (url.pathname === '/api/v1/mqtt/configuration/configurations' && _req.method === 'POST') {
      return { status: 201, payload: { ...STAGE_201, config: STAGE_DRAFT } };
    }
    return null;
  }, async (seen) => {
    const staged = await httpApiClient.stageBrokerConfig(STAGE_DRAFT, 'Uji stage');
    assert.equal(staged.version_id, 'cfg-v2.0.18-rel-9');
    assert.equal(staged.validation?.status, 'passed');
    assert.deepEqual(staged.validation?.issues, []);
    assert.equal(staged.impact?.action, 'reload');
    assert.equal(staged.impact?.changes.length, 1);
    assert.equal(staged.diff?.lines.length, 2);
    assert.equal(staged.diff?.lines[1].type, 'add');

    const call = seen.find((s) => s.method === 'POST' && s.path === '/api/v1/mqtt/configuration/configurations');
    const body = call?.body as { config: { bridges: Array<Record<string, unknown>> } };
    assert.equal(body.config.bridges.length, 2);
    // Password bridge dikirim (bentuk lama me-round-trip tanpa password).
    assert.equal(body.config.bridges[0].password, 'bridge-secret');
    assert.equal(body.config.bridges[0].remote_address, 'broker.corporate-mes.internal');
    // Bridge tanpa password tidak mengirim string kosong.
    assert.equal('password' in body.config.bridges[1], false);
  });
});

test('E23 N-12 (FAT-181, negatif): stage bridge tanpa remote_address ditolak sebelum request', async () => {
  await withStub(3022, (_req, url) => {
    if (url.pathname === '/api/v1/mqtt/configuration/configurations' && _req.method === 'POST') {
      return { status: 201, payload: { ...STAGE_201, config: STAGE_DRAFT } };
    }
    return null;
  }, async (seen) => {
    const draft: BrokerConfigSchema = JSON.parse(JSON.stringify(STAGE_DRAFT));
    draft.bridges[0].remote_address = '';
    await assert.rejects(
      () => httpApiClient.stageBrokerConfig(draft, 'Uji stage'),
      (err: any) => err.code === 'INVALID_REQUEST' && err.httpStatus === 400,
    );
    assert.equal(
      seen.filter((s) => s.method === 'POST' && s.path === '/api/v1/mqtt/configuration/configurations').length,
      0,
      'tidak ada request stage untuk bridge tanpa remote_address',
    );
  });
});

test('E23 N-13 (FAT-182): config diff — lines[] spec live dirender (bukan diff_summary/changed_keys)', async () => {
  await withStub(3023, (_req, url) => {
    if (url.pathname === '/api/v1/mqtt/configuration/configurations/cfg-v2.0.18-rel-9/diff') {
      return {
        status: 200,
        payload: {
          baseVersionId: 'cfg-v2.0.18-rel-4',
          versionId: 'cfg-v2.0.18-rel-9',
          baseChecksum: 'aaa',
          checksum: 'bbb',
          truncated: true,
          lines: [
            { type: 'context', oldLine: 1, newLine: 1, text: 'listener 1883 0.0.0.0' },
            { type: 'remove', oldLine: 2, newLine: null, text: 'max_connections 1000' },
            { type: 'add', oldLine: null, newLine: 2, text: 'max_connections 2000' },
          ],
        },
      };
    }
    return null;
  }, async () => {
    const diff = await httpApiClient.getBrokerConfigDiff('cfg-v2.0.18-rel-9');
    assert.equal(diff.version_id, 'cfg-v2.0.18-rel-9');
    assert.equal(diff.baseVersionId, 'cfg-v2.0.18-rel-4');
    assert.equal(diff.checksum, 'bbb');
    assert.equal(diff.truncated, true);
    assert.equal(diff.lines.length, 3);
    assert.deepEqual(diff.lines.map((l) => l.type), ['context', 'remove', 'add']);
    assert.equal(diff.lines[1].oldLine, 2);
    assert.equal(diff.lines[1].text, 'max_connections 1000');
    assert.equal(diff.lines[2].newLine, 2);
    assert.equal(diff.lines[2].text, 'max_connections 2000');
  });
});
