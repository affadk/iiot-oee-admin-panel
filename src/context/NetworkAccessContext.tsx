import React, { createContext, useContext, useState, useEffect } from 'react';
import { NetworkAccessMode } from '../types/auth';
import { apiClient } from '../services/api/client';

interface NetworkAccessContextType {
  mode: NetworkAccessMode;
  setMode: (mode: NetworkAccessMode) => void;
  isReadOnly: boolean;
}

const NetworkAccessContext = createContext<NetworkAccessContextType | undefined>(undefined);

function detectInitialNetworkMode(): NetworkAccessMode {
  if (typeof window !== 'undefined' && window.location.port === '8080') {
    return 'REMOTE_TUNNEL';
  }
  return 'LAN';
}

export const NetworkAccessProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [mode, setModeState] = useState<NetworkAccessMode>(() => {
    const initial = detectInitialNetworkMode();
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
