import { Search } from 'lucide-react';
import type { IamEffectivePermissions } from '../../../types/iam';
import type { Operator } from '../../../types/production';
import { Badge } from '../../../components/ui/Badge';
import { Button } from '../../../components/ui/Button';

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
        <div className="w-64">
          <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
            Pilih Operator / Subjek
          </label>
          <select
            value={inspectOperatorId}
            onChange={(e) => onOperatorChange(e.target.value)}
            className="w-full px-3 py-2 text-xs bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded text-slate-900 dark:text-slate-100"
          >
            {operators.map((op) => (
              <option key={op.operator_id} value={op.operator_id}>
                {op.operator_id} · {op.name} ({op.role})
              </option>
            ))}
          </select>
        </div>
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
            </div>
            <div className="flex flex-wrap gap-1.5">
              {effectivePerms.effectiveRoles.map((er, i) => (
                <Badge key={i} variant="info">
                  {er.roleName} ({er.scopeType}{er.scopeId ? `: ${er.scopeId}` : ''})
                </Badge>
              ))}
            </div>
          </div>
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
                  <span className="text-slate-500">Sumber Peran: {perm.sourceRole}</span>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
};
