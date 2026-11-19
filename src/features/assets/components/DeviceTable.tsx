import React from 'react';
import { Cpu, Wifi, WifiOff, Eye, Activity, Edit3, Trash2 } from 'lucide-react';
import { EdgeDevice } from '../../../types/assets';
import { CapabilityKey, CapabilityState } from '../../../utils/capabilities';
import { Badge } from '../../../components/ui/Badge';
import { Button } from '../../../components/ui/Button';

export interface DeviceTableProps {
  devices: EdgeDevice[];
  isLoading: boolean;
  checkCapability: (
    capability: CapabilityKey,
    resourceId?: string,
  ) => { state: CapabilityState; canInteract: boolean; reason?: string };
  onDetail: (deviceId: string) => void;
  onHealth: (device: EdgeDevice) => void;
  onEdit: (device: EdgeDevice) => void;
  onDelete: (device: EdgeDevice) => void;
}

export const DeviceTable: React.FC<DeviceTableProps> = ({
  devices,
  isLoading,
  checkCapability,
  onDetail,
  onHealth,
  onEdit,
  onDelete,
}) => {
  return (
    <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-md overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/50 text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              <th className="py-3 px-4">Device ID &amp; Hardware</th>
              <th className="py-3 px-4">MAC / IP Address</th>
              <th className="py-3 px-4">Firmware</th>
              <th className="py-3 px-4">Konektivitas</th>
              <th className="py-3 px-4">Enrollment</th>
              <th className="py-3 px-4">Bound Machine</th>
              <th className="py-3 px-4 text-right">Aksi</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-slate-800/80 text-xs">
            {isLoading ? (
              <tr>
                <td colSpan={7} className="py-8 text-center text-slate-400">
                  Memuat perangkat edge...
                </td>
              </tr>
            ) : devices.length === 0 ? (
              <tr>
                <td colSpan={7} className="py-8 text-center text-slate-400">
                  Tidak ada perangkat edge pada filter ini.
                </td>
              </tr>
            ) : (
              devices.map((dev) => {
                const rowManageCap = checkCapability('device.manage', dev.device_id);
                return (
                  <tr key={dev.device_id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30">
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-2 font-semibold text-slate-900 dark:text-slate-100 font-tabular">
                        <Cpu className="w-4 h-4 text-sky-500 shrink-0" />
                        <span>{dev.device_id}</span>
                      </div>
                      <div className="text-[11px] text-slate-500 pl-6">
                        {dev.model || 'STM32H743'} · SN: {dev.serial_number}
                      </div>
                    </td>
                    <td className="py-3 px-4 font-tabular text-slate-700 dark:text-slate-300">
                      <div>{dev.mac_address}</div>
                      <div className="text-[11px] text-slate-500">{dev.ip_address ?? '—'}</div>
                    </td>
                    <td className="py-3 px-4 font-tabular text-slate-700 dark:text-slate-300">
                      {dev.firmware_version ?? '—'}
                    </td>
                    <td className="py-3 px-4">
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
                        {dev.last_seen ? new Date(dev.last_seen).toLocaleString() : 'Belum ada data'}
                      </div>
                    </td>
                    <td className="py-3 px-4">
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
                        {dev.provisionedAt ? `Prov: ${new Date(dev.provisionedAt).toLocaleDateString()}` : '—'}
                      </div>
                      {dev.credentialRotatedAt ? (
                        <div className="text-[11px] font-tabular text-slate-400">
                          Rot: {new Date(dev.credentialRotatedAt).toLocaleDateString()}
                        </div>
                      ) : null}
                    </td>
                    <td className="py-3 px-4">
                      {dev.bound_machine_id ? (
                        <div>
                          <div className="font-semibold text-slate-900 dark:text-slate-100">
                            {dev.boundMachine?.name || dev.bound_machine_name || dev.bound_machine_id}
                          </div>
                          <div className="text-[11px] font-tabular text-slate-400">{dev.bound_machine_id}</div>
                        </div>
                      ) : (
                        <Badge variant="neutral">Unbound</Badge>
                      )}
                    </td>
                    <td className="py-3 px-4 text-right">
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
