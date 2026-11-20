import React from 'react';
import { Package, Edit3, Trash2 } from 'lucide-react';
import { Product } from '../../../types/production';
import { CapabilityKey } from '../../../utils/capabilities';
import { Badge } from '../../../components/ui/Badge';
import { Button } from '../../../components/ui/Button';
import { TableStateRow } from '../../shared/TableStateRow';

export interface ProductsTableProps {
  products: Product[];
  isLoading: boolean;
  /** Dipanggil per baris di dalam .map — JANGAN precompute boolean, JANGAN useAuth di sini. */
  checkCapability: (capability: CapabilityKey, resourceId?: string) => {
    canInteract: boolean;
    reason?: string;
  };
  onEdit: (product: Product) => void;
  onDelete: (product: Product) => void;
}

/** Tabel produk (E31.11, dipindah dari ProductsPage). */
export const ProductsTable: React.FC<ProductsTableProps> = ({
  products,
  isLoading,
  checkCapability,
  onEdit,
  onDelete,
}) => {
  return (
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
                          onClick={() => onEdit(prod)}
                        >
                          <Edit3 className="w-3.5 h-3.5" />
                          <span>Edit</span>
                        </Button>
                        <Button
                          size="sm"
                          variant="danger"
                          disabled={!rowManageCap.canInteract}
                          title={!rowManageCap.canInteract ? rowManageCap.reason : 'Hapus produk master'}
                          onClick={() => onDelete(prod)}
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
  );
};
