/**
 * BARREL — query histori (React Query).
 *
 * Dipisah E31.16 lanjutan (FAT-279): file asal 280 baris melanggar batas
 * keras hook (250) — kini dua file per domain (master vs data histori)
 * + barrel ini. Impor pemanggil tidak berubah.
 */
export * from './useHistoryMasterQueries';
export * from './useHistoryDataQueries';
