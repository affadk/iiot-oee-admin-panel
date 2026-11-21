import React from 'react';
import { Link } from 'react-router-dom';
import { Cpu, Wifi, WifiOff, ExternalLink } from 'lucide-react';
import { Machine } from '../../../types/assets';
import { Badge } from '../../../components/ui/Badge';

interface MachineBindingInfoProps {
  machine: Machine;
  onClose: () => void;
}

/**
 * Panel info ikatan edge device 1:1 pada detail mesin (E31.14, FAT-277).
 * Dipisah dari MachineDetailModal agar modal hanya orkestrasi muat +
 * susun seksi. Hanya menampilkan info ikatan — aksi bind/unbind tetap
 * di footer MachineDetailModal (MachineBindModal yang menanganinya).
 */
export const MachineBindingInfo: React.FC<MachineBindingInfoProps> = ({ machine, onClose }) => {
  return (
    <div className="p-4 rounded-md border border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-800/40 space-y-3">
      <div className="flex items-center justify-between">
        <span className="font-semibold text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
          <Cpu className="w-4 h-4 text-sky-500" />
          Edge Device Terikat (1:1)
        </span>
        <Link
          to="/admin/devices"
          onClick={onClose}
          className="inline-flex items-center gap-1 text-[11px] font-semibold text-sky-600 dark:text-sky-400 hover:underline"
        >
          <span>Lihat Edge Devices</span>
          <ExternalLink className="w-3 h-3" />
        </Link>
      </div>

      {machine.boundDevice ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1 font-tabular">
          <div>
            <span className="text-[11px] text-slate-400 block">Device ID &amp; Status</span>
            <div className="flex items-center gap-2 mt-0.5">
              <span className="font-bold text-slate-900 dark:text-slate-100">
                {machine.boundDevice.device_id}
              </span>
              <Badge variant={machine.boundDevice.online ? 'success' : 'danger'}>
                {machine.boundDevice.online ? (
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
          </div>
          <div>
            <span className="text-[11px] text-slate-400 block">MAC Address</span>
            <span className="font-semibold text-slate-900 dark:text-slate-100">
              {machine.boundDevice.mac_address}
            </span>
          </div>
          <div>
            <span className="text-[11px] text-slate-400 block">IP Address</span>
            <span className="text-slate-800 dark:text-slate-200">
              {machine.boundDevice.ip_address ?? '—'}
            </span>
          </div>
          <div>
            <span className="text-[11px] text-slate-400 block">Firmware</span>
            <span className="text-slate-800 dark:text-slate-200">
              {machine.boundDevice.firmware_version ?? '—'}
            </span>
          </div>
        </div>
      ) : machine.bound_device_id ? (
        <div className="font-tabular font-semibold text-slate-800 dark:text-slate-200">
          {machine.bound_device_id}
        </div>
      ) : (
        <div className="text-slate-500 italic">
          Mesin ini belum memiliki perangkat edge yang terikat (Unbound).
        </div>
      )}
    </div>
  );
};
