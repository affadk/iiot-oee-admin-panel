import { useMemo } from 'react';
import { LegacyColumnDef as ColumnDef } from '@tanstack/react-table/legacy';
import { Bell, CheckCircle2, MessageSquarePlus } from 'lucide-react';
import { OperationalEvent } from '../../../types/monitoring';
import { useAuth } from '../../../context/AuthContext';
import { Badge } from '../../../components/ui/Badge';
import { Button } from '../../../components/ui/Button';
import { formatDeletedRelationLabel } from '../../../utils/oeeCalculations';

export function useOperationalEventColumns(onAck: (ev: OperationalEvent) => void) {
  const { checkCapability } = useAuth();

  return useMemo<ColumnDef<OperationalEvent, unknown>[]>(
    () => [
      {
        id: 'timestamp',
        header: 'Timestamp',
        cell: ({ row }) => (
          <span className="font-tabular text-xs text-slate-500 whitespace-nowrap">
            {new Date(row.original.timestamp).toLocaleString()}
          </span>
        ),
      },
      {
        id: 'severity',
        header: 'Severity & Type',
        cell: ({ row }) => {
          const ev = row.original;
          return (
            <div className="space-y-1">
              <Badge
                variant={
                  ev.severity === 'CRITICAL'
                    ? 'danger'
                    : ev.severity === 'WARN'
                    ? 'warning'
                    : 'info'
                }
              >
                {ev.severity}
              </Badge>
              <div className="text-[11px] font-tabular text-slate-500">{ev.event_type}</div>
            </div>
          );
        },
      },
      {
        id: 'machine',
        header: 'Mesin / Device',
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
        id: 'message',
        header: 'Pesan',
        cell: ({ row }) => (
          <span className="text-xs text-slate-700 dark:text-slate-300 block max-w-md">
            {row.original.message}
          </span>
        ),
      },
      {
        id: 'ack',
        header: 'Acknowledgment',
        cell: ({ row }) => {
          const ev = row.original;
          return ev.acknowledged ? (
            <div className="space-y-0.5 text-[11px]">
              <div className="inline-flex items-center gap-1 font-semibold text-emerald-600 dark:text-emerald-400">
                <CheckCircle2 className="w-3.5 h-3.5" />
                <span>{ev.acknowledged_by}</span>
              </div>
              {ev.acknowledged_at && (
                <div className="text-slate-400 font-tabular">
                  {new Date(ev.acknowledged_at).toLocaleString()}
                </div>
              )}
              {ev.ack_note && (
                <div className="italic text-slate-600 dark:text-slate-300">“{ev.ack_note}”</div>
              )}
            </div>
          ) : (
            <Badge variant="warning">Pending Ack</Badge>
          );
        },
      },
      {
        id: 'actions',
        header: () => <div className="text-right">Aksi</div>,
        cell: ({ row }) => {
          const ev = row.original;
          const rowAckCap = checkCapability('operational_event.ack', ev.id);
          return (
            <div className="flex justify-end">
              <Button
                size="sm"
                variant={ev.acknowledged ? 'outline' : 'primary'}
                disabled={!rowAckCap.canInteract}
                title={
                  !rowAckCap.canInteract
                    ? rowAckCap.reason
                    : 'Acknowledge / perbarui catatan event'
                }
                onClick={() => onAck(ev)}
              >
                {ev.acknowledged ? (
                  <>
                    <MessageSquarePlus className="w-3.5 h-3.5" />
                    <span>Note</span>
                  </>
                ) : (
                  <>
                    <Bell className="w-3.5 h-3.5" />
                    <span>Ack</span>
                  </>
                )}
              </Button>
            </div>
          );
        },
      },
    ],
    [checkCapability, onAck]
  );
}
