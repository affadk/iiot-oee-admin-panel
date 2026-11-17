import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { apiClient, store } from '../client';
import { httpApiClient } from '../httpClient';

// ---------------------------------------------------------------------------
// E12 T12.1 (FAT-54 / X-1): filter shift (tanggal + shift) — memilih shift
// mengubah from/to yang dikirim dan me-refetch data jendela shift itu
// (gap G19, G1). Parameter date/shift mengikuti API doc §I.
// ---------------------------------------------------------------------------

test('Demo summary: shift S1 + date memproyeksikan jendela ke tanggal itu, endpoint mencatat date/shift', async () => {
  const s = await apiClient.getShiftSummary('CNC-MILLING-01', undefined, {
    from: '2026-11-16T07:00:00+07:00',
    to: '2026-11-16T15:00:00+07:00',
    date: '2026-11-16',
    shift: 'S1',
  });
  assert.equal(s.shift_name, 'Shift 1 (Pagi)');
  assert.equal(s.shift_start, '2026-11-16T07:00:00+07:00');
  assert.equal(s.shift_end, '2026-11-16T15:00:00+07:00');
  assert.equal(s.run_time_min, 388);

  const calls = store.endpointCalls.get('OEE_SHIFT_SUMMARY') ?? [];
  const last = calls[calls.length - 1] ?? '';
  assert.ok(last.includes('date=2026-11-16'), last);
  assert.ok(last.includes('shift=S1'), last);
  assert.ok(last.includes('from=2026-11-16T07%3A00%3A00%2B07%3A00'), last);
  assert.ok(last.includes('to=2026-11-16T15%3A00%3A00%2B07%3A00'), last);
});

test('Demo summary: shift S2/S3 memakai nama + jendela definisi shift itu', async () => {
  const s2 = await apiClient.getShiftSummary('CNC-MILLING-01', undefined, {
    from: '2026-11-16T15:00:00+07:00',
    to: '2026-11-16T23:00:00+07:00',
    date: '2026-11-16',
    shift: 'S2',
  });
  assert.equal(s2.shift_name, 'Shift 2 (Siang)');
  assert.equal(s2.shift_start, '2026-11-16T15:00:00+07:00');
  assert.equal(s2.shift_end, '2026-11-16T23:00:00+07:00');

  const s3 = await apiClient.getShiftSummary('CNC-MILLING-01', undefined, {
    from: '2026-11-16T00:00:00+07:00',
    to: '2026-11-16T07:00:00+07:00',
    date: '2026-11-16',
    shift: 'S3',
  });
  assert.equal(s3.shift_name, 'Shift 3 (Malam Dini)');
  assert.equal(s3.shift_start, '2026-11-16T00:00:00+07:00');
  assert.equal(s3.shift_end, '2026-11-16T07:00:00+07:00');
});

test('Demo summary: kode shift tidak dikenal kembali ke perilaku Shift 1', async () => {
  const s = await apiClient.getShiftSummary('CNC-MILLING-01', undefined, {
    from: '2026-11-16T07:00:00+07:00',
    to: '2026-11-16T15:00:00+07:00',
    date: '2026-11-16',
    shift: 'SX',
  });
  assert.equal(s.shift_name, 'Shift 1 (07:00-15:00)');
  assert.equal(s.shift_start, '2026-11-16T07:00:00+07:00');
  assert.equal(s.shift_end, '2026-11-16T15:00:00+07:00');
});

test('Demo timeline: shift S2 memproyeksikan segmen ke 15:00–23:00, Σ per state tetap terrekoniliasi', async () => {
  const segs = await apiClient.getShiftTimeline('CNC-MILLING-01', '15m', undefined, {
    from: '2026-11-16T15:00:00+07:00',
    to: '2026-11-16T23:00:00+07:00',
    date: '2026-11-16',
    shift: 'S2',
  });
  assert.equal(segs[0].start, '2026-11-16T15:00:00+07:00');
  assert.equal(segs[segs.length - 1].end, '2026-11-16T23:00:00+07:00');
  const byState = new Map<string, number>();
  for (const s of segs) byState.set(s.fsm_state, (byState.get(s.fsm_state) ?? 0) + s.duration_min);
  assert.equal(segs.reduce((acc, s) => acc + s.duration_min, 0), 480);
  assert.equal(byState.get('RUNNING'), 388);
  assert.equal(byState.get('PLANNED_DOWNTIME'), 60);
  assert.equal(byState.get('UNPLANNED_DOWNTIME'), 32);

  const calls = store.endpointCalls.get('OEE_SHIFT_TIMELINE') ?? [];
  const last = calls[calls.length - 1] ?? '';
  assert.ok(last.includes('date=2026-11-16'), last);
  assert.ok(last.includes('shift=S2'), last);
});

test('Demo timeline: shift S3 (420 mnt) memotong 60 mnt terakhir seed — jendela 00:00–07:00', async () => {
  const segs = await apiClient.getShiftTimeline('CNC-MILLING-01', '15m', undefined, {
    from: '2026-11-16T00:00:00+07:00',
    to: '2026-11-16T07:00:00+07:00',
    date: '2026-11-16',
    shift: 'S3',
  });
  assert.equal(segs[0].start, '2026-11-16T00:00:00+07:00');
  assert.equal(segs[segs.length - 1].end, '2026-11-16T07:00:00+07:00');
  assert.equal(segs.reduce((acc, s) => acc + s.duration_min, 0), 420);
});

test('Demo timeline: shift terpilih tanpa from/to tetap memproyeksikan segmen', async () => {
  const segs = await apiClient.getShiftTimeline('CNC-MILLING-01', '15m', undefined, {
    date: '2026-11-16',
    shift: 'S2',
  });
  assert.equal(segs[0].start, '2026-11-16T15:00:00+07:00');
  assert.equal(segs[segs.length - 1].end, '2026-11-16T23:00:00+07:00');
  assert.equal(segs.length, 33);
});

test('Demo hourly: shift S2 memproyeksikan bucket ke 15:00–22:00', async () => {
  const points = await apiClient.getHourlyTrend('STM32-OEE-01', undefined, {
    from: '2026-11-16T15:00:00+07:00',
    to: '2026-11-16T23:00:00+07:00',
    date: '2026-11-16',
    shift: 'S2',
  });
  assert.deepEqual(
    points.map((p) => p.hour),
    ['15:00', '16:00', '17:00', '18:00', '19:00', '20:00', '21:00', '22:00']
  );
  // Nilai seed ikut bergeser bersama bucketnya (bucket 15:00 = seed 07:00).
  assert.equal(points[0].oee, 80.5);
  assert.equal(points[0].hourly_run_sec, 3250);
});

test('Demo hourly: shift S3 memproyeksikan bucket ke 00:00–06:00 (7 bucket)', async () => {
  const points = await apiClient.getHourlyTrend('STM32-OEE-01', undefined, {
    from: '2026-11-16T00:00:00+07:00',
    to: '2026-11-16T07:00:00+07:00',
    date: '2026-11-16',
    shift: 'S3',
  });
  assert.deepEqual(
    points.map((p) => p.hour),
    ['00:00', '01:00', '02:00', '03:00', '04:00', '05:00', '06:00']
  );
});

test('Demo getOeeHourly: from/to kini diteruskan (sebelumnya diabaikan) + shift memproyeksikan bucket', async () => {
  // Tanpa shift: rentang 09:00–12:00 hanya mengembalikan 4 bucket itu.
  const ranged = await apiClient.getOeeHourly({
    machine_id: 'CNC-MILLING-01',
    from: '2026-11-11T09:00:00+07:00',
    to: '2026-11-11T12:00:00+07:00',
  });
  assert.deepEqual(
    ranged.map((p) => p.hour),
    ['09:00', '10:00', '11:00', '12:00']
  );

  // Dengan shift S2: bucket 15:00–22:00.
  const shifted = await apiClient.getOeeHourly({
    machine_id: 'CNC-MILLING-01',
    from: '2026-11-16T15:00:00+07:00',
    to: '2026-11-16T23:00:00+07:00',
    date: '2026-11-16',
    shift: 'S2',
  });
  assert.deepEqual(
    shifted.map((p) => p.hour),
    ['15:00', '16:00', '17:00', '18:00', '19:00', '20:00', '21:00', '22:00']
  );

  // Tanpa options: tetap 8 bucket Shift 1 seperti sebelumnya.
  const plain = await apiClient.getOeeHourly({ machine_id: 'CNC-MILLING-01' });
  assert.equal(plain.length, 8);
  assert.equal(plain[0].hour, '07:00');
});

test('HTTP transport: getShiftSummary & getShiftTimeline mengirim date/shift; getOeeHourly tidak', async () => {
  process.env.VITE_API_URL = 'http://localhost:3005/api/v1';
  const seenUrls: string[] = [];

  const server = http.createServer((req, res) => {
    const url = new URL(req.url ?? '/', 'http://localhost:3005');
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
        window: { from: '2026-11-16T07:00:00+07:00', to: '2026-11-16T15:00:00+07:00', tz: 'Asia/Jakarta' },
        total_count: 350,
        good_count: 342,
        reject_count: 8,
        target_per_hour: 64,
      });
      return;
    }
    if (req.method === 'GET' && url.pathname === '/api/v1/oee/shift-timeline') {
      json(200, [
        { start: '2026-11-16T07:00:00+07:00', end: '2026-11-16T09:15:00+07:00', state: 'RUNNING', planned: false },
        { start: '2026-11-16T09:15:00+07:00', end: '2026-11-16T09:30:00+07:00', state: 'UNPLANNED_DOWNTIME', planned: false, downtime_id: 'dt-ev-02' },
      ]);
      return;
    }
    if (req.method === 'GET' && url.pathname === '/api/v1/oee/hourly') {
      json(200, [
        { hour: '15:00', oee: 80.5, availability: 90.3, performance: 91.0, quality: 98.0 },
        { hour: '16:00', oee: 84.6, availability: 92.4, performance: 94.1, quality: 97.4 },
      ]);
      return;
    }
    json(404, { error: 'NOT_FOUND', message: `Rute stub tidak dikenal: ${url.pathname}` });
  });
  await new Promise<void>((resolve) => server.listen(3005, resolve));
  try {
    await httpApiClient.login('ADM-001', 'Admin@2026!');

    const summary = await httpApiClient.getShiftSummary('CNC-MILLING-01', undefined, {
      from: '2026-11-16T07:00:00+07:00',
      to: '2026-11-16T15:00:00+07:00',
      date: '2026-11-16',
      shift: 'S1',
    });
    assert.equal(summary.oee, 84.6);
    const summaryUrl = new URL(seenUrls.find((u) => u.includes('/oee/shift-summary')) ?? '', 'http://localhost:3005');
    assert.equal(summaryUrl.searchParams.get('from'), '2026-11-16T07:00:00+07:00');
    assert.equal(summaryUrl.searchParams.get('to'), '2026-11-16T15:00:00+07:00');
    assert.equal(summaryUrl.searchParams.get('date'), '2026-11-16');
    assert.equal(summaryUrl.searchParams.get('shift'), 'S1');

    const timeline = await httpApiClient.getShiftTimeline('CNC-MILLING-01', '15m', undefined, {
      from: '2026-11-16T07:00:00+07:00',
      to: '2026-11-16T15:00:00+07:00',
      date: '2026-11-16',
      shift: 'S1',
    });
    assert.equal(timeline.length, 2);
    const timelineUrl = new URL(seenUrls.find((u) => u.includes('/oee/shift-timeline')) ?? '', 'http://localhost:3005');
    assert.equal(timelineUrl.searchParams.get('date'), '2026-11-16');
    assert.equal(timelineUrl.searchParams.get('shift'), 'S1');

    // /oee/hourly: from/to dikirim, date/shift TIDAK (bukan bagian kontrak §I).
    const hourly = await httpApiClient.getOeeHourly({
      machine_id: 'CNC-MILLING-01',
      from: '2026-11-16T15:00:00+07:00',
      to: '2026-11-16T23:00:00+07:00',
      date: '2026-11-16',
      shift: 'S2',
    });
    assert.equal(hourly.length, 2);
    const hourlyUrl = new URL(seenUrls.find((u) => u.includes('/oee/hourly')) ?? '', 'http://localhost:3005');
    assert.equal(hourlyUrl.searchParams.get('from'), '2026-11-16T15:00:00+07:00');
    assert.equal(hourlyUrl.searchParams.get('to'), '2026-11-16T23:00:00+07:00');
    assert.equal(hourlyUrl.searchParams.has('date'), false);
    assert.equal(hourlyUrl.searchParams.has('shift'), false);

    // Tanpa options: tidak ada query date/shift/from/to yang terkirim.
    seenUrls.length = 0;
    await httpApiClient.getShiftSummary('CNC-MILLING-01');
    const plainSummaryUrl = new URL(seenUrls.find((u) => u.includes('/oee/shift-summary')) ?? '', 'http://localhost:3005');
    assert.equal(plainSummaryUrl.searchParams.has('date'), false);
    assert.equal(plainSummaryUrl.searchParams.has('shift'), false);
    assert.equal(plainSummaryUrl.searchParams.has('from'), false);
    assert.equal(plainSummaryUrl.searchParams.has('to'), false);
  } finally {
    httpApiClient.setSessionActive(false, null);
    await new Promise<void>((resolve) => server.close(() => resolve()));
  }
});
