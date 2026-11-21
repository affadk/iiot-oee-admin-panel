/**
 * Kapabilitas auth: /auth/me + checkCapability + denial 403
 * (FAT-282 / E32.1).
 *
 * Diekstrak dari AuthContext: satu hook = satu alur (aturan R4).
 * Hook ini memiliki state authMe/authzVersion dan tiga tanggung jawab
 * yang saling terkait: memuat /auth/me, mengevaluasi capability
 * (role + kanal + mode akses + denial 403 dinamis), dan mencatat
 * denial 403 ke capabilityDenialStore.
 *
 * Perilaku dipertahankan persis dari AuthContext sebelum split:
 * - refreshCapabilities diam bila belum terautentikasi / gagal fetch.
 * - loadAuthMe tanpa guard isAuthenticated — dipakai login tepat
 *   setelah applySession, saat state isAuthenticated di closure login
 *   masih false (karena itu login dulu memanggil getAuthMe inline).
 * - Flag gerbang ganti-password-wajib (Spec 043) juga dibaca dari
 *   GET /auth/me dan diteruskan lewat onMustChangePassword.
 */
import { useCallback, useEffect, useState } from 'react';
import { AccessMode, AuthMeResponse, NetworkAccessMode, UserRole } from '../types/auth';
import { apiClient } from '../services/api/client';
import {
  CapabilityKey,
  CapabilityState,
  capabilityDenialStore,
  evaluateCapability,
} from '../utils/capabilities';

export interface AuthCapabilities {
  authMe: AuthMeResponse | null;
  authzVersion: number;
  /** Muat ulang /auth/me bila sudah terautentikasi; diam bila belum / gagal. */
  refreshCapabilities: () => Promise<void>;
  /** Muat /auth/me tanpa guard isAuthenticated — dipakai login. */
  loadAuthMe: () => Promise<void>;
  /** Bersihkan authMe saat logout (authzVersion sengaja TIDAK direset — perilaku lama). */
  clearAuthMe: () => void;
  reportForbidden: (capability: CapabilityKey, resourceId?: string, reason?: string) => void;
  checkCapability: (
    capability: CapabilityKey,
    resourceId?: string
  ) => { state: CapabilityState; canInteract: boolean; reason?: string };
}

export function useAuthCapabilities(args: {
  isAuthenticated: boolean;
  role: UserRole;
  networkMode: NetworkAccessMode;
  accessMode: AccessMode;
  onMustChangePassword: (value: boolean) => void;
}): AuthCapabilities {
  const { isAuthenticated, role, networkMode, accessMode, onMustChangePassword } = args;
  const [authMe, setAuthMe] = useState<AuthMeResponse | null>(null);
  const [authzVersion, setAuthzVersion] = useState<number>(0);
  const [, setDenialRevision] = useState<number>(0);

  // Re-render consumers whenever dynamic 403 denials change
  useEffect(() => {
    return capabilityDenialStore.subscribe(() => {
      setDenialRevision((r) => r + 1);
    });
  }, []);

  const loadAuthMe = useCallback(async () => {
    try {
      const me = await apiClient.getAuthMe();
      setAuthMe(me);
      setAuthzVersion(me.authzVersion);
      // Spec 043: flag gerbang juga dibaca dari GET /auth/me.
      if (typeof me.operator.mustChangePassword === 'boolean') {
        onMustChangePassword(me.operator.mustChangePassword);
      }
    } catch {
      // Fall back cleanly if unauthenticated or offline
    }
  }, [onMustChangePassword]);

  const refreshCapabilities = useCallback(async () => {
    if (!isAuthenticated) return;
    await loadAuthMe();
  }, [isAuthenticated, loadAuthMe]);

  const clearAuthMe = useCallback(() => {
    setAuthMe(null);
  }, []);

  const reportForbidden = useCallback(
    (capability: CapabilityKey, resourceId?: string, reason?: string) => {
      capabilityDenialStore.recordDenial(capability, resourceId, reason);
    },
    []
  );

  const checkCapability = useCallback(
    (capability: CapabilityKey, resourceId?: string) => {
      return evaluateCapability(capability, {
        role,
        networkMode,
        accessMode,
        isAuthenticated,
        resourceId,
        serverCapabilities: authMe?.capabilities ?? null,
      });
    },
    [role, networkMode, accessMode, isAuthenticated, authMe]
  );

  return {
    authMe,
    authzVersion,
    refreshCapabilities,
    loadAuthMe,
    clearAuthMe,
    reportForbidden,
    checkCapability,
  };
}
