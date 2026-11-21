/**
 * Registry endpoint — domain production.
 *
 * Dipisah dari file god-file pada refactoring R9 (kontrak docs/DIRECTORY_STRUCTURE.md).
 * Satu file = satu domain. Barrel penggabung ada di file induknya.
 */
import type { EndpointDefinition } from './definition';
import { enc } from './definition';

export const PRODUCTION_ENDPOINTS: Record<string, EndpointDefinition> = {
PRODUCTION_LINES_LIST: {
    key: 'PRODUCTION_LINES_LIST',
    method: 'GET',
    template: '/api/v1/production-lines',
    buildPath: () => '/api/v1/production-lines',
  },

PRODUCTION_LINES_GET: {
    key: 'PRODUCTION_LINES_GET',
    method: 'GET',
    template: '/api/v1/production-lines/:lineId',
    buildPath: (lineId: string) => `/api/v1/production-lines/${enc(lineId)}`,
  },

PRODUCTION_LINES_CREATE: {
    key: 'PRODUCTION_LINES_CREATE',
    method: 'POST',
    template: '/api/v1/production-lines',
    buildPath: () => '/api/v1/production-lines',
  },

PRODUCTION_LINES_UPDATE: {
    key: 'PRODUCTION_LINES_UPDATE',
    method: 'PATCH',
    template: '/api/v1/production-lines/:lineId',
    buildPath: (lineId: string) => `/api/v1/production-lines/${enc(lineId)}`,
  },

PRODUCTION_LINES_DELETE: {
    key: 'PRODUCTION_LINES_DELETE',
    method: 'DELETE',
    template: '/api/v1/production-lines/:lineId',
    buildPath: (lineId: string) => `/api/v1/production-lines/${enc(lineId)}`,
  },

SHIFTS_LIST: {
    key: 'SHIFTS_LIST',
    method: 'GET',
    template: '/api/v1/shifts',
    buildPath: () => '/api/v1/shifts',
  },

SHIFTS_GET: {
    key: 'SHIFTS_GET',
    method: 'GET',
    template: '/api/v1/shifts/:shiftId',
    buildPath: (shiftId: string) => `/api/v1/shifts/${enc(shiftId)}`,
  },

SHIFTS_CREATE: {
    key: 'SHIFTS_CREATE',
    method: 'POST',
    template: '/api/v1/shifts',
    buildPath: () => '/api/v1/shifts',
  },

SHIFTS_UPDATE: {
    key: 'SHIFTS_UPDATE',
    method: 'PATCH',
    template: '/api/v1/shifts/:shiftId',
    buildPath: (shiftId: string) => `/api/v1/shifts/${enc(shiftId)}`,
  },

SHIFTS_DELETE: {
    key: 'SHIFTS_DELETE',
    method: 'DELETE',
    template: '/api/v1/shifts/:shiftId',
    buildPath: (shiftId: string) => `/api/v1/shifts/${enc(shiftId)}`,
  },

SHIFT_SCHEDULES_LIST: {
    key: 'SHIFT_SCHEDULES_LIST',
    method: 'GET',
    template: '/api/v1/shift-schedules',
    buildPath: () => '/api/v1/shift-schedules',
  },

SHIFT_SCHEDULES_GET: {
    key: 'SHIFT_SCHEDULES_GET',
    method: 'GET',
    template: '/api/v1/shift-schedules/:scheduleId',
    buildPath: (scheduleId: string) => `/api/v1/shift-schedules/${enc(scheduleId)}`,
  },

SHIFT_SCHEDULES_CREATE: {
    key: 'SHIFT_SCHEDULES_CREATE',
    method: 'POST',
    template: '/api/v1/shift-schedules',
    buildPath: () => '/api/v1/shift-schedules',
  },

SHIFT_SCHEDULES_UPDATE: {
    key: 'SHIFT_SCHEDULES_UPDATE',
    method: 'PATCH',
    template: '/api/v1/shift-schedules/:scheduleId',
    buildPath: (scheduleId: string) => `/api/v1/shift-schedules/${enc(scheduleId)}`,
  },

SHIFT_SCHEDULES_DELETE: {
    key: 'SHIFT_SCHEDULES_DELETE',
    method: 'DELETE',
    template: '/api/v1/shift-schedules/:scheduleId',
    buildPath: (scheduleId: string) => `/api/v1/shift-schedules/${enc(scheduleId)}`,
  },

PRODUCTS_LIST: {
    key: 'PRODUCTS_LIST',
    method: 'GET',
    template: '/api/v1/products',
    buildPath: () => '/api/v1/products',
  },

PRODUCTS_GET: {
    key: 'PRODUCTS_GET',
    method: 'GET',
    template: '/api/v1/products/:productId',
    buildPath: (id: string) => `/api/v1/products/${enc(id)}`,
  },

PRODUCTS_CREATE: {
    key: 'PRODUCTS_CREATE',
    method: 'POST',
    template: '/api/v1/products',
    buildPath: () => '/api/v1/products',
  },

PRODUCTS_UPDATE: {
    key: 'PRODUCTS_UPDATE',
    method: 'PUT',
    template: '/api/v1/products/:productId',
    buildPath: (id: string) => `/api/v1/products/${enc(id)}`,
  },

PRODUCTS_DELETE: {
    key: 'PRODUCTS_DELETE',
    method: 'DELETE',
    template: '/api/v1/products/:productId',
    buildPath: (id: string) => `/api/v1/products/${enc(id)}`,
  },
};
