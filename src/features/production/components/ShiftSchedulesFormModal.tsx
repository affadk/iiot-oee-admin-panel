import React from 'react';
import { ShiftSchedule, ProductionLine, Shift } from '../../../types/production';
import { Button } from '../../../components/ui/Button';
import { Modal } from '../../../components/ui/Modal';
import { Select } from '../../../components/ui/Select';

export interface ShiftSchedulesFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  editingSchedule: ShiftSchedule | null;
  lines: ProductionLine[];
  shifts: Shift[];
  /** Nama hari 1=Senin..7=Minggu — didefinisikan sekali di Page, diteruskan ke sini. */
  dayNames: string[];
  formLineId: string;
  onFormLineIdChange: (value: string) => void;
  formShiftId: string;
  onFormShiftIdChange: (value: string) => void;
  formDayOfWeek: number;
  onFormDayOfWeekChange: (value: number) => void;
  formActive: boolean;
  onFormActiveChange: (value: boolean) => void;
  formErrors: Record<string, string>;
  isSaving: boolean;
  onSubmit: (e: React.FormEvent) => void;
}

/**
 * Modal create / edit jadwal shift (E31.11, dipindah dari ShiftSchedulesPage).
 * Form state tetap di Page (controlled) — komponen ini hanya presentasi.
 */
export const ShiftSchedulesFormModal: React.FC<ShiftSchedulesFormModalProps> = ({
  isOpen,
  onClose,
  editingSchedule,
  lines,
  shifts,
  dayNames,
  formLineId,
  onFormLineIdChange,
  formShiftId,
  onFormShiftIdChange,
  formDayOfWeek,
  onFormDayOfWeekChange,
  formActive,
  onFormActiveChange,
  formErrors,
  isSaving,
  onSubmit,
}) => {
  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={editingSchedule ? `Edit Jadwal ${editingSchedule.scheduleId}` : 'Tambah Jadwal Shift Baru'}
      subtitle="Satu lini tidak boleh punya dua shift yang jamnya tumpang tindih di hari yang sama (409 SHIFT_SCHEDULE_OVERLAP)."
      footer={
        <div className="flex items-center gap-2">
          <Button variant="ghost" onClick={onClose} disabled={isSaving}>
            Batal
          </Button>
          <Button onClick={onSubmit} isLoading={isSaving}>
            {editingSchedule ? 'Simpan Perubahan' : 'Buat Jadwal'}
          </Button>
        </div>
      }
    >
      <form onSubmit={onSubmit} className="space-y-4">
        <Select
          label="Lini Produksi"
          value={formLineId}
          onChange={(e) => onFormLineIdChange(e.target.value)}
          options={lines.map((l) => ({ value: l.lineId, label: `${l.lineId} — ${l.lineName}` }))}
          error={formErrors.lineId}
          required
          disabled={Boolean(editingSchedule)}
        />
        {editingSchedule && (
          <p className="text-[11px] text-slate-500 -mt-2">
            Lini tidak dapat diubah setelah jadwal dibuat (body PATCH spec tidak menerima lineId).
          </p>
        )}

        <Select
          label="Shift"
          value={formShiftId}
          onChange={(e) => onFormShiftIdChange(e.target.value)}
          options={shifts.map((s) => ({ value: s.shiftId, label: `${s.shiftName} (${s.shiftCode} ${s.startTime}–${s.endTime})` }))}
          error={formErrors.shiftId}
          required
        />

        <Select
          label="Hari"
          value={String(formDayOfWeek)}
          onChange={(e) => onFormDayOfWeekChange(Number(e.target.value))}
          options={dayNames.map((d, i) => ({ value: String(i + 1), label: `${d} (hari ke-${i + 1})` }))}
          error={formErrors.dayOfWeek}
          required
        />

        <label className="flex items-center gap-2 text-xs text-slate-700 dark:text-slate-300 cursor-pointer">
          <input
            type="checkbox"
            checked={formActive}
            onChange={(e) => onFormActiveChange(e.target.checked)}
            className="rounded border-slate-300 text-sky-600 focus:ring-sky-500"
          />
          <span>Jadwal aktif dan dipakai untuk ringkasan OEE shift</span>
        </label>
      </form>
    </Modal>
  );
};
