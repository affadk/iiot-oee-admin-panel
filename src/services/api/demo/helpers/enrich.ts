/**
 * Helper demo: enrich + validasi device/machine dari store.
 *
 * Dipisah dari demo/helpers.ts (415 baris) pada E32.5 (FAT-286), mengikuti
 * pola R9.2 (kontrak docs/DIRECTORY_STRUCTURE.md). Satu file = satu
 * sub-domain. Barrel penggabung ada di file induknya (../helpers.ts).
 */

import { store } from '../store';
import { Machine, EdgeDevice } from '../../../../types/assets';
import { EdgeDeviceSchema, MachineSchema } from '../../schemas';

export function enrichAndValidateDevice(dev: EdgeDevice): EdgeDevice {
  const machine = dev.bound_machine_id
    ? store.machines.find((m) => m.machine_id === dev.bound_machine_id)
    : store.machines.find((m) => m.bound_device_id === dev.device_id);
  return EdgeDeviceSchema.parse({
    ...dev,
    bound_machine_id: machine ? machine.machine_id : dev.bound_machine_id ?? null,
    bound_machine_name: machine ? machine.name : dev.bound_machine_name ?? null,
    boundMachine: machine
      ? {
          machine_id: machine.machine_id,
          name: machine.name,
          modbus_slave_id: machine.modbus_slave_id,
        }
      : null,
  });
}

export function enrichAndValidateMachine(machine: Machine): Machine {
  const dev = machine.bound_device_id
    ? store.devices.find((d) => d.device_id === machine.bound_device_id)
    : store.devices.find((d) => d.bound_machine_id === machine.machine_id);
  return MachineSchema.parse({
    ...machine,
    bound_device_id: dev ? dev.device_id : machine.bound_device_id ?? null,
    boundDevice: dev
      ? {
          device_id: dev.device_id,
          mac_address: dev.mac_address,
          ip_address: dev.ip_address,
          firmware_version: dev.firmware_version,
          online: dev.online,
          model: dev.model,
        }
      : null,
  });
}
