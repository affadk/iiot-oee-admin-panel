import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Cpu, Link2, Unlink, Wifi, WifiOff, ExternalLink } from 'lucide-react';
import { apiClient } from '../../services/api/client';
import { Machine } from '../../types/assets';
import { Modal } from '../../components/ui/Modal';
import { Badge } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';

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
        <div role="alert" className="p-3 rounded border border-red-300 bg-red-50 text-xs text-red-800 dark:bg-red-950/40 dark:border-red-800 dark:text-red-200">
          {error}
        </div>
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
              Dibuat: {new Date(machine.created_at).toLocaleString()}
            </div>
            <div className="p-2.5 rounded bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-800">
              Diperbarui: {new Date(machine.updated_at).toLocaleString()}
            </div>
          </div>

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
        </div>
      ) : null}
    </Modal>
  );
};
