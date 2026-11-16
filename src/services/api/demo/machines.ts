/**
 * Method demo — domain machines.
 *
 * Dipisah dari file god-file pada refactoring R9 (kontrak docs/DIRECTORY_STRUCTURE.md).
 * Satu file = satu domain. Barrel penggabung ada di file induknya.
 */
import { store } from './store';
import { checkAbort, assertCapability, throwValidationIssues, enrichAndValidateMachine } from './helpers';
import { ADMIN_ENDPOINTS } from '../endpoints';
import { Machine, MachineStatusHistoryItem } from '../../../types/assets';
import { ApiError } from '../../../types/auth';
import { CursorPageResponse } from '../../../types/historical';
import { validateMachineInput } from '../../../utils/capabilities';
import { BindDeviceRequestSchema, MachineSchema, normalizeListResponse } from '../schemas';
import { telemetrySocket } from '../../ws/telemetrySocket';
import { paginateWithCursor } from '../../../utils/historicalExport';
import { normalizeFsmState } from '../../../utils/oeeCalculations';

export const demoMachines = {
  // =========================================================================
  // MACHINES (7 ops)
  // =========================================================================
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
  },

  async createMachine(data: {
    machine_id: string;
    name: string;
    modbus_slave_id?: number;
    bound_device_id?: string | null;
  }): Promise<Machine> {
    assertCapability('machine.manage', ['ADMIN'], { resourceId: data.machine_id });
    const modbusSlaveId = data.modbus_slave_id ?? 1;
    const requestedDeviceId = data.bound_device_id?.trim() || null;

    const errors = validateMachineInput({
      machineId: data.machine_id,
      machineName: data.name,
      modbusSlaveId,
      boundDeviceId: requestedDeviceId,
      isCreate: true,
    });
    if (Object.keys(errors).length > 0) {
      throwValidationIssues('Validasi pembuatan mesin gagal.', errors);
    }

    store.recordEndpoint('MACHINES_CREATE', ADMIN_ENDPOINTS.MACHINES_CREATE.buildPath());

    const created = await store.runAssetTransaction(() => {
      const id = data.machine_id.trim();
      if (store.machines.some((m) => m.machine_id === id)) {
        throw new ApiError({
          code: 'MACHINE_ALREADY_EXISTS',
          message: `Machine ID "${id}" sudah terdaftar.`,
          httpStatus: 409,
        });
      }
      if (store.machines.some((m) => m.modbus_slave_id === modbusSlaveId)) {
        throw new ApiError({
          code: 'MODBUS_SLAVE_CONFLICT',
          message: `Modbus Slave ID ${modbusSlaveId} sudah dipakai mesin lain.`,
          httpStatus: 409,
        });
      }
      if (requestedDeviceId) {
        const dev = store.devices.find((d) => d.device_id === requestedDeviceId);
        if (!dev) {
          throw new ApiError({ code: 'DEVICE_NOT_FOUND', message: 'Perangkat tidak ditemukan.', httpStatus: 404 });
        }
        if (dev.bound_machine_id || store.machines.some((m) => m.bound_device_id === requestedDeviceId)) {
          throw new ApiError({
            code: 'DEVICE_ALREADY_BOUND',
            message: `Perangkat ${dev.device_id} sudah terikat ke mesin ${dev.bound_machine_id}.`,
            httpStatus: 409,
          });
        }
        dev.bound_machine_id = id;
        dev.bound_machine_name = data.name.trim();
        const live = store.liveStates.find((ls) => ls.device_id === requestedDeviceId);
        if (live) {
          live.machine_id = id;
          live.machine_name = data.name.trim();
        }
      }

      const now = new Date().toISOString();
      const newMachine: Machine = {
        machine_id: id,
        name: data.name.trim(),
        code: id,
        bound_device_id: requestedDeviceId,
        modbus_slave_id: modbusSlaveId,
        created_at: now,
        updated_at: now,
      };
      store.machines.push(newMachine);
      store.addAudit('CREATE_MACHINE', 'MACHINE', newMachine.machine_id, `Created machine ${newMachine.name}`, {
        machine_id: newMachine.machine_id,
        machine_name: newMachine.name,
        device_id: newMachine.bound_device_id,
      });
      if (requestedDeviceId) {
        store.addOperationalEvent(
          'MACHINE_BOUND',
          'INFO',
          `Edge device ${requestedDeviceId} diikatkan saat pembuatan mesin ${newMachine.name}`,
          {
            machine_id: newMachine.machine_id,
            machine_name: newMachine.name,
            device_id: requestedDeviceId,
          }
        );
      }
      return enrichAndValidateMachine(newMachine);
    });

    telemetrySocket.emitLifecycleEvent('MACHINE_CREATED', {
      machine_id: created.machine_id,
      name: created.name,
      bound_device_id: created.bound_device_id,
    });
    if (created.bound_device_id) {
      telemetrySocket.emitLifecycleEvent('MACHINE_BOUND', {
        machine_id: created.machine_id,
        device_id: created.bound_device_id,
      });
    }
    return created;
  },

  async updateMachine(
    machineId: string,
    patch: { name?: string; modbus_slave_id?: number }
  ): Promise<Machine> {
    assertCapability('machine.manage', ['ADMIN'], { resourceId: machineId });

    const rawPatch = patch as Record<string, unknown>;
    if (
      rawPatch.bound_device_id !== undefined ||
      rawPatch.device_id !== undefined ||
      rawPatch.machine_id !== undefined
    ) {
      throwValidationIssues('Pembaruan relasi device tidak diizinkan melalui endpoint mesin.', {
        bound_device_id: 'Gunakan endpoint POST /bind atau POST /unbind untuk mengubah ikatan device.',
      });
    }

    const errors = validateMachineInput({
      machineName: patch.name,
      modbusSlaveId: patch.modbus_slave_id,
      isCreate: false,
    });
    if (Object.keys(errors).length > 0) {
      throwValidationIssues('Validasi pembaruan mesin gagal.', errors);
    }

    store.recordEndpoint('MACHINES_UPDATE', ADMIN_ENDPOINTS.MACHINES_UPDATE.buildPath(machineId));
    const updated = await store.runAssetTransaction(() => {
      const machine = store.machines.find((m) => m.machine_id === machineId);
      if (!machine) {
        throw new ApiError({ code: 'MACHINE_NOT_FOUND', message: 'Mesin tidak ditemukan.', httpStatus: 404 });
      }
      if (
        patch.modbus_slave_id !== undefined &&
        store.machines.some((m) => m.machine_id !== machineId && m.modbus_slave_id === patch.modbus_slave_id)
      ) {
        throw new ApiError({
          code: 'MODBUS_SLAVE_CONFLICT',
          message: `Modbus Slave ID ${patch.modbus_slave_id} sudah dipakai mesin lain.`,
          httpStatus: 409,
        });
      }

      if (patch.name !== undefined) machine.name = patch.name.trim();
      if (patch.modbus_slave_id !== undefined) machine.modbus_slave_id = patch.modbus_slave_id;
      machine.updated_at = new Date().toISOString();

      if (machine.bound_device_id) {
        const dev = store.devices.find((d) => d.device_id === machine.bound_device_id);
        if (dev) dev.bound_machine_name = machine.name;
        const live = store.liveStates.find((ls) => ls.device_id === machine.bound_device_id);
        if (live) live.machine_name = machine.name;
      }

      store.addAudit('UPDATE_MACHINE', 'MACHINE', machineId, `Updated machine ${machine.name}`, {
        machine_id: machineId,
        machine_name: machine.name,
      });
      return enrichAndValidateMachine(machine);
    });

    telemetrySocket.emitLifecycleEvent('MACHINE_UPDATED', {
      machine_id: updated.machine_id,
      name: updated.name,
      modbus_slave_id: updated.modbus_slave_id,
    });
    return updated;
  },

  async deleteMachine(machineId: string): Promise<{ success: boolean }> {
    assertCapability('machine.manage', ['ADMIN'], { resourceId: machineId });
    store.recordEndpoint('MACHINES_DELETE', ADMIN_ENDPOINTS.MACHINES_DELETE.buildPath(machineId));

    const deletedMeta = await store.runAssetTransaction(() => {
      const machine = store.machines.find((m) => m.machine_id === machineId);
      if (!machine) {
        throw new ApiError({ code: 'MACHINE_NOT_FOUND', message: 'Mesin tidak ditemukan.', httpStatus: 404 });
      }

      const activeWo = store.workOrders.find(
        (w) => w.machine_id === machineId && (w.status === 'ACTIVE' || w.status === 'PENDING')
      );
      if (activeWo) {
        throw new ApiError({
          code: 'MACHINE_HAS_ACTIVE_WO',
          message: `Tidak dapat menghapus mesin: sedang menjalankan Work Order ${activeWo.status} (${activeWo.wo_id}).`,
          httpStatus: 409,
          activeWoId: activeWo.wo_id,
        });
      }

      const activeDt = store.downtimes.find((d) => d.machine_id === machineId && d.ended_at === null);
      if (activeDt) {
        throw new ApiError({
          code: 'MACHINE_HAS_ACTIVE_DOWNTIME',
          message: `Tidak dapat menghapus mesin: masih ada downtime aktif (${activeDt.id}).`,
          httpStatus: 409,
        });
      }

      const prevDeviceId = machine.bound_device_id;
      if (prevDeviceId) {
        const dev = store.devices.find((d) => d.device_id === prevDeviceId);
        if (dev) {
          dev.bound_machine_id = null;
          dev.bound_machine_name = null;
        }
      }

      // ON DELETE SET NULL on historical & live references
      store.workOrders.forEach((wo) => {
        if (wo.machine_id === machineId) {
          wo.machine_id = null;
          wo.machine_name = null;
        }
      });
      store.downtimes.forEach((dt) => {
        if (dt.machine_id === machineId) {
          dt.machine_id = null;
          dt.machine_name = '[deleted]';
        }
      });
      store.operationalEvents.forEach((ev) => {
        if (ev.machine_id === machineId) {
          ev.machine_id = null;
          ev.machine_name = '[deleted]';
        }
      });
      store.liveStates.forEach((ls) => {
        if (ls.machine_id === machineId) {
          ls.machine_id = null;
          ls.machine_name = '[deleted]';
        }
      });

      store.machines = store.machines.filter((m) => m.machine_id !== machineId);
      store.addAudit('DELETE_MACHINE', 'MACHINE', machineId, `Deleted machine ${machineId} (history preserved)`);
      return { prevDeviceId };
    });

    telemetrySocket.emitLifecycleEvent('MACHINE_DELETED', {
      machine_id: machineId,
      unbound_device_id: deletedMeta.prevDeviceId,
    });
    return { success: true };
  },

  async bindDevice(machineId: string, deviceIdInput: string | { device_id: string }): Promise<Machine> {
    assertCapability('machine.manage', ['ADMIN'], { resourceId: machineId });
    const rawDeviceId = typeof deviceIdInput === 'string' ? deviceIdInput : deviceIdInput?.device_id;
    const parsedReq = BindDeviceRequestSchema.safeParse({ device_id: (rawDeviceId ?? '').trim() });
    if (!parsedReq.success) {
      throwValidationIssues('Payload binding device tidak valid.', {
        device_id: 'device_id wajib mengikuti format STM32-...',
      });
    }
    const deviceId = parsedReq.data.device_id;
    store.recordEndpoint('MACHINES_BIND', ADMIN_ENDPOINTS.MACHINES_BIND.buildPath(machineId));

    const updatedMachine = await store.runAssetTransaction(() => {
      const machine = store.machines.find((m) => m.machine_id === machineId);
      if (!machine) {
        throw new ApiError({ code: 'MACHINE_NOT_FOUND', message: 'Mesin tidak ditemukan.', httpStatus: 404 });
      }
      if (machine.bound_device_id) {
        throw new ApiError({
          code: 'MACHINE_ALREADY_BOUND',
          message: `Mesin ${machineId} sudah terikat ke perangkat ${machine.bound_device_id}. Lepas ikatan terlebih dahulu.`,
          httpStatus: 409,
        });
      }

      const device = store.devices.find((d) => d.device_id === deviceId);
      if (!device) {
        throw new ApiError({ code: 'DEVICE_NOT_FOUND', message: 'Perangkat tidak ditemukan.', httpStatus: 404 });
      }
      if (device.bound_machine_id || store.machines.some((m) => m.bound_device_id === deviceId)) {
        const holder =
          device.bound_machine_id || store.machines.find((m) => m.bound_device_id === deviceId)?.machine_id;
        throw new ApiError({
          code: 'DEVICE_ALREADY_BOUND',
          message: `Perangkat ${deviceId} sudah terikat ke mesin ${holder}.`,
          httpStatus: 409,
        });
      }

      machine.bound_device_id = deviceId;
      machine.updated_at = new Date().toISOString();
      device.bound_machine_id = machineId;
      device.bound_machine_name = machine.name;

      const live = store.liveStates.find((ls) => ls.device_id === deviceId);
      if (live) {
        live.machine_id = machineId;
        live.machine_name = machine.name;
      }

      store.addAudit('MACHINE_BOUND', 'MACHINE', machineId, `Bound edge device ${deviceId} to ${machine.name}`, {
        machine_id: machineId,
        machine_name: machine.name,
        device_id: deviceId,
      });
      store.addOperationalEvent(
        'MACHINE_BOUND',
        'INFO',
        `Edge device ${deviceId} berhasil diikatkan ke mesin ${machine.name} (${machineId})`,
        {
          machine_id: machineId,
          machine_name: machine.name,
          device_id: deviceId,
        }
      );

      return enrichAndValidateMachine(machine);
    });

    telemetrySocket.emitLifecycleEvent('MACHINE_BOUND', {
      machine_id: machineId,
      device_id: deviceId,
      machine_name: updatedMachine.name,
    });
    return updatedMachine;
  },

  async unbindDevice(machineId: string): Promise<Machine> {
    assertCapability('machine.manage', ['ADMIN'], { resourceId: machineId });
    store.recordEndpoint('MACHINES_UNBIND', ADMIN_ENDPOINTS.MACHINES_UNBIND.buildPath(machineId));

    const result = await store.runAssetTransaction(() => {
      const machine = store.machines.find((m) => m.machine_id === machineId);
      if (!machine) {
        throw new ApiError({ code: 'MACHINE_NOT_FOUND', message: 'Mesin tidak ditemukan.', httpStatus: 404 });
      }
      if (!machine.bound_device_id) {
        throw new ApiError({
          code: 'MACHINE_NOT_BOUND',
          message: `Mesin ${machineId} tidak memiliki perangkat terikat.`,
          httpStatus: 400,
        });
      }
      const activeWo = store.workOrders.find(
        (w) => w.machine_id === machineId && (w.status === 'ACTIVE' || w.status === 'PENDING')
      );
      if (activeWo) {
        throw new ApiError({
          code: 'MACHINE_HAS_ACTIVE_WO',
          message: `Tidak dapat melepas perangkat: mesin memiliki Work Order ${activeWo.status} (${activeWo.wo_id}).`,
          httpStatus: 409,
          activeWoId: activeWo.wo_id,
        });
      }

      const prevDeviceId = machine.bound_device_id;
      machine.bound_device_id = null;
      machine.updated_at = new Date().toISOString();

      const dev = store.devices.find((d) => d.device_id === prevDeviceId);
      if (dev) {
        dev.bound_machine_id = null;
        dev.bound_machine_name = null;
      }

      const live = store.liveStates.find((ls) => ls.device_id === prevDeviceId);
      if (live) {
        live.machine_id = null;
        live.machine_name = 'Unbound Edge Controller';
      }

      store.addAudit('MACHINE_UNBOUND', 'MACHINE', machineId, `Unbound device ${prevDeviceId} from ${machine.name}`, {
        machine_id: machineId,
        machine_name: machine.name,
        device_id: prevDeviceId,
      });
      store.addOperationalEvent(
        'MACHINE_UNBOUND',
        'INFO',
        `Ikatan edge device ${prevDeviceId} dilepas dari mesin ${machine.name} (${machineId})`,
        {
          machine_id: machineId,
          machine_name: machine.name,
          device_id: prevDeviceId,
        }
      );

      return {
        machine: enrichAndValidateMachine(machine),
        prevDeviceId,
      };
    });

    telemetrySocket.emitLifecycleEvent('MACHINE_UNBOUND', {
      machine_id: machineId,
      device_id: result.prevDeviceId,
      machine_name: result.machine.name,
    });
    return result.machine;
  }
};
