import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { resolveDefaultDeviceId } from '../../features/shared/defaultDevice';
import { TableStateRow, EmptyStateBlock } from '../../features/shared/TableStateRow';
import { ShiftFilterBar } from '../../features/analytics/components/ShiftFilterBar';
import { BackendHealthIndicator } from '../../features/auth/BackendHealthIndicator';
import { stripDowntimeCategoryPrefix } from '../../features/monitoring/DowntimeReasonModal';
import { formatWorkOrderSubline } from '../../features/shared/historyFilters';
import { formatCycleTemp } from '../../features/analytics/components/TelemetryRawColumns';
import { DeviceTable } from '../../features/assets/components/DeviceTable';
import { OperatorsTable } from '../../features/production/components/OperatorsTable';
import { mapTimelineSegment } from './http/mappers/monitoring';
import { resolveActiveTimelineSegment } from '../../features/analytics/hooks/oeeTimelineSelection';
import { httpApiClient } from './httpClient';

// ---------------------------------------------------------------------------
// E28 Batch B (FAT-170/207/219/220/221/224/225/230):
// - FAT-170 N-2: default device dari daftar live (online dulu).
// - FAT-207 N-38: indikator koneksi backend di /login (Real saja).
// - FAT-219 E2E-05: empty state pola bersama (TableStateRow).
// - FAT-220 E2E-06: peringatan shift hanya setelah query gagal.
// - FAT-221 E2E-07: rekonsiliasi memotong timeline ke jendela shift
//   (tes pemotongannya di reconciliation.test.ts, berdampingan dengan
//   tes check lama).
// - FAT-224 E2E-10: kerapian list — sub-baris WO, sel Cycle/Temp, "SN:"
//   kosong, sel LINE/SCOPE kosong (diuji render + helper murni).
// - FAT-225 E2E-11: tick sumbu ≤ 9 untuk rentang 7 hari (tes di
//   timelineAxis.test.ts) + downtime_id numerik dipetakan ke string.
// - FAT-230 MUT-04: prefix "[KATEGORI] " dibuang + restore mengirim
//   OTHER + teks asli tanpa prefix (stub HTTP port FRESH 3032 —
//   3001-3023, 3031 sudah terpakai tes lain).
// ---------------------------------------------------------------------------

const PORT = 3032;

// --- FAT-170: resolveDefaultDeviceId ----------------------------------------

test('E28 Batch B (FAT-170): default device = online pertama, lalu pertama, lalu undefined', () => {
  assert.equal(
    resolveDefaultDeviceId([
      { device_id: 'STM32-OEE-01', online: false },
      { device_id: 'STM32-OEE-SIM', online: true },
    ]),
    'STM32-OEE-SIM'
  );
  assert.equal(
    resolveDefaultDeviceId([
      { device_id: 'STM32-OEE-01', online: false },
      { device_id: 'STM32-OEE-02', online: false },
    ]),
    'STM32-OEE-01'
  );
  assert.equal(resolveDefaultDeviceId([]), undefined);
  assert.equal(resolveDefaultDeviceId(null), undefined);
  // Demo seed: STM32-OEE-01 online di urutan pertama → default demo tetap.
  assert.equal(
    resolveDefaultDeviceId([
      { device_id: 'STM32-OEE-01', online: true },
      { device_id: 'STM32-OEE-02', online: true },
    ]),
    'STM32-OEE-01'
  );
});

// --- FAT-219: TableStateRow / EmptyStateBlock --------------------------------

test('E28 Batch B (FAT-219): TableStateRow empty menampilkan judul + deskripsi, loading menampilkan skeleton', () => {
  const empty = renderToStaticMarkup(
    React.createElement(TableStateRow, {
      isLoading: false,
      isError: false,
      colSpan: 5,
      emptyTitle: 'Belum ada produk',
      emptyDescription: 'Tambah produk pertama.',
    })
  );
  assert.match(empty, /Belum ada produk/);
  assert.match(empty, /Tambah produk pertama/);

  const loading = renderToStaticMarkup(
    React.createElement(TableStateRow, { isLoading: true, isError: false, colSpan: 5 })
  );
  assert.match(loading, /Memuat data/);
  assert.doesNotMatch(loading, /Belum ada produk/);

  const block = renderToStaticMarkup(
    React.createElement(EmptyStateBlock, {
      emptyTitle: 'Belum ada job rekonsiliasi',
      emptyDescription: 'Job dibuat oleh backend.',
    })
  );
  assert.match(block, /Belum ada job rekonsiliasi/);
  assert.match(block, /Job dibuat oleh backend/);
});

// --- FAT-220: ShiftFilterBar --------------------------------------------------

function renderShiftBar(props: {
  shiftsLoading?: boolean;
  shiftsError?: boolean;
}): string {
  return renderToStaticMarkup(
    React.createElement(ShiftFilterBar, {
      shifts: [],
      shiftsLoading: props.shiftsLoading ?? false,
      shiftsError: props.shiftsError ?? false,
      onFilterChange: () => {},
    })
  );
}

test('E28 Batch B (FAT-220): saat loading tampil "Memuat…", TANPA peringatan tidak tersedia', () => {
  const html = renderShiftBar({ shiftsLoading: true });
  assert.match(html, /Memuat daftar shift/);
  assert.doesNotMatch(html, /tidak tersedia/);
});

test('E28 Batch B (FAT-220): peringatan hanya bila query shift benar-benar gagal', () => {
  const failed = renderShiftBar({ shiftsError: true });
  assert.match(failed, /Daftar shift tidak tersedia/);

  const emptyOk = renderShiftBar({});
  assert.match(emptyOk, /Belum ada shift aktif/);
  assert.doesNotMatch(emptyOk, /tidak tersedia/);
});

// --- FAT-207: BackendHealthIndicator ------------------------------------------

test('E28 Batch B (FAT-207): Demo mode → indikator tidak dirender sama sekali', () => {
  const prev = process.env.VITE_API_MODE;
  process.env.VITE_API_MODE = 'demo';
  try {
    const html = renderToStaticMarkup(React.createElement(BackendHealthIndicator));
    assert.equal(html, '');
  } finally {
    if (prev === undefined) delete process.env.VITE_API_MODE;
    else process.env.VITE_API_MODE = prev;
  }
});

test('E28 Batch B (FAT-207): Real mode → status awal "Memeriksa koneksi backend…" (ping jalan di useEffect, bukan SSR)', () => {
  const prev = process.env.VITE_API_MODE;
  process.env.VITE_API_MODE = 'real';
  try {
    const html = renderToStaticMarkup(React.createElement(BackendHealthIndicator));
    assert.match(html, /Memeriksa koneksi backend/);
    assert.match(html, /Periksa lagi/);
    assert.doesNotMatch(html, /Backend terhubung/);
  } finally {
    if (prev === undefined) delete process.env.VITE_API_MODE;
    else process.env.VITE_API_MODE = prev;
  }
});

// --- FAT-224: kerapian list --------------------------------------------------

test('E28 Batch B (FAT-224): sub-baris WO — duplikat order_number + shift kosong tidak dirender', () => {
  assert.equal(
    formatWorkOrderSubline({ wo_id: 'WO-1', order_number: 'WO-1', shift_name: '' }),
    '—'
  );
  assert.equal(
    formatWorkOrderSubline({ wo_id: 'WO-1', order_number: 'ORD-9', shift_name: '' }),
    'ORD-9'
  );
  assert.equal(
    formatWorkOrderSubline({ wo_id: 'WO-1', order_number: 'WO-1', shift_name: 'Shift 1' }),
    'Shift 1'
  );
  assert.equal(
    formatWorkOrderSubline({ wo_id: 'WO-1', order_number: 'ORD-9', shift_name: 'Shift 1' }),
    'ORD-9 · Shift 1'
  );
});

test('E28 Batch B (FAT-224): sel Cycle/Temp — tanpa suhu/cycle tampil "—", bukan "0.0s · -°C"', () => {
  assert.equal(formatCycleTemp({ cycle_time_ms: 0 }), '—');
  assert.equal(formatCycleTemp({ lastCycleTimeSec: null, cycle_time_ms: 0 }), '—');
  assert.equal(formatCycleTemp({ lastCycleTimeSec: 5.25, cycle_time_ms: 0, temperature_c: 42 }), '5.3s · 42°C');
  assert.equal(formatCycleTemp({ cycle_time_ms: 5200 }), '5.2s');
  assert.equal(formatCycleTemp({ cycle_time_ms: 0, temperature_c: 38 }), '38°C');
});

test('E28 Batch B (FAT-224): DeviceTable tanpa serial tidak merender "SN:"', () => {
  const html = renderToStaticMarkup(
    React.createElement(DeviceTable, {
      devices: [
        {
          device_id: 'STM32-OEE-SIM',
          mac_address: '00:08:DC:55:00:02',
          ip_address: '192.168.10.102',
          firmware_version: 'v2.4.1',
          online: true,
          last_seen: null,
          bound_machine_id: null,
          created_at: '2026-01-10T08:00:00Z',
        },
      ],
      isLoading: false,
      checkCapability: () => ({ state: 'allowed' as const, canInteract: true }),
      onDetail: () => {},
      onHealth: () => {},
      onEdit: () => {},
      onDelete: () => {},
    })
  );
  assert.match(html, /STM32-OEE-SIM/);
  assert.doesNotMatch(html, /SN:/);
});

test('E28 Batch B (FAT-224): OperatorsTable ADM-001 tanpa line menampilkan "—" di sel Line/Scope', () => {
  const html = renderToStaticMarkup(
    React.createElement(OperatorsTable, {
      operators: [
        {
          operator_id: 'ADM-001',
          name: 'Alexandria Vance',
          role: 'ADMIN',
          line_id: '' as unknown as string,
          is_active: true,
          created_at: '2026-01-10T08:00:00Z',
        },
      ],
      assignments: [],
      isLoading: false,
      currentUserRole: 'ADMIN',
      togglingId: null,
      checkCapability: () => ({ canInteract: true }),
      onDetail: () => {},
      onToggle: () => {},
      onEdit: () => {},
      onRotatePwd: () => {},
      onDelete: () => {},
    })
  );
  assert.match(html, /ADM-001/);
  assert.match(html, /—/);
});

// --- FAT-225: downtime_id numerik ----------------------------------------------

test('E28 Batch B (FAT-225): mapTimelineSegment mengubah downtime_id numerik menjadi string', () => {
  const seg = mapTimelineSegment({
    start: '2026-11-19T13:55:00+07:00',
    end: '2026-11-19T14:55:00+07:00',
    state: 'UNPLANNED_DOWNTIME',
    planned: false,
    downtime_id: 2,
    duration_min: 60,
  });
  assert.equal(seg.downtime_id, '2');
  assert.equal(typeof seg.downtime_id, 'string');

  const noId = mapTimelineSegment({
    start: '2026-11-19T13:00:00+07:00',
    end: '2026-11-19T13:55:00+07:00',
    state: 'RUNNING',
    planned: false,
    duration_min: 55,
  });
  assert.equal(noId.downtime_id, null);
});

test('E28 Batch B (FAT-225): segmen downtime_id numerik cocok dengan peta overlay string', () => {
  const matched = {
    id: '2',
    device_id: 'STM32-OEE-01',
    machine_id: 'CNC-MILLING-01',
    machine_name: 'CNC Milling 01',
    started_at: '2026-11-19T13:55:00+07:00',
    ended_at: '2026-11-19T14:55:00+07:00',
    duration_seconds: 3600,
    category: 'UNKNOWN' as const,
    reason: 'Equipment failure',
    is_labeled: false,
    created_at: '2026-11-19T13:55:00+07:00',
  };
  const map = new Map([['2', matched]]);
  const res = resolveActiveTimelineSegment(
    [
      {
        start: '2026-11-19T13:55:00+07:00',
        end: '2026-11-19T14:55:00+07:00',
        fsm_state: 'UNPLANNED_DOWNTIME',
        // Server lama mengirim number — dinormalisasi String() di selector.
        downtime_id: 2 as unknown as string,
        duration_min: 60,
      },
    ],
    null,
    map
  );
  assert.equal(res.matchedDowntime?.id, '2');
});

// --- FAT-230: strip prefix + kirim restore --------------------------------------

test('E28 Batch B (FAT-230): stripDowntimeCategoryPrefix membuang "[KATEGORI] " di awal saja', () => {
  assert.equal(stripDowntimeCategoryPrefix('[EQUIPMENT_FAILURE] Equipment failure'), 'Equipment failure');
  assert.equal(stripDowntimeCategoryPrefix('Equipment failure'), 'Equipment failure');
  assert.equal(stripDowntimeCategoryPrefix('Tekanan [HIDROLIK] drop'), 'Tekanan [HIDROLIK] drop');
  assert.equal(stripDowntimeCategoryPrefix(''), '');
});

// Stub HTTP untuk POST /downtime-events/:id/reason (port 3032).
interface Captured {
  method: string;
  path: string;
  body: Record<string, unknown> | null;
}

const captured: Captured[] = [];

async function readBody(req: http.IncomingMessage): Promise<Record<string, unknown> | null> {
  const chunks: Buffer[] = [];
  for await (const chunk of req) chunks.push(chunk as Buffer);
  const text = Buffer.concat(chunks).toString('utf8');
  if (!text) return null;
  try {
    return JSON.parse(text) as Record<string, unknown>;
  } catch {
    return null;
  }
}

function startStub(): Promise<http.Server> {
  const server = http.createServer(async (req, res) => {
    const url = new URL(req.url ?? '/', `http://localhost:${PORT}`);
    const body = req.method === 'GET' ? null : await readBody(req);
    captured.push({ method: req.method ?? '', path: url.pathname, body });
    const json = (status: number, payload: unknown) => {
      res.writeHead(status, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(payload));
    };
    if (req.method === 'POST' && url.pathname === '/api/v1/downtime-events/42/reason') {
      json(200, {
        success: true,
        eventId: '42',
        deviceId: 'STM32-OEE-01',
        operatorReason: body?.reason ?? null,
        isOverwrite: true,
        operator: { id: 'ADM-001', username: 'Alexandria Vance' },
      });
      return;
    }
    json(404, { error: 'NOT_FOUND', message: `Rute stub tidak dikenal: ${url.pathname}` });
  });
  return new Promise((resolve) => {
    server.listen(PORT, () => resolve(server));
  });
}

async function withStub<T>(fn: () => Promise<T>): Promise<T> {
  const prevApiUrl = process.env.VITE_API_URL;
  process.env.VITE_API_URL = `http://localhost:${PORT}/api/v1`;
  const server = await startStub();
  captured.length = 0;
  httpApiClient.setNetworkMode('LAN');
  httpApiClient.setSessionActive(true, 'stub-jwt');
  try {
    return await fn();
  } finally {
    httpApiClient.setSessionActive(false, null);
    if (prevApiUrl === undefined) delete process.env.VITE_API_URL;
    else process.env.VITE_API_URL = prevApiUrl;
    await new Promise<void>((resolve) => server.close(() => resolve()));
  }
}

test('E28 Batch B (FAT-230): restore "Belum dikategorikan" mengirim OTHER + teks asli tanpa prefix', async () => {
  await withStub(async () => {
    const rawReason = stripDowntimeCategoryPrefix('[EQUIPMENT_FAILURE] Equipment failure');
    const res = await httpApiClient.classifyDowntimeReason('42', 'OTHER', rawReason);
    assert.equal(res.operatorReason, 'Equipment failure');
    const hit = [...captured].reverse().find((c) => c.path === '/api/v1/downtime-events/42/reason');
    assert.ok(hit, 'POST /reason terkirim');
    assert.deepEqual(hit?.body, { category: 'OTHER', reason: 'Equipment failure' });
    assert.doesNotMatch(JSON.stringify(hit?.body), /EQUIPMENT_FAILURE\]|Belum dikategorikan/);
  });
});
