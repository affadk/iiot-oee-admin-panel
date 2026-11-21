# Uji Mutasi End-to-End — Panel Admin IIoT OEE

> **Status:** DIEKSEKUSI 2026-11-19 (18:58–19:34 WIB) — hasil lengkap per langkah.
> **Panel live:** https://iiot-oee-admin-panel.vercel.app ·
> **Backend live:** https://oee.fadik.web.id
> **Rencana yang diikuti:** `docs/E2E_MUTATION_PLAN.md` (45 langkah + 13 cleanup)
> **Ringkasan audit:** `AUDIT.md` §35
> **Uji baca pendahulu (tanpa mutasi):** `docs/E2E_TEST.md` + `AUDIT.md` §34
>
> **Sumber kebenaran dokumen ini:** dua laporan browser eksekusi
> (Bagian A 18:58–19:10 WIB, Bagian B 19:11–19:34 WIB), login ADM-001,
> station ADMIN-CONSOLE-01. Banner/pesan dikutip persis dari laporan.
> Tidak ada mutasi tambahan yang dilakukan saat penulisan dokumen ini.

## 1. Konteks

### 1.1 Tujuan

Menguji semua mutasi panel yang aman dan dapat diuji lewat UI dalam
satu sesi browser berurutan, dengan data uji bernama jelas
(`E2E-TEST-*`, `TEST-*`), lalu membersihkan semua data uji — mengikuti
rencana `docs/E2E_MUTATION_PLAN.md` §1–§2 dan cleanup §3. Mutasi
berbahaya dan mutasi tanpa UI tidak diuji (rencana §4).

### 1.2 Asumsi yang terverifikasi di awal

- Panel live di Vercel dan backend live di `oee.fadik.web.id`.
- Izin tulis Fathur untuk sesi uji ini (semua mutasi mengubah data
  live, meski hanya data uji bernama jelas).
- Login ADM-001, station ADMIN-CONSOLE-01; badge panel "API: Real" +
  "Mode Akses: Private".
- **Mode akses server `private` + ingress tunnel (Vercel).** Panel
  berjalan lewat tunnel, bukan LAN pabrik — lihat §2 untuk implikasi
  gerbang mutasi.

### 1.3 Gerbang mutasi — hasil terpenting sesi ini

Rencana §1.3 memprediksi gerbang `assertLanForMutation()` (klien,
403 sebelum request dikirim) kemungkinan menutup semua mutasi dari
Vercel, dengan aturan berhenti bila Langkah 3 (provision) 403 klien
dan Langkah 44 (reconciliation refresh) juga 403 klien.

**Yang terjadi: gerbang tidak menutup satu pun mutasi.** Semua mutasi
yang dieksekusi di Bagian A dan Bagian B lolos dari Vercel — **tanpa
satu pun 403**, baik 403 klien maupun 403 gerbang tunnel server.
Aturan berhenti tidak pernah terpicu.

Pernyataan ini dibatasi secara hati-hati sebagai **bukti empiris**:
sesi login bertahan dan semua mutasi uji lolos dari Vercel pada
19 Nov 2026 malam. Uji ini **tidak membuktikan** penegakan sisi
server mode akses (A10.2 / FAT-40) selesai, dan juga **tidak
membuktikan** ia gagal — penegakan server tidak diuji secara khusus
(tidak ada probe negatif dari tunnel terhadap endpoint yang
seharusnya ditolak, dan tidak ada pembanding dari LAN pabrik). Jangan
jadikan dokumen ini vonis atas A10.2 ke arah mana pun.

### 1.4 Data uji

| Objek | Nama uji |
|---|---|
| Device (provision) | `STM32-OEE-TEST01` |
| Device (register legacy) | `STM32-OEE-TEST02` |
| Machine | `CNC-TEST-E2E-01` (Mesin Uji E2E) |
| Product | `PROD-TEST-E2E-01` (Produk Uji E2E) |
| Operator | `TST-E2E-01` (UNASSIGNED, LINE-01) |
| Role IAM | `TEST-E2E-ROLE` |
| Role DynSec | `E2E-TEST-ROLE` |
| MQTT client DynSec | `e2e-test-client` (tidak pernah tercipta — MUT-02) |
| Group DynSec | `E2E-TEST-GROUP` |
| Work order (cancel) | `WO-SIM-20260906-02` (PENDING, 600 pcs, WO simulasi — **bukan WO-001**) |

**Tidak pernah disentuh:** WO-001, ADM-001 (password/role/status),
role ADMIN, data asli non-test apa pun. Tidak ada Apply/Rollback
config yang diklik.

### 1.5 Ringkasan hitungan

| Kategori | Jumlah |
|---|---|
| Mutasi berhasil | 35 |
| Guard probe yang gagal sesuai harapan (L24, `ROLE_IN_USE`) | 1 |
| Kegagalan persisten (L31, MUT-02) | 1 |
| Langkah tidak dapat diuji (L41 panel kesiapan, L43b, L38–L40, L32–L34, L36) | 8 |
| Cleanup berhasil (termasuk C1 dengan residu MUT-04) | 13 |
| 403 (klien maupun server) di seluruh sesi | 0 |
| 429 / cooldown (L44) | 0 |

## 2. Bagian A — Master data + WO + ack + downtime + rekonsiliasi (18:58–19:10 WIB)

### 2.1 Login & inventaris (L1–L2)

| Langkah | Aksi | Hasil |
|---|---|---|
| L1 | Login ADM-001, station ADMIN-CONSOLE-01 | OK. Badge "API: Real" + "Mode Akses: Private". |
| L2 | Inventaris | WO-SIM-20260906-02 PENDING (produk Precision Shaft Pin 8mm / PRD-SHAFT-PIN-08, mesin CNC-MILLING-SIM, device STM32-OEE-SIM terikat, operator Ahmad Pratama OPR-1002, target 600 pcs). Event UNACK dipilih id 1148 (11/19/2026 4:20:44 PM, SECURITY_REJECTION / PERIMETER_GATEWAY, mesin CNC Milling Station 01 / STM32-OEE-01). Downtime STM32-OEE-01: 2 event historis, 0 unlabeled, keduanya berlabel kategori "Belum dikategorikan", alasan "Equipment failure", durasi 1h 00m 00s, jam 13:55:34 dan 13:54:40 WIB; STM32-OEE-SIM 0 event. Maka langkah 43(b) tidak dapat diuji (lihat §5). |

### 2.2 Master data (L3–L15)

| Langkah | Aksi | Hasil |
|---|---|---|
| L3 | Provision device STM32-OEE-TEST01 | OK — banner "Perangkat edge STM32-OEE-TEST01 berhasil di-provision (PROVISIONED). Salin kredensial sekali tampil sebelum menutup dialog." Kredensial sekali-tampil disalin sebelum dialog ditutup; baris baru badge PROVISIONED, Unbound. |
| L4 | Register legacy STM32-OEE-TEST02 | OK — banner "Perangkat edge STM32-OEE-TEST02 berhasil diregistrasi." OBSERVASI: badge baris PROVISIONED, bukan ACTIVE seperti ekspektasi rencana (bukan tiket; lihat §4). |
| L5 | Create machine CNC-TEST-E2E-01 | OK dengan adaptasi — percobaan pertama Modbus Slave ID 1 GAGAL: "Modbus slave ID 1 already assigned to machine CNC-MILLING-01." (validasi server bekerja benar); diulang Slave ID 2 → banner "Mesin CNC-TEST-E2E-01 (Mesin Uji E2E) berhasil dibuat." Slave #2, Unbound. |
| L6 | Bind STM32-OEE-TEST01 → CNC-TEST-E2E-01 | OK — banner "Edge device STM32-OEE-TEST01 berhasil diikatkan ke CNC-TEST-E2E-01." |
| L7 | Edit device (IP 192.168.1.201, firmware v9.9.9-e2e) | OK — banner "Konfigurasi perangkat STM32-OEE-TEST01 diperbarui." |
| L8 | Create product PROD-TEST-E2E-01 | OK — banner "Produk PROD-TEST-E2E-01 (Produk Uji E2E) berhasil dibuat." Baris menampilkan SKU "PROD-TEST-E2E-01" — terkonfirmasi live bahwa SKU-E2E-TEST-01 yang diisi TIDAK dikirim (SKU default = Product ID). 30 s/pcs, ACTIVE. |
| L9 | Edit product (nama "Produk Uji E2E v2", 45 s/pcs) | OK — banner "Produk PROD-TEST-E2E-01 berhasil diperbarui." |
| L10 | Create operator TST-E2E-01 (UNASSIGNED, LINE-01) | OK — banner "Akun operator TST-E2E-01 (UNASSIGNED) berhasil dibuat." ACTIVE. |
| L11 | Edit operator (nama "Operator Uji E2E v2") | OK — banner "Profil operator TST-E2E-01 berhasil diperbarui." |
| L12 | Suspend lalu activate TST-E2E-01 | OK — banner "Status TST-E2E-01 diubah menjadi SUSPENDED." lalu "... menjadi ACTIVE." Tombol Suspend ADM-001 disabled ("Akun dilindungi (ADM-001)"). |
| L13 | Rotasi password operator TST-E2E-01 | OK — banner (Inggris) "Password for operator 'TST-E2E-01' was successfully updated." |
| L14 | Rotasi kredensial device STM32-OEE-TEST01 (alasan "E2E-TEST rotasi kredensial uji mutasi", force tidak dicentang) | OK — pesan hijau di modal "Kredensial STM32-OEE-TEST01 dirotasi. Salin kredensial baru sebelum menutup dialog."; "Rotasi terakhir: 11/19/2026, 7:04:10 PM". |
| L15 | Revoke kredensial device STM32-OEE-TEST01 | OK — pesan hijau "Kredensial STM32-OEE-TEST01 dicabut (REVOKED). Baris registry dan histori dipertahankan." Badge enrollment jadi REVOKED. |

### 2.3 WO resolve-preview, ack, downtime, rekonsiliasi, cancel (L41–L45)

| Langkah | Aksi | Hasil |
|---|---|---|
| L41 | Resolve-preview WO-SIM-20260906-02 (read-only, GET) | Panel kesiapan TIDAK muncul — "Pemeriksaan Parameter Belum Tersedia — Edge controller STM32-OEE-SIM is currently offline. Check network connection or power." dengan "Planned Start: —". Mesin terikat (bukan jalur unbound). Perilaku informatif, bukan bug; panel kesiapan TETAP BELUM TERUJI. Status WO tetap PENDING. |
| L42 | Ack event 1148 (catatan "E2E-TEST ack — verifikasi uji mutasi") | OK — TANPA banner sukses (sesuai ekspektasi); terverifikasi di filter "Sudah Ack": "ADM-001 11/19/2026, 7:05:45 PM 'E2E-TEST ack — verifikasi uji mutasi'", tombol jadi "Note"; event keluar dari daftar UNACK. |
| L43(a) | Overwrite label downtime (event 13:55:34, kategori OTHER, alasan "E2E-TEST overwrite label", catatan "E2E-TEST overwrite") | OK — baris jadi "[OTHER] E2E-TEST overwrite label - E2E-TEST overwrite"; tanpa banner (sesuai ekspektasi). |
| L43(b) | Label baru pada event unlabeled | TIDAK DAPAT DIUJI — tidak ada event unlabeled (lihat L2). |
| L44 | Reconciliation refresh (kedua input datetime dikosongkan, body {}) | OK — banner hijau berisi pesan server "Continuous aggregate oee_hourly_summary refreshed successfully." Jobs ter-refresh (Telemetry Reporter [1] SUCCESS, last run 19 Nov 2026 19.02). Tanpa cooldown/429. |
| L45 | Cancel WO-SIM-20260906-02 (status diverifikasi PENDING dulu; alasan "E2E-TEST cancel — WO simulasi untuk uji mutasi, bukan WO produksi") | OK — banner "Work Order WO-SIM-20260906-02 berhasil dibatalkan (ABORTED)." Baris jadi ABORTED, tombol Cancel hilang. Irreversibel (perubahan permanen, lihat §6). |

### 2.4 Cleanup Bagian A (C1, C7–C13)

| Langkah | Aksi | Hasil |
|---|---|---|
| C1 | Restore label downtime dari L43(a) | RESIDU (MUT-04, §3): modal overwrite tidak punya opsi "Belum dikategorikan" dan selalu memberi prefix kategori, sehingga teks asli persis "Equipment failure" tidak bisa dikembalikan; dikembalikan dengan kategori EQUIPMENT_FAILURE + alasan "Equipment failure" → baris kini "[EQUIPMENT_FAILURE] Equipment failure"; kolom kategori tetap "Belum dikategorikan" seperti semula. |
| C7 | Unbind STM32-OEE-TEST01 dari CNC-TEST-E2E-01 | OK — banner "Ikatan edge device dari mesin CNC-TEST-E2E-01 berhasil dilepas." |
| C8 | Delete machine CNC-TEST-E2E-01 | OK — banner "Mesin CNC-TEST-E2E-01 dihapus. Riwayat Work Order, telemetri, downtime, & event tetap tersimpan untuk arsip." (2 mesin tersisa). |
| C9 | Delete device STM32-OEE-TEST01 | OK — banner "Perangkat STM32-OEE-TEST01 dihapus. Riwayat pemantauan & henti mesin tetap tersimpan untuk arsip." |
| C10 | Delete device STM32-OEE-TEST02 | OK — banner "Perangkat STM32-OEE-TEST02 dihapus. Riwayat pemantauan & henti mesin tetap tersimpan untuk arsip." (2 device tersisa). |
| C11 | Delete product PROD-TEST-E2E-01 | OK (5 produk tersisa). |
| C12 | Delete operator TST-E2E-01 | OK (5 operator tersisa). |
| C13 | Verifikasi akhir | Devices = STM32-OEE-01, STM32-OEE-SIM saja; machines = CNC-MILLING-SIM, CNC-MILLING-01 saja; products = 5 asli; operators = 5 asli. SISA: KOSONG. |

## 3. Bagian B — IAM + DynSec + config (19:11–19:34 WIB)

### 3.1 Inventaris awal

Access Control Roles (4), Policies (62), Assignments (5);
TEST-E2E-ROLE tidak ada (tanpa sisa). DynSec Clients (1)
backend-admin, Roles & ACLs (1) admin, Groups (0). Operator
TST-E2E-01 tidak ada (sudah dihapus Bagian A). Config: banner merah
"Live configuration '/mosquitto/config/mosquitto.conf' is not
readable: ENOENT: no such file or directory, open
'/mosquitto/config/mosquitto.conf'"; tab Editor kosong di setiap
load; "Tampilan teknis tidak tersedia untuk saat ini"; Versions (0),
Deployments (0), Backups (0).

### 3.2 IAM — Access Control (L16–L28)

| Langkah | Aksi | Hasil |
|---|---|---|
| L16 | Create role TEST-E2E-ROLE | OK — banner 'Custom role "TEST-E2E-ROLE" berhasil dibuat. Pembaruan kebijakan menaikkan authz_version ke #1 — sesi lain dengan token lama akan berakhir (401) dan perlu login ulang.' |
| L17 | Update role (deskripsi) | OK — banner 'Role "TEST-E2E-ROLE" berhasil diperbarui.' (tanpa advisory authz_version, sesuai ekspektasi). Deskripsi jadi "...panel v2". |
| L18 | Create policy (permission refresh:telemetry; koreksi: read:telemetry TIDAK ADA di katalog live) | OK dengan koreksi server — percobaan pertama ABAC kosong GAGAL: "Invalid policy: abacCondition Invalid input: expected record, received null". Diulang dengan JSON ABAC {"attr": "subject.line_id", "eq": "LINE-01"} → berhasil. Policy ID 935f9d0a-d7b1-4ea2-b41d-fb8c54079e91, ALLOW, telemetry:E2E-TEST-*, ACTIVE. Banner 'Policy ALLOW untuk TEST-E2E-ROLE berhasil ditambahkan. Pembaruan kebijakan menaikkan authz_version ke #2 — ...' |
| L19 | Toggle policy Disable→Enable | OK — 'Status policy 935f9d0a-d7b1-4ea2-b41d-fb8c54079e91 diubah menjadi DISABLED. ... authz_version ke #3' lalu '... diubah menjadi ACTIVE. ... authz_version ke #4'. Berakhir ACTIVE. |
| L20 | Update policy (2× edit) | OK — pattern → telemetry:E2E-TEST-v2-* (authz #5), dikembalikan → telemetry:E2E-TEST-* (authz #6). Banner 'Policy 935f9d0a-... berhasil diperbarui. ...' ABAC dibiarkan berisi JSON dari L18 (mengosongkannya gagal di server di L18). |
| L21 | Bind permission ke role (permission read:access_control, berbeda dari L18; ALLOW, telemetry:E2E-TEST-*) | OK dengan koreksi — percobaan pertama ABAC kosong GAGAL: "body/abacCondition Invalid input: expected record, received null". Diulang dengan JSON ABAC yang sama → berhasil. Banner 'Permission read:access_control (ALLOW · telemetry:E2E-TEST-*) berhasil di-assign ke role TEST-E2E-ROLE. ... authz_version ke #7'. Chip muncul; Policies naik ke 64. Opsi RESERVED (manage:access_control, manage:mqtt_admin, manage:mqtt_configuration, read_raw:mqtt_configuration) tampil "(DIBLOKIR - RESERVED)" dan disabled. |
| L22 | Assign role ke operator (operator TST-E2E-01 dibuat dulu) | OK — operator dibuat dulu (banner 'Akun operator TST-E2E-01 (UNASSIGNED) berhasil dibuat.'), lalu assign TEST-E2E-ROLE scope ORGANIZATION → banner 'Role TEST-E2E-ROLE berhasil di-assign ke TST-E2E-01. ... authz_version ke #7'. Baris baru ORGANIZATION (Global Plant), badge Efektif. Tidak ada yang di-assign ke ADM-001. |
| L23 | Inspector effective permission (baca) | OK — TST-E2E-01 menunjukkan kedua effective permission: ALLOW read → telemetry:E2E-TEST-* dan ALLOW refresh → telemetry:E2E-TEST-* (Sumber Peran TEST-E2E-ROLE, ABAC {"eq":"LINE-01","attr":"subject.line_id"}). Header: "TST-E2E-01 Primary: UNASSIGNED Aktif · authz v1 · shadow". |
| L24 | GUARD PROBE — hapus role saat ter-assign | Kegagalan yang DIHARAPKAN, hasil uji valid — banner merah "Role 'TEST-E2E-ROLE' is still assigned to 'TST-E2E-01' (ROLE_IN_USE)." Kartu role utuh. |
| L25 | Revoke assignment | OK — banner 'Assignment TEST-E2E-ROLE pada TST-E2E-01 berhasil dicabut. ... authz_version ke #7'. Baris hilang; Assignments kembali 5. OBSERVASI: banner assign-perm (L21), assign-user (L22), dan revoke (L25) semuanya menampilkan authz_version #7 — counter tidak tampak naik pada assign/revoke (observasi terbuka, JANGAN ditiketkan; lihat §4). |
| L26 | Unbind permission (chip ×) | OK — banner 'Permission "read:access_control" dilepas dari role TEST-E2E-ROLE. ... authz_version ke #8'. Chip hilang; Policies kembali 63. |
| L27 | Delete policy 935f9d0a | OK — banner 'Policy 935f9d0a-d7b1-4ea2-b41d-fb8c54079e91 dihapus. ... authz_version ke #9'. Policies kembali 62. |
| L28 | Delete role TEST-E2E-ROLE | OK — banner 'Role "TEST-E2E-ROLE" berhasil dihapus. ... authz_version ke #10'. Roles kembali 4. |

Guard pasif ADMIN terverifikasi (bukan temuan): kartu role ADMIN
tanpa tombol Edit/Hapus; semua baris policy ADMIN Edit/Disable/Delete
disabled; Revoke assignment ADMIN–ADM-001 disabled dengan catatan
"Anti-Lockout Guard: role ADMIN pada akun dilindungi tidak dapat
dicabut."; di modal Add Policy dengan Role = ADMIN, opsi "DENY
(Diblokir untuk ADMIN)" disabled.

Sesi: setelah full-page reload ~12:22 UTC sesi berakhir (redirect ke
/login), sesuai advisory authz_version; login ulang 1× sebagai
ADM-001, lanjut. Tidak ada 403 di Bagian B.

### 3.3 Dynamic Security — MQTT (L29–L37)

| Langkah | Aksi | Hasil |
|---|---|---|
| L29 | Create DynSec role E2E-TEST-ROLE | OK (dengan false failure) — submit pertama menampilkan banner merah "Koneksi jaringan terputus atau backend tidak terjangkau." padahal role tercipta di server; retry melaporkan "Role already exists"; setelah re-login Roles & ACLs (2), kartu bertuliskan "Belum ada aturan topik komunikasi (akses dibatasi secara bawaan)." (MUT-01, §3). |
| L30 | Add ACL ke role E2E-TEST-ROLE | OK dengan deviasi — publishClientSend + e2e/test/# DITOLAK server: "Wildcards are not allowed in 'publishClientSend' topics". Diulang dengan topik literal e2e/test: percobaan pertama menampilkan banner network-error padahal ACL tercipta (duplikat melaporkan "ACL with this topic already exists"); load baru menampilkan baris "ALLOW publishClientSend e2e/test". Jadi topik ACL = e2e/test, bukan e2e/test/# (koreksi rencana, bukan bug; lihat §4). |
| L31 | Create MQTT client e2e-test-client | GAGAL PERSISTEN (MUT-02, §3) — banner merah "Role not found". Direproduksi 5×: E2E-TEST-ROLE ×4 (termasuk dari halaman yang baru di-remount) dan role admin yang sudah ada ×1. Client tidak pernah tercipta (Clients tetap 1). |
| L32 | Attach role ke client | DILEWATI (tidak ada client — terblokir MUT-02). |
| L33 | Rotasi password client | DILEWATI (tidak ada client — terblokir MUT-02). |
| L34 | Disable → Enable client | DILEWATI (tidak ada client — terblokir MUT-02). |
| L35 | Create group E2E-TEST-GROUP | OK (percobaan pertama banner network-error padahal group tercipta; Groups (1) setelah load baru; kartu "Clients: (kosong), Roles: (kosong)"). (MUT-01, §3). |
| L36 | Add client ke group | DILEWATI (tidak ada client — terblokir MUT-02). |
| L37 | Add role ke group | OK (percobaan pertama banner network-error; load baru "Roles: E2E-TEST-ROLE"). (MUT-01, §3). |

### 3.4 Config (L38–L40) — tidak dapat diuji

| Langkah | Aksi | Hasil |
|---|---|---|
| L38 | Stage config (satu field numerik) | TIDAK DAPAT DIUJI — tab "Editor & Simpan Draf" kosong di setiap load (dicek ~12:12, ~12:32, ~12:34 UTC): tidak ada Max Queued Messages, Autosave Interval, Simpan Draf Pengaturan, Ringkasan Perubahan, atau nilai runtime.mode/lastAppliedVersionId/lock.held. Banner persisten ENOENT di atas. |
| L39 | Diff versi staged | TIDAK DAPAT DIUJI — tidak ada staged version (terblokir L38). |
| L40 | Discard versi staged | TIDAK DAPAT DIUJI — tidak ada yang di-discard. Tidak ada Apply/Rollback yang diklik. |

Penyebab: backend/environment (live mosquitto.conf hilang di host
API) — akar masalah yang sama dengan E2E-08 (FAT-222). **Jangan buat
tiket baru untuk ini.**

### 3.5 Cleanup Bagian B (C2–C6, C12b, C13)

| Langkah | Aksi | Hasil |
|---|---|---|
| C2 | Hapus client uji | Tidak berlaku (tidak ada client — terblokir MUT-02). |
| C3 | Remove ACL dari role | OK — banner 'ACL e2e/test dihapus dari role E2E-TEST-ROLE.' |
| C4 | (hapus client dari group) | Tidak berlaku (tidak ada client). |
| C5 | Delete DynSec role E2E-TEST-ROLE | OK — banner 'Role E2E-TEST-ROLE dihapus.' Roles & ACLs kembali (1); role admin + 8 ACL-nya utuh. Catatan: role dihapus saat masih anggota E2E-TEST-GROUP; hapus berhasil dan kartu group lalu menampilkan "Roles: (kosong)" — role terhapus otomatis terhapus dari group (lihat §6). |
| C6 | Delete group E2E-TEST-GROUP | OK — banner 'Group E2E-TEST-GROUP dihapus.' Groups kembali (0). Catatan: saat dihapus group sudah kosong (keanggotaan dibersihkan otomatis oleh C5), jadi apakah server mengizinkan hapus group yang masih berisi anggota TIDAK teruji. |
| C12b | Delete operator TST-E2E-01 | OK (Operators kembali 5). |
| C13 | Verifikasi akhir | Access Control Roles (4), Policies (62), Assignments (5), tanpa TEST-E2E-ROLE/assignment TST-E2E-01; DynSec Clients (1) backend-admin saja, Roles & ACLs (1) admin saja, Groups (0); Config Versions (0), tanpa STAGED; Operators 5, tanpa TST-E2E-01. SISA: KOSONG. |

## 4. Temuan MUT-01 – MUT-04

### MUT-01 (panel) — Banner network-error palsu + list stale di DynSec

Mutasi DynSec berulang kali menampilkan banner merah "Koneksi
jaringan terputus atau backend tidak terjangkau." padahal mutasi
sukses di server, dan list tampil stale sampai halaman di-remount via
navigasi sidebar; load baru mengungkap keadaan sebenarnya.

- L29: submit pertama banner network-error, role tercipta; retry
  "Role already exists".
- L30: percobaan pertama banner network-error, ACL tercipta; duplikat
  "ACL with this topic already exists".
- L35: percobaan pertama banner network-error, group tercipta.
- L37: percobaan pertama banner network-error, role ter-attach ke
  group.

Pola yang sama tidak terlihat di domain lain pada sesi ini. Dampak:
operator bisa mengira mutasi gagal dan mengulanginya (duplikat), atau
sebaliknya percaya list stale yang menampilkan keadaan lama.

### MUT-02 (backend) — Create MQTT client selalu "Role not found"

Sisi: BACKEND (dengan satu caveat terbuka). Panel mengirim body
sesuai persis skema server: `roles` sebagai array objek
`{rolename: <nama>, priority: 1}` (mqttDynsec.ts:62-79), dan server
menerima bentuk itu — galat "Role not found" adalah galat lookup
bisnis, bukan validasi skema. Lookup gagal bahkan untuk role `admin`
(8 ACL) dan `E2E-TEST-ROLE` yang baru dibuat lewat panel sendiri.
Caveat: modal create-client meng-hardcode default
`cRoles=['edge_publisher']` (CreateMqttClientModal.tsx:21); bila
payload uji memuat `edge_publisher` yang tidak ada di server, satu
entri itu saja sudah cukup menjelaskan galatnya — perlu log body
request aktual untuk menutup caveat ini.

L31 create client `e2e-test-client` gagal persisten: banner merah
"Role not found". Direproduksi 5× — role E2E-TEST-ROLE ×4 (termasuk
dari halaman yang baru di-remount) dan role admin yang sudah ada ×1.
Client tidak pernah tercipta (DynSec Clients tetap 1). Akibatnya L32
attach role, L33 rotasi password client, L34 disable/enable client,
dan L36 add client ke group tidak dapat diuji.

### MUT-03 (panel) — Policy create dengan ABAC kosong mengirim abacCondition: null

Sisi: PANEL. Policy create dengan ABAC kosong gagal di server:
percobaan pertama L18 gagal ("Invalid policy: abacCondition Invalid
input: expected record, received null") dan L21 gagal
("body/abacCondition Invalid input: expected record, received null");
diulang dengan JSON `{"attr": "subject.line_id", "eq": "LINE-01"}` →
berhasil. Panel mengirim `"abacCondition": null` eksplisit saat field
ABAC dikosongkan, padahal skema server untuk kedua jalur create (POST
/policies dan POST /roles/{id}/permissions) mendefinisikan
`abacCondition` sebagai optional record — bukan nullable; panel
seharusnya meng-omit field saat kosong.

Rantai null: `parseAbacCondition` mengembalikan `value: null` untuk
teks kosong (iamValidation.ts:10-11), diteruskan apa adanya oleh
`createPolicy`/`handleBindPermission`, lalu
`createIamPolicy`/`addIamRolePermission` menyertakan kunci karena
`null !== undefined` (iam.ts:248-266, 124/135), dan `JSON.stringify`
mempertahankan `null`. Perbaikan di panel: omit field saat kosong (dan
perbaiki asumsi salah di schemas/dto.ts:235 yang menganggap null sah).
Catatan: jalur PUT /policies/{id} justru mengizinkan nullable(record)
— hanya kedua jalur POST create yang salah. ABAC pada L20 dibiarkan
berisi JSON dari L18 karena mengosongkannya gagal di server.

### MUT-04 (panel) — Label downtime asli tidak bisa dikembalikan persis

Cleanup C1: modal overwrite label tidak punya opsi "Belum
dikategorikan" dan selalu memberi prefix kategori, sehingga teks asli
persis "Equipment failure" tidak bisa dikembalikan. Dikembalikan
dengan kategori EQUIPMENT_FAILURE + alasan "Equipment failure" →
baris kini "[EQUIPMENT_FAILURE] Equipment failure"; kolom kategori
tetap "Belum dikategorikan" seperti semula. Ini residu yang diterima
(lihat §6), bukan data uji sisa.

## 5. Koreksi rencana

Koreksi terhadap `docs/E2E_MUTATION_PLAN.md` dan ekspektasi awal
(bukan bug, kecuali dinyatakan lain):

1. **Topik ACL literal, bukan wildcard:** `publishClientSend` +
   `e2e/test/#` ditolak server ("Wildcards are not allowed in
   'publishClientSend' topics"); dipakai topik literal `e2e/test`.
2. **`read:telemetry` tidak ada di katalog live:** L18 memakai
   `refresh:telemetry`; L21 memakai `read:access_control`.
3. **Badge legacy register PROVISIONED, bukan ACTIVE** (L4) —
   observasi, bukan tiket.
4. **SKU produk tidak dikirim dari form create** (L8): SKU
   "SKU-E2E-TEST-01" yang diisi tidak terkirim; baris menampilkan SKU
   "PROD-TEST-E2E-01" (SKU default = Product ID). Terkonfirmasi live.
5. **authz_version #7 berulang** (L21 assign-perm, L22 assign-user,
   L25 revoke — ketiganya menampilkan #7; counter tampak tidak naik
   pada assign/revoke): observasi terbuka, **bukan** tiket. Rangkaian
   lengkap: #1 create role, #2 create policy, #3 disable, #4 enable,
   #5 update pattern v2, #6 restore pattern, #7 assign-perm,
   #8 unbind perm, #9 delete policy, #10 delete role.
6. **ABAC kosong ditolak server** (L18, L21): percobaan pertama
   dengan ABAC kosong gagal ("Invalid policy: abacCondition Invalid
   input: expected record, received null" / "body/abacCondition
   Invalid input: expected record, received null"); diulang dengan
   JSON `{"attr": "subject.line_id", "eq": "LINE-01"}` → berhasil.
   ABAC pada L20 dibiarkan berisi JSON dari L18 karena mengosongkannya
   gagal di server.
7. **Rute aktual** (koreksi `AUDIT.md` §34.6): `/work-orders`,
   `/audit`, `/downtime` (bukan `/admin/...`); `/admin/system-audit`
   adalah halaman terpisah tanpa filter UNACK/tombol ack.
8. **Opsi RESERVED di IAM:** `manage:access_control`,
   `manage:mqtt_admin`, `manage:mqtt_configuration`,
   `read_raw:mqtt_configuration` tampil "(DIBLOKIR - RESERVED)" dan
   disabled saat bind permission (L21).
9. **Validasi server bekerja benar** (bukan koreksi, dicatat sebagai
   bukti positif): Modbus Slave ID duplikat ditolak (L5),
   `ROLE_IN_USE` menolak hapus role ter-assign (L24), wildcard ACL
   ditolak (L30), ABAC kosong ditolak (L18, L21).

## 6. Yang belum teruji

- Panel kesiapan resolve WO (L41 — controller STM32-OEE-SIM offline,
  "Planned Start: —"; perilaku informatif, bukan bug).
- Label downtime baru pada event unlabeled (L43b — tidak ada event
  unlabeled: STM32-OEE-01 punya 2 event historis, keduanya sudah
  berlabel; STM32-OEE-SIM 0 event).
- Stage / diff / discard config (L38–L40 — akar yang sama dengan
  E2E-08, FAT-222; jangan buat tiket baru).
- Create / attach / rotasi password / disable-enable client MQTT
  (L31–L34 — terblokir MUT-02); add client ke group (L36).
- Hapus group yang masih berisi anggota (C6 — group sudah kosong
  karena C5 otomatis membersihkan keanggotaan).
- Dari `AUDIT.md` §34.8 tetap belum terverifikasi: WS handshake
  `/ws/telemetry`, `/force-change-password`, respons live endpoint
  401-gated, N-16/N-17/N-18 laten; N-32 butuh jawaban backend.

## 7. Perubahan permanen yang diterima

Perubahan permanen berikut **diterima** (bukan SISA — tidak ada data
uji yang tersisa untuk dibersihkan):

- Event 1148 di-ack oleh ADM-001 (11/19/2026, 7:05:45 PM, "E2E-TEST
  ack — verifikasi uji mutasi"); ack tidak bisa di-undo dari UI.
- WO-SIM-20260906-02 ABORTED (L45, irreversibel).
- Alasan downtime event 13:55:34 kini berprefix "[EQUIPMENT_FAILURE] "
  (MUT-04, C1); kolom kategori tetap "Belum dikategorikan".
- Entri audit trail append-only untuk semua mutasi.
- WO-001, ADM-001, dan role ADMIN tidak pernah disentuh; tidak ada
  Apply/Rollback config yang diklik.

Catatan cleanup: hapus role DynSec otomatis membersihkan keanggotaan
group (C5 — role E2E-TEST-ROLE dihapus saat masih anggota
E2E-TEST-GROUP; kartu group lalu menampilkan "Roles: (kosong)").
Sebaliknya, hapus group berisi anggota tidak teruji (lihat §5/§6).

## 8. SISA: KOSONG

Verifikasi akhir Bagian A (C13): devices hanya STM32-OEE-01 +
STM32-OEE-SIM; machines hanya CNC-MILLING-SIM + CNC-MILLING-01;
products 5 asli; operators 5 asli.

Verifikasi akhir Bagian B (C13): Access Control Roles (4), Policies
(62), Assignments (5), tanpa TEST-E2E-ROLE/assignment TST-E2E-01;
DynSec Clients (1) backend-admin saja, Roles & ACLs (1) admin saja,
Groups (0); Config Versions (0), tanpa STAGED; Operators 5, tanpa
TST-E2E-01.

Tidak ada data uji bernama `E2E-TEST-*` / `TEST-*` yang tersisa di
panel setelah kedua bagian selesai.
