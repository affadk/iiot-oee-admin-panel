# Penutupan Backend Sync/Gaps — E21 (pasca E20)

| | |
|---|---|
| **Epic** | E21 (FAT-160) — penutupan backend sync/gaps di Linear |
| **Tanggal** | 2026-11-19 |
| **Sumber kebenaran** | API docs terupdate `~/workspace/user/files/pasted-text.txt` (2100 baris, upload 19 Nov 07:47 WIB) |
| **Gaps lama** | `docs/archive/BACKEND_GAPS_SYSTEM_ADMIN.md` — 50 gap SYS-B1–SYS-B50 + keputusan backend 18 Nov + delegasi E18 + tabel status 50/50 (E19) |
| **Pendukung** | `docs/API_SYNC_DIFF.md` (294 entri; C1–C22; §18 amandemen 09:23), `docs/API_SYNC_REVIEW.md` (R-1–R-15), `docs/BACKEND_UPGRADE_PLAN.md` (Fase 0–9, K-01–K-15) |
| **Metode** | Tiap gap diverifikasi ulang terhadap api_docs terupdate (pasal + nomor baris dikutip). "Tertutup" di E19 berarti keputusan tercatat, BUKAN implementasi selesai — yang dinilai di sini adalah implementasi backend sebagaimana tercermin di api_docs. Koreksi hitungan: enum `event_type` eksplisit = **32**, bukan 33 (terverifikasi hitung token, §I baris 1073–1075). |

> **Catatan metodologi — PENTING.** Salinan `pasted-text.txt` di disk bermtime
> 19 Nov 00:47 UTC (= 07:47 WIB) — itu salinan upload asli. Amandemen 09:23 dari
> Fathur (otorisasi `authorize(...)`, cURL §M diperbaiki, endpoint baru
> `GET /api/v1/system/access-mode`) **tidak ada dalam file ini** — diverifikasi
> sendiri: 0 hit `access-mode`, 0 hit `authorize("cancel"`, baris 1340 masih
> `/clients/provision`. Verdict yang bersandar pada amandemen 09:23 ditandai
> **(amandemen 09:23, belum terverifikasi di dokumen)** dan penutupan
> definitifnya menunggu salinan api_docs baru dari Fathur/backend. Lihat §7.

## 1. Ringkasan hitungan

| Kelompok | Terselesaikan | Masih terbuka | Berubah/digantikan | Total |
|---|---:|---:|---:|---:|
| IAM (B1–B18) | 12 | 5 | 1 | 18 |
| Audit/Health (B19–B27) | 8 | 1 | 0 | 9 |
| DynSec (B28–B37) | 2 | 7 | 1 | 10 |
| Config (B38–B44) | 6 | 1 | 0 | 7 |
| Master Data (B45–B50) | 6 | 0 | 0 | 6 |
| **Total** | **34** | **14** | **2** | **50** |

- **Tutup di Linear (36):** 34 terselesaikan + 2 berubah (B13, B30) — lihat close-list §4.
- **Tetap Todo (14):** B3, B6, B11, B12, B17, B23, B31, B32, B33, B34, B35, B36, B37, B41.
- Pola yang menonjol: DynSec adalah kelompok paling belum selesai (7/10 terbuka) —
  semua rute terkonfirmasi, tetapi **seluruh skema body sub-operasi dan skema objek
  klien absen dari api_docs**; Master Data paling tuntas (6/6, spec 036).

## 2. Tabel per gap

Legenda verdict: **TERSELESAIKAN** = api_docs mencerminkan implementasi yang
menjawab gap · **MASIH TERBUKA** = api_docs tidak menjawab / masih kontradiksi
(sebagian = inti terjawab, sisa material belum) · **BERUBAH/DIGANTIKAN** =
keputusan/harapan lama digantikan keadaan baru di api_docs. Kolom "Status sebelum"
adalah disposisi E19 (39 keputusan backend 18 Nov, 6 delegasi E18, 2 panel-side
selesai E14, 3 panel-side tindak lanjut).

| Gap | Status sebelum (E19) | Verdict vs api_docs baru | Bukti (pasal + baris api_docs) | Aksi Linear |
|---|---|---|---|---|
| SYS-B1 — Body `POST /policies`, `subjectMatch` | Delegasi E18 | **TERSELESAIKAN** | §3.4:1511 (camelCase saja, tanpa alias snake_case; field asing diabaikan; field wajib hilang/salah tipe → `400 INVALID_POLICY` menyebut nama field); :1514–1521 (contoh kanonis `{roleId, permissionId, resourcePattern, effect, abacCondition}`); :1524 (`subjectMatch` opsional; kosong → `role:<nama role>`; nilai sah `*`, `role:<nama>`, `operator:<id>`); :1527–1545 (baris policy respons); :1500 (reserved hanya `subject_match = operator:ADM-001`, selain itu `403 RESERVED_PERMISSION`) | **Tutup** FAT-72 |
| SYS-B2 — `PUT /policies/:id`, method + nama field | Panel-side selesai E14 | **TERSELESAIKAN** | §3.4:1491 (`PUT /policies/:id`); :1511 (camelCase saja); :1499 (policy DENY/disabled pada role ADMIN ditolak). Sisa dokumen: deskripsi :1491 masih menulis nama snake_case (`resource_pattern`/`abac_condition`) — kontradiksi C4, R-8 terbuka | **Tutup** FAT-73 |
| SYS-B3 — ABAC: grammar/atribut/whitelist | Delegasi E18 | **MASIH TERBUKA** | §3.4:1502 (predikat JSON terstruktur; whitelist **10 atribut**, 6 comparator, `all`/`any`/`not`); :1520 (satu-satunya contoh `{all:[{attr:"subject.line_id", eq:"LINE-01"}]}`). Daftar 10 atribut **tidak pernah dienumerasi** — hanya 1 contoh. Pesan 400 menyebut nama atribut tidak dinyatakan | Tetap Todo FAT-74 → R-1 |
| SYS-B4 — `mustChangePassword` / `isActive` / `isProtected`, alur ganti-password-wajib | Delegasi E18 | **TERSELESAIKAN** | §L:1227 (login 200 membawa `operator.must_change_password`); :1245 (`GET /auth/me` membawa `isActive`/`isProtected`/`mustChangePassword`); :1249 (gerbang spec 043: selain `GET /auth/me` + `POST /auth/password/change` → `403 {error:"PASSWORD_ROTATION_REQUIRED"}`); :1238 (change → `must_change_password=false`, bump `authz_version`, token lama `401 AUTHZ_STALE`). Koreksi kode vs redaksi E18: gerbangnya **403**, bukan "401 khusus" | **Tutup** FAT-75 |
| SYS-B5 — `PUT /roles/:id`, method PATCH vs PUT | Panel-side selesai E14 | **TERSELESAIKAN** | §3.4:1480 (`PUT /roles/:id` — update deskripsi, ADMIN + `manage` access_control). Sisa minor: tidak dinyatakan apakah `reason` diterima pada PUT ini | **Tutup** FAT-76 |
| SYS-B6 — Skema respons IAM tidak dispesifikasi field-per-field | Delegasi E18 | **MASIH TERBUKA** (sebagian) | §3.4:1549–1553 (5 bentuk baca terdefinisi: `/roles`, `/permissions`, `/policies`, `/user-roles`, `/subjects/:id/effective-permissions`); :1556 (`privilege_level` dan `policy_count` **TIDAK** dikembalikan). Belum: `GET /info` hanya satu baris (:1477) tanpa daftar field/contoh; `GET /audit` hanya filter (:1493) tanpa bentuk baris respons; tanpa contoh respons `POST`/`PUT` role | Tetap Todo FAT-77 → R-21 |
| SYS-B7 — Role preset immutable; hapus role ber-pemakaian | Delegasi E18 | **TERSELESAIKAN** | §3.4:1495–1496 (hanya `ADMIN` immutable + reserved untuk `ADM-001`; preset lain dapat diubah/dihapus bila tidak dipakai, FR-RL-002); :1558 (`DELETE /roles/:id`: 404 / ADMIN → `403 ROLE_IMMUTABLE` / ter-assign → `409 ROLE_IN_USE` menyebut `operatorId` / punya policy → `409 ROLE_IN_USE` / lolos → `200 {success:true, message}`) | **Tutup** FAT-78 |
| SYS-B8 — Capability `access_control.read` | Backend 18 Nov | **TERSELESAIKAN** | §3.4:1505 (katalog `<domain>.<action>`; `access_control.read` dan `access_control.manage` dua kunci terpisah; 403 satu aksi tidak menurunkan capability aksi lain); tabel §3.4:1477–1493 (semua GET IAM = `read`, semua mutasi = `manage`) | **Tutup** FAT-79 |
| SYS-B9 — Proyeksi capability `/auth/me`, `effectiveInMode`, mode `partial` | Backend 18 Nov | **TERSELESAIKAN** | §3.4:1477 (`effectiveInMode` = `mode`; detail per-domain di `enforcedDomains`); §L:1245 (`authz:{mode, authzVersion, catalogueVersion, enforcedDomains, effectiveRoles, attributes, capabilities:[...]}`); §3.4:1563–1573 (mode hanya `shadow`/`enforce` + `AUTHZ_ENFORCE_DOMAINS` — tanpa `partial`). Sisa: kanon bentuk `/auth/me` masih 3 varian — R-2 terbuka | **Tutup** FAT-80 |
| SYS-B10 — `POST /permissions` | Backend 18 Nov | **TERSELESAIKAN** | §3.4:1485 (`POST /permissions`: pasangan `(action, resourceType)` wajib punya rute penjaga, selain itu `400 INERT_PERMISSION`; duplikat → `409 PERMISSION_EXISTS`); :1511 (body camelCase) | **Tutup** FAT-81 |
| SYS-B11 — `GET /access-control/audit`: filter + limit | Panel-side tindak lanjut (P-D) | **MASIH TERBUKA** (sebagian) | §3.4:1493 (filter `subject`/`decision`/`mode`/`from`/`to` terkonfirmasi). Belum: **tidak ada nilai `limit`** di §3.4 (pencarian `limit` baris 1469–1580 = 0); tanpa bentuk `meta`/cursor maupun bentuk baris audit | Tetap Todo FAT-82 → R-21 |
| SYS-B12 — Inspector `GET /subjects/:operatorId/effective-permissions` | Backend 18 Nov | **MASIH TERBUKA** (sebagian) | §3.4:1553 (respons `{operatorId, primaryRole, isActive, isProtected, authzVersion, effectiveInMode, assignments[], roles[], permissions[]}`; `roles` satu-satunya nama field, tanpa alias `effectiveRoles`; subjek tak ada → `404`). Belum: kode 404 tidak dipetakan (apakah `OPERATOR_NOT_FOUND`); perilaku operator **tanpa assignment** tidak dinyatakan | Tetap Todo FAT-83 → R-21 |
| SYS-B13 — `reason` pada bind permission ke role | Backend 18 Nov | **BERUBAH/DIGANTIKAN** | §3.4:1507 (FR-037-40/41: `reason` pada mutasi policy/assignment **hanya** disimpan di audit IAM; baris policy **tidak** memuat field `reason`; "jangan mengisinya di panel"); tabel §3.4:1482 (`POST /roles/:id/permissions` tidak mencantumkan `reason`). Acceptance awal B13 ("`GET /policies` menampilkan `reason`") **digantikan**: `reason` tidak akan pernah tampil di baris policy. Panel E20 sudah menghapusnya (X6) | **Tutup** FAT-84 (digantikan) |
| SYS-B14 — Mutasi assignment: `reason`, revoke composite key, revoke tanpa baris | Backend 18 Nov | **TERSELESAIKAN** | §3.4:1488 (`DELETE /user-roles`: tanpa baris cocok → `200 {success:true, removed:0}`, idempoten); :1507 (`reason` hanya di audit IAM). Sisa minor: body `DELETE /user-roles` tidak dispesifikasi (`reason`? `id`?) | **Tutup** FAT-85 |
| SYS-B15 — Refresh token: `authzVersion`, 401 `AUTHZ_STALE`/`SUBJECT_INACTIVE` | Backend 18 Nov | **TERSELESAIKAN** | §L:1232 (`POST /auth/refresh` mengembalikan `authzVersion` hasil pembacaan ulang identitas dari basis data; subjek nonaktif → `401 UNAUTHORIZED`; subjek stale → `401 AUTHZ_STALE`); §6B:1984; §3.4:1502–1505 (setiap mutasi → `reloadPolicy` → bump `authz_version`). Nuansa: `SUBJECT_INACTIVE` hanya muncul di `GET /auth/me` (:1245), bukan di jalur refresh | **Tutup** FAT-86 |
| SYS-B16 — Login lockout 5/30 vs 5/60, `Retry-After` | Delegasi E18 | **TERSELESAIKAN** | §L:1225–1227 (rate limit 5/60s per `<ip>:<station_id>` — "satu-satunya sumber kebenaran throttle; panel **TIDAK** menerapkan lockout paralel"; `429 + Retry-After: <sisa detik>` dihitung `firstAttempt + window − now`, min 1 detik); :1252 (env `AUTH_RATE_LIMIT_MAX=5`, `AUTH_RATE_LIMIT_WINDOW_MS=60000`) | **Tutup** FAT-87 |
| SYS-B17 — Filter `operatorId`/`roleId` pada `GET /user-roles` & `GET /policies` | Panel-side tindak lanjut (P-E) | **MASIH TERBUKA** | §3.4:1486 (`GET /user-roles` — tanpa query param); :1489 (`GET /policies` — tanpa query param); pencarian `limit` baris 1469–1580 = 0. Filter `operatorId`/`roleId` dari Guide Lampiran K **tidak muncul sama sekali** di api_docs — tidak dikonfirmasi didukung, tidak dinyatakan diabaikan. Pernyataan tanpa-paginasi juga tidak ada | Tetap Todo FAT-88 → R-22 |
| SYS-B18 — Anti-eskalasi/wildcard karangan panel | Panel-side tindak lanjut (P-F) | **TERSELESAIKAN** | §3.4:1514–1521 (contoh kanonis memakai `"resourcePattern": "*"` untuk role custom `LINE_LEAD_2` — wildcard diizinkan); :1500 (pembatasan reserved hanya soal `subject_match = operator:ADM-001`); :1498–1499 (root protection + anti-lockout; tanpa larangan wildcard untuk custom role). Aturan karangan panel (tolak `*` dengan `403 PRIVILEGE_ESCALATION_DENIED`) **terbantah oleh dokumen** dan harus dihapus (P-F). Sisa: pemicu `PRIVILEGE_ESCALATION_DENIED` tidak dipetakan (R-12) | **Tutup** FAT-89 |
| SYS-B19 — Skema `OperationalEventItem` | Backend 18 Nov | **TERSELESAIKAN** | §I:1020–1047 (contoh JSON lengkap 17 field); :1044 ("`acknowledged` adalah turunan dari `acknowledgedAt`"); :1045 ("`machineName` bernilai `null` bila mesin sudah dihapus"). Tanpa field karangan (`actor`/`action`/`resource`/`clientIp`/`accessMode`/`severity`) | **Tutup** FAT-90 |
| SYS-B20 — `GET /health` miskin + sintesis panel | Backend 18 Nov | **TERSELESAIKAN** | §A:67–93 (`GET /health` tetap ringkas: `status`, `uptime` detik, `timestamp`, `ws_clients`, `db_connected`, `buffer_pending`, `buffer_dropped`, `metrics{...}`); §A:95–146 (`GET /health/detail` baru ADMIN+LAN; tiap komponen bawa `measuredAt`; tak tersedia = `null`/`UNKNOWN`; `database.latencyMs` diukur nyata `SELECT 1`, timeout 2 dtk → `DOWN`, `latencyMs: null`). P-I tidak terblokir | **Tutup** FAT-91 |
| SYS-B21 — Ack `operatorId` wajib/tidak | Backend 18 Nov | **TERSELESAIKAN** | §I:1114–1118 (`PATCH /operational-events/:id/ack`: aktor dari subjek JWT; body hanya `{note?}` max 1000; `operatorId`/`operator_id` deprecated + diabaikan; ack kedua mengembalikan nilai lama tanpa galat). Respons `200 {id, acknowledgedAt, acknowledgedBy, ackNote, acknowledged:true}`. K-14 (a) terkonfirmasi. Detail baru vs dokumen lama: batas `note` max 1000 (dulu ≤500) | **Tutup** FAT-92 |
| SYS-B22 — Filter `severity` / `acknowledged` | Backend 18 Nov | **TERSELESAIKAN** | §I:1014, 1097–1098 (`acknowledged` `true`/`false` terdaftar, `true` → `acknowledged_at IS NOT NULL`); §I:1076 ("Parameter tak dikenal (mis. `severity`) **diabaikan** dengan `200` (Q-034-07); filter `severity` **tidak didukung**"); skema FR-034-01 (:1022–1043) tanpa field `severity`. Sisa: `acknowledged` **tidak** terdaftar di daftar query `GET /system/audit` (:1072) maupun export-nya (:1082) — R-19 | **Tutup** FAT-93 |
| SYS-B23 — `machine_id` di list global + ekspor | Backend 18 Nov | **MASIH TERBUKA** (parsial) | `GET /system/audit` :1069–1072 (`machine_id` terdaftar ✓) dan `/system/audit/export` :1082 ✓. TAPI `GET /operational-events` (global) :1007–1018 — **tanpa `machine_id`**; `GET /operational-events/export` (global) :1085–1091 — tanpa `machine_id` dan tanpa `event_type`. Keputusan 18 Nov **dibalik sebagian**: hanya `/system/audit` yang memuat `machine_id` | Tetap Todo FAT-94 → R-18 |
| SYS-B24 — `event_type` di `/system/audit` | Backend 18 Nov | **TERSELESAIKAN** | §I:1069–1077 (query memuat `event_type`); :1073–1075 (enum tertutup FR-034-26/27 — **32 nilai eksplisit** terverifikasi hitung token + pola `COMMAND_<cmd>_DISPATCHED` (6 cmd), `MQTT_ADMIN_<op>`, `DEVICE_EVENT_<n>` (0..255)). Catatan: enum tertutup hanya dinyatakan untuk `/system/audit`; list global/per-device menulis "string, optional" (:1013, :1097) — C17, D-12 | **Tutup** FAT-95 |
| SYS-B25 — Envelope `meta` list | Backend 18 Nov | **TERSELESAIKAN** | §I:1048–1066 (contoh `{data, meta:{limit, hasMore, truncated, nextCursor, count}}`); :1065 ("`count` = **jumlah baris pada halaman ini**, bukan total dataset. Tidak ada query `COUNT(*)` total."); :1066 (tanpa `envelope` dan tanpa `cursor`, respons tetap array polos). `prevCursor` opsional, tidak muncul di contoh — konsisten | **Tutup** FAT-96 |
| SYS-B26 — Export system-audit | Backend 18 Nov | **TERSELESAIKAN** | §I:1079–1083 (`GET /api/v1/system/audit/export`: filter sama dengan list; retensi 90 hari → `400 RETENTION_EXCEEDED`; rate limit 5/menit; guard `enforceSubnetOrigin` + `authorize("read","access_control")`; query `from, to, event_type, machine_id, format (csv/ndjson/json), limit (1..100000 default 10000)`; header `X-Export-*`). P-J tidak terblokir | **Tutup** FAT-97 |
| SYS-B27 — Endpoint info/versi backend | Backend 18 Nov | **TERSELESAIKAN** | §A:95–146 (`GET /health/detail.application` memuat `name`, `version`, `environment`, `commit` boleh `null`, `uptimeSeconds`); :103–105 (`version` dari `APP_VERSION`/`package.json`; `environment` dari `NODE_ENV`; `commit` dari `GIT_SHA`); :106 ("Respons tidak memuat connection string, kredensial, token, atau path filesystem."). Tidak ada `GET /system/info` terpisah — info versi lewat `/health/detail` (ADMIN+LAN) | **Tutup** FAT-98 |
| SYS-B28 — Rotasi password POST vs PATCH | Backend 18 Nov | **TERSELESAIKAN** | §M:1288 (`PATCH /clients/{name}/password` → 200); cURL :1342–1345. K-10 terkonfirmasi. Sisa: tidak tertulis apakah `POST` ke path yang sama ditolak 404/405 | **Tutup** FAT-99 |
| SYS-B29 — Enable/disable POST + `{disabled}` vs PATCH + `{enabled}` | Backend 18 Nov | **TERSELESAIKAN** | §M:1289 (`PATCH /clients/{name}/enable` → 200, "`false` = nonaktifkan/kick"). Nama field `{enabled}` hanya **tersirat** (satu-satunya field boolean yang konsisten dengan semantik itu) — tanpa skema body eksplisit. `{disabled}` tidak muncul di konteks dynsec mana pun | **Tutup** FAT-100 |
| SYS-B30 — Provisioning: `access` dipetakan ke `telemetry`/`telemetry+state` | Backend 18 Nov | **BERUBAH/DIGANTIKAN** | Jalur kanonis baru §E.3a `POST /api/v1/devices/provision` (spec 015, ADR-009), :442–478; ringkasan :395; §6B:1960. Body :449–455 `{deviceId, machineId?, model?}` — **tanpa field `access`**. Password dibuat backend 32 char `A-Za-z0-9-_`, hanya dikembalikan sekali (:444, :468–473). Role `device-<deviceId>` dengan grant eksplisit tetap (:444, :478). §M sendiri mengakui rute baru (:1274). Keputusan 18 Nov (`POST /clients` + `access` verbatim) **dibalik lagi**; P-A usang; P-B moot (nilai `telemetry`/`telemetry+state` grep = 0 di api_docs). Sisa usang: §M :1319 masih `POST /clients {deviceId, access, …}` dan cURL :1339–1340 masih `/clients/provision` — C1/C5 masih hidup di salinan ini (R-9) | **Tutup** FAT-101 (digantikan) |
| SYS-B31 — Tambah role ke klien: `{roles:[…]}` vs `{rolename, priority?}` | Backend 18 Nov | **MASIH TERBUKA** | §M:1290 (`POST /clients/{name}/roles` → 201 "Assign peran ke klien") — method/path/status terkonfirmasi, tetapi **tidak ada skema body** di seluruh api_docs. Satu-satunya kemunculan `rolename`/`priority` adalah cURL buat klien (:1334, body `POST /clients`, bukan sub-operasi ini). K-05 (objek tunggal) **tidak terkonfirmasi** dokumen baru — bersandar pada Guide lama | Tetap Todo FAT-102 → R-20 |
| SYS-B32 — Tambah ACL ke role: `{acls:[…]}` vs objek ACL tunggal | Backend 18 Nov | **MASIH TERBUKA** | §M:1301 (`POST /roles/{name}/acls` → 201) — hanya itu. `allow` dan `priority` untuk ACL **tidak muncul di mana pun** di api_docs (grep `acltype` hanya :1302, itu pun body DELETE `{acltype, topic}`). K-05 tidak terkonfirmasi | Tetap Todo FAT-103 → R-20 |
| SYS-B33 — Password kosong / auto-generate; `password` wajib min 8; field `textname`/`textdescription`/`groups`/`clientid` | Backend 18 Nov | **MASIH TERBUKA** | §M:1286 (`POST /clients` → 201, "≥1 peran wajib", "password dikembalikan sekali"); :1272 ("Password tidak pernah dicatat atau dikembalikan ulang setelah pembuatan"). **Tidak ada** pernyataan min-8 untuk password klien dynsec — semua hit min-8 (:931, :982, :1239) adalah password operator. Tidak ada pernyataan auto-generate untuk `POST /clients`. `textname?`/`textdescription?` hanya disebut di body provisioning lama (:1319); `clientid` terlihat di cURL (:1334); `groups` tidak disebut sama sekali. Berubah untuk mode provisioning: password kini dibuat backend 32 char via `POST /devices/provision` (:444) | Tetap Todo FAT-104 → R-20 |
| SYS-B34 — Nama field respons password sekali-tampil `POST /clients` | Backend 18 Nov | **MASIH TERBUKA** | Grep `generatedPassword`/`generated_password` = **0 hit** di seluruh 2100 baris. §M hanya mengulang "password dikembalikan sekali" (:1286, :1319) tanpa nama field dan tanpa contoh JSON respons. Bandingkan: rute provision baru menamai envelope kredensial eksplisit — `credential:{username,password,clientId,topicPrefix}` (§E.3a :468–473; §6B:1960). Panel tetap baca defensif (`generatedPassword ?? password`) | Tetap Todo FAT-105 → R-14 |
| SYS-B35 — `enabled` vs `disabled` pada objek klien | Backend 18 Nov | **MASIH TERBUKA** | Tidak ada contoh/skema JSON objek klien dynsec di api_docs. `disabled` hanya muncul sekali di luar konteks dynsec (:1499, policy role ADMIN). Hit `enabled` (:1382, :1447, :1452, :1540) semuanya objek konfigurasi broker/overview, bukan klien dynsec. Keputusan 18 Nov ("`disabled` kanonis") **tidak terkonfirmasi** | Tetap Todo FAT-106 → R-20 |
| SYS-B36 — Tambah klien ke grup: `{clients:[…]}` vs `{username, priority?}` | Backend 18 Nov | **MASIH TERBUKA** | §M:1312 (`POST /groups/{name}/clients` → 201) — tanpa skema body. K-05 tidak terkonfirmasi | Tetap Todo FAT-107 → R-20 |
| SYS-B37 — Tambah role ke grup: `{roles:[…]}` vs `{rolename, priority?}` | Backend 18 Nov | **MASIH TERBUKA** | §M:1314 (`POST /groups/{name}/roles` → 201) — tanpa skema body. K-05 tidak terkonfirmasi | Tetap Todo FAT-108 → R-20 |
| SYS-B38 — Trailing slash `GET /mqtt/configuration` | Backend 18 Nov | **TERSELESAIKAN** | §3.3b:1406 ("Base path `/api/v1/mqtt/configuration`; bentuk path dengan **dan** tanpa trailing slash diterima (`ignoreTrailingSlash`)"). K-03 (a) "wajib slash" **dibalik** 18 Nov menjadi (c) "terima keduanya" — api_docs mencerminkan (c). Panel sudah mengirim dengan slash (E14 P14.1) | **Tutup** FAT-109 |
| SYS-B39 — Stage config `{config, summary}` vs `{config, baseVersionId?, reason?, comment?}` | Backend 18 Nov | **TERSELESAIKAN** | §3.3b:1464 ("`POST /configurations` menerima `config` bentuk panel, `baseVersionId?`, dan `reason` **atau** alias `summary` (`reason` menang bila keduanya ada). Field baca-saja diabaikan, bukan `400`."); :1414 (stage → `201`, invalid → `422`). Sisa minor: `comment` tidak disebut sama sekali; fallback `baseVersionId` ke versi APPLIED tidak dinyatakan eksplisit; tanpa contoh respons stage | **Tutup** FAT-110 |
| SYS-B40 — Detail error 422 staging (`details` vs `issues`) | Backend 18 Nov | **TERSELESAIKAN** | §2:53 (`422 CONFIG_VALIDATION_FAILED` — "detail pada `details`"); §3.3b:1465 ("`422` mengembalikan `{error:\"CONFIG_VALIDATION_FAILED\", issues:[{field,message,severity,code}], details:{validation}}`: `issues[]` kontrak baru, `details` legacy tetap ada."); :1414. K-04 (a) "`issues[]` saja" **dibalik** 18 Nov menjadi dual — api_docs mencerminkan dual. Panel hanya mem-parsing `issues` — sudah cukup | **Tutup** FAT-111 |
| SYS-B41 — Apply/rollback async + `acknowledgeUnvalidated` + polling | Backend 18 Nov | **MASIH TERBUKA** (sebagian) | **Terkonfirmasi:** §3.3b:1418 (apply async → `202 {operationId, versionId}`, butuh `{confirm:true}`); :1419 (rollback async → `202`); :1421 (`GET /operations/:operationId` — "dipoll hingga terminal"); :1466 (status operasi `PENDING`/`RUNNING`/`SUCCEEDED`/`FAILED`). **Tidak ada:** `acknowledgeUnvalidated` = **0 kemunculan** di seluruh 2100 baris — kapan wajib, error bila absen, apakah dihormati, semuanya tidak dinyatakan. Acceptance criteria gap tidak dapat diuji dari dokumen | Tetap Todo FAT-112 → R-16 |
| SYS-B42 — `POST /backups` hantu; restore/download backup | Backend 18 Nov | **TERSELESAIKAN** | §3.3b:1467 ("`POST /backups` **tidak disediakan** (`404`). Backup dibuat otomatis saat apply/rollback."); :1422 (`GET /backups` — "Inventaris backup (metadata + `filename`, tanpa path internal)"). "Restore" kanonis tetap rollback versi (:1419) | **Tutup** FAT-113 |
| SYS-B43 — Model konfigurasi terstruktur tidak dispesifikasi | Backend 18 Nov | **TERSELESAIKAN** | §3.3b:1424–1461 (contoh JSON lengkap "Model panel": `version`, `general`, `limits`, `listeners`, `tls_profiles`, `bridges` dengan `has_password`, `remote_client_id`, `status`); :1463 ("Field tanpa sumber nyata bernilai `null`: `limits.max_connections`, `limits.max_queued_bytes`, `bridges[].remote_client_id`, `bridges[].status`… `tls_profiles` selalu `[]`…"); :1466 (status versi `STAGED`/`ACTIVE`/`ROLLED_BACK` + `domainStatus`; `operation_type` `NO_OPERATION`/`RELOAD`/`RESTART`); :1410 (`GET /` juga mengembalikan `unmanaged[]`). K-07 terpenuhi. Koreksi panel (sudah di diff M4–M7/X16): status versi **tidak mengenal `APPLIED`**; contoh `autosave_interval_seconds`/`max_connections` bernilai `null`, bukan default fabrikasi panel | **Tutup** FAT-114 |
| SYS-B44 — Overview: bentuk dalam `{dynamicSecurity, configuration}` | Backend 18 Nov | **TERSELESAIKAN** | §3.3a:1372–1401 (contoh respons lengkap: `dynamicSecurity: {available, enabled, status: "READY", clientsCount, rolesCount, groupsCount, lastError, measuredAt}` dan `configuration: {status: "IN_SYNC", activeVersionId, lastAppliedAt, mutationLocked, lastOperation, measuredAt}`); :1401 ("Plugin tidak siap → `dynamicSecurity: {available:false, reason, clientsCount:null, rolesCount:null, groupsCount:null, lastError, measuredAt}`. `null` berarti 'tidak tersedia', bukan `0` (FR-035-51)."); :1402 (`configuration.status`: `APPLYING`/`FAILED`/`DRIFT`/`IN_SYNC`/`UNAVAILABLE`). Nuansa baru: ketidaktersediaan lewat `status: "UNAVAILABLE"`, bukan objek null | **Tutup** FAT-115 |
| SYS-B45 — Filter Shift Schedules snake_case vs camelCase | Backend 18 Nov | **TERSELESAIKAN** | §P:1676 ("036 — filter: hanya bentuk snake_case `line_id`, `day_of_week`, `shift_id`, `is_active` (Q-036-05). Tidak ada alias camelCase."); §P.1:1682 (filter query + cursor pagination) | **Tutup** FAT-116 |
| SYS-B46 — Denormalisasi respons schedule | Backend 18 Nov | **TERSELESAIKAN** | §P:1674 ("036 — read model: list dan detail memuat `shiftName`, `shiftCode`, `startTime`, `endTime` dari join shift yang sama (satu query, NFR-036-01). Tidak ada salinan: bila jam shift berubah, jam jadwal ikut berubah (FR-036-42); histori aman karena `work_orders` menyimpan snapshot shift. Bila shift yang dirujuk hilang, field shift bernilai `null` (FR-036-03).") | **Tutup** FAT-117 |
| SYS-B47 — Operator create `is_active` + proteksi ADM-001 | Backend 18 Nov | **TERSELESAIKAN** | §H.3:919 ("`isActive` (036): opsional, default `true` (FR-036-21). `false` → operator dibuat nonaktif dan tidak dapat login (FR-036-22). Aturan perlindungan akun root tidak berubah: `PATCH /operators/ADM-001/status {isActive:false}` tetap 400, `DELETE /operators/ADM-001` tetap 403."); §H.7:986 (guard ADM-001 nonaktif → `400 PROTECTED_ACCOUNT`); §H.5:959, 967 (guard ADM-001 → `403 PROTECTED_ACCOUNT`); tabel §2:48, :50. Sisa: otorisasi mutasi operator masih kontradiksi — R-4 terbuka | **Tutup** FAT-118 |
| SYS-B48 — Pagination/filter list DynSec & Operators | Backend 18 Nov | **TERSELESAIKAN** | §H.1:881 ("Kelengkapan (036, Q-036-06): respons adalah **array penuh tanpa paginasi dan tanpa pemotongan diam-diam** (FR-036-30). Batas praktisnya adalah kapasitas memori proses backend; bila suatu saat butuh paginasi, kontraknya harus memakai envelope `{ data, meta }` dengan `nextCursor`/`hasMore` (FR-036-32) — belum diimplementasikan."); :882 ("DynSec (036): `GET /mqtt-admin/clients`, `/roles`, `/groups` memakai kontrak kelengkapan yang sama (FR-036-31)."). Catatan minor: :882 menulis `/mqtt-admin/clients`, sedangkan base path §M :1276–1278 adalah `/api/v1/mqtt/dynamic-security/*` — kosmetik, kontraknya jelas | **Tutup** FAT-119 |
| SYS-B49 — Guard hapus production line (operator sebagai pemblokir) | Backend 18 Nov | **TERSELESAIKAN** | §N.5:1628 ("Hapus production line. Guard berurutan di dalam satu transaksi (036): `machines` → 409 `PRODUCTION_LINE_IN_USE` (sebut `machineId`), snapshot `work_orders` → 409 (sebut `woId`), **operator** (`operators.line_id`) → 409 `PRODUCTION_LINE_IN_USE` (sebut `operatorId`, FR-036-10/11). `operators.line_id` tidak punya FK; operator harus di-reassign dulu.") | **Tutup** FAT-120 |
| SYS-B50 — Guard hapus shift + efek edit jam shift | Backend 18 Nov | **TERSELESAIKAN** | §O:1666 ("Hapus ditolak jika masih dirujuk `shift_schedules` atau `work_order` snapshot → `409 SHIFT_IN_USE`."); §P:1678 ("036 — perubahan jam shift (Q-036-04): `PATCH /shifts/:shiftId` yang mengubah `startTime`/`endTime` dan membuat jadwal pada `line_id`+`day_of_week` yang sama tumpang tindih → `409 SHIFT_TIME_OVERLAP` dengan detail `{shiftId, lineId, dayOfWeek, conflictShiftId}`. Perubahan nama/kode tidak memicu validasi (FR-036-43)."); §P:1674 ("Tidak ada salinan: bila jam shift berubah, jam jadwal ikut berubah (FR-036-42)."); tabel §2:52 | **Tutup** FAT-121 |

## 3. Verifikasi keputusan 18 Nov + delegasi E18 + Fase 0 vs api_docs baru

### 3.1 Keputusan Fase 0 (K-01–K-15)

| K-item | Keputusan lama | Status vs api_docs baru |
|---|---|---|
| K-01 password/change body | (a) `{current_password, new_password}` | **Terkonfirmasi** — §L: `old_password` → `400 VALIDATION_ERROR` |
| K-02 bentuk `/auth/me` | (a) nested `{operator, authz}` | **Tidak terkonfirmasi** — masih 3 varian: flat §L:1245, nested §3.4:1554, ringkas §6B:1984 (R-2) |
| K-03 trailing slash config | 17 Nov (a) wajib slash → 18 Nov (c) terima keduanya | **Terkonfirmasi (c)** — §3.3b:1406 `ignoreTrailingSlash` |
| K-04 detail 422 | 17 Nov (a) `issues[]` → 18 Nov dual | **Terkonfirmasi dual** — §3.3b:1465 + §2:53 |
| K-05 body sub-op dynsec | (a) objek tunggal, ikuti API doc | **Tidak terkonfirmasi** — api_docs baru tidak memuat skema body keempat sub-operasi (B31/B32/B36/B37) |
| K-06 skema respons dynsec | Ikuti API doc (password min 8; mapper dua bentuk) | **Tidak terkonfirmasi** — min-8 tidak tertulis untuk klien dynsec; nama field password sekali-tampil tidak dinamai; tanpa skema objek klien (B33/B34/B35) |
| K-07 skema config terstruktur | Ikuti API doc; backend publikasikan skema | **Terpenuhi** — §3.3b:1424–1466 (B43) |
| K-08 param tak dikenal | (a) diabaikan | **Belum terkonfirmasi global** — klausul abaikan hanya untuk `/system/audit` (§I:1076; R-10) |
| K-09 `POST /permissions` | 17 Nov (b) seed-only → 18 Nov (a) didukung + guard | **Terkonfirmasi (a)** — §3.4:1485 (`400 INERT_PERMISSION`, `409 PERMISSION_EXISTS`) |
| K-10 method | (a) PUT IAM, PATCH dynsec | **Terkonfirmasi** — §3.4:1480/:1491 (PUT), §M:1288–1289 (PATCH) |
| K-11 rute provisioning | 17 Nov (b) `/clients/provision` → 18 Nov (a) `POST /clients` | **DIBALIK LAGI** — kini `POST /api/v1/devices/provision` (spec 015, §E.3a:442–478); kedua pilihan lama digantikan (B30) |
| K-12 `authz_version` bump | (a) setiap mutasi bump | **Terkonfirmasi** — §3.4:1502–1505 ("Setiap mutasi → reloadPolicy enforcer → bump authz_version") |
| K-13 `/system/audit` scope | (a) alias feed operasional | **Terkonfirmasi** — §I:1069–1077 (alias, operasional saja; mutasi IAM terpisah di `/access-control/audit`) |
| K-14 ack `operatorId` | (a) turunkan dari JWT, body `{note?}` | **Terkonfirmasi** — §I:1114–1118 |
| K-15 availability jam fully-planned | (a) dikeluarkan dari denominator, ditandai "planned" | **Terkonfirmasi** — §K ADR-019: `availabilityPct = run / (run + unplanned)` |

### 3.2 Keputusan backend 18 Nov per modul (specs/034–038)

| Modul | Gap | Status vs api_docs baru |
|---|---|---|
| 034 audit feed & acknowledgement | B19, B21–B26 | **Terkonfirmasi** kecuali B23 **dibalik sebagian** (hanya `/system/audit` + export-nya memuat `machine_id`) |
| 035 MQTT configuration contract | B28–B44 | **Terkonfirmasi** kecuali B30 **dibalik** (provisioning → `/devices/provision`) dan B41 **sebagian** (`acknowledgeUnvalidated` tidak ada di dokumen) |
| 036 master data integrity | B45–B50 | **Terkonfirmasi seluruhnya** (6/6) |
| 037 access control read model | B8–B10, B12–B15 | **Terkonfirmasi** kecuali B12 **sebagian** (kode 404 + perilaku tanpa-assignment tidak dinyatakan) |
| 038 health & runtime info | B20, B27 | **Terkonfirmasi seluruhnya** |

### 3.3 Delegasi E18 (7 gap + enum)

| Keputusan delegasi | Status vs api_docs baru |
|---|---|
| B1 camelCase kanonis + `subjectMatch` terstruktur | **Terkonfirmasi** — §3.4:1511, :1524 |
| B3 ABAC scope minimal | **Sebagian** — grammar + 1 contoh ada (:1502, :1520); whitelist lengkap tidak ada; pesan 400 menyebut atribut tidak dinyatakan (R-1) |
| B4 alur paksa `mustChangePassword` | **Terkonfirmasi**, dengan koreksi kode: gerbang `403 PASSWORD_ROTATION_REQUIRED`, bukan "401 khusus" seperti redaksi E18 |
| B6 publikasikan skema respons IAM | **Sebagian** — 5 bentuk baca ada (:1549–1553); `/info` + `/audit` belum |
| B7 hapus role ter-assign → `409 ROLE_IN_USE` | **Terkonfirmasi** — :1558 |
| B16 samakan ke server 5/60 + `Retry-After` | **Terkonfirmasi persis** — §L:1225–1227 |
| Enum `event_type` tertutup | **Terkonfirmasi** — 32 nilai eksplisit + 3 keluarga pola (§I:1073–1075) |

## 4. Close-list untuk parent (terapkan setelah verifikasi independen)

**Tutup 36 issue (FAT-72–FAT-121, kecuali yang terbuka di bawah):**

| Verdict | Gap (FAT) | Bukti ringkas |
|---|---|---|
| Terselesaikan (34) | B1 (FAT-72), B2 (FAT-73), B4 (FAT-75), B5 (FAT-76), B7 (FAT-78), B8 (FAT-79), B9 (FAT-80), B10 (FAT-81), B14 (FAT-85), B15 (FAT-86), B16 (FAT-87), B18 (FAT-89), B19 (FAT-90), B20 (FAT-91), B21 (FAT-92), B22 (FAT-93), B24 (FAT-95), B25 (FAT-96), B26 (FAT-97), B27 (FAT-98), B28 (FAT-99), B29 (FAT-100), B38 (FAT-109), B39 (FAT-110), B40 (FAT-111), B42 (FAT-113), B43 (FAT-114), B44 (FAT-115), B45 (FAT-116), B46 (FAT-117), B47 (FAT-118), B48 (FAT-119), B49 (FAT-120), B50 (FAT-121) | Per gap di §2 |
| Berubah/digantikan (2) | B13 (FAT-84) — `reason` hanya di audit IAM, tidak pernah di baris policy (§3.4:1507); B30 (FAT-101) — provisioning kini `POST /devices/provision` tanpa field `access` (§E.3a:442–478) | Per gap di §2 |

**Tetap Todo (14):** B3 (FAT-74), B6 (FAT-77), B11 (FAT-82), B12 (FAT-83), B17 (FAT-88), B23 (FAT-94), B31 (FAT-102), B32 (FAT-103), B33 (FAT-104), B34 (FAT-105), B35 (FAT-106), B36 (FAT-107), B37 (FAT-108), B41 (FAT-112).

Catatan: "Tutup" di sini berarti **implementasi backend tercermin di api_docs
terupdate** — bukan bukti terhadap backend yang sedang berjalan. Verifikasi
terhadap backend sungguhan (Real E2E, V8.2/FAT-28) tetap menjadi langkah
terpisah; bila backend nyata menyimpang dari api_docs, issue yang ditutup
dapat dibuka kembali dengan bukti divergensi.

## 5. Daftar tindak lanjut backend

### 5.1 Status R-1–R-15 (dari `API_SYNC_REVIEW.md` §2)

| Item | Status E21 | Bukti / yang masih ditunggu |
|---|---|---|
| R-1 Daftar atribut ABAC | **MASIH TERBUKA** | §3.4:1502 tanpa enumerasi; contoh tunggal `subject.line_id` (:1520). Tunggu daftar lengkap spec 032/024 |
| R-2 Kanon `/auth/me` | **MASIH TERBUKA** | Tiga varian masih berdampingan (:1245, :1554, :1984); `effectiveRoles` dipakai §L tapi dilarang untuk subjects (:1553, C7) |
| R-3 Cancel WO | **BERUBAH (amandemen 09:23, belum terverifikasi di dokumen)** | `authorize("cancel", "work_order")` (ADMIN) hanya di DIFF §18; file masih §C.6 vs §7H. Tunggu salinan api_docs baru (R-23) |
| R-4 Mutasi operators | **MASIH TERBUKA** | §H:861 (ADMIN) vs §H.3/:973/:986 (ADMIN/SUPERVISOR); nuansa baru §H.4:940 PUT = "ADMIN LAN only" — D-7 perlu ditinjau ulang untuk PUT |
| R-5 404 mesin tanpa device | **MASIH TERBUKA** | §Q intro:1708 `MACHINE_NOT_BOUND` vs §Q.2:~1740 `NOT_FOUND` |
| R-6 `OFFLINE` nilai item | **MASIH TERBUKA** | §F.8:720 (filter) vs FSM kanonis §6A:1947–1954 (6 nilai, tanpa `OFFLINE`) |
| R-7 `oeePct` saat Performance null | **TERJAWAB** | §K:1163 + §K.3c:1194 — aturan null sudah tertulis (koreksi penilaian E20 awal) |
| R-8 PUT /policies casing | **MASIH TERBUKA** | §3.4:1491 (snake_case) vs :1511 (kanon camelCase) |
| R-9 §M dibersihkan | **BERUBAH SEBAGIAN (amandemen 09:23, belum terverifikasi di dokumen)** | cURL diperbaiki menurut DIFF §18, tapi heading §M:1317 masih `POST /clients {deviceId, access, …}`; file baris 1340 masih `/clients/provision`. Tunggu salinan baru + bersihkan sisa heading |
| R-10 Param tak dikenal di luar `/system/audit` | **MASIH TERBUKA** | Klausul abaikan hanya §I:~1076; endpoint lain tanpa klausul |
| R-11 Guard ekspor | **TERJAWAB** | Kedua guard tertulis eksplisit (§I:1081 vs :1085–1087) — bukan kontradiksi, memang dua guard berbeda |
| R-12 Tabel error §2 | **MASIH TERBUKA** | Tabel :44–62 tidak memuat `ROLE_IMMUTABLE`, `PASSWORD_ROTATION_REQUIRED`, `WEAK_PASSWORD`, `AUTHZ_STALE`/`SUBJECT_INACTIVE`, `MQTT_*` |
| R-13 Mutasi 204 | **MASIH TERBUKA** | §6B:1988 ("tidak ada mutasi 204") vs §M 7× DELETE → 204 |
| R-14 Nama field password `POST /clients` | **MASIH TERBUKA** (minor) | Grep `generatedPassword` = 0; panel baca defensif, prioritas rendah (panel ikut §E.3a) |
| R-15 `isOnline` tak terverifikasi | **TERJAWAB** | Premis salah: `DeviceResponse` membawa `lastSeenAt` (§E:~412; §E.3a:~470); TTL §7E:2061 (`DEVICE_PRESENCE_TTL_SEC=300`). Verifikasi saat Real E2E bahwa backend sungguhan mengirimnya |

### 5.2 Status C1–C22 (dari `API_SYNC_DIFF.md`)

Terjawab: C13 (premis salah — `lastSeenAt` ada), C14 (aturan null §K:1163),
C15 (`PASSWORD_CHANGE_REQUIRED` 0 hit; yang ada flag + 403), C18 (dua guard
tertulis eksplisit). Berubah (amandemen 09:23, belum terverifikasi di dokumen):
C1/C5 sebagian (cURL §M), C8 (cancel ADMIN), C21 (§M ke model
`authorize(...)`). Masih terbuka: C2, C3, C4, C6, C7, C9, C11, C12, C16, C17,
C19, C20, C22. Fakta tanpa tindak lanjut: C10 (konvensi penamaan snake_case
WO vs camelCase devices/machines memang diakui dokumen).

### 5.3 Item tindak lanjut BARU (R-16–R-23, didefinisikan di E21)

| Item | Asal | Yang ditunggu dari backend |
|---|---|---|
| **R-16** `acknowledgeUnvalidated` | B41 | Tetapkan di §3.3b: kapan wajib, error bila absen, apakah dihormati — atau nyatakan resmi field itu tidak ada. 0 kemunculan di 2100 baris |
| **R-17** PUT `/operators` ADMIN-only vs D-7 | R-4 nuansa baru (§H.4:940) | Konfirmasi apakah PUT memang ADMIN-only sementara POST/PATCH ADMIN/SUPERVISOR; D-7 ditinjau ulang untuk PUT bila ya |
| **R-18** `machine_id` di list/ekspor global operational-events | B23 | Konfirmasi apakah ketiadaan `machine_id` di list global (:1007–1018) + ekspor global (:1085–1091) itu sengaja (arahkan ke `/system/audit`) atau kelalaian dokumen |
| **R-19** Filter `acknowledged` di `/system/audit` | B22 residual | Konfirmasi apakah `acknowledged` didukung di `/system/audit` (:1072) + export-nya (:1082) atau hanya di operational-events |
| **R-20** Skema body sub-op dynsec + skema objek klien | B31–B37 (kecuali B34 → R-14) | Publikasikan skema body `POST /clients/{name}/roles`, `POST /roles/{name}/acls`, `POST /groups/{name}/clients`, `POST /groups/{name}/roles` (K-05), aturan password klien dynsec min-8/auto-generate (B33), dan bentuk objek klien `enabled`/`disabled` (B35) |
| **R-21** Skema `GET /info` + `GET /access-control/audit` | B6/B11/B12 | Daftar field + contoh respons; limit + paginasi/cursor audit IAM; bentuk baris audit tempat `reason` terlihat; kode 404 inspector + perilaku operator tanpa assignment |
| **R-22** Filter `operatorId`/`roleId` user-roles/policies | B17 | Konfirmasi apakah `GET /user-roles?operatorId=` dan `GET /policies?roleId=` didukung; apakah kedua list tanpa paginasi di semua ukuran data |
| **R-23** Salinan api_docs baru (memuat amandemen 09:23) | §7 | Salinan yang memuat `authorize(...)`, cURL §M diperbaiki, dan `GET /api/v1/system/access-mode` — menutup definitif R-3/C8/C21/R-9 dan memverifikasi endpoint access-mode |

### 5.4 Daftar tindak lanjut backend diprioritaskan

**P0 — menggating perilaku panel (jawaban salah = panel berbohong di Real mode):**
R-1/C11 (daftar atribut ABAC), R-2/C3/C7 (kanon `/auth/me`),
R-4/C16 + R-17 (otorisasi mutasi operators per endpoint, termasuk PUT),
R-6/C12 (`OFFLINE` nilai item vs filter), R-20 (skema dynsec — 7 gap),
R-23 (salinan api_docs baru).

**P1 — kontrak yang perlu dibersihkan di dokumen (panel sudah punya keputusan
sementara):** R-9/C1/C5 (bersihkan §M), R-3/C8 + C21 (sinkronkan amandemen
09:23 ke dokumen), R-8/C4 (PUT /policies casing), R-10/C17 (klausul abaikan
parameter), R-5/C9 (kode 404), R-18 (machine_id global), R-19
(`acknowledged` di `/system/audit`), R-16 (`acknowledgeUnvalidated`),
R-21 (skema info/audit), R-22 (filter user-roles/policies).

**P2 — dokumen saja (minor; panel sudah tangani dengan benar):** R-12/C19
(tabel error §2), R-13/C2 (mutasi 204), R-14 (nama field password
`POST /clients`), C6 (baris ack duplikat §6B), C22 (rezim 429), C20
(redaksi `must_change_password` — rujuk dokumen asli bila tersedia).

## 6. Koreksi terhadap penilaian E20 awal

1. **R-7/C14 ternyata sudah terjawab di dokumen** — aturan null `oeePct` ada di
   §K baris 1163 (hanya tersebar dari §K.3c baris 1194). D-8 didukung dokumen.
2. **R-15/C13 premisnya salah** — `DeviceResponse` membawa `lastSeenAt`
   (§E baris ~412); klien dapat memverifikasi proyeksi TTL. Bukan item terbuka.
3. **Enum `event_type` eksplisit = 32, bukan 33** — terverifikasi hitung token
   (§I baris 1073–1075). Implementasi panel E20 sudah benar 32.
4. **D-7 perlu ditinjau ulang untuk PUT** — §H.4 baris 940 menulis PUT operator
   "ADMIN LAN only", sementara POST/PATCH ADMIN/SUPERVISOR (R-4/R-17).
5. **B23 dibalik sebagian** — keputusan 18 Nov (machine_id di list global +
   ekspor) tidak tercermin penuh di api_docs; hanya `/system/audit` yang
   memuatnya.
6. **K-05/K-06 tidak terkonfirmasi dokumen baru** — api_docs tidak memuat
   skema body sub-op dynsec maupun skema objek klien; keputusan itu bersandar
   pada Guide lama.

## 7. Catatan metodologi — salinan file vs amandemen 09:23

- File sumber kebenaran tugas ini, `~/workspace/user/files/pasted-text.txt`,
  bermtime **19 Nov 00:47 UTC (= 07:47 WIB)** — salinan upload asli Fathur.
  Amandemen 09:23 (dikirim Fathur sebagai kutipan chat, dicatat di
  `API_SYNC_DIFF.md` §18) **tidak ada dalam file ini**: grep `access-mode` =
  0 hit, grep `authorize("cancel"` = 0 hit, baris 1340 masih
  `/clients/provision`, baris 1319 masih `POST /clients {deviceId, access, …}`.
- Semua verdict dalam dokumen ini — kecuali yang ditandai "(amandemen 09:23,
  belum terverifikasi di dokumen)" — didasarkan pada isi file tersebut.
  Verdict yang bersandar pada amandemen: R-3/C8 (cancel ADMIN), C21 (§M ke
  model `authorize(...)`), R-9/C1/C5 sebagian (cURL §M), dan keberadaan
  endpoint `GET /api/v1/system/access-mode` (diimplementasikan E20 Batch 4
  berdasarkan amandemen; A10.2 keseluruhan tetap belum terbuka).
- **Penutupan definitif** untuk butir-butir itu menunggu salinan api_docs baru
  dari Fathur/backend (R-23). Sampai salinan itu ada, close-list §4 tidak
  mencakup R-3/C8/C21/R-9 — dan gap yang verdictnya bersandar pada amandemen
  tidak ada di §4 (tidak ada gap B yang verdictnya semata-mata amandemen;
  B30 didasarkan pada §E.3a di dalam file, bukan pada amandemen).
- File scratch verifikasi per kelompok: `~/workspace/tmp-e21-iam.md`,
  `~/workspace/tmp-e21-audit.md`, `~/workspace/tmp-e21-dynsec.md`,
  `~/workspace/tmp-e21-config.md`, `~/workspace/tmp-e21-master.md`,
  `~/workspace/tmp-e21-ritems.md`.
