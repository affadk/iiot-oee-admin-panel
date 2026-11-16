/**
 * Method demo — domain products.
 *
 * Dipisah dari file god-file pada refactoring R9 (kontrak docs/DIRECTORY_STRUCTURE.md).
 * Satu file = satu domain. Barrel penggabung ada di file induknya.
 */
import { store } from './store';
import { checkAbort, assertCapability, throwValidationIssues } from './helpers';
import { ADMIN_ENDPOINTS } from '../endpoints';
import { Product } from '../../../types/production';
import { ApiError } from '../../../types/auth';
import { CursorPageResponse } from '../../../types/historical';
import { validateProductInput } from '../../../utils/capabilities';
import { paginateWithCursor } from '../../../utils/historicalExport';

export const demoProducts = {
  // =========================================================================
  // PRODUCTS (5 ops — public read; ADMIN+LAN mutations)
  // =========================================================================
  async getProductsPage(
    query: { cursor?: string | null; limit?: number } = {},
    signal?: AbortSignal
  ): Promise<CursorPageResponse<Product>> {
    checkAbort(signal);
    const qs = new URLSearchParams({ envelope: 'true' });
    if (query.limit) qs.set('limit', String(query.limit));
    if (query.cursor) qs.set('cursor', query.cursor);
    store.recordEndpoint('PRODUCTS_LIST', `${ADMIN_ENDPOINTS.PRODUCTS_LIST.buildPath()}?${qs.toString()}`);
    return paginateWithCursor(store.products, (p) => p.created_at ?? '2026-01-01T00:00:00Z', {
      cursor: query.cursor,
      limit: query.limit ?? 50,
      maxLimit: 100,
    });
  },

  async getProducts(signal?: AbortSignal): Promise<Product[]> {
    checkAbort(signal);
    store.recordEndpoint('PRODUCTS_LIST', ADMIN_ENDPOINTS.PRODUCTS_LIST.buildPath());
    return store.products.map((p) => ({ ...p }));
  },

  async getProductById(productId: string, signal?: AbortSignal): Promise<Product> {
    checkAbort(signal);
    store.recordEndpoint('PRODUCTS_GET', ADMIN_ENDPOINTS.PRODUCTS_GET.buildPath(productId));
    const prod = store.products.find((p) => p.product_id === productId);
    if (!prod) {
      throw new ApiError({ code: 'PRODUCT_NOT_FOUND', message: 'Produk tidak ditemukan.', httpStatus: 404 });
    }
    return { ...prod };
  },

  async createProduct(data: {
    product_id: string;
    sku?: string;
    name: string;
    ideal_cycle_time_seconds: number;
    active?: boolean;
  }): Promise<Product> {
    assertCapability('product.manage', ['ADMIN'], { resourceId: data.product_id });
    const errors = validateProductInput({
      productId: data.product_id,
      productName: data.name,
      stdCycleTimeSec: data.ideal_cycle_time_seconds,
      isCreate: true,
    });
    if (Object.keys(errors).length > 0) {
      throwValidationIssues('Validasi pembuatan produk gagal.', errors);
    }

    store.recordEndpoint('PRODUCTS_CREATE', ADMIN_ENDPOINTS.PRODUCTS_CREATE.buildPath());
    const id = data.product_id.trim();
    if (store.products.some((p) => p.product_id === id)) {
      throw new ApiError({
        code: 'PRODUCT_ALREADY_EXISTS',
        message: `Product ID "${id}" sudah ada.`,
        httpStatus: 409,
      });
    }

    const newProd: Product = {
      product_id: id,
      sku: data.sku?.trim() || id,
      name: data.name.trim(),
      ideal_cycle_time_seconds: data.ideal_cycle_time_seconds,
      active: data.active ?? true,
      created_at: new Date().toISOString(),
    };
    store.products.push(newProd);
    store.addAudit('CREATE_PRODUCT', 'PRODUCT', newProd.product_id, `Created product ${newProd.product_id} (${newProd.name})`);
    return { ...newProd };
  },

  async updateProduct(
    productId: string,
    patch: { sku?: string; name?: string; ideal_cycle_time_seconds?: number; active?: boolean }
  ): Promise<Product> {
    assertCapability('product.manage', ['ADMIN'], { resourceId: productId });
    const prod = store.products.find((p) => p.product_id === productId);
    if (!prod) {
      store.recordEndpoint('PRODUCTS_UPDATE', ADMIN_ENDPOINTS.PRODUCTS_UPDATE.buildPath(productId));
      throw new ApiError({ code: 'PRODUCT_NOT_FOUND', message: 'Produk tidak ditemukan.', httpStatus: 404 });
    }

    const errors = validateProductInput({
      productName: patch.name ?? prod.name,
      stdCycleTimeSec: patch.ideal_cycle_time_seconds ?? prod.ideal_cycle_time_seconds,
      isCreate: false,
    });
    if (Object.keys(errors).length > 0) {
      throwValidationIssues('Validasi pembaruan produk gagal.', errors);
    }

    store.recordEndpoint('PRODUCTS_UPDATE', ADMIN_ENDPOINTS.PRODUCTS_UPDATE.buildPath(productId));
    Object.assign(prod, patch);
    store.addAudit('UPDATE_PRODUCT', 'PRODUCT', productId, `Updated product ${prod.product_id}`);
    return { ...prod };
  },

  async deleteProduct(productId: string): Promise<{ success: boolean }> {
    assertCapability('product.manage', ['ADMIN'], { resourceId: productId });
    store.recordEndpoint('PRODUCTS_DELETE', ADMIN_ENDPOINTS.PRODUCTS_DELETE.buildPath(productId));
    const prod = store.products.find((p) => p.product_id === productId);
    if (!prod) {
      throw new ApiError({ code: 'PRODUCT_NOT_FOUND', message: 'Produk tidak ditemukan.', httpStatus: 404 });
    }

    const activeWo = store.workOrders.find(
      (w) => w.product_id === productId && (w.status === 'ACTIVE' || w.status === 'PENDING')
    );
    if (activeWo) {
      throw new ApiError({
        code: 'PRODUCT_HAS_ACTIVE_WO',
        message: `Tidak dapat menghapus produk: dipakai oleh Work Order ${activeWo.status} (${activeWo.wo_id}).`,
        httpStatus: 409,
        activeWoId: activeWo.wo_id,
      });
    }

    // ON DELETE SET NULL preserves historical completed/aborted WOs
    store.workOrders.forEach((wo) => {
      if (wo.product_id === productId) {
        wo.product_id = null;
        wo.product_name = null;
      }
    });

    store.products = store.products.filter((p) => p.product_id !== productId);
    store.addAudit('PRODUCT_DELETED', 'PRODUCT', productId, `Deleted product ${productId} (WO history set null)`);
    return { success: true };
  }
};
