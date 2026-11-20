/**
 * Filter histori — hook sinkronisasi filter histori dengan URL.
 *
 * Dipisah dari features/shared/historyFilters.ts pada refactoring E31.16
 * (FAT-279, audit P3-3): satu concern per file. Barrel penggabung:
 * features/shared/historyFilters.ts.
 */
import { parseHistoryFiltersFromSearchParams, serializeHistoryFiltersToSearchParams, applyHistoryFilterPatch, getDefaultHistoryRange } from '../utils/historyParams';
import { DEFAULT_HISTORY_PAGE_LIMIT } from '../../../utils/historicalExport';
import { HistoryFilters } from '../../../types/historical';
import { useCallback, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';

export function useHistoryFilters(defaults: Partial<HistoryFilters> = {}) {
  const [searchParams, setSearchParams] = useSearchParams();

  const validation = useMemo(
    () => parseHistoryFiltersFromSearchParams(searchParams, defaults),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [searchParams]
  );

  const updateFilters = useCallback(
    (patch: Partial<HistoryFilters>) => {
      const next = applyHistoryFilterPatch(validation.filters, patch);
      const serialized = serializeHistoryFiltersToSearchParams(next, searchParams);
      setSearchParams(serialized, { replace: true });
    },
    [validation.filters, searchParams, setSearchParams]
  );

  const setCursor = useCallback(
    (cursor?: string) => {
      updateFilters({ cursor });
    },
    [updateFilters]
  );

  const resetFilters = useCallback(() => {
    const defaultRange = getDefaultHistoryRange(7);
    const base: HistoryFilters = {
      limit: DEFAULT_HISTORY_PAGE_LIMIT,
      from: defaultRange.from,
      to: defaultRange.to,
      ...defaults,
      cursor: undefined,
      envelope: true,
    };
    const serialized = serializeHistoryFiltersToSearchParams(base);
    setSearchParams(serialized, { replace: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [setSearchParams]);

  return {
    filters: validation.filters,
    isValid: validation.valid,
    validationErrors: validation.errors,
    updateFilters,
    setCursor,
    resetFilters,
  };
}
