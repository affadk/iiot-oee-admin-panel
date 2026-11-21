// E32.3 (FAT-284): dipecah dari e23-batch3.test.ts — overview MQTT (N-28, FAT-197).
// Setiap stub mengembalikan BENTUK SPEC LIVE (bukan bentuk api_docs lama);
// setiap test meng-assert mapper/transport berperilaku benar terhadap bentuk
// itu. Port segar per tes (3045–3046) — pelajaran FAT-280: reuse port
// menimbulkan galat NETWORK palsu. Kode sumber tidak diubah.
import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { httpApiClient } from './httpClient';

const LOGIN_BODY = {
  success: true,
  token: 'stub-token',
  expires_in: 900,
  operator: { id: 'ADM-001', username: 'Alexandria Vance', role: 'ADMIN', line_id: 'ORG-ALL' },
};

type SeenReq = { method: string | undefined; path: string; url: string; body: unknown };

function startStub(
  port: number,
  handler: (req: http.IncomingMessage, url: URL, body: unknown) => { status: number; payload: unknown; raw?: string; contentType?: string } | null,
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
      seen.push({ method: req.method, path: url.pathname, url: url.pathname + url.search, body });
      if (req.method === 'POST' && url.pathname === '/api/v1/auth/admin/login') {
        res.writeHead(200, { 'Content-Type': 'application/json', Connection: 'close' });
        res.end(JSON.stringify(LOGIN_BODY));
        return;
      }
      const out = handler(req, url, body);
      if (out) {
        if (out.raw !== undefined) {
          res.writeHead(out.status, { 'Content-Type': out.contentType ?? 'text/csv', Connection: 'close' });
          res.end(out.raw);
          return;
        }
        res.writeHead(out.status, { 'Content-Type': 'application/json', Connection: 'close' });
        res.end(JSON.stringify(out.payload));
        return;
      }
      res.writeHead(404, { 'Content-Type': 'application/json', Connection: 'close' });
      res.end(JSON.stringify({ error: 'NOT_FOUND', message: `Rute stub tidak dikenal: ${url.pathname}` }));
    });
  });
  return { server, seen };
}

async function withStub(
  port: number,
  handler: (req: http.IncomingMessage, url: URL, body: unknown) => { status: number; payload: unknown; raw?: string; contentType?: string } | null,
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
    await new Promise<void>((resolve) => { server.closeAllConnections(); server.close(() => resolve()); });
    if (prevApiUrl === undefined) delete process.env.VITE_API_URL;
    else process.env.VITE_API_URL = prevApiUrl;
  }
}

// ---------------------------------------------------------------------------
// N-28 (FAT-197): overview — status enum, lastOperation objek, reason.
// ---------------------------------------------------------------------------

const SPEC_LAST_OPERATION = {
  operation_id: 'op-9', version_id: 'v9', type: 'APPLY', status: 'SUCCEEDED',
  domainStatus: 'SUCCEEDED', domainAction: 'APPLY', phase: 'done',
  actorId: 'ADM-001', actorName: 'Alexandria Vance', reason: 'apply v9',
  startedAt: '2026-11-19T07:00:00Z', finishedAt: '2026-11-19T07:00:02Z',
  steps: [], error: null,
  result: { previousVersionId: 'v8', appliedVersionId: 'v9', rollbackAttempted: false, rollbackSucceeded: false },
};

test('E23 N-28 (FAT-197): overview memetakan status CONNECTING + lastOperation objek', async () => {
  await withStub(3045, (_req, url) => {
    if (url.pathname === '/api/v1/mqtt/overview') {
      return {
        status: 200,
        payload: {
          dynamicSecurity: {
            available: true, enabled: true, status: 'CONNECTING',
            clientsCount: 3, rolesCount: 2, groupsCount: 1,
            lastError: null, measuredAt: '2026-11-19T08:00:00Z',
          },
          configuration: {
            status: 'IN_SYNC', activeVersionId: 'v9', lastAppliedAt: '2026-11-19T07:00:00Z',
            mutationLocked: false, lastOperation: SPEC_LAST_OPERATION, measuredAt: '2026-11-19T08:00:00Z',
          },
        },
      };
    }
    return null;
  }, async () => {
    const ov = await httpApiClient.getBrokerOverview();
    assert.equal(ov.dynamicSecurity.status, 'CONNECTING');
    assert.equal(ov.configuration.lastOperation?.operation_id, 'op-9');
    assert.equal(ov.configuration.lastOperation?.type, 'APPLY');
    assert.equal(ov.configuration.lastOperation?.actorName, 'Alexandria Vance');
    assert.equal(ov.configuration.lastOperation?.status, 'SUCCEEDED');
  });
});

test('E23 N-28 (FAT-197): overview varian available=false membawa reason; count null dipertahankan', async () => {
  await withStub(3046, (_req, url) => {
    if (url.pathname === '/api/v1/mqtt/overview') {
      return {
        status: 200,
        payload: {
          dynamicSecurity: {
            available: false, reason: 'plugin tidak aktif',
            clientsCount: null, rolesCount: null, groupsCount: null,
            lastError: null, measuredAt: '2026-11-19T08:00:00Z',
          },
          configuration: {
            status: 'UNAVAILABLE', activeVersionId: null, lastAppliedAt: null,
            mutationLocked: false, lastOperation: null, measuredAt: '2026-11-19T08:00:00Z',
          },
        },
      };
    }
    return null;
  }, async () => {
    const ov = await httpApiClient.getBrokerOverview();
    assert.equal(ov.dynamicSecurity.available, false);
    assert.equal(ov.dynamicSecurity.reason, 'plugin tidak aktif');
    assert.equal(ov.dynamicSecurity.status, 'DISCONNECTED');
    assert.equal(ov.dynamicSecurity.clientsCount, null);
    assert.equal(ov.configuration.lastOperation, null);
  });
});
