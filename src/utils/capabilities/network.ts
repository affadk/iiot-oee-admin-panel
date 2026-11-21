/**
 * Util jaringan: MAC/IP.
 *
 * Dipisah dari file god-file pada refactoring R9 (kontrak docs/DIRECTORY_STRUCTURE.md).
 * Satu file = satu domain. Barrel penggabung ada di file induknya.
 */
/**
 * Normalizes an EUI-48 MAC address (using ":" or "-") into canonical uppercase colon-separated format.
 */
export function normalizeMacAddress(mac: string): string {
  return mac.trim().toUpperCase().replace(/-/g, ':');
}

export const IPV4_REGEX = /^((25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)\.){3}(25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)$/;

export function isValidIpAddress(ip: string): boolean {
  const trimmed = ip.trim();
  if (IPV4_REGEX.test(trimmed)) return true;
  if (!trimmed.includes(':')) return false;
  if (/[^0-9a-fA-F:]/.test(trimmed)) return false;
  const doubleColonParts = trimmed.split('::');
  if (doubleColonParts.length > 2) return false;
  if (doubleColonParts.length === 2) {
    const left = doubleColonParts[0] ? doubleColonParts[0].split(':') : [];
    const right = doubleColonParts[1] ? doubleColonParts[1].split(':') : [];
    if (left.some((g) => !/^[0-9a-fA-F]{1,4}$/.test(g))) return false;
    if (right.some((g) => !/^[0-9a-fA-F]{1,4}$/.test(g))) return false;
    return left.length + right.length < 8;
  }
  const groups = trimmed.split(':');
  return groups.length === 8 && groups.every((g) => /^[0-9a-fA-F]{1,4}$/.test(g));
}
