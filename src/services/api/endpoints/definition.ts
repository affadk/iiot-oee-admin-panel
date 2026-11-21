/**
 * Definisi endpoint + encoder path.
 *
 * Dipisah dari file god-file pada refactoring R9 (kontrak docs/DIRECTORY_STRUCTURE.md).
 * Satu file = satu domain. Barrel penggabung ada di file induknya.
 */
export interface EndpointDefinition {
  key: string;
  method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE' | 'WS';
  template: string;
  buildPath: (...args: string[]) => string;
}

export const enc = (val: string) => encodeURIComponent(val);
