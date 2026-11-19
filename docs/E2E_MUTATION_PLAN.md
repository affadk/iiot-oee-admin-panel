# Rencana Uji Mutasi End-to-End — Panel Admin IIoT OEE

> **Status:** DRAF — belum dieksekusi, belum di-commit.
> **Panel live:** https://iiot-oee-admin-panel.vercel.app · **Backend live:** https://oee.fadik.web.id
> **Sumber pemetaan (baca kode saja, tanpa browser/login/API):**
> - `~/workspace/tmp-e2e-mut-master.md` — mutasi master data + WO + ack + downtime + reconciliation
> - `~/workspace/tmp-e2e-mut-iam.md` — mutasi IAM + DynSec + Config
> **Bila dokumen ini bertentangan dengan kedua file scratch di atas, isi FILE SCRATCH yang menang.**

---

## 1. Konteks + asumsi

### 1.1 Tujuan

Menguji semua mutasi panel yang **aman dan dapat diuji lewat UI** dalam satu sesi browser
berurutan, dengan data uji bernama jelas, lalu membersihkan semua data uji. Mutasi berbahaya
dan mutasi tanpa UI **tidak diuji** (lihat §4).

### 1.2 Asumsi yang harus diverifikasi agen browser di awal (Langkah 1–2)

1. Panel live di Vercel dan backend live di `oee.fadik.web.id`.
2. **Izin tulis Fathur** sudah diberikan untuk sesi uji ini — semua mutasi di bawah mengubah
   data live (meski hanya data uji bernama `E2E-TEST-*`).
3. Login sebagai **ADM-001** (kredensial dari Secure Vault), station **ADMIN-CONSOLE-01**.
   ADM-001 diasumsikan memiliki semua capability tulis (`device.manage`, `machine.create`,
   `product.manage`, `operator.create/update/password.rotate/status.update`,
   `work_order.cancel`, `operational_event.ack`, `downtime_event.label`,
   `telemetry.refresh`, `access_control.manage`, `mqtt.dynsec.manage`,
   `mqtt.config.manage`). Bila ada tombol yang `disabled`/halaman terkunci, catat —
   jangan diasumsikan.
4. **Mode akses server `private` + ingress tunnel (Vercel).** Dari Vercel, panel berjalan
   lewat tunnel, bukan LAN pabrik.

### 1.3 Gerbang global — `assertLanForMutation()` (berlaku untuk SEMUA mutasi)

- Setiap mutasi HTTP memanggil `assertLanForMutation()` di awal
  (`src/services/api/http/transport.ts:155-170`). Bila `resolveEffectiveAccess(networkMode).canMutate`
  bernilai `false`, klien **melempar `ApiError` `FORBIDDEN` 403 DI SISI KLIEN sebelum request
  dikirim**. Dari Vercel (tunnel) gerbang ini kemungkinan menutup semua mutasi sebelum mencapai
  gerbang tunnel server.
- **Pengecualian:** WO Resolve (§5a di scratch master) adalah GET read-only dan **tidak**
  melewati gerbang ini.
- **Klasifikasi error yang wajib dicatat di tiap kegagalan:**
  | Jenis | Ciri | Cara membedakan |
  |---|---|---|
  | 403 klien (`assertLanForMutation`) | Error dilempar sebelum request; pesan membawa `effective.reason` | Catat teks `effective.reason` persis |
  | 403 gerbang tunnel server | Request terkirim, server menolak (mode `private`) | Pesan dari server, bukan dari guard klien |
  | 400 validasi | Pesan validasi klien/server (mis. regex, panjang field, `startWindow <= endWindow`) | Catat pesan validasi persis |
  | 401 | Sesi berakhir (mis. `authz_version` naik akibat mutasi IAM) | Login ulang, lanjutkan dari langkah berikutnya |
  | 409 | Konflik bisnis (`ROLE_IN_USE`, `DEVICE_ALREADY_REVOKED`, `MACHINE_ALREADY_BOUND`, dsb.) | Catat kode konflik persis |
  | 5xx / timeout | `MUTATION_TIMEOUT_MS`, `retry: false` — gagal sekali, tidak diulang otomatis | Catat kode + pesan |
- **Aturan berhenti (stop rule):** bila Langkah 3 (provision device) gagal dengan **403 klien**,
  coba **satu** mutasi lain dari domain berbeda sebagai probe kedua — Langkah 44
  (reconciliation refresh, idempotent, body `{}`). Bila itu juga 403 klien, **hentikan semua
  mutasi**, kerjakan hanya langkah baca (Langkah 2, 23, 39, 41), lewati cleanup (tidak ada
  data uji yang tercipta), dan laporkan temuan gerbang ke Fathur. Gerbang yang menutup semua
  mutasi adalah **temuan tersendiri, bukan kegagalan rencana uji**.

### 1.4 Data uji bernama jelas (dipakai di seluruh skrip)

| Objek | Nama uji |
|---|---|
| Device (provision) | `STM32-OEE-TEST01` |
| Device (register legacy) | `STM32-OEE-TEST02` |
| Machine | `CNC-TEST-E2E-01` |
| Product | `PROD-TEST-E2E-01` |
| Operator | `TST-E2E-01` |
| Role IAM | `TEST-E2E-ROLE` |
| Role DynSec | `E2E-TEST-ROLE` |
| MQTT client DynSec | `e2e-test-client` |
| Group DynSec | `E2E-TEST-GROUP` |
| Work order (cancel) | `WO-SIM-20260906-02` (PENDING, 600 pcs, WO simulasi dari tes E2E — **bukan WO-001**) |

**JANGAN sentuh:** WO-001, ADM-001 (password/role/status), role ADMIN, data asli non-test
apa pun. Sebelum setiap klik hapus, baca ulang nama barisnya — tombol hapus DynSec
**tanpa dialog konfirmasi**.

### 1.5 Kata sandi uji

Semua kata sandi uji (password awal operator, password MQTT client, rotasi password)
**tidak ditulis di dokumen ini**. Agen browser memakai kata sandi kuat 8–128 karakter
yang dibuat saat sesi berjalan dan menyimpannya **di luar dokumen ini** (catatan pribadi /
vault), bukan di laporan uji publik. Pola yang disarankan: `E2eTest-<acak>-2026!`.

### 1.6 Konvensi pencatatan per langkah

Untuk tiap langkah catat: (a) hasil (sukses/gagal), (b) bila sukses — teks banner/pesan
persis + perubahan yang terlihat di tabel, (c) bila gagal — klasifikasi error sesuai §1.3
+ pesan persis + langkah yang dilewati sebagai konsekuensinya. Langkah yang gagal karena
gerbang 403 **tidak boleh** dilewati diam-diam — catat dan lanjutkan ke langkah yang tidak
bergantung padanya.

---

## 2. Skrip browser berurutan (45 langkah)

> Rute kanonis: `/admin/devices`, `/admin/machines`, `/admin/products`,
> `/admin/operators`, `/admin/work-orders` (alias `/work-orders`), `/audit`,
> `/downtime`, `/admin/reconciliation`, `/admin/access-control`,
> `/admin/mqtt/security`, `/admin/mqtt/configuration`.
> Rute top-level `/devices` dsb. **TIDAK ADA** (redirect ke `/admin`).
> Sukses umum: banner hijau/merah di atas tabel halaman (`role="status"`/`role="alert"`,
> ada tombol ✕) — kecuali dinyatakan lain per langkah.

### Fase 0 — Login & inventaris

**Langkah 1 — Login ADM-001.**
- Halaman: halaman login panel.
- Aksi: login sebagai `ADM-001` dengan kredensial dari Secure Vault; station
  `ADMIN-CONSOLE-01` bila diminta.
- Sukses yang diharapkan: masuk ke dashboard; badge topbar menampilkan
  `API Mode: Real` dan `Mode Akses: Private`.
- Bila gagal: catat pesan error persis (401 kredensial vs 403 gerbang vs error lain) dan
  **berhenti** — tidak ada langkah berikut yang bisa jalan tanpa sesi.

**Langkah 2 — Inventaris awal (baca saja, tanpa mutasi).** Catat semua nilai ini sebelum
mutasi apa pun — dipakai sebagai pembanding di langkah berikut dan cleanup.
- `/admin/work-orders`: pastikan `WO-SIM-20260906-02` masih berstatus **PENDING** (atau
  ACTIVE). Catat `machine_id`-nya dan apakah mesin tersebut sudah terikat device
  (dibutuhkan Langkah 41). Bila WO ini sudah COMPLETED/ABORTED, **Langkah 41 dan 45
  tidak dapat diuji** — catat dan lewati keduanya.
- `/audit`: filter `UNACK`, pilih satu event lama yang belum di-ack. Catat `id`,
  `event_type`, dan `machine_name`-nya (untuk Langkah 42).
- `/downtime` tab **Riwayat**: hitung event historis dan berapa yang `unlabeled`.
  Pilih (a) satu event **sudah berlabel** untuk uji overwrite (catat kategori + alasan
  lamanya — untuk dikembalikan di C1) dan (b) bila ada, satu event `unlabeled` untuk
  uji label (catat: label ini **permanen**, tidak bisa dikembalikan ke unlabeled).
  Bila riwayat kosong, Langkah 43 tidak dapat diuji — catat.
- `/admin/mqtt/configuration` tab **Editor & Simpan Draf**: catat nilai awal
  `Max Queued Messages` dan `Autosave Interval`; catat badge header
  (`runtime.mode`, `lastAppliedVersionId`, `Terkunci` bila `lock.held`).
  Bila `lock.held` = true, **jangan** stage (Langkah 38) — catat dan lewati 38–40.
- `/admin/access-control` tab Roles: catat apakah `TEST-E2E-ROLE` sudah ada dari sesi
  sebelumnya (bila ya, catat sebagai SISA lama dan lanjutkan dengan nama itu — jangan
  buat duplikat).

### Fase 1 — Master data (device → machine → product → operator)

**Langkah 3 — Provision device `STM32-OEE-TEST01`.**
- Halaman: `/admin/devices`. Aksi: tombol header **"Provision Device"** → modal
  **"Provision Edge Device"**.
- Isi: `Device ID` = `STM32-OEE-TEST01` (default terisi `STM32-OEE-06` — **wajib diganti**;
  regex klien `/^STM32-[A-Za-z0-9_-]{1,31}$/`); `Machine ID (Opsional)` dikosongkan;
  `Model (Opsional)` biarkan default `STM32H723-W5500`. Klik **"Provision Perangkat"**.
- Sukses yang diharapkan: banner hijau *"Perangkat edge STM32-OEE-TEST01 berhasil
  di-provision (PROVISIONED). Salin kredensial sekali tampil sebelum menutup dialog."*
  + modal sekali-tampil `DeviceCredentialModal` berisi **Username / Password / Client ID /
  Topic Prefix** + tombol **"Salin"** per field. **Salin dan simpan kredensial sebelum
  menutup dialog** — password hanya tampil sekali. Baris baru di tabel: badge
  `PROVISIONED`, kolom mesin `Unbound`.
- Bila gagal: catat pesan/kode persis — 409 `DEVICE_ALREADY_REGISTERED` /
  `DEVICE_ID_HAS_HISTORY` / `MACHINE_ALREADY_BOUND` / `MQTT_CLIENT_EXISTS`,
  500 `PROVISION_ROLLED_BACK`, 502 `MQTT_PROVISION_FAILED`, 503 `MQTT_UNAVAILABLE`,
  atau 403 (klasifikasikan sesuai §1.3). Bila gagal, Langkah 5–7, 14–15 dilewati;
  lanjutkan ke Langkah 8.

**Langkah 4 — Register legacy device `STM32-OEE-TEST02`.**
- Halaman: `/admin/devices`. Aksi: tombol header **"Registrasi Edge Device (Legacy)"** →
  modal **"Registrasi Edge Controller STM32 Baru (Legacy)"**.
- Isi: `Device ID` = `STM32-OEE-TEST02`; `MAC Address` dikosongkan; `IP Address`
  dikosongkan; `Firmware Version` biarkan default `v2.4.1-rtos`. Klik
  **"Daftarkan Perangkat (Legacy)"**.
- Sukses yang diharapkan: banner *"Perangkat edge STM32-OEE-TEST02 berhasil diregistrasi."*;
  baris baru badge status default `ACTIVE` (bukan PROVISIONED). Perangkat legacy tidak
  punya kredensial — revoke/rotate tidak relevan untuknya.
- Bila gagal: catat pesan persis; cleanup-nya tetap Langkah C10 bila baris tercipta.

**Langkah 5 — Create machine `CNC-TEST-E2E-01`.**
- Halaman: `/admin/machines`. Aksi: tombol header **"Tambah Mesin"** → modal
  **"Tambah Mesin Produksi Baru"**.
- Isi: `Machine ID` = `CNC-TEST-E2E-01` (regex `/^CNC-[A-Z0-9_-]{3,32}$/`, input
  di-uppercase otomatis; default `CNC-MILLING-03` — ganti); `Nama Mesin` =
  `Mesin Uji E2E`; `Modbus Slave ID (1–247)` = `1`; `Lini Produksi` = `LINE-01`;
  `Bind Edge Device Awal (Opsional)` dikosongkan (bind dilakukan di Langkah 6).
  Klik **"Buat Mesin"**.
- Sukses yang diharapkan: banner *"Mesin CNC-TEST-E2E-01 (Mesin Uji E2E) berhasil dibuat."*
- Bila gagal: catat pesan persis; Langkah 6, 12, C7–C8 dilewati.

**Langkah 6 — Bind device `STM32-OEE-TEST01` → machine `CNC-TEST-E2E-01`.**
- Halaman: `/admin/machines`. Aksi: baris mesin unbound → tombol **"Bind Device"** →
  modal **"Pasang Perangkat Sensor ke CNC-TEST-E2E-01"** → dropdown
  **"Pilih STM32 Edge Controller (Unbound)"** pilih `STM32-OEE-TEST01` → tombol
  **"Lanjut Konfirmasi Bind"** → dialog **"Konfirmasi Binding STM32-OEE-TEST01 →
  CNC-TEST-E2E-01?"** → tombol **"Ya, Ikatkan Perangkat"**.
- Sukses yang diharapkan: banner *"Edge device STM32-OEE-TEST01 berhasil diikatkan ke
  CNC-TEST-E2E-01."*; badge mesin berubah Bound; device hilang dari daftar unbound.
- Bila gagal: 409 `MACHINE_ALREADY_BOUND` → banner error + tombol **"Unbind Dulu"**
  (catat bila muncul); catat pesan persis lainnya.

**Langkah 7 — Update device `STM32-OEE-TEST01` (IP + firmware).**
- Halaman: `/admin/devices`. Aksi: baris device → ikon pensil (tombol Edit,
  `title="Ubah IP / Firmware"`) → modal **"Edit Perangkat STM32-OEE-TEST01"**.
- Isi: `IP Address` = `192.168.1.201`; `Firmware Version` = `v9.9.9-e2e`
  (maks 50 karakter). Device ID & MAC tampil disabled/read-only (immutable).
  Klik **"Simpan"**. (Field yang dikosongkan di-omit, bukan null — jangan kirim null.)
- Sukses yang diharapkan: banner *"Konfigurasi perangkat STM32-OEE-TEST01 diperbarui."*;
  nilai baru terlihat di tabel/detail.
- Bila gagal: catat pesan persis (400 bila IP tidak valid / firmware > 50 karakter).

**Langkah 8 — Create product `PROD-TEST-E2E-01`.**
- Halaman: `/admin/products`. Aksi: tombol header **"Tambah Produk"** → modal
  **"Tambah Produk Baru"**.
- Isi: `Product ID` = `PROD-TEST-E2E-01` (regex `/^[A-Z0-9_-]{3,32}$/`, di-uppercase
  otomatis; default form `PRD-` — ganti); `SKU Code` = `SKU-E2E-TEST-01` (opsional);
  `Nama Produk` = `Produk Uji E2E`; `Ideal Cycle Time (Detik / pcs)` = `30`
  (wajib > 0 dan ≤ 9999); checkbox **"Produk aktif dan tersedia untuk jadwal produksi"**
  biarkan tercentang. Klik **"Buat Produk"**.
- ⚠️ **Perangkap UI:** body yang dikirim hanya `{productId, productName,
  stdCycleTimeSec}` — `sku` dan `active` **TIDAK dikirim** meski ada di form.
  Verifikasi sukses hanya dari nama + cycle time di baris tabel.
- Sukses yang diharapkan: banner *"Produk PROD-TEST-E2E-01 (Produk Uji E2E) berhasil
  dibuat."*; baris baru muncul di atas tabel.
- Bila gagal: catat pesan persis; Langkah 9, C11 dilewati.

**Langkah 9 — Update product `PROD-TEST-E2E-01`.**
- Halaman: `/admin/products`. Aksi: baris produk → tombol **"Edit"** → modal
  **"Edit Produk PROD-TEST-E2E-01"**.
- Isi: `Nama Produk` = `Produk Uji E2E v2`; `Ideal Cycle Time` = `45`.
  (Product ID tidak bisa diubah. Perubahan SKU/status aktif di form **TIDAK dikirim** —
  jangan verifikasi keduanya.) Klik **"Simpan Perubahan"**.
- Sukses yang diharapkan: banner *"Produk PROD-TEST-E2E-01 berhasil diperbarui."*;
  baris tabel ter-update in-place (nama + cycle time saja).
- Bila gagal: catat pesan persis.

**Langkah 10 — Create operator `TST-E2E-01`.**
- Halaman: `/admin/operators`. Aksi: tombol header **"Tambah Operator"** → modal
  **"Tambah Akun Operator Baru"**.
- Isi: `Operator ID` = `TST-E2E-01` (regex `/^[A-Z0-9_-]{3,32}$/`); `Nama Lengkap` =
  `Operator Uji E2E`; `Peran Awal` = `UNASSIGNED`; `Line ID` = `LINE-01`;
  `Password Awal (8–128 karakter)` = kata sandi uji (lihat §1.5). Klik tombol submit
  modal.
- Sukses yang diharapkan: banner *"Akun operator TST-E2E-01 (UNASSIGNED) berhasil dibuat."*
- Bila gagal: catat pesan persis; Langkah 11–13, 22, C12 dilewati.

**Langkah 11 — Update operator `TST-E2E-01`.**
- Halaman: `/admin/operators`. Aksi: baris operator → tombol **"Edit"** → modal edit.
- Isi: `Nama Lengkap` = `Operator Uji E2E v2`; `Peran Sistem (Primary Role)` biarkan
  `UNASSIGNED`; `Line ID` = `LINE-01`. Klik **"Simpan Perubahan"**.
- Sukses yang diharapkan: banner *"Profil operator TST-E2E-01 berhasil diperbarui."*
- Bila gagal: catat pesan persis. (Catatan: update memanggil `refreshCapabilities()`
  bila role diubah — di sini role tidak diubah.)

**Langkah 12 — Status toggle operator `TST-E2E-01` (Suspend → Activate).**
- Halaman: `/admin/operators`. Aksi: baris operator → tombol **"Suspend"**; tunggu badge
  berubah; lalu tombol **"Activate"**.
- Sukses yang diharapkan (tiap toggle): banner *"Status TST-E2E-01 diubah menjadi
  ACTIVE / SUSPENDED."*; badge baris berubah `ACTIVE` (hijau) ↔ `SUSPENDED` (merah).
  Akhiri dalam keadaan **ACTIVE**.
- Bila gagal: catat pesan persis. **Jangan** tekan Suspend/Activate pada `ADM-001`
  (tombol dinonaktifkan untuk operator terproteksi).

**Langkah 13 — Rotasi password operator `TST-E2E-01`.**
- Halaman: `/admin/operators`. Aksi: baris operator → tombol **"Password"** (ikon
  KeyRound) → modal **"Rotasi Password TST-E2E-01"**.
- Isi: `Password Baru (8–128 karakter)` = kata sandi uji baru (lihat §1.5; di luar
  8–128 → error klien *"Password baru wajib 8–128 karakter."*). Klik
  **"Simpan Password Baru"**.
- Sukses yang diharapkan: banner berisi `res.message` dari server (fallback klien:
  *"Password untuk TST-E2E-01 berhasil dirotasi."*). Tidak ada verifikasi login ulang di UI.
- Bila gagal: catat pesan persis. **Jangan** rotasi password `ADM-001` (lihat §4, D-3).

**Langkah 14 — Rotasi kredensial device `STM32-OEE-TEST01`.**
- Halaman: `/admin/devices`. Aksi: baris device → tombol **"Detail"** →
  `DeviceDetailModal`, seksi **"Rotasi Kredensial (§E.3c)"**.
- Isi: `Alasan` wajib 1–200 karakter, isi `E2E-TEST rotasi kredensial uji mutasi`;
  checkbox `force` **jangan** dicentang (device tidak sedang produksi / tidak ada WO
  ACTIVE). Klik **"Rotasi Kredensial"**.
- Sukses yang diharapkan: pesan hijau di dalam modal *"Kredensial STM32-OEE-TEST01
  dirotasi. Salin kredensial baru sebelum menutup dialog."* + modal sekali-tampil
  (`DeviceCredentialModal`) — **salin kredensial baru sebelum menutup**; kolom tabel
  `Rot: <tanggal>` terisi.
- Bila gagal: 409 `DEVICE_IN_PRODUCTION` (tanpa `force`) atau 409 `DEVICE_REVOKED` —
  catat kode persis. Lakukan **sebelum** Langkah 15 (revoke membuat rotate mustahil).

**Langkah 15 — Revoke kredensial device `STM32-OEE-TEST01`.**
- Halaman: `/admin/devices`. Aksi: baris device → tombol **"Detail"** →
  `DeviceDetailModal`, seksi **"Cabut Kredensial (§E.3b)"**.
- Isi: `Alasan` wajib 1–200 karakter, isi `E2E-TEST revoke kredensial uji mutasi`.
  Klik **"Cabut Kredensial"**.
- Sukses yang diharapkan: pesan hijau di dalam modal *"Kredensial STM32-OEE-TEST01
  dicabut (REVOKED). Baris registry dan histori dipertahankan."* + reload detail →
  badge enrollment berubah ke `REVOKED`.
- ⚠️ **Irreversibel** — rotate pada device REVOKED → 409 `DEVICE_REVOKED`; satu-satunya
  "cleanup" adalah hapus device (Langkah C9). Dilakukan terakhir untuk device uji.
- Bila gagal: 409 `DEVICE_ALREADY_REVOKED` — catat; lanjutkan ke C9.

### Fase 2 — IAM (Access Control)

> Setiap mutasi IAM sukses menampilkan banner hijau + advisory
> *"Pembaruan kebijakan menaikkan authz_version ke #N — sesi lain dengan token lama akan
> berakhir (401) dan perlu login ulang."* — **kecuali** update role (Langkah 17).
> Bila sesi berakhir 401 di tengah fase ini, **login ulang sebagai ADM-001** dan lanjutkan
> dari langkah berikutnya; catat 401 itu sebagai efek samping yang diharapkan, bukan bug.

**Langkah 16 — Create role IAM `TEST-E2E-ROLE`.**
- Halaman: `/admin/access-control`, tab **Roles**. Aksi: tombol **"Custom Role"**
  (ikon `+`) → modal **"Buat Custom Role Baru"**.
- Isi: `Role Name` = `TEST-E2E-ROLE` (di-`toUpperCase()` otomatis; regex
  `/^[A-Za-z][A-Za-z0-9_-]{1,63}$/`, panjang 2–64); `Deskripsi` =
  `Role uji E2E untuk uji mutasi panel` (wajib 3–256 karakter). Klik **"Simpan Role"**.
- Sukses yang diharapkan: modal menutup; banner hijau `Custom role "TEST-E2E-ROLE"
  berhasil dibuat.` + advisory authz_version; kartu role baru muncul di grid
  (badge `Custom Role`, tanpa badge `System`).
- Bila gagal: catat pesan persis; Langkah 17–28 dilewati.

**Langkah 17 — Update role `TEST-E2E-ROLE` (hanya deskripsi).**
- Halaman: `/admin/access-control`, tab Roles. Aksi: kartu role → tombol **"Edit"**
  (ikon pensil) → modal **`Edit Role TEST-E2E-ROLE`**.
- Isi: `Deskripsi` = `Role uji E2E untuk uji mutasi panel v2` (3–256 karakter; nama
  TIDAK bisa diubah — tidak ada field nama). Klik **"Simpan Perubahan"**.
- Sukses yang diharapkan: modal menutup; banner `Role "TEST-E2E-ROLE" berhasil
  diperbarui.` (**tanpa** advisory authz_version); deskripsi baru tampil di kartu.
- Bila gagal: catat pesan persis.

**Langkah 18 — Create policy (ALLOW, pattern sempit).**
- Halaman: `/admin/access-control`, tab **Aturan Kebijakan**. Aksi: tombol
  **"Tambah Aturan"** → modal **"Tambah Aturan Kebijakan Baru"**.
- Isi: `Permission (Katalog)` = pilih permission non-reserved, mis.
  `read:telemetry` (atau permission `telemetry` apa pun yang tersedia — catat yang
  dipilih; action tidak bisa diisi bebas); `Role` = `TEST-E2E-ROLE`;
  `Jenis Aturan` = `ALLOW`; `Resource Pattern` = `telemetry:E2E-TEST-*`;
  `Syarat Kondisi Tambahan (Opsional)` dikosongkan (ABAC kosong = null).
  Klik **"Simpan Aturan"**.
- Sukses yang diharapkan: modal menutup; banner `Policy ALLOW untuk TEST-E2E-ROLE
  berhasil ditambahkan.` + advisory authz_version; baris baru di tabel Policies
  (Status `ACTIVE`). **Catat `policy-id` dari baris baru** (dibutuhkan Langkah 19–20, 27).
- Bila gagal: catat pesan persis; Langkah 19–20, 27 dilewati (tetap lanjutkan 21–22,
  25–26, 28).

**Langkah 19 — Toggle policy Disable → Enable.**
- Halaman: `/admin/access-control`, tab Aturan Kebijakan. Aksi: baris policy dari
  Langkah 18 → tombol **"Disable"**; tunggu badge berubah; lalu tombol **"Enable"**.
- Sukses yang diharapkan (tiap toggle): banner `Status policy <id> diubah menjadi
  ACTIVE/DISABLED.` + advisory; badge Status berubah `ACTIVE` ↔ `DISABLED`.
  Akhiri dalam keadaan **ACTIVE**.
- Bila gagal: catat pesan persis.

**Langkah 20 — Update policy (ubah pattern, lalu kembalikan).**
- Halaman: `/admin/access-control`, tab Aturan Kebijakan. Aksi: baris policy → tombol
  **"Edit"** (ikon pensil) → modal **`Edit Aturan <policy-id>`**.
- Isi: `Resource Pattern` = `telemetry:E2E-TEST-v2-*` (action/permission tidak bisa
  diubah — field disabled); `Jenis Aturan` biarkan `ALLOW`; ABAC dikosongkan.
  Klik **"Simpan Perubahan"**. Verifikasi pattern baru di baris; lalu ulangi Edit dan
  kembalikan pattern ke `telemetry:E2E-TEST-*`.
- Sukses yang diharapkan (tiap simpan): banner `Policy <id> berhasil diperbarui.` +
  advisory; nilai baru tampil di baris.
- Bila gagal: catat pesan persis.

**Langkah 21 — Bind permission ke role `TEST-E2E-ROLE` (Jalur A).**
- Halaman: `/admin/access-control`, tab Roles. Aksi: kartu role → tombol
  **"Assign Perm"** → modal **"Assign Permission ke Role …"**.
- Isi: `Target Role` = `TEST-E2E-ROLE` (terkunci); `Permission Sistem (Fixed Catalog)` =
  pilih permission non-reserved lain yang tersedia (mis. `read:telemetry` bila belum
  dipakai Langkah 18, atau permission non-reserved lain — catat yang dipilih; opsi
  `(DIBLOKIR - RESERVED)` tidak bisa dipilih); `Effect` = `ALLOW`;
  `Resource Pattern` = `telemetry:E2E-TEST-*` (bukan `*` — wildcard dilarang untuk
  custom role); ABAC dikosongkan. Klik **"Assign Permission"**.
- Sukses yang diharapkan: modal menutup; banner `Permission <action>:<resourceType>
  (ALLOW · telemetry:E2E-TEST-*) berhasil di-assign ke role TEST-E2E-ROLE.` + advisory;
  chip permission muncul di kartu role dan baris policy muncul di tab Policies.
- Bila gagal: catat pesan persis. Guard klien yang mungkin muncul (banner error tanpa
  request): permission reserved untuk custom role; `DENY` pada `ADMIN`; pattern `*` /
  `org:*` pada custom role — catat pesan guard-nya bila terpicu.

**Langkah 22 — Assign role `TEST-E2E-ROLE` ke operator `TST-E2E-01`.**
- Halaman: `/admin/access-control`, tab **User Assignments**. Aksi: tombol
  **"Assign User Role"** → modal **"Tetapkan Peran ke Operator"**.
- Isi: `Operator` = `TST-E2E-01` (dropdown `operator_id · nama (role)`); `Role` =
  `TEST-E2E-ROLE` (**wajib diganti** — default `SUPERVISOR`); `Scope Type` =
  `ORGANIZATION` (default; `Scope ID` tidak muncul untuk ORGANIZATION).
  Klik **"Simpan Assignment"**.
- Sukses yang diharapkan: modal menutup; banner `Role TEST-E2E-ROLE berhasil di-assign
  ke TST-E2E-01.` + advisory; baris baru di tabel Assignments (badge role, scope
  `ORGANIZATION (Global Plant)`, badge `Efektif`).
- Bila gagal: catat pesan persis. **Jangan** assign role apa pun ke `ADM-001`.

**Langkah 23 — Verifikasi baca: Inspector untuk `TST-E2E-01` (read-only).**
- Halaman: `/admin/access-control`, tab **Pemeriksa Izin Pengguna**. Aksi: periksa
  effective-permissions untuk operator `TST-E2E-01`.
- Sukses yang diharapkan: permission dari Langkah 18/21 terlihat efektif untuk operator
  tersebut (atau tercatat bila belum efektif — catat apa adanya).
- Ini langkah baca — tidak ada mutasi.

**Langkah 24 — Guard probe: coba hapus role saat masih ter-assign (harapkan 409).**
- Halaman: `/admin/access-control`, tab Roles. Aksi: kartu `TEST-E2E-ROLE` → tombol
  hapus (ikon tempat sampah) → dialog **`Hapus Custom Role TEST-E2E-ROLE?`** →
  tombol **"Ya, Hapus Role"**.
- Hasil yang diharapkan: **gagal 409 `ROLE_IN_USE`** (role masih ditugaskan ke operator)
  — ini hasil uji yang valid untuk guard ini. Catat pesan error persis
  (ConflictDialog dan/atau banner).
- Bila ternyata sukses (role terhapus): catat sebagai penyimpangan dari guard yang
  didokumentasikan — lanjutkan ke Langkah 28 (role sudah terhapus; Langkah 25–27
  dilewati, policy/permission terkait ikut terhapus bersama role).

**Langkah 25 — Revoke assignment `TEST-E2E-ROLE` dari `TST-E2E-01`.**
- Halaman: `/admin/access-control`, tab User Assignments. Aksi: baris assignment →
  tombol **"Revoke"** → dialog **`Cabut Role TEST-E2E-ROLE dari TST-E2E-01?`** →
  tombol **"Ya, Cabut Assignment"**.
- Sukses yang diharapkan: banner `Assignment TEST-E2E-ROLE pada TST-E2E-01 berhasil
  dicabut.` + advisory; baris hilang dari tabel.
- Bila gagal: catat pesan persis. (Mengulang revoke yang sama = idempoten,
  `200 {success:true, removed:0}` — bukan 404.)

**Langkah 26 — Unbind permission dari role (chip ×).**
- Halaman: `/admin/access-control`, tab Roles. Aksi: kartu `TEST-E2E-ROLE` → chip
  permission dari Langkah 21 → tombol **`×`** (`aria-label="Lepas permission …"`) →
  dialog **`Cabut Permission <label>?`** → tombol **"Ya, Cabut Permission"**.
- Sukses yang diharapkan: banner `Permission "<label>" dilepas dari role
  TEST-E2E-ROLE.` + advisory; chip hilang dari kartu; baris policy terkait hilang
  dari tab Policies.
- Bila gagal: catat pesan persis.

**Langkah 27 — Delete policy (dari Langkah 18).**
- Halaman: `/admin/access-control`, tab Aturan Kebijakan. Aksi: baris policy →
  tombol hapus (ikon tempat sampah) → dialog **`Hapus Policy <id>?`** → tombol
  **"Ya, Hapus Policy"**.
- Sukses yang diharapkan: banner `Policy <id> dihapus.` + advisory; baris hilang.
- Bila gagal: catat pesan persis.

**Langkah 28 — Delete role `TEST-E2E-ROLE`.**
- Halaman: `/admin/access-control`, tab Roles. Aksi: kartu role → tombol hapus →
  dialog **`Hapus Custom Role TEST-E2E-ROLE?`** → tombol **"Ya, Hapus Role"**.
- Sukses yang diharapkan: dialog menutup; banner `Role "TEST-E2E-ROLE" berhasil
  dihapus.` + advisory; kartu hilang dari grid.
- Prasyarat: Langkah 25–27 sudah sukses (assignment/policy/permission dicabut dulu);
  bila belum, harapkan 409 `ROLE_IN_USE` — catat dan selesaikan 25–27 dulu.
- Bila gagal: catat pesan persis dan catat role sebagai **SISA** (lihat C13).

### Fase 3 — Dynamic Security (MQTT)

> ⚠️ **Semua tombol hapus/lepas DynSec TANPA dialog konfirmasi** — klik langsung
> mengeksekusi. Sebelum setiap klik, baca ulang nama barisnya. Hanya sentuh objek
> bernama `E2E-TEST-*` / `e2e-test-client`.
> Beberapa aksi DynSec **tanpa banner sukses** — sukses hanya terlihat dari perubahan
> list (lihat tiap langkah).

**Langkah 29 — Create DynSec role `E2E-TEST-ROLE`.**
- Halaman: `/admin/mqtt/security`, tab **Roles & ACLs**. Aksi: tombol header
  **"Create MQTT Role"** → modal **"Buat MQTT Role Baru"**.
- Isi: `Role Name` = `E2E-TEST-ROLE`; `Deskripsi` = `Role MQTT uji E2E`
  (opsional). Klik **"Simpan Role"**. (Role baru selalu dibuat dengan `acls: []`.)
- Sukses yang diharapkan: modal menutup, field dibersihkan; **tidak ada banner sukses**;
  kartu role baru muncul di grid dengan teks *"Belum ada aturan topik komunikasi
  (akses dibatasi secara bawaan)."*
- Bila gagal: catat pesan persis; Langkah 30, 32, 37, C2–C3, C5 dilewati.

**Langkah 30 — Add ACL ke role `E2E-TEST-ROLE`.**
- Halaman: `/admin/mqtt/security`, tab Roles & ACLs. Aksi: kartu role → tombol
  **"+ ACL"** → modal **`Tambah ACL untuk Role E2E-TEST-ROLE`**.
- Isi: `ACL Type` = `publishClientSend` (default); `Topic Pattern` = `e2e/test/#`
  (default `oee/edge/+/telemetry` — ganti; jangan pakai topik produksi);
  checkbox `ALLOW` biarkan tercentang. Klik **"Tambah ACL"**.
- Sukses yang diharapkan: modal menutup; **tanpa banner sukses**; baris ACL baru tampil
  (`ALLOW` hijau + `publishClientSend` + `e2e/test/#`).
- Bila gagal: catat pesan persis.

**Langkah 31 — Create MQTT client `e2e-test-client`.**
- Halaman: `/admin/mqtt/security`, tab **Clients**. Aksi: tombol header
  **"Create MQTT Client"** → modal **"Buat Akun Akses MQTT Baru"**.
- Isi: `MQTT Username` = `e2e-test-client`; `Kata Sandi (wajib, minimal 8 karakter)` =
  kata sandi uji (8–128 karakter, lihat §1.5); `Roles (Min. 1)` — centang
  `E2E-TEST-ROLE` (bila tersedia; bila tidak, centang satu role yang ada dan catat
  yang dipakai — default tercentang `edge_publisher` bila ada). Klik **"Buat Client"**.
- Sukses yang diharapkan: modal menutup; **bila server mengembalikan
  `generatedPassword`**, muncul modal sekali-tampil **"Kata Sandi Akses Sekali Tampil"**
  berisi secret + tombol **"Salin"** dan **"Tutup & Hapus dari Layar"** — **salin secret
  sebelum menutup** (di-wipe saat ditutup, tidak bisa dilihat lagi). Bila tidak ada
  generated password, banner hijau `MQTT Client "e2e-test-client" berhasil dibuat.`
  Baris baru tampil dengan badge `ENABLED` dan chip role.
- Bila gagal: catat pesan persis (termasuk *"Minimal 1 role wajib dipilih."* bila 0
  role tercentang); Langkah 32–33, 36, C2, C4 dilewati.

**Langkah 32 — Attach role `E2E-TEST-ROLE` ke client (bila belum ter-attach).**
- Halaman: `/admin/mqtt/security`, tab Clients. Aksi: baris client → kolom Roles →
  tautan **"+ Role"** → modal **`Attach Role ke e2e-test-client`** → dropdown pilih
  `E2E-TEST-ROLE`. Klik **"Attach"**.
- Lewati langkah ini bila role sudah ter-attach sejak Langkah 31 (chip sudah tampil) —
  catat dilewati karena sudah ter-attach.
- Sukses yang diharapkan: modal menutup; **tidak ada banner sukses khusus**; chip role
  baru muncul di kolom Roles baris client.
- Bila gagal: catat pesan persis.

**Langkah 33 — Rotate password client `e2e-test-client`.**
- Halaman: `/admin/mqtt/security`, tab Clients. Aksi: baris client → tombol kunci
  (ikon `KeyRound`) → modal **`Rotasi Password MQTT: e2e-test-client`**.
- Isi: `Password MQTT Baru (min. 8 karakter)` = kata sandi uji baru 8–128 karakter
  (lihat §1.5). Klik **"Simpan Password"**.
- ⚠️ Modal ini **tidak memvalidasi panjang di klien** — password < 8 karakter akan
  diteruskan ke server (kemungkinan ditolak server; itu hasil uji yang valid bila
  diuji, tetapi untuk uji sukses pakai 8–128 karakter).
- Sukses yang diharapkan: modal menutup; banner `Password MQTT untuk e2e-test-client
  dirotasi.` Tidak ada tampilan password baru di UI. **Catat password terakhir yang
  diset** (di luar dokumen ini).
- Bila gagal: catat pesan persis. **Jangan** rotasi password client asli mana pun.

**Langkah 34 — Disable → Enable client `e2e-test-client`.**
- Halaman: `/admin/mqtt/security`, tab Clients. Aksi: baris client → tombol
  **"Disable"**; tunggu badge berubah; lalu tombol **"Enable"**.
- Sukses yang diharapkan (tiap toggle): banner `Client e2e-test-client di-nonaktifkan.` /
  `… di-aktifkan.`; badge berubah `ENABLED` (hijau) ↔ `DISABLED` (merah).
  Akhiri dalam keadaan **ENABLED**.
- Bila gagal: catat pesan persis.

**Langkah 35 — Create DynSec group `E2E-TEST-GROUP`.**
- Halaman: `/admin/mqtt/security`, tab **Groups**. Aksi: tombol header
  **"Create MQTT Group"** → modal **"Buat MQTT Group Baru"**.
- Isi: hanya `Group Name` = `E2E-TEST-GROUP`. Klik **"Buat Group"**.
- Sukses yang diharapkan: modal menutup; **tanpa banner sukses**; kartu group baru
  muncul (`Clients: (kosong)`, `Roles: (kosong)`).
- Bila gagal: catat pesan persis; Langkah 36–37, C6 dilewati.

**Langkah 36 — Add client `e2e-test-client` ke group `E2E-TEST-GROUP`.**
- Halaman: `/admin/mqtt/security`, tab Groups. Aksi: kartu group → tombol
  **"Kelola Anggota"** → modal **`Anggota Group E2E-TEST-GROUP`** → baris
  **"Tambah Client ke Group"**, dropdown pilih `e2e-test-client` → tombol **"+ Client"**.
- ⚠️ Modal **menutup otomatis setelah SATU penambahan berhasil** — untuk menambah role
  juga (Langkah 37), buka modal lagi.
- Sukses yang diharapkan: **tanpa banner sukses**; anggota baru tampil di kartu group
  (`Clients: e2e-test-client`) setelah modal ditutup dan list reload.
- Bila gagal: modal tetap terbuka + banner error — catat pesan persis.

**Langkah 37 — Add role `E2E-TEST-ROLE` ke group `E2E-TEST-GROUP`.**
- Halaman: `/admin/mqtt/security`, tab Groups. Aksi: kartu group → tombol
  **"Kelola Anggota"** → modal **`Anggota Group E2E-TEST-GROUP`** → baris
  **"Tambah Role ke Group"**, dropdown pilih `E2E-TEST-ROLE` → tombol **"+ Role"**.
- Sukses yang diharapkan: **tanpa banner sukses**; `Roles: E2E-TEST-ROLE` tampil di
  kartu group setelah modal ditutup dan list reload.
- Bila gagal: modal tetap terbuka + banner error — catat pesan persis.

### Fase 4 — Config (stage → diff → discard; TANPA apply)

**Langkah 38 — Stage config (satu field numerik saja).**
- Halaman: `/admin/mqtt/configuration`, tab **Editor & Simpan Draf**.
- Isi: ubah **satu** nilai saja — `Max Queued Messages` = nilai awal (Langkah 2) **+1**.
  Jangan ubah `allow_anonymous` (checkbox **"Izinkan Koneksi Tanpa Kata Sandi"** wajib
  nonaktif), jangan tambah/hapus listener/bridge. Setiap bridge wajib punya
  `remote_address` non-kosong (bila kosong, klien melempar 400 sebelum request — catat
  bila terjadi). Isi **"Ringkasan Perubahan"** =
  `E2E-TEST stage <tanggal-jam> — perubahan batas saja, tanpa apply`.
  Klik **"Simpan Draf Pengaturan"**.
- Sukses yang diharapkan: banner hijau `Draft konfigurasi staged sebagai <version_id>.
  Validasi: <status>. Buka tab Versions untuk Diff & Apply.` (atau tanpa frasa validasi
  bila respons tanpa `validation`) + halaman **pindah otomatis ke tab Versions**; versi
  baru berstatus **`STAGED`**. **Catat `version_id` baru.**
- Bila gagal: catat pesan persis; Langkah 39–40 dilewati.
- Bila `lock.held` = true (Langkah 2), lewati langkah ini.

**Langkah 39 — Diff versi staged (verifikasi hanya 1 field berubah).**
- Halaman: `/admin/mqtt/configuration`, tab **Riwayat Versi & Perbedaan**. Aksi: baris
  versi staged (Langkah 38) → tombol **"Diff"** → modal **`Diff Konfigurasi:
  <version_id>`**.
- Sukses yang diharapkan: modal menampilkan `lines[]` — baris `+` hijau / `−` merah /
  konteks; verifikasi **hanya `max_queued_messages` yang berubah** (nilai lama → nilai
  baru). Bila `lines[]` kosong → *"Tidak ada perbedaan baris."* (catat — berarti stage
  tidak mengubah apa pun).
- Bila gagal: catat pesan persis (respons tanpa `lines[]` → error `INVALID_RESPONSE`).
- Ini langkah baca — tidak ada mutasi.

**Langkah 40 — Discard versi staged.**
- Halaman: `/admin/mqtt/configuration`, tab Riwayat Versi & Perbedaan. Aksi: baris versi
  berstatus **`STAGED`** → tombol **"Discard"** (ikon tempat sampah).
  **Tanpa dialog konfirmasi.** (Tombol Discard hanya dirender untuk status `STAGED`.)
- Sukses yang diharapkan: banner `Draft staged <versionId> dibuang.`; baris versi hilang
  dari tabel.
- Bila gagal: catat pesan persis dan catat versi sebagai **SISA** (lihat C13).
- ⚠️ **Jangan** klik **"Apply"** atau **"Rollback"** pada versi mana pun (lihat §4, D-1/D-2).

### Fase 5 — WO resolve (read), ack, downtime label, reconciliation, cancel WO

**Langkah 41 — Resolve preview `WO-SIM-20260906-02` (BUKAN mutasi — GET read-only).**
- Halaman: `/admin/work-orders`. Aksi: baris WO → tombol **"Detail & Korelasi"** →
  modal detail → tombol footer **"Periksa Kesiapan Parameter"**.
- Prasyarat: mesin WO harus **terikat device** (`device_id` diturunkan otomatis dari
  mesin WO). Bila mesin unbound, harapkan error di modal: *"Resolve membutuhkan
  device_id — pilih perangkat yang terikat ke mesin ini sebelum memeriksa kesiapan
  parameter."* — catat pesan itu sebagai hasil (bukan kegagalan skrip).
- Sukses yang diharapkan: panel **"Parameter Kesiapan Produksi · WO-SIM-20260906-02"**
  muncul di modal: target/jam (`—` bila null), cycle time, `planned_operating_sec`,
  rentang shift, break (`start–end (Nm)` bila ada), `planned_break_min`.
  `targetPerHour` dan `break` boleh null — null = "tidak diketahui", bukan 0.
  Resolve **tidak mengubah status** WO.
- Bila gagal: catat `resolveError` persis dari modal. Tidak ada cleanup (read-only).
- Catatan: resolve tidak melewati gerbang `assertLanForMutation` — langkah ini tetap
  bisa jalan meski semua mutasi terblokir 403 klien.

**Langkah 42 — Acknowledge operational event (UNACK, dari Langkah 2).**
- Halaman: `/audit`. Aksi: filter `UNACK`, cari event yang dicatat di Langkah 2 →
  kolom **Acknowledgment** → tombol **"Acknowledge"** → modal
  **"Acknowledge Event <id>"** (subtitle `<event_type> · <machine_name>`).
- Isi: `Catatan Tindak Lanjut (Opsional, maks 1000 karakter)` =
  `E2E-TEST ack <tanggal-jam> — verifikasi uji mutasi`. Klik
  **"Simpan Acknowledgment"**.
- Sukses yang diharapkan: modal menutup + tabel ter-refresh. ⚠️ **TIDAK ADA banner
  sukses** — verifikasi: baris berubah dari badge **"Pending Ack"** → menampilkan
  `acknowledged_by` + `acknowledged_at`; tombol berubah menjadi **"Note"**.
  Catat `acknowledged_at` sebelum/sesudah.
- ⚠️ Ack **tidak bisa di-unack** — hanya bisa di-ack ulang via tombol "Note" untuk
  menimpa catatan. Pilih event lama yang belum di-ack.
- Bila gagal: catat `actionError` persis dari halaman. Bila tidak ada event UNACK live,
  langkah ini tidak dapat diuji — catat.

**Langkah 43 — Downtime label (tab Riwayat; overwrite + label baru).**
- Halaman: `/downtime`, tab **Riwayat**.
- (a) **Overwrite event sudah berlabel** (dipilih di Langkah 2): baris event → tombol
  **"Overwrite"** → modal **"Overwrite Alasan Downtime"** (banner kuning di modal
  mengingatkan alasan lama + revisi tercatat). Isi: `Kategori Six Big Losses` =
  `OTHER` (atau kategori yang berbeda dari kategori lama — catat);
  `Deskripsi Akar Masalah (3–255 karakter)` = `E2E-TEST overwrite label <tanggal-jam>`
  (wajib 3–255); `Catatan Tambahan / Tindakan Perbaikan (Opsional, maks 500 karakter)` =
  `E2E-TEST overwrite`. Klik **"Simpan Overwrite"**.
- (b) **Label event `unlabeled`** (bila ada): baris event → tombol **"Label"** → modal
  **"Klasifikasi Alasan Downtime"**. Isi: `Kategori Six Big Losses` = `OTHER`;
  `Deskripsi Akar Masalah` = `E2E-TEST label <tanggal-jam>`; catatan opsional
  dikosongkan. Klik **"Simpan Klasifikasi"**.
  ⚠️ Label ini **permanen** — tidak ada cara mengembalikan status unlabeled.
- Sukses yang diharapkan (keduanya): ⚠️ **TIDAK ADA banner/toast sukses** — modal
  menutup; verifikasi: baris berubah — badge **"Unlabeled"** hilang, alasan + kategori
  tampil; tombol berubah menjadi **"Overwrite"**.
- Kategori valid (10 nilai): `EQUIPMENT_FAILURE`, `SETUP_AND_ADJUSTMENT`,
  `IDLING_AND_MINOR_STOPPAGE`, `REDUCED_SPEED`, `PROCESS_DEFECT`,
  `MATERIAL_SHORTAGE`, `PLANNED_MAINTENANCE`, `REST_BREAK`, `CLEANING_5S`, `OTHER`.
  (`UNKNOWN` bukan nilai body yang valid — bila event berkategori `UNKNOWN`, default
  form adalah `OTHER`.)
- Bila gagal: catat pesan persis. Bila riwayat kosong, langkah ini tidak dapat diuji —
  catat. **Tidak butuh downtime aktif** — pelabelan bekerja pada event historis.

**Langkah 44 — Reconciliation refresh (body kosong `{}`).**
- Halaman: `/admin/reconciliation`. Aksi: form **"Pembaruan Ulang Data Manual"** →
  tombol submit **"Perbarui Data Sekarang"**. (Tombol **"Refresh Jobs"** di header hanya
  me-refresh daftar — read, bukan mutasi.)
- Isi: **kedua input `datetime-local` dikosongkan** — `Waktu Mulai (Opsional)` dan
  `Waktu Selesai (Opsional)` kosong → body `{}` (keduanya opsional; body boleh `{}`).
  Body kanonis adalah `{startWindow, endWindow}` — **BUKAN `{from, to}`**.
  (Bila ingin menguji jendela: isi keduanya dengan rentang sempit di masa lalu;
  validasi `startWindow <= endWindow`, pesan *"Rentang rekonsiliasi tidak valid:
  startWindow harus <= endWindow."* — tetapi untuk skrip ini cukup body kosong.)
- Sukses yang diharapkan: banner hijau berisi **`res.message` dari server** (fallback
  klien: *"Refresh reconciliation diterima."*) + daftar jobs ter-refresh.
  (Saat cooldown 60 detik label tombol berubah **"Tunggu N detik"**; error 429 →
  cooldown 60 detik di UI.)
- Bila gagal: catat pesan persis. Tidak ada cleanup — refresh bersifat pemicu recompute
  (idempotent-ish), tidak membuat data uji.
- Catatan: langkah ini juga dipakai sebagai **probe kedua gerbang 403** (lihat §1.3).

**Langkah 45 — Cancel `WO-SIM-20260906-02` (TERAKHIR sebelum cleanup).**
- Halaman: `/admin/work-orders`. Aksi: baris WO → tombol **"Cancel"** (ikon XCircle,
  `title="Batalkan Work Order (Khusus Admin di Jaringan Lokal)"`) → dialog
  **"Batalkan Work Order WO-SIM-20260906-02?"**.
- Isi: `Alasan Pembatalan (Opsional, maks 500 karakter)` =
  `E2E-TEST cancel — WO simulasi untuk uji mutasi, bukan WO produksi`.
  Klik **"Ya, Batalkan WO"**.
- Prasyarat: WO masih berstatus **PENDING** atau **ACTIVE** (tombol hanya tampil pada
  status tersebut) dan capability `work_order.cancel` dimiliki. Verifikasi ulang status
  sebelum klik — bila sudah COMPLETED/ABORTED, tombol tidak tampil dan langkah ini
  tidak dapat diuji.
- Sukses yang diharapkan: banner *"Work Order WO-SIM-20260906-02 berhasil dibatalkan
  (ABORTED)."* + tabel ter-refresh; detail modal menampilkan `cancel_reason` bila ada;
  mesin terkait dibebaskan.
- ⚠️ **Irreversibel** — tidak ada un-cancel. **Jangan** cancel WO-001 atau WO asli
  lainnya.
- Bila gagal: 409 → `ConflictDialog` "Konflik Pembatalan Work Order (409)" — catat
  pesan persis; atau 403 (klasifikasikan sesuai §1.3).

---

## 3. Cleanup berurutan (13 langkah, urutan terbalik dari dependensi)

> Prinsip: unbind → delete machine → delete device → delete product/operator →
> delete IAM (sudah di Fase 2) → delete DynSec (group terakhir, karena anggotanya tidak
> bisa dilepas) → discard config bila masih ada. **Bila satu hapusan gagal, catat sebagai
> SISA dan JANGAN berhenti** — lanjutkan ke langkah cleanup berikutnya.

**C1 — Kembalikan label downtime overwrite (dari Langkah 43a).**
- Halaman: `/downtime`, tab Riwayat. Aksi: event yang di-overwrite → tombol
  **"Overwrite"** → isi kembali kategori + alasan **semula** (dicatat di Langkah 2) →
  klik **"Simpan Overwrite"**. Verifikasi baris kembali menampilkan alasan semula.
- Bila event semula `unlabeled` dan diberi label di Langkah 43b: **tidak bisa
  dikembalikan** — catat event tersebut sebagai **SISA permanen** (label uji menempel
  pada event historis). Bila gagal: catat sebagai SISA, lanjutkan.

**C2 — Detach role `E2E-TEST-ROLE` dari client `e2e-test-client`.**
- Halaman: `/admin/mqtt/security`, tab Clients. Aksi: baris client → chip role →
  tombol **`×`** (`aria-label="Detach role E2E-TEST-ROLE"`). **Tanpa konfirmasi,
  tanpa banner sukses** — verifikasi chip hilang dari baris.
- Bila gagal: catat pesan persis sebagai SISA, lanjutkan.

**C3 — Remove ACL dari role `E2E-TEST-ROLE`.**
- Halaman: `/admin/mqtt/security`, tab Roles & ACLs. Aksi: kartu role → baris ACL
  (`e2e/test/#`) → tombol **`✕`** di ujung baris. **Tanpa konfirmasi.**
- Sukses yang diharapkan: banner `ACL e2e/test/# dihapus dari role E2E-TEST-ROLE.`;
  baris hilang.
- Bila gagal: catat sebagai SISA, lanjutkan.

**C4 — Delete client `e2e-test-client`.**
- Halaman: `/admin/mqtt/security`, tab Clients. Aksi: baris client → tombol hapus
  (ikon tempat sampah). **Tanpa dialog konfirmasi** — pastikan nama barisnya
  `e2e-test-client` sebelum klik.
- Sukses yang diharapkan: banner `Client e2e-test-client dihapus.`; baris hilang.
- Bila gagal: catat sebagai SISA, lanjutkan.

**C5 — Delete DynSec role `E2E-TEST-ROLE`.**
- Halaman: `/admin/mqtt/security`, tab Roles & ACLs. Aksi: kartu role → tombol hapus
  (ikon tempat sampah). **Tanpa dialog konfirmasi.**
- Sukses yang diharapkan: banner `Role E2E-TEST-ROLE dihapus.`; kartu hilang.
- Bila gagal (mis. server menolak karena masih dipakai): catat respons server persis
  sebagai SISA, lanjutkan.

**C6 — Delete DynSec group `E2E-TEST-GROUP` (terakhir di DynSec).**
- Halaman: `/admin/mqtt/security`, tab Groups. Aksi: kartu group → tombol hapus
  (ikon tempat sampah). **Tanpa dialog konfirmasi.**
- Sukses yang diharapkan: banner `Group E2E-TEST-GROUP dihapus.`; kartu hilang.
- Catatan: anggota group tidak bisa dilepas lewat UI (lihat §4) — hapus group
  langsung dan catat apakah server mengizinkan hapus group berisi anggota atau
  menolaknya. Bila gagal: catat sebagai SISA, lanjutkan.

**C7 — Unbind device dari machine `CNC-TEST-E2E-01`.**
- Halaman: `/admin/machines`. Aksi: baris mesin bound → tombol **"Unbind"** → dialog
  **"Lepas Ikatan STM32-OEE-TEST01 dari CNC-TEST-E2E-01?"** → tombol
  **"Ya, Lepas Ikatan (Unbind)"**.
- Sukses yang diharapkan: banner *"Ikatan edge device dari mesin CNC-TEST-E2E-01
  berhasil dilepas."*; device kembali `Unbound`.
- Bila gagal: 409 bila mesin masih punya WO ACTIVE/PENDING (tidak seharusnya terjadi
  pada mesin uji) — catat sebagai SISA, lanjutkan.

**C8 — Delete machine `CNC-TEST-E2E-01`.**
- Halaman: `/admin/machines`. Aksi: baris mesin → tombol **"Hapus"** (ikon Trash2) →
  dialog **"Hapus Mesin CNC-TEST-E2E-01?"** → tombol **"Ya, Hapus Mesin"**.
- Sukses yang diharapkan: banner *"Mesin CNC-TEST-E2E-01 dihapus. Riwayat Work Order,
  telemetri, downtime, & event tetap tersimpan untuk arsip."*
- Bila gagal: 409 bila masih ada WO aktif/antrean/downtime berjalan — catat sebagai
  SISA, lanjutkan.

**C9 — Delete device `STM32-OEE-TEST01`.**
- Halaman: `/admin/devices`. Aksi: baris device → ikon tempat sampah → dialog
  **"Hapus Perangkat STM32-OEE-TEST01?"** → tombol **"Ya, Hapus Perangkat"**.
- Sukses yang diharapkan: banner *"Perangkat STM32-OEE-TEST01 dihapus. Riwayat
  pemantauan & henti mesin tetap tersimpan untuk arsip."*
- Bila gagal: 409 → `ConflictDialog` + banner berisi link "Lihat Work Order {id} →"
  (bila mesin yang terhubung masih menjalankan WO aktif/menunggu — tidak seharusnya
  terjadi setelah C7–C8) — catat sebagai SISA, lanjutkan.

**C10 — Delete device legacy `STM32-OEE-TEST02`.**
- Halaman: `/admin/devices`. Aksi: sama seperti C9 untuk `STM32-OEE-TEST02`.
- Sukses yang diharapkan: banner *"Perangkat STM32-OEE-TEST02 dihapus. Riwayat
  pemantauan & henti mesin tetap tersimpan untuk arsip."*
- Bila gagal: catat sebagai SISA, lanjutkan.

**C11 — Delete product `PROD-TEST-E2E-01`.**
- Halaman: `/admin/products`. Aksi: baris produk → tombol **"Hapus"** → dialog
  **"Hapus Produk PROD-TEST-E2E-01?"** → tombol **"Ya, Hapus Produk"**.
- Sukses yang diharapkan: banner *"Produk PROD-TEST-E2E-01 dihapus. Riwayat Work Order
  yang telah selesai tetap tersimpan untuk arsip."*
- Bila gagal: 409 bila masih dipakai WO berjalan/menunggu — catat sebagai SISA, lanjutkan.

**C12 — Delete operator `TST-E2E-01`.**
- Halaman: `/admin/operators`. Aksi: baris operator → tombol **"Hapus"** → dialog
  **"Hapus Operator TST-E2E-01?"** → tombol **"Ya, Hapus Operator"**.
- Sukses yang diharapkan: banner *"Operator TST-E2E-01 dihapus. Riwayat Work Order
  terdahulu tetap tersimpan untuk arsip."*
- Prasyarat: assignment IAM `TEST-E2E-ROLE` sudah dicabut (Langkah 25) — bila belum,
  hapus operator tetap membersihkan penugasan role IAM miliknya, tetapi catat bila
  server menolak. Bila gagal: catat sebagai SISA, lanjutkan.

**C13 — Verifikasi akhir + daftar SISA.**
- Periksa tiap halaman list dan cari sisa bernama `E2E-TEST-*` / `TEST-E2E-ROLE` /
  `e2e-test-client`: `/admin/devices`, `/admin/machines`, `/admin/products`,
  `/admin/operators`, `/admin/access-control` (tab Roles, Policies, Assignments),
  `/admin/mqtt/security` (ketiga tab), `/admin/mqtt/configuration` (tab Versions —
  pastikan tidak ada versi `STAGED` sisa dari Langkah 38; bila masih ada, Discard
  sekarang).
- Tulis daftar **SISA** akhir: tiap objek uji yang gagal dihapus + alasan + langkah
  tempat kegagalan terjadi. Daftar kosong = cleanup bersih.
- Perubahan permanen yang **bukan** SISA (diterima sebagai efek uji, catat terpisah):
  ack event (Langkah 42, tidak bisa di-unack), label downtime pada event yang semula
  `unlabeled` (Langkah 43b), cancel `WO-SIM-20260906-02` (Langkah 45).

---

## 4. Mutasi yang DIKECUALIKAN beserta alasan

| # | Mutasi | Alasan |
|---|---|---|
| D-1 | **Apply config** (`POST /configurations/:id/apply`) | Memuat ulang layanan komunikasi mesin (broker Mosquitto) yang dipakai produksi/telemetri live; mengubah config broker live; versi ACTIVE berganti. Pengganti aman: stage → Diff → Discard (Langkah 38–40). Alur apply/rollback cukup diverifikasi dari kode (202 `{operationId, versionId}` + polling maks 30×500 ms + body `{confirm: true, reason?}`). |
| D-2 | **Rollback config** (`POST /configurations/:id/rollback`) | Sama berbahayanya dengan apply (reload broker + versi baru + config lama kembali aktif). Bukan cleanup yang aman. Bila apply tidak sengaja terjadi, rollback adalah pemulihan darurat — putuskan bersama Fathur, bukan bagian rencana uji. |
| D-3 | **Ubah password ADM-001** (dua jalur) | (i) Topbar → ganti password sendiri (`POST /auth/change-password`); (ii) rotasi password operator `PATCH /api/v1/operators/:id/password` dengan target ADM-001. Keduanya mengubah password akun admin utama. Pengganti aman: rotasi password hanya pada operator uji `TST-E2E-01` (Langkah 13) dan client MQTT uji `e2e-test-client` (Langkah 33). |
| D-4 | **Hapus / nonaktifkan role ADMIN atau assignment ADMIN pada ADM-001** | Role ADMIN immutable (guard klien di mana-mana); tombol Revoke assignment ADMIN-ADM-001 di-`disabled` (Anti-Lockout Guard). Bila guard server lebih lemah dari guard klien dan mutasi ini lolos, panel kehilangan satu-satunya admin. Jangan coba menembus guard ini. Uji guard-nya saja secara pasif: pastikan tombol Edit/Hapus role ADMIN tidak ada, tombol Revoke assignment ADMIN-ADM-001 `disabled`, opsi DENY untuk ADMIN `disabled`. |
| D-5 | **Hapus / nonaktifkan data asli non-test apa pun** | Semua tombol hapus DynSec tanpa konfirmasi — satu klik salah pada client/role/group produksi = terhapus. Hanya sentuh objek ber-prefix `E2E-TEST-` / `TEST-E2E-ROLE` / `e2e-test-client`. |
| D-6 | **Stage config dengan `allow_anonymous=true` atau perubahan listener/bridge** | Checkbox "Izinkan Koneksi Tanpa Kata Sandi" bila ter-stage (apalagi ter-apply) membuka akses anonim ke broker. Stage hanya mengubah satu field numerik (Langkah 38). |
| X-1 | **Permission create/edit/delete (IAM)** | **Tanpa UI.** HTTP `createIamPermission` ada, tetapi tab Permissions read-only ("Tidak ada UI create/edit/delete di tab ini — hanya 'Assign ke Role'"). Tidak dapat diuji lewat panel. |
| X-2 | **DynSec group remove-client / remove-role** | **Tanpa UI.** HTTP `removeMqttGroupClient` / `removeMqttGroupRole` ada, tetapi tidak ada pemanggil UI (`useMqttGroupMutations` hanya ekspor add; modal hanya `onAddClient/onAddRole`). Anggota group hanya bisa dibersihkan dengan menghapus group-nya (C6). |
| X-3 | **Buat Work Order** | **Tanpa UI.** Panel hanya punya list/detail/resolve/cancel; dispatch/validate-zone/initiate/complete adalah HMI-only. Karena itu cancel hanya bisa diuji pada WO yang sudah ada (Langkah 45, `WO-SIM-20260906-02`). |
| X-4 | **Buat downtime (aktif maupun historis)** | **Tanpa UI.** Downtime hanya muncul dari telemetri/status mesin. Pelabelan diuji pada event historis yang sudah ada (Langkah 43). |
| X-5 | **Un-ack / un-cancel / un-revoke** | **Tidak mungkin.** Tidak ada endpoint/UI untuk membatalkan ack, cancel WO, atau revoke kredensial device. |
| X-6 | **Backup create/delete/restore** | **Tanpa UI maupun endpoint.** `POST /backups` dihapus (E20); tab Cadangan read-only; backup dibuat otomatis saat apply/rollback. |
| X-7 | **Update role/client DynSec** | **Tanpa UI.** Tidak ada `updateMqttRole` / `updateMqttClient` di lapisan HTTP; hanya create + delete + add/remove ACL (role) dan password/enable/roles (client). |
| X-8 | **Edit versi config yang sudah ada** | **Tanpa UI.** Versi hanya dibuat via stage dari draf editor; tidak ada `updateBrokerConfigVersion`. |
| X-9 | **Hapus label downtime (kembali ke unlabeled)** | **Tidak ada endpoint/UI.** Overwrite hanya menimpa label; event yang semula unlabeled lalu diberi label tidak bisa dikembalikan (catat sebagai perubahan permanen, Langkah 43b + C1). |
| X-10 | **Hapus SUPERVISOR / OPERATOR / MAINTENANCE (preset sistem)** | Tombol Edit/Hapus disembunyikan untuk semua `is_system=true` meski teks UI menyatakan preset opsional "bisa diubah atau dihapus bila tidak dipakai". Jangan uji via UI (tombolnya tidak ada). |

---

## 5. Risiko / ketidakpastian yang harus dicatat agen browser

1. **Gerbang `assertLanForMutation` kemungkinan menutup semua mutasi dari Vercel** (403
   klien sebelum request). Bila terjadi, catat `effective.reason` persis dan ikuti stop rule
   §1.3 — jangan memaksa lewat jalur lain. Verifikasi dari LAN pabrik (bila tersedia)
   adalah tindak lanjut terpisah, bukan bagian skrip ini.
2. **Sesi bisa berakhir 401 di tengah jalan** bila `authz_version` naik akibat mutasi IAM
   (tiap mutasi IAM kecuali update role menaikkan versi; sesi lain/token lama berakhir).
   Siapkan login ulang sebagai ADM-001 dan lanjutkan dari langkah berikutnya; catat tiap
   401 beserta langkah pemicunya.
3. **Tombol hapus/lepas DynSec tanpa konfirmasi** (client/role/group delete, detach role,
   remove ACL, add anggota group tanpa banner). Satu klik salah pada baris data asli =
   terhapus. Baca ulang nama baris sebelum setiap klik.
4. **Tidak ada banner sukses pada beberapa aksi** — sukses hanya terlihat dari perubahan
   baris/tabel: ack event (Langkah 42), downtime label (Langkah 43), DynSec attach role
   (Langkah 32), detach role (C2), create role DynSec (Langkah 29), add ACL (Langkah 30),
   create group + add anggota group (Langkah 35–37). **Ketiadaan banner adalah perilaku
   kode — jangan laporkan sebagai bug tanpa memeriksa ulang perubahan list.**
5. **Perangkap UI form Product:** field SKU + checkbox aktif tampil di form create/update
   tetapi **tidak dikirim** ke server (body hanya `{productId, productName,
   stdCycleTimeSec}` / `{productName, stdCycleTimeSec}`). Verifikasi update produk hanya
   dari nama + cycle time.
6. **Perangkap body:** machine bind memakai `device_id` (snake_case), create machine memakai
   `deviceId` (camelCase); reconciliation refresh memakai `{startWindow, endWindow}`
   (**bukan** `{from, to}`).
7. **Kredensial sekali-tampil hilang bila dialog ditutup** — provision device (Langkah 3),
   rotate kredensial (Langkah 14), dan `generatedPassword` DynSec (Langkah 31). Salin
   sebelum menutup; bila hilang, satu-satunya jalan adalah rotasi ulang (device) atau
   hapus + buat ulang (client MQTT).
8. **Modal rotasi password MQTT tidak memvalidasi panjang di klien** (Langkah 33) —
   password < 8 karakter diteruskan ke server dan kemungkinan ditolak server.
9. **Ketergantungan pada data live yang belum diketahui pasti:** status `WO-SIM-20260906-02`
   saat eksekusi (Langkah 2, 41, 45); ketersediaan event UNACK (Langkah 42); jumlah event
   downtime historis + berapa yang unlabeled (Langkah 43); binding device pada mesin WO-SIM
   (Langkah 41); keberadaan role `edge_publisher` (Langkah 31). Bila salah satu prasyarat
   tidak terpenuhi, catat dan lewati langkah terkait — jangan membuat data pengganti di
   luar skrip.
10. **Cleanup tidak dijamin bersih 100%:** hapus role IAM ditolak 409 bila masih dipakai;
    hapus group DynSec berisi anggota bergantung pada perilaku server; hapus device/machine/
    product/operator ditolak 409 bila masih terikat WO aktif/menunggu. Semua kegagalan
    cleanup dicatat sebagai **SISA** (C13) dan tidak menghentikan cleanup.
11. **Perubahan permanen yang diterima sebagai efek uji** (bukan SISA): ack event,
    label downtime pada event semula unlabeled, cancel `WO-SIM-20260906-02`.
    Ketiganya tidak bisa dibatalkan — pastikan Fathur menyetujui ketiganya sebelum eksekusi.

---

## 6. Ringkasan hitungan

| Domain | Langkah skrip | Keterangan |
|---|---|---|
| Login + inventaris | 1–2 | 2 langkah |
| Master data + WO + ack + downtime + recon | 3–15, 41–45 | 18 langkah (13 master + 5 WO/ack/downtime/recon) |
| IAM | 16–28 | 13 langkah |
| DynSec | 29–37 | 9 langkah |
| Config (stage/diff/discard) | 38–40 | 3 langkah |
| **Total skrip** | **45 langkah** | |
| Cleanup | C1–C13 | 13 langkah |
| **Total keseluruhan** | **58 langkah** | |

Mutasi yang akan diuji (aman, via UI): provision + register legacy + update + rotate +
revoke + delete device (6); create + update + delete + bind + unbind machine (5); create +
update + delete product (3); create + update + delete + password rotate + status toggle
operator (5); WO resolve-preview (read) + cancel (2); ack event (1); downtime label/overwrite
(2); reconciliation refresh (1); IAM role create/update/delete (3), policy create/update/
delete + toggle (4), user-role assign/revoke (2), role-permission add/remove (2); DynSec
client create/delete/password/enable/role-add/role-remove (6), role create/delete/ACL-add/
ACL-remove (4), group create/delete/add-client/add-role (4); config stage + discard (2).
**Total ≈ 53 aksi uji** (beberapa langkah menguji 2 aksi, mis. toggle bolak-balik).

Mutasi yang dikecualikan: lihat §4 (D-1–D-6 berbahaya; X-1–X-10 tanpa UI/tidak mungkin).
