/**
 * BARREL — re-export kapabilitas per concern (jalur impor lama tetap berlaku).
 *
 * Dipisah dari file god-file pada refactoring R9 (kontrak docs/DIRECTORY_STRUCTURE.md).
 * Satu file = satu domain. Barrel penggabung ada di file induknya.
 */
export * from './capabilities/specs';
export * from './capabilities/abac';
export * from './capabilities/engine';
export * from './capabilities/casbin';
export * from './capabilities/network';
export * from './capabilities/validators';
