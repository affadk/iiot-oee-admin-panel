/**
 * BARREL — re-export seed data demo per domain (nama file dipertahankan untuk kompatibilitas).
 *
 * Dipisah dari file god-file pada refactoring R9 (kontrak docs/DIRECTORY_STRUCTURE.md).
 * Satu file = satu domain. Barrel penggabung ada di file induknya.
 */
export * from './seeds/production';
export * from './seeds/assets';
export * from './seeds/operators';
export * from './seeds/monitoring';
export * from './seeds/mqtt';
export * from './seeds/system';
