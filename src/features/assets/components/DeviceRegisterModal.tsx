import React, { useEffect, useState } from 'react';
import { Button } from '../../../components/ui/Button';
import { Input } from '../../../components/ui/Input';
import { Modal } from '../../../components/ui/Modal';
import { validateDeviceInput } from '../../../utils/capabilities';
import { RegisterDeviceInput } from '../hooks/useDevices';
import { mapApiIssuesToErrors } from '../utils/apiErrors';

const DEFAULT_DEVICE_ID = 'STM32-OEE-06';
const DEFAULT_FIRMWARE = 'v2.4.1-rtos';

export interface DeviceRegisterModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (input: RegisterDeviceInput) => Promise<void>;
}

export const DeviceRegisterModal: React.FC<DeviceRegisterModalProps> = ({ isOpen, onClose, onSubmit }) => {
  const [deviceId, setDeviceId] = useState(DEFAULT_DEVICE_ID);
  const [mac, setMac] = useState('');
  const [ip, setIp] = useState('');
  const [firmware, setFirmware] = useState(DEFAULT_FIRMWARE);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Perilaku asli (tombol buka di page): membuka modal membersihkan error.
  useEffect(() => {
    if (isOpen) {
      setErrors({});
      setSubmitError(null);
    }
  }, [isOpen]);

  const handleSubmit = async (e?: React.FormEvent) => {
    e?.preventDefault();
    const errs = validateDeviceInput({
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
      // E23 Batch 4 (FAT-206, N-37): spec live POST /devices tidak
      // mengenal model/serial_number — field keduanya dihapus dari modal
      // (server mengabaikannya); mac_address opsional.
      await onSubmit({ deviceId, mac, ip, firmware });
      // Reset-saat-sukses (verbatim): hanya deviceId/mac/ip + error
      // yang di-reset; firmware dipertahankan.
      setDeviceId(DEFAULT_DEVICE_ID);
      setMac('');
      setIp('');
      setErrors({});
      onClose();
    } catch (err: any) {
      const fieldErrs = mapApiIssuesToErrors(err);
      if (Object.keys(fieldErrs).length > 0) {
        setErrors(fieldErrs);
      }
      setSubmitError(err?.message || 'Gagal mendaftarkan perangkat.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Registrasi Edge Controller STM32 Baru (Legacy)"
      subtitle="Registrasi manual legacy tanpa kredensial broker — gunakan Provision untuk alur lengkap. ID Perangkat harus diawali 'STM32-' (contoh: STM32-OEE-06) dengan alamat MAC EUI-48 yang unik."
      footer={
        <div className="flex items-center gap-2">
          <Button variant="ghost" onClick={onClose} disabled={isSubmitting}>
            Batal
          </Button>
          <Button onClick={() => void handleSubmit()} isLoading={isSubmitting}>
            Daftarkan Perangkat (Legacy)
          </Button>
        </div>
      }
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="p-2.5 rounded border border-amber-300 bg-amber-50 dark:bg-amber-950/40 dark:border-amber-800 text-xs text-amber-900 dark:text-amber-200">
          <span className="font-bold">Legacy</span> — registrasi manual ini hanya menulis registry tanpa identitas
          broker. Gunakan <span className="font-semibold">Provision Device</span> untuk alur lengkap (broker identity +
          registry + kredensial sekali tampil).
        </div>
        {submitError && (
          <div role="alert" className="p-2.5 rounded border border-red-300 bg-red-50 dark:bg-red-950/40 dark:border-red-800 text-xs text-red-800 dark:text-red-200">
            {submitError}
          </div>
        )}
        <Input
          label="Device ID"
          value={deviceId}
          onChange={(e) => setDeviceId(e.target.value)}
          placeholder="STM32-OEE-06"
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
