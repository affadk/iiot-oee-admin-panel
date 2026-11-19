/**
 * E12 T12.7 (F-8 / FAT-60) — ekspor = layar + ekspor rollup.
 *
 * Memastikan kolom CSV raw/hourly/rollup bisa dipetakan 1:1 ke kolom layar
 * (TelemetryRawColumns / TelemetryHourlyColumns / TelemetryRollupColumns),
 * `limit` terkirim eksplisit pada payload ekspor, dan ekspor demo
 * menghormati limit tersebut.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { apiClient } from '../../services/api/client';
import { HourlyOeePoint, TelemetryHistoryRecord, TelemetryRollupItem } from '../../types/analytics';
import {
  TELEMETRY_HOURLY_CSV_COLUMNS,
  TELEMETRY_RAW_CSV_COLUMNS,
  TELEMETRY_ROLLUP_CSV_COLUMNS,
  formatTelemetryExportRows,
  formatTelemetryHourlyExportRows,
  formatTelemetryRollupExportRows,
  serializeExportRecords,
} from './serialization';
import { buildTelemetryExportEndpoint, buildTelemetryHourlyExportEndpoint } from './endpoints';

const RAW_RECORD: TelemetryHistoryRecord = {
  id: 'tel-STM32-OEE-01-001',
  device_id: 'STM32-OEE-01',
  timestamp: '2026-11-17T03:00:00.000Z',
  fsm_state: 'RUNNING',
  total_count: 350,
  good_count: 342,
  reject_count: 8,
  operatingTimeSec: 3600,
  runTimeSec: 3250,
  downtimeSec: 350,
  lastCycleTimeSec: 42.1,
  oee: 80.5,
  availability: 90.3,
  performance: 91,
  quality: 98,
  cycle_time_ms: 42100,
  temperature_c: 36.5,
  vibration_rms: 1.23,
  is_buffered: true,
};

test('CSV raw: kolom = kolom layar (durasi Op/Run/Down + cycle detik, tanpa id/device_id/vibration_rms)', () => {
  assert.deepEqual([...TELEMETRY_RAW_CSV_COLUMNS], [
    'timestamp',
    'fsm_state',
    'packet_mode',
    'oee',
    'availability',
    'performance',
    'quality',
    'total_count',
    'good_count',
    'reject_count',
    'operating_time_sec',
    'run_time_sec',
    'downtime_sec',
    'cycle_time_sec',
    'temperature_c',
  ]);

  const { content } = serializeExportRecords(formatTelemetryExportRows([RAW_RECORD]), 'csv', [
    ...TELEMETRY_RAW_CSV_COLUMNS,
  ]);
  const [header, row] = content.split('\n');
  assert.equal(
    header,
    'timestamp,fsm_state,packet_mode,oee,availability,performance,quality,total_count,good_count,reject_count,operating_time_sec,run_time_sec,downtime_sec,cycle_time_sec,temperature_c'
  );
  assert.equal(
    row,
    '2026-11-17T03:00:00.000Z,RUNNING,BUFFERED,80.5,90.3,91,98,350,342,8,3600,3250,350,42.1,36.5'
  );
  // Kolom layar tidak memuat id/device_id/vibration_rms — begitu pula CSV.
  assert.doesNotMatch(header, /id|device_id|vibration_rms|is_buffered|cycle_time_ms/);
});

test('CSV raw: cycle memakai lastCycleTimeSec bila ada, fallback cycle_time_ms/1000 (detik, bukan ms)', () => {
  const fallback: TelemetryHistoryRecord = {
    ...RAW_RECORD,
    lastCycleTimeSec: null,
    cycle_time_ms: 42500,
    is_buffered: false,
    operatingTimeSec: undefined,
  };
  const [row] = formatTelemetryExportRows([fallback]);
  assert.equal(row.cycle_time_sec, 42.5);
  assert.equal(row.packet_mode, 'REALTIME');
  assert.equal(row.operating_time_sec, '');
});

test('CSV hourly: kolom layar dulu, kolom tambahan berawalan extra_ (tanpa hourly_downtime_sec — E12 T12.14)', () => {
  const point: HourlyOeePoint = {
    hour: '07:00',
    bucket: '2026-11-11T07:00:00+07:00',
    oee: 80.5,
    availability: 90.3,
    performance: 91,
    quality: 98,
    parts_produced: 42,
    defect_count: 1,
    good_count: 41,
    hourly_operating_sec: 3600,
    hourly_run_sec: 3250,
    sampleCount: 60,
    targetPerHour: 50,
    state: 'RUNNING',
    planned: false,
    provisional: true,
  };
  assert.deepEqual([...TELEMETRY_HOURLY_CSV_COLUMNS], [
    'hour',
    'state',
    'oee',
    'availability',
    'performance',
    'quality',
    'parts_produced',
    'defect_count',
    'sample_count',
    'provisional',
    'extra_bucket',
    'extra_good_count',
    'extra_hourly_operating_sec',
    'extra_hourly_run_sec',
    'extra_target_per_hour',
    'extra_planned',
  ]);

  const { content } = serializeExportRecords(formatTelemetryHourlyExportRows([point]), 'csv', [
    ...TELEMETRY_HOURLY_CSV_COLUMNS,
  ]);
  const [header, row] = content.split('\n');
  // E12 T12.14 (F-10 / FAT-66): kolom downtime per jam DIHAPUS — tidak
  // boleh muncul lagi, baik sebagai kolom layar maupun `extra_`.
  assert.doesNotMatch(header, /hourly_downtime_sec/);
  const cells = row.split(',');
  assert.equal(cells[0], '07:00'); // hour
  assert.equal(cells[6], '42'); // parts_produced
  assert.equal(cells[8], '60'); // sample_count (dari sampleCount)
  assert.equal(cells[9], 'true'); // provisional
  assert.equal(cells[14], '50'); // extra_target_per_hour

  // State null -> kosong, bukan "null".
  const noState = formatTelemetryHourlyExportRows([{ ...point, state: null }])[0];
  assert.equal(noState.state, '');
});

// ---------------------------------------------------------------------------
// E12 T12.14 (F-10 / FAT-66): `hourly_downtime_sec` dihapus dari tipe, seed,
// dan CSV (gap G16). Daftar kolom + baris hasil format tidak boleh memuat
// field ini dalam bentuk apa pun — termasuk bila objek titik masih membawa
// field lama (mis. respons server usang): field itu tidak diserialisasi.
// ---------------------------------------------------------------------------

test('E12 T12.14: CSV hourly tidak lagi memuat hourly_downtime_sec (kolom maupun baris)', () => {
  assert.ok(!TELEMETRY_HOURLY_CSV_COLUMNS.includes('extra_hourly_downtime_sec' as never));
  assert.ok(
    ![...TELEMETRY_HOURLY_CSV_COLUMNS].some((c) => c.includes('downtime')),
    'tidak ada kolom downtime apa pun di CSV hourly'
  );

  const point = {
    hour: '07:00',
    oee: 80.5,
    availability: 90.3,
    performance: 91,
    quality: 98,
    parts_produced: 42,
    defect_count: 1,
    hourly_operating_sec: 3600,
    hourly_run_sec: 3250,
    // Field lama yang masih dikirim server usang — harus diabaikan.
    hourly_downtime_sec: 350,
  } as HourlyOeePoint;
  const [row] = formatTelemetryHourlyExportRows([point]);
  assert.ok(!('extra_hourly_downtime_sec' in row));
  assert.ok(!Object.keys(row).some((k) => k.includes('downtime')));
  const { content } = serializeExportRecords(formatTelemetryHourlyExportRows([point]), 'csv', [
    ...TELEMETRY_HOURLY_CSV_COLUMNS,
  ]);
  assert.doesNotMatch(content, /downtime/);
});

test('CSV rollup: baris tampil diserialisasi dengan kolom layar (performance null -> kosong)', () => {
  const items: TelemetryRollupItem[] = [
    {
      groupBy: 'machine',
      groupKey: 'STM32-OEE-01',
      bucket: null,
      machineId: 'CNC-MILLING-01',
      machine_name: 'CNC-MILLING-01',
      device_id: 'STM32-OEE-01',
      totalCount: 350,
      goodCount: 342,
      rejectCount: 8,
      operatingSec: 3600,
      runSec: 3250,
      availabilityPct: 90.3,
      performancePct: null,
      qualityPct: 98,
      oeePct: 80.5,
      sampleCount: 60,
      provisional: true,
    },
  ];
  assert.deepEqual([...TELEMETRY_ROLLUP_CSV_COLUMNS], [
    'group_key',
    'machine_name',
    'device_id',
    'oee_pct',
    'availability_pct',
    'performance_pct',
    'quality_pct',
    'total_count',
    'good_count',
    'reject_count',
    'operating_sec',
    'run_sec',
    'sample_count',
    'provisional',
  ]);

  const { content } = serializeExportRecords(formatTelemetryRollupExportRows(items), 'csv', [
    ...TELEMETRY_ROLLUP_CSV_COLUMNS,
  ]);
  const [header, row] = content.split('\n');
  assert.equal(
    header,
    'group_key,machine_name,device_id,oee_pct,availability_pct,performance_pct,quality_pct,total_count,good_count,reject_count,operating_sec,run_sec,sample_count,provisional'
  );
  assert.equal(
    row,
    'STM32-OEE-01,CNC-MILLING-01,STM32-OEE-01,80.5,90.3,,98,350,342,8,3600,3250,60,true'
  );
});

test('Payload ekspor klien: limit terkirim eksplisit pada endpoint raw + hourly', () => {
  const from = '2026-11-10T00:00:00.000Z';
  const to = '2026-11-17T00:00:00.000Z';
  const raw = buildTelemetryExportEndpoint({
    device_id: 'STM32-OEE-01',
    from,
    to,
    format: 'csv',
    limit: 50,
  });
  assert.match(raw, /limit=50/);
  const hourly = buildTelemetryHourlyExportEndpoint({
    device_id: 'STM32-OEE-01',
    from,
    to,
    format: 'csv',
    limit: 50,
  });
  assert.match(hourly, /limit=50/);

  // E23 Batch 3 (FAT-192, N-23): tanpa limit, default spec dikirim
  // (telemetry export 5000, hourly export 10000) — spec MEWAJIBKAN limit.
  const noLimit = buildTelemetryExportEndpoint({ device_id: 'STM32-OEE-01', from, to, format: 'csv' });
  assert.match(noLimit, /limit=5000/);
  const noLimitHourly = buildTelemetryHourlyExportEndpoint({ device_id: 'STM32-OEE-01', from, to, format: 'csv' });
  assert.match(noLimitHourly, /limit=10000/);
});

test('Ekspor demo menghormati limit: raw 5 baris, hourly 3 baris', async () => {
  apiClient.setUserRole('ADMIN');
  const nowIso = new Date().toISOString();
  const weekAgoIso = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

  const raw = await apiClient.exportTelemetryData({
    device_id: 'STM32-OEE-01',
    from: weekAgoIso,
    to: nowIso,
    format: 'csv',
    limit: 5,
  });
  assert.equal(raw.rowCount, 5);
  assert.equal(raw.content.split('\n').length, 6); // header + 5 baris
  assert.match(raw.endpoint, /limit=5/);
  assert.match(raw.content.split('\n')[0], /operating_time_sec,run_time_sec,downtime_sec,cycle_time_sec/);

  // Jendela "hari ini" WIB supaya kedelapan bucket seed (07:00–14:00)
  // berada dalam rentang apa pun jam berjalan saat ini.
  const wibDate = new Date(Date.now() + 7 * 60 * 60 * 1000).toISOString().slice(0, 10);
  const hourly = await apiClient.exportTelemetryHourlyData({
    device_id: 'STM32-OEE-01',
    from: `${wibDate}T00:00:00+07:00`,
    to: `${wibDate}T23:59:59+07:00`,
    format: 'csv',
    limit: 3,
  });
  assert.equal(hourly.rowCount, 3);
  assert.equal(hourly.content.split('\n').length, 4); // header + 3 baris
  assert.match(hourly.endpoint, /limit=3/);
  // E12 T12.14 (F-10 / FAT-66): header CSV hourly demo tidak lagi memuat
  // kolom downtime per jam; kolom extra_ lain tetap ada.
  assert.doesNotMatch(hourly.content.split('\n')[0], /hourly_downtime_sec/);
  assert.match(hourly.content.split('\n')[0], /extra_hourly_run_sec/);
});
