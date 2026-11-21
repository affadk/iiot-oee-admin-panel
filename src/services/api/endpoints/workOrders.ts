/**
 * Registry endpoint — domain workOrders.
 *
 * Dipisah dari file god-file pada refactoring R9 (kontrak docs/DIRECTORY_STRUCTURE.md).
 * Satu file = satu domain. Barrel penggabung ada di file induknya.
 */
import type { EndpointDefinition } from './definition';
import { enc } from './definition';

export const WORK_ORDER_ENDPOINTS: Record<string, EndpointDefinition> = {
WORK_ORDERS_LIST: {
    key: 'WORK_ORDERS_LIST',
    method: 'GET',
    template: '/api/v1/work-orders',
    buildPath: () => '/api/v1/work-orders',
  },

WORK_ORDERS_GET: {
    key: 'WORK_ORDERS_GET',
    method: 'GET',
    template: '/api/v1/work-orders/:wo_id',
    buildPath: (woId: string) => `/api/v1/work-orders/${enc(woId)}`,
  },

WORK_ORDERS_RESOLVE: {
    key: 'WORK_ORDERS_RESOLVE',
    method: 'GET',
    template: '/api/v1/work-orders/:wo_id/resolve',
    buildPath: (woId: string) => `/api/v1/work-orders/${enc(woId)}/resolve`,
  },

WORK_ORDERS_CANCEL: {
    key: 'WORK_ORDERS_CANCEL',
    method: 'POST',
    template: '/api/v1/work-orders/:wo_id/cancel',
    buildPath: (woId: string) => `/api/v1/work-orders/${enc(woId)}/cancel`,
  },
};
