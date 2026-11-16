import React, { createContext, useContext, useState, useEffect } from 'react';
import { NetworkAccessMode } from '../types/auth';
import { apiClient } from '../services/api/client';
import { resolveNetworkMode } from '../services/api/mode';

interface NetworkAccessContextType {
  mode: NetworkAccessMode;
  setMode: (mode: NetworkAccessMode) => void;
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

  return (
    <NetworkAccessContext.Provider
      value={{
        mode,
        setMode,
        isReadOnly: mode === 'REMOTE_TUNNEL',
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
