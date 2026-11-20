import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { httpApiClient } from './httpClient';

// ---------------------------------------------------------------------------
// E20 P20.5 (FAT-157): stub HTTP port 3008–3015 — status-history + INVALID_RANGE,
// refresh body {from,to}, apply/rollback 202 + polling, access-mode,
// operators create isActive, config GET nulls, timeline default 5m,
// OEE read tanpa auth. Port 3008–3015: 3001–3007 sudah dipakai stub lain —
// undici keep-alive rusak bila port dipakai ulang; VITE_API_URL di-set dan
// di-restore di try/finally.
// ---------------------------------------------------------------------------

// Port 3008–3014: satu port per server stub dalam file ini (3001–3007
// sudah dipakai stub lain) — undici keep-alive rusak bila dua server
// berurutan memakai port yang sama.
const LOGIN_BODY = {
  success: true,
  token: 'stub-jwt-p20-5',
  expires_in: 900,
  operator: { id: 'ADM-001', username: 'Alexandria Vance', role: 'ADMIN', line_id: 'ORG-ALL' },
};

type SeenReq = { method: string | undefined; path: string; search: string; body: unknown; auth: string | undefined };

function startStub(port: number, handler: (req: http.IncomingMessage, url: URL, body: unknown) => { status: number; payload: unknown } | null) {
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
      seen.push({ method: req.method, path: url.pathname, search: url.search, body, auth: req.headers.authorization });
      const json = (status: number, payload: unknown) => {
        res.writeHead(status, { 'Content-Type': 'application/json', Connection: 'close' });
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
    await run(seen);
  } finally {
    httpApiClient.setSessionActive(false, null);
    await new Promise<void>((resolve) => { server.closeAllConnections(); server.close(() => resolve()); });
    if (prevApiUrl === undefined) delete process.env.VITE_API_URL;
    else process.env.VITE_API_URL = prevApiUrl;
  }
}

test('P20.5: OEE read tanpa auth — getOeeHourly berhasil tanpa login & tanpa header Authorization', async () => {
  httpApiClient.setSessionActive(false, null);
  await withStub(3008, (_req, url) => {
    if (url.pathname === '/api/v1/oee/hourly') {
      return {
        status: 200,
        payload: [
          {
            bucket: '2026-11-11T09:00:00+07:00',
            oeePct: null,
            availabilityPct: 92.4,
            performancePct: null,
            qualityPct: 98.2,
            totalCount: 0,
            rejectCount: 0,
            goodCount: 0,
            operatingSec: 3600,
            runSec: 3326,
            sampleCount: 60,
            targetPerHour: null,
            state: 'RUNNING',
            planned: false,
            provisional: false,
          },
        ],
      };
    }
    return null;
  }, async (seen) => {
    const pts = await httpApiClient.getOeeHourly({ machine_id: 'CNC-MILLING-01' });
    assert.equal(pts.length, 1);
    // *Pct null dipertahankan (D-8), bukan 0.
    assert.equal(pts[0].oee, null);
    assert.equal(pts[0].performance, null);
    assert.equal(pts[0].availability, 92.4);
    const call = seen.find((s) => s.path === '/api/v1/oee/hourly');
    assert.ok(call, 'GET /oee/hourly tercatat');
    assert.equal(call.auth, undefined);
  });
});

test('P20.5: status-history mengirim filter state; from>=to → 400 INVALID_RANGE tanpa request', async () => {
  await withStub(3009, (_req, url) => {
    if (url.pathname === '/api/v1/machines/CNC-MILLING-01/status-history') {
      return {
        status: 200,
        payload: {
          data: [
            {
              id: 'hist-1',
              machineId: 'CNC-MILLING-01',
              state: 'OFFLINE',
              startedAt: '2026-11-11T10:00:00+07:00',
              endedAt: null,
              durationSec: 600,
              triggerSource: 'SYSTEM',
              isActive: false,
            },
          ],
          next_cursor: null,
        },
      };
    }
    return null;
  }, async (seen) => {
    await httpApiClient.login('ADM-001', 'Admin@2026!');
    const page = await httpApiClient.getMachineStatusHistory('CNC-MILLING-01', {
      from: '2026-11-11T00:00:00+07:00',
      to: '2026-11-11T23:59:00+07:00',
      state: 'OFFLINE',
    });
    assert.equal(page.data.length, 1);
    // OFFLINE nilai item sah (D-4) — bukan UNCONFIGURED.
    assert.equal(page.data[0].state, 'OFFLINE');
    const call = seen.find((s) => s.path.includes('/status-history'));
    assert.ok(call?.search.includes('state=OFFLINE'), call?.search);

    // Rentang tak valid ditolak klien sebelum request (400 INVALID_RANGE).
    const before = seen.length;
    await assert.rejects(
      () =>
        httpApiClient.getMachineStatusHistory('CNC-MILLING-01', {
          from: '2026-11-11T12:00:00+07:00',
          to: '2026-11-11T09:00:00+07:00',
        }),
      (err: any) => err.code === 'INVALID_RANGE' && err.httpStatus === 400,
    );
    assert.equal(seen.length, before, 'tidak ada request untuk rentang tak valid');
  });
});

test('P20.5: refresh rekonsiliasi mengirim body {startWindow, endWindow} — bukan {from, to}', async () => {
  await withStub(3010, (_req, url) => {
    if (url.pathname.includes('/reconciliation/refresh')) {
      return { status: 200, payload: { success: true, message: 'Refresh diminta.' } };
    }
    return null;
  }, async (seen) => {
    httpApiClient.setNetworkMode('LAN');
    await httpApiClient.login('ADM-001', 'Admin@2026!');
    const res = await httpApiClient.triggerReconciliationRefresh({
      startWindow: '2026-11-11T00:00:00+07:00',
      endWindow: '2026-11-11T23:59:00+07:00',
    });
    assert.equal(res.success, true);
    const call = seen.find((s) => s.path.includes('/reconciliation/refresh'));
    // E23 Batch 1 (FAT-177, N-8): spec live membalikkan keputusan E20
    // (R-11/T9/X29, `{from, to}`) — body kanonis `{startWindow, endWindow}`.
    assert.deepEqual(call?.body, { startWindow: '2026-11-11T00:00:00+07:00', endWindow: '2026-11-11T23:59:00+07:00' });
  });
});

test('P20.5: apply/rollback config 202 {operationId, versionId} + polling sampai SUCCEEDED', async () => {
  let opPolls = 0;
  const versionPayload = {
    version_id: 'cfg-v2.0.18-rel-5',
    parent_version_id: 'cfg-v2.0.18-rel-4',
    applied_at: '2026-11-19T09:00:00Z',
    applied_by: 'Alexandria Vance',
    summary: 'Apply test',
    operation_type: 'RELOAD',
    status: 'ACTIVE',
    config: {},
  };
  await withStub(3011, (_req, url) => {
    if (url.pathname.endsWith('/apply') || url.pathname.endsWith('/rollback')) {
      return { status: 202, payload: { operationId: 'op-p20-5', versionId: 'cfg-v2.0.18-rel-5' } };
    }
    if (url.pathname === '/api/v1/mqtt/configuration/operations/op-p20-5') {
      opPolls += 1;
      return {
        status: 200,
        payload: {
          operation_id: 'op-p20-5',
          operation_type: 'RELOAD',
          version_id: 'cfg-v2.0.18-rel-5',
          status: opPolls < 2 ? 'RUNNING' : 'SUCCEEDED',
          steps: [],
          timestamp: '2026-11-19T09:00:00Z',
          completed_at: opPolls < 2 ? null : '2026-11-19T09:00:01Z',
        },
      };
    }
    if (url.pathname === '/api/v1/mqtt/configuration/configurations/cfg-v2.0.18-rel-5') {
      return { status: 200, payload: versionPayload };
    }
    return null;
  }, async (seen) => {
    httpApiClient.setNetworkMode('LAN');
    await httpApiClient.login('ADM-001', 'Admin@2026!');
    const applied = await httpApiClient.applyBrokerConfigVersion('cfg-v2.0.18-rel-5', { confirm: true });
    assert.equal(applied.operation.status, 'SUCCEEDED');
    assert.equal(applied.operation.type, 'RELOAD');
    assert.equal(applied.version.version_id, 'cfg-v2.0.18-rel-5');
    assert.equal(applied.version.status, 'ACTIVE');
    assert.ok(opPolls >= 2, `polling operasi terjadi (${opPolls}x)`);
    const applyCall = seen.find((s) => s.path.endsWith('/apply'));
    assert.deepEqual(applyCall?.body, { confirm: true });

    opPolls = 0;
    const rolled = await httpApiClient.rollbackBrokerConfig('cfg-v2.0.18-rel-4', { confirm: true });
    assert.equal(rolled.operation.status, 'SUCCEEDED');
    assert.ok(opPolls >= 2, `polling rollback terjadi (${opPolls}x)`);
  });
});

test('P20.5: GET /system/access-mode memakai JWT; 404 → error (fallback di NetworkAccessContext)', async () => {
  await withStub(3012, (_req, url) => {
    if (url.pathname === '/api/v1/system/access-mode') {
      return { status: 200, payload: { mode: 'private', channel: 'tunnel', mutations_allowed: false } };
    }
    return null;
  }, async (seen) => {
    await httpApiClient.login('ADM-001', 'Admin@2026!');
    const res = await httpApiClient.getSystemAccessMode();
    assert.deepEqual(res, { mode: 'private', channel: 'tunnel', mutations_allowed: false });
    const call = seen.find((s) => s.path === '/api/v1/system/access-mode');
    assert.ok(call?.auth?.startsWith('Bearer '), 'JWT dikirim');
  });

  // Backend lama tanpa endpoint → 404; pemanggil (NetworkAccessContext)
  // menangkapnya dan fallback ke derivasi env+kanal.
  await withStub(3013, (_req, url) => {
    if (url.pathname === '/api/v1/system/access-mode') {
      return { status: 404, payload: { error: 'NOT_FOUND', message: 'unknown route' } };
    }
    return null;
  }, async () => {
    await httpApiClient.login('ADM-001', 'Admin@2026!');
    await assert.rejects(
      () => httpApiClient.getSystemAccessMode(),
      (err: any) => err.httpStatus === 404,
    );
  });
});

test('P20.5: operators create mengirim isActive; config GET null dipertahankan + unmanaged + tls_profiles []', async () => {
  await withStub(3014, (_req, url) => {
    if (url.pathname === '/api/v1/operators' && _req.method === 'POST') {
      return {
        status: 201,
        payload: {
          operator_id: 'OP-NEW',
          name: 'Operator Baru',
          role: 'OPERATOR',
          line_id: null,
          is_active: false,
          created_at: '2026-11-19T09:00:00Z',
        },
      };
    }
    if (url.pathname === '/api/v1/mqtt/configuration') {
      return {
        status: 200,
        payload: {
          version: '2.0.18-rel-5',
          general: {
            per_listener_settings: true,
            allow_anonymous: false,
            autosave_interval_seconds: null,
            persistence: true,
            persistence_location: '/var/lib/mosquitto/',
            log_dest: [],
            log_type: [],
            connection_messages: true,
          },
          limits: {
            max_connections: null,
            max_packet_size_bytes: null,
            // E23 Batch 3 (FAT-198, N-29): null tetap null (default
            // fabrikasi 1000/20 dihapus).
            max_queued_messages: null,
            max_queued_bytes: null,
            max_inflight_messages: null,
          },
          listeners: [],
          tls_profiles: [{ id: 'tls-x', name: 'legacy' }],
          bridges: [{ id: 'b1', remote_client_id: null, status: null }],
          // E23 Batch 3 (FAT-198, N-29): `unmanaged[]` spec berupa objek
          // {key, section, line, reason} (bukan string).
          unmanaged: [{ key: 'custom_key', section: 'general', line: 42, reason: 'custom key' }],
        },
      };
    }
    return null;
  }, async (seen) => {
    httpApiClient.setNetworkMode('LAN');
    await httpApiClient.login('ADM-001', 'Admin@2026!');
    const op = await httpApiClient.createOperator({
      operator_id: 'OP-NEW',
      name: 'Operator Baru',
      role: 'OPERATOR',
      password: 'Secret123!',
      is_active: false,
    });
    assert.equal(op.is_active, false);
    const createCall = seen.find((s) => s.path === '/api/v1/operators' && s.method === 'POST');
    assert.equal((createCall?.body as Record<string, unknown>)?.isActive, false);

    const cfg = await httpApiClient.getBrokerConfig();
    assert.equal(cfg.general.autosave_interval_seconds, null);
    assert.equal(cfg.limits.max_connections, null);
    assert.equal(cfg.limits.max_packet_size_bytes, null);
    assert.equal(cfg.limits.max_queued_bytes, null);
    assert.equal(cfg.limits.max_queued_messages, null);
    assert.equal(cfg.limits.max_inflight_messages, null);
    assert.deepEqual(cfg.unmanaged, [{ key: 'custom_key', section: 'general', line: 42, reason: 'custom key' }]);
    // tls_profiles selalu [] (§3.3b) — entri legacy dari server diabaikan.
    assert.deepEqual(cfg.tls_profiles, []);
  });
});

test('P20.5: timeline bucket default 5m (§Q.3, §7I)', async () => {
  await withStub(3015, (_req, url) => {
    if (url.pathname === '/api/v1/oee/shift-timeline') {
      return { status: 200, payload: [] };
    }
    return null;
  }, async (seen) => {
    // Read tanpa auth — tanpa login.
    httpApiClient.setSessionActive(false, null);
    const segs = await httpApiClient.getShiftTimeline('CNC-MILLING-01');
    assert.deepEqual(segs, []);
    const call = seen.find((s) => s.path === '/api/v1/oee/shift-timeline');
    assert.ok(call?.search.includes('bucket=5m'), call?.search);
    assert.equal(call?.auth, undefined);
  });
});
