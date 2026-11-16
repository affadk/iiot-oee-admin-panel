import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Cpu, Wifi, WifiOff, Activity, Link2, Lock, ExternalLink } from 'lucide-react';
import { apiClient } from '../../services/api/client';
import { EdgeDevice } from '../../types/assets';
import { Modal } from '../../components/ui/Modal';
import { Badge } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';

interface DeviceDetailModalProps {
  deviceId: string | null;
  onClose: () => void;
  onOpenHealth?: (device: EdgeDevice) => void;
}

export const DeviceDetailModal: React.FC<DeviceDetailModalProps> = ({
  deviceId,
  onClose,
  onOpenHealth,
}) => {
  const [device, setDevice] = useState<EdgeDevice | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!deviceId) {
      setDevice(null);
      setError(null);
      return;
    }

    const controller = new AbortController();
    setIsLoading(true);
    setError(null);

    apiClient
      .getDeviceById(deviceId, controller.signal)
      .then((res) => {
        if (!controller.signal.aborted) {
          setDevice(res);
        }
      })
      .catch((err: any) => {
        if (!controller.signal.aborted) {
          setError(err?.message || 'Gagal memuat detail perangkat.');
        }
      })
      .finally(() => {
        if (!controller.signal.aborted) {
          setIsLoading(false);
        }
      });

    return () => controller.abort();
  }, [deviceId]);

  return (
    <Modal
      isOpen={Boolean(deviceId)}
      onClose={onClose}
      title={`Detail Edge Device ${deviceId ?? ''}`}
      subtitle="Informasi registrasi hardware, jaringan, dan status ikatan mesin (1:1)."
      maxWidth="lg"
      footer={
        <div className="flex items-center gap-2">
          {device && onOpenHealth && (
            <Button
              size="sm"
              variant="secondary"
              onClick={() => {
                onClose();
                onOpenHealth(device);
              }}
            >
              <Activity className="w-3.5 h-3.5" />
              <span>Health Diagnostics</span>
            </Button>
          )}
          <Button size="sm" variant="ghost" onClick={onClose}>
            Tutup
          </Button>
        </div>
      }
    >
      {isLoading ? (
        <div className="py-8 text-center text-xs text-slate-500">Memuat detail perangkat...</div>
      ) : error ? (
        <div role="alert" className="p-3 rounded border border-red-300 bg-red-50 text-xs text-red-800 dark:bg-red-950/40 dark:border-red-800 dark:text-red-200">
          {error}
        </div>
      ) : device ? (
        <div className="space-y-4 text-xs">
          <div className="flex flex-wrap items-center justify-between gap-2 p-3 rounded bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700">
            <div className="flex items-center gap-2.5">
              <Cpu className="w-5 h-5 text-sky-500" />
              <div>
                <div className="font-bold text-sm font-tabular text-slate-900 dark:text-slate-100">
                  {device.device_id}
                </div>
                <div className="text-[11px] text-slate-500">
                  {device.model || 'STM32H743-Edge-Pro'} · SN: {device.serial_number}
                </div>
              </div>
            </div>
            <Badge variant={device.online ? 'success' : 'danger'}>
              {device.online ? (
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

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="p-3 rounded border border-slate-200 dark:border-slate-800">
              <div className="text-[11px] text-slate-400 flex items-center gap-1">
                <Lock className="w-3 h-3" /> MAC Address (Immutable)
              </div>
              <div className="font-tabular font-semibold text-slate-900 dark:text-slate-100 mt-1">
                {device.mac_address}
              </div>
            </div>

            <div className="p-3 rounded border border-slate-200 dark:border-slate-800">
              <div className="text-[11px] text-slate-400">IP Address</div>
              <div className="font-tabular font-semibold text-slate-900 dark:text-slate-100 mt-1">
                {device.ip_address ?? '— (Belum dikonfigurasi)'}
              </div>
            </div>

            <div className="p-3 rounded border border-slate-200 dark:border-slate-800">
              <div className="text-[11px] text-slate-400">Firmware Version</div>
              <div className="font-tabular font-semibold text-slate-900 dark:text-slate-100 mt-1">
                {device.firmware_version ?? '—'}
              </div>
            </div>

            <div className="p-3 rounded border border-slate-200 dark:border-slate-800">
              <div className="text-[11px] text-slate-400">Last Seen / Terdaftar</div>
              <div className="font-tabular text-slate-800 dark:text-slate-200 mt-1">
                {device.last_seen ? new Date(device.last_seen).toLocaleString() : 'Belum pernah terlihat'}
              </div>
              <div className="text-[11px] text-slate-400 font-tabular mt-0.5">
                Terdaftar: {new Date(device.created_at).toLocaleString()}
              </div>
            </div>
          </div>

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
                <div>
                  <span className="text-[11px] text-slate-400 block">Modbus Slave</span>
                  <Badge variant="neutral">Slave #{device.boundMachine.modbus_slave_id}</Badge>
                </div>
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
        </div>
      ) : null}
    </Modal>
  );
};
