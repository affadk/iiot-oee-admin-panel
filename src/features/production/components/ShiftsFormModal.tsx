import React from 'react';
import { Shift } from '../../../types/production';
import { Button } from '../../../components/ui/Button';
import { Input } from '../../../components/ui/Input';
import { Modal } from '../../../components/ui/Modal';

export interface ShiftsFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  editingShift: Shift | null;
  formShiftId: string;
  onFormShiftIdChange: (value: string) => void;
  formShiftName: string;
  onFormShiftNameChange: (value: string) => void;
  formShiftCode: string;
  onFormShiftCodeChange: (value: string) => void;
  formStartTime: string;
  onFormStartTimeChange: (value: string) => void;
  formEndTime: string;
  onFormEndTimeChange: (value: string) => void;
  formActive: boolean;
  onFormActiveChange: (value: boolean) => void;
  formErrors: Record<string, string>;
  isSaving: boolean;
  onSubmit: (e: React.FormEvent) => void;
}

/**
 * Modal create / edit shift (E31.11, dipindah dari ShiftsPage).
 * Form state tetap di Page (controlled) — komponen ini hanya presentasi.
 */
export const ShiftsFormModal: React.FC<ShiftsFormModalProps> = ({
  isOpen,
  onClose,
  editingShift,
  formShiftId,
  onFormShiftIdChange,
  formShiftName,
  onFormShiftNameChange,
  formShiftCode,
  onFormShiftCodeChange,
  formStartTime,
  onFormStartTimeChange,
  formEndTime,
  onFormEndTimeChange,
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
      title={editingShift ? `Edit Shift ${editingShift.shiftId}` : 'Tambah Shift Baru'}
      subtitle="Shift ID menggunakan 1–64 karakter huruf besar, angka, '_' atau '-'. Jam dalam format 24 jam (HH:MM)."
      footer={
        <div className="flex items-center gap-2">
          <Button variant="ghost" onClick={onClose} disabled={isSaving}>
            Batal
          </Button>
          <Button onClick={onSubmit} isLoading={isSaving}>
            {editingShift ? 'Simpan Perubahan' : 'Buat Shift'}
          </Button>
        </div>
      }
    >
      <form onSubmit={onSubmit} className="space-y-4">
        {!editingShift && (
          <Input
            label="Shift ID"
            value={formShiftId}
            onChange={(e) => onFormShiftIdChange(e.target.value.toUpperCase())}
            placeholder="SHIFT-4"
            error={formErrors.shiftId}
            required
          />
        )}

        <Input
          label="Nama Shift"
          value={formShiftName}
          onChange={(e) => onFormShiftNameChange(e.target.value)}
          placeholder="Contoh: Shift 4 (Sore)"
          error={formErrors.shiftName}
          required
        />

        <Input
          label="Kode Shift"
          value={formShiftCode}
          onChange={(e) => onFormShiftCodeChange(e.target.value.toUpperCase())}
          placeholder="S4"
          error={formErrors.shiftCode}
          required
        />

        <div className="grid grid-cols-2 gap-3">
          <Input
            label="Jam Mulai"
            type="time"
            value={formStartTime}
            onChange={(e) => onFormStartTimeChange(e.target.value)}
            error={formErrors.startTime}
            required
          />
          <Input
            label="Jam Selesai"
            type="time"
            value={formEndTime}
            onChange={(e) => onFormEndTimeChange(e.target.value)}
            error={formErrors.endTime}
            required
          />
        </div>

        <label className="flex items-center gap-2 text-xs text-slate-700 dark:text-slate-300 cursor-pointer">
          <input
            type="checkbox"
            checked={formActive}
            onChange={(e) => onFormActiveChange(e.target.checked)}
            className="rounded border-slate-300 text-sky-600 focus:ring-sky-500"
          />
          <span>Shift aktif dan tersedia untuk penjadwalan</span>
        </label>
      </form>
    </Modal>
  );
};
