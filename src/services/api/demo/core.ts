/**
 * Method inti demo (sesi, mode jaringan, peran).
 *
 * Dipisah dari file god-file pada refactoring R9 (kontrak docs/DIRECTORY_STRUCTURE.md).
 * Satu file = satu domain. Barrel penggabung ada di file induknya.
 */
import { store } from './store';
import { AuthClientHooks } from './helpers';
import { AdminEndpointKey } from '../endpoints';
import { UserRole, NetworkAccessMode } from '../../../types/auth';

export const demoCore = {
  setAuthHooks(hooks: AuthClientHooks) {
    store.hooks = hooks;
  },

  getCalledEndpointKeys(): AdminEndpointKey[] {
    return Array.from(store.endpointCalls.keys());
  },

  resetEndpointTracker() {
    store.endpointCalls.clear();
  },

  setNetworkMode(mode: NetworkAccessMode) {
    store.networkAccessMode = mode;
  },

  getNetworkMode(): NetworkAccessMode {
    return store.networkAccessMode;
  },

  setUserRole(role: UserRole) {
    store.currentUserRole = role;
    store.tokenAuthzVersion = store.iamInfo.authzVersion;
    const match = store.operators.find((o) => o.role === role);
    if (match) {
      store.currentUserId = match.operator_id;
      store.currentUserName = match.name;
      store.currentUserLineId = match.line_id;
    }
  },

  getUserRole(): UserRole {
    return store.currentUserRole;
  },

  setTokenAuthzVersion(version: number) {
    store.tokenAuthzVersion = version;
  },

  setIamMode(mode: 'shadow' | 'enforce' | 'partial') {
    store.iamInfo.mode = mode;
  },

  setSessionActive(active: boolean, token?: string | null) {
    store.isAuthenticated = active;
    store.authToken = active ? (token ?? `mem_jwt_${Date.now()}`) : null;
    if (active) {
      store.tokenAuthzVersion = store.iamInfo.authzVersion;
    }
  }
};
