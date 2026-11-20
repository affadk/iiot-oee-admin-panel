import React from 'react';
import { Product } from '../../../types/production';
import { Button } from '../../../components/ui/Button';
import { Input } from '../../../components/ui/Input';
import { Modal } from '../../../components/ui/Modal';

export interface ProductsFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  editingProduct: Product | null;
  formProductId: string;
  onFormProductIdChange: (value: string) => void;
  formSku: string;
  onFormSkuChange: (value: string) => void;
  formName: string;
  onFormNameChange: (value: string) => void;
  formCycleTime: number;
  onFormCycleTimeChange: (value: number) => void;
  formActive: boolean;
  onFormActiveChange: (value: boolean) => void;
  formErrors: Record<string, string>;
  isSaving: boolean;
  onSubmit: (e: React.FormEvent) => void;
}

/**
 * Modal create / edit produk (E31.11, dipindah dari ProductsPage).
 * Form state tetap di Page (controlled) — komponen ini hanya presentasi.
 */
export const ProductsFormModal: React.FC<ProductsFormModalProps> = ({
  isOpen,
  onClose,
  editingProduct,
  formProductId,
  onFormProductIdChange,
  formSku,
  onFormSkuChange,
  formName,
  onFormNameChange,
  formCycleTime,
  onFormCycleTimeChange,
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
      title={editingProduct ? `Edit Produk ${editingProduct.product_id}` : 'Tambah Produk Baru'}
      subtitle="Kode produk menggunakan 3–32 karakter huruf besar, angka, '_' atau '-' dan waktu siklus lebih dari 0 detik."
      footer={
        <div className="flex items-center gap-2">
          <Button variant="ghost" onClick={onClose} disabled={isSaving}>
            Batal
          </Button>
          <Button onClick={onSubmit} isLoading={isSaving}>
            {editingProduct ? 'Simpan Perubahan' : 'Buat Produk'}
          </Button>
        </div>
      }
    >
      <form onSubmit={onSubmit} className="space-y-4">
        {!editingProduct && (
          <Input
            label="Product ID"
            value={formProductId}
            onChange={(e) => onFormProductIdChange(e.target.value.toUpperCase())}
            placeholder="PRD-GEAR-99"
            error={formErrors.productId}
            required
          />
        )}

        <Input
          label="SKU Code"
          value={formSku}
          onChange={(e) => onFormSkuChange(e.target.value)}
          placeholder="SKU-STL-012 (default mengikuti Product ID)"
        />

        <Input
          label="Nama Produk"
          value={formName}
          onChange={(e) => onFormNameChange(e.target.value)}
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
          onChange={(e) => onFormCycleTimeChange(Number(e.target.value))}
          error={formErrors.stdCycleTimeSec}
          required
        />

        <label className="flex items-center gap-2 text-xs text-slate-700 dark:text-slate-300 cursor-pointer">
          <input
            type="checkbox"
            checked={formActive}
            onChange={(e) => onFormActiveChange(e.target.checked)}
            className="rounded border-slate-300 text-sky-600 focus:ring-sky-500"
          />
          <span>Produk aktif dan tersedia untuk jadwal produksi</span>
        </label>
      </form>
    </Modal>
  );
};
