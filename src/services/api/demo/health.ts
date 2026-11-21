/**
 * Method demo — domain health.
 *
 * Dipisah dari file god-file pada refactoring R9 (kontrak docs/DIRECTORY_STRUCTURE.md).
 * Satu file = satu domain. Barrel penggabung ada di file induknya.
 */
import { store } from './store';
import { checkAbort } from './helpers';
import { ADMIN_ENDPOINTS } from '../endpoints';
import { resolveAccessMode, resolveEffectiveAccess, resolveNetworkMode } from '../mode';
import { HealthDetail, SystemHealth, SystemAccessMode } from '../../../types/system';

export const demoHealth = {
  // =========================================================================
  // HEALTH & WS (2 ops)
  // =========================================================================
  async getSystemHealth(signal?: AbortSignal): Promise<SystemHealth> {
    checkAbort(signal);
    store.recordEndpoint('HEALTH', ADMIN_ENDPOINTS.HEALTH.buildPath());
    return {
      ...store.systemHealth,
      timestamp: new Date().toISOString(),
    };
  },

  /**
   * E20 P20.4 (FAT-156): GET /health/detail demo — meniru bentuk API doc §A
   * (per-komponen + measuredAt, nilai null bila tak tersedia). Demo-only;
   * bukan bukti perilaku backend sungguhan.
   */
  async getHealthDetail(signal?: AbortSignal): Promise<HealthDetail> {
    checkAbort(signal);
    store.recordEndpoint('HEALTH_DETAIL', ADMIN_ENDPOINTS.HEALTH_DETAIL.buildPath());
    const now = new Date().toISOString();
    return {
      ...store.healthDetail,
      measuredAt: now,
      application: { ...store.healthDetail.application, measuredAt: now },
      database: { ...store.healthDetail.database, measuredAt: now },
      mqtt: { ...store.healthDetail.mqtt, measuredAt: now },
      websocket: { ...store.healthDetail.websocket, measuredAt: now },
    };
  },

  getTelemetryWebSocketUrl(): string {
    const path = ADMIN_ENDPOINTS.WS_TELEMETRY.buildPath();
    store.recordEndpoint('WS_TELEMETRY', path);
    return path;
  },

  /**
   * E20 P20.5 (FAT-157): `GET /api/v1/system/access-mode` demo — nilai
   * turunan env+kanal (mode.ts), meniru bentuk server. Bukan bukti perilaku
   * backend sungguhan.
   */
  async getSystemAccessMode(signal?: AbortSignal): Promise<SystemAccessMode> {
    checkAbort(signal);
    store.recordEndpoint('SYSTEM_ACCESS_MODE', ADMIN_ENDPOINTS.SYSTEM_ACCESS_MODE.buildPath());
    const channel = resolveNetworkMode();
    const effective = resolveEffectiveAccess(channel);
    return {
      mode: resolveAccessMode(),
      channel: channel === 'LAN' ? 'lan' : channel === 'REMOTE_TUNNEL' ? 'tunnel' : 'unknown',
      mutations_allowed: effective.canMutate,
    };
  }
};
