/**
 * Method HTTP — domain workOrders.
 *
 * Dipisah dari file god-file pada refactoring R9 (kontrak docs/DIRECTORY_STRUCTURE.md).
 * Satu file = satu domain. Barrel penggabung ada di file induknya.
 */
import { MUTATION_TIMEOUT_MS, mapWorkOrder, assertLanForMutation, assertAuthenticatedHttp, reqJson, reqList, checkAbortHttp } from './transport';
import { num, str, bool, pick } from './primitives';
import { ADMIN_ENDPOINTS } from '../endpoints';
import { buildWorkOrdersEndpoint } from '../../../utils/historicalExport';
import { WorkOrder, WorkOrderResolveResult, WorkOrderCancelResult } from '../../../types/production';
import { CursorPageResponse, WorkOrdersQuery } from '../../../types/historical';

export const httpWorkOrders = {
  // -- Work Orders (4 ops admin: list/detail/resolve/cancel; dispatch,
  //    validate-zone, initiate-from-zones, complete = HMI-only, TIDAK ADA) ---
  async getWorkOrdersPage(
    query: WorkOrdersQuery = {},
    signal?: AbortSignal,
  ): Promise<CursorPageResponse<WorkOrder>> {
    checkAbortHttp(signal);
    const endpoint = buildWorkOrdersEndpoint(query);
    const page = await reqList({ path: endpoint, signal, endpointKey: 'WORK_ORDERS_LIST' }, mapWorkOrder, query.limit ?? 50);
    // E23 Batch 2 (FAT-188, N-19): `wo_id` tidak terdaftar di spec
    // GET /work-orders sehingga tidak dikirim ke server (lihat
    // buildWorkOrdersEndpoint) — filter diterapkan di sini, sisi klien,
    // pada baris halaman yang diterima (substring, tak peduli huruf
    // besar/kecil, atas wo_id + order_number — sama seperti demo).
    // Batasan: hanya halaman saat ini yang difilter (paginasi cursor);
    // kecocokan di halaman berikut tidak ditarik otomatis.
    const needle = query.wo_id?.trim().toLowerCase();
    if (!needle) return page;
    return {
      ...page,
      data: page.data.filter(
        (w) => w.wo_id.toLowerCase().includes(needle) || w.order_number.toLowerCase().includes(needle),
      ),
    };
  },

  async getWorkOrders(signal?: AbortSignal): Promise<WorkOrder[]> {
    const page = await httpWorkOrders.getWorkOrdersPage({ limit: 100 }, signal);
    return page.data;
  },

  async getWorkOrderById(woId: string, signal?: AbortSignal): Promise<WorkOrder> {
    checkAbortHttp(signal);
    return reqJson(
      { path: ADMIN_ENDPOINTS.WORK_ORDERS_GET.buildPath(woId), signal, endpointKey: 'WORK_ORDERS_GET', capability: 'work_order.read', resourceId: woId },
      mapWorkOrder,
    );
  },

  async resolveWorkOrder(woId: string, deviceId: string, signal?: AbortSignal): Promise<WorkOrderResolveResult> {
    checkAbortHttp(signal);
    // E20 P20.5 (FAT-157, R8): `device_id` REQUIRED (§C.3) — bukan opsional.
    const raw = await reqJson<Record<string, unknown>>({
      path: ADMIN_ENDPOINTS.WORK_ORDERS_RESOLVE.buildPath(woId),
      query: { device_id: deviceId },
      signal,
      endpointKey: 'WORK_ORDERS_RESOLVE',
      capability: 'work_order.read',
      resourceId: woId,
    });
    const wo = (raw.work_order ?? {}) as Record<string, unknown>;
    const shiftPlan = (wo.shift_plan ?? {}) as Record<string, unknown>;
    // E23 Batch 4 (FAT-204, N-35): spec live — `break` opsional dan
    // `targetPerHour` opsional + nullable. Absen/null → null (BUKAN
    // break {start:'', end:'', minutes:0} atau targetPerHour 0 —
    // 0 vs 'tidak diketahui' dibedakan). `break: null` eksplisit juga null.
    const brkRaw = wo.break as Record<string, unknown> | null | undefined;
    const brk = brkRaw && typeof brkRaw === 'object' ? brkRaw : null;
    const tphRaw = pick(wo.targetPerHour, wo.target_per_hour);
    return {
      success: bool(raw.success, true),
      work_order: {
        wo_id: str(pick(wo.wo_id, wo.woId, woId)),
        machine_id: (pick(wo.machine_id, wo.machineId) as string | null) ?? null,
        product_id: (pick(wo.product_id, wo.productId) as string | null) ?? null,
        product_name: (pick(wo.product_name, wo.productName) as string | null) ?? null,
        std_cycle_time_sec: num(pick(wo.std_cycle_time_sec, wo.stdCycleTimeSec), 0),
        operator_id: (pick(wo.operator_id, wo.operatorId) as string | null) ?? null,
        operator_name: (pick(wo.operator_name, wo.operatorName) as string | null) ?? null,
        target_qty: num(pick(wo.target_qty, wo.targetQty), 0),
        targetPerHour: typeof tphRaw === 'number' && Number.isFinite(tphRaw) ? tphRaw : null,
        shift_plan: {
          shift_start: str(pick(shiftPlan.shift_start, shiftPlan.shiftStart), ''),
          shift_end: str(pick(shiftPlan.shift_end, shiftPlan.shiftEnd), ''),
          planned_break_min: num(pick(shiftPlan.planned_break_min, shiftPlan.plannedBreakMin), 0),
          planned_operating_sec: num(pick(shiftPlan.planned_operating_sec, shiftPlan.plannedOperatingSec), 0),
        },
        break: brk
          ? {
              start: str(pick(brk.start), ''),
              end: str(pick(brk.end), ''),
              minutes: num(pick(brk.minutes), 0),
            }
          : null,
        status: (pick(wo.status) as WorkOrderResolveResult['work_order']['status']) ?? 'PENDING',
      },
    };
  },

  async cancelWorkOrder(woId: string, reason?: string): Promise<WorkOrderCancelResult> {
    assertAuthenticatedHttp();
    assertLanForMutation();
    const raw = await reqJson<Record<string, unknown>>({
      method: 'POST',
      path: ADMIN_ENDPOINTS.WORK_ORDERS_CANCEL.buildPath(woId),
      body: reason ? { reason } : {},
      timeoutMs: MUTATION_TIMEOUT_MS,
      retry: false,
      endpointKey: 'WORK_ORDERS_CANCEL',
      capability: 'work_order.cancel',
      resourceId: woId,
    });
    const wo = (raw.work_order ?? {}) as Record<string, unknown>;
    // E23 Batch 4 (FAT-204, N-35): status dibaca dari respons cancel
    // (spec: work_order.status string). 'ABORTED' hanya fallback bila
    // respons tak membawa status yang dikenal — dulu selalu di-hardcode.
    const statusRaw = pick(wo.status) as string | undefined;
    const status: WorkOrderCancelResult['work_order']['status'] =
      statusRaw === 'PENDING' || statusRaw === 'ACTIVE' || statusRaw === 'PENDING_CLOSE' || statusRaw === 'COMPLETED' || statusRaw === 'ABORTED'
        ? statusRaw
        : 'ABORTED';
    return {
      success: bool(raw.success, true),
      work_order: {
        wo_id: str(pick(wo.wo_id, wo.woId, woId)),
        status,
        machine_id: (pick(wo.machine_id, wo.machineId) as string | null) ?? null,
      },
    };
  }
};
