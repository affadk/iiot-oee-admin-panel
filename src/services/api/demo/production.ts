/**
 * Method demo — domain production.
 *
 * Dipisah dari file god-file pada refactoring R9 (kontrak docs/DIRECTORY_STRUCTURE.md).
 * Satu file = satu domain. Barrel penggabung ada di file induknya.
 */
import { store } from './store';
import { assertNoScheduleOverlap, checkAbort, assertCapability, throwValidationIssues } from './helpers';
import { ADMIN_ENDPOINTS } from '../endpoints';
import { ProductionLine, Shift, ShiftSchedule } from '../../../types/production';
import { ApiError } from '../../../types/auth';
import { CursorPageResponse } from '../../../types/historical';
import { validateProductionLineInput, validateShiftInput, validateShiftScheduleInput } from '../../../utils/capabilities';
import { ProductionLineSchema, ShiftSchema, ShiftScheduleSchema, normalizeListResponse } from '../schemas';
import { paginateWithCursor } from '../../../utils/historicalExport';

export const demoProduction = {
  // =========================================================================
  // PRODUCTION LINES / SHIFTS / SHIFT SCHEDULES (15 ops)
  // =========================================================================
  async getProductionLinesPage(
    query: { cursor?: string | null; limit?: number; envelope?: boolean } = {},
    signal?: AbortSignal
  ): Promise<CursorPageResponse<ProductionLine>> {
    checkAbort(signal);
    const qs = new URLSearchParams({ envelope: 'true' });
    if (query.limit) qs.set('limit', String(query.limit));
    if (query.cursor) qs.set('cursor', query.cursor);
    store.recordEndpoint('PRODUCTION_LINES_LIST', `${ADMIN_ENDPOINTS.PRODUCTION_LINES_LIST.buildPath()}?${qs.toString()}`);
    const page = paginateWithCursor(
      store.productionLines.map((l) => ({ ...l })),
      (l) => l.createdAt,
      { cursor: query.cursor, limit: query.limit ?? 50, maxLimit: 100 }
    );
    return normalizeListResponse(page, ProductionLineSchema, query.limit ?? 50);
  },

  async getProductionLineById(lineId: string, signal?: AbortSignal): Promise<ProductionLine> {
    checkAbort(signal);
    store.recordEndpoint('PRODUCTION_LINES_GET', ADMIN_ENDPOINTS.PRODUCTION_LINES_GET.buildPath(lineId));
    const line = store.productionLines.find((l) => l.lineId === lineId);
    if (!line) {
      throw new ApiError({ code: 'PRODUCTION_LINE_NOT_FOUND', message: `Lini produksi "${lineId}" tidak ditemukan.`, httpStatus: 404 });
    }
    return { ...line };
  },

  async createProductionLine(data: {
    lineId: string;
    lineName: string;
    description?: string | null;
    isActive?: boolean;
  }): Promise<ProductionLine> {
    assertCapability('production_line.manage', ['ADMIN'], { resourceId: data.lineId });
    const errors = validateProductionLineInput({
      lineId: data.lineId,
      lineName: data.lineName,
      description: data.description,
      isCreate: true,
    });
    if (Object.keys(errors).length > 0) {
      throwValidationIssues('Validasi pembuatan lini produksi gagal.', errors);
    }
    store.recordEndpoint('PRODUCTION_LINES_CREATE', ADMIN_ENDPOINTS.PRODUCTION_LINES_CREATE.buildPath());
    const id = data.lineId.trim();
    if (store.productionLines.some((l) => l.lineId === id)) {
      throw new ApiError({ code: 'PRODUCTION_LINE_ALREADY_EXISTS', message: `Line ID "${id}" sudah ada.`, httpStatus: 409 });
    }
    const created: ProductionLine = {
      lineId: id,
      lineName: data.lineName.trim(),
      description: data.description?.trim() || null,
      isActive: data.isActive ?? true,
      createdAt: new Date().toISOString(),
    };
    store.productionLines.push(created);
    store.addAudit('CREATE_PRODUCTION_LINE', 'PRODUCTION_LINE', created.lineId, `Created production line ${created.lineId} (${created.lineName})`);
    return { ...created };
  },

  async updateProductionLine(
    lineId: string,
    patch: { lineName?: string; description?: string | null; isActive?: boolean }
  ): Promise<ProductionLine> {
    assertCapability('production_line.manage', ['ADMIN'], { resourceId: lineId });
    const errors = validateProductionLineInput({
      lineName: patch.lineName,
      description: patch.description,
    });
    if (Object.keys(errors).length > 0) {
      throwValidationIssues('Validasi perubahan lini produksi gagal.', errors);
    }
    store.recordEndpoint('PRODUCTION_LINES_UPDATE', ADMIN_ENDPOINTS.PRODUCTION_LINES_UPDATE.buildPath(lineId));
    const line = store.productionLines.find((l) => l.lineId === lineId);
    if (!line) {
      throw new ApiError({ code: 'PRODUCTION_LINE_NOT_FOUND', message: `Lini produksi "${lineId}" tidak ditemukan.`, httpStatus: 404 });
    }
    if (patch.lineName !== undefined) line.lineName = patch.lineName.trim();
    if (patch.description !== undefined) line.description = patch.description?.trim() || null;
    if (patch.isActive !== undefined) line.isActive = patch.isActive;
    store.addAudit('UPDATE_PRODUCTION_LINE', 'PRODUCTION_LINE', lineId, `Updated production line ${lineId}`);
    return { ...line };
  },

  async deleteProductionLine(lineId: string): Promise<{ success: boolean }> {
    assertCapability('production_line.manage', ['ADMIN'], { resourceId: lineId });
    store.recordEndpoint('PRODUCTION_LINES_DELETE', ADMIN_ENDPOINTS.PRODUCTION_LINES_DELETE.buildPath(lineId));
    const line = store.productionLines.find((l) => l.lineId === lineId);
    if (!line) {
      throw new ApiError({ code: 'PRODUCTION_LINE_NOT_FOUND', message: `Lini produksi "${lineId}" tidak ditemukan.`, httpStatus: 404 });
    }
    // ON DELETE RESTRICT: lini yang masih dipakai mesin/operator tidak boleh dihapus.
    const inUseByMachine = store.machines.find((m) => m.line_id === lineId);
    const inUseByOperator = store.operators.find((o) => o.line_id === lineId);
    if (inUseByMachine || inUseByOperator) {
      const who = inUseByMachine ? `mesin ${inUseByMachine.machine_id}` : `operator ${inUseByOperator!.operator_id}`;
      throw new ApiError({
        code: 'PRODUCTION_LINE_IN_USE',
        message: `Tidak dapat menghapus lini: masih dipakai oleh ${who}. Pindahkan dulu referensinya.`,
        httpStatus: 409,
      });
    }
    store.productionLines = store.productionLines.filter((l) => l.lineId !== lineId);
    store.addAudit('DELETE_PRODUCTION_LINE', 'PRODUCTION_LINE', lineId, `Deleted production line ${lineId} (riwayat shift & WO tetap tersimpan)`);
    return { success: true };
  },

  async getShiftsPage(
    query: { cursor?: string | null; limit?: number; envelope?: boolean } = {},
    signal?: AbortSignal
  ): Promise<CursorPageResponse<Shift>> {
    checkAbort(signal);
    const qs = new URLSearchParams({ envelope: 'true' });
    if (query.limit) qs.set('limit', String(query.limit));
    if (query.cursor) qs.set('cursor', query.cursor);
    store.recordEndpoint('SHIFTS_LIST', `${ADMIN_ENDPOINTS.SHIFTS_LIST.buildPath()}?${qs.toString()}`);
    const page = paginateWithCursor(
      store.shifts.map((s) => ({ ...s })),
      (s) => s.createdAt,
      { cursor: query.cursor, limit: query.limit ?? 50, maxLimit: 100 }
    );
    return normalizeListResponse(page, ShiftSchema, query.limit ?? 50);
  },

  async getShiftById(shiftId: string, signal?: AbortSignal): Promise<Shift> {
    checkAbort(signal);
    store.recordEndpoint('SHIFTS_GET', ADMIN_ENDPOINTS.SHIFTS_GET.buildPath(shiftId));
    const shift = store.shifts.find((s) => s.shiftId === shiftId);
    if (!shift) {
      throw new ApiError({ code: 'SHIFT_NOT_FOUND', message: `Shift "${shiftId}" tidak ditemukan.`, httpStatus: 404 });
    }
    return { ...shift };
  },

  async createShift(data: {
    shiftId: string;
    shiftName: string;
    shiftCode: string;
    startTime: string;
    endTime: string;
    isActive?: boolean;
  }): Promise<Shift> {
    assertCapability('shift.manage', ['ADMIN'], { resourceId: data.shiftId });
    const errors = validateShiftInput({
      shiftId: data.shiftId,
      shiftName: data.shiftName,
      shiftCode: data.shiftCode,
      startTime: data.startTime,
      endTime: data.endTime,
      isCreate: true,
    });
    if (Object.keys(errors).length > 0) {
      throwValidationIssues('Validasi pembuatan shift gagal.', errors);
    }
    store.recordEndpoint('SHIFTS_CREATE', ADMIN_ENDPOINTS.SHIFTS_CREATE.buildPath());
    const id = data.shiftId.trim();
    if (store.shifts.some((s) => s.shiftId === id)) {
      throw new ApiError({ code: 'SHIFT_ALREADY_EXISTS', message: `Shift ID "${id}" sudah ada.`, httpStatus: 409 });
    }
    const created: Shift = {
      shiftId: id,
      shiftName: data.shiftName.trim(),
      shiftCode: data.shiftCode.trim(),
      startTime: data.startTime,
      endTime: data.endTime,
      isActive: data.isActive ?? true,
      createdAt: new Date().toISOString(),
    };
    store.shifts.push(created);
    store.addAudit('CREATE_SHIFT', 'SHIFT', created.shiftId, `Created shift ${created.shiftId} (${created.shiftName})`);
    return { ...created };
  },

  async updateShift(
    shiftId: string,
    patch: { shiftName?: string; shiftCode?: string; startTime?: string; endTime?: string; isActive?: boolean }
  ): Promise<Shift> {
    assertCapability('shift.manage', ['ADMIN'], { resourceId: shiftId });
    const errors = validateShiftInput({
      shiftName: patch.shiftName,
      shiftCode: patch.shiftCode,
      startTime: patch.startTime,
      endTime: patch.endTime,
    });
    if (Object.keys(errors).length > 0) {
      throwValidationIssues('Validasi perubahan shift gagal.', errors);
    }
    store.recordEndpoint('SHIFTS_UPDATE', ADMIN_ENDPOINTS.SHIFTS_UPDATE.buildPath(shiftId));
    const shift = store.shifts.find((s) => s.shiftId === shiftId);
    if (!shift) {
      throw new ApiError({ code: 'SHIFT_NOT_FOUND', message: `Shift "${shiftId}" tidak ditemukan.`, httpStatus: 404 });
    }
    if (patch.shiftName !== undefined) shift.shiftName = patch.shiftName.trim();
    if (patch.shiftCode !== undefined) shift.shiftCode = patch.shiftCode.trim();
    if (patch.startTime !== undefined) shift.startTime = patch.startTime;
    if (patch.endTime !== undefined) shift.endTime = patch.endTime;
    if (patch.isActive !== undefined) shift.isActive = patch.isActive;
    // Denormalisasi jadwal yang memakai shift ini ikut diperbarui.
    store.shiftSchedules.forEach((sch) => {
      if (sch.shiftId === shiftId) {
        sch.shiftName = shift.shiftName;
        sch.shiftCode = shift.shiftCode;
        sch.startTime = shift.startTime;
        sch.endTime = shift.endTime;
      }
    });
    store.addAudit('UPDATE_SHIFT', 'SHIFT', shiftId, `Updated shift ${shiftId}`);
    return { ...shift };
  },

  async deleteShift(shiftId: string): Promise<{ success: boolean }> {
    assertCapability('shift.manage', ['ADMIN'], { resourceId: shiftId });
    store.recordEndpoint('SHIFTS_DELETE', ADMIN_ENDPOINTS.SHIFTS_DELETE.buildPath(shiftId));
    const shift = store.shifts.find((s) => s.shiftId === shiftId);
    if (!shift) {
      throw new ApiError({ code: 'SHIFT_NOT_FOUND', message: `Shift "${shiftId}" tidak ditemukan.`, httpStatus: 404 });
    }
    const inUse = store.shiftSchedules.find((sch) => sch.shiftId === shiftId);
    if (inUse) {
      throw new ApiError({
        code: 'SHIFT_IN_USE',
        message: `Tidak dapat menghapus shift: masih dipakai jadwal ${inUse.scheduleId} (lini ${inUse.lineId}). Hapus jadwalnya dulu.`,
        httpStatus: 409,
      });
    }
    store.shifts = store.shifts.filter((s) => s.shiftId !== shiftId);
    store.addAudit('DELETE_SHIFT', 'SHIFT', shiftId, `Deleted shift ${shiftId} (riwayat shift summary tetap tersimpan)`);
    return { success: true };
  },

  async getShiftSchedulesPage(
    query: { line_id?: string; shift_id?: string; day_of_week?: number; is_active?: boolean; cursor?: string | null; limit?: number; envelope?: boolean } = {},
    signal?: AbortSignal
  ): Promise<CursorPageResponse<ShiftSchedule>> {
    checkAbort(signal);
    const qs = new URLSearchParams({ envelope: 'true' });
    if (query.line_id) qs.set('line_id', query.line_id);
    if (query.shift_id) qs.set('shift_id', query.shift_id);
    if (query.day_of_week !== undefined) qs.set('day_of_week', String(query.day_of_week));
    if (query.is_active !== undefined) qs.set('is_active', String(query.is_active));
    if (query.limit) qs.set('limit', String(query.limit));
    if (query.cursor) qs.set('cursor', query.cursor);
    store.recordEndpoint('SHIFT_SCHEDULES_LIST', `${ADMIN_ENDPOINTS.SHIFT_SCHEDULES_LIST.buildPath()}?${qs.toString()}`);
    let items = store.shiftSchedules.map((s) => ({ ...s }));
    if (query.line_id) items = items.filter((s) => s.lineId === query.line_id);
    if (query.shift_id) items = items.filter((s) => s.shiftId === query.shift_id);
    if (query.day_of_week !== undefined) items = items.filter((s) => s.dayOfWeek === query.day_of_week);
    if (query.is_active !== undefined) items = items.filter((s) => s.isActive === query.is_active);
    const page = paginateWithCursor(items, (s) => s.createdAt, {
      cursor: query.cursor,
      limit: query.limit ?? 50,
      maxLimit: 100,
    });
    return normalizeListResponse(page, ShiftScheduleSchema, query.limit ?? 50);
  },

  async getShiftScheduleById(scheduleId: string, signal?: AbortSignal): Promise<ShiftSchedule> {
    checkAbort(signal);
    store.recordEndpoint('SHIFT_SCHEDULES_GET', ADMIN_ENDPOINTS.SHIFT_SCHEDULES_GET.buildPath(scheduleId));
    const sch = store.shiftSchedules.find((s) => s.scheduleId === scheduleId);
    if (!sch) {
      throw new ApiError({ code: 'SHIFT_SCHEDULE_NOT_FOUND', message: `Jadwal shift "${scheduleId}" tidak ditemukan.`, httpStatus: 404 });
    }
    return { ...sch };
  },

  async createShiftSchedule(data: {
    lineId: string;
    shiftId: string;
    dayOfWeek: number;
    isActive?: boolean;
  }): Promise<ShiftSchedule> {
    assertCapability('shift_schedule.manage', ['ADMIN']);
    const errors = validateShiftScheduleInput({
      lineId: data.lineId,
      shiftId: data.shiftId,
      dayOfWeek: data.dayOfWeek,
      isCreate: true,
    });
    if (Object.keys(errors).length > 0) {
      throwValidationIssues('Validasi pembuatan jadwal shift gagal.', errors);
    }
    const line = store.productionLines.find((l) => l.lineId === data.lineId);
    if (!line) {
      throw new ApiError({ code: 'PRODUCTION_LINE_NOT_FOUND', message: `Lini produksi "${data.lineId}" tidak ditemukan.`, httpStatus: 404 });
    }
    const shift = store.shifts.find((s) => s.shiftId === data.shiftId);
    if (!shift) {
      throw new ApiError({ code: 'SHIFT_NOT_FOUND', message: `Shift "${data.shiftId}" tidak ditemukan.`, httpStatus: 404 });
    }
    store.recordEndpoint('SHIFT_SCHEDULES_CREATE', ADMIN_ENDPOINTS.SHIFT_SCHEDULES_CREATE.buildPath());
    assertNoScheduleOverlap(data.lineId, data.shiftId, data.dayOfWeek, null);
    const scheduleId = `sched-${data.lineId.toLowerCase()}-${data.shiftId.toLowerCase()}-d${data.dayOfWeek}`;
    if (store.shiftSchedules.some((s) => s.scheduleId === scheduleId)) {
      throw new ApiError({ code: 'SHIFT_SCHEDULE_ALREADY_EXISTS', message: `Jadwal untuk lini ${data.lineId} / shift ${data.shiftId} / hari ${data.dayOfWeek} sudah ada.`, httpStatus: 409 });
    }
    const created: ShiftSchedule = {
      scheduleId,
      lineId: data.lineId,
      shiftId: data.shiftId,
      dayOfWeek: data.dayOfWeek,
      isActive: data.isActive ?? true,
      shiftName: shift.shiftName,
      shiftCode: shift.shiftCode,
      startTime: shift.startTime,
      endTime: shift.endTime,
      createdAt: new Date().toISOString(),
    };
    store.shiftSchedules.push(created);
    store.addAudit('CREATE_SHIFT_SCHEDULE', 'SHIFT_SCHEDULE', created.scheduleId, `Created shift schedule ${created.scheduleId}`);
    return { ...created };
  },

  async updateShiftSchedule(
    scheduleId: string,
    patch: { lineId?: string; shiftId?: string; dayOfWeek?: number; isActive?: boolean }
  ): Promise<ShiftSchedule> {
    assertCapability('shift_schedule.manage', ['ADMIN'], { resourceId: scheduleId });
    const errors = validateShiftScheduleInput({
      lineId: patch.lineId,
      shiftId: patch.shiftId,
      dayOfWeek: patch.dayOfWeek,
    });
    if (Object.keys(errors).length > 0) {
      throwValidationIssues('Validasi perubahan jadwal shift gagal.', errors);
    }
    store.recordEndpoint('SHIFT_SCHEDULES_UPDATE', ADMIN_ENDPOINTS.SHIFT_SCHEDULES_UPDATE.buildPath(scheduleId));
    const sch = store.shiftSchedules.find((s) => s.scheduleId === scheduleId);
    if (!sch) {
      throw new ApiError({ code: 'SHIFT_SCHEDULE_NOT_FOUND', message: `Jadwal shift "${scheduleId}" tidak ditemukan.`, httpStatus: 404 });
    }
    const nextLineId = patch.lineId ?? sch.lineId;
    const nextShiftId = patch.shiftId ?? sch.shiftId;
    const nextDay = patch.dayOfWeek ?? sch.dayOfWeek;
    if (!store.productionLines.some((l) => l.lineId === nextLineId)) {
      throw new ApiError({ code: 'PRODUCTION_LINE_NOT_FOUND', message: `Lini produksi "${nextLineId}" tidak ditemukan.`, httpStatus: 404 });
    }
    const nextShift = store.shifts.find((s) => s.shiftId === nextShiftId);
    if (!nextShift) {
      throw new ApiError({ code: 'SHIFT_NOT_FOUND', message: `Shift "${nextShiftId}" tidak ditemukan.`, httpStatus: 404 });
    }
    assertNoScheduleOverlap(nextLineId, nextShiftId, nextDay, scheduleId);
    sch.lineId = nextLineId;
    sch.shiftId = nextShiftId;
    sch.dayOfWeek = nextDay;
    if (patch.isActive !== undefined) sch.isActive = patch.isActive;
    sch.shiftName = nextShift.shiftName;
    sch.shiftCode = nextShift.shiftCode;
    sch.startTime = nextShift.startTime;
    sch.endTime = nextShift.endTime;
    store.addAudit('UPDATE_SHIFT_SCHEDULE', 'SHIFT_SCHEDULE', scheduleId, `Updated shift schedule ${scheduleId}`);
    return { ...sch };
  },

  async deleteShiftSchedule(scheduleId: string): Promise<{ success: boolean }> {
    assertCapability('shift_schedule.manage', ['ADMIN'], { resourceId: scheduleId });
    store.recordEndpoint('SHIFT_SCHEDULES_DELETE', ADMIN_ENDPOINTS.SHIFT_SCHEDULES_DELETE.buildPath(scheduleId));
    const sch = store.shiftSchedules.find((s) => s.scheduleId === scheduleId);
    if (!sch) {
      throw new ApiError({ code: 'SHIFT_SCHEDULE_NOT_FOUND', message: `Jadwal shift "${scheduleId}" tidak ditemukan.`, httpStatus: 404 });
    }
    store.shiftSchedules = store.shiftSchedules.filter((s) => s.scheduleId !== scheduleId);
    store.addAudit('DELETE_SHIFT_SCHEDULE', 'SHIFT_SCHEDULE', scheduleId, `Deleted shift schedule ${scheduleId} (riwayat shift summary tetap tersimpan)`);
    return { success: true };
  }
};
