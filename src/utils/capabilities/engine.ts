/**
 * Evaluator capability-first + penyimpanan denial (Guide §4.5).
 *
 * Dipisah dari file god-file pada refactoring R9 (kontrak docs/DIRECTORY_STRUCTURE.md).
 * Satu file = satu domain. Barrel penggabung ada di file induknya.
 */
import { CapabilityKey, CapabilityState, CAPABILITY_SPECS } from './specs';
import { AccessMode, NetworkAccessMode, UserRole } from '../../types/auth';

export interface CapabilityDenialEntry {
  capability: CapabilityKey;
  resourceId?: string;
  reason: string;
  deniedAt: number;
}

/**
 * Dynamic 403 downgrade registry keyed by (capability, resourceId?).
 * Cleared on login, logout, or role change.
 */
export class CapabilityDenialStore {
  private denials = new Map<string, CapabilityDenialEntry>();
  private listeners = new Set<() => void>();

  private makeKey(capability: CapabilityKey, resourceId?: string): string {
    const spec = CAPABILITY_SPECS[capability];
    if (spec?.roleOnly || !resourceId) {
      return capability;
    }
    return `${capability}::${resourceId}`;
  }

  recordDenial(capability: CapabilityKey, resourceId?: string, reason = 'Akses ditolak oleh kebijakan keamanan sistem.'): void {
    const key = this.makeKey(capability, resourceId);
    this.denials.set(key, {
      capability,
      resourceId: CAPABILITY_SPECS[capability]?.roleOnly ? undefined : resourceId,
      reason,
      deniedAt: Date.now(),
    });
    this.notify();
  }

  getDenial(capability: CapabilityKey, resourceId?: string): CapabilityDenialEntry | undefined {
    const globalHit = this.denials.get(capability);
    if (globalHit) return globalHit;
    if (resourceId) {
      return this.denials.get(`${capability}::${resourceId}`);
    }
    return undefined;
  }

  clearAll(): void {
    if (this.denials.size === 0) return;
    this.denials.clear();
    this.notify();
  }

  subscribe(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private notify(): void {
    this.listeners.forEach((fn) => fn());
  }
}

export const capabilityDenialStore = new CapabilityDenialStore();

export interface EvaluateCapabilityContext {
  role: UserRole;
  networkMode: NetworkAccessMode;
  /**
   * Mode akses deployment (Private/Public). Bila tidak diisi, dianggap
   * `private` — perilaku lama (tunnel selalu read-only) dipertahankan.
   * `public` + tunnel = capability LAN tetap boleh dipakai.
   */
  accessMode?: AccessMode;
  isAuthenticated: boolean;
  resourceId?: string;
  denialStore?: CapabilityDenialStore;
  /** Live projection from GET /api/v1/auth/me (`allow` | `deny` | `unknown`) */
  serverCapabilities?: Record<string, 'allow' | 'deny' | 'unknown'> | null;
  /** Optional unknown-scope hint from dynamic ABAC policy if uncertain */
  forceUnknownScope?: boolean;
}

export function evaluateCapability(
  capability: CapabilityKey,
  ctx: EvaluateCapabilityContext
): { state: CapabilityState; canInteract: boolean; reason?: string } {
  const spec = CAPABILITY_SPECS[capability];
  const store = ctx.denialStore ?? capabilityDenialStore;

  // Guard tulis (D1 + mode akses Private/Public): capability yang butuh LAN
  // ditolak bila akses efektif read-only — LAN selalu boleh; tunnel hanya
  // bila mode `public`. Default accessMode = `private` (perilaku lama).
  const canMutate = ctx.networkMode === 'LAN' || (ctx.accessMode ?? 'private') === 'public';
  if (spec.requiresLan && !canMutate) {
    return {
      state: 'denied',
      canInteract: false,
      // Copy dipertahankan dari perilaku lama (D1) — sudah diuji & dikenal operator.
      reason: 'Mode observasi — perubahan dinonaktifkan. Akses penuh tersedia dari LAN pabrik.',
    };
  }

  if (spec.requiresAuth && !ctx.isAuthenticated) {
    return {
      state: 'denied',
      canInteract: false,
      reason: 'Autentikasi operator diperlukan untuk aksi ini.',
    };
  }

  const deniedEntry = store.getDenial(capability, ctx.resourceId);
  if (deniedEntry) {
    return {
      state: 'denied',
      canInteract: false,
      reason: deniedEntry.reason,
    };
  }

  const projected = ctx.serverCapabilities?.[capability];
  if (projected) {
    if (projected === 'deny') {
      return {
        state: 'denied',
        canInteract: false,
        reason: 'Akun Anda tidak memiliki izin untuk menjalankan aksi ini.',
      };
    }
    if (projected === 'unknown' || ctx.forceUnknownScope) {
      return {
        state: 'unknown',
        canInteract: true,
      };
    }
    return {
      state: 'allowed',
      canInteract: true,
    };
  }

  if (!spec.allowedRoles.includes(ctx.role)) {
    return {
      state: 'denied',
      canInteract: false,
      reason: `Peran ${ctx.role} tidak memiliki izin untuk fitur ini.`,
    };
  }

  if (spec.attributeDependent || ctx.forceUnknownScope) {
    return {
      state: 'unknown',
      canInteract: true,
    };
  }

  return {
    state: 'allowed',
    canInteract: true,
  };
}

export function buildAuthMeCapabilities(
  role: UserRole,
  hasNonOrgScope: boolean,
  mode: 'shadow' | 'enforce' | 'partial' = 'enforce'
): Record<CapabilityKey, 'allow' | 'deny' | 'unknown'> {
  const result = {} as Record<CapabilityKey, 'allow' | 'deny' | 'unknown'>;
  (Object.keys(CAPABILITY_SPECS) as CapabilityKey[]).forEach((cap) => {
    const spec = CAPABILITY_SPECS[cap];
    if (!spec.allowedRoles.includes(role)) {
      result[cap] = mode === 'shadow' && !spec.roleOnly ? 'unknown' : 'deny';
      return;
    }
    if (spec.attributeDependent && hasNonOrgScope) {
      result[cap] = 'unknown';
      return;
    }
    result[cap] = spec.attributeDependent ? 'unknown' : 'allow';
  });
  return result;
}
