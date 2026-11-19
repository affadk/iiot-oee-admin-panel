import React, { useEffect, useState } from 'react';
import { EdgeDevice } from '../../../types/assets';
import { ProductionLine } from '../../../types/production';
import { validateMachineInput } from '../../../utils/capabilities';
import { Button } from '../../../components/ui/Button';
import { Input } from '../../../components/ui/Input';
import { Modal } from '../../../components/ui/Modal';
import { mapApiIssuesToErrors, CreateMachineInput } from '../hooks/useMachineCrud';

const DEFAULT_MACHINE_ID = 'CNC-MILLING-03';
// E23 Batch 2 (FAT-183, N-14): default lini server (spec live POST
// /machines `lineId?` default LINE-01) — dipakai bila pengguna tidak
// memilih lini lain.
const DEFAULT_LINE_ID = 'LINE-01';

export interface MachineCreateModalProps {
  isOpen: boolean;
  onClose: () => void;
  unboundDevices: EdgeDevice[];
  lines: ProductionLine[];
  onSubmit: (input: CreateMachineInput) => Promise<void>;
}

export const MachineCreateModal: React.FC<MachineCreateModalProps> = ({
  isOpen,
  onClose,
  unboundDevices,
  lines,
  onSubmit,
}) => {
  const [machineId, setMachineId] = useState(DEFAULT_MACHINE_ID);
  const [name, setName] = useState('');
  const [slaveId, setSlaveId] = useState(1);
  const [bindDeviceId, setBindDeviceId] = useState('');
  const [lineId, setLineId] = useState(DEFAULT_LINE_ID);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  // E23 Batch 2 (FAT-183, N-14): pilihan lini dari server; LINE-01 selalu
  // tersedia sebagai fallback (default server) bila belum ada di daftar.
  const lineOptions = lines.some((l) => l.lineId === DEFAULT_LINE_ID)
    ? lines
    : [{ lineId: DEFAULT_LINE_ID, lineName: 'Lini 01 (default server)' } as ProductionLine, ...lines];

  // Perilaku asli (tombol buka di page): membuka modal membersihkan error.
  useEffect(() => {
    if (isOpen) {
      setErrors({});
      setSubmitError(null);
    }
  }, [isOpen]);

  const handleSubmit = async (e?: React.FormEvent) => {
    e?.preventDefault();
    const errs = validateMachineInput({
      machineId,
      machineName: name,
      modbusSlaveId: Number(slaveId),
      boundDeviceId: bindDeviceId || null,
      lineId,
      isCreate: true,
    });
    if (Object.keys(errs).length > 0) {
      setErrors(errs);
      return;
    }

    setIsSubmitting(true);
    setSubmitError(null);
    try {
      await onSubmit({ machineId, name, slaveId, bindDeviceId, lineId });
      // Reset-saat-sukses (verbatim): kembali ke default + kosongkan field.
      setMachineId(DEFAULT_MACHINE_ID);
      setName('');
      setSlaveId(1);
      setBindDeviceId('');
      setLineId(DEFAULT_LINE_ID);
      setErrors({});
      onClose();
    } catch (err: any) {
      const fieldErrs = mapApiIssuesToErrors(err);
      if (Object.keys(fieldErrs).length > 0) setErrors(fieldErrs);
      setSubmitError(err?.message || 'Gagal membuat mesin baru.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Tambah Mesin Produksi Baru"
      subtitle="ID Mesin harus diawali 'CNC-' diikuti huruf besar, angka, atau tanda hubung (contoh: CNC-MILLING-03)."
      footer={
        <div className="flex items-center gap-2">
          <Button variant="ghost" onClick={onClose} disabled={isSubmitting}>
            Batal
          </Button>
          <Button onClick={handleSubmit} isLoading={isSubmitting}>
            Buat Mesin
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
        <Input
          label="Machine ID"
          value={machineId}
          onChange={(e) => setMachineId(e.target.value.toUpperCase())}
          placeholder="CNC-MILLING-03"
          error={errors.machineId}
          required
        />
        <Input
          label="Nama Mesin"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Contoh: Mazak 5-Axis Milling C"
          error={errors.machineName}
          required
        />
        <Input
          label="Modbus Slave ID (1–247)"
          type="number"
          min={1}
          max={247}
          value={slaveId}
          onChange={(e) => setSlaveId(Number(e.target.value))}
          error={errors.modbusSlaveId}
          required
        />
        <div>
          <label
            htmlFor="create-line-select"
            className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1"
          >
            Lini Produksi
          </label>
          <select
            id="create-line-select"
            value={lineId}
            onChange={(e) => setLineId(e.target.value)}
            className="w-full px-3 py-2 text-sm bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded text-slate-900 dark:text-slate-100"
          >
            {lineOptions.map((l) => (
              <option key={l.lineId} value={l.lineId}>
                {l.lineId} — {l.lineName}
              </option>
            ))}
          </select>
          {errors.lineId && (
            <p className="text-xs text-red-600 mt-1">{errors.lineId}</p>
          )}
        </div>
        <div>
          <label
            htmlFor="create-bind-device-select"
            className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1"
          >
            Bind Edge Device Awal (Opsional)
          </label>
          <select
            id="create-bind-device-select"
            value={bindDeviceId}
            onChange={(e) => setBindDeviceId(e.target.value)}
            className="w-full px-3 py-2 text-sm bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded text-slate-900 dark:text-slate-100"
          >
            <option value="">-- Tanpa binding (Unbound) --</option>
            {unboundDevices.map((d) => (
              <option key={d.device_id} value={d.device_id}>
                {d.device_id} ({d.ip_address ?? d.mac_address})
              </option>
            ))}
          </select>
          {errors.boundDeviceId && (
            <p className="text-xs text-red-600 mt-1">{errors.boundDeviceId}</p>
          )}
        </div>
      </form>
    </Modal>
  );
};
