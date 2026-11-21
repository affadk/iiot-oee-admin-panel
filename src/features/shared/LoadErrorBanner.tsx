/**
 * BARREL — banner error pemuatan halaman (E31.16, FAT-279, audit P3-5).
 *
 * Dipindah ke ./ui/ pada refactoring E31.16 (2026-11-20):
 * `shared/` dipisah jadi `ui/` + `hooks/` + `utils/`. Impor lama tetap
 * jalan lewat re-export ini.
 */
export * from './ui/LoadErrorBanner';
