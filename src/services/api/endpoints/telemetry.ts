/**
 * Registry endpoint — domain telemetry.
 *
 * Dipisah dari file god-file pada refactoring R9 (kontrak docs/DIRECTORY_STRUCTURE.md).
 * Satu file = satu domain. Barrel penggabung ada di file induknya.
 */
import type { EndpointDefinition } from './definition';
import { enc } from './definition';

export const TELEMETRY_ENDPOINTS: Record<string, EndpointDefinition> = {
TELEMETRY_HISTORY: {
    key: 'TELEMETRY_HISTORY',
    method: 'GET',
    template: '/api/v1/telemetry/:device_id',
    buildPath: (deviceId: string) => `/api/v1/telemetry/${enc(deviceId)}`,
  },

TELEMETRY_HOURLY: {
    key: 'TELEMETRY_HOURLY',
    method: 'GET',
    template: '/api/v1/telemetry/:device_id/hourly',
    buildPath: (deviceId: string) => `/api/v1/telemetry/${enc(deviceId)}/hourly`,
  },

TELEMETRY_AGGREGATE: {
    key: 'TELEMETRY_AGGREGATE',
    method: 'GET',
    template: '/api/v1/telemetry/:device_id/aggregate',
    buildPath: (deviceId: string) => `/api/v1/telemetry/${enc(deviceId)}/aggregate`,
  },

TELEMETRY_ROLLUP: {
    key: 'TELEMETRY_ROLLUP',
    method: 'GET',
    template: '/api/v1/telemetry/rollup',
    buildPath: () => '/api/v1/telemetry/rollup',
  },

TELEMETRY_EXPORT: {
    key: 'TELEMETRY_EXPORT',
    method: 'GET',
    template: '/api/v1/telemetry/:device_id/export',
    buildPath: (deviceId: string) => `/api/v1/telemetry/${enc(deviceId)}/export`,
  },

TELEMETRY_HOURLY_EXPORT: {
    key: 'TELEMETRY_HOURLY_EXPORT',
    method: 'GET',
    template: '/api/v1/telemetry/:device_id/hourly/export',
    buildPath: (deviceId: string) => `/api/v1/telemetry/${enc(deviceId)}/hourly/export`,
  },

RECONCILIATION_JOBS: {
    key: 'RECONCILIATION_JOBS',
    method: 'GET',
    template: '/api/v1/telemetry/reconciliation/jobs',
    buildPath: () => '/api/v1/telemetry/reconciliation/jobs',
  },

RECONCILIATION_REFRESH: {
    key: 'RECONCILIATION_REFRESH',
    method: 'POST',
    template: '/api/v1/telemetry/reconciliation/refresh',
    buildPath: () => '/api/v1/telemetry/reconciliation/refresh',
  },

OEE_SHIFT_SUMMARY: {
    key: 'OEE_SHIFT_SUMMARY',
    method: 'GET',
    template: '/api/v1/oee/shift-summary',
    buildPath: () => '/api/v1/oee/shift-summary',
  },

OEE_HOURLY: {
    key: 'OEE_HOURLY',
    method: 'GET',
    template: '/api/v1/oee/hourly',
    buildPath: () => '/api/v1/oee/hourly',
  },

OEE_SHIFT_TIMELINE: {
    key: 'OEE_SHIFT_TIMELINE',
    method: 'GET',
    template: '/api/v1/oee/shift-timeline',
    buildPath: () => '/api/v1/oee/shift-timeline',
  },

QUALITY_REJECTS_GLOBAL: {
    key: 'QUALITY_REJECTS_GLOBAL',
    method: 'GET',
    template: '/api/v1/quality/rejects',
    buildPath: () => '/api/v1/quality/rejects',
  },

QUALITY_REJECTS_BY_DEVICE: {
    key: 'QUALITY_REJECTS_BY_DEVICE',
    method: 'GET',
    template: '/api/v1/quality/rejects/:device_id',
    buildPath: (deviceId: string) => `/api/v1/quality/rejects/${enc(deviceId)}`,
  },
};
