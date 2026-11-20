import React, { useEffect, useState } from 'react';
import { Button } from '../../../components/ui/Button';
import { Input } from '../../../components/ui/Input';
import { Modal } from '../../../components/ui/Modal';
import { validateStationInput } from '../stationValidation';
import { mapApiIssuesToErrors } from '../hooks/useDevices';
import { RegisterStationInput } from '../hooks/useStations';

export interface StationRegisterModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (input: RegisterStationInput) => Promise<void>;
  /** Prefill device_id — dipakai CTA "Daftarkan" dari panel diagnostik T3. */
  initialDeviceId?: string;
}

export const StationRegisterModal: React.FC<StationRegisterModalProps> = ({
  isOpen,
  onClose,
  onSubmit,
  initialDeviceId = '',
}) => {
  const [deviceId, setDeviceId] = useState(initialDeviceId);
  const [mac, setMac] = useState('');
  const [ip, setIp] = useState('');
  const [firmware, setFirmware] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Prefill saat dibuka (mis. dari CTA diagnostik); membuka modal membersihkan error.
  useEffect(() => {
    if (isOpen) {
      setDeviceId(initialDeviceId);
      setMac('');
      setIp('');
      setFirmware('');
      setErrors({});
      setSubmitError(null);
    }
  }, [isOpen, initialDeviceId]);

  const handleSubmit = async (e?: React.FormEvent) => {
    e?.preventDefault();
    const errs = validateStationInput({
      deviceId,
      macAddress: mac,
      ipAddress: ip || undefined,
      firmwareVersion: firmware || undefined,
      isCreate: true,
    });
    if (Object.keys(errs).length > 0) {
      setErrors(errs);
      return;
    }

    setIsSubmitting(true);
    setSubmitError(null);
    try {
      await onSubmit({ deviceId, mac, ip, firmware });
      setDeviceId('');
      setMac('');
      setIp('');
      setFirmware('');
      setErrors({});
      onClose();
    } catch (err: any) {
      const fieldErrs = mapApiIssuesToErrors(err);
      if (Object.keys(fieldErrs).length > 0) {
        setErrors(fieldErrs);
      }
      setSubmitError(err?.message || 'Gagal mendaftarkan stasiun.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Daftarkan Stasiun / Terminal Login Baru"
      subtitle="Registrasi legacy ke tabel devices (tanpa identitas broker MQTT). Station ID yang didaftarkan di sini menjadi nilai station_id yang diterima saat login kiosk — khusus login kiosk, login admin panel tidak memakai station_id (Spec 044)."
      footer={
        <div className="flex items-center gap-2">
          <Button variant="ghost" onClick={onClose} disabled={isSubmitting}>
            Batal
          </Button>
          <Button onClick={() => void handleSubmit()} isLoading={isSubmitting}>
            Daftarkan Stasiun
          </Button>
        </div>
      }
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="p-2.5 rounded border border-amber-300 bg-amber-50 dark:bg-amber-950/40 dark:border-amber-800 text-xs text-amber-900 dark:text-amber-200">
          Server saat ini HANYA menerima Station ID berpola STM32- (contoh: STM32-CONSOLE-01).
          ID di luar pola itu (mis. ADMIN-CONSOLE-01) ditolak server dengan 400
          &quot;Device ID must start with &apos;STM32-&apos;...&quot; — sampai backend
          diperbaiki (FAT-237). API tidak menyediakan field hostname — identitas
          stasiun adalah Station ID-nya.
        </div>
        {submitError && (
          <div role="alert" className="p-2.5 rounded border border-red-300 bg-red-50 dark:bg-red-950/40 dark:border-red-800 text-xs text-red-800 dark:text-red-200">
            {submitError}
          </div>
        )}
        <Input
          label="Station / Device ID"
          value={deviceId}
          onChange={(e) => setDeviceId(e.target.value)}
          placeholder="STM32-CONSOLE-01"
          error={errors.deviceId}
          required
        />
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Input
            label="MAC Address (EUI-48, Opsional)"
            value={mac}
            onChange={(e) => setMac(e.target.value.toUpperCase())}
            placeholder="00:08:DC:55:01:0A"
            error={errors.macAddress}
          />
          <Input
            label="IP Address (Opsional)"
            value={ip}
            onChange={(e) => setIp(e.target.value)}
            placeholder="192.168.10.26"
            error={errors.ipAddress}
          />
        </div>
        <Input
          label="Firmware Version (Opsional)"
          value={firmware}
          onChange={(e) => setFirmware(e.target.value)}
          placeholder="v2.4.1-rtos"
          error={errors.firmwareVersion}
        />
      </form>
    </Modal>
  );
};
