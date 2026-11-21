import React from 'react';

interface DataTableSkeletonProps {
  skeletonRowCount: number;
}

/** Baris skeleton saat tabel memuat. Dipindah dari DataTable.tsx (E32.6, FAT-287). */
export function DataTableSkeleton({ skeletonRowCount }: DataTableSkeletonProps) {
  return (
    <div className="p-4 space-y-2.5" aria-busy="true" aria-label="Memuat baris tabel">
      {Array.from({ length: skeletonRowCount }).map((_, idx) => (
        <div
          key={idx}
          className="h-10 rounded bg-slate-100 dark:bg-slate-800/70 animate-pulse"
        />
      ))}
    </div>
  );
}
