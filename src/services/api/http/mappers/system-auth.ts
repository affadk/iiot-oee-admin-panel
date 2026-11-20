/**
 * Mapper backend→lokal — auth/me.
 *
 * Dipisah dari mappers/system.ts pada refactoring E31.15 (FAT-278, R10:
 * satu file mapper = satu domain). Barrel penggabung: mappers/system.ts.
 */
import { AuthMeResponse, AuthMeCapabilityEntry } from '../../../../types/auth';
import { num, str, pick } from '../primitives';

/**
 * GET /auth/me — toleran terhadap tiga bentuk dokumen (D-2):
 * - flat §L: `{operator, authz}`
 * - nested §3.4: `{access:{mode,channel,mutations_allowed}, operator, authz}`
 * - ringkas §6B: `{capabilities, mode}` (tanpa operator/authz)
 * `primaryRole` tanpa default 'OPERATOR' (absen = undefined → UNASSIGNED).
 * Capability array memakai `decision` (dokumen); `state` diterima sebagai alias.
 */
export function mapAuthMe(raw: unknown): AuthMeResponse {
  const r = (raw ?? {}) as Record<string, unknown>;
  const authz = (r.authz ?? {}) as Record<string, unknown>;
  const operator = (r.operator ?? {}) as Record<string, unknown>;
  const access = (r.access ?? {}) as Record<string, unknown>;
  const flatCaps = (r.capabilities ?? authz.capabilities ?? {}) as unknown;
  const capabilities: Record<string, 'allow' | 'deny' | 'unknown'> = {};
  const capabilityDetails: Record<string, AuthMeCapabilityEntry> = {};
  if (Array.isArray(flatCaps)) {
    for (const c of flatCaps as Array<Record<string, unknown>>) {
      const key = str(c.key);
      const decision = str(pick(c.decision, c.state), 'unknown');
      if (!key) continue;
      capabilities[key] = decision === 'allow' || decision === 'deny' ? decision : 'unknown';
      capabilityDetails[key] = {
        key,
        domain: str(pick(c.domain), undefined) || undefined,
        surface: str(pick(c.surface), undefined) || undefined,
        decision: capabilities[key],
        mode: str(pick(c.mode), undefined) || undefined,
        reason: str(pick(c.reason), undefined) || undefined,
      };
    }
  } else if (flatCaps && typeof flatCaps === 'object') {
    for (const [k, v] of Object.entries(flatCaps as Record<string, unknown>)) {
      capabilities[k] = v === 'allow' || v === 'deny' ? v : 'unknown';
    }
  }
  const effectiveRolesRaw = (pick(authz.effectiveRoles, r.effectiveRoles) as unknown[]) ?? [];
  const effectiveRoles = effectiveRolesRaw.map((e) => {
    if (typeof e === 'string') return { roleName: e, scopeType: 'ORGANIZATION', scopeId: null };
    const o = (e ?? {}) as Record<string, unknown>;
    return {
      roleName: str(pick(o.roleName, o.role_name, o.role)),
      scopeType: str(pick(o.scopeType, o.scope_type), 'ORGANIZATION'),
      scopeId: (pick(o.scopeId, o.scope_id) as string | null) ?? null,
    };
  });
  // §L/§3.4 memakai `primaryRole`, bukan `role`, pada operator auth/me.
  const primaryRole = str(pick(operator.primaryRole, r.primaryRole, authz.primaryRole), undefined) || undefined;
  const attributes =
    authz.attributes && typeof authz.attributes === 'object'
      ? (authz.attributes as Record<string, unknown>)
      : undefined;
  return {
    operator: {
      operator_id: str(pick(operator.id, operator.operator_id)),
      name: str(pick(operator.username, operator.name)),
      role: primaryRole ?? 'UNASSIGNED',
      line_id: str(pick(operator.lineId, operator.line_id), undefined) || undefined,
      isActive: pick(operator.isActive, operator.is_active) as boolean | undefined,
      isProtected: pick(operator.isProtected, operator.is_protected) as boolean | undefined,
      mustChangePassword: pick(operator.mustChangePassword, operator.must_change_password) as boolean | undefined,
    },
    primaryRole,
    effectiveRoles,
    authzVersion: num(pick(authz.authzVersion, r.authzVersion), 0),
    catalogueVersion: str(pick(authz.catalogueVersion, r.catalogueVersion), undefined) || undefined,
    mode: (pick(authz.mode, r.mode, access.mode) as AuthMeResponse['mode']) ?? 'shadow',
    capabilities,
    capabilityDetails: Object.keys(capabilityDetails).length > 0 ? capabilityDetails : undefined,
    attributes,
    access:
      Object.keys(access).length > 0
        ? {
            mode: str(pick(access.mode), undefined) || undefined,
            channel: str(pick(access.channel), undefined) || undefined,
            mutations_allowed: pick(access.mutations_allowed, access.mutationsAllowed) as boolean | undefined,
          }
        : undefined,
  };
}
