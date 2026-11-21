import { useCallback, useEffect, useMemo, useState } from 'react';
import { apiClient } from '../../../services/api/client';
import { useCapability } from '../../../context/AuthContext';
import type { IamAuditDecision, IamAuditFilters } from '../../../types/iam';
import {
  formatIamAuditExportRows,
  serializeExportRecords,
  triggerBrowserDownload,
} from '../../../utils/historicalExport';
import {
  EMPTY_IAM_AUDIT_DRAFT,
  IAM_AUDIT_PAGE_SIZE,
  buildIamAuditCsvFilename,
  filterIamAuditByResourceAction,
  iamAuditDraftToServerFilters,
  paginateIamAuditDecisions,
  type IamAuditDraft,
} from '../utils/iamAudit';

/**
 * Satu alur data halaman Audit IAM (P33.6, FAT-301): muat keputusan
 * `GET /access-control/audit` dengan filter server (subject/decision/
 * mode/from/to), saring Resource/Action di panel, paginasi client-side,
 * ekspor CSV.
 *
 * Paginasi JUJUR client-side: endpoint tidak punya param cursor/offset
 * (hanya `limit`), jadi halaman adalah irisan daftar yang dimuat
 * (lihat paginateIamAuditDecisions). Ekspor mencakup SEMUA baris hasil
 * filter, bukan hanya halaman yang tampil.
 */
export const useIamAudit = () => {
  // Baca IAM digate `access_control.read` (§3.4) — sama seperti tab lama.
  const canRead = useCapability('access_control.read');

  const [decisions, setDecisions] = useState<IamAuditDecision[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isApplying, setIsApplying] = useState(false);
  const [error, setError] = useState<unknown>(null);
  const [draft, setDraft] = useState<IamAuditDraft>(EMPTY_IAM_AUDIT_DRAFT);
  const [appliedFilters, setAppliedFilters] = useState<IamAuditFilters>({});
  const [pageIndex, setPageIndex] = useState(0);
  const [isExporting, setIsExporting] = useState(false);
  const [exportError, setExportError] = useState<string | null>(null);

  const loadDecisions = useCallback(async (filters: IamAuditFilters): Promise<void> => {
    setError(null);
    try {
      setDecisions(await apiClient.getIamAuditDecisions(filters));
    } catch (err: unknown) {
      setError(err);
    }
  }, []);

  // Muat awal tanpa filter begitu gerbang mengizinkan.
  useEffect(() => {
    if (!canRead.canInteract) {
      setIsLoading(false);
      return;
    }
    setIsLoading(true);
    void loadDecisions({}).finally(() => setIsLoading(false));
  }, [canRead.canInteract, loadDecisions]);

  const applyWith = useCallback(
    async (next: IamAuditDraft) => {
      const filters = iamAuditDraftToServerFilters(next);
      setDraft(next);
      setAppliedFilters(filters);
      setIsApplying(true);
      try {
        await loadDecisions(filters);
        setPageIndex(0);
      } finally {
        setIsApplying(false);
      }
    },
    [loadDecisions],
  );

  const applyFilters = useCallback(() => void applyWith(draft), [applyWith, draft]);
  const resetFilters = useCallback(
    () => void applyWith(EMPTY_IAM_AUDIT_DRAFT),
    [applyWith],
  );
  /** Pintasan "hanya DENY": satu klik — set filter + langsung terapkan. */
  const applyDenyOnly = useCallback(
    () => void applyWith({ ...draft, decision: 'DENY' }),
    [applyWith, draft],
  );

  const updateDraft = useCallback((patch: Partial<IamAuditDraft>) => {
    setDraft((prev) => ({ ...prev, ...patch }));
  }, []);

  const filtered = useMemo(
    () =>
      filterIamAuditByResourceAction(decisions, {
        resourceQuery: draft.resourceQuery,
        actionQuery: draft.actionQuery,
      }),
    [decisions, draft.resourceQuery, draft.actionQuery],
  );
  const page = useMemo(
    () => paginateIamAuditDecisions(filtered, pageIndex, IAM_AUDIT_PAGE_SIZE),
    [filtered, pageIndex],
  );

  const nextPage = useCallback(() => {
    if (page.hasMore) setPageIndex(page.pageIndex + 1);
  }, [page]);
  const prevPage = useCallback(() => {
    if (page.hasPrev) setPageIndex(page.pageIndex - 1);
  }, [page]);
  const resetPage = useCallback(() => setPageIndex(0), []);

  const reload = useCallback(() => void loadDecisions(appliedFilters), [appliedFilters, loadDecisions]);

  const exportCsv = useCallback(() => {
    setExportError(null);
    setIsExporting(true);
    try {
      const { content, mimeType } = serializeExportRecords(
        formatIamAuditExportRows(filtered),
        'csv',
      );
      triggerBrowserDownload(buildIamAuditCsvFilename(), content, mimeType);
    } catch (err: unknown) {
      setExportError(err instanceof Error ? err.message : 'Gagal mengekspor CSV.');
    } finally {
      setIsExporting(false);
    }
  }, [filtered]);

  return {
    canRead,
    pageRows: page.pageRows,
    filteredCount: filtered.length,
    pageIndex: page.pageIndex,
    pageCount: page.pageCount,
    hasMore: page.hasMore,
    hasPrev: page.hasPrev,
    isLoading,
    isApplying,
    error,
    draft,
    updateDraft,
    applyFilters,
    resetFilters,
    applyDenyOnly,
    nextPage,
    prevPage,
    resetPage,
    reload,
    exportCsv,
    isExporting,
    exportError,
  };
};
