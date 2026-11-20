import React, { useMemo } from 'react';
import { Cpu, Edit3, Trash2, Link2, Unlink, Eye } from 'lucide-react';
import { LegacyColumnDef as ColumnDef } from '@tanstack/react-table/legacy';
import { Machine, EdgeDevice } from '../../../types/assets';
import { CapabilityKey, CapabilityState } from '../../../utils/capabilities';
import { Badge } from '../../../components/ui/Badge';
import { Button } from '../../../components/ui/Button';
import { DataTable } from '../../../components/industrial/DataTable';

export interface MachinesTableProps {
  machines: Machine[];
  isLoading: boolean;
  unboundDevices: EdgeDevice[];
  checkCapability: (
    capability: CapabilityKey,
    resourceId?: string,
  ) => { state: CapabilityState; canInteract: boolean; reason?: string };
  onDetail: (machineId: string) => void;
  onBind: (machine: Machine) => void;
  onUnbind: (machine: Machine) => void;
  onEdit: (machine: Machine) => void;
  onDelete: (machine: Machine) => void;
}

// E31.10 (FAT-273): tabel hand-rolled → DataTable (aturan R1). Semua
// render kustom per kolom + aksi per baris (Bind/Unbind kondisional)
// dipindahkan ke ColumnDef.cell — tampilan akhir sama (sel dibungkus
// text-xs seperti sebelumnya; DataTable sendiri text-sm).
export const MachinesTable: React.FC<MachinesTableProps> = ({
  machines,
  isLoading,
  unboundDevices,
  checkCapability,
  onDetail,
  onBind,
  onUnbind,
  onEdit,
  onDelete,
}) => {
  const columns = useMemo<ColumnDef<Machine, unknown>[]>(
    () => [
      {
        id: 'machine',
        header: 'Machine ID & Nama',
        cell: ({ row }) => {
          const m = row.original;
          return (
            <div className="text-xs">
              <div className="font-semibold text-slate-900 dark:text-slate-100">{m.name}</div>
              <div className="text-[11px] font-tabular text-slate-500">{m.machine_id}</div>
            </div>
          );
        },
      },
      {
        id: 'modbus',
        header: 'Modbus Slave',
        cell: ({ row }) => (
          <div className="text-xs font-tabular text-slate-700 dark:text-slate-300">
            <Badge variant="neutral">Slave #{row.original.modbus_slave_id}</Badge>
          </div>
        ),
      },
      {
        id: 'boundDevice',
        header: 'Edge Device Terikat',
        cell: ({ row }) => {
          const m = row.original;
          return m.bound_device_id ? (
            <div className="text-xs space-y-0.5">
              <div className="inline-flex items-center gap-1.5 px-2 py-1 rounded bg-sky-50 dark:bg-sky-950/40 border border-sky-200 dark:border-sky-800 text-sky-800 dark:text-sky-300 font-tabular">
                <Cpu className="w-3.5 h-3.5" />
                <span>{m.bound_device_id}</span>
              </div>
              {m.boundDevice && (
                <div className="text-[11px] font-tabular text-slate-400">
                  {m.boundDevice.mac_address} · {m.boundDevice.online ? 'ONLINE' : 'OFFLINE'}
                </div>
              )}
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
          const m = row.original;
          const rowManageCap = checkCapability('machine.manage', m.machine_id);
          return (
            <div className="flex flex-wrap items-center justify-end gap-1.5">
              <Button
                size="sm"
                variant="outline"
                aria-label={`Detail mesin ${m.machine_id}`}
                onClick={() => onDetail(m.machine_id)}
              >
                <Eye className="w-3.5 h-3.5" />
                <span>Detail</span>
              </Button>
              {m.bound_device_id ? (
                <Button
                  size="sm"
                  variant="outline"
                  disabled={!rowManageCap.canInteract}
                  aria-label={`Unbind device dari ${m.machine_id}`}
                  title={!rowManageCap.canInteract ? rowManageCap.reason : 'Lepas ikatan device dari mesin'}
                  onClick={() => onUnbind(m)}
                >
                  <Unlink className="w-3.5 h-3.5" />
                  <span>Unbind</span>
                </Button>
              ) : (
                <Button
                  size="sm"
                  variant="secondary"
                  disabled={!rowManageCap.canInteract || unboundDevices.length === 0}
                  aria-label={`Bind device ke ${m.machine_id}`}
                  title={
                    !rowManageCap.canInteract
                      ? rowManageCap.reason
                      : unboundDevices.length === 0
                      ? 'Semua perangkat sudah terikat'
                      : 'Ikatkan ke Edge Device STM32'
                  }
                  onClick={() => onBind(m)}
                >
                  <Link2 className="w-3.5 h-3.5" />
                  <span>Bind Device</span>
                </Button>
              )}
              <Button
                size="sm"
                variant="outline"
                disabled={!rowManageCap.canInteract}
                aria-label={`Edit mesin ${m.machine_id}`}
                title={!rowManageCap.canInteract ? rowManageCap.reason : 'Ubah nama / Modbus Slave ID'}
                onClick={() => onEdit(m)}
              >
                <Edit3 className="w-3.5 h-3.5" />
              </Button>
              <Button
                size="sm"
                variant="danger"
                disabled={!rowManageCap.canInteract}
                aria-label={`Hapus mesin ${m.machine_id}`}
                title={!rowManageCap.canInteract ? rowManageCap.reason : 'Hapus mesin'}
                onClick={() => onDelete(m)}
              >
                <Trash2 className="w-3.5 h-3.5" />
              </Button>
            </div>
          );
        },
      },
    ],
    [checkCapability, unboundDevices, onDetail, onBind, onUnbind, onEdit, onDelete],
  );

  return (
    <DataTable
      data={machines}
      columns={columns}
      getRowId={(m) => m.machine_id}
      isLoading={isLoading}
      emptyTitle="Tidak ada mesin pada filter ini."
    />
  );
};
