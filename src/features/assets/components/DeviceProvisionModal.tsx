import React, { useEffect, useState } from 'react';
import { Button } from '../../../components/ui/Button';
import { Input } from '../../../components/ui/Input';
import { Modal } from '../../../components/ui/Modal';
import { ProvisionDeviceInput } from '../hooks/useDevices';

export interface DeviceProvisionModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (input: ProvisionDeviceInput) => Promise<void>;
}

const DEFAULT_DEVICE_ID = 'STM32-OEE-06';
const DEFAULT_MODEL = 'STM32H723-W5500';

export const DeviceProvisionModal: React.FC<DeviceProvisionModalProps> = ({ isOpen, onClose, onSubmit }) => {
  const [deviceId, setDeviceId] = useState(DEFAULT_DEVICE_ID);
  const [machineId, setMachineId] = useState('');
  const [model, setModel] = useState(DEFAULT_MODEL);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (isOpen) setError(null);
  }, [isOpen]);

  const handleSubmit = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!/^STM32-[A-Za-z0-9_-]{1,31}$/.test(deviceId.trim())) {
      setError('Device ID harus diawali "STM32-" (1..31 karakter huruf, angka, "_" atau "-").');
      return;
    }
    setIsSubmitting(true);
    setError(null);
    try {
      await onSubmit({ deviceId: deviceId.trim(), machineId: machineId.trim() || undefined, model: model.trim() || undefined });
      setDeviceId(DEFAULT_DEVICE_ID);
      setMachineId('');
      onClose();
    } catch (err: any) {
      setError(err?.message || 'Gagal mem-provision perangkat.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Provision Edge Device"
      subtitle="Alur kanonis (§E.3a): satu aksi membuat identitas broker + baris registry. Password dibuat backend dan hanya ditampilkan sekali."
      footer={
        <div className="flex items-center gap-2">
          <Button variant="ghost" onClick={onClose} disabled={isSubmitting}>
            Batal
          </Button>
          <Button onClick={() => void handleSubmit()} isLoading={isSubmitting}>
            Provision Perangkat
          </Button>
        </div>
      }
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        {error && (
          <div role="alert" className="p-2.5 rounded border border-red-300 bg-red-50 dark:bg-red-950/40 dark:border-red-800 text-xs text-red-800 dark:text-red-200">
            {error}
          </div>
        )}
        <Input
          label="Device ID"
          value={deviceId}
          onChange={(e) => setDeviceId(e.target.value)}
          placeholder="STM32-OEE-06"
          required
        />
        <Input
          label="Machine ID (Opsional — langsung bind 1:1)"
          value={machineId}
          onChange={(e) => setMachineId(e.target.value)}
          placeholder="CNC-MILLING-02"
        />
        <Input
          label="Model (Opsional)"
          value={model}
          onChange={(e) => setModel(e.target.value)}
          placeholder="STM32H723-W5500"
        />
        <p className="text-[11px] text-slate-500 dark:text-slate-400">
          MAC address dibiarkan kosong saat provisioning — nilai pertama dari /hello perangkat disimpan otomatis.
          Perangkat yang pernah punya histori telemetri tidak dapat dipakai ulang (409 DEVICE_ID_HAS_HISTORY).
        </p>
      </form>
    </Modal>
  );
};
