import React from 'react';
import { Database } from 'lucide-react';
import { Button } from '../ui/Button';

interface DataTableEmptyStateProps {
  emptyTitle: string;
  emptyDescription: string;
  emptyActionLabel?: string;
  onEmptyAction?: () => void;
}

/** State kosong saat tabel tidak punya baris. Dipindah dari DataTable.tsx (E32.6, FAT-287). */
export function DataTableEmptyState({
  emptyTitle,
  emptyDescription,
  emptyActionLabel,
  onEmptyAction,
}: DataTableEmptyStateProps) {
  return (
    <div className="p-10 text-center space-y-3">
      <Database className="w-7 h-7 text-slate-300 dark:text-slate-600 mx-auto" />
      <div className="space-y-1">
        <div className="text-sm font-semibold text-slate-700 dark:text-slate-200">
          {emptyTitle}
        </div>
        <p className="text-xs text-slate-500 dark:text-slate-400 max-w-md mx-auto">
          {emptyDescription}
        </p>
      </div>
      {emptyActionLabel && onEmptyAction && (
        <div>
          <Button size="sm" variant="secondary" onClick={onEmptyAction}>
            {emptyActionLabel}
          </Button>
        </div>
      )}
    </div>
  );
}
