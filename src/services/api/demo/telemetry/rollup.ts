/**
 * Method demo — domain rollup.
 *
 * Dipisah dari demo/telemetry.ts pada E11 T11.6 (FAT-49), mengikuti pola
 * R9.2 (kontrak docs/DIRECTORY_STRUCTURE.md). Satu file = satu domain.
 * Barrel penggabung ada di file induknya (../telemetry.ts).
 *
 * Agregasi telemetry per machine/day/month (group_by).
 */

import { store } from '../store';
import { checkAbort, throwValidationIssues } from '../helpers';
import { TelemetryRollupItem, TelemetryRollupQuery } from '../../../../types/analytics';
import { CursorPageResponse } from '../../../../types/historical';
import { TelemetryRollupItemSchema } from '../../schemas';
import { buildTelemetryRollupEndpoint, paginateWithCursor } from '../../../../utils/historicalExport';

export const demoTelemetryRollup = {
  async getTelemetryRollup(
    query: TelemetryRollupQuery,
    signal?: AbortSignal
  ): Promise<CursorPageResponse<TelemetryRollupItem>> {
    checkAbort(signal);
    const fromMs = Date.parse(query.from);
    const toMs = Date.parse(query.to);
    if (Number.isNaN(fromMs) || Number.isNaN(toMs) || fromMs > toMs) {
      throwValidationIssues('Rentang waktu rollup from/to tidak valid.', {
        from: 'Pastikan format ISO 8601 valid dan from <= to.',
      });
    }

    const endpoint = buildTelemetryRollupEndpoint(query);
    store.recordEndpoint('TELEMETRY_ROLLUP', endpoint);

    const rows: TelemetryRollupItem[] = [];

    if (query.group_by === 'machine') {
      const candidates = [
        ...store.machines.map((m) => ({
          machine_id: m.machine_id as string | null,
          machine_name: m.name as string | null,
          device_id: m.bound_device_id,
          zeroCapacity: false,
        })),
        ...store.devices
          .filter((d) => !d.bound_machine_id)
          .map((d) => ({
            machine_id: null as string | null,
            machine_name: 'Unbound Edge Controller' as string | null,
            device_id: d.device_id as string | null,
            zeroCapacity: true,
          })),
      ];

      candidates.forEach((cand, idx) => {
        if (query.machine_id && query.machine_id !== 'ALL' && cand.machine_id !== query.machine_id) return;
        if (query.device_id && query.device_id !== 'ALL' && cand.device_id !== query.device_id) return;
        const live = store.liveStates.find(
          (l) =>
            (cand.device_id && l.device_id === cand.device_id) ||
            (cand.machine_id && l.machine_id === cand.machine_id)
        );
        const operatingSec = cand.zeroCapacity ? 14400 : 28800 - idx * 1200;
        const avail = cand.zeroCapacity ? 100 : live?.availability ?? 90.2;
        const runSec = Math.round((operatingSec * avail) / 100);
        const totalCount = cand.zeroCapacity ? 0 : Math.max(120, (live?.total_count ?? 220) * 4);
        const rejectCount = cand.zeroCapacity ? 0 : Math.max(2, (live?.reject_count ?? 5) * 3);
        const goodCount = Math.max(0, totalCount - rejectCount);
        const qual = totalCount > 0 ? Number(((goodCount / totalCount) * 100).toFixed(2)) : 100;
        const perf = cand.zeroCapacity ? null : Number((live?.performance ?? 92.5).toFixed(2));
        const oee = perf === null ? 0 : Number(((avail * perf * qual) / 10000).toFixed(2));

        rows.push(
          TelemetryRollupItemSchema.parse({
            groupKey: cand.machine_id ?? cand.device_id ?? `row-${idx}`,
            groupBy: 'machine',
            machineId: cand.machine_id ?? null,
            machine_id: cand.machine_id,
            machine_name: cand.machine_name,
            device_id: cand.device_id,
            // E11 T11.4 (F-4 / G21): bucket null untuk group_by machine —
            // dokumen API: field item `bucket` (null untuk `machine`).
            // Sebelumnya diisi tanggal `to`, menyesatkan (bukan bucket waktu).
            bucket: null,
            totalCount,
            goodCount,
            rejectCount,
            operatingSec,
            runSec,
            availabilityPct: avail.toFixed(2),
            performancePct: perf === null ? null : perf.toFixed(2),
            qualityPct: qual.toFixed(2),
            oeePct: oee.toFixed(2),
            sampleCount: cand.zeroCapacity ? 48 : 380 - idx * 35,
            provisional: true,
          })
        );
      });
    } else if (query.group_by === 'day') {
      const days = 7;
      for (let i = 0; i < days; i++) {
        const dayDate = new Date(toMs - i * 24 * 3600_000);
        if (dayDate.getTime() < fromMs - 24 * 3600_000) continue;
        const dayKey = dayDate.toISOString().slice(0, 10);
        const zeroCap = query.device_id === 'STM32-OEE-05';
        const avail = zeroCap ? 100 : Number((91.8 - (i % 4) * 1.3).toFixed(2));
        const perf = zeroCap ? null : Number((93.6 - (i % 3) * 1.1).toFixed(2));
        const totalCount = zeroCap ? 0 : 940 - i * 24;
        const rejectCount = zeroCap ? 0 : 18 + (i % 5) * 3;
        const goodCount = Math.max(0, totalCount - rejectCount);
        const qual = totalCount > 0 ? Number(((goodCount / totalCount) * 100).toFixed(2)) : 100;
        const oee = perf === null ? 0 : Number(((avail * perf * qual) / 10000).toFixed(2));

        rows.push(
          TelemetryRollupItemSchema.parse({
            groupKey: dayKey,
            groupBy: 'day',
            machineId: query.machine_id ?? null,
            machine_id: query.machine_id ?? null,
            machine_name: query.machine_id
              ? store.machines.find((m) => m.machine_id === query.machine_id)?.name ?? query.machine_id
              : 'Plant Aggregated',
            device_id: query.device_id ?? null,
            bucket: dayKey,
            totalCount,
            goodCount,
            rejectCount,
            operatingSec: 57600,
            runSec: Math.round((57600 * avail) / 100),
            availabilityPct: avail.toFixed(2),
            performancePct: perf === null ? null : perf.toFixed(2),
            qualityPct: qual.toFixed(2),
            oeePct: oee.toFixed(2),
            sampleCount: 1440 - i * 40,
            provisional: i === 0,
          })
        );
      }
    } else {
      // month
      for (let i = 0; i < 4; i++) {
        const d = new Date(toMs);
        d.setUTCMonth(d.getUTCMonth() - i);
        const monthKey = `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
        const zeroCap = query.device_id === 'STM32-OEE-05';
        const avail = zeroCap ? 100 : Number((90.5 - i * 0.9).toFixed(2));
        const perf = zeroCap ? null : Number((92.4 - i * 0.7).toFixed(2));
        const totalCount = zeroCap ? 0 : 24200 - i * 1150;
        const rejectCount = zeroCap ? 0 : 480 - i * 20;
        const goodCount = Math.max(0, totalCount - rejectCount);
        const qual = totalCount > 0 ? Number(((goodCount / totalCount) * 100).toFixed(2)) : 100;
        const oee = perf === null ? 0 : Number(((avail * perf * qual) / 10000).toFixed(2));

        rows.push(
          TelemetryRollupItemSchema.parse({
            groupKey: monthKey,
            groupBy: 'month',
            machineId: query.machine_id ?? null,
            machine_id: query.machine_id ?? null,
            machine_name: query.machine_id
              ? store.machines.find((m) => m.machine_id === query.machine_id)?.name ?? query.machine_id
              : 'Plant Monthly Rollup',
            device_id: query.device_id ?? null,
            bucket: monthKey,
            totalCount,
            goodCount,
            rejectCount,
            operatingSec: 1_555_200,
            runSec: Math.round((1_555_200 * avail) / 100),
            availabilityPct: avail.toFixed(2),
            performancePct: perf === null ? null : perf.toFixed(2),
            qualityPct: qual.toFixed(2),
            oeePct: oee.toFixed(2),
            sampleCount: 41200 - i * 1800,
            provisional: i === 0,
          })
        );
      }
    }

    return paginateWithCursor(
      rows,
      (item) => (item.bucket && /^\d{4}-\d{2}/.test(item.bucket) ? `${item.bucket}T00:00:00Z` : new Date(toMs).toISOString()),
      {
        cursor: query.cursor,
        limit: query.limit ?? 50,
        maxLimit: 100,
        getId: (item) => item.groupKey,
      }
    );
  },
};
