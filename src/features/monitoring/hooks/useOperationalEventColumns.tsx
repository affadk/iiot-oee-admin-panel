import { useMemo } from 'react';
import { LegacyColumnDef as ColumnDef } from '@tanstack/react-table/legacy';
import { Bell, CheckCircle2, MessageSquarePlus } from 'lucide-react';
import { OperationalEvent } from '../../../types/monitoring';
import { useAuth } from '../../../context/AuthContext';
import { Badge } from '../../../components/ui/Badge';
import { Button } from '../../../components/ui/Button';
import { OperationalEventMachineCell } from '../components/OperationalEventMachineCell';
import { formatDateTime } from '../../../utils/formatDate';

export function useOperationalEventColumns(onAck: (ev: OperationalEvent) => void) {
  const { checkCapability } = useAuth();

  return useMemo<ColumnDef<OperationalEvent, unknown>[]>(
    () => [
      {
        id: 'timestamp',
        header: 'Timestamp',
        cell: ({ row }) => (
          <span className="font-tabular text-xs text-slate-500 whitespace-nowrap">
            {row.original.recorded_at ? formatDateTime(row.original.recorded_at) : '—'}
          </span>
        ),
      },
      {
        id: 'event_type',
        header: 'Tipe Event',
        cell: ({ row }) => {
          const ev = row.original;
          return (
            <div className="space-y-1">
              <Badge variant="info">{ev.event_type}</Badge>
              {ev.trigger_source && (
                <div className="text-[11px] font-tabular text-slate-500">{ev.trigger_source}</div>
              )}
            </div>
          );
        },
      },
      {
        id: 'machine',
        header: 'Mesin / Device',
        cell: ({ row }) => <OperationalEventMachineCell ev={row.original} />,
      },
      {
        id: 'message',
        header: 'Pesan',
        cell: ({ row }) => (
          <span className="text-xs text-slate-700 dark:text-slate-300 block max-w-md">
            {row.original.description}
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
                  {formatDateTime(ev.acknowledged_at)}
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
