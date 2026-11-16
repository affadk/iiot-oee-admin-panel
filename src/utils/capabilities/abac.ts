/**
 * Mesin ABAC: validasi AST kondisi + komparator.
 *
 * Dipisah dari file god-file pada refactoring R9 (kontrak docs/DIRECTORY_STRUCTURE.md).
 * Satu file = satu domain. Barrel penggabung ada di file induknya.
 */
export const ABAC_WHITELISTED_ATTRIBUTES = [
  'networkMode',
  'subjectActive',
  'actorLineId',
  'resourceLineId',
  'windowDays',
  'department',
  'operatorId',
  'machineId',
  'deviceId',
  'role',
] as const;

export const ABAC_COMPARATORS = ['eq', 'neq', 'in', 'contains', 'prefix', 'suffix'] as const;

export type AbacComparator = (typeof ABAC_COMPARATORS)[number];

export function validateAbacAstNode(node: unknown): { valid: boolean; reason?: string } {
  if (!node || typeof node !== 'object' || Array.isArray(node)) {
    return { valid: false, reason: 'Setiap node abac_condition harus berupa objek JSON.' };
  }
  const rec = node as Record<string, unknown>;
  const keys = Object.keys(rec);
  if (keys.length === 0) {
    return { valid: false, reason: 'Node abac_condition tidak boleh kosong.' };
  }

  if ('all' in rec) {
    if (keys.length !== 1 || !Array.isArray(rec.all) || rec.all.length === 0) {
      return { valid: false, reason: 'Operator "all" harus berupa array non-kosong tanpa properti lain.' };
    }
    for (const child of rec.all) {
      const childCheck = validateAbacAstNode(child);
      if (!childCheck.valid) return childCheck;
    }
    return { valid: true };
  }

  if ('any' in rec) {
    if (keys.length !== 1 || !Array.isArray(rec.any) || rec.any.length === 0) {
      return { valid: false, reason: 'Operator "any" harus berupa array non-kosong tanpa properti lain.' };
    }
    for (const child of rec.any) {
      const childCheck = validateAbacAstNode(child);
      if (!childCheck.valid) return childCheck;
    }
    return { valid: true };
  }

  if ('not' in rec) {
    if (keys.length !== 1) {
      return { valid: false, reason: 'Operator "not" hanya boleh memiliki satu properti anak.' };
    }
    return validateAbacAstNode(rec.not);
  }

  // Leaf node: must specify whitelisted `attr` and exactly ONE whitelisted comparator
  if (typeof rec.attr !== 'string') {
    return { valid: false, reason: 'Predikat leaf wajib menyertakan field "attr" string atau operator all/any/not.' };
  }
  if (!(ABAC_WHITELISTED_ATTRIBUTES as readonly string[]).includes(rec.attr)) {
    return { valid: false, reason: `Atribut ABAC "${rec.attr}" tidak masuk whitelist backend.` };
  }

  const comparatorKeys = keys.filter((k) => k !== 'attr');
  if (comparatorKeys.length !== 1) {
    return { valid: false, reason: 'Setiap predikat leaf wajib memiliki tepat satu comparator.' };
  }

  const cmp = comparatorKeys[0];
  if (!(ABAC_COMPARATORS as readonly string[]).includes(cmp)) {
    return { valid: false, reason: `Comparator ABAC "${cmp}" tidak dikenali (izinkan: eq, neq, in, contains, prefix, suffix).` };
  }

  const value = rec[cmp];
  if (cmp === 'in') {
    if (!Array.isArray(value) || value.length === 0) {
      return { valid: false, reason: 'Comparator "in" wajib menerima array nilai non-kosong.' };
    }
  } else if (
    typeof value !== 'string' &&
    typeof value !== 'number' &&
    typeof value !== 'boolean'
  ) {
    return { valid: false, reason: `Nilai comparator "${cmp}" wajib berupa string, number, atau boolean.` };
  }

  return { valid: true };
}

export function validateAbacCondition(
  rawCondition: string | Record<string, unknown> | null | undefined
): { valid: boolean; parsed: Record<string, unknown> | null; reason?: string } {
  if (rawCondition === null || rawCondition === undefined || rawCondition === '') {
    return { valid: true, parsed: null };
  }

  let parsed: unknown;
  if (typeof rawCondition === 'string') {
    const trimmed = rawCondition.trim();
    if (!trimmed) return { valid: true, parsed: null };
    try {
      parsed = JSON.parse(trimmed);
    } catch {
      return { valid: false, parsed: null, reason: 'JSON abac_condition tidak valid.' };
    }
  } else {
    parsed = rawCondition;
  }

  const astCheck = validateAbacAstNode(parsed);
  if (!astCheck.valid) {
    return { valid: false, parsed: null, reason: astCheck.reason };
  }
  return { valid: true, parsed: parsed as Record<string, unknown> };
}
