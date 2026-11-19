import { CursorPageResponse } from '../../../types/historical';
import { DowntimeEvent } from '../../../types/monitoring';

/**
 * E12 T12.13 (X-6 / FAT-63): penggabungan halaman riwayat downtime untuk
 * overlay timeline (gap G18) — fungsi murni, pola R9.2 / `oeeTimelineSelection`:
 * logika yang bisa diuji tanpa render hook.
 *
 * Aturan yang dipertahankan dari overlay lama:
 * - Dedup per `id` di semua halaman yang sudah dimuat.
 * - Event aktif menang atas histori (menimpa entri dengan `id` yang sama).
 *
 * Aturan hitungan "menampilkan N dari M" (M = `total_count` halaman
 * terakhir — di mode Real dipetakan transport dari `meta.count` bila server
 * mengirimnya, lihat `pageMeta` di `http/primitives.ts`; di demo diisi
 * `paginateWithCursor` dengan jumlah baris halaman itu (E20 P20.4 —
 * envelope `count` = baris halaman, bukan total dataset)):
 * - Semua halaman sudah dimuat (`has_more` false) → M = N (eksak — semua
 *   event memang sudah ada di tangan, tidak perlu total server).
 * - Masih ada halaman berikut DAN total yang dilaporkan LEBIH BESAR dari N
 *   → M = total itu. Total sebesar itu hanya mungkin bila server benar-benar
 *   mengirimnya: bila server tidak mengirim total, transport mengisi
 *   `total_count` dengan panjang halaman itu saja (≤ N).
 * - Masih ada halaman berikut DAN total yang dilaporkan ≤ N → M tidak
 *   diketahui (`null`): JANGAN mengarang total — tampilkan "menampilkan N"
 *   saja + tombol "Muat lebih banyak".
 */
export interface DowntimeOverlayPage {
  /** Event aktif (hanya di halaman pertama; halaman lanjutan `[]`). */
  active: DowntimeEvent[];
  /** Satu halaman riwayat downtime (cursor pagination). */
  history: CursorPageResponse<DowntimeEvent>;
}

export interface MergedDowntimeOverlay {
  /** Peta gabungan (histori + aktif) untuk korelasi segmen ↔ event. */
  map: Map<string, DowntimeEvent>;
  /** Jumlah unik event histori di semua halaman yang sudah dimuat (N). */
  loadedHistoryCount: number;
  /** Total event histori (M) bila diketahui, `null` bila tidak dikirim server. */
  totalCount: number | null;
  /** Masih ada halaman berikut (`has_more` + `next_cursor` di halaman terakhir). */
  hasMore: boolean;
}

export function mergeDowntimeOverlayPages(pages: DowntimeOverlayPage[]): MergedDowntimeOverlay {
  const map = new Map<string, DowntimeEvent>();
  const seenHistoryIds = new Set<string>();
  for (const page of pages) {
    for (const ev of page.history.data) {
      seenHistoryIds.add(ev.id);
      map.set(ev.id, ev);
    }
  }
  // Aktif menang atas histori: event aktif menimpa entri histori dengan
  // id yang sama (perilaku overlay lama — `[...hist, ...active]`).
  for (const page of pages) {
    for (const ev of page.active) {
      map.set(ev.id, ev);
    }
  }

  const loadedHistoryCount = seenHistoryIds.size;
  let totalCount: number | null = null;
  let hasMore = false;
  const lastPage = pages[pages.length - 1];
  if (lastPage) {
    const pagination = lastPage.history.pagination;
    hasMore = Boolean(pagination.has_more) && pagination.next_cursor !== null;
    if (!hasMore) {
      // Semua halaman dimuat — totalnya persis sebanyak yang dimuat.
      totalCount = loadedHistoryCount;
    } else {
      const reported = pagination.total_count;
      // Total yang dilaporkan hanya dipercaya bila lebih besar dari yang
      // sudah dimuat — nilai sebesar itu tidak mungkin berasal dari fallback
      // transport (panjang halaman terakhir, ≤ N).
      if (reported !== undefined && reported > loadedHistoryCount) {
        totalCount = reported;
      }
    }
  }
  return { map, loadedHistoryCount, totalCount, hasMore };
}
