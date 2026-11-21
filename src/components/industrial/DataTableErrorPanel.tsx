import React from 'react';
import { AlertCircle, RefreshCw } from 'lucide-react';
import { Button } from '../ui/Button';
import { getErrorDisplay } from './dataTableError';

interface DataTableErrorPanelProps {
  error: unknown;
  onRetry?: () => void;
}

/** Panel error DataTable (role="alert") — dipindah dari DataTable.tsx (E32.6, FAT-287). */
export function DataTableErrorPanel({ error, onRetry }: DataTableErrorPanelProps) {
  const info = getErrorDisplay(error);
  return (
    <div
      role="alert"
      className="bg-white dark:bg-slate-900 border border-red-200 dark:border-red-900 rounded-lg p-6 text-sm"
    >
      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
        <div className="flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-red-600 dark:text-red-400 shrink-0 mt-0.5" />
          <div className="space-y-1">
            <div className="font-semibold text-red-900 dark:text-red-200">{info.title}</div>
            <p className="text-xs text-red-700 dark:text-red-300 leading-relaxed">{info.message}</p>
          </div>
        </div>
        {info.canRetry && onRetry && (
          <Button size="sm" variant="secondary" onClick={onRetry} className="shrink-0">
            <RefreshCw className="w-3.5 h-3.5" />
            Coba Lagi
          </Button>
        )}
      </div>
    </div>
  );
}
