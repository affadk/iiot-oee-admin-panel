import { ApiError } from '../../types/auth';
import { formatTimeWithSeconds } from '../../utils/formatDate';

export interface DataTableErrorInfo {
  title: string;
  message: string;
  canRetry: boolean;
  isRetention: boolean;
}

/**
 * Memetakan error query ke tampilan panel error DataTable.
 * Dipindah dari DataTable.tsx (E32.6, FAT-287) — logika murni, tanpa JSX.
 */
export function getErrorDisplay(error: unknown): DataTableErrorInfo {
  if (error instanceof ApiError) {
    if (error.httpStatus === 401) {
      return {
        title: 'Sesi Berakhir (401)',
        message: error.message,
        canRetry: false,
        isRetention: false,
      };
    }
    if (error.httpStatus === 403) {
      return {
        title: 'Akses Ditolak (403)',
        message: error.message,
        canRetry: false,
        isRetention: false,
      };
    }
    if (error.code === 'RETENTION_EXCEEDED') {
      return {
        title: 'Melebihi Batas Retensi 90 Hari (400)',
        message: `${error.message} Gunakan rentang waktu lebih baru (≤ 90 hari) atau buka Analitik Shift / Rollup.`,
        canRetry: false,
        isRetention: true,
      };
    }
    if (error.httpStatus === 404) {
      return {
        title: 'Data Tidak Ditemukan (404)',
        message: error.message,
        canRetry: false,
        isRetention: false,
      };
    }
    if (error.httpStatus === 429) {
      return {
        title: 'Batas Permintaan Tercapai (429)',
        message: error.message,
        canRetry: true,
        isRetention: false,
      };
    }
    if (error.httpStatus >= 500) {
      return {
        title: `Kesalahan Server (${error.httpStatus})`,
        message: `${error.message} (Waktu: ${formatTimeWithSeconds(new Date())})`,
        canRetry: true,
        isRetention: false,
      };
    }
    return {
      title: `Gagal Memuat Data (${error.code})`,
      message: error.message,
      canRetry: true,
      isRetention: false,
    };
  }

  return {
    title: 'Gagal Memuat Data',
    message: error instanceof Error ? error.message : 'Terjadi kesalahan saat memuat tabel.',
    canRetry: true,
    isRetention: false,
  };
}
