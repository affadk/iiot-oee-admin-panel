import React, { useEffect, useState, useCallback } from 'react';
import { Plus, CheckCircle2, AlertTriangle } from 'lucide-react';
import { apiClient } from '../../services/api/client';
import { Product } from '../../types/production';
import { ApiError } from '../../types/auth';
import { useCapability, useAuth } from '../../context/AuthContext';
import { validateProductInput } from '../../utils/capabilities';
import { Button } from '../../components/ui/Button';
import { ConfirmationDialog } from '../../components/ui/ConfirmationDialog';
import { ConflictDialog, ConflictDialogState } from '../../components/ui/ConflictDialog';
import { CursorPaginationBar } from '../../components/industrial/CursorPaginationBar';
import { ProductsTable } from './components/ProductsTable';
import { ProductsFormModal } from './components/ProductsFormModal';

export const ProductsPage: React.FC = () => {
  const { reportForbidden, checkCapability } = useAuth();
  const canManage = useCapability('product.manage');

  const [products, setProducts] = useState<Product[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [pageLimit, setPageLimit] = useState(20);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);

  // Create / Edit Modal
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [formProductId, setFormProductId] = useState('PRD-');
  const [formSku, setFormSku] = useState('');
  const [formName, setFormName] = useState('');
  const [formCycleTime, setFormCycleTime] = useState(30);
  const [formActive, setFormActive] = useState(true);
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});
  const [isSaving, setIsSaving] = useState(false);

  // Delete Confirmation
  const [deleteTarget, setDeleteTarget] = useState<Product | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [conflictState, setConflictState] = useState<ConflictDialogState | null>(null);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; msg: string } | null>(null);

  const loadProducts = useCallback(
    async (cursor?: string | null, append = false) => {
      if (append) setIsLoadingMore(true);
      else setIsLoading(true);
      try {
        const page = await apiClient.getProductsPage({ cursor: cursor ?? undefined, limit: pageLimit });
        setProducts((prev) => (append ? [...prev, ...page.data] : page.data));
        setTotalCount((prev) => page.pagination.total_count ?? (append ? prev + page.data.length : page.data.length));
        setHasMore(page.pagination.has_more);
        setNextCursor(page.pagination.next_cursor);
      } catch (err: any) {
        setFeedback({ type: 'error', msg: err?.message || 'Gagal memuat katalog produk.' });
      } finally {
        setIsLoading(false);
        setIsLoadingMore(false);
      }
    },
    [pageLimit]
  );

  useEffect(() => {
    loadProducts(null, false);
  }, [loadProducts]);

  const openCreateModal = () => {
    setEditingProduct(null);
    setFormProductId('PRD-');
    setFormSku('');
    setFormName('');
    setFormCycleTime(30);
    setFormActive(true);
    setFormErrors({});
    setIsFormOpen(true);
  };

  const openEditModal = (prod: Product) => {
    setEditingProduct(prod);
    setFormProductId(prod.product_id);
    setFormSku(prod.sku);
    setFormName(prod.name);
    setFormCycleTime(prod.ideal_cycle_time_seconds);
    setFormActive(prod.active);
    setFormErrors({});
    setIsFormOpen(true);
  };

  const handleSubmitForm = async (e: React.FormEvent) => {
    e.preventDefault();
    const errs = validateProductInput({
      productId: editingProduct ? undefined : formProductId,
      productName: formName,
      stdCycleTimeSec: Number(formCycleTime),
      isCreate: !editingProduct,
    });
    if (Object.keys(errs).length > 0) {
      setFormErrors(errs);
      return;
    }

    setIsSaving(true);
    setFeedback(null);
    try {
      if (editingProduct) {
        const updated = await apiClient.updateProduct(editingProduct.product_id, {
          sku: formSku.trim() || editingProduct.product_id,
          name: formName.trim(),
          ideal_cycle_time_seconds: Number(formCycleTime),
          active: formActive,
        });
        setProducts((prev) => prev.map((p) => (p.product_id === updated.product_id ? updated : p)));
        setFeedback({ type: 'success', msg: `Produk ${updated.product_id} berhasil diperbarui.` });
      } else {
        const created = await apiClient.createProduct({
          product_id: formProductId.trim(),
          sku: formSku.trim() || formProductId.trim(),
          name: formName.trim(),
          ideal_cycle_time_seconds: Number(formCycleTime),
          active: formActive,
        });
        setProducts((prev) => [created, ...prev]);
        setTotalCount((c) => c + 1);
        setFeedback({ type: 'success', msg: `Produk ${created.product_id} (${created.name}) berhasil dibuat.` });
      }
      setIsFormOpen(false);
    } catch (err: any) {
      if (err instanceof ApiError && err.httpStatus === 403) {
        reportForbidden('product.manage', formProductId, err.message);
      }
      setFeedback({ type: 'error', msg: err?.message || 'Gagal menyimpan data produk.' });
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteProduct = async () => {
    if (!deleteTarget) return;
    setIsDeleting(true);
    setFeedback(null);
    try {
      await apiClient.deleteProduct(deleteTarget.product_id);
      setProducts((prev) => prev.filter((p) => p.product_id !== deleteTarget.product_id));
      setTotalCount((c) => Math.max(0, c - 1));
      setFeedback({
        type: 'success',
        msg: `Produk ${deleteTarget.product_id} dihapus. Riwayat Work Order yang telah selesai tetap tersimpan untuk arsip.`,
      });
      setDeleteTarget(null);
    } catch (err: any) {
      if (err instanceof ApiError && err.httpStatus === 403) {
        reportForbidden('product.manage', deleteTarget.product_id, err.message);
      }
      if (err instanceof ApiError && err.httpStatus === 409) {
        setConflictState({
          open: true,
          code: err.code,
          title: `Tidak Dapat Menghapus Produk ${deleteTarget.product_id}`,
          message: err.message,
          activeWoId: err.activeWoId,
        });
      }
      const extraWo = err?.activeWoId ? ` (Active/Pending WO: ${err.activeWoId})` : '';
      setFeedback({ type: 'error', msg: `${err?.message || 'Gagal menghapus produk.'}${extraWo}` });
      setDeleteTarget(null);
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-slate-900 dark:text-slate-100 tracking-tight">
            Product Catalog &amp; Standard Cycle Time
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            Daftar induk produk (SKU) dan waktu siklus standar (detik per unit) untuk pengukuran kinerja produksi.
          </p>
        </div>

        <Button
          size="sm"
          onClick={openCreateModal}
          disabled={!canManage.canInteract}
          title={!canManage.canInteract ? canManage.reason : 'Tambah produk master baru'}
        >
          <Plus className="w-4 h-4" />
          <span>Tambah Produk</span>
        </Button>
      </div>

      {feedback && (
        <div
          role={feedback.type === 'error' ? 'alert' : 'status'}
          className={`p-3 rounded-lg border text-xs flex items-center justify-between gap-2 ${
            feedback.type === 'error'
              ? 'bg-red-50 dark:bg-red-950/40 border-red-300 dark:border-red-800 text-red-900 dark:text-red-200'
              : 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-200 dark:border-emerald-800 text-emerald-900 dark:text-emerald-200'
          }`}
        >
          <div className="flex items-center gap-2">
            {feedback.type === 'error' ? (
              <AlertTriangle className="w-4 h-4 shrink-0" />
            ) : (
              <CheckCircle2 className="w-4 h-4 shrink-0" />
            )}
            <span>{feedback.msg}</span>
          </div>
          <button type="button" onClick={() => setFeedback(null)} className="font-bold px-1.5 cursor-pointer">
            ✕
          </button>
        </div>
      )}

      <ProductsTable
        products={products}
        isLoading={isLoading}
        checkCapability={checkCapability}
        onEdit={openEditModal}
        onDelete={setDeleteTarget}
      />

      <CursorPaginationBar
        loadedCount={products.length}
        totalCount={totalCount}
        hasMore={hasMore}
        nextCursor={nextCursor}
        pageLimit={pageLimit}
        onPageLimitChange={(l) => setPageLimit(l)}
        onLoadMore={() => loadProducts(nextCursor, true)}
        onReset={() => loadProducts(null, false)}
        isLoading={isLoadingMore}
        hasActiveCursor={products.length > pageLimit}
      />

      {/* Create / Edit Modal */}
      <ProductsFormModal
        isOpen={isFormOpen}
        onClose={() => setIsFormOpen(false)}
        editingProduct={editingProduct}
        formProductId={formProductId}
        onFormProductIdChange={setFormProductId}
        formSku={formSku}
        onFormSkuChange={setFormSku}
        formName={formName}
        onFormNameChange={setFormName}
        formCycleTime={formCycleTime}
        onFormCycleTimeChange={setFormCycleTime}
        formActive={formActive}
        onFormActiveChange={setFormActive}
        formErrors={formErrors}
        isSaving={isSaving}
        onSubmit={handleSubmitForm}
      />

      {/* Delete Confirmation */}
      <ConfirmationDialog
        isOpen={Boolean(deleteTarget)}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleDeleteProduct}
        title={`Hapus Produk ${deleteTarget?.product_id ?? ''}?`}
        variant="destructive"
        description={`Penghapusan produk ${deleteTarget?.name} tidak dapat dilakukan jika masih digunakan oleh Work Order yang sedang berjalan atau menunggu.`}
        impacts={[
          'Relasi master pada Work Order, Downtime, Telemetri, dan Event historis akan berubah menjadi null ([dihapus]); riwayat produksi tidak dihapus.',
          'Membutuhkan peran ADMIN melalui jaringan lokal pabrik.',
        ]}
        confirmLabel="Ya, Hapus Produk"
        isLoading={isDeleting}
      />

      <ConflictDialog conflict={conflictState} onClose={() => setConflictState(null)} />
    </div>
  );
};
