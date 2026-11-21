/**
 * Method demo — domain machines: bind / unbind device.
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
import { BindDeviceRequestSchema } from '../../schemas';
import { telemetrySocket } from '../../../ws/telemetrySocket';

export const demoMachinesBinding = {
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
        // E20 P20.5 (FAT-157): unbind hanya diblokir WO ACTIVE — PENDING
        // tidak memblokir (§F.5).
        (w) => w.machine_id === machineId && w.status === 'ACTIVE'
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
