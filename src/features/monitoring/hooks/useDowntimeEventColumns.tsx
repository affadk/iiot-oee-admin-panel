/**
 * Kolom tabel downtime (E31.5, FAT-268) — dipindah dari
 * `DowntimeEventsPage` (R8: page hanya orkestrasi). Pola mengikuti
 * `useOperationalEventColumns` (hook kolom + `checkCapability` per
 * baris, `useMemo` ColumnDef); hook itu tidak dipakai ulang karena
 * tipenya berbeda (`OperationalEvent` + alur ack vs `DowntimeEvent` +
 * alur label) — bukan duplikasi, melainkan pasangan per domain.
 * Render tiap sel tidak berubah.
 */
import { useMemo } from 'react';
import { LegacyColumnDef as ColumnDef } from '@tanstack/react-table/legacy';
import { CheckCircle2, Tag } from 'lucide-react';
import { DowntimeEvent } from '../../../types/monitoring';
import { useAuth } from '../../../context/AuthContext';
import { Badge } from '../../../components/ui/Badge';
import { Button } from '../../../components/ui/Button';
import { mapDowntimeToSixBigLoss } from '../../../utils/historicalExport';
import { formatDuration, formatDeletedRelationLabel } from '../../../utils/oeeCalculations';
import { formatDateTime } from '../../../utils/formatDate';

export function useDowntimeEventColumns(onLabel: (ev: DowntimeEvent) => void) {
  const { checkCapability } = useAuth();

  return useMemo<ColumnDef<DowntimeEvent, unknown>[]>(
    () => [
      {
        id: 'machine',
        header: 'Mesin & Perangkat',
        cell: ({ row }) => {
          const ev = row.original;
          const machLbl = formatDeletedRelationLabel(ev.machine_name, ev.machine_id);
          const devLbl = formatDeletedRelationLabel(ev.device_id, null);
          return (
            <div className="text-xs">
              <div
                className={
                  machLbl.isDeleted
                    ? 'italic text-slate-400'
                    : 'font-semibold text-slate-900 dark:text-slate-100'
                }
              >
                {machLbl.label}
              </div>
              <div className="text-[11px] font-tabular text-slate-400">
                {devLbl.isDeleted ? '[dihapus]' : ev.device_id}
              </div>
            </div>
          );
        },
      },
      {
        id: 'category',
        header: 'Six Big Losses & Kategori',
        cell: ({ row }) => {
          const ev = row.original;
          const sbl = mapDowntimeToSixBigLoss(ev.category);
          return (
            <div className="text-xs">
              {/* E23 Batch 3 (FAT-194, N-25): 'UNKNOWN' = server tidak
                  mengirim kategori — tampilkan label jujur. */}
              <div className="font-medium text-slate-800 dark:text-slate-200">
                {ev.category === 'UNKNOWN' ? 'Belum dikategorikan' : ev.category}
              </div>
              <div className="text-[11px] text-sky-600 dark:text-sky-400">{sbl.label}</div>
            </div>
          );
        },
      },
      {
        id: 'reason',
        header: 'Alasan / Catatan',
        cell: ({ row }) => {
          const ev = row.original;
          return (
            <div className="text-xs max-w-xs">
              <div className="text-slate-800 dark:text-slate-200">{ev.reason}</div>
              {ev.notes && (
                <div className="text-[11px] text-slate-500 mt-0.5 italic">Note: {ev.notes}</div>
              )}
            </div>
          );
        },
      },
      {
        id: 'duration',
        header: 'Durasi & Waktu',
        cell: ({ row }) => {
          const ev = row.original;
          return (
            <div className="text-xs font-tabular">
              <div className="font-semibold text-slate-900 dark:text-slate-100">
                {ev.durationFormatted || formatDuration(ev.duration_seconds)}
              </div>
              <div className="text-[11px] text-slate-400">
                {formatDateTime(ev.started_at)}
                {ev.ended_at === null && ' (Ongoing)'}
              </div>
            </div>
          );
        },
      },
      {
        id: 'status',
        header: 'Status Label',
        cell: ({ row }) => {
          const ev = row.original;
          return ev.is_labeled ? (
            <div className="space-y-1">
              <Badge variant="success">
                <CheckCircle2 className="w-3 h-3 mr-1" />
                Labeled
              </Badge>
              {ev.is_overwrite && (
                <div className="text-[10px] text-amber-600 dark:text-amber-400 font-semibold">
                  Overwritten
                </div>
              )}
            </div>
          ) : (
            <Badge variant="danger">Unlabeled</Badge>
          );
        },
      },
      {
        id: 'actions',
        header: () => <div className="text-right">Klasifikasi</div>,
        cell: ({ row }) => {
          const ev = row.original;
          const rowLabelCap = checkCapability('downtime_event.label', ev.id);
          return (
            <div className="flex justify-end">
              <Button
                size="sm"
                variant={ev.is_labeled ? 'outline' : 'primary'}
                disabled={!rowLabelCap.canInteract}
                title={!rowLabelCap.canInteract ? rowLabelCap.reason : 'Labeli / overwrite alasan downtime'}
                onClick={() => onLabel(ev)}
              >
                <Tag className="w-3.5 h-3.5" />
                <span>{ev.is_labeled ? 'Overwrite' : 'Label'}</span>
              </Button>
            </div>
          );
        },
      },
    ],
    [checkCapability, onLabel]
  );
}
