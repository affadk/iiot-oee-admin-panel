# Panduan Membangun Admin Panel IIoT OEE

> Dokumen panduan teknis untuk membangun **admin panel** (back-office) dari nol
> terhadap backend Fastify IIoT OEE. Panduan ini berdiri sendiri: tidak
> mengasumsikan, mewarisi, atau merujuk pada implementasi antarmuka mana pun
> yang sudah ada. Semua kontrak diambil dari sumber backend dan keputusan
> arsitektur sistem.

**Audiens:** engineer frontend, integrator sistem, atau tim internal yang akan
membangun panel administrasi.
**Sumber kebenaran:** kode `apps/backend/src/routes/*`, `apps/backend/src/authz/seed.ts`,
dan [`apps/backend/docs/API_DOCUMENTATION.md`](../apps/backend/docs/API_DOCUMENTATION.md).
Bila dokumentasi dan kode berbeda, **kode menang**. Dokumen ini sudah
diselaraskan dengan kondisi backend saat ini: **115 operasi REST + 1 endpoint
WebSocket = 116 operasi**.

**Model otorisasi:** backend mengevaluasi policy berbasis atribut (**ABAC**):
atribut subjek (role, assignment, scope), aksi, atribut resource, dan
environment. Role hanyalah salah satu atribut subjek, bukan unit keputusan.
Panduan ini karena itu mendorong gerbang UI berbasis **capability**, bukan
matriks role.

---

## 1. Admin Panel vs HMI Operasional

Sistem IIoT OEE memiliki dua kelas antarmuka dengan tanggung jawab berbeda.
Panduan ini hanya membahas yang pertama.

| Aspek | Admin panel (dokumen ini) | HMI lantai produksi (di luar cakupan) |
|---|---|---|
| Pengguna | ADMIN, SUPERVISOR, tim IT/OT | Operator mesin, crew, TV Andon |
| Tujuan | Kelola master data, audit, telemetri, IAM, broker | Jalankan shift, dispatch WO, aktuasi mesin |
| Perangkat | Desktop browser | Tablet tahan sarung tangan, TV 1080p |
| Mutasi mesin | **Tidak boleh ada** | PAUSE/RESUME/RESET (LAN + operator) |
| Perimeter | LAN pabrik; tunnel hanya baca | LAN (aktuasi) + tunnel (baca) |

**Aturan mutlak:** admin panel **tidak** menyediakan tombol aktuasi mesin
(`PAUSE`, `RESUME`, `RESET_COUNTER`) dan **tidak** memanggil
`POST /api/v1/devices/:device_id/command`. Aktuasi adalah jalur keselamatan OT
yang hanya boleh berasal dari HMI lokal dengan operator terautentikasi
(ADR-003). Panel admin yang menampilkan tombol tersebut melanggar invarian
keselamatan sistem.

Empat operasi work order berikut juga merupakan alur HMI, bukan fitur admin
panel: `POST /work-orders/:wo_id/dispatch`,
`POST /work-orders/validate-zone`, `POST /work-orders/initiate-from-zones`, dan
`POST /work-orders/:wo_id/complete`. Panel admin hanya membaca work order dan
melakukan `cancel` (ADMIN). Operasi HMI tetap didokumentasikan di lampiran agar
batas tanggung jawab jelas.

---

## 2. Keputusan Arsitektur yang Mengikat

Baca dan patuhi sebelum menulis kode. Semua keputusan berikut sudah final;
panel admin harus beradaptasi, bukan sebaliknya.

| # | Keputusan | Konsekuensi untuk panel admin |
|---|---|---|
| D1 | Dual-vhost Nginx: port 80 LAN penuh, port 8080 tunnel read-only | Mutasi hanya berfungsi dari LAN; UI remote wajib menonaktifkan semua aksi tulis |
| D2 | Backend menolak mutasi berguard dengan `403` bila header `x-ingress-source: remote-tunnel` | Tangani `403` remote sebagai kondisi perimeter, bukan galat generik |
| D3 | `ENFORCE_SUBNET_GUARD` default OFF, tetapi penolakan tunnel **selalu** aktif | Jangan mengandalkan switch; asumsikan aturan tunnel selalu berlaku |
| D4 | JWT stateless, TTL default 900 s, refresh sliding TTL | Sesi harus diperbarui proaktif; logout tidak memvalidasi token di server |
| D5 | Token tidak boleh disimpan di storage persisten | Simpan di memori; refresh halaman = login ulang |
| D6 | Otorisasi berlapis: subnet guard → Bearer → policy ABAC (subjek, aksi, resource, scope, environment) | UI merender capability, bukan mengevaluasi policy; server tetap otoritas akhir (`403` mengesampingkan UI) |
| D7 | Response list memakai dua bentuk: array langsung atau `{data, meta}` | Klien wajib menormalkan keduanya |
| D8 | Semua error memakai envelope `{error, message, issues?}` | Satu pemeta galat terpusat, bukan penanganan per halaman |
| D9 | Telemetri hypertable tidak pernah dihapus saat master dihapus | Setelah delete, histori tetap dapat dibuka; tampilkan relasi `null` sebagai `[dihapus]` |
| D10 | `GET /api/v1/auth/me` menyediakan proyeksi capability diri sendiri | Gunakan hasil `GET /api/v1/auth/me` (`allow`/`deny`/`unknown` + `mode` + `authzVersion`) bersama koreksi dinamis `403` sebagai gate UI diri sendiri; jangan memakai `subjects/:operatorId/effective-permissions` (ADMIN-only) sebagai gerbang umum |

D10 telah tersinkron dengan backend: `GET /api/v1/auth/me` dikonfirmasi sebagai sumber gate UI resmi untuk operator yang sedang login (`Cache-Control: no-store`). Sementara `GET /api/v1/access-control/subjects/:operatorId/effective-permissions` berada di konsol IAM, hanya dapat dipanggil ADMIN dari LAN untuk inspeksi subjek lain, dan **tidak** boleh dipakai sebagai gerbang UI umum.

---

## 3. Stack & Struktur Proyek

Stack berikut direkomendasikan dan konsisten dengan toolchain repository
(Node 22, pnpm 10, TypeScript strict). Boleh diganti selama keputusan di §2
tetap dipenuhi.

```text
admin-panel/
├── src/
│   ├── api/
│   │   ├── client.ts          # fetch wrapper, timeout, retry, error normalisasi
│   │   ├── auth.ts            # login, refresh, sesi
│   │   ├── endpoints/         # satu modul per domain (devices, machines, ...)
│   │   └── schemas/           # Zod DTO (copy kontrak, jangan impor backend)
│   ├── app/
│   │   ├── router.tsx
│   │   └── providers.tsx      # QueryClient, auth context, toast
│   ├── features/
│   │   ├── dashboard/
│   │   ├── devices/
│   │   ├── machines/
│   │   ├── products/
│   │   ├── operators/
│   │   ├── work-orders/
│   │   ├── downtime/
│   │   ├── audit/
│   │   ├── telemetry/
│   │   ├── access-control/
│   │   └── mqtt/
│   ├── components/            # tabel, dialog, form primitif
│   ├── lib/                   # format tanggal/angka, guard, constants
│   └── main.tsx
├── .env.example
└── vite.config.ts
```

Aturan struktur:

- Satu modul fitur = satu folder; tidak ada impor antar-modul selain lewat
  `api/` dan `components/`.
- DTO didefinisikan ulang dengan Zod di sisi panel. **Jangan** mengimpor tipe
  atau skema dari `apps/backend/src` — itu melanggar batas modul.
- Semua panggilan jaringan lewat `api/client.ts`; tidak ada `fetch` di komponen.

Dependensi minimum: `react`, `react-dom`, `react-router`, `@tanstack/react-query`,
`zod`, `tailwindcss`. Opsional: `@tanstack/react-table` untuk tabel besar.

---

## 4. Fase 1 — Fondasi

### 4.1 Environment

| Variabel | Wajib | Default | Keterangan |
|---|---|---:|---|
| `VITE_API_URL` | tidak | `origin + /api/v1` | Base URL API; kosongkan agar memakai origin (disarankan di produksi) |
| `VITE_WS_URL` | tidak | `ws(s)://origin/ws/telemetry` | Hanya bila panel menampilkan data realtime |
| `VITE_AUTH_TTL_FALLBACK_SEC` | tidak | `900` | Dipakai bila `expires_in` tidak ada |
| `VITE_REQUEST_TIMEOUT_MS` | tidak | `10000` | Batas waktu baca |
| `VITE_EXPORT_TIMEOUT_MS` | tidak | `120000` | Batas waktu unduhan ekspor besar |

Jangan menaruh secret apa pun di `VITE_*` — semua nilai ter-bundle ke browser.

### 4.2 Klien HTTP

Kontrak minimum yang wajib dipenuhi klien:

```ts
type ApiError = {
  code: string;          // dari envelope atau sintetis: NETWORK, TIMEOUT, INVALID_RESPONSE
  message: string;       // siap tampil (Indonesia)
  httpStatus: number;    // 0 untuk galat jaringan
  issues?: unknown[];    // detail validasi 400
  activeWoId?: string;   // aditif 409 work order
};
```

Aturan perilaku:

1. **Base URL** — `VITE_API_URL` bila ada, jika tidak `origin + "/api/v1"`.
   Jangan hardcode host/port.
2. **Header** — `Content-Type: application/json` untuk body JSON,
   `Accept: application/json`. `Authorization: Bearer <token>` disisipkan saat
   panggilan (bukan saat modul dimuat) dan hanya untuk operasi beridentitas.
3. **Retry** — hanya untuk kegagalan jaringan dan `502/503/504`, maksimum 3
   percobaan, backoff eksponensial + jitter. **Jangan** retry
   `400/401/403/404/409/422/429`.
4. **Timeout** — baca 10 s, mutasi 15 s, ekspor 60–120 s. Timeout = galat
   jaringan.
5. **Pembatalan** — setiap operasi baca menerima `AbortSignal`; batalkan saat
   komponen dilepas atau filter berubah.
6. **Deduplikasi** — permintaan identik yang bersamaan digabung (query library
   biasanya sudah menangani ini; pastikan `queryKey` stabil).
7. **Normalisasi** — sukses diparse Zod; gagal parse = `INVALID_RESPONSE`,
   jangan menulis state parsial.
8. **Ekspor** — endpoint ekspor mengembalikan body file (CSV/NDJSON/JSON),
   bukan envelope API. Baca header `Content-Disposition`, `X-Export-Source`,
   `X-Export-Generated-At`, dan `X-Export-Device-Id` bila ada.

### 4.3 Pemetaan Galat

| HTTP | Kode domain (contoh) | Tindakan UI |
|---:|---|---|
| 400 | `VALIDATION_ERROR`, `SCRAP_COUNT_INVALID`, `PROTECTED_ACCOUNT` (nonaktifkan/ubah role akun root) | Tampilkan pesan per field dari `issues` |
| 401 | `UNAUTHORIZED` | Bersihkan sesi, buka login, **jangan** ulangi permintaan |
| 403 | `FORBIDDEN`, `PROTECTED_ACCOUNT` (hapus akun root), `PRIVILEGE_ESCALATION_DENIED` | Nonaktifkan aksi, tampilkan alasan; bila remote → banner perimeter |
| 404 | `*_NOT_FOUND`, `WO_NOT_FOUND` | Empty state "data tidak ditemukan", tawarkan kembali ke daftar |
| 409 | `CONFLICT`, `WORK_ORDER_CONFLICT`, `MACHINE_HAS_ACTIVE_WO`, `DEVICE_ALREADY_BOUND`, `MODBUS_SLAVE_CONFLICT`, `MQTT_*_ALREADY_EXISTS`, … | Dialog konflik dengan penyebab + tindakan korektif |
| 422 | `CONFIG_VALIDATION_FAILED` | Tampilkan detail validasi kandidat konfigurasi |
| 429 | `TOO_MANY_REQUESTS` | Hitung mundur; larang retry otomatis |
| 502 | `MQTT_ADMIN_ERROR` | "Broker menolak perintah", tampilkan pesan |
| 503 | `DEVICE_OFFLINE`, `MQTT_BROKER_UNAVAILABLE` | Status layanan/perangkat, bukan kegagalan form |
| 504 | `MQTT_RESPONSE_TIMEOUT` | "Broker tidak merespons", tawarkan coba lagi manual |
| 500 | `INTERNAL_SERVER_ERROR` | Pesan umum + korelasi waktu untuk log |

`409` work order dapat membawa `active_wo_id`; simpan dan tampilkan sebagai
tautan ke WO tersebut (`GET /work-orders/:wo_id`).

### 4.4 Sesi

Alur yang benar:

```text
POST /auth/login {operator_id, password, station_id?}
  → 200 {success, token, expires_in, operator{id, username, role, line_id?}}
     (username di sini = nama tampilan operator, bukan kredensial)
  → simpan token + profil di memori
  → jadwalkan refresh pada 80% × expires_in
POST /auth/refresh {token}
  → 200 {token, expires_in} → ganti token, jadwalkan ulang
  → 401 → sesi berakhir
```

Ketentuan:

- Password tidak pernah disimpan, tidak masuk logger, tidak masuk state global
  yang di-serialize.
- Refresh dijalankan **single-flight**: banyak permintaan bersamaan memakai satu
  promise refresh.
- `401` pada operasi apa pun = sesi berakhir. Mutasi yang gagal `401` tidak
  boleh diulang otomatis.
- Logout lokal = hapus token + batalkan timer refresh.
- Rate limit login: **5 percobaan / 60 detik per IP+station** (env
  `AUTH_RATE_LIMIT_MAX`, `AUTH_RATE_LIMIT_WINDOW_MS`). Tampilkan jeda bila
  `429`; jangan retry loop.
- Login dan refresh sama-sama memerlukan **LAN** (`enforceSubnetOrigin`).
- Token membawa `authz_version`. Saat mode `enforce`, mutasi IAM dapat membuat
  token lama ditolak `401` ("Token is stale") — perlakukan sebagai sesi
  berakhir, bukan `403`.
- Refresh membaca ulang identitas dari database, sehingga perubahan role,
  assignment/scope, dan status aktif berlaku pada token berikutnya.

### 4.5 Otorisasi UI: Capability-First

Login hanya mengembalikan `role`, bukan hasil evaluasi policy. Backend menilai
**atribut**, bukan sekadar role: subjek (role, assignment, scope), aksi, resource,
dan environment (`ingress_source`, `subject_active`). FE tidak dapat mereplikasi
evaluasi ini dan tidak boleh mencoba.

Gerbang UI karena itu memakai **capability key** yang stabil; role hanya
*baseline* kasar untuk navigasi dan tombol yang memang role-only. Keputusan final
selalu milik server (`403`).

| Capability key | Baseline | Atribut yang dapat mengubah keputusan |
|---|---|---|
| `dashboard.read`, `telemetry.read`, `quality.read`, `downtime.read`, `operational_event.read`, `device.read`, `machine.read`, `product.read`, `oee.read` | semua role | endpoint publik (baca); tunnel read-only tetap boleh |
| `operational_event.ack`, `downtime.reason.label` | semua role | LAN; `subject_active` |
| `export.telemetry` | ADMIN, SUPERVISOR | izin `refresh:telemetry`; tanpa LAN |
| `audit.system.read` | ADMIN | LAN + `read:access_control` |
| `device.manage`, `machine.manage`, `product.manage` | ADMIN | LAN + izin tulis; scope saat ini `ORGANIZATION` |
| `operator.read`, `operator.create`, `operator.status.update` | ADMIN, SUPERVISOR | LAN; level role target; `PROTECTED_ACCOUNT` |
| `operator.password.rotate`, `operator.update`, `operator.delete` | ADMIN | LAN; `PROTECTED_ACCOUNT` |
| `work_order.read` | semua role | endpoint publik |
| `work_order.cancel` | ADMIN | LAN + `cancel:work_order` |
| `telemetry.reconciliation.refresh` | ADMIN, SUPERVISOR | LAN + `refresh:telemetry` |
| `access_control.manage` | ADMIN | LAN + `manage:access_control` |
| `mqtt.dynsec.manage` | ADMIN | LAN untuk mutasi; `manage:mqtt_admin` |
| `mqtt.config.read` | ADMIN, SUPERVISOR | `/raw` hanya ADMIN (`read_raw`) |
| `mqtt.config.manage` | ADMIN | LAN + `manage:mqtt_configuration` |
| `mqtt.overview.read` | ADMIN | butuh `read:mqtt_admin` + `read:mqtt_configuration` |
| `device.command`, `work_order.dispatch`, `work_order.complete`, `work_order.zone.*` | tidak ada | **HMI-only; jangan dirender di panel** |

Catatan penting:

- **Rotasi password operator adalah ADMIN-only.** Panduan lama menyebut
  SUPERVISOR; itu tidak lagi benar.
- **Ekspor bukan pembacaan publik.** `telemetry`, `downtime`, dan
  `operational-events` export memerlukan Bearer dengan izin
  `refresh:telemetry`, yang hanya dimiliki ADMIN dan SUPERVISOR. Ekspor tidak
  memerlukan LAN, sehingga tetap dapat dipakai dari tunnel read-only.
- **`/system/audit` berbeda dari `/operational-events`.** Yang pertama adalah
  jejak mutasi sistem dan hanya ADMIN + LAN; yang kedua adalah feed operasional
  publik.
- **`/mqtt/overview` efektif ADMIN-only** karena mensyaratkan dua izin
  sekaligus: `read:mqtt_admin` dan `read:mqtt_configuration`. SUPERVISOR hanya
  memiliki yang kedua.
- **SUPERVISOR dapat membaca konfigurasi broker**, tetapi tidak dapat membaca
  file mentah (`/raw`, izin `read_raw`) dan tidak dapat melakukan mutasi.

**Baseline bukan keputusan.** Gunakan tiga state:

| State | Arti | Tindakan UI |
|---|---|---|
| `allowed` | baseline mengizinkan dan server belum menolak | tampilkan aksi |
| `denied` | role-only dan baseline menolak, atau server sudah menolak | sembunyikan/nonaktifkan |
| `unknown` | bergantung pada scope/atribut yang tidak diketahui FE | tampilkan aksi, kirim request, tangani `403` |

Jangan men-disable aksi `unknown` secara proaktif; itu membuat FE menebak scope
dan menyembunyikan aksi yang sebenarnya boleh.

**Penanganan `403`:**

- Tandai request dengan capability key. Saat `403`, turunkan capability itu
  tanpa mem-parse `message` server (body saat ini hanya `{error, message}`).
- Penolakan **role-only** (IAM, dynsec, password) boleh menonaktifkan capability
  secara global untuk sesi.
- Penolakan **per-resource** (nanti: per line/machine) hanya menonaktifkan aksi
  pada resource tersebut — simpan `(capability, resourceId?)`, bukan
  `Set<Capability>`.
- Jangan retry `403`. Setelah capability diturunkan, UI harus berubah agar user
  tidak memicu penolakan berulang.
- `401` stale (`authz_version`) bukan `403`; perlakukan sebagai sesi berakhir.

**Hide vs disable:** sembunyikan aksi yang memang tidak mungkin dimiliki role;
nonaktifkan dengan alasan untuk kondisi sementara (tunnel, sesi stale, lock).
Jangan jadikan UI sebagai pengganti otorisasi server.

**Ingress tunnel:** bila `location.port === "8080"` atau indikator perimeter
lain mendeteksi akses remote, nonaktifkan seluruh aksi tulis dan tampilkan
banner "Mode observasi — perubahan dinonaktifkan". Jangan mencoba memanggil
endpoint lalu menampilkan error.

Rincian cara mesin otorisasi backend bekerja ada di §4.6.

### 4.6 Cara Kerja Otorisasi Backend: Policy, Atribut & Scope

Backend memakai satu mesin policy (spec 021, ADR-0013) dengan model **ABAC**.
Keputusan adalah fungsi dari atribut subjek (role/assignment/scope), aksi,
atribut resource, dan environment. Role bukan unit keputusan; ia hanya pembawa
policy. RBAC adalah cara ringkas menulis policy, bukan model terpisah. UI tidak
perlu mereplikasi mesin ini — tetapi memahaminya mencegah salah tafsir `403`
dan salah desain gerbang UI.

**a. Bentuk policy.** Satu baris policy casbin:

```text
p = role, action, resource_pattern, eft, abac
```

Sumber kebenarannya tabel `authz_roles` / `authz_permissions` /
`authz_policies`; policy dimuat ke memori enforcer. Contoh nyata dari seed:

```text
ADMIN   , send , device_command:*      , ALLOW, (kosong)
OPERATOR, send , device_command:PAUSE  , ALLOW, (kosong)
OPERATOR, send , device_command:RESUME , ALLOW, (kosong)
```

`resource_pattern` selalu `resource_type:resource_id` — id boleh `*`
(`work_order:*`) atau diganti tipe perintah (`device_command:PAUSE`,
FR-PLG-005). Pattern `*` mencocokkan semua resource; `type:*` cocok untuk semua
id tipe tersebut.

**b. Empat dimensi.** Setiap permintaan dinilai dengan
`roleMatch && actionMatch && resourceMatch && abacMatch` — empat atribut yang
harus cocok sekaligus:

| Matcher | Dimensi atribut | Catatan |
|---|---|---|
| `roleMatch` | subjek: role efektif (hasil assignment + scope) | multi-role, dipisah dengan tanda pipe |
| `actionMatch` | aksi yang diminta | action sama persis, atau policy `*` |
| `resourceMatch` | resource: key `type:id` vs pattern | `*` = semua; `type:*` = prefix |
| `abacMatch` | environment + constraint | JSON rusak → DENY |

Scope tidak menjadi matcher kelima: scope memfilter assignment mana yang
menghasilkan role efektif (`effectiveRoles(subject, hints)`); role hasil filter
itulah yang masuk `roleMatch`.

`abac_condition` berupa objek JSON; setiap pasangan kunci-nilainya harus sama
dengan env permintaan. Env yang dikirim saat ini: `ingress_source` (dari header
`x-ingress-source`) dan `subject_active: true`.

**c. Efek: DENY menang.** Formula efek casbin adalah
`some(allow) && !some(deny)`: cukup satu policy DENY yang cocok untuk
menolak permintaan meskipun ada ALLOW lain. Tanpa kecocokan sama sekali juga
DENY (fail-closed, BR-001), begitu pula error enforcer. Saat boot dengan DB
tidak tersedia, enforcer memulai dengan policy kosong = deny-all hingga
reload.

**d. Atribut subjek: assignment, role efektif, dan scope.** Assignment disimpan
di `authz_user_roles (operator_id, role_id, scope_type, scope_id)`. Scope adalah
atribut subjek yang memfilter assignment mana yang berlaku untuk sebuah
permintaan — bukan dekorasi role. Hierarki
`ORGANIZATION > SITE > AREA > LINE > MACHINE > DEVICE` masih kosmetik pada data;
resolver belum menurunkan cakupan leluhur ke turunannya. Ketentuan penting:

- `ORGANIZATION` berlaku di seluruh pabrik — inilah assignment bawaan hasil
  backfill dari kolom `operators.role` (BR-005).
- Untuk seluruh permukaan admin panel, hanya assignment `ORGANIZATION` yang
  efektif. Tidak ada route panel yang memasang hints; satu-satunya hint yang
  terpasang di backend adalah `deviceId` pada
  `POST /devices/:device_id/command` (di luar permukaan panel).
- `scopeCovers()` mencocokkan `SITE`/`AREA`/`LINE`/`MACHINE`/`DEVICE` secara
  eksak terhadap hint yang tersedia. Belum ada resolusi hierarki (linkage
  site/area/line belum ada di schema), sehingga scope sempit belum
  mempersempit izin route admin mana pun pada rilis ini.
- Role efektif (atribut subjek) = gabungan role dari semua assignment yang
  cocok (`ORGANIZATION` selalu cocok). Assignment `LINE:L1` baru berpengaruh
  bila suatu route memasang hint `lineId: "L1"` — belum ada saat ini.
- Custom role hanya benar-benar efektif saat domainnya sudah `enforce`. Di
  mode `shadow`, baseline legacy (role claim token) yang memutuskan.

**e. Dua mesin: shadow vs enforce.**

| | `AUTHZ_MODE=shadow` (default) | `enforce` (`AUTHZ_MODE=enforce` atau `AUTHZ_ENFORCE_DOMAINS`) |
|---|---|---|
| Penentu keputusan | baseline statis seed, dievaluasi dari role claim token | policy DB, dievaluasi dari gabungan role assignment |
| Peran policy dinamis | hanya diaudit | menentukan |
| Divergensi keputusan | dicatat sebagai `SHADOW_MISMATCH` | tidak relevan |

Kontrak shadow: respons rute **tidak boleh berubah** sedikit pun (AC#3) —
guard statis lama tetap yang memutuskan. Kedua mode sama-sama fail-closed:
tidak ada kecocokan atau error = `403`.

**f. Alur `authorize()`.** Plugin memasang
`authorize(action, resourceType, resourceIdFn?, hintsFn?, resourceKeyFn?)`
sebagai preHandler:

```text
Bearer token → identitas (401 bila tidak valid)
→ effectiveRoles(subject, hints)     [cache in-process; miss pertama baca DB]
→ evaluate(): legacy + policy dievaluasi paralel
→ keputusan sesuai mode → audit (fire-and-forget ke authz_decision_audit)
→ DENY → 403 ForbiddenError
```

`resourceKeyFn` mengganti key casbin — dipakai device-command agar policy
membedakan tipe perintah (`device_command:PAUSE`) bukan id device. Cache
assignment di-invalidate lewat `authz_version` (naik saat policy atau
assignment berubah, cache di-clear) dan opsional TTL `AUTHZ_CACHE_TTL_MS`
(default 0). Inilah sebabnya mutasi IAM dapat mengubah izin sesi yang sedang
berjalan tanpa login ulang — dan mengapa UI harus refetch setelah mutasi IAM
(lihat §8).

**g. Anti-eskalasi (level privilege).** `authz_roles.level`:
`ADMIN 40 > SUPERVISOR 30 > OPERATOR 20 > MAINTENANCE 10`
(`ACCOUNT_MANAGER_MIN_LEVEL = 30`). Aturan `canManageRole`:

- level ≥ 40 (ADMIN) → boleh mengelola semua role;
- 30 ≤ level < 40 (SUPERVISOR) → hanya role dengan level lebih rendah;
- level < 30 → tidak boleh mengelola akun siapa pun.

Aturan inilah yang menghasilkan galat `PRIVILEGE_ESCALATION_DENIED`; bersama
`PROTECTED_ACCOUNT` (root protection) keduanya menjadi kode 403 khas modul IAM.
Custom role dibatasi di bawah level 30 (`CUSTOM_ROLE_MAX_LEVEL`, default 29)
dan tidak boleh memegang izin terlarang (`manage:access_control`,
`manage:mqtt_admin`, `manage:mqtt_configuration`, `read_raw:mqtt_configuration`).

**h. Konsekuensi untuk UI.**

- Login mengembalikan satu `role` (claim token) — hanya baseline legacy. Policy
  menilai gabungan atribut subjek; UI tidak dapat mengintrospeksi gabungan ini
  untuk dirinya sendiri. Endpoint
  `GET /access-control/subjects/:operatorId/effective-permissions` ada, tetapi
  hanya ADMIN, tidak mengevaluasi scope/ABAC runtime, dan bukan gerbang
  navigasi umum.
- Jangan parse JWT untuk menyimpulkan izin. Gunakan capability key, bukan
  `role === "..."` tersebar, lalu koreksi dengan `403`/`401`.
- Untuk aksi yang bergantung pada scope/atribut yang tidak diketahui, gunakan
  state `unknown`: tampilkan aksi, kirim request, biarkan server memutuskan.
  Jangan men-disable proaktif berdasarkan tebakan scope.
- `403` pada satu resource tidak berarti capability mati total. Catat penolakan
  per `(capability, resourceId?)`; hanya penolakan role-only yang boleh
  menonaktifkan capability secara global.
- Scope assignment belum mempersempit route panel pada rilis ini: tidak ada
  route admin yang memasang hint `lineId`/`machineId`/`deviceId`, sehingga
  hanya assignment `ORGANIZATION` yang efektif. Jangan menjanjikan pembatasan
  per-line di UI sebelum backend memasang hint tersebut. Pesan `403` mode
  enforce memuat action, resource, dan alasan — tampilkan apa adanya.
- Saat enforce, token yang diterbitkan sebelum `authz_version` naik akan
  ditolak `401`. Arahkan pengguna ke login ulang, bukan menampilkan `403`.

### 4.7 Paginasi & Filter

Endpoint daftar dengan paginasi memakai pola seragam:

```json
{
  "data": [ ... ],
  "meta": { "limit": 50, "hasMore": true, "nextCursor": "eyJ0Ijoi...", "count": 50 }
}
```

- Tanpa `cursor` dan tanpa `envelope=true`, respons berupa **array langsung**.
- Untuk UI berhalaman, selalu kirim `envelope=true` agar metadata tersedia.
- `limit` maksimum berbeda per endpoint:

| Endpoint | Default | Maksimum |
|---|---:|---:|
| `GET /telemetry/:device_id` | 100 | 1000 |
| `GET /telemetry/:device_id/hourly` | 72 | 500 |
| `GET /telemetry/:device_id/export` | 5000 | 50000 |
| `GET /telemetry/:device_id/hourly/export` | 10000 | 100000 |
| `GET /machines`, `/products`, `/work-orders` | 50 | 100 |
| `GET /downtime-events/:device_id` | 50 | 100 |
| `GET /quality/rejects*` | 50 | 100 |
| `GET /operational-events*`, `/system/audit` | 50 | 200 |
| `GET /access-control/audit` | 100 | 1000 |
| `GET /mqtt/configuration/configurations` | 100 | 500 |
| `GET /mqtt/configuration/operations` | 50 | 500 |

- `cursor` bersifat opaque; jangan mem-parse atau memodifikasinya.
- Filter tanggal memakai ISO 8601 dengan offset
  (`2026-11-01T00:00:00+07:00`).
- Ekspor **bukan** endpoint paginasi: tidak ada `cursor`, hanya `limit` dan
  `format`.

Endpoint tanpa paginasi (kembalikan seluruh data): `GET /devices`,
`GET /live-state`, `GET /operators`, `GET /downtime-events/active`,
`GET /oee/shift-timeline`, `GET /telemetry/reconciliation/jobs`,
`GET /quality/rejects` tanpa `cursor`/`envelope`, seluruh daftar IAM kecuali
`/audit`, dan seluruh daftar dynsec. Tiga daftar memakai `limit` sebagai
pemotongan hasil tanpa `cursor`: audit IAM, versi konfigurasi broker
(`/configurations`), dan operasi broker (`/operations`).

### 4.8 Pola Query & Mutasi

- Gunakan query library dengan `queryKey` yang memuat seluruh parameter
  (`["work-orders", filters, cursor]`).
- `staleTime` baca: 30 s untuk master data, 0–5 s untuk data operasional.
- Setelah mutasi sukses: invalidate query yang terdampak (daftar + detail).
- Jangan memakai optimistic update untuk mutasi master data atau work order —
  server dapat menolak dengan `409`. Tampilkan hasil server.
- Cegah double-submit: tombol nonaktif selama mutasi berlangsung.
- Mutasi non-idempoten yang gagal karena jaringan **tidak** diulang otomatis;
  minta pengguna memeriksa daftar sebelum mencoba lagi.

### 4.9 Arah Transisi: Capability Projection (Tersedia via `GET /auth/me`)

Endpoint `GET /api/v1/auth/me` sudah tersedia untuk memproyeksikan capability efektif user yang sedang login (`allow`/`deny`/`unknown`, `mode`, `effectiveRoles`, `authzVersion`, `Cache-Control: no-store`). Gunakan endpoint ini bersama koreksi dinamis `403` sebagai gerbang UI diri sendiri, dan **jangan** memakai `subjects/:operatorId/effective-permissions` sebagai gerbang umum. Untuk penyempurnaan lanjutan menuju ABAC per-resource penuh, dua kontrak berikut tetap layak ditambahkan:

| Kontrak | Isi | Manfaat |
|---|---|---|
| `allowedActions` per baris | aksi yang boleh pada resource itu | Keputusan per-resource, bukan tebak scope |
| `403` terstruktur | `code`, `action`, `resourceType`, `resourceId?`, `reason`, `authzVersion` | Observability + penurunan capability |

Dengan `GET /api/v1/auth/me` yang sudah tersedia, panel langsung memanfaatkan proyeksi capability diri sendiri sejak awal sambil tetap menerapkan koreksi `403` dan state `unknown` agar kompatibel dengan dua kontrak transisi di atas saat tersedia.

---

## 5. Fase 2 — Kerangka UI

Halaman minimum:

| Rute | Isi | Baseline akses |
|---|---|---|
| `/login` | Form **Operator ID** (mis. `ADM-001`) + password | publik |
| `/` | Ringkasan: status sistem, jumlah perangkat online, downtime aktif, WO aktif | `dashboard.read` |
| `/devices` | Registry perangkat + status online + mesin terikat | `device.read` |
| `/machines` | Master mesin + binding perangkat | `machine.read` |
| `/products` | Master produk + cycle time | `product.read` |
| `/operators` | Roster operator + status aktif | `operator.read` |
| `/work-orders` | Daftar + detail + cancel | `work_order.read`; cancel: `work_order.cancel` |
| `/downtime` | Insiden aktif + riwayat + label + ekspor | `downtime.read`; export: `export.telemetry` |
| `/audit` | Jejak audit operasional + ack + ekspor | `operational_event.read` / `operational_event.ack`; export: `export.telemetry` |
| `/telemetry` | Grafik + agregat + ekspor | `telemetry.read`; export: `export.telemetry` |
| `/analytics` | OEE per jam/shift, reject pareto | `oee.read`, `quality.read` |
| `/admin/system-audit` | Audit mutasi sistem | `audit.system.read` |
| `/admin/access-control` | Role, permission, policy, assignment, audit izin | `access_control.manage` |
| `/admin/mqtt` | Klien/peran/grup dynsec + versi konfigurasi broker | `mqtt.dynsec.manage`, `mqtt.config.read`, `mqtt.config.manage` |

Baseline ini hanya untuk navigasi dan render awal; halaman tetap menangani
`403` dan state `unknown` seperti §4.5.

Pola status yang harus konsisten di semua halaman:

- **Loading** — skeleton, bukan spinner layar penuh.
- **Empty** — jelaskan sebab ("belum ada perangkat terdaftar") + aksi utama.
- **Error** — pesan Indonesia + tombol "Coba lagi" (kecuali `401/403`).
- **Stale** — tandai data lama bila refresh terakhir > ambang.
- **Konflik** — dialog, bukan toast, untuk `409` yang butuh keputusan.

---

## 6. Fase 3 — Modul Baca

### 6.1 Dashboard, Live State & Analitik

| Endpoint | Catatan |
|---|---|
| `GET /health` | `{status, uptime, timestamp, ws_clients, db_connected, buffer_pending, buffer_dropped, metrics}`; `metrics` dapat `null` saat collector belum siap |
| `GET /live-state` | Array seluruh perangkat; snapshot kumulatif lifetime |
| `GET /live-state/:deviceId` | Satu perangkat; `404` bila belum pernah mengirim data |
| `GET /downtime-events/active` | Snapshot insiden `end_time = null` |
| `GET /work-orders?status=ACTIVE&envelope=true` | WO aktif per mesin |
| `GET /oee/shift-summary` | Ringkasan shift: A/P/Q, `time_sec`, `window`, `target_per_hour` |
| `GET /oee/hourly` | OEE per jam berdasarkan `machine_id` **atau** `device_id` |
| `GET /oee/shift-timeline` | Segmen state kontigu + overlay downtime |
| `GET /quality/rejects` | Pareto reject level pabrik (semua device) |
| `GET /quality/rejects/:device_id` | Pareto reject per device |

Field penting `live-state`: `deviceId`, `machineId`, `machineName`, `woId`,
`currentState` (6 nilai kanonis: `UNCONFIGURED`, `READY`, `RUNNING`,
`PLANNED_DOWNTIME`, `UNPLANNED_DOWNTIME`, `BATCH_FINISHED`), `availability`,
`performance`, `quality`, `oee`, `totalCount`, `goodCount`, `rejectCount`,
`lastCycleTimeSec`, `operatingTimeSec`, `runTimeSec`, `downtimeSec`,
`spindleRpm`, `machineTempC`, `plcAlarmCode`, `uptimeSeconds`,
`freeHeapBytes`, `lastTelemetryAt`, `updatedAt`.

Jebakan:

- Angka `availability/performance/quality/oee` adalah string numerik — parse
  sebelum dipakai matematis.
- `machineId`/`machineName`/`woId` bisa `null` (mesin belum terikat / belum ada
  WO).
- `lastTelemetryAt` adalah ISO string; jangan menganggapnya Unix detik.
- Snapshot bersifat kumulatif; tren per jam memakai endpoint `hourly` atau
  `/oee/hourly`, bukan selisih snapshot.
- `GET /oee/hourly` mengembalikan `400` bila tidak ada `machine_id` maupun
  `device_id`, dan `404` bila mesin tidak punya device terikat.
- `/oee/shift-summary` dan `/oee/shift-timeline` menerima alias `machine_id` /
  `machineId`, `device_id` / `deviceId`, serta `date`/`shift` untuk pemilihan
  window.
- `GET /quality/rejects` adalah **plant-level**; gunakan `/quality/rejects/:device_id`
  bila ingin per perangkat.

### 6.2 Devices

| Endpoint | Data |
|---|---|
| `GET /devices` | Seluruh registry (tanpa paginasi), termasuk `boundMachine` |
| `GET /devices/:deviceId` | Detail + `boundMachine` |
| `GET /devices/:deviceId/health` | Cache health STM32: `heapFree`, `tasksHealthy`, `tasksTotal`, `staleCount`, `staleTasks`, `ageSec`, `eventFlags` |

`ageSec: 999999` dan field nol berarti cache miss (perangkat belum pernah
mengirim health) — tampilkan "belum ada data", bukan "sehat".

`isOnline` adalah proyeksi TTL backend (default 300 s), bukan flag mentah;
jangan menghitung sendiri dari `lastSeenAt`. `lastSeenAt` dapat `null`.

### 6.3 Machines & Bind Lifecycle

| Endpoint | Catatan |
|---|---|
| `GET /machines` | Paginasi (`limit` ≤100, `cursor`, `envelope`) |
| `GET /machines/:machineId` | Detail; `404` bila tidak ada |
| `POST /machines/:machineId/bind` | Body `{device_id}` (snake_case, regex `STM32-…`); 1:1 |
| `POST /machines/:machineId/unbind` | Tanpa body; melepas device |

Binding bersifat **1 device ↔ 1 mesin** (`machines.device_id` UNIQUE). Sebelum
bind, tampilkan device yang belum terikat saja; `409 DEVICE_ALREADY_BOUND`
berarti data di layar sudah basi — refetch. `409 MACHINE_ALREADY_BOUND`
berarti mesin tujuan sudah punya device; tawarkan unbind lebih dulu.

Unbind dapat ditolak `409` bila mesin masih memiliki Work Order `ACTIVE`.

### 6.4 Products

| Endpoint | Catatan |
|---|---|
| `GET /products` | Paginasi; `stdCycleTimeSec` string desimal (`"12.00"`) |
| `GET /products/:productId` | Detail |

Hard delete hanya bila tidak ada WO `PENDING`/`ACTIVE`; WO `COMPLETED`/`ABORTED`
tetap aman (relasi menjadi `null`). Jelaskan konsekuensi ini di dialog.

### 6.5 Work Orders

| Endpoint | Parameter penting |
|---|---|
| `GET /work-orders` | `status`, `machine_id`, `product_id`, `operator_id`, `from`, `to`, `limit` ≤100, `cursor`, `envelope` |
| `GET /work-orders/:wo_id` | Detail tanpa `device_id` |
| `GET /work-orders/:wo_id/resolve?device_id=` | Pratinjau konfigurasi + `targetPerHour` + `break{start,end,minutes}`; dapat `503 DEVICE_OFFLINE` |

`product_name`/`operator_name`/`machine_name` dapat `null` setelah hard delete.
Tampilkan `[dihapus]` + ID historis, jangan menyembunyikan baris.

Operasi HMI (jangan dibuat sebagai fitur admin panel): `dispatch`, `complete`,
`validate-zone`, `initiate-from-zones`. Panel admin hanya menampilkan detail,
riwayat, dan aksi `cancel` untuk ADMIN.

`POST /work-orders/:wo_id/cancel` menerima `{reason?}` ≤500 karakter dan
mengembalikan `{success, work_order:{wo_id,status,machine_id}}`. Status
`COMPLETED`/`ABORTED` menghasilkan `409 WORK_ORDER_CONFLICT`.

### 6.6 Downtime

| Endpoint | Parameter |
|---|---|
| `GET /downtime-events/active` | tanpa filter |
| `GET /downtime-events/:device_id` | `from`, `to`, `active_only`, `unlabeled_only`, `limit` ≤100, `cursor`, `envelope` (tidak ada filter kategori di server) |
| `GET /downtime-events/:device_id/export` | `from`, `to`, `format=csv\|ndjson\|json`, `limit` ≤100000, `unlabeled_only`, `active_only`; Bearer `refresh:telemetry` |
| `POST /downtime-events/:id/reason` | Body `{category, reason, notes?}`; Bearer + LAN |

Kategori Six Big Losses (enum final): `EQUIPMENT_FAILURE`,
`SETUP_AND_ADJUSTMENT`, `IDLING_AND_MINOR_STOPPAGE`, `REDUCED_SPEED`,
`PROCESS_DEFECT`, `MATERIAL_SHORTAGE`, `PLANNED_MAINTENANCE`, `REST_BREAK`,
`CLEANING_5S`, `OTHER`.

`deviceId`/`machineId` pada baris historis dapat `"[deleted]"` — perlakukan
sebagai label, bukan ID yang dapat ditautkan. Respons menyertakan
`durationSec` dan `durationFormatted`; gunakan yang terakhir untuk tampilan.

### 6.7 Audit Operasional & Audit Sistem

| Endpoint | Parameter |
|---|---|
| `GET /operational-events` | `machine_id`, `event_type`, `from`, `to`, `limit` ≤200, `cursor`, `envelope` |
| `GET /operational-events/:deviceId` | `from`, `to`, `event_type`, `limit` ≤200, `cursor`, `envelope` |
| `GET /operational-events/export` | `machine_id`, `event_type`, `from`, `to`, `format`, `limit` ≤100000; Bearer `refresh:telemetry` |
| `GET /operational-events/:deviceId/export` | `from`, `to`, `event_type`, `format`, `limit` ≤100000; Bearer `refresh:telemetry` |
| `PATCH /operational-events/:id/ack` | Body `{operatorId \| operator_id, note?}` — salah satu ID wajib, `note` ≤500 |
| `GET /system/audit` | `from`, `to`, `limit` ≤200, `cursor`, `envelope`; ADMIN + LAN |

Ack bersifat idempoten. Tampilkan `acknowledgedAt`/`acknowledgedBy` setelah
sukses; jangan mengubah baris secara optimistis.

`/system/audit` mengembalikan feed `operational_events` global yang menjadi
jejak mutasi sistem (termasuk `MASTER_DATA_MUTATION`, `MQTT_ADMIN_*`, dan
perubahan IAM). Jangan mencampurnya dengan feed operasional publik; beda
otorisasi dan beda audiens.

### 6.8 Telemetri, Ekspor & Rekonsiliasi

| Endpoint | Parameter | Catatan |
|---|---|---|
| `GET /telemetry/:device_id` | `from`, `to`, `is_buffered`, `limit` ≤1000 (default 100), `cursor`, `envelope` | Data mentah; `is_buffered` menandai backlog |
| `GET /telemetry/:device_id/hourly` | `from`, `to`, `limit` ≤500 (default 72), `cursor`, `envelope` | Agregat per jam; field `hourly*Sec` adalah **delta per bucket** |
| `GET /telemetry/:device_id/aggregate` | `bucket` enum `1m\|5m\|15m\|1h\|1d` (default `5m`), `from`, `to` | Downsampling on-demand; respons array tanpa paginasi |
| `GET /telemetry/:device_id/export` | `from`, `to`, `format=csv\|ndjson\|json`, `limit` ≤50000 (default 5000) | Bearer `refresh:telemetry`; rate limit 5/menit |
| `GET /telemetry/:device_id/hourly/export` | `from`, `to`, `format`, `limit` ≤100000 (default 10000) | Bearer `refresh:telemetry`; rate limit 5/menit |
| `GET /telemetry/reconciliation/jobs` | — | Status worker CAGG; publik |
| `POST /telemetry/reconciliation/refresh` | `{startWindow?, endWindow?}` | ADMIN/SUPERVISOR, LAN, rate limit 10/menit |

Jangan membandingkan `live-state` (kumulatif lifetime) dengan `hourly`
(delta per bucket). Keduanya hanya sebanding pada jam produksi yang sama.

Ekspor mengembalikan file, bukan JSON envelope. Untuk file besar, tampilkan
progres unduhan dan hormati `429` (rate limit 5/menit per endpoint ekspor).

---

## 7. Fase 4 — Modul Tulis

### 7.1 Aturan Umum Mutasi

1. Hanya dari LAN; remote = nonaktif total.
2. Wajib Bearer JWT; `401` = login ulang, bukan retry.
3. Konfirmasi eksplisit untuk create/update/delete/bind/unbind/ack/refresh.
4. Setelah sukses: refetch daftar + detail; jangan menyisipkan baris manual.
5. `409` → dialog konflik dengan kode domain dan tindakan korektif.
6. Kosongkan form hanya setelah sukses; pertahankan input saat gagal agar dapat
   diperbaiki.

### 7.2 Validasi Klien (cermin backend)

| Entitas | Field | Aturan |
|---|---|---|
| Device | `deviceId` | regex `^STM32-[A-Za-z0-9_-]+$` |
| Device | `macAddress` | format EUI-48 (`:` atau `-`) |
| Device | `ipAddress` | IPv4/IPv6 opsional |
| Device | `firmwareVersion` | ≤50 karakter |
| Machine | `machineId` | regex `^CNC-[A-Z0-9_-]{3,32}$` |
| Machine | `machineName` | 3–100 karakter |
| Machine | `modbusSlaveId` | 1–247, unik global |
| Product | `productId` | regex `^[A-Z0-9_-]{3,32}$` |
| Product | `productName` | 3–100 karakter |
| Product | `stdCycleTimeSec` | > 0, maks 9999 |
| Operator | `operatorId` | 3–32 karakter, regex `^[A-Z0-9_-]+$`, unik |
| Operator | `operatorName` | 3–100 karakter |
| Operator | `lineId` | default `LINE-01`, maks 32 |
| Operator | `password` / `newPassword` | min `AUTH_PASSWORD_MIN_LENGTH` (default 8), maks 128 |
| Operator | `role` | `OPERATOR`/`SUPERVISOR`/`MAINTENANCE`/`ADMIN` |
| Operator | `isActive` | boolean (endpoint `status`) |
| WO complete | `finalRejectCount` | integer ≥ 0 dan ≤ total |
| WO cancel | `reason` | ≤500 karakter (opsional) |
| Downtime reason | `category` | enum 10 nilai |
| Downtime reason | `reason` | 3–255 karakter |
| Downtime reason | `notes` | ≤500 karakter |
| ACK | `operatorId` \| `operator_id` | salah satu wajib; `note` ≤500 (bukan `ackNote`) |
| IAM role | `name` | 2–64 karakter |
| IAM role | `description` / `reason` | ≤256 karakter |
| IAM permission | `action` / `resourceType` | 1–64 karakter |
| IAM policy | `resourcePattern` | 1–128 karakter |
| IAM policy | `effect` | `ALLOW` \| `DENY` |
| IAM user-role | `operatorId` | 1–32 karakter |
| IAM user-role | `roleName` | 2–64 karakter (bukan `roleId`) |
| IAM user-role | `scopeType` | `ORGANIZATION`/`SITE`/`AREA`/`LINE`/`MACHINE`/`DEVICE` |
| IAM user-role | `scopeId` | ≤64 karakter, nullable |
| MQTT client | `username` | regex `^[A-Za-z0-9_-]+$`, 1–64 |
| MQTT client | `password` | min 8 (env), maks 128 |
| MQTT client | `roles` | minimal 1 bila memakai mode eksplisit |
| MQTT client | `deviceId` + `access` | wajib berpasangan untuk provisioning perangkat; `access` = `publish`/`subscribe`/`readwrite` |
| MQTT config apply | `reason` | ≤500 karakter |

Catatan tambahan dari skema backend:

- `POST /devices` menerima `deviceId`, `macAddress`, `ipAddress?`, `firmwareVersion?`;
  `PUT /devices/:deviceId` **hanya** menerima `ipAddress` dan `firmwareVersion` —
  ID dan MAC tidak dapat diubah.
- `POST /machines` menerima `machineId`, `machineName`, `deviceId?` (boleh `null`),
  `modbusSlaveId` (default 1); `PUT /machines/:machineId` hanya `machineName` dan
  `modbusSlaveId`. Binding diubah lewat `bind`/`unbind`, bukan `PUT`.
- `POST /products` menerima `productId`, `productName`, `stdCycleTimeSec`;
  `PUT /products/:productId` hanya `productName` dan `stdCycleTimeSec`.
- `POST /operators` menerima `operatorId`, `operatorName`, `role`, `password`,
  `lineId` (default `LINE-01`); `PUT /operators/:id` menerima `operatorName?`,
  `role?`, `lineId?` — **bukan** password. Password hanya lewat
  `PATCH /operators/:id/password`.
- `POST /mqtt/dynamic-security/clients` menerima **salah satu**:
  `{username,password,roles:[{rolename,priority?}]}` atau
  `{username,password,deviceId,access}`. Tidak ada endpoint
  `POST /clients/provision`; provisioning perangkat memakai `POST /clients`
  dengan `deviceId` + `access`.
- Apply/rollback konfigurasi broker mewajibkan `confirm: true`; tanpa itu
  permintaan ditolak `400`.

### 7.3 Matriks Konflik

| Kode `409` | Arti | Tindakan UI |
|---|---|---|
| `CONFLICT` | Device ID/MAC duplikat, atau device terikat ke mesin dengan WO aktif | Refetch; tampilkan penyebab dari `message` |
| `MACHINE_ALREADY_EXISTS` | ID mesin dipakai | Refetch, minta ID lain |
| `PRODUCT_ALREADY_EXISTS` | ID produk dipakai | Refetch, minta ID lain |
| `OPERATOR_ALREADY_EXISTS` | ID operator dipakai | Refetch, minta ID lain |
| `DEVICE_ALREADY_BOUND` | Device sudah terikat mesin lain | Tawarkan unbind mesin lama |
| `MACHINE_ALREADY_BOUND` | Mesin sudah punya device | Tawarkan unbind lebih dulu |
| `MODBUS_SLAVE_CONFLICT` | Slave ID dipakai mesin lain | Tampilkan mesin pemilik |
| `MACHINE_HAS_ACTIVE_WO` | Tidak boleh hapus/unbind | Tautkan WO aktif |
| `MACHINE_HAS_ACTIVE_DOWNTIME` | Tidak boleh hapus | Tautkan insiden aktif |
| `PRODUCT_HAS_ACTIVE_WO` | Tidak boleh hapus | Tautkan WO |
| `OPERATOR_HAS_ACTIVE_WO` | Tidak boleh hapus | Tautkan WO |
| `WORK_ORDER_CONFLICT` | Complete/cancel pada status WO yang tidak sesuai | Refetch detail WO |
| `UNCLASSIFIED_DOWNTIME_CONFLICT` | Complete ditolak karena downtime belum dilabeli | Arahkan ke halaman downtime |
| `CONFIG_VALIDATION_FAILED` | Kandidat konfigurasi tidak valid | Tampilkan detail validasi (`422`, bukan `409`) |
| `MQTT_CLIENT_ALREADY_EXISTS` / `MQTT_ROLE_ALREADY_EXISTS` / `MQTT_GROUP_ALREADY_EXISTS` | Entitas dynsec sudah ada | Refetch, minta nama lain |
| `CONFLICT` (IAM) | Role/policy identik sudah ada | Refetch daftar |

`PROTECTED_ACCOUNT` (akun `ADM-001`) muncul sebagai `400` saat menonaktifkan
atau mengubah role akun root, dan sebagai `403` saat menghapusnya; bersama
`403 PRIVILEGE_ESCALATION_DENIED` keduanya bukan konflik data — tampilkan
sebagai pembatasan kebijakan. IAM juga dapat menolak `403` untuk policy `DENY`/disabled
pada role ADMIN (anti-lockout) dan untuk reserved permission pada custom role.

### 7.4 Destruksi & Preservasi Histori

Semua delete master bersifat **hard delete dengan FK `SET NULL`**; histori
telemetri, downtime, audit, dan work order **tidak dihapus**. Dialog konfirmasi
wajib menyebutkan:

- data master hilang permanen;
- relasi pada histori menjadi `null` / `[deleted]`;
- telemetri perangkat tetap dapat di-query.

Jangan menawarkan "hapus semua histori" — tidak ada endpoint untuk itu.

---

## 8. Fase 5 — Konsol IAM (`/api/v1/access-control`)

Modul paling sensitif. Konsol ini mengelola **atribut subjek** (role,
permission, policy, assignment, scope), bukan sekadar daftar role. Seluruh
**18 rute**: Bearer + **LAN** + policy `read`/`manage` pada `access_control`,
dan hanya ADMIN yang memegang izin tersebut.

| Endpoint | Fungsi |
|---|---|
| `GET /info` | Mode otorisasi, `authzVersion`, `effectiveInMode` |
| `GET /roles` | Daftar role + policy-nya |
| `POST /roles` | Buat role non-sistem (`name`, `description?`, `reason?`) |
| `PUT /roles/:id` | Ubah deskripsi role |
| `DELETE /roles/:id` | Hapus role non-sistem |
| `POST /roles/:id/permissions` | Assign permission menjadi policy (`permissionId`, `resourcePattern`, `effect?`, `abacCondition?`) |
| `DELETE /roles/:id/permissions/:permissionId` | Cabut seluruh policy role terhadap permission |
| `GET /permissions` | Katalog `action` × `resource_type` |
| `POST /permissions` | Tambah permission (`action`, `resourceType`, `description?`) |
| `GET /user-roles` | Assignment operator → role (+ scope); filter `operatorId?` |
| `POST /user-roles` | Assign role (`operatorId`, `roleName`, `scopeType?`, `scopeId?`) |
| `DELETE /user-roles` | Revoke assignment dengan identitas yang sama |
| `GET /policies` | Semua policy casbin; filter `roleId?` |
| `POST /policies` | Buat policy (`roleId`, `permissionId`, `resourcePattern`, `effect?`, `abacCondition?`, `enabled?`) |
| `PUT /policies/:id` | Ubah pattern/effect/ABAC/enabled |
| `DELETE /policies/:id` | Hapus policy |
| `GET /subjects/:operatorId/effective-permissions` | Preview role, assignment, dan permission; statis, tidak mengevaluasi scope/ABAC runtime |
| `GET /audit` | Audit keputusan otorisasi (`subject`, `decision`, `mode`, `from`, `to`, `limit` ≤1000) |

Aturan yang harus tercermin di UI:

- **Role sistem** (`ADMIN`, `SUPERVISOR`, `OPERATOR`, `MAINTENANCE`) tidak dapat
  dihapus; jangan tampilkan tombol hapus.
- **Anti-lockout:** policy `DENY` atau policy nonaktif pada role `ADMIN` ditolak.
  Jelaskan di form, bukan hanya setelah `403`.
- **Root protection:** operator `is_protected` tidak dapat kehilangan role
  `ADMIN`, dinonaktifkan, atau dihapus.
- **Reserved permission** (`manage:access_control`, `manage:mqtt_admin`,
  `manage:mqtt_configuration`, `read_raw:mqtt_configuration`) tidak boleh
  diberikan ke custom role.
- Scope assignment: `ORGANIZATION`, `SITE`, `AREA`, `LINE`, `MACHINE`, `DEVICE`.
  UI wajib meminta `scopeId` untuk tipe selain `ORGANIZATION`, tetapi beri
  catatan bahwa resolver backend belum memasang hint per-route sehingga baru
  assignment `ORGANIZATION` yang efektif saat ini.
- Setiap mutasi yang mengubah policy atau assignment menaikkan
  `authz_version`; sesi lain dapat langsung terpengaruh. Perubahan katalog
  permission atau deskripsi role tidak menaikkannya. Setelah mutasi IAM,
  lakukan refetch dan sarankan pengguna lain login ulang bila perilakunya
  berubah.
- Gunakan `GET /info` untuk menampilkan mode (`shadow`/`enforce`) dan versi
  cache. Jangan menyimpulkan mode dari perilaku UI.
- Custom role hanya efektif saat domainnya `enforce`; tampilkan peringatan ini
  di form pembuatan role.
- `GET /subjects/:operatorId/effective-permissions` berguna untuk debugging
  izin, tetapi jangan memakainya untuk gerbang self-service.

---

## 9. Fase 6 — Konsol MQTT (ADMIN)

### 9.1 Dynamic Security (`/api/v1/mqtt/dynamic-security/*`)

**23 operasi**: klien, peran, grup, ACL. Semua endpoint memerlukan Bearer
ADMIN; seluruh mutasi juga wajib LAN. Read hanya `read:mqtt_admin`; mutasi
`manage:mqtt_admin`.

Alur penting:

1. **Buat klien** — `POST /clients` dengan salah satu mode:
   - eksplisit: `{username, password, clientid?, roles:[{rolename, priority}]}`
     (minimal 1 role — kebijakan default-deny);
   - provisioning perangkat: `{username, password, deviceId, access}`
     dengan `access` = `publish`/`subscribe`/`readwrite`.
   Tidak ada `POST /clients/provision`; dokumen API lama menyebutnya, tetapi
   rute itu tidak terdaftar.
2. **Password hanya dikembalikan sekali** pada respons `201`. Tampilkan di
   dialog sekali-tampil dengan tombol salin dan peringatan eksplisit; jangan
   menyimpannya di state global atau log.
3. **Rotasi** — `PATCH /clients/:name/password`; tidak ada endpoint untuk
   membaca password lama.
4. **Enable/disable** — `PATCH /clients/:name/enable` `{enabled: boolean}`;
   disable memutus klien.
5. **Hapus** — `DELETE` mengembalikan `204` tanpa body; jangan mengharapkan JSON.

Pemetaan galat khusus: `409 MQTT_*_ALREADY_EXISTS`, `404 MQTT_*_NOT_FOUND`,
`400 MQTT_INVALID_ARGUMENT`, `502 MQTT_ADMIN_ERROR`,
`503 MQTT_BROKER_UNAVAILABLE`, `504 MQTT_RESPONSE_TIMEOUT`.

### 9.2 Konfigurasi Broker (`/api/v1/mqtt/configuration/*`)

**13 operasi** berbasis versi: stage → diff → apply → rollback, plus operasi
async dan backup.

| Endpoint | Fungsi | Akses |
|---|---|---|
| `GET /` | Konfigurasi aktif terstruktur (redacted) | ADMIN/SUPERVISOR |
| `GET /raw` | File mentah (redacted) | ADMIN (`read_raw`) |
| `GET /status` | Kapabilitas runtime, mutation lock, operasi terakhir | ADMIN/SUPERVISOR |
| `POST /configurations` | Stage kandidat (validasi + diff + impact); `422 CONFIG_VALIDATION_FAILED` | ADMIN + LAN |
| `GET /configurations` | Riwayat versi | ADMIN/SUPERVISOR |
| `GET /configurations/:versionId` | Metadata versi + diff redacted | ADMIN/SUPERVISOR |
| `GET /configurations/:versionId/diff` | Diff terhadap parent | ADMIN/SUPERVISOR |
| `DELETE /configurations/:versionId` | Discard versi staged | ADMIN + LAN |
| `POST /configurations/:versionId/apply` | Apply asinkron; `202` | ADMIN + LAN |
| `POST /configurations/:versionId/rollback` | Restage + apply historis; `202` | ADMIN + LAN |
| `GET /operations` | Operasi terbaru (`limit` ≤500) | ADMIN/SUPERVISOR |
| `GET /operations/:operationId` | Status + langkah operasi | ADMIN/SUPERVISOR |
| `GET /backups` | Inventaris backup (metadata) | ADMIN/SUPERVISOR |

Aturan UI: apply/rollback adalah aksi berdampak layanan. Wajib dialog
konfirmasi dengan diff yang terlihat, `confirm: true`, alasan opsional, dan
indikator progres dari endpoint operasi. Jangan menutup dialog sebelum operasi
mencapai status akhir; jangan retry `POST` apply secara otomatis.

### 9.3 Broker Overview (`/api/v1/mqtt/overview`)

Satu endpoint read model yang menggabungkan status dynamic security dan status
konfigurasi: `200 {dynamicSecurity, configuration}`. Rute ini mensyaratkan
**dua** izin (`read:mqtt_admin` dan `read:mqtt_configuration`), sehingga efektif
hanya ADMIN. Metrik uptime/throughput broker tidak disediakan karena tidak ada
sumber data nyata.

---

## 10. Fase 7 — Realtime (Opsional)

Panel admin tidak wajib realtime. Bila dashboard menampilkan status langsung:

- **Satu** koneksi `WS /ws/telemetry` per sesi; semua komponen berbagi.
- Endpoint WS **tidak memakai Bearer**. Keamanannya adalah origin check +
  perimeter jaringan; jangan menganggapnya sebagai batas otorisasi.
- Origin divalidasi server (`CORS_ORIGIN`); origin tidak diizinkan → close
  `4403`. Rate limit 120 koneksi/menit per IP → close `4429`.
- Heartbeat application-level: kirim teks `"ping"`, terima `"pong"`. Server juga
  mengirim protocol ping setiap 30 s. Tidak ada idle timeout aplikasi; klien
  yang menentukan jadwal ping.
- Envelope umum: `{type, ...}`. Tipe yang benar-benar dipancarkan backend:
  `TELEMETRY_UPDATE`, `HEALTH_UPDATE`, `DEVICE_STATUS_UPDATE`, `DEVICE_EVENT`,
  `DOWNTIME_EVENT_OPENED`, `DOWNTIME_EVENT_CLOSED`, `DOWNTIME_REASON_LABELED`,
  `MACHINE_CREATED`, `MACHINE_UPDATED`, `MACHINE_DELETED`, `MACHINE_BOUND`,
  `MACHINE_UNBOUND`, `PRODUCT_CREATED`, `PRODUCT_UPDATED`, `PRODUCT_DELETED`,
  `WORK_ORDER_CANCELLED`, `WORK_ORDER_COMPLETED`. **Abaikan tipe tak dikenal**
  tanpa memutus koneksi. Jangan mengarang nama tipe sendiri.
- Contoh bentuk:
  - `TELEMETRY_UPDATE`: `{type, topic, device_id, machine_id, data, received_at}`;
  - `DEVICE_STATUS_UPDATE`: `{type, device_id, status, is_online, timestamp}`;
  - `DOWNTIME_EVENT_OPENED`: `{type, eventId, deviceId, machineId, triggerSource, startTime}`;
  - `DOWNTIME_EVENT_CLOSED`: `{type, eventId, deviceId, machineId, startTime, endTime, durationSec, durationFormatted}`;
  - `DOWNTIME_REASON_LABELED`: `{type, eventId, deviceId, category, operatorReason, isOverwrite}`;
  - `MACHINE_*` / `PRODUCT_*`: `{type, machine_id}` / `{type, product_id}` (bound/unbound menambahkan `device_id`).
- Unit timestamp berbeda per tipe: `TELEMETRY_UPDATE.data.timestamp` dan
  `DEVICE_STATUS_UPDATE.timestamp` dalam **detik** Unix; `received_at` serta
  timestamp pada event downtime dalam **ISO string**. Normalisasi di satu
  adapter, jangan asumsikan format global.
- `is_buffered: true` adalah backlog historis — jangan dipakai untuk angka live.
- Reconnect dengan backoff 1 s → 30 s; setelah tersambung, refetch snapshot
  `live-state` untuk menutup celah.

---

## 11. Aksesibilitas & Performa

- Semua aksi dapat dioperasikan keyboard; dialog menangkap fokus dan dapat
  ditutup `Escape`.
- Label form eksplisit (`label`/`aria-describedby`), pesan galat terkait field,
  `aria-live` untuk notifikasi.
- Kontras teks minimal WCAG 2.2 AA (AAA untuk angka kritis).
- Jangan merender tabel 1000 baris sekaligus: gunakan paginasi server (default
  50) atau virtualization.
- Grafik telemetri: batasi titik (downsample via `bucket`), render canvas, dan
  batalkan permintaan saat filter berubah cepat (debounce 300 ms).
- Ekspor besar: tampilkan progres, izinkan pembatalan, dan jangan menahan
  seluruh file di memori bila memakai NDJSON.

---

## 12. Matriks Pengujian

| Lapisan | Kasus wajib |
|---|---|
| Klien | Base URL, header Bearer, timeout, retry 502/503/504, tidak retry 4xx, envelope vs array, Zod gagal, parsing file ekspor |
| Sesi | Login sukses/gagal/429, refresh single-flight, refresh 401, token stale `401` saat enforce, logout, refresh halaman |
| Otorisasi | Capability baseline, `403` menurunkan capability (global vs per-resource), state `unknown` tidak di-disable, remote menonaktifkan mutasi, SUPERVISOR ditolak IAM/dynsec, SUPERVISOR boleh baca config tetapi ditolak `/raw` |
| Modul baca | Empty state, `404`, paginasi `hasMore=false`, filter tanggal, `[deleted]`, `metrics: null`, device health cache miss |
| Modul tulis | Sukses, `400` per field, seluruh `409`, double-submit, refetch pasca-mutasi, `403` anti-lockout |
| Operator | Rotasi password hanya ADMIN; SUPERVISOR mendapat `403`; create/status SUPERVISOR boleh |
| Ekspor | Tanpa Bearer `401`; OPERATOR `403`; SUPERVISOR sukses; `429`; header `Content-Disposition` |
| IAM | Role sistem tidak dapat dihapus, DENY pada ADMIN ditolak, reserved permission custom role ditolak, scope assignment, effective-permissions |
| MQTT | Password sekali tampil, enable/disable, `204` tanpa body, `503/504` broker, provision lewat `POST /clients` |
| Realtime | Satu socket, ignore unknown, close `4403`/`4429`, reconnect + refetch |

Pengujian integrasi minimal satu alur end-to-end per modul terhadap backend
sungguhan di LAN (bukan mock), karena banyak perilaku berasal dari guard dan
kebijakan server.

---

## 13. Deployment

- Build statis (Vite) → disajikan Nginx; SPA fallback `try_files $uri /index.html`.
- `VITE_API_URL` kosongkan agar memakai origin + `/api/v1`; backend diproksi oleh
  Nginx yang sama.
- Port 80 = LAN penuh. Port 8080 = tunnel read-only; jangan mengekspos build
  admin panel di vhost yang mengizinkan mutasi.
- Cache: `index.html` `no-store`, aset ber-hash `immutable`.
- Jangan menyajikan `/docs` backend melalui tunnel (sudah ditutup di Nginx).
- Sertakan header keamanan dasar: `X-Content-Type-Options: nosniff`,
  `Referrer-Policy: no-referrer`, CSP tanpa `unsafe-eval`.
- Environment produksi tidak boleh memuat kredensial apa pun di bundle.

---

## 14. Anti-Pattern yang Harus Dihindari

1. Menyimpan JWT di `localStorage`/`sessionStorage`/cookie.
2. Memanggil `fetch` langsung dari komponen dengan URL yang dirakit ad-hoc.
3. Menghitung OEE, availability, atau hasil agregat di klien lalu menimpanya.
4. Menampilkan tombol mutasi pada akses tunnel lalu mengandalkan pesan error.
5. Retry otomatis untuk `401`, `409`, `422`, `429`, atau mutasi non-idempoten.
6. Menganggap `live-state` dan `hourly` memiliki satuan yang sama.
7. Mem-parse `cursor` atau menganggapnya stabil antar-rilis.
8. Menghapus master data dengan asumsi historinya ikut terhapus.
9. Menampilkan password MQTT setelah dialog ditutup atau menyimpannya di log.
10. Mengimpor tipe/skema dari `apps/backend/src` alih-alih mendefinisikan DTO
    sendiri.
11. Menampilkan tombol aktuasi mesin atau memanggil
    `POST /devices/:device_id/command` dari panel admin.
12. Menganggap SUPERVISOR dapat merotasi password operator atau membuka
    Dynamic Security; keduanya ADMIN-only.
13. Menyebut `POST /clients/provision` — rute itu tidak ada; provisioning
    perangkat memakai `POST /clients` dengan `deviceId` + `access`.

---

## 15. Definition of Done

Sebuah modul admin dianggap selesai bila seluruh poin berikut terpenuhi:

- [ ] Semua endpoint modul dipanggil lewat klien terpusat dengan Zod.
- [ ] Loading/empty/error/konflik/stale state tertangani dan konsisten.
- [ ] Otorisasi UI memakai capability key; `403` menurunkan capability dan `401`
      stale memaksa login ulang.
- [ ] Aksi dengan scope/atribut tidak diketahui memakai state `unknown`, bukan
      ditebak atau di-disable proaktif.
- [ ] Tidak ada evaluasi role/scope/policy yang direplikasi di klien.
- [ ] Mode remote menonaktifkan seluruh mutasi dengan banner.
- [ ] Paginasi server dan filter tercermin pada `queryKey`.
- [ ] Mutasi memakai konfirmasi, anti double-submit, dan refetch pasca-sukses.
- [ ] Konflik `409` dipetakan ke dialog dengan tindakan korektif.
- [ ] Ekspor memakai Bearer, menangani `403`/`429`, dan membaca header file.
- [ ] Tidak ada token/password di storage persisten, URL, atau log.
- [ ] Unit test klien + komponen hijau; minimal satu uji integrasi LAN per modul.
- [ ] Tidak ada tombol aktuasi mesin di seluruh panel.
- [ ] Tidak ada referensi ke endpoint yang tidak terdaftar (mis.
      `POST /clients/provision`).

---

## Lampiran A — Katalog Endpoint Lengkap

**Total: 116 operasi REST + 1 WebSocket = 117.**

Rincian: 111 operasi REST merupakan kandidat permukaan admin panel. Satu
operasi REST adalah aktuasi mesin (`POST /devices/:device_id/command`) dan
**tidak boleh** diimplementasikan. Empat operasi work order
(`dispatch`, `validate-zone`, `initiate-from-zones`, `complete`) adalah alur
HMI; panel admin hanya membaca dan membatalkan.

Legenda **Akses**:

- `publik` — tanpa Bearer.
- `publik+LAN` — tanpa Bearer, tetapi hanya dari subnet pabrik.
- `bearer` — wajib Bearer; role yang diizinkan dicantumkan.
- `bearer+LAN` — Bearer + subnet pabrik.
- `admin` — Bearer ADMIN.
- `admin+LAN` — Bearer ADMIN + subnet pabrik.
- `ekspor` — Bearer dengan `refresh:telemetry` (ADMIN/SUPERVISOR).

Label di atas adalah **baseline transport + role**, bukan hasil evaluasi policy.
Scope, `abac_condition`, `ingress_source`, dan status subjek dapat mengubah
keputusan. Untuk aksi sensitif, jangan menganggap label `admin` sebagai jaminan;
server tetap dapat menolak dengan `403`.

Kolom **Sukses** mencantumkan status dan bentuk utama; status galat umum
(`400`, `401`, `403`, `404`, `409`, `429`, `500`) tidak diulang di setiap baris.

### A. Health, Live State, OEE & Kualitas — 8 operasi

| Method | Path | Akses | Parameter kunci | Sukses |
|---|---|---|---|---|
| GET | `/health` | publik | — | `200` HealthResponse |
| GET | `/api/v1/live-state` | publik | — | `200` array |
| GET | `/api/v1/live-state/:deviceId` | publik | `deviceId` | `200`; `404` |
| GET | `/api/v1/oee/shift-summary` | publik | `machine_id`/`machineId`, `device_id`/`deviceId`, `date`, `shift`, `from`, `to`, `include_hourly` | `200` |
| GET | `/api/v1/oee/hourly` | publik | `machine_id` atau `device_id` (salah satu wajib), `from`, `to`, `limit` ≤500, `cursor`, `envelope` | `200`; `400`; `404` |
| GET | `/api/v1/oee/shift-timeline` | publik | `machine_id`/`device_id`, `from`, `to`, `bucket` (`1m\|5m\|15m\|1h`) | `200` array |
| GET | `/api/v1/quality/rejects` | publik | `from`, `to`, `limit` ≤100, `cursor`, `envelope` | `200` array/`{data,meta}` |
| GET | `/api/v1/quality/rejects/:device_id` | publik | `device_id`, `from`, `to`, `limit` ≤100, `cursor`, `envelope` | `200`; `404` |

### B. Telemetri & Rekonsiliasi — 7 operasi

| Method | Path | Akses | Parameter kunci | Sukses |
|---|---|---|---|---|
| GET | `/api/v1/telemetry/reconciliation/jobs` | publik | — | `200` array |
| POST | `/api/v1/telemetry/reconciliation/refresh` | `bearer+LAN` (ADMIN/SUPERVISOR) | `{startWindow?, endWindow?}` | `200`; `429` |
| GET | `/api/v1/telemetry/:device_id` | publik | `from`, `to`, `is_buffered`, `limit` ≤1000 (default 100), `cursor`, `envelope` | `200` |
| GET | `/api/v1/telemetry/:device_id/hourly` | publik | `from`, `to`, `limit` ≤500 (default 72), `cursor`, `envelope` | `200` |
| GET | `/api/v1/telemetry/:device_id/export` | `ekspor` | `from`, `to`, `format` (`csv\|ndjson\|json`), `limit` ≤50000 (default 5000) | `200` file; `429` |
| GET | `/api/v1/telemetry/:device_id/hourly/export` | `ekspor` | `from`, `to`, `format`, `limit` ≤100000 (default 10000) | `200` file; `429` |
| GET | `/api/v1/telemetry/:device_id/aggregate` | publik | `bucket` (`1m\|5m\|15m\|1h\|1d`), `from`, `to` | `200` array |

### C. Perangkat — 6 operasi

| Method | Path | Akses | Parameter kunci | Sukses |
|---|---|---|---|---|
| GET | `/api/v1/devices` | publik | — | `200` array |
| GET | `/api/v1/devices/:deviceId` | publik | `deviceId` | `200`; `404` |
| GET | `/api/v1/devices/:deviceId/health` | publik | `deviceId` | `200`; `404` |
| POST | `/api/v1/devices` | `admin+LAN` | `{deviceId, macAddress, ipAddress?, firmwareVersion?}` | `201`; `409 CONFLICT` |
| PUT | `/api/v1/devices/:deviceId` | `admin+LAN` | `{ipAddress?, firmwareVersion?}` | `200`; `404` |
| DELETE | `/api/v1/devices/:deviceId` | `admin+LAN` | — | `200 {success,message}`; `409 CONFLICT` |

### D. Mesin — 7 operasi

| Method | Path | Akses | Parameter kunci | Sukses |
|---|---|---|---|---|
| GET | `/api/v1/machines` | publik | `limit` ≤100, `cursor`, `envelope` | `200` |
| GET | `/api/v1/machines/:machineId` | publik | `machineId` | `200`; `404` |
| POST | `/api/v1/machines` | `admin+LAN` | `{machineId, machineName, deviceId?, modbusSlaveId?}` | `201`; `409` |
| PUT | `/api/v1/machines/:machineId` | `admin+LAN` | `{machineName?, modbusSlaveId?}` | `200`; `409` |
| DELETE | `/api/v1/machines/:machineId` | `admin+LAN` | — | `200`; `409 MACHINE_HAS_ACTIVE_WO` / `MACHINE_HAS_ACTIVE_DOWNTIME` |
| POST | `/api/v1/machines/:machineId/bind` | `admin+LAN` | `{device_id}` | `200`; `409` |
| POST | `/api/v1/machines/:machineId/unbind` | `admin+LAN` | — | `200`; `409` |

### E. Produk — 5 operasi

| Method | Path | Akses | Parameter kunci | Sukses |
|---|---|---|---|---|
| GET | `/api/v1/products` | publik | `limit` ≤100, `cursor`, `envelope` | `200` |
| GET | `/api/v1/products/:productId` | publik | `productId` | `200`; `404` |
| POST | `/api/v1/products` | `admin+LAN` | `{productId, productName, stdCycleTimeSec}` | `201`; `409` |
| PUT | `/api/v1/products/:productId` | `admin+LAN` | `{productName?, stdCycleTimeSec?}` | `200`; `404` |
| DELETE | `/api/v1/products/:productId` | `admin+LAN` | — | `200`; `409 PRODUCT_HAS_ACTIVE_WO` |

### F. Operator — 7 operasi

| Method | Path | Akses | Parameter kunci | Sukses |
|---|---|---|---|---|
| GET | `/api/v1/operators` | `bearer+LAN` (ADMIN/SUPERVISOR) | — | `200` array |
| GET | `/api/v1/operators/:id` | `bearer+LAN` (ADMIN/SUPERVISOR) | `id` | `200`; `404` |
| POST | `/api/v1/operators` | `bearer+LAN` (ADMIN/SUPERVISOR) | `{operatorId, operatorName, role, password, lineId?}` | `201`; `409`; `403` |
| PATCH | `/api/v1/operators/:id/password` | `admin+LAN` | `{newPassword}` | `200`; `404` |
| PATCH | `/api/v1/operators/:id/status` | `bearer+LAN` (ADMIN/SUPERVISOR) | `{isActive}` | `200`; `400 PROTECTED_ACCOUNT`; `403`; `404` |
| PUT | `/api/v1/operators/:id` | `admin+LAN` | `{operatorName?, role?, lineId?}` | `200`; `400 PROTECTED_ACCOUNT`; `403`; `404` |
| DELETE | `/api/v1/operators/:id` | `admin+LAN` | — | `200`; `403 PROTECTED_ACCOUNT`; `409 OPERATOR_HAS_ACTIVE_WO` |

### G. Work Order — 8 operasi

| Method | Path | Akses | Parameter kunci | Sukses |
|---|---|---|---|---|
| GET | `/api/v1/work-orders` | publik | `status`, `machine_id`, `product_id`, `operator_id`, `from`, `to`, `limit` ≤100, `cursor`, `envelope` | `200` |
| GET | `/api/v1/work-orders/:wo_id` | publik | `wo_id` | `200`; `404` |
| GET | `/api/v1/work-orders/:wo_id/resolve` | publik | `device_id` (wajib) | `200`; `409`; `503 DEVICE_OFFLINE` |
| POST | `/api/v1/work-orders/:wo_id/dispatch` | `bearer+LAN` (ADMIN/SUPERVISOR/OPERATOR) — **HMI** | `{device_id, notes?}` | `200`; `503` |
| POST | `/api/v1/work-orders/validate-zone` | `bearer+LAN` (ADMIN/SUPERVISOR/OPERATOR) — **HMI** | `{zone_type, device_id, raw_string}` | `200`; `409`; `503` |
| POST | `/api/v1/work-orders/initiate-from-zones` | `bearer+LAN` (ADMIN/SUPERVISOR/OPERATOR) — **HMI** | `{device_id, zones}` | `200`; `409`; `503` |
| POST | `/api/v1/work-orders/:wo_id/complete` | `bearer+LAN` (ADMIN/SUPERVISOR/OPERATOR) — **HMI** | `{finalRejectCount, notes?}` | `200`; `400`; `409` |
| POST | `/api/v1/work-orders/:wo_id/cancel` | `admin+LAN` | `{reason?}` | `200`; `409` |

### H. Downtime — 4 operasi

| Method | Path | Akses | Parameter kunci | Sukses |
|---|---|---|---|---|
| GET | `/api/v1/downtime-events/active` | publik | — | `200` array |
| GET | `/api/v1/downtime-events/:device_id` | publik | `from`, `to`, `active_only`, `unlabeled_only`, `limit` ≤100, `cursor`, `envelope` | `200` |
| GET | `/api/v1/downtime-events/:device_id/export` | `ekspor` | `from`, `to`, `format`, `limit` ≤100000, `unlabeled_only`, `active_only` | `200` file; `429` |
| POST | `/api/v1/downtime-events/:id/reason` | `bearer+LAN` (semua role) | `{category, reason, notes?}` | `200` |

### I. Operational Event & Audit Sistem — 6 operasi

| Method | Path | Akses | Parameter kunci | Sukses |
|---|---|---|---|---|
| GET | `/api/v1/operational-events` | publik | `machine_id`, `event_type`, `from`, `to`, `limit` ≤200, `cursor`, `envelope` | `200` |
| GET | `/api/v1/operational-events/:deviceId` | publik | `from`, `to`, `event_type`, `limit` ≤200, `cursor`, `envelope` | `200` |
| GET | `/api/v1/operational-events/export` | `ekspor` | `machine_id`, `event_type`, `from`, `to`, `format`, `limit` ≤100000 | `200` file; `429` |
| GET | `/api/v1/operational-events/:deviceId/export` | `ekspor` | `from`, `to`, `event_type`, `format`, `limit` ≤100000 | `200` file; `429` |
| PATCH | `/api/v1/operational-events/:id/ack` | `bearer+LAN` (semua role) | `{operatorId \| operator_id, note?}` | `200` |
| GET | `/api/v1/system/audit` | `admin+LAN` | `from`, `to`, `limit` ≤200, `cursor`, `envelope` | `200` |

### J. Autentikasi — 2 operasi

| Method | Path | Akses | Parameter kunci | Sukses |
|---|---|---|---|---|
| POST | `/api/v1/auth/login` | `publik+LAN` | `{operator_id, password, station_id?}` | `200`; `401`; `429` |
| POST | `/api/v1/auth/refresh` | `publik+LAN` | `{token}` | `200`; `401` |

### K. Access Control — 18 operasi

Seluruh baris: `admin+LAN`, policy `read` atau `manage` pada `access_control`.

| Method | Path | Parameter kunci | Sukses |
|---|---|---|---|
| GET | `/api/v1/access-control/info` | — | `200 {mode, authzVersion, effectiveInMode}` |
| GET | `/api/v1/access-control/roles` | — | `200` roles + policies |
| POST | `/api/v1/access-control/roles` | `{name, description?, reason?}` | `201`; `409` |
| PUT | `/api/v1/access-control/roles/:id` | `{description?, reason?}` | `200`; `404` |
| DELETE | `/api/v1/access-control/roles/:id` | — | `200`; `404`; `409` |
| POST | `/api/v1/access-control/roles/:id/permissions` | `{permissionId, resourcePattern, effect?, abacCondition?, reason?}` | `201`; `404`; `403` |
| DELETE | `/api/v1/access-control/roles/:id/permissions/:permissionId` | — | `200` |
| GET | `/api/v1/access-control/permissions` | — | `200` array |
| POST | `/api/v1/access-control/permissions` | `{action, resourceType, description?, reason?}` | `201`/`200`; `409` |
| GET | `/api/v1/access-control/user-roles` | `operatorId?` | `200` array |
| POST | `/api/v1/access-control/user-roles` | `{operatorId, roleName, scopeType?, scopeId?, reason?}` | `201`; `404` |
| DELETE | `/api/v1/access-control/user-roles` | `{operatorId, roleName, scopeType?, scopeId?, reason?}` | `200 {success, removed}` |
| GET | `/api/v1/access-control/policies` | `roleId?` | `200` array |
| POST | `/api/v1/access-control/policies` | `{roleId, permissionId, resourcePattern, effect?, abacCondition?, enabled?, reason?}` | `201`; `403`; `409` |
| PUT | `/api/v1/access-control/policies/:id` | `{resourcePattern?, effect?, abacCondition?, enabled?, reason?}` | `200`; `403`; `404` |
| DELETE | `/api/v1/access-control/policies/:id` | — | `200`; `404` |
| GET | `/api/v1/access-control/subjects/:operatorId/effective-permissions` | `operatorId` | `200` |
| GET | `/api/v1/access-control/audit` | `subject`, `decision`, `mode`, `from`, `to`, `limit` ≤1000 | `200` array |

### L. MQTT Dynamic Security — 23 operasi

Read: `admin`. Mutasi: `admin+LAN`.

| Method | Path | Parameter kunci | Sukses |
|---|---|---|---|
| GET | `/api/v1/mqtt/dynamic-security/status` | — | `200` |
| GET | `/api/v1/mqtt/dynamic-security/clients` | — | `200` |
| GET | `/api/v1/mqtt/dynamic-security/clients/:name` | `name` | `200`; `404` |
| POST | `/api/v1/mqtt/dynamic-security/clients` | `{username,password,roles[]}` atau `{username,password,deviceId,access}` | `201` (password sekali); `409` |
| DELETE | `/api/v1/mqtt/dynamic-security/clients/:name` | `name` | `204` |
| PATCH | `/api/v1/mqtt/dynamic-security/clients/:name/password` | `{password}` | `200` |
| PATCH | `/api/v1/mqtt/dynamic-security/clients/:name/enable` | `{enabled}` | `200` |
| POST | `/api/v1/mqtt/dynamic-security/clients/:name/roles` | `{rolename, priority?}` | `201` |
| DELETE | `/api/v1/mqtt/dynamic-security/clients/:name/roles/:rolename` | — | `204` |
| GET | `/api/v1/mqtt/dynamic-security/roles` | — | `200` |
| GET | `/api/v1/mqtt/dynamic-security/roles/:name` | `name` | `200`; `404` |
| POST | `/api/v1/mqtt/dynamic-security/roles` | `{rolename, textname?, textdescription?, acls?}` | `201` |
| DELETE | `/api/v1/mqtt/dynamic-security/roles/:name` | `name` | `204` |
| POST | `/api/v1/mqtt/dynamic-security/roles/:name/acls` | `{acltype, topic, ...}` | `201` |
| DELETE | `/api/v1/mqtt/dynamic-security/roles/:name/acls` | `{acltype, topic}` | `204` |
| GET | `/api/v1/mqtt/dynamic-security/groups` | — | `200` |
| GET | `/api/v1/mqtt/dynamic-security/groups/:name` | `name` | `200`; `404` |
| POST | `/api/v1/mqtt/dynamic-security/groups` | `{groupname, textname?, textdescription?, roles?}` | `201` |
| DELETE | `/api/v1/mqtt/dynamic-security/groups/:name` | `name` | `204` |
| POST | `/api/v1/mqtt/dynamic-security/groups/:name/clients` | `{username, priority?}` | `201` |
| DELETE | `/api/v1/mqtt/dynamic-security/groups/:name/clients/:username` | — | `204` |
| POST | `/api/v1/mqtt/dynamic-security/groups/:name/roles` | `{rolename, priority?}` | `201` |
| DELETE | `/api/v1/mqtt/dynamic-security/groups/:name/roles/:rolename` | — | `204` |

### M. MQTT Configuration — 13 operasi

Read: ADMIN penuh; SUPERVISOR kecuali `/raw`. Mutasi: `admin+LAN`.

| Method | Path | Parameter kunci | Sukses |
|---|---|---|---|
| GET | `/api/v1/mqtt/configuration` | — | `200` |
| GET | `/api/v1/mqtt/configuration/raw` | — | `200`; ADMIN saja |
| GET | `/api/v1/mqtt/configuration/status` | — | `200` |
| POST | `/api/v1/mqtt/configuration/configurations` | `{config, baseVersionId?, reason?, comment?}` | `201`; `422` |
| GET | `/api/v1/mqtt/configuration/configurations` | `limit?` | `200` |
| GET | `/api/v1/mqtt/configuration/configurations/:versionId` | `versionId` | `200`; `404` |
| GET | `/api/v1/mqtt/configuration/configurations/:versionId/diff` | `versionId` | `200`; `404` |
| DELETE | `/api/v1/mqtt/configuration/configurations/:versionId` | `versionId` | `200`; `409` |
| POST | `/api/v1/mqtt/configuration/configurations/:versionId/apply` | `{confirm: true, acknowledgeUnvalidated?, reason?}` | `202`; `409`; `503` |
| POST | `/api/v1/mqtt/configuration/configurations/:versionId/rollback` | `{confirm: true, acknowledgeUnvalidated?, reason?}` | `202`; `409`; `503` |
| GET | `/api/v1/mqtt/configuration/operations` | `limit` ≤500 | `200` |
| GET | `/api/v1/mqtt/configuration/operations/:operationId` | `operationId` | `200`; `404` |
| GET | `/api/v1/mqtt/configuration/backups` | — | `200` |

### N. MQTT Overview — 1 operasi

| Method | Path | Akses | Parameter kunci | Sukses |
|---|---|---|---|---|
| GET | `/api/v1/mqtt/overview` | `admin` (butuh `read:mqtt_admin` + `read:mqtt_configuration`) | — | `200 {dynamicSecurity, configuration}` |

### O. WebSocket — 1 operasi

| Protokol | Path | Akses | Catatan |
|---|---|---|---|
| WS | `/ws/telemetry` | publik + origin check | Satu koneksi per sesi; close `4403` origin, `4429` rate limit |

### P. Aktuasi Mesin — 1 operasi (DI LUAR PERMUKAAN ADMIN)

| Method | Path | Akses | Catatan |
|---|---|---|---|
| POST | `/api/v1/devices/:device_id/command` | `bearer+LAN` (policy per perintah) | **HMI-only.** Jangan diimplementasikan di admin panel. Body `{command, reason, metadata?}`; `PAUSE`/`RESUME`/`RESET_COUNTER` |

---

## Lampiran B — Referensi

- Kontrak API lengkap dan contoh payload: [`apps/backend/docs/API_DOCUMENTATION.md`](../apps/backend/docs/API_DOCUMENTATION.md)
- Diagram alur & matriks otorisasi: [`apps/backend/docs/VISUALISASI_DIAGRAM.md`](../apps/backend/docs/VISUALISASI_DIAGRAM.md)
- Dokumentasi fungsional endpoint & auth: [`apps/backend/docs/DOKUMENTASI_FUNGSIONAL_ENDPOINT_AUTH.md`](../apps/backend/docs/DOKUMENTASI_FUNGSIONAL_ENDPOINT_AUTH.md)
- Dynamic security broker: [`docs/mosquitto-dynamic-security.md`](mosquitto-dynamic-security.md)
- Konfigurasi broker: [`docs/mosquitto-configuration-manager.md`](mosquitto-configuration-manager.md)
- Keputusan perimeter & aktuasi: [`decisions/ADR-002-read-only-remote-tunnel-architecture.md`](../decisions/ADR-002-read-only-remote-tunnel-architecture.md), [`decisions/ADR-003-command-actuation-safety-and-auth.md`](../decisions/ADR-003-command-actuation-safety-and-auth.md), [`decisions/ADR-004-hmi-surface-segmentation.md`](../decisions/ADR-004-hmi-surface-segmentation.md)
- Kontrol akses dinamis: [`decisions/ADR-009-mosquitto-dynamic-security.md`](../decisions/ADR-009-mosquitto-dynamic-security.md), [`apps/backend/specs/021-dynamic-access-control/spec.md`](../apps/backend/specs/021-dynamic-access-control/spec.md)
- Batasan sistem: [`.sdd/context/constraints.md`](../.sdd/context/constraints.md)