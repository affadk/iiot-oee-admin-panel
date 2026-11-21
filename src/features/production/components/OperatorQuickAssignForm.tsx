import React, { useEffect, useState } from 'react';
import type { IamRole, ScopeLevel } from '../../../types/iam';
import { Button } from '../../../components/ui/Button';
import { Input } from '../../../components/ui/Input';
import { Select } from '../../../components/ui/Select';
import type { AssignRoleInput } from '../hooks/useOperatorRoleAssignment';

interface OperatorQuickAssignFormProps {
  operatorId: string;
  iamRoles: IamRole[];
  onAssignRole: (input: AssignRoleInput) => Promise<void>;
}

/**
 * Form quick-assign role di modal detail operator (E31.14, FAT-277 —
 * diekstrak dari OperatorDetailModal). Form state tinggal di dalam form
 * (R4); default role = role terakhir di `iamRoles` bila nilai saat ini
 * tidak ada di daftar (koreksi yang dulu di loadOperators).
 */
export const OperatorQuickAssignForm: React.FC<OperatorQuickAssignFormProps> = ({
  operatorId,
  iamRoles,
  onAssignRole,
}) => {
  const [quickAssignRoleName, setQuickAssignRoleName] = useState(() =>
    iamRoles.length > 0 && !iamRoles.some((r) => r.name === 'OPERATOR')
      ? iamRoles[iamRoles.length - 1].name
      : 'OPERATOR'
  );
  const [quickAssignScopeType, setQuickAssignScopeType] = useState<ScopeLevel>('ORGANIZATION');
  const [quickAssignScopeId, setQuickAssignScopeId] = useState('');
  const [isAssigningRole, setIsAssigningRole] = useState(false);
  const [assignError, setAssignError] = useState<string | null>(null);

  useEffect(() => {
    if (iamRoles.length > 0) {
      setQuickAssignRoleName((prev) =>
        iamRoles.some((r) => r.name === prev) ? prev : iamRoles[iamRoles.length - 1].name
      );
    }
  }, [iamRoles]);

  const handleQuickAssignRole = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isAssigningRole) return;
    if (quickAssignScopeType !== 'ORGANIZATION' && !quickAssignScopeId.trim()) {
      setAssignError('Scope ID wajib diisi untuk scope selain ORGANIZATION.');
      return;
    }
    setIsAssigningRole(true);
    setAssignError(null);
    try {
      await onAssignRole({
        roleName: quickAssignRoleName,
        scopeType: quickAssignScopeType,
        scopeId: quickAssignScopeId,
      });
      setQuickAssignScopeId('');
    } catch (err: unknown) {
      setAssignError(err instanceof Error ? err.message : 'Gagal menugaskan role.');
    } finally {
      setIsAssigningRole(false);
    }
  };

  return (
    <form
      onSubmit={handleQuickAssignRole}
      className="p-3 rounded border border-slate-200 dark:border-slate-700 space-y-3 bg-white dark:bg-slate-900"
    >
      <div className="font-semibold text-slate-900 dark:text-slate-100">
        Tambah Penugasan Role (Multi-Role Assignment)
      </div>
      {assignError && (
        <div
          role="alert"
          className="p-2.5 rounded border border-red-300 bg-red-50 dark:bg-red-950/40 dark:border-red-800 text-xs text-red-800 dark:text-red-200"
        >
          {assignError}
        </div>
      )}
      <div className="grid grid-cols-1 sm:grid-cols-12 gap-2">
        <Select
          id="quick-assign-role"
          label="Role"
          value={quickAssignRoleName}
          onChange={(e) => setQuickAssignRoleName(e.target.value)}
          options={iamRoles.map((r) => ({ value: r.name, label: r.name }))}
        />
        <Select
          id="quick-assign-scope"
          label="Scope"
          value={quickAssignScopeType}
          onChange={(e) => setQuickAssignScopeType(e.target.value as ScopeLevel)}
          options={[{ value: 'ORGANIZATION', label: 'ORGANIZATION (Efektif)' }, { value: 'SITE', label: 'SITE' }, { value: 'AREA', label: 'AREA' }, { value: 'LINE', label: 'LINE' }, { value: 'MACHINE', label: 'MACHINE' }, { value: 'DEVICE', label: 'DEVICE' }]}
        />
      </div>
      {quickAssignScopeType !== 'ORGANIZATION' && (
        <Input
          label="Scope ID"
          value={quickAssignScopeId}
          onChange={(e) => setQuickAssignScopeId(e.target.value)}
          placeholder="Contoh: LINE-01"
          required
        />
      )}
      <div className="flex justify-end">
        <Button type="submit" size="sm" isLoading={isAssigningRole}>
          Assign Role ke {operatorId}
        </Button>
      </div>
    </form>
  );
};
