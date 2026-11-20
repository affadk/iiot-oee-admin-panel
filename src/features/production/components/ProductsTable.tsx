import React, { useMemo } from 'react';
import { Package, Edit3, Trash2 } from 'lucide-react';
import { LegacyColumnDef as ColumnDef } from '@tanstack/react-table/legacy';
import { Product } from '../../../types/production';
import { CapabilityKey } from '../../../utils/capabilities';
import { Badge } from '../../../components/ui/Badge';
import { Button } from '../../../components/ui/Button';
import { DataTable } from '../../../components/industrial/DataTable';

export interface ProductsTableProps {
  products: Product[];
  isLoading: boolean;
  /** Dipanggil per baris di dalam cell renderer — JANGAN precompute boolean, JANGAN useAuth di sini. */
  checkCapability: (capability: CapabilityKey, resourceId?: string) => {
    canInteract: boolean;
    reason?: string;
  };
  onEdit: (product: Product) => void;
  onDelete: (product: Product) => void;
}

// E31.10 (FAT-273): tabel hand-rolled → DataTable (aturan R1). Empty state
// pola bersama (dulu TableStateRow) diteruskan lewat emptyTitle /
// emptyDescription DataTable — teks sama persis.
// E28 Batch B (FAT-219, E2E-05): empty state pola bersama — loading =
// skeleton, kosong = sebab + aksi.
/** Tabel produk (E31.11, dipindah dari ProductsPage). */
export const ProductsTable: React.FC<ProductsTableProps> = ({
  products,
  isLoading,
  checkCapability,
  onEdit,
  onDelete,
}) => {
  const columns = useMemo<ColumnDef<Product, unknown>[]>(
    () => [
      {
        id: 'productId',
        header: 'Product ID & SKU',
        cell: ({ row }) => {
          const prod = row.original;
          return (
            <div className="text-xs font-tabular">
              <div className="flex items-center gap-2 font-semibold text-slate-900 dark:text-slate-100">
                <Package className="w-4 h-4 text-sky-500 shrink-0" />
                <span>{prod.product_id}</span>
              </div>
              <div className="text-[11px] text-slate-500 pl-6">SKU: {prod.sku}</div>
            </div>
          );
        },
      },
      {
        id: 'name',
        header: 'Nama Produk',
        cell: ({ row }) => (
          <div className="text-xs font-medium text-slate-800 dark:text-slate-200">
            {row.original.name}
          </div>
        ),
      },
      {
        id: 'cycleTime',
        header: 'Std. Cycle Time',
        cell: ({ row }) => (
          <div className="text-xs text-right font-tabular font-semibold text-slate-900 dark:text-slate-100">
            {row.original.ideal_cycle_time_seconds} s/pcs
          </div>
        ),
      },
      {
        id: 'status',
        header: 'Status',
        cell: ({ row }) => (
          <Badge variant={row.original.active ? 'success' : 'neutral'}>
            {row.original.active ? 'ACTIVE' : 'ARCHIVED'}
          </Badge>
        ),
      },
      {
        id: 'actions',
        header: 'Aksi',
        cell: ({ row }) => {
          const prod = row.original;
          const rowManageCap = checkCapability('product.manage', prod.product_id);
          return (
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
          );
        },
      },
    ],
    [checkCapability, onEdit, onDelete],
  );

  return (
    <DataTable
      data={products}
      columns={columns}
      getRowId={(prod) => prod.product_id}
      isLoading={isLoading}
      emptyTitle="Belum ada produk"
      emptyDescription="Katalog produk masih kosong. Tambah produk pertama lewat tombol 'Tambah Produk' di atas."
    />
  );
};
