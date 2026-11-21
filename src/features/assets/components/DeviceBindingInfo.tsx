import React from 'react';
import { Link } from 'react-router-dom';
import { Link2, ExternalLink } from 'lucide-react';
import { EdgeDevice } from '../../../types/assets';
import { Badge } from '../../../components/ui/Badge';

interface DeviceBindingInfoProps {
  device: EdgeDevice;
  onClose: () => void;
}

/**
 * Panel status ikatan mesin 1:1 pada detail device (E31.14, FAT-277).
 * Dipisah dari DeviceDetailModal agar modal tetap di bawah batas keras
 * komponen (300 baris) setelah pindah ke components/ (aturan R5).
 * Hanya menampilkan info ikatan — aksi bind/unbind tetap di Machines.
 */
export const DeviceBindingInfo: React.FC<DeviceBindingInfoProps> = ({ device, onClose }) => {
  return (
    <div className="p-3.5 rounded-md border border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-800/40 space-y-2">
      <div className="flex items-center justify-between">
        <span className="font-semibold text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
          <Link2 className="w-3.5 h-3.5 text-sky-500" />
          Status Binding Mesin (1:1)
        </span>
        <Link
          to="/admin/machines"
          onClick={onClose}
          className="inline-flex items-center gap-1 text-[11px] font-semibold text-sky-600 dark:text-sky-400 hover:underline"
        >
          <span>Kelola di Machines</span>
          <ExternalLink className="w-3 h-3" />
        </Link>
      </div>

      {device.boundMachine ? (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 pt-1 font-tabular">
          <div>
            <span className="text-[11px] text-slate-400 block">Machine ID</span>
            <span className="font-semibold text-slate-900 dark:text-slate-100">
              {device.boundMachine.machine_id}
            </span>
          </div>
          <div>
            <span className="text-[11px] text-slate-400 block">Nama Mesin</span>
            <span className="font-semibold text-slate-900 dark:text-slate-100">
              {device.boundMachine.name}
            </span>
          </div>
          {device.boundMachine.modbus_slave_id ? (
            <div>
              <span className="text-[11px] text-slate-400 block">Modbus Slave</span>
              <Badge variant="neutral">Slave #{device.boundMachine.modbus_slave_id}</Badge>
            </div>
          ) : null}
        </div>
      ) : device.bound_machine_id ? (
        <div className="text-slate-700 dark:text-slate-300 font-tabular">
          Terikat ke <strong>{device.bound_machine_name || device.bound_machine_id}</strong> ({device.bound_machine_id})
        </div>
      ) : (
        <div className="text-slate-500 italic">
          Unbound — perangkat belum terikat ke mesin produksi mana pun dan siap dihubungkan.
        </div>
      )}
    </div>
  );
};
