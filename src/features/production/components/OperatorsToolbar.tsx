import React from 'react';
import { Select } from '../../../components/ui/Select';
import { IamRole } from '../../../types/iam';
import { ALL_ROLES } from '../hooks/useOperators';

export interface OperatorsToolbarProps {
  searchQuery: string;
  onSearchQueryChange: (value: string) => void;
  roleFilter: string;
  onRoleFilterChange: (value: string) => void;
  statusFilter: 'ALL' | 'ACTIVE' | 'SUSPENDED';
  onStatusFilterChange: (value: 'ALL' | 'ACTIVE' | 'SUSPENDED') => void;
  iamRoles: IamRole[];
  shownCount: number;
  totalCount: number;
}

// E31.9 (FAT-272) BYPASS (parsial): toolbar ini TIDAK memakai cangkang
// FilterBar — ia baris toolbar tanpa kartu (bukan panel filter berkartu).
// Input pencariannya juga varian sendiri: type="search", lebar tetap w-60,
// bg-white (bukan bg-slate-50 seperti FilterSearchField) — memaksakan
// FilterSearchField akan mengubah tampilan input. Kedua Select sudah
// memakai ui/Select (E31.6). Bila toolbar ini kelak butuh kartu, pakai
// FilterBar sebagai cangkang dan biarkan input pencarian apa adanya.
/** Toolbar search & filter (R9.5, dipindah dari OperatorsPage L439–484). Murni presentasional. */
export const OperatorsToolbar: React.FC<OperatorsToolbarProps> = ({
  searchQuery,
  onSearchQueryChange,
  roleFilter,
  onRoleFilterChange,
  statusFilter,
  onStatusFilterChange,
  iamRoles,
  shownCount,
  totalCount,
}) => {
  return (
    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
      <div className="flex flex-wrap items-center gap-2">
        <input
          type="search"
          aria-label="Cari operator"
          value={searchQuery}
          onChange={(e) => onSearchQueryChange(e.target.value)}
          placeholder="Cari ID, nama, atau line..."
          className="w-60 px-3 py-1.5 text-xs bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded text-slate-900 dark:text-slate-100"
        />
        <Select
          aria-label="Filter peran operator"
          wrapperClassName="shrink-0"
          value={roleFilter}
          onChange={(e) => onRoleFilterChange(e.target.value)}
          options={[{ value: 'ALL', label: 'Semua Peran' }, ...ALL_ROLES.map((r) => ({ value: r, label: r })), ...iamRoles
            .filter((r) => !r.is_system).map((r) => ({ value: r.name, label: `${r.name} (Custom)` }))]}
        />
        <Select
          aria-label="Filter status operator"
          wrapperClassName="shrink-0"
          value={statusFilter}
          onChange={(e) => onStatusFilterChange(e.target.value as 'ALL' | 'ACTIVE' | 'SUSPENDED')}
          options={[{ value: 'ALL', label: 'Semua Status' }, { value: 'ACTIVE', label: 'ACTIVE' }, { value: 'SUSPENDED', label: 'SUSPENDED' }]}
        />
      </div>
      <span className="text-[11px] text-slate-500">
        Menampilkan {shownCount} dari {totalCount} operator
      </span>
    </div>
  );
};
