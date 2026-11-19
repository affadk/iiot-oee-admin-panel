/**
 * Authoritative Admin Panel Endpoint Catalog
 * Matches ADMIN_PANEL_BUILD_GUIDE.md Lampiran A (134 Admin REST candidates + 1 WebSocket = 135)
 * and API_DOCUMENTATION.md. E20 P20.2: 132 → 134 (tambah DEVICES_PROVISION /
 * DEVICES_REVOKE / DEVICES_CREDENTIALS, hapus MQTT_DYNSEC_CLIENTS_PROVISION).
 * E20 P20.5: 134 → 135 (tambah SYSTEM_ACCESS_MODE, pembaruan 09:23).
 * E23 Batch 4 (FAT-208, N-39): hitungan aktual registry = 137 (136 HTTP +
 * 1 WebSocket) — klaim "134 → 135" di atas stale sejak E20; angka 137
 * terverifikasi vs spec live 141 operasi (141 − 5 excluded-by-design =
 * 136 HTTP + 1 WS, docs/API_DOCS_AUDIT.md §3).
 *
 * Strictly EXCLUDES HMI-only flows:
 * - POST /api/v1/devices/:device_id/command (ADR-003 machine actuation)
 * - POST /api/v1/work-orders/validate-zone
 * - POST /api/v1/work-orders/initiate-from-zones
 * - POST /api/v1/work-orders/:wo_id/dispatch
 * - POST /api/v1/work-orders/:wo_id/complete
 * And strictly blocks legacy/non-existent paths:
 * - POST /api/v1/mqtt/dynamic-security/provision
 * - POST /api/v1/auth/operator-pin
 * - /api/v1/mqtt/configuration/versions
 */

/**
 * BARREL — gabung registry endpoint per domain (urutan key dipertahankan seperti semula).
 *
 * Dipisah dari file god-file pada refactoring R9 (kontrak docs/DIRECTORY_STRUCTURE.md).
 * Satu file = satu domain. Barrel penggabung ada di file induknya.
 */
import { HEALTH_ENDPOINTS } from './endpoints/health';
import { AUTH_ENDPOINTS } from './endpoints/auth';
import { DEVICE_ENDPOINTS } from './endpoints/devices';
import { MACHINE_ENDPOINTS } from './endpoints/machines';
import { PRODUCTION_ENDPOINTS } from './endpoints/production';
import { OPERATOR_ENDPOINTS } from './endpoints/operators';
import { WORK_ORDER_ENDPOINTS } from './endpoints/workOrders';
import { MONITORING_ENDPOINTS } from './endpoints/monitoring';
import { TELEMETRY_ENDPOINTS } from './endpoints/telemetry';
import { IAM_ENDPOINTS } from './endpoints/iam';
import { MQTT_ENDPOINTS } from './endpoints/mqtt';
import { SYSTEM_ENDPOINTS } from './endpoints/system';

export const ADMIN_ENDPOINTS = {
  ...HEALTH_ENDPOINTS,
  ...AUTH_ENDPOINTS,
  ...DEVICE_ENDPOINTS,
  ...MACHINE_ENDPOINTS,
  ...PRODUCTION_ENDPOINTS,
  ...OPERATOR_ENDPOINTS,
  ...WORK_ORDER_ENDPOINTS,
  ...MONITORING_ENDPOINTS,
  ...TELEMETRY_ENDPOINTS,
  ...IAM_ENDPOINTS,
  ...MQTT_ENDPOINTS,
  ...SYSTEM_ENDPOINTS,
};

export type AdminEndpointKey = keyof typeof ADMIN_ENDPOINTS;

export const FORBIDDEN_ENDPOINT_PATTERNS = [
  '/mqtt/configuration/versions',
  '/mqtt/dynamic-security/provision',
  // E20 P20.2 (X1, K-11 — keputusan E18 P-A): rute provision lama
  // /mqtt/dynamic-security/clients/provision kembali dilarang; pengganti
  // kanonis POST /api/v1/devices/provision.
  '/mqtt/dynamic-security/clients/provision',
  '/auth/operator-pin',
  '/command',
  '/work-orders/validate-zone',
  '/work-orders/initiate-from-zones',
  '/dispatch',
  '/complete',
  '/access-control/assignments',
  '/downtime/export',
] as const;

export function isValidEndpointPrefix(path: string): boolean {
  const cleanPath = path.split('?')[0];
  if (cleanPath === '/health' || cleanPath === '/health/detail' || cleanPath === '/ws/telemetry') {
    return true;
  }
  return cleanPath.startsWith('/api/v1/');
}

