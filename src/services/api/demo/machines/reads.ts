/**
 * Method demo — domain machines: baca + histori status.
 *
 * Dipisah dari demo/machines.ts (519 baris) pada E32.5 (FAT-286), mengikuti
 * pola R9.2 (kontrak docs/DIRECTORY_STRUCTURE.md). Satu file = satu
 * sub-domain. Barrel penggabung ada di file induknya (../machines.ts).
 */
import { store } from '../store';
import { checkAbort, enrichAndValidateMachine } from '../helpers';
import { ADMIN_ENDPOINTS } from '../../endpoints';
import { Machine, MachineStatusHistoryItem } from '../../../../types/assets';
import { ApiError } from '../../../../types/auth';
import { CursorPageResponse } from '../../../../types/historical';
import { MachineSchema, normalizeListResponse } from '../../schemas';
import { paginateWithCursor } from '../../../../utils/historicalExport';
import { normalizeFsmState } from '../../../../utils/oeeCalculations';

export const demoMachinesReads = {
  async getMachinesPage(
    query: { cursor?: string | null; limit?: number } = {},
    signal?: AbortSignal
  ): Promise<CursorPageResponse<Machine>> {
    checkAbort(signal);
    const qs = new URLSearchParams({ envelope: 'true' });
    if (query.limit) qs.set('limit', String(query.limit));
    if (query.cursor) qs.set('cursor', query.cursor);
    store.recordEndpoint('MACHINES_LIST', `${ADMIN_ENDPOINTS.MACHINES_LIST.buildPath()}?${qs.toString()}`);
    const page = paginateWithCursor(
      store.machines.map((m) => enrichAndValidateMachine(m)),
      (m) => m.created_at,
      {
        cursor: query.cursor,
        limit: query.limit ?? 50,
        maxLimit: 100,
      }
    );
    return normalizeListResponse(page, MachineSchema, query.limit ?? 50);
  },

  async getMachines(signal?: AbortSignal): Promise<Machine[]> {
    checkAbort(signal);
    store.recordEndpoint('MACHINES_LIST', ADMIN_ENDPOINTS.MACHINES_LIST.buildPath());
    return store.machines.map((m) => enrichAndValidateMachine(m));
  },

  async getMachineById(machineId: string, signal?: AbortSignal): Promise<Machine> {
    checkAbort(signal);
    store.recordEndpoint('MACHINES_GET', ADMIN_ENDPOINTS.MACHINES_GET.buildPath(machineId));
    const machine = store.machines.find((m) => m.machine_id === machineId);
    if (!machine) {
      throw new ApiError({
        code: 'MACHINE_NOT_FOUND',
        message: `Mesin "${machineId}" tidak ditemukan.`,
        httpStatus: 404,
      });
    }
    return enrichAndValidateMachine(machine);
  },

  async getMachineStatusHistory(
    machineId: string,
    query: { from?: string; to?: string; limit?: number; cursor?: string | null } = {},
    signal?: AbortSignal
  ): Promise<CursorPageResponse<MachineStatusHistoryItem>> {
    checkAbort(signal);
    const qs = new URLSearchParams({ envelope: 'true' });
    if (query.from) qs.set('from', query.from);
    if (query.to) qs.set('to', query.to);
    if (query.limit) qs.set('limit', String(query.limit));
    if (query.cursor) qs.set('cursor', query.cursor);
    store.recordEndpoint(
      'MACHINES_STATUS_HISTORY',
      `${ADMIN_ENDPOINTS.MACHINES_STATUS_HISTORY.buildPath(machineId)}?${qs.toString()}`
    );
    const machine = store.machines.find((m) => m.machine_id === machineId);
    if (!machine) {
      throw new ApiError({ code: 'MACHINE_NOT_FOUND', message: `Mesin "${machineId}" tidak ditemukan.`, httpStatus: 404 });
    }
    // Demo: satu segmen status berjalan (state live saat ini).
    const live = store.liveStates.find((l) => l.machine_id === machineId);
    const startedAt = new Date(Date.now() - 3600_000).toISOString();
    const item: MachineStatusHistoryItem = {
      id: `msh-${machineId}-current`,
      deviceId: machine.bound_device_id,
      machineId,
      state: live ? normalizeFsmState(live.fsm_state) : 'RUNNING',
      startedAt,
      endedAt: null,
      durationSec: 3600,
      triggerSource: 'SYSTEM',
      isActive: true,
    };
    return paginateWithCursor([item], (i) => i.startedAt, {
      cursor: query.cursor,
      limit: query.limit ?? 50,
      maxLimit: 100,
    });
  }
};
