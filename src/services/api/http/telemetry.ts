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
import { ShiftSummary, ShiftTimelineSegment, RejectParetoItem, ReconciliationJob, ReconciliationRefreshRequest } from '../../../types/analytics';

export const httpTelemetry = {
  async getShiftSummary(machineId?: string, signal?: AbortSignal): Promise<ShiftSummary> {
    checkAbortHttp(signal);
    assertAuthenticatedHttp();
    const raw = await reqJson<unknown>({
      path: ADMIN_ENDPOINTS.OEE_SHIFT_SUMMARY.buildPath(),
      query: machineId ? { machine_id: machineId } : undefined,
      signal,
      endpointKey: 'OEE_SHIFT_SUMMARY',
    });
    const { items } = splitList(raw);
    const first = items[0] ?? raw;
    return mapShiftSummary(first, machineId);
  },

  async getShiftTimeline(
    machineId?: string,
    bucket: '1m' | '5m' | '15m' | '1h' = '15m',
    signal?: AbortSignal
  ): Promise<ShiftTimelineSegment[]> {
    checkAbortHttp(signal);
    assertAuthenticatedHttp();
    return reqList(
      {
        path: ADMIN_ENDPOINTS.OEE_SHIFT_TIMELINE.buildPath(),
        query: { bucket, ...(machineId ? { machine_id: machineId } : {}) },
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
    assertAuthenticatedHttp();
    return reqList<ReconciliationJob>(
      { path: ADMIN_ENDPOINTS.RECONCILIATION_JOBS.buildPath(), signal, endpointKey: 'RECONCILIATION_JOBS', capability: 'telemetry.read' },
      (raw) => mapReconciliationJob(raw),
      50,
    ).then((p) => p.data);
  },

  async triggerReconciliationRefresh(
    request: ReconciliationRefreshRequest = {}
  ): Promise<{ success: boolean; message: string }> {
    assertAuthenticatedHttp();
    assertLanForMutation();
    const raw = await reqJson<Record<string, unknown>>({
      method: 'POST',
      path: ADMIN_ENDPOINTS.RECONCILIATION_REFRESH.buildPath(),
      body: {
        ...(request.startWindow ?? request.from ? { startWindow: request.startWindow ?? request.from } : {}),
        ...(request.endWindow ?? request.to ? { endWindow: request.endWindow ?? request.to } : {}),
      },
      timeoutMs: MUTATION_TIMEOUT_MS,
      retry: false,
      endpointKey: 'RECONCILIATION_REFRESH',
      capability: 'export.telemetry',
    });
    return { success: bool(raw.success, true), message: (raw.message as string) ?? 'Refresh reconciliation diterima.' };
  },

  // -- Quality rejects ----------------------------------------------------------
  async getRejectPareto(deviceId: string, signal?: AbortSignal): Promise<RejectParetoItem[]> {
    checkAbortHttp(signal);
    assertAuthenticatedHttp();
    const raw = await reqJson<unknown>({
      path: ADMIN_ENDPOINTS.QUALITY_REJECTS_BY_DEVICE.buildPath(deviceId),
      signal,
      endpointKey: 'QUALITY_REJECTS_BY_DEVICE',
      capability: 'quality.read',
      resourceId: deviceId,
    });
    return paretoFromRows(raw);
  },

  async getRejectParetoGlobal(signal?: AbortSignal): Promise<RejectParetoItem[]> {
    checkAbortHttp(signal);
    assertAuthenticatedHttp();
    const raw = await reqJson<unknown>({
      path: ADMIN_ENDPOINTS.QUALITY_REJECTS_GLOBAL.buildPath(),
      signal,
      endpointKey: 'QUALITY_REJECTS_GLOBAL',
      capability: 'quality.read',
    });
    return paretoFromRows(raw);
  }
};
