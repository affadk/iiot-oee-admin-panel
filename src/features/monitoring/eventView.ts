import type { OperationalEvent } from '../../types/monitoring';
import { getEventAckState, type EventAckState } from './eventAckState';

/**
 * FAT-300 (P33.5, E33 tahap A analisis halaman Opsi 3 §3): dua tampilan
 * Alarm & Event dalam satu halaman + filter State.
 *
 * Tampilan:
 * - 'action' ("Perlu Tindakan", default): hanya event yang belum di-ack
 *   (active-unack + rtn-unack), diurutkan state dulu (masih aktif
 *   didahulukan) lalu terbaru. Query server-side memakai
 *   `acknowledged=false`.
 * - 'history' ("Riwayat"): semua event dalam rentang, urutan server
 *   (terbaru dulu). Query tanpa param `acknowledged`.
 *
 * Pindah tampilan TIDAK mengganti filter lain (device, tipe, rentang) —
 * hanya menyaring state ack dan mereset paginasi ke halaman 1.
 *
 * KEJUJURAN ANGKA (baca sebelum memakai jumlah tab):
 * Backend TIDAK menyediakan query COUNT(*) total (API doc §I
 * FR-034-30..34 — `meta.count`/`total_count` adalah jumlah baris
 * HALAMAN ini, bukan total dataset; lihat
 * `utils/historicalExport/pagination.ts`). Karena itu jumlah tab dihitung
 * dari baris halaman yang sedang dimuat: angka pasti hanya bila halaman 1
 * dan tidak ada halaman berikut (`has_more` false); selain itu angka
 * adalah BATAS BAWAH dan ditampilkan dengan akhiran "+" (mis. "12+").
 * Jangan pernah menampilkan angka halaman sebagai "total" tanpa "+".
 *
 * Filter State adalah penyaring CLIENT-SIDE atas halaman yang dimuat
 * (pembedaan aktif vs clear hanya bisa derivasi via getEventAckState —
 * state server-side belum ada, B33.4/FAT-298). Derivasi SELALU memakai
 * daftar halaman PENUH (belum disaring/diturunkan) sebagai referensi,
 * supaya pasangan OFFLINE→ONLINE tidak hilang saat penyaringan.
 */
export type OperationalEventView = 'action' | 'history';

export type OperationalEventStateFilter = 'ALL' | 'ACTIVE_UNACK' | 'RTN_UNACK' | 'ACKED';

export const EVENT_VIEW_LABELS: Record<OperationalEventView, string> = {
  action: 'Perlu Tindakan',
  history: 'Riwayat',
};

export const EVENT_STATE_FILTER_LABELS: Record<OperationalEventStateFilter, string> = {
  ALL: 'Semua',
  ACTIVE_UNACK: 'Aktif belum ack',
  RTN_UNACK: 'Clear belum di-ack',
  ACKED: 'Sudah ack',
};

/**
 * Param `acknowledged` server-side untuk tampilan aktif. 'action' memakai
 * `false` (hanya yang belum di-ack); 'history' memakai `undefined`
 * (semua event).
 */
export function acknowledgedParamForView(view: OperationalEventView): boolean | undefined {
  return view === 'action' ? false : undefined;
}

/**
 * Opsi Filter State yang berlaku per tampilan. 'ACKED' tidak ditawarkan di
 * tampilan 'action' — server di tampilan itu hanya mengembalikan event
 * yang belum di-ack, jadi opsi itu akan selalu kosong.
 */
export function stateFilterOptionsForView(
  view: OperationalEventView
): OperationalEventStateFilter[] {
  return view === 'action'
    ? ['ALL', 'ACTIVE_UNACK', 'RTN_UNACK']
    : ['ALL', 'ACTIVE_UNACK', 'RTN_UNACK', 'ACKED'];
}

/**
 * Saring daftar halaman yang dimuat menurut Filter State. 'ALL'
 * mengembalikan daftar apa adanya. Derivasi state tiap baris memakai
 * daftar `events` yang sama (halaman penuh) sebagai referensi — lihat
 * catatan di atas.
 */
export function filterEventsByState(
  events: readonly OperationalEvent[],
  stateFilter: OperationalEventStateFilter
): OperationalEvent[] {
  if (stateFilter === 'ALL') {
    return [...events];
  }
  const wanted: EventAckState =
    stateFilter === 'ACTIVE_UNACK' ? 'active-unack' : stateFilter === 'RTN_UNACK' ? 'rtn-unack' : 'acked';
  return events.filter((ev) => getEventAckState(ev, events) === wanted);
}

/**
 * Urutan tampilan "Perlu Tindakan": active-unack dulu (kondisi masih
 * aktif = paling butuh tindakan), lalu rtn-unack (sudah clear, belum
 * dilihat); terbaru dulu di dalam tiap kelompok (recorded_at desc —
 * eksplisit, tidak mengandalkan urutan masuk). Sort stabil untuk baris
 * dengan state dan waktu yang sama.
 *
 * `referenceEvents` adalah daftar halaman PENUH untuk derivasi state
 * (lihat catatan di atas); `events` adalah daftar yang diurutkan
 * (biasanya hasil filterEventsByState). Bila tidak diisi, derivasi
 * memakai daftar yang diurutkan itu sendiri.
 */
export function sortActionView(
  events: readonly OperationalEvent[],
  referenceEvents: readonly OperationalEvent[] = events
): OperationalEvent[] {
  const rank = (state: EventAckState): number =>
    state === 'active-unack' ? 0 : state === 'rtn-unack' ? 1 : 2;
  return [...events].sort((a, b) => {
    const byState =
      rank(getEventAckState(a, referenceEvents)) - rank(getEventAckState(b, referenceEvents));
    if (byState !== 0) return byState;
    // recorded_at rusak → NaN → 0 → urutan masuk dipertahankan (stabil).
    return Date.parse(b.recorded_at) - Date.parse(a.recorded_at);
  });
}

export interface TabCount {
  /** Jumlah baris yang cocok pada halaman yang dimuat. */
  count: number;
  /**
   * True hanya bila halaman 1 dan tidak ada halaman berikut — barulah
   * `count` adalah total pasti. Selain itu `count` adalah batas bawah.
   */
  exact: boolean;
}

/**
 * Jumlah tab dari halaman yang dimuat: 'action' = baris belum di-ack,
 * 'history' = semua baris. `pageIndex` 0 = halaman pertama.
 * `hasMore` dari pagination halaman yang dimuat.
 */
export function describeTabCounts(
  events: readonly OperationalEvent[],
  pageIndex: number,
  hasMore: boolean
): { action: TabCount; history: TabCount } {
  const exact = pageIndex === 0 && !hasMore;
  return {
    action: { count: events.filter((e) => !e.acknowledged).length, exact },
    history: { count: events.length, exact },
  };
}

/** Tampilkan jumlah tab: pasti → "12", batas bawah → "12+". */
export function formatTabCount(tabCount: TabCount): string {
  return tabCount.exact ? String(tabCount.count) : `${tabCount.count}+`;
}
