import { useMemo, useState } from 'react';
import { Edit3, Plus, Trash2 } from 'lucide-react';
import type { IamPolicyRule } from '../../../types/iam';
import { policyTargetsAdmin } from '../../../utils/capabilities';
import { Badge } from '../../../components/ui/Badge';
import { Button } from '../../../components/ui/Button';

interface PoliciesTabProps {
  policies: IamPolicyRule[];
  isSubmitting: boolean;
  onOpenCreatePolicy: () => void;
  onEditPolicy: (policy: IamPolicyRule) => void;
  onTogglePolicy: (policy: IamPolicyRule) => void;
  onDeletePolicy: (policy: IamPolicyRule) => void;
}

/** Tab Aturan Kebijakan: tabel policy. Search + memo tinggal di tab ini. */
export const PoliciesTab: React.FC<PoliciesTabProps> = ({
  policies,
  isSubmitting,
  onOpenCreatePolicy,
  onEditPolicy,
  onTogglePolicy,
  onDeletePolicy,
}) => {
  const [policySearch, setPolicySearch] = useState('');

  const filteredPolicies = useMemo(() => {
    const q = policySearch.trim().toLowerCase();
    if (!q) return policies;
    return policies.filter(
      (p) =>
        p.roleName.toLowerCase().includes(q) ||
        p.subjectMatch.toLowerCase().includes(q) ||
        p.action.toLowerCase().includes(q) ||
        p.resourcePattern.toLowerCase().includes(q)
    );
  }, [policies, policySearch]);

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <input
            type="search"
            aria-label="Cari aturan kebijakan"
            value={policySearch}
            onChange={(e) => setPolicySearch(e.target.value)}
            placeholder="Cari role, action, resource..."
            className="w-60 px-3 py-1.5 text-xs bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded text-slate-900 dark:text-slate-100"
          />
          <span className="text-xs text-slate-500">
            Aturan pemberian (ALLOW) atau pembatasan (DENY) akses beserta syarat area kerja.
          </span>
        </div>
        <Button size="sm" onClick={onOpenCreatePolicy}>
          <Plus className="w-3.5 h-3.5" />
          <span>Tambah Aturan</span>
        </Button>
      </div>
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-md overflow-hidden">
        <table className="w-full text-left border-collapse text-xs">
          <thead>
            <tr className="border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/50 text-[11px] font-semibold uppercase text-slate-500">
              <th className="py-2.5 px-4">Role &amp; Effect</th>
              <th className="py-2.5 px-4">Action / Resource Pattern</th>
              <th className="py-2.5 px-4">Syarat Tambahan</th>
              <th className="py-2.5 px-4">Status</th>
              <th className="py-2.5 px-4 text-right">Aksi</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
            {filteredPolicies.map((pol) => {
              const isAdminProtected = policyTargetsAdmin(pol.subjectMatch);
              return (
                <tr key={pol.id}>
                  <td className="py-2.5 px-4">
                    <div className="font-semibold text-slate-900 dark:text-slate-100">{pol.roleName}</div>
                    <div className="text-[11px] text-slate-500 font-mono">{pol.subjectMatch}</div>
                    <Badge variant={pol.effect === 'ALLOW' ? 'success' : 'danger'}>{pol.effect}</Badge>
                  </td>
                  <td className="py-2.5 px-4 font-mono text-[11px]">
                    <div>{pol.action}</div>
                    <div className="text-slate-500">{pol.resourcePattern}</div>
                  </td>
                  <td className="py-2.5 px-4 font-mono text-[11px] text-slate-600 dark:text-slate-300">
                    {pol.abacCondition
                      ? typeof pol.abacCondition === 'string'
                        ? pol.abacCondition
                        : JSON.stringify(pol.abacCondition)
                      : '—'}
                  </td>
                  <td className="py-2.5 px-4">
                    <Badge variant={pol.enabled ? 'success' : 'neutral'}>
                      {pol.enabled ? 'ACTIVE' : 'DISABLED'}
                    </Badge>
                  </td>
                  <td className="py-2.5 px-4 text-right space-x-1.5">
                    <Button
                      size="sm"
                      variant="outline"
                      aria-label={`Edit policy ${pol.id}`}
                      disabled={isAdminProtected || isSubmitting}
                      onClick={() => onEditPolicy(pol)}
                    >
                      <Edit3 className="w-3.5 h-3.5" />
                      <span>Edit</span>
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={isAdminProtected || isSubmitting}
                      onClick={() => onTogglePolicy(pol)}
                    >
                      {pol.enabled ? 'Disable' : 'Enable'}
                    </Button>
                    <Button
                      size="sm"
                      variant="danger"
                      aria-label={`Hapus policy ${pol.id}`}
                      disabled={isAdminProtected || isSubmitting}
                      onClick={() => onDeletePolicy(pol)}
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </Button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
};
