import test from 'node:test';
import assert from 'node:assert/strict';
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
