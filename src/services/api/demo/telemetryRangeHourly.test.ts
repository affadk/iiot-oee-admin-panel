// E32.2 (FAT-283): dipecah dari telemetryRange.test.ts — E11 T11.1
// (hourly + aggregate: rentang from/to + limit, demo + transport HTTP).
// Stub port 3009 (segar per file). Kode sumber tidak diubah.
import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { apiClient, store } from '../client';
import { httpApiClient } from '../httpClient';

// ---------------------------------------------------------------------------
// E11 T11.1 (FAT-44 / F-1): ganti rentang from/to (+limit) harus mengubah
// data yang dimuat tab Hourly & Aggregate Telemetry History — bukan refetch
// data yang sama (gap G3).
// ---------------------------------------------------------------------------

test('Demo hourly: tanpa options mengembalikan 8 bucket tetap seperti sebelumnya', async () => {
  const points = await apiClient.getHourlyTrend('STM32-OEE-01');
  assert.equal(points.length, 8);
  // E20 P20.5 (FAT-157): titik demo kini membawa `bucket` ISO (bukan
  // 'HH:MM' polos); `hour` = bucket ISO.
  assert.deepEqual(
    points.map((p) => p.bucket),
    ['07:00', '08:00', '09:00', '10:00', '11:00', '12:00', '13:00', '14:00'].map((h) => `2026-11-11T${h}:00+07:00`)
  );
});

test('Demo hourly: rentang 09:00–12:00 hanya mengembalikan 4 bucket dalam rentang', async () => {
  const points = await apiClient.getHourlyTrend('STM32-OEE-01', undefined, {
    from: '2026-11-11T09:00:00+07:00',
    to: '2026-11-11T12:00:00+07:00',
    limit: 50,
  });
  assert.deepEqual(
    points.map((p) => p.bucket),
    ['09:00', '10:00', '11:00', '12:00'].map((h) => `2026-11-11T${h}:00+07:00`)
  );
});

test('Demo hourly: rentang sehari penuh di tanggal lain tetap 8 bucket (anchor mengikuti to)', async () => {
  const points = await apiClient.getHourlyTrend('STM32-OEE-01', undefined, {
    from: '2026-11-09T00:00:00+07:00',
    to: '2026-11-09T23:59:00+07:00',
  });
  assert.equal(points.length, 8);
  assert.equal(points[0].bucket, '2026-11-11T07:00:00+07:00');
  assert.equal(points[7].bucket, '2026-11-11T14:00:00+07:00');
});

test('Demo hourly: rentang di luar jam shift (00:00–06:00) mengembalikan daftar kosong', async () => {
  const points = await apiClient.getHourlyTrend('STM32-OEE-01', undefined, {
    from: '2026-11-11T00:00:00+07:00',
    to: '2026-11-11T06:00:00+07:00',
  });
  assert.deepEqual(points, []);
});

test('Demo hourly: limit memotong ke N bucket terakhir dalam rentang', async () => {
  const points = await apiClient.getHourlyTrend('STM32-OEE-01', undefined, {
    from: '2026-11-11T00:00:00+07:00',
    to: '2026-11-11T23:59:00+07:00',
    limit: 3,
  });
  assert.deepEqual(
    points.map((p) => p.bucket),
    ['12:00', '13:00', '14:00'].map((h) => `2026-11-11T${h}:00+07:00`)
  );
});

test('Demo hourly: endpoint yang tercatat memuat from/to/limit', async () => {
  await apiClient.getHourlyTrend('STM32-OEE-01', undefined, {
    from: '2026-11-11T09:00:00+07:00',
    to: '2026-11-11T12:00:00+07:00',
    limit: 50,
  });
  const calls = store.endpointCalls.get('TELEMETRY_HOURLY') ?? [];
  const last = calls[calls.length - 1] ?? '';
  assert.ok(last.includes('from=2026-11-11T09%3A00%3A00%2B07%3A00'), last);
  assert.ok(last.includes('to=2026-11-11T12%3A00%3A00%2B07%3A00'), last);
  assert.ok(last.includes('limit=50'), last);
});

test('Demo aggregate: tanpa options nilai sama seperti sebelumnya (bucket 1h)', async () => {
  const agg = await apiClient.getTelemetryAggregate('STM32-OEE-01', '1h');
  assert.equal(agg.sample_count, 432);
  assert.equal(agg.total_parts, 333);
  assert.equal(agg.avg_oee, 83.5);
});

test('Demo aggregate: rentang 1 hari mengecilkan sample/total ~7x, rata-rata tetap', async () => {
  const agg = await apiClient.getTelemetryAggregate('STM32-OEE-01', '1h', undefined, {
    from: '2026-11-10T00:00:00+07:00',
    to: '2026-11-11T00:00:00+07:00',
  });
  assert.equal(agg.sample_count, 62);
  assert.equal(agg.total_parts, 48);
  assert.equal(agg.avg_oee, 83.5);
});

test('Demo aggregate: rentang 7 hari sama dengan default (rasio 1)', async () => {
  const agg = await apiClient.getTelemetryAggregate('STM32-OEE-01', '1h', undefined, {
    from: '2026-11-04T00:00:00+07:00',
    to: '2026-11-11T00:00:00+07:00',
  });
  assert.equal(agg.sample_count, 432);
  assert.equal(agg.total_parts, 333);
});

test('HTTP transport: getHourlyTrend & getTelemetryAggregate mengirim from/to/limit sebagai query', async () => {
  process.env.VITE_API_URL = 'http://localhost:3009/api/v1';
  const seenUrls: string[] = [];

  const server = http.createServer((req, res) => {
    const url = new URL(req.url ?? '/', 'http://localhost:3009');
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
    if (req.method === 'GET' && url.pathname === '/api/v1/telemetry/STM32-OEE-01/hourly') {
      json(200, [
        { hour: '09:00', oee: 86.2, availability: 94.0, performance: 93.5, quality: 98.2 },
        { hour: '10:00', oee: 82.0, availability: 90.0, performance: 92.0, quality: 99.0 },
      ]);
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
  await new Promise<void>((resolve) => server.listen(3009, resolve));
  try {
    await httpApiClient.login('ADM-001', 'Admin@2026!');

    const hourly = await httpApiClient.getHourlyTrend('STM32-OEE-01', undefined, {
      from: '2026-11-11T09:00:00+07:00',
      to: '2026-11-11T12:00:00+07:00',
      limit: 50,
    });
    assert.equal(hourly.length, 2);
    const hourlyUrl = new URL(seenUrls.find((u) => u.includes('/hourly')) ?? '', 'http://localhost:3009');
    assert.equal(hourlyUrl.searchParams.get('from'), '2026-11-11T09:00:00+07:00');
    assert.equal(hourlyUrl.searchParams.get('to'), '2026-11-11T12:00:00+07:00');
    assert.equal(hourlyUrl.searchParams.get('limit'), '50');

    const agg = await httpApiClient.getTelemetryAggregate('STM32-OEE-01', '1h', undefined, {
      from: '2026-11-11T09:00:00+07:00',
      to: '2026-11-11T12:00:00+07:00',
      limit: 50,
    });
    assert.equal(agg.sample_count, 432);
    const aggUrl = new URL(seenUrls.find((u) => u.includes('/aggregate')) ?? '', 'http://localhost:3009');
    assert.equal(aggUrl.searchParams.get('bucket'), '1h');
    assert.equal(aggUrl.searchParams.get('from'), '2026-11-11T09:00:00+07:00');
    assert.equal(aggUrl.searchParams.get('to'), '2026-11-11T12:00:00+07:00');
    assert.equal(aggUrl.searchParams.get('limit'), '50');

    // E23 Batch 3 (FAT-192, N-23): tanpa options, from/to tidak
    // terkirim, tetapi limit default spec (72) SELALU terkirim.
    seenUrls.length = 0;
    await httpApiClient.getHourlyTrend('STM32-OEE-01');
    const plainUrl = new URL(seenUrls[0] ?? '', 'http://localhost:3009');
    assert.equal(plainUrl.searchParams.has('from'), false);
    assert.equal(plainUrl.searchParams.has('to'), false);
    assert.equal(plainUrl.searchParams.get('limit'), '72');
  } finally {
    httpApiClient.setSessionActive(false, null);
    await new Promise<void>((resolve) => { server.closeAllConnections(); server.close(() => resolve()); });
  }
});
