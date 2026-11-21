// E32.3 (FAT-284): dipecah dari e23-batch3.test.ts — limit wajib (N-23, FAT-192).
// Setiap stub mengembalikan BENTUK SPEC LIVE (bukan bentuk api_docs lama);
// setiap test meng-assert mapper/transport berperilaku benar terhadap bentuk
// itu. Port segar per tes (3038–3040) — pelajaran FAT-280: reuse port
// menimbulkan galat NETWORK palsu. Kode sumber tidak diubah.
import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { httpApiClient } from './httpClient';
import { buildOperationalEventsExportEndpoint } from '../../utils/historicalExport';

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
// N-23 (FAT-192): limit wajib — rejects (default 50), OEE/telemetry hourly
// (default 72), ekspor op-events (default 10000).
// ---------------------------------------------------------------------------

test('E23 N-23 (FAT-192): rejects global + per-device selalu mengirim limit=50 (spec live)', async () => {
  await withStub(3038, (_req, url) => {
    if (url.pathname === '/api/v1/quality/rejects') {
      return { status: 200, payload: { data: [{ reason: 'UNCLASSIFIED', count: 5, pct: 100 }], meta: { limit: 50, hasMore: false, nextCursor: null, count: 1 } } };
    }
    if (url.pathname === '/api/v1/quality/rejects/STM32-OEE-01') {
      return { status: 200, payload: { data: [{ reason: 'UNCLASSIFIED', count: 3, pct: 100 }], meta: { limit: 50, hasMore: false, nextCursor: null, count: 1 } } };
    }
    return null;
  }, async (seen) => {
    const global = await httpApiClient.getRejectParetoGlobal();
    assert.equal(global[0]?.count, 5);
    const byDevice = await httpApiClient.getRejectPareto('STM32-OEE-01');
    assert.equal(byDevice[0]?.count, 3);
    for (const seenUrl of seen.filter((s) => s.path.startsWith('/api/v1/quality/rejects')).map((s) => new URL(s.url, 'http://localhost:3038'))) {
      assert.equal(seenUrl.searchParams.get('limit'), '50');
    }
  });
});

test('E23 N-23 (FAT-192): OEE hourly + telemetry hourly tanpa limit mengirim limit=72; eksplisit dihormati', async () => {
  const hourlyRow = {
    bucket: '2026-11-11T09:00:00+07:00', deviceId: 'STM32-OEE-01', machineId: 'CNC-MILLING-01', woId: 'WO-1',
    availabilityPct: '90', performancePct: '92', qualityPct: '98', oeePct: '81',
    totalCount: 10, rejectCount: 1, goodCount: 9, operatingSec: 3600, runSec: 3300,
    sampleCount: 60, targetPerHour: 50, state: 'RUNNING', planned: true, provisional: false,
  };
  await withStub(3039, (_req, url) => {
    if (url.pathname === '/api/v1/oee/hourly' || url.pathname === '/api/v1/telemetry/STM32-OEE-01/hourly') {
      return { status: 200, payload: { data: [hourlyRow], meta: { limit: 72, hasMore: false, nextCursor: null, count: 1 } } };
    }
    return null;
  }, async (seen) => {
    await httpApiClient.getOeeHourly({ machine_id: 'CNC-MILLING-01' });
    await httpApiClient.getHourlyTrend('STM32-OEE-01');
    for (const s of seen.filter((x) => x.path.includes('hourly'))) {
      assert.equal(new URL(s.url, 'http://localhost:3039').searchParams.get('limit'), '72');
    }
    await httpApiClient.getOeeHourly({ machine_id: 'CNC-MILLING-01', limit: 10 });
    const explicit = seen.filter((x) => x.path === '/api/v1/oee/hourly').at(-1);
    assert.equal(new URL(explicit!.url, 'http://localhost:3039').searchParams.get('limit'), '10');
  });
});

test('E23 N-23/N-34 (FAT-192/FAT-201): ekspor op-events mengirim limit=10000 + event_type, tanpa machine_id', async () => {
  await withStub(3040, (_req, url) => {
    if (url.pathname.endsWith('/export')) {
      return { status: 200, payload: null, raw: JSON.stringify(CSV), contentType: 'application/json' };
    }
    return null;
  }, async (seen) => {
    const res = await httpApiClient.exportOperationalEventsData({
      device_id: 'ALL', from: FROM, to: TO, format: 'csv', event_type: 'DEVICE_OFFLINE',
    });
    assert.equal(res.content, CSV);
    const globalUrl = new URL(seen.find((s) => s.path === '/api/v1/operational-events/export')!.url, 'http://localhost:3040');
    assert.equal(globalUrl.searchParams.get('limit'), '10000');
    assert.equal(globalUrl.searchParams.get('event_type'), 'DEVICE_OFFLINE');
    assert.equal(globalUrl.searchParams.has('machine_id'), false);
    await httpApiClient.exportOperationalEventsData({
      device_id: 'STM32-OEE-01', from: FROM, to: TO, format: 'csv', event_type: 'DEVICE_ONLINE',
    });
    const devUrl = new URL(seen.find((s) => s.path === '/api/v1/operational-events/STM32-OEE-01/export')!.url, 'http://localhost:3040');
    assert.equal(devUrl.searchParams.get('event_type'), 'DEVICE_ONLINE');
    assert.equal(devUrl.searchParams.get('limit'), '10000');
  });
  // Builder murni: event_type ikut, machine_id tidak pernah.
  const built = buildOperationalEventsExportEndpoint({ device_id: 'ALL', from: FROM, to: TO, format: 'csv', event_type: 'DEVICE_OFFLINE' });
  assert.match(built, /event_type=DEVICE_OFFLINE/);
  assert.doesNotMatch(built, /machine_id/);
  assert.match(built, /limit=10000/);
});
