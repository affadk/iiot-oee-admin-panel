/**
 * Registry endpoint — domain system.
 *
 * E20 P20.5 (FAT-157): endpoint baru pembaruan API docs 2026-11-19 09:23 —
 * `GET /api/v1/system/access-mode` (`{mode, channel, mutations_allowed}`).
 * Dipisah dari file god-file pada refactoring R9 (kontrak docs/DIRECTORY_STRUCTURE.md).
 * Satu file = satu domain. Barrel penggabung ada di file induknya.
 */
import type { EndpointDefinition } from './definition';

export const SYSTEM_ENDPOINTS: Record<string, EndpointDefinition> = {
  SYSTEM_ACCESS_MODE: {
    key: 'SYSTEM_ACCESS_MODE',
    method: 'GET',
    template: '/api/v1/system/access-mode',
    buildPath: () => '/api/v1/system/access-mode',
  },
};
