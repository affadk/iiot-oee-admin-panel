import React, { useEffect, useState, useCallback } from 'react';
import { Plus, CheckCircle2, AlertTriangle } from 'lucide-react';
import { apiClient } from '../../services/api/client';
import { Shift } from '../../types/production';
import { ApiError } from '../../types/auth';
import { useCapability, useAuth } from '../../context/AuthContext';
import { validateShiftInput } from '../../utils/capabilities';
import { Button } from '../../components/ui/Button';
import { ConfirmationDialog } from '../../components/ui/ConfirmationDialog';
import { ConflictDialog, ConflictDialogState } from '../../components/ui/ConflictDialog';
import { CursorPaginationBar } from '../../components/industrial/CursorPaginationBar';
import { ShiftsTable } from './components/ShiftsTable';
import { ShiftsFormModal } from './components/ShiftsFormModal';

export const ShiftsPage: React.FC = () => {
  const { reportForbidden, checkCapability } = useAuth();
  const canManage = useCapability('shift.manage');

  const [shifts, setShifts] = useState<Shift[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [pageLimit, setPageLimit] = useState(20);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);

  // Create / Edit Modal
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingShift, setEditingShift] = useState<Shift | null>(null);
  const [formShiftId, setFormShiftId] = useState('SHIFT-');
  const [formShiftName, setFormShiftName] = useState('');
  const [formShiftCode, setFormShiftCode] = useState('');
  const [formStartTime, setFormStartTime] = useState('07:00');
  const [formEndTime, setFormEndTime] = useState('15:00');
  const [formActive, setFormActive] = useState(true);
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});
  const [isSaving, setIsSaving] = useState(false);

  // Delete Confirmation
  const [deleteTarget, setDeleteTarget] = useState<Shift | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [conflictState, setConflictState] = useState<ConflictDialogState | null>(null);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; msg: string } | null>(null);

  const loadShifts = useCallback(
    async (cursor?: string | null, append = false) => {
      if (append) setIsLoadingMore(true);
      else setIsLoading(true);
      try {
        const page = await apiClient.getShiftsPage({ cursor: cursor ?? undefined, limit: pageLimit });
        setShifts((prev) => (append ? [...prev, ...page.data] : page.data));
        setTotalCount((prev) => page.pagination.total_count ?? (append ? prev + page.data.length : page.data.length));
        setHasMore(page.pagination.has_more);
        setNextCursor(page.pagination.next_cursor);
      } catch (err: any) {
        setFeedback({ type: 'error', msg: err?.message || 'Gagal memuat daftar shift.' });
      } finally {
        setIsLoading(false);
        setIsLoadingMore(false);
      }
    },
    [pageLimit]
  );

  useEffect(() => {
    loadShifts(null, false);
  }, [loadShifts]);

  const openCreateModal = () => {
    setEditingShift(null);
    setFormShiftId('SHIFT-');
    setFormShiftName('');
    setFormShiftCode('');
    setFormStartTime('07:00');
    setFormEndTime('15:00');
    setFormActive(true);
    setFormErrors({});
    setIsFormOpen(true);
  };

  const openEditModal = (shift: Shift) => {
    setEditingShift(shift);
    setFormShiftId(shift.shiftId);
    setFormShiftName(shift.shiftName);
    setFormShiftCode(shift.shiftCode);
    setFormStartTime(shift.startTime);
    setFormEndTime(shift.endTime);
    setFormActive(shift.isActive);
    setFormErrors({});
    setIsFormOpen(true);
  };

  const handleSubmitForm = async (e: React.FormEvent) => {
    e.preventDefault();
    const errs = validateShiftInput({
      shiftId: editingShift ? undefined : formShiftId,
      shiftName: formShiftName,
      shiftCode: formShiftCode,
      startTime: formStartTime,
      endTime: formEndTime,
      isCreate: !editingShift,
    });
    if (Object.keys(errs).length > 0) {
      setFormErrors(errs);
      return;
    }

    setIsSaving(true);
    setFeedback(null);
    try {
      if (editingShift) {
        const updated = await apiClient.updateShift(editingShift.shiftId, {
          shiftName: formShiftName.trim(),
          shiftCode: formShiftCode.trim(),
          startTime: formStartTime,
          endTime: formEndTime,
          isActive: formActive,
        });
        setShifts((prev) => prev.map((s) => (s.shiftId === updated.shiftId ? updated : s)));
        setFeedback({ type: 'success', msg: `Shift ${updated.shiftId} berhasil diperbarui.` });
      } else {
        const created = await apiClient.createShift({
          shiftId: formShiftId.trim(),
          shiftName: formShiftName.trim(),
          shiftCode: formShiftCode.trim(),
          startTime: formStartTime,
          endTime: formEndTime,
          isActive: formActive,
        });
        setShifts((prev) => [created, ...prev]);
        setTotalCount((c) => c + 1);
        setFeedback({ type: 'success', msg: `Shift ${created.shiftId} (${created.shiftName}) berhasil dibuat.` });
      }
      setIsFormOpen(false);
    } catch (err: any) {
      if (err instanceof ApiError && err.httpStatus === 403) {
        reportForbidden('shift.manage', formShiftId, err.message);
      }
      setFeedback({ type: 'error', msg: err?.message || 'Gagal menyimpan data shift.' });
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteShift = async () => {
    if (!deleteTarget) return;
    setIsDeleting(true);
    setFeedback(null);
    try {
      await apiClient.deleteShift(deleteTarget.shiftId);
      setShifts((prev) => prev.filter((s) => s.shiftId !== deleteTarget.shiftId));
      setTotalCount((c) => Math.max(0, c - 1));
      setFeedback({
        type: 'success',
        msg: `Shift ${deleteTarget.shiftId} dihapus. Riwayat shift summary tetap tersimpan untuk arsip.`,
      });
      setDeleteTarget(null);
    } catch (err: any) {
      if (err instanceof ApiError && err.httpStatus === 403) {
        reportForbidden('shift.manage', deleteTarget.shiftId, err.message);
      }
      if (err instanceof ApiError && err.httpStatus === 409) {
        setConflictState({
          open: true,
          code: err.code,
          title: `Tidak Dapat Menghapus Shift ${deleteTarget.shiftId}`,
          message: err.message,
        });
      }
      setFeedback({ type: 'error', msg: err?.message || 'Gagal menghapus shift.' });
      setDeleteTarget(null);
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-slate-900 dark:text-slate-100 tracking-tight">Shifts</h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            Daftar induk shift kerja — jam mulai/selesai menjadi acuan ringkasan OEE per shift.
          </p>
        </div>

        <Button
          size="sm"
          onClick={openCreateModal}
          disabled={!canManage.canInteract}
          title={!canManage.canInteract ? canManage.reason : 'Tambah shift baru'}
        >
          <Plus className="w-4 h-4" />
          <span>Tambah Shift</span>
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

      <ShiftsTable
        shifts={shifts}
        isLoading={isLoading}
        checkCapability={checkCapability}
        onEdit={openEditModal}
        onDelete={setDeleteTarget}
      />

      <CursorPaginationBar
        loadedCount={shifts.length}
        totalCount={totalCount}
        hasMore={hasMore}
        nextCursor={nextCursor}
        pageLimit={pageLimit}
        onPageLimitChange={(l) => setPageLimit(l)}
        onLoadMore={() => loadShifts(nextCursor, true)}
        onReset={() => loadShifts(null, false)}
        isLoading={isLoadingMore}
        hasActiveCursor={shifts.length > pageLimit}
      />

      {/* Create / Edit Modal */}
      <ShiftsFormModal
        isOpen={isFormOpen}
        onClose={() => setIsFormOpen(false)}
        editingShift={editingShift}
        formShiftId={formShiftId}
        onFormShiftIdChange={setFormShiftId}
        formShiftName={formShiftName}
        onFormShiftNameChange={setFormShiftName}
        formShiftCode={formShiftCode}
        onFormShiftCodeChange={setFormShiftCode}
        formStartTime={formStartTime}
        onFormStartTimeChange={setFormStartTime}
        formEndTime={formEndTime}
        onFormEndTimeChange={setFormEndTime}
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
        onConfirm={handleDeleteShift}
        title={`Hapus Shift ${deleteTarget?.shiftId ?? ''}?`}
        variant="destructive"
        description={`Penghapusan shift ${deleteTarget?.shiftName} ditolak bila masih dipakai jadwal shift. Riwayat shift summary tidak ikut terhapus.`}
        impacts={[
          'Relasi master pada Jadwal Shift dan ringkasan OEE historis akan berubah menjadi null ([dihapus]); riwayat produksi tidak dihapus.',
          'Membutuhkan peran ADMIN melalui jaringan lokal pabrik.',
        ]}
        confirmLabel="Ya, Hapus Shift"
        isLoading={isDeleting}
      />

      <ConflictDialog conflict={conflictState} onClose={() => setConflictState(null)} />
    </div>
  );
};
