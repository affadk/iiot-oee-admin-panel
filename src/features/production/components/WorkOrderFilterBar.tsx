import React from 'react';
import { Machine } from '../../../types/assets';
import { HistoryFilters } from '../../../types/historical';
import { WorkOrder } from '../../../types/production';
import { Select } from '../../../components/ui/Select';
import { FilterBar, FilterResetButton, FilterSearchField } from '../../../components/industrial/FilterBar';

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
    <FilterBar layout="grid" columns={5}>
      <FilterSearchField
        ariaLabel="Cari Work Order ID"
        value={filters.woId ?? ''}
        onChange={(v) => onFilterChange({ woId: v || undefined })}
        placeholder="Filter WO ID (mis. WO-2026-101)"
      />

      <Select
        aria-label="Filter Status"
        wrapperClassName="shrink-0"
        value={filters.status ?? 'ALL'}
        onChange={(e) =>
          onFilterChange({
            status: e.target.value === 'ALL' ? undefined : (e.target.value as WorkOrder['status']),
          })}
        options={[{ value: 'ALL', label: 'Semua Status' }, { value: 'PENDING', label: 'PENDING' }, { value: 'ACTIVE', label: 'ACTIVE' }, { value: 'PENDING_CLOSE', label: 'PENDING_CLOSE' }, { value: 'COMPLETED', label: 'COMPLETED' }, { value: 'ABORTED', label: 'ABORTED' }]}
      />

      <Select
        aria-label="Filter Mesin"
        wrapperClassName="shrink-0"
        value={filters.machineId ?? 'ALL'}
        onChange={(e) =>
          onFilterChange({
            machineId: e.target.value === 'ALL' ? undefined : e.target.value,
          })}
        options={[{ value: 'ALL', label: 'Semua Mesin' }, ...machines.map((m) => ({ value: m.machine_id, label: `${m.machine_id} · ${m.name}` }))]}
      />

      <Select
        aria-label="Limit Baris"
        wrapperClassName="shrink-0"
        value={String(filters.limit)}
        onChange={(e) => onFilterChange({ limit: Number(e.target.value) || 20 })}
        options={[{ value: '10', label: '10 baris / halaman' }, { value: '20', label: '20 baris / halaman' }, { value: '50', label: '50 baris / halaman' }, { value: '100', label: '100 baris / halaman' }]}
      />

      <div className="flex items-center justify-end gap-2">
        <span className="text-[11px] text-slate-500 dark:text-slate-400 truncate">
          {operatorsCount > 0 ? `${operatorsCount} operator aktif` : 'Mode ringkas'}
        </span>
        <FilterResetButton onReset={onResetFilters} />
      </div>
    </FilterBar>
  );
};
