/**
 * Method HTTP — domain products.
 *
 * Dipisah dari file god-file pada refactoring R9 (kontrak docs/DIRECTORY_STRUCTURE.md).
 * Satu file = satu domain. Barrel penggabung ada di file induknya.
 */
import { MUTATION_TIMEOUT_MS, assertLanForMutation, assertAuthenticatedHttp, reqJson, reqList, reqAllPages, checkAbortHttp } from './transport';
import { mapProduct } from './mappers';
import { ADMIN_ENDPOINTS } from '../endpoints';
import { Product } from '../../../types/production';
import { CursorPageResponse } from '../../../types/historical';

export const httpProducts = {
  // -- Products (5 ops) ------------------------------------------------------
  async getProductsPage(
    query: { cursor?: string | null; limit?: number } = {},
    signal?: AbortSignal,
  ): Promise<CursorPageResponse<Product>> {
    checkAbortHttp(signal);
    return reqList(
      {
        path: ADMIN_ENDPOINTS.PRODUCTS_LIST.buildPath(),
        query: { limit: query.limit ?? 50, envelope: true, ...(query.cursor ? { cursor: query.cursor } : {}) },
        signal,
        endpointKey: 'PRODUCTS_LIST',
      },
      mapProduct,
      query.limit ?? 50,
    );
  },

  async getProducts(signal?: AbortSignal): Promise<Product[]> {
    checkAbortHttp(signal);
    return reqAllPages(ADMIN_ENDPOINTS.PRODUCTS_LIST.buildPath(), mapProduct, signal, 'PRODUCTS_LIST');
  },

  async getProductById(productId: string, signal?: AbortSignal): Promise<Product> {
    checkAbortHttp(signal);
    return reqJson(
      { path: ADMIN_ENDPOINTS.PRODUCTS_GET.buildPath(productId), signal, endpointKey: 'PRODUCTS_GET', capability: 'product.read', resourceId: productId },
      mapProduct,
    );
  },

  async createProduct(data: {
    product_id: string;
    sku?: string;
    name: string;
    ideal_cycle_time_seconds: number;
    active?: boolean;
  }): Promise<Product> {
    assertAuthenticatedHttp();
    assertLanForMutation();
    return reqJson(
      {
        method: 'POST',
        path: ADMIN_ENDPOINTS.PRODUCTS_CREATE.buildPath(),
        body: { productId: data.product_id.trim(), productName: data.name.trim(), stdCycleTimeSec: data.ideal_cycle_time_seconds },
        timeoutMs: MUTATION_TIMEOUT_MS,
        retry: false,
        endpointKey: 'PRODUCTS_CREATE',
        capability: 'product.manage',
        resourceId: data.product_id,
      },
      mapProduct,
    );
  },

  async updateProduct(
    productId: string,
    patch: { sku?: string; name?: string; ideal_cycle_time_seconds?: number; active?: boolean },
  ): Promise<Product> {
    assertAuthenticatedHttp();
    assertLanForMutation();
    return reqJson(
      {
        method: 'PUT',
        path: ADMIN_ENDPOINTS.PRODUCTS_UPDATE.buildPath(productId),
        body: {
          ...(patch.name !== undefined ? { productName: patch.name } : {}),
          ...(patch.ideal_cycle_time_seconds !== undefined ? { stdCycleTimeSec: patch.ideal_cycle_time_seconds } : {}),
        },
        timeoutMs: MUTATION_TIMEOUT_MS,
        retry: false,
        endpointKey: 'PRODUCTS_UPDATE',
        capability: 'product.manage',
        resourceId: productId,
      },
      mapProduct,
    );
  },

  async deleteProduct(productId: string): Promise<{ success: boolean }> {
    assertAuthenticatedHttp();
    assertLanForMutation();
    const raw = await reqJson<{ success?: boolean } | undefined>({
      method: 'DELETE',
      path: ADMIN_ENDPOINTS.PRODUCTS_DELETE.buildPath(productId),
      timeoutMs: MUTATION_TIMEOUT_MS,
      retry: false,
      endpointKey: 'PRODUCTS_DELETE',
      capability: 'product.manage',
      resourceId: productId,
    });
    return { success: raw?.success ?? true };
  }
};
