import { useMemo, useState } from 'react';
import type { IamAuditDecision } from '../../../types/iam';
import { Badge } from '../../../components/ui/Badge';

interface AuditTabProps {
  decisions: IamAuditDecision[];
}

/** Tab Riwayat Pemeriksaan: tabel keputusan otorisasi. Search + memo tinggal di tab ini. */
export const AuditTab: React.FC<AuditTabProps> = ({ decisions }) => {
  const [auditSearch, setAuditSearch] = useState('');

  const filteredDecisions = useMemo(() => {
    const q = auditSearch.trim().toLowerCase();
    if (!q) return decisions;
    return decisions.filter(
      (d) =>
        d.subject.toLowerCase().includes(q) ||
        d.action.toLowerCase().includes(q) ||
        d.resource.toLowerCase().includes(q) ||
        d.decision.toLowerCase().includes(q) ||
        (d.reason ?? '').toLowerCase().includes(q)
    );
  }, [decisions, auditSearch]);

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-2">
        <input
          type="search"
          aria-label="Cari riwayat keputusan otorisasi"
          value={auditSearch}
          onChange={(e) => setAuditSearch(e.target.value)}
          placeholder="Cari subjek, keputusan, action, atau resource..."
          className="w-72 px-3 py-1.5 text-xs bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded text-slate-900 dark:text-slate-100"
        />
        <span className="text-[11px] text-slate-500">
          Menampilkan {filteredDecisions.length} dari {decisions.length} keputusan
        </span>
      </div>
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-md overflow-hidden">
        <table className="w-full text-left border-collapse text-xs">
          <thead>
            <tr className="border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/50 text-[11px] font-semibold uppercase text-slate-500">
              <th className="py-2.5 px-4">Waktu</th>
              <th className="py-2.5 px-4">Subjek</th>
              <th className="py-2.5 px-4">Keputusan</th>
              <th className="py-2.5 px-4">Action &amp; Resource</th>
              <th className="py-2.5 px-4">Alasan</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
            {filteredDecisions.map((d) => (
              <tr key={d.id}>
                <td className="py-2.5 px-4 font-tabular text-slate-500">
                  {new Date(d.timestamp).toLocaleString()}
                </td>
                <td className="py-2.5 px-4 font-tabular font-semibold text-slate-900 dark:text-slate-100">
                  {d.subject}
                </td>
                <td className="py-2.5 px-4">
                  <Badge variant={d.decision === 'ALLOW' ? 'success' : 'danger'}>
                    {d.decision} ({d.mode})
                  </Badge>
                </td>
                <td className="py-2.5 px-4 font-mono text-[11px]">
                  <div>{d.action}</div>
                  <div className="text-slate-500">{d.resource}</div>
                </td>
                <td className="py-2.5 px-4 text-slate-600 dark:text-slate-300">{d.reason || '-'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};
