import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { httpApiClient } from './httpClient';

// ---------------------------------------------------------------------------
// E23 Batch 2 (FAT-183–FAT-191, N-14–N-22 Medium 1): perbaikan frontend
// terhadap spec live `~/workspace/oee-live-openapi.json` (141 operasi).
// Setiap stub mengembalikan BENTUK SPEC LIVE (bukan bentuk api_docs lama);
// setiap test meng-assert mapper/transport/UI berperilaku benar terhadap
// bentuk itu.
//
// Port 3024–3033: 3001–3023 sudah dipakai stub lain (undici keep-alive
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

const MACHINE_BODY = (lineId: string | null) => ({
  machineId: 'CNC-MILLING-03',
  machineName: 'Mazak 5-Axis Milling C',
  lineId,
  modbusSlaveId: 1,
  deviceId: null,
  createdAt: '2026-11-19T10:00:00.000Z',
});

test('E23 N-14 (FAT-183): createMachine mengirim lineId; respons dipetakan ke line_id (spec live)', async () => {
  await withStub(3024, (_req, url) => {
    if (url.pathname === '/api/v1/machines') {
      return { status: 201, payload: MACHINE_BODY('LINE-02') };
    }
    return null;
  }, async (seen) => {
    const created = await httpApiClient.createMachine({
      machine_id: 'CNC-MILLING-03',
      name: 'Mazak 5-Axis Milling C',
      modbus_slave_id: 1,
      line_id: 'LINE-02',
    });
    assert.equal(created.line_id, 'LINE-02');
    const post = seen.find((s) => s.method === 'POST' && s.path === '/api/v1/machines');
    assert.deepEqual(post?.body, {
      machineId: 'CNC-MILLING-03',
      machineName: 'Mazak 5-Axis Milling C',
      modbusSlaveId: 1,
      lineId: 'LINE-02',
    });
  });
});

test('E23 N-14 (FAT-183): create tanpa lini meng-omit lineId (default server LINE-01); update bisa pindah lini', async () => {
  await withStub(3025, (_req, url, body) => {
    if (url.pathname === '/api/v1/machines' && _req.method === 'POST') {
      return { status: 201, payload: MACHINE_BODY('LINE-01') };
    }
    if (url.pathname === '/api/v1/machines/CNC-MILLING-03' && _req.method === 'PUT') {
      const b = (body ?? {}) as Record<string, unknown>;
      return { status: 200, payload: MACHINE_BODY(typeof b.lineId === 'string' ? b.lineId : null) };
    }
    return null;
  }, async (seen) => {
    const created = await httpApiClient.createMachine({
      machine_id: 'CNC-MILLING-03',
      name: 'Mazak 5-Axis Milling C',
    });
    assert.equal(created.line_id, 'LINE-01');
    const post = seen.find((s) => s.method === 'POST' && s.path === '/api/v1/machines');
    assert.equal((post?.body as Record<string, unknown>).lineId, undefined);
    assert.equal('lineId' in ((post?.body ?? {}) as Record<string, unknown>), false);

    const updated = await httpApiClient.updateMachine('CNC-MILLING-03', { line_id: 'LINE-03' });
    assert.equal(updated.line_id, 'LINE-03');
    const put = seen.find((s) => s.method === 'PUT' && s.path === '/api/v1/machines/CNC-MILLING-03');
    assert.deepEqual(put?.body, { lineId: 'LINE-03' });
  });
});

const DEVICE_BODY = (ip: string | null, fw: string | null) => ({
  deviceId: 'STM32-OEE-01',
  macAddress: '00:08:DC:55:01:0A',
  ipAddress: ip,
  firmwareVersion: fw,
  isOnline: true,
  lastSeenAt: '2026-11-19T10:00:00.000Z',
  createdAt: '2026-11-01T00:00:00.000Z',
});

test('E23 N-15 (FAT-184): PUT device meng-omit IP/firmware yang dikosongkan (jangan kirim null)', async () => {
  await withStub(3026, (_req, url) => {
    if (url.pathname === '/api/v1/devices/STM32-OEE-01' && _req.method === 'PUT') {
      return { status: 200, payload: DEVICE_BODY(null, null) };
    }
    return null;
  }, async (seen) => {
    const cleared = await httpApiClient.updateDevice('STM32-OEE-01', {
      ip_address: null,
      firmware_version: null,
    });
    assert.equal(cleared.ip_address, null);
    const put = seen.find((s) => s.method === 'PUT' && s.path === '/api/v1/devices/STM32-OEE-01');
    assert.deepEqual(put?.body, {});
    assert.equal('ipAddress' in ((put?.body ?? {}) as Record<string, unknown>), false);
    assert.equal('firmwareVersion' in ((put?.body ?? {}) as Record<string, unknown>), false);
  });
});

test('E23 N-15 (FAT-184): PUT device mengirim IP yang diisi, firmware kosong tetap di-omit', async () => {
  await withStub(3027, (_req, url) => {
    if (url.pathname === '/api/v1/devices/STM32-OEE-01' && _req.method === 'PUT') {
      return { status: 200, payload: DEVICE_BODY('192.168.1.20', null) };
    }
    return null;
  }, async (seen) => {
    const updated = await httpApiClient.updateDevice('STM32-OEE-01', {
      ip_address: '192.168.1.20',
      firmware_version: '',
    });
    assert.equal(updated.ip_address, '192.168.1.20');
    const put = seen.find((s) => s.method === 'PUT' && s.path === '/api/v1/devices/STM32-OEE-01');
    assert.deepEqual(put?.body, { ipAddress: '192.168.1.20' });
  });
});

const SHIFT_LIST = {
  data: [
    { shiftId: 'PAGI', shiftName: 'Shift Pagi', shiftCode: 'PAGI', startTime: '07:00:00', endTime: '15:00:00', isActive: true, createdAt: '2026-11-01T00:00:00.000Z' },
    { shiftId: 'SORE', shiftName: 'Shift Sore', shiftCode: 'SORE', startTime: '15:00', endTime: '23:00', isActive: true, createdAt: '2026-11-01T00:00:00.000Z' },
    // Nilai aneh: tidak boleh menggagalkan seluruh list (N-16).
    { shiftId: 'MALAM', shiftName: 'Shift Malam', shiftCode: 'MALAM', startTime: 'pukul dua belas', endTime: '07:00:00', isActive: true, createdAt: '2026-11-01T00:00:00.000Z' },
  ],
  meta: { limit: 100, hasMore: false, nextCursor: null, count: 3 },
};

test('E23 N-16 (FAT-185): shift startTime 07:00:00 dinormalisasi ke HH:MM; satu nilai aneh tidak menggagalkan list', async () => {
  await withStub(3028, (_req, url) => {
    if (url.pathname === '/api/v1/shifts') return { status: 200, payload: SHIFT_LIST };
    return null;
  }, async () => {
    const page = await httpApiClient.getShiftsPage({ limit: 100, envelope: true });
    assert.equal(page.data.length, 3);
    assert.equal(page.data[0].startTime, '07:00');
    assert.equal(page.data[0].endTime, '15:00');
    assert.equal(page.data[1].startTime, '15:00');
    assert.equal(page.data[1].endTime, '23:00');
    // Nilai tak dikenal diteruskan mentah, bukan melempar INVALID_RESPONSE.
    assert.equal(page.data[2].startTime, 'pukul dua belas');
    assert.equal(page.data[2].endTime, '07:00');
  });
});

const SCHEDULE_LIST = {
  data: [
    { scheduleId: 'sched-1', lineId: 'LINE-01', shiftId: 'PAGI', dayOfWeek: 0, isActive: true, createdAt: '2026-11-01T00:00:00.000Z' },
    { scheduleId: 'sched-2', lineId: 'LINE-01', shiftId: 'PAGI', dayOfWeek: 3, isActive: true, createdAt: '2026-11-01T00:00:00.000Z' },
  ],
  meta: { limit: 100, hasMore: false, nextCursor: null, count: 2 },
};

test('E23 N-17 (FAT-186): shift-schedule dayOfWeek 0 (Minggu, konvensi 0..6) dinormalisasi ke 7', async () => {
  await withStub(3029, (_req, url) => {
    if (url.pathname === '/api/v1/shift-schedules') return { status: 200, payload: SCHEDULE_LIST };
    return null;
  }, async () => {
    const page = await httpApiClient.getShiftSchedulesPage({ limit: 100, envelope: true });
    assert.equal(page.data.length, 2);
    // 0 (Minggu) → 7 agar label hari (1=Senin..7=Minggu) benar.
    assert.equal(page.data[0].dayOfWeek, 7);
    assert.equal(page.data[1].dayOfWeek, 3);
  });
});

test('E23 N-18 (FAT-187): PATCH shift-schedule hanya mengirim shiftId/dayOfWeek/isActive (tanpa lineId)', async () => {
  await withStub(3030, (_req, url) => {
    if (url.pathname === '/api/v1/shift-schedules/sched-1') {
      return {
        status: 200,
        payload: { scheduleId: 'sched-1', lineId: 'LINE-01', shiftId: 'SORE', dayOfWeek: 6, isActive: true, createdAt: '2026-11-01T00:00:00.000Z' },
      };
    }
    return null;
  }, async (seen) => {
    const updated = await httpApiClient.updateShiftSchedule('sched-1', {
      shiftId: 'SORE',
      dayOfWeek: 6,
      isActive: true,
    });
    assert.equal(updated.shiftId, 'SORE');
    assert.equal(updated.dayOfWeek, 6);
    assert.equal(updated.lineId, 'LINE-01');
    const patch = seen.find((s) => s.method === 'PATCH' && s.path === '/api/v1/shift-schedules/sched-1');
    assert.deepEqual(patch?.body, { shiftId: 'SORE', dayOfWeek: 6, isActive: true });
    assert.equal('lineId' in ((patch?.body ?? {}) as Record<string, unknown>), false);
  });
});

const WO_LIST = {
  data: [
    { woId: 'WO-2026-101', orderNumber: 'ORD-101', status: 'ACTIVE', machineId: 'CNC-MILLING-01', plannedStart: '2026-11-11T07:00:00+07:00' },
    { woId: 'WO-2026-102', orderNumber: 'ORD-102', status: 'PENDING', machineId: 'CNC-MILLING-01', plannedStart: '2026-11-11T07:00:00+07:00' },
    { woId: 'WO-2026-201', orderNumber: 'ORD-201', status: 'COMPLETED', machineId: 'CNC-MILLING-02', plannedStart: '2026-11-10T07:00:00+07:00' },
  ],
  meta: { limit: 50, hasMore: false, nextCursor: null, count: 3 },
};

test('E23 N-19 (FAT-188): filter WO ID tidak dikirim ke server (tanpa wo_id); diterapkan client-side', async () => {
  await withStub(3031, (_req, url) => {
    if (url.pathname === '/api/v1/work-orders') return { status: 200, payload: WO_LIST };
    return null;
  }, async (seen) => {
    const page = await httpApiClient.getWorkOrdersPage({ wo_id: '101', limit: 50, envelope: true });
    assert.equal(page.data.length, 1);
    assert.equal(page.data[0].wo_id, 'WO-2026-101');
    const get = seen.find((s) => s.method === 'GET' && s.path === '/api/v1/work-orders');
    assert.ok(get);
    assert.equal(get.url.includes('wo_id'), false);
  });
});

test('E23 N-19 (FAT-188): tanpa filter WO ID, list dikembalikan utuh', async () => {
  await withStub(3032, (_req, url) => {
    if (url.pathname === '/api/v1/work-orders') return { status: 200, payload: WO_LIST };
    return null;
  }, async () => {
    const page = await httpApiClient.getWorkOrdersPage({ limit: 50, envelope: true });
    assert.equal(page.data.length, 3);
  });
});

const HEALTH_DETAIL_SPEC = {
  measuredAt: '2026-11-19T10:00:00.000Z',
  application: { status: 'UP', name: 'iiot-oee-backend', version: '1.0.0', environment: 'production', commit: null, uptimeSeconds: 12345, measuredAt: '2026-11-19T10:00:00.000Z' },
  database: { status: 'DEGRADED', latencyMs: 250.5, measuredAt: '2026-11-19T10:00:00.000Z' },
  mqtt: { status: 'DEGRADED', adminConnection: null, clientsCount: 4, measuredAt: '2026-11-19T10:00:00.000Z' },
  websocket: { status: 'UP', clients: 3, measuredAt: '2026-11-19T10:00:00.000Z' },
};

test('E23 N-20 (FAT-189): /health/detail DEGRADED diteruskan (bukan UNKNOWN); adminConnection null dibiarkan null', async () => {
  await withStub(3033, (_req, url) => {
    if (url.pathname === '/health/detail') return { status: 200, payload: HEALTH_DETAIL_SPEC };
    return null;
  }, async () => {
    const detail = await httpApiClient.getHealthDetail();
    assert.equal(detail.application.status, 'UP');
    assert.equal(detail.database.status, 'DEGRADED');
    assert.equal(detail.mqtt.status, 'DEGRADED');
    assert.equal(detail.mqtt.adminConnection, null);
    assert.equal(detail.websocket.status, 'UP');
  });
});

test('E23 N-20 (FAT-189): /health/detail adminConnection objek tetap dipetakan', async () => {
  await withStub(3034, (_req, url) => {
    if (url.pathname === '/health/detail') {
      return {
        status: 200,
        payload: {
          ...HEALTH_DETAIL_SPEC,
          mqtt: {
            status: 'UP',
            adminConnection: { connected: true, pluginReady: false, lastError: 'timeout', lastConnectedAt: '2026-11-19T09:00:00.000Z' },
            clientsCount: 4,
            measuredAt: '2026-11-19T10:00:00.000Z',
          },
        },
      };
    }
    return null;
  }, async () => {
    const detail = await httpApiClient.getHealthDetail();
    assert.equal(detail.mqtt.status, 'UP');
    assert.equal(detail.mqtt.adminConnection?.connected, true);
    assert.equal(detail.mqtt.adminConnection?.pluginReady, false);
    assert.equal(detail.mqtt.adminConnection?.lastError, 'timeout');
  });
});

const TELEMETRY_HISTORY_SPEC = {
  data: [
    {
      recordedAt: '2026-11-11T07:00:00+07:00',
      deviceId: 'STM32-OEE-01',
      machineId: 'CNC-MILLING-01',
      woId: null,
      availability: '92.40',
      performance: '94.10',
      quality: '98.00',
      oee: '84.60',
      totalCount: 100,
      rejectCount: 2,
      goodCount: 98,
      actualCycleTimeSec: '1.25',
      runTimeSec: 3500,
      downtimeSec: 100,
      operatingTimeSec: 3600,
      currentState: 'RUNNING',
      uptimeSeconds: null,
      freeHeapBytes: null,
      isBuffered: false,
    },
  ],
  meta: { limit: 50, hasMore: false, nextCursor: null, count: 1 },
};

test('E23 N-21 (FAT-190): telemetry history memetakan currentState/operatingTimeSec/runTimeSec/actualCycleTimeSec (spec live)', async () => {
  await withStub(3035, (_req, url) => {
    if (url.pathname === '/api/v1/telemetry/STM32-OEE-01') return { status: 200, payload: TELEMETRY_HISTORY_SPEC };
    return null;
  }, async () => {
    const page = await httpApiClient.getTelemetryHistoryPage({
      device_id: 'STM32-OEE-01',
      from: '2026-11-11T00:00:00+07:00',
      to: '2026-11-11T08:00:00+07:00',
      limit: 50,
      envelope: true,
    });
    assert.equal(page.data.length, 1);
    const rec = page.data[0];
    assert.equal(rec.fsm_state, 'RUNNING');
    assert.equal(rec.operatingTimeSec, 3600);
    assert.equal(rec.runTimeSec, 3500);
    // actualCycleTimeSec "1.25" detik (string) → 1250 ms.
    assert.equal(rec.cycle_time_ms, 1250);
    assert.equal(rec.lastCycleTimeSec, 1.25);
  });
});

const RECON_JOBS_SPEC = [
  {
    jobId: 1,
    applicationName: 'telemetry_hourly_cagg',
    scheduleInterval: '15 minutes',
    maxRuntime: '1h',
    lastRunStartedAt: '2026-11-19T08:30:00Z',
    lastSuccessfulFinish: '2026-11-19T08:30:00Z',
    lastRunStatus: 'SUCCESS',
  },
  {
    jobId: 2,
    applicationName: 'production_daily_summary',
    scheduleInterval: '1 hour',
    maxRuntime: null,
    lastRunStartedAt: null,
    lastSuccessfulFinish: null,
    lastRunStatus: null,
  },
];

test('E23 N-22 (FAT-191): reconciliation jobs memetakan field spec live (bukan name/last_run/lastStatus kosong)', async () => {
  await withStub(3036, (_req, url) => {
    if (url.pathname === '/api/v1/telemetry/reconciliation/jobs') return { status: 200, payload: RECON_JOBS_SPEC };
    return null;
  }, async () => {
    const jobs = await httpApiClient.getReconciliationJobs();
    assert.equal(jobs.length, 2);
    assert.equal(jobs[0].job_id, '1');
    assert.equal(jobs[0].name, 'telemetry_hourly_cagg');
    assert.equal(jobs[0].view_name, 'telemetry_hourly_cagg');
    assert.equal(jobs[0].schedule_interval, '15 minutes');
    assert.equal(jobs[0].last_run, '2026-11-19T08:30:00Z');
    assert.equal(jobs[0].last_successful_finish, '2026-11-19T08:30:00Z');
    assert.equal(jobs[0].last_status, 'SUCCESS');
    // Job yang belum pernah jalan: last_run '' (bukan epoch 1970),
    // status fallback 'SUCCESS' (spec null), nama tetap terisi.
    assert.equal(jobs[1].job_id, '2');
    assert.equal(jobs[1].name, 'production_daily_summary');
    assert.equal(jobs[1].last_run, '');
    assert.equal(jobs[1].last_successful_finish, undefined);
    assert.equal(jobs[1].last_status, 'SUCCESS');
  });
});

test('E23 N-22 (FAT-191): reconciliation job FAILED diteruskan (bukan selalu SUCCESS)', async () => {
  await withStub(3037, (_req, url) => {
    if (url.pathname === '/api/v1/telemetry/reconciliation/jobs') {
      return {
        status: 200,
        payload: [
          {
            jobId: 3,
            applicationName: 'telemetry_hourly_cagg',
            scheduleInterval: '15 minutes',
            maxRuntime: null,
            lastRunStartedAt: '2026-11-19T08:15:00Z',
            lastSuccessfulFinish: '2026-11-19T08:00:00Z',
            lastRunStatus: 'FAILED',
          },
        ],
      };
    }
    return null;
  }, async () => {
    const jobs = await httpApiClient.getReconciliationJobs();
    assert.equal(jobs.length, 1);
    assert.equal(jobs[0].last_status, 'FAILED');
    assert.equal(jobs[0].last_run, '2026-11-19T08:15:00Z');
    assert.equal(jobs[0].last_successful_finish, '2026-11-19T08:00:00Z');
  });
});
