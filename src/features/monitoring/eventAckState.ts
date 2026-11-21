import type { OperationalEvent } from '../../types/monitoring';

/**
 * Status acknowledgment turunan untuk daftar kerja Operational Events.
 *
 * FAT-292 (P33.2, E33): ISA-18.2 membedakan alarm yang masih aktif dan
 * belum di-ack dari alarm yang kondisinya SUDAH clear sendiri tetapi
 * belum pernah dilihat operator (`rtn-unacknowledged`) — baris kedua
 * harus tetap ada di daftar sampai di-ack, karena fault intermiten
 * tidak boleh hilang tanpa jejak.
 *
 * Derivasi ini BEST-EFFORT dalam jendela halaman yang sedang dimuat:
 * backend belum mengirim status kondisi eksplisit, jadi "clear"
 * disimpulkan dari satu pasangan event saja — DEVICE_OFFLINE yang
 * diikuti DEVICE_ONLINE untuk device_id yang sama dengan recorded_at
 * yang LEBIH BARU, di dalam array `events` yang sama (satu halaman
 * hasil query saat ini). Bila event ONLINE-nya ada di halaman lain,
 * di luar rentang filter, atau belum termuat, hasilnya tetap
 * 'active-unack' (bukan salah — hanya belum terbukti clear).
 *
 * State server-side yang eksak butuh backend B33.4 (FAT-298). JANGAN
 * mengarang field/kondisi lain dari data yang tidak ada: tidak ada
 * pemakaian `event_code`, `snapshot_*`, `trigger_source`, atau
 * heuristik di luar pasangan OFFLINE→ONLINE di bawah ini.
 */
export type EventAckState = 'active-unack' | 'rtn-unack' | 'acked';

export function getEventAckState(
  event: OperationalEvent,
  events: readonly OperationalEvent[]
): EventAckState {
  if (event.acknowledged) {
    return 'acked';
  }
  // Hanya kondisi DEVICE_OFFLINE yang bisa "kembali normal sendiri"
  // (dibuktikan oleh DEVICE_ONLINE). Tipe lain yang belum di-ack tetap
  // aktif — tidak ada pasangan clear yang terdefinisi untuknya.
  if (event.event_type !== 'DEVICE_OFFLINE') {
    return 'active-unack';
  }
  // Tanpa device_id, event ONLINE tidak bisa dikorelasikan dengan aman.
  if (event.device_id == null) {
    return 'active-unack';
  }
  const offlineMs = Date.parse(event.recorded_at);
  const hasLaterOnline = events.some(
    (other) =>
      other.device_id === event.device_id &&
      other.event_type === 'DEVICE_ONLINE' &&
      // Harus LEBIH BARU (strict): ONLINE pada timestamp yang sama
      // tidak membuktikan OFFLINE ini sudah clear sesudahnya.
      // recorded_at kosong/rusak → NaN → perbandingan false → aman.
      Date.parse(other.recorded_at) > offlineMs
  );
  return hasLaterOnline ? 'rtn-unack' : 'active-unack';
}
