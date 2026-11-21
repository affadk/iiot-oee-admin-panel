import { useMemo, useState } from 'react';
import type { IamAuditDecision, IamAuditFilters } from '../../../types/iam';
import { LegacyColumnDef as ColumnDef } from '@tanstack/react-table/legacy';
import { Badge } from '../../../components/ui/Badge';
import { Button } from '../../../components/ui/Button';
import { DataTable } from '../../../components/industrial/DataTable';
import { Select } from '../../../components/ui/Select';
import { formatDateTime } from '../../../utils/formatDate';

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

  // E31.10 (FAT-273): tabel hand-rolled → DataTable (aturan R1). Render
  // kustom per kolom dipindahkan ke ColumnDef.cell. Catatan: tabel lama
  // tidak punya empty state (daftar kosong = header saja); DataTable
  // menampilkan empty state standar — teks netral di bawah.
  const columns = useMemo<ColumnDef<IamAuditDecision, unknown>[]>(
    () => [
      {
        id: 'timestamp',
        header: 'Waktu',
        cell: ({ row }) => (
          <div className="text-xs font-tabular text-slate-500">
            {formatDateTime(row.original.timestamp)}
          </div>
        ),
      },
      {
        id: 'subject',
        header: 'Subjek',
        cell: ({ row }) => (
          <div className="text-xs font-tabular font-semibold text-slate-900 dark:text-slate-100">
            {row.original.subject}
          </div>
        ),
      },
      {
        id: 'decision',
        header: 'Keputusan',
        cell: ({ row }) => {
          const d = row.original;
          return (
            <Badge variant={d.decision === 'ALLOW' ? 'success' : 'danger'}>
              {d.decision} ({d.mode})
            </Badge>
          );
        },
      },
      {
        id: 'action',
        header: 'Action & Resource',
        cell: ({ row }) => {
          const d = row.original;
          return (
            <div className="text-xs font-mono text-[11px]">
              <div>{d.action}</div>
              <div className="text-slate-500">{d.resource}</div>
            </div>
          );
        },
      },
      {
        id: 'reason',
        header: 'Alasan',
        cell: ({ row }) => (
          <div className="text-xs text-slate-600 dark:text-slate-300">
            {row.original.reason || '-'}
          </div>
        ),
      },
    ],
    [],
  );

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
        <Select
          label="Keputusan"
          value={decision}
          onChange={(e) => setDecision(e.target.value as 'ALL' | 'ALLOW' | 'DENY')}
          options={[{ value: 'ALL', label: 'Semua' }, { value: 'ALLOW', label: 'ALLOW' }, { value: 'DENY', label: 'DENY' }]}
        />
        <Select
          label="Mode"
          value={mode}
          onChange={(e) => setMode(e.target.value as 'ALL' | 'shadow' | 'enforce')}
          options={[{ value: 'ALL', label: 'Semua' }, { value: 'shadow', label: 'shadow' }, { value: 'enforce', label: 'enforce' }]}
        />
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
      <DataTable
        data={decisions}
        columns={columns}
        getRowId={(d) => d.id}
        emptyTitle="Belum ada keputusan audit"
        emptyDescription="Tidak ada keputusan otorisasi yang cocok dengan filter."
      />
    </div>
  );
};
