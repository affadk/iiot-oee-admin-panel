import React from 'react';
import { CalendarClock, Edit3, Trash2 } from 'lucide-react';
import { ShiftSchedule } from '../../../types/production';
import { CapabilityKey } from '../../../utils/capabilities';
import { Badge } from '../../../components/ui/Badge';
import { Button } from '../../../components/ui/Button';
import { TableStateRow } from '../../shared/TableStateRow';

export interface ShiftSchedulesTableProps {
  schedules: ShiftSchedule[];
  isLoading: boolean;
  /** Nama hari 1=Senin..7=Minggu — didefinisikan sekali di Page, diteruskan ke sini. */
  dayNames: string[];
  /** Dipanggil per baris di dalam .map — JANGAN precompute boolean, JANGAN useAuth di sini. */
  checkCapability: (capability: CapabilityKey, resourceId?: string) => {
    canInteract: boolean;
    reason?: string;
  };
  onEdit: (schedule: ShiftSchedule) => void;
  onDelete: (schedule: ShiftSchedule) => void;
}

/** Tabel jadwal shift (E31.11, dipindah dari ShiftSchedulesPage). */
export const ShiftSchedulesTable: React.FC<ShiftSchedulesTableProps> = ({
  schedules,
  isLoading,
  dayNames,
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
              <th className="py-3 px-4">Jadwal ID</th>
              <th className="py-3 px-4">Lini</th>
              <th className="py-3 px-4">Shift</th>
              <th className="py-3 px-4">Hari</th>
              <th className="py-3 px-4">Status</th>
              <th className="py-3 px-4 text-right">Aksi</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-slate-800/80 text-xs">
            {/* E28 Batch B (FAT-219, E2E-05): empty state pola bersama
                (TableStateRow) — loading = skeleton, kosong = sebab + aksi. */}
            {isLoading ? (
              <TableStateRow isLoading isError={false} colSpan={6} />
            ) : schedules.length === 0 ? (
              <TableStateRow
                isLoading={false}
                isError={false}
                colSpan={6}
                emptyTitle="Belum ada jadwal shift"
                emptyDescription="Belum ada jadwal shift untuk kombinasi lini/shift. Tambah jadwal pertama lewat tombol 'Tambah Jadwal' di atas (butuh minimal satu lini dan satu shift)."
              />
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
                      {dayNames[sch.dayOfWeek - 1] ?? `Hari ${sch.dayOfWeek}`}
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
