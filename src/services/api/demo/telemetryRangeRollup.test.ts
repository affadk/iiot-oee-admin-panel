// E32.2 (FAT-283): dipecah dari telemetryRange.test.ts — E11 T11.3
// (rollup OEE per machine_id, demo + transport HTTP).
// Stub port 3004 (segar per file). Kode sumber tidak diubah.
import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { apiClient, store } from '../client';
import { httpApiClient } from '../httpClient';

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
    await new Promise<void>((resolve) => { server.closeAllConnections(); server.close(() => resolve()); });
  }
});
