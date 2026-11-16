import React from 'react';
import { Cpu, Edit3, Trash2, Link2, Unlink, Eye } from 'lucide-react';
import { Machine, EdgeDevice } from '../../../types/assets';
import { CapabilityKey, CapabilityState } from '../../../utils/capabilities';
import { Badge } from '../../../components/ui/Badge';
import { Button } from '../../../components/ui/Button';

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
  return (
    <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-md overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/50 text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              <th className="py-3 px-4">Machine ID &amp; Nama</th>
              <th className="py-3 px-4">Modbus Slave</th>
              <th className="py-3 px-4">Edge Device Terikat</th>
              <th className="py-3 px-4 text-right">Aksi</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-slate-800/80 text-xs">
            {isLoading ? (
              <tr>
                <td colSpan={4} className="py-8 text-center text-slate-400">
                  Memuat data mesin...
                </td>
              </tr>
            ) : machines.length === 0 ? (
              <tr>
                <td colSpan={4} className="py-8 text-center text-slate-400">
                  Tidak ada mesin pada filter ini.
                </td>
              </tr>
            ) : (
              machines.map((m) => {
                const rowManageCap = checkCapability('machine.manage', m.machine_id);
                return (
                  <tr key={m.machine_id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30">
                    <td className="py-3 px-4">
                      <div className="font-semibold text-slate-900 dark:text-slate-100">{m.name}</div>
                      <div className="text-[11px] font-tabular text-slate-500">{m.machine_id}</div>
                    </td>
                    <td className="py-3 px-4 font-tabular text-slate-700 dark:text-slate-300">
                      <Badge variant="neutral">Slave #{m.modbus_slave_id}</Badge>
                    </td>
                    <td className="py-3 px-4">
                      {m.bound_device_id ? (
                        <div className="space-y-0.5">
                          <div className="inline-flex items-center gap-1.5 px-2 py-1 rounded bg-sky-50 dark:bg-sky-950/40 border border-sky-200 dark:border-sky-800 text-sky-800 dark:text-sky-300 font-tabular text-xs">
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
                      )}
                    </td>
                    <td className="py-3 px-4 text-right">
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
