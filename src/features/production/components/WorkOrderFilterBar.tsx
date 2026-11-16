import React from 'react';
import { Search } from 'lucide-react';
import { Machine } from '../../../types/assets';
import { HistoryFilters } from '../../../types/historical';
import { WorkOrder } from '../../../types/production';
import { Button } from '../../../components/ui/Button';

interface WorkOrderFilterBarProps {
  filters: HistoryFilters;
  machines: Machine[];
  operatorsCount: number;
  onFilterChange: (patch: Partial<HistoryFilters>) => void;
  onResetFilters: () => void;
}

export const WorkOrderFilterBar: React.FC<WorkOrderFilterBarProps> = ({
  filters,
  machines,
  operatorsCount,
  onFilterChange,
  onResetFilters,
}) => {
  return (
    <div className="p-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
      <div className="relative">
        <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
        <input
          type="text"
          aria-label="Cari Work Order ID"
          value={filters.woId ?? ''}
          onChange={(e) => onFilterChange({ woId: e.target.value || undefined })}
          placeholder="Filter WO ID (mis. WO-2026-101)"
          className="w-full pl-9 pr-3 py-1.5 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-1 focus:ring-sky-500"
        />
      </div>

      <select
        aria-label="Filter Status"
        value={filters.status ?? 'ALL'}
        onChange={(e) =>
          onFilterChange({
            status: e.target.value === 'ALL' ? undefined : (e.target.value as WorkOrder['status']),
          })
        }
        className="px-3 py-1.5 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded text-slate-900 dark:text-slate-100"
      >
        <option value="ALL">Semua Status</option>
        <option value="PENDING">PENDING</option>
        <option value="ACTIVE">ACTIVE</option>
        <option value="COMPLETED">COMPLETED</option>
        <option value="ABORTED">ABORTED</option>
      </select>

      <select
        aria-label="Filter Mesin"
        value={filters.machineId ?? 'ALL'}
        onChange={(e) =>
          onFilterChange({
            machineId: e.target.value === 'ALL' ? undefined : e.target.value,
          })
        }
        className="px-3 py-1.5 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded text-slate-900 dark:text-slate-100"
      >
        <option value="ALL">Semua Mesin</option>
        {machines.map((m) => (
          <option key={m.machine_id} value={m.machine_id}>
            {m.machine_id} · {m.name}
          </option>
        ))}
      </select>

      <select
        aria-label="Limit Baris"
        value={String(filters.limit)}
        onChange={(e) => onFilterChange({ limit: Number(e.target.value) || 20 })}
        className="px-3 py-1.5 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded text-slate-900 dark:text-slate-100 font-tabular"
      >
        <option value="10">10 baris / halaman</option>
        <option value="20">20 baris / halaman</option>
        <option value="50">50 baris / halaman</option>
        <option value="100">100 baris / halaman</option>
      </select>

      <div className="flex items-center justify-end gap-2">
        <span className="text-[11px] text-slate-500 dark:text-slate-400 truncate">
          {operatorsCount > 0 ? `${operatorsCount} operator aktif` : 'Mode ringkas'}
        </span>
        <Button size="sm" variant="ghost" onClick={onResetFilters}>
          Reset
        </Button>
      </div>
    </div>
  );
};
