import React, { useEffect, useState } from 'react';
import { OperationalEvent } from '../../../types/monitoring';
import { Button } from '../../../components/ui/Button';
import { Modal } from '../../../components/ui/Modal';

export interface OperationalEventAckModalProps {
  target: OperationalEvent | null;
  isSubmitting: boolean;
  onClose: () => void;
  onConfirmAck: (note: string) => void;
}

export const OperationalEventAckModal: React.FC<OperationalEventAckModalProps> = ({
  target,
  isSubmitting,
  onClose,
  onConfirmAck,
}) => {
  // Perilaku asli: ackNote selalu mulai kosong ('') dan tidak pernah
  // di-prefill dari ev.ack_note — jangan isi dari target.
  const [ackNote, setAckNote] = useState('');

  useEffect(() => {
    setAckNote('');
  }, [target]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onConfirmAck(ackNote);
  };

  return (
    <Modal
      isOpen={Boolean(target)}
      onClose={onClose}
      title={`Acknowledge Event ${target?.id ?? ''}`}
      subtitle={target ? `${target.event_type} · ${target.machine_name}` : undefined}
      footer={
        <div className="flex items-center gap-2">
          <Button variant="ghost" onClick={onClose} disabled={isSubmitting}>
            Batal
          </Button>
          <Button
            onClick={() => {
              void onConfirmAck(ackNote);
            }}
            isLoading={isSubmitting}
          >
            Simpan Acknowledgment
          </Button>
        </div>
      }
    >
      <form onSubmit={handleSubmit} className="space-y-3">
        <p className="text-xs text-slate-600 dark:text-slate-300 p-2.5 bg-slate-50 dark:bg-slate-800/50 rounded border border-slate-200 dark:border-slate-800">
          {target?.description}
        </p>
        <div>
          <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
            Catatan Tindak Lanjut (Opsional, maks 1000 karakter)
          </label>
          <textarea
            rows={3}
            maxLength={1000}
            value={ackNote}
            onChange={(e) => setAckNote(e.target.value)}
            placeholder="Contoh: Tim maintenance telah memeriksa sensor aliran coolant..."
            className="w-full px-3 py-2 text-sm bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded text-slate-900 dark:text-slate-100"
          />
          <div className="text-[11px] text-slate-400 text-right font-tabular mt-0.5">
            {ackNote.length}/1000
          </div>
        </div>
      </form>
    </Modal>
  );
};
