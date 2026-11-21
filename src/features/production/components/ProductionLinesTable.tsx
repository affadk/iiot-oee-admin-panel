import React, { useMemo } from 'react';
import { Factory, Edit3, Trash2 } from 'lucide-react';
import { LegacyColumnDef as ColumnDef } from '@tanstack/react-table/legacy';
import { ProductionLine } from '../../../types/production';
import { CapabilityKey } from '../../../utils/capabilities';
import { Badge } from '../../../components/ui/Badge';
import { Button } from '../../../components/ui/Button';
import { DataTable } from '../../../components/industrial/DataTable';

export interface ProductionLinesTableProps {
  lines: ProductionLine[];
  isLoading: boolean;
  /** Dipanggil per baris di dalam cell renderer — JANGAN precompute boolean, JANGAN useAuth di sini. */
  checkCapability: (capability: CapabilityKey, resourceId?: string) => {
    canInteract: boolean;
    reason?: string;
  };
  onEdit: (line: ProductionLine) => void;
  onDelete: (line: ProductionLine) => void;
}

// E31.10 (FAT-273): tabel hand-rolled → DataTable (aturan R1). Empty state
// pola bersama (dulu TableStateRow) diteruskan lewat emptyTitle /
// emptyDescription DataTable — teks sama persis.
// E28 Batch B (FAT-219, E2E-05): empty state pola bersama — loading =
// skeleton, kosong = sebab + aksi.
/** Tabel lini produksi (E31.11, dipindah dari ProductionLinesPage). */
export const ProductionLinesTable: React.FC<ProductionLinesTableProps> = ({
  lines,
  isLoading,
  checkCapability,
  onEdit,
  onDelete,
}) => {
  const columns = useMemo<ColumnDef<ProductionLine, unknown>[]>(
    () => [
      {
        id: 'lineId',
        header: 'Line ID',
        cell: ({ row }) => {
          const line = row.original;
          return (
            <div className="text-xs font-tabular">
              <div className="flex items-center gap-2 font-semibold text-slate-900 dark:text-slate-100">
                <Factory className="w-4 h-4 text-sky-500 shrink-0" />
                <span>{line.lineId}</span>
              </div>
            </div>
          );
        },
      },
      {
        id: 'lineName',
        header: 'Nama Lini',
        cell: ({ row }) => (
          <div className="text-xs font-medium text-slate-800 dark:text-slate-200">
            {row.original.lineName}
          </div>
        ),
      },
      {
        id: 'description',
        header: 'Deskripsi',
        cell: ({ row }) => (
          <div className="text-xs text-slate-500 dark:text-slate-400">
            {row.original.description ?? '—'}
          </div>
        ),
      },
      {
        id: 'status',
        header: 'Status',
        cell: ({ row }) => (
          <Badge variant={row.original.isActive ? 'success' : 'neutral'}>
            {row.original.isActive ? 'ACTIVE' : 'INACTIVE'}
          </Badge>
        ),
      },
      {
        id: 'actions',
        header: 'Aksi',
        cell: ({ row }) => {
          const line = row.original;
          const rowManageCap = checkCapability('production_line.manage', line.lineId);
          return (
            <div className="flex items-center justify-end gap-1.5">
              <Button
                size="sm"
                variant="outline"
                disabled={!rowManageCap.canInteract}
                title={!rowManageCap.canInteract ? rowManageCap.reason : 'Ubah lini produksi'}
                onClick={() => onEdit(line)}
              >
                <Edit3 className="w-3.5 h-3.5" />
                <span>Edit</span>
              </Button>
              <Button
                size="sm"
                variant="danger"
                disabled={!rowManageCap.canInteract}
                title={!rowManageCap.canInteract ? rowManageCap.reason : 'Hapus lini produksi'}
                onClick={() => onDelete(line)}
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
      data={lines}
      columns={columns}
      getRowId={(line) => line.lineId}
      isLoading={isLoading}
      emptyTitle="Belum ada lini produksi"
      emptyDescription="Daftar lini masih kosong. Tambah lini pertama lewat tombol 'Tambah Lini' di atas."
    />
  );
};
