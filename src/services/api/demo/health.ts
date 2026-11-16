/**
 * Method demo — domain health.
 *
 * Dipisah dari file god-file pada refactoring R9 (kontrak docs/DIRECTORY_STRUCTURE.md).
 * Satu file = satu domain. Barrel penggabung ada di file induknya.
 */
import { store } from './store';
import { checkAbort } from './helpers';
import { ADMIN_ENDPOINTS } from '../endpoints';
import { SystemHealth } from '../../../types/system';

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

  getTelemetryWebSocketUrl(): string {
    const path = ADMIN_ENDPOINTS.WS_TELEMETRY.buildPath();
    store.recordEndpoint('WS_TELEMETRY', path);
    return path;
  }
};
