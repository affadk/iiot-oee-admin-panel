# Kebutuhan Backend — Mode Akses Private / Public

**Dokumen:** spesifikasi kebutuhan untuk tim backend.
**Konteks:** panel admin sudah mendukung switch mode akses di frontend
(`VITE_ACCESS_MODE`, lihat `AUDIT.md` §9 dan `src/services/api/mode.ts`),
tetapi **frontend tidak pernah menjadi penegak keamanan** — gating di panel
hanya UX/pertahanan lapis pertama. Tanpa penegakan di server, siapa pun bisa
mem-bypass panel (curl langsung ke API) dan menulis dari internet sekalipun
mode `private`. Dokumen ini adalah jawaban atas pertanyaan: **apa yang harus
disediakan backend** supaya mode Private/Public benar-benar berlaku.

> Prinsip: **server adalah otoritas final** (Guide §4.5/§4.6g — server 403
> adalah keputusan final; panel hanya memproyeksikannya).

---

## 1. Konfigurasi mode akses di sisi server

| # | Kebutuhan | Detail |
| --- | --- | --- |
| B1 | Variabel konfigurasi `ACCESS_MODE` | Nilai `private` \| `public`. **Default `private`.** Diubah lewat konfigurasi deployment (env/secret manager), BUKAN hardcoded. Perubahan mode harus tercatat (lihat B5). |
| B2 | Mode berlaku untuk SEMUA vhost/port | Satu sumber kebenaran di server — jangan ada dua flag berbeda untuk port 80 vs 8080. |
| B3 | Nilai default aman | Bila konfigurasi hilang/rusak, server jatuh ke `private` (fail-closed), bukan `public`. |

## 2. Deteksi kanal (LAN vs tunnel) yang dapat dipercaya

Panel hari ini menebak kanal dari **port** (80 = LAN, 8080 = tunnel — Guide D1).
Backend harus menentukan kanal dari sisi server, bukan dari klaim client:

| # | Kebutuhan | Detail |
| --- | --- | --- |
| B4 | Klasifikasi kanal per request | Server menentukan `channel: lan \| tunnel` dari **jalur ingress yang nyata**: vhost/port listener yang menerima koneksi, atau header tepercaya dari reverse proxy/tunnel yang dikontrol server (`X-Forwarded-For` / `X-Access-Channel` HANYA bila proxy-nya milik server — header dari client langsung TIDAK BOLEH dipercaya). |
| B5 | Kanal tidak bisa dipalsukan client | Tidak ada query param, body, atau header bebas yang bisa mengubah klasifikasi kanal. Request yang datang lewat tunnel tetap `tunnel` sekalipun membawa header `X-Access-Channel: lan`. |
| B6 | Dual-vhost dipertahankan (Guide D1) | Port 80 (LAN, akses penuh) dan port 8080 (tunnel) tetap terpisah. Di mode `private`, port 8080 melayani baca saja; di mode `public`, keduanya melayani penuh. |

## 3. Penegakan server-side (otoritatif) — INI YANG PALING PENTING

| # | Kebutuhan | Detail |
| --- | --- | --- |
| B7 | Tolak mutasi dari tunnel saat mode `private` | Semua operasi tulis — `POST`/`PUT`/`PATCH`/`DELETE` pada 132 operasi admin (termasuk `POST /auth/password/change`, ack operational event, classify downtime, trigger reconciliation, semua mutasi IAM & MQTT) — WAJIB mengembalikan **403** bila `channel=tunnel` dan `mode=private`. Tanpa pengecualian. |
| B8 | Baca tetap diizinkan dari tunnel | `GET` (termasuk ekspor & history) tetap boleh dari tunnel di kedua mode — tunnel memang dibuat untuk observasi jarak jauh. |
| B9 | Login dari tunnel mengikuti mode | `POST /auth/login` dari tunnel: diizinkan di mode `public`; di mode `private` **ditolak 403** (konsisten dengan panel — login demo pun dijaga). Alasan: sesi yang lahir dari tunnel di mode private tidak boleh ada. |
| B10 | WebSocket telemetri read-only | `GET /ws/telemetry` boleh dari kedua kanal di kedua mode, tetapi **hanya stream baca**. Tidak ada pesan tulis/aktuasi lewat WS (ADR-003). |
| B11 | Penegakan di middleware, bukan per-handler | Satu middleware otorisasi kanal yang dieksekusi SEBELUM handler bisnis, supaya endpoint baru otomatis terlindungi dan tidak ada yang lupa menambahkan guard. |
| B12 | Error envelope standar (Guide §4.3) | Penolakan memakai envelope `{error, message}` dengan `error: 'FORBIDDEN'` (atau kode khusus `FORBIDDEN_CHANNEL` bila backend membedakan), `message` berbahasa Indonesia yang sama dengan panel: `"Mode observasi — perubahan dinonaktifkan. Akses penuh tersedia dari LAN pabrik."`, `httpStatus: 403`. |

## 4. Publikasi mode + kanal ke panel

Panel harus menampilkan mode yang **benar-benar berlaku di server**, bukan
sekadar menebak dari env build-nya sendiri (env build bisa berbeda dengan
konfigurasi server):

| # | Kebutuhan | Detail |
| --- | --- | --- |
| B13 | Endpoint status akses | `GET /api/v1/system/access-mode` (atau perluasan `GET /health`) mengembalikan minimal: `{ "mode": "private" \| "public", "channel": "lan" \| "tunnel", "mutations_allowed": true \| false }`. Endpoint ini **tidak butuh auth** (atau butuh auth minimal) supaya banner panel bisa tampil benar sebelum login. |
| B14 | Sertakan di `GET /auth/me` | Respons `auth/me` menyertakan `access_mode` + `mutations_allowed` untuk sesi berjalan, supaya panel tidak perlu menebak dari port. |
| B15 | Header respons (opsional, pelengkap) | Setiap respons membawa `X-Access-Channel: lan | tunnel` dan `X-Access-Mode: private | public` untuk debugging/observabilitas. |
| B16 | Panel memakai data server bila tersedia | (Tugas frontend, sudah disiapkan: `resolveEffectiveAccess` — bila B13/B14 tersedia, panel memakai nilai server dan hanya memakai env sebagai fallback.) |

## 5. Perubahan mode oleh admin (bila diinginkan)

| # | Kebutuhan | Detail |
| --- | --- | --- |
| B17 | Endpoint ubah mode (ADMIN-only) | `PUT /api/v1/admin/access-mode` dengan body `{ "mode": "private" \| "public", "reason": "..." }`. Hanya peran ADMIN (capability `access_control.manage`). |
| B18 | Audit trail | Setiap perubahan mode menulis audit log: siapa, kapan, mode lama → baru, alasan (`reason` wajib). Perubahan mode muncul di System Audit Trail panel. |
| B19 | Perubahan berlaku segera | Tanpa restart backend bila memungkinkan (config reload); bila butuh restart, dokumentasikan. |
| B20 | Perubahan mode TIDAK membunuh sesi yang sudah berjalan | Sesi dari tunnel yang lahir saat mode `public` tetap valid sampai TTL-nya habis sekalipun mode diubah ke `private` — TETAPI mutasi berikutnya tetap ditolak 403 (penegakan per-request, B7). |

## 6. Keamanan kanal publik (wajib bila mode `public` dipakai)

| # | Kebutuhan | Detail |
| --- | --- | --- |
| B21 | TLS wajib di kanal publik | Tunnel/internet WAJIB HTTPS/WSS dengan sertifikat valid. Tanpa TLS, mode `public` tidak boleh diaktifkan (deployment menolak start atau memaksa `private`). |
| B22 | Auth tetap berlaku penuh | Mode `public` TIDAK PERNAH berarti tanpa login. JWT tetap wajib (D5: token hanya di memori, TTL 900 dtk, refresh sliding 80%). |
| B23 | Rate limiting lebih ketat di tunnel | Batas request/menit dari kanal tunnel lebih rendah dari LAN; login gagal beruntun dari tunnel memicu lockout lebih cepat. |
| B24 | Header keamanan (Guide §13) | `Content-Security-Policy`, `Strict-Transport-Security`, `X-Content-Type-Options: nosniff`, dan `Cache-Control: no-store` pada kedua vhost. |
| B25 | Log akses kanal | Setiap request mencatat kanal (`lan`/`tunnel`) di access log, supaya insiden bisa ditelusuri per kanal. |

## 7. Checklist verifikasi (untuk tim backend + QA)

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

## Ringkasan satu paragraf

Backend harus punya **satu flag `ACCESS_MODE` (default `private`, fail-closed)**,
**klasifikasi kanal yang tidak bisa dipalsukan client**, **middleware yang
menolak semua mutasi dari tunnel saat `private` (403, envelope standar)**,
**endpoint yang mempublikasikan mode + kanal ke panel**, dan **(bila mode
`public` dipakai) TLS + auth penuh + rate limit lebih ketat di kanal publik**.
Panel sudah siap di sisi frontend; tanpa B7 + B11, switch di panel hanyalah
kosmetik.
