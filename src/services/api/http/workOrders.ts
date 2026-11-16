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
    return reqList({ path: endpoint, signal, endpointKey: 'WORK_ORDERS_LIST' }, mapWorkOrder, query.limit ?? 50);
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

  async resolveWorkOrder(woId: string, deviceId?: string, signal?: AbortSignal): Promise<WorkOrderResolveResult> {
    checkAbortHttp(signal);
    const raw = await reqJson<Record<string, unknown>>({
      path: ADMIN_ENDPOINTS.WORK_ORDERS_RESOLVE.buildPath(woId),
      query: deviceId ? { device_id: deviceId } : undefined,
      signal,
      endpointKey: 'WORK_ORDERS_RESOLVE',
      capability: 'work_order.read',
      resourceId: woId,
    });
    const wo = (raw.work_order ?? {}) as Record<string, unknown>;
    const shiftPlan = (wo.shift_plan ?? {}) as Record<string, unknown>;
    const brk = (wo.break ?? {}) as Record<string, unknown>;
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
        targetPerHour: num(pick(wo.targetPerHour, wo.target_per_hour), 0),
        shift_plan: {
          shift_start: str(pick(shiftPlan.shift_start, shiftPlan.shiftStart), ''),
          shift_end: str(pick(shiftPlan.shift_end, shiftPlan.shiftEnd), ''),
          planned_break_min: num(pick(shiftPlan.planned_break_min, shiftPlan.plannedBreakMin), 0),
          planned_operating_sec: num(pick(shiftPlan.planned_operating_sec, shiftPlan.plannedOperatingSec), 0),
        },
        break: {
          start: str(pick(brk.start), ''),
          end: str(pick(brk.end), ''),
          minutes: num(pick(brk.minutes), 0),
        },
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
    return {
      success: bool(raw.success, true),
      work_order: {
        wo_id: str(pick(wo.wo_id, wo.woId, woId)),
        status: 'ABORTED',
        machine_id: (pick(wo.machine_id, wo.machineId) as string | null) ?? null,
      },
    };
  }
};
