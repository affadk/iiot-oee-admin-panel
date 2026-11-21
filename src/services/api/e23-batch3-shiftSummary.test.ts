// E32.3 (FAT-284): dipecah dari e23-batch3.test.ts — shift-summary (N-27, FAT-196).
// Setiap stub mengembalikan BENTUK SPEC LIVE (bukan bentuk api_docs lama);
// setiap test meng-assert mapper/transport berperilaku benar terhadap bentuk
// itu. Port segar per tes (3044) — pelajaran FAT-280: reuse port
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
// N-27 (FAT-196): shift-summary — parts dari Σ hourly, null tanpa hourly;
// nama shift/mesin null (bukan 'Shift'/'').
// ---------------------------------------------------------------------------

const SPEC_SHIFT_SUMMARY = {
  oee: 81.4, availability: 90, performance: 92.5, quality: 97.7,
  time_sec: { operating: 25200, run: 23280, downtime: 1920 },
  window: { from: '2026-11-11T07:00:00+07:00', to: '2026-11-11T15:00:00+07:00', tz: 'Asia/Jakarta' },
  target_per_hour: 50,
  hourly: [
    {
      bucket: '2026-11-11T09:00:00+07:00', deviceId: 'STM32-OEE-01', machineId: 'CNC-MILLING-01', woId: 'WO-1',
      availabilityPct: '90', performancePct: '92', qualityPct: '98', oeePct: '81',
      totalCount: 100, rejectCount: 2, goodCount: 98, operatingSec: 3600, runSec: 3300,
      sampleCount: 60, targetPerHour: 50, state: 'RUNNING', planned: true, provisional: false,
    },
    {
      bucket: '2026-11-11T10:00:00+07:00', deviceId: 'STM32-OEE-01', machineId: 'CNC-MILLING-01', woId: 'WO-1',
      availabilityPct: '91', performancePct: '93', qualityPct: '97', oeePct: '82',
      totalCount: 50, rejectCount: 1, goodCount: 49, operatingSec: 3600, runSec: 3400,
      sampleCount: 60, targetPerHour: 50, state: 'RUNNING', planned: true, provisional: false,
    },
  ],
};

test('E23 N-27 (FAT-196): shift-summary spec — parts = Σ hourly, nama null; tanpa hourly parts null', async () => {
  await withStub(3044, (_req, url) => {
    if (url.pathname === '/api/v1/oee/shift-summary') {
      const withHourly = url.searchParams.get('include_hourly') === 'true';
      const { hourly, ...rest } = SPEC_SHIFT_SUMMARY;
      return { status: 200, payload: withHourly ? SPEC_SHIFT_SUMMARY : rest };
    }
    return null;
  }, async () => {
    const withHourly = await httpApiClient.getShiftSummary('CNC-MILLING-01', undefined, { include_hourly: true });
    assert.equal(withHourly.total_parts, 150);
    assert.equal(withHourly.good_parts, 147);
    assert.equal(withHourly.defect_parts, 3);
    assert.equal(withHourly.shift_name, null);
    assert.equal(withHourly.machine_name, null);
    const withoutHourly = await httpApiClient.getShiftSummary('CNC-MILLING-01');
    assert.equal(withoutHourly.total_parts, null);
    assert.equal(withoutHourly.good_parts, null);
    assert.equal(withoutHourly.defect_parts, null);
    assert.equal(withoutHourly.shift_name, null);
  });
});
