/**
 * Label tampilan untuk `reason` pada item pareto reject.
 *
 * Perangkat OEE hanya punya 1 tombol Reject, jadi reject tercatat tanpa
 * alasan dan backend mengembalikannya dalam satu keranjang `UNCLASSIFIED`
 * (API doc §R, FR-BIGR-001..003). Nilai kontrak `UNCLASSIFIED` dipertahankan
 * apa adanya di lapisan data (`RejectParetoItem.reason`); terjemahan ke
 * bahasa tampilan hanya terjadi di sini, supaya tidak ada komponen yang
 * menampilkan mentah `UNCLASSIFIED` ke pengguna. Alasan lain (bila kelak
 * ada dari alur klasifikasi QC) ditampilkan apa adanya.
 */
export function displayRejectReason(reason: string): string {
  return reason === 'UNCLASSIFIED' ? 'Belum diklasifikasi' : reason;
}
