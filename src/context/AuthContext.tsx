import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { AuthMeResponse, LoginResponse, UserRole } from '../types/auth';
import { apiClient } from '../services/api/client';
import { useSessionRestore, type SessionUser } from './authSessionRestore';
import { useSessionTtl, DEFAULT_AUTH_TTL_FALLBACK_SEC } from './useSessionTtl';
import { useAuthCapabilities } from './useAuthCapabilities';
import { CapabilityKey, CapabilityState, capabilityDenialStore } from '../utils/capabilities';
import { useNetworkAccess } from './NetworkAccessContext';

interface AuthContextType {
  currentUser: {
    operator_id: string;
    name: string;
    role: UserRole;
    line_id?: string;
  };
  isAuthenticated: boolean;
  /** FAT-280 Opsi B: true selama silent restore dari sessionStorage berjalan. */
  isRestoringSession: boolean;
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
  // E29 (FAT-242, Spec 044): login admin 2-arg — station_id dihapus
  // bersama endpoint lama (T3). Signature 3-param Batch A sudah dihapus.
  login: (operator_id: string, password?: string) => Promise<LoginResponse>;
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
  const [sessionExpiredReason, setSessionExpiredReason] = useState<string | null>(null);

  // FAT-282 (E32.1): /auth/me + checkCapability + denial 403 tinggal di
  // useAuthCapabilities; TTL + sliding refresh tinggal di useSessionTtl.
  const {
    authMe,
    authzVersion,
    refreshCapabilities,
    loadAuthMe,
    clearAuthMe,
    reportForbidden,
    checkCapability,
  } = useAuthCapabilities({
    isAuthenticated,
    role: currentUser.role,
    networkMode: mode,
    accessMode,
    onMustChangePassword: setMustChangePassword,
  });

  // logout dipakai useSessionTtl (onExpire) tapi juga butuh setSessionTtl
  // dari hook itu — putaran ini dipecah lewat ref: handleSessionExpire
  // stabil dan memanggil logoutRef.current, yang diisi setelah render
  // pertama (jauh sebelum TTL bisa habis — TTL hanya jalan saat
  // isAuthenticated, dan ref terisi saat mount).
  const logoutRef = useRef<(reason?: string) => void>(() => {});
  const handleSessionExpire = useCallback((reason: string) => {
    logoutRef.current(reason);
  }, []);

  const { sessionTtlRemaining, setSessionTtl } = useSessionTtl({
    isAuthenticated,
    onExpire: handleSessionExpire,
    onRefreshed: refreshCapabilities,
  });

  const logout = useCallback((reason?: string) => {
    capabilityDenialStore.clearAll();
    apiClient.setSessionActive(false, null);
    // E20 P20.5 (FAT-157): bersihkan nilai server access-mode — sesi
    // berikutnya mengambil ulang dari server (bila ada).
    clearServerAccessMode();
    setIsAuthenticated(false);
    clearAuthMe();
    setMustChangePassword(false);
    setSessionTtl(0);
    if (reason) {
      setSessionExpiredReason(reason);
    }
  }, [clearServerAccessMode, clearAuthMe, setSessionTtl]);

  useEffect(() => {
    logoutRef.current = logout;
  });

  // Terapkan sesi yang sudah terautentikasi (dipakai login + silent restore).
  const applySession = useCallback((user: SessionUser, ttl: number, mustChange: boolean) => {
    setCurrentUser(user);
    setMustChangePassword(mustChange);
    setSessionTtl(ttl);
    setIsAuthenticated(true);
  }, [setSessionTtl]);

  const isRestoringSession = useSessionRestore(applySession);

  const clearSessionExpiredReason = useCallback(() => {
    setSessionExpiredReason(null);
  }, []);

  const clearMustChangePassword = useCallback(() => {
    setMustChangePassword(false);
  }, []);

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

  // E29 (FAT-242, T3): login admin strict 2-arg — tanpa station_id
  // (Spec 044, POST /auth/admin/login). Shim 3-param Batch A dihapus.
  const login = useCallback(async (operator_id: string, password?: string) => {
    capabilityDenialStore.clearAll();
    const res = await apiClient.login(operator_id, password);
    setSessionExpiredReason(null);
    const ttl = res.expires_in || DEFAULT_AUTH_TTL_FALLBACK_SEC;
    // Spec 043: flag gerbang dari respons login 200 (operator.must_change_password).
    applySession(
      { operator_id: res.operator.id, name: res.operator.username, role: res.operator.role, line_id: res.operator.line_id },
      ttl,
      res.operator.must_change_password === true,
    );
    // loadAuthMe tanpa guard isAuthenticated: state isAuthenticated di
    // closure ini masih false (applySession di atas belum ter-commit).
    await loadAuthMe();
    return res;
  }, [applySession, loadAuthMe]);

  const changePassword = useCallback(async (currentPassword: string, newPassword: string) => {
    const result = await apiClient.changePassword(currentPassword, newPassword);
    // Sukses ganti password menutup gerbang rotasi (spec 043).
    if (result.success) setMustChangePassword(false);
    return result;
  }, []);

  return (
    <AuthContext.Provider
      value={{
        currentUser,
        isAuthenticated,
        isRestoringSession,
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
