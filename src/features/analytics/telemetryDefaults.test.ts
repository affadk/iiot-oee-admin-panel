import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import {
  DEFAULT_AGGREGATE_BUCKET,
  DEFAULT_ROLLUP_GROUP_BY,
  DEFAULT_TIMELINE_BUCKET,
} from './telemetryDefaults';
import { EXPORT_TIMEOUT_MS } from '../../utils/historicalExport/constants';
import { apiClient } from '../../services/api/client';
import { httpApiClient } from '../../services/api/httpClient';

// ---------------------------------------------------------------------------
// E12 T12.18 (U-4 / FAT-65): default panel disamakan dengan dokumen (gap G15).
// Tiap default yang diubah diassert nilai barunya; tiap deviasi yang
// dipertahankan dicatat di laporan fix (bukan di sini).
// ---------------------------------------------------------------------------

test('Default UI telemetry/OEE = nilai dokumen (groupBy day, bucket 5m/5m)', () => {
  // API doc §K.3c: group_by default `day`.
  assert.equal(DEFAULT_ROLLUP_GROUP_BY, 'day');
  // Build Guide tabel endpoint §4.1: bucket aggregate default `5m`.
  assert.equal(DEFAULT_AGGREGATE_BUCKET, '5m');
  // API doc §Q.3: bucket timeline default `5m`.
  assert.equal(DEFAULT_TIMELINE_BUCKET, '5m');
});

test('Timeout ekspor klien = 120.000 ms (Guide §4.2)', () => {
  assert.equal(EXPORT_TIMEOUT_MS, 120_000);
});

test('Demo aggregate: tanpa bucket memakai default dokumen 5m', async () => {
  const agg = await apiClient.getTelemetryAggregate('STM32-OEE-01');
  assert.equal(agg.bucket, '5m');
  // Jendela default 7 hari / 5 mnt = 2.016 bucket; tanpa limit, demo
  // memotong ke 500 baris terakhir (plafon default server, API doc §K.4).
  assert.equal(agg.rows.length, 500);
  const first = Date.parse(agg.rows[0].bucket);
  const second = Date.parse(agg.rows[1].bucket);
  assert.equal(second - first, 5 * 60_000);
});

test('Demo rollup: tanpa limit memakai default dokumen 500', async () => {
  const page = await apiClient.getTelemetryRollup({
    group_by: 'day',
    from: '2026-11-04T00:00:00+07:00',
    to: '2026-11-11T00:00:00+07:00',
    envelope: true,
  });
  assert.equal(page.pagination.limit, 500);
  assert.equal(page.data.length, 7); // 04–11 Nov = 7 hari

  // Limit eksplisit tetap dihormati (bukan dipaksa 500).
  const limited = await apiClient.getTelemetryRollup({
    group_by: 'day',
    from: '2026-11-04T00:00:00+07:00',
    to: '2026-11-11T00:00:00+07:00',
    limit: 3,
    envelope: true,
  });
  assert.equal(limited.pagination.limit, 3);
  assert.equal(limited.data.length, 3);
});

test('HTTP transport: hourly tanpa limit mengirim limit default spec 72; rollup tanpa limit memakai 500', async () => {
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
        token: 'stub-token',
        expires_in: 900,
        operator: { id: 'ADM-001', username: 'Alexandria Vance', role: 'ADMIN', line_id: 'ORG-ALL' },
      });
      return;
    }
    if (req.method === 'GET' && url.pathname === '/api/v1/telemetry/STM32-OEE-01/hourly') {
      // Envelope TANPA meta.limit: pagination.limit harus jatuh ke
      // fallback transport (72, Guide tabel endpoint + API doc §E).
      json(200, { data: [], meta: {} });
      return;
    }
    if (req.method === 'GET' && url.pathname === '/api/v1/oee/hourly') {
      json(200, { data: [], meta: {} });
      return;
    }
    if (req.method === 'GET' && url.pathname === '/api/v1/telemetry/rollup') {
      json(200, { data: [], meta: {} });
      return;
    }
    json(404, { error: 'NOT_FOUND', message: `Rute stub tidak dikenal: ${url.pathname}` });
  });
  await new Promise<void>((resolve) => server.listen(3005, resolve));
  try {
    await httpApiClient.login('ADM-001', 'Admin@2026!');

    // E23 Batch 3 (FAT-192, N-23): spec live MEWAJIBKAN `limit` —
    // getHourlyTrend tanpa options mengirim limit default spec (72).
    await httpApiClient.getHourlyTrend('STM32-OEE-01');
    const hourlyUrl = new URL(
      seenUrls.find((u) => u.includes('/telemetry/STM32-OEE-01/hourly')) ?? '',
      'http://localhost:3005'
    );
    assert.equal(hourlyUrl.searchParams.get('limit'), '72');

    // getOeeHourly tanpa limit: sama — limit default spec (72) terkirim.
    await httpApiClient.getOeeHourly({ machine_id: 'CNC-MILLING-01' });
    const oeeHourlyUrl = new URL(
      seenUrls.find((u) => u.includes('/oee/hourly')) ?? '',
      'http://localhost:3005'
    );
    assert.equal(oeeHourlyUrl.searchParams.get('limit'), '72');

    // getTelemetryRollup tanpa limit: meta fallback transport = 500
    // (API doc §K.3c) — pagination dikembalikan pemanggil, jadi teramati.
    const rollup = await httpApiClient.getTelemetryRollup({
      group_by: 'day',
      from: '2026-11-04T00:00:00+07:00',
      to: '2026-11-11T00:00:00+07:00',
      envelope: true,
    });
    assert.equal(rollup.pagination.limit, 500);
    const rollupUrl = new URL(
      seenUrls.find((u) => u.includes('/telemetry/rollup')) ?? '',
      'http://localhost:3005'
    );
    assert.equal(rollupUrl.searchParams.has('limit'), false);
  } finally {
    httpApiClient.setSessionActive(false, null);
    await new Promise<void>((resolve) => server.close(() => resolve()));
  }
});
