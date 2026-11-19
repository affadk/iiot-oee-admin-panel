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
  /** Modbus slave id — hanya tersedia bila panel yang memperkaya (demo/seed); server §E hanya kirim machineId + machineName. */
  modbus_slave_id?: number;
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
  state: MachineFsmState;
  startedAt: string;
  endedAt: string | null;
  durationSec: number;
  triggerSource: string;
  isActive: boolean;
}

/** Siklus enrollment §E (spec 015): PROVISIONED → ACTIVE (saat /status ONLINE pertama) → REVOKED. */
export type DeviceEnrollmentState = 'PROVISIONED' | 'ACTIVE' | 'REVOKED';

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
  /** §E: status enrollment; perangkat legacy tanpa field ini dianggap ACTIVE oleh mapper. */
  enrollmentState?: DeviceEnrollmentState;
  provisionedAt?: string | null;
  credentialRotatedAt?: string | null;
  created_at: string;
}

/** Kredensial broker sekali tampil (§E.3a/3c) — TIDAK PERNAH disimpan/di-log; hanya diteruskan ke modal sekali-tampil. */
export interface DeviceCredential {
  username: string;
  password: string;
  clientId: string;
  topicPrefix: string;
}

export interface ProvisionDeviceResult {
  device: EdgeDevice;
  credential: DeviceCredential;
}

export interface RotateDeviceCredentialsResult {
  credential: DeviceCredential;
  forced: boolean;
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

/**
 * E27 Spec 043 (FAT-232, T1): stasiun / terminal login (kiosk) — baris
 * tabel `devices` yang sama dengan edge device, tapi tanpa ikatan mesin
 * dan tanpa kredensial broker. `device_id` bebas pola STM32 (mis.
 * ADMIN-CONSOLE-01). Status = enrollmentState + online — API tidak punya
 * status active/inactive dan TIDAK punya hostname.
 */
export interface Station {
  device_id: string;
  model?: string;
  mac_address: string;
  ip_address: string | null;
  firmware_version: string | null;
  online: boolean;
  last_seen: string | null;
  /** §E: status enrollment; perangkat legacy tanpa field ini dianggap ACTIVE oleh mapper. */
  enrollmentState?: DeviceEnrollmentState;
  provisionedAt?: string | null;
  credentialRotatedAt?: string | null;
  created_at: string;
}
