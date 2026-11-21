> **DIARSIPKAN 2026-11-19 (E21/FAT-168):** analisis E17 ini bersifat
> historis — semua verdict-nya sudah diverifikasi ulang E21 di
> `docs/BACKEND_SYNC_CLOSURE.md` §3. Dokumen ini dipertahankan sebagai
> **riwayat** analisis keputusan Fase 0 vs keputusan backend 18 Nov 2026 —
> bukan lagi dokumen kerja aktif.

# Analisis relevansi keputusan Fase 0 vs keputusan backend 18 Nov 2026 & real-case industri

| | |
|---|---|
| **Tanggal** | 18 November 2026 |
| **Repo panel** | `iiot-oee-admin-panel` (commit lokal `f7a4b5f` = remote `393fb09`, cherry-pick dari Fathur) |
| **Sumber keputusan Fase 0** | `docs/BACKEND_UPGRADE_PLAN.md` §4 + Lampiran C (decision log K-01–K-15, 15/15 diputuskan 17 Nov 2026) |
| **Sumber keputusan backend** | `docs/BACKEND_GAPS_SYSTEM_ADMIN.md` § "Keputusan backend — 18 November 2026" (SYS-B8–B50, lima modul remediasi; dokumen otoritatif: repo `iiot-oee`, `apps/backend/specs/034…038`) |
| **Catatan metode** | Dokumen spec backend (`specs/034…038`) tidak dibaca langsung — analisis ini memakai ringkasan keputusan yang Fathur catat di dokumen gap. Bila ringkasan dan spec berbeda, spec yang menang. |
| **Status implementasi** | Keputusan backend **belum diimplementasikan** (per catatan Fathur di dokumen gap). Analisis ini BUKAN implementasi. |

## 1. Ringkasan eksekutif

**Jawaban singkat: ya, sebagian besar tetap relevan — tapi tiga keputusan Fase 0 dibalik oleh backend, satu disempurnakan, dan empat masih terbuka.**

Dari 15 keputusan Fase 0 (K-01–K-15):

| Verdict | Jumlah | K-item |
|---|---|---|
| **Dikonfirmasi backend** | 7 | K-05, K-06, K-07, K-08, K-10, K-13, K-14 |
| **Disempurnakan backend** (inti sama, bentuk berubah) | 1 | K-04 |
| **Dibalik backend** (backend memilih opsi lain) | 3 | K-03, K-09, K-11 |
| **Masih terbuka** (backend belum putuskan) | 3 | K-01, K-02, K-12 |
| **Belum tercakup** (di luar lima modul 18 Nov) | 1 | K-15 |

**Tiga pembalikan itu penting, dan ketiganya punya alasan industri yang kuat:**

1. **K-11 (rute provisioning) — dampak terbesar ke panel.** Fathur memilih (b) `POST /clients/provision`; backend memutuskan rute itu **tidak ada**, gunakan `POST /clients`. Panel saat ini mengirim provisioning ke rute yang akan 404 di Real mode (E14 P14.4 harus di-revert — lihat §5 P-A).
2. **K-03 (trailing slash) — dibalik ke opsi yang dulu direkomendasikan rencana.** Fathur memilih (a) wajib slash; backend menerima **kedua bentuk**. Ini satu baris konfigurasi Fastify (`ignoreTrailingSlash: true`) dan sesuai perilaku umum API publik. Panel yang mengirim slash tetap jalan — tidak ada perubahan panel.
3. **K-09 (`POST /permissions`) — dibalik dengan guard.** Fathur memilih (b) seed-only; backend mendukung endpoint itu dengan body camelCase + guard `400 INERT_PERMISSION` (permission tanpa rute penjaga ditolak) dan `409 PERMISSION_EXISTS`. Panel tidak memanggil endpoint ini — tidak ada perubahan panel, hanya koreksi dokumen.

**Yang paling relevan dengan real-case industri justru yang dikonfirmasi:** bentuk tunggal sub-operasi dynsec (K-05) sama persis dengan protokol native Mosquitto; password min 8 tanpa auto-generate (K-06) sama dengan lantai NIST SP 800-63B; availability yang mengecualikan planned downtime (K-15) adalah definisi OEE textbook (ISO 22400-2); aktor ack dari JWT (K-14) adalah praktik keamanan standar.

**Satu catatan jujur soal K-08:** "query param tak dikenal diabaikan" BUKAN konsensus industri tanpa syarat. Stripe justru menolak parameter tak dikenal; argumen penolakan adalah typo pada filter menghasilkan dataset yang salah secara diam-diam. Backend memilih diabaikan + didokumentasikan (Postel's law) — bisa diterima untuk API internal industri dengan klien constrained, tapi risikonya nyata dan tepat mengenai konflik casing B45 (`line_id` vs `lineId`). Mitigasinya ada di §3.6.

## 2. Matriks keputusan

| K | Keputusan Fase 0 (17 Nov) | Keputusan backend (18 Nov) | Praktik industri | Verdict | Dampak panel |
|---|---|---|---|---|---|
| K-01 | (a) `{current_password, new_password}` (API §L) | **Masih terbuka** (D-1) | Kedua penamaan ada di framework besar (Django: `old_password`; Laravel: `current_password`); yang penting satu sumber kanonis | Terbuka | Tidak ada; panel sudah pakai API §L |
| K-02 | (a) `{operator, authz}` nested (API §L) | **Masih terbuka** (D-2) | Nested dan flat sama-sama dipakai (Keycloak nested, GitHub flat); panel menangani keduanya via `mapAuthMe` | Terbuka | Tidak ada |
| K-03 | (a) Wajib trailing slash | **(c) Kedua bentuk diterima** (D-3) | Fastify: `ignoreTrailingSlash: true` = satu baris; Express mengabaikan slash secara default; API publik umumnya menormalisasi | **Dibalik** | Tidak ada; panel mengirim slash, server menerima keduanya |
| K-04 | (a) 422 memakai `issues[]` | **`issues[]` + `details`** (D-4, dual) | RFC 7807/9457 = standar IETF; `issues[]` = pola Zod yang umum; dual-field = pola kompatibilitas migrasi, bukan standar | **Disempurnakan** | Tidak ada; panel hanya mem-parsing `issues` dan field itu ada |
| K-05 | (a) Sub-operasi dynsec objek tunggal | **Dikonfirmasi** (D-5) | Protokol native Mosquitto `$CONTROL/dynamic-security/v1` memakai objek perintah tunggal (`{"commands": [{"command": "createClient", ...}]}`) | Dikonfirmasi | Tidak ada; panel sudah diubah (E15) |
| K-06 | Ikuti API doc (password wajib min 8; mapper diperbaiki) | **Dikonfirmasi + diperluas** (D-6, B33–B35) | NIST SP 800-63B §5.1.1.2: memorized secret ≥ 8 karakter; tanpa auto-generate = lebih ketat dari NIST (NIST membolehkan generated ≥ 6) | Dikonfirmasi | Tidak ada yang wajib; mapper sudah kompatibel (lihat §5 P-G) |
| K-07 | Ikuti API doc (skema config terstruktur) | **Dikonfirmasi** (D-7, B43) | Pola adapter / anti-corruption layer: bentuk luar mengikuti konsumen, model internal tetap kanonik; field tanpa sumber = `null` (bukan karangan) | Dikonfirmasi | Tidak ada; panel sudah pakai bentuknya (E15 B44) |
| K-08 | (a) Query param tak dikenal diabaikan | **Dikonfirmasi** (diabaikan + 200 + didokumentasikan) | Terbelah: Postel's law (abaikan) vs Stripe (tolak 400). Penolakan menangkap typo filter; pengabaian menjaga forward-compat klien lama | Dikonfirmasi | Tidak ada; risiko typo filter jadi tanggung jawab panel (tes query string) |
| K-09 | (b) Katalog seed-only, endpoint dihapus dari dokumen | **(a) Didukung** + guard (B10) | Katalog statis adalah pola umum, tapi admin API runtime juga lazim (Auth0, Keycloak); guard `INERT_PERMISSION` mengatasi risiko yang memotivasi (b) | **Dibalik** | Tidak ada; panel tidak memanggil endpoint ini; koreksi dokumen (§5 P-K) |
| K-10 | (a) PUT untuk IAM, PATCH untuk dynsec | **Dikonfirmasi** (B2/B5 backend PUT; B28/B29 backend PATCH) | PUT = replace penuh, PATCH = ubah sebagian — konvensi REST standar | Dikonfirmasi | Tidak ada; panel sudah diubah (E14) |
| K-11 | (b) `POST /clients/provision` | **(a) `POST /clients`; rute provision tidak ada** (D-1b) | Provisioning terdedikasi adalah pola IoT skala besar (AWS fleet provisioning, Azure DPS) — tapi sebagai layanan terpisah, bukan sub-rute create; di sini provisioning = create dengan body berbeda, jadi model resource lebih tepat | **Dibalik** | **WAJIB revert (E14 P14.4)** — provisioning Real mode akan 404 (§5 P-A) |
| K-12 | (a) Setiap mutasi menaikkan `authz_version` | **Masih terbuka** | Version counter / ETag yang naik tiap mutasi adalah pola umum (optimistic concurrency) | Terbuka | Tidak ada |
| K-13 | (a) `/system/audit` = alias harfiah feed operasional | **Dikonfirmasi** (feed operasional; mutasi IAM terpisah di `/access-control/audit`) | Feed audit terpisah per domain adalah pola standar (audit IAM ≠ event operasional) | Dikonfirmasi | Tidak ada |
| K-14 | (a) Aktor ack dari JWT, body `{note?}` | **Dikonfirmasi** (B21: aktor dari subjek JWT; field aktor di body diterima tapi diabaikan/deprecated; ack kedua idempoten) | Jangan pernah percaya identitas aktor dari body klien — ambil dari token; pola ini standar keamanan | Dikonfirmasi | Tidak ada; panel sudah mengirim `{note?}` saja |
| K-15 | (a) Jam fully-planned dikeluarkan dari denominator availability, ditandai "planned" | **Belum tercakup** (di luar lima modul; Fase 8 telemetry) | Definisi OEE textbook: Availability = run time ÷ planned production time; ISO 22400-2: A = APT ÷ PBT; planned stops dikeluarkan dulu | Belum tercakup | Tidak ada (panel demo sudah pakai definisi ini) |

## 3. Penilaian per keputusan ber-alternatif

### 3.1 K-03 — Trailing slash: backend memilih yang dulu direkomendasikan rencana

Fathur memilih (a) wajib slash; backend memilih (c) terima keduanya. **Backend benar menurut praktik industri, dan biayanya nyaris nol.**

- Fastify — stack yang dipakai backend per dokumen acuan — punya opsi `ignoreTrailingSlash`: default `false` (beda rute), `true` membuat `/foo` dan `/foo/` menunjuk rute yang sama. Satu baris konfigurasi, berlaku untuk semua rute.
- Express (framework Node lain yang umum) mengabaikan trailing slash secara default; Django mengalihkan (redirect) ke bentuk kanonis; sebagian besar API publik menormalisasi, bukan menolak 404.
- Risiko (a) di konteks industri: klien di sini bukan hanya browser — ada firmware ESP32/STM32 dan gateway yang merangkai URL dengan string concat. Satu slash yang hilang = 404 pada endpoint konfigurasi broker saat commissioning. (c) menghilangkan seluruh kelas kegagalan itu tanpa biaya.
- **Dampak panel: tidak ada.** Panel mengirim slash (E14 P14.1) dan server menerimanya. Keputusan log Fase 0 perlu dicatat sebagai "diubah backend menjadi (c)" agar tidak ada yang mengira panel harus diubah.

Sumber: [Fastify — Factory (ignoreTrailingSlash)](https://fastify.dev/docs/v5.5.x/Reference/Server/)

### 3.2 K-11 — Rute provisioning: pembalikan yang paling berdampak

Fathur memilih (b) `POST /clients/provision` (satu-satunya sumber: contoh cURL API §M); backend memutuskan rute itu **tidak ada**, gunakan `POST /clients` (D-1b). Guide §9.1/§14.13 sudah tegas soal ini sejak awal — backend hanya mengikutinya.

**Apakah (b) punya pembelaan industri? Ya, tapi tidak untuk sistem ini.**

- Provisioning terdedikasi adalah pola nyata di IoT skala besar: AWS IoT fleet provisioning (claim certificate + `RegisterThing` via provisioning template) dan Azure IoT Hub Device Provisioning Service (endpoint provisioning terpisah, zero-touch) adalah layanan provisioning yang berdiri sendiri.
- Tapi pola itu muncul karena provisioning di sana **melakukan sesuatu yang berbeda** dari create biasa: menerbitkan sertifikat, menetapkan identitas, mengalokasikan hub. Di sistem ini, "provisioning" = membuat klien dynsec dengan body `{deviceId, access}` — operasi yang sama dengan create, hanya diskriminator body yang berbeda. Tidak ada langkah tambahan yang membenarkan rute tersendiri.
- Model resource (`POST /clients` dengan body yang membedakan mode) lebih konsisten dengan sisa API, dan cocok dengan heading API §M sendiri ("Provisioning perangkat" di bawah `POST /clients`) — contoh cURL-nya yang menyimpang, bukan headingnya.
- **Dampak panel: wajib revert (P-A).** `createMqttClient` masih bercabang ke `MQTT_DYNSEC_CLIENTS_PROVISION` bila ada `deviceId` tanpa `roles`. Di Real mode rute itu 404 → pembuatan klien mode device gagal total. Registry kembali 132 → 131 operasi.

Sumber: [Azure DPS — concepts](https://learn.microsoft.com/ms-my/azure/iot-dps/concepts-service), [IoT device provisioning — AWS vs Azure](https://www.creahive.com/guides/iot-device-provisioning/)

### 3.3 K-09 — `POST /permissions`: dibalik dengan guard yang menjawab keberatan awal

Fathur memilih (b) seed-only karena katalog permission yang bisa dibuat runtime berisiko melahirkan permission "inert" (tidak dijaga rute mana pun). Backend memilih (a) **dengan guard yang tepat menjawab keberatan itu**: duplikat → `409 PERMISSION_EXISTS`; permission tanpa rute penjaga → `400 INERT_PERMISSION`.

- Katalog permission statis/seed memang pola umum (Casbin model/policy di kode, RBAC table statis).
- Tapi pembuatan runtime via admin API juga lazim di IdP besar (Auth0 Management API, Keycloak admin) — selalu ADMIN-only.
- Guard `INERT_PERMISSION` adalah desain yang bagus: permission hanya boleh lahir bila ada penegaknya. Ini mengubah (b) dari "larangan" menjadi "aturan yang ditegakkan server".
- **Dampak panel: tidak ada** (panel tidak memanggil endpoint ini; registry entry sengaja dipertahankan). Yang perlu diperbaiki: decision log + item Fase 3 yang masih menulis (b).

### 3.4 K-04 — 422 dual envelope: kompromi migrasi yang masuk akal

Fathur memilih (a) `issues[]`; backend mengirim **keduanya**: `issues[]` (kontrak baru) + `details` (kompatibilitas).

- RFC 7807 (diperbarui RFC 9457, format wire sama) adalah standar IETF untuk problem details; anggotanya `type/title/status/detail/instance`, dan extension member diizinkan. Pola `errors[]`/`issues[]` berisi `{field, message}` adalah pola contoh RFC 9457 untuk banyak error validasi, dan `issues` adalah nama field yang dipakai ekosistem Zod (lihat Knowify: respons RFC 7807 dengan array `issues` dari validasi Zod).
- Mengirim dua field sekaligus bukan standar — tapi pola kompatibilitas yang umum saat mengganti kontrak: klien baru membaca `issues`, klien lama masih membaca `details`. Yang penting: keduanya harus selalu konsisten (satu sumber kebenaran di server, bukan dua generator).
- **Dampak panel: tidak ada.** Panel hanya mem-parsing `issues` dan field itu dijamin ada. Catatan: bila suatu hari `details` dihapus, panel tidak merasakan apa-apa.

Sumber: [RFC 7807 introduction (Axway)](https://blog.axway.com/learning-center/apis/api-design/introduction-to-rfc-7807), [Knowify — responses & errors (issues array)](https://developer.knowify.com/docs/guide/v2-responses-and-errors.html)

### 3.5 K-05 — Bentuk tunggal dynsec: keputusan yang paling kuat secara industri

Diputuskan (a) objek tunggal; backend mengonfirmasi (D-5). **Ini bukan preferensi gaya — ini mengikuti protokol native.**

- Mosquitto Dynamic Security Plugin tidak punya HTTP API; kontrolnya lewat pesan JSON ke topik `$CONTROL/dynamic-security/v1`, contoh: `{"commands": [{"command": "createClient", "username": "user_one", ...}]}`. Setiap perintah adalah satu objek dengan satu `command`.
- Bentuk REST `{rolename, priority?}` / `{acltype, topic, ...}` / `{username, priority?}` adalah pemetaan 1:1 dari perintah native tersebut. Bentuk jamak `{roles:[...]}` tidak punya padanan di protokol — ia adalah batching yang diarang panel.
- **Dampak panel: tidak ada** (sudah diubah di E15). Keputusan ini menutup D-5 secara permanen.

Sumber: [Mosquitto dynamic security — Cedalo docs](https://docs.cedalo.com/mosquitto/2.8/security/), [dynsec command test — Mosquitto test suite](https://docs.rs/crate/libmosquitto-sys/latest/source/mosquitto/test/broker/14-dynsec-modify-group.py)

### 3.6 K-08 — Query param tak dikenal: keputusan yang benar, dengan risiko yang harus diakui

Fathur memilih (a) diabaikan; backend mengonfirmasi: diabaikan dengan 200 + didokumentasikan.

**Tapi klaim "ini standar industri" perlu dikoreksi — industrinya terbelah:**

- **Kubu abaikan (Postel's law):** "be liberal in what you accept." Alasan: forward compatibility — klien lama yang mengirim param baru tidak boleh pecah; klien constrained (firmware) tidak boleh gagal karena satu param tambahan. Ini posisi umum untuk API internal dan IoT.
- **Kubu tolak (Stripe):** Stripe sejak 2011 melempar exception untuk parameter tak dikenal. Alasan: typo pada filter (`currncy`, `lineId` vs `line_id`) menghasilkan **dataset yang salah secara diam-diam** — failure mode terburuk untuk API baca. Beberapa panduan API secara eksplisit merekomendasikan: query parameter selalu ditolak bila tak dikenal, karena filter yang salah ketik tidak terlihat oleh pemanggil.
- **Yang membuat ini tajam di sistem ini:** konflik casing B45 (`line_id` snake_case vs `lineId` camelCase) adalah persis failure mode itu. Backend kini menetapkan snake_case sebagai satu-satunya bentuk (B45) dan mengabaikan param lain — jadi bila panel suatu hari mengirim `lineId`, server akan mengembalikan data **tanpa filter** dengan status 200, bukan 400.
- **Mitigasi (bukan pembatalan keputusan):** panel harus punya tes yang menegaskan query string persis yang dikirim (sudah ada pola stub-HTTP di `modeAndTransport.test.ts`); server sebaiknya mencatat (log) param tak dikenal agar salah kirim terlihat di observability. Keputusan (a) tetap bisa dipertahankan — tapi dengan mata terbuka.

Sumber: [Stripe — exceptions for unrecognized parameters](https://docs.stripe.com/changelog/2011-06-21/exceptions-unrecognized-api-parameters), [API versioning & unknown fields (Postel's law discussion)](https://github.com/pawar-pratik/api-mastery/blob/HEAD/02-rest-design/11-versioning-and-evolution.md)

### 3.7 K-15 — Availability: definisi textbook, menunggu giliran backend

Belum tercakup lima modul 18 Nov (masuk Fase 8 telemetry). Keputusan (a) — jam fully-planned dikeluarkan dari denominator, ditandai "planned" — **adalah definisi OEE standar, bukan pilihan bebas:**

- Availability = (Planned production time − Downtime) ÷ Planned production time. Planned stops (scheduled maintenance, breaks) dikeluarkan **sebelum** menghitung. ISO 22400-2: A = APT ÷ PBT (actual production time ÷ planned busy time).
- OEE mengukur "seberapa baik waktu yang diputuskan untuk produksi dipakai" — waktu yang memang tidak dijadwalkan produksi bukan kerugian, itu TEEP (total effective equipment performance), metrik yang berbeda.
- **Satu peringatan dari literatur:** klasifikasi "planned vs unplanned" harus ditetapkan sekali dan diterapkan konsisten di semua line/shift, dan waktu yang dikeluarkan harus dilaporkan terpisah — kalau tidak, OEE bisa "dinaikkan" dengan memindahkan kerugian ke kategori planned. Itu pekerjaan server Fase 8 (G8/F-7): definisi `time_sec.planned` + aturan klasifikasinya, bukan sekadar rumusnya.

Sumber: [How to calculate OEE (Sharpen)](https://www.sharpenmfg.com/blog/how-to-calculate-oee-scrap-fpy), [OEE guide — ISO 22400 (Igromi)](https://igromi.com/en/resources/view/oee-guide)

### 3.8 K-06 — Password min 8: lantai NIST, bukan angka karangan

Dikonfirmasi + diperluas (B33: wajib min 8, **tidak ada auto-generate**; B34: password sekali tampil di respons create).

- NIST SP 800-63B §5.1.1.2: memorized secret yang dipilih pengguna **SHALL ≥ 8 karakter**, verifiers SHOULD mengizinkan ≥ 64, tanpa aturan komposisi, tanpa rotasi berkala wajib, dan wajib disaring terhadap daftar bocor.
- "Tidak ada auto-generate" lebih ketat dari NIST (NIST membolehkan secret yang dibuat sistem ≥ 6 karakter) — tapi masuk akal di sini: password perangkat yang dibuat otomatis dan tidak pernah dilihat manusia kedua kalinya adalah kredensial yang tidak terlacak. Respons create yang memuat password **sekali tampil** (lalu hilang dari `GET`) adalah pola industri yang benar untuk kredensial perangkat.
- **Dampak panel:** UI sudah mewajibkan password min 8 (E15). Yang masih menyimpang: demo masih auto-generate password untuk pemanggilan `apiClient` langsung (test seam, dicatat AUDIT.md §18) — harus tetap dibedakan dari perilaku Real.

Sumber: [NIST password guidelines (SP 800-63B §5.1.1.2)](https://www.itkorr.com/knowledge-center/cybersecurity/password-security/nist-password-guidelines)

## 4. Keputusan backend 18 Nov lain yang berdampak ke panel

Di luar K-item, keputusan 18 Nov membawa perubahan panel sebagai berikut (detail file ada di §5):

| Keputusan | Isi | Dampak panel |
|---|---|---|
| B20 + B27 | `GET /health` tetap ringkas/publik; rute baru `GET /health/detail` (ADMIN + LAN) berisi komponen + latensi terukur + `measuredAt`; nilai tak terukur = `null`/`UNKNOWN` | Panel saat ini **mensintesis** data kesehatan kaya dari `/health` (`http/health.ts`: label `'API v1'`, environment `'production'`, latensi `0`, mqtt `'UP'`) — sintesis itu bisa diganti data nyata dari `/health/detail` bila tersedia |
| B25 | Envelope `{data, meta}`; `meta.count` = **jumlah baris halaman**, bukan total dataset | Panel saat ini tidak memakai `meta.count` untuk total (grep: tidak ada pemakaian) — verifikasi saat implementasi, jangan tampilkan sebagai total |
| B26 | Rute baru `GET /system/audit/export` (filter + retensi sama dengan daftar) | Panel belum punya tombol export system audit — keputusan fitur untuk Fathur |
| B30 | `access` diterima verbatim (`publish`/`subscribe`/`readwrite`) | Panel **masih memetakan ulang** (`http/mqttDynsec.ts:74,87`) — harus dihapus (§5 P-B) |
| B35 | Respons klien memakai `disabled` (bukan `enabled`) | Mapper panel sudah benar untuk keduanya (E15); `disabled` kini kanonik — cukup perbarui komentar |
| B38 | Rute config menerima slash dan tanpa slash | = K-03, lihat §3.1 |
| B41 | Apply/rollback asinkron; `acknowledgeUnvalidated` dihormati; panel wajib polling **sampai status terminal** | Panel saat ini polling **sekali** (`useBrokerConfig.ts:169-170`) — harus jadi loop polling (§5 P-C) |
| B45 | Filter jadwal snake_case satu-satunya bentuk; Guide diperbaiki | Panel **sudah** mengirim snake_case (`http/production.ts:180`: `line_id`, `shift_id`, `day_of_week`, `is_active`) — tidak ada perubahan panel |
| B46 | Jadwal memuat `shiftName/shiftCode/startTime/endTime` dari join; shift hilang → `null`, bukan 500 | Panel sudah menangani `null` lewat mapper yang longgar — verifikasi saat Real E2E |
| B47 | `POST /operators` menerima `isActive` (default `true`); proteksi ADM-001: nonaktifkan/ubah role → 400, hapus → 403 | Panel: periksa apakah create operator mengirim `isActive` (saat ini tidak — default server `true` menutupi) |
| B48 | List operator/DynSec = array penuh tanpa pemotongan diam-diam; batas praktis didokumentasikan | Tidak ada perubahan panel |
| B49/B50 | Hapus line/shift yang dipakai → 409 dengan kode spesifik (`PRODUCTION_LINE_IN_USE` + `operatorId`, `SHIFT_IN_USE`, `SHIFT_TIME_OVERLAP`); jadwal mengikuti referensi live | Panel sudah menangani 409 via `ConflictDialog` — tambah penanganan kode baru saat implementasi |
| B8/B9 | `access_control.read` + `.manage` kunci terpisah; `effectiveInMode` = `mode`, tanpa nilai `partial` | Panel: tambah kunci `read`, hapus kunci karangan (cek `CAPABILITY_SPECS`) |
| B10 | `POST /access-control/permissions` didukung, body camelCase (`action`, `resourceType`); duplikat → 409; tanpa rute penjaga → 400 | = K-09, lihat §3.3 |
| B12–B15 | Inspector: `roles` tanpa alias + field lengkap, subjek hilang → 404; `reason` hanya di audit IAM; revoke tak ada → 200 `{removed: 0}`; refresh memuat `authzVersion` | Panel: sesuaikan mapper inspector + penanganan revoke (saat ini revoke tak ada mungkin dianggap error) |

## 5. Tindak lanjut panel yang ditimbulkan keputusan 18 Nov

**Bukan bagian dari analisis ini — perlu keputusan Fathur sebelum dikerjakan.** Diurutkan berdasarkan dampak Real mode:

| ID | Tindak lanjut | Bukti kode kini | Prioritas |
|---|---|---|---|
| P-A | **Revert K-11:** hapus registry `MQTT_DYNSEC_CLIENTS_PROVISION` + cabang `isProvision` (`http/mqttDynsec.ts:92-102`, `demo/mqttDynsec.ts:82-87`); provisioning lewat `POST /clients`; kembalikan pola `/clients/provision` ke daftar terlarang; sesuaikan tes (`modeAndTransport.test.ts`, `contractAlignment.test.ts`); registry 132 → 131 | Cabang masih ada; backend: rute tidak ada (D-1b) | **Tinggi** — provisioning Real mode 404 |
| P-B | **Hapus `accessMap`** (`http/mqttDynsec.ts:74,87`): kirim `access` verbatim; hapus default `'telemetry'` — bila kosong, biarkan backend memvalidasi 400 | `accessMap` masih memetakan `publish→'telemetry'` dst. | **Tinggi** — nilai yang dikirim bukan yang diminta |
| P-C | **Polling apply/rollback sampai status terminal** (`useBrokerConfig.ts:169-170` — saat ini sekali) + hormati `acknowledgeUnvalidated` | Satu kali `getBrokerConfigOperation` | Sedang |
| P-D | **B11:** kirim filter server-side + `limit` pada IAM audit (`getIamAuditDecisions(limit = 100)` — tanpa filter; backend dukung filter + limit s.d. 1000) | `http/iam.ts:298-310` | Sedang |
| P-E | **B17:** kirim filter `operatorId`/`roleId` pada user-roles/policies (setelah verifikasi dukungan backend) | Panel tidak mengirim filter | Sedang |
| P-F | **B18:** sesuaikan aturan anti-eskalasi panel (saat ini lebih ketat dari backend) | `CAPABILITY_SPECS`, `ROLE_LEVELS` (lihat gaps doc temuan panel #2) | Rendah |
| P-G | **B35:** mapper sudah kompatibel — jadikan `disabled` kanonik di komentar `mappers/system.ts:23-30` (opsional, tanpa perubahan perilaku) | Mapper menangani keduanya | Rendah |
| P-H | **B25:** verifikasi tidak ada tampilan total yang memakai `meta.count` sebagai total dataset | Tidak ada pemakaian saat ini | Rendah |
| P-I | **B20/B27:** pakai `GET /health/detail` (ADMIN+LAN) untuk data kesehatan kaya; hapus sintesis di `http/health.ts:42-52` bila endpoint tersedia | Sintesis masih ada | Info — butuh endpoint backend dulu |
| P-J | **B26:** tombol export system audit (fitur baru) — keputusan Fathur | Belum ada tombol/UI | Info |
| P-K | **Koreksi dokumen:** decision log K-03/K-09/K-11 + item rencana (1.5, 2.1/2.4, Fase 3) diperbarui ke pilihan backend | Plan masih menulis keputusan 17 Nov | Dokumen |
| P-L | **Koreksi gaps doc:** catatan B2/B5 "panel mengirim PATCH" sudah basi — E14 sudah PUT (17 Nov, sehari sebelum catatan 18 Nov ditulis dari snapshot audit) | `http/iam.ts` sudah PUT | Dokumen |

## 6. Yang masih terbuka setelah 18 Nov

| Item | Status | Catatan / rekomendasi industri |
|---|---|---|
| K-01 / D-1 | Terbuka | `current_password` vs `old_password` — kedua penamaan ada di framework besar; putuskan satu sumber kanonis, panel sudah pakai API §L |
| K-02 / D-2 | Terbuka | Bentuk `/auth/me` — panel menangani keduanya; backend cukup menetapkan salah satu |
| K-12 | Terbuka | Aturan bump `authz_version` — pola umum: naik tiap mutasi (version counter); perlu ditetapkan sebelum implementasi refresh |
| K-15 | Belum tercakup | Definisi OEE standar (§3.7); pekerjaan server ada di Fase 8 (G8/F-7) |
| SYS-B1 | Belum diputuskan | Skema body policy (`subjectMatch`, `permissionId`) |
| SYS-B3 | Sebagian | Butuh contoh `abac_condition` valid + pesan 400 yang menyebut atribut |
| SYS-B4 | Belum diputuskan | Alur `mustChangePassword` + kontrak 401 |
| SYS-B6 | Sebagian | Skema respons IAM lain (037 baru menutup `/info` + inspector) |
| SYS-B7 | Belum diputuskan | Hapus role yang masih ter-assign |
| SYS-B16 | Belum diputuskan | Lockout panel (5/30 dtk) vs rate limit server (5/60 dtk) + `Retry-After` |
| Enum `event_type` | Sebagian terjawab | `/system/audit` memfilter `event_type` persis; **daftar enum kanonik belum ditetapkan** — dropdown panel (15 nilai) masih tebakan |
| D-1b, D-3–D-7 | **Terjawab** | Lihat matriks §2 |

## 7. Catatan pull (18 Nov 2026)

- **Pull:** remote `393fb09` "Docs: catat keputusan backend System Admin 18 Nov 2026 (SYS-B8..B50)" oleh Fathur, di-cherry-pick ke lokal (`f7a4b5f`, authorship dipertahankan). Remote head sebelumnya `d056e85` (E16) adalah ancestor-nya — tidak ada konflik.
- **File yatim di remote:** `src/features/assets/MachineDetailModal.tsx` (222 baris) ada di GitHub sejak commit awal `c59db6c`, tapi **tidak ada di lokal dan tidak diimpor oleh apa pun**. Modal yang benar ada di `src/features/assets/components/MachineDetailModal.tsx` (diimpor `MachinesPage.tsx:18`). File yatim itu kemungkinan sisa snapshot-push awal yang tidak pernah terhapus (snapshot-push tidak menghapus file remote). **Usulan: hapus dari GitHub setelah persetujuan Fathur** — bukan bagian dari analisis ini, dan penghapusan remote tidak boleh dilakukan diam-diam.
- **Staleness di catatan 18 Nov sendiri:** bagian "Gap di luar lima modul" menulis B2/B5 sebagai "panel mengirim PATCH" — itu keadaan saat audit, bukan saat catatan ditulis: E14 (17 Nov) sudah mengubah panel ke PUT. Dicatat sebagai P-L di §5.

## 8. Keputusan akhir — delegasi Fathur (18 November 2026 malam)

> Fathur mendelegasikan seluruh keputusan penutupan gap ke Muse (18 Nov
> 2026 malam), dengan syarat: merujuk kebutuhan real-case, menutup gap
> backend–panel, **tanpa duplikasi flow dan tanpa flow deprecated** — satu
> alur kanonis per item. Bagian ini adalah keputusan yang berlaku;
> matriks §2 di atas adalah analisis yang mendasarinya (status "masih
> terbuka" di §2 kini kedaluwarsa untuk item di bawah).

| Item | Keputusan akhir |
|---|---|
| K-03 | **(c) Terima kedua bentuk** (mengikuti backend; keputusan 17 Nov (a) diubah) |
| K-04 | **Dual** — `issues[]` kanonis + `details` kompatibilitas; panel membaca `issues` saja |
| K-09 | **(a) Didukung + guard** (mengikuti backend; keputusan 17 Nov (b) diubah) |
| K-11 | **(a) `POST /clients`** (mengikuti backend; keputusan 17 Nov (b) diubah; panel di-revert) |
| K-01 / K-02 / K-12 / K-15 | **Tetap (a)** seperti diputuskan 17 Nov — dikonfirmasi, tidak berubah |
| B1 | **(b) Body policy camelCase kanonis + `subjectMatch` terstruktur** |
| B3 | **(a) Lanjutkan ABAC, scope minimal** |
| B4 | **(a) Dukung alur paksa `mustChangePassword`** |
| B6 | **(a) Publikasikan skema respons IAM lengkap** |
| B7 | **(a) Tolak `409 ROLE_IN_USE`** |
| B16 | **(a) Samakan ke server 5/60 + `Retry-After`** |
| Enum `event_type` | **(a) Enum tertutup (daftar dari backend)** |
| P-A–P-J | **Ya** semua (P-I tertunda sampai backend menyediakan `GET /health/detail`) |

**Aturan satu alur kanonis (mengikat implementasi berikutnya):** hapus
cabang PROVISION seluruhnya (bukan deprecated); hapus `accessMap`
seluruhnya (bukan fallback); panel membaca `issues` saja (bukan dual);
satu casing body policy (camelCase, tanpa fallback snake_case); satu
aturan lockout (server 5/60, panel tidak menegakkan paralel); satu alur
ganti-password-wajib. Tidak ada flow kedua yang dipertahankan "untuk
jaga-jaga".

**Yang masih terbuka setelah putaran ini:** tipe `operator.role` untuk
label custom, satuan `uptime`, overlap jadwal lintas tengah malam;
konfirmasi backend atas K-01/K-02/K-12; implementasi Fase 8 (K-15);
daftar enum `event_type` dari kode backend. Dicatat lengkap di AUDIT.md
§21 + Lampiran C §C.1a.

## Sumber

- Fastify — Factory (`ignoreTrailingSlash`): https://fastify.dev/docs/v5.5.x/Reference/Server/
- Mosquitto Dynamic Security — Cedalo docs: https://docs.cedalo.com/mosquitto/2.8/security/
- Mosquitto dynsec command protocol (test suite): https://docs.rs/crate/libmosquitto-sys/latest/source/mosquitto/test/broker/14-dynsec-modify-group.py
- RFC 7807 introduction (Axway): https://blog.axway.com/learning-center/apis/api-design/introduction-to-rfc-7807
- Knowify — responses & errors (`issues` array): https://developer.knowify.com/docs/guide/v2-responses-and-errors.html
- OEE formula (Sharpen): https://www.sharpenmfg.com/blog/how-to-calculate-oee-scrap-fpy
- OEE guide — ISO 22400-2 (Igromi): https://igromi.com/en/resources/view/oee-guide
- NIST SP 800-63B §5.1.1.2 (password guidelines): https://www.itkorr.com/knowledge-center/cybersecurity/password-security/nist-password-guidelines
- Azure DPS concepts: https://learn.microsoft.com/ms-my/azure/iot-dps/concepts-service
- IoT device provisioning — AWS vs Azure (Creahive): https://www.creahive.com/guides/iot-device-provisioning/
- Stripe — unrecognized parameters: https://docs.stripe.com/changelog/2011-06-21/exceptions-unrecognized-api-parameters
- API versioning & unknown fields (Postel's law): https://github.com/pawar-pratik/api-mastery/blob/HEAD/02-rest-design/11-versioning-and-evolution.md
