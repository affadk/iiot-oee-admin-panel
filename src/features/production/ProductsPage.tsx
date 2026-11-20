import React, { useEffect, useState, useCallback } from 'react';
import { Package, Plus, Edit3, Trash2, CheckCircle2, AlertTriangle } from 'lucide-react';
import { apiClient } from '../../services/api/client';
import { Product } from '../../types/production';
import { ApiError } from '../../types/auth';
import { useCapability, useAuth } from '../../context/AuthContext';
import { validateProductInput } from '../../utils/capabilities';
import { Badge } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { Modal } from '../../components/ui/Modal';
import { ConfirmationDialog } from '../../components/ui/ConfirmationDialog';
import { ConflictDialog, ConflictDialogState } from '../../components/ui/ConflictDialog';
import { CursorPaginationBar } from '../../components/industrial/CursorPaginationBar';
import { TableStateRow } from '../shared/TableStateRow';

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

      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-md overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/50 text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                <th className="py-3 px-4">Product ID &amp; SKU</th>
                <th className="py-3 px-4">Nama Produk</th>
                <th className="py-3 px-4 text-right">Std. Cycle Time</th>
                <th className="py-3 px-4">Status</th>
                <th className="py-3 px-4 text-right">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800/80 text-xs">
              {/* E28 Batch B (FAT-219, E2E-05): empty state pola bersama
                  (TableStateRow) — loading = skeleton, kosong = sebab + aksi. */}
              {isLoading ? (
                <TableStateRow isLoading isError={false} colSpan={5} />
              ) : products.length === 0 ? (
                <TableStateRow
                  isLoading={false}
                  isError={false}
                  colSpan={5}
                  emptyTitle="Belum ada produk"
                  emptyDescription="Katalog produk masih kosong. Tambah produk pertama lewat tombol 'Tambah Produk' di atas."
                />
              ) : (
                products.map((prod) => {
                  const rowManageCap = checkCapability('product.manage', prod.product_id);
                  return (
                    <tr key={prod.product_id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30">
                      <td className="py-3 px-4 font-tabular">
                        <div className="flex items-center gap-2 font-semibold text-slate-900 dark:text-slate-100">
                          <Package className="w-4 h-4 text-sky-500 shrink-0" />
                          <span>{prod.product_id}</span>
                        </div>
                        <div className="text-[11px] text-slate-500 pl-6">SKU: {prod.sku}</div>
                      </td>
                      <td className="py-3 px-4 font-medium text-slate-800 dark:text-slate-200">
                        {prod.name}
                      </td>
                      <td className="py-3 px-4 text-right font-tabular font-semibold text-slate-900 dark:text-slate-100">
                        {prod.ideal_cycle_time_seconds} s/pcs
                      </td>
                      <td className="py-3 px-4">
                        <Badge variant={prod.active ? 'success' : 'neutral'}>
                          {prod.active ? 'ACTIVE' : 'ARCHIVED'}
                        </Badge>
                      </td>
                      <td className="py-3 px-4 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <Button
                            size="sm"
                            variant="outline"
                            disabled={!rowManageCap.canInteract}
                            title={!rowManageCap.canInteract ? rowManageCap.reason : 'Ubah spesifikasi produk'}
                            onClick={() => openEditModal(prod)}
                          >
                            <Edit3 className="w-3.5 h-3.5" />
                            <span>Edit</span>
                          </Button>
                          <Button
                            size="sm"
                            variant="danger"
                            disabled={!rowManageCap.canInteract}
                            title={!rowManageCap.canInteract ? rowManageCap.reason : 'Hapus produk master'}
                            onClick={() => setDeleteTarget(prod)}
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                            <span>Hapus</span>
                          </Button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

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
      <Modal
        isOpen={isFormOpen}
        onClose={() => setIsFormOpen(false)}
        title={editingProduct ? `Edit Produk ${editingProduct.product_id}` : 'Tambah Produk Baru'}
        subtitle="Kode produk menggunakan 3–32 karakter huruf besar, angka, '_' atau '-' dan waktu siklus lebih dari 0 detik."
        footer={
          <div className="flex items-center gap-2">
            <Button variant="ghost" onClick={() => setIsFormOpen(false)} disabled={isSaving}>
              Batal
            </Button>
            <Button onClick={handleSubmitForm} isLoading={isSaving}>
              {editingProduct ? 'Simpan Perubahan' : 'Buat Produk'}
            </Button>
          </div>
        }
      >
        <form onSubmit={handleSubmitForm} className="space-y-4">
          {!editingProduct && (
            <Input
              label="Product ID"
              value={formProductId}
              onChange={(e) => setFormProductId(e.target.value.toUpperCase())}
              placeholder="PRD-GEAR-99"
              error={formErrors.productId}
              required
            />
          )}

          <Input
            label="SKU Code"
            value={formSku}
            onChange={(e) => setFormSku(e.target.value)}
            placeholder="SKU-STL-012 (default mengikuti Product ID)"
          />

          <Input
            label="Nama Produk"
            value={formName}
            onChange={(e) => setFormName(e.target.value)}
            placeholder="Contoh: Precision Spur Gear M4"
            error={formErrors.productName}
            required
          />

          <Input
            label="Ideal Cycle Time (Detik / pcs)"
            type="number"
            min={0.1}
            max={9999}
            step={0.5}
            value={formCycleTime}
            onChange={(e) => setFormCycleTime(Number(e.target.value))}
            error={formErrors.stdCycleTimeSec}
            required
          />

          <label className="flex items-center gap-2 text-xs text-slate-700 dark:text-slate-300 cursor-pointer">
            <input
              type="checkbox"
              checked={formActive}
              onChange={(e) => setFormActive(e.target.checked)}
              className="rounded border-slate-300 text-sky-600 focus:ring-sky-500"
            />
            <span>Produk aktif dan tersedia untuk jadwal produksi</span>
          </label>
        </form>
      </Modal>

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
