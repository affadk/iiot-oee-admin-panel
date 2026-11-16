import { MachineFsmState } from './monitoring';

export interface BoundDeviceSummary {
  device_id: string;
  mac_address: string;
  ip_address: string | null;
  firmware_version: string | null;
  online: boolean;
  model?: string;
}

export interface BoundMachineSummary {
  machine_id: string;
  name: string;
  modbus_slave_id: number;
}

export interface Machine {
  machine_id: string;
  name: string;
  bound_device_id: string | null;
  boundDevice?: BoundDeviceSummary | null;
  modbus_slave_id: number;
  line_id?: string | null;
  created_at: string;
  updated_at?: string;
  code?: string;
}

export interface MachineStatusHistoryItem {
  id: number | string;
  deviceId: string | null;
  machineId: string;
  state: MachineFsmState | 'OFFLINE';
  startedAt: string;
  endedAt: string | null;
  durationSec: number;
  triggerSource: string;
  isActive: boolean;
}

export interface EdgeDevice {
  device_id: string;
  model?: string;
  serial_number?: string;
  mac_address: string;
  ip_address: string | null;
  firmware_version: string | null;
  online: boolean;
  last_seen: string | null;
  bound_machine_id: string | null;
  bound_machine_name?: string | null;
  boundMachine?: BoundMachineSummary | null;
  created_at: string;
}

export interface DeviceHealth {
  device_id: string;
  timestamp?: string | null;
  heapFree: number;
  tasksHealthy: number;
  tasksTotal: number;
  ageSec: number;
  eventFlags: string[];
  staleCount: number;
  staleTasks: string[];
}
