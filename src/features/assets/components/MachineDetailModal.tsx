import React, { useEffect, useState } from 'react';
import { Link2, Unlink } from 'lucide-react';
import { apiClient } from '../../../services/api/client';
import { Machine } from '../../../types/assets';
import { Modal } from '../../../components/ui/Modal';
import { Badge } from '../../../components/ui/Badge';
import { Button } from '../../../components/ui/Button';
import { MachineBindingInfo } from './MachineBindingInfo';
import { LoadErrorBanner } from '../../shared/LoadErrorBanner';
import { formatDateTime } from '../../../utils/formatDate';

interface MachineDetailModalProps {
  machineId: string | null;
  onClose: () => void;
  canManage: boolean;
  manageDisabledReason?: string;
  hasUnboundDevices: boolean;
  onRequestBind: (machine: Machine) => void;
  onRequestUnbind: (machine: Machine) => void;
}

export const MachineDetailModal: React.FC<MachineDetailModalProps> = ({
  machineId,
  onClose,
  canManage,
  manageDisabledReason,
  hasUnboundDevices,
  onRequestBind,
  onRequestUnbind,
}) => {
  const [machine, setMachine] = useState<Machine | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!machineId) {
      setMachine(null);
      setError(null);
      return;
    }

    const controller = new AbortController();
    setIsLoading(true);
    setError(null);

    apiClient
      .getMachineById(machineId, controller.signal)
      .then((res) => {
        if (!controller.signal.aborted) {
          setMachine(res);
        }
      })
      .catch((err: any) => {
        if (!controller.signal.aborted) {
          setError(err?.message || 'Gagal memuat detail mesin.');
        }
      })
      .finally(() => {
        if (!controller.signal.aborted) {
          setIsLoading(false);
        }
      });

    return () => controller.abort();
  }, [machineId]);

  return (
    <Modal
      isOpen={Boolean(machineId)}
      onClose={onClose}
      title={`Detail Mesin ${machineId ?? ''}`}
      subtitle="Master konfigurasi mesin produksi dan informasi edge device terikat (1:1)."
      maxWidth="lg"
      footer={
        <div className="flex items-center gap-2">
          {machine &&
            (machine.bound_device_id ? (
              <Button
                size="sm"
                variant="outline"
                disabled={!canManage}
                title={!canManage ? manageDisabledReason : 'Lepas ikatan device dari mesin'}
                onClick={() => {
                  onClose();
                  onRequestUnbind(machine);
                }}
              >
                <Unlink className="w-3.5 h-3.5" />
                <span>Unbind Device</span>
              </Button>
            ) : (
              <Button
                size="sm"
                variant="secondary"
                disabled={!canManage || !hasUnboundDevices}
                title={
                  !canManage
                    ? manageDisabledReason
                    : !hasUnboundDevices
                    ? 'Tidak ada perangkat unbound tersedia'
                    : 'Hubungkan mesin dengan perangkat edge'
                }
                onClick={() => {
                  onClose();
                  onRequestBind(machine);
                }}
              >
                <Link2 className="w-3.5 h-3.5" />
                <span>Bind Device</span>
              </Button>
            ))}
          <Button size="sm" variant="ghost" onClick={onClose}>
            Tutup
          </Button>
        </div>
      }
    >
      {isLoading ? (
        <div className="py-8 text-center text-xs text-slate-500">Memuat detail mesin...</div>
      ) : error ? (
        <LoadErrorBanner title="Gagal memuat detail mesin" message={error} />
      ) : machine ? (
        <div className="space-y-4 text-xs">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="p-3 rounded border border-slate-200 dark:border-slate-800">
              <div className="text-[11px] text-slate-400">Machine ID</div>
              <div className="font-tabular font-bold text-slate-900 dark:text-slate-100 mt-1">
                {machine.machine_id}
              </div>
            </div>
            <div className="p-3 rounded border border-slate-200 dark:border-slate-800">
              <div className="text-[11px] text-slate-400">Nama Mesin</div>
              <div className="font-semibold text-slate-900 dark:text-slate-100 mt-1">{machine.name}</div>
            </div>
            <div className="p-3 rounded border border-slate-200 dark:border-slate-800">
              <div className="text-[11px] text-slate-400">Modbus Slave ID</div>
              <div className="mt-1">
                <Badge variant="neutral">Slave #{machine.modbus_slave_id}</Badge>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-[11px] font-tabular text-slate-500">
            <div className="p-2.5 rounded bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-800">
              Dibuat: {formatDateTime(machine.created_at)}
            </div>
            <div className="p-2.5 rounded bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-800">
              Diperbarui: {formatDateTime(machine.updated_at ?? machine.created_at)}
            </div>
          </div>

          <MachineBindingInfo machine={machine} onClose={onClose} />
        </div>
      ) : null}
    </Modal>
  );
};
