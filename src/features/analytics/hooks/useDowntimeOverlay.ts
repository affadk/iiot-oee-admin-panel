import { useMemo } from 'react';
import { useInfiniteQuery } from '@tanstack/react-query';
import { apiClient } from '../../../services/api/client';
import { DowntimeEvent } from '../../../types/monitoring';
import { HISTORY_DATA_STALE_TIME_MS } from '../../shared/useHistoricalQueries';
import { DowntimeOverlayPage, mergeDowntimeOverlayPages } from './downtimeOverlay';

export interface UseDowntimeOverlayInput {
  /** QueryKey dari `buildOeeAnalyticsQueryKeys` — satu sumber kebenaran key halaman. */
  queryKey: unknown[];
  deviceId: string;
  from: string;
  to: string;
  enabled: boolean;
}

/**
 * E12 T12.13 (X-6 / FAT-63): riwayat downtime overlay sebagai
 * `useInfiniteQuery` cursor (gap G18) — pola cursor pagination yang sama
 * dengan halaman Downtime/Operational Events (`getDowntimeHistoryPage`
 * dengan `cursor` + `pagination.next_cursor`/`has_more`/`total_count`),
 * tapi halaman diakumulasi (bukan diganti) karena overlay butuh SEMUA event
 * yang sudah dimuat untuk korelasi segmen ↔ event.
 *
 * - Halaman pertama memuat event aktif + 50 histori pertama (perilaku lama);
 *   halaman lanjutan hanya histori (`cursor` dari `next_cursor`).
 * - Ganti device/rentang → queryKey berubah → halaman terakumulasi di-reset
 *   otomatis oleh React Query (tidak ada halaman basi dari filter lama).
 * - Penggabungan + hitungan N dari M ada di `mergeDowntimeOverlayPages`
 *   (fungsi murni, pola R9.2).
 */
export function useDowntimeOverlay({ queryKey, deviceId, from, to, enabled }: UseDowntimeOverlayInput) {
  const query = useInfiniteQuery({
    queryKey,
    enabled: enabled && Boolean(deviceId),
    staleTime: HISTORY_DATA_STALE_TIME_MS,
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (lastPage: DowntimeOverlayPage) => {
      const pagination = lastPage.history.pagination;
      return pagination.has_more && pagination.next_cursor ? pagination.next_cursor : undefined;
    },
    queryFn: async ({ signal, pageParam }): Promise<DowntimeOverlayPage> => {
      const [active, history] = await Promise.all([
        pageParam === undefined
          ? apiClient.getActiveDowntimes(signal)
          : Promise.resolve([] as DowntimeEvent[]),
        apiClient.getDowntimeHistoryPage(
          {
            device_id: deviceId,
            from,
            to,
            limit: 50,
            cursor: pageParam ?? undefined,
            envelope: true,
          },
          signal
        ),
      ]);
      return { active, history };
    },
  });

  const merged = useMemo(
    () => mergeDowntimeOverlayPages(query.data?.pages ?? []),
    [query.data]
  );

  return {
    /** Peta gabungan (histori + aktif) untuk korelasi segmen ↔ event. */
    downtimeMap: merged.map,
    /** Event histori unik yang sudah dimuat (N). */
    loadedCount: merged.loadedHistoryCount,
    /** Total event histori (M) bila diketahui, `null` bila server tidak mengirim total. */
    totalCount: merged.totalCount,
    /** Masih ada halaman berikut yang bisa dimuat. */
    hasMore: merged.hasMore,
    isLoading: query.isLoading,
    isError: query.isError,
    /** `true` bila fetch apa pun berjalan — refetch maupun halaman berikut
        (`isFetchingNextPage` adalah subset `isFetching`). */
    isFetching: query.isFetching,
    isFetchingNextPage: query.isFetchingNextPage,
    fetchNextPage: () => {
      void query.fetchNextPage();
    },
    refetch: () => {
      void query.refetch();
    },
  };
}
