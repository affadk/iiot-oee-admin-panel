import React from 'react';
import { RowData, flexRender } from '@tanstack/react-table';
import { LegacyTable } from '@tanstack/react-table/legacy';

interface DataTableGridProps<TData extends RowData> {
  table: LegacyTable<TData>;
  onRowClick?: (row: TData) => void;
  minTableWidthClass: string;
}

/** Grid tabel itu sendiri (thead/tbody + row-click). Dipindah dari DataTable.tsx (E32.6, FAT-287). */
export function DataTableGrid<TData extends RowData>({
  table,
  onRowClick,
  minTableWidthClass,
}: DataTableGridProps<TData>) {
  return (
    <div className="overflow-x-auto">
      <table className={`w-full text-left border-collapse ${minTableWidthClass}`}>
        <thead>
          {table.getHeaderGroups().map((headerGroup) => (
            <tr
              key={headerGroup.id}
              className="bg-slate-50 dark:bg-slate-950 border-b border-slate-200 dark:border-slate-800 text-[11px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider"
            >
              {headerGroup.headers.map((header) => (
                <th key={header.id} className="px-4 py-3 whitespace-nowrap">
                  {header.isPlaceholder
                    ? null
                    : flexRender(header.column.columnDef.header, header.getContext())}
                </th>
              ))}
            </tr>
          ))}
        </thead>
        <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-sm">
          {table.getRowModel().rows.map((row) => (
            <tr
              key={row.id}
              onClick={onRowClick ? () => onRowClick(row.original) : undefined}
              className={`hover:bg-slate-50/70 dark:hover:bg-slate-800/40 transition-colors ${
                onRowClick ? 'cursor-pointer' : ''
              }`}
            >
              {row.getVisibleCells().map((cell) => (
                <td key={cell.id} className="px-4 py-3 align-middle">
                  {flexRender(cell.column.columnDef.cell, cell.getContext())}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
