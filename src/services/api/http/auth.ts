/**
 * Method HTTP — domain auth.
 *
 * Dipisah dari file god-file pada refactoring R9 (kontrak docs/DIRECTORY_STRUCTURE.md).
 * Satu file = satu domain. Barrel penggabung ada di file induknya.
 */
import { MUTATION_TIMEOUT_MS, httpToken, httpRefreshToken, assertLanForMutation, assertAuthenticatedHttp, reqJson, checkAbortHttp, setHttpToken, setRefreshToken, getStoredRefreshToken, setTokenAuthzVersion } from './transport';
import { mapAuthMe } from './mappers';
import { mustParse } from './primitives';
import { ADMIN_ENDPOINTS } from '../endpoints';
import { AuthMeResponseSchema, LoginResponseSchema, RefreshResponseSchema } from '../schemas';
import { ApiError, LoginResponse, AuthMeResponse } from '../../../types/auth';

export const httpAuth = {
  // -- Auth (4 ops, Guide §4.4; login + ganti-password digate LAN) ---------
  // E29 (FAT-241, Spec 044): login admin HANYA via POST /auth/admin/login,
  // body STRICT {operator_id, password} — station_id DITOLAK server 400
  // (VALIDATION_ERROR) bila dikirim. assertLanForMutation tetap di baris
  // pertama: lolos di Vercel karena deteksi port menghasilkan 'LAN'
  // (verdict T4, FAT-243) — BUKAN pengecualian bootstrap.
  async login(operator_id: string, password?: string): Promise<LoginResponse> {
    assertLanForMutation();
    const parsed = await reqJson(
      {
        method: 'POST',
        path: ADMIN_ENDPOINTS.AUTH_ADMIN_LOGIN.buildPath(),
        body: { operator_id: operator_id.trim(), password: password ?? '' },
        timeoutMs: MUTATION_TIMEOUT_MS,
        retry: false,
        endpointKey: 'AUTH_ADMIN_LOGIN',
      },
      (raw) => LoginResponseSchema.parse(raw),
    );
    setHttpToken(parsed.token);
    // FAT-289: refresh token terpisah — simpan bila server mengirimnya.
    // `?? null` = backend lama (tanpa refresh_token) menghapus refresh
    // token basi dari sesi sebelumnya; tanpa itu alur identik hari ini.
    setRefreshToken(parsed.refresh_token ?? null);
    return parsed;
  },

  // E29 (FAT-245, T6): refresh BUKAN mutasi — spec /auth/refresh hanya
  // mengenal 200/400/401 (tanpa 403), jadi refreshSession TIDAK digate
  // assertLanForMutation. Sliding refresh tidak boleh mati hanya karena
  // kanal REMOTE_TUNNEL; 401 tetap berakhir logout via hook onUnauthorized.
  // changePassword di bawah TETAP digate (mutasi nyata).
  async refreshSession(): Promise<{ token: string; expires_in: number; authz_version: number }> {
    // FAT-289: refresh memakai refresh token TERPISAH bila ada — dari
    // memori dulu, lalu simpanan (sesudah reload, modul baru sehingga
    // memori kosong; restore menghidrasi keduanya sebelum memanggil ini).
    // Fallback ke access token (httpToken) bila tidak ada — alur persis
    // seperti hari ini untuk backend lama yang tidak mengirim refresh_token.
    const refreshToken = httpRefreshToken ?? getStoredRefreshToken();
    if (!refreshToken && !httpToken) throw new ApiError({ code: 'UNAUTHORIZED', message: 'Tidak ada sesi untuk di-refresh.', httpStatus: 401 });
    let parsed: { token: string; expires_in: number; authzVersion?: number; refresh_token?: string };
    try {
      parsed = await reqJson(
        {
          method: 'POST',
          path: ADMIN_ENDPOINTS.AUTH_REFRESH.buildPath(),
          // FAT-289: refresh token dikirim dalam field `{ token }` yang
          // SAMA dengan kontrak lama — endpoint /auth/refresh hanya
          // mengenal `{ token }` (OpenAPI live). Server membedakan
          // access vs refresh token dari nilainya. ASUMSI (belum
          // terverifikasi — backend masih dikerjakan): bila backend
          // ternyata memakai field `{ refresh_token }` sendiri, satu
          // baris ini yang diubah. Body STRICT seperti Spec 044: field
          // tak dikenal bisa ditolak 400, jadi jangan kirim keduanya.
          body: { token: refreshToken ?? httpToken },
          timeoutMs: MUTATION_TIMEOUT_MS,
          retry: false,
          endpointKey: 'AUTH_REFRESH',
        },
        (raw) => RefreshResponseSchema.parse(raw),
      );
    } catch (err) {
      // FAT-289: refresh 401 = kredensial mati — hapus KEDUA token di
      // sini (sumber), agar jaminan ini tidak bergantung pada wiring
      // hook onUnauthorized pemanggil (logout AuthContext juga
      // membersihkan via setSessionActive(false) — idempotent).
      if (err instanceof ApiError && err.httpStatus === 401) {
        setHttpToken(null);
        setRefreshToken(null);
      }
      throw err;
    }
    setHttpToken(parsed.token);
    // FAT-289: rotasi — server boleh mengirim refresh_token baru; simpan
    // bila ada. Bila respons tidak membawa (backend lama), refresh token
    // lama tetap berlaku — jangan hapus.
    if (parsed.refresh_token) setRefreshToken(parsed.refresh_token);
    // §L: refresh mengembalikan `authzVersion` hasil baca ulang identitas
    // dari database (FR-037-10/11) — BUKAN variabel modul (dulu selalu 0).
    const authzVersion = parsed.authzVersion ?? 0;
    setTokenAuthzVersion(authzVersion);
    return { token: parsed.token, expires_in: parsed.expires_in, authz_version: authzVersion };
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
