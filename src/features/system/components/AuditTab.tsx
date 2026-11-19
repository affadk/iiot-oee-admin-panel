import { useState } from 'react';
import type { IamAuditDecision, IamAuditFilters } from '../../../types/iam';
import { Badge } from '../../../components/ui/Badge';
import { Button } from '../../../components/ui/Button';

interface AuditTabProps {
  decisions: IamAuditDecision[];
  /** Filter server-side (§3.4: subject/decision/mode/from/to). */
  onApplyFilters: (filters: IamAuditFilters) => Promise<void> | void;
}

/**
 * Tab Riwayat Pemeriksaan: tabel keputusan otorisasi dengan filter
 * server-side (§3.4). Filter dikirim sebagai query ke GET
 * /access-control/audit — bukan search client-side atas halaman yang
 * sudah dimuat.
 */
export const AuditTab: React.FC<AuditTabProps> = ({ decisions, onApplyFilters }) => {
  const [subject, setSubject] = useState('');
  const [decision, setDecision] = useState<'ALL' | 'ALLOW' | 'DENY'>('ALL');
  const [mode, setMode] = useState<'ALL' | 'shadow' | 'enforce'>('ALL');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [isApplying, setIsApplying] = useState(false);

  const applyFilters = async () => {
    setIsApplying(true);
    try {
      await onApplyFilters({
        subject: subject.trim() || undefined,
        decision: decision === 'ALL' ? undefined : decision,
        mode: mode === 'ALL' ? undefined : mode,
        from: from ? new Date(from).toISOString() : undefined,
        to: to ? new Date(to).toISOString() : undefined,
      });
    } finally {
      setIsApplying(false);
    }
  };

  const resetFilters = async () => {
    setSubject('');
    setDecision('ALL');
    setMode('ALL');
    setFrom('');
    setTo('');
    setIsApplying(true);
    try {
      await onApplyFilters({});
    } finally {
      setIsApplying(false);
    }
  };

  return (
    <div className="space-y-3">
      <form
        className="flex flex-wrap items-end gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          void applyFilters();
        }}
      >
        <div>
          <label className="block text-[11px] font-semibold text-slate-500 mb-1">Subjek</label>
          <input
            type="search"
            aria-label="Filter subjek"
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            placeholder="Operator ID..."
            className="w-44 px-3 py-1.5 text-xs bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded text-slate-900 dark:text-slate-100"
          />
        </div>
        <div>
          <label className="block text-[11px] font-semibold text-slate-500 mb-1">Keputusan</label>
          <select
            aria-label="Filter keputusan"
            value={decision}
            onChange={(e) => setDecision(e.target.value as 'ALL' | 'ALLOW' | 'DENY')}
            className="px-3 py-1.5 text-xs bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded text-slate-900 dark:text-slate-100"
          >
            <option value="ALL">Semua</option>
            <option value="ALLOW">ALLOW</option>
            <option value="DENY">DENY</option>
          </select>
        </div>
        <div>
          <label className="block text-[11px] font-semibold text-slate-500 mb-1">Mode</label>
          <select
            aria-label="Filter mode"
            value={mode}
            onChange={(e) => setMode(e.target.value as 'ALL' | 'shadow' | 'enforce')}
            className="px-3 py-1.5 text-xs bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded text-slate-900 dark:text-slate-100"
          >
            <option value="ALL">Semua</option>
            <option value="shadow">shadow</option>
            <option value="enforce">enforce</option>
          </select>
        </div>
        <div>
          <label className="block text-[11px] font-semibold text-slate-500 mb-1">Dari</label>
          <input
            type="datetime-local"
            aria-label="Filter dari tanggal"
            value={from}
            onChange={(e) => setFrom(e.target.value)}
            className="px-3 py-1.5 text-xs bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded text-slate-900 dark:text-slate-100"
          />
        </div>
        <div>
          <label className="block text-[11px] font-semibold text-slate-500 mb-1">Sampai</label>
          <input
            type="datetime-local"
            aria-label="Filter sampai tanggal"
            value={to}
            onChange={(e) => setTo(e.target.value)}
            className="px-3 py-1.5 text-xs bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded text-slate-900 dark:text-slate-100"
          />
        </div>
        <Button type="submit" size="sm" isLoading={isApplying}>
          Terapkan
        </Button>
        <Button type="button" size="sm" variant="ghost" onClick={() => void resetFilters()} disabled={isApplying}>
          Reset
        </Button>
        <span className="text-[11px] text-slate-500 ml-auto">
          Menampilkan {decisions.length} keputusan
        </span>
      </form>
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
            {decisions.map((d) => (
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
