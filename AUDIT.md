# Audit Codebase — IIoT OEE Admin Panel

**Tanggal:** 16 November 2026
**Repo:** `fadk-dev/iiot-oee-admin-panel` (branch `main`)
**Dokumen acuan:** `API_DOCUMENTATION.md` (1780 baris) + `ADMIN_PANEL_BUILD_GUIDE.md` (1553 baris)
**Hasil akhir:** `tsc --noEmit` **0 error** · `npm test` **70/70 lolos** · `npm run build` **sukses**

> Audit ini membandingkan codebase dengan kedua dokumen di atas, lalu memperbaiki
> semua gap yang ditemukan. Backend belum ada: panel berjalan dalam **mode Demo**
> (store in-memory) secara default, dengan **mode Real** (HTTP ke backend)
> yang bisa diaktifkan tanpa mengubah satu pun halaman.

---

## 1. Cara memakai mode Demo / Real

| Cara | Keterangan |
| --- | --- |
| Default | `demo` — data seed di memori, login demo `ADM-001` / password apa pun ≥ 4 karakter |
| Env | `VITE_API_MODE=demo\|real` di `.env` (lihat `.env.example`) — **satu-satunya sumber mode** |
| Topbar | Bila `VITE_ALLOW_API_MODE_SWITCH=true` (dev lokal saja): pilih **API: Demo / Real** — halaman dimuat ulang. Bila terkunci (default): Topbar hanya menampilkan badge read-only |
| Query | `?api=real` atau `?api=demo` — hanya berlaku bila switch diizinkan di env |

Prioritas saat switch diizinkan: `?api=` > `localStorage['iiot-oee-api-mode']` > `VITE_API_MODE` > `demo`.
Saat switch terkunci (default produksi): mode = `VITE_API_MODE` > `demo`; query +
localStorage diabaikan. Pilihan mode tersimpan di localStorage (bukan token — token
tetap **hanya di memori**, D5). Detail lengkap + daftar semua variabel env: lihat
§8 (audit konfigurasi env 2026-11-16).

**Mode Real butuh backend** dengan base URL `VITE_API_URL` (kosong = `origin + /api/v1`,
Nginx dual-vhost). Tanpa backend, mode Real akan gagal koneksi (pesan `NETWORK`) —
itu perilaku yang benar, bukan bug. WebSocket memakai `VITE_WS_URL` atau
`ws(s)://<host>/ws/telemetry`.

---

## 2. Temuan audit & status perbaikan

### 2.1 Gap utama (semua sudah diperbaiki)

| # | Temuan | Bukti | Perbaikan |
| --- | --- | --- | --- |
| 1 | **Tidak ada HTTP sama sekali** — `client.ts` 0 `fetch`, murni mock in-memory; tidak ada switch demo/real | `grep fetch src/services/api/client.ts` → 0 | `src/services/api/mode.ts` (resolusi mode) + `src/services/api/httpClient.ts` (transport HTTP lengkap, ~3400 baris) + selector `apiClient` di akhir `client.ts` |
| 2 | **Login demo rusak (tersembunyi)** — `login()` mem-`parse` respons dengan field `user`, padahal `LoginResponseSchema` mewajibkan `operator: {id, username, role, line_id}` → ZodError setiap login | `client.ts` lama baris ~764 | `login()` kini mengembalikan `operator`; `refreshSession()` kini menyertakan `success: true` (juga wajib skema, sebelumnya hilang) |
| 3 | **Sesi pra-login melanggar §4.4/D5** — `AuthProvider` start dengan `isAuthenticated=true` sebagai ADM-001 + token `mem_jwt_initial_admin_lan` | `AuthContext.tsx` lama | `isAuthenticated=false`, `currentUser` kosong, `authzVersion=0`, TTL 0 — pengguna **wajib login** lewat `/login` |
| 4 | **3 method client hilang** — `useProductionLinesQuery`/`useShiftsQuery`/`useShiftSchedulesQuery` memanggil `getProductionLinesPage`/`getShiftsPage`/`getShiftSchedulesPage` yang tidak ada (crash saat halaman dipakai) | diff panggilan vs definisi apiClient | Method + store + CRUD demo lengkap untuk ketiganya; halaman baru `ProductionLinesPage`, `ShiftsPage`, `ShiftSchedulesPage` + route `/admin/lines`, `/admin/shifts`, `/admin/shift-schedules` + entri Sidebar (grup Assets) |
| 5 | **Route §5 belum lengkap** — tidak ada halaman/route/sidebar untuk lines, shifts, shift-schedules | `Router.tsx` lama | Lihat #4 |
| 6 | **Trailing slash wajib hilang** — `GET /operational-events` tanpa `/` (Guide §6.7: wajib) | `endpoints.ts`, `historicalExport.ts:423` | Template + builder diubah ke `/api/v1/operational-events/`; 2 regex test lama yang mengassert path tanpa slash diperbarui |
| 7 | **`npm install` gagal** — esbuild `^0.25.0` bentrok peer vite 8.3 (`^0.27.0 \|\| ^0.28.0`) | ERESOLVE | esbuild → `^0.28.0`; install sukses (191 paket) |
| 8 | **Tidak ada test runner** — 8 file test `node:test` tapi tanpa script | `package.json` lama | `"test": "tsx --test \"src/**/*.test.ts\""` + file test baru `modeAndTransport.test.ts` (10 test) |
| 9 | **WebSocket demo reconnect-loop** — `telemetrySocket` mencoba WS sungguhan ke origin tanpa server | `telemetrySocket.ts` | Mode Demo: simulasi lokal `TELEMETRY_UPDATE` tiap 5 detik (4 device seed, jitter OEE/counter); mode Real: WS sungguhan tidak berubah |
| 10 | **Pengalih peran di Topbar tembus mode Real** — `setRole` bisa mengalihkan peran tanpa login | `AuthContext.tsx`, `Topbar.tsx` | **DIHAPUS TOTAL (2026-11-16, §8):** `AuthContext.setRole` + select Role di Topbar dihapus — ganti peran HANYA lewat login (logout dulu, login sebagai operator lain). `demoApiClient.setUserRole` dipertahankan sebagai seam store untuk test saja, tidak terjangkau UI; `httpApiClient.setUserRole` tetap no-op |
| 11 | **Komentar registry salah** — header mengklaim "111 Admin REST candidates" | `endpoints.ts:2` | Dikoreksi: **131** Admin REST candidates + 1 WebSocket = 132 |
| 12 | **`.env.example` berisi variabel AI Studio** (`GEMINI_API_KEY`, `APP_URL`) | `.env.example` lama | Dihapus; ditambah `VITE_API_MODE=demo` + komentar §4.1 |

### 2.2 Yang LOLOS audit (tidak perlu diperbaiki)

- **Safety boundary (ADR-003):** tidak ada implementasi `POST /devices/:id/command`,
  `dispatch` / `complete` / `validate-zone` / `initiate-from-zones` / `clients/provision`
  di mana pun; test `iamAndSecurity` mengassert ketiadaan method tersebut. ✅
- **Registry endpoint:** 131 pasangan method+template, mencakup 130/131 kandidat admin
  (kekurangan 1 = trailing slash #6, sudah diperbaiki). 5 operasi HMI/aktuasi
  benar-benar dikecualikan. ✅
- **Kontrak HTTP §4.2 sudah tersedia sebagai util:** `normalizeListResponse`,
  `mapHttpErrorToApiError`, `isRetryableHttpStatus`, `retryIdempotentRead`,
  envelope error, Zod schemas — dipakai ulang oleh transport baru. ✅
- **IAM fidelity §4.6g:** transport HTTP **tidak** mengirim `privilege_level`
  (body create role = `{name, description?}`) dan tidak menegakkan hierarki
  client-side; server yang memutuskan (403 final). ✅

### 2.3 Transport HTTP (mode Real) — kontrak yang dipenuhi

- Base URL `VITE_API_URL` atau `origin + /api/v1`; `/health` tanpa prefix
  (perbaikan bug: prefix sempat ganda `/api/v1/api/v1/...`, ketahuan oleh test stub).
- `Authorization: Bearer <token>` per panggilan; token **hanya di memori** (D5).
- Timeout: baca 10 dtk, mutasi 15 dtk, ekspor 120 dtk (env §4.1).
- Retry **hanya** GET yang gagal jaringan / 502 / 503 / 504, maks 3x,
  backoff eksponensial + jitter. Tidak pernah retry 4xx atau mutasi.
- Normalisasi list: array langsung **atau** `{data, meta}` (D7);
  `meta.limit` opsional (backend boleh tidak menyertakannya).
- Error envelope `{error, message, issues?, active_wo_id?}` dipetakan terpusat;
  401 → logout, 403 → capability diturunkan (AuthContext).
- Ekspor mengembalikan file: baca `Content-Disposition` + header `X-Export-*`.
- `204 No Content` (hapus dynsec) tidak diharapkan berisi JSON.
- Mutasi diblokir saat `REMOTE_TUNNEL` (D1, kecuali ekspor).
- Pemetaan casing: backend campuran camelCase/snake_case dinormalkan ke
  snake_case lokal, jadi ganti mode tidak mengubah UI.
- Seluruh 131 operasi admin tersedia di `httpApiClient` dengan **nama +
  signature identik** dengan demo client (termasuk `getTelemetryHistoryPage`,
  `getHourlyTrend`, `getRejectPareto(Global)`, `getShiftSummary`,
  `getBrokerConfig*`, `toggleIamPolicy`, `triggerReconciliationRefresh`, dll).

---

## 3. Diskrepansi antar dokumen (dicatat, bukan diasumsikan)

| # | Topik | API Documentation | Build Guide | Yang dipakai implementasi |
| --- | --- | --- | --- | --- |
| D-1 | `POST /auth/password/change` body | `{current_password, new_password}` (§L) | `{old_password, new_password}` (Lamp. J) | API doc §L |
| D-2 | `GET /auth/me` shape | `{operator, authz: {...}}` (§L) | Bentuk flat (§4.9) | **Keduanya** — `mapAuthMe` menangani kedua bentuk secara defensif |

---

## 4. Deviasi demo-only yang diketahui (terdokumentasi, bukan bug)

- **Hierarki peran demo:** demo `createIamRole` masih memvalidasi `privilege_level`
  + `CUSTOM_ROLE_MAX_LEVEL` (kini **29**, sesuai Guide §6.8/§7.1 — sebelumnya 100,
  padahal pesan error-nya sendiri menulis "(1–29)"). Backend sudah menghapus
  hierarki statis (§4.6g); transport HTTP tidak mengirim `privilege_level`.
- **Katalog permission demo = 29** (22 awal + 7 master device/lines/shifts).
  Dokumen tidak mengenumerasi jumlah katalog; test `Test B` diperbarui ke 29.
- **Kunci katalog permission memakai singular** (`ack:operational_event`,
  `create:operator`, `update:operator`) sesuai policy di API doc; bukan plural.

---

## 5. Bug pra-ada yang ikut diperbaiki (di luar gap audit, ditemukan saat verifikasi)

`tsc --noEmit` awal: **166 error** → **0**. `npm test` awal (pohon bersih):
**10 gagal** → **0 gagal** (65/65). Yang diperbaiki:

| Area | Masalah |
| --- | --- |
| `SystemHealth` | Tipe + seed hanya bentuk lean (`status: 'ok'`, tanpa `backend`/`uptime_seconds`/dst), padahal `SystemHealthPage`, `OverviewPage`, dan test kontrak membaca bentuk rich → halaman akan crash (`health.backend.status` dari `undefined`). Tipe dilebarkan ke bentuk rich, seed + mapper HTTP dilengkapi. |
| `Product` | Tipe tidak punya `sku`/`active` padahal dipakai `ProductsPage` + `createProduct`/`updateProduct`. Ditambah ke tipe + seed (4 produk). |
| `DeviceHealth.eventFlags` | Skema + seed memakai bitmask angka, tapi demo `getDeviceHealth` (2 dari 3 jalur) + drawer memakai `string[]` → `DeviceHealthSchema.parse` melempar ZodError untuk device offline/sehat. Diseragamkan ke `string[]` (seed + skema + mapper HTTP dekode bitmask). |
| `Machine` / `EdgeDevice` | Tipe ketinggalan `updated_at`, `code`, `serial_number` yang dipakai kode. Ditambah (opsional). |
| `HourlyOeePoint` / `TelemetryRollupItem` | Ketinggalan `hourly_downtime_sec`, `groupKey` (dipakai paginasi cursor). Ditambah; `getTelemetryRollup` demo tidak mengisi `groupBy`/`machineId` (ZodError) — dilengkapi di 3 cabang (machine/day/month). |
| `RejectParetoItem.pct` | Wajib di tipe tapi tidak ada di seed demo → dibuat opsional. |
| `getSystemAuditPage` | Param `event_type` dipakai pemanggil tapi tidak ada di tipe query (demo + HTTP). Ditambah + diteruskan. |
| `CUSTOM_ROLE_MAX_LEVEL` | 100, padahal Guide + pesan error sendiri bilang 29. Diubah ke 29. |
| `isSystemRoleName` | Hardcode `=== 'ADMIN'` padahal `SYSTEM_ROLE_NAMES` ada — SUPERVISOR/OPERATOR/MAINTENANCE lolos proteksi update/delete. Kini memakai array 4 nama. |
| `PaginationMetaSchema` | `limit` wajib padahal normalizer sudah fallback — dibuat opsional (D7). |
| Login di test | `iamWorkflows.test.ts` mengassert bentuk lama `loginRes.user.*` / `authz_version` (bentuk yang rusak itu) — diperbarui ke `operator.*`. |
| `refreshSession` demo | Mengembalikan `parsed.authz_version` yang tidak ada di skema — diganti sumber `store.iamInfo.authzVersion`. |

---

## 6. Yang BELUM diverifikasi (butuh backend / browser sungguhan)

- **Mode Real end-to-end:** belum ada backend untuk diuji — transport HTTP
  diverifikasi terhadap stub server lokal (`node:http` di `modeAndTransport.test.ts`:
  login, retry 503→200, trailing slash, 409 tanpa retry, header Bearer).
- **Tampilan visual di browser sungguhan:** tidak bisa dari VM ini (loopback/tunnel
  diblokir, sama seperti proyek sebelumnya). Build terverifikasi serve HTTP 200
  via `vite preview`; cek visual 3 halaman baru + Topbar (badge API read-only,
  tanpa select Role) dilakukan Fathur setelah `npm run dev`.
- **Live broker / MQTT / ESP32:** tidak ada — WebSocket mode Real belum diuji
  terhadap broker sungguhan.

---

## 7. Menjalankan

```bash
npm install        # esbuild ^0.28.0 (vite 8.3)
npm run dev        # http://localhost:3000 — login ADM-001 / password apa pun ≥4 karakter (demo)
npm run lint       # tsc --noEmit — harus 0 error
npm test           # tsx --test — harus 70/70
npm run build      # vite build (peringatan chunk >500 kB sudah ada sebelumnya)
```

File kunci: `src/services/api/mode.ts`, `src/services/api/httpClient.ts`,
`src/services/api/client.ts` (demo + selector), `src/services/api/modeAndTransport.test.ts`,
`AUDIT.md` (file ini).

---

## 8. Audit konfigurasi env — tindak lanjut 2026-11-16

**Permintaan:** konfigurasi & switch sistem yang sebaiknya di env dipindahkan
ke env; preset login demo tetap ada tapi mati di env `!demo`; tombol non-standar
di admin panel (ganti role langsung) dihapus/dipindahkan — ganti peran harus
lewat login (logout dulu).

**Temuan audit:** sebelum perbaikan, env hanya memegang 6 variabel
(`VITE_API_MODE/API_URL/WS_URL/AUTH_TTL_FALLBACK_SEC/REQUEST_TIMEOUT_MS/EXPORT_TIMEOUT_MS`)
dan kalah prioritas dari `?api=` + localStorage + select Topbar. Switch lain
hidup di UI/hardcode: select Role Topbar (ganti peran tanpa login),
tombol simulasi mode jaringan di banner (bisa mengklaim LAN palsu dari tunnel),
port tunnel `8080`, timeout mutasi 15s, retry maks 3, TTL demo `900`,
heartbeat WS 25s, backoff 30s, simulasi demo 5s, lockout login 5×/30s,
label `Plant 01`, station default — semua hardcoded; `LoginPage` selalu
prefill `ADM-001`/`Admin@2026!` + tombol preset di mode apa pun.

**Perbaikan — satu sumber kebenaran `src/services/api/mode.ts`** (semua baca
`import.meta.env`/`process.env` hanya lewat `readEnv()` di file itu):

| Konfigurasi / switch | Sebelum | Sesudah (env) |
| --- | --- | --- |
| Mode API | `?api=` > localStorage > env | **Env menang (terkunci)**; override runtime hanya bila `VITE_ALLOW_API_MODE_SWITCH=true` (dev lokal) |
| Switch mode di Topbar | Select selalu aktif | Badge read-only bila terkunci; select hanya bila switch diizinkan |
| Preset login demo | Selalu tampil + prefill di semua mode | `isDemoPresetLoginEnabled()`: hidup hanya bila mode efektif `demo` **DAN** `VITE_API_MODE ≠ real` **DAN** `VITE_DEMO_PRESET_LOGIN ≠ false` — mati total di env real, sekalipun mode dialihkan ke demo |
| Ganti role langsung | Select Role di Topbar (`AuthContext.setRole`) | **Dihapus**: `setRole` + select dihapus; ganti peran = logout → login sebagai operator lain. `demoApiClient.setUserRole` tinggal seam test, tak terjangkau UI |
| Simulasi mode jaringan | Tombol "Mode Remote Tunnel" / "Kembali ke LAN" selalu tampil | Banner jadi indikator saja; tombol hanya bila `VITE_ALLOW_NETWORK_MODE_SIMULATION=true` (dev lokal) |
| Deteksi jaringan D1 | Port `8080` hardcoded | `VITE_NETWORK_MODE` (override) + `VITE_TUNNEL_PORT` (default 8080) |
| Timeout mutasi / retry | `15_000` / `3` hardcoded di httpClient | `VITE_MUTATION_TIMEOUT_MS` (15s), `VITE_HTTP_RETRY_MAX_ATTEMPTS` (3, dijepit 1–5) |
| TTL sesi demo | `expires_in: 900` hardcoded (login + refresh) | `VITE_AUTH_TTL_FALLBACK_SEC` via `resolveAuthTtlFallbackSec()`; `AuthContext` tidak lagi baca `import.meta.env` langsung |
| WS | `resolveWsUrl` duplikat di telemetrySocket; heartbeat 25s, backoff 30s, sim demo 5s hardcoded | Satu `resolveWsUrl` (mode.ts); `VITE_WS_HEARTBEAT_MS`, `VITE_WS_RECONNECT_MAX_MS`, `VITE_DEMO_SIM_INTERVAL_MS` |
| Lockout login | 5× / 30 detik hardcoded | `VITE_LOGIN_MAX_ATTEMPTS` (5), `VITE_LOGIN_COOLDOWN_SEC` (30) |
| Identitas deployment | `Plant 01`, `ADMIN-CONSOLE-01` hardcoded | `VITE_PLANT_LABEL`, `VITE_DEFAULT_STATION_ID` |

**Variabel env baru** (lihat `.env.example` — lengkap dengan komentar):
`VITE_ALLOW_API_MODE_SWITCH`, `VITE_DEMO_PRESET_LOGIN`,
`VITE_MUTATION_TIMEOUT_MS`, `VITE_HTTP_RETRY_MAX_ATTEMPTS`,
`VITE_NETWORK_MODE`, `VITE_TUNNEL_PORT`, `VITE_ALLOW_NETWORK_MODE_SIMULATION`,
`VITE_WS_HEARTBEAT_MS`, `VITE_WS_RECONNECT_MAX_MS`, `VITE_DEMO_SIM_INTERVAL_MS`,
`VITE_LOGIN_MAX_ATTEMPTS`, `VITE_LOGIN_COOLDOWN_SEC`,
`VITE_PLANT_LABEL`, `VITE_DEFAULT_STATION_ID`.
Semua default = perilaku lama, jadi deployment yang sudah jalan tidak berubah
kecuali dua penguncian yang memang diminta: switch mode + tombol simulasi
jaringan kini mati secara default, dan preset login mati di env real.

**Verifikasi:** `tsc` 0 error; `npm test` **70/70** (65 lama + 5 baru di
`modeAndTransport.test.ts`: mode terkunci env real, preset hidup/mati,
switch dev, semua resolver + default, TTL login mengikuti env);
`npm run build` sukses; `vite preview` HTTP 200. Yang tetap belum
terverifikasi: visual di browser sungguhan + mode Real end-to-end (lihat §6).

## 9. Mode akses Private / Public — switch LAN vs internet (2026-11-16)

**Permintaan:** switch untuk mengaktifkan mode Private (akses penuh hanya di
LAN/lokal pabrik) dan mode Public (akses penuh boleh via internet publik),
plus kebutuhan backend-nya.

**Matriks akses efektif** (`resolveEffectiveAccess` di `mode.ts`):

| Kanal \ Mode | Private (default) | Public |
| --- | --- | --- |
| LAN pabrik | Boleh mutasi | Boleh mutasi |
| Internet (tunnel) | **Read-only** (mutasi 403) | Boleh mutasi |

**Implementasi panel (frontend):**

| Lapisan | Perubahan |
| --- | --- |
| Env (`mode.ts`, satu-satunya sumber kebenaran) | `VITE_ACCESS_MODE` (`private`\|`public`, default `private`); `VITE_ALLOW_ACCESS_MODE_SWITCH` (default `false` = terkunci, pola sama dengan `VITE_ALLOW_API_MODE_SWITCH` — override `?access=`/localStorage hanya dev). Resolver baru: `resolveEnvAccessMode`, `isAccessModeSwitchAllowed`, `resolveAccessMode`, `setAccessMode`, `resolveEffectiveAccess(channel)`, `isMutationAllowed(channel?)`. Tipe `AccessMode` tinggal di `types/auth.ts` (dipakai capability juga). |
| Demo (`client.ts`) | `assertLanAccess` kini memakai `resolveEffectiveAccess(store.networkAccessMode)` — tunnel + public lolos, tunnel + private tetap 403 `FORBIDDEN` + keputusan DENY tercatat. Pesan penolakan dipertahankan ("Mode observasi — …") supaya copy yang sudah diuji tidak berubah. |
| HTTP (`httpClient.ts`) | `assertLanForMutation` sama — menolak SEBELUM fetch bila akses efektif read-only. |
| Capability UI (`capabilities.ts`) | `EvaluateCapabilityContext` + field opsional `accessMode` (default `private` = perilaku lama); penolakan `requiresLan` kini berdasarkan akses efektif. `canPerformMutation`/`canCancelWorkOrder`/`canForceReconciliationRefresh` (`oeeCalculations.ts`) mendapat parameter opsional `accessMode` (param ke-2 yang dulu bernama `accessMode` padahal isinya network mode — diganti nama jadi `networkMode`). |
| Context (`NetworkAccessContext.tsx`) | Mengekspos `accessMode`, `canMutate`, dan `isReadOnly = !canMutate` (dulu `mode === 'REMOTE_TUNNEL'`). Semua pemakai `isReadOnly` (LoginPage, Topbar) otomatis mengikuti mode akses tanpa perubahan. |
| Auth (`AuthContext.tsx`) | `checkCapability` meneruskan `accessMode` dari context ke `evaluateCapability`. |
| Banner (`NetworkModeBanner.tsx`) | 4 keadaan: LAN + Private, LAN + Public, Tunnel + Private (amber, observasi), Tunnel + Public (emerald, "Internet Publik — Akses Penuh (Mode Public)" + peringatan TLS/login). |
| Topbar (`Topbar.tsx`) | Badge/select "Akses: Private/Public" di samping badge API, pola sama (select hanya bila switch diizinkan, badge read-only bila terkunci). Private = biru, Public = amber (peringatan: terbuka ke internet). Title tombol ganti password digeneralisasi ke "(mode observasi)". |
| Env (`.env.example`) | Dua variabel baru + komentar, termasuk peringatan bahwa backend WAJIB menegakkan aturan yang sama. |

**Kebutuhan backend:** ditulis lengkap di
`docs/BACKEND_REQUIREMENTS_ACCESS_MODE.md` (B1–B25 + checklist V1–V12).
Intinya: satu flag server `ACCESS_MODE` (default `private`, fail-closed);
klasifikasi kanal dari ingress nyata (tidak bisa dipalsukan client);
**middleware yang menolak semua mutasi dari tunnel saat `private` (403,
envelope standar)**; endpoint `GET /api/v1/system/access-mode` +
`GET /auth/me` yang mempublikasikan mode + kanal ke panel; endpoint admin
`PUT /admin/access-mode` (ADMIN-only, audit trail, `reason` wajib); bila
mode `public` dipakai: TLS wajib + auth penuh + rate limit lebih ketat di
tunnel + log kanal. **Tanpa penegakan server, switch di panel hanyalah
kosmetik** — curl langsung ke API bisa bypass panel.

**Verifikasi:** `tsc` 0 error; `npm test` **76/76** (70 lama + 6 baru di
`src/services/api/accessMode.test.ts`: resolver default/public/invalid,
switch terkunci/terbuka, matriks 4 kombinasi, demo tunnel private vs public,
HTTP vs stub port 3002 — 403 sebelum fetch vs 201, capability + helper);
`npm run build` sukses; `vite preview` HTTP 200. Yang tetap belum
terverifikasi: visual di browser sungguhan + mode Real end-to-end (lihat §6)
+ seluruh daftar B1–B25/V1–V12 di sisi backend (belum ada backend).

## 10. Refactoring struktur direktori — kontrak & pemisahan god-file (2026-11-16)

**Latar:** 81 file `src`, 34.784 baris; 6 god-file di atas batas keras
(`client.ts` 4.602, `httpClient.ts` 3.371, `mockData.ts` 1.574,
`capabilities.ts` 1.115, `endpoints.ts` 883, `schemas.ts` 603). Riset
anggaran (Clean Code Bab 5: file jarang > 500 baris, sweet spot 100–200;
umum: optimal 100–300, maks 500; route/komponen < 500; fungsi 5–20/maks 50).

**Kontrak:** `docs/DIRECTORY_STRUCTURE.md` + checker
`scripts/check-directory-contract.mjs` (`npm run check:structure`, terikat
di `npm run lint`). Baseline checker: **6 FAIL**; setelah refactoring:
**0 FAIL** (18 WARN di atas batas lunak, 10 pengecualian halaman tercatat
di kontrak §4 — R9.5, belum dikerjakan).

**Yang dipecah (script migrasi `/tmp/split-api.mjs`, stages 1–4; bukan
bagian repo — parser berbasis baris + hitung kurung karena proyek memakai
TypeScript 7 tanpa API klasik):**

| Stage | Dari | Menjadi | Hasil |
| --- | --- | --- | --- |
| R9.2a | `mockData.ts` 1.574 | `seeds/{production,assets,operators,monitoring,mqtt,system}.ts` + barrel | file ≤ 400 |
| R9.2b | `schemas.ts` 603 | `schemas/{transport,dto}.ts` + barrel | 225 / 391 |
| R9.2c | `endpoints.ts` 883 | `endpoints/{definition + 11 domain}.ts` + barrel, urutan 131 key dipertahankan | file ≤ 276 |
| R9.3a | `client.ts` 4.610 | `demo/{store,helpers,core,auth,health,devices,machines,products,production,operators,workOrders,monitoring,telemetry,mqttDynsec,mqttConfig,iam}.ts` + barrel 50 baris | file ≤ 574 |
| R9.3b | `httpClient.ts` 3.379 | `http/{primitives,transport,auth,health,devices,machines,products,operators,production,workOrders,monitoring,telemetry,iam,mqttDynsec,mqttConfig}.ts` + `http/mappers/{assets,monitoring,system}.ts` + barrel 40 baris | file ≤ 394 |
| R9.4 | `capabilities.ts` 1.126 | `capabilities/{specs,abac,engine,casbin,network,validators}.ts` + barrel | file ≤ 335 |

**Aturan yang ditegakkan script:** batas kelompok dari NAMA method pertama
tiap section (bukan nomor baris — tahan terhadap edit mode akses +8 baris);
`this.X` antar-method ditulis ulang ke objek domain (`demoX.Y` /
`httpX.Y`); impor di-prune + digeser sedalam subfolder; deklarasi
non-export di file baru diberi `export`; state modul HTTP yang ditulis
method domain (`httpToken`) diakses lewat setter `setHttpToken`
(binding impor ESM read-only); `AuthClientHooks` lokal dipindah ke
`demo/helpers.ts`; header doc §4.2 dipertahankan di `http/transport.ts`.

**Kode mati yang dihapus (R9.4, diverifikasi 0 pemakaian di seluruh src
termasuk internal & test):** `decodeDeviceEventFlags`,
`validateSubjectMatch` + `SUBJECT_MATCH_REGEX`, `computeCatalogueVersion`,
`isGuardedPermissionPair` + `GUARDED_PERMISSION_PAIRS`. Yang TIDAK dihapus
meski audit awal menduganya mati: kelima validator `validate*Input`
(ternyata dipakai halaman + demo) dan `validateAbacCondition` (dipakai
`matchAbacCondition`).

**Perilaku dipertahankan:** permukaan publik tidak berubah — `apiClient`,
`store`, `ADMIN_ENDPOINTS` (131 key, urutan sama), semua `map*`, semua
validator. Tidak ada perubahan UI/fitur.

**Verifikasi:** `tsc` 0 error; `npm test` **76/76**; `npm run build`
sukses (peringatan chunk-size lama); `vite preview` HTTP 200;
`npm run check:structure` **0 FAIL**. Yang tetap belum terverifikasi:
visual di browser sungguhan + mode Real end-to-end (lihat §6).

**Sisa:** R9.6 (verifikasi akhir) — R9.5 selesai 2026-11-16 malam, lihat §11.

## 11. Refactoring R9.5 — ekstraksi 11 halaman/tab-modal (2026-11-16)

Rencana `/tmp/r95-plan.md` (§0–§15) dieksekusi penuh, satu file per langkah
dalam urutan §13, tiap file diverifikasi hijau (tsc 0 + `npm test` penuh)
sebelum file berikutnya dimulai. Total **9.576 → 2.269 baris** (11 file
sumber), **97 file baru** (hook + komponen + 2 helper), semua page kini
≤ lunak 400. Tidak ada perubahan permukaan publik; perilaku dipertahankan
verbatim kecuali keputusan §0 dan perbaikan yang dicatat di bawah.

| # | File | Sebelum → sesudah | File baru | Commit lokal |
|---|---|---|---|---|
| 1 | `src/utils/historicalExport.ts` | 618 → 10 (barrel) | 8 (`utils/historicalExport/*`) | `8d45399` |
| 2 | `features/analytics/OeeAnalyticsPage.tsx` | 593 → 143 | 5 | `7dc33fc` (+ fixup `f3202a3`) |
| 3 | `features/monitoring/OperationalEventsPage.tsx` | 610 → 234 | 4 | `5509650` (+ fixup `87f5ae0`) |
| 4 | `features/assets/DevicesPage.tsx` | 652 → 221 | 4 | `68e702e` |
| 5 | `features/production/OperatorsPage.tsx` | 1.012 → 228 | 9 | `fb982f7` |
| 6 | `features/assets/MachinesPage.tsx` | 884 → 273 | 8 + `MachineDetailModal` dipindah ke `components/` | `f212cdf` |
| 7 | `features/analytics/TelemetryHistoryPage.tsx` | 862 → 213 | 9 | `8e5c1ea` |
| 8 | `features/production/WorkOrdersPage.tsx` | 859 → 189 | 8 | `6c86258` |
| 9 | `features/mqtt/BrokerConfigManagerPage.tsx` | 627 → 233 | 8 | `123e6f2` |
| 10 | `features/mqtt/DynamicSecurityPage.tsx` | 858 → 219 | 12 | `dd796bf` |
| 11 | `features/system/AccessControlPage.tsx` | 2.001 → 306 | 22 (6 hook + 14 komponen + 2 helper) | `860319f` |

**Keputusan pola §0 yang diterapkan di semua file:** form state milik modal
(page/hook hanya open flag + target); submit error milik modal (modal
memanggil `onSubmit(payload): Promise` dan memetakan error sendiri);
feedback disatukan ke satu objek `FeedbackState` ala Machines; per-row
`checkCapability` dipassing sebagai fungsi (bukan boolean precompute, bukan
`useAuth()` kedua di tabel); delete membersihkan (cross-clear) modal detail
yang terbuka. Pengecualian yang dicatat: state form Bind (8 field) tetap di
`useRolePermissions` — kedua opener + 8 state HARUS dalam satu hook agar
locked side tidak desync (rencana §6.4); `onClose` bind modal Machines kini
membersihkan kedua target (perbaikan bug laten).

**Kode mati yang dihapus:** `visibleWorkOrders` (L409–413, no-op) +
destructure `products` yang tidak dipakai di `WorkOrdersPage`. Yang TIDAK
dihapus sesuai aturan: 3 fungsi tanpa pemanggil produksi (tetap
di-re-export); builder endpoint `historicalExport` TIDAK didelegasikan ke
registry (langkah terpisah setelah split).

**Perbaikan perilaku yang disengaja (bukan sekadar pindah kode):**
- **OeeAnalyticsPage:** rencana §10.4 salah mendeskripsikan sumber — Refresh
  asli me-refetch KEENAM query (termasuk `shiftSummaryQuery` +
  `downtimeOverlayQuery`); dikembalikan verbatim (fixup `f3202a3`).
- **OperationalEventsPage:** `ackNote` modal sempat di-prefill dari
  `target.ack_note`; sumber asli selalu mulai `''` — dikembalikan (fixup
  `87f5ae0`).
- **DynamicSecurityPage:** bug stale-closure `loadAll` diperbaiki (default
  form pindah ke modal, loader hanya memuat 3 list); secret MQTT one-time
  di-WIPE (`null`) saat modal ditutup, bukan disembunyikan; 5 mutasi inline
  tanpa error handling (`deleteRole`, `removeAcl`, `deleteGroup`,
  `addGroupClient`, `addGroupRole`) diarahkan lewat named handler dengan
  try/catch + feedback. TIDAK ditambah konfirmasi delete (di luar lingkup).
- **WorkOrdersPage:** tombol Tutup modal detail kini memakai satu `onClose`
  (`closeDetail`) — tidak teramati, karena `handleOpenDetail` selalu me-reset
  resolve state di setiap bukaan.
- Pesan validasi submit kini tampil inline di modal (teks sama persis);
  kegagalan API tetap juga men-set banner feedback (preseden `useDevices`).

**Yang TIDAK dilakukan:** tidak ada test colocated baru; tidak ada file
shared baru selain `features/system/iamValidation.ts`
(`parseAbacCondition`, `validateRoleLevelDesc` — menggantikan ABAC parse
×3 + validasi role ×2) dan `features/system/accessControlTypes.ts`
(`IamTab` di satu tempat); tidak ada `useCursorPagination` / `useFeedback`
bersama (kandidat §12.2 diputuskan tidak dibuat); `isProtectedOperator(op)`
ditambahkan sebagai ekspor aditif di `utils/capabilities.ts`.

**Verifikasi akhir (setelah file ke-11):** `npx tsc --noEmit` **0 error**;
`npm test` **76/76**; `npm run build` sukses (hanya peringatan chunk-size
lama); `vite preview` **HTTP 200**; `npm run check:structure` **0 FAIL,
0 pengecualian tercatat** (25 WARN — hanya file di atas lunak, di bawah
keras; dari R9.5: `OperatorDetailModal` 257, `useBrokerConfig` 223,
`RolesTab` 207, `useRolePermissions` 194, `useDevices` 189,
`useOperatorCrud` 187, `useOeeAnalytics` 175; sisanya file lama di luar
R9.5). Semua 13 commit lokal R9.5 (11 file + 2 fixup) sudah di-push ke
GitHub sebagai `1e0bfe9` (local `b495453`), dan FAT-39 ditandai Done di
Linear setelah verifikasi independen. Yang tetap belum
terverifikasi: visual di browser sungguhan + mode Real end-to-end (lihat
§6).

## 12. Keputusan: reject dihitung tanpa kategori alasan (2026-11-16)

**Keputusan (atas permintaan Fathur):** reject hanya dihitung sebagai angka
biasa, tanpa kategori/alasan reject. Alasannya faktual: perangkat OEE hanya
punya **1 tombol Reject**, jadi yang tercatat di sumber hanyalah counter
reject — tidak ada alasan yang bisa didistribusikan.

**Dasar di dokumen acuan:** API doc §R (FR-BIGR-001..003) sudah
mengantisipasi ini — sumber pareto adalah delta `UNCLASSIFIED` per jendela,
dan totalnya harus dapat direkonsiliasi dengan
`device_live_state.rejectCount` (G1). Pareto tanpa kategori memang bukan
Pareto yang bermakna (satu bar, 100%); karena itu yang ditampilkan panel
adalah jumlah reject apa adanya, dan distribusi 80/20 yang jujur adalah
per device — yang sudah tersedia lewat kolom `rejectCount` di tabel rollup
OEE (`OeeRollupTable`), bukan lewat alasan cacat.

**Yang diubah:**
- `src/services/api/demo/helpers.ts` — `REJECT_PARETO_BY_DEVICE`: seed
  multi-alasan yang dibuat-buat (mis. "Dimension Tolerance Exceeded",
  "Surface Roughness", "Thread Pitch Defect") **dihapus** dan diganti satu
  item `UNCLASSIFIED` per device, dengan count = `reject_count` live state
  (`seeds/monitoring.ts`): STM32-OEE-01: 8, -02: 3, -03: 14; -04/-05 tetap
  `[]`. Agregasi plant-wide (`getRejectParetoGlobal`) kini menghasilkan
  satu baris `UNCLASSIFIED` 25 pcs (100%) — tanpa perubahan logika.
- `src/features/analytics/rejectReasonLabel.ts` (baru) —
  `displayRejectReason()`: `UNCLASSIFIED` ditampilkan sebagai
  "Belum diklasifikasi"; alasan lain (bila kelak ada) tampil apa adanya.
  Dipakai `QualityRejectPareto.tsx` dan `QualityRejectsPage.tsx`.
- Copy UI yang mengklaim distribusi/kategori cacat diperbaiki:
  `QualityRejectPareto` — "Jumlah reject tanpa klasifikasi alasan —
  perangkat hanya punya 1 tombol Reject"; `QualityRejectsPage` —
  "Rekapitulasi jumlah reject tanpa klasifikasi alasan…" dan judul
  "Jumlah Reject — tanpa klasifikasi alasan".

**Yang TIDAK diubah:** kontrak endpoint `{reason, count, pct}` (API doc §R)
dan mapper HTTP `paretoFromRows`/`mapReject` — keduanya sudah memakai
`UNCLASSIFIED` sebagai nilai kanonis tanpa alasan (bahkan sebagai default
bila `reason` hilang); matematika OEE/Quality (`rejectCount`, `good =
output − reject`) dan `finalRejectCount` pada WO complete — semuanya sudah
bekerja dari angka polos tanpa alasan.

**Kebutuhan backend (bila klasifikasi alasan suatu hari diinginkan):**
klasifikasi TIDAK bisa datang dari tombol Reject — harus dari alur lain
(mis. klasifikasi QC di panel setelah reject terjadi, atau stasiun QC
terpisah). Itu lingkup baru, bukan bagian dari keputusan ini; sampai ada
alur itu, backend cukup mengembalikan baris `UNCLASSIFIED` (atau `[]` bila
kosong) dan JANGAN memfabrikasi alasan.

**Verifikasi:** `npx tsc --noEmit` **0 error**; `npm test` **76/76**;
`npm run build` sukses (hanya peringatan chunk-size lama);
`vite preview` **HTTP 200**; `npm run check:structure` **0 FAIL,
0 pengecualian tercatat**.

## 13. Audit Telemetry History, OEE Per Jam & Timeline Shift (2026-11-16)

Laporan lengkap: `docs/TELEMETRY_AUDIT.md` (25 gap: 4 Tinggi, 10 Sedang,
11 Rendah; 24 usulan peningkatan). Empat gap Tinggi — semuanya
terverifikasi terhadap kode sebelum dilaporkan: **G1** jendela waktu tidak
sejajar di halaman OEE (shift summary + timeline tidak mengirim `from`/`to`,
sementara hourly/rollup memakai 7 hari sliding); **G2** total tidak bisa
direkonsiliasi antar tampilan bahkan di demo (timeline RUNNING 409 mnt vs
`run_time_min` 388; planned 45 vs 60; unplanned 15 vs 32); **G3** filter
tanggal tidak berpengaruh di tab Hourly & Aggregate Telemetry History
(`from`/`to` tidak dikirim ke server); **G4** rollup halaman OEE
mengabaikan mesin terpilih (selalu plant-wide tanpa label). Prioritas
usulan dalam scope: F-1 (kirim `from`/`to` ke hourly & aggregate) → F-2
(ikat summary/timeline ke periode) → F-3 (rollup ikut mesin / label scope)
→ F-4 (seed demo terrekoniliasi) → U-1 (label scope eksplisit). Belum
diputuskan Fathur mana yang diimplementasikan.
