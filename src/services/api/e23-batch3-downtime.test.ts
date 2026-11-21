// E32.3 (FAT-284): dipecah dari e23-batch3.test.ts — downtime tanpa category (N-25, FAT-194).
// Setiap stub mengembalikan BENTUK SPEC LIVE (bukan bentuk api_docs lama);
// setiap test meng-assert mapper/transport berperilaku benar terhadap bentuk
// itu. Port segar per tes (3042) — pelajaran FAT-280: reuse port
// menimbulkan galat NETWORK palsu. Kode sumber tidak diubah.
import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { httpApiClient } from './httpClient';
import { buildDowntimeHistoryEndpoint } from '../../utils/historicalExport';

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
// N-25 (FAT-194): downtime tanpa category — mapper 'UNKNOWN', query tanpa
// param category (filter sisi klien), operator objek {id, username}.
// ---------------------------------------------------------------------------

const SPEC_DOWNTIME_ITEM = {
  id: 42,
  deviceId: 'STM32-OEE-01',
  machineId: 'CNC-MILLING-01',
  machineName: 'CNC Milling 01',
  woId: 'WO-1',
  startTime: '2026-11-11T09:00:00+07:00',
  endTime: '2026-11-11T09:30:00+07:00',
  durationSec: 1800,
  durationFormatted: '30m',
  triggerSource: 'FSM',
  operatorReason: 'Bearing aus',
  isLabeled: true,
  isActive: false,
  createdAt: '2026-11-11T09:00:00+07:00',
};

test('E23 N-25 (FAT-194): item downtime spec (tanpa category) → category UNKNOWN; URL tanpa category; operator objek', async () => {
  await withStub(3042, (req, url, body) => {
    if (req.method === 'GET' && url.pathname === '/api/v1/downtime-events/STM32-OEE-01') {
      return { status: 200, payload: { data: [SPEC_DOWNTIME_ITEM], meta: { limit: 50, hasMore: false, nextCursor: null, count: 1 } } };
    }
    if (req.method === 'POST' && url.pathname === '/api/v1/downtime-events/42/reason') {
      assert.deepEqual(body, { category: 'EQUIPMENT_FAILURE', reason: 'Bearing aus' });
      return {
        status: 200,
        payload: {
          success: true, eventId: 42, deviceId: 'STM32-OEE-01',
          operatorReason: 'Bearing aus', isOverwrite: false,
          operator: { id: 'ADM-001', username: 'Alexandria Vance' },
        },
      };
    }
    return null;
  }, async (seen) => {
    const page = await httpApiClient.getDowntimeHistoryPage({ device_id: 'STM32-OEE-01', limit: 50 });
    assert.equal(page.data[0]?.category, 'UNKNOWN');
    assert.equal(page.data[0]?.reason, 'Bearing aus');
    assert.equal(page.data[0]?.is_labeled, true);
    const histUrl = new URL(seen.find((s) => s.path.startsWith('/api/v1/downtime-events/STM32-OEE-01'))!.url, 'http://localhost:3042');
    assert.equal(histUrl.searchParams.has('category'), false);
    // Filter kategori diterapkan sisi klien pada halaman yang diambil.
    const filteredOut = await httpApiClient.getDowntimeHistoryPage({ device_id: 'STM32-OEE-01', category: 'OTHER', limit: 50 });
    assert.equal(filteredOut.data.length, 0);
    const kept = await httpApiClient.getDowntimeHistoryPage({ device_id: 'STM32-OEE-01', category: 'UNKNOWN', limit: 50 });
    assert.equal(kept.data.length, 1);
    const res = await httpApiClient.classifyDowntimeReason('42', 'EQUIPMENT_FAILURE', 'Bearing aus');
    assert.deepEqual(res.operator, { id: 'ADM-001', username: 'Alexandria Vance' });
  });
  const built = buildDowntimeHistoryEndpoint({ device_id: 'STM32-OEE-01', category: 'OTHER', limit: 50 });
  assert.doesNotMatch(built, /category/);
});
