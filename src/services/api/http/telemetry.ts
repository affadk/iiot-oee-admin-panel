/**
 * Method HTTP — domain telemetry.
 *
 * Dipisah dari file god-file pada refactoring R9 (kontrak docs/DIRECTORY_STRUCTURE.md).
 * Satu file = satu domain. Barrel penggabung ada di file induknya.
 */
import { MUTATION_TIMEOUT_MS, assertLanForMutation, assertAuthenticatedHttp, reqJson, reqList, checkAbortHttp } from './transport';
import { mapShiftSummary, mapTimelineSegment, mapReconciliationJob, paretoFromRows } from './mappers';
import { bool, splitList } from './primitives';
import { ADMIN_ENDPOINTS } from '../endpoints';
import { ShiftSummary, ShiftTimelineSegment, RejectParetoItem, ReconciliationJob, ReconciliationRefreshRequest, TelemetryRangeOptions } from '../../../types/analytics';

export const httpTelemetry = {
  async getShiftSummary(
    machineId?: string,
    signal?: AbortSignal,
    options?: TelemetryRangeOptions
  ): Promise<ShiftSummary> {
    checkAbortHttp(signal);
    // E20 P20.5 (FAT-157): agregat OEE read-only, tunnel-safe, TANPA auth
    // (§Q, §7H) — assertAuthenticatedHttp DIHAPUS dari read OEE/telemetri.
    // E11 T11.2 (F-2): kirim from/to agar ringkasan shift terikat periode
    // yang sama dengan tabel per jam (API doc §I). Tanpa options, query
    // sama seperti sebelumnya (hanya machine_id).
    // E12 T12.1 (X-1 / FAT-54): kirim juga date/shift bila filter shift
    // aktif — parameter yang didefinisikan API doc §I (`?date=&shift=`).
    const query: Record<string, string> = {
      ...(machineId ? { machine_id: machineId } : {}),
      ...(options?.from ? { from: options.from } : {}),
      ...(options?.to ? { to: options.to } : {}),
      ...(options?.date ? { date: options.date } : {}),
      ...(options?.shift ? { shift: options.shift } : {}),
      // E20 P20.5 (FAT-157): `include_hourly=true` meminta rantai
      // `hourly[]` (§Q.1) — mapper membacanya, bukan membuangnya.
      ...(options?.include_hourly ? { include_hourly: 'true' } : {}),
    };
    const raw = await reqJson<unknown>({
      path: ADMIN_ENDPOINTS.OEE_SHIFT_SUMMARY.buildPath(),
      query: Object.keys(query).length > 0 ? query : undefined,
      signal,
      endpointKey: 'OEE_SHIFT_SUMMARY',
    });
    const { items } = splitList(raw);
    const first = items[0] ?? raw;
    return mapShiftSummary(first, machineId);
  },

  async getShiftTimeline(
    machineId?: string,
    // E20 P20.5 (FAT-157): bucket default dokumen `5m` (§Q.3, §7I) — bukan 15m.
    bucket: '1m' | '5m' | '15m' | '1h' = '5m',
    signal?: AbortSignal,
    options?: TelemetryRangeOptions
  ): Promise<ShiftTimelineSegment[]> {
    checkAbortHttp(signal);
    // E20 P20.5 (FAT-157): read OEE tanpa auth (§Q, §7H).
    // E11 T11.2 (F-2): kirim from/to agar timeline terikat periode yang
    // sama dengan tabel per jam (API doc §I).
    // E12 T12.1 (X-1 / FAT-54): kirim juga date/shift bila filter shift aktif.
    return reqList(
      {
        path: ADMIN_ENDPOINTS.OEE_SHIFT_TIMELINE.buildPath(),
        query: {
          bucket,
          ...(machineId ? { machine_id: machineId } : {}),
          ...(options?.from ? { from: options.from } : {}),
          ...(options?.to ? { to: options.to } : {}),
          ...(options?.date ? { date: options.date } : {}),
          ...(options?.shift ? { shift: options.shift } : {}),
        },
        signal,
        endpointKey: 'OEE_SHIFT_TIMELINE',
      },
      mapTimelineSegment,
      50,
    ).then((p) => p.data);
  },

  // -- Reconciliation ----------------------------------------------------------
  async getReconciliationJobs(signal?: AbortSignal): Promise<ReconciliationJob[]> {
    checkAbortHttp(signal);
    // E20 P20.5 (FAT-157): read telemetri tanpa auth (§7H `/telemetry/*` open).
    return reqList<ReconciliationJob>(
      { path: ADMIN_ENDPOINTS.RECONCILIATION_JOBS.buildPath(), signal, endpointKey: 'RECONCILIATION_JOBS', capability: 'telemetry.read' },
      (raw) => mapReconciliationJob(raw),
      50,
    ).then((p) => p.data);
  },

  async triggerReconciliationRefresh(
    request: ReconciliationRefreshRequest = {}
  ): Promise<{ success: boolean; message: string; refreshedStart?: string; refreshedEnd?: string }> {
    assertAuthenticatedHttp();
    assertLanForMutation();
    const raw = await reqJson<Record<string, unknown>>({
      method: 'POST',
      path: ADMIN_ENDPOINTS.RECONCILIATION_REFRESH.buildPath(),
      // E23 Batch 1 (FAT-177, N-8): spec live — body kanonis
      // `{startWindow, endWindow}` (datetime; field opsional, body wajib).
      // MEMBALIKKAN keputusan E20 (R-11/T9/X29, `{from, to}` mengikuti
      // api_docs §K.6) — lihat anotasi docs/API_SYNC_DIFF.md.
      body: {
        ...(request.startWindow ? { startWindow: request.startWindow } : {}),
        ...(request.endWindow ? { endWindow: request.endWindow } : {}),
      },
      timeoutMs: MUTATION_TIMEOUT_MS,
      retry: false,
      endpointKey: 'RECONCILIATION_REFRESH',
      capability: 'telemetry.refresh',
    });
    return {
      success: bool(raw.success, true),
      message: (raw.message as string) ?? 'Refresh reconciliation diterima.',
      refreshedStart: (raw.refreshedStart as string | undefined) ?? undefined,
      refreshedEnd: (raw.refreshedEnd as string | undefined) ?? undefined,
    };
  },

  // -- Quality rejects ----------------------------------------------------------
  async getRejectPareto(deviceId: string, signal?: AbortSignal): Promise<RejectParetoItem[]> {
    checkAbortHttp(signal);
    // E20 P20.5 (FAT-157): read quality tanpa auth (§7H `/quality/*` open).
    // E23 Batch 3 (FAT-192, N-23): spec live MEWAJIBKAN `limit`
    // (default 50) — dulu tidak ada query sama sekali.
    const raw = await reqJson<unknown>({
      path: ADMIN_ENDPOINTS.QUALITY_REJECTS_BY_DEVICE.buildPath(deviceId),
      query: { limit: 50 },
      signal,
      endpointKey: 'QUALITY_REJECTS_BY_DEVICE',
      capability: 'quality.read',
      resourceId: deviceId,
    });
    return paretoFromRows(raw);
  },

  async getRejectParetoGlobal(signal?: AbortSignal): Promise<RejectParetoItem[]> {
    checkAbortHttp(signal);
    // E20 P20.5 (FAT-157): read quality tanpa auth (§7H `/quality/*` open).
    // E23 Batch 3 (FAT-192, N-23): spec live MEWAJIBKAN `limit`
    // (default 50) — dulu tidak ada query sama sekali.
    const raw = await reqJson<unknown>({
      path: ADMIN_ENDPOINTS.QUALITY_REJECTS_GLOBAL.buildPath(),
      query: { limit: 50 },
      signal,
      endpointKey: 'QUALITY_REJECTS_GLOBAL',
      capability: 'quality.read',
    });
    return paretoFromRows(raw);
  }
};
