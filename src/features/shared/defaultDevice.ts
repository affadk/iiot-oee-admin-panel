/**
 * BARREL — default device dari daftar live (E31.16, FAT-279, audit P3-5).
 *
 * Dipindah ke ./utils/ pada refactoring E31.16 (2026-11-20):
 * `shared/` dipisah jadi `ui/` + `hooks/` + `utils/`. Impor lama tetap
 * jalan lewat re-export ini.
 */
export * from './utils/defaultDevice';
