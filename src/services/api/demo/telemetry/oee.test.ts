import test from 'node:test';
import assert from 'node:assert/strict';
import { apiClient } from '../../client';
import {
  buildDemoHourlyPoints,
  deriveShiftSummaryFromHourly,
} from './oee';

// ---------------------------------------------------------------------------
// E12 T12.6a (Opsi A / FAT-70, keputusan Fathur 2026-11-17): ringkasan
// shift demo diturunkan dari Σ titik per jam — bukan counter kumulatif
// live-state (350/342/8). A 92,4 · P 95,4 · Q 98,2 · OEE 86,6 · parts
// 334/328/6 · target 50. Seed hourly tidak disentuh.
// ---------------------------------------------------------------------------

test('deriveShiftSummaryFromHourly: seed STM32-OEE-01 → OEE 86,6, parts 334/328/6, target 50', () => {
  const derived = deriveShiftSummaryFromHourly(buildDemoHourlyPoints('STM32-OEE-01'));
  assert.deepEqual(derived, {
    oee: 86.6,
    availability: 92.4,
    performance: 95.4,
    quality: 98.2,
    totalParts: 334,
    goodParts: 328,
    defectParts: 6,
    targetPerHour: 50,
  });
});

test('deriveShiftSummaryFromHourly: kapasitas unknown (STM32-OEE-05) → null, pemanggil memakai fallback live-state', () => {
  assert.equal(deriveShiftSummaryFromHourly(buildDemoHourlyPoints('STM32-OEE-05')), null);
});

test('deriveShiftSummaryFromHourly: array kosong → null', () => {
  assert.equal(deriveShiftSummaryFromHourly([]), null);
});

test('buildDemoHourlyPoints: Σ seed tetap 334/328/6 dan Σ run 23.280 dtk', () => {
  const points = buildDemoHourlyPoints('STM32-OEE-01');
  assert.equal(points.length, 8);
  assert.equal(points.reduce((acc, p) => acc + (p.parts_produced ?? 0), 0), 334);
  assert.equal(points.reduce((acc, p) => acc + (p.good_count ?? 0), 0), 328);
  assert.equal(points.reduce((acc, p) => acc + (p.defect_count ?? 0), 0), 6);
  assert.equal(points.reduce((acc, p) => acc + (p.hourly_run_sec ?? 0), 0), 23280);
  assert.equal(points.reduce((acc, p) => acc + (p.hourly_operating_sec ?? 0), 0), 25200);
});

// ---------------------------------------------------------------------------
// E20 P20.5 (FAT-157): titik demo membawa `bucket` ISO + id penaut;
// oee/performance `null` (bukan 0) bila kapasitas unknown (D-8).
// ---------------------------------------------------------------------------

test('P20.5: titik demo membawa bucket ISO + deviceId/machineId/woId', () => {
  const points = buildDemoHourlyPoints('STM32-OEE-01');
  assert.equal(points[0].bucket, '2026-11-11T07:00:00+07:00');
  assert.equal(points[0].hour, '2026-11-11T07:00:00+07:00');
  assert.equal(points[7].bucket, '2026-11-11T14:00:00+07:00');
  assert.ok(points.every((p) => p.deviceId === 'STM32-OEE-01'));
  assert.ok(points.every((p) => p.machineId === 'CNC-MILLING-01'));
  assert.equal(points[0].woId, 'WO-2026-101');
});

test('P20.5: titik OEE-05 (kapasitas unknown) — oee/performance null, bukan 0', () => {
  const points = buildDemoHourlyPoints('STM32-OEE-05');
  assert.ok(points.filter((p) => !p.planned).every((p) => p.oee === null));
  assert.ok(points.filter((p) => !p.planned).every((p) => p.performance === null));
  assert.ok(points.filter((p) => !p.planned).every((p) => p.availability === 100));
});

test('P20.5: getShiftSummary include_hourly=true menyertakan hourly[]; menit diturunkan; target unknown = null', async () => {
  const s = await apiClient.getShiftSummary('CNC-MILLING-01', undefined, { include_hourly: true });
  assert.equal(s.hourly?.length, 8);
  assert.equal(s.hourly?.[0].bucket, '2026-11-11T07:00:00+07:00');
  assert.equal(s.planned_production_time_min, 480);
  assert.equal(s.planned_break_min, 60);
  assert.equal(s.operating_time_min, 420);
  assert.equal(s.run_time_min, 388);
  assert.equal(s.unplanned_downtime_min, 32);
  assert.equal(s.planned_downtime_min, 60);
  assert.equal(s.target_per_hour, 50);
  const sNoHourly = await apiClient.getShiftSummary('CNC-MILLING-01');
  assert.equal(sNoHourly.hourly, undefined);
});
