import { useMemo } from 'react';
import { Cpu, Wifi, WifiOff, Eye, Activity, Edit3, Trash2 } from 'lucide-react';
import { LegacyColumnDef as ColumnDef } from '@tanstack/react-table/legacy';
import { EdgeDevice } from '../../../types/assets';
import { CapabilityKey, CapabilityState } from '../../../utils/capabilities';
import { formatDate, formatDateTime } from '../../../utils/formatDate';
import { Badge } from '../../../components/ui/Badge';
import { Button } from '../../../components/ui/Button';

export interface UseDeviceColumnsParams {
  checkCapability: (
    capability: CapabilityKey,
    resourceId?: string,
  ) => { state: CapabilityState; canInteract: boolean; reason?: string };
  onDetail: (deviceId: string) => void;
  onHealth: (device: EdgeDevice) => void;
  onEdit: (device: EdgeDevice) => void;
  onDelete: (device: EdgeDevice) => void;
}

// E32.7 (FAT-288): definisi kolom dipindah dari components/DeviceTable.tsx
// — render per kolom vs shell DataTable; mengikuti preseden
// production/components/WorkOrderColumns.tsx. Tampilan akhir sama
// (sel dibungkus text-xs; DataTable sendiri text-sm).
export function useDeviceColumns({
  checkCapability,
  onDetail,
  onHealth,
  onEdit,
  onDelete,
}: UseDeviceColumnsParams) {
  return useMemo<ColumnDef<EdgeDevice, unknown>[]>(
    () => [
      {
        id: 'device',
        header: 'Device ID & Hardware',
        cell: ({ row }) => {
          const dev = row.original;
          return (
            <div className="text-xs">
              <div className="flex items-center gap-2 font-semibold text-slate-900 dark:text-slate-100 font-tabular">
                <Cpu className="w-4 h-4 text-sky-500 shrink-0" />
                <span>{dev.device_id}</span>
              </div>
              <div className="text-[11px] text-slate-500 pl-6">
                {dev.model || 'STM32H743'}
                {/* E28 Batch B (FAT-224, E2E-10): device live tak
                    punya serial — "SN:" kosong disembunyikan. */}
                {dev.serial_number ? ` · SN: ${dev.serial_number}` : ''}
              </div>
            </div>
          );
        },
      },
      {
        id: 'network',
        header: 'MAC / IP Address',
        cell: ({ row }) => {
          const dev = row.original;
          return (
            <div className="text-xs font-tabular text-slate-700 dark:text-slate-300">
              <div>{dev.mac_address}</div>
              <div className="text-[11px] text-slate-500">{dev.ip_address ?? '—'}</div>
            </div>
          );
        },
      },
      {
        id: 'firmware',
        header: 'Firmware',
        cell: ({ row }) => (
          <div className="text-xs font-tabular text-slate-700 dark:text-slate-300">
            {row.original.firmware_version ?? '—'}
          </div>
        ),
      },
      {
        id: 'connectivity',
        header: 'Konektivitas',
        cell: ({ row }) => {
          const dev = row.original;
          return (
            <div className="text-xs">
              <div className="flex items-center gap-1.5">
                <Badge variant={dev.online ? 'success' : 'danger'}>
                  {dev.online ? (
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
                {dev.last_seen ? formatDateTime(dev.last_seen) : 'Belum ada data'}
              </div>
            </div>
          );
        },
      },
      {
        id: 'enrollment',
        header: 'Enrollment',
        cell: ({ row }) => {
          const dev = row.original;
          return (
            <div className="text-xs">
              <Badge
                variant={
                  dev.enrollmentState === 'REVOKED'
                    ? 'danger'
                    : dev.enrollmentState === 'PROVISIONED'
                      ? 'warning'
                      : 'success'
                }
              >
                {dev.enrollmentState ?? 'ACTIVE'}
              </Badge>
              <div className="text-[11px] font-tabular text-slate-400 mt-1">
                {dev.provisionedAt ? `Prov: ${formatDate(dev.provisionedAt)}` : '—'}
              </div>
              {dev.credentialRotatedAt ? (
                <div className="text-[11px] font-tabular text-slate-400">
                  Rot: {formatDate(dev.credentialRotatedAt)}
                </div>
              ) : null}
            </div>
          );
        },
      },
      {
        id: 'boundMachine',
        header: 'Bound Machine',
        cell: ({ row }) => {
          const dev = row.original;
          return dev.bound_machine_id ? (
            <div className="text-xs">
              <div className="font-semibold text-slate-900 dark:text-slate-100">
                {dev.boundMachine?.name || dev.bound_machine_name || dev.bound_machine_id}
              </div>
              <div className="text-[11px] font-tabular text-slate-400">{dev.bound_machine_id}</div>
            </div>
          ) : (
            <Badge variant="neutral">Unbound</Badge>
          );
        },
      },
      {
        id: 'actions',
        header: 'Aksi',
        cell: ({ row }) => {
          const dev = row.original;
          const rowManageCap = checkCapability('device.manage', dev.device_id);
          return (
            <div className="flex items-center justify-end gap-1.5">
              <Button
                size="sm"
                variant="outline"
                aria-label={`Detail perangkat ${dev.device_id}`}
                onClick={() => onDetail(dev.device_id)}
              >
                <Eye className="w-3.5 h-3.5" />
                <span>Detail</span>
              </Button>
              <Button
                size="sm"
                variant="outline"
                aria-label={`Health perangkat ${dev.device_id}`}
                onClick={() => onHealth(dev)}
              >
                <Activity className="w-3.5 h-3.5" />
                <span>Health</span>
              </Button>
              <Button
                size="sm"
                variant="outline"
                disabled={!rowManageCap.canInteract}
                aria-label={`Edit perangkat ${dev.device_id}`}
                title={!rowManageCap.canInteract ? rowManageCap.reason : 'Ubah IP / Firmware'}
                onClick={() => onEdit(dev)}
              >
                <Edit3 className="w-3.5 h-3.5" />
              </Button>
              <Button
                size="sm"
                variant="danger"
                disabled={!rowManageCap.canInteract}
                aria-label={`Hapus perangkat ${dev.device_id}`}
                title={!rowManageCap.canInteract ? rowManageCap.reason : 'Hapus perangkat'}
                onClick={() => onDelete(dev)}
              >
                <Trash2 className="w-3.5 h-3.5" />
              </Button>
            </div>
          );
        },
      },
    ],
    [checkCapability, onDetail, onHealth, onEdit, onDelete],
  );
}
