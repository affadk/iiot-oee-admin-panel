import React from 'react';
import { Clock, Edit3, Trash2 } from 'lucide-react';
import { Shift } from '../../../types/production';
import { CapabilityKey } from '../../../utils/capabilities';
import { Badge } from '../../../components/ui/Badge';
import { Button } from '../../../components/ui/Button';
import { TableStateRow } from '../../shared/TableStateRow';

export interface ShiftsTableProps {
  shifts: Shift[];
  isLoading: boolean;
  /** Dipanggil per baris di dalam .map — JANGAN precompute boolean, JANGAN useAuth di sini. */
  checkCapability: (capability: CapabilityKey, resourceId?: string) => {
    canInteract: boolean;
    reason?: string;
  };
  onEdit: (shift: Shift) => void;
  onDelete: (shift: Shift) => void;
}

/** Tabel shift (E31.11, dipindah dari ShiftsPage). */
export const ShiftsTable: React.FC<ShiftsTableProps> = ({
  shifts,
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
              <th className="py-3 px-4">Shift ID</th>
              <th className="py-3 px-4">Nama Shift</th>
              <th className="py-3 px-4">Kode</th>
              <th className="py-3 px-4">Jam Kerja</th>
              <th className="py-3 px-4">Status</th>
              <th className="py-3 px-4 text-right">Aksi</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-slate-800/80 text-xs">
            {/* E28 Batch B (FAT-219, E2E-05): empty state pola bersama
                (TableStateRow) — loading = skeleton, kosong = sebab + aksi. */}
            {isLoading ? (
              <TableStateRow isLoading isError={false} colSpan={6} />
            ) : shifts.length === 0 ? (
              <TableStateRow
                isLoading={false}
                isError={false}
                colSpan={6}
                emptyTitle="Belum ada shift"
                emptyDescription="Daftar shift masih kosong. Tambah shift pertama lewat tombol 'Tambah Shift' di atas."
              />
            ) : (
              shifts.map((shift) => {
                const rowManageCap = checkCapability('shift.manage', shift.shiftId);
                return (
                  <tr key={shift.shiftId} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30">
                    <td className="py-3 px-4 font-tabular">
                      <div className="flex items-center gap-2 font-semibold text-slate-900 dark:text-slate-100">
                        <Clock className="w-4 h-4 text-sky-500 shrink-0" />
                        <span>{shift.shiftId}</span>
                      </div>
                    </td>
                    <td className="py-3 px-4 font-medium text-slate-800 dark:text-slate-200">{shift.shiftName}</td>
                    <td className="py-3 px-4 font-mono text-slate-700 dark:text-slate-300">{shift.shiftCode}</td>
                    <td className="py-3 px-4 font-tabular font-semibold text-slate-900 dark:text-slate-100">
                      {shift.startTime}–{shift.endTime}
                    </td>
                    <td className="py-3 px-4">
                      <Badge variant={shift.isActive ? 'success' : 'neutral'}>
                        {shift.isActive ? 'ACTIVE' : 'INACTIVE'}
                      </Badge>
                    </td>
                    <td className="py-3 px-4 text-right">
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
