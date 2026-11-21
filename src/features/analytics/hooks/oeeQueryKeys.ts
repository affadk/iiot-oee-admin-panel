import { HistoryFilters } from '../../../types/historical';
import { TelemetryRollupGroupBy } from '../../../types/analytics';

export type TimelineBucket = '1m' | '5m' | '15m' | '1h';

/**
 * E12 T12.10 (X-3 / FAT-57): scope rollup halaman OEE.
 * - 'MACHINE' (default): rollup mengikuti mesin terpilih (perilaku E11 T11.3).
 * - 'ALL': rollup plant-wide — `machineId`/`deviceId` dikosongkan.
 */
export type RollupScope = 'MACHINE' | 'ALL';

export interface OeeAnalyticsQueryInput {
  machineId: string;
  /** E28 Batch B (FAT-170): boleh undefined bila tidak ada device
      terderiva (daftar kosong / mesin tanpa ikatan) — hanya queryKey. */
  deviceId: string | undefined;
  from: string;
  to: string;
  shiftDate?: string;
  shiftId?: string;
  timelineBucket: TimelineBucket;
  rollupGroupBy: TelemetryRollupGroupBy;
  /** Scope rollup (E12 T12.10): 'MACHINE' = mesin terpilih, 'ALL' = semua mesin. */
  rollupScope: RollupScope;
  /** Filter mentah halaman (from/to, machineId, groupBy, …) — rollup
      memakai objek yang sama dengan `useTelemetryRollupQuery`. */
  baseFilters: HistoryFilters;
}

export interface OeeAnalyticsQueryKeys {
  shiftSummary: unknown[];
  hourly: unknown[];
  timeline: unknown[];
  downtimeOverlay: unknown[];
  /** Cerminan persis queryKey di `useTelemetryRollupQuery`
      (`['oee-rollup', filters, cursor]`, cursor undefined di halaman ini). */
  rollup: unknown[];
  /** Filter rollup yang diteruskan ke `useTelemetryRollupQuery`. */
  rollupFilters: HistoryFilters;
}

/**
 * E12 T12.9 (X-2 / FAT-62): konstruksi queryKey halaman OEE sebagai
 * fungsi murni — satu tempat yang menjamin SEMUA query halaman (summary,
 * hourly, timeline, rollup, downtime overlay) memuat from/to, sehingga
 * mengganti rentang di pemilih periode me-refetch semuanya (gap G1).
 * Dipakai `useOeeAnalytics`; diuji langsung di `oeeQueryKeys.test.ts`
 * karena refetch React Query hanya terjadi bila queryKey berubah.
 */
export function buildOeeAnalyticsQueryKeys(input: OeeAnalyticsQueryInput): OeeAnalyticsQueryKeys {
  const { machineId, deviceId, from, to, shiftDate, shiftId, timelineBucket } = input;
  // E11 T11.3 (F-3): rollup mengikuti mesin terpilih — sama seperti
  // hourly/summary/timeline di hook ini (gap G4). Hanya machineId yang
  // diteruskan: mesin adalah scope yang dipilih di halaman ini, dan
  // deviceId sengaja dikosongkan agar mesin tanpa device terikat
  // (mis. CNC-GRIND-05) tetap mendapat barisnya.
  // E12 T12.10 (X-3 / FAT-57): scope 'ALL' mengosongkan machineId
  // (plant-wide) — masuk ke queryKey lewat rollupFilters, sehingga
  // ganti scope me-refetch rollup.
  const rollupFilters: HistoryFilters = {
    ...input.baseFilters,
    machineId: input.rollupScope === 'ALL' ? undefined : machineId,
    deviceId: undefined,
    groupBy: input.rollupGroupBy,
  };
  return {
    shiftSummary: ['oee-shift-summary', machineId, from, to, shiftDate, shiftId],
    hourly: ['oee-hourly', machineId, from, to, shiftDate, shiftId],
    timeline: ['oee-shift-timeline', machineId, timelineBucket, from, to, shiftDate, shiftId],
    downtimeOverlay: ['oee-timeline-downtime', deviceId, from, to],
    rollup: ['oee-rollup', rollupFilters, undefined],
    rollupFilters,
  };
}
