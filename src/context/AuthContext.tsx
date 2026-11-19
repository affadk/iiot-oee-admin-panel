import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { AuthMeResponse, LoginResponse, UserRole } from '../types/auth';
import { apiClient } from '../services/api/client';
import { resolveAuthTtlFallbackSec } from '../services/api/mode';
import {
  CapabilityKey,
  CapabilityState,
  capabilityDenialStore,
  evaluateCapability,
} from '../utils/capabilities';
import { useNetworkAccess } from './NetworkAccessContext';

interface AuthContextType {
  currentUser: {
    operator_id: string;
    name: string;
    role: UserRole;
    line_id?: string;
  };
  isAuthenticated: boolean;
  sessionTtlRemaining: number;
  sessionExpiredReason: string | null;
  clearSessionExpiredReason: () => void;
  authzVersion: number;
  authMe: AuthMeResponse | null;
  /**
   * Spec 043 (§L) — gerbang ganti-password-wajib: true = password sementara,
   * pengguna HARUS ganti password sebelum navigasi lain (tanpa jalur kedua).
   */
  mustChangePassword: boolean;
  clearMustChangePassword: () => void;
  login: (operator_id: string, password?: string, station_id?: string) => Promise<LoginResponse>;
  // TIDAK ADA setRole: ganti peran HANYA lewat login — logout dulu, lalu
  // login sebagai operator lain. Pengalih peran langsung dari Topbar sudah
  // dihapus (bukan perilaku standar; peran berasal dari token /auth/me).
  logout: (reason?: string) => void;
  changePassword: (currentPassword: string, newPassword: string) => Promise<{ success: boolean; message: string }>;
  refreshCapabilities: () => Promise<void>;
  reportForbidden: (capability: CapabilityKey, resourceId?: string, reason?: string) => void;
  checkCapability: (
    capability: CapabilityKey,
    resourceId?: string
  ) => { state: CapabilityState; canInteract: boolean; reason?: string };
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const DEFAULT_FALLBACK_TTL = resolveAuthTtlFallbackSec();

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { mode, accessMode, refreshServerAccessMode, clearServerAccessMode } = useNetworkAccess();
  // Guide §4.4/D5: tidak ada sesi pra-login. Pengguna HARUS login lewat
  // /login; AuthProvider tidak lagi start sebagai ADM-001.
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(false);
  const [currentUser, setCurrentUser] = useState<{
    operator_id: string;
    name: string;
    role: UserRole;
    line_id?: string;
  }>({
    operator_id: '',
    name: '',
    role: 'UNASSIGNED',
    line_id: undefined,
  });
  const [mustChangePassword, setMustChangePassword] = useState<boolean>(false);
  const [sessionTtlRemaining, setSessionTtlRemaining] = useState<number>(0);
  const [sessionTtlTotal, setSessionTtlTotal] = useState<number>(0);
  const [sessionExpiredReason, setSessionExpiredReason] = useState<string | null>(null);
  const [authzVersion, setAuthzVersion] = useState<number>(0);
  const [authMe, setAuthMe] = useState<AuthMeResponse | null>(null);
  const [, setDenialRevision] = useState<number>(0);

  const refreshInFlightRef = useRef<Promise<void> | null>(null);

  // Re-render consumers whenever dynamic 403 denials change
  useEffect(() => {
    return capabilityDenialStore.subscribe(() => {
      setDenialRevision((r) => r + 1);
    });
  }, []);

  const refreshCapabilities = useCallback(async () => {
    if (!isAuthenticated) return;
    try {
      const me = await apiClient.getAuthMe();
      setAuthMe(me);
      setAuthzVersion(me.authzVersion);
      // Spec 043: flag gerbang juga dibaca dari GET /auth/me.
      if (typeof me.operator.mustChangePassword === 'boolean') {
        setMustChangePassword(me.operator.mustChangePassword);
      }
    } catch {
      // Fall back cleanly if unauthenticated or offline
    }
  }, [isAuthenticated]);

  const clearSessionExpiredReason = useCallback(() => {
    setSessionExpiredReason(null);
  }, []);

  const clearMustChangePassword = useCallback(() => {
    setMustChangePassword(false);
  }, []);

  const logout = useCallback((reason?: string) => {
    capabilityDenialStore.clearAll();
    apiClient.setSessionActive(false, null);
    // E20 P20.5 (FAT-157): bersihkan nilai server access-mode — sesi
    // berikutnya mengambil ulang dari server (bila ada).
    clearServerAccessMode();
    setIsAuthenticated(false);
    setAuthMe(null);
    setMustChangePassword(false);
    setSessionTtlRemaining(0);
    if (reason) {
      setSessionExpiredReason(reason);
    }
  }, [clearServerAccessMode]);

  const reportForbidden = useCallback(
    (capability: CapabilityKey, resourceId?: string, reason?: string) => {
      capabilityDenialStore.recordDenial(capability, resourceId, reason);
    },
    []
  );

  // Wire centralized 401 & 403 handlers in apiClient
  useEffect(() => {
    apiClient.setAuthHooks({
      onUnauthorized: (reason) => {
        logout(reason || 'Sesi operator telah berakhir atau token tidak valid. Silakan login ulang.');
      },
      onForbidden: (cap, resourceId, reason) => {
        capabilityDenialStore.recordDenial(cap, resourceId, reason);
      },
      // Spec 043: 403 PASSWORD_ROTATION_REQUIRED dari rute terproteksi
      // mengaktifkan gerbang ganti-password-wajib.
      onPasswordRotationRequired: () => {
        setMustChangePassword(true);
      },
    });
  }, [logout]);

  // Initial GET /api/v1/auth/me load
  useEffect(() => {
    if (isAuthenticated) {
      refreshCapabilities();
      // E20 P20.5 (FAT-157): ambil nilai server access-mode setelah login;
      // gagal (404/401 backend lama) → fallback env+kanal, jangan pecah.
      refreshServerAccessMode();
    }
  }, [isAuthenticated, currentUser.role, currentUser.operator_id, refreshCapabilities, refreshServerAccessMode]);

  const login = useCallback(async (operator_id: string, password?: string, station_id?: string) => {
    capabilityDenialStore.clearAll();
    const res = await apiClient.login(operator_id, password, station_id);
    setSessionExpiredReason(null);
    setCurrentUser({
      operator_id: res.operator.id,
      name: res.operator.username,
      role: res.operator.role,
      line_id: res.operator.line_id,
    });
    setIsAuthenticated(true);
    const ttl = res.expires_in || DEFAULT_FALLBACK_TTL;
    setSessionTtlTotal(ttl);
    setSessionTtlRemaining(ttl);
    // Spec 043: flag gerbang dari respons login 200 (operator.must_change_password).
    setMustChangePassword(res.operator.must_change_password === true);
    try {
      const me = await apiClient.getAuthMe();
      setAuthMe(me);
      setAuthzVersion(me.authzVersion);
      if (typeof me.operator.mustChangePassword === 'boolean') {
        setMustChangePassword(me.operator.mustChangePassword);
      }
    } catch {
      // Ignored if auth/me unavailable immediately
    }
    return res;
  }, []);

  const changePassword = useCallback(async (currentPassword: string, newPassword: string) => {
    const result = await apiClient.changePassword(currentPassword, newPassword);
    // Sukses ganti password menutup gerbang rotasi (spec 043).
    if (result.success) setMustChangePassword(false);
    return result;
  }, []);

  // Session TTL countdown + proactive single-flight sliding refresh at 80% elapsed (20% remaining, LAN only)
  useEffect(() => {
    if (!isAuthenticated) return;
    const refreshThreshold = Math.max(1, Math.floor(sessionTtlTotal * 0.2));
    const interval = setInterval(() => {
      setSessionTtlRemaining((prev) => {
        if (prev <= 1) {
          logout('Waktu sesi operator habis. Silakan masuk kembali.');
          return 0;
        }
        const next = prev - 1;
        // Refresh proactively at <= 20% remaining (80% elapsed) when on LAN
        if (next === refreshThreshold && mode === 'LAN' && !refreshInFlightRef.current) {
          refreshInFlightRef.current = apiClient
            .refreshSession()
            .then((refreshed) => {
              const nextTotal = refreshed.expires_in || DEFAULT_FALLBACK_TTL;
              setSessionTtlTotal(nextTotal);
              setSessionTtlRemaining(nextTotal);
              refreshCapabilities();
            })
            .catch(() => {
              // Handled cleanly by 401 hook if expired
            })
            .finally(() => {
              refreshInFlightRef.current = null;
            });
        }
        return next;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [isAuthenticated, sessionTtlTotal, mode, logout, refreshCapabilities]);

  const checkCapability = useCallback(
    (capability: CapabilityKey, resourceId?: string) => {
      return evaluateCapability(capability, {
        role: currentUser.role,
        networkMode: mode,
        accessMode,
        isAuthenticated,
        resourceId,
        serverCapabilities: authMe?.capabilities ?? null,
      });
    },
    [currentUser.role, mode, accessMode, isAuthenticated, authMe]
  );

  return (
    <AuthContext.Provider
      value={{
        currentUser,
        isAuthenticated,
        sessionTtlRemaining,
        sessionExpiredReason,
        clearSessionExpiredReason,
        authzVersion,
        authMe,
        mustChangePassword,
        clearMustChangePassword,
        login,
        logout,
        changePassword,
        refreshCapabilities,
        reportForbidden,
        checkCapability,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within an AuthProvider');
  return ctx;
};

export const useCapability = (capability: CapabilityKey, resourceId?: string) => {
  const { checkCapability } = useAuth();
  return checkCapability(capability, resourceId);
};
