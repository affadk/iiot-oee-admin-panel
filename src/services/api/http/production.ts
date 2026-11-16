/**
 * Method HTTP — domain production.
 *
 * Dipisah dari file god-file pada refactoring R9 (kontrak docs/DIRECTORY_STRUCTURE.md).
 * Satu file = satu domain. Barrel penggabung ada di file induknya.
 */
import { MUTATION_TIMEOUT_MS, assertLanForMutation, assertAuthenticatedHttp, reqJson, reqList, checkAbortHttp } from './transport';
import { mapProductionLine, mapShift, mapShiftSchedule } from './mappers';
import { ADMIN_ENDPOINTS } from '../endpoints';
import { ProductionLine, Shift, ShiftSchedule } from '../../../types/production';
import { CursorPageResponse } from '../../../types/historical';

export const httpProduction = {
  // -- Production Lines / Shifts / Shift Schedules (5 ops masing-masing) -----
  async getProductionLinesPage(
    query: { cursor?: string | null; limit?: number; envelope?: boolean } = {},
    signal?: AbortSignal,
  ): Promise<CursorPageResponse<ProductionLine>> {
    checkAbortHttp(signal);
    assertAuthenticatedHttp();
    return reqList(
      {
        path: ADMIN_ENDPOINTS.PRODUCTION_LINES_LIST.buildPath(),
        query: { limit: query.limit ?? 50, envelope: true, ...(query.cursor ? { cursor: query.cursor } : {}) },
        signal,
        endpointKey: 'PRODUCTION_LINES_LIST',
        capability: 'production_line.read',
      },
      mapProductionLine,
      query.limit ?? 50,
    );
  },

  async getProductionLineById(lineId: string, signal?: AbortSignal): Promise<ProductionLine> {
    checkAbortHttp(signal);
    assertAuthenticatedHttp();
    return reqJson(
      { path: ADMIN_ENDPOINTS.PRODUCTION_LINES_GET.buildPath(lineId), signal, endpointKey: 'PRODUCTION_LINES_GET', capability: 'production_line.read', resourceId: lineId },
      mapProductionLine,
    );
  },

  async createProductionLine(data: { lineId: string; lineName: string; description?: string | null; isActive?: boolean }): Promise<ProductionLine> {
    assertAuthenticatedHttp();
    assertLanForMutation();
    return reqJson(
      {
        method: 'POST',
        path: ADMIN_ENDPOINTS.PRODUCTION_LINES_CREATE.buildPath(),
        body: { lineId: data.lineId.trim(), lineName: data.lineName.trim(), description: data.description ?? null, isActive: data.isActive ?? true },
        timeoutMs: MUTATION_TIMEOUT_MS,
        retry: false,
        endpointKey: 'PRODUCTION_LINES_CREATE',
        capability: 'production_line.manage',
        resourceId: data.lineId,
      },
      mapProductionLine,
    );
  },

  async updateProductionLine(
    lineId: string,
    patch: { lineName?: string; description?: string | null; isActive?: boolean },
  ): Promise<ProductionLine> {
    assertAuthenticatedHttp();
    assertLanForMutation();
    return reqJson(
      {
        method: 'PATCH',
        path: ADMIN_ENDPOINTS.PRODUCTION_LINES_UPDATE.buildPath(lineId),
        body: { ...patch },
        timeoutMs: MUTATION_TIMEOUT_MS,
        retry: false,
        endpointKey: 'PRODUCTION_LINES_UPDATE',
        capability: 'production_line.manage',
        resourceId: lineId,
      },
      mapProductionLine,
    );
  },

  async deleteProductionLine(lineId: string): Promise<{ success: boolean }> {
    assertAuthenticatedHttp();
    assertLanForMutation();
    const raw = await reqJson<{ success?: boolean } | undefined>({
      method: 'DELETE',
      path: ADMIN_ENDPOINTS.PRODUCTION_LINES_DELETE.buildPath(lineId),
      timeoutMs: MUTATION_TIMEOUT_MS,
      retry: false,
      endpointKey: 'PRODUCTION_LINES_DELETE',
      capability: 'production_line.manage',
      resourceId: lineId,
    });
    return { success: raw?.success ?? true };
  },

  async getShiftsPage(
    query: { cursor?: string | null; limit?: number; envelope?: boolean } = {},
    signal?: AbortSignal,
  ): Promise<CursorPageResponse<Shift>> {
    checkAbortHttp(signal);
    assertAuthenticatedHttp();
    return reqList(
      {
        path: ADMIN_ENDPOINTS.SHIFTS_LIST.buildPath(),
        query: { limit: query.limit ?? 50, envelope: true, ...(query.cursor ? { cursor: query.cursor } : {}) },
        signal,
        endpointKey: 'SHIFTS_LIST',
        capability: 'shift.read',
      },
      mapShift,
      query.limit ?? 50,
    );
  },

  async getShiftById(shiftId: string, signal?: AbortSignal): Promise<Shift> {
    checkAbortHttp(signal);
    assertAuthenticatedHttp();
    return reqJson(
      { path: ADMIN_ENDPOINTS.SHIFTS_GET.buildPath(shiftId), signal, endpointKey: 'SHIFTS_GET', capability: 'shift.read', resourceId: shiftId },
      mapShift,
    );
  },

  async createShift(data: { shiftId: string; shiftName: string; shiftCode: string; startTime: string; endTime: string; isActive?: boolean }): Promise<Shift> {
    assertAuthenticatedHttp();
    assertLanForMutation();
    return reqJson(
      {
        method: 'POST',
        path: ADMIN_ENDPOINTS.SHIFTS_CREATE.buildPath(),
        body: { shiftId: data.shiftId.trim(), shiftName: data.shiftName.trim(), shiftCode: data.shiftCode.trim(), startTime: data.startTime, endTime: data.endTime, isActive: data.isActive ?? true },
        timeoutMs: MUTATION_TIMEOUT_MS,
        retry: false,
        endpointKey: 'SHIFTS_CREATE',
        capability: 'shift.manage',
        resourceId: data.shiftId,
      },
      mapShift,
    );
  },

  async updateShift(
    shiftId: string,
    patch: { shiftName?: string; shiftCode?: string; startTime?: string; endTime?: string; isActive?: boolean },
  ): Promise<Shift> {
    assertAuthenticatedHttp();
    assertLanForMutation();
    return reqJson(
      {
        method: 'PATCH',
        path: ADMIN_ENDPOINTS.SHIFTS_UPDATE.buildPath(shiftId),
        body: { ...patch },
        timeoutMs: MUTATION_TIMEOUT_MS,
        retry: false,
        endpointKey: 'SHIFTS_UPDATE',
        capability: 'shift.manage',
        resourceId: shiftId,
      },
      mapShift,
    );
  },

  async deleteShift(shiftId: string): Promise<{ success: boolean }> {
    assertAuthenticatedHttp();
    assertLanForMutation();
    const raw = await reqJson<{ success?: boolean } | undefined>({
      method: 'DELETE',
      path: ADMIN_ENDPOINTS.SHIFTS_DELETE.buildPath(shiftId),
      timeoutMs: MUTATION_TIMEOUT_MS,
      retry: false,
      endpointKey: 'SHIFTS_DELETE',
      capability: 'shift.manage',
      resourceId: shiftId,
    });
    return { success: raw?.success ?? true };
  },

  async getShiftSchedulesPage(
    query: { line_id?: string; shift_id?: string; day_of_week?: number; is_active?: boolean; cursor?: string | null; limit?: number; envelope?: boolean } = {},
    signal?: AbortSignal,
  ): Promise<CursorPageResponse<ShiftSchedule>> {
    checkAbortHttp(signal);
    assertAuthenticatedHttp();
    return reqList(
      {
        path: ADMIN_ENDPOINTS.SHIFT_SCHEDULES_LIST.buildPath(),
        query: {
          limit: query.limit ?? 50,
          envelope: true,
          ...(query.line_id ? { line_id: query.line_id } : {}),
          ...(query.shift_id ? { shift_id: query.shift_id } : {}),
          ...(query.day_of_week !== undefined ? { day_of_week: query.day_of_week } : {}),
          ...(query.is_active !== undefined ? { is_active: query.is_active } : {}),
          ...(query.cursor ? { cursor: query.cursor } : {}),
        },
        signal,
        endpointKey: 'SHIFT_SCHEDULES_LIST',
        capability: 'shift_schedule.read',
      },
      mapShiftSchedule,
      query.limit ?? 50,
    );
  },

  async getShiftScheduleById(scheduleId: string, signal?: AbortSignal): Promise<ShiftSchedule> {
    checkAbortHttp(signal);
    assertAuthenticatedHttp();
    return reqJson(
      { path: ADMIN_ENDPOINTS.SHIFT_SCHEDULES_GET.buildPath(scheduleId), signal, endpointKey: 'SHIFT_SCHEDULES_GET', capability: 'shift_schedule.read', resourceId: scheduleId },
      mapShiftSchedule,
    );
  },

  async createShiftSchedule(data: { lineId: string; shiftId: string; dayOfWeek: number; isActive?: boolean }): Promise<ShiftSchedule> {
    assertAuthenticatedHttp();
    assertLanForMutation();
    return reqJson(
      {
        method: 'POST',
        path: ADMIN_ENDPOINTS.SHIFT_SCHEDULES_CREATE.buildPath(),
        body: { lineId: data.lineId, shiftId: data.shiftId, dayOfWeek: data.dayOfWeek, isActive: data.isActive ?? true },
        timeoutMs: MUTATION_TIMEOUT_MS,
        retry: false,
        endpointKey: 'SHIFT_SCHEDULES_CREATE',
        capability: 'shift_schedule.manage',
      },
      mapShiftSchedule,
    );
  },

  async updateShiftSchedule(
    scheduleId: string,
    patch: { lineId?: string; shiftId?: string; dayOfWeek?: number; isActive?: boolean },
  ): Promise<ShiftSchedule> {
    assertAuthenticatedHttp();
    assertLanForMutation();
    return reqJson(
      {
        method: 'PATCH',
        path: ADMIN_ENDPOINTS.SHIFT_SCHEDULES_UPDATE.buildPath(scheduleId),
        body: { ...patch },
        timeoutMs: MUTATION_TIMEOUT_MS,
        retry: false,
        endpointKey: 'SHIFT_SCHEDULES_UPDATE',
        capability: 'shift_schedule.manage',
        resourceId: scheduleId,
      },
      mapShiftSchedule,
    );
  },

  async deleteShiftSchedule(scheduleId: string): Promise<{ success: boolean }> {
    assertAuthenticatedHttp();
    assertLanForMutation();
    const raw = await reqJson<{ success?: boolean } | undefined>({
      method: 'DELETE',
      path: ADMIN_ENDPOINTS.SHIFT_SCHEDULES_DELETE.buildPath(scheduleId),
      timeoutMs: MUTATION_TIMEOUT_MS,
      retry: false,
      endpointKey: 'SHIFT_SCHEDULES_DELETE',
      capability: 'shift_schedule.manage',
      resourceId: scheduleId,
    });
    return { success: raw?.success ?? true };
  }
};
