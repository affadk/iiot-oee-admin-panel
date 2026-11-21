/**
 * Klasifikasi galat transport HTTP (FAT-285, E32.4).
 *
 * Dipisah dari `transport.ts` (575/600, ambang batas keras) tanpa mengubah
 * perilaku.
 */

/**
 * E28 Batch A (FAT-227 MUT-01): klasifikasi galat transport — pisahkan
 * tiga hal yang sebelumnya disamaratakan menjadi satu pesan "Koneksi
 * jaringan terputus atau backend tidak terjangkau.":
 * - `AbortError` (timeout/abort) → pesan waktu tunggu, BUKAN putus jaringan.
 * - `TypeError` dari fetch (gagal tersambung sama sekali) → pesan jaringan.
 * - Error lain (mis. body tak bisa di-serialize, bug klien) → kode
 *   TRANSPORT_ERROR + pesan yang JUJUR bahwa ini bukan putusnya jaringan.
 *   Tanpa pemisahan ini, galat apa pun pasca-mutasi tampil sebagai banner
 *   network-error palsu padahal mutasi sudah sukses di server.
 *
 * Catatan: respons HTTP (apa pun statusnya) TIDAK pernah sampai ke sini —
 * fetchRaw memetakan status non-2xx via mapHttpErrorToApiError sebelum
 * catch ini; respons 2xx kosong/sukses (`{success}`/204) juga bukan galat.
 */
export interface ClassifiedTransportError {
  code: string;
  message: string;
}

export function classifyTransportError(err: unknown): ClassifiedTransportError {
  const name = (err as { name?: unknown } | null)?.name;
  if (name === 'AbortError') {
    return { code: 'NETWORK', message: 'Waktu tunggu habis. Periksa koneksi ke backend.' };
  }
  if (err instanceof TypeError) {
    return { code: 'NETWORK', message: 'Koneksi jaringan terputus atau backend tidak terjangkau.' };
  }
  return {
    code: 'TRANSPORT_ERROR',
    message: 'Gagal menghubungi backend: kesalahan tak terduga saat mengirim permintaan (bukan putusnya jaringan).',
  };
}
