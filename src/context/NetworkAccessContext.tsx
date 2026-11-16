import React, { createContext, useContext, useState, useEffect, useMemo } from 'react';
import { AccessMode, NetworkAccessMode } from '../types/auth';
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

  // Mode akses berasal dari env (VITE_ACCESS_MODE, default `private`) dan
  // stabil selama sesi — perubahan env = build/deploy ulang. Akses efektif
  // dihitung dari mode + kanal saat ini: LAN selalu boleh mutasi, tunnel
  // hanya bila mode `public`.
  const accessMode = useMemo(() => resolveAccessMode(), []);
  const effective = resolveEffectiveAccess(mode);

  return (
    <NetworkAccessContext.Provider
      value={{
        mode,
        setMode,
        accessMode,
        canMutate: effective.canMutate,
        isReadOnly: !effective.canMutate,
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
