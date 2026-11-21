// E32.3 (FAT-284): dipecah dari e23-batch3.test.ts — operations config (N-31, FAT-200).
// Setiap stub mengembalikan BENTUK SPEC LIVE (bukan bentuk api_docs lama);
// setiap test meng-assert mapper/transport berperilaku benar terhadap bentuk
// itu. Port segar per tes (3049) — pelajaran FAT-280: reuse port
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
// N-31 (FAT-200): operations — type spec APPLY/ROLLBACK/DISCARD, field yang
// dulu dibuang, timestamp dari startedAt (bukan epoch 1970).
// ---------------------------------------------------------------------------

test('E23 N-31 (FAT-200): operasi memetakan type APPLY + phase/actor/waktu/error/result; timestamp bukan epoch', async () => {
  await withStub(3049, (_req, url) => {
    if (url.pathname === '/api/v1/mqtt/configuration/operations') {
      return {
        status: 200,
        payload: {
          data: [{
            operation_id: 'op-9', version_id: 'v9', type: 'APPLY', status: 'SUCCEEDED',
            domainStatus: 'SUCCEEDED', domainAction: 'APPLY', phase: 'done',
            actorId: 'ADM-001', actorName: 'Alexandria Vance', reason: 'apply v9',
            startedAt: '2026-11-19T07:00:00Z', finishedAt: '2026-11-19T07:00:02Z',
            steps: [{ name: 'VALIDATE', status: 'SUCCEEDED', startedAt: '2026-11-19T07:00:00Z', finishedAt: '2026-11-19T07:00:01Z' }],
            error: null,
            result: { previousVersionId: 'v8', appliedVersionId: 'v9', rollbackAttempted: false, rollbackSucceeded: false },
          }],
          meta: { limit: 50, hasMore: false, nextCursor: null, count: 1 },
        },
      };
    }
    if (url.pathname === '/api/v1/mqtt/configuration/operations/op-null') {
      return {
        status: 200,
        payload: {
          operation_id: 'op-null', version_id: 'v9', type: null, status: 'FAILED',
          domainStatus: 'FAILED', domainAction: 'RECOVERY', phase: 'recovery',
          actorId: 'ADM-001', actorName: 'Alexandria Vance', reason: 'recovery',
          startedAt: null, finishedAt: null, steps: [],
          error: { code: 'APPLY_FAILED', message: 'broker menolak reload' },
          result: { previousVersionId: 'v8', appliedVersionId: null, rollbackAttempted: true, rollbackSucceeded: true },
        },
      };
    }
    return null;
  }, async () => {
    const ops = await httpApiClient.getBrokerConfigOperations();
    assert.equal(ops[0]?.type, 'APPLY');
    assert.equal(ops[0]?.timestamp, '2026-11-19T07:00:00Z');
    assert.notEqual(ops[0]?.timestamp, '1970-01-01T00:00:00.000Z');
    assert.equal(ops[0]?.completed_at, '2026-11-19T07:00:02Z');
    assert.equal(ops[0]?.phase, 'done');
    assert.equal(ops[0]?.actorName, 'Alexandria Vance');
    assert.equal(ops[0]?.domainStatus, 'SUCCEEDED');
    assert.equal(ops[0]?.result?.appliedVersionId, 'v9');
    const failed = await httpApiClient.getBrokerConfigOperation('op-null');
    assert.equal(failed?.type, null);
    assert.equal(failed?.timestamp, '');
    assert.notEqual(failed?.timestamp, '1970-01-01T00:00:00.000Z');
    assert.equal(failed?.error?.code, 'APPLY_FAILED');
    assert.equal(failed?.result?.rollbackSucceeded, true);
  });
});
