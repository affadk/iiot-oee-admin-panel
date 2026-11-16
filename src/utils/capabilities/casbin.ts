/**
 * Evaluator kebijakan Casbin/ABAC (Guide §8).
 *
 * Dipisah dari file god-file pada refactoring R9 (kontrak docs/DIRECTORY_STRUCTURE.md).
 * Satu file = satu domain. Barrel penggabung ada di file induknya.
 */
import { AbacComparator, validateAbacCondition } from './abac';
import { NetworkAccessMode, UserRole } from '../../types/auth';
import { IamAssignment, IamPolicyRule } from '../../types/iam';

export interface CasbinAbacEnvironment {
  networkMode?: NetworkAccessMode;
  subjectActive?: boolean;
  actorLineId?: string;
  resourceLineId?: string;
  windowDays?: number;
  department?: string;
  operatorId?: string;
  machineId?: string;
  deviceId?: string;
  role?: string;
}

export interface CasbinAbacEvalInput {
  primaryRole: UserRole;
  assignments: Pick<IamAssignment, 'role_name' | 'scope_type'>[];
  policies: IamPolicyRule[];
  mode: 'shadow' | 'enforce' | 'partial';
  action: string;
  resourceKey: string;
  baselineAllowed: boolean;
  env?: CasbinAbacEnvironment;
}

export interface CasbinAbacEvalResult {
  finalDecision: 'ALLOW' | 'DENY';
  policyDecision: 'ALLOW' | 'DENY';
  baselineDecision: 'ALLOW' | 'DENY';
  shadowMismatch: boolean;
  effectiveRoles: string[];
  reason: string;
}

export function matchAction(policyAction: string, requestedAction: string): boolean {
  if (policyAction === '*' || policyAction === requestedAction) return true;
  if (policyAction.includes('|')) {
    return policyAction.split('|').some((part) => part.trim() === requestedAction);
  }
  return false;
}

export function matchResourcePattern(pattern: string, resourceKey: string): boolean {
  if (pattern === '*' || pattern === resourceKey) return true;
  if (pattern.endsWith(':*')) {
    const prefix = pattern.slice(0, -1);
    return resourceKey === prefix.slice(0, -1) || resourceKey.startsWith(prefix);
  }
  return false;
}

export function evalAbacNode(node: Record<string, unknown>, env: CasbinAbacEnvironment): boolean {
  if (Array.isArray(node.all)) {
    return node.all.every((child) => evalAbacNode(child as Record<string, unknown>, env));
  }
  if (Array.isArray(node.any)) {
    return node.any.some((child) => evalAbacNode(child as Record<string, unknown>, env));
  }
  if (node.not && typeof node.not === 'object') {
    return !evalAbacNode(node.not as Record<string, unknown>, env);
  }

  const attr = node.attr as keyof CasbinAbacEnvironment;
  const actual = env[attr];
  const cmp = Object.keys(node).find((k) => k !== 'attr') as AbacComparator;
  const expected = node[cmp];

  if (actual === undefined) {
    // When contextual attribute is absent in evaluation env, evaluate conservatively unless neq
    return cmp === 'neq';
  }

  switch (cmp) {
    case 'eq':
      return actual === expected;
    case 'neq':
      return actual !== expected;
    case 'in':
      return Array.isArray(expected) && expected.includes(actual);
    case 'contains':
      return typeof actual === 'string' && typeof expected === 'string' && actual.includes(expected);
    case 'prefix':
      return typeof actual === 'string' && typeof expected === 'string' && actual.startsWith(expected);
    case 'suffix':
      return typeof actual === 'string' && typeof expected === 'string' && actual.endsWith(expected);
    default:
      return false;
  }
}

export function matchAbacCondition(
  rawCondition: string | Record<string, unknown> | null | undefined,
  env: CasbinAbacEnvironment
): { matched: boolean; malformed: boolean } {
  const checked = validateAbacCondition(rawCondition);
  if (!checked.valid) {
    return { matched: false, malformed: true };
  }
  if (!checked.parsed) {
    return { matched: true, malformed: false };
  }
  return { matched: evalAbacNode(checked.parsed, env), malformed: false };
}

/**
 * Spec 021 / 032 / ADR-0013 Casbin ABAC Evaluator:
 * - Only ORGANIZATION-scoped assignments grant effective admin-panel roles.
 * - Evaluates 4 dimensions: roleMatch && actionMatch && resourceMatch && abacMatch.
 * - Malformed abac_condition JSON fails closed (DENY).
 * - Precedence: DENY wins (`some(allow) && !some(deny)`), default fail-closed DENY.
 * - `shadow` mode uses baseline for final decision while auditing shadow mismatches.
 */
export function evaluateCasbinAbacDecision(input: CasbinAbacEvalInput): CasbinAbacEvalResult {
  const orgRoles = input.assignments
    .filter((a) => a.scope_type === 'ORGANIZATION')
    .map((a) => a.role_name);
  const effectiveRoles = Array.from(new Set([input.primaryRole, ...orgRoles]));

  let hasAllow = false;
  let hasDeny = false;
  let malformedAbacDetected = false;

  for (const policy of input.policies) {
    if (!policy.is_active) continue;
    const roleMatch = policy.role
      .split('|')
      .map((r) => r.trim())
      .some((r) => r === '*' || effectiveRoles.includes(r));
    if (!roleMatch) continue;
    if (!matchAction(policy.action, input.action)) continue;
    if (!matchResourcePattern(policy.resource_pattern, input.resourceKey)) continue;

    const abacResult = matchAbacCondition(policy.abac_condition, input.env ?? {});
    if (abacResult.malformed) {
      malformedAbacDetected = true;
      continue;
    }
    if (!abacResult.matched) continue;

    if (policy.eft === 'DENY') {
      hasDeny = true;
    } else if (policy.eft === 'ALLOW') {
      hasAllow = true;
    }
  }

  const policyDecision: 'ALLOW' | 'DENY' = hasAllow && !hasDeny && !malformedAbacDetected ? 'ALLOW' : 'DENY';
  const baselineDecision: 'ALLOW' | 'DENY' = input.baselineAllowed ? 'ALLOW' : 'DENY';
  const finalDecision: 'ALLOW' | 'DENY' = input.mode === 'enforce' ? policyDecision : baselineDecision;
  const shadowMismatch = input.mode === 'shadow' && policyDecision !== baselineDecision;

  let reason =
    finalDecision === 'ALLOW'
      ? input.mode === 'enforce'
        ? 'Diizinkan oleh policy Casbin ABAC.'
        : 'Diizinkan oleh baseline shadow mode.'
      : malformedAbacDetected
        ? 'Kondisi JSON ABAC tidak valid (fail-closed DENY).'
        : hasDeny
          ? 'Ditolak oleh aturan eksplisit DENY.'
          : 'Tidak ada aturan ALLOW yang cocok (fail-closed DENY).';

  if (shadowMismatch) {
    reason = `SHADOW_MISMATCH (baseline=${baselineDecision}, policy=${policyDecision})`;
  }

  return {
    finalDecision,
    policyDecision,
    baselineDecision,
    shadowMismatch,
    effectiveRoles,
    reason,
  };
}
