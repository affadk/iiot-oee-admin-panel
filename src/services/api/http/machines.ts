/**
 * Method HTTP — domain machines.
 *
 * Dipisah dari file god-file pada refactoring R9 (kontrak docs/DIRECTORY_STRUCTURE.md).
 * Satu file = satu domain. Barrel penggabung ada di file induknya.
 */
import { MUTATION_TIMEOUT_MS, assertLanForMutation, assertAuthenticatedHttp, reqJson, reqList, reqAllPages, checkAbortHttp } from './transport';
import { mapMachine, mapMachineStatusHistory } from './mappers';
import { ADMIN_ENDPOINTS } from '../endpoints';
import { Machine, MachineStatusHistoryItem } from '../../../types/assets';
import { ApiError } from '../../../types/auth';
import { CursorPageResponse } from '../../../types/historical';

export const httpMachines = {
  // -- Machines (8 ops) ------------------------------------------------------
  async getMachinesPage(
    query: { cursor?: string | null; limit?: number } = {},
    signal?: AbortSignal,
  ): Promise<CursorPageResponse<Machine>> {
    checkAbortHttp(signal);
    return reqList(
      {
        path: ADMIN_ENDPOINTS.MACHINES_LIST.buildPath(),
        query: { limit: query.limit ?? 50, envelope: true, ...(query.cursor ? { cursor: query.cursor } : {}) },
        signal,
        endpointKey: 'MACHINES_LIST',
      },
      mapMachine,
      query.limit ?? 50,
    );
  },

  async getMachines(signal?: AbortSignal): Promise<Machine[]> {
    checkAbortHttp(signal);
    return reqAllPages(ADMIN_ENDPOINTS.MACHINES_LIST.buildPath(), mapMachine, signal, 'MACHINES_LIST');
  },

  async getMachineById(machineId: string, signal?: AbortSignal): Promise<Machine> {
    checkAbortHttp(signal);
    return reqJson(
      { path: ADMIN_ENDPOINTS.MACHINES_GET.buildPath(machineId), signal, endpointKey: 'MACHINES_GET', capability: 'machine.read', resourceId: machineId },
      mapMachine,
    );
  },

  async getMachineStatusHistory(
    machineId: string,
    query: { from?: string; to?: string; state?: string; limit?: number; cursor?: string | null } = {},
    signal?: AbortSignal
  ): Promise<CursorPageResponse<MachineStatusHistoryItem>> {
    checkAbortHttp(signal);
    // E20 P20.5 (FAT-157, R6): kirim filter `state` (§F.8:
    // READY|RUNNING|PLANNED_DOWNTIME|UNPLANNED_DOWNTIME|BATCH_FINISHED|
    // UNCONFIGURED|OFFLINE); validasi `from >= to` → 400 INVALID_RANGE
    // dengan pesan yang jelas — JANGAN kirim rentang tak valid ke server.
    if (query.from && query.to && Date.parse(query.from) >= Date.parse(query.to)) {
      throw new ApiError({
        code: 'INVALID_RANGE',
        message: `Rentang riwayat status tidak valid: from (${query.from}) harus lebih awal dari to (${query.to}).`,
        httpStatus: 400,
      });
    }
    return reqList(
      {
        path: ADMIN_ENDPOINTS.MACHINES_STATUS_HISTORY.buildPath(machineId),
        query: {
          limit: query.limit ?? 50,
          envelope: true,
          ...(query.from ? { from: query.from } : {}),
          ...(query.to ? { to: query.to } : {}),
          ...(query.state ? { state: query.state } : {}),
          ...(query.cursor ? { cursor: query.cursor } : {}),
        },
        signal,
        endpointKey: 'MACHINES_STATUS_HISTORY',
        capability: 'machine.read',
        resourceId: machineId,
      },
      mapMachineStatusHistory,
      query.limit ?? 50,
    );
  },

  async createMachine(data: {
    machine_id: string;
    name: string;
    modbus_slave_id?: number;
    bound_device_id?: string | null;
  }): Promise<Machine> {
    assertAuthenticatedHttp();
    assertLanForMutation();
    return reqJson(
      {
        method: 'POST',
        path: ADMIN_ENDPOINTS.MACHINES_CREATE.buildPath(),
        body: {
          machineId: data.machine_id.trim(),
          machineName: data.name.trim(),
          ...(data.bound_device_id ? { deviceId: data.bound_device_id } : {}),
          ...(data.modbus_slave_id !== undefined ? { modbusSlaveId: data.modbus_slave_id } : {}),
        },
        timeoutMs: MUTATION_TIMEOUT_MS,
        retry: false,
        endpointKey: 'MACHINES_CREATE',
        // E20 P20.5 (FAT-157, pembaruan 09:23): POST /machines =
        // authorize("create","machine") — kunci `machine.create`, bukan
        // `machine.manage`. Gating efektif sama (ADMIN LAN only).
        capability: 'machine.create',
        resourceId: data.machine_id,
      },
      mapMachine,
    );
  },

  async updateMachine(
    machineId: string,
    patch: { name?: string; modbus_slave_id?: number },
  ): Promise<Machine> {
    assertAuthenticatedHttp();
    assertLanForMutation();
    return reqJson(
      {
        method: 'PUT',
        path: ADMIN_ENDPOINTS.MACHINES_UPDATE.buildPath(machineId),
        body: {
          ...(patch.name !== undefined ? { machineName: patch.name } : {}),
          ...(patch.modbus_slave_id !== undefined ? { modbusSlaveId: patch.modbus_slave_id } : {}),
        },
        timeoutMs: MUTATION_TIMEOUT_MS,
        retry: false,
        endpointKey: 'MACHINES_UPDATE',
        capability: 'machine.manage',
        resourceId: machineId,
      },
      mapMachine,
    );
  },

  async deleteMachine(machineId: string): Promise<{ success: boolean }> {
    assertAuthenticatedHttp();
    assertLanForMutation();
    const raw = await reqJson<{ success?: boolean } | undefined>({
      method: 'DELETE',
      path: ADMIN_ENDPOINTS.MACHINES_DELETE.buildPath(machineId),
      timeoutMs: MUTATION_TIMEOUT_MS,
      retry: false,
      endpointKey: 'MACHINES_DELETE',
      capability: 'machine.manage',
      resourceId: machineId,
    });
    return { success: raw?.success ?? true };
  },

  async bindDevice(machineId: string, deviceIdInput: string | { device_id: string }): Promise<Machine> {
    assertAuthenticatedHttp();
    assertLanForMutation();
    const deviceId = typeof deviceIdInput === 'string' ? deviceIdInput : deviceIdInput.device_id;
    return reqJson(
      {
        method: 'POST',
        path: ADMIN_ENDPOINTS.MACHINES_BIND.buildPath(machineId),
        body: { device_id: deviceId.trim() },
        timeoutMs: MUTATION_TIMEOUT_MS,
        retry: false,
        endpointKey: 'MACHINES_BIND',
        capability: 'machine.manage',
        resourceId: machineId,
      },
      mapMachine,
    );
  },

  async unbindDevice(machineId: string): Promise<Machine> {
    assertAuthenticatedHttp();
    assertLanForMutation();
    return reqJson(
      {
        method: 'POST',
        path: ADMIN_ENDPOINTS.MACHINES_UNBIND.buildPath(machineId),
        timeoutMs: MUTATION_TIMEOUT_MS,
        retry: false,
        endpointKey: 'MACHINES_UNBIND',
        capability: 'machine.manage',
        resourceId: machineId,
      },
      mapMachine,
    );
  }
};
