# Uji End-to-End Panel Admin IIoT OEE — Draf

| | |
|---|---|
| **Tanggal** | 19 November 2026 (WIB) |
| **Panel** | `~/workspace/iiot-oee-admin-panel`, HEAD `b401434` (Vercel `https://iiot-oee-admin-panel.vercel.app`) |
| **Backend** | `https://oee.fadik.web.id` (Fastify, DB terhubung) |
| **Status dokumen** | DRAF — hasil gabungan (merge) tiga sumber; bukan laporan uji terautentikasi penuh |

## 1. Ruang lingkup & metode

Dokumen ini menggabungkan tiga sumber yang dikerjakan 19 November 2026:

1. **Pemetaan statis** (`~/workspace/tmp-e2e-static.md`): baca `Router.tsx`, registry `ADMIN_ENDPOINTS`, transport HTTP/demo, dan grep seluruh pemakaian `apiClient.<method>` di `src/features`, `src/context`, `src/layouts`. Tanpa browser, tanpa login, tanpa mutasi.
2. **Probe curl publik** (`~/workspace/tmp-e2e-probe.md`, ~18:13 WIB): 14 endpoint GET tanpa auth, timeout 10 detik. Status 401/403/404 dicatat sebagai hasil valid.
3. **Tes browser Fase 2** (`AUDIT.md` §33, 18:05–18:07 WIB): login ADM-001 dari panel Vercel pasca-perbaikan CORS + push `3677e7c`; navigasi baca saja, tanpa mutasi yang disubmit, tanpa network inspector.

Konteks pendukung: audit endpoint vs OpenAPI live (`docs/API_DOCS_AUDIT.md`, Fase 2a) — 141 operasi spec vs 137 registry, sweep probe 138 operasi tanpa auth, dan 35 gap baru N-7–N-41.

**Yang diuji browser vs yang hanya statis/probe — dibedakan dengan jujur:**

| Cara verifikasi | Halaman |
|---|---|
| Diuji browser Fase 2 (login + tampil, baca saja) | `/login`, `/admin` (Dashboard), `/admin/devices`, `/admin/machines`, `/telemetry`, `/analytics` — 6 halaman |
| Hanya dipetakan statis dan/atau ter-probe curl publik | 19 halaman lainnya (§3) — belum pernah dilihat tampil dengan sesi auth |
| Tidak diuji sama sekali di pekerjaan ini | Semua mutasi (belum pernah disubmit), WS handshake `/ws/telemetry`, seluruh endpoint 401-gated |

**Batasan yang berlaku untuk seluruh dokumen:** tanpa mutasi; tanpa klaim bahwa endpoint yang "dipakai UI" benar-benar mengembalikan data live di mode Real bila belum terlihat di browser; probe curl tanpa header `Origin` menguji backend, bukan akses browser (CORS hanya ditegakkan browser).

**Koreksi route (penting):** rute top-level `/devices`, `/machines`, `/products`, `/operators` **TIDAK ADA** — hanya ada di bawah `/admin/*`. Memanggil `/devices` jatuh ke catch-all `*` → redirect `/admin`. Rute top-level yang memang ada: `/work-orders`, `/telemetry`, `/analytics`, `/downtime`, `/audit`, `/system-audit` (selain alias `/admin/*`). Tabel §3 memakai path kanonis `/admin/*` untuk halaman admin.

## 2. Ringkasan cakupan

- **Halaman:** 25 halaman unik + 1 alias (`/admin/shift-analytics` = `/analytics`). 6 diuji browser Fase 2; 19 hanya statis/probe.
- **Registry endpoint:** **137 key (136 HTTP + 1 WS `WS_TELEMETRY`)**. Spec OpenAPI live: 141 operasi; 5 tidak di registry karena excluded-by-design (aktuasi/HMI-only: `devices/{id}/command`, `work-orders/{id}/dispatch|complete`, `validate-zone`, `initiate-from-zones`); registry HTTP usang = 0; MISSING = 0.
- **Hasil probe E2E (~18:13 WIB, 15 baris probe atas 14 endpoint):** **12× 200**, 1× 401 valid (`/api/v1/system/audit` — butuh Bearer token, sesuai ekspektasi), 1× 403 tunnel valid (`/health/detail` — "Health detail is not available through remote tunnel ingress."), 1× 404 pada path probe yang salah (`/telemetry/:device_id/history` — lihat §5, bukan temuan). Backend saat probe: uptime 2.492,78 dtk (~41,5 mnt), `ws_clients: 5`, `db_connected: true`, `buffer_pending: 0` — tetapi `metrics.totalReceived/validIngested: 0`, `lastIngestedAt: null` sejak (re)start.
- **Status login Fase 2:** **LULUS.** Root → `/login` (200, tanpa 404) → login ADM-001 → `/admin`. Tanpa error jaringan, tanpa 403 tunnel. Badge "API Mode: Real" + "Mode Akses: Private" terkonfirmasi live; Topbar "API: Real", "Akses: Private", "Koneksi Mesin Aktif", "Basis Data Aktif". Sesi aktif (tersisa 14:20).
- **Temuan Fase 2 yang sudah bertiket (bukan usulan baru):** N-42 live-state nol/stale (FAT-212, backend, High) dan N-43 agregat all-null ditampilkan 0% (FAT-213, panel, Low) — lihat §5.2.

## 3. Tabel per halaman

Konvensi: "Query" = method yang memetakan ke registry GET (termasuk ekspor GET); "Mutasi" = POST/PUT/PATCH/DELETE. Berlaku app-wide dan tidak diulang per baris: `AuthContext` memanggil `AUTH_ME` (GET) saat restore sesi + sesudah login, `AUTH_REFRESH` (POST) proaktif saat TTL tersisa ≤20% dan hanya di LAN; `NetworkAccessContext` memanggil `SYSTEM_ACCESS_MODE` (GET) sesudah login.

Kolom "Status probe" memakai hasil probe E2E 18:13 WIB; bila suatu endpoint hanya tercakup sweep 138-op `API_DOCS_AUDIT.md` §5, ditulis "(sweep §5)". "Tidak ter-probe publik" = endpoint 401-gated atau belum pernah diprobe tanpa auth.

| Halaman | Endpoint query | Endpoint mutasi (+ ekspor GET) | Status probe API terkait | Catatan |
|---|---|---|---|---|
| `/login` | `AUTH_ME`¹ | `AUTH_LOGIN` (POST) | Tidak ter-probe curl (login dilewati); **login lolos di browser Fase 2** | Error banner ApiError-aware; 429 → pesan khusus; tanpa retry terpisah. Badge "API Mode: Real" + "Mode Akses: Private" terkonfirmasi live (sisa N-38: indikator koneksi — FAT-207 parsial, §5.2). |
| `/` = `/admin` (Overview) | `LIVE_STATE`, `DOWNTIME_ACTIVE`, `HEALTH`, `WORK_ORDERS_LIST`, `OPERATIONAL_EVENTS_LIST`; `WS_TELEMETRY` | — | `LIVE_STATE` 200 (nilai 0/stale, N-42); `DOWNTIME_ACTIVE` 200 (`[]`); `HEALTH` 200; `WORK_ORDERS_LIST` 200; `OPERATIONAL_EVENTS_LIST` 200 (sweep §5) | **Error handling paling lemah.** Tidak ada skeleton; `catch {}` diam (`OverviewPage.tsx:56`) — gagal load = kartu kosong/0 tanpa penjelasan. WS handshake belum teruji. → E2E-01 |
| `/admin/devices` | `DEVICES_LIST`, `DEVICES_GET`, `DEVICES_HEALTH` | `DEVICES_CREATE`, `DEVICES_PROVISION`, `DEVICES_REVOKE`, `DEVICES_CREDENTIALS`, `DEVICES_UPDATE`, `DEVICES_DELETE` | `DEVICES_LIST` 200 (2 device; `lastSeenAt: null`, `isOnline: false`); detail/health + semua mutasi tidak ter-probe publik | Banner `feedback` + Refresh manual; empty state ada. Fase 2: 2 device PROVISIONED, OFFLINE. |
| `/admin/machines` | `MACHINES_LIST`, `DEVICES_LIST`, `PRODUCTION_LINES_LIST` | `MACHINES_CREATE`, `MACHINES_UPDATE`, `MACHINES_DELETE`, `MACHINES_BIND`, `MACHINES_UNBIND` | `MACHINES_LIST` 200 (2 mesin); sisanya tidak ter-probe publik | Banner `feedback`; empty state ada. Fase 2: 2 mesin Terikat; CNC-MILLING-01 RUNNING, SIM UNCONFIGURED. |
| `/admin/products` | `PRODUCTS_LIST` | `PRODUCTS_CREATE`, `PRODUCTS_UPDATE`, `PRODUCTS_DELETE` | `PRODUCTS_LIST` 200 (5 produk) | **Tidak ada teks empty-state** (tabel inline manual). `sku`/`isActive` tidak ada di payload — sudah tercakup N-5 (FAT-172), §5.2. → E2E-05 |
| `/admin/operators` | `OPERATORS_LIST`, `IAM_ROLES_LIST`, `IAM_USER_ROLES_LIST` | `OPERATORS_CREATE`, `OPERATORS_UPDATE`, `OPERATORS_DELETE`, `OPERATORS_PASSWORD`, `OPERATORS_STATUS`, `IAM_USER_ROLES_CREATE`, `IAM_USER_ROLES_DELETE` | Tidak ter-probe publik (401-gated, sweep §5) | Banner `feedback`; empty state ada. |
| `/work-orders` | `WORK_ORDERS_LIST`, `WORK_ORDERS_GET`, `TELEMETRY_HISTORY`, `TELEMETRY_HOURLY`, `DOWNTIME_BY_DEVICE`, `OPERATIONAL_EVENTS_LIST` (+ path per-device bila device dipilih), `MACHINES_LIST`, `DEVICES_LIST`, `PRODUCTS_LIST`, `OPERATORS_LIST` | `WORK_ORDERS_RESOLVE`, `WORK_ORDERS_CANCEL` | `WORK_ORDERS_LIST` 200 (3 WO); `TELEMETRY_HISTORY` 200 (path benar, §5); `TELEMETRY_HOURLY` tidak ter-probe E2E (sweep §5: 404 resource-not-found untuk ID probe); mutasi tidak ter-probe | Pola error handling paling lengkap (skeleton + banner + "Coba Lagi" + empty state). Filter WO ID diam-diam tidak berfungsi — sudah tercakup N-19 (Done). |
| `/downtime` | `DOWNTIME_ACTIVE`, `DOWNTIME_BY_DEVICE`, `MACHINES_LIST`, `DEVICES_LIST`, `PRODUCTS_LIST`, `OPERATORS_LIST` | `DOWNTIME_REASON`; ekspor `DOWNTIME_DEVICE_EXPORT` | `DOWNTIME_ACTIVE` 200 (`[]` — field mapper tidak dapat dinilai); `DOWNTIME_BY_DEVICE` 200 (sweep §5); ekspor/mutasi tidak ter-probe publik | Error handling lengkap. Kategori downtime selalu 'OTHER' — sudah tercakup N-25 (Done). |
| `/audit` | `OPERATIONAL_EVENTS_LIST` (+ path per-device bila filter device ≠ ALL), `MACHINES_LIST`, `DEVICES_LIST`, `PRODUCTS_LIST`, `OPERATORS_LIST` | `OPERATIONAL_EVENTS_ACK`; ekspor `OPERATIONAL_EVENTS_EXPORT` (+ per-device) | `OPERATIONAL_EVENTS_LIST` 200 (sweep §5); ekspor/ack tidak ter-probe publik | Error handling lengkap. Jalur per-device memakai builder bersama (`utils/historicalExport/endpoints.ts:94-109`) — lihat §4. |
| `/telemetry` | `TELEMETRY_HISTORY`, `TELEMETRY_HOURLY`, `TELEMETRY_AGGREGATE`, `TELEMETRY_ROLLUP`, `MACHINES_LIST`, `DEVICES_LIST`, `PRODUCTS_LIST`, `OPERATORS_LIST`, `SHIFTS_LIST` | — (mutasi nihil); ekspor `TELEMETRY_EXPORT`, `TELEMETRY_HOURLY_EXPORT` | `TELEMETRY_HISTORY` 200 (record terbaru OEE 92,80, `totalCount: 199`); `TELEMETRY_AGGREGATE` 200 (semua `*Pct`/delta null, N-11/N-43); `TELEMETRY_ROLLUP` 200 (sweep §5); `TELEMETRY_HOURLY` tidak ter-probe E2E; ekspor 401-gated | Fase 2: 200 sampel agregat, 50 baris raw halaman 1. Catatan shift "tidak tersedia" sempat muncul saat loading lalu hilang — kemungkinan race loading → E2E-06. |
| `/analytics` | `OEE_SHIFT_SUMMARY`, `OEE_HOURLY`, `OEE_SHIFT_TIMELINE`, `QUALITY_REJECTS_GLOBAL`, `QUALITY_REJECTS_BY_DEVICE`, `TELEMETRY_ROLLUP`, `DOWNTIME_ACTIVE`, `DOWNTIME_BY_DEVICE`, `MACHINES_LIST`, `DEVICES_LIST`, `PRODUCTS_LIST`, `OPERATORS_LIST`, `SHIFTS_LIST` | — | `OEE_SHIFT_SUMMARY` 200 (OEE 92,8; tanpa counts/`hourly[]`, N-27); `OEE_HOURLY` 200 (semua `*Pct`/count null, sampleCount 91–109 — parts tampil 0, E2E-04); `QUALITY_REJECTS_GLOBAL` 200 (`[]`); timeline/rollup tidak ter-probe E2E | Error + retry per widget (4× `onRetry`). Fase 2: Shift Total OEE 92,8% (A 95,5%, P 98,2%, Q 99,1%). Warning rekonsiliasi 2 perbedaan melebihi ambang — perlu analisis → E2E-07. |
| `/admin/system-audit` | `SYSTEM_AUDIT`, `MACHINES_LIST`, `DEVICES_LIST`, `PRODUCTS_LIST`, `OPERATORS_LIST` | — (mutasi nihil); ekspor `SYSTEM_AUDIT_EXPORT` | `SYSTEM_AUDIT` **401** (valid — butuh Bearer token); ekspor 401-gated | Error handling lengkap. |
| `/admin/access-control` | `IAM_INFO`, `IAM_ROLES_LIST`, `IAM_PERMISSIONS_LIST`, `IAM_USER_ROLES_LIST`, `IAM_POLICIES_LIST`, `IAM_AUDIT`, `OPERATORS_LIST` | 11 mutasi IAM (roles, role-permissions, user-roles, policies) | Tidak ter-probe publik (401-gated, sweep §5) | Halaman dengan endpoint terbanyak (18 key). Tanpa skeleton; banner `feedback` bisa ditutup; tanpa retry. |
| `/admin/mqtt` | `MQTT_OVERVIEW` | — | Tidak ter-probe publik (401-gated, sweep §5) | Banner `errorMsg` (403 → pesan khusus); tanpa retry; tanpa empty state eksplisit. |
| `/admin/lines` | `PRODUCTION_LINES_LIST` | `PRODUCTION_LINES_CREATE`, `PRODUCTION_LINES_UPDATE`, `PRODUCTION_LINES_DELETE` | Tidak ter-probe publik (401-gated, sweep §5) | **Tidak ada teks empty-state.** → E2E-05 |
| `/admin/shifts` | `SHIFTS_LIST` | `SHIFTS_CREATE`, `SHIFTS_UPDATE`, `SHIFTS_DELETE` | Tidak ter-probe publik (401-gated, sweep §5) | **Tidak ada teks empty-state.** → E2E-05 |
| `/admin/shift-schedules` | `SHIFT_SCHEDULES_LIST`, `PRODUCTION_LINES_LIST`, `SHIFTS_LIST` | `SHIFT_SCHEDULES_CREATE`, `SHIFT_SCHEDULES_UPDATE`, `SHIFT_SCHEDULES_DELETE` | Tidak ter-probe publik (401-gated, sweep §5) | **Tidak ada teks empty-state.** → E2E-05 |
| `/force-change-password` | — | `AUTH_CHANGE_PASSWORD` (POST) | Tidak ter-probe (mutasi) | Form; error banner ApiError-aware; 429 → "Tunggu N detik…". |
| `/admin/live-state` | `LIVE_STATE`; `WS_TELEMETRY` | — | `LIVE_STATE` 200 (nilai 0/stale, N-42) | **Error handling paling lemah.** `catch {}` diam (`LiveStatePage.tsx:33`) + tanpa empty state — gagal load tidak dapat dibedakan dari "tidak ada data". → E2E-01 |
| `/admin/quality` | `DEVICES_LIST`, `QUALITY_REJECTS_GLOBAL`, `QUALITY_REJECTS_BY_DEVICE` | — | `QUALITY_REJECTS_GLOBAL` 200 (`[]` — field mapper tidak dapat dinilai); `DEVICES_LIST` 200 | **Tidak ada banner error** — `catch` → `setItems([])` (`QualityRejectsPage.tsx:37`); error tampil sebagai empty state "Tidak ada data reject…" yang menyesatkan. → E2E-02 |
| `/admin/reconciliation` | `RECONCILIATION_JOBS` | `RECONCILIATION_REFRESH` (POST) | `RECONCILIATION_JOBS` 200 (sweep §5); refresh tidak ter-probe | Banner `errorMsg` (403/429 khusus); tanpa teks empty-state eksplisit. Body refresh `{from,to}` vs spec `{startWindow,endWindow}` — sudah tercakup N-8 (Done). → E2E-05 (bagian empty state) |
| `/admin/mqtt/security` | `MQTT_DYNSEC_CLIENTS_LIST`, `MQTT_DYNSEC_ROLES_LIST`, `MQTT_DYNSEC_GROUPS_LIST` | 14 mutasi DynSec (clients, roles, ACLs, groups) | Tidak ter-probe publik (401-gated, sweep §5) | Halaman endpoint terbanyak ke-2 (17 key). Tanpa retry; tanpa teks empty-state eksplisit. |
| `/admin/mqtt/configuration` | `MQTT_CONFIG_GET`, `MQTT_CONFIG_RAW`, `MQTT_CONFIG_STATUS`, `MQTT_CONFIG_LIST`, `MQTT_CONFIG_OPERATIONS`, `MQTT_CONFIG_OPERATION_GET`, `MQTT_CONFIG_BACKUPS` | `MQTT_CONFIG_STAGE`, `MQTT_CONFIG_VERSION_DIFF` (GET), `MQTT_CONFIG_VERSION_DELETE`, `MQTT_CONFIG_VERSION_APPLY`, `MQTT_CONFIG_VERSION_ROLLBACK` | Tidak ter-probe publik (401-gated; apply/rollback 403 tunnel, sweep §5) | Banner `feedback` + banner validasi terpisah; tanpa retry; tanpa empty state eksplisit. Mismatch mapper config (status/diff/stage) — sudah tercakup N-10/N-12/N-13 (Done). |
| `/admin/system/health` | `HEALTH`, `HEALTH_DETAIL` | — | `HEALTH` 200; `HEALTH_DETAIL` **403** tunnel (valid — hanya LAN/admin) | **Tidak ada banner error umum** — gagal `HEALTH` = teks "Memuat status kesehatan sistem..." selamanya; hanya gagal `HEALTH_DETAIL` yang diberi banner amber. → E2E-03 |
| `/admin/system/info` | — (tidak memanggil `apiClient` sama sekali) | — | n/a (halaman info statis dari context) | Tidak ada panggilan API; tidak ada yang perlu diprobe. |
| `/admin/shift-analytics` | Sama dengan `/analytics` | Sama dengan `/analytics` | Sama dengan `/analytics` | Alias `OeeAnalyticsPage`. |

¹ `AUTH_ME` di LoginPage dipanggil `AuthContext.login` sesudah `AUTH_LOGIN` sukses (`AuthContext.tsx:172`), plus saat restore sesi (`AuthContext.tsx:86`).

**Pola error handling (ringkas):** paling lengkap — halaman berbasis `DataTable` (`/work-orders`, `/downtime`, `/audit`, `/telemetry`, `/admin/system-audit`): skeleton + banner per kode HTTP (401/403/404/429/5xx dibedakan) + tombol "Coba Lagi" bila bisa retry + empty state eksplisit; disusul `/analytics` (error + retry per widget). Paling lemah — `/admin/live-state`, `/` (Overview), `/admin/quality`, `/admin/system/health` (§5.1, E2E-01–E2E-03).

## 4. Verifikasi TRANSPORT_ONLY — koreksi WIRED_UI 121 → 126

Dari 16 key TRANSPORT_ONLY di `API_DOCS_AUDIT.md` §8, hasil verifikasi statis penuh (grep pemakaian `apiClient.<method>` di luar `src/services/api` + jalur transport internal):

**11 tetap TRANSPORT_ONLY** — hanya definisi di `src/services/api/http/*` + `src/services/api/demo/*` (+ test); tidak ada jalur UI yang menyentuh path-nya:

| Key | Keterangan |
|---|---|
| `IAM_PERMISSIONS_CREATE` | Satu-satunya IAM yang mati; UI IAM tak punya aksi buat permission baru (`PermissionsTab.tsx:16` — hanya "Assign ke Role") |
| `LIVE_STATE_BY_DEVICE` | `LiveStatePage` hanya memakai list global `getLiveState` |
| `MACHINES_STATUS_HISTORY` | Tidak ada halaman riwayat status mesin |
| `MQTT_DYNSEC_GROUP_CLIENTS_DELETE` | UI hanya punya tambah client ke group, tanpa aksi lepas |
| `MQTT_DYNSEC_GROUP_ROLES_DELETE` | UI hanya punya tambah role ke group, tanpa aksi lepas |
| `MQTT_DYNSEC_STATUS` | Status DynSec tak ditampilkan di halaman mana pun (`BrokerOverviewPage` hanya memakai `MQTT_OVERVIEW`) |
| `OPERATORS_GET` | Halaman operator hanya memakai list; detail modal memakai objek dari list |
| `PRODUCTION_LINES_GET` | Halaman lines hanya memakai list |
| `PRODUCTS_GET` | Halaman products hanya memakai list |
| `SHIFTS_GET` | Halaman shifts hanya memakai list |
| `SHIFT_SCHEDULES_GET` | Halaman shift-schedules hanya memakai list |

**5 kini DIPAKAI UI secara tidak langsung** (method tidak pernah dipanggil UI langsung, tetapi request HTTP ke path key tersebut tetap terjadi dari UI lewat method transport lain yang memanggilnya secara internal, atau builder path bersama):

| Key | Bukti (file + baris) |
|---|---|
| `MQTT_CONFIG_VERSION_GET` | Transport HTTP memanggilnya internal dari `applyBrokerConfigVersion` (`http/mqttConfig.ts:285`) dan `rollbackBrokerConfig` (`http/mqttConfig.ts:330`) — keduanya DIPAKAI UI (`useBrokerConfig.ts:182,186`). Mode Real saja; demo tidak. |
| `MQTT_DYNSEC_CLIENTS_GET` | Transport HTTP memanggilnya internal dari `toggleMqttClient` (`http/mqttDynsec.ts:135`) dan `addMqttClientRole` (`http/mqttDynsec.ts:152`) — keduanya DIPAKAI UI (`useMqttClientMutations.ts:43,77`). Mode Real saja. |
| `MQTT_DYNSEC_GROUPS_GET` | Transport HTTP memanggilnya internal dari `createMqttGroup` (`http/mqttDynsec.ts:294`), `addMqttGroupClient` (`:326`), `addMqttGroupRole` (`:357`) — ketiganya DIPAKAI UI (`useMqttGroupMutations.ts:12,41,53`). Mode Real saja. |
| `MQTT_DYNSEC_ROLES_GET` | Transport HTTP memanggilnya internal dari `createMqttRole` (`http/mqttDynsec.ts:207`) dan `addMqttRoleAcl` (`:239`) — keduanya DIPAKAI UI (`useMqttRoleMutations.ts:19,34`). Mode Real saja. |
| `OPERATIONAL_EVENTS_BY_DEVICE` | Path template (`/api/v1/operational-events/:deviceId`) dicapai UI lewat `getOperationalEventsPage` + `device_id` via `buildOperationalEventsEndpoint` (`utils/historicalExport/endpoints.ts:94-109`); pemanggil: `OperationalEventsPage.tsx:25,60`, `useWorkOrderCorrelation.ts:87`, `useHistoricalQueries.ts:148`. Di mode Demo, `demo/monitoring.ts:227` secara eksplisit mencatat key ini bila tidak global. Kedua mode. |

**Koreksi hitungan:** WIRED_UI `API_DOCS_AUDIT.md` §8 (121) secara substansi menjadi **121 + 5 = 126 key** yang dapat tersentuh UI (4 di antaranya hanya di mode Real, 1 di kedua mode); TRANSPORT_ONLY tersisa **11 key**; UNREFERENCED tetap 0; tidak ada key yang dihapus dari registry. Ke-11 TRANSPORT_ONLY yang tersisa adalah temuan cakupan, bukan cacat — tidak diusulkan sebagai tiket perbaikan (keputusan produk apakah UI-nya dibutuhkan, mis. aksi lepas client/role dari group atau halaman detail per item).

## 5. Daftar tiket yang diusulkan

Skala prioritas: **1 = kritis/urgent, 2 = tinggi, 3 = sedang, 4 = rendah.** Kunci sementara `E2E-01…` — **jangan dibuat di Linear** dari dokumen ini; pembuatan tiket tetap wewenang Fathur/parent. Semua tiket di §5.1 adalah **temuan baru** (tidak ada duplikasi dengan tiket yang sudah ada; pemeriksaan silang ada di §5.2).

### 5.1 Usulan tiket baru

**E2E-01 — Overview + Live-State menelan error diam-diam (catch {} tanpa banner) — panel, prioritas 2.**
- Bukti: `/` (`OverviewPage.tsx:56`, `catch {}` "Errors handled gracefully") — satu `Promise.all` gagal = seluruh dashboard kosong tanpa penjelasan, tanpa skeleton; `/admin/live-state` (`LiveStatePage.tsx:33`, `catch {}` "Handle silently") + tanpa empty state — gagal load tidak dapat dibedakan dari "tidak ada data".
- Perbaikan yang diharapkan: banner error + tombol retry mengikuti pola `DataTable` (skeleton saat loading, banner per kode HTTP, "Coba Lagi" bila bisa retry), dan empty state eksplisit di Live-State.
- Status: **temuan baru** — belum ada tiket N-/FAT- untuk pola ini.

**E2E-02 — Halaman Quality menyamarkan error sebagai empty state — panel, prioritas 3.**
- Bukti: `/admin/quality` (`QualityRejectsPage.tsx:37`) — `catch` → `setItems([])` diam; saat request gagal, UI menampilkan "Tidak ada data reject dalam rentang waktu ini" seolah-olah memang tidak ada data.
- Perbaikan yang diharapkan: bedakan state error dari state kosong (banner error + retry; empty state hanya bila respons sukses dan kosong).
- Status: **temuan baru** — belum ada tiket N-/FAT- untuk ini.

**E2E-03 — Halaman System Health macet di "Memuat…" selamanya bila GET /health gagal — panel, prioritas 3.**
- Bukti: `/admin/system/health` (`SystemHealthPage.tsx`) — tidak ada banner error umum; gagal `HEALTH` hanya menampilkan "Memuat status kesehatan sistem..." tanpa batas waktu, sementara hanya kegagalan `HEALTH_DETAIL` yang diberi banner amber.
- Perbaikan yang diharapkan: banner error + tombol Refresh/retry bila `HEALTH` gagal (mengikuti pola halaman lain); jangan biarkan status loading tanpa akhir.
- Status: **temuan baru** — belum ada tiket N-/FAT- untuk ini. (Catatan: `HEALTH_DETAIL` 403 tunnel adalah perilaku server yang diharapkan, bukan bagian tiket ini.)

**E2E-04 — OEE hourly: totalCount null → parts_produced 0 (angka 0 menyesatkan) — panel, prioritas 3.**
- Bukti: probe E2E 18:13 WIB — `GET /api/v1/oee/hourly?device_id=STM32-OEE-01&limit=3` mengembalikan 2 bucket (08:00, 07:00Z) dengan semua `*Pct`, `totalCount`, `rejectCount`, `goodCount`, `operatingSec`, `runSec` = null, tetapi `sampleCount` 109/91; mapper `mapHourly` (`src/services/api/http/mappers/monitoring.ts:229-238`) menghitung `parts_produced = num(totalCount, 0)` → 0, sehingga panel menampilkan 0 part/jam padahal ada 91–109 sampel.
- Perbaikan yang diharapkan: tampilkan '—' (tidak diketahui) bila `totalCount` null, atau turunkan dari sumber lain yang valid; jangan tampilkan 0. Terapkan aturan null yang sama seperti yang akan diputuskan untuk N-43.
- Status: **temuan baru** — terkait tetapi **tidak tercakup** N-27 (shift-summary: respons tanpa counts/`hourly[]`, Done) maupun N-11 (telemetry aggregate, Done) maupun N-43 (tampilan tab aggregate, FAT-213). Ketiganya menyangkut endpoint/mapper berbeda (`OEE_SHIFT_SUMMARY`, `TELEMETRY_AGGREGATE`, tampilan agregat); `OEE_HOURLY` + `mapHourly` belum tersentuh tiket mana pun.

**E2E-05 — Empat halaman CRUD + Reconciliation tanpa empty state — panel, prioritas 4.**
- Bukti: `/admin/products` (`ProductsPage.tsx`), `/admin/lines` (`ProductionLinesPage.tsx`), `/admin/shifts` (`ShiftsPage.tsx`), `/admin/shift-schedules` (`ShiftSchedulesPage.tsx`) — grep "Tidak ada"/"Belum ada"/`length === 0` nihil; tabel inline manual render tanpa baris dan tanpa pesan bila kosong. `/admin/reconciliation` (`DataReconciliationPage.tsx`) juga tanpa teks empty-state eksplisit. Kontras: `DevicesPage`/`MachinesPage`/`OperatorsPage` memakai tabel komponen yang sudah punya empty state.
- Perbaikan yang diharapkan: satu pola empty state yang sama (mis. komponen tabel yang dipakai halaman Devices/Machines/Operators) diterapkan ke kelima halaman.
- Status: **temuan baru** — belum ada tiket N-/FAT- untuk ini. Satu tiket untuk polanya, bukan satu tiket per halaman.

**E2E-06 — Peringatan shift "tidak tersedia" sempat muncul saat loading di /telemetry (kemungkinan race) — panel, prioritas 4.**
- Bukti: `AUDIT.md` §33.4 — catatan "Daftar shift tidak tersedia — periksa akses shift.read / koneksi." muncul saat loading lalu hilang sendiri (filter Pagi/Siang/Malam tersedia). Diduga race loading (pesan error tampil sebelum query shift selesai).
- Perbaikan yang diharapkan: reproduksi dulu; bila terkonfirmasi, tampilkan peringatan hanya setelah query shift benar-benar gagal (bukan saat masih loading).
- Status: **temuan baru** — observasi Fase 2 tanpa tiket; butuh reproduksi sebelum perbaikan.

**E2E-07 — Investigasi: selisih rekonsiliasi 7 hari vs jendela shift + RUNNING 235 vs 99 menit — panel (analisis dulu), prioritas 4.**
- Bukti: `AUDIT.md` §33.4 — warning "2 differences exceed threshold": RUNNING timeline vs summary 235 vs 99 mnt (+136); total timeline vs shift window 10.080 vs 99 mnt (+9.981). Sebagian residual E11/E12 yang sudah dikenal (timeline↔hourly beda distribusi); selisih 10.080 mnt = 7 hari vs jendela shift 99 mnt — kemungkinan perbandingan jendela yang tidak sebanding di cek rekonsiliasi.
- Perbaikan yang diharapkan: analisis dulu (bukan langsung perbaikan) — tentukan apakah cek membandingkan jendela yang sebanding; tiket perbaikan terpisah bila analisis menemukan cacat.
- Status: **temuan baru sebagai tiket investigasi** — `AUDIT.md` §33.4 secara eksplisit menyatakan "Perlu analisis sebelum dijadikan tiket"; usulan ini adalah tiket analisis itu, bukan tiket perbaikan.

### 5.2 Temuan yang SUDAH tercakup tiket lama — tidak diusulkan lagi

| Temuan | Tiket lama | Keterangan |
|---|---|---|
| Live-state + presence nol/stale setelah restart (Dashboard 0,0%, device OFFLINE, `lastTelemetryAt` 15:54 WIB, `/health` metrics 0) | **N-42 (FAT-212, backend, High)** | AUDIT §33.2; probe E2E mengonfirmasi (live-state semua 0 vs shift-summary OEE 92,8 dan history `totalCount: 199`). Jangan duplikasi. |
| Agregat all-null ditampilkan 0% / Parts Total 0 | **N-43 (FAT-213, panel, Low)** | AUDIT §33.3; aturan E20 "semua null → 0" (`mean1`, `http/monitoring.ts`) perlu diubah jadi '—'. Jangan duplikasi. |
| Produk tanpa `sku`/`isActive` (panel fallback `sku` ← `productId`, `active` ← `true`) | **N-5 (FAT-172, Todo, Low)** | Dikonfirmasi spec + probe E2E (5 produk tanpa kedua field). Jangan duplikasi. |
| Telemetry aggregate: delta vs count — `total_parts` selalu 0 | **N-11 (E23, Done, High)** | Probe E2E mengonfirmasi semua delta null → mapper total 0; sudah diperbaiki panel. |
| OEE shift-summary: counts + nama tak ada — parts selalu 0 | **N-27 (E23, Done, Medium)** | Probe E2E mengonfirmasi respons tanpa counts/`hourly[]`; sudah diperbaiki panel (total diturunkan dari hourly bila ada). |
| Perilaku 404 vs `[]` untuk device tak dikenal tidak konsisten | **N-41 (FAT-210, Todo, Low)** | Probe E2E konsisten dengan pola ini (aggregate/`downtime` → `[]`; history/hourly → 404). Jangan duplikasi. |
| Halaman login tanpa indikator koneksi backend | **N-38 (FAT-207, Todo parsial, Low)** | Badge mode API + label akses selesai (6d54f97, terkonfirmasi live §33.1); yang tersisa hanya indikator koneksi. Jangan duplikasi. |
| Rute `/telemetry/:device_id/history` → 404 | **Bukan temuan — tanpa tiket** | Path probe yang salah. Registry panel memakai `/api/v1/telemetry/:device_id` tanpa sufiks `/history`; probe tambahan di path benar → 200, data lengkap, cocok dengan `mapTelemetryHistory`. Tidak ada yang perlu diperbaiki di panel maupun backend. |
| `/system/audit` 401; `/health/detail` 403 tunnel | **Bukan temuan** | Sesuai ekspektasi (butuh Bearer token; tunnel menolak health detail). |
| `/health` metrics 0 sejak restart; uptime pendek; restart berulang | **Tercakup N-42 (FAT-212)** | Gejala yang sama (state in-memory nol setelah restart). |

## 6. Yang belum terverifikasi

1. **Endpoint 401-gated (butuh sesi auth):** seluruh halaman Operators, Access Control, MQTT, Lines, Shifts, Shift Schedules, DynSec, Configuration, System Audit (+ ekspor) — bentuk respons live vs mapper panel hanya dibandingkan statis terhadap spec OpenAPI (`API_DOCS_AUDIT.md` §4–§6: 67 OK / 55 MISMATCH / 19 KNOWN). Belum ada yang dikonfirmasi terhadap respons live ber-auth.
2. **Semua mutasi — belum pernah diuji.** 11 mutasi IAM, 14 mutasi DynSec, 5–6 mutasi Devices, mutasi Machines/Operators/Products/Lines/Shifts/Schedules, `RECONCILIATION_REFRESH`, `WORK_ORDERS_RESOLVE`/`CANCEL`, `DOWNTIME_REASON`, `OPERATIONAL_EVENTS_ACK`, `AUTH_CHANGE_PASSWORD`, dan staging/apply/rollback config. Perilaku exact beberapa di antaranya belum terverifikasi (mis. N-8: 400 vs jendela default; N-24: encoding ekspor JSON-string vs CSV mentah).
3. **WS handshake `/ws/telemetry`:** belum teruji — tidak ada bukti koneksi WebSocket live dari panel (hanya `ws_clients: 5` di `/health` saat probe, tanpa kaitan ke sesi panel).
4. **Halaman yang hanya dipetakan statis (19 halaman):** belum pernah dilihat tampil dengan sesi auth — tampilan, data, dan error handling runtime-nya belum terkonfirmasi (termasuk seluruh halaman CRUD, IAM, MQTT, dan System Health).
5. **Data yang tidak dapat dinilai karena kosong:** `DOWNTIME_ACTIVE` (`[]`) dan `QUALITY_REJECTS_GLOBAL` (`[]`) — field mapper (`mapDowntime`, `mapReject`) belum teruji terhadap item nyata.
6. **Data shift/shift-schedule live belum pernah teramati** (401-gated) — N-16/N-17/N-18 bersifat laten sampai data terlihat; bit `eventFlags` N-32 butuh jawaban backend.
7. **Visual lengkap + konsistensi data + FAT-28 (V8.2 Real E2E) tetap In Progress:** login + navigasi baca terbukti (Fase 2); mutasi + konsistensi data + visual lengkap belum terverifikasi.

## 7. Sumber

- `~/workspace/tmp-e2e-static.md` — pemetaan konsumsi endpoint per halaman + verifikasi 16 TRANSPORT_ONLY (19 Nov 2026, repo HEAD `b401434`).
- `~/workspace/tmp-e2e-probe.md` — hasil probe curl 14 endpoint live + `/health/detail` + uptime (~18:13 WIB, 19 Nov 2026).
- `~/workspace/iiot-oee-admin-panel/AUDIT.md` §33 — tes fungsional Fase 2 (18:05–18:07 WIB, 19 Nov 2026).
- `~/workspace/iiot-oee-admin-panel/docs/API_DOCS_AUDIT.md` — audit endpoint vs OpenAPI live, §6 (gap N-6–N-41) dan §8 (TRANSPORT_ONLY/WIRED_UI), sweep probe 138 operasi.
- `~/workspace/iiot-oee-admin-panel/docs/LINEAR.md` — silang status tiket E22/E23/E24 (N-5, N-11, N-27, N-38, N-41, N-42, N-43).
- Verifikasi spot koordinator: `src/services/api/http/mappers/monitoring.ts:229-238` (`mapHourly`), `:296-309` (`mean1`), `:397-414` (perbaikan N-27).

## 8. Catatan pasca-merge (parent, 19 Nov 2026 18:19 WIB)

Dokumen ini ditulis koordinator SEBELUM tes browser E2E 18:12–18:15 WIB
selesai — maka §1/§6 yang menyebut "6 halaman diuji browser" merujuk
tes Fase 2 (AUDIT §33), bukan E2E ini. Hasil gabungan yang berlaku:
**browser E2E mengunjungi 18 halaman** (Dashboard, Devices, Machines,
Products, Operators, Work Orders, Downtime, System Audit, Telemetry,
Analytics, MQTT Overview/Security/Configuration, Lines, Shifts,
Shift Schedules, Access Control, System Health) — lihat AUDIT.md §34.

Koreksi/penegasan dari verifikasi parent:
- Klaim §4 (WIRED_UI 121 → 126) **terverifikasi**: `MQTT_CONFIG_VERSION_GET`
  dipanggil internal `applyBrokerConfigVersion` (`http/mqttConfig.ts:285`)
  yang dipakai UI (`useBrokerConfig.ts:182,186`); 4 koreksi lain diterima
  dari bukti file+baris di `tmp-e2e-static.md`.
- Klaim §5.1 E2E-01–E2E-04 **terverifikasi dari kode**: `catch {}` di
  `OverviewPage.tsx:56` dan `LiveStatePage.tsx:33`; `setItems([])` di
  `QualityRejectsPage.tsx:37`; `SystemHealthPage.tsx` tanpa banner untuk
  gagal HEALTH; `mapHourly` `parts_produced = num(totalCount, 0)`.
- Tiket dibuat di Linear sebagai E25 (FAT-214) + E2E-01–E2E-11
  (FAT-215–FAT-225). Empat temuan browser tambahan ikut bertiket:
  E2E-08 (ENOENT config MQTT, backend), E2E-09 (atribusi audit + JSON
  mentah, backend), E2E-10 (kerapian list), E2E-11 (timeline Analytics).
- Bukan temuan (verifikasi parent): kolom Shifts SIANG/Siang/SIANG adalah
  tiga field berbeda dari seed backend; "last seen 18:05" di Fase 2
  adalah stempel updated halaman (E2E ini menampilkan "Belum ada data").
