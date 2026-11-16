/**
 * Method demo — domain workOrders.
 *
 * Dipisah dari file god-file pada refactoring R9 (kontrak docs/DIRECTORY_STRUCTURE.md).
 * Satu file = satu domain. Barrel penggabung ada di file induknya.
 */
import { store } from './store';
import { checkAbort, assertCapability, throwValidationIssues } from './helpers';
import { ADMIN_ENDPOINTS } from '../endpoints';
import { WorkOrder, WorkOrderResolveResult, WorkOrderCancelResult } from '../../../types/production';
import { ApiError } from '../../../types/auth';
import { CursorPageResponse, WorkOrdersQuery } from '../../../types/historical';
import { buildWorkOrdersEndpoint, paginateWithCursor } from '../../../utils/historicalExport';

export const demoWorkOrders = {
  // =========================================================================
  // WORK ORDERS (4 Admin Panel ops ONLY — NO validate-zone/initiate/dispatch/complete)
  // =========================================================================
  async getWorkOrdersPage(
    query: WorkOrdersQuery = {},
    signal?: AbortSignal
  ): Promise<CursorPageResponse<WorkOrder>> {
    checkAbort(signal);
    const endpoint = buildWorkOrdersEndpoint(query);
    store.recordEndpoint('WORK_ORDERS_LIST', endpoint);

    let items = [...store.workOrders];
    if (query.wo_id?.trim()) {
      const needle = query.wo_id.trim().toLowerCase();
      items = items.filter(
        (w) =>
          w.wo_id.toLowerCase().includes(needle) ||
          w.order_number.toLowerCase().includes(needle)
      );
    }
    if (query.status) {
      items = items.filter((w) => w.status === query.status);
    }
    if (query.machine_id && query.machine_id !== 'ALL') {
      items = items.filter((w) => w.machine_id === query.machine_id);
    }
    if (query.product_id && query.product_id !== 'ALL') {
      items = items.filter((w) => w.product_id === query.product_id);
    }
    if (query.operator_id && query.operator_id !== 'ALL') {
      items = items.filter((w) => w.operator_id === query.operator_id);
    }
    if (query.from) {
      const fromMs = new Date(query.from).getTime();
      if (!Number.isNaN(fromMs)) {
        items = items.filter((w) => new Date(w.planned_start).getTime() >= fromMs);
      }
    }
    if (query.to) {
      const toMs = new Date(query.to).getTime();
      if (!Number.isNaN(toMs)) {
        items = items.filter((w) => new Date(w.planned_start).getTime() <= toMs);
      }
    }

    return paginateWithCursor(items, (w) => w.planned_start, {
      cursor: query.cursor,
      limit: query.limit ?? 50,
      maxLimit: 100,
    });
  },

  async getWorkOrders(signal?: AbortSignal): Promise<WorkOrder[]> {
    const page = await demoWorkOrders.getWorkOrdersPage({ limit: 100 }, signal);
    return page.data;
  },

  async getWorkOrderById(woId: string, signal?: AbortSignal): Promise<WorkOrder> {
    checkAbort(signal);
    store.recordEndpoint('WORK_ORDERS_GET', ADMIN_ENDPOINTS.WORK_ORDERS_GET.buildPath(woId));
    const wo = store.workOrders.find((w) => w.wo_id === woId);
    if (!wo) {
      throw new ApiError({ code: 'WO_NOT_FOUND', message: `Work Order "${woId}" tidak ditemukan.`, httpStatus: 404 });
    }
    return { ...wo };
  },

  async resolveWorkOrder(woId: string, deviceId?: string, signal?: AbortSignal): Promise<WorkOrderResolveResult> {
    checkAbort(signal);
    const base = ADMIN_ENDPOINTS.WORK_ORDERS_RESOLVE.buildPath(woId);
    const resolvedPath = deviceId ? `${base}?device_id=${encodeURIComponent(deviceId)}` : base;
    store.recordEndpoint('WORK_ORDERS_RESOLVE', resolvedPath);

    const wo = store.workOrders.find((w) => w.wo_id === woId);
    if (!wo) {
      throw new ApiError({ code: 'WO_NOT_FOUND', message: `Work Order "${woId}" tidak ditemukan.`, httpStatus: 404 });
    }

    const machine = store.machines.find((m) => m.machine_id === wo.machine_id);
    const targetDeviceId = deviceId ?? machine?.bound_device_id ?? undefined;
    const device = targetDeviceId ? store.devices.find((d) => d.device_id === targetDeviceId) : undefined;

    if (device && !device.online) {
      throw new ApiError({
        code: 'DEVICE_OFFLINE',
        message: `Perangkat mesin ${device.device_id} sedang tidak terhubung (offline).`,
        httpStatus: 503,
      });
    }

    const product = store.products.find((p) => p.product_id === wo.product_id);
    const plannedOperatingSec = 25200; // 7 hours net operating after 60m break
    const targetPerHour = Math.round((wo.target_quantity / plannedOperatingSec) * 3600);

    return {
      success: true,
      work_order: {
        wo_id: wo.wo_id,
        machine_id: wo.machine_id,
        product_id: wo.product_id,
        product_name: wo.product_name,
        std_cycle_time_sec: product?.ideal_cycle_time_seconds ?? 45,
        operator_id: wo.operator_id,
        operator_name: wo.operator_name,
        target_qty: wo.target_quantity,
        targetPerHour,
        shift_plan: {
          shift_start: '07:00',
          shift_end: '15:00',
          planned_break_min: 60,
          planned_operating_sec: plannedOperatingSec,
        },
        break: {
          start: '14:00',
          end: '15:00',
          minutes: 60,
        },
        status: wo.status,
      },
    };
  },

  async cancelWorkOrder(woId: string, reason?: string): Promise<WorkOrderCancelResult> {
    assertCapability('work_order.cancel', ['ADMIN'], { resourceId: woId });
    if (reason && reason.length > 500) {
      throwValidationIssues('Alasan pembatalan maksimal 500 karakter.', {
        reason: 'Maksimal 500 karakter.',
      });
    }

    store.recordEndpoint('WORK_ORDERS_CANCEL', ADMIN_ENDPOINTS.WORK_ORDERS_CANCEL.buildPath(woId));
    const wo = store.workOrders.find((w) => w.wo_id === woId);
    if (!wo) {
      throw new ApiError({ code: 'WO_NOT_FOUND', message: `Work Order "${woId}" tidak ditemukan.`, httpStatus: 404 });
    }
    if (wo.status === 'COMPLETED' || wo.status === 'ABORTED') {
      throw new ApiError({
        code: 'WORK_ORDER_CONFLICT',
        message: `Work Order "${woId}" sudah berstatus ${wo.status} dan tidak dapat dibatalkan.`,
        httpStatus: 409,
        activeWoId: wo.wo_id,
      });
    }

    wo.status = 'ABORTED';
    wo.actual_end = new Date().toISOString();
    if (reason?.trim()) {
      wo.cancel_reason = reason.trim();
      wo.notes = reason.trim();
    }
    store.addAudit('WORK_ORDER_CANCELLED', 'WORK_ORDER', woId, `Cancelled Work Order ${woId}: ${reason || '-'}`, {
      machine_id: wo.machine_id,
      machine_name: wo.machine_name ?? '[deleted]',
    });

    return {
      success: true,
      work_order: {
        wo_id: wo.wo_id,
        status: 'ABORTED',
        machine_id: wo.machine_id,
      },
    };
  }
};
