// E32.2 (FAT-283): dipecah dari telemetryRange.test.ts — E11 T11.2
// (shift summary + shift timeline: from/to, demo + transport HTTP).
// Stub port 3003 (segar per file). Kode sumber tidak diubah.
import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { apiClient, store } from '../client';
import { httpApiClient } from '../httpClient';

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
    await new Promise<void>((resolve) => { server.closeAllConnections(); server.close(() => resolve()); });
  }
});
