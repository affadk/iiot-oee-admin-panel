import { useMemo } from 'react';
import { CheckCircle2, GitCompare, RotateCcw, Trash2 } from 'lucide-react';
import { LegacyColumnDef as ColumnDef } from '@tanstack/react-table/legacy';
import type { BrokerConfigVersion } from '../../../types/mqtt';
import { Badge } from '../../../components/ui/Badge';
import { Button } from '../../../components/ui/Button';
import { DataTable } from '../../../components/industrial/DataTable';
import { formatDateTime } from '../../../utils/formatDate';

interface BrokerVersionsTabProps {
  versions: BrokerConfigVersion[];
  canManage: { canInteract: boolean };
  onViewDiff: (versionId: string) => void;
  onDiscard: (versionId: string) => void;
  onRequestApply: (version: BrokerConfigVersion) => void;
  onRequestRollback: (version: BrokerConfigVersion) => void;
}

// E31.10 (FAT-273): tabel hand-rolled → DataTable (aturan R1). Render
// kustom per kolom (badge validasi/dampak) + aksi workflow kondisional
// dipindahkan ke ColumnDef.cell. Catatan: tabel lama tidak punya empty
// state (daftar kosong = header saja); DataTable menampilkan empty state
// standar — teks netral di bawah.
export const BrokerVersionsTab: React.FC<BrokerVersionsTabProps> = ({
  versions,
  canManage,
  onViewDiff,
  onDiscard,
  onRequestApply,
  onRequestRollback,
}) => {
  const columns = useMemo<ColumnDef<BrokerConfigVersion, unknown>[]>(
    () => [
      {
        id: 'version',
        header: 'Version ID & Summary',
        cell: ({ row }) => {
          const ver = row.original;
          return (
            <div className="text-xs">
              <div className="font-mono font-bold text-slate-900 dark:text-slate-100">{ver.version_id}</div>
              <div className="text-slate-500 mt-0.5">{ver.summary}</div>
            </div>
          );
        },
      },
      {
        id: 'appliedBy',
        header: 'Applied By / Timestamp',
        cell: ({ row }) => {
          const ver = row.original;
          return (
            <div className="text-xs font-tabular text-slate-500">
              <div>{ver.applied_by}</div>
              <div>{formatDateTime(ver.applied_at)}</div>
            </div>
          );
        },
      },
      {
        id: 'status',
        header: 'Status',
        cell: ({ row }) => {
          const ver = row.original;
          return (
            <Badge
              variant={
                ver.status === 'ACTIVE'
                  ? 'success'
                  : ver.status === 'STAGED'
                  ? 'warning'
                  : 'neutral'
              }
            >
              {ver.status}
            </Badge>
          );
        },
      },
      {
        id: 'validation',
        header: 'Validasi / Dampak',
        // E23 Batch 1 (FAT-181, N-12): validasi + dampak dari respons
        // stage/GET versi — sebelumnya dibuang panel.
        cell: ({ row }) => {
          const ver = row.original;
          return ver.validation ? (
            <div className="text-xs space-y-1">
              <Badge
                variant={
                  ver.validation.status === 'passed'
                    ? 'success'
                    : ver.validation.status === 'failed'
                      ? 'danger'
                      : 'neutral'
                }
              >
                {ver.validation.status}
                {ver.validation.issues.length > 0 ? ` (${ver.validation.issues.length})` : ''}
              </Badge>
              {ver.impact && (
                <div className="text-slate-500">Dampak: {ver.impact.action}</div>
              )}
            </div>
          ) : (
            <span className="text-xs text-slate-400">—</span>
          );
        },
      },
      {
        id: 'actions',
        header: 'Workflow Aksi',
        cell: ({ row }) => {
          const ver = row.original;
          return (
            <div className="flex items-center justify-end gap-1.5">
              <Button size="sm" variant="outline" onClick={() => onViewDiff(ver.version_id)}>
                <GitCompare className="w-3.5 h-3.5" />
                <span>Diff</span>
              </Button>
              {ver.status === 'STAGED' && (
                <>
                  <Button
                    size="sm"
                    disabled={!canManage.canInteract}
                    onClick={() => onRequestApply(ver)}
                  >
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    <span>Apply</span>
                  </Button>
                  <Button
                    size="sm"
                    variant="danger"
                    disabled={!canManage.canInteract}
                    onClick={() => onDiscard(ver.version_id)}
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>Discard</span>
                  </Button>
                </>
              )}
              {ver.status !== 'ACTIVE' && ver.status !== 'STAGED' && (
                <Button
                  size="sm"
                  variant="secondary"
                  disabled={!canManage.canInteract}
                  onClick={() => onRequestRollback(ver)}
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  <span>Rollback</span>
                </Button>
              )}
            </div>
          );
        },
      },
    ],
    [canManage, onViewDiff, onDiscard, onRequestApply, onRequestRollback],
  );

  return (
    <DataTable
      data={versions}
      columns={columns}
      getRowId={(ver) => ver.version_id}
      emptyTitle="Belum ada versi konfigurasi"
      emptyDescription="Tidak ada versi konfigurasi broker yang tersimpan."
    />
  );
};
