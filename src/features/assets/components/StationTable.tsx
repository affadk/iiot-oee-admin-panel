import React, { useMemo } from 'react';
import { Monitor, Wifi, WifiOff, Edit3, Trash2, Ban } from 'lucide-react';
import { LegacyColumnDef as ColumnDef } from '@tanstack/react-table/legacy';
import { Station } from '../../../types/assets';
import { CapabilityKey, CapabilityState } from '../../../utils/capabilities';
import { formatDateTime } from '../../../utils/formatDate';
import { Badge } from '../../../components/ui/Badge';
import { Button } from '../../../components/ui/Button';
import { DataTable } from '../../../components/industrial/DataTable';
import { classifyStationId, STATION_KIND_LABELS } from '../stationValidation';

export interface StationTableProps {
  stations: Station[];
  isLoading: boolean;
  checkCapability: (
    capability: CapabilityKey,
    resourceId?: string,
  ) => { state: CapabilityState; canInteract: boolean; reason?: string };
  onEdit: (station: Station) => void;
  onRevoke: (station: Station) => void;
  onDelete: (station: Station) => void;
}

function enrollmentLabel(state: Station['enrollmentState']): string {
  if (state === 'PROVISIONED') return 'Terdaftar';
  if (state === 'REVOKED') return 'Dicabut';
  return 'Aktif';
}

// E31.10 (FAT-273): tabel hand-rolled → DataTable (aturan R1). Semua
// render kustom per kolom + aksi per baris dipindahkan ke ColumnDef.cell —
// tampilan akhir sama (sel dibungkus text-xs seperti sebelumnya;
// DataTable sendiri text-sm).
export const StationTable: React.FC<StationTableProps> = ({
  stations,
  isLoading,
  checkCapability,
  onEdit,
  onRevoke,
  onDelete,
}) => {
  const columns = useMemo<ColumnDef<Station, unknown>[]>(
    () => [
      {
        id: 'station',
        header: 'Station / Device ID',
        cell: ({ row }) => {
          const st = row.original;
          return (
            <div className="text-xs">
              <div className="flex items-center gap-2 font-semibold text-slate-900 dark:text-slate-100 font-tabular">
                <Monitor className="w-4 h-4 text-sky-500 shrink-0" />
                <span>{st.device_id}</span>
              </div>
              <div className="text-[11px] text-slate-500 pl-6">
                {st.model ? `${st.model} · ` : ''}FW: {st.firmware_version ?? '—'}
              </div>
            </div>
          );
        },
      },
      {
        id: 'kind',
        header: 'Jenis',
        cell: ({ row }) => {
          const kind = classifyStationId(row.original.device_id);
          return (
            <Badge variant={kind === 'terminal' ? 'info' : 'neutral'}>
              {STATION_KIND_LABELS[kind]}
            </Badge>
          );
        },
      },
      {
        id: 'ip',
        header: 'IP Address',
        cell: ({ row }) => (
          <div className="text-xs font-tabular text-slate-700 dark:text-slate-300">
            {row.original.ip_address ?? '—'}
          </div>
        ),
      },
      {
        id: 'status',
        header: 'Status',
        cell: ({ row }) => {
          const st = row.original;
          const isRevoked = st.enrollmentState === 'REVOKED';
          return (
            <div className="text-xs">
              <div className="flex flex-wrap items-center gap-1.5">
                <Badge
                  variant={
                    isRevoked ? 'danger' : st.enrollmentState === 'PROVISIONED' ? 'warning' : 'success'
                  }
                >
                  {enrollmentLabel(st.enrollmentState)}
                </Badge>
                <Badge variant={st.online ? 'success' : 'neutral'}>
                  {st.online ? (
                    <span className="inline-flex items-center gap-1">
                      <Wifi className="w-3 h-3" /> ONLINE
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1">
                      <WifiOff className="w-3 h-3" /> OFFLINE
                    </span>
                  )}
                </Badge>
              </div>
              <div className="text-[11px] font-tabular text-slate-400 mt-1">
                {st.last_seen ? `Terakhir terlihat ${formatDateTime(st.last_seen)}` : 'Belum ada data'}
              </div>
            </div>
          );
        },
      },
      {
        id: 'createdAt',
        header: 'Terdaftar',
        cell: ({ row }) => (
          <div className="text-xs font-tabular text-slate-700 dark:text-slate-300">
            {formatDateTime(row.original.created_at)}
          </div>
        ),
      },
      {
        id: 'actions',
        header: 'Aksi',
        cell: ({ row }) => {
          const st = row.original;
          const rowManageCap = checkCapability('device.manage', st.device_id);
          const isRevoked = st.enrollmentState === 'REVOKED';
          return (
            <div className="flex items-center justify-end gap-1.5">
              <Button
                size="sm"
                variant="outline"
                disabled={!rowManageCap.canInteract}
                aria-label={`Edit stasiun ${st.device_id}`}
                title={!rowManageCap.canInteract ? rowManageCap.reason : 'Ubah IP / Firmware'}
                onClick={() => onEdit(st)}
              >
                <Edit3 className="w-3.5 h-3.5" />
              </Button>
              <Button
                size="sm"
                variant="outline"
                disabled={!rowManageCap.canInteract || isRevoked}
                aria-label={`Nonaktifkan stasiun ${st.device_id}`}
                title={
                  !rowManageCap.canInteract
                    ? rowManageCap.reason
                    : isRevoked
                      ? 'Stasiun sudah dicabut'
                      : 'Nonaktifkan stasiun (revoke)'
                }
                onClick={() => onRevoke(st)}
              >
                <Ban className="w-3.5 h-3.5" />
                <span>Nonaktifkan</span>
              </Button>
              <Button
                size="sm"
                variant="danger"
                disabled={!rowManageCap.canInteract}
                aria-label={`Hapus stasiun ${st.device_id}`}
                title={!rowManageCap.canInteract ? rowManageCap.reason : 'Hapus stasiun'}
                onClick={() => onDelete(st)}
              >
                <Trash2 className="w-3.5 h-3.5" />
              </Button>
            </div>
          );
        },
      },
    ],
    [checkCapability, onEdit, onRevoke, onDelete],
  );

  return (
    <DataTable
      data={stations}
      columns={columns}
      getRowId={(st) => st.device_id}
      isLoading={isLoading}
      emptyTitle="Belum ada stasiun terdaftar — terminal HMI belum bisa mengirim data."
    />
  );
};
