import React, { useEffect, useState, useCallback } from 'react';
import { Factory, Plus, Edit3, Trash2, CheckCircle2, AlertTriangle } from 'lucide-react';
import { apiClient } from '../../services/api/client';
import { ProductionLine } from '../../types/production';
import { ApiError } from '../../types/auth';
import { useCapability, useAuth } from '../../context/AuthContext';
import { validateProductionLineInput } from '../../utils/capabilities';
import { Badge } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { Modal } from '../../components/ui/Modal';
import { ConfirmationDialog } from '../../components/ui/ConfirmationDialog';
import { ConflictDialog, ConflictDialogState } from '../../components/ui/ConflictDialog';
import { CursorPaginationBar } from '../../components/industrial/CursorPaginationBar';
import { TableStateRow } from '../shared/TableStateRow';

export const ProductionLinesPage: React.FC = () => {
  const { reportForbidden, checkCapability } = useAuth();
  const canManage = useCapability('production_line.manage');

  const [lines, setLines] = useState<ProductionLine[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [pageLimit, setPageLimit] = useState(20);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);

  // Create / Edit Modal
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingLine, setEditingLine] = useState<ProductionLine | null>(null);
  const [formLineId, setFormLineId] = useState('LINE-');
  const [formLineName, setFormLineName] = useState('');
  const [formDescription, setFormDescription] = useState('');
  const [formActive, setFormActive] = useState(true);
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});
  const [isSaving, setIsSaving] = useState(false);

  // Delete Confirmation
  const [deleteTarget, setDeleteTarget] = useState<ProductionLine | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [conflictState, setConflictState] = useState<ConflictDialogState | null>(null);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; msg: string } | null>(null);

  const loadLines = useCallback(
    async (cursor?: string | null, append = false) => {
      if (append) setIsLoadingMore(true);
      else setIsLoading(true);
      try {
        const page = await apiClient.getProductionLinesPage({ cursor: cursor ?? undefined, limit: pageLimit });
        setLines((prev) => (append ? [...prev, ...page.data] : page.data));
        setTotalCount((prev) => page.pagination.total_count ?? (append ? prev + page.data.length : page.data.length));
        setHasMore(page.pagination.has_more);
        setNextCursor(page.pagination.next_cursor);
      } catch (err: any) {
        setFeedback({ type: 'error', msg: err?.message || 'Gagal memuat daftar lini produksi.' });
      } finally {
        setIsLoading(false);
        setIsLoadingMore(false);
      }
    },
    [pageLimit]
  );

  useEffect(() => {
    loadLines(null, false);
  }, [loadLines]);

  const openCreateModal = () => {
    setEditingLine(null);
    setFormLineId('LINE-');
    setFormLineName('');
    setFormDescription('');
    setFormActive(true);
    setFormErrors({});
    setIsFormOpen(true);
  };

  const openEditModal = (line: ProductionLine) => {
    setEditingLine(line);
    setFormLineId(line.lineId);
    setFormLineName(line.lineName);
    setFormDescription(line.description ?? '');
    setFormActive(line.isActive);
    setFormErrors({});
    setIsFormOpen(true);
  };

  const handleSubmitForm = async (e: React.FormEvent) => {
    e.preventDefault();
    const errs = validateProductionLineInput({
      lineId: editingLine ? undefined : formLineId,
      lineName: formLineName,
      description: formDescription || null,
      isCreate: !editingLine,
    });
    if (Object.keys(errs).length > 0) {
      setFormErrors(errs);
      return;
    }

    setIsSaving(true);
    setFeedback(null);
    try {
      if (editingLine) {
        const updated = await apiClient.updateProductionLine(editingLine.lineId, {
          lineName: formLineName.trim(),
          description: formDescription.trim() || null,
          isActive: formActive,
        });
        setLines((prev) => prev.map((l) => (l.lineId === updated.lineId ? updated : l)));
        setFeedback({ type: 'success', msg: `Lini ${updated.lineId} berhasil diperbarui.` });
      } else {
        const created = await apiClient.createProductionLine({
          lineId: formLineId.trim(),
          lineName: formLineName.trim(),
          description: formDescription.trim() || null,
          isActive: formActive,
        });
        setLines((prev) => [created, ...prev]);
        setTotalCount((c) => c + 1);
        setFeedback({ type: 'success', msg: `Lini ${created.lineId} (${created.lineName}) berhasil dibuat.` });
      }
      setIsFormOpen(false);
    } catch (err: any) {
      if (err instanceof ApiError && err.httpStatus === 403) {
        reportForbidden('production_line.manage', formLineId, err.message);
      }
      setFeedback({ type: 'error', msg: err?.message || 'Gagal menyimpan data lini produksi.' });
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteLine = async () => {
    if (!deleteTarget) return;
    setIsDeleting(true);
    setFeedback(null);
    try {
      await apiClient.deleteProductionLine(deleteTarget.lineId);
      setLines((prev) => prev.filter((l) => l.lineId !== deleteTarget.lineId));
      setTotalCount((c) => Math.max(0, c - 1));
      setFeedback({
        type: 'success',
        msg: `Lini ${deleteTarget.lineId} dihapus. Riwayat shift & Work Order tetap tersimpan untuk arsip.`,
      });
      setDeleteTarget(null);
    } catch (err: any) {
      if (err instanceof ApiError && err.httpStatus === 403) {
        reportForbidden('production_line.manage', deleteTarget.lineId, err.message);
      }
      if (err instanceof ApiError && err.httpStatus === 409) {
        setConflictState({
          open: true,
          code: err.code,
          title: `Tidak Dapat Menghapus Lini ${deleteTarget.lineId}`,
          message: err.message,
        });
      }
      setFeedback({ type: 'error', msg: err?.message || 'Gagal menghapus lini produksi.' });
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
            Production Lines
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            Daftar induk lini produksi — pembatas otorisasi (scope) operator, mesin, dan jadwal shift.
          </p>
        </div>

        <Button
          size="sm"
          onClick={openCreateModal}
          disabled={!canManage.canInteract}
          title={!canManage.canInteract ? canManage.reason : 'Tambah lini produksi baru'}
        >
          <Plus className="w-4 h-4" />
          <span>Tambah Lini</span>
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
                <th className="py-3 px-4">Line ID</th>
                <th className="py-3 px-4">Nama Lini</th>
                <th className="py-3 px-4">Deskripsi</th>
                <th className="py-3 px-4">Status</th>
                <th className="py-3 px-4 text-right">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800/80 text-xs">
              {/* E28 Batch B (FAT-219, E2E-05): empty state pola bersama
                  (TableStateRow) — loading = skeleton, kosong = sebab + aksi. */}
              {isLoading ? (
                <TableStateRow isLoading isError={false} colSpan={5} />
              ) : lines.length === 0 ? (
                <TableStateRow
                  isLoading={false}
                  isError={false}
                  colSpan={5}
                  emptyTitle="Belum ada lini produksi"
                  emptyDescription="Daftar lini masih kosong. Tambah lini pertama lewat tombol 'Tambah Lini' di atas."
                />
              ) : (
                lines.map((line) => {
                  const rowManageCap = checkCapability('production_line.manage', line.lineId);
                  return (
                    <tr key={line.lineId} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30">
                      <td className="py-3 px-4 font-tabular">
                        <div className="flex items-center gap-2 font-semibold text-slate-900 dark:text-slate-100">
                          <Factory className="w-4 h-4 text-sky-500 shrink-0" />
                          <span>{line.lineId}</span>
                        </div>
                      </td>
                      <td className="py-3 px-4 font-medium text-slate-800 dark:text-slate-200">{line.lineName}</td>
                      <td className="py-3 px-4 text-slate-500 dark:text-slate-400">{line.description ?? '—'}</td>
                      <td className="py-3 px-4">
                        <Badge variant={line.isActive ? 'success' : 'neutral'}>
                          {line.isActive ? 'ACTIVE' : 'INACTIVE'}
                        </Badge>
                      </td>
                      <td className="py-3 px-4 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <Button
                            size="sm"
                            variant="outline"
                            disabled={!rowManageCap.canInteract}
                            title={!rowManageCap.canInteract ? rowManageCap.reason : 'Ubah lini produksi'}
                            onClick={() => openEditModal(line)}
                          >
                            <Edit3 className="w-3.5 h-3.5" />
                            <span>Edit</span>
                          </Button>
                          <Button
                            size="sm"
                            variant="danger"
                            disabled={!rowManageCap.canInteract}
                            title={!rowManageCap.canInteract ? rowManageCap.reason : 'Hapus lini produksi'}
                            onClick={() => setDeleteTarget(line)}
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
        loadedCount={lines.length}
        totalCount={totalCount}
        hasMore={hasMore}
        nextCursor={nextCursor}
        pageLimit={pageLimit}
        onPageLimitChange={(l) => setPageLimit(l)}
        onLoadMore={() => loadLines(nextCursor, true)}
        onReset={() => loadLines(null, false)}
        isLoading={isLoadingMore}
        hasActiveCursor={lines.length > pageLimit}
      />

      {/* Create / Edit Modal */}
      <Modal
        isOpen={isFormOpen}
        onClose={() => setIsFormOpen(false)}
        title={editingLine ? `Edit Lini ${editingLine.lineId}` : 'Tambah Lini Produksi Baru'}
        subtitle="Line ID menggunakan 1–64 karakter huruf besar, angka, '_' atau '-'."
        footer={
          <div className="flex items-center gap-2">
            <Button variant="ghost" onClick={() => setIsFormOpen(false)} disabled={isSaving}>
              Batal
            </Button>
            <Button onClick={handleSubmitForm} isLoading={isSaving}>
              {editingLine ? 'Simpan Perubahan' : 'Buat Lini'}
            </Button>
          </div>
        }
      >
        <form onSubmit={handleSubmitForm} className="space-y-4">
          {!editingLine && (
            <Input
              label="Line ID"
              value={formLineId}
              onChange={(e) => setFormLineId(e.target.value.toUpperCase())}
              placeholder="LINE-03"
              error={formErrors.lineId}
              required
            />
          )}

          <Input
            label="Nama Lini"
            value={formLineName}
            onChange={(e) => setFormLineName(e.target.value)}
            placeholder="Contoh: Lini Produksi 3 — Assembly"
            error={formErrors.lineName}
            required
          />

          <Input
            label="Deskripsi"
            value={formDescription}
            onChange={(e) => setFormDescription(e.target.value)}
            placeholder="Keterangan singkat lini (opsional)"
            error={formErrors.description}
          />

          <label className="flex items-center gap-2 text-xs text-slate-700 dark:text-slate-300 cursor-pointer">
            <input
              type="checkbox"
              checked={formActive}
              onChange={(e) => setFormActive(e.target.checked)}
              className="rounded border-slate-300 text-sky-600 focus:ring-sky-500"
            />
            <span>Lini aktif dan tersedia untuk operator, mesin, dan jadwal shift</span>
          </label>
        </form>
      </Modal>

      {/* Delete Confirmation */}
      <ConfirmationDialog
        isOpen={Boolean(deleteTarget)}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleDeleteLine}
        title={`Hapus Lini ${deleteTarget?.lineId ?? ''}?`}
        variant="destructive"
        description={`Penghapusan lini ${deleteTarget?.lineName} ditolak (RESTRICT) bila masih dipakai mesin atau operator. Riwayat shift & Work Order tidak ikut terhapus.`}
        impacts={[
          'Relasi master pada Mesin, Operator, Jadwal Shift, dan Work Order historis akan berubah menjadi null ([dihapus]); riwayat produksi tidak dihapus.',
          'Membutuhkan peran ADMIN melalui jaringan lokal pabrik.',
        ]}
        confirmLabel="Ya, Hapus Lini"
        isLoading={isDeleting}
      />

      <ConflictDialog conflict={conflictState} onClose={() => setConflictState(null)} />
    </div>
  );
};
