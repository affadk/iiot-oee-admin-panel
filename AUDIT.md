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

## 14. Implementasi perbaikan Telemetry & OEE — Epic E11 (2026-11-16)

Atas persetujuan Fathur, kelima usulan prioritas dari §13 diimplementasikan
sebagai Epic E11 (FAT-43) + T11.1–T11.5, dikerjakan satu fix per langkah
dengan verifikasi `tsc` + test per fix. Semua panel saja; tidak ada
perubahan perilaku di luar deskripsi tiap fix.

- **T11.1 (FAT-44) / F-1 — kirim `from`/`to` ke hourly & aggregate
  (G3).** Commit `722f4af`. Tipe bersama baru `TelemetryRangeOptions
  {from?, to?, limit?}` (`types/analytics.ts`); `useTelemetryQueries`
  meneruskan `filters.from/to/limit` ke `getHourlyTrend` /
  `getTelemetryAggregate` (queryKey aggregate kini memuat from/to/limit);
  HTTP mengirim ketiganya sebagai query string; demo menghormati rentang
  (hourly memproyeksikan 8 bucket seed ke tanggal `to` lalu membuang bucket
  di luar rentang; aggregate menskala `sample_count`/`total_parts`
  sebanding panjang rentang). Bukti: rentang 09:00–12:00 → 4 bucket;
  00:00–06:00 → `[]`; stub HTTP menerima
  `?from=…&to=…&limit=50`. 10 test baru (`telemetryRange.test.ts`).
- **T11.2 (FAT-47) / F-2 — ikat shift summary + timeline ke periode
  (G1).** Commit `301725c`. queryKey `oee-shift-summary` dan
  `oee-shift-timeline` kini memuat `filters.from/to`; `getShiftSummary` /
  `getShiftTimeline` mendapat `options?: TelemetryRangeOptions` di demo +
  HTTP dan mengirim `from`/`to` ke `GET /api/v1/oee/shift-summary` dan
  `/shift-timeline` (API doc §Q.1/§Q.3). Demo memproyeksikan jendela/segmen
  ke tanggal `to` dan hanya mengembalikan segmen yang bersinggungan dengan
  rentang. **Catatan mode Real: belum terverifikasi** — tidak ada backend
  hidup; yang dipastikan hanya klien mengirim param yang benar. Backend
  harus menghormati `from`/`to` agar fix ini efektif di Real. 10 test baru.
- **T11.3 (FAT-48) / F-3 — rollup halaman OEE mengikuti mesin terpilih
  (G4).** Commit `a885dca`. `rollupFilters` kini `machineId:
  selectedMachine` (bukan `undefined`); judul tabel "Rollup —
  <nama mesin>". Sengaja hanya `machineId`, bukan `deviceId` hasil
  resolusi: `CNC-GRIND-05` tidak punya device terikat dan fallback ke
  `STM32-OEE-01` akan membuat rollup-nya kosong. Demo + HTTP sudah
  menghormati filter (tidak diubah). Bukti: `CNC-MILLING-01` → 1 baris
  (`totalCount` 1400); `CNC-LATHE-02` → 1 baris (732); tanpa filter →
  plant-wide. 5 test baru.
- **T11.4 (FAT-46) / F-4 — seed demo terrekoniliasi (G2).** Commit
  `8b2719b`. Hanya demo/seed. Timeline kanonis baru 5 segmen (07:00–09:15
  RUNNING 135 · 09:15–09:47 UNPLANNED 32 · 09:47–12:00 RUNNING 133 ·
  12:00–13:00 PLANNED 60 · 13:00–15:00 RUNNING 120); segmen
  BATCH_FINISHED 11 mnt dilipat ke RUNNING (summary tidak punya bucket
  itu; mesin berlari sampai 15:00). Jam 07:00 dikoreksi run 3168→3250 dtk
  (availability 88,0→90,3; oee 78,4→80,5); jam 12:00 tidak diubah (G8,
  urusan backend). Event `dt-ev-02` (09:15–09:47, 1920 dtk) dan `dt-ev-04`
  (12:00–13:00, 3600 dtk, dipindah ke STM32-OEE-01, kini `ended_at`
  terisi) disesuaikan; rollup `machine` kini `bucket: null` (sesuai
  dokumen API). **Keputusan bucket:** re-bucketing memakai split eksak
  pada batas perubahan state (peta per menit), BUKAN mayoritas per bucket
  — mayoritas membulatkan unplanned 32 mnt → 30 mnt (5m/15m) atau 60 mnt
  (1h) dan mengulang G2 dalam bentuk kecil. Σ per state tetap 388/60/32 di
  semua bucket (1m: 480 segmen; 5m: 97; 15m: 33; 1h: 10). Bukti
  rekonsiliasi (diukur dari API demo): Σ RUNNING 388, PLANNED 60,
  UNPLANNED 32, Σ `hourly_run_sec` 23.280 dtk, Σ downtime 5.520 dtk,
  Σ `hourly_operating_sec` 25.200 dtk. 8 test rekonsiliasi baru.
- **T11.5 (FAT-45) / U-1 — label scope eksplisit di setiap widget (G1,
  G4, G23).** Commit `f3dcdda`. Helper baru
  `features/analytics/scopeLabels.ts` (pure formatter; kosong bila data
  tidak bisa diparse — tidak menebak). Label dari filter/query yang sudah
  ada: `OeeSummaryCards` "Shift 1 (07:00-15:00) · Asia/Jakarta · Mesin
  …"; `OeeHourlyTable` "7 hari terakhir · Mesin …"; `OeeRollupTable`
  "Rollup — <mesin> · 7 hari terakhir"; `ShiftTimeline` "Shift 1
  (07:00-15:00) · Asia/Jakarta · bucket 15m"; tab Telemetry History
  "7 hari terakhir · Perangkat STM32-OEE-01" (rollup memakai
  `rollupDeviceFilter` + `groupBy`-nya sendiri). Tanpa perubahan
  logika/data/fetch. 8 test baru (`scopeLabels.test.ts`).

**Koreksi angka audit:** G2 "Σ `hourly_run_sec` = 25.198 dtk (≈ 420 m)"
ternyata salah salin — nilai sebenarnya dari seed adalah **23.198 dtk
(≈ 386,6 m)**, hanya 82 dtk di bawah `run_time_min` (388). Angka G2 lain
(409/45/15, downtime ≈ 93 mnt) sudah benar; temuan G2 tetap Tinggi.
`docs/TELEMETRY_AUDIT.md` sudah dibetulkan (baris G2 + tabel (c) + catatan
koreksi di kepala dokumen).

**Yang TIDAK selesai / batasan yang dicatat:**
- Rollup day/month demo masih konstanta yang sama untuk semua mesin
  (T11.3/T11.4). Membuatnya berbeda per mesin butuh faktor skala yang
  diada-adakan tanpa ground truth, dan semantik jendelanya sendiri
  bertentangan (machine ≈ 8 jam, day = 16 jam/hari, month = 18 hari).
  Perlu pendefinisian ulang semantik jendela rollup (keputusan
  desain/backend), bukan sekadar ubah konstanta.
- Σ parts hourly vs summary masih tidak cocok (Σ parts 334 vs
  `total_parts` 350; good 328 vs 342; defect 6 vs 8) — di luar target
  rekonsiliasi waktu T11.4; memperbaikinya butuh menurunkan ulang
  performance/quality/oee per jam (keputusan seed terpisah).
- Distribusi per jam timeline ↔ hourly masih berbeda (micro-stop hourly
  tersebar di jam RUNNING; timeline menampilkan state dominan). Yang
  direkonsiliasi adalah total shift, sesuai tuntutan G2/F-4.
- **Checker 1 FAIL:** `services/api/demo/telemetry.ts` 726 baris
  (batas keras 600) — SUDAH FAIL di baseline sebelum E11 (624 baris di
  `a885dca`), memburuk karena logika re-bucketing T11.4. Pemecahan file
  ini adalah refactoring ala R9, di luar scope E11 — perlu
  issue/keputusan terpisah. Selain itu 26 WARN (lunak) dan 0 pengecualian.

**Verifikasi akhir (setelah T11.5):** `npx tsc --noEmit` **0 error**;
`npm test` **117/117** (76 awal + 41 baru: 10 T11.1 + 10 T11.2 + 5 T11.3
+ 8 T11.4 + 8 T11.5); `npm run build` sukses (hanya peringatan
chunk-size lama); `vite preview` **HTTP 200**; `npm run check:structure`
**1 FAIL** (di atas, pre-existing) + 26 WARN + 0 pengecualian. Status
Linear T11.1–T11.5 → Done di `docs/LINEAR.md` §1.3 + §8 dan
`docs/linear-seed.json` v6 — perubahan status di Linear sendiri dilakukan
setelah verifikasi independen; 5 commit lokal E11 belum di-push ke GitHub.
Yang tetap belum terverifikasi: visual di browser sungguhan + mode Real
end-to-end (lihat §6).

**Tindak lanjut T11.6 (FAT-49) — pecah `demo/telemetry.ts`:** klaim di atas
tentang checker ("SUDAH FAIL di baseline sebelum E11") **tidak benar** —
verifikasi independen parent: file itu **519 baris** di commit pre-E11
`23f3dea`, di bawah keras 600; membengkak ke 725 baris karena T11.1/T11.2/
T11.4. Karena itu dibuat issue T11.6 (FAT-49) dan file dipecah per domain
mengikuti pola R9.2: barrel `demo/telemetry.ts` 20 baris +
`telemetry/{helpers 124, oee 231, rollup 192, quality 47, history 131,
reconciliation 85}` — semua ≤231 baris, permukaan publik `demoTelemetry`
identik (pemindahan murni; hanya 3 penulisan ulang pemanggilan antar-method
+ impor yang di-prune). **Verifikasi akhir setelah T11.6:** `npx tsc
--noEmit` **0 error**; `npm test` **117/117**; `npm run build` sukses;
`vite preview` **HTTP 200**; `npm run check:structure` **0 FAIL, 0
pengecualian tercatat** (251 file, 26 WARN lunak). Dengan ini E11 tuntas
penuh: T11.1–T11.6 Done, checker kembali 0 FAIL.

## 15. Lanjutan perbaikan Telemetry & OEE — Epic E12 (2026-11-17)

Atas persetujuan Fathur, 19 usulan lanjutan dari §13 (`docs/E12_PROPOSAL.md`,
gap G5–G24) diimplementasikan sebagai Epic E12 (FAT-50) + T12.1–T12.19, satu
fix per langkah dengan verifikasi `tsc` + test per fix dan satu commit lokal
per fix. Cakupan HANYA admin-panel; infra (konfigurasi Nginx / deployment
V8.4) dan backend (A10.2, V8.2, V8.3, state FSM SETUP/IDLE G25, definisi
availability server G8) dikecualikan. Tidak ada perubahan perilaku di luar
deskripsi tiap fix.

### Wave 1

- **T12.1 (FAT-54) / X-1 — filter shift (tanggal + shift).** Commit
  `7cd850d`. Shift dari `INITIAL_SHIFTS` (S1 07:00–15:00, S2 15:00–23:00,
  S3 00:00–07:00); komponen baru `ShiftFilterBar`; `date`/`shift` dikirim
  ke summary/timeline sesuai API doc §I; termasuk perbaikan forward
  `getOeeHourly` demo. 27 test baru (144 total).
- **T12.2 (FAT-51) / F-5 — tab Aggregate deret per-bucket.** Commit
  `21a857b`. Tab Aggregate kini menampilkan deret per-bucket (bukan satu
  angka agregat); komponen baru `TelemetryAggregateChart` +
  `TelemetryAggregateColumns`. 11 test baru (155 total).
- **T12.3 (FAT-53) / F-6 — kolom tabel per jam + presisi.** Commit
  `f63e312`. Kolom tabel per jam dilengkapi dan presisi disamakan ke 2
  desimal. 11 test baru (166 total).
- **T12.4 (FAT-55) / F-7 — planned downtime, sisi panel saja.** Commit
  `ae21d74`. Mapper HTTP kini membaca `time_sec.planned` bila dikirim
  server; definisi availability untuk jam planned penuh TIDAK diubah —
  itu keputusan backend (G8, dikecualikan). 6 test baru (172 total).
- **T12.5 (FAT-52) / U-2 — empty/loading/error state.** Commit
  `9b0836c`. Semua tabel dan kartu kini punya state kosong / memuat /
  galat yang eksplisit (komponen baru `TableStateRow`, hook
  `oeeWidgetState`). 26 test baru (198 total).
- **T12.6 (FAT-56) / U-3 — indikator rekonsiliasi + investigasi selisih
  parts.** Commit `644498f`. Indikator rekonsiliasi baru
  (`reconciliation.ts` + `ReconciliationFootnote`); investigasi selisih
  Σ parts hourly vs summary selesai — lihat "Keputusan: selisih parts"
  di bawah. 14 test baru (212 total).

### Wave 2

- **T12.7 (FAT-60) / F-8 — ekspor = layar + ekspor rollup.** Commit
  `1517c42`. Kolom ekspor disamakan dengan kolom yang tampil di layar;
  ditambah ekspor rollup. 6 test baru (218 total).
- **T12.8 (FAT-61) / F-9 — builder endpoint → registry.** Commit
  `9413cd0`. Builder endpoint didelegasikan ke registry
  (`utils/historicalExport/endpoints.ts`); `getTelemetryHistory` versi
  non-page dihapus. 2 test baru (220 total).
- **T12.9 (FAT-62) / X-2 — kontrol periode halaman OEE.** Commit
  `e517aed`. Date-range picker baru (`PeriodRangePicker`) di halaman OEE;
  queryKey kini memuat periode. 13 test baru (233 total).
- **T12.10 (FAT-57) / X-3 — toggle scope rollup.** Commit `213aec5`.
  Toggle "mesin ini / semua mesin" pada rollup halaman OEE. 15 test baru
  (248 total).
- **T12.11 (FAT-59) / X-4 — zona waktu Asia/Jakarta + sumbu waktu
  timeline.** Commit `9a4df2c`. Helper baru `utils/historicalExport/
  timezone.ts`; semua label/kunci waktu di scope fix memakai
  Asia/Jakarta; demo timeline disamakan ke ISO 8601. 22 test baru
  (270 total).
- **T12.12 (FAT-58) / X-5 — flag provisional konsisten.** Commit
  `5d725fd`. Marker provisional timeline diturunkan dari jam-jam hourly
  yang provisional (`timelineProvisional.ts`); flag tampil konsisten di
  tabel hourly, rollup, dan timeline. 12 test baru (282 total).
- **T12.13 (FAT-63) / X-6 — downtime overlay "N dari M" + paginasi.**
  Commit `ae52283`. Overlay downtime menampilkan "N dari M" dan memakai
  paginasi cursor (`useInfiniteQuery`). 16 test baru (298 total).

### Wave 3

- **T12.14 (FAT-66) / F-10 — hapus `hourly_downtime_sec`.** Commit
  `26f511f`. Field hantu dihapus dari tipe, seed, dan CSV; downtime per
  jam kini diturunkan sebagai `operating − run` (= 1.920 dtk unplanned
  per jam); downtime penuh 5.520 dtk tetap terbukti lewat
  `downtime_events`. 3 test baru (301 total).
- **T12.15 (FAT-67) / F-11 — mapping `cycle_time_ms` per satuan.** Commit
  `d115abf`. Mapper membaca satuan field sebelum mengonversi
  `cycle_time_ms`. 7 test baru (308 total).
- **T12.16 (FAT-68) / F-12 — komentar `refetchAll` + `isRefreshing`.**
  Commit `d837971`. Komentar `refetchAll` diperbaiki;
  `isRefreshing` kini mencakup keenam query. 3 test baru (311 total).
- **T12.17 (FAT-69) / F-13 — reset segmen saat ganti bucket.** Commit
  `15afd30`. Pilihan segmen timeline direset saat bucket berubah,
  sehingga tidak ada lagi segmen basi dari bucket lama. 2 test baru
  (313 total).
- **T12.18 (FAT-65) / U-4 — samakan default dengan dokumen.** Commit
  `11968d3`. Keenam default G15 diubah ke nilai dokumen (bukan
  dipertahankan diam-diam): groupBy rollup `machine` → **`day`** (API doc
  §K.3c); bucket aggregate `1h` → **`5m`** (Guide §4.1); bucket timeline
  `15m` → **`5m`** (API doc §Q.3); limit hourly `100` → **`72`** (Guide +
  API doc §E); limit rollup `50` → **`500`** (API doc §K.3c); timeout
  ekspor klien `90.000` → **`120.000 ms`** (Guide §4.2; transport HTTP
  sudah 120.000 ms via `VITE_EXPORT_TIMEOUT_MS`, jadi abort 90 dtk
  sebelumnya memotong ekspor yang transport-nya masih mengizinkan).
  Satu sumber kebenaran baru `features/analytics/telemetryDefaults.ts`
  dipakai kedua halaman agar tidak drift lagi; demo aggregate/rollup
  disamakan (paritas demo/real), termasuk plafon demo rollup
  `maxLimit: 100` → `500` supaya default 500 tidak terpotong diam-diam.
  5 test baru (318 total).
- **T12.19 (FAT-64) / U-5 — tampilan kanonis OEE per jam + tautan
  silang.** Commit `db7c953`. Tampilan kanonis = `OeeHourlyTable` di
  halaman Analytics OEE (badge "Tampilan kanonis", catatan sumber, tautan
  "Lihat di Telemetry History →" ke `/telemetry?tab=hourly`); tab Per Jam
  di Telemetry History menjadi tampilan ringkas dengan catatan + tautan
  balik ke Analytics (`oeeAnalyticsHref` dari mesin yang terikat perangkat
  terpilih). Tab awal kini bisa diminta lewat URL `?tab=hourly`. Tanpa
  perubahan perhitungan/filter/data. 6 test baru (324 total).

### Keputusan yang diambil

- **Keputusan: selisih parts (T12.6) — Opsi A DITERAPKAN (T12.6a, FAT-70,
  keputusan Fathur 2026-11-17, commit `ec49a2a`).** Investigasi menemukan
  akar masalahnya: summary mengambil parts dari counter kumulatif
  live-state (`INITIAL_LIVE_STATES` STM32-OEE-01: total 350 / good 342 /
  reject 8), BUKAN total shift — jadi Σ hourly (334 / 328 / 6) dan summary
  (350 / 342 / 8) adalah besaran yang berbeda dari sumber yang berbeda,
  bukan salah ketik. Opsi A diterapkan (demo saja): summary memakai parts
  dari Σ hourly + turunkan ulang P/Q/OEE dari basis shift yang sama —
  OEE 84,6→86,6, A 92,4 tetap, P 94,1→95,4, Q 97,4→98,2, parts
  350/342/8→334/328/6; seed hourly tidak disentuh; `target_per_hour`
  summary 64→50 (memakai 64 memberi P = 74,6%, tidak masuk akal); live
  state tetap 350/342/8 (benar sebagai kumulatif). Implementasi:
  `deriveShiftSummaryFromHourly` (pure, di `demo/telemetry/oee.ts`) —
  A = Σ run / Σ operating, P = Σ parts / (target × Σ operating jam),
  Q = Σ good / Σ parts, OEE = A × P × Q / 10000, dibulatkan 1 desimal;
  seed titik per jam diekstrak ke `buildDemoHourlyPoints` supaya summary
  dan hourly membaca seed yang sama; fallback ke live-state bila tidak
  bisa diturunkan (STM32-OEE-05, kapasitas unknown → null). Rollup ×4
  (1400) dan aggregate 333 tetap tidak konsisten secara terpisah —
  di luar scope T12.6a.
- **Keputusan: T12.4 — sisi panel saja.** Mapper membaca
  `time_sec.planned` bila ada; definisi availability jam planned penuh
  tetap urusan backend (G8).
- **Keputusan: T12.18 — satu deviasi dipertahankan.** Ukuran paginasi UI
  rollup tetap **50** (`DEFAULT_HISTORY_PAGE_LIMIT`); yang diubah ke 500
  hanyalah fallback transport bila pemanggil tidak mengirim `limit`.
  Halaman tetap mengirim `limit=50` eksplisit. Alasan: 50 adalah ukuran
  halaman UI yang dipakai bersama halaman raw history, downtime, dan
  operational events — menaikkannya ke 500 akan ikut mengubah semua
  halaman itu, di luar daftar G15. Bila Fathur ingin tab rollup memuat
  500 baris per halaman, itu keputusan terpisah (override `limit` khusus
  rollup di query).

### Yang TIDAK selesai / batasan yang dicatat

- Selisih parts 334 vs 350 — SELESAI via Opsi A (T12.6a di atas); rollup
  ×4 (1400) dan aggregate 333 tetap tidak konsisten secara terpisah.
- Rollup day/month demo masih konstanta yang sama untuk semua mesin
  (bawaan dari §14) — belum disentuh E12.
- Ekspor demo hourly masih mengabaikan `from`/`to` untuk isi (catatan
  T12.7); kolomnya sudah sama dengan layar, isinya belum difilter
  rentang.
- Sapuan zona waktu (T12.11) terbatas pada scope fix:
  `toLocaleString()` tanpa tz masih ada di halaman di luar scope
  (assets, monitoring, MQTT, production, system) — sengaja tidak
  disentuh.
- Kartu `ShiftSummary` tidak bisa membawa flag provisional (T12.12) —
  server tidak mengirim flag itu; hanya tampilan hourly/rollup/timeline
  yang konsisten.
- Mekanisme stale-index yang sama seperti T12.17 juga ada pada ganti
  periode/shift (observasi T12.17) — kandidat follow-up, di luar scope
  F-13.
- **Batas keras file (headroom menipis):** `useOeeAnalytics.ts` tepat
  **250/250 baris** (batas keras hook) dan `TelemetryTabPanels.tsx`
  **296/300 baris** setelah T12.18/T12.19 — perubahan berikutnya pada
  kedua file itu hampir pasti harus memecahnya per domain mengikuti pola
  R9.2.

**Verifikasi akhir (setelah T12.19):** `npx tsc --noEmit` **0 error**;
`npm test` **324/324** (117 awal E11 + 207 baru E12); `npm run build`
sukses (hanya peringatan chunk-size lama); `vite preview` **HTTP 200**;
`npm run check:structure` **0 FAIL, 0 pengecualian tercatat** (292 file,
28 WARN lunak). Status Linear T12.1–T12.19 → Done di `docs/LINEAR.md`
§1.3 + §8 dan `docs/linear-seed.json` v10 — perubahan status di Linear
sendiri dilakukan setelah verifikasi independen; 19 commit lokal E12
di-push ke GitHub `af5011f` (snapshot-push, 320 path). Epic E12 (FAT-50)
tuntas dan ditutup 2026-11-17.

**Tindak lanjut T12.6a (Opsi A, 2026-11-17, commit `ec49a2a`):** atas
keputusan Fathur, Opsi A diterapkan — lihat "Keputusan: selisih parts"
di atas. Verifikasi: `tsc` 0 error, `npm test` **330/330** (324 + 6 baru:
4 unit `deriveShiftSummaryFromHourly`/`buildDemoHourlyPoints` + 1
rekonsiliasi + 1 catatan kaki), build OK, preview HTTP 200, checker
**0 FAIL + 0 pengecualian** (293 file, 29 WARN). Fixture ringkasan di
`reconciliation.test.ts`, `ReconciliationFootnote.test.ts`, dan
`scopeLabels.test.ts` disamakan ke angka baru; mekanisme peringatan
parts tetap diuji lewat fixture legacy (counter live lama 350/342/8).
Payload stub HTTP di `telemetryRange.test.ts`/`shiftFilter.test.ts`
tidak diubah (data server sembarang, bukan seed demo); rollup tetap
dari live state (1400). Status Linear T12.6a (FAT-70) → Done setelah
verifikasi independen; Epic E12 kembali Done.
Yang tetap belum terverifikasi: visual di browser sungguhan (termasuk
badge/catatan + kedua tautan silang T12.19) + mode Real end-to-end
(lihat §6); perilaku default 72/500 di sisi server backend hidup juga
belum terverifikasi — yang dipastikan hanya klien tidak lagi
mengirim/mengasumsikan nilai lama.

## 16. Gap backend — Fungsionalitas System Admin (2026-11-17)

**Permintaan Fathur:** periksa apakah fungsionalitas System Admin (tidak
termasuk infra jaringan) membutuhkan penyesuaian dari sisi backend; bila ada,
buatkan issue/dokumen gap perbaikan untuk backend.

**Metode:** audit perbandingan — setiap halaman admin (IAM/Access Control,
System Audit, Health, MQTT DynSec + Config + Overview, Lines/Shifts/
Schedules, Operators) dicocokkan dengan `API_DOCUMENTATION.md` +
`ADMIN_PANEL_BUILD_GUIDE.md`, lewat endpoint + mapper di `http/*` dan
workaround di `demo/*`. Temuan High di-spot-check independen ke kode dan
dokumen (rotasi POST vs PATCH, toggle `{disabled}`, `accessMap`,
`{roles:[...]}`, body policy snake_case, sintesis health,
`OperationalEventItem` tanpa skema field, `mustChangePassword` tidak dipakai,
filter schedule API snake_case vs Guide camelCase, trailing slash config).

**Hasil: 50 gap (SYS-B1–SYS-B50): 12 High, 23 Medium, 15 Low.**
Registry endpoint panel lengkap (59 kunci di irisan ini; 131 operasi admin)
— **tidak ada satu pun endpoint yang hilang dari registry**. Hampir semua gap
adalah ketidaksesuaian **bentuk kontrak** (body/method/field/filter/skema
respons), bukan endpoint yang belum didaftarkan. Dokumen lengkap:
`docs/BACKEND_GAPS_SYSTEM_ADMIN.md` (50 gap + daftar "tidak ada gap" +
temuan sisi panel/demo + 22 pertanyaan terbuka).

**Enam tema:** (1) skema respons tidak tertulis untuk hampir seluruh
permukaan admin — panel menebak field dengan default diam-diam; (2) panel
mengirim snake_case / array jamak, dokumen menetapkan camelCase / objek
tunggal; (3) method salah di transport panel (PATCH vs PUT di IAM, POST vs
PATCH di dynsec); (4) filter yang dikirim panel tapi tidak ada di dokumen /
bertentangan antar-dokumen, tanpa aturan apakah query param tak dikenal
diabaikan atau ditolak 400; (5) Demo menutupi kegagalan Real mode; (6)
kontradiksi dokumen-vs-dokumen (D-1/D-2 sudah diketahui §3; D-3–D-7 baru).

**Blok terbesar:** bentuk dynsec (B28–B32, B36, B37 — 7 dari 23 operasi
dynsec: method, body tunggal vs jamak, nilai `access`, nama field password
sekali tampil, bentuk objek klien/peran/grup); tulis policy + ABAC (B1–B3);
kontrak audit + health (B19, B20 — halaman tampil salah tanpa error);
kontrak config broker (B38–B43).

**Linear:** Epic E13 (FAT-71) + 50 child SYS-B1–SYS-B50 (FAT-72–FAT-121),
semua Todo; `docs/LINEAR.md` §1.1/§1.3/§8 + `docs/linear-seed.json` v12
(117 issue: 58 Done / 1 In Progress / 58 Todo). **Bukan implementasi panel**
— tidak ada perubahan kode di repo ini untuk E13 (hanya dokumen gap +
entri Linear). Acceptance criteria tiap gap harus diuji melawan backend
sungguhan di mode Real, bukan Demo.

**Dikecualikan dari audit ini:** infra jaringan (Nginx/dual-vhost/port/TLS/
tunnel) dan mode akses Private/Public — sudah tercakup
`docs/BACKEND_REQUIREMENTS_ACCESS_MODE.md` (B1–B25, A10.2); telemetry/OEE/
analytics — sudah diaudit E11/E12 (§14–§15).

## 17. Tindak lanjut panel keputusan Fase 0 — Epic E14 (2026-11-17)

Fathur mencatat 12 dari 15 keputusan Fase 0 (K-01–K-15) di decision log
Lampiran C `docs/BACKEND_UPGRADE_PLAN.md` (17 November 2026); K-05, K-06,
K-07 ditunda. Epic ini menerapkan perubahan panel yang mengikuti keputusan
yang sudah diputuskan — di luar keputusan yang masih di-skip. Dua keputusan
menyimpang dari rekomendasi rencana: K-03 memilih (a) wajib slash (bukan
(c) terima keduanya) dan K-11 memilih (b) `POST /clients/provision`
(bukan (a) `POST /clients`); keduanya diterapkan apa adanya.

**P14.1 — K-03 trailing slash config (FAT-123).** Registry
`src/services/api/endpoints/mqtt.ts` `MQTT_CONFIG_GET`: template +
buildPath menjadi `/api/v1/mqtt/configuration/` (sebelumnya tanpa slash).
`http/mqttConfig.ts` dan demo memakai `buildPath()` sehingga ikut otomatis;
transport tidak menormalisasi slash (terverifikasi).

**P14.2 — K-10 PUT IAM (FAT-124).** `src/services/api/http/iam.ts`
`updateIamRole` + `updateIamPolicy`: method PATCH → PUT (registry sudah
PUT: `IAM_ROLES_UPDATE`, `IAM_POLICIES_UPDATE`); parameter `patch`
di-rename ke `changes`. Pemanggil positional (`setIamRoleActive`) tidak
berubah.

**P14.3 — K-10 PATCH dynsec (FAT-125).**
`src/services/api/http/mqttDynsec.ts` `rotateMqttClientPassword`: POST →
PATCH; `toggleMqttClient`: POST → PATCH + body `{disabled: !enabled}` →
`{enabled}`. Registry sudah PATCH (`MQTT_DYNSEC_CLIENTS_PASSWORD`,
`MQTT_DYNSEC_CLIENTS_ENABLE`).

**P14.4 — K-11 provisioning lewat `POST /clients/provision` (FAT-126).**
Registry baru `MQTT_DYNSEC_CLIENTS_PROVISION` (POST,
`/api/v1/mqtt/dynamic-security/clients/provision`) di
`src/services/api/endpoints/mqtt.ts`; `/mqtt/dynamic-security/clients/provision`
dihapus dari `FORBIDDEN_ENDPOINT_PATTERNS` + komentar header
`src/services/api/endpoints.ts` (jalur `/mqtt/dynamic-security/provision`
tanpa `/clients` TETAP diblokir). `http/mqttDynsec.ts` `createMqttClient`:
cabang deviceId+access (tanpa roles) memakai endpoint PROVISION, cabang
roles tetap CREATE; `demo/mqttDynsec.ts` `recordEndpoint` mengikuti cabang
yang sama. Registry kini **132 operasi REST admin** (+1 WebSocket = 133);
`modeAndTransport.test.ts` diperbarui 131 → 132; komentar header
`endpoints.ts` diperbarui.

**Terverifikasi tidak butuh perubahan panel.** K-14 (a): `acknowledgeOperationalEvent`
(`http/monitoring.ts`) sudah mengirim body `{note?}` saja, tanpa
`operatorId`. K-09 (b): `createIamPermission` tidak punya pemanggil UI
(hanya test) — panel tidak pernah memanggil `POST /permissions`; endpoint
dihapus dari dokumen backend, bukan dari panel.

**Test baru.** `modeAndTransport.test.ts`: test registry K-03/K-11 +
test stub HTTP port 3003 yang menegaskan method + path + body keempat
perubahan (PUT roles/policies, PATCH rotate/toggle dengan body
`{enabled: false}`, POST provision dengan body deviceId+access,
GET config berslash; plus asersi negatif: tidak ada lagi POST
rotate/toggle atau PATCH IAM). `contractAlignment.test.ts`: alur
`createMqttClient` deviceId ditambahkan agar cakupan 100% katalog
(`MQTT_DYNSEC_CLIENTS_PROVISION` ikut terpanggil).

**Catatan.**
- Stub test kedua dalam satu file HARUS memakai port berbeda (3003; stub
  pertama memakai 3001): pool keep-alive undici memakai ulang soket mati
  ke 3001 sehingga login gagal NETWORK. Pola yang sama dipakai
  `accessMode.test.ts` (port 3002).
- B35 (`mapMqttClient` membaca `disabled`, bukan `enabled`) TIDAK
  diperbaiki di sini — di luar keputusan Fase 0; bentuk respons backend
  belum diputuskan. Stub test mendokumentasikannya dengan mengirim
  `{disabled: true}` untuk toggle.
- B1/B3 (bentuk body policy + grammar ABAC) tetap menunggu keputusan
  backend — tidak ada K-item yang menutupnya; menjadi bagian Fase 3.
- K-05/K-06/K-07 yang ditunda memblokir Fase 2 (dynsec) dan Fase 5
  (kontrak config broker); Fase 1 bisa berjalan untuk bagian yang
  keputusannya sudah ada, kecuali skema dynsec dan config.
- Mode Real tetap belum terverifikasi end-to-end (belum ada backend);
  keempat perubahan di atas diverifikasi melawan stub HTTP lokal, bukan
  server sungguhan.

**Verifikasi (independen):** `tsc` 0 error; tests **332/332** (330 + 2
baru); `vite build` OK (peringatan chunk-size yang sudah ada);
preview HTTP 200; checker **0 FAIL** (293 file, 32 WARN lunak — naik dari
29: `modeAndTransport.test.ts` 568, `contractAlignment.test.ts` 509,
`http/mqttDynsec.ts` 401; semua di bawah hard cap).

**Linear:** Epic E14 (FAT-122) + 5 child P14.1–P14.5 (FAT-123–FAT-127),
semua Done; `docs/LINEAR.md` §1.1/§1.3/§8 + `docs/linear-seed.json` v13
(123 issue: 64 Done / 1 In Progress / 58 Todo).

## 18. K-05/K-06/K-07: ikuti desain API_DOCUMENTATION — Epic E15 (2026-11-17)

**Keputusan (Fathur, 2026-11-17 15:30 WIB):** "terkait poin K-05, K-06,
K-07 ikuti API_DOCUMENTATION design saja dulu sembari mencatat poinnya
untuk guide peningkatan backend" — panel mengikuti desain dokumen; poin
yang tidak bisa diputuskan dari dokumen dicatat di
`docs/BACKEND_UPGRADE_PLAN.md` (decision log Lampiran C + item Fase 2/5)
sebagai tugas dokumentasi backend.

**Dasar dokumen (dibaca langsung sebelum implementasi):**

- API doc §M: endpoint dynsec hanya mencantumkan method/path/status —
  TIDAK memberi skema body/respons sub-operasi. Bentuk objek tunggal ada
  di Guide Lampiran A: `POST /clients/:name/roles {rolename, priority?}`,
  `POST /roles/:name/acls {acltype, topic, ...}`,
  `POST /groups/:name/clients {username, priority?}`,
  `POST /groups/:name/roles {rolename, priority?}`. ("Lampiran O" di
  `docs/BACKEND_GAPS_SYSTEM_ADMIN.md` = sub-bagian O di dalam Lampiran A.)
- API §M: password "tidak pernah dicatat atau dikembalikan ulang setelah
  pembuatan (`generatePassword()` hanya sekali)"; contoh cURL selalu
  menyertakan password eksplisit; Guide §7.2: password klien MQTT min 8
  (env), maks 128.
- API §3.3b: hanya tabel endpoint config — TIDAK ada skema JSON config.
  API §3.3a: overview `{dynamicSecurity: object | null, configuration:
  object | null}` (null bila plugin tidak aktif).

**Perubahan (E15, FAT-128–133):**

- P15.1 K-05 (FAT-129): `http/mqttDynsec.ts` — 4 body ke objek tunggal:
  `addMqttClientRole {roles:[{rolename, priority}]}` →
  `{rolename, priority}`; `addMqttRoleAcl {acls:[acl]}` → `acl` (objek
  tunggal; field `allow` tetap dikirim — UI mengumpulkannya, dokumen
  tidak menyebut `allow`/`priority`); `addMqttGroupClient
  {clients:[{username}]}` → `{username}`; `addMqttGroupRole
  {roles:[{rolename}]}` → `{rolename}`. Registry tidak berubah
  (method/path sudah benar).
- P15.2 K-06 B33 (FAT-130): `CreateMqttClientModal.tsx` — password wajib:
  subtitle/label/placeholder janji auto-generate dihapus; validasi min 8
  maks 128 dengan pesan error (guard di `submit()` karena footer
  memanggil `submit()` langsung, bypass validasi HTML5 form; `required
  minLength maxLength` juga dipasang di Input).
- P15.3 K-06 B35 (FAT-131): `mappers/system.ts` `mapMqttClient` — logika
  `enabled` diperbaiki: `enabled` bila ada dipakai langsung; bila hanya
  `disabled` yang ada, turunkan darinya; bila tidak ada keduanya, default
  aktif. Bentuk lama membalik `{enabled:false}` (klien nonaktif tampil
  aktif).
- P15.4 K-07 B44 (FAT-132): `types/mqtt.ts` —
  `BrokerOverviewInfo['configuration']['status']` tambah `'UNAVAILABLE'`;
  `mapBrokerOverview` — `configuration: null` → status `'UNAVAILABLE'`
  (bukan `IN_SYNC`). Halaman `BrokerOverviewPage.tsx` tidak diubah —
  sudah me-render status mentah (badge warning untuk non-IN_SYNC).

**Tanpa perubahan panel (dicatat sebagai tugas backend):**

- B34: dokumen tidak menamai field password sekali tampil — panel tetap
  menebak `raw.generatedPassword ?? raw.password`; backend wajib
  mendokumentasikan nama field (item 2.5).
- B43: API §3.3b tidak memberi skema config — panel mempertahankan
  skema asumsinya; backend wajib mempublikasikan skema JSON + contoh
  (item 5.1).
- B32: dokumen tidak menyebut `allow`/`priority` pada ACL — backend
  wajib mendokumentasikan (item 2.2).
- B33 (demo): demo tetap auto-generate password (`dynsec_<acak>`) untuk
  pemanggilan `apiClient` langsung (test seam;
  `contractAlignment.test.ts` mengandalkannya) — BUKAN perilaku Real mode.

**Catatan.**

- Kontradiksi K-11 (bukan bagian E15, dicatat di sini): Guide §9.1
  menyatakan "Tidak ada `POST /clients/provision`; dokumen API lama
  menyebutnya, tetapi rute itu tidak terdaftar", sementara API §M memberi
  contoh cURL `POST /clients/provision` — Fathur sudah memilih (b) di
  K-11; Guide harus dikoreksi (sudah tercatat di decision log K-11).
- Stub test ketiga dalam satu file HARUS memakai port berbeda (3004; E14
  memakai 3003) — pelajaran yang sama seperti §17.
- K-05/K-06/K-07 kini tidak lagi menunda Fase 2/Fase 5 dari sisi
  keputusan; yang tertunda adalah penulisan dokumen/skema backend (item
  2.5/2.6/5.1).
- Mode Real tetap belum terverifikasi end-to-end (belum ada backend);
  perubahan di atas diverifikasi melawan stub HTTP lokal + unit test
  mapper, bukan server sungguhan.

**Verifikasi (independen):** `tsc` 0 error; tests **335/335** (332 + 3
baru: 2 unit mapper `system.test.ts`, 1 stub `modeAndTransport.test.ts`
port 3004); `vite build` OK (peringatan chunk-size yang sudah ada);
preview HTTP 200; checker **0 FAIL** (294 file, 32 WARN lunak).

**Linear:** Epic E15 (FAT-128) + 5 child P15.1–P15.5 (FAT-129–FAT-133),
semua Done; `docs/LINEAR.md` §1.1/§1.3/§8 + `docs/linear-seed.json` v14
(129 issue: 70 Done / 1 In Progress / 58 Todo).

## 19. Sinkronisasi dokumen panduan upgrade backend — Epic E16 (2026-11-17)

**Permintaan (Fathur, 2026-11-17 16:30 WIB):** "lakukan singronisasi atau
pembaruan terhadap BACKEND_UPGRADE_PLAN dan dokumen terkait lain yang akan
digunakan sebagai panduan upgrade backend jika belum" — periksa dan perbarui
dokumen panduan agar cocok dengan keadaan panel kini.

**Temuan sapuan:** 4 dokumen panduan masih memuat angka/pernyataan basi
pasca-E14/E15:

- `docs/BACKEND_UPGRADE_PLAN.md`: Status Linear 117 issue (58 Done / 1 In
  Progress / 58 Todo); registry 131 operasi; tests 330/330; referensi
  `AUDIT.md` §14–§16; Versi 1.0.
- `docs/BACKEND_GAPS_SYSTEM_ADMIN.md`: "131 operasi"; tema 2 masih
  menggambarkan panel mengirim array jamak dynsec; tiap gap
  B2/B28/B29/B31/B32/B33/B35/B36/B37/B38/B44 masih menulis perilaku panel
  saat audit tanpa catatan perubahan.
- `docs/BACKEND_REQUIREMENTS_ACCESS_MODE.md`: B7 "131 operasi admin".
- `docs/TELEMETRY_AUDIT.md`: tanpa penanda bahwa proposal panel sudah
  diimplementasikan (E11/E12).

**Perubahan (E16, FAT-134–138):**

- P16.1 (FAT-135): plan → v1.1: Linear 129 issue (70 Done / 1 In Progress /
  58 Todo) + E14/E15 Done; registry 132 operasi; tests 335/335; referensi
  AUDIT.md §14–§18 (header, P-3, footer); item 7.7 "132 operasi admin";
  catatan perubahan v1.1.
- P16.2 (FAT-136): gaps doc — bagian baru "Status panel pasca-audit —
  E14/E15" (tabel 11 gap: perilaku saat audit vs kini vs tugas backend
  tersisa) + catatan gap yang tidak berubah (B1/B3/B30/B39/B40/B41/B42);
  Ringkasan "132 operasi"; tema 2 diperbarui (K-05 (a) diputuskan, panel
  sudah objek tunggal).
- P16.3 (FAT-137): access-mode B7 → 132 operasi; telemetry audit header +
  baris status E11/E12 (yang tersisa hanya item sisi server Fase 8).
- P16.4 (FAT-138): verifikasi + bookkeeping.

**Yang sengaja TIDAK diubah:** AUDIT.md §16/§17 (catatan historis — §18
sudah mengoreksinya); `docs/linear-seed.json` `notes` (changelog historis);
prinsip proses Fase 0 di plan ("tergantung padanya ditunda, bukan dikerjakan
dengan asumsi") — bukan status basi.

**Verifikasi:** grep keempat dokumen panduan: 0 kemunculan "117 issue",
"131 operasi", "330/330", "§14–§16"; "ditunda" tersisa 1× di plan baris 255
(prinsip proses, benar dipertahankan). Tidak ada perubahan kode — tidak ada
test yang dijalankan ulang (terakhir 335/335, tsc 0, build OK, preview HTTP
200, checker 0 FAIL — E15).

**Linear:** Epic E16 (FAT-134) + 4 child P16.1–P16.4 (FAT-135–FAT-138),
semua Done; `docs/LINEAR.md` §1.1/§1.3/§8 + `docs/linear-seed.json` v15
(134 issue: 75 Done / 1 In Progress / 58 Todo).

## 20. Pull keputusan backend 18 Nov + analisis relevansi Fase 0 — Epic E17 (2026-11-18)

**Permintaan (Fathur, 2026-11-18 19:36 WIB):** "coba pull dan analisa
apakah file upgrade backend yang sudah diberikan keputusan perubahan tetap
relevan terhadap real-case industri karena ada beberapa keputusan yang
diberikan solusi alternatif?"

**Pull:** remote head baru `393fb09` "Docs: catat keputusan backend System
Admin 18 Nov 2026 (SYS-B8..B50)" oleh Fathur (19:11 WIB) — dicatat di
`docs/BACKEND_GAPS_SYSTEM_ADMIN.md` § "Keputusan backend — 18 November
2026": lima modul remediasi (specs/034–038 di repo `iiot-oee`),
implementasi belum dimulai. Di-cherry-pick ke lokal (`f7a4b5f`,
authorship dipertahankan); remote `d056e85` (E16) adalah ancestor-nya,
tidak ada konflik. **Temuan pull:** file yatim di remote
`src/features/assets/MachineDetailModal.tsx` (222 baris, ada sejak commit
awal `c59db6c`) — tidak ada di lokal, tidak diimpor apa pun; modal yang
benar ada di `src/features/assets/components/MachineDetailModal.tsx`.
Kemungkinan sisa snapshot-push awal (snapshot-push tidak menghapus file
remote). Penghapusan menunggu persetujuan Fathur.

**Analisis** (`docs/BACKEND_DECISIONS_REALITY_CHECK.md`, E17 FAT-139–143):
dari 15 keputusan Fase 0 — **7 dikonfirmasi** backend (K-05, K-06, K-07,
K-08, K-10, K-13, K-14), **1 disempurnakan** (K-04: `issues[]` +
`details`), **3 dibalik** (K-03 → terima keduanya; K-09 → endpoint
didukung + guard; K-11 → tidak ada `/clients/provision`, pakai
`POST /clients`), **3 masih terbuka** (K-01, K-02, K-12), **1 belum
tercakup** (K-15, Fase 8 telemetry). Grounding industri: Fastify
`ignoreTrailingSlash`, protokol native Mosquitto dynsec
(`$CONTROL/dynamic-security/v1`, objek perintah tunggal), RFC 7807/9457
+ pola Zod `issues`, NIST SP 800-63B §5.1.1.2 (min 8), definisi OEE
textbook / ISO 22400-2, pola provisioning AWS IoT / Azure DPS, Postel's
law vs Stripe untuk query param tak dikenal (K-08 dicatat sebagai
trade-off nyata, bukan konsensus — risiko typo filter tepat mengenai
konflik casing B45).

**Tindak lanjut panel yang ditimbulkan (belum dikerjakan — perlu
keputusan Fathur):** P-A revert K-11 (registry PROVISION + cabang
`isProvision` → 404 di Real mode; registry 132 → 131); P-B hapus
`accessMap` (kirim `access` verbatim); P-C polling apply/rollback sampai
status terminal (saat ini sekali); P-D/P-E filter server-side B11/B17;
P-F aturan anti-eskalasi B18; P-K koreksi decision log K-03/K-09/K-11 +
item rencana; P-L catatan B2/B5 di gaps doc sudah basi (E14 sudah PUT).
Tidak ada perubahan kode di E17 — analisis dokumen saja.

**Linear:** Epic E17 (FAT-139) + 4 child P17.1–P17.4 (FAT-140–FAT-143),
semua Done; `docs/LINEAR.md` §1.1/§1.3/§8 + `docs/linear-seed.json` v16
(139 issue: 80 Done / 1 In Progress / 58 Todo).

## 21. Penutupan keputusan gap — delegasi Fathur (2026-11-18 malam, Epic E18)

**Permintaan (Fathur, 2026-11-18 21:32 WIB):** "saya serahkan keputusan
kepadamu dengan tetap mereferensikan ke kebutuhan real-case dengan menutup
gap antara backend dan admin-panel tanpa membuat duplikasi/deprecated flow
logic" — Fathur mendelegasikan seluruh keputusan dari panduan penutupan
gap (`~/workspace/panduan-penutupan-keputusan-gap.md`, 22 item) ke Muse.
**Belum ke implementasi** (sesuai arahan sebelumnya): langkah ini hanya
memutuskan + mencatat; implementasi panel menjadi epic berikutnya.

**Koreksi pencatatan (ditemukan saat mengerjakan):** Bagian B panduan
(K-01/K-02/K-12/K-15) sempat ditulis sebagai "masih terbuka" — sebenarnya
keempatnya sudah diputuskan Fathur 17 Nov 2026 (semua (a), Lampiran C).
Yang terbuka adalah **konfirmasi backend** (D-1/D-2, aturan
`authz_version`, K-15 di luar lima modul). Panduan sudah diperbaiki;
keputusan delegasi untuk keempatnya adalah **konfirmasi tetap (a)**.

**Keputusan (22/22, tanpa skip):**

- **A — konfirmasi pembalikan backend 18 Nov:** K-03 → (c) terima kedua
  bentuk; K-04 → dual `issues[]`+`details` (panel baca `issues` saja);
  K-09 → (a) didukung + guard; K-11 → (a) `POST /clients` (rute
  provision tidak ada).
- **B — Fase 0 dikonfirmasi tetap:** K-01 (a) `current_password`, K-02
  (a) nested, K-12 (a) setiap mutasi bump, K-15 (a) excluded + "planned".
- **C — gap baru diputuskan:** B1 (b) body policy camelCase kanonis +
  `subjectMatch` terstruktur; B3 (a) ABAC scope minimal; B4 (a) alur paksa
  `mustChangePassword`; B6 (a) publikasikan skema respons IAM; B7 (a)
  `409 ROLE_IN_USE`; B16 (a) samakan 5/60 + `Retry-After`; enum
  `event_type` (a) tertutup (daftar dari backend).
- **D — arah panel:** P-A revert K-11 **Ya**, P-B hapus `accessMap`
  **Ya**, P-C polling terminal **Ya**, P-D/P-E filter **Ya**, P-F
  anti-eskalasi **Ya**, P-I `GET /health/detail` **Ya — tertunda sampai
  backend menyediakan endpoint**, P-J export audit **Ya**.

**Aturan satu alur kanonis (mengikat implementasi berikutnya):** hapus
cabang PROVISION + registry-nya seluruhnya (bukan dipertahankan sebagai
fallback deprecated); hapus `accessMap` + default `'telemetry'`
seluruhnya; panel membaca `issues` saja (bukan dual); satu casing body
policy (camelCase, tanpa fallback snake_case); satu aturan lockout
(server 5/60, panel tidak menegakkan hitungannya sendiri); satu alur
ganti-password-wajib. Tidak ada flow kedua yang dipertahankan "untuk
jaga-jaga".

**Rencana implementasi (epic berikutnya, belum dikerjakan):**

1. P-A — revert K-11: hapus `MQTT_DYNSEC_CLIENTS_PROVISION` dari registry
   + cabang `isProvision` (http + demo) + kembalikan pola provision ke
   daftar terlarang; sesuaikan tes; registry 132 → 131.
2. P-B — hapus `accessMap` (`http/mqttDynsec.ts:74,87`); kirim `access`
   verbatim; tanpa default.
3. P-C — polling apply/rollback sampai status terminal
   (`useBrokerConfig.ts:169-170` sekali → loop + timeout) + hormati
   `acknowledgeUnvalidated`.
4. P-D/P-E — filter server-side IAM audit (`getIamAuditDecisions`, limit
   100 tanpa filter → filter + limit s.d. 1000) + filter
   `operatorId`/`roleId` (setelah verifikasi dukungan backend).
5. P-F — sesuaikan aturan anti-eskalasi panel ke backend.
6. P-J — tombol export system audit (`GET /system/audit/export`) +
   transport + demo.
7. P-I — **tertunda**: transport `GET /health/detail` boleh disiapkan,
   rewire halaman menunggu endpoint backend (tanpa fallback ganda).
8. P-K/P-L — koreksi dokumen mengikuti jawaban A (sudah dikerjakan di
   E18: decision log §C.1a, item 1.5/2.3/3.9, gaps doc B2/B5).

**Pencatatan:** panduan terisi 22/22; Lampiran C §C.1a (rencana) + item
1.5/2.3/3.9 + checklist C.2; gaps doc § Keputusan lanjutan + tabel luar
modul + D-1/D-2 Terjawab + "Masih terbuka" diperbarui; reality-check §8;
Linear E18 (FAT-144) + 4 child (FAT-145–FAT-148), semua Done;
`docs/LINEAR.md` §1.1/§1.3/§8 + `docs/linear-seed.json` v17 (144 issue:
85 Done / 1 In Progress / 58 Todo).

**Yang masih terbuka setelah putaran ini:** tipe `operator.role` untuk
label custom, satuan `uptime`, overlap jadwal lintas tengah malam;
konfirmasi backend atas K-01/K-02/K-12; implementasi Fase 8 (K-15);
daftar enum `event_type` dari kode backend.

## 22. Gaps doc: semua gap SYS-B1–B50 tertutup — status (2026-11-18 malam, Epic E19)

**Permintaan (Fathur, 2026-11-18 21:43 WIB):** "sekarang perbarui dokumen
BACKEND_GAPS_SYSTEM_ADMIN.md agar semua gab tertutup, dan push".

**Yang dikerjakan:** `docs/BACKEND_GAPS_SYSTEM_ADMIN.md` mendapat section
baru "Status seluruh gap — 18 November 2026 (semua tertutup)" — tabel
50 baris (Gap | Disposisi | Keputusan/status), diverifikasi
programmatis: **50/50 baris, ID 1–50 lengkap**; disposisi 39 backend
18 Nov + 6 delegasi E18 (B1, B3, B4, B6, B7, B16) + 2 panel-side
selesai E14 (B2, B5) + 3 panel-side tindak lanjut epic berikut (B11
P-D, B17 P-E, B18 P-F); **"Belum diputuskan" = 0** di seluruh dokumen.
Pointer header ditambah.

**Arti "tertutup" — dicatat eksplisit di dokumen:** keputusan tercatat,
BUKAN implementasi selesai. Implementasi backend belum dimulai;
**SYS-B1–SYS-B50 tetap Todo di Linear (E13, FAT-71)** sampai backend
mengimplementasikannya dan acceptance criteria lolos di mode Real.
Tindak lanjut panel (P-A–P-J) disetujui di E18 tetapi belum
diimplementasikan — menjadi epic berikut. Yang masih terbuka setelah
putaran ini (bukan gap): tipe `operator.role` untuk label custom,
satuan `uptime`, overlap jadwal lintas tengah malam; konfirmasi backend
atas K-01/K-02/K-12; implementasi Fase 8 (K-15); daftar enum
`event_type` dari kode backend.

**Linear:** E19 (FAT-149) + P19.1 (FAT-150) + P19.2 (FAT-151), semua
Done; `docs/LINEAR.md` §1.1/§1.3/§8 + `docs/linear-seed.json` v18
(147 issue: 88 Done / 1 In Progress / 58 Todo — Todo tetap 58 karena
SYS-B1–SYS-B50 tidak ditutup di Linear).

## 23. E20 — Diff API docs terupdate + keputusan D-1–D-14 + arsip gaps (2026-11-19)

**Permintaan (Fathur, 2026-11-19 07:47 WIB):** "ini adalah api docs yang sudah
terupdate mengikuti backend upgrade. sekarang singkronkan admin-panel
menggunakan api ini. buat tanpa meninggalkan deprecated" — API docs baru
`~/workspace/user/files/pasted-text.txt` (2100 baris, Fastify 5.x + spec
015/020/027/032/034/035/036/037/042/043).

**P20.1 — Diff (FAT-153, Done):** `docs/API_SYNC_DIFF.md` (374 baris) — 3
peneliti paralel (registry+transport, mapper+demo+types, UI+pages+auth),
**294 entri: 162 OK / 102 CHANGE / 21 NEW / 9 REMOVE**. Temuan terberat:
`POST /devices/provision` nol hit di `src` (panel masih cabang `isProvision`
→ `/clients/provision` + `accessMap` hidup); `mapDevice` melempar untuk device
terikat; body tulis policy snake_case akan 400 `INVALID_POLICY`;
effective-permissions baca `effectiveRoles` yang dilarang; gerbang
`mustChangePassword` belum ada; lockout lokal masih hidup; mapper op-event
mengarang `severity` + `machine_name: 'Plant System'`; null `*Pct` di-koersi
ke 0; health sintetis. Daftar hapusan deprecated **X1–X34**; **22 kontradiksi
internal dokumen (C1–C22)** — termasuk C15: `401 PASSWORD_CHANGE_REQUIRED`
tidak ada di dokumen (yang ada flag + `403 PASSWORD_ROTATION_REQUIRED`).
Verifikasi independen parent: provision 0 hit ✓, accessMap di
`http/mqttDynsec.ts:74,87` ✓, `mustChangePassword` 0 hit ✓, lockout env di
`mode.ts:433-438` ✓, `severity` default `'INFO'` di `mappers/monitoring.ts:81`
✓, `PASSWORD_CHANGE_REQUIRED` 0 di dokumen vs `PASSWORD_ROTATION_REQUIRED` 1
✓, `must_change_password=<redacted>` di 3 baris dokumen ✓ (C20).

**Fakta baru dari api_docs (menggantikan keputusan lama):** provisioning resmi
= `POST /api/v1/devices/provision` (spec 015, ADR-009) — **K-11 E18
(`POST /clients`) DIGANTIKAN**; `POST /devices` manual = legacy/deprecated;
`GET /health/detail` terdefinisi lengkap (P-I tidak terblokir); skema
`OperationalEventItem` FR-034-01; enum `event_type` 32 nilai + pola; gate
`mustChangePassword` spec 043; panel dilarang lockout paralel; IAM kanonis
camelCase tanpa `privilege_level`; PIN dihapus total.

**P20.7 — Keputusan + tinjau-ulang + arsip (FAT-159, Done):** Fathur (19 Nov):
"ikuti api_docs dulu". **D-1–D-14 diputuskan mengikuti api_docs** (D-1 flag +
403; D-2 panel toleran 3 bentuk `/auth/me`; D-3 minta daftar ABAC; D-4 OFFLINE
nilai item; D-5 legacy `POST /devices` dipertahankan berlabel; D-6 cancel
ADMIN; D-7 operator ADMIN/SUPERVISOR; D-8 `oeePct` null; D-9
`MACHINE_NOT_BOUND`; D-10 camelCase saja; D-11 panel abaikan §M; D-12 hanya
kirim parameter terdaftar; D-13 guard ekspor per endpoint; D-14 semantik flag
jelas dari konteks). **Dokumen baru `docs/API_SYNC_REVIEW.md`** — 15 item yang
perlu ditinjau kembali backend (R-1–R-15) + tabel pertanyaan lama yang sudah
terjawab api_docs (uptime detik, overlap lintas tengah malam, enum event_type,
K-01/K-02/K-12/K-15, B1/B4/B6/B7/B16, Fase 8). **Gaps lama diarsipkan:**
`docs/BACKEND_GAPS_SYSTEM_ADMIN.md` → `docs/archive/` (header arsip
ditambahkan; pointer di `BACKEND_UPGRADE_PLAN.md`); referensi historis di
AUDIT.md/LINEAR.md/reality-check dibiarkan sebagai riwayat.

**Status E20:** diff + keputusan + arsip selesai. Implementasi batch
(P20.2–P20.5) **belum dimulai** — menunggu kata Fathur ("mulai"). Tidak ada
perubahan kode di putaran ini (hanya dokumen).

## 24. E20 — Implementasi sinkronisasi ke API docs terupdate (2026-11-19)

**Permintaan (Fathur, 2026-11-19 08:12 WIB):** "mulai implementasikan
singkronisasi terhadap admin-panel". Koordinator + 4 worker berurutan (satu
worker per batch, satu commit lokal per batch, verifikasi hijau per batch).
**Tidak di-push** (menunggu kata Fathur). Linear tidak disentuh koordinator —
parent menutup issue setelah verifikasi independen (di bawah).

**P20.2 — Batch 1 provisioning (`331ce38`, 25 file, +1367/−197):**
`POST /api/v1/devices/provision` (registry + transport + demo + UI onboarding
— kredensial sekali tampil `{credential: {username, password, clientId,
topicPrefix}}`), `POST /devices/:deviceId/revoke`, `POST
/devices/:deviceId/credentials` (guard 409 `DEVICE_IN_PRODUCTION`),
`GET /devices/:deviceId/health`; field baru (`enrollmentState`,
`provisionedAt`, `credentialRotatedAt`, `boundMachine {machineId,
machineName}`); `mapDevice` diperbaiki (tidak lagi melempar untuk device
terikat). **Dihapus seluruhnya:** registry `MQTT_DYNSEC_CLIENTS_PROVISION` +
cabang `isProvision` (HTTP + demo) + `accessMap` + default `'telemetry'`.
Modal register manual legacy tetap ada berlabel legacy (D-5).

**P20.3 — Batch 2 auth + IAM (`3ca57c8`, 73 file, +2620/−1461):** gerbang
`mustChangePassword` spec 043 — flag dari login + `403
PASSWORD_ROTATION_REQUIRED` → halaman ganti password (satu alur, tanpa jalur
kedua); **lockout lokal dihapus** (`LoginPage` + `mode.ts` env
`VITE_LOGIN_MAX_ATTEMPTS`/`VITE_LOGIN_COOLDOWN_SEC` + `.env.example`) —
throttle hanya server 5/60s + `Retry-After`; refresh mengembalikan
`authzVersion` server, 401 `AUTHZ_STALE` → login ulang; demo login password
min 8. Body tulis IAM **camelCase** (`{roleId, permissionId, resourcePattern,
effect, abacCondition}`, `{action, resourceType}`); `reason` dihapus dari
baris policy; default `privilege_level`/`policy_count` + badge Level +
validasi level demo dihapus; hanya **ADMIN immutable** (preset lain bisa
diubah/dihapus bila tak dipakai), `deleteIamRole` membedakan `ROLE_IMMUTABLE`
vs `ROLE_IN_USE` (sebut operatorId); revoke tanpa baris cocok → 200
`{success: true, removed: 0}`; demo `createIamPermission` diizinkan (guard
`INERT_PERMISSION`/`PERMISSION_EXISTS`); effective-permissions baca `roles`
saja (tanpa alias `effectiveRoles`); `access_control.read` ditambahkan, kunci
capability karangan dihapus; validator ABAC dipertahankan (whitelist menunggu
backend — R-1); `mapAuthMe` toleran 3 bentuk; filter audit IAM
(subject/decision/mode/from/to); role string bebas (`ROLE_LEVELS`/
`canManageTargetRole` dihapus; default `UNASSIGNED`); demo `updateOperator`
cek `ADMIN_SINGLETON_DENIED`; toggle `ADM-001` → 400 (bukan 403). Kunci
capability baru dari pembaruan api_docs 09:23: `cancel:work_order`,
`create:machine`, `read:mqtt_admin`, `manage:mqtt_admin`.

**P20.4 — Batch 3 health + audit (`00eadb6`, 39 file, +1496/−455):**
`GET /health/detail` (ADMIN+LAN) + **sintesis di `http/health.ts` dihapus**
(label 'API v1', environment 'production', latency 0, mqtt 'UP'); mapper
`OperationalEventItem` FR-034-01 persis (description, recordedAt, acknowledged
turunan acknowledgedAt, machineName null bila mesin dihapus, **tanpa severity**,
tanpa 'Plant System'); enum `event_type` kanonis 32 nilai + pola (gantikan
dropdown 15 tebakan); filter + kolom + tipe severity dihapus; builder kirim
`acknowledged` + `machine_id` hanya ke `/system/audit`; `mapAuditLog` tanpa
field karangan; ack note max 1000; export system-audit `GET
/system/audit/export` (tombol + transport + demo, format csv/ndjson/json,
retensi 90 hari).

**P20.5 — Batch 4 telemetry/OEE/mesin/config (`d4ea63e`, 72 file, +1497/−391):**
null `*Pct` dipertahankan null (koersi ke 0 + skema tak-nullable dihapus;
`oeePct` null saat kapasitas unknown — D-8); shift-summary baca `hourly[]`
bila `include_hourly`; `HourlyOeePoint` tambah deviceId/machineId/woId;
timeline bucket default 5m; `assertAuthenticatedHttp` dihapus pada read
OEE/telemetri; refresh rekonsiliasi body `{from, to}`; demo hourly bucket ISO
+ provisional; demo shift-summary hapus hardcode menit + fallback target 64
(pakai turunan demo 50); live-state hapus `device_online: true` hardcode +
field fabrikasi; FSM `OFFLINE` nilai item sah (D-4); status-history kirim
filter state + validasi from>=to; operators create kirim `isActive`; resolve
`device_id` required; trailing slash `/operational-events/` dihapus; MQTT
overview status `READY` + count null + available/lastError/measuredAt/
lastOperation; config GET field tanpa sumber = null; config status bentuk
dokumen; apply/rollback harap 202 `{operationId, versionId}` + polling
`GET /operations/:operationId` sampai terminal + `{confirm: true}`;
**`POST /backups` dihapus** dari registry + UI; `mapDowntime` baca
`duration_sec`; demo `unlabeled_only` = operatorReason IS NULL;
`classifyDowntimeReason` bentuk dokumen; `mapWorkOrder` baca
`dispatched_at`/`acked_at`/`actual_start_at`/`actual_end_at`/
`provisional`/`count_uncertain` + status `PENDING_CLOSE` (field karangan
dihapus); demo unbind hanya blokir WO ACTIVE; WS
`DOWNTIME_EVENT_OPENED`/`CLOSED`; fallback kode error 502/503 + teruskan
`details` pada 422 + baca `Retry-After`. **Endpoint baru dari pembaruan
09:23:** `GET /api/v1/system/access-mode` (registry + transport + demo +
wiring UI — prefer nilai server di mode Real, fallback derivasi env+kanal;
demo kembalikan nilai turunan env). Registry **132 → 137 kunci** (test
menegaskan).

**Verifikasi independen parent (2026-11-19, semua hijau):** `tsc` 0 error;
tests **368/368**; `vite build` OK (peringatan chunk yang sudah ada);
preview HTTP 200; checker **0 FAIL + 0 pengecualian** (305 file, 37 WARN
lunak). Dua temuan saat verifikasi — diperbaiki parent sebelum penutupan:
(1) test `PeriodRangePicker` 'Hari ini' gagal 367/368 — **bukan akibat E20**
(file tidak disentuh E20 sejak E12; fixture tanggal tetap 2026-11-17
sedangkan deteksi preset memakai `new Date()` sungguhan → lolos hanya bila
dijalankan 2026-11-17); diperbaiki test saja (`now` dinamis: hari ini Jakarta
10:24). (2) worker Batch 1 tidak mengembalikan `/clients/provision` ke
`FORBIDDEN_ENDPOINT_PATTERNS` (bertentangan dengan keputusan E18 P-A) —
dikembalikan parent (`endpoints.ts` + asersi test dibalik) dan suite hijau
kembali 368/368.

**Yang tetap belum terverifikasi:** Real mode end-to-end (tidak ada backend);
visual di browser sungguhan (Fathur cek setelah `npm run dev`); item
R-1–R-15 (`API_SYNC_REVIEW.md` §2) masih menunggu backend. **E21** (FAT-160)
menunggu giliran: penutupan backend sync/gaps di Linear setelah E20.

### 24.1 Koreksi + tindak lanjut laporan koordinator E20 (parent, 2026-11-19)

Laporan akhir koordinator (4 batch) diterima setelah §24 ditulis. Verifikasi
parent atas poin-poinnya:

- **Koreksi hitungan enum (kesalahan saya, bukan implementasi):** dokumen
  menulis **33** nilai eksplisit `event_type`, yang benar **32** — dihitung
  langsung dari `pasted-text.txt` baris 1074 (32 backtick; panel
  `OPERATIONAL_EVENT_TYPES` di `src/types/monitoring.ts` sudah benar 32
  sejak Batch 3). Dikoreksi 33 → 32 di `API_SYNC_DIFF.md` (O2, §15),
  `API_SYNC_REVIEW.md` §3, AUDIT.md §23/§24, dan MEMORY.md. Laporan ke
  Fathur sebelumnya menyebut "33 nilai" — dikoreksi di pesan lanjutan.
- **`CursorPaginationBar` diperbaiki:** bar menampilkan akumulasi "loaded
  count" sebagai "dari total" — padahal server tidak pernah mengirim total
  dataset (envelope `meta.count` = baris halaman). Kini "dari {totalCount}"
  hanya tampil bila `hasMore` false (saat itu semua rekaman sudah dimuat,
  jadi total = jumlah dimuat); bila masih ada halaman lanjutan, tampil
  "Menampilkan {loadedCount} rekaman" + "Halaman lanjutan tersedia".
  Satu file komponen, tanpa perubahan call-site (6 halaman).
- **Batasan yang dicatat (bukan diputuskan sepihak):** bentuk pasti JSON
  `GET /mqtt/configuration/status` tidak sepenuhnya dispesifikasi dokumen
  (mapper Batch 4 membaca defensif; `lastOperation: string | null`) —
  verifikasi melawan backend sungguhan. Fallback 502 generik: 502 →
  `MQTT_PROVISION_FAILED`; `DEVICE_OFFLINE` bersifat per-device sehingga
  tidak dipakai sebagai fallback umum.
- **Salinan API doc lama di repo** (`docs/API_DOCUMENTATION.md:1578`) masih
  menyebut `DOWNTIME_STARTED|DOWNTIME_ENDED` — bukan kode panel, jadi tidak
  diubah isinya; ditambahkan catatan kepala dokumen bahwa salinan ini sudah
  digantikan api_docs terupdate.
- **Hitungan test per batch (koordinator):** 343/344 → 350/351 → 351/352 →
  367/368 — satu-satunya yang gagal di tiap batch adalah test
  `PeriodRangePicker` yang sama (pre-existing, dibuktikan koordinator gagal
  identik di tree bersih `84c692a`); sudah diperbaiki parent (§24).

## 25. E21 — Penutupan backend sync/gaps di Linear (2026-11-19)

Epic E21 (FAT-160) + anak P21.1–P21.7 (FAT-161–FAT-167), semua Done
2026-11-19. Syarat Fathur terpenuhi: dilaksanakan SETELAH E20 selesai +
terverifikasi. Metode: 6 worker paralel (5 kelompok gap + R-items/
kontradiksi), tiap verdict dikutip pasal + nomor baris api_docs terupdate
(`~/workspace/user/files/pasted-text.txt`, 2100 baris, upload 07:47 WIB).
Deliverable: `docs/BACKEND_SYNC_CLOSURE.md` (commit lokal `59e4ffc`;
koordinator, tanpa ubah kode, tanpa push, tanpa tutup Linear sendiri).

### 25.1 Verdict 50 gap (parent verifikasi independen)

- **34 TERSELESAIKAN** (implementasi backend tercermin di api_docs) +
  **2 BERUBAH/DIGANTIKAN** (B13: `reason` hanya di audit IAM, tidak pernah
  di baris policy §3.4:1507; B30: provisioning kini `POST /devices/provision`
  tanpa field `access` §E.3a:442–478) = **36 issue ditutup di Linear** —
  FAT-72, 73, 75, 76, 78, 79, 80, 81, 84, 85, 86, 87, 89, 90, 91, 92, 93, 95,
  96, 97, 98, 99, 100, 101, 109, 110, 111, 113, 114, 115, 116, 117, 118, 119,
  120, 121.
- **14 MASIH TERBUKA** — tetap Todo: B3, B6, B11, B12, B17, B23, B31–B37,
  B41 (FAT-74, 77, 82, 83, 88, 94, 102–108, 112). Pola: DynSec paling belum
  selesai (7/10 terbuka — rute terkonfirmasi, seluruh skema body sub-op dan
  skema objek klien absen); Master Data paling tuntas (6/6, spec 036).
- Verifikasi parent: tabel §2 dokumen = 50 baris, ID 1–50 lengkap; hitungan
  verdict per baris 34/14/2 persis dengan §1; close+todo = 72–121 lengkap
  dan saling lepas; spot-check bukti di file (B41 `acknowledgeUnvalidated`
  0 hit; B23 list global tanpa `machine_id` :1007–1018; §H.4:940 PUT
  operator "ADMIN LAN only"; §K:1163 aturan null; `lastSeenAt` :411/:463).
- "Tutup" di sini = implementasi backend tercermin di api_docs — BUKAN
  bukti terhadap backend yang sedang berjalan. Verifikasi terhadap backend
  sungguhan tetap langkah terpisah (Real E2E, V8.2/FAT-28); bila backend
  nyata menyimpang, issue dapat dibuka kembali dengan bukti divergensi.

### 25.2 Keputusan lama vs api_docs baru

- Terkonfirmasi: K-01, K-03 (c), K-04 (dual), K-07, K-09 (a), K-10, K-12,
  K-13, K-14, K-15; B1, B4 (koreksi kode: gerbang 403, bukan "401 khusus"
  seperti redaksi E18), B7, B16; spec 036 + 038 seluruhnya; enum
  `event_type` 32 nilai eksplisit.
- Dibalik lagi: K-11 (kedua pilihan lama digantikan `/devices/provision`);
  B23 dibalik sebagian (`machine_id` hanya di `/system/audit` + export-nya).
- Tidak terkonfirmasi: K-02 (masih 3 varian `/auth/me`), K-05/K-06 (tidak
  ada skema body sub-op dynsec maupun skema objek klien), K-08 global
  (klausul abaikan param hanya untuk `/system/audit`); B3, B6 sebagian.

### 25.3 R-items, kontradiksi, item baru

- R-1–R-15: **3 terjawab** (R-7, R-11, R-15), **2 berubah** (R-3, R-9
  sebagian — keduanya bersandar amandemen 09:23, lihat §25.4), **10 masih
  terbuka** (R-1, R-2, R-4, R-5, R-6, R-8, R-10, R-12, R-13, R-14).
- C1–C22: 4 terjawab (C13, C14, C15, C18), 4 berubah, 13 masih terbuka,
  1 fakta (C10).
- Item baru **R-16–R-23** (§5.3 dokumen penutupan): R-16
  `acknowledgeUnvalidated`, R-17 PUT `/operators` ADMIN-only vs D-7, R-18
  `machine_id` global, R-19 filter `acknowledged` di `/system/audit`, R-20
  skema dynsec, R-21 skema `GET /info` + `GET /access-control/audit`, R-22
  filter `operatorId`/`roleId`, R-23 salinan api_docs baru.
- Prioritas tindak lanjut backend: P0 — R-1, R-2, R-4+R-17, R-6, R-20, R-23;
  P1 — R-9/R-3/C8/C21, R-8, R-10, R-5, R-18, R-19, R-16, R-21, R-22;
  P2 — R-12, R-13, R-14, C6, C22, C20.
- Koreksi penilaian E20 awal (diterapkan ke `API_SYNC_REVIEW.md`): R-7
  ternyata sudah terjawab (§K:1163); R-15 premisnya salah (`DeviceResponse`
  membawa `lastSeenAt`); D-7 perlu ditinjau ulang untuk PUT (§H.4:940).

### 25.4 Caveat metodologi — salinan file vs amandemen 09:23 (PENTING)

Salinan `pasted-text.txt` di disk bermtime 19 Nov 00:47 UTC (= 07:47 WIB)
— salinan upload asli. Amandemen 09:23 dari Fathur **tidak ada dalam file
ini** — diverifikasi parent: 0 hit `access-mode`, 0 hit
`authorize("cancel"`, baris 1340 masih `/clients/provision`. Verdict yang
bersandar pada amandemen (R-3/C8 cancel ADMIN, C21 §M ke model
`authorize(...)`, R-9/C1/C5 sebagian, keberadaan
`GET /api/v1/system/access-mode`) berstatus *tercatat dari amandemen, belum
terverifikasi di dokumen*; penutupan definitifnya menunggu salinan api_docs
baru (R-23). Tidak ada gap B yang verdictnya semata-mata amandemen.

### 25.5 Linear — terverifikasi live 2026-11-19

**163 issue = 140 Done / 1 In Progress (hanya E10 FAT-34) / 22 Todo.**
Todo tersisa: 14 SYS-B terbuka + E13 (FAT-71) + V8.1–V8.5 + A10.2 (FAT-40)
+ E8 (FAT-7). LINEAR.md + seed v21. Pemetaan E21:
`~/workspace/tmp-e21-mapping.json`.
