/**
 * Helper demo: generator deret telemetri + pareto reject.
 *
 * Dipisah dari demo/helpers.ts (415 baris) pada E32.5 (FAT-286), mengikuti
 * pola R9.2 (kontrak docs/DIRECTORY_STRUCTURE.md). Satu file = satu
 * sub-domain. Barrel penggabung ada di file induknya (../helpers.ts).
 */

import { RejectParetoItem, TelemetryHistoryRecord } from '../../../../types/analytics';
import { normalizeFsmState } from '../../../../utils/oeeCalculations';

export function generateTelemetrySeries(deviceId: string, count = 60): TelemetryHistoryRecord[] {
  const list: TelemetryHistoryRecord[] = [];
  const baseNow = Date.now();
  const targetDevice = deviceId || 'STM32-OEE-01';
  const isUnknownCapacity = targetDevice === 'STM32-OEE-05';
  for (let i = 0; i < count; i++) {
    let offsetMs: number;
    if (i < 12) {
      offsetMs = (i + 1) * 5 * 60_000;
    } else if (i < 36) {
      // Every ~3 hours for the past 3.5 days so WO correlation windows always contain samples
      offsetMs = (i - 10) * 3 * 3600_000;
    } else {
      offsetMs = (i - 32) * 2.1 * 24 * 3600_000;
    }
    const ts = new Date(baseNow - offsetMs).toISOString();
    const fsm = normalizeFsmState(
      isUnknownCapacity
        ? 'UNCONFIGURED'
        : i % 13 === 5
        ? 'PLANNED_DOWNTIME'
        : i % 9 === 3
        ? 'UNPLANNED_DOWNTIME'
        : 'RUNNING'
    );
    const totalCount = isUnknownCapacity ? 0 : Math.max(20, 350 - i * 2);
    const rejectCount = isUnknownCapacity ? 0 : 8 + (i % 4);
    const goodCount = Math.max(0, totalCount - rejectCount);
    const operatingTimeSec = 3600;
    const downtimeSec = fsm === 'RUNNING' ? (i % 4) * 90 : 1200;
    const runTimeSec = Math.max(0, operatingTimeSec - downtimeSec);
    const lastCycleTimeSec = isUnknownCapacity ? null : Number((42.1 + ((i * 0.35) % 2)).toFixed(1));
    list.push({
      id: `tel-${targetDevice}-${String(i + 1).padStart(3, '0')}`,
      device_id: targetDevice,
      timestamp: ts,
      fsm_state: fsm,
      total_count: totalCount,
      good_count: goodCount,
      reject_count: rejectCount,
      totalCount,
      goodCount,
      rejectCount,
      operatingTimeSec,
      runTimeSec,
      downtimeSec,
      lastCycleTimeSec,
      oee: isUnknownCapacity ? 0 : Number((84.6 - (i % 5) * 1.4).toFixed(1)),
      availability: isUnknownCapacity ? 100 : Number((92.4 - (i % 3) * 1.1).toFixed(1)),
      performance: isUnknownCapacity ? 0 : 94.1,
      quality: isUnknownCapacity ? 100 : 97.4,
      cycle_time_ms: isUnknownCapacity ? 0 : 42100 + ((i * 350) % 2000),
      temperature_c: Number((48.2 + ((i * 0.3) % 4)).toFixed(1)),
      vibration_rms: Number((1.24 + ((i * 0.05) % 0.4)).toFixed(2)),
      is_buffered: i % 11 === 4,
    });
  }
  return list;
}

/**
 * Pareto reject per device — SATU keranjang `UNCLASSIFIED` per device, tanpa
 * kategori alasan. Perangkat OEE hanya punya 1 tombol Reject, jadi yang
 * tercatat di sumber hanyalah counter reject; tidak ada alasan yang bisa
 * didistribusikan. Ini sesuai API doc §R (FR-BIGR-001..003): sumber pareto
 * adalah delta `UNCLASSIFIED` per jendela, dan totalnya harus dapat
 * direkonsiliasi dengan `device_live_state.rejectCount` — karena itu count di
 * sini = `reject_count` live state per device di `seeds/monitoring.ts`
 * (STM32-OEE-01: 8, -02: 3, -03: 14; -04/-05: 0 → `[]`, tanpa data → `[]`).
 * JANGAN mengembalikan seed multi-alasan (mis. "Dimension Tolerance", dst.):
 * alasan semacam itu tidak pernah dihasilkan perangkat dan akan menampilkan
 * analisis cacat yang tidak pernah terjadi. Bila suatu hari klasifikasi
 * alasan benar-benar dibutuhkan, ia harus datang dari alur lain (mis.
 * klasifikasi QC di panel) — lihat AUDIT.md §12.
 */
export const REJECT_PARETO_BY_DEVICE: Record<string, RejectParetoItem[]> = {
  'STM32-OEE-01': [
    { reason: 'UNCLASSIFIED', count: 8, percentage: 100, cumulative_percentage: 100 },
  ],
  'STM32-OEE-02': [
    { reason: 'UNCLASSIFIED', count: 3, percentage: 100, cumulative_percentage: 100 },
  ],
  'STM32-OEE-03': [
    { reason: 'UNCLASSIFIED', count: 14, percentage: 100, cumulative_percentage: 100 },
  ],
  'STM32-OEE-04': [],
  'STM32-OEE-05': [],
};
