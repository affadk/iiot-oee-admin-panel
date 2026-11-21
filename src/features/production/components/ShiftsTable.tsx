import React, { useMemo } from 'react';
import { Clock, Edit3, Trash2 } from 'lucide-react';
import { LegacyColumnDef as ColumnDef } from '@tanstack/react-table/legacy';
import { Shift } from '../../../types/production';
import { CapabilityKey } from '../../../utils/capabilities';
import { Badge } from '../../../components/ui/Badge';
import { Button } from '../../../components/ui/Button';
import { DataTable } from '../../../components/industrial/DataTable';

export interface ShiftsTableProps {
  shifts: Shift[];
  isLoading: boolean;
  /** Dipanggil per baris di dalam cell renderer — JANGAN precompute boolean, JANGAN useAuth di sini. */
  checkCapability: (capability: CapabilityKey, resourceId?: string) => {
    canInteract: boolean;
    reason?: string;
  };
  onEdit: (shift: Shift) => void;
  onDelete: (shift: Shift) => void;
}

// E31.10 (FAT-273): tabel hand-rolled → DataTable (aturan R1). Empty state
// pola bersama (dulu TableStateRow) diteruskan lewat emptyTitle /
// emptyDescription DataTable — teks sama persis.
// E28 Batch B (FAT-219, E2E-05): empty state pola bersama — loading =
// skeleton, kosong = sebab + aksi.
/** Tabel shift (E31.11, dipindah dari ShiftsPage). */
export const ShiftsTable: React.FC<ShiftsTableProps> = ({
  shifts,
  isLoading,
  checkCapability,
  onEdit,
  onDelete,
}) => {
  const columns = useMemo<ColumnDef<Shift, unknown>[]>(
    () => [
      {
        id: 'shiftId',
        header: 'Shift ID',
        cell: ({ row }) => {
          const shift = row.original;
          return (
            <div className="text-xs font-tabular">
              <div className="flex items-center gap-2 font-semibold text-slate-900 dark:text-slate-100">
                <Clock className="w-4 h-4 text-sky-500 shrink-0" />
                <span>{shift.shiftId}</span>
              </div>
            </div>
          );
        },
      },
      {
        id: 'shiftName',
        header: 'Nama Shift',
        cell: ({ row }) => (
          <div className="text-xs font-medium text-slate-800 dark:text-slate-200">
            {row.original.shiftName}
          </div>
        ),
      },
      {
        id: 'shiftCode',
        header: 'Kode',
        cell: ({ row }) => (
          <div className="text-xs font-mono text-slate-700 dark:text-slate-300">
            {row.original.shiftCode}
          </div>
        ),
      },
      {
        id: 'hours',
        header: 'Jam Kerja',
        cell: ({ row }) => {
          const shift = row.original;
          return (
            <div className="text-xs font-tabular font-semibold text-slate-900 dark:text-slate-100">
              {shift.startTime}–{shift.endTime}
            </div>
          );
        },
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
          const shift = row.original;
          const rowManageCap = checkCapability('shift.manage', shift.shiftId);
          return (
            <div className="flex items-center justify-end gap-1.5">
              <Button
                size="sm"
                variant="outline"
                disabled={!rowManageCap.canInteract}
                title={!rowManageCap.canInteract ? rowManageCap.reason : 'Ubah shift'}
                onClick={() => onEdit(shift)}
              >
                <Edit3 className="w-3.5 h-3.5" />
                <span>Edit</span>
              </Button>
              <Button
                size="sm"
                variant="danger"
                disabled={!rowManageCap.canInteract}
                title={!rowManageCap.canInteract ? rowManageCap.reason : 'Hapus shift'}
                onClick={() => onDelete(shift)}
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
      data={shifts}
      columns={columns}
      getRowId={(shift) => shift.shiftId}
      isLoading={isLoading}
      emptyTitle="Belum ada shift"
      emptyDescription="Daftar shift masih kosong. Tambah shift pertama lewat tombol 'Tambah Shift' di atas."
    />
  );
};
