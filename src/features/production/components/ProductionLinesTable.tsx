import React from 'react';
import { Factory, Edit3, Trash2 } from 'lucide-react';
import { ProductionLine } from '../../../types/production';
import { CapabilityKey } from '../../../utils/capabilities';
import { Badge } from '../../../components/ui/Badge';
import { Button } from '../../../components/ui/Button';
import { TableStateRow } from '../../shared/TableStateRow';

export interface ProductionLinesTableProps {
  lines: ProductionLine[];
  isLoading: boolean;
  /** Dipanggil per baris di dalam .map — JANGAN precompute boolean, JANGAN useAuth di sini. */
  checkCapability: (capability: CapabilityKey, resourceId?: string) => {
    canInteract: boolean;
    reason?: string;
  };
  onEdit: (line: ProductionLine) => void;
  onDelete: (line: ProductionLine) => void;
}

/** Tabel lini produksi (E31.11, dipindah dari ProductionLinesPage). */
export const ProductionLinesTable: React.FC<ProductionLinesTableProps> = ({
  lines,
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
              <th className="py-3 px-4">Line ID</th>
              <th className="py-3 px-4">Nama Lini</th>
              <th className="py-3 px-4">Deskripsi</th>
              <th className="py-3 px-4">Status</th>
              <th className="py-3 px-4 text-right">Aksi</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-slate-800/80 text-xs">
            {/* E28 Batch B (FAT-219, E2E-05): empty state pola bersama
                (TableStateRow) — loading = skeleton, kosong = sebab + aksi. */}
            {isLoading ? (
              <TableStateRow isLoading isError={false} colSpan={5} />
            ) : lines.length === 0 ? (
              <TableStateRow
                isLoading={false}
                isError={false}
                colSpan={5}
                emptyTitle="Belum ada lini produksi"
                emptyDescription="Daftar lini masih kosong. Tambah lini pertama lewat tombol 'Tambah Lini' di atas."
              />
            ) : (
              lines.map((line) => {
                const rowManageCap = checkCapability('production_line.manage', line.lineId);
                return (
                  <tr key={line.lineId} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30">
                    <td className="py-3 px-4 font-tabular">
                      <div className="flex items-center gap-2 font-semibold text-slate-900 dark:text-slate-100">
                        <Factory className="w-4 h-4 text-sky-500 shrink-0" />
                        <span>{line.lineId}</span>
                      </div>
                    </td>
                    <td className="py-3 px-4 font-medium text-slate-800 dark:text-slate-200">{line.lineName}</td>
                    <td className="py-3 px-4 text-slate-500 dark:text-slate-400">{line.description ?? '—'}</td>
                    <td className="py-3 px-4">
                      <Badge variant={line.isActive ? 'success' : 'neutral'}>
                        {line.isActive ? 'ACTIVE' : 'INACTIVE'}
                      </Badge>
                    </td>
                    <td className="py-3 px-4 text-right">
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
