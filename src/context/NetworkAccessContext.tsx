import React, { createContext, useCallback, useContext, useState, useEffect, useMemo } from 'react';
import { AccessMode, NetworkAccessMode } from '../types/auth';
import { SystemAccessMode } from '../types/system';
import { apiClient } from '../services/api/client';
import { resolveAccessMode, resolveEffectiveAccess, resolveNetworkMode } from '../services/api/mode';

interface NetworkAccessContextType {
  mode: NetworkAccessMode;
  setMode: (mode: NetworkAccessMode) => void;
  /** Mode akses deployment (Private/Public) — dari env, bukan dari klik UI. */
  accessMode: AccessMode;
  /** Boleh mutasi pada kombinasi mode akses + kanal saat ini. */
  canMutate: boolean;
  /** Alias lama: true bila akses efektif read-only (tunnel + mode Private). */
  isReadOnly: boolean;
  /**
   * E20 P20.5 (FAT-157): nilai server `GET /api/v1/system/access-mode`
   * bila tersedia; `null` = endpoint tak tersedia (backend lama) — pakai
   * derivasi env+kanal. Konsumsi sisi panel SAJA — A10.2 belum terbuka.
   */
  serverAccessMode: SystemAccessMode | null;
  /** Ambil ulang nilai server (dipanggil AuthContext setelah login). */
  refreshServerAccessMode: () => Promise<void>;
  /** Bersihkan nilai server (dipanggil AuthContext saat logout). */
  clearServerAccessMode: () => void;
}

const NetworkAccessContext = createContext<NetworkAccessContextType | undefined>(undefined);

/**
 * Mode akses awal berasal dari env/deployment (`VITE_NETWORK_MODE`, atau
 * deteksi port tunnel `VITE_TUNNEL_PORT`, Guide D1) — BUKAN dari klik di UI.
 * `setMode` hanya dipakai tombol simulasi banner, dan tombol itu sendiri
 * terkunci di env (`VITE_ALLOW_NETWORK_MODE_SIMULATION`, default mati).
 */
export const NetworkAccessProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [mode, setModeState] = useState<NetworkAccessMode>(() => {
    const initial = resolveNetworkMode();
    apiClient.setNetworkMode(initial);
    return initial;
  });

  const setMode = (newMode: NetworkAccessMode) => {
    setModeState(newMode);
    apiClient.setNetworkMode(newMode);
  };

  useEffect(() => {
    apiClient.setNetworkMode(mode);
  }, [mode]);

  // E20 P20.5 (FAT-157): nilai server `GET /api/v1/system/access-mode`
  // (09:23) — prefer server bila tersedia. Endpoint tak tersedia
  // (404/401 pada backend lama) → `null`, fallback ke derivasi env+kanal
  // di bawah; JANGAN pecah. Dipanggil setelah login (AuthContext).
  const [serverAccessMode, setServerAccessMode] = useState<SystemAccessMode | null>(null);
  const refreshServerAccessMode = useCallback(async () => {
    try {
      const res = await apiClient.getSystemAccessMode();
      setServerAccessMode(res);
    } catch {
      setServerAccessMode(null);
    }
  }, []);
  const clearServerAccessMode = useCallback(() => setServerAccessMode(null), []);

  // Mode akses berasal dari env (VITE_ACCESS_MODE, default `private`) dan
  // stabil selama sesi — perubahan env = build/deploy ulang. Akses efektif
  // dihitung dari mode + kanal saat ini: LAN selalu boleh mutasi, tunnel
  // hanya bila mode `public`.
  const envAccessMode = useMemo(() => resolveAccessMode(), []);
  const envEffective = resolveEffectiveAccess(mode);
  // Prefer server: mode + mutations_allowed dari server bila ada — ini
  // yang menentukan UI read-only vs read-write. `mode` (kanal lokal)
  // tetap otoritas lokal (deteksi port + simulasi env-locked); channel
  // server hanya informatif dan tidak menggeser state kanal lokal.
  const accessMode: AccessMode = serverAccessMode?.mode ?? envAccessMode;
  const effectiveCanMutate = serverAccessMode ? serverAccessMode.mutations_allowed : envEffective.canMutate;

  return (
    <NetworkAccessContext.Provider
      value={{
        mode,
        setMode,
        accessMode,
        canMutate: effectiveCanMutate,
        isReadOnly: !effectiveCanMutate,
        serverAccessMode,
        refreshServerAccessMode,
        clearServerAccessMode,
      }}
    >
      {children}
    </NetworkAccessContext.Provider>
  );
};

export const useNetworkAccess = () => {
  const ctx = useContext(NetworkAccessContext);
  if (!ctx) throw new Error('useNetworkAccess must be used within NetworkAccessProvider');
  return ctx;
};
