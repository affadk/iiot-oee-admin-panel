import React, { useMemo } from 'react';
import { CalendarClock, Edit3, Trash2 } from 'lucide-react';
import { LegacyColumnDef as ColumnDef } from '@tanstack/react-table/legacy';
import { ShiftSchedule } from '../../../types/production';
import { CapabilityKey } from '../../../utils/capabilities';
import { Badge } from '../../../components/ui/Badge';
import { Button } from '../../../components/ui/Button';
import { DataTable } from '../../../components/industrial/DataTable';

export interface ShiftSchedulesTableProps {
  schedules: ShiftSchedule[];
  isLoading: boolean;
  /** Nama hari 1=Senin..7=Minggu — didefinisikan sekali di Page, diteruskan ke sini. */
  dayNames: string[];
  /** Dipanggil per baris di dalam cell renderer — JANGAN precompute boolean, JANGAN useAuth di sini. */
  checkCapability: (capability: CapabilityKey, resourceId?: string) => {
    canInteract: boolean;
    reason?: string;
  };
  onEdit: (schedule: ShiftSchedule) => void;
  onDelete: (schedule: ShiftSchedule) => void;
}

// E31.10 (FAT-273): tabel hand-rolled → DataTable (aturan R1). Empty state
// pola bersama (dulu TableStateRow) diteruskan lewat emptyTitle /
// emptyDescription DataTable — teks sama persis.
// E28 Batch B (FAT-219, E2E-05): empty state pola bersama — loading =
// skeleton, kosong = sebab + aksi.
/** Tabel jadwal shift (E31.11, dipindah dari ShiftSchedulesPage). */
export const ShiftSchedulesTable: React.FC<ShiftSchedulesTableProps> = ({
  schedules,
  isLoading,
  dayNames,
  checkCapability,
  onEdit,
  onDelete,
}) => {
  const columns = useMemo<ColumnDef<ShiftSchedule, unknown>[]>(
    () => [
      {
        id: 'scheduleId',
        header: 'Jadwal ID',
        cell: ({ row }) => {
          const sch = row.original;
          return (
            <div className="text-xs font-tabular">
              <div className="flex items-center gap-2 font-semibold text-slate-900 dark:text-slate-100">
                <CalendarClock className="w-4 h-4 text-sky-500 shrink-0" />
                <span>{sch.scheduleId}</span>
              </div>
            </div>
          );
        },
      },
      {
        id: 'lineId',
        header: 'Lini',
        cell: ({ row }) => (
          <div className="text-xs font-mono text-slate-700 dark:text-slate-300">
            {row.original.lineId}
          </div>
        ),
      },
      {
        id: 'shift',
        header: 'Shift',
        cell: ({ row }) => {
          const sch = row.original;
          return (
            <div className="text-xs font-medium text-slate-800 dark:text-slate-200">
              {sch.shiftName ?? sch.shiftId}
              <div className="text-[11px] text-slate-500">
                {sch.shiftCode ?? ''} {sch.startTime && sch.endTime ? `· ${sch.startTime}–${sch.endTime}` : ''}
              </div>
            </div>
          );
        },
      },
      {
        id: 'day',
        header: 'Hari',
        cell: ({ row }) => {
          const sch = row.original;
          return (
            <div className="text-xs font-medium text-slate-800 dark:text-slate-200">
              {dayNames[sch.dayOfWeek - 1] ?? `Hari ${sch.dayOfWeek}`}
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
          const sch = row.original;
          const rowManageCap = checkCapability('shift_schedule.manage', sch.scheduleId);
          return (
            <div className="flex items-center justify-end gap-1.5">
              <Button
                size="sm"
                variant="outline"
                disabled={!rowManageCap.canInteract}
                title={!rowManageCap.canInteract ? rowManageCap.reason : 'Ubah jadwal shift'}
                onClick={() => onEdit(sch)}
              >
                <Edit3 className="w-3.5 h-3.5" />
                <span>Edit</span>
              </Button>
              <Button
                size="sm"
                variant="danger"
                disabled={!rowManageCap.canInteract}
                title={!rowManageCap.canInteract ? rowManageCap.reason : 'Hapus jadwal shift'}
                onClick={() => onDelete(sch)}
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Hapus</span>
              </Button>
            </div>
          );
        },
      },
    ],
    [dayNames, checkCapability, onEdit, onDelete],
  );

  return (
    <DataTable
      data={schedules}
      columns={columns}
      getRowId={(sch) => sch.scheduleId}
      isLoading={isLoading}
      emptyTitle="Belum ada jadwal shift"
      emptyDescription="Belum ada jadwal shift untuk kombinasi lini/shift. Tambah jadwal pertama lewat tombol 'Tambah Jadwal' di atas (butuh minimal satu lini dan satu shift)."
    />
  );
};
