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

import type { Operator } from '../types/production';

/**
 * Guard akun root dilindungi — dulu inline di 4 tempat OperatorsPage
 * (tabel, detail modal, edit role-select, tombol delete). R9.5.
 */
export function isProtectedOperator(op: Operator): boolean {
  return Boolean(op.is_protected || op.operator_id === 'ADM-001');
}
