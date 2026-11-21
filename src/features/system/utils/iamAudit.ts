import type { IamAuditDecision, IamAuditFilters } from '../../../types/iam';

/** P33.6 (FAT-301): ukuran halaman paginasi client-side Audit IAM. */
export const IAM_AUDIT_PAGE_SIZE = 25;

export interface IamAuditClientFilters {
  resourceQuery: string;
  actionQuery: string;
}

/**
 * Filter client-side atas daftar yang sudah dimuat (Resource/Action).
 * Server (GET /access-control/audit) hanya mendukung filter
 * subject/decision/mode/from/to — filter teks Resource/Action belum ada di
 * kontrak, jadi disaring di panel. Pencarian substring, tidak sensitif
 * huruf besar/kecil; query kosong = tanpa filter.
 */
export function filterIamAuditByResourceAction(
  decisions: readonly IamAuditDecision[],
  filters: IamAuditClientFilters,
): IamAuditDecision[] {
  const resource = filters.resourceQuery.trim().toLowerCase();
  const action = filters.actionQuery.trim().toLowerCase();
  if (!resource && !action) return [...decisions];
  return decisions.filter(
    (d) =>
      (!resource || d.resource.toLowerCase().includes(resource)) &&
      (!action || d.action.toLowerCase().includes(action)),
  );
}

export interface IamAuditPageSlice {
  pageRows: IamAuditDecision[];
  /** Nomor halaman efektif (0-based) setelah clamp ke rentang yang ada. */
  pageIndex: number;
  pageCount: number;
  hasMore: boolean;
  hasPrev: boolean;
}

/**
 * Paginasi client-side atas daftar yang sudah dimuat.
 *
 * JUJUR: GET /access-control/audit TIDAK mendukung paging server-side —
 * kontraknya hanya `subject/decision/mode/from/to/limit`, tanpa
 * cursor/offset. Jadi halaman di sini adalah irisan dari daftar yang
 * dimuat (paling banyak `limit` baris, default 100). Bila suatu hari
 * backend menambah param paging, ganti fungsi ini dengan cursor
 * server-side seperti DataTable halaman histori.
 */
export function paginateIamAuditDecisions(
  decisions: readonly IamAuditDecision[],
  pageIndex: number,
  pageSize: number = IAM_AUDIT_PAGE_SIZE,
): IamAuditPageSlice {
  const pageCount = Math.max(1, Math.ceil(decisions.length / pageSize));
  const clamped = Math.min(Math.max(0, pageIndex), pageCount - 1);
  const start = clamped * pageSize;
  return {
    pageRows: decisions.slice(start, start + pageSize),
    pageIndex: clamped,
    pageCount,
    hasMore: clamped < pageCount - 1,
    hasPrev: clamped > 0,
  };
}

/** Nama file ekspor CSV: audit-iam-YYYY-MM-DD.csv (tanggal lokal). */
export function buildIamAuditCsvFilename(now: Date = new Date()): string {
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `audit-iam-${y}-${m}-${d}.csv`;
}

export interface IamAuditServerDraft {
  subject: string;
  decision: 'ALL' | 'ALLOW' | 'DENY';
  mode: 'ALL' | 'shadow' | 'enforce';
  from: string;
  to: string;
}

/** Draf filter halaman Audit IAM: filter server + filter client (Resource/Action). */
export interface IamAuditDraft extends IamAuditServerDraft {
  resourceQuery: string;
  actionQuery: string;
}

export const EMPTY_IAM_AUDIT_DRAFT: IamAuditDraft = {
  subject: '',
  decision: 'ALL',
  mode: 'ALL',
  from: '',
  to: '',
  resourceQuery: '',
  actionQuery: '',
};

/** Petakan draf filter ke query GET /access-control/audit (§3.4). */
export function iamAuditDraftToServerFilters(draft: IamAuditDraft): IamAuditFilters {
  return {
    subject: draft.subject.trim() || undefined,
    decision: draft.decision === 'ALL' ? undefined : draft.decision,
    mode: draft.mode === 'ALL' ? undefined : draft.mode,
    from: draft.from ? new Date(draft.from).toISOString() : undefined,
    to: draft.to ? new Date(draft.to).toISOString() : undefined,
  };
}
