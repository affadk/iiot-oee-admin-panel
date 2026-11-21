import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { apiClient } from '../client';
import { httpApiClient } from '../httpClient';

// ---------------------------------------------------------------------------
// E12 T12.2 (F-5 / FAT-51): tab Aggregate menampilkan deret per-bucket —
// getTelemetryAggregate mengembalikan SELURUH rows (bukan rows[0]) + flag
// provisional per baris, konsisten di mode Demo dan HTTP (gap G6, G12).
// ---------------------------------------------------------------------------

test('Demo aggregate: tanpa options mengembalikan 168 bucket 1h + ringkasan lama', async () => {
  const agg = await apiClient.getTelemetryAggregate('STM32-OEE-01', '1h');
  assert.equal(agg.rows.length, 168);
  assert.equal(agg.sample_count, 432);
  assert.equal(agg.total_parts, 333);
  assert.equal(agg.avg_oee, 83.5);
  assert.equal(agg.bucket, '1h');
  assert.equal(agg.device_id, 'STM32-OEE-01');
});

test('Demo aggregate: Σ rows cocok dengan ringkasan; bucket naik; hanya terakhir provisional', async () => {
  const agg = await apiClient.getTelemetryAggregate('STM32-OEE-01', '1h');
  const sampleSum = agg.rows.reduce((a, r) => a + r.sampleCount, 0);
  const partsSum = agg.rows.reduce((a, r) => a + r.totalCount, 0);
  assert.equal(sampleSum, agg.sample_count);
  assert.equal(partsSum, agg.total_parts);
  const oeeMean = agg.rows.reduce((a, r) => a + Number(r.oeePct), 0) / agg.rows.length;
  // FAT-213 (N-43): avg_oee nullable — di demo device ini angkanya ada.
  assert.ok(agg.avg_oee !== null && Math.abs(oeeMean - agg.avg_oee) < 0.5, `rata-rata OEE rows ${oeeMean} vs ringkasan ${agg.avg_oee}`);
  for (let i = 1; i < agg.rows.length; i++) {
    assert.ok(Date.parse(agg.rows[i].bucket) > Date.parse(agg.rows[i - 1].bucket), 'bucket harus menaik');
  }
  assert.equal(agg.rows[agg.rows.length - 1].provisional, true);
  assert.ok(agg.rows.slice(0, -1).every((r) => r.provisional === false));
  assert.ok(agg.rows.every((r) => typeof r.oeePct === 'number' && typeof r.sampleCount === 'number'));
});

test('Demo aggregate: rentang 1 hari = 24 bucket; limit memotong ke N bucket terakhir', async () => {
  const day = await apiClient.getTelemetryAggregate('STM32-OEE-01', '1h', undefined, {
    from: '2026-11-10T00:00:00+07:00',
    to: '2026-11-11T00:00:00+07:00',
  });
  assert.equal(day.rows.length, 24);
  assert.equal(day.sample_count, 62);
  assert.equal(day.total_parts, 48);
  assert.equal(day.rows.reduce((a, r) => a + r.sampleCount, 0), 62);

  const limited = await apiClient.getTelemetryAggregate('STM32-OEE-01', '1h', undefined, {
    from: '2026-11-10T00:00:00+07:00',
    to: '2026-11-11T00:00:00+07:00',
    limit: 3,
  });
  assert.equal(limited.rows.length, 3);
  assert.deepEqual(
    limited.rows.map((r) => r.bucket),
    day.rows.slice(-3).map((r) => r.bucket)
  );
  assert.equal(limited.rows[2].provisional, true);
});

test('Demo aggregate: rentang kosong (from > to) mengembalikan rows [] + total 0', async () => {
  const agg = await apiClient.getTelemetryAggregate('STM32-OEE-01', '1h', undefined, {
    from: '2026-11-11T12:00:00+07:00',
    to: '2026-11-11T09:00:00+07:00',
  });
  assert.deepEqual(agg.rows, []);
  assert.equal(agg.sample_count, 0);
  assert.equal(agg.total_parts, 0);
});

test('Demo aggregate: perangkat kapasitas unknown (STM32-OEE-05) — performance null, parts 0', async () => {
  const agg = await apiClient.getTelemetryAggregate('STM32-OEE-05', '1h', undefined, {
    from: '2026-11-10T00:00:00+07:00',
    to: '2026-11-11T00:00:00+07:00',
  });
  assert.equal(agg.rows.length, 24);
  assert.ok(agg.rows.every((r) => r.performancePct === null));
  // E20 P20.5 (FAT-157, D-8): `oeePct` null (bukan 0) saat kapasitas unknown.
  assert.ok(agg.rows.every((r) => r.totalCount === 0 && r.oeePct === null));
  assert.equal(agg.total_parts, 0);
  assert.equal(agg.avg_performance, 0);
});

test('HTTP aggregate: seluruh rows kanonis dikembalikan + ringkasan dihitung dari rows', async () => {
  process.env.VITE_API_URL = 'http://localhost:3003/api/v1';
  const seenUrls: string[] = [];

  const server = http.createServer((req, res) => {
    const url = new URL(req.url ?? '/', 'http://localhost:3003');
    seenUrls.push(url.pathname + url.search);
    const json = (status: number, body: unknown) => {
      res.writeHead(status, { 'Content-Type': 'application/json', Connection: 'close' });
      res.end(JSON.stringify(body));
    };
    if (req.method === 'POST' && url.pathname === '/api/v1/auth/admin/login') {
      json(200, {
        success: true,
        token: 'stub-jwt',
        expires_in: 900,
        operator: { id: 'ADM-001', username: 'Alexandria Vance', role: 'ADMIN', line_id: 'ORG-ALL' },
      });
      return;
    }
    if (req.method === 'GET' && url.pathname === '/api/v1/telemetry/STM32-OEE-01/aggregate') {
      json(200, [
        {
          bucket: '2026-11-11T09:00:00.000Z',
          totalCount: 10,
          goodCount: 9,
          rejectCount: 1,
          operatingSec: 3600,
          runSec: 3300,
          availabilityPct: 91.7,
          performancePct: 93.0,
          qualityPct: 90.0,
          oeePct: 76.7,
          sampleCount: 60,
          provisional: false,
        },
        {
          bucket: '2026-11-11T10:00:00.000Z',
          totalCount: 12,
          goodCount: 12,
          rejectCount: 0,
          operatingSec: 3600,
          runSec: 3400,
          availabilityPct: 94.4,
          performancePct: 95.0,
          qualityPct: 100.0,
          oeePct: 84.0,
          sampleCount: 60,
          provisional: false,
        },
        {
          bucket: '2026-11-11T11:00:00.000Z',
          totalCount: 11,
          goodCount: 10,
          rejectCount: 1,
          operatingSec: 3600,
          runSec: 3350,
          availabilityPct: 93.1,
          performancePct: 94.0,
          qualityPct: 90.9,
          oeePct: 88.0,
          sampleCount: 60,
          provisional: true,
        },
      ]);
      return;
    }
    json(404, { error: 'NOT_FOUND', message: `Rute stub tidak dikenal: ${url.pathname}` });
  });
  await new Promise<void>((resolve) => server.listen(3003, resolve));
  try {
    await httpApiClient.login('ADM-001', 'Admin@2026!');

    const agg = await httpApiClient.getTelemetryAggregate('STM32-OEE-01', '1h');
    assert.equal(agg.rows.length, 3);
    assert.deepEqual(
      agg.rows.map((r) => r.bucket),
      ['2026-11-11T09:00:00.000Z', '2026-11-11T10:00:00.000Z', '2026-11-11T11:00:00.000Z']
    );
    assert.deepEqual(
      agg.rows.map((r) => r.provisional),
      [false, false, true]
    );
    assert.equal(agg.total_parts, 33);
    assert.equal(agg.sample_count, 180);
    assert.equal(agg.avg_oee, 82.9);
    assert.equal(agg.avg_availability, 93.1);
    assert.equal(agg.avg_performance, 94.0);
    assert.equal(agg.avg_quality, 93.6);
    const aggUrl = new URL(seenUrls.find((u) => u.includes('/aggregate')) ?? '', 'http://localhost:3003');
    assert.equal(aggUrl.searchParams.get('bucket'), '1h');
  } finally {
    httpApiClient.setSessionActive(false, null);
    await new Promise<void>((resolve) => { server.closeAllConnections(); server.close(() => resolve()); });
  }
});

test('HTTP aggregate: baris bentuk ringkasan lama tetap termuat (kompatibel mundur)', async () => {
  process.env.VITE_API_URL = 'http://localhost:3004/api/v1';

  const server = http.createServer((req, res) => {
    const url = new URL(req.url ?? '/', 'http://localhost:3004');
    const json = (status: number, body: unknown) => {
      res.writeHead(status, { 'Content-Type': 'application/json', Connection: 'close' });
      res.end(JSON.stringify(body));
    };
    if (req.method === 'POST' && url.pathname === '/api/v1/auth/admin/login') {
      json(200, {
        success: true,
        token: 'stub-jwt',
        expires_in: 900,
        operator: { id: 'ADM-001', username: 'Alexandria Vance', role: 'ADMIN', line_id: 'ORG-ALL' },
      });
      return;
    }
    if (req.method === 'GET' && url.pathname === '/api/v1/telemetry/STM32-OEE-01/aggregate') {
      json(200, [
        {
          avg_oee: 83.5,
          avg_availability: 91.4,
          avg_performance: 93.1,
          avg_quality: 98.0,
          total_parts: 333,
          sample_count: 432,
        },
      ]);
      return;
    }
    json(404, { error: 'NOT_FOUND', message: `Rute stub tidak dikenal: ${url.pathname}` });
  });
  await new Promise<void>((resolve) => server.listen(3004, resolve));
  try {
    await httpApiClient.login('ADM-001', 'Admin@2026!');
    const agg = await httpApiClient.getTelemetryAggregate('STM32-OEE-01', '1h');
    assert.equal(agg.rows.length, 1);
    assert.equal(agg.rows[0].totalCount, 333);
    assert.equal(agg.rows[0].sampleCount, 432);
    assert.equal(agg.rows[0].provisional, false);
    assert.equal(agg.sample_count, 432);
    assert.equal(agg.total_parts, 333);
    assert.equal(agg.avg_oee, 83.5);
  } finally {
    httpApiClient.setSessionActive(false, null);
    await new Promise<void>((resolve) => { server.closeAllConnections(); server.close(() => resolve()); });
  }
});
