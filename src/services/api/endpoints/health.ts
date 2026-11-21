/**
 * Registry endpoint — domain health.
 *
 * Dipisah dari file god-file pada refactoring R9 (kontrak docs/DIRECTORY_STRUCTURE.md).
 * Satu file = satu domain. Barrel penggabung ada di file induknya.
 */
import type { EndpointDefinition } from './definition';

export const HEALTH_ENDPOINTS: Record<string, EndpointDefinition> = {
HEALTH: {
    key: 'HEALTH',
    method: 'GET',
    template: '/health',
    buildPath: () => '/health',
  },

// E20 P20.4 (FAT-156): GET /health/detail (API doc §A) — detail infrastruktur,
// ADMIN + LAN, grant `read` pada `access_control`. Probe ringkas /health
// tetap publik.
HEALTH_DETAIL: {
    key: 'HEALTH_DETAIL',
    method: 'GET',
    template: '/health/detail',
    buildPath: () => '/health/detail',
  },

WS_TELEMETRY: {
    key: 'WS_TELEMETRY',
    method: 'WS',
    template: '/ws/telemetry',
    buildPath: () => '/ws/telemetry',
  },
};
