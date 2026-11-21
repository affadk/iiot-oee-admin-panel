import React from 'react';
import { Operator } from '../../../types/production';
import { IamAssignment } from '../../../types/iam';
import { UserRole } from '../../../types/auth';
import { CapabilityKey } from '../../../utils/capabilities';
import { DataTable } from '../../../components/industrial/DataTable';
import { useOperatorColumns } from './OperatorColumns';

export interface OperatorsTableProps {
  operators: Operator[];
  assignments: IamAssignment[];
  isLoading: boolean;
  currentUserRole: UserRole;
  togglingId: string | null;
  /** Dipanggil per baris di dalam cell renderer — JANGAN precompute boolean, JANGAN useAuth di sini. */
  checkCapability: (capability: CapabilityKey, resourceId?: string) => {
    canInteract: boolean;
    reason?: string;
  };
  onDetail: (operatorId: string) => void;
  onToggle: (op: Operator) => void;
  onEdit: (op: Operator) => void;
  onRotatePwd: (op: Operator) => void;
  onDelete: (op: Operator) => void;
}

// E31.10 (FAT-273): tabel hand-rolled → DataTable (aturan R1).
// E32.7 (FAT-288): definisi kolom dipindah ke OperatorColumns.tsx
// (useOperatorColumns) — komponen ini hanya shell DataTable.
/** Tabel operator (R9.5, dipindah dari OperatorsPage L486–648). */
export const OperatorsTable: React.FC<OperatorsTableProps> = ({
  operators,
  assignments,
  isLoading,
  currentUserRole,
  togglingId,
  checkCapability,
  onDetail,
  onToggle,
  onEdit,
  onRotatePwd,
  onDelete,
}) => {
  const columns = useOperatorColumns({
    assignments,
    togglingId,
    checkCapability,
    onDetail,
    onToggle,
    onEdit,
    onRotatePwd,
    onDelete,
  });

  return (
    <DataTable
      data={operators}
      columns={columns}
      getRowId={(op) => op.operator_id}
      isLoading={isLoading}
      emptyTitle="Tidak ada operator yang sesuai filter."
    />
  );
};
