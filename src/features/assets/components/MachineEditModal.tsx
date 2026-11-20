import React, { useEffect, useState } from 'react';
import { Machine } from '../../../types/assets';
import { ProductionLine } from '../../../types/production';
import { validateMachineInput } from '../../../utils/capabilities';
import { Button } from '../../../components/ui/Button';
import { Input } from '../../../components/ui/Input';
import { Modal } from '../../../components/ui/Modal';
import { Select } from '../../../components/ui/Select';
import { UpdateMachineInput } from '../hooks/useMachineCrud';
import { mapApiIssuesToErrors } from '../utils/apiErrors';

// E23 Batch 2 (FAT-183, N-14): default lini server (spec live PUT
// /machines `lineId?` — update bisa pindah lini; kosong = tidak berubah).
const DEFAULT_LINE_ID = 'LINE-01';

export interface MachineEditModalProps {
  machine: Machine | null;
  lines: ProductionLine[];
  onClose: () => void;
  onSubmit: (machineId: string, input: UpdateMachineInput) => Promise<void>;
}

export const MachineEditModal: React.FC<MachineEditModalProps> = ({
  machine,
  lines,
  onClose,
  onSubmit,
}) => {
  const [name, setName] = useState('');
  const [slaveId, setSlaveId] = useState(1);
  const [lineId, setLineId] = useState(DEFAULT_LINE_ID);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  // E23 Batch 2 (FAT-183, N-14): pilihan lini dari server; lini mesin saat
  // ini selalu tersedia sebagai opsi walau tak ada di daftar.
  const currentLine = machine?.line_id ?? DEFAULT_LINE_ID;
  const lineOptions = lines.some((l) => l.lineId === currentLine)
    ? lines
    : [{ lineId: currentLine, lineName: 'Lini saat ini' } as ProductionLine, ...lines];

  // Prefill dari prop machine (menggantikan prefill 4-setter di opener baris tabel).
  useEffect(() => {
    if (machine) {
      setName(machine.name);
      setSlaveId(machine.modbus_slave_id);
      setLineId(machine.line_id ?? DEFAULT_LINE_ID);
      setErrors({});
      setSubmitError(null);
    }
  }, [machine]);

  const handleSubmit = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!machine) return;
    const errs = validateMachineInput({
      machineName: name,
      modbusSlaveId: Number(slaveId),
      lineId,
      isCreate: false,
    });
    if (Object.keys(errs).length > 0) {
      setErrors(errs);
      return;
    }

    setIsSubmitting(true);
    setSubmitError(null);
    try {
      await onSubmit(machine.machine_id, { name, slaveId, lineId });
      onClose();
    } catch (err: any) {
      const fieldErrs = mapApiIssuesToErrors(err);
      if (Object.keys(fieldErrs).length > 0) setErrors(fieldErrs);
      setSubmitError(err?.message || 'Gagal memperbarui mesin.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Modal
      isOpen={Boolean(machine)}
      onClose={onClose}
      title={`Edit Mesin ${machine?.machine_id ?? ''}`}
      subtitle="Perbarui nama mesin, Modbus Slave ID, atau lini produksi. Perubahan relasi device hanya melalui Bind / Unbind."
      footer={
        <div className="flex items-center gap-2">
          <Button variant="ghost" onClick={onClose} disabled={isSubmitting}>
            Batal
          </Button>
          <Button onClick={handleSubmit} isLoading={isSubmitting}>
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
            label="Machine ID (Immutable)"
            value={machine?.machine_id ?? ''}
            disabled
            readOnly
          />
          <Input
            label="Edge Device Terikat (Read-Only)"
            value={machine?.bound_device_id ?? 'Unbound'}
            disabled
            readOnly
          />
        </div>
        <Input
          label="Nama Mesin"
          value={name}
          onChange={(e) => setName(e.target.value)}
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
        <Select
          id="edit-line-select"
          label="Lini Produksi"
          value={lineId}
          onChange={(e) => setLineId(e.target.value)}
          options={lineOptions.map((l) => ({ value: l.lineId, label: `${l.lineId} — ${l.lineName}` }))}
          error={errors.lineId}
        />
      </form>
    </Modal>
  );
};
