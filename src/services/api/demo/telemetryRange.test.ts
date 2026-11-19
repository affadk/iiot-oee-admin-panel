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
  process.env.VITE_API_URL = 'http://localhost:3002/api/v1';
  const seenUrls: string[] = [];

  const server = http.createServer((req, res) => {
    const url = new URL(req.url ?? '/', 'http://localhost:3002');
    seenUrls.push(url.pathname + url.search);
    const json = (status: number, body: unknown) => {
      res.writeHead(status, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(body));
    };
    if (req.method === 'POST' && url.pathname === '/api/v1/auth/login') {
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
  await new Promise<void>((resolve) => server.listen(3002, resolve));
  try {
    await httpApiClient.login('ADM-001', 'Admin@2026!');

    const hourly = await httpApiClient.getHourlyTrend('STM32-OEE-01', undefined, {
      from: '2026-11-11T09:00:00+07:00',
      to: '2026-11-11T12:00:00+07:00',
      limit: 50,
    });
    assert.equal(hourly.length, 2);
    const hourlyUrl = new URL(seenUrls.find((u) => u.includes('/hourly')) ?? '', 'http://localhost:3002');
    assert.equal(hourlyUrl.searchParams.get('from'), '2026-11-11T09:00:00+07:00');
    assert.equal(hourlyUrl.searchParams.get('to'), '2026-11-11T12:00:00+07:00');
    assert.equal(hourlyUrl.searchParams.get('limit'), '50');

    const agg = await httpApiClient.getTelemetryAggregate('STM32-OEE-01', '1h', undefined, {
      from: '2026-11-11T09:00:00+07:00',
      to: '2026-11-11T12:00:00+07:00',
      limit: 50,
    });
    assert.equal(agg.sample_count, 432);
    const aggUrl = new URL(seenUrls.find((u) => u.includes('/aggregate')) ?? '', 'http://localhost:3002');
    assert.equal(aggUrl.searchParams.get('bucket'), '1h');
    assert.equal(aggUrl.searchParams.get('from'), '2026-11-11T09:00:00+07:00');
    assert.equal(aggUrl.searchParams.get('to'), '2026-11-11T12:00:00+07:00');
    assert.equal(aggUrl.searchParams.get('limit'), '50');

    // Tanpa options: tidak ada query from/to/limit yang terkirim.
    seenUrls.length = 0;
    await httpApiClient.getHourlyTrend('STM32-OEE-01');
    const plainUrl = new URL(seenUrls[0] ?? '', 'http://localhost:3002');
    assert.equal(plainUrl.searchParams.has('from'), false);
    assert.equal(plainUrl.searchParams.has('to'), false);
    assert.equal(plainUrl.searchParams.has('limit'), false);
  } finally {
    httpApiClient.setSessionActive(false, null);
    await new Promise<void>((resolve) => server.close(() => resolve()));
  }
});

// ---------------------------------------------------------------------------
// E11 T11.2 (FAT-47 / F-2): ganti periode harus me-refetch shift summary +
// timeline juga — keduanya menerima from/to (periode yang sama dengan
// hourly) dan memasukkannya ke query (gap G1).
// ---------------------------------------------------------------------------

test('Demo summary: tanpa options jendela + angka dari Σ hourly (Opsi A T12.6a)', async () => {
  const s = await apiClient.getShiftSummary('CNC-MILLING-01');
  assert.equal(s.shift_start, '2026-11-11T07:00:00+07:00');
  assert.equal(s.shift_end, '2026-11-11T15:00:00+07:00');
  assert.equal(s.shift_name, 'Shift 1 (07:00-15:00)');
  assert.equal(s.oee, 86.6);
  assert.equal(s.availability, 92.4);
  assert.equal(s.performance, 95.4);
  assert.equal(s.quality, 98.2);
  assert.equal(s.total_parts, 334);
  assert.equal(s.good_parts, 328);
  assert.equal(s.defect_parts, 6);
  assert.equal(s.target_per_hour, 50);
  assert.equal(s.run_time_min, 388);
  assert.equal(s.operating_time_min, 420);
});

test('Demo summary: from/to di tanggal lain memproyeksikan jendela ke tanggal to, angka tetap', async () => {
  const s = await apiClient.getShiftSummary('CNC-MILLING-01', undefined, {
    from: '2026-11-09T00:00:00+07:00',
    to: '2026-11-09T23:59:00+07:00',
  });
  assert.equal(s.shift_start, '2026-11-09T07:00:00+07:00');
  assert.equal(s.shift_end, '2026-11-09T15:00:00+07:00');
  assert.equal(s.oee, 86.6);
  assert.equal(s.run_time_min, 388);
});

test('Demo summary: hanya from — anchor mengikuti from', async () => {
  const s = await apiClient.getShiftSummary('CNC-MILLING-01', undefined, {
    from: '2026-11-12T00:00:00+07:00',
  });
  assert.equal(s.shift_start, '2026-11-12T07:00:00+07:00');
  assert.equal(s.shift_end, '2026-11-12T15:00:00+07:00');
});

test('Demo summary: endpoint yang tercatat memuat from/to', async () => {
  await apiClient.getShiftSummary('CNC-MILLING-01', undefined, {
    from: '2026-11-11T09:00:00+07:00',
    to: '2026-11-11T12:00:00+07:00',
  });
  const calls = store.endpointCalls.get('OEE_SHIFT_SUMMARY') ?? [];
  const last = calls[calls.length - 1] ?? '';
  assert.ok(last.includes('machine_id=CNC-MILLING-01'), last);
  assert.ok(last.includes('from=2026-11-11T09%3A00%3A00%2B07%3A00'), last);
  assert.ok(last.includes('to=2026-11-11T12%3A00%3A00%2B07%3A00'), last);
});

test('Demo timeline: tanpa options mengembalikan 33 fragmen bucket 15m (E11 T11.4)', async () => {
  const segs = await apiClient.getShiftTimeline('CNC-MILLING-01', '15m');
  // Segmen kanonis (5) dipecah eksak per bucket 15m: 32 bucket + 1 pecahan
  // di 09:45–10:00 (batas state 09:47). Σ durasi tetap 480.
  // E12 T12.11 (X-4 / FAT-59): start/end ISO 8601 Asia/Jakarta, bukan 'HH:MM'.
  const iso = (hhmm: string) => `2026-11-11T${hhmm}:00+07:00`;
  assert.deepEqual(
    segs.map((s) => s.start),
    ['07:00', '07:15', '07:30', '07:45', '08:00', '08:15', '08:30', '08:45', '09:00', '09:15', '09:30', '09:45', '09:47', '10:00', '10:15', '10:30', '10:45', '11:00', '11:15', '11:30', '11:45', '12:00', '12:15', '12:30', '12:45', '13:00', '13:15', '13:30', '13:45', '14:00', '14:15', '14:30', '14:45'].map(iso)
  );
  assert.equal(segs.reduce((acc, s) => acc + s.duration_min, 0), 480);
});

test('P20.5: Demo timeline bucket default 5m (§Q.3, §7I) — bukan 15m', async () => {
  const segs = await apiClient.getShiftTimeline('CNC-MILLING-01');
  // 480 mnt / 5 mnt = 96 bucket + 1 pecahan di 09:45–09:50 (batas 09:47).
  assert.equal(segs.length, 97);
  assert.equal(segs[0].start, '2026-11-11T07:00:00+07:00');
  assert.equal(segs.reduce((acc, s) => acc + s.duration_min, 0), 480);
});

test('Demo timeline: rentang 09:00–12:00 hanya mengembalikan segmen yang bersinggungan', async () => {
  const segs = await apiClient.getShiftTimeline('CNC-MILLING-01', '15m', undefined, {
    from: '2026-11-11T09:00:00+07:00',
    to: '2026-11-11T12:00:00+07:00',
  });
  // Batas inklusif (sama seperti bucket hourly): fragmen 08:45–09:00 masih
  // bersinggungan karena berakhir tepat di `from`, dan 12:00–12:15 mulai
  // tepat di `to`. E12 T12.11 (X-4): start ISO 8601 Asia/Jakarta.
  const iso = (hhmm: string) => `2026-11-11T${hhmm}:00+07:00`;
  assert.deepEqual(
    segs.map((s) => s.start),
    ['08:45', '09:00', '09:15', '09:30', '09:45', '09:47', '10:00', '10:15', '10:30', '10:45', '11:00', '11:15', '11:30', '11:45', '12:00'].map(iso)
  );
});

test('Demo timeline: rentang di luar jam shift (00:00–06:00) mengembalikan daftar kosong', async () => {
  const segs = await apiClient.getShiftTimeline('CNC-MILLING-01', '15m', undefined, {
    from: '2026-11-11T00:00:00+07:00',
    to: '2026-11-11T06:00:00+07:00',
  });
  assert.deepEqual(segs, []);
});

test('Demo timeline: rentang sehari penuh di tanggal lain tetap 33 fragmen (anchor mengikuti to)', async () => {
  const segs = await apiClient.getShiftTimeline('CNC-MILLING-01', '15m', undefined, {
    from: '2026-11-09T00:00:00+07:00',
    to: '2026-11-09T23:59:00+07:00',
  });
  assert.equal(segs.length, 33);
  assert.equal(segs[0].start, '2026-11-09T07:00:00+07:00');
  assert.equal(segs[32].start, '2026-11-09T14:45:00+07:00');
});

test('Demo timeline: endpoint yang tercatat memuat bucket + from/to', async () => {
  await apiClient.getShiftTimeline('CNC-MILLING-01', '15m', undefined, {
    from: '2026-11-11T09:00:00+07:00',
    to: '2026-11-11T12:00:00+07:00',
  });
  const calls = store.endpointCalls.get('OEE_SHIFT_TIMELINE') ?? [];
  const last = calls[calls.length - 1] ?? '';
  assert.ok(last.includes('bucket=15m'), last);
  assert.ok(last.includes('machine_id=CNC-MILLING-01'), last);
  assert.ok(last.includes('from=2026-11-11T09%3A00%3A00%2B07%3A00'), last);
  assert.ok(last.includes('to=2026-11-11T12%3A00%3A00%2B07%3A00'), last);
});

test('HTTP transport: getShiftSummary & getShiftTimeline mengirim from/to sebagai query', async () => {
  process.env.VITE_API_URL = 'http://localhost:3003/api/v1';
  const seenUrls: string[] = [];

  const server = http.createServer((req, res) => {
    const url = new URL(req.url ?? '/', 'http://localhost:3003');
    seenUrls.push(url.pathname + url.search);
    const json = (status: number, body: unknown) => {
      res.writeHead(status, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(body));
    };
    if (req.method === 'POST' && url.pathname === '/api/v1/auth/login') {
      json(200, {
        success: true,
        token: 'stub-jwt',
        expires_in: 900,
        operator: { id: 'ADM-001', username: 'Alexandria Vance', role: 'ADMIN', line_id: 'ORG-ALL' },
      });
      return;
    }
    if (req.method === 'GET' && url.pathname === '/api/v1/oee/shift-summary') {
      json(200, {
        machine_id: 'CNC-MILLING-01',
        shift_name: 'Shift 1 (07:00-15:00)',
        oee: 84.6,
        availability: 92.4,
        performance: 94.1,
        quality: 97.4,
        time_sec: { operating: 25200, run: 23280, downtime: 1920 },
        window: { from: '2026-11-11T07:00:00+07:00', to: '2026-11-11T15:00:00+07:00', tz: 'Asia/Jakarta' },
        total_count: 350,
        good_count: 342,
        reject_count: 8,
        target_per_hour: 64,
      });
      return;
    }
    if (req.method === 'GET' && url.pathname === '/api/v1/oee/shift-timeline') {
      json(200, [
        { start: '2026-11-11T07:00:00+07:00', end: '2026-11-11T09:15:00+07:00', state: 'RUNNING', planned: false },
        { start: '2026-11-11T09:15:00+07:00', end: '2026-11-11T09:30:00+07:00', state: 'UNPLANNED_DOWNTIME', planned: false, downtime_id: 'dt-ev-02' },
      ]);
      return;
    }
    json(404, { error: 'NOT_FOUND', message: `Rute stub tidak dikenal: ${url.pathname}` });
  });
  await new Promise<void>((resolve) => server.listen(3003, resolve));
  try {
    await httpApiClient.login('ADM-001', 'Admin@2026!');

    const summary = await httpApiClient.getShiftSummary('CNC-MILLING-01', undefined, {
      from: '2026-11-11T09:00:00+07:00',
      to: '2026-11-11T12:00:00+07:00',
    });
    assert.equal(summary.oee, 84.6);
    assert.equal(summary.run_time_min, 388);
    const summaryUrl = new URL(seenUrls.find((u) => u.includes('/oee/shift-summary')) ?? '', 'http://localhost:3003');
    assert.equal(summaryUrl.searchParams.get('machine_id'), 'CNC-MILLING-01');
    assert.equal(summaryUrl.searchParams.get('from'), '2026-11-11T09:00:00+07:00');
    assert.equal(summaryUrl.searchParams.get('to'), '2026-11-11T12:00:00+07:00');

    const timeline = await httpApiClient.getShiftTimeline('CNC-MILLING-01', '15m', undefined, {
      from: '2026-11-11T09:00:00+07:00',
      to: '2026-11-11T12:00:00+07:00',
    });
    assert.equal(timeline.length, 2);
    assert.equal(timeline[0].duration_min, 135);
    const timelineUrl = new URL(seenUrls.find((u) => u.includes('/oee/shift-timeline')) ?? '', 'http://localhost:3003');
    assert.equal(timelineUrl.searchParams.get('bucket'), '15m');
    assert.equal(timelineUrl.searchParams.get('machine_id'), 'CNC-MILLING-01');
    assert.equal(timelineUrl.searchParams.get('from'), '2026-11-11T09:00:00+07:00');
    assert.equal(timelineUrl.searchParams.get('to'), '2026-11-11T12:00:00+07:00');

    // Tanpa options: tidak ada query from/to yang terkirim.
    seenUrls.length = 0;
    await httpApiClient.getShiftSummary('CNC-MILLING-01');
    const plainSummaryUrl = new URL(seenUrls.find((u) => u.includes('/oee/shift-summary')) ?? '', 'http://localhost:3003');
    assert.equal(plainSummaryUrl.searchParams.has('from'), false);
    assert.equal(plainSummaryUrl.searchParams.has('to'), false);
    seenUrls.length = 0;
    await httpApiClient.getShiftTimeline('CNC-MILLING-01');
    const plainTimelineUrl = new URL(seenUrls.find((u) => u.includes('/oee/shift-timeline')) ?? '', 'http://localhost:3003');
    assert.equal(plainTimelineUrl.searchParams.has('from'), false);
    assert.equal(plainTimelineUrl.searchParams.has('to'), false);
  } finally {
    httpApiClient.setSessionActive(false, null);
    await new Promise<void>((resolve) => server.close(() => resolve()));
  }
});

// ---------------------------------------------------------------------------
// E11 T11.3 (FAT-48 / F-3): rollup halaman OEE mengikuti mesin terpilih —
// filter machine_id diteruskan ke endpoint/demo dan data yang kembali
// terikat mesin itu, bukan agregat semua mesin (gap G4).
// ---------------------------------------------------------------------------

test('Demo rollup machine: machine_id CNC-MILLING-01 hanya mengembalikan baris mesin itu', async () => {
  const page = await apiClient.getTelemetryRollup({
    group_by: 'machine',
    machine_id: 'CNC-MILLING-01',
    from: '2026-11-04T00:00:00+07:00',
    to: '2026-11-11T00:00:00+07:00',
    limit: 20,
    envelope: true,
  });
  assert.equal(page.data.length, 1);
  assert.equal(page.data[0].machine_id, 'CNC-MILLING-01');
  assert.equal(page.data[0].groupKey, 'CNC-MILLING-01');
  // Total per-mesin dari live state (350 × 4), bukan total plant-wide.
  assert.equal(page.data[0].totalCount, 1400);
});

test('Demo rollup machine: mesin lain mengembalikan baris + angka mesin itu', async () => {
  const page = await apiClient.getTelemetryRollup({
    group_by: 'machine',
    machine_id: 'CNC-LATHE-02',
    from: '2026-11-04T00:00:00+07:00',
    to: '2026-11-11T00:00:00+07:00',
    limit: 20,
    envelope: true,
  });
  assert.equal(page.data.length, 1);
  assert.equal(page.data[0].machine_id, 'CNC-LATHE-02');
  assert.equal(page.data[0].groupKey, 'CNC-LATHE-02');
  assert.equal(page.data[0].totalCount, 732); // live total 183 × 4
});

test('Demo rollup machine: tanpa machine_id mengembalikan semua mesin (plant-wide)', async () => {
  const page = await apiClient.getTelemetryRollup({
    group_by: 'machine',
    from: '2026-11-04T00:00:00+07:00',
    to: '2026-11-11T00:00:00+07:00',
    limit: 20,
    envelope: true,
  });
  assert.ok(page.data.length > 1);
  const ids = page.data.map((r) => r.machine_id);
  assert.ok(ids.includes('CNC-MILLING-01'));
  assert.ok(ids.includes('CNC-LATHE-02'));
});

test('Demo rollup: endpoint yang tercatat memuat machine_id mesin terpilih', async () => {
  await apiClient.getTelemetryRollup({
    group_by: 'machine',
    machine_id: 'CNC-MILLING-01',
    from: '2026-11-04T00:00:00+07:00',
    to: '2026-11-11T00:00:00+07:00',
    limit: 20,
    envelope: true,
  });
  const calls = store.endpointCalls.get('TELEMETRY_ROLLUP') ?? [];
  const last = calls[calls.length - 1] ?? '';
  assert.ok(last.includes('machine_id=CNC-MILLING-01'), last);
  assert.ok(last.includes('group_by=machine'), last);
});

test('HTTP transport: getTelemetryRollup mengirim machine_id sebagai query', async () => {
  process.env.VITE_API_URL = 'http://localhost:3004/api/v1';
  const seenUrls: string[] = [];

  const server = http.createServer((req, res) => {
    const url = new URL(req.url ?? '/', 'http://localhost:3004');
    seenUrls.push(url.pathname + url.search);
    const json = (status: number, body: unknown) => {
      res.writeHead(status, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(body));
    };
    if (req.method === 'POST' && url.pathname === '/api/v1/auth/login') {
      json(200, {
        success: true,
        token: 'stub-jwt',
        expires_in: 900,
        operator: { id: 'ADM-001', username: 'Alexandria Vance', role: 'ADMIN', line_id: 'ORG-ALL' },
      });
      return;
    }
    if (req.method === 'GET' && url.pathname === '/api/v1/telemetry/rollup') {
      json(200, [
        {
          group_by: 'machine',
          group_key: 'CNC-MILLING-01',
          machine_id: 'CNC-MILLING-01',
          machine_name: 'CNC Milling Center Alpha',
          device_id: 'STM32-OEE-01',
          bucket: '2026-11-11',
          total_count: 1400,
          good_count: 1376,
          reject_count: 24,
          operating_sec: 28800,
          run_sec: 25920,
          availability_pct: 90.0,
          performance_pct: 92.5,
          quality_pct: 98.29,
          oee_pct: 81.84,
          sample_count: 380,
          provisional: true,
        },
      ]);
      return;
    }
    json(404, { error: 'NOT_FOUND', message: `Rute stub tidak dikenal: ${url.pathname}` });
  });
  await new Promise<void>((resolve) => server.listen(3004, resolve));
  try {
    await httpApiClient.login('ADM-001', 'Admin@2026!');

    const page = await httpApiClient.getTelemetryRollup({
      group_by: 'machine',
      machine_id: 'CNC-MILLING-01',
      from: '2026-11-04T00:00:00+07:00',
      to: '2026-11-11T00:00:00+07:00',
      limit: 20,
      envelope: true,
    });
    assert.equal(page.data.length, 1);
    assert.equal(page.data[0].machine_id, 'CNC-MILLING-01');
    assert.equal(page.data[0].totalCount, 1400);

    const rollupUrl = new URL(
      seenUrls.find((u) => u.includes('/telemetry/rollup')) ?? '',
      'http://localhost:3004'
    );
    assert.equal(rollupUrl.searchParams.get('machine_id'), 'CNC-MILLING-01');
    assert.equal(rollupUrl.searchParams.get('group_by'), 'machine');
    // Halaman OEE tidak mengirim device_id — scope-nya mesin (T11.3).
    assert.equal(rollupUrl.searchParams.has('device_id'), false);
  } finally {
    httpApiClient.setSessionActive(false, null);
    await new Promise<void>((resolve) => server.close(() => resolve()));
  }
});

// ---------------------------------------------------------------------------
// E11 T11.4 (FAT-46 / F-4): angka seed demo terrekoniliasi (gap G2, G21).
// Shift summary adalah KEBENARAN: jendela 480 mnt = RUNNING 388 + PLANNED
// 60 + UNPLANNED 32; operating 420 = run 388 + unplanned 32.
// ---------------------------------------------------------------------------

test('Demo rekonsiliasi: Σ durasi timeline per state = shift summary (bucket 15m)', async () => {
  const summary = await apiClient.getShiftSummary('CNC-MILLING-01');
  const segs = await apiClient.getShiftTimeline('CNC-MILLING-01', '15m');
  const byState = new Map<string, number>();
  for (const s of segs) byState.set(s.fsm_state, (byState.get(s.fsm_state) ?? 0) + s.duration_min);
  const total = segs.reduce((acc, s) => acc + s.duration_min, 0);
  assert.equal(total, summary.planned_production_time_min); // 480
  assert.equal(byState.get('RUNNING'), summary.run_time_min); // 388
  assert.equal(byState.get('PLANNED_DOWNTIME'), summary.planned_downtime_min); // 60
  assert.equal(byState.get('UNPLANNED_DOWNTIME'), summary.unplanned_downtime_min); // 32
  assert.equal(
    (byState.get('RUNNING') ?? 0) + (byState.get('UNPLANNED_DOWNTIME') ?? 0),
    summary.operating_time_min
  ); // 420
});

test('Demo rekonsiliasi: Σ durasi timeline per state sama pada semua bucket + gapless', async () => {
  // E12 T12.11 (X-4 / FAT-59): start/end kini ISO 8601 — toMin mengekstrak
  // jam-dindingnya (jam WIB, sama dengan yang tertulis di ISO +07:00).
  const toMin = (v: string) => {
    const hhmm = v.includes('T') ? v.slice(11, 16) : v;
    const [h, m] = hhmm.split(':').map(Number);
    return h * 60 + m;
  };
  const bucketMin: Record<string, number> = { '1m': 1, '5m': 5, '15m': 15, '1h': 60 };
  for (const bucket of ['1m', '5m', '15m', '1h'] as const) {
    const segs = await apiClient.getShiftTimeline('CNC-MILLING-01', bucket);
    const byState = new Map<string, number>();
    for (const s of segs) byState.set(s.fsm_state, (byState.get(s.fsm_state) ?? 0) + s.duration_min);
    assert.equal(byState.get('RUNNING'), 388, `RUNNING bucket ${bucket}`);
    assert.equal(byState.get('PLANNED_DOWNTIME'), 60, `PLANNED bucket ${bucket}`);
    assert.equal(byState.get('UNPLANNED_DOWNTIME'), 32, `UNPLANNED bucket ${bucket}`);
    assert.equal(segs.reduce((acc, s) => acc + s.duration_min, 0), 480, `total bucket ${bucket}`);
    // Gapless: ujung satu segmen = awal segmen berikut, 07:00–15:00.
    assert.equal(segs[0].start, '2026-11-11T07:00:00+07:00', `awal bucket ${bucket}`);
    assert.equal(segs[segs.length - 1].end, '2026-11-11T15:00:00+07:00', `akhir bucket ${bucket}`);
    for (let i = 1; i < segs.length; i++) {
      assert.equal(segs[i].start, segs[i - 1].end, `celah bucket ${bucket} idx ${i}`);
    }
    // Tidak ada segmen yang melewati batas bucket.
    const bm = bucketMin[bucket];
    for (const s of segs) {
      assert.equal(
        Math.floor(toMin(s.start) / bm),
        Math.floor((toMin(s.end) - 1) / bm),
        `segmen ${s.start}–${s.end} melewati batas bucket ${bucket}`
      );
    }
  }
});

test('Demo rekonsiliasi: bucket mengubah segmentasi (bukan segmen yang sama untuk semua bucket)', async () => {
  const counts: Record<string, number> = {};
  for (const bucket of ['1m', '5m', '15m', '1h'] as const) {
    counts[bucket] = (await apiClient.getShiftTimeline('CNC-MILLING-01', bucket)).length;
  }
  // 480 menit / bucket + 1 pecahan di batas state 09:47 (5m/15m).
  assert.deepEqual(counts, { '1m': 480, '5m': 97, '15m': 33, '1h': 10 });
});

test('Demo rekonsiliasi: Σ hourly_run_sec/operating = shift summary; downtime per jam diturunkan dari operating−run (E12 T12.14)', async () => {
  const summary = await apiClient.getShiftSummary('CNC-MILLING-01');
  const hourly = await apiClient.getHourlyTrend('STM32-OEE-01');
  const runSec = hourly.reduce((acc, p) => acc + (p.hourly_run_sec ?? 0), 0);
  const opSec = hourly.reduce((acc, p) => acc + (p.hourly_operating_sec ?? 0), 0);
  assert.equal(runSec, summary.run_time_min * 60); // 23.280 dtk = 388 mnt
  assert.equal(opSec, summary.operating_time_min * 60); // 25.200 dtk = 420 mnt
  // E12 T12.6a (Opsi A / FAT-70): Σ parts per jam = ringkasan (334/328/6).
  const totalParts = hourly.reduce((acc, p) => acc + (p.parts_produced ?? 0), 0);
  const goodParts = hourly.reduce((acc, p) => acc + (p.good_count ?? 0), 0);
  const defectParts = hourly.reduce((acc, p) => acc + (p.defect_count ?? 0), 0);
  assert.equal(totalParts, summary.total_parts); // 334
  assert.equal(goodParts, summary.good_parts); // 328
  assert.equal(defectParts, summary.defect_parts); // 6
  // E12 T12.14 (F-10 / FAT-66): `hourly_downtime_sec` DIHAPUS dari tipe +
  // seed — downtime per jam diturunkan dari data yang tersisa:
  // operating − run. Turunan ini hanya menangkap downtime UNPLANNED
  // (Σ 1.920 dtk = 32 mnt): jam 12:00 yang sepenuhnya planned punya
  // operating 0 (gap G8) sehingga planned-nya tidak tertangkap turunan
  // ini. Σ downtime penuh 92 mnt (5.520 dtk = planned 60 + unplanned 32)
  // sumber kebenarannya ada di downtime_events — dt-ev-02 (1.920 dtk) +
  // dt-ev-04 (3.600 dtk), dibuktikan pada test 'event downtime cocok'
  // di bawah, bukan lagi dari titik per jam.
  const derivedDowntimeByHour = new Map(
    hourly.map((p) => [p.bucket, (p.hourly_operating_sec ?? 0) - (p.hourly_run_sec ?? 0)])
  );
  assert.deepEqual(
    [...derivedDowntimeByHour.entries()],
    [
      ['2026-11-11T07:00:00+07:00', 350],
      ['2026-11-11T08:00:00+07:00', 274],
      ['2026-11-11T09:00:00+07:00', 216],
      ['2026-11-11T10:00:00+07:00', 360],
      ['2026-11-11T11:00:00+07:00', 252],
      ['2026-11-11T12:00:00+07:00', 0], // jam planned penuh: operating 0 (G8), turunan 0
      ['2026-11-11T13:00:00+07:00', 180],
      ['2026-11-11T14:00:00+07:00', 288],
    ]
  );
  const derivedDtSec = [...derivedDowntimeByHour.values()].reduce((acc, v) => acc + v, 0);
  assert.equal(derivedDtSec, summary.unplanned_downtime_min * 60); // 1.920 dtk = 32 mnt
  for (const v of derivedDowntimeByHour.values()) {
    assert.ok(v >= 0, 'downtime turunan per jam tidak boleh negatif');
  }
});

test('Demo rekonsiliasi: jam 12:00 tidak diubah (sepenuhnya planned, gap G8)', async () => {
  const hourly = await apiClient.getHourlyTrend('STM32-OEE-01');
  const noon = hourly.find((p) => p.bucket === '2026-11-11T12:00:00+07:00');
  assert.ok(noon);
  assert.equal(noon.hourly_operating_sec, 0);
  assert.equal(noon.hourly_run_sec, 0);
  // E12 T12.14 (F-10 / FAT-66): tidak ada lagi `hourly_downtime_sec`
  // (dulu 3600). Downtime 3.600 dtk jam ini sumber kebenarannya adalah
  // downtime event dt-ev-04 (12:00–13:00) — dibuktikan pada test
  // 'event downtime cocok' di bawah.
  assert.equal(noon.availability, 0);
  assert.equal(noon.state, 'PLANNED_DOWNTIME');
});

test('E12 T12.14: titik hourly seed tidak lagi membawa hourly_downtime_sec', async () => {
  const hourly = await apiClient.getHourlyTrend('STM32-OEE-01');
  assert.equal(hourly.length, 8);
  for (const p of hourly) {
    assert.ok(!('hourly_downtime_sec' in p), `jam ${p.hour} tidak boleh membawa hourly_downtime_sec`);
  }
});

test('Demo rekonsiliasi: availability tiap jam konsisten dengan run/operating', async () => {
  const hourly = await apiClient.getHourlyTrend('STM32-OEE-01');
  for (const p of hourly) {
    const opSec = p.hourly_operating_sec ?? 0;
    if (opSec === 0) continue; // jam 12:00, G8
    const expected = Math.round(((p.hourly_run_sec ?? 0) / opSec) * 1000) / 10;
    assert.equal(p.availability, expected, `availability jam ${p.hour}`);
  }
});

test('Demo rekonsiliasi: event downtime cocok dengan segmen timeline (durasi + waktu)', async () => {
  const segs = await apiClient.getShiftTimeline('CNC-MILLING-01', '15m');
  const unplanned = segs.filter((s) => s.downtime_id === 'dt-ev-02');
  assert.equal(unplanned.reduce((acc, s) => acc + s.duration_min, 0), 32);
  assert.equal(unplanned[0].start, '2026-11-11T09:15:00+07:00');
  assert.equal(unplanned[unplanned.length - 1].end, '2026-11-11T09:47:00+07:00');
  const planned = segs.filter((s) => s.downtime_id === 'dt-ev-04');
  assert.equal(planned.reduce((acc, s) => acc + s.duration_min, 0), 60);
  assert.equal(planned[0].start, '2026-11-11T12:00:00+07:00');
  assert.equal(planned[planned.length - 1].end, '2026-11-11T13:00:00+07:00');

  // Jalur yang dipakai overlay timeline (useOeeAnalytics): histori
  // downtime perangkat pada jendela 7 hari default halaman OEE.
  const page = await apiClient.getDowntimeHistoryPage(
    {
      device_id: 'STM32-OEE-01',
      from: '2026-11-09T00:00:00+07:00',
      to: '2026-11-16T23:59:00+07:00',
      limit: 50,
      envelope: true,
    },
    undefined
  );
  const ev02 = page.data.find((d) => d.id === 'dt-ev-02');
  const ev04 = page.data.find((d) => d.id === 'dt-ev-04');
  assert.ok(ev02, 'dt-ev-02 harus ditemukan pada histori STM32-OEE-01');
  assert.ok(ev04, 'dt-ev-04 harus ditemukan pada histori STM32-OEE-01');
  assert.equal(ev02.duration_seconds, 32 * 60);
  assert.equal(ev02.started_at, '2026-11-11T09:15:00+07:00');
  assert.equal(ev02.ended_at, '2026-11-11T09:47:00+07:00');
  assert.equal(ev04.duration_seconds, 60 * 60);
  assert.equal(ev04.started_at, '2026-11-11T12:00:00+07:00');
  assert.equal(ev04.ended_at, '2026-11-11T13:00:00+07:00');

  // E12 T12.14 (F-10 / FAT-66): Σ downtime penuh shift dibuktikan dari
  // sumber kebenaran (downtime_events), bukan dari titik per jam yang
  // field-nya sudah dihapus: 1.920 + 3.600 = 5.520 dtk = 92 mnt
  // (planned 60 + unplanned 32).
  assert.equal(ev02.duration_seconds + ev04.duration_seconds, (60 + 32) * 60);
});

test('Demo rekonsiliasi: rollup machine bucket null (dokumen API, gap G21)', async () => {
  const page = await apiClient.getTelemetryRollup({
    group_by: 'machine',
    from: '2026-11-04T00:00:00+07:00',
    to: '2026-11-11T00:00:00+07:00',
    limit: 20,
    envelope: true,
  });
  assert.ok(page.data.length > 1);
  for (const row of page.data) {
    assert.equal(row.bucket, null, `bucket baris ${row.groupKey} harus null`);
  }
});
