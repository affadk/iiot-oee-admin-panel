import React, { useEffect, useState } from 'react';
import { EdgeDevice } from '../../../types/assets';
import { Button } from '../../../components/ui/Button';
import { Input } from '../../../components/ui/Input';
import { Modal } from '../../../components/ui/Modal';
import { validateDeviceInput } from '../../../utils/capabilities';
import { UpdateDeviceInput } from '../hooks/useDevices';
import { mapApiIssuesToErrors } from '../utils/apiErrors';

export interface DeviceEditModalProps {
  target: EdgeDevice | null;
  onClose: () => void;
  onSubmit: (deviceId: string, input: UpdateDeviceInput) => Promise<void>;
}

export const DeviceEditModal: React.FC<DeviceEditModalProps> = ({ target, onClose, onSubmit }) => {
  const [ip, setIp] = useState(target?.ip_address ?? '');
  const [firmware, setFirmware] = useState(target?.firmware_version ?? '');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Seeding dari target saat dibuka (verbatim: ip, firmware, clear error).
  // Page me-remount modal per target via `key`, jadi initializer di atas
  // sudah benar; efek ini menutup celah bila target berubah tanpa remount.
  useEffect(() => {
    if (target) {
      setIp(target.ip_address ?? '');
      setFirmware(target.firmware_version ?? '');
      setErrors({});
      setSubmitError(null);
    }
  }, [target]);

  const handleSubmit = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!target) return;
    const errs = validateDeviceInput({
      ipAddress: ip || undefined,
      firmwareVersion: firmware || undefined,
      isCreate: false,
    });
    if (Object.keys(errs).length > 0) {
      setErrors(errs);
      return;
    }

    setIsSubmitting(true);
    setSubmitError(null);
    try {
      await onSubmit(target.device_id, { ip, firmware });
      onClose();
    } catch (err: any) {
      const fieldErrs = mapApiIssuesToErrors(err);
      if (Object.keys(fieldErrs).length > 0) {
        setErrors(fieldErrs);
      }
      setSubmitError(err?.message || 'Gagal memperbarui perangkat.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Modal
      isOpen={Boolean(target)}
      onClose={onClose}
      title={`Edit Perangkat ${target?.device_id ?? ''}`}
      subtitle="Hanya IP Address dan Firmware Version yang dapat diperbarui; Device ID & MAC Address bersifat immutable."
      footer={
        <div className="flex items-center gap-2">
          <Button variant="ghost" onClick={onClose} disabled={isSubmitting}>
            Batal
          </Button>
          <Button onClick={() => void handleSubmit()} isLoading={isSubmitting}>
            Simpan
          </Button>
        </div>
      }
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        {submitError && (
          <div role="alert" className="p-2.5 rounded border border-red-300 bg-red-50 dark:bg-red-950/40 dark:border-red-800 text-xs text-red-800 dark:text-red-200">
            {submitError}
          </div>
        )}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Input
            label="Device ID (Immutable)"
            value={target?.device_id ?? ''}
            disabled
            readOnly
          />
          <Input
            label="MAC Address (Immutable)"
            value={target?.mac_address ?? ''}
            disabled
            readOnly
          />
        </div>
        <Input
          label="IP Address"
          value={ip}
          onChange={(e) => setIp(e.target.value)}
          placeholder="192.168.10.26"
          error={errors.ipAddress}
        />
        <Input
          label="Firmware Version"
          value={firmware}
          onChange={(e) => setFirmware(e.target.value)}
          placeholder="v2.4.2-rtos"
          error={errors.firmwareVersion}
        />
      </form>
    </Modal>
  );
};
