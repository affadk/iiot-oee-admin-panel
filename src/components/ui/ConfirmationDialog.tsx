import React from 'react';
import { AlertTriangle, ShieldAlert, Info } from 'lucide-react';
import { Modal } from './Modal';
import { Button } from './Button';

export type ConfirmationVariant = 'standard' | 'destructive' | 'service-impact';

interface ConfirmationDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void | Promise<void>;
  title: string;
  subtitle?: string;
  description: string;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: ConfirmationVariant;
  isLoading?: boolean;
  impacts?: string[];
  children?: React.ReactNode;
}

export const ConfirmationDialog: React.FC<ConfirmationDialogProps> = ({
  isOpen,
  onClose,
  onConfirm,
  title,
  subtitle,
  description,
  confirmLabel = 'Konfirmasi',
  cancelLabel = 'Batal',
  variant = 'standard',
  isLoading = false,
  impacts,
  children,
}) => {
  const handleClose = () => {
    // Spec §6.1: Dialog does not close while operation is in flight
    if (isLoading) return;
    onClose();
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleClose}
      title={title}
      subtitle={subtitle}
      maxWidth="md"
      footer={
        <div className="flex items-center gap-3">
          <Button variant="ghost" onClick={handleClose} disabled={isLoading}>
            {cancelLabel}
          </Button>
          <Button
            variant={variant === 'destructive' ? 'danger' : 'primary'}
            onClick={onConfirm}
            isLoading={isLoading}
          >
            {confirmLabel}
          </Button>
        </div>
      }
    >
      <div className="space-y-4">
        <div
          className={`p-3.5 rounded-lg border text-xs flex items-start gap-3 ${
            variant === 'destructive'
              ? 'bg-red-50 dark:bg-red-950/40 border-red-200 dark:border-red-900 text-red-800 dark:text-red-200'
              : variant === 'service-impact'
              ? 'bg-amber-50 dark:bg-amber-950/40 border-amber-200 dark:border-amber-900 text-amber-800 dark:text-amber-200'
              : 'bg-sky-50 dark:bg-sky-950/40 border-sky-200 dark:border-sky-900 text-sky-800 dark:text-sky-200'
          }`}
        >
          {variant === 'destructive' ? (
            <AlertTriangle className="w-4 h-4 text-red-600 dark:text-red-400 shrink-0 mt-0.5" />
          ) : variant === 'service-impact' ? (
            <ShieldAlert className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
          ) : (
            <Info className="w-4 h-4 text-sky-600 dark:text-sky-400 shrink-0 mt-0.5" />
          )}
          <div className="space-y-1.5">
            <p className="font-medium leading-relaxed">{description}</p>
            {impacts && impacts.length > 0 && (
              <ul className="list-disc pl-4 space-y-0.5 text-[11px] opacity-90">
                {impacts.map((imp, i) => (
                  <li key={i}>{imp}</li>
                ))}
              </ul>
            )}
          </div>
        </div>

        {children}
      </div>
    </Modal>
  );
};
