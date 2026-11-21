import { Search } from 'lucide-react';
import type { IamEffectivePermissions } from '../../../types/iam';
import type { Operator } from '../../../types/production';
import { Badge } from '../../../components/ui/Badge';
import { Button } from '../../../components/ui/Button';
import { Select } from '../../../components/ui/Select';

interface InspectorTabProps {
  operators: Operator[];
  inspectOperatorId: string;
  effectivePerms: IamEffectivePermissions | null;
  isInspecting: boolean;
  onOperatorChange: (operatorId: string) => void;
  onInspect: (e: React.FormEvent) => Promise<void>;
}

/**
 * Tab Pemeriksa Izin Pengguna (Static Preview · ADMIN-only).
 * Endpoint ini tidak mengevaluasi scope maupun atribut ABAC runtime dan
 * tidak digunakan sebagai gerbang UI.
 */
export const InspectorTab: React.FC<InspectorTabProps> = ({
  operators,
  inspectOperatorId,
  effectivePerms,
  isInspecting,
  onOperatorChange,
  onInspect,
}) => {
  return (
    <div className="space-y-4">
      <div className="p-3 rounded-lg bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900 text-xs text-amber-900 dark:text-amber-200 space-y-1">
        <div>
          <strong>Pemeriksa Izin Akun (Static Preview · ADMIN-only):</strong> Menampilkan ringkasan statis policy dari{' '}
          <code className="font-mono">GET /access-control/subjects/:operatorId/effective-permissions</code>.
        </div>
        <p>
          Catatan: endpoint ini <strong>tidak mengevaluasi scope maupun atribut ABAC runtime</strong> dan tidak digunakan sebagai gerbang UI. Keputusan izin UI sesi aktif selalu bersumber dari{' '}
          <code className="font-mono">GET /api/v1/auth/me</code> (<code className="font-mono">capabilities[]</code>).
        </p>
      </div>
      <form onSubmit={onInspect} className="flex flex-wrap items-end gap-3">
        <Select
          label="Pilih Operator / Subjek"
          value={inspectOperatorId}
          onChange={(e) => onOperatorChange(e.target.value)}
          options={operators.map((op) => ({ value: op.operator_id, label: `${op.operator_id} · ${op.name} (${op.role})` }))}
        />
        <Button type="submit" size="sm" isLoading={isInspecting}>
          <Search className="w-3.5 h-3.5" />
          <span>Periksa Izin Akun</span>
        </Button>
      </form>

      {effectivePerms && (
        <div className="p-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-md space-y-3 text-xs">
          <div className="flex flex-wrap items-center justify-between gap-2 pb-2 border-b border-slate-100 dark:border-slate-800">
            <div>
              <span className="font-bold text-sm text-slate-900 dark:text-slate-100 font-tabular">
                {effectivePerms.operatorId}
              </span>
              <span className="ml-2 text-slate-500">Primary: {effectivePerms.primaryRole}</span>
              <span className="ml-2 text-slate-500">
                {effectivePerms.isActive ? 'Aktif' : 'Nonaktif'}
                {effectivePerms.isProtected ? ' · Dilindungi' : ''}
                {' · '}authz v{effectivePerms.authzVersion}
                {effectivePerms.effectiveInMode ? ` · ${effectivePerms.effectiveInMode}` : ''}
              </span>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {/* E23 Batch 1 (FAT-176, N-7): spec live — `roles` adalah
                  string[]; badge terisi dari roles, detail scope dari
                  assignments[] di bawah. */}
              {effectivePerms.roles.map((role, i) => (
                <Badge key={i} variant="info">
                  {role}
                </Badge>
              ))}
            </div>
          </div>
          {effectivePerms.assignments.length > 0 && (
            <div className="space-y-1">
              <div className="font-semibold text-slate-700 dark:text-slate-300">
                Penugasan Peran (assignments)
              </div>
              {effectivePerms.assignments.map((a) => (
                <div key={a.id} className="flex flex-wrap items-center gap-2">
                  <Badge variant="info">{a.role_name}</Badge>
                  <span className="text-slate-500">
                    {a.scope_type}
                    {a.scope_id ? `: ${a.scope_id}` : ''}
                  </span>
                </div>
              ))}
            </div>
          )}
          <div className="space-y-1.5">
            {effectivePerms.permissions.length === 0 ? (
              <div className="text-slate-500 py-2">
                Tidak ada aturan policy eksplisit untuk peran operator ini (menggunakan baseline sistem jika berlaku).
              </div>
            ) : (
              effectivePerms.permissions.map((perm, idx) => (
                <div
                  key={idx}
                  className="p-2 rounded bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-800 flex flex-wrap items-center justify-between gap-2"
                >
                  <div className="flex items-center gap-2 font-mono">
                    <Badge variant={perm.effect === 'ALLOW' ? 'success' : 'danger'}>{perm.effect}</Badge>
                    <span>
                      {perm.action} → {perm.resourcePattern}
                    </span>
                  </div>
                  <span className="text-slate-500">
                    Sumber Peran: {perm.sourceRole}
                    {perm.abacCondition ? ` · ABAC: ${JSON.stringify(perm.abacCondition)}` : ''}
                  </span>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
};
