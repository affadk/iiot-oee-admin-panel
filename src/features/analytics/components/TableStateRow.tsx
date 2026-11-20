// Re-export: E28 Batch B (FAT-219) — `TableStateRow` pindah ke
// `features/shared/TableStateRow.tsx` supaya satu pola empty-state dipakai
// semua halaman. Path lama dipertahankan agar impor lama tetap jalan.
export { TableStateRow, EmptyStateBlock } from '../../shared/TableStateRow';
