import { UseQueryResult } from '@tanstack/react-query';

// ---------------------------------------------------------------------------
// E12 T12.5 (U-2 / FAT-52): status loading/error per widget halaman OEE
// (dipakai OeeSummaryCards / OeeHourlyTable / OeeRollupTable / ShiftTimeline
// untuk skeleton / pesan kosong / error, Guide §5, gap G17).
//
// `isLoading` React Query hanya true saat query belum punya data sama
// sekali (bukan refetch — itu `isFetching`/`isRefreshing`); `isError`
// true saat fetch terakhir gagal. Widget menampilkan state ini hanya bila
// tidak ada data (stale-while-revalidate: data lama tetap tampil).
// ---------------------------------------------------------------------------

/** Status loading/error satu widget halaman OEE + refetch untuk "Coba lagi". */
export interface OeeWidgetState {
  isLoading: boolean;
  isError: boolean;
  refetch: () => void;
}

type QueryStatus = Pick<UseQueryResult<unknown, unknown>, 'isLoading' | 'isError' | 'refetch'>;

export function toWidgetState(query: QueryStatus): OeeWidgetState {
  return {
    isLoading: query.isLoading,
    isError: query.isError,
    refetch: () => {
      void query.refetch();
    },
  };
}

/** Gabungan status halaman: memuat/gagal bila SATU SAJA query-nya begitu. */
export function combineQueryStatus(
  queries: ReadonlyArray<Pick<QueryStatus, 'isLoading' | 'isError'>>
): { isLoading: boolean; isError: boolean } {
  return {
    isLoading: queries.some((q) => q.isLoading),
    isError: queries.some((q) => q.isError),
  };
}

// ---------------------------------------------------------------------------
// E12 T12.16 (F-12 / FAT-68): gabungan `isFetching` untuk spinner Refresh
// halaman OEE (gap G10). Semua query yang memengaruhi tampilan halaman
// harus ikut — summary, hourly, timeline, overlay downtime, rollup,
// pareto — supaya spinner tidak berhenti padahal sebagian data masih
// dimuat. Overlay downtime adalah useInfiniteQuery: `isFetching`-nya
// true saat refetch maupun saat "Muat lebih banyak" (`isFetchingNextPage`
// adalah subset `isFetching`), jadi satu flag ini mencakup keduanya.
// Dipakai `isFetching` (bukan `isLoading`) agar refetch atas data yang
// sudah ada tetap menyalakan spinner.
// ---------------------------------------------------------------------------

/** `true` bila SATU SAJA query masih memuat (`isFetching`). */
export function combineIsRefreshing(
  queries: ReadonlyArray<Pick<UseQueryResult<unknown, unknown>, 'isFetching'>>
): boolean {
  return queries.some((q) => q.isFetching);
}
