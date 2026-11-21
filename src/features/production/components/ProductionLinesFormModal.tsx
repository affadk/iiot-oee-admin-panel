import React from 'react';
import { ProductionLine } from '../../../types/production';
import { Button } from '../../../components/ui/Button';
import { Input } from '../../../components/ui/Input';
import { Modal } from '../../../components/ui/Modal';

export interface ProductionLinesFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  editingLine: ProductionLine | null;
  formLineId: string;
  onFormLineIdChange: (value: string) => void;
  formLineName: string;
  onFormLineNameChange: (value: string) => void;
  formDescription: string;
  onFormDescriptionChange: (value: string) => void;
  formActive: boolean;
  onFormActiveChange: (value: boolean) => void;
  formErrors: Record<string, string>;
  isSaving: boolean;
  onSubmit: (e: React.FormEvent) => void;
}

/**
 * Modal create / edit lini produksi (E31.11, dipindah dari ProductionLinesPage).
 * Form state tetap di Page (controlled) — komponen ini hanya presentasi.
 */
export const ProductionLinesFormModal: React.FC<ProductionLinesFormModalProps> = ({
  isOpen,
  onClose,
  editingLine,
  formLineId,
  onFormLineIdChange,
  formLineName,
  onFormLineNameChange,
  formDescription,
  onFormDescriptionChange,
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
      title={editingLine ? `Edit Lini ${editingLine.lineId}` : 'Tambah Lini Produksi Baru'}
      subtitle="Line ID menggunakan 1–64 karakter huruf besar, angka, '_' atau '-'."
      footer={
        <div className="flex items-center gap-2">
          <Button variant="ghost" onClick={onClose} disabled={isSaving}>
            Batal
          </Button>
          <Button onClick={onSubmit} isLoading={isSaving}>
            {editingLine ? 'Simpan Perubahan' : 'Buat Lini'}
          </Button>
        </div>
      }
    >
      <form onSubmit={onSubmit} className="space-y-4">
        {!editingLine && (
          <Input
            label="Line ID"
            value={formLineId}
            onChange={(e) => onFormLineIdChange(e.target.value.toUpperCase())}
            placeholder="LINE-03"
            error={formErrors.lineId}
            required
          />
        )}

        <Input
          label="Nama Lini"
          value={formLineName}
          onChange={(e) => onFormLineNameChange(e.target.value)}
          placeholder="Contoh: Lini Produksi 3 — Assembly"
          error={formErrors.lineName}
          required
        />

        <Input
          label="Deskripsi"
          value={formDescription}
          onChange={(e) => onFormDescriptionChange(e.target.value)}
          placeholder="Keterangan singkat lini (opsional)"
          error={formErrors.description}
        />

        <label className="flex items-center gap-2 text-xs text-slate-700 dark:text-slate-300 cursor-pointer">
          <input
            type="checkbox"
            checked={formActive}
            onChange={(e) => onFormActiveChange(e.target.checked)}
            className="rounded border-slate-300 text-sky-600 focus:ring-sky-500"
          />
          <span>Lini aktif dan tersedia untuk operator, mesin, dan jadwal shift</span>
        </label>
      </form>
    </Modal>
  );
};
