// Canonical 6-value FSM set from backend FsmStateEnum (API Doc §6.A / Build Guide §6.1)
// + `OFFLINE` — nilai item sah per D-4 (API doc §F.8 mencantumkannya di
// filter query status-history; panel menampilkannya apa adanya, tanpa
// normalisasi ke UNCONFIGURED). Bukan bagian FSM kanonis 6 nilai.
export type MachineFsmState =
  | 'UNCONFIGURED'
  | 'READY'
  | 'RUNNING'
  | 'PLANNED_DOWNTIME'
  | 'UNPLANNED_DOWNTIME'
  | 'BATCH_FINISHED'
  | 'OFFLINE';

export interface LiveStateRecord {
  device_id: string;
  machine_id: string | null;
  machine_name: string;
  wo_id?: string | null;
  fsm_state: MachineFsmState;
  oee: number;
  availability: number;
  performance: number;
  quality: number;
  total_count: number;
  good_count: number;
  reject_count: number;
  last_cycle_time_sec?: number;
  operating_time_seconds: number;
  run_time_seconds: number;
  downtime_seconds: number;
  spindle_rpm?: number;
  machine_temp_c?: number;
  plc_alarm_code?: number;
  uptime_seconds?: number;
  free_heap_bytes?: number;
  active_work_order?: string | null;
  active_product?: string | null;
  last_telemetry_at: string;
  updated_at?: string;
  device_online: boolean;
}

export type DowntimeCategory =
  | 'EQUIPMENT_FAILURE'
  | 'SETUP_AND_ADJUSTMENT'
  | 'IDLING_AND_MINOR_STOPPAGE'
  | 'REDUCED_SPEED'
  | 'PROCESS_DEFECT'
  | 'MATERIAL_SHORTAGE'
  | 'PLANNED_MAINTENANCE'
  | 'REST_BREAK'
  | 'CLEANING_5S'
  | 'OTHER'
  /**
   * E23 Batch 3 (FAT-194, N-25): nilai LOKAL saja — spec live TIDAK
   * mengirim `category` pada item downtime, jadi mapper memakai ini
   * sebagai penanda jujur "tidak ada dari server" (bukan 'OTHER' yang
   * merupakan nilai kategori POST /reason yang sah). BUKAN nilai valid
   * untuk body POST /{id}/reason (DowntimeReasonModal memetakan
   * UNKNOWN → 'OTHER' saat pelabelan).
   */
  | 'UNKNOWN';

export interface DowntimeEvent {
  id: string;
  device_id: string | null;
  machine_id: string | null;
  machine_name: string;
  started_at: string;
  ended_at: string | null;
  duration_seconds: number;
  durationFormatted?: string;
  category: DowntimeCategory;
  reason: string;
  notes?: string;
  is_labeled: boolean;
  is_overwrite?: boolean;
  acknowledged_by?: string;
  created_at: string;
}

/**
 * E20 P20.5 (FAT-157): respons `POST /downtime-events/:id/reason`
 * (API doc §J.3) — BUKAN `DowntimeEvent` penuh. `operator` adalah nama/
 * id operator pelabel dari server (atribusi audit).
 * E23 Batch 3 (FAT-194, N-25): spec live — `operator` berupa objek
 * `{id, username}` (opsional), BUKAN string|null.
 */
export interface DowntimeReasonResult {
  success: boolean;
  eventId: string;
  deviceId: string | null;
  operatorReason: string;
  isOverwrite: boolean;
  operator: { id: string; username: string } | null;
}

// E20 P20.4 (FAT-156): enum `event_type` kanonis FR-034-26/27 (API doc §I).
// Dokumen mencantumkan 32 nilai eksplisit (diff menulis "33" — hitungan
// dokumen sendiri 32; ikuti dokumen). Keluarga pola: COMMAND_<cmd>_DISPATCHED
// (6 cmd §D: PAUSE, RESUME, RESET_COUNTER, PLANNED_DT_START, PLANNED_DT_END,
// COUNT_ADJUST), MQTT_ADMIN_<op> (operasi broker), DEVICE_EVENT_<n> (n 0..255).
export type OperationalEventCommand =
  | 'PAUSE'
  | 'RESUME'
  | 'RESET_COUNTER'
  | 'PLANNED_DT_START'
  | 'PLANNED_DT_END'
  | 'COUNT_ADJUST';

export type OperationalEventType =
  | 'AUTH_TOKEN_REFRESHED'
  | 'DEVICE_CREDENTIAL_ROTATED'
  | 'DEVICE_CREDENTIAL_ROTATION_REFUSED'
  | 'DEVICE_OFFLINE'
  | 'DEVICE_ONLINE'
  | 'DEVICE_PROVISIONED'
  | 'DEVICE_REVOKED'
  | 'MACHINE_BOUND'
  | 'MACHINE_UNBOUND'
  | 'MASTER_DATA_MUTATION'
  | 'MOSQUITTO_CONFIG_APPLIED'
  | 'MOSQUITTO_CONFIG_APPLY_FAILED'
  | 'MOSQUITTO_CONFIG_DISCARDED'
  | 'MOSQUITTO_CONFIG_RECOVERY_FAILED'
  | 'MOSQUITTO_CONFIG_RESTAGED'
  | 'MOSQUITTO_CONFIG_ROLLBACK_FAILED'
  | 'MOSQUITTO_CONFIG_ROLLED_BACK'
  | 'MOSQUITTO_CONFIG_STAGED'
  | 'OPERATIONAL_EVENT_ACKNOWLEDGED'
  | 'OPERATOR_DELETED'
  | 'OPERATOR_PASSWORD_ROTATED'
  | 'OPERATOR_PROVISIONED'
  | 'OPERATOR_STATUS_CHANGED'
  | 'OPERATOR_UPDATED'
  | 'PRODUCT_DELETED'
  | 'SECURITY_REJECTION'
  | 'WO_DISPATCH_ACK_ERROR'
  | 'WO_DISPATCH_ACK_SUCCESS'
  | 'WO_DISPATCH_INITIATED'
  | 'WO_DISPATCH_TIMEOUT_UNACKNOWLEDGED'
  | 'WORK_ORDER_CANCELLED'
  | 'WORK_ORDER_COMPLETED'
  | `COMMAND_${OperationalEventCommand}_DISPATCHED`
  | `MQTT_ADMIN_${string}`
  | `DEVICE_EVENT_${number}`;

/** 32 nilai eksplisit enum tertutup — sumber dropdown filter (bukan pola). */
export const OPERATIONAL_EVENT_TYPES: ReadonlyArray<Exclude<OperationalEventType, `COMMAND_${string}` | `MQTT_ADMIN_${string}` | `DEVICE_EVENT_${number}`>> = [
  'AUTH_TOKEN_REFRESHED',
  'DEVICE_CREDENTIAL_ROTATED',
  'DEVICE_CREDENTIAL_ROTATION_REFUSED',
  'DEVICE_OFFLINE',
  'DEVICE_ONLINE',
  'DEVICE_PROVISIONED',
  'DEVICE_REVOKED',
  'MACHINE_BOUND',
  'MACHINE_UNBOUND',
  'MASTER_DATA_MUTATION',
  'MOSQUITTO_CONFIG_APPLIED',
  'MOSQUITTO_CONFIG_APPLY_FAILED',
  'MOSQUITTO_CONFIG_DISCARDED',
  'MOSQUITTO_CONFIG_RECOVERY_FAILED',
  'MOSQUITTO_CONFIG_RESTAGED',
  'MOSQUITTO_CONFIG_ROLLBACK_FAILED',
  'MOSQUITTO_CONFIG_ROLLED_BACK',
  'MOSQUITTO_CONFIG_STAGED',
  'OPERATIONAL_EVENT_ACKNOWLEDGED',
  'OPERATOR_DELETED',
  'OPERATOR_PASSWORD_ROTATED',
  'OPERATOR_PROVISIONED',
  'OPERATOR_STATUS_CHANGED',
  'OPERATOR_UPDATED',
  'PRODUCT_DELETED',
  'SECURITY_REJECTION',
  'WO_DISPATCH_ACK_ERROR',
  'WO_DISPATCH_ACK_SUCCESS',
  'WO_DISPATCH_INITIATED',
  'WO_DISPATCH_TIMEOUT_UNACKNOWLEDGED',
  'WORK_ORDER_CANCELLED',
  'WORK_ORDER_COMPLETED',
];

/**
 * E20 P20.4 (FAT-156): bentuk `OperationalEventItem` FR-034-01 persis
 * (API doc §I) — snake_case lokal seperti mapper lain. `acknowledged`
 * diturunkan dari `acknowledgedAt`, bukan dibaca dari field; `machine_name`
 * null bila mesin dihapus (bukan default 'Plant System'); tidak ada field
 * `severity` (dokumen tidak mengenalnya) dan tidak ada `timestamp`/`message`
 * — pakai `recorded_at` + `description`. Snapshot dibuang bila tak ada
 * (null), jangan dikarang.
 */
export interface OperationalEvent {
  id: string;
  recorded_at: string;
  device_id: string | null;
  machine_id: string | null;
  machine_name: string | null;
  wo_id: string | null;
  event_type: OperationalEventType;
  trigger_source: string | null;
  event_code: number | null;
  snapshot_total_count: number | null;
  snapshot_run_sec: number | null;
  description: string;
  acknowledged: boolean;
  acknowledged_at: string | null;
  acknowledged_by: string | null;
  ack_note: string | null;
  created_at: string;
}
