import React, { useEffect, useState, useCallback } from 'react';
import { CalendarClock, Plus, Edit3, Trash2, CheckCircle2, AlertTriangle } from 'lucide-react';
import { apiClient } from '../../services/api/client';
import { ShiftSchedule, ProductionLine, Shift } from '../../types/production';
import { ApiError } from '../../types/auth';
import { useCapability, useAuth } from '../../context/AuthContext';
import { validateShiftScheduleInput } from '../../utils/capabilities';
import { Badge } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';
import { Modal } from '../../components/ui/Modal';
import { Select } from '../../components/ui/Select';
import { ConfirmationDialog } from '../../components/ui/ConfirmationDialog';
import { ConflictDialog, ConflictDialogState } from '../../components/ui/ConflictDialog';
import { CursorPaginationBar } from '../../components/industrial/CursorPaginationBar';

const DAY_NAMES = ['Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu', 'Minggu'];

export const ShiftSchedulesPage: React.FC = () => {
  const { reportForbidden, checkCapability } = useAuth();
  const canManage = useCapability('shift_schedule.manage');

  const [schedules, setSchedules] = useState<ShiftSchedule[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [pageLimit, setPageLimit] = useState(20);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);

  // Reference data for selects
  const [lines, setLines] = useState<ProductionLine[]>([]);
  const [shifts, setShifts] = useState<Shift[]>([]);

  // Filters
  const [filterLineId, setFilterLineId] = useState('');
  const [filterShiftId, setFilterShiftId] = useState('');
  const [filterDay, setFilterDay] = useState('');

  // Create / Edit Modal
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingSchedule, setEditingSchedule] = useState<ShiftSchedule | null>(null);
  const [formLineId, setFormLineId] = useState('');
  const [formShiftId, setFormShiftId] = useState('');
  const [formDayOfWeek, setFormDayOfWeek] = useState(1);
  const [formActive, setFormActive] = useState(true);
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});
  const [isSaving, setIsSaving] = useState(false);

  // Delete Confirmation
  const [deleteTarget, setDeleteTarget] = useState<ShiftSchedule | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [conflictState, setConflictState] = useState<ConflictDialogState | null>(null);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; msg: string } | null>(null);

  const loadSchedules = useCallback(
    async (cursor?: string | null, append = false) => {
      if (append) setIsLoadingMore(true);
      else setIsLoading(true);
      try {
        const page = await apiClient.getShiftSchedulesPage({
          cursor: cursor ?? undefined,
          limit: pageLimit,
          ...(filterLineId ? { line_id: filterLineId } : {}),
          ...(filterShiftId ? { shift_id: filterShiftId } : {}),
          ...(filterDay ? { day_of_week: Number(filterDay) } : {}),
        });
        setSchedules((prev) => (append ? [...prev, ...page.data] : page.data));
        setTotalCount((prev) => page.pagination.total_count ?? (append ? prev + page.data.length : page.data.length));
        setHasMore(page.pagination.has_more);
        setNextCursor(page.pagination.next_cursor);
      } catch (err: any) {
        setFeedback({ type: 'error', msg: err?.message || 'Gagal memuat jadwal shift.' });
      } finally {
        setIsLoading(false);
        setIsLoadingMore(false);
      }
    },
    [pageLimit, filterLineId, filterShiftId, filterDay]
  );

  useEffect(() => {
    loadSchedules(null, false);
  }, [loadSchedules]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [linesPage, shiftsPage] = await Promise.all([
          apiClient.getProductionLinesPage({ limit: 100 }),
          apiClient.getShiftsPage({ limit: 100 }),
        ]);
        if (!cancelled) {
          setLines(linesPage.data);
          setShifts(shiftsPage.data);
        }
      } catch {
        if (!cancelled) setFeedback({ type: 'error', msg: 'Gagal memuat data lini/shift untuk pilihan jadwal.' });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const openCreateModal = () => {
    setEditingSchedule(null);
    setFormLineId(lines[0]?.lineId ?? '');
    setFormShiftId(shifts[0]?.shiftId ?? '');
    setFormDayOfWeek(1);
    setFormActive(true);
    setFormErrors({});
    setIsFormOpen(true);
  };

  const openEditModal = (sch: ShiftSchedule) => {
    setEditingSchedule(sch);
    setFormLineId(sch.lineId);
    setFormShiftId(sch.shiftId);
    setFormDayOfWeek(sch.dayOfWeek);
    setFormActive(sch.isActive);
    setFormErrors({});
    setIsFormOpen(true);
  };

  const handleSubmitForm = async (e: React.FormEvent) => {
    e.preventDefault();
    const errs = validateShiftScheduleInput({
      lineId: formLineId,
      shiftId: formShiftId,
      dayOfWeek: formDayOfWeek,
      isCreate: !editingSchedule,
    });
    if (Object.keys(errs).length > 0) {
      setFormErrors(errs);
      return;
    }

    setIsSaving(true);
    setFeedback(null);
    try {
      if (editingSchedule) {
        const updated = await apiClient.updateShiftSchedule(editingSchedule.scheduleId, {
          lineId: formLineId,
          shiftId: formShiftId,
          dayOfWeek: formDayOfWeek,
          isActive: formActive,
        });
        setSchedules((prev) => prev.map((s) => (s.scheduleId === updated.scheduleId ? updated : s)));
        setFeedback({ type: 'success', msg: `Jadwal ${updated.scheduleId} berhasil diperbarui.` });
      } else {
        const created = await apiClient.createShiftSchedule({
          lineId: formLineId,
          shiftId: formShiftId,
          dayOfWeek: formDayOfWeek,
          isActive: formActive,
        });
        setSchedules((prev) => [created, ...prev]);
        setTotalCount((c) => c + 1);
        setFeedback({ type: 'success', msg: `Jadwal ${created.scheduleId} berhasil dibuat.` });
      }
      setIsFormOpen(false);
    } catch (err: any) {
      if (err instanceof ApiError && err.httpStatus === 403) {
        reportForbidden('shift_schedule.manage', formLineId, err.message);
      }
      if (err instanceof ApiError && err.httpStatus === 409) {
        setConflictState({
          open: true,
          code: err.code,
          title: 'Jadwal Shift Bertabrakan',
          message: err.message,
        });
      }
      setFeedback({ type: 'error', msg: err?.message || 'Gagal menyimpan jadwal shift.' });
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteSchedule = async () => {
    if (!deleteTarget) return;
    setIsDeleting(true);
    setFeedback(null);
    try {
      await apiClient.deleteShiftSchedule(deleteTarget.scheduleId);
      setSchedules((prev) => prev.filter((s) => s.scheduleId !== deleteTarget.scheduleId));
      setTotalCount((c) => Math.max(0, c - 1));
      setFeedback({
        type: 'success',
        msg: `Jadwal ${deleteTarget.scheduleId} dihapus. Riwayat shift summary tetap tersimpan untuk arsip.`,
      });
      setDeleteTarget(null);
    } catch (err: any) {
      if (err instanceof ApiError && err.httpStatus === 403) {
        reportForbidden('shift_schedule.manage', deleteTarget.scheduleId, err.message);
      }
      setFeedback({ type: 'error', msg: err?.message || 'Gagal menghapus jadwal shift.' });
      setDeleteTarget(null);
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-slate-900 dark:text-slate-100 tracking-tight">Shift Schedules</h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            Penugasan shift per lini per hari — satu lini tidak boleh punya dua shift yang jamnya tumpang tindih di hari yang sama.
          </p>
        </div>

        <Button
          size="sm"
          onClick={openCreateModal}
          disabled={!canManage.canInteract || lines.length === 0 || shifts.length === 0}
          title={!canManage.canInteract ? canManage.reason : 'Tambah jadwal shift baru'}
        >
          <Plus className="w-4 h-4" />
          <span>Tambah Jadwal</span>
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

      {/* Filters */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <Select
          label="Lini Produksi"
          value={filterLineId}
          onChange={(e) => setFilterLineId(e.target.value)}
          options={[{ value: '', label: 'Semua Lini' }, ...lines.map((l) => ({ value: l.lineId, label: `${l.lineId} — ${l.lineName}` }))]}
        />
        <Select
          label="Shift"
          value={filterShiftId}
          onChange={(e) => setFilterShiftId(e.target.value)}
          options={[{ value: '', label: 'Semua Shift' }, ...shifts.map((s) => ({ value: s.shiftId, label: `${s.shiftId} — ${s.shiftName}` }))]}
        />
        <Select
          label="Hari"
          value={filterDay}
          onChange={(e) => setFilterDay(e.target.value)}
          options={[{ value: '', label: 'Semua Hari' }, ...DAY_NAMES.map((d, i) => ({ value: String(i + 1), label: d }))]}
        />
      </div>

      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-md overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/50 text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                <th className="py-3 px-4">Jadwal ID</th>
                <th className="py-3 px-4">Lini</th>
                <th className="py-3 px-4">Shift</th>
                <th className="py-3 px-4">Hari</th>
                <th className="py-3 px-4">Status</th>
                <th className="py-3 px-4 text-right">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800/80 text-xs">
              {isLoading ? (
                <tr>
                  <td colSpan={6} className="py-8 text-center text-slate-400">
                    Memuat jadwal shift...
                  </td>
                </tr>
              ) : (
                schedules.map((sch) => {
                  const rowManageCap = checkCapability('shift_schedule.manage', sch.scheduleId);
                  return (
                    <tr key={sch.scheduleId} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30">
                      <td className="py-3 px-4 font-tabular">
                        <div className="flex items-center gap-2 font-semibold text-slate-900 dark:text-slate-100">
                          <CalendarClock className="w-4 h-4 text-sky-500 shrink-0" />
                          <span>{sch.scheduleId}</span>
                        </div>
                      </td>
                      <td className="py-3 px-4 font-mono text-slate-700 dark:text-slate-300">{sch.lineId}</td>
                      <td className="py-3 px-4 font-medium text-slate-800 dark:text-slate-200">
                        {sch.shiftName ?? sch.shiftId}
                        <div className="text-[11px] text-slate-500">
                          {sch.shiftCode ?? ''} {sch.startTime && sch.endTime ? `· ${sch.startTime}–${sch.endTime}` : ''}
                        </div>
                      </td>
                      <td className="py-3 px-4 font-medium text-slate-800 dark:text-slate-200">
                        {DAY_NAMES[sch.dayOfWeek - 1] ?? `Hari ${sch.dayOfWeek}`}
                      </td>
                      <td className="py-3 px-4">
                        <Badge variant={sch.isActive ? 'success' : 'neutral'}>
                          {sch.isActive ? 'ACTIVE' : 'INACTIVE'}
                        </Badge>
                      </td>
                      <td className="py-3 px-4 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <Button
                            size="sm"
                            variant="outline"
                            disabled={!rowManageCap.canInteract}
                            title={!rowManageCap.canInteract ? rowManageCap.reason : 'Ubah jadwal shift'}
                            onClick={() => openEditModal(sch)}
                          >
                            <Edit3 className="w-3.5 h-3.5" />
                            <span>Edit</span>
                          </Button>
                          <Button
                            size="sm"
                            variant="danger"
                            disabled={!rowManageCap.canInteract}
                            title={!rowManageCap.canInteract ? rowManageCap.reason : 'Hapus jadwal shift'}
                            onClick={() => setDeleteTarget(sch)}
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
        loadedCount={schedules.length}
        totalCount={totalCount}
        hasMore={hasMore}
        nextCursor={nextCursor}
        pageLimit={pageLimit}
        onPageLimitChange={(l) => setPageLimit(l)}
        onLoadMore={() => loadSchedules(nextCursor, true)}
        onReset={() => loadSchedules(null, false)}
        isLoading={isLoadingMore}
        hasActiveCursor={schedules.length > pageLimit}
      />

      {/* Create / Edit Modal */}
      <Modal
        isOpen={isFormOpen}
        onClose={() => setIsFormOpen(false)}
        title={editingSchedule ? `Edit Jadwal ${editingSchedule.scheduleId}` : 'Tambah Jadwal Shift Baru'}
        subtitle="Satu lini tidak boleh punya dua shift yang jamnya tumpang tindih di hari yang sama (409 SHIFT_SCHEDULE_OVERLAP)."
        footer={
          <div className="flex items-center gap-2">
            <Button variant="ghost" onClick={() => setIsFormOpen(false)} disabled={isSaving}>
              Batal
            </Button>
            <Button onClick={handleSubmitForm} isLoading={isSaving}>
              {editingSchedule ? 'Simpan Perubahan' : 'Buat Jadwal'}
            </Button>
          </div>
        }
      >
        <form onSubmit={handleSubmitForm} className="space-y-4">
          <Select
            label="Lini Produksi"
            value={formLineId}
            onChange={(e) => setFormLineId(e.target.value)}
            options={lines.map((l) => ({ value: l.lineId, label: `${l.lineId} — ${l.lineName}` }))}
            error={formErrors.lineId}
            required
          />

          <Select
            label="Shift"
            value={formShiftId}
            onChange={(e) => setFormShiftId(e.target.value)}
            options={shifts.map((s) => ({ value: s.shiftId, label: `${s.shiftName} (${s.shiftCode} ${s.startTime}–${s.endTime})` }))}
            error={formErrors.shiftId}
            required
          />

          <Select
            label="Hari"
            value={String(formDayOfWeek)}
            onChange={(e) => setFormDayOfWeek(Number(e.target.value))}
            options={DAY_NAMES.map((d, i) => ({ value: String(i + 1), label: `${d} (hari ke-${i + 1})` }))}
            error={formErrors.dayOfWeek}
            required
          />

          <label className="flex items-center gap-2 text-xs text-slate-700 dark:text-slate-300 cursor-pointer">
            <input
              type="checkbox"
              checked={formActive}
              onChange={(e) => setFormActive(e.target.checked)}
              className="rounded border-slate-300 text-sky-600 focus:ring-sky-500"
            />
            <span>Jadwal aktif dan dipakai untuk ringkasan OEE shift</span>
          </label>
        </form>
      </Modal>

      {/* Delete Confirmation */}
      <ConfirmationDialog
        isOpen={Boolean(deleteTarget)}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleDeleteSchedule}
        title={`Hapus Jadwal ${deleteTarget?.scheduleId ?? ''}?`}
        variant="destructive"
        description={`Penghapusan jadwal ${deleteTarget?.lineId} / ${deleteTarget?.shiftName ?? deleteTarget?.shiftId} hari ${deleteTarget ? DAY_NAMES[deleteTarget.dayOfWeek - 1] : ''} tidak menghapus riwayat shift summary.`}
        impacts={[
          'Ringkasan OEE shift historis untuk kombinasi lini/shift/hari ini tetap tersimpan untuk arsip.',
          'Membutuhkan peran ADMIN melalui jaringan lokal pabrik.',
        ]}
        confirmLabel="Ya, Hapus Jadwal"
        isLoading={isDeleting}
      />

      <ConflictDialog conflict={conflictState} onClose={() => setConflictState(null)} />
    </div>
  );
};
