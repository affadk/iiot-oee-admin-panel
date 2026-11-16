export interface SystemHealth {
  status: 'ok' | 'degraded' | 'down';
  uptime: number;
  timestamp: string;
  ws_clients: number;
  db_connected: boolean;
  buffer_pending: number;
  metrics: {
    totalReceived: number;
    validIngested: number;
    invalidDiscarded: number;
    lastIngestedAt: string | null;
  } | null;
}

export interface AuditLogItem {
  id: string;
  timestamp: string;
  device_id: string | null;
  machine_id: string | null;
  machine_name: string;
  operator_id: string | null;
  operator_name: string;
  event_type: string;
  action: string;
  resource_type:
    | 'WORK_ORDER'
    | 'MACHINE'
    | 'DEVICE'
    | 'PRODUCT'
    | 'OPERATOR'
    | 'PRODUCTION_LINE'
    | 'SHIFT'
    | 'SHIFT_SCHEDULE'
    | 'MQTT_SECURITY'
    | 'BROKER_CONFIG'
    | 'IAM'
    | 'SYSTEM';
  resource_id: string;
  details: string;
  client_ip: string;
  access_mode: 'LAN' | 'REMOTE_TUNNEL';
}
