// E32.3 (FAT-284): dipecah dari e23-batch3.test.ts — rollup group_by 'line' (N-26, FAT-195).
// Setiap stub mengembalikan BENTUK SPEC LIVE (bukan bentuk api_docs lama);
// setiap test meng-assert mapper/transport berperilaku benar terhadap bentuk
// itu. Port segar per tes (3043) — pelajaran FAT-280: reuse port
// menimbulkan galat NETWORK palsu. Kode sumber tidak diubah.
import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { httpApiClient } from './httpClient';
import { buildTelemetryRollupEndpoint } from '../../utils/historicalExport';

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

const FROM = '2026-11-10T00:00:00.000Z';
const TO = '2026-11-17T00:00:00.000Z';
const CSV = 'a,b\n1,2\n3,4\n';

// ---------------------------------------------------------------------------
// N-26 (FAT-195): rollup group_by 'line' + tanpa envelope=true.
// ---------------------------------------------------------------------------

test('E23 N-26 (FAT-195): baris rollup groupBy line tidak melempar; lineId dipetakan; URL tanpa envelope', async () => {
  await withStub(3043, (_req, url) => {
    if (url.pathname === '/api/v1/telemetry/rollup') {
      return {
        status: 200,
        payload: {
          data: [{
            groupBy: 'line', bucket: null, machineId: 'CNC-MILLING-01', lineId: 'LINE-01',
            totalCount: 100, goodCount: 95, rejectCount: 5, operatingSec: 3600, runSec: 3300,
            availabilityPct: 90, performancePct: 92, qualityPct: 95, oeePct: 78.7,
            sampleCount: 60, provisional: false,
          }],
          meta: { limit: 500, hasMore: false, nextCursor: null, count: 1 },
        },
      };
    }
    return null;
  }, async (seen) => {
    const page = await httpApiClient.getTelemetryRollup({ group_by: 'line', from: FROM, to: TO });
    assert.equal(page.data[0]?.groupBy, 'line');
    assert.equal(page.data[0]?.lineId, 'LINE-01');
    assert.equal(page.data[0]?.groupKey, 'LINE-01');
    const rollupUrl = new URL(seen.find((s) => s.path === '/api/v1/telemetry/rollup')!.url, 'http://localhost:3043');
    assert.equal(rollupUrl.searchParams.get('group_by'), 'line');
    assert.equal(rollupUrl.searchParams.has('envelope'), false);
  });
  const built = buildTelemetryRollupEndpoint({ group_by: 'line', from: FROM, to: TO });
  assert.match(built, /group_by=line/);
  assert.doesNotMatch(built, /envelope/);
});
