/**
 * Skema Zod DTO — domain IAM + operator (validasi respons backend).
 *
 * Dipisah dari schemas/dto.ts pada refactoring E31.15 (FAT-278, R10:
 * satu file skema = satu domain). Barrel penggabung: schemas/dto.ts.
 */
import { z } from 'zod';
import { UserRoleSchema } from './dto-auth';

export const IamInfoSchema = z.object({
  mode: z.enum(['shadow', 'enforce', 'partial']),
  authzVersion: z.number().int().nonnegative(),
  effectiveInMode: z.string(),
  // E23 Batch 4 (FAT-205, N-36): spec live mewajibkan keduanya.
  catalogueVersion: z.string(),
  enforcedDomains: z.array(z.string()),
});

/** Baris policy kanonis (§3.4, spec 042) — camelCase, TANPA `reason`. */
export const IamPolicyRuleSchema = z.object({
  id: z.string(),
  roleId: z.string(),
  roleName: z.string(),
  subjectMatch: z.string(),
  permissionId: z.string().optional(),
  action: z.string(),
  resourceType: z.string(),
  resourcePattern: z.string(),
  effect: z.enum(['ALLOW', 'DENY']),
  // E28 Batch A (FAT-229 MUT-03): `abacCondition` HANYA record — BUKAN
  // nullable. Spec 20 Nov: POST /policies = optional record; server menolak
  // null (400). Baris tanpa ABAC = field ABSEN (undefined), bukan null.
  // Pengecualian yang disengaja: PUT /policies BOLEH nullable (null =
  // hapus kondisi) — itu jalur tulis HTTP, bukan skema baris ini. Pembaca
  // (mapIamPolicy) tetap toleran terhadap null dari server lama.
  abacCondition: z.record(z.string(), z.unknown()).optional(),
  enabled: z.boolean(),
  createdAt: z.string(),
});

export const ScopeLevelSchema = z.enum(['ORGANIZATION', 'SITE', 'AREA', 'LINE', 'MACHINE', 'DEVICE']);

export const IamRoleSchema = z.object({
  id: z.string(),
  name: z.string().min(2).max(64),
  is_system: z.boolean(),
  description: z.string(),
  created_at: z.string(),
});

export const IamPermissionSchema = z.object({
  id: z.string(),
  action: z.string().min(1).max(64),
  resourceType: z.string().min(1).max(64),
  description: z.string(),
});

export const IamAssignmentSchema = z.object({
  id: z.string(),
  operator_id: z.string().min(1).max(32),
  operator_name: z.string(),
  role_id: z.string(),
  role_name: z.string().min(2).max(64),
  scope_type: ScopeLevelSchema,
  scope_id: z.string().max(64).nullable(),
  created_at: z.string(),
});

export const OperatorSchema = z.object({
  operator_id: z.string().min(3).max(32),
  name: z.string().min(3).max(100),
  role: UserRoleSchema,
  line_id: z.string().max(32),
  is_active: z.boolean(),
  is_protected: z.boolean().optional(),
  created_at: z.string(),
});
