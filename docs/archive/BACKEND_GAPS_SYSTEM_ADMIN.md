# Gap Backend — Fungsionalitas System Admin

> **DIARSIPKAN 2026-11-19 (E20/P20.7):** dokumen ini digantikan oleh API docs
> terupdate (`~/workspace/user/files/pasted-text.txt`) sebagai sumber kebenaran,
> ditambah `docs/API_SYNC_DIFF.md` (diff panel vs api_docs) dan
> `docs/API_SYNC_REVIEW.md` (diff yang perlu ditinjau kembali). Seluruh 50 gap
> sudah tertutup keputusannya (lihat section "Status seluruh gap" di bawah).
> Dokumen ini dipertahankan sebagai **riwayat** keputusan backend 18 Nov 2026
> + delegasi E18 — bukan lagi dokumen kerja aktif.

> **Status:** dokumen gap untuk tim backend. Bukan implementasi panel.
> **Tanggal:** 2026-11-17. **Epic Linear:** E13 (FAT-71), child SYS-B1–SYS-B50 (FAT-72–FAT-121).
> **Cakupan:** System Admin SAJA — IAM/Access Control + Auth, System Audit +
> Health/Info, MQTT admin (Dynamic Security + Configuration + Overview), master
> data Production Lines/Shifts/Shift Schedules, Operators.
> **Dikecualikan:** infra jaringan (Nginx dual-vhost, port, TLS, tunnel,
> klasifikasi kanal); mode akses Private/Public — sudah tercakup
> `docs/BACKEND_REQUIREMENTS_ACCESS_MODE.md` (B1–B25 + V1–V12), tidak
> diduplikasi di sini; telemetry/OEE/analytics — sudah diaudit E11/E12
> (AUDIT.md §14–§15).
>
> **Dokumen acuan:** `API_DOCUMENTATION.md` (disebut "API"), `ADMIN_PANEL_BUILD_GUIDE.md`
> (disebut "Guide"), repo `AUDIT.md`, `docs/BACKEND_REQUIREMENTS_ACCESS_MODE.md`.
> File dokumen API/Guide yang dimaksud adalah berkas di `~/workspace/user/files/`.
>
> **Cara baca:** setiap gap punya severity (High/Medium/Low), perilaku panel yang
> terdampak (file + baris), acuan dokumen, apa yang hilang/tidak cocok, perubahan
> backend yang dibutuhkan, dan acceptance criteria. Beberapa gap terutama butuh
> **keputusan/ketetapan dokumen** dari backend (sumber kebenaran), bukan kode
> backend baru — itu tetap dicatat sebagai gap karena tanpa keputusan itu panel
> tidak bisa dibuat benar di mode Real.
>
> **Peringatan verifikasi:** Demo menutupi sebagian besar gap di bawah (filter
> in-memory, seed yang mengarang field/kode error, health sintetis, apply
> sinkron). **Tidak satu pun acceptance criteria di bawah boleh diuji melawan
> Demo** — semuanya harus diuji melawan backend sungguhan di mode Real.
>
> **Verifikasi laporan ini:** temuan High di-spot-check independen ke kode dan
> dokumen (2026-11-17): rotasi password POST vs PATCH (`http/mqttDynsec.ts`
> vs `endpoints/mqtt.ts`), toggle `{disabled}` vs `{enabled}`, `accessMap`
> `telemetry`/`telemetry+state`, body `{roles:[...]}`, body policy snake_case,
> sintesis health (`http/health.ts`), `OperationalEventItem` tanpa skema field
> (API §I hanya menulis nama tipe), `mustChangePassword` tidak dipakai di
> seluruh `src/`, filter schedule API snake_case vs Guide camelCase (kontradiksi
> langsung), trailing slash config (API: "Wajib trailing slash").
>
> **Keputusan backend (18 November 2026):** gap yang tercakup lima modul
> remediasi sudah final dan dicatat di
> [Keputusan backend — 18 November 2026](#keputusan-backend--18-november-2026).
> Pertanyaan terbuka yang sudah terjawab ditandai di
> [Pertanyaan terbuka](#pertanyaan-terbuka-status-per-18-november-2026--tidak-ditebak).
> **Status seluruh gap:** semua 50 gap kini memiliki disposisi tercatat —
> lihat [Status seluruh gap — 18 November 2026 (semua tertutup)](#status-seluruh-gap--18-november-2026-semua-tertutup).

## Status seluruh gap — 18 November 2026 (semua tertutup)

> **50/50 gap memiliki disposisi tercatat; 0 gap tanpa keputusan.**
> "Tertutup" di sini berarti **keputusan tercatat** — BUKAN implementasi
> selesai. Implementasi backend belum dimulai; **SYS-B1–SYS-B50 tetap
> Todo di Linear (E13, FAT-71)** sampai backend mengimplementasikannya
> dan acceptance criteria tiap gap lolos di mode Real. Tindak lanjut
> panel (P-A–P-J) disetujui di E18 tetapi belum diimplementasikan —
> menjadi epic berikut. Disposisi: **Backend 18 Nov** = diputuskan
> backend 18 Nov 2026 (lima modul specs/034–038); **Delegasi E18** =
> diputuskan via delegasi Fathur ke Muse, 18 Nov 2026 malam; **Panel-side**
> = tidak butuh keputusan backend, dikerjakan/dikerjakan panel.

| Gap | Disposisi | Keputusan / status |
| --- | --- | --- |
| SYS-B1 | Diputuskan (delegasi E18) | Body policy **camelCase kanonis** + `subjectMatch` terstruktur; satu casing, panel menyesuaikan mapper |
| SYS-B2 | Panel-side — selesai (E14) | Panel mengirim **PUT** sejak E14 P14.2 (17 Nov); catatan "panel mengirim PATCH" di bagian 18 Nov basi |
| SYS-B3 | Diputuskan (delegasi E18) | Lanjutkan ABAC, **scope minimal**: grammar + contoh `abac_condition` valid + pesan 400 yang menyebut atribut |
| SYS-B4 | Diputuskan (delegasi E18) | Dukung **alur paksa** `mustChangePassword` (satu alur: login → 401 khusus → ganti → login ulang) |
| SYS-B5 | Panel-side — selesai (E14) | Panel mengirim **PUT** sejak E14 P14.2 (17 Nov); catatan "panel mengirim PATCH" di bagian 18 Nov basi |
| SYS-B6 | Diputuskan (delegasi E18) | **Publikasikan skema respons IAM lengkap** (Fase 3); panel berhenti menebak field dengan default diam-diam |
| SYS-B7 | Diputuskan (delegasi E18) | Hapus role yang masih ter-assign → **`409 ROLE_IN_USE`** (konsisten B49/B50) |
| SYS-B8 | Diputuskan (backend 18 Nov) | Katalog: `access_control.read` + `access_control.manage` terpisah; panel tambah `read`, berhenti memakai kunci karangan |
| SYS-B9 | Diputuskan (backend 18 Nov) | `effectiveInMode` = nilai `mode`; detail per-domain di `enforcedDomains` + `/auth/me`; tanpa nilai `partial` |
| SYS-B10 | Diputuskan (backend 18 Nov) | `POST /permissions` **didukung**, body camelCase; duplikat → `409 PERMISSION_EXISTS`; tanpa rute penjaga → `400 INERT_PERMISSION` (K-09) |
| SYS-B11 | Panel-side — tindak lanjut (P-D) | Backend dukung filter + limit s.d. 1000; **panel kirim filter server-side** (epic berikut) |
| SYS-B12 | Diputuskan (backend 18 Nov) | Inspector: `roles` (satu nama) + `operatorId`, `primaryRole`, `isActive`, `isProtected`, `authzVersion`, `effectiveInMode`, `assignments`, `permissions`; subjek hilang → 404 |
| SYS-B13 | Diputuskan (backend 18 Nov) | `reason` tersimpan di audit IAM, tidak dikembalikan pada baris policy; dokumen menyatakan lokasinya |
| SYS-B14 | Diputuskan (backend 18 Nov) | Revoke assignment tidak ada → `200 {success:true, removed:0}`; revoke sukses menulis audit dengan aktor + reason |
| SYS-B15 | Diputuskan (backend 18 Nov) | Refresh membawa `authzVersion` dari identitas yang dibaca ulang; 401 `AUTHZ_STALE`/`SUBJECT_INACTIVE` tetap |
| SYS-B16 | Diputuskan (delegasi E18) | **Samakan ke server 5/60 + `Retry-After`**; satu sumber kebenaran (server) |
| SYS-B17 | Panel-side — tindak lanjut (P-E) | Panel kirim filter `operatorId`/`roleId` setelah verifikasi dukungan backend (epic berikut) |
| SYS-B18 | Panel-side — tindak lanjut (P-F) | Panel sesuaikan aturan anti-eskalasi ke backend (epic berikut) |
| SYS-B19 | Diputuskan (backend 18 Nov) | `/system/audit` = feed operasional; item membawa `acknowledged` (dari `acknowledgedAt`) + `machineName`; tanpa `actor`/`action`/`resource` karangan |
| SYS-B20 | Diputuskan (backend 18 Nov) | `GET /health` tetap ringkas; **`GET /health/detail`** baru (ADMIN+LAN) dengan latensi terukur per komponen (panel P-I tertunda) |
| SYS-B21 | Diputuskan (backend 18 Nov) | Ack `{note?}`; aktor dari JWT; ack kedua idempotent (K-14) |
| SYS-B22 | Diputuskan (backend 18 Nov) | Filter `acknowledged` didukung server-side; `severity` **tidak didukung**, parameter diabaikan + didokumentasikan |
| SYS-B23 | Diputuskan (backend 18 Nov) | `machine_id` didukung (list global, per-device, `/system/audit`, export) |
| SYS-B24 | Diputuskan (backend 18 Nov) | `GET /system/audit` terima + filter `event_type` server-side |
| SYS-B25 | Diputuskan (backend 18 Nov) | Envelope `{data, meta}`; `count` = **jumlah baris halaman**, bukan total dataset |
| SYS-B26 | Diputuskan (backend 18 Nov) | **`GET /system/audit/export`** baru (filter + retensi sama seperti list; panel P-J disetujui) |
| SYS-B27 | Diputuskan (backend 18 Nov) | `/health/detail` membawa `name`, `version`, `environment`, `commit` opsional; tanpa path internal |
| SYS-B28 | Diputuskan (backend 18 Nov) | **`PATCH /clients/:name/password`** (cocok dengan E14) |
| SYS-B29 | Diputuskan (backend 18 Nov) | **`PATCH /clients/:name/enable {enabled}`** (cocok dengan E14) |
| SYS-B30 | Diputuskan (backend 18 Nov) | `access` diterima **verbatim** (`publish`/`subscribe`/`readwrite`); panel hapus `accessMap` (P-B disetujui) |
| SYS-B31 | Diputuskan (backend 18 Nov) | Body tunggal `{rolename, priority?}` (cocok dengan E15) |
| SYS-B32 | Diputuskan (backend 18 Nov) | Objek ACL tunggal `{acltype, topic, allow, priority?}` (cocok dengan E15) |
| SYS-B33 | Diputuskan (backend 18 Nov) | `password` **wajib min 8**; tanpa auto-generate; panel wajib mengisi, tidak mengirim string kosong |
| SYS-B34 | Diputuskan (backend 18 Nov) | Respons `POST /clients`: objek klien + password sekali tampil; `GET /clients/:name` tidak lagi memuat password |
| SYS-B35 | Diputuskan (backend 18 Nov) | Respons klien memakai **`disabled`** (kanonis); mapper panel sudah cocok dengan keduanya |
| SYS-B36 | Diputuskan (backend 18 Nov) | Body tunggal `{username, priority?}` (cocok dengan E15) |
| SYS-B37 | Diputuskan (backend 18 Nov) | Body tunggal `{rolename, priority?}` (cocok dengan E15) |
| SYS-B38 | Diputuskan (backend 18 Nov) | Rute config terima **dengan dan tanpa** trailing slash (K-03) |
| SYS-B39 | Diputuskan (backend 18 Nov) | `summary` diterima sebagai alias `reason` (reason prioritas); `baseVersionId` opsional, fallback versi APPLIED |
| SYS-B40 | Diputuskan (backend 18 Nov) | 422 membawa **`issues[]` + `details`** (K-04); tiap issue punya `field` + `message` |
| SYS-B41 | Diputuskan (backend 18 Nov) | Apply/rollback **async**; `acknowledgeUnvalidated` dihormati; panel polling sampai status terminal (P-C disetujui) |
| SYS-B42 | Diputuskan (backend 18 Nov) | `POST /backups` **tidak ada** (404); backup otomatis dibuat saat apply; `GET /backups` metadata saja |
| SYS-B43 | Diputuskan (backend 18 Nov) | HTTP memakai **bentuk panel** (adapter); field tanpa sumber nyata = `null` |
| SYS-B44 | Diputuskan (backend 18 Nov) | Overview diperkaya (counts DynSec, status config, `activeVersionId`, `lastAppliedAt`, `mutationLocked`, `measuredAt`); plugin nonaktif → `available:false`, bukan `IN_SYNC`/`0` |
| SYS-B45 | Diputuskan (backend 18 Nov) | Filter schedule **snake_case saja**; Guide diperbaiki; panel sudah snake_case |
| SYS-B46 | Diputuskan (backend 18 Nov) | List/detail schedule memuat `shiftName`, `shiftCode`, `startTime`, `endTime` dari join shift; shift hilang → `null`, bukan 500 |
| SYS-B47 | Diputuskan (backend 18 Nov) | `POST /operators` terima `isActive` opsional (default `true`); proteksi ADM-001 tetap (disable/ubah-role → 400, hapus → 403) |
| SYS-B48 | Diputuskan (backend 18 Nov) | List operator + DynSec kembalikan **array penuh**, tanpa truncasi diam-diam; batas praktis didokumentasikan |
| SYS-B49 | Diputuskan (backend 18 Nov) | Hapus line yang masih dipakai operator → **`409 PRODUCTION_LINE_IN_USE`** + `operatorId`; guard mesin + snapshot WO tetap |
| SYS-B50 | Diputuskan (backend 18 Nov) | Hapus shift terpakai → **`409 SHIFT_IN_USE`**; ubah jam shift → validasi overlap `409 SHIFT_TIME_OVERLAP` |

## Status panel pasca-audit — E14/E15 (17 November 2026)

> Perilaku panel yang tertulis di tiap gap di bawah adalah perilaku **saat
> audit** (2026-11-17 siang). Setelah audit, panel diubah mengikuti keputusan
> Fase 0 (E14: K-03/K-10/K-11; E15: K-05/K-06/K-07 — decision log Lampiran C
> `docs/BACKEND_UPGRADE_PLAN.md`, AUDIT.md §17–§18). Tabel ini mencatat
> perilaku panel **kini**; tugas backend yang tersisa tidak berubah kecuali
> dinyatakan lain.

| Gap | Perilaku panel saat audit | Perilaku panel kini | Tugas backend yang tersisa |
| --- | --- | --- | --- |
| B2 | `updateIamRole`/`updateIamPolicy` memakai PATCH | PUT (E14 P14.2) — sesuai dokumen | Sisa bentuk body/field (B1): nama field + casing body policy |
| B28 | Rotasi password memakai POST | PATCH (E14 P14.3) — sesuai dokumen | — (diputuskan K-10) |
| B29 | Toggle memakai POST + `{disabled}` | PATCH + `{enabled}` (E14 P14.3) — sesuai dokumen | — (diputuskan K-10) |
| B31 | `{roles:[{rolename, priority}]}` | `{rolename, priority}` (E15 P15.1) — sesuai Guide Lampiran A | Dokumentasikan/konfirmasi bentuk objek tunggal |
| B32 | `{acls:[acl]}` | Objek ACL tunggal (E15 P15.1) — sesuai Guide Lampiran A | Dokumentasikan apakah `allow`/`priority` didukung |
| B33 | Password kosong dikirim `""`; UI menjanjikan auto-generate | Password wajib min 8 di UI (E15 P15.2) — sesuai API §M + Guide §7.2 | Nyatakan apakah `textname`/`textdescription`/`groups`/`clientid` diterima |
| B35 | `mapMqttClient` membalik `{enabled:false}` | Mapper diperbaiki, benar untuk `enabled` maupun `disabled` (E15 P15.3) | Dokumentasikan field status yang dipakai backend |
| B36 | `{clients:[{username}]}` | `{username}` (E15 P15.1) — sesuai Guide Lampiran A | Dokumentasikan/konfirmasi bentuk objek tunggal |
| B37 | `{roles:[{rolename}]}` | `{rolename}` (E15 P15.1) — sesuai Guide Lampiran A | Dokumentasikan/konfirmasi bentuk objek tunggal |
| B38 | `GET /mqtt/configuration` tanpa trailing slash | Dengan trailing slash (E14 P14.1) — sesuai API §3.3b | — (diputuskan K-03) |
| B44 | `configuration: null` → tampil `IN_SYNC` | Status `UNAVAILABLE` (E15 P15.4) — sesuai API §3.3a | Dokumentasikan field dalam kedua objek overview |

Tidak berubah dari sisi panel (tetap menunggu keputusan/dokumentasi
backend): B1 (body policy), B3 (grammar ABAC), B30 (`accessMap` — panel
masih menulis ulang `access` menjadi `telemetry`/`telemetry+state`; backend
harus menerima nilai verbatim `publish`/`subscribe`/`readwrite`, item 2.3
rencana), B39 (body stage `{config, summary}`), B40 (panel hanya mem-parsing
`issues` — diputuskan K-04 (a)), B41 (tanpa `acknowledgeUnvalidated`,
polling sekali), B42 (`POST /backups` hantu), dan semua gap lain di luar
tabel.

## Ringkasan

**50 gap: 12 High, 23 Medium, 15 Low.** Registry endpoint panel lengkap
(59 kunci di irisan ini; 132 operasi admin secara keseluruhan — bertambah 1
sejak E14: `POST /clients/provision`) — **tidak ada
satu pun endpoint yang hilang dari registry**. Hampir semua gap adalah
ketidaksesuaian **bentuk kontrak** (body/method/field/filter/skema respons),
bukan endpoint yang belum didaftarkan.

Enam tema lintas-gap:

1. **Skema respons tidak tertulis** untuk hampir seluruh permukaan admin
   (B6, B12, B19, B20, B35, B43, B44). Panel menebak field dan menutup
   kekosongan dengan default diam-diam (`is_system → false`,
   `privilege_level → 1`, `created_at → epoch`, `access_mode → 'LAN'`,
   `mqtt.status → 'UP'`, `environment → 'production'`, latensi `0`). Di Real
   mode halaman bisa tampil salah tanpa error apa pun.
2. **Panel mengirim snake_case / array jamak; dokumen menetapkan camelCase /
   objek tunggal.** Berulang sistematis: policy IAM, sub-operasi dynsec
   (`{roles:[...]}`, `{acls:[...]}`, `{clients:[...]}` vs `{rolename}` /
   `{acltype, topic}` / `{username}`), stage config (`{config, summary}` vs
   `{config, baseVersionId?, reason?, comment?}`). Salah satu pihak harus
   berubah; backend harus menetapkan sumber kebenaran. **[Diperbarui 17 Nov
   2026 — E15/K-05: diputuskan (a) objek tunggal dokumen; panel sudah
   mengirim objek tunggal untuk sub-operasi dynsec. Yang tersisa adalah
   dokumentasi/konfirmasi backend; bagian policy IAM dan stage config belum
   berubah.]**
3. **Method salah di transport panel** (PATCH vs PUT di IAM, POST vs PATCH di
   dynsec). Bila backend mengikuti dokumen secara ketat, operasi ini gagal
   404/405 di Real mode. Perbaikan kode kemungkinan besar di panel — tapi
   keputusan "dokumen atau panel yang benar" harus datang dari backend.
4. **Filter yang dikirim panel tapi tidak ada di dokumen / bertentangan
   antar-dokumen** (B11, B17, B22, B23, B24, B45). Akar bersama: tidak ada
   dokumen yang menyatakan apakah query param tak dikenal **diabaikan atau
   ditolak 400** (Zod strict?). Satu keputusan backend soal ini menentukan
   dampak sekelompok gap.
5. **Demo menutupi kegagalan Real mode.** Filter in-memory, seed yang mengarang
   field/kode error, validasi karangan sendiri, health yang disintesis,
   apply/rollback sinkron.
6. **Kontradiksi dokumen-vs-dokumen** — dirangkum di § "Pertanyaan terbuka"
   di akhir dokumen (D-1/D-2 sudah diketahui AUDIT.md §3; ditambah D-3–D-7
   dan 15 keraguan lain).

## Urutan prioritas yang diusulkan untuk tim backend

1. Putuskan sumber kebenaran bentuk dynsec (B28–B32, B36, B37 + D-5/D-6).
2. Tetapkan skema body `POST/PUT /policies` + grammar ABAC (B1–B3), lalu
   publikasikan skema respons semua endpoint IAM (B6) dan tegaskan
   `mustChangePassword` (B4).
3. Lengkapi kontrak audit + health (B19, B20).
4. Lengkapi kontrak config broker (B38–B43).
5. Satu keputusan global soal query param tak dikenal + selaraskan filter yang
   bertentangan (B11, B17, B22–B24, B45).
6. Klarifikasi master data + operator (B46–B50).
7. Putuskan status `POST /permissions` dan perilaku hapus role ber-pemakaian
   (B7, B10) + daftar kanonis kunci capability `/auth/me` (B8, B9) + filter
   audit IAM (B11).

---

## A. IAM / Access Control / Auth

### SYS-B1 — POST `/access-control/policies`: body panel tidak cocok dengan kontrak backend; `subjectMatch` tidak pernah bisa diisi — High
- **Area:** Buat policy (tab Policies → CreatePolicyModal, `src/features/system/components/CreatePolicyModal.tsx`).
- **Perilaku panel:** `usePolicies.createPolicy` (`src/features/system/hooks/usePolicies.ts:50`) memanggil `createIamPolicy({role, eft, action, resource_pattern, abac_condition, is_active, reason})`; `httpIam.createIamPolicy` (`src/services/api/http/iam.ts:229-241`) mengirim body itu apa adanya (`{...data}`). `permissionId` dari template katalog dibuang, tidak dikirim.
- **Acuan dokumen:** Guide Lampiran K: `POST /policies {roleId, permissionId, resourcePattern, effect?, abacCondition?, enabled?, reason?}` → 201; API §3.4: "`subjectMatch` dan `abacCondition` divalidasi (grammar + whitelist atribut/operator) → 400 INVALID_POLICY; policy reserved → 403 RESERVED_PERMISSION".
- **Yang hilang/tidak cocok:** (a) `roleId` dan `permissionId` tidak pernah dikirim — panel tidak punya keduanya; (b) 4 nama field salah casing/nama: `resource_pattern` vs `resourcePattern`, `eft` vs `effect`, `abac_condition` vs `abacCondition`, `is_active` vs `enabled`; (c) `subjectMatch` tidak ada di UI maupun body — padahal API §3.4/Guide §4.6a menjadikan `subject_match` (`*` | `role:<nama>` | `operator:<id>`) kolom pertama policy Casbin; (d) panel tidak bisa membuat policy yang diwajibkan backend untuk reserved permission (`subject_match = operator:ADM-001`) — seed demo sendiri punya contohnya (`src/services/api/seeds/system.ts:194`, pol-01 `subject_match: 'operator:ADM-001'`, `action: '*'`, `resource_pattern: 'org:*'`) yang tidak bisa direproduksi lewat panel; (e) `openAssignFromPermission` (`useRolePermissions.ts`) untuk permission reserved malah men-default-kan role ke SUPERVISOR — pilihan yang dijamin 403 di backend.
- **Workaround demo:** `demoIam.createIamPolicy` (`src/services/api/demo/iam.ts`) menerima persis bentuk panel dan menyimpannya mentah tanpa validasi grammar/whitelist; guard reserved ditebak dari `role` + `action:resourceType`, bukan dari `subjectMatch`.
- **Perubahan backend yang dibutuhkan:** (1) Tetapkan dan dokumentasikan secara eksplisit skema body `POST /policies` di API §3.4 (saat ini hanya disebut "subjectMatch dan abacCondition divalidasi" tanpa skema body; Lampiran K menyebut `roleId`+`permissionId` tanpa `subjectMatch` — rekonsiliasi: apakah `subjectMatch` diturunkan dari `roleId`, atau wajib dikirim eksplisit?); (2) bila `subjectMatch` wajib eksplisit, terima `subjectMatch` pada create; (3) putuskan apakah `permissionId` wajib — bila ya, panel perlu mengirimnya (perubahan panel).
- **Acceptance criteria:** `POST /policies` dengan body persis seperti yang dikirim panel (setelah panel disesuaikan) → 201 dan policy tampil di `GET /policies` dengan `subjectMatch` yang benar; `POST /policies` dengan `subjectMatch: "operator:ADM-001"` + reserved permission berhasil; tanpa `subjectMatch` untuk reserved permission → 403 RESERVED_PERMISSION.

### SYS-B2 — PUT `/access-control/policies/:id` (+ toggle aktif/nonaktif): method PATCH vs PUT dan nama field salah — High
- **Area:** Edit policy & toggle status policy (tab Policies; `EditPolicyModal.tsx`).
- **Perilaku panel:** `httpIam.updateIamPolicy` (`src/services/api/http/iam.ts`, baris ~254) memakai method **PATCH**, padahal registry endpoint (`src/services/api/endpoints/iam.ts`, `IAM_POLICIES_UPDATE`) mendeklarasikan **PUT**. Body: `{eft, action, resource_pattern, abac_condition, reason}` (edit) atau `{is_active}` (toggle via `handleTogglePolicy` → `toggleIamPolicy`).
- **Acuan dokumen:** API §3.4: `PUT /policies/:id` — "Ubah `subjectMatch` / `resource_pattern` / `effect` / `abac_condition` / `enabled`"; Guide §8/Lampiran K sama (`{resourcePattern?, effect?, abacCondition?, enabled?, reason?}`).
- **Yang hilang/tidak cocok:** (a) method PATCH vs PUT — bila backend Fastify hanya mendaftarkan PUT, request panel 404/405; (b) `eft` vs `effect`, `resource_pattern` vs `resourcePattern`, `abac_condition` vs `abacCondition`, `is_active` vs `enabled`; (c) panel mengirim `action` — bukan field yang bisa diubah menurut dokumen (kemungkinan diabaikan atau 400 bila Zod strict); (d) panel tidak bisa mengubah `subjectMatch` (tidak ada field di `EditPolicyModal.tsx`) dan tidak bisa mengubah `enabled` lewat form edit (hanya lewat toggle yang salah nama field).
- **Workaround demo:** `demoIam.updateIamPolicy` menerima patch panel apa adanya dan `Object.assign(pol, patch)` mentah.
- **Perubahan backend yang dibutuhkan:** Tidak ada bila backend sudah PUT sesuai dokumen — ini terutama ketidakcocokan panel; TAPI backend perlu memastikan respons PUT mengembalikan policy utuh dengan field yang sama dengan `GET /policies` (agar mapper panel tidak menebak), dan mendokumentasikan apakah `action` boleh diubah atau tidak.
- **Acceptance criteria:** `PUT /policies/:id {effect, resourcePattern, abacCondition, enabled, reason}` → 200 + policy berubah; `PUT` dengan `effect: "DENY"` pada policy role ADMIN → ditolak (anti-lockout, API §3.4); toggle `enabled` lewat PUT tercermin di `GET /policies`.

### SYS-B3 — ABAC: grammar/atribut panel ≠ backend; placeholder panel justru contoh yang tidak valid — High
- **Area:** Semua input `abac_condition` (BindPermissionModal, CreatePolicyModal, EditPolicyModal).
- **Perilaku panel:** `parseAbacCondition` (`src/features/system/iamValidation.ts:11-30`) hanya memeriksa "JSON valid dan berupa objek" — tidak memvalidasi struktur AST (`all`/`any`/`not`), whitelist atribut, atau satu-comparator-per-leaf. Placeholder di kedua modal adalah `'{"line_id": "LINE-01"}'` — bentuk flat key-value. Whitelist panel di `src/utils/capabilities/abac.ts:9-20`: `networkMode, subjectActive, actorLineId, resourceLineId, windowDays, department, operatorId, machineId, deviceId, role`.
- **Acuan dokumen:** Guide §4.6b + API §3.4: `abac_condition` adalah predikat JSON terstruktur — operator `all`/`any`/`not`, comparator `eq/neq/in/contains/prefix/suffix` (tepat satu per leaf), whitelist 10 atribut: `ingress_source, subject_active, subject.line_id, subject.operator_id, subject.roles, resource.state, resource.line_id, resource.machine_id, resource.device_id, resource.owner_id`. Atribut/operator tak dikenal atau leaf multi-comparator → 400 INVALID_POLICY (jalur tulis) / DENY (jalur evaluasi).
- **Yang hilang/tidak cocok:** (a) tidak ada satu pun nama atribut panel yang sama persis dengan whitelist backend (`subjectActive` vs `subject_active`, `actorLineId` vs `subject.line_id`, `networkMode` vs `ingress_source`, dst.); (b) placeholder `{"line_id": "LINE-01"}` tidak punya kunci `attr`, atribut `line_id` tidak ada di whitelist → 400 INVALID_POLICY di Real; (c) seed demo (`src/services/api/seeds/system.ts`, pol-02) memakai `{attr:'department',...}` dan `{attr:'networkMode', eq:'LAN'}` — keduanya tidak ada di whitelist backend, jadi policy seed demo tidak bisa diputar ulang ke backend; (d) panel tidak memberi tahu admin format yang benar sebelum submit.
- **Workaround demo:** `demoIam.createIamPolicy`/`addIamRolePermission` menyimpan `abacCondition` mentah tanpa validasi apa pun; `validateAbacCondition` (abac.ts) hanya dipakai di jalur evaluasi `matchAbacCondition`, bukan di jalur simpan — policy ABAC invalid tersimpan di demo dan baru gagal (DENY) saat dievaluasi.
- **Perubahan backend yang dibutuhkan:** (1) Dokumentasikan di API §3.4 contoh `abac_condition` yang valid secara lengkap (saat ini hanya disebut whitelist-nya di Guide §4.6b); (2) pastikan pesan 400 INVALID_POLICY menyebut atribut/operator mana yang ditolak; (3) bila ada atribut tambahan yang memang didukung (mis. `department`), tambahkan ke whitelist terdokumentasi — jangan biarkan panel menebak.
- **Acceptance criteria:** `POST /policies` dengan `abacCondition: {all:[{attr:"subject.line_id",eq:"LINE-01"}]}` → 201; dengan `{"line_id":"LINE-01"}` atau `{attr:"department",eq:"production"}` → 400 INVALID_POLICY dengan pesan yang menyebut atributnya.

### SYS-B4 — GET `/auth/me`: `mustChangePassword` / `isActive` / `isProtected` dibuang; tidak ada alur ganti-password-wajib — High
- **Area:** Auth/session (login → `AuthContext`, Topbar ganti password).
- **Perilaku panel:** `mapAuthMe` (`src/services/api/http/mappers/system.ts`) hanya membaca `operator.{id|operator_id, username|name, role, lineId|line_id}`, `primaryRole`, `effectiveRoles`, `authzVersion`, `catalogueVersion`, `mode`, `capabilities`. Tidak ada satu pun pemakaian `mustChangePassword`, `isActive`, atau `isProtected` di seluruh `src` (grep kosong). `AuthContext.login` (`src/context/AuthContext.tsx:130-150`) langsung menganggap login sukses dan navigasi ke `/admin`; ganti password hanya tersedia manual lewat Topbar (`src/layouts/Topbar.tsx:74`, tanpa validasi min-8 client-side dan tanpa field konfirmasi).
- **Acuan dokumen:** API §L `GET /auth/me` mengembalikan `operator: {id, username, primaryRole, lineId, isActive, isProtected, mustChangePassword}` dan `authz: {...}`; `401` (`SUBJECT_INACTIVE`, `AUTHZ_STALE`).
- **Yang hilang/tidak cocok:** (a) bila backend menandai `mustChangePassword: true` (mis. akun baru hasil bootstrap `BOOTSTRAP_ADMIN_PASSWORD`, API §024), panel tidak memaksa ganti password — admin bisa bekerja dengan password bootstrap selamanya; (b) `isActive=false` / `isProtected` dari `/auth/me` tidak dipakai untuk menonaktifkan UI atau memberi pesan yang berbeda dari 401 generik; (c) `primaryRole` di §L berada **di dalam** objek `operator`, sedangkan `mapAuthMe` membacanya dari `r.primaryRole` / `authz.primaryRole` dan hanya memakai `operator.role` sebagai fallback terakhir — bila backend hanya mengirim `operator.primaryRole` tanpa `operator.role`, panel men-default-kan `primaryRole` ke `'OPERATOR'`.
- **Workaround demo:** `demoAuth.getAuthMe` (`src/services/api/demo/auth.ts`) tidak pernah mengembalikan `mustChangePassword`/`isActive`/`isProtected` (skema `AuthMeResponseSchema` di `src/services/api/schemas/dto.ts` pun tidak punya field-field itu).
- **Perubahan backend yang dibutuhkan:** (1) Pastikan `GET /auth/me` selalu mengembalikan `mustChangePassword`, `isActive`, `isProtected` (dan dokumentasikan maknanya + apa yang harus dilakukan klien bila `mustChangePassword=true` — blokir semua halaman sampai ganti password, atau hanya peringatan?); (2) dokumentasikan kode 401 `SUBJECT_INACTIVE` vs `AUTHZ_STALE` secara eksplisit (kapan masing-masing keluar, apakah `AUTHZ_STALE` berarti "refetch /auth/me" atau "login ulang" — Guide §4.6h bilang login ulang, API §L hanya menulis kodenya).
- **Acceptance criteria:** Login sebagai operator dengan `mustChangePassword=true` → panel (setelah diperbaiki) menampilkan alur ganti password wajib sebelum masuk dashboard; `GET /auth/me` untuk operator nonaktif → 401 SUBJECT_INACTIVE; token lama setelah `authz_version` naik di mode enforce → 401 AUTHZ_STALE dan panel mengarahkan login ulang.

### SYS-B5 — PUT `/access-control/roles/:id`: panel mengirim PATCH; deskripsi saja yang benar — Medium
- **Area:** Edit role (`EditRoleModal.tsx`).
- **Perilaku panel:** `httpIam.updateIamRole` (`src/services/api/http/iam.ts`, baris ~61) memakai method **PATCH** dengan body `{description?}` (level sengaja tidak dikirim — benar per §4.6g); registry (`src/services/api/endpoints/iam.ts`, `IAM_ROLES_UPDATE`) mendeklarasikan **PUT**.
- **Acuan dokumen:** API §3.4 + Guide Lampiran K: `PUT /roles/:id {description?, reason?}` → 200; 404.
- **Yang hilang/tidak cocok:** method PATCH vs PUT (risiko 404/405 yang sama seperti SYS-B2); `reason` tidak pernah dikumpulkan panel (tidak ada input reason di `EditRoleModal.tsx`) sehingga audit trail alasan perubahan role kosong.
- **Workaround demo:** `demoIam.updateIamRole` menerima patch panel apa adanya.
- **Perubahan backend yang dibutuhkan:** Dokumentasikan dengan tegas apakah hanya PUT yang didukung (atau terima juga PATCH); terima `reason` opsional bila dikirim.
- **Acceptance criteria:** `PUT /roles/:id {description, reason}` → 200 dan deskripsi berubah di `GET /roles`; `PATCH` (bila tidak didukung) terdokumentasi sebagai tidak didukung.

### SYS-B6 — Bentuk respons GET `/roles`, `/permissions`, `/policies`, `/user-roles`, `/subjects/...`, `/info` tidak dispesifikasi field-per-field; panel menebak dan memberi default diam-diam — Medium
- **Area:** Seluruh mapper IAM (`src/services/api/http/mappers/system.ts`: `mapIamRole`, `mapIamPermission`, `mapIamAssignment`, `mapIamPolicy`, `mapIamSubjectEffectivePermissions`, `mapIamInfo`).
- **Perilaku panel:** Mapper menebak field dengan default sunyi: `is_system` → `false` bila absen; `privilege_level` → `1`; `created_at` → epoch (`1970-01-01`, via `iso()` di `primitives.ts`); `policy_count` → `0`/`undefined`; `operator_name` → `''`; `subject_match`/`role_id`/`permission_id` → `undefined`. Perilaku UI bergantung pada field tebakan ini: `RolesTab.tsx:118,133` menyembunyikan tombol Edit/Hapus bila `is_system`; `RolesTab.tsx:94` menampilkan badge `Level {privilege_level}`; `RolesTab.tsx:184` menyembunyikan tombol unbind bila role `ADMIN`.
- **Acuan dokumen:** API §3.4 hanya menulis deskripsi satu baris per endpoint ("Daftar semua role beserta policies-nya", "Daftar katalog action × resource_type", "Daftar semua casbin policy (termasuk ABAC condition)") — **tidak ada skema respons** untuk satu pun endpoint IAM (berbeda dengan endpoint lain yang diberi contoh JSON). Guide §8/Lampiran K juga hanya menulis status sukses.
- **Yang hilang/tidak cocok:** (a) tidak diketahui apakah backend mengembalikan `id` atau `roleId`/`name` sebagai kunci role, apakah ada `is_system`/`privilege_level`/`policy_count`/`created_at` (semua field itu tidak ada di dokumen — `privilege_level` bahkan sudah dihapus backend per §4.6g, tapi panel masih menampilkannya); (b) bentuk `GET /subjects/:operatorId/effective-permissions` sama sekali tidak didokumentasikan — mapper menebak `{effectiveRoles, permissions: [{action, resourceType, resourcePattern, effect, sourceRole, abacCondition}]}`; (c) `GET /info` — panel mengharapkan `effectiveInMode` string dan `enforcedDomains` array, dokumen hanya menulis "{mode, authzVersion, effectiveInMode}".
- **Workaround demo:** seed menyediakan semua field tebakan itu (`src/services/api/seeds/system.ts`: `INITIAL_IAM_ROLES` lengkap dengan `privilege_level`/`is_system`/`created_at`; `INITIAL_IAM_POLICIES` dengan `subject_match`/`role_id`/`permission_id`), jadi mapper tidak pernah diuji terhadap respons backend yang minim.
- **Perubahan backend yang dibutuhkan:** Tambahkan skema respons eksplisit (field + tipe + contoh) untuk `GET /info`, `GET /roles`, `GET /permissions`, `GET /user-roles`, `GET /policies`, `GET /subjects/:operatorId/effective-permissions` di API §3.4; nyatakan secara eksplisit field mana yang **tidak** ada (mis. `privilege_level`, `policy_count`) agar panel berhenti menampilkannya.
- **Acceptance criteria:** Setiap endpoint di atas punya contoh respons JSON di dokumen; respons live cocok field-per-field dengan contoh; panel (setelah diperbaiki) tidak lagi menampilkan "Level 1" atau tombol hapus ADMIN.

### SYS-B7 — Role preset: panel/demo mengunci keempat preset sebagai immutable — dokumen hanya mengunci ADMIN; perilaku hapus role ber-pemakaian tidak didokumentasikan — Medium
- **Area:** Edit/hapus role preset (`RolesTab.tsx`, `useRoles.ts`, `demoIam`).
- **Perilaku panel:** `RolesTab.tsx:76` menulis "Role sistem (ADMIN, SUPERVISOR, OPERATOR, MAINTENANCE) dilindungi dan tidak dapat diubah atau dihapus." `useRoles.updateRole` (`src/features/system/hooks/useRoles.ts:69-73`) menolak edit bila `target.is_system`. `demoIam.updateIamRole`/`deleteIamRole` menolak dengan `403 SYSTEM_ROLE_PROTECTED`/`FORBIDDEN` bila `isSystemRoleName(nama)` — untuk keempat nama, terlepas dari flag `is_system` (seed sendiri menandai SUPERVISOR/OPERATOR/MAINTENANCE sebagai `is_system: false`, `src/services/api/seeds/system.ts:111-141` — jadi tombol Edit/Hapus tampil, tapi aksinya ditolak demo).
- **Acuan dokumen:** API §3.4 + Guide §8: "hanya `ADMIN` yang immutable dan reserved untuk `ADM-001`. `SUPERVISOR`, `OPERATOR`, dan `MAINTENANCE` adalah preset opsional — dapat diubah atau dihapus bila tidak dipakai (FR-RL-002)"; penghapusan permanen, seed hanya jalan sekali (FR-032-11/12).
- **Yang hilang/tidak cocok:** (a) admin tidak bisa menghapus/mengubah preset non-ADMIN lewat panel/demo, padahal backend mengizinkan (bila tidak dipakai); (b) perilaku backend saat menghapus role yang **masih dipakai** (masih ada assignment/policy) tidak didokumentasikan di mana pun — demo mengarang `409 ROLE_IN_USE` (`demoIam.deleteIamRole`) dan diam-diam menghapus policy orphan (`store.iamPolicies` difilter) — tidak diketahui apakah backend menolak, cascade, atau meng-orphan-kan.
- **Workaround demo:** Demo mengarang aturan penguncian + `ROLE_IN_USE` + penghapusan policy orphan.
- **Perubahan backend yang dibutuhkan:** (1) Dokumentasikan perilaku `DELETE /roles/:id` bila role masih punya assignment dan/atau policy: 409 dengan kode apa? atau cascade? (2) Dokumentasikan perilaku `PUT /roles/:id` untuk preset non-ADMIN (boleh ubah deskripsi saja? nama?); (3) pastikan respons membedakan ADMIN (immutable) dari preset lain, mis. field `is_system` hanya `true` untuk ADMIN.
- **Acceptance criteria:** `DELETE /roles/:id` untuk SUPERVISOR tak terpakai → 200 dan tidak muncul lagi setelah restart backend (seed tidak menghidupkan kembali); untuk role yang masih ter-assign → perilaku terdokumentasi (kode error yang konsisten); `DELETE` ADMIN → ditolak.

### SYS-B8 — Capability `access_control.read` tidak ada di panel; kunci capability panel belum tentu sama dengan katalog backend; 403 pada read bisa salah menurunkan `manage` — Medium
- **Area:** Capability-first gating (`src/utils/capabilities/specs.ts`, `engine.ts`, `src/services/api/http/iam.ts`, `AuditTrailPage.tsx`).
- **Perilaku panel:** `CAPABILITY_SPECS` (`specs.ts`) hanya punya `access_control.manage` — tidak ada `access_control.read`. Semua GET IAM di `httpIam` diberi `capability: 'access_control.manage'` (mis. `getIamRoles`, `getIamPermissions`, `getIamPolicies`, `getIamUserRoles`, `getIamAuditDecisions`); `getIamInfo` bahkan tanpa tag capability (403-nya jatuh ke default `'dashboard.read'` di `transport.ts` `reqJson`). `AuditTrailPage.tsx:14` mengunci halaman audit sistem pada kunci karangan panel `audit.system.read` (bukan kunci dokumen).
- **Acuan dokumen:** Guide §4.5: `access_control.read` (ADMIN, LAN) "dipakai `/system/audit`"; `access_control.manage` (ADMIN, LAN). API §3.4: GET IAM memakai `authorize("read", "access_control")`, mutasi `authorize("manage", "access_control")`. Guide §4.5: penolakan role-only boleh menonaktifkan capability secara global; penolakan per-resource hanya per-resource.
- **Yang hilang/tidak cocok:** (a) karena read ditandai `manage`, satu 403 dari GET (mis. `read` ditolak) akan dicatat `capabilityDenialStore` sebagai penolakan `access_control.manage` global — halaman IAM terkunci total padahal yang ditolak hanya baca; (b) `audit.system.read` bukan kunci backend — bila `/auth/me` backend mengembalikan `access_control.read: deny`, panel tidak pernah membacanya (kunci tidak dikenal), dan gating AuditTrail jatuh ke baseline role (ADMIN → allow) — bekerja "kebetulan"; (c) tidak ada dokumen yang memetakan kunci capability backend (`/auth/me` `capabilities[].key`) ke kunci panel — daftar 36 kunci panel (`specs.ts`) diasumsikan sama dengan katalog backend tanpa bukti.
- **Workaround demo:** `buildAuthMeCapabilities` (`engine.ts`) menghasilkan capability dari baseline role + daftar kunci panel sendiri; backend tidak pernah dilibatkan.
- **Perubahan backend yang dibutuhkan:** (1) Dokumentasikan daftar kanonis kunci capability yang dikembalikan `GET /auth/me` (nama persis per kunci, termasuk apakah ada `audit.system.read` atau hanya `access_control.read`); (2) pastikan `GET /auth/me` mengembalikan **kedua** kunci `access_control.read` dan `access_control.manage` secara terpisah.
- **Acceptance criteria:** `GET /auth/me` untuk ADMIN memuat `access_control.read: allow` dan `access_control.manage: allow` sebagai kunci terpisah; 403 pada `GET /roles` tidak menurunkan `access_control.manage` di panel (setelah panel diperbaiki).

### SYS-B9 — Proyeksi capability `/auth/me`: `domain`/`surface`/`mode`/`reason` per capability dan `enforcedDomains` dibuang; mode `partial` tidak jelas sumbernya — Medium
- **Area:** Capability-first UI (`AuthContext`, `evaluateCapability`, badge mode di AccessControlPage).
- **Perilaku panel:** `mapAuthMe` meratakan `capabilities[]` menjadi `Record<key, 'allow'|'deny'|'unknown'>` — field `domain`, `surface`, `mode`, `reason` per item dibuang. `AuthMeResponse` (`src/types/auth.ts`) tidak punya `attributes` (`authz.attributes`) maupun `enforcedDomains`. `AccessControlPage.tsx` hanya menampilkan `mode` + `authzVersion` di badge; `effectiveInMode`/`enforcedDomains` yang sudah di-map (`mapIamInfo`) tidak pernah ditampilkan.
- **Acuan dokumen:** API §L: `authz: {mode, authzVersion, catalogueVersion, enforcedDomains, effectiveRoles, attributes, capabilities: [{key, domain, surface, decision, mode, reason}]}`; Guide §4.9: kontrak yang sama; Guide §8: "Gunakan `GET /info` untuk menampilkan mode (`shadow`/`enforce`) dan versi cache."
- **Yang hilang/tidak cocok:** (a) `reason` per capability hilang — saat capability `deny`/`unknown`, UI hanya bisa menampilkan pesan generik, bukan alasan server; (b) `attributes` hilang — panel tidak bisa menjelaskan keputusan berbasis atribut; (c) di mode per-domain enforce (`AUTHZ_ENFORCE_DOMAINS`), admin tidak bisa melihat domain mana yang sedang enforce — badge hanya menulis mode; (d) tipe panel mengenal mode `'partial'` (`src/types/iam.ts` `IamInfo`, `src/types/auth.ts` `AuthMeResponse`, `IamInfoSchema` di `schemas/dto.ts`) — sedangkan dokumen hanya menyebut mode `shadow`/`enforce` (+ enforce per-domain). Tidak jelas apakah `partial` adalah nilai yang benar-benar dikembalikan backend atau karangan panel.
- **Workaround demo:** `demoAuth.getAuthMe` membangun capabilities dari baseline role (`buildAuthMeCapabilities`, `engine.ts`) + overlay policy parsial hanya bila `mode==='enforce'`; `reason`/`domain`/`surface` tidak pernah ada di demo.
- **Perubahan backend yang dibutuhkan:** (1) Konfirmasi nilai `mode` yang mungkin dikembalikan `GET /auth/me` dan `GET /access-control/info` (apakah ada `'partial'`? bila ya, dokumentasikan kapan; bila tidak, panel harus menghapusnya); (2) pastikan `enforcedDomains` dan `effectiveInMode` selalu ada di kedua endpoint saat mode per-domain aktif.
- **Acceptance criteria:** `GET /auth/me` di mode per-domain enforce mengembalikan `mode` + `enforcedDomains` yang konsisten dengan `GET /access-control/info`; setiap capability `deny` menyertakan `reason` yang tampil di UI.

### SYS-B10 — POST `/access-control/permissions`: tidak ada UI; demo aktif memblokir dengan kode karangan; casing body belum pasti — Medium
- **Area:** Katalog permission (tab Permissions, `PermissionsTab.tsx`).
- **Perilaku panel:** `PermissionsTab.tsx` menyatakan katalog "Fixed Master Data · Read-Only" dan hanya menyediakan tombol "Assign ke Role". Transport `httpIam.createIamPermission` ada (`src/services/api/http/iam.ts`) tapi **tidak dipanggil dari UI mana pun** (hanya dari test). `demoIam.createIamPermission` (`src/services/api/demo/iam.ts`) selalu melempar `ApiError {code: 'PERMISSION_CATALOG_READ_ONLY', httpStatus: 403}`.
- **Acuan dokumen:** API §3.4 + Guide §8/Lampiran K: `POST /permissions` ada — "Buat permission baru; pasangan (action, resourceType) wajib memiliki rute penjaga — selain itu 400 INERT_PERMISSION" → 201/200; 409 bila duplikat. Guide §8 menghitungnya sebagai salah satu dari 18 rute konsol IAM.
- **Yang hilang/tidak cocok:** (a) panel tidak menyediakan pembuatan permission sama sekali, padahal dokumen menyediakannya — admin tidak bisa mendaftarkan permission untuk guard baru; (b) kode demo `PERMISSION_CATALOG_READ_ONLY` adalah karangan (tidak ada di tabel error API §2); (c) casing body belum pasti: `httpIam.createIamPermission` mengirim `{action, resource_type, description}` (snake_case), sedangkan Guide Lampiran K menulis `{action, resourceType, description?, reason?}` (camelCase) — API §3.4 tidak menuliskan skema body sama sekali, jadi tidak bisa dipastikan mana yang benar tanpa verifikasi live.
- **Workaround demo:** Blokir total + pesan "read-only" — menutupi ketiadaan UI dan ketidakpastian casing.
- **Perubahan backend yang dibutuhkan:** Putuskan dan dokumentasikan: apakah `POST /permissions` benar-benar didukung? Bila ya, tetapkan skema body (casing field + `reason`?) dan contoh 201 vs 400 INERT_PERMISSION vs 409; bila tidak, hapus dari API §3.4/Guide §8 dan nyatakan katalog sebagai seed-only.
- **Acceptance criteria:** Keputusan tertulis di dokumen + (bila didukung) `POST /permissions {action, resourceType}` yang punya rute penjaga → 201 dan muncul di `GET /permissions`; yang tanpa rute penjaga → 400 INERT_PERMISSION.

### SYS-B11 — GET `/access-control/audit`: tanpa filter server-side; limit di-hardcode 100; keputusan di atas 100 hilang diam-diam — Medium
- **Area:** Tab "Riwayat Pemeriksaan" (`AuditTab.tsx`, `src/features/system/components/AuditTab.tsx`).
- **Perilaku panel:** `httpIam.getIamAuditDecisions(limit=100)` (`src/services/api/http/iam.ts`) hanya mengirim query `{limit, envelope: true}`. `AuditTab.tsx` hanya punya pencarian teks client-side atas data yang sudah dimuat; tidak ada filter tanggal/subjek/keputusan/mode, tidak ada pagination/cursor.
- **Acuan dokumen:** API §3.4: `GET /audit` "Daftar audit keputusan otorisasi (filter subject/decision/mode/from/to)"; Guide §4.7: limit default 100, maks 1000; Lampiran K: parameter `subject, decision, mode, from, to, limit ≤1000`.
- **Yang hilang/tidak cocok:** panel tidak pernah memakai filter `subject`/`decision`/`mode`/`from`/`to`; dengan limit 100, keputusan lama tidak bisa dijangkau dari UI (tidak ada cara menaikkan limit atau paging ke halaman berikut).
- **Workaround demo:** `demoIam.getIamAuditDecisions` mengiris seed statis (`slice(0, min(1000, limit))`) — selalu ≤4 baris, jadi kekurangan ini tidak pernah terlihat di demo.
- **Perubahan backend yang dibutuhkan:** Tidak ada perubahan fungsional bila filter sudah sesuai dokumen — yang dibutuhkan adalah **verifikasi + contoh**: pastikan kombinasi filter (`subject` + `from`/`to`, `decision=DENY`) benar-benar bekerja dan `limit` sampai 1000 dihormati; dokumentasikan bentuk `meta`/cursor (bila ada) untuk audit.
- **Acceptance criteria:** `GET /access-control/audit?subject=OP-115&decision=DENY&from=...&to=...&limit=1000` mengembalikan hanya baris yang cocok; UI panel (setelah diperbaiki) bisa menampilkan >100 baris lewat filter/pagination.

### SYS-B12 — Inspector `GET /subjects/:operatorId/effective-permissions`: bentuk respons tidak terdokumentasi; subjek default hardcode `SUP-042`; error deep-link ditelan — Low
- **Area:** Tab Inspector (`useInspector.ts`, `InspectorTab.tsx`).
- **Perilaku panel:** `useInspector.ts:36` menginisialisasi `inspectOperatorId` ke `'SUP-042'` (hardcode). Deep-link `?operator=` dan tombol Inspect di tab Assignments memanggil `getSubjectEffectivePermissions` secara fire-and-forget dengan `.catch(() => undefined)` — error ditelan tanpa feedback. `mapIamSubjectEffectivePermissions` menebak bentuk respons (lihat SYS-B6).
- **Acuan dokumen:** API §3.4 + Guide §8: endpoint ini "Preview role, assignment, dan permission; statis, tidak mengevaluasi scope/ABAC runtime" — tanpa skema respons, tanpa daftar kode error; Guide §4.6h/§4.9 menegaskan jangan dipakai sebagai gerbang UI (panel sudah mematuhi ini — `InspectorTab.tsx` menampilkan peringatan yang benar).
- **Yang hilang/tidak cocok:** (a) bila `SUP-042` tidak ada di instalasi Real, Inspector menampilkan kosong/gagal tanpa penjelasan pada pemuatan awal; (b) 404 untuk operator tak dikenal — demo mengarang `OPERATOR_NOT_FOUND` (`demoIam.getSubjectEffectivePermissions`), backend belum tentu memakai kode itu; (c) demo mengarang fallback: bila operator tanpa assignment, `effectiveRoles` diisi `[{primaryRole, ORGANIZATION}]` — backend mungkin mengembalikan array kosong.
- **Workaround demo:** Fallback + error code karangan (lihat di atas).
- **Perubahan backend yang dibutuhkan:** Dokumentasikan skema respons `effective-permissions` (field `primaryRole`, `effectiveRoles[]`, `permissions[]` — nama field persis) + perilaku bila operator tanpa assignment + kode 404 untuk operator tak dikenal.
- **Acceptance criteria:** `GET /subjects/OP-115/effective-permissions` mengembalikan bentuk yang sama dengan dokumen; operator tanpa assignment mengembalikan `effectiveRoles` sesuai dokumen (kosong atau fallback terdokumentasi).

### SYS-B13 — POST `/access-control/roles/:id/permissions`: `reason` yang diketik admin dibuang di Real mode — Low
- **Area:** Bind permission ke role (`BindPermissionModal.tsx`, dari tab Roles maupun Permissions).
- **Perilaku panel:** `BindPermissionModal.tsx:174` mengumpulkan `bindReason`; `useRolePermissions.handleBindPermission` meneruskannya sebagai `reason` ke `addIamRolePermission`; tapi `httpIam.addIamRolePermission` (`src/services/api/http/iam.ts`) membangun body `{permissionId, resourcePattern, effect, abacCondition}` **tanpa `reason`**.
- **Acuan dokumen:** Guide Lampiran K: `POST /roles/:id/permissions {permissionId, resourcePattern, effect?, abacCondition?, reason?}` → 201. Selain `reason`, body panel sudah cocok.
- **Yang hilang/tidak cocok:** hanya `reason` yang hilang; audit/jejak alasan binding tidak tersimpan di backend.
- **Workaround demo:** `demoIam.addIamRolePermission` menyimpan `reason` (`options?.reason?.trim() || ...`).
- **Perubahan backend yang dibutuhkan:** Tidak ada (backend sudah menerima `reason` menurut dokumen) — perbaikan panel; verifikasi saja backend benar-benar menyimpannya dan mengembalikannya di `GET /roles`/`GET /policies`.
- **Acceptance criteria:** Bind dengan `reason` → 201, lalu `GET /policies` (atau `GET /roles`) menampilkan `reason` tersebut.

### SYS-B14 — Mutasi assignment: `reason` tidak dikirim; revoke memakai composite key tanpa `id` — Low
- **Area:** Assign/revoke user-role (`AssignmentsTab.tsx`, `useAssignments.ts`).
- **Perilaku panel:** `httpIam.assignIamUserRole` mengirim `{operatorId, roleName, scopeType, scopeId}`; `revokeIamUserRole` mengirim `{operatorId, roleName, scopeType, scopeId}` (field `id` assignment yang diterima hook **dibuang** — `http/iam.ts` `revokeIamUserRole` tidak memasukkannya ke body).
- **Acuan dokumen:** Guide Lampiran K: `POST /user-roles {operatorId, roleName, scopeType?, scopeId?, reason?}`; `DELETE /user-roles {operatorId, roleName, scopeType?, scopeId?, reason?}` → `200 {success, removed}`.
- **Yang hilang/tidak cocok:** (a) `reason` tidak pernah dikumpulkan panel (tidak ada input reason di `AssignUserRoleModal.tsx`) dan tidak dikirim — jejak alasan assignment/revoke hilang; (b) revoke diidentifikasi oleh composite key, bukan `id` — bila ada dua assignment yang hanya berbeda `id` (tidak mungkin menurut kunci komposit, tapi tidak didokumentasikan), revoke ambigu; demo sendiri mencocokkan `id` dulu bila ada (`demoIam.revokeIamUserRole`), jadi perilaku demo ≠ HTTP.
- **Workaround demo:** Demo menyimpan `reason` default dan mencocokkan `id` bila tersedia.
- **Perubahan backend yang dibutuhkan:** Dokumentasikan apakah `DELETE /user-roles` menerima `id` sebagai alternatif identifikasi, dan apakah `reason` disimpan/dikembalikan; pastikan respons `{success, removed}` konsisten (panel menoleransi body kosong → `success: true`).
- **Acceptance criteria:** Assign + revoke dengan `reason` → alasan tersimpan dan terlihat di audit; revoke assignment yang tidak ada → 404 (atau perilaku terdokumentasi lainnya), bukan sukses palsu.

### SYS-B15 — Refresh token: panel mengembalikan `authz_version` karangan (selalu 0/stale di Real); penanganan 401 `AUTHZ_STALE`/`SUBJECT_INACTIVE` generik — Low
- **Area:** `POST /auth/refresh` + `AuthContext` session refresh.
- **Perilaku panel:** `httpAuth.refreshSession` (`src/services/api/http/auth.ts`) mengembalikan `{token, expires_in, authz_version: tokenAuthzVersion}` — padahal `tokenAuthzVersion` adalah variabel modul `transport.ts` yang **tidak pernah diisi dari respons server** di mode Real (hanya di-reset ke 0 saat logout); backend `POST /refresh` menurut API §L hanya mengembalikan `{success, token, expires_in}`. `AuthContext.tsx:169-196` mengabaikan `authz_version` itu dan memanggil `refreshCapabilities()` (refetch `/auth/me`) — jadi fungsinya selamat, tapi nilai yang dikembalikan menyesatkan. `AuthContext` menangani semua 401 dengan logout + pesan generik; `refreshCapabilities` menelan error diam-diam (`catch {}`).
- **Acuan dokumen:** API §L + §7.H: refresh sliding TTL (default 900 dtk), token lama **tidak** diinvalidasi (stateless JWT, expiry = revocation), audit `AUTH_TOKEN_REFRESHED`; `GET /auth/me` 401 bisa `SUBJECT_INACTIVE` atau `AUTHZ_STALE`; Guide §4.6h: di mode enforce, token terbitan sebelum `authz_version` naik ditolak 401 → login ulang.
- **Yang hilang/tidak cocok:** (a) `authz_version` hasil refresh tidak bermakna di Real — panel tidak bisa tahu dari refresh apakah kebijakannya sudah basi; (b) tidak ada pembedaan `AUTHZ_STALE` (butuh login ulang) vs `SUBJECT_INACTIVE` (akun dinonaktifkan) — keduanya tampil sebagai "sesi berakhir".
- **Workaround demo:** `demoAuth.refreshSession` mengembalikan `authz_version` asli (`store.iamInfo.authzVersion`) — menyembunyikan bahwa di Real nilai itu tidak ada.
- **Perubahan backend yang dibutuhkan:** Pertimbangkan mengembalikan `authz_version` (atau `authzVersion`) pada `POST /auth/refresh` agar klien bisa membandingkan dengan versi yang dikenal tanpa satu round-trip `/auth/me` ekstra; dan dokumentasikan apakah 401 refresh memakai kode `AUTHZ_STALE` juga.
- **Acceptance criteria:** `POST /auth/refresh` (bila diperkaya) mengembalikan `authzVersion` yang sama dengan `GET /access-control/info`; panel membedakan pesan `AUTHZ_STALE` vs `SUBJECT_INACTIVE`.

### SYS-B16 — Login: lockout client-side (5 percobaan/30 dtk) vs rate limit server (5/60 dtk); dokumentasi `Retry-After` belum ada — Low
- **Area:** `POST /auth/login` (`LoginPage.tsx`, `demoAuth`).
- **Perilaku panel:** `LoginPage.tsx` menghitung percobaan gagal sendiri (`VITE_LOGIN_MAX_ATTEMPTS=5`, `VITE_LOGIN_COOLDOWN_SEC=30`, `src/services/api/mode.ts:433-438`) lalu membuka kembali tombol login setelah 30 dtk; backend membatasi 5 percobaan per 60 dtk per IP+station (API §L). Panel menangani 429 dengan mengulang cooldown — jadi pulih sendiri, tapi pengguna bisa menabrak 429 server berulang kali.
- **Acuan dokumen:** API §L: login PBKDF2, 401 generik tanpa user-enumeration, 429 rate limit `AUTH_RATE_LIMIT_MAX=5`/`AUTH_RATE_LIMIT_WINDOW_MS=60000` per IP+station; `AUTH_JWT_TTL_SEC` default 900 (panel memakai `expires_in` server bila ada, fallback `VITE_AUTH_TTL_FALLBACK_SEC=900` — sudah cocok).
- **Yang hilang/tidak cocok:** (a) jendela cooldown panel (30 dtk) ≠ jendela server (60 dtk); (b) demo tidak bisa menguji password salah/rate-limit/enumerasi — `demoAuth.login` (`src/services/api/demo/auth.ts`): bila `operatorPasswords` tidak punya entri (keadaan awal: map kosong, `store.ts`), **password apa pun ≥4 karakter diterima** untuk operator aktif mana pun; pesan error membedakan "ID tidak ditemukan atau akun nonaktif" vs "ID atau password salah".
- **Workaround demo:** Lihat (b) — demo adalah simulasi login yang longgar, sudah dicatat `AUDIT.md` §2.2/§5.
- **Perubahan backend yang dibutuhkan:** Tidak ada; dokumentasikan saja apakah 429 login mengembalikan header `Retry-After` (bila ya, panel bisa memakai itu daripada cooldown env).
- **Acceptance criteria:** 6 login gagal beruntun → 429 (dengan/tanpa `Retry-After` terdokumentasi); pesan 401 tidak membedakan user-ada vs user-tidak-ada.

### SYS-B17 — GET `/access-control/user-roles` & `/policies`: panel tidak mengirim filter `operatorId`/`roleId`; muat-semua + saring client-side — Low
- **Area:** Tab Assignments & Policies (data loading `useIamData.ts:66-72`).
- **Perilaku panel:** `getIamUserRoles()` dan `getIamPolicies()` dipanggil tanpa query apa pun; `useIamData` memuat 7 list sekaligus via `Promise.all` lalu tab menyaring di memori. `reqList` (`transport.ts`) hanya membaca satu halaman — tidak ada `reqAllPages` untuk IAM.
- **Acuan dokumen:** Guide Lampiran K: `GET /user-roles` filter `operatorId?`; `GET /policies` filter `roleId?`. Guide §4.7: "seluruh daftar IAM kecuali `/audit`" mengembalikan seluruh data (tanpa paginasi).
- **Yang hilang/tidak cocok:** panel mengabaikan filter yang disediakan; bila backend di masa depan membatasi ukuran daftar (atau instalasi punya ratusan policy/assignment), panel akan menampilkan data terpotong tanpa peringatan.
- **Workaround demo:** demo mengembalikan seluruh array seed (3 assignment, 5 policy) — tidak pernah menguji filter/paginasi.
- **Perubahan backend yang dibutuhkan:** Tegaskan di API §3.4 bahwa `GET /user-roles`/`GET /policies` (dan `/roles`, `/permissions`) benar-benar tanpa paginasi/limit di semua ukuran data, atau bila ada batas, dokumentasikan `limit`/`cursor`-nya; pastikan query `operatorId`/`roleId` benar-benar memfilter.
- **Acceptance criteria:** `GET /user-roles?operatorId=OP-115` hanya mengembalikan assignment OP-115; `GET /policies?roleId=<id>` hanya policy role tersebut.

### SYS-B18 — Aturan anti-eskalasi/wildcard karangan panel/demo yang lebih ketat dari dokumen — Low
- **Area:** Bind permission & create policy (custom role).
- **Perilaku panel/demo:** `useRolePermissions.handleBindPermission` + `demoIam.addIamRolePermission`/`createIamPolicy` menolak `resourcePattern '*'` atau `'org:*'` untuk custom role dengan `403 PRIVILEGE_ESCALATION_DENIED` (karangan); `isReservedPermission` (`specs.ts`) menganggap **semua** action `'*'` sebagai reserved.
- **Acuan dokumen:** API §3.4 membatasi reserved permission pada 4 item (`manage:access_control`, `manage:mqtt_admin`, `manage:mqtt_configuration`, `read_raw:mqtt_configuration`, hanya `subject_match = operator:ADM-001`) + anti-lockout DENY/disabled pada ADMIN + root protection `is_protected`. **Tidak ada** aturan yang melarang pola resource `'*'` untuk custom role secara umum; `resource_pattern` `'*'` bahkan dipakai seed untuk ADMIN (`org:*`, pol-01).
- **Yang hilang/tidak cocok:** panel/demo memblokir aksi yang mungkin sah di backend (mis. custom role auditor dengan `read:*` di mode enforce) — admin tidak pernah bisa mengujinya karena UI memblokir sebelum request dikirim.
- **Workaround demo:** Penolakan dilakukan di demo dan di handler UI, bukan di server.
- **Perubahan backend yang dibutuhkan:** Dokumentasikan secara eksplisit apakah ada batasan pola resource untuk custom role (bila tidak ada, nyatakan "tidak ada"); bila ada (mis. wildcard dilarang), nyatakan kode errornya (apakah `PRIVILEGE_ESCALATION_DENIED`? — kode ini disebut di API §2 tabel 403 tapi tidak dipetakan ke kasus spesifik).
- **Acceptance criteria:** Keputusan tertulis; bila wildcard diizinkan, bind `read:*` ke custom role → 201; bila dilarang, 403 dengan kode yang terdokumentasi.

---

## B. System Audit / Health / Info

### SYS-B19 — Skema item audit (`OperationalEventItem`) tidak didefinisikan di dokumen mana pun; semua kolom AuditTrailPage adalah asumsi mapper — High
- **Area:** System audit (`GET /api/v1/system/audit`) + operational events (item yang sama).
- **Perilaku panel:** `src/features/system/AuditTrailPage.tsx` menampilkan 5 kolom yang semuanya berasal dari `AuditLogItem` (`src/types/system.ts:28-51`): `timestamp`, `operator_name` + `operator_id` + `access_mode`, `action` + `resource_type` + `resource_id`, `details`, `client_ip`.
- **Acuan dokumen:** API §I (~885-900): `GET /api/v1/operational-events` dan `GET /api/v1/system/audit` hanya menyatakan respons `OperationalEventItem[]` atau `{data, meta}` — **tidak ada daftar field item di seluruh dokumen** (hanya disebut `deviceId`/`machineId` nullable `SET NULL` dan contoh `event_type`). Guide §6.7 juga tidak mendefinisikan skema item.
- **Yang hilang/tidak cocok:** Mapper `mapAuditLog` (`src/services/api/http/mappers/monitoring.ts:91-112`, via `mapOperationalEvent` :71-90) membaca field yang **tidak satu pun didokumentasikan**: `operatorId`/`operator_id`, `operatorName`/`operator_name`, `action`, `resourceType`/`resource_type`, `resourceId`/`resource_id`, `clientIp`/`client_ip`, `accessMode`/`access_mode`, `message`/`details`, `severity`, `machineName`. Bila backend hanya mengembalikan field yang didokumentasikan, tabel audit akan tampil rusak — dan mapper menutupinya dengan default yang menyesatkan: `operator_name` → `''`, `client_ip` → `''`, `resource_type` → `'SYSTEM'` untuk semua baris, `resource_id` → fallback ke `id` baris, `access_mode` → default `'LAN'` (jadi baris dari tunnel pun tampil "LAN"), `details` → fallback ke string `event_type`.
- **Workaround demo:** Seed `INITIAL_AUDIT_LOGS` (`src/services/api/seeds/system.ts:31-84`, hanya 3 baris) memang berisi semua field itu, dan `store.addAudit` (`src/services/api/demo/store.ts:103-130`) menulisnya untuk setiap mutasi demo — jadi di Demo halaman terlihat lengkap. Ini **bukan** bukti backend mengembalikan field yang sama.
- **Perubahan backend yang dibutuhkan:** Dokumentasikan dan kembalikan skema item lengkap untuk `GET /system/audit` dan `GET /operational-events[/:deviceId]`: `id`, `timestamp`/`createdAt`, `deviceId`, `machineId`, `machineName`, `eventType`, `action` (atau nyatakan `action` = `eventType`), `operatorId`, `operatorName`, `resourceType`, `resourceId`, `details`/`message`, `clientIp`, `accessMode`, `severity`, plus field ack (`acknowledged`, `acknowledgedBy`, `acknowledgedAt`, `ackNote`).
- **Acceptance criteria:** `GET /api/v1/system/audit?limit=20&envelope=true` mengembalikan baris yang memuat semua field di atas; AuditTrailPage di Real mode menampilkan aktor/aksi/resource/IP/mode tanpa ada default mapper yang terpicu (uji dengan memeriksa respons mentah).

### SYS-B20 — `GET /health` tidak menyediakan field yang ditampilkan SystemHealthPage; transport HTTP mensintesis data kesehatan palsu — High
- **Area:** System health (`GET /health`).
- **Perilaku panel:** `src/features/system/SystemHealthPage.tsx` (~78-140) menampilkan 4 kartu: "Layanan Aplikasi Utama" (`backend.status/label/environment/latency_ms`), "Basis Data Produksi" (`database.engine/latency_ms`), "Broker Komunikasi Mesin" (`mqtt.status/connected_clients/dynamic_security`), "Pembaruan Layar Langsung" (`websocket.status`) — semuanya dari `SystemHealth` (`src/types/system.ts:1-26`).
- **Acuan dokumen:** API §A (~64-96) — respons `GET /health` **hanya**: `status`, `uptime`, `timestamp`, `ws_clients`, `db_connected`, `buffer_pending`, `buffer_dropped`, `metrics{totalReceived, validIngested, invalidDiscarded, lastIngestedAt}`. Guide §6.1 menegaskan daftar yang sama. Tidak ada `backend`/`database`/`mqtt`/`websocket`, tidak ada latensi, tidak ada environment/engine.
- **Yang hilang/tidak cocok:** `httpHealth.getSystemHealth` (`src/services/api/http/health.ts:15-67`) mensintesis semua field yang hilang dengan nilai hardcode/default — terverifikasi langsung di kode: `backend.status` diturunkan dari `db_connected` saja, `label` selalu `'API v1'`, `environment` selalu `'production'`, `latency_ms` selalu `0`; `database.engine` selalu `'PostgreSQL'`, `latency_ms` `0`; `mqtt.status` default `'UP'`, **`connected_clients` fallback ke `wsClients`** (jumlah klien WebSocket browser — bukan klien MQTT), `dynamic_security` selalu `'enabled'`; `websocket.status` default `'UP'`. Akibat di Real mode: broker MQTT bisa mati tapi kartu tetap `UP`; "Perangkat Terhubung" menampilkan jumlah layar pantau, bukan perangkat MQTT; semua latensi tampil `0 ms`; environment selalu "Produksi" walau backend dev/staging. Komentar di `http/health.ts:22-23` mengakui hal ini ("Backend /health mengembalikan bentuk lean; panel butuh bentuk rich — sintesis dari field lean").
- **Workaround demo:** `INITIAL_SYSTEM_HEALTH` (`src/services/api/seeds/system.ts:10-30`) memang berisi semua field rich itu (latency 12/8 ms, mqtt 4 clients, dsb.) dan `demoHealth.getSystemHealth` (`src/services/api/demo/health.ts:16-23`) mengembalikannya apa adanya — jadi Demo terlihat akurat.
- **Perubahan backend yang dibutuhkan:** Perluas `GET /health` dengan objek `backend{status,label,environment,latency_ms}`, `database{engine,latency_ms}`, `mqtt{status,connected_clients,dynamic_security}`, `websocket{status}` (nilai nyata, diukur server); ATAU dokumentasikan secara eksplisit bahwa field-field itu tidak tersedia dan panel harus menyembunyikan kartu tersebut di Real mode.
- **Acceptance criteria:** Di Real mode, matikan broker MQTT (atau simulasikan) → kartu broker menampilkan `DOWN`/jumlah klien nyata, bukan `UP`; latensi menampilkan angka ukur nyata (>0) atau kartu disembunyikan; tidak ada lagi nilai hardcode `'production'`/`'enabled'`/`0` di respons yang dirender.

### SYS-B21 — PATCH ack tidak mengirim `operatorId`; dokumen bertentangan soal wajib/tidak — Medium
- **Area:** Operational events ack (`PATCH /api/v1/operational-events/:id/ack`).
- **Perilaku panel:** `src/services/api/http/monitoring.ts:133-155` (`acknowledgeOperationalEvent`) mengirim body hanya `{note?}` — tidak pernah `operatorId`/`operator_id`; pemanggil `confirmAck` (`src/features/monitoring/hooks/useOperationalEvents.ts:120-138`) hanya meneruskan `(id, note)`. Demo (`src/services/api/demo/monitoring.ts:311-344`) juga tidak butuh operator (mengambil dari sesi lokal).
- **Acuan dokumen (bertentangan):** API §I (~930-934): body `{operatorId?: string, operator_id?: string, note?: string}` — ketiganya opsional. Guide §6.7: "Body `{operatorId | operator_id, note?}` — **salah satu ID wajib**, `note` ≤500".
- **Yang hilang/tidak cocok:** Bila backend mengikuti Guide (Zod mewajibkan salah satu ID), **setiap ack dari panel gagal 400 di Real mode**. Bila backend menurunkan operator dari token Bearer (masuk akal karena endpoint terotentikasi), body note-only sudah cukup. Tidak bisa dipastikan dari dokumen.
- **Workaround demo:** Tidak ada — demo menerima ack tanpa operator karena memakai `store.currentUserName` lokal.
- **Perubahan backend yang dibutuhkan:** Tetapkan satu aturan dan selaraskan kedua dokumen; rekomendasi: turunkan operator dari JWT dan terima body `{note?}` saja (server sudah mengautentikasi pemanggil). Bila tetap wajib, panel harus mengirim `operator_id` dari sesi login.
- **Acceptance criteria:** Ack dari panel di Real mode mengembalikan `200 {id, acknowledgedAt, acknowledgedBy, ackNote}`; API §I dan Guide §6.7 menyatakan aturan body yang sama.

### SYS-B22 — Filter `severity` dan `acknowledged` di halaman Operational Events dibuang oleh transport HTTP; di Demo jalan, di Real mode diam-diam diabaikan — Medium
- **Area:** Operational events list (bersinggungan dengan audit; endpoint dipakai bersama).
- **Perilaku panel:** `src/features/monitoring/OperationalEventsPage.tsx:33-34,75-80` mengekspos filter Severity dan Ack (ALL/UNACK/ACK); `src/features/shared/useHistoricalQueries.ts:136-165` (`useOperationalEventsQuery`) meneruskan `severity` dan `acknowledged` ke `getOperationalEventsPage`; `src/types/historical.ts:89-95` (`OperationalEventsQuery`) mendeklarasikan keduanya.
- **Acuan dokumen:** API §I (~885-895, ~908-918): parameter list hanya `from`, `to`, `event_type`, `limit`, `cursor`, `envelope` — **tidak ada `severity`/`acknowledged`**. Guide §6.7: sama, tidak ada keduanya.
- **Yang hilang/tidak cocok:** `buildOperationalEventsEndpoint` (`src/utils/historicalExport/endpoints.ts:76-91`) hanya mengirim `machine_id, from, to, event_type, cursor, limit, envelope` — `severity` dan `acknowledged` **dibuang tanpa peringatan**; `httpMonitoring.getOperationalEventsPage` (`src/services/api/http/monitoring.ts:110-118`) memakai builder itu. Akibat: di Real mode pengguna memilih Severity=ALARM / Ack=UNACK, UI menunjukkan filter aktif, tapi server mengembalikan halaman tanpa filter — baris yang tidak cocok tetap tampil.
- **Workaround demo:** `demoMonitoring.getOperationalEventsPage` (`src/services/api/demo/monitoring.ts:210-251`) memfilter `severity` dan `acknowledged` secara in-memory (baris ~230-236), sehingga Demo berperilaku benar.
- **Perubahan backend yang dibutuhkan:** Tambahkan query param `severity` dan `acknowledged` (atau `ack_status`) pada `GET /api/v1/operational-events[/:deviceId]`, dokumentasikan nilainya; ATAU nyatakan resmi tidak didukung — maka panel harus menghapus kedua filter dari UI Real mode (atau memfilter client-side dengan catatan paginasi menjadi tidak akurat).
- **Acceptance criteria:** `GET /api/v1/operational-events/?severity=ALARM&acknowledged=false&limit=50` di Real mode hanya mengembalikan baris yang cocok; atau, bila diputuskan tidak didukung, UI tidak lagi menawarkan kedua filter tersebut.

### SYS-B23 — Konflik dokumen: `machine_id` pada list global dan ekspor operational-events; Guide bilang didukung, API doc tidak mencantumkannya — Medium
- **Area:** Operational events list + ekspor global (bersinggungan dengan audit).
- **Perilaku panel:** `buildOperationalEventsEndpoint` (`src/utils/historicalExport/endpoints.ts:76-91`) mengirim `machine_id` saat scope global; `useOperationalEventsQuery` (`src/features/shared/useHistoricalQueries.ts:136-165`) mengisi `machine_id` dari filter saat `deviceFilter === 'ALL'`; `buildOperationalEventsExportEndpoint` (`:93-112`) juga mengirim `machine_id` (+ `event_type`) untuk ekspor global; `OperationalEventsFilters.tsx` menyediakan dropdown mesin.
- **Acuan dokumen (bertentangan):** Guide §6.7 dan Lampiran A I mencantumkan `machine_id` (dan `event_type` untuk ekspor) pada `GET /operational-events/` dan `GET /operational-events/export`. API §I (~885-907): list global hanya `from, to, event_type, limit, cursor, envelope`; ekspor global hanya `from, to, format, limit` — **tanpa `machine_id` dan tanpa `event_type` pada ekspor**.
- **Yang hilang/tidak cocok:** Bila backend mengikuti API secara ketat, filter mesin di halaman `/audit` (dan filter mesin/event pada ekspor global) diam-diam diabaikan di Real mode — atau ditolak 400 bila validasi Zod ketat (lihat § "Pertanyaan terbuka" soal parameter tak dikenal). Sama seperti SYS-B22, tapi untuk filter mesin.
- **Workaround demo:** `demoMonitoring.getOperationalEventsPage` (`src/services/api/demo/monitoring.ts:210-251`) dan `exportOperationalEventsData` (`:254-309`) memfilter `machine_id` in-memory — Demo berperilaku sesuai Guide.
- **Perubahan backend yang dibutuhkan:** Selaraskan kedua dokumen dan implementasi: dukung `machine_id` pada list global + `machine_id`/`event_type` pada ekspor global (seperti Guide), atau hapus dari Guide dan panel.
- **Acceptance criteria:** `GET /api/v1/operational-events/?machine_id=CNC-MILLING-01&envelope=true` dan ekspor global dengan `machine_id`+`event_type` di Real mode hanya mengembalikan baris yang cocok; API §I dan Guide §6.7/Lampiran A I mencantumkan parameter yang sama.

### SYS-B24 — Dukungan `event_type` pada `GET /system/audit` tidak ada di dokumen; panel bisa mengirimnya (via URL) dan demo mengabaikannya — Medium
- **Area:** System audit.
- **Perilaku panel:** `httpMonitoring.getSystemAuditPage` (`src/services/api/http/monitoring.ts:156-180`) mengirim `event_type` bila terisi; `useSystemAuditQuery` (`src/features/shared/useHistoricalQueries.ts:166-190`) meneruskan `filters.eventType`; `parseHistoryFiltersFromSearchParams` (`src/features/shared/historyFilters.ts:107-108`) membaca `event_type` dari query string URL — jadi `?event_type=MASTER_DATA_MUTATION` diteruskan ke backend meski `AuditTrailPage.tsx` sendiri tidak punya kontrol UI untuk itu (hanya filter From/To).
- **Acuan dokumen:** API §I (~897-900): query `/system/audit` "sama dengan operational-events (`from`, `to`, `limit`, `cursor`, `envelope`)" — tanpa `event_type` dan tanpa `machine_id`. Guide §6.7 dan Lampiran A I: daftar yang sama, tanpa `event_type`.
- **Yang hilang/tidak cocok:** Tidak jelas apakah backend menerima, mengabaikan, atau menolak (400 validasi Zod) parameter `event_type` di endpoint ini. Demo (`src/services/api/demo/monitoring.ts:347-376`) merekam query string berisi `event_type` tapi **hanya memfilter `from`/`to`** — demo mengabaikannya, jadi perilaku Demo ≠ Real bila backend ternyata memfilternya (atau menolaknya).
- **Perubahan backend yang dibutuhkan:** Tambahkan `event_type` ke `GET /system/audit` secara terdokumentasi, ATAU nyatakan resmi bahwa parameter tak dikenal diabaikan (bukan 400). Selaraskan demo untuk memfilter `event_type` seperti halnya backend.
- **Acceptance criteria:** `GET /api/v1/system/audit?event_type=MASTER_DATA_MUTATION&envelope=true` mengembalikan hanya baris yang cocok, atau dokumen menyatakan parameter diabaikan dan respons tetap 200; demo berperilaku sama.

### SYS-B25 — Bentuk envelope `meta` list tidak didefinisikan; paginasi cursor dan total bisa gagal diam-diam — Low
- **Area:** Semua list audit/operasional (`GET /operational-events*`, `GET /system/audit`).
- **Perilaku panel:** `reqList`/`pageMeta` (`src/services/api/http/primitives.ts:25-43`) membaca `meta.hasMore`/`has_more`, `meta.nextCursor`/`next_cursor`, `meta.count`/`total_count`; `splitList` menerima array polos atau `{data, meta}`. `AuditTrailPage.tsx` dan `OperationalEventsPage.tsx` memakai `pagination.has_more`/`next_cursor`/`total_count` untuk tombol next/prev dan total.
- **Acuan dokumen:** API §I hanya menulis respons "`OperationalEventItem[]` atau `{data, meta}`" — **isi `meta` tidak pernah didefinisikan** (tidak ada `next_cursor`, `has_more`, `count`, atau `total_count`). Disebutkan hanya bahwa `cursor` adalah Base64URL `t+id` dan opaque (Guide §4.7 menegaskan jangan mem-parse cursor — panel sudah patuh).
- **Yang hilang/tidak cocok:** Bila `meta` backend memakai kunci lain (mis. `cursor` bukan `next_cursor`, atau tidak ada `has_more`), tombol "next page" tidak pernah muncul dan `total_count` jatuh ke jumlah baris halaman saat itu — DataTable menampilkan total yang salah. Bila backend mengembalikan array polos, `has_more` selalu false (paginasi berhenti di halaman 1).
- **Workaround demo:** `paginateWithCursor` demo menghasilkan meta dengan kunci yang persis diharapkan panel, sehingga paginasi Demo selalu jalan.
- **Perubahan backend yang dibutuhkan:** Dokumentasikan skema envelope: `{data: OperationalEventItem[], meta: {limit, next_cursor: string|null, has_more: boolean, total_count?: number}}` (atau nyatakan array polos + `Link`/cursor di header sebagai alternatif).
- **Acceptance criteria:** Di Real mode, dengan >1 halaman data, tombol next pada `/audit` dan `/admin/system-audit` muncul dan mengembalikan halaman berikutnya; `total_count` (bila ditampilkan) cocok dengan jumlah server.

### SYS-B26 — System audit tidak bisa diekspor: tidak ada endpoint ekspor dan tidak ada tombolnya di UI — Low
- **Area:** System audit (ekspor).
- **Perilaku panel:** `AuditTrailPage.tsx` hanya punya tombol Refresh (`:147-148`) dan filter waktu — tidak ada `HistoricalExportToolbar` (berbeda dengan `OperationalEventsPage.tsx` yang punya toolbar ekspor + ack). Tidak ada method `exportSystemAudit` di client mana pun (grep tidak menemukan).
- **Acuan dokumen:** Tidak ada `GET /system/audit/export` di API maupun Guide; Guide §5 baris `/admin/system-audit` hanya menyebut "Audit mutasi sistem", tanpa ekspor.
- **Yang hilang/tidak cocok:** Pengguna tidak dapat mengunduh jejak audit sistem sama sekali, padahal operational events bisa diekspor (CSV/NDJSON/JSON, retensi 90 hari, rate limit 5/menit). Jalan pintas yang mungkin: karena `/system/audit` adalah alias feed `operational_events`, `GET /operational-events/export` (policy `refresh:telemetry`, ADMIN/SUPERVISOR, tanpa syarat LAN) mengekspor data yang sama — tapi otorisasinya berbeda (SUPERVISOR boleh, tanpa LAN) dan AuditTrailPage tidak menawarkannya.
- **Workaround demo:** Tidak ada (tidak ada tombol ekspor system audit di Demo maupun Real).
- **Perubahan backend yang dibutuhkan:** Tambahkan `GET /system/audit/export` (`from`, `to`, `event_type`, `format`, `limit` ≤100000, retensi + rate limit seperti export operational-events, ADMIN+LAN) ATAU dokumentasikan resmi bahwa `GET /operational-events/export` adalah jalur ekspor yang didukung untuk feed ini.
- **Acceptance criteria:** Tombol ekspor di `/admin/system-audit` mengunduh file CSV/NDJSON/JSON berisi feed yang sama dengan yang tampil di tabel; 400 RETENTION_EXCEEDED di luar 90 hari dan 429 pada rate limit berperilaku sama dengan ekspor operational-events.

### SYS-B27 — Tidak ada endpoint info/versi backend; SystemInfoPage murni statis — Low
- **Area:** System info.
- **Perilaku panel:** `src/features/system/SystemInfoPage.tsx` seluruhnya teks statis + mode otorisasi dari `authMe` + mode jaringan (LAN/tunnel). Tidak ada versi backend, build, nama layanan, atau identitas server yang ditampilkan.
- **Acuan dokumen:** Tidak ada endpoint yang mengembalikan versi backend: `GET /health` (§A) tidak punya field versi; `GET /api/v1/access-control/info` (API ~1215, Guide ~925) hanya mengembalikan mode otorisasi/`authzVersion`/`effectiveInMode` (cakupan IAM).
- **Yang hilang/tidak cocok:** Bila halaman "Informasi Sistem" kelak diharapkan menampilkan versi backend, tidak ada sumber datanya.
- **Workaround demo:** Tidak ada — halaman yang sama di Demo juga statis.
- **Perubahan backend yang dibutuhkan (opsional):** Tambahkan `version` (dan bila perlu `build`/`name`) ke respons `GET /health`, atau sediakan `GET /api/v1/system/info`.
- **Acceptance criteria:** SystemInfoPage menampilkan versi backend yang diambil dari server (bukan hardcode); sebelum endpoint ada, halaman tidak perlu diubah.

---

## C. MQTT Dynamic Security

### SYS-B28 — Rotasi password MQTT: http memakai POST, dokumen memakai PATCH — High
- **Area:** MQTT DynSec, rotasi password klien.
- **Perilaku panel:** `http/mqttDynsec.ts:118-132` `rotateMqttClientPassword()` mengirim `method: 'POST'` ke `/clients/:name/password` dengan body `{password}` — terverifikasi langsung di kode. Registry-nya sendiri benar: `endpoints/mqtt.ts` `MQTT_DYNSEC_CLIENTS_PASSWORD` = `PATCH`.
- **Acuan dokumen:** API §M tabel Klien `PATCH /clients/{name}/password` 200; Guide Lampiran O `PATCH …/password {password}`; Guide §9.1 butir 3.
- **Yang hilang/tidak cocok:** method salah. Bila backend hanya mendaftarkan PATCH (sesuai dokumen), rotasi dari panel Real mode gagal 404/405. Demo menyembunyikannya: `demo/mqttDynsec.ts` `rotateMqttClientPassword` hanya mutasi store lokal, tidak memakai HTTP.
- **Workaround demo:** Tidak ada — demo tidak mereplikasi method HTTP.
- **Perubahan backend yang dibutuhkan:** Tidak ada (bila backend ikut dokumen) — yang harus diperbaiki adalah panel (ubah ke PATCH). Bila backend ternyata hanya menerima POST, dokumen yang harus diperbaiki; perlu diputuskan satu sumber kebenaran.
- **Acceptance criteria:** `PATCH /api/v1/mqtt/dynamic-security/clients/<nama>/password` dengan `{password: "baruP@ssw0rd!"}` → 200; `POST` ke path yang sama → 404/405.

### SYS-B29 — Enable/disable klien MQTT: http memakai POST + `{disabled}`, dokumen memakai PATCH + `{enabled}` — High
- **Area:** MQTT DynSec, enable/disable (kick) klien.
- **Perilaku panel:** `http/mqttDynsec.ts:134-141` `toggleMqttClient()` mengirim `method: 'POST'`, body `{disabled: !enabled}` — terverifikasi langsung di kode. Registry benar (`PATCH`, `endpoints/mqtt.ts` `MQTT_DYNSEC_CLIENTS_ENABLE`).
- **Acuan dokumen:** API §M `PATCH /clients/{name}/enable`, `false` = nonaktifkan/kick; Guide Lampiran O `PATCH …/enable {enabled}`; Guide §9.1 butir 4.
- **Yang hilang/tidak cocok:** method DAN nama field terbalik (`disabled` vs `enabled`). Bila backend memvalidasi body secara ketat, request ditolak 400 (field `enabled` wajib) atau, lebih buruk, `disabled` diabaikan sehingga toggle tidak berpengaruh.
- **Workaround demo:** `demo/mqttDynsec.ts` `toggleMqttClient` set `c.enabled` langsung di store — perilaku demo benar, Real mode belum tentu.
- **Perubahan backend yang dibutuhkan:** Tidak ada bila backend ikut dokumen; panel harus diubah ke `PATCH {enabled: boolean}`. Bila backend memakai `{disabled}`, dokumen harus dikoreksi.
- **Acceptance criteria:** `PATCH …/enable {enabled:false}` → klien terputus/dinonaktifkan; `GET /clients/:name` sesudahnya menunjukkan nonaktif; `{enabled:true}` mengaktifkan kembali.

### SYS-B30 — Provisioning perangkat: http mengubah nilai `access` menjadi `telemetry` / `telemetry+state` — High
- **Area:** MQTT DynSec, buat klien mode provisioning (`CreateMqttClientModal.tsx` mode `device`, default `publish`).
- **Perilaku panel:** `http/mqttDynsec.ts:74,87` — `accessMap = {publish:'telemetry', subscribe:'telemetry+state', readwrite:'telemetry+state'}` (terverifikasi langsung di kode), lalu body provisioning dikirim `{username, password, deviceId, access: <hasil map>}`. `subscribe` dan `readwrite` dipetakan ke nilai yang sama sehingga keduanya tidak bisa dibedakan.
- **Acuan dokumen:** API §M "Provisioning perangkat" — body `{deviceId, access, username?, password?, textname?, textdescription?}`, dan Guide §7.2/§9.1 — `access = publish/subscribe/readwrite` (verbatim). API §M juga menjelaskan provisioning membuat peran per-device `device-<username>` dengan grant publish/subscribe eksplisit di bawah `oee/device/<deviceId>/#`.
- **Yang hilang/tidak cocok:** nilai `access` yang dikirim panel (`telemetry`, `telemetry+state`) tidak ada dalam enum dokumen. Bila backend memvalidasi enum, semua pembuatan klien mode device gagal 400; bila backend meneruskannya mentah ke dynsec, peran `device-<username>` yang terbentuk mendapat grant yang salah/tidak dikenal.
- **Workaround demo:** `demo/mqttDynsec.ts` `createMqttClient` tidak memakai `accessMap` sama sekali — ia menurunkan peran dari `access` secara lokal (`subscribe` → `telemetry_listener`, selain itu → `edge_publisher`), yang juga bukan peran `device-<username>` menurut dokumen. Jadi demo dan http saling berbeda, dan keduanya berbeda dari dokumen.
- **Perubahan backend yang dibutuhkan:** Tidak ada bila backend ikut dokumen (terima `publish|subscribe|readwrite` verbatim dan bentuk peran `device-<username>` + grant `oee/device/<deviceId>/#`); panel harus menghapus `accessMap` dan mengirim `access` apa adanya.
- **Acceptance criteria:** `POST /clients {username, deviceId:"STM32-03", access:"readwrite"}` → 201 + password sekali tampil; peran `device-<username>` terbentuk dengan grant publish+subscribe di `oee/device/STM32-03/#`; ulangi untuk `publish` saja dan `subscribe` saja dan pastikan grant-nya berbeda.

### SYS-B31 — Tambah peran ke klien: http mengirim `{roles:[{rolename, priority}]}`, dokumen memakai `{rolename, priority?}` — High
- **Area:** MQTT DynSec, assign peran ke klien (`AttachRoleModal`, `useMqttClientMutations.ts:78`).
- **Perilaku panel:** `http/mqttDynsec.ts:157-159` body `{roles: [{rolename, priority}]}` (priority default 1) — terverifikasi langsung di kode.
- **Acuan dokumen:** Guide Lampiran O `POST /clients/:name/roles {rolename, priority?}` → 201.
- **Yang hilang/tidak cocok:** bentuk body dibungkus array dengan nama field jamak. Bila backend mengikuti dokumen, request gagal validasi 400. Pola yang sama berulang di SYS-B32, B36, B37 — kemungkinan panel mengikuti bentuk native Mosquitto dynsec, sedangkan dokumen menyederhanakannya menjadi objek tunggal; mana yang benar tidak bisa dipastikan dari dokumen saja (lihat § "Pertanyaan terbuka", D-5).
- **Workaround demo:** `demo/mqttDynsec.ts` `addMqttClientRole` hanya push string ke array lokal — bentuk body HTTP tidak pernah diuji demo.
- **Perubahan backend yang dibutuhkan:** Tetapkan satu bentuk dan dokumentasikan; bila backend memakai bentuk dokumen, panel harus mengirim `{rolename, priority}`.
- **Acceptance criteria:** `POST /clients/:name/roles {rolename:"edge_publisher", priority:1}` → 201 dan `GET /clients/:name` memuat peran tersebut.

### SYS-B32 — Tambah ACL ke peran: http mengirim `{acls:[acl]}`, dokumen memakai objek ACL tunggal `{acltype, topic, ...}` — High
- **Area:** MQTT DynSec, ACL peran (`AddAclModal`, `useMqttRoleMutations.ts:34-37` mengirim `{acltype, topic, allow}` tanpa `priority`).
- **Perilaku panel:** `http/mqttDynsec.ts:246-248` body `{acls: [acl]}`.
- **Acuan dokumen:** Guide Lampiran O `POST /roles/:name/acls {acltype, topic, ...}` → 201; API §M `POST /roles/{name}/acls` 201.
- **Yang hilang/tidak cocok:** pembungkusan array + field `allow`/`priority` tidak disebut di dokumen sama sekali (dokumen hanya menyebut `acltype, topic, ...` — isi `...` tidak didefinisikan). Sebaliknya, penghapusan ACL sudah cocok: `http/mqttDynsec.ts` `removeMqttRoleAcl` mengirim `DELETE` body `{acltype, topic}` sesuai API §M.
- **Workaround demo:** `demo/mqttDynsec.ts` `addMqttRoleAcl` push objek ACL lokal `{acltype, topic, allow}` (tanpa `priority` juga) — demo tidak mereplikasi bentuk HTTP.
- **Perubahan backend yang dibutuhkan:** Dokumentasikan bentuk ACL yang diterima secara eksplisit (apakah `allow` dan `priority` didukung; apakah body objek tunggal atau `{acls:[...]}`), lalu samakan dengan panel.
- **Acceptance criteria:** `POST /roles/:name/acls` dengan bentuk yang didokumentasikan → 201; `GET /roles/:name` menampilkan ACL baru dengan `acltype/topic/allow/priority` yang sama seperti dikirim.

### SYS-B33 — Buat klien: password kosong dikirim sebagai string kosong; auto-generate tidak dijamin dokumen; field `textname`/`textdescription`/`groups`/`clientid` dibuang di sebagian mode — High (untuk password), Low (untuk field yang dibuang)
- **Area:** MQTT DynSec, buat klien (kedua mode).
- **Perilaku panel:** `http/mqttDynsec.ts:75-88` — bila `password` kosong, body tetap berisi `password: data.password ?? ''` (string kosong, bukan field yang dihilangkan); mode eksplisit membuang `textname/textdescription/groups` (hanya `username/password/clientid/roles` yang dikirim); mode provisioning membuang `clientid/textname/textdescription/groups` (hanya `username/password/deviceId/access`). UI-nya pun tidak mengumpulkan field-field itu (`CreateMqttClientModal.tsx` hanya punya username/password/deviceId/access/roles).
- **Acuan dokumen:** API §M — "Password tidak pernah dicatat atau dikembalikan ulang setelah pembuatan (`generatePassword()` hanya sekali)"; Guide §9.1 butir 2 — password dikembalikan sekali pada respons 201; Guide §7.2 — `POST /clients` menerima `{username,password,roles:[...]}` atau `{username,password,deviceId,access}` (password tampak wajib); contoh cURL API §M selalu menyertakan password eksplisit. Tidak ada satu pun kalimat dokumen yang menyatakan backend meng-generate password bila `password` kosong/dihilangkan. Sebaliknya API §M menyebut body provisioning boleh berisi `textname?, textdescription?`.
- **Yang hilang/tidak cocok:** (a) UI menjanjikan "Kosongkan kata sandi jika ingin sistem membuatkan kata sandi acak otomatis" (`CreateMqttClientModal.tsx` subtitle) — janji ini hanya dipenuhi demo (`demo/mqttDynsec.ts` meng-generate `dynsec_<acak>` bila password kosong); di Real mode string kosong kemungkinan ditolak backend (min 8, Guide §7.2) sehingga pembuatan klien tanpa password gagal 400; (b) bila backend ternyata meng-generate, perilaku itu tidak terdokumentasi; (c) `textname`/`textdescription`/`groups` tidak bisa diisi dari panel sama sekali.
- **Perubahan backend yang dibutuhkan:** Dukung dan dokumentasikan salah satu: (i) `password` opsional → backend generate + kembalikan sekali (dan panel harus mengirim field-nya dihilangkan, bukan `""`), atau (ii) `password` wajib min 8 → panel harus mewajibkan input. Serta nyatakan apakah `textname/textdescription/groups/clientid` diterima pada `POST /clients`.
- **Acceptance criteria:** `POST /clients` tanpa `password` (atau password kosong, sesuai kontrak yang ditetapkan) → 201 + password sekali tampil yang langsung bisa dipakai login MQTT; `POST /clients` dengan `password:"pendek"` → 400 `VALIDATION_ERROR`/`WEAK_PASSWORD`.

### SYS-B34 — Bentuk respons `POST /clients` (password sekali tampil) tidak dinamai di dokumen — Medium
- **Area:** MQTT DynSec, buat klien.
- **Perilaku panel:** `http/mqttDynsec.ts:99-100` menebak dua bentuk: `client = raw.client ?? raw`, `generatedPassword = raw.generatedPassword ?? raw.password`. Modal sekali tampil (`OneTimeSecretModal`, `useMqttClientMutations.ts:26-29`) hanya muncul bila `generatedPassword` terisi.
- **Acuan dokumen:** API §M dan Guide §9.1 hanya menyebut "password dikembalikan sekali dalam respons 201" tanpa nama field dan tanpa contoh JSON respons. Demo mengembalikan `{client, generatedPassword}` (`demo/mqttDynsec.ts`).
- **Yang hilang/tidak cocok:** bila backend memakai nama lain (mis. `generated_password`, atau password menempel di dalam objek klien, atau envelope `{data:{...}}`), panel tidak menampilkan secret — dan karena password tidak pernah bisa dibaca ulang (API §M), kredensial itu hilang permanen bagi admin; satu-satunya jalan adalah rotasi (SYS-B28).
- **Workaround demo:** demo selalu mengembalikan `generatedPassword` sehingga modal selalu tampil di demo.
- **Perubahan backend yang dibutuhkan:** Tetapkan dan dokumentasikan bentuk respons, mis. `201 {client: {...}, generatedPassword: "..."}` atau yang setara, dan pastikan nama field konsisten.
- **Acceptance criteria:** Buat klien via `POST /clients` di Real mode → respons memuat password pada field yang didokumentasikan; panel menampilkannya di `OneTimeSecretModal` tepat satu kali; `GET /clients/:name` sesudahnya tidak lagi memuat password.

### SYS-B35 — Mapper `mapMqttClient`: logika `enabled` bisa terbalik bila backend mengembalikan `enabled:false` — Medium (kontingen pada bentuk respons)
- **Area:** MQTT DynSec, pemetaan klien.
- **Perilaku panel:** `mappers/system.ts:14-29` — `enabled: bool(pick(r.enabled, r.disabled) === undefined ? true : !bool(r.disabled, false), true)`. Bila backend mengembalikan `{enabled:false}` tanpa field `disabled`, hasilnya `!bool(undefined,false)` = `true` — klien nonaktif ditampilkan aktif. Bila backend mengembalikan `{disabled:true}`, hasilnya benar (`false`).
- **Acuan dokumen:** dokumen tidak memberi contoh JSON satu pun untuk objek klien/peran/grup dynsec (hanya status HTTP) — tidak diketahui apakah backend memakai `enabled` atau `disabled`, atau bentuk native dynsec.
- **Yang hilang/tidak cocok:** kontrak bentuk respons dynsec sepenuhnya tidak tertulis (lihat juga § "Pertanyaan terbuka" D-5/D-6); mapper panel menebak-nebak dan mengandung cabang yang salah untuk satu dari dua kemungkinan bentuk.
- **Workaround demo:** seed memakai `enabled:true` (`src/services/api/seeds/mqtt.ts`), sehingga cabang yang salah tidak pernah terpicu di demo.
- **Perubahan backend yang dibutuhkan:** Dokumentasikan bentuk objek klien (nama field status + bentuk `roles`/`groups`: string atau objek `{rolename/priority}`/`{groupname}` — mapper panel menangani keduanya, `mappers/system.ts:16-17`).
- **Acceptance criteria:** Buat klien, nonaktifkan via `PATCH …/enable {enabled:false}`, lalu `GET /clients/:name` → panel menampilkan nonaktif; aktifkan kembali → tampil aktif.

### SYS-B36 — Tambah klien ke grup: http mengirim `{clients:[{username}]}`, dokumen memakai `{username, priority?}` — Medium
- **Area:** MQTT DynSec, keanggotaan grup (`MqttGroupModals.tsx:107`, `useMqttGroupMutations.ts:41`).
- **Perilaku panel:** `http/mqttDynsec.ts:335-337` body `{clients: [{username}]}` — `priority` tidak pernah dikirim (UI tidak punya input priority).
- **Acuan dokumen:** Guide Lampiran O `POST /groups/:name/clients {username, priority?}` → 201.
- **Yang hilang/tidak cocok:** sama seperti SYS-B31/B32 (array vs objek tunggal) + `priority` tidak tersampaikan.
- **Workaround demo:** `demo/mqttDynsec.ts` `addMqttGroupClient` push string lokal + sinkronisasi balik `client.groups`.
- **Perubahan backend yang dibutuhkan:** Sama seperti SYS-B31 — tetapkan satu bentuk body.
- **Acceptance criteria:** `POST /groups/:name/clients {username:"edge_stm32_01"}` → 201; `GET /groups/:name` memuat klien tersebut.

### SYS-B37 — Tambah peran ke grup: http mengirim `{roles:[{rolename}]}`, dokumen memakai `{rolename, priority?}` — Medium
- **Area:** MQTT DynSec, peran grup (`MqttGroupModals.tsx:132`, `useMqttGroupMutations.ts:53`).
- **Perilaku panel:** `http/mqttDynsec.ts:367-369` body `{roles: [{rolename}]}` — tanpa `priority`.
- **Acuan dokumen:** Guide Lampiran O `POST /groups/:name/roles {rolename, priority?}` → 201.
- **Yang hilang/tidak cocok / workaround / acceptance:** analog dengan SYS-B36.
- **Perubahan backend yang dibutuhkan:** Sama seperti SYS-B36 — tetapkan satu bentuk body.
- **Acceptance criteria:** `POST /groups/:name/roles {rolename:"edge_publisher"}` → 201; `GET /groups/:name` memuat peran tersebut.

---

## D. MQTT Configuration & Overview

### SYS-B38 — `GET /mqtt/configuration` tanpa trailing slash; dokumen API mewajibkan trailing slash — Medium
- **Area:** MQTT Config, baca konfigurasi aktif.
- **Perilaku panel:** `endpoints/mqtt.ts:182-187` `MQTT_CONFIG_GET` template/buildPath = `/api/v1/mqtt/configuration` (tanpa `/` akhir); dipakai `http/mqttConfig.ts:19`.
- **Acuan dokumen:** API §3.3b — "`GET /` … **Wajib trailing slash** — `/api/v1/mqtt/configuration/`". Guide Lampiran P menulis path yang sama tanpa slash — dokumen saling bertentangan (lihat § "Pertanyaan terbuka" D-3).
- **Yang hilang/tidak cocok:** bila backend Fastify membedakan trailing slash secara ketat, `GET` konfigurasi aktif gagal 404 dan halaman `BrokerConfigManagerPage` tidak pernah mendapat draft (`useBrokerConfig.ts:68`). Test transport repo hanya membuktikan trailing slash untuk `/operational-events/` (`modeAndTransport.test.ts:93,212,272`), bukan untuk rute ini.
- **Workaround demo:** demo tidak memakai HTTP sehingga tidak terlihat.
- **Perubahan backend yang dibutuhkan:** Terima kedua bentuk (tanpa dan dengan trailing slash) atau tegaskan satu bentuk di dokumen dan samakan dengan panel.
- **Acceptance criteria:** `GET /api/v1/mqtt/configuration` dan `GET /api/v1/mqtt/configuration/` keduanya → 200 dengan model terstruktur yang sama.

### SYS-B39 — Stage konfigurasi: panel mengirim `{config, summary}`, dokumen memakai `{config, baseVersionId?, reason?, comment?}` — Medium
- **Area:** MQTT Config, stage kandidat (`useBrokerConfig.ts:112`, `handleStageConfig`).
- **Perilaku panel:** `http/mqttConfig.ts:85-91` `stageBrokerConfig(newConfig, summary)` mengirim body `{config: newConfig, summary}`. Tidak pernah mengirim `baseVersionId`, `reason`, atau `comment`.
- **Acuan dokumen:** Guide Lampiran P `POST /configurations {config, baseVersionId?, reason?, comment?}` → 201/422; API §3.3b "Stage kandidat konfigurasi (validasi, diff, dampak)".
- **Yang hilang/tidak cocok:** (a) field `summary` tidak ada dalam daftar dokumen — bila backend memakai Zod strict, request ditolak 400; bila diabaikan, versi staged kehilangan ringkasan (mapper panel `mapBrokerConfigVersion` di `mappers/system.ts:63-76` mengambil `summary ?? reason ?? comment ?? ''`, jadi tampil kosong); (b) `baseVersionId` tidak pernah dikirim — parent versi harus ditebak backend (demo menebaknya dari versi ACTIVE, `demo/mqttConfig.ts` `stageBrokerConfig`); (c) `reason`/`comment` tidak ada jalurnya dari UI (hanya ada `stageSummary`).
- **Workaround demo:** demo membuat `version_id: cfg-staged-<acak>`, `parent_version_id` = versi ACTIVE, `summary` = input — semua diisi lokal.
- **Perubahan backend yang dibutuhkan:** Dokumentasikan dan terima field yang panel kirim, atau nyatakan bahwa `summary` adalah alias `reason`/`comment` dan `baseVersionId` boleh kosong (default = versi aktif).
- **Acceptance criteria:** `POST /configurations {config, summary:"…"}` → 201 dengan `version_id`, `parent_version_id` = versi aktif, dan `summary`/`reason` yang sama seperti dikirim, terlihat di `GET /configurations`.

### SYS-B40 — Detail error 422 staging: dokumen menyebut field `details`, panel hanya mem-parsing `issues` — Medium
- **Area:** MQTT Config, validasi kandidat (422).
- **Perilaku panel:** `useBrokerConfig.ts:126-128` menampilkan `err.issues` bila ada; `ApiErrorEnvelopeSchema` (`schemas/transport.ts:97-111`) hanya mem-parsing `{error, message, active_wo_id?, issues?}` — tidak ada field `details`.
- **Acuan dokumen:** API §2 envelope error standar `{error, message, issues?}`; TAPI API §3.3b/§2 tabel error menyebut 422 `CONFIG_VALIDATION_FAILED` "(detail pada `details`)". Dokumen tidak konsisten antara `issues` dan `details`.
- **Yang hilang/tidak cocok:** bila backend mengirim detail validasi di `details`, panel membuangnya — pengguna hanya melihat pesan generik tanpa tahu field mana yang salah. Demo mengisi `issues` (`demo/mqttConfig.ts` `stageBrokerConfig` melempar 422 dengan `issues: [{field, message}]`), sehingga perilaku demo tidak membuktikan perilaku Real.
- **Perubahan backend yang dibutuhkan:** Tetapkan satu tempat detail validasi (`issues` sesuai envelope §2, atau `details`) dan dokumentasikan bentuk tiap item (`{field, message}`).
- **Acceptance criteria:** `POST /configurations` dengan kandidat invalid (mis. 0 listener) → 422 `CONFIG_VALIDATION_FAILED` dengan detail per-field yang tampil di UI sebagai `validationIssues` di `useBrokerConfig.ts`.

### SYS-B41 — Apply/rollback: panel tidak mengirim `acknowledgeUnvalidated`, dan hanya polling operasi satu kali — Medium
- **Area:** MQTT Config, apply/rollback async.
- **Perilaku panel:** `http/mqttConfig.ts:154-163,185-192` mengirim `{confirm: <default true>, reason?}` tanpa `acknowledgeUnvalidated`; `useBrokerConfig.ts:159-169` `handleConfirmExecute` memanggil `getBrokerConfigOperation()` tepat satu kali segera setelah apply/rollback, lalu melaporkan status hasil poll itu sebagai status akhir ("`APPLY … selesai (Operation …: <status>)`").
- **Acuan dokumen:** Guide Lampiran P — apply/rollback `{confirm: true, acknowledgeUnvalidated?, reason?}` → 202; Guide §9.2 — "Jangan menutup dialog sebelum operasi mencapai status akhir; jangan retry `POST` apply secara otomatis"; API §3.3b — apply/rollback "secara async".
- **Yang hilang/tidak cocok:** (a) tidak ada checkbox/input `acknowledgeUnvalidated` di UI (`BrokerConfirmModal`), sehingga versi yang belum tervalidasi tidak bisa di-apply bila backend mensyaratkannya (kemungkinan 400/409); (b) operasi async butuh polling hingga status terminal (`SUCCEEDED`/`FAILED`), panel hanya poll sekali — bila operasi masih `PENDING`/`RUNNING`, feedback menyesatkan; (c) demo menutupi keduanya karena apply/rollback demo sinkron dan langsung `SUCCEEDED` (`demo/mqttConfig.ts` `applyBrokerConfigVersion`/`rollbackBrokerConfig`).
- **Perubahan backend yang dibutuhkan:** Dokumentasikan kapan `acknowledgeUnvalidated` wajib, status apa saja yang mungkin (`PENDING/RUNNING/SUCCEEDED/FAILED`), dan apakah `GET /operations/:id` boleh di-poll berulang.
- **Acceptance criteria:** Apply versi staged → 202 + `operation_id`; polling `GET /operations/:id` hingga terminal; UI menampilkan status terminal yang benar; apply versi unvalidated tanpa `acknowledgeUnvalidated` → error yang jelas, dengan `acknowledgeUnvalidated:true` → lanjut.

### SYS-B42 — `POST /backups` tidak ada di dokumen (endpoint hantu); tidak ada restore/download backup — Medium
- **Area:** MQTT Config, backup.
- **Perilaku panel:** `http/mqttConfig.ts:248` `createBrokerConfigBackup()` mengirim `POST /api/v1/mqtt/configuration/backups` memakai ulang kunci endpoint `MQTT_CONFIG_BACKUPS` (yang terdaftar sebagai GET). Tidak ada pemanggil di UI maupun demo (grep seluruh `src` — hanya definisinya yang ada; `BrokerBackupsTab.tsx` hanya me-render list `filename/version_id/size_bytes/created_at`, tanpa tombol buat/restore/unduh).
- **Acuan dokumen:** API §3.3b dan Guide Lampiran P hanya mengenal `GET /backups` ("Inventaris backup (metadata saja)"). Tidak ada endpoint buat/restore/unduh backup di dokumen mana pun. Satu-satunya "restore" yang didokumentasikan adalah rollback versi (`POST /configurations/:versionId/rollback`).
- **Yang hilang/tidak cocok:** (a) bila `createBrokerConfigBackup` suatu saat dipanggil di Real mode, request gagal 404/405; (b) dari sisi kebutuhan panel: backup hanya bisa dilihat, tidak bisa dibuat/dipulihkan/diunduh lewat API — padahal demo mengarang backup baru di tiap apply (`demo/mqttConfig.ts` `applyBrokerConfigVersion` unshift `brokerBackups`), sehingga demo memberi kesan backup dibuat otomatis saat apply, padahal dokumen tidak menjanjikan itu.
- **Workaround demo:** Demo mengarang backup baru di tiap apply (lihat (b)).
- **Perubahan backend yang dibutuhkan:** (i) Hapuskan/tidak usah mengimplementasikan `POST /backups` (dan panel menghapus method-nya), ATAU (ii) bila diinginkan, daftarkan `POST /backups` (+ bila perlu `GET /backups/:id/download` dan restore) di dokumen; (iii) nyatakan apakah apply otomatis membuat backup.
- **Acceptance criteria:** `GET /backups` → inventaris metadata; `POST /backups` → 404 yang terdokumentasi (bila tidak diimplementasikan) atau 201 (bila diimplementasikan); tidak ada aksi UI yang memanggil endpoint yang tidak ada.

### SYS-B43 — Model konfigurasi terstruktur tidak dispesifikasi; field, default, dan enum status versi/operasi ditebak panel — Medium
- **Area:** MQTT Config, `GET /` dan `GET /configurations(/:versionId)`.
- **Perilaku panel:** `http/mqttConfig.ts:14-56` `getBrokerConfig()` memetakan `general {per_listener_settings, allow_anonymous, autosave_interval_seconds, persistence, persistence_location, log_dest, log_type, connection_messages}`, `limits {max_connections, max_packet_size_bytes, max_queued_messages, max_queued_bytes, max_inflight_messages}`, plus `listeners/tls_profiles/bridges` diteruskan mentah, dengan default buatan bila field hilang (mis. `autosave_interval_seconds` 300, `max_connections` 1000, `max_packet_size_bytes` 268435456). `BrokerConfigEditorTab.tsx:26-69` hanya bisa mengedit `general.autosave_interval_seconds`, `allow_anonymous`, `limits.max_connections`, `limits.max_queued_messages` — listener/TLS/bridge tidak bisa diedit, tapi ikut terkirim ulang utuh saat stage. `mapBrokerConfigVersion` (`mappers/system.ts:63-76`) mengasumsikan `version_id/parent_version_id/applied_at/applied_by/summary/operation_type/status/config`; enum status panel `STAGED|APPLIED|ACTIVE|ROLLED_BACK` dan `operation_type RELOAD|RESTART|NO_OPERATION` (`types/mqtt.ts`).
- **Acuan dokumen:** API §3.3b hanya menyebut "Konfigurasi Mosquitto terstruktur saat ini (kredensial diredaksi)" dan "Metadata versi, model ter-mask, diff ter-redaksi" — tanpa satu pun contoh JSON atau daftar field. Dokumen `docs/mosquitto-configuration-manager.md` yang dirujuk Lampiran B tidak termasuk dalam berkas acuan, jadi tidak bisa diverifikasi dari sini.
- **Yang hilang/tidak cocok:** tidak ada kontrak yang bisa diuji — nama key, satuan, nilai default, dan enum status semuanya asumsi panel/seed (`src/services/api/seeds/mqtt.ts` `INITIAL_BROKER_CONFIG` memakai `version: '2.0.18-rel-4'`, listener 1883/9001/8883, dsb.). Bila backend memakai key mosquitto.conf mentah (`autosave_interval`, `max_connections` per listener, dsb.) atau enum berbeda, GET akan terisi default palsu dan stage bisa ditolak 422 atau menghilangkan field.
- **Workaround demo:** seed + store lokal memakai bentuk panel sendiri, sehingga round-trip demo selalu konsisten dengan sendirinya.
- **Perubahan backend yang dibutuhkan:** Publikasikan skema JSON konfigurasi terstruktur (field, tipe, satuan, default, field yang diredaksi), enum `status` versi dan `type/status` operasi, dan contoh `GET /` + `GET /configurations/:versionId`.
- **Acceptance criteria:** `GET /api/v1/mqtt/configuration/` dan `GET /configurations` di Real mode mengembalikan field yang sama dengan skema yang didokumentasikan; edit `max_connections` di UI → stage → `GET /configurations/:versionId` menunjukkan nilai baru; tidak ada field yang hilang dalam round-trip.

### SYS-B44 — Overview: bentuk dalam `{dynamicSecurity, configuration}` tidak dispesifikasi; `null` (plugin nonaktif) diubah panel menjadi nilai yang menyesatkan — Low
- **Area:** MQTT Overview (`BrokerOverviewPage.tsx`).
- **Perilaku panel:** `mapBrokerOverview` (`mappers/system.ts:169-189`) — bila `dynamicSecurity`/`configuration` null, hasilnya `enabled:false, status:'DISCONNECTED', counts 0` dan `configuration.status:'IN_SYNC', activeVersionId:null, mutationLocked:false`. Halaman menampilkan badge `DISABLED` bila `enabled` false, tapi kartu Config tetap menampilkan badge `IN_SYNC` (`BrokerOverviewPage.tsx`).
- **Acuan dokumen:** API §3.3a — respons `200 {dynamicSecurity: object | null, configuration: object | null}` ("null bila plugin terkait tidak aktif"); "Metrik versi/uptime/throughput broker tidak disediakan". Tidak ada contoh isi kedua objek itu. Otorisasi: butuh `read:mqtt_admin` + `read:mqtt_configuration` (efektif ADMIN-only) — ini sudah benar di panel (halaman dikunci bila capability `mqtt.overview.read` tidak ada).
- **Yang hilang/tidak cocok:** (a) field dalam `dynamicSecurity` (panel menebak `enabled/status/clientsCount/rolesCount/groupsCount`, demo memakai bentuk itu) dan dalam `configuration` (panel menebak `status/activeVersionId/lastAppliedAt/mutationLocked`) tidak terdokumentasi; (b) `configuration: null` seharusnya tampil sebagai "tidak tersedia", bukan `IN_SYNC`.
- **Workaround demo:** `demo/mqttDynsec.ts` `getBrokerOverview` selalu mengembalikan kedua objek terisi dari store.
- **Perubahan backend yang dibutuhkan:** Dokumentasikan field dalam kedua objek + perilaku saat plugin nonaktif.
- **Acceptance criteria:** `GET /mqtt/overview` dengan plugin nonaktif → panel menampilkan "tidak tersedia" (bukan `IN_SYNC` + 0); dengan plugin aktif → angka clients/roles/groups sama dengan `GET /dynamic-security/clients|roles|groups`.

---

## E. Master Data (Lines / Shifts / Schedules) & Operators

### SYS-B45 — Filter Shift Schedules: panel memakai snake_case, Guide memakai camelCase — Medium (konflik dokumen)
- **Area:** Shift Schedules, filter list (`ShiftSchedulesPage.tsx:35-37,60-65` — filter line/shift/hari).
- **Perilaku panel:** `http/production.ts` `getShiftSchedulesPage` mengirim query `line_id, shift_id, day_of_week, is_active`; demo memakai nama yang sama.
- **Acuan dokumen (bertentangan):** API §P.1 — "Filter query `line_id`, `day_of_week`, `shift_id`, `is_active`". Guide Lampiran N — "Filter query `lineId`, `dayOfWeek`, `shiftId`, `isActive`". Kedua dokumen bertentangan; panel mengikuti API.
- **Yang hilang/tidak cocok:** bila backend mengikuti Guide (camelCase), filter panel diabaikan diam-diam — halaman menampilkan semua jadwal seolah-olah filter tidak bekerja; bila backend mengikuti API, semuanya benar. Tidak ada cara membedakan dari dokumen saja.
- **Perubahan backend yang dibutuhkan:** Terima kedua bentuk (atau tetapkan satu dan perbaiki dokumen yang salah).
- **Acceptance criteria:** `GET /shift-schedules?line_id=LINE-01&day_of_week=1` dan bentuk camelCase yang setara mengembalikan himpunan yang sama (atau salah satunya terdokumentasi sebagai satu-satunya yang benar dan panel disesuaikan).

### SYS-B46 — Respons list/detail Shift Schedule: field denormalisasi (`shiftName/shiftCode/startTime/endTime`) tidak dijamin dokumen — Medium
- **Area:** Shift Schedules, tampilan tabel.
- **Perilaku panel:** `ShiftSchedulesPage.tsx:304-306` menampilkan `{sch.shiftName ?? sch.shiftId}` dan `{sch.startTime}–{sch.endTime}` bila ada; `mapShiftSchedule` (`mappers/assets.ts:111-127`) membaca keempat field itu sebagai opsional; halaman sudah memuat daftar shifts (`ShiftSchedulesPage.tsx:90-91`) tapi tidak menggunakannya untuk melengkapi jam.
- **Acuan dokumen:** API §P.2 — detail "termasuk `shiftName`, `shiftCode`" (tidak menyebut `startTime`/`endTime`); §P.1 list tidak memberi contoh respons sama sekali. Demo selalu mengisi keempat field (denormalisasi saat create/update, `demo/production.ts`).
- **Yang hilang/tidak cocok:** bila backend list/detail hanya mengembalikan `shiftName/shiftCode` (sesuai dokumen), kolom jam di tabel Real mode kosong, padahal di demo terisi — degradasi tampilan yang hanya terlihat di Real mode.
- **Perubahan backend yang dibutuhkan:** Sertakan `startTime` dan `endTime` (dari shift yang dirujuk) pada list dan detail schedule, atau dokumentasikan bahwa panel harus join dengan `GET /shifts`.
- **Acceptance criteria:** `GET /shift-schedules?line_id=LINE-01` → tiap item memuat `shiftName, shiftCode, startTime, endTime` yang konsisten dengan `GET /shifts/:shiftId`.

### SYS-B47 — Operators: `is_active` pada create dihilangkan http; proteksi `ADM-001` berbeda status demo vs dokumen — Low
- **Area:** Operators, create + status.
- **Perilaku panel:** `http/operators.ts:36-40` — input `createOperator` menerima `is_active?`, tapi body yang dikirim hanya `{operatorId, operatorName, role, password, lineId}`. UI juga tidak menyediakan pilihan status awal (`useOperatorCrud.ts:52-58` tidak mengirim `is_active`; `OperatorCreateModal.tsx` tidak punya toggle aktif).
- **Acuan dokumen:** API §H.3 — body contoh `{operatorId, operatorName, role, password, lineId}` (tanpa `isActive`), respons 201 `isActive:true`. Jadi backend default `true` adalah perilaku yang didokumentasikan — bukan gap backend. Yang hilang hanyalah kemampuan membuat operator langsung nonaktif; bila itu diinginkan, perlu field `isActive` di request.
- **Sisi lain (demo vs dokumen, bukan backend):** demo `toggleOperatorStatus` melempar `PROTECTED_ACCOUNT` **403** saat menonaktifkan `ADM-001` (`demo/operators.ts`), padahal API §H.7 dan Guide §7.3 menetapkan **400** untuk penonaktifan/ubah-role akun root (403 hanya untuk hapus). Dampaknya hanya di demo, tapi perlu dicatat karena transport panel (`http/transport.ts` `reqJson`) menurunkan capability pada setiap 403 — bila backend keliru mengembalikan 403 di sini, capability `operator.status.update` akan salah diturunkan.
- **Perubahan backend yang dibutuhkan:** (i) Nyatakan apakah `isActive` diterima di `POST /operators`; (ii) pastikan penonaktifan `ADM-001` → 400 `PROTECTED_ACCOUNT`, hapus `ADM-001` → 403 `PROTECTED_ACCOUNT` (sesuai Guide §7.3).
- **Acceptance criteria:** `POST /operators` tanpa `isActive` → 201 `isActive:true`; `PATCH /operators/ADM-001/status {isActive:false}` → 400 `PROTECTED_ACCOUNT`; `DELETE /operators/ADM-001` → 403 `PROTECTED_ACCOUNT`.

### SYS-B48 — List DynSec & Operators tanpa pagination/filter server-side; panel mengambil semua — Low
- **Area:** MQTT DynSec lists, Operators list.
- **Perilaku panel:** `http/mqttDynsec.ts` `getMqttClients/Roles/Groups` memakai `reqList(..., 100)` tanpa query `limit/envelope/cursor`; `http/operators.ts` `getOperators` memakai `reqList(..., 50)` tanpa query. Filter operator (search/role/status) dilakukan client-side (`useOperators.ts`).
- **Acuan dokumen:** dokumen tidak mendefinisikan parameter pagination/filter untuk ketiga list dynsec maupun `GET /operators` (contoh respons §H.1 berupa array polos). Sebaliknya, Lines/Shifts/Schedules sudah didokumentasikan cursor pagination dan panel sudah mengirim `limit+envelope+cursor` — bagian itu cocok.
- **Yang hilang/tidak cocok:** bukan pelanggaran dokumen, tapi risiko diam-diam: bila backend membatasi list secara default (mis. 50) tanpa `meta.hasMore` yang dibaca panel, panel memotong data tanpa tahu; dan tidak ada pencarian server-side untuk roster besar.
- **Perubahan backend yang dibutuhkan:** Dokumentasikan apakah list ini selalu lengkap (array polos) atau memakai cursor pagination + `limit` maksimum; bila berpaginasi, panel harus mengikuti `nextCursor`.
- **Acceptance criteria:** Buat >100 klien dynsec (atau >50 operator) → panel menampilkan semuanya atau memaginasi dengan benar, bukan terpotong diam-diam.

### SYS-B49 — Hapus Production Line: demo memblokir bila line dipakai operator; dokumen hanya menyebut machines + snapshot WO — Low
- **Area:** Production Lines, delete guard.
- **Perilaku panel (demo):** `demo/production.ts` `deleteProductionLine` melempar 409 `PRODUCTION_LINE_IN_USE` bila ada machine ATAU operator yang merujuk line. Perilaku Real: panel hanya memanggil `DELETE` dan mengandalkan 409 backend (`http/production.ts` `deleteProductionLine`).
- **Acuan dokumen:** API §N.5 + Guide Lampiran L — guard: masih dirujuk `machines` atau `work_order` snapshot → 409 `PRODUCTION_LINE_IN_USE`; FK `machines.line_id ON DELETE RESTRICT`. Operator tidak disebut sebagai pemblokir.
- **Yang hilang/tidak cocok:** dua arah — (a) demo memblokir hapus yang di Real mode mungkin diizinkan (line hanya dipakai operator), meninggalkan operator menunjuk line yang sudah terhapus; (b) demo TIDAK memeriksa snapshot WO (hanya machines+operators), jadi demo kurang ketat dibanding backend di sisi itu.
- **Perubahan backend yang dibutuhkan:** Tetapkan apakah `operators.line_id` ikut menjadi guard `PRODUCTION_LINE_IN_USE`; bila ya, dokumentasikan; bila tidak, nyatakan apa yang terjadi pada operator saat line-nya dihapus (mis. `SET NULL`/tetap menunjuk ID yang hilang? — dokumen tidak menyebut).
- **Acceptance criteria:** Line yang hanya dipakai operator → hapus menghasilkan 409 (bila guard diberlakukan) atau 200 + operator tertangani sesuai kontrak (bila tidak); line yang dipakai WO snapshot → 409 `PRODUCTION_LINE_IN_USE` dengan pesan yang menyebut pemakai.

### SYS-B50 — Hapus Shift: demo hanya memeriksa shift_schedules, bukan snapshot WO; efek ubah jam shift ke jadwal yang ada tidak dispesifikasi — Low
- **Area:** Shifts, delete + update.
- **Perilaku panel (demo):** `demo/production.ts` `deleteShift` hanya memeriksa `shiftSchedules` sebelum 409 `SHIFT_IN_USE`; `updateShift` malah mendenormalisasi jadwal yang memakai shift itu (ikut mengubah `shiftName/shiftCode/startTime/endTime` di `store.shiftSchedules`).
- **Acuan dokumen:** API §O.4–5 — hapus ditolak bila masih dirujuk `shift_schedules` ATAU `work_order` snapshot → 409 `SHIFT_IN_USE`. Dokumen diam soal apakah `PATCH /shifts` (ubah jam/nama) harus memicu validasi overlap ulang pada jadwal yang ada atau memperbarui denormalisasi jadwal.
- **Yang hilang/tidak cocok:** demo kurang ketat untuk WO snapshot; dan tidak ada kontrak apakah jadwal yang sudah ada ikut berubah saat jam shift diubah (panel Real mengandalkan backend; bila backend menyimpan jam jadwal secara denormal, jadwal bisa basi; bila menyimpan referensi, tidak ada masalah — tidak bisa dipastikan dari dokumen).
- **Perubahan backend yang dibutuhkan:** Tegakkan guard WO snapshot pada delete; dokumentasikan efek `PATCH /shifts` terhadap `shift_schedules` yang ada (ikut berubah / tetap / ditolak bila menimbulkan overlap).
- **Acceptance criteria:** Hapus shift yang dipakai WO snapshot → 409 `SHIFT_IN_USE`; ubah `startTime/endTime` shift → `GET /shift-schedules` menunjukkan jam yang konsisten dengan kontrak yang ditetapkan.

---

## Keputusan backend — 18 November 2026

> **Status:** keputusan final untuk gap yang tercakup dalam lima modul remediasi
> backend. Implementasi **belum dimulai**; tidak ada kode backend yang berubah.
> Dokumen otoritatif ada di repo `iiot-oee`: `apps/backend/specs/034…038`
> (`spec.md` SPECIFIED, `plan.md` PLANNED, `design.md` DESIGNED, `tasks.md` READY).
> Acceptance criteria tetap wajib diuji di Real mode, bukan Demo.

### Ringkasan modul

| Modul | Spec backend | Gap | Keputusan inti |
|---|---|---|---|
| Audit feed & acknowledgement | `specs/034-audit-feed-and-acknowledgement` | B19, B21–B26 | Feed terpisah; ack dari JWT; severity tidak didukung; `count` = baris halaman; ekspor rute baru |
| MQTT configuration & overview | `specs/035-mqtt-configuration-contract` | B28–B44 | Adapter bentuk panel di permukaan HTTP; internal tetap kanonik; field tanpa sumber `null`; enum alias + `domainStatus`; overview diperkaya |
| Master data integrity | `specs/036-master-data-integrity` | B45–B50 | Hapus line 409; jam jadwal disertakan; `isActive` saat create; validasi overlap shift |
| Access control read model | `specs/037-access-control-read-model` | B8–B10, B12–B15 | `effectiveInMode` = `mode`; permission duplikat 409; `authzVersion` di refresh; `roles` tanpa alias |
| Health & runtime info | `specs/038-health-and-runtime-info` | B20, B27 | `/health` tetap ringkas; `/health/detail` ADMIN+LAN; nilai tak terukur `null`/`UNKNOWN` |

### Keputusan per gap

#### System Audit / Health / Info

| Gap | Keputusan |
|---|---|
| SYS-B19 | `/system/audit` tetap feed operasional. Item memuat `acknowledged` (turunan `acknowledgedAt`) dan `machineName`; tidak ada `actor`/`action`/`resource`/`clientIp`/`accessMode`/`severity` karangan. Mutasi IAM tidak digabungkan. |
| SYS-B20 | `GET /health` tidak diubah (publik, ringkas). Rute baru `GET /health/detail` (ADMIN + LAN) mengembalikan komponen aplikasi, basis data, MQTT, dan WebSocket dengan latensi terukur, `measuredAt` per komponen, dan `null`/`UNKNOWN` bila tidak terukur. |
| SYS-B21 | `PATCH /operational-events/:id/ack` menerima `{note?}`; aktor diambil dari subjek JWT. Field aktor di body diterima tetapi diabaikan (deprecated). Ack kedua idempoten. |
| SYS-B22 | Filter `acknowledged` didukung server-side. Filter `severity` **tidak didukung** dan tidak akan dipetakan dari `eventType`; parameter diabaikan dan didokumentasikan. |
| SYS-B23 | `machine_id` didukung pada list global, list per-device, `/system/audit`, dan ekspor. |
| SYS-B24 | `GET /system/audit` menerima dan memfilter `event_type` server-side. |
| SYS-B25 | Envelope `{data, meta}` dengan `meta = {limit, hasMore, truncated, nextCursor, prevCursor?, count}`. `count` = jumlah baris halaman, bukan total dataset. |
| SYS-B26 | Tersedia `GET /system/audit/export` dengan filter dan batas retensi yang sama dengan daftar; tidak ada field terlarang. |
| SYS-B27 | `/health/detail` memuat `name`, `version` (build/package), `environment` (runtime), dan `commit` opsional tanpa path internal. |

#### MQTT Dynamic Security & Configuration

| Gap | Keputusan |
|---|---|
| SYS-B28 | Backend memakai `PATCH /clients/:name/password`; panel menyesuaikan dari POST. Tidak ada perubahan perilaku backend. |
| SYS-B29 | Backend memakai `PATCH /clients/:name/enable {enabled}`; panel menyesuaikan dari POST `{disabled}`. |
| SYS-B30 | `access` diterima verbatim (`publish`/`subscribe`/`readwrite`); panel menghapus pemetaan ke `telemetry`/`telemetry+state`. |
| SYS-B31 | Body tunggal `{rolename, priority?}`; panel menyesuaikan dari `{roles:[…]}`. |
| SYS-B32 | Body objek ACL tunggal `{acltype, topic, allow, priority?}`; panel menyesuaikan dari `{acls:[…]}`. |
| SYS-B33 | `password` wajib minimal 8 karakter; **tidak ada auto-generate**. Panel wajib mengisi password dan tidak mengirim string kosong. |
| SYS-B34 | Respons `POST /clients` mengembalikan objek klien beserta `password` sekali tampil; `GET /clients/:name` tidak lagi memuat password. |
| SYS-B35 | Respons klien memakai `disabled` (bukan `enabled`); panel menyesuaikan mapper. |
| SYS-B36 | Body tunggal `{username, priority?}`; panel menyesuaikan dari `{clients:[…]}`. |
| SYS-B37 | Body tunggal `{rolename, priority?}`; panel menyesuaikan dari `{roles:[…]}`. |
| SYS-B38 | Rute konfigurasi menerima bentuk dengan dan tanpa trailing slash. |
| SYS-B39 | `summary` diterima sebagai alias `reason` (prioritas `reason`); `baseVersionId` opsional dengan fallback ke versi APPLIED. Field baca-saja diabaikan, bukan ditolak. |
| SYS-B40 | 422 memuat `issues[]` (kontrak baru) **dan** `details` (kompatibilitas); setiap issue memuat `field` dan `message`. |
| SYS-B41 | Apply/rollback asinkron; `acknowledgeUnvalidated` dihormati; panel wajib polling sampai status terminal, bukan sekali. |
| SYS-B42 | `POST /backups` tidak ada (404). Backup dibuat otomatis saat apply. `GET /backups` hanya metadata; tidak ada unduh. |
| SYS-B43 | Permukaan HTTP memakai bentuk panel (`version/general/limits/listeners/tls_profiles/bridges`); model internal tetap kanonik. Field tanpa sumber nyata bernilai `null` (`max_connections` global, `max_queued_bytes`, `remote_client_id`, `status` bridge); `tls_profiles` kosong (`[]`) karena tidak ada entitas first-class. Status versi/operasi memakai nilai panel + `domainStatus`. |
| SYS-B44 | Overview diperkaya: counts DynSec, status konfigurasi, `activeVersionId`, `lastAppliedAt`, `mutationLocked`, `measuredAt`. Plugin tidak aktif → `available:false` dan counts `null`, bukan `IN_SYNC`/`0`. |

#### Master Data & Operators

| Gap | Keputusan |
|---|---|
| SYS-B45 | Filter jadwal memakai `line_id`, `day_of_week`, `shift_id`, `is_active` (snake_case) sebagai satu-satunya bentuk. Guide diperbaiki; tidak ada alias camelCase. |
| SYS-B46 | List dan detail jadwal memuat `shiftName`, `shiftCode`, `startTime`, `endTime` dari join shift; shift hilang menghasilkan `null`, bukan 500. |
| SYS-B47 | `POST /operators` menerima `isActive` opsional (default `true`). Proteksi `ADM-001` tidak berubah: nonaktifkan/ubah role → 400, hapus → 403. |
| SYS-B48 | Operator dan daftar DynSec mengembalikan array penuh tanpa pemotongan diam-diam; tidak ada paginasi baru, batas praktis didokumentasikan. |
| SYS-B49 | Hapus production line yang masih dipakai operator → 409 `PRODUCTION_LINE_IN_USE` dengan `operatorId`. Guard machines dan snapshot WO tetap. Tidak ada FK `SET NULL`. |
| SYS-B50 | Hapus shift tetap 409 `SHIFT_IN_USE` bila dipakai jadwal atau snapshot WO. Perubahan jam shift memicu validasi overlap pada line+hari yang sama → 409 `SHIFT_TIME_OVERLAP`; jadwal mengikuti referensi live. |

#### Access Control

| Gap | Keputusan |
|---|---|
| SYS-B8 | Katalog memuat `access_control.read` dan `access_control.manage` sebagai dua kunci terpisah; panel menambahkan kunci `read` dan berhenti memakai kunci karangan. |
| SYS-B9 | `effectiveInMode` = nilai `mode`; detail per-domain ada di `enforcedDomains` dan `/auth/me`. Tidak ada nilai `partial`. |
| SYS-B10 | `POST /access-control/permissions` didukung dengan body camelCase (`action`, `resourceType`). Duplikat → 409 `PERMISSION_EXISTS`; tanpa rute penjaga → 400 `INERT_PERMISSION`. |
| SYS-B12 | Inspector mengembalikan `roles` (nama tunggal, tanpa alias `effectiveRoles`) plus `operatorId`, `primaryRole`, `isActive`, `isProtected`, `authzVersion`, `effectiveInMode`, `assignments`, `permissions`. Subjek hilang → 404. |
| SYS-B13 | `reason` tetap disimpan di audit IAM dan tidak dikembalikan pada baris policy; dokumentasi menyatakan lokasinya. |
| SYS-B14 | Revoke assignment yang tidak ada → 200 `{success:true, removed:0}`; revoke berhasil mencatat audit dengan aktor dan alasan. |
| SYS-B15 | `POST /auth/refresh` memuat `authzVersion` dari identitas yang dibaca ulang; 401 `AUTHZ_STALE`/`SUBJECT_INACTIVE` tidak berubah. |

### Gap di luar lima modul (belum diputuskan pada putaran ini)

| Gap | Status | Catatan |
|---|---|---|
| SYS-B1 | **Diputuskan 18 Nov (delegasi)** | Body policy **camelCase kanonis** + `subjectMatch` terstruktur; satu casing, panel menyesuaikan mapper. |
| SYS-B2 | Panel-side — **sudah dikerjakan panel (E14)** | Backend memakai `PUT`; panel sudah mengirim `PUT` sejak E14 P14.2 (17 Nov). Catatan 18 Nov yang menulis "panel mengirim `PATCH`" basi — ditulis dari snapshot audit. |
| SYS-B3 | **Diputuskan 18 Nov (delegasi)** | **Lanjutkan ABAC, scope minimal:** grammar minimal + contoh `abac_condition` valid + pesan 400 yang menyebut atribut. |
| SYS-B4 | **Diputuskan 18 Nov (delegasi)** | **Dukung alur paksa `mustChangePassword`:** flag di `/auth/me` → `401 PASSWORD_CHANGE_REQUIRED` → ganti → login ulang; satu alur, tanpa jalur kedua. |
| SYS-B5 | Panel-side — **sudah dikerjakan panel (E14)** | Backend memakai `PUT` untuk role; panel sudah mengirim `PUT` sejak E14 P14.2 (17 Nov). Catatan 18 Nov yang menulis "panel mengirim `PATCH`" basi. |
| SYS-B6 | **Diputuskan 18 Nov (delegasi)** | **Publikasikan skema respons IAM lengkap** (Fase 3); panel berhenti menebak field dengan default diam-diam. |
| SYS-B7 | **Diputuskan 18 Nov (delegasi)** | Hapus role yang masih ter-assign → **`409 ROLE_IN_USE`** (konsisten B49/B50). |
| SYS-B11 | Panel-side | Backend sudah mendukung filter dan `limit` sampai 1000; panel belum memakainya. |
| SYS-B16 | **Diputuskan 18 Nov (delegasi)** | **Samakan ke server 5/60 + `Retry-After`**; satu sumber kebenaran (server). |
| SYS-B17 | Panel-side | Panel tidak mengirim filter `operatorId`/`roleId`; backend perlu verifikasi dukungan filter. |
| SYS-B18 | Panel-side | Aturan anti-eskalasi panel lebih ketat dari backend; panel menyesuaikan. |

### Keputusan lanjutan — 18 November 2026 (delegasi Fathur ke Muse)

> **Sumber:** Fathur mendelegasikan seluruh keputusan penutupan gap ke Muse
> pada 18 Nov 2026 malam, dengan syarat: merujuk kebutuhan real-case,
> menutup gap backend–panel, **tanpa duplikasi flow dan tanpa flow
> deprecated** — satu alur kanonis per item. Keputusan Fase 0 yang diubah
> mengikuti backend dicatat lengkap di Lampiran C §C.1a
> (`docs/BACKEND_UPGRADE_PLAN.md`); analisis yang mendasarinya di
> `docs/BACKEND_DECISIONS_REALITY_CHECK.md` (E17).

| Item | Keputusan (18 Nov 2026 malam) |
|---|---|
| K-03 | Terima (c) — server menerima kedua bentuk trailing slash; panel tidak berubah |
| K-04 | Terima dual — `issues[]` kanonis + `details` kompatibilitas; panel membaca `issues` saja |
| K-09 | Terima (a) — `POST /permissions` didukung + guard (`400 INERT_PERMISSION`, `409 PERMISSION_EXISTS`) |
| K-11 | Terima (a) — `POST /clients`; rute `/clients/provision` tidak ada; panel di-revert (P-A) |
| K-01 / K-02 / K-12 / K-15 | Dikonfirmasi tetap (a) seperti diputuskan 17 Nov; konfirmasi/implementasi backend masih menunggu (K-01/K-02/K-12) / Fase 8 (K-15) |
| B1 | Body policy camelCase kanonis + `subjectMatch` terstruktur |
| B3 | Lanjutkan ABAC, scope minimal (grammar + contoh + pesan 400) |
| B4 | Dukung alur paksa `mustChangePassword` (satu alur) |
| B6 | Publikasikan skema respons IAM lengkap (Fase 3) |
| B7 | Hapus role ter-assign → `409 ROLE_IN_USE` |
| B16 | Samakan ke server 5/60 + `Retry-After` |
| Enum `event_type` | Enum tertutup; daftar kanonik dari kode backend |
| Arah panel | P-A revert K-11 **Ya**, P-B hapus `accessMap` **Ya**, P-C polling terminal **Ya**, P-D/P-E filter **Ya**, P-F anti-eskalasi **Ya**, P-I `GET /health/detail` **Ya — tertunda sampai backend menyediakan endpoint**, P-J export audit **Ya** |

### Pertanyaan terbuka yang terjawab

| # | Jawaban |
|---|---|
| Query param tak dikenal | Diabaikan dengan 200 dan didokumentasikan; tidak ada 400 baru. |
| D-3 trailing slash | Kedua bentuk diterima. |
| D-4 detail 422 | `issues[]` + `details`. |
| D-5 body sub-operasi DynSec | Bentuk tunggal; panel menyesuaikan. |
| D-6 skema respons DynSec | Didokumentasikan, termasuk `disabled` dan password sekali tampil. |
| D-7 skema config terstruktur | Bentuk panel di HTTP; field tanpa sumber `null`; enum alias + `domainStatus`. |
| D-1b rute provisioning | Tidak ada `POST /clients/provision`; gunakan `POST /clients`. |
| Apakah `/system/audit` alias feed operasional? | Ya, feed operasional; mutasi IAM tidak digabungkan dan dibaca dari `/access-control/audit`. |
| Apakah `severity` ada? | Tidak; filter severity tidak didukung. |
| Casing body `POST /permissions` | CamelCase: `action`, `resourceType`. |

**Masih terbuka:** item tanpa tanda **Terjawab** di atas — antara lain tipe `operator.role` untuk label custom, satuan `uptime`, dan overlap jadwal lintas tengah malam. (D-1, D-2, aturan kenaikan `authz_version`, dan perilaku hapus role yang masih ter-assign sudah terjawab 18 Nov 2026 malam — lihat § Keputusan lanjutan.)

---

## Tidak ada gap (endpoint System Admin yang sudah sepenuhnya mendukung panel)

**IAM/Auth:** `POST /auth/login` (body `{operator_id, password, station_id?}` + respons `{success, token, expires_in, operator:{id, username, role, line_id}}` cocok dengan API §L dan `LoginResponseSchema`); `POST /auth/refresh` (`{token}` → `{success, token, expires_in}`; refresh proaktif pada 20% sisa TTL + refetch `/auth/me` — dengan catatan SYS-B15/B16); `GET /access-control/info` (`mode`/`authzVersion`/`effectiveInMode`/`enforcedDomains` dibaca `mapIamInfo`; badge menampilkan mode + versi sesuai Guide §8); `GET /access-control/roles` + `DELETE /roles/:id` (dengan catatan SYS-B7); `POST /access-control/roles` (body `{name, description?}` subset sah dari `{name, description?, reason?}`); `POST /roles/:id/permissions` (body cocok kecuali `reason` — SYS-B13); `DELETE /roles/:id/permissions/:permissionId` (method + path cocok; unbind disembunyikan untuk ADMIN); `GET /access-control/permissions` (katalog bind + template policy); `GET /access-control/user-roles` (kecuali filter — SYS-B17); `POST /user-roles` (body `{operatorId, roleName, scopeType, scopeId}` cocok; validasi client-side "scopeId wajib untuk non-ORGANIZATION" cocok Guide §8); `DELETE /user-roles` (composite key + guard root protection di UI `AssignmentsTab.tsx:81,115`); `GET /access-control/policies` (kecuali filter — SYS-B17); anti-lockout DENY-pada-ADMIN di UI + demo; reserved-permission guard di UI + demo (dengan catatan SYS-B1/B18: guard berbasis role, backend berbasis `subjectMatch`); penanganan error envelope (`mapHttpErrorToApiError`, 401 → logout, 403 → penurunan capability, sesuai API §2 dan Guide §4.5); rute panel (`Router.tsx:68,83`; Sidebar mengunci menu pada capability `access_control.manage`).

**Audit/Health:** trailing slash `GET /operational-events/` (registry + builder sudah benar; diperbaiki sejak audit, AUDIT.md §2.1 #6); `GET /health` — field yang didokumentasikan (`status`, `uptime`, `timestamp`, `ws_clients`, `db_connected`, `buffer_pending`, `buffer_dropped`, `metrics{...}`) semuanya dipetakan `http/health.ts:15-67`; `metrics: null` ditangani halaman dengan banner peringatan; `status: degraded` tetap 200 sesuai doc; parameter list operational-events (`from`, `to`, `event_type`, `limit` default 50 maks 200, `cursor`, `envelope=true`) dikirim builder; parameter list `GET /system/audit` (`from`, `to`, `limit`, `cursor`, `envelope=true`) dikirim; gating ADMIN+LAN via capability + penanganan 403 terpusat; ekspor operational-events (global + per-device, param `from/to/format/limit`, format default `csv`; `reqExport` membaca `Content-Disposition` + header `X-Export-*`; retensi 90 hari; rate limit 5/menit → 429 → cooldown 30 detik di UI); bentuk list ganda (array polos maupun `{data, meta}`; cursor opaque, Guide §4.7 dipatuhi); ack idempoten + batas note ≤500 (demo); error envelope terpusat; `GET /system/audit` tidak memakai `machine_id` (konsisten dengan kedua dokumen).

**MQTT/Master/Operators:** cakupan endpoint lengkap — 23 dynsec + 1 overview + 13 config + 5 lines + 5 shifts + 5 schedules + 7 operators semuanya terdaftar (`endpoints/mqtt.ts`, `endpoints/production.ts`, `endpoints/operators.ts`), diimplementasikan di http client dan demo client (total 59 kunci di irisan ini); provisioning tanpa rute `/clients/provision` (panel benar — tidak ada pemanggilan di seluruh `src`; Guide §9.1/§14.13); Operators CRUD sesuai §H (`POST {operatorId, operatorName, role, password, lineId}`; `PUT {operatorName?, role?, lineId?}` tanpa password; `PATCH /password {newPassword}`; `PATCH /status {isActive}`; `DELETE`; list/detail tanpa kredensial); Lines/Shifts/Schedules CRUD sesuai §N/§O/§P (update memakai `PATCH`, body camelCase `lineId/shiftId/dayOfWeek` pada create/update, cursor pagination `limit+envelope+cursor` pada list, 409 yang diharapkan sudah ditangani UI via `ConflictDialog`); config apply/rollback `confirm:true` (panel selalu mengirim `confirm:true`; UI meminta centang konfirmasi dulu); hapus dynsec 204 tanpa body (`reqJson` mengembalikan `undefined` untuk 204/empty; semua delete dynsec memakai fallback `success ?? true`); hapus ACL body `{acltype, topic}` sudah cocok dengan API §M; envelope error (`mapHttpErrorToApiError` dengan fallback per status: 422 → `CONFIG_VALIDATION_FAILED`, 502 → `MQTT_ADMIN_ERROR`, 504 → `MQTT_RESPONSE_TIMEOUT`); overview bentuk `{dynamicSecurity, configuration}` cocok dengan API §3.3a; halaman dikunci bila tidak punya capability overview (efektif ADMIN-only); raw config hanya ADMIN (`useBrokerConfig.ts:82-88` hanya memanggil `getBrokerConfigRaw()` bila punya `mqtt.config.read_raw`); overlap jadwal di demo sudah benar arahnya (`assertNoScheduleOverlap`, interval `start<end` per `lineId+dayOfWeek`, 409 `SHIFT_SCHEDULE_OVERLAP` — panel Real hanya perlu backend menegakkan hal yang sama pada create DAN update).

**Catatan:** beberapa endpoint "tidak ada gap" di atas tetap punya catatan kaki berupa SYS-B (mis. filter yang tidak dipakai, `reason` yang dibuang) — dicantumkan agar tidak dikira sudah 100% bersih.

---

## Temuan sisi panel/demo (BUKAN gap backend — dicatat agar tidak tercampur, tapi perlu ditindaklanjuti di sisi panel)

1. **Validasi shift lebih longgar dari dokumen** (`src/utils/capabilities/validators.ts:158-203` `validateShiftInput` — `shiftCode` 1–32 karakter tanpa cek uppercase, `shiftName` min 2; dokumen: `shiftCode` 1–16 uppercase, `shiftName` 3–100; `ShiftSchema` di `schemas/dto.ts` ikut longgar). Panel menerima input yang backend tolak 400 — pengguna baru tahu setelah submit. Backend tetap harus menegakkan aturan dokumen sebagai jaring pengaman.
2. **Sisa hierarki level di panel/demo** — `CAPABILITY_SPECS['operator.password.rotate']` masih mengizinkan SUPERVISOR (dokumen: ADMIN-only, Guide §4.5); `ROLE_LEVELS` (40/30/20/10), `ACCOUNT_MANAGER_MIN_LEVEL = 30`, `CUSTOM_ROLE_MAX_LEVEL = 29`, `canManageTargetRole()` masih menggating UI operator (`useOperators.ts:81`, `OperatorsTable.tsx:70`, `demo/operators.ts`) padahal backend sudah menghapus hierarki statis (§4.6g). Bila `/auth/me` gagal/tidak tersedia, baseline panel menampilkan aksi yang pasti 403 di server.
3. **Input `privilege_level` di UI role dibuang diam-diam** — kedua modal role mewajibkan "Tingkat Kewenangan (1–29)"; `httpIam` tidak mengirimkannya (benar per §4.6g); setelah reload semua role tampil "Level 1" (default mapper). Panel juga mewajibkan deskripsi 3–256 karakter padahal dokumen menyebut deskripsi opsional. Backend sudah benar; ini gap kesetiaan panel/demo.
4. **SystemHealthPage: error tak terbedakan dari loading; `degraded` tampil sebagai bahaya; `timestamp` tidak ditampilkan** (`SystemHealthPage.tsx:15-31` — `loadHealth` gagal → `setHealth(null)` → tampil "Memuat status kesehatan sistem..." selamanya; badge `status === 'ok' ? success : danger` membuat `degraded` tampil merah sama seperti down, padahal API §A mendefinisikan `degraded` = "layanan jalan, DB putus" dengan respons tetap 200). Perbaikan panel, bukan backend.
5. **Demo mengarang kode/id yang tidak ada di dokumen** — `demo/production.ts` `createShiftSchedule` mengarang `scheduleId` deterministik `` `sched-<line>-<shift>-d<day>` `` + kode 409 `SHIFT_SCHEDULE_ALREADY_EXISTS` (dokumen: `scheduleId` UUID dari server, satu-satunya 409 adalah `SHIFT_SCHEDULE_OVERLAP`); `demo/operators.ts` `deleteOperator` mengarang `activeWoId` pada error `OPERATOR_HAS_ACTIVE_WO` (contoh §H.5 hanya menaruh ID WO di dalam `message`; envelope §2 memang punya field `active_wo_id`, jadi yang ini mungkin benar — belum pasti untuk operator). Pengujian berbasis demo tidak membuktikan kontrak error backend.
6. **Endpoint terdaftar tapi tidak pernah dipanggil UI** (bukan gap backend, tapi tidak teruji lewat UI): `getMqttClient`, `getMqttRole`, `getMqttGroup`, `getMqttDynamicSecurityStatus`, `getBrokerConfigVersion`, `getProductionLineById`, `getShiftById`, `getShiftScheduleById`, `getOperatorById` — hanya definisi di http/demo. Backend tetap wajib mengimplementasikannya sesuai dokumen; acceptance test harus memanggilnya langsung, bukan lewat UI. `createBrokerConfigBackup` bahkan tidak punya pemanggil di mana pun termasuk demo (lihat SYS-B42).

---

## Pertanyaan terbuka (status per 18 November 2026 — tidak ditebak)

> **Status:** item yang sudah diputuskan ditandai **Terjawab** dan tidak lagi
> menjadi pertanyaan terbuka. Jawaban lengkap ada di
> [Keputusan backend — 18 November 2026](#keputusan-backend--18-november-2026).
> Item tanpa tanda tetap terbuka.

1. **D-1 (diketahui, AUDIT.md §3):** `POST /auth/password/change` — API §L `{current_password, new_password}` vs Guide Lampiran J `{old_password, new_password}`. Panel memakai API §L. Bila backend mengimplementasikan Lampiran J, ganti password Real gagal. Perlu satu sumber kanonis. **Terjawab (18 Nov 2026, delegasi):** (a) `{current_password, new_password}` — keputusan 17 Nov dikonfirmasi tetap; Guide Lampiran J dikoreksi.
2. **D-2 (diketahui, AUDIT.md §3):** `GET /auth/me` — API §L `{operator, authz:{...}}` vs Guide §4.9 bentuk flat. Panel menangani keduanya. Tidak jelas mana yang benar-benar dikembalikan backend. **Terjawab (18 Nov 2026, delegasi):** (a) bentuk nested — keputusan 17 Nov dikonfirmasi tetap; Guide §4.9 dikoreksi.
3. **Query param tak dikenal: diabaikan atau 400?** Tidak ada dokumen yang menyatakan apakah backend (Zod) memakai mode strict terhadap query param tak dikenal. Ini menentukan dampak SYS-B22, B23, B24, B45 (diabaikan diam-diam vs gagal 400). **Terjawab (18 Nov 2026):** parameter tak dikenal diabaikan dengan 200 dan didokumentasikan.
4. **D-5 — Bentuk body sub-operasi dynsec:** http panel memakai bentuk jamak `{roles:[...]}`, `{acls:[...]}`, `{clients:[...]}`; Guide Lampiran O memakai bentuk tunggal. Kemungkinan panel mengikuti bentuk native Mosquitto dynsec sementara dokumen menyederhanakan. Berlaku untuk SYS-B31, B32, B36, B37. Keputusan backend menentukan apakah yang harus diubah adalah panel atau dokumen. **Terjawab (18 Nov 2026):** backend memakai bentuk tunggal; panel menyesuaikan.
5. **D-6 — Skema respons dynsec:** tidak ada contoh JSON untuk objek klien/peran/grup/status di dokumen mana pun — field `enabled` vs `disabled`, nama field password sekali tampil, bentuk `roles`/`groups` (string vs objek) semuanya tebakan panel (SYS-B34, B35). **Terjawab (18 Nov 2026):** skema respons didokumentasikan, termasuk `disabled` dan password sekali tampil.
6. **D-7 — Skema config terstruktur:** tidak ada contoh `GET /` / versi di dokumen acuan; field, default, dan enum status ditebak dari seed panel (SYS-B43). Dokumen `docs/mosquitto-configuration-manager.md` yang dirujuk Lampiran B tidak tersedia dalam berkas acuan. **Terjawab (18 Nov 2026):** HTTP memakai bentuk panel; field tanpa sumber bernilai `null`; enum memakai alias panel + `domainStatus`.
7. **D-3 — Trailing slash config:** API §3.3b "wajib trailing slash" vs Guide Lampiran P tanpa slash (SYS-B38). **Terjawab (18 Nov 2026):** kedua bentuk diterima.
8. **D-4 — Detail 422:** API §2 envelope memakai `issues[]`, sedangkan §3.3b/§2 tabel menyebut detail 422 pada `details` (SYS-B40). **Terjawab (18 Nov 2026):** 422 memuat `issues[]` dan `details`.
9. **D-1b — Rute provisioning:** API §M bagian "Provisioning perangkat" menyebut `POST /clients` dengan body `{deviceId, access, ...}`, TAPI contoh cURL di bawahnya memakai `POST …/clients/provision`. Guide §9.1 dan §14.13 tegas: "Tidak ada `POST /clients/provision`; dokumen API lama menyebutnya, tetapi rute itu tidak terdaftar." Panel mengikuti Guide. Perlu satu sumber kebenaran. **Terjawab (18 Nov 2026):** tidak ada `POST /clients/provision`; gunakan `POST /clients`.
10. **Apakah `/system/audit` adalah alias harfiah feed yang sama atau subset?** API §I menyebutnya "Alias audit trail global (operational events)"; Guide §6.7 menyebutnya feed `operational_events` global "yang menjadi jejak mutasi sistem (termasuk `MASTER_DATA_MUTATION`, `MQTT_ADMIN_*`, perubahan IAM)" dan memperingatkan "Jangan mencampurnya dengan feed operasional publik; beda otorisasi dan beda audiens". Tidak dinyatakan apakah `/system/audit` memfilter hanya event bertipe mutasi atau mengembalikan seluruh feed yang sama. **Terjawab (18 Nov 2026):** `/system/audit` adalah feed operasional; mutasi IAM tidak digabungkan dan dibaca dari `/access-control/audit`.
11. **Enum `event_type` tidak didefinisikan.** API hanya memberi contoh (`COMMAND_PAUSE_DISPATCHED`, `WO_DISPATCH_ACK_SUCCESS`, `MASTER_DATA_MUTATION`, `MQTT_ADMIN_*`, `SECURITY_REJECTION`, `AUTH_TOKEN_REFRESHED`, …). Dropdown panel (`OperationalEventsFilters.tsx:7-21`, 15 nilai: `ALARM`, `STATE_CHANGE`, `COMMAND_EXECUTED`, `DISCONNECT`, `HEARTBEAT_TIMEOUT`, `MASTER_DATA_MUTATION`, …) adalah daftar buatan panel — tidak bisa dipastikan cocok dengan enum server; nilai di luar enum bisa menghasilkan 400 atau hasil kosong. **`severity` tidak muncul di dokumen sama sekali** (grep API + Guide: nihil) — panel memakai `severity` sebagai filter UI dan field item (`mapOperationalEvent` default `'INFO'`) — keduanya asumsi panel, bukan kontrak backend. **Terjawab sebagian (18 Nov 2026):** `severity` tidak didukung dan tidak dipetakan; `/system/audit` memfilter `event_type` persis, tetapi daftar enum kanonik belum ditetapkan.
12. **Aturan naiknya `authz_version`:** API §3.4 "Setiap mutasi → reloadPolicy → bump authz_version" vs Guide §8 "Perubahan katalog permission atau deskripsi role **tidak** menaikkannya". Panel mengikuti Guide §8 untuk update role (`afterMutation(..., false)` di `useRoles.ts`) tapi default `true` untuk mutasi lain. Tidak bisa dipastikan mana yang benar; implikasinya pada advisory "sesi lain token lama berakhir (401)" di `useIamData.ts` (yang ditampilkan tanpa syarat, padahal Guide §4.6h membatasi penolakan token lama ke mode enforce).
13. **Apakah `PATCH` diterima backend untuk `/roles/:id` dan `/policies/:id`:** dokumen hanya menulis `PUT`. Panel mengirim `PATCH` (SYS-B2, B5). Tidak bisa dipastikan tanpa mencoba live. **Terjawab (18 Nov 2026):** backend tetap `PUT`; panel menyesuaikan.
14. **Apakah `POST /permissions` didukung atau katalog fixed:** dokumen di kedua sisi (ada endpoint + `INERT_PERMISSION`/`409`) vs klaim tab panel "Fixed Master Data · Read-Only" + blok demo (SYS-B10). **Terjawab (18 Nov 2026):** didukung dengan body camelCase; duplikat → 409 `PERMISSION_EXISTS`.
15. **Perilaku hapus role yang masih ter-assign / hapus policy ADMIN / unbind yang tidak ada:** tidak didokumentasikan; demo mengarang `ROLE_IN_USE`/`FORBIDDEN`/`404` (SYS-B7, B14). Kode `PRIVILEGE_ESCALATION_DENIED` tercantum di tabel error API §2 tapi tidak dipetakan ke kasus mana pun. **Terjawab sebagian (18 Nov 2026):** revoke yang tidak menemukan baris → 200 `{success:true, removed:0}`; perilaku hapus role masih terbuka.
16. **Casing body `POST /permissions`:** `resource_type` (httpIam) vs `resourceType` (Guide Lampiran K) — API §3.4 tidak menulis skema body (SYS-B10). **Terjawab (18 Nov 2026):** camelCase `action`, `resourceType`.
17. **LoginResponse `operator.role` bila label custom:** skema panel membatasi ke enum 4 preset (`UserRoleSchema`); dokumen menyebut `operators.role` label legacy tanpa enumerasi eksplisit di §L. Kemungkinan besar selalu preset (custom role hidup di `authz_user_roles`, bukan di `operators.role`), tapi tidak dinyatakan eksplisit — bila backend suatu saat mengembalikan label custom, `LoginResponseSchema.parse` di `httpAuth.login` akan gagal dan login rusak.
18. **Overlap jadwal lintas tengah malam:** shift mensyaratkan `startTime < endTime` (§O), jadi shift malam yang melewati tengah malam (mis. 23:00–07:00) tidak bisa direpresentasikan sebagai satu shift; dokumen tidak menjelaskan apakah overlap dihitung per `dayOfWeek` saja atau juga terhadap hari berikutnya. Demo seed mengakali dengan SHIFT-3 `00:00–07:00`. Bukan gap yang bisa diputuskan dari dokumen saja.
19. **Satuan `uptime`:** contoh doc `450.12` ditafsirkan panel sebagai detik (`formatDuration`) — konsisten dengan deskripsi, tapi satuan tidak dinyatakan eksplisit di §A.
20. **Status operasi async config:** dokumen tidak merinci berapa lama polling, interval yang dianjurkan, dan daftar lengkap status operasi; panel hanya poll sekali (SYS-B41). **Terjawab sebagian (18 Nov 2026):** panel wajib polling sampai status terminal; status memakai nilai panel + `domainStatus`; interval belum ditetapkan.
21. **`PROTECTED_ACCOUNT` operator:** API §H.7 + Guide §7.3 konsisten (400 untuk nonaktifkan/ubah role root, 403 untuk hapus), TAPI demo memakai 403 untuk nonaktifkan root — ini divergensi demo, bukan dokumen (SYS-B47). **Terjawab (18 Nov 2026):** backend tidak berubah — nonaktifkan/ubah role 400, hapus 403.
22. **Catatan koreksi:** AUDIT.md §3 hanya berisi diskrepansi D-1/D-2 (soal auth); trailing slash ada di §2.1 #6 dan bentuk list di §2.3 — bukan di §3 seperti yang sempat dirujuk saat audit.
