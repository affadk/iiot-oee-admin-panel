import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { AuthMeResponse, UserRole } from '../types/auth';
import { apiClient } from '../services/api/client';
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
  login: (operator_id: string, password?: string, station_id?: string) => Promise<void>;
  setRole: (role: UserRole) => void;
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

const DEFAULT_FALLBACK_TTL = Number(import.meta.env.VITE_AUTH_TTL_FALLBACK_SEC || 900);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { mode } = useNetworkAccess();
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(true);
  const [currentUser, setCurrentUser] = useState<{
    operator_id: string;
    name: string;
    role: UserRole;
    line_id?: string;
  }>({
    operator_id: 'ADM-001',
    name: 'Alexandria Vance',
    role: 'ADMIN',
    line_id: 'ORG-ALL',
  });
  const [sessionTtlRemaining, setSessionTtlRemaining] = useState<number>(DEFAULT_FALLBACK_TTL);
  const [sessionTtlTotal, setSessionTtlTotal] = useState<number>(DEFAULT_FALLBACK_TTL);
  const [sessionExpiredReason, setSessionExpiredReason] = useState<string | null>(null);
  const [authzVersion, setAuthzVersion] = useState<number>(7);
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
    } catch {
      // Fall back cleanly if unauthenticated or offline
    }
  }, [isAuthenticated]);

  const clearSessionExpiredReason = useCallback(() => {
    setSessionExpiredReason(null);
  }, []);

  const logout = useCallback((reason?: string) => {
    capabilityDenialStore.clearAll();
    apiClient.setSessionActive(false, null);
    setIsAuthenticated(false);
    setAuthMe(null);
    setSessionTtlRemaining(0);
    if (reason) {
      setSessionExpiredReason(reason);
    }
  }, []);

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
    });
  }, [logout]);

  // Initial GET /api/v1/auth/me load
  useEffect(() => {
    if (isAuthenticated) {
      refreshCapabilities();
    }
  }, [isAuthenticated, currentUser.role, currentUser.operator_id, refreshCapabilities]);

  const setRole = useCallback((role: UserRole) => {
    capabilityDenialStore.clearAll();
    apiClient.setUserRole(role);
    apiClient.setSessionActive(true);
    setSessionExpiredReason(null);
    setIsAuthenticated(true);
    setSessionTtlTotal(DEFAULT_FALLBACK_TTL);
    setSessionTtlRemaining(DEFAULT_FALLBACK_TTL);
    const matchedNames: Record<UserRole, { id: string; name: string; line: string }> = {
      ADMIN: { id: 'ADM-001', name: 'Alexandria Vance', line: 'ORG-ALL' },
      SUPERVISOR: { id: 'SUP-042', name: 'Marcus Reinhardt', line: 'LINE-01' },
      OPERATOR: { id: 'OP-115', name: 'Kenji Sato', line: 'LINE-01' },
      MAINTENANCE: { id: 'MNT-208', name: 'Elena Rostova', line: 'LINE-02' },
    };
    const info = matchedNames[role];
    setCurrentUser({
      operator_id: info.id,
      name: info.name,
      role,
      line_id: info.line,
    });
  }, []);

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
    try {
      const me = await apiClient.getAuthMe();
      setAuthMe(me);
      setAuthzVersion(me.authzVersion);
    } catch {
      // Ignored if auth/me unavailable immediately
    }
  }, []);

  const changePassword = useCallback(async (currentPassword: string, newPassword: string) => {
    return apiClient.changePassword(currentPassword, newPassword);
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
        isAuthenticated,
        resourceId,
        serverCapabilities: authMe?.capabilities ?? null,
      });
    },
    [currentUser.role, mode, isAuthenticated, authMe]
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
        login,
        setRole,
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
