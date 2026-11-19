# Rencana Upgrade Backend — IIoT OEE Admin Panel

| | |
| --- | --- |
| **Dokumen** | Rencana Upgrade Backend — IIoT OEE Admin Panel |
| **Tanggal** | 17 November 2026 |
| **Versi** | 1.1 |
| **Status** | Panduan kerja untuk tim backend — belum ada satu pun item yang dikerjakan |
| **Cakupan** | Backend aplikasi IIoT OEE Admin Panel (bukan infra jaringan, bukan panel) |
| **Epic Linear** | E13 — Backend gaps System Admin (FAT-71); A10.2 Mode Akses (FAT-40); V8.2/V8.3/V8.4/V8.5 (FAT-28/30/29/27) |
| **Dokumen acuan** | `API_DOCUMENTATION.md` ("API"), `ADMIN_PANEL_BUILD_GUIDE.md` ("Guide"), `AUDIT.md` §14–§18, `docs/BACKEND_GAPS_SYSTEM_ADMIN.md`, `docs/BACKEND_REQUIREMENTS_ACCESS_MODE.md`, `docs/TELEMETRY_AUDIT.md` |

*v1.1 (17 Nov 2026 sore): sinkronisasi pasca-E14/E15 — decision log Fase 0 15/15, registry 132 operasi, tests 335/335, Linear 129 issue, referensi AUDIT.md §14–§18.*

> **Catatan 19 Nov 2026 (E20/P20.7):** `docs/BACKEND_GAPS_SYSTEM_ADMIN.md`
> diarsipkan ke `docs/archive/BACKEND_GAPS_SYSTEM_ADMIN.md`. Sumber kebenaran
> kini API docs terupdate (`~/workspace/user/files/pasted-text.txt`) — diff
> panel vs api_docs di `docs/API_SYNC_DIFF.md`, diff yang perlu ditinjau
> kembali di `docs/API_SYNC_REVIEW.md`. Keputusan Fase 0 (K-01–K-15) kini
> terkonfirmasi api_docs; K-11 digantikan `POST /devices/provision` (spec 015).

---

## 1. Tentang dokumen ini

### 1.1 Tujuan

Dokumen ini adalah panduan upgrade backend untuk sistem IIoT OEE Admin Panel.
Ia menjawab satu pertanyaan: **apa yang harus dibangun, diputuskan, dan
diverifikasi di sisi backend** agar panel admin yang sudah jadi dapat berjalan
dalam mode Real — bukan hanya mode Demo.

Panel sudah selesai dan terverifikasi di sisi klien (TypeScript 0 error,
335/335 test, build OK, preview HTTP 200). Yang belum ada adalah backend itu
sendiri. Audit terhadap panel menemukan 50 gap kontrak System Admin
(SYS-B1–SYS-B50), 25 kebutuhan mode akses (B1–B25), dan sejumlah item sisi
server pada telemetry/OEE. Dokumen ini menyusun semuanya menjadi rencana
bertahap — Fase 0 sampai Fase 9 — dengan referensi yang bisa dilacak kembali
ke dokumen sumber.

### 1.2 Audiens

Tim backend. Dokumen ini mengasumsikan pembaca memegang `API_DOCUMENTATION.md`
dan `ADMIN_PANEL_BUILD_GUIDE.md` dan dapat mengubah implementasi maupun
dokumen tersebut. Item yang ditandai "keputusan dokumen" tidak membutuhkan
kode baru — hanya ketetapan tertulis — tetapi tetap dicatat sebagai pekerjaan
karena tanpa ketetapan itu panel tidak bisa dibuat benar di mode Real.

### 1.3 Cara membaca

- Setiap item pekerjaan membawa referensinya: `SYS-Bn` (gap System Admin),
  `Bn` (kebutuhan mode akses), `FAT-nn` (issue Linear), atau bagian dokumen
  (`API §…`, `Guide §…`, `AUDIT.md §…`).
- **Fase 0 harus selesai dulu.** Fase-fase berikutnya mengasumsikan keputusan
  Fase 0 sudah diambil; mengerjakan implementasi sebelum keputusan diambil
  berarti mengerjakan dengan kontrak yang belum pasti.
- Ukuran usaha ditulis relatif: **S** (kecil), **M** (sedang), **L** (besar).
  Ini estimasi relatif antar-item, **bukan komitmen jam**. Tidak ada angka jam
  di dokumen ini.
- Bila sesuatu belum diputuskan, dokumen ini menulis **"belum diputuskan —
  lihat Fase 0"**, bukan menebak.
- Bagian "Tidak ada gap" (daftar endpoint yang sudah cocok) tidak diulang di
  sini kecuali sebagai konteks; daftar lengkapnya ada di
  `docs/BACKEND_GAPS_SYSTEM_ADMIN.md` bagian "Tidak ada gap".

### 1.4 Status saat ini — tulis apa adanya

- **Backend belum ada.** Panel berjalan demo-first dengan switch ke mode
  Real; mode Real belum pernah terverifikasi end-to-end (tidak ada backend
  hidup untuk diuji).
- **Panel gating hanya UX.** Mode akses, capability, dan penolakan di panel
  adalah pertahanan lapis pertama. **Server adalah otoritas final** — tanpa
  penegakan server, siapa pun bisa mem-bypass panel (curl langsung ke API)
  dan menulis dari internet sekalipun mode `private`.
- **Demo menutupi sebagian besar gap.** Filter in-memory, seed yang mengarang
  field/kode error, health sintetis, apply sinkron. **Tidak satu pun
  acceptance criteria di dokumen ini boleh diuji melawan Demo** — semuanya
  harus diuji melawan backend sungguhan di mode Real.
- **Status Linear (17 November 2026):** 129 issue (70 Done / 1 In Progress /
  58 Todo). E13 (FAT-71) dan seluruh child SYS-B1–SYS-B50 (FAT-72–FAT-121)
  masih Todo. A10.2 (FAT-40), V8.2 (FAT-28), V8.3 (FAT-30), V8.4 (FAT-29),
  V8.5 (FAT-27) juga masih Todo. E14 (FAT-122) dan E15 (FAT-128) — tindak
  lanjut panel keputusan Fase 0 — sudah Done.
- **Yang dikecualikan dari rencana ini:** infra jaringan (konfigurasi Nginx,
  dual-vhost, port, TLS, tunnel — V8.4, butuh target server, bukan bagian
  backend aplikasi) dan pekerjaan sisi panel (dicatat terpisah di dokumen
  gap sebagai "temuan sisi panel/demo", bukan bagian rencana ini).

---

## 2. Ringkasan eksekutif

### 2.1 Angka-angka

| Sumber | Hitungan |
| --- | --- |
| Gap backend System Admin (SYS-B1–SYS-B50) | **50 gap: 12 High, 23 Medium, 15 Low** |
| Kebutuhan backend mode akses (B1–B25) | **25 kebutuhan** + checklist verifikasi V1–V12 |
| Gap telemetry/OEE dengan item sisi server | **25 gap (G1–G25)**; item server: F-2, F-7/G8, G25, default server 72/500 |
| Endpoint admin di registry panel | **132 operasi** (59 kunci di irisan System Admin) — **tidak ada endpoint yang hilang** |
| Pertanyaan terbuka yang tidak bisa diputuskan dari dokumen saja | **22** (lihat `docs/BACKEND_GAPS_SYSTEM_ADMIN.md` bagian akhir) |

Poin terpenting dari angka di atas: **tidak ada satu pun endpoint yang belum
didaftarkan**. Hampir semua gap adalah ketidaksesuaian **bentuk kontrak**
(body/method/field/filter/skema respons), bukan endpoint yang belum ada.
Artinya pekerjaan backend di sini sebagian besar adalah **menetapkan dan
menerapkan kontrak yang sudah tertulis setengah-setengah**, bukan membangun
fitur dari nol.

### 2.2 Enam tema lintas-gap

Tema-tema ini diangkat langsung dari `docs/BACKEND_GAPS_SYSTEM_ADMIN.md`
bagian Ringkasan:

1. **Skema respons tidak tertulis** untuk hampir seluruh permukaan admin
   (SYS-B6, B12, B19, B20, B35, B43, B44). Panel menebak field dan menutup
   kekosongan dengan default diam-diam (`is_system → false`,
   `privilege_level → 1`, `created_at → epoch`, `access_mode → 'LAN'`,
   `mqtt.status → 'UP'`, `environment → 'production'`, latensi `0`). Di Real
   mode halaman bisa tampil salah tanpa error apa pun.
2. **Panel mengirim snake_case / array jamak; dokumen menetapkan camelCase /
   objek tunggal.** Berulang sistematis: policy IAM, sub-operasi dynsec
   (`{roles:[...]}`, `{acls:[...]}`, `{clients:[...]}` vs `{rolename}` /
   `{acltype, topic}` / `{username}`), stage config (`{config, summary}` vs
   `{config, baseVersionId?, reason?, comment?}`). Salah satu pihak harus
   berubah; backend harus menetapkan sumber kebenaran.
3. **Method salah di transport panel** (PATCH vs PUT di IAM, POST vs PATCH di
   dynsec). Bila backend mengikuti dokumen secara ketat, operasi ini gagal
   404/405 di Real mode. Perbaikan kode kemungkinan besar di panel — tapi
   keputusan "dokumen atau panel yang benar" harus datang dari backend.
4. **Filter yang dikirim panel tapi tidak ada di dokumen / bertentangan
   antar-dokumen** (SYS-B11, B17, B22, B23, B24, B45). Akar bersama: tidak ada
   dokumen yang menyatakan apakah query param tak dikenal **diabaikan atau
   ditolak 400** (Zod strict?). Satu keputusan backend soal ini menentukan
   dampak sekelompok gap.
5. **Demo menutupi kegagalan Real mode.** Filter in-memory, seed yang mengarang
   field/kode error, validasi karangan sendiri, health yang disintesis,
   apply/rollback sinkron.
6. **Kontradiksi dokumen-vs-dokumen** — D-1/D-2 sudah diketahui (AUDIT.md §3),
   ditambah D-3–D-7 dan 15 keraguan lain (lihat Fase 0 dan bagian "Pertanyaan
   terbuka" di dokumen gap).

### 2.3 Prinsip

- **Server otoritas final.** Setiap keputusan keamanan dan otorisasi ditegakkan
  di server (middleware, bukan per-handler). Panel hanya memproyeksikannya.
- **Kontrak dulu sebelum kode.** Skema request/respons ditulis dan dicontohkan
  di dokumen API sebelum (atau bersamaan dengan) implementasi. Bila dokumen
  dan kode berbeda, yang salah adalah salah satunya — dan ketetapan mana yang
  benar dicatat di decision log (Lampiran C).
- **Demo bukan bukti.** Acceptance criteria hanya lolos bila diuji melawan
  backend sungguhan di mode Real.
- **Fail-closed.** Bila konfigurasi hilang/rusak, server jatuh ke mode paling
  aman (`private`, tolak), bukan paling longgar.

### 2.4 Peta fase

| Fase | Isi | Pintu masuk (dependensi) |
| --- | --- | --- |
| **Fase 0** | Keputusan yang harus dibuat dulu | — (mulai di sini) |
| **Fase 1** | Fondasi kontrak (skema respons, envelope, trailing slash, 422) | Fase 0 |
| **Fase 2** | MQTT Dynamic Security | Fase 0 (K-05, K-06, K-10, K-11); Fase 1 |
| **Fase 3** | IAM, policy, ABAC & Auth | Fase 0 (K-01, K-02, K-08, K-09, K-10, K-12); Fase 1 |
| **Fase 4** | Audit, health & info | Fase 0 (K-08, K-13, K-14); Fase 1 |
| **Fase 5** | Konfigurasi broker MQTT | Fase 0 (K-03, K-04, K-07); Fase 1 |
| **Fase 6** | Master data & operator | Fase 0 (K-08); Fase 1 |
| **Fase 7** | Mode akses Private/Public | Fase 0; Fase 3 (auth/capability) |
| **Fase 8** | Telemetry & OEE sisi server | Fase 0 (K-15); Fase 1 |
| **Fase 9** | Verifikasi & go-live | Semua fase 1–8 |

Urutan yang diusulkan di dokumen gap (SYS-B) selaras dengan peta ini:
(1) sumber kebenaran dynsec → (2) skema policy + ABAC + respons IAM +
`mustChangePassword` → (3) kontrak audit + health → (4) kontrak config broker
→ (5) keputusan global query param + filter yang bertentangan → (6) master
data + operator → (7) `POST /permissions`, hapus role ber-pemakaian,
capability kanonis, filter audit IAM.

---

## 3. Prinsip & prasyarat

### 3.1 Prinsip kerja

1. **Satu sumber kebenaran per kontrak.** Untuk setiap endpoint, ada satu
   bentuk request dan satu bentuk respons yang didokumentasikan dengan contoh
   JSON. Bila API dan Guide berbeda, ketetapan ditulis di decision log dan
   dokumen yang salah dikoreksi — jangan biarkan dua versi hidup berdampingan.
2. **Validasi menolak dengan pesan yang menyebut field.** 400
   `INVALID_POLICY` / `CONFIG_VALIDATION_FAILED` harus menyebut atribut,
   operator, atau field mana yang ditolak — bukan pesan generik.
3. **Tidak ada nilai yang disintesis.** Backend tidak mengarang field yang
   tidak diukur (latensi, status broker, jumlah klien). Bila suatu data tidak
   tersedia, endpoint menyatakan tidak tersedia — panel akan menyembunyikan
   kartu tersebut, bukan menampilkan angka palsu.
4. **Audit trail untuk setiap mutasi.** Termasuk perubahan mode akses, bind/
   unbind permission, dan perubahan policy — lengkap dengan `reason` bila
   dikirim klien.
5. **Penegakan di middleware.** Aturan kanal (mode akses) dan otorisasi
   dieksekusi sebelum handler bisnis, supaya endpoint baru otomatis
   terlindungi.
6. **Perubahan yang merusak dikomunikasikan.** Bila kontrak berubah dari yang
   selama ini diasumsikan panel (mis. nama field), perubahan dicatat di
   decision log dan panel disesuaikan dalam pekerjaan terpisah — rencana ini
   tidak mencakup perubahan panel.

### 3.2 Prasyarat sebelum mulai

| # | Prasyarat | Keterangan |
| --- | --- | --- |
| P-1 | Akses ke `API_DOCUMENTATION.md` dan `ADMIN_PANEL_BUILD_GUIDE.md` versi terbaru | Kedua dokumen adalah acuan; bila ada versi yang lebih baru dari yang dipakai audit (API 1780 baris, Guide 1553 baris), audit ulang selisihnya |
| P-2 | Akses ke repo panel (`iiot-oee-admin-panel`) | Untuk membaca transport/mapper yang dirujuk tiap gap (`src/services/api/http/*`, `src/services/api/endpoints/*`) |
| P-3 | Akses ke `docs/BACKEND_GAPS_SYSTEM_ADMIN.md`, `docs/BACKEND_REQUIREMENTS_ACCESS_MODE.md`, `docs/TELEMETRY_AUDIT.md`, `AUDIT.md` §14–§18 | Dokumen sumber rencana ini |
| P-4 | Environment staging dengan backend yang bisa dijalankan | Acceptance criteria diuji melawan backend sungguhan, bukan Demo; butuh staging yang bisa dimatikan broker-nya, diubah mode-nya, dan diisi data >1 halaman |
| P-5 | Akses ke broker Mosquitto dengan plugin Dynamic Security | Untuk Fase 2 dan Fase 5; tanpa ini bentuk dynsec dan config tidak bisa diverifikasi |
| P-6 | Akses Linear (project P-FAT-1) | Untuk memperbarui status issue E13/A10.2/V8.x saat pekerjaan selesai dan terverifikasi |
| P-7 | Stack yang sudah ditetapkan di dokumen acuan | Fastify, Zod, Casbin, Mosquitto dynsec, JWT, Postgres — jangan mengarang detail stack di luar yang tertulis di dokumen acuan |

### 3.3 Yang bukan prasyarat

- Tidak perlu menunggu pekerjaan panel. Rencana ini berdiri sendiri; penyesuaian
  panel (bila keputusan Fase 0 menyatakan panel yang harus berubah) adalah
  pekerjaan terpisah di luar dokumen ini.
- Tidak perlu menunggu infra jaringan (Nginx) untuk Fase 1–8. Infra dicatat
  di Fase 9 sebagai item terpisah yang butuh target server.

---

## 4. Fase 0 — Keputusan yang harus dibuat dulu

**Tujuan:** menutup semua kontradiksi dan kekosongan dokumen sebelum satu
baris pun implementasi ditulis. Setiap baris di bawah ini memblokir satu
atau lebih fase berikutnya.

**Usaha:** S (keputusan dokumen saja; tanpa kode). **Kriteria selesai:**
setiap baris punya keputusan tertulis di decision log (Lampiran C) dan
dokumen API/Guide yang bertentangan sudah dikoreksi.

| # | Keputusan | Opsi | Rekomendasi | Dampak bila tidak diputuskan |
| --- | --- | --- | --- | --- |
| K-01 | D-1 — Body `POST /auth/password/change` (AUDIT.md §3) | (a) API §L `{current_password, new_password}`; (b) Guide Lampiran J `{old_password, new_password}` | (a) — panel sudah memakai API §L | Ganti password Real mode gagal 400; panel dan backend memakai nama field berbeda |
| K-02 | D-2 — Bentuk `GET /auth/me` (AUDIT.md §3) | (a) API §L `{operator, authz:{...}}`; (b) Guide §4.9 bentuk flat | Tetapkan satu; panel menangani keduanya hari ini, jadi yang dipilih hanya perlu dinyatakan | Mapper panel menebak-nebak; `primaryRole` bisa jatuh ke default `'OPERATOR'` bila backend hanya mengirim `operator.primaryRole` tanpa `operator.role` |
| K-03 | D-3 — Trailing slash `GET /mqtt/configuration` (SYS-B38) | (a) Wajib slash (API §3.3b); (b) tanpa slash (Guide Lampiran P); (c) terima keduanya | (c) terima keduanya | Halaman konfigurasi broker gagal 404 dan tidak pernah mendapat draft |
| K-04 | D-4 — Detail error 422 staging (SYS-B40) | (a) `issues[]` (envelope API §2); (b) `details` (API §3.3b/§2 tabel) | (a) — konsisten dengan envelope standar; bentuk tiap item `{field, message}` | Pengguna hanya melihat pesan generik tanpa tahu field mana yang salah |
| K-05 | D-5 — Bentuk body sub-operasi dynsec (SYS-B31, B32, B36, B37) | (a) Objek tunggal dokumen (`{rolename, priority?}`, `{acltype, topic, ...}`, `{username, priority?}`); (b) array jamak panel (`{roles:[...]}`, `{acls:[...]}`, `{clients:[...]}`) | **Diputuskan 17 Nov 2026: (a) objek tunggal dokumen** — ikuti desain API_DOCUMENTATION/Guide Lampiran A; panel diubah (E15) | Panel sudah mengirim objek tunggal; bila backend memakai bentuk native dynsec, dokumen dikoreksi ke bentuk array |
| K-06 | D-6 — Skema respons dynsec (SYS-B34, B35) | Tetapkan: field status klien (`enabled` vs `disabled`), nama field password sekali tampil, bentuk `roles`/`groups` (string vs objek) | **Diputuskan 17 Nov 2026: ikuti desain API_DOCUMENTATION** — password wajib dari pemanggil (API §M: contoh cURL selalu menyertakan password eksplisit; Guide §7.2 min 8); mapper `enabled` diperbaiki agar benar untuk kedua bentuk; nama field password sekali tampil + contoh JSON tetap tugas dokumentasi backend (item 2.5/2.6) | Panel sudah mengikuti dokumen; risiko tersisa hanya di sisi dokumentasi backend |
| K-07 | D-7 — Skema config terstruktur (SYS-B43) | Tetapkan: field, tipe, satuan, default, field yang diredaksi, enum status versi/operasi | **Diputuskan 17 Nov 2026: ikuti desain API_DOCUMENTATION** — API §3.3b tidak memberi skema, panel mempertahankan skema asumsinya; backend wajib mempublikasikan skema JSON (item 5.1); overview `configuration: null` = plugin tidak aktif → panel menampilkan UNAVAILABLE (E15) | Panel sudah mengikuti dokumen sejauh yang tertulis; risiko tersisa bila skema backend berbeda dari asumsi panel |
| K-08 | Kebijakan query param tak dikenal | (a) Diabaikan; (b) ditolak 400 (Zod strict) | (a) diabaikan — paling kecil risikonya terhadap filter panel yang sudah berjalan; bila memilih (b), semua filter panel harus divalidasi dulu | Menentukan dampak SYS-B22, B23, B24, B45: filter yang tidak didukung diam-diam diabaikan vs gagal 400 |
| K-09 | Status `POST /permissions` (SYS-B10) | (a) Didukung (skema body ditetapkan); (b) katalog seed-only, endpoint dihapus dari dokumen | Putuskan dan dokumentasikan; bila (a), tetapkan casing body (`resource_type` vs `resourceType`) | Admin tidak bisa mendaftarkan permission untuk guard baru; atau panel memanggil endpoint yang tidak ada |
| K-10 | Sumber kebenaran method PATCH vs PUT | (a) Hanya PUT (dokumen) untuk `/roles/:id` dan `/policies/:id`; hanya PATCH (dokumen) untuk rotasi password dan enable/disable dynsec; (b) terima keduanya | (a) — dokumen konsisten di sini; panel yang harus berubah | Mutasi IAM dan dynsec gagal 404/405 di Real mode |
| K-11 | D-1b — Rute provisioning (SYS-B30) | (a) `POST /clients` dengan body `{deviceId, access, ...}` (API §M, Guide §9.1/§14.13); (b) `POST /clients/provision` (contoh cURL API §M) | (a) — Guide tegas tidak ada rute `/clients/provision` | Pembuatan klien mode device gagal 404 atau terbentuk dengan grant yang salah |
| K-12 | Aturan naiknya `authz_version` | (a) API §3.4: setiap mutasi menaikkan; (b) Guide §8: perubahan katalog permission atau deskripsi role tidak menaikkan | Putuskan dan selaraskan kedua dokumen | Token lama ditolak 401 di saat yang salah (atau tidak ditolak saat seharusnya) |
| K-13 | Cakupan feed `/system/audit` dan enum `event_type` | (a) `/system/audit` alias harfiah seluruh feed operational events; (b) subset hanya event mutasi; plus: tetapkan enum `event_type` dan nyatakan status `severity` (tidak muncul di dokumen sama sekali) | Putuskan; dokumentasikan enum dan filter yang didukung | Filter `event_type` di `/system/audit` tidak jelas diterima/diabaikan/ditolak; nilai di luar enum bisa 400 atau hasil kosong |
| K-14 | Ack operational event: `operatorId` wajib atau tidak (SYS-B21) | (a) Turunkan operator dari JWT, body `{note?}` saja; (b) salah satu ID wajib (Guide §6.7) | (a) — endpoint terotentikasi, server sudah tahu pemanggil | Setiap ack dari panel gagal 400 di Real mode bila backend mengikuti Guide |
| K-15 | Definisi availability untuk jam planned penuh (G8, sisi server) | (a) Jam yang sepenuhnya planned downtime dikeluarkan dari penyebut availability (ditandai "planned", bukan 0%); (b) dilaporkan 0% | (a) — sesuai praktik OEE; panel hanya menampilkan apa yang dikirim server | Jam istirahat tampil sebagai jam "gagal total" (OEE 0%, availability 0%) |

**Status keputusan — 17 November 2026:** 15 dari 15 baris diputuskan oleh Fathur dan tercatat di decision log (Lampiran C); K-05, K-06, dan K-07 diputuskan menyusul dengan arahan "ikuti desain API_DOCUMENTATION" — panel sudah disesuaikan (E15, FAT-128–133). Dua keputusan menyimpang dari rekomendasi rencana: K-03 memilih (a) wajib slash (bukan (c) terima keduanya) dan K-11 memilih (b) `POST /clients/provision` (bukan (a) `POST /clients`); keduanya menimbulkan tindak lanjut sisi panel (E14). Sisa pekerjaan K-05/K-06/K-07 ada di sisi backend: dokumentasikan nama field password sekali tampil (item 2.5), skema respons dynsec lengkap dengan contoh JSON (item 2.6), dan skema JSON config terstruktur (item 5.1). Fase 2 dan Fase 5 tidak lagi tertunda oleh keputusan — tertunda oleh penulisan dokumen/skema backend. **Perubahan 18 November 2026 (delegasi Fathur ke Muse, Lampiran C §C.1a):** backend membalik K-03 → (c) terima keduanya, K-04 → dual `issues[]`+`details`, K-09 → (a) didukung+guard, K-11 → (a) `POST /clients`; K-01/K-02/K-12/K-15 dikonfirmasi tetap (a); tujuh keputusan gap baru diputuskan (B1 camelCase, B3 ABAC minimal, B4 alur paksa, B6 skema IAM, B7 409, B16 5/60+`Retry-After`, enum `event_type` tertutup).

**Urutan di dalam Fase 0:** K-05, K-06, K-08, dan K-10 dulu (menentukan
bentuk dynsec dan kebijakan filter — memblokir Fase 1–6); lalu K-01, K-02,
K-03, K-04, K-07, K-09, K-11, K-12, K-13, K-14, K-15. Semua baris harus
tertutup sebelum Fase 1 dimulai; bila satu baris macet, fase yang
tergantung padanya ditunda, bukan dikerjakan dengan asumsi.

---

## 5. Fase 1 — Fondasi kontrak

**Tujuan:** semua skema respons, envelope, dan aturan umum ditulis dan
dicontohkan di dokumen API, sehingga tidak ada lagi mapper panel yang
menebak.

**Usaha:** M. **Dependensi:** Fase 0 (K-03, K-04, K-05, K-06, K-07, K-08).

| # | Item pekerjaan | Referensi | Kriteria selesai |
| --- | --- | --- | --- |
| 1.1 | Publikasikan skema respons eksplisit (field + tipe + contoh JSON) untuk `GET /info`, `GET /roles`, `GET /permissions`, `GET /user-roles`, `GET /policies`, `GET /subjects/:operatorId/effective-permissions` (API §3.4). Nyatakan eksplisit field yang **tidak** ada (mis. `privilege_level`, `policy_count`). | SYS-B6 (FAT-77) | Setiap endpoint punya contoh respons di dokumen; respons live cocok field-per-field; panel tidak lagi menampilkan "Level 1" atau tombol hapus ADMIN |
| 1.2 | Dokumentasikan dan kembalikan skema item audit lengkap untuk `GET /system/audit` dan `GET /operational-events[/:deviceId]`: `id`, `timestamp`/`createdAt`, `deviceId`, `machineId`, `machineName`, `eventType`, `action` (atau nyatakan `action` = `eventType`), `operatorId`, `operatorName`, `resourceType`, `resourceId`, `details`/`message`, `clientIp`, `accessMode`, `severity`, plus field ack (`acknowledged`, `acknowledgedBy`, `acknowledgedAt`, `ackNote`). | SYS-B19 (FAT-90) | `GET /system/audit?limit=20&envelope=true` mengembalikan baris yang memuat semua field di atas; tabel audit Real mode menampilkan aktor/aksi/resource/IP/mode tanpa default mapper yang terpicu (periksa respons mentah) |
| 1.3 | Dokumentasikan skema envelope list: `{data: OperationalEventItem[], meta: {limit, next_cursor: string\|null, has_more: boolean, total_count?: number}}` (atau nyatakan array polos + cursor di header sebagai alternatif). | SYS-B25 (FAT-96) | Dengan >1 halaman data, tombol next pada `/audit` dan `/admin/system-audit` muncul dan mengembalikan halaman berikutnya; `total_count` (bila ditampilkan) cocok dengan jumlah server |
| 1.4 | Terapkan keputusan K-08 (query param tak dikenal) secara konsisten di semua endpoint list, dan selaraskan dokumen. | SYS-B22, B23, B24, B45; K-08 | Perilaku terdokumentasi dan konsisten: param tak dikenal diabaikan (atau 400) di semua endpoint, bukan berbeda-beda |
| 1.5 | Terapkan keputusan K-03: terima `GET /mqtt/configuration` dan `GET /mqtt/configuration/` (keduanya 200, model yang sama), atau tegaskan satu bentuk di dokumen dan samakan dengan panel. **(Diputuskan 18 Nov — delegasi: terima keduanya; cabang "tegaskan satu bentuk" gugur.)** | SYS-B38 (FAT-109); K-03 | Kedua bentuk URL mengembalikan 200 dengan model terstruktur yang sama |
| 1.6 | Terapkan keputusan K-04: satu tempat detail validasi 422 (`issues` sesuai envelope §2, atau `details`), dengan bentuk tiap item `{field, message}`. | SYS-B40 (FAT-111); K-04 | `POST /configurations` dengan kandidat invalid (mis. 0 listener) → 422 `CONFIG_VALIDATION_FAILED` dengan detail per-field yang tampil di UI |

**Catatan:** Fase 1 sebagian besar adalah pekerjaan dokumentasi + penyesuaian
kecil. Nilainya: setelah fase ini, setiap fase berikutnya punya kontrak yang
bisa diuji, bukan tebakan.

---

## 6. Fase 2 — MQTT Dynamic Security

**Tujuan:** bentuk dynsec punya satu sumber kebenaran, dan setiap operasi
dynsec dari panel berhasil di Real mode dengan nilai yang benar.

**Usaha:** M. **Dependensi:** Fase 0 (K-05, K-06, K-10, K-11); Fase 1.

| # | Item pekerjaan | Referensi | Kriteria selesai |
| --- | --- | --- | --- |
| 2.1 | Tetapkan satu bentuk body sub-operasi dynsec dan dokumentasikan (lihat K-05 — diputuskan 17 Nov 2026: (a) objek tunggal dokumen; panel sudah diubah — E15). | SYS-B31 (FAT-102), B32 (FAT-103), B36 (FAT-107), B37 (FAT-108); K-05 | `POST /clients/:name/roles {rolename:"edge_publisher", priority:1}` → 201 dan `GET /clients/:name` memuat peran tersebut; hal yang sama untuk ACL ke peran, klien ke grup, peran ke grup |
| 2.2 | Dokumentasikan bentuk ACL yang diterima secara eksplisit: apakah `allow` dan `priority` didukung; objek tunggal atau `{acls:[...]}`. | SYS-B32 (FAT-103) | `POST /roles/:name/acls` dengan bentuk yang didokumentasikan → 201; `GET /roles/:name` menampilkan ACL baru dengan `acltype/topic/allow/priority` yang sama seperti dikirim |
| 2.3 | Terima nilai `access` verbatim `publish` / `subscribe` / `readwrite` pada provisioning, dan bentuk peran `device-<username>` + grant `oee/device/<deviceId>/#`. Panel harus menghapus `accessMap` (`telemetry` / `telemetry+state`) dan mengirim `access` apa adanya. **(K-11 diputuskan 18 Nov — delegasi: (a) `POST /clients`; rute `/clients/provision` tidak ada; provisioning panel di-revert — P-A.)** | SYS-B30 (FAT-101) | `POST /clients {username, deviceId:"STM32-03", access:"readwrite"}` → 201 + password sekali tampil; peran `device-<username>` terbentuk dengan grant publish+subscribe di `oee/device/STM32-03/#`; ulangi untuk `publish` saja dan `subscribe` saja dan pastikan grant-nya berbeda |
| 2.4 | Aturan password pada `POST /clients` — DIPUTUSKAN 17 Nov 2026 (K-06): (ii) `password` wajib min 8 → panel sudah mewajibkan input (E15 P15.2). Sisa backend: nyatakan apakah `textname` / `textdescription` / `groups` / `clientid` diterima. | SYS-B33 (FAT-104) | `POST /clients` dengan `password:"pendek"` → 400 `VALIDATION_ERROR` / `WEAK_PASSWORD`; tanpa `password` → 400; dengan password ≥8 → 201 + password sekali tampil yang langsung bisa dipakai login MQTT |
| 2.5 | Tetapkan dan dokumentasikan bentuk respons `POST /clients` (password sekali tampil), mis. `201 {client: {...}, generatedPassword: "..."}` atau yang setara, dan pastikan nama field konsisten. | SYS-B34 (FAT-105); K-06 | Buat klien via `POST /clients` di Real mode → respons memuat password pada field yang didokumentasikan; panel menampilkannya di modal sekali tampil tepat satu kali; `GET /clients/:name` sesudahnya tidak lagi memuat password |
| 2.6 | Dokumentasikan bentuk objek klien (nama field status + bentuk `roles`/`groups`: string atau objek `{rolename/priority}` / `{groupname}`). Panel: mapper `enabled` sudah diperbaiki agar benar untuk kedua bentuk (E15 P15.3). | SYS-B35 (FAT-106); K-06 | Buat klien, nonaktifkan via `PATCH …/enable {enabled:false}`, lalu `GET /clients/:name` → panel menampilkan nonaktif; aktifkan kembali → tampil aktif |
| 2.7 | Terapkan keputusan K-10 untuk dynsec: rotasi password dan enable/disable memakai PATCH sesuai dokumen (`PATCH /clients/{name}/password`, `PATCH /clients/{name}/enable {enabled}`). Bila backend ternyata hanya menerima POST, dokumen yang harus dikoreksi. | SYS-B28 (FAT-99), B29 (FAT-100); K-10 | `PATCH …/password` dengan `{password: "baruP@ssw0rd!"}` → 200; `POST` ke path yang sama → 404/405; `PATCH …/enable {enabled:false}` → klien terputus/dinonaktifkan; `GET /clients/:name` sesudahnya menunjukkan nonaktif |

**Catatan:** 7 dari 23 operasi dynsec terdampak tema ini. K-05 diputuskan
17 Nov 2026: (a) objek tunggal dokumen — panel sudah diubah (E15); item
2.1/2.2 kini menjadi pekerjaan dokumentasi backend saja (tetapkan +
dokumentasikan satu bentuk).

---

## 7. Fase 3 — IAM, policy, ABAC & Auth

**Tujuan:** konsol IAM bekerja penuh di Real mode — policy bisa dibuat dan
diubah dengan bentuk yang benar, ABAC divalidasi dengan grammar dan whitelist
yang terdokumentasi, dan auth/session menegakkan aturan password serta status
akun.

**Usaha:** L (item terbesar di rencana ini). **Dependensi:** Fase 0 (K-01,
K-02, K-08, K-09, K-10, K-12); Fase 1 (skema respons IAM, item 1.1).

| # | Item pekerjaan | Referensi | Kriteria selesai |
| --- | --- | --- | --- |
| 3.1 | Tetapkan dan dokumentasikan secara eksplisit skema body `POST /policies` di API §3.4 (saat ini hanya disebut "subjectMatch dan abacCondition divalidasi" tanpa skema body; Lampiran K menyebut `roleId`+`permissionId` tanpa `subjectMatch`). Rekonsiliasi: apakah `subjectMatch` diturunkan dari `roleId`, atau wajib dikirim eksplisit? Bila wajib eksplisit, terima `subjectMatch` pada create. Putuskan juga apakah `permissionId` wajib. | SYS-B1 (FAT-72) | `POST /policies` dengan body persis seperti yang dikirim panel (setelah panel disesuaikan) → 201 dan policy tampil di `GET /policies` dengan `subjectMatch` yang benar; `POST /policies` dengan `subjectMatch: "operator:ADM-001"` + reserved permission berhasil; tanpa `subjectMatch` untuk reserved permission → 403 `RESERVED_PERMISSION` |
| 3.2 | Pastikan respons PUT `/policies/:id` mengembalikan policy utuh dengan field yang sama dengan `GET /policies`, dan dokumentasikan apakah `action` boleh diubah atau tidak. Terapkan keputusan K-10 (PUT, bukan PATCH). | SYS-B2 (FAT-73); K-10 | `PUT /policies/:id {effect, resourcePattern, abacCondition, enabled, reason}` → 200 + policy berubah; `PUT` dengan `effect: "DENY"` pada policy role ADMIN → ditolak (anti-lockout, API §3.4); toggle `enabled` lewat PUT tercermin di `GET /policies` |
| 3.3 | Dokumentasikan di API §3.4 contoh `abac_condition` yang valid secara lengkap (saat ini hanya whitelist-nya di Guide §4.6b). Pastikan pesan 400 `INVALID_POLICY` menyebut atribut/operator mana yang ditolak. Bila ada atribut tambahan yang memang didukung (mis. `department`), tambahkan ke whitelist terdokumentasi — jangan biarkan panel menebak. Whitelist yang berlaku hari ini (Guide §4.6b): `ingress_source, subject_active, subject.line_id, subject.operator_id, subject.roles, resource.state, resource.line_id, resource.machine_id, resource.device_id, resource.owner_id`; operator `all`/`any`/`not`, comparator `eq/neq/in/contains/prefix/suffix`, tepat satu per leaf. | SYS-B3 (FAT-74) | `POST /policies` dengan `abacCondition: {all:[{attr:"subject.line_id",eq:"LINE-01"}]}` → 201; dengan `{"line_id":"LINE-01"}` atau `{attr:"department",eq:"production"}` → 400 `INVALID_POLICY` dengan pesan yang menyebut atributnya |
| 3.4 | Pastikan `GET /auth/me` selalu mengembalikan `mustChangePassword`, `isActive`, `isProtected` (dan dokumentasikan maknanya + apa yang harus dilakukan klien bila `mustChangePassword=true` — blokir semua halaman sampai ganti password, atau hanya peringatan?). Dokumentasikan kode 401 `SUBJECT_INACTIVE` vs `AUTHZ_STALE` secara eksplisit (kapan masing-masing keluar; apakah `AUTHZ_STALE` berarti "refetch /auth/me" atau "login ulang" — Guide §4.6h bilang login ulang, API §L hanya menulis kodenya). | SYS-B4 (FAT-75) | Login sebagai operator dengan `mustChangePassword=true` → panel (setelah diperbaiki) menampilkan alur ganti password wajib sebelum masuk dashboard; `GET /auth/me` untuk operator nonaktif → 401 `SUBJECT_INACTIVE`; token lama setelah `authz_version` naik di mode enforce → 401 `AUTHZ_STALE` dan panel mengarahkan login ulang |
| 3.5 | Dokumentasikan dengan tegas apakah hanya PUT yang didukung untuk `/roles/:id` (atau terima juga PATCH); terima `reason` opsional bila dikirim. | SYS-B5 (FAT-76); K-10 | `PUT /roles/:id {description, reason}` → 200 dan deskripsi berubah di `GET /roles`; `PATCH` (bila tidak didukung) terdokumentasi sebagai tidak didukung |
| 3.6 | Dokumentasikan perilaku `DELETE /roles/:id` bila role masih punya assignment dan/atau policy: 409 dengan kode apa? atau cascade? Dokumentasikan perilaku `PUT /roles/:id` untuk preset non-ADMIN (boleh ubah deskripsi saja? nama?). Pastikan respons membedakan ADMIN (immutable) dari preset lain, mis. field `is_system` hanya `true` untuk ADMIN. Dokumen yang berlaku: hanya `ADMIN` yang immutable dan reserved untuk `ADM-001`; `SUPERVISOR`, `OPERATOR`, `MAINTENANCE` adalah preset opsional — dapat diubah atau dihapus bila tidak dipakai (FR-RL-002). | SYS-B7 (FAT-78) | `DELETE /roles/:id` untuk SUPERVISOR tak terpakai → 200 dan tidak muncul lagi setelah restart backend (seed tidak menghidupkan kembali); untuk role yang masih ter-assign → perilaku terdokumentasi (kode error yang konsisten); `DELETE` ADMIN → ditolak |
| 3.7 | Dokumentasikan daftar kanonis kunci capability yang dikembalikan `GET /auth/me` (nama persis per kunci, termasuk apakah ada `audit.system.read` atau hanya `access_control.read`). Pastikan `GET /auth/me` mengembalikan **kedua** kunci `access_control.read` dan `access_control.manage` secara terpisah. | SYS-B8 (FAT-79) | `GET /auth/me` untuk ADMIN memuat `access_control.read: allow` dan `access_control.manage: allow` sebagai kunci terpisah; 403 pada `GET /roles` tidak menurunkan `access_control.manage` di panel (setelah panel diperbaiki) |
| 3.8 | Konfirmasi nilai `mode` yang mungkin dikembalikan `GET /auth/me` dan `GET /access-control/info` (apakah ada `'partial'`? bila ya, dokumentasikan kapan; bila tidak, panel harus menghapusnya). Pastikan `enforcedDomains` dan `effectiveInMode` selalu ada di kedua endpoint saat mode per-domain aktif. Setiap capability `deny` menyertakan `reason`. | SYS-B9 (FAT-80) | `GET /auth/me` di mode per-domain enforce mengembalikan `mode` + `enforcedDomains` yang konsisten dengan `GET /access-control/info`; setiap capability `deny` menyertakan `reason` yang tampil di UI |
| 3.9 | Terapkan keputusan K-09: bila `POST /permissions` didukung, tetapkan skema body (casing field + `reason`?) dan contoh 201 vs 400 `INERT_PERMISSION` vs 409; bila tidak, hapus dari API §3.4/Guide §8 dan nyatakan katalog sebagai seed-only. **(Diputuskan 18 Nov — delegasi: (a) didukung + guard; cabang seed-only gugur.)** | SYS-B10 (FAT-81); K-09 | Keputusan tertulis di dokumen + (bila didukung) `POST /permissions {action, resourceType}` yang punya rute penjaga → 201 dan muncul di `GET /permissions`; yang tanpa rute penjaga → 400 `INERT_PERMISSION` |
| 3.10 | Verifikasi + contoh: pastikan kombinasi filter (`subject` + `from`/`to`, `decision=DENY`) pada `GET /access-control/audit` benar-benar bekerja dan `limit` sampai 1000 dihormati; dokumentasikan bentuk `meta`/cursor (bila ada). | SYS-B11 (FAT-82) | `GET /access-control/audit?subject=OP-115&decision=DENY&from=...&to=...&limit=1000` mengembalikan hanya baris yang cocok; UI panel (setelah diperbaiki) bisa menampilkan >100 baris lewat filter/pagination |
| 3.11 | Dokumentasikan skema respons `effective-permissions` (field `primaryRole`, `effectiveRoles[]`, `permissions[]` — nama field persis) + perilaku bila operator tanpa assignment + kode 404 untuk operator tak dikenal. | SYS-B12 (FAT-83) | `GET /subjects/OP-115/effective-permissions` mengembalikan bentuk yang sama dengan dokumen; operator tanpa assignment mengembalikan `effectiveRoles` sesuai dokumen (kosong atau fallback terdokumentasi) |
| 3.12 | Verifikasi bahwa backend menyimpan `reason` pada bind permission dan mengembalikannya di `GET /roles` / `GET /policies`. (Tidak ada perubahan backend bila sudah sesuai dokumen — verifikasi saja.) | SYS-B13 (FAT-84) | Bind dengan `reason` → 201, lalu `GET /policies` (atau `GET /roles`) menampilkan `reason` tersebut |
| 3.13 | Dokumentasikan apakah `DELETE /user-roles` menerima `id` sebagai alternatif identifikasi, dan apakah `reason` disimpan/dikembalikan; pastikan respons `{success, removed}` konsisten. | SYS-B14 (FAT-85) | Assign + revoke dengan `reason` → alasan tersimpan dan terlihat di audit; revoke assignment yang tidak ada → 404 (atau perilaku terdokumentasi lainnya), bukan sukses palsu |
| 3.14 | Pertimbangkan mengembalikan `authz_version` (atau `authzVersion`) pada `POST /auth/refresh` agar klien bisa membandingkan dengan versi yang dikenal tanpa satu round-trip `/auth/me` ekstra; dokumentasikan apakah 401 refresh memakai kode `AUTHZ_STALE` juga. Terapkan keputusan K-12 tentang kapan `authz_version` naik. | SYS-B15 (FAT-86); K-12 | `POST /auth/refresh` (bila diperkaya) mengembalikan `authzVersion` yang sama dengan `GET /access-control/info`; panel membedakan pesan `AUTHZ_STALE` vs `SUBJECT_INACTIVE` |
| 3.15 | Dokumentasikan apakah 429 login mengembalikan header `Retry-After` (bila ya, panel bisa memakai itu daripada cooldown env). Tidak ada perubahan perilaku: login PBKDF2, 401 generik tanpa user-enumeration, rate limit 5 percobaan per 60 detik per IP+station (API §L). | SYS-B16 (FAT-87) | 6 login gagal beruntun → 429 (dengan/tanpa `Retry-After` terdokumentasi); pesan 401 tidak membedakan user-ada vs user-tidak-ada |
| 3.16 | Tegaskan di API §3.4 bahwa `GET /user-roles` / `GET /policies` (dan `/roles`, `/permissions`) benar-benar tanpa paginasi/limit di semua ukuran data, atau bila ada batas, dokumentasikan `limit`/`cursor`-nya; pastikan query `operatorId` / `roleId` benar-benar memfilter. | SYS-B17 (FAT-88) | `GET /user-roles?operatorId=OP-115` hanya mengembalikan assignment OP-115; `GET /policies?roleId=<id>` hanya policy role tersebut |
| 3.17 | Dokumentasikan secara eksplisit apakah ada batasan pola resource untuk custom role (bila tidak ada, nyatakan "tidak ada"); bila ada (mis. wildcard dilarang), nyatakan kode errornya (apakah `PRIVILEGE_ESCALATION_DENIED`? — kode ini disebut di API §2 tabel 403 tapi tidak dipetakan ke kasus spesifik). | SYS-B18 (FAT-89) | Keputusan tertulis; bila wildcard diizinkan, bind `read:*` ke custom role → 201; bila dilarang, 403 dengan kode yang terdokumentasi |

**Catatan:** Item 3.1–3.3 adalah blok terbesar Fase 3 dan harus dikerjakan
berurutan (skema policy dulu, baru grammar ABAC, baru validasi). Item 3.12
dan 3.15 kemungkinan besar hanya verifikasi — bila backend sudah sesuai
dokumen, tidak ada kode yang ditulis.

---

## 8. Fase 4 — Audit, health & info

**Tujuan:** jejak audit bisa dibaca lengkap dan benar di Real mode, kesehatan
sistem menampilkan angka yang diukur (bukan disintesis), dan audit bisa
diekspor.

**Usaha:** M. **Dependensi:** Fase 0 (K-08, K-13, K-14); Fase 1 (item 1.2,
1.3).

| # | Item pekerjaan | Referensi | Kriteria selesai |
| --- | --- | --- | --- |
| 4.1 | Terapkan skema item audit dari Fase 1 (item 1.2) di implementasi `GET /system/audit` dan `GET /operational-events[/:deviceId]`. | SYS-B19 (FAT-90) | Lihat kriteria item 1.2 |
| 4.2 | Perluas `GET /health` dengan objek `backend{status,label,environment,latency_ms}`, `database{engine,latency_ms}`, `mqtt{status,connected_clients,dynamic_security}`, `websocket{status}` (nilai nyata, diukur server); ATAU dokumentasikan secara eksplisit bahwa field-field itu tidak tersedia dan panel harus menyembunyikan kartu tersebut di Real mode. Field yang didokumentasikan hari ini (API §A) hanya: `status`, `uptime`, `timestamp`, `ws_clients`, `db_connected`, `buffer_pending`, `buffer_dropped`, `metrics{totalReceived, validIngested, invalidDiscarded, lastIngestedAt}`. | SYS-B20 (FAT-91) | Di Real mode, matikan broker MQTT (atau simulasikan) → kartu broker menampilkan `DOWN` / jumlah klien nyata, bukan `UP`; latensi menampilkan angka ukur nyata (>0) atau kartu disembunyikan; tidak ada lagi nilai hardcode `'production'` / `'enabled'` / `0` di respons yang dirender |
| 4.3 | Terapkan keputusan K-14 (ack `operatorId`) dan selaraskan API §I dengan Guide §6.7 soal aturan body ack. | SYS-B21 (FAT-92); K-14 | Ack dari panel di Real mode mengembalikan `200 {id, acknowledgedAt, acknowledgedBy, ackNote}`; API §I dan Guide §6.7 menyatakan aturan body yang sama |
| 4.4 | Tambahkan query param `severity` dan `acknowledged` (atau `ack_status`) pada `GET /api/v1/operational-events[/:deviceId]`, dokumentasikan nilainya; ATAU nyatakan resmi tidak didukung — maka panel harus menghapus kedua filter dari UI Real mode (atau memfilter client-side dengan catatan paginasi menjadi tidak akurat). | SYS-B22 (FAT-93) | `GET /api/v1/operational-events/?severity=ALARM&acknowledged=false&limit=50` di Real mode hanya mengembalikan baris yang cocok; atau, bila diputuskan tidak didukung, UI tidak lagi menawarkan kedua filter tersebut |
| 4.5 | Selaraskan kedua dokumen dan implementasi: dukung `machine_id` pada list global + `machine_id` / `event_type` pada ekspor global (seperti Guide), atau hapus dari Guide dan panel. | SYS-B23 (FAT-94) | `GET /api/v1/operational-events/?machine_id=CNC-MILLING-01&envelope=true` dan ekspor global dengan `machine_id`+`event_type` di Real mode hanya mengembalikan baris yang cocok; API §I dan Guide §6.7/Lampiran A I mencantumkan parameter yang sama |
| 4.6 | Tambahkan `event_type` ke `GET /system/audit` secara terdokumentasi, ATAU nyatakan resmi bahwa parameter tak dikenal diabaikan (bukan 400). Selaraskan demo untuk memfilter `event_type` seperti halnya backend. | SYS-B24 (FAT-95); K-08, K-13 | `GET /api/v1/system/audit?event_type=MASTER_DATA_MUTATION&envelope=true` mengembalikan hanya baris yang cocok, atau dokumen menyatakan parameter diabaikan dan respons tetap 200; demo berperilaku sama |
| 4.7 | Tambahkan `GET /system/audit/export` (`from`, `to`, `event_type`, `format`, `limit` ≤100000, retensi + rate limit seperti export operational-events, ADMIN+LAN) ATAU dokumentasikan resmi bahwa `GET /operational-events/export` adalah jalur ekspor yang didukung untuk feed ini. | SYS-B26 (FAT-97) | Tombol ekspor di `/admin/system-audit` mengunduh file CSV/NDJSON/JSON berisi feed yang sama dengan yang tampil di tabel; 400 `RETENTION_EXCEEDED` di luar 90 hari dan 429 pada rate limit berperilaku sama dengan ekspor operational-events |
| 4.8 | (Opsional) Tambahkan `version` (dan bila perlu `build` / `name`) ke respons `GET /health`, atau sediakan `GET /api/v1/system/info`. | SYS-B27 (FAT-98) | SystemInfoPage menampilkan versi backend yang diambil dari server (bukan hardcode); sebelum endpoint ada, halaman tidak perlu diubah |

**Catatan:** Item 4.2 adalah satu-satunya item High di fase ini dan yang
paling berdampak pada kejujuran tampilan: hari ini kartu kesehatan bisa
menampilkan `UP` saat broker mati, karena transport panel mensintesis
nilai. Setelah fase ini, tidak ada lagi nilai kesehatan yang disintesis.

---

## 9. Fase 5 — Konfigurasi broker MQTT

**Tujuan:** konfigurasi broker punya kontrak terstruktur yang bisa dibaca,
di-stage, divalidasi, di-apply, dan di-rollback — tanpa field yang ditebak
dan tanpa operasi async yang dilaporkan selesai sebelum waktunya.

**Usaha:** M. **Dependensi:** Fase 0 (K-03, K-04, K-07); Fase 1 (item 1.5,
1.6).

| # | Item pekerjaan | Referensi | Kriteria selesai |
| --- | --- | --- | --- |
| 5.1 | Publikasikan skema JSON konfigurasi terstruktur (field, tipe, satuan, default, field yang diredaksi), enum `status` versi dan `type`/`status` operasi, dan contoh `GET /` + `GET /configurations/:versionId`. (Keputusan K-07 — diputuskan 17 Nov 2026: ikuti API doc; panel mempertahankan skema asumsinya sampai skema dipublikasikan. Panel: overview `configuration: null` sudah ditampilkan UNAVAILABLE — E15 P15.4.) | SYS-B43 (FAT-114); K-07 | `GET /api/v1/mqtt/configuration/` dan `GET /configurations` di Real mode mengembalikan field yang sama dengan skema yang didokumentasikan; edit `max_connections` di UI → stage → `GET /configurations/:versionId` menunjukkan nilai baru; tidak ada field yang hilang dalam round-trip |
| 5.2 | Dokumentasikan dan terima field yang panel kirim pada stage, atau nyatakan bahwa `summary` adalah alias `reason`/`comment` dan `baseVersionId` boleh kosong (default = versi aktif). | SYS-B39 (FAT-110) | `POST /configurations {config, summary:"…"}` → 201 dengan `version_id`, `parent_version_id` = versi aktif, dan `summary`/`reason` yang sama seperti dikirim, terlihat di `GET /configurations` |
| 5.3 | Terapkan keputusan K-04 untuk error 422 staging (lihat Fase 1, item 1.6). | SYS-B40 (FAT-111); K-04 | Lihat kriteria item 1.6 |
| 5.4 | Dokumentasikan kapan `acknowledgeUnvalidated` wajib, status apa saja yang mungkin (`PENDING`/`RUNNING`/`SUCCEEDED`/`FAILED`), dan apakah `GET /operations/:id` boleh di-poll berulang. | SYS-B41 (FAT-112) | Apply versi staged → 202 + `operation_id`; polling `GET /operations/:id` hingga terminal; UI menampilkan status terminal yang benar; apply versi unvalidated tanpa `acknowledgeUnvalidated` → error yang jelas, dengan `acknowledgeUnvalidated:true` → lanjut |
| 5.5 | Putuskan nasib `POST /backups`: (i) hapuskan/tidak usah mengimplementasikan (dan panel menghapus method-nya), ATAU (ii) bila diinginkan, daftarkan `POST /backups` (+ bila perlu `GET /backups/:id/download` dan restore) di dokumen; (iii) nyatakan apakah apply otomatis membuat backup. Hari ini dokumen hanya mengenal `GET /backups` (inventaris metadata saja). | SYS-B42 (FAT-113) | `GET /backups` → inventaris metadata; `POST /backups` → 404 yang terdokumentasi (bila tidak diimplementasikan) atau 201 (bila diimplementasikan); tidak ada aksi UI yang memanggil endpoint yang tidak ada |
| 5.6 | Dokumentasikan field dalam kedua objek overview (`dynamicSecurity` dan `configuration`) + perilaku saat plugin nonaktif. | SYS-B44 (FAT-115) | `GET /mqtt/overview` dengan plugin nonaktif → panel menampilkan "tidak tersedia" (bukan `IN_SYNC` + 0); dengan plugin aktif → angka clients/roles/groups sama dengan `GET /dynamic-security/clients|roles|groups` |

**Catatan:** Item 5.4 menyangkut perilaku async yang hari ini ditutupi demo
(apply/rollback demo sinkron dan langsung `SUCCEEDED`). Pengujian item ini
wajib memakai operasi yang benar-benar berjalan lama, bukan operasi instan.

---

## 10. Fase 6 — Master data & operator

**Tujuan:** filter, guard hapus, dan status operator berperilaku sama di
Real mode seperti yang dijanjikan dokumen — tanpa potongan data diam-diam
dan tanpa kode error yang berbeda antara demo dan dokumen.

**Usaha:** S. **Dependensi:** Fase 0 (K-08); Fase 1.

| # | Item pekerjaan | Referensi | Kriteria selesai |
| --- | --- | --- | --- |
| 6.1 | Terapkan keputusan K-08 untuk filter Shift Schedules: terima kedua bentuk (`line_id`, `day_of_week`, `shift_id`, `is_active` — API §P.1 — dan `lineId`, `dayOfWeek`, `shiftId`, `isActive` — Guide Lampiran N), atau tetapkan satu dan perbaiki dokumen yang salah. | SYS-B45 (FAT-116); K-08 | `GET /shift-schedules?line_id=LINE-01&day_of_week=1` dan bentuk camelCase yang setara mengembalikan himpunan yang sama (atau salah satunya terdokumentasi sebagai satu-satunya yang benar dan panel disesuaikan) |
| 6.2 | Sertakan `startTime` dan `endTime` (dari shift yang dirujuk) pada list dan detail schedule, atau dokumentasikan bahwa panel harus join dengan `GET /shifts`. | SYS-B46 (FAT-117) | `GET /shift-schedules?line_id=LINE-01` → tiap item memuat `shiftName, shiftCode, startTime, endTime` yang konsisten dengan `GET /shifts/:shiftId` |
| 6.3 | Nyatakan apakah `isActive` diterima di `POST /operators`; pastikan penonaktifan `ADM-001` → 400 `PROTECTED_ACCOUNT`, hapus `ADM-001` → 403 `PROTECTED_ACCOUNT` (sesuai Guide §7.3). | SYS-B47 (FAT-118) | `POST /operators` tanpa `isActive` → 201 `isActive:true`; `PATCH /operators/ADM-001/status {isActive:false}` → 400 `PROTECTED_ACCOUNT`; `DELETE /operators/ADM-001` → 403 `PROTECTED_ACCOUNT` |
| 6.4 | Dokumentasikan apakah list dynsec (`clients`/`roles`/`groups`) dan `GET /operators` selalu lengkap (array polos) atau memakai cursor pagination + `limit` maksimum; bila berpaginasi, panel harus mengikuti `nextCursor`. | SYS-B48 (FAT-119) | Buat >100 klien dynsec (atau >50 operator) → panel menampilkan semuanya atau memaginasi dengan benar, bukan terpotong diam-diam |
| 6.5 | Tetapkan apakah `operators.line_id` ikut menjadi guard `PRODUCTION_LINE_IN_USE`; bila ya, dokumentasikan; bila tidak, nyatakan apa yang terjadi pada operator saat line-nya dihapus (mis. `SET NULL` / tetap menunjuk ID yang hilang — dokumen tidak menyebut). Guard yang sudah didokumentasikan: masih dirujuk `machines` atau snapshot `work_order` → 409 `PRODUCTION_LINE_IN_USE` (API §N.5, Guide Lampiran L). | SYS-B49 (FAT-120) | Line yang hanya dipakai operator → hapus menghasilkan 409 (bila guard diberlakukan) atau 200 + operator tertangani sesuai kontrak (bila tidak); line yang dipakai WO snapshot → 409 `PRODUCTION_LINE_IN_USE` dengan pesan yang menyebut pemakai |
| 6.6 | Tegakkan guard WO snapshot pada hapus shift; dokumentasikan efek `PATCH /shifts` terhadap `shift_schedules` yang ada (ikut berubah / tetap / ditolak bila menimbulkan overlap). Dokumen yang berlaku: hapus ditolak bila masih dirujuk `shift_schedules` ATAU snapshot `work_order` → 409 `SHIFT_IN_USE` (API §O.4–5). | SYS-B50 (FAT-121) | Hapus shift yang dipakai WO snapshot → 409 `SHIFT_IN_USE`; ubah `startTime`/`endTime` shift → `GET /shift-schedules` menunjukkan jam yang konsisten dengan kontrak yang ditetapkan |

**Catatan:** Fase ini kecil, tetapi item 6.4 adalah jebakan klasik: list
yang terpotong diam-diam pada instalasi besar. Pengujian item 6.4 wajib
memakai data di atas ambang batas default (100 klien / 50 operator).

---

## 11. Fase 7 — Mode akses Private/Public

**Tujuan:** switch mode akses di panel berhenti menjadi kosmetik — server
menegakkan mode, mengklasifikasikan kanal tanpa bisa dipalsukan, dan
mempublikasikan mode + kanal ke panel.

**Usaha:** M. **Dependensi:** Fase 0; Fase 3 (auth/capability). **Epic
Linear:** E10 — A10.2 (FAT-40, Todo, Blocked sampai backend ada). Dokumen
sumber lengkap: `docs/BACKEND_REQUIREMENTS_ACCESS_MODE.md`.

**Prinsip (dari dokumen sumber):** server adalah otoritas final (Guide
§4.5/§4.6g — server 403 adalah keputusan final; panel hanya
memproyeksikannya). Gating di panel hanya UX/pertahanan lapis pertama.

### 11.1 Konfigurasi mode akses di sisi server (B1–B3)

| # | Item pekerjaan | Kriteria selesai |
| --- | --- | --- |
| 7.1 | Sediakan variabel konfigurasi `ACCESS_MODE` (`private` \| `public`), **default `private`**, diubah lewat konfigurasi deployment (env/secret manager), BUKAN hardcoded. Perubahan mode harus tercatat (lihat 11.4). | B1 |
| 7.2 | Satu sumber kebenaran di server — mode berlaku untuk SEMUA vhost/port; jangan ada dua flag berbeda untuk port 80 vs 8080. | B2 |
| 7.3 | Bila konfigurasi hilang/rusak, server jatuh ke `private` (fail-closed), bukan `public`. | B3; V11: mode tidak dikonfigurasi (env hilang) → server jalan sebagai `private` |

### 11.2 Deteksi kanal LAN vs tunnel yang dapat dipercaya (B4–B6)

| # | Item pekerjaan | Kriteria selesai |
| --- | --- | --- |
| 7.4 | Server menentukan `channel: lan \| tunnel` dari **jalur ingress yang nyata**: vhost/port listener yang menerima koneksi, atau header tepercaya dari reverse proxy/tunnel yang dikontrol server (`X-Forwarded-For` / `X-Access-Channel` HANYA bila proxy-nya milik server — header dari client langsung TIDAK BOLEH dipercaya). | B4 |
| 7.5 | Kanal tidak bisa dipalsukan client: tidak ada query param, body, atau header bebas yang bisa mengubah klasifikasi kanal. Request yang datang lewat tunnel tetap `tunnel` sekalipun membawa header `X-Access-Channel: lan`. | B5; V7: header palsu dari tunnel + `POST` → tetap 403 |
| 7.6 | Dual-vhost dipertahankan (Guide D1): port 80 (LAN, akses penuh) dan port 8080 (tunnel) tetap terpisah. Di mode `private`, port 8080 melayani baca saja; di mode `public`, keduanya melayani penuh. | B6 |

### 11.3 Penegakan server-side — otoritatif (B7–B12)

| # | Item pekerjaan | Kriteria selesai |
| --- | --- | --- |
| 7.7 | Tolak mutasi dari tunnel saat mode `private`: semua operasi tulis — `POST`/`PUT`/`PATCH`/`DELETE` pada 132 operasi admin (termasuk `POST /auth/password/change`, ack operational event, classify downtime, trigger reconciliation, semua mutasi IAM & MQTT) — WAJIB mengembalikan **403** bila `channel=tunnel` dan `mode=private`. Tanpa pengecualian. | B7; V1: `POST /api/v1/products` via tunnel, mode `private` → 403 `FORBIDDEN`, tidak ada data berubah |
| 7.8 | Baca tetap diizinkan dari tunnel: `GET` (termasuk ekspor & history) tetap boleh dari tunnel di kedua mode — tunnel memang dibuat untuk observasi jarak jauh. | B8; V4: `GET /api/v1/devices` via tunnel, mode `private` → 200 |
| 7.9 | Login dari tunnel mengikuti mode: `POST /auth/login` dari tunnel diizinkan di mode `public`; di mode `private` **ditolak 403** (konsisten dengan panel — login demo pun dijaga). Alasan: sesi yang lahir dari tunnel di mode private tidak boleh ada. | B9; V5/V6 |
| 7.10 | WebSocket telemetri read-only: `GET /ws/telemetry` boleh dari kedua kanal di kedua mode, tetapi **hanya stream baca**. Tidak ada pesan tulis/aktuasi lewat WS (ADR-003). | B10; V12 |
| 7.11 | Penegakan di middleware, bukan per-handler: satu middleware otorisasi kanal yang dieksekusi SEBELUM handler bisnis, supaya endpoint baru otomatis terlindungi dan tidak ada yang lupa menambahkan guard. | B11 |
| 7.12 | Penolakan memakai envelope standar (Guide §4.3) `{error, message}` dengan `error: 'FORBIDDEN'` (atau kode khusus `FORBIDDEN_CHANNEL` bila backend membedakan), `message` berbahasa Indonesia yang sama dengan panel: `"Mode observasi — perubahan dinonaktifkan. Akses penuh tersedia dari LAN pabrik."`, `httpStatus: 403`. | B12 |

### 11.4 Publikasi mode + kanal ke panel (B13–B16)

| # | Item pekerjaan | Kriteria selesai |
| --- | --- | --- |
| 7.13 | Endpoint status akses: `GET /api/v1/system/access-mode` (atau perluasan `GET /health`) mengembalikan minimal `{ "mode": "private" \| "public", "channel": "lan" \| "tunnel", "mutations_allowed": true \| false }`. Endpoint ini **tidak butuh auth** (atau butuh auth minimal) supaya banner panel bisa tampil benar sebelum login. | B13; V8 |
| 7.14 | Sertakan di `GET /auth/me`: respons menyertakan `access_mode` + `mutations_allowed` untuk sesi berjalan, supaya panel tidak perlu menebak dari port. | B14 |
| 7.15 | (Opsional, pelengkap) Setiap respons membawa header `X-Access-Channel: lan | tunnel` dan `X-Access-Mode: private | public` untuk debugging/observabilitas. | B15 |
| 7.16 | Panel memakai data server bila tersedia (tugas frontend, sudah disiapkan: `resolveEffectiveAccess` — bila B13/B14 tersedia, panel memakai nilai server dan hanya memakai env sebagai fallback). | B16 |

### 11.5 Perubahan mode oleh admin (B17–B20)

| # | Item pekerjaan | Kriteria selesai |
| --- | --- | --- |
| 7.17 | Endpoint ubah mode (ADMIN-only): `PUT /api/v1/admin/access-mode` dengan body `{ "mode": "private" \| "public", "reason": "..." }`. Hanya peran ADMIN (capability `access_control.manage`). | B17; V9: ubah mode sebagai OPERATOR → 403 |
| 7.18 | Audit trail: setiap perubahan mode menulis audit log — siapa, kapan, mode lama → baru, alasan (`reason` wajib). Perubahan mode muncul di System Audit Trail panel. | B18; V10 |
| 7.19 | Perubahan berlaku segera: tanpa restart backend bila memungkinkan (config reload); bila butuh restart, dokumentasikan. | B19 |
| 7.20 | Perubahan mode TIDAK membunuh sesi yang sudah berjalan: sesi dari tunnel yang lahir saat mode `public` tetap valid sampai TTL-nya habis sekalipun mode diubah ke `private` — TETAPI mutasi berikutnya tetap ditolak 403 (penegakan per-request). | B20 |

### 11.6 Keamanan kanal publik — wajib bila mode `public` dipakai (B21–B25)

| # | Item pekerjaan | Kriteria selesai |
| --- | --- | --- |
| 7.21 | TLS wajib di kanal publik: tunnel/internet WAJIB HTTPS/WSS dengan sertifikat valid. Tanpa TLS, mode `public` tidak boleh diaktifkan (deployment menolak start atau memaksa `private`). | B21 |
| 7.22 | Auth tetap berlaku penuh: mode `public` TIDAK PERNAH berarti tanpa login. JWT tetap wajib (D5: token hanya di memori, TTL 900 dtk, refresh sliding 80%). | B22 |
| 7.23 | Rate limiting lebih ketat di tunnel: batas request/menit dari kanal tunnel lebih rendah dari LAN; login gagal beruntun dari tunnel memicu lockout lebih cepat. | B23 |
| 7.24 | Header keamanan (Guide §13): `Content-Security-Policy`, `Strict-Transport-Security`, `X-Content-Type-Options: nosniff`, dan `Cache-Control: no-store` pada kedua vhost. | B24 |
| 7.25 | Log akses kanal: setiap request mencatat kanal (`lan`/`tunnel`) di access log, supaya insiden bisa ditelusuri per kanal. | B25 |

**Ringkasan fase ini dalam satu paragraf:** backend harus punya **satu flag
`ACCESS_MODE` (default `private`, fail-closed)**, **klasifikasi kanal yang
tidak bisa dipalsukan client**, **middleware yang menolak semua mutasi dari
tunnel saat `private` (403, envelope standar)**, **endpoint yang
mempublikasikan mode + kanal ke panel**, dan **(bila mode `public` dipakai)
TLS + auth penuh + rate limit lebih ketat di kanal publik**. Panel sudah
siap di sisi frontend; tanpa B7 + B11, switch di panel hanyalah kosmetik.

---

## 12. Fase 8 — Telemetry & OEE sisi server

**Tujuan:** server menghormati parameter yang sudah didokumentasikan,
mengirim field yang dibutuhkan kartu ringkasan, dan mendefinisikan perilaku
yang hari ini hanya diputuskan di sisi panel/demo.

**Usaha:** M. **Dependensi:** Fase 0 (K-15); Fase 1. Dokumen sumber:
`docs/TELEMETRY_AUDIT.md` (audit 2026-11-16, 25 gap G1–G25; 19 usulan
sudah dikerjakan di sisi panel pada E11/E12 — AUDIT.md §14–§15).

**Konteks:** E11/E12 menyelesaikan semua yang bisa diselesaikan dari sisi
panel. Yang tersisa untuk backend adalah item di bawah ini. Perhitungan
OEE tidak dilakukan di klien (Build Guide §14.3) — semua angka A/P/Q/OEE
diterima apa adanya dari server — jadi kebenaran angka-angka itu adalah
tanggung jawab server.

| # | Item pekerjaan | Referensi | Kriteria selesai |
| --- | --- | --- | --- |
| 8.1 | Hormati parameter `from`/`to` (dan `date`/`shift`) pada `GET /api/v1/oee/shift-summary` (§Q.1) dan `GET /api/v1/oee/shift-timeline` (§Q.3). Panel sudah mengirimnya sejak E11 (T11.2/F-2) — **efektivitas di Real mode belum terverifikasi** karena belum ada backend. | F-2, G1; AUDIT.md §14 (T11.2) | Mengganti periode me-refetch summary + timeline dengan data periode yang diminta (bukan data default yang sama); ringkasan + timeline + tabel jam membicarakan satu periode yang sama |
| 8.2 | Hormati `from`/`to` pada `GET /api/v1/telemetry/:device_id/hourly` (§K.2) dan `GET /api/v1/telemetry/:device_id/aggregate` (§K.4), dengan default 72 bucket terakhir. Panel sudah mengirimnya sejak E11 (T11.1/F-1). | F-1, G3; AUDIT.md §14 (T11.1) | Filter tanggal mengubah data yang dikembalikan (bukan data default yang sama); rentang yang tidak berisi data mengembalikan `[]` |
| 8.3 | Kirim `time_sec.planned` pada shift summary (§Q.1), dan `planned_production_time_min` dari field-nya sendiri (bukan dari `operatingSec`). Panel sudah membaca `time_sec.planned` bila ada (T12.4/F-7, sisi panel saja). | F-7, G7; AUDIT.md §15 (T12.4) | Mode Real menampilkan `planned_downtime_min` yang benar (bukan hardcode `0`); break/istirahat terlihat di kartu ringkasan |
| 8.4 | Terapkan keputusan K-15: definisi availability untuk jam yang sepenuhnya planned downtime (G8). | G8; K-15 | Jam yang sepenuhnya planned downtime ditandai sebagai planned (bukan availability 0% / OEE 0%) sesuai keputusan yang ditetapkan |
| 8.5 | Tambah state FSM `SETUP` / `IDLE` ke enum kanonis (hari ini hanya 6: `UNCONFIGURED, READY, RUNNING, PLANNED_DOWNTIME, UNPLANNED_DOWNTIME, BATCH_FINISHED`). Mengubah ini butuh backend (skema MQTT, CAgg, seluruh pembaca state). Tanpa SETUP, waktu setup tercampur ke READY atau UNPLANNED_DOWNTIME dan analisis loss (Six Big Loss, program SMED) menjadi kabur. | G25 | Timeline dan hourly memakai enum yang diperluas; segmen setup tampil sebagai state sendiri, bukan READY/UNPLANNED |
| 8.6 | Terapkan default server yang didokumentasikan: limit hourly 72, limit rollup 500 (fallback transport), bucket aggregate 5m, bucket timeline 5m, groupBy rollup `day`, timeout ekspor 120.000 ms. Panel sudah menyamakan default-nya (T12.18/U-4) — **perilaku default di sisi server belum terverifikasi**. Satu deviasi dipertahankan di panel: ukuran paginasi UI rollup tetap 50 (konstanta bersama halaman lain). | G15; AUDIT.md §15 (T12.18) | Server mengembalikan 72 bucket hourly dan 500 baris rollup bila pemanggil tidak mengirim `limit`; bucket default sesuai dokumen |
| 8.7 | Pastikan rollup (`GET /api/v1/telemetry/rollup`, §K.3c, CAgg `oee_daily_summary`) dan aggregate (§K.4, `time_bucket` server) memakai definisi server yang konsisten: `*Pct` = rasio dari total SUM (bukan AVG), `good = max(0, output − reject)`, performance = kapasitas berbobot waktu (`target_per_hour × operating_sec / 3600`), kapasitas 0/unknown → `null`. Rollup bukan SUM hourly di klien — dua respons server independen. | G2, G4, G6; AUDIT.md §13–§15 | Σ hourly, summary, dan rollup untuk satu shift yang sama bisa direkonsiliasi (selisih parts 334 vs 350 sudah diselesaikan di sisi panel via Opsi A, T12.6a — server harus konsisten dengan basis yang sama) |
| 8.8 | Ekspor (raw/hourly/rollup) menghormati `from`/`to` untuk isi data, bukan hanya kolomnya. Panel sudah menyamakan kolom ekspor dengan layar (T12.7/F-8) — isi ekspor demo hourly masih mengabaikan `from`/`to`. | G5, G22; AUDIT.md §15 (T12.7) | Ekspor pada rentang tertentu hanya berisi baris dalam rentang itu; kolom ekspor bisa dipetakan 1:1 ke layar |
| 8.9 | Dokumentasikan rumus A/P/Q eksplisit (pembilang/penyebut) dan perilaku bucketing server (penyejajaran kalender vs sliding, pemotongan segmen lintas bucket, pengisian bucket kosong — "state terakhir / `UNCONFIGURED`"). Hari ini rumus eksplisit tidak tertulis di kedua dokumen — hanya pct = rasio SUM, `good = max(0, output − reject)`, dan kapasitas performance. | TELEMETRY_AUDIT.md (d); AUDIT.md §13 | Rumus dan aturan bucketing tertulis di dokumen API; perilaku server bisa diverifikasi terhadap dokumen tanpa menebak |
| 8.10 | Kirim flag `provisional` secara konsisten: hourly, rollup, aggregate, dan segmen timeline (hari ini segmen timeline tidak punya field-nya; contoh respons §Q.3 juga tidak memuatnya). CAgg refresh 5 menit, end_offset 1 menit. | G12 | Data yang belum final ditandai di semua tampilan; tidak ada lagi keputusan dari data yang masih akan berubah tanpa peringatan |
| 8.11 | Satuan field berdasarkan nama field: `cycle_time_ms` dalam milidetik, `*_sec` dalam detik — jangan mengandalkan urutan fallback klien. | G20 | Nilai cycle time di layar Raw benar berapa pun field yang dikirim server |
| 8.12 | Zona waktu tunggal `Asia/Jakarta` untuk kunci hari/bulan dan semua label waktu; segmen timeline memakai ISO 8601 (`start`/`end`) dengan `window.tz`. | G11 | Batas hari/shift tidak bergeser menurut zona waktu mesin yang membuka panel; timeline bisa dibaca tanpa tooltip |

**Yang tetap di luar scope fase ini:** tidak ada perubahan arsitektur backend
yang diusulkan — semua item di atas memakai endpoint yang sudah
didefinisikan di API doc; yang dibutuhkan dari backend hanyalah menghormati
parameter yang sudah didokumentasikan dan mengirim field yang sudah
didefinisikan.

---

## 13. Fase 9 — Verifikasi & go-live

**Tujuan:** membuktikan mode Real bekerja end-to-end, lalu menutup pekerjaan
dengan Definition of Done yang bisa diperiksa.

**Usaha:** M (pengujian) + L (bila ditemukan ketidaksesuaian yang memaksa
kembali ke fase sebelumnya). **Dependensi:** semua fase 1–8.

### 13.1 Verifikasi Real end-to-end — V8.2 (FAT-28, Todo)

- Jalankan seluruh matriks uji di bawah ini melawan backend staging di mode
  Real (bukan Demo).
- Verifikasi khusus: F-2 (summary + timeline menghormati `from`/`to`),
  default server 72/500, dan semua acceptance criteria Fase 1–8.
- Visual check di browser sungguhan tetap menjadi tugas Fathur
  (V8.1, FAT-31) setelah backend tersedia — bukan bagian fase ini.

### 13.2 Uji integrasi LAN per modul — V8.3 (FAT-30, Todo, Blocked sampai backend ada)

- Satu alur E2E per modul (Guide §12): IAM, MQTT DynSec, MQTT Config,
  Audit/Health, Master Data, Operators, Telemetry/OEE.
- Setiap alur diuji dari LAN (port 80) dan dari tunnel (port 8080) — di
  mode `private` maupun `public` (lihat checklist V1–V12 di Lampiran B).

### 13.3 Deployment — V8.4 (FAT-29, Todo)

**Item ini adalah infra, bukan backend aplikasi.** Dicatat di sini supaya
tidak hilang, tetapi dikerjakan terpisah dan **butuh target server**:

- Deployment Nginx §13 (Vite statis, port 80/8080, CSP, no-store).
- Tidak ada konfigurasi nginx/docker di repo panel hari ini.

### 13.4 Definition of Done — V8.5 (FAT-27, Todo)

Checklist DoD §15 (Guide) diterapkan per modul; lihat Lampiran C untuk
checklist verifikasi akhir.

### 13.5 Matriks uji per fase

| Fase | Uji utama | Lingkungan |
| --- | --- | --- |
| Fase 1 | Contoh respons di dokumen cocok field-per-field dengan respons live; envelope + cursor bekerja di >1 halaman | Staging Real |
| Fase 2 | 23 operasi dynsec end-to-end (buat klien → peran → ACL → grup → rotasi → disable → hapus); password sekali tampil hanya muncul sekali | Staging Real + broker Mosquitto dynsec |
| Fase 3 | Buat/ubah/hapus policy + role + assignment; ABAC valid/invalid; `mustChangePassword`; login 429; refresh `AUTHZ_STALE` vs `SUBJECT_INACTIVE` | Staging Real |
| Fase 4 | Matikan broker → kartu health `DOWN`; audit lengkap tanpa default mapper; ekspor audit; ack | Staging Real (broker bisa dimatikan) |
| Fase 5 | Stage → validasi 422 → apply async (polling sampai terminal) → rollback; backup | Staging Real + broker Mosquitto |
| Fase 6 | Filter snake_case + camelCase; guard hapus line/shift (termasuk WO snapshot); list >100 klien / >50 operator | Staging Real |
| Fase 7 | Checklist V1–V12 (Lampiran B) | Staging Real, LAN + tunnel, mode private + public |
| Fase 8 | Rekonsiliasi Σ hourly vs summary vs rollup satu shift; `from`/`to` mengubah data; jam planned penuh; enum FSM | Staging Real |

### 13.6 Kriteria selesai keseluruhan

1. Semua acceptance criteria Fase 1–8 lolos melawan backend sungguhan di
   mode Real (bukan Demo).
2. Checklist V1–V12 (mode akses) lolos penuh.
3. Tidak ada lagi nilai yang disintesis di respons backend (health, latensi,
   jumlah klien, status broker).
4. Dokumen API dan Guide sudah dikoreksi di setiap titik yang diputuskan di
   Fase 0 (tidak ada lagi dua versi yang bertentangan).
5. Status Linear diperbarui: E13 child ditutup per item yang terverifikasi,
   A10.2 (FAT-40) ditutup setelah V1–V12 lolos, V8.2/V8.3/V8.5 ditutup
   setelah fase ini.
6. Decision log (Lampiran C) lengkap dan ditandatangani (siapa memutuskan,
   kapan, berdasarkan apa).

### 13.7 Rencana rollback

- **Perubahan kontrak yang merusak** (nama field, bentuk body, enum):
  kembalikan ke kontrak sebelumnya dan catat di decision log; panel yang
  sudah disesuaikan ikut dikembalikan dalam pekerjaan panel terpisah.
- **Perubahan mode akses:** ubah `ACCESS_MODE` kembali ke `private` via
  `PUT /admin/access-mode` (atau konfigurasi deployment); perubahan tercatat
  di audit log. Sesi yang sudah berjalan tetap valid sampai TTL-nya habis,
  tetapi mutasi berikutnya ditolak 403 (penegakan per-request).
- **Apply config broker yang gagal:** rollback versi (`POST
  /configurations/:versionId/rollback`) — operasi async, polling sampai
  terminal (lihat Fase 5, item 5.4).
- **Umum:** setiap fase yang gagal verifikasi dikembalikan ke fase
  sebelumnya (bukan dilanjutkan dengan asumsi); tidak ada "selesai dengan
  catatan" tanpa catatan itu ditulis di decision log.

---

## Lampiran A — Indeks gap SYS-B1–SYS-B50

Sumber: `docs/BACKEND_GAPS_SYSTEM_ADMIN.md` (detail lengkap tiap gap) dan
`docs/LINEAR.md` §1.3/§8 (pemetaan kunci → nomor Linear). Semua 50 issue
berstatus Todo di bawah Epic E13 (FAT-71). Judul di bawah ini dipersingkat;
judul lengkap ada di dokumen gap dan di Linear.

| ID | Judul singkat | Severity | Fase | Linear |
| --- | --- | --- | --- | --- |
| SYS-B1 | Body `POST /policies` tidak cocok; `subjectMatch` tak bisa diisi | High | Fase 3 | FAT-72 |
| SYS-B2 | `PUT /policies/:id`: PATCH vs PUT, nama field salah | High | Fase 3 | FAT-73 |
| SYS-B3 | ABAC: grammar/atribut ≠ backend; placeholder panel justru invalid | High | Fase 3 | FAT-74 |
| SYS-B4 | `GET /auth/me`: `mustChangePassword` / `isActive` / `isProtected` dibuang | High | Fase 3 | FAT-75 |
| SYS-B5 | `PUT /roles/:id`: panel mengirim PATCH | Medium | Fase 3 | FAT-76 |
| SYS-B6 | Skema respons IAM tidak dispesifikasi; panel menebak + default diam-diam | Medium | Fase 1 | FAT-77 |
| SYS-B7 | Role preset dikunci semua; hapus role ber-pemakaian tak didokumentasikan | Medium | Fase 3 | FAT-78 |
| SYS-B8 | Capability `access_control.read` tak ada; kunci belum tentu sama dengan katalog | Medium | Fase 3 | FAT-79 |
| SYS-B9 | Proyeksi capability `/auth/me` membuang `domain`/`surface`/`mode`/`reason`; mode `partial` tak jelas | Medium | Fase 3 | FAT-80 |
| SYS-B10 | `POST /permissions`: tanpa UI; demo blokir kode karangan; casing body belum pasti | Medium | Fase 3 | FAT-81 |
| SYS-B11 | `GET /access-control/audit` tanpa filter server-side; limit hardcode 100 | Medium | Fase 3 | FAT-82 |
| SYS-B12 | Inspector `effective-permissions`: skema tak terdokumentasi; default hardcode `SUP-042` | Low | Fase 3 | FAT-83 |
| SYS-B13 | Bind permission: `reason` dibuang di Real mode | Low | Fase 3 | FAT-84 |
| SYS-B14 | Assignment: `reason` tak dikirim; revoke composite key tanpa `id` | Low | Fase 3 | FAT-85 |
| SYS-B15 | Refresh: `authz_version` karangan; 401 `AUTHZ_STALE`/`SUBJECT_INACTIVE` generik | Low | Fase 3 | FAT-86 |
| SYS-B16 | Login: lockout 5/30 dtk vs rate limit server 5/60 dtk; `Retry-After` belum ada | Low | Fase 3 | FAT-87 |
| SYS-B17 | `GET /user-roles` & `/policies`: filter `operatorId`/`roleId` tak dikirim | Low | Fase 3 | FAT-88 |
| SYS-B18 | Aturan anti-eskalasi/wildcard karangan panel/demo, lebih ketat dari dokumen | Low | Fase 3 | FAT-89 |
| SYS-B19 | Skema `OperationalEventItem` tak didefinisikan di dokumen mana pun | High | Fase 1 | FAT-90 |
| SYS-B20 | `GET /health` tak sediakan field SystemHealthPage; transport sintesis data palsu | High | Fase 4 | FAT-91 |
| SYS-B21 | Ack: `operatorId` tak dikirim; dokumen bertentangan soal wajib/tidak | Medium | Fase 4 | FAT-92 |
| SYS-B22 | Filter `severity`/`acknowledged` dibuang transport HTTP | Medium | Fase 4 | FAT-93 |
| SYS-B23 | `machine_id` list/ekspor global: Guide bilang didukung, API tidak mencantumkan | Medium | Fase 4 | FAT-94 |
| SYS-B24 | `event_type` di `GET /system/audit` tak ada di dokumen | Medium | Fase 4 | FAT-95 |
| SYS-B25 | Envelope `meta` list tak didefinisikan; cursor/total bisa gagal diam-diam | Low | Fase 1 | FAT-96 |
| SYS-B26 | System audit tak bisa diekspor (tak ada endpoint + tombol) | Low | Fase 4 | FAT-97 |
| SYS-B27 | Tak ada endpoint info/versi backend; SystemInfoPage murni statis | Low | Fase 4 | FAT-98 |
| SYS-B28 | Rotasi password MQTT: HTTP POST vs dokumen PATCH | High | Fase 2 | FAT-99 |
| SYS-B29 | Enable/disable klien: POST + `{disabled}` vs PATCH + `{enabled}` | High | Fase 2 | FAT-100 |
| SYS-B30 | Provisioning: `access` diubah jadi `telemetry` / `telemetry+state` | High | Fase 2 | FAT-101 |
| SYS-B31 | Tambah peran ke klien: `{roles:[...]}` vs `{rolename, priority?}` | High | Fase 2 | FAT-102 |
| SYS-B32 | Tambah ACL ke peran: `{acls:[acl]}` vs objek tunggal `{acltype, topic, ...}` | High | Fase 2 | FAT-103 |
| SYS-B33 | Buat klien: password kosong dikirim `""`; auto-generate tak dijamin dokumen | High | Fase 2 | FAT-104 |
| SYS-B34 | Respons `POST /clients` (password sekali tampil) tak dinamai di dokumen | Medium | Fase 2 | FAT-105 |
| SYS-B35 | Mapper `enabled` bisa terbalik bila backend kirim `enabled:false` | Medium | Fase 2 | FAT-106 |
| SYS-B36 | Tambah klien ke grup: `{clients:[...]}` vs `{username, priority?}` | Medium | Fase 2 | FAT-107 |
| SYS-B37 | Tambah peran ke grup: `{roles:[...]}` vs `{rolename, priority?}` | Medium | Fase 2 | FAT-108 |
| SYS-B38 | `GET /mqtt/configuration` tanpa trailing slash; API wajibkan slash | Medium | Fase 1 | FAT-109 |
| SYS-B39 | Stage config: `{config, summary}` vs `{config, baseVersionId?, reason?, comment?}` | Medium | Fase 5 | FAT-110 |
| SYS-B40 | Detail error 422: dokumen sebut `details`, panel hanya parse `issues` | Medium | Fase 1 | FAT-111 |
| SYS-B41 | Apply/rollback: tanpa `acknowledgeUnvalidated`; polling operasi sekali | Medium | Fase 5 | FAT-112 |
| SYS-B42 | `POST /backups` tak ada di dokumen (endpoint hantu); tanpa restore/download | Medium | Fase 5 | FAT-113 |
| SYS-B43 | Model config terstruktur tak dispesifikasi; field/default/enum ditebak panel | Medium | Fase 5 | FAT-114 |
| SYS-B44 | Overview: bentuk dalam tak dispesifikasi; `null` jadi `IN_SYNC` menyesatkan | Low | Fase 5 | FAT-115 |
| SYS-B45 | Filter Shift Schedules: snake_case (API) vs camelCase (Guide) | Medium | Fase 6 | FAT-116 |
| SYS-B46 | Field denormalisasi schedule (`shiftName`/`shiftCode`/`startTime`/`endTime`) tak dijamin | Medium | Fase 6 | FAT-117 |
| SYS-B47 | Operators: `is_active` create dihilangkan; proteksi `ADM-001` beda status demo vs dokumen | Low | Fase 6 | FAT-118 |
| SYS-B48 | List DynSec & Operators tanpa pagination/filter server-side | Low | Fase 6 | FAT-119 |
| SYS-B49 | Hapus line: demo blokir bila dipakai operator; dokumen hanya machines + WO snapshot | Low | Fase 6 | FAT-120 |
| SYS-B50 | Hapus shift: demo hanya periksa schedules, bukan WO snapshot; efek ubah jam tak dispesifikasi | Low | Fase 6 | FAT-121 |

**Rekap per fase:** Fase 1: B6, B19, B25, B38, B40 (5) · Fase 2: B28–B37
(10) · Fase 3: B1–B5, B7–B18 (17) · Fase 4: B20–B24, B26, B27 (7) ·
Fase 5: B39, B41–B44 (5) · Fase 6: B45–B50 (6). Total 50.

---

## Lampiran B — Indeks kebutuhan mode akses B1–B25 + checklist V1–V12

Sumber lengkap: `docs/BACKEND_REQUIREMENTS_ACCESS_MODE.md`. Epic Linear:
E10 — A10.2 (FAT-40).

### B1–B25 (ringkas)

| # | Kebutuhan | Bagian |
| --- | --- | --- |
| B1 | Variabel `ACCESS_MODE` (`private` \| `public`), default `private`, via konfigurasi deployment | 11.1 |
| B2 | Mode berlaku untuk SEMUA vhost/port (satu sumber kebenaran) | 11.1 |
| B3 | Konfigurasi hilang/rusak → jatuh ke `private` (fail-closed) | 11.1 |
| B4 | Klasifikasi kanal per request dari jalur ingress nyata | 11.2 |
| B5 | Kanal tidak bisa dipalsukan client | 11.2 |
| B6 | Dual-vhost dipertahankan (80 LAN penuh, 8080 tunnel) | 11.2 |
| B7 | Tolak mutasi dari tunnel saat mode `private` (403, tanpa pengecualian) | 11.3 |
| B8 | Baca tetap diizinkan dari tunnel di kedua mode | 11.3 |
| B9 | Login dari tunnel mengikuti mode (`private` → 403) | 11.3 |
| B10 | WebSocket telemetri read-only di kedua kanal dan mode | 11.3 |
| B11 | Penegakan di middleware, bukan per-handler | 11.3 |
| B12 | Error envelope standar + pesan Indonesia yang sama dengan panel | 11.3 |
| B13 | Endpoint status akses `GET /api/v1/system/access-mode` (tanpa/minimal auth) | 11.4 |
| B14 | Sertakan `access_mode` + `mutations_allowed` di `GET /auth/me` | 11.4 |
| B15 | (Opsional) Header respons `X-Access-Channel` / `X-Access-Mode` | 11.4 |
| B16 | Panel memakai data server bila tersedia (frontend, sudah disiapkan) | 11.4 |
| B17 | Endpoint ubah mode `PUT /api/v1/admin/access-mode` (ADMIN-only) | 11.5 |
| B18 | Audit trail perubahan mode (siapa/kapan/lama→baru/alasan, `reason` wajib) | 11.5 |
| B19 | Perubahan mode berlaku segera (tanpa restart bila memungkinkan) | 11.5 |
| B20 | Perubahan mode tidak membunuh sesi yang sudah berjalan (mutasi berikutnya tetap 403) | 11.5 |
| B21 | TLS wajib di kanal publik (tanpa TLS, mode `public` tidak boleh aktif) | 11.6 |
| B22 | Auth tetap berlaku penuh di mode `public` (JWT wajib) | 11.6 |
| B23 | Rate limiting lebih ketat di tunnel | 11.6 |
| B24 | Header keamanan (CSP, HSTS, nosniff, no-store) di kedua vhost | 11.6 |
| B25 | Log akses mencatat kanal (`lan`/`tunnel`) per request | 11.6 |

### Checklist verifikasi V1–V12

| # | Uji | Hasil yang diharapkan |
| --- | --- | --- |
| V1 | `POST /api/v1/products` via tunnel, mode `private` | 403 `FORBIDDEN`, tidak ada data berubah |
| V2 | `POST /api/v1/products` via tunnel, mode `public` | 201, produk terbentuk |
| V3 | `POST /api/v1/products` via LAN, mode `private` | 201 |
| V4 | `GET /api/v1/devices` via tunnel, mode `private` | 200 (baca tetap boleh) |
| V5 | `POST /api/v1/auth/login` via tunnel, mode `private` | 403 |
| V6 | `POST /api/v1/auth/login` via tunnel, mode `public` | 200 + token |
| V7 | Header `X-Access-Channel: lan` palsu dari tunnel, mode `private`, lalu `POST` | Tetap 403 (B5) |
| V8 | `GET /api/v1/system/access-mode` dari tunnel | `{mode, channel: "tunnel", mutations_allowed}` benar |
| V9 | Ubah mode via `PUT /admin/access-mode` sebagai OPERATOR | 403 (ADMIN-only) |
| V10 | Ubah mode sebagai ADMIN + cek audit log | Tercatat siapa/kapan/alasan |
| V11 | Mode tidak dikonfigurasi (env hilang) | Server jalan sebagai `private` (B3) |
| V12 | WS `/ws/telemetry` via tunnel | Stream baca jalan; tidak ada pesan tulis yang diproses |

---

## Lampiran C — Template decision log + checklist verifikasi akhir

*Diisi 17 November 2026: 15 dari 15 keputusan diputuskan oleh Fathur (K-05, K-06, K-07 diputuskan menyusul — ikuti desain API_DOCUMENTATION). Jangan menghapus baris — isi kolomnya bila ada keputusan baru. Perubahan 18 November 2026 (delegasi Fathur ke Muse) dicatat di §C.1a — empat keputusan diubah mengikuti backend (K-03, K-04, K-09, K-11), empat dikonfirmasi tetap (K-01, K-02, K-12, K-15), tujuh keputusan gap baru diputuskan (B1, B3, B4, B6, B7, B16, enum `event_type`).*

### C.1 Decision log

| # | Tanggal | Keputusan | Opsi yang dipilih | Alasan / dasar | Diputuskan oleh | Dokumen yang dikoreksi |
| --- | --- | --- | --- | --- | --- | --- |
| K-01 | 2026-11-17 | Body `POST /auth/password/change` | (a) `{current_password, new_password}` (API §L) | Panel sudah memakai bentuk ini; satu nama field | Fathur | Guide Lampiran J dikoreksi ke `{current_password, new_password}` |
| K-02 | 2026-11-17 | Bentuk `GET /auth/me` | (a) `{operator, authz: {...}}` (API §L) | Membawa `authz` (capability, enforcedDomains) yang dibutuhkan panel | Fathur | Guide §4.9 dikoreksi ke bentuk API |
| K-03 | 2026-11-17 | Trailing slash `GET /mqtt/configuration` | (a) Wajib slash (API §3.3b) | Keputusan Fathur; menyimpang dari rekomendasi rencana (c) | Fathur | Guide Lampiran P dikoreksi (wajib slash); panel: `GET /mqtt/configuration` harus memakai trailing slash (tindak lanjut sisi panel) |
| K-04 | 2026-11-17 | Detail error 422 (`issues` vs `details`) | (a) `issues[]` (envelope API §2) | Konsisten dengan envelope standar; panel sudah mem-parse `issues[]` | Fathur | API §3.3b dan tabel §2 dikoreksi (`details` ke `issues[]`) |
| K-05 | 2026-11-17 | Bentuk body sub-operasi dynsec | (a) Objek tunggal dokumen | Ikuti desain API_DOCUMENTATION/Guide Lampiran A (bukan array jamak panel); panel diubah (E15 P15.1, FAT-129) | Fathur | Panel mengirim `{rolename, priority}`, `{acltype, topic, ...}`, `{username, priority?}`; bila backend ternyata memakai bentuk native dynsec (array), dokumen harus dikoreksi ke bentuk array; Fase 2 tidak lagi tertunda oleh K-05 |
| K-06 | 2026-11-17 | Skema respons dynsec | Ikuti desain API_DOCUMENTATION | Password wajib dari pemanggil (API §M: contoh cURL selalu menyertakan password eksplisit; Guide §7.2 min 8) — panel mewajibkan di UI (E15 P15.2, FAT-130); mapper `enabled` diperbaiki agar benar untuk kedua bentuk (E15 P15.3, FAT-131); nama field password sekali tampil + skema lengkap tetap harus didokumentasikan backend (item 2.5/2.6) | Fathur | Panel sudah mengikuti desain dokumen; yang tersisa adalah tugas dokumentasi backend (nama field `generatedPassword`, contoh JSON objek klien/peran/grup); Fase 2 tidak lagi tertunda oleh K-06 |
| K-07 | 2026-11-17 | Skema config terstruktur | Ikuti desain API_DOCUMENTATION | API §3.3b tidak memberi skema — panel mempertahankan skema asumsinya; backend wajib mempublikasikan skema JSON + contoh (item 5.1); overview `configuration: null` = plugin tidak aktif → panel menampilkan UNAVAILABLE (E15 P15.4, FAT-132) | Fathur | Panel sudah mengikuti desain dokumen sejauh yang tertulis; yang tersisa adalah publikasi skema backend; Fase 5 tidak lagi tertunda oleh K-07 |
| K-08 | 2026-11-17 | Kebijakan query param tak dikenal | (a) Diabaikan | Risiko paling kecil terhadap filter panel yang sudah berjalan | Fathur | Kebijakan ditulis di API doc |
| K-09 | 2026-11-17 | Status `POST /permissions` | (b) Katalog seed-only, endpoint dihapus dari dokumen | Panel tidak punya UI untuk membuat permission; katalog terkontrol lebih aman | Fathur | API doc: `POST /permissions` dihapus (katalog seed-only) |
| K-10 | 2026-11-17 | Sumber kebenaran method PATCH vs PUT | (a) PUT untuk `/roles/:id` dan `/policies/:id`; PATCH untuk rotasi password dan enable/disable dynsec | Dokumen konsisten di sini; panel yang harus berubah | Fathur | Panel: `http/iam.ts` PATCH ke PUT; `http/mqttDynsec.ts` POST ke PATCH (tindak lanjut sisi panel) |
| K-11 | 2026-11-17 | Rute provisioning (`/clients` vs `/clients/provision`) | (b) `POST /clients/provision` | Keputusan Fathur; menyimpang dari rekomendasi rencana (a) | Fathur | Guide dikoreksi (rute `/clients/provision` diakui); panel: provisioning harus memanggil `POST /clients/provision` (tindak lanjut sisi panel) |
| K-12 | 2026-11-17 | Aturan naiknya `authz_version` | (a) API §3.4: setiap mutasi menaikkan | Definisi tidak ambigu; lebih aman daripada klasifikasi per jenis mutasi | Fathur | Guide §8 dikoreksi ke API §3.4 |
| K-13 | 2026-11-17 | Cakupan feed `/system/audit` + enum `event_type` | (a) `/system/audit` alias harfiah seluruh feed operational events | Satu feed, satu sumber kebenaran; halaman audit panel langsung cocok | Fathur | API doc: enum `event_type` + status `severity` ditulis; cakupan `/system/audit` dinyatakan alias harfiah |
| K-14 | 2026-11-17 | Ack `operatorId` wajib atau tidak | (a) Turunkan operator dari JWT, body `{note?}` saja | Endpoint terotentikasi, server sudah tahu pemanggil; panel sudah mengirim seperti ini | Fathur | Guide §6.7 dikoreksi (operatorId tidak wajib) |
| K-15 | 2026-11-17 | Definisi availability jam planned penuh | (a) Jam planned penuh dikeluarkan dari penyebut availability, ditandai "planned" | Sesuai praktik OEE; jam istirahat tidak tampil sebagai jam gagal total | Fathur | API §K.3c dikoreksi (jam planned penuh dikeluarkan dari penyebut) |
| | | | | | | |
| | | | | | | |

### C.1a Perubahan keputusan — 18 November 2026 (delegasi Fathur ke Muse)

> **Sumber:** keputusan backend 18 Nov 2026 (SYS-B8–B50, `docs/BACKEND_GAPS_SYSTEM_ADMIN.md`) + analisis relevansi E17 (`docs/BACKEND_DECISIONS_REALITY_CHECK.md`). Fathur mendelegasikan seluruh keputusan penutupan gap ke Muse pada 18 Nov 2026 malam, dengan syarat: merujuk kebutuhan real-case, menutup gap backend–panel, **tanpa duplikasi flow dan tanpa flow deprecated** — satu alur kanonis per item. Baris C.1 di atas dipertahankan sebagai riwayat; tabel ini adalah keputusan yang berlaku.

| # | Keputusan 17 Nov (Fathur) | Keputusan 18 Nov (delegasi) | Alasan / dasar | Diputuskan oleh |
| --- | --- | --- | --- | --- |
| K-03 | (a) Wajib trailing slash | **(c) Terima kedua bentuk** | Backend memutuskan (c) (D-3); satu baris Fastify `ignoreTrailingSlash: true`; perilaku umum API publik; panel tidak berubah (tetap mengirim slash) | Muse (delegasi Fathur) |
| K-04 | (a) `issues[]` saja | **Dual: `issues[]` + `details`** | Backend memutuskan dual (D-4); `issues[]` kanonis, `details` kompatibilitas; panel membaca `issues` saja | Muse (delegasi Fathur) |
| K-09 | (b) Katalog seed-only | **(a) Endpoint didukung + guard** | Backend memutuskan (a) (B10); guard `400 INERT_PERMISSION` + `409 PERMISSION_EXISTS` menjawab keberatan awal; panel tidak memanggil endpoint ini | Muse (delegasi Fathur) |
| K-11 | (b) `POST /clients/provision` | **(a) `POST /clients`; rute provision tidak ada** | Backend memutuskan (a) (D-1b); provisioning = create dengan body berbeda, bukan layanan terpisah; panel di-revert (P-A), registry 132 → 131 | Muse (delegasi Fathur) |
| K-01 | (a) `{current_password, new_password}` | **Tetap (a) — dikonfirmasi** | Sudah diputuskan 17 Nov; konfirmasi backend masih menunggu (D-1) | Fathur (17 Nov), dikonfirmasi delegasi |
| K-02 | (a) `{operator, authz}` nested | **Tetap (a) — dikonfirmasi** | Sudah diputuskan 17 Nov; konfirmasi backend masih menunggu (D-2) | Fathur (17 Nov), dikonfirmasi delegasi |
| K-12 | (a) Setiap mutasi menaikkan | **Tetap (a) — dikonfirmasi** | Sudah diputuskan 17 Nov; penetapan backend masih menunggu | Fathur (17 Nov), dikonfirmasi delegasi |
| K-15 | (a) Dikeluarkan + "planned" | **Tetap (a) — dikonfirmasi** | Sudah diputuskan 17 Nov; implementasi Fase 8 (telemetry sisi server) | Fathur (17 Nov), dikonfirmasi delegasi |

**Keputusan gap baru (di luar K-01–K-15), 18 Nov 2026 (delegasi):**

| Gap | Keputusan | Alasan singkat |
| --- | --- | --- |
| B1 | **(b) Body policy camelCase kanonis + `subjectMatch` terstruktur** | Pola 18 Nov: body JSON camelCase, query snake_case (B45); panel menyesuaikan mapper; satu casing kanonis, tanpa fallback ganda |
| B3 | **(a) Lanjutkan ABAC, scope minimal** | ABAC sudah dijanjikan dokumen; grammar minimal + contoh + pesan 400 yang menyebut atribut |
| B4 | **(a) Dukung alur paksa `mustChangePassword`** | Fitur keamanan standar; satu alur (login → 401 khusus → ganti → login ulang), tanpa jalur kedua |
| B6 | **(a) Publikasikan skema respons IAM lengkap** | Tugas dokumentasi Fase 3; menutup akar default diam-diam panel |
| B7 | **(a) Tolak `409 ROLE_IN_USE`** | Konsisten dengan pola B49/B50; tanpa penghapusan diam-diam |
| B16 | **(a) Samakan ke server 5/60 + `Retry-After`** | Satu sumber kebenaran (server); panel tidak menegakkan hitungannya sendiri secara paralel |
| Enum `event_type` | **(a) Enum tertutup (daftar dari backend)** | Filter yang bisa diandalkan; daftar berasal dari kode backend |

**Arah panel (E17 P-A–P-J), 18 Nov 2026 (delegasi):** P-A revert K-11 **Ya**, P-B hapus `accessMap` **Ya**, P-C polling terminal **Ya**, P-D/P-E filter server-side **Ya**, P-F anti-eskalasi **Ya**, P-I `GET /health/detail` **Ya — tertunda sampai backend menyediakan endpoint**, P-J export audit **Ya**. Scope implementasi berikutnya (epic baru); bukan bagian dari pencatatan ini.

### C.2 Checklist verifikasi akhir

- [ ] Fase 0: semua keputusan K-01–K-15 tertulis di decision log (SELESAI 17 Nov 2026 — 15/15 diputuskan); dokumen API/Guide yang bertentangan sudah dikoreksi (masih menunggu backend). Perubahan 18 Nov 2026 (delegasi) dicatat di §C.1a — K-03/K-04/K-09/K-11 diubah, K-01/K-02/K-12/K-15 dikonfirmasi, 7 keputusan gap baru diputuskan.
- [ ] Fase 1: contoh respons di dokumen cocok field-per-field dengan respons live; envelope + cursor bekerja di >1 halaman.
- [ ] Fase 2: 23 operasi dynsec end-to-end lolos; password sekali tampil hanya muncul sekali.
- [ ] Fase 3: policy/role/assignment/ABAC/`mustChangePassword`/login 429/refresh 401 lolos.
- [ ] Fase 4: kartu health menampilkan nilai ukur nyata (broker mati → `DOWN`); audit lengkap; ekspor audit lolos.
- [ ] Fase 5: stage → 422 → apply async (polling sampai terminal) → rollback lolos; nasib `POST /backups` diputuskan.
- [ ] Fase 6: filter snake_case + camelCase; guard hapus line/shift (termasuk WO snapshot); list >100 klien / >50 operator.
- [ ] Fase 7: checklist V1–V12 lolos penuh (LAN + tunnel, mode private + public).
- [ ] Fase 8: rekonsiliasi Σ hourly vs summary vs rollup satu shift; `from`/`to` mengubah data; jam planned penuh; enum FSM.
- [ ] Fase 9: V8.2 Real E2E lolos; V8.3 LAN per modul lolos; V8.5 DoD ditutup; V8.4 (infra Nginx) dijadwalkan terpisah dengan target server.
- [ ] Tidak ada lagi nilai yang disintesis di respons backend.
- [ ] Status Linear diperbarui: E13 child, A10.2 (FAT-40), V8.2/V8.3/V8.5 ditutup setelah verifikasi.
- [ ] Dokumen ini diperbarui bila ada keputusan baru (versi + tanggal diubah).

---

*Dokumen ini disusun 17 November 2026 dari `docs/BACKEND_GAPS_SYSTEM_ADMIN.md`
(50 gap SYS-B1–SYS-B50), `docs/BACKEND_REQUIREMENTS_ACCESS_MODE.md` (B1–B25,
V1–V12), `docs/TELEMETRY_AUDIT.md` (G1–G25), `AUDIT.md` §14–§18, dan
`docs/LINEAR.md` §1.3/§8. Backend belum ada saat dokumen ini ditulis; mode
Real belum pernah terverifikasi end-to-end.*
