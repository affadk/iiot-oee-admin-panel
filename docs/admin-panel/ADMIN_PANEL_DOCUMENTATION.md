# Dokumentasi Kontrak Admin Panel — IIoT OEE (Terkoreksi — Spec 025)

**Status:** AUTHORITATIVE CONTRACT ALIGNMENT (`025-admin-panel-contract-alignment`)
**Scope:** Admin Panel Frontend (`/login`, `/admin/*`) & Kontrak Integrasi Backend (`API v1`)
**Catatan Referensi:** Dokumen desain awal `/ADMIN_PANEL_DESIGN_SPEC.md` tetap dipertahankan utuh sebagai arsip desain historis. Dokumen ini adalah kontrak terkoreksi yang wajib diikuti oleh `apiClient`, tipe TypeScript, halaman Admin Panel, dan pengujian kontrak.

> **Pembaruan 19 Nov 2026 (E20 + E21):** dokumen ini disinkronkan ulang terhadap
> api_docs terupdate (`~/workspace/user/files/pasted-text.txt`, 2100 baris) —
> diff lengkap `docs/API_SYNC_DIFF.md` (294 entri), tinjau-ulang
> `docs/API_SYNC_REVIEW.md` (R-1–R-23), penutupan gap
> `docs/BACKEND_SYNC_CLOSURE.md`, dan `AUDIT.md` §23–§25. Panel: registry
> 132 → **137 kunci**, tests **368/368**, `tsc` 0. Perubahan di bawah ini
> (a)–(i): (a) status WO kini `PENDING/ACTIVE/PENDING_CLOSE/COMPLETED/ABORTED`
> (§C.6 api_docs); (b) `/system/audit` adalah alias feed operasional — BUKAN
> `/access-control/audit` (itu audit IAM terpisah); (c) ada `GET
> /operational-events` global (tanpa `machine_id`); (d) mode AUTHZ hanya
> `shadow`/`enforce`, tanpa `"partial"` (0 hit di api_docs); (e) role operator
> = string bebas (default `UNASSIGNED`); (f) provisioning kanonis `POST
> /devices/provision` (bukan `/clients/provision`); (g) gerbang
> `mustChangePassword` → `403 PASSWORD_ROTATION_REQUIRED` + halaman
> `/force-change-password`; (h) `GET /devices/:id/health` +
> `GET /health/detail`; (i) klaim yang E20 buktikan salah dihapus — dispatch/
> complete/validate-zone/initiate adalah HMI-only (panel tidak mengeksposnya),
> `POST /permissions` DIDUKUNG (bukan katalog read-only), hanya `ADMIN` yang
> immutable (bukan 4 preset), wildcard `*` diizinkan di policy, kode stale
> adalah `401 AUTHZ_STALE` (bukan `AUTHZ_VERSION_STALE`), status klien dynsec
> via `PATCH /clients/{name}/enable` (bukan `.../status`), tidak ada ekspor
> downtime global, field device-health adalah `heapFree/tasksHealthy/...`
> (bukan 7 field lama), dan apply/rollback config async 202 + polling.
> **Caveat:** salinan `pasted-text.txt` di disk adalah upload asli 07:47 WIB —
> amandemen 09:23 (otorisasi `authorize(...)`, `GET /system/access-mode`)
> TIDAK ada di file; penutupan definitif butir amandemen menunggu salinan
> api_docs baru (R-23).
>
> **Pembaruan 19 Nov 2026 (E26 — uji mutasi E2E live):** panel diuji
> langsung terhadap API live (`oee.fadik.web.id`) dari Vercel dalam dua
> sesi browser (18:58–19:34 WIB, login ADM-001): **35 mutasi lolos,
> 1 guard probe gagal sesuai harapan, 1 kegagalan persisten, 0× 403,
> cleanup bersih, SISA kosong.** Temuan MUT-01–MUT-04 (Linear E26
> FAT-226) dan status per mutasi ada di **§6**; rincian per langkah di
> `docs/E2E_MUTATION_TEST.md`, ringkasan di `AUDIT.md` §35. Koreksi
> perilaku live dari uji ini juga dicatat seperlunya di §2, §3.2, §3.4,
> §3.6, dan §3.7.

---

## 1. Ringkasan Penyelarasan Kontrak

1. **Label Runtime Backend:** Seluruh UI menggunakan label **`API v1`** (bukan versi Fastify dan tidak menampilkan field `fastify_version`).
2. **Konvensi Prefix Endpoint:** Seluruh endpoint REST Admin Panel wajib menggunakan prefix **`/api/v1/...`**, kecuali **`GET /health`** dan **`GET /ws/telemetry`**.
3. **Status Work Order Kanonik:** Nilai status Work Order hanya **`PENDING`**, **`ACTIVE`**, **`PENDING_CLOSE`**, **`COMPLETED`**, **`ABORTED`** (menggantikan label lama `DISPATCHED`, `IN_PROGRESS`, `CANCELLED`). `PENDING_CLOSE` adalah status transisi resmi saat telemetri `BATCH_FINISHED` pertama diterima; konfirmasi operator/`complete` tetap wajib untuk menutup ke `COMPLETED` (§C api_docs). Cancel berlaku dari `PENDING`/`ACTIVE`/`PENDING_CLOSE` → `ABORTED` (ADMIN LAN only). Dispatch dan complete adalah aksi **HMI lantai produksi** — panel tidak mengeksposnya (lihat §3.3).
4. **Penggantian Endpoint yang Tidak Tersedia:**
   - `/mqtt/overview` $\rightarrow$ dikomposisikan dari `GET /api/v1/mqtt/dynamic-security/status` + `GET /api/v1/mqtt/configuration/status` (+ `/clients` untuk jumlah klien).
   - `/system/audit` $\rightarrow$ **`GET /api/v1/system/audit`** — alias audit trail global (feed **operasional** saja, `OperationalEventItem[]`; §I api_docs). Mutasi IAM dibaca dari `GET /api/v1/access-control/audit` yang terpisah (otoritas tunggal, tanpa union view). **Koreksi E20:** dokumen ini sebelumnya menulis `/system/audit` → `/access-control/audit` — itu salah.
   - `/operational-events` (global) $\rightarrow$ **`GET /api/v1/operational-events`** (ada di api_docs §I: `from, to, event_type, acknowledged, limit, cursor, envelope` — **tanpa** `machine_id`; `machine_id` hanya di `/system/audit`). Panel memakai list global bila scope "Semua Perangkat", dan `GET /api/v1/operational-events/:deviceId` bila satu perangkat dipilih. **Koreksi E20:** dokumen ini sebelumnya menulis tidak ada endpoint global dan panel selalu agregasi per-device — itu salah.
   - `/quality/rejects` (global) $\rightarrow$ `GET /api/v1/quality/rejects/:device_id`.
   - `/oee/hourly` $\rightarrow$ `GET /api/v1/telemetry/:device_id/hourly`.
   - `/access-control/info` $\rightarrow$ mengekspos metadata mode (`enforce` / `shadow`) dan `authzVersion` melalui `GET /api/v1/access-control/info` (serta `/api/v1/auth/me` untuk proyeksi capability sesi aktif). **Koreksi E20:** mode hanya `shadow`/`enforce` (+ flip per-domain via `AUTHZ_ENFORCE_DOMAINS`) — **tidak ada mode `"partial"`** (0 hit di api_docs).
   - `/mqtt/configuration/versions` $\rightarrow$ `GET /api/v1/mqtt/configuration/configurations`.
5. **Penghapusan Field Tanpa Dukungan Backend (No Synthetic Data):**
   - **Machine:** tidak menampilkan `line` atau `status`.
   - **Product:** tidak menampilkan `category`, `description`, atau `active_orders_count`.
   - **Operator:** tidak menampilkan `employee_code`, `email`, atau `department`; menggunakan `operator_id` (`ADM-001` sebagai root admin terproteksi) dan opsional `shift_preference`.
   - **Device Health:** hanya menampilkan field payload `GET /api/v1/devices/:deviceId/health` (§E api_docs): `deviceId`, `timestamp`, `heapFree`, `tasksHealthy`, `tasksTotal`, `staleCount`, `staleTasks[]`, `eventFlags`, `ageSec` — serta menangani *cache miss* (`ageSec >= 999999`, field nol) secara eksplisit; tidak menampilkan `wifi_rssi`, `uptime_sec`, atau `free_heap_bytes`. **Koreksi E20:** daftar 7 field lama (`last_seen_at`, `cache_age_sec`, `telemetry_rate_hz`, `mqtt_connected`, `buffer_depth`, `firmware_version`, `ip_address`) tidak ada di kontrak ini.
   - **System Health:** tidak menampilkan `fastify_version`, `pool_active`, `pool_max`, atau `records_per_second`.
   - **Broker Overview & Config:** tidak menampilkan `uptime_seconds` atau throughput `msg/s` yang tidak tersedia.
   - **Unbound Machine & Empty Quality Rejects:** mesin tanpa `bound_device_id` (mis. `mach-grind-05`) menampilkan status kosong jujur; perangkat tanpa data reject menampilkan `"Tidak ada reject pada periode ini"`.

---

## 2. Aktor & Perimeter Jaringan

| Aktor | Perimeter | Hak Akses UI |
|---|---|---|
| `ADMIN` | LAN Pabrik | Akses penuh semua modul, termasuk IAM & MQTT Dynamic Security |
| `SUPERVISOR` | LAN Pabrik | Monitoring, Analitik, Work Order, Operator roster/rotasi password, Refresh Rekonsiliasi, baca Konfigurasi Broker |
| `OPERATOR` | LAN Pabrik | Baca Overview/Live State/Downtime/Telemetri, Ack Operational Event, Label Downtime |
| `MAINTENANCE` | LAN Pabrik | Baca status perangkat/kesehatan, downtime, telemetri, operational events |
| Remote Viewer (Semua Role) | Ingress Tunnel (`:8080` / Remote) | **Mode Observasi (Read-Only):** seluruh mutasi dinonaktifkan di UI, menu IAM disembunyikan |

> **Catatan role (E20, §H api_docs):** `role` operator adalah **string bebas**,
> bukan enum — default `UNASSIGNED`; hanya `ADMIN` yang dibatasi untuk akun
> root `ADM-001`. Daftar role otoritatif ada di `GET /access-control/roles`.
> Tabel di atas memakai 4 label kanonis (`ADMIN`/`SUPERVISOR`/`OPERATOR`/
> `MAINTENANCE`) sebagai peran tipikal, bukan sebagai enum tertutup.
> **Dispatch & Complete Work Order adalah aksi HMI lantai produksi** — panel
> tidak mengekspos `POST /work-orders/:wo_id/dispatch` dan `.../complete`
> (keduanya ada di pola terlarang `FORBIDDEN_ENDPOINT_PATTERNS`); panel hanya
> menampilkan status WO dan menyediakan **Cancel** (ADMIN LAN only).
>
> **Temuan live 19 Nov 2026 — mode akses (E26, A10.2 FAT-40):** selama uji
> mutasi E2E, seluruh 35 mutasi dieksekusi dari Vercel (ingress tunnel,
> bukan LAN pabrik) dengan badge panel "Mode Akses: Private" — dan
> **tidak satu pun mengembalikan 403**, baik 403 klien
> (`assertLanForMutation`) maupun 403 gerbang tunnel server. Ini adalah
> **bukti empiris, bukan vonis**: uji ini tidak membuktikan penegakan
> server-side mode akses (A10.2 / FAT-40) selesai, dan juga tidak
> membuktikan ia gagal — penegakan server tidak diuji secara khusus
> (tidak ada probe negatif dari tunnel terhadap endpoint yang seharusnya
> ditolak, dan tidak ada pembanding dari LAN pabrik). Jangan jadikan
> hasil uji ini vonis atas A10.2 ke arah mana pun; lihat §6.1.

---

## 3. Matriks Endpoint Backend Admin Panel (`ADMIN_ENDPOINTS`)

Seluruh endpoint berikut didefinisikan di `src/services/api/endpoints.ts` dan dipanggil oleh `src/services/api/client.ts`.

### 3.1 Health, WebSocket, & Auth
| Key | Method | Path | Halaman / Penggunaan |
|---|---|---|---|
| `HEALTH` | `GET` | `/health` | Overview, System Health |
| `HEALTH_DETAIL` | `GET` | `/health/detail` | System Health (detail infrastruktur per komponen + `measuredAt`; **ADMIN + LAN**, grant `read` pada `access_control`; §A api_docs) |
| `SYSTEM_ACCESS_MODE` | `GET` | `/api/v1/system/access-mode` | Topbar/banner read-only vs read-write (200 `{mode, channel, mutations_allowed}`; JWT wajib; **amandemen api_docs 09:23 — belum terverifikasi di salinan file, R-23**) |
| `WS_TELEMETRY` | `WS` | `/ws/telemetry` | Live State, stream telemetri |
| `AUTH_LOGIN` | `POST` | `/api/v1/auth/login` | Login Page (`AuthContext`) |
| `AUTH_REFRESH` | `POST` | `/api/v1/auth/refresh` | `apiClient` session refresh (mengembalikan `authzVersion`; 401 `AUTHZ_STALE` → login ulang) |
| `AUTH_ME` | `GET` | `/api/v1/auth/me` | Proyeksi capability sesi aktif (`operator.isActive/isProtected/mustChangePassword`, `authz.*`, `access.*`) |
| `AUTH_PASSWORD_CHANGE` | `POST` | `/api/v1/auth/password/change` | Ganti password (`{current_password, new_password}` min-8; gerbang `mustChangePassword` — lihat §3.1a) |

#### 3.1a Gerbang ganti-password-wajib (spec 043, §L api_docs)

Selama flag `mustChangePassword` aktif (flag dari respons login 200 / `GET /auth/me`), setiap rute terproteksi selain `GET /auth/me` dan `POST /auth/password/change` dibalas **`403 {error: "PASSWORD_ROTATION_REQUIRED"}`**. Panel mengarahkan ke halaman **`/force-change-password`** — satu-satunya jalan keluar selama gerbang aktif (tanpa jalur kedua; keluar hanya lewat ganti password sukses atau logout). Tidak ada `401 PASSWORD_CHANGE_REQUIRED` di api_docs (0 hit — C15). Throttle login hanya server: 5/60s + `Retry-After`; **panel TIDAK menerapkan lockout paralel**.

### 3.2 Aset: Edge Devices & Machines
| Key | Method | Path | Halaman / Penggunaan |
|---|---|---|---|
| `DEVICES_LIST` | `GET` | `/api/v1/devices` | Overview, Devices, Machines, Operational Events, Telemetry, Quality |
| `DEVICES_GET` | `GET` | `/api/v1/devices/:id` | Detail Device |
| `DEVICES_CREATE` | `POST` | `/api/v1/devices` | Devices (registrasi manual **legacy** — dipertahankan untuk masa transisi, berlabel legacy di UI; gunakan Provision untuk alur lengkap; **terverifikasi live 19 Nov 2026 (L4): badge baris hasil register legacy adalah `PROVISIONED`, bukan `ACTIVE`** — observasi, bukan tiket) |
| `DEVICES_PROVISION` | `POST` | `/api/v1/devices/provision` | Devices — **jalur kanonis** (spec 015, ADR-009): satu aksi membuat identitas broker + baris registry; body `{deviceId, machineId?, model?}`; password 32 char dibuat backend, kredensial sekali tampil `{credential: {username, password, clientId, topicPrefix}}` |
| `DEVICES_REVOKE` | `POST` | `/api/v1/devices/:deviceId/revoke` | Devices (body `{reason}` 1..200 wajib; 409 `DEVICE_ALREADY_REVOKED`) |
| `DEVICES_CREDENTIALS` | `POST` | `/api/v1/devices/:deviceId/credentials` | Devices — rotasi kredensial (body `{force, reason}`; guard produksi 409 `DEVICE_IN_PRODUCTION` bila WO aktif tanpa `force: true`) |
| `DEVICES_UPDATE` | `PUT` | `/api/v1/devices/:id` | Devices |
| `DEVICES_DELETE` | `DELETE` | `/api/v1/devices/:id` | Devices |
| `DEVICES_HEALTH` | `GET` | `/api/v1/devices/:id/health` | `DeviceHealthDrawer` |
| `MACHINES_LIST` | `GET` | `/api/v1/machines` | Overview, Machines, Work Orders, OEE Analytics |
| `MACHINES_GET` | `GET` | `/api/v1/machines/:id` | Detail Machine |
| `MACHINES_CREATE` | `POST` | `/api/v1/machines` | Machines |
| `MACHINES_UPDATE` | `PUT` | `/api/v1/machines/:id` | Machines |
| `MACHINES_DELETE` | `DELETE` | `/api/v1/machines/:id` | Machines |
| `MACHINES_BIND` | `POST` | `/api/v1/machines/:id/bind` | Machines |
| `MACHINES_UNBIND` | `POST` | `/api/v1/machines/:id/unbind` | Machines |

### 3.3 Master Produksi & Work Orders
| Key | Method | Path | Halaman / Penggunaan |
|---|---|---|---|
| `PRODUCTS_LIST` | `GET` | `/api/v1/products` | Products, Work Order Wizard |
| `PRODUCTS_CREATE` | `POST` | `/api/v1/products` | Products |
| `PRODUCTS_UPDATE` | `PUT` | `/api/v1/products/:id` | Products |
| `PRODUCTS_DELETE` | `DELETE` | `/api/v1/products/:id` | Products |
| `OPERATORS_LIST` | `GET` | `/api/v1/operators` | Operators, Work Order Wizard, Access Control |
| `OPERATORS_CREATE` | `POST` | `/api/v1/operators` | Operators |
| `OPERATORS_UPDATE` | `PUT` | `/api/v1/operators/:id` | Operators |
| `OPERATORS_DELETE` | `DELETE` | `/api/v1/operators/:id` | Operators |
| `OPERATORS_PASSWORD` | `PATCH` | `/api/v1/operators/:id/password` | Operators |
| `OPERATORS_STATUS` | `PATCH` | `/api/v1/operators/:id/status` | Operators |
| `WORK_ORDERS_LIST` | `GET` | `/api/v1/work-orders` | Overview, Work Orders |
| `WORK_ORDERS_GET` | `GET` | `/api/v1/work-orders/:wo_id` | Detail Work Order |
| `WORK_ORDERS_RESOLVE` | `GET` | `/api/v1/work-orders/:wo_id/resolve` | Resolusi konteks 4-Zone Work Order (`device_id` **wajib** menurut dokumen §C.3) |
| `WORK_ORDERS_CANCEL` | `POST` | `/api/v1/work-orders/:wo_id/cancel` | Work Orders (`PENDING`/`ACTIVE`/`PENDING_CLOSE` $\rightarrow$ `ABORTED`; **ADMIN LAN only**; body `{reason?}` max 500) |

> **HMI-only — TIDAK diekspos panel:** `POST /api/v1/work-orders/validate-zone`,
> `POST /api/v1/work-orders/initiate-from-zones`, `POST /api/v1/work-orders/:wo_id/dispatch`,
> `POST /api/v1/work-orders/:wo_id/complete` (dan `POST /api/v1/devices/:device_id/command`).
> Keempat rute WO itu ada di api_docs (§C) tetapi milik HMI lantai produksi;
> panel memblokirnya di `FORBIDDEN_ENDPOINT_PATTERNS` (`src/services/api/endpoints.ts`).
> Wizard 4-Zone di panel hanya memvalidasi dan menampilkan; pembuatan + dispatch WO
> dilakukan di HMI. **Koreksi E20:** baris `WORK_ORDERS_VALIDATE_ZONE`,
> `WORK_ORDERS_INITIATE`, `WORK_ORDERS_DISPATCH`, `WORK_ORDERS_COMPLETE` dihapus
> dari tabel ini.

### 3.4 Monitoring: Live State, Downtime, & Operational Events
| Key | Method | Path | Halaman / Penggunaan |
|---|---|---|---|
| `LIVE_STATE` | `GET` | `/api/v1/live-state` | Live State |
| `DOWNTIME_ACTIVE` | `GET` | `/api/v1/downtime-events/active` | Overview, Downtime Events |
| `DOWNTIME_BY_DEVICE` | `GET` | `/api/v1/downtime-events/:device_id` | Downtime Events (filter per device) |
| `DOWNTIME_HISTORY` | `GET` | `/api/v1/downtime` | Downtime Events (historis + cursor pagination) |
| `DOWNTIME_DEVICE_EXPORT` | `GET` | `/api/v1/downtime-events/:device_id/export` | Ekspor CSV/JSON downtime per perangkat |
| `DOWNTIME_REASON` | `POST` | `/api/v1/downtime-events/:id/reason` | `DowntimeReasonModal` |
| `OPERATIONAL_EVENTS_LIST` | `GET` | `/api/v1/operational-events` | Operational Events (list **global**; query `from, to, event_type, acknowledged, limit, cursor, envelope` — tanpa `machine_id`; §I api_docs) |
| `OPERATIONAL_EVENTS_BY_DEVICE` | `GET` | `/api/v1/operational-events/:deviceId` | Overview, Operational Events (per perangkat) |
| `OPERATIONAL_EVENTS_EXPORT` | `GET` | `/api/v1/operational-events/export` | Ekspor CSV/NDJSON/JSON operational events global (query hanya `from, to, format, limit`; retensi 90 hari; guard policy `refresh:telemetry`, SUPERVISOR/ADMIN LAN) |
| `OPERATIONAL_EVENTS_DEVICE_EXPORT` | `GET` | `/api/v1/operational-events/:deviceId/export` | Ekspor CSV/JSON operational events per device |
| `OPERATIONAL_EVENTS_ACK` | `PATCH` | `/api/v1/operational-events/:id/ack` | Operational Events (body hanya `{note?}` max 1000; aktor dari JWT) |
| `SYSTEM_AUDIT` | `GET` | `/api/v1/system/audit` | Audit Trail — **alias feed operasional** (`OperationalEventItem[]`; query `from, to, event_type, machine_id, limit 1..200, cursor, envelope`; enum `event_type` tertutup **32 nilai** + pola) |
| `SYSTEM_AUDIT_EXPORT` | `GET` | `/api/v1/system/audit/export` | Audit Trail — ekspor CSV/NDJSON/JSON (filter sama dengan list; retensi 90 hari → 400 `RETENTION_EXCEEDED`; rate limit 5/menit; guard `authorize("read","access_control")`) |

> **Koreksi E20 (§3.4):** tidak ada ekspor downtime global (`GET /api/v1/downtime/export`
> tidak ada di api_docs — hanya ekspor per perangkat); tidak ada field `severity` di
> `OperationalEventItem` (FR-034-01) dan filter `severity` tidak didukung (param tak
> dikenal diabaikan dengan 200); `acknowledged` adalah turunan dari `acknowledgedAt`;
> `machineName` bernilai `null` bila mesin sudah dihapus.
>
> **Temuan live 19 Nov 2026 — overwrite label downtime (MUT-04, FAT-230,
> panel Low):** `POST /api/v1/downtime-events/:id/reason` sendiri bekerja
> (L43(a) OK), tetapi modal overwrite **tidak punya opsi "Belum
> dikategorikan" dan selalu memberi prefix kategori** pada alasan, sehingga
> teks asli persis tidak bisa dikembalikan. Cleanup C1: alasan event
> 13:55:34 yang semula "Equipment failure" kini menjadi
> "[EQUIPMENT_FAILURE] Equipment failure" (kolom kategori tetap "Belum
> dikategorikan" seperti semula) — residu yang diterima, bukan data uji
> sisa; lihat §6.2.

### 3.5 Telemetri, OEE, Kualitas, & Rekonsiliasi
| Key | Method | Path | Halaman / Penggunaan |
|---|---|---|---|
| `TELEMETRY_HISTORY` | `GET` | `/api/v1/telemetry/:device_id/history` | Telemetry History (cursor pagination) |
| `TELEMETRY_HOURLY` | `GET` | `/api/v1/telemetry/:device_id/hourly` | OEE Analytics (tren per jam) |
| `TELEMETRY_AGGREGATE` | `GET` | `/api/v1/telemetry/:device_id/aggregate` | Telemetry History (summary KPI) |
| `TELEMETRY_EXPORT` | `GET` | `/api/v1/telemetry/:device_id/export` | Telemetry History (CSV/JSON export) |
| `RECONCILIATION_JOBS` | `GET` | `/api/v1/telemetry/reconciliation/jobs` | Data Reconciliation |
| `RECONCILIATION_REFRESH` | `POST` | `/api/v1/telemetry/reconciliation/refresh` | Data Reconciliation |
| `OEE_SHIFT_SUMMARY` | `GET` | `/api/v1/oee/shift-summary` | OEE Analytics |
| `OEE_SHIFT_TIMELINE` | `GET` | `/api/v1/oee/shift-timeline` | OEE Analytics |
| `QUALITY_REJECTS_BY_DEVICE` | `GET` | `/api/v1/quality/rejects/:device_id` | Quality & Rejects |

### 3.6 Access Control (IAM) & Audit (18 Rute Otoritatif)
| Key | Method | Path | Halaman / Penggunaan |
|---|---|---|---|
| `IAM_INFO` | `GET` | `/api/v1/access-control/info` | Access Control (mode ABAC & `authzVersion`) |
| `IAM_ROLES_LIST` | `GET` | `/api/v1/access-control/roles` | Access Control, Operators |
| `IAM_ROLES_CREATE` | `POST` | `/api/v1/access-control/roles` | Access Control (custom role — **tanpa hierarki level**; `privilege_level` tidak dikembalikan backend) |
| `IAM_ROLES_UPDATE` | `PUT` | `/api/v1/access-control/roles/:id` | Access Control (hanya `ADMIN` immutable — `403 ROLE_IMMUTABLE`; preset lain dapat diubah bila tidak dipakai) |
| `IAM_ROLES_DELETE` | `DELETE` | `/api/v1/access-control/roles/:id` | Access Control (ADMIN → `403 ROLE_IMMUTABLE`; ter-assign → `409 ROLE_IN_USE` menyebut `operatorId`; punya policy → `409 ROLE_IN_USE`) |
| `IAM_ROLE_PERMISSIONS_ADD` | `POST` | `/api/v1/access-control/roles/:id/permissions` | Access Control (tolak reserved permission & duplikat) |
| `IAM_ROLE_PERMISSIONS_DELETE` | `DELETE` | `/api/v1/access-control/roles/:id/permissions/:permissionId` | Access Control (cabut permission role; proteksi `ADMIN`) |
| `IAM_PERMISSIONS_LIST` | `GET` | `/api/v1/access-control/permissions` | Access Control (Permission Catalog) |
| `IAM_PERMISSIONS_CREATE` | `POST` | `/api/v1/access-control/permissions` | Access Control (**DIDUKUNG** — body `{action, resourceType}` camelCase; tanpa rute penjaga → `400 INERT_PERMISSION`; duplikat → `409 PERMISSION_EXISTS`) |
| `IAM_USER_ROLES_LIST` | `GET` | `/api/v1/access-control/user-roles` | Access Control, Operators |
| `IAM_USER_ROLES_CREATE` | `POST` | `/api/v1/access-control/user-roles` | Access Control, Operators (multi-role & scope assignment) |
| `IAM_USER_ROLES_DELETE` | `DELETE` | `/api/v1/access-control/user-roles` | Access Control, Operators (proteksi `ADM-001` `ADMIN`; tanpa baris cocok → `200 {success: true, removed: 0}`, idempoten) |
| `IAM_POLICIES_LIST` | `GET` | `/api/v1/access-control/policies` | Access Control |
| `IAM_POLICIES_CREATE` | `POST` | `/api/v1/access-control/policies` | Access Control (anti-lockout `ADMIN` & anti-escalation; body tulis **camelCase** `{roleId, permissionId, resourcePattern, effect, abacCondition}`; **tanpa field `reason`** di baris policy — `reason` hanya disimpan di audit IAM; **`abacCondition` adalah optional record — DI-OMIT saat kosong, JANGAN dikirim `null`** — panel mengirim `null` dan server menolak, lihat MUT-03 di bawah dan §6.2) |
| `IAM_POLICIES_UPDATE` | `PUT` | `/api/v1/access-control/policies/:id` | Access Control (update/toggle policy; camelCase saja) |
| `IAM_POLICIES_DELETE` | `DELETE` | `/api/v1/access-control/policies/:id` | Access Control (blokir hapus policy `ADMIN`) |
| `IAM_SUBJECT_EFFECTIVE_PERMISSIONS` | `GET` | `/api/v1/access-control/subjects/:operatorId/effective-permissions` | Access Control (Subject Inspector; field role satu-satunya bernama **`roles`** — tanpa alias `effectiveRoles`) |
| `IAM_AUDIT` | `GET` | `/api/v1/access-control/audit` | Access Control, Audit Trail (**audit keputusan otorisasi IAM** — terpisah dari `/system/audit`; filter `subject/decision/mode/from/to`) |

**Aturan Keamanan IAM Terverifikasi:**
- **Permission Catalog:** `POST /api/v1/access-control/permissions` **didukung** (§3.4 api_docs) dengan guard rute penjaga (`400 INERT_PERMISSION`) dan duplikat (`409 PERMISSION_EXISTS`). **Koreksi E20:** klaim lama "katalog read-only, `403 PERMISSION_CATALOG_READ_ONLY`" salah — kode itu tidak ada di api_docs.
- **Proteksi Role & Konflik Relasi:** **Hanya `ADMIN` yang immutable** (`403 ROLE_IMMUTABLE`); `SUPERVISOR`, `OPERATOR`, `MAINTENANCE` adalah preset opsional — dapat diubah atau dihapus bila tidak dipakai (FR-RL-002). Custom role yang masih memiliki penugasan operator mengembalikan `409 ROLE_IN_USE` saat dihapus. **Koreksi E20:** klaim lama "4 role sistem dikunci dari `PUT`/`DELETE` (`403 SYSTEM_ROLE_PROTECTED`)" salah — kode itu tidak ada di api_docs.
- **Anti-Lockout & Reserved Permissions:** Reserved hanya `subject_match = operator:ADM-001` (selain itu `403 RESERVED_PERMISSION`). Policy `DENY` atau penonaktifan pada `ADMIN` ditolak. **Wildcard `*` di `resourcePattern` DIIZINKAN** (contoh kanonis §3.4 api_docs memakainya untuk role custom) — **koreksi E20:** klaim lama "wildcard `*` ditolak (`403 PRIVILEGE_ESCALATION_DENIED`)" salah; aturan karangan panel itu sudah dihapus.
- **Body tulis camelCase:** tidak ada alias snake_case (`role_id`, `permission_id`, `resource_pattern`, `abac_condition`, `is_active`, `eft`); field asing diabaikan; field wajib hilang/salah tipe → `400 INVALID_POLICY`. `privilege_level` dan `policy_count` **TIDAK** dikembalikan backend — jangan diisi nilai default.
- **Capability terpisah:** `access_control.read` dan `access_control.manage` adalah dua kunci terpisah; semua GET IAM = `read`, semua mutasi = `manage`.
- **Stale Token Invalidation:** Setiap mutasi role/permission/assignment menaikkan `authzVersion` sehingga token sesi lama otomatis ditolak dengan **`401 AUTHZ_STALE`** (subjek nonaktif → `401 SUBJECT_INACTIVE` di `/auth/me`). **Koreksi E20:** kode `AUTHZ_VERSION_STALE` tidak ada di api_docs.
- **ABAC kosong = omit, bukan `null` (MUT-03, FAT-229, panel Medium — temuan live 19 Nov 2026):** skema server untuk kedua jalur create (`POST /policies` dan `POST /roles/{id}/permissions`) mendefinisikan `abacCondition` sebagai **optional record, bukan nullable** — panel wajib meng-omit field saat kosong. Panel mengirim `"abacCondition": null` eksplisit dan server menolak (`"Invalid policy: abacCondition Invalid input: expected record, received null"` — L18; `"body/abacCondition ... received null"` — L21); diulang dengan JSON ABAC `{"attr": "subject.line_id", "eq": "LINE-01"}` → berhasil. Rantai null: `parseAbacCondition` mengembalikan `value: null` untuk teks kosong (`iamValidation.ts:10-11`), diteruskan `createPolicy`/`handleBindPermission`, lalu `createIamPolicy`/`addIamRolePermission` menyertakan kunci karena `null !== undefined` (`iam.ts:248-266, 124/135`), dan `JSON.stringify` mempertahankan `null`. Perbaikan panel: omit field saat kosong — dan perbaiki asumsi salah di `schemas/dto.ts:235` yang menganggap null sah. Catatan: jalur `PUT /policies/{id}` justru mengizinkan `nullable(record)` — hanya kedua jalur POST create yang salah.
- **Guard terverifikasi live 19 Nov 2026 (bukan temuan):** hapus role saat masih ter-assign → **`409 ROLE_IN_USE`** sesuai harapan (L24: `"Role 'TEST-E2E-ROLE' is still assigned to 'TST-E2E-01' (ROLE_IN_USE)."`; kartu role utuh). Guard pasif `ADMIN` terverifikasi: kartu role `ADMIN` tanpa tombol Edit/Hapus; semua baris policy `ADMIN` Edit/Disable/Delete disabled; Revoke assignment `ADMIN`–`ADM-001` disabled dengan catatan "Anti-Lockout Guard: role ADMIN pada akun dilindungi tidak dapat dicabut."; di modal Add Policy dengan Role = `ADMIN`, opsi `DENY` ("Diblokir untuk ADMIN") disabled.

### 3.7 MQTT Dynamic Security & Broker Configuration Manager
| Key | Method | Path | Halaman / Penggunaan |
|---|---|---|---|
| `MQTT_DYNSEC_STATUS` | `GET` | `/api/v1/mqtt/dynamic-security/status` | Broker Overview, Dynamic Security |
| `MQTT_DYNSEC_CLIENTS_LIST` | `GET` | `/api/v1/mqtt/dynamic-security/clients` | Broker Overview, Dynamic Security |
| `MQTT_DYNSEC_CLIENTS_CREATE` | `POST` | `/api/v1/mqtt/dynamic-security/clients` | Dynamic Security |
| `MQTT_DYNSEC_CLIENTS_DELETE` | `DELETE` | `/api/v1/mqtt/dynamic-security/clients/:username` | Dynamic Security |
| `MQTT_DYNSEC_CLIENTS_STATUS` | `PATCH` | `/api/v1/mqtt/dynamic-security/clients/:username/enable` | Dynamic Security (body `{enabled}`; `false` = nonaktifkan/kick) |
| `MQTT_DYNSEC_CLIENTS_PASSWORD` | `PATCH` | `/api/v1/mqtt/dynamic-security/clients/:username/password` | Dynamic Security |
| `MQTT_DYNSEC_ROLES_LIST` | `GET` | `/api/v1/mqtt/dynamic-security/roles` | Dynamic Security |
| `MQTT_DYNSEC_ROLES_CREATE` | `POST` | `/api/v1/mqtt/dynamic-security/roles` | Dynamic Security |
| `MQTT_DYNSEC_ROLES_DELETE` | `DELETE` | `/api/v1/mqtt/dynamic-security/roles/:rolename` | Dynamic Security |
| `MQTT_DYNSEC_GROUPS_LIST` | `GET` | `/api/v1/mqtt/dynamic-security/groups` | Dynamic Security |
| `MQTT_DYNSEC_GROUPS_CREATE` | `POST` | `/api/v1/mqtt/dynamic-security/groups` | Dynamic Security |
| `MQTT_DYNSEC_GROUPS_DELETE` | `DELETE` | `/api/v1/mqtt/dynamic-security/groups/:groupname` | Dynamic Security |

> **Koreksi E20:** baris `MQTT_DYNSEC_PROVISION` (`POST /api/v1/mqtt/dynamic-security/provision`)
> **dihapus** — provisioning kanonis adalah `POST /api/v1/devices/provision`
> (§3.2, spec 015); tidak ada lagi provisioning via dynsec di panel.
>
> **Temuan live 19 Nov 2026 — DynSec (MUT-01 FAT-227 panel Medium;
> MUT-02 FAT-228 backend High):**
> - **MUT-01 — banner network-error palsu + list stale:** mutasi DynSec
>   berulang kali menampilkan banner merah "Koneksi jaringan terputus atau
>   backend tidak terjangkau." padahal mutasi **sukses di server** (L29
>   create role, L30 add ACL, L35 create group, L37 add role ke group —
>   masing-masing terkonfirmasi tercipta setelah load baru; retry
>   melaporkan "already exists"). List tampil stale sampai halaman
>   di-remount via navigasi sidebar; load baru mengungkap keadaan
>   sebenarnya. Pola yang sama tidak terlihat di domain lain pada sesi
>   ini. Dampak: operator bisa mengira mutasi gagal dan mengulanginya
>   (duplikat), atau sebaliknya percaya list stale yang menampilkan
>   keadaan lama.
> - **MUT-02 — create MQTT client selalu "Role not found" (gagal
>   persisten, 5×):** `POST /api/v1/mqtt/dynamic-security/clients`
>   (L31, client `e2e-test-client`) gagal 5× — role `E2E-TEST-ROLE` ×4
>   (termasuk dari halaman yang baru di-remount) dan role `admin` yang
>   sudah ada ×1 — dengan banner merah "Role not found". Client tidak
>   pernah tercipta (DynSec Clients tetap 1). Panel mengirim body sesuai
>   skema server (`roles` sebagai array objek `{rolename, priority: 1}`,
>   `mqttDynsec.ts:62-79`); galat ini adalah galat lookup bisnis, bukan
>   validasi skema. **Caveat:** modal create-client meng-hardcode default
>   `cRoles=['edge_publisher']` (`CreateMqttClientModal.tsx:21`); bila
>   payload memuat `edge_publisher` yang tidak ada di server, satu entri
>   itu saja sudah cukup menjelaskan galatnya — penutupan butuh log body
>   request aktual. Akibatnya **terblokir dan belum teruji**: attach role
>   ke client (L32), rotasi password client (L33), disable/enable client
>   (L34), dan add client ke group (L36).
| `MQTT_CONFIG_GET` | `GET` | `/api/v1/mqtt/configuration` | Broker Configuration Manager |
| `MQTT_CONFIG_RAW` | `GET` | `/api/v1/mqtt/configuration/raw` | Broker Configuration Manager (Review tab) |
| `MQTT_CONFIG_STATUS` | `GET` | `/api/v1/mqtt/configuration/status` | Broker Overview, Broker Configuration Manager |
| `MQTT_CONFIG_STAGE` | `POST` | `/api/v1/mqtt/configuration/configurations` | Broker Configuration Manager |
| `MQTT_CONFIG_LIST` | `GET` | `/api/v1/mqtt/configuration/configurations` | Broker Configuration Manager |
| `MQTT_CONFIG_VERSION_GET` | `GET` | `/api/v1/mqtt/configuration/configurations/:versionId` | Broker Configuration Manager |
| `MQTT_CONFIG_VERSION_DIFF` | `GET` | `/api/v1/mqtt/configuration/configurations/:versionId/diff` | Broker Configuration Manager |
| `MQTT_CONFIG_VERSION_DELETE` | `DELETE` | `/api/v1/mqtt/configuration/configurations/:versionId` | Broker Configuration Manager |
| `MQTT_CONFIG_VERSION_APPLY` | `POST` | `/api/v1/mqtt/configuration/configurations/:versionId/apply` | Broker Configuration Manager (async: harap **202 `{operationId, versionId}`**, body `{confirm: true}`; polling `GET /operations/:operationId` hingga terminal `PENDING`/`RUNNING` → `SUCCEEDED`/`FAILED`) |
| `MQTT_CONFIG_VERSION_ROLLBACK` | `POST` | `/api/v1/mqtt/configuration/configurations/:versionId/rollback` | Broker Configuration Manager (async 202 + polling, sama seperti apply) |
| `MQTT_CONFIG_OPERATIONS` | `GET` | `/api/v1/mqtt/configuration/operations` | Broker Configuration Manager |
| `MQTT_CONFIG_OPERATION_GET` | `GET` | `/api/v1/mqtt/configuration/operations/:operationId` | Broker Configuration Manager |
| `MQTT_CONFIG_BACKUPS` | `GET` | `/api/v1/mqtt/configuration/backups` | Broker Configuration Manager (inventaris metadata saja; **`POST /backups` tidak disediakan — 404**; backup dibuat otomatis saat apply/rollback) |

> **Catatan config (E20/E21):** stage menerima `config` + `baseVersionId?` + `reason`
> atau alias `summary` (`reason` menang bila keduanya ada); error 422 dual
> `issues[]` + `details`; status versi hanya `STAGED`/`ACTIVE`/`ROLLED_BACK`
> (tanpa `APPLIED`); `operation_type` `NO_OPERATION`/`RELOAD`/`RESTART`.
> `acknowledgeUnvalidated` tidak muncul di api_docs sama sekali (R-16).
>
> **Temuan live 19 Nov 2026 — config TIDAK teruji (E2E-08, FAT-222,
> backend High, tiket sudah ada — jangan buat baru):** stage (L38), diff
> (L39), dan discard (L40) config **tidak dapat diuji** — tab "Editor &
> Simpan Draf" kosong di setiap load dan banner merah persisten "Live
> configuration '/mosquitto/config/mosquitto.conf' is not readable:
> ENOENT: no such file or directory, open
> '/mosquitto/config/mosquitto.conf'"; Versions (0), Deployments (0),
> Backups (0). Akar masalah yang sama dengan E2E-08 (FAT-222): file
> `mosquitto.conf` hilang di host API. Tidak ada Apply/Rollback config
> yang diklik selama uji.

---

## 4. State Machine Work Order

```
  [PENDING] ──(dispatch, HMI)──▶ [ACTIVE] ──(telemetri BATCH_FINISHED)──▶ [PENDING_CLOSE]
      │                              │                                        │
      │ (POST .../cancel,            │ (POST .../cancel,                      │ (POST .../cancel,
      │  ADMIN only)                 │  ADMIN only)                          │  ADMIN only)
      ▼                              ▼                                        ▼
  [ABORTED] ◀────────────────── [ABORTED] ◀────────────────────────────── [ABORTED]
      ▲                                                                            │
      │                                     (complete, HMI)                        │
      └──────────────────────────── [COMPLETED] ◀──────────────────────────────────┘
```

- Hanya `PENDING` dan `ACTIVE` yang diperhitungkan dalam deteksi konflik mesin pada 4-Zone Wizard (`validateFourZones`) dan proteksi penghapusan Product.
- Label UI, filter dropdown, dan badge hanya menggunakan lima status kanonis (`PENDING`, `ACTIVE`, `PENDING_CLOSE`, `COMPLETED`, `ABORTED`).
- **Dispatch dan complete adalah aksi HMI lantai produksi** (`POST .../dispatch`, `POST .../complete`); panel tidak mengekspos keduanya — transisi itu tampil di panel hanya sebagai perubahan status yang dibaca dari server. Cancel (`POST .../cancel`, ADMIN LAN only) adalah satu-satunya transisi WO yang diekspos panel, berlaku dari `PENDING`/`ACTIVE`/`PENDING_CLOSE`.

---

## 5. Penanganan Ketidaktersediaan Data & Degradasi Jujur

- **Device Health Cache Miss:** Bila `cache_age_sec >= 999999`, `DeviceHealthDrawer` menampilkan indikator bahwa cache kesehatan perangkat belum tersedia (*Telemetry cache miss*).
- **Unbound Machine:** Bila `machine.bound_device_id === null` (mis. `mach-grind-05`), `OeeAnalyticsPage` tidak meminta `/api/v1/telemetry/:device_id/hourly` dengan ID palsu dan menampilkan pemberitahuan bahwa mesin belum terikat ke Edge Device.
- **Empty Quality Rejects:** Bila `pareto.length === 0`, `QualityRejectsPage` menampilkan `"Tidak ada reject pada periode ini"`.
- **Authz Metadata & Scope:** `AccessControlPage` membaca `GET /api/v1/access-control/info` untuk menampilkan mode evaluasi (`enforce` / `shadow`) serta `authzVersion`. Penugasan non-`ORGANIZATION` (`SITE`, `AREA`, `LINE`, `MACHINE`, `DEVICE`) dicatat sebagai penugasan persiapan (*preparatory*), sedangkan hanya scope `ORGANIZATION` yang aktif memberikan hak akses pada Admin Panel.
- **Operational Events Global:** `OverviewPage` dan `OperationalEventsPage` memakai `GET /api/v1/operational-events` (list global) bila scope "Semua Perangkat", dan `GET /api/v1/operational-events/:deviceId` bila satu perangkat dipilih — **tanpa** agregasi per-device di sisi klien dan **tanpa** kolom/filter `severity`. **Koreksi E20:** klaim lama "agregasi per-device di sisi klien" sudah tidak berlaku.

---

## 6. Status Uji Mutasi E2E Live (19 Nov 2026)

Dua sesi browser berurutan (Bagian A 18:58–19:10 WIB, Bagian B 19:11–19:34 WIB),
login ADM-001, station ADMIN-CONSOLE-01, panel live di Vercel terhadap API live
`oee.fadik.web.id`, mengikuti `docs/E2E_MUTATION_PLAN.md` (45 langkah + 13 cleanup).
Rincian per langkah: `docs/E2E_MUTATION_TEST.md`; ringkasan audit: `AUDIT.md` §35.
Uji baca pendahulu (tanpa mutasi): `docs/E2E_TEST.md` + `AUDIT.md` §34.
Semua temuan sudah tercatat di Linear (E26 FAT-226; MUT-01 FAT-227, MUT-02 FAT-228,
MUT-03 FAT-229, MUT-04 FAT-230) — bagian ini hanya menyelaraskan dokumen kontrak
dengan perilaku live yang terverifikasi.

### 6.1 Ringkasan hasil

| Kategori | Jumlah |
|---|---|
| Mutasi berhasil | 35 |
| Guard probe yang gagal sesuai harapan (L24, `ROLE_IN_USE`) | 1 |
| Kegagalan persisten (L31, MUT-02) | 1 |
| Langkah tidak dapat diuji (L41 panel kesiapan, L43b, L38–L40, L32–L34, L36) | 8 |
| Cleanup berhasil (termasuk C1 dengan residu MUT-04) | 13 |
| 403 (klien maupun server) di seluruh sesi | 0 |
| 429 / cooldown (L44 refresh rekonsiliasi) | 0 |

**Mode akses — bukti empiris, bukan vonis (A10.2 FAT-40):** seluruh mutasi
dieksekusi dari Vercel (ingress tunnel, bukan LAN pabrik) dengan badge panel
"API: Real" + "Mode Akses: Private", dan tidak satu pun mengembalikan 403 —
baik 403 klien (`assertLanForMutation`) maupun 403 gerbang tunnel server.
Sesi login bertahan dan semua mutasi uji lolos dari Vercel pada 19 Nov 2026
malam. Uji ini **tidak membuktikan** penegakan sisi server mode akses (A10.2 /
FAT-40) selesai, dan juga **tidak membuktikan** ia gagal — penegakan server
tidak diuji secara khusus (tidak ada probe negatif dari tunnel terhadap
endpoint yang seharusnya ditolak, dan tidak ada pembanding dari LAN pabrik).
Jangan jadikan hasil ini vonis atas A10.2 ke arah mana pun.

### 6.2 Mutasi terverifikasi live vs belum teruji / terblokir

| Domain / Mutasi | Langkah | Status live 19 Nov 2026 |
|---|---|---|
| Device: provision, register legacy, edit, rotasi kredensial, revoke | L3, L4, L7, L14, L15 | ✅ TERVERIFIKASI (kredensial sekali-tampil disalin sebelum dialog ditutup) |
| Machine: create, bind device | L5, L6 | ✅ TERVERIFIKASI (validasi server menolak Modbus Slave ID 1 duplikat — "already assigned to machine CNC-MILLING-01" — diulang Slave ID 2) |
| Product: create, edit | L8, L9 | ✅ TERVERIFIKASI |
| Operator: create, edit, suspend→activate, rotasi password | L10–L13 | ✅ TERVERIFIKASI (tombol Suspend ADM-001 disabled — "Akun dilindungi (ADM-001)") |
| Work order: cancel | L45 | ✅ TERVERIFIKASI (WO-SIM-20260906-02 PENDING → ABORTED, irreversibel) |
| Operational event: ack | L42 | ✅ TERVERIFIKASI (event 1148, tanpa banner sukses sesuai ekspektasi) |
| Downtime: overwrite label | L43(a) | ✅ TERVERIFIKASI — dengan residu MUT-04 (§6.3) |
| Rekonsiliasi: refresh | L44 | ✅ TERVERIFIKASI (body `{}`, tanpa cooldown/429) |
| IAM: create/update/delete role, create/update/toggle/delete policy, bind/unbind permission, assign/revoke role, inspector effective permission | L16–L23, L25–L28 | ✅ TERVERIFIKASI (authz_version naik #1→#10; L18/L21 percobaan pertama gagal ABAC null — MUT-03; L24 guard probe `409 ROLE_IN_USE` sesuai harapan) |
| DynSec: create role, add ACL, create group, add role ke group | L29, L30, L35, L37 | ✅ TERVERIFIKASI — dengan deviasi MUT-01 (§6.3) dan koreksi topik ACL literal (§6.4) |
| DynSec: create client | L31 | ❌ GAGAL PERSISTEN — MUT-02 (FAT-228, backend High): "Role not found" 5× |
| DynSec: attach role / rotasi password / disable-enable client; add client ke group | L32–L34, L36 | ⛔ TERBLOKIR MUT-02 (tidak ada client) — belum teruji |
| Config: stage / diff / discard | L38–L40 | ⛔ TIDAK DAPAT DIUJI — E2E-08 (FAT-222, backend High): editor tidak render, `mosquitto.conf` ENOENT di host API; tiket sudah ada, jangan buat baru |
| WO resolve-preview: panel kesiapan | L41 | ⛔ BELUM TERUJI — controller STM32-OEE-SIM offline ("Pemeriksaan Parameter Belum Tersedia — Edge controller STM32-OEE-SIM is currently offline. Check network connection or power.", "Planned Start: —"); perilaku informatif, bukan bug |
| Downtime: label baru pada event unlabeled | L43(b) | ⛔ BELUM TERUJI — tidak ada event unlabeled (STM32-OEE-01: 2 event historis, keduanya sudah berlabel; STM32-OEE-SIM: 0 event) |
| DynSec: hapus group berisi anggota | C6 | ⛔ BELUM TERUJI — group sudah kosong saat dihapus (C5 otomatis membersihkan keanggotaan; hapus role saat masih anggota group berhasil, kartu group lalu "Roles: (kosong)") |

Dari `AUDIT.md` §34.8 tetap belum terverifikasi: WS handshake `/ws/telemetry`,
`/force-change-password`, respons live endpoint 401-gated, N-16/N-17/N-18 laten;
N-32 butuh jawaban backend.

### 6.3 Temuan MUT-01 – MUT-04

- **MUT-01 (panel Medium, FAT-227) — banner network-error palsu + list stale
  di DynSec.** L29, L30, L35, L37: banner merah "Koneksi jaringan terputus
  atau backend tidak terjangkau." padahal mutasi sukses di server; list tampil
  stale sampai halaman di-remount; load baru mengungkap keadaan sebenarnya.
  Pola yang sama tidak terlihat di domain lain pada sesi ini. Detail: §3.7.
- **MUT-02 (backend High, FAT-228) — create MQTT client selalu "Role not
  found".** L31, 5× (role `E2E-TEST-ROLE` ×4 termasuk dari halaman yang baru
  di-remount, role `admin` ×1). Caveat terbuka: modal meng-hardcode default
  `cRoles=['edge_publisher']` (`CreateMqttClientModal.tsx:21`) — bisa jadi
  penyebab; penutupan butuh log body request aktual. Detail: §3.7.
- **MUT-03 (panel Medium, FAT-229) — policy create ABAC kosong mengirim
  `abacCondition: null`.** L18 dan L21 gagal di server; diulang dengan JSON
  ABAC `{"attr": "subject.line_id", "eq": "LINE-01"}` → berhasil. Akar di
  `schemas/dto.ts:235` (asumsi null sah) + rantai null
  `iamValidation.ts` → `iam.ts`. Hanya kedua jalur POST create yang salah;
  `PUT /policies/{id}` justru mengizinkan nullable. Detail: §3.6.
- **MUT-04 (panel Low, FAT-230) — label downtime asli tidak bisa dikembalikan
  persis.** Modal overwrite tidak punya opsi "Belum dikategorikan" dan selalu
  memberi prefix kategori; alasan event 13:55:34 kini "[EQUIPMENT_FAILURE]
  Equipment failure" (kolom kategori tetap "Belum dikategorikan"). Residu
  yang diterima, bukan data uji sisa. Detail: §3.4.

### 6.4 Koreksi rencana (`docs/E2E_MUTATION_PLAN.md`) — bukan bug, kecuali dinyatakan lain

- **Topik ACL literal, bukan wildcard:** `publishClientSend` + `e2e/test/#`
  ditolak server ("Wildcards are not allowed in 'publishClientSend' topics");
  dipakai topik literal `e2e/test` (L30).
- **Permission `read:telemetry` tidak ada di katalog live:** L18 memakai
  `refresh:telemetry`; L21 memakai `read:access_control`.
- **Badge register legacy `PROVISIONED`, bukan `ACTIVE`** (L4) — observasi,
  bukan tiket; lihat §3.2.
- **SKU produk tidak dikirim dari form create** (L8): SKU "SKU-E2E-TEST-01"
  yang diisi tidak terkirim; baris menampilkan SKU "PROD-TEST-E2E-01"
  (SKU default = Product ID). Terkonfirmasi live.
- **Opsi RESERVED di IAM** (L21): `manage:access_control`,
  `manage:mqtt_admin`, `manage:mqtt_configuration`,
  `read_raw:mqtt_configuration` tampil "(DIBLOKIR - RESERVED)" dan disabled
  saat bind permission.
- **Rute aktual** (koreksi `AUDIT.md` §34.6): `/work-orders`, `/audit`,
  `/downtime` (bukan `/admin/...`); `/admin/system-audit` adalah halaman
  terpisah tanpa filter UNACK/tombol ack.
- **Observasi terbuka, bukan tiket — authz_version #7 berulang:** banner
  assign-perm (L21), assign-user (L22), dan revoke (L25) semuanya menampilkan
  authz_version #7; counter tampak tidak naik pada assign/revoke. Rangkaian
  lengkap: #1 create role, #2 create policy, #3 disable, #4 enable, #5 update
  pattern v2, #6 restore pattern, #7 assign-perm, #8 unbind perm, #9 delete
  policy, #10 delete role.
- **Validasi server bekerja benar** (bukti positif, bukan koreksi): Modbus
  Slave ID duplikat ditolak (L5), `ROLE_IN_USE` menolak hapus role ter-assign
  (L24), wildcard ACL ditolak (L30), ABAC kosong ditolak (L18, L21).

### 6.5 Guard terverifikasi live (bukan temuan)

- Hapus role saat ter-assign → **`409 ROLE_IN_USE`** sesuai harapan (L24);
  kartu role utuh.
- Guard pasif `ADMIN`: kartu role `ADMIN` tanpa tombol Edit/Hapus; semua
  baris policy `ADMIN` Edit/Disable/Delete disabled; Revoke assignment
  `ADMIN`–`ADM-001` disabled dengan catatan "Anti-Lockout Guard: role ADMIN
  pada akun dilindungi tidak dapat dicabut."; di modal Add Policy dengan
  Role = `ADMIN`, opsi `DENY` ("Diblokir untuk ADMIN") disabled.
  Detail: §3.6.

### 6.6 Perubahan permanen yang diterima + SISA kosong

Perubahan permanen (bukan SISA): event 1148 di-ack oleh ADM-001
(11/19/2026, 7:05:45 PM, "E2E-TEST ack — verifikasi uji mutasi"; ack tidak
bisa di-undo dari UI); WO-SIM-20260906-02 ABORTED (irreversibel, L45);
alasan downtime event 13:55:34 kini berprefix "[EQUIPMENT_FAILURE] "
(MUT-04, C1); entri audit trail append-only untuk semua mutasi. WO-001,
ADM-001, dan role `ADMIN` tidak pernah disentuh; tidak ada Apply/Rollback
config yang diklik.

**SISA: KOSONG.** Verifikasi akhir Bagian A (C13): devices hanya
STM32-OEE-01 + STM32-OEE-SIM; machines hanya CNC-MILLING-SIM +
CNC-MILLING-01; products 5 asli; operators 5 asli. Verifikasi akhir
Bagian B (C13): Access Control Roles (4), Policies (62), Assignments (5),
tanpa TEST-E2E-ROLE/assignment TST-E2E-01; DynSec Clients (1)
backend-admin saja, Roles & ACLs (1) admin saja, Groups (0); Config
Versions (0), tanpa STAGED; Operators 5, tanpa TST-E2E-01. Tidak ada data
uji bernama `E2E-TEST-*` / `TEST-*` yang tersisa di panel.
