import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { httpApiClient } from './httpClient';

// ---------------------------------------------------------------------------
// FAT-213 (N-43): ringkasan agregat all-null tampil '—', bukan 0%.
// Transport HTTP: `mean1` mengembalikan null bila SEMUA bucket null
// (kapasitas unknown, E20 P20.5); bila ada nilai non-null, rata-rata hanya
// dari yang non-null (perilaku lama dipertahankan).
//
// Port 3061–3062: 3001–3060 sudah dipakai stub lain (undici keep-alive
// rusak bila port dipakai ulang); VITE_API_URL di-set dan di-restore di
// try/finally.
// ---------------------------------------------------------------------------

const LOGIN_BODY = {
  success: true,
  token: 'stub-jwt',
  expires_in: 900,
  operator: { id: 'ADM-001', username: 'Alexandria Vance', role: 'ADMIN', line_id: 'ORG-ALL' },
};

type SeenReq = { method: string | undefined; path: string; url: string; body: unknown };

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
      seen.push({ method: req.method, path: url.pathname, url: url.pathname + url.search, body });
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

const nullBucket = (bucket: string) => ({
  bucket,
  availabilityPct: null,
  performancePct: null,
  qualityPct: null,
  oeePct: null,
  outputDelta: 10,
  rejectDelta: 0,
  goodDelta: 10,
  runSec: 3000,
  operatingSec: 3000,
  sampleCount: 60,
  provisional: false,
});

test('FAT-213 (N-43): aggregate — semua bucket null → keempat rata-rata null (bukan 0)', async () => {
  await withStub(3061, (_req, url) => {
    if (url.pathname === '/api/v1/telemetry/STM32-OEE-01/aggregate') {
      return {
        status: 200,
        payload: [
          nullBucket('2026-11-20T09:00:00.000Z'),
          nullBucket('2026-11-20T09:05:00.000Z'),
          nullBucket('2026-11-20T09:10:00.000Z'),
        ],
      };
    }
    return null;
  }, async () => {
    const agg = await httpApiClient.getTelemetryAggregate('STM32-OEE-01', '5m');
    assert.equal(agg.rows.length, 3);
    assert.equal(agg.avg_oee, null);
    assert.equal(agg.avg_availability, null);
    assert.equal(agg.avg_performance, null);
    assert.equal(agg.avg_quality, null);
    // Total/sample tetap dijumlahkan seperti biasa (bukan null).
    assert.equal(agg.total_parts, 30);
    assert.equal(agg.sample_count, 180);
  });
});

test('FAT-213 (N-43): aggregate — campuran null + angka → rata-rata hanya dari yang non-null', async () => {
  await withStub(3062, (_req, url) => {
    if (url.pathname === '/api/v1/telemetry/STM32-OEE-01/aggregate') {
      return {
        status: 200,
        payload: [
          { bucket: '2026-11-20T09:00:00.000Z', availabilityPct: null, performancePct: null, qualityPct: 100, oeePct: 80, outputDelta: 10, rejectDelta: 0, goodDelta: 10, runSec: 3000, operatingSec: 3000, sampleCount: 60, provisional: false },
          { bucket: '2026-11-20T09:05:00.000Z', availabilityPct: null, performancePct: null, qualityPct: 90, oeePct: null, outputDelta: 12, rejectDelta: 0, goodDelta: 12, runSec: 3000, operatingSec: 3000, sampleCount: 60, provisional: false },
          { bucket: '2026-11-20T09:10:00.000Z', availabilityPct: 90, performancePct: null, qualityPct: null, oeePct: 90, outputDelta: 11, rejectDelta: 0, goodDelta: 11, runSec: 3000, operatingSec: 3000, sampleCount: 60, provisional: true },
        ],
      };
    }
    return null;
  }, async () => {
    const agg = await httpApiClient.getTelemetryAggregate('STM32-OEE-01', '5m');
    assert.equal(agg.rows.length, 3);
    // (80 + 90) / 2 — null dikeluarkan, bukan dihitung 0.
    assert.equal(agg.avg_oee, 85);
    // Satu-satunya nilai non-null.
    assert.equal(agg.avg_availability, 90);
    // Semua null → null (bukan 0).
    assert.equal(agg.avg_performance, null);
    // (100 + 90) / 2.
    assert.equal(agg.avg_quality, 95);
    assert.equal(agg.total_parts, 33);
    assert.equal(agg.sample_count, 180);
  });
});
