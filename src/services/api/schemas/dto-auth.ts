/**
 * Skema Zod DTO — domain auth (validasi respons backend).
 *
 * Dipisah dari schemas/dto.ts pada refactoring E31.15 (FAT-278, R10:
 * satu file skema = satu domain). Barrel penggabung: schemas/dto.ts.
 */
import { NumericCoercionSchema } from './transport';
import { z } from 'zod';

/**
 * Role adalah string bebas (API doc §H/§3.4, E20 P20.3) — bukan enum.
 * Nilai dikenal: ADMIN, SUPERVISOR, OPERATOR, MAINTENANCE; default UNASSIGNED.
 */
export const UserRoleSchema = z.string();

export const AuthMeCapabilityDecisionSchema = z.enum(['allow', 'deny', 'unknown']);

export const AuthMeCapabilityEntrySchema = z.object({
  key: z.string(),
  domain: z.string().optional(),
  surface: z.string().optional(),
  decision: AuthMeCapabilityDecisionSchema,
  mode: z.string().optional(),
  reason: z.string().optional(),
});

/**
 * Bentuk NORMALISASI GET /auth/me (dihasilkan mapAuthMe — toleran terhadap
 * tiga bentuk dokumen: flat §L, nested §3.4, ringkas §6B; D-2). Capability
 * boleh berbentuk record ATAU array (array memakai `decision`, bukan `state`).
 * `primaryRole` tanpa default 'OPERATOR' — absen = undefined (UNASSIGNED).
 */
export const AuthMeResponseSchema = z
  .object({
    operator: z.object({
      operator_id: z.string(),
      name: z.string(),
      role: UserRoleSchema,
      line_id: z.string().optional(),
      isActive: z.boolean().optional(),
      isProtected: z.boolean().optional(),
      mustChangePassword: z.boolean().optional(),
    }),
    primaryRole: UserRoleSchema.optional(),
    effectiveRoles: z.array(
      z.object({
        roleName: z.string(),
        scopeType: z.string(),
        scopeId: z.string().nullable(),
      })
    ),
    authzVersion: NumericCoercionSchema,
    catalogueVersion: z.string().optional(),
    mode: z.enum(['shadow', 'enforce', 'partial']),
    capabilities: z.union([
      z.record(z.string(), AuthMeCapabilityDecisionSchema),
      z.array(
        z.object({
          key: z.string(),
          state: AuthMeCapabilityDecisionSchema,
        })
      ),
      z.array(AuthMeCapabilityEntrySchema),
    ]),
    capabilityDetails: z.record(z.string(), AuthMeCapabilityEntrySchema).optional(),
    attributes: z.record(z.string(), z.unknown()).optional(),
    access: z
      .object({
        mode: z.string().optional(),
        channel: z.string().optional(),
        mutations_allowed: z.boolean().optional(),
      })
      .optional(),
  })
  .transform((parsed) => {
    const decisionOf = (item: { decision?: 'allow' | 'deny' | 'unknown'; state?: 'allow' | 'deny' | 'unknown' }) =>
      item.decision ?? item.state ?? 'unknown';
    const normalizedCapabilities: Record<string, 'allow' | 'deny' | 'unknown'> = Array.isArray(parsed.capabilities)
      ? Object.fromEntries(parsed.capabilities.map((item) => [item.key, decisionOf(item)]))
      : parsed.capabilities;
    const capabilityDetails: Record<string, z.infer<typeof AuthMeCapabilityEntrySchema>> | undefined = Array.isArray(
      parsed.capabilities
    )
      ? Object.fromEntries(
          parsed.capabilities.map((item) => [
            item.key,
            {
              key: item.key,
              domain: (item as { domain?: string }).domain,
              surface: (item as { surface?: string }).surface,
              decision: decisionOf(item),
              mode: (item as { mode?: string }).mode,
              reason: (item as { reason?: string }).reason,
            },
          ])
        )
      : parsed.capabilityDetails;

    return {
      ...parsed,
      capabilities: normalizedCapabilities,
      capabilityDetails,
    };
  });

export const LoginResponseSchema = z.object({
  success: z.boolean(),
  token: z.string().min(1),
  expires_in: NumericCoercionSchema,
  operator: z.object({
    id: z.string(),
    username: z.string(),
    role: UserRoleSchema,
    line_id: z.string().optional(),
    // Spec 043 (§L): flag gerbang ganti-password-wajib.
    must_change_password: z.boolean().optional(),
  }),
});

export const RefreshResponseSchema = z.object({
  success: z.boolean(),
  token: z.string().min(1),
  expires_in: NumericCoercionSchema,
  // Spec 043 (§L): authzVersion hasil baca ulang identitas dari database.
  authzVersion: NumericCoercionSchema.optional(),
});
