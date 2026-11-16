// Canonical 6-value FSM set from backend FsmStateEnum (API Doc §6.A / Build Guide §6.1)
export type MachineFsmState =
  | 'UNCONFIGURED'
  | 'READY'
  | 'RUNNING'
  | 'PLANNED_DOWNTIME'
  | 'UNPLANNED_DOWNTIME'
  | 'BATCH_FINISHED';

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
  | 'OTHER';

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

export interface OperationalEvent {
  id: string;
  device_id: string | null;
  machine_id?: string | null;
  machine_name: string;
  event_type:
    | 'ALARM'
    | 'STATE_CHANGE'
    | 'COMMAND_EXECUTED'
    | 'DISCONNECT'
    | 'HEARTBEAT_TIMEOUT'
    | 'MASTER_DATA_MUTATION'
    | 'MACHINE_BOUND'
    | 'MACHINE_UNBOUND'
    | 'PRODUCT_DELETED'
    | 'WORK_ORDER_CANCELLED'
    | 'WORK_ORDER_COMPLETED'
    | 'MQTT_ADMIN_ACTION'
    | 'IAM_POLICY_CHANGED'
    | 'SECURITY_REJECTION'
    | 'AUTH_TOKEN_REFRESHED';
  severity: 'INFO' | 'WARN' | 'CRITICAL';
  message: string;
  acknowledged: boolean;
  acknowledged_by?: string;
  acknowledged_at?: string;
  ack_note?: string;
  timestamp: string;
}
