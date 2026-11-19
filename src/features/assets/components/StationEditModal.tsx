import React, { useEffect, useState } from 'react';
import { Station } from '../../../types/assets';
import { Button } from '../../../components/ui/Button';
import { Input } from '../../../components/ui/Input';
import { Modal } from '../../../components/ui/Modal';
import { validateStationInput } from '../stationValidation';
import { mapApiIssuesToErrors } from '../hooks/useDevices';
import { UpdateStationInput } from '../hooks/useStations';

export interface StationEditModalProps {
  target: Station | null;
  onClose: () => void;
  onSubmit: (deviceId: string, input: UpdateStationInput) => Promise<void>;
}

export const StationEditModal: React.FC<StationEditModalProps> = ({ target, onClose, onSubmit }) => {
  const [ip, setIp] = useState(target?.ip_address ?? '');
  const [firmware, setFirmware] = useState(target?.firmware_version ?? '');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Seeding dari target saat dibuka (page me-remount modal per target via `key`).
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
    const errs = validateStationInput({
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
      setErrors({});
      onClose();
    } catch (err: any) {
      const fieldErrs = mapApiIssuesToErrors(err);
      if (Object.keys(fieldErrs).length > 0) {
        setErrors(fieldErrs);
      }
      setSubmitError(err?.message || 'Gagal memperbarui stasiun.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Modal
      isOpen={Boolean(target)}
      onClose={onClose}
      title={`Ubah Stasiun ${target?.device_id ?? ''}`}
      subtitle="Hanya IP Address dan Firmware Version yang bisa diubah via API (PUT /devices). Station ID tidak bisa diubah; field yang dikosongkan dipertahankan server (tidak dikirim)."
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        {submitError && (
          <div role="alert" className="p-2.5 rounded border border-red-300 bg-red-50 dark:bg-red-950/40 dark:border-red-800 text-xs text-red-800 dark:text-red-200">
            {submitError}
          </div>
        )}
        <Input
          label="IP Address (Opsional)"
          value={ip}
          onChange={(e) => setIp(e.target.value)}
          placeholder="192.168.10.26"
          error={errors.ipAddress}
        />
        <Input
          label="Firmware Version (Opsional)"
          value={firmware}
          onChange={(e) => setFirmware(e.target.value)}
          placeholder="v2.4.1-rtos"
          error={errors.firmwareVersion}
        />
        <div className="flex items-center justify-end gap-2">
          <Button variant="ghost" onClick={onClose} disabled={isSubmitting}>
            Batal
          </Button>
          <Button onClick={() => void handleSubmit()} isLoading={isSubmitting}>
            Simpan Perubahan
          </Button>
        </div>
      </form>
    </Modal>
  );
};
