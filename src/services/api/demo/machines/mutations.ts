/**
 * Method demo — domain machines: create / update / delete.
 *
 * Dipisah dari demo/machines.ts (519 baris) pada E32.5 (FAT-286), mengikuti
 * pola R9.2 (kontrak docs/DIRECTORY_STRUCTURE.md). Satu file = satu
 * sub-domain. Barrel penggabung ada di file induknya (../machines.ts).
 */
import { store } from '../store';
import { assertCapability, throwValidationIssues, enrichAndValidateMachine } from '../helpers';
import { ADMIN_ENDPOINTS } from '../../endpoints';
import { Machine } from '../../../../types/assets';
import { ApiError } from '../../../../types/auth';
import { validateMachineInput } from '../../../../utils/capabilities';
import { telemetrySocket } from '../../../ws/telemetrySocket';

export const demoMachinesMutations = {
  async createMachine(data: {
    machine_id: string;
    name: string;
    modbus_slave_id?: number;
    bound_device_id?: string | null;
    line_id?: string | null;
  }): Promise<Machine> {
    // E20 P20.5 (FAT-157, pembaruan 09:23): POST /machines =
    // authorize("create","machine") — kunci `machine.create`, bukan
    // `machine.manage`. Gating efektif sama (ADMIN LAN only).
    assertCapability('machine.create', ['ADMIN'], { resourceId: data.machine_id });
    const modbusSlaveId = data.modbus_slave_id ?? 1;
    const requestedDeviceId = data.bound_device_id?.trim() || null;
    // E23 Batch 2 (FAT-183, N-14): `lineId` spec live (default server
    // LINE-01) — demo meniru default itu bila kosong.
    const lineId = data.line_id?.trim() || 'LINE-01';

    const errors = validateMachineInput({
      machineId: data.machine_id,
      machineName: data.name,
      modbusSlaveId,
      boundDeviceId: requestedDeviceId,
      lineId,
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
        line_id: lineId,
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
    patch: { name?: string; modbus_slave_id?: number; line_id?: string | null }
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
      lineId: patch.line_id ?? undefined,
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
      // E23 Batch 2 (FAT-183, N-14): PUT /machines bisa pindah lini
      // (spec live `lineId?`); kosong → lini tidak berubah.
      if (patch.line_id?.trim()) machine.line_id = patch.line_id.trim();
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
  }
};
