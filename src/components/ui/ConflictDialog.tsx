import React from 'react';
import { Link } from 'react-router-dom';
import { AlertTriangle, ExternalLink } from 'lucide-react';
import { Modal } from './Modal';
import { Button } from './Button';

export interface ConflictDialogState {
  open: boolean;
  code?: string;
  title?: string;
  message: string;
  activeWoId?: string;
}

interface ConflictDialogProps {
  conflict: ConflictDialogState | null;
  onClose: () => void;
}

export const ConflictDialog: React.FC<ConflictDialogProps> = ({ conflict, onClose }) => {
  if (!conflict || !conflict.open) return null;

  return (
    <Modal
      isOpen={conflict.open}
      onClose={onClose}
      title={conflict.title ?? 'Konflik Operasi (409 Conflict)'}
      maxWidth="md"
    >
      <div className="space-y-4">
        <div className="flex items-start gap-3 p-3.5 rounded-lg bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 text-amber-950 dark:text-amber-200">
          <AlertTriangle className="w-5 h-5 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
          <div className="space-y-1.5 text-sm">
            {conflict.code && (
              <div className="text-xs font-mono font-semibold text-amber-800 dark:text-amber-300">
                Kode: {conflict.code}
              </div>
            )}
            <p className="leading-relaxed">{conflict.message}</p>
          </div>
        </div>

        {conflict.activeWoId && (
          <div className="p-3.5 rounded-lg bg-slate-50 dark:bg-slate-800/70 border border-slate-200 dark:border-slate-700 flex items-center justify-between gap-3">
            <div className="text-xs space-y-0.5">
              <div className="text-slate-500 dark:text-slate-400">Work Order Aktif Terkait</div>
              <div className="font-mono font-semibold text-slate-900 dark:text-slate-100">
                {conflict.activeWoId}
              </div>
            </div>
            <Link
              to={`/work-orders?wo_id=${encodeURIComponent(conflict.activeWoId)}`}
              onClick={onClose}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-sky-600 hover:bg-sky-700 text-white text-xs font-medium whitespace-nowrap shrink-0 transition-colors"
            >
              <span>Buka Work Order</span>
              <ExternalLink className="w-3.5 h-3.5" />
            </Link>
          </div>
        )}

        <div className="flex justify-end pt-2 border-t border-slate-200 dark:border-slate-800">
          <Button variant="secondary" onClick={onClose}>
            Tutup
          </Button>
        </div>
      </div>
    </Modal>
  );
};
