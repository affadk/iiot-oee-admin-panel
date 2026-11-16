/**
 * Method HTTP — domain auth.
 *
 * Dipisah dari file god-file pada refactoring R9 (kontrak docs/DIRECTORY_STRUCTURE.md).
 * Satu file = satu domain. Barrel penggabung ada di file induknya.
 */
import { MUTATION_TIMEOUT_MS, httpToken, tokenAuthzVersion, assertLanForMutation, assertAuthenticatedHttp, reqJson, checkAbortHttp, setHttpToken } from './transport';
import { mapAuthMe } from './mappers';
import { mustParse } from './primitives';
import { ADMIN_ENDPOINTS } from '../endpoints';
import { AuthMeResponseSchema, LoginResponseSchema, RefreshResponseSchema } from '../schemas';
import { ApiError, LoginResponse, AuthMeResponse } from '../../../types/auth';

export const httpAuth = {
  // -- Auth (4 ops, Guide §4.4; login/refresh LAN-only) --------------------
  async login(operator_id: string, password?: string, station_id?: string): Promise<LoginResponse> {
    assertLanForMutation();
    const parsed = await reqJson(
      {
        method: 'POST',
        path: ADMIN_ENDPOINTS.AUTH_LOGIN.buildPath(),
        body: { operator_id: operator_id.trim(), password: password ?? '', ...(station_id ? { station_id } : {}) },
        timeoutMs: MUTATION_TIMEOUT_MS,
        retry: false,
        endpointKey: 'AUTH_LOGIN',
      },
      (raw) => LoginResponseSchema.parse(raw),
    );
    setHttpToken(parsed.token);
    return parsed;
  },

  async refreshSession(): Promise<{ token: string; expires_in: number; authz_version: number }> {
    assertLanForMutation();
    if (!httpToken) throw new ApiError({ code: 'UNAUTHORIZED', message: 'Tidak ada sesi untuk di-refresh.', httpStatus: 401 });
    const parsed = await reqJson(
      {
        method: 'POST',
        path: ADMIN_ENDPOINTS.AUTH_REFRESH.buildPath(),
        body: { token: httpToken },
        timeoutMs: MUTATION_TIMEOUT_MS,
        retry: false,
        endpointKey: 'AUTH_REFRESH',
      },
      (raw) => RefreshResponseSchema.parse(raw),
    );
    setHttpToken(parsed.token);
    return { token: parsed.token, expires_in: parsed.expires_in, authz_version: tokenAuthzVersion };
  },

  async changePassword(currentPassword: string, newPassword: string): Promise<{ success: boolean; message: string }> {
    assertAuthenticatedHttp();
    assertLanForMutation();
    const raw = await reqJson<{ success?: boolean; message?: string }>({
      method: 'POST',
      path: ADMIN_ENDPOINTS.AUTH_CHANGE_PASSWORD.buildPath(),
      // API doc §L: {current_password, new_password}. (Guide Lamp. J menulis
      // old_password — dicatat sebagai diskrepansi di AUDIT.md.)
      body: { current_password: currentPassword, new_password: newPassword },
      timeoutMs: MUTATION_TIMEOUT_MS,
      retry: false,
      endpointKey: 'AUTH_CHANGE_PASSWORD',
    });
    return { success: raw?.success ?? true, message: raw?.message ?? 'Password berhasil diperbarui.' };
  },

  async getAuthMe(signal?: AbortSignal): Promise<AuthMeResponse> {
    checkAbortHttp(signal);
    assertAuthenticatedHttp();
    return reqJson(
      { path: ADMIN_ENDPOINTS.AUTH_ME.buildPath(), signal, endpointKey: 'AUTH_ME' },
      (raw) => {
        const mapped = mapAuthMe(raw);
        return mustParse(AuthMeResponseSchema, mapped, 'auth/me');
      },
    );
  }
};
