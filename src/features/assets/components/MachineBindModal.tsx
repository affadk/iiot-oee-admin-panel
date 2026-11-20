import React from 'react';
import { Machine, EdgeDevice } from '../../../types/assets';
import { Button } from '../../../components/ui/Button';
import { Modal } from '../../../components/ui/Modal';
import { ConfirmationDialog } from '../../../components/ui/ConfirmationDialog';
import { Select } from '../../../components/ui/Select';

export interface MachineBindModalProps {
  machine: Machine | null;
  unboundDevices: EdgeDevice[];
  selectedDeviceId: string;
  onSelectDevice: (deviceId: string) => void;
  bindSubmitError: string | null;
  bindConfirmTarget: { machine: Machine; deviceId: string } | null;
  isBinding: boolean;
  onClose: () => void;
  onRequestConfirm: (e: React.FormEvent) => void;
  onCloseConfirm: () => void;
  onConfirm: () => void;
}

export const MachineBindModal: React.FC<MachineBindModalProps> = ({
  machine,
  unboundDevices,
  selectedDeviceId,
  onSelectDevice,
  bindSubmitError,
  bindConfirmTarget,
  isBinding,
  onClose,
  onRequestConfirm,
  onCloseConfirm,
  onConfirm,
}) => {
  return (
    <>
      <Modal
        isOpen={Boolean(machine)}
        onClose={onClose}
        title={`Pasang Perangkat Sensor ke ${machine?.machine_id ?? ''}`}
        subtitle="Pilih perangkat sensor unbound yang akan dihubungkan secara 1:1 ke mesin ini."
        footer={
          <div className="flex items-center gap-2">
            <Button variant="ghost" onClick={onClose} disabled={isBinding}>
              Batal
            </Button>
            <Button
              onClick={onRequestConfirm}
              isLoading={isBinding}
              disabled={!selectedDeviceId}
            >
              Lanjut Konfirmasi Bind
            </Button>
          </div>
        }
      >
        <form onSubmit={onRequestConfirm} className="space-y-4">
          {bindSubmitError && (
            <div role="alert" className="p-2.5 rounded border border-red-300 bg-red-50 dark:bg-red-950/40 dark:border-red-800 text-xs text-red-800 dark:text-red-200">
              {bindSubmitError}
            </div>
          )}
          <Select
            id="bind-device-select"
            label="Pilih STM32 Edge Controller (Unbound)"
            value={selectedDeviceId}
            onChange={(e) => onSelectDevice(e.target.value)}
            options={unboundDevices.length === 0 ? [{ value: '', label: '-- Tidak ada perangkat unbound tersedia --' }] : unboundDevices.map((d) => ({ value: d.device_id, label: `${d.device_id} (${d.model || 'STM32'} · ${d.mac_address})` }))}
          />
        </form>
      </Modal>

      <ConfirmationDialog
        isOpen={Boolean(bindConfirmTarget)}
        onClose={onCloseConfirm}
        onConfirm={onConfirm}
        title={`Konfirmasi Binding ${bindConfirmTarget?.deviceId ?? ''} → ${bindConfirmTarget?.machine.machine_id ?? ''}?`}
        variant="standard"
        description={`Perangkat ${bindConfirmTarget?.deviceId ?? ''} akan dihubungkan secara eksklusif (1:1) ke mesin ${bindConfirmTarget?.machine.name ?? ''}.`}
        impacts={[
          'Telemetri langsung dari perangkat akan mulai diarahkan ke mesin ini.',
          'Operasi ini mencatat event MACHINE_BOUND di Audit Trail dan Operational Events.',
        ]}
        confirmLabel="Ya, Ikatkan Perangkat"
        isLoading={isBinding}
      />
    </>
  );
};
